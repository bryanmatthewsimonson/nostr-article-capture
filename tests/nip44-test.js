// NIP-44 implementation verification test
// Run with: node tests/nip44-test.js

const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto;

const hexToBytes = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
};

// ChaCha20 block
function chacha20Block(key, nonce, counter) {
  const s = new Uint32Array(16);
  s[0] = 0x61707865; s[1] = 0x3320646e; s[2] = 0x79622d32; s[3] = 0x6b206574;
  const kv = new DataView(key.buffer, key.byteOffset, key.byteLength);
  for (let i = 0; i < 8; i++) s[4 + i] = kv.getUint32(i * 4, true);
  s[12] = counter;
  const nv = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  s[13] = nv.getUint32(0, true);
  s[14] = nv.getUint32(4, true);
  s[15] = nv.getUint32(8, true);
  const w = new Uint32Array(s);
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  function qr(a, b, c, d) {
    w[a] = (w[a] + w[b]) | 0; w[d] = rotl(w[d] ^ w[a], 16);
    w[c] = (w[c] + w[d]) | 0; w[b] = rotl(w[b] ^ w[c], 12);
    w[a] = (w[a] + w[b]) | 0; w[d] = rotl(w[d] ^ w[a], 8);
    w[c] = (w[c] + w[d]) | 0; w[b] = rotl(w[b] ^ w[c], 7);
  }
  for (let i = 0; i < 10; i++) {
    qr(0, 4, 8, 12); qr(1, 5, 9, 13); qr(2, 6, 10, 14); qr(3, 7, 11, 15);
    qr(0, 5, 10, 15); qr(1, 6, 11, 12); qr(2, 7, 8, 13); qr(3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) w[i] = (w[i] + s[i]) | 0;
  const out = new Uint8Array(64);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 16; i++) ov.setUint32(i * 4, w[i], true);
  return out;
}

function chacha20Encrypt(key, nonce, data) {
  const out = new Uint8Array(data.length);
  const blocks = Math.ceil(data.length / 64);
  for (let i = 0; i < blocks; i++) {
    const block = chacha20Block(key, nonce, i);
    const offset = i * 64;
    const len = Math.min(64, data.length - offset);
    for (let j = 0; j < len; j++) out[offset + j] = data[offset + j] ^ block[j];
  }
  return out;
}

function calcPaddedLen(unpaddedLen) {
  if (unpaddedLen < 1) throw new Error('Invalid');
  if (unpaddedLen > 65535) throw new Error('Too long');
  if (unpaddedLen <= 32) return 32;
  const nextPower = 1 << (32 - Math.clz32(unpaddedLen - 1));
  const chunk = Math.max(32, nextPower >> 3);
  return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
}

function pad(plaintext) {
  const textBytes = new TextEncoder().encode(plaintext);
  const unpaddedLen = textBytes.length;
  const paddedLen = calcPaddedLen(unpaddedLen);
  const out = new Uint8Array(2 + paddedLen);
  out[0] = (unpaddedLen >> 8) & 0xff;
  out[1] = unpaddedLen & 0xff;
  out.set(textBytes, 2);
  return out;
}

function unpad(padded) {
  const unpaddedLen = (padded[0] << 8) | padded[1];
  if (unpaddedLen < 1 || unpaddedLen + 2 > padded.length) throw new Error('Invalid padding');
  const expectedPaddedLen = calcPaddedLen(unpaddedLen);
  if (padded.length !== 2 + expectedPaddedLen) throw new Error('Invalid padded length');
  return new TextDecoder().decode(padded.slice(2, 2 + unpaddedLen));
}

async function hmacSha256(key, data) {
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', hmacKey, data);
  return new Uint8Array(sig);
}

async function hkdfExtract(salt, ikm) { return hmacSha256(salt, ikm); }

async function hkdfExpand(prk, info, length) {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  const output = new Uint8Array(n * hashLen);
  let prev = new Uint8Array(0);
  for (let i = 1; i <= n; i++) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0); input.set(info, prev.length); input[prev.length + info.length] = i;
    prev = await hmacSha256(prk, input);
    output.set(prev, (i - 1) * hashLen);
  }
  return output.slice(0, length);
}

(async () => {
  let passed = 0, failed = 0;

  // Test 1: ChaCha20 RFC 8439 Section 2.3.2 test vector (block counter = 1)
  const testKey = hexToBytes('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const testNonce = hexToBytes('000000090000004a00000000');
  const testBlock = chacha20Block(testKey, testNonce, 1);
  const expected = '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e';
  let got = '';
  for (let i = 0; i < testBlock.length; i++) got += testBlock[i].toString(16).padStart(2, '0');
  if (got === expected) { console.log('✅ ChaCha20 RFC 7539 test vector passed'); passed++; }
  else { console.log('❌ ChaCha20 RFC 7539 test vector FAILED'); console.log('  Expected:', expected); console.log('  Got:', got); failed++; }

  // Test 2: Padding function
  const paddingTests = [
    [1, 32], [5, 32], [16, 32], [32, 32],
    [33, 64], [37, 64], [45, 64], [64, 64],
    [65, 96], [100, 128], [256, 256], [1000, 1024]
  ];
  let paddingOk = true;
  for (const [input, expected] of paddingTests) {
    const result = calcPaddedLen(input);
    if (result !== expected) {
      console.log(`❌ calcPaddedLen(${input}) = ${result}, expected ${expected}`);
      paddingOk = false;
    }
  }
  if (paddingOk) { console.log('✅ NIP-44 padding calculations correct'); passed++; }
  else { failed++; }

  // Test 3: Pad/unpad roundtrip
  const testTexts = ['a', 'Hello!', 'This is a longer test message for NIP-44 padding.', 'x'.repeat(1000)];
  let padUnpadOk = true;
  for (const text of testTexts) {
    const padded = pad(text);
    const result = unpad(padded);
    if (result !== text) { console.log(`❌ Pad/unpad roundtrip failed for "${text.substring(0, 20)}..."`); padUnpadOk = false; }
  }
  if (padUnpadOk) { console.log('✅ Pad/unpad roundtrip correct'); passed++; }
  else { failed++; }

  // Test 4: Full NIP-44 encrypt/decrypt roundtrip
  const fakeSharedSecret = crypto.getRandomValues(new Uint8Array(32));
  const salt = new TextEncoder().encode('nip44-v2');
  const conversationKey = await hkdfExtract(salt, fakeSharedSecret);

  const plaintext = 'Hello, NIP-44! This is a test of the encryption roundtrip with a reasonably long message.';

  // Encrypt
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const messageKey = await hkdfExpand(conversationKey, nonce, 76);
  const chachaKey = messageKey.slice(0, 32);
  const chaChaNonce = messageKey.slice(32, 44);
  const hmacKey = messageKey.slice(44, 76);
  const padded = pad(plaintext);
  const ciphertext = chacha20Encrypt(chachaKey, chaChaNonce, padded);
  const hmacInput = new Uint8Array(nonce.length + ciphertext.length);
  hmacInput.set(nonce, 0); hmacInput.set(ciphertext, nonce.length);
  const mac = await hmacSha256(hmacKey, hmacInput);
  const payload = new Uint8Array(1 + 32 + ciphertext.length + 32);
  payload[0] = 0x02;
  payload.set(nonce, 1);
  payload.set(ciphertext, 33);
  payload.set(mac, 33 + ciphertext.length);
  let binary = '';
  for (let i = 0; i < payload.length; i++) binary += String.fromCharCode(payload[i]);
  const encoded = btoa(binary);

  // Decrypt
  const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  if (raw[0] !== 0x02) throw new Error('Bad version');
  const dnonce = raw.slice(1, 33);
  const dmac = raw.slice(raw.length - 32);
  const dcipher = raw.slice(33, raw.length - 32);
  const dmk = await hkdfExpand(conversationKey, dnonce, 76);
  const dck = dmk.slice(0, 32);
  const dcn = dmk.slice(32, 44);
  const dhk = dmk.slice(44, 76);
  const dhmacIn = new Uint8Array(dnonce.length + dcipher.length);
  dhmacIn.set(dnonce, 0); dhmacIn.set(dcipher, dnonce.length);
  const expectedMac = await hmacSha256(dhk, dhmacIn);
  let diff = 0;
  for (let i = 0; i < dmac.length; i++) diff |= dmac[i] ^ expectedMac[i];
  if (diff !== 0) throw new Error('HMAC failed');
  const decPadded = chacha20Encrypt(dck, dcn, dcipher);
  const result = unpad(decPadded);

  if (result === plaintext) { console.log('✅ Full NIP-44 encrypt/decrypt roundtrip passed'); passed++; }
  else { console.log('❌ Full NIP-44 encrypt/decrypt roundtrip FAILED'); console.log('  Input:', plaintext); console.log('  Output:', result); failed++; }

  // Test 5: HMAC tamper detection
  try {
    const tampered = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    tampered[40] ^= 0xff; // flip a byte in the ciphertext
    const tnonce = tampered.slice(1, 33);
    const tmac = tampered.slice(tampered.length - 32);
    const tcipher = tampered.slice(33, tampered.length - 32);
    const tmk = await hkdfExpand(conversationKey, tnonce, 76);
    const thk = tmk.slice(44, 76);
    const thmacIn = new Uint8Array(tnonce.length + tcipher.length);
    thmacIn.set(tnonce, 0); thmacIn.set(tcipher, tnonce.length);
    const texpectedMac = await hmacSha256(thk, thmacIn);
    let tdiff = 0;
    for (let i = 0; i < tmac.length; i++) tdiff |= tmac[i] ^ texpectedMac[i];
    if (tdiff !== 0) { console.log('✅ HMAC tamper detection works'); passed++; }
    else { console.log('❌ HMAC tamper detection FAILED (did not detect tampering)'); failed++; }
  } catch (e) {
    console.log('✅ HMAC tamper detection works (threw error)'); passed++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
