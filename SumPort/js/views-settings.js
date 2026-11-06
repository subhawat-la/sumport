'use strict';

/* ---------- หน้าอัปเดตยอด/ราคา ---------- */
ui.prices = { filter: 'ALL' };

function viewPrices() {
  const s = state.settings;
  const f = ui.prices.filter;
  const list = state.holdings.filter((h) => f === 'ALL' || (f === 'STALE' ? isStale(h) : f === 'AUTO' ? isAuto(h) : !isAuto(h)));
  const counts = { ALL: state.holdings.length, STALE: state.holdings.filter(isStale).length, MANUAL: state.holdings.filter((h) => !isAuto(h)).length, AUTO: state.holdings.filter(isAuto).length };
  const logRows = (s.lastPriceLog || []).map((l) => `<li class="${l.ok ? 'up' : 'down'}">${l.ok ? '✓' : '✗'} <b>${esc(l.label)}</b> ${esc(l.msg)}</li>`).join('');

  const row = (h) => {
    const t = TYPE[h.type];
    const amt = t.mode === 'amount';
    const p = calcPosition(h);
    const link = priceLink(h);
    const age = amt ? null : daysSince(h.priceDate + 'T00:00:00');
    return `<tr data-row="${h.id}">
      <td>${assetCell(h, t)}<div class="small muted">${isAuto(h) ? `⚡ ราคาอัตโนมัติ · ${PRICE_PROVIDERS[h.type].name}` : '✍️ กรอกเอง'}</div></td>
      <td class="r">${amt ? '<span class="muted small">-</span>'
        : `<input class="input sm r upd-input" type="number" step="any" min="0" data-hid="${h.id}" data-field="units" value="${p.units}">
           <div class="small muted">${esc(t.unitLabel)}</div>`}</td>
      <td class="r"><input class="input sm r upd-input" type="number" step="any" min="0" data-hid="${h.id}" data-field="${amt ? 'balance' : 'price'}" value="${amt ? h.balance : h.price}">
        <div class="small ${age > STALE_DAYS ? 'warn-text' : 'muted'}">${amt ? `ยอดคงเหลือ (${h.currency})` : `${esc(t.priceLabel)} · ${dateTH(h.priceDate)}${age > STALE_DAYS ? ` (${age} วันก่อน)` : ''}`}</div></td>
      <td class="r"><b data-val="${h.id}">${money(p.valueTHB)}</b><div class="small" data-chg="${h.id}"></div></td>
      <td>${link ? `<a class="link small nowrap" href="${link.url}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>` : '<span class="muted small">ดูจาก statement</span>'}</td>
    </tr>`;
  };

  const groups = ASSET_TYPES.map((t) => {
    const g = list.filter((h) => h.type === t.key);
    return g.length ? `<tr class="group-row"><td colspan="5"><span class="dot" style="background:${t.color}"></span> ${esc(t.name)} <span class="muted">(${g.length})</span></td></tr>${g.map(row).join('')}` : '';
  }).join('');

  const html = `
  <div class="card">
    <div class="card-head"><h3>⚡ ราคาอัตโนมัติ (วันละครั้งเมื่อเปิดแอป)</h3>
      <button class="btn btn-sm" data-action="update-prices">🔄 ดึงราคาอัตโนมัติตอนนี้</button></div>
    <div class="auto-grid">
      <div><span class="muted small">USD/THB</span><b>${nf(4).format(state.fx.USD)}</b><span class="muted small">${esc(state.fxMeta.source || '-')}${state.fxMeta.date ? ' · ' + dateTH(state.fxMeta.date) : ''}</span></div>
      <div><span class="muted small">อัปเดตล่าสุด</span><b>${s.lastPriceUpdate ? dateTimeTH(s.lastPriceUpdate) : 'ยังไม่เคย'}</b><span class="muted small">${s.autoUpdatePrices ? 'เปิดอัปเดตอัตโนมัติ' : 'ปิดอัปเดตอัตโนมัติ'} · <a href="#/settings" class="link">ตั้งค่า</a></span></div>
      <div><span class="muted small">แหล่งข้อมูล</span><b class="small">ECB · CoinGecko · Twelve Data</b><span class="muted small">${s.apiKeys.twelveData ? 'ใส่ Twelve Data key แล้ว' : '⚠️ หุ้นสหรัฐต้องใส่ Twelve Data key'}</span></div>
    </div>
    ${logRows ? `<details class="log"><summary class="small">ผลการอัปเดตล่าสุด (${(s.lastPriceLog || []).length} รายการ)</summary><ul>${logRows}</ul></details>` : ''}
  </div>

  <div class="toolbar">
    <div class="chips">
      ${[['ALL', 'ทั้งหมด'], ['STALE', `ราคาเก่ากว่า ${STALE_DAYS} วัน`], ['MANUAL', 'กรอกเอง'], ['AUTO', 'อัตโนมัติ']]
        .map(([k, l]) => `<button class="chip ${f === k ? 'active' : ''}" data-action="price-filter" data-id="${k}">${l} (${counts[k]})</button>`).join('')}
    </div>
    <span class="grow"></span>
    <label class="field inline"><span>ราคา ณ วันที่</span><input class="input" type="date" id="priceDate" value="${AS_OF}" max="${AS_OF}"></label>
    <button class="btn btn-primary" id="savePrices">💾 บันทึกการเปลี่ยนแปลง</button>
  </div>

  <div class="card flush">
    ${list.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>สินทรัพย์</th><th class="r">จำนวนที่ถือครอง</th><th class="r">ราคา/NAV หรือยอดเงิน</th><th class="r">มูลค่า (บาท)</th><th>ดูราคาล่าสุด</th></tr></thead>
      <tbody>${groups}</tbody></table></div>` : emptyState(state.holdings.length ? 'ไม่มีรายการตามตัวกรองนี้ 🎉' : 'ยังไม่มีสินทรัพย์', '<a class="btn btn-primary" href="#/add">+ เพิ่มสินทรัพย์</a>')}
  </div>
  <p class="muted small">💡 แก้เฉพาะช่องที่เปลี่ยน แล้วกด Enter เพื่อไปช่องถัดไป · ช่องที่แก้แล้วจะถูกไฮไลต์ · ราคาที่แก้จะบันทึกเป็นราคา ณ วันที่ที่เลือก</p>`;

  const mount = () => {
    const inputs = [...document.querySelectorAll('.upd-input')];
    inputs.forEach((inp) => { inp.dataset.orig = inp.value; });
    const refreshRow = (hid) => {
      const h = getHolding(hid);
      const val = (field) => {
        const el = inputs.find((x) => x.dataset.hid === hid && x.dataset.field === field);
        const v = el ? parseFloat(el.value) : NaN;
        return Number.isFinite(v) ? v : null;
      };
      const t = TYPE[h.type];
      const before = calcPosition(h).valueTHB;
      const after = (t.mode === 'amount' ? val('balance') ?? 0 : (val('units') ?? 0) * (val('price') ?? 0)) * fxOf(h);
      document.querySelector(`[data-val="${hid}"]`).innerHTML = money(after);
      const c = before ? ((after - before) / before) * 100 : 0;
      document.querySelector(`[data-chg="${hid}"]`).innerHTML = Math.abs(after - before) > 0.005
        ? `<span class="${cls(c)}">${moneyS(after - before, 'THB', 0)} (${pct(c)})</span>${Math.abs(c) > 20 ? '<div class="warn-text">ตรวจสอบอีกครั้ง</div>' : ''}` : '';
    };
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.classList.toggle('changed', inp.value !== inp.dataset.orig);
        refreshRow(inp.dataset.hid);
      });
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        (inputs[i + 1] || document.getElementById('savePrices')).focus();
      });
    });
    document.getElementById('savePrices')?.addEventListener('click', () => {
      const date = document.getElementById('priceDate').value || AS_OF;
      const touched = new Set();
      for (const inp of inputs) {
        if (inp.value === inp.dataset.orig) continue;
        const v = parseFloat(inp.value);
        if (!(v >= 0)) return toast('กรุณากรอกตัวเลขให้ถูกต้อง', 'error');
        const h = getHolding(inp.dataset.hid);
        if (inp.dataset.field === 'price') setPrice(h, v, date, 'manual');
        else { h[inp.dataset.field] = v; h.updatedAt = AS_OF; }
        touched.add(h.id);
      }
      if (!touched.size) return toast('ยังไม่มีการเปลี่ยนแปลง', 'error');
      toast(`บันทึกการเปลี่ยนแปลง ${touched.size} รายการเรียบร้อย`);
      commit();
    });
  };

  return { title: 'อัปเดตยอด / ราคา', sub: 'แก้จำนวนที่ถือครองและราคา/NAV หลายรายการพร้อมกัน', html, mount };
}

/* ---------- หน้าตั้งค่า ---------- */
function viewSettings() {
  const s = state.settings;
  const pinOn = Vault.hasKey();
  const bDays = daysSince(s.lastBackupAt);
  const p = state.profile;
  const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;

  const html = `
  ${s.demo ? `<div class="banner demo">🧪 ตอนนี้ใช้ <b>ข้อมูลตัวอย่าง</b> อยู่ — เมื่อพร้อมใช้งานจริง กด “เริ่มใช้งานจริง” เพื่อล้างข้อมูลตัวอย่าง (PIN และการตั้งค่ายังอยู่)
    <button class="btn btn-sm btn-primary" data-action="clear-demo">เริ่มใช้งานจริง</button></div>` : ''}

  <div class="grid two">
    <div class="card">
      <div class="card-head"><h3>🔒 ความปลอดภัย</h3><span class="pill ${pinOn ? 'ok' : 'warn'}">${pinOn ? 'เปิดใช้ PIN แล้ว' : 'ยังไม่ได้ตั้ง PIN'}</span></div>
      <p class="muted small">เมื่อตั้ง PIN ข้อมูลทั้งหมดในเครื่องจะถูกเข้ารหัสด้วย AES-256 และต้องใส่ PIN ทุกครั้งที่เปิดแอป
        <b>หากลืม PIN จะกู้คืนได้จากไฟล์สำรองเท่านั้น</b></p>
      <div class="actions">
        ${pinOn ? `<button class="btn" data-action="change-pin">🔑 เปลี่ยน PIN</button>
          <button class="btn btn-danger-ghost" data-action="remove-pin">ปิดการใช้ PIN</button>
          <button class="btn" data-action="lock">🔒 ล็อกทันที</button>`
        : '<button class="btn btn-primary" data-action="set-pin">🔑 ตั้ง PIN</button>'}
      </div>
      <label class="field mt"><span>ล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน</span>
        <select class="input" id="setAutoLock" ${pinOn ? '' : 'disabled'}>
          ${[[1, '1 นาที'], [5, '5 นาที'], [15, '15 นาที'], [30, '30 นาที'], [0, 'ไม่ล็อกอัตโนมัติ']].map(([v, l]) => opt(v, l, s.autoLockMinutes)).join('')}
        </select></label>
    </div>

    <div class="card">
      <div class="card-head"><h3>💾 สำรอง & ย้ายข้อมูล</h3>
        <span class="pill ${bDays >= s.backupReminderDays ? 'warn' : 'ok'}">${s.lastBackupAt ? `สำรองล่าสุด ${dateTH(isoDate(new Date(s.lastBackupAt)))}` : 'ยังไม่เคยสำรอง'}</span></div>
      <p class="muted small">ไฟล์สำรอง (.flbak) เก็บข้อมูลทั้งหมดรวมประวัติมูลค่าพอร์ต ใช้ย้ายไปอุปกรณ์อื่นหรือเก็บไว้ระยะยาว</p>
      <div class="actions">
        <button class="btn btn-primary" data-action="export-backup">⬇️ ดาวน์โหลดไฟล์สำรอง</button>
        <button class="btn" data-action="import-backup">📥 กู้คืนจากไฟล์สำรอง</button>
      </div>
      <label class="field mt"><span>เตือนให้สำรองข้อมูลทุก</span>
        <select class="input" id="setReminder">${[[7, '7 วัน'], [14, '14 วัน'], [30, '30 วัน'], [90, '90 วัน']].map(([v, l]) => opt(v, l, s.backupReminderDays)).join('')}</select></label>
      <details class="guide"><summary>วิธีย้ายไปใช้งานที่อุปกรณ์อื่น</summary>
        <ol><li>กด “ดาวน์โหลดไฟล์สำรอง” และตั้งรหัสผ่านไฟล์</li>
          <li>ส่งไฟล์ไปเครื่องใหม่ (OneDrive, Google Drive, AirDrop, LINE Keep ฯลฯ)</li>
          <li>เปิด FinancialLog บนเครื่องใหม่ → เลือก “กู้คืนจากไฟล์สำรอง” → ใส่รหัสผ่านไฟล์</li>
          <li>ตั้ง PIN ของเครื่องใหม่</li></ol></details>
      <details class="guide"><summary>คำแนะนำสำหรับพอร์ตเกษียณ (เก็บข้อมูลระยะยาว)</summary>
        <ul><li>สำรองอย่างน้อยเดือนละครั้ง และเก็บไฟล์ไว้ <b>2 ที่</b> เช่น cloud + external drive</li>
          <li>เก็บไฟล์สำรองเก่าไว้ด้วย (ชื่อไฟล์มีวันที่) เผื่อต้องย้อนดู</li>
          <li>จดรหัสผ่านไฟล์สำรองไว้ในที่ปลอดภัย (เช่น password manager)</li>
          <li>ไฟล์ใช้มาตรฐานเปิด (JSON + AES-256-GCM/PBKDF2) ถอดรหัสได้แม้ไม่มีแอป — ดู <code>tools/decrypt_backup.py</code></li></ul></details>
      <div class="muted small mt" id="storageInfo">พื้นที่ที่ใช้ ${nf(1).format(Vault.usageBytes() / 1024)} KB</div>
    </div>
  </div>

  <div class="grid two">
    <div class="card">
      <div class="card-head"><h3>🔄 การอัปเดตราคา</h3><a class="link" href="#/prices">ไปหน้าอัปเดตราคา →</a></div>
      <label class="switch"><input type="checkbox" id="setAutoPrice" ${s.autoUpdatePrices ? 'checked' : ''}><span>อัปเดตราคาอัตโนมัติวันละครั้งเมื่อเปิดแอป</span></label>
      <table class="table compact mt">
        <thead><tr><th>ข้อมูล</th><th>แหล่งข้อมูล</th><th>สถานะ</th></tr></thead>
        <tbody>
          <tr><td>USD/THB</td><td>ECB ผ่าน Frankfurter</td><td><span class="pill ok">อัตโนมัติ</span></td></tr>
          <tr><td>คริปโต</td><td>CoinGecko</td><td><span class="pill ok">อัตโนมัติ</span></td></tr>
          <tr><td>หุ้น/ETF สหรัฐ</td><td>Twelve Data</td><td>${s.apiKeys.twelveData ? '<span class="pill ok">อัตโนมัติ</span>' : '<span class="pill warn">ต้องใส่ API key</span>'}</td></tr>
          <tr><td>กองทุนไทย, หุ้นไทย, ทอง, PVD, หุ้นกู้, เงินฝาก</td><td>—</td><td><span class="pill">กรอกเอง</span></td></tr>
        </tbody></table>
      <label class="field mt"><span>Twelve Data API key (ฟรี — สมัครที่ <a class="link" href="https://twelvedata.com/pricing" target="_blank" rel="noopener noreferrer">twelvedata.com</a>)</span>
        <div class="row-input"><input class="input grow" type="password" id="setTdKey" value="${esc(s.apiKeys.twelveData)}" placeholder="วาง API key" autocomplete="off">
          <button class="btn" id="testTd">ทดสอบ</button><button class="btn btn-primary" id="saveTd">บันทึก</button></div></label>
      <div class="small" id="tdMsg"></div>
      <p class="muted small">ข้อมูลที่ส่งไปยังผู้ให้บริการมีเพียงสัญลักษณ์สินทรัพย์ (เช่น BTC, VOO) ไม่มีจำนวนหน่วยหรือมูลค่าพอร์ต · API key ถูกเก็บในข้อมูลที่เข้ารหัส</p>
    </div>

    <div class="card">
      <div class="card-head"><h3>👤 โปรไฟล์</h3></div>
      <div class="form-grid">
        <label class="field span2"><span>ชื่อที่แสดง (ใช้เป็นชื่อเจ้าของในไฟล์ Excel)</span><input class="input" id="pfName" value="${esc(p.displayName)}"></label>
      </div>
      <div class="danger-zone">
        <h4>⚠️ ลบข้อมูล</h4>
        <p class="muted small">ลบข้อมูลทั้งหมดในเครื่องนี้ (รวม PIN และการตั้งค่า) — ควรดาวน์โหลดไฟล์สำรองก่อน</p>
        <button class="btn btn-danger-ghost" data-action="wipe-all">🗑 ลบข้อมูลทั้งหมด</button>
      </div>
    </div>
  </div>
  <p class="muted small">FinancialLog · schema v${Vault.SCHEMA_VERSION} · ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น</p>`;

  const mount = () => {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    on('setAutoLock', 'change', (e) => { s.autoLockMinutes = Number(e.target.value); commit(); });
    on('setReminder', 'change', (e) => { s.backupReminderDays = Number(e.target.value); commit(); });
    on('setAutoPrice', 'change', (e) => { s.autoUpdatePrices = e.target.checked; commit(); });
    on('saveTd', 'click', () => { s.apiKeys.twelveData = document.getElementById('setTdKey').value.trim(); toast('บันทึก API key เรียบร้อย'); commit(); });
    on('testTd', 'click', async () => {
      const msg = document.getElementById('tdMsg');
      msg.className = 'small muted';
      msg.textContent = 'กำลังทดสอบ...';
      try {
        msg.textContent = await PriceService.testTwelveData(document.getElementById('setTdKey').value.trim());
        msg.className = 'small up';
      } catch (e) {
        msg.textContent = '✗ ' + e.message;
        msg.className = 'small down';
      }
    });
    on('pfName', 'change', (e) => { state.profile.displayName = e.target.value.trim(); commit(); });
    navigator.storage?.persisted?.().then((ok) => {
      const el = document.getElementById('storageInfo');
      if (el) el.textContent += ok ? ' · เบราว์เซอร์ล็อกพื้นที่จัดเก็บถาวรแล้ว' : ' · ⚠️ เบราว์เซอร์อาจล้างข้อมูลเมื่อพื้นที่เต็ม — ควรสำรองข้อมูลสม่ำเสมอ';
    });
  };

  return { title: 'ตั้งค่า', sub: 'ความปลอดภัย การสำรองข้อมูล และการอัปเดตราคา', html, mount };
}

/* ---------- Settings actions ---------- */
function openExportModal() {
  openModal({
    title: 'ดาวน์โหลดไฟล์สำรอง',
    body: `<form id="exForm" class="form-grid" onsubmit="return false" autocomplete="off">
      <p class="span2 muted small">ตั้งรหัสผ่านสำหรับไฟล์สำรอง (แยกจาก PIN) อย่างน้อย 8 ตัวอักษร — <b>ต้องใช้รหัสนี้ตอนกู้คืน หากลืมจะเปิดไฟล์ไม่ได้</b></p>
      <label class="field span2"><span>รหัสผ่านไฟล์สำรอง</span><input class="input" type="password" name="pw" minlength="8"></label>
      <label class="field span2"><span>ยืนยันรหัสผ่าน</span><input class="input" type="password" name="pw2" minlength="8"></label>
      <label class="switch span2"><input type="checkbox" name="plain"><span>ไม่เข้ารหัส (ไฟล์ JSON อ่านได้ทันที — ไม่แนะนำ เพราะใครได้ไฟล์ไปก็เห็นข้อมูลการเงินทั้งหมด)</span></label>
      <div class="span2 gate-msg" id="exMsg"></div></form>`,
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="exOk">ดาวน์โหลด</button>',
    onMount: (m, close) => {
      const f = m.querySelector('#exForm');
      f.elements.plain.addEventListener('change', () => {
        f.elements.pw.disabled = f.elements.pw2.disabled = f.elements.plain.checked;
      });
      m.querySelector('#exOk').addEventListener('click', async () => {
        const msg = m.querySelector('#exMsg');
        const plain = f.elements.plain.checked;
        const pw = f.elements.pw.value;
        if (!plain && pw.length < 8) { msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'; return; }
        if (!plain && pw !== f.elements.pw2.value) { msg.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
        msg.textContent = 'กำลังสร้างไฟล์...';
        state.settings.lastBackupAt = new Date().toISOString();
        const text = await Vault.buildBackup(serialize(), plain ? null : pw);
        const blob = new Blob([text], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `FinancialLog-backup-${AS_OF}${plain ? '-UNENCRYPTED.json' : '.flbak'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        close();
        toast('สร้างไฟล์สำรองเรียบร้อย');
        commit();
      });
    },
  });
}

function showVerifyPin(title, onOk) {
  const card = showGate(`<h2>${esc(title)}</h2><p class="muted small">ใส่ PIN ปัจจุบันเพื่อยืนยัน</p>
    <div id="pinPad"></div><div class="gate-msg" id="pinMsg"></div>
    <div class="gate-links"><button class="link-btn" id="pinCancel">ยกเลิก</button></div>`);
  const pad = card.querySelector('#pinPad');
  mountPinPad(pad, async (pin, reset) => {
    pad.classList.add('busy');
    card.querySelector('#pinMsg').textContent = 'กำลังตรวจสอบ...';
    if (await Vault.verifyPin(pin)) return onOk();
    pad.classList.remove('busy');
    card.querySelector('#pinMsg').textContent = 'PIN ไม่ถูกต้อง';
    reset();
  });
  card.querySelector('#pinCancel').addEventListener('click', startApp);
}

const SETTINGS_ACTIONS = {
  'price-filter': (id) => { ui.prices.filter = id; render(); },
  'export-backup': () => openExportModal(),
  'import-backup': () => pickBackupFile({ keepPin: true }),
  'set-pin': () => showSetPin({ onDone: startApp, onCancel: startApp }),
  'change-pin': () => showVerifyPin('เปลี่ยน PIN', () => showSetPin({ onDone: startApp, onCancel: startApp })),
  'remove-pin': () => showVerifyPin('ปิดการใช้ PIN', async () => {
    await Vault.removePin(serialize());
    toast('ปิดการใช้ PIN แล้ว ข้อมูลไม่ได้เข้ารหัส', 'error');
    startApp();
  }),
  'clear-demo': () => confirmDialog('ล้างข้อมูลตัวอย่างทั้งหมดเพื่อเริ่มใช้งานจริง? (PIN และการตั้งค่ายังคงอยู่)', () => {
    Object.assign(state, { holdings: [], snapshots: [], profile: { displayName: '' } });
    Object.assign(state.settings, { demo: false, lastPriceLog: [] });
    toast('พร้อมใช้งานจริงแล้ว เริ่มเพิ่มสินทรัพย์ได้เลย');
    saveSoon();
    location.hash = '#/add';
  }, 'ล้างข้อมูลตัวอย่าง'),
  'wipe-all': () => openModal({
    title: 'ลบข้อมูลทั้งหมด',
    body: '<p>การกระทำนี้ <b>ไม่สามารถย้อนกลับได้</b> พิมพ์คำว่า <b>ลบข้อมูล</b> เพื่อยืนยัน</p><input class="input" id="wipeTxt" style="width:100%">',
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-danger" id="wipeOk">ลบข้อมูลทั้งหมด</button>',
    onMount: (m, close) => m.querySelector('#wipeOk').addEventListener('click', () => {
      if (m.querySelector('#wipeTxt').value.trim() !== 'ลบข้อมูล') return toast('พิมพ์คำยืนยันไม่ถูกต้อง', 'error');
      close();
      clearTimeout(saveTimer);
      Vault.wipe();
      state = null;
      location.hash = '#/dashboard';
      showWelcome();
    }),
  }),
};
