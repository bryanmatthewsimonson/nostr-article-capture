import { ContentExtractor } from '../content-extractor.js';
import { PlatformHandler } from '../platform-handler.js';

const SubstackHandler = {
    type: 'article',
    platform: 'substack',

    canCapture: () => {
        return window.location.hostname.includes('substack.com') ||
               !!document.querySelector('meta[content*="substack"], script[src*="substack"]') ||
               !!document.querySelector('.available-content, .post-content');
    },

    extract: async () => {
        try {
            // Use standard Readability extraction as base
            const article = ContentExtractor.extractArticle();

            if (!article) return null;

            // Enhance with Substack-specific metadata
            article.platform = 'substack';

            // Extract Substack-specific data (wrapped in try/catch for graceful fallback)
            try {
                article.substackMeta = extractSubstackMeta();
            } catch (e) {
                console.warn('[NAC Substack] meta extraction failed:', e);
                article.substackMeta = {};
            }

            // Override siteName with publication name if available
            if (article.substackMeta?.publicationName) {
                article.siteName = article.substackMeta.publicationName;
            }

            // Substack newsletters often have subscriber counts, likes, etc.
            try {
                article.engagement = extractEngagement();
            } catch (e) {
                console.warn('[NAC Substack] engagement extraction failed:', e);
                article.engagement = null;
            }

            return article;
        } catch (e) {
            console.error('[NAC Substack] extract() failed:', e);
            return null;
        }
    },

    extractComments: async (articleUrl) => {
        try {
            // Substack has a specific comment structure
            const commentElements = document.querySelectorAll(
                '.comment-list-item, .comment, [class*="CommentListItem"], .thread-comment'
            );

            const comments = [];
            for (const el of commentElements) {
                const authorEl = el.querySelector('.commenter-name, .comment-author, [class*="CommentName"]');
                const textEl = el.querySelector('.comment-body, .comment-content, [class*="CommentBody"] p');
                const timeEl = el.querySelector('time, [datetime], .comment-timestamp');
                const avatarEl = el.querySelector('img.commenter-photo, img[class*="avatar"]');
                const profileLink = authorEl?.closest('a') || el.querySelector('a[href*="/profile/"]');

                const authorName = authorEl?.textContent?.trim() || 'Anonymous';
                const text = textEl?.textContent?.trim() || el.querySelector('p')?.textContent?.trim() || '';

                if (text.length < 2) continue;

                // Detect likes/hearts on comment
                const likesEl = el.querySelector('[class*="like-count"], [class*="heart-count"], .comment-like-count');
                const likes = likesEl ? parseInt(likesEl.textContent) || 0 : 0;

                comments.push({
                    authorName,
                    text,
                    timestamp: timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim(),
                    avatarUrl: avatarEl?.src || null,
                    profileUrl: profileLink?.href || null,
                    likes,
                    platform: 'substack',
                    sourceUrl: articleUrl
                });
            }

            return comments;
        } catch (e) {
            console.error('[NAC Substack] extractComments() failed:', e);
            return [];
        }
    },

    getReaderViewConfig: () => ({
        showEditor: true,
        showEntityBar: true,
        showClaimsBar: true,
        showComments: true,
        platformLabel: '✉️ Substack Newsletter'
    })
};

function extractSubstackMeta() {
    const meta = {
        publicationName: null,
        authorBio: null,
        isNewsletter: true,
        isPaid: false,
        likes: 0,
        restacks: 0,
        comments: 0
    };

    // Publication name
    meta.publicationName = document.querySelector(
        '.publication-name, [class*="PublicationName"], .navbar-title'
    )?.textContent?.trim() || document.querySelector('meta[property="og:site_name"]')?.content || null;

    // Author bio
    meta.authorBio = document.querySelector(
        '.author-bio, .subtitle, [class*="AuthorBio"]'
    )?.textContent?.trim() || null;

    // Paid/free detection
    meta.isPaid = !!document.querySelector(
        '.paywall, [class*="paywall"], .subscriber-only, [class*="PaywallBanner"]'
    );

    // Engagement metrics
    const likesEl = document.querySelector('[class*="like-count"], [class*="LikeCount"]');
    if (likesEl) meta.likes = parseInt(likesEl.textContent) || 0;

    const restacksEl = document.querySelector('[class*="restack-count"], [class*="RestackCount"]');
    if (restacksEl) meta.restacks = parseInt(restacksEl.textContent) || 0;

    const commentsEl = document.querySelector('[class*="comment-count"], [class*="CommentCount"]');
    if (commentsEl) meta.comments = parseInt(commentsEl.textContent) || 0;

    return meta;
}

function extractEngagement() {
    return {
        likes: parseInt(document.querySelector('[class*="like-count"]')?.textContent) || 0,
        shares: parseInt(document.querySelector('[class*="restack-count"], [class*="share-count"]')?.textContent) || 0,
        comments: parseInt(document.querySelector('[class*="comment-count"]')?.textContent) || 0
    };
}

// Register with the platform handler system
PlatformHandler.register('substack', SubstackHandler);

export { SubstackHandler };
