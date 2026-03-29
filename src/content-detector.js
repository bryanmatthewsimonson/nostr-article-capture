export const ContentDetector = {
    /**
     * Analyze current page and return content type info
     * @returns {{ type: string, platform: string|null, confidence: number, metadata: object }}
     */
    detect: () => {
        const url = window.location.href;
        const hostname = window.location.hostname;

        // Platform detection by hostname
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return { type: 'video', platform: 'youtube', confidence: 1.0, metadata: detectYouTube() };
        }
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return { type: 'social_post', platform: 'twitter', confidence: 1.0, metadata: detectTwitter() };
        }
        if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
            return { type: 'social_post', platform: 'facebook', confidence: 1.0, metadata: detectFacebook() };
        }
        if (hostname.includes('instagram.com')) {
            return { type: 'social_post', platform: 'instagram', confidence: 1.0, metadata: detectInstagram() };
        }
        if (hostname.includes('tiktok.com')) {
            return { type: 'video', platform: 'tiktok', confidence: 1.0, metadata: detectTikTok() };
        }
        if (hostname.includes('substack.com') || isSubstack()) {
            return { type: 'article', platform: 'substack', confidence: 0.9, metadata: {} };
        }
        if (hostname.includes('reddit.com')) {
            return { type: 'social_post', platform: 'reddit', confidence: 1.0, metadata: {} };
        }

        // Generic content detection
        if (hasArticleContent()) {
            return { type: 'article', platform: null, confidence: 0.8, metadata: {} };
        }

        return { type: 'unknown', platform: null, confidence: 0.0, metadata: {} };
    },

    /**
     * Check if the page has comments that can be captured
     */
    hasComments: () => {
        return !!(
            document.querySelector('[class*="comment"], [id*="comment"], [data-component="comments"]') ||
            document.querySelector('section.comments, .comments-section, #comments') ||
            document.querySelector('[class*="disqus"], #disqus_thread')
        );
    },

    /**
     * Get the content type label for display
     */
    getTypeLabel: (type) => {
        const labels = {
            'article': '📰 Article',
            'video': '🎬 Video',
            'social_post': '💬 Social Post',
            'audio': '🎧 Audio',
            'unknown': '📄 Page'
        };
        return labels[type] || labels.unknown;
    },

    /**
     * Get platform icon/emoji
     */
    getPlatformIcon: (platform) => {
        const icons = {
            'youtube': '▶️',
            'twitter': '𝕏',
            'facebook': 'f',
            'instagram': '📷',
            'tiktok': '♪',
            'substack': '✉️',
            'reddit': '🔴'
        };
        return icons[platform] || '🌐';
    }
};

// Private detection helpers
function detectYouTube() {
    return {
        videoId: new URLSearchParams(window.location.search).get('v') ||
                 window.location.pathname.split('/').pop(),
        isLive: !!document.querySelector('.ytp-live-badge-text'),
        hasChat: !!document.querySelector('#chat-container, iframe[src*="live_chat"]'),
        channelName: document.querySelector('#channel-name a, [itemprop="author"] [itemprop="name"]')?.textContent?.trim(),
        videoTitle: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, meta[name="title"]')?.textContent?.trim()
    };
}

function detectTwitter() {
    return {
        isTweet: /\/status\/\d+/.test(window.location.pathname),
        isProfile: !window.location.pathname.includes('/status/'),
        username: window.location.pathname.split('/')[1] || null
    };
}

function detectFacebook() {
    return {
        isPost: /\/(posts|videos|photos)\//.test(window.location.pathname) ||
                window.location.pathname.includes('/permalink/'),
        isProfile: !window.location.pathname.includes('/posts/')
    };
}

function detectInstagram() {
    return {
        isPost: /\/p\//.test(window.location.pathname),
        isReel: /\/reel\//.test(window.location.pathname),
        isProfile: !window.location.pathname.includes('/p/') && !window.location.pathname.includes('/reel/')
    };
}

function detectTikTok() {
    return {
        isVideo: /\/video\/\d+/.test(window.location.pathname),
        username: window.location.pathname.match(/@([^/]+)/)?.[1] || null
    };
}

function isSubstack() {
    return !!document.querySelector('meta[content*="substack"]') ||
           !!document.querySelector('script[src*="substack"]') ||
           !!document.querySelector('.post-content, .available-content');
}

function hasArticleContent() {
    return !!(
        document.querySelector('article, [role="article"]') ||
        document.querySelector('meta[property="og:type"][content="article"]') ||
        document.querySelector('.post-content, .article-body, .story-body') ||
        (document.querySelector('h1') && document.querySelectorAll('p').length > 3)
    );
}
