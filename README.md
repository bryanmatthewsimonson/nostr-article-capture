# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-1.16.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A powerful Tampermonkey userscript that captures web articles and publishes them to the NOSTR network. Features an **immersive fullscreen reader** with inline reactions, comments, and distraction-free reading. Part of the **Decentralized News Verification Network**.

---

## 📥 One-Click Install

<p align="center">
  <a href="https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js">
    <img src="https://img.shields.io/badge/➡️_Install_NOSTR_Article_Capture-1.16.0-blue?style=for-the-badge&logo=tampermonkey" alt="Install NOSTR Article Capture" />
  </a>
</p>

**[➡️ Install NOSTR Article Capture](https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js)**

*Tampermonkey will automatically detect the userscript and prompt you to install it.*

---

## 🆕 What's New in v1.16.0

### ✨ Fullscreen Immersive Reader Mode

Experience articles the way they were meant to be read:

- **🖥️ Fullscreen Mode** - Clean, distraction-free reading experience
- **📖 Optimal Reading Width** - Content centered with comfortable line length
- **😊 Quick Reaction Bar** - Express reactions with emoji (👍 👎 ❤️ 😂 😮 😢 😡)
- **🔘 Floating Action Button** - Easy access to all tools without clutter
- **💬 Inline Comments & Reactions** - View community engagement directly in the reader
- **📂 Collapsible Sidebar Panels** - Editing, metadata, and publishing slide out when needed

---

## 📋 Version History

| Version | Changes |
|---------|---------|
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

Pre-configured relays:
- ✅ `wss://relay.damus.io`
- ✅ `wss://nos.lol`
- ✅ `wss://relay.nostr.band`
- ⬜ `wss://relay.snort.social` (disabled by default)
- ⬜ `wss://nostr.wine` (disabled by default)

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
