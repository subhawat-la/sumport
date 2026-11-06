'use strict';

/* ---------- State ---------- */
const TYPE = Object.fromEntries(ASSET_TYPES.map((t) => [t.key, t]));
const TODAY = new Date(AS_OF + 'T00:00:00');
const clone = (o) => JSON.parse(JSON.stringify(o));

let state = null;

const defaultSettings = () => ({
  autoLockMinutes: 5,
  autoUpdatePrices: true,
  backupReminderDays: 30,
  lastBackupAt: null,
  lastPriceUpdate: null,
  apiKeys: { twelveData: '' },
  demo: false,
});

function createState(kind) {
  const demo = kind === 'demo';
  const s = {
    holdings: demo ? clone(MOCK.holdings) : [],
    profile: demo ? clone(MOCK.profile) : { displayName: '' },
    fx: { THB: 1, USD: demo ? MOCK.fx.USD : 34 },
    fxMeta: { date: null, source: demo ? 'ข้อมูลตัวอย่าง' : 'ค่าเริ่มต้น' },
    snapshots: [],
    settings: { ...defaultSettings(), demo },
    createdAt: new Date().toISOString(),
  };
  if (demo) {
    // สร้างประวัติราคาและมูลค่าพอร์ตย้อนหลังจำลองให้กราฟมีข้อมูล
    s.holdings.forEach((h) => {
      if (TYPE[h.type].mode !== 'amount') h.priceHistory = mockHistory(h.id, h.price, TYPE[h.type].vol).map((p) => ({ date: p.date, price: p.value }));
    });
  }
  return s;
}

function hydrate(data) {
  state = {
    ...data,
    fxMeta: data.fxMeta || { date: null, source: '' },
    snapshots: data.snapshots || [],
    settings: { ...defaultSettings(), ...(data.settings || {}), apiKeys: { ...defaultSettings().apiKeys, ...(data.settings?.apiKeys || {}) } },
  };
  state.holdings.forEach((h) => { h.extra ||= {}; h.priceHistory ||= []; });
  if (state.settings.demo && !state.snapshots.length) {
    const total = portfolio().total;
    state.snapshots = mockHistory('networth', total.value, 0.025, 0.008).map((p) => ({ date: p.date, value: Math.round(p.value) }));
  }
  recordSnapshot();
}

function serialize() {
  const { privacy, ...rest } = state;
  return { ...clone(rest), schemaVersion: Vault.SCHEMA_VERSION };
}

let saveTimer = null;
function saveSoon() {
  if (!state) return;
  recordSnapshot();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    Vault.save(serialize()).catch((e) => toast(e.name === 'QuotaExceededError' ? 'พื้นที่จัดเก็บในเบราว์เซอร์เต็ม กรุณาสำรองข้อมูล' : 'บันทึกข้อมูลไม่สำเร็จ: ' + e.message, 'error'));
  }, 250);
}

// บันทึกการเปลี่ยนแปลงลงเครื่อง แล้ววาดหน้าจอใหม่
function commit() {
  saveSoon();
  render();
}

/* ---------- ประวัติแบบบีบอัด: รายวันย้อนหลัง ~13 เดือน, เก่ากว่านั้นเก็บจุดสุดท้ายของแต่ละเดือน ---------- */
function compactSeries(arr) {
  const cutoff = isoDate(new Date(TODAY.getFullYear(), TODAY.getMonth() - 13, 1));
  const out = [];
  const lastOfMonth = new Map();
  for (const p of arr) {
    if (p.date >= cutoff) out.push(p);
    else lastOfMonth.set(p.date.slice(0, 7), p);
  }
  return [...lastOfMonth.values(), ...out].sort((a, b) => a.date.localeCompare(b.date));
}

function upsertSeries(arr, point) {
  const i = arr.findIndex((p) => p.date === point.date);
  if (i >= 0) arr[i] = point;
  else arr.push(point);
  arr.sort((a, b) => a.date.localeCompare(b.date));
}

function setPrice(h, price, date = AS_OF, source = 'manual') {
  h.price = price;
  h.priceDate = date;
  h.priceSourceUsed = source;
  h.priceHistory ||= [];
  upsertSeries(h.priceHistory, { date, price });
  h.priceHistory = compactSeries(h.priceHistory);
}

function recordSnapshot() {
  if (!state || !state.holdings.length) return;
  const { total } = portfolio();
  upsertSeries(state.snapshots, { date: AS_OF, value: Math.round(total.value * 100) / 100 });
  state.snapshots = compactSeries(state.snapshots);
}

const ui = {
  holdings: { type: 'ALL', q: '', sort: 'value-desc', group: true },
  chartRange: '1Y',
};

const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Formatting ---------- */
const esc = Charts.esc;
const MASK = '••••••';
const nfCache = {};
const nf = (min, max = min) => (nfCache[min + '-' + max] ||= new Intl.NumberFormat('th-TH', { minimumFractionDigits: min, maximumFractionDigits: max }));
const sym = (cur) => (cur === 'USD' ? '$' : '฿');

function money(v, cur = 'THB', d = 2) {
  if (state.privacy) return sym(cur) + MASK;
  return (v < 0 ? '-' : '') + sym(cur) + nf(d).format(Math.abs(v));
}
function moneyS(v, cur = 'THB', d = 2) {
  if (state.privacy) return sym(cur) + MASK;
  return (v > 0 ? '+' : v < 0 ? '-' : '') + sym(cur) + nf(d).format(Math.abs(v));
}
function compact(v) {
  if (state.privacy) return '฿' + MASK;
  const a = Math.abs(v);
  if (a >= 1e6) return '฿' + nf(2).format(v / 1e6) + 'M';
  if (a >= 1e3) return '฿' + nf(0, 1).format(v / 1e3) + 'K';
  return '฿' + nf(0).format(v);
}
const pct = (v, d = 2) => (v > 0 ? '+' : '') + nf(d).format(v) + '%';
const share = (v) => nf(1).format(v) + '%';
function qty(v, typeKey) {
  if (state.privacy) return MASK;
  return nf(0, TYPE[typeKey].unitDecimals ?? 4).format(v);
}
function priceFmt(v, cur, typeKey) {
  const t = TYPE[typeKey];
  const dec = t && ['SSF', 'RMF', 'THAIESG', 'MF', 'PVD'].includes(t.key) ? 4 : 2;
  return sym(cur) + nf(2, dec).format(v);
}
const dateTH = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const dateTimeTH = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity);
const monthTH = (d) => d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cls = (v) => (v > 0.000001 ? 'up' : v < -0.000001 ? 'down' : '');
const thaiLongDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- Domain calculations ---------- */
const getHolding = (id) => state.holdings.find((h) => h.id === id);
const fxOf = (h) => (h ? state.fx[h.currency] || 1 : 1);
const hasCost = (h) => typeof h.cost === 'number' && h.cost > 0;

// แต่ละสินทรัพย์เก็บเฉพาะยอดปัจจุบัน: มูลค่า = จำนวนที่ถือครอง × ราคา/NAV (เงินฝากใช้ยอดคงเหลือ)
function calcPosition(h) {
  const t = TYPE[h.type];
  const fx = fxOf(h);
  const units = t.mode === 'amount' ? null : Number(h.units) || 0;
  const value = t.mode === 'amount' ? Number(h.balance) || 0 : units * (Number(h.price) || 0);
  const cost = hasCost(h) ? h.cost : null;
  const pl = cost === null ? null : value - cost;
  return {
    units, value, cost, pl, fx,
    avgCost: cost !== null && units ? cost / units : null,
    plPct: cost ? (pl / cost) * 100 : null,
    valueTHB: value * fx,
    costTHB: cost === null ? null : cost * fx,
    plTHB: pl === null ? null : pl * fx,
  };
}

function portfolio() {
  const rows = state.holdings.map((h) => ({ h, t: TYPE[h.type], p: calcPosition(h) }));
  const total = { value: rows.reduce((a, r) => a + r.p.valueTHB, 0) };
  // กำไร/ขาดทุนคำนวณเฉพาะรายการที่ระบุต้นทุน
  const withCost = rows.filter((r) => r.p.costTHB !== null);
  total.costKnown = withCost.reduce((a, r) => a + r.p.costTHB, 0);
  total.valueWithCost = withCost.reduce((a, r) => a + r.p.valueTHB, 0);
  total.pl = total.valueWithCost - total.costKnown;
  total.plPct = total.costKnown ? (total.pl / total.costKnown) * 100 : null;
  total.costCount = withCost.length;
  rows.forEach((r) => { r.share = total.value ? (r.p.valueTHB / total.value) * 100 : 0; });
  const byType = ASSET_TYPES.map((t) => {
    const rs = rows.filter((r) => r.h.type === t.key);
    const value = rs.reduce((a, r) => a + r.p.valueTHB, 0);
    return { t, rows: rs, count: rs.length, value, share: total.value ? (value / total.value) * 100 : 0 };
  }).filter((g) => g.count);
  const byGroup = BS_GROUPS.map((g) => {
    const types = byType.filter((x) => x.t.bs === g.key);
    const value = types.reduce((a, x) => a + x.value, 0);
    return { g, types, count: types.reduce((a, x) => a + x.count, 0), value, share: total.value ? (value / total.value) * 100 : 0 };
  }).filter((x) => x.count);
  return { rows, total, byType, byGroup };
}

/* ---------- Mock histories (สุ่มแบบกำหนด seed เพื่อให้กราฟคงที่) ---------- */
function seeded(str) {
  let s = 2166136261;
  for (const ch of str) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mockHistory(seedKey, current, vol, drift = 0.003) {
  const rnd = seeded(seedKey);
  const pts = [];
  let v = current;
  for (let i = 0; i < 12; i++) {
    const d = i === 0 ? new Date(TODAY) : new Date(TODAY.getFullYear(), TODAY.getMonth() - i, Math.min(TODAY.getDate(), 28));
    pts.unshift({ date: isoDate(d), label: monthTH(d), value: v });
    v = v / (1 + drift + (rnd() - 0.5) * vol * 2);
  }
  return pts;
}

// แปลงอนุกรมเวลา {date, value} เป็นจุดสำหรับกราฟ ตามช่วงเวลาที่เลือก
function seriesForChart(series, range) {
  const months = { '3M': 3, '1Y': 12, ALL: null }[range];
  const from = months ? isoDate(new Date(TODAY.getFullYear(), TODAY.getMonth() - months, TODAY.getDate())) : '';
  const pts = series.filter((p) => p.date >= from);
  const spanDays = pts.length > 1 ? (new Date(pts[pts.length - 1].date) - new Date(pts[0].date)) / 86400000 : 0;
  const fmt = spanDays > 120
    ? (d) => monthTH(d)
    : (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return pts.map((p) => ({ label: fmt(new Date(p.date + 'T00:00:00')), value: p.value }));
}
