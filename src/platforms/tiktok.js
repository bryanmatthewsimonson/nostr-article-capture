import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const TikTokHandler = {
    type: 'video',
    platform: 'tiktok',

    canCapture: () => window.location.hostname.includes('tiktok.com'),

    extract: async () => {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
        const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
        const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

        const username = window.location.pathname.match(/@([^/]+)/)?.[1] || '';

        // TikTok stores data in script tags as JSON
        let videoData = {};
        try {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const s of scripts) {
                const json = JSON.parse(s.textContent);
                if (json['@type'] === 'VideoObject') { videoData = json; break; }
            }
        } catch(e) {}

        // Caption from various locations
        const captionEl = document.querySelector(
            '[data-e2e="browse-video-desc"], [class*="video-meta-caption"], h1'
        );
        const caption = captionEl?.textContent?.trim() || ogDesc || videoData.description || '';

        // Author
        const authorEl = document.querySelector(
            '[data-e2e="browse-username"], [class*="author-uniqueId"], [class*="user-username"]'
        );
        const authorName = authorEl?.textContent?.trim() || username || ogTitle.split('|')[0]?.trim() || '';

        // Engagement
        const likesEl = document.querySelector('[data-e2e="browse-like-count"], [data-e2e="like-count"]');
        const commentsEl = document.querySelector('[data-e2e="browse-comment-count"], [data-e2e="comment-count"]');
        const sharesEl = document.querySelector('[data-e2e="share-count"]');
        const viewsEl = document.querySelector('[data-e2e="video-views"]');

        const parseCount = (el) => {
            if (!el) return 0;
            const t = el.textContent?.trim().replace(/,/g, '') || '';
            if (t.includes('K')) return Math.round(parseFloat(t) * 1000);
            if (t.includes('M')) return Math.round(parseFloat(t) * 1000000);
            return parseInt(t) || 0;
        };

        let contentHtml = `<blockquote><p>${Utils.escapeHtml(caption)}</p>`;
        contentHtml += `<footer>— @${Utils.escapeHtml(authorName)} on TikTok</footer></blockquote>`;
        if (ogImage) contentHtml += `<figure><img src="${ogImage}" alt="TikTok video thumbnail"></figure>`;

        return {
            title: `@${authorName}: "${caption.substring(0, 60)}${caption.length > 60 ? '...' : ''}"`,
            byline: `@${authorName}`,
            url: ogUrl,
            domain: 'tiktok.com',
            siteName: 'TikTok',
            publishedAt: videoData.uploadDate ? Math.floor(new Date(videoData.uploadDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
            content: contentHtml,
            textContent: caption,
            excerpt: caption.substring(0, 200),
            featuredImage: ogImage,
            publicationIcon: 'https://www.tiktok.com/favicon.ico',
            platform: 'tiktok',
            contentType: 'video',
            videoMeta: {
                videoId: window.location.pathname.match(/\/video\/(\d+)/)?.[1] || '',
                duration: videoData.duration || '',
                username: authorName
            },
            engagement: {
                likes: parseCount(likesEl),
                comments: parseCount(commentsEl),
                shares: parseCount(sharesEl),
                views: parseCount(viewsEl)
            },
            wordCount: caption.split(/\s+/).filter(w => w).length,
            readingTimeMinutes: 1,
            structuredData: { type: 'VideoObject' },
            keywords: (caption.match(/#\w+/g) || []).map(h => h.replace('#', '').toLowerCase()),
            language: document.documentElement.lang || 'en',
            isPaywalled: false,
            section: null,
            dateModified: null
        };
    },

    extractComments: async (articleUrl) => {
        const commentEls = document.querySelectorAll(
            '[data-e2e="comment-level-1"], [class*="CommentItemWrapper"], [class*="comment-item"]'
        );
        const comments = [];
        for (const el of commentEls) {
            const authorEl = el.querySelector('[data-e2e="comment-username-1"], a[href*="/@"]');
            const textEl = el.querySelector('[data-e2e="comment-level-1"] span, p[class*="comment-text"]');
            const author = authorEl?.textContent?.trim() || '';
            const text = textEl?.textContent?.trim() || el.querySelector('span')?.textContent?.trim() || '';
            if (text.length < 2) continue;
            comments.push({
                authorName: author || 'Unknown',
                text: text.substring(0, 500),
                timestamp: null, avatarUrl: null, profileUrl: authorEl?.href || null,
                likes: 0, platform: 'tiktok', sourceUrl: articleUrl
            });
        }
        return comments;
    },

    getReaderViewConfig: () => ({
        showEditor: false, showEntityBar: true, showClaimsBar: true,
        showComments: true, platformLabel: '♪ TikTok Video'
    })
};

PlatformHandler.register('tiktok', TikTokHandler);
export { TikTokHandler };
