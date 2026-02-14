# Decentralized News Verification System - Data Model

> **Note**: This document was written during v1 planning for a broader verification system. The v2 implementation (NOSTR Article Capture) uses a simplified entity model focused on article capture and tagging. See [v2 Entity Types](#v2-entity-types-implemented) below.

## Overview

This document defines the core data model for a decentralized news/media verification system built on NOSTR. The system enables users to annotate, fact-check, and establish trust networks around news content and claims.

## Core Entities

### 1. Content Items
- **URL-based Content**: News articles, blog posts, social media posts
- **Text Fragments**: Specific quotes, headlines, or paragraphs within content
- **Claims**: Specific factual assertions extracted from content
- **Media Objects**: Images, videos, audio files with verification metadata

### 2. Annotations
- **Fact Checks**: Verification of specific claims with evidence
- **Source Citations**: References to supporting or contradicting evidence
- **Context Notes**: Additional background information or clarification
- **Corrections**: Updates or amendments to previously published information

### 3. Entities (Real-world Objects)
- **People**: Public figures, journalists, sources, experts
- **Organizations**: News outlets, companies, government agencies
- **Events**: News events, incidents, conferences
- **Concepts**: Topics, categories, subjects (e.g., "Climate Change", "Elections")
- **Locations**: Geographic places and regions

### v2 Entity Types (Implemented)

The v2 NOSTR Article Capture implementation uses four entity types, each with a real secp256k1 keypair:

| Type | Emoji | Description | Examples |
|------|-------|-------------|----------|
| **Person** | 👤 | An individual human | Author, journalist, public figure |
| **Organization** | 🏢 | A company, institution, or group | News outlet, university, corporation |
| **Place** | 📍 | A geographic location | City, country, landmark |
| **Thing** | 🔷 | A concept, event, legislation, or other noun | "Climate Change", "Title IX", "AI" |

Entity data is stored in GM_setValue as an entity registry, synced across browsers via NIP-78 (kind 30078) events encrypted with NIP-44 v2.

### 4. Relationships
- **Attribution**: Who said/wrote/published what
- **Causation**: One event caused another
- **Contradiction**: Two claims contradict each other
- **Support**: Evidence that supports a claim
- **Temporal**: Time-based relationships (before/after/during)
- **Spatial**: Location-based relationships

### 5. Trust Networks
- **User Profiles**: NOSTR public keys with reputation metadata
- **Domain Expertise**: Areas where users have demonstrated knowledge
- **Endorsements**: Users vouching for other users in specific domains
- **Track Records**: Historical accuracy of user's fact-checks and claims

## NOSTR Event Types

### Custom Event Kinds (10000+ range for parameterized replaceable events)

#### 10001: Content Annotation
```json
{
  "kind": 10001,
  "content": "{\"type\": \"fact_check\", \"claim\": \"...\", \"verdict\": \"true|false|misleading|unverified\", \"confidence\": 0.85, \"evidence\": [...]}",
  "tags": [
    ["d", "unique_annotation_id"],
    ["url", "https://example.com/article"],
    ["p", "content_author_pubkey"],
    ["t", "politics"],
    ["t", "climate"],
    ["claim_hash", "sha256_of_claim_text"]
  ]
}
```

#### 10002: Entity Definition
```json
{
  "kind": 10002,
  "content": "{\"name\": \"Entity Name\", \"type\": \"person|organization|event|concept\", \"description\": \"...\", \"aliases\": [...], \"metadata\": {...}}",
  "tags": [
    ["d", "entity_id"],
    ["t", "entity_type"],
    ["url", "canonical_url"],
    ["alias", "alternative_name"]
  ]
}
```

#### 10003: Relationship Assertion
```json
{
  "kind": 10003,
  "content": "{\"relationship_type\": \"supports|contradicts|caused_by|attributed_to\", \"strength\": 0.9, \"temporal\": \"2024-01-01\", \"evidence\": [...]}",
  "tags": [
    ["d", "relationship_id"],
    ["source_entity", "entity_id_1"],
    ["target_entity", "entity_id_2"],
    ["r", "relationship_type"]
  ]
}
```

#### 10004: Trust Signal
```json
{
  "kind": 10004,
  "content": "{\"signal_type\": \"endorsement|expertise_claim|reputation_update\", \"domain\": \"journalism\", \"score\": 0.8, \"evidence\": \"...\"}",
  "tags": [
    ["d", "trust_signal_id"],
    ["p", "target_user_pubkey"],
    ["domain", "expertise_area"],
    ["signal_type", "endorsement"]
  ]
}
```

## Data Relationships

### Content → Claims → Evidence
```
Article/Post
├── Contains Claims
│   ├── Fact Check Results
│   ├── Supporting Evidence
│   └── Contradicting Evidence
└── Author Attribution
    ├── Author Trust Score
    └── Domain Expertise
```

### Trust Network Structure
```
User
├── Domain Expertise Areas
├── Historical Accuracy Score
├── Endorsements Given
├── Endorsements Received
└── Fact Check Track Record
```

## Graph Database Schema (Neo4j)

### Node Types
- `Content` (url, title, published_date, content_hash)
- `Claim` (text, claim_hash, extracted_date)
- `Entity` (name, type, canonical_id)
- `User` (nostr_pubkey, reputation_score)
- `Annotation` (type, verdict, confidence, created_at)

### Relationship Types
- `CONTAINS` (Content → Claim)
- `ANNOTATES` (User → Claim via Annotation)
- `SUPPORTS/CONTRADICTS` (Claim → Claim)
- `AUTHORED_BY` (Content → Entity/User)
- `REFERENCES` (Claim → Entity)
- `ENDORSES` (User → User in Domain)

## Trust Calculation Framework

### Multi-Signal Approach
1. **Historical Accuracy**: Track record of correct fact-checks
2. **Domain Expertise**: Specialization in specific subject areas
3. **Peer Endorsements**: Other users vouching for credibility
4. **Source Diversity**: Range of evidence sources cited
5. **Temporal Consistency**: Consistency of positions over time
6. **Transparency Score**: Openness about sources and methodology

### Trust Score Formula
```
trust_score = weighted_average([
  historical_accuracy * 0.3,
  domain_expertise * 0.25,
  peer_endorsements * 0.2,
  source_diversity * 0.15,
  temporal_consistency * 0.05,
  transparency_score * 0.05
])
```

## Privacy and Security Considerations

- All annotations are cryptographically signed using NOSTR keys
- Content hashes prevent tampering with referenced material
- Optional pseudonymous operation with reputation transfer mechanisms
- Encrypted private annotations for sensitive content
- Spam prevention through proof-of-work or stake mechanisms

## Scalability Architecture

### Relay Strategy
- Specialized relays for different content types
- Geographic distribution for performance
- Backup and redundancy across multiple relays

### Caching and Indexing
- Local graph database for fast queries
- Distributed hash tables for content discovery
- Real-time synchronization with conflict resolution

This data model provides the foundation for a flexible, trustworthy, and scalable decentralized news verification system.