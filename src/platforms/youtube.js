import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const YouTubeHandler = {
    type: 'video',
    platform: 'youtube',

    canCapture: () => {
        const hostname = window.location.hostname;
        return hostname.includes('youtube.com') || hostname.includes('youtu.be');
    },

    extract: async () => {
        try {
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
                platformAccount: extractPlatformAccount(),

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
        } catch (e) {
            console.error('[NAC YouTube] extract() failed:', e);
            return null;
        }
    },

    extractComments: async (articleUrl) => {
        try {
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
        } catch (e) {
            console.error('[NAC YouTube] extractComments() failed:', e);
            return [];
        }
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

function extractPlatformAccount() {
    const channelName = extractChannelName();
    const channelUrl = document.querySelector('#channel-name a, ytd-channel-name a')?.href || '';
    const channelId = document.querySelector('[itemprop="channelId"]')?.content || '';
    const channelHandle = document.querySelector('a[href*="/@"]')?.href?.match(/@([^/]+)/)?.[1] || '';
    const channelAvatarUrl = document.querySelector('#owner img, ytd-channel-name img, #channel-thumbnail img')?.src || '';

    return {
        username: channelName,
        handle: channelHandle || channelName,
        profileUrl: channelUrl,
        avatarUrl: channelAvatarUrl,
        platform: 'youtube',
        channelId: channelId
    };
}

async function extractTranscript() {
    console.log('[NAC YouTube] Attempting transcript extraction...');

    // Method 1: Access player response from multiple sources
    try {
        let playerResponse = null;

        // Try unsafeWindow first (Tampermonkey context)
        if (typeof unsafeWindow !== 'undefined') {
            playerResponse = unsafeWindow.ytInitialPlayerResponse;
            if (!playerResponse) {
                // Try getting it from the player element
                const player = unsafeWindow.document.querySelector('#movie_player');
                if (player && player.getPlayerResponse) {
                    playerResponse = player.getPlayerResponse();
                }
            }
        }

        // Try window context
        if (!playerResponse) {
            playerResponse = window.ytInitialPlayerResponse;
        }

        if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
            console.log('[NAC YouTube] Found', tracks.length, 'caption tracks');

            // Prefer English, then any auto-generated, then first
            const track = tracks.find(t => t.languageCode === 'en' && !t.kind) ||
                         tracks.find(t => t.languageCode === 'en') ||
                         tracks.find(t => !t.kind) ||
                         tracks[0];

            if (track?.baseUrl) {
                console.log('[NAC YouTube] Fetching transcript from:', track.name?.simpleText || track.languageCode);

                // Try JSON format first (more reliable)
                try {
                    const jsonResp = await fetch(track.baseUrl + '&fmt=json3');
                    if (jsonResp.ok) {
                        const json = await jsonResp.json();
                        if (json.events) {
                            const lines = json.events
                                .filter(e => e.segs && e.segs.some(s => s.utf8?.trim()))
                                .map(e => {
                                    const ms = e.tStartMs || 0;
                                    const m = Math.floor(ms / 60000);
                                    const s = Math.floor((ms % 60000) / 1000);
                                    const text = e.segs.map(seg => seg.utf8 || '').join('').trim();
                                    return `[${m}:${String(s).padStart(2, '0')}] ${text}`;
                                })
                                .filter(l => l.match(/\] .+/));

                            if (lines.length > 0) {
                                console.log('[NAC YouTube] Got transcript:', lines.length, 'lines');
                                return lines.join('\n');
                            }
                        }
                    }
                } catch(jsonErr) {
                    console.log('[NAC YouTube] JSON transcript failed, trying XML:', jsonErr.message);
                }

                // Fallback to XML format
                try {
                    const xmlResp = await fetch(track.baseUrl);
                    if (xmlResp.ok) {
                        const xml = await xmlResp.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xml, 'text/xml');
                        const lines = Array.from(doc.querySelectorAll('text'))
                            .map(node => {
                                const start = parseFloat(node.getAttribute('start') || '0');
                                const m = Math.floor(start / 60);
                                const s = Math.floor(start % 60);
                                const text = node.textContent
                                    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
                                    .replace(/&quot;/g, '"').replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>').trim();
                                return `[${m}:${String(s).padStart(2, '0')}] ${text}`;
                            })
                            .filter(l => l.match(/\] .+/));

                        if (lines.length > 0) {
                            console.log('[NAC YouTube] Got XML transcript:', lines.length, 'lines');
                            return lines.join('\n');
                        }
                    }
                } catch(xmlErr) {
                    console.log('[NAC YouTube] XML transcript also failed:', xmlErr.message);
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Method 1 failed:', e.message);
    }

    // Method 2: Parse from page source
    try {
        const pageSource = document.documentElement.innerHTML;
        const captionMatch = pageSource.match(/"captionTracks"\s*:\s*(\[.*?\])/s);
        if (captionMatch) {
            const tracks = JSON.parse(captionMatch[1]);
            console.log('[NAC YouTube] Found', tracks.length, 'tracks from page source');
            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
            if (track?.baseUrl) {
                const resp = await fetch(track.baseUrl);
                if (resp.ok) {
                    const xml = await resp.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(xml, 'text/xml');
                    const lines = Array.from(doc.querySelectorAll('text'))
                        .map(node => {
                            const start = parseFloat(node.getAttribute('start') || '0');
                            const m = Math.floor(start / 60);
                            const s = Math.floor(start % 60);
                            return `[${m}:${String(s).padStart(2, '0')}] ${node.textContent.trim()}`;
                        })
                        .filter(l => l.match(/\] .+/));
                    if (lines.length > 0) return lines.join('\n');
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Method 2 failed:', e.message);
    }

    // Method 3: GM_xmlhttpRequest for CORS bypass
    // Tampermonkey's GM_xmlhttpRequest bypasses CORS restrictions
    try {
        const pageSource = document.documentElement.innerHTML;
        const captionMatch = pageSource.match(/"captionTracks"\s*:\s*(\[.*?\])/s);
        if (captionMatch && typeof GM_xmlhttpRequest !== 'undefined') {
            const tracks = JSON.parse(captionMatch[1]);
            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
            if (track?.baseUrl) {
                console.log('[NAC YouTube] Trying GM_xmlhttpRequest for transcript...');
                const xml = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: track.baseUrl,
                        onload: (resp) => resolve(resp.responseText),
                        onerror: (err) => reject(new Error('GM_xmlhttpRequest failed'))
                    });
                });
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, 'text/xml');
                const lines = Array.from(doc.querySelectorAll('text'))
                    .map(node => {
                        const start = parseFloat(node.getAttribute('start') || '0');
                        const m = Math.floor(start / 60);
                        const s = Math.floor(start % 60);
                        return `[${m}:${String(s).padStart(2, '0')}] ${node.textContent.trim()}`;
                    })
                    .filter(l => l.match(/\] .+/));
                if (lines.length > 0) {
                    console.log('[NAC YouTube] Got transcript via GM_xmlhttpRequest:', lines.length, 'lines');
                    return lines.join('\n');
                }
            }
        }
    } catch(e) {
        console.log('[NAC YouTube] Method 3 (GM_xmlhttpRequest) failed:', e.message);
    }

    // Method 4: Check if transcript panel is already open in the DOM
    const segments = document.querySelectorAll(
        'ytd-transcript-segment-renderer .segment-text, ' +
        '[class*="transcript"] [class*="segment-text"]'
    );
    if (segments.length > 0) {
        console.log('[NAC YouTube] Found transcript segments in DOM:', segments.length);
        return Array.from(segments).map((seg, i) => {
            const timeEl = seg.previousElementSibling || seg.closest('[class*="segment"]')?.querySelector('[class*="timestamp"]');
            const time = timeEl?.textContent?.trim() || `${Math.floor(i * 5 / 60)}:${String((i * 5) % 60).padStart(2, '0')}`;
            return `[${time}] ${seg.textContent.trim()}`;
        }).join('\n');
    }

    console.log('[NAC YouTube] No transcript available after all methods');
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
    if (channel) html += `<p><strong>Channel:</strong> ${Utils.escapeHtml(channel)}</p>`;
    if (meta.duration) html += `<p><strong>Duration:</strong> ${Utils.escapeHtml(meta.duration)}</p>`;
    if (meta.isLive) html += `<p>🔴 <strong>Live Stream</strong></p>`;
    html += '</div>';

    // Description
    if (desc) {
        html += `<div class="nac-video-description">
            <h3>Description</h3>
            ${desc.split('\n').filter(l => l.trim()).map(l => `<p>${Utils.escapeHtml(l)}</p>`).join('')}
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
