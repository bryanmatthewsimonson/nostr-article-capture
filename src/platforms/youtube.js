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
    // Most reliable: og:title meta tag (always present, always the video title)
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle) return ogTitle;

    // Fallback to various DOM locations (YouTube's DOM changes frequently)
    return document.querySelector(
        'h1.ytd-watch-metadata yt-formatted-string, ' +
        'h1.title yt-formatted-string, ' +
        '#title h1 yt-formatted-string, ' +
        'h1[class*="title"], ' +
        '#info-contents h1'
    )?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();
}

function extractChannelName() {
    // Channel name is separate from video title — target channel-specific elements
    return document.querySelector(
        'ytd-channel-name yt-formatted-string a, ' +
        '#channel-name a, ' +
        '#owner #channel-name a, ' +
        'a.yt-simple-endpoint[href*="/@"]'
    )?.textContent?.trim() ||
    document.querySelector('link[itemprop="name"]')?.content || '';
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
    // Method 1: Try ytInitialPlayerResponse global variable (most reliable)
    try {
        // YouTube stores this as a global — use unsafeWindow for Tampermonkey access
        const playerResponse = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window)?.ytInitialPlayerResponse ||
                              window.ytInitialPlayerResponse;

        if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
            // Prefer English, fallback to first track
            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
            if (track?.baseUrl) {
                const response = await fetch(track.baseUrl + '&fmt=json3');
                const json = await response.json();
                if (json.events) {
                    return json.events
                        .filter(e => e.segs)
                        .map(e => {
                            const ms = e.tStartMs || 0;
                            const mins = Math.floor(ms / 60000);
                            const secs = Math.floor((ms % 60000) / 1000);
                            const text = e.segs.map(s => s.utf8).join('');
                            return `[${mins}:${String(secs).padStart(2, '0')}] ${text.trim()}`;
                        })
                        .filter(line => line.match(/\] .+/))
                        .join('\n');
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Method 1 transcript failed:', e.message);
    }

    // Method 2: Try parsing captionTracks from script tags (legacy / fallback)
    try {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const text = script.textContent;
            if (text.includes('"captionTracks"')) {
                const match = text.match(/"captionTracks":\s*(\[.*?\])/s);
                if (match) {
                    const tracks = JSON.parse(match[1]);
                    const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                    if (track?.baseUrl) {
                        // Fetch XML transcript
                        const resp = await fetch(track.baseUrl);
                        const xml = await resp.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xml, 'text/xml');
                        return Array.from(doc.querySelectorAll('text'))
                            .map(node => {
                                const start = parseFloat(node.getAttribute('start') || '0');
                                const m = Math.floor(start / 60);
                                const s = Math.floor(start % 60);
                                return `[${m}:${String(s).padStart(2, '0')}] ${node.textContent.trim()}`;
                            })
                            .filter(l => l.match(/\] .+/))
                            .join('\n');
                    }
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Method 2 transcript failed:', e.message);
    }

    // Method 3: Check if transcript panel is already open in the DOM
    const segments = document.querySelectorAll(
        'ytd-transcript-segment-renderer .segment-text, ' +
        '[class*="transcript"] [class*="segment-text"]'
    );
    if (segments.length > 0) {
        return Array.from(segments).map((seg, i) => {
            const timeEl = seg.previousElementSibling || seg.closest('[class*="segment"]')?.querySelector('[class*="timestamp"]');
            const time = timeEl?.textContent?.trim() || `${Math.floor(i * 5 / 60)}:${String((i * 5) % 60).padStart(2, '0')}`;
            return `[${time}] ${seg.textContent.trim()}`;
        }).join('\n');
    }

    console.log('[NAC YouTube] No transcript available');
    return null;
}

function buildVideoContent() {
    const meta = extractVideoMeta();
    const desc = extractDescription();
    const thumbnail = extractThumbnail();

    let html = '';

    // Embed the actual video player via iframe
    if (meta.videoId) {
        html += `<div class="nac-video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:1em 0;">
            <iframe src="https://www.youtube.com/embed/${meta.videoId}"
                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
                    allowfullscreen loading="lazy"></iframe>
        </div>`;
    } else if (thumbnail) {
        html += `<figure><img src="${thumbnail}" alt="Video thumbnail"></figure>`;
    }

    // Video metadata
    html += '<div class="nac-video-meta">';
    const channel = extractChannelName();
    if (channel) html += `<p><strong>Channel:</strong> ${channel}</p>`;
    if (meta.duration) html += `<p><strong>Duration:</strong> ${meta.duration}</p>`;
    if (meta.isLive) html += `<p>🔴 <strong>Live Stream</strong></p>`;
    html += '</div>';

    // Description
    if (desc) {
        html += `<div class="nac-video-description">
            <h3>Description</h3>
            ${desc.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('')}
        </div>`;
    }

    return html;
}

function buildTextContent() {
    return `${extractVideoTitle()}\n\nChannel: ${extractChannelName()}\n\n${extractDescription()}`;
}

// Register
PlatformHandler.register('youtube', YouTubeHandler);

export { YouTubeHandler, extractTranscript as youtubeExtractTranscript };
