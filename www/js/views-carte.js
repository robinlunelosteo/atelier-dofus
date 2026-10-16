/* ===== Carte illustrée + ressources par map (style DofusDB / Dofus Map) ===== */
'use strict';
const _carteOld = Views.carte;
const RES_COLORS = ['#ff5d6c', '#4fb3ff', '#5be37d', '#ffd24d', '#c58bff', '#ff9a4a'];
const RES_CATS = ['Plantes', 'Arbres', 'Minerais', 'Céréales', 'Poissons', 'Autre'];
const RES = (window.D_CARTE && D_CARTE.res || []).map(([id, n, cat, col, row]) => ({ id, n, cat, col, row }));
const RES_BY = new Map(RES.map((r) => [r.id, r]));
const RES_PTS = {};   // id -> Map("x,y" -> nb)
const RES_TOT = {};   // id -> {n, maps}
RES.forEach((r) => { const m = new Map(); let n = 0; (D_CARTE.pts[r.id] || []).forEach(([c, x, y]) => { const k = x + ',' + y; m.set(k, (m.get(k) || 0) + c); n += c; }); RES_PTS[r.id] = m; RES_TOT[r.id] = { n, maps: m.size }; });
/* Incarnam (wm 2) : mêmes structures, données de data/carte2.js */
const RES_PTS2 = {}, RES_TOT2 = {};
RES.forEach((r) => { const m = new Map(); let n = 0; ((window.D_CARTE2 && D_CARTE2.pts[r.id]) || []).forEach(([c, x, y]) => { const k = x + ',' + y; m.set(k, (m.get(k) || 0) + c); n += c; }); RES_PTS2[r.id] = m; RES_TOT2[r.id] = { n, maps: m.size }; });
/* raccourcis : zones du monde des Douze (cadrage en cases x0,x1,y0,y1) */
const WORLD_VIEWS = { 1: { fit: null, start: [2, -4, 46], over: [-12, 22, -30, 12] }, 2: { fit: [-3, 5, -6, 1], over: [-3, 5, -6, 1] } };
function subBox(sub) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; sub.c.forEach(([x, y]) => { if (!x && !y) return; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); return [x0, x1, y0, y1]; }

function resIcon(r, px) {
  const k = (px || 28) / 52;
  const s = h('span', { class: 'resico', title: r.n });
  s.style.cssText = `width:${px || 28}px;height:${px || 28}px;background:url(img/map/res.png) -${r.col * 52 * k}px -${r.row * 52 * k}px / ${832 * k}px ${260 * k}px no-repeat`;
  return s;
}
const roundRect = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

/* ================= CARTE ================= */
Views.carte = (main, mode, arg) => {
  const U = (Views._carte = Views._carte || { wm: 1 });
  if (mode === 'res') { U.wm = 1; U.astrub = false; }
  if (U.wm !== 1 && U.wm !== 2) { _carteOld(main, mode, arg); return; }
  const wm = U.wm, PT = wm === 1 ? RES_PTS : RES_PTS2, TT = wm === 1 ? RES_TOT : RES_TOT2;
  const RL = wm === 1 ? RES : RES.filter((r) => TT[r.id].n > 0);
  U.sels = U.sels || {}; U.sel = U.sels[wm] = U.sels[wm] || (wm === 1 ? (U.sel || []) : []);
  U.cat = U.cat || 'Tout';
  main.classList.add('fullmap');
  main.appendChild(h('div', { class: 'page-head slim' }, h('div', null, h('h1', null, wm === 1 ? 'Carte du monde' : 'Carte d\'Incarnam'), h('p', { class: 'muted' }, 'Choisis jusqu\'à 6 ressources : le nombre disponible s\'affiche sur chaque map. Clique une map pour voir sa zone.')),
    tabs(WORLDS.map((w) => ({ k: w.wm, n: w.n })).concat([{ k: 3, n: 'Astrub' }]), U.astrub ? 3 : U.wm, (k) => { if (k === 3) { U.wm = 1; U.astrub = true; } else { U.wm = k; U.astrub = false; } rerender(); })));
  const layout = h('div', { class: 'maplay' });
  const mapBox = h('div', { class: 'mapbox wmap' });
  const side = h('div', { class: 'mapside card' });
  const coord = h('div', { class: 'mapcoord' }, 'Survole la carte');
  mapBox.appendChild(coord); layout.appendChild(mapBox); layout.appendChild(side); main.appendChild(layout);
  let M, selSub = null, hl = new Set();
  const cellSub = (x, y) => (CELL[wm] || new Map()).get(x + ',' + y);

  /* couches */
  const agg = () => {
    const m = new Map();
    U.sel.forEach((id, i) => { PT[id].forEach((n, k) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push([i, n]); }); });
    return m;
  };
  let AG = agg();
  const layerRes = (ctx, A) => {
    if (!AG.size) return;
    const [X0, X1, Y0, Y1] = A.visible(); const cw = A.cw();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [k, list] of AG) {
      const [X, Y] = k.split(',').map(Number); if (X < X0 || X > X1 || Y < Y0 || Y > Y1) continue;
      const [x, y, w, hh] = A.cellRect(X, Y);
      if (cw < 13) { ctx.beginPath(); ctx.arc(x + w / 2, y + hh / 2, Math.max(2.2, w * 0.42), 0, 7); ctx.fillStyle = RES_COLORS[list[0][0]]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke(); continue; }
      const ph = clamp(hh * 0.62, 11, 19), gap = 1.5; ctx.font = `800 ${Math.round(ph * 0.72)}px system-ui,sans-serif`;
      const tot = list.length * ph + (list.length - 1) * gap; let yy = y + hh / 2 - tot / 2;
      list.forEach(([i, n]) => {
        const t = String(n), tw = ctx.measureText(t).width, pw = Math.max(ph, tw + 9);
        roundRect(ctx, x + w / 2 - pw / 2, yy, pw, ph, ph / 2); ctx.fillStyle = RES_COLORS[i]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(8,10,20,.85)'; ctx.stroke();
        ctx.fillStyle = '#10121e'; ctx.fillText(t, x + w / 2, yy + ph / 2 + 0.5); yy += ph + gap;
      });
    }
  };
  const layerSub = (ctx, A) => {
    const draw = (cells, fill, stroke) => cells.forEach(([X, Y]) => { const [x, y, w, hh] = A.cellRect(X, Y); if (x > A.size()[0] || y > A.size()[1] || x + w < 0 || y + hh < 0) return; ctx.fillStyle = fill; ctx.fillRect(x, y, w, hh); if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(x + .5, y + .5, w - 1, hh - 1); } });
    if (hl.size) MONDE.subs.filter((z) => hl.has(z.id) && z.wm === wm).forEach((z) => draw(z.c, 'rgba(255,205,90,.34)'));
    if (selSub) draw(selSub.c, 'rgba(120,190,255,.28)');
    // zones : noms
    if (A.cw() >= 20 && A.cw() < (wm === 1 ? 70 : 170)) {
      ctx.font = '600 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      MONDE.subs.forEach((z) => { if (z.wm !== wm || z.c.length < (A.cw() >= 40 ? 3 : 10) || (wm === 2 && z.c.length < 2)) return; const c = SUB_CENTER.get(z.id); if (!c) return; const [x, y, w, hh] = A.cellRect(c[0], c[1]); if (x < -60 || y < -10 || x > A.size()[0] + 60 || y > A.size()[1] + 10) return; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,8,16,.9)'; ctx.strokeText(z.n, x + w / 2, y + hh / 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(z.n, x + w / 2, y + hh / 2); });
    }
  };
  const tipFor = (c) => {
    const k = c[0] + ',' + c[1]; const list = AG.get(k); const sub = cellSub(c[0], c[1]);
    if (!list && !sub) return null;
    const box = h('div', { class: 'tipbox' }, h('b', null, `[${c[0]}, ${c[1]}]`), sub ? h('div', { class: 'muted' }, sub.n) : null);
    if (list) list.forEach(([i, n]) => { const r = RES_BY.get(U.sel[i]); box.appendChild(h('div', { class: 'tiprow' }, h('i', { style: { background: RES_COLORS[i] } }), resIcon(r, 18), r.n, h('b', null, '× ' + n))); });
    return box;
  };

  M = mountWorld(mapBox, { wm, view: wm === 1 ? [2, -4, 46] : null, fit: WORLD_VIEWS[wm].fit, tip: tipFor,
    onHover: (c) => { coord.textContent = c ? `[${c[0]}, ${c[1]}]` + (cellSub(c[0], c[1]) ? ' — ' + cellSub(c[0], c[1]).n : '') : ''; },
    onClick: (c) => { const s = cellSub(c[0], c[1]); selectSub(s || null); } });
  M.layers.push(layerSub, layerRes);

  /* panneau latéral */
  const q = h('input', { class: 'inp', placeholder: 'Ressource, monstre ou zone…' });
  const results = h('div', { class: 'ss-list static' });
  const catRow = h('div', { class: 'catrow' });
  const grid = h('div', { class: 'resgrid' });
  const selBox = h('div', { class: 'ressel' });
  const best = h('div');
  const info = h('div');

  const toggle = (id) => {
    const i = U.sel.indexOf(id);
    if (i >= 0) U.sel.splice(i, 1);
    else { if (U.sel.length >= 6) { toast('6 ressources maximum'); return; } U.sel.push(id); }
    AG = agg(); drawSel(); drawGrid(); M.draw();
  };
  const goCell = (x, y) => { M.view(x, y, wm === 1 ? 64 : 170); };
  function drawCats() {
    clear(catRow);
    ['Tout', ...RES_CATS.filter((c) => RL.some((r) => r.cat === c))].forEach((c) => catRow.appendChild(h('button', { class: 'cat' + (U.cat === c ? ' on' : ''), onclick: () => { U.cat = c; drawCats(); drawGrid(); } }, c)));
  }
  function drawGrid() {
    clear(grid); const s = norm(q.value.trim());
    RL.filter((r) => (U.cat === 'Tout' || r.cat === U.cat) && (!s || norm(r.n).includes(s))).forEach((r) => {
      const on = U.sel.indexOf(r.id);
      grid.appendChild(h('button', { class: 'rbtn' + (on >= 0 ? ' on' : ''), style: on >= 0 ? { borderColor: RES_COLORS[on], boxShadow: `0 0 0 1px ${RES_COLORS[on]} inset` } : null, onclick: () => toggle(r.id), title: r.n + ' — ' + TT[r.id].n + ' sur ' + TT[r.id].maps + ' maps' }, resIcon(r, 30), h('span', null, r.n)));
    });
  }
  function drawSel() {
    clear(selBox); clear(best);
    if (!U.sel.length) { selBox.appendChild(h('div', { class: 'muted sm' }, 'Aucune ressource sélectionnée. Clique sur une icône pour voir où la récolter.')); return; }
    U.sel.forEach((id, i) => { const r = RES_BY.get(id), t = TT[id];
      selBox.appendChild(h('div', { class: 'selrow' }, h('i', { style: { background: RES_COLORS[i] } }), resIcon(r, 26), h('div', { class: 'selt' }, h('b', null, r.n), h('span', { class: 'muted sm' }, t.n + ' ressources · ' + t.maps + ' maps')), h('button', { class: 'x', title: 'Retirer', onclick: () => toggle(id) }, '✕'))); });
    selBox.appendChild(h('button', { class: 'btn sm', onclick: () => { U.sel = []; AG = agg(); drawSel(); drawGrid(); M.draw(); } }, 'Tout effacer'));
    // meilleures maps
    const arr = [...AG.entries()].map(([k, l]) => [k, l.reduce((a, b) => a + b[1], 0), l]).sort((a, b) => b[1] - a[1]).slice(0, 12);
    best.appendChild(h('h4', null, 'Meilleures maps'));
    arr.forEach(([k, tot, l]) => { const [x, y] = k.split(',').map(Number); const sub = cellSub(x, y);
      best.appendChild(h('div', { class: 'need-r click', onclick: () => { goCell(x, y); } }, h('b', null, `[${x}, ${y}]`), h('span', { class: 'muted sm' }, sub ? sub.n : ''), h('span', { class: 'bpills' }, l.map(([i, n]) => h('em', { style: { background: RES_COLORS[i] } }, n))), h('strong', null, '×' + tot))); });
  }
  function selectSub(s) { selSub = s; clear(info); if (s) info.appendChild(subInfoPanel(s, (it) => lightItem(it))); M.draw(); }
  function lightItem(it) {
    const r = RL.find((x) => norm(x.n) === norm(it.n));
    if (r) { if (!U.sel.includes(r.id)) { if (U.sel.length >= 6) U.sel.shift(); U.sel.push(r.id); } AG = agg(); drawSel(); drawGrid(); M.draw();
      const first = [...PT[r.id].entries()].sort((a, b) => b[1] - a[1])[0]; if (first) { const [x, y] = first[0].split(',').map(Number); goCell(x, y); } return; }
    const zs = HARV.get(it.i) || []; hl = new Set(zs.map((z) => z.id)); M.draw(); toast(it.n + ' : ' + zs.length + ' zone(s) en surbrillance');
  }
  q.addEventListener('input', () => {
    drawGrid(); clear(results); const s = norm(q.value.trim()); if (s.length < 2) return;
    const monIds = Object.keys(MONDE.mons).filter((id) => norm(MONDE.mons[id].n).includes(s)).slice(0, 6);
    monIds.forEach((id) => results.appendChild(h('div', { class: 'ss-item', onclick: () => { const zs = MONDE.subs.filter((z) => z.m.includes(+id) && z.wm === wm); hl = new Set(zs.map((z) => z.id)); M.draw(); clear(results); toast(MONDE.mons[id].n + ' : ' + zs.length + ' zone(s) en surbrillance'); if (zs[0]) { const c = SUB_CENTER.get(zs[0].id); if (c) goCell(Math.round(c[0]), Math.round(c[1])); } } }, h('span', { class: 'ilab' }, monImg(MONDE.mons[id].g), MONDE.mons[id].n), h('small', { class: 'muted' }, 'monstre'))));
    MONDE.subs.filter((z) => z.wm === wm && norm(z.n).includes(s)).slice(0, 6).forEach((z) => results.appendChild(h('div', { class: 'ss-item', onclick: () => { const c = SUB_CENTER.get(z.id); if (c) goCell(Math.round(c[0]), Math.round(c[1])); selectSub(z); clear(results); } }, '📍 ' + z.n, h('small', { class: 'muted' }, ' ' + z.an))));
  });
  const goRow = h('div', { class: 'gorow' }, h('span', { class: 'muted sm' }, 'Aller à'));
  const fitSubs = (ids, pad) => () => { const bs = ids.map((id) => MONDE.subs.find((z) => z.id === id)).filter(Boolean).map(subBox); if (!bs.length) return; M.viewCells(Math.min(...bs.map((b) => b[0])) - pad, Math.max(...bs.map((b) => b[1])) + pad, Math.min(...bs.map((b) => b[2])) - pad, Math.max(...bs.map((b) => b[3])) + pad); };
  const goChip = (n, fn, title) => goRow.appendChild(h('button', { class: 'gochip', title, onclick: fn }, n));
  goChip('Vue d\'ensemble', () => { U.astrub = false; M.viewCells(...WORLD_VIEWS[wm].over); }, 'Tout le monde');
  if (wm === 1) {
    goChip('📍 Astrub (ville)', fitSubs([95], 1), 'Cité d\'Astrub');
    goChip('Région d\'Astrub', fitSubs([95, 96, 97, 98, 102, 173, 335], 0), 'Cité, carrière, forêt, champs, cimetière, prairies, calanques');
    goChip('Incarnam →', () => { U.wm = 2; rerender(); }, 'Ouvrir la carte d\'Incarnam');
  }
  if (wm === 1 && U.astrub) setTimeout(fitSubs([95], 1), 80);
  if (U.goto) { const [gx, gy] = U.goto; U.goto = null; U.astrub = false; setTimeout(() => M.view(gx, gy, 90), 100); }
  side.appendChild(q); side.appendChild(results); side.appendChild(goRow); side.appendChild(catRow); side.appendChild(grid);
  side.appendChild(h('h4', null, 'Sélection')); side.appendChild(selBox); side.appendChild(best); side.appendChild(info);
  side.appendChild(h('div', { class: 'legend muted sm' }, 'Molette / pincer : zoom · glisser : déplacer · double-clic : zoomer'));
  drawCats(); drawGrid(); drawSel();
  if (mode === 'res' && IB.get(+arg)) lightItem(IB.get(+arg));
  else if (U.sel.length) { const f = [...AG.keys()][0]; if (f) { const [x, y] = f.split(',').map(Number); goCell(x, y); M.viewCells(...WORLD_VIEWS[wm].over); } }
  Views._cleanup = () => { U.sels[wm] = U.sel; M.destroy(); main.classList.remove('fullmap'); };
};
