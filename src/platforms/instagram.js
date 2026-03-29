import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const InstagramHandler = {
    type: 'social_post',
    platform: 'instagram',

    canCapture: () => window.location.hostname.includes('instagram.com'),

    extract: async () => {
        try {
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
            const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
            const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
            const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

            const isPost = /\/p\//.test(window.location.pathname);
            const isReel = /\/reel\//.test(window.location.pathname);

            // Author from OG title or page header
            const authorName = ogTitle.match(/(.+?) on Instagram/)?.[1] ||
                              ogTitle.split('•')[0]?.trim() ||
                              document.querySelector('header a[href*="/"]')?.textContent?.trim() || '';

            // Caption text
            const captionEl = document.querySelector(
                '[class*="caption"] span, article span[dir="auto"], h1 + div span'
            );
            const caption = captionEl?.textContent?.trim() || ogDesc || '';

            // Media
            const images = Array.from(document.querySelectorAll('article img[srcset], article img[src*="instagram"]'))
                .map(img => img.src).filter(src => src && !src.includes('profile_pic'));
            const videos = Array.from(document.querySelectorAll('article video source, article video'))
                .map(v => v.src || v.querySelector('source')?.src).filter(Boolean);

            let contentHtml = `<blockquote><p>${Utils.escapeHtml(caption)}</p>`;
            contentHtml += `<footer>— ${Utils.escapeHtml(authorName)} on Instagram</footer></blockquote>`;
            images.forEach(src => { contentHtml += `<figure><img src="${Utils.escapeHtml(src)}" alt="Instagram media"></figure>`; });

            // Engagement
            const likesEl = document.querySelector('section span[class*="like"], [class*="like"] span');
            const likes = parseInt(likesEl?.textContent?.replace(/,/g, '')) || 0;

            return {
                title: `${authorName}: "${caption.substring(0, 60)}${caption.length > 60 ? '...' : ''}"`,
                byline: authorName,
                url: ogUrl,
                domain: 'instagram.com',
                siteName: 'Instagram',
                publishedAt: Math.floor(Date.now() / 1000),
                content: contentHtml,
                textContent: caption,
                excerpt: caption.substring(0, 200),
                featuredImage: ogImage || images[0] || '',
                publicationIcon: 'https://www.instagram.com/favicon.ico',
                platform: 'instagram',
                contentType: isReel ? 'video' : 'social_post',
                engagement: { likes, shares: 0, comments: 0, views: 0 },
                wordCount: caption.split(/\s+/).filter(w => w).length,
                readingTimeMinutes: 1,
                structuredData: { type: 'SocialMediaPosting' },
                keywords: (caption.match(/#\w+/g) || []).map(h => h.replace('#', '').toLowerCase()),
                language: document.documentElement.lang || 'en',
                isPaywalled: false,
                section: null,
                dateModified: null
            };
        } catch (e) {
            console.error('[NAC Instagram] extract() failed:', e);
            return null;
        }
    },

    extractComments: async (articleUrl) => {
        try {
            const commentEls = document.querySelectorAll('ul li[role="menuitem"], [class*="comment"] span[dir="auto"]');
            const comments = [];
            for (const el of commentEls) {
                const authorEl = el.querySelector('a[href*="/"], h3 a');
                const author = authorEl?.textContent?.trim() || '';
                const spans = el.querySelectorAll('span[dir="auto"]');
                const text = spans.length > 1 ? spans[1]?.textContent?.trim() : spans[0]?.textContent?.trim() || '';
                if (text.length < 2) continue;
                comments.push({
                    authorName: author || 'Unknown',
                    text: text.substring(0, 500),
                    timestamp: null, avatarUrl: null, profileUrl: authorEl?.href || null,
                    likes: 0, platform: 'instagram', sourceUrl: articleUrl
                });
            }
            return comments;
        } catch (e) {
            console.error('[NAC Instagram] extractComments() failed:', e);
            return [];
        }
    },

    getReaderViewConfig: () => ({
        showEditor: false, showEntityBar: true, showClaimsBar: true,
        showComments: true, platformLabel: '📷 Instagram Post'
    })
};

PlatformHandler.register('instagram', InstagramHandler);
export { InstagramHandler };
