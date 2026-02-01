# NOSTR Event Schemas for Content Metadata System

## Overview
This document provides detailed event schemas for the decentralized content metadata system. Each schema includes structure, validation rules, and usage guidelines.

---

## 1. URL Bookmarks with Tags

### Event Kind: 30003 (NIP-51 Bookmark List)

**Type:** Parameterized Replaceable Event  
**Purpose:** Store collections of bookmarked URLs with tags and metadata

### Schema

```json
{
  "kind": 30003,
  "pubkey": "<user-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<unique-list-identifier>"],
    ["title", "<list-name>"],
    ["description", "<optional-list-description>"],
    ["url", "<url>", "<title>", "<optional-summary>"],
    ["url", "<url2>", "<title2>", "<optional-summary2>"],
    ["t", "<tag-keyword>"],
    ["t", "<another-tag>"],
    ["domain", "<domain.com>"],
    ["published", "<iso-date>"],
    ["content-type", "<article|video|audio|social>"]
  ],
  "content": "<optional-markdown-notes>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Unique identifier for this bookmark list (e.g., "tech-articles", "must-read") |
| `title` | No | No | Human-readable list name |
| `description` | No | No | Description of the list's purpose |
| `url` | Yes | Yes | Each bookmark: [url, title, summary?] |
| `t` | No | Yes | Classification tags (e.g., "programming", "AI", "politics") |
| `domain` | No | Yes | Domain names for filtering (extracted from URLs) |
| `published` | No | Yes | Original publication dates in ISO format |
| `content-type` | No | Yes | Type of content (article, video, audio, social) |

### Example: Technical Articles Bookmark List

```json
{
  "kind": 30003,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "tech-reading-list-2024"],
    ["title", "Technical Reading List 2024"],
    ["description", "Articles about AI, decentralization, and web3"],
    ["url", "https://example.com/article1", "The Future of Decentralized Systems", "Analysis of emerging protocols"],
    ["url", "https://example.com/article2", "AI Safety Considerations", "Research on alignment"],
    ["t", "AI"],
    ["t", "decentralization"],
    ["t", "web3"],
    ["domain", "example.com"],
    ["content-type", "article"]
  ],
  "content": "# Notes\n\nThese articles form the foundation of my research into decentralized AI systems.",
  "sig": "..."
}
```

### Usage Notes

- Each user can maintain multiple bookmark lists using different `d` tag values
- Lists are **replaceable** - updating a list with the same `d` tag overwrites the previous version
- Clients should normalize URLs (lowercase domain, remove tracking parameters)
- The `url` tag array format: `["url", "canonical-url", "title", "optional-summary"]`
- Use consistent tag values for better aggregation (e.g., lowercase tags)

---

## 2. Inline Annotations

### Event Kind: 32123 (Custom - URL Annotation)

**Type:** Parameterized Replaceable Event  
**Purpose:** Create inline annotations with precise positioning in web content

### Schema

```json
{
  "kind": 32123,
  "pubkey": "<annotator-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash:position-hash>"],
    ["url", "<canonical-url>"],
    ["url-hash", "<sha256-of-normalized-url>"],
    ["domain", "<domain.com>"],
    ["title", "<page-title>"],
    ["selector", "<selector-type>", "<selector-value>"],
    ["quote", "<exact-text-being-annotated>"],
    ["position", "<character-offset>", "<length>"],
    ["annotation-type", "<highlight|comment|correction|question|fact-check>"],
    ["visibility", "<public|followers|private>"],
    ["e", "<parent-event-id>", "<relay-hint>", "reply"],
    ["p", "<mentioned-pubkey>"]
  ],
  "content": "<annotation-text-or-markdown>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Unique identifier: URL hash + position hash |
| `url` | Yes | No | Canonical URL of the content |
| `url-hash` | Yes | No | SHA-256 hash of normalized URL for exact matching |
| `domain` | No | No | Domain name for filtering |
| `title` | No | No | Page title at time of annotation |
| `selector` | Yes | No | [type, value] - e.g., ["xpath", "/html/body/p[3]"] |
| `quote` | Yes | No | Exact text being annotated (for text anchoring) |
| `position` | No | No | [character offset from start, length] for validation |
| `annotation-type` | Yes | No | Type of annotation being made |
| `visibility` | No | No | Privacy level (default: public) |
| `e` | No | Yes | Reply to another annotation (threading) |
| `p` | No | Yes | Mention another user |

### Selector Types

Annotations should support multiple selector strategies for robustness:

1. **Text Quote**: Exact text with before/after context
2. **XPath**: DOM path to element
3. **CSS Selector**: CSS path to element  
4. **Range**: Start and end positions
5. **Text Position**: Character offset from document start

### Example: Text Annotation with Correction

```json
{
  "kind": 32123,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:paragraph-3"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "example.com"],
    ["title", "Understanding Decentralized Systems"],
    ["selector", "text-quote", "prefix=the year||exact=2019||suffix=marked"],
    ["quote", "2019"],
    ["position", "1542", "4"],
    ["annotation-type", "correction"],
    ["visibility", "public"]
  ],
  "content": "This should be 2020, not 2019. The event occurred in early 2020. Source: https://source.com/timeline",
  "sig": "..."
}
```

### Example: Highlight with Comment

```json
{
  "kind": 32123,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:key-insight-1"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["selector", "xpath", "/html/body/article/p[5]"],
    ["quote", "Decentralized systems provide censorship resistance through distribution of control"],
    ["annotation-type", "highlight"],
    ["visibility", "public"]
  ],
  "content": "Key insight! This is the fundamental value proposition that makes decentralized systems resilient.",
  "sig": "..."
}
```

### Usage Notes

- Annotations are **replaceable** by the same author (can edit)
- Use multiple selector strategies for robustness against page changes
- The `quote` tag enables text anchoring when DOM structure changes
- Annotations can thread using NIP-10 patterns (`e` tags)
- Clients should attempt to re-anchor annotations if exact selectors fail

---

## 3. Content Ratings and Reviews

### Event Kind: 32124 (Custom - Content Rating)

**Type:** Parameterized Replaceable Event  
**Purpose:** Multi-dimensional ratings and reviews of content with structured metadata

### Schema

```json
{
  "kind": 32124,
  "pubkey": "<reviewer-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash>"],
    ["url", "<canonical-url>"],
    ["url-hash", "<sha256-of-normalized-url>"],
    ["domain", "<domain.com>"],
    ["title", "<content-title>"],
    ["rating", "<dimension>", "<score>", "<max-score>"],
    ["rating", "<dimension2>", "<score2>", "<max-score>"],
    ["overall", "<weighted-score>", "<max-score>"],
    ["methodology", "<rating-system-id>"],
    ["confidence", "<0-100>"],
    ["reviewed-date", "<iso-date>"],
    ["content-type", "<article|video|audio|social>"],
    ["language", "<iso-language-code>"],
    ["author", "<author-name>", "<author-url>"],
    ["publisher", "<publisher-name>", "<publisher-url>"]
  ],
  "content": "<review-text-markdown>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | URL hash (one rating per URL per user) |
| `url` | Yes | No | Canonical URL being rated |
| `url-hash` | Yes | No | SHA-256 hash for exact matching |
| `domain` | No | No | Domain name |
| `title` | No | No | Content title |
| `rating` | Yes | Yes | [dimension, score, max] - e.g., ["accuracy", "8", "10"] |
| `overall` | No | No | [overall-score, max] computed from dimensions |
| `methodology` | Yes | No | Identifier for rating system used |
| `confidence` | No | No | Reviewer confidence (0-100) |
| `reviewed-date` | Yes | No | When review was conducted |
| `content-type` | No | No | Type of content being reviewed |
| `language` | No | No | Content language |
| `author` | No | Yes | Content author(s) [name, url/pubkey] |
| `publisher` | No | No | Publisher [name, url] |

### Standard Rating Dimensions

To enable aggregation, we recommend these standard dimensions (0-10 scale):

1. **accuracy**: Factual correctness and truthfulness
2. **quality**: Overall content quality and production value
3. **depth**: Thoroughness and depth of analysis
4. **clarity**: How well the content communicates ideas
5. **bias**: Objectivity (10 = unbiased, 0 = heavily biased)
6. **sources**: Quality of sources and citations
7. **relevance**: Relevance to claimed topic
8. **originality**: Novel insights vs. rehashed content

### Example: Article Review with Multiple Dimensions

```json
{
  "kind": 32124,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "example.com"],
    ["title", "Understanding Decentralized Systems"],
    ["rating", "accuracy", "9", "10"],
    ["rating", "quality", "8", "10"],
    ["rating", "depth", "9", "10"],
    ["rating", "clarity", "7", "10"],
    ["rating", "bias", "8", "10"],
    ["rating", "sources", "9", "10"],
    ["overall", "8.3", "10"],
    ["methodology", "standard-v1"],
    ["confidence", "85"],
    ["reviewed-date", "2024-11-05T05:30:00Z"],
    ["content-type", "article"],
    ["language", "en"],
    ["author", "Jane Smith", "https://example.com/authors/jane-smith"],
    ["publisher", "Tech Review Journal", "https://example.com"]
  ],
  "content": "# Review\n\nThis article provides an excellent overview of decentralized systems with strong technical accuracy. The author clearly understands the subject matter and provides well-sourced examples.\n\n## Strengths\n- Comprehensive coverage of key concepts\n- Well-researched with quality citations\n- Good balance of theory and practice\n\n## Weaknesses\n- Could benefit from more diagrams\n- Some sections are dense for beginners\n\n## Recommendation\nHighly recommended for intermediate to advanced readers interested in decentralization.",
  "sig": "..."
}
```

### Usage Notes

- Ratings are **replaceable** - reviewers can update their assessments
- Use consistent rating dimensions for aggregation across reviews
- The `methodology` tag identifies which rating system is used
- Confidence levels help weight aggregations
- Content field should provide rationale for ratings
- Clients can compute weighted averages based on reviewer reputation

---

## 4. Entity References

### Event Kind: 32125 (Custom - Entity Reference)

**Type:** Parameterized Replaceable Event  
**Purpose:** Identify and classify entities (people, organizations, content) mentioned in URLs

### Schema

```json
{
  "kind": 32125,
  "pubkey": "<identifier-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash:entity-hash>"],
    ["url", "<source-url>"],
    ["url-hash", "<sha256-of-source-url>"],
    ["entity-type", "<person|organization|content|event|product|location>"],
    ["entity-name", "<entity-name>"],
    ["entity-id", "<identifier>"],
    ["entity-url", "<canonical-url>"],
    ["entity-pubkey", "<nostr-pubkey>"],
    ["relationship", "<author|mentioned|cited|subject|publisher|sponsor>"],
    ["context", "<surrounding-text>"],
    ["position", "<offset>", "<length>"],
    ["confidence", "<0-100>"],
    ["verification", "<verified|claimed|alleged|disputed>"],
    ["source", "<verification-url>"]
  ],
  "content": "<notes-about-entity>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Unique: source URL hash + entity hash |
| `url` | Yes | No | Source URL where entity is referenced |
| `url-hash` | Yes | No | Hash of source URL |
| `entity-type` | Yes | No | Type of entity being identified |
| `entity-name` | Yes | No | Primary name/label of entity |
| `entity-id` | No | No | Unique identifier (URL, DOI, ORCID, etc.) |
| `entity-url` | No | No | Canonical URL for the entity |
| `entity-pubkey` | No | No | NOSTR pubkey if entity is on NOSTR |
| `relationship` | Yes | No | How entity relates to the content |
| `context` | No | No | Text excerpt showing the reference |
| `position` | No | No | Location in document [offset, length] |
| `confidence` | No | No | Confidence in identification (0-100) |
| `verification` | No | No | Verification status of the relationship |
| `source` | No | Yes | URLs supporting the identification |

### Entity Types

- **person**: Individual human
- **organization**: Company, nonprofit, institution
- **content**: Referenced article, book, paper
- **event**: Specific occurrence or happening
- **product**: Software, service, physical product
- **location**: Geographic place

### Relationship Types

- **author**: Created the content
- **publisher**: Published/distributed the content
- **mentioned**: Discussed or referenced in content
- **cited**: Formally cited as source
- **subject**: Primary subject of the content
- **sponsor**: Financially supported the content
- **affiliated**: Has affiliation with author/publisher

### Example: Identifying Article Author

```json
{
  "kind": 32125,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:author-jane-smith"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["entity-type", "person"],
    ["entity-name", "Dr. Jane Smith"],
    ["entity-id", "0000-0001-2345-6789"],
    ["entity-url", "https://example.com/authors/jane-smith"],
    ["relationship", "author"],
    ["confidence", "100"],
    ["verification", "verified"],
    ["source", "https://example.com/authors/jane-smith"]
  ],
  "content": "Verified author through publisher website and ORCID. Dr. Smith is a researcher at MIT specializing in distributed systems.",
  "sig": "..."
}
```

### Example: Referenced Organization

```json
{
  "kind": 32125,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:org-mit"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["entity-type", "organization"],
    ["entity-name", "Massachusetts Institute of Technology"],
    ["entity-url", "https://www.mit.edu"],
    ["relationship", "affiliated"],
    ["context", "research conducted at MIT"],
    ["position", "234", "3"],
    ["confidence", "100"],
    ["verification", "verified"]
  ],
  "content": "Author's institutional affiliation confirmed on MIT faculty page.",
  "sig": "..."
}
```

### Usage Notes

- Entity references are **replaceable** - can update verification status
- Use consistent entity identifiers for aggregation
- Link entities across multiple content sources
- Build entity profiles by aggregating all references
- Support reputation tracking by entity type
- Confidence and verification levels enable trust weighting

---

## 5. Rating Aggregates

### Event Kind: 32126 (Custom - Rating Aggregate)

**Type:** Parameterized Replaceable Event  
**Purpose:** Computed aggregate ratings with transparent methodology

### Schema

```json
{
  "kind": 32126,
  "pubkey": "<aggregator-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash:methodology-id>"],
    ["url", "<rated-url>"],
    ["url-hash", "<sha256-of-url>"],
    ["domain", "<domain.com>"],
    ["aggregate-type", "<url-rating|author-rating|domain-rating>"],
    ["methodology", "<aggregation-method-id>"],
    ["time-window", "<start-timestamp>", "<end-timestamp>"],
    ["trust-network", "<follow-graph|web-of-trust|public>"],
    ["sample-size", "<number-of-ratings>"],
    ["rating", "<dimension>", "<avg-score>", "<std-dev>", "<max>"],
    ["rating", "<dimension2>", "<avg-score2>", "<std-dev2>", "<max>"],
    ["overall", "<weighted-avg>", "<std-dev>", "<max>"],
    ["confidence-interval", "<lower>", "<upper>", "<confidence-level>"],
    ["top-reviewers", "<pubkey1>", "<pubkey2>", "<pubkey3>"],
    ["computation-hash", "<hash-of-input-events>"]
  ],
  "content": "<methodology-explanation-and-details>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | URL hash + methodology ID |
| `url` | Yes | No | URL being rated |
| `url-hash` | Yes | No | Hash of URL |
| `aggregate-type` | Yes | No | What is being aggregated |
| `methodology` | Yes | No | Algorithm/approach used |
| `time-window` | Yes | No | [start, end] timestamps for included ratings |
| `trust-network` | Yes | No | Which trust network was used |
| `sample-size` | Yes | No | Number of ratings included |
| `rating` | Yes | Yes | [dimension, avg, std-dev, max] |
| `overall` | Yes | No | [weighted-avg, std-dev, max] |
| `confidence-interval` | No | No | [lower, upper, confidence %] |
| `top-reviewers` | No | No | Most influential reviewers (by weight) |
| `computation-hash` | Yes | No | Hash of input event IDs for verification |

### Aggregation Methodologies

Standardized methodology identifiers:

1. **simple-mean-v1**: Unweighted arithmetic mean
2. **weighted-mean-v1**: Weighted by reviewer reputation
3. **web-of-trust-v1**: Weighted by social graph distance
4. **bayesian-v1**: Bayesian estimation with prior
5. **median-v1**: Median to reduce outlier impact

### Example: URL Rating Aggregate

```json
{
  "kind": 32126,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:weighted-mean-v1"],
    ["url", "https://example.com/article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "example.com"],
    ["aggregate-type", "url-rating"],
    ["methodology", "weighted-mean-v1"],
    ["time-window", "1698552000", "1699158000"],
    ["trust-network", "follow-graph"],
    ["sample-size", "47"],
    ["rating", "accuracy", "8.4", "1.2", "10"],
    ["rating", "quality", "7.9", "1.5", "10"],
    ["rating", "depth", "8.7", "1.1", "10"],
    ["rating", "clarity", "7.5", "1.8", "10"],
    ["rating", "bias", "7.8", "1.6", "10"],
    ["rating", "sources", "8.9", "0.9", "10"],
    ["overall", "8.2", "1.1", "10"],
    ["confidence-interval", "7.8", "8.6", "95"],
    ["top-reviewers", "pubkey1...", "pubkey2...", "pubkey3..."],
    ["computation-hash", "b4f7c..."]
  ],
  "content": "# Aggregate Rating Computation\n\n## Methodology\nWeighted arithmetic mean where reviewer weights are determined by:\n1. Web of trust distance (follow graph)\n2. Historical accuracy of reviews\n3. Domain expertise signals\n\n## Sample Characteristics\n- Total ratings: 47\n- Time period: 7 days\n- Trust network: Your follow graph (2 hops)\n- Outliers removed: 3 (using IQR method)\n\n## Quality Indicators\n- High agreement on accuracy and sources\n- Moderate variance on clarity (likely subjective)\n- Large sample size provides high confidence\n\n## Notable Reviews\nTop-weighted reviewers have established track records in this domain.",
  "sig": "..."
}
```

### Usage Notes

- Aggregates are **replaceable** - recompute periodically
- Include `computation-hash` for verification
- Document methodology thoroughly in content field
- Provide confidence intervals for statistical rigor
- List influential reviewers for transparency
- Support multiple methodologies for user choice
- Clients should verify computations when trust is critical

---

## 6. Fact Checks

### Event Kind: 32127 (Custom - Fact Check)

**Type:** Parameterized Replaceable Event  
**Purpose:** Structured fact-checking of claims in content

### Schema

```json
{
  "kind": 32127,
  "pubkey": "<fact-checker-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash:claim-hash>"],
    ["url", "<source-url>"],
    ["url-hash", "<sha256-of-url>"],
    ["claim", "<text-of-claim>"],
    ["claim-type", "<factual|statistical|causal|predictive>"],
    ["verdict", "<true|false|misleading|unverifiable|context-needed>"],
    ["confidence", "<0-100>"],
    ["selector", "<selector-type>", "<selector-value>"],
    ["quote", "<exact-quote>"],
    ["evidence", "<supporting-url>", "<evidence-type>"],
    ["evidence", "<another-url>", "<evidence-type>"],
    ["methodology", "<fact-check-standard>"],
    ["checked-date", "<iso-date>"],
    ["original-date", "<publication-date>"],
    ["category", "<health|science|politics|business|other>"]
  ],
  "content": "<detailed-fact-check-analysis>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | URL hash + claim hash |
| `url` | Yes | No | Source containing the claim |
| `url-hash` | Yes | No | Hash of source URL |
| `claim` | Yes | No | The specific claim being checked |
| `claim-type` | Yes | No | Type of claim |
| `verdict` | Yes | No | Fact-check conclusion |
| `confidence` | Yes | No | Checker confidence (0-100) |
| `selector` | No | No | Location of claim in document |
| `quote` | Yes | No | Exact quote containing claim |
| `evidence` | Yes | Yes | [url, type] of supporting evidence |
| `methodology` | Yes | No | Fact-checking standard used |
| `checked-date` | Yes | No | When fact-check was conducted |
| `original-date` | No | No | When claim was originally made |
| `category` | No | No | Topic category |

### Verdict Types

- **true**: Claim is accurate
- **false**: Claim is inaccurate
- **misleading**: Technically true but misleading context
- **unverifiable**: Cannot be verified with available evidence
- **context-needed**: Missing important context
- **partially-true**: Some elements true, others false

### Evidence Types

- **primary-source**: Original data or document
- **research-paper**: Peer-reviewed research
- **government-data**: Official statistics
- **expert-statement**: Verified expert testimony
- **news-report**: Reputable journalism
- **historical-record**: Documented historical evidence

### Example: Political Claim Fact-Check

```json
{
  "kind": 32127,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:unemployment-claim"],
    ["url", "https://example.com/political-speech"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["claim", "Unemployment reached its lowest level in 50 years"],
    ["claim-type", "statistical"],
    ["verdict", "misleading"],
    ["confidence", "95"],
    ["selector", "text-quote", "prefix=and today||exact=unemployment reached its lowest level in 50 years||suffix=which shows"],
    ["quote", "unemployment reached its lowest level in 50 years"],
    ["evidence", "https://data.bls.gov/timeseries/LNS14000000", "government-data"],
    ["evidence", "https://fred.stlouisfed.org/series/UNRATE", "government-data"],
    ["methodology", "journalism-standard-v1"],
    ["checked-date", "2024-11-05T05:30:00Z"],
    ["original-date", "2024-11-01T10:00:00Z"],
    ["category", "politics"]
  ],
  "content": "# Fact Check: Unemployment Claim\n\n## The Claim\n'Unemployment reached its lowest level in 50 years'\n\n## The Verdict: MISLEADING\n\n## Analysis\n\nWhile unemployment rates did reach historic lows, the claim is misleading:\n\n### What's True\n- Unemployment did reach 3.5% in September 2019\n- This matched the lowest rate since 1969 (50 years)\n- The rate remained low through early 2020\n\n### What's Misleading\n- The claim was made in November 2024\n- Current unemployment is 4.2%, not at 50-year lows\n- Referring to past achievement without temporal context is misleading\n- The record was broken by pandemic disruptions and recovery\n\n## Sources\n1. Bureau of Labor Statistics: Current unemployment data\n2. Federal Reserve Economic Data: Historical unemployment rates\n3. BLS Historical Tables: Long-term unemployment trends\n\n## Context\nThe statement references a past achievement (2019) as if it were current, which can mislead audiences about present economic conditions.",
  "sig": "..."
}
```

### Usage Notes

- Fact-checks are **replaceable** - update as new evidence emerges
- Link multiple fact-checks to build consensus
- Reference primary sources whenever possible
- Provide transparent methodology
- Include confidence levels for uncertainty
- Clients can aggregate fact-checks by verdict
- Support reputation tracking of fact-checkers

---

## Cross-Event Relationships

### Threading and Replies

All event types support NIP-10 style threading:

```json
["e", "<event-id>", "<relay-hint>", "<marker>"]
```

Markers:
- `reply`: Direct reply to an event
- `root`: Original event in thread
- `mention`: Reference without reply

### Entity Linking

Link events about the same entity:

```json
["entity-ref", "<entity-type>", "<entity-id>"]
```

### Content Relationships

Express relationships between content:

```json
["related", "<url>", "<relationship-type>"]
```

Relationship types:
- `follow-up`: Sequel or follow-up article
- `rebuttal`: Response or counter-argument
- `supports`: Corroborating evidence
- `contradicts`: Contradicting evidence
- `updates`: Updated version

---

## Query Patterns

### Finding All Metadata for a URL

```javascript
// Normalize and hash URL
const urlHash = sha256(normalizeUrl(url));

// Query patterns
const queries = [
  { kinds: [30003], "#url": [url] },                    // Bookmarks
  { kinds: [32123], "#url-hash": [urlHash] },          // Annotations
  { kinds: [32124], "#url-hash": [urlHash] },          // Ratings
  { kinds: [32125], "#url-hash": [urlHash] },          // Entity refs
  { kinds: [32126], "#url-hash": [urlHash] },          // Aggregates
  { kinds: [32127], "#url-hash": [urlHash] }           // Fact-checks
];
```

### Finding User's Bookmarks

```javascript
{
  kinds: [30003],
  authors: [userPubkey]
}
```

### Finding Ratings by Dimension

```javascript
{
  kinds: [32124],
  "#rating": ["accuracy"],  // Just the dimension name
  "#url-hash": [urlHash]
}
```

### Finding Entity Across Content

```javascript
{
  kinds: [32125],
  "#entity-name": ["Dr. Jane Smith"]
}
```

---

## Validation Rules

### URL Normalization

Before hashing, normalize URLs:

1. Convert to lowercase domain
2. Remove default ports (`:80`, `:443`)
3. Remove fragment identifiers (`#`)
4. Remove tracking parameters (configurable list)
5. Sort remaining query parameters
6. Remove trailing slashes (except root)

Example:
```
https://Example.com:443/path?utm_source=twitter&id=123#section
→ https://example.com/path?id=123
```

### Hash Computation

```javascript
function computeUrlHash(url) {
  const normalized = normalizeUrl(url);
  return sha256(normalized);
}
```

### Tag Validation

- Required tags must be present
- Tag values must match specified formats
- Scores must be within specified ranges
- Timestamps must be valid Unix timestamps
- URLs must be valid HTTP(S) URLs

### Content Length Limits

- Event content: 64KB max (NOSTR recommendation)
- Tag values: 1KB max per value
- Total tags: Reasonable limit ~100 tags

---

## Implementation Recommendations

### Client Responsibilities

1. **URL Normalization**: Implement consistent normalization
2. **Selector Robustness**: Use multiple selector strategies
3. **Verification**: Verify aggregate computations when critical
4. **Caching**: Cache frequently accessed metadata
5. **Conflict Resolution**: Handle conflicting information gracefully

### Relay Recommendations

1. **Indexing**: Index by `url`, `url-hash`, `domain`, `entity-name`
2. **Search**: Support full-text search in content
3. **Performance**: Optimize for batch queries
4. **Storage**: Consider retention policies for aggregates
5. **Auth**: Support NIP-42 for private annotations

### Trust and Reputation

1. **Web of Trust**: Weight by social graph distance
2. **Track Record**: Consider historical accuracy
3. **Expertise**: Weight by domain expertise
4. **Consensus**: Look for agreement across reviewers
5. **Transparency**: Always show computation methods

---

## Future Extensions

### Potential Additions

1. **Multimedia annotations**: Support for video/audio timestamps
2. **Collaborative editing**: Suggest edits with diff format
3. **Translation tracking**: Link translations of content
4. **Archive tracking**: Link to archived versions (Wayback, IPFS)
5. **Citation networks**: Build citation graphs
6. **Misinformation alerts**: Automated warning systems

### Version Management

- Use `version` tag for schema evolution
- Maintain backwards compatibility
- Document breaking changes clearly
- Support multiple schema versions simultaneously

---

## 7. Profile URL Resolution

### Event Kind: 32128 (Custom - Profile URL Mapping)

**Type:** Parameterized Replaceable Event
**Purpose:** Map external platform URLs (LinkedIn, Twitter, etc.) to NOSTR pubkeys

### Schema

```json
{
  "kind": 32128,
  "pubkey": "<claimant-or-identifier-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<platform:username-hash>"],
    ["profile-url", "<canonical-profile-url>"],
    ["url-hash", "<sha256-of-normalized-profile-url>"],
    ["platform", "<platform-identifier>"],
    ["username", "<platform-username>"],
    ["target-pubkey", "<nostr-pubkey-being-mapped>"],
    ["claim-type", "<self-claim|third-party|organization>"],
    ["verification-method", "<dns|oauth|signed-message|attestation>"],
    ["verification-proof", "<proof-data>"],
    ["verification-url", "<url-where-proof-can-be-verified>"],
    ["confidence", "<0-100>"],
    ["verified-at", "<iso-timestamp>"],
    ["expires-at", "<iso-timestamp>"],
    ["alt-urls", "<alternative-profile-url>"],
    ["display-name", "<name-on-platform>"],
    ["bio-excerpt", "<excerpt-from-profile-bio>"]
  ],
  "content": "<verification-notes-and-context>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Platform + username hash for deduplication |
| `profile-url` | Yes | No | Canonical URL of the external profile |
| `url-hash` | Yes | No | SHA-256 hash of normalized profile URL |
| `platform` | Yes | No | Platform identifier (twitter, linkedin, github, etc.) |
| `username` | Yes | No | Username on the platform |
| `target-pubkey` | Yes | No | NOSTR pubkey this profile maps to |
| `claim-type` | Yes | No | Who is making the claim |
| `verification-method` | No | No | How the claim was verified |
| `verification-proof` | No | No | Proof data (signature, DNS record, etc.) |
| `verification-url` | No | No | URL where proof can be independently verified |
| `confidence` | No | No | Confidence level (0-100) |
| `verified-at` | No | No | When verification was performed |
| `expires-at` | No | No | When verification expires |
| `alt-urls` | No | Yes | Alternative URLs for the same profile |
| `display-name` | No | No | Name displayed on the platform |
| `bio-excerpt` | No | No | Excerpt from profile bio for context |

### Platform Identifiers

Standardized platform identifiers:
- `twitter` / `x`: Twitter/X profiles
- `linkedin`: LinkedIn profiles
- `github`: GitHub profiles
- `mastodon`: Mastodon profiles (include instance in URL)
- `youtube`: YouTube channels
- `facebook`: Facebook profiles/pages
- `instagram`: Instagram profiles
- `tiktok`: TikTok profiles
- `substack`: Substack publications
- `medium`: Medium profiles
- `website`: Personal/organization websites
- `email`: Email addresses (mailto: URLs)

### Claim Types

- **self-claim**: User claims their own profile (pubkey matches claimant)
- **third-party**: Someone identifies another user's profile
- **organization**: Official organizational attestation

### Verification Methods

1. **dns**: DNS TXT record containing NOSTR pubkey
2. **oauth**: OAuth verification through platform API
3. **signed-message**: Platform post/bio containing signed NOSTR message
4. **attestation**: Third-party attestation service
5. **link-back**: Profile links to a NIP-05 or NOSTR profile
6. **manual**: Manual verification with evidence

### Example: Self-Claimed Twitter Profile

```json
{
  "kind": 32128,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "twitter:a1b2c3d4e5f6"],
    ["profile-url", "https://twitter.com/fiatjaf"],
    ["url-hash", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["platform", "twitter"],
    ["username", "fiatjaf"],
    ["target-pubkey", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"],
    ["claim-type", "self-claim"],
    ["verification-method", "signed-message"],
    ["verification-proof", "nostr:npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"],
    ["verification-url", "https://twitter.com/fiatjaf/status/1234567890"],
    ["confidence", "100"],
    ["verified-at", "2024-11-05T10:00:00Z"],
    ["display-name", "fiatjaf"],
    ["bio-excerpt", "nostr protocol creator"]
  ],
  "content": "Self-claimed Twitter profile. Verification: Twitter bio contains npub reference and pinned tweet has signed NOSTR message.",
  "sig": "..."
}
```

### Example: Third-Party LinkedIn Identification

```json
{
  "kind": 32128,
  "pubkey": "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
  "created_at": 1699158100,
  "tags": [
    ["d", "linkedin:john-doe-123abc"],
    ["profile-url", "https://www.linkedin.com/in/john-doe-123abc"],
    ["url-hash", "b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c"],
    ["platform", "linkedin"],
    ["username", "john-doe-123abc"],
    ["target-pubkey", "9a4e6c4c7a0d88e19f6d5b3e7c2a1b0f4d3e8c9b2a7f6e5d4c3b2a1f0e9d8c7b"],
    ["claim-type", "third-party"],
    ["verification-method", "attestation"],
    ["confidence", "75"],
    ["verified-at", "2024-11-05T10:30:00Z"],
    ["display-name", "John Doe"],
    ["bio-excerpt", "Software Engineer at TechCorp"]
  ],
  "content": "Third-party identification based on matching name, photo, and employment history. LinkedIn profile mentions NOSTR activity in posts.",
  "sig": "..."
}
```

### Usage Notes

- Self-claims (where `target-pubkey` matches `pubkey`) have implicit higher trust
- Third-party claims should be weighted by the claimer's reputation
- Verification proofs should be independently verifiable when possible
- Clients should aggregate multiple claims for consensus
- Expired verifications should prompt re-verification
- Platform URLs should be normalized (remove tracking, normalize case)

---

## 8. Headline Corrections

### Event Kind: 32129 (Custom - Headline Correction)

**Type:** Parameterized Replaceable Event
**Purpose:** Suggest improved headlines for articles with explanations for why the original is problematic

### Schema

```json
{
  "kind": 32129,
  "pubkey": "<corrector-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash>"],
    ["url", "<article-url>"],
    ["url-hash", "<sha256-of-normalized-url>"],
    ["domain", "<domain.com>"],
    ["original-headline", "<exact-original-headline>"],
    ["suggested-headline", "<corrected-headline>"],
    ["problem-type", "<clickbait|misleading|sensationalized|inaccurate|incomplete|biased>"],
    ["severity", "<minor|moderate|severe>"],
    ["evidence", "<supporting-url>", "<evidence-type>"],
    ["quote", "<problematic-quote-from-article>"],
    ["actual-content", "<what-article-actually-says>"],
    ["comparison", "<before-after-analysis>"],
    ["confidence", "<0-100>"],
    ["language", "<iso-language-code>"],
    ["article-date", "<original-publication-date>"],
    ["author", "<article-author>"]
  ],
  "content": "<detailed-explanation-markdown>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | URL hash (one correction per URL per user) |
| `url` | Yes | No | Article URL being corrected |
| `url-hash` | Yes | No | SHA-256 hash for exact matching |
| `domain` | No | No | Domain name |
| `original-headline` | Yes | No | The exact original headline |
| `suggested-headline` | Yes | No | The suggested better headline |
| `problem-type` | Yes | Yes | Type(s) of problem with original |
| `severity` | Yes | No | How problematic the headline is |
| `evidence` | No | Yes | [url, type] supporting the correction |
| `quote` | No | Yes | Relevant quotes from the article |
| `actual-content` | No | No | Summary of what article actually contains |
| `comparison` | No | No | Before/after analysis text |
| `confidence` | No | No | Corrector's confidence (0-100) |
| `language` | No | No | Language of the headline |
| `article-date` | No | No | When article was published |
| `author` | No | No | Article author |

### Problem Types

- **clickbait**: Designed to manipulate clicks, often with exaggeration or curiosity gaps
- **misleading**: Technically defensible but creates false impression
- **sensationalized**: Amplifies emotional impact beyond what content warrants
- **inaccurate**: Contains factual errors or misrepresents article content
- **incomplete**: Omits critical context that changes meaning
- **biased**: Frames story with clear political/ideological slant not in article

### Severity Levels

- **minor**: Slight exaggeration or suboptimal wording
- **moderate**: Meaningfully misrepresents content or uses manipulative tactics
- **severe**: Completely misrepresents article or contains dangerous misinformation

### Example: Clickbait Headline Correction

```json
{
  "kind": 32129,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["url", "https://example.com/article/study-results"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "example.com"],
    ["original-headline", "Scientists SHOCKED by Discovery That Changes EVERYTHING We Know About Health"],
    ["suggested-headline", "Study Finds Correlation Between Sleep Patterns and Heart Health in Adults Over 50"],
    ["problem-type", "clickbait"],
    ["problem-type", "sensationalized"],
    ["severity", "moderate"],
    ["evidence", "https://pubmed.ncbi.nlm.nih.gov/12345678", "research-paper"],
    ["quote", "The study found a modest correlation (r=0.23) between irregular sleep patterns and elevated blood pressure"],
    ["actual-content", "A correlational study of 500 adults over 50 found a weak-to-moderate relationship between sleep irregularity and blood pressure"],
    ["confidence", "95"],
    ["language", "en"],
    ["article-date", "2024-11-01"]
  ],
  "content": "# Headline Correction\n\n## Problems with Original\n\n### Clickbait Tactics\n- Uses ALL CAPS for emotional manipulation\n- \"SHOCKED\" is editorializing - scientists quoted express normal professional interest\n- \"Changes EVERYTHING\" is hyperbolic - study has modest effect size\n\n### Sensationalization\n- Implies revolutionary breakthrough\n- Actual finding is incremental and correlational, not causal\n- Study limitations not reflected in headline\n\n## Why Suggested Headline is Better\n- Accurately describes the finding (correlation, not causation)\n- Specifies the population studied (adults over 50)\n- Uses neutral language without emotional manipulation\n- Allows readers to assess relevance before clicking\n\n## Evidence\nThe actual study abstract states: 'We observed a modest correlation (r=0.23, p<0.05) suggesting further research is warranted.' This is standard scientific language for a preliminary finding, not a shocking discovery.",
  "sig": "..."
}
```

### Example: Misleading Political Headline

```json
{
  "kind": 32129,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["d", "c4f7a8b9d2e1f0a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7"],
    ["url", "https://news.example.com/politics/vote-results"],
    ["url-hash", "c4f7a8b9d2e1f0a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7"],
    ["domain", "news.example.com"],
    ["original-headline", "City Council Votes to Defund Police Department"],
    ["suggested-headline", "City Council Approves 3% Budget Reallocation from Police to Mental Health Services"],
    ["problem-type", "misleading"],
    ["problem-type", "incomplete"],
    ["severity", "severe"],
    ["quote", "The council voted 7-2 to reallocate $2.1 million (3% of the police budget) to fund a new mental health crisis response team"],
    ["actual-content", "A modest budget reallocation to add mental health services, with police budget still increasing 2% overall"],
    ["confidence", "100"],
    ["language", "en"]
  ],
  "content": "# Headline Correction\n\n## Problems with Original\n\n### Misleading\n- 'Defund' implies elimination or drastic reduction\n- Actual change is a 3% reallocation\n- Police budget is still increasing overall (2% net increase)\n\n### Incomplete\n- Omits that funds go to mental health services\n- Omits that this is a pilot program\n- Omits the actual vote margin and bipartisan support\n\n## Context\nThe term 'defund' has become politically charged and implies something far more dramatic than a 3% reallocation. The article itself describes this as a 'modest pilot program' supported by the police chief.\n\n## Impact\nThis headline type contributes to political polarization by misrepresenting incremental policy changes as radical actions.",
  "sig": "..."
}
```

### Usage Notes

- One headline correction per URL per user (replaceable)
- Multiple `problem-type` tags can be used for headlines with multiple issues
- Corrections should include evidence from the article itself
- Suggested headlines should be factually accurate and professionally worded
- Clients can aggregate corrections to show consensus on problematic headlines
- Severity levels help filter and prioritize corrections

---

## 9. Image Annotation (Enhanced 32123)

### Event Kind: 32123 Extension for Images

**Enhancement to:** Existing kind 32123 (URL Annotation)
**Purpose:** Mark specific images as misleading, out-of-context, or manipulated, with support for substitutions

### Additional Tags for Image Annotations

When `annotation-type` is `image-issue`, the following additional tags apply:

```json
{
  "kind": 32123,
  "pubkey": "<annotator-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<url-hash:image-hash>"],
    ["url", "<page-url>"],
    ["url-hash", "<sha256-of-normalized-url>"],
    ["annotation-type", "image-issue"],
    
    ["image-url", "<url-of-problematic-image>"],
    ["image-hash", "<sha256-of-image-content>"],
    ["image-selector", "<selector-type>", "<selector-value>"],
    ["image-alt", "<image-alt-text>"],
    ["image-caption", "<caption-if-present>"],
    
    ["issue-type", "<misleading|out-of-context|manipulated|misattributed|ai-generated|stock-photo|unrelated>"],
    ["manipulation-type", "<cropped|edited|deepfake|composite|color-altered|metadata-stripped>"],
    
    ["actual-source", "<original-image-url>", "<source-name>"],
    ["actual-date", "<when-image-was-actually-taken>"],
    ["actual-location", "<where-image-was-actually-taken>"],
    ["actual-context", "<what-image-actually-shows>"],
    
    ["replacement-url", "<suggested-replacement-image-url>"],
    ["replacement-source", "<replacement-image-source>"],
    ["replacement-reason", "<why-replacement-is-better>"],
    
    ["evidence", "<supporting-url>", "<evidence-type>"],
    ["reverse-image-search", "<search-results-url>"],
    ["metadata-analysis", "<exif-or-metadata-findings>"],
    
    ["confidence", "<0-100>"],
    ["severity", "<minor|moderate|severe>"]
  ],
  "content": "<detailed-analysis-markdown>",
  "sig": "<signature>"
}
```

### Additional Tag Specifications for Images

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `image-url` | Yes* | No | URL of the problematic image |
| `image-hash` | No | No | SHA-256 hash of image content (if available) |
| `image-selector` | No | No | DOM selector to locate the image |
| `image-alt` | No | No | Alt text of the image |
| `image-caption` | No | No | Caption displayed with the image |
| `issue-type` | Yes* | Yes | Type(s) of issue with the image |
| `manipulation-type` | No | Yes | If manipulated, what kind |
| `actual-source` | No | No | [url, source-name] of original image |
| `actual-date` | No | No | When image was actually taken |
| `actual-location` | No | No | Where image was actually taken |
| `actual-context` | No | No | What the image actually depicts |
| `replacement-url` | No | No | Suggested replacement image |
| `replacement-source` | No | No | Source of replacement image |
| `replacement-reason` | No | No | Why replacement is more appropriate |
| `evidence` | Yes* | Yes | Supporting evidence for claims |
| `reverse-image-search` | No | No | URL to reverse image search results |
| `metadata-analysis` | No | No | EXIF or metadata findings |
| `confidence` | No | No | Confidence in the analysis (0-100) |
| `severity` | No | No | How serious the image misuse is |

*Required when `annotation-type` is `image-issue`

### Image Issue Types

- **misleading**: Image creates false impression in context
- **out-of-context**: Real image used in wrong context (different event, time, place)
- **manipulated**: Image has been digitally altered
- **misattributed**: Image attributed to wrong source/photographer
- **ai-generated**: Image created by AI, not presented as such
- **stock-photo**: Generic stock photo presented as specific event
- **unrelated**: Image has no connection to article content

### Manipulation Types

- **cropped**: Selectively cropped to change meaning
- **edited**: Digitally edited (objects added/removed)
- **deepfake**: AI-generated face/body manipulation
- **composite**: Multiple images combined
- **color-altered**: Colors changed to mislead
- **metadata-stripped**: EXIF data removed to hide origin

### Example: Out-of-Context Image

```json
{
  "kind": 32123,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:hero-image"],
    ["url", "https://news.example.com/article/protest-coverage"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "news.example.com"],
    ["annotation-type", "image-issue"],
    
    ["image-url", "https://news.example.com/images/protest-crowd.jpg"],
    ["image-hash", "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5"],
    ["image-selector", "css", "article .hero-image img"],
    ["image-caption", "Protesters gather in downtown area yesterday"],
    
    ["issue-type", "out-of-context"],
    ["actual-source", "https://archive.org/original-photo", "Associated Press"],
    ["actual-date", "2019-06-15"],
    ["actual-location", "Hong Kong"],
    ["actual-context", "Hong Kong pro-democracy protests in 2019"],
    
    ["evidence", "https://tineye.com/search/abc123", "reverse-image-search"],
    ["evidence", "https://apnews.com/article/original-2019", "primary-source"],
    ["reverse-image-search", "https://tineye.com/search/abc123"],
    
    ["confidence", "98"],
    ["severity", "severe"]
  ],
  "content": "# Image Analysis: Out-of-Context Photo\n\n## Issue\nThe hero image in this article about a local protest is actually from the 2019 Hong Kong pro-democracy protests.\n\n## Evidence\n\n### Reverse Image Search\nTinEye shows this exact image appearing in news coverage from June 2019, over 5 years before this article.\n\n### Original Source\nThe image was originally published by Associated Press on June 15, 2019, with caption: 'Thousands march in Hong Kong against extradition bill.'\n\n### Visual Analysis\n- Signs in image show Chinese characters\n- Architecture matches Hong Kong, not the US city in the article\n- Clothing and weather inconsistent with claimed date/location\n\n## Impact\nUsing this image creates a false impression of protest size and intensity for the local event being covered.\n\n## Recommendation\nArticle should use actual photos from the event being covered, or clearly label any stock/archival images.",
  "sig": "..."
}
```

### Example: Manipulated Image with Replacement

```json
{
  "kind": 32123,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["d", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9:product-photo"],
    ["url", "https://shop.example.com/product/widget"],
    ["url-hash", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["annotation-type", "image-issue"],
    
    ["image-url", "https://shop.example.com/images/widget-hero.jpg"],
    ["image-selector", "css", ".product-gallery img:first-child"],
    
    ["issue-type", "manipulated"],
    ["manipulation-type", "edited"],
    ["manipulation-type", "color-altered"],
    
    ["actual-context", "Product is smaller than shown and different color in person"],
    
    ["replacement-url", "https://reviews.example.com/user-photos/widget-actual.jpg"],
    ["replacement-source", "Customer review photo"],
    ["replacement-reason", "Shows actual product size and color as received by customers"],
    
    ["evidence", "https://reviews.example.com/widget/photos", "user-reviews"],
    ["metadata-analysis", "Listed dimensions 4x3 inches but photo shows scale suggesting 8x6 inches"],
    
    ["confidence", "90"],
    ["severity", "moderate"]
  ],
  "content": "# Image Analysis: Misleading Product Photo\n\n## Issues Found\n\n### Digital Manipulation\n- Product appears approximately 2x larger than actual size\n- Color has been enhanced/saturated beyond actual appearance\n- Background scaled to make product appear larger\n\n### Evidence\n- Multiple customer reviews note product is 'much smaller than pictured'\n- Product dimensions (4x3 inches) don't match apparent size in photo\n- Customer photos show muted color compared to listing\n\n## Suggested Replacement\nUsing actual customer photos would give accurate size and color expectations.\n\n## Consumer Impact\nThis misleading imagery leads to customer disappointment and returns.",
  "sig": "..."
}
```

### Migration Notes for 32123

**Backward Compatibility:** Fully backward compatible. Existing 32123 events continue to work. New image-specific tags are only required when `annotation-type` is `image-issue`.

**New Annotation Types:** Add `image-issue` to the list of valid `annotation-type` values:
- `highlight` (existing)
- `comment` (existing)
- `correction` (existing)
- `question` (existing)
- `fact-check` (existing)
- `image-issue` (NEW)

---

## 10. Dispute and Rebuttal Workflow

### Event Kind: 32130 (Custom - Dispute/Rebuttal)

**Type:** Parameterized Replaceable Event
**Purpose:** Structured challenges to existing annotations, ratings, or fact-checks with evidence-based rebuttals

### Schema

```json
{
  "kind": 32130,
  "pubkey": "<disputer-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<disputed-event-id:round>"],
    ["disputed-event", "<event-id>", "<event-kind>", "<relay-hint>"],
    ["disputed-author", "<pubkey-of-original-author>"],
    ["dispute-type", "<factual-error|methodology-flaw|missing-context|bias|outdated|misrepresentation>"],
    ["dispute-status", "<open|acknowledged|resolved|rejected|escalated>"],
    ["round", "<dispute-round-number>"],
    ["parent-dispute", "<parent-dispute-event-id>"],
    ["root-dispute", "<original-dispute-event-id>"],
    
    ["claim", "<specific-claim-being-disputed>"],
    ["counter-claim", "<the-rebuttal-claim>"],
    
    ["evidence", "<supporting-url>", "<evidence-type>", "<description>"],
    ["quote", "<quote-from-disputed-event>"],
    ["quote-rebuttal", "<why-quote-is-wrong>"],
    
    ["requested-action", "<retract|correct|add-context|acknowledge>"],
    ["proposed-correction", "<suggested-corrected-text>"],
    
    ["response-deadline", "<iso-timestamp>"],
    ["resolution", "<resolution-type>", "<resolution-details>"],
    ["resolved-at", "<iso-timestamp>"],
    ["resolved-by", "<pubkey-who-resolved>"],
    
    ["url", "<url-context-if-applicable>"],
    ["url-hash", "<sha256-of-url>"],
    ["confidence", "<0-100>"]
  ],
  "content": "<detailed-dispute-explanation-markdown>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Disputed event ID + round number |
| `disputed-event` | Yes | No | [event-id, kind, relay-hint] of challenged event |
| `disputed-author` | Yes | No | Pubkey of the original author |
| `dispute-type` | Yes | Yes | Type(s) of dispute |
| `dispute-status` | Yes | No | Current status of dispute |
| `round` | Yes | No | Which round of back-and-forth (1 = initial) |
| `parent-dispute` | No | No | Previous dispute in chain (for rounds > 1) |
| `root-dispute` | No | No | Original dispute (for rounds > 2) |
| `claim` | Yes | No | The specific claim being disputed |
| `counter-claim` | Yes | No | The rebuttal claim |
| `evidence` | Yes | Yes | [url, type, description] supporting rebuttal |
| `quote` | No | Yes | Quote from the disputed event |
| `quote-rebuttal` | No | Yes | Why the quote is problematic |
| `requested-action` | Yes | No | What action is requested |
| `proposed-correction` | No | No | Suggested fix if requesting correction |
| `response-deadline` | No | No | Suggested deadline for response |
| `resolution` | No | No | [type, details] if resolved |
| `resolved-at` | No | No | When dispute was resolved |
| `resolved-by` | No | No | Who resolved (usually original author) |
| `url` | No | No | URL context if disputing URL-related event |
| `url-hash` | No | No | URL hash for querying |
| `confidence` | No | No | Disputer's confidence (0-100) |

### Dispute Types

- **factual-error**: The disputed event contains factual inaccuracies
- **methodology-flaw**: The methodology used was flawed
- **missing-context**: Important context was omitted
- **bias**: The event shows unjustified bias
- **outdated**: Information was accurate but is now outdated
- **misrepresentation**: Content was misrepresented or misquoted

### Dispute Status

- **open**: Dispute filed, awaiting response
- **acknowledged**: Original author acknowledged the dispute
- **resolved**: Dispute has been resolved (see resolution tag)
- **rejected**: Dispute was rejected by original author
- **escalated**: Dispute escalated to community review

### Requested Actions

- **retract**: Remove or retract the disputed content
- **correct**: Correct specific errors
- **add-context**: Add missing context
- **acknowledge**: Acknowledge the dispute without changing

### Resolution Types

- **corrected**: Original event was corrected
- **retracted**: Original event was retracted
- **context-added**: Context was added
- **upheld**: Original content upheld after review
- **partially-corrected**: Some corrections made
- **stalemate**: No resolution reached

### Example: Disputing a Fact-Check

```json
{
  "kind": 32130,
  "pubkey": "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
  "created_at": 1699158000,
  "tags": [
    ["d", "abc123def456:1"],
    ["disputed-event", "abc123def456", "32127", "wss://relay.example.com"],
    ["disputed-author", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"],
    ["dispute-type", "factual-error"],
    ["dispute-type", "missing-context"],
    ["dispute-status", "open"],
    ["round", "1"],
    
    ["claim", "The fact-check rated the unemployment claim as 'misleading'"],
    ["counter-claim", "The claim was made in context of discussing historical trends and was clearly past-tense"],
    
    ["evidence", "https://video.example.com/speech-full", "primary-source", "Full video showing temporal context"],
    ["evidence", "https://transcript.example.com/speech", "transcript", "Official transcript with timestamps"],
    ["quote", "The claim was made in November 2024"],
    ["quote-rebuttal", "The speaker explicitly said 'during my first term' which establishes past-tense context"],
    
    ["requested-action", "correct"],
    ["proposed-correction", "Update verdict from 'misleading' to 'true' given the clear past-tense framing"],
    
    ["url", "https://example.com/political-speech"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["confidence", "90"]
  ],
  "content": "# Dispute: Unemployment Claim Fact-Check\n\n## Summary\nI am disputing the 'misleading' verdict on the unemployment claim fact-check.\n\n## Issues with Original Fact-Check\n\n### Missing Context\nThe fact-check states the claim 'was made in November 2024' and implies the speaker presented past achievements as current. However, the full video (evidence #1) shows the speaker explicitly framed this as 'during my first term' at timestamp 14:32.\n\n### Factual Error\nThe transcript (evidence #2) confirms the exact wording was: 'During my first term, unemployment reached its lowest level in 50 years.' This is clearly past-tense and historically accurate.\n\n## Requested Correction\nThe verdict should be updated from 'misleading' to 'true' because:\n1. The claim was explicitly past-tense\n2. The historical fact is accurate\n3. No reasonable listener would interpret this as a claim about current conditions\n\n## Evidence Summary\n1. Full video with timestamp showing context\n2. Official transcript confirming exact wording\n3. BLS data confirming the historical accuracy",
  "sig": "..."
}
```

### Example: Response to Dispute (Round 2)

```json
{
  "kind": 32130,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158500,
  "tags": [
    ["d", "abc123def456:2"],
    ["disputed-event", "abc123def456", "32127", "wss://relay.example.com"],
    ["disputed-author", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"],
    ["dispute-type", "factual-error"],
    ["dispute-status", "resolved"],
    ["round", "2"],
    ["parent-dispute", "xyz789dispute"],
    ["root-dispute", "xyz789dispute"],
    
    ["claim", "Dispute claims temporal context was clear"],
    ["counter-claim", "After review, I acknowledge the temporal framing was clearer than initially assessed"],
    
    ["resolution", "partially-corrected", "Updated to 'context-needed' with additional explanation"],
    ["resolved-at", "2024-11-05T12:00:00Z"],
    ["resolved-by", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"],
    
    ["url", "https://example.com/political-speech"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"]
  ],
  "content": "# Dispute Response\n\n## Acknowledgment\nAfter reviewing the full video and transcript provided by the disputer, I acknowledge that the temporal context ('during my first term') was clearer than reflected in my original fact-check.\n\n## Resolution\nI have updated the original fact-check (event abc123def456) with the following changes:\n1. Verdict changed from 'misleading' to 'context-needed'\n2. Added note about the past-tense framing\n3. Clarified that the historical claim itself is accurate\n\n## Remaining Concerns\nWhile the specific claim was past-tense, the broader speech context could still leave some listeners confused about current conditions. The 'context-needed' verdict reflects this nuance.\n\n## Thanks\nI appreciate the detailed dispute with quality evidence. This kind of collaborative fact-checking improves accuracy.",
  "sig": "..."
}
```

### Usage Notes

- Disputes are **replaceable** - status updates replace previous version
- Use `round` tag to track back-and-forth exchanges
- Multiple disputes can exist for the same event from different users
- Original authors should respond by creating round 2 events
- Resolution should update the original event when possible
- Clients can display dispute threads alongside original content
- Community can weigh in via separate dispute events

---

## 11. Related Content Linking

### Event Kind: 32131 (Custom - Related Content Link)

**Type:** Parameterized Replaceable Event
**Purpose:** Link URLs to related content (responses, primary sources, corrections, updates)

### Schema

```json
{
  "kind": 32131,
  "pubkey": "<linker-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["d", "<source-url-hash:target-url-hash>"],
    ["source-url", "<original-content-url>"],
    ["source-url-hash", "<sha256-of-normalized-source-url>"],
    ["source-title", "<original-content-title>"],
    ["source-domain", "<source-domain.com>"],
    ["source-date", "<source-publication-date>"],
    
    ["target-url", "<related-content-url>"],
    ["target-url-hash", "<sha256-of-normalized-target-url>"],
    ["target-title", "<related-content-title>"],
    ["target-domain", "<target-domain.com>"],
    ["target-date", "<target-publication-date>"],
    ["target-type", "<article|video|podcast|paper|document|social-post|archive>"],
    
    ["relationship", "<relationship-type>"],
    ["relationship-direction", "<source-to-target|target-to-source|bidirectional>"],
    ["relationship-strength", "<primary|supporting|tangential>"],
    
    ["relevance", "<high|medium|low>"],
    ["summary", "<brief-explanation-of-relationship>"],
    ["quote", "<relevant-quote-from-target>"],
    
    ["evidence", "<url-supporting-relationship>"],
    ["confidence", "<0-100>"],
    ["verified", "<true|false>"],
    ["verified-method", "<automated|manual|cross-reference>"],
    
    ["t", "<topic-tag>"],
    ["language", "<iso-language-code>"]
  ],
  "content": "<detailed-relationship-explanation-markdown>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Source URL hash + target URL hash |
| `source-url` | Yes | No | URL of the original content |
| `source-url-hash` | Yes | No | SHA-256 hash of source URL |
| `source-title` | No | No | Title of source content |
| `source-domain` | No | No | Domain of source |
| `source-date` | No | No | Publication date of source |
| `target-url` | Yes | No | URL of related content |
| `target-url-hash` | Yes | No | SHA-256 hash of target URL |
| `target-title` | No | No | Title of target content |
| `target-domain` | No | No | Domain of target |
| `target-date` | No | No | Publication date of target |
| `target-type` | No | No | Type of target content |
| `relationship` | Yes | No | Type of relationship |
| `relationship-direction` | No | No | Direction of the relationship |
| `relationship-strength` | No | No | How strongly related |
| `relevance` | No | No | Relevance level |
| `summary` | No | No | Brief relationship explanation |
| `quote` | No | Yes | Relevant quotes |
| `evidence` | No | Yes | URLs supporting the relationship |
| `confidence` | No | No | Confidence in the link (0-100) |
| `verified` | No | No | Whether relationship is verified |
| `verified-method` | No | No | How verification was done |
| `t` | No | Yes | Topic tags |
| `language` | No | No | Language of content |

### Relationship Types

**Response Relationships:**
- **response-article**: Article written in response to source
- **rebuttal**: Content that argues against source
- **critique**: Critical analysis of source
- **defense**: Content defending source
- **commentary**: Opinion/commentary on source

**Source Relationships:**
- **primary-source**: Original data/document source cites
- **cited-source**: Source formally cited by content
- **background**: Background information for context
- **research-basis**: Research the content is based on

**Update Relationships:**
- **correction**: Official correction to source
- **update**: Updated version of source content
- **follow-up**: Follow-up coverage on same topic
- **retraction**: Retraction of source content
- **editors-note**: Editorial note or addendum

**Archive Relationships:**
- **archive**: Archived version (Wayback, IPFS, etc.)
- **mirror**: Mirror or copy of content
- **translation**: Translation of content

**Media Relationships:**
- **video-discussion**: Video discussing the source
- **podcast-episode**: Podcast episode covering source
- **interview**: Interview related to source
- **documentary**: Documentary covering topic

**Other Relationships:**
- **related-topic**: Related content on same topic
- **same-event**: Different coverage of same event
- **same-author**: Other content by same author
- **contradicts**: Content that contradicts source
- **supports**: Content that supports source claims

### Example: Linking Article to Primary Source

```json
{
  "kind": 32131,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a:b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["source-url", "https://news.example.com/article/climate-study-results"],
    ["source-url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["source-title", "New Study Shows Accelerating Ice Loss"],
    ["source-domain", "news.example.com"],
    ["source-date", "2024-11-01"],
    
    ["target-url", "https://nature.com/articles/s12345-024-00001-1"],
    ["target-url-hash", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["target-title", "Satellite Observations of Antarctic Ice Sheet Mass Loss 2002-2024"],
    ["target-domain", "nature.com"],
    ["target-date", "2024-10-28"],
    ["target-type", "paper"],
    
    ["relationship", "primary-source"],
    ["relationship-direction", "source-to-target"],
    ["relationship-strength", "primary"],
    
    ["relevance", "high"],
    ["summary", "Original peer-reviewed research paper that the news article is reporting on"],
    ["quote", "We observe a 15% acceleration in ice mass loss compared to the 2002-2012 baseline period"],
    
    ["confidence", "100"],
    ["verified", "true"],
    ["verified-method", "cross-reference"],
    
    ["t", "climate"],
    ["t", "science"],
    ["language", "en"]
  ],
  "content": "# Link: News Article → Primary Research\n\n## Relationship\nThis news article reports on findings from the linked Nature paper.\n\n## Verification\n- The article explicitly cites this paper\n- Quotes match the paper's abstract and findings\n- Author names match\n\n## Why This Link Matters\nReaders can access the original peer-reviewed research to:\n- Verify the news article's accuracy\n- Read methodology details\n- See full data and limitations\n- Access supplementary materials",
  "sig": "..."
}
```

### Example: Linking to Rebuttal Article

```json
{
  "kind": 32131,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["d", "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0:d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1"],
    ["source-url", "https://blog.example.com/controversial-tech-take"],
    ["source-url-hash", "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0"],
    ["source-title", "Why Decentralization Will Fail"],
    ["source-domain", "blog.example.com"],
    ["source-date", "2024-10-15"],
    
    ["target-url", "https://response.example.org/decentralization-defense"],
    ["target-url-hash", "d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1"],
    ["target-title", "A Defense of Decentralization: Response to Critics"],
    ["target-domain", "response.example.org"],
    ["target-date", "2024-10-20"],
    ["target-type", "article"],
    
    ["relationship", "rebuttal"],
    ["relationship-direction", "target-to-source"],
    ["relationship-strength", "primary"],
    
    ["relevance", "high"],
    ["summary", "Direct response article that addresses each of the original's main arguments"],
    ["quote", "The original article makes three fundamental errors in its analysis..."],
    
    ["confidence", "95"],
    ["verified", "true"],
    ["verified-method", "manual"],
    
    ["t", "technology"],
    ["t", "decentralization"]
  ],
  "content": "# Link: Original Article ← Rebuttal\n\n## Relationship\nThe target article is a direct rebuttal to the source article, written by a prominent figure in the decentralization space.\n\n## Key Points Addressed\n1. Scalability concerns\n2. User experience arguments\n3. Economic sustainability claims\n\n## Why This Link Matters\nReaders of either article benefit from seeing both perspectives on this debate.",
  "sig": "..."
}
```

### Example: Linking to Archived Version

```json
{
  "kind": 32131,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158200,
  "tags": [
    ["d", "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2:f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3"],
    ["source-url", "https://news.example.com/deleted-article"],
    ["source-url-hash", "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2"],
    ["source-title", "Article That Was Later Removed"],
    ["source-domain", "news.example.com"],
    
    ["target-url", "https://web.archive.org/web/20241101120000/https://news.example.com/deleted-article"],
    ["target-url-hash", "f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3"],
    ["target-title", "Wayback Machine Archive"],
    ["target-domain", "web.archive.org"],
    ["target-date", "2024-11-01T12:00:00Z"],
    ["target-type", "archive"],
    
    ["relationship", "archive"],
    ["relationship-direction", "bidirectional"],
    ["relationship-strength", "primary"],
    
    ["relevance", "high"],
    ["summary", "Wayback Machine archive of article that has since been removed from original site"],
    
    ["confidence", "100"],
    ["verified", "true"],
    ["verified-method", "automated"]
  ],
  "content": "# Archive Link\n\nThe original article at news.example.com has been removed. This Wayback Machine archive preserves the content as it appeared on November 1, 2024.\n\n## Archive Details\n- Captured: 2024-11-01 12:00 UTC\n- Full page with images preserved\n- Original URL now returns 404",
  "sig": "..."
}
```

### Usage Notes

- Links are **replaceable** - can update relationship details
- Use consistent URL normalization for both source and target
- Multiple links can exist for the same URL pair (different relationship types)
- Clients can build knowledge graphs from these links
- Links can be queried by either source or target URL
- Bidirectional relationships should ideally have two events

---

## 12. URL Reactions with Context

### Event Kind: 32132 (Custom - URL Reaction)

**Type:** Regular Event (Non-replaceable)
**Purpose:** React to URLs with emoji and optional context, extending NIP-25 patterns

### Schema

```json
{
  "kind": 32132,
  "pubkey": "<reactor-pubkey>",
  "created_at": <unix-timestamp>,
  "tags": [
    ["url", "<reacted-url>"],
    ["url-hash", "<sha256-of-normalized-url>"],
    ["domain", "<domain.com>"],
    ["title", "<content-title>"],
    
    ["reaction", "<emoji-or-shortcode>"],
    ["reaction-type", "<standard|custom|sentiment>"],
    
    ["aspect", "<what-aspect-reaction-applies-to>"],
    ["reason-category", "<category-for-reaction>"],
    
    ["context", "<brief-explanation>"],
    ["quote", "<relevant-quote>"],
    ["position", "<offset>", "<length>"],
    
    ["e", "<related-event-id>", "<relay-hint>"],
    ["p", "<mentioned-pubkey>"]
  ],
  "content": "<optional-detailed-explanation>",
  "sig": "<signature>"
}
```

### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `url` | Yes | No | URL being reacted to |
| `url-hash` | Yes | No | SHA-256 hash for querying |
| `domain` | No | No | Domain name |
| `title` | No | No | Content title |
| `reaction` | Yes | Yes | Emoji or shortcode (multiple allowed) |
| `reaction-type` | No | No | Type of reaction |
| `aspect` | No | No | What aspect the reaction applies to |
| `reason-category` | No | No | Categorization of reaction reason |
| `context` | No | No | Brief explanation of reaction |
| `quote` | No | No | Quote that triggered reaction |
| `position` | No | No | Position of relevant content |
| `e` | No | Yes | Related NOSTR events |
| `p` | No | Yes | Mentioned users |

### Standard Reactions

**Sentiment Reactions:**
- `+` or `👍`: Positive/approval
- `-` or `👎`: Negative/disapproval
- `❤️`: Love/strong approval
- `🔥`: Hot take/controversial
- `🎯`: Accurate/on point
- `💯`: Perfect/strongly agree

**Quality Reactions:**
- `✅`: Verified/accurate
- `❌`: False/inaccurate
- `⚠️`: Warning/caution advised
- `🤔`: Questionable/needs scrutiny
- `📚`: Well-researched
- `🗑️`: Low quality

**Content Reactions:**
- `💡`: Insightful
- `🆕`: Novel/new information
- `📰`: Breaking news
- `🔄`: Updates previous info
- `📖`: Long read
- `🎥`: Video content

**Emotional Reactions:**
- `😂`: Funny
- `😢`: Sad
- `😡`: Anger-inducing
- `😱`: Shocking
- `🙄`: Eye-roll/skeptical

### Aspect Categories

What aspect of the content the reaction applies to:
- `overall`: Reaction to content as a whole
- `headline`: Reaction specifically to headline
- `argument`: Reaction to main argument
- `evidence`: Reaction to evidence quality
- `writing`: Reaction to writing quality
- `sources`: Reaction to sourcing
- `images`: Reaction to images used
- `author`: Reaction related to author

### Reason Categories

Why the reaction was given:
- `accuracy`: Related to factual accuracy
- `quality`: Related to content quality
- `importance`: Related to significance
- `entertainment`: Related to entertainment value
- `bias`: Related to perceived bias
- `originality`: Related to novelty
- `usefulness`: Related to practical value

### Example: Simple Positive Reaction

```json
{
  "kind": 32132,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["url", "https://example.com/great-article"],
    ["url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["domain", "example.com"],
    ["reaction", "👍"],
    ["reaction", "📚"],
    ["reaction-type", "standard"],
    ["aspect", "overall"],
    ["reason-category", "quality"]
  ],
  "content": "",
  "sig": "..."
}
```

### Example: Detailed Reaction with Context

```json
{
  "kind": 32132,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158100,
  "tags": [
    ["url", "https://news.example.com/misleading-headline-article"],
    ["url-hash", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["domain", "news.example.com"],
    ["title", "Scientists Discover SHOCKING Truth About Coffee"],
    
    ["reaction", "🙄"],
    ["reaction", "⚠️"],
    ["reaction-type", "sentiment"],
    
    ["aspect", "headline"],
    ["reason-category", "accuracy"],
    
    ["context", "Headline is clickbait - study shows minor correlation, not causation"],
    ["quote", "SHOCKING Truth"],
    
    ["e", "xyz789headline", "wss://relay.example.com"]
  ],
  "content": "The headline dramatically overstates a modest finding. The actual study found a weak correlation (r=0.15) between coffee consumption and one specific metric. Nothing 'shocking' here.\n\nNote: I've also filed a headline correction (event xyz789headline) with a suggested better headline.",
  "sig": "..."
}
```

### Example: Multiple Reactions from Same User

```json
{
  "kind": 32132,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158200,
  "tags": [
    ["url", "https://blog.example.com/nuanced-analysis"],
    ["url-hash", "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0"],
    ["reaction", "💡"],
    ["reaction", "📚"],
    ["reaction", "🎯"],
    ["aspect", "argument"],
    ["reason-category", "originality"],
    ["context", "Novel framework for understanding the issue with strong supporting evidence"]
  ],
  "content": "",
  "sig": "..."
}
```

### Relationship to NIP-25

This event kind extends NIP-25 (Reactions) patterns for URL-specific reactions:

| NIP-25 (kind 7) | URL Reactions (kind 32132) |
|-----------------|---------------------------|
| Reacts to events | Reacts to URLs |
| Uses `e` tag for target | Uses `url` tag for target |
| Simple emoji content | Multiple reactions in tags |
| No context | Optional context and explanation |
| No categorization | Aspect and reason categories |

**Interoperability:** Clients that don't support kind 32132 can still query URL metadata using other event types. Kind 32132 provides enhanced reaction capabilities without breaking existing NIP-25 implementations.

### Usage Notes

- Reactions are **non-replaceable** - each reaction is a separate event
- Users can react multiple times with different aspects/contexts
- Multiple `reaction` tags allow expressing complex sentiment
- Aggregate reactions by URL for reaction counts
- Context field enables explaining non-obvious reactions
- Link to related events (e.g., headline corrections, fact-checks)
- Clients should normalize emoji for consistent counting

---

## Extended Query Patterns

### Query Patterns for New Event Types

#### Finding Profile Mappings for a Platform URL

```javascript
// Normalize and hash the profile URL
const profileUrlHash = sha256(normalizeUrl(profileUrl));

// Query by URL hash
{
  kinds: [32128],
  "#url-hash": [profileUrlHash]
}

// Or query by platform and username
{
  kinds: [32128],
  "#platform": ["twitter"],
  "#username": ["fiatjaf"]
}
```

#### Finding All Profile Mappings for a Pubkey

```javascript
{
  kinds: [32128],
  "#target-pubkey": [pubkey]
}
```

#### Finding Headline Corrections for a URL

```javascript
const urlHash = sha256(normalizeUrl(articleUrl));

{
  kinds: [32129],
  "#url-hash": [urlHash]
}
```

#### Finding Headline Corrections by Problem Type

```javascript
{
  kinds: [32129],
  "#problem-type": ["clickbait"],
  "#domain": ["news.example.com"]
}
```

#### Finding Image Annotations for a URL

```javascript
const urlHash = sha256(normalizeUrl(pageUrl));

{
  kinds: [32123],
  "#url-hash": [urlHash],
  "#annotation-type": ["image-issue"]
}
```

#### Finding All Disputes for an Event

```javascript
{
  kinds: [32130],
  "#disputed-event": [eventId]
}
```

#### Finding Open Disputes

```javascript
{
  kinds: [32130],
  "#dispute-status": ["open"],
  authors: [pubkeysYouFollow]
}
```

#### Finding Related Content for a URL

```javascript
const urlHash = sha256(normalizeUrl(contentUrl));

// Find where this URL is the source
{
  kinds: [32131],
  "#source-url-hash": [urlHash]
}

// Find where this URL is the target
{
  kinds: [32131],
  "#target-url-hash": [urlHash]
}
```

#### Finding Related Content by Relationship Type

```javascript
{
  kinds: [32131],
  "#source-url-hash": [urlHash],
  "#relationship": ["primary-source"]
}
```

#### Finding Reactions for a URL

```javascript
const urlHash = sha256(normalizeUrl(contentUrl));

{
  kinds: [32132],
  "#url-hash": [urlHash]
}
```

#### Aggregating Reactions by Type

```javascript
// Client-side aggregation
const reactions = await relay.list([{
  kinds: [32132],
  "#url-hash": [urlHash]
}]);

const counts = reactions.reduce((acc, event) => {
  const reactionTags = event.tags.filter(t => t[0] === 'reaction');
  reactionTags.forEach(([_, emoji]) => {
    acc[emoji] = (acc[emoji] || 0) + 1;
  });
  return acc;
}, {});
```

### Combined Query for Complete URL Metadata

```javascript
async function getUrlMetadata(url) {
  const urlHash = sha256(normalizeUrl(url));
  
  const queries = [
    { kinds: [30003], "#url": [url] },                    // Bookmarks
    { kinds: [32123], "#url-hash": [urlHash] },          // Annotations
    { kinds: [32124], "#url-hash": [urlHash] },          // Ratings
    { kinds: [32125], "#url-hash": [urlHash] },          // Entity refs
    { kinds: [32126], "#url-hash": [urlHash] },          // Aggregates
    { kinds: [32127], "#url-hash": [urlHash] },          // Fact-checks
    { kinds: [32129], "#url-hash": [urlHash] },          // Headline corrections
    { kinds: [32131], "#source-url-hash": [urlHash] },   // Related (as source)
    { kinds: [32131], "#target-url-hash": [urlHash] },   // Related (as target)
    { kinds: [32132], "#url-hash": [urlHash] }           // Reactions
  ];
  
  const results = await Promise.all(
    queries.map(q => relay.list([q]))
  );
  
  return {
    bookmarks: results[0],
    annotations: results[1],
    ratings: results[2],
    entityRefs: results[3],
    aggregates: results[4],
    factChecks: results[5],
    headlineCorrections: results[6],
    relatedAsSource: results[7],
    relatedAsTarget: results[8],
    reactions: results[9]
  };
}
```

---

## Event Kind Summary

### Complete Event Kind Registry

| Kind | Name | Type | Purpose | NIP Reference |
|------|------|------|---------|---------------|
| 30003 | Bookmark List | Param. Replaceable | URL bookmarks with tags | NIP-51 |
| 32123 | URL Annotation | Param. Replaceable | Inline annotations (enhanced for images) | Custom |
| 32124 | Content Rating | Param. Replaceable | Multi-dimensional ratings | Custom |
| 32125 | Entity Reference | Param. Replaceable | Entity identification in content | Custom |
| 32126 | Rating Aggregate | Param. Replaceable | Computed aggregate ratings | Custom |
| 32127 | Fact Check | Param. Replaceable | Structured fact-checking | Custom |
| 32128 | Profile URL Mapping | Param. Replaceable | Map external URLs to pubkeys | Custom (NEW) |
| 32129 | Headline Correction | Param. Replaceable | Suggest better headlines | Custom (NEW) |
| 32130 | Dispute/Rebuttal | Param. Replaceable | Challenge existing events | Custom (NEW) |
| 32131 | Related Content Link | Param. Replaceable | Link related URLs | Custom (NEW) |
| 32132 | URL Reaction | Regular | React to URLs with context | Custom (NEW), extends NIP-25 |

### Tag Index for Relay Optimization

Relays should index the following tags for efficient queries:

**URL-Related Tags:**
- `url`: Canonical URL
- `url-hash`: SHA-256 hash of normalized URL
- `source-url-hash`: For related content queries
- `target-url-hash`: For related content queries
- `profile-url`: For profile mappings
- `domain`: Domain filtering

**Entity Tags:**
- `target-pubkey`: For profile mappings
- `platform`: Platform filtering
- `entity-name`: Entity searches

**Status Tags:**
- `dispute-status`: Filter by dispute status
- `problem-type`: Filter headline issues
- `relationship`: Filter related content types
- `annotation-type`: Filter annotation types
- `issue-type`: Filter image issues

**Content Tags:**
- `reaction`: Aggregate reactions
- `verdict`: Filter fact-check verdicts
- `rating`: Filter by rating dimensions

---

## Migration Notes

### Existing Event Compatibility

**Kind 32123 (Annotations):**
- Fully backward compatible
- New `image-issue` annotation type and related tags are additive
- Existing annotations continue to work without modification
- Clients should check for `annotation-type` to render appropriately

**Kind 32124-32127:**
- No changes required
- New event kinds are independent

### Client Upgrade Path

1. **Phase 1:** Add support for querying new event kinds
2. **Phase 2:** Add UI for viewing new metadata types
3. **Phase 3:** Add creation UI for new event types
4. **Phase 4:** Integrate dispute workflow

### Relay Upgrade Path

1. **Immediate:** No changes required (standard NIP-01 support)
2. **Recommended:** Add indexes for new tag types
3. **Optional:** Support aggregate queries across event types

---

## Summary

This schema design provides:

- **Comprehensive coverage** of all use cases
- **NOSTR-native** patterns using existing NIPs where possible
- **Extensible** structure for future enhancements
- **Queryable** with standard NOSTR filters
- **Verifiable** with transparent methodologies
- **Privacy-respecting** with visibility controls
- **Interoperable** across different clients

### New Capabilities Added

1. **Profile URL Resolution (32128):** Map social media profiles to NOSTR pubkeys with verification
2. **Headline Corrections (32129):** Flag and suggest improvements for problematic headlines
3. **Image Annotations (32123 enhanced):** Identify misleading, manipulated, or out-of-context images
4. **Dispute Workflow (32130):** Structured challenges and rebuttals to existing metadata
5. **Related Content Linking (32131):** Connect URLs to responses, sources, and updates
6. **URL Reactions (32132):** Rich emoji reactions with context for URLs

The schemas enable building a robust, decentralized content metadata ecosystem that promotes information quality, accountability, and informed discourse.