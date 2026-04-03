// Entry point — imports all modules and runs initialization
import './trusted-types.js';  // MUST be first — creates TrustedTypes policy before any innerHTML
import { CONFIG, _state } from './config.js';
import { Crypto } from './crypto.js';
import { Storage } from './storage.js';
import { ContentExtractor } from './content-extractor.js';
import { ContentDetector } from './content-detector.js';
import { PlatformHandler } from './platform-handler.js';
import { Utils } from './utils.js';
import { EntityTagger } from './entity-tagger.js';
import { EntityAutoSuggest } from './entity-auto-suggest.js';
import { ClaimExtractor } from './claim-extractor.js';
import { EvidenceLinker } from './evidence-linker.js';
import { PlatformAccount } from './platform-account.js';
import { CommentExtractor } from './comment-extractor.js';
import { RelayClient } from './relay-client.js';
import { EventBuilder } from './event-builder.js';
import { EntitySync } from './entity-sync.js';
import { EntityBrowser } from './entity-browser.js';
import { ReaderView } from './reader-view.js';
import { EntityMigration } from './entity-migration.js';
import { APIInterceptor } from './api-interceptor.js';
import { STYLES } from './styles.js';
import { init } from './init.js';
import './platforms/substack.js';  // Self-registering
import './platforms/youtube.js';   // Self-registering
import './platforms/twitter.js';   // Self-registering
import './platforms/facebook.js';  // Self-registering
import './platforms/instagram.js'; // Self-registering
import './platforms/tiktok.js';    // Self-registering

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(e => console.error('[NAC] Init promise rejected:', e));
  });
} else {
  init().catch(e => console.error('[NAC] Init promise rejected:', e));
}
