# NOSTR Content Capture — Data Model

> **Version**: 4.2.0 — This document describes the data structures used in the current v4 implementation.

## Entity Types

The NOSTR Content Capture system uses four entity types, each with a real secp256k1 keypair:

| Type | Emoji | Description | Examples |
|------|-------|-------------|----------|
| **Person** | 👤 | An individual human | Author, journalist, public figure |
| **Organization** | 🏢 | A company, institution, or group | News outlet, university, corporation |
| **Place** | 📍 | A geographic location | City, country, landmark |
| **Thing** | 🔷 | A concept, event, legislation, or other noun | "Climate Change", "Title IX", "AI" |

Entity data is stored in GM_setValue as an entity registry, synced across browsers via NIP-78 (kind 30078) events encrypted with NIP-44 v2.

---

## Entity Data Structure

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
    articles: [                     // Content this entity appears in
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

When an alias entity is tagged in content, the canonical entity's pubkey is also included in the published NOSTR event's `p` tags. When publishing kind 0 profile events for alias entities, a `["refers_to", canonical_npub]` tag is included.

**Migration:** Legacy entities with inline `aliases[]` strings are auto-migrated on startup to separate alias entities with their own keypairs (via [`EntityMigration.migrateAliasesToEntities()`](../src/entity-migration.js:1)).

---

## Platform Account Data Structure

A **Platform Account** represents a person's identity on a specific platform. Platform accounts are identity fragments that can be linked to a Person entity.

```javascript
// Storage key: 'platform_accounts'
{
  "pacct_<hash>": {
    id: "pacct_<hash>",                    // SHA-256 of platform + username
    username: "@elonmusk",                  // Display name/handle on platform
    platform: "twitter",                    // twitter | youtube | facebook | instagram | tiktok | substack | web
    profileUrl: "https://x.com/elonmusk",  // URL to user's profile (if available)
    avatarUrl: "https://...",              // Avatar URL (if available)

    keypair: {
      pubkey: "<hex-pubkey>",              // secp256k1 keypair for NOSTR identity
      privkey: "<hex-privkey>",
      npub: "npub1...",
      nsec: "nsec1..."
    },

    linkedEntityId: null,                   // "entity_abc" when linked to a Person entity (null until user links)
    commentCount: 0,                        // Number of captured comments by this account
    firstSeen: 1707350400,                 // Timestamp (milliseconds) when first captured
    lastSeen: 1707350400,                  // Timestamp (milliseconds) of most recent appearance
    metadata: {}                           // Extensible metadata
  }
}
```

**Lifecycle:**
1. When a comment or social post is captured, the author's platform account is auto-created (or updated if existing)
2. The account starts with `linkedEntityId: null`
3. The user can link it to an existing Person entity or create a new one
4. Once linked, all statements by that account are attributed to the entity

---

## Comment Data Structure

Individual comments captured from any platform:

```javascript
// Individual comment object (stored via Storage.comments)
{
  id: "cmt_<hash>",                        // Generated hash ID
  authorName: "Jane Smith",                // Display name as shown on platform
  text: "I disagree because...",           // Comment text content
  timestamp: 1707350600,                   // Original comment timestamp (milliseconds or ISO string)
  avatarUrl: "https://...",                // Commenter's avatar URL
  profileUrl: "https://...",               // Commenter's profile URL
  likes: 12,                               // Like/upvote count (where available)

  platform: "substack",                    // Platform identifier
  sourceUrl: "https://example.com/article", // URL of the parent content

  replyTo: null,                           // Parent comment ID (null = top-level)
  platformAccountId: "pacct_<hash>",       // Linked platform account

  // Set during capture
  capturedAt: 1707350700                   // When we captured this comment
}
```

**Platform-specific comment extractors** exist for:

| Platform | Selectors/Strategy |
|----------|-------------------|
| **Generic web** | Heuristic DOM walking (`.comment`, `.Comment`, `[class*="comment"]`, Disqus, WordPress) |
| **Substack** | `.comment-list-item`, `.comment`, `[class*="CommentListItem"]` |
| **YouTube** | `ytd-comment-thread-renderer`, `ytd-comment-renderer` |
| **Twitter/X** | `article[data-testid="tweet"]` (replies after main tweet) |
| **Facebook** | ARIA roles and structural patterns (DOM is heavily obfuscated) |
| **Instagram** | Comment section DOM elements |
| **TikTok** | `__NEXT_DATA__` JSON and comment DOM elements |

---

## Claim Data Structure

```javascript
// Storage key: 'article_claims'
{
  "claim_<hash>": {
    id: "claim_<hash>",             // "claim_" + SHA-256 of (source_url + text)
    text: "The unemployment rate dropped to 3.4%",  // Claim text
    type: "factual",                // factual | causal | evaluative | predictive
    is_crux: false,                 // Whether this is a key claim
    confidence: 50,                 // Confidence level (0–100), shown when is_crux is true
    claimant_entity_id: "entity_abc123",  // Entity ID of who made the claim (or null)
    subject_entity_ids: ["entity_def456"], // Entity IDs of what the claim is about
    subject_text: null,             // Freetext subject (when no entity match)
    object_entity_ids: [],          // Entity IDs of what is asserted about the subject
    object_text: null,              // Freetext object (when no entity match)
    predicate: null,                // Verb/relationship: "is", "funds", "causes", etc.
    quote_date: null,               // ISO date string: when the statement was made
    attribution: "direct_quote",    // direct_quote | paraphrase | editorial | thesis
    source_url: "https://...",      // URL of the content the claim was extracted from
    source_title: "Article Title",  // Title of the source content
    context: "surrounding text",    // Context around the claim
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
| **editorial** | The content's own assertion (default) |
| **direct_quote** | A direct quote from a named claimant |
| **paraphrase** | A paraphrased statement attributed to a claimant |
| **thesis** | The content's main thesis or central argument |

---

## Evidence Link Data Structure

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

---

## Video/Social Post Metadata

When capturing non-article content (YouTube, Twitter/X, etc.), additional metadata is stored:

### YouTube Video Metadata

```javascript
// Stored on the article object as videoMeta
{
  videoId: "dQw4w9WgXcQ",               // YouTube video ID
  duration: "3:32",                      // Video duration string
  viewCount: "5000000",                 // View count
  channelName: "Channel Name",          // YouTube channel name
  channelUrl: "https://youtube.com/@...", // Channel URL
  description: "...",                    // Full video description
}
```

### Twitter/X Tweet Metadata

```javascript
// Stored on the article object as tweetMeta
{
  tweetId: "1234567890",                // Tweet status ID
  authorHandle: "elonmusk",            // Twitter handle (without @)
  authorName: "Elon Musk",             // Display name
  isThread: true,                       // Whether this is a multi-tweet thread
  threadLength: 5,                      // Number of tweets in thread
  isVerified: true,                     // Verified status
  quotedTweet: { /* nested tweet data */ },
}
```

### Engagement Metrics

Captured as evidentiary signals for any social content:

```javascript
// Stored on the article object as engagement
{
  likes: 50000,
  shares: 12000,      // retweets, reposts, etc.
  comments: 8000,
  views: 5000000,
}
```

---

## NOSTR Event Kinds

### Kind 0 — Entity Profile

```json
{
  "kind": 0,
  "pubkey": "<entity-pubkey>",
  "tags": [["refers_to", "<canonical-npub>"]],
  "content": "{\"name\":\"Larry Summers\",\"about\":\"person entity created by nostr-article-capture\"}"
}
```

### Kind 30023 — Long-form Content (Articles, Videos, Social Posts)

Extended with platform-aware tags in v3:

```json
{
  "kind": 30023,
  "tags": [
    ["d", "<url-hash>"],
    ["title", "Content Title"],
    ["published_at", "1707350400"],
    ["r", "https://example.com/article"],
    ["author", "Author Name"],
    ["summary", "Excerpt..."],
    ["image", "https://..."],
    ["p", "<entity-pubkey>", "", "author"],
    ["claim", "Claim text", "factual"],
    ["claim", "Key claim text", "predictive", "crux"],
    ["content_format", "video"],
    ["platform", "youtube"],
    ["video_id", "dQw4w9WgXcQ"],
    ["duration", "3:32"],
    ["transcript", "true"],
    ["tweet_id", "1234567890"],
    ["author_handle", "@elonmusk"],
    ["thread", "true"],
    ["engagement_likes", "50000"],
    ["engagement_shares", "12000"],
    ["engagement_comments", "8000"],
    ["word_count", "2450"],
    ["lang", "en"],
    ["section", "Opinion"],
    ["paywalled", "true"],
    ["client", "nostr-article-capture"]
  ],
  "content": "Full content in markdown..."
}
```

### Kind 30040 — Claim Event

```json
{
  "kind": 30040,
  "tags": [
    ["d", "claim_abc123"],
    ["r", "https://example.com/article"],
    ["claim-text", "Claim text"],
    ["claim-type", "factual"],
    ["attribution", "direct_quote"],
    ["confidence", "85"],
    ["crux", "true"],
    ["p", "<claimant-pubkey>", "", "claimant"],
    ["claimant", "Larry Summers"],
    ["p", "<subject-pubkey>", "", "subject"],
    ["subject", "Federal Reserve"],
    ["p", "<object-pubkey>", "", "object"],
    ["object", "Monetary Policy"],
    ["predicate", "opposes"],
    ["quote-date", "2024-01-15"],
    ["client", "nostr-article-capture"]
  ],
  "content": "surrounding context text"
}
```

When subject or object is freetext (no entity in registry), the `p` tag is omitted:

```json
["subject", "some freetext subject"],
["object", "some freetext object"]
```

### Kind 30041 — Comment/Statement

```json
{
  "kind": 30041,
  "tags": [
    ["d", "cmt_abc123"],
    ["r", "https://example.com/article"],
    ["title", "Article Title"],
    ["comment-text", "I disagree because..."],
    ["comment-author", "Jane Smith"],
    ["platform", "substack"],
    ["p", "<account-pubkey>", "", "commenter"],
    ["comment-date", "1707350600"],
    ["reply-to", "cmt_parent"],
    ["client", "nostr-article-capture"]
  ],
  "content": "I disagree because..."
}
```

### Kind 30043 — Evidence Link

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

### Kind 30078 — Entity Sync

```json
{
  "kind": 30078,
  "tags": [
    ["d", "<entity-id>"],
    ["client", "nostr-article-capture"],
    ["entity-type", "person"],
    ["L", "nac/entity-sync"],
    ["l", "v1", "nac/entity-sync"]
  ],
  "content": "<NIP-44 v2 encrypted entity JSON>"
}
```

### Kind 32125 — Entity Relationship

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

**Relationship types:**

| Type | Description |
|------|-------------|
| **author** | Entity is the author of the content |
| **mentioned** | Entity is mentioned in the content |
| **claimant** | Entity is the source of a specific claim (includes `claim-ref` tag) |
| **subject** | Entity is the subject of a specific claim (includes `claim-ref` tag) |
| **object** | Entity is the object of a specific claim (includes `claim-ref` tag) |

### Kind 32126 — Platform Account

```json
{
  "kind": 32126,
  "tags": [
    ["d", "pacct_abc123"],
    ["p", "<account-pubkey>", "", "account"],
    ["account-username", "@elonmusk"],
    ["account-platform", "twitter"],
    ["r", "https://x.com/elonmusk"],
    ["linked-entity", "entity_xyz"],
    ["client", "nostr-article-capture"]
  ],
  "content": ""
}
```

---

## Article Cache Data Structure (v4)

Per-article local cache for archive reader and paywall bypass. Uses per-article storage keys to avoid loading all cached articles into memory.

### Cache Index

```javascript
// Storage key: 'article_cache_index'
{
  "<urlHash>": {
    url: "https://example.com/article",
    title: "Article Title",
    cachedAt: 1713200000,               // Timestamp (ms)
    publishedToRelay: true,
    size: 45230                          // Approximate size in bytes
  }
}
```

### Cached Article

```javascript
// Storage key: 'article_cache_<urlHash>'
// where urlHash = SHA-256(normalizedUrl).substring(0, 16)
{
  url: "https://example.com/article",
  urlHash: "<16-char-hex>",

  // Core content
  content: "<p>Full HTML...</p>",
  textContent: "Full plain text...",

  // Metadata
  title: "Article Title",
  byline: "Author Name",
  siteName: "Publication",
  domain: "example.com",
  publishedAt: 1707350400,
  featuredImage: "https://...",
  publicationIcon: "https://...",
  excerpt: "First 500 chars...",

  // Classification
  isPaywalled: false,
  contentType: "article",               // article | video | social_post | tweet
  platform: null,                        // youtube | twitter | substack | facebook | instagram | tiktok
  language: "en",
  keywords: ["politics"],
  wordCount: 2450,
  section: "Opinion",

  // Platform-specific
  engagement: { likes: 0, shares: 0, comments: 0, views: 0 },
  tweetMeta: null,
  videoMeta: null,
  substackMeta: null,
  transcript: null,
  transcriptTimestamped: null,
  description: null,
  platformAccount: null,

  // Cache metadata
  cachedAt: 1713200000,
  publishedToRelay: true,
  nostrEventId: "abc123...",
  captureCount: 1
}
```

**Eviction policy**: LRU with 3MB budget. Published articles evicted first (relay serves as backup). Compression for articles >100KB strips `textContent` and `transcriptTimestamped`.

---

## Pending Capture Data Structure (v4)

For CSP-restricted sites (Facebook, Instagram, TikTok) where relay connections are blocked. Captures are saved locally and published later from any page.

```javascript
// Storage key: 'pending_captures'
[
  {
    url: "https://facebook.com/post/123",
    platform: "facebook",
    contentType: "social_post",
    title: "Post by John Doe",
    byline: "John Doe",
    content: "<p>Captured content...</p>",
    textContent: "Captured text...",
    blocks: [                              // Text blocks captured by user
      { text: "Post content...", label: "Selected text", timestamp: 1707350400 }
    ],
    featuredImage: "https://...",
    platformAccount: { username: "@johndoe", platform: "facebook" },
    savedAt: 1707350500,
    status: "pending"                      // pending | published | failed
  }
]
```

---

## Storage Keys Summary

| GM Key | Type | Description |
|--------|------|-------------|
| `entity_registry` | Object | All entities indexed by ID |
| `user_identity` | Object | User's NOSTR identity (pubkey, privkey, signer type) |
| `relay_config` | Object | Relay URLs with read/write/enabled flags |
| `article_claims` | Object | Claims indexed by `source_url` → array of claims |
| `evidence_links` | Object | Evidence links indexed by ID |
| `platform_accounts` | Object | Platform accounts indexed by ID |
| `captured_comments` | Object | Captured comments indexed by source URL |
| `article_cache_index` | Object | Lightweight index of all cached articles |
| `article_cache_<hash>` | Object | Individual cached article content + metadata |
| `pending_captures` | Array | Deferred captures from CSP-restricted sites |
| `entity_last_sync` | Number | Timestamp of last entity sync operation |
| `entity_schema_version` | Number | Schema version for entity migration (current: 2) |
