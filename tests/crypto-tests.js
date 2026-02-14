#!/usr/bin/env node
// ================================================================
// Crypto Module Tests for nostr-article-capture.user.js
// ================================================================
// Standalone Node.js test suite — zero external dependencies.
// Run:  node tests/crypto-tests.js
// ================================================================

'use strict';

// ----------------------------------------------------------------
// Node.js polyfills for browser APIs used by the crypto module
// ----------------------------------------------------------------
const nodeCrypto = require('crypto');

// Polyfill crypto.subtle.digest (SHA-256 only, which is all we need)
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
if (!globalThis.crypto.subtle) {
  globalThis.crypto.subtle = {
    digest: async (algorithm, data) => {
      const alg = algorithm.replace('-', '').toLowerCase(); // 'SHA-256' → 'sha256'
      const hash = nodeCrypto.createHash(alg);
      hash.update(Buffer.from(data));
      return hash.digest().buffer;
    }
  };
}
if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = (arr) => {
    const bytes = nodeCrypto.randomBytes(arr.length);
    arr.set(bytes);
    return arr;
  };
}

// TextEncoder / TextDecoder are global in Node 11+, but just in case:
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// ================================================================
// EXTRACTED CRYPTO PRIMITIVES (copied verbatim from userscript)
// ================================================================

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
  hexToBytes: (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  },

  bytesToHex: (bytes) => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  generatePrivateKey: () => {
    const privateKeyArray = new Uint8Array(32);
    crypto.getRandomValues(privateKeyArray);
    return Crypto.bytesToHex(privateKeyArray);
  },

  getPublicKey: (privkeyHex) => {
    const privkey = BigInt('0x' + privkeyHex);
    if (privkey <= 0n || privkey >= _SECP256K1.N) {
      throw new Error('Invalid private key: out of range');
    }
    const point = _pointMultiply(privkey);
    if (!point) throw new Error('Invalid public key: point at infinity');
    return point[0].toString(16).padStart(64, '0');
  },

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

  signEvent: async (event, privkeyHex) => {
    try {
      const hash = await Crypto.getEventHash(event);
      event.id = hash;

      const d = BigInt('0x' + privkeyHex);
      const P = _pointMultiply(d);
      if (!P) throw new Error('Invalid private key');

      const dAdj = P[1] % 2n === 0n ? d : _SECP256K1.N - d;

      const dBytes = Crypto.hexToBytes(dAdj.toString(16).padStart(64, '0'));
      const pxBytes = Crypto.hexToBytes(P[0].toString(16).padStart(64, '0'));
      const msgBytes = Crypto.hexToBytes(hash);

      const nonceHash = await Crypto.taggedHash('BIP0340/nonce', dBytes, pxBytes, msgBytes);
      const k0 = BigInt('0x' + Crypto.bytesToHex(nonceHash)) % _SECP256K1.N;
      if (k0 === 0n) throw new Error('Invalid nonce');

      const R = _pointMultiply(k0);
      if (!R) throw new Error('Invalid nonce point');
      const k = R[1] % 2n === 0n ? k0 : _SECP256K1.N - k0;

      const rxBytes = Crypto.hexToBytes(R[0].toString(16).padStart(64, '0'));
      const eHash = await Crypto.taggedHash('BIP0340/challenge', rxBytes, pxBytes, msgBytes);
      const e = BigInt('0x' + Crypto.bytesToHex(eHash)) % _SECP256K1.N;

      const s = _mod(k + e * dAdj, _SECP256K1.N);

      const sig = R[0].toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0');

      event.sig = sig;
      return event;
    } catch (e) {
      console.error('[NAC Crypto] Failed to sign event:', e);
      return null;
    }
  },

  verifySignature: async (event) => {
    try {
      const hash = await Crypto.getEventHash(event);
      if (hash !== event.id) return false;

      const sig = event.sig;
      if (!sig || sig.length !== 128) return false;
      const rx = BigInt('0x' + sig.substring(0, 64));
      const s = BigInt('0x' + sig.substring(64, 128));
      const px = BigInt('0x' + event.pubkey);

      if (rx >= _SECP256K1.P || s >= _SECP256K1.N) return false;

      const pySquared = _mod(px * px * px + 7n);
      const py = _modPow(pySquared, (_SECP256K1.P + 1n) / 4n, _SECP256K1.P);
      if (_mod(py * py) !== pySquared) return false;
      const P = [px, py % 2n === 0n ? py : _SECP256K1.P - py];

      const rxBytes = Crypto.hexToBytes(rx.toString(16).padStart(64, '0'));
      const pxBytes = Crypto.hexToBytes(event.pubkey.padStart(64, '0'));
      const msgBytes = Crypto.hexToBytes(hash);
      const eHash = await Crypto.taggedHash('BIP0340/challenge', rxBytes, pxBytes, msgBytes);
      const e = BigInt('0x' + Crypto.bytesToHex(eHash)) % _SECP256K1.N;

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

  sha256: async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Crypto.bytesToHex(new Uint8Array(hashBuffer));
  },

  liftX: (pubkeyHex) => {
    const p = _SECP256K1.P;
    const x = BigInt('0x' + pubkeyHex);
    const c = _mod((_mod(x * x) * x + 7n), p);
    const y = _modPow(c, (p + 1n) / 4n, p);
    return [x, _mod(y) % 2n === 0n ? y : p - y];
  },

  getSharedSecret: async (privkeyHex, pubkeyHex) => {
    const point = Crypto.liftX(pubkeyHex);
    const privkey = BigInt('0x' + privkeyHex);
    const result = _pointMultiply(privkey, point);
    return result[0].toString(16).padStart(64, '0');
  }
};

// ================================================================
// SIMPLE TEST RUNNER
// ================================================================

let _passed = 0;
let _failed = 0;
let _errors = [];

function assert(condition, message) {
  if (condition) {
    _passed++;
    console.log(`  ✅ ${message}`);
  } else {
    _failed++;
    _errors.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    _passed++;
    console.log(`  ✅ ${message}`);
  } else {
    _failed++;
    const detail = `${message}\n       expected: ${expected}\n       actual:   ${actual}`;
    _errors.push(detail);
    console.log(`  ❌ ${detail}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ================================================================
// TEST CASES
// ================================================================

async function runTests() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   nostr-article-capture  —  Crypto Module Tests ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // ----------------------------------------------------------
  // 1. Key Generation
  // ----------------------------------------------------------
  section('1. Key Generation');

  const privkey = Crypto.generatePrivateKey();
  assertEqual(privkey.length, 64, 'Private key is 64 hex chars');
  assert(/^[0-9a-f]{64}$/.test(privkey), 'Private key is valid lowercase hex');

  const pubkey = Crypto.getPublicKey(privkey);
  assertEqual(pubkey.length, 64, 'Public key is 64 hex chars');
  assert(/^[0-9a-f]{64}$/.test(pubkey), 'Public key is valid lowercase hex');

  // Verify deterministic derivation
  const pubkey2 = Crypto.getPublicKey(privkey);
  assertEqual(pubkey, pubkey2, 'Same private key produces same public key');

  // Different keys produce different pubkeys
  const privkey2 = Crypto.generatePrivateKey();
  const pubkey3 = Crypto.getPublicKey(privkey2);
  assert(pubkey !== pubkey3, 'Different private keys produce different public keys');

  // ----------------------------------------------------------
  // 2. Public Key Derivation (BIP-340 test vectors)
  // ----------------------------------------------------------
  section('2. Public Key Derivation — BIP-340 Test Vectors');

  // Vector 1: private key = 1  →  pubkey = G.x
  const tv1_priv = '0000000000000000000000000000000000000000000000000000000000000001';
  const tv1_expected = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const tv1_pub = Crypto.getPublicKey(tv1_priv);
  assertEqual(tv1_pub, tv1_expected, 'privkey=1 → pubkey equals G.x');

  // Vector 2: private key = 3
  const tv2_priv = '0000000000000000000000000000000000000000000000000000000000000003';
  const tv2_expected = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
  const tv2_pub = Crypto.getPublicKey(tv2_priv);
  assertEqual(tv2_pub, tv2_expected, 'privkey=3 → expected x-only pubkey');

  // Vector 3: private key = 2
  const tv3_priv = '0000000000000000000000000000000000000000000000000000000000000002';
  const tv3_expected = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
  const tv3_pub = Crypto.getPublicKey(tv3_priv);
  assertEqual(tv3_pub, tv3_expected, 'privkey=2 → expected x-only pubkey');

  // Edge case: private key = 0 should throw
  let threw = false;
  try {
    Crypto.getPublicKey('0000000000000000000000000000000000000000000000000000000000000000');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'privkey=0 throws an error (out of range)');

  // ----------------------------------------------------------
  // 3. Bech32 npub/nsec Encoding
  // ----------------------------------------------------------
  section('3. Bech32 npub/nsec Encoding');

  const testHexPub = tv1_expected; // G.x
  const npub = Crypto.hexToNpub(testHexPub);
  assert(npub !== null, 'hexToNpub returns a value');
  assert(npub.startsWith('npub1'), 'npub starts with "npub1"');

  const testHexPriv = tv1_priv;
  const nsec = Crypto.hexToNsec(testHexPriv);
  assert(nsec !== null, 'hexToNsec returns a value');
  assert(nsec.startsWith('nsec1'), 'nsec starts with "nsec1"');

  // Round-trip: hex → npub → hex
  const roundtripPub = Crypto.npubToHex(npub);
  assertEqual(roundtripPub, testHexPub, 'Round-trip hex → npub → hex matches');

  // Round-trip: hex → nsec → hex
  const roundtripPriv = Crypto.nsecToHex(nsec);
  assertEqual(roundtripPriv, testHexPriv, 'Round-trip hex → nsec → hex matches');

  // Test with another key (privkey=3)
  const npub2 = Crypto.hexToNpub(tv2_expected);
  assert(npub2.startsWith('npub1'), 'npub for tv2 starts with "npub1"');
  const roundtrip2 = Crypto.npubToHex(npub2);
  assertEqual(roundtrip2, tv2_expected, 'Round-trip hex → npub → hex matches for tv2');

  // ----------------------------------------------------------
  // 4. Bech32 Decoding (incl. error cases)
  // ----------------------------------------------------------
  section('4. Bech32 Decoding');

  // Decode known npub
  const decodedPub = Crypto.npubToHex(npub);
  assertEqual(decodedPub, testHexPub, 'Decode known npub back to hex');

  // Decode known nsec
  const decodedPriv = Crypto.nsecToHex(nsec);
  assertEqual(decodedPriv, testHexPriv, 'Decode known nsec back to hex');

  // Invalid input: wrong prefix
  const badNpub = Crypto.npubToHex('nsec1' + npub.slice(5));
  assertEqual(badNpub, null, 'npubToHex rejects nsec prefix → null');

  const badNsec = Crypto.nsecToHex('npub1' + nsec.slice(5));
  assertEqual(badNsec, null, 'nsecToHex rejects npub prefix → null');

  // Invalid input: garbled string
  const garbled = Crypto.npubToHex('npub1invalidcharsxxxxxxxxxxxxxxxxx');
  assertEqual(garbled, null, 'npubToHex rejects garbled input → null');

  // Invalid input: empty string
  const empty = Crypto.npubToHex('');
  assertEqual(empty, null, 'npubToHex rejects empty string → null');

  // Invalid input: too short
  const tooShort = Crypto.npubToHex('npub1abc');
  assertEqual(tooShort, null, 'npubToHex rejects too-short input → null');

  // ----------------------------------------------------------
  // 5. Event Hash (NIP-01 Compliance)
  // ----------------------------------------------------------
  section('5. Event Hash — NIP-01 Compliance');

  // Construct a deterministic test event
  const testEvent = {
    pubkey: tv1_expected,
    created_at: 1234567890,
    kind: 1,
    tags: [],
    content: 'Hello, Nostr!'
  };

  // The NIP-01 serialized array is:
  //   [0, pubkey, created_at, kind, tags, content]
  const serialized = JSON.stringify([
    0,
    testEvent.pubkey,
    testEvent.created_at,
    testEvent.kind,
    testEvent.tags,
    testEvent.content
  ]);
  // Compute expected hash with Node crypto
  const expectedHash = nodeCrypto
    .createHash('sha256')
    .update(Buffer.from(serialized, 'utf-8'))
    .digest('hex');

  const computedHash = await Crypto.getEventHash(testEvent);
  assertEqual(computedHash, expectedHash, 'Event hash matches SHA-256 of NIP-01 serialized array');

  // Verify hash is 64 hex chars
  assertEqual(computedHash.length, 64, 'Event hash is 64 hex chars');
  assert(/^[0-9a-f]{64}$/.test(computedHash), 'Event hash is valid lowercase hex');

  // Test with tags
  const testEvent2 = {
    pubkey: tv2_expected,
    created_at: 1700000000,
    kind: 30023,
    tags: [['d', 'test-slug'], ['title', 'Test Article'], ['t', 'nostr']],
    content: 'This is a **long-form** article.'
  };
  const serialized2 = JSON.stringify([
    0,
    testEvent2.pubkey,
    testEvent2.created_at,
    testEvent2.kind,
    testEvent2.tags,
    testEvent2.content
  ]);
  const expectedHash2 = nodeCrypto
    .createHash('sha256')
    .update(Buffer.from(serialized2, 'utf-8'))
    .digest('hex');
  const computedHash2 = await Crypto.getEventHash(testEvent2);
  assertEqual(computedHash2, expectedHash2, 'Event hash with tags matches expected NIP-01 hash');

  // ----------------------------------------------------------
  // 6. Event Signing & Verification
  // ----------------------------------------------------------
  section('6. Event Signing & Verification');

  // Sign a kind-1 note with a known private key
  const signingKey = '0000000000000000000000000000000000000000000000000000000000000003';
  const signingPubkey = Crypto.getPublicKey(signingKey);

  const noteEvent = {
    pubkey: signingPubkey,
    created_at: 1234567890,
    kind: 1,
    tags: [],
    content: 'Test note for signing'
  };

  const signedEvent = await Crypto.signEvent({ ...noteEvent }, signingKey);
  assert(signedEvent !== null, 'signEvent returns a non-null event');
  assertEqual(typeof signedEvent.sig, 'string', 'Signed event has a sig field');
  assertEqual(signedEvent.sig.length, 128, 'Signature is 128 hex chars (64 bytes)');
  assert(/^[0-9a-f]{128}$/.test(signedEvent.sig), 'Signature is valid lowercase hex');

  // Verify the event id was set
  assert(typeof signedEvent.id === 'string' && signedEvent.id.length === 64,
    'Signed event has a 64-char id field');

  // Verify the id matches the NIP-01 hash
  const recomputedHash = await Crypto.getEventHash(noteEvent);
  assertEqual(signedEvent.id, recomputedHash, 'Event id matches recomputed NIP-01 hash');

  // Verify the signature
  const isValid = await Crypto.verifySignature(signedEvent);
  assert(isValid === true, 'Signature verification passes for correctly signed event');

  // Verify fails with tampered content
  const tamperedEvent = { ...signedEvent, content: 'TAMPERED' };
  const isTamperedValid = await Crypto.verifySignature(tamperedEvent);
  assert(isTamperedValid === false, 'Verification fails for tampered content');

  // Verify fails with tampered signature
  const badSigEvent = { ...signedEvent };
  // Flip a character in the signature
  badSigEvent.sig = 'ff' + signedEvent.sig.slice(2);
  const isBadSigValid = await Crypto.verifySignature(badSigEvent);
  assert(isBadSigValid === false, 'Verification fails for tampered signature');

  // Sign with privkey=1 (different key)
  const noteEvent2 = {
    pubkey: tv1_expected,
    created_at: 1700000000,
    kind: 1,
    tags: [['e', 'abc123']],
    content: 'Another test note'
  };
  const signedEvent2 = await Crypto.signEvent({ ...noteEvent2 }, tv1_priv);
  assert(signedEvent2 !== null, 'signEvent with privkey=1 returns non-null');
  const isValid2 = await Crypto.verifySignature(signedEvent2);
  assert(isValid2 === true, 'Signature verification passes for privkey=1 signed event');

  // Verify wrong pubkey fails
  const wrongPubkeyEvent = { ...signedEvent2, pubkey: signingPubkey };
  const isWrongPubkeyValid = await Crypto.verifySignature(wrongPubkeyEvent);
  assert(isWrongPubkeyValid === false, 'Verification fails with wrong pubkey');

  // ----------------------------------------------------------
  // 7. SHA-256 Utility
  // ----------------------------------------------------------
  section('7. SHA-256 Utility');

  const sha256Empty = await Crypto.sha256('');
  assertEqual(sha256Empty, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'SHA-256 of empty string matches known hash');

  const sha256Hello = await Crypto.sha256('Hello, World!');
  const expectedSha256Hello = nodeCrypto
    .createHash('sha256')
    .update('Hello, World!')
    .digest('hex');
  assertEqual(sha256Hello, expectedSha256Hello, 'SHA-256 of "Hello, World!" matches Node crypto');

  // ----------------------------------------------------------
  // 8. hexToBytes / bytesToHex Round-trip
  // ----------------------------------------------------------
  section('8. hexToBytes / bytesToHex Round-trip');

  const hexSample = 'deadbeef0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c';
  const bytes = Crypto.hexToBytes(hexSample);
  assertEqual(bytes.length, 32, 'hexToBytes produces correct byte count');
  assertEqual(bytes[0], 0xde, 'First byte is 0xde');
  assertEqual(bytes[1], 0xad, 'Second byte is 0xad');

  const backToHex = Crypto.bytesToHex(bytes);
  assertEqual(backToHex, hexSample, 'bytesToHex round-trip matches original');

  // Edge: all zeros
  const zeroHex = '0000000000000000000000000000000000000000000000000000000000000000';
  const zeroBytes = Crypto.hexToBytes(zeroHex);
  assert(zeroBytes.every(b => b === 0), 'All-zero hex produces all-zero bytes');
  assertEqual(Crypto.bytesToHex(zeroBytes), zeroHex, 'All-zero round-trip');

  // Edge: all 0xff
  const ffHex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const ffBytes = Crypto.hexToBytes(ffHex);
  assert(ffBytes.every(b => b === 0xff), 'All-ff hex produces all-0xff bytes');
  assertEqual(Crypto.bytesToHex(ffBytes), ffHex, 'All-ff round-trip');

  // ----------------------------------------------------------
  // 9. liftX (recover even-y point from x-only pubkey)
  // ----------------------------------------------------------
  section('9. liftX — Point Recovery');

  // liftX of G.x should return the generator point with even y
  const liftedG = Crypto.liftX(tv1_expected);
  assertEqual(liftedG[0], _SECP256K1.Gx, 'liftX(G.x) returns correct x-coordinate');
  assert(liftedG[1] % 2n === 0n, 'liftX returns even y-coordinate');
  // The generator point G has Gy which is even in standard secp256k1
  // Verify the y² = x³ + 7 (mod P) relationship
  const ySquared = _mod(liftedG[1] * liftedG[1]);
  const xCubedPlus7 = _mod(liftedG[0] * liftedG[0] * liftedG[0] + 7n);
  assertEqual(ySquared, xCubedPlus7, 'liftX result satisfies y² = x³ + 7 (mod P)');

  // ----------------------------------------------------------
  // 10. ECDH Shared Secret
  // ----------------------------------------------------------
  section('10. ECDH Shared Secret');

  // Shared secret between key A and key B should be symmetric
  const keyA_priv = '0000000000000000000000000000000000000000000000000000000000000002';
  const keyA_pub = Crypto.getPublicKey(keyA_priv);
  const keyB_priv = '0000000000000000000000000000000000000000000000000000000000000003';
  const keyB_pub = Crypto.getPublicKey(keyB_priv);

  const secretAB = await Crypto.getSharedSecret(keyA_priv, keyB_pub);
  const secretBA = await Crypto.getSharedSecret(keyB_priv, keyA_pub);
  assertEqual(secretAB, secretBA, 'ECDH shared secret is symmetric: A·B.pub == B·A.pub');
  assertEqual(secretAB.length, 64, 'Shared secret is 64 hex chars (32 bytes)');
  assert(/^[0-9a-f]{64}$/.test(secretAB), 'Shared secret is valid lowercase hex');

  // Self-shared-secret (privkey with its own pubkey) — useful for self-encryption
  const selfSecret = await Crypto.getSharedSecret(keyA_priv, keyA_pub);
  assertEqual(selfSecret.length, 64, 'Self-shared-secret is 64 hex chars');

  // ----------------------------------------------------------
  // 11. Deterministic Signing (same event → same signature)
  // ----------------------------------------------------------
  section('11. Deterministic Signing');

  const detEvent1 = {
    pubkey: signingPubkey,
    created_at: 1234567890,
    kind: 1,
    tags: [],
    content: 'Deterministic test'
  };
  const detEvent2 = {
    pubkey: signingPubkey,
    created_at: 1234567890,
    kind: 1,
    tags: [],
    content: 'Deterministic test'
  };

  const signed1 = await Crypto.signEvent(detEvent1, signingKey);
  const signed2 = await Crypto.signEvent(detEvent2, signingKey);
  assertEqual(signed1.sig, signed2.sig,
    'Signing identical events produces identical signatures (deterministic nonce)');

  // ----------------------------------------------------------
  // 12. Tagged Hash (BIP-340)
  // ----------------------------------------------------------
  section('12. Tagged Hash — BIP-340');

  // taggedHash("BIP0340/challenge", data) should produce a 32-byte hash
  const sampleData = Crypto.hexToBytes('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20');
  const th = await Crypto.taggedHash('BIP0340/challenge', sampleData);
  assertEqual(th.length, 32, 'taggedHash output is 32 bytes');
  assert(th instanceof Uint8Array, 'taggedHash returns Uint8Array');

  // Verify the tagged hash matches manual computation:
  // SHA256(SHA256("BIP0340/challenge") || SHA256("BIP0340/challenge") || data)
  const tagStr = 'BIP0340/challenge';
  const tagDigest = nodeCrypto.createHash('sha256').update(tagStr).digest();
  const manualBuf = Buffer.concat([tagDigest, tagDigest, Buffer.from(sampleData)]);
  const manualHash = nodeCrypto.createHash('sha256').update(manualBuf).digest();
  assertEqual(Crypto.bytesToHex(th), manualHash.toString('hex'),
    'taggedHash matches manual SHA256(tag_hash||tag_hash||msg) computation');

  // ----------------------------------------------------------
  // 13. Edge Cases & Error Handling
  // ----------------------------------------------------------
  section('13. Edge Cases & Error Handling');

  // verifySignature with missing sig
  const noSigEvent = { id: 'abc', pubkey: tv1_expected, content: '', kind: 1, created_at: 0, tags: [] };
  const noSigResult = await Crypto.verifySignature(noSigEvent);
  assert(noSigResult === false, 'verifySignature returns false when sig is missing');

  // verifySignature with wrong-length sig
  const shortSigEvent = { ...signedEvent, sig: 'aabb' };
  const shortSigResult = await Crypto.verifySignature(shortSigEvent);
  assert(shortSigResult === false, 'verifySignature returns false for short signature');

  // getPublicKey with N (curve order) should throw
  let threwN = false;
  try {
    Crypto.getPublicKey('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
  } catch (e) {
    threwN = true;
  }
  assert(threwN, 'getPublicKey(N) throws (key must be < N)');

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Total: ${_passed + _failed}   Passed: ${_passed}   Failed: ${_failed}`);
  if (_failed > 0) {
    console.log('\n  Failures:');
    _errors.forEach((err, i) => console.log(`    ${i + 1}. ${err}`));
  }
  console.log('══════════════════════════════════════════════════\n');

  process.exit(_failed > 0 ? 1 : 0);
}

// Run
runTests().catch(err => {
  console.error('FATAL: Test runner crashed:', err);
  process.exit(2);
});
