import { PlatformHandler } from '../platform-handler.js';
import { Utils } from '../utils.js';

const TwitterHandler = {
    type: 'social_post',
    platform: 'twitter',

    canCapture: () => {
        const h = window.location.hostname;
        return h.includes('twitter.com') || h.includes('x.com');
    },

    extract: async () => {
        try {
            const isTweet = /\/status\/\d+/.test(window.location.pathname);

            if (isTweet) {
                return extractTweet();
            } else {
                // Profile page or timeline — extract what's visible
                return extractProfile();
            }
        } catch (e) {
            console.error('[NAC Twitter] extract() failed:', e);
            return null;
        }
    },

    extractComments: async (articleUrl) => {
        try {
            // On Twitter, "comments" are replies to the tweet
            const allTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            const replies = allTweets.slice(1); // Skip main tweet

            const comments = [];
            for (const el of replies) {
                const comment = parseTweetElement(el);
                if (comment) {
                    comments.push({
                        ...comment,
                        platform: 'twitter',
                        sourceUrl: articleUrl
                    });
                }
            }

            return comments;
        } catch (e) {
            console.error('[NAC Twitter] extractComments() failed:', e);
            return [];
        }
    },

    getReaderViewConfig: () => ({
        showEditor: false,
        showEntityBar: true,
        showClaimsBar: true,
        showComments: true,
        platformLabel: '𝕏 Twitter/X Post'
    })
};

function extractTweet() {
    // Find the main tweet (first article[data-testid="tweet"] or most prominent)
    const mainTweet = document.querySelector('article[data-testid="tweet"]');
    const tweetData = mainTweet ? parseTweetElement(mainTweet) : {};

    // Check for thread (multiple tweets by same author)
    const allTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const threadTweets = [];
    if (tweetData.authorHandle) {
        for (const el of allTweets) {
            const parsed = parseTweetElement(el);
            if (parsed && parsed.authorHandle === tweetData.authorHandle) {
                threadTweets.push(parsed);
            }
        }
    }

    const isThread = threadTweets.length > 1;
    const fullText = isThread
        ? threadTweets.map((t, i) => `${i + 1}/${threadTweets.length} ${t.text}`).join('\n\n')
        : tweetData.text || '';

    // Build HTML content
    let contentHtml = '';
    if (isThread) {
        contentHtml = '<div class="tweet-thread">';
        threadTweets.forEach((t, i) => {
            contentHtml += `<blockquote class="nac-tweet-embed">
                <p>${Utils.escapeHtml(t.text)}</p>
                <footer>— ${Utils.escapeHtml(t.authorName)} (@${Utils.escapeHtml(t.authorHandle)}) · ${i + 1}/${threadTweets.length}</footer>
            </blockquote>`;
        });
        contentHtml += '</div>';
    } else {
        contentHtml = `<blockquote class="nac-tweet-embed">
            <p>${Utils.escapeHtml(tweetData.text || '')}</p>
            <footer>— ${Utils.escapeHtml(tweetData.authorName || '')} (@${Utils.escapeHtml(tweetData.authorHandle || '')})</footer>
            ${tweetData.tweetUrl ? `<cite><a href="${Utils.escapeHtml(tweetData.tweetUrl)}">${Utils.escapeHtml(tweetData.tweetUrl)}</a></cite>` : ''}
        </blockquote>`;
    }

    // Add media if present
    const mediaImages = mainTweet?.querySelectorAll('img[src*="pbs.twimg.com/media"]') || [];
    mediaImages.forEach(img => {
        contentHtml += `<figure><img src="${Utils.escapeHtml(img.src)}" alt="Tweet media"></figure>`;
    });

    const tweetId = window.location.pathname.match(/\/status\/(\d+)/)?.[1] || '';

    return {
        title: `${tweetData.authorName || 'Tweet'}: "${(tweetData.text || '').substring(0, 80)}${(tweetData.text || '').length > 80 ? '...' : ''}"`,
        byline: tweetData.authorName || '',
        url: `https://x.com${window.location.pathname}`,
        domain: 'x.com',
        siteName: 'Twitter/X',
        publishedAt: tweetData.timestamp ? Math.floor(new Date(tweetData.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: fullText,
        excerpt: (tweetData.text || '').substring(0, 200),
        featuredImage: document.querySelector('meta[property="og:image"]')?.content || tweetData.avatarUrl || '',
        publicationIcon: 'https://abs.twimg.com/favicons/twitter.3.ico',

        platform: 'twitter',
        contentType: 'social_post',
        platformAccount: {
            username: tweetData.authorHandle ? `@${tweetData.authorHandle}` : (tweetData.authorName || 'Unknown'),
            profileUrl: tweetData.authorHandle ? `https://x.com/${tweetData.authorHandle}` : null,
            avatarUrl: tweetData.avatarUrl || null,
            platform: 'twitter'
        },
        tweetMeta: {
            tweetId,
            authorHandle: tweetData.authorHandle || '',
            authorName: tweetData.authorName || '',
            authorAvatarUrl: tweetData.avatarUrl || '',
            isThread,
            threadLength: isThread ? threadTweets.length : 1,
            isRetweet: !!mainTweet?.querySelector('[data-testid="socialContext"]'),
            hasMedia: mediaImages.length > 0,
            mediaCount: mediaImages.length
        },
        engagement: extractTweetEngagement(mainTweet),

        wordCount: fullText.split(/\s+/).filter(w => w).length,
        readingTimeMinutes: 1,
        structuredData: { type: 'SocialMediaPosting' },
        keywords: extractHashtags(fullText),
        language: document.documentElement.lang || 'en',
        isPaywalled: false,
        section: null,
        dateModified: null
    };
}

function extractProfile() {
    // For profile pages, extract the visible tweets as a collection
    const allTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const tweets = allTweets.map(parseTweetElement).filter(t => t && t.text);

    const profileName = document.querySelector('[data-testid="UserName"] span, [data-testid="UserDescription"]')?.closest('[data-testid="UserName"]')?.textContent?.trim() || '';
    const handle = window.location.pathname.split('/')[1] || '';
    const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim() || '';

    let contentHtml = `<h2>@${Utils.escapeHtml(handle)}</h2>`;
    if (bio) contentHtml += `<p><em>${Utils.escapeHtml(bio)}</em></p>`;
    contentHtml += '<hr>';

    tweets.forEach(t => {
        contentHtml += `<blockquote class="nac-tweet-embed">
            <p>${Utils.escapeHtml(t.text)}</p>
            <footer>— ${Utils.escapeHtml(t.authorName)} · ${t.timestamp || ''}</footer>
        </blockquote>`;
    });

    return {
        title: `@${handle} — Twitter/X Profile`,
        byline: profileName,
        url: `https://x.com/${handle}`,
        domain: 'x.com',
        siteName: 'Twitter/X',
        publishedAt: Math.floor(Date.now() / 1000),
        content: contentHtml,
        textContent: tweets.map(t => t.text).join('\n\n'),
        excerpt: bio || `Tweets by @${handle}`,
        featuredImage: document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: 'https://abs.twimg.com/favicons/twitter.3.ico',

        platform: 'twitter',
        contentType: 'social_post',
        tweetMeta: { isProfile: true, handle, tweetCount: tweets.length },
        engagement: {},

        wordCount: tweets.reduce((sum, t) => sum + (t.text?.split(/\s+/).length || 0), 0),
        readingTimeMinutes: 1,
        structuredData: { type: 'ProfilePage' },
        keywords: [],
        language: 'en',
        isPaywalled: false,
        section: null,
        dateModified: null
    };
}

function parseTweetElement(el) {
    if (!el) return null;

    const textEl = el.querySelector('[data-testid="tweetText"]');
    const text = textEl?.textContent?.trim() || '';

    const userNameEl = el.querySelector('[data-testid="User-Name"]');
    const authorName = userNameEl?.querySelector('a span')?.textContent?.trim() || '';
    const authorHandle = userNameEl?.querySelectorAll('a')?.[0]?.href?.split('/')?.pop() || '';

    const timeEl = el.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent || null;

    const avatarEl = el.querySelector('img[src*="profile_images"], [data-testid="Tweet-User-Avatar"] img');
    const avatarUrl = avatarEl?.src || null;

    const tweetLink = el.querySelector('a[href*="/status/"]');
    const tweetUrl = tweetLink ? `https://x.com${tweetLink.getAttribute('href')}` : null;

    return { text, authorName, authorHandle, timestamp, avatarUrl, tweetUrl };
}

function extractTweetEngagement(tweetEl) {
    if (!tweetEl) return { likes: 0, shares: 0, comments: 0, views: 0 };

    const groups = tweetEl.querySelectorAll('[role="group"] [data-testid]');
    let likes = 0, replies = 0, retweets = 0, views = 0;

    groups.forEach(g => {
        const testId = g.getAttribute('data-testid');
        const val = parseEngagementValue(g.textContent?.trim());
        if (testId?.includes('like')) likes = val;
        else if (testId?.includes('reply')) replies = val;
        else if (testId?.includes('retweet')) retweets = val;
    });

    // Views might be in a separate element
    const viewsEl = tweetEl.querySelector('a[href*="/analytics"] span, [class*="view"]');
    if (viewsEl) views = parseEngagementValue(viewsEl.textContent?.trim());

    return { likes, shares: retweets, comments: replies, views };
}

function parseEngagementValue(text) {
    if (!text) return 0;
    text = text.replace(/,/g, '');
    if (text.includes('K')) return Math.round(parseFloat(text) * 1000);
    if (text.includes('M')) return Math.round(parseFloat(text) * 1000000);
    return parseInt(text) || 0;
}

function extractHashtags(text) {
    const matches = text.match(/#\w+/g);
    return matches ? matches.map(h => h.replace('#', '').toLowerCase()) : [];
}

// Register
PlatformHandler.register('twitter', TwitterHandler);

export { TwitterHandler };
