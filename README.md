# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-2.10.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A Tampermonkey userscript that captures articles from any website, extracts metadata, tags entities, identifies claims with evidence linking, and publishes to NOSTR relays. All cryptography — including secp256k1, BIP-340 Schnorr signing, NIP-44 v2 encryption, and bech32 encoding — is implemented from scratch with zero external crypto dependencies.

> 🚀 **Successor Project — X-Ray Browser Extension**
> Multi-platform capture (social media, video, etc.) has moved to a dedicated browser extension:
> **[bryanmatthewsimonson/xray](https://github.com/bryanmatthewsimonson/xray)** — Chrome/Firefox WebExtension (MV3), no userscript manager required.
> X-Ray covers article capture, URL-scoped metadata (annotations, fact-checks, ratings, comments, headline corrections), and is the active development target for platform-specific capture. This userscript remains the focused, stable article-capture tool.

---

## 📥 Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Article_Capture-2.10.0-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Article Capture" />
  </a>
</p>

**Prerequisites:** [Tampermonkey](https://www.tampermonkey.net/) browser extension.

The script auto-updates via `@updateURL` / `@downloadURL` in the userscript header. External dependencies are loaded via CDN `@require` tags:

| Dependency | Version | Purpose |
|-----------|---------|---------|
| [@mozilla/readability](https://github.com/mozilla/readability) | 0.5.0 | Article content extraction |
| [Turndown](https://github.com/mixmark-io/turndown) | 7.2.0 | HTML → Markdown conversion |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown#gfm) | 1.0.2 | GitHub-Flavored Markdown tables & strikethrough |

---

## ✨ Features

### 📰 Article Capture

- **One-click capture** via a floating action button (FAB) in a Shadow DOM container — immune to page CSS interference
- **Mozilla Readability** extracts title, author, date, and body from any article
- **Smart date detection** — JSON-LD, meta tags (`article:published_time`, `datePublished`)
- **Trusted Types CSP compatibility** — works on sites with strict Content Security Policy headers
- **Editable URL** — canonical URL displayed and editable; tracking parameter cleanup

### 📝 Reader View

- **Full-page reader view** with clean typography and optimal reading width
- **WYSIWYG visual editor** — `contentEditable` rich-text editing directly in the reader view
- **Raw markdown editor** — toggle between visual and markdown mode (auto-resizing textarea)
- **Preview as Published** — HTML → markdown → HTML roundtrip to see exactly what NOSTR will display
- **Inline metadata editing** — click author, publication, date, or URL to edit in place
- **Dark mode** support via `prefers-color-scheme`
- **Mobile responsive** — adaptive layout for mobile and tablet screens

### 🏷️ Entity System

- **Four entity types**: Person 👤, Organization 🏢, Place 📍, Thing 🔷
- **Text selection popover** — select text in content, choose entity type from a floating popover
- **Manual tagging** — add entities by name via the "+ Tag Entity" button
- **Auto-detection** — author (Person) and publication (Organization) automatically tagged on capture
- **Keypair per entity** — each entity gets its own secp256k1 keypair (npub/nsec) for NOSTR identity
- **Entity aliases** (`canonical_id`) — entities can be linked as aliases of a canonical entity
- **Auto-suggestion** — automatically detects known entities from your registry in content text
- **Entity browser** with search and type filtering (All / 👤 / 🏢 / 📍 / 🔷)
- **Entity detail view** — rename, manage aliases, view keypair (npub/nsec with copy), articles list
- **JSON export/import** for full entity registry backup and restore

### 📋 Claim Extraction

- **📋 Claim button** in the text selection popover — select any text and extract it as a claim
- **Claim types** — classify claims as Factual, Causal, Evaluative, or Predictive
- **Crux marking** — mark key claims as "crux" (the most important claims)
- **Confidence slider** — set confidence level (0–100%) on crux claims
- **Structured claim triples** — `[Subject] → [Predicate] → [Object]` with entity references or freetext
- **Attribution types** — direct quote, paraphrase, editorial assertion, or article thesis
- **Quote date** — when the statement was made (distinct from article publish date)
- **Claims bar** — displays extracted claims with type badges, claimant labels, and crux indicators
- **Per-URL persistence** — claims stored per article URL and reloaded on revisit

### 🔗 Evidence Linking

- **🔗 button** on each claim opens the evidence linker modal
- **Cross-content linking** — link claims across different articles as supporting, contradicting, or contextualizing evidence
- **Relationship types** — supports ✅, contradicts ❌, contextualizes 📎
- **Evidence indicators** — claims with evidence links show a 🔗 badge with link count

### 🌐 Social Features

- **🌐 button** in the claims bar fetches kind 30040 claim events from relays for the current URL
- **Grouped by publisher** — remote claims organized by npub, filtering out your own
- **Cross-user claim discovery** — see what claims others have extracted from the same content

### 📤 NOSTR Publishing

Six event kinds are published:

| Kind | Purpose |
|------|---------|
| **0** | Entity profiles (with `refers_to` for aliases) |
| **30023** | Long-form content (articles in Markdown) |
| **30040** | Claims (structured triples, crux, confidence) |
| **30043** | Evidence links (supports/contradicts/contextualizes) |
| **30078** | Entity sync (NIP-44 encrypted) |
| **32125** | Entity relationships (author, mentioned, claimant, subject) |

**Two signing methods:**

| Method | Description |
|--------|-------------|
| **NIP-07 Extension** | Browser extensions like nos2x or Alby — keys never leave the extension |
| **Local Keypair** | BIP-340 Schnorr signing with a locally generated or imported key |

- **Parallel relay publishing** via `Promise.allSettled()` — events sent to all selected relays concurrently
- **Event preview** — inspect the full event JSON before publishing

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

- **`GM_setValue` / `GM_getValue`** for persistent Tampermonkey storage with **`localStorage` fallback** (iOS)
- **Storage quota monitoring** — color-coded display in settings (green → orange at 1 MB → red at 5 MB)
- **Size breakdown** — entities, identity, relays, claims shown separately
- **Compression fallback** — `_compressForSave()` strips optional fields when writes fail
- **Graceful error handling** — storage save failures show user-facing toasts

### 🎨 UI & Accessibility

- **Responsive design** — mobile-friendly FAB positioning and layout
- **Dark mode** — full `prefers-color-scheme` support
- **Shadow DOM FAB** — floating action button isolated from page CSS via closed shadow root (with regular DOM fallback)
- **ARIA labels** on interactive elements
- **Focus trap** within the reader view — Tab / Shift+Tab cycles through focusable elements
- **Panel stack Escape handling** — Escape closes the topmost overlay in order
- **`:focus-visible` styling** for clear keyboard focus indicators

---

## 🚀 Usage

1. **Navigate** to any article
2. **Click** the floating action button (📰 bottom-right corner)
3. **Read** the content in the clean reader view
4. **Edit metadata** — click author, publication, date, or URL to edit inline
5. **Toggle Edit mode** for content editing (visual WYSIWYG or raw markdown)
6. **Tag entities** — select text to tag people, orgs, places, or things
7. **Extract claims** — select text and click 📋 Claim with type classification and crux marking
8. **Preview as Published** — check the final markdown roundtrip format
9. **Publish** — click Publish → select relays and signing method → publish to NOSTR
10. **Settings** — manage identity (generate, import nsec, NIP-07), relays, entities, sync

---

## 📋 NOSTR Event Kinds

| Kind | Name | Usage |
|------|------|-------|
| **0** | Profile Metadata (NIP-01) | Optional public identity for entities; alias entities include `["refers_to", canonical_npub]` |
| **30023** | Long-form Content (NIP-23) | Articles in Markdown with entity `p` tags and claim summary tags |
| **30040** | Claim Event | Individual claim with claimant/subject/object `p` tags, predicate, quote-date, attribution type, confidence, crux flag |
| **30043** | Evidence Link | Cross-content claim relationship: supports, contradicts, or contextualizes |
| **30078** | Application Data (NIP-78) | Encrypted entity sync (NIP-44 v2 encrypt-to-self; NIP-04 fallback on read) |
| **32125** | Entity Relationship | Links an entity to content with a typed relationship (author, mentioned, claimant, subject) |

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
    ["predicate", "dropped to"],
    ["quote-date", "2024-01-15"],
    ["client", "nostr-article-capture"]
  ],
  "content": "surrounding context text"
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
| **NIP-23** | Long-form Content | Kind 30023 events for articles |
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
| [`tests/crypto-tests.js`](tests/crypto-tests.js) | 65 | secp256k1 key generation, BIP-340 Schnorr vectors, bech32 encode/decode, SHA-256, ECDH, NIP-04, event signing |
| [`tests/nip44-test.js`](tests/nip44-test.js) | 5 | ChaCha20 RFC 7539 vectors, NIP-44 padding, pad/unpad roundtrip, encrypt/decrypt roundtrip, HMAC tamper detection |

```bash
node tests/crypto-tests.js && node tests/nip44-test.js
```

---

## 📁 Project Structure

```
nostr-article-capture/
├── nostr-article-capture.user.js    # Single-file userscript (monolith)
├── tests/
│   ├── crypto-tests.js              # 65 crypto tests
│   └── nip44-test.js                # 5 NIP-44 tests
├── docs/
│   ├── project-history-and-migration.md  # Complete project history & X-Ray migration guide
│   ├── data-model.md                # Entity, claim, evidence data structures
│   ├── entity-hierarchy-design.md   # Entity alias system design
│   ├── entity-sync-design.md        # NIP-78 encrypted sync protocol
│   ├── archive-reader-design.md     # Archive reader design (reference)
│   ├── nostr-nips-analysis.md       # NIP usage and rationale
│   ├── article-data-collection.md   # Article capture field reference
│   ├── article-complete-inventory.md  # Full inventory of captured data
│   └── tampermonkey-article-capture-plan.md  # Original v1 plan
└── README.md
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Project History & Migration Guide](docs/project-history-and-migration.md) | Complete project history (v1–v4), data model reference, and X-Ray browser extension migration guide |
| [Data Model](docs/data-model.md) | Entity, claim, and evidence data structures |
| [Entity Hierarchy Design](docs/entity-hierarchy-design.md) | Entity alias system and canonical_id design |
| [Entity Sync Design](docs/entity-sync-design.md) | NIP-78 encrypted sync protocol (NIP-44 + NIP-04 fallback) |
| [NOSTR NIPs Analysis](docs/nostr-nips-analysis.md) | NIP usage and rationale |

---

## 🔗 Successor Project

**[X-Ray Browser Extension](https://github.com/bryanmatthewsimonson/xray)** — A Chrome/Firefox WebExtension (MV3) that extends article capture with multi-platform support (social media, video, etc.), URL-scoped metadata, and the platform-specific capture features that were explored in v3/v4 of this userscript. See [`docs/project-history-and-migration.md`](docs/project-history-and-migration.md) for the full migration story.

---

## 🔗 Related Projects

- [Readability](https://github.com/mozilla/readability) — Article content extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion

---

## 📄 License

MIT License
