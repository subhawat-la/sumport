'use strict';

/* ---------- Shared UI helpers ---------- */
const kpi = (label, value, sub = '', extraCls = '') => `
  <div class="card kpi ${extraCls}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;

const typeBadge = (t) => `<span class="badge" style="--c:${t.color}">${t.icon} ${esc(t.label)}</span>`;

const assetCell = (h, t) => `
  <div class="asset-cell">
    <span class="asset-icon" style="--c:${t.color}">${t.icon}</span>
    <div><div class="asset-name">${esc(h.name)}</div>
    <div class="asset-meta">${h.symbol ? `<b>${esc(h.symbol)}</b> · ` : ''}${esc(h.platform || '-')}${h.currency !== 'THB' ? ` · ${h.currency}` : ''}</div></div>
  </div>`;

const plCell = (pl, plPct, cur = 'THB') => (pl === null
  ? '<span class="muted small">ไม่ระบุต้นทุน</span>'
  : `<div class="${cls(pl)}"><div>${moneyS(pl, cur)}</div><div class="small">${pct(plPct)}</div></div>`);

const emptyState = (msg, action = '') => `<div class="empty"><div class="empty-icon">🗂️</div><p>${msg}</p>${action}</div>`;

const STALE_DAYS = 7;
const isStale = (h) => TYPE[h.type].mode !== 'amount' && daysSince((h.priceDate || '2000-01-01') + 'T00:00:00') > STALE_DAYS;

function dashboardBanners() {
  const s = state.settings;
  const out = [];
  if (s.demo) out.push('<div class="banner demo">🧪 กำลังใช้ <b>ข้อมูลตัวอย่าง</b> — พร้อมใช้งานจริงเมื่อไหร่ ไปที่ <a class="link" href="#/settings">ตั้งค่า</a> แล้วกด “เริ่มใช้งานจริง”</div>');
  if (!Vault.hasKey()) out.push('<div class="banner warn">⚠️ ข้อมูลยังไม่ได้เข้ารหัส — <a class="link" href="#" data-action="set-pin">ตั้ง PIN</a> เพื่อปกป้องข้อมูลการเงินของคุณ</div>');
  const days = daysSince(s.lastBackupAt);
  if (state.holdings.length && days >= s.backupReminderDays) {
    out.push(`<div class="banner warn">💾 ${s.lastBackupAt ? `สำรองข้อมูลล่าสุดเมื่อ ${days} วันก่อน` : 'ยังไม่เคยสำรองข้อมูล'} — ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น
      <button class="btn btn-sm btn-primary" data-action="export-backup">สำรองข้อมูลตอนนี้</button></div>`);
  }
  return out.join('');
}

/* ---------- Dashboard ---------- */
function viewDashboard() {
  if (!state.holdings.length) {
    return {
      title: 'ภาพรวมสินทรัพย์',
      sub: state.profile.displayName || 'เริ่มต้นใช้งาน',
      html: `${dashboardBanners()}<div class="card">${emptyState('ยังไม่มีสินทรัพย์ เริ่มจากเพิ่มสินทรัพย์รายการแรก เช่น กองทุน RMF, PVD หรือเงินฝาก',
        '<a class="btn btn-primary" href="#/add">+ เพิ่มสินทรัพย์รายการแรก</a>')}</div>`,
    };
  }
  const { rows, total, byType, byGroup } = portfolio();
  const segs = byType.map((g) => ({ label: g.t.label, value: g.value, color: g.t.color }));
  const history = seriesForChart(state.snapshots, ui.chartRange);
  const top = [...rows].sort((a, b) => b.p.valueTHB - a.p.valueTHB).slice(0, 5);
  const movers = rows.filter((r) => r.p.plPct !== null && r.t.mode !== 'amount').sort((a, b) => b.p.plPct - a.p.plPct);
  const gainers = movers.filter((r) => r.p.plPct >= 0).slice(0, 3);
  const losers = movers.filter((r) => r.p.plPct < 0).slice(-3).reverse();
  const stale = rows.filter((r) => isStale(r.h)).sort((a, b) => a.h.priceDate.localeCompare(b.h.priceDate));
  const monthAgo = isoDate(new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, TODAY.getDate()));
  const base = [...state.snapshots].reverse().find((p) => p.date <= monthAgo);
  const monthChange = base ? total.value - base.value : null;
  const rangeChips = [['3M', '3 เดือน'], ['1Y', '1 ปี'], ['ALL', 'ทั้งหมด']]
    .map(([k, l]) => `<button class="chip sm ${ui.chartRange === k ? 'active' : ''}" data-action="chart-range" data-id="${k}">${l}</button>`).join('');

  const moverRow = (r) => `
    <li class="clickable" data-href="#/holding/${r.h.id}">
      <span class="asset-icon sm" style="--c:${r.t.color}">${r.t.icon}</span>
      <span class="grow"><b>${esc(r.h.symbol || r.h.name)}</b><span class="muted small block">${esc(r.t.label)}</span></span>
      <span class="${cls(r.p.plPct)} right"><b>${pct(r.p.plPct)}</b><span class="small block">${moneyS(r.p.plTHB, 'THB', 0)}</span></span>
    </li>`;

  const html = `
  ${dashboardBanners()}
  <div class="grid kpis">
    ${kpi('มูลค่าสินทรัพย์รวม', money(total.value), monthChange === null ? 'ประวัติจะสะสมทุกวันที่เปิดแอป' : `<span class="${cls(monthChange)}">${moneyS(monthChange, 'THB', 0)}</span> จาก 1 เดือนก่อน`, 'kpi-hero')}
    ${kpi('จำนวนสินทรัพย์', `${rows.length} รายการ`, `${byType.length} ประเภท · ${byGroup.length} หมวดงบดุล`)}
    ${kpi('กำไร/ขาดทุนที่ยังไม่รับรู้', total.plPct === null ? '<span class="muted">-</span>' : `<span class="${cls(total.pl)}">${moneyS(total.pl)}</span>`,
      total.plPct === null ? 'ระบุต้นทุนในแต่ละสินทรัพย์เพื่อดูกำไร/ขาดทุน' : `<span class="${cls(total.pl)}">${pct(total.plPct)}</span> · คิดจาก ${total.costCount}/${rows.length} รายการที่ระบุต้นทุน`)}
    ${kpi('ราคาที่ควรอัปเดต', `${stale.length} รายการ`, stale.length ? `ราคาเก่ากว่า ${STALE_DAYS} วัน · <a class="link" href="#/prices">อัปเดตเลย</a>` : 'ราคาเป็นปัจจุบันทั้งหมด ✓')}
  </div>

  <div class="grid two">
    <div class="card">
      <div class="card-head"><h3>สัดส่วนสินทรัพย์ (Asset Allocation)</h3><a href="#/holdings" class="link">ดูทั้งหมด →</a></div>
      <div class="alloc">
        ${Charts.donut(segs, { title: compact(total.value), subtitle: 'มูลค่ารวม' })}
        <ul class="legend">
          ${byType.map((g) => `<li><a href="#/holdings?type=${g.t.key}">
            <span class="dot" style="background:${g.t.color}"></span><span class="lg-name">${esc(g.t.label)}</span>
            <span class="lg-val">${share(g.share)}</span></a></li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>มูลค่าสินทรัพย์ย้อนหลัง</h3><div class="chips">${rangeChips}</div></div>
      ${history.length > 1 ? Charts.line(history, { format: (v) => compact(v) })
        : '<div class="empty small">📈 กราฟจะเริ่มแสดงเมื่อมีข้อมูลอย่างน้อย 2 วัน — ระบบบันทึกมูลค่ารวมอัตโนมัติทุกวันที่เปิดแอป</div>'}
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h3>สรุปตามหมวดงบดุลส่วนบุคคล</h3>
      <button class="btn btn-sm btn-primary" data-action="export-excel">📊 Export Excel</button></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>หมวด / ประเภทสินทรัพย์</th><th class="r">จำนวนรายการ</th><th class="r">มูลค่า (บาท)</th><th class="share-col">สัดส่วน</th></tr></thead>
      <tbody>
        ${byGroup.map((G) => `<tr class="group-row"><td>${esc(G.g.name)}</td><td class="r">${G.count}</td><td class="r">${money(G.value)}</td><td>${share(G.share)}</td></tr>
          ${G.types.map((g) => `<tr class="clickable" data-href="#/holdings?type=${g.t.key}">
            <td class="indent">${typeBadge(g.t)} <span class="small muted">${esc(g.t.name)}</span></td><td class="r">${g.count}</td>
            <td class="r"><b>${money(g.value)}</b></td>
            <td><div class="bar"><span style="width:${g.share}%;background:${g.t.color}"></span></div><span class="small">${share(g.share)}</span></td>
          </tr>`).join('')}`).join('')}
      </tbody>
      <tfoot><tr><td>รวมสินทรัพย์ทั้งหมด</td><td class="r">${rows.length}</td><td class="r">${money(total.value)}</td><td>100%</td></tr></tfoot>
    </table></div>
  </div>

  <div class="grid three">
    <div class="card">
      <div class="card-head"><h3>สินทรัพย์มูลค่าสูงสุด 5 อันดับ</h3></div>
      <ul class="list">
        ${top.map((r, i) => `<li class="clickable" data-href="#/holding/${r.h.id}">
          <span class="rank">${i + 1}</span>
          <span class="grow"><b>${esc(r.h.name)}</b><span class="muted small block">${esc(r.t.label)} · ${share(r.share)}</span></span>
          <span class="right"><b>${money(r.p.valueTHB, 'THB', 0)}</b></span></li>`).join('')}
      </ul>
    </div>
    <div class="card">
      <div class="card-head"><h3>ผลตอบแทนเด่น / ด้อย</h3></div>
      ${movers.length ? `
        <div class="muted small section-label">▲ กำไรสูงสุด</div>
        <ul class="list">${gainers.length ? gainers.map(moverRow).join('') : '<li class="muted small">ไม่มีรายการที่กำไร</li>'}</ul>
        <div class="muted small section-label">▼ ขาดทุน</div>
        <ul class="list">${losers.length ? losers.map(moverRow).join('') : '<li class="muted small">ไม่มีรายการที่ขาดทุน 🎉</li>'}</ul>`
        : '<p class="muted small">ระบุต้นทุนในหน้าแก้ไขสินทรัพย์เพื่อดูผลตอบแทน</p>'}
    </div>
    <div class="card">
      <div class="card-head"><h3>ราคาที่ควรอัปเดต</h3><a href="#/prices" class="link">อัปเดต →</a></div>
      <ul class="list">
        ${stale.length ? stale.slice(0, 6).map((r) => `<li class="clickable" data-href="#/holding/${r.h.id}">
          <span class="asset-icon sm" style="--c:${r.t.color}">${r.t.icon}</span>
          <span class="grow"><b>${esc(r.h.symbol || r.h.name)}</b><span class="muted small block">${esc(r.t.label)}</span></span>
          <span class="right small warn-text">${dateTH(r.h.priceDate)}<span class="muted block">${daysSince(r.h.priceDate + 'T00:00:00')} วันก่อน</span></span></li>`).join('')
          : '<li class="muted small">ราคาทุกรายการอัปเดตภายใน 7 วัน ✓</li>'}
      </ul>
    </div>
  </div>`;

  return { title: 'ภาพรวมสินทรัพย์', sub: `${state.profile.displayName ? state.profile.displayName + ' · ' : ''}ข้อมูล ณ ${dateTH(AS_OF)}`, html };
}

/* ---------- Holdings list ---------- */
function viewHoldings(route) {
  ui.holdings.type = route.query.type && TYPE[route.query.type] ? route.query.type : 'ALL';
  const { byType } = portfolio();
  const chips = [{ key: 'ALL', label: 'ทั้งหมด', icon: '' }, ...byType.map((g) => g.t)]
    .map((t) => `<a class="chip ${ui.holdings.type === t.key ? 'active' : ''}" href="#/holdings${t.key === 'ALL' ? '' : '?type=' + t.key}">${t.icon || ''} ${esc(t.label)}</a>`).join('');

  const html = `
  <div class="toolbar">
    <div class="chips">${chips}</div>
  </div>
  <div class="toolbar">
    <input class="input search" id="hSearch" placeholder="🔍 ค้นหาชื่อ, รหัส, แพลตฟอร์ม..." value="${esc(ui.holdings.q)}">
    <select class="input" id="hSort">
      ${[['value-desc', 'มูลค่า: มาก → น้อย'], ['value-asc', 'มูลค่า: น้อย → มาก'], ['pl-desc', '% กำไร: มาก → น้อย'], ['pl-asc', '% กำไร: น้อย → มาก'], ['name-asc', 'ชื่อ A → Z']]
        .map(([v, l]) => `<option value="${v}" ${ui.holdings.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <label class="switch"><input type="checkbox" id="hGroup" ${ui.holdings.group ? 'checked' : ''}><span>จัดกลุ่มตามประเภท</span></label>
    <span class="grow"></span>
    <button class="btn" data-action="export-excel">📊 Export Excel</button>
    <a class="btn" href="#/prices">🔄 อัปเดตยอด/ราคา</a>
    <a class="btn btn-primary" href="#/add${ui.holdings.type !== 'ALL' ? '?type=' + ui.holdings.type : ''}">+ เพิ่มสินทรัพย์</a>
  </div>
  <div id="holdingsTable"></div>`;

  const mount = () => {
    renderHoldingsTable();
    document.getElementById('hSearch').addEventListener('input', (e) => { ui.holdings.q = e.target.value; renderHoldingsTable(); });
    document.getElementById('hSort').addEventListener('change', (e) => { ui.holdings.sort = e.target.value; renderHoldingsTable(); });
    document.getElementById('hGroup').addEventListener('change', (e) => { ui.holdings.group = e.target.checked; renderHoldingsTable(); });
  };
  const sub = ui.holdings.type === 'ALL' ? 'ยอดคงเหลือปัจจุบันของสินทรัพย์ทั้งหมด' : TYPE[ui.holdings.type].name;
  return { title: 'สินทรัพย์ของฉัน', sub, html, mount };
}

function renderHoldingsTable() {
  const { rows, total } = portfolio();
  const f = ui.holdings;
  const q = f.q.trim().toLowerCase();
  const list = rows.filter((r) => (f.type === 'ALL' || r.h.type === f.type)
    && (!q || [r.h.name, r.h.symbol, r.h.platform, r.t.label].some((s) => (s || '').toLowerCase().includes(q))));
  const [key, dir] = f.sort.split('-');
  const sign = dir === 'asc' ? 1 : -1;
  const plKey = (r) => (r.p.plPct === null ? (dir === 'asc' ? Infinity : -Infinity) : r.p.plPct);
  const sorters = { value: (a, b) => a.p.valueTHB - b.p.valueTHB, pl: (a, b) => plKey(a) - plKey(b), name: (a, b) => a.h.name.localeCompare(b.h.name, 'th') };
  list.sort((a, b) => sign * sorters[key](a, b));

  const sumValue = list.reduce((a, r) => a + r.p.valueTHB, 0);
  const withCost = list.filter((r) => r.p.costTHB !== null);
  const sumCost = withCost.reduce((a, r) => a + r.p.costTHB, 0);
  const sumPl = withCost.reduce((a, r) => a + r.p.plTHB, 0);

  const row = (r) => {
    const amt = r.t.mode === 'amount';
    return `<tr class="clickable" data-href="#/holding/${r.h.id}">
      <td>${assetCell(r.h, r.t)}</td>
      <td>${typeBadge(r.t)}</td>
      <td class="r">${amt ? '<span class="muted">-</span>' : `${qty(r.p.units, r.h.type)}<div class="muted small">${esc(r.t.unitLabel)}</div>`}</td>
      <td class="r">${amt ? `<span class="small">${r.h.extra.interestRate ?? '-'}% ต่อปี</span>` : `${priceFmt(r.h.price, r.h.currency, r.h.type)}<div class="small ${isStale(r.h) ? 'warn-text' : 'muted'}" title="${isAuto(r.h) ? 'อัปเดตอัตโนมัติ' : 'กรอกเอง'}">${isAuto(r.h) ? '⚡ ' : ''}${dateTH(r.h.priceDate)}</div>`}</td>
      <td class="r"><b>${money(r.p.valueTHB)}</b>${r.h.currency !== 'THB' ? `<div class="muted small">${money(r.p.value, r.h.currency)}</div>` : ''}</td>
      <td class="r">${r.p.costTHB === null ? '<span class="muted">-</span>' : money(r.p.costTHB)}</td>
      <td class="r">${plCell(r.p.plTHB, r.p.plPct)}</td>
      <td class="r">${share(r.share)}</td>
      <td class="r"><button class="icon-btn sm edit" title="อัปเดตยอด/ราคา" data-action="update-price" data-id="${r.h.id}">✏️</button></td>
    </tr>`;
  };

  let body;
  if (!list.length) {
    body = `<tr><td colspan="9">${emptyState(state.holdings.length ? 'ไม่พบสินทรัพย์ตามเงื่อนไขที่เลือก' : 'ยังไม่มีสินทรัพย์', state.holdings.length ? '' : '<a class="btn btn-primary" href="#/add">+ เพิ่มสินทรัพย์</a>')}</td></tr>`;
  } else if (f.group) {
    body = ASSET_TYPES.map((t) => {
      const g = list.filter((r) => r.h.type === t.key);
      if (!g.length) return '';
      const v = g.reduce((a, r) => a + r.p.valueTHB, 0);
      return `<tr class="group-row"><td colspan="4"><span class="dot" style="background:${t.color}"></span> ${esc(t.name)} <span class="muted">(${g.length})</span></td>
        <td class="r"><b>${money(v)}</b></td><td colspan="2"></td><td class="r">${share(total.value ? (v / total.value) * 100 : 0)}</td><td></td></tr>`
        + g.map(row).join('');
    }).join('');
  } else {
    body = list.map(row).join('');
  }

  document.getElementById('holdingsTable').innerHTML = `
  <div class="summary-strip">
    <div><span class="muted small">จำนวนรายการ</span><b>${list.length}</b></div>
    <div><span class="muted small">มูลค่ารวม (บาท)</span><b>${money(sumValue)}</b></div>
    <div><span class="muted small">ต้นทุน (เฉพาะที่ระบุ)</span><b>${withCost.length ? money(sumCost) : '-'}</b></div>
    <div><span class="muted small">กำไร/ขาดทุน (เฉพาะที่ระบุต้นทุน)</span><b class="${cls(sumPl)}">${withCost.length ? `${moneyS(sumPl)} (${pct(sumCost ? (sumPl / sumCost) * 100 : 0)})` : '-'}</b></div>
  </div>
  <div class="card flush"><div class="table-wrap"><table class="table">
    <thead><tr><th>สินทรัพย์</th><th>ประเภท</th><th class="r">จำนวนที่ถือครอง</th><th class="r">ราคา/NAV ล่าสุด</th>
      <th class="r">มูลค่า (บาท)</th><th class="r">ต้นทุน</th><th class="r">กำไร/ขาดทุน</th><th class="r">% พอร์ต</th><th></th></tr></thead>
    <tbody>${body}</tbody>
  </table></div></div>`;
}
