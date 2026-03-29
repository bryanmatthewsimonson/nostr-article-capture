import { CONFIG } from './config.js';
import { Utils } from './utils.js';

export const Storage = {
  // GM API availability flag — set by checkGMAvailability() at init
  _gmAvailable: true,
  // Error toast throttle — only show once per session
  _errorShown: false,

  // Check if GM storage API is functional (called at init)
  checkGMAvailability: () => {
    try {
      GM_setValue('_nac_test', 'ok');
      const test = GM_getValue('_nac_test', null);
      if (test !== 'ok') throw new Error('GM read-back failed');
      GM_deleteValue('_nac_test');
      Storage._gmAvailable = true;
      console.log('[NAC] GM storage: OK');
    } catch (e) {
      Storage._gmAvailable = false;
      console.warn('[NAC] GM storage NOT available:', e.message, '— falling back to localStorage');
    }
  },

  // Low-level wrappers with localStorage fallback
  get: async (key, defaultValue = null) => {
    // Try GM storage first (if available)
    if (Storage._gmAvailable) {
      try {
        const value = await GM_getValue(key, null);
        if (value !== null) {
          return typeof value === 'string' ? JSON.parse(value) : value;
        }
      } catch (e) {
        console.error('[NAC Storage] GM get error:', key, e);
      }
    }
    // Fallback to localStorage
    try {
      const val = localStorage.getItem('nac_' + key);
      if (val !== null) {
        console.log('[NAC Storage] Read from localStorage fallback:', key);
        return JSON.parse(val);
      }
    } catch (e) {
      console.error('[NAC Storage] localStorage get error:', key, e);
    }
    return defaultValue;
  },

  set: async (key, value) => {
    const json = JSON.stringify(value);

    // Try GM storage first (if available)
    if (Storage._gmAvailable) {
      try {
        await GM_setValue(key, json);
        return true;
      } catch (e) {
        // Log detailed error info
        console.error('[NAC Storage] GM_setValue failed:', {
          key,
          dataSize: json.length,
          error: e,
          errorType: e?.constructor?.name,
          errorMessage: e?.message,
          gmAvailable: Storage._gmAvailable
        });

        // Attempt compression fallback with GM
        if (typeof value === 'object' && value !== null) {
          try {
            const compressed = Storage._compressForSave(key, value);
            const compressedJson = JSON.stringify(compressed);
            await GM_setValue(key, compressedJson);
            console.log('[NAC Storage] Saved with GM compression fallback for key:', key);
            return true;
          } catch (e2) {
            console.error('[NAC Storage] GM compression fallback also failed:', key, e2);
          }
        }

        // Fall through to localStorage below
      }
    }

    // Fallback: try localStorage
    try {
      localStorage.setItem('nac_' + key, json);
      console.log('[NAC Storage] Fell back to localStorage for:', key, '(' + (json.length / 1024).toFixed(1) + ' KB)');
      return true;
    } catch (e2) {
      console.error('[NAC Storage] localStorage fallback also failed:', {
        key,
        dataSize: json.length,
        error: e2,
        errorType: e2?.constructor?.name,
        errorMessage: e2?.message,
        localStorageAvailable: typeof localStorage !== 'undefined'
      });

      // Show toast only once per session to avoid mobile spam
      if (!Storage._errorShown) {
        Storage._errorShown = true;
        try {
          const dataSize = (json.length / 1024).toFixed(1);
          Utils.showToast(`Storage save failed for "${key}" (${dataSize} KB). ${e2.message || 'Storage may be full.'}`, 'error');
        } catch (_) {
          Utils.showToast('Failed to save data. Storage may be full.', 'error');
        }
      } else {
        console.warn('[NAC Storage] Suppressed repeated error toast for:', key);
      }
      return false;
    }
  },

  // Compress data by stripping optional/large fields to fit storage constraints
  _compressForSave: (key, value) => {
    if (key === 'entity_registry' && typeof value === 'object') {
      // Strip articles arrays (can be rebuilt) and limit metadata
      const compressed = {};
      for (const [id, entity] of Object.entries(value)) {
        compressed[id] = { ...entity };
        // Limit articles array to most recent 10 per entity
        if (Array.isArray(compressed[id].articles) && compressed[id].articles.length > 10) {
          compressed[id].articles = compressed[id].articles
            .sort((a, b) => (b.tagged_at || 0) - (a.tagged_at || 0))
            .slice(0, 10);
        }
      }
      return compressed;
    }

    if (key === 'article_claims' && typeof value === 'object') {
      // Trim context fields in claims
      const compressed = {};
      for (const [id, claim] of Object.entries(value)) {
        compressed[id] = { ...claim };
        if (compressed[id].context && compressed[id].context.length > 150) {
          compressed[id].context = compressed[id].context.substring(0, 150) + '…';
        }
      }
      return compressed;
    }

    return value; // No compression available for this key
  },

  delete: async (key) => {
    let success = false;
    // Try GM delete
    if (Storage._gmAvailable) {
      try {
        await GM_deleteValue(key);
        success = true;
      } catch (e) {
        console.error('[NAC Storage] GM delete error:', e);
      }
    }
    // Also clean up localStorage fallback entry
    try {
      localStorage.removeItem('nac_' + key);
      success = true;
    } catch (e) {
      console.error('[NAC Storage] localStorage delete error:', e);
    }
    return success;
  },

  // User identity management
  identity: {
    get: async () => {
      return await Storage.get('user_identity', null);
    },

    set: async (data) => {
      return await Storage.set('user_identity', data);
    },

    clear: async () => {
      return await Storage.delete('user_identity');
    },

    isConfigured: async () => {
      const identity = await Storage.identity.get();
      return identity !== null && identity.pubkey;
    }
  },

  // Entity registry management
  entities: {
    getAll: async () => {
      return await Storage.get('entity_registry', {});
    },

    get: async (id) => {
      const registry = await Storage.entities.getAll();
      return registry[id] || null;
    },

    save: async (id, data) => {
      const registry = await Storage.entities.getAll();
      registry[id] = {
        ...data,
        updated: Math.floor(Date.now() / 1000)
      };
      const result = await Storage.set('entity_registry', registry);

      // Check entity registry size after save
      const registryJson = JSON.stringify(registry);
      const sizeBytes = registryJson.length;
      if (sizeBytes > 5 * 1024 * 1024) {
        console.warn('[NAC Storage] Entity registry exceeds 5MB (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB). Consider cleaning up unused entities.');
        Utils.showToast('Entity registry is very large (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB). Consider removing unused entities.', 'error');
      } else if (sizeBytes > 2 * 1024 * 1024) {
        console.warn('[NAC Storage] Entity registry exceeds 2MB (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB).');
      }

      return registry[id];
    },

    delete: async (id) => {
      const registry = await Storage.entities.getAll();
      delete registry[id];
      return await Storage.set('entity_registry', registry);
    },

    search: async (query, type = null) => {
      const registry = await Storage.entities.getAll();
      const lowerQuery = query.toLowerCase();
      const results = [];
      
      for (const [id, entity] of Object.entries(registry)) {
        if (type && entity.type !== type) continue;
        
        const nameMatch = entity.name.toLowerCase().includes(lowerQuery);
        const aliasMatch = entity.aliases && entity.aliases.some(a => 
          a.toLowerCase().includes(lowerQuery)
        );
        
        if (nameMatch || aliasMatch) {
          results.push({ id, ...entity });
        }
      }
      
      return results;
    },

    findByPubkey: async (pubkey) => {
      const registry = await Storage.entities.getAll();
      for (const [id, entity] of Object.entries(registry)) {
        if (entity.keypair && entity.keypair.pubkey === pubkey) {
          return { id, ...entity };
        }
      }
      return null;
    },

    exportAll: async () => {
      const registry = await Storage.entities.getAll();
      return JSON.stringify(registry, null, 2);
    },

    importAll: async (jsonStr) => {
      try {
        const imported = JSON.parse(jsonStr);
        const registry = await Storage.entities.getAll();
        const merged = { ...registry, ...imported };
        await Storage.set('entity_registry', merged);
        return Object.keys(imported).length;
      } catch (e) {
        console.error('[NAC Storage] Import error:', e);
        return 0;
      }
    },

    getLastSyncTime: async () => {
      return await Storage.get('entity_last_sync', 0);
    },

    setLastSyncTime: async (timestamp) => {
      await Storage.set('entity_last_sync', timestamp);
    }
  },

  // Claims storage
  claims: {
    getAll: async () => {
      return await Storage.get('article_claims', {});
    },

    get: async (claimId) => {
      const claims = await Storage.claims.getAll();
      return claims[claimId] || null;
    },

    getForUrl: async (url) => {
      const claims = await Storage.claims.getAll();
      return Object.values(claims).filter(c => c.source_url === url);
    },

    save: async (claim) => {
      const claims = await Storage.claims.getAll();
      claims[claim.id] = claim;
      return await Storage.set('article_claims', claims);
    },

    delete: async (claimId) => {
      const claims = await Storage.claims.getAll();
      delete claims[claimId];
      return await Storage.set('article_claims', claims);
    }
  },

  // Evidence links storage
  evidenceLinks: {
    getAll: async () => {
      return await Storage.get('evidence_links', {});
    },

    getForClaim: async (claimId) => {
      const links = await Storage.evidenceLinks.getAll();
      return Object.values(links).filter(
        l => l.source_claim_id === claimId || l.target_claim_id === claimId
      );
    },

    save: async (link) => {
      const links = await Storage.evidenceLinks.getAll();
      links[link.id] = link;
      return await Storage.set('evidence_links', links);
    },

    delete: async (linkId) => {
      const links = await Storage.evidenceLinks.getAll();
      delete links[linkId];
      return await Storage.set('evidence_links', links);
    }
  },

  // Relay configuration
  relays: {
    get: async () => {
      return await Storage.get('relay_config', {
        relays: CONFIG.relays_default
      });
    },

    set: async (config) => {
      return await Storage.set('relay_config', config);
    },

    addRelay: async (url) => {
      const config = await Storage.relays.get();
      if (!config.relays.find(r => r.url === url)) {
        config.relays.push({
          url,
          read: true,
          write: true,
          enabled: true
        });
        await Storage.relays.set(config);
      }
    },

    removeRelay: async (url) => {
      const config = await Storage.relays.get();
      config.relays = config.relays.filter(r => r.url !== url);
      await Storage.relays.set(config);
    }
  },

  // Storage usage estimation
  getUsageEstimate: async () => {
    const identity = await Storage.get('user_identity', null);
    const entities = await Storage.get('entity_registry', {});
    const relays = await Storage.get('relay_config', {});
    const sync = await Storage.get('entity_last_sync', 0);
    const claims = await Storage.get('article_claims', {});
    const evidenceLinks = await Storage.get('evidence_links', {});

    const identitySize = JSON.stringify(identity || '').length;
    const entitiesSize = JSON.stringify(entities || '').length;
    const relaysSize = JSON.stringify(relays || '').length;
    const syncSize = JSON.stringify(sync || '').length;
    const claimsSize = JSON.stringify(claims || '').length;
    const evidenceLinksSize = JSON.stringify(evidenceLinks || '').length;
    const totalBytes = identitySize + entitiesSize + relaysSize + syncSize + claimsSize + evidenceLinksSize;

    return {
      totalBytes,
      breakdown: {
        identity: identitySize,
        entities: entitiesSize,
        relays: relaysSize,
        sync: syncSize,
        claims: claimsSize,
        evidenceLinks: evidenceLinksSize
      }
    };
  }
};
