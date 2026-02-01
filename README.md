# NOSTR Article Capture

A Tampermonkey userscript that enables you to capture web articles, convert them to readable format or Markdown, and publish them to NOSTR. Part of the Decentralized News Verification Network for building a knowledge graph of content, people, and organizations.

## Features

- **Readability Mode**: Extract clean, distraction-free article content from any webpage
- **Markdown Conversion**: Automatically convert articles to Markdown format
- **Toggle View**: Switch between readable HTML and raw Markdown views
- **Copy & Download**: Copy content to clipboard or download as .md file
- **NOSTR Publishing**: Publish articles as NIP-23 long-form content to NOSTR network
- **NIP-07 Extension Support**: Works with nos2x, Alby, and other browser signing extensions
- **Entity Management**: Track Publications, People, and Organizations with NOSTR keypairs
- **Multi-Relay Support**: Publish to multiple NOSTR relays simultaneously
- **NSecBunker Integration**: Secure key management without exposing private keys (optional)
- **Image Embedding**: Embed images as base64 data URLs for self-contained articles
- **Keypair Registry**: Persistent storage and export/backup of all created keypairs
- **URL Metadata Posting**: Post annotations, fact-checks, and headline corrections to any URL
- **URL Reactions**: Quick emoji reactions with aspect selector and reasoning
- **Related Content Links**: Link related URLs with relationship types and relevance scores
- **Metadata Display**: View existing URL metadata aggregated from NOSTR relays
- **Content Ratings & Comments**: Rate content on multiple dimensions and participate in discussions

## Installation

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

Tampermonkey will automatically detect the userscript and prompt you to install it.

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

## Auto-Updates

The script is configured to automatically check for updates from this repository. When a new version is available, Tampermonkey will notify you and offer to update.

Update URLs:
- **Update URL**: `https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js`
- **Download URL**: `https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js`

## Quick Start

1. Navigate to any webpage with article content
2. Click the floating action button (📖) in the bottom-right corner
3. View the extracted article in Readable or Markdown format
4. To publish: Select/create a publication, optionally add tags, then click "Publish"

## Documentation

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

## NOSTR Event Types

| Kind | Name | Description |
|------|------|-------------|
| 30023 | Long-form Content | NIP-23 articles (Markdown) |
| 32123 | URL Annotation | Context, corrections, or related info for URLs |
| 32124 | Content Rating | Multi-dimensional content ratings |
| 32127 | Fact-Check Claim | Fact-check verdicts with evidence |
| 32129 | Headline Correction | Corrections for misleading headlines |
| 32131 | Related Content | Links to related URLs with relationship types |
| 32132 | URL Reaction | Quick emoji reactions with aspect and reasoning |

## Default Relays

Pre-configured relays:
- ✅ `wss://relay.damus.io`
- ✅ `wss://nos.lol`
- ✅ `wss://relay.nostr.band`
- ⬜ `wss://relay.snort.social` (disabled by default)
- ⬜ `wss://nostr.wine` (disabled by default)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - Feel free to modify and distribute.

## Related Projects

- [NSecBunker](https://github.com/kind-0/nsecbunker) - Secure NOSTR key management
- [Readability](https://github.com/mozilla/readability) - Article extraction
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - NOSTR utilities

---

Built for the Decentralized News Verification Network project.
