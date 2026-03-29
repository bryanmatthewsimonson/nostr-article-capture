import { CONFIG, _state } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { ContentExtractor } from './content-extractor.js';
import { ContentDetector } from './content-detector.js';
import { PlatformHandler } from './platform-handler.js';
import { ReaderView } from './reader-view.js';
import { EntityMigration } from './entity-migration.js';
import { STYLES } from './styles.js';

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
      Utils.log('FAB clicked');
      
      // Detect content type
      const detection = ContentDetector.detect();
      Utils.log('Content detected:', detection);
      
      // Extract article — use platform handler if available, else generic
      let article;
      if (detection.platform && PlatformHandler.has(detection.platform)) {
        const handler = PlatformHandler.get(detection.platform);
        try {
          article = await handler.extract();
        } catch (handlerError) {
          console.warn('[NAC] Platform handler failed, falling back to generic:', handlerError.message);
          article = null;
        }
      }
      if (!article) {
        article = ContentExtractor.extractArticle();
      }
      
      if (!article) {
        Utils.showToast('No article content found on this page', 'error');
        return;
      }
      
      // Attach content detection metadata to article
      article.contentType = detection.type;
      article.platform = detection.platform;
      article.platformMetadata = detection.metadata;
      article.contentConfidence = detection.confidence;
      article.hasComments = ContentDetector.hasComments();
      
      // Show reader view
      await ReaderView.show(article);
    } catch (clickError) {
      console.error('[NAC] FAB click handler error:', clickError);
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

export { init };
