/* ===== Guides pas à pas : étapes à cocher, plusieurs guides suivis, validation par perso / équipe ===== */
'use strict';
(function () {
  const IDB = 'atelier-guides';
  const LIB = new Map();                       // id -> fiche du guide (nom, auteur, n étapes…) ; les étapes arrivent à la demande (gu.steps)
  (window.D_GUIDE_INDEX || []).forEach((m) => LIB.set(m.id, Object.assign({}, m)));
  const G = () => { const s = S(); s.guides = s.guides || {}; const g = s.guides; g.follow = g.follow || []; g.prog = g.prog || {}; g.cur = g.cur || {}; g.who = g.who || []; return g; };
  const U = () => (Views._g = Views._g || { mode: 'liste', q: '', page: 0 });

  /* ---- guides importés : stockés dans le cloud (un document par guide) + copie locale ---- */
  function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('g'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbAll() { try { const db = await idbOpen(); return await new Promise((res) => { const out = []; const q = db.transaction('g').objectStore('g').openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out.push(c.value); c.continue(); } else res(out); }; q.onerror = () => res([]); }); } catch (e) { return []; } }
  async function idbGet(id) { try { const db = await idbOpen(); return await new Promise((res) => { const q = db.transaction('g').objectStore('g').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function idbPut(g) { try { const db = await idbOpen(); await new Promise((res, rej) => { const tx = db.transaction('g', 'readwrite'); tx.objectStore('g').put(g, g.id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { /* rien */ } }
  async function idbDel(id) { try { const db = await idbOpen(); await new Promise((res) => { const tx = db.transaction('g', 'readwrite'); tx.objectStore('g').delete(id); tx.oncomplete = res; }); } catch (e) { /* rien */ } }
  const metaOf = (g) => ({ id: g.id, name: g.name, author: g.author, likes: g.likes, lang: g.lang, upd: g.upd, src: g.src, n: g.n != null ? g.n : g.steps.length, imported: true });
  function saveIdx() {
    const o = { _at: Date.now(), list: [...LIB.values()].filter((m) => m.imported).map(metaOf) };
    Store.kvSet('gidx', o); if (Store.cloud) Store.cq(() => Store.cset('app/gidx', o));
  }
  function uploadGuide(g) { const full = { id: g.id, name: g.name, author: g.author, likes: g.likes, lang: g.lang, upd: g.upd, src: g.src, n: g.steps.length, steps: g.steps }; idbPut(full); if (Store.cloud) Store.cq(() => Store.cset('guide/' + g.id, full)); }
  /* chargement des étapes d'un guide, seulement quand on l'ouvre */
  const FULL = new Map();
  function ensure(id) {
    const m = LIB.get(id); if (!m) return Promise.reject(new Error('guide inconnu'));
    if (m.steps) return Promise.resolve(m);
    if (!FULL.has(id)) {
      const p = (async () => {
        if (m.imported) {
          let g = await idbGet(id);
          if (!g && Store.cloud) { g = await Store.cget('guide/' + id); if (g) idbPut(g); }
          if (!g) throw new Error('guide introuvable');
          m.steps = g.steps;
        } else {
          await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'data/guides/' + id + '.js'; sc.onload = res; sc.onerror = () => rej(new Error('chargement impossible')); document.head.appendChild(sc); });
          m.steps = (window.__GD || {})[id]; if (!m.steps) throw new Error('guide vide');
        }
        return m;
      })();
      p.catch(() => FULL.delete(id)); FULL.set(id, p);
    }
    return FULL.get(id);
  }
  async function initGuides() {
    try {
      const r = await Store.pick('app/gidx', 'gidx'); (r && r.list || []).forEach((m) => LIB.set(m.id, Object.assign({}, m, { imported: true })));
      if (!(await Store.kvGet('gmig'))) {                         // anciens imports gardés seulement dans ce navigateur → on les range dans le cloud
        const old = await idbAll(); let add = false;
        old.forEach((g) => { const ex = LIB.get(g.id); if (g.steps && !ex) { LIB.set(g.id, metaOf(g)); uploadGuide(g); add = true; } });
        if (add) saveIdx(); await Store.kvSet('gmig', 1);
      }
    } catch (e) { /* hors ligne : seuls les guides intégrés sont listés */ }
  }
  function fromExport(d) {
    if (!d || !Array.isArray(d.steps)) throw new Error('fichier non reconnu');
    return { id: d.id, name: d.name || ('Guide ' + d.id), author: (d.user && d.user.name) || '?', likes: d.likes || 0, lang: d.lang || 'fr', upd: (d.updated_at || '').slice(0, 10), src: 'https://ganymede-app.com/guides/' + d.id, imported: true, n: d.steps.length,
      steps: d.steps.map((s) => ({ id: s.id, x: s.pos_x, y: s.pos_y, h: s.web_text || '' })) };
  }

  /* ---- progression : prog[guide][perso] = { 's3': true (étape faite), 'c3.2': true (case) } ---- */
  const who = () => { const g = G(); const ids = g.who.filter((id) => getPerso(id)); return ids.length ? ids : (S().persos[0] ? [S().persos[0].id] : []); };
  const pg = (gid, pid) => { const g = G(); g.prog[gid] = g.prog[gid] || {}; return (g.prog[gid][pid] = g.prog[gid][pid] || {}); };
  const isDone = (gid, pid, i) => !!pg(gid, pid)['s' + i];
  const countDone = (gid, pid) => { const gu = LIB.get(gid); if (!gu) return 0; let n = 0; for (let i = 0; i < gu.n; i++) if (isDone(gid, pid, i)) n++; return n; };
  function setStep(gid, i, val) { G().last = gid; who().forEach((pid) => { pg(gid, pid)['s' + i] = val ? 1 : 0; }); touch(); }
  function setCheck(gid, i, k, val) { who().forEach((pid) => { pg(gid, pid)['c' + i + '.' + k] = val ? 1 : 0; }); touch(); }
  const curStep = (gid) => { const gu = LIB.get(gid); const c = G().cur[gid]; const w = who(); let nx = gu.n - 1;
    if (w.length) for (let k = 0; k < gu.n; k++) if (!w.every((pid) => isDone(gid, pid, k))) { nx = k; break; }
    return clamp(Math.max(c == null ? 0 : c, nx), 0, gu.n - 1); };
  const firstTodo = (gid) => { const gu = LIB.get(gid); const w = who(); for (let i = 0; i < gu.n; i++) if (w.some((pid) => !isDone(gid, pid, i))) return i; return gu.n - 1; };

  /* ---- rendu sécurisé du HTML d'une étape ---- */
  /* liste blanche : seules les balises et attributs ci-dessous passent, tout le reste est retiré */
  const OK_TAGS = new Set(['P', 'SPAN', 'DIV', 'UL', 'OL', 'LI', 'LABEL', 'INPUT', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR', 'HR', 'A', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'SVG', 'MATH', 'BASE', 'TEMPLATE', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO', 'CANVAS']);
  const OK_ATTRS = new Set(['type', 'name', 'imageurl', 'dofusdbid', 'alt', 'title', 'questid', 'questname', 'status', 'guideid', 'stepid', 'stepnumber', 'guidename', 'label', 'baseurl', 'checked', 'width', 'height']);
  const OK_STYLE = new Set(['color', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'background-color']);
  const OK_CLASS = /^(tag-|img-|quest-|guide-|custom-tag)/;
  /* couleurs du texte : les jaunes/rouges/blancs criards de Ganymède deviennent des teintes douces qui suivent le thème (clair ou sombre) */
  function softColor(val) {
    const t = val.trim().toLowerCase(); let r, g, b, m;
    if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t))) { const x = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]; r = parseInt(x.slice(0, 2), 16); g = parseInt(x.slice(2, 4), 16); b = parseInt(x.slice(4, 6), 16); }
    else if ((m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(t))) { r = +m[1]; g = +m[2]; b = +m[3]; }
    else return val;
    if (r > 225 && g > 225 && b > 225) return '';                       // blanc : couleur du thème
    if (r < 40 && g < 40 && b < 40) return '';                          // noir : couleur du thème
    if (r > 200 && g > 190 && b < 110) return 'var(--gy)';              // jaune
    if (r > 200 && g < 110 && b < 110) return 'var(--gr)';              // rouge
    if (b > 190 && r < 140) return 'var(--gb)';                         // bleu
    return val;
  }
  function cleanStyle(v) { return v.split(';').map((d) => d.trim()).filter((d) => { const i = d.indexOf(':'); if (i < 0) return false; const k = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1); return OK_STYLE.has(k) && !/url\(|expression|javascript|[<>\\]/i.test(val); }).map((d) => { const i = d.indexOf(':'); const k = d.slice(0, i).trim().toLowerCase(); if (k === 'color') { const c = softColor(d.slice(i + 1)); return c ? 'color: ' + c : ''; } if (k === 'background-color') return ''; return d; }).filter(Boolean).join('; '); }
  function clean(node) {
    [...node.childNodes].forEach((el) => {
      if (el.nodeType === 3) return;
      if (el.nodeType !== 1) { el.remove(); return; }
      const tag = el.tagName;
      if (DROP_TAGS.has(tag)) { el.remove(); return; }
      if (!OK_TAGS.has(tag)) { clean(el); while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); return; }
      [...el.attributes].forEach((a) => {
        const n = a.name.toLowerCase(); const v = a.value; let keep = false;
        if (n.startsWith('data-')) keep = true;
        else if (OK_ATTRS.has(n)) keep = true;
        else if (n === 'class') { const c = v.split(/\s+/).filter((x) => OK_CLASS.test(x)).join(' '); if (c) el.setAttribute('class', c); else el.removeAttribute('class'); return; }
        else if (n === 'style') { const c = cleanStyle(v); if (c) el.setAttribute('style', c); else el.removeAttribute('style'); return; }
        else if (n === 'href') keep = tag === 'A' && /^https?:\/\//i.test(v);
        else if (n === 'src') keep = tag === 'IMG' && /^(https:\/\/|data:image\/(png|jpe?g|gif|webp);)/i.test(v);
        else if (n === 'target' || n === 'rel') keep = tag === 'A';
        if (!keep) el.removeAttribute(a.name);
      });
      if (tag === 'INPUT') { if ((el.getAttribute('type') || '').toLowerCase() !== 'checkbox') { el.remove(); return; } }
      if (tag === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
      if (tag === 'IMG') { el.setAttribute('referrerpolicy', 'no-referrer'); el.setAttribute('loading', 'lazy'); el.addEventListener('error', () => { el.style.visibility = 'hidden'; }); }
      clean(el);
    });
  }
  const copy = (t) => { const done = () => toast('Copié : ' + t); try { navigator.clipboard.writeText(t).then(done).catch(() => done()); } catch (e) { done(); } };
  /* commande à copier : /travel seul, ou /zaap puis /travel quand le guide indique un zaap */
  const posCmd = (o) => !o.z ? '/travel ' + o.x + ',' + o.y : (o.z[0] === +o.x && o.z[1] === +o.y) ? '/zaap ' + o.z[0] + ',' + o.z[1] : '/zaap ' + o.z[0] + ',' + o.z[1] + ' ; /travel ' + o.x + ',' + o.y;
  const posLabel = (o) => '📍 ' + o.x + ', ' + o.y + (o.z ? ' · zaap ' + o.z[0] + ',' + o.z[1] : '');
  const mkPos = (o, noMap) => { const b = h('button', { class: 'gpos', onclick: (e) => { e.stopPropagation(); if (e.shiftKey && !noMap) { Views._carte = Views._carte || { wm: 1 }; Views._carte.wm = 1; Views._carte.goto = [+o.x, +o.y]; location.hash = '#/carte'; } else copy(posCmd(o)); } });
    b.refresh = () => { b.textContent = posLabel(o); b.title = 'Copier ' + posCmd(o) + ' (clic) — voir sur la carte (Maj+clic)'; }; b.refresh(); return b; };
  const POS_RE = /\[(zaap:)?(-?\d+), ?(-?\d+)\]/g;
  function posify(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const list = []; let n; while ((n = w.nextNode())) if (/\[(zaap:)?-?\d+, ?-?\d+\]/.test(n.nodeValue)) list.push(n);
    let last = null; // dernière position rencontrée : un [zaap:x,y] qui la suit lui est rattaché
    list.forEach((t) => {
      const frag = document.createDocumentFragment(); let pos0 = 0; const s = t.nodeValue;
      s.replace(POS_RE, (m, zp, x, y, off) => { frag.appendChild(document.createTextNode(s.slice(pos0, off))); pos0 = off + m.length;
        if (zp) { if (last) { last.o.z = [+x, +y]; last.b.refresh(); } else frag.appendChild(document.createTextNode(m)); }
        else { const o = { x, y, z: null }; const b = mkPos(o); last = { o, b }; frag.appendChild(b); }
        return m; });
      frag.appendChild(document.createTextNode(s.slice(pos0))); t.parentNode.replaceChild(frag, t);
    });
  }
  /* positions d'un texte brut, avec leur éventuel zaap */
  function parsePos(txt) { const out = []; for (const m of txt.matchAll(POS_RE)) { if (m[1]) { if (out.length) out[out.length - 1].z = [+m[2], +m[3]]; } else out.push({ x: +m[2], y: +m[3], z: null }); } return out; }
  function renderStep(gu, i) {
    const st = gu.steps[i]; const doc = new DOMParser().parseFromString('<div>' + (st.h || '<p><i>(étape vide)</i></p>') + '</div>', 'text/html'); const box = doc.body.firstChild;
    clean(box);
    const out = h('div', { class: 'gbody' });
    out.appendChild(document.importNode(box, true));
    // cases à cocher
    const tasks = out.querySelectorAll('li[data-type="taskItem"]'); const w = who();
    tasks.forEach((li, k) => {
      const inp = li.querySelector('input'); if (!inp) return;
      const on = w.length && w.every((pid) => pg(gu.id, pid)['c' + i + '.' + k]);
      li.setAttribute('data-checked', on ? 'true' : 'false'); inp.checked = !!on;
      inp.addEventListener('change', () => { li.setAttribute('data-checked', inp.checked ? 'true' : 'false'); setCheck(gu.id, i, k, inp.checked); refreshBars(); });
    });
    out.querySelectorAll('.guide-step').forEach((el) => {
      const gid = +el.getAttribute('guideid'); el.style.cursor = 'pointer'; el.title = LIB.has(gid) ? 'Ouvrir ce guide' : 'Guide absent de ta bibliothèque — ouvrir sur Ganymède';
      el.addEventListener('click', () => { if (LIB.has(gid)) { U().open = gid; rerender(); } else window.open('https://ganymede-app.com/guides/' + gid, '_blank', 'noopener'); });
    });
    const seenPos = new Set(); const positions = [];
    parsePos(out.textContent || '').forEach((o) => { const k = o.x + ',' + o.y; if (!seenPos.has(k)) { seenPos.add(k); positions.push(o); } });
    posify(out);
    tagify(out);
    const stepBar = itemBar(out, gu, i);
    const wrap = h('div', { class: 'gx-body gx-flow' });
    wrap.appendChild(out);
    if (stepBar) wrap.appendChild(stepBar);
    return wrap;
  }
  let refreshBars = () => {};

  /* ---- raccourcis : objets, monstres, quêtes, donjons cliquables ---- */
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('mousedown', (e) => { if (pop && !pop.contains(e.target) && !e.target.closest('[data-type="custom-tag"]')) closePop(); });
  function showPop(anchor, content) {
    closePop(); pop = h('div', { class: 'gpop' }, content); document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(); const w = pop.offsetWidth, hh = pop.offsetHeight;
    pop.style.left = clamp(r.left, 8, window.innerWidth - w - 8) + 'px'; pop.style.top = (r.bottom + 6 + hh > window.innerHeight ? Math.max(8, r.top - hh - 6) : r.bottom + 6) + 'px';
  }
  const inCraft = (id) => { const e = S().craft.liste.find((x) => x.id === id); return e ? e.qty : 0; };
  function addBtn(id, qtyInput, after) {
    return h('button', { class: 'btn primary sm', onclick: () => { const q = Math.max(1, parseInt(qtyInput.value, 10) || 1); addToCraft(id, q); toast('Ajouté au craft : ' + IB.get(id).n + ' ×' + q + ' (total ' + inCraft(id) + ')'); after && after(); } }, '➕ Ajouter au craft');
  }
  function itemPop(anchor, id) {
    const it = IB.get(id); const q = h('input', { class: 'inp', type: 'number', min: 1, value: 1, style: { width: '70px' } });
    const rec = RBY.get(id);
    const info = h('div', { class: 'gp-info' }, h('small', { class: 'muted' }, (typeName(it.t) || 'Objet') + (it.l ? ' · niv. ' + it.l : '') + (rec ? ' · se craft' : ' · ressource')), inCraft(id) ? h('small', { class: 'pos' }, ' · déjà ' + inCraft(id) + ' dans le craft') : null);
    showPop(anchor, h('div', null, h('div', { class: 'row gap' }, itemImg(it, 'sm'), h('b', null, it.n)), info,
      h('div', { class: 'row gap', style: { marginTop: '8px' } }, h('span', { class: 'muted sm' }, 'Quantité'), q, addBtn(id, q, () => itemPop(anchor, id))),
      h('div', { class: 'row gap', style: { marginTop: '6px' } }, h('a', { class: 'btn ghost sm', href: '#/craft' }, 'Ouvrir le craft'), S().marche[id] ? h('small', { class: 'muted' }, 'Prix connu : ' + kam(S().marche[id])) : null)));
  }
  function monPop(anchor, id) {
    const m = MONDE.mons[id]; if (!m) { toast('Monstre inconnu dans les données', 'warn'); return; }
    const zs = MONDE.subs.filter((z) => z.m.includes(+id));
    showPop(anchor, h('div', null, h('div', { class: 'row gap' }, monImg(m.g), h('b', null, m.n)), h('small', { class: 'muted' }, 'niv. ' + m.l + (zs.length ? ' · ' + zs.length + ' zone(s)' : '')),
      zs.length ? h('div', { style: { marginTop: '8px' } }, h('div', { class: 'muted sm' }, zs.slice(0, 4).map((z) => z.n).join(', ')),
        h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => { const z = zs[0]; const bs = subBox(z); Views._carte = Views._carte || { wm: 1 }; Views._carte.wm = z.wm || 1; Views._carte.astrub = false; Views._carte.goto = [Math.round((bs[0] + bs[1]) / 2), Math.round((bs[2] + bs[3]) / 2)]; location.hash = '#/carte'; } }, '🗺️ Voir sur la carte')) : null));
  }
  /* icônes des tags : celles du jeu embarquées dans le site (les images distantes ne chargent pas toujours) */
  function swapIcon(el, type, id) {
    const old = el.querySelector('img'); const url = (old && old.getAttribute('src')) || el.getAttribute('imageurl') || '';
    let ico = null; const emo = (e) => h('span', { class: 'gtag-emo' }, e);
    if (type === 'item') {
      if (IB.has(id)) ico = itemImg(IB.get(id), 'xs');
      else { const u = window.D_ICX && D_ICX.item[id] != null ? D_ICX.img[D_ICX.item[id]] : null; if (u) { ico = h('img', { class: 'gtag-img', src: u, alt: '' }); } else ico = emo('📦'); }
    } else if (type === 'monster') {
      const m = /monsters\/(\d+)/.exec(url); const g = MONDE.mons[id] ? MONDE.mons[id].g : (m ? +m[1] : null);
      ico = g != null ? monImg(g, 'xs') : emo('👹');
    } else if (type === 'quest') ico = emo('📜');
    else if (type === 'dungeon') ico = emo('🏰');
    else return;
    if (old) old.remove();
    el.insertBefore(ico, el.firstChild);
  }
  function tagify(root) {
    root.querySelectorAll('[data-type="custom-tag"]').forEach((el) => {
      const type = el.getAttribute('type'); const id = +(el.getAttribute('dofusdbid') || el.getAttribute('data-id'));
      swapIcon(el, type, id);
      if (type === 'item' && IB.has(id)) { el.classList.add('gtag-act'); el.title = 'Cliquer : ajouter au craft'; el.addEventListener('click', (e) => { e.stopPropagation(); itemPop(el, id); }); }
      else if (type === 'monster' && MONDE.mons[id]) { el.classList.add('gtag-act'); el.title = 'Cliquer : où le trouver'; el.addEventListener('click', (e) => { e.stopPropagation(); monPop(el, id); }); }
    });
  }
  /* barre « ressources de l'étape » : tout ajouter d'un clic */
  function itemBar(root, gu, si) {
    const seen = new Map();
    root.querySelectorAll('.tag-item[type="item"]').forEach((el) => { const id = +(el.getAttribute('dofusdbid') || el.getAttribute('data-id')); if (IB.has(id) && !seen.has(id)) seen.set(id, 1); });
    if (!seen.size) return null;
    const ids = [...seen.keys()];
    return h('div', { class: 'gitems' }, h('span', { class: 'muted sm' }, '🔨 Objets de cette étape'), ids.slice(0, 12).map((id) => h('button', { class: 'gchip', title: 'Ajouter ×1 au craft', onclick: () => { addToCraft(id, 1); toast('Ajouté au craft : ' + IB.get(id).n + ' (total ' + inCraft(id) + ')'); } }, '+ ' + IB.get(id).n)),
      h('button', { class: 'btn sm primary', title: 'Quantités à ajuster avant d\'ajouter au craft', onclick: () => shopping(gu, si) }, '🛒 Courses de cette étape'));
  }
  function subBox(sub) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; sub.c.forEach(([x, y]) => { if (!x && !y) return; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); return [x0, x1, y0, y1]; }

  /* ---- sélecteur de persos ---- */
  function whoBar() {
    const sel = who();
    const bar = h('div', { class: 'gwho' }, h('span', { class: 'muted sm' }, 'Je valide pour :'));
    S().persos.forEach((p) => bar.appendChild(h('button', { class: 'gchip' + (sel.includes(p.id) ? ' on' : ''), onclick: () => { const g = G(); let l = g.who.filter((id) => getPerso(id)); if (!l.length) l = [...sel]; l = l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id]; if (!l.length) l = [p.id]; g.who = l; touch(); rerender(); } }, p.nom)));
    if (S().persos.length > 1) bar.appendChild(h('button', { class: 'gchip', onclick: () => { G().who = S().persos.map((p) => p.id); touch(); rerender(); } }, '👥 Toute l\'équipe'));
    return bar;
  }
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  /* ---- vues ---- */
  Views.guides = (main, arg) => {
    const u = U();
    if (!S().persos.length) { main.appendChild(h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📜'), h('h2', null, 'Crée d\'abord un personnage'), h('a', { class: 'btn primary', href: '#/persos' }, 'Aller aux persos'))); return; }
    if (arg && /^\d+$/.test(arg)) u.open = +arg;
    const head = h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Guides'), h('p', { class: 'muted' }, 'Guides pas à pas à cocher, plusieurs à la fois, par perso ou pour toute l\'équipe.')),
      h('div', { class: 'row gap' }, h('label', { class: 'btn' }, '⬆ Importer un guide', h('input', { type: 'file', accept: '.json', multiple: true, style: { display: 'none' }, onchange: async (e) => {
        for (const f of e.target.files) { try { const g = fromExport(JSON.parse(await f.text())); LIB.set(g.id, g); uploadGuide(g); saveIdx(); toast('Guide importé : ' + g.name); } catch (er) { toast('Fichier non reconnu : ' + f.name, 'warn'); } }
        rerender(); } }))));
    if (!(u.open && LIB.has(u.open))) main.appendChild(head);
    if (u.open && LIB.has(u.open)) {
      const m = LIB.get(u.open); if (m.steps) { reader(main, m); return; }
      const box = h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📜'), h('p', { class: 'muted' }, 'Chargement du guide…')); main.appendChild(box);
      ensure(m.id).then(() => { if (U().open === m.id && location.hash.startsWith('#/guides')) rerender(); }).catch((e) => { clear(box); box.appendChild(h('p', null, 'Impossible de charger ce guide (' + e.message + ').')); box.appendChild(h('button', { class: 'btn primary', onclick: () => rerender() }, 'Réessayer')); box.appendChild(h('button', { class: 'btn', style: { marginLeft: '8px' }, onclick: () => { U().open = null; rerender(); } }, '← Guides')); });
      return;
    }
    u.open = null;
    main.appendChild(tabs([{ k: 'liste', n: '📚 Bibliothèque' }, { k: 'suivis', n: '📌 Mes guides suivis (' + G().follow.filter((id) => LIB.has(id)).length + ')' }], u.mode, (k) => { u.mode = k; rerender(); }));
    main.appendChild(whoBar());
    if (u.mode === 'suivis') {
      const need = G().follow.filter((id) => LIB.has(id) && !LIB.get(id).steps);
      if (need.length) { main.appendChild(h('p', { class: 'muted' }, 'Chargement des guides suivis…')); Promise.all(need.map(ensure)).then(() => { if (U().mode === 'suivis' && !U().open && location.hash.startsWith('#/guides')) rerender(); }).catch(() => {}); return; }
      followed(main);
    } else library(main);
  };

  function library(main) {
    const u = U(); const g = G();
    const q = h('input', { class: 'inp', placeholder: 'Rechercher un guide…', value: u.q, style: { width: '100%', maxWidth: '420px' }, oninput: (e) => { u.q = e.target.value; list(); } });
    main.appendChild(h('div', { style: { margin: '12px 0' } }, q));
    const box = h('div', { class: 'glist' }); main.appendChild(box);
    function list() {
      clear(box); const s = norm(u.q);
      [...LIB.values()].filter((x) => !s || norm(x.name).includes(s)).forEach((gu) => {
        const w = who()[0]; const n = w ? countDone(gu.id, w) : 0; const fol = g.follow.includes(gu.id);
        box.appendChild(h('div', { class: 'card gcard' },
          h('div', { class: 'gc-top' }, h('div', null, h('h3', null, gu.name), h('div', { class: 'muted sm' }, gu.n + ' étapes · par ' + gu.author + ' · maj ' + gu.upd + (gu.likes ? ' · 👍 ' + gu.likes : '')))),
          progress(pct(n, gu.n), n + ' / ' + gu.n),
          h('div', { class: 'row gap wrap', style: { marginTop: '10px' } },
            h('button', { class: 'btn primary', onclick: () => { u.open = gu.id; g.cur[gu.id] = n >= gu.n ? 0 : firstTodo(gu.id); touch(); rerender(); } }, n ? '▶ Continuer' : '▶ Commencer'),
            h('button', { class: 'btn' + (fol ? ' on' : ''), onclick: () => { g.follow = fol ? g.follow.filter((x) => x !== gu.id) : [...g.follow, gu.id]; touch(); rerender(); } }, fol ? '📌 Suivi' : '📍 Suivre'),
            h('a', { class: 'btn ghost', href: gu.src, target: '_blank', rel: 'noopener' }, 'Source ↗'),
            gu.imported ? h('button', { class: 'btn ghost', onclick: () => confirmBox('Retirer ce guide importé ? (ta progression est conservée)', async () => { await idbDel(gu.id); LIB.delete(gu.id); saveIdx(); if (Store.cloud) Store.cq(() => Store.cset('guide/' + gu.id, {})); rerender(); }, 'Retirer') }, '🗑') : null)));
      });
      if (!box.children.length) box.appendChild(h('p', { class: 'muted' }, 'Aucun guide.'));
    }
    list();
    main.appendChild(h('p', { class: 'muted sm', style: { marginTop: '14px' } }, 'Guides © leurs auteurs (Ganymède — ganymede-app.com). Importés pour ton usage personnel ; ne les republie pas. Pour ajouter un guide : exporte-le depuis Ganymède, puis « Importer un guide ».'));
  }

  function followed(main) {
    const g = G(); const ids = g.follow.filter((id) => LIB.has(id));
    if (!ids.length) { main.appendChild(h('div', { class: 'card empty' }, h('p', null, 'Aucun guide suivi. Dans la bibliothèque, clique « Suivre » sur les guides à avancer en parallèle.'))); return; }
    const plan = [];
    ids.forEach((gid) => { const gu = LIB.get(gid); const i = firstTodo(gid); const st = gu.steps[i]; const txt = (new DOMParser().parseFromString(st.h, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
      const pos = parsePos(txt); plan.push({ gu, i, txt, pos }); });
    // ordre de parcours : plus proche voisin à partir de la première position
    const withPos = plan.filter((p) => p.pos.length), noPos = plan.filter((p) => !p.pos.length); const order = [];
    if (withPos.length) { let cur = withPos.shift(); order.push(cur); while (withPos.length) { const { x: cx, y: cy } = cur.pos[cur.pos.length - 1]; withPos.sort((a, b) => (Math.abs(a.pos[0].x - cx) + Math.abs(a.pos[0].y - cy)) - (Math.abs(b.pos[0].x - cx) + Math.abs(b.pos[0].y - cy))); cur = withPos.shift(); order.push(cur); } }
    const all = order.concat(noPos);
    main.appendChild(h('div', { class: 'card' }, h('h3', null, '🧭 Prochaine étape de chaque guide suivi'), h('p', { class: 'muted sm' }, 'Classées pour enchaîner les positions proches. Clique pour ouvrir l\'étape.'),
      all.map((p, k) => h('div', { class: 'gnext', onclick: () => { U().open = p.gu.id; G().cur[p.gu.id] = p.i; rerender(); } }, h('b', null, (k + 1) + '. ' + p.gu.name), h('small', { class: 'muted' }, ' — étape ' + (p.i + 1) + '/' + p.gu.n),
        h('div', { class: 'gn-txt' }, p.txt.slice(0, 180) + (p.txt.length > 180 ? '…' : '')), p.pos.length ? h('div', null, p.pos.slice(0, 6).map((o) => mkPos(o, true))) : null))));
    ids.forEach((gid) => { const gu = LIB.get(gid); main.appendChild(h('div', { class: 'card' }, h('b', null, gu.name), bars(gu))); });
  }

  function reader(main, gu) {
    const u = U(); const g = G(); const n = gu.n; let i = curStep(gu.id); const PER = 1; if (g.last !== gu.id) { g.last = gu.id; touch(); }
    if (!g.tabs) g.tabs = [...g.follow]; if (!g.tabs.includes(gu.id)) { g.tabs.push(gu.id); touch(); }
    const tabIds = g.tabs.filter((x) => LIB.has(x));
    main.appendChild(h('div', { class: 'gx-tabs' }, tabIds.map((id) => { const t = LIB.get(id); const w0 = who(); const d = w0.length ? Math.min(...w0.map((pid) => countDone(id, pid))) : 0;
      const close = (e) => { e.stopPropagation(); g.tabs = g.tabs.filter((x) => x !== id); touch(); if (id === gu.id) { const nx = tabIds.filter((x) => x !== id); if (nx.length) U().open = nx[Math.max(0, tabIds.indexOf(id) - 1)] === id ? nx[0] : nx[Math.max(0, tabIds.indexOf(id) - 1)]; else { U().open = null; location.hash = '#/guides'; } } rerender(); };
      return h('div', { class: 'gx-tab' + (id === gu.id ? ' on' : ''), title: t.name, onclick: () => { U().open = id; rerender(); window.scrollTo(0, 0); } }, h('span', null, t.name), h('button', { class: 'gx-x', title: 'Fermer cet onglet', onclick: close }, '✕'), h('i', { style: { width: pct(d, t.n) + '%' } })); })));
    main.appendChild(h('div', { class: 'gx-top' },
      h('button', { class: 'btn ghost', onclick: () => { u.open = null; location.hash = '#/guides'; rerender(); } }, '← Guides'),
      h('div', { class: 'gx-title' }, h('h2', null, gu.name), h('small', { class: 'muted' }, 'par ' + gu.author + ' · ' + gu.n + ' étapes')),
      h('div', { class: 'gx-tools' },
        h('button', { class: 'btn sm', title: 'Objets à prévoir pour les étapes restantes', onclick: () => shopping(gu) }, '🛒 Courses'),
        h('button', { class: 'btn sm' + (g.follow.includes(gu.id) ? ' on' : ''), title: 'Suivre ce guide sur l\'accueil et dans « Mes guides suivis »', onclick: () => { g.follow = g.follow.includes(gu.id) ? g.follow.filter((x) => x !== gu.id) : [...g.follow, gu.id]; touch(); rerender(); } }, g.follow.includes(gu.id) ? '📌 Suivi' : '📍 Suivre'),
        h('div', { class: 'gx-seg' },
          h('button', { class: g.view !== 'liste' ? 'on' : '', onclick: () => { g.view = 'etape'; touch(); rerender(); } }, 'Étape par étape'),
          h('button', { class: g.view === 'liste' ? 'on' : '', onclick: () => { g.view = 'liste'; touch(); rerender(); } }, 'Liste')))));
    main.appendChild(whoBar());
    const mid = h('div', { class: 'gmain' }); main.appendChild(mid);
    const isOk = (k) => { const w = who(); return !!w.length && w.every((pid) => isDone(gu.id, pid, k)); };
    const jump = () => h('select', { class: 'inp gx-jump', title: 'Aller à une étape', onchange: (e) => go2(+e.target.value) },
      gu.steps.map((st, k) => h('option', { value: k, selected: k === i }, (isOk(k) ? '✓ ' : '') + 'Étape ' + (k + 1))));
    refreshBars = () => {};
    function go2(k) { i = clamp(k, 0, n - 1); g.cur[gu.id] = i; touch(); draw(g.view === 'liste' ? i : null); if (g.view !== 'liste') mainEl.scrollTop = 0; }
    const mainEl = document.getElementById('main');
    function pager(page, pages, per) {
      return h('div', { class: 'gpager' },
        h('button', { class: 'btn sm', disabled: page === 0, onclick: () => go2((page - 1) * per) }, '←'),
        h('span', null, 'Page ' + (page + 1) + ' / ' + pages),
        h('button', { class: 'btn sm', disabled: page >= pages - 1, onclick: () => go2((page + 1) * per) }, '→'),
        h('span', { class: 'sp' }), h('span', { class: 'muted sm' }, 'Étapes par page'),
        h('select', { class: 'inp', onchange: (e) => { g.per = +e.target.value; touch(); draw(); } }, [1, 2, 3, 5, 10, 20].map((v) => h('option', { value: v, selected: v === (g.per || 3) }, v))));
    }
    function draw(scrollTo) {
      clear(mid); const w = who();
      if (g.view === 'liste') {
        const per = g.per || 3, pages = Math.ceil(n / per), page = Math.floor(i / per), from = page * per, to = Math.min(n, from + per);
        mid.appendChild(pager(page, pages, per));
        for (let k = from; k < to; k++) {
          const dn = w.length && w.every((pid) => isDone(gu.id, pid, k));
          mid.appendChild(h('div', { class: 'card gstep' + (dn ? ' gdone' : ''), id: 'gstep-' + k },
            h('div', { class: 'gs-head' }, h('div', { class: 'gx-num' }, 'Étape ', h('b', null, k + 1), h('small', null, ' / ' + n)), h('span', { class: 'sp' }), h('button', { class: 'btn' + (dn ? ' on' : ' primary'), onclick: () => { const y = mainEl.scrollTop; setStep(gu.id, k, !dn); draw(); mainEl.scrollTop = y; } }, dn ? '✓ Faite' : '✔ Valider' + (w.length > 1 ? ' pour ' + w.length + ' persos' : ''))),
            renderStep(gu, k)));
        }
        mid.appendChild(pager(page, pages, per));
        if (scrollTo != null) { const el = document.getElementById('gstep-' + scrollTo); if (el) el.scrollIntoView({ block: 'start' }); }
        return;
      }
      const done = isOk(i);
      mid.appendChild(h('div', { class: 'card gstep' },
        h('div', { class: 'gs-head' }, h('div', { class: 'gx-num' }, 'Étape ', h('b', null, i + 1), h('small', null, ' / ' + n)), h('span', { class: 'sp' }),
          done ? h('button', { class: 'btn sm on', title: 'Marquer cette étape comme non faite', onclick: () => { setStep(gu.id, i, false); draw(); } }, '✓ Faite · annuler') : null, jump()),
        renderStep(gu, i),
        h('div', { class: 'row between', style: { marginTop: '14px' } }, h('button', { class: 'btn', disabled: i === 0, onclick: () => go2(i - 1) }, '← Précédente'),
          h('button', { class: 'btn primary', title: 'Valide cette étape et passe à la suivante', onclick: () => { setStep(gu.id, i, true); if (i < n - 1) { go2(i + 1); } else { draw(); toast('Guide terminé 🎉'); } } }, i === n - 1 ? '✔ Terminer' : 'Suivante →'))));
    }
    const key = (e) => { if (!document.getElementById('main') || !location.hash.startsWith('#/guides') || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (g.view !== 'liste') { if (e.key === 'ArrowRight') go2(i + 1); else if (e.key === 'ArrowLeft') go2(i - 1); } };
    document.addEventListener('keydown', key); Views._cleanup = () => { document.removeEventListener('keydown', key); refreshBars = () => {}; };
    draw();
  }

  /* ---- analyse d'un guide : quêtes, succès, liste de courses ---- */
  const ANA = new Map();
  const SUC_RE = /(?:obten\w*|d[ée]bloqu\w*)\s+(?:le|les|l'|un|ce)?\s*succ[èe]s\s*:?\s*([^.!\n]+)/gi;
  const parseHTML = (html) => new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html').body.firstChild;
  function liItems(li, inBlock) {
    const c = li.cloneNode(true); const ids = [];
    c.querySelectorAll('.tag-item[type="item"]').forEach((el) => { const id = +(el.getAttribute('dofusdbid') || el.getAttribute('data-id')); ids.push(id); el.textContent = '\u0001' + id + '\u0002'; });
    c.querySelectorAll('[data-type="custom-tag"]').forEach((el) => { if (!/\u0001/.test(el.textContent)) el.textContent = ''; });
    let t = c.textContent.replace(/ /g, ' '); const par = t.indexOf('('); if (par >= 0) t = t.slice(0, par);
    const out = []; const re = /(?:(\d+)\s*[x×]?\s*)?(?:\S{0,3}\s)?\u0001(\d+)\u0002/g; let m;
    if (!inBlock) { const f = t.trim().match(/^(\d+)\s*[x×]?\s*\u0001(\d+)\u0002/); if (f) out.push([+f[2], +f[1]]); return out; }
    while ((m = re.exec(t))) out.push([+m[2], m[1] ? +m[1] : 1]);
    return out;
  }
  function analyze(gu) {
    if (ANA.has(gu.id)) return ANA.get(gu.id);
    const quests = new Map(), achs = [], blocks = new Map(), loose = [];
    gu.steps.forEach((st, i) => {
      const root = parseHTML(st.h);
      root.querySelectorAll('.quest-block').forEach((b) => {
        const qid = b.getAttribute('questid'); const status = b.getAttribute('status') || ''; const name = b.getAttribute('questname') || b.getAttribute('title') || ('Quête ' + qid);
        if (!quests.has(qid)) quests.set(qid, { id: qid, name, first: i, end: -1 });
        const q = quests.get(qid); if (status === 'end') q.end = i;
        const items = []; b.querySelectorAll('li').forEach((li) => items.push(...liItems(li, true)));
        if (items.length) { const arr = blocks.get(qid) || []; arr.push({ status, step: i, items }); blocks.set(qid, arr); }
      });
      root.querySelectorAll('.quest-block').forEach((b) => b.remove());
      root.querySelectorAll('li').forEach((li) => { liItems(li, false).forEach(([id, q]) => loose.push({ id, qty: q, step: i })); });
      const t = root.textContent.replace(/ /g, ' '); SUC_RE.lastIndex = 0; let m;
      while ((m = SUC_RE.exec(t))) { let n = m[1].trim().replace(/\s+/g, ' '); if (n.length < 4 || /^(monstre|\d)/i.test(n) || /^[a-zà-ÿ]/.test(n)) continue; if (!achs.some((a) => norm(a.name) === norm(n))) achs.push({ name: n, step: i }); }
    });
    const shop = [];
    blocks.forEach((arr, qid) => { const pick = arr.find((b) => b.status === 'setup') || arr[0]; const q = quests.get(qid); pick.items.forEach(([id, qty]) => shop.push({ id, qty, step: pick.step, q: q && q.name })); });
    loose.forEach((x) => shop.push(x));
    const list = [...quests.values()].filter((q) => q.end >= 0);
    const res = { quests: list, achs, shop };
    ANA.set(gu.id, res); return res;
  }
  /* ---- liste de courses d'un guide ---- */
  function stepShop(gu, i) {
    const root = parseHTML(gu.steps[i].h); const out = []; const seen = new Set();
    root.querySelectorAll('li').forEach((li) => { liItems(li, true).forEach(([id, q]) => { seen.add(id); out.push({ id, qty: q, step: i }); }); });
    root.querySelectorAll('.tag-item[type="item"]').forEach((el) => { const id = +(el.getAttribute('dofusdbid') || el.getAttribute('data-id')); if (!seen.has(id)) { seen.add(id); out.push({ id, qty: 1, step: i }); } });
    return out;
  }
  function shopping(gu, only) {
    const a = analyze(gu); const w = who();
    const todo = only != null ? stepShop(gu, only).filter((x) => IB.has(x.id)) : a.shop.filter((x) => IB.has(x.id) && w.some((pid) => !isDone(gu.id, pid, x.step)));
    const agg = new Map(); todo.forEach((x) => { const e = agg.get(x.id) || { id: x.id, qty: 0, from: new Set() }; e.qty += x.qty; if (x.q) e.from.add(x.q); agg.set(x.id, e); });
    const rows = [...agg.values()].sort((p, q) => IB.get(p.id).n.localeCompare(IB.get(q.id).n));
    const ov2 = h('div', { class: 'gmodal', onclick: (e) => { if (e.target === ov2) ov2.remove(); } });
    const card = h('div', { class: 'card gmodal-c' }, h('div', { class: 'row between' }, h('h3', null, only != null ? '🛒 Courses — étape ' + (only + 1) : '🛒 Liste de courses — ' + gu.name), h('button', { class: 'btn ghost', onclick: () => ov2.remove() }, '✕')));
    if (!rows.length) card.appendChild(h('p', { class: 'muted' }, 'Aucun objet à prévoir ici (ou ils ne sont pas dans les données du jeu).'));
    else {
      card.appendChild(h('p', { class: 'muted sm' }, 'Objets des étapes que tu n\'as pas encore validées. Décoche ce que tu as déjà, ajuste les quantités, puis ajoute au craft.'));
      const sel = new Map(); const list = h('div', { class: 'gshop' });
      rows.forEach((r) => { const st = { on: true, qty: r.qty }; sel.set(r.id, st); const it = IB.get(r.id);
        const qi = h('input', { type: 'number', min: 1, value: r.qty, class: 'gshop-q', oninput: (e) => { st.qty = Math.max(1, +e.target.value || 1); } });
        list.appendChild(h('label', { class: 'gshop-r' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { st.on = e.target.checked; } }), itemImg(it), h('span', { class: 'gshop-n' }, it.n, r.from.size ? h('small', { class: 'muted' }, ' · ' + [...r.from].slice(0, 2).join(', ')) : null), qi)); });
      card.appendChild(list);
      card.appendChild(h('div', { class: 'row gap', style: { marginTop: '12px' } }, h('button', { class: 'btn primary', onclick: () => { let n = 0; sel.forEach((st, id) => { if (st.on) { addToCraft(id, st.qty); n++; } }); toast(n + ' objet(s) ajoutés au craft'); ov2.remove(); } }, '🔨 Ajouter au craft'), h('a', { class: 'btn', href: '#/craft', onclick: () => ov2.remove() }, 'Voir le craft')));
    }
    ov2.appendChild(card); document.body.appendChild(ov2);
  }
  /* résumé pour la page d'accueil */
  /* mise à niveau unique : le guide complet est à l'étape 55, donc tout ce qu'il demande avant est marqué fait (rien n'est jamais décoché).
     Guides à moitié : on coche jusqu'à l'étape indiquée par le guide complet ; guides facultatifs, d'alignement et de simple lecture : non touchés. */
  const CATCH_UP = { 2747: 54, 2: 'tout', 374: 'tout', 3: 'tout', 25: 'tout', 24: 'tout', 306: 'tout', 431: 'tout', 62: 'tout', 183: 4, 104: 13, 66: 19, 30: 22, 2042: 25, 88: 30, 98: 5, 427: 6, 430: 6 };
  function catchUp() {
    const g = G(); if (g.rattrape1) return 0; g.rattrape1 = 1;
    const gp0 = LIB.get(2747); if (!gp0) return 0;
    const ps = S().persos.filter((p) => countDone(2747, p.id) >= 40); if (!ps.length) return 0;
    let guides = 0;
    Object.entries(CATCH_UP).forEach(([gid, upto]) => { gid = +gid; const gu = LIB.get(gid); if (!gu) return; const n = upto === 'tout' ? gu.n : Math.min(upto, gu.n); let any = false;
      ps.forEach((p) => { const pr = pg(gid, p.id); for (let i = 0; i < n; i++) if (!pr['s' + i]) { pr['s' + i] = 1; any = true; } }); if (any && gid !== 2747) guides++; });
    g.cur[2747] = Math.max(g.cur[2747] || 0, 54); touch(); return guides;
  }
  window.GuidesAPI = {
    init: initGuides,
    catchUp,
    last() {
      if (!S().persos.length) return null; const g = G(); let id = g.last; if (!LIB.has(id)) id = g.follow.find((x) => LIB.has(x)); if (id == null) return null;
      const gu = LIB.get(id); const w = who(); const done = w.length ? Math.min(...w.map((pid) => countDone(id, pid))) : 0;
      return { id, name: gu.name, n: gu.n, done, step: firstTodo(id), finished: done >= gu.n };
    },
    rows() {
      if (!S().persos.length) return [];
      const g = G(); const ids = g.follow.filter((id) => LIB.has(id)); const use = ids.length ? ids : [...LIB.keys()].slice(0, 3);
      const w = who();
      return use.slice(0, 4).map((id) => { const gu = LIB.get(id); const n = gu.n; const done = w.length ? Math.min(...w.map((pid) => countDone(id, pid))) : 0; return { id, name: gu.name, n, done, followed: ids.includes(id) }; });
    },
    resume(id) { const u = U(); u.open = id; G().cur[id] = firstTodo(id); touch(); location.hash = '#/guides'; rerender(); },
  };
})();
