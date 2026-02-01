# Browser Extension Architecture & Design

## Overview

The browser extension serves as the primary user interface for annotating news content, viewing verification information, and participating in the decentralized trust network. It integrates seamlessly with web pages to provide real-time fact-checking and community-driven verification.

## Extension Architecture

### Core Components

#### 1. Content Script (`content.js`)
- **Purpose**: Injected into web pages to analyze content and provide UI overlays
- **Responsibilities**:
  - Scan page for news content and claims
  - Highlight verifiable statements
  - Show verification badges and trust indicators
  - Inject annotation UI elements
  - Communicate with background script

#### 2. Background Script (`background.js`)
- **Purpose**: Persistent service worker handling NOSTR communication and data management
- **Responsibilities**:
  - Manage NOSTR connections and event publishing
  - Cache verification data and trust scores
  - Handle authentication and key management
  - Coordinate between content scripts and popup
  - Sync with backend API

#### 3. Popup Interface (`popup.html/js`)
- **Purpose**: Extension popup for user settings and quick actions
- **Responsibilities**:
  - Display user profile and trust score
  - Show recent annotations and activity
  - Provide quick access to common functions
  - Manage relay connections and settings

#### 4. Options Page (`options.html/js`)
- **Purpose**: Full settings and configuration interface
- **Responsibilities**:
  - NOSTR key management and backup
  - Relay configuration and management
  - Trust network settings
  - Privacy and display preferences

## User Interface Design

### Content Page Overlays

#### Verification Indicators
```css
.fact-check-indicator {
  position: relative;
  display: inline-block;
}

.fact-check-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
}

.verified-true { background: #4CAF50; }
.verified-false { background: #F44336; }
.misleading { background: #FF9800; }
.unverified { background: #9E9E9E; }
.disputed { background: #673AB7; }
```

#### Annotation Sidebar
- **Slide-out panel** triggered by verification badges
- **Real-time updates** showing community fact-checks
- **Trust scores** for different annotators
- **Source links** to supporting evidence
- **Discussion threads** for contested claims

#### Quick Actions Toolbar
- **Fact-check button**: Initiate verification for selected text
- **Bookmark**: Save content for later verification
- **Share**: Send to trusted network for review
- **Report**: Flag suspicious or harmful content

### Extension Popup Design

```
┌─────────────────────────────────┐
│ FactCheck Network               │
├─────────────────────────────────┤
│ 🟢 Connected (3 relays)         │
│                                 │
│ Your Trust Score: 8.7/10        │
│ Domain: Politics (9.1)          │
│         Technology (8.3)        │
│                                 │
│ Recent Activity:                │
│ ✓ Verified claim about GDP      │
│ ⚠ Disputed election statistic   │
│ 📝 Added context to headline    │
│                                 │
│ [New Annotation] [Settings]     │
└─────────────────────────────────┘
```

### Annotation Creation Interface

#### Step-by-Step Flow
1. **Text Selection**: User highlights claim on page
2. **Claim Analysis**: Extension extracts and categorizes claim
3. **Verification Form**: 
   - Claim classification (fact/opinion/prediction)
   - Verdict selection (true/false/misleading/unverified)
   - Confidence level (0-100%)
   - Evidence sources (URLs, citations)
   - Tags and categories
4. **Review & Publish**: Preview before submitting to NOSTR

#### Form Component Design
```html
<div class="annotation-form">
  <div class="claim-preview">
    <h4>Selected Claim:</h4>
    <blockquote>"The unemployment rate decreased by 2% last month"</blockquote>
    <small>From: example-news.com/article/123</small>
  </div>
  
  <div class="verification-options">
    <label>Verdict:</label>
    <div class="verdict-buttons">
      <button class="verdict true">✓ True</button>
      <button class="verdict false">✗ False</button>
      <button class="verdict misleading">⚠ Misleading</button>
      <button class="verdict unverified">? Unverified</button>
    </div>
  </div>
  
  <div class="confidence-slider">
    <label>Confidence: <span id="confidence-value">85%</span></label>
    <input type="range" min="0" max="100" value="85">
  </div>
  
  <div class="evidence-section">
    <label>Supporting Evidence:</label>
    <textarea placeholder="Add sources, links, or explanation..."></textarea>
    <div class="source-links">
      <input type="url" placeholder="Add source URL">
      <button>+ Add Source</button>
    </div>
  </div>
  
  <div class="tags-section">
    <label>Tags:</label>
    <input type="text" placeholder="economy, statistics, government">
  </div>
</div>
```

## Technical Implementation

### Content Script Integration

#### Page Analysis Engine
```javascript
class ContentAnalyzer {
  constructor() {
    this.claimPatterns = [
      /(\d+(?:\.\d+)?%?\s+(?:increase|decrease|rise|fall))/gi,
      /(according to|studies show|experts say|reports indicate)/gi,
      /(\$[\d,]+(?:\.\d+)?(?:\s+(?:million|billion|trillion))?)/gi
    ];
  }
  
  findVerifiableClaims(text) {
    // Extract potential factual claims from text
    // Return array of claim objects with position info
  }
  
  highlightClaims(claims) {
    // Wrap detected claims in verification indicators
  }
}
```

#### Real-time Verification Display
```javascript
class VerificationOverlay {
  async displayVerification(claimHash) {
    const verifications = await this.fetchVerifications(claimHash);
    const trustWeightedScore = this.calculateTrustScore(verifications);
    
    return this.createOverlayElement({
      score: trustWeightedScore,
      count: verifications.length,
      topSources: this.getTopSources(verifications),
      lastUpdated: this.getLatestTimestamp(verifications)
    });
  }
}
```

### NOSTR Integration

#### Event Publishing
```javascript
class NOSTRPublisher {
  async publishAnnotation(annotation) {
    const event = {
      kind: 10001,
      content: JSON.stringify({
        type: annotation.type,
        claim: annotation.claim,
        verdict: annotation.verdict,
        confidence: annotation.confidence,
        evidence: annotation.evidence
      }),
      tags: [
        ['d', annotation.id],
        ['url', annotation.sourceUrl],
        ['claim_hash', annotation.claimHash],
        ...annotation.tags.map(tag => ['t', tag])
      ],
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const signedEvent = await this.signEvent(event);
    return this.publishToRelays(signedEvent);
  }
}
```

### Data Management

#### Local Storage Strategy
- **IndexedDB** for cached verifications and trust scores
- **Session storage** for temporary annotation drafts
- **Chrome.storage** for user preferences and settings
- **Encrypted storage** for NOSTR private keys

#### Sync Architecture
```javascript
class DataSynchronizer {
  constructor() {
    this.syncInterval = 30000; // 30 seconds
    this.conflictResolution = 'latest-wins';
  }
  
  async syncWithRelays() {
    const lastSync = await this.getLastSyncTimestamp();
    const newEvents = await this.fetchEventsSince(lastSync);
    
    for (const event of newEvents) {
      await this.processIncomingEvent(event);
    }
    
    await this.updateLastSyncTimestamp();
  }
}
```

## User Experience Flow

### First-Time Setup
1. **Install Extension** → Welcome screen with overview
2. **Key Generation** → Create or import NOSTR keys
3. **Relay Selection** → Choose default relays
4. **Trust Bootstrap** → Import initial trust network
5. **Tutorial** → Interactive guide on first page

### Daily Usage Pattern
1. **Browse News** → Extension scans and highlights content
2. **View Verifications** → Click badges to see community checks
3. **Add Annotations** → Select text and contribute verifications
4. **Build Trust** → Consistent accurate annotations increase reputation
5. **Network Growth** → Discover and endorse other trustworthy users

## Privacy and Security Features

### Key Management
- **Hardware wallet integration** for high-security users
- **Key backup and recovery** with encrypted exports
- **Multi-device sync** with end-to-end encryption
- **Pseudonymous operation** with optional identity linking

### Content Protection
- **Local processing** for sensitive content analysis
- **Opt-in sharing** for private annotations
- **Selective relay publishing** for targeted audiences
- **Content fingerprinting** without full text exposure

## Performance Optimization

### Efficient Loading
- **Lazy loading** of verification data
- **Progressive enhancement** with graceful degradation
- **Background prefetching** for frequently visited sites
- **Compression** for large verification datasets

### Resource Management
- **Memory-efficient** claim caching
- **CPU throttling** for intensive analysis
- **Network batching** for multiple requests
- **Storage cleanup** for old verification data

This browser extension design provides a seamless, powerful interface for decentralized news verification while maintaining user privacy and system performance.