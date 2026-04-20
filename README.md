# NOSTR Content Capture

![Version](https://img.shields.io/badge/version-3.12.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A Tampermonkey userscript that captures content from any website — articles, social media posts, YouTube videos, comments — extracts metadata, tags entities, identifies claims, and publishes to NOSTR relays. All cryptography — including secp256k1, BIP-340 Schnorr signing, NIP-44 v2 encryption, and bech32 encoding — is implemented from scratch with zero external crypto dependencies.

> 💡 **Prefer a browser extension?** A subset of this userscript has been ported to a Chrome/Firefox WebExtension (MV3):
> **[bryanmatthewsimonson/xray](https://github.com/bryanmatthewsimonson/xray)** — no userscript manager required.
> It covers article capture + URL-scoped metadata (annotations, fact-checks, ratings, comments, headline corrections) and is the development target for the platform work that will eventually live in the **Keystone** browser. The userscript here remains the richer, more actively-developed reference.

---

## 📥 Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/dist/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Content_Capture-3.12.0-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Content Capture" />
  </a>
</p>

**Prerequisites:** [Tampermonkey](https://www.tampermonkey.net/) browser extension.

The script auto-updates via `@updateURL` / `@downloadURL` in the userscript header. All dependencies are bundled via npm — no `@require` tags needed:

| Dependency | Version | Purpose |
|-----------|---------|---------|
| [@mozilla/readability](https://github.com/mozilla/readability) | ^0.6.0 | Article content extraction |
| [Turndown](https://github.com/mixmark-io/turndown) | ^7.2.2 | HTML → Markdown conversion |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown#gfm) | ^1.0.2 | GitHub-Flavored Markdown tables & strikethrough |

---

## 🌐 Supported Platforms

| Icon | Platform | Content Types | Capture Method |
|------|----------|---------------|----------------|
| 📰 | **Articles** (any website via Readability) | Article text, metadata, comments | Automatic |
| ✉️ | **Substack** newsletters | Articles, author bios, subscriber info, comments | Automatic |
| ▶️ | **YouTube** videos | Video metadata, transcripts (4 methods), embedded player, comments, engagement | Automatic |
| 𝕏 | **Twitter/X** | Tweets, threads, profiles, replies | Automatic (stable `data-testid` selectors) |
| f | **Facebook** posts | Post text, media, comments | User-assisted (click on post) |
| 📷 | **Instagram** posts and reels | Captions, media, comments | User-assisted (click on post) |
| ♪ | **TikTok** videos | Video metadata, captions, hashtags, comments, engagement | User-assisted (click on post) |

---

## ✨ Features

### 📰 Content Capture

- **One-click capture** via a floating action button (FAB) in a Shadow DOM container (with regular DOM fallback) — immune to page CSS interference
- **Platform-aware detection** — automatically identifies YouTube, Twitter/X, Facebook, Instagram, TikTok, Substack, or generic articles
- **Mozilla Readability** extracts title, author, date, and body from any article
- **Smart date detection** — JSON-LD, meta tags (`article:published_time`, `datePublished`), platform-specific selectors
- **Enhanced metadata** — word count, reading time, language, section, keywords, structured data (JSON-LD + OpenGraph), paywall detection
- **User-assisted capture** — Facebook, Instagram, and TikTok use a click-to-select flow: a semi-transparent overlay prompts the user to click on the specific post to capture, then walks up the DOM to find the post container
- **Platform-native styling** — captured Facebook, Instagram, and TikTok posts render with platform-specific styled HTML (`.nac-facebook-post`, `.nac-instagram-post`, `.nac-tiktok-post`)
- **`platformAccount` data model** — social platform handlers extract platform account identity (username, profileUrl, avatarUrl) as a separate `platformAccount` object, distinct from `byline`/author
- **Platform-specific extractors** — each platform has its own handler with tailored DOM selectors and metadata extraction
- **YouTube transcript extraction** — four methods: player API `getTranscript()`, timedtext API, `GM_xmlhttpRequest` CORS bypass, and DOM scraping with automatic fallback
- **YouTube video embed** — embedded player in reader view with responsive iframe
- **On-demand transcript loading** — "Load Transcript" button in reader view for deferred extraction
- **YouTube SPA navigation** — detects `yt-navigate-finish` events for seamless page transition support
- **Twitter/X thread detection** — captures multi-tweet threads by the same author as a single piece of content (DOM-based extraction with stable `data-testid` selectors)
- **Engagement metrics** — likes, shares, views, comments captured as evidentiary signals
- **Trusted Types CSP compatibility** — creates CSP-compliant Trusted Types policies for YouTube and Google domains
- **Quality-hardened platform handlers** — comprehensive try/catch wrapping with XSS prevention (`escapeHtml`) across all extractors

### 📝 Reader View

- **Full-page reader view** with clean typography and optimal reading width
- **WYSIWYG visual editor** — `contentEditable` rich-text editing directly in the reader view
- **Raw markdown editor** — toggle between visual and markdown mode (auto-resizing textarea)
- **Preview as Published** — HTML → markdown → HTML roundtrip to see exactly what NOSTR will display
- **Inline metadata editing** — click author, publication, date, or URL to edit in place; editing the author auto-creates or links a Person entity
- **Dark mode** support via `prefers-color-scheme`
- **Editable URL** — canonical URL displayed and editable; expanded tracking parameter cleanup (`utm_*`, `fbclid`, `gclid`, etc.)

### 🏷️ Entity System

- **Four entity types**: Person 👤, Organization 🏢, Place 📍, Thing 🔷
- **Text selection popover** — select text in content, choose entity type from a floating popover
- **Manual tagging** — add entities by name via the "+ Tag Entity" button
- **Auto-detection** — author (Person) and publication (Organization) automatically tagged on capture and when the author field is edited
- **Keypair per entity** — each entity gets its own secp256k1 keypair (npub/nsec) for NOSTR identity
- **Entity aliases** (`canonical_id`) — entities can be linked as aliases of a canonical entity, enabling deduplication across name variants
- **Auto-suggestion** — automatically detects known entities from your registry in content text (name + alias matching)
- **Entity discovery** — heuristic-based detection of proper nouns, organization names, places using capitalized phrase analysis
- **Suggestion bar** — accept or dismiss entity suggestions with one click
- **Entity browser** with search and type filtering (All / 👤 / 🏢 / 📍 / 🔷)
- **Entity detail view** — rename, manage aliases, view keypair (npub/nsec with copy), articles list
- **JSON export/import** for full entity registry backup and restore

### 📋 Claim Extraction

- **📋 Claim button** in the text selection popover — select any text and extract it as a claim
- **Claim types** — classify claims as Factual, Causal, Evaluative, or Predictive
- **Crux marking** — mark key claims as "crux" (the most important claims)
- **Confidence slider** — set confidence level (0–100%) on crux claims
- **Structured claim triples** — `[Subject] → [Predicate] → [Object]` with entity references or freetext
- **Sentence builder** — subject and object fields accept both entity selections and freetext input
- **Attribution types** — direct quote, paraphrase, editorial assertion, or article thesis
- **Quote date** — when the statement was made (distinct from article publish date)
- **Claims bar** — displays extracted claims with type badges, claimant labels, and crux indicators
- **Per-URL persistence** — claims stored per article URL and reloaded on revisit

### 🔗 Evidence Linking

- **🔗 button** on each claim opens the evidence linker modal
- **Cross-content linking** — link claims across different articles/posts as supporting, contradicting, or contextualizing evidence
- **Relationship types** — supports ✅, contradicts ❌, contextualizes 📎
- **Evidence indicators** — claims with evidence links show a 🔗 badge with link count
- **Evidence tooltips** — click the indicator to see all linked claims with source info

### 🌐 Social Features

- **🌐 button** in the claims bar fetches kind 30040 claim events from relays for the current URL
- **Grouped by publisher** — remote claims organized by npub, filtering out your own
- **Cross-user claim discovery** — see what claims others have extracted from the same content

### 💬 Comments Capture

- **Generic comment extractor** — captures comments from any website with recognizable comment sections
- **Platform-specific comment extractors** — Substack, YouTube, Twitter/X replies, Facebook, Instagram, TikTok
- **Comment system detection** — native, Disqus, and platform-specific formats
- **Thread structure** — reply relationships and nesting preserved
- **Platform accounts** — each unique commenter creates a Platform Account identity fragment
- **Account-entity linking** — platform accounts can be linked to Person entities in the registry
- **Comments section in reader view** — captured comments displayed below article content

### 📤 NOSTR Publishing

Eight event kinds are published:

| Kind | Purpose |
|------|---------|
| **0** | Entity profiles (with `refers_to` for aliases) |
| **30023** | Long-form content (articles, videos, social posts) |
| **30040** | Claims (structured triples, crux, confidence) |
| **30041** | Comments/Statements (individual captured comments) |
| **30043** | Evidence links (supports/contradicts/contextualizes) |
| **30078** | Entity sync (NIP-44 encrypted) |
| **32125** | Entity relationships (author, mentioned, claimant, subject) |
| **32126** | Platform accounts (published identity fragments) |

**Two signing methods:**

| Method | Description |
|--------|-------------|
| **NIP-07 Extension** | Browser extensions like nos2x or Alby — keys never leave the extension |
| **Local Keypair** | BIP-340 Schnorr signing with a locally generated or imported key |

- **Parallel relay publishing** via `Promise.allSettled()` — events sent to all selected relays concurrently
- **Event preview** — inspect the full event JSON before publishing
- **Content-type tags** — `content_format`, `platform`, video/tweet metadata tags on kind 30023
- **Engagement tags** — likes, shares, views captured as evidentiary signal tags

### 🔐 Crypto (built-in, no dependencies)

All cryptographic operations implemented in pure JavaScript:

| Primitive | Implementation |
|-----------|---------------|
| **secp256k1** | Key generation, public key derivation (BigInt field arithmetic) |
| **BIP-340 Schnorr** | Signing and verification |
| **Bech32** | Encoding/decoding (npub/nsec) via BIP-173 |
| **ECDH** | Shared secret derivation for NIP-44 conversation keys |
| **ChaCha20** | Stream cipher (RFC 7539 quarter-round) |
| **HKDF-SHA256** | Key derivation (extract + expand) |
| **HMAC-SHA256** | Message authentication with constant-time comparison |
| **NIP-44 v2** | Padded encryption (ChaCha20 + HMAC-SHA256 encrypt-then-MAC) |
| **NIP-04** | AES-256-CBC encrypt/decrypt (legacy, via Web Crypto `SubtleCrypto`) |
| **SHA-256** | Hashing via Web Crypto API |

### 💾 Storage

- **`GM_setValue` / `GM_getValue`** for persistent Tampermonkey storage with **`localStorage` fallback**
- **Storage quota monitoring** — color-coded display in settings (green → orange at 1 MB → red at 5 MB)
- **Size breakdown** — entities, identity, relays, claims, platform accounts shown separately
- **Compression fallback** — `_compressForSave()` strips optional fields when writes fail
- **Graceful error handling** — storage save failures show user-facing toasts

### 🎨 UI & Accessibility

- **Responsive design** — mobile-friendly FAB positioning and layout
- **Dark mode** — full `prefers-color-scheme` support
- **Shadow DOM FAB** — floating action button isolated from page CSS via closed shadow root (with regular DOM fallback), prevents overlays from hiding it
- **Platform-adaptive FAB icon** — 📰 for articles, 🎬 for videos, 🐦 for tweets, etc.
- **ARIA labels** on interactive elements (buttons, dialogs, entity chips, cards, filters)
- **Focus trap** within the reader view — Tab / Shift+Tab cycles through focusable elements
- **Panel stack Escape handling** — Escape closes the topmost overlay in order
- **`makeKeyboardAccessible()`** for non-button interactive elements
- **`:focus-visible` styling** for clear keyboard focus indicators

---

## 🚀 Usage

1. **Navigate** to any article, tweet, YouTube video, or social media post
2. **Click** the floating action button (bottom-right corner) — icon adapts to platform
3. **Read** the content in the clean reader view
4. **Edit metadata** — click author, publication, date, or URL to edit inline
5. **Toggle Edit mode** for content editing (visual WYSIWYG or raw markdown)
6. **Tag entities** — select text to tag people, orgs, places, or things
7. **Extract claims** — select text and click 📋 Claim with type classification and crux marking
8. **Capture comments** — click the comments button to extract comments from the page
9. **Preview as Published** — check the final markdown roundtrip format
10. **Publish** — click Publish → select relays and signing method → publish to NOSTR
11. **Settings** — manage identity (generate, import nsec, NIP-07), relays, entities, sync

---

## 🏗️ Architecture

Modular ES modules compiled via esbuild into a single Tampermonkey userscript (~11,400 lines across 30 source files):

```
src/
├── config.js                  # Configuration constants and shared state
├── trusted-types.js           # Trusted Types CSP policy creation
├── crypto.js                  # secp256k1, BIP-340, bech32, NIP-04, NIP-44
├── storage.js                 # GM_setValue/localStorage persistence, CRUD
├── utils.js                   # escapeHtml, showToast, log, accessibility
├── content-extractor.js       # Readability + Turndown pipeline
├── content-detector.js        # Platform detection (URL + DOM analysis)
├── platform-handler.js        # Platform handler registry
├── platform-account.js        # Platform account CRUD, entity linking
├── comment-extractor.js       # Generic comment extraction
├── claim-extractor.js         # Enriched claims, types, crux, claims bar
├── evidence-linker.js         # Cross-content evidence linking
├── entity-tagger.js           # Text selection popover, entity chips
├── entity-auto-suggest.js     # Known entity matching, discovery
├── entity-browser.js          # Entity management UI
├── entity-sync.js             # NIP-44 encrypted push/pull
├── entity-migration.js        # Legacy alias migration
├── event-builder.js           # Kinds 0/30023/30040/30041/30043/30078/32125/32126
├── relay-client.js            # WebSocket relay client with retry
├── reader-view.js             # Full-page reader view UI
├── styles.js                  # All CSS (dark mode, responsive)
├── init.js                    # FAB creation, Shadow DOM, startup
├── index.js                   # Entry point
├── header.js                  # Tampermonkey ==UserScript== block
└── platforms/
    ├── substack.js            # Substack article + comments extractor
    ├── youtube.js             # YouTube video + transcript + comments
    ├── twitter.js             # Twitter/X tweets, threads, replies
    ├── facebook.js            # Facebook posts + comments (best-effort)
    ├── instagram.js           # Instagram posts/reels + comments
    └── tiktok.js              # TikTok videos + comments
```

### Build System

[`build.js`](build.js) uses esbuild to bundle all ES modules into a single IIFE userscript. Dependencies (Readability, Turndown, turndown-plugin-gfm) are installed via npm and bundled into the output — no external `@require` tags:

```bash
npm install      # install bundled dependencies
npm run build    # → dist/nostr-article-capture.user.js
npm run watch    # → rebuild on file changes
```

Output: [`dist/nostr-article-capture.user.js`](dist/nostr-article-capture.user.js) — a single self-contained file with the Tampermonkey header from [`src/header.js`](src/header.js).

---

## 📋 NOSTR Event Kinds

| Kind | Name | Usage |
|------|------|-------|
| **0** | Profile Metadata (NIP-01) | Optional public identity for entities; alias entities include `["refers_to", canonical_npub]` |
| **30023** | Long-form Content (NIP-23) | Articles, videos, social posts in Markdown with entity `p` tags, claim summary tags, platform/engagement tags |
| **30040** | Claim Event | Individual claim with claimant/subject/object `p` tags, predicate, quote-date, attribution type, confidence, crux flag |
| **30041** | Comment/Statement | Individual captured comment with author, platform, thread structure, engagement |
| **30043** | Evidence Link | Cross-content claim relationship: supports, contradicts, or contextualizes |
| **30078** | Application Data (NIP-78) | Encrypted entity sync (NIP-44 v2 encrypt-to-self; NIP-04 fallback on read) |
| **32125** | Entity Relationship | Links an entity to content with a typed relationship (author, mentioned, claimant, subject) |
| **32126** | Platform Account | Published platform identity fragment with username, platform, entity linkage |

### Extended Kind 30023 — Content with Platform Metadata

Articles, videos, and social posts are all published as kind 30023 with additional platform-aware tags:

```json
{
  "kind": 30023,
  "tags": [
    ["d", "<url-hash>"],
    ["title", "Video Title"],
    ["content_format", "video"],
    ["platform", "youtube"],
    ["video_id", "dQw4w9WgXcQ"],
    ["duration", "3:32"],
    ["channel", "Channel Name"],
    ["transcript", "true"],
    ["engagement_likes", "50000"],
    ["engagement_views", "5000000"],
    ["word_count", "1250"],
    ["lang", "en"],
    ["client", "nostr-article-capture"]
  ],
  "content": "Full content in markdown..."
}
```

### Claim Events (Kind 30040)

```json
{
  "kind": 30040,
  "tags": [
    ["d", "claim_abc123"],
    ["r", "https://example.com/article"],
    ["claim-text", "The unemployment rate dropped to 3.4%"],
    ["claim-type", "factual"],
    ["attribution", "direct_quote"],
    ["confidence", "85"],
    ["crux", "true"],
    ["p", "<claimant-pubkey>", "", "claimant"],
    ["claimant", "Larry Summers"],
    ["p", "<subject-pubkey>", "", "subject"],
    ["subject", "Federal Reserve"],
    ["predicate", "dropped to"],
    ["quote-date", "2024-01-15"],
    ["client", "nostr-article-capture"]
  ],
  "content": "surrounding context text"
}
```

### Comment Events (Kind 30041)

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

### Platform Account Events (Kind 32126)

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

### Evidence Links (Kind 30043)

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

### Entity Relationships (Kind 32125)

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
    ["client", "nostr-article-capture"]
  ],
  "content": ""
}
```

---

## 📜 NIPs Used

| NIP | Name | Usage |
|-----|------|-------|
| **NIP-01** | Basic Protocol | Event structure, relay communication (EVENT, OK, NOTICE, REQ, CLOSE) |
| **NIP-04** | Encrypted Direct Messages | Legacy AES-256-CBC encryption (fallback for reading older entity sync events) |
| **NIP-07** | Browser Extension Signing | `window.nostr.signEvent()` and `window.nostr.getPublicKey()` integration |
| **NIP-19** | Bech32 Encoding | `npub` / `nsec` key encoding and decoding |
| **NIP-23** | Long-form Content | Kind 30023 events for articles, videos, social posts |
| **NIP-32** | Labels | `L`/`l` label tags on entity sync events for app-specific categorization |
| **NIP-33** | Parameterized Replaceable | Kinds 30023, 30040, 30041, 30043, 30078, 32125, 32126 — all replaceable by `d` tag |
| **NIP-44** | Versioned Encryption | v2 padded encryption (ChaCha20 + HMAC-SHA256) for entity sync |
| **NIP-78** | Application-specific Data | Kind 30078 events for storing encrypted entity data on relays |

---

## 🌐 Default Relays

Pre-configured with 10 public relays:

`wss://nos.lol` · `wss://relay.primal.net` · `wss://relay.nostr.net` · `wss://nostr.mom` · `wss://relay.nostr.bg` · `wss://nostr.oxtr.dev` · `wss://relay.snort.social` · `wss://offchain.pub` · `wss://nostr-pub.wellorder.net` · `wss://nostr.fmt.wiz.biz`

---

## 🧪 Testing

| File | Tests | Coverage |
|------|-------|----------|
| [`tests/crypto-tests.js`](tests/crypto-tests.js) | 65 | secp256k1 key generation, BIP-340 Schnorr vectors, bech32 encode/decode, SHA-256, ECDH, NIP-04, event signing |
| [`tests/nip44-test.js`](tests/nip44-test.js) | 5 | ChaCha20 RFC 7539 vectors, NIP-44 padding, pad/unpad roundtrip, encrypt/decrypt roundtrip, HMAC tamper detection |

```bash
npm test
# runs: node tests/crypto-tests.js && node tests/nip44-test.js
```

---

## 📁 Project Structure

```
nostr-article-capture/
├── src/                                   # ES module source (30 files, ~11,400 lines)
│   ├── index.js                           # Entry point
│   ├── header.js                          # Tampermonkey ==UserScript== block
│   ├── init.js                            # FAB creation, Shadow DOM, startup
│   ├── config.js, crypto.js, storage.js, utils.js, trusted-types.js
│   ├── content-extractor.js, content-detector.js
│   ├── platform-handler.js, platform-account.js
│   ├── comment-extractor.js, claim-extractor.js
│   ├── evidence-linker.js, entity-tagger.js
│   ├── entity-auto-suggest.js, entity-browser.js
│   ├── entity-sync.js, entity-migration.js
│   ├── event-builder.js, relay-client.js
│   ├── reader-view.js, styles.js
│   └── platforms/
│       ├── substack.js, youtube.js, twitter.js
│       ├── facebook.js, instagram.js, tiktok.js
├── dist/
│   └── nostr-article-capture.user.js      # Compiled output (committed)
├── build.js                               # esbuild build script
├── package.json                           # Build and test scripts
├── tests/
│   ├── crypto-tests.js                    # 65 crypto tests
│   └── nip44-test.js                      # 5 NIP-44 tests
├── docs/                                  # Documentation
│   ├── data-model.md                      # Entity, claim, comment, platform account data structures
│   ├── nostr-nips-analysis.md             # NIP usage and rationale
│   ├── entity-hierarchy-design.md         # Entity alias system design
│   ├── entity-sync-design.md              # NIP-78 encrypted sync protocol
│   ├── article-data-collection.md         # Article capture field reference
│   ├── article-complete-inventory.md      # Full inventory of captured data
│   └── tampermonkey-article-capture-plan.md  # Original v1 plan
├── plans/
│   ├── v3-expansion-plan.md               # v3 architecture and expansion plan
│   └── v2-redesign-plan.md                # v2 design decisions (historical)
└── README.md
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Data Model](docs/data-model.md) | Entity, claim, comment, platform account, and evidence data structures |
| [Entity Hierarchy Design](docs/entity-hierarchy-design.md) | Entity alias system and canonical_id design |
| [Entity Sync Design](docs/entity-sync-design.md) | NIP-78 encrypted sync protocol (NIP-44 + NIP-04 fallback) |
| [NOSTR NIPs Analysis](docs/nostr-nips-analysis.md) | NIP usage and rationale |
| [Article Data Collection](docs/article-data-collection.md) | Article capture field reference |
| [v3 Expansion Plan](plans/v3-expansion-plan.md) | v3 architecture, platform extractors, data model |
| [v2 Redesign Plan](plans/v2-redesign-plan.md) | v2 design decisions (historical — superseded by v3) |

---

## 🔗 Related Projects

- [Readability](https://github.com/mozilla/readability) — Article content extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion
- [esbuild](https://esbuild.github.io/) — JavaScript bundler

---

## 📄 License

MIT License
