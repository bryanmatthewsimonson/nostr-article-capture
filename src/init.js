import { CONFIG, _state } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { ContentExtractor } from './content-extractor.js';
import { ContentDetector } from './content-detector.js';
import { PlatformHandler } from './platform-handler.js';
import { EventBuilder } from './event-builder.js';
import { ReaderView } from './reader-view.js';
import { CapturePanel } from './capture-panel.js';
import { PendingCaptures } from './pending-captures.js';
import { EntityMigration } from './entity-migration.js';
import { APIInterceptor } from './api-interceptor.js';
import { STYLES } from './styles.js';

/** Platforms that use the capture panel instead of reader view */
const CAPTURE_PANEL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube'];

/**
 * Check if the user has text selected on the page.
 * If so, return the selection text and the containing element.
 * This is the most obfuscation-proof capture method — the user
 * highlights exactly what they want captured.
 */
function getTextSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;

  const text = sel.toString().trim();
  if (text.length < 5) return null; // Too short to be meaningful

  // Find the containing element of the selection
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  // If it's a text node, get its parent element
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement;
  }

  console.log('[NAC] Text selection detected:', text.substring(0, 80) + '...');
  return { text, container, range };
}

/**
 * Walk up the DOM from an element to find a "post-shaped" container.
 * Uses visual characteristics: size, separation from siblings, content signals.
 */
function findVisualPostBoundary(startEl) {
  let el = startEl;
  let bestCandidate = startEl;
  let bestScore = 0;

  while (el && el !== document.body && el !== document.documentElement) {
    const rect = el.getBoundingClientRect();
    let score = 0;

    // Size checks — posts are typically 300-800px wide and 100-1000px tall
    if (rect.width > 250 && rect.height > 80) score++;
    if (rect.width > 350) score++;
    if (rect.height > 120 && rect.height < 2000) score++;

    // ARIA signals
    if (el.getAttribute('role') === 'article') score += 5;
    if (el.getAttribute('role') === 'main') score -= 2; // Too broad
    if (el.getAttribute('data-pagelet')) score += 2;
    if (el.getAttribute('data-testid')) score++;

    // Content signals
    const hasImages = el.querySelectorAll('img').length > 0;
    const hasLinks = el.querySelectorAll('a[href]').length > 0;
    const hasText = el.textContent.length > 30;
    if (hasImages) score++;
    if (hasLinks) score++;
    if (hasText) score++;

    // Visual separation from siblings (border, margin, padding, background)
    const computed = window.getComputedStyle(el);
    const hasBorder = computed.borderWidth !== '0px' && computed.borderStyle !== 'none';
    const hasBackground = computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent';
    const hasShadow = computed.boxShadow !== 'none';
    const hasMargin = parseInt(computed.marginTop) > 4 || parseInt(computed.marginBottom) > 4;
    if (hasBorder) score++;
    if (hasBackground) score++;
    if (hasShadow) score += 2; // Cards often have shadows
    if (hasMargin) score++;

    // Penalty for being too large (entire page)
    if (rect.width > window.innerWidth * 0.95) score -= 3;
    if (rect.height > window.innerHeight * 1.5) score -= 3;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = el;
    }

    el = el.parentElement;
  }

  return bestCandidate;
}

/**
 * Prompt the user to click on a page element for selection.
 * Shows a semi-transparent overlay with instructions, highlights
 * the POST BOUNDARY (not just the hovered element) under the cursor.
 * Resolves with null if the user presses Escape.
 */
function promptUserSelection(platform) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'nac-selection-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483645;background:rgba(0,0,0,0.15);cursor:crosshair;';

    // Instruction banner
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#6366f1;color:white;padding:14px 24px;border-radius:12px;font-family:system-ui;font-size:15px;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;max-width:440px;pointer-events:none;z-index:2147483647;';
    banner.innerHTML = `<div style="font-size:18px;margin-bottom:6px;">📌 Click on the ${platform} post to capture</div><div style="font-size:12px;opacity:0.85;">The highlighted area shows what will be captured. Press Escape to cancel.</div>`;
    overlay.appendChild(banner);

    // Highlight overlay — a positioned div that outlines the detected post boundary
    const highlight = document.createElement('div');
    highlight.style.cssText = 'position:fixed;pointer-events:none;border:3px solid #6366f1;border-radius:8px;background:rgba(99,102,241,0.08);transition:all 0.15s ease;z-index:2147483646;box-shadow:0 0 0 4000px rgba(0,0,0,0.2);';
    overlay.appendChild(highlight);

    let lastBoundary = null;

    overlay.addEventListener('mousemove', (e) => {
      overlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = 'auto';

      if (!el || el === document.body || el === document.documentElement) {
        highlight.style.display = 'none';
        lastBoundary = null;
        return;
      }

      // Find the visual post boundary from the hovered element
      const boundary = findVisualPostBoundary(el);
      if (boundary === lastBoundary) return; // No change

      lastBoundary = boundary;
      const rect = boundary.getBoundingClientRect();
      highlight.style.display = 'block';
      highlight.style.top = rect.top - 3 + 'px';
      highlight.style.left = rect.left - 3 + 'px';
      highlight.style.width = rect.width + 6 + 'px';
      highlight.style.height = rect.height + 6 + 'px';
    });

    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      overlay.remove();
      document.removeEventListener('keydown', escHandler);
      resolve(lastBoundary);
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
  });
}

/**
 * Wait for document.body to exist.
 * On YouTube SPA and other dynamic pages, body may not be ready when the script runs.
 */
function waitForBody() {
  return new Promise(resolve => {
    if (document.body) return resolve();
    console.log('[NAC] document.body not ready, waiting...');
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.body) {
        obs.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement, { childList: true });
    // Fallback timeout — resolve even if body never appears (shouldn't happen)
    setTimeout(() => {
      console.warn('[NAC] waitForBody timed out after 5s, proceeding anyway');
      resolve();
    }, 5000);
  });
}

/**
 * Ensure the FAB host element exists in the DOM.
 * Called on init and after SPA navigations that may destroy it.
 */
let _fabHost = null;
let _fab = null;

/**
 * Add a small red notification badge to the FAB showing pending capture count.
 * @param {number} count
 */
function addFABBadge(count) {
  if (!_fab) return;
  const existing = _fab.querySelector('.nac-fab-badge');
  if (existing) existing.remove();

  const badge = document.createElement('span');
  badge.className = 'nac-fab-badge';
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.cssText = 'position:absolute!important;top:-4px!important;right:-4px!important;background:#ef4444!important;color:white!important;font-size:11px!important;font-weight:700!important;min-width:18px!important;height:18px!important;border-radius:9px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0 4px!important;line-height:1!important;pointer-events:none!important;box-sizing:border-box!important;';
  _fab.appendChild(badge);
}

/**
 * Add a small 📦 archive indicator to the FAB
 */
function addFABArchiveBadge() {
  if (!_fab) return;
  if (_fab.querySelector('.nac-fab-archive-badge')) return; // Already has one
  const badge = document.createElement('span');
  badge.className = 'nac-fab-archive-badge';
  badge.textContent = '📦';
  badge.style.cssText = 'position:absolute!important;bottom:-2px!important;left:-2px!important;font-size:14px!important;pointer-events:none!important;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))!important;';
  _fab.appendChild(badge);
}

function ensureFABExists() {
  if (_fabHost && document.body && document.body.contains(_fabHost)) {
    return; // FAB host is still in DOM
  }
  if (_fabHost && document.body) {
    // Host was removed — re-append it
    console.log('[NAC] FAB host was removed from DOM, re-appending');
    document.body.appendChild(_fabHost);
  }
}

/**
 * Create the FAB button using Shadow DOM with a regular DOM fallback.
 */
function createFAB() {
  // Detect platform and pick adaptive FAB icon
  const detection = ContentDetector.detect();
  const fabIcon = detection.platform
    ? ContentDetector.getPlatformIcon(detection.platform)
    : '📰';

  let fab;

  try {
    // Shadow DOM approach — isolates from page CSS, prevents overlays from hiding it
    const fabHost = document.createElement('div');
    fabHost.id = 'nac-fab-host';
    fabHost.style.cssText = 'position:fixed!important;bottom:0!important;right:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;visibility:visible!important;opacity:1!important;';
    document.body.appendChild(fabHost);
    const fabShadow = fabHost.attachShadow({ mode: 'closed' });

    // FAB styles inside Shadow DOM (isolated from page styles)
    const fabStyle = document.createElement('style');
    fabStyle.textContent = `
      .nac-fab {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: 56px !important;
        height: 56px !important;
        border-radius: 50% !important;
        background: var(--nac-primary, #6366f1) !important;
        border: none !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        font-size: 24px !important;
        color: white !important;
        transition: all 0.3s ease !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
        clip: auto !important;
        clip-path: none !important;
        overflow: visible !important;
      }
      .nac-fab:hover {
        background: var(--nac-primary-hover, #4f46e5) !important;
        transform: scale(1.05) !important;
      }
      .nac-fab:focus-visible {
        outline: 2px solid var(--nac-primary, #6366f1);
        outline-offset: 2px;
      }
      @media (max-width: 768px) {
        .nac-fab {
          bottom: 80px !important;
          right: 16px !important;
          width: 60px !important;
          height: 60px !important;
          font-size: 28px !important;
        }
      }
    `;
    fabShadow.appendChild(fabStyle);

    // Create FAB button inside Shadow DOM
    fab = document.createElement('button');
    fab.className = 'nac-fab';
    fab.innerHTML = fabIcon;
    fab.title = 'NOSTR Article Capture';
    fab.setAttribute('aria-label', 'Capture Article');
    fabShadow.appendChild(fab);

    _fabHost = fabHost;
    console.log('[NAC] FAB created via Shadow DOM');
  } catch (shadowError) {
    console.warn('[NAC] Shadow DOM FAB failed:', shadowError.message, '— falling back to regular DOM');
    // Fallback: create a regular DOM button with inline styles
    fab = document.createElement('button');
    fab.className = 'nac-fab';
    fab.style.cssText = 'position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;width:56px!important;height:56px!important;border-radius:50%!important;background:#6366f1!important;color:white!important;border:none!important;cursor:pointer!important;font-size:24px!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:auto!important;opacity:1!important;visibility:visible!important;';
    fab.innerHTML = fabIcon;
    fab.title = 'NOSTR Article Capture';
    fab.setAttribute('aria-label', 'Capture Article');
    document.body.appendChild(fab);

    _fabHost = fab; // Track the fallback element for re-append logic
    console.log('[NAC] FAB created via regular DOM fallback');
  }

  // Attach click handler
  fab.addEventListener('click', async () => {
  try {
    console.log('[NAC] FAB clicked');
    Utils.log('FAB clicked');
    
    // Detect content type
    const detection = ContentDetector.detect();
    console.log('[NAC] Content detected:', detection.platform, detection.type, 'confidence:', detection.confidence);
    Utils.log('Content detected:', detection);
    
    // Determine which mode to use — Capture Panel for CSP-restricted social media
    const useCapturePanel = detection.platform &&
      CAPTURE_PANEL_PLATFORMS.includes(detection.platform);

    if (useCapturePanel) {
      // ── Capture Panel mode — non-invasive side panel ──
      console.log('[NAC] Using Capture Panel mode for', detection.platform);
      const textSel = getTextSelection();

      const article = {
        url: window.location.href,
        platform: detection.platform,
        contentType: detection.type,
        title: '',
        byline: '',
        content: '',
        textContent: textSel?.text || '',
        domain: window.location.hostname,
        siteName: detection.platform.charAt(0).toUpperCase() + detection.platform.slice(1),
        publishedAt: Math.floor(Date.now() / 1000),
        featuredImage: document.querySelector('meta[property="og:image"]')?.content || '',
        publicationIcon: '',
        platformAccount: null
      };

      // Auto-fill YouTube metadata when using capture panel
      if (detection.platform === 'youtube') {
        const videoTitle = document.querySelector('meta[property="og:title"]')?.content || document.title.replace(' - YouTube', '');
        const channelName = document.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim() || '';
        article.title = videoTitle;
        article.byline = channelName;
        article.featuredImage = document.querySelector('meta[property="og:image"]')?.content || '';
        article.contentType = 'video';
      }

      CapturePanel.open(article);

      // If there was a text selection, auto-add it as the first block
      if (textSel?.text) {
        CapturePanel.addBlock(textSel.text, 'Selected text');
      }
      return;
    }

    // ── Reader Mode — full-page takeover (existing behavior) ──
    // Extract article — dual-mode: text selection first, then click-to-select
    let article;
    if (detection.platform && PlatformHandler.has(detection.platform)) {
      const handler = PlatformHandler.get(detection.platform);
      try {
        // MODE 1: Check if user has text selected (most obfuscation-proof)
        const textSel = getTextSelection();
        
        if (textSel && handler.needsUserSelection) {
          // User already selected text — use the selection's container
          console.log('[NAC] Text selection detected:', JSON.stringify(textSel.text.substring(0, 80)) + '...');
          console.log('[NAC] Selection container:', textSel.container?.tagName, textSel.container?.getAttribute('role'));
          const postContainer = handler.findPostContainer
            ? handler.findPostContainer(textSel.container)
            : findVisualPostBoundary(textSel.container);
          console.log('[NAC] Post container found:', postContainer?.tagName, postContainer?.getAttribute('role'), 'text length:', postContainer?.innerText?.length);
          
          // Pass the selected text as a hint to the extractor
          console.log('[NAC] Calling handler.extract() with container');
          article = await handler.extract(postContainer, textSel.text);
          console.log('[NAC] Extract returned:', article ? { title: article.title?.substring(0, 50), textLength: article.textContent?.length, hasContent: !!article.content } : 'null');
          // If the handler didn't capture text well, use the selection text
          if (article && (!article.textContent || article.textContent.length < textSel.text.length)) {
            console.log('[NAC] Overriding textContent with selection text (', textSel.text.length, 'chars vs', article.textContent?.length, 'chars)');
            article.textContent = textSel.text;
            if (!article.content || article.content.length < textSel.text.length) {
              // Rebuild content HTML from selected text
              article.content = article.content || '';
            }
          }
          // Clear the selection after capture
          window.getSelection().removeAllRanges();
          
        } else if (handler.needsUserSelection) {
          // MODE 2: Click-to-select with enhanced visual boundary detection
          console.log('[NAC] No text selection, showing click overlay for', handler.platform || detection.type);
          const selectedElement = await promptUserSelection(handler.platform || detection.type);
          if (!selectedElement) {
            console.log('[NAC] User cancelled selection (Escape)');
            return;
          }
          console.log('[NAC] User clicked element:', selectedElement.tagName, selectedElement.getAttribute('role'), 'text length:', selectedElement.innerText?.length);

          const postContainer = handler.findPostContainer
            ? handler.findPostContainer(selectedElement)
            : selectedElement;
          console.log('[NAC] Post container found:', postContainer?.tagName, postContainer?.getAttribute('role'), 'text length:', postContainer?.innerText?.length);

          console.log('[NAC] Calling handler.extract() with container');
          article = await handler.extract(postContainer);
          console.log('[NAC] Extract returned:', article ? { title: article.title?.substring(0, 50), textLength: article.textContent?.length, hasContent: !!article.content } : 'null');
        } else {
          // MODE 3: Automatic extraction (YouTube, Twitter single tweets, articles)
          console.log('[NAC] Automatic extraction (no user selection needed)');
          article = await handler.extract();
          console.log('[NAC] Extract returned:', article ? { title: article.title?.substring(0, 50), textLength: article.textContent?.length } : 'null');
        }
      } catch (handlerError) {
        console.warn('[NAC] Platform handler failed, falling back to generic:', handlerError.message, handlerError.stack);
        article = null;
      }
    }
    if (!article) {
      console.log('[NAC] No platform article, trying generic ContentExtractor');
      article = ContentExtractor.extractArticle();
    }
    
    if (!article) {
      console.log('[NAC] No article content found at all');
      Utils.showToast('No article content found on this page', 'error');
      return;
    }
    
    // Attach content detection metadata to article
    article.contentType = detection.type;
    article.platform = detection.platform;
    article.platformMetadata = detection.metadata;
    article.contentConfidence = detection.confidence;
    article.hasComments = ContentDetector.hasComments();
    
    // Archive-aware: if article is paywalled or truncated, check for cached version
    if (article.isPaywalled || (article.wordCount && article.wordCount < 200)) {
      try {
        const identity = await Storage.identity.get();
        const archived = await EventBuilder.getArchivedArticle(article.url, identity?.pubkey);
        if (archived && (archived.wordCount || 0) > (article.wordCount || 0)) {
          console.log('[NAC] Archive has more content:', archived.wordCount, 'vs', article.wordCount, 'words');
          Utils.showToast('📦 Using archived version — more complete content available', 'success');
          // Keep the fresh URL and metadata, but use archived content
          archived.url = article.url;
          archived.isPaywalled = article.isPaywalled;
          archived._liveWordCount = article.wordCount;
          article = archived;
        }
      } catch (e) {
        console.log('[NAC] Archive check failed:', e.message);
      }
    }
    
    // Show reader view
    console.log('[NAC] Opening reader view with article:', article.title?.substring(0, 60));
    await ReaderView.show(article);
  } catch (clickError) {
    console.error('[NAC] FAB click handler error:', clickError, clickError.stack);
  }
});

  _fab = fab;
  _state.nacFabRef = fab;
  return fab;
}

async function init() {
  try {
    console.log('[NAC] Init starting on', window.location.hostname);
    Utils.log('Initializing NOSTR Article Capture v' + CONFIG.version);
    
    // Check GM storage availability (must be first — sets fallback flag)
    Storage.checkGMAvailability();
    
    // Run migrations before anything else
    try {
      await EntityMigration.migrateAliasesToEntities();
    } catch (e) {
      console.error('[NAC] Entity migration failed:', e);
    }
    
    // Start API interception early for Facebook/Instagram (before FAB creation)
    // This hooks fetch/XHR to capture structured data from Meta's GraphQL APIs
    const earlyDetection = ContentDetector.detect();
    if (earlyDetection.platform === 'facebook' || earlyDetection.platform === 'instagram') {
      APIInterceptor.start(earlyDetection.platform);
    }
    
    // Add styles
    try {
      GM_addStyle(STYLES);
    } catch (styleError) {
      console.warn('[NAC] GM_addStyle failed:', styleError.message, '— injecting via <style> tag');
      const styleEl = document.createElement('style');
      styleEl.textContent = STYLES;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // Wait for document.body before creating FAB
    await waitForBody();
    console.log('[NAC] document.body available:', !!document.body);

    if (!document.body) {
      console.error('[NAC] FATAL: document.body still null after waiting. Cannot create FAB.');
      return;
    }

    // Create the FAB
    createFAB();
    console.log('[NAC] FAB created successfully');

    // Check for pending captures and show badge on FAB
    try {
      const pendingCount = await PendingCaptures.getCount();
      if (pendingCount > 0) {
        addFABBadge(pendingCount);
        console.log('[NAC] Pending captures badge added:', pendingCount);
      }
    } catch (e) {
      console.warn('[NAC] Failed to check pending captures:', e);
    }

    // Archive: check if current URL is cached (fast, no relay query)
    try {
      const currentUrl = window.location.href;
      const isCached = await Storage.articleCache.has(currentUrl);
      if (isCached) {
        addFABArchiveBadge();
        console.log('[NAC] Archive badge added — cached article detected');
      }
    } catch (e) {
      // Non-critical
    }

    // Periodically verify FAB host is still in DOM and visible
    // Guards against dynamic overlays removing or hiding the host element
    setInterval(() => {
      try {
        ensureFABExists();
        // Re-enforce host styles if using Shadow DOM approach
        if (_fabHost && _fabHost.id === 'nac-fab-host') {
          _fabHost.style.cssText = 'position:fixed!important;bottom:0!important;right:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;visibility:visible!important;opacity:1!important;';
        }
      } catch (e) {
        // Silently ignore interval errors
      }
    }, 3000);

    // Detect YouTube SPA navigation — YouTube doesn't do full page loads
    // When the user navigates from homepage to a video page, the script doesn't re-run
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      try {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          console.log('[NAC] SPA navigation detected:', lastUrl);
          ensureFABExists();
        }
      } catch (e) {
        // Silently ignore observer errors
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Also listen to YouTube-specific navigation events
    window.addEventListener('yt-navigate-finish', () => {
      console.log('[NAC] YouTube navigation event detected');
      ensureFABExists();
    });

    // Register menu commands
    try {
      GM_registerMenuCommand('Open Settings', async () => {
        const article = ContentExtractor.extractArticle() || { url: window.location.href };
        await ReaderView.show(article);
        await ReaderView.showSettings();
      });
      
      GM_registerMenuCommand('Export Entities', async () => {
        const json = await Storage.entities.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nostr-entities-' + Date.now() + '.json';
        a.click();
        Utils.showToast('Entities exported');
      });
    } catch (menuError) {
      console.warn('[NAC] Menu command registration failed:', menuError.message);
    }
    
    console.log('[NAC] Initialization complete on', window.location.hostname);
    Utils.log('Initialization complete');
  } catch (e) {
    console.error('[NAC] Init FAILED:', e);
  }
}

export { init, promptUserSelection };
