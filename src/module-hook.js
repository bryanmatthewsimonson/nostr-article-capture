/**
 * Facebook Module Registry Hook
 * 
 * Facebook defines all internal modules via __d("ModuleName", ["deps"], function(...) { ... })
 * By hooking this before Facebook's bundle loads, we can intercept module definitions.
 * 
 * NOTE: This only works if @run-at is document-start.
 * Currently our script uses document-idle, so this hook runs AFTER modules are defined.
 * We use a different approach: iterate already-defined modules.
 */
export const ModuleHook = {
    _interceptedModules: {},
    
    /**
     * Try to access Facebook's module system and find data-rich modules.
     * This works at any time — scans already-loaded modules.
     */
    probeModules: () => {
        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        
        console.log('[NAC ModuleHook] Probing Facebook module system...');
        
        // Method 1: Check for __d and require
        try {
            if (typeof win.__d === 'function' && typeof win.require === 'function') {
                // Try to require known data modules
                const moduleNames = [
                    'RelayModernStore',
                    'RelayRecordSource',
                    'CometFeedStoryDataSource',
                    'GraphQLBatchHTTPLink',
                    'InstagramSharedData',
                    'CometProfileTimelineDataSource',
                ];
                
                for (const name of moduleNames) {
                    try {
                        const mod = win.require(name);
                        if (mod) {
                            console.log('[NAC ModuleHook] Found module:', name);
                            ModuleHook._interceptedModules[name] = mod;
                        }
                    } catch(e) {
                        // Module not found — expected for most
                    }
                }
            }
        } catch(e) {
            console.log('[NAC ModuleHook] __d/require not available:', e.message);
        }
        
        // Method 2: Check for webpack chunks
        try {
            const chunkNames = Object.keys(win).filter(k => k.startsWith('webpackChunk'));
            for (const chunkName of chunkNames) {
                const chunks = win[chunkName];
                if (Array.isArray(chunks)) {
                    console.log('[NAC ModuleHook] Found webpack chunks:', chunkName, 'with', chunks.length, 'chunks');
                    // We don't parse chunks — just log their existence for diagnostics
                }
            }
        } catch(e) {}
        
        // Method 3: Check for __webpack_require__ on window or within closures
        try {
            if (win.__webpack_require__) {
                console.log('[NAC ModuleHook] Found __webpack_require__');
                // Try to access module cache
                const cache = win.__webpack_require__.c;
                if (cache) {
                    const moduleIds = Object.keys(cache);
                    console.log('[NAC ModuleHook] webpack module cache has', moduleIds.length, 'modules');
                    
                    // Look for modules with data-rich exports
                    for (const id of moduleIds.slice(0, 200)) {
                        try {
                            const mod = cache[id]?.exports;
                            if (mod && typeof mod === 'object') {
                                // Check if this module exports a store-like object
                                if (mod.getRecordSource || mod._recordSource || mod.getStore) {
                                    console.log('[NAC ModuleHook] Found potential store in module', id);
                                    ModuleHook._interceptedModules['__store_' + id] = mod;
                                }
                            }
                        } catch(e) {}
                    }
                }
            }
        } catch(e) {}
        
        const found = Object.keys(ModuleHook._interceptedModules).length;
        console.log('[NAC ModuleHook] Probe complete, found', found, 'modules');
        return ModuleHook._interceptedModules;
    },
    
    /**
     * Try to extract data from intercepted modules.
     */
    extractFromModules: () => {
        const data = [];
        
        for (const [name, mod] of Object.entries(ModuleHook._interceptedModules)) {
            try {
                // RelayModernStore — has getSource() returning RecordSource
                if (name === 'RelayModernStore' || name.includes('store')) {
                    const source = mod.getSource?.() || mod._recordSource;
                    if (source?._records || source?.__records) {
                        const records = source._records || source.__records;
                        for (const record of Object.values(records)) {
                            if (record?.__typename) {
                                data.push(record);
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        
        return data;
    }
};
