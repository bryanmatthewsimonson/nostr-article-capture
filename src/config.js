export const CONFIG = {
  version: '2.9.2',
  debug: false,
  relays_default: [
    { url: 'wss://nos.lol', read: true, write: true, enabled: true },
    { url: 'wss://relay.primal.net', read: true, write: true, enabled: true },
    { url: 'wss://relay.nostr.net', read: true, write: true, enabled: true },
    { url: 'wss://nostr.mom', read: true, write: true, enabled: true },
    { url: 'wss://relay.nostr.bg', read: true, write: true, enabled: true },
    { url: 'wss://nostr.oxtr.dev', read: true, write: true, enabled: true },
    { url: 'wss://relay.snort.social', read: true, write: true, enabled: true },
    { url: 'wss://offchain.pub', read: true, write: true, enabled: true },
    { url: 'wss://nostr-pub.wellorder.net', read: true, write: true, enabled: true },
    { url: 'wss://nostr.fmt.wiz.biz', read: true, write: true, enabled: true }
  ],
  reader: {
    max_width: '680px',
    font_size: '18px',
    line_height: '1.7'
  },
  extraction: {
    min_content_length: 200,
    max_title_length: 300
  },
  tagging: {
    selection_debounce_ms: 300,
    min_selection_length: 2,
    max_selection_length: 100,
    max_claim_length: 500
  }
};

// Shared mutable state (object property mutation works across ESM imports)
export const _state = { nacFabRef: null };
