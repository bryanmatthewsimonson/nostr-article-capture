import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const FacebookHandler = {
    type: 'social_post',
    platform: 'facebook',

    canCapture: () => {
        const h = window.location.hostname;
        return h.includes('facebook.com') || h.includes('fb.com');
    },

    extract: async () => {
        // Use OG tags extensively as Facebook generates them well
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
        const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
        const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;
        const ogType = document.querySelector('meta[property="og:type"]')?.content || '';

        // Try to find the main post content
        const postEl = document.querySelector(
            '[data-ad-preview="message"], [data-testid="post_message"], ' +
            '.userContent, [class*="x1iorvi4"]'  // React class patterns
        );
        const postText = postEl?.textContent?.trim() || ogDesc || '';

        // Author from various possible locations
        const authorEl = document.querySelector(
            'h2 a[href*="facebook.com"], strong > a, [data-testid="story-subtitle"] a'
        );
        const authorName = authorEl?.textContent?.trim() || ogTitle.split(' - ')[0] || '';
        const authorUrl = authorEl?.href || '';

        // Timestamp
        const timeEl = document.querySelector('abbr[data-utime], time, [data-testid="story-subtitle"] a > span');
        const timestamp = timeEl?.getAttribute('data-utime') || timeEl?.getAttribute('datetime') || timeEl?.title || '';

        // Media
        const images = Array.from(document.querySelectorAll(
            'img[class*="scaledImageFit"], img[data-visualcompletion="media-vc-image"], [role="img"] img'
        )).map(img => img.src).filter(src => src && !src.includes('emoji'));

        let contentHtml = `<blockquote><p>${Utils.escapeHtml(postText)}</p>`;
        contentHtml += `<footer>— ${Utils.escapeHtml(authorName)} on Facebook</footer></blockquote>`;
        images.forEach(src => { contentHtml += `<figure><img src="${src}" alt="Facebook media"></figure>`; });

        // Engagement
        const engagement = extractFBEngagement();

        return {
            title: postText.substring(0, 80) + (postText.length > 80 ? '...' : '') || ogTitle,
            byline: authorName,
            url: ogUrl,
            domain: 'facebook.com',
            siteName: 'Facebook',
            publishedAt: timestamp ? Math.floor(new Date(parseInt(timestamp) * 1000 || timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
            content: contentHtml,
            textContent: postText,
            excerpt: postText.substring(0, 200),
            featuredImage: ogImage || images[0] || '',
            publicationIcon: 'https://www.facebook.com/favicon.ico',
            platform: 'facebook',
            contentType: 'social_post',
            engagement,
            wordCount: postText.split(/\s+/).filter(w => w).length,
            readingTimeMinutes: 1,
            structuredData: { type: 'SocialMediaPosting' },
            keywords: [],
            language: document.documentElement.lang || 'en',
            isPaywalled: false,
            section: null,
            dateModified: null
        };
    },

    extractComments: async (articleUrl) => {
        const commentEls = document.querySelectorAll(
            '[aria-label="Comment"], .UFICommentBody, [data-testid*="comment"], [class*="comment"]'
        );
        const comments = [];
        for (const el of commentEls) {
            const author = el.querySelector('a[role="link"], .UFICommentActorName, a span')?.textContent?.trim() || '';
            const text = el.querySelector('[dir="auto"], .UFICommentBody, span[dir]')?.textContent?.trim() || el.textContent?.trim() || '';
            if (text.length < 2 || !author) continue;
            comments.push({
                authorName: author,
                text: text.substring(0, 500),
                timestamp: null,
                avatarUrl: null,
                profileUrl: null,
                likes: 0,
                platform: 'facebook',
                sourceUrl: articleUrl
            });
        }
        return comments;
    },

    getReaderViewConfig: () => ({
        showEditor: false,
        showEntityBar: true,
        showClaimsBar: true,
        showComments: true,
        platformLabel: 'f Facebook Post'
    })
};

function extractFBEngagement() {
    // Facebook shows reactions, comments, shares in various formats
    const reactionsEl = document.querySelector('[aria-label*="reaction"], [aria-label*="Like"]');
    const commentsEl = document.querySelector('[aria-label*="comment"]');
    const sharesEl = document.querySelector('[aria-label*="share"]');

    const parseCount = (el) => {
        if (!el) return 0;
        const text = el.textContent?.replace(/,/g, '') || el.getAttribute('aria-label')?.replace(/,/g, '') || '';
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    };

    return {
        likes: parseCount(reactionsEl),
        comments: parseCount(commentsEl),
        shares: parseCount(sharesEl),
        views: 0
    };
}

PlatformHandler.register('facebook', FacebookHandler);
export { FacebookHandler };
