'use strict';

// เข้ารหัสด้วยมาตรฐานเปิด (PBKDF2-SHA256 + AES-256-GCM) เพื่อให้ถอดรหัสได้ด้วยเครื่องมือทั่วไปในระยะยาว
const FLCrypto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const ITERATIONS = 600000;

  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriveKey(secret, salt, iterations = ITERATIONS) {
    const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async function encryptJSON(obj, key) {
    const iv = random(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), data: b64(ct) };
  }

  async function decryptJSON(iv, data, key) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data));
    return JSON.parse(dec.decode(pt));
  }

  return { ITERATIONS, b64, unb64, random, deriveKey, encryptJSON, decryptJSON };
})();
