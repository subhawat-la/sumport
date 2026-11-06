'use strict';

/* ---------- Router ---------- */
const ROUTES = {
  dashboard: viewDashboard,
  holdings: viewHoldings,
  holding: viewHolding,
  add: viewForm,
  edit: viewForm,
  prices: viewPrices,
  settings: viewSettings,
};

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'dashboard', id: parts[1], query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function render() {
  if (!state) return;
  const route = parseRoute();
  const out = (ROUTES[route.name] || viewNotFound)(route);
  document.getElementById('pageTitle').textContent = out.title;
  document.getElementById('pageSub').textContent = out.sub || '';
  document.getElementById('view').innerHTML = out.html;
  document.title = `${out.title} · FinancialLog`;
  const nav = out.nav || route.name;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  document.getElementById('fxRate').textContent = nf(2).format(state.fx.USD);
  document.getElementById('btnPrivacy').textContent = state.privacy ? '🙈' : '👁';
  renderStatus();
  document.body.classList.remove('nav-open');
  if (out.mount) out.mount();
}

// สถานะความปลอดภัย/สำรองข้อมูล/อัปเดตราคา บน sidebar และ topbar
function renderStatus() {
  const s = state.settings;
  const days = daysSince(s.lastBackupAt);
  const backupDue = days >= s.backupReminderDays;
  document.getElementById('sideStatus').innerHTML = `
    <a href="#/settings" class="side-stat ${Vault.hasKey() ? 'ok' : 'warn'}">${Vault.hasKey() ? '🔒 เข้ารหัสด้วย PIN' : '⚠️ ยังไม่ได้ตั้ง PIN'}</a>
    <a href="#/settings" class="side-stat ${backupDue ? 'warn' : 'ok'}">💾 ${s.lastBackupAt ? `สำรองล่าสุด ${days === 0 ? 'วันนี้' : days + ' วันก่อน'}` : 'ยังไม่เคยสำรองข้อมูล'}</a>
    ${s.demo ? '<a href="#/settings" class="side-stat demo">🧪 กำลังใช้ข้อมูลตัวอย่าง</a>' : ''}
    ${Vault.hasKey() ? '<button class="btn btn-sm btn-block" data-action="lock">🔒 ล็อกแอป</button>' : ''}`;
  const pu = PriceService.status();
  const el = document.getElementById('priceStatus');
  el.className = 'chip-info' + (pu.running ? ' running' : '');
  el.innerHTML = pu.running ? `⏳ กำลังอัปเดตราคา ${pu.done}/${pu.total}` : `🔄 ${s.lastPriceUpdate ? 'อัปเดต ' + timeAgo(s.lastPriceUpdate) : 'อัปเดตราคา'}`;
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีก่อน`;
  if (mins < 1440) return `${Math.floor(mins / 60)} ชม.ก่อน`;
  return dateTH(isoDate(new Date(iso)));
}

/* ---------- Modal & toast ---------- */
function openModal({ title, body, footer = '', onMount, wide = false }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-backdrop" data-close>
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="ปิด">✕</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div></div>`;
  const close = () => { root.innerHTML = ''; };
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close') || e.target.closest('.modal-head [data-close], .modal-foot [data-close]')) close();
  });
  if (onMount) onMount(root.querySelector('.modal'), close);
  const first = root.querySelector('input, select, textarea');
  if (first) first.focus();
  return close;
}

function confirmDialog(message, onYes, yesLabel = 'ยืนยันการลบ') {
  openModal({
    title: 'ยืนยันการทำรายการ',
    body: `<p>${message}</p>`,
    footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn btn-danger" id="btnYes">${yesLabel}</button>`,
    onMount: (m, close) => m.querySelector('#btnYes').addEventListener('click', () => { close(); onYes(); }),
  });
}

function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = (kind === 'error' ? '⚠️ ' : '✅ ') + msg;
  document.getElementById('toastRoot').appendChild(el);
  setTimeout(() => el.classList.add('hide'), 2400);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- อัปเดตจำนวน/ราคา รายการเดียว ---------- */
function openPriceModal(id) {
  const h = getHolding(id);
  const t = TYPE[h.type];
  const amt = t.mode === 'amount';
  openModal({
    title: amt ? 'อัปเดตยอดคงเหลือ' : 'อัปเดตจำนวนและราคา',
    body: `<form id="priceForm" class="form-grid" onsubmit="return false">
      <div class="span2 muted">${esc(h.name)} ${h.symbol ? '(' + esc(h.symbol) + ')' : ''}</div>
      ${amt
        ? `<label class="field span2"><span>ยอดคงเหลือ (${h.currency}) *</span><input class="input" type="number" step="any" min="0" name="balance" value="${h.balance}" required></label>`
        : `<label class="field"><span>จำนวนที่ถือครอง (${esc(t.unitLabel)}) *</span><input class="input" type="number" step="any" min="0" name="units" value="${h.units}" required></label>
           <label class="field"><span>${esc(t.priceLabel)} (${h.currency}) *</span><input class="input" type="number" step="any" min="0" name="price" value="${h.price}" required></label>
           <label class="field"><span>ราคา ณ วันที่</span><input class="input" type="date" name="d" value="${AS_OF}" max="${AS_OF}"></label>
           <div class="field"><span>มูลค่าใหม่</span><div class="static" id="pmValue"></div></div>`}
    </form>`,
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="priceSave">บันทึก</button>',
    onMount: (m, close) => {
      const form = m.querySelector('#priceForm');
      const preview = () => {
        const el = m.querySelector('#pmValue');
        if (el) el.innerHTML = money((parseFloat(form.elements.units.value) || 0) * (parseFloat(form.elements.price.value) || 0), h.currency);
      };
      form.addEventListener('input', preview);
      preview();
      m.querySelector('#priceSave').addEventListener('click', () => {
        if (!form.reportValidity()) return;
        if (amt) {
          h.balance = parseFloat(form.elements.balance.value);
          h.updatedAt = AS_OF;
        } else {
          const units = parseFloat(form.elements.units.value);
          const price = parseFloat(form.elements.price.value);
          if (units !== h.units) { h.units = units; h.updatedAt = AS_OF; }
          if (price !== h.price || h.priceDate !== (form.elements.d.value || AS_OF)) setPrice(h, price, form.elements.d.value || AS_OF, 'manual');
        }
        close();
        toast('อัปเดตเรียบร้อย');
        commit();
      });
    },
  });
}

function openFxModal() {
  openModal({
    title: 'อัตราแลกเปลี่ยน',
    body: `<form id="fxForm" class="form-grid">
      <label class="field span2"><span>USD → THB *</span><input class="input" type="number" step="any" min="0.01" name="usd" value="${state.fx.USD}" required></label>
      <p class="span2 muted small">ใช้แปลงมูลค่าสินทรัพย์สกุล USD เป็นบาท (เวอร์ชันจริงจะดึงอัตราอ้างอิงอัตโนมัติ)</p></form>`,
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="fxSave">บันทึก</button>',
    onMount: (m, close) => m.querySelector('#fxSave').addEventListener('click', () => {
      const form = m.querySelector('#fxForm');
      if (!form.reportValidity()) return;
      state.fx.USD = parseFloat(form.elements.usd.value);
      state.fxMeta = { date: AS_OF, source: 'กรอกเอง' };
      close();
      toast('อัปเดตอัตราแลกเปลี่ยนเรียบร้อย');
      commit();
    }),
  });
}

/* ---------- Global actions ---------- */
const ACTIONS = {
  'update-price': (id) => openPriceModal(id),
  'edit-fx': () => openFxModal(),
  privacy: () => { state.privacy = !state.privacy; render(); },
  menu: () => document.body.classList.toggle('nav-open'),
  lock: () => lockNow(),
  'update-prices': () => PriceService.updateAll({ manual: true }),
  'chart-range': (id) => { ui.chartRange = id; render(); },
  'export-excel': () => exportAssetsExcel(),
  'delete-holding': (id) => {
    const h = getHolding(id);
    confirmDialog(`ลบ <b>${esc(h.name)}</b> ออกจากรายการสินทรัพย์?`, () => {
      state.holdings = state.holdings.filter((x) => x.id !== id);
      saveSoon();
      toast('ลบสินทรัพย์เรียบร้อย');
      location.hash = '#/holdings';
    });
  },
  ...SETTINGS_ACTIONS,
};

document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    e.preventDefault();
    const fn = ACTIONS[actionEl.dataset.action];
    if (fn) fn(actionEl.dataset.id);
    return;
  }
  const row = e.target.closest('[data-href]');
  if (row && !e.target.closest('a, button, input, select')) location.hash = row.dataset.href;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('modalRoot').innerHTML = '';
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- Boot ---------- */
function startApp() {
  hideGate();
  lastActivity = Date.now();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  render();
  saveSoon();
  PriceService.autoUpdateIfDue();
}

function boot() {
  try {
    if (!Vault.exists()) return showWelcome();
    if (Vault.isEncrypted()) return showLock();
    hydrate(Vault.loadPlain());
    startApp();
  } catch (e) {
    showGate(`<h2>เปิดข้อมูลไม่สำเร็จ</h2><p class="muted">${esc(e.message)}</p>
      <div class="gate-actions"><button class="gate-option" onclick="pickBackupFile({ keepPin: false })"><span>📥</span><div><b>กู้คืนจากไฟล์สำรอง</b></div></button></div>`);
  }
}

boot();
