# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A Tampermonkey userscript that captures web articles into a clean reader view, supports entity tagging and editing, and publishes long-form content to the NOSTR network as kind 30023 events.

---

## 📥 Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Article_Capture-2.0.1-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Article Capture" />
  </a>
</p>

**Prerequisites:** [Tampermonkey](https://www.tampermonkey.net/) browser extension.

The script bundles three `@require` dependencies automatically:

| Dependency | Purpose |
|-----------|---------|
| [@mozilla/readability](https://github.com/mozilla/readability) 0.5.0 | Article content extraction |
| [Turndown](https://github.com/mixmark-io/turndown) 7.2.0 | HTML → Markdown conversion |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown#gfm) 1.0.2 | GitHub-Flavored Markdown tables & strikethrough |

---

## ✨ Features

### 📰 Article Capture
- **Mozilla Readability** extracts title, author, date, and body from any webpage
- **Smart date detection** — JSON-LD, meta tags (`article:published_time`, `datePublished`), platform-specific selectors (Substack, Medium, WordPress)
- **Markdown conversion** — HTML content automatically converted via Turndown

### 📖 Reader View
- **Full-page takeover** with clean typography and optimal reading width
- **Dark mode** support
- **Metadata display** — title, author, publication, date, word count

### ✏️ Editing
- **Visual (WYSIWYG)** — `contentEditable` rich-text editing directly in the reader view
- **Raw Markdown** — toggle to edit the underlying Markdown source
- **Editable fields** — title, date, excerpt, and body
- **Preview as Published** — renders the final Markdown to see what the NOSTR article will look like

### 🏷️ Entity Tagging
- **Four entity types**: Person 👤, Organization 🏢, Place 📍, Thing 🔷
- **Text selection tagging** — select text in the article, choose entity type from a popover
- **Manual tagging** — add entities by name via the "+ Tag Entity" button
- **Auto-detection** — author (person) and publication (organization) are automatically tagged on capture
- **Keypair per entity** — each entity gets its own secp256k1 keypair for future NOSTR identity

### 📤 NOSTR Publishing
- Publishes articles as **kind 30023** (NIP-23 long-form content) with Markdown body
- Entity tags included in the published event
- Configurable relay list (10 default public relays)
- **Relay connection retry** with exponential backoff (1 s → 2 s → 4 s, up to 4 attempts)
- **Stale WebSocket detection** — closed/closing sockets are discarded and reconnected automatically
- **Parallel relay publish** — events are sent to all selected relays concurrently via `Promise.allSettled`
- **NOTICE message handling** — relay NOTICE messages are logged during publish

### 🔑 Signing Methods

| Method | Description |
|--------|-------------|
| **NIP-07 Extension** | Browser extensions like nos2x or Alby — keys never leave the extension |
| **Local Keypair** | BIP-340 Schnorr signing with a locally generated or imported key |

### 🔄 Entity Sync
- **Push/Pull** entities across browsers via encrypted **NIP-78** (kind 30078) events
- **NIP-44 v2 encrypt-to-self** — entity data encrypted with ChaCha20-Poly1305 (HKDF-SHA256 key derivation)
- **NIP-04 backward compatibility** — pull decrypts NIP-44 first, falls back to NIP-04 for older events
- **Smart merge** — last-write-wins on `updated` timestamp; article arrays merged by URL union
- **nsec import/export** — share your identity across browsers

### ⚙️ Settings
- **Identity management** — generate a new keypair, import an existing nsec, or connect via NIP-07
- **Relay configuration** — add, remove, enable/disable relays
- **Entity export/import** — JSON file backup and restore of the entity registry
- **Storage quota monitoring** — live display of storage usage breakdown; warnings at 2 MB and 5 MB thresholds

### ♿ Accessibility
- **Comprehensive keyboard navigation** — all interactive elements reachable via Tab/Shift+Tab
- **ARIA labels** on buttons, dialogs, entity chips, and entity browser cards
- **Focus trap** — Tab cycling is contained within the reader view when open
- **Panel stack Escape handling** — Escape closes the topmost overlay (popover → settings → publish → reader)
- **`makeKeyboardAccessible()` utility** — adds `tabindex`, `role="button"`, and Enter/Space handlers to non-button elements

### 🔐 Crypto
- **secp256k1 / BIP-340 Schnorr** — full embedded signing and verification (no external crypto library)
- **NIP-04** — AES-256-CBC encrypt/decrypt via Web Crypto API (legacy, used for backward-compatible decryption)
- **NIP-44 v2** — ChaCha20-Poly1305 stream cipher with HKDF-SHA256 key derivation, NIP-44 padding, HMAC authentication, and constant-time MAC comparison
- **Graceful error handling** — storage save failures show user-facing toasts; sync failures are caught per-entity

---

## 🚀 Usage

1. **Navigate** to any article page
2. **Click** the floating **📰** button (bottom-right corner)
3. **Read** the article in the clean reader view
4. **Edit** — toggle visual or Markdown editing; modify title, date, body
5. **Tag entities** — select text to tag people, orgs, places, or things; or use "+ Tag Entity"
6. **Preview** — check the final published format with "Preview as Published"
7. **Publish** — sign and send to NOSTR relays

---

## 🏗️ Architecture

The userscript is a single self-contained file (~4,930 lines) organized into 12 sections:

| # | Section | Description |
|---|---------|-------------|
| 1 | **Configuration** | Default relays, reader settings, extraction limits, tagging config |
| 2 | **Crypto** | secp256k1 curve primitives, BIP-340 Schnorr signing, SHA-256, HMAC, NIP-04, NIP-44 v2 (ChaCha20, HKDF) |
| 3 | **Storage** | `GM_setValue`/`GM_getValue` persistence, entity registry CRUD, storage quota estimation |
| 4 | **Content Extraction** | Readability integration, date detection, Turndown Markdown conversion |
| 5 | **Utilities** | Formatting helpers, sanitization, keyboard accessibility helper |
| 6 | **Entity Tagger** | Text selection popover, entity type picker, auto-detection |
| 7 | **Relay Client** | WebSocket connections with retry/backoff, NIP-01 message handling, parallel publish, subscribe |
| 8 | **Event Builder** | kind 0 (profile), kind 30023 (article), kind 30078 (entity sync) construction & signing |
| 8.5 | **Entity Sync** | NIP-44 encrypted push/pull, NIP-04 fallback decryption, last-write-wins merge |
| 9 | **Reader View** | Full-page takeover UI, edit modes, preview, dark mode, entity bar, focus trap |
| 9B | **Entity Browser** | Search, filter, entity cards, detail view with alias/keypair management |
| 10 | **Styles** | All CSS injected via `GM_addStyle` |
| 11 | **Initialization** | FAB creation, menu commands, startup |

---

## 📋 NOSTR Event Kinds

| Kind | Name | Usage |
|------|------|-------|
| **0** | Profile (NIP-01) | Optional public identity for entities |
| **30023** | Long-form Article (NIP-23) | Published article content in Markdown |
| **30078** | Application Data (NIP-78) | Encrypted entity sync (NIP-44 v2 encrypt-to-self; NIP-04 fallback on read) |

---

## 🌐 Default Relays

Pre-configured with 10 public relays:

`wss://nos.lol` · `wss://relay.primal.net` · `wss://relay.nostr.net` · `wss://nostr.mom` · `wss://relay.nostr.bg` · `wss://nostr.oxtr.dev` · `wss://relay.snort.social` · `wss://offchain.pub` · `wss://nostr-pub.wellorder.net` · `wss://nostr.fmt.wiz.biz`

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Data Model](docs/data-model.md) | Entity and article data structures |
| [Entity Sync Design](docs/entity-sync-design.md) | NIP-78 encrypted sync protocol (NIP-44 + NIP-04 fallback) |
| [NOSTR NIPs Analysis](docs/nostr-nips-analysis.md) | NIP usage and rationale |

## 🧪 Test Suites

| File | Tests | Coverage |
|------|-------|----------|
| [tests/crypto-tests.js](tests/crypto-tests.js) | 65 | secp256k1, BIP-340 Schnorr, bech32, SHA-256, NIP-04 |
| [tests/nip44-test.js](tests/nip44-test.js) | 21 | NIP-44 v2 padding, ChaCha20, HKDF, encrypt/decrypt round-trip, conversation key |

---

## 🔗 Related Projects

- [Readability](https://github.com/mozilla/readability) — Article content extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion

---

## 📄 License

MIT License
