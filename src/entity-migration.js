import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { Crypto } from './crypto.js';

export const EntityMigration = {
  // Migrate entity schema: convert inline aliases[] strings to separate alias entities with canonical_id
  migrateAliasesToEntities: async () => {
    const schemaVersion = await Storage.get('entity_schema_version', 1);
    if (schemaVersion >= 2) return; // Already migrated

    Utils.log('Running entity alias migration (v1 → v2)...');

    const registry = await Storage.entities.getAll();
    const entities = Object.values(registry);
    let created = 0;

    for (const entity of entities) {
      // Ensure canonical_id is set on every entity
      if (entity.canonical_id === undefined) {
        entity.canonical_id = null;
      }

      if (!entity.aliases || entity.aliases.length === 0) {
        registry[entity.id] = { ...entity, updated: Math.floor(Date.now() / 1000) };
        continue;
      }

      for (const aliasName of entity.aliases) {
        if (!aliasName || aliasName.trim().length < 2) continue;

        const trimmedAlias = aliasName.trim();

        // Generate keypair for alias entity
        const privkey = Crypto.generatePrivateKey();
        const pubkey = Crypto.getPublicKey(privkey);
        const aliasEntityId = 'entity_' + await Crypto.sha256(entity.type + trimmedAlias);

        // Don't create if an entity with this ID already exists
        if (registry[aliasEntityId]) continue;

        const userIdentity = await Storage.identity.get();

        registry[aliasEntityId] = {
          id: aliasEntityId,
          type: entity.type,
          name: trimmedAlias,
          aliases: [],
          canonical_id: entity.id,
          keypair: {
            pubkey,
            privkey,
            npub: Crypto.hexToNpub(pubkey),
            nsec: Crypto.hexToNsec(privkey)
          },
          created_by: userIdentity?.pubkey || entity.created_by || 'migration',
          created_at: Math.floor(Date.now() / 1000),
          articles: [],
          metadata: {},
          updated: Math.floor(Date.now() / 1000)
        };
        created++;
      }

      // Remove old aliases array from canonical entity
      entity.aliases = [];
      registry[entity.id] = { ...entity, updated: Math.floor(Date.now() / 1000) };
    }

    // Save all changes at once
    await Storage.set('entity_registry', registry);
    await Storage.set('entity_schema_version', 2);

    if (created > 0) {
      Utils.log(`Migration complete: created ${created} alias entities`);
    } else {
      Utils.log('Migration complete: no aliases to migrate');
    }
  }
};
