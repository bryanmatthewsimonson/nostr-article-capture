import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const FacebookHandler = {
    type: 'social_post',
    platform: 'facebook',
    needsUserSelection: true,

    canCapture: () => {
        const h = window.location.hostname;
        return h.includes('facebook.com') || h.includes('fb.com');
    },

    findPostContainer: (clickTarget) => {
        // Walk up the DOM from click target to find the post boundary
        // Facebook posts are typically in divs with role="article" or similar
        let el = clickTarget;
        let bestCandidate = clickTarget;

        while (el && el !== document.body) {
            // Check for known post container signals
            if (el.getAttribute('role') === 'article') return el;
            if (el.getAttribute('data-pagelet')?.includes('FeedUnit')) return el;
            if (el.getAttribute('data-testid')?.includes('Keycommand_wrapper')) return el;

            // Generic heuristics: large container with text and interaction buttons
            const hasText = el.textContent?.length > 50;
            const hasButtons = el.querySelectorAll('[role="button"]').length > 2;
            const hasLinks = el.querySelectorAll('a[href]').length > 1;
            const isLargeEnough = el.offsetHeight > 100;

            if (hasText && (hasButtons || hasLinks) && isLargeEnough) {
                bestCandidate = el;
            }

            el = el.parentElement;
        }

        return bestCandidate;
    },

    extract: async (containerEl) => {
        try {
            if (!containerEl) {
                // Fallback: use OG tags
                return extractFromOGTags();
            }

            return extractFromContainer(containerEl);
        } catch (e) {
            console.error('[NAC Facebook] Extraction failed:', e);
            return extractFromOGTags();
        }
    },

    extractComments: async (articleUrl) => {
        // Try to find comments in the current view
        try {
            const comments = [];
            // Facebook comments are often in [role="article"] nested under the main post
            const commentEls = document.querySelectorAll('[role="article"]');

            // Skip the first one (likely the post itself)
            const potentialComments = Array.from(commentEls).slice(1);

            for (const el of potentialComments.slice(0, 50)) { // Cap at 50
                const text = extractTextFromElement(el);
                if (text.length < 5) continue;

                const author = extractAuthorFromElement(el);

                comments.push({
                    authorName: author.name || 'Facebook User',
                    text: text.substring(0, 2000),
                    timestamp: extractTimestampFromElement(el),
                    avatarUrl: author.avatarUrl,
                    profileUrl: author.profileUrl,
                    likes: 0,
                    platform: 'facebook',
                    sourceUrl: articleUrl
                });
            }

            return comments;
        } catch (e) {
            console.error('[NAC Facebook] Comment extraction failed:', e);
            return [];
        }
    },

    getReaderViewConfig: () => ({
        showEditor: false,
        showEntityBar: true,
        showClaimsBar: true,
        showComments: true,
        platformLabel: 'f Facebook Post'
    })
};

// --- Extraction from selected container ---

function extractFromContainer(container) {
    // Extract all text content, preserving structure
    const postText = extractTextFromElement(container);
    const author = extractAuthorFromElement(container);
    const timestamp = extractTimestampFromElement(container);
    const images = extractImagesFromElement(container);
    const links = extractLinksFromElement(container);
    const engagement = extractEngagementFromElement(container);

    // Build Facebook-styled HTML content
    let contentHtml = buildFacebookStyledContent(postText, author, timestamp, images, links);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Facebook User',
        url: window.location.href,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.facebook.com/favicon.ico',

        platform: 'facebook',
        contentType: 'social_post',

        // Platform account data (NOT jammed into author)
        platformAccount: {
            username: author.name || 'Unknown',
            profileUrl: author.profileUrl || null,
            avatarUrl: author.avatarUrl || null,
            platform: 'facebook'
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

    const text = ogDesc || ogTitle;

    return {
        title: ogTitle || 'Facebook Post',
        byline: ogTitle.split(' - ')[0] || '',
        url: ogUrl,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: Math.floor(Date.now() / 1000),
        content: `<blockquote class="nac-facebook-post"><p>${Utils.escapeHtml(text)}</p></blockquote>`,
        textContent: text,
        excerpt: text.substring(0, 200),
        featuredImage: ogImage,
        publicationIcon: 'https://www.facebook.com/favicon.ico',
        platform: 'facebook',
        contentType: 'social_post',
        platformAccount: { username: ogTitle.split(' - ')[0] || 'Unknown', profileUrl: null, avatarUrl: null, platform: 'facebook' },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        wordCount: text.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'SocialMediaPosting' },
        keywords: [],
        language: 'en',
        isPaywalled: false,
        section: null,
        dateModified: null
    };
}

// --- DOM extraction helpers ---

function extractTextFromElement(el) {
    // Get text content but skip navigation, buttons, timestamps
    const clone = el.cloneNode(true);
    // Remove elements that aren't post content
    clone.querySelectorAll('svg, [role="button"], [role="navigation"], [data-testid="like_button"], [data-testid="comment_button"], [data-testid="share_button"]').forEach(x => x.remove());

    // Get all text nodes
    const text = clone.textContent?.trim() || '';

    // Clean up excessive whitespace
    return text.replace(/\s+/g, ' ').trim();
}

function extractAuthorFromElement(el) {
    // Look for author name - usually in a strong or h-tag link near the top
    const result = { name: '', profileUrl: null, avatarUrl: null };

    // Profile link (usually first substantive link)
    const links = el.querySelectorAll('a[href*="facebook.com"]');
    for (const link of links) {
        const href = link.href;
        // Profile links typically match /user/ or /profile/ or /@username or just /username
        if (href.match(/facebook\.com\/(profile\.php|[a-zA-Z0-9.]+)(\?|$)/) &&
            !href.includes('/posts/') && !href.includes('/photos/') && !href.includes('/videos/')) {
            const text = link.textContent?.trim();
            if (text && text.length > 1 && text.length < 100) {
                result.name = text;
                result.profileUrl = href;
                break;
            }
        }
    }

    // Avatar image
    const avatarImg = el.querySelector('image[href], img[src*="profile"], img[src*="scontent"]');
    if (avatarImg) {
        result.avatarUrl = avatarImg.getAttribute('href') || avatarImg.src;
    }

    return result;
}

function extractTimestampFromElement(el) {
    // Look for time elements
    const timeEl = el.querySelector('abbr[data-utime], time, a[href*="/posts/"] span');
    if (timeEl) {
        const utime = timeEl.getAttribute('data-utime');
        if (utime) return new Date(parseInt(utime) * 1000).toISOString();
        const datetime = timeEl.getAttribute('datetime');
        if (datetime) return datetime;
        // Try parsing text like "2h ago", "Yesterday", etc.
        const text = timeEl.textContent?.trim();
        if (text) return text; // Store as-is, parse later
    }
    return null;
}

function extractImagesFromElement(el) {
    const images = [];
    // Get post images (not avatars, not emoji, not icons)
    el.querySelectorAll('img[src]').forEach(img => {
        const src = img.src;
        const width = img.naturalWidth || img.width || 0;
        // Skip small images (avatars, icons, emoji)
        if (width > 0 && width < 50) return;
        // Skip common non-content patterns
        if (src.includes('emoji') || src.includes('icon') || src.includes('static')) return;
        if (src.includes('scontent') || src.includes('fbcdn')) {
            images.push(src);
        }
    });
    return images;
}

function extractLinksFromElement(el) {
    const links = [];
    el.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        // Skip internal Facebook navigation links
        if (href.includes('/profile.php') || href.includes('facebook.com/#') || href.includes('l.facebook.com/l.php')) return;
        // External links or Facebook content links
        if (!href.includes('facebook.com') || href.includes('/posts/') || href.includes('/videos/')) {
            const text = a.textContent?.trim();
            if (text && text.length > 3) {
                links.push({ url: href, text });
            }
        }
    });
    return links;
}

function extractEngagementFromElement(el) {
    const result = { likes: 0, comments: 0, shares: 0, views: 0 };

    // Look for reaction count, comment count, share count in the element's text
    const allText = el.textContent || '';

    // Patterns like "42 likes", "1.2K comments", etc.
    const likeMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*(like|reaction|Love|Haha|Wow|Sad|Angry)/i);
    if (likeMatch) result.likes = parseCount(likeMatch[1]);

    const commentMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*comment/i);
    if (commentMatch) result.comments = parseCount(commentMatch[1]);

    const shareMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*share/i);
    if (shareMatch) result.shares = parseCount(shareMatch[1]);

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

// --- Facebook-styled HTML content ---

function buildFacebookStyledContent(text, author, timestamp, images, links) {
    let html = '<div class="nac-facebook-post">';

    // Post header (author info)
    html += '<div class="nac-fb-header">';
    if (author.avatarUrl) {
        html += `<img class="nac-fb-avatar" src="${Utils.escapeHtml(author.avatarUrl)}" width="40" height="40" onerror="this.style.display='none'">`;
    }
    html += '<div class="nac-fb-author-info">';
    html += `<div class="nac-fb-author-name">${Utils.escapeHtml(author.name || 'Facebook User')}</div>`;
    if (timestamp) {
        html += `<div class="nac-fb-timestamp">${Utils.escapeHtml(typeof timestamp === 'string' ? timestamp : new Date(timestamp).toLocaleString())}</div>`;
    }
    html += '</div></div>';

    // Post text
    if (text) {
        html += `<div class="nac-fb-text">${Utils.escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    }

    // Images
    if (images.length > 0) {
        html += '<div class="nac-fb-images">';
        images.forEach(src => {
            html += `<img class="nac-fb-image" src="${Utils.escapeHtml(src)}" alt="Post image" loading="lazy">`;
        });
        html += '</div>';
    }

    // Shared links
    if (links.length > 0) {
        html += '<div class="nac-fb-links">';
        links.forEach(link => {
            html += `<a class="nac-fb-link" href="${Utils.escapeHtml(link.url)}" target="_blank">${Utils.escapeHtml(link.text)}</a>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// Register
PlatformHandler.register('facebook', FacebookHandler);
export { FacebookHandler };
