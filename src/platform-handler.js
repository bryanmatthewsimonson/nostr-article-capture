export const PlatformHandler = {
    _handlers: {},

    /**
     * Register a platform handler
     */
    register: (platform, handler) => {
        PlatformHandler._handlers[platform] = handler;
    },

    /**
     * Get handler for a platform
     */
    get: (platform) => {
        return PlatformHandler._handlers[platform] || PlatformHandler._handlers['generic'];
    },

    /**
     * Check if a platform has a registered handler
     */
    has: (platform) => {
        return !!PlatformHandler._handlers[platform];
    }
};

// Register the generic/article handler (existing behavior)
PlatformHandler.register('generic', {
    type: 'article',
    canCapture: () => true,
    extract: async () => {
        // This delegates to the existing ContentExtractor.extractArticle()
        const { ContentExtractor } = await import('./content-extractor.js');
        return ContentExtractor.extractArticle();
    },
    getReaderViewConfig: () => ({
        showEditor: true,
        showEntityBar: true,
        showClaimsBar: true,
        showComments: false
    })
});
