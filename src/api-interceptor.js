/**
 * API Interceptor — hooks fetch() and XMLHttpRequest to capture
 * structured data from Meta's GraphQL API responses.
 * 
 * This runs from page load, accumulating data in a cache.
 * Platform handlers query the cache when the user clicks the FAB.
 */
export const APIInterceptor = {
    _cache: [],           // Array of captured API response data objects
    _active: false,       // Whether interception is active
    _originalFetch: null, // Original fetch reference
    _maxCacheSize: 100,   // Max cached responses (prevent memory leak)
    
    /**
     * Start intercepting API calls on the current page.
     * Should be called early in init for supported platforms.
     */
    start: (platform) => {
        if (APIInterceptor._active) return;
        APIInterceptor._active = true;
        APIInterceptor._cache = [];
        
        console.log('[NAC API] Starting API interception for', platform);
        
        // Hook fetch()
        APIInterceptor._hookFetch(platform);
        
        // Hook XMLHttpRequest
        APIInterceptor._hookXHR(platform);
    },
    
    /**
     * Stop intercepting and restore original functions.
     */
    stop: () => {
        if (!APIInterceptor._active) return;
        APIInterceptor._active = false;
        
        if (APIInterceptor._originalFetch) {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            win.fetch = APIInterceptor._originalFetch;
            APIInterceptor._originalFetch = null;
        }
        
        console.log('[NAC API] Interception stopped, cached', APIInterceptor._cache.length, 'responses');
    },
    
    /**
     * Get all cached data, optionally filtered by type.
     */
    getCachedData: (filter) => {
        if (!filter) return [...APIInterceptor._cache];
        return APIInterceptor._cache.filter(filter);
    },
    
    /**
     * Get the most relevant post data from the cache.
     * Looks for the most recent/largest post-like data object.
     */
    getBestPostData: () => {
        // Sort by relevance: prefer objects with message text, author, images
        const scored = APIInterceptor._cache
            .filter(d => d._type === 'post' || d._type === 'media')
            .map(d => ({
                data: d,
                score: (d.message ? 3 : 0) + (d.author ? 2 : 0) + (d.images?.length ? 1 : 0) + (d.timestamp ? 1 : 0)
            }))
            .sort((a, b) => b.score - a.score);
        
        return scored[0]?.data || null;
    },
    
    /**
     * Get cached comments
     */
    getCachedComments: () => {
        return APIInterceptor._cache.filter(d => d._type === 'comment');
    },
    
    /**
     * Hook the global fetch() function.
     */
    _hookFetch: (platform) => {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        APIInterceptor._originalFetch = win.fetch;
        
        win.fetch = async function(...args) {
            const response = await APIInterceptor._originalFetch.apply(this, args);
            
            try {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                
                // Only intercept Meta API calls
                if (APIInterceptor._isMetaAPI(url, platform)) {
                    // Clone the response so we can read it without consuming it
                    const clone = response.clone();
                    
                    // Read and parse in background (don't block the original caller)
                    clone.text().then(text => {
                        try {
                            APIInterceptor._processResponse(text, url, platform);
                        } catch(e) {
                            // Silently ignore parse errors
                        }
                    }).catch(() => {});
                }
            } catch(e) {
                // Never interfere with the original request
            }
            
            return response;
        };
    },
    
    /**
     * Hook XMLHttpRequest
     */
    _hookXHR: (platform) => {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const OrigXHR = win.XMLHttpRequest;
        
        win.XMLHttpRequest = function() {
            const xhr = new OrigXHR();
            const originalOpen = xhr.open;
            let xhrUrl = '';
            
            xhr.open = function(method, url, ...rest) {
                xhrUrl = url;
                return originalOpen.call(this, method, url, ...rest);
            };
            
            xhr.addEventListener('load', function() {
                try {
                    if (APIInterceptor._isMetaAPI(xhrUrl, platform)) {
                        APIInterceptor._processResponse(this.responseText, xhrUrl, platform);
                    }
                } catch(e) {}
            });
            
            return xhr;
        };
        // Copy static properties
        win.XMLHttpRequest.DONE = OrigXHR.DONE;
        win.XMLHttpRequest.HEADERS_RECEIVED = OrigXHR.HEADERS_RECEIVED;
        win.XMLHttpRequest.LOADING = OrigXHR.LOADING;
        win.XMLHttpRequest.OPENED = OrigXHR.OPENED;
        win.XMLHttpRequest.UNSENT = OrigXHR.UNSENT;
        win.XMLHttpRequest.prototype = OrigXHR.prototype;
    },
    
    /**
     * Check if a URL is a Meta API endpoint worth intercepting.
     */
    _isMetaAPI: (url, platform) => {
        if (!url) return false;
        
        if (platform === 'facebook') {
            return url.includes('/graphql') || 
                   url.includes('/api/graphql') ||
                   url.includes('facebook.com/ajax/') ||
                   url.includes('facebook.com/api/');
        }
        
        if (platform === 'instagram') {
            return url.includes('/graphql') ||
                   url.includes('/api/v1/') ||
                   url.includes('i.instagram.com/api/') ||
                   url.includes('instagram.com/api/');
        }
        
        return false;
    },
    
    /**
     * Process an API response and extract relevant data.
     */
    _processResponse: (text, url, platform) => {
        if (!text) return;
        
        // Facebook/Instagram sometimes return multiple JSON objects separated by newlines
        const jsonBlocks = text.split('\n').filter(line => line.trim().startsWith('{') || line.trim().startsWith('['));
        
        for (const block of jsonBlocks) {
            try {
                const json = JSON.parse(block);
                APIInterceptor._extractFromJSON(json, platform, 0);
            } catch(e) {
                // Not valid JSON — skip
            }
        }
        
        // Trim cache if too large
        while (APIInterceptor._cache.length > APIInterceptor._maxCacheSize) {
            APIInterceptor._cache.shift();
        }
    },
    
    /**
     * Recursively extract post/comment data from a JSON structure.
     * Meta's GraphQL responses have deeply nested structures.
     */
    _extractFromJSON: (obj, platform, depth) => {
        if (!obj || typeof obj !== 'object' || depth > 15) return;
        
        // --- Facebook GraphQL patterns ---
        
        // Post/Story node
        if (obj.__typename === 'Story' || obj.__typename === 'Post' || obj.__typename === 'UserPost') {
            const post = APIInterceptor._extractFBPost(obj);
            if (post) {
                post._type = 'post';
                post._platform = platform;
                APIInterceptor._cache.push(post);
                console.log('[NAC API] Cached FB post:', post.message?.substring(0, 60));
            }
        }
        
        // Comment node
        if (obj.__typename === 'Comment' || obj.__typename === 'UFIComment') {
            const comment = APIInterceptor._extractFBComment(obj);
            if (comment) {
                comment._type = 'comment';
                comment._platform = platform;
                APIInterceptor._cache.push(comment);
            }
        }
        
        // --- Instagram GraphQL patterns ---
        
        if (obj.__typename === 'XDTGraphImage' || obj.__typename === 'XDTGraphVideo' || 
            obj.__typename === 'XDTGraphSidecar' || obj.__typename === 'GraphImage' || 
            obj.__typename === 'GraphVideo' || obj.__typename === 'GraphSidecar') {
            const media = APIInterceptor._extractIGMedia(obj);
            if (media) {
                media._type = 'media';
                media._platform = platform;
                APIInterceptor._cache.push(media);
                console.log('[NAC API] Cached IG media:', media.message?.substring(0, 60));
            }
        }
        
        // Generic node with creation_story or comet_sections (Facebook feed items)
        if (obj.creation_story || obj.comet_sections) {
            const post = APIInterceptor._extractFBFeedItem(obj);
            if (post) {
                post._type = 'post';
                post._platform = platform;
                APIInterceptor._cache.push(post);
            }
        }
        
        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            for (const item of obj) {
                APIInterceptor._extractFromJSON(item, platform, depth + 1);
            }
        } else {
            for (const key of Object.keys(obj)) {
                if (key.startsWith('_')) continue; // Skip internal keys
                const val = obj[key];
                if (val && typeof val === 'object') {
                    APIInterceptor._extractFromJSON(val, platform, depth + 1);
                }
            }
        }
    },
    
    /**
     * Extract post data from a Facebook Story/Post node.
     */
    _extractFBPost: (node) => {
        try {
            const message = node.message?.text || node.message?.body?.text || '';
            const author = node.author?.name || node.actors?.[0]?.name || node.actor?.name || '';
            const authorId = node.author?.id || node.actors?.[0]?.id || '';
            const authorUrl = node.author?.url || node.actors?.[0]?.url || '';
            const authorAvatar = node.author?.profile_picture?.uri || node.actors?.[0]?.profile_picture?.uri || '';
            const timestamp = node.creation_time || node.created_time || node.timestamp || null;
            const url = node.url || node.permalink_url || '';
            
            // Extract images from attachments
            const images = [];
            const attachments = node.attachments || node.media_set?.media?.edges || [];
            (Array.isArray(attachments) ? attachments : [attachments]).forEach(att => {
                const media = att?.node?.media || att?.media || att;
                if (media?.image?.uri) images.push(media.image.uri);
                if (media?.photo?.uri) images.push(media.photo.uri);
                if (media?.uri) images.push(media.uri);
            });
            
            // Extract engagement
            const reactions = node.feedback?.reaction_count?.count || node.feedback?.reactors?.count || 0;
            const comments = node.feedback?.comment_count?.total_count || node.feedback?.comments?.count || 0;
            const shares = node.feedback?.share_count?.count || node.feedback?.reshares?.count || 0;
            
            if (!message && !images.length) return null;
            
            return {
                message, author, authorId, authorUrl, authorAvatar,
                timestamp, url, images,
                engagement: { likes: reactions, comments, shares }
            };
        } catch(e) {
            return null;
        }
    },
    
    /**
     * Extract from Facebook feed item with comet_sections.
     */
    _extractFBFeedItem: (node) => {
        try {
            const message = node.comet_sections?.content?.story?.message?.text || 
                           node.comet_sections?.message?.story?.message?.text || '';
            const authorNode = node.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0] ||
                              node.comet_sections?.actor_photo?.story?.actors?.[0] || {};
            
            if (!message) return null;
            
            return {
                message,
                author: authorNode.name || '',
                authorUrl: authorNode.url || '',
                authorAvatar: authorNode.profile_picture?.uri || '',
                timestamp: node.comet_sections?.context_layout?.story?.comet_sections?.metadata?.[0]?.story?.creation_time || null,
                url: '',
                images: [],
                engagement: { likes: 0, comments: 0, shares: 0 }
            };
        } catch(e) {
            return null;
        }
    },
    
    /**
     * Extract comment data from a Facebook Comment node.
     */
    _extractFBComment: (node) => {
        try {
            const text = node.body?.text || node.preferred_body?.text || '';
            const author = node.author?.name || '';
            const authorUrl = node.author?.url || '';
            const authorAvatar = node.author?.profile_picture?.uri || '';
            const timestamp = node.created_time || null;
            const likes = node.feedback?.reactors?.count || node.comment_reaction_count || 0;
            
            if (!text) return null;
            
            return { text, author, authorUrl, authorAvatar, timestamp, likes };
        } catch(e) {
            return null;
        }
    },
    
    /**
     * Extract media data from an Instagram GraphQL media node.
     */
    _extractIGMedia: (node) => {
        try {
            const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || 
                           node.caption?.text || '';
            const author = node.owner?.username || node.user?.username || '';
            const authorAvatar = node.owner?.profile_pic_url || node.user?.profile_pic_url || '';
            const timestamp = node.taken_at_timestamp || node.taken_at || null;
            const shortcode = node.shortcode || '';
            
            // Images
            const images = [];
            if (node.display_url) images.push(node.display_url);
            if (node.image_versions2?.candidates?.[0]?.url) images.push(node.image_versions2.candidates[0].url);
            
            // Sidecar (multiple images)
            const sidecar = node.edge_sidecar_to_children?.edges || node.carousel_media || [];
            sidecar.forEach(edge => {
                const child = edge.node || edge;
                if (child.display_url) images.push(child.display_url);
                if (child.image_versions2?.candidates?.[0]?.url) images.push(child.image_versions2.candidates[0].url);
            });
            
            // Engagement
            const likes = node.edge_media_preview_like?.count || node.like_count || 0;
            const comments = node.edge_media_to_comment?.count || node.comment_count || 0;
            
            if (!caption && !images.length) return null;
            
            return {
                message: caption, author, authorAvatar, timestamp, shortcode, images,
                authorUrl: author ? `https://www.instagram.com/${author}/` : '',
                engagement: { likes, comments, shares: 0 }
            };
        } catch(e) {
            return null;
        }
    }
};
