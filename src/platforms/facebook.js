import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

/**
 * Strip navigation noise from Facebook container innerText.
 * Facebook containers include repeated "Facebook" nav text, UI buttons, etc.
 */
function cleanContainerText(text) {
    if (!text) return '';

    // Split into lines for line-by-line processing
    const lines = text.split('\n');
    const cleanLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Skip navigation/UI lines
        if (trimmed === 'Facebook') continue;
        if (trimmed === 'Like') continue;
        if (trimmed === 'Comment') continue;
        if (trimmed === 'Share') continue;
        if (trimmed === 'Send') continue;
        if (trimmed === 'Copy link') continue;
        if (trimmed === 'More') continue;
        if (trimmed === 'Most relevant') continue;
        if (trimmed === 'Newest') continue;
        if (trimmed === 'All comments') continue;
        if (trimmed === 'Write a comment…') continue;
        if (trimmed === 'Write a comment...') continue;
        if (trimmed === 'Write a public comment…') continue;
        if (trimmed === 'See more') continue;
        if (trimmed === 'See less') continue;
        if (trimmed === 'View more comments') continue;
        if (trimmed === 'Hide') continue;
        if (trimmed === 'Report') continue;
        if (trimmed === 'Embed') continue;
        if (trimmed === 'Turn on notifications') continue;
        if (trimmed === 'Not now') continue;

        // Skip header patterns like "Author's Post"
        if (/^.+'s Post$/i.test(trimmed)) continue;

        // Skip relative timestamps (2h, 3d, 1w, etc.)
        if (/^\d+[hdwmy]$/.test(trimmed)) continue;

        // Skip engagement counts
        if (/^\d+[KkMm]?\s*(likes?|comments?|shares?|reactions?|views?)$/i.test(trimmed)) continue;

        // Skip very short lines that are probably UI (1-2 chars like emoji buttons)
        if (trimmed.length <= 2 && !/[a-zA-Z]/.test(trimmed)) continue;

        cleanLines.push(trimmed);
    }

    return cleanLines.join('\n').trim();
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
        let el = clickTarget;
        let bestCandidate = clickTarget;

        while (el && el !== document.body) {
            // Strong signal: role="article"
            if (el.getAttribute('role') === 'article') {
                console.log('[NAC Facebook] Post container found: role="article"', el.tagName);
                return el;
            }

            // A div with dir="auto" that has substantial text is likely the post text area
            if (el.getAttribute('dir') === 'auto' && el.innerText.length > 30) {
                console.log('[NAC Facebook] Post container found: dir="auto" div', el.innerText.length, 'chars');
                return el;
            }

            // Look for divs that contain text but NOT the "Facebook" navigation
            if (el.tagName === 'DIV' && el.offsetHeight > 100 && el.innerText.length > 50) {
                // Check if this div contains the "Facebook" navigation noise
                const text = el.innerText;
                const fbCount = (text.match(/^Facebook$/gm) || []).length;
                if (fbCount < 3) {
                    // This div doesn't have much navigation noise — good candidate
                    bestCandidate = el;
                }
            }

            el = el.parentElement;
        }

        console.log('[NAC Facebook] Using best candidate container', bestCandidate.tagName, bestCandidate.innerText?.length, 'chars');
        return bestCandidate;
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

            // Get first real sentence for title (not a short fragment)
            let titleText = postText;
            const firstNewline = postText.indexOf('\n');
            if (firstNewline > 10 && firstNewline < 200) {
                titleText = postText.substring(0, firstNewline);
            } else {
                titleText = postText.substring(0, 80);
            }
            const title = authorName
                ? `${authorName}: "${titleText}${postText.length > titleText.length ? '...' : ''}"`
                : (titleText + (postText.length > titleText.length ? '...' : '')) || ogTitle || 'Facebook Post';

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
