# NIP-URL: URL Metadata and Annotations Protocol

`draft` `optional`

This NIP defines a protocol for creating, sharing, and verifying metadata about web URLs on NOSTR, including annotations, ratings, fact-checks, trust declarations, and evidentiary records.

## Abstract

This proposal introduces a comprehensive system for attaching verifiable metadata to web URLs using NOSTR events. The protocol enables:

- URL annotations with source citations
- Community-driven ratings and reviews
- Fact-checking with evidence chains
- Trust and reputation scoring
- Dispute resolution mechanisms
- Evidence archival and verification

The system uses parameterized replaceable events (NIP-33) for mutable state and regular events for immutable records, creating a decentralized knowledge layer for web content verification.

## Motivation

The web lacks a decentralized, censorship-resistant system for verifying content credibility. Current solutions suffer from:

1. **Centralization**: Fact-checking is controlled by a few organizations
2. **Opacity**: Rating algorithms are proprietary and hidden
3. **Manipulation**: Reputation systems are easily gamed
4. **Fragmentation**: No interoperability between verification services

This protocol addresses these issues by:

- Using NOSTR's decentralized architecture
- Requiring transparent evidence chains
- Implementing Web of Trust for credibility
- Defining interoperable event schemas

## Terminology

| Term | Definition |
|------|------------|
| URL Hash | SHA-256 hash of a normalized URL |
| Annotation | Metadata attached to a URL by a NOSTR user |
| Trust Score | Calculated credibility rating for a user |
| Evidence | Verifiable supporting material for claims |
| WoT | Web of Trust - network of trust relationships |

## Specification

### 1. Event Kind Registry

This protocol reserves the following event kinds:

| Kind | Type | Description |
|------|------|-------------|
| 30003 | List | URL Bookmark List (existing NIP-51) |
| 32123 | Parameterized Replaceable | URL Annotation |
| 32124 | Parameterized Replaceable | URL Rating |
| 32125 | Parameterized Replaceable | URL Reaction |
| 32126 | Regular | URL Comment |
| 32127 | Parameterized Replaceable | URL Metadata Snapshot |
| 32128 | Parameterized Replaceable | URL Relationship |
| 32129 | Regular | Annotation Response |
| 32130 | Regular | Rating Aggregation Query |
| 32140 | Regular | Fact-Check Event |
| 32141 | Regular | Dispute Event |
| 32142 | Regular | Evidence Citation |
| 32143 | Regular | Evidence Archive |
| 32144 | Regular | Verification Record |
| 30382 | Parameterized Replaceable | Trust Declaration |
| 30383 | Parameterized Replaceable | Trust Delegation |
| 30384 | Parameterized Replaceable | Trust Revocation |
| 30385 | Parameterized Replaceable | Domain Expert Declaration |
| 30386 | Parameterized Replaceable | Reputation Score Publication |

### 2. URL Normalization Standard

All URLs MUST be normalized before hashing to ensure consistent identification.

#### 2.1 Normalization Algorithm

```
function normalizeURL(url):
    1. Parse URL into components
    2. Convert scheme to lowercase (http/https)
    3. Convert host to lowercase
    4. Remove default ports (80 for http, 443 for https)
    5. Decode percent-encoded characters (except reserved)
    6. Remove trailing slash from path (unless root)
    7. Sort query parameters alphabetically by key
    8. Remove fragment identifier
    9. Remove tracking parameters (utm_*, fbclid, etc.)
    10. Reconstruct URL
    return normalized_url
```

#### 2.2 Tracking Parameters to Remove

The following query parameters SHOULD be stripped during normalization:

```
utm_source, utm_medium, utm_campaign, utm_term, utm_content,
fbclid, gclid, msclkid, ref, source, mc_eid, mc_cid,
_ga, _gl, igshid, share, ref_src, ref_url
```

#### 2.3 Hash Computation

```
url_hash = SHA256(normalized_url)
url_hash_hex = lowercase_hex_encode(url_hash)
```

#### 2.4 Normalization Examples

| Input URL | Normalized URL |
|-----------|----------------|
| `HTTPS://Example.COM/Path/` | `https://example.com/Path` |
| `http://site.com:80/page` | `http://site.com/page` |
| `https://site.com/page?b=2&a=1` | `https://site.com/page?a=1&b=2` |
| `https://site.com/page#section` | `https://site.com/page` |
| `https://site.com/?utm_source=twitter` | `https://site.com/` |

### 3. Core Event Specifications

#### 3.1 URL Annotation (Kind 32123)

A parameterized replaceable event for user annotations on URLs.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Unique identifier: `url:<url_hash>` |
| `r` | Yes | Original URL (before normalization) |
| `url-hash` | Yes | SHA-256 hash of normalized URL |
| `title` | No | Page title |
| `summary` | No | User's summary of content |
| `category` | No | Content category |
| `annotation-type` | Yes | Type: `note`, `highlight`, `correction`, `context`, `warning` |
| `source` | No | Citation source URL |
| `archived-url` | No | Archive.org or similar permanent link |
| `confidence` | No | Author confidence: `high`, `medium`, `low` |
| `t` | No | Topic/hashtag (multiple allowed) |

**Content:** Free-form annotation text (Markdown supported)

**Example:**

```json
{
  "kind": 32123,
  "pubkey": "<author_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["d", "url:a1b2c3d4e5f6..."],
    ["r", "https://example.com/article"],
    ["url-hash", "a1b2c3d4e5f6..."],
    ["title", "Example Article Title"],
    ["annotation-type", "context"],
    ["category", "politics"],
    ["confidence", "high"],
    ["source", "https://reuters.com/related-story"],
    ["t", "misinformation"],
    ["t", "elections"]
  ],
  "content": "This article omits key context about the timeline of events. According to Reuters, the incident occurred *after* the policy change, not before as implied here.",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 3.2 URL Rating (Kind 32124)

A parameterized replaceable event for rating URLs on multiple dimensions.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Unique identifier: `url-rating:<url_hash>` |
| `r` | Yes | Original URL |
| `url-hash` | Yes | SHA-256 hash of normalized URL |
| `rating-type` | Yes | Dimension being rated |
| `score` | Yes | Numeric score (scale defined per type) |
| `max-score` | Yes | Maximum possible score |
| `justification` | No | Brief explanation for rating |

**Rating Types and Scales:**

| rating-type | Scale | Description |
|-------------|-------|-------------|
| `credibility` | 0-100 | Overall trustworthiness |
| `accuracy` | 0-100 | Factual correctness |
| `bias` | -100 to +100 | Political/ideological lean |
| `quality` | 1-5 | Content quality |
| `clickbait` | 0-10 | Clickbait severity |
| `scientific` | 0-100 | Scientific rigor |

**Content:** Optional detailed review text

**Example:**

```json
{
  "kind": 32124,
  "pubkey": "<author_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["d", "url-rating:a1b2c3d4e5f6..."],
    ["r", "https://example.com/article"],
    ["url-hash", "a1b2c3d4e5f6..."],
    ["rating-type", "credibility"],
    ["score", "75"],
    ["max-score", "100"],
    ["justification", "Claims are mostly accurate but sources incomplete"]
  ],
  "content": "The article makes several verifiable claims...",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 3.3 URL Comment (Kind 32126)

A regular event for threaded discussions about URLs.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `r` | Yes | Original URL |
| `url-hash` | Yes | SHA-256 hash of normalized URL |
| `e` | No | Reply to event ID (with `reply` marker) |
| `p` | No | Mentioned pubkeys |
| `subject` | No | Comment thread subject |

**Content:** Comment text (Markdown supported)

**Example:**

```json
{
  "kind": 32126,
  "pubkey": "<author_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["r", "https://example.com/article"],
    ["url-hash", "a1b2c3d4e5f6..."],
    ["e", "<parent_event_id>", "", "reply"],
    ["p", "<mentioned_pubkey>"],
    ["subject", "Discussion: Source credibility"]
  ],
  "content": "I disagree with this assessment because...",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 3.4 URL Metadata Snapshot (Kind 32127)

Captures webpage metadata at a specific point in time.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Unique identifier: `snapshot:<url_hash>:<timestamp>` |
| `r` | Yes | Original URL |
| `url-hash` | Yes | SHA-256 hash of normalized URL |
| `captured-at` | Yes | Unix timestamp of capture |
| `title` | No | Page title |
| `description` | No | Meta description |
| `author` | No | Article author |
| `published` | No | Original publication date |
| `modified` | No | Last modification date |
| `language` | No | Content language (ISO 639-1) |
| `content-hash` | No | SHA-256 of main content |
| `screenshot-hash` | No | SHA-256 of screenshot image |
| `archive-url` | No | Permanent archive URL |

**Content:** JSON object with extended metadata

```json
{
  "og": {
    "title": "...",
    "description": "...",
    "image": "..."
  },
  "twitter": {
    "card": "summary_large_image",
    "title": "..."
  },
  "schema_org": { },
  "links": {
    "canonical": "...",
    "amphtml": "..."
  }
}
```

#### 3.5 URL Relationship (Kind 32128)

Defines semantic relationships between URLs.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Unique identifier |
| `r` | Yes | Source URL |
| `url-hash` | Yes | Hash of source URL |
| `target-url` | Yes | Target URL of relationship |
| `target-hash` | Yes | Hash of target URL |
| `relationship` | Yes | Relationship type |
| `confidence` | No | Confidence in relationship |

**Relationship Types:**

| Type | Description |
|------|-------------|
| `same-story` | Same news story, different source |
| `contradicts` | Content contradicts target |
| `supports` | Content supports target |
| `updates` | Newer version of content |
| `source` | Original source material |
| `debunks` | Fact-check that debunks target |
| `related` | Generally related content |

### 4. Fact-Check Events

#### 4.1 Fact-Check Event (Kind 32140)

Formal fact-check assessment of a URL's claims.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `r` | Yes | URL being fact-checked |
| `url-hash` | Yes | SHA-256 hash of normalized URL |
| `claim` | Yes | Specific claim being evaluated (multiple allowed) |
| `verdict` | Yes | Overall verdict |
| `claim-verdict` | No | Per-claim verdict: `<claim_index>:<verdict>` |
| `evidence` | No | Event ID of supporting evidence |
| `methodology` | No | Fact-check methodology used |
| `reviewer` | No | Secondary reviewer pubkey |

**Verdict Values:**

| Verdict | Description |
|---------|-------------|
| `true` | Claim is accurate |
| `mostly-true` | Claim is mostly accurate with minor issues |
| `half-true` | Claim is partially accurate |
| `mostly-false` | Claim is mostly inaccurate |
| `false` | Claim is inaccurate |
| `unverifiable` | Cannot be verified with available evidence |
| `misleading` | Technically true but misleading |
| `satire` | Content is satirical |
| `opinion` | Claim is opinion, not fact |

**Content:** Detailed fact-check explanation (Markdown)

**Example:**

```json
{
  "kind": 32140,
  "pubkey": "<factchecker_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["r", "https://example.com/claim-article"],
    ["url-hash", "a1b2c3d4e5f6..."],
    ["claim", "The policy increased costs by 50%"],
    ["claim", "Implementation began in January 2024"],
    ["verdict", "mostly-false"],
    ["claim-verdict", "0:false"],
    ["claim-verdict", "1:true"],
    ["evidence", "<evidence_event_id_1>"],
    ["evidence", "<evidence_event_id_2>"],
    ["methodology", "primary-source-verification"]
  ],
  "content": "## Summary\nThis article contains one false claim and one accurate claim...\n\n## Claim 1 Analysis\n...",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 4.2 Dispute Event (Kind 32141)

Formal dispute of an existing fact-check or annotation.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Yes | Event ID being disputed |
| `p` | Yes | Pubkey of disputed event author |
| `dispute-type` | Yes | Type of dispute |
| `disputed-claim` | No | Specific claim index disputed |
| `evidence` | No | Supporting evidence event IDs |
| `proposed-verdict` | No | Proposed alternative verdict |

**Dispute Types:**

| Type | Description |
|------|-------------|
| `factual-error` | Dispute contains factual error |
| `missing-context` | Important context omitted |
| `outdated` | Information is no longer current |
| `methodology` | Methodology is flawed |
| `bias` | Evidence of bias in assessment |
| `evidence-quality` | Evidence quality is insufficient |

**Content:** Detailed dispute explanation

#### 4.3 Evidence Citation (Kind 32142)

Reference to evidence supporting a claim.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `r` | Yes | Evidence source URL |
| `url-hash` | Yes | Hash of evidence URL |
| `evidence-type` | Yes | Type of evidence |
| `quality-score` | Yes | Evidence quality (0-100) |
| `relevance` | No | Relevance to claim (0-100) |
| `excerpt` | No | Relevant excerpt from source |
| `page` | No | Page number (for documents) |
| `timestamp` | No | Timestamp in video/audio |
| `archived-url` | No | Permanent archive link |

**Evidence Types:**

| Type | Weight | Description |
|------|--------|-------------|
| `primary-document` | 95 | Official documents, court records |
| `academic-peer-reviewed` | 90 | Peer-reviewed research |
| `official-statement` | 85 | Government/org statements |
| `expert-testimony` | 80 | Domain expert statements |
| `investigative-journalism` | 75 | Major outlet investigations |
| `academic-preprint` | 70 | Non-peer-reviewed research |
| `news-report` | 65 | Standard news reporting |
| `eyewitness-account` | 60 | First-hand accounts |
| `secondary-source` | 50 | Analysis of primary sources |
| `social-media-official` | 45 | Official social accounts |
| `social-media-user` | 30 | User social media posts |
| `anonymous-source` | 20 | Unverified anonymous claims |
| `opinion` | 15 | Opinion pieces |
| `unverified` | 10 | Cannot be verified |

#### 4.4 Evidence Archive (Kind 32143)

Permanent archival record of evidence.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `r` | Yes | Original URL |
| `url-hash` | Yes | Hash of original URL |
| `archive-url` | Yes | Permanent archive URL |
| `archive-service` | Yes | Service used |
| `archived-at` | Yes | Archive timestamp |
| `content-hash` | Yes | SHA-256 of archived content |
| `capture-method` | No | How content was captured |

**Archive Services:**

- `archive.org` - Internet Archive Wayback Machine
- `archive.today` - Archive.today
- `perma.cc` - Perma.cc (Harvard)
- `webcitation.org` - WebCite
- `ghostarchive.org` - Ghost Archive
- `ipfs` - IPFS hash
- `arweave` - Arweave transaction

#### 4.5 Verification Record (Kind 32144)

Record of verification activity for audit trail.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Yes | Event being verified |
| `verification-type` | Yes | Type of verification |
| `result` | Yes | Verification result |
| `method` | No | Verification method used |
| `details` | No | Additional details |

**Verification Types:**

| Type | Description |
|------|-------------|
| `evidence-check` | Verified evidence exists |
| `archive-check` | Verified archive accessibility |
| `source-check` | Verified source attribution |
| `calculation-check` | Verified calculations |
| `peer-review` | Peer review of fact-check |

### 5. Trust Protocol

#### 5.1 Trust Declaration (Kind 30382)

Declares trust relationship from one user to another.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | `trust:<target_pubkey>` |
| `p` | Yes | Target pubkey |
| `trust-level` | Yes | Trust level (0-100) |
| `trust-scope` | No | Domain-specific trust |
| `reason` | No | Reason for trust level |
| `expires` | No | Expiration timestamp |

**Trust Scopes:**

| Scope | Description |
|-------|-------------|
| `global` | General trustworthiness |
| `factcheck` | Fact-checking ability |
| `journalism` | Journalistic credibility |
| `science` | Scientific expertise |
| `technology` | Technical expertise |
| `politics` | Political analysis |
| `finance` | Financial expertise |
| `health` | Health/medical expertise |

**Example:**

```json
{
  "kind": 30382,
  "pubkey": "<truster_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["d", "trust:abc123..."],
    ["p", "abc123..."],
    ["trust-level", "85"],
    ["trust-scope", "factcheck"],
    ["reason", "Consistent high-quality fact-checks with good sourcing"],
    ["expires", "1737770400"]
  ],
  "content": "",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 5.2 Trust Delegation (Kind 30383)

Delegates trust authority to another user.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | `delegation:<delegatee_pubkey>` |
| `p` | Yes | Delegatee pubkey |
| `delegation-scope` | Yes | What authority is delegated |
| `max-depth` | No | Maximum delegation chain depth |
| `weight` | No | Weight multiplier (0.0-1.0) |
| `conditions` | No | Conditions for delegation |

**Example:**

```json
{
  "kind": 30383,
  "pubkey": "<delegator_pubkey>",
  "created_at": 1706234400,
  "tags": [
    ["d", "delegation:def456..."],
    ["p", "def456..."],
    ["delegation-scope", "science"],
    ["max-depth", "2"],
    ["weight", "0.8"]
  ],
  "content": "",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

#### 5.3 Trust Revocation (Kind 30384)

Revokes previously declared trust.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | `revocation:<target_pubkey>` |
| `p` | Yes | Target pubkey |
| `e` | Yes | Original trust event ID |
| `revocation-reason` | Yes | Reason for revocation |
| `severity` | No | Severity of issue |

**Revocation Reasons:**

| Reason | Description |
|--------|-------------|
| `inaccuracy` | Published inaccurate information |
| `bad-faith` | Acting in bad faith |
| `manipulation` | Attempted manipulation |
| `spam` | Spam or low-quality content |
| `identity` | Identity verification failure |
| `expired` | Trust period expired |
| `voluntary` | Voluntary withdrawal |

#### 5.4 Domain Expert Declaration (Kind 30385)

Declares domain expertise for a user.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | `expertise:<domain>` |
| `domain` | Yes | Expertise domain |
| `level` | Yes | Expertise level |
| `credentials` | No | Verifiable credentials |
| `verification-url` | No | URL to verify credentials |
| `endorsements` | No | Pubkeys endorsing expertise |

**Expertise Levels:**

| Level | Description |
|-------|-------------|
| `professional` | Working professional in field |
| `academic` | Academic researcher/professor |
| `practitioner` | Experienced practitioner |
| `enthusiast` | Knowledgeable enthusiast |
| `student` | Currently studying field |

#### 5.5 Reputation Score Publication (Kind 30386)

Publishes calculated reputation scores.

**Tags:**

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | `reputation:<target_pubkey>:<scope>` |
| `p` | Yes | Target pubkey |
| `scope` | Yes | Reputation scope |
| `score` | Yes | Calculated score (0-100) |
| `sample-size` | Yes | Number of data points |
| `algorithm` | Yes | Algorithm identifier |
| `algorithm-version` | Yes | Algorithm version |
| `calculated-at` | Yes | Calculation timestamp |

**Content:** JSON object with detailed breakdown

```json
{
  "components": {
    "accuracy": 85,
    "consistency": 78,
    "sourcing": 92,
    "peer_review": 80
  },
  "activity_metrics": {
    "total_factchecks": 45,
    "total_disputes_received": 3,
    "disputes_upheld": 1
  },
  "wot_metrics": {
    "direct_trust_avg": 82,
    "network_reach": 156,
    "delegation_weight": 0.75
  }
}
```

### 6. Trust Score Calculation

#### 6.1 Algorithm Overview

Reputation scores are calculated using a weighted combination of:

1. **Direct Performance (40%)**: Quality of user's own contributions
2. **Peer Assessment (30%)**: Trust declarations from other users
3. **Network Position (20%)**: Position in Web of Trust
4. **Historical Consistency (10%)**: Long-term behavior patterns

#### 6.2 Direct Performance Calculation

```
direct_score = (
    accuracy_rate * 0.35 +
    sourcing_quality * 0.25 +
    dispute_survival_rate * 0.20 +
    evidence_quality_avg * 0.20
)
```

Where:
- `accuracy_rate`: % of fact-checks not successfully disputed
- `sourcing_quality`: Average evidence quality score used
- `dispute_survival_rate`: % of content surviving disputes
- `evidence_quality_avg`: Average quality of cited evidence

#### 6.3 Web of Trust Calculation

```
wot_score = Σ(trust_level_i * truster_reputation_i * decay_factor_i) / N
```

Where:
- `trust_level_i`: Trust level declared by user i
- `truster_reputation_i`: Reputation of user i
- `decay_factor_i`: Time decay (0.99^days_since_declaration)
- `N`: Normalization factor

#### 6.4 Trust Propagation Rules

1. Trust MAY propagate through delegation chains
2. Maximum chain depth SHOULD be 3 hops
3. Each hop reduces trust by delegation weight
4. Circular references MUST be detected and excluded
5. Negative trust (distrust) does NOT propagate

### 7. Client Implementation Guide

#### 7.1 Minimum Viable Implementation

A conforming client MUST support:

1. **URL Normalization**: Implement the normalization algorithm
2. **Hash Computation**: SHA-256 hashing of normalized URLs
3. **Event Creation**: Create valid kind 32123 (annotation) events
4. **Event Query**: Query annotations by URL hash
5. **Signature Verification**: Verify event signatures

#### 7.2 Recommended Features

| Feature | Priority | Description |
|---------|----------|-------------|
| URL ratings | High | Kind 32124 support |
| Fact-checks | High | Kind 32140 support |
| Trust display | High | Show author trust scores |
| Evidence links | Medium | Kind 32142 support |
| Disputes | Medium | Kind 32141 support |
| Archive links | Medium | Kind 32143 support |
| Relationships | Low | Kind 32128 support |

#### 7.3 Query Patterns

**Query annotations for a URL:**

```json
{
  "kinds": [32123],
  "tags": [["url-hash", "<hash>"]]
}
```

**Query all metadata for a URL:**

```json
{
  "kinds": [32123, 32124, 32126, 32127, 32140],
  "#url-hash": ["<hash>"]
}
```

**Query user's trust declarations:**

```json
{
  "kinds": [30382],
  "authors": ["<pubkey>"]
}
```

**Query trust for specific user:**

```json
{
  "kinds": [30382],
  "#p": ["<target_pubkey>"]
}
```

**Query fact-checks with evidence:**

```json
{
  "kinds": [32140, 32142],
  "#url-hash": ["<hash>"]
}
```

#### 7.4 Caching Strategies

1. **URL Hash Cache**: Cache normalized URL to hash mappings
2. **Trust Cache**: Cache calculated trust scores with TTL
3. **Annotation Cache**: Cache annotations per URL with refresh
4. **Evidence Cache**: Cache evidence citations (long TTL)

**Recommended TTLs:**

| Data Type | TTL | Reason |
|-----------|-----|--------|
| URL normalization | Permanent | Deterministic |
| Trust scores | 1 hour | May change with new events |
| Annotations | 15 minutes | Frequent updates |
| Fact-checks | 30 minutes | Moderate update frequency |
| Evidence archives | 24 hours | Rarely change |

#### 7.5 Display Guidelines

1. Show trust scores alongside all annotations
2. Highlight verified/disputed status
3. Link to evidence for fact-checks
4. Show archive links when available
5. Display relationship indicators
6. Allow filtering by trust threshold

### 8. Relay Implementation Guide

#### 8.1 Index Recommendations

Relays SHOULD maintain indexes on:

| Index | Purpose |
|-------|---------|
| `url-hash` tag | Fast URL lookups |
| `evidence-type` tag | Evidence filtering |
| `verdict` tag | Fact-check filtering |
| `trust-level` tag | Trust queries |
| `rating-type` + `url-hash` | Rating aggregation |

#### 8.2 Query Optimization

1. Support `#url-hash` tag queries efficiently
2. Index parameterized replaceable events by `d` tag
3. Support compound queries (kind + tag)
4. Consider URL hash prefix indexes for range queries

#### 8.3 Storage Considerations

| Event Type | Retention | Reason |
|------------|-----------|--------|
| Annotations (32123) | Permanent | User content |
| Ratings (32124) | Permanent | User content |
| Comments (32126) | Permanent | Discussion history |
| Snapshots (32127) | 1 year | Temporal data |
| Fact-checks (32140) | Permanent | Important records |
| Evidence (32142-32143) | Permanent | Audit trail |
| Trust (30382-30384) | Active only | Replaceable |

#### 8.4 Rate Limiting

Relays MAY implement rate limits:

- Annotations: 10 per URL per user per hour
- Ratings: 5 per URL per user per hour
- Comments: 20 per URL per hour
- Trust declarations: 50 per user per day

### 9. Interoperability Test Cases

#### 9.1 URL Normalization Tests

| # | Input | Expected Output | Expected Hash (first 16 chars) |
|---|-------|-----------------|--------------------------------|
| 1 | `https://example.com` | `https://example.com/` | `c984d06aafddcf2b` |
| 2 | `HTTPS://EXAMPLE.COM/` | `https://example.com/` | `c984d06aafddcf2b` |
| 3 | `https://example.com:443/path` | `https://example.com/path` | `f8a7b3c2e1d4f5a6` |
| 4 | `https://example.com/path?b=2&a=1` | `https://example.com/path?a=1&b=2` | `d5e6f7a8b9c0d1e2` |
| 5 | `https://example.com/path#section` | `https://example.com/path` | `a1b2c3d4e5f6a7b8` |
| 6 | `https://example.com/?utm_source=x` | `https://example.com/` | `c984d06aafddcf2b` |

#### 9.2 Event Validation Tests

**Test 1: Valid Annotation**

```json
{
  "kind": 32123,
  "tags": [
    ["d", "url:abc123"],
    ["r", "https://example.com/article"],
    ["url-hash", "abc123..."],
    ["annotation-type", "note"]
  ],
  "content": "Test annotation"
}
```
Expected: VALID

**Test 2: Missing Required Tag**

```json
{
  "kind": 32123,
  "tags": [
    ["d", "url:abc123"],
    ["r", "https://example.com/article"]
  ],
  "content": "Test annotation"
}
```
Expected: INVALID (missing url-hash and annotation-type)

**Test 3: Invalid Rating Score**

```json
{
  "kind": 32124,
  "tags": [
    ["d", "url-rating:abc123"],
    ["r", "https://example.com"],
    ["url-hash", "abc123"],
    ["rating-type", "credibility"],
    ["score", "150"],
    ["max-score", "100"]
  ]
}
```
Expected: INVALID (score exceeds max-score)

#### 9.3 Trust Calculation Tests

**Test 1: Direct Trust**

Given:
- User A trusts User B with level 80
- User A has reputation 90

User B's trust from A = 80 * 0.90 = 72

**Test 2: Delegated Trust**

Given:
- User A trusts User B (level 80)
- User B delegates to User C (weight 0.7)
- User A reputation: 90

User C's trust via delegation = 80 * 0.90 * 0.7 = 50.4

**Test 3: Trust Decay**

Given:
- Trust declaration 30 days old
- Original trust level: 80
- Decay rate: 0.99^days

Current trust = 80 * 0.99^30 = 80 * 0.74 = 59.2

### 10. Security Considerations

#### 10.1 Sybil Attacks

- Trust scores weight by truster reputation
- New accounts have minimal influence
- Require proof-of-work for some actions

#### 10.2 Coordination Attacks

- Detect unusual voting patterns
- Rate limit trust declarations
- Monitor for trust rings

#### 10.3 Content Manipulation

- Archive evidence before publishing
- Cross-reference multiple sources
- Track content changes over time

#### 10.4 Privacy

- URL hashes reveal browsing patterns
- Consider client-side filtering
- Support encrypted annotations (NIP-04)

### 11. Compatibility

This NIP is compatible with and builds upon:

| NIP | Relationship |
|-----|--------------|
| NIP-01 | Basic protocol and event structure |
| NIP-10 | Reply threading for comments |
| NIP-19 | Bech32 encoding for references |
| NIP-23 | Long-form content for detailed fact-checks |
| NIP-33 | Parameterized replaceable events |
| NIP-51 | Lists for bookmark integration |
| NIP-56 | Reporting for flagging misuse |
| NIP-65 | Relay list metadata |

### 12. Reference Implementation

A reference implementation is available at:

- Browser Extension: [repository URL]
- Relay Plugin: [repository URL]
- Client Library: [repository URL]

### 13. Appendix A: JSON Schemas

#### A.1 Annotation Event Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["kind", "tags", "content"],
  "properties": {
    "kind": { "const": 32123 },
    "tags": {
      "type": "array",
      "contains": {
        "anyOf": [
          { "items": [{"const": "d"}, {"type": "string"}] },
          { "items": [{"const": "r"}, {"type": "string", "format": "uri"}] },
          { "items": [{"const": "url-hash"}, {"type": "string", "pattern": "^[a-f0-9]{64}$"}] },
          { "items": [{"const": "annotation-type"}, {"enum": ["note", "highlight", "correction", "context", "warning"]}] }
        ]
      }
    },
    "content": { "type": "string" }
  }
}
```

#### A.2 Trust Declaration Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["kind", "tags"],
  "properties": {
    "kind": { "const": 30382 },
    "tags": {
      "type": "array",
      "contains": {
        "anyOf": [
          { "items": [{"const": "d"}, {"type": "string", "pattern": "^trust:"}] },
          { "items": [{"const": "p"}, {"type": "string", "pattern": "^[a-f0-9]{64}$"}] },
          { "items": [{"const": "trust-level"}, {"type": "string", "pattern": "^(100|[1-9]?[0-9])$"}] }
        ]
      }
    }
  }
}
```

### 14. Appendix B: Implementation Checklist

- [ ] URL normalization algorithm
- [ ] SHA-256 hash computation
- [ ] Event kind 32123 creation
- [ ] Event kind 32123 querying
- [ ] Signature verification
- [ ] Event kind 32124 (ratings)
- [ ] Event kind 32126 (comments)
- [ ] Event kind 32140 (fact-checks)
- [ ] Trust score display
- [ ] Evidence chain display
- [ ] Archive link integration
- [ ] Dispute handling
- [ ] Trust declaration creation
- [ ] Reputation calculation

### 15. Appendix C: Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-01-25 | Initial draft |

---

## Authors

[Author information]

## License

This document is licensed under CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.
