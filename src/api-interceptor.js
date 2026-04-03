/**
 * API Interceptor — hooks fetch() and XMLHttpRequest to capture
 * structured data from Meta's GraphQL API responses.
 * 
 * This runs from page load, accumulating data in a cache.
 * Platform handlers query the cache when the user clicks the FAB.
 * 
 * Enhanced with:
 * - Request body parsing for GraphQL operation names (fb_api_req_friendly_name, doc_id)
 * - Global data store probing (Relay Store, _sharedData, LD+JSON, webpack)
 * - Facebook module registry access via ModuleHook
 */
import { ModuleHook } from './module-hook.js';

/**
 * Convert FormData to a URL-encoded string for body parsing.
 */
function formDataToString(formData) {
    const parts = [];
    for (const [key, value] of formData.entries()) {
        parts.push(`${key}=${value}`);
    }
    return parts.join('&');
}

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
        
        // Probe global data stores on initialization
        try {
            APIInterceptor.probeGlobalStores(platform);
        } catch(e) {
            console.log('[NAC API] Initial store probe failed:', e.message);
        }
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
     * Re-probes global stores if cache is empty.
     */
    getBestPostData: (platform) => {
        // Re-probe if cache is empty — data may have loaded since init
        if (APIInterceptor._cache.filter(d => d._type === 'post' || d._type === 'media').length === 0) {
            try {
                const probePlatform = platform || 
                    (window.location.hostname.includes('instagram') ? 'instagram' : 
                     window.location.hostname.includes('facebook') ? 'facebook' : '');
                if (probePlatform) {
                    APIInterceptor.probeGlobalStores(probePlatform);
                }
            } catch(e) {
                console.log('[NAC API] Re-probe failed:', e.message);
            }
        }
        
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
     * Enhanced: parses request body for GraphQL operation metadata.
     */
    _hookFetch: (platform) => {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        APIInterceptor._originalFetch = win.fetch;
        
        win.fetch = async function(...args) {
            let requestInfo = { url: '', operationName: '', docId: '', variables: null };
            
            try {
                const [input, init] = args;
                requestInfo.url = typeof input === 'string' ? input : input?.url || '';
                
                // Parse POST body for GraphQL operation metadata
                if (init?.body && APIInterceptor._isMetaAPI(requestInfo.url, platform)) {
                    const bodyStr = typeof init.body === 'string' ? init.body : 
                                   init.body instanceof URLSearchParams ? init.body.toString() :
                                   init.body instanceof FormData ? formDataToString(init.body) : '';
                    
                    if (bodyStr) {
                        // Extract operation name (URL-encoded or JSON format)
                        const friendlyName = bodyStr.match(/fb_api_req_friendly_name=([^&]+)/)?.[1] || 
                                            bodyStr.match(/"fb_api_req_friendly_name":"([^"]+)"/)?.[1];
                        const docId = bodyStr.match(/doc_id=([^&]+)/)?.[1] || 
                                     bodyStr.match(/"doc_id":"([^"]+)"/)?.[1];
                        const opName = bodyStr.match(/"operationName":"([^"]+)"/)?.[1];
                        
                        requestInfo.operationName = friendlyName || opName || '';
                        requestInfo.docId = docId || '';
                        
                        // Try to parse variables
                        try {
                            const varsMatch = bodyStr.match(/variables=([^&]+)/);
                            if (varsMatch) requestInfo.variables = JSON.parse(decodeURIComponent(varsMatch[1]));
                        } catch(e) {}
                    }
                }
            } catch(e) {}
            
            const response = await APIInterceptor._originalFetch.apply(this, args);
            
            // Pass requestInfo to the response processor
            if (APIInterceptor._isMetaAPI(requestInfo.url, platform)) {
                const clone = response.clone();
                clone.text().then(text => {
                    try {
                        APIInterceptor._processResponse(text, requestInfo.url, platform, requestInfo);
                    } catch(e) {}
                }).catch(() => {});
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
     * Enhanced: accepts requestInfo with operation name and doc_id.
     */
    _processResponse: (text, url, platform, requestInfo = {}) => {
        if (!text) return;
        
        // Facebook/Instagram sometimes return multiple JSON objects separated by newlines
        const jsonBlocks = text.split('\n').filter(line => line.trim().startsWith('{') || line.trim().startsWith('['));
        
        for (const block of jsonBlocks) {
            try {
                const json = JSON.parse(block);
                APIInterceptor._extractFromJSON(json, platform, 0, requestInfo);
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
     * Enhanced: tags extracted items with _queryName and _docId from requestInfo.
     */
    _extractFromJSON: (obj, platform, depth, requestInfo = {}) => {
        if (!obj || typeof obj !== 'object' || depth > 15) return;
        
        // --- Facebook GraphQL patterns ---
        
        // Post/Story node
        if (obj.__typename === 'Story' || obj.__typename === 'Post' || obj.__typename === 'UserPost') {
            const post = APIInterceptor._extractFBPost(obj);
            if (post) {
                post._type = 'post';
                post._platform = platform;
                post._queryName = requestInfo?.operationName || '';
                post._docId = requestInfo?.docId || '';
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
                comment._queryName = requestInfo?.operationName || '';
                comment._docId = requestInfo?.docId || '';
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
                media._queryName = requestInfo?.operationName || '';
                media._docId = requestInfo?.docId || '';
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
                post._queryName = requestInfo?.operationName || '';
                post._docId = requestInfo?.docId || '';
                APIInterceptor._cache.push(post);
            }
        }
        
        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            for (const item of obj) {
                APIInterceptor._extractFromJSON(item, platform, depth + 1, requestInfo);
            }
        } else {
            for (const key of Object.keys(obj)) {
                if (key.startsWith('_')) continue; // Skip internal keys
                const val = obj[key];
                if (val && typeof val === 'object') {
                    APIInterceptor._extractFromJSON(val, platform, depth + 1, requestInfo);
                }
            }
        }
    },
    
    /**
     * Probe for Facebook/Instagram global data stores.
     * These contain the complete normalized data graph.
     */
    probeGlobalStores: (platform) => {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const results = [];
        
        console.log('[NAC API] Probing global data stores...');
        
        // 1. Check for Relay store
        try {
            // Facebook sometimes exposes the Relay store
            if (win.__RELAY_STORE__) {
                console.log('[NAC API] Found __RELAY_STORE__');
                results.push({ source: 'RELAY_STORE', data: win.__RELAY_STORE__ });
            }
        } catch(e) {}
        
        // 2. Check for Instagram's _sharedData (legacy but sometimes present)
        try {
            if (platform === 'instagram' && win._sharedData) {
                console.log('[NAC API] Found Instagram _sharedData');
                const data = win._sharedData;
                if (data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media) {
                    const media = data.entry_data.PostPage[0].graphql.shortcode_media;
                    const extracted = APIInterceptor._extractIGMedia(media);
                    if (extracted) {
                        extracted._type = 'media';
                        extracted._platform = 'instagram';
                        extracted._source = 'sharedData';
                        APIInterceptor._cache.push(extracted);
                    }
                }
            }
        } catch(e) {}
        
        // 3. Check for __initialData or __NEXT_DATA__ (used by some Meta properties)
        try {
            if (win.__initialData) {
                console.log('[NAC API] Found __initialData');
                APIInterceptor._extractFromJSON(win.__initialData, platform, 0);
            }
        } catch(e) {}
        
        // 4. Scan window properties for data caches
        try {
            const dataProps = Object.keys(win).filter(k => {
                try {
                    return (k.startsWith('__') || k.includes('Store') || k.includes('Cache') || k.includes('Data')) &&
                           typeof win[k] === 'object' && win[k] !== null;
                } catch(e) { return false; }
            });
            
            for (const prop of dataProps.slice(0, 20)) { // Limit scanning
                try {
                    const val = win[prop];
                    if (val && typeof val === 'object') {
                        // Look for Relay-like record maps
                        if (val.__mutationHandlers || val._recordSource || val.getSource) {
                            console.log('[NAC API] Found potential Relay store at window.' + prop);
                            // Try to access records
                            const source = val._recordSource || val.getSource?.() || val;
                            if (source._records || source.__records) {
                                const records = source._records || source.__records;
                                console.log('[NAC API] Found', Object.keys(records).length, 'Relay records');
                                // Extract post-like records
                                for (const [id, record] of Object.entries(records)) {
                                    if (record && record.__typename) {
                                        APIInterceptor._extractFromJSON(record, platform, 0);
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {}
            }
        } catch(e) {}
        
        // 5. Try require('RelayModernStore') if Facebook's module system is available
        try {
            if (win.require) {
                const relayStore = win.require('RelayModernStore');
                if (relayStore) {
                    console.log('[NAC API] Found RelayModernStore via require()');
                }
            }
        } catch(e) {}
        
        // 6. Check for Instagram's additional data endpoints
        try {
            if (platform === 'instagram') {
                // Instagram embeds post data in a <script> with type="application/ld+json"
                document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                    try {
                        const json = JSON.parse(script.textContent);
                        if (json['@type'] === 'ImageObject' || json['@type'] === 'VideoObject') {
                            console.log('[NAC API] Found Instagram LD+JSON');
                        }
                        APIInterceptor._extractFromJSON(json, platform, 0);
                    } catch(e) {}
                });
                
                // Also check for __additionalDataLoaded
                if (win.__additionalDataLoaded) {
                    console.log('[NAC API] Found Instagram __additionalDataLoaded');
                    for (const path in win.__additionalDataLoaded) {
                        APIInterceptor._extractFromJSON(win.__additionalDataLoaded[path], platform, 0);
                    }
                }
            }
        } catch(e) {}
        
        // 7. Probe Facebook module registry via ModuleHook
        try {
            const modules = ModuleHook.probeModules();
            const moduleData = ModuleHook.extractFromModules();
            for (const record of moduleData) {
                APIInterceptor._extractFromJSON(record, platform, 0);
            }
        } catch(e) {
            console.log('[NAC API] Module probe failed:', e.message);
        }
        
        console.log('[NAC API] Store probe complete, cache now has', APIInterceptor._cache.length, 'items');
        return results;
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
