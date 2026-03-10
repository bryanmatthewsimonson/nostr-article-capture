# NOSTR Article Capture — Data Model

> **Version**: 2.5.0 — This document describes the data structures used in the current implementation.

## Entity Types

The v2 NOSTR Article Capture implementation uses four entity types, each with a real secp256k1 keypair:

| Type | Emoji | Description | Examples |
|------|-------|-------------|----------|
| **Person** | 👤 | An individual human | Author, journalist, public figure |
| **Organization** | 🏢 | A company, institution, or group | News outlet, university, corporation |
| **Place** | 📍 | A geographic location | City, country, landmark |
| **Thing** | 🔷 | A concept, event, legislation, or other noun | "Climate Change", "Title IX", "AI" |

Entity data is stored in GM_setValue as an entity registry, synced across browsers via NIP-78 (kind 30078) events encrypted with NIP-44 v2.

### v2 Entity Data Structure (Implemented)

```javascript
// Storage key: 'entity_registry'
{
  "entity_<hash>": {
    id: "entity_<hash>",           // SHA-256 of type + normalized name
    type: "person",                 // person | organization | place | thing
    name: "Larry Summers",         // Display name
    aliases: [],                    // Legacy field (migrated to separate alias entities)
    canonical_id: null,             // If this entity is an alias: points to the canonical entity ID
                                    // If null: this is a primary (canonical) entity
    keypair: {
      pubkey: "<real-hex-pubkey>",  // Derived from real secp256k1
      privkey: "<hex-privkey>",     // Stored locally
      npub: "npub1...",             // Real bech32 encoding
      nsec: "nsec1..."             // Real bech32 encoding
    },
    created_by: "<user-pubkey>",    // Which user created this entity
    created_at: 1707350400,         // Unix timestamp
    updated: 1707350500,            // Unix timestamp of last modification
    articles: [                     // Articles this entity appears in
      {
        url: "https://example.com/article",
        title: "Example Article",
        context: "mentioned",       // quoted | mentioned | author | subject
        tagged_at: 1707350400
      }
    ],
    metadata: {}                    // Extensible metadata
  }
}
```

**Entity Alias Relationships:**

Aliases are separate entities with their own keypair and `canonical_id` pointing to the primary entity:

```
Entity: "Lawrence Summers" (canonical_id: "entity_abc123")
  └── points to → Entity: "Larry Summers" (canonical_id: null)  ← canonical entity
```

When an alias entity is tagged in an article, the canonical entity's pubkey is also included in the published NOSTR event's `p` tags. When publishing kind 0 profile events for alias entities, a `["refers_to", canonical_npub]` tag is included.

**Migration:** Legacy entities with inline `aliases[]` strings are auto-migrated on startup to separate alias entities with their own keypairs (Section 10B: Entity Alias Migration).

### v2 Claim Data Structure (Implemented)

```javascript
// Storage key: 'article_claims'
{
  "claim_<hash>": {
    id: "claim_<hash>",             // "claim_" + SHA-256 of (source_url + text)
    text: "The unemployment rate dropped to 3.4%",  // Claim text
    type: "factual",                // factual | causal | evaluative | predictive
    is_crux: false,                 // Whether this is a key claim in the article
    confidence: 50,                 // Confidence level (0–100), shown when is_crux is true
    claimant_entity_id: "entity_abc123",  // Entity ID of who made the claim (or null for editorial voice)
    subject_entity_ids: ["entity_def456"], // Entity IDs of what the claim is about
    attribution: "direct_quote",    // direct_quote | paraphrase | editorial | thesis
    source_url: "https://...",      // URL of the article the claim was extracted from
    source_title: "Article Title",  // Title of the source article
    context: "surrounding text",    // Context around the claim in the article
    created_at: 1707350400,         // Timestamp (milliseconds)
    created_by: "<user-pubkey>"     // Pubkey of the user who extracted the claim (or "local")
  }
}
```

**Claim Types:**

| Type | Description | Example |
|------|-------------|---------|
| **Factual** | Verifiable statement of fact | "GDP grew 2.1% in Q3" |
| **Causal** | Asserts a cause-effect relationship | "The tax cut led to increased investment" |
| **Evaluative** | A judgment or assessment | "This is the most important policy change in a decade" |
| **Predictive** | A prediction about the future | "Inflation will fall below 2% by 2026" |

**Attribution Types:**

| Type | Description |
|------|-------------|
| **editorial** | The article's own assertion (default) |
| **direct_quote** | A direct quote from a named claimant |
| **paraphrase** | A paraphrased statement attributed to a claimant |
| **thesis** | The article's main thesis or central argument |

**Claims in NOSTR Events (kind 30040):**

Each claim is published as its own replaceable event:

```json
{
  "kind": 30040,
  "tags": [
    ["d", "claim_abc123"],
    ["r", "https://example.com/article"],
    ["article-title", "Example Article"],
    ["claim", "The unemployment rate dropped to 3.4%", "factual"],
    ["attribution", "direct_quote"],
    ["confidence", "85"],
    ["crux", ""],
    ["p", "<claimant-entity-pubkey>", "", "claimant"],
    ["claimant", "Larry Summers"],
    ["p", "<subject-entity-pubkey>", "", "subject"],
    ["subject", "Federal Reserve"],
    ["client", "nostr-article-capture"]
  ],
  "content": "surrounding context text"
}
```

Claims are also embedded as summary tags in the kind 30023 article event:

```json
["claim", "The unemployment rate dropped to 3.4%", "factual"]
["claim", "This policy will cause economic growth", "causal", "crux"]
```

### v2 Evidence Link Data Structure (Implemented)

```javascript
// Storage key: 'evidence_links'
{
  "evidence_<hash>": {
    id: "evidence_<hash>",           // Unique evidence link ID
    source_claim_id: "claim_abc123", // The claim being linked from
    target_claim_id: "claim_def456", // The claim being linked to
    relationship: "supports",        // supports | contradicts | contextualizes
    note: "Optional explanation",    // User-provided explanation
    created_at: 1707350400           // Timestamp (milliseconds)
  }
}
```

**Relationship Types:**

| Type | Icon | Description |
|------|------|-------------|
| **supports** | ✅ | Target claim provides evidence supporting the source claim |
| **contradicts** | ❌ | Target claim provides evidence contradicting the source claim |
| **contextualizes** | 📎 | Target claim provides additional context for the source claim |

**Evidence Links in NOSTR Events (kind 30043):**

```json
{
  "kind": 30043,
  "tags": [
    ["d", "evidence_link_id"],
    ["source-claim", "claim_abc123"],
    ["target-claim", "claim_def456"],
    ["relationship", "supports"],
    ["r", "https://example.com/article-1"],
    ["r", "https://example.com/article-2"],
    ["client", "nostr-article-capture"]
  ],
  "content": "optional explanation note"
}
```

### v2 Entity Relationship Events (Implemented)

Kind 32125 events link entities to articles with typed relationships. These are published during article publish — one event per entity-article-relationship:

```json
{
  "kind": 32125,
  "tags": [
    ["d", "<entity-id>:<article-url>:<relationship>"],
    ["r", "https://example.com/article"],
    ["p", "<entity-pubkey>", "", "author"],
    ["entity-name", "Helen Andrews"],
    ["entity-type", "person"],
    ["relationship", "author"],
    ["client", "nostr-article-capture"],
    ["claim-ref", "claim_abc123"]
  ],
  "content": ""
}
```

**Relationship types for entity relationships:**

| Type | Description |
|------|-------------|
| **author** | Entity is the author of the article |
| **mentioned** | Entity is mentioned in the article |
| **claimant** | Entity is the source of a specific claim (includes `claim-ref` tag) |
| **subject** | Entity is the subject of a specific claim (includes `claim-ref` tag) |
