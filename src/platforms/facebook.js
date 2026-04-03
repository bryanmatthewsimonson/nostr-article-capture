import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

/**
 * Strip navigation noise from Facebook container innerText.
 * Facebook containers include repeated "Facebook" nav text, UI buttons, etc.
 */
function cleanContainerText(text) {
    let cleaned = text;
    // Remove repeated "Facebook" navigation text
    cleaned = cleaned.replace(/(Facebook\n)+/g, '');
    // Remove common UI elements
    cleaned = cleaned.replace(/^(Like|Comment|Share|Send|Copy link|More|Write a comment|Most relevant|Newest|All comments)\n?/gm, '');
    // Remove engagement counts
    cleaned = cleaned.replace(/^\d+[KkMm]?\s*(likes?|comments?|shares?|reactions?|views?)\n?/gm, '');
    // Remove timestamps that look like "2h" "3d" "1w" etc
    cleaned = cleaned.replace(/^\d+[hdwmy]\n/gm, '');
    return cleaned.trim();
}

const FacebookHandler = {
    type: 'social_post',
    platform: 'facebook',
    needsUserSelection: true,

    canCapture: () => {
        const h = window.location.hostname;
        return h.includes('facebook.com') || h.includes('fb.com');
    },

    findPostContainer: (clickTarget) => {
        // Simple: walk up to find the nearest large container
        let el = clickTarget;
        while (el && el !== document.body) {
            if (el.getAttribute('role') === 'article') {
                console.log('[NAC Facebook] Post container found: role="article"', el.tagName);
                return el;
            }
            // Any div larger than 150px that has substantial text
            if (el.tagName === 'DIV' && el.offsetHeight > 150 && el.innerText.length > 50) {
                console.log('[NAC Facebook] Post container found: large div', el.offsetHeight + 'px,', el.innerText.length, 'chars');
                return el;
            }
            el = el.parentElement;
        }
        console.log('[NAC Facebook] No post container found, using click target');
        return clickTarget;
    },

    extract: async (containerEl, selectedText) => {
        try {
            console.log('[NAC Facebook] extract() called, container:', containerEl?.tagName, containerEl?.getAttribute('role'), 'selectedText:', selectedText?.substring(0, 80));

            // Get OG tags — these ALWAYS work on Facebook
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
            const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
            const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
            const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

            console.log('[NAC Facebook] OG tags:', { ogTitle: ogTitle.substring(0, 50), ogDesc: ogDesc.substring(0, 50), hasImage: !!ogImage });

            // Use selected text as primary content (most reliable — user highlighted exactly what they want)
            let postText = selectedText || '';

            // Only fall back to container text if no selection
            if (!postText && containerEl?.innerText) {
                postText = cleanContainerText(containerEl.innerText);
                console.log('[NAC Facebook] No selected text, using cleaned container text');
            }

            // If still too short, use OG description
            if (postText.length < 10) {
                postText = ogDesc || ogTitle || '';
                console.log('[NAC Facebook] Text too short, using OG data');
            }

            // Try to find images in the container
            const images = [];
            if (containerEl) {
                containerEl.querySelectorAll('img[src]').forEach(img => {
                    const src = img.src;
                    if (src && !src.includes('emoji') && !src.includes('icon') &&
                        (img.width > 50 || img.naturalWidth > 50 || src.includes('scontent') || src.includes('fbcdn'))) {
                        images.push(src);
                    }
                });
            }

            // Try to identify the author from OG title (Facebook format: "Author Name - post text")
            let authorName = '';
            if (ogTitle) {
                // Facebook OG titles often follow "Author Name" or "Author Name - ..." format
                const dashIdx = ogTitle.indexOf(' - ');
                const pipeIdx = ogTitle.indexOf(' | ');
                if (dashIdx > 0 && dashIdx < 50) {
                    authorName = ogTitle.substring(0, dashIdx).trim();
                } else if (pipeIdx > 0 && pipeIdx < 50) {
                    authorName = ogTitle.substring(0, pipeIdx).trim();
                }
            }

            // Build simple, clean content HTML
            let contentHtml = '<div class="nac-facebook-post">';
            contentHtml += '<div class="nac-fb-header">';
            contentHtml += `<div class="nac-fb-author-name">${Utils.escapeHtml(authorName || 'Facebook Post')}</div>`;
            contentHtml += '</div>';
            contentHtml += `<div class="nac-fb-text">${Utils.escapeHtml(postText).replace(/\n/g, '<br>')}</div>`;

            if (images.length > 0) {
                contentHtml += '<div class="nac-fb-images">';
                images.slice(0, 5).forEach(src => {
                    contentHtml += `<img class="nac-fb-image" src="${Utils.escapeHtml(src)}" alt="Post image" loading="lazy">`;
                });
                contentHtml += '</div>';
            }
            contentHtml += '</div>';

            const title = authorName
                ? `${authorName}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
                : (postText.substring(0, 80) + (postText.length > 80 ? '...' : '')) || ogTitle || 'Facebook Post';

            console.log('[NAC Facebook] Extract result:', {
                title: title.substring(0, 50),
                textLength: postText.length,
                imageCount: images.length,
                hasOgData: !!ogTitle
            });

            return {
                title,
                byline: authorName || '',
                url: ogUrl,
                domain: 'facebook.com',
                siteName: 'Facebook',
                publishedAt: Math.floor(Date.now() / 1000),
                content: contentHtml,
                textContent: postText,
                excerpt: postText.substring(0, 200) || ogDesc,
                featuredImage: ogImage || images[0] || '',
                publicationIcon: 'https://www.facebook.com/favicon.ico',
                platform: 'facebook',
                contentType: 'social_post',
                platformAccount: {
                    username: authorName || 'Facebook User',
                    profileUrl: null,
                    avatarUrl: null,
                    platform: 'facebook'
                },
                engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
                wordCount: postText.split(/\s+/).filter(w => w).length,
                readingTimeMinutes: 1,
                structuredData: { type: 'SocialMediaPosting' },
                keywords: (postText.match(/#\w+/g) || []).map(h => h.replace('#', '').toLowerCase()),
                language: document.documentElement.lang || 'en',
                isPaywalled: false,
                section: null,
                dateModified: null
            };
        } catch (e) {
            console.error('[NAC Facebook] Extract failed:', e);
            return null;
        }
    },

    extractComments: async () => [],  // Skip for now

    getReaderViewConfig: () => ({
        showEditor: true,  // Let users edit the content
        showEntityBar: true,
        showClaimsBar: true,
        showComments: false,
        platformLabel: 'f Facebook Post'
    })
};

PlatformHandler.register('facebook', FacebookHandler);
export { FacebookHandler };
