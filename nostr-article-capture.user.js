// ==UserScript==
// @name         NOSTR Article Capture
// @namespace    https://github.com/nostr-article-capture
// @version      2.0.1
// @updateURL    https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @downloadURL  https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/nostr-article-capture.user.js
// @description  Capture articles with clean reader view, entity tagging, and NOSTR publishing
// @author       Decentralized News Network
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
// @require      https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js
// @require      https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js
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
    version: '2.0.1',
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
        // BIP-340 Schnorr signing with provided private key
        // NIP-07 signing is handled by the caller (publishArticle)

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
    },

    // Recover full (x, y) point from x-only pubkey (even y)
    liftX: (pubkeyHex) => {
      const p = _SECP256K1.P;
      const x = BigInt('0x' + pubkeyHex);
      const c = _mod((_mod(x * x) * x + 7n), p);
      const y = _modPow(c, (p + 1n) / 4n, p);
      // Return even-y point
      return [x, _mod(y) % 2n === 0n ? y : p - y];
    },

    // ECDH shared secret: multiply privkey scalar by pubkey point, return x-coordinate
    getSharedSecret: async (privkeyHex, pubkeyHex) => {
      const point = Crypto.liftX(pubkeyHex);
      const privkey = BigInt('0x' + privkeyHex);
      const result = _pointMultiply(privkey, point);
      // Return x-coordinate as 32-byte hex
      return result[0].toString(16).padStart(64, '0');
    },

    // NIP-04 AES-256-CBC encrypt
    nip04Encrypt: async (plaintext, sharedSecretHex) => {
      const key = await crypto.subtle.importKey(
        'raw',
        Crypto.hexToBytes(sharedSecretHex),
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(16));
      const encoded = new TextEncoder().encode(plaintext);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoded);
      return btoa(String.fromCharCode(...new Uint8Array(ciphertext))) + '?iv=' + btoa(String.fromCharCode(...iv));
    },

    // NIP-04 AES-256-CBC decrypt
    nip04Decrypt: async (payload, sharedSecretHex) => {
      const [ciphertextB64, ivB64] = payload.split('?iv=');
      const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'raw',
        Crypto.hexToBytes(sharedSecretHex),
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    },

    // ── NIP-44 v2 Encryption ──

    // ChaCha20 block function — produces one 64-byte keystream block (pure JavaScript)
    _chacha20Block: (key, nonce, counter) => {
      // key: Uint8Array(32), nonce: Uint8Array(12), counter: number
      const s = new Uint32Array(16);
      // Constants: "expand 32-byte k"
      s[0] = 0x61707865; s[1] = 0x3320646e; s[2] = 0x79622d32; s[3] = 0x6b206574;
      // Key (little-endian uint32 words)
      const kv = new DataView(key.buffer, key.byteOffset, key.byteLength);
      for (let i = 0; i < 8; i++) s[4 + i] = kv.getUint32(i * 4, true);
      // Block counter
      s[12] = counter;
      // Nonce (little-endian uint32 words)
      const nv = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
      s[13] = nv.getUint32(0, true);
      s[14] = nv.getUint32(4, true);
      s[15] = nv.getUint32(8, true);
      // Working copy
      const w = new Uint32Array(s);
      const rotl = (x, n) => (x << n) | (x >>> (32 - n));
      function qr(a, b, c, d) {
        w[a] = (w[a] + w[b]) | 0; w[d] = rotl(w[d] ^ w[a], 16);
        w[c] = (w[c] + w[d]) | 0; w[b] = rotl(w[b] ^ w[c], 12);
        w[a] = (w[a] + w[b]) | 0; w[d] = rotl(w[d] ^ w[a], 8);
        w[c] = (w[c] + w[d]) | 0; w[b] = rotl(w[b] ^ w[c], 7);
      }
      // 20 rounds (10 double rounds: column + diagonal)
      for (let i = 0; i < 10; i++) {
        qr(0, 4, 8, 12); qr(1, 5, 9, 13); qr(2, 6, 10, 14); qr(3, 7, 11, 15);
        qr(0, 5, 10, 15); qr(1, 6, 11, 12); qr(2, 7, 8, 13); qr(3, 4, 9, 14);
      }
      // Add original state back
      for (let i = 0; i < 16; i++) w[i] = (w[i] + s[i]) | 0;
      // Serialize to 64 bytes (little-endian)
      const out = new Uint8Array(64);
      const ov = new DataView(out.buffer);
      for (let i = 0; i < 16; i++) ov.setUint32(i * 4, w[i], true);
      return out;
    },

    // ChaCha20 stream cipher — XOR data with keystream (same function encrypts and decrypts)
    _chacha20Encrypt: (key, nonce, data) => {
      // key: Uint8Array(32), nonce: Uint8Array(12), data: Uint8Array
      const out = new Uint8Array(data.length);
      const blocks = Math.ceil(data.length / 64);
      for (let i = 0; i < blocks; i++) {
        const block = Crypto._chacha20Block(key, nonce, i);
        const offset = i * 64;
        const len = Math.min(64, data.length - offset);
        for (let j = 0; j < len; j++) out[offset + j] = data[offset + j] ^ block[j];
      }
      return out;
    },

    // NIP-44 padding: calculate padded length per spec (chunk-based, not simple power-of-2)
    _nip44CalcPaddedLen: (unpaddedLen) => {
      if (unpaddedLen < 1) throw new Error('Invalid plaintext length');
      if (unpaddedLen > 65535) throw new Error('Plaintext too long for NIP-44');
      if (unpaddedLen <= 32) return 32;
      const nextPower = 1 << (32 - Math.clz32(unpaddedLen - 1));
      const chunk = Math.max(32, nextPower >> 3);
      return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
    },

    // NIP-44 pad: 2-byte big-endian length prefix + plaintext + zero-fill to padded length
    _nip44Pad: (plaintext) => {
      const textBytes = new TextEncoder().encode(plaintext);
      const unpaddedLen = textBytes.length;
      if (unpaddedLen < 1 || unpaddedLen > 65535) throw new Error('Plaintext length out of NIP-44 range');
      const paddedLen = Crypto._nip44CalcPaddedLen(unpaddedLen);
      const out = new Uint8Array(2 + paddedLen);
      out[0] = (unpaddedLen >> 8) & 0xff;
      out[1] = unpaddedLen & 0xff;
      out.set(textBytes, 2);
      return out;
    },

    // NIP-44 unpad: extract plaintext from padded buffer
    _nip44Unpad: (padded) => {
      const unpaddedLen = (padded[0] << 8) | padded[1];
      if (unpaddedLen < 1 || unpaddedLen + 2 > padded.length) throw new Error('Invalid NIP-44 padding');
      const expectedPaddedLen = Crypto._nip44CalcPaddedLen(unpaddedLen);
      if (padded.length !== 2 + expectedPaddedLen) throw new Error('Invalid NIP-44 padded length');
      for (let i = 2 + unpaddedLen; i < padded.length; i++) {
        if (padded[i] !== 0) throw new Error('Invalid NIP-44 padding: non-zero byte in padding region');
      }
      return new TextDecoder().decode(padded.slice(2, 2 + unpaddedLen));
    },

    // HMAC-SHA256 via SubtleCrypto
    _hmacSha256: async (key, data) => {
      const hmacKey = await crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', hmacKey, data);
      return new Uint8Array(sig);
    },

    // HKDF-extract: PRK = HMAC-SHA256(salt, ikm)
    _hkdfExtract: async (salt, ikm) => {
      return Crypto._hmacSha256(salt, ikm);
    },

    // HKDF-expand: derive output keying material from PRK
    _hkdfExpand: async (prk, info, length) => {
      const hashLen = 32;
      const n = Math.ceil(length / hashLen);
      const output = new Uint8Array(n * hashLen);
      let prev = new Uint8Array(0);
      for (let i = 1; i <= n; i++) {
        const input = new Uint8Array(prev.length + info.length + 1);
        input.set(prev, 0);
        input.set(info, prev.length);
        input[prev.length + info.length] = i;
        prev = await Crypto._hmacSha256(prk, input);
        output.set(prev, (i - 1) * hashLen);
      }
      return output.slice(0, length);
    },

    // NIP-44 conversation key: HKDF-extract(salt="nip44-v2", ikm=ECDH_shared_x)
    nip44GetConversationKey: async (privkeyHex, pubkeyHex) => {
      const sharedSecretHex = await Crypto.getSharedSecret(privkeyHex, pubkeyHex);
      const sharedSecret = Crypto.hexToBytes(sharedSecretHex);
      const salt = new TextEncoder().encode('nip44-v2');
      return Crypto._hkdfExtract(salt, sharedSecret);
    },

    // NIP-44 v2 encrypt: returns base64(0x02 + nonce(32) + ciphertext + hmac(32))
    nip44Encrypt: async (plaintext, conversationKey) => {
      const nonce = crypto.getRandomValues(new Uint8Array(32));
      const messageKey = await Crypto._hkdfExpand(conversationKey, nonce, 76);
      const chachaKey = messageKey.slice(0, 32);
      const chaChaNonce = messageKey.slice(32, 44);
      const hmacKey = messageKey.slice(44, 76);
      const padded = Crypto._nip44Pad(plaintext);
      const ciphertext = Crypto._chacha20Encrypt(chachaKey, chaChaNonce, padded);
      // HMAC-SHA256(hmac_key, nonce || ciphertext)
      const hmacInput = new Uint8Array(nonce.length + ciphertext.length);
      hmacInput.set(nonce, 0);
      hmacInput.set(ciphertext, nonce.length);
      const mac = await Crypto._hmacSha256(hmacKey, hmacInput);
      // Assemble: version(1) + nonce(32) + ciphertext + hmac(32)
      const payload = new Uint8Array(1 + 32 + ciphertext.length + 32);
      payload[0] = 0x02;
      payload.set(nonce, 1);
      payload.set(ciphertext, 33);
      payload.set(mac, 33 + ciphertext.length);
      let binary = '';
      for (let i = 0; i < payload.length; i++) binary += String.fromCharCode(payload[i]);
      return btoa(binary);
    },

    // NIP-44 v2 decrypt: base64 payload → plaintext (verifies HMAC, constant-time compare)
    nip44Decrypt: async (payload, conversationKey) => {
      const raw = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
      if (raw[0] !== 0x02) throw new Error('Unsupported NIP-44 version: ' + raw[0]);
      if (raw.length < 99) throw new Error('NIP-44 payload too short');
      const nonce = raw.slice(1, 33);
      const mac = raw.slice(raw.length - 32);
      const ciphertext = raw.slice(33, raw.length - 32);
      const messageKey = await Crypto._hkdfExpand(conversationKey, nonce, 76);
      const chachaKey = messageKey.slice(0, 32);
      const chaChaNonce = messageKey.slice(32, 44);
      const hmacKey = messageKey.slice(44, 76);
      // Verify HMAC (constant-time comparison)
      const hmacInput = new Uint8Array(nonce.length + ciphertext.length);
      hmacInput.set(nonce, 0);
      hmacInput.set(ciphertext, nonce.length);
      const expectedMac = await Crypto._hmacSha256(hmacKey, hmacInput);
      if (mac.length !== expectedMac.length) throw new Error('NIP-44 HMAC verification failed');
      let diff = 0;
      for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ expectedMac[i];
      if (diff !== 0) throw new Error('NIP-44 HMAC verification failed');
      // Decrypt with ChaCha20 and unpad
      const padded = Crypto._chacha20Encrypt(chachaKey, chaChaNonce, ciphertext);
      return Crypto._nip44Unpad(padded);
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
        Utils.showToast('Failed to save data. Storage may be full.', 'error');
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
        const result = await Storage.set('entity_registry', registry);

        // Check entity registry size after save
        const registryJson = JSON.stringify(registry);
        const sizeBytes = registryJson.length;
        if (sizeBytes > 5 * 1024 * 1024) {
          console.warn('[NAC Storage] Entity registry exceeds 5MB (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB). Consider cleaning up unused entities.');
          Utils.showToast('Entity registry is very large (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB). Consider removing unused entities.', 'error');
        } else if (sizeBytes > 2 * 1024 * 1024) {
          console.warn('[NAC Storage] Entity registry exceeds 2MB (' + (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB).');
        }

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
      },

      getLastSyncTime: async () => {
        return await Storage.get('entity_last_sync', 0);
      },

      setLastSyncTime: async (timestamp) => {
        await Storage.set('entity_last_sync', timestamp);
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
    },

    // Storage usage estimation
    getUsageEstimate: async () => {
      const identity = await Storage.get('user_identity', null);
      const entities = await Storage.get('entity_registry', {});
      const relays = await Storage.get('relay_config', {});
      const sync = await Storage.get('entity_last_sync', 0);

      const identitySize = JSON.stringify(identity || '').length;
      const entitiesSize = JSON.stringify(entities || '').length;
      const relaysSize = JSON.stringify(relays || '').length;
      const syncSize = JSON.stringify(sync || '').length;
      const totalBytes = identitySize + entitiesSize + relaysSize + syncSize;

      return {
        totalBytes,
        breakdown: {
          identity: identitySize,
          entities: entitiesSize,
          relays: relaysSize,
          sync: syncSize
        }
      };
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
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            emDelimiter: '*'
          });

          // Use GFM plugin for tables, strikethrough, task lists if available
          if (typeof turndownPluginGfm !== 'undefined') {
            turndown.use(turndownPluginGfm.gfm);
          }

          // Preserve images with alt text and src
          turndown.addRule('images', {
            filter: 'img',
            replacement: (content, node) => {
              const alt = node.getAttribute('alt') || '';
              const src = node.getAttribute('src') || '';
              const title = node.getAttribute('title');
              if (!src) return '';
              // Resolve relative URLs to absolute
              let absoluteSrc = src;
              try {
                absoluteSrc = new URL(src, window.location.href).href;
              } catch (e) { /* keep original */ }
              if (title) {
                return `![${alt}](${absoluteSrc} "${title}")`;
              }
              return `![${alt}](${absoluteSrc})`;
            }
          });

          // Preserve figure/figcaption as image + italic caption
          turndown.addRule('figure', {
            filter: 'figure',
            replacement: (content, node) => {
              const img = node.querySelector('img');
              const caption = node.querySelector('figcaption');
              let result = '';
              if (img) {
                const alt = img.getAttribute('alt') || caption?.textContent?.trim() || '';
                let src = img.getAttribute('src') || '';
                try { src = new URL(src, window.location.href).href; } catch (e) { /* keep original */ }
                result += `![${alt}](${src})`;
              }
              if (caption) {
                result += '\n*' + caption.textContent.trim() + '*';
              }
              return '\n\n' + result + '\n\n';
            }
          });

          // Preserve video/iframe embeds as links
          turndown.addRule('iframeEmbed', {
            filter: ['iframe', 'video'],
            replacement: (content, node) => {
              const src = node.getAttribute('src') || '';
              if (!src) return '';
              let absoluteSrc = src;
              try { absoluteSrc = new URL(src, window.location.href).href; } catch (e) { /* keep original */ }
              return `\n\n[Embedded media](${absoluteSrc})\n\n`;
            }
          });

          // Keep line breaks within paragraphs
          turndown.addRule('lineBreak', {
            filter: 'br',
            replacement: () => '  \n'
          });

          return turndown.turndown(html);
        } else {
          // Fallback: preserve structure without Turndown
          return ContentExtractor._fallbackHtmlToMarkdown(html);
        }
      } catch (e) {
        console.error('[NAC] Markdown conversion failed:', e);
        return ContentExtractor._fallbackHtmlToMarkdown(html);
      }
    },

    // Fallback HTML-to-Markdown when Turndown is not loaded
    // Preserves headings, paragraphs, images, links, lists, blockquotes, emphasis
    _fallbackHtmlToMarkdown: (html) => {
      let md = html;

      // Normalize line breaks
      md = md.replace(/\r\n?/g, '\n');

      // Headings
      md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
      md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
      md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
      md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
      md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
      md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

      // Images — extract alt and src, resolve to absolute URL
      md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, (m, src, alt) => {
        try { src = new URL(src, window.location.href).href; } catch (e) {}
        return `\n\n![${alt}](${src})\n\n`;
      });
      md = md.replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, alt, src) => {
        try { src = new URL(src, window.location.href).href; } catch (e) {}
        return `\n\n![${alt}](${src})\n\n`;
      });
      // img with src only (no alt)
      md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, src) => {
        try { src = new URL(src, window.location.href).href; } catch (e) {}
        return `\n\n![](${src})\n\n`;
      });

      // Links
      md = md.replace(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

      // Bold / Strong
      md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');

      // Italic / Emphasis
      md = md.replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '*$2*');

      // Blockquotes
      md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
        const lines = inner.replace(/<[^>]+>/g, '').trim().split('\n');
        return '\n\n' + lines.map(l => '> ' + l.trim()).join('\n') + '\n\n';
      });

      // Unordered list items
      md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, inner) => {
        return '- ' + inner.replace(/<[^>]+>/g, '').trim() + '\n';
      });
      md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

      // Horizontal rules
      md = md.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n');

      // Paragraphs and divs → double newline
      md = md.replace(/<\/p>/gi, '\n\n');
      md = md.replace(/<p[^>]*>/gi, '');
      md = md.replace(/<br\s*\/?>/gi, '  \n');

      // Code blocks
      md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n');
      md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

      // Strip remaining tags
      md = md.replace(/<[^>]+>/g, '');

      // Decode HTML entities
      md = md.replace(/&amp;/g, '&');
      md = md.replace(/&lt;/g, '<');
      md = md.replace(/&gt;/g, '>');
      md = md.replace(/&quot;/g, '"');
      md = md.replace(/&#039;/g, "'");
      md = md.replace(/&nbsp;/g, ' ');

      // Clean up excessive whitespace (but preserve double newlines for paragraphs)
      md = md.replace(/\n{3,}/g, '\n\n');
      md = md.trim();

      return md;
    },

    // Convert Markdown to HTML (lightweight renderer)
    // Handles the subset of markdown that htmlToMarkdown() produces
    markdownToHtml: (markdown) => {
      if (!markdown) return '';
      let html = markdown;

      // Escape HTML entities in the source (but preserve existing HTML-like structures minimally)
      html = html.replace(/&/g, '&amp;');
      html = html.replace(/</g, '&lt;');
      html = html.replace(/>/g, '&gt;');

      // Code blocks (fenced) — must be done before other block-level processing
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
        return `\n<pre><code>${code.trimEnd()}</code></pre>\n`;
      });

      // Code blocks (indented, 4 spaces) — collect consecutive indented lines
      html = html.replace(/(?:^|\n)((?:    .+\n?)+)/g, (m, block) => {
        const code = block.replace(/^    /gm, '');
        return `\n<pre><code>${code.trimEnd()}</code></pre>\n`;
      });

      // Inline code (must be before other inline processing)
      html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

      // Horizontal rules
      html = html.replace(/^---+$/gm, '<hr>');

      // Headings (atx style)
      html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
      html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
      html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

      // Images (must be before links)
      html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, src, title) => {
        const titleAttr = title ? ` title="${title}"` : '';
        return `<img src="${src}" alt="${alt}"${titleAttr}>`;
      });

      // Links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      // Bold and italic (bold first to handle ***)
      html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

      // Blockquotes — collect consecutive > lines into one blockquote
      html = html.replace(/(?:^&gt; .+$\n?)+/gm, (block) => {
        const inner = block.replace(/^&gt; ?/gm, '').trim();
        return `<blockquote><p>${inner}</p></blockquote>\n`;
      });

      // Unordered lists — collect consecutive - or * list items
      html = html.replace(/(?:^[\-\*] .+$\n?)+/gm, (block) => {
        const items = block.trim().split('\n').map(line => {
          const text = line.replace(/^[\-\*] /, '');
          return `<li>${text}</li>`;
        }).join('\n');
        return `<ul>\n${items}\n</ul>\n`;
      });

      // Ordered lists — collect consecutive numbered items
      html = html.replace(/(?:^\d+\. .+$\n?)+/gm, (block) => {
        const items = block.trim().split('\n').map(line => {
          const text = line.replace(/^\d+\. /, '');
          return `<li>${text}</li>`;
        }).join('\n');
        return `<ol>\n${items}\n</ol>\n`;
      });

      // Line breaks (two trailing spaces)
      html = html.replace(/ {2}\n/g, '<br>\n');

      // Paragraphs — split by double newlines, wrap non-block content in <p>
      const blocks = html.split(/\n{2,}/);
      html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        // Don't wrap block-level elements
        if (/^<(?:h[1-6]|p|ul|ol|li|blockquote|pre|hr|img|div)/i.test(block)) {
          return block;
        }
        return `<p>${block}</p>`;
      }).filter(Boolean).join('\n\n');

      return html;
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
    // HTML escape to prevent XSS when inserting user text into innerHTML
    escapeHtml: (str) => {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    },

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
    },

    // Make a non-button element keyboard-accessible (Enter/Space triggers click)
    makeKeyboardAccessible: (el) => {
      if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
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
        <div class="nac-popover-title">Tag "${Utils.escapeHtml(text)}"</div>
        <div class="nac-entity-type-buttons">
          <button class="nac-btn-entity-type" data-type="person" aria-label="Tag as Person">👤 Person</button>
          <button class="nac-btn-entity-type" data-type="organization" aria-label="Tag as Organization">🏢 Org</button>
          <button class="nac-btn-entity-type" data-type="place" aria-label="Tag as Place">📍 Place</button>
          <button class="nac-btn-entity-type" data-type="thing" aria-label="Tag as Thing">🔷 Thing</button>
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
                ${Utils.escapeHtml(entity.name)} (${entity.type})
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
        const articleEntry = {
          url: ReaderView.article.url,
          title: ReaderView.article.title,
          context: 'mentioned',
          tagged_at: Math.floor(Date.now() / 1000)
        };
        const existingIdx = entity.articles.findIndex(a => a.url === articleEntry.url);
        if (existingIdx >= 0) {
          entity.articles[existingIdx].tagged_at = articleEntry.tagged_at;
        } else {
          entity.articles.push(articleEntry);
        }
        
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
        EntityAutoSuggest.removeSuggestionByEntityId(entityId);
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
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-label', entity.type + ': ' + entity.name);
      chip.innerHTML = `
        <span class="nac-chip-icon">${entity.type === 'person' ? '👤' : entity.type === 'organization' ? '🏢' : entity.type === 'thing' ? '🔷' : '📍'}</span>
        <span class="nac-chip-name">${Utils.escapeHtml(entity.name)}</span>
        <button class="nac-chip-remove" data-id="${entity.id}" aria-label="Remove entity ${Utils.escapeHtml(entity.name)}">×</button>
      `;
      
      chipsContainer.appendChild(chip);
      
      chip.querySelector('.nac-chip-remove').addEventListener('click', () => {
        chip.remove();
        ReaderView.entities = ReaderView.entities.filter(e => e.entity_id !== entity.id);
      });
    }
  };

  // ============================================
  // SECTION 6B: ENTITY AUTO-SUGGESTION
  // ============================================

  const STOP_PHRASES = new Set([
    'the', 'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when',
    'what', 'which', 'who', 'whom', 'how', 'why', 'has', 'have', 'had',
    'but', 'and', 'for', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
    'our', 'out', 'are', 'also', 'been', 'from', 'had', 'has', 'his', 'its',
    'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let',
    'say', 'she', 'too', 'use', 'will', 'with', 'would', 'could', 'should',
    'about', 'after', 'again', 'being', 'below', 'between', 'both', 'during',
    'each', 'every', 'first', 'further', 'however', 'just', 'last', 'least',
    'like', 'long', 'many', 'more', 'most', 'much', 'must', 'next', 'only',
    'other', 'over', 'same', 'some', 'still', 'such', 'than', 'them', 'then',
    'they', 'very', 'well', 'were', 'while', 'your', 'according', 'although',
    'another', 'because', 'before', 'between', 'beyond', 'despite', 'either',
    'enough', 'instead', 'itself', 'neither', 'nothing', 'perhaps', 'several',
    'since', 'something', 'sometimes', 'still', 'though', 'through', 'together',
    'under', 'unless', 'until', 'upon', 'whether', 'within', 'without',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',
    'read more', 'click here', 'sign up', 'log in', 'subscribe',
    'skip advertisement', 'advertisement', 'sponsored content',
    'share this', 'related articles', 'top stories'
  ]);

  const ORG_KEYWORDS = ['inc', 'corp', 'llc', 'ltd', 'co', 'company', 'corporation',
    'university', 'college', 'institute', 'school', 'academy',
    'bank', 'fund', 'trust', 'group', 'association', 'foundation',
    'department', 'ministry', 'bureau', 'agency', 'commission',
    'hospital', 'clinic', 'church', 'mosque', 'temple'];

  const PLACE_KEYWORDS = ['city', 'county', 'state', 'province', 'district', 'region',
    'street', 'avenue', 'boulevard', 'road', 'park', 'lake', 'river',
    'mountain', 'island', 'ocean', 'sea', 'bay', 'peninsula'];

  const EntityAutoSuggest = {
    suggestions: [],
    dismissedIds: new Set(),
    maxVisible: 6,
    expanded: false,

    // Build a word-boundary regex that handles special characters
    buildWordBoundaryRegex: (term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // If term contains non-word chars (dots, hyphens), use lookaround
      if (/[^\w\s]/.test(term)) {
        return new RegExp('(?<=^|[\\s,;:!?\\.])' + escaped + '(?=$|[\\s,;:!?\\.])', 'i');
      }
      return new RegExp('\\b' + escaped + '\\b', 'i');
    },

    // Main entry point — scan article for entity suggestions
    scan: async (article) => {
      try {
        if (!article || !article.textContent) return;

        const registry = await Storage.entities.getAll();
        const existingEntities = ReaderView.entities.map(e => e.entity_id);
        const alreadyTaggedIds = new Set(existingEntities);
        const searchText = article.title + ' \n ' + article.textContent;

        // Phase 1: Known entity matching
        const knownMatches = EntityAutoSuggest.matchKnownEntities(searchText, article.title, alreadyTaggedIds, registry);

        // Phase 2: New entity discovery
        const discovered = EntityAutoSuggest.discoverEntities(searchText, knownMatches, registry);

        // Phase 3: Merge — known first, then discovered
        const suggestions = [...knownMatches, ...discovered];

        // Store suggestions
        EntityAutoSuggest.suggestions = suggestions;
        EntityAutoSuggest.expanded = false;
        EntityAutoSuggest.dismissedIds = new Set();

        // Render UI
        if (suggestions.length > 0) {
          const container = document.getElementById('nac-suggestion-bar');
          if (container) {
            EntityAutoSuggest.render(container, suggestions);
          }
        }
      } catch (e) {
        Utils.error('Entity auto-suggestion scan failed:', e);
      }
    },

    // Find known entities whose name or alias appears in the article
    matchKnownEntities: (text, title, alreadyTaggedIds, registry) => {
      const results = [];
      const entities = Object.values(registry);
      const lowerText = text.toLowerCase();

      for (const entity of entities) {
        if (alreadyTaggedIds.has(entity.id)) continue;

        const searchTerms = [entity.name, ...(entity.aliases || [])];

        for (const term of searchTerms) {
          if (!term || term.length < CONFIG.tagging.min_selection_length) continue;

          // Fast indexOf pre-filter before regex
          if (lowerText.indexOf(term.toLowerCase()) === -1) continue;

          // Confirm with word-boundary regex
          const regex = EntityAutoSuggest.buildWordBoundaryRegex(term);
          if (regex.test(text)) {
            results.push({
              type: 'known',
              entity: entity,
              entityId: entity.id,
              name: entity.name,
              matchedOn: term,
              occurrences: (text.match(new RegExp(regex.source, 'gi')) || []).length,
              position: text.search(regex)
            });
            break; // one match per entity is enough
          }
        }
      }

      // Sort by first appearance in text
      results.sort((a, b) => a.position - b.position);
      return results;
    },

    // Discover potential new entities from capitalized phrases
    discoverEntities: (text, knownMatches, registry) => {
      const candidates = new Map(); // name -> candidate object

      // Build set of known entity names/aliases for deduplication
      const knownNames = new Set();
      const knownMatchedNames = new Set();
      const entities = Object.values(registry);
      for (const entity of entities) {
        knownNames.add(entity.name.toLowerCase());
        (entity.aliases || []).forEach(a => knownNames.add(a.toLowerCase()));
      }
      for (const m of knownMatches) {
        knownMatchedNames.add(m.name.toLowerCase());
      }

      // Pass 1: Extract capitalized multi-word phrases (2-5 words)
      const CAPS_PHRASE = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|for|in|on|at|de|la|van|von)\s+)?(?:[A-Z][a-z]+\s*){1,4})\b/g;
      let capMatch;
      while ((capMatch = CAPS_PHRASE.exec(text)) !== null) {
        const phrase = capMatch[1].trim();
        const words = phrase.split(/\s+/);

        // Skip single words
        if (words.length < 2) continue;

        // Pass 2: Filter sentence-start false positives
        const pos = capMatch.index;
        if (pos > 0) {
          const preceding = text.substring(Math.max(0, pos - 3), pos).trim();
          const endsWithPunctuation = /[.!?]$/.test(preceding);
          if (endsWithPunctuation && words.length <= 2) continue;
        } else if (words.length <= 2) {
          continue; // start of text, only 2 words — likely sentence start
        }

        const lowerPhrase = phrase.toLowerCase();
        const firstWordLower = words[0].toLowerCase();

        // Stop phrase filter
        if (STOP_PHRASES.has(lowerPhrase)) continue;
        if (STOP_PHRASES.has(firstWordLower)) continue;

        // Skip if matches known entity
        if (knownNames.has(lowerPhrase)) continue;
        if (knownMatchedNames.has(lowerPhrase)) continue;

        // Check if candidate is a substring of a known entity name
        let isSubstring = false;
        for (const name of knownNames) {
          if (name.includes(lowerPhrase)) { isSubstring = true; break; }
        }
        if (isSubstring) continue;

        // Deduplicate — keep first occurrence, count occurrences
        if (candidates.has(lowerPhrase)) {
          candidates.get(lowerPhrase).occurrences++;
        } else {
          candidates.set(lowerPhrase, {
            type: 'discovered',
            name: phrase,
            guessedType: EntityAutoSuggest.guessType(phrase),
            occurrences: 1,
            position: pos
          });
        }
      }

      // Pass 3: Quoted name/title detection
      const QUOTED = /["\u201C]([A-Z][^"\u201D]{2,60})["\u201D]/g;
      let qMatch;
      while ((qMatch = QUOTED.exec(text)) !== null) {
        const quoted = qMatch[1].trim();
        const words = quoted.split(/\s+/);

        // Keep only short quoted strings (< 8 words, not full sentences)
        if (words.length >= 8) continue;
        if (words.length < 2) continue;

        const lowerQuoted = quoted.toLowerCase();

        // Skip if already captured or matches known
        if (candidates.has(lowerQuoted)) continue;
        if (knownNames.has(lowerQuoted)) continue;
        if (knownMatchedNames.has(lowerQuoted)) continue;
        if (STOP_PHRASES.has(words[0].toLowerCase())) continue;

        candidates.set(lowerQuoted, {
          type: 'discovered',
          name: quoted,
          guessedType: EntityAutoSuggest.guessType(quoted),
          occurrences: 1,
          position: qMatch.index
        });
      }

      // Convert to array, cap at 20, prefer those with multiple occurrences
      let result = Array.from(candidates.values());
      if (result.length > 20) {
        const multi = result.filter(c => c.occurrences >= 2);
        const single = result.filter(c => c.occurrences < 2);
        multi.sort((a, b) => a.position - b.position);
        single.sort((a, b) => a.position - b.position);
        result = [...multi, ...single].slice(0, 20);
      } else {
        result.sort((a, b) => a.position - b.position);
      }

      return result;
    },

    // Guess entity type from phrase patterns
    guessType: (phrase) => {
      const lowerPhrase = phrase.toLowerCase();
      const words = phrase.split(/\s+/);

      // Check for organization keywords
      for (const kw of ORG_KEYWORDS) {
        if (lowerPhrase.includes(kw)) return 'organization';
      }

      // Check for place keywords
      for (const kw of PLACE_KEYWORDS) {
        if (lowerPhrase.includes(kw)) return 'place';
      }

      // 2-word capitalized phrase — likely a person name
      if (words.length === 2 && /^[A-Z]/.test(words[0]) && /^[A-Z]/.test(words[1])) {
        return 'person';
      }

      // 3+ words with articles/prepositions — likely organization or thing
      if (words.length >= 3) return 'thing';

      return 'unknown';
    },

    // Get emoji for entity type
    _typeEmoji: (type) => {
      const map = { person: '\u{1F464}', organization: '\u{1F3E2}', place: '\u{1F4CD}', thing: '\u{1F537}', unknown: '\u2753' };
      return map[type] || '\u2753';
    },

    // Render the suggestion bar UI
    render: (container, suggestions) => {
      container.style.display = 'block';
      const count = suggestions.length;
      const visibleCount = EntityAutoSuggest.expanded ? count : Math.min(count, EntityAutoSuggest.maxVisible);
      const hiddenCount = count - EntityAutoSuggest.maxVisible;

      container.innerHTML = `
        <div class="nac-suggestion-bar-header">
          <span class="nac-suggestion-bar-title">\u2728 Suggested Entities (${count})</span>
          <button class="nac-suggestion-dismiss-all" aria-label="Dismiss all suggestions">Dismiss All</button>
        </div>
        <div class="nac-suggestion-chips">
          ${suggestions.slice(0, visibleCount).map((s, i) => EntityAutoSuggest._renderChip(s, i)).join('')}
        </div>
        ${!EntityAutoSuggest.expanded && hiddenCount > 0 ? `<button class="nac-suggestion-show-more" aria-label="Show ${hiddenCount} more suggestions">Show ${hiddenCount} more</button>` : ''}
      `;

      // Attach event listeners
      container.querySelector('.nac-suggestion-dismiss-all').addEventListener('click', EntityAutoSuggest.dismissAll);

      container.querySelectorAll('.nac-suggestion-accept').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.closest('.nac-suggestion-chip').dataset.index, 10);
          EntityAutoSuggest.acceptSuggestion(idx);
        });
      });

      container.querySelectorAll('.nac-suggestion-dismiss').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.closest('.nac-suggestion-chip').dataset.index, 10);
          EntityAutoSuggest.dismissSuggestion(idx);
        });
      });

      const showMoreBtn = container.querySelector('.nac-suggestion-show-more');
      if (showMoreBtn) {
        showMoreBtn.addEventListener('click', EntityAutoSuggest.toggleShowMore);
      }
    },

    // Render a single suggestion chip HTML
    _renderChip: (suggestion, index) => {
      const isKnown = suggestion.type === 'known';
      const typeClass = isKnown ? 'nac-suggestion-known' : 'nac-suggestion-discovered';
      const entityType = isKnown ? suggestion.entity.type : suggestion.guessedType;
      const emoji = EntityAutoSuggest._typeEmoji(entityType);
      const badge = isKnown ? 'known' : (entityType !== 'unknown' ? 'new \u00B7 ' + entityType : 'new');
      const actionLabel = isKnown ? 'Link' : 'Add';
      const name = Utils.escapeHtml(suggestion.name);
      const entityId = isKnown ? ` data-entity-id="${suggestion.entityId}"` : '';

      return `<div class="nac-suggestion-chip ${typeClass}" data-index="${index}"${entityId}>
        <span class="nac-suggestion-icon">${emoji}</span>
        <span class="nac-suggestion-name">${name}</span>
        <span class="nac-suggestion-badge">${badge}</span>
        <div class="nac-suggestion-actions">
          <button class="nac-suggestion-accept" aria-label="Accept: ${name}">\u2713 ${actionLabel}</button>
          <button class="nac-suggestion-dismiss" aria-label="Dismiss: ${name}">\u2715</button>
        </div>
      </div>`;
    },

    // Accept a known entity suggestion — link it
    acceptKnown: async (entity) => {
      try {
        if (!entity.articles) entity.articles = [];
        const articleEntry = {
          url: ReaderView.article.url,
          title: ReaderView.article.title,
          context: 'mentioned',
          tagged_at: Math.floor(Date.now() / 1000)
        };
        const existingIdx = entity.articles.findIndex(a => a.url === articleEntry.url);
        if (existingIdx >= 0) {
          entity.articles[existingIdx].tagged_at = articleEntry.tagged_at;
        } else {
          entity.articles.push(articleEntry);
        }

        await Storage.entities.save(entity.id, entity);
        ReaderView.entities.push({ entity_id: entity.id, context: 'mentioned' });
        EntityTagger.addChip(entity);
        Utils.showToast(`Linked entity: ${entity.name}`, 'success');
      } catch (e) {
        Utils.error('Failed to accept known entity suggestion:', e);
        Utils.showToast('Failed to link entity', 'error');
      }
    },

    // Accept a discovered entity suggestion — create and link it
    acceptDiscovered: async (name, guessedType) => {
      try {
        const type = (guessedType && guessedType !== 'unknown') ? guessedType : null;

        if (type) {
          // Create entity directly with guessed type
          const privkey = Crypto.generatePrivateKey();
          const pubkey = Crypto.getPublicKey(privkey);
          const entityId = 'entity_' + await Crypto.sha256(type + name);
          const userIdentity = await Storage.identity.get();

          const entity = await Storage.entities.save(entityId, {
            id: entityId,
            type,
            name,
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

          ReaderView.entities.push({ entity_id: entityId, context: 'mentioned' });
          EntityTagger.addChip(entity);
          Utils.showToast(`Created ${type}: ${name}`, 'success');
        } else {
          // No guessed type — show the popover for user to choose type
          EntityTagger.selectedText = name;
          const bar = document.getElementById('nac-suggestion-bar');
          const rect = bar ? bar.getBoundingClientRect() : { left: 100, top: 200 };
          EntityTagger.show(name, rect.left + window.scrollX, rect.top + window.scrollY);
        }
      } catch (e) {
        Utils.error('Failed to accept discovered entity suggestion:', e);
        Utils.showToast('Failed to create entity', 'error');
      }
    },

    // Accept a suggestion by index
    acceptSuggestion: async (index) => {
      const suggestion = EntityAutoSuggest.suggestions[index];
      if (!suggestion) return;

      if (suggestion.type === 'known') {
        await EntityAutoSuggest.acceptKnown(suggestion.entity);
      } else {
        await EntityAutoSuggest.acceptDiscovered(suggestion.name, suggestion.guessedType);
      }

      // Remove from suggestions
      EntityAutoSuggest.suggestions.splice(index, 1);
      EntityAutoSuggest._refreshUI();
    },

    // Dismiss a single suggestion
    dismissSuggestion: (index) => {
      const suggestion = EntityAutoSuggest.suggestions[index];
      if (suggestion) {
        EntityAutoSuggest.dismissedIds.add(suggestion.entityId || suggestion.name);
      }
      EntityAutoSuggest.suggestions.splice(index, 1);
      EntityAutoSuggest._refreshUI();
    },

    // Dismiss all suggestions
    dismissAll: () => {
      EntityAutoSuggest.suggestions = [];
      EntityAutoSuggest.dismissedIds = new Set();
      const container = document.getElementById('nac-suggestion-bar');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    },

    // Toggle show more / collapse
    toggleShowMore: () => {
      EntityAutoSuggest.expanded = !EntityAutoSuggest.expanded;
      EntityAutoSuggest._refreshUI();
    },

    // Refresh the suggestion bar UI
    _refreshUI: () => {
      const container = document.getElementById('nac-suggestion-bar');
      if (!container) return;

      if (EntityAutoSuggest.suggestions.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      EntityAutoSuggest.render(container, EntityAutoSuggest.suggestions);
    },

    // Remove a suggestion by entity ID (called when entity is manually tagged)
    removeSuggestionByEntityId: (entityId) => {
      const idx = EntityAutoSuggest.suggestions.findIndex(
        s => (s.type === 'known' && s.entityId === entityId)
      );
      if (idx >= 0) {
        EntityAutoSuggest.suggestions.splice(idx, 1);
        EntityAutoSuggest._refreshUI();
      }
    },

    // Clean up suggestion state
    destroy: () => {
      EntityAutoSuggest.suggestions = [];
      EntityAutoSuggest.dismissedIds = new Set();
      EntityAutoSuggest.expanded = false;
      const container = document.getElementById('nac-suggestion-bar');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    }
  };

  // ============================================
  // SECTION 7: NOSTR RELAY CLIENT
  // ============================================
  
  const RelayClient = {
    connections: new Map(),

    // Connect to relay
    connect: (url) => {
      const attemptConnect = () => {
        return new Promise((resolve, reject) => {
          try {
            // Check for cached connection with stale detection
            if (RelayClient.connections.has(url)) {
              const cached = RelayClient.connections.get(url);
              if (cached.readyState === WebSocket.CLOSING || cached.readyState === WebSocket.CLOSED) {
                RelayClient.connections.delete(url);
              } else {
                resolve(cached);
                return;
              }
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
      };

      // Retry with exponential backoff: 1s → 2s → 4s
      const MAX_RETRIES = 3;
      const BASE_DELAY = 1000;

      return (async () => {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await attemptConnect();
          } catch (err) {
            if (attempt < MAX_RETRIES) {
              const delay = BASE_DELAY * Math.pow(2, attempt);
              console.log(`[NAC Relay] Connection to ${url} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              throw new Error(`Failed to connect to ${url} after ${MAX_RETRIES + 1} attempts`);
            }
          }
        }
      })();
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
      const publishToRelay = async (url) => {
        const ws = await RelayClient.connect(url);
        
        // Send event
        const message = JSON.stringify(['EVENT', event]);
        ws.send(message);
        
        // Wait for OK response
        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve({ accepted: false, message: 'Timeout waiting for relay response' }), 5000);
          
          const handler = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data[0] === 'OK' && data[1] === event.id) {
                clearTimeout(timeout);
                ws.removeEventListener('message', handler);
                resolve({ accepted: data[2], message: data[3] || '' }); // data[3] = relay reason
              } else if (data[0] === 'NOTICE') {
                console.log(`[NAC Relay] NOTICE from ${url}: ${data[1]}`);
              }
            } catch (err) {
              // Ignore parse errors
            }
          };
          
          ws.addEventListener('message', handler);
        });
        
        return { url, success: result.accepted, error: result.accepted ? null : (result.message || 'Event rejected by relay') };
      };

      // Publish to all relays in parallel
      const settled = await Promise.allSettled(
        relayUrls.map(url => publishToRelay(url).catch(e => ({ url, success: false, error: e.message })))
      );

      const results = {};
      for (const result of settled) {
        const { url, success, error } = result.value;
        results[url] = { success, error };
      }
      return results;
    },

    // Check if connected to relay
    isConnected: (url) => {
      const ws = RelayClient.connections.get(url);
      return ws && ws.readyState === WebSocket.OPEN;
    },

    // Subscribe to relay events (REQ/EOSE pattern)
    subscribe: async (filter, relayUrls, options = {}) => {
      const timeout = options.timeout || 15000;
      const idleTimeout = options.idleTimeout || 10000;
      const events = [];
      const subId = Crypto.bytesToHex(crypto.getRandomValues(new Uint8Array(8)));

      for (const url of relayUrls) {
        try {
          const ws = await RelayClient.connect(url);
          ws.send(JSON.stringify(['REQ', subId, filter]));

          await new Promise((resolve) => {
            let idleTimer = setTimeout(resolve, idleTimeout);
            const totalTimer = setTimeout(resolve, timeout);

            const handler = (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data[0] === 'EVENT' && data[1] === subId) {
                  events.push(data[2]);
                  clearTimeout(idleTimer);
                  idleTimer = setTimeout(resolve, idleTimeout);
                } else if (data[0] === 'EOSE' && data[1] === subId) {
                  clearTimeout(idleTimer);
                  clearTimeout(totalTimer);
                  ws.removeEventListener('message', handler);
                  resolve();
                }
              } catch (parseErr) {
                console.error('[NAC RelayClient] Parse error:', parseErr);
              }
            };
            ws.addEventListener('message', handler);
          });

          try { ws.send(JSON.stringify(['CLOSE', subId])); } catch(e) {}
        } catch (e) {
          console.error('[NAC RelayClient] Subscribe error:', url, e);
        }
      }
      return events;
    }
  };

  // ============================================
  // SECTION 8: EVENT BUILDER
  // ============================================
  
  const EventBuilder = {
    // Build NIP-23 article event (kind 30023)
    buildArticleEvent: async (article, entities, userPubkey) => {
      // Convert content to markdown, preserving formatting and images
      let content = article.content;
      if (content && content.includes('<')) {
        content = ContentExtractor.htmlToMarkdown(content);
      }

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
      for (const entityRef of entities) {
        const entity = await Storage.entities.get(entityRef.entity_id);
        if (entity && entity.keypair) {
          // Add pubkey reference
          tags.push(['p', entity.keypair.pubkey, '', entityRef.context]);
          
          // Add name tag for clients that don't resolve pubkeys
          const tagType = entity.type === 'person' ? 'person' : entity.type === 'organization' ? 'org' : entity.type === 'thing' ? 'thing' : 'place';
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
    }
  };

  // ============================================================
  // SECTION 8.5: ENTITY SYNC
  // ============================================================

  const EntitySync = {
    validateEntity(entity) {
      return entity
        && typeof entity.id === 'string'
        && typeof entity.name === 'string'
        && ['person', 'organization', 'place', 'thing'].includes(entity.type)
        && entity.keypair
        && typeof entity.keypair.pubkey === 'string'
        && entity.keypair.pubkey.length === 64
        && typeof entity.updated === 'number';
    },

    mergeArticles(localArticles = [], remoteArticles = []) {
      const byUrl = new Map();
      for (const a of [...localArticles, ...remoteArticles]) {
        const existing = byUrl.get(a.url);
        if (!existing || a.tagged_at > existing.tagged_at) {
          byUrl.set(a.url, a);
        }
      }
      return Array.from(byUrl.values());
    },

    mergeEntities(localRegistry, remoteEntities) {
      const merged = { ...localRegistry };
      let stats = { imported: 0, updated: 0, unchanged: 0, keptLocal: 0 };

      for (const remote of remoteEntities) {
        const local = merged[remote.id];
        if (!local) {
          merged[remote.id] = remote;
          stats.imported++;
        } else if (remote.updated > local.updated) {
          merged[remote.id] = {
            ...remote,
            articles: EntitySync.mergeArticles(local.articles, remote.articles)
          };
          stats.updated++;
        } else if (remote.updated < local.updated) {
          merged[remote.id] = {
            ...local,
            articles: EntitySync.mergeArticles(local.articles, remote.articles)
          };
          stats.keptLocal++;
        } else {
          merged[remote.id] = {
            ...local,
            articles: EntitySync.mergeArticles(local.articles, remote.articles)
          };
          stats.unchanged++;
        }
      }
      return { merged, stats };
    },

    async push(options = {}) {
      const { publishProfiles = false, onProgress = () => {} } = options;

      const identity = await Storage.identity.get();
      if (!identity?.privkey) throw new Error('Entity sync requires a local private key');

      const registry = await Storage.entities.getAll();
      const entities = Object.values(registry);
      if (entities.length === 0) throw new Error('No entities to sync');

      onProgress({ phase: 'encrypting', total: entities.length });

      const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);

      const relayConfig = await Storage.relays.get();
      const writeRelays = relayConfig.relays.filter(r => r.enabled && r.write).map(r => r.url);
      if (writeRelays.length === 0) throw new Error('No write-enabled relays configured');

      const results = [];
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        onProgress({ phase: 'publishing', current: i + 1, total: entities.length, name: entity.name });

        try {
          const plaintext = JSON.stringify(entity);
          const encrypted = await Crypto.nip44Encrypt(plaintext, conversationKey);
          const event = EventBuilder.buildEntitySyncEvent(entity.id, encrypted, entity.type, identity.pubkey);
          const signed = await Crypto.signEvent(event, identity.privkey);
          const relayResults = await RelayClient.publish(signed, writeRelays);
          results.push({ entity: entity.name, id: entity.id, relayResults, success: true });
        } catch (e) {
          console.error('[NAC EntitySync] Push error for', entity.id, e);
          results.push({ entity: entity.name, id: entity.id, error: e.message, success: false });
        }
      }

      if (publishProfiles) {
        onProgress({ phase: 'profiles', total: entities.length });
        for (const entity of entities) {
          try {
            if (entity.keypair?.privkey) {
              const profileEvent = EventBuilder.buildProfileEvent(entity);
              const signed = await Crypto.signEvent(profileEvent, entity.keypair.privkey);
              await RelayClient.publish(signed, writeRelays);
            }
          } catch (e) {
            console.error('[NAC EntitySync] Profile publish error:', entity.id, e);
          }
        }
      }

      await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1000));
      onProgress({ phase: 'complete', results });
      return results;
    },

    async pull(options = {}) {
      const { onProgress = () => {} } = options;

      const identity = await Storage.identity.get();
      if (!identity?.privkey) throw new Error('Entity sync requires a local private key');

      onProgress({ phase: 'fetching' });

      const relayConfig = await Storage.relays.get();
      const readRelays = relayConfig.relays.filter(r => r.enabled && r.read).map(r => r.url);
      if (readRelays.length === 0) throw new Error('No read-enabled relays configured');

      const filter = {
        kinds: [30078],
        authors: [identity.pubkey],
        '#L': ['nac/entity-sync']
      };

      const rawEvents = await RelayClient.subscribe(filter, readRelays, { timeout: 15000, idleTimeout: 10000 });

      if (rawEvents.length === 0) {
        onProgress({ phase: 'complete', stats: { imported: 0, updated: 0, unchanged: 0, keptLocal: 0, total: 0 } });
        return { stats: { imported: 0, updated: 0, unchanged: 0, keptLocal: 0, total: 0 }, merged: {} };
      }

      const byDTag = new Map();
      for (const evt of rawEvents) {
        const dTag = evt.tags?.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;
        const existing = byDTag.get(dTag);
        if (!existing || evt.created_at > existing.created_at) {
          byDTag.set(dTag, evt);
        }
      }

      const uniqueEvents = Array.from(byDTag.values());
      onProgress({ phase: 'decrypting', total: uniqueEvents.length });

      const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);
      const sharedSecret = await Crypto.getSharedSecret(identity.privkey, identity.pubkey);

      const remoteEntities = [];
      for (const evt of uniqueEvents) {
        try {
          // Try NIP-44 first, fall back to NIP-04 for backward compatibility
          let decrypted;
          try {
            decrypted = await Crypto.nip44Decrypt(evt.content, conversationKey);
          } catch (_nip44Err) {
            decrypted = await Crypto.nip04Decrypt(evt.content, sharedSecret);
          }
          const entity = JSON.parse(decrypted);
          if (EntitySync.validateEntity(entity)) {
            remoteEntities.push(entity);
          } else {
            console.warn('[NAC EntitySync] Invalid entity structure, skipping:', entity?.id);
          }
        } catch (e) {
          console.error('[NAC EntitySync] Decrypt/parse error:', e);
        }
      }

      onProgress({ phase: 'merging', remote: remoteEntities.length });

      const localRegistry = await Storage.entities.getAll();
      const { merged, stats } = EntitySync.mergeEntities(localRegistry, remoteEntities);

      try {
        GM_setValue('entity_registry', JSON.stringify(merged));
      } catch (e) {
        console.error('[NAC Storage] Failed to save merged entity registry:', e);
        Utils.showToast('Failed to save synced entities. Storage may be full.', 'error');
      }

      await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1000));
      stats.total = remoteEntities.length;
      onProgress({ phase: 'complete', stats });
      return { stats, merged };
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
    markdownMode: false,
    previewMode: false,
    _originalContentHtml: null,
    _hiddenElements: [],

    // Create and show reader view
    show: async (article) => {
      ReaderView.article = article;
      ReaderView.entities = [];
      
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
                <span class="nac-meta-publication nac-editable-field" id="nac-publication" data-field="siteName" title="Click to edit publication" role="button" tabindex="0" aria-label="Edit publication — click to change">${Utils.escapeHtml(article.siteName || article.domain || '')}</span>
                <span class="nac-meta-separator">•</span>
                <span class="nac-meta-date nac-editable-field" id="nac-date" data-field="publishedAt" title="Click to edit date" role="button" tabindex="0" aria-label="Edit date — click to change">${article.publishedAt ? ReaderView._formatDate(article.publishedAt) : 'Unknown Date'}</span>
              </div>
              <div class="nac-article-source">
                <span class="nac-source-label">Source:</span>
                <span class="nac-source-url">${article.url}</span>
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
          
          <!-- Suggestion bar will be injected here by EntityAutoSuggest -->
          <div id="nac-suggestion-bar" class="nac-suggestion-bar" style="display: none;"></div>
          
          <div class="nac-entity-bar">
            <div class="nac-entity-bar-title">Tagged Entities</div>
            <div class="nac-entity-chips" id="nac-entity-chips" role="list" aria-label="Tagged entities">
              <!-- Entity chips will be added here -->
            </div>
            <button class="nac-btn-add-entity" id="nac-add-entity-btn" aria-label="Tag a new entity">+ Tag Entity</button>
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
      document.getElementById('nac-copy-url').addEventListener('click', () => {
        navigator.clipboard.writeText(article.url);
        Utils.showToast('URL copied to clipboard');
      });
      
      // Tag Entity button handler
      document.getElementById('nac-add-entity-btn').addEventListener('click', (e) => {
        const name = prompt('Enter entity name to tag:');
        if (name && name.trim().length >= CONFIG.tagging.min_selection_length) {
          const rect = e.target.getBoundingClientRect();
          EntityTagger.show(name.trim(), rect.left + window.scrollX, rect.top + window.scrollY);
        }
      });
      
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
   },

    // Format a Unix timestamp as a readable date string
    _formatDate: (timestamp) => {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
      // Reset markdown/preview state
      ReaderView.markdownMode = false;
      ReaderView.previewMode = false;
      ReaderView._originalContentHtml = null;

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

      // Return focus to the FAB button
      const fab = document.querySelector('.nac-fab');
      if (fab) fab.focus();
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
      const eventJson = JSON.stringify(event, null, 2);
      const eventSizeKB = (new TextEncoder().encode(JSON.stringify(event)).length / 1024).toFixed(1);
      const sizeWarning = eventSizeKB > 64 ? ` ⚠️ Large event (${eventSizeKB} KB) — some relays may reject` : '';
      document.getElementById('nac-event-preview').textContent = `[Event size: ${eventSizeKB} KB${sizeWarning}]\n\n${eventJson}`;
      
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
          identity.pubkey
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
          return (bytes / 1024).toFixed(1) + ' KB';
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
            `<span style="font-size: 10px;">Entities: ${formatSize(usage.breakdown.entities)}, ` +
            `Identity: ${formatSize(usage.breakdown.identity)}, ` +
            `Relays: ${formatSize(usage.breakdown.relays)}</span>`;
        }
      } catch (e) {
        console.error('[NAC] Failed to calculate storage usage:', e);
      }
    }
  };

  // ============================================
  // SECTION 9B: ENTITY BROWSER - Browse/detail UI in settings
  // ============================================

  const EntityBrowser = {
    TYPE_EMOJI: { person: '👤', organization: '🏢', place: '📍', thing: '🔷' },
    TYPE_LABELS: { person: 'Person', organization: 'Org', place: 'Place', thing: 'Thing' },

    init: async (panel, identity) => {
      const container = panel.querySelector('#nac-entity-browser');
      if (!container) return;

      const registry = await Storage.entities.getAll();
      const entities = Object.values(registry);

      container.innerHTML = EntityBrowser.renderListView(entities);
      EntityBrowser.bindListEvents(container, panel, identity);
    },

    renderListView: (entities) => {
      const count = entities.length;
      return `
        <div class="nac-eb-list-view">
          <div class="nac-eb-search-bar">
            <input type="text" class="nac-eb-search" placeholder="Search entities…" id="nac-eb-search">
          </div>
          <div class="nac-eb-type-filters">
            <button class="nac-eb-type-btn active" data-filter="all">All (${count})</button>
            <button class="nac-eb-type-btn" data-filter="person" aria-label="Filter by Person">👤</button>
            <button class="nac-eb-type-btn" data-filter="organization" aria-label="Filter by Organization">🏢</button>
            <button class="nac-eb-type-btn" data-filter="place" aria-label="Filter by Place">📍</button>
            <button class="nac-eb-type-btn" data-filter="thing" aria-label="Filter by Thing">🔷</button>
          </div>
          <div class="nac-eb-entity-list" id="nac-eb-entity-list">
            ${EntityBrowser.renderEntityCards(entities)}
          </div>
          ${count === 0 ? '<div class="nac-eb-empty">No entities yet. Tag text in articles to create entities.</div>' : ''}
          <div class="nac-eb-actions">
            <button class="nac-btn" id="nac-eb-export">📤 Export</button>
            <button class="nac-btn" id="nac-eb-import">📥 Import</button>
          </div>
          <div class="nac-eb-sync-section">
            <div class="nac-eb-sync-title">🔄 Entity Sync</div>
            <div class="nac-eb-sync-desc">Sync entities across browsers via encrypted NOSTR events.</div>
            <label class="nac-eb-sync-label">
              <input type="checkbox" id="nac-publish-profiles" style="accent-color: var(--nac-primary);">
              Also publish entity profiles (kind 0 — public name only)
            </label>
            <div class="nac-eb-sync-buttons">
              <button id="nac-push-entities" class="nac-eb-sync-btn">⬆ Push to NOSTR</button>
              <button id="nac-pull-entities" class="nac-eb-sync-btn">⬇ Pull from NOSTR</button>
            </div>
            <div id="nac-sync-status" class="nac-eb-sync-status" style="display: none;"></div>
          </div>
        </div>
      `;
    },

    renderEntityCards: (entities) => {
      if (!entities.length) return '';
      const sorted = [...entities].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      return sorted.map(e => {
        const emoji = EntityBrowser.TYPE_EMOJI[e.type] || '🔷';
        const articleCount = (e.articles || []).length;
        const created = e.created_at ? new Date(e.created_at * 1000).toLocaleDateString() : 'Unknown';
        return `
          <div class="nac-eb-card nac-eb-card-${e.type}" data-entity-id="${Utils.escapeHtml(e.id)}" tabindex="0" role="button" aria-label="${Utils.escapeHtml(e.name)} — ${e.type}">
            <div class="nac-eb-card-main">
              <span class="nac-eb-card-emoji">${emoji}</span>
              <div class="nac-eb-card-info">
                <div class="nac-eb-card-name">${Utils.escapeHtml(e.name)}</div>
                <div class="nac-eb-card-meta">${articleCount} article${articleCount !== 1 ? 's' : ''} · ${created}</div>
              </div>
              <span class="nac-eb-card-arrow">›</span>
            </div>
          </div>
        `;
      }).join('');
    },

    bindListEvents: (container, panel, identity) => {
      // Search filter
      const searchInput = container.querySelector('#nac-eb-search');
      const typeButtons = container.querySelectorAll('.nac-eb-type-btn');
      let activeFilter = 'all';

      const filterEntities = async () => {
        const query = (searchInput?.value || '').toLowerCase();
        const registry = await Storage.entities.getAll();
        let entities = Object.values(registry);

        if (activeFilter !== 'all') {
          entities = entities.filter(e => e.type === activeFilter);
        }
        if (query) {
          entities = entities.filter(e =>
            e.name.toLowerCase().includes(query) ||
            (e.aliases || []).some(a => a.toLowerCase().includes(query))
          );
        }

        const listEl = container.querySelector('#nac-eb-entity-list');
        if (listEl) listEl.innerHTML = EntityBrowser.renderEntityCards(entities);

        // Re-bind card click + keyboard events
        container.querySelectorAll('.nac-eb-card').forEach(card => {
          card.addEventListener('click', () => {
            const entityId = card.dataset.entityId;
            EntityBrowser.showDetail(container, entityId, panel, identity);
          });
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              card.click();
            }
          });
        });
      };

      searchInput?.addEventListener('input', filterEntities);

      typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          typeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeFilter = btn.dataset.filter;
          filterEntities();
        });
      });

      // Card clicks + keyboard
      container.querySelectorAll('.nac-eb-card').forEach(card => {
        card.addEventListener('click', () => {
          const entityId = card.dataset.entityId;
          EntityBrowser.showDetail(container, entityId, panel, identity);
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });

      // Export handler
      container.querySelector('#nac-eb-export')?.addEventListener('click', async () => {
        const json = await Storage.entities.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nostr-entities-' + Date.now() + '.json';
        a.click();
        Utils.showToast('Entities exported', 'success');
      });

      // Import handler
      container.querySelector('#nac-eb-import')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const text = await file.text();
          try {
            const count = await Storage.entities.importAll(text);
            Utils.showToast(`Imported ${count} entities`, 'success');
            await EntityBrowser.init(panel, identity);
          } catch (err) {
            Utils.showToast('Import failed: ' + err.message, 'error');
          }
        };
        input.click();
      });

      // Sync: Push
      container.querySelector('#nac-push-entities')?.addEventListener('click', async () => {
        const statusEl = container.querySelector('#nac-sync-status');
        statusEl.style.display = 'block';
        const pushBtn = container.querySelector('#nac-push-entities');
        const pullBtn = container.querySelector('#nac-pull-entities');
        pushBtn.disabled = true;
        pullBtn.disabled = true;
        try {
          const publishProfiles = container.querySelector('#nac-publish-profiles')?.checked || false;
          await EntitySync.push({
            publishProfiles,
            onProgress: (p) => {
              if (p.phase === 'encrypting') statusEl.textContent = `⏳ Encrypting ${p.total} entities...`;
              else if (p.phase === 'publishing') statusEl.textContent = `⏳ Publishing entity ${p.current}/${p.total}: ${p.name}...`;
              else if (p.phase === 'profiles') statusEl.textContent = `⏳ Publishing ${p.total} entity profiles...`;
              else if (p.phase === 'complete') {
                const succeeded = p.results.filter(r => r.success).length;
                const failed = p.results.filter(r => !r.success).length;
                statusEl.innerHTML = `✅ Push complete: ${succeeded} entities published` + (failed > 0 ? `, <span style="color: var(--nac-error);">${failed} failed</span>` : '');
              }
            }
          });
        } catch (e) {
          statusEl.innerHTML = `<span style="color: var(--nac-error);">❌ ${Utils.escapeHtml(e.message)}</span>`;
        } finally {
          pushBtn.disabled = false;
          pullBtn.disabled = false;
        }
      });

      // Sync: Pull
      container.querySelector('#nac-pull-entities')?.addEventListener('click', async () => {
        const statusEl = container.querySelector('#nac-sync-status');
        statusEl.style.display = 'block';
        const pushBtn = container.querySelector('#nac-push-entities');
        const pullBtn = container.querySelector('#nac-pull-entities');
        pushBtn.disabled = true;
        pullBtn.disabled = true;
        try {
          await EntitySync.pull({
            onProgress: (p) => {
              if (p.phase === 'fetching') statusEl.textContent = '⏳ Fetching from relays...';
              else if (p.phase === 'decrypting') statusEl.textContent = `⏳ Received ${p.total} events, decrypting...`;
              else if (p.phase === 'merging') statusEl.textContent = `⏳ Merging ${p.remote} entities...`;
              else if (p.phase === 'complete') {
                if (p.stats.total === 0) {
                  statusEl.textContent = 'ℹ️ No entity sync events found on relays for this identity.';
                } else {
                  statusEl.innerHTML = `✅ Sync complete:<br>` +
                    `&nbsp;&nbsp;${p.stats.imported} new entities imported<br>` +
                    `&nbsp;&nbsp;${p.stats.updated} entities updated (newer remote)<br>` +
                    `&nbsp;&nbsp;${p.stats.unchanged} entities unchanged<br>` +
                    `&nbsp;&nbsp;${p.stats.keptLocal} entities kept (newer local)`;
                }
              }
            }
          });
          await EntityBrowser.init(panel, identity); // Refresh after pull
        } catch (e) {
          statusEl.innerHTML = `<span style="color: var(--nac-error);">❌ ${Utils.escapeHtml(e.message)}</span>`;
        } finally {
          pushBtn.disabled = false;
          pullBtn.disabled = false;
        }
      });

      // Disable sync if no privkey
      if (!identity?.privkey) {
        const pushEl = container.querySelector('#nac-push-entities');
        const pullEl = container.querySelector('#nac-pull-entities');
        if (pushEl) pushEl.disabled = true;
        if (pullEl) pullEl.disabled = true;
        const statusEl = container.querySelector('#nac-sync-status');
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.innerHTML = '⚠️ Entity sync requires a local private key. Import your nsec or generate a new keypair.';
        }
      }
    },

    showDetail: async (container, entityId, panel, identity) => {
      const entity = await Storage.entities.get(entityId);
      if (!entity) {
        Utils.showToast('Entity not found', 'error');
        return;
      }

      const emoji = EntityBrowser.TYPE_EMOJI[entity.type] || '🔷';
      const typeLabel = EntityBrowser.TYPE_LABELS[entity.type] || entity.type;
      const articles = entity.articles || [];
      const aliases = entity.aliases || [];
      const created = entity.created_at ? new Date(entity.created_at * 1000).toLocaleString() : 'Unknown';

      container.innerHTML = `
        <div class="nac-eb-detail">
          <button class="nac-eb-back" id="nac-eb-back">← Back to list</button>
          <div class="nac-eb-detail-header">
            <span class="nac-eb-detail-emoji">${emoji}</span>
            <h3 class="nac-eb-detail-name" id="nac-eb-detail-name" title="Click to rename" tabindex="0" role="button" aria-label="Rename entity ${Utils.escapeHtml(entity.name)}">${Utils.escapeHtml(entity.name)}</h3>
            <span class="nac-eb-detail-badge nac-eb-badge-${entity.type}">${typeLabel}</span>
          </div>
          <div class="nac-eb-detail-created">Created: ${created}</div>
          
          <div class="nac-eb-section">
            <div class="nac-eb-section-title">Aliases</div>
            <div class="nac-eb-aliases" id="nac-eb-aliases">
              ${aliases.map((a, i) => `
                <span class="nac-eb-alias">
                  ${Utils.escapeHtml(a)}
                  <button class="nac-eb-alias-remove" data-index="${i}" title="Remove alias">✕</button>
                </span>
              `).join('')}
              ${aliases.length === 0 ? '<span class="nac-eb-no-aliases">No aliases</span>' : ''}
            </div>
            <div class="nac-eb-alias-add">
              <input type="text" class="nac-eb-alias-input" id="nac-eb-alias-input" placeholder="Add alias…">
              <button class="nac-btn" id="nac-eb-add-alias">Add</button>
            </div>
          </div>
          
          <div class="nac-eb-section">
            <div class="nac-eb-section-title">Keypair</div>
            <div class="nac-eb-keypair">
              <div class="nac-eb-key-row">
                <span class="nac-eb-key-label">npub:</span>
                <code class="nac-eb-key-value">${Utils.escapeHtml(entity.keypair?.npub || 'N/A')}</code>
                <button class="nac-eb-copy-btn" data-copy="${Utils.escapeHtml(entity.keypair?.npub || '')}" title="Copy npub">📋</button>
              </div>
              <div class="nac-eb-key-row">
                <span class="nac-eb-key-label">nsec:</span>
                <code class="nac-eb-key-value nac-eb-nsec-hidden" id="nac-eb-nsec-value">••••••••••••••</code>
                <button class="nac-eb-copy-btn" id="nac-eb-toggle-nsec" title="Reveal nsec">👁</button>
                <button class="nac-eb-copy-btn" id="nac-eb-copy-nsec" title="Copy nsec">📋</button>
              </div>
            </div>
          </div>
          
          <div class="nac-eb-section">
            <div class="nac-eb-section-title">Articles (${articles.length})</div>
            <div class="nac-eb-articles" id="nac-eb-articles">
              ${articles.length === 0 ? '<div class="nac-eb-no-articles">No linked articles</div>' : ''}
              ${articles.map(a => `
                <div class="nac-eb-article-item">
                  <div class="nac-eb-article-title">${Utils.escapeHtml(a.title || 'Untitled')}</div>
                  <a class="nac-eb-article-url" href="${Utils.escapeHtml(a.url || '#')}" target="_blank" rel="noopener">${Utils.escapeHtml(a.url || '')}</a>
                  <div class="nac-eb-article-meta">
                    <span class="nac-eb-article-context">${Utils.escapeHtml(a.context || 'mentioned')}</span>
                    ${a.tagged_at ? `<span>· ${new Date(a.tagged_at * 1000).toLocaleDateString()}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="nac-eb-danger-zone">
            <button class="nac-eb-delete-btn" id="nac-eb-delete">🗑 Delete Entity</button>
          </div>
        </div>
      `;

      EntityBrowser.bindDetailEvents(container, entity, panel, identity);
    },

    bindDetailEvents: (container, entity, panel, identity) => {
      // Back button
      container.querySelector('#nac-eb-back')?.addEventListener('click', async () => {
        await EntityBrowser.init(panel, identity);
      });

      // Rename: click or Enter/Space on name to edit
      const nameEl = container.querySelector('#nac-eb-detail-name');
      const handleRename = () => {
        const currentName = entity.name;
        const newName = prompt('Rename entity:', currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
          entity.name = newName.trim();
          Storage.entities.save(entity.id, entity).then(() => {
            nameEl.textContent = entity.name;
            Utils.showToast('Entity renamed', 'success');
          });
        }
      };
      nameEl?.addEventListener('click', handleRename);
      nameEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRename();
        }
      });

      // Add alias
      container.querySelector('#nac-eb-add-alias')?.addEventListener('click', async () => {
        const input = container.querySelector('#nac-eb-alias-input');
        const alias = (input?.value || '').trim();
        if (!alias) return;
        if (!entity.aliases) entity.aliases = [];
        if (entity.aliases.includes(alias)) {
          Utils.showToast('Alias already exists', 'error');
          return;
        }
        entity.aliases.push(alias);
        await Storage.entities.save(entity.id, entity);
        Utils.showToast('Alias added', 'success');
        EntityBrowser.showDetail(container, entity.id, panel, identity);
      });

      // Remove alias buttons
      container.querySelectorAll('.nac-eb-alias-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          if (!entity.aliases || isNaN(index)) return;
          entity.aliases.splice(index, 1);
          await Storage.entities.save(entity.id, entity);
          Utils.showToast('Alias removed', 'success');
          EntityBrowser.showDetail(container, entity.id, panel, identity);
        });
      });

      // Toggle nsec visibility
      let nsecVisible = false;
      container.querySelector('#nac-eb-toggle-nsec')?.addEventListener('click', () => {
        const nsecEl = container.querySelector('#nac-eb-nsec-value');
        if (!nsecEl) return;
        nsecVisible = !nsecVisible;
        if (nsecVisible) {
          nsecEl.textContent = entity.keypair?.nsec || 'N/A';
          nsecEl.classList.remove('nac-eb-nsec-hidden');
          container.querySelector('#nac-eb-toggle-nsec').textContent = '🙈';
        } else {
          nsecEl.textContent = '••••••••••••••';
          nsecEl.classList.add('nac-eb-nsec-hidden');
          container.querySelector('#nac-eb-toggle-nsec').textContent = '👁';
        }
      });

      // Copy npub
      container.querySelectorAll('.nac-eb-copy-btn[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const text = btn.dataset.copy;
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            const orig = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = orig, 1500);
          } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            const orig = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = orig, 1500);
          }
        });
      });

      // Copy nsec
      container.querySelector('#nac-eb-copy-nsec')?.addEventListener('click', async () => {
        const nsec = entity.keypair?.nsec || '';
        if (!nsec) return;
        try {
          await navigator.clipboard.writeText(nsec);
          const btn = container.querySelector('#nac-eb-copy-nsec');
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = '📋', 1500);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = nsec;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          const btn = container.querySelector('#nac-eb-copy-nsec');
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = '📋', 1500);
        }
      });

      // Delete entity
      container.querySelector('#nac-eb-delete')?.addEventListener('click', async () => {
        if (!confirm(`Delete entity "${entity.name}"? This cannot be undone.`)) return;
        await Storage.entities.delete(entity.id);
        Utils.showToast('Entity deleted', 'success');
        await EntityBrowser.init(panel, identity);
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
      --nac-entity-thing: #4a9eff;
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
    
    .nac-editable-field {
      cursor: pointer;
      position: relative;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.2s, background-color 0.2s;
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    .nac-editable-field:hover {
      border-bottom-color: var(--nac-primary);
      background-color: rgba(99, 102, 241, 0.08);
    }
    
    .nac-editable-field:hover::after {
      content: ' ✏️';
      font-size: 11px;
    }
    
    .nac-inline-edit-input {
      background: transparent;
      border: none;
      border-bottom: 2px solid var(--nac-primary);
      color: var(--nac-text-muted);
      font: inherit;
      font-size: inherit;
      padding: 2px 4px;
      margin: 0;
      outline: none;
      width: auto;
      min-width: 120px;
      max-width: 300px;
      box-sizing: border-box;
    }
    
    .nac-inline-edit-input:focus {
      border-bottom-color: var(--nac-primary);
      background-color: rgba(99, 102, 241, 0.05);
    }
    
    .nac-inline-edit-input[type="date"] {
      min-width: 160px;
      color-scheme: dark;
    }
    
    @media (prefers-color-scheme: light) {
      .nac-inline-edit-input[type="date"] {
        color-scheme: light;
      }
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
    
    .nac-entity-chip.nac-entity-thing {
      border-color: var(--nac-entity-thing);
      background: rgba(74, 158, 255, 0.1);
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
    
    /* Suggestion Bar */
    .nac-suggestion-bar {
      max-width: var(--reader-max-width, 680px);
      margin: 24px auto 0;
      padding: 16px;
      background: var(--nac-surface);
      border: 1px solid var(--nac-border);
      border-radius: 8px;
    }
    
    .nac-suggestion-bar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .nac-suggestion-bar-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--nac-text-muted);
    }
    
    .nac-suggestion-dismiss-all {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--nac-text-muted);
      text-decoration: underline;
      padding: 0;
    }
    
    .nac-suggestion-dismiss-all:hover {
      color: var(--nac-error);
    }
    
    .nac-suggestion-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .nac-suggestion-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 13px;
      background: var(--nac-surface);
      border: 1px dashed var(--nac-border);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    
    .nac-suggestion-chip.nac-suggestion-known {
      border-color: var(--nac-primary);
      background: rgba(99, 102, 241, 0.06);
    }
    
    .nac-suggestion-chip.nac-suggestion-discovered {
      border-color: var(--nac-success);
      background: rgba(34, 197, 94, 0.06);
    }
    
    .nac-suggestion-icon {
      font-size: 14px;
    }
    
    .nac-suggestion-name {
      font-weight: 500;
      color: var(--nac-text);
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .nac-suggestion-badge {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      color: var(--nac-text-muted);
      background: var(--nac-bg);
      white-space: nowrap;
    }
    
    .nac-suggestion-actions {
      display: inline-flex;
      gap: 4px;
      margin-left: 4px;
    }
    
    .nac-suggestion-accept {
      background: none;
      border: 1px solid var(--nac-success);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: var(--nac-success);
      padding: 2px 6px;
      white-space: nowrap;
    }
    
    .nac-suggestion-accept:hover {
      background: var(--nac-success);
      color: white;
    }
    
    .nac-suggestion-dismiss {
      background: none;
      border: 1px solid var(--nac-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: var(--nac-text-muted);
      padding: 2px 6px;
    }
    
    .nac-suggestion-dismiss:hover {
      border-color: var(--nac-error);
      color: var(--nac-error);
    }
    
    .nac-suggestion-show-more {
      display: block;
      width: 100%;
      padding: 6px;
      background: none;
      border: 1px dashed var(--nac-border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--nac-text-muted);
      text-align: center;
    }
    
    .nac-suggestion-show-more:hover {
      background: var(--nac-bg);
      color: var(--nac-text);
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
      gap: 6px;
      transition: opacity 0.2s;
    }

    .nac-relay-item.nac-relay-disabled {
      opacity: 0.45;
    }

    .nac-relay-remove {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 3px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }

    .nac-relay-remove:hover {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.15);
    }
    
    /* Markdown Textarea */
    .nac-md-textarea {
      width: 100%;
      min-height: 400px;
      padding: 16px;
      border: 2px dashed var(--nac-primary);
      border-radius: 4px;
      background: var(--nac-bg);
      color: var(--nac-text);
      font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Consolas', 'Monaco', 'Andale Mono', monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
      tab-size: 4;
      white-space: pre-wrap;
      overflow: hidden;
    }
    
    .nac-md-textarea:focus {
      border-color: var(--nac-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    
    /* Markdown toggle button */
    .nac-btn-toolbar.nac-btn-md-toggle {
      font-size: 13px;
    }
    
    .nac-btn-toolbar.nac-btn-md-toggle.active {
      background: var(--nac-primary);
      color: white;
      border-color: var(--nac-primary);
    }
    
    /* ===== Entity Browser ===== */
    .nac-eb-list-view,
    .nac-eb-detail {
      font-size: 13px;
    }
    
    .nac-eb-search-bar {
      margin-bottom: 10px;
    }
    
    .nac-eb-search {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-bg);
      color: var(--nac-text);
      font-size: 13px;
      box-sizing: border-box;
    }
    
    .nac-eb-search:focus {
      outline: none;
      border-color: var(--nac-primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    
    .nac-eb-type-filters {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .nac-eb-type-btn {
      padding: 4px 10px;
      border-radius: 14px;
      border: 1px solid var(--nac-border);
      background: var(--nac-surface);
      color: var(--nac-text);
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
    }
    
    .nac-eb-type-btn:hover {
      background: var(--nac-bg);
    }
    
    .nac-eb-type-btn.active {
      background: var(--nac-primary);
      color: white;
      border-color: var(--nac-primary);
    }
    
    .nac-eb-entity-list {
      max-height: 240px;
      overflow-y: auto;
      margin-bottom: 12px;
      border: 1px solid var(--nac-border);
      border-radius: 8px;
    }
    
    .nac-eb-card {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--nac-border);
      transition: background 0.15s;
    }
    
    .nac-eb-card:last-child {
      border-bottom: none;
    }
    
    .nac-eb-card:hover {
      background: var(--nac-bg);
    }
    
    .nac-eb-card-person { border-left: 3px solid var(--nac-entity-person); }
    .nac-eb-card-organization { border-left: 3px solid var(--nac-entity-org); }
    .nac-eb-card-place { border-left: 3px solid var(--nac-entity-place); }
    .nac-eb-card-thing { border-left: 3px solid var(--nac-entity-thing); }
    
    .nac-eb-card-main {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    
    .nac-eb-card-emoji {
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .nac-eb-card-info {
      flex: 1;
      min-width: 0;
    }
    
    .nac-eb-card-name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .nac-eb-card-meta {
      font-size: 11px;
      color: var(--nac-text-muted);
      margin-top: 2px;
    }
    
    .nac-eb-card-arrow {
      font-size: 18px;
      color: var(--nac-text-muted);
      flex-shrink: 0;
    }
    
    .nac-eb-empty {
      text-align: center;
      color: var(--nac-text-muted);
      padding: 20px;
      font-size: 13px;
    }
    
    .nac-eb-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .nac-eb-actions .nac-btn {
      flex: 1;
      text-align: center;
      padding: 8px;
      font-size: 13px;
    }
    
    .nac-eb-sync-section {
      border-top: 1px solid var(--nac-border);
      padding-top: 12px;
    }
    
    .nac-eb-sync-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    
    .nac-eb-sync-desc {
      font-size: 11px;
      color: var(--nac-text-muted);
      margin-bottom: 8px;
    }
    
    .nac-eb-sync-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      margin-bottom: 10px;
      cursor: pointer;
    }
    
    .nac-eb-sync-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    
    .nac-eb-sync-btn {
      flex: 1;
      padding: 8px;
      background: var(--nac-primary);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: opacity 0.15s;
    }
    
    .nac-eb-sync-btn:hover {
      opacity: 0.9;
    }
    
    .nac-eb-sync-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .nac-eb-sync-status {
      font-size: 11px;
      color: var(--nac-text-muted);
      padding: 8px;
      background: var(--nac-bg);
      border-radius: 6px;
      min-height: 20px;
    }
    
    /* Detail view */
    .nac-eb-back {
      background: none;
      border: none;
      color: var(--nac-primary);
      cursor: pointer;
      font-size: 13px;
      padding: 0;
      margin-bottom: 12px;
    }
    
    .nac-eb-back:hover {
      text-decoration: underline;
    }
    
    .nac-eb-detail-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    
    .nac-eb-detail-emoji {
      font-size: 28px;
    }
    
    .nac-eb-detail-name {
      flex: 1;
      font-size: 18px;
      margin: 0;
      cursor: pointer;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.15s;
    }
    
    .nac-eb-detail-name:hover {
      border-bottom-color: var(--nac-primary);
    }
    
    .nac-eb-detail-badge {
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    
    .nac-eb-badge-person { background: rgba(139, 92, 246, 0.15); color: var(--nac-entity-person); }
    .nac-eb-badge-organization { background: rgba(8, 145, 178, 0.15); color: var(--nac-entity-org); }
    .nac-eb-badge-place { background: rgba(22, 163, 74, 0.15); color: var(--nac-entity-place); }
    .nac-eb-badge-thing { background: rgba(74, 158, 255, 0.15); color: var(--nac-entity-thing); }
    
    .nac-eb-detail-created {
      font-size: 11px;
      color: var(--nac-text-muted);
      margin-bottom: 16px;
    }
    
    .nac-eb-section {
      margin-bottom: 16px;
    }
    
    .nac-eb-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--nac-text-muted);
      margin-bottom: 8px;
    }
    
    .nac-eb-aliases {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    
    .nac-eb-alias {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      background: var(--nac-bg);
      border: 1px solid var(--nac-border);
      font-size: 12px;
    }
    
    .nac-eb-alias-remove {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--nac-text-muted);
      padding: 0 2px;
      line-height: 1;
    }
    
    .nac-eb-alias-remove:hover {
      color: var(--nac-error);
    }
    
    .nac-eb-no-aliases {
      color: var(--nac-text-muted);
      font-size: 12px;
      font-style: italic;
    }
    
    .nac-eb-alias-add {
      display: flex;
      gap: 6px;
    }
    
    .nac-eb-alias-input {
      flex: 1;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--nac-border);
      background: var(--nac-bg);
      color: var(--nac-text);
      font-size: 12px;
    }
    
    .nac-eb-alias-add .nac-btn {
      padding: 6px 12px;
      font-size: 12px;
    }
    
    .nac-eb-keypair {
      background: var(--nac-bg);
      border-radius: 6px;
      padding: 10px;
    }
    
    .nac-eb-key-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .nac-eb-key-row:last-child {
      margin-bottom: 0;
    }
    
    .nac-eb-key-label {
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
      width: 36px;
    }
    
    .nac-eb-key-value {
      flex: 1;
      font-family: monospace;
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    
    .nac-eb-nsec-hidden {
      color: var(--nac-text-muted);
    }
    
    .nac-eb-copy-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      flex-shrink: 0;
      border-radius: 4px;
      transition: background 0.15s;
    }
    
    .nac-eb-copy-btn:hover {
      background: var(--nac-border);
    }
    
    .nac-eb-articles {
      max-height: 160px;
      overflow-y: auto;
    }
    
    .nac-eb-article-item {
      padding: 8px;
      border: 1px solid var(--nac-border);
      border-radius: 6px;
      margin-bottom: 6px;
    }
    
    .nac-eb-article-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .nac-eb-article-url {
      font-size: 11px;
      color: var(--nac-primary);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    
    .nac-eb-article-url:hover {
      text-decoration: underline;
    }
    
    .nac-eb-article-meta {
      font-size: 11px;
      color: var(--nac-text-muted);
      margin-top: 3px;
      display: flex;
      gap: 4px;
    }
    
    .nac-eb-article-context {
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--nac-bg);
      border: 1px solid var(--nac-border);
      font-size: 10px;
    }
    
    .nac-eb-no-articles {
      color: var(--nac-text-muted);
      font-size: 12px;
      font-style: italic;
      padding: 8px 0;
    }
    
    .nac-eb-danger-zone {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--nac-border);
    }
    
    .nac-eb-delete-btn {
      width: 100%;
      padding: 8px;
      background: rgba(239, 68, 68, 0.1);
      color: var(--nac-error);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    
    .nac-eb-delete-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    
    /* Focus-visible styles for keyboard accessibility */
    .nac-fab:focus-visible,
    .nac-btn-back:focus-visible,
    .nac-btn-toolbar:focus-visible,
    .nac-btn:focus-visible,
    .nac-btn-copy:focus-visible,
    .nac-btn-close:focus-visible,
    .nac-btn-add-entity:focus-visible,
    .nac-btn-entity-type:focus-visible,
    .nac-btn-link-entity:focus-visible,
    .nac-chip-remove:focus-visible,
    .nac-relay-remove:focus-visible,
    .nac-eb-type-btn:focus-visible,
    .nac-eb-card:focus-visible,
    .nac-eb-back:focus-visible,
    .nac-eb-copy-btn:focus-visible,
    .nac-eb-alias-remove:focus-visible,
    .nac-eb-delete-btn:focus-visible,
    .nac-eb-sync-btn:focus-visible,
    .nac-eb-detail-name:focus-visible,
    .nac-form-select:focus-visible,
    .nac-form-input:focus-visible,
    .nac-editable-field:focus-visible,
    .nac-entity-chip:focus-visible {
      outline: 2px solid var(--nac-primary);
      outline-offset: 2px;
    }
    
    .nac-reader-container:focus {
      outline: none;
    }
    
    .nac-publish-panel:focus,
    .nac-settings-panel:focus {
      outline: none;
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
    fab.setAttribute('aria-label', 'Capture Article');
    
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
