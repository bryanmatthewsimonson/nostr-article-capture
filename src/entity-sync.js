import { Storage } from './storage.js';
import { Crypto } from './crypto.js';
import { EventBuilder } from './event-builder.js';
import { RelayClient } from './relay-client.js';

export const EntitySync = {
  validateEntity(entity) {
    return entity
      && typeof entity.id === 'string'
      && typeof entity.name === 'string'
      && ['person', 'organization', 'place', 'thing'].includes(entity.type)
      && entity.keypair
      && typeof entity.keypair.pubkey === 'string'
      && entity.keypair.pubkey.length === 64
      && typeof entity.updated === 'number'
      && (entity.canonical_id === null || entity.canonical_id === undefined || typeof entity.canonical_id === 'string');
  },

  mergeArticles(localArticles = [], remoteArticles = []) {
    const byUrl = new Map();
    for (const a of [...localArticles, ...remoteArticles]) {
      const existing = byUrl.get(a.url);
      if (!existing || a.tagged_at > existing.tagged_at) {
        byUrl.set(a.url, a);
      }
    }
    return Array.from(byUrl.values());
  },

  mergeEntities(localRegistry, remoteEntities) {
    const merged = { ...localRegistry };
    let stats = { imported: 0, updated: 0, unchanged: 0, keptLocal: 0 };

    for (const remote of remoteEntities) {
      const local = merged[remote.id];
      if (!local) {
        merged[remote.id] = remote;
        stats.imported++;
      } else if (remote.updated > local.updated) {
        merged[remote.id] = {
          ...remote,
          articles: EntitySync.mergeArticles(local.articles, remote.articles)
        };
        stats.updated++;
      } else if (remote.updated < local.updated) {
        merged[remote.id] = {
          ...local,
          articles: EntitySync.mergeArticles(local.articles, remote.articles)
        };
        stats.keptLocal++;
      } else {
        merged[remote.id] = {
          ...local,
          articles: EntitySync.mergeArticles(local.articles, remote.articles)
        };
        stats.unchanged++;
      }
    }
    return { merged, stats };
  },

  async push(options = {}) {
    const { publishProfiles = false, onProgress = () => {} } = options;

    const identity = await Storage.identity.get();
    if (!identity?.privkey) throw new Error('Entity sync requires a local private key');

    const registry = await Storage.entities.getAll();
    const entities = Object.values(registry);
    if (entities.length === 0) throw new Error('No entities to sync');

    onProgress({ phase: 'encrypting', total: entities.length });

    const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);

    const relayConfig = await Storage.relays.get();
    const writeRelays = relayConfig.relays.filter(r => r.enabled && r.write).map(r => r.url);
    if (writeRelays.length === 0) throw new Error('No write-enabled relays configured');

    const results = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      onProgress({ phase: 'publishing', current: i + 1, total: entities.length, name: entity.name });

      try {
        const plaintext = JSON.stringify(entity);
        const encrypted = await Crypto.nip44Encrypt(plaintext, conversationKey);
        const event = EventBuilder.buildEntitySyncEvent(entity.id, encrypted, entity.type, identity.pubkey);
        const signed = await Crypto.signEvent(event, identity.privkey);
        const relayResults = await RelayClient.publish(signed, writeRelays);
        results.push({ entity: entity.name, id: entity.id, relayResults, success: true });
      } catch (e) {
        console.error('[NAC EntitySync] Push error for', entity.id, e);
        results.push({ entity: entity.name, id: entity.id, error: e.message, success: false });
      }
    }

    if (publishProfiles) {
      onProgress({ phase: 'profiles', total: entities.length });
      for (const entity of entities) {
        try {
          if (entity.keypair?.privkey) {
            let canonicalNpub = null;
            if (entity.canonical_id) {
              const canonical = await Storage.entities.get(entity.canonical_id);
              if (canonical && canonical.keypair) {
                canonicalNpub = canonical.keypair.npub || Crypto.hexToNpub(canonical.keypair.pubkey);
              }
            }
            const profileEvent = EventBuilder.buildProfileEvent(entity, canonicalNpub);
            const signed = await Crypto.signEvent(profileEvent, entity.keypair.privkey);
            await RelayClient.publish(signed, writeRelays);
          }
        } catch (e) {
          console.error('[NAC EntitySync] Profile publish error:', entity.id, e);
        }
      }
    }

    await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1000));
    onProgress({ phase: 'complete', results });
    return results;
  },

  async pull(options = {}) {
    const { onProgress = () => {} } = options;

    const identity = await Storage.identity.get();
    if (!identity?.privkey) throw new Error('Entity sync requires a local private key');

    onProgress({ phase: 'fetching' });

    const relayConfig = await Storage.relays.get();
    const readRelays = relayConfig.relays.filter(r => r.enabled && r.read).map(r => r.url);
    if (readRelays.length === 0) throw new Error('No read-enabled relays configured');

    const filter = {
      kinds: [30078],
      authors: [identity.pubkey],
      '#L': ['nac/entity-sync']
    };

    // Pass relay connection progress through to UI
    const rawEvents = await RelayClient.subscribe(filter, readRelays, {
      timeout: 15000,
      idleTimeout: 10000,
      onProgress: (p) => {
        if (p.phase === 'connecting') {
          onProgress({ phase: 'fetching', detail: `Connecting to ${p.url} (${p.attempted}/${readRelays.length})…` });
        } else if (p.phase === 'relay_error') {
          onProgress({ phase: 'fetching', detail: `⚠ ${p.url}: ${p.error} (${p.connected}/${p.attempted} connected)` });
        }
      }
    });

    // Report connection stats even on empty results
    const connStats = rawEvents._connectionStats || { attempted: 0, connected: 0, failed: 0, errors: [] };
    const decryptErrors = [];

    if (rawEvents.length === 0) {
      const noDataStats = { imported: 0, updated: 0, unchanged: 0, keptLocal: 0, total: 0 };
      onProgress({
        phase: 'complete',
        stats: noDataStats,
        connectionStats: connStats,
        decryptErrors
      });
      return { stats: noDataStats, merged: {}, connectionStats: connStats };
    }

    const byDTag = new Map();
    for (const evt of rawEvents) {
      const dTag = evt.tags?.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;
      const existing = byDTag.get(dTag);
      if (!existing || evt.created_at > existing.created_at) {
        byDTag.set(dTag, evt);
      }
    }

    const uniqueEvents = Array.from(byDTag.values());
    onProgress({ phase: 'decrypting', total: uniqueEvents.length });

    const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);
    const sharedSecret = await Crypto.getSharedSecret(identity.privkey, identity.pubkey);

    const remoteEntities = [];
    for (const evt of uniqueEvents) {
      try {
        // Try NIP-44 first, fall back to NIP-04 for backward compatibility
        let decrypted;
        try {
          decrypted = await Crypto.nip44Decrypt(evt.content, conversationKey);
        } catch (_nip44Err) {
          decrypted = await Crypto.nip04Decrypt(evt.content, sharedSecret);
        }
        const entity = JSON.parse(decrypted);
        if (EntitySync.validateEntity(entity)) {
          remoteEntities.push(entity);
        } else {
          console.warn('[NAC EntitySync] Invalid entity structure, skipping:', entity?.id);
          decryptErrors.push('Invalid structure: ' + (entity?.id || 'unknown'));
        }
      } catch (e) {
        console.error('[NAC EntitySync] Decrypt/parse error:', e);
        decryptErrors.push(e.message || 'Decrypt failed');
      }
    }

    onProgress({ phase: 'merging', remote: remoteEntities.length });

    const localRegistry = await Storage.entities.getAll();
    const { merged, stats } = EntitySync.mergeEntities(localRegistry, remoteEntities);

    // Use Storage.set() instead of raw GM_setValue for compression fallback
    const saveResult = await Storage.set('entity_registry', merged);
    if (!saveResult) {
      console.error('[NAC Storage] Failed to save merged entity registry');
    }

    await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1000));
    stats.total = remoteEntities.length;
    onProgress({ phase: 'complete', stats, connectionStats: connStats, decryptErrors });
    return { stats, merged, connectionStats: connStats };
  }
};
