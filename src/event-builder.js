import { Storage } from './storage.js';
import { Crypto } from './crypto.js';
import { ContentExtractor } from './content-extractor.js';

export const EventBuilder = {
  // Build NIP-23 article event (kind 30023)
  buildArticleEvent: async (article, entities, userPubkey, claims = []) => {
    // Convert content to markdown, preserving formatting and images
    let markdownContent = article.content;
    if (markdownContent && markdownContent.includes('<')) {
      markdownContent = ContentExtractor.htmlToMarkdown(markdownContent);
    }

    // Append transcript for video content
    if (article.transcript) {
      markdownContent += '\n\n---\n\n## Transcript\n\n```\n' + article.transcript + '\n```';
    }

    // Build metadata header for published content
    let metadataHeader = '---\n';
    metadataHeader += `**Source**: [${article.title}](${article.url})\n`;

    const metaParts = [];
    if (article.siteName) metaParts.push(`**Publisher**: ${article.siteName}`);
    if (article.byline) metaParts.push(`**Author**: ${article.byline}`);
    if (metaParts.length) metadataHeader += metaParts.join(' | ') + '\n';

    const dateParts = [];
    if (article.publishedAt) {
      dateParts.push(`**Published**: ${new Date(article.publishedAt * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    }
    dateParts.push(`**Archived**: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    metadataHeader += dateParts.join(' | ') + '\n';

    metadataHeader += '---\n\n';

    // Prepend metadata header to content
    const content = metadataHeader + markdownContent;

    // Note: Images are kept as original URLs to avoid exceeding relay event size limits
    // (base64 embedding can inflate events to megabytes, causing universal relay rejection).
    // The original absolute URLs are preserved by Turndown's image rule.
    
    // Build tags
    const tags = [
      ['d', await EventBuilder.generateDTag(article.url)],
      ['title', article.title || 'Untitled'],
      ['published_at', String(article.publishedAt || Math.floor(Date.now() / 1000))],
      ['r', article.url],
      ['client', 'nostr-article-capture']
    ];
    
    if (article.excerpt) {
      tags.push(['summary', article.excerpt.substring(0, 500)]);
    }
    
    if (article.featuredImage) {
      tags.push(['image', article.featuredImage]);
    }
    
    if (article.byline) {
      tags.push(['author', article.byline]);
    }
    
    // Add entity tags
    const taggedPubkeys = new Set();
    for (const entityRef of entities) {
      const entity = await Storage.entities.get(entityRef.entity_id);
      if (entity && entity.keypair) {
        // Add pubkey reference
        tags.push(['p', entity.keypair.pubkey, '', entityRef.context]);
        taggedPubkeys.add(entity.keypair.pubkey);
        
        // Add name tag for clients that don't resolve pubkeys
        const tagType = entity.type === 'person' ? 'person' : entity.type === 'organization' ? 'org' : entity.type === 'thing' ? 'thing' : 'place';
        tags.push([tagType, entity.name, entityRef.context]);

        // If this entity is an alias, also tag the canonical entity
        if (entity.canonical_id) {
          const canonical = await Storage.entities.get(entity.canonical_id);
          if (canonical && canonical.keypair && !taggedPubkeys.has(canonical.keypair.pubkey)) {
            tags.push(['p', canonical.keypair.pubkey, '', entityRef.context]);
            taggedPubkeys.add(canonical.keypair.pubkey);
            const canonTagType = canonical.type === 'person' ? 'person' : canonical.type === 'organization' ? 'org' : canonical.type === 'thing' ? 'thing' : 'place';
            tags.push([canonTagType, canonical.name, entityRef.context]);
          }
        }
      }
    }
    
    // Add publication branding tags
    if (article.siteName) {
      tags.push(['site_name', article.siteName]);
    }
    if (article.publicationIcon) {
      tags.push(['icon', article.publicationIcon]);
    }
    
    // Add claim tags
    if (Array.isArray(claims)) {
      for (const claim of claims) {
        if (claim.is_crux) {
          tags.push(['claim', claim.text, claim.type, 'crux']);
        } else {
          tags.push(['claim', claim.text, claim.type]);
        }
      }
    }

    // Add enhanced metadata tags (Phase 1)
    if (article.wordCount) tags.push(['word_count', String(article.wordCount)]);
    if (article.section) tags.push(['section', article.section]);
    if (article.keywords?.length) article.keywords.forEach(kw => tags.push(['t', kw.toLowerCase()]));
    if (article.language) tags.push(['lang', article.language]);
    if (article.dateModified) tags.push(['modified_at', String(Math.floor(new Date(article.dateModified).getTime() / 1000))]);
    if (article.isPaywalled) tags.push(['paywalled', 'true']);
    if (article.structuredData?.type) tags.push(['content_type', article.structuredData.type]);

    // Add content detection tags (Phase 2)
    if (article.contentType) tags.push(['content_format', article.contentType]);
    if (article.platform) tags.push(['platform', article.platform]);

    // Add video-specific tags (Phase 5)
    if (article.contentType === 'video' && article.videoMeta) {
      if (article.videoMeta.videoId) tags.push(['video_id', article.videoMeta.videoId]);
      if (article.videoMeta.duration) tags.push(['duration', article.videoMeta.duration]);
      if (article.byline) tags.push(['channel', article.byline]);
      if (article.transcript) tags.push(['transcript', 'true']);
    }

    // Add engagement metrics tags (Phase 4)
    if (article.engagement) {
      if (article.engagement.likes) tags.push(['engagement_likes', String(article.engagement.likes)]);
      if (article.engagement.shares) tags.push(['engagement_shares', String(article.engagement.shares)]);
      if (article.engagement.comments) tags.push(['engagement_comments', String(article.engagement.comments)]);
    }

    // Add topic tags
    tags.push(['t', 'article']);
    if (article.domain) {
      tags.push(['t', article.domain.replace(/\./g, '-')]);
    }
    
    // Build event
    const event = {
      kind: 30023,
      pubkey: userPubkey || '',
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content
    };
    
    return event;
  },

  // Generate d-tag from URL (16 chars)
  generateDTag: async (url) => {
    const hash = await Crypto.sha256(url);
    return hash.substring(0, 16);
  },

  // Build kind 0 profile event for entity
  buildProfileEvent: (entity, canonicalNpub) => {
    const tags = [];
    if (canonicalNpub) {
      tags.push(['refers_to', canonicalNpub]);
    }
    return {
      kind: 0,
      pubkey: entity.keypair.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify({
        name: entity.name,
        about: `${entity.type} entity created by nostr-article-capture`,
        nip05: entity.nip05 || undefined
      })
    };
  },

  // Build kind 30040 claim event
  buildClaimEvent: (claim, articleUrl, articleTitle, userPubkey, entities) => {
    const tags = [
      ['d', claim.id],
      ['r', articleUrl],
      ['claim-text', claim.text],
      ['claim-type', claim.type],
      ['title', articleTitle],
    ];
    if (claim.is_crux) tags.push(['crux', 'true']);
    if (claim.confidence != null) tags.push(['confidence', String(claim.confidence)]);
    // Attribution tag
    tags.push(['attribution', claim.attribution || 'editorial']);
    // Claimant entity
    if (claim.claimant_entity_id && entities) {
      const claimant = entities[claim.claimant_entity_id];
      if (claimant && claimant.keypair) {
        tags.push(['p', claimant.keypair.pubkey, '', 'claimant']);
        tags.push(['claimant', claimant.name]);
      }
    }
    // Subject entities or freetext
    if (Array.isArray(claim.subject_entity_ids) && claim.subject_entity_ids.length > 0 && entities) {
      for (const sid of claim.subject_entity_ids) {
        const subject = entities[sid];
        if (subject && subject.keypair) {
          tags.push(['p', subject.keypair.pubkey, '', 'subject']);
          tags.push(['subject', subject.name]);
        }
      }
    } else if (claim.subject_text) {
      tags.push(['subject', claim.subject_text]);
    }
    // Object entities or freetext
    if (Array.isArray(claim.object_entity_ids) && claim.object_entity_ids.length > 0 && entities) {
      for (const oid of claim.object_entity_ids) {
        const obj = entities[oid];
        if (obj && obj.keypair) {
          tags.push(['p', obj.keypair.pubkey, '', 'object']);
          tags.push(['object', obj.name]);
        }
      }
    } else if (claim.object_text) {
      tags.push(['object', claim.object_text]);
    }
    // Predicate
    if (claim.predicate) {
      tags.push(['predicate', claim.predicate]);
    }
    // Quote date
    if (claim.quote_date) {
      tags.push(['quote-date', claim.quote_date]);
    }
    return {
      kind: 30040,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: claim.context || ''
    };
  },

  // Build kind 30078 entity sync event (NIP-78 application-specific data)
  buildEntitySyncEvent: (entityId, encryptedContent, entityType, userPubkey) => {
    return {
      kind: 30078,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', entityId],
        ['client', 'nostr-article-capture'],
        ['entity-type', entityType],
        ['L', 'nac/entity-sync'],
        ['l', 'v1', 'nac/entity-sync']
      ],
      content: encryptedContent
    };
  },

  // Build kind 32125 entity relationship event
  buildEntityRelationshipEvent: (entity, articleUrl, relationshipType, userPubkey, claimId) => {
    return {
      kind: 32125,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${entity.id}:${articleUrl}:${relationshipType}`],
        ['r', articleUrl],
        ['p', entity.keypair.pubkey, '', relationshipType],
        ['entity-name', entity.name],
        ['entity-type', entity.type],
        ['relationship', relationshipType],
        ['client', 'nostr-article-capture'],
        ...(claimId ? [['claim-ref', claimId]] : [])
      ],
      content: ''
    };
  },

  // Build kind 30041 comment event
  buildCommentEvent: (comment, articleUrl, articleTitle, userPubkey, accountPubkey) => {
    return {
      kind: 30041,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', comment.id],
        ['r', articleUrl],
        ['title', articleTitle],
        ['comment-text', comment.text],
        ['comment-author', comment.authorName],
        ['platform', comment.platform],
        ...(accountPubkey ? [['p', accountPubkey, '', 'commenter']] : []),
        ...(comment.timestamp ? [['comment-date', String(Math.floor(comment.timestamp / 1000))]] : []),
        ...(comment.replyTo ? [['reply-to', comment.replyTo]] : []),
        ['client', 'nostr-article-capture']
      ],
      content: comment.text
    };
  },

  // Build kind 32126 platform account event
  buildPlatformAccountEvent: (account, userPubkey) => {
    return {
      kind: 32126,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', account.id],
        ['p', account.keypair.pubkey, '', 'account'],
        ['account-username', account.username],
        ['account-platform', account.platform],
        ...(account.profileUrl ? [['r', account.profileUrl]] : []),
        ...(account.linkedEntityId ? [['linked-entity', account.linkedEntityId]] : []),
        ['client', 'nostr-article-capture']
      ],
      content: ''
    };
  },

  // Build kind 30043 evidence link event
  buildEvidenceLinkEvent: async (link, allClaims, userPubkey) => {
    const sourceClaim = allClaims[link.source_claim_id];
    const targetClaim = allClaims[link.target_claim_id];

    const tags = [
      ['d', link.id],
      ['source-claim', link.source_claim_id],
      ['target-claim', link.target_claim_id],
      ['relationship', link.relationship],
      ['client', 'nostr-article-capture']
    ];

    if (sourceClaim?.source_url) tags.push(['r', sourceClaim.source_url]);
    if (targetClaim?.source_url) tags.push(['r', targetClaim.source_url]);

    return {
      kind: 30043,
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: link.note || ''
    };
  }
};
