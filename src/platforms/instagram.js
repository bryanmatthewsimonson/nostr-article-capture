import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const InstagramHandler = {
    type: 'social_post',
    platform: 'instagram',
    needsUserSelection: true,

    canCapture: () => window.location.hostname.includes('instagram.com'),

    findPostContainer: (clickTarget) => {
        // Walk up the DOM from click target to find the post boundary
        let el = clickTarget;
        let bestCandidate = clickTarget;

        while (el && el !== document.body) {
            // Check for known post container signals
            if (el.tagName === 'ARTICLE') return el;
            if (el.getAttribute('role') === 'presentation') return el;
            if (el.getAttribute('role') === 'dialog') return el;

            // Generic heuristics: container with images and text
            const hasText = el.textContent?.length > 30;
            const hasImages = el.querySelectorAll('img').length > 0;
            const hasLinks = el.querySelectorAll('a[href]').length > 1;
            const isLargeEnough = el.offsetHeight > 100;

            if (hasText && (hasImages || hasLinks) && isLargeEnough) {
                bestCandidate = el;
            }

            el = el.parentElement;
        }

        return bestCandidate;
    },

    extract: async (containerEl) => {
        try {
            if (!containerEl) {
                return extractFromOGTags();
            }
            return extractFromContainer(containerEl);
        } catch (e) {
            console.error('[NAC Instagram] Extraction failed:', e);
            return extractFromOGTags();
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

// --- Extraction from selected container ---

function extractFromContainer(container) {
    const postText = extractTextFromElement(container);
    const author = extractAuthorFromElement(container);
    const timestamp = extractTimestampFromElement(container);
    const images = extractImagesFromElement(container);
    const engagement = extractEngagementFromElement(container);

    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

    const isReel = /\/reel\//.test(window.location.pathname);

    // Build Instagram-styled HTML content
    let contentHtml = buildInstagramStyledContent(postText, author, timestamp, images);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Instagram User',
        url: ogUrl,
        domain: 'instagram.com',
        siteName: 'Instagram',
        publishedAt: timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: ogImage || images[0] || '',
        publicationIcon: 'https://www.instagram.com/favicon.ico',

        platform: 'instagram',
        contentType: isReel ? 'video' : 'social_post',

        // Platform account data (NOT jammed into author)
        platformAccount: {
            username: author.name || 'Unknown',
            profileUrl: author.profileUrl || null,
            avatarUrl: author.avatarUrl || null,
            platform: 'instagram'
        },

        engagement,
        wordCount: postText.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'SocialMediaPosting' },
        keywords: extractHashtags(postText),
        language: document.documentElement.lang || 'en',
        isPaywalled: false,
        section: null,
        dateModified: null
    };
}

function extractFromOGTags() {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

    const isReel = /\/reel\//.test(window.location.pathname);

    // Author from OG title
    const authorName = ogTitle.match(/(.+?) on Instagram/)?.[1] ||
                      ogTitle.split('•')[0]?.trim() ||
                      document.querySelector('header a[href*="/"]')?.textContent?.trim() || '';

    const text = ogDesc || ogTitle;
    const caption = text;

    let contentHtml = '<div class="nac-instagram-post">';
    contentHtml += '<div class="nac-ig-header">';
    contentHtml += `<div class="nac-ig-author-name">${Utils.escapeHtml(authorName || 'Instagram User')}</div>`;
    contentHtml += '</div>';
    if (caption) {
        contentHtml += `<div class="nac-ig-caption">${Utils.escapeHtml(caption).replace(/\n/g, '<br>')}</div>`;
    }
    if (ogImage) {
        contentHtml += `<div class="nac-ig-images"><img class="nac-ig-image" src="${Utils.escapeHtml(ogImage)}" alt="Instagram media" loading="lazy"></div>`;
    }
    contentHtml += '</div>';

    return {
        title: authorName ? `${authorName}: "${caption.substring(0, 60)}${caption.length > 60 ? '...' : ''}"` : caption.substring(0, 80) || 'Instagram Post',
        byline: authorName || '',
        url: ogUrl,
        domain: 'instagram.com',
        siteName: 'Instagram',
        publishedAt: Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: caption,
        excerpt: caption.substring(0, 200),
        featuredImage: ogImage,
        publicationIcon: 'https://www.instagram.com/favicon.ico',
        platform: 'instagram',
        contentType: isReel ? 'video' : 'social_post',
        platformAccount: { username: authorName || 'Unknown', profileUrl: null, avatarUrl: null, platform: 'instagram' },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        wordCount: caption.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'SocialMediaPosting' },
        keywords: extractHashtags(caption),
        language: document.documentElement.lang || 'en',
        isPaywalled: false,
        section: null,
        dateModified: null
    };
}

// --- DOM extraction helpers ---

function extractTextFromElement(el) {
    const clone = el.cloneNode(true);
    // Remove elements that aren't post content
    clone.querySelectorAll('svg, [role="button"], [role="navigation"], button, nav').forEach(x => x.remove());

    const text = clone.textContent?.trim() || '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractAuthorFromElement(el) {
    const result = { name: '', profileUrl: null, avatarUrl: null };

    // Look for author link — usually a link with /@username pattern near header
    const headerEl = el.querySelector('header') || el;
    const links = headerEl.querySelectorAll('a[href*="/"]');
    for (const link of links) {
        const href = link.href;
        // Profile links typically match instagram.com/username
        if (href.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) &&
            !href.includes('/p/') && !href.includes('/reel/') &&
            !href.includes('/explore/') && !href.includes('/stories/')) {
            const text = link.textContent?.trim();
            if (text && text.length > 1 && text.length < 100) {
                result.name = text;
                result.profileUrl = href;
                break;
            }
        }
    }

    // Fallback: try OG title
    if (!result.name) {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        result.name = ogTitle.match(/(.+?) on Instagram/)?.[1] ||
                     ogTitle.split('•')[0]?.trim() || '';
    }

    // Avatar image — look for small circular profile images
    const avatarImg = el.querySelector('header img[src], img[alt*="profile"], img[src*="profile"]');
    if (avatarImg) {
        result.avatarUrl = avatarImg.src;
    }

    return result;
}

function extractTimestampFromElement(el) {
    const timeEl = el.querySelector('time[datetime]');
    if (timeEl) {
        return timeEl.getAttribute('datetime');
    }
    // Look for relative timestamps
    const links = el.querySelectorAll('a[href*="/p/"] time, a time');
    for (const link of links) {
        const datetime = link.getAttribute('datetime');
        if (datetime) return datetime;
    }
    return null;
}

function extractImagesFromElement(el) {
    const images = [];
    el.querySelectorAll('img[src]').forEach(img => {
        const src = img.src;
        const srcset = img.getAttribute('srcset');
        const width = img.naturalWidth || img.width || 0;

        // Skip small images (avatars, icons)
        if (width > 0 && width < 50) return;
        // Skip emoji and icon patterns
        if (src.includes('emoji') || src.includes('icon') || src.includes('static')) return;

        // Use highest-res from srcset if available
        if (srcset) {
            const srcsetParts = srcset.split(',').map(s => s.trim());
            const largest = srcsetParts.pop()?.split(' ')[0];
            if (largest && !images.includes(largest)) {
                images.push(largest);
                return;
            }
        }

        // Instagram CDN image patterns
        if (src.includes('cdninstagram') || src.includes('scontent') || src.includes('fbcdn') ||
            src.includes('instagram')) {
            if (!src.includes('profile_pic') && !images.includes(src)) {
                images.push(src);
            }
        }
    });

    // Fallback to OG image
    if (images.length === 0) {
        const ogImage = document.querySelector('meta[property="og:image"]')?.content;
        if (ogImage) images.push(ogImage);
    }

    return images;
}

function extractEngagementFromElement(el) {
    const result = { likes: 0, comments: 0, shares: 0, views: 0 };

    const allText = el.textContent || '';

    // Patterns like "42 likes", "1,234 likes"
    const likeMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*like/i);
    if (likeMatch) result.likes = parseCount(likeMatch[1]);

    const commentMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*comment/i);
    if (commentMatch) result.comments = parseCount(commentMatch[1]);

    const viewMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*view/i);
    if (viewMatch) result.views = parseCount(viewMatch[1]);

    return result;
}

function parseCount(text) {
    if (!text) return 0;
    text = text.replace(/,/g, '');
    if (text.match(/[Kk]/)) return Math.round(parseFloat(text) * 1000);
    if (text.match(/[Mm]/)) return Math.round(parseFloat(text) * 1000000);
    return parseInt(text) || 0;
}

function extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(h => h.replace('#', '').toLowerCase());
}

// --- Instagram-styled HTML content ---

function buildInstagramStyledContent(text, author, timestamp, images) {
    let html = '<div class="nac-instagram-post">';

    // Post header (author info)
    html += '<div class="nac-ig-header">';
    if (author.avatarUrl) {
        html += `<img class="nac-ig-avatar" src="${Utils.escapeHtml(author.avatarUrl)}" width="32" height="32" onerror="this.style.display='none'">`;
    }
    html += '<div class="nac-ig-author-info">';
    html += `<div class="nac-ig-author-name">${Utils.escapeHtml(author.name || 'Instagram User')}</div>`;
    if (timestamp) {
        html += `<div class="nac-ig-timestamp">${Utils.escapeHtml(typeof timestamp === 'string' ? timestamp : new Date(timestamp).toLocaleString())}</div>`;
    }
    html += '</div></div>';

    // Images
    if (images.length > 0) {
        html += '<div class="nac-ig-images">';
        images.forEach(src => {
            html += `<img class="nac-ig-image" src="${Utils.escapeHtml(src)}" alt="Instagram media" loading="lazy">`;
        });
        html += '</div>';
    }

    // Caption text
    if (text) {
        html += `<div class="nac-ig-caption"><span class="nac-ig-caption-author">${Utils.escapeHtml(author.name || '')}</span> ${Utils.escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    }

    html += '</div>';
    return html;
}

// Register
PlatformHandler.register('instagram', InstagramHandler);
export { InstagramHandler };
