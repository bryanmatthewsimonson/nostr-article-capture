# NIP-URL Protocol Adoption Guide

A practical guide for developers implementing the NIP-URL Metadata Protocol in NOSTR clients, relays, and applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Implementation Checklist](#implementation-checklist)
3. [Code Examples](#code-examples)
4. [Integration Patterns](#integration-patterns)
5. [Testing Your Implementation](#testing-your-implementation)
6. [FAQ](#faq)
7. [Troubleshooting](#troubleshooting)
8. [Resources](#resources)

---

## Quick Start

### 5-Minute Overview

The NIP-URL protocol enables decentralized URL metadata on NOSTR. At its core:

1. **Normalize URLs** → Consistent format for comparison
2. **Hash URLs** → SHA-256 creates unique identifiers
3. **Create Events** → Standard NOSTR events with URL-specific tags
4. **Query by Hash** → Find all metadata for any URL

### Minimal Implementation

To create a basic annotation system, you need just three components:

```javascript
// 1. URL Normalization
function normalizeURL(url) {
  const parsed = new URL(url);
  
  // Lowercase scheme and host
  let normalized = parsed.protocol.toLowerCase() + '//';
  normalized += parsed.hostname.toLowerCase();
  
  // Remove default ports
  if ((parsed.protocol === 'https:' && parsed.port !== '443') ||
      (parsed.protocol === 'http:' && parsed.port !== '80')) {
    if (parsed.port) normalized += ':' + parsed.port;
  }
  
  // Add path (remove trailing slash unless root)
  let path = parsed.pathname;
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  normalized += path;
  
  // Sort and filter query params
  const params = new URLSearchParams(parsed.search);
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 
                          'utm_term', 'utm_content', 'fbclid', 'gclid'];
  trackingParams.forEach(p => params.delete(p));
  
  const sortedParams = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (sortedParams.length > 0) {
    normalized += '?' + new URLSearchParams(sortedParams).toString();
  }
  
  return normalized;
}

// 2. Hash Computation
async function hashURL(url) {
  const normalized = normalizeURL(url);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 3. Create Annotation Event
async function createAnnotation(url, content, type = 'note') {
  const urlHash = await hashURL(url);
  
  return {
    kind: 32123,
    tags: [
      ['d', `url:${urlHash}`],
      ['r', url],
      ['url-hash', urlHash],
      ['annotation-type', type]
    ],
    content: content,
    created_at: Math.floor(Date.now() / 1000)
  };
}
```

### First Annotation in 30 Seconds

```javascript
// Create and sign an annotation
const annotation = await createAnnotation(
  'https://example.com/article',
  'This article provides good context on the topic.',
  'context'
);

// Sign with your NOSTR library
const signedEvent = await signEvent(annotation, privateKey);

// Publish to relay
await relay.publish(signedEvent);
```

---

## Implementation Checklist

### Phase 1: Core Functionality (MVP)

- [ ] **URL Processing**
  - [ ] Implement URL normalization algorithm
  - [ ] Implement SHA-256 hash computation
  - [ ] Handle edge cases (IDN domains, special characters)
  - [ ] Cache normalized URLs and hashes

- [ ] **Basic Events**
  - [ ] Create kind 32123 annotation events
  - [ ] Query annotations by url-hash tag
  - [ ] Display annotations for current URL
  - [ ] Verify event signatures

- [ ] **User Interface**
  - [ ] Show annotation count for URLs
  - [ ] Display annotation list view
  - [ ] Create annotation form
  - [ ] Handle loading/error states

### Phase 2: Ratings & Reviews

- [ ] **Rating Events**
  - [ ] Create kind 32124 rating events
  - [ ] Support multiple rating dimensions
  - [ ] Calculate aggregate ratings
  - [ ] Display rating breakdowns

- [ ] **Comments**
  - [ ] Create kind 32126 comment events
  - [ ] Implement threaded replies
  - [ ] Show comment threads

### Phase 3: Trust Integration

- [ ] **Trust Display**
  - [ ] Fetch trust declarations for authors
  - [ ] Calculate basic trust scores
  - [ ] Display trust indicators

- [ ] **Trust Creation**
  - [ ] Create kind 30382 trust declarations
  - [ ] Support trust scopes
  - [ ] Handle trust revocations

### Phase 4: Fact-Checking

- [ ] **Fact-Check Events**
  - [ ] Create kind 32140 fact-check events
  - [ ] Support claim extraction
  - [ ] Display verdicts with evidence

- [ ] **Evidence Chain**
  - [ ] Create kind 32142 evidence citations
  - [ ] Link evidence to fact-checks
  - [ ] Display evidence quality scores

### Phase 5: Advanced Features

- [ ] **Disputes**
  - [ ] Create kind 32141 dispute events
  - [ ] Track dispute status
  - [ ] Display disputed content warnings

- [ ] **Archives**
  - [ ] Create kind 32143 archive events
  - [ ] Integrate with archive.org API
  - [ ] Display archive links

- [ ] **Reputation**
  - [ ] Implement reputation calculation
  - [ ] Display reputation scores
  - [ ] Publish reputation events (30386)

---

## Code Examples

### URL Normalization - Complete Implementation

```typescript
interface NormalizedURL {
  original: string;
  normalized: string;
  hash: string;
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_eid', 'mc_cid',
  '_ga', '_gl', 'igshid', 'share', 'ref_src', 'ref_url'
]);

export async function processURL(url: string): Promise<NormalizedURL> {
  const normalized = normalizeURL(url);
  const hash = await computeHash(normalized);
  
  return {
    original: url,
    normalized,
    hash
  };
}

function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    
    // 1. Lowercase scheme
    let scheme = parsed.protocol.toLowerCase();
    
    // 2. Lowercase host
    let host = parsed.hostname.toLowerCase();
    
    // 3. Handle ports
    let port = '';
    if (parsed.port) {
      const isDefaultPort = 
        (scheme === 'https:' && parsed.port === '443') ||
        (scheme === 'http:' && parsed.port === '80');
      if (!isDefaultPort) {
        port = ':' + parsed.port;
      }
    }
    
    // 4. Normalize path
    let path = decodeURIComponent(parsed.pathname);
    // Remove trailing slash (except for root)
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    // Re-encode path properly
    path = path.split('/').map(segment => 
      encodeURIComponent(decodeURIComponent(segment))
    ).join('/');
    
    // 5. Process query parameters
    const params = new URLSearchParams(parsed.search);
    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => params.delete(param));
    // Sort remaining parameters
    const sortedParams = [...params.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    let query = '';
    if (sortedParams.length > 0) {
      query = '?' + sortedParams
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    }
    
    // 6. Ignore fragment
    // (fragment is not included)
    
    return `${scheme}//${host}${port}${path}${query}`;
    
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function computeHash(normalizedURL: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedURL);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Creating Events - Factory Pattern

```typescript
import { Event } from 'nostr-tools';

export class URLEventFactory {
  private urlHash: string;
  private originalURL: string;
  
  constructor(originalURL: string, urlHash: string) {
    this.originalURL = originalURL;
    this.urlHash = urlHash;
  }
  
  createAnnotation(content: string, options: {
    type: 'note' | 'highlight' | 'correction' | 'context' | 'warning';
    title?: string;
    category?: string;
    confidence?: 'high' | 'medium' | 'low';
    source?: string;
    tags?: string[];
  }): Partial<Event> {
    const tags: string[][] = [
      ['d', `url:${this.urlHash}`],
      ['r', this.originalURL],
      ['url-hash', this.urlHash],
      ['annotation-type', options.type]
    ];
    
    if (options.title) tags.push(['title', options.title]);
    if (options.category) tags.push(['category', options.category]);
    if (options.confidence) tags.push(['confidence', options.confidence]);
    if (options.source) tags.push(['source', options.source]);
    options.tags?.forEach(t => tags.push(['t', t]));
    
    return {
      kind: 32123,
      tags,
      content,
      created_at: Math.floor(Date.now() / 1000)
    };
  }
  
  createRating(ratingType: string, score: number, maxScore: number, options?: {
    justification?: string;
    content?: string;
  }): Partial<Event> {
    const tags: string[][] = [
      ['d', `url-rating:${this.urlHash}`],
      ['r', this.originalURL],
      ['url-hash', this.urlHash],
      ['rating-type', ratingType],
      ['score', score.toString()],
      ['max-score', maxScore.toString()]
    ];
    
    if (options?.justification) {
      tags.push(['justification', options.justification]);
    }
    
    return {
      kind: 32124,
      tags,
      content: options?.content || '',
      created_at: Math.floor(Date.now() / 1000)
    };
  }
  
  createFactCheck(claims: string[], verdict: string, options?: {
    claimVerdicts?: { index: number; verdict: string }[];
    evidenceIds?: string[];
    methodology?: string;
    content?: string;
  }): Partial<Event> {
    const tags: string[][] = [
      ['r', this.originalURL],
      ['url-hash', this.urlHash],
      ['verdict', verdict]
    ];
    
    claims.forEach(claim => tags.push(['claim', claim]));
    
    options?.claimVerdicts?.forEach(cv => {
      tags.push(['claim-verdict', `${cv.index}:${cv.verdict}`]);
    });
    
    options?.evidenceIds?.forEach(id => tags.push(['evidence', id]));
    
    if (options?.methodology) {
      tags.push(['methodology', options.methodology]);
    }
    
    return {
      kind: 32140,
      tags,
      content: options?.content || '',
      created_at: Math.floor(Date.now() / 1000)
    };
  }
}

// Usage
const factory = new URLEventFactory(
  'https://example.com/article',
  'abc123...'
);

const annotation = factory.createAnnotation(
  'Important context about this article...',
  { type: 'context', confidence: 'high', tags: ['politics'] }
);
```

### Querying Events

```typescript
import { Filter, SimplePool } from 'nostr-tools';

export class URLMetadataClient {
  private pool: SimplePool;
  private relays: string[];
  
  constructor(relays: string[]) {
    this.pool = new SimplePool();
    this.relays = relays;
  }
  
  async getAnnotations(urlHash: string): Promise<Event[]> {
    const filter: Filter = {
      kinds: [32123],
      '#url-hash': [urlHash]
    };
    
    return await this.pool.querySync(this.relays, filter);
  }
  
  async getRatings(urlHash: string): Promise<Event[]> {
    const filter: Filter = {
      kinds: [32124],
      '#url-hash': [urlHash]
    };
    
    return await this.pool.querySync(this.relays, filter);
  }
  
  async getAllMetadata(urlHash: string): Promise<{
    annotations: Event[];
    ratings: Event[];
    factChecks: Event[];
    comments: Event[];
  }> {
    const filter: Filter = {
      kinds: [32123, 32124, 32126, 32140],
      '#url-hash': [urlHash]
    };
    
    const events = await this.pool.querySync(this.relays, filter);
    
    return {
      annotations: events.filter(e => e.kind === 32123),
      ratings: events.filter(e => e.kind === 32124),
      factChecks: events.filter(e => e.kind === 32140),
      comments: events.filter(e => e.kind === 32126)
    };
  }
  
  async getTrustDeclarations(pubkey: string): Promise<Event[]> {
    const filter: Filter = {
      kinds: [30382],
      '#p': [pubkey]
    };
    
    return await this.pool.querySync(this.relays, filter);
  }
  
  async getAggregateRating(urlHash: string, ratingType: string): Promise<{
    average: number;
    count: number;
    distribution: number[];
  }> {
    const ratings = await this.getRatings(urlHash);
    
    const relevantRatings = ratings.filter(e => {
      const typeTag = e.tags.find(t => t[0] === 'rating-type');
      return typeTag && typeTag[1] === ratingType;
    });
    
    if (relevantRatings.length === 0) {
      return { average: 0, count: 0, distribution: [] };
    }
    
    const scores = relevantRatings.map(e => {
      const scoreTag = e.tags.find(t => t[0] === 'score');
      const maxTag = e.tags.find(t => t[0] === 'max-score');
      if (!scoreTag || !maxTag) return 0;
      return (parseInt(scoreTag[1]) / parseInt(maxTag[1])) * 100;
    });
    
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Distribution in 10-point buckets
    const distribution = new Array(10).fill(0);
    scores.forEach(score => {
      const bucket = Math.min(9, Math.floor(score / 10));
      distribution[bucket]++;
    });
    
    return {
      average,
      count: scores.length,
      distribution
    };
  }
}
```

### Trust Score Calculation

```typescript
interface TrustScore {
  score: number;
  confidence: number;
  sources: number;
}

export class TrustCalculator {
  private client: URLMetadataClient;
  private cache: Map<string, { score: TrustScore; timestamp: number }>;
  private cacheTTL: number = 3600000; // 1 hour
  
  constructor(client: URLMetadataClient) {
    this.client = client;
    this.cache = new Map();
  }
  
  async calculateTrustScore(
    targetPubkey: string, 
    viewerPubkey: string,
    scope: string = 'global'
  ): Promise<TrustScore> {
    const cacheKey = `${targetPubkey}:${viewerPubkey}:${scope}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.score;
    }
    
    // Get direct trust declarations for target
    const trustDeclarations = await this.client.getTrustDeclarations(targetPubkey);
    
    if (trustDeclarations.length === 0) {
      return { score: 50, confidence: 0, sources: 0 }; // Neutral default
    }
    
    // Filter by scope
    const relevantDeclarations = trustDeclarations.filter(e => {
      const scopeTag = e.tags.find(t => t[0] === 'trust-scope');
      return !scopeTag || scopeTag[1] === scope || scopeTag[1] === 'global';
    });
    
    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const declaration of relevantDeclarations) {
      const levelTag = declaration.tags.find(t => t[0] === 'trust-level');
      if (!levelTag) continue;
      
      const trustLevel = parseInt(levelTag[1]);
      
      // Weight by recency (decay factor)
      const daysSince = (Date.now() / 1000 - declaration.created_at) / 86400;
      const decayFactor = Math.pow(0.99, daysSince);
      
      // Weight by distance from viewer (simplified - just check direct trust)
      const weight = decayFactor; // Could be enhanced with WoT traversal
      
      weightedSum += trustLevel * weight;
      totalWeight += weight;
    }
    
    const score: TrustScore = {
      score: totalWeight > 0 ? weightedSum / totalWeight : 50,
      confidence: Math.min(100, relevantDeclarations.length * 10),
      sources: relevantDeclarations.length
    };
    
    this.cache.set(cacheKey, { score, timestamp: Date.now() });
    
    return score;
  }
}
```

---

## Integration Patterns

### Browser Extension Integration

```typescript
// Content script - detect URL changes
function onURLChange(url: string) {
  const processed = await processURL(url);
  
  // Fetch metadata
  const metadata = await client.getAllMetadata(processed.hash);
  
  // Update badge
  chrome.runtime.sendMessage({
    type: 'UPDATE_BADGE',
    count: metadata.annotations.length + metadata.factChecks.length
  });
  
  // Inject sidebar data
  injectSidebarData(metadata);
}

// Listen for navigation
let lastURL = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastURL) {
    lastURL = window.location.href;
    onURLChange(lastURL);
  }
}).observe(document, { subtree: true, childList: true });
```

### React Component

```tsx
import React, { useState, useEffect } from 'react';
import { processURL } from './url-utils';
import { URLMetadataClient } from './client';

interface URLAnnotationsProps {
  url: string;
  relays: string[];
}

export function URLAnnotations({ url, relays }: URLAnnotationsProps) {
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchAnnotations() {
      try {
        setLoading(true);
        const { hash } = await processURL(url);
        const client = new URLMetadataClient(relays);
        const data = await client.getAnnotations(hash);
        setAnnotations(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAnnotations();
  }, [url, relays]);
  
  if (loading) return <div>Loading annotations...</div>;
  if (error) return <div>Error: {error}</div>;
  if (annotations.length === 0) return <div>No annotations yet</div>;
  
  return (
    <div className="url-annotations">
      <h3>{annotations.length} Annotations</h3>
      {annotations.map(event => (
        <AnnotationCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

### Server-Side Aggregation

```typescript
// Node.js service for pre-computing aggregations
import { SimplePool } from 'nostr-tools';

class AggregationService {
  private pool: SimplePool;
  private relays: string[];
  
  async computeURLStats(urlHash: string): Promise<URLStats> {
    const events = await this.pool.querySync(this.relays, {
      kinds: [32123, 32124, 32140],
      '#url-hash': [urlHash]
    });
    
    const stats: URLStats = {
      urlHash,
      annotationCount: 0,
      avgCredibility: null,
      factCheckVerdict: null,
      lastUpdated: 0
    };
    
    // Process events
    for (const event of events) {
      if (event.kind === 32123) stats.annotationCount++;
      
      if (event.kind === 32124) {
        const ratingType = event.tags.find(t => t[0] === 'rating-type')?.[1];
        if (ratingType === 'credibility') {
          const score = parseInt(event.tags.find(t => t[0] === 'score')?.[1] || '0');
          // Update running average...
        }
      }
      
      if (event.kind === 32140) {
        const verdict = event.tags.find(t => t[0] === 'verdict')?.[1];
        stats.factCheckVerdict = verdict;
      }
      
      stats.lastUpdated = Math.max(stats.lastUpdated, event.created_at);
    }
    
    return stats;
  }
}
```

---

## Testing Your Implementation

### URL Normalization Test Suite

```typescript
import { normalizeURL, computeHash } from './url-utils';

describe('URL Normalization', () => {
  test('lowercases scheme and host', () => {
    expect(normalizeURL('HTTPS://EXAMPLE.COM/Path'))
      .toBe('https://example.com/Path');
  });
  
  test('removes default ports', () => {
    expect(normalizeURL('https://example.com:443/page'))
      .toBe('https://example.com/page');
    expect(normalizeURL('http://example.com:80/page'))
      .toBe('http://example.com/page');
  });
  
  test('preserves non-default ports', () => {
    expect(normalizeURL('https://example.com:8080/page'))
      .toBe('https://example.com:8080/page');
  });
  
  test('removes trailing slash', () => {
    expect(normalizeURL('https://example.com/path/'))
      .toBe('https://example.com/path');
  });
  
  test('preserves root trailing slash', () => {
    expect(normalizeURL('https://example.com/'))
      .toBe('https://example.com/');
  });
  
  test('sorts query parameters', () => {
    expect(normalizeURL('https://example.com/page?b=2&a=1'))
      .toBe('https://example.com/page?a=1&b=2');
  });
  
  test('removes fragments', () => {
    expect(normalizeURL('https://example.com/page#section'))
      .toBe('https://example.com/page');
  });
  
  test('removes tracking parameters', () => {
    expect(normalizeURL('https://example.com/page?utm_source=twitter&id=123'))
      .toBe('https://example.com/page?id=123');
  });
});

describe('Hash Computation', () => {
  test('produces consistent hashes', async () => {
    const hash1 = await computeHash('https://example.com/');
    const hash2 = await computeHash('https://example.com/');
    expect(hash1).toBe(hash2);
  });
  
  test('equivalent URLs produce same hash', async () => {
    const url1 = 'https://example.com/page?b=2&a=1';
    const url2 = 'HTTPS://EXAMPLE.COM/page?a=1&b=2';
    
    const hash1 = await computeHash(normalizeURL(url1));
    const hash2 = await computeHash(normalizeURL(url2));
    
    expect(hash1).toBe(hash2);
  });
});
```

### Event Validation Test Suite

```typescript
import { validateAnnotation, validateRating } from './validators';

describe('Annotation Validation', () => {
  test('valid annotation passes', () => {
    const event = {
      kind: 32123,
      tags: [
        ['d', 'url:abc123'],
        ['r', 'https://example.com'],
        ['url-hash', 'abc123'],
        ['annotation-type', 'note']
      ],
      content: 'Test'
    };
    
    expect(validateAnnotation(event)).toBe(true);
  });
  
  test('missing url-hash fails', () => {
    const event = {
      kind: 32123,
      tags: [
        ['d', 'url:abc123'],
        ['r', 'https://example.com'],
        ['annotation-type', 'note']
      ],
      content: 'Test'
    };
    
    expect(validateAnnotation(event)).toBe(false);
  });
  
  test('invalid annotation-type fails', () => {
    const event = {
      kind: 32123,
      tags: [
        ['d', 'url:abc123'],
        ['r', 'https://example.com'],
        ['url-hash', 'abc123'],
        ['annotation-type', 'invalid']
      ],
      content: 'Test'
    };
    
    expect(validateAnnotation(event)).toBe(false);
  });
});

describe('Rating Validation', () => {
  test('score exceeding max-score fails', () => {
    const event = {
      kind: 32124,
      tags: [
        ['d', 'url-rating:abc123'],
        ['r', 'https://example.com'],
        ['url-hash', 'abc123'],
        ['rating-type', 'credibility'],
        ['score', '150'],
        ['max-score', '100']
      ]
    };
    
    expect(validateRating(event)).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { URLMetadataClient } from './client';

describe('Integration Tests', () => {
  let client: URLMetadataClient;
  
  beforeAll(() => {
    client = new URLMetadataClient(['wss://relay.damus.io']);
  });
  
  test('round-trip annotation', async () => {
    const url = 'https://example.com/test-' + Date.now();
    const { hash } = await processURL(url);
    
    // Create annotation
    const event = createAnnotation(url, hash, 'Test annotation', 'note');
    const signedEvent = await signEvent(event, testPrivateKey);
    await client.publish(signedEvent);
    
    // Query annotation
    const annotations = await client.getAnnotations(hash);
    
    expect(annotations).toContainEqual(
      expect.objectContaining({ id: signedEvent.id })
    );
  });
});
```

---

## FAQ

### General Questions

**Q: What event kinds does this protocol use?**

A: The protocol uses kinds 32123-32144 for URL metadata events and kinds 30382-30386 for trust events. See the [NIP-URL-METADATA.md](../NIP-URL-METADATA.md) specification for the complete registry.

**Q: Is this compatible with existing NOSTR clients?**

A: Yes. The protocol uses standard NOSTR event structures. Non-compatible clients will simply ignore these event kinds. Compatible clients can progressively enhance their support.

**Q: Do I need to implement everything?**

A: No. Start with the minimum viable implementation (URL normalization, hashing, and basic annotations). Add features incrementally based on your use case.

**Q: Which relays support this protocol?**

A: Any NIP-01 compliant relay supports these events. For optimized querying, look for relays that index the `url-hash` tag. The reference implementation works with standard relays.

### Technical Questions

**Q: Why use SHA-256 hashes instead of the URL directly?**

A: Hashes provide:
1. Consistent identifiers regardless of URL encoding variations
2. Privacy (relays don't see which URLs are being annotated)
3. Fixed-length keys for efficient indexing
4. Resistance to URL manipulation attacks

**Q: How do I handle URL redirects?**

A: Follow redirects to get the canonical URL before normalization. Consider storing both the original and canonical URLs in your events.

**Q: What if two clients normalize URLs differently?**

A: This is why the specification includes strict normalization rules. Follow them exactly. The interoperability test cases help verify your implementation.

**Q: How should I handle rate limiting?**

A: Implement client-side throttling before publishing. Cache aggressively. Use subscription filters efficiently to reduce relay load.

**Q: Can I extend the event schemas?**

A: Yes. Add custom tags prefixed with your identifier (e.g., `x-myapp-custom`). Don't modify the meaning of standard tags.

### Trust System Questions

**Q: How do I bootstrap trust for new users?**

A: New users start with neutral trust (50). They build reputation through:
1. Quality contributions
2. Receiving trust declarations from established users
3. Domain expertise verification

**Q: Is trust score mandatory to display?**

A: No, but recommended. At minimum, show the author's pubkey. Display trust when available to help users assess credibility.

**Q: How do I prevent trust manipulation?**

A: The protocol includes several defenses:
1. Trust weighted by truster's reputation
2. Time decay on trust declarations
3. Rate limiting on trust changes
4. Detection of trust rings

---

## Troubleshooting

### Common Issues

**Issue: Different hashes for the same URL**

Possible causes:
- URL normalization differences
- Encoding issues
- Trailing slash handling

Solution: Verify your normalization against the test vectors in the specification.

**Issue: Events not appearing on relays**

Possible causes:
- Event validation failing
- Relay rejecting event kind
- Network issues

Solution: Check relay responses for error messages. Verify event structure against schemas.

**Issue: Slow query performance**

Possible causes:
- Querying too many relays
- Not using tag filters
- Missing indexes on relay

Solution: Use specific tag filters. Query fewer relays. Consider relay-side aggregation.

**Issue: Trust scores inconsistent across clients**

Possible causes:
- Different calculation algorithms
- Cache staleness
- Different trust data available

Solution: Use the standard algorithm. Document deviations. Include algorithm version in published scores.

---

## Resources

### Specifications

- [NIP-URL-METADATA.md](../NIP-URL-METADATA.md) - Full protocol specification
- [nostr-event-schemas.md](../nostr-event-schemas.md) - Detailed event schemas
- [trust-reputation-system.md](./trust-reputation-system.md) - Trust system design
- [evidentiary-standards.md](./evidentiary-standards.md) - Evidence framework

### Libraries

- **nostr-tools** - Core NOSTR library (JavaScript/TypeScript)
- **rust-nostr** - Rust implementation
- **python-nostr** - Python library

### Reference Implementation

- Browser Extension: [nostr-article-capture](../nostr-article-capture/)
- (Additional implementations to be added)

### Community

- NOSTR Protocol GitHub
- NIP Discussion Forums
- Developer Discord/Telegram

### Related NIPs

- NIP-01: Basic protocol
- NIP-10: Reply threading
- NIP-33: Parameterized replaceable events
- NIP-51: Lists
- NIP-56: Reporting

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-25 | Initial release |

---

## Contributing

Found an issue or want to improve this guide? 

1. File an issue describing the problem or enhancement
2. Submit a PR with your changes
3. Join the discussion in the developer community

This guide is maintained alongside the NIP-URL protocol specification.
