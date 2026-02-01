# API Specifications - Decentralized News Verification System

## Overview

This document defines the REST API endpoints, WebSocket connections, and data contracts for the decentralized news verification system. The API serves as the primary interface between client applications and the backend services.

## Base Configuration

```yaml
# API Configuration
base_url: "https://api.factcheck-network.com"
version: "v1"
authentication: "Bearer JWT (NOSTR signature-based)"
rate_limits:
  authenticated: 1000/hour
  anonymous: 100/hour
content_type: "application/json"
```

## Authentication

### NOSTR-based Authentication Flow

```typescript
// Authentication request
POST /api/v1/auth/challenge
{
  "pubkey": "npub1abc123...",
  "challenge_type": "login"
}

// Response with challenge
{
  "challenge": "random_string_12345",
  "expires_at": "2024-01-01T12:00:00Z"
}

// Submit signed challenge
POST /api/v1/auth/verify
{
  "pubkey": "npub1abc123...",
  "challenge": "random_string_12345",
  "signature": "signed_challenge_hex",
  "event": {
    // Complete NOSTR event with signature
  }
}

// Authentication response
{
  "token": "jwt_token_here",
  "expires_in": 3600,
  "user": {
    "pubkey": "npub1abc123...",
    "trust_score": 8.5,
    "domains": ["politics", "technology"]
  }
}
```

## Content Verification API

### Get Content Verifications

```http
GET /api/v1/content/verifications?url={encoded_url}
```

**Parameters:**
- `url` (required): URL-encoded content URL
- `include_disputed` (optional): Include disputed annotations
- `min_trust_score` (optional): Minimum annotator trust score
- `domain` (optional): Filter by domain expertise

**Response:**
```json
{
  "url": "https://example.com/news/article",
  "content_hash": "sha256_hash",
  "total_annotations": 15,
  "consensus_verdict": "mostly_true",
  "confidence_score": 0.82,
  "last_updated": "2024-01-01T12:00:00Z",
  "annotations": [
    {
      "id": "annotation_123",
      "annotator": {
        "pubkey": "npub1xyz...",
        "trust_score": 9.1,
        "domain_expertise": {"politics": 8.9}
      },
      "claim": {
        "text": "Unemployment dropped by 2%",
        "hash": "claim_hash_456",
        "position": {"start": 123, "end": 145}
      },
      "verdict": "true",
      "confidence": 0.85,
      "evidence": [
        {
          "type": "source",
          "url": "https://bls.gov/data/unemployment",
          "description": "Official BLS statistics"
        }
      ],
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Create Content Annotation

```http
POST /api/v1/content/annotations
Authorization: Bearer {jwt_token}
```

**Request:**
```json
{
  "content": {
    "url": "https://example.com/news/article",
    "title": "Article Title",
    "content_hash": "sha256_hash"
  },
  "claim": {
    "text": "The economy grew by 5%",
    "position": {"start": 234, "end": 256},
    "context": "surrounding paragraph text"
  },
  "annotation": {
    "verdict": "misleading",
    "confidence": 0.75,
    "reasoning": "While GDP grew, the 5% figure is annualized, not quarterly",
    "evidence": [
      {
        "type": "source",
        "url": "https://fed.gov/economic-data",
        "description": "Federal Reserve economic data"
      }
    ],
    "tags": ["economics", "gdp", "statistics"]
  }
}
```

**Response:**
```json
{
  "annotation_id": "annotation_789",
  "status": "published",
  "nostr_event_id": "event_abc123",
  "published_relays": ["relay1.com", "relay2.com"],
  "trust_impact": {
    "previous_score": 8.5,
    "new_score": 8.6,
    "domain_impact": {"economics": 0.1}
  }
}
```

## Claims and Entity API

### Search Claims

```http
GET /api/v1/claims/search
```

**Parameters:**
- `q` (required): Search query
- `verdict` (optional): Filter by verdict (true/false/misleading/unverified)
- `domain` (optional): Filter by domain
- `date_range` (optional): Date range filter
- `min_confidence` (optional): Minimum confidence threshold
- `limit` (optional): Results limit (default: 20, max: 100)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "total": 150,
  "results": [
    {
      "claim_hash": "claim_abc123",
      "text": "Renewable energy accounts for 30% of total generation",
      "first_seen": "2024-01-01T08:00:00Z",
      "verification_summary": {
        "total_annotations": 8,
        "consensus_verdict": "mostly_true",
        "confidence_score": 0.78,
        "trusted_annotators": 6
      },
      "entities": [
        {"name": "Department of Energy", "type": "organization"},
        {"name": "renewable energy", "type": "concept"}
      ],
      "sources": [
        "https://example-news.com/article1",
        "https://another-site.com/post2"
      ]
    }
  ]
}
```

### Get Entity Information

```http
GET /api/v1/entities/{entity_id}
```

**Response:**
```json
{
  "entity_id": "entity_person_123",
  "name": "Dr. Jane Smith",
  "type": "person",
  "description": "Climate scientist at MIT",
  "aliases": ["J. Smith", "Jane A. Smith"],
  "verification_status": "verified",
  "expertise_domains": ["climate_science", "environmental_policy"],
  "trust_indicators": {
    "academic_credentials": true,
    "publication_record": "https://scholar.google.com/...",
    "institutional_affiliation": "MIT"
  },
  "recent_mentions": [
    {
      "url": "https://news.com/climate-report",
      "context": "quoted as expert source",
      "date": "2024-01-01T12:00:00Z"
    }
  ],
  "relationship_count": {
    "authored": 45,
    "quoted_in": 123,
    "collaborated_with": 12
  }
}
```

## Trust Network API

### Get User Trust Profile

```http
GET /api/v1/users/{pubkey}/trust
```

**Response:**
```json
{
  "pubkey": "npub1abc123...",
  "overall_trust_score": 8.7,
  "domain_expertise": {
    "politics": {"score": 9.1, "annotations": 245, "accuracy": 0.89},
    "technology": {"score": 8.3, "annotations": 156, "accuracy": 0.85},
    "science": {"score": 7.9, "annotations": 89, "accuracy": 0.82}
  },
  "trust_metrics": {
    "historical_accuracy": 0.86,
    "peer_endorsements": 23,
    "consistency_score": 0.91,
    "source_diversity": 0.78,
    "transparency_score": 0.84
  },
  "activity_summary": {
    "total_annotations": 490,
    "recent_activity": 12,
    "avg_confidence": 0.83,
    "disputed_annotations": 8
  },
  "endorsements": [
    {
      "endorser_pubkey": "npub1def456...",
      "domain": "politics",
      "strength": 0.9,
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Create User Endorsement

```http
POST /api/v1/users/endorsements
Authorization: Bearer {jwt_token}
```

**Request:**
```json
{
  "target_pubkey": "npub1xyz789...",
  "domain": "climate_science",
  "endorsement_strength": 0.85,
  "reasoning": "Consistently accurate climate data analysis",
  "evidence": [
    "Verified multiple IPCC citations correctly",
    "Provides detailed methodology in annotations"
  ]
}
```

## Real-time WebSocket API

### WebSocket Connection

```typescript
// Connect to WebSocket
const ws = new WebSocket('wss://api.factcheck-network.com/ws');

// Authentication after connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'jwt_token_here'
}));

// Subscribe to content updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'content_updates',
  filters: {
    urls: ['https://example.com/article'],
    min_trust_score: 7.0
  }
}));
```

### WebSocket Message Types

#### Real-time Annotation Updates
```json
{
  "type": "annotation_update",
  "data": {
    "url": "https://example.com/article",
    "annotation": {
      "id": "new_annotation_123",
      "claim_hash": "claim_abc",
      "verdict": "false",
      "annotator_trust": 8.9,
      "confidence": 0.92
    },
    "impact": {
      "consensus_change": true,
      "previous_verdict": "unverified",
      "new_verdict": "mostly_false"
    }
  }
}
```

#### Trust Score Updates
```json
{
  "type": "trust_update",
  "data": {
    "pubkey": "npub1abc123...",
    "previous_score": 8.5,
    "new_score": 8.7,
    "domain": "politics",
    "reason": "accurate_annotation_confirmed"
  }
}
```

## Search and Discovery API

### Advanced Content Search

```http
GET /api/v1/search/content
```

**Parameters:**
- `q` (required): Search query with operators
- `content_type` (optional): article/social_post/video/image
- `verification_status` (optional): verified/disputed/unverified
- `date_range` (optional): Date range filter
- `source_domains` (optional): Filter by source domains
- `entity_mentions` (optional): Filter by entity mentions
- `trust_threshold` (optional): Minimum trust threshold for results

**Advanced Query Syntax:**
```
# Text search with operators
q="climate change" AND verified:true

# Domain-specific search
q=politics trust_score:>8.0

# Entity-based search
q=entity:"Joe Biden" verdict:disputed

# Temporal search
q=election date:2024-01-01..2024-12-31
```

### Trending Topics

```http
GET /api/v1/trending
```

**Response:**
```json
{
  "timeframe": "24h",
  "topics": [
    {
      "topic": "inflation statistics",
      "annotation_count": 156,
      "controversy_score": 0.67,
      "dominant_verdict": "misleading",
      "key_claims": [
        "Inflation rate decreased by 2%",
        "Consumer prices rose 8% year-over-year"
      ],
      "trending_reason": "high_annotation_volume"
    }
  ],
  "disputed_claims": [
    {
      "claim_hash": "claim_xyz",
      "text": "Unemployment is at historic lows",
      "dispute_score": 0.89,
      "annotation_count": 45,
      "pro_annotations": 12,
      "con_annotations": 33
    }
  ]
}
```

## Administration API

### System Health

```http
GET /api/v1/admin/health
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "neo4j": {"status": "up", "response_time": 15},
    "redis": {"status": "up", "response_time": 2},
    "elasticsearch": {"status": "up", "response_time": 45},
    "nostr_relays": {
      "relay1.com": {"status": "up", "latency": 123},
      "relay2.com": {"status": "down", "error": "timeout"}
    }
  },
  "metrics": {
    "active_users": 1250,
    "annotations_24h": 450,
    "trust_calculations_pending": 23,
    "avg_response_time": 185
  }
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_CLAIM_FORMAT",
    "message": "The claim text contains invalid characters",
    "details": {
      "field": "claim.text",
      "rejected_characters": ["<script>", "</script>"]
    },
    "request_id": "req_12345",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created (new annotation/endorsement)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (content/user not found)
- `409` - Conflict (duplicate annotation)
- `429` - Rate Limited
- `500` - Internal Server Error
- `503` - Service Unavailable

## Data Validation Schemas

### Annotation Schema
```typescript
interface AnnotationRequest {
  content: {
    url: string;           // Valid URL
    title?: string;        // Max 500 chars
    content_hash: string;  // SHA-256 hash
  };
  claim: {
    text: string;          // Max 1000 chars, no HTML
    position?: {           // Text position in content
      start: number;
      end: number;
    };
    context?: string;      // Max 2000 chars
  };
  annotation: {
    verdict: 'true' | 'false' | 'misleading' | 'unverified';
    confidence: number;    // 0.0 to 1.0
    reasoning?: string;    // Max 5000 chars
    evidence: Evidence[];  // Max 10 items
    tags: string[];        // Max 20 tags
  };
}

interface Evidence {
  type: 'source' | 'study' | 'expert_opinion' | 'data';
  url?: string;           // Valid URL for sources
  description: string;    // Max 500 chars
  credibility_score?: number; // 0.0 to 1.0
}
```

This API specification provides a comprehensive interface for all client applications to interact with the decentralized news verification system, with strong typing, validation, and real-time capabilities.