import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';
import { APIInterceptor } from '../api-interceptor.js';

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
        // Try API-cached comments first (structured data from GraphQL)
        const cachedComments = APIInterceptor.getCachedComments();
        if (cachedComments.length > 0) {
            return cachedComments.map(c => ({
                authorName: c.author || 'Facebook User',
                text: c.text,
                timestamp: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null,
                avatarUrl: c.authorAvatar || null,
                profileUrl: c.authorUrl || null,
                likes: c.likes || 0,
                platform: 'facebook',
                sourceUrl: articleUrl
            }));
        }

        // Fallback: Try to find comments in the current view DOM
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

// --- Safe timestamp parser (handles relative times like "2h", "Yesterday") ---

function parseTimestampToUnix(timestamp) {
    if (!timestamp) return Math.floor(Date.now() / 1000);
    // If already a number (unix seconds), use it
    if (typeof timestamp === 'number') {
        // Sanity check: if it looks like milliseconds (>year 2100 in seconds), convert
        return timestamp > 4102444800 ? Math.floor(timestamp / 1000) : timestamp;
    }
    // Try standard date parsing first
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
        return Math.floor(parsed.getTime() / 1000);
    }
    // Handle relative time strings
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
    // Fallback to current time
    return Math.floor(now / 1000);
}

// ============================================================
// Anti-obfuscation extraction strategies (cascading fallbacks)
// ============================================================

function extractFromContainer(container) {
    // Strategy 0: Use intercepted API data (most reliable, cleanest)
    const apiData = APIInterceptor.getBestPostData();
    if (apiData) {
        console.log('[NAC Facebook] Extracted via API interception');
        return buildArticleFromAPIData(apiData, container);
    }

    // Strategy 1: Try React fiber data (fastest, most data-rich)
    const fiberData = getReactFiberData(container);
    if (fiberData && (fiberData.text || fiberData.authorName)) {
        console.log('[NAC Facebook] Extracted via React fiber');
        return buildArticleFromFiberData(fiberData, container);
    }

    // Strategy 2: ARIA-based extraction (stable, accessibility-driven)
    const ariaData = extractViaARIA(container);
    if (ariaData.text && ariaData.text.length > 10) {
        console.log('[NAC Facebook] Extracted via ARIA attributes');
        return buildArticleFromExtractedData(ariaData, container);
    }

    // Strategy 3: Text pattern analysis + computed styles (class-independent)
    const patternData = extractViaPatterns(container);
    if (patternData.text && patternData.text.length > 10) {
        console.log('[NAC Facebook] Extracted via text patterns');
        return buildArticleFromExtractedData(patternData, container);
    }

    // Strategy 4: Raw text extraction (last resort, pre-existing logic)
    console.log('[NAC Facebook] Falling back to raw text extraction');
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

            // Facebook stores post data in various prop shapes
            if (props.post) return flattenPostData(props.post);
            if (props.story) return flattenPostData(props.story);
            if (props.feedUnit) return flattenPostData(props.feedUnit);
            if (props.__typename === 'Story' || props.__typename === 'Post') return flattenPostData(props);

            // Also check for data nested in `data` prop
            if (props.data?.post) return flattenPostData(props.data.post);
            if (props.data?.story) return flattenPostData(props.data.story);
            if (props.data?.node) return flattenPostData(props.data.node);

            fiber = fiber.return;
        }
    } catch (e) {
        console.log('[NAC Facebook] React fiber traversal failed:', e.message);
    }
    return null;
}

function flattenPostData(post) {
    // Normalize various Facebook post data shapes into a flat object
    return {
        text: post.message?.text || post.message || post.body?.text || post.comet_sections?.content?.story?.message?.text || '',
        authorName: post.author?.name || post.actor?.name || post.actors?.[0]?.name || post.owner?.name || '',
        authorId: post.author?.id || post.actor?.id || post.owner?.id || '',
        authorUrl: post.author?.url || post.actor?.url || post.owner?.url || '',
        authorAvatar: post.author?.profile_picture?.uri || post.actor?.profile_picture?.uri || '',
        timestamp: post.creation_time || post.created_time || post.timestamp || null,
        url: post.url || post.permalink || post.wwwURL || '',
        attachments: post.attachments || post.media || [],
    };
}

function buildArticleFromFiberData(fiberData, container) {
    const images = extractImagesFromElement(container);
    const engagement = extractEngagementFromElement(container);
    const postText = fiberData.text || extractTextFromElement(container);

    const author = {
        name: fiberData.authorName || '',
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

    const contentHtml = buildFacebookStyledContent(postText, author, timestamp, images, []);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Facebook User',
        url: fiberData.url || window.location.href,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.facebook.com/favicon.ico',
        platform: 'facebook',
        contentType: 'social_post',
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

// --- Strategy 2: ARIA / Accessibility Attributes ---

function extractViaARIA(container) {
    const data = { text: '', author: { name: '', profileUrl: '', avatarUrl: '' }, timestamp: null, images: [] };

    // Find articles within the container
    const articles = container.querySelectorAll('[role="article"]');
    const mainArticle = articles[0] || container;

    // Author from aria-label or linked text
    // Profile links are typically NOT /posts/ or /photos/ URLs
    const authorLink = mainArticle.querySelector(
        'a[role="link"][href*="facebook.com/"]:not([href*="/posts/"]):not([href*="/photos/"]):not([href*="/videos/"]):not([href*="/watch"])'
    );
    if (authorLink) {
        data.author.name = authorLink.textContent?.trim() || authorLink.getAttribute('aria-label') || '';
        data.author.profileUrl = authorLink.href;
    }

    // Avatar from nearby img with aria-label or role="img"
    const avatarImg = mainArticle.querySelector('svg image[href], img[alt*="profile"], [role="img"] image, image[preserveAspectRatio]');
    if (avatarImg) {
        data.author.avatarUrl = avatarImg.getAttribute('href') || avatarImg.getAttribute('xlink:href') || avatarImg.src || '';
    }

    // Text content - get the largest text block that isn't navigation/buttons
    const textBlocks = [];
    mainArticle.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(el => {
        const text = el.textContent?.trim();
        // Skip short fragments that are likely UI elements
        if (text && text.length > 10 && !el.closest('[role="button"]') && !el.closest('[role="navigation"]') && !el.closest('[role="toolbar"]')) {
            textBlocks.push({ text, length: text.length, el });
        }
    });
    // Take the longest text block as the post content
    textBlocks.sort((a, b) => b.length - a.length);
    data.text = textBlocks[0]?.text || '';

    // Images — Facebook CDN images
    mainArticle.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]').forEach(img => {
        const w = img.naturalWidth || img.width || 0;
        if (w === 0 || w > 50) {
            data.images.push(img.src);
        }
    });

    // Timestamp from abbr, time elements, or data-testid
    const timeEl = mainArticle.querySelector('abbr[data-utime], time[datetime], [data-testid*="timestamp"], a[href*="/posts/"] span');
    if (timeEl) {
        data.timestamp = timeEl.getAttribute('data-utime')
            ? new Date(parseInt(timeEl.getAttribute('data-utime')) * 1000).toISOString()
            : timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || null;
    }

    return data;
}

// --- Strategy 3: Text Pattern Analysis + Computed Styles ---

function extractViaPatterns(container) {
    const data = { text: '', author: { name: '', profileUrl: '', avatarUrl: '' }, timestamp: null, images: [] };

    // Identify author via computed style analysis (bold, near top, profile link)
    const authorResult = identifyAuthorByStyle(container);
    if (authorResult) {
        data.author.name = authorResult.name;
        data.author.profileUrl = authorResult.profileUrl;
    }

    // Find avatar — small circular image near the top
    const avatarResult = identifyAvatarByStyle(container);
    if (avatarResult) {
        data.author.avatarUrl = avatarResult;
    }

    // Extract main post text by finding the largest text block that looks like content
    const textResult = identifyPostTextByPattern(container);
    data.text = textResult || '';

    // Images — any large CDN image
    container.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]').forEach(img => {
        const w = img.naturalWidth || img.width || 0;
        if (w === 0 || w > 50) {
            if (!img.src.includes('emoji') && !img.src.includes('icon')) {
                data.images.push(img.src);
            }
        }
    });

    // Timestamp — look for relative time patterns in short text nodes
    const timestampResult = identifyTimestampByPattern(container);
    data.timestamp = timestampResult;

    return data;
}

function identifyAuthorByStyle(container) {
    // The author name is typically: bold text, larger than surrounding text,
    // near the top of the post, linked to a profile
    const links = container.querySelectorAll('a[href]');

    for (const link of links) {
        try {
            const computed = window.getComputedStyle(link);
            const rect = link.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Author link: bold, near top, reasonable size, linked to profile
            const isBold = parseInt(computed.fontWeight) >= 600 || computed.fontWeight === 'bold';
            const isNearTop = rect.top - containerRect.top < 100;
            const isReasonableSize = rect.height > 10 && rect.height < 50;
            const isProfileLink = link.href.match(/facebook\.com\/[a-zA-Z0-9.]+(\/?|\?[^/]*)$/) &&
                !link.href.includes('/posts/') && !link.href.includes('/photos/') &&
                !link.href.includes('/videos/') && !link.href.includes('/watch');

            if (isBold && isNearTop && isReasonableSize && isProfileLink) {
                const name = link.textContent?.trim();
                if (name && name.length > 1 && name.length < 100) {
                    return { name, profileUrl: link.href, element: link };
                }
            }
        } catch (e) {
            // getComputedStyle can throw in some edge cases
            continue;
        }
    }
    return null;
}

function identifyAvatarByStyle(container) {
    // Avatar is typically a small circular image near the top-left of the post
    const imgs = container.querySelectorAll('img[src], svg image[href], image[preserveAspectRatio]');
    const containerRect = container.getBoundingClientRect();

    for (const img of imgs) {
        try {
            const rect = img.getBoundingClientRect();
            const isSmall = rect.width > 20 && rect.width < 80 && rect.height > 20 && rect.height < 80;
            const isNearTop = rect.top - containerRect.top < 80;
            const isNearLeft = rect.left - containerRect.left < 80;
            const src = img.src || img.getAttribute('href') || img.getAttribute('xlink:href') || '';

            if (isSmall && isNearTop && isNearLeft && src) {
                // Check if it's circular (border-radius or clip-path)
                const computed = window.getComputedStyle(img.closest('div, span, a') || img);
                const isCircular = computed.borderRadius === '50%' ||
                    computed.clipPath?.includes('circle') ||
                    parseInt(computed.borderRadius) > 15;

                if (isCircular || src.includes('scontent') || src.includes('profile')) {
                    return src;
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

function identifyPostTextByPattern(container) {
    // Walk all text-containing elements and score them by "post-content-ness"
    const candidates = [];

    container.querySelectorAll('div, span, p').forEach(el => {
        // Skip invisible or tiny elements
        try {
            if (el.offsetHeight < 20 || el.offsetWidth < 100) return;
        } catch (e) {
            return;
        }

        // Skip UI elements
        if (el.closest('[role="button"]') || el.closest('[role="navigation"]') ||
            el.closest('[role="toolbar"]') || el.closest('nav')) return;

        const text = el.textContent?.trim() || '';
        // Must have substantial text, but not the entire container text (which includes UI)
        const containerText = container.textContent?.trim() || '';
        if (text.length < 15 || text.length > containerText.length * 0.9) return;

        // Score based on being a primary content element
        let score = 0;
        if (el.getAttribute('dir') === 'auto') score += 3; // Facebook marks user content with dir="auto"
        if (el.getAttribute('data-ad-preview') !== null) score -= 5; // Ad content
        if (text.length > 30) score += 1;
        if (text.length > 100) score += 1;

        // Direct text ratio: how much of the text is direct children vs nested
        const directTextLength = Array.from(el.childNodes)
            .filter(n => n.nodeType === 3)
            .reduce((sum, n) => sum + (n.textContent?.trim().length || 0), 0);
        if (directTextLength > text.length * 0.3) score += 2;

        // Not a timestamp or engagement count
        if (text.match(/^\d+[hm]$|^yesterday$/i)) return;
        if (text.match(/^\d+\s*(like|comment|share|view)s?$/i)) return;

        candidates.push({ text, score, el });
    });

    // Return highest-scoring text
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
        // Match relative times: "2h", "3m", "1d", "Yesterday", "Just now", "2 hours ago"
        if (text.match(/^(\d+[hmd]|yesterday|just now|\d+\s+(hour|minute|day|week|month)s?\s+ago)$/i)) {
            return text;
        }
        // Match absolute dates: "March 15", "Mar 15, 2024"
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
    const links = extractLinksFromElement(container);
    const engagement = extractEngagementFromElement(container);

    const contentHtml = buildFacebookStyledContent(postText, author, timestamp, images, links);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Facebook User',
        url: window.location.href,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.facebook.com/favicon.ico',
        platform: 'facebook',
        contentType: 'social_post',
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

// --- Helper: Build article from extracted data (ARIA or pattern) ---

function buildArticleFromExtractedData(data, container) {
    const images = data.images && data.images.length > 0 ? data.images : extractImagesFromElement(container);
    const engagement = extractEngagementFromElement(container);
    const links = extractLinksFromElement(container);
    const postText = data.text;
    const author = data.author || { name: '', profileUrl: null, avatarUrl: null };
    const timestamp = data.timestamp || extractTimestampFromElement(container);

    const contentHtml = buildFacebookStyledContent(postText, author, timestamp, images, links);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Facebook User',
        url: window.location.href,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: parseTimestampToUnix(timestamp),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.facebook.com/favicon.ico',
        platform: 'facebook',
        contentType: 'social_post',
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

// --- OG tag fallback (Strategy 4 final) ---

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

// --- DOM extraction helpers (used by raw text fallback & shared utilities) ---

function extractTextFromElement(el) {
    // Get text content but skip navigation, buttons, timestamps
    const clone = el.cloneNode(true);
    // Remove elements that aren't post content
    clone.querySelectorAll('svg, [role="button"], [role="navigation"], [role="toolbar"], [data-testid="like_button"], [data-testid="comment_button"], [data-testid="share_button"]').forEach(x => x.remove());

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

    // Also check for background images in role="img" elements
    el.querySelectorAll('[role="img"][style*="background-image"]').forEach(imgEl => {
        const style = imgEl.getAttribute('style') || '';
        const match = style.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && (match[1].includes('scontent') || match[1].includes('fbcdn'))) {
            images.push(match[1]);
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

// --- Strategy 0: Build article from API-intercepted data ---

function buildArticleFromAPIData(data, container) {
    const postText = data.message || '';
    const author = {
        name: data.author || '',
        profileUrl: data.authorUrl || null,
        avatarUrl: data.authorAvatar || null
    };
    const timestamp = data.timestamp ? new Date(data.timestamp * 1000).toISOString() : null;
    const images = data.images || [];

    const contentHtml = buildFacebookStyledContent(postText, author, timestamp, images, []);

    const title = author.name
        ? `${author.name}: "${postText.substring(0, 60)}${postText.length > 60 ? '...' : ''}"`
        : postText.substring(0, 80);

    return {
        title,
        byline: author.name || 'Facebook User',
        url: data.url || window.location.href,
        domain: 'facebook.com',
        siteName: 'Facebook',
        publishedAt: data.timestamp || Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: postText,
        excerpt: postText.substring(0, 200),
        featuredImage: images[0] || document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://www.facebook.com/favicon.ico',
        platform: 'facebook',
        contentType: 'social_post',
        platformAccount: {
            username: author.name || 'Unknown',
            profileUrl: author.profileUrl || null,
            avatarUrl: author.avatarUrl || null,
            platform: 'facebook'
        },
        engagement: data.engagement || { likes: 0, comments: 0, shares: 0, views: 0 },
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

// Register
PlatformHandler.register('facebook', FacebookHandler);
export { FacebookHandler };
