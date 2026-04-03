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
            const comments = [];

            // Strategy 1: ARIA-based comment discovery
            const commentEls = document.querySelectorAll('ul li[role="menuitem"], [role="article"]');
            // Strategy 2: Fallback to class-based selectors
            const fallbackEls = document.querySelectorAll('[class*="comment"] span[dir="auto"]');
            const allEls = commentEls.length > 0 ? commentEls : fallbackEls;

            for (const el of allEls) {
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

// --- Safe timestamp parser (handles relative times like "2h", "Yesterday") ---

function parseTimestampToUnix(timestamp) {
    if (!timestamp) return Math.floor(Date.now() / 1000);
    if (typeof timestamp === 'number') {
        return timestamp > 4102444800 ? Math.floor(timestamp / 1000) : timestamp;
    }
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
        return Math.floor(parsed.getTime() / 1000);
    }
    const now = Date.now();
    const relMatch = String(timestamp).match(/^(\d+)\s*(h|m|d|hour|minute|day|week|month)s?\s*(ago)?$/i);
    if (relMatch) {
        const amount = parseInt(relMatch[1]);
        const unit = relMatch[2].toLowerCase();
        const msMap = { h: 3600000, m: 60000, d: 86400000, hour: 3600000, minute: 60000, day: 86400000, week: 604800000, month: 2592000000 };
        const ms = msMap[unit] || 3600000;
        return Math.floor((now - amount * ms) / 1000);
    }
    if (/^yesterday$/i.test(timestamp)) return Math.floor((now - 86400000) / 1000);
    if (/^just now$/i.test(timestamp)) return Math.floor(now / 1000);
    return Math.floor(now / 1000);
}

// ============================================================
// Anti-obfuscation extraction strategies (cascading fallbacks)
// ============================================================

function extractFromContainer(container) {
    // Strategy 1: Try React fiber data (fastest, most data-rich)
    const fiberData = getReactFiberData(container);
    if (fiberData && (fiberData.text || fiberData.authorName)) {
        console.log('[NAC Instagram] Extracted via React fiber');
        return buildArticleFromFiberData(fiberData, container);
    }

    // Strategy 2: ARIA-based extraction (stable, accessibility-driven)
    const ariaData = extractViaARIA(container);
    if (ariaData.text && ariaData.text.length > 5) {
        console.log('[NAC Instagram] Extracted via ARIA attributes');
        return buildArticleFromExtractedData(ariaData, container);
    }

    // Strategy 3: Text pattern analysis + computed styles (class-independent)
    const patternData = extractViaPatterns(container);
    if (patternData.text && patternData.text.length > 5) {
        console.log('[NAC Instagram] Extracted via text patterns');
        return buildArticleFromExtractedData(patternData, container);
    }

    // Strategy 4: Raw text extraction (last resort, pre-existing logic)
    console.log('[NAC Instagram] Falling back to raw text extraction');
    return buildArticleFromRawText(container);
}

// --- Strategy 1: React Fiber Tree Traversal ---

function getReactFiberData(element) {
    try {
        const fiberKey = Object.keys(element).find(k =>
            k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$') || k.startsWith('__reactProps$')
        );
        if (!fiberKey) return null;

        let fiber = element[fiberKey];
        // Walk up to find meaningful data
        for (let i = 0; i < 30 && fiber; i++) {
            const props = fiber.memoizedProps || fiber.pendingProps || {};

            // Instagram stores post data in various prop shapes
            if (props.post) return flattenPostData(props.post);
            if (props.media) return flattenPostData(props.media);
            if (props.shortcode_media) return flattenPostData(props.shortcode_media);
            if (props.__typename === 'XDTGraphImage' || props.__typename === 'XDTGraphVideo' || props.__typename === 'XDTGraphSidecar') {
                return flattenPostData(props);
            }

            // Check for data nested in `data` or `node` props
            if (props.data?.shortcode_media) return flattenPostData(props.data.shortcode_media);
            if (props.data?.xdt_shortcode_media) return flattenPostData(props.data.xdt_shortcode_media);
            if (props.data?.node) return flattenPostData(props.data.node);

            fiber = fiber.return;
        }
    } catch (e) {
        console.log('[NAC Instagram] React fiber traversal failed:', e.message);
    }
    return null;
}

function flattenPostData(post) {
    // Normalize various Instagram post data shapes into a flat object
    const caption = post.edge_media_to_caption?.edges?.[0]?.node?.text ||
        post.caption?.text || post.caption || post.text || '';

    return {
        text: typeof caption === 'string' ? caption : '',
        authorName: post.owner?.username || post.user?.username || post.author?.name || '',
        authorFullName: post.owner?.full_name || post.user?.full_name || '',
        authorId: post.owner?.id || post.user?.pk || '',
        authorUrl: post.owner?.username ? `https://www.instagram.com/${post.owner.username}/` : '',
        authorAvatar: post.owner?.profile_pic_url || post.user?.profile_pic_url || '',
        timestamp: post.taken_at_timestamp || post.taken_at || post.timestamp || null,
        url: post.shortcode ? `https://www.instagram.com/p/${post.shortcode}/` : '',
        displayUrl: post.display_url || post.image_versions2?.candidates?.[0]?.url || '',
        isVideo: post.is_video || post.__typename === 'XDTGraphVideo' || false,
        videoUrl: post.video_url || '',
        likes: post.edge_media_preview_like?.count || post.like_count || 0,
        comments: post.edge_media_to_comment?.count || post.comment_count || 0,
    };
}

function buildArticleFromFiberData(fiberData, container) {
    const images = fiberData.displayUrl ? [fiberData.displayUrl] : extractImagesFromElement(container);
    const postText = fiberData.text || extractTextFromElement(container);
    const engagement = {
        likes: fiberData.likes || 0,
        comments: fiberData.comments || 0,
        shares: 0,
        views: 0
    };

    const author = {
        name: fiberData.authorName || fiberData.authorFullName || '',
        profileUrl: fiberData.authorUrl || null,
        avatarUrl: fiberData.authorAvatar || null
    };

    // If fiber didn't give us an author, try DOM fallback
    if (!author.name) {
        const domAuthor = extractAuthorFromElement(container);
        author.name = domAuthor.name;
        author.profileUrl = domAuthor.profileUrl;
        author.avatarUrl = domAuthor.avatarUrl;
    }

    const timestamp = fiberData.timestamp
        ? (typeof fiberData.timestamp === 'number'
            ? new Date(fiberData.timestamp * 1000).toISOString()
            : fiberData.timestamp)
        : extractTimestampFromElement(container);

    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;
    const isReel = /\/reel\//.test(window.location.pathname) || fiberData.isVideo;
    const contentHtml = buildInstagramStyledContent(postText, author, timestamp, images);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Instagram User',
        url: fiberData.url || ogUrl,
        domain: 'instagram.com',
        siteName: 'Instagram',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.instagram.com/favicon.ico',
        platform: 'instagram',
        contentType: isReel ? 'video' : 'social_post',
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

// --- Strategy 2: ARIA / Accessibility Attributes ---

function extractViaARIA(container) {
    const data = { text: '', author: { name: '', profileUrl: '', avatarUrl: '' }, timestamp: null, images: [] };

    // Instagram uses role="presentation" for post images, role="dialog" for modals
    const mainArticle = container.closest('article') || container.querySelector('article') || container;

    // Author from header area or aria-labeled links
    const headerEl = mainArticle.querySelector('header') || mainArticle;
    const authorLink = headerEl.querySelector(
        'a[href*="instagram.com/"]:not([href*="/p/"]):not([href*="/reel/"]):not([href*="/explore/"]):not([href*="/stories/"])'
    );
    if (authorLink) {
        data.author.name = authorLink.textContent?.trim() || authorLink.getAttribute('aria-label') || '';
        data.author.profileUrl = authorLink.href;
    }

    // Avatar — look in header for profile image
    const avatarImg = headerEl.querySelector('img[alt*="profile" i], img[draggable="false"][src*="scontent"], canvas + img');
    if (avatarImg) {
        data.author.avatarUrl = avatarImg.src || '';
    }

    // Caption text — Instagram marks user-generated text with dir="auto"
    const textBlocks = [];
    mainArticle.querySelectorAll('span[dir="auto"], div[dir="auto"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 &&
            !el.closest('[role="button"]') && !el.closest('button') &&
            !el.closest('[role="navigation"]') && !el.closest('nav')) {
            textBlocks.push({ text, length: text.length, el });
        }
    });
    textBlocks.sort((a, b) => b.length - a.length);
    data.text = textBlocks[0]?.text || '';

    // Images — Instagram CDN images, srcset parsing, role="img" backgrounds
    mainArticle.querySelectorAll('img[src*="scontent"], img[src*="cdninstagram"], img[src*="fbcdn"]').forEach(img => {
        const w = img.naturalWidth || img.width || 0;
        if (w === 0 || w > 50) {
            // Prefer highest-res srcset
            const srcset = img.getAttribute('srcset');
            if (srcset) {
                const srcsetParts = srcset.split(',').map(s => s.trim());
                const largest = srcsetParts.pop()?.split(' ')[0];
                if (largest && !data.images.includes(largest)) {
                    data.images.push(largest);
                    return;
                }
            }
            if (!img.src.includes('profile_pic') && !data.images.includes(img.src)) {
                data.images.push(img.src);
            }
        }
    });

    // Also check role="img" elements with background images
    mainArticle.querySelectorAll('[role="img"][style*="background-image"]').forEach(imgEl => {
        const style = imgEl.getAttribute('style') || '';
        const match = style.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !data.images.includes(match[1])) {
            data.images.push(match[1]);
        }
    });

    // Timestamp
    const timeEl = mainArticle.querySelector('time[datetime]');
    if (timeEl) {
        data.timestamp = timeEl.getAttribute('datetime');
    } else {
        // Look for time links
        const timeLink = mainArticle.querySelector('a[href*="/p/"] time, a time[datetime]');
        if (timeLink) {
            data.timestamp = timeLink.getAttribute('datetime');
        }
    }

    return data;
}

// --- Strategy 3: Text Pattern Analysis + Computed Styles ---

function extractViaPatterns(container) {
    const data = { text: '', author: { name: '', profileUrl: '', avatarUrl: '' }, timestamp: null, images: [] };

    // Identify author via computed style analysis
    const authorResult = identifyAuthorByStyle(container);
    if (authorResult) {
        data.author.name = authorResult.name;
        data.author.profileUrl = authorResult.profileUrl;
    }

    // Find avatar
    const avatarResult = identifyAvatarByStyle(container);
    if (avatarResult) {
        data.author.avatarUrl = avatarResult;
    }

    // Extract caption text by pattern analysis
    const textResult = identifyCaptionByPattern(container);
    data.text = textResult || '';

    // Images — Instagram CDN + srcset
    container.querySelectorAll('img[src*="scontent"], img[src*="cdninstagram"], img[src*="fbcdn"]').forEach(img => {
        const w = img.naturalWidth || img.width || 0;
        if (w === 0 || w > 50) {
            if (!img.src.includes('profile_pic') && !img.src.includes('emoji') && !img.src.includes('icon')) {
                const srcset = img.getAttribute('srcset');
                if (srcset) {
                    const srcsetParts = srcset.split(',').map(s => s.trim());
                    const largest = srcsetParts.pop()?.split(' ')[0];
                    if (largest && !data.images.includes(largest)) {
                        data.images.push(largest);
                        return;
                    }
                }
                if (!data.images.includes(img.src)) {
                    data.images.push(img.src);
                }
            }
        }
    });

    // Timestamp from time element or pattern
    const timeEl = container.querySelector('time[datetime]');
    if (timeEl) {
        data.timestamp = timeEl.getAttribute('datetime');
    } else {
        data.timestamp = identifyTimestampByPattern(container);
    }

    return data;
}

function identifyAuthorByStyle(container) {
    // Instagram author name: bold text, near top, linked to profile
    const headerEl = container.querySelector('header') || container;
    const links = headerEl.querySelectorAll('a[href]');

    for (const link of links) {
        try {
            const computed = window.getComputedStyle(link);
            const rect = link.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            const isBold = parseInt(computed.fontWeight) >= 600 || computed.fontWeight === 'bold';
            const isNearTop = rect.top - containerRect.top < 80;
            const isReasonableSize = rect.height > 10 && rect.height < 50;
            const isProfileLink = link.href.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) &&
                !link.href.includes('/p/') && !link.href.includes('/reel/') &&
                !link.href.includes('/explore/') && !link.href.includes('/stories/');

            if (isBold && isNearTop && isReasonableSize && isProfileLink) {
                const name = link.textContent?.trim();
                if (name && name.length > 1 && name.length < 100) {
                    return { name, profileUrl: link.href, element: link };
                }
            }
        } catch (e) {
            continue;
        }
    }

    // Fallback: any profile link near the top
    for (const link of links) {
        try {
            const rect = link.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const isNearTop = rect.top - containerRect.top < 80;
            const isProfileLink = link.href.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) &&
                !link.href.includes('/p/') && !link.href.includes('/reel/');

            if (isNearTop && isProfileLink) {
                const name = link.textContent?.trim();
                if (name && name.length > 1 && name.length < 100) {
                    return { name, profileUrl: link.href, element: link };
                }
            }
        } catch (e) {
            continue;
        }
    }

    return null;
}

function identifyAvatarByStyle(container) {
    // Avatar is typically a small circular image in the header area
    const headerEl = container.querySelector('header') || container;
    const imgs = headerEl.querySelectorAll('img[src], canvas + img');
    const containerRect = container.getBoundingClientRect();

    for (const img of imgs) {
        try {
            const rect = img.getBoundingClientRect();
            const isSmall = rect.width > 20 && rect.width < 80 && rect.height > 20 && rect.height < 80;
            const isNearTop = rect.top - containerRect.top < 80;

            if (isSmall && isNearTop && img.src) {
                // Check if it's circular (common for avatars)
                const parentEl = img.closest('div, span, a') || img;
                const computed = window.getComputedStyle(parentEl);
                const isCircular = computed.borderRadius === '50%' ||
                    computed.clipPath?.includes('circle') ||
                    parseInt(computed.borderRadius) > 15;

                if (isCircular || img.src.includes('scontent') || img.src.includes('profile')) {
                    return img.src;
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

function identifyCaptionByPattern(container) {
    // Instagram captions: text blocks below the image area, often with dir="auto"
    const candidates = [];

    container.querySelectorAll('div, span, p').forEach(el => {
        try {
            if (el.offsetHeight < 15 || el.offsetWidth < 80) return;
        } catch (e) {
            return;
        }

        // Skip UI elements
        if (el.closest('[role="button"]') || el.closest('button') ||
            el.closest('[role="navigation"]') || el.closest('nav') ||
            el.closest('[role="toolbar"]')) return;

        const text = el.textContent?.trim() || '';
        const containerText = container.textContent?.trim() || '';
        if (text.length < 10 || text.length > containerText.length * 0.9) return;

        let score = 0;
        if (el.getAttribute('dir') === 'auto') score += 3; // User content marker
        if (text.length > 30) score += 1;
        if (text.length > 100) score += 1;

        // Instagram captions often contain hashtags
        if (text.match(/#\w+/)) score += 1;
        // Instagram captions often contain @mentions
        if (text.match(/@\w+/)) score += 1;

        // Direct text ratio
        const directTextLength = Array.from(el.childNodes)
            .filter(n => n.nodeType === 3)
            .reduce((sum, n) => sum + (n.textContent?.trim().length || 0), 0);
        if (directTextLength > text.length * 0.3) score += 2;

        // Skip engagement counts
        if (text.match(/^\d+\s*(like|comment|view|share)s?$/i)) return;
        if (text.match(/^(like|comment|share|save|more)$/i)) return;

        candidates.push({ text, score, el });
    });

    candidates.sort((a, b) => b.score - a.score || b.text.length - a.text.length);
    return candidates[0]?.text || '';
}

function identifyTimestampByPattern(container) {
    // Look for short text nodes matching time patterns
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (!text || text.length > 50) continue;
        // Match relative times: "2h", "3m", "1d", "2 hours ago", "3 days ago"
        if (text.match(/^(\d+[hmd]|yesterday|just now|\d+\s+(hour|minute|day|week|month)s?\s+ago)$/i)) {
            return text;
        }
        // Match absolute dates
        if (text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i)) {
            return text;
        }
    }
    return null;
}

// --- Strategy 4: Raw text extraction (pre-existing logic) ---

function buildArticleFromRawText(container) {
    const postText = extractTextFromElement(container);
    const author = extractAuthorFromElement(container);
    const timestamp = extractTimestampFromElement(container);
    const images = extractImagesFromElement(container);
    const engagement = extractEngagementFromElement(container);

    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;
    const isReel = /\/reel\//.test(window.location.pathname);

    const contentHtml = buildInstagramStyledContent(postText, author, timestamp, images);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Instagram User',
        url: ogUrl,
        domain: 'instagram.com',
        siteName: 'Instagram',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: ogImage || images[0] || '',
        publicationIcon: 'https://www.instagram.com/favicon.ico',
        platform: 'instagram',
        contentType: isReel ? 'video' : 'social_post',
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

// --- Helper: Build article from extracted data (ARIA or pattern) ---

function buildArticleFromExtractedData(data, container) {
    const images = data.images && data.images.length > 0 ? data.images : extractImagesFromElement(container);
    const engagement = extractEngagementFromElement(container);
    const postText = data.text;
    const author = data.author || { name: '', profileUrl: null, avatarUrl: null };
    const timestamp = data.timestamp || extractTimestampFromElement(container);

    const ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;
    const isReel = /\/reel\//.test(window.location.pathname);
    const contentHtml = buildInstagramStyledContent(postText, author, timestamp, images);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Instagram User',
        url: ogUrl,
        domain: 'instagram.com',
        siteName: 'Instagram',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.instagram.com/favicon.ico',
        platform: 'instagram',
        contentType: isReel ? 'video' : 'social_post',
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

// --- OG tag fallback ---

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

// --- DOM extraction helpers (used by raw text fallback & shared utilities) ---

function extractTextFromElement(el) {
    const clone = el.cloneNode(true);
    // Remove elements that aren't post content
    clone.querySelectorAll('svg, [role="button"], [role="navigation"], [role="toolbar"], button, nav').forEach(x => x.remove());

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
    const avatarImg = el.querySelector('header img[src], img[alt*="profile" i], img[src*="profile"]');
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

    // Also check role="img" elements with background images
    el.querySelectorAll('[role="img"][style*="background-image"]').forEach(imgEl => {
        const style = imgEl.getAttribute('style') || '';
        const match = style.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !images.includes(match[1])) {
            images.push(match[1]);
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
