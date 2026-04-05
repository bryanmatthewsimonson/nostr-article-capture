import { ContentDetector } from './content-detector.js';
import { PendingCaptures } from './pending-captures.js';
import { Storage } from './storage.js';
import { RelayClient } from './relay-client.js';
import { EventBuilder } from './event-builder.js';
import { Utils } from './utils.js';

/**
 * Shadow-DOM-isolated right-side panel for capturing social media content.
 * Used on CSP-restricted platforms (Facebook, Instagram, TikTok) where
 * full-page reader view is hostile and relay connections may be blocked.
 */
export const CapturePanel = {
  _panelHost: null,
  _shadow: null,
  _isOpen: false,
  _capturedBlocks: [],   // Array of { text, label, timestamp }
  _article: null,        // The article data object being built

  /**
   * Open the capture panel for the given article data.
   * Creates a Shadow DOM host and renders the panel UI.
   * @param {object} article - Initial article metadata
   */
  open: (article) => {
    if (CapturePanel._isOpen) {
      console.log('[NAC CapturePanel] Already open, focusing');
      return;
    }

    CapturePanel._article = article || {};
    CapturePanel._capturedBlocks = [];
    CapturePanel._isOpen = true;

    // Create Shadow DOM host
    const panelHost = document.createElement('div');
    panelHost.id = 'nac-panel-host';
    panelHost.style.cssText = 'position:fixed!important;top:0!important;right:0!important;bottom:0!important;width:350px!important;z-index:2147483646!important;pointer-events:auto!important;';
    document.body.appendChild(panelHost);

    const shadow = panelHost.attachShadow({ mode: 'closed' });
    CapturePanel._panelHost = panelHost;
    CapturePanel._shadow = shadow;

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = CAPTURE_PANEL_CSS;
    shadow.appendChild(styleEl);

    // Render panel
    CapturePanel._render();

    console.log('[NAC CapturePanel] Opened for', article.platform || 'unknown platform');
  },

  /**
   * Close and clean up the panel.
   */
  close: () => {
    if (CapturePanel._panelHost) {
      CapturePanel._panelHost.remove();
    }
    CapturePanel._panelHost = null;
    CapturePanel._shadow = null;
    CapturePanel._isOpen = false;
    CapturePanel._capturedBlocks = [];
    CapturePanel._article = null;
    console.log('[NAC CapturePanel] Closed');
  },

  /**
   * Add the current window text selection as a content block.
   * Since the panel is in Shadow DOM, page selections are not interfered with.
   */
  addSelection: () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    if (!text || text.length < 3) {
      CapturePanel._setStatus('⚠️ Select text on the page first', 'warn');
      return;
    }

    CapturePanel.addBlock(text, 'Selection ' + (CapturePanel._capturedBlocks.length + 1));
    // Don't clear the selection — user may want to keep it visible
  },

  /**
   * Programmatically add a text block with a label.
   * @param {string} text - The text content
   * @param {string} [label] - Block label (e.g. "Selected text", "Comment")
   */
  addBlock: (text, label) => {
    if (!text || !text.trim()) return;

    CapturePanel._capturedBlocks.push({
      text: text.trim(),
      label: label || 'Selection ' + (CapturePanel._capturedBlocks.length + 1),
      timestamp: Date.now()
    });

    CapturePanel._renderContentBlocks();
    CapturePanel._setStatus('✓ Added: ' + (text.substring(0, 40)) + '...', 'success');
    console.log('[NAC CapturePanel] Block added, total:', CapturePanel._capturedBlocks.length);
  },

  /**
   * Remove a content block by index.
   * @param {number} index
   */
  removeBlock: (index) => {
    if (index >= 0 && index < CapturePanel._capturedBlocks.length) {
      CapturePanel._capturedBlocks.splice(index, 1);
      CapturePanel._renderContentBlocks();
      CapturePanel._setStatus('Block removed', 'info');
    }
  },

  /**
   * Render the full panel HTML into the shadow root.
   */
  _render: () => {
    const shadow = CapturePanel._shadow;
    if (!shadow) return;

    const article = CapturePanel._article || {};
    const url = article.url || window.location.href;
    const platform = article.platform || 'unknown';
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const platformIcon = ContentDetector.getPlatformIcon(platform);

    const panel = document.createElement('div');
    panel.className = 'nac-capture-panel';
    panel.innerHTML = `
      <!-- Toolbar -->
      <div class="nac-cp-toolbar">
        <span class="nac-cp-title">📌 Capture</span>
        <button class="nac-cp-btn" id="nac-cp-settings">⚙</button>
        <button class="nac-cp-btn" id="nac-cp-save">💾 Save</button>
        <button class="nac-cp-btn nac-cp-publish" id="nac-cp-publish">📤 Publish</button>
        <button class="nac-cp-btn" id="nac-cp-close">✕</button>
      </div>

      <!-- Metadata -->
      <div class="nac-cp-metadata">
        <div class="nac-cp-field">
          <label>URL</label>
          <input type="text" id="nac-cp-url" value="${CapturePanel._escAttr(url)}" readonly>
        </div>
        <div class="nac-cp-field">
          <label>Platform</label>
          <span class="nac-cp-platform-badge">${platformIcon} ${platformName}</span>
        </div>
        <div class="nac-cp-field">
          <label>Author/Account</label>
          <input type="text" id="nac-cp-author" placeholder="Enter author name or @handle" value="${CapturePanel._escAttr(article.byline || '')}">
        </div>
      </div>

      <!-- Captured Content Blocks -->
      <div class="nac-cp-content" id="nac-cp-content">
        <!-- Blocks rendered dynamically -->
      </div>

      <!-- Add Selection Button -->
      <div class="nac-cp-actions">
        <button class="nac-cp-add-selection" id="nac-cp-add">
          ✚ Add Selected Text
        </button>
        <div class="nac-cp-hint">Select text on the page, then click above</div>
      </div>

      <!-- Entity Chips (miniaturized) -->
      <div class="nac-cp-entities" id="nac-cp-entities"></div>

      <!-- Claims (miniaturized) -->
      <div class="nac-cp-claims" id="nac-cp-claims"></div>

      <!-- Status -->
      <div class="nac-cp-status" id="nac-cp-status"></div>
    `;

    shadow.appendChild(panel);

    // Wire event handlers
    CapturePanel._wireEvents(panel);

    // Render initial content blocks (if any were pre-added)
    CapturePanel._renderContentBlocks();
  },

  /**
   * Wire up all panel button event handlers.
   * @param {HTMLElement} panel - The panel root element
   */
  _wireEvents: (panel) => {
    // Close button
    const closeBtn = panel.querySelector('#nac-cp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => CapturePanel.close());
    }

    // Add selection button
    const addBtn = panel.querySelector('#nac-cp-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => CapturePanel.addSelection());
    }

    // Save button
    const saveBtn = panel.querySelector('#nac-cp-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => CapturePanel.save());
    }

    // Publish button
    const publishBtn = panel.querySelector('#nac-cp-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', () => CapturePanel.publish());
    }

    // Settings button (placeholder — opens reader view settings in future)
    const settingsBtn = panel.querySelector('#nac-cp-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        CapturePanel._setStatus('Settings coming soon', 'info');
      });
    }
  },

  /**
   * Re-render just the content blocks area.
   */
  _renderContentBlocks: () => {
    const shadow = CapturePanel._shadow;
    if (!shadow) return;

    const contentArea = shadow.querySelector('#nac-cp-content');
    if (!contentArea) return;

    if (CapturePanel._capturedBlocks.length === 0) {
      contentArea.innerHTML = `
        <div class="nac-cp-empty">
          <div style="font-size:24px;margin-bottom:8px;">📋</div>
          <div>No content captured yet</div>
          <div style="font-size:11px;color:#666;margin-top:4px;">Select text on the page and click "✚ Add Selected Text"</div>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = CapturePanel._capturedBlocks.map((block, i) => `
      <div class="nac-cp-block" data-index="${i}">
        <div class="nac-cp-block-header">
          <span class="nac-cp-block-label">${CapturePanel._esc(block.label || 'Selection ' + (i + 1))}</span>
          <button class="nac-cp-block-remove" data-index="${i}">✕</button>
        </div>
        <div class="nac-cp-block-text" contenteditable="true">${CapturePanel._esc(block.text)}</div>
      </div>
    `).join('');

    // Wire remove buttons
    contentArea.querySelectorAll('.nac-cp-block-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        CapturePanel.removeBlock(idx);
      });
    });

    // Wire contenteditable blocks to sync changes back
    contentArea.querySelectorAll('.nac-cp-block-text').forEach((el, i) => {
      el.addEventListener('blur', () => {
        if (CapturePanel._capturedBlocks[i]) {
          CapturePanel._capturedBlocks[i].text = el.textContent.trim();
        }
      });
    });
  },

  /**
   * Build the article data object from current panel state.
   * Compiles captured blocks into an article object compatible with EventBuilder.
   * @returns {object} Article data
   */
  _buildArticleData: () => {
    const article = CapturePanel._article || {};
    const shadow = CapturePanel._shadow;

    // Read author from input
    const authorInput = shadow ? shadow.querySelector('#nac-cp-author') : null;
    const author = authorInput ? authorInput.value.trim() : (article.byline || '');

    // Compile text from all blocks
    const allText = CapturePanel._capturedBlocks.map(b => b.text).join('\n\n');

    // Build HTML content from blocks
    const contentHtml = CapturePanel._capturedBlocks.map(b => {
      const label = CapturePanel._esc(b.label || 'Selection');
      const text = CapturePanel._esc(b.text).replace(/\n/g, '<br>');
      return `<section><h3>${label}</h3><p>${text}</p></section>`;
    }).join('\n');

    // Generate a title from first block or URL
    const firstText = CapturePanel._capturedBlocks.length > 0
      ? CapturePanel._capturedBlocks[0].text
      : '';
    const title = firstText
      ? firstText.substring(0, 80) + (firstText.length > 80 ? '...' : '')
      : (article.platform || 'Social') + ' capture from ' + (article.domain || window.location.hostname);

    return {
      url: article.url || window.location.href,
      platform: article.platform || null,
      contentType: article.contentType || 'social_post',
      title: title,
      byline: author,
      content: contentHtml,
      textContent: allText,
      domain: article.domain || window.location.hostname,
      siteName: article.siteName || (article.platform ? article.platform.charAt(0).toUpperCase() + article.platform.slice(1) : window.location.hostname),
      publishedAt: article.publishedAt || Math.floor(Date.now() / 1000),
      featuredImage: article.featuredImage || '',
      publicationIcon: article.publicationIcon || '',
      platformAccount: article.platformAccount || null,
      wordCount: allText.split(/\s+/).filter(Boolean).length,
      capturedBlocks: CapturePanel._capturedBlocks.map(b => ({
        type: 'selection',
        text: b.text,
        label: b.label,
        added_at: b.timestamp
      }))
    };
  },

  /**
   * Save the current capture locally as a pending capture.
   * Uses GM_setValue via the PendingCaptures module.
   */
  save: async () => {
    if (CapturePanel._capturedBlocks.length === 0) {
      CapturePanel._setStatus('⚠️ Nothing to save — add some text first', 'warn');
      return;
    }

    try {
      CapturePanel._setStatus('💾 Saving...', 'info');
      const articleData = CapturePanel._buildArticleData();
      const count = await PendingCaptures.save(articleData);
      CapturePanel._setStatus(`✓ Saved locally (${count} pending capture${count !== 1 ? 's' : ''})`, 'success');
      console.log('[NAC CapturePanel] Saved pending capture, total:', count);
    } catch (e) {
      console.error('[NAC CapturePanel] Save failed:', e);
      CapturePanel._setStatus('❌ Save failed: ' + e.message, 'error');
    }
  },

  /**
   * Attempt to publish the capture to relays.
   * If CSP blocks the connection, falls back to local save.
   */
  publish: async () => {
    if (CapturePanel._capturedBlocks.length === 0) {
      CapturePanel._setStatus('⚠️ Nothing to publish — add some text first', 'warn');
      return;
    }

    CapturePanel._setStatus('📤 Publishing...', 'info');

    try {
      // Pre-flight CSP check
      const canReach = await CapturePanel._canReachRelays();
      if (!canReach) {
        console.log('[NAC CapturePanel] CSP blocks relay access, saving locally instead');
        CapturePanel._setStatus('🔒 CSP blocks relay access — saving locally...', 'info');
        await CapturePanel.save();
        CapturePanel._setStatus('💾 Saved locally. Publish from any article page.', 'info');
        return;
      }

      // Build the article data
      const articleData = CapturePanel._buildArticleData();

      // Get user identity
      const identity = await Storage.identity.get();
      if (!identity || !identity.pubkey) {
        CapturePanel._setStatus('⚠️ No identity configured. Save and publish from reader view.', 'warn');
        await CapturePanel.save();
        return;
      }

      // Build the NOSTR event
      const event = await EventBuilder.buildArticleEvent(
        articleData,
        [],              // entities (empty for now)
        identity.pubkey,
        []               // claims (empty for now)
      );

      // Get relay URLs
      const relayConfig = await Storage.relays.get();
      const relayUrls = relayConfig.relays
        .filter(r => r.enabled && r.write)
        .map(r => r.url);

      if (relayUrls.length === 0) {
        CapturePanel._setStatus('⚠️ No write relays configured', 'warn');
        return;
      }

      // Sign the event
      let signedEvent;
      if (identity.privateKey) {
        signedEvent = event; // Already has pubkey, would need signing
      } else if (typeof window !== 'undefined' && window.nostr) {
        signedEvent = await window.nostr.signEvent(event);
      } else {
        CapturePanel._setStatus('⚠️ No signing method available. Saving locally.', 'warn');
        await CapturePanel.save();
        return;
      }

      // Publish to relays
      const results = await RelayClient.publish(signedEvent, relayUrls);
      const successes = results.filter(r => r.success).length;

      if (successes > 0) {
        CapturePanel._setStatus(`✓ Published to ${successes}/${relayUrls.length} relays`, 'success');
        console.log('[NAC CapturePanel] Published successfully to', successes, 'relays');
      } else {
        CapturePanel._setStatus('❌ Publish failed — saving locally', 'error');
        await CapturePanel.save();
      }
    } catch (e) {
      console.error('[NAC CapturePanel] Publish error:', e);
      CapturePanel._setStatus('❌ Publish failed: ' + e.message + ' — saving locally', 'error');
      try {
        await CapturePanel.save();
      } catch (_) {
        // Already logged in save()
      }
    }
  },

  /**
   * Pre-flight CSP check — try to open a WebSocket to the first enabled relay.
   * @returns {Promise<boolean>} true if relays are reachable
   */
  _canReachRelays: async () => {
    if (RelayClient._cspBlocked) return false;
    try {
      const relayConfig = await Storage.relays.get();
      const firstRelay = relayConfig.relays.find(r => r.enabled);
      if (!firstRelay) return false;
      const ws = new WebSocket(firstRelay.url);
      return new Promise(resolve => {
        ws.onopen = () => { ws.close(); resolve(true); };
        ws.onerror = () => resolve(false);
        setTimeout(() => { try { ws.close(); } catch (_) {} resolve(false); }, 2000);
      });
    } catch (e) {
      return false;
    }
  },

  /**
   * Set the status message at the bottom of the panel.
   * @param {string} message
   * @param {'info'|'success'|'warn'|'error'} [type='info']
   */
  _setStatus: (message, type = 'info') => {
    const shadow = CapturePanel._shadow;
    if (!shadow) return;

    const statusEl = shadow.querySelector('#nac-cp-status');
    if (!statusEl) return;

    const colors = {
      info: '#888',
      success: '#4ade80',
      warn: '#fbbf24',
      error: '#f87171'
    };

    statusEl.textContent = message;
    statusEl.style.color = colors[type] || colors.info;
  },

  /**
   * Escape HTML entities for safe insertion.
   * @param {string} str
   * @returns {string}
   */
  _esc: (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Escape for HTML attribute values.
   * @param {string} str
   * @returns {string}
   */
  _escAttr: (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

/**
 * All CSS for the capture panel — injected into the Shadow DOM.
 * Fully self-contained so page CSS cannot interfere.
 */
const CAPTURE_PANEL_CSS = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .nac-capture-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 350px;
    height: 100vh;
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 20px rgba(0,0,0,0.3);
    z-index: 2147483647;
    overflow: hidden;
  }

  .nac-cp-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #16213e;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .nac-cp-title {
    font-weight: 600;
    flex: 1;
  }

  .nac-cp-btn {
    background: none;
    border: 1px solid #555;
    color: #e0e0e0;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .nac-cp-btn:hover {
    background: #333;
  }

  .nac-cp-publish {
    background: #6366f1;
    border-color: #6366f1;
    color: white;
  }

  .nac-cp-publish:hover {
    background: #4f46e5;
  }

  .nac-cp-metadata {
    padding: 8px 12px;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .nac-cp-field {
    margin-bottom: 6px;
  }

  .nac-cp-field label {
    display: block;
    font-size: 11px;
    color: #888;
    margin-bottom: 2px;
  }

  .nac-cp-field input {
    width: 100%;
    background: #222;
    border: 1px solid #444;
    color: #e0e0e0;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    box-sizing: border-box;
  }

  .nac-cp-field input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .nac-cp-platform-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #222;
    border-radius: 4px;
    font-size: 13px;
    color: #e0e0e0;
  }

  .nac-cp-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
  }

  .nac-cp-content::-webkit-scrollbar {
    width: 6px;
  }

  .nac-cp-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .nac-cp-content::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .nac-cp-empty {
    text-align: center;
    padding: 32px 16px;
    color: #888;
    font-size: 13px;
  }

  .nac-cp-block {
    margin-bottom: 8px;
    border: 1px solid #444;
    border-radius: 6px;
    overflow: hidden;
  }

  .nac-cp-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: #222;
    font-size: 11px;
    color: #888;
  }

  .nac-cp-block-label {
    font-weight: 500;
  }

  .nac-cp-block-remove {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    line-height: 1;
  }

  .nac-cp-block-remove:hover {
    color: #f87171;
  }

  .nac-cp-block-text {
    padding: 8px;
    min-height: 40px;
    line-height: 1.5;
    outline: none;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .nac-cp-block-text:focus {
    background: rgba(99, 102, 241, 0.05);
  }

  .nac-cp-actions {
    padding: 8px 12px;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }

  .nac-cp-add-selection {
    width: 100%;
    padding: 10px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  }

  .nac-cp-add-selection:hover {
    background: #4f46e5;
  }

  .nac-cp-hint {
    text-align: center;
    font-size: 11px;
    color: #666;
    margin-top: 4px;
  }

  .nac-cp-entities,
  .nac-cp-claims {
    padding: 4px 12px;
    font-size: 12px;
    color: #888;
    flex-shrink: 0;
  }

  .nac-cp-status {
    padding: 6px 12px;
    font-size: 12px;
    color: #888;
    border-top: 1px solid #333;
    flex-shrink: 0;
    min-height: 28px;
  }

  /* Mobile: bottom panel */
  @media (max-width: 768px) {
    .nac-capture-panel {
      top: auto;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 55vh;
      border-radius: 12px 12px 0 0;
    }
  }
`;
