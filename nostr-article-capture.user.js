// ==UserScript==
// @name         NOSTR Article Capture
// @namespace    https://github.com/nostr-article-capture
// @version      2.0.0
// @updateURL    https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @downloadURL  https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @description  Capture articles with clean reader view, entity tagging, and NOSTR publishing
// @author       Decentralized News Network
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // ============================================
  // SECTION 1: CONFIGURATION
  // ============================================
  
  const CONFIG = {
    version: '2.0.0',
    debug: false,
    relays_default: [
      { url: 'wss://relay.damus.io', read: true, write: true, enabled: true },
      { url: 'wss://nos.lol', read: true, write: true, enabled: true },
      { url: 'wss://relay.nostr.band', read: true, write: true, enabled: true }
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
      max_selection_length: 100
    }
  };

  // ============================================
  // SECTION 2: CRYPTO - secp256k1, bech32, BIP-340
  // ============================================

  // --- secp256k1 elliptic curve primitives (BigInt) ---

  const _SECP256K1 = {
    P: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
    N: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
    Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
    Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
  };

  function _mod(a, m = _SECP256K1.P) {
    const r = a % m;
    return r >= 0n ? r : m + r;
  }

  function _modInverse(a, m = _SECP256K1.P) {
    let [old_r, r] = [_mod(a, m), m];
    let [old_s, s] = [1n, 0n];
    while (r !== 0n) {
      const q = old_r / r;
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
    }
    return _mod(old_s, m);
  }

  function _pointAdd(p1, p2) {
    if (!p1) return p2;
    if (!p2) return p1;
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    if (x1 === x2 && y1 === y2) {
      const s = _mod(3n * x1 * x1 * _modInverse(2n * y1));
      const x3 = _mod(s * s - 2n * x1);
      const y3 = _mod(s * (x1 - x3) - y1);
      return [x3, y3];
    }
    if (x1 === x2) return null; // point at infinity
    const s = _mod((y2 - y1) * _modInverse(x2 - x1));
    const x3 = _mod(s * s - x1 - x2);
    const y3 = _mod(s * (x1 - x3) - y1);
    return [x3, y3];
  }

  function _pointMultiply(k, point = [_SECP256K1.Gx, _SECP256K1.Gy]) {
    let result = null;
    let current = point;
    let n = k;
    while (n > 0n) {
      if (n & 1n) result = _pointAdd(result, current);
      current = _pointAdd(current, current);
      n >>= 1n;
    }
    return result;
  }

  // --- Bech32 encoding/decoding (BIP-173) ---

  const _BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function _bech32Polymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
      const b = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) {
        if ((b >> i) & 1) chk ^= GEN[i];
      }
    }
    return chk;
  }

  function _bech32HrpExpand(hrp) {
    const ret = [];
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
    return ret;
  }

  function _bech32CreateChecksum(hrp, data) {
    const values = _bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
    const polymod = _bech32Polymod(values) ^ 1;
    const ret = [];
    for (let i = 0; i < 6; i++) ret.push((polymod >> (5 * (5 - i))) & 31);
    return ret;
  }

  function _bech32Encode(hrp, data) {
    const combined = data.concat(_bech32CreateChecksum(hrp, data));
    let ret = hrp + '1';
    for (const d of combined) ret += _BECH32_CHARSET.charAt(d);
    return ret;
  }

  function _bech32Decode(str) {
    str = str.toLowerCase();
    const pos = str.lastIndexOf('1');
    if (pos < 1 || pos + 7 > str.length) return null;
    const hrp = str.substring(0, pos);
    const data = [];
    for (let i = pos + 1; i < str.length; i++) {
      const d = _BECH32_CHARSET.indexOf(str.charAt(i));
      if (d === -1) return null;
      data.push(d);
    }
    if (_bech32Polymod(_bech32HrpExpand(hrp).concat(data)) !== 1) return null;
    return { hrp, data: data.slice(0, -6) };
  }

  function _convertBits(data, fromBits, toBits, pad) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;
    for (const value of data) {
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push((acc >> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
    }
    return ret;
  }

  // --- Crypto module ---

  const Crypto = {
    // Convert hex string to Uint8Array
    hexToBytes: (hex) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    },

    // Convert Uint8Array to hex string
    bytesToHex: (bytes) => {
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },

    // Generate a random private key (32 bytes)
    generatePrivateKey: () => {
      const privateKeyArray = new Uint8Array(32);
      crypto.getRandomValues(privateKeyArray);
      return Crypto.bytesToHex(privateKeyArray);
    },

    // Derive x-only public key from private key (secp256k1 point multiplication)
    getPublicKey: (privkeyHex) => {
      const privkey = BigInt('0x' + privkeyHex);
      if (privkey <= 0n || privkey >= _SECP256K1.N) {
        throw new Error('Invalid private key: out of range');
      }
      const point = _pointMultiply(privkey);
      if (!point) throw new Error('Invalid public key: point at infinity');
      // Return x-only public key (BIP-340 / NIP-01)
      return point[0].toString(16).padStart(64, '0');
    },

    // Encode 32-byte hex as bech32 npub
    hexToNpub: (hex) => {
      try {
        const bytes = Crypto.hexToBytes(hex);
        const words = _convertBits(Array.from(bytes), 8, 5, true);
        return _bech32Encode('npub', words);
      } catch (e) {
        console.error('[NAC Crypto] Failed to encode npub:', e);
        return null;
      }
    },

    // Decode bech32 npub to 32-byte hex
    npubToHex: (npub) => {
      try {
        const decoded = _bech32Decode(npub);
        if (!decoded || decoded.hrp !== 'npub') return null;
        const bytes = _convertBits(decoded.data, 5, 8, false);
        return Crypto.bytesToHex(new Uint8Array(bytes));
      } catch (e) {
        console.error('[NAC Crypto] Failed to decode npub:', e);
        return null;
      }
    },

    // Encode 32-byte hex as bech32 nsec
    hexToNsec: (hex) => {
      try {
        const bytes = Crypto.hexToBytes(hex);
        const words = _convertBits(Array.from(bytes), 8, 5, true);
        return _bech32Encode('nsec', words);
      } catch (e) {
        console.error('[NAC Crypto] Failed to encode nsec:', e);
        return null;
      }
    },

    // Decode bech32 nsec to 32-byte hex
    nsecToHex: (nsec) => {
      try {
        const decoded = _bech32Decode(nsec);
        if (!decoded || decoded.hrp !== 'nsec') return null;
        const bytes = _convertBits(decoded.data, 5, 8, false);
        return Crypto.bytesToHex(new Uint8Array(bytes));
      } catch (e) {
        console.error('[NAC Crypto] Failed to decode nsec:', e);
        return null;
      }
    },

    // Get event hash per NIP-01: SHA-256 of serialized event
    getEventHash: async (event) => {
      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
      const msgBuffer = new TextEncoder().encode(serialized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Crypto.bytesToHex(new Uint8Array(hashBuffer));
    },

    // BIP-340 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || msg)
    taggedHash: async (tag, ...msgs) => {
      const tagBytes = new TextEncoder().encode(tag);
      const tagHash = new Uint8Array(await crypto.subtle.digest('SHA-256', tagBytes));

      let totalLen = 64;
      for (const msg of msgs) totalLen += msg.length;

      const buf = new Uint8Array(totalLen);
      buf.set(tagHash, 0);
      buf.set(tagHash, 32);
      let offset = 64;
      for (const msg of msgs) {
        buf.set(msg, offset);
        offset += msg.length;
      }

      const hash = await crypto.subtle.digest('SHA-256', buf);
      return new Uint8Array(hash);
    },

    // Sign event with BIP-340 Schnorr signature
    signEvent: async (event, privkeyHex) => {
      try {
        // Try NIP-07 extension first
        if (window.nostr && window.nostr.signEvent) {
          const signed = await window.nostr.signEvent(event);
          return signed;
        }

        // Compute event id (hash)
        const hash = await Crypto.getEventHash(event);
        event.id = hash;

        // BIP-340 Schnorr signature
        const d = BigInt('0x' + privkeyHex);
        const P = _pointMultiply(d);
        if (!P) throw new Error('Invalid private key');

        // Negate private key if P.y is odd (BIP-340 convention)
        const dAdj = P[1] % 2n === 0n ? d : _SECP256K1.N - d;

        // Deterministic nonce per BIP-340:
        // k = tagged_hash("BIP0340/nonce", bytes(d) || bytes(P.x) || msg)
        const dBytes = Crypto.hexToBytes(dAdj.toString(16).padStart(64, '0'));
        const pxBytes = Crypto.hexToBytes(P[0].toString(16).padStart(64, '0'));
        const msgBytes = Crypto.hexToBytes(hash);

        const nonceHash = await Crypto.taggedHash('BIP0340/nonce', dBytes, pxBytes, msgBytes);
        const k0 = BigInt('0x' + Crypto.bytesToHex(nonceHash)) % _SECP256K1.N;
        if (k0 === 0n) throw new Error('Invalid nonce');

        const R = _pointMultiply(k0);
        if (!R) throw new Error('Invalid nonce point');
        const k = R[1] % 2n === 0n ? k0 : _SECP256K1.N - k0;

        // Challenge: e = tagged_hash("BIP0340/challenge", R.x || P.x || msg)
        const rxBytes = Crypto.hexToBytes(R[0].toString(16).padStart(64, '0'));
        const eHash = await Crypto.taggedHash('BIP0340/challenge', rxBytes, pxBytes, msgBytes);
        const e = BigInt('0x' + Crypto.bytesToHex(eHash)) % _SECP256K1.N;

        const s = _mod(k + e * dAdj, _SECP256K1.N);

        // Signature is (R.x, s), each 32 bytes = 64 bytes total (128 hex chars)
        const sig = R[0].toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0');

        event.sig = sig;
        return event;
      } catch (e) {
        console.error('[NAC Crypto] Failed to sign event:', e);
        return null;
      }
    },

    // Verify BIP-340 Schnorr signature
    verifySignature: async (event) => {
      try {
        // Verify the event id matches the hash
        const hash = await Crypto.getEventHash(event);
        if (hash !== event.id) return false;

        // Signature and pubkey parsing
        const sig = event.sig;
        if (!sig || sig.length !== 128) return false;
        const rx = BigInt('0x' + sig.substring(0, 64));
        const s = BigInt('0x' + sig.substring(64, 128));
        const px = BigInt('0x' + event.pubkey);

        if (rx >= _SECP256K1.P || s >= _SECP256K1.N) return false;

        // Lift x to point P (even y)
        const pySquared = _mod(px * px * px + 7n);
        const py = _modPow(pySquared, (_SECP256K1.P + 1n) / 4n, _SECP256K1.P);
        if (_mod(py * py) !== pySquared) return false;
        const P = [px, py % 2n === 0n ? py : _SECP256K1.P - py];

        // e = tagged_hash("BIP0340/challenge", R.x || P.x || msg)
        const rxBytes = Crypto.hexToBytes(rx.toString(16).padStart(64, '0'));
        const pxBytes = Crypto.hexToBytes(event.pubkey.padStart(64, '0'));
        const msgBytes = Crypto.hexToBytes(hash);
        const eHash = await Crypto.taggedHash('BIP0340/challenge', rxBytes, pxBytes, msgBytes);
        const e = BigInt('0x' + Crypto.bytesToHex(eHash)) % _SECP256K1.N;

        // R' = s*G - e*P
        const sG = _pointMultiply(s);
        const eNeg = _SECP256K1.N - e;
        const eP = _pointMultiply(eNeg, P);
        const R = _pointAdd(sG, eP);

        if (!R) return false;
        if (R[1] % 2n !== 0n) return false;
        if (R[0] !== rx) return false;

        return true;
      } catch (e) {
        return false;
      }
    },

    // SHA-256 hash of a string
    sha256: async (message) => {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Crypto.bytesToHex(new Uint8Array(hashBuffer));
    }
  };

  // Modular exponentiation helper for signature verification
  function _modPow(base, exp, mod) {
    let result = 1n;
    base = _mod(base, mod);
    while (exp > 0n) {
      if (exp % 2n === 1n) result = _mod(result * base, mod);
      exp = exp / 2n;
      base = _mod(base * base, mod);
    }
    return result;
  }

  // ============================================
  // SECTION 3: STORAGE - GM backed with entity registry
  // ============================================
  
  const Storage = {
    // Low-level GM wrappers
    get: async (key, defaultValue = null) => {
      try {
        const value = await GM_getValue(key, null);
        if (value === null) return defaultValue;
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch (e) {
        console.error('[NAC Storage] Get error:', e);
        return defaultValue;
      }
    },

    set: async (key, value) => {
      try {
        await GM_setValue(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('[NAC Storage] Set error:', e);
        return false;
      }
    },

    delete: async (key) => {
      try {
        await GM_deleteValue(key);
        return true;
      } catch (e) {
        console.error('[NAC Storage] Delete error:', e);
        return false;
      }
    },

    // User identity management
    identity: {
      get: async () => {
        return await Storage.get('user_identity', null);
      },

      set: async (data) => {
        return await Storage.set('user_identity', data);
      },

      clear: async () => {
        return await Storage.delete('user_identity');
      },

      isConfigured: async () => {
        const identity = await Storage.identity.get();
        return identity !== null && identity.pubkey;
      }
    },

    // Entity registry management
    entities: {
      getAll: async () => {
        return await Storage.get('entity_registry', {});
      },

      get: async (id) => {
        const registry = await Storage.entities.getAll();
        return registry[id] || null;
      },

      save: async (id, data) => {
        const registry = await Storage.entities.getAll();
        registry[id] = {
          ...data,
          updated: Math.floor(Date.now() / 1000)
        };
        await Storage.set('entity_registry', registry);
        return registry[id];
      },

      delete: async (id) => {
        const registry = await Storage.entities.getAll();
        delete registry[id];
        return await Storage.set('entity_registry', registry);
      },

      search: async (query, type = null) => {
        const registry = await Storage.entities.getAll();
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        for (const [id, entity] of Object.entries(registry)) {
          if (type && entity.type !== type) continue;
          
          const nameMatch = entity.name.toLowerCase().includes(lowerQuery);
          const aliasMatch = entity.aliases && entity.aliases.some(a => 
            a.toLowerCase().includes(lowerQuery)
          );
          
          if (nameMatch || aliasMatch) {
            results.push({ id, ...entity });
          }
        }
        
        return results;
      },

      findByPubkey: async (pubkey) => {
        const registry = await Storage.entities.getAll();
        for (const [id, entity] of Object.entries(registry)) {
          if (entity.keypair && entity.keypair.pubkey === pubkey) {
            return { id, ...entity };
          }
        }
        return null;
      },

      exportAll: async () => {
        const registry = await Storage.entities.getAll();
        return JSON.stringify(registry, null, 2);
      },

      importAll: async (jsonStr) => {
        try {
          const imported = JSON.parse(jsonStr);
          const registry = await Storage.entities.getAll();
          const merged = { ...registry, ...imported };
          await Storage.set('entity_registry', merged);
          return Object.keys(imported).length;
        } catch (e) {
          console.error('[NAC Storage] Import error:', e);
          return 0;
        }
      }
    },

    // Relay configuration
    relays: {
      get: async () => {
        return await Storage.get('relay_config', {
          relays: CONFIG.relays_default
        });
      },

      set: async (config) => {
        return await Storage.set('relay_config', config);
      },

      addRelay: async (url) => {
        const config = await Storage.relays.get();
        if (!config.relays.find(r => r.url === url)) {
          config.relays.push({
            url,
            read: true,
            write: true,
            enabled: true
          });
          await Storage.relays.set(config);
        }
      },

      removeRelay: async (url) => {
        const config = await Storage.relays.get();
        config.relays = config.relays.filter(r => r.url !== url);
        await Storage.relays.set(config);
      }
    }
  };

  // ============================================
  // SECTION 4: CONTENT EXTRACTION
  // ============================================
  
  const ContentExtractor = {
    // Extract article using Readability (if available via @require)
    extractArticle: () => {
      try {
        // Clone document for Readability
        const documentClone = document.cloneNode(true);
        
        // Check if Readability is available
        if (typeof Readability !== 'undefined') {
          const reader = new Readability(documentClone);
          const article = reader.parse();
          
          if (!article || article.textContent.length < CONFIG.extraction.min_content_length) {
            console.log('[NAC] Readability extraction failed or content too short');
            return null;
          }
          
          // Add metadata
          article.url = ContentExtractor.getCanonicalUrl();
          article.domain = ContentExtractor.getDomain(article.url);
          article.extractedAt = Math.floor(Date.now() / 1000);
          
          // Extract publication date
          const dateResult = ContentExtractor.extractPublishedDate();
          if (dateResult) {
            article.publishedAt = dateResult.timestamp;
            article.publishedAtSource = dateResult.source;
          }
          
          // Extract featured image
          article.featuredImage = ContentExtractor.extractFeaturedImage();
          
          return article;
        } else {
          // Fallback: simple extraction
          return ContentExtractor.extractSimple();
        }
      } catch (e) {
        console.error('[NAC] Article extraction failed:', e);
        return ContentExtractor.extractSimple();
      }
    },

    // Simple fallback extraction
    extractSimple: () => {
      const title = document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('meta[property="og:title"]')?.content ||
                    document.title;
      
      const byline = document.querySelector('meta[name="author"]')?.content ||
                     document.querySelector('.author')?.textContent?.trim() || '';
      
      const content = document.querySelector('article')?.innerHTML ||
                     document.querySelector('.post-content')?.innerHTML ||
                     document.querySelector('.entry-content')?.innerHTML ||
                     document.body.innerHTML;
      
      return {
        title,
        byline,
        content,
        textContent: content.replace(/<[^>]+>/g, ''),
        url: ContentExtractor.getCanonicalUrl(),
        domain: ContentExtractor.getDomain(window.location.href),
        extractedAt: Math.floor(Date.now() / 1000)
      };
    },

    // Get canonical URL
    getCanonicalUrl: () => {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) return canonical.href;
      
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl && ogUrl.content) return ogUrl.content;
      
      return window.location.href;
    },

    // Extract domain from URL
    getDomain: (url) => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch (e) {
        return '';
      }
    },

    // Normalize URL (remove tracking params)
    normalizeUrl: (url) => {
      try {
        const parsed = new URL(url);
        const trackingParams = [
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'fbclid', 'gclid', '_ga', 'ref', 'source'
        ];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        parsed.hash = '';
        return parsed.toString();
      } catch (e) {
        return url;
      }
    },

    // Extract published date
    extractPublishedDate: () => {
      // Try JSON-LD
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const articles = Array.isArray(data) ? data : [data];
          for (const item of articles) {
            if (item['@type'] === 'Article' || item['@type'] === 'NewsArticle' || item['@type'] === 'BlogPosting') {
              if (item.datePublished) {
                const date = new Date(item.datePublished);
                if (!isNaN(date.getTime())) {
                  return { timestamp: Math.floor(date.getTime() / 1000), source: 'json-ld' };
                }
              }
            }
          }
        } catch (e) {
          // Continue to next
        }
      }
      
      // Try meta tags
      const metaSelectors = [
        'meta[property="article:published_time"]',
        'meta[name="publication_date"]',
        'meta[name="date"]'
      ];
      
      for (const selector of metaSelectors) {
        const meta = document.querySelector(selector);
        if (meta && meta.content) {
          const date = new Date(meta.content);
          if (!isNaN(date.getTime())) {
            return { timestamp: Math.floor(date.getTime() / 1000), source: 'meta-tag' };
          }
        }
      }
      
      // Try time elements
      const timeEl = document.querySelector('article time[datetime], .post time[datetime]');
      if (timeEl) {
        const datetime = timeEl.getAttribute('datetime');
        const date = new Date(datetime);
        if (!isNaN(date.getTime())) {
          return { timestamp: Math.floor(date.getTime() / 1000), source: 'time-element' };
        }
      }
      
      return null;
    },

    // Extract featured image
    extractFeaturedImage: () => {
      const selectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'article img',
        '.featured-image img'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const src = element.getAttribute('content') || element.getAttribute('src');
          if (src) {
            try {
              return new URL(src, window.location.href).href;
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      return null;
    },

    // Convert HTML to Markdown (if Turndown is available)
    htmlToMarkdown: (html) => {
      try {
        if (typeof TurndownService !== 'undefined') {
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
          });
          return turndown.turndown(html);
        } else {
          // Fallback: basic HTML cleanup
          return html.replace(/<[^>]+>/g, '');
        }
      } catch (e) {
        console.error('[NAC] Markdown conversion failed:', e);
        return html.replace(/<[^>]+>/g, '');
      }
    },

    // Convert image URL to base64
    imageToBase64: async (imageUrl) => {
      return new Promise((resolve) => {
        try {
          const absoluteUrl = new URL(imageUrl, window.location.href).href;
          
          GM_xmlhttpRequest({
            method: 'GET',
            url: absoluteUrl,
            responseType: 'blob',
            timeout: 30000,
            onload: (response) => {
              if (response.status >= 200 && response.status < 300) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(absoluteUrl);
                reader.readAsDataURL(response.response);
              } else {
                resolve(absoluteUrl);
              }
            },
            onerror: () => resolve(absoluteUrl),
            ontimeout: () => resolve(absoluteUrl)
          });
        } catch (e) {
          resolve(imageUrl);
        }
      });
    },

    // Embed images in markdown as base64
    embedImagesInMarkdown: async (markdown) => {
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const matches = [...markdown.matchAll(imageRegex)];
      
      if (matches.length === 0) return markdown;
      
      let result = markdown;
      for (const match of matches) {
        const [fullMatch, alt, url] = match;
        if (url.startsWith('data:')) continue;
        
        const base64 = await ContentExtractor.imageToBase64(url);
        if (base64 && base64.startsWith('data:')) {
          result = result.replace(fullMatch, `![${alt}](${base64})`);
        }
      }
      
      return result;
    }
  };

  // ============================================
  // SECTION 5: UTILITIES
  // ============================================
  
  const Utils = {
    // Show toast notification
    showToast: (message, type = 'info') => {
      const toast = document.createElement('div');
      toast.className = 'nac-toast nac-toast-' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => toast.classList.add('visible'), 100);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    // Log with prefix
    log: (...args) => {
      if (CONFIG.debug) {
        console.log('[NAC]', ...args);
      }
    },

    // Error log
    error: (...args) => {
      console.error('[NAC]', ...args);
    }
  };

  // ============================================
  // SECTION 6: ENTITY TAGGER - Text selection popover
  // ============================================
  
  const EntityTagger = {
    popover: null,
    selectedText: '',

    // Show entity tagging popover
    show: (text, x, y) => {
      EntityTagger.selectedText = text;
      
      // Remove existing popover
      EntityTagger.hide();
      
      // Create popover
      EntityTagger.popover = document.createElement('div');
      EntityTagger.popover.className = 'nac-entity-popover';
      EntityTagger.popover.style.left = x + 'px';
      EntityTagger.popover.style.top = (y - 120) + 'px';
      
      EntityTagger.popover.innerHTML = `
        <div class="nac-popover-title">Tag "${text}"</div>
        <div class="nac-entity-type-buttons">
          <button class="nac-btn-entity-type" data-type="person">👤 Person</button>
          <button class="nac-btn-entity-type" data-type="organization">🏢 Org</button>
          <button class="nac-btn-entity-type" data-type="place">📍 Place</button>
        </div>
        <div id="nac-entity-search-results"></div>
      `;
      
      document.body.appendChild(EntityTagger.popover);
      
      // Event listeners
      document.querySelectorAll('.nac-btn-entity-type').forEach(btn => {
        btn.addEventListener('click', () => EntityTagger.selectType(btn.dataset.type));
      });
      
      // Click outside to close
      setTimeout(() => {
        document.addEventListener('click', EntityTagger.handleOutsideClick);
      }, 100);
    },

    // Hide popover
    hide: () => {
      if (EntityTagger.popover) {
        EntityTagger.popover.remove();
        EntityTagger.popover = null;
      }
      document.removeEventListener('click', EntityTagger.handleOutsideClick);
    },

    // Handle click outside popover
    handleOutsideClick: (e) => {
      if (EntityTagger.popover && !EntityTagger.popover.contains(e.target)) {
        EntityTagger.hide();
      }
    },

    // Select entity type and search for existing
    selectType: async (type) => {
      const resultsEl = document.getElementById('nac-entity-search-results');
      resultsEl.innerHTML = '<div class="nac-spinner"></div> Searching...';
      
      // Search for existing entities
      const results = await Storage.entities.search(EntityTagger.selectedText, type);
      
      if (results.length > 0) {
        resultsEl.innerHTML = `
          <div class="nac-search-results">
            <div class="nac-results-header">Existing matches:</div>
            ${results.map(entity => `
              <button class="nac-btn-link-entity" data-id="${entity.id}">
                ${entity.name} (${entity.type})
              </button>
            `).join('')}
          </div>
          <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
            Create New ${type}
          </button>
        `;
        
        // Event listeners for linking
        document.querySelectorAll('.nac-btn-link-entity').forEach(btn => {
          btn.addEventListener('click', () => EntityTagger.linkEntity(btn.dataset.id));
        });
      } else {
        resultsEl.innerHTML = `
          <div class="nac-no-results">No existing ${type}s found</div>
          <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
            Create New ${type}
          </button>
        `;
      }
      
      document.getElementById('nac-create-new-entity')?.addEventListener('click', () => {
        EntityTagger.createEntity(type);
      });
    },

    // Create new entity
    createEntity: async (type) => {
      try {
        // Generate keypair for entity
        const privkey = Crypto.generatePrivateKey();
        const pubkey = Crypto.getPublicKey(privkey);
        
        // Create entity ID (hash of type + name)
        const entityId = 'entity_' + await Crypto.sha256(type + EntityTagger.selectedText);
        
        // Get current user
        const userIdentity = await Storage.identity.get();
        
        // Save entity
        const entity = await Storage.entities.save(entityId, {
          id: entityId,
          type,
          name: EntityTagger.selectedText,
          aliases: [],
          keypair: {
            pubkey,
            privkey,
            npub: Crypto.hexToNpub(pubkey),
            nsec: Crypto.hexToNsec(privkey)
          },
          created_by: userIdentity?.pubkey || 'unknown',
          created_at: Math.floor(Date.now() / 1000),
          articles: [{
            url: ReaderView.article.url,
            title: ReaderView.article.title,
            context: 'mentioned',
            tagged_at: Math.floor(Date.now() / 1000)
          }],
          metadata: {}
        });
        
        // Add to current article
        ReaderView.entities.push({
          entity_id: entityId,
          context: 'mentioned'
        });
        
        // Update UI
        EntityTagger.addChip(entity);
        EntityTagger.hide();
        
        Utils.showToast(`Created ${type}: ${EntityTagger.selectedText}`, 'success');
      } catch (e) {
        console.error('[NAC] Failed to create entity:', e);
        Utils.showToast('Failed to create entity', 'error');
      }
    },

    // Link existing entity
    linkEntity: async (entityId) => {
      try {
        const entity = await Storage.entities.get(entityId);
        
        // Add current article to entity's articles list
        if (!entity.articles) entity.articles = [];
        entity.articles.push({
          url: ReaderView.article.url,
          title: ReaderView.article.title,
          context: 'mentioned',
          tagged_at: Math.floor(Date.now() / 1000)
        });
        
        await Storage.entities.save(entityId, entity);
        
        // Add to current article
        ReaderView.entities.push({
          entity_id: entityId,
          context: 'mentioned'
        });
        
        // Update UI
        EntityTagger.addChip(entity);
        EntityTagger.hide();
        
        Utils.showToast(`Linked entity: ${entity.name}`, 'success');
      } catch (e) {
        console.error('[NAC] Failed to link entity:', e);
        Utils.showToast('Failed to link entity', 'error');
      }
    },

    // Add entity chip to UI
    addChip: (entity) => {
      const chipsContainer = document.getElementById('nac-entity-chips');
      const chip = document.createElement('div');
      chip.className = 'nac-entity-chip nac-entity-' + entity.type;
      chip.innerHTML = `
        <span class="nac-chip-icon">${entity.type === 'person' ? '👤' : entity.type === 'organization' ? '🏢' : '📍'}</span>
        <span class="nac-chip-name">${entity.name}</span>
        <button class="nac-chip-remove" data-id="${entity.id}">×</button>
      `;
      
      chipsContainer.appendChild(chip);
      
      chip.querySelector('.nac-chip-remove').addEventListener('click', () => {
        chip.remove();
        ReaderView.entities = ReaderView.entities.filter(e => e.entity_id !== entity.id);
      });
    }
  };

  // ============================================
  // SECTION 7: NOSTR RELAY CLIENT
  // ============================================
  
  const RelayClient = {
    connections: new Map(),

    // Connect to relay
    connect: (url) => {
      return new Promise((resolve, reject) => {
        try {
          if (RelayClient.connections.has(url)) {
            resolve(RelayClient.connections.get(url));
            return;
          }
          
          const ws = new WebSocket(url);
          
          ws.onopen = () => {
            RelayClient.connections.set(url, ws);
            resolve(ws);
          };
          
          ws.onerror = (error) => {
            reject(error);
          };
          
          ws.onclose = () => {
            RelayClient.connections.delete(url);
          };
        } catch (e) {
          reject(e);
        }
      });
    },

    // Disconnect from relay
    disconnect: (url) => {
      const ws = RelayClient.connections.get(url);
      if (ws) {
        ws.close();
        RelayClient.connections.delete(url);
      }
    },

    // Disconnect all
    disconnectAll: () => {
      for (const ws of RelayClient.connections.values()) {
        ws.close();
      }
      RelayClient.connections.clear();
    },

    // Publish event to relays
    publish: async (event, relayUrls) => {
      const results = {};
      
      for (const url of relayUrls) {
        try {
          const ws = await RelayClient.connect(url);
          
          // Send event
          const message = JSON.stringify(['EVENT', event]);
          ws.send(message);
          
          // Wait for OK response
          const ok = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);
            
            const handler = (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data[0] === 'OK' && data[1] === event.id) {
                  clearTimeout(timeout);
                  ws.removeEventListener('message', handler);
                  resolve(data[2]); // true if accepted
                }
              } catch (err) {
                // Ignore parse errors
              }
            };
            
            ws.addEventListener('message', handler);
          });
          
          results[url] = {
            success: ok,
            error: ok ? null : 'Event rejected by relay'
          };
        } catch (e) {
          results[url] = {
            success: false,
            error: e.message
          };
        }
      }
      
      return results;
    },

    // Check if connected to relay
    isConnected: (url) => {
      const ws = RelayClient.connections.get(url);
      return ws && ws.readyState === WebSocket.OPEN;
    }
  };

  // ============================================
  // SECTION 8: EVENT BUILDER
  // ============================================
  
  const EventBuilder = {
    // Build NIP-23 article event (kind 30023)
    buildArticleEvent: async (article, entities, userPubkey) => {
      // Convert content to markdown
      let content = article.content;
      if (content.includes('<')) {
        content = ContentExtractor.htmlToMarkdown(content);
      }
      
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
      for (const entityRef of entities) {
        const entity = await Storage.entities.get(entityRef.entity_id);
        if (entity && entity.keypair) {
          // Add pubkey reference
          tags.push(['p', entity.keypair.pubkey, '', entityRef.context]);
          
          // Add name tag for clients that don't resolve pubkeys
          const tagType = entity.type === 'person' ? 'person' : entity.type === 'organization' ? 'org' : 'place';
          tags.push([tagType, entity.name, entityRef.context]);
        }
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
    buildProfileEvent: (entity) => {
      return {
        kind: 0,
        pubkey: entity.keypair.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          name: entity.name,
          about: `${entity.type} entity created by nostr-article-capture`,
          nip05: entity.nip05 || undefined
        })
      };
    }
  };

  // ============================================
  // SECTION 9: READER VIEW - Full-page takeover
  // ============================================
  
  const ReaderView = {
    container: null,
    article: null,
    entities: [],
    editMode: false,

    // Create and show reader view
    show: async (article) => {
      ReaderView.article = article;
      ReaderView.entities = [];
      
      // Hide original page content
      document.body.style.display = 'none';
      
      // Create reader container
      ReaderView.container = document.createElement('div');
      ReaderView.container.id = 'nac-reader-view';
      ReaderView.container.className = 'nac-reader-container';
      
      // Build UI
      ReaderView.container.innerHTML = `
        <div class="nac-reader-toolbar">
          <button class="nac-btn-back" id="nac-back-btn">← Back to Page</button>
          <div class="nac-toolbar-title">${article.domain || 'Article'}</div>
          <div class="nac-toolbar-actions">
            <button class="nac-btn-toolbar" id="nac-edit-btn">Edit</button>
            <button class="nac-btn-toolbar nac-btn-primary" id="nac-publish-btn">Publish</button>
            <button class="nac-btn-toolbar" id="nac-settings-btn">⚙</button>
          </div>
        </div>
        
        <div class="nac-reader-content">
          <div class="nac-reader-article">
            <div class="nac-article-header">
              <h1 class="nac-article-title" contenteditable="false" id="nac-title">${article.title || 'Untitled'}</h1>
              <div class="nac-article-meta">
                <span class="nac-meta-author" id="nac-author">${article.byline || 'Unknown Author'}</span>
                <span class="nac-meta-separator">•</span>
                <span class="nac-meta-publication" id="nac-publication">${article.siteName || article.domain}</span>
                <span class="nac-meta-separator">•</span>
                <span class="nac-meta-date" id="nac-date">${article.publishedAt ? new Date(article.publishedAt * 1000).toLocaleDateString() : 'Unknown Date'}</span>
              </div>
              <div class="nac-article-source">
                <span class="nac-source-label">Source:</span>
                <span class="nac-source-url">${article.url}</span>
                <button class="nac-btn-copy" id="nac-copy-url">Copy</button>
              </div>
              <div class="nac-article-archived">
                Archived: ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <div class="nac-article-body" id="nac-content" contenteditable="false">
              ${article.content || ''}
            </div>
          </div>
          
          <div class="nac-entity-bar">
            <div class="nac-entity-bar-title">Tagged Entities</div>
            <div class="nac-entity-chips" id="nac-entity-chips">
              <!-- Entity chips will be added here -->
            </div>
            <button class="nac-btn-add-entity" id="nac-add-entity-btn">+ Tag Entity</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(ReaderView.container);
      
      // Attach event listeners
      document.getElementById('nac-back-btn').addEventListener('click', ReaderView.hide);
      document.getElementById('nac-edit-btn').addEventListener('click', ReaderView.toggleEditMode);
      document.getElementById('nac-publish-btn').addEventListener('click', ReaderView.showPublishPanel);
      document.getElementById('nac-settings-btn').addEventListener('click', ReaderView.showSettings);
      document.getElementById('nac-copy-url').addEventListener('click', () => {
        navigator.clipboard.writeText(article.url);
        Utils.showToast('URL copied to clipboard');
      });
      
      // Enable text selection for entity tagging
      const contentEl = document.getElementById('nac-content');
      contentEl.addEventListener('mouseup', ReaderView.handleTextSelection);
      
      // Keyboard shortcuts
      document.addEventListener('keydown', ReaderView.handleKeyboard);
    },

    // Hide reader view and restore original page
    hide: () => {
      if (ReaderView.container) {
        ReaderView.container.remove();
        ReaderView.container = null;
      }
      document.body.style.display = '';
      document.removeEventListener('keydown', ReaderView.handleKeyboard);
    },

    // Toggle edit mode
    toggleEditMode: () => {
      ReaderView.editMode = !ReaderView.editMode;
      const titleEl = document.getElementById('nac-title');
      const contentEl = document.getElementById('nac-content');
      const editBtn = document.getElementById('nac-edit-btn');
      
      if (ReaderView.editMode) {
        titleEl.contentEditable = 'true';
        contentEl.contentEditable = 'true';
        editBtn.textContent = 'Done';
        editBtn.classList.add('active');
      } else {
        titleEl.contentEditable = 'false';
        contentEl.contentEditable = 'false';
        editBtn.textContent = 'Edit';
        editBtn.classList.remove('active');
        
        // Save changes
        ReaderView.article.title = titleEl.textContent;
        ReaderView.article.content = contentEl.innerHTML;
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
        EntityTagger.hide();
        if (document.getElementById('nac-publish-panel')) {
          ReaderView.hidePublishPanel();
        }
      } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        ReaderView.toggleEditMode();
      }
    },

    // Show publish panel
    showPublishPanel: async () => {
      const panel = document.createElement('div');
      panel.id = 'nac-publish-panel';
      panel.className = 'nac-publish-panel';
      
      const identity = await Storage.identity.get();
      const relayConfig = await Storage.relays.get();
      
      panel.innerHTML = `
        <div class="nac-publish-header">
          <h3>Publish to NOSTR</h3>
          <button class="nac-btn-close" id="nac-close-publish">×</button>
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
        identity?.pubkey
      );
      document.getElementById('nac-event-preview').textContent = JSON.stringify(event, null, 2);
      
      // Event listeners
      document.getElementById('nac-close-publish').addEventListener('click', ReaderView.hidePublishPanel);
      document.getElementById('nac-publish-confirm').addEventListener('click', ReaderView.publishArticle);
    },

    // Hide publish panel
    hidePublishPanel: () => {
      const panel = document.getElementById('nac-publish-panel');
      if (panel) panel.remove();
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
          identity.pubkey
        );
        
        // Sign event
        let signedEvent;
        if (signingMethod === 'nip07') {
          if (!window.nostr) {
            throw new Error('NIP-07 extension not found');
          }
          signedEvent = await window.nostr.signEvent(event);
        } else {
          if (!identity.privkey) {
            throw new Error('No private key available');
          }
          signedEvent = await Crypto.signEvent(event, identity.privkey);
        }
        
        // Get selected relays
        const relayCheckboxes = document.querySelectorAll('.nac-relay-list input[type="checkbox"]:checked');
        const relayUrls = Array.from(relayCheckboxes).map(cb => cb.value);
        
        // Publish to relays
        const results = await RelayClient.publish(signedEvent, relayUrls);
        
        // Show results
        let successCount = 0;
        let html = '<div class="nac-publish-results">';
        for (const [url, result] of Object.entries(results)) {
          if (result.success) {
            successCount++;
            html += `<div class="nac-result-success">✓ ${url}</div>`;
          } else {
            html += `<div class="nac-result-error">✗ ${url}: ${result.error}</div>`;
          }
        }
        html += '</div>';
        
        statusEl.innerHTML = html;
        
        if (successCount > 0) {
          btn.textContent = `Published to ${successCount} relay${successCount > 1 ? 's' : ''}`;
          Utils.showToast(`Article published successfully to ${successCount} relay${successCount > 1 ? 's' : ''}!`, 'success');
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

    // Show settings panel
    showSettings: async () => {
      const identity = await Storage.identity.get();
      const relayConfig = await Storage.relays.get();
      
      const panel = document.createElement('div');
      panel.id = 'nac-settings-panel';
      panel.className = 'nac-settings-panel';
      
      panel.innerHTML = `
        <div class="nac-publish-header">
          <h3>Settings</h3>
          <button class="nac-btn-close" id="nac-close-settings">×</button>
        </div>
        
        <div class="nac-publish-body">
          <h4>User Identity</h4>
          ${identity ? `
            <div class="nac-identity-info">
              <div><strong>Public Key:</strong> ${identity.npub || identity.pubkey}</div>
              <div><strong>Signer:</strong> ${identity.signer_type}</div>
              <button class="nac-btn" id="nac-clear-identity">Clear Identity</button>
            </div>
          ` : `
            <div>
              <button class="nac-btn" id="nac-connect-nip07">Connect NIP-07</button>
              <button class="nac-btn" id="nac-generate-keypair">Generate New Keypair</button>
            </div>
          `}
          
          <h4>Relays</h4>
          <div class="nac-relay-list">
            ${relayConfig.relays.map((r, i) => `
              <div class="nac-relay-item">
                <label class="nac-checkbox">
                  <input type="checkbox" ${r.enabled ? 'checked' : ''} data-index="${i}">
                  <span>${r.url}</span>
                </label>
              </div>
            `).join('')}
          </div>
          <button class="nac-btn" id="nac-add-relay">Add Relay</button>
          
          <h4>Entity Registry</h4>
          <button class="nac-btn" id="nac-export-entities">Export Entities</button>
          <button class="nac-btn" id="nac-import-entities">Import Entities</button>
          
          <div class="nac-version">Version ${CONFIG.version}</div>
        </div>
      `;
      
      ReaderView.container.appendChild(panel);
      
      // Event listeners
      document.getElementById('nac-close-settings').addEventListener('click', () => panel.remove());
      
      if (identity) {
        document.getElementById('nac-clear-identity').addEventListener('click', async () => {
          await Storage.identity.clear();
          panel.remove();
          Utils.showToast('Identity cleared');
        });
      } else {
        document.getElementById('nac-connect-nip07')?.addEventListener('click', async () => {
          if (window.nostr) {
            const pubkey = await window.nostr.getPublicKey();
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
      }
      
      // Relay checkboxes
      document.querySelectorAll('.nac-relay-item input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', async (e) => {
          const index = parseInt(e.target.dataset.index);
          relayConfig.relays[index].enabled = e.target.checked;
          await Storage.relays.set(relayConfig);
        });
      });
      
      document.getElementById('nac-export-entities')?.addEventListener('click', async () => {
        const json = await Storage.entities.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nostr-entities-' + Date.now() + '.json';
        a.click();
        Utils.showToast('Entities exported');
      });
    }
  };

  // ============================================
  // SECTION 10: STYLES
  // ============================================
  
  const STYLES = `
    /* CSS Variables */
    :root {
      --nac-primary: #6366f1;
      --nac-primary-hover: #4f46e5;
      --nac-success: #22c55e;
      --nac-error: #ef4444;
      --nac-bg: #fafaf9;
      --nac-text: #1a1a1a;
      --nac-text-muted: #6b7280;
      --nac-border: #e5e7eb;
      --nac-surface: #ffffff;
      --nac-entity-person: #8b5cf6;
      --nac-entity-org: #0891b2;
      --nac-entity-place: #16a34a;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --nac-bg: #1a1a1a;
        --nac-text: #e5e7eb;
        --nac-text-muted: #9ca3af;
        --nac-border: #374151;
        --nac-surface: #2a2a2a;
      }
    }
    
    /* FAB Button */
    .nac-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--nac-primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-size: 24px;
      color: white;
      transition: all 0.3s ease;
    }
    
    .nac-fab:hover {
      background: var(--nac-primary-hover);
      transform: scale(1.05);
    }
    
    /* Reader Container */
    .nac-reader-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--nac-bg);
      color: var(--nac-text);
      z-index: 999998;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    /* Toolbar */
    .nac-reader-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 20px;
      background: var(--nac-surface);
      border-bottom: 1px solid var(--nac-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .nac-toolbar-title {
      flex: 1;
      font-weight: 600;
      color: var(--nac-text-muted);
    }
    
    .nac-toolbar-actions {
      display: flex;
      gap: 8px;
    }
    
    .nac-btn-back,
    .nac-btn-toolbar {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    .nac-btn-back:hover,
    .nac-btn-toolbar:hover {
      background: var(--nac-bg);
    }
    
    .nac-btn-toolbar.nac-btn-primary {
      background: var(--nac-primary);
      color: white;
      border-color: var(--nac-primary);
    }
    
    .nac-btn-toolbar.active {
      background: var(--nac-success);
      color: white;
      border-color: var(--nac-success);
    }
    
    /* Reader Content */
    .nac-reader-content {
      flex: 1;
      overflow-y: auto;
      padding: 40px 20px;
    }
    
    .nac-reader-article {
      max-width: var(--reader-max-width, 680px);
      margin: 0 auto;
    }
    
    /* Article Header */
    .nac-article-header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--nac-border);
    }
    
    .nac-article-title {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 16px;
      outline: none;
    }
    
    .nac-article-title[contenteditable="true"] {
      padding: 8px;
      border: 2px dashed var(--nac-primary);
      border-radius: 4px;
    }
    
    .nac-article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 14px;
      color: var(--nac-text-muted);
      margin-bottom: 12px;
    }
    
    .nac-meta-separator {
      opacity: 0.5;
    }
    
    .nac-article-source {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--nac-text-muted);
      margin-bottom: 8px;
    }
    
    .nac-source-url {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
    }
    
    .nac-btn-copy {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text-muted);
      cursor: pointer;
      font-size: 12px;
    }
    
    .nac-article-archived {
      font-size: 12px;
      color: var(--nac-text-muted);
    }
    
    /* Article Body */
    .nac-article-body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      line-height: 1.7;
      outline: none;
    }
    
    .nac-article-body[contenteditable="true"] {
      padding: 16px;
      border: 2px dashed var(--nac-primary);
      border-radius: 4px;
    }
    
    .nac-article-body h1,
    .nac-article-body h2,
    .nac-article-body h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }
    
    .nac-article-body p {
      margin-bottom: 1em;
    }
    
    .nac-article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1.5em 0;
    }
    
    .nac-article-body blockquote {
      border-left: 3px solid var(--nac-primary);
      padding-left: 1em;
      margin: 1em 0;
      color: var(--nac-text-muted);
    }
    
    /* Entity Bar */
    .nac-entity-bar {
      max-width: var(--reader-max-width, 680px);
      margin: 32px auto 0;
      padding-top: 24px;
      border-top: 1px solid var(--nac-border);
    }
    
    .nac-entity-bar-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--nac-text-muted);
      margin-bottom: 12px;
    }
    
    .nac-entity-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .nac-entity-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
    }
    
    .nac-entity-chip.nac-entity-person {
      border-color: var(--nac-entity-person);
      background: rgba(139, 92, 246, 0.1);
    }
    
    .nac-entity-chip.nac-entity-organization {
      border-color: var(--nac-entity-org);
      background: rgba(8, 145, 178, 0.1);
    }
    
    .nac-entity-chip.nac-entity-place {
      border-color: var(--nac-entity-place);
      background: rgba(22, 163, 74, 0.1);
    }
    
    .nac-chip-remove {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: var(--nac-text-muted);
      padding: 0;
      line-height: 1;
    }
    
    .nac-btn-add-entity {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px dashed var(--nac-border);
      background: transparent;
      color: var(--nac-text-muted);
      cursor: pointer;
      font-size: 14px;
    }
    
    /* Entity Popover */
    .nac-entity-popover {
      position: absolute;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      z-index: 1000000;
      min-width: 280px;
    }
    
    .nac-popover-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--nac-text);
    }
    
    .nac-entity-type-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .nac-btn-entity-type {
      flex: 1;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      cursor: pointer;
      font-size: 13px;
    }
    
    .nac-btn-entity-type:hover {
      background: var(--nac-bg);
    }
    
    .nac-search-results {
      margin-bottom: 12px;
    }
    
    .nac-results-header {
      font-size: 12px;
      color: var(--nac-text-muted);
      margin-bottom: 8px;
    }
    
    .nac-btn-link-entity {
      display: block;
      width: 100%;
      padding: 8px;
      margin-bottom: 4px;
      border-radius: 4px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      cursor: pointer;
      text-align: left;
      font-size: 13px;
    }
    
    .nac-btn-link-entity:hover {
      background: var(--nac-bg);
    }
    
    .nac-no-results {
      font-size: 13px;
      color: var(--nac-text-muted);
      margin-bottom: 12px;
    }
    
    /* Publish Panel */
    .nac-publish-panel,
    .nac-settings-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 1000001;
      display: flex;
      flex-direction: column;
    }
    
    .nac-publish-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--nac-border);
    }
    
    .nac-publish-header h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .nac-btn-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--nac-text-muted);
    }
    
    .nac-publish-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .nac-form-group {
      margin-bottom: 16px;
    }
    
    .nac-form-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .nac-form-select,
    .nac-form-input {
      width: 100%;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-bg);
      color: var(--nac-text);
      font-size: 14px;
    }
    
    .nac-relay-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .nac-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    
    .nac-event-preview {
      background: var(--nac-bg);
      padding: 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
      max-height: 200px;
    }
    
    .nac-btn {
      padding: 10px 20px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    .nac-btn:hover {
      background: var(--nac-bg);
    }
    
    .nac-btn.nac-btn-primary {
      background: var(--nac-primary);
      color: white;
      border-color: var(--nac-primary);
      width: 100%;
    }
    
    .nac-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .nac-warning {
      padding: 12px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      font-size: 13px;
      color: var(--nac-text);
      margin-bottom: 16px;
    }
    
    .nac-publish-status {
      margin-top: 16px;
    }
    
    .nac-publish-results {
      font-size: 13px;
    }
    
    .nac-result-success {
      color: var(--nac-success);
      margin-bottom: 4px;
    }
    
    .nac-result-error {
      color: var(--nac-error);
      margin-bottom: 4px;
    }
    
    .nac-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--nac-border);
      border-top-color: var(--nac-primary);
      border-radius: 50%;
      animation: nac-spin 0.8s linear infinite;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
    }
    
    @keyframes nac-spin {
      to { transform: rotate(360deg); }
    }
    
    /* Toast */
    .nac-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--nac-surface);
      color: var(--nac-text);
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000002;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s;
    }
    
    .nac-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .nac-toast.nac-toast-success {
      border-left: 4px solid var(--nac-success);
    }
    
    .nac-toast.nac-toast-error {
      border-left: 4px solid var(--nac-error);
    }
    
    .nac-version {
      margin-top: 20px;
      font-size: 12px;
      color: var(--nac-text-muted);
      text-align: center;
    }
    
    .nac-identity-info {
      padding: 12px;
      background: var(--nac-bg);
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    
    .nac-identity-info div {
      margin-bottom: 8px;
    }
    
    .nac-relay-item {
      display: flex;
      align-items: center;
      padding: 8px;
      background: var(--nac-bg);
      border-radius: 4px;
      margin-bottom: 4px;
    }
  `;

  // ============================================
  // SECTION 11: INITIALIZATION
  // ============================================
  
  async function init() {
    Utils.log('Initializing NOSTR Article Capture v' + CONFIG.version);
    
    // Add styles
    GM_addStyle(STYLES);
    
    // Create FAB button
    const fab = document.createElement('button');
    fab.className = 'nac-fab';
    fab.innerHTML = '📰';
    fab.title = 'NOSTR Article Capture';
    
    fab.addEventListener('click', async () => {
      Utils.log('FAB clicked');
      
      // Extract article
      const article = ContentExtractor.extractArticle();
      
      if (!article) {
        Utils.showToast('No article content found on this page', 'error');
        return;
      }
      
      // Show reader view
      await ReaderView.show(article);
    });
    
    document.body.appendChild(fab);
    
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

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
