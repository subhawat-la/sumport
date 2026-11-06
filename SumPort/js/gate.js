'use strict';

/* ---------- Gate: หน้าต้อนรับ / ตั้ง PIN / ล็อก ---------- */
const PIN_LENGTH = 6;
const gateEl = () => document.getElementById('gate');

function showGate(html) {
  document.body.classList.add('gated');
  document.getElementById('modalRoot').innerHTML = '';
  gateEl().innerHTML = `<div class="gate"><div class="gate-card">
    <div class="gate-brand"><div class="logo">FL</div><div><div class="gate-title">FinancialLog</div><div class="muted small">พอร์ตการลงทุนส่วนตัว · ข้อมูลอยู่ในเครื่องนี้เท่านั้น</div></div></div>
    ${html}</div></div>`;
  return gateEl().querySelector('.gate-card');
}

function hideGate() {
  document.body.classList.remove('gated');
  gateEl().innerHTML = '';
}

// แป้น PIN ใช้ได้ทั้งคลิกและพิมพ์ตัวเลขจากคีย์บอร์ด
function mountPinPad(container, onComplete) {
  let pin = '';
  container.innerHTML = `
    <div class="pin-dots">${'<span></span>'.repeat(PIN_LENGTH)}</div>
    <div class="pin-pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-d="${n}">${n}</button>`).join('')}
      <span></span><button type="button" data-d="0">0</button><button type="button" data-d="del" aria-label="ลบ">⌫</button>
    </div>`;
  const dots = container.querySelectorAll('.pin-dots span');
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const press = (d) => {
    if (container.classList.contains('busy')) return;
    if (d === 'del') pin = pin.slice(0, -1);
    else if (pin.length < PIN_LENGTH) pin += d;
    paint();
    if (pin.length === PIN_LENGTH) {
      const value = pin;
      setTimeout(() => onComplete(value, () => { pin = ''; paint(); }), 80);
    }
  };
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (b) press(b.dataset.d);
  });
  const onKey = (e) => {
    if (!container.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
}

function showWelcome() {
  const card = showGate(`
    <h2>ยินดีต้อนรับ 👋</h2>
    <p class="muted">บันทึกสินทรัพย์ทุกประเภทและติดตามพอร์ตเพื่อการเกษียณของคุณ ข้อมูลทั้งหมดถูกเก็บในเบราว์เซอร์ของเครื่องนี้ ไม่มีการส่งขึ้น server</p>
    <div class="gate-actions">
      <button class="gate-option" data-start="empty"><span>🚀</span><div><b>เริ่มใช้งานจริง</b><span class="muted small">เริ่มจากพอร์ตว่าง แล้วเพิ่มสินทรัพย์ของคุณ</span></div></button>
      <button class="gate-option" data-start="restore"><span>📥</span><div><b>กู้คืนจากไฟล์สำรอง</b><span class="muted small">ย้ายข้อมูลมาจากอุปกรณ์อื่น (.flbak)</span></div></button>
      <button class="gate-option" data-start="demo"><span>🧪</span><div><b>ทดลองด้วยข้อมูลตัวอย่าง</b><span class="muted small">ดูการทำงานก่อน ล้างข้อมูลได้ภายหลังที่หน้าตั้งค่า</span></div></button>
    </div>`);
  card.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-start]');
    if (!b) return;
    if (b.dataset.start === 'restore') { pickBackupFile({ keepPin: false }); return; }
    hydrate(createState(b.dataset.start));
    await Vault.save(serialize());
    showSetPin({ allowSkip: true, onDone: startApp });
  });
}

function showSetPin({ allowSkip = false, onDone, onCancel }) {
  let first = null;
  const card = showGate(`
    <h2 id="pinTitle">ตั้ง PIN ${PIN_LENGTH} หลัก</h2>
    <p class="muted small" id="pinHint">PIN ใช้ปลดล็อกแอปและเข้ารหัสข้อมูลในเครื่อง (AES-256) — <b>หากลืม PIN จะกู้คืนได้จากไฟล์สำรองเท่านั้น</b></p>
    <div id="pinPad"></div>
    <div class="gate-msg" id="pinMsg"></div>
    <div class="gate-links">
      ${allowSkip ? '<button class="link-btn" id="pinSkip">ข้ามไปก่อน (ตั้งภายหลังได้ที่หน้าตั้งค่า)</button>' : ''}
      ${onCancel ? '<button class="link-btn" id="pinCancel">ยกเลิก</button>' : ''}
    </div>`);
  const msg = card.querySelector('#pinMsg');
  mountPinPad(card.querySelector('#pinPad'), async (pin, reset) => {
    if (!first) {
      if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
        msg.textContent = 'PIN เดาง่ายเกินไป กรุณาเลือกใหม่';
        reset();
        return;
      }
      first = pin;
      card.querySelector('#pinTitle').textContent = 'ยืนยัน PIN อีกครั้ง';
      msg.textContent = '';
      reset();
      return;
    }
    if (pin !== first) {
      first = null;
      card.querySelector('#pinTitle').textContent = `ตั้ง PIN ${PIN_LENGTH} หลัก`;
      msg.textContent = 'PIN ไม่ตรงกัน กรุณาเริ่มใหม่';
      reset();
      return;
    }
    card.querySelector('#pinPad').classList.add('busy');
    msg.textContent = 'กำลังเข้ารหัสข้อมูล...';
    await Vault.setPin(pin, serialize());
    toast('ตั้ง PIN และเข้ารหัสข้อมูลเรียบร้อย');
    onDone();
  });
  card.querySelector('#pinSkip')?.addEventListener('click', onDone);
  card.querySelector('#pinCancel')?.addEventListener('click', onCancel);
}

function showLock() {
  const card = showGate(`
    <h2>🔒 ใส่ PIN เพื่อปลดล็อก</h2>
    <div id="pinPad"></div>
    <div class="gate-msg" id="pinMsg"></div>
    <div class="gate-links"><button class="link-btn" id="forgot">ลืม PIN?</button></div>`);
  const pad = card.querySelector('#pinPad');
  const msg = card.querySelector('#pinMsg');
  const checkLockout = () => {
    const ms = Vault.lockedOutMs();
    pad.classList.toggle('busy', ms > 0);
    if (ms > 0) {
      msg.textContent = `ใส่ PIN ผิดหลายครั้ง กรุณารอ ${Math.ceil(ms / 1000)} วินาที`;
      setTimeout(checkLockout, 1000);
    } else if (msg.textContent.startsWith('ใส่ PIN ผิดหลายครั้ง')) {
      msg.textContent = '';
    }
  };
  mountPinPad(pad, async (pin, reset) => {
    if (Vault.lockedOutMs() > 0) { reset(); return checkLockout(); }
    pad.classList.add('busy');
    msg.textContent = 'กำลังปลดล็อก...';
    try {
      const data = await Vault.unlock(pin);
      hydrate(data);
      startApp();
    } catch (e) {
      pad.classList.remove('busy');
      msg.textContent = e.message;
      pad.classList.add('shake');
      setTimeout(() => pad.classList.remove('shake'), 400);
      reset();
      checkLockout();
    }
  });
  checkLockout();
  card.querySelector('#forgot').addEventListener('click', () => {
    const c = showGate(`
      <h2>ลืม PIN</h2>
      <p class="muted">ข้อมูลในเครื่องนี้ถูกเข้ารหัสด้วย PIN จึง<b>ไม่สามารถกู้คืนได้โดยไม่มี PIN</b> ทางเลือกที่มี:</p>
      <div class="gate-actions">
        <button class="gate-option" id="fRestore"><span>📥</span><div><b>กู้คืนจากไฟล์สำรอง</b><span class="muted small">ข้อมูลในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลในไฟล์สำรอง</span></div></button>
        <button class="gate-option danger" id="fWipe"><span>🗑️</span><div><b>ล้างข้อมูลทั้งหมดและเริ่มใหม่</b><span class="muted small">ไม่สามารถย้อนกลับได้</span></div></button>
      </div>
      <div class="gate-links"><button class="link-btn" id="fBack">← กลับไปใส่ PIN</button></div>`);
    c.querySelector('#fBack').addEventListener('click', showLock);
    c.querySelector('#fRestore').addEventListener('click', () => pickBackupFile({ keepPin: false }));
    c.querySelector('#fWipe').addEventListener('click', () => confirmDialog('ยืนยันการลบข้อมูลทั้งหมดในเครื่องนี้? การกระทำนี้ไม่สามารถย้อนกลับได้', () => {
      Vault.wipe();
      state = null;
      showWelcome();
    }));
  });
}

/* ---------- กู้คืนจากไฟล์สำรอง ---------- */
function pickBackupFile({ keepPin }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.flbak,.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const obj = Vault.parseBackup(await file.text());
      if (obj.encrypted) askBackupPassword(obj, keepPin);
      else confirmRestore(await Vault.openBackup(obj), obj, keepPin);
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  input.click();
}

function askBackupPassword(obj, keepPin) {
  openModal({
    title: 'ใส่รหัสผ่านไฟล์สำรอง',
    body: `<form id="bpForm" class="form-grid" onsubmit="return false">
      <p class="span2 muted small">ไฟล์สร้างเมื่อ ${dateTimeTH(obj.createdAt)}</p>
      <label class="field span2"><span>รหัสผ่านที่ตั้งไว้ตอนสำรองข้อมูล</span><input class="input" type="password" name="pw" required autocomplete="off"></label>
      <div class="span2 gate-msg" id="bpMsg"></div></form>`,
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="bpOk">ถอดรหัส</button>',
    onMount: (m, close) => {
      const go = async () => {
        const btn = m.querySelector('#bpOk');
        btn.disabled = true;
        m.querySelector('#bpMsg').textContent = 'กำลังถอดรหัส...';
        try {
          const data = await Vault.openBackup(obj, m.querySelector('[name=pw]').value);
          close();
          confirmRestore(data, obj, keepPin);
        } catch (e) {
          m.querySelector('#bpMsg').textContent = e.message;
          btn.disabled = false;
        }
      };
      m.querySelector('#bpOk').addEventListener('click', go);
      m.querySelector('[name=pw]').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    },
  });
}

function confirmRestore(data, obj, keepPin) {
  const v = data.holdings.length;
  openModal({
    title: 'ยืนยันการกู้คืนข้อมูล',
    body: `<div class="restore-summary">
        <div><span class="muted small">สร้างไฟล์เมื่อ</span><b>${dateTimeTH(obj.createdAt)}</b></div>
        <div><span class="muted small">สินทรัพย์</span><b>${v} รายการ</b></div>
        <div><span class="muted small">มูลค่ารวม ณ วันที่สำรอง</span><b>${(data.snapshots || []).length ? '฿' + nf(0).format(data.snapshots[data.snapshots.length - 1].value) : '-'}</b></div>
        <div><span class="muted small">ประวัติมูลค่าพอร์ต</span><b>${(data.snapshots || []).length} จุด</b></div>
      </div>
      <p class="note">⚠️ ข้อมูลปัจจุบันในเครื่องนี้ (ถ้ามี) จะถูก<b>แทนที่ทั้งหมด</b>ด้วยข้อมูลจากไฟล์สำรอง</p>`,
    footer: '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="rsOk">กู้คืนข้อมูล</button>',
    onMount: (m, close) => m.querySelector('#rsOk').addEventListener('click', async () => {
      close();
      if (!keepPin) Vault.wipe();
      data.settings = { ...(data.settings || {}), lastBackupAt: obj.createdAt };
      hydrate(data);
      await Vault.save(serialize());
      toast('กู้คืนข้อมูลเรียบร้อย');
      if (Vault.hasKey()) startApp();
      else showSetPin({ allowSkip: true, onDone: startApp });
    }),
  });
}

/* ---------- ล็อกอัตโนมัติเมื่อไม่มีการใช้งาน ---------- */
let lastActivity = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));

async function lockNow() {
  if (!state || !Vault.hasKey()) return;
  clearTimeout(saveTimer);
  recordSnapshot();
  await Vault.save(serialize());
  Vault.lock();
  state = null;
  document.getElementById('view').innerHTML = '';
  showLock();
}

setInterval(() => {
  if (!state || !Vault.hasKey()) return;
  const mins = state.settings.autoLockMinutes;
  if (mins > 0 && Date.now() - lastActivity > mins * 60000) lockNow();
}, 10000);
