# NOSTR NIPs Analysis for Content Metadata System

## Overview
This document analyzes existing NOSTR Implementation Possibilities (NIPs) and recommends which to leverage for a decentralized content metadata and annotation system.

## Relevant Existing NIPs

### Core Protocol NIPs

#### NIP-01: Basic Protocol Flow
**Status:** REQUIRED - Foundation for all events
**Relevance:** Essential
**Description:** Defines the basic NOSTR protocol, event structure, and relay communication.

**Event Structure:**
```json
{
  "id": "<32-bytes lowercase hex-encoded sha256 of serialized event data>",
  "pubkey": "<32-bytes lowercase hex-encoded public key>",
  "created_at": "<unix timestamp in seconds>",
  "kind": "<integer>",
  "tags": [["<tag-type>", "<tag-value>", ...]],
  "content": "<arbitrary string>",
  "sig": "<64-bytes lowercase hex of signature>"
}
```

**Why Use It:** Provides the foundational event structure all our custom events will build upon.

---

#### NIP-10: Text Events and Replies
**Status:** RECOMMENDED
**Relevance:** High for annotations and commentary
**Description:** Conventions for text events (kind 1) and reply chains using `e` and `p` tags.

**Key Features:**
- Thread-like discussions using `e` tags (event references)
- Root event identification
- Reply chains
- Mention system with `p` tags (pubkey references)

**Why Use It:** Provides a proven pattern for linking annotations to content and creating discussion threads about URLs.

---

#### NIP-25: Reactions
**Status:** RECOMMENDED
**Relevance:** Medium for simple ratings
**Description:** Defines kind 7 events for reactions (likes, dislikes, emojis).

**Event Structure:**
```json
{
  "kind": 7,
  "content": "+", 
  "tags": [
    ["e", "<event-id>"],
    ["p", "<pubkey>"]
  ]
}
```

**Why Use It:** Can be used for simple thumbs up/down reactions to content, though we'll need more sophisticated rating systems for detailed evaluations.

---

#### NIP-51: Lists
**Status:** HIGHLY RECOMMENDED
**Relevance:** Critical for bookmarks and categorization
**Description:** Defines replaceable list events (kinds 30000-30009) for managing collections.

**Key List Types:**
- Kind 30000: Follows (people)
- Kind 30001: Generic lists (mute, pin, bookmark)
- Kind 30002: Relay sets
- Kind 30003: Bookmark sets
- Kind 30004: Curation sets

**Event Structure:**
```json
{
  "kind": 30003,
  "tags": [
    ["d", "<list-identifier>"],
    ["e", "<event-id>", "<relay-hint>", "<marker>"],
    ["t", "<tag>"],
    ["title", "<list-title>"]
  ],
  "content": "<optional-description>"
}
```

**Why Use It:** Perfect foundation for URL bookmarking with tags. The `d` tag makes lists replaceable by the same identifier, allowing updates.

---

#### NIP-33: Parameterized Replaceable Events
**Status:** REQUIRED
**Relevance:** Critical for updateable metadata
**Description:** Defines events (kinds 30000-39999) that can be replaced based on pubkey + kind + d-tag.

**Key Features:**
- Replaceable by same author
- Identified by unique `d` tag
- Latest version is canonical
- Perfect for evolving metadata

**Why Use It:** Essential for maintaining current ratings, reviews, and metadata that may need updates over time.

---

#### NIP-56: Reporting
**Status:** RECOMMENDED
**Relevance:** Medium for content flagging
**Description:** Defines kind 1984 events for reporting content (spam, illegal, NSFW, etc.).

**Event Structure:**
```json
{
  "kind": 1984,
  "tags": [
    ["e", "<event-id>", "<relay-hint>"],
    ["p", "<pubkey>"],
    ["report", "<type>", "<reason>"]
  ],
  "content": "<optional-details>"
}
```

**Why Use It:** Provides a standard way for users to flag problematic content, which can feed into quality ratings.

---

#### NIP-40: Expiration Timestamp
**Status:** OPTIONAL
**Relevance:** Low (could be useful for temporary annotations)
**Description:** Adds an `expiration` tag to events that should be deleted after a certain time.

**Why Consider It:** Could be useful for time-limited annotations or temporary bookmarks, though most metadata should be permanent.

---

#### NIP-89: Application Handlers
**Status:** RECOMMENDED
**Relevance:** Medium for client interoperability
**Description:** Defines how applications can advertise their ability to handle certain event kinds.

**Why Use It:** Helps different clients understand and render our custom event kinds properly.

---

### NIPs for Advanced Features

#### NIP-94: File Metadata
**Status:** OPTIONAL
**Relevance:** Low to Medium
**Description:** Defines kind 1063 for file metadata events.

**Why Consider It:** While not directly applicable to URL metadata, the pattern could inspire metadata structure for media URLs.

---

#### NIP-78: Application-Specific Data
**Status:** UNDER CONSIDERATION
**Relevance:** Medium
**Description:** Defines kind 30078 for arbitrary application data that's queryable.

**Why Consider It:** Could be useful for storing structured metadata that doesn't fit other event types.

---

## Use Case Mapping

### 1. URL Bookmarks with Tags

**Primary NIP:** NIP-51 (Lists) - Kind 30003 (Bookmark sets)
**Supporting NIPs:** NIP-33 (Parameterized Replaceable Events)

**Rationale:**
- NIP-51 bookmark sets are designed exactly for this use case
- Replaceable nature allows updating tags and organization
- Native support for relay hints
- `t` tags provide categorization
- Can create multiple bookmark lists for different purposes

**Recommended Extension:**
- Add `url` tag for direct URL bookmarking: `["url", "https://example.com", "<title>"]`
- Add `domain` tag for filtering: `["domain", "example.com"]`

---

### 2. Inline Annotations

**Primary NIP:** Custom Event (propose kind 32123)
**Supporting NIPs:** NIP-10 (for threading), NIP-33 (for updates)

**Rationale:**
- No existing NIP perfectly captures inline annotations with position data
- Need to store URL, position/selector, and annotation text
- Should be replaceable to allow editing
- Can use NIP-10 patterns for replies to annotations

**Design Requirements:**
- URL reference
- Text selector or position (e.g., xpath, CSS selector, text quote)
- Annotation content
- Optional inline/margin designation
- Support for highlight vs. comment vs. edit suggestions

---

### 3. Content Ratings and Reviews

**Primary NIP:** Custom Event (propose kind 32124)
**Supporting NIPs:** NIP-33 (replaceability), NIP-25 (simple reactions)

**Rationale:**
- NIP-25 reactions are too simple for structured ratings
- Need multi-dimensional rating capability
- Should be replaceable as opinions evolve
- Need structured schema for aggregation

**Design Requirements:**
- URL reference
- Multiple rating dimensions (quality, accuracy, bias, etc.)
- Numeric scores with defined scales
- Optional review text
- Rating methodology identifier
- Timestamp for version tracking

---

### 4. Entity Relationships (People, Organizations, Content Links)

**Primary NIP:** Custom Event (propose kind 32125)
**Supporting NIPs:** NIP-01 (tag structure), NIP-78 (structured data)

**Rationale:**
- Need to identify and link entities mentioned in content
- Should support different relationship types
- Needs structured data for querying
- Should be aggregatable across multiple identifiers

**Design Requirements:**
- URL reference
- Entity type (person, organization, content)
- Entity identifier (name, URL, NOSTR pubkey if applicable)
- Relationship type (author, mentioned, linked, publisher)
- Optional context (quote, position in document)
- Confidence level

---

### 5. Aggregate Ratings and Reputation

**Primary NIP:** Custom Event (propose kind 32126) + Query Patterns
**Supporting NIPs:** NIP-51 (for follow lists), NIP-01 (for filtering)

**Rationale:**
- Aggregation requires client-side computation or specialized relay support
- Should support weighted aggregation by follow graph
- Needs query patterns for efficient retrieval
- Trust metrics should be transparent and customizable

**Design Requirements:**
- Reference to rated content/entity
- Aggregation methodology
- Time window for included ratings
- Trust network used (follow graph, custom list)
- Computed metrics
- Supporting data for verification

---

## Custom Event Kind Recommendations

Based on the analysis, we need to define custom event kinds in the range 30000-39999 (parameterized replaceable) and possibly 1000-9999 (regular replaceable or ephemeral):

### Proposed Event Kinds

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 30003 | Bookmark List | Existing (NIP-51) | URL bookmarks with tags |
| 32123 | URL Annotation | Parameterized Replaceable | Inline annotations with position |
| 32124 | Content Rating | Parameterized Replaceable | Multi-dimensional content ratings |
| 32125 | Entity Reference | Parameterized Replaceable | Entity identification in content |
| 32126 | Rating Aggregate | Parameterized Replaceable | Computed aggregate ratings |
| 32127 | Fact Check | Parameterized Replaceable | Structured fact-checking results |
| 1063 | File Metadata | Existing (NIP-94) | Can extend for URL metadata |

### Kind Number Rationale

- **30003**: Use existing NIP-51 bookmark kind
- **32123-32127**: Custom kinds in parameterized replaceable range (30000-39999)
  - Numbers chosen to group related functionality
  - Parameterized replaceable allows updates by same author
  - Uses `d` tag to identify which URL/content is being annotated/rated
  
---

## Additional Considerations

### Tag Standards

We should establish consistent tag usage across all event types:

- `url`: The canonical URL being referenced
- `url-hash`: SHA-256 hash of normalized URL for exact matching
- `domain`: Domain name for filtering
- `title`: Content title
- `published`: Original publication date
- `content-type`: MIME type or content category
- `language`: ISO language code

### Relay Requirements

To support this system effectively, relays should:

1. **Support NIP-01, NIP-33**: Basic requirement
2. **Index by tag**: Efficient `url`, `domain`, `d` tag queries
3. **Support NIP-50**: Full-text search for annotations and reviews
4. **Aggregate queries**: Ability to fetch all events for a URL efficiently
5. **Auth/Access**: NIP-42 for private annotations if needed

### Interoperability

For maximum adoption:

1. **Follow existing patterns**: Use NIP-10 style threading where applicable
2. **Clear documentation**: Provide examples and client implementation guides
3. **Extensibility**: Design schemas to allow future additions without breaking changes
4. **Backwards compatibility**: Where possible, be compatible with simpler clients

---

## Next Steps

1. Define detailed event schemas for each custom kind
2. Create JSON schema definitions for validation
3. Document query patterns for efficient data retrieval
4. Design aggregation algorithms for rating systems
5. Specify trust and reputation calculation methods
6. Create example events for each use case
7. Draft a new NIP proposal for submission to the NOSTR community

---

## Summary

This analysis recommends:

**Use existing NIPs:**
- NIP-01 (foundation)
- NIP-10 (threading)
- NIP-25 (simple reactions)
- NIP-33 (replaceability)
- NIP-51 (bookmark lists)

**Define new event kinds:**
- 32123: URL Annotations
- 32124: Content Ratings
- 32125: Entity References
- 32126: Rating Aggregates
- 32127: Fact Checks

This approach maximizes compatibility with existing NOSTR infrastructure while providing the specialized functionality needed for decentralized content metadata and quality assessment.