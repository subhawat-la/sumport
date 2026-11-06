'use strict';

// กราฟ SVG แบบเบา ไม่พึ่งพาไลบรารีภายนอก
const Charts = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function donut(segments, { size = 200, thickness = 30, title = '', subtitle = '' } = {}) {
    const data = segments.filter((s) => s.value > 0);
    const total = data.reduce((a, s) => a + s.value, 0) || 1;
    const c = size / 2;
    const r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;
    let acc = 0;
    const arcs = data.map((s) => {
      const len = (s.value / total) * circ;
      const gap = data.length > 1 ? Math.min(1.5, len / 2) : 0;
      const el = `<circle class="donut-seg" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
        stroke-dasharray="${Math.max(len - gap, 0)} ${circ}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${c} ${c})">
        <title>${esc(s.label)}: ${((s.value / total) * 100).toFixed(1)}%</title></circle>`;
      acc += len;
      return el;
    }).join('');
    return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(subtitle)}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#EEF2F7" stroke-width="${thickness}"/>
      ${arcs}
      <text x="${c}" y="${c - 8}" text-anchor="middle" class="donut-sub">${esc(subtitle)}</text>
      <text x="${c}" y="${c + 16}" text-anchor="middle" class="donut-title">${esc(title)}</text>
    </svg>`;
  }

  function line(points, { width = 640, height = 230, color = '#4F46E5', format = (v) => v } = {}) {
    if (!points.length) return '';
    const pad = { t: 16, r: 16, b: 30, l: 78 };
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= Math.abs(min) * 0.05 || 1; max += Math.abs(max) * 0.05 || 1; }
    const span = max - min;
    min -= span * 0.1;
    max += span * 0.1;
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    const last = points.length - 1;
    const x = (i) => pad.l + (last === 0 ? w / 2 : (i * w) / last);
    const y = (v) => pad.t + h - ((v - min) / (max - min)) * h;
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${path} L${x(last).toFixed(1)},${pad.t + h} L${x(0).toFixed(1)},${pad.t + h} Z`;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const grid = [0, 1, 2, 3].map((k) => {
      const v = min + ((max - min) * k) / 3;
      const yy = y(v).toFixed(1);
      return `<line x1="${pad.l}" x2="${width - pad.r}" y1="${yy}" y2="${yy}" class="grid"/>
        <text x="${pad.l - 10}" y="${Number(yy) + 4}" text-anchor="end" class="axis">${esc(format(v))}</text>`;
    }).join('');
    const step = Math.max(1, Math.ceil(points.length / 6));
    const xl = points.map((p, i) => (i % step === 0 || (i === last && last % step >= step / 2))
      ? `<text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="axis">${esc(p.label)}</text>` : '').join('');
    const showDots = points.length <= 40;
    const dots = points.map((p, i) => ((showDots || i === last) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === last ? 5 : 3}"
        fill="${i === last ? color : '#fff'}" stroke="${color}" stroke-width="2" class="pt"><title>${esc(p.label)}: ${esc(format(p.value))}</title></circle>` : '')).join('');
    return `<svg class="linechart" viewBox="0 0 ${width} ${height}" role="img">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${xl}
    </svg>`;
  }

  return { donut, line, esc };
})();
