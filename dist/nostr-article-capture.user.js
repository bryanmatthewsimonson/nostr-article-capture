// ==UserScript==
// @name         NOSTR Article Capture
// @namespace    https://github.com/nostr-article-capture
// @version      3.2.0
// @updateURL    https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/dist/nostr-article-capture.user.js
// @downloadURL  https://raw.githubusercontent.com/bryanmatthewsimonson/nostr-article-capture/main/dist/nostr-article-capture.user.js
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

(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/config.js
  var CONFIG, _state;
  var init_config = __esm({
    "src/config.js"() {
      CONFIG = {
        version: "3.2.0",
        debug: false,
        relays_default: [
          { url: "wss://nos.lol", read: true, write: true, enabled: true },
          { url: "wss://relay.primal.net", read: true, write: true, enabled: true },
          { url: "wss://relay.nostr.net", read: true, write: true, enabled: true },
          { url: "wss://nostr.mom", read: true, write: true, enabled: true },
          { url: "wss://relay.nostr.bg", read: true, write: true, enabled: true },
          { url: "wss://nostr.oxtr.dev", read: true, write: true, enabled: true },
          { url: "wss://relay.snort.social", read: true, write: true, enabled: true },
          { url: "wss://offchain.pub", read: true, write: true, enabled: true },
          { url: "wss://nostr-pub.wellorder.net", read: true, write: true, enabled: true },
          { url: "wss://nostr.fmt.wiz.biz", read: true, write: true, enabled: true }
        ],
        reader: {
          max_width: "680px",
          font_size: "18px",
          line_height: "1.7"
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
      _state = { nacFabRef: null };
    }
  });

  // src/crypto.js
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
      const s2 = _mod(3n * x1 * x1 * _modInverse(2n * y1));
      const x32 = _mod(s2 * s2 - 2n * x1);
      const y32 = _mod(s2 * (x1 - x32) - y1);
      return [x32, y32];
    }
    if (x1 === x2) return null;
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
  function _bech32Polymod(values) {
    const GEN = [996825010, 642813549, 513874426, 1027748829, 705979059];
    let chk = 1;
    for (const v of values) {
      const b = chk >> 25;
      chk = (chk & 33554431) << 5 ^ v;
      for (let i = 0; i < 5; i++) {
        if (b >> i & 1) chk ^= GEN[i];
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
    for (let i = 0; i < 6; i++) ret.push(polymod >> 5 * (5 - i) & 31);
    return ret;
  }
  function _bech32Encode(hrp, data) {
    const combined = data.concat(_bech32CreateChecksum(hrp, data));
    let ret = hrp + "1";
    for (const d of combined) ret += _BECH32_CHARSET.charAt(d);
    return ret;
  }
  function _bech32Decode(str) {
    str = str.toLowerCase();
    const pos = str.lastIndexOf("1");
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
      acc = acc << fromBits | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push(acc >> bits & maxv);
      }
    }
    if (pad) {
      if (bits > 0) ret.push(acc << toBits - bits & maxv);
    }
    return ret;
  }
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
  var _SECP256K1, _BECH32_CHARSET, Crypto;
  var init_crypto = __esm({
    "src/crypto.js"() {
      _SECP256K1 = {
        P: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F"),
        N: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"),
        Gx: BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"),
        Gy: BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8")
      };
      _BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
      Crypto = {
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
          return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        },
        // Generate a random private key (32 bytes)
        generatePrivateKey: () => {
          const privateKeyArray = new Uint8Array(32);
          crypto.getRandomValues(privateKeyArray);
          return Crypto.bytesToHex(privateKeyArray);
        },
        // Derive x-only public key from private key (secp256k1 point multiplication)
        getPublicKey: (privkeyHex) => {
          const privkey = BigInt("0x" + privkeyHex);
          if (privkey <= 0n || privkey >= _SECP256K1.N) {
            throw new Error("Invalid private key: out of range");
          }
          const point = _pointMultiply(privkey);
          if (!point) throw new Error("Invalid public key: point at infinity");
          return point[0].toString(16).padStart(64, "0");
        },
        // Encode 32-byte hex as bech32 npub
        hexToNpub: (hex) => {
          try {
            const bytes = Crypto.hexToBytes(hex);
            const words = _convertBits(Array.from(bytes), 8, 5, true);
            return _bech32Encode("npub", words);
          } catch (e) {
            console.error("[NAC Crypto] Failed to encode npub:", e);
            return null;
          }
        },
        // Decode bech32 npub to 32-byte hex
        npubToHex: (npub) => {
          try {
            const decoded = _bech32Decode(npub);
            if (!decoded || decoded.hrp !== "npub") return null;
            const bytes = _convertBits(decoded.data, 5, 8, false);
            return Crypto.bytesToHex(new Uint8Array(bytes));
          } catch (e) {
            console.error("[NAC Crypto] Failed to decode npub:", e);
            return null;
          }
        },
        // Encode 32-byte hex as bech32 nsec
        hexToNsec: (hex) => {
          try {
            const bytes = Crypto.hexToBytes(hex);
            const words = _convertBits(Array.from(bytes), 8, 5, true);
            return _bech32Encode("nsec", words);
          } catch (e) {
            console.error("[NAC Crypto] Failed to encode nsec:", e);
            return null;
          }
        },
        // Decode bech32 nsec to 32-byte hex
        nsecToHex: (nsec) => {
          try {
            const decoded = _bech32Decode(nsec);
            if (!decoded || decoded.hrp !== "nsec") return null;
            const bytes = _convertBits(decoded.data, 5, 8, false);
            return Crypto.bytesToHex(new Uint8Array(bytes));
          } catch (e) {
            console.error("[NAC Crypto] Failed to decode nsec:", e);
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
          const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
          return Crypto.bytesToHex(new Uint8Array(hashBuffer));
        },
        // BIP-340 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || msg)
        taggedHash: async (tag, ...msgs) => {
          const tagBytes = new TextEncoder().encode(tag);
          const tagHash = new Uint8Array(await crypto.subtle.digest("SHA-256", tagBytes));
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
          const hash = await crypto.subtle.digest("SHA-256", buf);
          return new Uint8Array(hash);
        },
        // Sign event with BIP-340 Schnorr signature
        signEvent: async (event, privkeyHex) => {
          try {
            const hash = await Crypto.getEventHash(event);
            event.id = hash;
            const d = BigInt("0x" + privkeyHex);
            const P = _pointMultiply(d);
            if (!P) throw new Error("Invalid private key");
            const dAdj = P[1] % 2n === 0n ? d : _SECP256K1.N - d;
            const dBytes = Crypto.hexToBytes(dAdj.toString(16).padStart(64, "0"));
            const pxBytes = Crypto.hexToBytes(P[0].toString(16).padStart(64, "0"));
            const msgBytes = Crypto.hexToBytes(hash);
            const nonceHash = await Crypto.taggedHash("BIP0340/nonce", dBytes, pxBytes, msgBytes);
            const k0 = BigInt("0x" + Crypto.bytesToHex(nonceHash)) % _SECP256K1.N;
            if (k0 === 0n) throw new Error("Invalid nonce");
            const R = _pointMultiply(k0);
            if (!R) throw new Error("Invalid nonce point");
            const k = R[1] % 2n === 0n ? k0 : _SECP256K1.N - k0;
            const rxBytes = Crypto.hexToBytes(R[0].toString(16).padStart(64, "0"));
            const eHash = await Crypto.taggedHash("BIP0340/challenge", rxBytes, pxBytes, msgBytes);
            const e = BigInt("0x" + Crypto.bytesToHex(eHash)) % _SECP256K1.N;
            const s = _mod(k + e * dAdj, _SECP256K1.N);
            const sig = R[0].toString(16).padStart(64, "0") + s.toString(16).padStart(64, "0");
            event.sig = sig;
            return event;
          } catch (e) {
            console.error("[NAC Crypto] Failed to sign event:", e);
            return null;
          }
        },
        // Verify BIP-340 Schnorr signature
        verifySignature: async (event) => {
          try {
            const hash = await Crypto.getEventHash(event);
            if (hash !== event.id) return false;
            const sig = event.sig;
            if (!sig || sig.length !== 128) return false;
            const rx = BigInt("0x" + sig.substring(0, 64));
            const s = BigInt("0x" + sig.substring(64, 128));
            const px = BigInt("0x" + event.pubkey);
            if (rx >= _SECP256K1.P || s >= _SECP256K1.N) return false;
            const pySquared = _mod(px * px * px + 7n);
            const py = _modPow(pySquared, (_SECP256K1.P + 1n) / 4n, _SECP256K1.P);
            if (_mod(py * py) !== pySquared) return false;
            const P = [px, py % 2n === 0n ? py : _SECP256K1.P - py];
            const rxBytes = Crypto.hexToBytes(rx.toString(16).padStart(64, "0"));
            const pxBytes = Crypto.hexToBytes(event.pubkey.padStart(64, "0"));
            const msgBytes = Crypto.hexToBytes(hash);
            const eHash = await Crypto.taggedHash("BIP0340/challenge", rxBytes, pxBytes, msgBytes);
            const e = BigInt("0x" + Crypto.bytesToHex(eHash)) % _SECP256K1.N;
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
          const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
          return Crypto.bytesToHex(new Uint8Array(hashBuffer));
        },
        // Recover full (x, y) point from x-only pubkey (even y)
        liftX: (pubkeyHex) => {
          const p = _SECP256K1.P;
          const x = BigInt("0x" + pubkeyHex);
          const c = _mod(_mod(x * x) * x + 7n, p);
          const y = _modPow(c, (p + 1n) / 4n, p);
          return [x, _mod(y) % 2n === 0n ? y : p - y];
        },
        // ECDH shared secret: multiply privkey scalar by pubkey point, return x-coordinate
        getSharedSecret: async (privkeyHex, pubkeyHex) => {
          const point = Crypto.liftX(pubkeyHex);
          const privkey = BigInt("0x" + privkeyHex);
          const result = _pointMultiply(privkey, point);
          return result[0].toString(16).padStart(64, "0");
        },
        // NIP-04 AES-256-CBC encrypt
        nip04Encrypt: async (plaintext, sharedSecretHex) => {
          const key = await crypto.subtle.importKey(
            "raw",
            Crypto.hexToBytes(sharedSecretHex),
            { name: "AES-CBC" },
            false,
            ["encrypt"]
          );
          const iv = crypto.getRandomValues(new Uint8Array(16));
          const encoded = new TextEncoder().encode(plaintext);
          const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, encoded);
          return btoa(String.fromCharCode(...new Uint8Array(ciphertext))) + "?iv=" + btoa(String.fromCharCode(...iv));
        },
        // NIP-04 AES-256-CBC decrypt
        nip04Decrypt: async (payload, sharedSecretHex) => {
          const [ciphertextB64, ivB64] = payload.split("?iv=");
          const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
          const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
          const key = await crypto.subtle.importKey(
            "raw",
            Crypto.hexToBytes(sharedSecretHex),
            { name: "AES-CBC" },
            false,
            ["decrypt"]
          );
          const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
          return new TextDecoder().decode(decrypted);
        },
        // ── NIP-44 v2 Encryption ──
        // ChaCha20 block function — produces one 64-byte keystream block (pure JavaScript)
        _chacha20Block: (key, nonce, counter) => {
          const s = new Uint32Array(16);
          s[0] = 1634760805;
          s[1] = 857760878;
          s[2] = 2036477234;
          s[3] = 1797285236;
          const kv = new DataView(key.buffer, key.byteOffset, key.byteLength);
          for (let i = 0; i < 8; i++) s[4 + i] = kv.getUint32(i * 4, true);
          s[12] = counter;
          const nv = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
          s[13] = nv.getUint32(0, true);
          s[14] = nv.getUint32(4, true);
          s[15] = nv.getUint32(8, true);
          const w = new Uint32Array(s);
          const rotl = (x, n) => x << n | x >>> 32 - n;
          function qr(a, b, c, d) {
            w[a] = w[a] + w[b] | 0;
            w[d] = rotl(w[d] ^ w[a], 16);
            w[c] = w[c] + w[d] | 0;
            w[b] = rotl(w[b] ^ w[c], 12);
            w[a] = w[a] + w[b] | 0;
            w[d] = rotl(w[d] ^ w[a], 8);
            w[c] = w[c] + w[d] | 0;
            w[b] = rotl(w[b] ^ w[c], 7);
          }
          for (let i = 0; i < 10; i++) {
            qr(0, 4, 8, 12);
            qr(1, 5, 9, 13);
            qr(2, 6, 10, 14);
            qr(3, 7, 11, 15);
            qr(0, 5, 10, 15);
            qr(1, 6, 11, 12);
            qr(2, 7, 8, 13);
            qr(3, 4, 9, 14);
          }
          for (let i = 0; i < 16; i++) w[i] = w[i] + s[i] | 0;
          const out = new Uint8Array(64);
          const ov = new DataView(out.buffer);
          for (let i = 0; i < 16; i++) ov.setUint32(i * 4, w[i], true);
          return out;
        },
        // ChaCha20 stream cipher — XOR data with keystream (same function encrypts and decrypts)
        _chacha20Encrypt: (key, nonce, data) => {
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
          if (unpaddedLen < 1) throw new Error("Invalid plaintext length");
          if (unpaddedLen > 65535) throw new Error("Plaintext too long for NIP-44");
          if (unpaddedLen <= 32) return 32;
          const nextPower = 1 << 32 - Math.clz32(unpaddedLen - 1);
          const chunk = Math.max(32, nextPower >> 3);
          return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
        },
        // NIP-44 pad: 2-byte big-endian length prefix + plaintext + zero-fill to padded length
        _nip44Pad: (plaintext) => {
          const textBytes = new TextEncoder().encode(plaintext);
          const unpaddedLen = textBytes.length;
          if (unpaddedLen < 1 || unpaddedLen > 65535) throw new Error("Plaintext length out of NIP-44 range");
          const paddedLen = Crypto._nip44CalcPaddedLen(unpaddedLen);
          const out = new Uint8Array(2 + paddedLen);
          out[0] = unpaddedLen >> 8 & 255;
          out[1] = unpaddedLen & 255;
          out.set(textBytes, 2);
          return out;
        },
        // NIP-44 unpad: extract plaintext from padded buffer
        _nip44Unpad: (padded) => {
          const unpaddedLen = padded[0] << 8 | padded[1];
          if (unpaddedLen < 1 || unpaddedLen + 2 > padded.length) throw new Error("Invalid NIP-44 padding");
          const expectedPaddedLen = Crypto._nip44CalcPaddedLen(unpaddedLen);
          if (padded.length !== 2 + expectedPaddedLen) throw new Error("Invalid NIP-44 padded length");
          for (let i = 2 + unpaddedLen; i < padded.length; i++) {
            if (padded[i] !== 0) throw new Error("Invalid NIP-44 padding: non-zero byte in padding region");
          }
          return new TextDecoder().decode(padded.slice(2, 2 + unpaddedLen));
        },
        // HMAC-SHA256 via SubtleCrypto
        _hmacSha256: async (key, data) => {
          const hmacKey = await crypto.subtle.importKey(
            "raw",
            key,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const sig = await crypto.subtle.sign("HMAC", hmacKey, data);
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
          const salt = new TextEncoder().encode("nip44-v2");
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
          const hmacInput = new Uint8Array(nonce.length + ciphertext.length);
          hmacInput.set(nonce, 0);
          hmacInput.set(ciphertext, nonce.length);
          const mac = await Crypto._hmacSha256(hmacKey, hmacInput);
          const payload = new Uint8Array(1 + 32 + ciphertext.length + 32);
          payload[0] = 2;
          payload.set(nonce, 1);
          payload.set(ciphertext, 33);
          payload.set(mac, 33 + ciphertext.length);
          let binary = "";
          for (let i = 0; i < payload.length; i++) binary += String.fromCharCode(payload[i]);
          return btoa(binary);
        },
        // NIP-44 v2 decrypt: base64 payload → plaintext (verifies HMAC, constant-time compare)
        nip44Decrypt: async (payload, conversationKey) => {
          const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
          if (raw[0] !== 2) throw new Error("Unsupported NIP-44 version: " + raw[0]);
          if (raw.length < 99) throw new Error("NIP-44 payload too short");
          const nonce = raw.slice(1, 33);
          const mac = raw.slice(raw.length - 32);
          const ciphertext = raw.slice(33, raw.length - 32);
          const messageKey = await Crypto._hkdfExpand(conversationKey, nonce, 76);
          const chachaKey = messageKey.slice(0, 32);
          const chaChaNonce = messageKey.slice(32, 44);
          const hmacKey = messageKey.slice(44, 76);
          const hmacInput = new Uint8Array(nonce.length + ciphertext.length);
          hmacInput.set(nonce, 0);
          hmacInput.set(ciphertext, nonce.length);
          const expectedMac = await Crypto._hmacSha256(hmacKey, hmacInput);
          if (mac.length !== expectedMac.length) throw new Error("NIP-44 HMAC verification failed");
          let diff = 0;
          for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ expectedMac[i];
          if (diff !== 0) throw new Error("NIP-44 HMAC verification failed");
          const padded = Crypto._chacha20Encrypt(chachaKey, chaChaNonce, ciphertext);
          return Crypto._nip44Unpad(padded);
        }
      };
    }
  });

  // src/utils.js
  var Utils;
  var init_utils = __esm({
    "src/utils.js"() {
      init_config();
      Utils = {
        // HTML escape to prevent XSS when inserting user text into innerHTML
        escapeHtml: (str) => {
          const div = document.createElement("div");
          div.appendChild(document.createTextNode(str));
          return div.innerHTML;
        },
        // Show toast notification
        showToast: (message, type = "info") => {
          const toast = document.createElement("div");
          toast.className = "nac-toast nac-toast-" + type;
          toast.textContent = message;
          document.body.appendChild(toast);
          setTimeout(() => toast.classList.add("visible"), 100);
          setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.remove(), 300);
          }, 3e3);
        },
        // Log with prefix
        log: (...args) => {
          if (CONFIG.debug) {
            console.log("[NAC]", ...args);
          }
        },
        // Error log
        error: (...args) => {
          console.error("[NAC]", ...args);
        },
        // Make a non-button element keyboard-accessible (Enter/Space triggers click)
        makeKeyboardAccessible: (el) => {
          if (!el.getAttribute("tabindex")) el.setAttribute("tabindex", "0");
          if (!el.getAttribute("role")) el.setAttribute("role", "button");
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              el.click();
            }
          });
        }
      };
    }
  });

  // src/storage.js
  var Storage;
  var init_storage = __esm({
    "src/storage.js"() {
      init_config();
      init_utils();
      Storage = {
        // GM API availability flag — set by checkGMAvailability() at init
        _gmAvailable: true,
        // Error toast throttle — only show once per session
        _errorShown: false,
        // Check if GM storage API is functional (called at init)
        checkGMAvailability: () => {
          try {
            GM_setValue("_nac_test", "ok");
            const test = GM_getValue("_nac_test", null);
            if (test !== "ok") throw new Error("GM read-back failed");
            GM_deleteValue("_nac_test");
            Storage._gmAvailable = true;
            console.log("[NAC] GM storage: OK");
          } catch (e) {
            Storage._gmAvailable = false;
            console.warn("[NAC] GM storage NOT available:", e.message, "\u2014 falling back to localStorage");
          }
        },
        // Low-level wrappers with localStorage fallback
        get: async (key, defaultValue = null) => {
          if (Storage._gmAvailable) {
            try {
              const value = await GM_getValue(key, null);
              if (value !== null) {
                return typeof value === "string" ? JSON.parse(value) : value;
              }
            } catch (e) {
              console.error("[NAC Storage] GM get error:", key, e);
            }
          }
          try {
            const val = localStorage.getItem("nac_" + key);
            if (val !== null) {
              console.log("[NAC Storage] Read from localStorage fallback:", key);
              return JSON.parse(val);
            }
          } catch (e) {
            console.error("[NAC Storage] localStorage get error:", key, e);
          }
          return defaultValue;
        },
        set: async (key, value) => {
          const json = JSON.stringify(value);
          if (Storage._gmAvailable) {
            try {
              await GM_setValue(key, json);
              return true;
            } catch (e) {
              console.error("[NAC Storage] GM_setValue failed:", {
                key,
                dataSize: json.length,
                error: e,
                errorType: e?.constructor?.name,
                errorMessage: e?.message,
                gmAvailable: Storage._gmAvailable
              });
              if (typeof value === "object" && value !== null) {
                try {
                  const compressed = Storage._compressForSave(key, value);
                  const compressedJson = JSON.stringify(compressed);
                  await GM_setValue(key, compressedJson);
                  console.log("[NAC Storage] Saved with GM compression fallback for key:", key);
                  return true;
                } catch (e2) {
                  console.error("[NAC Storage] GM compression fallback also failed:", key, e2);
                }
              }
            }
          }
          try {
            localStorage.setItem("nac_" + key, json);
            console.log("[NAC Storage] Fell back to localStorage for:", key, "(" + (json.length / 1024).toFixed(1) + " KB)");
            return true;
          } catch (e2) {
            console.error("[NAC Storage] localStorage fallback also failed:", {
              key,
              dataSize: json.length,
              error: e2,
              errorType: e2?.constructor?.name,
              errorMessage: e2?.message,
              localStorageAvailable: typeof localStorage !== "undefined"
            });
            if (!Storage._errorShown) {
              Storage._errorShown = true;
              try {
                const dataSize = (json.length / 1024).toFixed(1);
                Utils.showToast(`Storage save failed for "${key}" (${dataSize} KB). ${e2.message || "Storage may be full."}`, "error");
              } catch (_) {
                Utils.showToast("Failed to save data. Storage may be full.", "error");
              }
            } else {
              console.warn("[NAC Storage] Suppressed repeated error toast for:", key);
            }
            return false;
          }
        },
        // Compress data by stripping optional/large fields to fit storage constraints
        _compressForSave: (key, value) => {
          if (key === "entity_registry" && typeof value === "object") {
            const compressed = {};
            for (const [id, entity] of Object.entries(value)) {
              compressed[id] = { ...entity };
              if (Array.isArray(compressed[id].articles) && compressed[id].articles.length > 10) {
                compressed[id].articles = compressed[id].articles.sort((a, b) => (b.tagged_at || 0) - (a.tagged_at || 0)).slice(0, 10);
              }
            }
            return compressed;
          }
          if (key === "article_claims" && typeof value === "object") {
            const compressed = {};
            for (const [id, claim] of Object.entries(value)) {
              compressed[id] = { ...claim };
              if (compressed[id].context && compressed[id].context.length > 150) {
                compressed[id].context = compressed[id].context.substring(0, 150) + "\u2026";
              }
            }
            return compressed;
          }
          return value;
        },
        delete: async (key) => {
          let success = false;
          if (Storage._gmAvailable) {
            try {
              await GM_deleteValue(key);
              success = true;
            } catch (e) {
              console.error("[NAC Storage] GM delete error:", e);
            }
          }
          try {
            localStorage.removeItem("nac_" + key);
            success = true;
          } catch (e) {
            console.error("[NAC Storage] localStorage delete error:", e);
          }
          return success;
        },
        // User identity management
        identity: {
          get: async () => {
            return await Storage.get("user_identity", null);
          },
          set: async (data) => {
            return await Storage.set("user_identity", data);
          },
          clear: async () => {
            return await Storage.delete("user_identity");
          },
          isConfigured: async () => {
            const identity = await Storage.identity.get();
            return identity !== null && identity.pubkey;
          }
        },
        // Entity registry management
        entities: {
          getAll: async () => {
            return await Storage.get("entity_registry", {});
          },
          get: async (id) => {
            const registry = await Storage.entities.getAll();
            return registry[id] || null;
          },
          save: async (id, data) => {
            const registry = await Storage.entities.getAll();
            registry[id] = {
              ...data,
              updated: Math.floor(Date.now() / 1e3)
            };
            const result = await Storage.set("entity_registry", registry);
            const registryJson = JSON.stringify(registry);
            const sizeBytes = registryJson.length;
            if (sizeBytes > 5 * 1024 * 1024) {
              console.warn("[NAC Storage] Entity registry exceeds 5MB (" + (sizeBytes / (1024 * 1024)).toFixed(1) + " MB). Consider cleaning up unused entities.");
              Utils.showToast("Entity registry is very large (" + (sizeBytes / (1024 * 1024)).toFixed(1) + " MB). Consider removing unused entities.", "error");
            } else if (sizeBytes > 2 * 1024 * 1024) {
              console.warn("[NAC Storage] Entity registry exceeds 2MB (" + (sizeBytes / (1024 * 1024)).toFixed(1) + " MB).");
            }
            return registry[id];
          },
          delete: async (id) => {
            const registry = await Storage.entities.getAll();
            delete registry[id];
            return await Storage.set("entity_registry", registry);
          },
          search: async (query, type = null) => {
            const registry = await Storage.entities.getAll();
            const lowerQuery = query.toLowerCase();
            const results = [];
            for (const [id, entity] of Object.entries(registry)) {
              if (type && entity.type !== type) continue;
              const nameMatch = entity.name.toLowerCase().includes(lowerQuery);
              const aliasMatch = entity.aliases && entity.aliases.some(
                (a) => a.toLowerCase().includes(lowerQuery)
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
              await Storage.set("entity_registry", merged);
              return Object.keys(imported).length;
            } catch (e) {
              console.error("[NAC Storage] Import error:", e);
              return 0;
            }
          },
          getLastSyncTime: async () => {
            return await Storage.get("entity_last_sync", 0);
          },
          setLastSyncTime: async (timestamp) => {
            await Storage.set("entity_last_sync", timestamp);
          }
        },
        // Claims storage
        claims: {
          getAll: async () => {
            return await Storage.get("article_claims", {});
          },
          get: async (claimId) => {
            const claims = await Storage.claims.getAll();
            return claims[claimId] || null;
          },
          getForUrl: async (url) => {
            const claims = await Storage.claims.getAll();
            return Object.values(claims).filter((c) => c.source_url === url);
          },
          save: async (claim) => {
            const claims = await Storage.claims.getAll();
            claims[claim.id] = claim;
            return await Storage.set("article_claims", claims);
          },
          delete: async (claimId) => {
            const claims = await Storage.claims.getAll();
            delete claims[claimId];
            return await Storage.set("article_claims", claims);
          }
        },
        // Platform accounts storage
        platformAccounts: {
          getAll: async () => {
            return await Storage.get("platform_accounts", {});
          },
          save: async (account) => {
            const accounts = await Storage.get("platform_accounts", {});
            accounts[account.id] = account;
            return Storage.set("platform_accounts", accounts);
          },
          saveAll: async (accounts) => {
            return Storage.set("platform_accounts", accounts);
          },
          delete: async (accountId) => {
            const accounts = await Storage.get("platform_accounts", {});
            delete accounts[accountId];
            return Storage.set("platform_accounts", accounts);
          },
          getCount: async () => {
            const accounts = await Storage.get("platform_accounts", {});
            return Object.keys(accounts).length;
          }
        },
        // Captured comments storage
        comments: {
          getAll: async () => {
            return await Storage.get("captured_comments", {});
          },
          getForUrl: async (url) => {
            const all = await Storage.get("captured_comments", {});
            return Object.values(all).filter((c) => c.sourceUrl === url);
          },
          save: async (comment) => {
            const all = await Storage.get("captured_comments", {});
            all[comment.id] = comment;
            return Storage.set("captured_comments", all);
          },
          saveMany: async (comments) => {
            const all = await Storage.get("captured_comments", {});
            comments.forEach((c) => {
              all[c.id] = c;
            });
            return Storage.set("captured_comments", all);
          },
          delete: async (commentId) => {
            const all = await Storage.get("captured_comments", {});
            delete all[commentId];
            return Storage.set("captured_comments", all);
          }
        },
        // Evidence links storage
        evidenceLinks: {
          getAll: async () => {
            return await Storage.get("evidence_links", {});
          },
          getForClaim: async (claimId) => {
            const links = await Storage.evidenceLinks.getAll();
            return Object.values(links).filter(
              (l) => l.source_claim_id === claimId || l.target_claim_id === claimId
            );
          },
          save: async (link) => {
            const links = await Storage.evidenceLinks.getAll();
            links[link.id] = link;
            return await Storage.set("evidence_links", links);
          },
          delete: async (linkId) => {
            const links = await Storage.evidenceLinks.getAll();
            delete links[linkId];
            return await Storage.set("evidence_links", links);
          }
        },
        // Relay configuration
        relays: {
          get: async () => {
            return await Storage.get("relay_config", {
              relays: CONFIG.relays_default
            });
          },
          set: async (config) => {
            return await Storage.set("relay_config", config);
          },
          addRelay: async (url) => {
            const config = await Storage.relays.get();
            if (!config.relays.find((r) => r.url === url)) {
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
            config.relays = config.relays.filter((r) => r.url !== url);
            await Storage.relays.set(config);
          }
        },
        // Storage usage estimation
        getUsageEstimate: async () => {
          const identity = await Storage.get("user_identity", null);
          const entities = await Storage.get("entity_registry", {});
          const relays = await Storage.get("relay_config", {});
          const sync = await Storage.get("entity_last_sync", 0);
          const claims = await Storage.get("article_claims", {});
          const evidenceLinks = await Storage.get("evidence_links", {});
          const platformAccounts = await Storage.get("platform_accounts", {});
          const comments = await Storage.get("captured_comments", {});
          const identitySize = JSON.stringify(identity || "").length;
          const entitiesSize = JSON.stringify(entities || "").length;
          const relaysSize = JSON.stringify(relays || "").length;
          const syncSize = JSON.stringify(sync || "").length;
          const claimsSize = JSON.stringify(claims || "").length;
          const evidenceLinksSize = JSON.stringify(evidenceLinks || "").length;
          const platformAccountsSize = JSON.stringify(platformAccounts || "").length;
          const commentsSize = JSON.stringify(comments || "").length;
          const totalBytes = identitySize + entitiesSize + relaysSize + syncSize + claimsSize + evidenceLinksSize + platformAccountsSize + commentsSize;
          return {
            totalBytes,
            breakdown: {
              identity: identitySize,
              entities: entitiesSize,
              relays: relaysSize,
              sync: syncSize,
              claims: claimsSize,
              evidenceLinks: evidenceLinksSize,
              platformAccounts: platformAccountsSize,
              comments: commentsSize
            }
          };
        }
      };
    }
  });

  // src/content-extractor.js
  var content_extractor_exports = {};
  __export(content_extractor_exports, {
    ContentExtractor: () => ContentExtractor
  });
  var ContentExtractor;
  var init_content_extractor = __esm({
    "src/content-extractor.js"() {
      init_config();
      ContentExtractor = {
        // Extract article using Readability (if available via @require)
        extractArticle: () => {
          try {
            document.querySelectorAll("img[data-src], img[data-lazy-src], img[data-original], img[data-lazy]").forEach((img) => {
              const lazySrc = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.dataset.lazy;
              if (lazySrc && (!img.src || img.src.includes("data:") || img.src.includes("placeholder") || img.src.includes("blank"))) {
                img.src = lazySrc;
              }
            });
            document.querySelectorAll("img[srcset]:not([src]), img[data-srcset]").forEach((img) => {
              const srcset = img.srcset || img.dataset.srcset;
              if (srcset) {
                const firstUrl = srcset.split(",")[0].trim().split(/\s+/)[0];
                if (firstUrl && (!img.src || img.src.includes("data:") || img.src.includes("placeholder"))) {
                  img.src = firstUrl;
                }
              }
            });
            document.querySelectorAll("noscript").forEach((noscript) => {
              const temp = document.createElement("div");
              temp.innerHTML = noscript.textContent || noscript.innerHTML;
              const noscriptImgs = temp.querySelectorAll("img[src]");
              noscriptImgs.forEach((nImg) => {
                const parent = noscript.parentElement;
                if (parent) {
                  const existingImg = parent.querySelector("img");
                  if (existingImg && (!existingImg.src || existingImg.src.includes("data:") || existingImg.src.includes("placeholder"))) {
                    existingImg.src = nImg.src;
                    if (nImg.alt) existingImg.alt = nImg.alt;
                  }
                }
              });
            });
            document.querySelectorAll("img").forEach((img) => {
              const naturalWidth = img.naturalWidth || parseInt(img.getAttribute("width")) || img.offsetWidth;
              const naturalHeight = img.naturalHeight || parseInt(img.getAttribute("height")) || img.offsetHeight;
              if (naturalWidth > 0 && naturalWidth < 100) {
                img.classList.add("nac-inline-img");
                img.setAttribute("width", naturalWidth);
                img.setAttribute("height", naturalHeight || naturalWidth);
              }
            });
            document.querySelectorAll([
              "blockquote.twitter-tweet",
              'blockquote[cite*="twitter.com"]',
              'blockquote[cite*="x.com"]',
              "[data-tweet-id]",
              '[data-component="tweet-embed"]',
              ".tweet-embed",
              ".twitter-tweet",
              'div[class*="tweet-embed"]',
              'div[class*="twitter-tweet"]'
            ].join(", ")).forEach((tweet) => {
              const tweetText = tweet.querySelector("p")?.textContent?.trim() || tweet.textContent?.trim() || "";
              const tweetLink = tweet.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
              const tweetUrl = tweetLink?.href || "";
              const authorEl = tweet.querySelector('a:not([href*="/status/"])') || tweet.querySelector("a");
              const authorName = authorEl?.textContent?.trim() || "";
              const cleanTweet = document.createElement("blockquote");
              cleanTweet.className = "nac-tweet-embed";
              cleanTweet.setAttribute("data-tweet-url", tweetUrl);
              cleanTweet.innerHTML = `<p>${tweetText}</p>` + (authorName ? `<footer>\u2014 ${authorName}</footer>` : "") + (tweetUrl ? `<cite><a href="${tweetUrl}">${tweetUrl}</a></cite>` : "");
              tweet.parentNode?.replaceChild(cleanTweet, tweet);
            });
            document.querySelectorAll('img[src*="pbs.twimg.com/profile_images"], img[src*="twimg.com/profile"]').forEach((img) => {
              img.classList.add("nac-inline-img");
              img.style.width = "48px";
              img.style.height = "48px";
              img.style.borderRadius = "50%";
              img.setAttribute("width", "48");
              img.setAttribute("height", "48");
            });
            const documentClone = document.cloneNode(true);
            if (typeof Readability !== "undefined") {
              const reader = new Readability(documentClone);
              const article = reader.parse();
              if (!article || article.textContent.length < CONFIG.extraction.min_content_length) {
                console.log("[NAC] Readability extraction failed or content too short");
                return null;
              }
              article.url = ContentExtractor.getCanonicalUrl();
              article.domain = ContentExtractor.getDomain(article.url);
              article.extractedAt = Math.floor(Date.now() / 1e3);
              const dateResult = ContentExtractor.extractPublishedDate();
              if (dateResult) {
                article.publishedAt = dateResult.timestamp;
                article.publishedAtSource = dateResult.source;
              }
              article.featuredImage = ContentExtractor.extractFeaturedImage();
              article.publicationIcon = ContentExtractor.extractPublicationIcon();
              article.structuredData = ContentExtractor.extractStructuredData();
              article.wordCount = (article.textContent || "").split(/\s+/).filter((w) => w.length > 0).length;
              article.readingTimeMinutes = Math.ceil(article.wordCount / 225);
              article.dateModified = ContentExtractor.extractDateModified();
              article.section = article.structuredData.section || null;
              article.keywords = article.structuredData.keywords || [];
              article.language = article.structuredData.language || null;
              article.isPaywalled = article.structuredData.isAccessibleForFree === false || !!document.querySelector('[class*="paywall"], [class*="subscriber"], [data-paywall]');
              return article;
            } else {
              return ContentExtractor.extractSimple();
            }
          } catch (e) {
            console.error("[NAC] Article extraction failed:", e);
            return ContentExtractor.extractSimple();
          }
        },
        // Simple fallback extraction
        extractSimple: () => {
          const title = document.querySelector("h1")?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.content || document.title;
          const byline = document.querySelector('meta[name="author"]')?.content || document.querySelector(".author")?.textContent?.trim() || "";
          const content = document.querySelector("article")?.innerHTML || document.querySelector(".post-content")?.innerHTML || document.querySelector(".entry-content")?.innerHTML || document.body.innerHTML;
          return {
            title,
            byline,
            content,
            textContent: content.replace(/<[^>]+>/g, ""),
            url: ContentExtractor.getCanonicalUrl(),
            domain: ContentExtractor.getDomain(window.location.href),
            extractedAt: Math.floor(Date.now() / 1e3)
          };
        },
        // Get canonical URL with validation and cleaning
        getCanonicalUrl: () => {
          const canonical = document.querySelector('link[rel="canonical"]');
          if (canonical && canonical.href) {
            try {
              const url = new URL(canonical.href);
              if (url.protocol === "http:" || url.protocol === "https:") {
                return ContentExtractor.normalizeUrl(canonical.href);
              }
            } catch (e) {
            }
          }
          const ogUrl = document.querySelector('meta[property="og:url"]');
          if (ogUrl && ogUrl.content) {
            try {
              const url = new URL(ogUrl.content);
              if (url.protocol === "http:" || url.protocol === "https:") {
                return ContentExtractor.normalizeUrl(ogUrl.content);
              }
            } catch (e) {
            }
          }
          return ContentExtractor.normalizeUrl(window.location.href);
        },
        // Extract domain from URL
        getDomain: (url) => {
          try {
            return new URL(url).hostname.replace(/^www\./, "");
          } catch (e) {
            return "";
          }
        },
        // Normalize URL (remove tracking params, clean hash fragments)
        normalizeUrl: (url) => {
          try {
            const parsed = new URL(url);
            const trackingParams = [
              "utm_source",
              "utm_medium",
              "utm_campaign",
              "utm_term",
              "utm_content",
              "utm_id",
              "fbclid",
              "gclid",
              "_ga",
              "_gid",
              "ref",
              "source",
              "mc_cid",
              "mc_eid",
              "mkt_tok",
              "oly_anon_id",
              "oly_enc_id",
              "vero_id",
              "wickedid",
              "__twitter_impression",
              "twclid",
              "igshid",
              "spm",
              "share_source",
              "from"
            ];
            trackingParams.forEach((param) => parsed.searchParams.delete(param));
            if (parsed.hash) {
              const frag = parsed.hash.slice(1);
              const isTrackingHash = /^[.\/]/.test(frag) || /^[A-Za-z0-9]{1,5}$/.test(frag) || frag === "";
              if (isTrackingHash) {
                parsed.hash = "";
              }
            }
            return parsed.toString();
          } catch (e) {
            return url;
          }
        },
        // Extract published date
        extractPublishedDate: () => {
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of jsonLdScripts) {
            try {
              const data = JSON.parse(script.textContent);
              const articles = Array.isArray(data) ? data : [data];
              for (const item of articles) {
                if (item["@type"] === "Article" || item["@type"] === "NewsArticle" || item["@type"] === "BlogPosting") {
                  if (item.datePublished) {
                    const date = new Date(item.datePublished);
                    if (!isNaN(date.getTime())) {
                      return { timestamp: Math.floor(date.getTime() / 1e3), source: "json-ld" };
                    }
                  }
                }
              }
            } catch (e) {
            }
          }
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
                return { timestamp: Math.floor(date.getTime() / 1e3), source: "meta-tag" };
              }
            }
          }
          const timeEl = document.querySelector("article time[datetime], .post time[datetime]");
          if (timeEl) {
            const datetime = timeEl.getAttribute("datetime");
            const date = new Date(datetime);
            if (!isNaN(date.getTime())) {
              return { timestamp: Math.floor(date.getTime() / 1e3), source: "time-element" };
            }
          }
          return null;
        },
        // Extract featured image
        extractFeaturedImage: () => {
          const selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            "article img",
            ".featured-image img"
          ];
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const src = element.getAttribute("content") || element.getAttribute("src");
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
            if (typeof TurndownService !== "undefined") {
              const turndown = new TurndownService({
                headingStyle: "atx",
                hr: "---",
                bulletListMarker: "-",
                codeBlockStyle: "fenced",
                emDelimiter: "*"
              });
              if (typeof turndownPluginGfm !== "undefined") {
                turndown.use(turndownPluginGfm.gfm);
              }
              turndown.addRule("images", {
                filter: "img",
                replacement: (content, node) => {
                  let src = node.getAttribute("src") || "";
                  if (!src || src.includes("data:") || src.includes("placeholder") || src.includes("blank")) {
                    const dataSrc = node.getAttribute("data-src") || node.getAttribute("data-lazy-src") || node.getAttribute("data-original") || "";
                    const srcset = node.getAttribute("srcset") || node.getAttribute("data-srcset") || "";
                    if (dataSrc) {
                      src = dataSrc;
                    } else if (srcset) {
                      src = srcset.split(",")[0].trim().split(/\s+/)[0];
                    }
                  }
                  if (!src) return "";
                  try {
                    src = new URL(src, window.location.href).href;
                  } catch (e) {
                  }
                  const alt = node.getAttribute("alt") || "";
                  const title = node.getAttribute("title");
                  const width = parseInt(node.getAttribute("width")) || 0;
                  const height = parseInt(node.getAttribute("height")) || width;
                  if (width > 0 && width < 100) {
                    const radius = width < 60 ? "50%" : "4px";
                    return `<img src="${src}" alt="${alt}" width="${width}" height="${height}" style="display:inline-block;vertical-align:middle;border-radius:${radius}">`;
                  }
                  if (title) {
                    return `![${alt}](${src} "${title}")`;
                  }
                  return `![${alt}](${src})`;
                }
              });
              turndown.addRule("figure", {
                filter: "figure",
                replacement: (content, node) => {
                  const img = node.querySelector("img");
                  const caption = node.querySelector("figcaption");
                  let result = "";
                  if (img) {
                    const alt = img.getAttribute("alt") || caption?.textContent?.trim() || "";
                    let src = img.getAttribute("src") || "";
                    if (!src || src.includes("data:") || src.includes("placeholder") || src.includes("blank")) {
                      const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || "";
                      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
                      if (dataSrc) {
                        src = dataSrc;
                      } else if (srcset) {
                        src = srcset.split(",")[0].trim().split(/\s+/)[0];
                      }
                    }
                    try {
                      src = new URL(src, window.location.href).href;
                    } catch (e) {
                    }
                    if (src) result += `![${alt}](${src})`;
                  }
                  if (caption) {
                    result += "\n*" + caption.textContent.trim() + "*";
                  }
                  return "\n\n" + result + "\n\n";
                }
              });
              turndown.addRule("iframeEmbed", {
                filter: ["iframe", "video"],
                replacement: (content, node) => {
                  const src = node.getAttribute("src") || "";
                  if (!src) return "";
                  let absoluteSrc = src;
                  try {
                    absoluteSrc = new URL(src, window.location.href).href;
                  } catch (e) {
                  }
                  return `

[Embedded media](${absoluteSrc})

`;
                }
              });
              turndown.addRule("lineBreak", {
                filter: "br",
                replacement: () => "  \n"
              });
              turndown.addRule("tweetEmbed", {
                filter: function(node) {
                  return node.nodeName === "BLOCKQUOTE" && (node.classList.contains("twitter-tweet") || node.classList.contains("nac-tweet-embed") || node.getAttribute("data-tweet-url"));
                },
                replacement: function(content, node) {
                  const tweetUrl = node.getAttribute("data-tweet-url") || "";
                  const paragraphs = node.querySelectorAll("p");
                  const tweetText = Array.from(paragraphs).map((p) => p.textContent.trim()).filter((t) => t).join("\n");
                  const footer = node.querySelector("footer");
                  const authorName = footer?.textContent?.replace(/^—\s*/, "").trim() || "";
                  let md = "> \u{1F426} **Tweet";
                  if (authorName) md += ` by ${authorName}`;
                  md += "**\n";
                  md += "> \n";
                  if (tweetText) {
                    tweetText.split("\n").forEach((line) => {
                      md += `> ${line}
`;
                    });
                  }
                  if (tweetUrl) {
                    md += "> \n";
                    md += `> [View on Twitter/X](${tweetUrl})
`;
                  }
                  return "\n" + md + "\n";
                }
              });
              return turndown.turndown(html);
            } else {
              return ContentExtractor._fallbackHtmlToMarkdown(html);
            }
          } catch (e) {
            console.error("[NAC] Markdown conversion failed:", e);
            return ContentExtractor._fallbackHtmlToMarkdown(html);
          }
        },
        // Fallback HTML-to-Markdown when Turndown is not loaded
        // Preserves headings, paragraphs, images, links, lists, blockquotes, emphasis
        _fallbackHtmlToMarkdown: (html) => {
          let md = html;
          md = md.replace(/\r\n?/g, "\n");
          md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
          md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
          md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
          md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
          md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
          md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");
          md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, (m, src, alt) => {
            try {
              src = new URL(src, window.location.href).href;
            } catch (e) {
            }
            return `

![${alt}](${src})

`;
          });
          md = md.replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, alt, src) => {
            try {
              src = new URL(src, window.location.href).href;
            } catch (e) {
            }
            return `

![${alt}](${src})

`;
          });
          md = md.replace(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (m, src) => {
            try {
              src = new URL(src, window.location.href).href;
            } catch (e) {
            }
            return `

![](${src})

`;
          });
          md = md.replace(/<a[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
          md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
          md = md.replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, "*$2*");
          md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
            const lines = inner.replace(/<[^>]+>/g, "").trim().split("\n");
            return "\n\n" + lines.map((l) => "> " + l.trim()).join("\n") + "\n\n";
          });
          md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, inner) => {
            return "- " + inner.replace(/<[^>]+>/g, "").trim() + "\n";
          });
          md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");
          md = md.replace(/<hr[^>]*\/?>/gi, "\n\n---\n\n");
          md = md.replace(/<\/p>/gi, "\n\n");
          md = md.replace(/<p[^>]*>/gi, "");
          md = md.replace(/<br\s*\/?>/gi, "  \n");
          md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n\n```\n$1\n```\n\n");
          md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
          md = md.replace(/<[^>]+>/g, "");
          md = md.replace(/&amp;/g, "&");
          md = md.replace(/&lt;/g, "<");
          md = md.replace(/&gt;/g, ">");
          md = md.replace(/&quot;/g, '"');
          md = md.replace(/&#039;/g, "'");
          md = md.replace(/&nbsp;/g, " ");
          md = md.replace(/\n{3,}/g, "\n\n");
          md = md.trim();
          return md;
        },
        // Convert Markdown to HTML (lightweight renderer)
        // Handles the subset of markdown that htmlToMarkdown() produces
        markdownToHtml: (markdown) => {
          if (!markdown) return "";
          let html = markdown;
          html = html.replace(/&/g, "&amp;");
          html = html.replace(/</g, "&lt;");
          html = html.replace(/>/g, "&gt;");
          html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
            return `
<pre><code>${code.trimEnd()}</code></pre>
`;
          });
          html = html.replace(/(?:^|\n)((?:    .+\n?)+)/g, (m, block) => {
            const code = block.replace(/^    /gm, "");
            return `
<pre><code>${code.trimEnd()}</code></pre>
`;
          });
          html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
          html = html.replace(/^---+$/gm, "<hr>");
          html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
          html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
          html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
          html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
          html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
          html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
          html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, src, title) => {
            const titleAttr = title ? ` title="${title}"` : "";
            return `<img src="${src}" alt="${alt}"${titleAttr}>`;
          });
          html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
          html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
          html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
          html = html.replace(/(?:^&gt; .+$\n?)+/gm, (block) => {
            const inner = block.replace(/^&gt; ?/gm, "").trim();
            return `<blockquote><p>${inner}</p></blockquote>
`;
          });
          html = html.replace(/(?:^[\-\*] .+$\n?)+/gm, (block) => {
            const items = block.trim().split("\n").map((line) => {
              const text = line.replace(/^[\-\*] /, "");
              return `<li>${text}</li>`;
            }).join("\n");
            return `<ul>
${items}
</ul>
`;
          });
          html = html.replace(/(?:^\d+\. .+$\n?)+/gm, (block) => {
            const items = block.trim().split("\n").map((line) => {
              const text = line.replace(/^\d+\. /, "");
              return `<li>${text}</li>`;
            }).join("\n");
            return `<ol>
${items}
</ol>
`;
          });
          html = html.replace(/ {2}\n/g, "<br>\n");
          const blocks = html.split(/\n{2,}/);
          html = blocks.map((block) => {
            block = block.trim();
            if (!block) return "";
            if (/^<(?:h[1-6]|p|ul|ol|li|blockquote|pre|hr|img|div)/i.test(block)) {
              return block;
            }
            return `<p>${block}</p>`;
          }).filter(Boolean).join("\n\n");
          return html;
        },
        // Extract publication favicon/icon
        extractPublicationIcon: () => {
          const selectors = [
            'link[rel="apple-touch-icon"][sizes="180x180"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="icon"][sizes="192x192"]',
            'link[rel="icon"][sizes="128x128"]',
            'link[rel="icon"][type="image/png"]',
            'link[rel="icon"]',
            'link[rel="shortcut icon"]'
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.href) {
              try {
                return new URL(el.href, window.location.href).href;
              } catch (e) {
              }
            }
          }
          try {
            return new URL("/favicon.ico", window.location.href).href;
          } catch (e) {
          }
          return null;
        },
        // Extract structured data from JSON-LD and meta tags
        extractStructuredData: () => {
          const data = {};
          document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
            try {
              const json = JSON.parse(script.textContent);
              const candidates = json["@graph"] ? json["@graph"] : Array.isArray(json) ? json : [json];
              const article = candidates.find(
                (item) => ["NewsArticle", "Article", "BlogPosting", "OpinionPiece", "Report", "ScholarlyArticle", "TechArticle", "AnalysisNewsArticle", "ReportageNewsArticle"].includes(item["@type"])
              );
              if (article) {
                data.type = article["@type"];
                data.dateModified = article.dateModified || null;
                data.section = article.articleSection || null;
                data.keywords = article.keywords || [];
                if (typeof data.keywords === "string") {
                  data.keywords = data.keywords.split(",").map((k) => k.trim()).filter((k) => k);
                }
                data.wordCount = article.wordCount || null;
                data.language = article.inLanguage || null;
                data.isAccessibleForFree = article.isAccessibleForFree != null ? article.isAccessibleForFree : null;
                data.isPartOf = article.isPartOf?.name || null;
                if (article.publisher) {
                  data.publisher = {
                    name: article.publisher.name || null,
                    logo: article.publisher.logo?.url || article.publisher.logo || null,
                    url: article.publisher.url || null
                  };
                }
              }
            } catch (e) {
            }
          });
          if (!data.section) {
            data.section = document.querySelector('meta[property="article:section"]')?.content || document.querySelector('meta[name="article:section"]')?.content || null;
          }
          if (!data.keywords?.length) {
            const kw = document.querySelector('meta[name="keywords"]')?.content || document.querySelector('meta[property="article:tag"]')?.content;
            if (kw) data.keywords = kw.split(",").map((k) => k.trim()).filter((k) => k);
          }
          if (!data.keywords) data.keywords = [];
          if (!data.language) {
            data.language = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.content || null;
          }
          return data;
        },
        // Extract date modified from JSON-LD, meta tags, or time elements
        extractDateModified: () => {
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of jsonLdScripts) {
            try {
              const json = JSON.parse(script.textContent);
              const candidates = json["@graph"] ? json["@graph"] : Array.isArray(json) ? json : [json];
              for (const item of candidates) {
                if (item.dateModified) {
                  const date = new Date(item.dateModified);
                  if (!isNaN(date.getTime())) {
                    return item.dateModified;
                  }
                }
              }
            } catch (e) {
            }
          }
          const metaSelectors = [
            'meta[property="article:modified_time"]',
            'meta[name="last-modified"]',
            'meta[name="dcterms.modified"]',
            'meta[property="og:updated_time"]'
          ];
          for (const selector of metaSelectors) {
            const meta = document.querySelector(selector);
            if (meta?.content) {
              const date = new Date(meta.content);
              if (!isNaN(date.getTime())) {
                return meta.content;
              }
            }
          }
          const timeEl = document.querySelector('time[itemprop="dateModified"], time.updated, time.modified');
          if (timeEl) {
            const dt = timeEl.getAttribute("datetime");
            if (dt) {
              const date = new Date(dt);
              if (!isNaN(date.getTime())) return dt;
            }
          }
          return null;
        }
      };
    }
  });

  // src/content-detector.js
  function detectYouTube() {
    return {
      videoId: new URLSearchParams(window.location.search).get("v") || window.location.pathname.split("/").pop(),
      isLive: !!document.querySelector(".ytp-live-badge-text"),
      hasChat: !!document.querySelector('#chat-container, iframe[src*="live_chat"]'),
      channelName: document.querySelector('#channel-name a, [itemprop="author"] [itemprop="name"]')?.textContent?.trim(),
      videoTitle: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, meta[name="title"]')?.textContent?.trim()
    };
  }
  function detectTwitter() {
    return {
      isTweet: /\/status\/\d+/.test(window.location.pathname),
      isProfile: !window.location.pathname.includes("/status/"),
      username: window.location.pathname.split("/")[1] || null
    };
  }
  function detectFacebook() {
    return {
      isPost: /\/(posts|videos|photos)\//.test(window.location.pathname) || window.location.pathname.includes("/permalink/"),
      isProfile: !window.location.pathname.includes("/posts/")
    };
  }
  function detectInstagram() {
    return {
      isPost: /\/p\//.test(window.location.pathname),
      isReel: /\/reel\//.test(window.location.pathname),
      isProfile: !window.location.pathname.includes("/p/") && !window.location.pathname.includes("/reel/")
    };
  }
  function detectTikTok() {
    return {
      isVideo: /\/video\/\d+/.test(window.location.pathname),
      username: window.location.pathname.match(/@([^/]+)/)?.[1] || null
    };
  }
  function isSubstack() {
    return !!document.querySelector('meta[content*="substack"]') || !!document.querySelector('script[src*="substack"]') || !!document.querySelector(".post-content, .available-content");
  }
  function hasArticleContent() {
    return !!(document.querySelector('article, [role="article"]') || document.querySelector('meta[property="og:type"][content="article"]') || document.querySelector(".post-content, .article-body, .story-body") || document.querySelector("h1") && document.querySelectorAll("p").length > 3);
  }
  var ContentDetector;
  var init_content_detector = __esm({
    "src/content-detector.js"() {
      ContentDetector = {
        /**
         * Analyze current page and return content type info
         * @returns {{ type: string, platform: string|null, confidence: number, metadata: object }}
         */
        detect: () => {
          const url = window.location.href;
          const hostname = window.location.hostname;
          if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
            return { type: "video", platform: "youtube", confidence: 1, metadata: detectYouTube() };
          }
          if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
            return { type: "social_post", platform: "twitter", confidence: 1, metadata: detectTwitter() };
          }
          if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
            return { type: "social_post", platform: "facebook", confidence: 1, metadata: detectFacebook() };
          }
          if (hostname.includes("instagram.com")) {
            return { type: "social_post", platform: "instagram", confidence: 1, metadata: detectInstagram() };
          }
          if (hostname.includes("tiktok.com")) {
            return { type: "video", platform: "tiktok", confidence: 1, metadata: detectTikTok() };
          }
          if (hostname.includes("substack.com") || isSubstack()) {
            return { type: "article", platform: "substack", confidence: 0.9, metadata: {} };
          }
          if (hostname.includes("reddit.com")) {
            return { type: "social_post", platform: "reddit", confidence: 1, metadata: {} };
          }
          if (hasArticleContent()) {
            return { type: "article", platform: null, confidence: 0.8, metadata: {} };
          }
          return { type: "unknown", platform: null, confidence: 0, metadata: {} };
        },
        /**
         * Check if the page has comments that can be captured
         */
        hasComments: () => {
          return !!(document.querySelector('[class*="comment"], [id*="comment"], [data-component="comments"]') || document.querySelector("section.comments, .comments-section, #comments") || document.querySelector('[class*="disqus"], #disqus_thread'));
        },
        /**
         * Get the content type label for display
         */
        getTypeLabel: (type) => {
          const labels = {
            "article": "\u{1F4F0} Article",
            "video": "\u{1F3AC} Video",
            "social_post": "\u{1F4AC} Social Post",
            "audio": "\u{1F3A7} Audio",
            "unknown": "\u{1F4C4} Page"
          };
          return labels[type] || labels.unknown;
        },
        /**
         * Get platform icon/emoji
         */
        getPlatformIcon: (platform) => {
          const icons = {
            "youtube": "\u25B6\uFE0F",
            "twitter": "\u{1D54F}",
            "facebook": "f",
            "instagram": "\u{1F4F7}",
            "tiktok": "\u266A",
            "substack": "\u2709\uFE0F",
            "reddit": "\u{1F534}"
          };
          return icons[platform] || "\u{1F310}";
        }
      };
    }
  });

  // src/platform-handler.js
  var PlatformHandler;
  var init_platform_handler = __esm({
    "src/platform-handler.js"() {
      PlatformHandler = {
        _handlers: {},
        /**
         * Register a platform handler
         */
        register: (platform, handler) => {
          PlatformHandler._handlers[platform] = handler;
        },
        /**
         * Get handler for a platform
         */
        get: (platform) => {
          return PlatformHandler._handlers[platform] || PlatformHandler._handlers["generic"];
        },
        /**
         * Check if a platform has a registered handler
         */
        has: (platform) => {
          return !!PlatformHandler._handlers[platform];
        }
      };
      PlatformHandler.register("generic", {
        type: "article",
        canCapture: () => true,
        extract: async () => {
          const { ContentExtractor: ContentExtractor2 } = await Promise.resolve().then(() => (init_content_extractor(), content_extractor_exports));
          return ContentExtractor2.extractArticle();
        },
        getReaderViewConfig: () => ({
          showEditor: true,
          showEntityBar: true,
          showClaimsBar: true,
          showComments: false
        })
      });
    }
  });

  // src/entity-auto-suggest.js
  var EntityAutoSuggest;
  var init_entity_auto_suggest = __esm({
    "src/entity-auto-suggest.js"() {
      init_config();
      init_storage();
      init_utils();
      init_entity_tagger();
      init_reader_view();
      EntityAutoSuggest = {
        suggestions: [],
        dismissedIds: /* @__PURE__ */ new Set(),
        maxVisible: 6,
        expanded: false,
        // Build a word-boundary regex that handles special characters
        buildWordBoundaryRegex: (term) => {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (/[^\w\s]/.test(term)) {
            return new RegExp("(?<=^|[\\s,;:!?\\.])" + escaped + "(?=$|[\\s,;:!?\\.])", "i");
          }
          return new RegExp("\\b" + escaped + "\\b", "i");
        },
        // Main entry point — scan article for entity suggestions
        scan: async (article) => {
          try {
            if (!article || !article.textContent) return;
            const registry = await Storage.entities.getAll();
            const existingEntities = ReaderView.entities.map((e) => e.entity_id);
            const alreadyTaggedIds = new Set(existingEntities);
            const searchText = article.title + " \n " + article.textContent;
            const suggestions = EntityAutoSuggest.matchKnownEntities(searchText, article.title, alreadyTaggedIds, registry);
            EntityAutoSuggest.suggestions = suggestions;
            EntityAutoSuggest.expanded = false;
            EntityAutoSuggest.dismissedIds = /* @__PURE__ */ new Set();
            if (suggestions.length > 0) {
              const container = document.getElementById("nac-suggestion-bar");
              if (container) {
                EntityAutoSuggest.render(container, suggestions);
              }
            }
          } catch (e) {
            Utils.error("Entity auto-suggestion scan failed:", e);
          }
        },
        // Find known entities whose name or alias appears in the article
        matchKnownEntities: (text, title, alreadyTaggedIds, registry) => {
          const results = [];
          const entities = Object.values(registry);
          const lowerText = text.toLowerCase();
          for (const entity of entities) {
            if (alreadyTaggedIds.has(entity.id)) continue;
            const searchTerms = [entity.name, ...entity.aliases || []];
            for (const term of searchTerms) {
              if (!term || term.length < CONFIG.tagging.min_selection_length) continue;
              if (lowerText.indexOf(term.toLowerCase()) === -1) continue;
              const regex = EntityAutoSuggest.buildWordBoundaryRegex(term);
              if (regex.test(text)) {
                const canonicalName = entity.canonical_id && registry[entity.canonical_id] ? registry[entity.canonical_id].name : null;
                results.push({
                  type: "known",
                  entity,
                  entityId: entity.id,
                  name: entity.name,
                  matchedOn: term,
                  canonicalName,
                  occurrences: (text.match(new RegExp(regex.source, "gi")) || []).length,
                  position: text.search(regex)
                });
                break;
              }
            }
          }
          results.sort((a, b) => a.position - b.position);
          return results;
        },
        // Get emoji for entity type
        _typeEmoji: (type) => {
          const map = { person: "\u{1F464}", organization: "\u{1F3E2}", place: "\u{1F4CD}", thing: "\u{1F537}", unknown: "\u2753" };
          return map[type] || "\u2753";
        },
        // Render the suggestion bar UI
        render: (container, suggestions) => {
          container.style.display = "block";
          const count = suggestions.length;
          const visibleCount = EntityAutoSuggest.expanded ? count : Math.min(count, EntityAutoSuggest.maxVisible);
          const hiddenCount = count - EntityAutoSuggest.maxVisible;
          container.innerHTML = `
      <div class="nac-suggestion-bar-header">
        <span class="nac-suggestion-bar-title">\u{1F50D} Recognized Entities (${count})</span>
        <button class="nac-suggestion-dismiss-all" aria-label="Dismiss all suggestions">Dismiss All</button>
      </div>
      <div class="nac-suggestion-chips">
        ${suggestions.slice(0, visibleCount).map((s, i) => EntityAutoSuggest._renderChip(s, i)).join("")}
      </div>
      ${!EntityAutoSuggest.expanded && hiddenCount > 0 ? `<button class="nac-suggestion-show-more" aria-label="Show ${hiddenCount} more suggestions">Show ${hiddenCount} more</button>` : ""}
    `;
          container.querySelector(".nac-suggestion-dismiss-all").addEventListener("click", EntityAutoSuggest.dismissAll);
          container.querySelectorAll(".nac-suggestion-accept").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const idx = parseInt(btn.closest(".nac-suggestion-chip").dataset.index, 10);
              EntityAutoSuggest.acceptSuggestion(idx);
            });
          });
          container.querySelectorAll(".nac-suggestion-dismiss").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const idx = parseInt(btn.closest(".nac-suggestion-chip").dataset.index, 10);
              EntityAutoSuggest.dismissSuggestion(idx);
            });
          });
          const showMoreBtn = container.querySelector(".nac-suggestion-show-more");
          if (showMoreBtn) {
            showMoreBtn.addEventListener("click", EntityAutoSuggest.toggleShowMore);
          }
        },
        // Render a single suggestion chip HTML
        _renderChip: (suggestion, index) => {
          const entityType = suggestion.entity.type;
          const emoji = EntityAutoSuggest._typeEmoji(entityType);
          const name = Utils.escapeHtml(suggestion.name);
          const canonicalLabel = suggestion.canonicalName ? ` \u2192 ${Utils.escapeHtml(suggestion.canonicalName)}` : "";
          return `<div class="nac-suggestion-chip nac-suggestion-known" data-index="${index}" data-entity-id="${suggestion.entityId}">
      <span class="nac-suggestion-icon">${emoji}</span>
      <span class="nac-suggestion-name">${name}${canonicalLabel}</span>
      <span class="nac-suggestion-badge">${entityType}</span>
      <div class="nac-suggestion-actions">
        <button class="nac-suggestion-accept" aria-label="Accept: ${name}">\u2713 Link</button>
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
              context: "mentioned",
              tagged_at: Math.floor(Date.now() / 1e3)
            };
            const existingIdx = entity.articles.findIndex((a) => a.url === articleEntry.url);
            if (existingIdx >= 0) {
              entity.articles[existingIdx].tagged_at = articleEntry.tagged_at;
            } else {
              entity.articles.push(articleEntry);
            }
            await Storage.entities.save(entity.id, entity);
            ReaderView.entities.push({ entity_id: entity.id, context: "mentioned" });
            EntityTagger.addChip(entity);
            Utils.showToast(`Linked entity: ${entity.name}`, "success");
          } catch (e) {
            Utils.error("Failed to accept known entity suggestion:", e);
            Utils.showToast("Failed to link entity", "error");
          }
        },
        // Accept a suggestion by index
        acceptSuggestion: async (index) => {
          const suggestion = EntityAutoSuggest.suggestions[index];
          if (!suggestion) return;
          await EntityAutoSuggest.acceptKnown(suggestion.entity);
          EntityAutoSuggest.suggestions.splice(index, 1);
          EntityAutoSuggest._refreshUI();
        },
        // Dismiss a single suggestion
        dismissSuggestion: (index) => {
          const suggestion = EntityAutoSuggest.suggestions[index];
          if (suggestion) {
            EntityAutoSuggest.dismissedIds.add(suggestion.entityId);
          }
          EntityAutoSuggest.suggestions.splice(index, 1);
          EntityAutoSuggest._refreshUI();
        },
        // Dismiss all suggestions
        dismissAll: () => {
          EntityAutoSuggest.suggestions = [];
          EntityAutoSuggest.dismissedIds = /* @__PURE__ */ new Set();
          const container = document.getElementById("nac-suggestion-bar");
          if (container) {
            container.style.display = "none";
            container.innerHTML = "";
          }
        },
        // Toggle show more / collapse
        toggleShowMore: () => {
          EntityAutoSuggest.expanded = !EntityAutoSuggest.expanded;
          EntityAutoSuggest._refreshUI();
        },
        // Refresh the suggestion bar UI
        _refreshUI: () => {
          const container = document.getElementById("nac-suggestion-bar");
          if (!container) return;
          if (EntityAutoSuggest.suggestions.length === 0) {
            container.style.display = "none";
            container.innerHTML = "";
            return;
          }
          EntityAutoSuggest.render(container, EntityAutoSuggest.suggestions);
        },
        // Remove a suggestion by entity ID (called when entity is manually tagged)
        removeSuggestionByEntityId: (entityId) => {
          const idx = EntityAutoSuggest.suggestions.findIndex(
            (s) => s.type === "known" && s.entityId === entityId
          );
          if (idx >= 0) {
            EntityAutoSuggest.suggestions.splice(idx, 1);
            EntityAutoSuggest._refreshUI();
          }
        },
        // Clean up suggestion state
        destroy: () => {
          EntityAutoSuggest.suggestions = [];
          EntityAutoSuggest.dismissedIds = /* @__PURE__ */ new Set();
          EntityAutoSuggest.expanded = false;
          const container = document.getElementById("nac-suggestion-bar");
          if (container) {
            container.style.display = "none";
            container.innerHTML = "";
          }
        }
      };
    }
  });

  // src/relay-client.js
  var RelayClient;
  var init_relay_client = __esm({
    "src/relay-client.js"() {
      init_crypto();
      RelayClient = {
        connections: /* @__PURE__ */ new Map(),
        // Connect to relay
        connect: (url) => {
          const attemptConnect = () => {
            return new Promise((resolve, reject) => {
              try {
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
          const MAX_RETRIES = 3;
          const BASE_DELAY = 1e3;
          return (async () => {
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              try {
                return await attemptConnect();
              } catch (err) {
                if (attempt < MAX_RETRIES) {
                  const delay = BASE_DELAY * Math.pow(2, attempt);
                  console.log(`[NAC Relay] Connection to ${url} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`);
                  await new Promise((r) => setTimeout(r, delay));
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
            const message = JSON.stringify(["EVENT", event]);
            ws.send(message);
            const result = await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve({ accepted: false, message: "Timeout waiting for relay response" }), 5e3);
              const handler = (e) => {
                try {
                  const data = JSON.parse(e.data);
                  if (data[0] === "OK" && data[1] === event.id) {
                    clearTimeout(timeout);
                    ws.removeEventListener("message", handler);
                    resolve({ accepted: data[2], message: data[3] || "" });
                  } else if (data[0] === "NOTICE") {
                    console.log(`[NAC Relay] NOTICE from ${url}: ${data[1]}`);
                  }
                } catch (err) {
                }
              };
              ws.addEventListener("message", handler);
            });
            return { url, success: result.accepted, error: result.accepted ? null : result.message || "Event rejected by relay" };
          };
          const settled = await Promise.allSettled(
            relayUrls.map((url) => publishToRelay(url).catch((e) => ({ url, success: false, error: e.message })))
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
        // options.onProgress(info) — optional callback for connection-level progress
        subscribe: async (filter, relayUrls, options = {}) => {
          const timeout = options.timeout || 15e3;
          const idleTimeout = options.idleTimeout || 1e4;
          const onProgress = options.onProgress || (() => {
          });
          const events = [];
          const subId = Crypto.bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
          const connectionStats = { attempted: 0, connected: 0, failed: 0, errors: [] };
          for (const url of relayUrls) {
            connectionStats.attempted++;
            onProgress({ phase: "connecting", url, ...connectionStats });
            try {
              const ws = await RelayClient.connect(url);
              connectionStats.connected++;
              onProgress({ phase: "connected", url, ...connectionStats });
              ws.send(JSON.stringify(["REQ", subId, filter]));
              await new Promise((resolve) => {
                let idleTimer = setTimeout(resolve, idleTimeout);
                const totalTimer = setTimeout(resolve, timeout);
                const handler = (e) => {
                  try {
                    const data = JSON.parse(e.data);
                    if (data[0] === "EVENT" && data[1] === subId) {
                      events.push(data[2]);
                      clearTimeout(idleTimer);
                      idleTimer = setTimeout(resolve, idleTimeout);
                    } else if (data[0] === "EOSE" && data[1] === subId) {
                      clearTimeout(idleTimer);
                      clearTimeout(totalTimer);
                      ws.removeEventListener("message", handler);
                      resolve();
                    }
                  } catch (parseErr) {
                    console.error("[NAC RelayClient] Parse error:", parseErr);
                  }
                };
                ws.addEventListener("message", handler);
              });
              try {
                ws.send(JSON.stringify(["CLOSE", subId]));
              } catch (e) {
              }
            } catch (e) {
              connectionStats.failed++;
              const errMsg = e.message || "Connection failed";
              connectionStats.errors.push({ url, error: errMsg });
              console.error("[NAC RelayClient] Subscribe error:", url, e);
              onProgress({ phase: "relay_error", url, error: errMsg, ...connectionStats });
            }
          }
          events._connectionStats = connectionStats;
          return events;
        }
      };
    }
  });

  // src/event-builder.js
  var EventBuilder;
  var init_event_builder = __esm({
    "src/event-builder.js"() {
      init_storage();
      init_crypto();
      init_content_extractor();
      EventBuilder = {
        // Build NIP-23 article event (kind 30023)
        buildArticleEvent: async (article, entities, userPubkey, claims = []) => {
          let markdownContent = article.content;
          if (markdownContent && markdownContent.includes("<")) {
            markdownContent = ContentExtractor.htmlToMarkdown(markdownContent);
          }
          let metadataHeader = "---\n";
          metadataHeader += `**Source**: [${article.title}](${article.url})
`;
          const metaParts = [];
          if (article.siteName) metaParts.push(`**Publisher**: ${article.siteName}`);
          if (article.byline) metaParts.push(`**Author**: ${article.byline}`);
          if (metaParts.length) metadataHeader += metaParts.join(" | ") + "\n";
          const dateParts = [];
          if (article.publishedAt) {
            dateParts.push(`**Published**: ${new Date(article.publishedAt * 1e3).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
          }
          dateParts.push(`**Archived**: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
          metadataHeader += dateParts.join(" | ") + "\n";
          metadataHeader += "---\n\n";
          const content = metadataHeader + markdownContent;
          const tags = [
            ["d", await EventBuilder.generateDTag(article.url)],
            ["title", article.title || "Untitled"],
            ["published_at", String(article.publishedAt || Math.floor(Date.now() / 1e3))],
            ["r", article.url],
            ["client", "nostr-article-capture"]
          ];
          if (article.excerpt) {
            tags.push(["summary", article.excerpt.substring(0, 500)]);
          }
          if (article.featuredImage) {
            tags.push(["image", article.featuredImage]);
          }
          if (article.byline) {
            tags.push(["author", article.byline]);
          }
          const taggedPubkeys = /* @__PURE__ */ new Set();
          for (const entityRef of entities) {
            const entity = await Storage.entities.get(entityRef.entity_id);
            if (entity && entity.keypair) {
              tags.push(["p", entity.keypair.pubkey, "", entityRef.context]);
              taggedPubkeys.add(entity.keypair.pubkey);
              const tagType = entity.type === "person" ? "person" : entity.type === "organization" ? "org" : entity.type === "thing" ? "thing" : "place";
              tags.push([tagType, entity.name, entityRef.context]);
              if (entity.canonical_id) {
                const canonical = await Storage.entities.get(entity.canonical_id);
                if (canonical && canonical.keypair && !taggedPubkeys.has(canonical.keypair.pubkey)) {
                  tags.push(["p", canonical.keypair.pubkey, "", entityRef.context]);
                  taggedPubkeys.add(canonical.keypair.pubkey);
                  const canonTagType = canonical.type === "person" ? "person" : canonical.type === "organization" ? "org" : canonical.type === "thing" ? "thing" : "place";
                  tags.push([canonTagType, canonical.name, entityRef.context]);
                }
              }
            }
          }
          if (article.siteName) {
            tags.push(["site_name", article.siteName]);
          }
          if (article.publicationIcon) {
            tags.push(["icon", article.publicationIcon]);
          }
          if (Array.isArray(claims)) {
            for (const claim of claims) {
              if (claim.is_crux) {
                tags.push(["claim", claim.text, claim.type, "crux"]);
              } else {
                tags.push(["claim", claim.text, claim.type]);
              }
            }
          }
          if (article.wordCount) tags.push(["word_count", String(article.wordCount)]);
          if (article.section) tags.push(["section", article.section]);
          if (article.keywords?.length) article.keywords.forEach((kw) => tags.push(["t", kw.toLowerCase()]));
          if (article.language) tags.push(["lang", article.language]);
          if (article.dateModified) tags.push(["modified_at", String(Math.floor(new Date(article.dateModified).getTime() / 1e3))]);
          if (article.isPaywalled) tags.push(["paywalled", "true"]);
          if (article.structuredData?.type) tags.push(["content_type", article.structuredData.type]);
          if (article.contentType) tags.push(["content_format", article.contentType]);
          if (article.platform) tags.push(["platform", article.platform]);
          tags.push(["t", "article"]);
          if (article.domain) {
            tags.push(["t", article.domain.replace(/\./g, "-")]);
          }
          const event = {
            kind: 30023,
            pubkey: userPubkey || "",
            created_at: Math.floor(Date.now() / 1e3),
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
            tags.push(["refers_to", canonicalNpub]);
          }
          return {
            kind: 0,
            pubkey: entity.keypair.pubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags,
            content: JSON.stringify({
              name: entity.name,
              about: `${entity.type} entity created by nostr-article-capture`,
              nip05: entity.nip05 || void 0
            })
          };
        },
        // Build kind 30040 claim event
        buildClaimEvent: (claim, articleUrl, articleTitle, userPubkey, entities) => {
          const tags = [
            ["d", claim.id],
            ["r", articleUrl],
            ["claim-text", claim.text],
            ["claim-type", claim.type],
            ["title", articleTitle]
          ];
          if (claim.is_crux) tags.push(["crux", "true"]);
          if (claim.confidence != null) tags.push(["confidence", String(claim.confidence)]);
          tags.push(["attribution", claim.attribution || "editorial"]);
          if (claim.claimant_entity_id && entities) {
            const claimant = entities[claim.claimant_entity_id];
            if (claimant && claimant.keypair) {
              tags.push(["p", claimant.keypair.pubkey, "", "claimant"]);
              tags.push(["claimant", claimant.name]);
            }
          }
          if (Array.isArray(claim.subject_entity_ids) && claim.subject_entity_ids.length > 0 && entities) {
            for (const sid of claim.subject_entity_ids) {
              const subject = entities[sid];
              if (subject && subject.keypair) {
                tags.push(["p", subject.keypair.pubkey, "", "subject"]);
                tags.push(["subject", subject.name]);
              }
            }
          } else if (claim.subject_text) {
            tags.push(["subject", claim.subject_text]);
          }
          if (Array.isArray(claim.object_entity_ids) && claim.object_entity_ids.length > 0 && entities) {
            for (const oid of claim.object_entity_ids) {
              const obj = entities[oid];
              if (obj && obj.keypair) {
                tags.push(["p", obj.keypair.pubkey, "", "object"]);
                tags.push(["object", obj.name]);
              }
            }
          } else if (claim.object_text) {
            tags.push(["object", claim.object_text]);
          }
          if (claim.predicate) {
            tags.push(["predicate", claim.predicate]);
          }
          if (claim.quote_date) {
            tags.push(["quote-date", claim.quote_date]);
          }
          return {
            kind: 30040,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags,
            content: claim.context || ""
          };
        },
        // Build kind 30078 entity sync event (NIP-78 application-specific data)
        buildEntitySyncEvent: (entityId, encryptedContent, entityType, userPubkey) => {
          return {
            kind: 30078,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags: [
              ["d", entityId],
              ["client", "nostr-article-capture"],
              ["entity-type", entityType],
              ["L", "nac/entity-sync"],
              ["l", "v1", "nac/entity-sync"]
            ],
            content: encryptedContent
          };
        },
        // Build kind 32125 entity relationship event
        buildEntityRelationshipEvent: (entity, articleUrl, relationshipType, userPubkey, claimId) => {
          return {
            kind: 32125,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags: [
              ["d", `${entity.id}:${articleUrl}:${relationshipType}`],
              ["r", articleUrl],
              ["p", entity.keypair.pubkey, "", relationshipType],
              ["entity-name", entity.name],
              ["entity-type", entity.type],
              ["relationship", relationshipType],
              ["client", "nostr-article-capture"],
              ...claimId ? [["claim-ref", claimId]] : []
            ],
            content: ""
          };
        },
        // Build kind 30041 comment event
        buildCommentEvent: (comment, articleUrl, articleTitle, userPubkey, accountPubkey) => {
          return {
            kind: 30041,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags: [
              ["d", comment.id],
              ["r", articleUrl],
              ["title", articleTitle],
              ["comment-text", comment.text],
              ["comment-author", comment.authorName],
              ["platform", comment.platform],
              ...accountPubkey ? [["p", accountPubkey, "", "commenter"]] : [],
              ...comment.timestamp ? [["comment-date", String(Math.floor(comment.timestamp / 1e3))]] : [],
              ...comment.replyTo ? [["reply-to", comment.replyTo]] : [],
              ["client", "nostr-article-capture"]
            ],
            content: comment.text
          };
        },
        // Build kind 32126 platform account event
        buildPlatformAccountEvent: (account, userPubkey) => {
          return {
            kind: 32126,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags: [
              ["d", account.id],
              ["p", account.keypair.pubkey, "", "account"],
              ["account-username", account.username],
              ["account-platform", account.platform],
              ...account.profileUrl ? [["r", account.profileUrl]] : [],
              ...account.linkedEntityId ? [["linked-entity", account.linkedEntityId]] : [],
              ["client", "nostr-article-capture"]
            ],
            content: ""
          };
        },
        // Build kind 30043 evidence link event
        buildEvidenceLinkEvent: async (link, allClaims, userPubkey) => {
          const sourceClaim = allClaims[link.source_claim_id];
          const targetClaim = allClaims[link.target_claim_id];
          const tags = [
            ["d", link.id],
            ["source-claim", link.source_claim_id],
            ["target-claim", link.target_claim_id],
            ["relationship", link.relationship],
            ["client", "nostr-article-capture"]
          ];
          if (sourceClaim?.source_url) tags.push(["r", sourceClaim.source_url]);
          if (targetClaim?.source_url) tags.push(["r", targetClaim.source_url]);
          return {
            kind: 30043,
            pubkey: userPubkey,
            created_at: Math.floor(Date.now() / 1e3),
            tags,
            content: link.note || ""
          };
        }
      };
    }
  });

  // src/entity-sync.js
  var EntitySync;
  var init_entity_sync = __esm({
    "src/entity-sync.js"() {
      init_storage();
      init_crypto();
      init_event_builder();
      init_relay_client();
      EntitySync = {
        validateEntity(entity) {
          return entity && typeof entity.id === "string" && typeof entity.name === "string" && ["person", "organization", "place", "thing"].includes(entity.type) && entity.keypair && typeof entity.keypair.pubkey === "string" && entity.keypair.pubkey.length === 64 && typeof entity.updated === "number" && (entity.canonical_id === null || entity.canonical_id === void 0 || typeof entity.canonical_id === "string");
        },
        mergeArticles(localArticles = [], remoteArticles = []) {
          const byUrl = /* @__PURE__ */ new Map();
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
          const { publishProfiles = false, onProgress = () => {
          } } = options;
          const identity = await Storage.identity.get();
          if (!identity?.privkey) throw new Error("Entity sync requires a local private key");
          const registry = await Storage.entities.getAll();
          const entities = Object.values(registry);
          if (entities.length === 0) throw new Error("No entities to sync");
          onProgress({ phase: "encrypting", total: entities.length });
          const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);
          const relayConfig = await Storage.relays.get();
          const writeRelays = relayConfig.relays.filter((r) => r.enabled && r.write).map((r) => r.url);
          if (writeRelays.length === 0) throw new Error("No write-enabled relays configured");
          const results = [];
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            onProgress({ phase: "publishing", current: i + 1, total: entities.length, name: entity.name });
            try {
              const plaintext = JSON.stringify(entity);
              const encrypted = await Crypto.nip44Encrypt(plaintext, conversationKey);
              const event = EventBuilder.buildEntitySyncEvent(entity.id, encrypted, entity.type, identity.pubkey);
              const signed = await Crypto.signEvent(event, identity.privkey);
              const relayResults = await RelayClient.publish(signed, writeRelays);
              results.push({ entity: entity.name, id: entity.id, relayResults, success: true });
            } catch (e) {
              console.error("[NAC EntitySync] Push error for", entity.id, e);
              results.push({ entity: entity.name, id: entity.id, error: e.message, success: false });
            }
          }
          if (publishProfiles) {
            onProgress({ phase: "profiles", total: entities.length });
            for (const entity of entities) {
              try {
                if (entity.keypair?.privkey) {
                  let canonicalNpub = null;
                  if (entity.canonical_id) {
                    const canonical = await Storage.entities.get(entity.canonical_id);
                    if (canonical && canonical.keypair) {
                      canonicalNpub = canonical.keypair.npub || Crypto.hexToNpub(canonical.keypair.pubkey);
                    }
                  }
                  const profileEvent = EventBuilder.buildProfileEvent(entity, canonicalNpub);
                  const signed = await Crypto.signEvent(profileEvent, entity.keypair.privkey);
                  await RelayClient.publish(signed, writeRelays);
                }
              } catch (e) {
                console.error("[NAC EntitySync] Profile publish error:", entity.id, e);
              }
            }
          }
          await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1e3));
          onProgress({ phase: "complete", results });
          return results;
        },
        async pull(options = {}) {
          const { onProgress = () => {
          } } = options;
          const identity = await Storage.identity.get();
          if (!identity?.privkey) throw new Error("Entity sync requires a local private key");
          onProgress({ phase: "fetching" });
          const relayConfig = await Storage.relays.get();
          const readRelays = relayConfig.relays.filter((r) => r.enabled && r.read).map((r) => r.url);
          if (readRelays.length === 0) throw new Error("No read-enabled relays configured");
          const filter = {
            kinds: [30078],
            authors: [identity.pubkey],
            "#L": ["nac/entity-sync"]
          };
          const rawEvents = await RelayClient.subscribe(filter, readRelays, {
            timeout: 15e3,
            idleTimeout: 1e4,
            onProgress: (p) => {
              if (p.phase === "connecting") {
                onProgress({ phase: "fetching", detail: `Connecting to ${p.url} (${p.attempted}/${readRelays.length})\u2026` });
              } else if (p.phase === "relay_error") {
                onProgress({ phase: "fetching", detail: `\u26A0 ${p.url}: ${p.error} (${p.connected}/${p.attempted} connected)` });
              }
            }
          });
          const connStats = rawEvents._connectionStats || { attempted: 0, connected: 0, failed: 0, errors: [] };
          const decryptErrors = [];
          if (rawEvents.length === 0) {
            const noDataStats = { imported: 0, updated: 0, unchanged: 0, keptLocal: 0, total: 0 };
            onProgress({
              phase: "complete",
              stats: noDataStats,
              connectionStats: connStats,
              decryptErrors
            });
            return { stats: noDataStats, merged: {}, connectionStats: connStats };
          }
          const byDTag = /* @__PURE__ */ new Map();
          for (const evt of rawEvents) {
            const dTag = evt.tags?.find((t) => t[0] === "d")?.[1];
            if (!dTag) continue;
            const existing = byDTag.get(dTag);
            if (!existing || evt.created_at > existing.created_at) {
              byDTag.set(dTag, evt);
            }
          }
          const uniqueEvents = Array.from(byDTag.values());
          onProgress({ phase: "decrypting", total: uniqueEvents.length });
          const conversationKey = await Crypto.nip44GetConversationKey(identity.privkey, identity.pubkey);
          const sharedSecret = await Crypto.getSharedSecret(identity.privkey, identity.pubkey);
          const remoteEntities = [];
          for (const evt of uniqueEvents) {
            try {
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
                console.warn("[NAC EntitySync] Invalid entity structure, skipping:", entity?.id);
                decryptErrors.push("Invalid structure: " + (entity?.id || "unknown"));
              }
            } catch (e) {
              console.error("[NAC EntitySync] Decrypt/parse error:", e);
              decryptErrors.push(e.message || "Decrypt failed");
            }
          }
          onProgress({ phase: "merging", remote: remoteEntities.length });
          const localRegistry = await Storage.entities.getAll();
          const { merged, stats } = EntitySync.mergeEntities(localRegistry, remoteEntities);
          const saveResult = await Storage.set("entity_registry", merged);
          if (!saveResult) {
            console.error("[NAC Storage] Failed to save merged entity registry");
          }
          await Storage.entities.setLastSyncTime(Math.floor(Date.now() / 1e3));
          stats.total = remoteEntities.length;
          onProgress({ phase: "complete", stats, connectionStats: connStats, decryptErrors });
          return { stats, merged, connectionStats: connStats };
        }
      };
    }
  });

  // src/entity-browser.js
  var EntityBrowser;
  var init_entity_browser = __esm({
    "src/entity-browser.js"() {
      init_storage();
      init_utils();
      init_entity_sync();
      EntityBrowser = {
        TYPE_EMOJI: { person: "\u{1F464}", organization: "\u{1F3E2}", place: "\u{1F4CD}", thing: "\u{1F537}" },
        TYPE_LABELS: { person: "Person", organization: "Org", place: "Place", thing: "Thing" },
        _registry: {},
        init: async (panel, identity) => {
          const container = panel.querySelector("#nac-entity-browser");
          if (!container) return;
          const registry = await Storage.entities.getAll();
          EntityBrowser._registry = registry;
          const entities = Object.values(registry);
          container.innerHTML = EntityBrowser.renderListView(entities);
          EntityBrowser.bindListEvents(container, panel, identity);
        },
        renderListView: (entities) => {
          const count = entities.length;
          return `
      <div class="nac-eb-list-view">
        <div class="nac-eb-search-bar">
          <input type="text" class="nac-eb-search" placeholder="Search entities\u2026" id="nac-eb-search">
        </div>
        <div class="nac-eb-type-filters">
          <button class="nac-eb-type-btn active" data-filter="all">All (${count})</button>
          <button class="nac-eb-type-btn" data-filter="person" aria-label="Filter by Person">\u{1F464}</button>
          <button class="nac-eb-type-btn" data-filter="organization" aria-label="Filter by Organization">\u{1F3E2}</button>
          <button class="nac-eb-type-btn" data-filter="place" aria-label="Filter by Place">\u{1F4CD}</button>
          <button class="nac-eb-type-btn" data-filter="thing" aria-label="Filter by Thing">\u{1F537}</button>
        </div>
        <div class="nac-eb-entity-list" id="nac-eb-entity-list">
          ${EntityBrowser.renderEntityCards(entities)}
        </div>
        ${count === 0 ? '<div class="nac-eb-empty">No entities yet. Tag text in articles to create entities.</div>' : ""}
        <div class="nac-eb-actions">
          <button class="nac-btn" id="nac-eb-export">\u{1F4E4} Export</button>
          <button class="nac-btn" id="nac-eb-import">\u{1F4E5} Import</button>
        </div>
        <div class="nac-eb-sync-section">
          <div class="nac-eb-sync-title">\u{1F504} Entity Sync</div>
          <div class="nac-eb-sync-desc">Sync entities across browsers via encrypted NOSTR events.</div>
          <label class="nac-eb-sync-label">
            <input type="checkbox" id="nac-publish-profiles" style="accent-color: var(--nac-primary);">
            Also publish entity profiles (kind 0 \u2014 public name only)
          </label>
          <div class="nac-eb-sync-buttons">
            <button id="nac-push-entities" class="nac-eb-sync-btn">\u2B06 Push to NOSTR</button>
            <button id="nac-pull-entities" class="nac-eb-sync-btn">\u2B07 Pull from NOSTR</button>
          </div>
          <div id="nac-sync-status" class="nac-eb-sync-status" style="display: none;"></div>
        </div>
      </div>
    `;
        },
        renderEntityCards: (entities) => {
          if (!entities.length) return "";
          const sorted = [...entities].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          return sorted.map((e) => {
            const emoji = EntityBrowser.TYPE_EMOJI[e.type] || "\u{1F537}";
            const articleCount = (e.articles || []).length;
            const created = e.created_at ? new Date(e.created_at * 1e3).toLocaleDateString() : "Unknown";
            const canonicalEntity = e.canonical_id ? EntityBrowser._registry[e.canonical_id] : null;
            const aliasLabel = canonicalEntity ? `<div class="nac-eb-card-alias">\u2192 ${Utils.escapeHtml(canonicalEntity.name)}</div>` : "";
            return `
        <div class="nac-eb-card nac-eb-card-${e.type}${e.canonical_id ? " nac-eb-card-alias-entity" : ""}" data-entity-id="${Utils.escapeHtml(e.id)}" tabindex="0" role="button" aria-label="${Utils.escapeHtml(e.name)} \u2014 ${e.type}">
          <div class="nac-eb-card-main">
            <span class="nac-eb-card-emoji">${emoji}</span>
            <div class="nac-eb-card-info">
              <div class="nac-eb-card-name">${Utils.escapeHtml(e.name)}</div>
              ${aliasLabel}
              <div class="nac-eb-card-meta">${articleCount} article${articleCount !== 1 ? "s" : ""} \xB7 ${created}</div>
            </div>
            <span class="nac-eb-card-arrow">\u203A</span>
          </div>
        </div>
      `;
          }).join("");
        },
        bindListEvents: (container, panel, identity) => {
          const searchInput = container.querySelector("#nac-eb-search");
          const typeButtons = container.querySelectorAll(".nac-eb-type-btn");
          let activeFilter = "all";
          const filterEntities = async () => {
            const query = (searchInput?.value || "").toLowerCase();
            const registry = await Storage.entities.getAll();
            let entities = Object.values(registry);
            if (activeFilter !== "all") {
              entities = entities.filter((e) => e.type === activeFilter);
            }
            if (query) {
              entities = entities.filter(
                (e) => e.name.toLowerCase().includes(query) || (e.aliases || []).some((a) => a.toLowerCase().includes(query))
              );
            }
            const listEl = container.querySelector("#nac-eb-entity-list");
            if (listEl) listEl.innerHTML = EntityBrowser.renderEntityCards(entities);
            container.querySelectorAll(".nac-eb-card").forEach((card) => {
              card.addEventListener("click", () => {
                const entityId = card.dataset.entityId;
                EntityBrowser.showDetail(container, entityId, panel, identity);
              });
              card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  card.click();
                }
              });
            });
          };
          searchInput?.addEventListener("input", filterEntities);
          typeButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
              typeButtons.forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              activeFilter = btn.dataset.filter;
              filterEntities();
            });
          });
          container.querySelectorAll(".nac-eb-card").forEach((card) => {
            card.addEventListener("click", () => {
              const entityId = card.dataset.entityId;
              EntityBrowser.showDetail(container, entityId, panel, identity);
            });
            card.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                card.click();
              }
            });
          });
          container.querySelector("#nac-eb-export")?.addEventListener("click", async () => {
            const json = await Storage.entities.exportAll();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "nostr-entities-" + Date.now() + ".json";
            a.click();
            Utils.showToast("Entities exported", "success");
          });
          container.querySelector("#nac-eb-import")?.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async (ev) => {
              const file = ev.target.files[0];
              if (!file) return;
              const text = await file.text();
              try {
                const count = await Storage.entities.importAll(text);
                Utils.showToast(`Imported ${count} entities`, "success");
                await EntityBrowser.init(panel, identity);
              } catch (err) {
                Utils.showToast("Import failed: " + err.message, "error");
              }
            };
            input.click();
          });
          container.querySelector("#nac-push-entities")?.addEventListener("click", async () => {
            const statusEl = container.querySelector("#nac-sync-status");
            statusEl.style.display = "block";
            const pushBtn = container.querySelector("#nac-push-entities");
            const pullBtn = container.querySelector("#nac-pull-entities");
            pushBtn.disabled = true;
            pullBtn.disabled = true;
            try {
              const publishProfiles = container.querySelector("#nac-publish-profiles")?.checked || false;
              await EntitySync.push({
                publishProfiles,
                onProgress: (p) => {
                  if (p.phase === "encrypting") statusEl.textContent = `\u23F3 Encrypting ${p.total} entities...`;
                  else if (p.phase === "publishing") statusEl.textContent = `\u23F3 Publishing entity ${p.current}/${p.total}: ${p.name}...`;
                  else if (p.phase === "profiles") statusEl.textContent = `\u23F3 Publishing ${p.total} entity profiles...`;
                  else if (p.phase === "complete") {
                    const succeeded = p.results.filter((r) => r.success).length;
                    const failed = p.results.filter((r) => !r.success).length;
                    statusEl.innerHTML = `\u2705 Push complete: ${succeeded} entities published` + (failed > 0 ? `, <span style="color: var(--nac-error);">${failed} failed</span>` : "");
                  }
                }
              });
            } catch (e) {
              statusEl.innerHTML = `<span style="color: var(--nac-error);">\u274C ${Utils.escapeHtml(e.message)}</span>`;
            } finally {
              pushBtn.disabled = false;
              pullBtn.disabled = false;
            }
          });
          container.querySelector("#nac-pull-entities")?.addEventListener("click", async () => {
            const statusEl = container.querySelector("#nac-sync-status");
            statusEl.style.display = "block";
            const pushBtn = container.querySelector("#nac-push-entities");
            const pullBtn = container.querySelector("#nac-pull-entities");
            pushBtn.disabled = true;
            pullBtn.disabled = true;
            try {
              await EntitySync.pull({
                onProgress: (p) => {
                  if (p.phase === "fetching") {
                    const detail = p.detail || "Connecting to relays...";
                    statusEl.textContent = `\u23F3 ${detail}`;
                  } else if (p.phase === "decrypting") statusEl.textContent = `\u23F3 Received ${p.total} events, decrypting...`;
                  else if (p.phase === "merging") statusEl.textContent = `\u23F3 Merging ${p.remote} entities...`;
                  else if (p.phase === "complete") {
                    const cs = p.connectionStats || {};
                    const connInfo = cs.attempted ? `<br><span style="font-size: 10px; color: #888;">Relays: ${cs.connected}/${cs.attempted} connected` + (cs.failed > 0 ? `, ${cs.failed} failed` : "") + "</span>" : "";
                    const decryptInfo = p.decryptErrors && p.decryptErrors.length > 0 ? `<br><span style="font-size: 10px; color: #ff9800;">\u26A0 ${p.decryptErrors.length} decrypt error(s)</span>` : "";
                    if (p.stats.total === 0) {
                      statusEl.innerHTML = "\u2139\uFE0F No entity sync events found on relays for this identity." + connInfo + decryptInfo;
                    } else {
                      statusEl.innerHTML = `\u2705 Sync complete:<br>&nbsp;&nbsp;${p.stats.imported} new entities imported<br>&nbsp;&nbsp;${p.stats.updated} entities updated (newer remote)<br>&nbsp;&nbsp;${p.stats.unchanged} entities unchanged<br>&nbsp;&nbsp;${p.stats.keptLocal} entities kept (newer local)` + connInfo + decryptInfo;
                    }
                  }
                }
              });
              setTimeout(async () => {
                await EntityBrowser.init(panel, identity);
              }, 3e3);
            } catch (e) {
              statusEl.innerHTML = `<span style="color: var(--nac-error);">\u274C ${Utils.escapeHtml(e.message)}</span>`;
            } finally {
              pushBtn.disabled = false;
              pullBtn.disabled = false;
            }
          });
          if (!identity?.privkey) {
            const pushEl = container.querySelector("#nac-push-entities");
            const pullEl = container.querySelector("#nac-pull-entities");
            if (pushEl) pushEl.disabled = true;
            if (pullEl) pullEl.disabled = true;
            const statusEl = container.querySelector("#nac-sync-status");
            if (statusEl) {
              statusEl.style.display = "block";
              statusEl.innerHTML = "\u26A0\uFE0F Entity sync requires a local private key. Import your nsec or generate a new keypair.";
            }
          }
        },
        showDetail: async (container, entityId, panel, identity) => {
          const entity = await Storage.entities.get(entityId);
          if (!entity) {
            Utils.showToast("Entity not found", "error");
            return;
          }
          const emoji = EntityBrowser.TYPE_EMOJI[entity.type] || "\u{1F537}";
          const typeLabel = EntityBrowser.TYPE_LABELS[entity.type] || entity.type;
          const articles = entity.articles || [];
          const aliases = entity.aliases || [];
          const created = entity.created_at ? new Date(entity.created_at * 1e3).toLocaleString() : "Unknown";
          let canonicalEntity = null;
          if (entity.canonical_id) {
            canonicalEntity = await Storage.entities.get(entity.canonical_id);
          }
          const registry = await Storage.entities.getAll();
          const aliasEntities = Object.values(registry).filter((e) => e.canonical_id === entityId);
          let canonicalSectionHtml = "";
          if (canonicalEntity) {
            canonicalSectionHtml = `
        <div class="nac-eb-section nac-eb-canonical-section">
          <div class="nac-eb-section-title">\u{1F517} Canonical Reference</div>
          <div class="nac-eb-canonical-info">
            Alias of: <button class="nac-eb-canonical-link" id="nac-eb-goto-canonical" data-entity-id="${Utils.escapeHtml(canonicalEntity.id)}">${Utils.escapeHtml(canonicalEntity.name)}</button>
            <button class="nac-eb-remove-alias-btn" id="nac-eb-remove-alias" title="Remove alias link">\u2715 Unlink</button>
          </div>
        </div>
      `;
          } else if (aliasEntities.length > 0) {
            canonicalSectionHtml = `
        <div class="nac-eb-section nac-eb-canonical-section">
          <div class="nac-eb-section-title">\u{1F517} Known Aliases</div>
          <div class="nac-eb-alias-entities">
            ${aliasEntities.map((ae) => `
              <button class="nac-eb-alias-entity-link" data-entity-id="${Utils.escapeHtml(ae.id)}">${Utils.escapeHtml(ae.name)}</button>
            `).join("")}
          </div>
        </div>
      `;
          }
          container.innerHTML = `
      <div class="nac-eb-detail">
        <button class="nac-eb-back" id="nac-eb-back">\u2190 Back to list</button>
        <div class="nac-eb-detail-header">
          <span class="nac-eb-detail-emoji">${emoji}</span>
          <h3 class="nac-eb-detail-name" id="nac-eb-detail-name" title="Click to rename" tabindex="0" role="button" aria-label="Rename entity ${Utils.escapeHtml(entity.name)}">${Utils.escapeHtml(entity.name)}</h3>
          <span class="nac-eb-detail-badge nac-eb-badge-${entity.type}">${typeLabel}</span>
        </div>
        <div class="nac-eb-detail-created">Created: ${created}</div>
        
        ${canonicalSectionHtml}
        
        <div class="nac-eb-section">
          <button class="nac-btn" id="nac-eb-set-alias" style="width:100%; margin-bottom: 12px; font-size: 12px; padding: 6px;">\u{1F517} Set as alias of\u2026</button>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Aliases</div>
          <div class="nac-eb-aliases" id="nac-eb-aliases">
            ${aliases.map((a, i) => `
              <span class="nac-eb-alias">
                ${Utils.escapeHtml(a)}
                <button class="nac-eb-alias-remove" data-index="${i}" title="Remove alias">\u2715</button>
              </span>
            `).join("")}
            ${aliases.length === 0 ? '<span class="nac-eb-no-aliases">No aliases</span>' : ""}
          </div>
          <div class="nac-eb-alias-add">
            <input type="text" class="nac-eb-alias-input" id="nac-eb-alias-input" placeholder="Add alias\u2026">
            <button class="nac-btn" id="nac-eb-add-alias">Add</button>
          </div>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Keypair</div>
          <div class="nac-eb-keypair">
            <div class="nac-eb-key-row">
              <span class="nac-eb-key-label">npub:</span>
              <code class="nac-eb-key-value">${Utils.escapeHtml(entity.keypair?.npub || "N/A")}</code>
              <button class="nac-eb-copy-btn" data-copy="${Utils.escapeHtml(entity.keypair?.npub || "")}" title="Copy npub">\u{1F4CB}</button>
            </div>
            <div class="nac-eb-key-row">
              <span class="nac-eb-key-label">nsec:</span>
              <code class="nac-eb-key-value nac-eb-nsec-hidden" id="nac-eb-nsec-value">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</code>
              <button class="nac-eb-copy-btn" id="nac-eb-toggle-nsec" title="Reveal nsec">\u{1F441}</button>
              <button class="nac-eb-copy-btn" id="nac-eb-copy-nsec" title="Copy nsec">\u{1F4CB}</button>
            </div>
          </div>
        </div>
        
        <div class="nac-eb-section">
          <div class="nac-eb-section-title">Articles (${articles.length})</div>
          <div class="nac-eb-articles" id="nac-eb-articles">
            ${articles.length === 0 ? '<div class="nac-eb-no-articles">No linked articles</div>' : ""}
            ${articles.map((a) => `
              <div class="nac-eb-article-item">
                <div class="nac-eb-article-title">${Utils.escapeHtml(a.title || "Untitled")}</div>
                <a class="nac-eb-article-url" href="${Utils.escapeHtml(a.url || "#")}" target="_blank" rel="noopener">${Utils.escapeHtml(a.url || "")}</a>
                <div class="nac-eb-article-meta">
                  <span class="nac-eb-article-context">${Utils.escapeHtml(a.context || "mentioned")}</span>
                  ${a.tagged_at ? `<span>\xB7 ${new Date(a.tagged_at * 1e3).toLocaleDateString()}</span>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        
        <div class="nac-eb-danger-zone">
          <button class="nac-eb-delete-btn" id="nac-eb-delete">\u{1F5D1} Delete Entity</button>
        </div>
      </div>
    `;
          EntityBrowser.bindDetailEvents(container, entity, panel, identity);
        },
        bindDetailEvents: (container, entity, panel, identity) => {
          container.querySelector("#nac-eb-back")?.addEventListener("click", async () => {
            await EntityBrowser.init(panel, identity);
          });
          container.querySelector("#nac-eb-set-alias")?.addEventListener("click", async () => {
            const searchTerm = prompt("Search for canonical entity:");
            if (!searchTerm || !searchTerm.trim()) return;
            const results = await Storage.entities.search(searchTerm.trim());
            const filtered = results.filter((r) => r.id !== entity.id);
            if (filtered.length === 0) {
              Utils.showToast("No matching entities found", "error");
              return;
            }
            let chosen;
            if (filtered.length === 1) {
              chosen = filtered[0];
            } else {
              const options = filtered.map((e, i) => `${i + 1}. ${e.name} (${e.type})`).join("\n");
              const choice = prompt(`Multiple matches:
${options}

Enter number:`);
              const idx = parseInt(choice) - 1;
              if (isNaN(idx) || idx < 0 || idx >= filtered.length) return;
              chosen = filtered[idx];
            }
            if (chosen.canonical_id === entity.id) {
              Utils.showToast("Cannot set alias: would create circular reference", "error");
              return;
            }
            entity.canonical_id = chosen.id;
            await Storage.entities.save(entity.id, entity);
            Utils.showToast(`Set as alias of: ${chosen.name}`, "success");
            EntityBrowser.showDetail(container, entity.id, panel, identity);
          });
          container.querySelector("#nac-eb-goto-canonical")?.addEventListener("click", () => {
            const canonicalId = container.querySelector("#nac-eb-goto-canonical")?.dataset.entityId;
            if (canonicalId) EntityBrowser.showDetail(container, canonicalId, panel, identity);
          });
          container.querySelector("#nac-eb-remove-alias")?.addEventListener("click", async () => {
            entity.canonical_id = null;
            await Storage.entities.save(entity.id, entity);
            Utils.showToast("Alias link removed", "success");
            EntityBrowser.showDetail(container, entity.id, panel, identity);
          });
          container.querySelectorAll(".nac-eb-alias-entity-link").forEach((btn) => {
            btn.addEventListener("click", () => {
              const targetId = btn.dataset.entityId;
              if (targetId) EntityBrowser.showDetail(container, targetId, panel, identity);
            });
          });
          const nameEl = container.querySelector("#nac-eb-detail-name");
          const handleRename = () => {
            const currentName = entity.name;
            const newName = prompt("Rename entity:", currentName);
            if (newName && newName.trim() && newName.trim() !== currentName) {
              entity.name = newName.trim();
              Storage.entities.save(entity.id, entity).then(() => {
                nameEl.textContent = entity.name;
                Utils.showToast("Entity renamed", "success");
              });
            }
          };
          nameEl?.addEventListener("click", handleRename);
          nameEl?.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRename();
            }
          });
          container.querySelector("#nac-eb-add-alias")?.addEventListener("click", async () => {
            const input = container.querySelector("#nac-eb-alias-input");
            const alias = (input?.value || "").trim();
            if (!alias) return;
            if (!entity.aliases) entity.aliases = [];
            if (entity.aliases.includes(alias)) {
              Utils.showToast("Alias already exists", "error");
              return;
            }
            entity.aliases.push(alias);
            await Storage.entities.save(entity.id, entity);
            Utils.showToast("Alias added", "success");
            EntityBrowser.showDetail(container, entity.id, panel, identity);
          });
          container.querySelectorAll(".nac-eb-alias-remove").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              e.stopPropagation();
              const index = parseInt(btn.dataset.index);
              if (!entity.aliases || isNaN(index)) return;
              entity.aliases.splice(index, 1);
              await Storage.entities.save(entity.id, entity);
              Utils.showToast("Alias removed", "success");
              EntityBrowser.showDetail(container, entity.id, panel, identity);
            });
          });
          let nsecVisible = false;
          container.querySelector("#nac-eb-toggle-nsec")?.addEventListener("click", () => {
            const nsecEl = container.querySelector("#nac-eb-nsec-value");
            if (!nsecEl) return;
            nsecVisible = !nsecVisible;
            if (nsecVisible) {
              nsecEl.textContent = entity.keypair?.nsec || "N/A";
              nsecEl.classList.remove("nac-eb-nsec-hidden");
              container.querySelector("#nac-eb-toggle-nsec").textContent = "\u{1F648}";
            } else {
              nsecEl.textContent = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
              nsecEl.classList.add("nac-eb-nsec-hidden");
              container.querySelector("#nac-eb-toggle-nsec").textContent = "\u{1F441}";
            }
          });
          container.querySelectorAll(".nac-eb-copy-btn[data-copy]").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const text = btn.dataset.copy;
              if (!text) return;
              try {
                await navigator.clipboard.writeText(text);
                const orig = btn.textContent;
                btn.textContent = "\u2713";
                setTimeout(() => btn.textContent = orig, 1500);
              } catch {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                ta.remove();
                const orig = btn.textContent;
                btn.textContent = "\u2713";
                setTimeout(() => btn.textContent = orig, 1500);
              }
            });
          });
          container.querySelector("#nac-eb-copy-nsec")?.addEventListener("click", async () => {
            const nsec = entity.keypair?.nsec || "";
            if (!nsec) return;
            try {
              await navigator.clipboard.writeText(nsec);
              const btn = container.querySelector("#nac-eb-copy-nsec");
              btn.textContent = "\u2713";
              setTimeout(() => btn.textContent = "\u{1F4CB}", 1500);
            } catch {
              const ta = document.createElement("textarea");
              ta.value = nsec;
              ta.style.position = "fixed";
              ta.style.left = "-9999px";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              ta.remove();
              const btn = container.querySelector("#nac-eb-copy-nsec");
              btn.textContent = "\u2713";
              setTimeout(() => btn.textContent = "\u{1F4CB}", 1500);
            }
          });
          container.querySelector("#nac-eb-delete")?.addEventListener("click", async () => {
            if (!confirm(`Delete entity "${entity.name}"? This cannot be undone.`)) return;
            await Storage.entities.delete(entity.id);
            Utils.showToast("Entity deleted", "success");
            await EntityBrowser.init(panel, identity);
          });
        }
      };
    }
  });

  // src/platform-account.js
  var PlatformAccount;
  var init_platform_account = __esm({
    "src/platform-account.js"() {
      init_crypto();
      init_storage();
      PlatformAccount = {
        /**
         * Create or get a platform account
         * @param {string} username - Display name/handle
         * @param {string} platform - Platform identifier (e.g., 'nytimes.com', 'youtube', 'twitter')
         * @param {string|null} profileUrl - URL to user's profile if available
         * @param {string|null} avatarUrl - URL to user's avatar if available
         * @returns {object} Platform account object
         */
        getOrCreate: async (username, platform, profileUrl = null, avatarUrl = null) => {
          const accounts = await Storage.platformAccounts.getAll();
          const existingKey = Object.keys(accounts).find(
            (k) => accounts[k].username === username && accounts[k].platform === platform
          );
          if (existingKey) {
            accounts[existingKey].lastSeen = Date.now();
            if (profileUrl && !accounts[existingKey].profileUrl) accounts[existingKey].profileUrl = profileUrl;
            if (avatarUrl && !accounts[existingKey].avatarUrl) accounts[existingKey].avatarUrl = avatarUrl;
            await Storage.platformAccounts.save(accounts[existingKey]);
            return accounts[existingKey];
          }
          const privkey = Crypto.generatePrivateKey();
          const pubkey = Crypto.getPublicKey(privkey);
          const id = "pacct_" + await Crypto.sha256(platform + ":" + username);
          const account = {
            id,
            username,
            platform,
            profileUrl,
            avatarUrl,
            keypair: {
              pubkey,
              privkey,
              npub: Crypto.hexToNpub(pubkey),
              nsec: Crypto.hexToNsec(privkey)
            },
            linkedEntityId: null,
            // Can be linked to a Person entity later
            commentCount: 0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            metadata: {}
          };
          await Storage.platformAccounts.save(account);
          return account;
        },
        /**
         * Link a platform account to a Person entity
         */
        linkToEntity: async (accountId, entityId) => {
          const accounts = await Storage.platformAccounts.getAll();
          if (accounts[accountId]) {
            accounts[accountId].linkedEntityId = entityId;
            await Storage.platformAccounts.saveAll(accounts);
          }
        },
        /**
         * Get all accounts for a platform
         */
        getForPlatform: async (platform) => {
          const accounts = await Storage.platformAccounts.getAll();
          return Object.values(accounts).filter((a) => a.platform === platform);
        },
        /**
         * Get account by ID
         */
        get: async (accountId) => {
          const accounts = await Storage.platformAccounts.getAll();
          return accounts[accountId] || null;
        }
      };
    }
  });

  // src/comment-extractor.js
  function findCommentElements() {
    const selectors = [
      // Generic
      ".comment, .Comment",
      '[class*="comment-item"], [class*="commentItem"]',
      '[class*="comment-body"], [class*="commentBody"]',
      '[data-component="comment"]',
      // Disqus
      ".post-content .post",
      "#disqus_thread .post",
      // WordPress
      ".comment-list > li",
      ".wp-comment",
      // Medium/Substack
      ".response, .comment-content",
      // Generic article comments
      "#comments .comment, .comments-section .comment",
      '[role="comment"]',
      "article.comment"
    ];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) return Array.from(elements);
    }
    return [];
  }
  async function parseComment(el, articleUrl, platform) {
    const authorEl = el.querySelector(
      '[class*="author"], [class*="username"], [class*="user-name"], .comment-author, .commenter, [data-author]'
    );
    const authorName = authorEl?.textContent?.trim() || el.getAttribute("data-author") || "Anonymous";
    const textEl = el.querySelector(
      '[class*="comment-text"], [class*="comment-body"], [class*="commentText"], .comment-content, p'
    );
    const text = textEl?.textContent?.trim() || el.textContent?.trim() || "";
    if (!text || text.length < 2) return null;
    const timeEl = el.querySelector('time, [datetime], [class*="timestamp"], [class*="date"]');
    const timestamp = timeEl?.getAttribute("datetime") || timeEl?.textContent?.trim() || null;
    const avatarEl = el.querySelector('img[class*="avatar"], img[class*="profile"]');
    const avatarUrl = avatarEl?.src || null;
    const profileLink = authorEl?.closest("a") || el.querySelector('a[href*="/user/"], a[href*="/profile/"]');
    const profileUrl = profileLink?.href || null;
    const isReply = !!el.closest('[class*="reply"], [class*="child"], [class*="nested"]') || el.parentElement?.closest(".comment") !== null;
    const account = await PlatformAccount.getOrCreate(authorName, platform, profileUrl, avatarUrl);
    account.commentCount++;
    const commentId = "comment_" + await Crypto.sha256(articleUrl + authorName + text.substring(0, 100));
    return {
      id: commentId,
      text,
      authorName,
      authorAccountId: account.id,
      avatarUrl,
      platform,
      sourceUrl: articleUrl,
      timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
      replyTo: isReply ? "parent" : null,
      // simplified for now
      capturedAt: Date.now()
    };
  }
  var CommentExtractor;
  var init_comment_extractor = __esm({
    "src/comment-extractor.js"() {
      init_crypto();
      init_storage();
      init_platform_account();
      init_utils();
      CommentExtractor = {
        /**
         * Extract comments from the current page
         * @param {string} articleUrl - URL of the article these comments belong to
         * @param {string} platform - Platform identifier
         * @returns {Array} Array of comment objects
         */
        extractComments: async (articleUrl, platform) => {
          const commentElements = findCommentElements();
          const comments = [];
          for (const el of commentElements) {
            const comment = await parseComment(el, articleUrl, platform);
            if (comment) comments.push(comment);
          }
          return comments;
        },
        /**
         * Display captured comments in the reader view
         */
        renderCommentsSection: (container, comments, articleUrl) => {
          if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="nac-comments-empty">No comments captured yet. Click "Capture Comments" to extract comments from this page.</p>';
            return;
          }
          let html = `<div class="nac-comments-header">
            <span>\u{1F4AC} Captured Comments (${comments.length})</span>
        </div>`;
          html += '<div class="nac-comments-list">';
          for (const comment of comments) {
            html += `<div class="nac-comment-item" data-comment-id="${Utils.escapeHtml(comment.id)}">
                <div class="nac-comment-meta">
                    ${comment.avatarUrl ? `<img class="nac-comment-avatar" src="${Utils.escapeHtml(comment.avatarUrl)}" width="24" height="24" onerror="this.style.display='none'">` : ""}
                    <span class="nac-comment-author">${Utils.escapeHtml(comment.authorName)}</span>
                    <span class="nac-comment-platform">@${Utils.escapeHtml(comment.platform)}</span>
                    ${comment.timestamp ? `<span class="nac-comment-time">${new Date(comment.timestamp).toLocaleDateString()}</span>` : ""}
                </div>
                <div class="nac-comment-text">${Utils.escapeHtml(comment.text)}</div>
                ${comment.replyTo ? `<div class="nac-comment-reply-indicator">\u21A9 Reply</div>` : ""}
            </div>`;
          }
          html += "</div>";
          container.innerHTML = html;
        },
        /**
         * Save captured comments to storage
         */
        saveComments: async (comments) => {
          if (comments.length > 0) {
            await Storage.comments.saveMany(comments);
            Utils.showToast(`Captured ${comments.length} comments`, "success");
          }
        }
      };
    }
  });

  // src/reader-view.js
  var ReaderView;
  var init_reader_view = __esm({
    "src/reader-view.js"() {
      init_config();
      init_storage();
      init_utils();
      init_crypto();
      init_content_extractor();
      init_content_detector();
      init_entity_tagger();
      init_claim_extractor();
      init_entity_auto_suggest();
      init_relay_client();
      init_event_builder();
      init_entity_browser();
      init_comment_extractor();
      init_platform_account();
      ReaderView = {
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
          ReaderView._originalViewport = document.querySelector('meta[name="viewport"]');
          if (!ReaderView._originalViewport) {
            const meta = document.createElement("meta");
            meta.name = "viewport";
            meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
            document.head.appendChild(meta);
            ReaderView._injectedViewport = meta;
          }
          ReaderView._hiddenElements = [];
          Array.from(document.body.children).forEach((child) => {
            if (child.style.display !== "none") {
              ReaderView._hiddenElements.push({ el: child, prev: child.style.display });
              child.style.display = "none";
            }
          });
          ReaderView.container = document.createElement("div");
          ReaderView.container.id = "nac-reader-view";
          ReaderView.container.className = "nac-reader-container";
          ReaderView.container.setAttribute("tabindex", "-1");
          ReaderView.container.setAttribute("role", "dialog");
          ReaderView.container.setAttribute("aria-label", "Article reader view");
          ReaderView.container.innerHTML = `
      <div class="nac-reader-toolbar">
        <button class="nac-btn-back" id="nac-back-btn" aria-label="Close reader and return to page">\u2190 Back to Page</button>
        <div class="nac-toolbar-title">${article.domain || "Article"}</div>
        <div class="nac-toolbar-actions">
          <button class="nac-btn-toolbar" id="nac-preview-btn" title="Preview as Published" aria-label="Preview as published">\u{1F441} Preview</button>
          <button class="nac-btn-toolbar" id="nac-edit-btn" aria-label="Edit article">Edit</button>
          <button class="nac-btn-toolbar nac-btn-md-toggle" id="nac-md-toggle-btn" style="display:none;" title="Switch to Markdown editing" aria-label="Toggle markdown editor">\u{1F4DD} Markdown</button>
          <button class="nac-btn-toolbar" id="nac-claims-btn" title="Claims" aria-label="Toggle claims section">\u{1F4CB} <span id="nac-claims-badge" class="nac-claims-badge" style="display:none;">0</span></button>
          <button class="nac-btn-toolbar nac-btn-primary" id="nac-publish-btn" aria-label="Publish article to NOSTR">Publish</button>
          <button class="nac-btn-toolbar" id="nac-settings-btn" aria-label="Settings">\u2699</button>
        </div>
      </div>
      
      <div class="nac-reader-content">
        <div class="nac-reader-article">
          <div class="nac-article-header">
            <h1 class="nac-article-title" contenteditable="false" id="nac-title">${article.title || "Untitled"}</h1>
            <div class="nac-article-meta">
              <span class="nac-meta-author nac-editable-field" id="nac-author" data-field="byline" title="Click to edit author" role="button" tabindex="0" aria-label="Edit author \u2014 click to change">${Utils.escapeHtml(article.byline || "Unknown Author")}</span>
              <span class="nac-meta-separator">\u2022</span>
              <img class="nac-meta-icon" src="${Utils.escapeHtml(article.publicationIcon || "")}" onerror="this.style.display='none'" width="20" height="20" alt="">
              <span class="nac-meta-publication nac-editable-field" id="nac-publication" data-field="siteName" title="Click to edit publication" role="button" tabindex="0" aria-label="Edit publication \u2014 click to change">${Utils.escapeHtml(article.siteName || article.domain || "")}</span>
              <span class="nac-meta-separator">\u2022</span>
              <span class="nac-meta-date nac-editable-field" id="nac-date" data-field="publishedAt" title="Click to edit date" role="button" tabindex="0" aria-label="Edit date \u2014 click to change">${article.publishedAt ? ReaderView._formatDate(article.publishedAt) : "Unknown Date"}</span>
              ${article.isPaywalled ? '<span class="nac-meta-paywall" title="Paywalled content">\u{1F512}</span>' : ""}
            </div>
            <div class="nac-meta-detection-row">
              <span class="nac-meta-content-type">${ContentDetector.getPlatformIcon(article.platform)} ${ContentDetector.getTypeLabel(article.contentType)}</span>
              ${article.hasComments ? '<span class="nac-meta-comments-indicator" title="Comments detected on this page">\u{1F4AC} Comments</span>' : ""}
            </div>
            ${article.wordCount ? `
            <div class="nac-meta-stats">
              <span>${article.wordCount.toLocaleString()} words</span>
              <span class="nac-meta-separator">\xB7</span>
              <span>${article.readingTimeMinutes} min read</span>
              ${article.dateModified && article.dateModified !== (article.publishedAt ? new Date(article.publishedAt * 1e3).toISOString() : null) ? `
                <span class="nac-meta-separator">\xB7</span>
                <span class="nac-meta-modified" title="Last modified date">Modified: ${ReaderView._formatDateStr(article.dateModified)}</span>
              ` : ""}
              ${article.language && article.language !== "en" && !article.language.startsWith("en-") ? `
                <span class="nac-meta-separator">\xB7</span>
                <span class="nac-meta-lang" title="Content language">${article.language}</span>
              ` : ""}
            </div>` : ""}
            ${article.section ? `
            <div class="nac-meta-section-row">
              <span class="nac-meta-section-badge">${Utils.escapeHtml(article.section)}</span>
            </div>` : ""}
            ${article.keywords?.length ? `
            <div class="nac-meta-keywords">
              ${article.keywords.slice(0, 5).map((kw) => `<span class="nac-meta-keyword-pill">${Utils.escapeHtml(kw)}</span>`).join("")}
            </div>` : ""}
            <div class="nac-article-source">
              <span class="nac-source-label">Source:</span>
              <span class="nac-source-url nac-editable-field" id="nac-url" data-field="url" title="${Utils.escapeHtml(article.url)} \u2014 Click to edit URL" role="button" tabindex="0" aria-label="Edit article URL \u2014 click to change">${Utils.escapeHtml(article.url)}</span>
              <a class="nac-source-link" id="nac-url-link" href="${Utils.escapeHtml(article.url)}" target="_blank" rel="noopener" title="Open article URL in new tab" aria-label="Open URL in new tab">\u2197</a>
              <button class="nac-btn-copy" id="nac-copy-url" aria-label="Copy article URL">Copy</button>
            </div>
            <div class="nac-article-archived">
              Archived: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
            </div>
          </div>
          
          <div class="nac-article-body" id="nac-content" contenteditable="false">
            ${article.content || ""}
          </div>
        </div>
        
        <!-- Comments section (collapsible) -->
        <div class="nac-comments-section" id="nac-comments-section" style="display: none;">
          <div class="nac-comments-bar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="nac-comments-bar-title" style="font-size: 14px; font-weight: 600; color: var(--nac-text-muted);">\u{1F4AC} Comments (<span id="nac-comments-count">0</span>)</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="nac-btn-capture-comments" id="nac-capture-comments-btn" aria-label="Capture comments from this page">\u{1F4AC} Capture Comments</button>
              <button class="nac-comments-toggle" id="nac-comments-toggle-btn" aria-label="Toggle comments section">\u25BC</button>
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
            <span class="nac-claims-bar-title">\u{1F4CB} Claims (<span class="nac-claims-count">0</span>)</span>
            <div class="nac-claims-bar-actions">
              <button class="nac-btn-remote-claims" id="nac-remote-claims-btn" aria-label="View claims from other NOSTR users">\u{1F310} Others' Claims</button>
              <button class="nac-btn-add-claim" id="nac-add-claim-btn" aria-label="Add a claim by selecting text">+ Add Claim</button>
            </div>
          </div>
          <div class="nac-claims-chips" role="list" aria-label="Extracted claims list">
            <div class="nac-claims-empty">No claims extracted yet. Select text and click \u{1F4CB} Claim.</div>
          </div>
        </div>
      </div>
    `;
          document.body.appendChild(ReaderView.container);
          document.getElementById("nac-back-btn").addEventListener("click", ReaderView.hide);
          document.getElementById("nac-edit-btn").addEventListener("click", ReaderView.toggleEditMode);
          document.getElementById("nac-md-toggle-btn").addEventListener("click", ReaderView.toggleMarkdownMode);
          document.getElementById("nac-preview-btn").addEventListener("click", ReaderView.togglePreviewMode);
          document.getElementById("nac-publish-btn").addEventListener("click", ReaderView.showPublishPanel);
          document.getElementById("nac-settings-btn").addEventListener("click", ReaderView.showSettings);
          document.getElementById("nac-claims-btn").addEventListener("click", () => {
            const claimsBar = document.getElementById("nac-claims-bar");
            if (claimsBar) {
              const isHidden = claimsBar.style.display === "none";
              claimsBar.style.display = isHidden ? "" : "none";
              if (!isHidden) return;
              claimsBar.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          });
          document.getElementById("nac-copy-url").addEventListener("click", () => {
            navigator.clipboard.writeText(ReaderView.article.url);
            Utils.showToast("URL copied to clipboard");
          });
          document.getElementById("nac-add-claim-btn").addEventListener("click", () => {
            Utils.showToast("Select text in the article, then click \u{1F4CB} Claim in the popover", "info");
          });
          document.getElementById("nac-remote-claims-btn").addEventListener("click", () => {
            ClaimExtractor.showRemoteClaims();
          });
          document.getElementById("nac-add-entity-btn").addEventListener("click", (e) => {
            const name = prompt("Enter entity name to tag:");
            if (name && name.trim().length >= CONFIG.tagging.min_selection_length) {
              const rect = e.target.getBoundingClientRect();
              EntityTagger.show(name.trim(), rect.left + window.scrollX, rect.top + window.scrollY);
            }
          });
          if (article.hasComments) {
            const commentsSection = document.getElementById("nac-comments-section");
            if (commentsSection) commentsSection.style.display = "";
          }
          document.getElementById("nac-capture-comments-btn").addEventListener("click", async () => {
            const btn = document.getElementById("nac-capture-comments-btn");
            btn.disabled = true;
            btn.textContent = "\u23F3 Capturing...";
            try {
              const platform = ReaderView.article.platform || ReaderView.article.domain || "unknown";
              const comments = await CommentExtractor.extractComments(ReaderView.article.url, platform);
              if (comments.length > 0) {
                ReaderView.capturedComments = comments;
                await CommentExtractor.saveComments(comments);
                const commentsSection = document.getElementById("nac-comments-section");
                if (commentsSection) commentsSection.style.display = "";
                const container = document.getElementById("nac-comments-container");
                if (container) {
                  container.style.display = "";
                  CommentExtractor.renderCommentsSection(container, comments, ReaderView.article.url);
                }
                const countEl = document.getElementById("nac-comments-count");
                if (countEl) countEl.textContent = comments.length;
                ReaderView.commentsCollapsed = false;
                const toggleBtn = document.getElementById("nac-comments-toggle-btn");
                if (toggleBtn) toggleBtn.textContent = "\u25B2";
                btn.textContent = `\u2713 ${comments.length} captured`;
              } else {
                btn.textContent = "No comments found";
                Utils.showToast("No comments found on this page", "error");
              }
            } catch (e) {
              console.error("[NAC] Comment capture error:", e);
              btn.textContent = "\u{1F4AC} Capture Comments";
              Utils.showToast("Failed to capture comments: " + e.message, "error");
            }
            setTimeout(() => {
              btn.disabled = false;
              if (!ReaderView.capturedComments.length) btn.textContent = "\u{1F4AC} Capture Comments";
            }, 3e3);
          });
          document.getElementById("nac-comments-toggle-btn").addEventListener("click", () => {
            const container = document.getElementById("nac-comments-container");
            const toggleBtn = document.getElementById("nac-comments-toggle-btn");
            if (!container) return;
            ReaderView.commentsCollapsed = !ReaderView.commentsCollapsed;
            container.style.display = ReaderView.commentsCollapsed ? "none" : "";
            toggleBtn.textContent = ReaderView.commentsCollapsed ? "\u25BC" : "\u25B2";
          });
          try {
            const existingComments = await Storage.comments.getForUrl(article.url);
            if (existingComments.length > 0) {
              ReaderView.capturedComments = existingComments;
              const commentsSection = document.getElementById("nac-comments-section");
              if (commentsSection) commentsSection.style.display = "";
              const countEl = document.getElementById("nac-comments-count");
              if (countEl) countEl.textContent = existingComments.length;
              const container = document.getElementById("nac-comments-container");
              if (container) {
                CommentExtractor.renderCommentsSection(container, existingComments, article.url);
              }
              const captureBtn = document.getElementById("nac-capture-comments-btn");
              if (captureBtn) captureBtn.textContent = `\u{1F4AC} Re-capture (${existingComments.length})`;
            }
          } catch (e) {
            console.error("[NAC] Failed to load existing comments:", e);
          }
          document.querySelectorAll("#nac-reader-view .nac-editable-field").forEach((el) => {
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              ReaderView._startInlineEdit(el, el.dataset.field);
            });
            el.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                ReaderView._startInlineEdit(el, el.dataset.field);
              }
            });
          });
          const contentEl = document.getElementById("nac-content");
          contentEl.addEventListener("mouseup", ReaderView.handleTextSelection);
          contentEl.addEventListener("touchend", ReaderView.handleTextSelection);
          document.addEventListener("keydown", ReaderView.handleKeyboard);
          ReaderView.container.focus();
          if (article.byline && article.byline.trim().length >= CONFIG.tagging.min_selection_length) {
            try {
              const authorName = article.byline.trim();
              const authorResults = await Storage.entities.search(authorName, "person");
              if (authorResults.length > 0) {
                const entity = authorResults[0];
                if (!entity.articles) entity.articles = [];
                const authorArticleEntry = {
                  url: article.url,
                  title: article.title,
                  context: "author",
                  tagged_at: Math.floor(Date.now() / 1e3)
                };
                const existingAuthorIdx = entity.articles.findIndex((a) => a.url === authorArticleEntry.url);
                if (existingAuthorIdx >= 0) {
                  entity.articles[existingAuthorIdx].tagged_at = authorArticleEntry.tagged_at;
                } else {
                  entity.articles.push(authorArticleEntry);
                }
                await Storage.entities.save(entity.id, entity);
                ReaderView.entities.push({ entity_id: entity.id, context: "author" });
                EntityTagger.addChip(entity);
              } else {
                const privkey = Crypto.generatePrivateKey();
                const pubkey = Crypto.getPublicKey(privkey);
                const entityId = "entity_" + await Crypto.sha256("person" + authorName);
                const userIdentity = await Storage.identity.get();
                const entity = await Storage.entities.save(entityId, {
                  id: entityId,
                  type: "person",
                  name: authorName,
                  aliases: [],
                  canonical_id: null,
                  keypair: {
                    pubkey,
                    privkey,
                    npub: Crypto.hexToNpub(pubkey),
                    nsec: Crypto.hexToNsec(privkey)
                  },
                  created_by: userIdentity?.pubkey || "unknown",
                  created_at: Math.floor(Date.now() / 1e3),
                  articles: [{
                    url: article.url,
                    title: article.title,
                    context: "author",
                    tagged_at: Math.floor(Date.now() / 1e3)
                  }],
                  metadata: {}
                });
                ReaderView.entities.push({ entity_id: entityId, context: "author" });
                EntityTagger.addChip(entity);
              }
            } catch (e) {
              Utils.error("Failed to auto-tag author:", e);
            }
          }
          const publicationName = (article.siteName || article.domain || "").trim();
          if (publicationName.length >= CONFIG.tagging.min_selection_length) {
            try {
              const pubResults = await Storage.entities.search(publicationName, "organization");
              if (pubResults.length > 0) {
                const entity = pubResults[0];
                if (!entity.articles) entity.articles = [];
                const pubArticleEntry = {
                  url: article.url,
                  title: article.title,
                  context: "publication",
                  tagged_at: Math.floor(Date.now() / 1e3)
                };
                const existingPubIdx = entity.articles.findIndex((a) => a.url === pubArticleEntry.url);
                if (existingPubIdx >= 0) {
                  entity.articles[existingPubIdx].tagged_at = pubArticleEntry.tagged_at;
                } else {
                  entity.articles.push(pubArticleEntry);
                }
                await Storage.entities.save(entity.id, entity);
                ReaderView.entities.push({ entity_id: entity.id, context: "publication" });
                EntityTagger.addChip(entity);
              } else {
                const privkey = Crypto.generatePrivateKey();
                const pubkey = Crypto.getPublicKey(privkey);
                const entityId = "entity_" + await Crypto.sha256("organization" + publicationName);
                const userIdentity = await Storage.identity.get();
                const entity = await Storage.entities.save(entityId, {
                  id: entityId,
                  type: "organization",
                  name: publicationName,
                  aliases: [],
                  canonical_id: null,
                  keypair: {
                    pubkey,
                    privkey,
                    npub: Crypto.hexToNpub(pubkey),
                    nsec: Crypto.hexToNsec(privkey)
                  },
                  created_by: userIdentity?.pubkey || "unknown",
                  created_at: Math.floor(Date.now() / 1e3),
                  articles: [{
                    url: article.url,
                    title: article.title,
                    context: "publication",
                    tagged_at: Math.floor(Date.now() / 1e3)
                  }],
                  metadata: {}
                });
                ReaderView.entities.push({ entity_id: entityId, context: "publication" });
                EntityTagger.addChip(entity);
              }
            } catch (e) {
              Utils.error("Failed to auto-tag publication:", e);
            }
          }
          if (typeof requestIdleCallback === "function") {
            requestIdleCallback(() => EntityAutoSuggest.scan(article), { timeout: 2e3 });
          } else {
            setTimeout(() => EntityAutoSuggest.scan(article), 500);
          }
          await ClaimExtractor.loadForArticle(article.url);
        },
        // Format a Unix timestamp as a readable date string
        _formatDate: (timestamp) => {
          const date = new Date(timestamp * 1e3);
          return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        },
        // Format an ISO date string as a readable date
        _formatDateStr: (dateStr) => {
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          } catch (e) {
            return dateStr;
          }
        },
        // Start inline editing of a metadata field
        _startInlineEdit: (element, fieldKey) => {
          if (element.querySelector("input")) return;
          const originalText = element.textContent.trim();
          const isDate = fieldKey === "publishedAt";
          const input = document.createElement("input");
          input.className = "nac-inline-edit-input";
          if (isDate) {
            input.type = "date";
            const ts = ReaderView.article.publishedAt;
            if (ts) {
              const d = new Date(ts * 1e3);
              input.value = d.toISOString().split("T")[0];
            }
          } else if (fieldKey === "url") {
            input.type = "text";
            input.value = ReaderView.article.url || "";
            input.style.fontFamily = "monospace";
            input.style.fontSize = "12px";
          } else {
            input.type = "text";
            input.value = fieldKey === "byline" ? ReaderView.article.byline || "" : ReaderView.article.siteName || ReaderView.article.domain || "";
          }
          element.textContent = "";
          element.appendChild(input);
          input.focus();
          if (input.type === "text") input.select();
          let saved = false;
          const cleanup = () => {
            input.removeEventListener("blur", onBlur);
            input.removeEventListener("keydown", onKeydown);
            if (isDate) input.removeEventListener("change", onChange);
          };
          const save = () => {
            if (saved) return;
            saved = true;
            const newValue = input.value.trim();
            cleanup();
            if (isDate) {
              if (newValue) {
                const newTs = Math.floor((/* @__PURE__ */ new Date(newValue + "T12:00:00")).getTime() / 1e3);
                ReaderView.article.publishedAt = newTs;
                element.textContent = ReaderView._formatDate(newTs);
              } else {
                element.textContent = originalText;
              }
            } else if (fieldKey === "url") {
              if (newValue) {
                const cleanedUrl = ContentExtractor.normalizeUrl(newValue);
                ReaderView.article.url = cleanedUrl;
                ReaderView.article.domain = ContentExtractor.getDomain(cleanedUrl);
                element.textContent = cleanedUrl;
                element.title = cleanedUrl + " \u2014 Click to edit URL";
                const linkEl = document.getElementById("nac-url-link");
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
            if (e.key === "Enter") {
              e.preventDefault();
              input.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          };
          const onChange = () => {
            if (isDate) input.blur();
          };
          input.addEventListener("blur", onBlur);
          input.addEventListener("keydown", onKeydown);
          if (isDate) input.addEventListener("change", onChange);
        },
        // Hide reader view and restore original page
        hide: () => {
          ReaderView.markdownMode = false;
          ReaderView.previewMode = false;
          ReaderView.claims = [];
          ReaderView.capturedComments = [];
          ReaderView.commentsCollapsed = true;
          ReaderView._originalContentHtml = null;
          ReaderView._remoteClaimsCache = null;
          if (ReaderView._injectedViewport) {
            ReaderView._injectedViewport.remove();
            ReaderView._injectedViewport = null;
          }
          if (ReaderView.container) {
            ReaderView.container.remove();
            ReaderView.container = null;
          }
          ReaderView._hiddenElements.forEach(({ el, prev }) => {
            el.style.display = prev;
          });
          ReaderView._hiddenElements = [];
          document.removeEventListener("keydown", ReaderView.handleKeyboard);
          EntityAutoSuggest.destroy();
          RelayClient.disconnectAll();
          if (_state.nacFabRef) _state.nacFabRef.focus();
        },
        // Toggle edit mode
        toggleEditMode: () => {
          if (ReaderView.previewMode) {
            ReaderView.togglePreviewMode();
          }
          if (ReaderView.editMode && ReaderView.markdownMode) {
            ReaderView._exitMarkdownMode();
          }
          ReaderView.editMode = !ReaderView.editMode;
          const titleEl = document.getElementById("nac-title");
          const contentEl = document.getElementById("nac-content");
          const editBtn = document.getElementById("nac-edit-btn");
          const mdToggleBtn = document.getElementById("nac-md-toggle-btn");
          const previewBtn = document.getElementById("nac-preview-btn");
          if (ReaderView.editMode) {
            titleEl.contentEditable = "true";
            contentEl.contentEditable = "true";
            editBtn.textContent = "Done";
            editBtn.classList.add("active");
            mdToggleBtn.style.display = "";
            previewBtn.style.display = "none";
          } else {
            titleEl.contentEditable = "false";
            contentEl.contentEditable = "false";
            editBtn.textContent = "Edit";
            editBtn.classList.remove("active");
            mdToggleBtn.style.display = "none";
            previewBtn.style.display = "";
            ReaderView.markdownMode = false;
            mdToggleBtn.textContent = "\u{1F4DD} Markdown";
            mdToggleBtn.title = "Switch to Markdown editing";
            ReaderView.article.title = titleEl.textContent;
            ReaderView.article.content = contentEl.innerHTML;
          }
        },
        // Toggle between visual and markdown editing modes
        toggleMarkdownMode: () => {
          if (!ReaderView.editMode) return;
          const contentEl = document.getElementById("nac-content");
          const mdToggleBtn = document.getElementById("nac-md-toggle-btn");
          if (!ReaderView.markdownMode) {
            ReaderView.markdownMode = true;
            mdToggleBtn.textContent = "\u{1F441} Visual";
            mdToggleBtn.title = "Switch to Visual editing";
            mdToggleBtn.classList.add("active");
            const markdown = ContentExtractor.htmlToMarkdown(contentEl.innerHTML);
            contentEl.contentEditable = "false";
            contentEl.style.display = "none";
            const textarea = document.createElement("textarea");
            textarea.id = "nac-md-textarea";
            textarea.className = "nac-md-textarea";
            textarea.value = markdown;
            textarea.spellcheck = false;
            const autoResize = () => {
              textarea.style.height = "auto";
              textarea.style.height = textarea.scrollHeight + "px";
            };
            textarea.addEventListener("input", autoResize);
            contentEl.parentNode.insertBefore(textarea, contentEl.nextSibling);
            requestAnimationFrame(autoResize);
          } else {
            ReaderView._exitMarkdownMode();
          }
        },
        // Internal: exit markdown mode and restore visual editing
        _exitMarkdownMode: () => {
          const contentEl = document.getElementById("nac-content");
          const textarea = document.getElementById("nac-md-textarea");
          const mdToggleBtn = document.getElementById("nac-md-toggle-btn");
          if (textarea) {
            const html = ContentExtractor.markdownToHtml(textarea.value);
            contentEl.innerHTML = html;
            textarea.remove();
          }
          contentEl.style.display = "";
          if (ReaderView.editMode) {
            contentEl.contentEditable = "true";
          }
          ReaderView.markdownMode = false;
          if (mdToggleBtn) {
            mdToggleBtn.textContent = "\u{1F4DD} Markdown";
            mdToggleBtn.title = "Switch to Markdown editing";
            mdToggleBtn.classList.remove("active");
          }
        },
        // Toggle "Preview as Published" mode (available outside edit mode)
        togglePreviewMode: () => {
          if (ReaderView.editMode) return;
          const contentEl = document.getElementById("nac-content");
          const previewBtn = document.getElementById("nac-preview-btn");
          if (!ReaderView.previewMode) {
            ReaderView.previewMode = true;
            ReaderView._originalContentHtml = contentEl.innerHTML;
            const markdown = ContentExtractor.htmlToMarkdown(contentEl.innerHTML);
            const renderedHtml = ContentExtractor.markdownToHtml(markdown);
            contentEl.innerHTML = renderedHtml;
            previewBtn.textContent = "\u21A9 Original";
            previewBtn.title = "Back to Original view";
            previewBtn.classList.add("active");
            Utils.showToast("Showing preview as published markdown", "success");
          } else {
            ReaderView.previewMode = false;
            contentEl.innerHTML = ReaderView._originalContentHtml;
            ReaderView._originalContentHtml = null;
            previewBtn.textContent = "\u{1F441} Preview";
            previewBtn.title = "Preview as Published";
            previewBtn.classList.remove("active");
          }
        },
        // Handle text selection for entity tagging
        handleTextSelection: (e) => {
          if (ReaderView.editMode) return;
          setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (text.length >= CONFIG.tagging.min_selection_length && text.length <= CONFIG.tagging.max_selection_length) {
              EntityTagger.show(text, e.pageX, e.pageY);
            } else {
              EntityTagger.hide();
            }
          }, CONFIG.tagging.selection_debounce_ms);
        },
        // Handle keyboard shortcuts
        handleKeyboard: (e) => {
          if (e.key === "Escape") {
            if (EntityTagger.popover) {
              EntityTagger.hide();
            } else if (document.getElementById("nac-settings-panel")) {
              ReaderView.hideSettings();
            } else if (document.getElementById("nac-publish-panel")) {
              ReaderView.hidePublishPanel();
            } else {
              ReaderView.hide();
            }
          } else if (e.key === "Tab" && ReaderView.container) {
            ReaderView._trapFocus(e);
          } else if (e.ctrlKey && e.key === "e") {
            e.preventDefault();
            ReaderView.toggleEditMode();
          }
        },
        // Focus trap implementation for reader view
        _trapFocus: (e) => {
          const container = ReaderView.container;
          if (!container) return;
          const focusableSelectors = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
          const focusableElements = Array.from(container.querySelectorAll(focusableSelectors)).filter((el) => {
            return el.offsetParent !== null && !el.closest('[style*="display: none"], [style*="display:none"]');
          });
          if (focusableElements.length === 0) return;
          const firstEl = focusableElements[0];
          const lastEl = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstEl || !container.contains(document.activeElement)) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl || !container.contains(document.activeElement)) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        },
        // Show publish panel
        showPublishPanel: async () => {
          if (ReaderView.markdownMode) {
            const textarea = document.getElementById("nac-md-textarea");
            if (textarea) {
              const html = ContentExtractor.markdownToHtml(textarea.value);
              ReaderView.article.content = html;
            }
          } else if (ReaderView.editMode) {
            const contentEl = document.getElementById("nac-content");
            if (contentEl) {
              ReaderView.article.content = contentEl.innerHTML;
            }
          }
          ReaderView._publishOpener = document.activeElement;
          const panel = document.createElement("div");
          panel.id = "nac-publish-panel";
          panel.className = "nac-publish-panel";
          panel.setAttribute("tabindex", "-1");
          panel.setAttribute("role", "dialog");
          panel.setAttribute("aria-label", "Publish to NOSTR");
          const identity = await Storage.identity.get();
          const relayConfig = await Storage.relays.get();
          panel.innerHTML = `
      <div class="nac-publish-header">
        <h3>Publish to NOSTR</h3>
        <button class="nac-btn-close" id="nac-close-publish" aria-label="Close publish panel">\xD7</button>
      </div>
      
      <div class="nac-publish-body">
        <div class="nac-form-group">
          <label>Signing Method</label>
          <select id="nac-signing-method" class="nac-form-select">
            <option value="nip07">NIP-07 Extension</option>
            <option value="local">Local Keypair</option>
          </select>
        </div>
        
        ${!identity ? '<div class="nac-warning">No identity configured. Please set up signing in settings.</div>' : ""}
        
        <div class="nac-publish-info" id="nac-publish-info"></div>
        
        <div class="nac-form-group">
          <label>Relays</label>
          <div class="nac-relay-list">
            ${relayConfig.relays.filter((r) => r.enabled).map((r) => `
              <label class="nac-checkbox">
                <input type="checkbox" checked value="${r.url}">
                <span>${r.url}</span>
              </label>
            `).join("")}
          </div>
        </div>
        
        <div class="nac-form-group">
          <label>Event Preview</label>
          <pre class="nac-event-preview" id="nac-event-preview">Building event...</pre>
        </div>
        
        <button class="nac-btn nac-btn-primary" id="nac-publish-confirm" ${!identity ? "disabled" : ""}>
          Publish Article
        </button>
        
        <div id="nac-publish-status" class="nac-publish-status"></div>
      </div>
    `;
          ReaderView.container.appendChild(panel);
          const event = await EventBuilder.buildArticleEvent(
            ReaderView.article,
            ReaderView.entities,
            identity?.pubkey,
            ReaderView.claims
          );
          const eventJson = JSON.stringify(event, null, 2);
          const eventSizeKB = (new TextEncoder().encode(JSON.stringify(event)).length / 1024).toFixed(1);
          const sizeWarning = eventSizeKB > 64 ? ` \u26A0\uFE0F Large event (${eventSizeKB} KB) \u2014 some relays may reject` : "";
          document.getElementById("nac-event-preview").textContent = `[Event size: ${eventSizeKB} KB${sizeWarning}]

${eventJson}`;
          const claimCount = (ReaderView.claims || []).length;
          const cruxCount = (ReaderView.claims || []).filter((c) => c.is_crux).length;
          let evidenceLinkCount = 0;
          try {
            const claimIds = (ReaderView.claims || []).map((c) => c.id);
            const allLinks = await Storage.evidenceLinks.getAll();
            const articleLinks = Object.values(allLinks).filter(
              (l) => claimIds.includes(l.source_claim_id) || claimIds.includes(l.target_claim_id)
            );
            evidenceLinkCount = articleLinks.length;
          } catch (e) {
          }
          const infoEl = document.getElementById("nac-publish-info");
          if (infoEl) {
            const commentCount = (ReaderView.capturedComments || []).length;
            const commentMsg = commentCount > 0 ? ` + ${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "";
            if (claimCount > 0) {
              const linkMsg = evidenceLinkCount > 0 ? ` + ${evidenceLinkCount} evidence link${evidenceLinkCount !== 1 ? "s" : ""}` : "";
              infoEl.innerHTML = `\u{1F4CB} Article + ${claimCount} claim${claimCount !== 1 ? "s" : ""} (${cruxCount} crux${cruxCount !== 1 ? "es" : ""})${linkMsg}${commentMsg} will be published`;
            } else {
              infoEl.innerHTML = `\u{1F4CB} Article will be published${commentMsg}${commentCount === 0 ? " (no claims)" : ""}`;
            }
          }
          document.getElementById("nac-close-publish").addEventListener("click", ReaderView.hidePublishPanel);
          document.getElementById("nac-publish-confirm").addEventListener("click", ReaderView.publishArticle);
          panel.focus();
        },
        // Hide publish panel
        hidePublishPanel: () => {
          const panel = document.getElementById("nac-publish-panel");
          if (panel) panel.remove();
          if (ReaderView._publishOpener && ReaderView._publishOpener.focus) {
            ReaderView._publishOpener.focus();
            ReaderView._publishOpener = null;
          }
        },
        // Publish article to NOSTR
        publishArticle: async () => {
          const statusEl = document.getElementById("nac-publish-status");
          const btn = document.getElementById("nac-publish-confirm");
          btn.disabled = true;
          btn.textContent = "Publishing...";
          statusEl.innerHTML = '<div class="nac-spinner"></div> Publishing to relays...';
          try {
            const identity = await Storage.identity.get();
            const signingMethod = document.getElementById("nac-signing-method").value;
            const event = await EventBuilder.buildArticleEvent(
              ReaderView.article,
              ReaderView.entities,
              identity.pubkey,
              ReaderView.claims
            );
            let signedEvent;
            if (signingMethod === "nip07") {
              if (!unsafeWindow.nostr) {
                throw new Error("NIP-07 extension not found");
              }
              signedEvent = await unsafeWindow.nostr.signEvent(event);
            } else {
              if (!identity.privkey) {
                throw new Error("No private key available");
              }
              signedEvent = await Crypto.signEvent(event, identity.privkey);
            }
            if (!signedEvent) {
              throw new Error("Event signing failed \u2014 no signed event returned. Check your private key or NIP-07 extension.");
            }
            if (signingMethod === "local") {
              const selfVerify = await Crypto.verifySignature(signedEvent);
              if (!selfVerify) {
                throw new Error("Self-verification failed \u2014 signature did not pass BIP-340 verification. This is a signing bug.");
              }
            }
            const eventJson = JSON.stringify(signedEvent);
            const eventSizeKB = new TextEncoder().encode(eventJson).length / 1024;
            if (eventSizeKB > 512) {
              throw new Error(`Event too large (${eventSizeKB.toFixed(0)} KB). Most relays reject events over 64-512 KB. Try removing images or shortening the article.`);
            } else if (eventSizeKB > 64) {
              console.warn(`[NAC] Event is ${eventSizeKB.toFixed(0)} KB \u2014 some relays may reject events this large.`);
            }
            const relayCheckboxes = document.querySelectorAll('.nac-relay-list input[type="checkbox"]:checked');
            const relayUrls = Array.from(relayCheckboxes).map((cb) => cb.value);
            const results = await RelayClient.publish(signedEvent, relayUrls);
            let successCount = 0;
            let html = '<div class="nac-publish-results"><strong>Article:</strong>';
            for (const [url, result] of Object.entries(results)) {
              if (result.success) {
                successCount++;
                html += `<div class="nac-result-success">\u2713 ${url}</div>`;
              } else {
                html += `<div class="nac-result-error">\u2717 ${url}: ${result.error}</div>`;
              }
            }
            html += "</div>";
            const entityRegistry = await Storage.entities.getAll();
            const claims = ReaderView.claims || [];
            let claimSuccessCount = 0;
            if (claims.length > 0) {
              statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${claims.length} claim${claims.length !== 1 ? "s" : ""}...`;
              for (let i = 0; i < claims.length; i++) {
                const claim = claims[i];
                try {
                  const claimEvent = EventBuilder.buildClaimEvent(
                    claim,
                    ReaderView.article.url,
                    ReaderView.article.title || "Untitled",
                    identity.pubkey,
                    entityRegistry
                  );
                  let signedClaim;
                  if (signingMethod === "nip07") {
                    signedClaim = await unsafeWindow.nostr.signEvent(claimEvent);
                  } else {
                    signedClaim = await Crypto.signEvent(claimEvent, identity.privkey);
                  }
                  if (signedClaim) {
                    const claimResults = await RelayClient.publish(signedClaim, relayUrls);
                    const claimOk = Object.values(claimResults).some((r) => r.success);
                    if (claimOk) claimSuccessCount++;
                  }
                } catch (ce) {
                  console.error(`[NAC] Claim publish error (${claim.id}):`, ce);
                }
              }
              html += `<div class="nac-publish-results"><strong>Claims:</strong> ${claimSuccessCount}/${claims.length} published</div>`;
            }
            const claimIds = claims.map((c) => c.id);
            let evidenceLinkSuccessCount = 0;
            let evidenceLinksTotal = 0;
            try {
              const allLinks = await Storage.evidenceLinks.getAll();
              const allClaims = await Storage.claims.getAll();
              const articleLinks = Object.values(allLinks).filter(
                (l) => claimIds.includes(l.source_claim_id) || claimIds.includes(l.target_claim_id)
              );
              evidenceLinksTotal = articleLinks.length;
              if (articleLinks.length > 0) {
                statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${articleLinks.length} evidence link${articleLinks.length !== 1 ? "s" : ""}...`;
                for (const link of articleLinks) {
                  try {
                    const linkEvent = await EventBuilder.buildEvidenceLinkEvent(link, allClaims, identity.pubkey);
                    let signedLink;
                    if (signingMethod === "nip07") {
                      signedLink = await unsafeWindow.nostr.signEvent(linkEvent);
                    } else {
                      signedLink = await Crypto.signEvent(linkEvent, identity.privkey);
                    }
                    if (signedLink) {
                      const linkResults = await RelayClient.publish(signedLink, relayUrls);
                      const linkOk = Object.values(linkResults).some((r) => r.success);
                      if (linkOk) evidenceLinkSuccessCount++;
                    }
                  } catch (le) {
                    console.error(`[NAC] Evidence link publish error (${link.id}):`, le);
                  }
                }
                html += `<div class="nac-publish-results"><strong>Evidence Links:</strong> ${evidenceLinkSuccessCount}/${articleLinks.length} published</div>`;
              }
            } catch (e) {
              console.error("[NAC] Evidence links publish error:", e);
            }
            let entityRelSuccessCount = 0;
            let entityRelTotal = 0;
            try {
              const relEvents = [];
              const articleUrl = ReaderView.article.url;
              for (const ref of ReaderView.entities || []) {
                const entity = entityRegistry[ref.entity_id];
                if (entity && entity.keypair) {
                  relEvents.push(EventBuilder.buildEntityRelationshipEvent(entity, articleUrl, ref.context || "mentioned", identity.pubkey, null));
                }
              }
              for (const claim of claims) {
                if (claim.claimant_entity_id) {
                  const claimant = entityRegistry[claim.claimant_entity_id];
                  if (claimant && claimant.keypair) {
                    relEvents.push(EventBuilder.buildEntityRelationshipEvent(claimant, articleUrl, "claimant", identity.pubkey, claim.id));
                  }
                }
                for (const sid of claim.subject_entity_ids || []) {
                  const subject = entityRegistry[sid];
                  if (subject && subject.keypair) {
                    relEvents.push(EventBuilder.buildEntityRelationshipEvent(subject, articleUrl, "subject", identity.pubkey, claim.id));
                  }
                }
                for (const oid of claim.object_entity_ids || []) {
                  const obj = entityRegistry[oid];
                  if (obj && obj.keypair) {
                    relEvents.push(EventBuilder.buildEntityRelationshipEvent(obj, articleUrl, "object", identity.pubkey, claim.id));
                  }
                }
              }
              entityRelTotal = relEvents.length;
              if (relEvents.length > 0) {
                statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${relEvents.length} entity relationship${relEvents.length !== 1 ? "s" : ""}...`;
                for (const relEvent of relEvents) {
                  try {
                    let signedRel;
                    if (signingMethod === "nip07") {
                      signedRel = await unsafeWindow.nostr.signEvent(relEvent);
                    } else {
                      signedRel = await Crypto.signEvent(relEvent, identity.privkey);
                    }
                    if (signedRel) {
                      const relResults = await RelayClient.publish(signedRel, relayUrls);
                      const relOk = Object.values(relResults).some((r) => r.success);
                      if (relOk) entityRelSuccessCount++;
                    }
                  } catch (re) {
                    console.error("[NAC] Entity relationship publish error:", re);
                  }
                }
                html += `<div class="nac-publish-results"><strong>Entity Relationships:</strong> ${entityRelSuccessCount}/${relEvents.length} published</div>`;
              }
            } catch (e) {
              console.error("[NAC] Entity relationships publish error:", e);
            }
            const capturedComments = ReaderView.capturedComments || [];
            let commentSuccessCount = 0;
            let platformAccountSuccessCount = 0;
            const publishedAccountIds = /* @__PURE__ */ new Set();
            if (capturedComments.length > 0) {
              try {
                statusEl.innerHTML = html + `<div class="nac-spinner"></div> Publishing ${capturedComments.length} comment${capturedComments.length !== 1 ? "s" : ""}...`;
                for (const comment of capturedComments) {
                  try {
                    const account = await PlatformAccount.get(comment.authorAccountId);
                    const accountPubkey = account?.keypair?.pubkey || null;
                    if (account && !publishedAccountIds.has(account.id)) {
                      try {
                        const acctEvent = EventBuilder.buildPlatformAccountEvent(account, identity.pubkey);
                        let signedAcct;
                        if (signingMethod === "nip07") {
                          signedAcct = await unsafeWindow.nostr.signEvent(acctEvent);
                        } else {
                          signedAcct = await Crypto.signEvent(acctEvent, identity.privkey);
                        }
                        if (signedAcct) {
                          const acctResults = await RelayClient.publish(signedAcct, relayUrls);
                          const acctOk = Object.values(acctResults).some((r) => r.success);
                          if (acctOk) platformAccountSuccessCount++;
                          publishedAccountIds.add(account.id);
                        }
                      } catch (ae) {
                        console.error(`[NAC] Platform account publish error (${account.id}):`, ae);
                      }
                    }
                    const commentEvent = EventBuilder.buildCommentEvent(
                      comment,
                      ReaderView.article.url,
                      ReaderView.article.title || "Untitled",
                      identity.pubkey,
                      accountPubkey
                    );
                    let signedComment;
                    if (signingMethod === "nip07") {
                      signedComment = await unsafeWindow.nostr.signEvent(commentEvent);
                    } else {
                      signedComment = await Crypto.signEvent(commentEvent, identity.privkey);
                    }
                    if (signedComment) {
                      const commentResults = await RelayClient.publish(signedComment, relayUrls);
                      const commentOk = Object.values(commentResults).some((r) => r.success);
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
                console.error("[NAC] Comments publish error:", e);
              }
            }
            statusEl.innerHTML = html;
            if (successCount > 0) {
              const claimMsg = claims.length > 0 ? ` ${claimSuccessCount} claim${claimSuccessCount !== 1 ? "s" : ""} published.` : "";
              const linkMsg = evidenceLinksTotal > 0 ? ` ${evidenceLinkSuccessCount} evidence link${evidenceLinkSuccessCount !== 1 ? "s" : ""} published.` : "";
              const relMsg = entityRelTotal > 0 ? ` ${entityRelSuccessCount} entity relationship${entityRelSuccessCount !== 1 ? "s" : ""} published.` : "";
              const commentMsg = capturedComments.length > 0 ? ` ${commentSuccessCount} comment${commentSuccessCount !== 1 ? "s" : ""} published.` : "";
              btn.textContent = `Published to ${successCount} relay${successCount > 1 ? "s" : ""}`;
              Utils.showToast(`Article published to ${successCount} relay${successCount > 1 ? "s" : ""}.${claimMsg}${linkMsg}${relMsg}${commentMsg}`, "success");
            } else {
              btn.textContent = "Publish Failed";
              btn.disabled = false;
              Utils.showToast("Failed to publish to any relay", "error");
            }
          } catch (e) {
            console.error("[NAC] Publish error:", e);
            statusEl.innerHTML = `<div class="nac-error">Error: ${e.message}</div>`;
            btn.textContent = "Publish Failed";
            btn.disabled = false;
            Utils.showToast("Failed to publish article", "error");
          }
        },
        // Hide settings panel
        hideSettings: () => {
          const panel = document.getElementById("nac-settings-panel");
          if (panel) panel.remove();
          if (ReaderView._settingsOpener && ReaderView._settingsOpener.focus) {
            ReaderView._settingsOpener.focus();
            ReaderView._settingsOpener = null;
          }
        },
        // Show settings panel
        showSettings: async () => {
          document.getElementById("nac-settings-panel")?.remove();
          ReaderView._settingsOpener = document.activeElement;
          const identity = await Storage.identity.get();
          const relayConfig = await Storage.relays.get();
          const panel = document.createElement("div");
          panel.id = "nac-settings-panel";
          panel.className = "nac-settings-panel";
          panel.setAttribute("tabindex", "-1");
          panel.setAttribute("role", "dialog");
          panel.setAttribute("aria-label", "Settings");
          panel.innerHTML = `
      <div class="nac-publish-header">
        <h3>Settings</h3>
        <button class="nac-btn-close" id="nac-close-settings" aria-label="Close settings">\xD7</button>
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
              <button id="nac-show-nsec" style="padding: 4px 8px; background: #333; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 4px;">\u{1F441} Show nsec</button>
              <button id="nac-copy-nsec" style="padding: 4px 8px; background: #333; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">\u{1F4CB} Copy nsec</button>
              <div id="nac-nsec-display" style="display: none; margin-top: 6px; padding: 6px; background: #1a1a2e; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 10px; word-break: break-all; color: #ff6b6b;"></div>
              <div style="font-size: 10px; color: #888; margin-top: 4px;">\u26A0 Copy your nsec to import on another browser for entity sync.</div>
            </div>
            ` : ""}
          </div>
        ` : `
          <div>
            <button class="nac-btn" id="nac-connect-nip07">Connect NIP-07</button>
            <button class="nac-btn" id="nac-generate-keypair">Generate New Keypair</button>
            <div style="margin-top: 12px; border-top: 1px solid #444; padding-top: 12px;">
              <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">\u2500\u2500 or import existing \u2500\u2500</div>
              <input type="text" id="nac-nsec-input" placeholder="nsec1..."
                style="width: 100%; padding: 6px 8px; background: #1a1a2e; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 11px; margin-bottom: 8px; box-sizing: border-box;">
              <button id="nac-import-nsec" style="width: 100%; padding: 8px; background: #2d5a27; color: white; border: none; border-radius: 4px; cursor: pointer;">\u{1F511} Import Private Key</button>
              <div style="font-size: 10px; color: #888; margin-top: 6px;">\u26A0 Your nsec is stored locally in Tampermonkey storage. It never leaves your browser unencrypted.</div>
            </div>
          </div>
        `}
        
        <h4>Relays</h4>
        <div class="nac-relay-list">
          ${relayConfig.relays.map((r, i) => `
            <div class="nac-relay-item${r.enabled ? "" : " nac-relay-disabled"}" data-relay-index="${i}">
              <label class="nac-checkbox" style="flex: 1; min-width: 0;">
                <input type="checkbox" ${r.enabled ? "checked" : ""} data-index="${i}">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Utils.escapeHtml(r.url)}</span>
              </label>
              <button class="nac-relay-remove" data-relay-url="${Utils.escapeHtml(r.url)}" title="Remove relay" aria-label="Remove relay ${Utils.escapeHtml(r.url)}">\u2715</button>
            </div>
          `).join("")}
        </div>
        <button class="nac-btn" id="nac-add-relay">Add Relay</button>
        
        <h4>Entity Registry</h4>
        <div id="nac-entity-browser"></div>
        
        <div id="nac-storage-usage" style="margin-top: 16px; padding: 10px; background: #1a1a2e; border: 1px solid #333; border-radius: 6px; font-size: 11px; color: #aaa;">
          <span style="color: #888;">Calculating storage usage...</span>
        </div>
        <div style="margin-top: 8px;">
          <button class="nac-btn" id="nac-storage-cleanup" style="font-size: 11px; padding: 4px 10px;">\u{1F9F9} Storage Cleanup</button>
        </div>
        
        <div class="nac-version">Version ${CONFIG.version}</div>
      </div>
    `;
          ReaderView.container.appendChild(panel);
          document.getElementById("nac-close-settings").addEventListener("click", ReaderView.hideSettings);
          panel.focus();
          if (identity) {
            document.getElementById("nac-clear-identity").addEventListener("click", async () => {
              await Storage.identity.clear();
              panel.remove();
              Utils.showToast("Identity cleared");
            });
            if (identity.privkey) {
              document.getElementById("nac-show-nsec")?.addEventListener("click", () => {
                const display = document.getElementById("nac-nsec-display");
                if (display.style.display === "none") {
                  display.textContent = identity.nsec || Crypto.hexToNsec(identity.privkey) || "nsec not available";
                  display.style.display = "block";
                  document.getElementById("nac-show-nsec").textContent = "\u{1F648} Hide nsec";
                } else {
                  display.style.display = "none";
                  display.textContent = "";
                  document.getElementById("nac-show-nsec").textContent = "\u{1F441} Show nsec";
                }
              });
              document.getElementById("nac-copy-nsec")?.addEventListener("click", async () => {
                const nsec = identity.nsec || Crypto.hexToNsec(identity.privkey) || "";
                if (nsec) {
                  await navigator.clipboard.writeText(nsec);
                  const btn = document.getElementById("nac-copy-nsec");
                  btn.textContent = "\u2713 Copied!";
                  setTimeout(() => btn.textContent = "\u{1F4CB} Copy nsec", 2e3);
                }
              });
            }
          } else {
            document.getElementById("nac-connect-nip07")?.addEventListener("click", async () => {
              if (unsafeWindow.nostr) {
                const pubkey = await unsafeWindow.nostr.getPublicKey();
                await Storage.identity.set({
                  pubkey,
                  npub: Crypto.hexToNpub(pubkey),
                  signer_type: "nip07",
                  created_at: Math.floor(Date.now() / 1e3)
                });
                panel.remove();
                Utils.showToast("Connected via NIP-07");
              } else {
                Utils.showToast("NIP-07 extension not found", "error");
              }
            });
            document.getElementById("nac-generate-keypair")?.addEventListener("click", async () => {
              const privkey = Crypto.generatePrivateKey();
              const pubkey = Crypto.getPublicKey(privkey);
              await Storage.identity.set({
                pubkey,
                privkey,
                npub: Crypto.hexToNpub(pubkey),
                nsec: Crypto.hexToNsec(privkey),
                signer_type: "local",
                created_at: Math.floor(Date.now() / 1e3)
              });
              panel.remove();
              Utils.showToast("New keypair generated");
            });
            document.getElementById("nac-import-nsec")?.addEventListener("click", async () => {
              const nsecInput = document.getElementById("nac-nsec-input")?.value?.trim();
              if (!nsecInput || !nsecInput.startsWith("nsec1")) {
                alert("Invalid nsec format. Must start with nsec1...");
                return;
              }
              try {
                const privkeyHex = Crypto.nsecToHex(nsecInput);
                if (!privkeyHex || privkeyHex.length !== 64) throw new Error("Invalid nsec");
                const pubkey = Crypto.getPublicKey(privkeyHex);
                await Storage.identity.set({
                  pubkey,
                  privkey: privkeyHex,
                  npub: Crypto.hexToNpub(pubkey),
                  nsec: nsecInput,
                  signer_type: "local",
                  created_at: Math.floor(Date.now() / 1e3)
                });
                ReaderView.showSettings();
              } catch (e) {
                alert("Failed to import nsec: " + e.message);
              }
            });
          }
          document.querySelectorAll('.nac-relay-item input[type="checkbox"]').forEach((cb) => {
            cb.addEventListener("change", async (e) => {
              const index = parseInt(e.target.dataset.index);
              relayConfig.relays[index].enabled = e.target.checked;
              await Storage.relays.set(relayConfig);
              const item = e.target.closest(".nac-relay-item");
              if (item) {
                item.classList.toggle("nac-relay-disabled", !e.target.checked);
              }
            });
          });
          document.getElementById("nac-add-relay")?.addEventListener("click", async () => {
            const url = prompt("Enter relay WebSocket URL (e.g., wss://relay.damus.io):");
            if (!url) return;
            const trimmed = url.trim();
            if (!trimmed.startsWith("wss://") && !trimmed.startsWith("ws://")) {
              Utils.showToast("Invalid URL \u2014 must start with wss:// or ws://", "error");
              return;
            }
            const currentConfig = await Storage.relays.get();
            if (currentConfig.relays.find((r) => r.url === trimmed)) {
              Utils.showToast("Relay already in the list", "error");
              return;
            }
            await Storage.relays.addRelay(trimmed);
            Utils.showToast("Relay added: " + trimmed, "success");
            ReaderView.showSettings();
          });
          document.querySelectorAll(".nac-relay-remove").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              const url = e.target.dataset.relayUrl;
              if (!url) return;
              await Storage.relays.removeRelay(url);
              Utils.showToast("Relay removed: " + url, "success");
              ReaderView.showSettings();
            });
          });
          await EntityBrowser.init(panel, identity);
          try {
            const usage = await Storage.getUsageEstimate();
            const formatSize = (bytes) => {
              if (bytes < 1024) return bytes + " B";
              if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
              return (bytes / (1024 * 1024)).toFixed(2) + " MB";
            };
            const totalKB = usage.totalBytes / 1024;
            let color = "#4caf50";
            let label = "";
            if (totalKB >= 5120) {
              color = "#f44336";
              label = " \u2014 \u26A0 Very large, may impact performance";
            } else if (totalKB >= 1024) {
              color = "#ff9800";
              label = " \u2014 Growing large";
            }
            const el = document.getElementById("nac-storage-usage");
            if (el) {
              el.innerHTML = `<strong style="color: ${color};">Storage: ~${formatSize(usage.totalBytes)}</strong>${label}<br><span style="font-size: 10px;">Entities: ${formatSize(usage.breakdown.entities)}, Claims: ${formatSize(usage.breakdown.claims)}, Evidence: ${formatSize(usage.breakdown.evidenceLinks)}, Comments: ${formatSize(usage.breakdown.comments)}, Accounts: ${formatSize(usage.breakdown.platformAccounts)}, Identity: ${formatSize(usage.breakdown.identity)}, Relays: ${formatSize(usage.breakdown.relays)}</span>`;
            }
          } catch (e) {
            console.error("[NAC] Failed to calculate storage usage:", e);
          }
          document.getElementById("nac-storage-cleanup")?.addEventListener("click", async () => {
            const usage = await Storage.getUsageEstimate();
            const formatSize = (bytes) => {
              if (bytes < 1024) return bytes + " B";
              if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
              return (bytes / (1024 * 1024)).toFixed(2) + " MB";
            };
            const claims = await Storage.claims.getAll();
            const claimCount = Object.keys(claims).length;
            const evidence = await Storage.evidenceLinks.getAll();
            const evidenceCount = Object.keys(evidence).length;
            const entities = await Storage.entities.getAll();
            const entityCount = Object.keys(entities).length;
            let totalArticleRefs = 0;
            for (const entity of Object.values(entities)) {
              if (Array.isArray(entity.articles)) totalArticleRefs += entity.articles.length;
            }
            const msg = `Storage Cleanup

Total: ${formatSize(usage.totalBytes)}
\u2022 Entities: ${entityCount} (${formatSize(usage.breakdown.entities)})
  - ${totalArticleRefs} article references
\u2022 Claims: ${claimCount} (${formatSize(usage.breakdown.claims)})
\u2022 Evidence Links: ${evidenceCount} (${formatSize(usage.breakdown.evidenceLinks)})

Options:
1. Compact entities (trim article lists to 10 per entity)
2. Clear all claims
3. Clear all evidence links
4. Cancel

Enter option (1-4):`;
            const choice = prompt(msg);
            if (!choice) return;
            switch (choice.trim()) {
              case "1": {
                let trimmed = 0;
                for (const [id, entity] of Object.entries(entities)) {
                  if (Array.isArray(entity.articles) && entity.articles.length > 10) {
                    const before = entity.articles.length;
                    entity.articles = entity.articles.sort((a, b) => (b.tagged_at || 0) - (a.tagged_at || 0)).slice(0, 10);
                    trimmed += before - entity.articles.length;
                  }
                }
                await Storage.set("entity_registry", entities);
                Utils.showToast(`Compacted entities: removed ${trimmed} old article references`, "success");
                break;
              }
              case "2": {
                if (confirm(`Delete all ${claimCount} claims? This cannot be undone.`)) {
                  await Storage.set("article_claims", {});
                  Utils.showToast(`Cleared ${claimCount} claims`, "success");
                }
                break;
              }
              case "3": {
                if (confirm(`Delete all ${evidenceCount} evidence links? This cannot be undone.`)) {
                  await Storage.set("evidence_links", {});
                  Utils.showToast(`Cleared ${evidenceCount} evidence links`, "success");
                }
                break;
              }
              default:
                break;
            }
            ReaderView.showSettings();
          });
        }
      };
    }
  });

  // src/evidence-linker.js
  var EvidenceLinker;
  var init_evidence_linker = __esm({
    "src/evidence-linker.js"() {
      init_storage();
      init_utils();
      init_crypto();
      init_claim_extractor();
      init_reader_view();
      EvidenceLinker = {
        // Load evidence link indicators for all rendered claim chips
        loadIndicators: async (chipsEl, claims) => {
          for (const claim of claims) {
            try {
              const links = await Storage.evidenceLinks.getForClaim(claim.id);
              const slot = chipsEl.querySelector(`.nac-evidence-link-indicator-slot[data-claim-id="${claim.id}"]`);
              if (!slot || links.length === 0) continue;
              const indicator = document.createElement("span");
              indicator.className = "nac-evidence-link-indicator";
              indicator.setAttribute("tabindex", "0");
              indicator.setAttribute("role", "button");
              indicator.setAttribute("aria-label", `${links.length} evidence link${links.length !== 1 ? "s" : ""}`);
              indicator.textContent = `\u{1F517} ${links.length}`;
              indicator.dataset.claimId = claim.id;
              slot.replaceWith(indicator);
              indicator.addEventListener("click", (e) => {
                e.stopPropagation();
                EvidenceLinker.showLinksTooltip(claim.id, indicator);
              });
            } catch (e) {
            }
          }
        },
        // Show tooltip with linked claims
        showLinksTooltip: async (claimId, anchorEl) => {
          document.querySelectorAll(".nac-evidence-tooltip").forEach((t) => t.remove());
          const links = await Storage.evidenceLinks.getForClaim(claimId);
          if (links.length === 0) return;
          const allClaims = await Storage.claims.getAll();
          const tooltip = document.createElement("div");
          tooltip.className = "nac-evidence-tooltip";
          tooltip.setAttribute("role", "tooltip");
          const relIcons = { supports: "\u{1F7E2}", contradicts: "\u{1F534}", contextualizes: "\u{1F535}" };
          const relClasses = { supports: "nac-evidence-rel-supports", contradicts: "nac-evidence-rel-contradicts", contextualizes: "nac-evidence-rel-contextualizes" };
          let html = '<div class="nac-evidence-tooltip-title">\u{1F517} Linked Evidence:</div>';
          for (const link of links) {
            const otherId = link.source_claim_id === claimId ? link.target_claim_id : link.source_claim_id;
            const otherClaim = allClaims[otherId];
            const relIcon = relIcons[link.relationship] || "\u{1F517}";
            const relClass = relClasses[link.relationship] || "";
            const otherText = otherClaim ? Utils.escapeHtml(otherClaim.text.substring(0, 60)) + (otherClaim.text.length > 60 ? "\u2026" : "") : "(deleted claim)";
            const source = otherClaim ? Utils.escapeHtml(new URL(otherClaim.source_url).hostname) : "";
            html += `<div class="nac-evidence-tooltip-item">
        <span class="${relClass}">${relIcon} ${Utils.escapeHtml(link.relationship)}:</span>
        <span>"${otherText}"${source ? " (" + source + ")" : ""}</span>
        <button class="nac-evidence-delete-btn" data-link-id="${Utils.escapeHtml(link.id)}" aria-label="Delete evidence link" title="Delete link">\u2715</button>
      </div>`;
          }
          tooltip.innerHTML = html;
          const rect = anchorEl.getBoundingClientRect();
          tooltip.style.position = "fixed";
          tooltip.style.left = Math.min(rect.left, window.innerWidth - 420) + "px";
          tooltip.style.top = rect.bottom + 4 + "px";
          document.body.appendChild(tooltip);
          tooltip.querySelectorAll(".nac-evidence-delete-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              e.stopPropagation();
              await Storage.evidenceLinks.delete(btn.dataset.linkId);
              tooltip.remove();
              ClaimExtractor.refreshClaimsBar();
              Utils.showToast("Evidence link removed", "info");
            });
          });
          const closeHandler = (e) => {
            if (!tooltip.contains(e.target) && e.target !== anchorEl) {
              tooltip.remove();
              document.removeEventListener("click", closeHandler);
            }
          };
          setTimeout(() => document.addEventListener("click", closeHandler), 10);
        },
        // Show modal to create an evidence link
        showLinkModal: async (sourceClaimId) => {
          const sourceClaim = (ReaderView.claims || []).find((c) => c.id === sourceClaimId);
          if (!sourceClaim) return;
          const allClaims = await Storage.claims.getAll();
          const currentUrl = ReaderView.article?.url || "";
          const otherClaims = Object.values(allClaims).filter((c) => c.source_url !== currentUrl);
          if (otherClaims.length === 0) {
            Utils.showToast("No other article claims to link to", "info");
            return;
          }
          const groups = {};
          for (const c of otherClaims) {
            if (!groups[c.source_url]) {
              groups[c.source_url] = { title: c.source_title || "Untitled", url: c.source_url, claims: [] };
            }
            groups[c.source_url].claims.push(c);
          }
          document.querySelectorAll(".nac-evidence-modal").forEach((m) => m.remove());
          const modal = document.createElement("div");
          modal.className = "nac-evidence-modal";
          modal.setAttribute("role", "dialog");
          modal.setAttribute("aria-label", "Link evidence between claims");
          const sourceText = sourceClaim.text.length > 100 ? Utils.escapeHtml(sourceClaim.text.substring(0, 100)) + "\u2026" : Utils.escapeHtml(sourceClaim.text);
          let groupsHtml = "";
          for (const [url, group] of Object.entries(groups)) {
            const hostname = Utils.escapeHtml(new URL(url).hostname);
            groupsHtml += `<div class="nac-evidence-article-group">
        <div class="nac-evidence-article-title">\u{1F4C4} "${Utils.escapeHtml(group.title)}" (${hostname})</div>`;
            for (const c of group.claims) {
              const cText = c.text.length > 80 ? Utils.escapeHtml(c.text.substring(0, 80)) + "\u2026" : Utils.escapeHtml(c.text);
              groupsHtml += `<label class="nac-evidence-claim-option">
          <input type="radio" name="nac-evidence-target" value="${Utils.escapeHtml(c.id)}">
          <span>"${cText}"</span>
        </label>`;
            }
            groupsHtml += "</div>";
          }
          modal.innerHTML = `
      <div class="nac-evidence-modal-content">
        <div class="nac-evidence-modal-header">
          <h3>Link Evidence</h3>
          <button class="nac-btn-close" id="nac-evidence-modal-close" aria-label="Close evidence link modal">\xD7</button>
        </div>
        <div class="nac-evidence-modal-body">
          <div class="nac-evidence-source">
            <strong>Current claim:</strong> "${sourceText}"
          </div>
          <div class="nac-evidence-target-label">Select a claim to link to:</div>
          <div class="nac-evidence-target-list">${groupsHtml}</div>
          <div class="nac-evidence-options">
            <div class="nac-form-group">
              <label for="nac-evidence-relationship">Relationship:</label>
              <select id="nac-evidence-relationship" class="nac-form-select" aria-label="Evidence relationship type">
                <option value="supports">Supports</option>
                <option value="contradicts">Contradicts</option>
                <option value="contextualizes">Contextualizes</option>
              </select>
            </div>
            <div class="nac-form-group">
              <label for="nac-evidence-note">Note (optional):</label>
              <input type="text" id="nac-evidence-note" class="nac-form-input" placeholder="Optional explanation\u2026" aria-label="Evidence link note">
            </div>
          </div>
        </div>
        <div class="nac-evidence-modal-footer">
          <button class="nac-btn nac-btn-primary" id="nac-evidence-create" aria-label="Create evidence link">Create Link</button>
          <button class="nac-btn" id="nac-evidence-cancel" aria-label="Cancel">Cancel</button>
        </div>
      </div>
    `;
          document.body.appendChild(modal);
          modal.querySelector(".nac-evidence-modal-content").focus();
          const closeModal = () => modal.remove();
          modal.querySelector("#nac-evidence-modal-close").addEventListener("click", closeModal);
          modal.querySelector("#nac-evidence-cancel").addEventListener("click", closeModal);
          modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
          });
          modal.querySelector("#nac-evidence-create").addEventListener("click", async () => {
            const selectedRadio = modal.querySelector('input[name="nac-evidence-target"]:checked');
            if (!selectedRadio) {
              Utils.showToast("Please select a target claim", "error");
              return;
            }
            const targetClaimId = selectedRadio.value;
            const relationship = modal.querySelector("#nac-evidence-relationship").value;
            const note = modal.querySelector("#nac-evidence-note").value.trim();
            const linkId = "link_" + await Crypto.sha256(sourceClaimId + targetClaimId + relationship);
            const identity = await Storage.identity.get();
            const link = {
              id: linkId,
              source_claim_id: sourceClaimId,
              target_claim_id: targetClaimId,
              relationship,
              note,
              created_at: Date.now(),
              created_by: identity?.pubkey || "local"
            };
            await Storage.evidenceLinks.save(link);
            closeModal();
            ClaimExtractor.refreshClaimsBar();
            Utils.showToast(`Evidence link created: ${relationship}`, "success");
          });
        }
      };
    }
  });

  // src/claim-extractor.js
  var ClaimExtractor;
  var init_claim_extractor = __esm({
    "src/claim-extractor.js"() {
      init_config();
      init_storage();
      init_utils();
      init_crypto();
      init_entity_tagger();
      init_evidence_linker();
      init_reader_view();
      init_relay_client();
      ClaimExtractor = {
        // Show the claim extraction form inside the popover (progressive disclosure)
        showForm: async (text, popover) => {
          const truncated = text.length > CONFIG.tagging.max_claim_length ? text.substring(0, CONFIG.tagging.max_claim_length) + "\u2026" : text;
          const entityOptions = [];
          for (const ref of ReaderView.entities || []) {
            try {
              const entity = await Storage.entities.get(ref.entity_id);
              if (entity) {
                const emoji = entity.type === "person" ? "\u{1F464}" : entity.type === "organization" ? "\u{1F3E2}" : entity.type === "place" ? "\u{1F4CD}" : "\u{1F537}";
                entityOptions.push({ id: entity.id, name: entity.name, type: entity.type, emoji });
              }
            } catch (e) {
            }
          }
          const matchedEntities = entityOptions.filter(
            (e) => text.toLowerCase().includes(e.name.toLowerCase())
          );
          const autoSubject = matchedEntities.length >= 1 ? `${matchedEntities[0].emoji} ${matchedEntities[0].name}` : "";
          const autoObject = matchedEntities.length >= 2 ? `${matchedEntities[1].emoji} ${matchedEntities[1].name}` : "";
          const autoExpandAttribution = false;
          const autoExpandStructure = matchedEntities.length > 0;
          const entityDatalistOptions = entityOptions.map(
            (e) => `<option value="${e.emoji} ${Utils.escapeHtml(e.name)}">`
          ).join("");
          const claimantOptionsHtml = entityOptions.map(
            (e) => `<option value="${Utils.escapeHtml(e.id)}">${e.emoji} ${Utils.escapeHtml(e.name)}</option>`
          ).join("");
          popover.innerHTML = `
      <div class="nac-claim-form" role="form" aria-label="Extract claim">
        <div class="nac-claim-form-title">\u{1F4CB} Extract Claim</div>
        <div class="nac-claim-form-text">"${Utils.escapeHtml(truncated)}"</div>

        <div class="nac-claim-form-field nac-claim-form-row">
          <div class="nac-claim-form-row-left">
            <label for="nac-claim-type">Type:</label>
            <select id="nac-claim-type" class="nac-form-select" aria-label="Claim type">
              <option value="factual">Factual</option>
              <option value="causal">Causal</option>
              <option value="evaluative">Evaluative</option>
              <option value="predictive">Predictive</option>
            </select>
          </div>
          <label class="nac-claim-crux-label">
            <input type="checkbox" id="nac-claim-crux" aria-label="Mark as key claim (crux)">
            \u2610 Key claim (crux)
          </label>
        </div>

        <div class="nac-claim-form-field nac-claim-confidence-field" id="nac-claim-confidence-field" style="display: none;">
          <label for="nac-claim-confidence">Confidence: <span id="nac-claim-confidence-value">50</span>%</label>
          <input type="range" id="nac-claim-confidence" min="0" max="100" value="50" class="nac-claim-confidence-range" aria-label="Confidence level">
        </div>

        <!-- Collapsible: Who Said It -->
        <div class="nac-claim-section-header" data-section="attribution" aria-expanded="${autoExpandAttribution}" aria-controls="nac-claim-attribution-section" tabindex="0" role="button">
          <span class="nac-claim-section-arrow">${autoExpandAttribution ? "\u25BE" : "\u25B8"}</span> Who Said It
        </div>
        <div class="nac-claim-section-body" id="nac-claim-attribution-section" style="display:${autoExpandAttribution ? "" : "none"}">
          <div class="nac-claim-form-field">
            <label for="nac-claim-attribution">Attribution:</label>
            <select id="nac-claim-attribution" class="nac-form-select" aria-label="Claim attribution">
              <option value="editorial">Editorial (article's own assertion)</option>
              <option value="direct_quote">Direct Quote</option>
              <option value="paraphrase">Paraphrase</option>
              <option value="thesis">Article's Main Thesis</option>
            </select>
          </div>
          <div class="nac-claim-form-field">
            <label for="nac-claim-claimant">Claimed by:</label>
            <select id="nac-claim-claimant" class="nac-form-select" aria-label="Who made this claim">
              <option value="">Article / Editorial Voice</option>
              ${claimantOptionsHtml}
            </select>
          </div>
          <div class="nac-claim-form-field" id="nac-claim-quote-date-field" style="display:none;">
            <label for="nac-claim-quote-date">Quote date:</label>
            <input type="date" id="nac-claim-quote-date" class="nac-form-input" aria-label="Date of quote or statement">
          </div>
        </div>

        <!-- Collapsible: What It Says (sentence builder) -->
        <div class="nac-claim-section-header" data-section="structure" aria-expanded="${autoExpandStructure}" aria-controls="nac-claim-structure-section" tabindex="0" role="button">
          <span class="nac-claim-section-arrow">${autoExpandStructure ? "\u25BE" : "\u25B8"}</span> What It Says
        </div>
        <div class="nac-claim-section-body" id="nac-claim-structure-section" style="display:${autoExpandStructure ? "" : "none"}">
          <div class="nac-claim-sentence-builder">
            <div class="nac-claim-sentence-slot">
              <input type="text" id="nac-claim-subject" list="nac-claim-subject-list" placeholder="Entity or text\u2026" class="nac-form-input" aria-label="Subject">
              <datalist id="nac-claim-subject-list">
                ${entityDatalistOptions}
              </datalist>
              <span class="nac-claim-sentence-label">subject</span>
            </div>
            <div class="nac-claim-sentence-slot">
              <input id="nac-claim-predicate" list="nac-predicates" class="nac-form-input" placeholder="is, funds, causes\u2026" aria-label="Predicate verb">
              <datalist id="nac-predicates">
                <option value="is">
                <option value="causes">
                <option value="funds">
                <option value="prevents">
                <option value="supports">
                <option value="opposes">
                <option value="characterizes">
                <option value="employs">
                <option value="produces">
                <option value="regulates">
              </datalist>
              <span class="nac-claim-sentence-label">verb</span>
            </div>
            <div class="nac-claim-sentence-slot">
              <input type="text" id="nac-claim-object" list="nac-claim-object-list" placeholder="Entity or text\u2026" class="nac-form-input" aria-label="Object">
              <datalist id="nac-claim-object-list">
                ${entityDatalistOptions}
              </datalist>
              <span class="nac-claim-sentence-label">object</span>
            </div>
          </div>
        </div>

        <div class="nac-claim-form-actions">
          <button class="nac-btn nac-btn-primary" id="nac-claim-save" aria-label="Save claim">Save Claim</button>
          <button class="nac-btn" id="nac-claim-cancel" aria-label="Cancel">Cancel</button>
        </div>
      </div>
    `;
          if (autoSubject) {
            const subjectEl = popover.querySelector("#nac-claim-subject");
            if (subjectEl) subjectEl.value = autoSubject;
          }
          if (autoObject) {
            const objectEl = popover.querySelector("#nac-claim-object");
            if (objectEl) objectEl.value = autoObject;
          }
          popover.querySelectorAll(".nac-claim-section-header").forEach((header) => {
            const toggle = () => {
              const section = header.dataset.section;
              const bodyId = section === "attribution" ? "nac-claim-attribution-section" : "nac-claim-structure-section";
              const body = popover.querySelector("#" + bodyId);
              const arrow = header.querySelector(".nac-claim-section-arrow");
              if (!body) return;
              const isHidden = body.style.display === "none";
              body.style.display = isHidden ? "" : "none";
              arrow.textContent = isHidden ? "\u25BE" : "\u25B8";
              header.setAttribute("aria-expanded", String(isHidden));
            };
            header.addEventListener("click", toggle);
            header.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            });
          });
          popover.querySelector("#nac-claim-crux").addEventListener("change", (e) => {
            const confField = popover.querySelector("#nac-claim-confidence-field");
            if (confField) confField.style.display = e.target.checked ? "" : "none";
          });
          const confRange = popover.querySelector("#nac-claim-confidence");
          const confLabel = popover.querySelector("#nac-claim-confidence-value");
          if (confRange && confLabel) {
            confRange.addEventListener("input", () => {
              confLabel.textContent = confRange.value;
            });
          }
          const attrSelect = popover.querySelector("#nac-claim-attribution");
          const quoteDateField = popover.querySelector("#nac-claim-quote-date-field");
          if (attrSelect && quoteDateField) {
            const updateQuoteDateVisibility = () => {
              const val = attrSelect.value;
              quoteDateField.style.display = val === "direct_quote" || val === "paraphrase" ? "" : "none";
            };
            attrSelect.addEventListener("change", updateQuoteDateVisibility);
            updateQuoteDateVisibility();
          }
          popover.querySelector("#nac-claim-save").addEventListener("click", async () => {
            const type = document.getElementById("nac-claim-type").value;
            const isCrux = document.getElementById("nac-claim-crux").checked;
            const confidence = isCrux ? parseInt(document.getElementById("nac-claim-confidence")?.value) : null;
            const attribution = document.getElementById("nac-claim-attribution")?.value || "editorial";
            const claimantId = document.getElementById("nac-claim-claimant")?.value || null;
            const quoteDate = document.getElementById("nac-claim-quote-date")?.value || null;
            const predicate = document.getElementById("nac-claim-predicate")?.value || null;
            const subjectInput = document.getElementById("nac-claim-subject")?.value?.trim() || "";
            let subjectEntityIds = [];
            let subjectText = null;
            if (subjectInput) {
              const matchedSubject = entityOptions.find(
                (e) => subjectInput === `${e.emoji} ${e.name}` || subjectInput === e.name || subjectInput.includes(e.name)
              );
              if (matchedSubject) {
                subjectEntityIds = [matchedSubject.id];
              } else {
                subjectText = subjectInput;
              }
            }
            const objectInput = document.getElementById("nac-claim-object")?.value?.trim() || "";
            let objectEntityIds = [];
            let objectText = null;
            if (objectInput) {
              const matchedObject = entityOptions.find(
                (e) => objectInput === `${e.emoji} ${e.name}` || objectInput === e.name || objectInput.includes(e.name)
              );
              if (matchedObject) {
                objectEntityIds = [matchedObject.id];
              } else {
                objectText = objectInput;
              }
            }
            await ClaimExtractor.saveClaim(text, type, isCrux, confidence, attribution, claimantId, subjectEntityIds, objectEntityIds, predicate, quoteDate, subjectText, objectText);
            EntityTagger.hide();
          });
          popover.querySelector("#nac-claim-cancel").addEventListener("click", () => {
            EntityTagger.hide();
          });
        },
        // Save a claim for the current article
        saveClaim: async (text, type, isCrux, confidence = null, attribution = "editorial", claimantEntityId = null, subjectEntityIds = [], objectEntityIds = [], predicate = null, quoteDate = null, subjectText = null, objectText = null) => {
          if (!ReaderView.article) return;
          const claimId = "claim_" + await Crypto.sha256(ReaderView.article.url + text);
          let context = "";
          try {
            const contentEl = document.getElementById("nac-content");
            if (contentEl) {
              const paragraphs = contentEl.querySelectorAll("p");
              for (const p of paragraphs) {
                if (p.textContent.includes(text.substring(0, 40))) {
                  context = p.textContent.substring(0, 300);
                  break;
                }
              }
            }
          } catch (e) {
          }
          const identity = await Storage.identity.get();
          const claim = {
            id: claimId,
            text,
            type,
            is_crux: isCrux,
            confidence,
            claimant_entity_id: claimantEntityId || null,
            subject_entity_ids: Array.isArray(subjectEntityIds) ? subjectEntityIds : [],
            object_entity_ids: Array.isArray(objectEntityIds) ? objectEntityIds : [],
            subject_text: subjectText || null,
            object_text: objectText || null,
            predicate: predicate || null,
            quote_date: quoteDate || null,
            attribution: attribution || "editorial",
            source_url: ReaderView.article.url,
            source_title: ReaderView.article.title || "Untitled",
            context,
            created_at: Date.now(),
            created_by: identity?.pubkey || "local"
          };
          await Storage.claims.save(claim);
          if (!ReaderView.claims.find((c) => c.id === claimId)) {
            ReaderView.claims.push(claim);
          } else {
            const idx = ReaderView.claims.findIndex((c) => c.id === claimId);
            ReaderView.claims[idx] = claim;
          }
          ClaimExtractor.refreshClaimsBar();
          Utils.showToast(`Claim saved: ${text.substring(0, 50)}\u2026`, "success");
        },
        // Remove a claim
        removeClaim: async (claimId) => {
          await Storage.claims.delete(claimId);
          ReaderView.claims = ReaderView.claims.filter((c) => c.id !== claimId);
          ClaimExtractor.refreshClaimsBar();
          Utils.showToast("Claim removed", "info");
        },
        // Toggle crux status for a claim
        toggleCrux: async (claimId) => {
          const claim = ReaderView.claims.find((c) => c.id === claimId);
          if (!claim) return;
          claim.is_crux = !claim.is_crux;
          if (!claim.is_crux) claim.confidence = null;
          await Storage.claims.save(claim);
          ClaimExtractor.refreshClaimsBar();
          Utils.showToast(claim.is_crux ? "Marked as crux claim" : "Unmarked as crux claim", "info");
        },
        // Update confidence for a crux claim (no UI refresh — slider already shows new value)
        updateConfidence: async (claimId, value) => {
          const claim = ReaderView.claims.find((c) => c.id === claimId);
          if (!claim) return;
          claim.confidence = value;
          await Storage.claims.save(claim);
        },
        // Edit claim text inline
        editClaimText: async (claimId, newText) => {
          const claim = ReaderView.claims.find((c) => c.id === claimId);
          if (!claim || !newText.trim()) return;
          claim.text = newText.trim();
          await Storage.claims.save(claim);
          ClaimExtractor.refreshClaimsBar();
          Utils.showToast("Claim text updated", "info");
        },
        // Refresh the claims bar UI
        refreshClaimsBar: async () => {
          const bar = document.getElementById("nac-claims-bar");
          if (!bar) return;
          const claims = ReaderView.claims || [];
          const countEl = bar.querySelector(".nac-claims-count");
          if (countEl) countEl.textContent = claims.length;
          const chipsEl = bar.querySelector(".nac-claims-chips");
          if (!chipsEl) return;
          const toolbarBadge = document.getElementById("nac-claims-badge");
          if (toolbarBadge) {
            toolbarBadge.textContent = claims.length;
            toolbarBadge.style.display = claims.length > 0 ? "inline-flex" : "none";
          }
          if (claims.length === 0) {
            chipsEl.innerHTML = '<div class="nac-claims-empty">No claims extracted yet. Select text and click \u{1F4CB} Claim.</div>';
            return;
          }
          const typeColors = {
            factual: "nac-claim-type-factual",
            causal: "nac-claim-type-causal",
            evaluative: "nac-claim-type-evaluative",
            predictive: "nac-claim-type-predictive"
          };
          const typeLabels = {
            factual: "Factual",
            causal: "Causal",
            evaluative: "Evaluative",
            predictive: "Predictive"
          };
          const attributionLabels = {
            direct_quote: "Quote",
            paraphrase: "Paraphrase",
            thesis: "Thesis"
          };
          const entityNameCache = {};
          const entityTypeCache = {};
          for (const claim of claims) {
            const idsToLoad = [...claim.subject_entity_ids || [], ...claim.object_entity_ids || []];
            if (claim.claimant_entity_id) idsToLoad.push(claim.claimant_entity_id);
            for (const eid of idsToLoad) {
              if (!entityNameCache[eid]) {
                try {
                  const entity = await Storage.entities.get(eid);
                  if (entity) {
                    entityNameCache[eid] = entity.name;
                    entityTypeCache[eid] = entity.type;
                  }
                } catch (e) {
                }
              }
            }
          }
          const sorted = [...claims].sort((a, b) => (b.is_crux ? 1 : 0) - (a.is_crux ? 1 : 0));
          chipsEl.innerHTML = sorted.map((claim) => {
            const cruxIcon = claim.is_crux ? '<span class="nac-claim-crux-icon" title="Key claim (crux)">\u{1F511}</span> ' : "";
            const confDisplay = claim.is_crux && claim.confidence != null ? `<span class="nac-claim-confidence-display">${claim.confidence}%</span> ` : "";
            const truncatedText = claim.text.length > 80 ? Utils.escapeHtml(claim.text.substring(0, 80)) + "\u2026" : Utils.escapeHtml(claim.text);
            const typeClass = typeColors[claim.type] || "nac-claim-type-factual";
            const typeLabel = typeLabels[claim.type] || "Factual";
            const claimantName = claim.claimant_entity_id && entityNameCache[claim.claimant_entity_id] ? ` \u2014 <span class="nac-claim-claimant-label" title="Claimed by ${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])}">${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])}</span>` : "";
            const subjectEmojis = (claim.subject_entity_ids || []).map((eid) => {
              const t = entityTypeCache[eid];
              return t === "person" ? "\u{1F464}" : t === "organization" ? "\u{1F3E2}" : t === "place" ? "\u{1F4CD}" : t === "thing" ? "\u{1F537}" : "";
            }).filter(Boolean).join("");
            const subjectBadge = subjectEmojis ? `<span class="nac-claim-subject-emojis" title="About entities">${subjectEmojis}</span>` : "";
            const attrLabel = attributionLabels[claim.attribution];
            const attrBadge = attrLabel ? `<span class="nac-claim-attribution-badge">${attrLabel}</span>` : "";
            let subjectDisplay = "";
            for (const sid of claim.subject_entity_ids || []) {
              if (entityNameCache[sid]) {
                const emojiForType = (t) => t === "person" ? "\u{1F464}" : t === "organization" ? "\u{1F3E2}" : t === "place" ? "\u{1F4CD}" : t === "thing" ? "\u{1F537}" : "\u2022";
                const sEmoji = emojiForType(entityTypeCache[sid]);
                subjectDisplay += `${sEmoji} ${entityNameCache[sid]}`;
              }
            }
            if (!subjectDisplay && claim.subject_text) subjectDisplay = claim.subject_text;
            let objectDisplay = "";
            for (const oid of claim.object_entity_ids || []) {
              if (entityNameCache[oid]) {
                const emojiForType = (t) => t === "person" ? "\u{1F464}" : t === "organization" ? "\u{1F3E2}" : t === "place" ? "\u{1F4CD}" : t === "thing" ? "\u{1F537}" : "\u2022";
                const oEmoji = emojiForType(entityTypeCache[oid]);
                objectDisplay += `${oEmoji} ${entityNameCache[oid]}`;
              }
            }
            if (!objectDisplay && claim.object_text) objectDisplay = claim.object_text;
            const hasStructure = (subjectDisplay || objectDisplay) && claim.predicate;
            let tripleLine = "";
            if (hasStructure) {
              const emojiForType = (t) => t === "person" ? "\u{1F464}" : t === "organization" ? "\u{1F3E2}" : t === "place" ? "\u{1F4CD}" : t === "thing" ? "\u{1F537}" : "\u2022";
              let claimantPart = "";
              if (claim.claimant_entity_id && entityNameCache[claim.claimant_entity_id]) {
                const cEmoji = emojiForType(entityTypeCache[claim.claimant_entity_id]);
                claimantPart = `<span class="nac-claim-triple-claimant">${cEmoji} ${Utils.escapeHtml(entityNameCache[claim.claimant_entity_id])} \u2192</span> `;
              }
              const subjectPart = subjectDisplay ? `<span class="nac-claim-triple-subject">${Utils.escapeHtml(subjectDisplay)}</span> ` : "";
              const predicatePart = `<span class="nac-claim-triple-predicate">${Utils.escapeHtml(claim.predicate)}</span> `;
              const objectPart = objectDisplay ? `<span class="nac-claim-triple-object">${Utils.escapeHtml(objectDisplay)}</span> ` : "";
              let datePart = "";
              if (claim.quote_date) {
                try {
                  const d = new Date(claim.quote_date);
                  if (!isNaN(d.getTime())) {
                    datePart = `<span class="nac-claim-triple-date">\u2022 ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>`;
                  }
                } catch (e) {
                }
              }
              tripleLine = `<div class="nac-claim-triple">${claimantPart}${subjectPart}${predicatePart}${objectPart}${datePart}</div>`;
            }
            return `
        <div class="nac-claim-chip${claim.is_crux ? " nac-claim-crux" : ""}" data-claim-id="${Utils.escapeHtml(claim.id)}" title="Click text to edit \xB7 Click \u{1F511} to toggle crux" tabindex="0" role="button" aria-label="Claim: ${Utils.escapeHtml(claim.text.substring(0, 60))}">
          <span class="nac-claim-text-display" data-claim-id="${Utils.escapeHtml(claim.id)}">${cruxIcon}${confDisplay}${truncatedText}${claimantName}</span>
          <span class="nac-claim-type-badge ${typeClass}">${typeLabel}</span>
          ${attrBadge}${subjectBadge}
          <span class="nac-evidence-link-indicator-slot" data-claim-id="${Utils.escapeHtml(claim.id)}"></span>
          <button class="nac-claim-link-btn" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Link evidence" title="Link evidence to another claim">\u{1F517}</button>
          <button class="nac-claim-crux-toggle" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Toggle crux" title="Toggle crux">\u{1F511}</button>
          <button class="nac-claim-remove" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Remove claim">\u2715</button>
          ${tripleLine}
        </div>
        ${claim.is_crux ? `<div class="nac-claim-confidence-row" data-claim-id="${Utils.escapeHtml(claim.id)}">
          <label class="nac-claim-confidence-label">Confidence: <span class="nac-claim-conf-val">${claim.confidence != null ? claim.confidence : 50}%</span></label>
          <input type="range" class="nac-claim-confidence-range" min="0" max="100" value="${claim.confidence != null ? claim.confidence : 50}" data-claim-id="${Utils.escapeHtml(claim.id)}" aria-label="Set confidence for claim">
        </div>` : ""}
      `;
          }).join("");
          chipsEl.querySelectorAll(".nac-claim-crux-toggle").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              ClaimExtractor.toggleCrux(btn.dataset.claimId);
            });
          });
          chipsEl.querySelectorAll(".nac-claim-text-display").forEach((span) => {
            span.addEventListener("click", (e) => {
              e.stopPropagation();
              const claimId = span.dataset.claimId;
              const claim = ReaderView.claims.find((c) => c.id === claimId);
              if (!claim) return;
              const input = document.createElement("input");
              input.type = "text";
              input.className = "nac-claim-text-edit";
              input.value = claim.text;
              input.setAttribute("aria-label", "Edit claim text");
              span.replaceWith(input);
              input.focus();
              input.select();
              const commit = () => {
                if (input.value.trim() && input.value.trim() !== claim.text) {
                  ClaimExtractor.editClaimText(claimId, input.value.trim());
                } else {
                  ClaimExtractor.refreshClaimsBar();
                }
              };
              input.addEventListener("blur", commit);
              input.addEventListener("keydown", (ke) => {
                if (ke.key === "Enter") {
                  ke.preventDefault();
                  input.blur();
                }
                if (ke.key === "Escape") {
                  input.value = claim.text;
                  input.blur();
                }
              });
            });
          });
          chipsEl.querySelectorAll(".nac-claim-confidence-range").forEach((range) => {
            const valEl = range.closest(".nac-claim-confidence-row")?.querySelector(".nac-claim-conf-val");
            range.addEventListener("input", () => {
              if (valEl) valEl.textContent = range.value + "%";
            });
            range.addEventListener("change", () => {
              ClaimExtractor.updateConfidence(range.dataset.claimId, parseInt(range.value, 10));
            });
          });
          chipsEl.querySelectorAll(".nac-claim-remove").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              ClaimExtractor.removeClaim(btn.dataset.claimId);
            });
          });
          chipsEl.querySelectorAll(".nac-claim-link-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              EvidenceLinker.showLinkModal(btn.dataset.claimId);
            });
          });
          EvidenceLinker.loadIndicators(chipsEl, claims);
        },
        // Load claims for a URL and initialize the bar
        loadForArticle: async (url) => {
          const claims = await Storage.claims.getForUrl(url);
          ReaderView.claims = claims;
          ClaimExtractor.refreshClaimsBar();
        },
        // Fetch kind 30040 claim events from relays for an article URL
        fetchRemoteClaims: async (articleUrl) => {
          const relayConfig = await Storage.relays.get();
          const enabledRelayUrls = relayConfig.relays.filter((r) => r.enabled && r.read).map((r) => r.url);
          if (enabledRelayUrls.length === 0) {
            Utils.showToast("No read-enabled relays configured", "error");
            return [];
          }
          const filter = {
            kinds: [30040],
            "#r": [articleUrl]
          };
          const events = await RelayClient.subscribe(filter, enabledRelayUrls, { timeout: 15e3, idleTimeout: 1e4 });
          const seen = /* @__PURE__ */ new Set();
          const unique = [];
          for (const evt of events) {
            if (evt.id && !seen.has(evt.id)) {
              seen.add(evt.id);
              unique.push(evt);
            }
          }
          return unique.map((event) => {
            const tagMap = {};
            for (const tag of event.tags || []) {
              if (tag.length >= 2 && !tagMap[tag[0]]) {
                tagMap[tag[0]] = tag.slice(1);
              }
            }
            return {
              pubkey: event.pubkey,
              text: tagMap["claim-text"]?.[0] || event.content || "",
              type: tagMap["claim-type"]?.[0] || "factual",
              is_crux: !!tagMap["crux"],
              confidence: tagMap["confidence"] ? parseInt(tagMap["confidence"][0]) : null,
              claimant: tagMap["claimant"]?.[0] || null,
              attribution: tagMap["attribution"]?.[0] || "editorial",
              subjects: (event.tags || []).filter((t) => t[0] === "subject").map((t) => t[1]),
              created_at: event.created_at,
              npub: Crypto.hexToNpub(event.pubkey) || event.pubkey.substring(0, 16) + "\u2026"
            };
          });
        },
        // Show remote claims panel (with caching)
        showRemoteClaims: async () => {
          const section = document.getElementById("nac-remote-claims-section");
          if (section && section.style.display !== "none") {
            section.style.display = "none";
            return;
          }
          if (ReaderView._remoteClaimsCache !== null) {
            ClaimExtractor.renderRemoteClaims(ReaderView._remoteClaimsCache);
            return;
          }
          ClaimExtractor.renderRemoteClaimsLoading();
          try {
            const articleUrl = ReaderView.article?.url;
            if (!articleUrl) {
              Utils.showToast("No article URL available", "error");
              return;
            }
            const remoteClaims = await ClaimExtractor.fetchRemoteClaims(articleUrl);
            const identity = await Storage.identity.get();
            const ownPubkey = identity?.pubkey || null;
            const othersClaims = ownPubkey ? remoteClaims.filter((c) => c.pubkey !== ownPubkey) : remoteClaims;
            ReaderView._remoteClaimsCache = othersClaims;
            ClaimExtractor.renderRemoteClaims(othersClaims);
          } catch (e) {
            console.error("[NAC] Failed to fetch remote claims:", e);
            ClaimExtractor.renderRemoteClaimsError("Could not reach relays");
          }
        },
        // Render loading spinner for remote claims
        renderRemoteClaimsLoading: () => {
          let section = document.getElementById("nac-remote-claims-section");
          if (!section) {
            section = document.createElement("div");
            section.id = "nac-remote-claims-section";
            section.className = "nac-remote-claims-section";
            section.setAttribute("role", "region");
            section.setAttribute("aria-label", "Other users' claims");
            const claimsBar = document.getElementById("nac-claims-bar");
            if (claimsBar) claimsBar.appendChild(section);
          }
          section.style.display = "";
          section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">\u{1F310} Others' Claims</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">\u2715</button>
      </div>
      <div class="nac-remote-claims-loading" aria-label="Loading remote claims">
        <div class="nac-spinner"></div> Fetching claims from relays\u2026
      </div>
    `;
          section.querySelector("#nac-remote-claims-close")?.addEventListener("click", () => {
            section.style.display = "none";
          });
        },
        // Render error state for remote claims
        renderRemoteClaimsError: (message) => {
          let section = document.getElementById("nac-remote-claims-section");
          if (!section) return;
          section.style.display = "";
          section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">\u{1F310} Others' Claims</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">\u2715</button>
      </div>
      <div class="nac-remote-claims-empty">${Utils.escapeHtml(message)}</div>
    `;
          section.querySelector("#nac-remote-claims-close")?.addEventListener("click", () => {
            section.style.display = "none";
          });
        },
        // Render fetched remote claims grouped by publisher npub
        renderRemoteClaims: (claims) => {
          let section = document.getElementById("nac-remote-claims-section");
          if (!section) {
            section = document.createElement("div");
            section.id = "nac-remote-claims-section";
            section.className = "nac-remote-claims-section";
            section.setAttribute("role", "region");
            section.setAttribute("aria-label", "Other users' claims");
            const claimsBar = document.getElementById("nac-claims-bar");
            if (claimsBar) claimsBar.appendChild(section);
          }
          section.style.display = "";
          if (!claims || claims.length === 0) {
            section.innerHTML = `
        <div class="nac-remote-claims-header">
          <span class="nac-remote-claims-title">\u{1F310} Others' Claims</span>
          <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">\u2715</button>
        </div>
        <div class="nac-remote-claims-empty">No other users have extracted claims from this article yet</div>
      `;
            section.querySelector("#nac-remote-claims-close")?.addEventListener("click", () => {
              section.style.display = "none";
            });
            return;
          }
          const groups = {};
          for (const claim of claims) {
            if (!groups[claim.pubkey]) {
              groups[claim.pubkey] = { npub: claim.npub, claims: [] };
            }
            groups[claim.pubkey].claims.push(claim);
          }
          const userCount = Object.keys(groups).length;
          const typeLabels = { factual: "Factual", causal: "Causal", evaluative: "Evaluative", predictive: "Predictive" };
          const typeColors = { factual: "nac-claim-type-factual", causal: "nac-claim-type-causal", evaluative: "nac-claim-type-evaluative", predictive: "nac-claim-type-predictive" };
          let groupsHtml = "";
          for (const [pubkey, group] of Object.entries(groups)) {
            const truncNpub = group.npub.length > 20 ? group.npub.substring(0, 20) + "\u2026" : group.npub;
            const claimsHtml = group.claims.map((claim) => {
              const cruxIcon = claim.is_crux ? '<span class="nac-claim-crux-icon" title="Key claim (crux)">\u{1F511}</span> ' : "";
              const confDisplay = claim.is_crux && claim.confidence != null ? `<span class="nac-claim-confidence-display">${claim.confidence}%</span> ` : "";
              const truncatedText = claim.text.length > 100 ? Utils.escapeHtml(claim.text.substring(0, 100)) + "\u2026" : Utils.escapeHtml(claim.text);
              const typeClass = typeColors[claim.type] || "nac-claim-type-factual";
              const typeLabel = typeLabels[claim.type] || "Factual";
              const claimantLabel = claim.claimant ? ` \u2014 <span class="nac-claim-claimant-label">${Utils.escapeHtml(claim.claimant)}</span>` : "";
              return `<div class="nac-remote-claim-chip${claim.is_crux ? " nac-claim-crux" : ""}" aria-label="Claim: ${Utils.escapeHtml(claim.text.substring(0, 60))}">
          <span class="nac-remote-claim-text">${cruxIcon}${confDisplay}"${truncatedText}"${claimantLabel}</span>
          <span class="nac-claim-type-badge ${typeClass}">${typeLabel}</span>
        </div>`;
            }).join("");
            groupsHtml += `
        <div class="nac-remote-claims-group">
          <div class="nac-remote-npub" title="${Utils.escapeHtml(group.npub)}" aria-label="Publisher ${Utils.escapeHtml(truncNpub)}">
            ${Utils.escapeHtml(truncNpub)} (${group.claims.length} claim${group.claims.length !== 1 ? "s" : ""})
          </div>
          ${claimsHtml}
        </div>
      `;
          }
          section.innerHTML = `
      <div class="nac-remote-claims-header">
        <span class="nac-remote-claims-title">\u{1F310} Others' Claims (${claims.length} from ${userCount} user${userCount !== 1 ? "s" : ""})</span>
        <button class="nac-remote-claims-close" id="nac-remote-claims-close" aria-label="Close others' claims">\u2715</button>
      </div>
      ${groupsHtml}
    `;
          section.querySelector("#nac-remote-claims-close")?.addEventListener("click", () => {
            section.style.display = "none";
          });
        }
      };
    }
  });

  // src/entity-tagger.js
  var EntityTagger;
  var init_entity_tagger = __esm({
    "src/entity-tagger.js"() {
      init_storage();
      init_utils();
      init_crypto();
      init_claim_extractor();
      init_entity_auto_suggest();
      init_reader_view();
      EntityTagger = {
        popover: null,
        selectedText: "",
        // Show entity tagging popover
        show: (text, x, y) => {
          EntityTagger.selectedText = text;
          EntityTagger.hide();
          EntityTagger.popover = document.createElement("div");
          EntityTagger.popover.className = "nac-entity-popover";
          EntityTagger.popover.style.left = x + "px";
          EntityTagger.popover.style.top = y - 120 + "px";
          EntityTagger.popover.innerHTML = `
      <div class="nac-popover-title">Tag "${Utils.escapeHtml(text)}"</div>
      <div class="nac-entity-type-buttons">
        <button class="nac-btn-entity-type" data-type="person" aria-label="Tag as Person">\u{1F464} Person</button>
        <button class="nac-btn-entity-type" data-type="organization" aria-label="Tag as Organization">\u{1F3E2} Org</button>
        <button class="nac-btn-entity-type" data-type="place" aria-label="Tag as Place">\u{1F4CD} Place</button>
        <button class="nac-btn-entity-type" data-type="thing" aria-label="Tag as Thing">\u{1F537} Thing</button>
        <button class="nac-btn-entity-type nac-btn-claim-type" data-type="claim" aria-label="Extract as Claim">\u{1F4CB} Claim</button>
      </div>
      <div id="nac-entity-search-results"></div>
    `;
          document.body.appendChild(EntityTagger.popover);
          document.querySelectorAll(".nac-btn-entity-type").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (btn.dataset.type === "claim") {
                ClaimExtractor.showForm(text, EntityTagger.popover);
              } else {
                EntityTagger.selectType(btn.dataset.type);
              }
            });
          });
          setTimeout(() => {
            document.addEventListener("click", EntityTagger.handleOutsideClick);
          }, 100);
        },
        // Hide popover
        hide: () => {
          if (EntityTagger.popover) {
            EntityTagger.popover.remove();
            EntityTagger.popover = null;
          }
          document.removeEventListener("click", EntityTagger.handleOutsideClick);
        },
        // Handle click outside popover
        handleOutsideClick: (e) => {
          if (EntityTagger.popover && !EntityTagger.popover.contains(e.target)) {
            EntityTagger.hide();
          }
        },
        // Select entity type and search for existing
        selectType: async (type) => {
          const resultsEl = document.getElementById("nac-entity-search-results");
          resultsEl.innerHTML = '<div class="nac-spinner"></div> Searching...';
          const results = await Storage.entities.search(EntityTagger.selectedText, type);
          if (results.length > 0) {
            resultsEl.innerHTML = `
        <div class="nac-search-results">
          <div class="nac-results-header">Existing matches:</div>
          ${results.map((entity) => `
            <button class="nac-btn-link-entity" data-id="${entity.id}">
              ${Utils.escapeHtml(entity.name)} (${entity.type})
            </button>
          `).join("")}
        </div>
        <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
          Create New ${type}
        </button>
      `;
            document.querySelectorAll(".nac-btn-link-entity").forEach((btn) => {
              btn.addEventListener("click", () => EntityTagger.linkEntity(btn.dataset.id));
            });
          } else {
            resultsEl.innerHTML = `
        <div class="nac-no-results">No existing ${type}s found</div>
        <button class="nac-btn nac-btn-primary" id="nac-create-new-entity">
          Create New ${type}
        </button>
      `;
          }
          document.getElementById("nac-create-new-entity")?.addEventListener("click", () => {
            EntityTagger.createEntity(type);
          });
        },
        // Create new entity
        createEntity: async (type) => {
          try {
            const privkey = Crypto.generatePrivateKey();
            const pubkey = Crypto.getPublicKey(privkey);
            const entityId = "entity_" + await Crypto.sha256(type + EntityTagger.selectedText);
            const userIdentity = await Storage.identity.get();
            const entity = await Storage.entities.save(entityId, {
              id: entityId,
              type,
              name: EntityTagger.selectedText,
              aliases: [],
              canonical_id: null,
              keypair: {
                pubkey,
                privkey,
                npub: Crypto.hexToNpub(pubkey),
                nsec: Crypto.hexToNsec(privkey)
              },
              created_by: userIdentity?.pubkey || "unknown",
              created_at: Math.floor(Date.now() / 1e3),
              articles: [{
                url: ReaderView.article.url,
                title: ReaderView.article.title,
                context: "mentioned",
                tagged_at: Math.floor(Date.now() / 1e3)
              }],
              metadata: {}
            });
            ReaderView.entities.push({
              entity_id: entityId,
              context: "mentioned"
            });
            EntityTagger.addChip(entity);
            EntityTagger.hide();
            Utils.showToast(`Created ${type}: ${EntityTagger.selectedText}`, "success");
          } catch (e) {
            console.error("[NAC] Failed to create entity:", e);
            Utils.showToast("Failed to create entity", "error");
          }
        },
        // Link existing entity
        linkEntity: async (entityId) => {
          try {
            const entity = await Storage.entities.get(entityId);
            if (!entity.articles) entity.articles = [];
            const articleEntry = {
              url: ReaderView.article.url,
              title: ReaderView.article.title,
              context: "mentioned",
              tagged_at: Math.floor(Date.now() / 1e3)
            };
            const existingIdx = entity.articles.findIndex((a) => a.url === articleEntry.url);
            if (existingIdx >= 0) {
              entity.articles[existingIdx].tagged_at = articleEntry.tagged_at;
            } else {
              entity.articles.push(articleEntry);
            }
            await Storage.entities.save(entityId, entity);
            ReaderView.entities.push({
              entity_id: entityId,
              context: "mentioned"
            });
            EntityTagger.addChip(entity);
            EntityTagger.hide();
            Utils.showToast(`Linked entity: ${entity.name}`, "success");
            EntityAutoSuggest.removeSuggestionByEntityId(entityId);
          } catch (e) {
            console.error("[NAC] Failed to link entity:", e);
            Utils.showToast("Failed to link entity", "error");
          }
        },
        // Add entity chip to UI
        addChip: (entity) => {
          const chipsContainer = document.getElementById("nac-entity-chips");
          const chip = document.createElement("div");
          chip.className = "nac-entity-chip nac-entity-" + entity.type;
          chip.setAttribute("tabindex", "0");
          chip.setAttribute("aria-label", entity.type + ": " + entity.name);
          chip.innerHTML = `
      <span class="nac-chip-icon">${entity.type === "person" ? "\u{1F464}" : entity.type === "organization" ? "\u{1F3E2}" : entity.type === "thing" ? "\u{1F537}" : "\u{1F4CD}"}</span>
      <span class="nac-chip-name">${Utils.escapeHtml(entity.name)}</span>
      <button class="nac-chip-remove" data-id="${entity.id}" aria-label="Remove entity ${Utils.escapeHtml(entity.name)}">\xD7</button>
    `;
          chipsContainer.appendChild(chip);
          chip.querySelector(".nac-chip-remove").addEventListener("click", () => {
            chip.remove();
            ReaderView.entities = ReaderView.entities.filter((e) => e.entity_id !== entity.id);
          });
        }
      };
    }
  });

  // src/entity-migration.js
  var EntityMigration;
  var init_entity_migration = __esm({
    "src/entity-migration.js"() {
      init_storage();
      init_utils();
      init_crypto();
      EntityMigration = {
        // Migrate entity schema: convert inline aliases[] strings to separate alias entities with canonical_id
        migrateAliasesToEntities: async () => {
          const schemaVersion = await Storage.get("entity_schema_version", 1);
          if (schemaVersion >= 2) return;
          Utils.log("Running entity alias migration (v1 \u2192 v2)...");
          const registry = await Storage.entities.getAll();
          const entities = Object.values(registry);
          let created = 0;
          for (const entity of entities) {
            if (entity.canonical_id === void 0) {
              entity.canonical_id = null;
            }
            if (!entity.aliases || entity.aliases.length === 0) {
              registry[entity.id] = { ...entity, updated: Math.floor(Date.now() / 1e3) };
              continue;
            }
            for (const aliasName of entity.aliases) {
              if (!aliasName || aliasName.trim().length < 2) continue;
              const trimmedAlias = aliasName.trim();
              const privkey = Crypto.generatePrivateKey();
              const pubkey = Crypto.getPublicKey(privkey);
              const aliasEntityId = "entity_" + await Crypto.sha256(entity.type + trimmedAlias);
              if (registry[aliasEntityId]) continue;
              const userIdentity = await Storage.identity.get();
              registry[aliasEntityId] = {
                id: aliasEntityId,
                type: entity.type,
                name: trimmedAlias,
                aliases: [],
                canonical_id: entity.id,
                keypair: {
                  pubkey,
                  privkey,
                  npub: Crypto.hexToNpub(pubkey),
                  nsec: Crypto.hexToNsec(privkey)
                },
                created_by: userIdentity?.pubkey || entity.created_by || "migration",
                created_at: Math.floor(Date.now() / 1e3),
                articles: [],
                metadata: {},
                updated: Math.floor(Date.now() / 1e3)
              };
              created++;
            }
            entity.aliases = [];
            registry[entity.id] = { ...entity, updated: Math.floor(Date.now() / 1e3) };
          }
          await Storage.set("entity_registry", registry);
          await Storage.set("entity_schema_version", 2);
          if (created > 0) {
            Utils.log(`Migration complete: created ${created} alias entities`);
          } else {
            Utils.log("Migration complete: no aliases to migrate");
          }
        }
      };
    }
  });

  // src/styles.js
  var STYLES;
  var init_styles = __esm({
    "src/styles.js"() {
      STYLES = `
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
  
  /* FAB Button styles are inside Shadow DOM \u2014 see init() */
  
  /* Reader Container */
  .nac-reader-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--nac-bg);
    color: var(--nac-text);
    z-index: 2147483646;
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
  
  .nac-meta-icon {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    margin-right: 6px;
    vertical-align: middle;
    object-fit: contain;
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
    content: ' \u270F\uFE0F';
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
    cursor: pointer;
    border-bottom: 1px dashed var(--nac-border);
    padding-bottom: 1px;
  }
  
  .nac-source-url:hover {
    color: var(--nac-accent);
    border-bottom-color: var(--nac-accent);
  }
  
  .nac-source-link {
    color: var(--nac-text-muted);
    text-decoration: none;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  .nac-source-link:hover {
    color: var(--nac-accent);
    background: var(--nac-surface);
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

  /* Fix B: Don't enlarge small inline images (avatars, icons, emoji) */
  .nac-article-body img.nac-inline-img {
    max-width: none !important;
    display: inline-block !important;
    vertical-align: middle;
    border-radius: 0;
    margin: 0 4px;
  }
  
  .nac-article-body blockquote {
    border-left: 3px solid var(--nac-primary);
    padding-left: 1em;
    margin: 1em 0;
    color: var(--nac-text-muted);
  }

  .nac-article-body blockquote.twitter-tweet,
  .nac-article-body blockquote.nac-tweet-embed {
    border-left: 4px solid #1da1f2;
    padding: 12px 16px;
    margin: 1.5em 0;
    background: rgba(29, 161, 242, 0.05);
    border-radius: 0 8px 8px 0;
  }

  .nac-article-body blockquote.twitter-tweet img,
  .nac-article-body blockquote.nac-tweet-embed img {
    max-width: 48px !important;
    height: 48px !important;
    border-radius: 50%;
    display: inline-block;
  }

  .nac-article-body img[src*="twimg.com/profile"],
  .nac-article-body img[src*="pbs.twimg.com/profile_images"] {
    max-width: 48px !important;
    max-height: 48px !important;
    border-radius: 50%;
    display: inline-block;
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
    z-index: 2147483647;
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
    z-index: 2147483647;
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
  
  /* Entity Alias Styles */
  .nac-eb-card-alias {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .nac-eb-card-alias-entity {
    opacity: 0.85;
  }
  
  .nac-eb-canonical-section {
    padding: 10px;
    background: rgba(99, 102, 241, 0.06);
    border: 1px dashed var(--nac-primary);
    border-radius: 8px;
  }
  
  .nac-eb-canonical-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  
  .nac-eb-canonical-link {
    background: none;
    border: none;
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 0;
    text-decoration: underline;
  }
  
  .nac-eb-canonical-link:hover {
    color: var(--nac-primary-hover);
  }
  
  .nac-eb-remove-alias-btn {
    background: none;
    border: 1px solid var(--nac-border);
    border-radius: 4px;
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 8px;
    margin-left: auto;
  }
  
  .nac-eb-remove-alias-btn:hover {
    border-color: var(--nac-error);
    color: var(--nac-error);
  }
  
  .nac-eb-alias-entities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .nac-eb-alias-entity-link {
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    border-radius: 12px;
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 12px;
    padding: 3px 10px;
  }
  
  .nac-eb-alias-entity-link:hover {
    background: var(--nac-primary);
    color: white;
    border-color: var(--nac-primary);
  }
  
  /* Focus-visible styles for keyboard accessibility */
  /* Note: .nac-fab:focus-visible is handled inside Shadow DOM */
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

  /* Claims Bar */
  .nac-claims-bar {
    max-width: var(--reader-max-width, 680px);
    margin: 24px auto 0;
    padding-top: 20px;
    border-top: 1px solid var(--nac-border);
  }

  .nac-claims-bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .nac-claims-bar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-claims-count {
    font-weight: 700;
  }

  .nac-btn-add-claim {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px dashed var(--nac-border);
    background: transparent;
    color: var(--nac-text-muted);
    cursor: pointer;
    font-size: 13px;
  }

  .nac-btn-add-claim:hover {
    background: var(--nac-bg);
    color: var(--nac-text);
  }

  .nac-claims-chips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nac-claims-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
  }

  .nac-claim-chip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .nac-claim-chip:hover {
    border-color: var(--nac-primary);
  }

  .nac-claim-crux {
    border-color: #f59e0b;
    border-width: 2px;
    background: rgba(245, 158, 11, 0.08);
  }

  .nac-claim-crux .nac-claim-text-display {
    font-weight: 700;
  }

  .nac-claim-crux:hover {
    border-color: #d97706;
  }

  .nac-claim-text,
  .nac-claim-text-display {
    flex: 1;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: text;
  }

  .nac-claim-text-edit {
    flex: 1;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    padding: 2px 6px;
    border: 1px solid var(--nac-primary);
    border-radius: 4px;
    background: var(--nac-bg);
    outline: none;
    font-family: inherit;
  }

  .nac-claim-crux-icon {
    font-size: 12px;
  }

  .nac-claim-confidence-display {
    font-size: 11px;
    font-weight: 600;
    color: #f59e0b;
  }

  .nac-claim-crux-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .nac-claim-crux-toggle:hover {
    opacity: 1;
  }

  .nac-claim-confidence-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px 8px;
    margin-top: -4px;
  }

  .nac-claim-confidence-label {
    font-size: 12px;
    color: var(--nac-text-muted);
    white-space: nowrap;
    min-width: 100px;
  }

  .nac-claim-conf-val {
    font-weight: 600;
    color: #f59e0b;
  }

  .nac-claim-confidence-range {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--nac-border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .nac-claim-confidence-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f59e0b;
    cursor: pointer;
  }

  .nac-claim-confidence-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f59e0b;
    cursor: pointer;
    border: none;
  }

  .nac-publish-info {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 8px 12px;
    background: var(--nac-bg);
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .nac-claim-type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .nac-claim-type-factual {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .nac-claim-type-causal {
    background: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .nac-claim-type-evaluative {
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .nac-claim-type-predictive {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .nac-claim-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: var(--nac-text-muted);
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }

  .nac-claim-remove:hover {
    color: var(--nac-error);
  }

  .nac-claim-subjects {
    max-height: 100px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  .nac-claim-subjects label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--nac-text);
    cursor: pointer;
  }

  .nac-claim-subjects input[type="checkbox"] {
    margin: 0;
    flex-shrink: 0;
  }

  .nac-claim-claimant-label {
    font-size: 12px;
    font-style: italic;
    color: var(--nac-text-muted);
    white-space: nowrap;
  }

  .nac-claim-attribution-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .nac-claim-subject-emojis {
    font-size: 11px;
    flex-shrink: 0;
    letter-spacing: 1px;
  }

  .nac-claim-triple {
    width: 100%;
    font-size: 0.85em;
    color: var(--nac-text-muted);
    padding-left: 20px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-claim-triple-claimant {
    color: var(--nac-text);
  }

  .nac-claim-triple-subject {
    color: var(--nac-text);
  }

  .nac-claim-triple-predicate {
    font-style: italic;
    color: var(--nac-text-muted);
  }

  .nac-claim-triple-object {
    color: var(--nac-text);
  }

  .nac-claim-triple-date {
    color: var(--nac-text-muted);
    font-size: 0.9em;
  }

  .nac-claims-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--nac-primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    padding: 0 4px;
    margin-left: 4px;
  }

  /* Claim Form (in popover) \u2014 progressive disclosure */
  .nac-claim-form {
    min-width: 300px;
    max-width: 380px;
  }

  .nac-claim-form-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--nac-text);
  }

  .nac-claim-form-text {
    font-size: 13px;
    color: var(--nac-text-muted);
    font-style: italic;
    margin-bottom: 12px;
    padding: 8px;
    background: var(--nac-bg);
    border-radius: 6px;
    max-height: 80px;
    overflow-y: auto;
    line-height: 1.4;
  }

  .nac-claim-form-field {
    margin-bottom: 10px;
  }

  .nac-claim-form-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .nac-claim-form-row-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nac-claim-form-field label {
    font-size: 13px;
    color: var(--nac-text);
    margin-right: 4px;
  }

  .nac-claim-form-field select,
  .nac-claim-form-field input[type="date"],
  .nac-form-input {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 13px;
  }

  .nac-claim-crux-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--nac-text);
    cursor: pointer;
    white-space: nowrap;
  }

  .nac-claim-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Collapsible section headers */
  .nac-claim-section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text);
    border-bottom: 1px solid var(--nac-border);
    margin-bottom: 6px;
    user-select: none;
  }

  .nac-claim-section-header:hover {
    color: var(--nac-primary);
  }

  .nac-claim-section-header:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  .nac-claim-section-arrow {
    display: inline-block;
    width: 12px;
    text-align: center;
    font-size: 12px;
  }

  .nac-claim-section-body {
    padding-left: 16px;
    padding-bottom: 4px;
  }

  /* Sentence builder (subject-verb-object row) */
  .nac-claim-sentence-builder {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }

  .nac-claim-sentence-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
  }

  .nac-claim-sentence-slot select,
  .nac-claim-sentence-slot input {
    width: 100%;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--nac-border);
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 12px;
    box-sizing: border-box;
  }

  .nac-claim-sentence-label {
    font-size: 10px;
    color: var(--nac-text-muted);
    text-align: center;
    margin-top: 2px;
  }

  /* Claim button in popover */
  .nac-btn-claim-type {
    border-color: #f59e0b !important;
    color: #92400e;
  }

  .nac-btn-claim-type:hover {
    background: rgba(245, 158, 11, 0.1) !important;
  }

  @media (prefers-color-scheme: dark) {
    .nac-btn-claim-type {
      color: #fbbf24;
    }
  }

  .nac-claim-chip:focus-visible,
  .nac-claim-remove:focus-visible,
  .nac-claim-crux-toggle:focus-visible,
  .nac-claim-text-edit:focus-visible,
  .nac-btn-add-claim:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  .nac-claim-confidence-field label {
    font-size: 13px;
    color: var(--nac-text-muted);
  }

  /* Evidence Linking */
  .nac-evidence-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .nac-evidence-modal-content {
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .nac-evidence-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--nac-border);
  }

  .nac-evidence-modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--nac-text);
  }

  .nac-evidence-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .nac-evidence-source {
    font-size: 13px;
    color: var(--nac-text);
    background: rgba(99, 102, 241, 0.08);
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .nac-evidence-target-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text-muted);
    margin-bottom: 8px;
  }

  .nac-evidence-target-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 16px;
  }

  .nac-evidence-article-group {
    margin-bottom: 12px;
  }

  .nac-evidence-article-group:last-child {
    margin-bottom: 0;
  }

  .nac-evidence-article-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--nac-text-muted);
    padding: 4px 0;
    margin-bottom: 4px;
  }

  .nac-evidence-claim-option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text);
    line-height: 1.4;
    transition: background 0.15s;
  }

  .nac-evidence-claim-option:hover {
    background: rgba(99, 102, 241, 0.08);
  }

  .nac-evidence-claim-option input[type="radio"] {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .nac-evidence-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nac-evidence-options .nac-form-group {
    margin-bottom: 0;
  }

  .nac-evidence-options .nac-form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--nac-text-muted);
    display: block;
    margin-bottom: 4px;
  }

  .nac-evidence-modal-footer {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--nac-border);
    justify-content: flex-end;
  }

  .nac-evidence-link-indicator {
    font-size: 11px;
    background: rgba(99, 102, 241, 0.12);
    color: var(--nac-primary);
    padding: 2px 6px;
    border-radius: 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .nac-evidence-link-indicator:hover {
    background: rgba(99, 102, 241, 0.25);
  }

  .nac-claim-link-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    opacity: 0.5;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .nac-claim-link-btn:hover {
    opacity: 1;
  }

  .nac-evidence-tooltip {
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    font-size: 12px;
    color: var(--nac-text);
    z-index: 2147483647;
  }

  .nac-evidence-tooltip-title {
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 13px;
  }

  .nac-evidence-tooltip-item {
    padding: 3px 0;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nac-evidence-rel-supports {
    color: #22c55e;
  }

  .nac-evidence-rel-contradicts {
    color: #ef4444;
  }

  .nac-evidence-rel-contextualizes {
    color: #3b82f6;
  }

  .nac-evidence-delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--nac-text-muted);
    padding: 0 4px;
    margin-left: auto;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .nac-evidence-delete-btn:hover {
    opacity: 1;
    color: var(--nac-error);
  }

  .nac-form-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--nac-border);
    border-radius: 6px;
    background: var(--nac-surface);
    color: var(--nac-text);
    font-size: 13px;
    box-sizing: border-box;
  }

  .nac-form-input:focus {
    outline: 2px solid var(--nac-primary);
    outline-offset: -1px;
  }

  .nac-claim-link-btn:focus-visible,
  .nac-evidence-link-indicator:focus-visible,
  .nac-evidence-delete-btn:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  /* Remote Claims Section */
  .nac-remote-claims-section {
    margin-top: 16px;
    padding: 16px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
    border-radius: 8px;
  }

  .nac-remote-claims-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .nac-remote-claims-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-remote-claims-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: var(--nac-text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
  }

  .nac-remote-claims-close:hover {
    color: var(--nac-error);
    background: rgba(239, 68, 68, 0.1);
  }

  .nac-remote-claims-loading {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    display: flex;
    align-items: center;
  }

  .nac-remote-claims-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    text-align: center;
    font-style: italic;
  }

  .nac-remote-claims-group {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--nac-border);
  }

  .nac-remote-claims-group:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .nac-remote-npub {
    font-size: 12px;
    font-weight: 600;
    color: var(--nac-primary);
    font-family: monospace;
    margin-bottom: 8px;
    padding: 4px 8px;
    background: rgba(99, 102, 241, 0.06);
    border-radius: 6px;
    display: inline-block;
  }

  .nac-remote-claim-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--nac-text);
  }

  .nac-remote-claim-chip.nac-claim-crux {
    border-color: #f59e0b;
    border-width: 2px;
    background: rgba(245, 158, 11, 0.08);
  }

  .nac-remote-claim-chip.nac-claim-crux .nac-remote-claim-text {
    font-weight: 700;
  }

  .nac-remote-claim-text {
    flex: 1;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nac-btn-remote-claims {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--nac-primary);
    background: rgba(99, 102, 241, 0.08);
    color: var(--nac-primary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .nac-btn-remote-claims:hover {
    background: rgba(99, 102, 241, 0.18);
  }

  .nac-claims-bar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .nac-remote-claims-close:focus-visible,
  .nac-btn-remote-claims:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  /* ==========================================
     MOBILE RESPONSIVE STYLES
     ========================================== */
  @media (max-width: 768px) {
    /* Reader View \u2014 Mobile Layout */
    .nac-reader-container {
      padding: 0 !important;
    }
    .nac-reader-content {
      max-width: 100% !important;
      padding: 12px !important;
      margin: 0 !important;
    }
    .nac-article-title {
      font-size: 1.5em !important;
    }
    .nac-article-body {
      font-size: 1em !important;
      line-height: 1.6 !important;
    }

    /* Toolbar \u2014 Mobile Responsive */
    .nac-toolbar {
      flex-wrap: wrap !important;
      gap: 4px !important;
      padding: 8px !important;
    }
    .nac-toolbar button,
    .nac-btn-toolbar {
      font-size: 12px !important;
      padding: 6px 8px !important;
      min-height: 36px !important;
    }

    /* Entity/Claims Bars \u2014 Horizontal Scroll */
    .nac-entity-bar,
    .nac-claims-bar {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      flex-wrap: nowrap !important;
    }
    .nac-entity-chip,
    .nac-claim-chip {
      flex-shrink: 0 !important;
      font-size: 12px !important;
    }

    /* Entity Tagger Popover \u2014 Bottom Sheet */
    .nac-entity-popover {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      top: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      border-radius: 12px 12px 0 0 !important;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3) !important;
    }
    .nac-btn-entity-type,
    .nac-btn-claim-type {
      min-height: 44px !important;
      font-size: 14px !important;
    }

    /* Claim Extraction Form \u2014 Stacked Layout */
    .nac-claim-sentence-builder {
      flex-direction: column !important;
      gap: 8px !important;
    }
    .nac-claim-sentence-slot {
      width: 100% !important;
    }
    .nac-claim-form select,
    .nac-claim-form input {
      font-size: 16px !important;
      min-height: 40px !important;
    }

    /* Settings / Publish Panels \u2014 Full Screen */
    .nac-settings-panel,
    .nac-publish-panel {
      width: 100% !important;
      max-width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      border-radius: 0 !important;
      margin: 0 !important;
    }

    /* Evidence Modal \u2014 Bottom Sheet */
    .nac-evidence-modal {
      width: 100% !important;
      max-width: 100% !important;
      height: 80vh !important;
      bottom: 0 !important;
      top: auto !important;
      left: 0 !important;
      border-radius: 12px 12px 0 0 !important;
    }

    /* Touch-Friendly Targets */
    button,
    [role="button"],
    .nac-editable-field,
    input[type="checkbox"],
    select {
      min-height: 44px !important;
      min-width: 44px !important;
    }

    /* Metadata Header \u2014 Stack Vertically */
    .nac-meta-info {
      flex-direction: column !important;
      gap: 4px !important;
    }
    .nac-meta-separator {
      display: none !important;
    }

    /* Remote Claims Section \u2014 Compact */
    .nac-remote-claims-section {
      max-height: 40vh !important;
    }
    .nac-remote-claim-chip {
      font-size: 12px !important;
    }
  }

  /* ===== Phase 1: Enhanced Metadata Display ===== */

  /* Word count / reading time line */
  .nac-meta-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--nac-text-muted);
    margin-top: 6px;
  }

  .nac-meta-modified {
    font-style: italic;
  }

  .nac-meta-lang {
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--nac-bg);
    border: 1px solid var(--nac-border);
  }

  /* Section / category badge */
  .nac-meta-section-row {
    margin-top: 8px;
  }

  .nac-meta-section-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.1);
    color: var(--nac-primary);
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  /* Keyword tag pills */
  .nac-meta-keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }

  .nac-meta-keyword-pill {
    display: inline-block;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: var(--nac-bg);
    color: var(--nac-text-muted);
    border: 1px solid var(--nac-border);
    white-space: nowrap;
  }

  /* Paywall indicator */
  .nac-meta-paywall {
    font-size: 14px;
    margin-left: 4px;
    cursor: help;
  }

  @media (max-width: 768px) {
    .nac-meta-stats {
      font-size: 12px;
    }
    .nac-meta-section-badge {
      font-size: 11px;
    }
    .nac-meta-keyword-pill {
      font-size: 10px;
    }
  }

  /* Content Type Detection (Phase 2) */
  .nac-meta-detection-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
    margin-bottom: 4px;
  }

  .nac-meta-content-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    background: rgba(99, 102, 241, 0.1);
    color: var(--nac-primary);
  }

  .nac-meta-comments-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    cursor: pointer;
  }

  .nac-meta-comments-indicator:hover {
    background: rgba(34, 197, 94, 0.18);
  }

  /* ===== Comments Section (Phase 3) ===== */

  .nac-comments-section {
    max-width: var(--reader-max-width, 680px);
    margin: 24px auto 0;
    padding-top: 20px;
    border-top: 1px solid var(--nac-border);
  }

  .nac-comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--nac-text-muted);
  }

  .nac-comments-list {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nac-comment-item {
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--nac-surface);
    border: 1px solid var(--nac-border);
    transition: border-color 0.2s;
  }

  .nac-comment-item:hover {
    border-color: var(--nac-primary);
  }

  .nac-comment-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--nac-text-muted);
  }

  .nac-comment-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .nac-comment-author {
    font-weight: 600;
    color: var(--nac-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .nac-comment-platform {
    font-size: 11px;
    color: var(--nac-text-muted);
    opacity: 0.7;
  }

  .nac-comment-time {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-left: auto;
  }

  .nac-comment-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--nac-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .nac-comment-reply-indicator {
    font-size: 11px;
    color: var(--nac-text-muted);
    margin-top: 4px;
  }

  .nac-comments-empty {
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 12px 0;
    text-align: center;
    font-style: italic;
  }

  .nac-btn-capture-comments {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #22c55e;
    background: rgba(34, 197, 94, 0.08);
    color: #22c55e;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .nac-btn-capture-comments:hover {
    background: rgba(34, 197, 94, 0.18);
  }

  .nac-btn-capture-comments:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nac-comments-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--nac-text-muted);
    padding: 0;
  }

  .nac-comments-toggle:hover {
    color: var(--nac-text);
  }

  .nac-btn-capture-comments:focus-visible,
  .nac-comments-toggle:focus-visible {
    outline: 2px solid var(--nac-primary);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .nac-comments-list {
      max-height: 300px;
    }
    .nac-comment-item {
      padding: 8px 10px;
    }
    .nac-comment-text {
      font-size: 12px;
    }
  }
`;
    }
  });

  // src/init.js
  async function init() {
    Utils.log("Initializing NOSTR Article Capture v" + CONFIG.version);
    Storage.checkGMAvailability();
    try {
      await EntityMigration.migrateAliasesToEntities();
    } catch (e) {
      console.error("[NAC] Entity migration failed:", e);
    }
    GM_addStyle(STYLES);
    const fabHost = document.createElement("div");
    fabHost.id = "nac-fab-host";
    document.body.appendChild(fabHost);
    const fabShadow = fabHost.attachShadow({ mode: "closed" });
    const fabStyle = document.createElement("style");
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
    const fab = document.createElement("button");
    fab.className = "nac-fab";
    fab.innerHTML = "\u{1F4F0}";
    fab.title = "NOSTR Article Capture";
    fab.setAttribute("aria-label", "Capture Article");
    fab.addEventListener("click", async () => {
      Utils.log("FAB clicked");
      const detection = ContentDetector.detect();
      Utils.log("Content detected:", detection);
      const article = ContentExtractor.extractArticle();
      if (!article) {
        Utils.showToast("No article content found on this page", "error");
        return;
      }
      article.contentType = detection.type;
      article.platform = detection.platform;
      article.platformMetadata = detection.metadata;
      article.contentConfidence = detection.confidence;
      article.hasComments = ContentDetector.hasComments();
      await ReaderView.show(article);
    });
    fabShadow.appendChild(fab);
    _state.nacFabRef = fab;
    setInterval(() => {
      if (!document.body.contains(fabHost)) {
        document.body.appendChild(fabHost);
      }
      fabHost.style.setProperty("display", "block", "important");
      fabHost.style.setProperty("visibility", "visible", "important");
      fabHost.style.setProperty("opacity", "1", "important");
      fabHost.style.setProperty("pointer-events", "none", "important");
    }, 3e3);
    GM_registerMenuCommand("Open Settings", async () => {
      const article = ContentExtractor.extractArticle() || { url: window.location.href };
      await ReaderView.show(article);
      await ReaderView.showSettings();
    });
    GM_registerMenuCommand("Export Entities", async () => {
      const json = await Storage.entities.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nostr-entities-" + Date.now() + ".json";
      a.click();
      Utils.showToast("Entities exported");
    });
    Utils.log("Initialization complete");
  }
  var init_init = __esm({
    "src/init.js"() {
      init_config();
      init_storage();
      init_utils();
      init_content_extractor();
      init_content_detector();
      init_reader_view();
      init_entity_migration();
      init_styles();
    }
  });

  // src/index.js
  var require_index = __commonJS({
    "src/index.js"() {
      init_config();
      init_crypto();
      init_storage();
      init_content_extractor();
      init_content_detector();
      init_platform_handler();
      init_utils();
      init_entity_tagger();
      init_entity_auto_suggest();
      init_claim_extractor();
      init_evidence_linker();
      init_platform_account();
      init_comment_extractor();
      init_relay_client();
      init_event_builder();
      init_entity_sync();
      init_entity_browser();
      init_reader_view();
      init_entity_migration();
      init_styles();
      init_init();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }
  });
  require_index();
})();
