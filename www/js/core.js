/* ===== Atelier Dofus — noyau : utilitaires, données, stockage, routeur ===== */
'use strict';
const W = window;

/* ---------- petit helper DOM ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const fmt = (n) => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('fr-FR');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function parseKamas(s) {
  if (typeof s === 'number') return s;
  s = (s || '').toString().toLowerCase().replace(/\s/g, '').replace(',', '.');
  if (!s) return 0;
  const m = s.match(/^(-?[\d.]+)(k|m|g)?$/);
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6, g: 1e9 }[m[2]] || 1;
  return Math.round(parseFloat(m[1]) * mult) || 0;
}
const kam = (n) => { n = Math.round(n || 0); const a = Math.abs(n); return (a >= 1e6 ? (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M' : a >= 1e4 ? (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k' : n.toLocaleString('fr-FR')) + ' ₭'; };
const kfmt = (n) => (n == null || n === '' || isNaN(n)) ? '' : fmt(n);
function todayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(str, n) { const d = new Date(str + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); }
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateLong(str) {
  const d = new Date(str + 'T12:00:00');
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- données du jeu ---------- */
const ITEMS = W.D_ITEMS || [];
const IB = new Map(ITEMS.map((i) => [i.i, i]));
const SETS = new Map((W.D_SETS || []).map((s) => [s.id, s]));
const META = W.D_META || { types: {}, labels: {} };
const TYPES = META.types;
const LAB = META.labels;
const REC = W.D_RECIPES || { recipes: [], jobs: {}, skills: {}, xp: [] };
const RBY = new Map();            // résultat -> recettes
REC.recipes.forEach((r) => { if (!RBY.has(r.r)) RBY.set(r.r, []); RBY.get(r.r).push(r); });
const MONDE = W.D_MONDE || { subs: [], sup: [], mons: {} };
const SUBS = new Map(MONDE.subs.map((s) => [s.id, s]));
const ARCHI = W.D_ARCHI || [];
const CLASSES = W.D_CLASSES || [];
const ALM = new Map((W.D_ALMANAX || []).map((a) => [a.d, a]));
const typeName = (id) => (TYPES[id] || {}).n || '';

// monstres -> objets qu'ils lâchent ; ressource -> zones de récolte
const HARV = new Map();
MONDE.subs.forEach((s) => (s.h || []).forEach((id) => { if (!HARV.has(id)) HARV.set(id, []); HARV.get(id).push(s); }));

const ATL_FILE = { items: 'img/atlas-items.webp', mon: 'img/atlas-mon.webp', spl: 'img/atlas-spl.webp', mnt: window.MNT_IMG };
function spr(kind, key, cls, fallback) {
  const A = window.ATLAS && window.ATLAS[kind]; const i = A && A.idx[key];
  if (i == null) { const im = h('img', { class: 'ico ' + (cls || ''), src: fallback, loading: 'lazy', alt: '' }); im.addEventListener('error', () => { im.style.visibility = 'hidden'; }, { once: true }); return im; }
  const rows = Math.ceil(Object.keys(A.idx).length / A.cols);
  const el = h('span', { class: 'ico spr ' + (cls || '') });
  el.style.backgroundImage = 'url(' + ATL_FILE[kind] + ')';
  el.style.backgroundSize = (A.cols * 100) + '% ' + (rows * 100) + '%';
  el.style.backgroundPosition = (A.cols > 1 ? (i % A.cols) / (A.cols - 1) * 100 : 0) + '% ' + (rows > 1 ? Math.floor(i / A.cols) / (rows - 1) * 100 : 0) + '%';
  return el;
}
function itemImg(it, cls) {
  const ic = it && (it.ic != null ? it.ic : it);
  if (typeof ic === 'string' && ic[0] === 'm') return spr('mnt', ic, cls, '');
  const base = spr('items', String(ic), cls, window.D_ICX && D_ICX.img[ic] ? D_ICX.img[ic] : `img/items/${ic}.webp`);
  return base;
}
function monImg(g, cls) { return spr('mon', String(g), 'mon ' + (cls || ''), `img/monsters/${g}.webp`); }
function spellImg(ic, cls) { return spr('spl', String(ic), cls, `img/spells/${ic}.webp`); }

/* ---------- état + stockage ---------- */
const DEFAULT_STATE = () => ({
  v: 1,
  persos: [],       // {id,nom,classe,niveau,equipe,alloc,parchemins,bonus,builds:[],build}
  equipes: [],      // {id,nom,couleur}
  marche: {},       // itemId -> prix marché connu
  ocre: {},         // persoId -> {archiId:true}
  almanax: { fait: {} },   // 'persoId|date' -> true ; 'all|date'
  craft: { liste: [], stock: {}, dev: true },
  metiers: {},      // persoId -> {jobId: niveau}
  compta: { avec: true, reventes: [
    { id: 'r1', n: 'Robuste', item: 13827, paid: 0, vente: 0, vendu: false },
    { id: 'r2', n: 'Robuste', item: 13827, paid: 0, vente: 0, vendu: false } ] },
  prefs: { jet: 'max', persoSel: null, ocrePerso: null },
});
/* ---------- stockage : une sauvegarde « index » (réglages + liste des profils) et une sauvegarde PAR profil ----------
   cloud : app/idx, prof/<id> (découpés en morceaux si besoin) · local : IndexedDB (cache) · profil actif : propre à chaque appareil */
const PKEYS = ['persos', 'equipes', 'ocre', 'almanax', 'craft', 'metiers', 'compta', 'guides', 'boss'];
const SEL_KEYS = ['persoSel', 'ocrePerso'];
const SZ = 200000;
const jclone = (o) => JSON.parse(JSON.stringify(o));
function downloadFile(name, text, type) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), download: name }); document.body.appendChild(a); a.click(); a.remove(); }
const Store = {
  state: DEFAULT_STATE(),
  cloud: null,
  dirty: false,
  at: { idx: 0, prof: 0 },
  _idxStr: '',

  /* --- local --- */
  async kvDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('atelier-dofus', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async kvGet(k) {
    try { const db = await this.kvDb(); return await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
    catch (e) { try { return JSON.parse(localStorage.getItem('atelier:' + k)); } catch (e2) { return null; } }
  },
  async kvSet(k, v) {
    try { const db = await this.kvDb(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
    catch (e) { try { localStorage.setItem('atelier:' + k, JSON.stringify(v)); } catch (e2) { /* rien */ } }
  },

  /* --- cloud (capacité db de l'artifact) --- */
  async cloudInit() {
    if (this.cloud !== null) return this.cloud;
    this.cloud = false;
    try {
      if (window.claude && claude.use) {
        const db = await Promise.race([claude.use('db'), new Promise((r) => setTimeout(() => r(null), 4000))]);
        if (db) this.cloud = db;
      }
    } catch (e) { this.cloud = false; }
    return this.cloud;
  },
  async cget(path) {
    const db = this.cloud; if (!db) return null;
    const m = await db.doc(path).get(); if (!m.exists) return null;
    const d = m.data(); let txt = d.json;
    if (d.chunks) { txt = ''; for (let i = 0; i < d.chunks; i++) { const c = await db.doc('chunk/' + path.replace('/', '_') + '_' + i).get(); txt += (c.exists ? c.data().t : ''); } }
    return txt ? JSON.parse(txt) : null;
  },
  async cset(path, obj) {
    const db = this.cloud; if (!db) return;
    const txt = JSON.stringify(obj);
    if (txt.length <= SZ) { await db.doc(path).set({ json: txt }); return; }
    const n = Math.ceil(txt.length / SZ);
    for (let i = 0; i < n; i++) await db.doc('chunk/' + path.replace('/', '_') + '_' + i).set({ t: txt.slice(i * SZ, (i + 1) * SZ) });
    await db.doc(path).set({ chunks: n });
  },
  cq(fn) { this._cq = (this._cq || Promise.resolve()).then(fn).catch(() => this.status('Sauvegarde cloud impossible')); return this._cq; },
  /* ancien format (un seul document) : lu une fois pour migrer */
  async legacyCloud() {
    const db = this.cloud; if (!db) return null;
    const m = await db.doc('app/state').get(); if (!m.exists) return null;
    const d = m.data(); let txt = d.json;
    if (d.chunks) { txt = ''; for (let i = 0; i < d.chunks; i++) { const c = await db.doc('app/chunk' + i).get(); txt += (c.exists ? c.data().t : ''); } }
    return txt ? JSON.parse(txt) : null;
  },

  /* le plus récent entre cloud et local ; resynchronise l'autre côté */
  async pick(path, key) {
    let r = null; if (this.cloud) { try { r = await this.cget(path); } catch (e) { r = null; } }
    const l = await this.kvGet(key); const ra = r ? (r._at || 0) : -1, la = l ? (l._at || 0) : -1;
    if (r && ra >= la) { if (ra > la) this.kvSet(key, r); return r; }
    if (l && this.cloud) this.cq(() => this.cset(path, l));
    return l || null;
  },

  async load() {
    await this.cloudInit().catch(() => {});
    let idx = await this.pick('app/idx', 'idx'); let mig = null;
    if (!idx) {
      let a = null, b = null;
      try { a = await this.legacyCloud(); } catch (e) { a = null; }
      b = await this.kvGet('state'); if (!b) { try { b = JSON.parse(localStorage.getItem('atelier-dofus-state')); } catch (e) { b = null; } }
      const old = a && (!b || (a._at || 0) >= (b._at || 0)) ? a : b;
      if (old) { mig = this.migrate(old); idx = mig.idx; }
    }
    if (!idx) idx = { v: 2, _at: 0, prefs: {}, marche: {}, profiles: [{ id: 'p1', name: 'Mon aventure', server: '', n: 0 }] };
    let pid = await this.kvGet('pid'); if (!idx.profiles.some((p) => p.id === pid)) pid = idx.profiles[0].id;
    const pd = mig ? mig.profs[pid] : await this.pick('prof/' + pid, 'prof:' + pid);
    this.apply(idx, pid, pd);
    this.at = { idx: idx._at || 0, prof: (pd && pd._at) || 0 };
    if (mig) { await this.persistAll(mig); }
    return this.state;
  },
  migrate(o) {
    const profs = (o.profiles && o.profiles.length) ? o.profiles : [{ id: 'p1', name: 'Mon aventure', server: '' }];
    const pid = profs.some((p) => p.id === o.pid) ? o.pid : profs[0].id; const now = Date.now(); const out = {};
    profs.forEach((p) => {
      if (p.id === pid) { const d = {}; PKEYS.forEach((k) => { if (o[k] !== undefined) d[k] = o[k]; }); out[p.id] = { _at: now, data: d, sel: { persoSel: (o.prefs || {}).persoSel || null, ocrePerso: (o.prefs || {}).ocrePerso || null } }; }
      else out[p.id] = { _at: now, data: p.data || {}, sel: p.sel || {} };
    });
    const prefs = Object.assign({}, o.prefs || {}); SEL_KEYS.forEach((k) => delete prefs[k]);
    const idx = { v: 2, _at: now, prefs, marche: o.marche || {}, profiles: profs.map((p) => ({ id: p.id, name: p.name, server: p.server || '', n: ((out[p.id].data.persos) || []).length })) };
    return { idx, profs: out };
  },
  async persistAll(mig) {
    await this.kvSet('idx', mig.idx); for (const id of Object.keys(mig.profs)) await this.kvSet('prof:' + id, mig.profs[id]);
    if (this.cloud) this.cq(async () => { await this.cset('app/idx', mig.idx); for (const id of Object.keys(mig.profs)) await this.cset('prof/' + id, mig.profs[id]); });
  },
  /* construit l'état en mémoire : réglages globaux + données du profil actif à la racine */
  apply(idx, pid, pd) {
    const def = DEFAULT_STATE(); const st = def;
    st.prefs = Object.assign(def.prefs, idx.prefs || {}); st.marche = idx.marche || {};
    st.profiles = jclone(idx.profiles); st.pid = pid;
    this.loadData(st, pd);
    this.state = st;
  },
  loadData(st, pd) {
    const def = DEFAULT_STATE(); const d = (pd && pd.data) || {};
    PKEYS.forEach((k) => { if (d[k] !== undefined) st[k] = d[k]; else if (def[k] !== undefined) st[k] = def[k]; else delete st[k]; });
    ['craft', 'compta', 'almanax'].forEach((k) => { st[k] = Object.assign(def[k], st[k]); });
    const sel = (pd && pd.sel) || {}; SEL_KEYS.forEach((k) => { st.prefs[k] = sel[k] || null; });
  },

  save: null,
  _doSave() {
    const st = this.state; const now = Date.now();
    const act = st.profiles.find((p) => p.id === st.pid); if (act) act.n = (st.persos || []).length;
    const prefs = jclone(st.prefs); SEL_KEYS.forEach((k) => delete prefs[k]);
    const idx = { v: 2, _at: now, prefs, marche: jclone(st.marche), profiles: st.profiles.map((p) => ({ id: p.id, name: p.name, server: p.server || '', n: p.n || 0 })) };
    const data = {}; PKEYS.forEach((k) => { if (st[k] !== undefined) data[k] = st[k]; });
    const prof = jclone({ _at: now, data, sel: { persoSel: st.prefs.persoSel || null, ocrePerso: st.prefs.ocrePerso || null } });
    const ps = [this.kvSet('prof:' + st.pid, prof)]; const pid = st.pid;
    const s = JSON.stringify(Object.assign({}, idx, { _at: 0 }));
    if (s !== this._idxStr) { this._idxStr = s; this.at.idx = now; ps.push(this.kvSet('idx', idx)); if (this.cloud) ps.push(this.cq(() => this.cset('app/idx', idx))); }
    this.at.prof = now; if (this.cloud) ps.push(this.cq(() => this.cset('prof/' + pid, prof)));
    this.status(this.cloud ? 'Sauvegardé (cloud)' : 'Sauvegardé (navigateur)');
    this.dirty = false;
    return Promise.all(ps);
  },
  async flush() { if (this.dirty) await this._doSave(); await this._cq; },
  status(t) { const el = $('#savestate'); if (el) { el.textContent = '● ' + t; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 800); } },

  /* synchro entre appareils : on ne recharge que ce qui a changé (index, et profil actif de CET appareil) */
  async cloudPull() {
    if (!this.cloud || this.dirty) return;
    let changed = false; const st = this.state;
    const ri = await this.cget('app/idx');
    if (ri && (ri._at || 0) > this.at.idx) {
      st.prefs = Object.assign(DEFAULT_STATE().prefs, ri.prefs || {}, { persoSel: st.prefs.persoSel, ocrePerso: st.prefs.ocrePerso });
      st.marche = ri.marche || {}; st.profiles = jclone(ri.profiles); this.at.idx = ri._at; this.kvSet('idx', ri); changed = true;
      if (!st.profiles.some((p) => p.id === st.pid)) { await this.switchProfile(st.profiles[0].id, true); }
    }
    const rp = await this.cget('prof/' + st.pid);
    if (rp && (rp._at || 0) > this.at.prof) { this.loadData(st, rp); this.at.prof = rp._at; this.kvSet('prof:' + st.pid, rp); changed = true; }
    if (changed && typeof rerender === 'function') { rerender(); if (window.Profiles) Profiles.refresh(); }
  },

  /* --- profils --- */
  async profileData(id) {
    const st = this.state;
    if (id === st.pid) { const d = {}; PKEYS.forEach((k) => { if (st[k] !== undefined) d[k] = st[k]; }); return jclone({ data: d, sel: { persoSel: st.prefs.persoSel || null, ocrePerso: st.prefs.ocrePerso || null } }); }
    return (await this.pick('prof/' + id, 'prof:' + id)) || { data: {}, sel: {} };
  },
  async putProfile(id, pd) {
    const o = { _at: Date.now(), data: pd.data || {}, sel: pd.sel || {} };
    await this.kvSet('prof:' + id, o); if (this.cloud) await this.cq(() => this.cset('prof/' + id, o));
  },
  async switchProfile(id, skipFlush) {
    if (!skipFlush) await this.flush();
    const pd = await this.profileData(id); const st = this.state;
    this.loadData(st, pd); st.pid = id; this.at.prof = pd._at || 0; await this.kvSet('pid', id);
  },

  /* --- sauvegarde complète (tous les profils) en un fichier --- */
  async exportAll() {
    await this.flush(); const st = this.state; const profs = {};
    for (const p of st.profiles) profs[p.id] = await this.profileData(p.id);
    const prefs = jclone(st.prefs); SEL_KEYS.forEach((k) => delete prefs[k]);
    return JSON.stringify({ kind: 'atelier-all', v: 2, prefs, marche: st.marche, profiles: st.profiles.map((p) => ({ id: p.id, name: p.name, server: p.server || '', n: p.n || 0 })), profs });
  },
  async importAll(txt) {
    const o = JSON.parse(txt); const now = Date.now();
    let mig;
    if (o.kind === 'atelier-all') mig = { idx: { v: 2, _at: now, prefs: o.prefs || {}, marche: o.marche || {}, profiles: o.profiles }, profs: Object.fromEntries(Object.entries(o.profs || {}).map(([k, v]) => [k, Object.assign({}, v, { _at: now })])) };
    else if (o.persos) mig = this.migrate(o);
    else throw new Error('fichier non reconnu');
    await this.persistAll(mig); await this.cq(async () => {});
    const pid = mig.idx.profiles[0].id; await this.kvSet('pid', pid); this.apply(mig.idx, pid, mig.profs[pid]); this.at = { idx: now, prof: now }; this._idxStr = '';
  },
};
Store.save = debounce(() => Store._doSave(), 350);
document.addEventListener('visibilitychange', () => { if (!document.hidden) Store.cloudPull().catch(() => {}); });
window.addEventListener('beforeunload', () => { if (Store.dirty) Store._doSave(); });
const S = () => Store.state;
function touch() { Store.dirty = true; Store.save(); }


/* ---------- toasts & modales ---------- */
function toast(msg, kind) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast ' + (kind || '') }, msg);
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}
function modal(title, body, opts = {}) {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); document.removeEventListener('keydown', esc); opts.onClose && opts.onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal ' + (opts.cls || '') },
    h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'btn ghost sm', onclick: close, title: 'Fermer' }, '✕')),
    h('div', { class: 'modal-body' }, body));
  back.appendChild(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc);
  document.body.appendChild(back);
  return { close, box };
}
function confirmBox(msg, onYes, yesLabel) {
  const m = modal('Confirmation', h('div', null,
    h('p', null, msg),
    h('div', { class: 'row end gap' },
      h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'),
      h('button', { class: 'btn danger', onclick: () => { m.close(); onYes(); } }, yesLabel || 'Confirmer'))), { cls: 'small' });
}
function promptBox(title, label, val, onOk) {
  const inp = h('input', { class: 'inp', value: val || '', style: { width: '100%' } });
  const go = () => { const v = inp.value.trim(); if (v) { m.close(); onOk(v); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const m = modal(title, h('div', null, h('label', { class: 'lbl' }, label), inp,
    h('div', { class: 'row end gap', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'), h('button', { class: 'btn primary', onclick: go }, 'OK'))), { cls: 'small' });
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
}

/* ---------- composants réutilisables ---------- */
function tabs(items, active, onSel) {
  return h('div', { class: 'tabs' }, items.map((t) => h('button', { class: 'tab' + (t.k === active ? ' on' : ''), onclick: () => onSel(t.k) }, t.n)));
}
function progress(pct, label) {
  return h('div', { class: 'prog' }, h('div', { class: 'prog-bar', style: { width: clamp(pct, 0, 100) + '%' } }), label != null ? h('span', null, label) : null);
}
function searchSelect(placeholder, getList, onPick, render) {
  const inp = h('input', { class: 'inp', placeholder, style: { width: '100%' } });
  const out = h('div', { class: 'ss-list' });
  const upd = () => {
    const q = norm(inp.value); clear(out);
    if (q.length < 2) return;
    getList(q).slice(0, 40).forEach((x) => out.appendChild(h('div', { class: 'ss-item', onclick: () => { onPick(x); inp.value = ''; clear(out); } }, render(x))));
  };
  inp.addEventListener('input', upd);
  return h('div', { class: 'ss' }, inp, out);
}
function itemLabel(it, extra) {
  return h('span', { class: 'ilab' }, itemImg(it), h('span', null, it.n), it.l ? h('em', null, 'niv. ' + it.l) : null, extra || null);
}

/* ---------- routeur ---------- */
/* ---------- thème (identique à Cabinéo, propre à cet appareil) ---------- */
const THEME_KEY = 'atelier-theme';
const ACCENTS = [['Vert sauge', '#1d6b5f'], ['Bleu', '#2455a8'], ['Violet', '#6b4bb0'], ['Bordeaux', '#a33a4f'], ['Orange', '#b4601a'], ['Ardoise', '#3f5568']];
const THEME_DEFAULT = { mode: 'auto', accent: '#cd2f45' };
function themeGet() {
  try {
    const p = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    if (p.preset !== undefined) { localStorage.removeItem(THEME_KEY); return { ...THEME_DEFAULT }; } /* ancien format (ambiances) : abandonné */
    return { ...THEME_DEFAULT, ...p };
  } catch (e) { return { ...THEME_DEFAULT }; }
}
function themeSet(p) { try { localStorage.setItem(THEME_KEY, JSON.stringify({ ...themeGet(), ...p })); } catch (e) { /* stockage indisponible */ } applyTheme(); }
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
/* palette Cabinéo (clair / sombre) rangée sous les noms de variables d'Atelier Dofus */
function themeVars(t) {
  t = t || themeGet();
  const dark = t.mode === 'dark' || (t.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const P = dark
    ? { bg: '#111715', surface: '#19211f', surface2: '#1f2927', field: '#222d2a', fieldLine: '#34413d', line: '#2a3532', ink: '#e5ebe8', mut: '#92a29d' }
    : { bg: '#f3f4f1', surface: '#ffffff', surface2: '#f6f7f4', field: '#eef2ef', fieldLine: '#d3dbd6', line: '#dfe4df', ink: '#1c2523', mut: '#66726e' };
  const accent = /^#[0-9a-f]{6}$/i.test(t.accent || '') ? t.accent : THEME_DEFAULT.accent;
  const acc = dark ? mixHex(accent, '#ffffff', 0.4) : accent;
  const soft = mixHex(P.surface, acc, dark ? 0.24 : 0.15);
  return {
    bg: P.bg, bg2: P.surface2, panel: P.surface, panel2: P.surface, surf: P.surface2, inset: P.field, hover: P.surface2,
    line: P.line, line2: P.line, line3: P.fieldLine, txt: P.ink, muted: P.mut, soft: mixHex(P.ink, P.bg, 0.25),
    nav1: P.surface, nav2: P.surface, g1: P.bg, g2: P.bg, opt: P.surface,
    gold: acc, gold2: acc, violet: acc, v1: acc, v2: acc, accsoft: soft,
    onacc: dark ? '#0b1412' : '#ffffff', scheme: dark ? 'dark' : 'light', light: !dark,
  };
}
function applyTheme() {
  const t = themeGet(), v = themeVars(t), r = document.documentElement;
  for (const k in v) if (k !== 'light') r.style.setProperty('--' + k, v[k]);
  r.toggleAttribute('data-lt', !!v.light);
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
const LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--gold2)"/><stop offset="1" stop-color="var(--gold)"/></linearGradient><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M32 4C45 4 53 26 53 40c0 12-9 20-21 20S11 52 11 40C11 26 19 4 32 4z" fill="url(#lg1)" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><path d="M32 4C45 4 53 26 53 40H11C11 26 19 4 32 4z" fill="rgba(255,255,255,.14)"/><path d="M32 4L22 24l10 36M32 4l10 20-10 36M11 40l11-16h20l11 16" fill="none" stroke="rgba(60,30,0,.28)" stroke-width="1.4" stroke-linejoin="round"/><path d="M24 14c4-6 9-7 11-6-6 3-9 9-11 22-3-6-3-11 0-16z" fill="url(#lg2)"/><path d="M45 8l1.6 3.6L50 13l-3.4 1.4L45 18l-1.6-3.6L40 13l3.4-1.4z" fill="#fff"/></svg>`;
(function () { try { const l = document.querySelector('link[rel=icon]') || document.head.appendChild(h('link', { rel: 'icon' })); l.href = 'data:image/svg+xml,' + encodeURIComponent(LOGO_SVG.replace(/var\(--gold2\)/g, '#ffdc87').replace(/var\(--gold\)/g, '#f0bf4f')); } catch (e) { /* rien */ } })();
const Views = {};
const NAV = [
  { k: 'accueil', n: 'Accueil', i: '🏰' },
  { k: 'persos', n: 'Persos & Builds', i: '⚔️' },
  { k: 'compta', n: 'Compta', i: '💰' },
  { k: 'ocre', n: 'Suivi Ocre', i: '🟠' },
  { k: 'almanax', n: 'Almanax', i: '📅' },
  { k: 'craft', n: 'Atelier de craft', i: '🔨' },
  { k: 'metiers', n: 'Atelier métiers', i: '⛏️' },
  { k: 'guides', n: 'Guides', i: '📜' },
  { k: 'boss', n: 'Boss & avis', i: '👹' },
  { k: 'carte', n: 'Carte du monde', i: '🗺️' },
  { k: 'params', n: 'Paramètres', i: '⚙️' },
];
function route(keep) {
  const hash = location.hash.replace(/^#\/?/, '') || 'accueil';
  const [name, ...args] = hash.split('/');
  const view = Views[name] || Views.accueil;
  $$('.nav-item').forEach((n) => n.classList.toggle('on', n.dataset.k === (name === 'perso' ? 'persos' : name)));
  if (Views._cleanup) { try { Views._cleanup(); } catch (e) { /* rien */ } Views._cleanup = null; }
  const y0 = keep === true ? $('#main').scrollTop : 0; /* rerender : on reste où on était */
  const main = clear($('#main'));
  main.classList.remove('fullmap');
  main.scrollTop = 0;
  try { view(main, ...args.map(decodeURIComponent)); }
  catch (e) { console.error(e); main.appendChild(h('div', { class: 'card' }, h('h2', null, 'Erreur'), h('pre', null, String(e.stack || e)))); }
  if (y0) { main.scrollTop = y0; requestAnimationFrame(() => { main.scrollTop = y0; }); }
}
function go(path) { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; }
function rerender() { route(true); }

function buildShell() {
  const nav = h('nav', { id: 'nav' },
    h('div', { class: 'brand' }, h('div', { class: 'logo', html: LOGO_SVG }), h('div', null, h('b', null, 'Atelier Dofus'), h('small', null, 'Unity · v' + (META.version || '')))),
    window.Profiles ? Profiles.chip('nav') : null,
    NAV.map((n) => h('a', { class: 'nav-item', 'data-k': n.k, href: '#/' + n.k }, h('span', { class: 'ni' }, n.i), n.n)),
    h('div', { class: 'nav-foot' }, h('span', { id: 'savestate' }, '● prêt'), h('small', null, 'Données © Ankama — usage personnel')));
  document.body.appendChild(h('div', { id: 'app' }, nav, h('main', { id: 'main' })));
  // tableaux « empilés » sur mobile : chaque cellule reçoit le libellé de sa colonne
  const label = () => document.querySelectorAll('table.stack:not([data-l])').forEach((t) => {
    const hd = [...t.querySelectorAll('thead th')].map((x) => x.textContent);
    if (!hd.length) return;
    t.querySelectorAll('tbody tr').forEach((r) => [...r.children].forEach((c, i) => { if (hd[i]) c.setAttribute('data-l', hd[i]); }));
    t.setAttribute('data-l', 1);
  });
  new MutationObserver(label).observe(document.getElementById('main'), { childList: true, subtree: true });
}

async function boot() {
  await Store.load();
  if (window.GuidesAPI && GuidesAPI.init) await GuidesAPI.init();
  buildShell();
  window.addEventListener('hashchange', () => route());
  route();
  if (window.GuidesAPI && GuidesAPI.catchUp) { const n = GuidesAPI.catchUp(); if (n) setTimeout(() => toast('Progression mise à jour : guide complet jusqu\'à l\'étape 54 et ' + n + ' autres guides marqués faits'), 1200); }
}
window.addEventListener('DOMContentLoaded', boot);
