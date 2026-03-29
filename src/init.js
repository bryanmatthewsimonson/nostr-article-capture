import { CONFIG, _state } from './config.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';
import { ContentExtractor } from './content-extractor.js';
import { ContentDetector } from './content-detector.js';
import { PlatformHandler } from './platform-handler.js';
import { ReaderView } from './reader-view.js';
import { EntityMigration } from './entity-migration.js';
import { STYLES } from './styles.js';

async function init() {
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
  GM_addStyle(STYLES);
  
  // Create Shadow DOM host for FAB (isolates from page CSS, prevents overlays from hiding it)
  const fabHost = document.createElement('div');
  fabHost.id = 'nac-fab-host';
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
  const fab = document.createElement('button');
  fab.className = 'nac-fab';
  fab.innerHTML = '📰';
  fab.title = 'NOSTR Article Capture';
  fab.setAttribute('aria-label', 'Capture Article');

  fab.addEventListener('click', async () => {
    Utils.log('FAB clicked');
    
    // Detect content type
    const detection = ContentDetector.detect();
    Utils.log('Content detected:', detection);
    
    // Extract article — use platform handler if available, else generic
    let article;
    if (detection.platform && PlatformHandler.has(detection.platform)) {
      const handler = PlatformHandler.get(detection.platform);
      article = await handler.extract();
    } else {
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
  });

  fabShadow.appendChild(fab);
  _state.nacFabRef = fab;

  // Periodically verify FAB host is still in DOM and visible
  // Guards against dynamic overlays removing or hiding the host element
  setInterval(() => {
    if (!document.body.contains(fabHost)) {
      document.body.appendChild(fabHost);
    }
    fabHost.style.setProperty('display', 'block', 'important');
    fabHost.style.setProperty('visibility', 'visible', 'important');
    fabHost.style.setProperty('opacity', '1', 'important');
    fabHost.style.setProperty('pointer-events', 'none', 'important');
  }, 3000);
  
  // Register menu commands
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
  
  Utils.log('Initialization complete');
}

export { init };
