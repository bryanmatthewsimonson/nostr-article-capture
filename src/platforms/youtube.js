import { PlatformHandler } from '../platform-handler.js';

const YouTubeHandler = {
    type: 'video',
    platform: 'youtube',

    canCapture: () => {
        const hostname = window.location.hostname;
        return hostname.includes('youtube.com') || hostname.includes('youtu.be');
    },

    extract: async () => {
        const article = {
            title: extractVideoTitle(),
            byline: extractChannelName(),
            url: getCanonicalVideoUrl(),
            domain: 'youtube.com',
            siteName: 'YouTube',
            publishedAt: extractPublishDate(),
            content: buildVideoContent(),       // HTML representation
            textContent: buildTextContent(),     // Plain text
            excerpt: extractDescription().substring(0, 200),
            featuredImage: extractThumbnail(),
            publicationIcon: 'https://www.youtube.com/favicon.ico',

            // YouTube-specific
            platform: 'youtube',
            contentType: 'video',
            videoMeta: extractVideoMeta(),
            transcript: await extractTranscript(),
            engagement: extractEngagement(),

            // Standard metadata fields
            wordCount: 0,  // Will be set from transcript
            readingTimeMinutes: 0,
            structuredData: extractStructuredData(),
            keywords: extractKeywords(),
            language: document.documentElement.lang || 'en',
            isPaywalled: false,
            section: null,
            dateModified: null
        };

        // Word count from transcript if available
        if (article.transcript) {
            article.wordCount = article.transcript.split(/\s+/).filter(w => w).length;
            article.readingTimeMinutes = Math.ceil(article.wordCount / 225);
        }

        return article;
    },

    extractComments: async (articleUrl) => {
        // YouTube comments are in #comments section
        const commentElements = document.querySelectorAll(
            'ytd-comment-thread-renderer, ytd-comment-renderer'
        );

        const comments = [];
        for (const el of commentElements) {
            const authorEl = el.querySelector('#author-text, .ytd-comment-renderer #author-text');
            const textEl = el.querySelector('#content-text, .ytd-comment-renderer #content-text');
            const timeEl = el.querySelector('#published-time-text a, .published-time-text');
            const avatarEl = el.querySelector('#author-thumbnail img, #img');
            const likesEl = el.querySelector('#vote-count-middle');

            const text = textEl?.textContent?.trim() || '';
            if (!text) continue;

            comments.push({
                authorName: authorEl?.textContent?.trim() || 'Anonymous',
                text,
                timestamp: timeEl?.textContent?.trim() || null,
                avatarUrl: avatarEl?.src || null,
                profileUrl: authorEl?.closest('a')?.href || null,
                likes: parseInt(likesEl?.textContent?.trim()) || 0,
                platform: 'youtube',
                sourceUrl: articleUrl
            });
        }

        return comments;
    },

    getReaderViewConfig: () => ({
        showEditor: false,     // Can't edit video
        showEntityBar: true,
        showClaimsBar: true,
        showComments: true,
        platformLabel: '▶️ YouTube Video'
    })
};

// --- Private extraction functions ---

function extractVideoTitle() {
    return document.querySelector('h1.ytd-watch-metadata yt-formatted-string, meta[name="title"]')?.textContent?.trim() ||
           document.querySelector('meta[property="og:title"]')?.content ||
           document.title.replace(' - YouTube', '');
}

function extractChannelName() {
    return document.querySelector('#channel-name a, ytd-channel-name a, [itemprop="author"] [itemprop="name"]')?.textContent?.trim() ||
           document.querySelector('meta[itemprop="name"]')?.content || '';
}

function getCanonicalVideoUrl() {
    const videoId = new URLSearchParams(window.location.search).get('v') ||
                    window.location.pathname.split('/').pop();
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : window.location.href;
}

function extractPublishDate() {
    const dateEl = document.querySelector('#info-strings yt-formatted-string, [itemprop="datePublished"]');
    const dateStr = dateEl?.getAttribute('content') || dateEl?.textContent?.trim();
    if (dateStr) {
        const parsed = Date.parse(dateStr);
        if (!isNaN(parsed)) return Math.floor(parsed / 1000);
    }
    return Math.floor(Date.now() / 1000);
}

function extractDescription() {
    // YouTube description is in the expandable section
    const descEl = document.querySelector(
        '#description-inline-expander yt-attributed-string, ' +
        '#description yt-formatted-string, ' +
        'meta[property="og:description"], ' +
        'meta[name="description"]'
    );
    return descEl?.textContent?.trim() || descEl?.content || '';
}

function extractThumbnail() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId) return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    return document.querySelector('meta[property="og:image"]')?.content || '';
}

function extractVideoMeta() {
    const videoId = new URLSearchParams(window.location.search).get('v') || '';

    return {
        videoId,
        channelUrl: document.querySelector('#channel-name a, ytd-channel-name a')?.href || '',
        channelId: document.querySelector('[itemprop="channelId"]')?.content || '',
        duration: document.querySelector('[itemprop="duration"]')?.content ||
                  document.querySelector('.ytp-time-duration')?.textContent || '',
        isLive: !!document.querySelector('.ytp-live-badge-text, .ytp-live'),
        hasChat: !!document.querySelector('#chat-container, iframe[src*="live_chat"]'),
        category: document.querySelector('[itemprop="genre"]')?.content || '',
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    };
}

function extractEngagement() {
    const viewsEl = document.querySelector('#info #count .ytd-video-primary-info-renderer, [itemprop="interactionCount"]');
    const likesEl = document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer:first-child #text, like-button-view-model button .yt-spec-button-shape-next__button-text-content');

    let views = 0;
    const viewsText = viewsEl?.textContent?.trim() || viewsEl?.content || '';
    const viewsMatch = viewsText.replace(/,/g, '').match(/(\d+)/);
    if (viewsMatch) views = parseInt(viewsMatch[1]);

    let likes = 0;
    const likesText = likesEl?.textContent?.trim() || '';
    // YouTube abbreviates: "1.2K", "3.4M"
    if (likesText) {
        if (likesText.includes('K')) likes = Math.round(parseFloat(likesText) * 1000);
        else if (likesText.includes('M')) likes = Math.round(parseFloat(likesText) * 1000000);
        else likes = parseInt(likesText.replace(/,/g, '')) || 0;
    }

    const subscriberEl = document.querySelector('#owner-sub-count, #subscriber-count');
    let subscribers = subscriberEl?.textContent?.trim() || '';

    return { views, likes, shares: 0, comments: 0, subscribers };
}

function extractKeywords() {
    const kwMeta = document.querySelector('meta[name="keywords"]');
    if (kwMeta?.content) return kwMeta.content.split(',').map(k => k.trim()).filter(k => k);
    return [];
}

function extractStructuredData() {
    const data = { type: 'VideoObject' };
    try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            const json = JSON.parse(script.textContent);
            if (json['@type'] === 'VideoObject' || json['@graph']?.find(i => i['@type'] === 'VideoObject')) {
                const video = json['@type'] === 'VideoObject' ? json : json['@graph'].find(i => i['@type'] === 'VideoObject');
                data.description = video.description;
                data.uploadDate = video.uploadDate;
                data.duration = video.duration;
                break;
            }
        }
    } catch(e) { /* ignore parse errors */ }
    return data;
}

async function extractTranscript() {
    // Method 1: Check if YouTube has transcript panel open in the DOM
    const transcriptSegments = document.querySelectorAll(
        'ytd-transcript-segment-renderer, ' +
        'ytd-transcript-body-renderer .segment, ' +
        '.ytd-transcript-segment-renderer'
    );

    if (transcriptSegments.length > 0) {
        const segments = [];
        transcriptSegments.forEach(seg => {
            const timeEl = seg.querySelector('.segment-timestamp, [class*="timestamp"]');
            const textEl = seg.querySelector('.segment-text, [class*="text"]');
            const time = timeEl?.textContent?.trim() || '';
            const text = textEl?.textContent?.trim() || '';
            if (text) segments.push(`[${time}] ${text}`);
        });
        return segments.join('\n');
    }

    // Method 2: Try to get transcript via YouTube's internal data
    // YouTube stores video data in ytInitialPlayerResponse
    try {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const text = script.textContent;
            if (text.includes('captionTracks')) {
                const match = text.match(/"captionTracks":\s*(\[.*?\])/);
                if (match) {
                    const tracks = JSON.parse(match[1]);
                    if (tracks.length > 0) {
                        // Prefer English, fallback to first track
                        const englishTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
                        if (englishTrack?.baseUrl) {
                            // Fetch the transcript XML
                            const response = await fetch(englishTrack.baseUrl);
                            const xml = await response.text();
                            // Parse XML transcript
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(xml, 'text/xml');
                            const textNodes = doc.querySelectorAll('text');
                            const lines = [];
                            textNodes.forEach(node => {
                                const start = parseFloat(node.getAttribute('start') || '0');
                                const minutes = Math.floor(start / 60);
                                const seconds = Math.floor(start % 60);
                                const timestamp = `${minutes}:${String(seconds).padStart(2, '0')}`;
                                const decoded = node.textContent
                                    .replace(/&#39;/g, "'")
                                    .replace(/&amp;/g, '&')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>');
                                if (decoded.trim()) lines.push(`[${timestamp}] ${decoded.trim()}`);
                            });
                            return lines.join('\n');
                        }
                    }
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Transcript extraction failed:', e.message);
    }

    return null; // No transcript available
}

function buildVideoContent() {
    const desc = extractDescription();
    const meta = extractVideoMeta();
    const thumbnail = extractThumbnail();

    let html = '';
    if (thumbnail) {
        html += `<figure><img src="${thumbnail}" alt="Video thumbnail"><figcaption>${extractVideoTitle()}</figcaption></figure>`;
    }
    html += `<p><strong>Channel:</strong> ${extractChannelName()}</p>`;
    if (meta.duration) html += `<p><strong>Duration:</strong> ${meta.duration}</p>`;
    if (meta.isLive) html += `<p><strong>🔴 Live Stream</strong></p>`;
    if (desc) html += `<div class="video-description"><h3>Description</h3>${desc.split('\n').map(l => `<p>${l}</p>`).join('')}</div>`;

    return html;
}

function buildTextContent() {
    return `${extractVideoTitle()}\n\nChannel: ${extractChannelName()}\n\n${extractDescription()}`;
}

// Register
PlatformHandler.register('youtube', YouTubeHandler);

export { YouTubeHandler };
