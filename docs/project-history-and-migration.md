# NOSTR Article Capture — Project History & Browser Extension Migration Guide

> **Version**: 4.2.0 — Comprehensive reference for the project's complete history, data model, NOSTR event kinds, and a detailed guide for migrating the functionality to a Chromium browser extension (Manifest V3).

---

## Table of Contents

- [Part 1: Project History and Evolution](#part-1-project-history-and-evolution)
- [Part 2: Complete Data Model](#part-2-complete-data-model)
- [Part 3: NOSTR Event Kinds](#part-3-nostr-event-kinds)
- [Part 4: Browser Extension Migration Guide](#part-4-browser-extension-migration-guide)
- [Part 5: Lessons Learned](#part-5-lessons-learned)

---

## Part 1: Project History and Evolution

### 1.1 Origins (v1.x) — Single-File Tampermonkey Userscript

The project began as a Tampermonkey userscript for capturing web articles and publishing them to NOSTR relays. The v1 implementation grew to **11,398 lines in a single file** with 14 monolithic sections. Key problems:

- **Broken crypto**: Public key derivation was `SHA-256 of privkey` instead of real secp256k1 point multiplication. Bech32 encoding was `'npub1' + hex.substring(0,59)` — not valid bech32. Signature verification returned `true` unconditionally.
- **Scope creep**: Included fact-checking (kind 32127), headline corrections (kind 32129), content ratings (kind 32124), trust scores, reaction systems, and debunking banners — none fully functional.
- **Competing UI paradigms**: Modal panels, sidebars, and banners fighting for screen space.
- **External library loading**: `@require` directives loaded Readability, Turndown, and crypto libraries from CDNs, which was fragile.

Despite these issues, v1 established solid foundations: `GM_setValue`/`GM_getValue` storage, URL normalization and canonical URL detection, date extraction (JSON-LD, meta tags), content extraction via Readability + Turndown, the WebSocket relay client pattern, and the NIP-23 article event builder.

### 1.2 v2 Redesign — Complete Rewrite

The v2 redesign stripped everything back to four core capabilities: **capture, read, tag, publish**. All verification, rating, and trust features were removed.

#### Key v2 Innovations

**Hand-rolled secp256k1 BIP-340 Schnorr Crypto (no dependencies)**

All cryptographic operations implemented in pure JavaScript using Web Crypto API + BigInt field arithmetic:

| Primitive | Implementation |
|-----------|---------------|
| secp256k1 | Key generation, public key derivation via point multiplication |
| BIP-340 Schnorr | Signing (deterministic nonce per spec) and verification |
| Bech32 (BIP-173) | Encoding/decoding for `npub`/`nsec` |
| ECDH | Shared secret derivation for conversation keys |
| ChaCha20 | Stream cipher (RFC 7539 quarter-round, pure JS) |
| HKDF-SHA256 | Key derivation (extract + expand) |
| HMAC-SHA256 | Message authentication with constant-time comparison |
| NIP-44 v2 | Padded encryption (ChaCha20 + HMAC-SHA256 encrypt-then-MAC) |
| NIP-04 (Legacy) | AES-256-CBC encrypt/decrypt via Web Crypto `SubtleCrypto` |
| SHA-256 | Hashing via Web Crypto API |

Validated by 65 crypto tests (BIP-340 official vectors) + 5 NIP-44 tests (ChaCha20 RFC 7539 vector, padding, encrypt/decrypt roundtrip, HMAC tamper detection).

**Full-Page Reader View**

Replaced the modal/panel approach with a full-page takeover (like Firefox Reader View):
- Clean typography with optimal reading width (680px)
- WYSIWYG visual editor (`contentEditable` rich-text editing)
- Raw markdown editor (toggle between visual and markdown modes)
- "Preview as Published" — HTML → Markdown → HTML roundtrip
- Inline metadata editing (click author, publication, date, URL to edit)
- Dark mode via `prefers-color-scheme`

**Entity Tagging System**

Four entity types: Person 👤, Organization 🏢, Place 📍, Thing 🔷. Each entity gets a real secp256k1 keypair for NOSTR identity. Text selection popover for tagging, manual tagging via button, auto-detection of author and publication.

**Entity Aliases with `canonical_id`**

Entities can be linked as aliases of a canonical entity. "FTC" and "Federal Trade Commission" share a canonical relationship. When alias entities are tagged, the canonical entity's pubkey is also included in published events. Kind 0 profile events for aliases include `["refers_to", canonical_npub]`.

**Entity Sync via NIP-78 with NIP-44 Encryption**

Full entity data (including private keys) encrypted with NIP-44 v2 and published as kind 30078 events. Cross-browser sync: export nsec on Browser A → import on Browser B → Pull from NOSTR. NIP-04 fallback for reading older sync events.

**Relay Client**

WebSocket connections with retry (exponential backoff: 1s → 2s → 4s). Parallel publishing via `Promise.allSettled()`. REQ/EOSE subscription pattern. Stale connection detection. CSP blocking detection.

**Storage**

`GM_setValue`/`GM_getValue` with `localStorage` fallback. Storage quota monitoring (green → orange at 1MB → red at 5MB). Compression fallback (`_compressForSave()`) strips optional fields when writes fail.

### 1.3 Double Crux / Claims System (v2.5)

Added claim extraction and structured evidence linking:

- **Claim extraction**: Select text → click 📋 Claim → classify as Factual, Causal, Evaluative, or Predictive
- **Crux marking**: Mark key claims as "crux" with confidence slider (0–100%)
- **Structured claim triples**: `[Subject] → [Predicate] → [Object]` where Subject and Object can be entity references or freetext
- **Attribution types**: direct_quote, paraphrase, editorial, thesis
- **Evidence linking**: Cross-content claim relationships — supports ✅, contradicts ❌, contextualizes 📎
- **View others' claims**: 🌐 button fetches kind 30040 events from relays for the same URL
- **Kind 30040**: Individual claim events with claimant/subject/object p-tags
- **Kind 30043**: Evidence link events
- **Kind 32125**: Entity relationship events (author, mentioned, claimant, subject)

### 1.4 v3 Expansion — Multi-Platform Content Capture

#### Build System Migration

Introduced esbuild to bundle 30+ ES modules into a single IIFE userscript. The Tampermonkey header is injected as a banner. Dependencies (Readability, Turndown, turndown-plugin-gfm) installed via npm and bundled — no external `@require` tags.

```bash
npm install      # install bundled dependencies
npm run build    # → dist/nostr-article-capture.user.js
npm run watch    # → rebuild on file changes
```

#### Content Type Detection + Platform Handler Registry

`ContentDetector.detect()` analyzes URL patterns and DOM signals to identify YouTube, Twitter/X, Facebook, Instagram, TikTok, Substack, and generic articles. `PlatformHandler` provides a registry for self-registering platform extractors. FAB icon adapts to detected platform.

#### Platform Handlers

| Platform | Handler | Extraction Strategy | Challenges |
|----------|---------|-------------------|------------|
| **Substack** | `platforms/substack.js` | Readability + Substack-specific comment extraction, publication metadata, subscriber info, engagement metrics | Clean semantic HTML, stable selectors |
| **YouTube** | `platforms/youtube.js` | DOM + `ytInitialPlayerResponse`, transcript panel + timedtext API, `GM_xmlhttpRequest` CORS bypass, DOM scraping fallback | Trusted Types CSP blocks innerHTML; SPA navigation |
| **Twitter/X** | `platforms/twitter.js` | `data-testid` selectors on `article` elements, thread detection, quoted tweets, engagement | Dynamic loading, thread detection heuristics |
| **Facebook** | `platforms/facebook.js` | ARIA roles, structural patterns, API interception, React fiber traversal | Heavily obfuscated DOM, CSP blocks WebSocket |
| **Instagram** | `platforms/instagram.js` | Post/reel DOM elements, comment extraction, API interception | Similar to Facebook, CSP restrictions |
| **TikTok** | `platforms/tiktok.js` | `__NEXT_DATA__` JSON, DOM elements, comment extraction | Framework changes break `__NEXT_DATA__` |

#### Platform Accounts

`PlatformAccount` is a new data type representing a person's identity on a specific platform — separate from entities. Each unique commenter creates a Platform Account. Accounts can be linked to Person entities for attribution.

#### Comment Capture

Generic comment extractor with heuristic DOM walking (native, Disqus, WordPress). Platform-specific extractors for Substack, YouTube, Twitter/X, Facebook, Instagram, TikTok. Thread structure (parent/reply relationships) preserved. Each comment published as an individual kind 30041 event.

#### Engagement Metrics

Likes, shares, views, comments captured as evidentiary signal tags on kind 30023 events.

### 1.5 v4 Architecture — Two-Mode Capture

#### Reader Mode vs. Capture Panel

| Mode | Used For | UI | When |
|------|----------|----|----|
| **Reader Mode** | Articles, Substack | Full-page takeover | Content can be read in clean format |
| **Capture Panel** | Facebook, Instagram, TikTok, YouTube | Non-invasive 350px right-side panel (Shadow DOM) | CSP-restricted sites where full-page takeover is hostile |

The Capture Panel (`capture-panel.js`) is a Shadow DOM isolated side panel that:
- Accepts text selection blocks from the user
- Builds an article object incrementally
- Saves as pending capture for later publishing from a non-CSP-restricted page
- Auto-fills YouTube metadata when on video pages

#### Pending Captures

For CSP-restricted sites where relay connections are blocked, captures are saved as pending (`pending-captures.js`) and can be published later from any page. A red badge on the FAB shows pending capture count.

#### Trusted Types CSP Compatibility

`trusted-types.js` creates a CSP-compliant `default` Trusted Types policy before any innerHTML assignments. This allows Readability and Turndown (which use innerHTML internally) to work on YouTube and Google domains that enforce `require-trusted-types-for 'script'`.

#### Shadow DOM FAB Isolation

The FAB button is created inside a closed Shadow DOM to isolate it from page CSS. A 3-second interval re-enforces host styles to prevent dynamic overlays from hiding it. Regular DOM fallback if Shadow DOM fails.

### 1.6 Archive Reader (v4.1)

Local article cache with relay retrieval for paywall bypass:

- **Local cache**: Per-article GM storage keys (`article_cache_<urlHash>`) with lightweight index. LRU eviction with 3MB budget. Published articles evicted first (relay serves as backup).
- **Relay retrieval**: Queries kind 30023 events by URL, reconstructs article objects from events via `EventBuilder.reconstructArticleFromEvent()`.
- **Paywall detection**: JSON-LD `isAccessibleForFree`, DOM selectors (`.paywall`, `.subscriber`, Piano/Tinypass, registration walls, gradient overlays), truncation ratio analysis.
- **Archive-aware FAB**: 📦 badge when cached article detected. Automatic archive fallback when fresh extraction fails or returns truncated content.
- **SPA navigation**: MutationObserver + `yt-navigate-finish` events recheck cache on URL changes.

### 1.7 Anti-Obfuscation System (v4.2)

For heavily obfuscated platforms (Facebook, Instagram):

- **API Interception** (`api-interceptor.js`): Hooks `fetch()` and `XMLHttpRequest` to capture structured data from Meta's GraphQL API responses. Parses request bodies for `fb_api_req_friendly_name` and `doc_id`. Caches up to 100 responses.
- **Global Data Store Probing**: Accesses Relay Store, `_sharedData`, `LD+JSON`, webpack module registries.
- **React Fiber Traversal**: Walks `__reactFiber$` properties on DOM elements to extract component props containing structured post data.
- **ARIA Extraction**: Uses `role="article"`, `aria-label`, `data-testid` attributes as stable selectors.
- **Computed Style Analysis**: Detects post boundaries using visual characteristics — size, borders, backgrounds, shadows, margins.
- **Text Pattern Analysis**: Heuristic detection of post containers using DOM structure scoring.
- **Module Hook** (`module-hook.js`): Probes Facebook's internal module system (`__d`/`require`) to find data-rich modules like `RelayModernStore`, `CometFeedStoryDataSource`.
- **User-Assisted Capture**: Text selection + click-to-select overlay as the most obfuscation-proof capture method. The user highlights exactly what they want captured.

---

## Part 2: Complete Data Model

### 2.1 Entity

```javascript
// Storage key: 'entity_registry'
{
  "entity_<sha256_hash>": {
    id: "entity_<hash>",              // SHA-256 of type + normalized name
    type: "person",                    // person | organization | place | thing
    name: "Larry Summers",            // Display name
    aliases: [],                       // Legacy field (migrated to separate alias entities)
    canonical_id: null,                // If alias: points to canonical entity ID. If null: this IS canonical.
    keypair: {
      pubkey: "<64-char-hex>",         // secp256k1 x-only public key
      privkey: "<64-char-hex>",        // Private key
      npub: "npub1...",                // Bech32 encoded public key
      nsec: "nsec1..."                 // Bech32 encoded private key
    },
    created_by: "<user-pubkey>",       // Which user created this entity
    created_at: 1707350400,            // Unix timestamp (seconds)
    updated: 1707350500,               // Unix timestamp of last modification
    articles: [                        // Content this entity appears in
      {
        url: "https://example.com/article",
        title: "Example Article",
        context: "mentioned",          // quoted | mentioned | author | subject
        tagged_at: 1707350400
      }
    ],
    metadata: {}                       // Extensible metadata
  }
}
```

### 2.2 Claim

```javascript
// Storage key: 'article_claims'
{
  "claim_<hash>": {
    id: "claim_<hash>",                // "claim_" + SHA-256 of (source_url + text)
    text: "The unemployment rate dropped to 3.4%",
    type: "factual",                   // factual | causal | evaluative | predictive
    is_crux: false,                    // Whether this is a key claim
    confidence: 50,                    // 0–100, shown when is_crux is true
    claimant_entity_id: "entity_abc",  // Entity ID of who made the claim
    subject_entity_ids: ["entity_def"],// Entity IDs of what the claim is about
    subject_text: null,                // Freetext subject (when no entity match)
    object_entity_ids: [],             // Entity IDs of what is asserted about subject
    object_text: null,                 // Freetext object (when no entity match)
    predicate: null,                   // Verb/relationship: "is", "funds", "causes"
    quote_date: null,                  // ISO date: when the statement was made
    attribution: "direct_quote",       // direct_quote | paraphrase | editorial | thesis
    source_url: "https://...",
    source_title: "Article Title",
    context: "surrounding text",       // Context around the claim
    created_at: 1707350400,            // Timestamp (milliseconds)
    created_by: "<user-pubkey>"
  }
}
```

### 2.3 Evidence Link

```javascript
// Storage key: 'evidence_links'
{
  "evidence_<hash>": {
    id: "evidence_<hash>",
    source_claim_id: "claim_abc123",
    target_claim_id: "claim_def456",
    relationship: "supports",          // supports | contradicts | contextualizes
    note: "Optional explanation",
    created_at: 1707350400
  }
}
```

### 2.4 Platform Account

```javascript
// Storage key: 'platform_accounts'
{
  "pacct_<hash>": {
    id: "pacct_<hash>",                // SHA-256 of platform + username
    username: "@elonmusk",
    platform: "twitter",               // twitter | youtube | facebook | instagram | tiktok | substack | web
    profileUrl: "https://x.com/elonmusk",
    avatarUrl: "https://...",
    keypair: {
      pubkey: "<hex>", privkey: "<hex>",
      npub: "npub1...", nsec: "nsec1..."
    },
    linkedEntityId: null,              // "entity_abc" when linked to Person entity
    commentCount: 0,
    firstSeen: 1707350400,             // Timestamp (milliseconds)
    lastSeen: 1707350400,
    metadata: {}
  }
}
```

### 2.5 Comment

```javascript
// Storage key: 'captured_comments'
{
  "cmt_<hash>": {
    id: "cmt_<hash>",
    authorName: "Jane Smith",
    text: "I disagree because...",
    timestamp: 1707350600,
    avatarUrl: "https://...",
    profileUrl: "https://...",
    likes: 12,
    platform: "substack",
    sourceUrl: "https://example.com/article",
    replyTo: null,                     // Parent comment ID (null = top-level)
    platformAccountId: "pacct_<hash>",
    capturedAt: 1707350700
  }
}
```

### 2.6 Cached Article

```javascript
// Storage key: 'article_cache_<urlHash>'
{
  url: "https://example.com/article",
  urlHash: "<16-char-hex>",
  content: "<p>Full HTML...</p>",
  textContent: "Full plain text...",
  title: "Article Title",
  byline: "Author Name",
  siteName: "Publication",
  domain: "example.com",
  publishedAt: 1707350400,
  featuredImage: "https://...",
  publicationIcon: "https://...",
  excerpt: "First 500 chars...",
  isPaywalled: false,
  contentType: "article",             // article | video | social_post | tweet
  platform: null,                     // youtube | twitter | substack | facebook | instagram | tiktok
  language: "en",
  keywords: ["politics"],
  wordCount: 2450,
  section: "Opinion",
  engagement: { likes: 0, shares: 0, comments: 0, views: 0 },
  tweetMeta: null,                    // { tweetId, authorHandle, isThread, threadLength }
  videoMeta: null,                    // { videoId, duration, channelName }
  substackMeta: null,
  transcript: null,
  transcriptTimestamped: null,
  description: null,
  platformAccount: null,
  cachedAt: 1713200000,               // When cached (ms)
  publishedToRelay: true,
  nostrEventId: "abc123...",
  captureCount: 1
}
```

### 2.7 Pending Capture

```javascript
// Storage key: 'pending_captures'
[
  {
    url: "https://facebook.com/post/123",
    platform: "facebook",
    contentType: "social_post",
    title: "Post by John Doe",
    blocks: [                          // Text blocks captured by user
      { text: "Post content...", label: "Selected text", timestamp: 1707350400 }
    ],
    savedAt: 1707350500,
    status: "pending"
  }
]
```

### 2.8 User Identity

```javascript
// Storage key: 'user_identity'
{
  pubkey: "<64-char-hex>",
  privkey: "<64-char-hex>",           // Only if locally generated/imported
  npub: "npub1...",
  nsec: "nsec1...",                    // Only if local
  name: "User Display Name",
  signer_type: "local",               // "local" | "nip07"
  created_at: 1707350400
}
```

### 2.9 Relay Configuration

```javascript
// Storage key: 'relay_config'
{
  relays: [
    { url: "wss://nos.lol", read: true, write: true, enabled: true },
    // ... 10 default relays
  ]
}
```

---

## Part 3: NOSTR Event Kinds

The system publishes 8 event kinds. All custom kinds are in the parameterized replaceable range (30000–39999), using `d` tags for deduplication.

### 3.1 Kind 0 — Entity Profile

Published from the **entity's own keypair**. For alias entities, includes `refers_to` tag.

```json
{
  "kind": 0,
  "pubkey": "<entity-hex-pubkey>",
  "created_at": 1707350400,
  "tags": [
    ["refers_to", "<canonical-npub>"]
  ],
  "content": "{\"name\":\"Larry Summers\",\"about\":\"person entity created by nostr-article-capture\"}",
  "id": "<sha256-hash>",
  "sig": "<schnorr-signature>"
}
```

**Notes**: `refers_to` tag is only present for alias entities (those with `canonical_id`). The event is signed with the entity's private key, not the user's.

### 3.2 Kind 30023 — Long-Form Content

Articles, videos, and social posts all published as kind 30023 with platform-aware tags. Content is in Markdown with a metadata header.

```json
{
  "kind": 30023,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
  "tags": [
    ["d", "<16-char-url-hash>"],
    ["title", "Article Title"],
    ["published_at", "1707350400"],
    ["r", "https://example.com/article"],
    ["client", "nostr-article-capture"],
    ["summary", "Article excerpt..."],
    ["image", "https://example.com/image.jpg"],
    ["author", "Author Name"],
    ["site_name", "Publication Name"],
    ["icon", "https://example.com/favicon.ico"],

    ["p", "<entity-pubkey>", "", "author"],
    ["person", "Author Name", "author"],
    ["p", "<entity-pubkey>", "", "mentioned"],
    ["org", "Organization Name", "mentioned"],

    ["claim", "Claim text", "factual"],
    ["claim", "Key claim text", "predictive", "crux"],

    ["word_count", "2450"],
    ["lang", "en"],
    ["section", "Opinion"],
    ["t", "politics"],
    ["t", "article"],
    ["t", "example-com"],
    ["paywalled", "true"],
    ["content_format", "article"],
    ["platform", "substack"],
    ["modified_at", "1707360000"],
    ["content_type", "Article"],

    ["video_id", "dQw4w9WgXcQ"],
    ["duration", "3:32"],
    ["channel", "Channel Name"],
    ["transcript", "true"],
    ["transcript_timestamped", "true"],
    ["has_description", "true"],

    ["tweet_id", "1234567890"],
    ["author_handle", "@elonmusk"],
    ["thread", "true"],
    ["thread_length", "5"],

    ["engagement_likes", "50000"],
    ["engagement_shares", "12000"],
    ["engagement_comments", "8000"]
  ],
  "content": "---\n**Source**: [Title](url)\n**Publisher**: Pub | **Author**: Author\n**Published**: Date | **Archived**: Date\n---\n\nFull markdown content..."
}
```

**`d` tag generation**: `Crypto.sha256(normalizedUrl).substring(0, 16)` — 16-char hex hash of the canonical URL.

**Content format**: Metadata header between `---` markers, then markdown body. For video content, includes `## Description` and `## Transcript` sections.

### 3.3 Kind 30040 — Claim Event

Individual claim with structured triple (claimant → predicate → object) and evidence metadata.

```json
{
  "kind": 30040,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
  "tags": [
    ["d", "claim_abc123"],
    ["r", "https://example.com/article"],
    ["title", "Article Title"],
    ["claim-text", "The unemployment rate dropped to 3.4%"],
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

When subject or object is freetext (no entity match), the `p` tag is omitted and only the text tag appears.

### 3.4 Kind 30041 — Comment/Statement

Individual captured comment with author, platform, thread structure.

```json
{
  "kind": 30041,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
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

### 3.5 Kind 30043 — Evidence Link

Cross-content claim relationship.

```json
{
  "kind": 30043,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
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

### 3.6 Kind 30078 — Entity Sync (NIP-78, NIP-44 Encrypted)

Encrypted entity data for cross-browser sync.

```json
{
  "kind": 30078,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
  "tags": [
    ["d", "<entity-id>"],
    ["client", "nostr-article-capture"],
    ["entity-type", "person"],
    ["L", "nac/entity-sync"],
    ["l", "v1", "nac/entity-sync"]
  ],
  "content": "<NIP-44 v2 encrypted base64 payload>"
}
```

**Encryption**: `conversation_key = HKDF-extract(salt="nip44-v2", ikm=ECDH(user_privkey, user_pubkey).x)`. Content is ChaCha20 encrypted with HMAC-SHA256 authentication and NIP-44 chunk-based padding. The user encrypts to their own pubkey (encrypt-to-self).

### 3.7 Kind 32125 — Entity Relationship

Links an entity to content with a typed relationship.

```json
{
  "kind": 32125,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
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

**Relationship types**: `author`, `mentioned`, `claimant`, `subject`, `object`.

### 3.8 Kind 32126 — Platform Account

Published platform identity fragment.

```json
{
  "kind": 32126,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1707350400,
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

## Part 4: Browser Extension Migration Guide

### 4.1 Why Browser Extension?

The Tampermonkey userscript approach has fundamental limitations that a browser extension solves:

| Limitation | Tampermonkey Impact | Extension Solution |
|-----------|--------------------|--------------------|
| **CSP blocks WebSocket** | Facebook/Instagram CSP blocks relay connections entirely | Background service worker makes relay connections (not subject to page CSP) |
| **CSP blocks innerHTML** | YouTube Trusted Types requires policy workaround | Extension CSP is separate; `chrome.webRequest` can modify page CSP headers |
| **No persistent background** | Relay connections die when page changes | Service worker persists, maintains connections |
| **CORS restrictions** | `GM_xmlhttpRequest` workaround needed | `fetch` from background script bypasses CORS |
| **Single-page injection** | All UI must be injected into page DOM | Popup, side panel, and DevTools panel are native UI surfaces |
| **No cross-origin messaging** | Cannot coordinate between tabs | `chrome.runtime.sendMessage` works across all contexts |
| **No native messaging** | Cannot invoke local tools (yt-dlp, etc.) | `chrome.runtime.connectNative` enables local tool integration |
| **Limited storage** | ~10MB GM storage, ~5MB localStorage | `chrome.storage.local` up to 10MB (or `unlimitedStorage` permission) + IndexedDB |

### 4.2 Architecture Mapping

| Tampermonkey Concept | Browser Extension Equivalent |
|---------------------|------------------------------|
| `GM_setValue` / `GM_getValue` | `chrome.storage.local` (async, JSON-serializable) |
| `GM_xmlhttpRequest` | `fetch()` from background service worker |
| `unsafeWindow` | Content script has DOM access; `chrome.scripting.executeScript` for dynamic injection |
| `@require` (CDN libraries) | Bundled dependencies in extension package |
| `@match *://*/*` | `manifest.json` → `content_scripts.matches` or `host_permissions` |
| Shadow DOM FAB | `chrome.action` popup, side panel, or injected overlay |
| `GM_addStyle` | Content script CSS injection via `chrome.scripting.insertCSS` or `<link>` in content script |
| Trusted Types policy | Extension's own CSP doesn't require it; can strip page's Trusted Types via `chrome.declarativeNetRequest` |
| `GM_registerMenuCommand` | `chrome.contextMenus.create` |
| `@run-at document-idle` | `"run_at": "document_idle"` in manifest content_scripts |

### 4.3 Recommended Extension File Structure

```
extension/
├── manifest.json                    # MV3 manifest
├── background/
│   └── service-worker.js            # Relay connections, NOSTR publishing, CORS-free fetch
├── content/
│   ├── content-script.js            # Page interaction — extraction, FAB, entity tagging
│   ├── capture-panel.js             # Side panel UI for social media capture
│   └── reader-view.html + .js + .css # Full reader view (opens in new tab or overlay)
├── popup/
│   ├── popup.html                   # Quick actions: pending captures, recent captures
│   └── popup.js
├── sidepanel/
│   ├── sidepanel.html               # Settings, entity browser, claim browser
│   └── sidepanel.js
├── shared/
│   ├── crypto.js                    # secp256k1, BIP-340, bech32, NIP-44 (REUSE DIRECTLY)
│   ├── storage.js                   # chrome.storage.local wrapper (REWRITE)
│   ├── event-builder.js             # All 8 kind builders (REUSE DIRECTLY)
│   ├── relay-client.js              # WebSocket client (MOVE TO background)
│   ├── entity-model.js              # Entity, alias, search logic
│   ├── claim-model.js               # Claim, evidence link logic
│   ├── platform-account-model.js    # Platform account CRUD
│   ├── content-extractor.js         # Readability + Turndown pipeline (MINOR ADAPTATION)
│   └── utils.js                     # escapeHtml, date helpers
├── platforms/                       # REUSE DIRECTLY — all platform handlers
│   ├── substack.js
│   ├── youtube.js
│   ├── twitter.js
│   ├── facebook.js
│   ├── instagram.js
│   └── tiktok.js
└── styles/
    ├── reader-view.css
    ├── capture-panel.css
    ├── popup.css
    └── sidepanel.css
```

### 4.4 Manifest V3

```json
{
  "manifest_version": 3,
  "name": "NOSTR Content Capture",
  "version": "1.0.0",
  "description": "Capture content from any website with entity tagging, claim extraction, and NOSTR publishing",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "contextMenus",
    "sidePanel",
    "declarativeNetRequest"
  ],
  "optional_permissions": [
    "unlimitedStorage"
  ],
  "host_permissions": [
    "*://*/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*/*"],
      "js": ["content/content-script.js"],
      "css": ["styles/content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "declarative_net_request": {
    "rule_resources": [{
      "id": "csp_rules",
      "enabled": true,
      "path": "rules/csp-rules.json"
    }]
  }
}
```

### 4.5 What to Reuse Directly

These modules are pure JavaScript with no browser-specific APIs (no DOM, no GM_*, no window access):

| Module | Lines | Notes |
|--------|-------|-------|
| `crypto.js` | ~600 | All secp256k1, BIP-340, bech32, NIP-44, ChaCha20. Uses only `crypto.subtle` and `crypto.getRandomValues` (available in service workers). |
| `event-builder.js` | ~550 | All 8 kind builders. Uses `Crypto` and `Storage` — just update imports. |
| `platforms/*.js` | ~300 each | Platform handlers. DOM access stays in content scripts — pass extracted DOM data to handlers. |
| `content-extractor.js` | ~940 | Readability + Turndown pipeline. Needs minor adaptation (Readability requires DOM cloning). |
| `content-detector.js` | ~140 | URL pattern matching + DOM analysis. Runs in content script. |

### 4.6 What Needs Rewriting

#### Storage Layer

Replace `GM_setValue`/`GM_getValue`/`localStorage` with `chrome.storage.local`:

```javascript
// Tampermonkey
await GM_setValue('entity_registry', JSON.stringify(registry));
const registry = JSON.parse(await GM_getValue('entity_registry', '{}'));

// Extension
await chrome.storage.local.set({ entity_registry: registry });
const { entity_registry } = await chrome.storage.local.get('entity_registry');
```

Key differences:
- `chrome.storage.local` stores JSON objects natively (no stringify/parse needed)
- Default 10MB quota (or unlimited with `unlimitedStorage` permission)
- Can use IndexedDB for article cache (much larger quota)
- `chrome.storage.onChanged` for reactive updates across contexts

#### Relay Client — Move to Background Service Worker

```javascript
// background/service-worker.js
const connections = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'relay:publish') {
    publishToRelays(msg.event, msg.relayUrls).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'relay:subscribe') {
    subscribeToRelays(msg.filter, msg.relayUrls, msg.options).then(sendResponse);
    return true;
  }
});

// Content script calls:
const results = await chrome.runtime.sendMessage({
  type: 'relay:publish',
  event: signedEvent,
  relayUrls: ['wss://nos.lol', 'wss://relay.primal.net']
});
```

**Why**: Background service worker is not subject to page CSP. WebSocket connections to relay servers work from any page, including Facebook and Instagram.

#### UI Layer

| Tampermonkey UI | Extension UI |
|----------------|-------------|
| Shadow DOM FAB (injected into page) | Content script injects minimal FAB; or use `chrome.action` icon with badge |
| Full-page reader view (DOM takeover) | Opens `reader-view.html` in a new tab, or uses `chrome.sidePanel` |
| Settings panel (injected overlay) | Side panel (`chrome.sidePanel.open`) |
| Entity browser (injected overlay) | Side panel tab |
| Capture panel (injected side panel) | `chrome.sidePanel` with platform-specific content |
| Toast notifications | `chrome.notifications.create` or injected DOM toasts |

#### Init Flow

```javascript
// Content script (content/content-script.js)
// Replaces init.js
async function init() {
  // Detect content type
  const detection = ContentDetector.detect();
  
  // Set badge on extension icon
  chrome.runtime.sendMessage({
    type: 'set-badge',
    platform: detection.platform,
    icon: ContentDetector.getPlatformIcon(detection.platform)
  });
  
  // Create FAB (optional — can use extension icon instead)
  createFAB(detection);
  
  // Check article cache
  const { article_cache_index } = await chrome.storage.local.get('article_cache_index');
  // ... archive badge logic
}

// Background service worker
chrome.action.onClicked.addListener(async (tab) => {
  // Send message to content script to extract
  chrome.tabs.sendMessage(tab.id, { type: 'capture' });
});
```

### 4.7 CSP Override via declarativeNetRequest

Create `rules/csp-rules.json` to strip restrictive CSP headers:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "content-security-policy",
          "operation": "remove"
        },
        {
          "header": "content-security-policy-report-only",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "urlFilter": "*",
      "resourceTypes": ["main_frame", "sub_frame"]
    }
  }
]
```

This eliminates the need for Trusted Types policies and allows innerHTML usage on any page.

### 4.8 Message Passing Architecture

```
┌─────────────────┐     chrome.runtime.sendMessage      ┌──────────────────┐
│  Content Script  │ ──────────────────────────────────→ │  Service Worker   │
│  (per tab)       │ ←────────────────────────────────── │  (background)     │
│                  │     chrome.tabs.sendMessage          │                   │
│  - FAB           │                                     │  - Relay client   │
│  - DOM extract   │                                     │  - Event signing  │
│  - Entity tag    │                                     │  - CORS-free fetch│
│  - Claim extract │                                     │  - Storage ops    │
└─────────────────┘                                      └──────────────────┘
        │                                                         │
        │ DOM access                                              │ chrome.storage
        ↓                                                         ↓
┌─────────────────┐                                      ┌──────────────────┐
│  Web Page DOM    │                                      │  Storage          │
│                  │                                      │  chrome.storage   │
│                  │                                      │  + IndexedDB      │
└─────────────────┘                                      └──────────────────┘
        
┌─────────────────┐     chrome.runtime.sendMessage      ┌──────────────────┐
│  Popup           │ ──────────────────────────────────→ │  Service Worker   │
│  (quick actions) │                                     │                   │
└─────────────────┘                                      └──────────────────┘
        
┌─────────────────┐     chrome.runtime.sendMessage      ┌──────────────────┐
│  Side Panel      │ ──────────────────────────────────→ │  Service Worker   │
│  (settings, etc) │                                     │                   │
└─────────────────┘                                      └──────────────────┘
```

### 4.9 Migration Priorities

1. **Core infrastructure**: Storage layer, crypto (copy), event builder (copy), relay client (move to background)
2. **Content extraction**: Content extractor, content detector, platform handlers in content scripts
3. **Basic UI**: FAB in content script, reader view as extension page, publish flow
4. **Entity system**: Entity CRUD, tagging popover, entity browser in side panel
5. **Claims system**: Claim extraction, evidence linking, claims bar
6. **Platform handlers**: Port each platform handler, test on live sites
7. **Archive reader**: Local cache, relay retrieval
8. **Advanced features**: API interception, module hook, anti-obfuscation

---

## Part 5: Lessons Learned

### Platform-Specific Insights

1. **Facebook/Instagram CSP blocks WebSocket connections** — The page's Content Security Policy prevents `new WebSocket('wss://relay.example.com')`. A browser extension's background service worker is the definitive solution — relay connections are never subject to page CSP.

2. **YouTube Trusted Types blocks innerHTML** — YouTube enforces `require-trusted-types-for 'script'`, which breaks Turndown.js and Readability.js (both use innerHTML internally). The Tampermonkey workaround is a `default` Trusted Types policy that passes strings through. An extension can strip the CSP header entirely via `declarativeNetRequest`.

3. **Facebook DOM is heavily obfuscated** — Class names are randomized and change frequently. Stable selectors: `role="article"`, `data-pagelet`, `data-testid`, structural nesting patterns. API interception (hooking `fetch()` to capture GraphQL responses) is the most reliable data source.

4. **TikTok `__NEXT_DATA__` is fragile** — TikTok embeds video metadata in a `<script id="__NEXT_DATA__">` JSON blob. This works today but breaks whenever TikTok changes their Next.js configuration.

### Architecture Insights

5. **User-assisted capture is more reliable than DOM scraping** — For obfuscated platforms, letting the user select text or click on a post container is the most robust extraction method. The click-to-select overlay with visual post boundary detection combines user intent with intelligent DOM walking.

6. **API interception is the most reliable data source for obfuscated platforms** — Hooking `fetch()` and `XMLHttpRequest` to capture structured API responses (Meta's GraphQL) provides clean, typed data regardless of DOM obfuscation. The data cache accumulates from page load, ready when the user clicks capture.

7. **Shadow DOM isolates UI from page styles** — A closed shadow root prevents page CSS from affecting the FAB and capture panel. This is essential on social media sites that use aggressive CSS resets and z-index stacking.

8. **Parallel relay publishing significantly reduces publish time** — `Promise.allSettled()` sends events to all relays concurrently. A 10-relay publish that would take 50 seconds sequentially (5s timeout each) completes in ~5 seconds.

### Storage & Performance Insights

9. **LRU cache with per-article keys prevents memory bloat** — Storing each cached article as a separate GM key (`article_cache_<urlHash>`) avoids loading all cached articles into memory for every operation. A lightweight index enables fast lookups.

10. **NIP-44 ChaCha20 encryption is implementable in pure JS** — The quarter-round function, block function, and stream cipher are straightforward to implement using `Uint32Array` and bitwise operations. HKDF-extract/expand use `SubtleCrypto` HMAC. Total implementation: ~180 lines.

11. **Compression fallback saves storage writes** — When `GM_setValue` fails (quota exceeded), `_compressForSave()` strips optional fields (articles arrays trimmed to 10, contexts truncated) and retries. This recovers many otherwise-fatal storage failures.

### Protocol Insights

12. **Parameterized replaceable events (NIP-33) are ideal for mutable data** — All 7 custom kinds use `d` tags, meaning relays automatically keep only the latest version per author + kind + d-tag. This provides natural deduplication and update semantics.

13. **NIP-44 padding hides content length** — Relay operators cannot determine entity data size from the encrypted payload, because NIP-44's chunk-based padding rounds up to predictable boundaries.

14. **Entity keypairs enable future delegation** — Each entity having its own secp256k1 keypair means that, in the future, users could export entity keypairs and share them for collaborative knowledge bases. The data model supports this today even though the feature is not yet implemented.
