'use strict';

/*
 * อัปเดตราคาอัตโนมัติจากแหล่งที่เรียกจากเบราว์เซอร์ได้โดยตรง (รองรับ CORS) — ไม่ต้องมี server
 *   - USD/THB : Frankfurter (อัตราอ้างอิง ECB)             ไม่ต้องใช้ key
 *   - คริปโต   : CoinGecko                                    ไม่ต้องใช้ key
 *   - หุ้นสหรัฐ : Twelve Data                                  ต้องใช้ API key ฟรี
 * ข้อมูลที่ส่งออกไปมีเพียงสัญลักษณ์สินทรัพย์ ไม่มีจำนวนหน่วยหรือมูลค่าพอร์ต
 * สินทรัพย์ไทย (กองทุน หุ้นไทย ทอง PVD หุ้นกู้ เงินฝาก) กรอกเองที่หน้า "อัปเดตราคา"
 */
const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token', LTC: 'litecoin', TRX: 'tron', TON: 'the-open-network', KUB: 'bitkub-coin', XLM: 'stellar',
};

const PRICE_PROVIDERS = {
  CRYPTO: { name: 'CoinGecko', idLabel: 'CoinGecko ID', idHint: 'เช่น bitcoin, ethereum', defaultId: (h) => COINGECKO_IDS[(h.symbol || '').toUpperCase()] || '' },
  STOCK_US: { name: 'Twelve Data', idLabel: 'Ticker', idHint: 'เช่น AAPL, VOO', defaultId: (h) => (h.symbol || '').toUpperCase(), needsKey: 'twelveData' },
};

// ลิงก์สำหรับเปิดดูราคาล่าสุดเมื่อกรอกเอง
function priceLink(h) {
  const s = encodeURIComponent(h.symbol || h.name);
  switch (h.type) {
    case 'STOCK_TH': return { url: `https://www.set.or.th/th/market/product/stock/quote/${s}/price`, label: 'SET' };
    case 'SSF': case 'RMF': case 'THAIESG': case 'MF': return { url: `https://www.google.com/search?q=${s}+NAV`, label: 'ค้นหา NAV' };
    case 'GOLD': return { url: 'https://www.goldtraders.or.th/', label: 'สมาคมค้าทองคำ' };
    case 'BOND': return { url: 'https://www.thaibma.or.th/', label: 'ThaiBMA' };
    case 'STOCK_US': return { url: `https://finance.yahoo.com/quote/${s}`, label: 'Yahoo Finance' };
    case 'CRYPTO': return { url: `https://www.coingecko.com/en/coins/${encodeURIComponent(h.sourceId || PRICE_PROVIDERS.CRYPTO.defaultId(h) || h.name)}`, label: 'CoinGecko' };
    default: return null;
  }
}

const isAuto = (h) => !!PRICE_PROVIDERS[h.type] && h.autoPrice !== false;
const sourceIdOf = (h) => (h.sourceId || PRICE_PROVIDERS[h.type]?.defaultId(h) || '').trim();

const PriceService = (() => {
  const st = { running: false, done: 0, total: 0, log: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'หมดเวลาเชื่อมต่อ' : e.message === 'Failed to fetch' ? 'เชื่อมต่อไม่ได้ (ตรวจสอบอินเทอร์เน็ต)' : e.message);
    } finally {
      clearTimeout(timer);
    }
  }

  const step = () => { st.done += 1; if (state) renderStatus(); };
  const log = (label, ok, msg) => st.log.push({ label, ok, msg });

  async function updateFx() {
    const d = await getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB');
    if (!d.rates?.THB) throw new Error('ไม่พบอัตรา THB');
    state.fx.USD = d.rates.THB;
    state.fxMeta = { date: d.date, source: 'ECB (Frankfurter)' };
    return `USD/THB = ${d.rates.THB} (ณ ${d.date})`;
  }

  async function updateCrypto(list) {
    const ids = [...new Set(list.map(sourceIdOf).filter(Boolean))];
    const vs = [...new Set(list.map((h) => h.currency.toLowerCase()))];
    const data = ids.length ? await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(',')}&vs_currencies=${vs.join(',')}`) : {};
    for (const h of list) {
      const id = sourceIdOf(h);
      const p = data[id]?.[h.currency.toLowerCase()];
      if (p > 0) { setPrice(h, p, AS_OF, 'CoinGecko'); log(h.symbol || h.name, true, `${priceFmt(p, h.currency, h.type)}`); }
      else log(h.symbol || h.name, false, id ? `ไม่พบราคาสำหรับ "${id}"` : 'ยังไม่ได้ระบุ CoinGecko ID');
      step();
    }
  }

  async function updateUS(list) {
    const key = state.settings.apiKeys.twelveData;
    if (!key) {
      list.forEach((h) => { log(h.symbol || h.name, false, 'ยังไม่ได้ใส่ Twelve Data API key (หน้าตั้งค่า)'); step(); });
      return;
    }
    const symbols = [...new Set(list.map(sourceIdOf).filter(Boolean))];
    const prices = {};
    // แผนฟรีจำกัด 8 สัญลักษณ์ต่อนาที
    for (let i = 0; i < symbols.length; i += 8) {
      if (i) await sleep(61000);
      const chunk = symbols.slice(i, i + 8);
      const d = await getJSON(`https://api.twelvedata.com/price?symbol=${chunk.map(encodeURIComponent).join(',')}&apikey=${encodeURIComponent(key)}`);
      if (d.status === 'error') throw new Error(d.message || 'Twelve Data error');
      if (chunk.length === 1) prices[chunk[0]] = d;
      else Object.assign(prices, d);
    }
    for (const h of list) {
      const sym = sourceIdOf(h);
      const p = parseFloat(prices[sym]?.price);
      if (h.currency !== 'USD') log(sym, false, 'รองรับเฉพาะสินทรัพย์สกุล USD');
      else if (p > 0) { setPrice(h, p, AS_OF, 'Twelve Data'); log(sym, true, priceFmt(p, h.currency, h.type)); }
      else log(sym, false, prices[sym]?.message || 'ไม่พบราคา');
      step();
    }
  }

  async function updateAll({ manual = false } = {}) {
    if (st.running || !state) return;
    const auto = state.holdings.filter(isAuto);
    const crypto = auto.filter((h) => h.type === 'CRYPTO');
    const us = auto.filter((h) => h.type === 'STOCK_US');
    Object.assign(st, { running: true, done: 0, total: 1 + crypto.length + us.length, log: [] });
    renderStatus();
    const tasks = [
      updateFx().then((m) => { log('USD/THB', true, m); step(); }).catch((e) => { log('USD/THB', false, e.message); step(); }),
      updateCrypto(crypto).catch((e) => crypto.forEach((h) => { log(h.symbol || h.name, false, e.message); step(); })),
      updateUS(us).catch((e) => us.forEach((h) => { log(h.symbol || h.name, false, e.message); step(); })),
    ];
    await Promise.all(tasks);
    st.running = false;
    if (!state) return;
    const ok = st.log.filter((l) => l.ok).length;
    const fail = st.log.length - ok;
    state.settings.lastPriceUpdate = new Date().toISOString();
    state.settings.lastPriceLog = st.log.slice();
    commit();
    if (manual || fail) toast(`อัปเดตราคาอัตโนมัติ สำเร็จ ${ok} รายการ${fail ? ` · ไม่สำเร็จ ${fail} รายการ` : ''}`, fail && !ok ? 'error' : 'ok');
  }

  function autoUpdateIfDue() {
    const s = state.settings;
    if (!s.autoUpdatePrices || s.demo) return;
    if (s.lastPriceUpdate && isoDate(new Date(s.lastPriceUpdate)) === AS_OF) return;
    updateAll();
  }

  async function testTwelveData(key) {
    const d = await getJSON(`https://api.twelvedata.com/price?symbol=AAPL&apikey=${encodeURIComponent(key)}`);
    if (d.status === 'error') throw new Error(d.message);
    return `เชื่อมต่อสำเร็จ (AAPL = $${d.price})`;
  }

  return { updateAll, autoUpdateIfDue, testTwelveData, status: () => ({ ...st }) };
})();
