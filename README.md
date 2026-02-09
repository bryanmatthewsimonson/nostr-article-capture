# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A powerful Tampermonkey userscript that captures web articles and publishes them to the NOSTR network. Features an **immersive fullscreen reader** with inline reactions, comments, and distraction-free reading. Part of the **Decentralized News Verification Network**.

---

## 📥 One-Click Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Article_Capture-2.0.1-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Article Capture" />
  </a>
</p>

**[➡️ Install NOSTR Article Capture](https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js)**

*Tampermonkey will automatically detect the userscript and prompt you to install it.*

---

## 🐛 Recent Bug Fixes (2025-02)

### ✅ "Tag Entity" Button Now Functional
- **Problem:** The "+ Tag Entity" button in the Reader View did nothing when clicked — no click event listener was attached to `#nac-add-entity-btn`.
- **Fix:** Added a click event listener that prompts the user for an entity name and opens the EntityTagger type-selection popover when a valid name is entered.
- **How it works:** User clicks "+ Tag Entity" → enters a name via `prompt()` → if valid (meets minimum length), the EntityTagger popover opens at the button's position for type selection.

### ✅ Auto-Detection of Author and Publication Entities
- **Problem:** When capturing an article, the author (from byline) and publication (from site name) were displayed as plain text but never automatically tagged as entities in the entity system.
- **Fix:** Added auto-detection logic at the end of `ReaderView.show()` that processes both author and publication:
  - **Author:** Checks `article.byline`, searches for existing person entities. If found, links with context `"author"`. If not found, creates a new person entity with a generated keypair. Displays as a chip in the entity bar.
  - **Publication:** Checks `article.siteName` or `article.domain`, searches for existing organization entities. If found, links with context `"publication"`. If not found, creates a new organization entity with a generated keypair. Displays as a chip in the entity bar.
  - Both operations are wrapped in `try/catch` for error resilience — a failure in one does not block the other.

---

## 🆕 What's New in v2.0.1

### 🔄 Entity Sync via NOSTR

Sync your entity registry (persons, organizations, places) across browsers using encrypted NOSTR events:

- **🔒 Encrypted Private Sync** - Uses NIP-78 (kind 30078) parameterized replaceable events with NIP-04 encrypt-to-self
- **⬆️ Push to NOSTR** - Encrypts and publishes all entities to your configured relays
- **⬇️ Pull from NOSTR** - Fetches, decrypts, validates, and merges remote entities with local storage
- **🔀 Smart Merge** - Last-write-wins on `updated` timestamp; article arrays merged by URL union
- **🌐 Cross-Browser Workflow** - Generate/import nsec on Browser A → Push → Import same nsec on Browser B → Pull
- **👤 Optional Public Identity** - Publish kind 0 profiles to give entities a public NOSTR identity

### 🔑 nsec Import/Export

- **Import existing nsec** for cross-browser identity setup
- **Show nsec** and **Copy nsec** buttons in settings when a private key is available

### 📂 Import Entities from File

- Import entity registry JSON files exported from another browser via the Settings panel

### 📡 Expanded Default Relay List

- Increased to 10 reliable public relays for better connectivity and redundancy

See [Entity Sync Design](docs/entity-sync-design.md) for full technical details.

---

## 📋 Version History

| Version | Changes |
|---------|---------|
| **v2.0.1** | Entity sync via NOSTR (NIP-78 encrypted), nsec import/export, entity file import, expanded relay list. **Bug fixes:** "+ Tag Entity" button now functional; auto-detection of author and publication entities on article capture |
| **v1.16.0** | Fullscreen immersive reader UI with inline reactions/comments |
| **v1.15.0** | Redesigned keypair architecture (user identity vs publication signing) |
| **v1.14.0** | Removed incomplete metadata features, cleaned up code |
| **v1.13.0** | Enhanced date detection (JSON-LD, Substack support) + date editing |
| **v1.12.0** | Initial features: URL capture, content editing, entity extraction |

---

## ✨ Features Overview

### 📖 Immersive Reader Mode
- **Fullscreen experience** with minimal UI distractions
- **Optimal reading width** for comfortable reading
- **Quick reaction bar** for instant emoji reactions
- **Floating action button** for tools access
- **Inline comments and reactions** display from NOSTR network

### 📰 Article Capture
- **Smart extraction** of title, author, date, and content
- **Readability mode** - Clean article text from any webpage
- **Markdown conversion** - Automatic HTML to Markdown
- **Image embedding** - Base64 data URLs for self-contained articles

### 📅 Smart Date Detection
- **JSON-LD structured data** parsing
- **Meta tags** (article:published_time, datePublished)
- **Platform-specific selectors** for Substack, Medium, WordPress
- **Manual date editing** with calendar picker

### ✏️ Content Editing
- **Edit mode toggle** - Modify content before publishing
- **Editable fields** - Title, date, excerpt, body
- **Quick clean tools** - Remove ads, clean whitespace, remove related articles
- **Revert functionality** - Restore original content anytime

### 👤 User Identity (Personal NOSTR Keys)
- Used for **URL metadata** - annotations, ratings, reactions
- Your personal identity for engaging with content
- Supports **NIP-07 extensions** (nos2x, Alby)

### 📝 Publication Signing (Organization Keys)
- Used for **publishing articles** to NOSTR
- Represents publications/organizations
- **Local keypair generation** and management
- **Keypair registry** with export/backup

### 🏷️ URL Metadata
- **Annotations & Comments** - Add context to any URL
- **Content Ratings** - Multi-dimensional quality ratings
- **Fact-Checks** - Verdicts with evidence
- **Headline Corrections** - Fix misleading titles
- **Quick Reactions** - Emoji reactions with reasoning
- **Related Content** - Link related URLs

### 👥 People & Organizations
- **Automatic detection** of quoted people
- **Organization extraction** from article content
- **Entity review UI** - Add, remove, verify entities
- **NOSTR tags** - Entities as `person` and `org` tags

### 🔄 Entity Sync & Cross-Browser Identity
- **Encrypted NOSTR sync** - Push/pull entities via NIP-78 events with NIP-04 encryption
- **nsec import/export** - Share your identity across browsers securely
- **Entity file import** - Import entity registry JSON files from another browser
- **Smart merge** - Last-write-wins timestamps with article array union
- **Optional kind 0 profiles** - Give entities a public NOSTR identity

### 🔄 Auto-Updates
- Automatic update checks from GitHub
- Tampermonkey notification when updates available
- One-click update installation

---

## 🚀 Quick Start

1. **📥 Install** - Click the one-click install link above
2. **🌐 Navigate** - Go to any article page
3. **📰 Click** - Press the floating **📰** button (bottom-right)
4. **📖 Read** - Enjoy the immersive fullscreen reader
5. **😊 React** - Use the reaction bar for quick emoji reactions
6. **🔧 Tools** - Click the floating action button for:
   - ✏️ Edit article content
   - 🏷️ Add URL metadata
   - 📤 Publish to NOSTR

---

## 🔑 User Identity vs Publication

### User Identity (Your Personal Keys)
Used when posting **URL metadata**:
- Annotations and comments
- Content ratings
- Fact-checks
- Reactions

**Setup:** Connect via NIP-07 extension (nos2x, Alby) or generate local keys.

### Publication Identity (Organization Keys)
Used when **publishing articles**:
- Long-form content (kind 30023)
- Articles are signed by the publication

**Setup:** Create or import publication keypairs in the Publishing panel.

---

## 🌐 Supported Platforms

Works on **any article page**. Special date detection for:

| Platform | Detection Method |
|----------|-----------------|
| **Substack** | Custom selectors, JSON-LD |
| **Medium** | JSON-LD, meta tags |
| **WordPress** | Multiple meta formats |
| **News Sites** | article:published_time, Schema.org |
| **Generic** | Fallback meta detection |

---

## 📋 NOSTR Event Kinds

| Kind | Name | Description |
|------|------|-------------|
| **30023** | Long-form Article | NIP-23 articles (Markdown) |
| **30078** | Entity Sync (Private) | NIP-78 encrypted entity data (parameterized replaceable) |
| **32123** | Annotation/Comment | Context or corrections for URLs |
| **32124** | Content Rating | Multi-dimensional quality ratings |
| **32127** | Fact Check | Fact-check verdicts with evidence |
| **32129** | Headline Correction | Corrections for misleading headlines |
| **32131** | Related Content | Links to related URLs |
| **32132** | Reaction | Emoji reactions with reasoning |

---

## 🔑 Signing Methods

| Method | Description | Security |
|--------|-------------|----------|
| **NIP-07 Extension** | nos2x, Alby, other browser extensions | ⭐⭐⭐ Keys never leave extension |
| **NSecBunker** | Remote signing service | ⭐⭐⭐ Enterprise-ready |
| **Local Keys** | Generated/stored in Tampermonkey | ⭐⭐ Convenient |

---

## 🌐 Default Relays

Pre-configured with 10 reliable public relays:
- ✅ `wss://nos.lol`
- ✅ `wss://relay.primal.net`
- ✅ `wss://relay.nostr.net`
- ✅ `wss://nostr.mom`
- ✅ `wss://relay.nostr.bg`
- ✅ `wss://nostr.oxtr.dev`
- ✅ `wss://relay.snort.social`
- ✅ `wss://offchain.pub`
- ✅ `wss://nostr-pub.wellorder.net`
- ✅ `wss://nostr.fmt.wiz.biz`

---

## 📚 Documentation

Detailed documentation in the [`docs/`](docs/) folder:

| Document | Description |
|----------|-------------|
| [Project Summary](docs/project-summary.md) | Overview of project goals |
| [System Architecture](docs/system-architecture.md) | Technical architecture |
| [Data Model](docs/data-model.md) | Entity relationships |
| [NOSTR Event Schemas](docs/nostr-event-schemas.md) | Event kind definitions |
| [NIP URL Metadata](docs/NIP-URL-METADATA.md) | URL metadata protocol |
| [UI Metadata Posting](docs/ui-metadata-posting-design.md) | UI/UX design docs |
| [Development Roadmap](docs/development-roadmap.md) | Feature roadmap |
| [Entity Sync Design](docs/entity-sync-design.md) | Entity sync via NOSTR technical design |

Additional planning documents in [`plans/`](plans/).

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## 📄 License

MIT License - Feel free to modify and distribute.

---

## 🔗 Related Projects

- [NSecBunker](https://github.com/kind-0/nsecbunker) - Secure NOSTR key management
- [Readability](https://github.com/mozilla/readability) - Article extraction
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - NOSTR utilities

---

<p align="center">
  Built for the <strong>Decentralized News Verification Network</strong> project.
</p>
