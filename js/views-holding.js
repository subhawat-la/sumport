'use strict';

/* ---------- Holding detail ---------- */
function viewHolding(route) {
  const h = getHolding(route.id);
  if (!h) return viewNotFound();
  const t = TYPE[h.type];
  const p = calcPosition(h);
  const amt = t.mode === 'amount';
  const usd = h.currency !== 'THB';
  const { total } = portfolio();
  const portShare = total.value ? (p.valueTHB / total.value) * 100 : 0;
  const plKpi = kpi('กำไร/ขาดทุนที่ยังไม่รับรู้', p.pl === null ? '<span class="muted">-</span>' : `<span class="${cls(p.pl)}">${moneyS(p.plTHB)}</span>`,
    p.pl === null ? `<a href="#/edit/${h.id}" class="link">ระบุต้นทุน</a> เพื่อดูกำไร/ขาดทุน` : `<span class="${cls(p.pl)}">${pct(p.plPct)}</span>`);

  const kpis = amt ? [
    kpi('ยอดคงเหลือปัจจุบัน', money(p.valueTHB), `${share(portShare)} ของพอร์ต${usd ? ` · ${money(p.value, h.currency)}` : ''}`, 'kpi-hero'),
    kpi('อัตราดอกเบี้ย', h.extra.interestRate != null ? `${h.extra.interestRate}% ต่อปี` : '-', h.extra.maturityDate ? `ครบกำหนด ${dateTH(h.extra.maturityDate)}` : 'ไม่มีวันครบกำหนด'),
    kpi('เงินต้น (ถ้าระบุ)', p.costTHB === null ? '<span class="muted">-</span>' : money(p.costTHB), 'ใช้คำนวณดอกเบี้ยสะสม'),
    plKpi,
  ] : [
    kpi('มูลค่าปัจจุบัน', money(p.valueTHB), usd ? `${money(p.value, h.currency)} @ ${nf(2).format(p.fx)}` : `${share(portShare)} ของพอร์ต`, 'kpi-hero'),
    kpi(`จำนวนที่ถือครอง (${t.unitLabel})`, qty(p.units, h.type), h.updatedAt ? `แก้ไขล่าสุด ${dateTH(h.updatedAt)}` : ''),
    kpi(`${t.priceLabel} ล่าสุด`, priceFmt(h.price, h.currency, h.type), `${isAuto(h) ? '⚡ ' : ''}ณ ${dateTH(h.priceDate)}${isStale(h) ? ' <span class="warn-text">(ควรอัปเดต)</span>' : ''}`),
    kpi('ต้นทุนรวม (ถ้าระบุ)', p.costTHB === null ? '<span class="muted">-</span>' : money(p.costTHB), p.avgCost !== null ? `เฉลี่ย ${priceFmt(p.avgCost, h.currency, h.type)}/${t.unitLabel}` : 'ไม่บังคับ'),
    plKpi,
  ];

  const extras = (EXTRA_FIELDS[h.type] || []).map((f) => {
    let v = h.extra[f.key];
    if (v === undefined || v === '') v = '-';
    else if (f.type === 'date') v = dateTH(v);
    return `<div><dt>${esc(f.label)}</dt><dd>${esc(v)}</dd></div>`;
  }).join('');

  const html = `
  <div class="crumbs"><a href="#/holdings">สินทรัพย์</a> / <a href="#/holdings?type=${t.key}">${esc(t.label)}</a> / <span>${esc(h.symbol || h.name)}</span></div>
  <div class="card detail-head">
    <span class="asset-icon lg" style="--c:${t.color}">${t.icon}</span>
    <div class="grow">
      <h2>${esc(h.name)}</h2>
      <div class="asset-meta">${typeBadge(t)} ${h.symbol ? `<span class="tag">${esc(h.symbol)}</span>` : ''} <span>📍 ${esc(h.platform || '-')}</span> <span>💱 ${h.currency}</span></div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" data-action="update-price" data-id="${h.id}">🔄 ${amt ? 'อัปเดตยอดคงเหลือ' : 'อัปเดตจำนวน/ราคา'}</button>
      <a class="btn" href="#/edit/${h.id}">✏️ แก้ไขข้อมูล</a>
      <button class="btn btn-danger-ghost" data-action="delete-holding" data-id="${h.id}">🗑 ลบ</button>
    </div>
  </div>

  <div class="grid ${amt ? 'kpis' : 'kpis five'}">${kpis.join('')}</div>

  <div class="grid two">
    ${amt ? '' : `<div class="card">
      <div class="card-head"><h3>${esc(t.priceLabel)} ย้อนหลัง</h3><div class="chips">${[['3M', '3 เดือน'], ['1Y', '1 ปี'], ['ALL', 'ทั้งหมด']]
        .map(([k, l]) => `<button class="chip sm ${ui.chartRange === k ? 'active' : ''}" data-action="chart-range" data-id="${k}">${l}</button>`).join('')}</div></div>
      ${(() => {
        const pts = seriesForChart((h.priceHistory || []).map((x) => ({ date: x.date, value: x.price })), ui.chartRange);
        return pts.length > 1 ? Charts.line(pts, { color: t.color, format: (v) => priceFmt(v, h.currency, h.type) })
          : '<div class="empty small">📈 กราฟจะแสดงเมื่อมีการอัปเดตราคาอย่างน้อย 2 วัน</div>';
      })()}
    </div>`}
    <div class="card">
      <div class="card-head"><h3>ข้อมูลสินทรัพย์</h3><a class="link" href="#/edit/${h.id}">แก้ไข →</a></div>
      <dl class="dl">
        <div><dt>ประเภท</dt><dd>${esc(t.name)}</dd></div>
        <div><dt>หมวดงบดุล</dt><dd>${esc(BS_GROUPS.find((g) => g.key === t.bs).name)}</dd></div>
        <div><dt>แพลตฟอร์ม / ผู้ดูแล</dt><dd>${esc(h.platform || '-')}</dd></div>
        ${amt ? '' : `<div><dt>แหล่งราคา</dt><dd>${isAuto(h) ? `⚡ อัตโนมัติ · ${esc(PRICE_PROVIDERS[h.type].name)} (${esc(sourceIdOf(h) || '-')})` : '✍️ กรอกเอง'}</dd></div>`}
        ${extras}
        <div class="full"><dt>หมายเหตุ</dt><dd>${esc(h.note || '-')}</dd></div>
      </dl>
    </div>
  </div>`;

  return { title: h.name, sub: `${t.name}${h.symbol ? ' · ' + h.symbol : ''}`, html, nav: 'holdings' };
}

/* ---------- Add / Edit holding ---------- */
function viewForm(route) {
  const editing = route.name === 'edit';
  const h = editing ? getHolding(route.id) : null;
  if (editing && !h) return viewNotFound();
  const typeKey = editing ? h.type : route.query.type;
  if (!typeKey || !TYPE[typeKey]) return typePicker();

  const t = TYPE[typeKey];
  const amt = t.mode === 'amount';
  const v = (k, d = '') => esc(h ? h[k] ?? d : d);
  const xv = (k) => esc(h ? h.extra[k] ?? '' : '');
  const cur = h ? h.currency : t.defaultCurrency || 'THB';

  const field = (f) => {
    const name = 'x_' + f.key;
    if (f.type === 'select') {
      return `<label class="field"><span>${esc(f.label)}</span><select class="input" name="${name}">
        ${f.options.map((o) => `<option value="${esc(o)}" ${String(h?.extra[f.key] ?? '') === o ? 'selected' : ''}>${o ? esc(o) : '— เลือก —'}</option>`).join('')}</select></label>`;
    }
    return `<label class="field"><span>${esc(f.label)}</span><input class="input" name="${name}" type="${f.type}" ${f.type === 'number' ? 'step="any" min="0"' : ''}
      placeholder="${esc(f.placeholder || '')}" value="${xv(f.key)}"></label>`;
  };

  const html = `
  <div class="crumbs"><a href="#/holdings">สินทรัพย์</a> / ${editing ? `<a href="#/holding/${h.id}">${esc(h.name)}</a> / แก้ไข` : '<a href="#/add">เพิ่มสินทรัพย์</a> / ' + esc(t.label)}</div>
  <div class="form-layout">
    <form id="holdingForm" class="card form" autocomplete="off">
      <div class="form-type">${typeBadge(t)} <span class="muted small">${esc(t.name)}</span>
        ${editing ? '' : '<a class="link small" href="#/add">เปลี่ยนประเภท</a>'}</div>

      <h4>ข้อมูลสินทรัพย์</h4>
      <div class="form-grid">
        <label class="field span2"><span>ชื่อสินทรัพย์ *</span><input class="input" name="name" required value="${v('name')}" placeholder="เช่น ${amt ? 'ฝากประจำ 12 เดือน' : t.key === 'STOCK_TH' ? 'ปตท.' : 'SCB Global Equity RMF'}"></label>
        <label class="field"><span>${amt ? 'เลขที่บัญชี (4 ตัวท้าย)' : 'รหัส / สัญลักษณ์'}</span><input class="input" name="symbol" value="${v('symbol')}" placeholder="${amt ? 'xxx-1234' : 'เช่น PTT, BTC, SCBRMGLOB'}"></label>
        <label class="field"><span>แพลตฟอร์ม / ผู้ดูแล</span><input class="input" name="platform" list="platforms" value="${v('platform')}" placeholder="เช่น SCB Easy"></label>
        <label class="field"><span>สกุลเงิน</span><select class="input" name="currency">
          ${['THB', 'USD'].map((c) => `<option ${cur === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        ${(EXTRA_FIELDS[typeKey] || []).map(field).join('')}
      </div>
      <datalist id="platforms">${PLATFORMS.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>

      <h4>ยอดปัจจุบัน</h4>
      <div class="form-grid">
        ${amt
          ? `<label class="field"><span>ยอดเงินคงเหลือ *</span><input class="input" type="number" step="any" min="0" name="balance" required value="${v('balance')}"></label>
             <label class="field"><span>เงินต้น (ไม่บังคับ)</span><input class="input" type="number" step="any" min="0" name="cost" value="${h?.cost ?? ''}" placeholder="ใช้คำนวณดอกเบี้ยสะสม"></label>`
          : `<label class="field"><span>จำนวนที่ถือครอง (${esc(t.unitLabel)}) *</span><input class="input" type="number" step="any" min="0" name="units" required value="${v('units')}"></label>
             <label class="field"><span>${esc(t.priceLabel)} ล่าสุด *</span><input class="input" type="number" step="any" min="0" name="price" required value="${v('price')}"></label>
             <label class="field"><span>ราคา ณ วันที่</span><input class="input" type="date" name="priceDate" value="${v('priceDate', AS_OF)}" max="${AS_OF}"></label>
             <label class="field"><span>ต้นทุนรวม (ไม่บังคับ)</span><input class="input" type="number" step="any" min="0" name="cost" value="${h?.cost ?? ''}" placeholder="ใช้คำนวณกำไร/ขาดทุน"></label>`}
        ${PRICE_PROVIDERS[typeKey] ? `
          <label class="switch span2"><input type="checkbox" name="autoPrice" ${h?.autoPrice === false ? '' : 'checked'}>
            <span>⚡ อัปเดตราคาอัตโนมัติจาก ${esc(PRICE_PROVIDERS[typeKey].name)}${PRICE_PROVIDERS[typeKey].needsKey && !state.settings.apiKeys.twelveData ? ' <span class="warn-text">(ต้องใส่ API key ที่หน้าตั้งค่า)</span>' : ''}</span></label>
          <label class="field"><span>${esc(PRICE_PROVIDERS[typeKey].idLabel)} (เว้นว่าง = ใช้รหัสสินทรัพย์)</span>
            <input class="input" name="sourceId" value="${esc(h?.sourceId || '')}" placeholder="${esc(PRICE_PROVIDERS[typeKey].idHint)}"></label>`
          : amt ? '' : '<p class="span2 muted small">✍️ ราคาสินทรัพย์ประเภทนี้อัปเดตด้วยการกรอกเองที่หน้า “อัปเดตยอด/ราคา”</p>'}
      </div>

      <h4>หมายเหตุ</h4>
      <textarea class="input" name="note" rows="2" placeholder="บันทึกเพิ่มเติม (ถ้ามี)">${v('note')}</textarea>

      <div class="form-actions">
        <a class="btn" href="${editing ? '#/holding/' + h.id : '#/holdings'}">ยกเลิก</a>
        <button class="btn btn-primary" type="submit">${editing ? 'บันทึกการแก้ไข' : 'เพิ่มสินทรัพย์'}</button>
      </div>
    </form>

    <aside class="card preview" id="formPreview"></aside>
  </div>`;

  const mount = () => {
    const form = document.getElementById('holdingForm');
    const preview = () => renderFormPreview(form, t);
    form.addEventListener('input', preview);
    form.addEventListener('submit', (e) => { e.preventDefault(); saveHolding(form, t, h); });
    preview();
  };

  return { title: editing ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์ใหม่', sub: t.name, html, mount, nav: 'holdings' };
}

function renderFormPreview(form, t) {
  const fd = new FormData(form);
  const num = (k) => parseFloat(fd.get(k)) || 0;
  const cur = fd.get('currency');
  const value = t.mode === 'amount' ? num('balance') : num('units') * num('price');
  const cost = num('cost');
  const pl = value - cost;
  const fx = state.fx[cur] || 1;
  document.getElementById('formPreview').innerHTML = `
    <h3>ตัวอย่างผลลัพธ์</h3>
    <div class="preview-row"><span>มูลค่าปัจจุบัน</span><b>${money(value, cur)}</b></div>
    ${cur !== 'THB' ? `<div class="preview-row"><span>มูลค่าเป็นบาท</span><b>${money(value * fx)}</b></div>` : ''}
    <div class="preview-row"><span>ต้นทุน</span><b>${cost ? money(cost, cur) : '<span class="muted">ไม่ระบุ</span>'}</b></div>
    <div class="preview-row"><span>กำไร/ขาดทุน</span><b class="${cost ? cls(pl) : ''}">${cost ? `${moneyS(pl, cur)} (${pct((pl / cost) * 100)})` : '-'}</b></div>
    <div class="hint">💡 ${esc(t.hint)}</div>`;
}

function saveHolding(form, t, h) {
  const fd = new FormData(form);
  const num = (k) => parseFloat(fd.get(k));
  const extra = {};
  (EXTRA_FIELDS[t.key] || []).forEach((f) => {
    const raw = (fd.get('x_' + f.key) || '').trim();
    if (raw !== '') extra[f.key] = f.type === 'number' ? parseFloat(raw) : raw;
  });
  const cost = num('cost');
  const base = {
    name: fd.get('name').trim(),
    symbol: fd.get('symbol').trim(),
    platform: fd.get('platform').trim(),
    currency: fd.get('currency'),
    note: fd.get('note').trim(),
    cost: cost > 0 ? cost : null,
    extra,
  };
  if (PRICE_PROVIDERS[t.key]) {
    base.autoPrice = fd.get('autoPrice') === 'on';
    base.sourceId = (fd.get('sourceId') || '').trim();
  }
  if (t.mode === 'amount') base.balance = num('balance');
  else base.units = num('units');

  const target = h || { id: uid('h'), type: t.key, priceHistory: [] };
  const changedAmount = !h || (t.mode === 'amount' ? h.balance !== base.balance : h.units !== base.units);
  Object.assign(target, base);
  if (changedAmount) target.updatedAt = AS_OF;
  if (t.mode !== 'amount') {
    const newPrice = num('price');
    const newDate = fd.get('priceDate') || AS_OF;
    if (target.price !== newPrice || target.priceDate !== newDate) setPrice(target, newPrice, newDate, 'manual');
  }
  if (!h) state.holdings.push(target);
  saveSoon();
  toast(h ? 'บันทึกการแก้ไขเรียบร้อย' : 'เพิ่มสินทรัพย์เรียบร้อย');
  location.hash = '#/holding/' + target.id;
}

function typePicker() {
  const html = `
  <div class="crumbs"><a href="#/holdings">สินทรัพย์</a> / เพิ่มสินทรัพย์</div>
  <p class="muted">เลือกประเภทสินทรัพย์ที่ต้องการบันทึก — แบบฟอร์มจะปรับช่องข้อมูลให้เหมาะกับประเภทที่เลือก</p>
  <div class="type-grid">
    ${ASSET_TYPES.map((t) => `<a class="type-card" href="#/add?type=${t.key}" style="--c:${t.color}">
      <span class="type-icon">${t.icon}</span><b>${esc(t.label)}</b><span class="muted small">${esc(t.desc)}</span></a>`).join('')}
  </div>`;
  return { title: 'เพิ่มสินทรัพย์ใหม่', sub: 'ขั้นตอนที่ 1: เลือกประเภทสินทรัพย์', html, nav: 'holdings' };
}

function viewNotFound() {
  return { title: 'ไม่พบหน้าที่ต้องการ', sub: '', html: emptyState('ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว', '<a class="btn btn-primary" href="#/dashboard">กลับหน้าภาพรวม</a>') };
}
