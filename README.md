# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A Tampermonkey userscript that captures web articles into a clean reader view with entity tagging, claim extraction, WYSIWYG and markdown editing, and publishes long-form content to the NOSTR network as kind 30023 events. All cryptography — including secp256k1, BIP-340 Schnorr signing, NIP-44 v2 encryption, and bech32 encoding — is implemented from scratch with zero external crypto dependencies.

---

## 📥 Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Article_Capture-2.6.0-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Article Capture" />
  </a>
</p>

**Prerequisites:** [Tampermonkey](https://www.tampermonkey.net/) browser extension.

The script auto-updates via `@updateURL` / `@downloadURL` in the userscript header and bundles three `@require` dependencies automatically:

| Dependency | Purpose |
|-----------|---------|
| [@mozilla/readability](https://github.com/mozilla/readability) 0.5.0 | Article content extraction |
| [Turndown](https://github.com/mixmark-io/turndown) 7.2.0 | HTML → Markdown conversion |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown#gfm) 1.0.2 | GitHub-Flavored Markdown tables & strikethrough |

---

## ✨ Features

### 📰 Article Capture & Reader

- **One-click capture** via a floating action button (📰 FAB) in the bottom-right corner
- **Mozilla Readability** extracts title, author, date, and body from any webpage
- **Smart date detection** — JSON-LD, meta tags (`article:published_time`, `datePublished`), platform-specific selectors (Substack, Medium, WordPress)
- **Full-page reader view** with clean typography and optimal reading width
- **Dark mode** support
- **Inline metadata editing** — click author, publication, or date to edit in place
- **Editable URL** — canonical URL is displayed and editable; expanded tracking parameter cleanup (`utm_*`, `fbclid`, `gclid`, etc.)

### ✏️ Editing

- **WYSIWYG visual editor** — `contentEditable` rich-text editing directly in the reader view
- **Raw markdown editor** — toggle between visual and markdown mode (auto-resizing textarea)
- **Preview as Published** — HTML → markdown → HTML roundtrip to see exactly what NOSTR will display
- **Editable fields** — title, author, publication, date, URL, and body

### 🏷️ Entity Tagging

- **Four entity types**: Person 👤, Organization 🏢, Place 📍, Thing 🔷
- **Text selection popover** — select text in the article, choose entity type from a floating popover
- **Manual tagging** — add entities by name via the "+ Tag Entity" button
- **Auto-detection** — author (Person) and publication (Organization) are automatically tagged on capture
- **Keypair per entity** — each entity gets its own secp256k1 keypair (npub/nsec) for future NOSTR identity
- **Entity aliases** (`canonical_id`) — entities can be linked as aliases of a canonical entity; alias entities carry `canonical_id` pointing to the primary entity, enabling deduplication across name variants
- **Auto-suggestion** — automatically detects known entities from your registry in article text (name + alias matching)
- **Entity discovery** — heuristic-based detection of proper nouns, organization names, places, and other entities using capitalized phrase analysis
- **Suggestion bar** — accept or dismiss entity suggestions with one click; known entities link directly, new entities are created with guessed type
- **Known entity auto-recognition** — previously tagged entities are automatically recognized when their name or any alias appears in new articles

### 📋 Claim Extraction

- **📋 Claim button** in the text selection popover — select any text and extract it as a claim
- **Claim types** — classify claims as Factual, Causal, Evaluative, or Predictive
- **Crux marking** — mark key claims as "crux" (the most important claims in an article)
- **Confidence slider** — set confidence level (0–100%) on crux claims
- **Enriched claims** — each claim captures:
  - **Claimant** — who made the claim (linked to an entity from the registry)
  - **Subjects** — what the claim is about (one or more entities)
  - **Objects** — what is asserted about the subject (e.g., "woke" in "Anthropic is woke")
  - **Predicate** — relationship verb between subject and object ("is", "funds", "causes")
  - **Quote date** — when the statement was made (distinct from article publish date)
  - **Attribution type** — direct quote, paraphrase, editorial assertion, or article thesis
  - **Structured claim triples** — `[Subject] → [Predicate] → [Object]` with entity references
- **Claims bar** — displays extracted claims with type badges, claimant labels, subject icons, and crux indicators below the article
- **Click-to-toggle crux** — click any claim chip to toggle its crux status
- **Per-URL persistence** — claims are stored per article URL and reloaded on revisit
- **Claims published as kind 30040** — each claim is published as its own replaceable event with `claimant`/`subject` p-tags, `attribution`, `confidence`, and `crux` markers

### 🌐 View Others' Claims

- **🌐 button** in the claims bar fetches kind 30040 claim events from relays for the current article URL
- **Grouped by publisher** — remote claims are organized by npub, filtering out your own
- **Cross-user claim discovery** — see what claims others have extracted from the same article

### 🔗 Evidence Linking

- **🔗 button** on each claim opens the evidence linker modal
- **Cross-article linking** — link claims across different articles as supporting, contradicting, or contextualizing evidence
- **Relationship types** — supports ✅, contradicts ❌, contextualizes 📎
- **Evidence indicators** — claims with evidence links show a 🔗 badge with link count
- **Evidence tooltips** — click the indicator to see all linked claims with source info
- **Published as kind 30043** — evidence links are published during article publish, linking source and target claims with relationship type

### 📋 Entity Management (Settings)

- **Entity browser** with search and type filtering (All / 👤 / 🏢 / 📍 / 🔷)
- **Entity detail view** — rename, manage aliases, view keypair (npub/nsec with copy), articles list
- **Canonical reference display** — alias entities show their canonical parent; parent entities list their known aliases
- **Set as alias of…** — search and link an entity as an alias of another entity, with circular reference prevention
- **Entity delete** with confirmation dialog
- **JSON export/import** for full entity registry backup and restore

### 📤 NOSTR Publishing

- **Kind 30023** long-form article events (NIP-23) with Markdown body, entity `p` tags, and `claim` summary tags
- **Kind 30040** claim events — each claim published as its own replaceable event with claimant/subject p-tags and attribution metadata
- **Kind 30043** evidence link events — cross-article claim relationships (supports/contradicts/contextualizes)
- **Kind 32125** entity relationship events — published during article publish, linking entities to articles with typed relationships (author, mentioned, claimant, subject)
- **Kind 0** profile metadata events (optional, for entity public names); alias entities include `["refers_to", canonical_npub]` tags
- **Kind 30078** entity sync events (NIP-78, NIP-44 v2 encrypted)
- **Alias entity resolution** — when an alias entity is tagged, the canonical entity's pubkey is also included in `p` tags
- **Two signing methods:**

| Method | Description |
|--------|-------------|
| **NIP-07 Extension** | Browser extensions like nos2x or Alby — keys never leave the extension |
| **Local Keypair** | BIP-340 Schnorr signing with a locally generated or imported key |

- **Parallel relay publishing** via `Promise.allSettled()` — events are sent to all selected relays concurrently
- **Event preview** — inspect the full event JSON before publishing

### 🌐 Relay Management

- **Add / remove / toggle** relays in settings
- **Connection retry** with exponential backoff (3 retries: 1 s → 2 s → 4 s)
- **Stale WebSocket detection** — `CLOSING` / `CLOSED` sockets are discarded and reconnected automatically
- **NOTICE message handling** — relay NOTICE messages are logged during publish
- **WebSocket cleanup** — all connections are closed when the reader view is dismissed

### 🔄 Entity Sync

- **Push / Pull** entities across browsers via encrypted NIP-78 (kind 30078) events
- **NIP-44 v2 encrypt-to-self** — entity data encrypted with ChaCha20, HKDF-SHA256 key derivation, and HMAC-SHA256 authentication
- **NIP-04 backward compatibility** — pull decrypts NIP-44 first, falls back to NIP-04 AES-256-CBC for older events
- **Smart merge** — last-write-wins on `updated` timestamp; article arrays merged by URL union
- **nsec import/export** — share your identity across browsers
- **Entity alias migration** — automatic one-time migration converts legacy inline `aliases[]` strings to separate alias entities with their own keypairs and `canonical_id` links

### 🔐 Crypto (built-in, no dependencies)

All cryptographic operations are implemented in pure JavaScript — no external crypto libraries:

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

- **`GM_setValue` / `GM_getValue`** for persistent Tampermonkey storage
- **Storage quota monitoring** — color-coded display in settings (green → orange at 1 MB → red at 5 MB)
- **Size breakdown** — entities, identity, relays, and claims shown separately
- **Graceful error handling** — storage save failures show user-facing toasts
- **Claims storage** — claims stored per article URL in `article_claims` key

### ♿ Accessibility

- **31 ARIA labels** on interactive elements (buttons, dialogs, entity chips, cards, filters)
- **Focus trap** within the reader view — Tab / Shift+Tab cycles through focusable elements
- **Keyboard navigation** — all interactive elements reachable via Tab
- **Panel stack Escape handling** — Escape closes the topmost overlay in order: popover → settings → publish → reader
- **Enter / Space keyboard activation** for all non-button interactive elements via `makeKeyboardAccessible()`
- **`:focus-visible` styling** on 22 element selectors for clear keyboard focus indicators
- **`role="dialog"`** on overlay panels (reader view, settings, publish)
- **`role="button"`** and `tabindex="0"` on clickable non-button elements (entity cards, editable fields)
- **Focus return** — closing a panel returns focus to the element that opened it

---

## 🚀 Usage

1. **Navigate** to any article page
2. **Click** the floating **📰** button (bottom-right corner)
3. **Read** the article in the clean reader view
4. **Edit metadata** — click author, publication, date, or URL to edit inline
5. **Toggle Edit mode** for content editing (visual WYSIWYG or raw markdown)
6. **Tag entities** — select text to tag people, orgs, places, or things; or use "+ Tag Entity"
7. **Extract claims** — select text and click 📋 Claim to extract claims with type classification and crux marking
8. **Preview as Published** — check the final markdown roundtrip format
9. **Publish** — click Publish → select relays and signing method → publish to NOSTR (claims included as tags)
10. **Settings** — manage identity (generate, import nsec, NIP-07), relays, entities, sync

---

## 🏗️ Architecture

The userscript is a single self-contained file (~7,722 lines) organized into 17 sections:

| # | Section | Lines | Description |
|---|---------|-------|-------------|
| 1 | **Configuration** | ~35 | Default relays, reader settings, extraction limits, tagging config |
| 2 | **Crypto** | ~600 | secp256k1 curve primitives, Bech32 (BIP-173), BIP-340 Schnorr signing, SHA-256, HMAC, HKDF, ChaCha20, NIP-04, NIP-44 v2 |
| 3 | **Storage** | ~270 | `GM_setValue`/`GM_getValue` persistence, entity registry CRUD, claims CRUD, evidence links CRUD, storage quota estimation |
| 4 | **Content Extraction** | ~530 | Readability integration, smart date detection, Turndown markdown conversion, markdown-to-HTML rendering, canonical URL detection |
| 5 | **Utilities** | ~50 | Formatting helpers, HTML sanitization, `makeKeyboardAccessible()` |
| 6 | **Entity Tagger** | ~225 | Text selection popover, entity type picker, chip rendering, auto-detection, claim button integration |
| 6C | **Claim Extractor** | ~620 | Enriched claim form (claimant, subjects, attribution), claim types, crux/confidence, claims bar, remote claim fetching (🌐), per-URL persistence |
| 6D | **Evidence Linker** | ~230 | Cross-article evidence linking modal (supports/contradicts/contextualizes), evidence indicators, tooltips, kind 30043 publishing |
| 6B | **EntityAutoSuggest** | ~265 | Known entity matching (name + alias, word-boundary regex), new entity discovery (capitalized phrases, quoted names, type heuristics), suggestion bar UI |
| 7 | **Relay Client** | ~180 | WebSocket connections with retry/backoff, NIP-01 message handling, parallel publish, subscribe |
| 8 | **Event Builder** | ~220 | Kind 0 (profile), kind 30023 (article), kind 30040 (claim), kind 30043 (evidence link), kind 30078 (entity sync), kind 32125 (entity relationship) construction |
| 8.5 | **Entity Sync** | ~200 | NIP-44 encrypted push/pull, NIP-04 fallback decryption, last-write-wins merge |
| 9 | **Reader View** | ~1,300 | Full-page takeover UI, edit modes, preview, dark mode, inline field editing, entity bar, claims bar, evidence links, focus trap, keyboard shortcuts |
| 9B | **Entity Browser** | ~575 | Search, filter, entity cards, detail view with alias/keypair management, canonical reference UI, set-as-alias, entity delete |
| 10 | **Styles** | ~2,230 | All CSS injected via `GM_addStyle` (dark theme, focus-visible, responsive, claim styles, evidence linker styles) |
| 10B | **Entity Alias Migration** | ~80 | Auto-migration from legacy inline `aliases[]` to separate alias entities with keypairs and `canonical_id` |
| 11 | **Initialization** | ~65 | FAB creation, `GM_registerMenuCommand`, entity migration, startup |

---

## 📋 NOSTR Event Kinds

| Kind | Name | Usage |
|------|------|-------|
| **0** | Profile Metadata (NIP-01) | Optional public identity for entities; alias entities include `["refers_to", canonical_npub]` |
| **30023** | Long-form Article (NIP-23) | Published article content in Markdown with entity `p` tags and summary `claim` tags |
| **30040** | Claim Event | Individual claim with claimant/subject/object `p` tags, predicate, quote-date, attribution type, confidence, crux flag |
| **30043** | Evidence Link | Cross-article claim relationship: supports, contradicts, or contextualizes |
| **30078** | Application Data (NIP-78) | Encrypted entity sync (NIP-44 v2 encrypt-to-self; NIP-04 fallback on read) |
| **32125** | Entity Relationship | Links an entity to an article with a typed relationship (author, mentioned, claimant, subject) |

### Claim Events (Kind 30040)

Each claim is published as its own replaceable event with enriched metadata:

```json
{
  "kind": 30040,
  "tags": [
    ["d", "claim_abc123"],
    ["r", "https://example.com/article"],
    ["claim", "The unemployment rate dropped to 3.4% in January", "factual"],
    ["attribution", "direct_quote"],
    ["confidence", "85"],
    ["p", "<claimant-entity-pubkey>", "", "claimant"],
    ["claimant", "Larry Summers"],
    ["p", "<subject-entity-pubkey>", "", "subject"],
    ["subject", "Federal Reserve"],
    ["p", "<object-entity-pubkey>", "", "object"],
    ["object", "unemployment rate"],
    ["predicate", "dropped to"],
    ["quote-date", "2024-01-15"],
    ["client", "nostr-article-capture"]
  ],
  "content": "surrounding context text"
}
```

### Evidence Links (Kind 30043)

Cross-article claim relationships:

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

Published during article publish, one per entity-article-relationship:

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

### Summary Claim Tags in Kind 30023

Claims are also embedded as summary tags in the article event:

```json
["claim", "The unemployment rate dropped to 3.4% in January", "factual"]
["claim", "This policy will lead to economic growth by 2028", "predictive", "crux"]
```

---

## 📜 NIPs Used

| NIP | Name | Usage |
|-----|------|-------|
| **NIP-01** | Basic Protocol | Event structure, relay communication (EVENT, OK, NOTICE, REQ, CLOSE) |
| **NIP-04** | Encrypted Direct Messages | Legacy AES-256-CBC encryption (fallback for reading older entity sync events) |
| **NIP-07** | Browser Extension Signing | `window.nostr.signEvent()` and `window.nostr.getPublicKey()` integration |
| **NIP-19** | Bech32 Encoding | `npub` / `nsec` key encoding and decoding |
| **NIP-23** | Long-form Content | Kind 30023 article events with `title`, `summary`, `published_at`, `d`, `claim` tags |
| **NIP-32** | Labels | `L`/`l` label tags on entity sync events for app-specific categorization |
| **NIP-33** | Parameterized Replaceable | Kinds 30023, 30040, 30043, 30078, 32125 — all replaceable by `d` tag |
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
| [tests/crypto-tests.js](tests/crypto-tests.js) | 65 | secp256k1 key generation, BIP-340 Schnorr vectors, bech32 encode/decode, SHA-256, ECDH, NIP-04, event signing |
| [tests/nip44-test.js](tests/nip44-test.js) | 5 | ChaCha20 RFC 7539 vectors, NIP-44 padding, pad/unpad roundtrip, encrypt/decrypt roundtrip, HMAC tamper detection |

Run tests:

```bash
node tests/crypto-tests.js
node tests/nip44-test.js
```

---

## 📁 Project Structure

```
nostr-article-capture/
├── nostr-article-capture.user.js   # Main userscript (~7,722 lines)
├── README.md
├── docs/
│   ├── article-complete-inventory.md
│   ├── article-data-collection.md
│   ├── data-model.md
│   ├── entity-hierarchy-design.md
│   ├── entity-sync-design.md
│   ├── nostr-nips-analysis.md
│   └── tampermonkey-article-capture-plan.md
├── plans/
│   └── v2-redesign-plan.md
└── tests/
    ├── crypto-tests.js              # 65 crypto tests
    └── nip44-test.js                # 5 NIP-44 tests
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Data Model](docs/data-model.md) | Entity, claim, and article data structures |
| [Entity Hierarchy Design](docs/entity-hierarchy-design.md) | Entity alias system and canonical_id design |
| [Entity Sync Design](docs/entity-sync-design.md) | NIP-78 encrypted sync protocol (NIP-44 + NIP-04 fallback) |
| [NOSTR NIPs Analysis](docs/nostr-nips-analysis.md) | NIP usage and rationale |
| [Article Data Collection](docs/article-data-collection.md) | Article capture field reference |
| [Article Complete Inventory](docs/article-complete-inventory.md) | Full inventory of captured article data |
| [Tampermonkey Plan](docs/tampermonkey-article-capture-plan.md) | Original project plan |
| [v2 Redesign Plan](plans/v2-redesign-plan.md) | v2 architecture redesign plan |

---

## 🔗 Related Projects

- [Readability](https://github.com/mozilla/readability) — Article content extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion

---

## 📄 License

MIT License
