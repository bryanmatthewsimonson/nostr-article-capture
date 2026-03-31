import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const TikTokHandler = {
    type: 'video',
    platform: 'tiktok',
    needsUserSelection: true,

    canCapture: () => window.location.hostname.includes('tiktok.com'),

    findPostContainer: (clickTarget) => {
        // Walk up the DOM from click target to find the video post container
        let el = clickTarget;
        let bestCandidate = clickTarget;

        while (el && el !== document.body) {
            // Check for known TikTok post container signals
            if (el.getAttribute('data-e2e') === 'browse-video') return el;
            if (el.getAttribute('data-e2e') === 'recommend-list-item-container') return el;
            if (el.tagName === 'ARTICLE') return el;

            // TikTok video containers often have specific class patterns
            if (el.className && typeof el.className === 'string') {
                if (el.className.includes('DivItemContainer') ||
                    el.className.includes('video-feed-item') ||
                    el.className.includes('DivBrowserMode')) {
                    return el;
                }
            }

            // Generic heuristics: container with video and text
            const hasText = el.textContent?.length > 30;
            const hasVideo = el.querySelectorAll('video').length > 0;
            const hasImages = el.querySelectorAll('img').length > 0;
            const hasLinks = el.querySelectorAll('a[href]').length > 1;
            const isLargeEnough = el.offsetHeight > 150;

            if (hasText && (hasVideo || hasImages || hasLinks) && isLargeEnough) {
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
            console.error('[NAC TikTok] Extraction failed:', e);
            return extractFromOGTags();
        }
    },

    extractComments: async (articleUrl) => {
        try {
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
        } catch (e) {
            console.error('[NAC TikTok] extractComments() failed:', e);
            return [];
        }
    },

    getReaderViewConfig: () => ({
        showEditor: false, showEntityBar: true, showClaimsBar: true,
        showComments: true, platformLabel: '♪ TikTok Video'
    })
};

// --- Extraction from selected container ---

function extractFromContainer(container) {
    const postText = extractTextFromElement(container);
    const author = extractAuthorFromElement(container);
    const timestamp = extractTimestampFromElement(container);
    const thumbnail = extractThumbnailFromElement(container);
    const engagement = extractEngagementFromElement(container);
    const hashtags = extractHashtags(postText);

    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;

    // Build TikTok-styled HTML content
    let contentHtml = buildTikTokStyledContent(postText, author, timestamp, thumbnail || ogImage, hashtags);

    const title = author.name
        ? `@${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: `@${author.name || 'TikTok User'}`,
        url: ogUrl,
        domain: 'tiktok.com',
        siteName: 'TikTok',
        publishedAt: timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: thumbnail || ogImage,
        publicationIcon: 'https://www.tiktok.com/favicon.ico',

        platform: 'tiktok',
        contentType: 'video',

        // Platform account data (NOT jammed into author)
        platformAccount: {
            username: author.name || 'Unknown',
            profileUrl: author.profileUrl || null,
            avatarUrl: author.avatarUrl || null,
            platform: 'tiktok'
        },

        videoMeta: {
            videoId: window.location.pathname.match(/\/video\/(\d+)/)?.[1] || '',
            duration: '',
            username: author.name || ''
        },
        engagement,
        wordCount: postText.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'VideoObject' },
        keywords: hashtags,
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

    const username = window.location.pathname.match(/@([^/]+)/)?.[1] || '';

    // TikTok stores data in script tags as JSON
    let videoData = {};
    try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
            const json = JSON.parse(s.textContent);
            if (json['@type'] === 'VideoObject') { videoData = json; break; }
        }
    } catch(e) { /* ignore JSON parse errors */ }

    const authorName = username || ogTitle.split('|')[0]?.trim() || '';
    const caption = ogDesc || videoData.description || '';

    let contentHtml = '<div class="nac-tiktok-post">';
    contentHtml += '<div class="nac-tt-header">';
    contentHtml += `<div class="nac-tt-author-name">@${Utils.escapeHtml(authorName || 'TikTok User')}</div>`;
    contentHtml += '</div>';
    if (caption) {
        contentHtml += `<div class="nac-tt-caption">${Utils.escapeHtml(caption).replace(/\n/g, '<br>')}</div>`;
    }
    if (ogImage) {
        contentHtml += `<div class="nac-tt-thumbnail"><img class="nac-tt-image" src="${Utils.escapeHtml(ogImage)}" alt="TikTok video thumbnail" loading="lazy"></div>`;
    }
    contentHtml += '</div>';

    return {
        title: authorName ? `@${authorName}: "${caption.substring(0, 60)}${caption.length > 60 ? '...' : ''}"` : caption.substring(0, 80) || 'TikTok Video',
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
        platformAccount: { username: authorName || 'Unknown', profileUrl: null, avatarUrl: null, platform: 'tiktok' },
        videoMeta: {
            videoId: window.location.pathname.match(/\/video\/(\d+)/)?.[1] || '',
            duration: videoData.duration || '',
            username: authorName
        },
        engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
        wordCount: caption.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'VideoObject' },
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
    clone.querySelectorAll('svg, [role="button"], [role="navigation"], button, nav, video').forEach(x => x.remove());

    const text = clone.textContent?.trim() || '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractAuthorFromElement(el) {
    const result = { name: '', profileUrl: null, avatarUrl: null };

    // Look for author username — TikTok uses data-e2e attributes and @username links
    const usernameEl = el.querySelector(
        '[data-e2e="browse-username"], [data-e2e="video-author-uniqueid"], ' +
        'a[href*="/@"] [class*="uniqueId"], a[href*="/@"] [class*="username"]'
    );
    if (usernameEl) {
        result.name = usernameEl.textContent?.trim().replace(/^@/, '') || '';
        const parentLink = usernameEl.closest('a[href*="/@"]');
        if (parentLink) result.profileUrl = parentLink.href;
    }

    // Fallback: find any link matching /@username
    if (!result.name) {
        const links = el.querySelectorAll('a[href*="/@"]');
        for (const link of links) {
            const href = link.href;
            const match = href.match(/\/@([^/?]+)/);
            if (match) {
                const text = link.textContent?.trim();
                if (text && text.length > 1 && text.length < 80) {
                    result.name = text.replace(/^@/, '');
                    result.profileUrl = href;
                    break;
                }
            }
        }
    }

    // URL fallback
    if (!result.name) {
        result.name = window.location.pathname.match(/@([^/]+)/)?.[1] || '';
    }

    // OG title fallback
    if (!result.name) {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        result.name = ogTitle.split('|')[0]?.trim().replace(/^@/, '') || '';
    }

    // Avatar image — look for small circular profile images
    const avatarImg = el.querySelector(
        'img[src*="muscdn"], img[src*="tiktokcdn"], img[alt*="avatar"], ' +
        'img[alt*="profile"], [class*="avatar"] img'
    );
    if (avatarImg) {
        result.avatarUrl = avatarImg.src;
    }

    return result;
}

function extractTimestampFromElement(el) {
    // Look for time elements
    const timeEl = el.querySelector('time[datetime]');
    if (timeEl) {
        return timeEl.getAttribute('datetime');
    }

    // Look for relative timestamps in text
    const allText = el.textContent || '';
    const relativeMatch = allText.match(/(\d+)\s*(h|d|w|m|s)\s*ago/i);
    if (relativeMatch) {
        return relativeMatch[0]; // Store as-is, parse later
    }

    // Try JSON-LD on page
    try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
            const json = JSON.parse(s.textContent);
            if (json['@type'] === 'VideoObject' && json.uploadDate) {
                return json.uploadDate;
            }
        }
    } catch(e) { /* ignore */ }

    return null;
}

function extractThumbnailFromElement(el) {
    // Look for video poster or thumbnail images
    const videoEl = el.querySelector('video[poster]');
    if (videoEl?.poster) return videoEl.poster;

    // Look for thumbnail images (not avatars)
    const images = el.querySelectorAll('img[src]');
    for (const img of images) {
        const src = img.src;
        const width = img.naturalWidth || img.width || 0;
        // Skip small images (avatars, icons)
        if (width > 0 && width < 60) continue;
        // Skip emoji/icon patterns
        if (src.includes('emoji') || src.includes('icon') || src.includes('static')) continue;
        // TikTok CDN patterns
        if (src.includes('muscdn') || src.includes('tiktokcdn') || src.includes('p16-sign')) {
            // Skip likely avatar images
            if (src.includes('avatar') || src.includes('100x100')) continue;
            return src;
        }
    }

    return null;
}

function extractEngagementFromElement(el) {
    const result = { likes: 0, comments: 0, shares: 0, views: 0 };

    // TikTok uses data-e2e attributes for engagement counts
    const likesEl = el.querySelector('[data-e2e="browse-like-count"], [data-e2e="like-count"]');
    const commentsEl = el.querySelector('[data-e2e="browse-comment-count"], [data-e2e="comment-count"]');
    const sharesEl = el.querySelector('[data-e2e="share-count"]');
    const viewsEl = el.querySelector('[data-e2e="video-views"]');

    if (likesEl) result.likes = parseCount(likesEl.textContent?.trim());
    if (commentsEl) result.comments = parseCount(commentsEl.textContent?.trim());
    if (sharesEl) result.shares = parseCount(sharesEl.textContent?.trim());
    if (viewsEl) result.views = parseCount(viewsEl.textContent?.trim());

    // Fallback: text-based matching
    if (result.likes === 0 && result.comments === 0) {
        const allText = el.textContent || '';
        const likeMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*like/i);
        if (likeMatch) result.likes = parseCount(likeMatch[1]);
        const commentMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*comment/i);
        if (commentMatch) result.comments = parseCount(commentMatch[1]);
        const shareMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*share/i);
        if (shareMatch) result.shares = parseCount(shareMatch[1]);
        const viewMatch = allText.match(/(\d+[.,]?\d*[KkMm]?)\s*view/i);
        if (viewMatch) result.views = parseCount(viewMatch[1]);
    }

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

// --- TikTok-styled HTML content ---

function buildTikTokStyledContent(text, author, timestamp, thumbnail, hashtags) {
    let html = '<div class="nac-tiktok-post">';

    // Post header (author info)
    html += '<div class="nac-tt-header">';
    if (author.avatarUrl) {
        html += `<img class="nac-tt-avatar" src="${Utils.escapeHtml(author.avatarUrl)}" width="40" height="40" onerror="this.style.display='none'">`;
    }
    html += '<div class="nac-tt-author-info">';
    html += `<div class="nac-tt-author-name">@${Utils.escapeHtml(author.name || 'TikTok User')}</div>`;
    if (timestamp) {
        html += `<div class="nac-tt-timestamp">${Utils.escapeHtml(typeof timestamp === 'string' ? timestamp : new Date(timestamp).toLocaleString())}</div>`;
    }
    html += '</div></div>';

    // Video thumbnail
    if (thumbnail) {
        html += '<div class="nac-tt-thumbnail">';
        html += `<img class="nac-tt-image" src="${Utils.escapeHtml(thumbnail)}" alt="TikTok video thumbnail" loading="lazy">`;
        html += '<div class="nac-tt-play-icon">▶</div>';
        html += '</div>';
    }

    // Caption text
    if (text) {
        html += `<div class="nac-tt-caption">${Utils.escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    }

    // Hashtags
    if (hashtags && hashtags.length > 0) {
        html += '<div class="nac-tt-hashtags">';
        hashtags.forEach(tag => {
            html += `<span class="nac-tt-hashtag">#${Utils.escapeHtml(tag)}</span>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// Register
PlatformHandler.register('tiktok', TikTokHandler);
export { TikTokHandler };
