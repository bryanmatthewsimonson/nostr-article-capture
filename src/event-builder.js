import { Storage } from './storage.js';
import { Crypto } from './crypto.js';
import { ContentExtractor } from './content-extractor.js';
import { RelayClient } from './relay-client.js';

export const EventBuilder = {
  // Build NIP-23 article event (kind 30023)
  buildArticleEvent: async (article, entities, userPubkey, claims = []) => {
    // Convert content to markdown, preserving formatting and images
    let markdownContent = article.content || '';
    if (markdownContent && markdownContent.includes('<')) {
      markdownContent = ContentExtractor.htmlToMarkdown(markdownContent);
    }

    // Build metadata header for published content
    let metadataHeader = '---\n';
    metadataHeader += `**Source**: [${article.title}](${article.url})\n`;

    // For video content, use "Channel" instead of "Author"
    if (article.contentType === 'video' && article.byline) {
      metadataHeader += `**Channel**: ${article.byline}\n`;
    } else {
      const metaParts = [];
      if (article.siteName) metaParts.push(`**Publisher**: ${article.siteName}`);
      if (article.byline) metaParts.push(`**Author**: ${article.byline}`);
      if (metaParts.length) metadataHeader += metaParts.join(' | ') + '\n';
    }

    const dateParts = [];
    if (article.publishedAt) {
      dateParts.push(`**Published**: ${new Date(article.publishedAt * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    }
    dateParts.push(`**Archived**: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    metadataHeader += dateParts.join(' | ') + '\n';

    metadataHeader += '---\n\n';

    // For video content, include description and transcript as separate sections
    if (article.contentType === 'video') {
      // Include description section
      if (article.description) {
        markdownContent += '\n\n## Description\n\n' + article.description;
      }

      // Include clean transcript text as formatted markdown paragraphs
      if (article.transcript) {
        markdownContent += '\n\n## Transcript\n\n';
        // Break into paragraphs (every ~3 sentences) for readable markdown
        const sentences = article.transcript.match(/[^.!?]+[.!?]+\s*/g) || [article.transcript];
        let paragraph = '';
        let count = 0;
        for (const sentence of sentences) {
          paragraph += sentence;
          count++;
          if (count >= 3) {
            markdownContent += paragraph.trim() + '\n\n';
            paragraph = '';
            count = 0;
          }
        }
        if (paragraph.trim()) {
          markdownContent += paragraph.trim() + '\n\n';
        }
      }
    } else {
      // Append transcript for non-video content (legacy format)
      if (article.transcript) {
        markdownContent += '\n\n---\n\n## Transcript\n\n```\n' + article.transcript + '\n```';
      }
    }

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
      if (article.transcriptTimestamped) tags.push(['transcript_timestamped', 'true']);
      if (article.description) tags.push(['has_description', 'true']);
    }

    // Add Twitter/X-specific tags (Phase 6)
    if (article.tweetMeta) {
      if (article.tweetMeta.tweetId) tags.push(['tweet_id', article.tweetMeta.tweetId]);
      if (article.tweetMeta.authorHandle) tags.push(['author_handle', '@' + article.tweetMeta.authorHandle]);
      if (article.tweetMeta.isThread) tags.push(['thread', 'true']);
      if (article.tweetMeta.threadLength > 1) tags.push(['thread_length', String(article.tweetMeta.threadLength)]);
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
  },

  // ─── Archive Reader: Relay Retrieval ───

  /**
   * Reconstruct an article object from a kind 30023 NOSTR event.
   * Inverse of buildArticleEvent().
   */
  reconstructArticleFromEvent: (event) => {
    if (!event || event.kind !== 30023) return null;

    // Parse tags into lookup maps
    const tags = {};
    const tagArrays = {};
    for (const tag of (event.tags || [])) {
      const [key, ...values] = tag;
      if (!tags[key]) tags[key] = values[0] || '';
      if (!tagArrays[key]) tagArrays[key] = [];
      tagArrays[key].push(values);
    }

    // Extract markdown content, stripping our metadata header
    let markdown = event.content || '';
    let description = '';
    let transcript = '';

    // Strip metadata header (between --- markers)
    const headerMatch = markdown.match(/^---\n[\s\S]*?\n---\n\n?/);
    if (headerMatch) {
      markdown = markdown.substring(headerMatch[0].length);
    }

    // Extract ## Description section
    const descMatch = markdown.match(/## Description\n\n([\s\S]*?)(?=\n## |\n---|\n$|$)/);
    if (descMatch) {
      description = descMatch[1].trim();
      markdown = markdown.replace(descMatch[0], '').trim();
    }

    // Extract ## Transcript section
    const transMatch = markdown.match(/## Transcript\n\n([\s\S]*?)$/);
    if (transMatch) {
      transcript = transMatch[1].trim();
      markdown = markdown.replace(transMatch[0], '').trim();
    }

    // Convert remaining markdown back to HTML
    let htmlContent = '';
    try {
      htmlContent = ContentExtractor.markdownToHtml(markdown);
    } catch (e) {
      htmlContent = markdown.split('\n\n').map(p => `<p>${p}</p>`).join('');
    }

    const article = {
      url: tags['r'] || '',
      content: htmlContent,
      textContent: markdown,
      title: tags['title'] || '',
      byline: tags['author'] || '',
      siteName: tags['site_name'] || '',
      domain: (tags['r'] || '').match(/https?:\/\/([^/]+)/)?.[1] || '',
      publishedAt: parseInt(tags['published_at']) || event.created_at,
      featuredImage: tags['image'] || '',
      publicationIcon: tags['icon'] || '',
      excerpt: tags['summary'] || '',
      isPaywalled: tags['paywalled'] === 'true',
      contentType: tags['content_format'] || 'article',
      platform: tags['platform'] || null,
      language: tags['lang'] || null,
      keywords: (tagArrays['t'] || []).map(v => v[0]),
      wordCount: parseInt(tags['word_count']) || 0,
      section: tags['section'] || null,
      description: description || null,
      transcript: transcript || null,
      engagement: null,
      videoMeta: null,
      tweetMeta: null,
      platformAccount: null,
      _fromArchive: true,
      _archiveSource: 'relay',
      _nostrEventId: event.id,
      _nostrCreatedAt: event.created_at,
      _nostrPubkey: event.pubkey,
    };

    // Reconstruct engagement
    const eLikes = parseInt(tags['engagement_likes']);
    const eShares = parseInt(tags['engagement_shares']);
    const eComments = parseInt(tags['engagement_comments']);
    if (eLikes || eShares || eComments) {
      article.engagement = { likes: eLikes || 0, shares: eShares || 0, comments: eComments || 0, views: 0 };
    }

    // Video-specific
    if (tags['video_id']) {
      article.videoMeta = { videoId: tags['video_id'], duration: tags['duration'] || '', channelName: tags['channel'] || '' };
    }

    // Tweet-specific
    if (tags['tweet_id']) {
      article.tweetMeta = { tweetId: tags['tweet_id'], authorHandle: (tags['author_handle'] || '').replace('@', ''), isThread: tags['thread'] === 'true', threadLength: parseInt(tags['thread_length']) || 1 };
    }

    return article;
  },

  /**
   * Query NOSTR relays for a kind 30023 event matching a URL.
   * Returns a reconstructed article object or null.
   */
  queryArticleFromRelays: async (url, userPubkey) => {
    try {
      const relays = await Storage.relays.get();
      const readRelays = relays.filter(r => r.enabled && r.read).map(r => r.url);
      if (readRelays.length === 0) return null;

      console.log('[NAC Archive] Querying relays for:', url);
      const filter = { kinds: [30023], '#r': [url], limit: 5 };
      if (userPubkey) filter.authors = [userPubkey];

      const events = await RelayClient.subscribe(readRelays, filter, { timeout: 10000 });
      if (!events || events.length === 0) {
        console.log('[NAC Archive] No events found on relays');
        return null;
      }

      events.sort((a, b) => b.created_at - a.created_at);
      console.log('[NAC Archive] Found', events.length, 'events, using newest from', new Date(events[0].created_at * 1000).toLocaleDateString());

      const article = EventBuilder.reconstructArticleFromEvent(events[0]);
      if (article) {
        // Cache locally for future instant access
        try { await Storage.articleCache.save(article); } catch (e) { /* non-critical */ }
      }
      return article;
    } catch (e) {
      console.log('[NAC Archive] Relay query failed:', e.message);
      return null;
    }
  },

  /**
   * Get an archived article — checks local cache first, then relays.
   */
  getArchivedArticle: async (url, userPubkey) => {
    // 1. Local cache (instant)
    try {
      const cached = await Storage.articleCache.getForUrl(url);
      if (cached) {
        console.log('[NAC Archive] Found in local cache');
        cached._fromArchive = true;
        cached._archiveSource = 'cache';
        return cached;
      }
    } catch (e) { /* continue to relay */ }

    // 2. Relay query (up to 10s)
    if (userPubkey) {
      return await EventBuilder.queryArticleFromRelays(url, userPubkey);
    }

    return null;
  }
};
