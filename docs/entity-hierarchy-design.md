# Entity Alias System

## Overview

Multiple entities can refer to the same real-world thing. For example, "FTC", "F.T.C.", and "Federal Trade Commission" might all appear in articles. The alias system links these together so they're recognized as the same underlying entity.

## Data Model

Each entity has a `canonical_id` field:

```javascript
{
  id: 'entity_abc123',
  name: 'FTC',
  type: 'organization',
  canonical_id: 'entity_def456',  // points to "Federal Trade Commission"
  aliases: [],                     // deprecated — migrated to separate entities
  keypair: { pubkey, privkey, npub, nsec },
  // ...
}
```

- `canonical_id: null` → this entity IS the canonical entity
- `canonical_id: "entity_xyz"` → this entity is an alias of the entity with that ID

## How It Works

### Creating Alias Relationships
- In the Entity Browser detail view, click **"🔗 Set as alias of…"** to search for and link to a canonical entity
- The detail view shows the current alias relationship:
  - If alias: shows "Alias of: [Name]" with a link and unlink button
  - If canonical: shows "Known Aliases: [list]" with clickable links

### Entity Cards
- Alias entities show a subtle "→ Canonical Name" label under their name in the entity list

### Article Tagging
- When an alias entity is tagged on an article, the **canonical entity is also automatically tagged** in the kind 30023 event
- Both get `["p", pubkey]` tags so NOSTR clients see both identities

### Kind 0 Profile Events
- When publishing entity profiles, alias entities include a `["refers_to", canonical_npub]` tag
- This tells NOSTR clients that this identity is an alternate name for the canonical entity

### Auto-Suggestion
- When an alias entity matches text in an article, the suggestion chip shows "FTC → Federal Trade Commission" to indicate the canonical relationship

### Entity Sync
- `EntitySync.validateEntity()` accepts the `canonical_id` field (null, undefined, or string)
- Alias relationships are preserved through push/pull sync

## Migration (v1 → v2)

On first load after the update, `EntityMigration.migrateAliasesToEntities()` runs:

1. Checks `entity_schema_version` in storage
2. If version < 2: iterates all entities
3. For each entity with non-empty `aliases[]` array:
   - Creates a new entity for each alias string (with generated keypair, same type)
   - Sets `canonical_id` on the new entity pointing to the original
   - Clears the `aliases[]` array on the original
4. Sets schema version to 2

The migration runs before the FAB button is created, ensuring the data model is consistent before any UI interaction.

## Schema Version

Stored as `entity_schema_version` in GM storage:
- **v1** (default): entities have `aliases[]` string arrays (legacy)
- **v2**: aliases are separate entities with `canonical_id` references
