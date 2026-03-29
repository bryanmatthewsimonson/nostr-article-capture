import { CONFIG, _state } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { Crypto } from './crypto.js';
import { ContentExtractor } from './content-extractor.js';
import { ContentDetector } from './content-detector.js';
import { EntityTagger } from './entity-tagger.js';
import { ClaimExtractor } from './claim-extractor.js';
import { EntityAutoSuggest } from './entity-auto-suggest.js';
import { RelayClient } from './relay-client.js';
import { EventBuilder } from './event-builder.js';
import { EntityBrowser } from './entity-browser.js';
import { CommentExtractor } from './comment-extractor.js';
import { PlatformAccount } from './platform-account.js';

export const ReaderView = {
  container: null,
  article: null,
  entities: [],
  claims: [],
  capturedComments: [],
  commentsCollapsed: true,
  editMode: false,
  markdownMode: false,
  previewMode: false,
  _originalContentHtml: null,
  _hiddenElements: [],
  _remoteClaimsCache: null,

  // Create and show reader view
  show: async (article) => {
    ReaderView.article = article;
    ReaderView.entities = [];
    ReaderView.claims = [];
    
    // Viewport meta tag injection for mobile
    ReaderView._originalViewport = document.querySelector('meta[name="viewport"]');
    if (!ReaderView._originalViewport) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
      document.head.appendChild(meta);
      ReaderView._injectedViewport = meta;
    }
    
    // Hide original page content by hiding each child element,
    // rather than hiding the body itself (which would also hide our reader view)
    ReaderView._hiddenElements = [];
    Array.from(document.body.children).forEach(child => {
      if (child.style.display !== 'none') {
        ReaderView._hiddenElements.push({ el: child, prev: child.style.display });
        child.style.display = 'none';
      }
    });
    
    // Create reader container
    ReaderView.container = document.createElement('div');
    ReaderView.container.id = 'nac-reader-view';
    ReaderView.container.className = 'nac-reader-container';
    ReaderView.container.setAttribute('tabindex', '-1');
    ReaderView.container.setAttribute('role', 'dialog');
    ReaderView.container.setAttribute('aria-label', 'Article reader view');
    
    // Build UI
    ReaderView.container.innerHTML = `
      <div class="nac-reader-toolbar">
        <button class="nac-btn-back" id="nac-back-btn" aria-label="Close reader and return to page">← Back to Page</button>
        <div class="nac-toolbar-title">${article.domain || 'Article'}</div>
        <div class="nac-toolbar-actions">
          <button class="nac-btn-toolbar" id="nac-preview-btn" title="Preview as Published" aria-label="Preview as published">👁 Preview</button>
          <button class="nac-btn-toolbar" id="nac-edit-btn" aria-label="Edit article">Edit</button>
          <button class="nac-btn-toolbar nac-btn-md-toggle" id="nac-md-toggle-btn" style="display:none;" title="Switch to Markdown editing" aria-label="Toggle markdown editor">📝 Markdown</button>
          <button class="nac-btn-toolbar" id="nac-claims-btn" title="Claims" aria-label="Toggle claims section">📋 <span id="nac-claims-badge" class="nac-claims-badge" style="display:none;">0</span></button>
          <button class="nac-btn-toolbar nac-btn-primary" id="nac-publish-btn" aria-label="Publish article to NOSTR">Publish</button>
          <button class="nac-btn-toolbar" id="nac-settings-btn" aria-label="Settings">⚙</button>
        </div>
      </div>
      
      <div class="nac-reader-content">
        <div class="nac-reader-article">
          <div class="nac-article-header">
            <h1 class="nac-article-title" contenteditable="false" id="nac-title">${article.title || 'Untitled'}</h1>
            <div class="nac-article-meta">
              <span class="nac-meta-author nac-editable-field" id="nac-author" data-field="byline" title="Click to edit author" role="button" tabindex="0" aria-label="Edit author — click to change">${Utils.escapeHtml(article.byline || 'Unknown Author')}</span>
              <span class="nac-meta-separator">•</span>
              <img class="nac-meta-icon" src="${Utils.escapeHtml(article.publicationIcon || '')}" onerror="this.style.display='none'" width="20" height="20" alt="">
              <span class="nac-meta-publication nac-editable-field" id="nac-publication" data-field="siteName" title="Click to edit publication" role="button" tabindex="0" aria-label="Edit publication — click to change">${Utils.escapeHtml(article.siteName || article.domain || '')}</span>
              <span class="nac-meta-separator">•</span>
              <span class="nac-meta-date nac-editable-field" id="nac-date" data-field="publishedAt" title="Click to edit date" role="button" tabindex="0" aria-label="Edit date — click to change">${article.publishedAt ? ReaderView._formatDate(article.publishedAt) : 'Unknown Date'}</span>
              ${article.isPaywalled ? '<span class="nac-meta-paywall" title="Paywalled content">🔒</span>' : ''}
            </div>
            <div class="nac-meta-detection-row">
              <span class="nac-meta-content-type">${ContentDetector.getPlatformIcon(article.platform)} ${ContentDetector.getTypeLabel(article.contentType)}</span>
              ${article.hasComments ? '<span class="nac-meta-comments-indicator" title="Comments detected on this page">💬 Comments</span>' : ''}
            </div>
            ${article.wordCount ? `
            <div class="nac-meta-stats">
              <span>${article.wordCount.toLocaleString()} words</span>
              <span class="nac-meta-separator">·</span>
              <span>${article.readingTimeMinutes} min read</span>
              ${article.dateModified && article.dateModified !== (article.publishedAt ? new Date(article.publishedAt * 1000).toISOString() : null) ? `
                <span class="nac-meta-separator">·</span>
                <span class="nac-meta-modified" title="Last modified date">Modified: ${ReaderView._formatDateStr(article.dateModified)}</span>
              ` : ''}
              ${article.language && article.language !== 'en' && !article.language.startsWith('en-') ? `
                <span class="nac-meta-separator">·</span>
                <span class="nac-meta-lang" title="Content language">${article.language}</span>
              ` : ''}
            </div>` : ''}
            ${article.section ? `
            <div class="nac-meta-section-row">
              <span class="nac-meta-section-badge">${Utils.escapeHtml(article.section)}</span>
            </div>` : ''}
            ${article.keywords?.length ? `
            <div class="nac-meta-keywords">
              ${article.keywords.slice(0, 5).map(kw => `<span class="nac-meta-keyword-pill">${Utils.escapeHtml(kw)}</span>`).join('')}
            </div>` : ''}
            <div class="nac-article-source">
              <span class="nac-source-label">Source:</span>
              <span class="nac-source-url nac-editable-field" id="nac-url" data-field="url" title="${Utils.escapeHtml(article.url)} — Click to edit URL" role="button" tabindex="0" aria-label="Edit article URL — click to change">${Utils.escapeHtml(article.url)}</span>
              <a class="nac-source-link" id="nac-url-link" href="${Utils.escapeHtml(article.url)}" target="_blank" rel="noopener" title="Open article URL in new tab" aria-label="Open URL in new tab">↗</a>
              <button class="nac-btn-copy" id="nac-copy-url" aria-label="Copy article URL">Copy</button>
            </div>
            <div class="nac-article-archived">
              Archived: ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div class="nac-article-body" id="nac-content" contenteditable="false">
            ${article.content || ''}
          </div>
        </div>
        
        <!-- Comments section (collapsible) -->
        <div class="nac-comments-section" id="nac-comments-section" style="display: none;">
          <div class="nac-comments-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="nac-comments-bar-title" style="font-size: 14px; font-weight: 600; color: var(--nac-text-muted);">💬 Comments (<span id="nac-comments-count">0</span>)</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="nac-btn-capture-comments" id="nac-capture-comments-btn" aria-label="Capture comments from this page">💬 Capture Comments</button>
              <button class="nac-comments-toggle" id="nac-comments-toggle-btn" aria-label="Toggle comments section">▼</button>
            </div>
          </div>
          <div id="nac-comments-container" style="display: none;">
            <p class="nac-comments-empty">No comments captured yet. Click "Capture Comments" to extract comments from this page.</p>
          </div>
        </div>
        
        <!-- Suggestion bar will be injected here by EntityAutoSuggest -->
        <div id="nac-suggestion-bar" class="nac-suggestion-bar" style="display: none;"></div>
        
        <div class="nac-entity-bar">
          <div class="nac-entity-bar-title">Tagged Entities</div>
          <div class="nac-entity-chips" id="nac-entity-chips" role="list" aria-label="Tagged entities">
            <!-- Entity chips will be added here -->
          </div>
          <button class="nac-btn-add-entity" id="nac-add-entity-btn" aria-label="Tag a new entity">+ Tag Entity</button>
        </div>
        
        <div class="nac-claims-bar" id="nac-claims-bar" aria-label="Extracted claims">
          <div class="nac-claims-bar-header">
            <span class="nac-claims-bar-title">📋 Claims (<span class="nac-claims-count">0</span>)</span>
            <div class="nac-claims-bar-actions">
              <button class="nac-btn-remote-claims" id="nac-remote-claims-btn" aria-label="View claims from other NOSTR users">🌐 Others' Claims</button>
              <button class="nac-btn-add-claim" id="nac-add-claim-btn" aria-label="Add a claim by selecting text">+ Add Claim</button>
            </div>
          </div>
          <div class="nac-claims-chips" role="list" aria-label="Extracted claims list">
            <div class="nac-claims-empty">No claims extracted yet. Select text and click 📋 Claim.</div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(ReaderView.container);
    
    // Attach event listeners
    document.getElementById('nac-back-btn').addEventListener('click', ReaderView.hide);
    document.getElementById('nac-edit-btn').addEventListener('click', ReaderView.toggleEditMode);
    document.getElementById('nac-md-toggle-btn').addEventListener('click', ReaderView.toggleMarkdownMode);
    document.getElementById('nac-preview-btn').addEventListener('click', ReaderView.togglePreviewMode);
    document.getElementById('nac-publish-btn').addEventListener('click', ReaderView.showPublishPanel);
    document.getElementById('nac-settings-btn').addEventListener('click', ReaderView.showSettings);
    document.getElementById('nac-claims-btn').addEventListener('click', () => {
      const claimsBar = document.getElementById('nac-claims-bar');
      if (claimsBar) {
        const isHidden = claimsBar.style.display === 'none';
        claimsBar.style.display = isHidden ? '' : 'none';
        if (!isHidden) return;
        claimsBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    document.getElementById('nac-copy-url').addEventListener('click', () => {
      navigator.clipboard.writeText(ReaderView.article.url);
      Utils.showToast('URL copied to clipboard');
    });
    
    // Add Claim button handler
    document.getElementById('nac-add-claim-btn').addEventListener('click', () => {
      Utils.showToast('Select text in the article, then click 📋 Claim in the popover', 'info');
    });

    // Remote claims button handler
    document.getElementById('nac-remote-claims-btn').addEventListener('click', () => {
      ClaimExtractor.showRemoteClaims();
    });

    // Tag Entity button handler
    document.getElementById('nac-add-entity-btn').addEventListener('click', (e) => {
      const name = prompt('Enter entity name to tag:');
      if (name && name.trim().length >= CONFIG.tagging.min_selection_length) {
        const rect = e.target.getBoundingClientRect();
        EntityTagger.show(name.trim(), rect.left + window.scrollX, rect.top + window.scrollY);
      }
    });

    // Show comments section if comments were detected
    if (article.hasComments) {
      const commentsSection = document.getElementById('nac-comments-section');
      if (commentsSection) commentsSection.style.display = '';
    }

    // Capture Comments button handler
    document.getElementById('nac-capture-comments-btn').addEventListener('click', async () => {
      const btn = document.getElementById('nac-capture-comments-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Capturing...';
      try {
        const platform = ReaderView.article.platform || ReaderView.article.domain || 'unknown';
        const comments = await CommentExtractor.extractComments(ReaderView.article.url, platform);
        if (comments.length > 0) {
          ReaderView.capturedComments = comments;
          await CommentExtractor.saveComments(comments);
          // Show the section and expand it
          const commentsSection = document.getElementById('nac-comments-section');
          if (commentsSection) commentsSection.style.display = '';
          const container = document.getElementById('nac-comments-container');
          if (container) {
            container.style.display = '';
            CommentExtractor.renderCommentsSection(container, comments, ReaderView.article.url);
          }
          const countEl = document.getElementById('nac-comments-count');
          if (countEl) countEl.textContent = comments.length;
          ReaderView.commentsCollapsed = false;
          const toggleBtn = document.getElementById('nac-comments-toggle-btn');
          if (toggleBtn) toggleBtn.textContent = '▲';
          btn.textContent = `✓ ${comments.length} captured`;
        } else {
          btn.textContent = 'No comments found';
          Utils.showToast('No comments found on this page', 'error');
        }
      } catch (e) {
        console.error('[NAC] Comment capture error:', e);
        btn.textContent = '💬 Capture Comments';
        Utils.showToast('Failed to capture comments: ' + e.message, 'error');
      }
      setTimeout(() => {
        btn.disabled = false;
        if (!ReaderView.capturedComments.length) btn.textContent = '💬 Capture Comments';
      }, 3000);
    });

    // Comments toggle (collapse/expand)
    document.getElementById('nac-comments-toggle-btn').addEventListener('click', () => {
      const container = document.getElementById('nac-comments-container');
      const toggleBtn = document.getElementById('nac-comments-toggle-btn');
      if (!container) return;
      ReaderView.commentsCollapsed = !ReaderView.commentsCollapsed;
      container.style.display = ReaderView.commentsCollapsed ? 'none' : '';
      toggleBtn.textContent = ReaderView.commentsCollapsed ? '▼' : '▲';
    });

    // Load previously captured comments for this URL
    try {
      const existingComments = await Storage.comments.getForUrl(article.url);
      if (existingComments.length > 0) {
        ReaderView.capturedComments = existingComments;
        const commentsSection = document.getElementById('nac-comments-section');
        if (commentsSection) commentsSection.style.display = '';
        const countEl = document.getElementById('nac-comments-count');
        if (countEl) countEl.textContent = existingComments.length;
        const container = document.getElementById('nac-comments-container');
        if (container) {
          CommentExtractor.renderCommentsSection(container, existingComments, article.url);
        }
        const captureBtn = document.getElementById('nac-capture-comments-btn');
        if (captureBtn) captureBtn.textContent = `💬 Re-capture (${existingComments.length})`;
      }
    } catch (e) {
      console.error('[NAC] Failed to load existing comments:', e);
    }
    
    // Attach inline edit handlers for metadata fields (click + keyboard)
    document.querySelectorAll('#nac-reader-view .nac-editable-field').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        ReaderView._startInlineEdit(el, el.dataset.field);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          ReaderView._startInlineEdit(el, el.dataset.field);
        }
      });
    });
    
    // Enable text selection for entity tagging
    const contentEl = document.getElementById('nac-content');
    contentEl.addEventListener('mouseup', ReaderView.handleTextSelection);
    contentEl.addEventListener('touchend', ReaderView.handleTextSelection);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', ReaderView.handleKeyboard);
    
    // Focus the reader container for keyboard accessibility
    ReaderView.container.focus();
    
    // Auto-detect author entity from byline
    if (article.byline && article.byline.trim().length >= CONFIG.tagging.min_selection_length) {
      try {
        const authorName = article.byline.trim();
        const authorResults = await Storage.entities.search(authorName, 'person');
        
        if (authorResults.length > 0) {
          // Link existing author entity
          const entity = authorResults[0];
          if (!entity.articles) entity.articles = [];
          const authorArticleEntry = {
            url: article.url,
            title: article.title,
            context: 'author',
            tagged_at: Math.floor(Date.now() / 1000)
          };
          const existingAuthorIdx = entity.articles.findIndex(a => a.url === authorArticleEntry.url);
          if (existingAuthorIdx >= 0) {
            entity.articles[existingAuthorIdx].tagged_at = authorArticleEntry.tagged_at;
          } else {
            entity.articles.push(authorArticleEntry);
          }
          await Storage.entities.save(entity.id, entity);
          ReaderView.entities.push({ entity_id: entity.id, context: 'author' });
          EntityTagger.addChip(entity);
        } else {
          // Create new person entity for author
          const privkey = Crypto.generatePrivateKey();
          const pubkey = Crypto.getPublicKey(privkey);
          const entityId = 'entity_' + await Crypto.sha256('person' + authorName);
          const userIdentity = await Storage.identity.get();
          
          const entity = await Storage.entities.save(entityId, {
            id: entityId,
            type: 'person',
            name: authorName,
            aliases: [],
            canonical_id: null,
            keypair: {
              pubkey,
              privkey,
              npub: Crypto.hexToNpub(pubkey),
              nsec: Crypto.hexToNsec(privkey)
            },
            created_by: userIdentity?.pubkey || 'unknown',
            created_at: Math.floor(Date.now() / 1000),
            articles: [{
              url: article.url,
              title: article.title,
              context: 'author',
              tagged_at: Math.floor(Date.now() / 1000)
            }],
            metadata: {}
          });
          
          ReaderView.entities.push({ entity_id: entityId, context: 'author' });
          EntityTagger.addChip(entity);
        }
      } catch (e) {
        Utils.error('Failed to auto-tag author:', e);
      }
    }
    
    // Auto-detect publication entity from siteName/domain
    const publicationName = (article.siteName || article.domain || '').trim();
    if (publicationName.length >= CONFIG.tagging.min_selection_length) {
      try {
        const pubResults = await Storage.entities.search(publicationName, 'organization');
        
        if (pubResults.length > 0) {
          // Link existing publication entity
          const entity = pubResults[0];
          if (!entity.articles) entity.articles = [];
          const pubArticleEntry = {
            url: article.url,
            title: article.title,
            context: 'publication',
            tagged_at: Math.floor(Date.now() / 1000)
          };
          const existingPubIdx = entity.articles.findIndex(a => a.url === pubArticleEntry.url);
          if (existingPubIdx >= 0) {
            entity.articles[existingPubIdx].tagged_at = pubArticleEntry.tagged_at;
          } else {
            entity.articles.push(pubArticleEntry);
          }
          await Storage.entities.save(entity.id, entity);
          ReaderView.entities.push({ entity_id: entity.id, context: 'publication' });
          EntityTagger.addChip(entity);
        } else {
          // Create new organization entity for publication
          const privkey = Crypto.generatePrivateKey();
          const pubkey = Crypto.getPublicKey(privkey);
          const entityId = 'entity_' + await Crypto.sha256('organization' + publicationName);
          const userIdentity = await Storage.identity.get();
          
          const entity = await Storage.entities.save(entityId, {
            id: entityId,
            type: 'organization',
            name: publicationName,
            aliases: [],
            canonical_id: null,
            keypair: {
              pubkey,
              privkey,
              npub: Crypto.hexToNpub(pubkey),
              nsec: Crypto.hexToNsec(privkey)
            },
            created_by: userIdentity?.pubkey || 'unknown',
            created_at: Math.floor(Date.now() / 1000),
            articles: [{
              url: article.url,
              title: article.title,
              context: 'publication',
              tagged_at: Math.floor(Date.now() / 1000)
            }],
            metadata: {}
          });
          
          ReaderView.entities.push({ entity_id: entityId, context: 'publication' });
          EntityTagger.addChip(entity);
        }
      } catch (e) {
        Utils.error('Failed to auto-tag publication:', e);
      }
    }
   
   // Auto-suggest entities (async, non-blocking)
   if (typeof requestIdleCallback === 'function') {
     requestIdleCallback(() => EntityAutoSuggest.scan(article), { timeout: 2000 });
   } else {
     setTimeout(() => EntityAutoSuggest.scan(article), 500);
   }

   // Load claims for this article
   await ClaimExtractor.loadForArticle(article.url);
 },

  // Format a Unix timestamp as a readable date string
  _formatDate: (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  },

  // Format an ISO date string as a readable date
  _formatDateStr: (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  // Start inline editing of a metadata field
  _startInlineEdit: (element, fieldKey) => {
    // Guard: already editing
    if (element.querySelector('input')) return;

    const originalText = element.textContent.trim();
    const isDate = fieldKey === 'publishedAt';

    // Create the appropriate input
    const input = document.createElement('input');
    input.className = 'nac-inline-edit-input';

    if (isDate) {
      input.type = 'date';
      const ts = ReaderView.article.publishedAt;
      if (ts) {
        const d = new Date(ts * 1000);
        // Format as YYYY-MM-DD for the date input value
        input.value = d.toISOString().split('T')[0];
      }
    } else if (fieldKey === 'url') {
      input.type = 'text';
      input.value = ReaderView.article.url || '';
      input.style.fontFamily = 'monospace';
      input.style.fontSize = '12px';
    } else {
      input.type = 'text';
      input.value = fieldKey === 'byline'
        ? (ReaderView.article.byline || '')
        : (ReaderView.article.siteName || ReaderView.article.domain || '');
    }

    // Replace text with input
    element.textContent = '';
    element.appendChild(input);
    input.focus();
    if (input.type === 'text') input.select();

    let saved = false;

    const cleanup = () => {
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKeydown);
      if (isDate) input.removeEventListener('change', onChange);
    };

    const save = () => {
      if (saved) return;
      saved = true;
      const newValue = input.value.trim();
      cleanup();

      if (isDate) {
        if (newValue) {
          const newTs = Math.floor(new Date(newValue + 'T12:00:00').getTime() / 1000);
          ReaderView.article.publishedAt = newTs;
          element.textContent = ReaderView._formatDate(newTs);
        } else {
          element.textContent = originalText;
        }
      } else if (fieldKey === 'url') {
        if (newValue) {
          const cleanedUrl = ContentExtractor.normalizeUrl(newValue);
          ReaderView.article.url = cleanedUrl;
          ReaderView.article.domain = ContentExtractor.getDomain(cleanedUrl);
          element.textContent = cleanedUrl;
          element.title = cleanedUrl + ' — Click to edit URL';
          // Update the external link href
          const linkEl = document.getElementById('nac-url-link');
          if (linkEl) linkEl.href = cleanedUrl;
        } else {
          element.textContent = originalText;
        }
      } else {
        if (newValue) {
          ReaderView.article[fieldKey] = newValue;
          element.textContent = newValue;
        } else {
          element.textContent = originalText;
        }
      }
    };

    const cancel = () => {
      if (saved) return;
      saved = true;
      cleanup();
      element.textContent = originalText;
    };

    const onBlur = () => save();
    const onKeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };
    const onChange = () => { if (isDate) input.blur(); };

    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeydown);
    if (isDate) input.addEventListener('change', onChange);
  },

  // Hide reader view and restore original page
  hide: () => {
    // Reset markdown/preview/claims/comments state
    ReaderView.markdownMode = false;
    ReaderView.previewMode = false;
    ReaderView.claims = [];
    ReaderView.capturedComments = [];
    ReaderView.commentsCollapsed = true;
    ReaderView._originalContentHtml = null;
    ReaderView._remoteClaimsCache = null;

    // Restore viewport meta tag
    if (ReaderView._injectedViewport) {
      ReaderView._injectedViewport.remove();
      ReaderView._injectedViewport = null;
    }

    if (ReaderView.container) {
      ReaderView.container.remove();
      ReaderView.container = null;
    }
    // Restore previously hidden elements
    ReaderView._hiddenElements.forEach(({ el, prev }) => {
      el.style.display = prev;
    });
    ReaderView._hiddenElements = [];
    document.removeEventListener('keydown', ReaderView.handleKeyboard);
    EntityAutoSuggest.destroy();
    RelayClient.disconnectAll();

    // Return focus to the FAB button (lives in Shadow DOM, use module-level ref)
    if (_state.nacFabRef) _state.nacFabRef.focus();
  },

  // Toggle edit mode
  toggleEditMode: () => {
    // If in preview mode, exit it first
    if (ReaderView.previewMode) {
      ReaderView.togglePreviewMode();
    }

    // If currently in markdown mode, convert back to HTML before exiting edit mode
    if (ReaderView.editMode && ReaderView.markdownMode) {
      ReaderView._exitMarkdownMode();
    }

    ReaderView.editMode = !ReaderView.editMode;
    const titleEl = document.getElementById('nac-title');
    const contentEl = document.getElementById('nac-content');
    const editBtn = document.getElementById('nac-edit-btn');
    const mdToggleBtn = document.getElementById('nac-md-toggle-btn');
    const previewBtn = document.getElementById('nac-preview-btn');
    
    if (ReaderView.editMode) {
      titleEl.contentEditable = 'true';
      contentEl.contentEditable = 'true';
      editBtn.textContent = 'Done';
      editBtn.classList.add('active');
      mdToggleBtn.style.display = '';
      previewBtn.style.display = 'none';
    } else {
      titleEl.contentEditable = 'false';
      contentEl.contentEditable = 'false';
      editBtn.textContent = 'Edit';
      editBtn.classList.remove('active');
      mdToggleBtn.style.display = 'none';
      previewBtn.style.display = '';
      
      // Reset markdown mode state
      ReaderView.markdownMode = false;
      mdToggleBtn.textContent = '📝 Markdown';
      mdToggleBtn.title = 'Switch to Markdown editing';
      
      // Save changes
      ReaderView.article.title = titleEl.textContent;
      ReaderView.article.content = contentEl.innerHTML;
    }
  },

  // Toggle between visual and markdown editing modes
  toggleMarkdownMode: () => {
    if (!ReaderView.editMode) return;

    const contentEl = document.getElementById('nac-content');
    const mdToggleBtn = document.getElementById('nac-md-toggle-btn');

    if (!ReaderView.markdownMode) {
      // Switch TO markdown mode
      ReaderView.markdownMode = true;
      mdToggleBtn.textContent = '👁 Visual';
      mdToggleBtn.title = 'Switch to Visual editing';
      mdToggleBtn.classList.add('active');

      // Convert current HTML to markdown
      const markdown = ContentExtractor.htmlToMarkdown(contentEl.innerHTML);

      // Hide the contentEditable div, show a textarea
      contentEl.contentEditable = 'false';
      contentEl.style.display = 'none';

      const textarea = document.createElement('textarea');
      textarea.id = 'nac-md-textarea';
      textarea.className = 'nac-md-textarea';
      textarea.value = markdown;
      textarea.spellcheck = false;

      // Auto-resize on input
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };
      textarea.addEventListener('input', autoResize);

      contentEl.parentNode.insertBefore(textarea, contentEl.nextSibling);

      // Trigger initial resize
      requestAnimationFrame(autoResize);
    } else {
      // Switch BACK to visual mode
      ReaderView._exitMarkdownMode();
    }
  },

  // Internal: exit markdown mode and restore visual editing
  _exitMarkdownMode: () => {
    const contentEl = document.getElementById('nac-content');
    const textarea = document.getElementById('nac-md-textarea');
    const mdToggleBtn = document.getElementById('nac-md-toggle-btn');

    if (textarea) {
      // Convert markdown back to HTML
      const html = ContentExtractor.markdownToHtml(textarea.value);
      contentEl.innerHTML = html;
      textarea.remove();
    }

    contentEl.style.display = '';
    if (ReaderView.editMode) {
      contentEl.contentEditable = 'true';
    }

    ReaderView.markdownMode = false;
    if (mdToggleBtn) {
      mdToggleBtn.textContent = '📝 Markdown';
      mdToggleBtn.title = 'Switch to Markdown editing';
      mdToggleBtn.classList.remove('active');
    }
  },

  // Toggle "Preview as Published" mode (available outside edit mode)
  togglePreviewMode: () => {
    // Don't allow preview while in edit mode
    if (ReaderView.editMode) return;

    const contentEl = document.getElementById('nac-content');
    const previewBtn = document.getElementById('nac-preview-btn');

    if (!ReaderView.previewMode) {
      // Enter preview mode
      ReaderView.previewMode = true;
      ReaderView._originalContentHtml = contentEl.innerHTML;

      // Convert HTML → markdown → HTML to show exactly what will be published
      const markdown = ContentExtractor.htmlToMarkdown(contentEl.innerHTML);
      const renderedHtml = ContentExtractor.markdownToHtml(markdown);
      contentEl.innerHTML = renderedHtml;

      previewBtn.textContent = '↩ Original';
      previewBtn.title = 'Back to Original view';
      previewBtn.classList.add('active');
      Utils.showToast('Showing preview as published markdown', 'success');
    } else {
      // Exit preview mode — restore original HTML
      ReaderView.previewMode = false;
      contentEl.innerHTML = ReaderView._originalContentHtml;
      ReaderView._originalContentHtml = null;

      previewBtn.textContent = '👁 Preview';
      previewBtn.title = 'Preview as Published';
      previewBtn.classList.remove('active');
    }
  },

  // Handle text selection for entity tagging
  handleTextSelection: (e) => {
    if (ReaderView.editMode) return;
    
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length >= CONFIG.tagging.min_selection_length && 
          text.length <= CONFIG.tagging.max_selection_length) {
        EntityTagger.show(text, e.pageX, e.pageY);
      } else {
        EntityTagger.hide();
      }
    }, CONFIG.tagging.selection_debounce_ms);
  },

  // Handle keyboard shortcuts
  handleKeyboard: (e) => {
    if (e.key === 'Escape') {
      // Close topmost panel/overlay in order
      if (EntityTagger.popover) {
        EntityTagger.hide();
      } else if (document.getElementById('nac-settings-panel')) {
        ReaderView.hideSettings();
      } else if (document.getElementById('nac-publish-panel')) {
        ReaderView.hidePublishPanel();
      } else {
        ReaderView.hide();
      }
    } else if (e.key === 'Tab' && ReaderView.container) {
      // Focus trap: keep Tab within the reader view
      ReaderView._trapFocus(e);
    } else if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      ReaderView.toggleEditMode();
    }
  },

  // Focus trap implementation for reader view
  _trapFocus: (e) => {
    const container = ReaderView.container;
    if (!container) return;

    const focusableSelectors = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    const focusableElements = Array.from(container.querySelectorAll(focusableSelectors)).filter(el => {
      return el.offsetParent !== null && !el.closest('[style*="display: none"], [style*="display:none"]');
    });

    if (focusableElements.length === 0) return;

    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === firstEl || !container.contains(document.activeElement)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === lastEl || !container.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  },

  // Show publish panel
  showPublishPanel: async () => {
    // If in markdown mode, sync the textarea content back to article
    if (ReaderView.markdownMode) {
      const textarea = document.getElementById('nac-md-textarea');
      if (textarea) {
        const html = ContentExtractor.markdownToHtml(textarea.value);
        ReaderView.article.content = html;
      }
    } else if (ReaderView.editMode) {
      // In visual edit mode, sync from contentEditable
      const contentEl = document.getElementById('nac-content');
      if (contentEl) {
        ReaderView.article.content = contentEl.innerHTML;
      }
    }

    // Remember which element opened the panel for focus return
    ReaderView._publishOpener = document.activeElement;

    const panel = document.createElement('div');
    panel.id = 'nac-publish-panel';
    panel.className = 'nac-publish-panel';
    panel.setAttribute('tabindex', '-1');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Publish to NOSTR');
    
    const identity = await Storage.identity.get();
    const relayConfig = await Storage.relays.get();
    
    panel.innerHTML = `
      <div class="nac-publish-header">
        <h3>Publish to NOSTR</h3>
        <button class="nac-btn-close" id="nac-close-publish" aria-label="Close publish panel">×</button>
      </div>
      
      <div class="nac-publish-body">
        <div class="nac-form-group">
          <label>Signing Method</label>
          <select id="nac-signing-method" class="nac-form-select">
            <option value="nip07">NIP-07 Extension</option>
            <option value="local">Local Keypair</option>
          </select>
        </div>
        
        ${!identity ? '<div class="nac-warning">No identity configured. Please set up signing in settings.</div>' : ''}
        
        <div class="nac-publish-info" id="nac-publish-info"></div>
        
        <div class="nac-form-group">
          <label>Relays</label>
          <div class="nac-relay-list">
            ${relayConfig.relays.filter(r => r.enabled).map(r => `
              <label class="nac-checkbox">
                <input type="checkbox" checked value="${r.url}">
                <span>${r.url}</span>
              </label>
            `).join('')}
          </div>
        </div>
        
        <div class="nac-form-group">
          <label>Event Preview</label>
          <pre class="nac-event-preview" id="nac-event-preview">Building event...</pre>
        </div>
        
        <button class="nac-btn nac-btn-primary" id="nac-publish-confirm" ${!identity ? 'disabled' : ''}>
          Publish Article
        </button>
        
        <div id="nac-publish-status" class="nac-publish-status"></div>
      </div>
    `;
    
    ReaderView.container.appendChild(panel);
    
    // Build event preview
    const event = await EventBuilder.buildArticleEvent(
      ReaderView.article,
      ReaderView.entities,
      identity?.pubkey,
      ReaderView.claims
    );
    const eventJson = JSON.stringify(event, null, 2);
    const eventSizeKB = (new TextEncoder().encode(JSON.stringify(event)).length / 1024).toFixed(1);
    const sizeWarning = eventSizeKB > 64 ? ` ⚠️ Large event (${eventSizeKB} KB) — some relays may reject` : '';
    document.getElementById('nac-event-preview').textContent = `[Event size: ${eventSizeKB} KB${sizeWarning}]\n\n${eventJson}`;

    // Show publish info with claim/crux/evidence link counts
    const claimCount = (ReaderView.claims || []).length;
    const cruxCount = (ReaderView.claims || []).filter(c => c.is_crux).length;
    // Count evidence links for current article's claims
    let evidenceLinkCount = 0;
    try {
      const claimIds = (ReaderView.claims || []).map(c => c.id);
      const allLinks = await Storage.evidenceLinks.getAll();
      const articleLinks = Object.values(allLinks).filter(
        l => claimIds.includes(l.source_claim_id) || claimIds.includes(l.target_claim_id)
      );
      evidenceLinkCount = articleLinks.length;
    } catch (e) { /* ignore */ }
    const infoEl = document.getElementById('nac-publish-info');
    if (infoEl) {
      const commentCount = (ReaderView.capturedComments || []).length;
      const commentMsg = commentCount > 0 ? ` + ${commentCount} comment${commentCount !== 1 ? 's' : ''}` : '';
      if (claimCount > 0) {
        const linkMsg = evidenceLinkCount > 0 ? ` + ${evidenceLinkCount} evidence link${evidenceLinkCount !== 1 ? 's' : ''}` : '';
        infoEl.innerHTML = `📋 Article + ${claimCount} claim${claimCount !== 1 ? 's' : ''} (${cruxCount} crux${cruxCount !== 1 ? 'es' : ''})${linkMsg}${commentMsg} will be published`;
      } else {
        infoEl.innerHTML = `📋 Article will be published${commentMsg}${commentCount === 0 ? ' (no claims)' : ''}`;
      }
    }
    
    // Event listeners
    document.getElementById('nac-close-publish').addEventListener('click', ReaderView.hidePublishPanel);
    document.getElementById('nac-publish-confirm').addEventListener('click', ReaderView.publishArticle);

    // Focus the panel
    panel.focus();
  },

  // Hide publish panel
  hidePublishPanel: () => {
    const panel = document.getElementById('nac-publish-panel');
    if (panel) panel.remove();

    // Return focus to the element that opened the panel
    if (ReaderView._publishOpener && ReaderView._publishOpener.focus) {
      ReaderView._publishOpener.focus();
      ReaderView._publishOpener = null;
    }
  },

  // Publish article to NOSTR
  publishArticle: async () => {
    const statusEl = document.getElementById('nac-publish-status');
    const btn = document.getElementById('nac-publish-confirm');
    
    btn.disabled = true;
    btn.textContent = 'Publishing...';
    statusEl.innerHTML = '<div class="nac-spinner"></div> Publishing to relays...';
    
    try {
      const identity = await Storage.identity.get();
      const signingMethod = document.getElementById('nac-signing-method').value;
      
      // Build event
      const event = await EventBuilder.buildArticleEvent(
        ReaderView.article,
        ReaderView.entities,
        identity.pubkey,
        ReaderView.claims
      );
      
      // Sign event
      let signedEvent;
      if (signingMethod === 'nip07') {
        if (!unsafeWindow.nostr) {
          throw new Error('NIP-07 extension not found');
        }
        signedEvent = await unsafeWindow.nostr.signEvent(event);
      } else {
        if (!identity.privkey) {
          throw new Error('No private key available');
        }
        signedEvent = await Crypto.signEvent(event, identity.privkey);
      }
      
      // Validate signed event
      if (!signedEvent) {
        throw new Error('Event signing failed — no signed event returned. Check your private key or NIP-07 extension.');
      }
      
      // Verify our own signature before sending to relays (catch signing bugs early)
      if (signingMethod === 'local') {
        const selfVerify = await Crypto.verifySignature(signedEvent);
        if (!selfVerify) {
          throw new Error('Self-verification failed — signature did not pass BIP-340 verification. This is a signing bug.');
        }
      }
      
      // Check event size — most relays reject events larger than ~64-512 KB
      const eventJson = JSON.stringify(signedEvent);
      const eventSizeKB = new TextEncoder().encode(eventJson).length / 1024;
      if (eventSizeKB > 512) {
        throw new Error(`Event too large (${eventSizeKB.toFixed(0)} KB). Most relays reject events over 64-512 KB. Try removing images or shortening the article.`);
      } else if (eventSizeKB > 64) {
        console.warn(`[NAC] Event is ${eventSizeKB.toFixed(0)} KB — some relays may reject events this large.`);
      }
      
      // Get selected relays
      const relayCheckboxes = document.querySelectorAll('.nac-relay-list input[type="checkbox"]:checked');
      const relayUrls = Array.from(relayCheckboxes).map(cb => cb.value);
      
      // Publish article to relays
      const results = await RelayClient.publish(signedEvent, relayUrls);
      
      // Show article results
      let successCount = 0;
      let html = '<div class="nac-publish-results"><strong>Article:</strong>';
      for (const [url, result] of Object.entries(results)) {
        if (result.success) {
          successCount++;
          html += `<div class="nac-result-success">✓ ${url}</div>`;
        } else {
          html += `<div class="nac-result-error">✗ ${url}: ${result.error}</div>`;
        }
      }
      html += '</div>';
      
      // Load entity registry for claim enrichment and relationship publishing
      const entityRegistry = await Storage.entities.getAll();

      // Publish each claim as kind 30040
      const claims = ReaderView.claims || [];
      let claimSuccessCount = 0;
      if (claims.length > 0) {
        statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${claims.length} claim${claims.length !== 1 ? 's' : ''}...`;
        
        for (let i = 0; i < claims.length; i++) {
          const claim = claims[i];
          try {
            const claimEvent = EventBuilder.buildClaimEvent(
              claim,
              ReaderView.article.url,
              ReaderView.article.title || 'Untitled',
              identity.pubkey,
              entityRegistry
            );
            
            let signedClaim;
            if (signingMethod === 'nip07') {
              signedClaim = await unsafeWindow.nostr.signEvent(claimEvent);
            } else {
              signedClaim = await Crypto.signEvent(claimEvent, identity.privkey);
            }
            
            if (signedClaim) {
              const claimResults = await RelayClient.publish(signedClaim, relayUrls);
              const claimOk = Object.values(claimResults).some(r => r.success);
              if (claimOk) claimSuccessCount++;
            }
          } catch (ce) {
            console.error(`[NAC] Claim publish error (${claim.id}):`, ce);
          }
        }
        
        html += `<div class="nac-publish-results"><strong>Claims:</strong> ${claimSuccessCount}/${claims.length} published</div>`;
      }
      
      // Publish evidence links as kind 30043
      const claimIds = claims.map(c => c.id);
      let evidenceLinkSuccessCount = 0;
      let evidenceLinksTotal = 0;
      try {
        const allLinks = await Storage.evidenceLinks.getAll();
        const allClaims = await Storage.claims.getAll();
        const articleLinks = Object.values(allLinks).filter(
          l => claimIds.includes(l.source_claim_id) || claimIds.includes(l.target_claim_id)
        );
        evidenceLinksTotal = articleLinks.length;

        if (articleLinks.length > 0) {
          statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${articleLinks.length} evidence link${articleLinks.length !== 1 ? 's' : ''}...`;

          for (const link of articleLinks) {
            try {
              const linkEvent = await EventBuilder.buildEvidenceLinkEvent(link, allClaims, identity.pubkey);

              let signedLink;
              if (signingMethod === 'nip07') {
                signedLink = await unsafeWindow.nostr.signEvent(linkEvent);
              } else {
                signedLink = await Crypto.signEvent(linkEvent, identity.privkey);
              }

              if (signedLink) {
                const linkResults = await RelayClient.publish(signedLink, relayUrls);
                const linkOk = Object.values(linkResults).some(r => r.success);
                if (linkOk) evidenceLinkSuccessCount++;
              }
            } catch (le) {
              console.error(`[NAC] Evidence link publish error (${link.id}):`, le);
            }
          }

          html += `<div class="nac-publish-results"><strong>Evidence Links:</strong> ${evidenceLinkSuccessCount}/${articleLinks.length} published</div>`;
        }
      } catch (e) {
        console.error('[NAC] Evidence links publish error:', e);
      }

      // Publish entity relationships as kind 32125
      let entityRelSuccessCount = 0;
      let entityRelTotal = 0;
      try {
        const relEvents = [];
        const articleUrl = ReaderView.article.url;

        // Article-level entity relationships (author, mentioned, publication)
        for (const ref of (ReaderView.entities || [])) {
          const entity = entityRegistry[ref.entity_id];
          if (entity && entity.keypair) {
            relEvents.push(EventBuilder.buildEntityRelationshipEvent(entity, articleUrl, ref.context || 'mentioned', identity.pubkey, null));
          }
        }

        // Claim-level entity relationships (claimant, subject)
        for (const claim of claims) {
          if (claim.claimant_entity_id) {
            const claimant = entityRegistry[claim.claimant_entity_id];
            if (claimant && claimant.keypair) {
              relEvents.push(EventBuilder.buildEntityRelationshipEvent(claimant, articleUrl, 'claimant', identity.pubkey, claim.id));
            }
          }
          for (const sid of (claim.subject_entity_ids || [])) {
            const subject = entityRegistry[sid];
            if (subject && subject.keypair) {
              relEvents.push(EventBuilder.buildEntityRelationshipEvent(subject, articleUrl, 'subject', identity.pubkey, claim.id));
            }
          }
          for (const oid of (claim.object_entity_ids || [])) {
            const obj = entityRegistry[oid];
            if (obj && obj.keypair) {
              relEvents.push(EventBuilder.buildEntityRelationshipEvent(obj, articleUrl, 'object', identity.pubkey, claim.id));
            }
          }
        }

        entityRelTotal = relEvents.length;

        if (relEvents.length > 0) {
          statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${relEvents.length} entity relationship${relEvents.length !== 1 ? 's' : ''}...`;

          for (const relEvent of relEvents) {
            try {
              let signedRel;
              if (signingMethod === 'nip07') {
                signedRel = await unsafeWindow.nostr.signEvent(relEvent);
              } else {
                signedRel = await Crypto.signEvent(relEvent, identity.privkey);
              }

              if (signedRel) {
                const relResults = await RelayClient.publish(signedRel, relayUrls);
                const relOk = Object.values(relResults).some(r => r.success);
                if (relOk) entityRelSuccessCount++;
              }
            } catch (re) {
              console.error('[NAC] Entity relationship publish error:', re);
            }
          }

          html += `<div class="nac-publish-results"><strong>Entity Relationships:</strong> ${entityRelSuccessCount}/${relEvents.length} published</div>`;
        }
      } catch (e) {
        console.error('[NAC] Entity relationships publish error:', e);
      }

      // Publish captured comments as kind 30041 + platform accounts as kind 32126
      const capturedComments = ReaderView.capturedComments || [];
      let commentSuccessCount = 0;
      let platformAccountSuccessCount = 0;
      const publishedAccountIds = new Set();
      
      if (capturedComments.length > 0) {
        try {
          statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${capturedComments.length} comment${capturedComments.length !== 1 ? 's' : ''}...`;
          
          for (const comment of capturedComments) {
            try {
              // Get the platform account for this comment's author
              const account = await PlatformAccount.get(comment.authorAccountId);
              const accountPubkey = account?.keypair?.pubkey || null;

              // Publish platform account if not already published
              if (account && !publishedAccountIds.has(account.id)) {
                try {
                  const acctEvent = EventBuilder.buildPlatformAccountEvent(account, identity.pubkey);
                  let signedAcct;
                  if (signingMethod === 'nip07') {
                    signedAcct = await unsafeWindow.nostr.signEvent(acctEvent);
                  } else {
                    signedAcct = await Crypto.signEvent(acctEvent, identity.privkey);
                  }
                  if (signedAcct) {
                    const acctResults = await RelayClient.publish(signedAcct, relayUrls);
                    const acctOk = Object.values(acctResults).some(r => r.success);
                    if (acctOk) platformAccountSuccessCount++;
                    publishedAccountIds.add(account.id);
                  }
                } catch (ae) {
                  console.error(`[NAC] Platform account publish error (${account.id}):`, ae);
                }
              }

              // Publish comment event
              const commentEvent = EventBuilder.buildCommentEvent(
                comment,
                ReaderView.article.url,
                ReaderView.article.title || 'Untitled',
                identity.pubkey,
                accountPubkey
              );
              
              let signedComment;
              if (signingMethod === 'nip07') {
                signedComment = await unsafeWindow.nostr.signEvent(commentEvent);
              } else {
                signedComment = await Crypto.signEvent(commentEvent, identity.privkey);
              }
              
              if (signedComment) {
                const commentResults = await RelayClient.publish(signedComment, relayUrls);
                const commentOk = Object.values(commentResults).some(r => r.success);
                if (commentOk) commentSuccessCount++;
              }
            } catch (ce) {
              console.error(`[NAC] Comment publish error (${comment.id}):`, ce);
            }
          }
          
          html += `<div class="nac-publish-results"><strong>Comments:</strong> ${commentSuccessCount}/${capturedComments.length} published</div>`;
          if (publishedAccountIds.size > 0) {
            html += `<div class="nac-publish-results"><strong>Platform Accounts:</strong> ${platformAccountSuccessCount}/${publishedAccountIds.size} published</div>`;
          }
        } catch (e) {
          console.error('[NAC] Comments publish error:', e);
        }
      }
      
      statusEl.innerHTML = html;
      
      if (successCount > 0) {
        const claimMsg = claims.length > 0 ? ` ${claimSuccessCount} claim${claimSuccessCount !== 1 ? 's' : ''} published.` : '';
        const linkMsg = evidenceLinksTotal > 0 ? ` ${evidenceLinkSuccessCount} evidence link${evidenceLinkSuccessCount !== 1 ? 's' : ''} published.` : '';
        const relMsg = entityRelTotal > 0 ? ` ${entityRelSuccessCount} entity relationship${entityRelSuccessCount !== 1 ? 's' : ''} published.` : '';
        const commentMsg = capturedComments.length > 0 ? ` ${commentSuccessCount} comment${commentSuccessCount !== 1 ? 's' : ''} published.` : '';
        btn.textContent = `Published to ${successCount} relay${successCount > 1 ? 's' : ''}`;
        Utils.showToast(`Article published to ${successCount} relay${successCount > 1 ? 's' : ''}.${claimMsg}${linkMsg}${relMsg}${commentMsg}`, 'success');
      } else {
        btn.textContent = 'Publish Failed';
        btn.disabled = false;
        Utils.showToast('Failed to publish to any relay', 'error');
      }
    } catch (e) {
      console.error('[NAC] Publish error:', e);
      statusEl.innerHTML = `<div class="nac-error">Error: ${e.message}</div>`;
      btn.textContent = 'Publish Failed';
      btn.disabled = false;
      Utils.showToast('Failed to publish article', 'error');
    }
  },

  // Hide settings panel
  hideSettings: () => {
    const panel = document.getElementById('nac-settings-panel');
    if (panel) panel.remove();

    // Return focus to the element that opened the panel
    if (ReaderView._settingsOpener && ReaderView._settingsOpener.focus) {
      ReaderView._settingsOpener.focus();
      ReaderView._settingsOpener = null;
    }
  },

  // Show settings panel
  showSettings: async () => {
    // Remove existing settings panel if present (for refresh)
    document.getElementById('nac-settings-panel')?.remove();

    // Remember which element opened the panel for focus return
    ReaderView._settingsOpener = document.activeElement;

    const identity = await Storage.identity.get();
    const relayConfig = await Storage.relays.get();
    
    const panel = document.createElement('div');
    panel.id = 'nac-settings-panel';
    panel.className = 'nac-settings-panel';
    panel.setAttribute('tabindex', '-1');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Settings');
    
    panel.innerHTML = `
      <div class="nac-publish-header">
        <h3>Settings</h3>
        <button class="nac-btn-close" id="nac-close-settings" aria-label="Close settings">×</button>
      </div>
      
      <div class="nac-publish-body">
        <h4>User Identity</h4>
        ${identity ? `
          <div class="nac-identity-info">
            <div><strong>Public Key:</strong> ${identity.npub || identity.pubkey}</div>
            <div><strong>Signer:</strong> ${identity.signer_type}</div>
            <button class="nac-btn" id="nac-clear-identity">Clear Identity</button>
            ${identity.privkey ? `
            <div style="margin-top: 8px;">
              <button id="nac-show-nsec" style="padding: 4px 8px; background: #333; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 4px;">👁 Show nsec</button>
              <button id="nac-copy-nsec" style="padding: 4px 8px; background: #333; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">📋 Copy nsec</button>
              <div id="nac-nsec-display" style="display: none; margin-top: 6px; padding: 6px; background: #1a1a2e; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 10px; word-break: break-all; color: #ff6b6b;"></div>
              <div style="font-size: 10px; color: #888; margin-top: 4px;">⚠ Copy your nsec to import on another browser for entity sync.</div>
            </div>
            ` : ''}
          </div>
        ` : `
          <div>
            <button class="nac-btn" id="nac-connect-nip07">Connect NIP-07</button>
            <button class="nac-btn" id="nac-generate-keypair">Generate New Keypair</button>
            <div style="margin-top: 12px; border-top: 1px solid #444; padding-top: 12px;">
              <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">── or import existing ──</div>
              <input type="text" id="nac-nsec-input" placeholder="nsec1..."
                style="width: 100%; padding: 6px 8px; background: #1a1a2e; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 11px; margin-bottom: 8px; box-sizing: border-box;">
              <button id="nac-import-nsec" style="width: 100%; padding: 8px; background: #2d5a27; color: white; border: none; border-radius: 4px; cursor: pointer;">🔑 Import Private Key</button>
              <div style="font-size: 10px; color: #888; margin-top: 6px;">⚠ Your nsec is stored locally in Tampermonkey storage. It never leaves your browser unencrypted.</div>
            </div>
          </div>
        `}
        
        <h4>Relays</h4>
        <div class="nac-relay-list">
          ${relayConfig.relays.map((r, i) => `
            <div class="nac-relay-item${r.enabled ? '' : ' nac-relay-disabled'}" data-relay-index="${i}">
              <label class="nac-checkbox" style="flex: 1; min-width: 0;">
                <input type="checkbox" ${r.enabled ? 'checked' : ''} data-index="${i}">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Utils.escapeHtml(r.url)}</span>
              </label>
              <button class="nac-relay-remove" data-relay-url="${Utils.escapeHtml(r.url)}" title="Remove relay" aria-label="Remove relay ${Utils.escapeHtml(r.url)}">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="nac-btn" id="nac-add-relay">Add Relay</button>
        
        <h4>Entity Registry</h4>
        <div id="nac-entity-browser"></div>
        
        <div id="nac-storage-usage" style="margin-top: 16px; padding: 10px; background: #1a1a2e; border: 1px solid #333; border-radius: 6px; font-size: 11px; color: #aaa;">
          <span style="color: #888;">Calculating storage usage...</span>
        </div>
        <div style="margin-top: 8px;">
          <button class="nac-btn" id="nac-storage-cleanup" style="font-size: 11px; padding: 4px 10px;">🧹 Storage Cleanup</button>
        </div>
        
        <div class="nac-version">Version ${CONFIG.version}</div>
      </div>
    `;
    
    ReaderView.container.appendChild(panel);
    
    // Event listeners
    document.getElementById('nac-close-settings').addEventListener('click', ReaderView.hideSettings);

    // Focus the settings panel
    panel.focus();
    
    if (identity) {
      document.getElementById('nac-clear-identity').addEventListener('click', async () => {
        await Storage.identity.clear();
        panel.remove();
        Utils.showToast('Identity cleared');
      });

      // nsec show/copy handlers (only when identity has privkey)
      if (identity.privkey) {
        document.getElementById('nac-show-nsec')?.addEventListener('click', () => {
          const display = document.getElementById('nac-nsec-display');
          if (display.style.display === 'none') {
            display.textContent = identity.nsec || Crypto.hexToNsec(identity.privkey) || 'nsec not available';
            display.style.display = 'block';
            document.getElementById('nac-show-nsec').textContent = '🙈 Hide nsec';
          } else {
            display.style.display = 'none';
            display.textContent = '';
            document.getElementById('nac-show-nsec').textContent = '👁 Show nsec';
          }
        });
        document.getElementById('nac-copy-nsec')?.addEventListener('click', async () => {
          const nsec = identity.nsec || Crypto.hexToNsec(identity.privkey) || '';
          if (nsec) {
            await navigator.clipboard.writeText(nsec);
            const btn = document.getElementById('nac-copy-nsec');
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = '📋 Copy nsec', 2000);
          }
        });
      }
    } else {
      document.getElementById('nac-connect-nip07')?.addEventListener('click', async () => {
        if (unsafeWindow.nostr) {
          const pubkey = await unsafeWindow.nostr.getPublicKey();
          await Storage.identity.set({
            pubkey,
            npub: Crypto.hexToNpub(pubkey),
            signer_type: 'nip07',
            created_at: Math.floor(Date.now() / 1000)
          });
          panel.remove();
          Utils.showToast('Connected via NIP-07');
        } else {
          Utils.showToast('NIP-07 extension not found', 'error');
        }
      });
      
      document.getElementById('nac-generate-keypair')?.addEventListener('click', async () => {
        const privkey = Crypto.generatePrivateKey();
        const pubkey = Crypto.getPublicKey(privkey);
        await Storage.identity.set({
          pubkey,
          privkey,
          npub: Crypto.hexToNpub(pubkey),
          nsec: Crypto.hexToNsec(privkey),
          signer_type: 'local',
          created_at: Math.floor(Date.now() / 1000)
        });
        panel.remove();
        Utils.showToast('New keypair generated');
      });

      // Import nsec handler
      document.getElementById('nac-import-nsec')?.addEventListener('click', async () => {
        const nsecInput = document.getElementById('nac-nsec-input')?.value?.trim();
        if (!nsecInput || !nsecInput.startsWith('nsec1')) {
          alert('Invalid nsec format. Must start with nsec1...');
          return;
        }
        try {
          const privkeyHex = Crypto.nsecToHex(nsecInput);
          if (!privkeyHex || privkeyHex.length !== 64) throw new Error('Invalid nsec');
          const pubkey = Crypto.getPublicKey(privkeyHex);
          await Storage.identity.set({
            pubkey,
            privkey: privkeyHex,
            npub: Crypto.hexToNpub(pubkey),
            nsec: nsecInput,
            signer_type: 'local',
            created_at: Math.floor(Date.now() / 1000)
          });
          ReaderView.showSettings(); // Refresh
        } catch (e) {
          alert('Failed to import nsec: ' + e.message);
        }
      });
    }
    
    // Relay checkboxes (enable/disable toggle with visual feedback)
    document.querySelectorAll('.nac-relay-item input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const index = parseInt(e.target.dataset.index);
        relayConfig.relays[index].enabled = e.target.checked;
        await Storage.relays.set(relayConfig);
        const item = e.target.closest('.nac-relay-item');
        if (item) {
          item.classList.toggle('nac-relay-disabled', !e.target.checked);
        }
      });
    });

    // Add Relay button
    document.getElementById('nac-add-relay')?.addEventListener('click', async () => {
      const url = prompt('Enter relay WebSocket URL (e.g., wss://relay.damus.io):');
      if (!url) return;
      const trimmed = url.trim();
      if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
        Utils.showToast('Invalid URL — must start with wss:// or ws://', 'error');
        return;
      }
      const currentConfig = await Storage.relays.get();
      if (currentConfig.relays.find(r => r.url === trimmed)) {
        Utils.showToast('Relay already in the list', 'error');
        return;
      }
      await Storage.relays.addRelay(trimmed);
      Utils.showToast('Relay added: ' + trimmed, 'success');
      ReaderView.showSettings(); // Refresh settings panel
    });

    // Relay remove buttons
    document.querySelectorAll('.nac-relay-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const url = e.target.dataset.relayUrl;
        if (!url) return;
        await Storage.relays.removeRelay(url);
        Utils.showToast('Relay removed: ' + url, 'success');
        ReaderView.showSettings(); // Refresh settings panel
      });
    });
    
    // Initialize entity browser UI
    await EntityBrowser.init(panel, identity);

    // Populate storage usage display
    try {
      const usage = await Storage.getUsageEstimate();
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      };
      const totalKB = usage.totalBytes / 1024;
      let color = '#4caf50'; // green
      let label = '';
      if (totalKB >= 5120) {
        color = '#f44336'; // red
        label = ' — ⚠ Very large, may impact performance';
      } else if (totalKB >= 1024) {
        color = '#ff9800'; // yellow/orange
        label = ' — Growing large';
      }
      const el = document.getElementById('nac-storage-usage');
      if (el) {
        el.innerHTML = `<strong style="color: ${color};">Storage: ~${formatSize(usage.totalBytes)}</strong>${label}<br>` +
          `<span style="font-size: 10px;">` +
          `Entities: ${formatSize(usage.breakdown.entities)}, ` +
          `Claims: ${formatSize(usage.breakdown.claims)}, ` +
          `Evidence: ${formatSize(usage.breakdown.evidenceLinks)}, ` +
          `Comments: ${formatSize(usage.breakdown.comments)}, ` +
          `Accounts: ${formatSize(usage.breakdown.platformAccounts)}, ` +
          `Identity: ${formatSize(usage.breakdown.identity)}, ` +
          `Relays: ${formatSize(usage.breakdown.relays)}</span>`;
      }
    } catch (e) {
      console.error('[NAC] Failed to calculate storage usage:', e);
    }

    // Storage cleanup button
    document.getElementById('nac-storage-cleanup')?.addEventListener('click', async () => {
      const usage = await Storage.getUsageEstimate();
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      };

      const claims = await Storage.claims.getAll();
      const claimCount = Object.keys(claims).length;
      const evidence = await Storage.evidenceLinks.getAll();
      const evidenceCount = Object.keys(evidence).length;
      const entities = await Storage.entities.getAll();
      const entityCount = Object.keys(entities).length;

      // Count article references across all entities
      let totalArticleRefs = 0;
      for (const entity of Object.values(entities)) {
        if (Array.isArray(entity.articles)) totalArticleRefs += entity.articles.length;
      }

      const msg = `Storage Cleanup\n\n` +
        `Total: ${formatSize(usage.totalBytes)}\n` +
        `• Entities: ${entityCount} (${formatSize(usage.breakdown.entities)})\n` +
        `  - ${totalArticleRefs} article references\n` +
        `• Claims: ${claimCount} (${formatSize(usage.breakdown.claims)})\n` +
        `• Evidence Links: ${evidenceCount} (${formatSize(usage.breakdown.evidenceLinks)})\n\n` +
        `Options:\n` +
        `1. Compact entities (trim article lists to 10 per entity)\n` +
        `2. Clear all claims\n` +
        `3. Clear all evidence links\n` +
        `4. Cancel\n\n` +
        `Enter option (1-4):`;

      const choice = prompt(msg);
      if (!choice) return;

      switch (choice.trim()) {
        case '1': {
          let trimmed = 0;
          for (const [id, entity] of Object.entries(entities)) {
            if (Array.isArray(entity.articles) && entity.articles.length > 10) {
              const before = entity.articles.length;
              entity.articles = entity.articles
                .sort((a, b) => (b.tagged_at || 0) - (a.tagged_at || 0))
                .slice(0, 10);
              trimmed += before - entity.articles.length;
            }
          }
          await Storage.set('entity_registry', entities);
          Utils.showToast(`Compacted entities: removed ${trimmed} old article references`, 'success');
          break;
        }
        case '2': {
          if (confirm(`Delete all ${claimCount} claims? This cannot be undone.`)) {
            await Storage.set('article_claims', {});
            Utils.showToast(`Cleared ${claimCount} claims`, 'success');
          }
          break;
        }
        case '3': {
          if (confirm(`Delete all ${evidenceCount} evidence links? This cannot be undone.`)) {
            await Storage.set('evidence_links', {});
            Utils.showToast(`Cleared ${evidenceCount} evidence links`, 'success');
          }
          break;
        }
        default:
          break;
      }
      // Refresh storage display
      ReaderView.showSettings();
    });
  }
};
