/* ===== Carte du monde, accueil, sauvegarde ===== */
'use strict';

/* ---------------- index des cartes ---------------- */
const WORLDS = [{ wm: 1, n: 'Monde des Douze' }, { wm: 2, n: 'Incarnam' }];
const CELL = {};      // wm -> Map("x,y" -> sub)
MONDE.subs.forEach((s) => {
  const m = CELL[s.wm] = CELL[s.wm] || new Map();
  s.c.forEach(([x, y]) => { const k = x + ',' + y; if (!m.has(k)) m.set(k, s); });
});
const SUB_CENTER = new Map();
MONDE.subs.forEach((s) => { if (!s.c.length) return; let sx = 0, sy = 0; s.c.forEach(([x, y]) => { sx += x; sy += y; }); SUB_CENTER.set(s.id, [sx / s.c.length, sy / s.c.length]); });
const areaColor = (a, sel) => `hsl(${(a * 47 + 13) % 360}, ${sel ? 70 : 38}%, ${sel ? 58 : 30}%)`;

function mountMap(box, opt) {
  const wm = opt.wm || 1;
  const cells = CELL[wm] || new Map();
  const canvas = h('canvas', { class: 'mapcv' });
  box.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let cs = opt.zoom || 16, ox = opt.cx != null ? opt.cx : 0, oy = opt.cy != null ? opt.cy : 0;   // centre en coords monde
  const API = { highlight: new Set(), markers: [], path: [], sel: null, hover: null, cells };
  const toScreen = (x, y) => [(x - ox) * cs + canvas.width / 2, (y - oy) * cs + canvas.height / 2];
  const toWorld = (px, py) => [Math.floor((px - canvas.width / 2) / cs + ox + 0.5 + 0.0001), Math.floor((py - canvas.height / 2) / cs + oy + 0.5 + 0.0001)];
  const subs = MONDE.subs.filter((s) => s.wm === wm);
  function draw() {
    const W2 = canvas.width, H2 = canvas.height;
    ctx.fillStyle = '#0c0f1c'; ctx.fillRect(0, 0, W2, H2);
    const x0 = Math.floor(ox - W2 / 2 / cs) - 1, x1 = Math.ceil(ox + W2 / 2 / cs) + 1, y0 = Math.floor(oy - H2 / 2 / cs) - 1, y1 = Math.ceil(oy + H2 / 2 / cs) + 1;
    const hl = API.highlight, hasHl = hl.size > 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const s = cells.get(x + ',' + y); if (!s) continue;
      const [px, py] = toScreen(x - 0.5, y - 0.5);
      const isHl = hl.has(s.id), isSel = API.sel && API.sel.id === s.id;
      ctx.fillStyle = isSel ? areaColor(s.a, true) : (hasHl ? (isHl ? '#f2c14e' : '#1b2036') : areaColor(s.a));
      const g = cs >= 9 ? 1 : 0;
      ctx.fillRect(px + g * 0.5, py + g * 0.5, cs - g, cs - g);
    }
    // contours de sous-zone sélectionnée
    if (API.sel) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      API.sel.c.forEach(([x, y]) => {
        const [px, py] = toScreen(x - 0.5, y - 0.5);
        const sameN = (dx, dy) => { const n = cells.get((x + dx) + ',' + (y + dy)); return n && n.id === API.sel.id; };
        ctx.beginPath();
        if (!sameN(0, -1)) { ctx.moveTo(px, py); ctx.lineTo(px + cs, py); }
        if (!sameN(0, 1)) { ctx.moveTo(px, py + cs); ctx.lineTo(px + cs, py + cs); }
        if (!sameN(-1, 0)) { ctx.moveTo(px, py); ctx.lineTo(px, py + cs); }
        if (!sameN(1, 0)) { ctx.moveTo(px + cs, py); ctx.lineTo(px + cs, py + cs); }
        ctx.stroke();
      });
    }
    // noms de zones
    if (cs >= 7) {
      ctx.font = `600 ${clamp(cs * 0.75, 10, 15)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      subs.forEach((s) => {
        const c = SUB_CENTER.get(s.id); if (!c || s.c.length < (cs >= 14 ? 3 : cs >= 10 ? 8 : 20)) return;
        const [px, py] = toScreen(c[0], c[1]); if (px < -80 || py < -20 || px > W2 + 80 || py > H2 + 20) return;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,20,.85)'; ctx.strokeText(s.n, px, py); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(s.n, px, py);
      });
    }
    // zaaps
    if (cs >= 9) { ctx.fillStyle = '#5fe3ff'; subs.forEach((s) => { if (!s.z) return; const [px, py] = toScreen(s.z[0], s.z[1]); if (px < -10 || py < -10 || px > W2 + 10 || py > H2 + 10) return; ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 5, py); ctx.fill(); }); }
    // grille + coordonnées
    if (cs >= 22) {
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '9px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (cells.has(x + ',' + y)) { const [px, py] = toScreen(x - 0.5, y - 0.5); ctx.fillText(x + ',' + y, px + 2, py + 2); }
    }
    // trajet
    if (API.path.length) {
      ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath();
      API.path.forEach(([x, y], i) => { const [px, py] = toScreen(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
    }
    API.markers.forEach((m) => {
      const [px, py] = toScreen(m.x, m.y);
      ctx.beginPath(); ctx.arc(px, py, Math.max(5, cs * 0.38), 0, 7); ctx.fillStyle = m.color || '#ff5a7a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (m.label) { ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.label, px, py); }
    });
    if (API.hover) { const [px, py] = toScreen(API.hover[0] - 0.5, API.hover[1] - 0.5); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(px, py, cs, cs); }
  }
  function resize() { const r = box.getBoundingClientRect(); canvas.width = Math.max(200, Math.floor(r.width)); canvas.height = Math.max(200, Math.floor(r.height)); draw(); }
  const ro = new ResizeObserver(resize); ro.observe(box);
  let drag = null, moved = false;
  canvas.addEventListener('mousedown', (e) => { drag = [e.clientX, e.clientY, ox, oy]; moved = false; });
  window.addEventListener('mouseup', () => { drag = null; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (drag) { const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; ox = drag[2] - dx / cs; oy = drag[3] - dy / cs; draw(); }
    const w = toWorld(e.clientX - r.left, e.clientY - r.top); API.hover = w; const s = cells.get(w[0] + ',' + w[1]);
    opt.onHover && opt.onHover(w, s); if (!drag) draw();
  });
  canvas.addEventListener('mouseleave', () => { API.hover = null; opt.onHover && opt.onHover(null); draw(); });
  canvas.addEventListener('click', (e) => { if (moved) return; const r = canvas.getBoundingClientRect(); const w = toWorld(e.clientX - r.left, e.clientY - r.top); opt.onClick && opt.onClick(w, cells.get(w[0] + ',' + w[1])); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - canvas.width / 2) / cs + ox, wy = (my - canvas.height / 2) / cs + oy;
    cs = clamp(cs * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 3, 60);
    ox = wx - (mx - canvas.width / 2) / cs; oy = wy - (my - canvas.height / 2) / cs; draw();
  }, { passive: false });
  API.draw = draw;
  API.center = (x, y, z) => { ox = x; oy = y; if (z) cs = z; draw(); };
  API.destroy = () => ro.disconnect();
  setTimeout(resize, 0);
  return API;
}

function subInfoPanel(s, onRes) {
  const box = h('div', { class: 'subinfo' });
  box.appendChild(h('h3', null, s.n));
  box.appendChild(h('div', { class: 'muted' }, (s.an || '') + ' · niveau ' + s.l + (s.z ? ' · zaap en [' + s.z.join(', ') + ']' : '')));
  const mons = s.m.map((id) => MONDE.mons[id]).filter(Boolean);
  const arch = ARCH_INFO.filter((a) => a.sub.includes(s.id));
  if (arch.length) {
    const pid = S().prefs.ocrePerso; const mine = (S().ocre[pid]) || {};
    box.appendChild(h('h4', null, 'Archimonstres (' + arch.length + ')'));
    box.appendChild(h('div', { class: 'chips' }, arch.map((a) => h('span', { class: 'chip' + (mine[a.id] ? ' ok' : ''), title: 'niv. ' + a.l }, monImg(a.g, 'xs'), a.n + (mine[a.id] ? ' ✓' : '')))));
  }
  if (mons.length) {
    box.appendChild(h('h4', null, 'Monstres (' + mons.length + ')'));
    box.appendChild(h('div', { class: 'chips' }, mons.sort((a, b) => a.l - b.l).map((m) => h('span', { class: 'chip', title: 'niveau ' + m.l }, monImg(m.g, 'xs'), m.n, h('em', null, m.l)))));
  }
  const res = s.h.map((id) => IB.get(id)).filter(Boolean);
  if (res.length) {
    box.appendChild(h('h4', null, 'Ressources (' + res.length + ')'));
    box.appendChild(h('div', { class: 'chips' }, res.sort((a, b) => a.l - b.l).map((it) => h('span', { class: 'chip click', onclick: () => onRes && onRes(it) }, itemImg(it, 'xs'), it.n, h('em', null, it.l)))));
  }
  if (!mons.length && !res.length && !arch.length) box.appendChild(h('div', { class: 'muted' }, 'Pas de contenu référencé pour cette zone.'));
  return box;
}

Views.carte = (main, mode, arg) => {
  const U = (Views._carte = Views._carte || { wm: 1 });
  main.classList.add('fullmap');
  main.appendChild(h('div', { class: 'page-head slim' }, h('div', null, h('h1', null, 'Carte du monde'), h('p', { class: 'muted' }, 'Clique une zone pour voir ses monstres, ressources et archimonstres. Cherche une ressource pour illuminer où la trouver.')),
    tabs(WORLDS.map((w) => ({ k: w.wm, n: w.n })), U.wm, (k) => { U.wm = k; rerender(); })));
  const layout = h('div', { class: 'maplay' });
  const mapBox = h('div', { class: 'mapbox' });
  const side = h('div', { class: 'mapside card' });
  const coord = h('div', { class: 'mapcoord' }, 'Survole la carte');
  mapBox.appendChild(coord);
  layout.appendChild(mapBox); layout.appendChild(side); main.appendChild(layout);
  const info = h('div'); const found = h('div', { class: 'need' });
  let M;
  const selectSub = (s) => { M.sel = s; clear(info); if (s) info.appendChild(subInfoPanel(s, (it) => lightResource(it))); M.draw(); };
  const lightResource = (it) => {
    const zs = HARV.get(it.i) || []; M.highlight = new Set(zs.map((z) => z.id)); M.draw(); clear(found);
    found.appendChild(h('h4', null, 'Où trouver : ' + it.n + ' (' + zs.length + ' zone(s))'));
    zs.filter((z) => z.wm === U.wm).sort((a, b) => a.l - b.l).forEach((z) => found.appendChild(h('div', { class: 'need-r click', onclick: () => { const c = SUB_CENTER.get(z.id); M.center(c[0], c[1], 14); selectSub(z); } }, h('b', null, z.n), h('span', { class: 'muted' }, z.an + ' · niv. ' + z.l))));
    if ((it.d || []).length) found.appendChild(h('div', { class: 'muted sm' }, 'Dropé aussi par ' + it.d.length + ' monstre(s).'));
    found.appendChild(h('button', { class: 'btn sm', onclick: () => { M.highlight = new Set(); clear(found); M.draw(); } }, 'Effacer'));
  };
  M = mountMap(mapBox, { wm: U.wm, zoom: U.wm === 1 ? 14 : 22, cx: U.wm === 1 ? 2 : 0, cy: U.wm === 1 ? -4 : 0,
    onHover: (w, s) => { coord.textContent = w ? `[${w[0]}, ${w[1]}]` + (s ? ' — ' + s.n : '') : ''; },
    onClick: (w, s) => selectSub(s || null) });
  // recherche
  const q = h('input', { class: 'inp', placeholder: 'Ressource, monstre ou zone…' });
  const out = h('div', { class: 'ss-list static' });
  const resKeys = ITEMS.filter((i) => HARV.has(i.i));
  q.addEventListener('input', () => {
    clear(out); const s = norm(q.value); if (s.length < 2) return;
    resKeys.filter((i) => norm(i.n).includes(s)).slice(0, 12).forEach((i) => out.appendChild(h('div', { class: 'ss-item', onclick: () => { lightResource(i); clear(out); q.value = i.n; } }, itemLabel(i, h('small', { class: 'muted' }, 'ressource')))));
    const monIds = Object.keys(MONDE.mons).filter((id) => norm(MONDE.mons[id].n).includes(s)).slice(0, 8);
    monIds.forEach((id) => out.appendChild(h('div', { class: 'ss-item', onclick: () => { const zs = MONDE.subs.filter((z) => z.m.includes(+id)); M.highlight = new Set(zs.map((z) => z.id)); M.draw(); clear(out); clear(found); found.appendChild(h('h4', null, MONDE.mons[id].n + ' — ' + zs.length + ' zone(s)')); zs.slice(0, 30).forEach((z) => found.appendChild(h('div', { class: 'need-r click', onclick: () => { const c = SUB_CENTER.get(z.id); if (c) { M.center(c[0], c[1], 14); selectSub(z); } } }, h('b', null, z.n), h('span', { class: 'muted' }, z.an)))); } }, h('span', { class: 'ilab' }, monImg(MONDE.mons[id].g), MONDE.mons[id].n), h('small', { class: 'muted' }, 'monstre'))));
    MONDE.subs.filter((z) => z.wm === U.wm && norm(z.n).includes(s)).slice(0, 8).forEach((z) => out.appendChild(h('div', { class: 'ss-item', onclick: () => { const c = SUB_CENTER.get(z.id); M.center(c[0], c[1], 14); selectSub(z); clear(out); } }, '📍 ' + z.n, h('small', { class: 'muted' }, ' ' + z.an))));
  });
  side.appendChild(q); side.appendChild(out); side.appendChild(found); side.appendChild(info);
  side.appendChild(h('div', { class: 'legend muted sm' }, h('span', { class: 'dz' }), ' zaap · molette : zoom · glisser : déplacer'));
  if (mode === 'res' && IB.get(+arg)) lightResource(IB.get(+arg));
  Views._cleanup = () => { M.destroy(); main.classList.remove('fullmap'); };
};

/* ---------------- accueil ---------------- */
Views.accueil = (main) => {
  const st = S(); const today = todayStr(); const a = ALM.get(today);
  if (window.Profiles) main.appendChild(h('div', { style: { marginBottom: '10px' } }, Profiles.chip('home')));
  let contCard = null;
  if (window.GuidesAPI) { const L = GuidesAPI.last(); if (L) contCard = (h('div', { class: 'card gcont' }, h('div', { class: 'gc-t' }, h('span', { class: 'muted sm' }, 'Reprendre mon guide'), h('b', null, L.name), h('div', { class: 'muted sm' }, L.finished ? 'Guide terminé 🎉' : 'Prochaine étape : ' + (L.step + 1) + ' / ' + L.n + ' · ' + L.done + ' faites'), progress(L.n ? L.done / L.n * 100 : 0)), h('button', { class: 'btn primary', onclick: () => GuidesAPI.resume(L.id) }, L.finished ? '📜 Ouvrir' : '▶ Continuer'))); }
  const grid = h('div', { class: 'dash' });
  // almanax (premier) puis reprise du guide
  const alm = h('a', { class: 'card dcard', href: '#/almanax' }, h('h3', null, '📅 Almanax du jour'), h('div', { class: 'muted sm', style: { marginBottom: '8px', textTransform: 'capitalize' } }, dateLong(today)));
  if (a) { const it = IB.get(a.o); alm.appendChild(h('div', { class: 'row gap' }, it ? itemImg(it, 'big') : null, h('div', null, h('b', null, a.q + '× ' + a.on), h('div', { class: 'muted sm' }, a.bt))));
    alm.appendChild(h('p', { class: 'clamp' }, a.b));
    const done = st.persos.filter((p) => almDone(p.id, today) || almDone('all', today)).length;
    alm.appendChild(h('div', { class: 'muted sm' }, st.persos.length ? done + ' / ' + st.persos.length + ' perso(s) ont fait l\'offrande' : 'Aucun perso créé')); }
  else alm.appendChild(h('p', { class: 'muted' }, 'Pas de donnée pour aujourd\'hui.'));
  grid.appendChild(alm);
  if (contCard) grid.appendChild(contCard);
  // ocre
  const oc = h('a', { class: 'card dcard', href: '#/ocre' }, h('h3', null, '🟠 Progression Ocre'));
  if (st.persos.length) st.persos.forEach((p) => { const n = ocreCount(p.id); oc.appendChild(h('div', { class: 'orow' }, h('span', null, p.nom), progress(n / ARCHI.length * 100), h('b', null, n + '/' + ARCHI.length))); });
  else oc.appendChild(h('p', { class: 'muted' }, 'Crée un personnage pour commencer.'));
  grid.appendChild(oc);
  // persos
  const pc = h('div', { class: 'card dcard' }, h('h3', null, '⚔️ Mes personnages'));
  if (st.persos.length) st.persos.slice(0, 6).forEach((p) => { const c = buildCost(curBuild(p)); pc.appendChild(h('a', { class: 'orow link', href: '#/perso/' + p.id }, h('span', null, (CLASS_ICON[className(p.classe)] || '') + ' ' + p.nom), h('span', { class: 'muted sm' }, 'niv. ' + p.niveau), h('b', null, kam(c.mkt)))); });
  else pc.appendChild(h('div', null, h('p', { class: 'muted' }, 'Aucun personnage.'), h('button', { class: 'btn primary', onclick: () => go('persos') }, 'Commencer')));
  grid.appendChild(pc);
  // guides
  if (window.GuidesAPI) {
    const rows = GuidesAPI.rows();
    const gc = h('div', { class: 'card dcard' }, h('h3', null, '📜 Mes guides'));
    if (rows.length) {
      rows.forEach((r) => gc.appendChild(h('div', { class: 'grow', onclick: () => GuidesAPI.resume(r.id) }, h('div', { class: 'row between' }, h('b', null, r.name), h('span', { class: 'muted sm' }, r.done + '/' + r.n)), progress(r.n ? r.done / r.n * 100 : 0))));
      gc.appendChild(h('a', { class: 'muted sm', style: { display: 'block' }, href: '#/guides' }, rows.some((r) => r.followed) ? 'Tous les guides →' : 'Épingle des guides avec « Suivre » →'));
    } else gc.appendChild(h('p', { class: 'muted' }, 'Crée un personnage pour suivre un guide.'));
    grid.appendChild(gc);
  }
  // craft
  const cr = h('a', { class: 'card dcard', href: '#/craft' }, h('h3', null, '🔨 Liste de craft'), h('div', { class: 'bignum' }, st.craft.liste.length), h('div', { class: 'muted' }, 'objet(s) à fabriquer'));
  grid.appendChild(cr);
  // compta
  const tot = st.persos.reduce((acc, p) => { p.builds.forEach((b) => { const c = buildCost(b); acc.mkt += c.mkt; acc.paid += c.paid; acc.loss += c.loss; }); return acc; }, { mkt: 0, paid: 0, loss: 0 });
  grid.appendChild(h('a', { class: 'card dcard', href: '#/compta' }, h('h3', null, '💰 Compta'), h('div', { class: 'bignum' }, kam(tot.mkt)), h('div', { class: 'muted' }, 'valeur des stuffs · payé ' + kam(tot.paid))));
  grid.appendChild(h('a', { class: 'card dcard', href: '#/carte' }, h('h3', null, '🗺️ Carte & ressources'), h('p', { class: 'muted' }, MONDE.subs.length + ' zones, ' + HARV.size + ' ressources localisées. Cherche où récolter ce qu\'il te faut.')));
  main.appendChild(grid);
  main.appendChild(h('div', { class: 'quick' }, [['metiers', '⛏️ Atelier métiers'], ['craft', '🔨 Atelier de craft'], ['persos', '✨ Générateur de build']].map(([k, n]) => h('a', { class: 'btn', href: '#/' + k }, n))));
};

/* ---------------- sauvegarde ---------------- */
Views.params = (main) => {
  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Paramètres'), h('p', { class: 'muted' }, 'Apparence, sauvegarde et infos.'))));
  const st = Store;
  const TH = (S().prefs.theme = S().prefs.theme || { preset: 'nuit', bg: null, accent: null, accent2: null });
  const cur = themeVars(TH), base = THEMES[TH.preset] || THEMES.nuit;
  const setTh = (patch) => { Object.assign(TH, patch); applyTheme(TH); touch(); rerender(); };
  const pick = (title, hint, list, key, val) => h('div', { class: 'th-sec' }, h('h4', null, title), h('p', { class: 'muted sm' }, hint),
    h('div', { class: 'row gap wrap' },
      list.map((c) => h('button', { class: 'th-sw' + (val.toLowerCase() === c ? ' on' : ''), style: { background: c }, title: c, onclick: () => setTh({ [key]: c }) })),
      h('label', { class: 'th-pick', title: 'Couleur personnalisée' }, h('input', { type: 'color', class: 'th-col', value: val, oninput: (e) => { TH[key] = e.target.value; applyTheme(TH); touch(); }, onchange: () => rerender() }), h('span', null, 'Personnalisée')),
      h('button', { class: 'btn sm', onclick: () => setTh({ [key]: null }) }, 'Réinitialiser')));
  main.appendChild(h('div', { class: 'card' }, h('h3', null, '🎨 Apparence'),
    h('h4', null, 'Ambiances'),
    h('p', { class: 'muted sm' }, 'Une ambiance règle d\'un coup le fond et les deux couleurs qui ressortent. Tu peux ensuite ajuster chacune ci-dessous.'),
    h('div', { class: 'th-grid' }, Object.keys(THEMES).map((k) => { const T = THEMES[k], V = themeVars({ preset: k }); return h('button', { class: 'th-card' + (TH.preset === k && !TH.bg && !TH.accent && !TH.accent2 ? ' on' : ''), onclick: () => setTh({ preset: k, bg: null, accent: null, accent2: null }) },
      h('div', { class: 'th-prev', style: { background: V.bg } }, h('i', { style: { background: V.nav1 } }), h('i', { style: { background: V.panel } }), h('i', { style: { background: V.gold } }), h('i', { style: { background: V.violet } })), T.n); })),
    pick('Couleur de fond', 'Le fond de l\'appli : toutes les surfaces (cartes, menus, champs) s\'adaptent automatiquement, en sombre comme en clair.', BGS, 'bg', TH.bg || base.bg),
    pick('Couleur qui ressort', 'Titres, boutons principaux, éléments actifs, barres de progression.', ACCENTS, 'accent', TH.accent || base.accent),
    pick('Couleur secondaire', 'Lueurs d\'ambiance, onglets, cadres de mise en avant.', ACCENTS, 'accent2', TH.accent2 || base.accent2)));
  if (window.Profiles) main.appendChild(h('div', { class: 'card' }, h('h3', null, '💾 Sauvegarde des profils'),
    h('p', { class: 'muted' }, 'Chaque profil s\'exporte dans son propre fichier (persos, guides cochés, craft, métiers, suivis). Importer un fichier ajoute un nouveau profil : rien n\'est écrasé.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn primary', onclick: () => Profiles.exportProfile(S().pid) }, '⬇ Exporter le profil « ' + Profiles.cur().name + ' »'),
      h('button', { class: 'btn', onclick: () => S().profiles.forEach((p, i) => setTimeout(() => Profiles.exportProfile(p.id), i * 400)) }, '⬇ Exporter tous les profils'),
      h('button', { class: 'btn', onclick: () => Profiles.pickFile((o) => Profiles.importProfile(o)) }, '⬆ Importer un profil'))));
  main.appendChild(h('div', { class: 'card' }, h('h3', null, 'Sauvegarde complète'),
    h('p', { class: 'muted' }, 'Tes données sont enregistrées automatiquement et synchronisées entre tes appareils (un fichier par profil). Ici, une copie de TOUS les profils en un seul fichier.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn primary', onclick: async () => { downloadFile('atelier-dofus-' + todayStr() + '.json', await st.exportAll()); } }, '⬇ Exporter tout'),
      h('label', { class: 'btn' }, '⬆ Importer tout', h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const o = JSON.parse(t); if (o && o.kind === 'atelier-profil') { Profiles.importProfile(o); return; } confirmBox('Remplacer TOUTES tes données (tous les profils) par ce fichier ?', async () => { try { await st.importAll(t); toast('Sauvegarde importée'); rerender(); Profiles.refresh(); } catch (er) { toast('Fichier invalide', 'warn'); } }, 'Remplacer'); } catch (er) { toast('Fichier invalide', 'warn'); } }); } })),
      h('button', { class: 'btn danger', onclick: () => confirmBox('Effacer toutes les données du profil « ' + Profiles.cur().name + ' » (persos, builds, guides cochés…) ? Pense à l\'exporter avant.', () => { st.loadData(st.state, { data: {}, sel: {} }); touch(); rerender(); Profiles.refresh(); }, 'Effacer ce profil') }, 'Réinitialiser ce profil'))));
  main.appendChild(h('div', { class: 'card' }, h('h3', null, 'Données & crédits'),
    h('p', null, 'Données du jeu : version ' + META.version + ' (fichiers publics extraits du client, publiés par le projet dofusdude/dofus3-main). Les noms, images et données de Dofus sont la propriété d\'Ankama Games ; cet outil est un projet personnel non officiel, sans lien avec Ankama.'),
    h('ul', null, h('li', null, 'Les dégâts sont calculés avec la formule classique de Dofus (estimation).'),
      h('li', null, 'L\'atelier métiers utilise les formules d\'XP de DofusDB (calibrables).'),
      h('li', null, 'Les ressources sont localisées par zone (pas par case).'))));
};
