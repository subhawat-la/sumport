'use strict';

/*
 * สร้างไฟล์ Excel (.xlsx) ในเบราว์เซอร์โดยไม่พึ่งไลบรารีภายนอก (ใช้งานออฟไลน์ได้)
 * .xlsx คือไฟล์ ZIP ที่บรรจุ XML ตามมาตรฐาน Office Open XML — ใช้การบีบอัดแบบ STORE (ไม่บีบอัด)
 */
const Xlsx = (() => {
  const enc = new TextEncoder();

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  function zip(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = enc.encode(f.data);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
    let pos = 0;
    for (const c of all) { out.set(c, pos); pos += c.length; }
    return out;
  }

  const xmlEsc = (s) => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = (i) => {
    let s = '';
    let n = i + 1;
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  // ลำดับต้องตรงกับ cellXfs ใน styles.xml
  const STYLE = {
    TITLE: 1, SUB: 2, HEAD: 3, TEXT: 4, NUM2: 5, NUM4: 6, NUM8: 7, PCT: 8,
    G_TEXT: 9, G_NUM: 10, G_PCT: 11, T_TEXT: 12, T_NUM: 13, T_PCT: 14,
    INPUT: 15, NOTE: 16, INT: 17, INDENT: 18, PL: 19, G_INT: 20, T_INT: 21, CENTER: 22, T_PL: 23,
  };

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.0000"/><numFmt numFmtId="165" formatCode="#,##0.00000000"/><numFmt numFmtId="166" formatCode="#,##0.00;[Red]-#,##0.00"/></numFmts>
<fonts count="5">
<font><sz val="10"/><name val="Tahoma"/><family val="2"/></font>
<font><b/><sz val="10"/><name val="Tahoma"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="FF312E81"/><name val="Tahoma"/><family val="2"/></font>
<font><sz val="9"/><color rgb="FF64748B"/><name val="Tahoma"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Tahoma"/><family val="2"/></font>
</fonts>
<fills count="6">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="24">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="4" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="10" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="4" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="10" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="4" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment indent="2"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="3" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="166" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  // cell: null | number | string | { v, s, f }
  function cellXml(c, ref) {
    if (c === null || c === undefined) return '';
    const cell = typeof c === 'object' ? c : { v: c };
    const a = `r="${ref}"${cell.s ? ` s="${cell.s}"` : ''}`;
    const num = typeof cell.v === 'number' && Number.isFinite(cell.v);
    if (cell.f) return `<c ${a}><f>${xmlEsc(cell.f)}</f>${num ? `<v>${cell.v}</v>` : ''}</c>`;
    if (num) return `<c ${a}><v>${cell.v}</v></c>`;
    if (cell.v === null || cell.v === undefined || cell.v === '' || typeof cell.v === 'number') return `<c ${a}/>`;
    return `<c ${a} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
  }

  function sheetXml({ rows, cols = [], merges = [], freezeRows = 0, autoFilter = null, landscape = false, gridLines = true, selected = false, rowHeights = {} }) {
    const data = rows.map((cells, ri) => {
      if (!cells || !cells.length) return '';
      const r = ri + 1;
      const ht = rowHeights[r] ? ` ht="${rowHeights[r]}" customHeight="1"` : '';
      return `<row r="${r}"${ht}>${cells.map((c, ci) => cellXml(c, colName(ci) + r)).join('')}</row>`;
    }).join('');
    const pane = freezeRows ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"${gridLines ? '' : ' showGridLines="0"'}${selected ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols.length ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}
<sheetData>${data}</sheetData>
${autoFilter ? `<autoFilter ref="${autoFilter}"/>` : ''}
${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  // sheets: [{ name, ...sheetXml options }]
  function build(sheets, { title = '', definedNames = [] } = {}) {
    const created = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEsc(title)}</dc:title><dc:creator>FinancialLog</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
${definedNames.length ? `<definedNames>${definedNames.map((d) => `<definedName name="${d.name}" localSheetId="${d.sheet}" hidden="1">${xmlEsc(d.ref)}</definedName>`).join('')}</definedNames>` : ''}
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
      { name: 'xl/styles.xml', data: STYLES_XML },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
    ];
    return zip(files);
  }

  return { build, STYLE, colName };
})();

/* ---------- Export รายการสินทรัพย์สำหรับทำงบดุลส่วนบุคคล ---------- */
function buildAssetsWorkbook() {
  const { rows, total, byGroup } = portfolio();
  const S = Xlsx.STYLE;
  const owner = state.profile.displayName;
  const dateLong = thaiLongDate(AS_OF);
  const fxNote = `อัตราแลกเปลี่ยน USD/THB = ${state.fx.USD} (${state.fxMeta.source || '-'}${state.fxMeta.date ? ', ณ ' + dateTH(state.fxMeta.date) : ''})`;
  const DETAIL = 'รายการสินทรัพย์';
  const SUMMARY = 'งบดุลส่วนบุคคล';
  const FUND_TYPES = ['SSF', 'RMF', 'THAIESG', 'MF', 'PVD'];

  /* ----- ชีตรายการสินทรัพย์ ----- */
  const order = BS_GROUPS.map((g) => g.key);
  const sorted = [...rows].sort((a, b) => order.indexOf(a.t.bs) - order.indexOf(b.t.bs)
    || ASSET_TYPES.indexOf(a.t) - ASSET_TYPES.indexOf(b.t) || b.p.valueTHB - a.p.valueTHB);
  const HEAD = 5;
  const first = HEAD + 1;
  const last = HEAD + sorted.length;
  const totalRow = last + 1;
  const headers = ['ลำดับ', 'หมวดงบดุล', 'ประเภทสินทรัพย์', 'ชื่อสินทรัพย์', 'รหัส / สัญลักษณ์', 'แพลตฟอร์ม / ผู้ดูแล', 'จำนวนที่ถือครอง', 'หน่วย',
    'ราคา / NAV ต่อหน่วย', 'ราคา ณ วันที่', 'สกุลเงิน', 'มูลค่า (สกุลเงินเดิม)', 'อัตราแลกเปลี่ยน', 'มูลค่า (บาท)', 'สัดส่วนของสินทรัพย์รวม',
    'ต้นทุน (บาท)', 'กำไร/ขาดทุน (บาท)', 'หมายเหตุ'];
  const detail = [
    [{ v: `รายการสินทรัพย์ ณ วันที่ ${dateLong}`, s: S.TITLE }],
    [{ v: owner ? `เจ้าของ: ${owner}` : 'Personal Asset Listing', s: S.SUB }],
    [{ v: fxNote, s: S.NOTE }],
    null,
    headers.map((h) => ({ v: h, s: S.HEAD })),
  ];
  sorted.forEach((r, i) => {
    const n = first + i;
    const h = r.h;
    const amt = r.t.mode === 'amount';
    const unitStyle = r.t.unitDecimals === 0 ? S.INT : r.t.unitDecimals === 8 ? S.NUM8 : S.NUM4;
    const group = BS_GROUPS.find((g) => g.key === r.t.bs).name;
    const dateText = amt ? (h.updatedAt ? dateTH(h.updatedAt) : '-') : dateTH(h.priceDate);
    detail.push([
      { v: i + 1, s: S.CENTER },
      { v: group, s: S.TEXT },
      { v: r.t.name, s: S.TEXT },
      { v: h.name, s: S.TEXT },
      { v: h.symbol || '', s: S.TEXT },
      { v: h.platform || '', s: S.TEXT },
      amt ? { v: '', s: S.TEXT } : { v: r.p.units, s: unitStyle },
      { v: amt ? 'ยอดเงิน' : r.t.unitLabel, s: S.TEXT },
      amt ? { v: '', s: S.TEXT } : { v: Number(h.price) || 0, s: FUND_TYPES.includes(h.type) ? S.NUM4 : S.NUM2 },
      { v: dateText, s: S.CENTER },
      { v: h.currency, s: S.CENTER },
      amt ? { v: r.p.value, s: S.NUM2 } : { f: `G${n}*I${n}`, v: r.p.value, s: S.NUM2 },
      { v: r.p.fx, s: S.NUM4 },
      { f: `L${n}*M${n}`, v: r.p.valueTHB, s: S.NUM2 },
      { f: `IF($N$${totalRow}=0,0,N${n}/$N$${totalRow})`, v: total.value ? r.p.valueTHB / total.value : 0, s: S.PCT },
      r.p.costTHB === null ? { v: '', s: S.NUM2 } : { v: Math.round(r.p.costTHB * 100) / 100, s: S.NUM2 },
      r.p.costTHB === null ? { v: '', s: S.PL } : { f: `N${n}-P${n}`, v: r.p.plTHB, s: S.PL },
      { v: h.note || '', s: S.TEXT },
    ]);
  });
  const costSum = rows.reduce((a, r) => a + (r.p.costTHB || 0), 0);
  const plSum = rows.reduce((a, r) => a + (r.p.plTHB || 0), 0);
  const totalCells = Array.from({ length: 18 }, () => ({ v: '', s: S.T_TEXT }));
  totalCells[0] = { v: 'รวมทั้งหมด', s: S.T_TEXT };
  totalCells[3] = { v: `${sorted.length} รายการ`, s: S.T_TEXT };
  totalCells[13] = { f: `SUM(N${first}:N${last})`, v: total.value, s: S.T_NUM };
  totalCells[14] = { f: `SUM(O${first}:O${last})`, v: 1, s: S.T_PCT };
  totalCells[15] = { f: `SUM(P${first}:P${last})`, v: costSum, s: S.T_NUM };
  totalCells[16] = { f: `SUM(Q${first}:Q${last})`, v: plSum, s: S.T_PL };
  detail.push(totalCells);
  detail.push(null);
  detail.push([{ v: '* กำไร/ขาดทุนแสดงเฉพาะรายการที่ระบุต้นทุน · ต้นทุนสกุลเงินต่างประเทศแปลงเป็นบาทด้วยอัตราแลกเปลี่ยนปัจจุบัน', s: S.NOTE }]);

  /* ----- ชีตงบดุลส่วนบุคคล ----- */
  const ref = (col) => `'${DETAIL}'!$${col}$${first}:$${col}$${last}`;
  const summary = [
    [{ v: 'งบแสดงฐานะการเงินส่วนบุคคล (Personal Balance Sheet)', s: S.TITLE }],
    [{ v: `ณ วันที่ ${dateLong}`, s: S.SUB }],
    [{ v: owner ? `ชื่อ: ${owner}` : '', s: S.SUB }],
    null,
    [{ v: 'สินทรัพย์', s: S.HEAD }, { v: 'จำนวนรายการ', s: S.HEAD }, { v: 'มูลค่า (บาท)', s: S.HEAD }, { v: 'สัดส่วน', s: S.HEAD }],
  ];
  const groupRows = [];
  let assetTotalRow = 0;
  // คำนวณตำแหน่งแถวรวมสินทรัพย์ล่วงหน้า เพื่อใช้ในสูตรสัดส่วน
  assetTotalRow = summary.length + byGroup.reduce((a, G) => a + 1 + G.types.length, 0) + 1;
  for (const G of byGroup) {
    const gRow = summary.length + 1;
    groupRows.push(gRow);
    const tFirst = gRow + 1;
    const tLast = gRow + G.types.length;
    summary.push([
      { v: G.g.name, s: S.G_TEXT },
      { f: `SUM(B${tFirst}:B${tLast})`, v: G.count, s: S.G_INT },
      { f: `SUM(C${tFirst}:C${tLast})`, v: G.value, s: S.G_NUM },
      { f: `IF($C$${assetTotalRow}=0,0,C${gRow}/$C$${assetTotalRow})`, v: total.value ? G.value / total.value : 0, s: S.G_PCT },
    ]);
    for (const g of G.types) {
      const n = summary.length + 1;
      const crit = `"${g.t.name.replace(/"/g, '""')}"`;
      summary.push([
        { v: g.t.name, s: S.INDENT },
        { f: `COUNTIFS(${ref('C')},${crit})`, v: g.count, s: S.INT },
        { f: `SUMIFS(${ref('N')},${ref('C')},${crit})`, v: g.value, s: S.NUM2 },
        { f: `IF($C$${assetTotalRow}=0,0,C${n}/$C$${assetTotalRow})`, v: total.value ? g.value / total.value : 0, s: S.PCT },
      ]);
    }
  }
  summary.push([
    { v: 'รวมสินทรัพย์ (Total Assets)', s: S.T_TEXT },
    { f: groupRows.map((r) => `B${r}`).join('+'), v: rows.length, s: S.T_INT },
    { f: groupRows.map((r) => `C${r}`).join('+'), v: total.value, s: S.T_NUM },
    { v: 1, s: S.T_PCT },
  ]);
  summary.push(null);
  summary.push([{ v: 'หนี้สิน (กรอกเพิ่มเองใน Excel)', s: S.HEAD }, { v: '', s: S.HEAD }, { v: 'มูลค่า (บาท)', s: S.HEAD }, { v: '', s: S.HEAD }]);
  const liabFirst = summary.length + 1;
  ['หนี้สินระยะสั้น (บัตรเครดิต, สินเชื่อส่วนบุคคล)', 'หนี้สินระยะยาว (สินเชื่อบ้าน, สินเชื่อรถยนต์)', 'หนี้สินอื่นๆ']
    .forEach((label) => summary.push([{ v: label, s: S.INDENT }, { v: '', s: S.TEXT }, { v: '', s: S.INPUT }, { v: '', s: S.TEXT }]));
  const liabLast = summary.length;
  summary.push([{ v: 'รวมหนี้สิน (Total Liabilities)', s: S.T_TEXT }, { v: '', s: S.T_TEXT }, { f: `SUM(C${liabFirst}:C${liabLast})`, v: 0, s: S.T_NUM }, { v: '', s: S.T_TEXT }]);
  const liabTotalRow = summary.length;
  summary.push(null);
  summary.push([{ v: 'ความมั่งคั่งสุทธิ (Net Worth = สินทรัพย์ − หนี้สิน)', s: S.T_TEXT }, { v: '', s: S.T_TEXT },
    { f: `C${assetTotalRow}-C${liabTotalRow}`, v: total.value, s: S.T_NUM }, { v: '', s: S.T_TEXT }]);
  summary.push(null);
  const stale = rows.filter((r) => isStale(r.h)).length;
  const notes = [
    'หมายเหตุ',
    `• มูลค่าสินทรัพย์ = จำนวนที่ถือครอง × ราคา/NAV ล่าสุดที่บันทึกไว้ (ดูวันที่ของราคาแต่ละรายการในชีต “${DETAIL}”)`,
    `• ${fxNote}`,
    stale ? `• มี ${stale} รายการที่ราคาเก่ากว่า ${STALE_DAYS} วัน ควรอัปเดตราคาก่อนใช้จัดทำงบ` : '• ราคาทุกรายการอัปเดตภายใน 7 วัน',
    '• ช่องสีเหลืองในส่วนหนี้สินสามารถกรอกเพิ่มได้ ระบบจะคำนวณความมั่งคั่งสุทธิให้อัตโนมัติ',
    `• ส่งออกจาก FinancialLog เมื่อ ${dateTimeTH(new Date().toISOString())}`,
  ];
  const noteStart = summary.length + 1;
  notes.forEach((t) => summary.push([{ v: t, s: S.NOTE }]));

  const merges = ['A1:D1', 'A2:D2', 'A3:D3', ...notes.map((_, i) => `A${noteStart + i}:D${noteStart + i}`)];
  const sheets = [
    { name: SUMMARY, rows: summary, cols: [58, 14, 20, 12], merges, gridLines: false, selected: true, rowHeights: { 1: 24, 5: 20 } },
    { name: DETAIL, rows: detail, cols: [7, 38, 30, 36, 16, 20, 18, 11, 16, 14, 9, 20, 13, 18, 14, 16, 18, 30], freezeRows: HEAD, autoFilter: `A${HEAD}:R${last}`, landscape: true, rowHeights: { 1: 24, [HEAD]: 36 } },
  ];
  return Xlsx.build(sheets, {
    title: `รายการสินทรัพย์ ณ วันที่ ${dateLong}`,
    definedNames: [{ name: '_xlnm._FilterDatabase', sheet: 1, ref: `'${DETAIL}'!$A$${HEAD}:$R$${last}` }],
  });
}

function exportAssetsExcel() {
  if (!state.holdings.length) return toast('ยังไม่มีสินทรัพย์ให้ส่งออก', 'error');
  const bytes = buildAssetsWorkbook();
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `FinancialLog-Assets-${AS_OF}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('ส่งออกไฟล์ Excel เรียบร้อย');
}
