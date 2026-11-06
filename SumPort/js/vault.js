'use strict';

/*
 * จัดเก็บข้อมูลในเครื่อง (localStorage) — ไม่มี server/ฐานข้อมูล
 * - ไม่มี PIN: เก็บเป็น JSON
 * - มี PIN: เข้ารหัสทั้งก้อนด้วย AES-256-GCM โดยใช้กุญแจที่ derive จาก PIN (PBKDF2-SHA256)
 * ย้ายข้อมูลข้ามอุปกรณ์ด้วยไฟล์สำรอง (.flbak) ซึ่งเข้ารหัสด้วยรหัสผ่านแยกจาก PIN
 */
const Vault = (() => {
  const KEY = 'financiallog.vault';
  const ATTEMPT_KEY = 'financiallog.pinAttempts';
  const SCHEMA_VERSION = 2;
  const BACKUP_FORMAT = 1;

  let key = null;
  let kdf = null;
  let queue = Promise.resolve();

  const readRaw = () => {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  };
  const exists = () => !!localStorage.getItem(KEY);
  const isEncrypted = () => !!readRaw()?.encrypted;
  const hasKey = () => !!key;

  // v1 → v2: เลิกเก็บรายการธุรกรรม เหลือเพียงยอดปัจจุบันของแต่ละสินทรัพย์
  function migrateV1toV2(data) {
    const txs = Array.isArray(data.transactions) ? data.transactions : [];
    data.holdings.forEach((h) => {
      const mine = txs.filter((x) => x.holdingId === h.id).sort((a, b) => a.date.localeCompare(b.date));
      let units = 0;
      let cost = 0;
      for (const x of mine) {
        if (x.kind === 'BUY') { cost += (x.amount || 0) + (x.fee || 0); units += x.units || 0; }
        else if (x.kind === 'SELL') {
          if (x.units == null) cost -= x.amount || 0;
          else { cost -= units > 0 ? (cost / units) * x.units : 0; units -= x.units; }
        }
      }
      if (h.type !== 'DEPOSIT') h.units = Math.round(units * 1e8) / 1e8;
      h.cost = cost > 0 ? Math.round(cost * 100) / 100 : null;
    });
    delete data.transactions;
    data.profile = { displayName: data.profile?.displayName || '' };
    (data.snapshots || []).forEach((s) => { delete s.cost; });
    if (data.settings) { delete data.settings.lastPriceLog; if (data.settings.apiKeys) delete data.settings.apiKeys.secFund; }
    return data;
  }

  // ปรับโครงสร้างข้อมูลเก่าให้เป็นเวอร์ชันปัจจุบัน — เพิ่มขั้นตอนที่นี่เมื่อ schema เปลี่ยน
  function migrate(data) {
    if (!data || !Array.isArray(data.holdings)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
    const v = data.schemaVersion || 1;
    if (v > SCHEMA_VERSION) throw new Error('ไฟล์นี้สร้างจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน');
    if (v < 2) migrateV1toV2(data);
    data.schemaVersion = SCHEMA_VERSION;
    return data;
  }

  function loadPlain() {
    const raw = readRaw();
    if (!raw || raw.encrypted) throw new Error('ข้อมูลถูกเข้ารหัส');
    return migrate(raw.payload);
  }

  async function unlock(pin) {
    const raw = readRaw();
    const k = await FLCrypto.deriveKey(pin, FLCrypto.unb64(raw.kdf.salt), raw.kdf.iterations);
    let data;
    try {
      data = await FLCrypto.decryptJSON(raw.iv, raw.data, k);
    } catch {
      registerFailure();
      throw new Error('PIN ไม่ถูกต้อง');
    }
    localStorage.removeItem(ATTEMPT_KEY);
    key = k;
    kdf = raw.kdf;
    return migrate(data);
  }

  async function verifyPin(pin) {
    const raw = readRaw();
    if (!raw?.encrypted) return true;
    try {
      const k = await FLCrypto.deriveKey(pin, FLCrypto.unb64(raw.kdf.salt), raw.kdf.iterations);
      await FLCrypto.decryptJSON(raw.iv, raw.data, k);
      return true;
    } catch {
      return false;
    }
  }

  async function writeNow(data) {
    data.schemaVersion = SCHEMA_VERSION;
    data.savedAt = new Date().toISOString();
    let record;
    if (key) {
      const { iv, data: ct } = await FLCrypto.encryptJSON(data, key);
      record = { app: 'FinancialLog', encrypted: true, kdf, iv, data: ct };
    } else {
      record = { app: 'FinancialLog', encrypted: false, payload: data };
    }
    localStorage.setItem(KEY, JSON.stringify(record));
  }

  // เขียนตามลำดับเสมอเพื่อไม่ให้การบันทึกที่ช้ากว่าเขียนทับข้อมูลใหม่
  function save(data) {
    queue = queue.then(() => writeNow(data));
    return queue;
  }

  async function setPin(pin, data) {
    const salt = FLCrypto.random(16);
    key = await FLCrypto.deriveKey(pin, salt);
    kdf = { name: 'PBKDF2', hash: 'SHA-256', iterations: FLCrypto.ITERATIONS, salt: FLCrypto.b64(salt) };
    await save(data);
  }

  async function removePin(data) {
    key = null;
    kdf = null;
    await save(data);
  }

  function lock() {
    key = null;
  }

  function wipe() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ATTEMPT_KEY);
    key = null;
    kdf = null;
  }

  /* ---------- จำกัดการเดา PIN ---------- */
  function attempts() {
    try { return JSON.parse(localStorage.getItem(ATTEMPT_KEY)) || { count: 0, until: 0 }; } catch { return { count: 0, until: 0 }; }
  }
  function registerFailure() {
    const a = attempts();
    a.count += 1;
    if (a.count >= 5) a.until = Date.now() + Math.min(30000 * 2 ** (a.count - 5), 15 * 60000);
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(a));
  }
  const lockedOutMs = () => Math.max(0, attempts().until - Date.now());

  /* ---------- ไฟล์สำรอง ---------- */
  async function buildBackup(data, password) {
    const head = { app: 'FinancialLog', kind: 'backup', format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() };
    if (!password) return JSON.stringify({ ...head, encrypted: false, payload: data }, null, 2);
    const salt = FLCrypto.random(16);
    const k = await FLCrypto.deriveKey(password, salt);
    const { iv, data: ct } = await FLCrypto.encryptJSON(data, k);
    return JSON.stringify({
      ...head,
      encrypted: true,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FLCrypto.ITERATIONS, salt: FLCrypto.b64(salt) },
      cipher: { name: 'AES-GCM', iv },
      data: ct,
    }, null, 2);
  }

  function parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { throw new Error('ไฟล์ไม่ใช่ไฟล์สำรองของ FinancialLog'); }
    if (obj?.app !== 'FinancialLog' || obj.kind !== 'backup') throw new Error('ไฟล์ไม่ใช่ไฟล์สำรองของ FinancialLog');
    if (obj.format > BACKUP_FORMAT) throw new Error('ไฟล์สำรองนี้มาจากแอปเวอร์ชันใหม่กว่า');
    return obj;
  }

  async function openBackup(obj, password) {
    if (!obj.encrypted) return migrate(obj.payload);
    let data;
    try {
      const k = await FLCrypto.deriveKey(password || '', FLCrypto.unb64(obj.kdf.salt), obj.kdf.iterations);
      data = await FLCrypto.decryptJSON(obj.cipher.iv, obj.data, k);
    } catch {
      throw new Error('รหัสผ่านไฟล์สำรองไม่ถูกต้อง');
    }
    return migrate(data);
  }

  function usageBytes() {
    const s = localStorage.getItem(KEY) || '';
    return s.length * 2;
  }

  return {
    SCHEMA_VERSION, exists, isEncrypted, hasKey, loadPlain, unlock, verifyPin, save, setPin, removePin, lock, wipe,
    lockedOutMs, buildBackup, parseBackup, openBackup, usageBytes,
  };
})();
