/* ===== Moteur de caractéristiques, dégâts et générateur de build ===== */
'use strict';

/* [clé, id d'effet, libellé, groupe] */
const STAT_DEFS = [
  ['vit', 9, 'Vitalité', 'carac'], ['sag', 10, 'Sagesse', 'carac'], ['for', 45, 'Force', 'carac'],
  ['int', 13, 'Intelligence', 'carac'], ['cha', 22, 'Chance', 'carac'], ['agi', 36, 'Agilité', 'carac'],
  ['pa', 12, 'PA', 'prim'], ['pm', 8, 'PM', 'prim'], ['po', 31, 'Portée', 'prim'], ['inv', 28, 'Invocations', 'prim'],
  ['cri', 29, '% Critique', 'sec'], ['soin', 121, 'Soins', 'sec'], ['pro', 25, 'Prospection', 'sec'], ['ini', 24, 'Initiative', 'sec'],
  ['pui', 32, 'Puissance', 'dom'], ['do', 30, 'Dommages', 'dom'], ['dneu', 49, 'Dommages Neutre', 'dom'], ['dter', 48, 'Dommages Terre', 'dom'],
  ['dfeu', 61, 'Dommages Feu', 'dom'], ['deau', 27, 'Dommages Eau', 'dom'], ['dair', 47, 'Dommages Air', 'dom'],
  ['dcri', 38, 'Dommages Critiques', 'dom'], ['dpou', 62, 'Dommages Poussée', 'dom'],
  ['dsort', 93, '% Dommages sorts', 'dom'], ['darm', 41, "% Dommages d'armes", 'dom'], ['dmel', 40, '% Dommages mêlée', 'dom'], ['ddist', 71, '% Dommages distance', 'dom'],
  ['puip', 106, 'Puissance Pièges', 'dom'], ['dpie', 112, 'Dommages Pièges', 'dom'],
  ['rpneu', 34, '% Rés. Neutre', 'res'], ['rpter', 63, '% Rés. Terre', 'res'], ['rpfeu', 37, '% Rés. Feu', 'res'], ['rpeau', 17, '% Rés. Eau', 'res'], ['rpair', 16, '% Rés. Air', 'res'],
  ['rfneu', 33, 'Rés. Neutre', 'res'], ['rfter', 15, 'Rés. Terre', 'res'], ['rffeu', 14, 'Rés. Feu', 'res'], ['rfeau', 82, 'Rés. Eau', 'res'], ['rfair', 60, 'Rés. Air', 'res'],
  ['rcri', 46, 'Rés. Critiques', 'res'], ['rpou', 70, 'Rés. Poussée', 'res'], ['rmel', 65, '% Rés. mêlée', 'res'], ['rdist', 108, '% Rés. distance', 'res'],
  ['tac', 26, 'Tacle', 'tac'], ['fui', 59, 'Fuite', 'tac'], ['esqpa', 75, 'Esquive PA', 'tac'], ['esqpm', 39, 'Esquive PM', 'tac'],
  ['retpa', 64, 'Retrait PA', 'tac'], ['retpm', 50, 'Retrait PM', 'tac'], ['renv', 249, 'Dommages renvoyés', 'tac'], ['pod', 220, 'Pods', 'tac'],
];
const STAT_BY_ID = {}; const STAT_BY_KEY = {};
STAT_DEFS.forEach((d) => { STAT_BY_ID[d[1]] = d[0]; STAT_BY_KEY[d[0]] = d; });
const statLabel = (k) => (STAT_BY_KEY[k] || [])[2] || k;
const GROUPS = { carac: 'Caractéristiques', prim: 'Primaires', sec: 'Secondaires', dom: 'Dommages', res: 'Résistances', tac: 'Tacle / Esquive / Divers' };
const ELEM = ['Neutre', 'Terre', 'Feu', 'Eau', 'Air'];
const ELEM_COL = ['#b8b8c8', '#c08a4a', '#ec6a3c', '#4aa3e8', '#7ee08a'];
const ELEM_STAT = ['for', 'for', 'int', 'cha', 'agi'];
const ELEM_DOM = ['dneu', 'dter', 'dfeu', 'deau', 'dair'];
// lignes de dégâts actives des armes : id d'effet -> [élément, vol de vie ?]
const WEAPON_DMG = { 195: [0, 0], 194: [1, 0], 198: [2, 0], 214: [3, 0], 189: [4, 0], 223: [0, 1], 221: [1, 1], 193: [2, 1], 203: [3, 1], 224: [4, 1] };

/* ---------- emplacements ---------- */
const WEAPON_EXCL = new Set(['Outil']);
const SLOT_DEFS = [
  { k: 'chapeau', n: 'Chapeau', ty: ['Chapeau'], ic: '🎩' },
  { k: 'cape', n: 'Cape', ty: ['Cape'], ic: '🧥' },
  { k: 'amulette', n: 'Amulette', ty: ['Amulette'], ic: '📿' },
  { k: 'arme', n: 'Arme', st: 2, ic: '⚔️' },
  { k: 'bouclier', n: 'Bouclier', ty: ['Bouclier'], ic: '🛡️' },
  { k: 'anneau1', n: 'Anneau 1', ty: ['Anneau'], ic: '💍' },
  { k: 'anneau2', n: 'Anneau 2', ty: ['Anneau'], ic: '💍' },
  { k: 'ceinture', n: 'Ceinture', ty: ['Ceinture'], ic: '🥋' },
  { k: 'bottes', n: 'Bottes', ty: ['Bottes'], ic: '👢' },
  { k: 'familier', n: 'Familier / Monture', ty: ['Familier', 'Dragodinde', 'Muldo', 'Volkorne'], ic: '🐾' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ k: 'dofus' + n, n: 'Dofus / Trophée ' + n, ty: ['Dofus', 'Trophée', 'Prysmaradite'], ic: '🥚' })),
];
const SLOT_BY = Object.fromEntries(SLOT_DEFS.map((s) => [s.k, s]));
function slotAccepts(slot, it) {
  const d = SLOT_BY[slot];
  if (d.st) return it.st === d.st && !WEAPON_EXCL.has(typeName(it.t));
  return d.ty.includes(typeName(it.t));
}
const POOL = {}; // slot -> items
function buildPools() {
  SLOT_DEFS.forEach((d) => { POOL[d.k] = []; });
  const cache = {};
  ITEMS.forEach((it) => {
    if (![1, 2, 3, 4, 5, 7, 10, 11, 12, 13].includes(it.st)) return;
    if (!(it.e || it.w)) return;
    SLOT_DEFS.forEach((d) => {
      const key = d.st ? 's' + d.st : d.ty.join('|');
      if (!cache[key]) cache[key] = null;
      if (slotAccepts(d.k, it)) POOL[d.k].push(it);
    });
  });
}
buildPools();

/* ---------- valeurs de jets ---------- */
function effVal(e, jet) {
  const [, mn, mx] = e;
  if (mx === 0 && mn > 0) return mn;       // valeur fixe
  const lo = Math.min(mn, mx), hi = Math.max(mn, mx);
  if (jet === 'min') return lo;
  if (jet === 'moy') return (lo + hi) / 2;
  return hi;
}

/* ---------- base d'un personnage ---------- */
const BASE_STAT_KEYS = ['for', 'int', 'cha', 'agi', 'vit', 'sag'];
function levelCapital(niv) { return Math.max(0, (niv - 1) * 5); }
function capitalCost(table, from, to) {   // coût en points pour passer de "from" à "to" points de carac
  if (!table || !table.length) return to - from;
  let cost = 0;
  for (let v = from; v < to; v++) {
    let c = table[0][1];
    for (const [th, cc] of table) if (v >= th) c = cc;
    cost += c;
  }
  return cost;
}
function classOf(p) { return CLASSES.find((c) => c.id === p.classe) || CLASSES[0]; }
function capitalSpent(p) {
  const c = classOf(p); let tot = 0;
  BASE_STAT_KEYS.forEach((k) => { tot += capitalCost(c.cost[k], 0, (p.alloc || {})[k] || 0); });
  return tot;
}

/* ---------- calcul complet d'un build ---------- */
function _compute(p, b, jet, skip) {
  jet = jet || S().prefs.jet || 'max';
  const T = {}; STAT_DEFS.forEach((d) => { T[d[0]] = 0; });
  const src = { items: {}, sets: {} };
  const add = (k, v, where) => { if (k in T) { T[k] += v; } else { T.autres = T.autres || {}; T.autres[k] = (T.autres[k] || 0) + v; } };
  // base
  T.pa = p.niveau >= 100 ? 7 : 6; T.pm = 3; T.inv = 1; T.pro = 100; T.vitBase = 50 + 5 * p.niveau;
  T.pod = 1000;
  BASE_STAT_KEYS.forEach((k) => { T[k] += ((p.alloc || {})[k] || 0) + ((p.parchemins || {})[k] || 0); });
  Object.entries(p.bonus || {}).forEach(([k, v]) => { if (k in T) T[k] += (+v || 0); });
  // objets
  const items = []; const counts = new Map();
  Object.entries((b && b.items) || {}).forEach(([slot, id]) => {
    if (slot === skip) return;
    const it = IB.get(id); if (!it) return;
    items.push([slot, it]);
    (it.e || []).forEach((e) => { const k = STAT_BY_ID[e[0]]; if (k) T[k] += effVal(e, jet); });
    if (it.s) counts.set(it.s, (counts.get(it.s) || 0) + 1);
  });
  const sets = [];
  counts.forEach((n, sid) => {
    const s = SETS.get(sid); if (!s) return;
    const lines = s.e[String(Math.min(n, s.i.length))] || s.e[String(n)];
    if (n >= 2 && lines) {
      lines.forEach(([id, v]) => { const k = STAT_BY_ID[id]; if (k) T[k] += v; });
      sets.push({ set: s, n, lines });
    } else sets.push({ set: s, n, lines: [] });
  });
  // dérivés
  T.pv = T.vitBase + T.vit;
  T.ini += T.for + T.int + T.cha + T.agi;
  T.pro += Math.floor(T.cha / 10);
  T.tac += Math.floor(T.agi / 10); T.fui += Math.floor(T.agi / 10);
  T.esqpa += Math.floor(T.sag / 10); T.esqpm += Math.floor(T.sag / 10);
  T.retpa += Math.floor(T.sag / 10); T.retpm += Math.floor(T.sag / 10);
  T.pod += T.for * 5;
  return { T, sets, items };
}

/* ---------- conditions d'équipement ---------- */
function baseStats(p) {
  const o = {}; BASE_STAT_KEYS.forEach((k) => { o[k] = ((p.alloc || {})[k] || 0) + ((p.parchemins || {})[k] || 0) + ((p.bonus || {})[k] || 0); });
  return o;
}
const COND_STAT = { CS: 'for', CI: 'int', CA: 'agi', CC: 'cha', CV: 'vit', CW: 'sag' };
function condOK(n, ctx) {
  if (!n) return true;
  if (Array.isArray(n)) {
    const [code, op, val] = n; let v;
    if (COND_STAT[code]) v = ctx.base[COND_STAT[code]];
    else if (code === 'CP') v = ctx.T.pa;
    else if (code === 'CM') v = ctx.T.pm;
    else if (code === 'Pk') v = ctx.sb;
    else return true;                       // abonnement, alignement, kamas… : non vérifié
    return op === '>' ? v > val : op === '<' ? v < val : op === '=' ? v === val : op === '!' ? v !== val : true;
  }
  const r = (n.c || []).map((x) => condOK(x, ctx));
  if (!r.length) return true;
  return n.r === 'or' ? r.some(Boolean) : r.every(Boolean);
}
function computeBuild(p, b, jet) {
  const r = _compute(p, b, jet, null);
  r.viol = [];
  Object.entries((b && b.items) || {}).forEach(([slot, id]) => {
    const it = IB.get(id); if (!it || !it.cn) return;
    const r2 = _compute(p, b, jet, slot);
    const sb = r2.sets.reduce((a, x) => a + (x.n >= 2 ? x.n - 1 : 0), 0);
    if (!condOK(it.cn, { base: baseStats(p), T: r2.T, sb })) r.viol.push(slot);
  });
  return r;
}

/* ---------- calcul de dégâts ---------- */
/* ligne = [élément, min, max, vol] ; ctx = {T, cible:{rp:[5],rf:[5]}, type:'sort'|'arme', crit:boolean, melee:boolean, cb} */
function lineDamage(line, ctx, roll) {
  const [el, mn, mx] = line;
  let base = roll === 'min' ? mn : roll === 'max' ? mx : (mn + mx) / 2;
  if (ctx.crit && ctx.cb) base += ctx.cb;
  const T = ctx.T;
  const carac = T[ELEM_STAT[el]] || 0;
  let d = base * (100 + carac + T.pui) / 100;
  d += T.do + T[ELEM_DOM[el]] + (ctx.crit ? T.dcri : 0);
  let pct = ctx.type === 'arme' ? T.darm : T.dsort;
  pct += ctx.melee ? T.dmel : T.ddist;
  d *= (100 + pct) / 100;
  const rp = clamp((ctx.cible.rp[el] || 0), -999, 50);
  d = Math.floor(d) * (100 - rp) / 100;
  d = Math.floor(d) - (ctx.cible.rf[el] || 0);
  return Math.max(0, Math.floor(d));
}
function damageReport(lines, linesCrit, base) {
  // base: {T,cible,type,melee,cc (proba crit %), cb}
  const out = { n: [0, 0, 0], c: [0, 0, 0], det: [] };
  lines.forEach((ln, i) => {
    const cl = (linesCrit && linesCrit[i]) || ln;
    const ctxN = { ...base, crit: false }, ctxC = { ...base, crit: true, cb: base.type === 'arme' ? base.cb : 0 };
    const r = {
      el: ln[0], steal: ln[3],
      n: ['min', 'moy', 'max'].map((k) => lineDamage(ln, ctxN, k)),
      c: ['min', 'moy', 'max'].map((k) => lineDamage(cl, ctxC, k)),
    };
    for (let j = 0; j < 3; j++) { out.n[j] += r.n[j]; out.c[j] += r.c[j]; }
    out.det.push(r);
  });
  const pc = clamp(base.cc, 0, 100) / 100;
  out.moy = out.n[1] * (1 - pc) + out.c[1] * pc;
  out.pc = pc;
  return out;
}
function weaponLines(it) {
  return (it && it.w || []).filter((w) => WEAPON_DMG[w[0]]).map((w) => [WEAPON_DMG[w[0]][0], w[1], w[2] || w[1], WEAPON_DMG[w[0]][1]]);
}

/* ---------- objets réellement obtenables ---------- */
const _obt = new Map();
function isObtainable(it) {
  if (_obt.has(it.i)) return _obt.get(it.i);
  let ok = !/\(MJ\)/.test(it.n) && (RBY.has(it.i) || (it.d && it.d.length) || it.st === 13 || it.st === 12);
  if (!ok && it.s && !/\(MJ\)/.test(it.n)) {
    const set = SETS.get(it.s);
    ok = !!set && set.i.some((id) => { const x = IB.get(id); return x && x !== it && (RBY.has(x.i) || (x.d && x.d.length)); });
  }
  _obt.set(it.i, ok); return ok;
}

/* ---------- générateur de build ---------- */
const PROFILS = {
  'Terre / Force (mêlée)': { for: 1, pui: 1, do: 4, dter: 4, dcri: 1.5, cri: 1.2, vit: 0.15, pa: 80, pm: 60, ini: 0.01, dmel: 3, rpter: 0.3, rpfeu: 0.3, rpeau: 0.3, rpair: 0.3, rpneu: 0.3 },
  'Feu / Intelligence': { int: 1, pui: 1, do: 4, dfeu: 4, dcri: 1.5, cri: 1.2, vit: 0.15, pa: 80, pm: 60, po: 8, rpter: 0.3, rpfeu: 0.3, rpeau: 0.3, rpair: 0.3, rpneu: 0.3 },
  'Eau / Chance': { cha: 1, pui: 1, do: 4, deau: 4, dcri: 1.5, cri: 1.2, vit: 0.15, pa: 80, pm: 60, po: 8, pro: 0.5, rpter: 0.3, rpfeu: 0.3, rpeau: 0.3, rpair: 0.3, rpneu: 0.3 },
  'Air / Agilité': { agi: 1, pui: 1, do: 4, dair: 4, dcri: 1.5, cri: 1.2, vit: 0.15, pa: 80, pm: 60, po: 8, tac: 0.3, fui: 0.3, rpter: 0.3, rpfeu: 0.3, rpeau: 0.3, rpair: 0.3, rpneu: 0.3 },
  'Soigneur': { int: 1, soin: 6, pui: 1, vit: 0.4, pa: 80, pm: 60, po: 8, ini: 0.02, rpter: 0.4, rpfeu: 0.4, rpeau: 0.4, rpair: 0.4, rpneu: 0.4 },
  'Tank': { vit: 1, rpter: 3, rpfeu: 3, rpeau: 3, rpair: 3, rpneu: 3, rfter: 1, rffeu: 1, rfeau: 1, rfair: 1, rfneu: 1, pa: 60, pm: 60, tac: 1, fui: 0.5, rcri: 1 },
  'Prospecteur (farm)': { pro: 3, cha: 0.2, vit: 0.1, pa: 40, pm: 40, pod: 0.05 },
};
function scoreStats(T, w, mins, conds) {
  let s = 0;
  for (const k in w) { let v = T[k] || 0; if (k.startsWith('rp')) v = Math.min(v, 50); s += w[k] * v; }
  if (mins) {
    if (T.pa < mins.pa) s -= 1e5 * (mins.pa - T.pa);
    if (T.pm < mins.pm) s -= 1e5 * (mins.pm - T.pm);
    if (T.po < mins.po) s -= 1e5 * (mins.po - T.po);
    for (const k in mins) { if (k === 'pa' || k === 'pm' || k === 'po' || !mins[k]) continue; if ((T[k] || 0) < mins[k]) s -= 2e3 * (mins[k] - (T[k] || 0)); }
  }
  if (conds) for (const k in conds) {
    const c = conds[k]; if (!c || c.v == null || c.v === '') continue;
    const v = k === 'pv' ? T.pv : (T[k] || 0);
    const gap = c.op === '<=' ? v - c.v : c.op === '=' ? Math.abs(v - c.v) : c.v - v;
    if (gap > 0) s -= (k === 'pa' || k === 'pm' || k === 'po' ? 1e8 : 2e3) * gap;
  }
  return s;
}
function optimizeBuild(p, startItems, opts) {
  // opts: {w, mins, locked:Set, exclude:{dofus:bool}, jet, maxLevel, tries}
  const jet = opts.jet || 'max';
  const slots = SLOT_DEFS.map((d) => d.k).filter((k) => !(k.startsWith('dofus') && opts.noDofus) && !(opts.skip && opts.skip.has(k)));
  const ww = { ...opts.w };
  Object.entries(opts.conds || {}).forEach(([k, c]) => { if (c && c.v != null && c.v !== '' && c.op !== '<=') ww[k] = Math.max(ww[k] || 0, 30); });
  const itemScore = (it) => { let s = 0; (it.e || []).forEach((e) => { const k = STAT_BY_ID[e[0]]; if (k && ww[k]) s += ww[k] * effVal(e, jet); }); return s; };
  const cand = {};
  slots.forEach((sl) => {
    let list = POOL[sl].filter((it) => it.l <= opts.maxLevel && !(sl === 'arme' && opts.weaponTypes && !opts.weaponTypes.has(it.t)) && !(opts.excl && opts.excl.has(it.i)) && !/\(MJ\)/.test(it.n) && (!opts.obtainable || isObtainable(it)) && !(opts.exclude && opts.exclude(it)));
    list = list.map((it) => [it, itemScore(it) + (it.s ? 0.001 : 0)]).sort((a, b) => b[1] - a[1]);
    const top = list.slice(0, opts.objective ? 70 : 60).map((x) => x[0]);
    // objets de panoplie intéressants
    const setPick = list.filter((x) => x[0].s).slice(0, 160).map((x) => x[0]);
    cand[sl] = [...new Set([...top, ...setPick])];
  });
  const pseudo = { niveau: p.niveau, alloc: p.alloc, parchemins: p.parchemins, bonus: Object.assign({}, p.bonus, ...(opts.exo ? [Object.fromEntries(Object.entries(opts.exo).filter(([k, v]) => v).map(([k]) => [k, ((p.bonus || {})[k] || 0) + 1]))] : [])), classe: p.classe };
  const evalB = (items) => { const r = computeBuild(pseudo, { items }, jet); return (opts.objective ? opts.objective(r.T, items) : 0) + scoreStats(r.T, opts.objective ? {} : opts.w, opts.mins, opts.conds) - (opts.ignoreCond ? 0 : 1e6 * r.viol.length); };
  const used = (items) => new Set(Object.values(items));
  const improve = (items) => {
    let best = evalB(items); let changed = true; let guard = 0;
    while (changed && guard++ < 12) {
      changed = false;
      for (const sl of slots) {
        if (opts.locked && opts.locked.has(sl)) continue;
        const cur = items[sl]; const u = used(items);
        let bestId = cur;
        for (const it of cand[sl]) {
          if (it.i === cur || u.has(it.i)) continue;
          items[sl] = it.i; const sc = evalB(items);
          if (sc > best + 1e-9) { best = sc; bestId = it.i; changed = true; }
        }
        if (bestId == null) delete items[sl]; else items[sl] = bestId;
      }
    }
    return best;
  };
  const initial = {}; Object.assign(initial, startItems || {});
  Object.keys(initial).forEach((sl) => { if ((opts.skip && opts.skip.has(sl)) || (opts.excl && opts.excl.has(initial[sl]) && !(opts.locked && opts.locked.has(sl)))) delete initial[sl]; });
  slots.forEach((sl) => { if (opts.locked && opts.locked.has(sl)) return; if (initial[sl] && IB.get(initial[sl]).l > opts.maxLevel) delete initial[sl]; });
  let bestItems = { ...initial }; let bestScore = improve(bestItems);
  const tries = opts.tries || 14;
  for (let t = 0; t < tries; t++) {
    const items = { ...bestItems };
    // perturbation : on retire quelques objets et on ajoute une panoplie "graine"
    slots.forEach((sl) => { if (!(opts.locked && opts.locked.has(sl)) && Math.random() < 0.45) delete items[sl]; });
    const seeds = cand[slots[Math.floor(Math.random() * slots.length)]].filter((x) => x.s);
    if (seeds.length) {
      const seedSet = SETS.get(seeds[Math.floor(Math.random() * seeds.length)].s);
      if (seedSet) {
        seedSet.i.forEach((id) => {
          const it = IB.get(id); if (!it || it.l > opts.maxLevel) return;
          const sl = slots.find((s) => slotAccepts(s, it) && !items[s] && !(opts.locked && opts.locked.has(s)));
          if (sl && !Object.values(items).includes(id)) items[sl] = id;
        });
      }
    }
    const sc = improve(items);
    if (sc > bestScore) { bestScore = sc; bestItems = items; }
  }
  // exploration systématique : chaque panoplie candidate comme graine, puis paires des meilleures
  const seedBuild = (ids) => {
    const items = {};
    ids.forEach((id) => { const it = IB.get(id); if (!it || it.l > opts.maxLevel) return;
      const sl = slots.find((s) => slotAccepts(s, it) && !items[s] && !(opts.locked && opts.locked.has(s)) && cand[s].includes(it)); if (sl && !Object.values(items).includes(id)) items[sl] = id; });
    (opts.locked ? [...opts.locked] : []).forEach((sl) => { if (initial[sl]) items[sl] = initial[sl]; });
    return items;
  };
  const setIds = [...new Set(slots.flatMap((sl) => cand[sl].filter((x) => x.s).map((x) => x.s)))];
  const ranked = setIds.map((sid) => { const st = SETS.get(sid); if (!st) return null; const it = seedBuild(st.i); const f = improve0(it); return { sid, f, ids: st.i }; }).filter(Boolean).sort((a, b) => b.f - a.f);
  function improve0(it) { return evalB(it); }
  const topSets = ranked.slice(0, 14);
  const trySeed = (ids) => { const items = seedBuild(ids); const sc = improve(items); if (sc > bestScore) { bestScore = sc; bestItems = items; } };
  topSets.forEach((r) => trySeed(r.ids));
  for (let i = 0; i < Math.min(8, topSets.length); i++) for (let j = i + 1; j < Math.min(8, topSets.length); j++) trySeed([...topSets[i].ids, ...topSets[j].ids]);
  { const sc = improve(bestItems); if (sc > bestScore) bestScore = sc; }
  return { items: bestItems, score: bestScore };
}


/* ---------- critères de sorts (comme dofgen) ---------- */
/* crit : [{k:'arme'|'s<id>', n:nombre de lancers}] ; cfg : {tours, defense 0..1, cible, melee} */
function spellList(p, items) {
  const out = {}; const c = classOf(p);
  const w = items && items.arme && IB.get(items.arme);
  out.arme = w ? { n: w.n, ap: w.ap || 4, mc: w.mc || 1, type: 'arme', lines: weaponLines(w), cc: w.cc || 0, cb: w.cb || 0 } : null;
  c.sp.forEach((s) => { if (s.d && s.d.length) out['s' + s.id] = { n: s.n, ap: s.ap, mc: s.mc || 99, type: 'sort', lines: s.d, crit: s.dc && s.dc.length ? s.dc : null, cc: s.cc || 0, cb: 0, ic: s.ic }; });
  return out;
}
function critDamage(sp, T, cfg) {
  if (!sp || !sp.lines.length) return 0;
  const rep = damageReport(sp.lines, sp.crit, { T, cible: cfg.cible, melee: cfg.melee, type: sp.type, cc: sp.cc + T.cri, cb: sp.cb });
  return rep.moy;
}
function makeObjective(p, crit, cfg) {
  const aux = {}; // poids auxiliaires dérivés des éléments utilisés (préfiltrage des objets)
  const sl = spellList(p, null);
  let el = [0, 0, 0, 0, 0];
  crit.forEach((c) => { const s = sl[c.k]; if (s) s.lines.forEach((l) => { el[l[0]] += (l[1] + l[2]) / 2 * c.n; }); });
  const tot = el.reduce((a, b) => a + b, 0) || 1;
  const ek = ['for', 'for', 'int', 'cha', 'agi'], dk = ['dneu', 'dter', 'dfeu', 'deau', 'dair'];
  aux.pui = 1; aux.do = 4; aux.dcri = 1; aux.cri = 1; aux.dsort = 3; aux.pa = 80; aux.pm = 30;
  el.forEach((v, i) => { const f = v / tot; if (f > 0.03) { aux[ek[i]] = (aux[ek[i]] || 0) + f; aux[dk[i]] = (aux[dk[i]] || 0) + 4 * f; } });
  aux.vit = 0.15 * (0.3 + cfg.defense * 2); ['rpter', 'rpfeu', 'rpeau', 'rpair', 'rpneu'].forEach((k) => { aux[k] = 0.3 * (0.3 + cfg.defense * 3); });
  let dmgRef = 0, defRef = 1, K = 0;
  const damage = (T, items) => {
    const spl = spellList(p, items); let need = 0, d = 0;
    crit.forEach((c) => { const s = spl[c.k]; if (!s) return; const n = Math.min(c.n, s.mc === 99 ? c.n : s.mc * cfg.tours); need += n * s.ap; d += critDamage(s, T, cfg) * n; });
    const avail = T.pa * cfg.tours;
    return need > avail ? d * (avail / need) : d;
  };
  const def = (T) => T.pv / 10 + ['rpter', 'rpfeu', 'rpeau', 'rpair', 'rpneu'].reduce((a, k) => a + Math.min(T[k] || 0, 50), 0) * 12 + ['rfter', 'rffeu', 'rfeau', 'rfair', 'rfneu'].reduce((a, k) => a + (T[k] || 0), 0) * 3 + (T.rcri || 0) * 2;
  const fn = (T, items) => {
    const d = damage(T, items);
    if (!cfg.defense) return d;
    return d * (1 - cfg.defense) + cfg.defense * K * def(T);
  };
  fn.calibrate = (T, items) => { dmgRef = damage(T, items) || 1; defRef = def(T) || 1; K = dmgRef / defRef; };
  fn.aux = aux; fn.damage = damage;
  return fn;
}
