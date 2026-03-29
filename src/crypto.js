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

export const Crypto = {
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
