# Evidentiary Standards Framework

## Overview

This document defines comprehensive evidentiary standards for the decentralized URL metadata system. It establishes what constitutes valid proof for different types of claims, how to evaluate evidence quality, and how to preserve evidence for long-term verification.

The fundamental challenge: **anyone can make claims about URLs, but not all claims are equally supported**. Without clear evidentiary standards, the system would be vulnerable to unsubstantiated claims, manipulation, and misinformation.

---

## Table of Contents

1. [Evidence Type Taxonomy](#1-evidence-type-taxonomy)
2. [Evidence Quality Scoring](#2-evidence-quality-scoring)
3. [Claim-Evidence Matrices](#3-claim-evidence-matrices)
4. [Evidence Archival and Preservation](#4-evidence-archival-and-preservation)
5. [Chain of Custody](#5-chain-of-custody)
6. [Burden of Proof Standards](#6-burden-of-proof-standards)
7. [NOSTR Event Schemas for Evidence](#7-nostr-event-schemas-for-evidence)
8. [Procedural Standards](#8-procedural-standards)

---

## 1. Evidence Type Taxonomy

### 1.1 Evidence Classification Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVIDENCE TYPE HIERARCHY                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRIMARY SOURCES (Tier 1)                                           │
│  ├── Original Documents                                             │
│  ├── Official Records                                               │
│  ├── Raw Data / Datasets                                            │
│  ├── Direct Testimony                                               │
│  └── Physical/Digital Artifacts                                     │
│                                                                     │
│  SECONDARY SOURCES (Tier 2)                                         │
│  ├── Peer-Reviewed Research                                         │
│  ├── Investigative Journalism                                       │
│  ├── Expert Analysis                                                │
│  ├── Institutional Reports                                          │
│  └── Court Documents / Legal Records                                │
│                                                                     │
│  TERTIARY SOURCES (Tier 3)                                          │
│  ├── Encyclopedias / Reference Works                                │
│  ├── Textbooks                                                      │
│  ├── News Aggregations                                              │
│  ├── Meta-Analyses                                                  │
│  └── Fact-Check Compilations                                        │
│                                                                     │
│  SUPPORTING EVIDENCE (Tier 4)                                       │
│  ├── Circumstantial Evidence                                        │
│  ├── Corroborating Testimony                                        │
│  ├── Pattern Evidence                                               │
│  └── Contextual Information                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Primary Source Types

Primary sources are original, firsthand evidence closest to the subject being examined.

#### 1.2.1 Original Documents

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `official-document` | Government/institutional documents | Official seal, verifiable origin, chain of custody | 0.95 |
| `legal-filing` | Court filings, contracts, agreements | Case numbers, official filing stamps | 0.90 |
| `corporate-filing` | SEC filings, annual reports | Filing numbers, regulatory verification | 0.90 |
| `birth-death-records` | Vital records | Issuing authority verification | 0.95 |
| `property-records` | Deeds, titles, assessments | Registry verification | 0.90 |
| `correspondence` | Original emails, letters, memos | Headers, metadata, authentication | 0.75-0.90 |
| `internal-memo` | Internal organizational documents | Provenance, whistleblower verification | 0.70-0.85 |

#### 1.2.2 Official Records

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `government-data` | Census, economic, health statistics | Agency source, methodology published | 0.90-0.95 |
| `scientific-data` | Raw experimental/observational data | DOI, repository, methodology | 0.85-0.95 |
| `financial-data` | Market data, transaction records | Exchange verification, timestamps | 0.90 |
| `geographic-data` | Maps, coordinates, satellite imagery | Source agency, timestamp, resolution | 0.85-0.95 |
| `archival-records` | Historical documents in archives | Archive identification, provenance | 0.85-0.90 |

#### 1.2.3 Raw Data / Datasets

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `research-dataset` | Published research data | DOI, repository, peer review | 0.85-0.95 |
| `open-government-data` | Government open data portals | Agency attribution, update frequency | 0.85-0.90 |
| `sensor-data` | IoT, weather, environmental sensors | Calibration records, timestamps | 0.80-0.90 |
| `log-files` | System logs, access logs | Hash verification, chain of custody | 0.75-0.90 |
| `blockchain-data` | On-chain transactions, smart contracts | Block confirmation, immutability | 0.95 |

#### 1.2.4 Direct Testimony

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `eyewitness-firsthand` | Direct observation by witness | Proximity, timing, independence | 0.60-0.80 |
| `expert-firsthand` | Expert's direct observation/analysis | Credentials, methodology, independence | 0.75-0.90 |
| `participant-account` | Account from event participant | Corroboration, documentation | 0.55-0.75 |
| `whistleblower` | Insider disclosure | Corroboration, documentation, risk taken | 0.60-0.85 |
| `sworn-statement` | Affidavits, depositions | Legal consequences for falsehood | 0.70-0.85 |

#### 1.2.5 Physical/Digital Artifacts

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `photograph-original` | Original unedited photographs | EXIF data, chain of custody, forensics | 0.70-0.90 |
| `video-original` | Original unedited video | Metadata, chain of custody, forensics | 0.70-0.90 |
| `audio-original` | Original unedited audio | Metadata, voice analysis, forensics | 0.65-0.85 |
| `physical-artifact` | Physical objects as evidence | Chain of custody, expert examination | 0.70-0.90 |
| `digital-artifact` | Software, code, digital files | Hash verification, provenance | 0.75-0.90 |

### 1.3 Secondary Source Types

Secondary sources analyze, interpret, or describe primary sources.

#### 1.3.1 Peer-Reviewed Research

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `journal-article` | Peer-reviewed journal publication | Impact factor, citation count, replication | 0.80-0.90 |
| `systematic-review` | Systematic literature review | PRISMA compliance, registration | 0.85-0.95 |
| `randomized-trial` | RCT results | Registration, blinding, sample size | 0.85-0.95 |
| `observational-study` | Cohort, case-control studies | Methodology, confounding control | 0.70-0.85 |
| `preprint` | Non-peer-reviewed manuscript | Author reputation, methodology | 0.50-0.70 |

#### 1.3.2 Investigative Journalism

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `investigative-report` | Long-form investigative journalism | Source count, documentation, corrections | 0.70-0.85 |
| `news-report-verified` | News with multiple verified sources | Source attribution, editorial standards | 0.65-0.80 |
| `news-report-single` | Single-source news report | Source credibility, outlet reputation | 0.50-0.65 |
| `wire-service` | AP, Reuters, AFP reports | Agency standards, corrections policy | 0.70-0.80 |
| `local-reporting` | Local news coverage | Proximity to event, local knowledge | 0.60-0.75 |

#### 1.3.3 Expert Analysis

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `expert-report` | Formal expert analysis/report | Credentials, methodology, independence | 0.75-0.90 |
| `forensic-analysis` | Digital/physical forensics | Accreditation, methodology, chain of custody | 0.80-0.95 |
| `statistical-analysis` | Statistical expert analysis | Methodology transparency, data access | 0.75-0.90 |
| `technical-audit` | Technical system audit | Auditor credentials, scope, methodology | 0.75-0.90 |
| `expert-opinion` | Expert commentary/opinion | Credentials, basis stated, conflicts | 0.55-0.75 |

#### 1.3.4 Institutional Reports

| Subtype | Description | Quality Indicators | Base Weight |
|---------|-------------|-------------------|-------------|
| `government-report` | Official government analysis | Agency authority, methodology | 0.75-0.90 |
| `ngo-report` | NGO research/investigation | Methodology, funding transparency | 0.65-0.80 |
| `academic-report` | University/think tank research | Methodology, peer review, funding | 0.70-0.85 |
| `industry-report` | Industry association research | Methodology, conflict disclosure | 0.50-0.70 |
| `international-org` | UN, WHO, World Bank reports | Methodology, data sources | 0.75-0.90 |

### 1.4 Tertiary Source Types

Tertiary sources compile, summarize, or index primary and secondary sources.

| Type | Description | Quality Indicators | Base Weight |
|------|-------------|-------------------|-------------|
| `encyclopedia` | General/specialized encyclopedias | Editorial process, citation quality | 0.50-0.70 |
| `reference-work` | Handbooks, dictionaries, almanacs | Authority, currency, accuracy | 0.50-0.70 |
| `textbook` | Educational textbooks | Author credentials, peer review, edition | 0.55-0.75 |
| `fact-check` | Professional fact-checking org | Methodology, corrections, independence | 0.65-0.85 |
| `meta-analysis` | Aggregated research analysis | Methodology, inclusion criteria | 0.75-0.90 |
| `systematic-map` | Evidence mapping studies | Protocol, comprehensiveness | 0.70-0.85 |

### 1.5 Supporting Evidence Types

Supporting evidence provides context or corroboration but is not definitive alone.

| Type | Description | Quality Indicators | Base Weight |
|------|-------------|-------------------|-------------|
| `circumstantial` | Indirect evidence suggesting conclusion | Logical connection, multiple pieces | 0.30-0.50 |
| `pattern-evidence` | Patterns suggesting behavior/outcome | Sample size, consistency, controls | 0.40-0.60 |
| `character-evidence` | Evidence of character/reputation | Relevance, recency, consistency | 0.20-0.40 |
| `hearsay` | Secondhand accounts | Source identification, corroboration | 0.20-0.40 |
| `social-media` | Social media posts/content | Authentication, context, timing | 0.30-0.60 |
| `anecdotal` | Individual anecdotes/stories | Specificity, verifiability | 0.15-0.35 |

### 1.6 Evidence Type Identifiers

Standardized identifiers for use in NOSTR events:

```
evidence-type := tier "/" category "/" subtype

Examples:
- primary/document/official-document
- primary/data/government-data
- primary/testimony/eyewitness-firsthand
- secondary/research/journal-article
- secondary/journalism/investigative-report
- secondary/expert/forensic-analysis
- tertiary/reference/fact-check
- supporting/pattern/pattern-evidence
```

---

## 2. Evidence Quality Scoring

### 2.1 Quality Scoring Model

Evidence quality is evaluated across multiple dimensions to produce a composite score.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVIDENCE QUALITY DIMENSIONS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  VERIFIABILITY (weight: 0.25)                                       │
│  └── Can the evidence be independently verified?                    │
│                                                                     │
│  INDEPENDENCE (weight: 0.20)                                        │
│  └── Is the source independent from the claim?                      │
│                                                                     │
│  RELIABILITY (weight: 0.20)                                         │
│  └── Does the source have a track record of accuracy?               │
│                                                                     │
│  RELEVANCE (weight: 0.15)                                           │
│  └── How directly does the evidence address the claim?              │
│                                                                     │
│  RECENCY (weight: 0.10)                                             │
│  └── How current is the evidence?                                   │
│                                                                     │
│  METHODOLOGY (weight: 0.10)                                         │
│  └── Was sound methodology used to produce the evidence?            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Quality Score Calculation

#### 2.2.1 Overall Quality Formula

```
Q(evidence) = Σ(wi × Di) × Tbase × Pchain × Dtime

where:
  Q = quality score [0, 1]
  wi = dimension weight
  Di = dimension score [0, 1]
  Tbase = base type weight from taxonomy
  Pchain = chain of custody factor [0.5, 1.0]
  Dtime = time decay factor [0, 1]
```

#### 2.2.2 Dimension Scoring Functions

**Verifiability Score (D_verify):**

```python
def calculate_verifiability(evidence: Evidence) -> float:
    """Calculate verifiability score for evidence."""
    
    score = 0.0
    
    # Is the source publicly accessible?
    if evidence.is_publicly_accessible:
        score += 0.30
    elif evidence.is_accessible_on_request:
        score += 0.15
    
    # Can the evidence be independently reproduced?
    if evidence.methodology_published:
        score += 0.25
    
    # Is there a verification mechanism?
    verification_methods = {
        'cryptographic_hash': 0.20,
        'digital_signature': 0.15,
        'official_registry': 0.20,
        'institutional_confirmation': 0.15,
        'multiple_archives': 0.15,
        'none': 0.0
    }
    score += verification_methods.get(evidence.verification_method, 0.0)
    
    # Has it been independently verified?
    if evidence.independent_verifications > 0:
        verification_bonus = min(0.25, 0.05 * evidence.independent_verifications)
        score += verification_bonus
    
    return min(1.0, score)
```

**Independence Score (D_independence):**

```python
def calculate_independence(evidence: Evidence, claim: Claim) -> float:
    """Calculate independence score for evidence relative to claim."""
    
    score = 1.0  # Start with full independence
    
    # Check for conflicts of interest
    if evidence.source_has_financial_interest(claim):
        score -= 0.40
    
    if evidence.source_has_ideological_alignment(claim):
        score -= 0.20
    
    if evidence.source_is_party_to_claim(claim):
        score -= 0.50
    
    # Check source independence from claim maker
    if evidence.source_affiliated_with_claimant:
        score -= 0.30
    
    # Bonus for adversarial sources
    if evidence.source_is_adversarial_to_claim:
        score = min(1.0, score + 0.15)
    
    return max(0.0, score)
```

**Reliability Score (D_reliability):**

```python
def calculate_reliability(evidence: Evidence) -> float:
    """Calculate reliability score based on source track record."""
    
    source = evidence.source
    
    # Base reliability from source type
    source_type_reliability = {
        'peer_reviewed_journal': 0.85,
        'government_agency': 0.80,
        'major_news_outlet': 0.70,
        'academic_institution': 0.80,
        'individual_expert': 0.60,
        'anonymous_source': 0.30,
        'social_media': 0.25
    }
    base = source_type_reliability.get(source.type, 0.50)
    
    # Adjust for track record
    if source.accuracy_rate is not None:
        track_record_factor = source.accuracy_rate  # [0, 1]
        base = base * 0.6 + track_record_factor * 0.4
    
    # Adjust for corrections/retractions
    if source.has_issued_corrections_for_this:
        base *= 0.5
    
    # Adjust for known biases
    if source.documented_bias:
        base *= 0.8
    
    return base
```

**Relevance Score (D_relevance):**

```python
def calculate_relevance(evidence: Evidence, claim: Claim) -> float:
    """Calculate how directly evidence addresses the claim."""
    
    relevance_types = {
        'directly_proves': 1.0,      # Evidence directly proves/disproves claim
        'strongly_supports': 0.85,   # Strong support for claim
        'moderately_supports': 0.65, # Moderate support
        'tangentially_related': 0.40, # Related but indirect
        'contextual_only': 0.20,     # Provides context only
        'unrelated': 0.0             # Not relevant
    }
    
    base_relevance = relevance_types.get(evidence.relevance_type, 0.50)
    
    # Adjust for specificity
    if evidence.addresses_specific_aspect_of_claim:
        base_relevance = min(1.0, base_relevance + 0.10)
    
    # Adjust for scope match
    if evidence.scope_matches_claim:
        base_relevance = min(1.0, base_relevance + 0.05)
    
    return base_relevance
```

**Recency Score (D_recency):**

```python
import math

def calculate_recency(evidence: Evidence, claim: Claim) -> float:
    """Calculate recency score with claim-type-specific decay."""
    
    # Get age of evidence in days
    evidence_age_days = (now() - evidence.created_at) / 86400
    
    # Different decay rates for different claim types
    decay_rates = {
        'current_event': 0.05,      # Fast decay - 14 day half-life
        'ongoing_situation': 0.01,   # Medium decay - 69 day half-life
        'historical_fact': 0.001,    # Slow decay - 693 day half-life
        'scientific_finding': 0.002, # Slow decay - 347 day half-life
        'statistical_claim': 0.02,   # Medium-fast decay - 35 day half-life
        'identity_claim': 0.005      # Medium decay - 139 day half-life
    }
    
    decay_rate = decay_rates.get(claim.type, 0.01)
    
    # Calculate decay factor
    recency_score = math.exp(-decay_rate * evidence_age_days)
    
    # Minimum floor for historical evidence
    if claim.type == 'historical_fact':
        recency_score = max(0.5, recency_score)
    
    return recency_score
```

**Methodology Score (D_methodology):**

```python
def calculate_methodology(evidence: Evidence) -> float:
    """Calculate methodology quality score."""
    
    score = 0.0
    
    # Is methodology documented?
    if evidence.methodology_documented:
        score += 0.30
    
    # Is methodology standard/accepted?
    methodology_quality = {
        'gold_standard': 0.40,
        'widely_accepted': 0.30,
        'established': 0.20,
        'novel': 0.10,
        'undocumented': 0.0
    }
    score += methodology_quality.get(evidence.methodology_status, 0.0)
    
    # Sample size adequacy (for research)
    if evidence.has_sample_size:
        if evidence.sample_size >= evidence.adequate_sample_size:
            score += 0.15
        else:
            score += 0.15 * (evidence.sample_size / evidence.adequate_sample_size)
    
    # Peer review status
    if evidence.is_peer_reviewed:
        score += 0.15
    
    return min(1.0, score)
```

### 2.3 Time Decay Functions

Evidence relevance decays over time at different rates based on claim type:

```python
class TimeDecay:
    """Time decay functions for evidence freshness."""
    
    # Decay constants (per day)
    DECAY_RATES = {
        'breaking_news': 0.10,       # 7 day half-life
        'current_event': 0.05,       # 14 day half-life
        'recent_development': 0.02,  # 35 day half-life
        'ongoing_situation': 0.01,   # 69 day half-life
        'general_claim': 0.005,      # 139 day half-life
        'scientific': 0.002,         # 347 day half-life
        'historical': 0.0005,        # 1386 day half-life
        'permanent': 0.0             # No decay
    }
    
    @staticmethod
    def exponential_decay(age_days: float, rate: float) -> float:
        """Standard exponential decay."""
        return math.exp(-rate * age_days)
    
    @staticmethod
    def stepped_decay(age_days: float, thresholds: list) -> float:
        """Stepped decay with defined thresholds."""
        # thresholds = [(days, multiplier), ...]
        for days, multiplier in sorted(thresholds, reverse=True):
            if age_days >= days:
                return multiplier
        return 1.0
    
    @staticmethod
    def calculate_evidence_decay(
        evidence_timestamp: int,
        claim_type: str,
        current_time: int
    ) -> float:
        """Calculate time decay factor for evidence."""
        
        age_days = (current_time - evidence_timestamp) / 86400
        rate = TimeDecay.DECAY_RATES.get(claim_type, 0.005)
        
        # Apply exponential decay
        decay_factor = TimeDecay.exponential_decay(age_days, rate)
        
        # Apply minimum floor (evidence never becomes completely worthless)
        min_floor = 0.1 if claim_type != 'permanent' else 1.0
        
        return max(min_floor, decay_factor)
```

### 2.4 Aggregating Multiple Evidence Pieces

When multiple pieces of evidence support or contradict a claim:

#### 2.4.1 Corroboration Bonus

```python
def calculate_corroboration_bonus(evidence_list: list[Evidence]) -> float:
    """Calculate bonus for multiple independent corroborating evidence."""
    
    if len(evidence_list) <= 1:
        return 0.0
    
    # Group by source independence
    independent_sources = group_by_independence(evidence_list)
    num_independent = len(independent_sources)
    
    if num_independent <= 1:
        return 0.0
    
    # Diminishing returns for additional sources
    # First corroboration: +0.15
    # Second: +0.10
    # Third: +0.05
    # Fourth+: +0.02 each (capped at +0.10)
    
    bonus = 0.0
    if num_independent >= 2:
        bonus += 0.15
    if num_independent >= 3:
        bonus += 0.10
    if num_independent >= 4:
        bonus += 0.05
    if num_independent >= 5:
        additional = min(0.10, (num_independent - 4) * 0.02)
        bonus += additional
    
    return bonus
```

#### 2.4.2 Evidence Aggregation Formula

```python
def aggregate_evidence_quality(
    evidence_list: list[Evidence],
    claim: Claim
) -> AggregatedQuality:
    """Aggregate multiple pieces of evidence into composite quality score."""
    
    if not evidence_list:
        return AggregatedQuality(score=0.0, confidence=0.0)
    
    # Calculate individual quality scores
    quality_scores = []
    for evidence in evidence_list:
        q = calculate_evidence_quality(evidence, claim)
        quality_scores.append({
            'evidence': evidence,
            'quality': q,
            'weight': evidence.base_weight
        })
    
    # Sort by quality (highest first)
    quality_scores.sort(key=lambda x: x['quality'], reverse=True)
    
    # Weighted aggregation with diminishing contributions
    total_score = 0.0
    total_weight = 0.0
    
    for i, item in enumerate(quality_scores):
        # Each subsequent piece of evidence contributes less
        position_factor = 1.0 / (1.0 + 0.3 * i)
        
        contribution = item['quality'] * item['weight'] * position_factor
        total_score += contribution
        total_weight += item['weight'] * position_factor
    
    if total_weight == 0:
        base_score = 0.0
    else:
        base_score = total_score / total_weight
    
    # Apply corroboration bonus
    corroboration = calculate_corroboration_bonus(evidence_list)
    
    # Calculate final score (capped at 1.0)
    final_score = min(1.0, base_score + corroboration)
    
    # Calculate confidence interval
    confidence = calculate_confidence_interval(quality_scores)
    
    return AggregatedQuality(
        score=final_score,
        confidence=confidence,
        evidence_count=len(evidence_list),
        strongest_evidence=quality_scores[0]['evidence'],
        corroboration_bonus=corroboration
    )
```

### 2.5 Handling Conflicting Evidence

When evidence contradicts itself:

```python
def resolve_conflicting_evidence(
    supporting: list[Evidence],
    contradicting: list[Evidence],
    claim: Claim
) -> ConflictResolution:
    """Resolve conflicts between supporting and contradicting evidence."""
    
    # Aggregate both sides
    support_quality = aggregate_evidence_quality(supporting, claim)
    contradict_quality = aggregate_evidence_quality(contradicting, claim)
    
    # Calculate confidence in each direction
    support_total = support_quality.score * len(supporting)
    contradict_total = contradict_quality.score * len(contradicting)
    
    total = support_total + contradict_total
    if total == 0:
        return ConflictResolution(status='undetermined')
    
    support_ratio = support_total / total
    
    # Determine verdict
    if support_ratio > 0.75:
        verdict = 'supported'
        confidence = support_ratio
    elif support_ratio < 0.25:
        verdict = 'contradicted'
        confidence = 1 - support_ratio
    else:
        verdict = 'disputed'
        confidence = max(support_ratio, 1 - support_ratio)
    
    # Calculate uncertainty
    uncertainty = 1.0 - abs(support_ratio - 0.5) * 2
    
    return ConflictResolution(
        verdict=verdict,
        confidence=confidence,
        uncertainty=uncertainty,
        support_score=support_quality.score,
        contradict_score=contradict_quality.score,
        support_count=len(supporting),
        contradict_count=len(contradicting),
        key_conflicts=identify_key_conflicts(supporting, contradicting)
    )
```

### 2.6 Confidence Interval Calculations

```python
import math
from scipy import stats

def calculate_confidence_interval(
    quality_scores: list[dict],
    confidence_level: float = 0.95
) -> ConfidenceInterval:
    """Calculate confidence interval for aggregated evidence quality."""
    
    if len(quality_scores) < 2:
        return ConfidenceInterval(
            lower=0.0,
            upper=1.0,
            confidence_level=confidence_level,
            sample_size=len(quality_scores)
        )
    
    # Extract scores
    scores = [qs['quality'] for qs in quality_scores]
    
    # Calculate statistics
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / (len(scores) - 1)
    std_dev = math.sqrt(variance)
    std_error = std_dev / math.sqrt(len(scores))
    
    # Calculate t-statistic for confidence level
    alpha = 1 - confidence_level
    t_stat = stats.t.ppf(1 - alpha/2, df=len(scores)-1)
    
    # Calculate interval
    margin = t_stat * std_error
    lower = max(0.0, mean - margin)
    upper = min(1.0, mean + margin)
    
    return ConfidenceInterval(
        lower=lower,
        upper=upper,
        mean=mean,
        std_dev=std_dev,
        confidence_level=confidence_level,
        sample_size=len(scores)
    )
```

---

## 3. Claim-Evidence Matrices

### 3.1 Claim Type Classification

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLAIM TYPE TAXONOMY                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FACTUAL CLAIMS                                                     │
│  ├── Historical Fact         "Event X happened on date Y"           │
│  ├── Current Fact            "Company X has Y employees"            │
│  ├── Scientific Fact         "Water boils at 100°C at sea level"    │
│  ├── Statistical Fact        "X% of population has Y"               │
│  └── Attribution             "Person X said Y"                      │
│                                                                     │
│  CAUSAL CLAIMS                                                      │
│  ├── Direct Causation        "X causes Y"                           │
│  ├── Contributing Factor     "X contributes to Y"                   │
│  ├── Correlation Claim       "X is correlated with Y"               │
│  └── Mechanism Claim         "X works by doing Y"                   │
│                                                                     │
│  EVALUATIVE CLAIMS                                                  │
│  ├── Quality Assessment      "X is better than Y"                   │
│  ├── Accuracy Assessment     "Article X is accurate"                │
│  ├── Bias Assessment         "Source X has bias toward Y"           │
│  └── Credibility Assessment  "Source X is credible"                 │
│                                                                     │
│  PREDICTIVE CLAIMS                                                  │
│  ├── Future Event            "X will happen by date Y"              │
│  ├── Trend Projection        "X will continue to increase"          │
│  └── Conditional Prediction  "If X then Y will happen"              │
│                                                                     │
│  IDENTITY CLAIMS                                                    │
│  ├── Person Identity         "Account X belongs to person Y"        │
│  ├── Organization Identity   "Organization X is same as Y"          │
│  ├── Content Authorship      "Person X created content Y"           │
│  └── Affiliation             "Person X is affiliated with Y"        │
│                                                                     │
│  AUTHENTICITY CLAIMS                                                │
│  ├── Image Authenticity      "Image X is unmanipulated"             │
│  ├── Document Authenticity   "Document X is genuine"                │
│  ├── Video Authenticity      "Video X is unedited"                  │
│  └── Quote Authenticity      "Quote X is accurate"                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Evidence Requirements by Claim Type

#### 3.2.1 Factual Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Historical Fact** | 2+ independent secondary sources | Primary documents + expert analysis | Single source, recent revisionism |
| **Current Fact** | 1 official source OR 2+ independent sources | Official records + verification | Outdated information, conflicting reports |
| **Scientific Fact** | Peer-reviewed publication | Meta-analysis + replication studies | Preprints only, retracted papers |
| **Statistical Fact** | Original data source + methodology | Government/institutional data + analysis | Cherry-picked data, undefined methodology |
| **Attribution** | Primary source (video/audio/document) | Multiple recordings + context | Edited clips, lack of context, paraphrase |

#### 3.2.2 Causal Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Direct Causation** | RCT or strong quasi-experimental evidence | Multiple RCTs + mechanism evidence | Observational only, confounders |
| **Contributing Factor** | Observational study with controls | Multiple studies + dose-response | Single study, reverse causation |
| **Correlation Claim** | Statistical analysis with significance | Multiple independent datasets | p-hacking, small samples |
| **Mechanism Claim** | Expert analysis + experimental evidence | Peer-reviewed mechanism studies | Speculation, untested hypotheses |

#### 3.2.3 Evaluative Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Quality Assessment** | Defined criteria + systematic analysis | Expert reviews + user data | Undefined criteria, conflicts of interest |
| **Accuracy Assessment** | Point-by-point verification with sources | Multiple fact-checks + primary sources | Selective checking, missing context |
| **Bias Assessment** | Pattern analysis + examples | Systematic content analysis + expert analysis | Cherry-picked examples, no baseline |
| **Credibility Assessment** | Track record analysis + methodology review | Historical accuracy data + peer assessment | Single incident, outdated info |

#### 3.2.4 Predictive Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Future Event** | Expert analysis + historical patterns | Model + track record + consensus | No basis stated, single predictor |
| **Trend Projection** | Current data + trend analysis | Multiple data sources + expert models | Short timeframe, changing conditions |
| **Conditional Prediction** | Mechanism evidence + conditional analysis | Peer-reviewed models + validation | Unfalsifiable, undefined conditions |

#### 3.2.5 Identity Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Person Identity** | Self-attestation OR official records | Cryptographic proof + multiple attestations | Anonymous allegations, doxxing |
| **Organization Identity** | Corporate records | Government filings + official statements | Unverifiable claims |
| **Content Authorship** | Publication record OR author statement | Multiple attributions + metadata | Plagiarism indicators |
| **Affiliation** | Official records OR organizational confirmation | Employment records + public statements | Outdated affiliations |

#### 3.2.6 Authenticity Claims

| Claim Subtype | Minimum Evidence | Preferred Evidence | Red Flags |
|---------------|------------------|-------------------|-----------|
| **Image Authenticity** | Metadata analysis + reverse image search | Forensic analysis + provenance chain | Stripped metadata, known manipulation tools |
| **Document Authenticity** | Source verification + consistency check | Official attestation + forensic analysis | Inconsistent formatting, anachronisms |
| **Video Authenticity** | Metadata + visual analysis | Forensic analysis + chain of custody | Editing artifacts, deepfake indicators |
| **Quote Authenticity** | Primary source (recording/document) | Multiple recordings + transcripts | No primary source, contextual changes |

### 3.3 Confidence Level Thresholds

Different claims require different confidence thresholds before being considered established:

```
┌─────────────────────────────────────────────────────────────────────┐
│              CONFIDENCE THRESHOLD REQUIREMENTS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Claim Type                    Minimum    Moderate    High          │
│  ─────────────────────────────────────────────────────────────      │
│  Historical Fact               0.60       0.75        0.90          │
│  Current Fact                  0.65       0.80        0.92          │
│  Scientific Fact               0.70       0.85        0.95          │
│  Statistical Fact              0.65       0.80        0.92          │
│  Attribution                   0.75       0.88        0.95          │
│                                                                     │
│  Direct Causation              0.80       0.90        0.97          │
│  Contributing Factor           0.65       0.80        0.92          │
│  Correlation Claim             0.60       0.75        0.88          │
│  Mechanism Claim               0.70       0.85        0.95          │
│                                                                     │
│  Quality Assessment            0.55       0.70        0.85          │
│  Accuracy Assessment           0.70       0.85        0.95          │
│  Bias Assessment               0.60       0.75        0.88          │
│  Credibility Assessment        0.60       0.75        0.88          │
│                                                                     │
│  Future Event                  0.50       0.65        0.80          │
│  Trend Projection              0.55       0.70        0.85          │
│  Conditional Prediction        0.50       0.65        0.80          │
│                                                                     │
│  Person Identity               0.80       0.90        0.98          │
│  Organization Identity         0.75       0.88        0.95          │
│  Content Authorship            0.70       0.85        0.95          │
│  Affiliation                   0.70       0.85        0.95          │
│                                                                     │
│  Image Authenticity            0.75       0.88        0.95          │
│  Document Authenticity         0.80       0.92        0.98          │
│  Video Authenticity            0.75       0.88        0.95          │
│  Quote Authenticity            0.85       0.92        0.98          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 Red Flags and Disqualifying Factors

#### 3.4.1 Evidence Red Flags

| Red Flag | Impact | Description |
|----------|--------|-------------|
| `single-source` | -0.20 | Only one source for significant claim |
| `anonymous-source` | -0.15 | Source cannot be verified |
| `conflict-of-interest` | -0.25 | Source has financial/personal stake |
| `outdated` | -0.10 to -0.40 | Evidence significantly out of date |
| `methodology-undisclosed` | -0.20 | No methodology explanation |
| `selective-citation` | -0.25 | Cherry-picking from larger context |
| `circular-reference` | -0.30 | Sources cite each other |
| `retracted` | -0.80 | Source has been retracted |
| `corrected` | -0.15 | Source has issued corrections |
| `known-fabricator` | -0.90 | Source has history of fabrication |

#### 3.4.2 Disqualifying Factors

Evidence is disqualified entirely if:

```python
DISQUALIFYING_CONDITIONS = [
    'evidence_is_retracted',           # Formally retracted publication
    'source_is_confirmed_fabrication', # Known fake document/data
    'evidence_is_forged',              # Proven forgery
    'metadata_proves_manipulation',    # Digital forensics shows tampering
    'evidence_contradicts_itself',     # Internal inconsistency
    'source_is_satire_or_fiction',     # Satire presented as fact
    'evidence_is_ai_generated_fake',   # AI-generated fake content
]

def should_disqualify_evidence(evidence: Evidence) -> tuple[bool, str]:
    """Check if evidence should be entirely disqualified."""
    
    for condition in DISQUALIFYING_CONDITIONS:
        if check_condition(evidence, condition):
            return True, condition
    
    return False, None
```

### 3.5 Minimum Evidence Requirements

```python
class MinimumEvidenceRequirements:
    """Minimum evidence requirements for different claim confidence levels."""
    
    REQUIREMENTS = {
        'factual_historical': {
            'minimum': {'sources': 2, 'types': ['secondary'], 'quality': 0.50},
            'moderate': {'sources': 3, 'types': ['secondary', 'primary'], 'quality': 0.65},
            'high': {'sources': 4, 'types': ['primary'], 'quality': 0.80}
        },
        'factual_current': {
            'minimum': {'sources': 1, 'types': ['primary'], 'quality': 0.60},
            'moderate': {'sources': 2, 'types': ['primary', 'secondary'], 'quality': 0.70},
            'high': {'sources': 3, 'types': ['primary'], 'quality': 0.85}
        },
        'factual_scientific': {
            'minimum': {'sources': 1, 'types': ['journal-article'], 'quality': 0.70},
            'moderate': {'sources': 2, 'types': ['journal-article'], 'quality': 0.80},
            'high': {'sources': 3, 'types': ['systematic-review', 'meta-analysis'], 'quality': 0.90}
        },
        'causal_direct': {
            'minimum': {'sources': 1, 'types': ['randomized-trial'], 'quality': 0.75},
            'moderate': {'sources': 2, 'types': ['randomized-trial'], 'quality': 0.85},
            'high': {'sources': 3, 'types': ['systematic-review'], 'quality': 0.92}
        },
        'identity_person': {
            'minimum': {'sources': 1, 'types': ['self-attestation', 'official-document'], 'quality': 0.70},
            'moderate': {'sources': 2, 'types': ['primary'], 'quality': 0.85},
            'high': {'sources': 3, 'types': ['official-document', 'cryptographic'], 'quality': 0.95}
        },
        'authenticity_image': {
            'minimum': {'sources': 1, 'types': ['forensic-analysis'], 'quality': 0.70},
            'moderate': {'sources': 2, 'types': ['forensic-analysis', 'provenance'], 'quality': 0.82},
            'high': {'sources': 3, 'types': ['forensic-analysis', 'chain-of-custody'], 'quality': 0.92}
        }
    }
    
    @classmethod
    def check_requirements(
        cls,
        claim_type: str,
        evidence_list: list[Evidence],
        target_confidence: str
    ) -> RequirementCheck:
        """Check if evidence meets requirements for confidence level."""
        
        requirements = cls.REQUIREMENTS.get(claim_type, {}).get(target_confidence)
        if not requirements:
            return RequirementCheck(met=False, reason='unknown_claim_type')
        
        # Check source count
        if len(evidence_list) < requirements['sources']:
            return RequirementCheck(
                met=False,
                reason='insufficient_sources',
                required=requirements['sources'],
                actual=len(evidence_list)
            )
        
        # Check evidence types
        evidence_types = [e.type for e in evidence_list]
        required_types = requirements['types']
        if not any(t in evidence_types for t in required_types):
            return RequirementCheck(
                met=False,
                reason='missing_required_type',
                required=required_types,
                actual=evidence_types
            )
        
        # Check quality threshold
        qualities = [calculate_evidence_quality(e) for e in evidence_list]
        avg_quality = sum(qualities) / len(qualities)
        if avg_quality < requirements['quality']:
            return RequirementCheck(
                met=False,
                reason='insufficient_quality',
                required=requirements['quality'],
                actual=avg_quality
            )
        
        return RequirementCheck(met=True)
```

---

## 4. Evidence Archival and Preservation

### 4.1 Link Rot Prevention Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHIVAL STRATEGY OVERVIEW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LEVEL 1: URL Snapshot                                              │
│  ├── Capture HTML content at time of citation                       │
│  ├── Store on multiple archive services                             │
│  └── Record capture timestamp                                       │
│                                                                     │
│  LEVEL 2: Content Hash                                              │
│  ├── SHA-256 hash of content at citation time                       │
│  ├── Enables verification of unchanged content                      │
│  └── Stored in evidence event                                       │
│                                                                     │
│  LEVEL 3: Decentralized Storage                                     │
│  ├── IPFS for content-addressed storage                             │
│  ├── Arweave for permanent storage                                  │
│  └── Multiple relay redundancy                                      │
│                                                                     │
│  LEVEL 4: Cryptographic Proof                                       │
│  ├── OpenTimestamps for proof of existence                          │
│  ├── Bitcoin anchoring for immutability                             │
│  └── Signed attestations                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Archive Service Integration

#### 4.2.1 Archive.org (Wayback Machine)

```python
class WaybackArchiver:
    """Integration with Internet Archive Wayback Machine."""
    
    BASE_URL = "https://web.archive.org"
    SAVE_URL = "https://web.archive.org/save/"
    
    async def archive_url(self, url: str) -> ArchiveResult:
        """Request URL archival on Wayback Machine."""
        
        # Request archival
        response = await self.http_client.get(
            f"{self.SAVE_URL}{url}",
            follow_redirects=True
        )
        
        if response.status_code == 200:
            # Extract archive URL from response
            archive_url = self.extract_archive_url(response)
            
            return ArchiveResult(
                success=True,
                service='wayback',
                original_url=url,
                archive_url=archive_url,
                timestamp=int(time.time()),
                expiration=None  # Wayback is permanent
            )
        
        return ArchiveResult(success=False, error=response.text)
    
    async def find_archives(self, url: str) -> list[ArchiveSnapshot]:
        """Find existing archives of a URL."""
        
        cdx_url = f"{self.BASE_URL}/cdx/search/cdx"
        params = {
            'url': url,
            'output': 'json',
            'fl': 'timestamp,original,mimetype,statuscode,digest'
        }
        
        response = await self.http_client.get(cdx_url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            return [self.parse_cdx_entry(entry) for entry in data[1:]]
        
        return []
    
    def construct_archive_url(self, url: str, timestamp: str) -> str:
        """Construct Wayback URL for specific timestamp."""
        return f"{self.BASE_URL}/web/{timestamp}/{url}"
```

#### 4.2.2 IPFS Integration

```python
class IPFSArchiver:
    """Integration with IPFS for content-addressed storage."""
    
    def __init__(self, ipfs_gateway: str, pinning_service: str = None):
        self.gateway = ipfs_gateway
        self.pinning_service = pinning_service
    
    async def archive_content(
        self,
        content: bytes,
        metadata: dict
    ) -> IPFSArchiveResult:
        """Archive content to IPFS with metadata."""
        
        # Create IPFS object with content and metadata
        ipfs_object = {
            'content': base64.b64encode(content).decode(),
            'metadata': metadata,
            'timestamp': int(time.time())
        }
        
        # Add to IPFS
        cid = await self.ipfs_add(json.dumps(ipfs_object))
        
        # Pin to ensure persistence
        if self.pinning_service:
            await self.pin_content(cid)
        
        return IPFSArchiveResult(
            success=True,
            cid=cid,
            gateway_url=f"{self.gateway}/ipfs/{cid}",
            content_hash=hashlib.sha256(content).hexdigest(),
            size=len(content),
            timestamp=int(time.time())
        )
    
    async def archive_url(self, url: str) -> IPFSArchiveResult:
        """Fetch and archive URL content to IPFS."""
        
        # Fetch content
        response = await self.http_client.get(url)
        content = response.content
        
        metadata = {
            'original_url': url,
            'content_type': response.headers.get('content-type'),
            'fetched_at': int(time.time()),
            'original_headers': dict(response.headers)
        }
        
        return await self.archive_content(content, metadata)
    
    async def verify_content(
        self,
        cid: str,
        expected_hash: str
    ) -> VerificationResult:
        """Verify IPFS content matches expected hash."""
        
        content = await self.ipfs_cat(cid)
        actual_hash = hashlib.sha256(content).hexdigest()
        
        return VerificationResult(
            verified=actual_hash == expected_hash,
            expected_hash=expected_hash,
            actual_hash=actual_hash,
            cid=cid
        )
```

#### 4.2.3 Arweave Integration

```python
class ArweaveArchiver:
    """Integration with Arweave for permanent storage."""
    
    def __init__(self, wallet_path: str, gateway: str = "https://arweave.net"):
        self.wallet = self.load_wallet(wallet_path)
        self.gateway = gateway
    
    async def archive_content(
        self,
        content: bytes,
        tags: dict
    ) -> ArweaveArchiveResult:
        """Archive content permanently on Arweave."""
        
        # Create transaction
        tx = await self.create_transaction(content)
        
        # Add tags for indexing
        required_tags = {
            'Content-Type': tags.get('content_type', 'application/octet-stream'),
            'App-Name': 'nostr-evidence-archive',
            'App-Version': '1.0',
            'Archive-Timestamp': str(int(time.time()))
        }
        required_tags.update(tags)
        
        for key, value in required_tags.items():
            tx.add_tag(key, value)
        
        # Sign and submit
        await tx.sign(self.wallet)
        await tx.submit()
        
        return ArweaveArchiveResult(
            success=True,
            transaction_id=tx.id,
            gateway_url=f"{self.gateway}/{tx.id}",
            content_hash=hashlib.sha256(content).hexdigest(),
            cost=tx.reward,
            status='pending'
        )
    
    async def verify_archived(self, tx_id: str) -> VerificationResult:
        """Verify content is archived and confirmed."""
        
        status = await self.get_transaction_status(tx_id)
        
        if status['confirmed']:
            content = await self.get_transaction_data(tx_id)
            content_hash = hashlib.sha256(content).hexdigest()
            
            return VerificationResult(
                verified=True,
                transaction_id=tx_id,
                block_height=status['block_height'],
                confirmations=status['confirmations'],
                content_hash=content_hash
            )
        
        return VerificationResult(
            verified=False,
            reason='not_confirmed',
            status=status
        )
```

### 4.3 Cryptographic Proof of Existence

#### 4.3.1 OpenTimestamps Integration

```python
class OpenTimestampsProof:
    """Generate and verify OpenTimestamps proofs."""
    
    async def create_timestamp(
        self,
        content_hash: str
    ) -> TimestampResult:
        """Create an OpenTimestamps proof for content hash."""
        
        # Convert hash to bytes
        hash_bytes = bytes.fromhex(content_hash)
        
        # Create timestamp
        timestamp = opentimestamps.Timestamp(hash_bytes)
        
        # Submit to calendar servers
        await opentimestamps.stamp(timestamp)
        
        # Serialize proof
        proof_bytes = timestamp.serialize()
        
        return TimestampResult(
            success=True,
            content_hash=content_hash,
            proof=base64.b64encode(proof_bytes).decode(),
            status='pending',  # Will be upgraded when Bitcoin confirms
            timestamp=int(time.time())
        )
    
    async def verify_timestamp(
        self,
        content_hash: str,
        proof: str
    ) -> VerificationResult:
        """Verify an OpenTimestamps proof."""
        
        # Deserialize proof
        proof_bytes = base64.b64decode(proof)
        timestamp = opentimestamps.Timestamp.deserialize(proof_bytes)
        
        # Verify hash matches
        if timestamp.msg != bytes.fromhex(content_hash):
            return VerificationResult(
                verified=False,
                reason='hash_mismatch'
            )
        
        # Verify timestamp
        try:
            attestations = await opentimestamps.verify(timestamp)
            
            bitcoin_attestations = [
                a for a in attestations 
                if isinstance(a, opentimestamps.BitcoinBlockHeaderAttestation)
            ]
            
            if bitcoin_attestations:
                earliest = min(a.height for a in bitcoin_attestations)
                block_time = await self.get_block_time(earliest)
                
                return VerificationResult(
                    verified=True,
                    attestation_type='bitcoin',
                    block_height=earliest,
                    timestamp=block_time,
                    confirmations=self.current_height - earliest
                )
            
            return VerificationResult(
                verified=True,
                attestation_type='calendar',
                status='pending_bitcoin_confirmation'
            )
            
        except Exception as e:
            return VerificationResult(
                verified=False,
                reason=str(e)
            )
```

### 4.4 Screenshot Verification

```python
class ScreenshotVerification:
    """Capture and verify screenshots as evidence."""
    
    async def capture_screenshot(
        self,
        url: str,
        options: ScreenshotOptions = None
    ) -> ScreenshotResult:
        """Capture a verified screenshot of a URL."""
        
        options = options or ScreenshotOptions()
        
        # Launch browser
        browser = await self.launch_browser()
        page = await browser.new_page()
        
        # Set viewport
        await page.set_viewport_size(
            width=options.width,
            height=options.height
        )
        
        # Navigate and wait for load
        await page.goto(url, wait_until='networkidle')
        
        # Capture metadata before screenshot
        metadata = {
            'url': url,
            'final_url': page.url,
            'title': await page.title(),
            'timestamp': int(time.time()),
            'viewport': {'width': options.width, 'height': options.height},
            'user_agent': await page.evaluate('navigator.userAgent'),
            'cookies': await page.context.cookies(),
            'headers': await self.get_response_headers(page)
        }
        
        # Capture screenshot
        screenshot_bytes = await page.screenshot(
            full_page=options.full_page,
            type='png'
        )
        
        # Capture HTML
        html_content = await page.content()
        
        await browser.close()
        
        # Calculate hashes
        screenshot_hash = hashlib.sha256(screenshot_bytes).hexdigest()
        html_hash = hashlib.sha256(html_content.encode()).hexdigest()
        
        # Create signed attestation
        attestation = self.create_attestation(
            screenshot_hash=screenshot_hash,
            html_hash=html_hash,
            metadata=metadata
        )
        
        return ScreenshotResult(
            success=True,
            screenshot=screenshot_bytes,
            screenshot_hash=screenshot_hash,
            html_content=html_content,
            html_hash=html_hash,
            metadata=metadata,
            attestation=attestation
        )
    
    def create_attestation(
        self,
        screenshot_hash: str,
        html_hash: str,
        metadata: dict
    ) -> Attestation:
        """Create a signed attestation for the screenshot."""
        
        attestation_data = {
            'type': 'screenshot_attestation',
            'version': '1.0',
            'screenshot_hash': screenshot_hash,
            'html_hash': html_hash,
            'url': metadata['url'],
            'timestamp': metadata['timestamp'],
            'attestor': self.attestor_pubkey
        }
        
        # Sign with attestor's NOSTR key
        signature = self.sign_attestation(attestation_data)
        attestation_data['signature'] = signature
        
        return Attestation(**attestation_data)
```

### 4.5 Archive Record Schema

```json
{
  "archive_record": {
    "original_url": "<url>",
    "content_hash": "<sha256>",
    "archived_at": "<unix-timestamp>",
    "archives": [
      {
        "service": "wayback",
        "url": "<archive-url>",
        "timestamp": "<capture-timestamp>"
      },
      {
        "service": "ipfs",
        "cid": "<content-id>",
        "gateway_url": "<gateway-url>"
      },
      {
        "service": "arweave",
        "transaction_id": "<tx-id>",
        "block_height": "<block>"
      }
    ],
    "timestamp_proof": {
      "type": "opentimestamps",
      "proof": "<base64-proof>",
      "bitcoin_block": "<block-height>"
    },
    "screenshot": {
      "hash": "<sha256>",
      "ipfs_cid": "<cid>",
      "attestation": "<attestation-signature>"
    }
  }
}
```

---

## 5. Chain of Custody

### 5.1 Evidence Provenance Tracking

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHAIN OF CUSTODY MODEL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ORIGIN                                                             │
│  ├── Original source URL/location                                   │
│  ├── Creation timestamp                                             │
│  ├── Creator/author identification                                  │
│  └── Original context                                               │
│                                                                     │
│  ACQUISITION                                                        │
│  ├── Who acquired the evidence                                      │
│  ├── When it was acquired                                           │
│  ├── How it was acquired (method)                                   │
│  └── Chain from origin to acquisition                               │
│                                                                     │
│  CUSTODY TRANSFERS                                                  │
│  ├── Each handler in the chain                                      │
│  ├── Transfer timestamps                                            │
│  ├── Transfer verification (signatures)                             │
│  └── Handling notes                                                 │
│                                                                     │
│  VERIFICATION EVENTS                                                │
│  ├── Independent verifications                                      │
│  ├── Verification methodology                                       │
│  ├── Verifier credentials                                           │
│  └── Verification outcomes                                          │
│                                                                     │
│  INTEGRITY CHECKS                                                   │
│  ├── Hash verifications over time                                   │
│  ├── Tamper detection                                               │
│  ├── Archive comparisons                                            │
│  └── Anomaly flags                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Chain of Custody Data Model

```python
@dataclass
class EvidenceOrigin:
    """Origin information for evidence."""
    source_url: str
    source_type: str  # website, document, api, etc.
    creation_timestamp: int
    creator: Optional[str]  # If known
    original_context: str
    acquisition_method: str  # screenshot, api, download, etc.
    hash_at_origin: str

@dataclass  
class CustodyTransfer:
    """Record of evidence custody transfer."""
    from_pubkey: str
    to_pubkey: str
    timestamp: int
    transfer_method: str
    hash_at_transfer: str
    notes: Optional[str]
    signature: str  # Signed by from_pubkey

@dataclass
class VerificationEvent:
    """Record of evidence verification."""
    verifier_pubkey: str
    verification_type: str
    methodology: str
    timestamp: int
    outcome: str  # verified, failed, inconclusive
    findings: str
    hash_verified: str
    signature: str

@dataclass
class ChainOfCustody:
    """Complete chain of custody for evidence."""
    evidence_id: str
    origin: EvidenceOrigin
    transfers: list[CustodyTransfer]
    verifications: list[VerificationEvent]
    current_holder: str
    current_hash: str
    integrity_status: str  # intact, compromised, unknown
    
    def verify_chain(self) -> ChainVerification:
        """Verify the integrity of the custody chain."""
        
        # Verify all signatures
        for transfer in self.transfers:
            if not verify_signature(transfer.from_pubkey, transfer):
                return ChainVerification(
                    valid=False,
                    reason='invalid_transfer_signature',
                    failed_at=transfer
                )
        
        # Verify hash continuity
        expected_hash = self.origin.hash_at_origin
        for transfer in self.transfers:
            if transfer.hash_at_transfer != expected_hash:
                return ChainVerification(
                    valid=False,
                    reason='hash_mismatch',
                    expected=expected_hash,
                    actual=transfer.hash_at_transfer,
                    failed_at=transfer
                )
            # Hash might legitimately change if evidence was processed
            expected_hash = transfer.hash_at_transfer
        
        if self.current_hash != expected_hash:
            return ChainVerification(
                valid=False,
                reason='current_hash_mismatch',
                expected=expected_hash,
                actual=self.current_hash
            )
        
        return ChainVerification(valid=True)
```

### 5.3 Tamper Detection

```python
class TamperDetection:
    """Detect potential evidence tampering."""
    
    TAMPER_INDICATORS = [
        'hash_changed_unexpectedly',
        'missing_custody_link',
        'signature_invalid',
        'timestamp_anomaly',
        'metadata_inconsistency',
        'archive_mismatch',
        'forensic_indicators'
    ]
    
    async def check_evidence_integrity(
        self,
        evidence: Evidence,
        chain: ChainOfCustody
    ) -> IntegrityReport:
        """Comprehensive integrity check for evidence."""
        
        findings = []
        
        # 1. Verify chain of custody
        chain_result = chain.verify_chain()
        if not chain_result.valid:
            findings.append(TamperFinding(
                indicator='chain_of_custody_broken',
                severity='high',
                details=chain_result
            ))
        
        # 2. Compare against archives
        archive_check = await self.compare_archives(evidence)
        if not archive_check.consistent:
            findings.append(TamperFinding(
                indicator='archive_mismatch',
                severity='high',
                details=archive_check
            ))
        
        # 3. Check timestamp consistency
        timestamp_check = self.verify_timestamps(evidence, chain)
        if not timestamp_check.valid:
            findings.append(TamperFinding(
                indicator='timestamp_anomaly',
                severity='medium',
                details=timestamp_check
            ))
        
        # 4. Metadata consistency
        metadata_check = self.verify_metadata_consistency(evidence)
        if not metadata_check.consistent:
            findings.append(TamperFinding(
                indicator='metadata_inconsistency',
                severity='medium',
                details=metadata_check
            ))
        
        # 5. Forensic analysis (for images/documents)
        if evidence.type in ['image', 'document', 'video']:
            forensic_check = await self.forensic_analysis(evidence)
            if forensic_check.tampering_detected:
                findings.append(TamperFinding(
                    indicator='forensic_indicators',
                    severity='high',
                    details=forensic_check
                ))
        
        # Calculate overall integrity score
        integrity_score = self.calculate_integrity_score(findings)
        
        return IntegrityReport(
            evidence_id=evidence.id,
            integrity_score=integrity_score,
            status='intact' if integrity_score > 0.9 else 'suspect' if integrity_score > 0.5 else 'compromised',
            findings=findings,
            checked_at=int(time.time())
        )
    
    async def compare_archives(
        self,
        evidence: Evidence
    ) -> ArchiveComparison:
        """Compare evidence against archived versions."""
        
        archives = await self.fetch_all_archives(evidence.source_url)
        
        comparisons = []
        for archive in archives:
            archived_hash = await self.get_archive_hash(archive)
            comparison = {
                'archive': archive.service,
                'timestamp': archive.timestamp,
                'hash': archived_hash,
                'matches': archived_hash == evidence.content_hash
            }
            comparisons.append(comparison)
        
        # Check consistency
        hashes = [c['hash'] for c in comparisons if c['hash']]
        consistent = len(set(hashes)) <= 1
        
        return ArchiveComparison(
            consistent=consistent,
            comparisons=comparisons,
            evidence_hash=evidence.content_hash
        )
```

### 5.4 Version Control for Claims/Evidence

```python
class EvidenceVersionControl:
    """Track versions and changes to evidence and claims."""
    
    async def create_version(
        self,
        evidence: Evidence,
        change_type: str,
        change_details: dict,
        author: str
    ) -> EvidenceVersion:
        """Create a new version record for evidence."""
        
        # Get current version
        current = await self.get_current_version(evidence.id)
        new_version_number = current.version + 1 if current else 1
        
        # Calculate diff
        diff = self.calculate_diff(current, evidence) if current else None
        
        # Create version record
        version = EvidenceVersion(
            evidence_id=evidence.id,
            version=new_version_number,
            content_hash=evidence.content_hash,
            change_type=change_type,  # created, modified, superseded, retracted
            change_details=change_details,
            diff=diff,
            author=author,
            timestamp=int(time.time()),
            previous_version=current.version if current else None,
            signature=self.sign_version(evidence, author)
        )
        
        await self.store_version(version)
        return version
    
    async def get_version_history(
        self,
        evidence_id: str
    ) -> list[EvidenceVersion]:
        """Get complete version history for evidence."""
        
        versions = await self.db.query(
            "SELECT * FROM evidence_versions WHERE evidence_id = ? ORDER BY version",
            [evidence_id]
        )
        
        return [EvidenceVersion(**v) for v in versions]
    
    async def verify_version_chain(
        self,
        evidence_id: str
    ) -> VersionChainVerification:
        """Verify integrity of version chain."""
        
        history = await self.get_version_history(evidence_id)
        
        for i, version in enumerate(history):
            # Verify signature
            if not self.verify_version_signature(version):
                return VersionChainVerification(
                    valid=False,
                    reason='invalid_signature',
                    version=version.version
                )
            
            # Verify chain linkage
            if i > 0:
                if version.previous_version != history[i-1].version:
                    return VersionChainVerification(
                        valid=False,
                        reason='broken_chain',
                        version=version.version
                    )
        
        return VersionChainVerification(valid=True, versions=len(history))
```

---

## 6. Burden of Proof Standards

### 6.1 Burden of Proof Levels

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BURDEN OF PROOF LEVELS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LEVEL 1: PREPONDERANCE OF EVIDENCE (>50%)                          │
│  ├── "More likely than not"                                         │
│  ├── Standard for: opinions, minor factual disputes                 │
│  └── Evidence Score Required: ≥0.51                                 │
│                                                                     │
│  LEVEL 2: CLEAR AND CONVINCING (>75%)                               │
│  ├── "Highly probable"                                              │
│  ├── Standard for: most factual claims, ratings                     │
│  └── Evidence Score Required: ≥0.75                                 │
│                                                                     │
│  LEVEL 3: BEYOND REASONABLE DOUBT (>95%)                            │
│  ├── "Near certainty"                                               │
│  ├── Standard for: fraud allegations, identity claims               │
│  └── Evidence Score Required: ≥0.95                                 │
│                                                                     │
│  LEVEL 4: SCIENTIFIC CERTAINTY (>99%)                               │
│  ├── "Established scientific fact"                                  │
│  ├── Standard for: scientific consensus claims                      │
│  └── Evidence Score Required: ≥0.99                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Claim Type → Burden of Proof Mapping

| Claim Category | Claim Type | Required Burden | Rationale |
|----------------|-----------|-----------------|-----------|
| **Factual** | Historical Fact | Clear and Convincing | Well-documented historical record |
| **Factual** | Current Fact | Clear and Convincing | Verifiable with current sources |
| **Factual** | Scientific Fact | Scientific Certainty | Requires peer-reviewed consensus |
| **Factual** | Statistical Fact | Clear and Convincing | Must show methodology |
| **Factual** | Attribution | Beyond Reasonable Doubt | Direct evidence of statement |
| **Causal** | Direct Causation | Beyond Reasonable Doubt | Requires strong experimental evidence |
| **Causal** | Contributing Factor | Clear and Convincing | Observational evidence acceptable |
| **Causal** | Correlation | Preponderance | Statistical relationship only |
| **Evaluative** | Quality Assessment | Preponderance | Inherently subjective |
| **Evaluative** | Accuracy Assessment | Clear and Convincing | Must be verifiable |
| **Evaluative** | Bias Assessment | Clear and Convincing | Requires pattern evidence |
| **Predictive** | Future Event | Preponderance | Inherently uncertain |
| **Identity** | Person Identity | Beyond Reasonable Doubt | Privacy/safety concerns |
| **Identity** | Affiliation | Clear and Convincing | Employment records available |
| **Authenticity** | Image Authenticity | Clear and Convincing | Forensic analysis possible |
| **Authenticity** | Quote Authenticity | Beyond Reasonable Doubt | Primary source required |

### 6.3 Burden Shifting Rules

In disputes, the burden of proof can shift based on circumstances:

```python
class BurdenShifting:
    """Rules for when burden of proof shifts between parties."""
    
    SHIFTING_TRIGGERS = {
        # Trigger → (new_burden_holder, new_burden_level, rationale)
        'prima_facie_case': (
            'respondent',
            'clear_and_convincing',
            'Initial evidence threshold met'
        ),
        'default_presumption': (
            'challenger',
            'clear_and_convincing',
            'Challenging established default'
        ),
        'extraordinary_claim': (
            'claimant',
            'beyond_reasonable_doubt',
            'Extraordinary claims require extraordinary evidence'
        ),
        'negative_claim': (
            'positive_claimant',
            'preponderance',
            'Cannot prove a negative'
        ),
        'expert_consensus': (
            'challenger',
            'scientific_certainty',
            'Challenging established expert consensus'
        ),
        'official_record': (
            'challenger',
            'clear_and_convincing',
            'Official records presumed accurate'
        )
    }
    
    def determine_burden(
        self,
        claim: Claim,
        context: DisputeContext
    ) -> BurdenAssignment:
        """Determine who bears burden of proof and at what level."""
        
        # Start with default based on claim type
        default_burden = self.get_default_burden(claim.type)
        current_holder = 'claimant'
        current_level = default_burden.level
        
        shifting_events = []
        
        # Check for shifting triggers
        if context.has_prima_facie_evidence:
            shift = self.SHIFTING_TRIGGERS['prima_facie_case']
            current_holder = shift[0]
            current_level = shift[1]
            shifting_events.append(('prima_facie_case', shift[2]))
        
        if claim.challenges_official_record:
            shift = self.SHIFTING_TRIGGERS['official_record']
            current_holder = shift[0]
            current_level = shift[1]
            shifting_events.append(('official_record', shift[2]))
        
        if claim.is_extraordinary:
            shift = self.SHIFTING_TRIGGERS['extraordinary_claim']
            # Only shift if not already higher
            if self.burden_level_value(shift[1]) > self.burden_level_value(current_level):
                current_level = shift[1]
                shifting_events.append(('extraordinary_claim', shift[2]))
        
        if claim.challenges_expert_consensus:
            shift = self.SHIFTING_TRIGGERS['expert_consensus']
            current_holder = shift[0]
            current_level = shift[1]
            shifting_events.append(('expert_consensus', shift[2]))
        
        return BurdenAssignment(
            holder=current_holder,
            level=current_level,
            shifting_events=shifting_events,
            required_score=self.level_to_score(current_level)
        )
    
    def level_to_score(self, level: str) -> float:
        """Convert burden level to required evidence score."""
        return {
            'preponderance': 0.51,
            'clear_and_convincing': 0.75,
            'beyond_reasonable_doubt': 0.95,
            'scientific_certainty': 0.99
        }.get(level, 0.51)
```

### 6.4 Affirmative Defenses

```python
class AffirmativeDefenses:
    """Standard affirmative defenses that can rebut claims."""
    
    DEFENSES = {
        'satire': {
            'description': 'Content is clearly satire or parody',
            'evidence_required': ['clear_satire_indicators', 'publication_context'],
            'burden': 'preponderance'
        },
        'opinion': {
            'description': 'Statement is opinion, not fact claim',
            'evidence_required': ['opinion_language_markers', 'context'],
            'burden': 'preponderance'
        },
        'substantial_truth': {
            'description': 'Claim is substantially true despite minor errors',
            'evidence_required': ['truth_of_core_claim', 'immateriality_of_errors'],
            'burden': 'clear_and_convincing'
        },
        'fair_report': {
            'description': 'Fair and accurate report of official proceeding',
            'evidence_required': ['official_proceeding', 'accuracy_of_report'],
            'burden': 'preponderance'
        },
        'wire_service': {
            'description': 'Reliance on reputable wire service',
            'evidence_required': ['wire_service_source', 'no_reason_to_doubt'],
            'burden': 'preponderance'
        },
        'retraction': {
            'description': 'Timely and adequate retraction issued',
            'evidence_required': ['retraction_timing', 'retraction_prominence'],
            'burden': 'preponderance'
        },
        'public_figure': {
            'description': 'Target is public figure (higher bar for defamation)',
            'evidence_required': ['public_figure_status', 'public_controversy'],
            'burden': 'preponderance'
        },
        'context_changed': {
            'description': 'Facts have changed since original claim',
            'evidence_required': ['original_truth', 'subsequent_change'],
            'burden': 'clear_and_convincing'
        }
    }
    
    def evaluate_defense(
        self,
        defense_type: str,
        evidence: list[Evidence]
    ) -> DefenseEvaluation:
        """Evaluate whether an affirmative defense succeeds."""
        
        defense = self.DEFENSES.get(defense_type)
        if not defense:
            return DefenseEvaluation(valid=False, reason='unknown_defense')
        
        # Check required evidence elements
        required = defense['evidence_required']
        provided = {e.addresses for e in evidence}
        
        missing = set(required) - provided
        if missing:
            return DefenseEvaluation(
                valid=False,
                reason='missing_required_evidence',
                missing=list(missing)
            )
        
        # Check evidence meets burden
        burden_score = self.calculate_burden_score(defense['burden'])
        evidence_score = aggregate_evidence_quality(evidence)
        
        if evidence_score < burden_score:
            return DefenseEvaluation(
                valid=False,
                reason='insufficient_evidence_quality',
                required=burden_score,
                actual=evidence_score
            )
        
        return DefenseEvaluation(
            valid=True,
            defense_type=defense_type,
            evidence_score=evidence_score
        )
```

---

## 7. NOSTR Event Schemas for Evidence

### 7.1 Structured Evidence Event (Kind: 32140)

**Type:** Parameterized Replaceable Event  
**Purpose:** Attach structured evidence to support claims

```json
{
  "kind": 32140,
  "pubkey": "<submitter-pubkey>",
  "created_at": "<unix-timestamp>",
  "tags": [
    ["d", "<evidence-id>"],
    ["claim-event", "<event-id>", "<event-kind>", "<relay-hint>"],
    ["claim-hash", "<hash-of-specific-claim>"],
    
    ["evidence-type", "<tier/category/subtype>"],
    ["evidence-url", "<source-url>"],
    ["evidence-url-hash", "<sha256-of-url>"],
    ["evidence-title", "<title-of-source>"],
    ["evidence-author", "<author-name>", "<author-url>"],
    ["evidence-date", "<publication-date>"],
    ["evidence-publisher", "<publisher-name>"],
    
    ["quality-score", "<0.0-1.0>"],
    ["quality-verifiability", "<0.0-1.0>"],
    ["quality-independence", "<0.0-1.0>"],
    ["quality-reliability", "<0.0-1.0>"],
    ["quality-relevance", "<0.0-1.0>"],
    ["quality-recency", "<0.0-1.0>"],
    ["quality-methodology", "<0.0-1.0>"],
    
    ["archive", "<service>", "<archive-url>", "<archive-timestamp>"],
    ["content-hash", "<sha256-of-content>"],
    ["ipfs-cid", "<content-id>"],
    ["arweave-tx", "<transaction-id>"],
    
    ["quote", "<relevant-quote>"],
    ["quote-location", "<page-number-or-timestamp>"],
    
    ["relationship", "<supports|contradicts|context|partial>"],
    ["confidence", "<0-100>"],
    ["methodology", "<verification-method>"]
  ],
  "content": "<explanation-of-how-evidence-supports-claim>",
  "sig": "<signature>"
}
```

#### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Unique evidence identifier |
| `claim-event` | Yes | No | Event containing the claim this evidence supports |
| `claim-hash` | No | No | Hash of specific claim text if multiple claims |
| `evidence-type` | Yes | No | Type from taxonomy (tier/category/subtype) |
| `evidence-url` | Yes | No | URL of the evidence source |
| `evidence-url-hash` | Yes | No | SHA-256 of normalized URL |
| `evidence-title` | No | No | Title of the evidence source |
| `evidence-author` | No | Yes | [author-name, author-url] |
| `evidence-date` | Yes | No | Publication date of evidence |
| `evidence-publisher` | No | No | Publisher name |
| `quality-score` | No | No | Overall quality score [0, 1] |
| `quality-*` | No | No | Individual dimension scores |
| `archive` | No | Yes | [service, url, timestamp] archive records |
| `content-hash` | Yes | No | SHA-256 of evidence content |
| `ipfs-cid` | No | No | IPFS content identifier |
| `arweave-tx` | No | No | Arweave transaction ID |
| `quote` | No | Yes | Relevant quote from evidence |
| `quote-location` | No | Yes | Page/timestamp of quote |
| `relationship` | Yes | No | How evidence relates to claim |
| `confidence` | No | No | Submitter's confidence [0-100] |
| `methodology` | No | No | How evidence was verified |

#### Example: Research Paper Evidence

```json
{
  "kind": 32140,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "ev-climate-study-2024-001"],
    ["claim-event", "abc123def456", "32127", "wss://relay.example.com"],
    ["claim-hash", "sha256:abcd1234..."],
    
    ["evidence-type", "secondary/research/journal-article"],
    ["evidence-url", "https://doi.org/10.1234/nature.2024.12345"],
    ["evidence-url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["evidence-title", "Global Temperature Trends 2000-2024: A Comprehensive Analysis"],
    ["evidence-author", "Dr. Jane Smith", "https://orcid.org/0000-0001-2345-6789"],
    ["evidence-author", "Dr. John Doe", "https://orcid.org/0000-0002-3456-7890"],
    ["evidence-date", "2024-10-15"],
    ["evidence-publisher", "Nature Climate Change"],
    
    ["quality-score", "0.92"],
    ["quality-verifiability", "0.95"],
    ["quality-independence", "0.90"],
    ["quality-reliability", "0.95"],
    ["quality-relevance", "0.95"],
    ["quality-recency", "0.98"],
    ["quality-methodology", "0.88"],
    
    ["archive", "wayback", "https://web.archive.org/web/20241101/...", "1730419200"],
    ["archive", "ipfs", "ipfs://QmXyz123...", "1730419200"],
    ["content-hash", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["ipfs-cid", "QmXyz123..."],
    
    ["quote", "Global mean surface temperature increased by 1.2°C from pre-industrial levels"],
    ["quote-location", "Abstract, paragraph 1"],
    ["quote", "Our analysis of 50 independent datasets confirms the warming trend"],
    ["quote-location", "Results, page 4"],
    
    ["relationship", "supports"],
    ["confidence", "95"],
    ["methodology", "peer-reviewed-publication"]
  ],
  "content": "# Evidence Analysis\n\nThis peer-reviewed study from Nature Climate Change directly supports the claim about global temperature increases.\n\n## Key Findings\n1. Temperature increase of 1.2°C confirmed\n2. 50 independent datasets analyzed\n3. Results consistent with prior research\n\n## Methodology Assessment\n- Peer-reviewed by 3 independent experts\n- Data publicly available for verification\n- Methodology follows IPCC guidelines\n\n## Relevance to Claim\nThe study directly addresses the specific temperature claim and provides comprehensive supporting data.",
  "sig": "..."
}
```

### 7.2 Evidence Chain Event (Kind: 32141)

**Type:** Parameterized Replaceable Event  
**Purpose:** Link multiple evidence pieces into a coherent argument chain

```json
{
  "kind": 32141,
  "pubkey": "<compiler-pubkey>",
  "created_at": "<unix-timestamp>",
  "tags": [
    ["d", "<chain-id>"],
    ["claim-event", "<event-id>", "<event-kind>", "<relay-hint>"],
    ["claim-text", "<the-specific-claim>"],
    
    ["evidence", "<evidence-event-id>", "<role>", "<sequence>"],
    ["evidence", "<evidence-event-id-2>", "<role>", "<sequence>"],
    ["evidence", "<evidence-event-id-3>", "<role>", "<sequence>"],
    
    ["chain-type", "<cumulative|sequential|alternative|contradictory>"],
    ["logic-structure", "<deductive|inductive|abductive>"],
    
    ["aggregate-score", "<0.0-1.0>"],
    ["corroboration-bonus", "<0.0-0.5>"],
    ["conflict-detected", "<true|false>"],
    ["conflict-resolution", "<resolution-type>"],
    
    ["burden-level", "<preponderance|clear-convincing|beyond-doubt|scientific>"],
    ["burden-met", "<true|false>"],
    ["burden-score", "<0.0-1.0>"],
    
    ["confidence-lower", "<0.0-1.0>"],
    ["confidence-upper", "<0.0-1.0>"],
    ["confidence-level", "<0-100>"]
  ],
  "content": "<narrative-explanation-of-evidence-chain>",
  "sig": "<signature>"
}
```

#### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `d` | Yes | No | Unique chain identifier |
| `claim-event` | Yes | No | Event containing the claim |
| `claim-text` | Yes | No | The specific claim being supported |
| `evidence` | Yes | Yes | [event-id, role, sequence] - linked evidence |
| `chain-type` | Yes | No | How evidence pieces relate |
| `logic-structure` | No | No | Logical structure of argument |
| `aggregate-score` | Yes | No | Aggregated evidence quality |
| `corroboration-bonus` | No | No | Bonus from corroboration |
| `conflict-detected` | No | No | Whether conflicts exist |
| `conflict-resolution` | No | No | How conflicts were resolved |
| `burden-level` | Yes | No | Required burden of proof |
| `burden-met` | Yes | No | Whether burden is met |
| `burden-score` | Yes | No | Score relative to burden |
| `confidence-lower` | No | No | Lower bound of confidence interval |
| `confidence-upper` | No | No | Upper bound of confidence interval |
| `confidence-level` | No | No | Confidence level percentage |

#### Evidence Roles

- `primary` - Main supporting evidence
- `corroborating` - Independent corroboration
- `contextual` - Provides context
- `methodology` - Explains methodology
- `contradicting` - Contradicts the claim
- `rebuttal` - Rebuts contradicting evidence

#### Example: Evidence Chain for Fact-Check

```json
{
  "kind": 32141,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "chain-unemployment-claim-2024"],
    ["claim-event", "xyz789factcheck", "32127", "wss://relay.example.com"],
    ["claim-text", "Unemployment reached its lowest level in 50 years in 2019"],
    
    ["evidence", "ev-bls-data-001", "primary", "1"],
    ["evidence", "ev-fred-data-002", "corroborating", "2"],
    ["evidence", "ev-historical-comparison-003", "contextual", "3"],
    
    ["chain-type", "cumulative"],
    ["logic-structure", "inductive"],
    
    ["aggregate-score", "0.94"],
    ["corroboration-bonus", "0.15"],
    ["conflict-detected", "false"],
    
    ["burden-level", "clear-convincing"],
    ["burden-met", "true"],
    ["burden-score", "0.94"],
    
    ["confidence-lower", "0.89"],
    ["confidence-upper", "0.97"],
    ["confidence-level", "95"]
  ],
  "content": "# Evidence Chain Analysis\n\n## Claim\n\"Unemployment reached its lowest level in 50 years in 2019\"\n\n## Evidence Summary\n\n### Primary Evidence (BLS Data)\nBureau of Labor Statistics official data shows unemployment rate of 3.5% in September 2019.\n\n### Corroborating Evidence (FRED)\nFederal Reserve Economic Data independently confirms the 3.5% rate.\n\n### Contextual Evidence (Historical Comparison)\nHistorical analysis shows this matches December 1969 rate (3.5%), confirming the \"50 years\" claim.\n\n## Conclusion\nThe evidence chain supports the claim as TRUE with high confidence. Two independent government data sources confirm the rate, and historical records verify the 50-year comparison.",
  "sig": "..."
}
```

### 7.3 Verification Attestation Event (Kind: 32142)

**Type:** Regular Event  
**Purpose:** Independent verification of evidence or claims

```json
{
  "kind": 32142,
  "pubkey": "<verifier-pubkey>",
  "created_at": "<unix-timestamp>",
  "tags": [
    ["verified-event", "<event-id>", "<event-kind>", "<relay-hint>"],
    ["verified-type", "<evidence|claim|chain|archive>"],
    
    ["verification-type", "<independent|corroborating|methodology-review|forensic>"],
    ["verification-method", "<method-description>"],
    ["verification-outcome", "<verified|failed|inconclusive|partial>"],
    
    ["verifier-credentials", "<credential-type>", "<credential-id>"],
    ["verifier-domain", "<domain-expertise>"],
    ["verifier-independence", "<fully-independent|affiliated|interested-party>"],
    
    ["findings", "<key-finding>"],
    ["discrepancies", "<discrepancy-found>"],
    ["confidence", "<0-100>"],
    
    ["hash-verified", "<content-hash>"],
    ["archive-checked", "<archive-service>", "<archive-url>", "<match>"],
    
    ["timestamp-proof", "<opentimestamps-proof>"],
    ["forensic-report", "<report-url>", "<report-hash>"]
  ],
  "content": "<detailed-verification-report>",
  "sig": "<signature>"
}
```

#### Tag Specifications

| Tag | Required | Multiple | Description |
|-----|----------|----------|-------------|
| `verified-event` | Yes | No | Event being verified |
| `verified-type` | Yes | No | Type of verification target |
| `verification-type` | Yes | No | Type of verification performed |
| `verification-method` | Yes | No | Method used for verification |
| `verification-outcome` | Yes | No | Result of verification |
| `verifier-credentials` | No | Yes | Verifier's relevant credentials |
| `verifier-domain` | No | No | Verifier's domain expertise |
| `verifier-independence` | Yes | No | Independence of verifier |
| `findings` | No | Yes | Key findings |
| `discrepancies` | No | Yes | Discrepancies found |
| `confidence` | Yes | No | Confidence in verification |
| `hash-verified` | No | No | Content hash that was verified |
| `archive-checked` | No | Yes | Archives checked |
| `timestamp-proof` | No | No | Timestamp proof if applicable |
| `forensic-report` | No | No | Link to forensic report |

#### Example: Independent Verification

```json
{
  "kind": 32142,
  "pubkey": "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
  "created_at": 1699158500,
  "tags": [
    ["verified-event", "ev-climate-study-2024-001", "32140", "wss://relay.example.com"],
    ["verified-type", "evidence"],
    
    ["verification-type", "independent"],
    ["verification-method", "primary-source-verification-and-methodology-review"],
    ["verification-outcome", "verified"],
    
    ["verifier-credentials", "academic", "PhD Climate Science, MIT"],
    ["verifier-credentials", "professional", "IPCC Contributing Author"],
    ["verifier-domain", "science"],
    ["verifier-independence", "fully-independent"],
    
    ["findings", "Data sources confirmed accessible and matching cited content"],
    ["findings", "Methodology consistent with peer-reviewed standards"],
    ["findings", "Statistical analysis reproduced with matching results"],
    
    ["confidence", "95"],
    
    ["hash-verified", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    ["archive-checked", "wayback", "https://web.archive.org/web/20241101/...", "match"],
    ["archive-checked", "ipfs", "ipfs://QmXyz123...", "match"]
  ],
  "content": "# Independent Verification Report\n\n## Verifier Background\nI am a climate scientist with 15 years of experience and have contributed to IPCC reports. I have no affiliation with the authors of the cited study.\n\n## Verification Methodology\n1. Accessed original paper through DOI\n2. Verified data availability in supplementary materials\n3. Reproduced key statistical analyses\n4. Compared against archived versions\n5. Checked author credentials and institutional affiliations\n\n## Findings\n\n### Primary Source Verification\n- Paper accessible at stated DOI ✓\n- Authors verified at stated institutions ✓\n- Data available in public repository ✓\n\n### Methodology Review\n- Statistical methods appropriate ✓\n- Sample size adequate ✓\n- Controls properly implemented ✓\n\n### Reproduction Attempt\n- Key finding (1.2°C increase) reproduced ✓\n- Confidence intervals match ✓\n\n## Conclusion\nThe evidence is verified as authentic and accurately represented.",
  "sig": "..."
}
```

### 7.4 Archive Record Event (Kind: 32143)

**Type:** Parameterized Replaceable Event  
**Purpose:** Record evidence archival with cryptographic proofs

```json
{
  "kind": 32143,
  "pubkey": "<archiver-pubkey>",
  "created_at": "<unix-timestamp>",
  "tags": [
    ["d", "<archive-record-id>"],
    ["original-url", "<source-url>"],
    ["original-url-hash", "<sha256>"],
    ["content-hash", "<sha256-of-content>"],
    
    ["archive", "wayback", "<archive-url>", "<capture-timestamp>"],
    ["archive", "ipfs", "<cid>", "<pin-timestamp>"],
    ["archive", "arweave", "<tx-id>", "<block-height>"],
    
    ["screenshot", "<screenshot-hash>", "<screenshot-cid>"],
    ["html-snapshot", "<html-hash>", "<html-cid>"],
    
    ["timestamp-proof", "<opentimestamps-ots-file>"],
    ["bitcoin-attestation", "<block-height>", "<merkle-proof>"],
    
    ["capture-method", "<browser|api|direct>"],
    ["capture-viewport", "<width>x<height>"],
    ["capture-user-agent", "<user-agent>"],
    
    ["verified", "<true|false>"],
    ["verification-count", "<number>"],
    ["last-verified", "<timestamp>"]
  ],
  "content": "<archival-notes-and-metadata>",
  "sig": "<signature>"
}
```

#### Example: Complete Archive Record

```json
{
  "kind": 32143,
  "pubkey": "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  "created_at": 1699158000,
  "tags": [
    ["d", "archive-example-article-2024"],
    ["original-url", "https://news.example.com/article/12345"],
    ["original-url-hash", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
    ["content-hash", "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],
    
    ["archive", "wayback", "https://web.archive.org/web/20241105123000/https://news.example.com/article/12345", "1730808600"],
    ["archive", "ipfs", "QmXyz123abcdef456789", "1730808700"],
    ["archive", "arweave", "abc123def456xyz789", "1250000"],
    
    ["screenshot", "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0", "QmScreenshot123"],
    ["html-snapshot", "d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1", "QmHtml456"],
    
    ["timestamp-proof", "AQEAIDABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4f..."],
    ["bitcoin-attestation", "815000", "proof123..."],
    
    ["capture-method", "browser"],
    ["capture-viewport", "1920x1080"],
    ["capture-user-agent", "Mozilla/5.0 (X11; Linux x86_64) Chrome/119.0"],
    
    ["verified", "true"],
    ["verification-count", "3"],
    ["last-verified", "1730895000"]
  ],
  "content": "# Archive Record\n\n## Original Content\nNews article from example.com captured on November 5, 2024.\n\n## Archive Locations\n- Wayback Machine: Captured at 12:30 UTC\n- IPFS: Pinned to 3 nodes via Pinata\n- Arweave: Permanently stored, block 1250000\n\n## Verification\nContent hash verified across all 3 archives. Bitcoin timestamp proof confirms existence as of block 815000.\n\n## Notes\nArticle discusses climate policy changes. Archived for use as evidence in related fact-checks.",
  "sig": "..."
}
```

### 7.5 Chain of Custody Event (Kind: 32144)

**Type:** Regular Event  
**Purpose:** Record custody transfer or verification in evidence chain

```json
{
  "kind": 32144,
  "pubkey": "<handler-pubkey>",
  "created_at": "<unix-timestamp>",
  "tags": [
    ["evidence-id", "<evidence-event-id>"],
    ["custody-type", "<acquisition|transfer|verification|storage>"],
    
    ["from", "<from-pubkey>"],
    ["to", "<to-pubkey>"],
    
    ["content-hash-before", "<sha256>"],
    ["content-hash-after", "<sha256>"],
    ["hash-changed", "<true|false>"],
    ["change-reason", "<reason-if-changed>"],
    
    ["method", "<how-evidence-was-handled>"],
    ["location", "<storage-location>"],
    ["storage-type", "<local|ipfs|arweave|relay>"],
    
    ["verified-integrity", "<true|false>"],
    ["integrity-method", "<verification-method>"],
    
    ["previous-custody", "<previous-custody-event-id>"],
    ["witness", "<witness-pubkey>"]
  ],
  "content": "<custody-notes>",
  "sig": "<signature>"
}
```

### 7.6 Event Kind Summary

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 32140 | Structured Evidence | Param. Replaceable | Attach evidence to claims |
| 32141 | Evidence Chain | Param. Replaceable | Link evidence pieces |
| 32142 | Verification Attestation | Regular | Independent verification |
| 32143 | Archive Record | Param. Replaceable | Evidence archival proof |
| 32144 | Chain of Custody | Regular | Track evidence handling |

---

## 8. Procedural Standards

### 8.1 Evidence Submission Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVIDENCE SUBMISSION WORKFLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: GATHER EVIDENCE                                            │
│  ├── Identify relevant sources                                      │
│  ├── Verify source accessibility                                    │
│  ├── Capture content hashes                                         │
│  └── Document provenance                                            │
│                                                                     │
│  STEP 2: ARCHIVE EVIDENCE                                           │
│  ├── Submit to Wayback Machine                                      │
│  ├── Pin to IPFS                                                    │
│  ├── Optionally store on Arweave                                    │
│  ├── Capture screenshots                                            │
│  └── Create timestamp proofs                                        │
│                                                                     │
│  STEP 3: ASSESS QUALITY                                             │
│  ├── Determine evidence type                                        │
│  ├── Evaluate quality dimensions                                    │
│  ├── Calculate quality score                                        │
│  └── Document methodology                                           │
│                                                                     │
│  STEP 4: CREATE EVIDENCE EVENT                                      │
│  ├── Fill all required tags                                         │
│  ├── Include archive references                                     │
│  ├── Add quality assessments                                        │
│  ├── Write explanation content                                      │
│  └── Sign and publish                                               │
│                                                                     │
│  STEP 5: LINK TO CLAIM                                              │
│  ├── Reference claim event                                          │
│  ├── Specify relationship                                           │
│  └── Update evidence chain if exists                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Verification Procedures

```python
class VerificationProcedures:
    """Standard procedures for evidence verification."""
    
    async def verify_evidence(
        self,
        evidence: StructuredEvidence
    ) -> VerificationReport:
        """Complete verification procedure for submitted evidence."""
        
        report = VerificationReport(evidence_id=evidence.id)
        
        # Step 1: Verify source accessibility
        source_check = await self.verify_source_accessibility(evidence)
        report.add_check('source_accessibility', source_check)
        
        # Step 2: Verify content hash
        hash_check = await self.verify_content_hash(evidence)
        report.add_check('content_hash', hash_check)
        
        # Step 3: Verify archives
        archive_checks = await self.verify_archives(evidence)
        for check in archive_checks:
            report.add_check(f'archive_{check.service}', check)
        
        # Step 4: Verify metadata consistency
        metadata_check = self.verify_metadata_consistency(evidence)
        report.add_check('metadata_consistency', metadata_check)
        
        # Step 5: Verify timestamps
        timestamp_check = await self.verify_timestamps(evidence)
        report.add_check('timestamps', timestamp_check)
        
        # Step 6: Cross-reference with other evidence
        xref_check = await self.cross_reference_evidence(evidence)
        report.add_check('cross_reference', xref_check)
        
        # Calculate overall verification status
        report.calculate_overall_status()
        
        return report
    
    async def verify_source_accessibility(
        self,
        evidence: StructuredEvidence
    ) -> CheckResult:
        """Verify the source URL is accessible and matches claims."""
        
        try:
            response = await self.http_client.get(
                evidence.source_url,
                timeout=30
            )
            
            if response.status_code == 200:
                # Verify content type matches
                content_type = response.headers.get('content-type', '')
                
                return CheckResult(
                    passed=True,
                    details={
                        'status_code': response.status_code,
                        'content_type': content_type,
                        'accessible': True
                    }
                )
            elif response.status_code == 404:
                return CheckResult(
                    passed=False,
                    reason='source_not_found',
                    details={'status_code': 404}
                )
            else:
                return CheckResult(
                    passed=False,
                    reason=f'http_error_{response.status_code}',
                    details={'status_code': response.status_code}
                )
        except Exception as e:
            return CheckResult(
                passed=False,
                reason='network_error',
                details={'error': str(e)}
            )
    
    async def verify_content_hash(
        self,
        evidence: StructuredEvidence
    ) -> CheckResult:
        """Verify content hash matches current content."""
        
        try:
            response = await self.http_client.get(evidence.source_url)
            current_hash = hashlib.sha256(response.content).hexdigest()
            
            if current_hash == evidence.content_hash:
                return CheckResult(
                    passed=True,
                    details={
                        'hash_match': True,
                        'current_hash': current_hash
                    }
                )
            else:
                return CheckResult(
                    passed=False,
                    reason='hash_mismatch',
                    details={
                        'expected': evidence.content_hash,
                        'actual': current_hash
                    }
                )
        except Exception as e:
            return CheckResult(
                passed=False,
                reason='verification_error',
                details={'error': str(e)}
            )
```

### 8.3 Challenge and Dispute Procedures

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVIDENCE CHALLENGE WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: FILE CHALLENGE                                             │
│  ├── Identify specific evidence being challenged                    │
│  ├── State grounds for challenge                                    │
│  ├── Provide counter-evidence if available                          │
│  └── Specify requested remedy                                       │
│                                                                     │
│  STEP 2: INITIAL REVIEW                                             │
│  ├── Verify challenge is properly formed                            │
│  ├── Check challenger standing                                      │
│  ├── Determine if challenge is frivolous                            │
│  └── Notify evidence submitter                                      │
│                                                                     │
│  STEP 3: EVIDENCE HOLDER RESPONSE                                   │
│  ├── Acknowledge challenge                                          │
│  ├── Provide rebuttal evidence                                      │
│  ├── Correct errors if warranted                                    │
│  └── Dispute challenge validity                                     │
│                                                                     │
│  STEP 4: COMMUNITY REVIEW (if unresolved)                           │
│  ├── Open for community input                                       │
│  ├── Gather additional verifications                                │
│  ├── Weight by verifier reputation                                  │
│  └── Calculate consensus position                                   │
│                                                                     │
│  STEP 5: RESOLUTION                                                 │
│  ├── Evidence upheld - challenge rejected                           │
│  ├── Evidence corrected - partial success                           │
│  ├── Evidence retracted - challenge successful                      │
│  └── Update all linked claims                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.4 Appeal Process

```python
class AppealProcess:
    """Standard appeal process for evidence disputes."""
    
    APPEAL_GROUNDS = [
        'new_evidence',           # New evidence not previously available
        'procedural_error',       # Error in original review process
        'misinterpretation',      # Evidence was misinterpreted
        'verification_failure',   # Independent verification failed
        'bias',                   # Reviewer bias affected outcome
    ]
    
    async def file_appeal(
        self,
        original_dispute: Dispute,
        appeal_grounds: str,
        new_evidence: list[Evidence],
        appellant: str
    ) -> Appeal:
        """File an appeal of a dispute resolution."""
        
        # Validate appeal grounds
        if appeal_grounds not in self.APPEAL_GROUNDS:
            raise ValueError(f"Invalid appeal grounds: {appeal_grounds}")
        
        # Check appeal eligibility
        eligibility = await self.check_appeal_eligibility(
            original_dispute,
            appellant
        )
        if not eligibility.eligible:
            raise AppealNotAllowed(eligibility.reason)
        
        # Create appeal
        appeal = Appeal(
            id=generate_appeal_id(),
            original_dispute_id=original_dispute.id,
            appellant=appellant,
            grounds=appeal_grounds,
            new_evidence=new_evidence,
            status='pending',
            filed_at=int(time.time())
        )
        
        # Submit for review
        await self.submit_for_review(appeal)
        
        return appeal
    
    async def review_appeal(
        self,
        appeal: Appeal,
        reviewers: list[str]
    ) -> AppealDecision:
        """Review an appeal with panel of reviewers."""
        
        # Gather reviewer opinions
        opinions = []
        for reviewer in reviewers:
            opinion = await self.get_reviewer_opinion(appeal, reviewer)
            opinions.append(opinion)
        
        # Calculate decision
        uphold_votes = sum(1 for o in opinions if o.decision == 'uphold')
        reverse_votes = sum(1 for o in opinions if o.decision == 'reverse')
        
        total = len(opinions)
        
        if uphold_votes > total * 0.6:
            decision = 'upheld'
        elif reverse_votes > total * 0.6:
            decision = 'reversed'
        else:
            decision = 'remanded'  # Send back for reconsideration
        
        return AppealDecision(
            appeal_id=appeal.id,
            decision=decision,
            uphold_votes=uphold_votes,
            reverse_votes=reverse_votes,
            reviewers=reviewers,
            decided_at=int(time.time()),
            reasoning=self.compile_reasoning(opinions)
        )
```

### 8.5 Quality Assurance Checklist

```markdown
## Evidence Quality Assurance Checklist

### Pre-Submission
- [ ] Source URL is accessible
- [ ] Evidence type correctly classified
- [ ] Publication date verified
- [ ] Author/source credentials checked
- [ ] No conflicts of interest identified

### Archival
- [ ] Wayback Machine snapshot created
- [ ] IPFS pin confirmed
- [ ] Content hash recorded
- [ ] Screenshot captured (if applicable)
- [ ] Timestamp proof generated

### Quality Assessment
- [ ] Verifiability score calculated
- [ ] Independence evaluated
- [ ] Reliability track record checked
- [ ] Relevance to claim assessed
- [ ] Recency factor applied
- [ ] Methodology reviewed (if applicable)

### Documentation
- [ ] Evidence relationship to claim explained
- [ ] Key quotes highlighted
- [ ] Quote locations documented
- [ ] Methodology described
- [ ] Confidence level stated

### Verification Readiness
- [ ] All required tags present
- [ ] Content hash verifiable
- [ ] Archives accessible
- [ ] Chain of custody documented
```

---

## Summary

This evidentiary standards framework provides:

### Core Capabilities

1. **Evidence Type Taxonomy** - Complete classification of evidence types with quality indicators
2. **Quality Scoring** - Mathematical formulas for evidence quality assessment
3. **Claim-Evidence Matrices** - Requirements mapping for different claim types
4. **Archival Standards** - Integration with IPFS, Arweave, and timestamping
5. **Chain of Custody** - Tracking and tamper detection
6. **Burden of Proof** - Clear standards for different claim types

### NOSTR Integration

- **5 new event kinds** (32140-32144) for evidence-related data
- Tag specifications for structured evidence metadata
- Compatibility with existing fact-check and dispute schemas
- Queryable with standard NOSTR filters

### Key Design Principles

1. **Transparency** - All quality scores and methodologies are documented
2. **Verifiability** - Evidence can be independently verified
3. **Preservation** - Evidence is archived against link rot
4. **Accountability** - Chain of custody tracks all handling
5. **Proportionality** - Burden of proof matches claim severity
6. **Due Process** - Clear procedures for challenges and appeals

### Relationship to Other Documents

This framework integrates with:
- [`nostr-event-schemas.md`](../nostr-event-schemas.md) - Base event schemas for fact-checks, disputes
- [`trust-reputation-system.md`](trust-reputation-system.md) - Verifier reputation weights evidence

### Implementation Priority

1. Implement core evidence event schemas (32140, 32141)
2. Build archival integration (Wayback, IPFS)
3. Add verification attestation support (32142)
4. Implement chain of custody tracking (32143, 32144)
5. Build quality scoring algorithms
6. Create UI for evidence submission and verification
