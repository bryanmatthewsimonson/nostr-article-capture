# NOSTR Article Capture

![Version](https://img.shields.io/badge/version-1.12.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Tampermonkey-orange.svg)

A powerful Tampermonkey userscript that captures web articles, converts them to readable format or Markdown, and publishes them to the NOSTR network. Part of the **Decentralized News Verification Network** for building a knowledge graph of content, people, and organizations.

## 📥 One-Click Install

**[➡️ Install NOSTR Article Capture](https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js)**

*Tampermonkey will automatically detect the userscript and prompt you to install it.*

---

## ✨ Features

### Article Capture & Conversion
- **Readability Mode** - Extract clean, distraction-free article content from any webpage
- **Markdown Conversion** - Automatically convert articles to Markdown format
- **Toggle View** - Switch between readable HTML and raw Markdown views
- **Copy & Download** - Copy content to clipboard or download as .md file
- **Image Embedding** - Embed images as base64 data URLs for self-contained articles

### Content Editing (v1.12.0) 🆕
- **Edit Mode Toggle** - Enable editing of article content before publishing
- **Editable Fields** - Modify title, excerpt, and body content
- **Quick Clean Tools** - One-click cleanup buttons:
  - Remove Ads
  - Clean Whitespace
  - Remove Related Articles
  - Remove Social Prompts
- **Revert Functionality** - Restore original content at any time
- **Character Count** - Live character count display for content

### Enhanced URL Capture (v1.9.0)
- **Canonical URL Detection** - Automatically detects true article URL via `<link rel="canonical">`, `og:url`, or `twitter:url`
- **Tracking Parameter Removal** - Removes 17+ tracking parameters (UTM, fbclid, gclid, etc.)
- **URL Source Indicator** - Shows both canonical and browser URLs when they differ

### Multi-Pubkey Publishing (v1.10.0)
- **Publication Pubkey (Signer)** - Always included as the event signer
- **Author Pubkey** - Optional, added as p-tag with 'author' marker
- **Capturer Pubkey** - Optional, retrieved from NIP-07 extension, added as p-tag with 'capturer' marker
- **Collapsible Publishing Options** - Clean UI section for managing pubkey options

### People & Organizations Extraction (v1.11.0)
- **Automatic People Detection** - Extracts quoted people from article content
- **Organization Extraction** - Identifies referenced organizations
- **Entity Review UI** - Review, add, and remove extracted entities
- **NOSTR Tags** - Entities added as `person` and `org` tags in published events

### NOSTR Publishing
- **Long-form Content** - Publish articles as NIP-23 long-form content
- **Multi-Relay Support** - Publish to multiple NOSTR relays simultaneously
- **Entity Management** - Track Publications, People, and Organizations with NOSTR keypairs
- **Keypair Registry** - Persistent storage and export/backup of all created keypairs

### URL Metadata & Annotations
- **URL Metadata Posting** - Post annotations, fact-checks, and headline corrections to any URL
- **URL Reactions** - Quick emoji reactions with aspect selector and reasoning
- **Related Content Links** - Link related URLs with relationship types and relevance scores
- **Metadata Display** - View existing URL metadata aggregated from NOSTR relays
- **Content Ratings & Comments** - Rate content on multiple dimensions and participate in discussions

---

## 🆕 What's New in v1.12.0

| Version | Feature | Description |
|---------|---------|-------------|
| **v1.12.0** | Content Editing | Edit mode toggle, quick clean tools, revert functionality |
| **v1.11.0** | Entity Extraction | Automatic extraction of people and organizations from articles |
| **v1.10.0** | Multi-Pubkey Publishing | Support for author and capturer pubkeys with p-tag markers |
| **v1.9.0** | Enhanced URL Capture | Canonical URL detection, expanded tracking parameter removal |

---

## 🔧 Installation

### Prerequisites

1. **Browser**: Microsoft Edge, Chrome, or Firefox
2. **Tampermonkey** extension installed:
   - [Tampermonkey for Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - [Tampermonkey for Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
3. **NOSTR Signing Extension** (for publishing):
   - [nos2x](https://github.com/fiatjaf/nos2x) - Simple and lightweight
   - [Alby](https://getalby.com/) - Full-featured with Lightning wallet
   - Or any other NIP-07 compatible extension

### One-Click Install

Click the link below to install the script directly:

**[Install NOSTR Article Capture](https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js)**

### Manual Install

1. Click on the Tampermonkey icon in your browser toolbar
2. Select "Create a new script..."
3. Delete any existing content
4. Copy and paste the entire contents of [`nostr-article-capture.user.js`](nostr-article-capture.user.js)
5. Press `Ctrl+S` (or `Cmd+S` on Mac) to save
6. The script is now active on all web pages

### Install from File

1. Open Tampermonkey Dashboard (click icon → Dashboard)
2. Go to the "Utilities" tab
3. Under "Import from file", click "Choose file"
4. Select the `nostr-article-capture.user.js` file
5. Confirm the installation

---

## 🚀 Quick Start

1. **Navigate** to any webpage with article content
2. **Click** the floating action button (📖) in the bottom-right corner
3. **View** the extracted article in Readable or Markdown format
4. **Edit** (optional) - Toggle edit mode to modify content or use quick clean tools
5. **Configure** publishing options (author pubkey, capturer pubkey)
6. **Review** extracted people and organizations
7. **Publish** - Select/create a publication, optionally add tags, then click "Publish"

---

## 🔑 Signing Methods

| Method | Description | Security |
|--------|-------------|----------|
| **NIP-07 Extension** | Works with nos2x, Alby, and other browser signing extensions | ⭐⭐⭐ Keys never leave the extension |
| **NSecBunker** | Secure key management without exposing private keys | ⭐⭐⭐ Remote signing, enterprise-ready |
| **Local Keys** | Generate and store keypairs locally in Tampermonkey | ⭐⭐ Convenient, less secure |

---

## 📋 NOSTR Event Types

| Kind | Name | Description |
|------|------|-------------|
| 30023 | Long-form Content | NIP-23 articles (Markdown) |
| 32123 | URL Annotation | Context, corrections, or related info for URLs |
| 32124 | Content Rating | Multi-dimensional content ratings |
| 32127 | Fact-Check Claim | Fact-check verdicts with evidence |
| 32129 | Headline Correction | Corrections for misleading headlines |
| 32131 | Related Content | Links to related URLs with relationship types |
| 32132 | URL Reaction | Quick emoji reactions with aspect and reasoning |

---

## 🔄 Auto-Updates

The script is configured to automatically check for updates from this repository. When a new version is available, Tampermonkey will notify you and offer to update.

**Update URLs:**
- **Update URL**: `https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js`
- **Download URL**: `https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js`

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

Detailed documentation is available in the [`docs/`](docs/) folder:

| Document | Description |
|----------|-------------|
| [Project Summary](docs/project-summary.md) | Overview of the project goals and architecture |
| [System Architecture](docs/system-architecture.md) | Technical architecture and design |
| [Data Model](docs/data-model.md) | Entity relationships and data structures |
| [API Specifications](docs/api-specifications.md) | API endpoints and interfaces |
| [NOSTR Event Schemas](docs/nostr-event-schemas.md) | Event kind definitions and formats |
| [NIP URL Metadata](docs/NIP-URL-METADATA.md) | URL metadata protocol specification |
| [Development Roadmap](docs/development-roadmap.md) | Feature roadmap and milestones |
| [UI Metadata Posting Design](docs/ui-metadata-posting-design.md) | UI/UX design for metadata features |
| [Tampermonkey Plan](docs/tampermonkey-article-capture-plan.md) | Implementation plan for the userscript |
| [Browser Extension Design](docs/browser-extension-design.md) | Design docs for browser extension |

Additional planning documents are in the [`plans/`](plans/) folder.

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
