/* ===== Persos, builds, stats, dégâts, générateur, compta ===== */
'use strict';

const CLASS_ICON = { Féca: '🛡️', Osamodas: '🐉', Enutrof: '💰', Sram: '🗡️', Xélor: '⏳', Ecaflip: '🎲', Eniripsa: '💚', Iop: '🔥', Crâ: '🏹', Sadida: '🌿', Sacrieur: '🩸', Pandawa: '🍶', Roublard: '💣', Zobal: '🎭', Steamer: '⚙️', Eliotrope: '🌀', Huppermage: '🔮', Ouginak: '🐺', Forgelance: '🔱' };
const TEAM_COL = ['#e8b84a', '#6aa8ff', '#e86a7a', '#6ad6a0', '#b784ff', '#ff9a4a'];
const getPerso = (id) => S().persos.find((p) => p.id === id);
const curBuild = (p) => p.builds.find((b) => b.id === p.buildSel) || p.builds[0];
const className = (id) => { const c = CLASSES.find((x) => x.id === id); return c ? c.n : '?'; };
function newBuild(nom) { return { id: uid(), nom: nom || 'Build 1', items: {}, px: {}, lock: [] }; }
function newPerso(nom, classe, niveau, equipe) {
  const b = newBuild('Build principal');
  const p = { id: uid(), nom, classe, niveau, equipe: equipe || '', alloc: {}, parchemins: {}, bonus: {}, builds: [b], buildSel: b.id, calc: { src: 'arme', melee: true, cible: { rp: [0, 0, 0, 0, 0], rf: [0, 0, 0, 0, 0] } } };
  S().persos.push(p); touch(); return p;
}
function buildCost(b) {
  let paid = 0, mkt = 0, toBuy = 0, boughtMkt = 0, n = 0;
  Object.entries(b.items || {}).forEach(([slot, id]) => {
    n++;
    const px = (b.px || {})[slot] || {};
    const m = px.mkt != null ? px.mkt : (S().marche[id] || 0);
    mkt += m;
    if (px.bought) { paid += px.paid || 0; boughtMkt += m; } else toBuy += m;
  });
  return { paid, mkt, toBuy, boughtMkt, n, loss: paid - boughtMkt };
}

/* ---------------- liste des persos / équipes ---------------- */
Views.persos = (main) => {
  const st = S();
  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'Persos & Builds'), h('p', { class: 'muted' }, 'Tes personnages, leurs builds, leurs stuffs et leur coût.')),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn', onclick: () => promptBox('Nouvelle équipe', 'Nom de l\'équipe', '', (n) => { st.equipes.push({ id: uid(), nom: n, couleur: TEAM_COL[st.equipes.length % TEAM_COL.length] }); touch(); rerender(); }) }, '＋ Équipe'),
      h('button', { class: 'btn primary', onclick: () => persoForm() }, '＋ Personnage')));
  main.appendChild(head);
  if (!st.persos.length) {
    main.appendChild(h('div', { class: 'empty card' }, h('div', { class: 'big' }, '⚔️'), h('h3', null, 'Aucun personnage pour l\'instant'),
      h('p', { class: 'muted' }, 'Crée ton premier personnage, ou toute ton équipe d\'un coup.'),
      h('div', { class: 'row gap center-x' },
        h('button', { class: 'btn primary', onclick: () => persoForm() }, 'Créer un personnage'),
        h('button', { class: 'btn', onclick: quickTeam }, 'Créer une équipe de 4'))));
    return;
  }
  const groups = [...st.equipes.map((e) => ({ e, ps: st.persos.filter((p) => p.equipe === e.id) })), { e: { id: '', nom: 'Sans équipe', couleur: '#7a7f98' }, ps: st.persos.filter((p) => !st.equipes.some((e) => e.id === p.equipe)) }];
  groups.forEach((g) => {
    if (!g.ps.length && !g.e.id) return;
    const tot = g.ps.reduce((a, p) => { const c = buildCost(curBuild(p)); a.paid += c.paid; a.mkt += c.mkt; return a; }, { paid: 0, mkt: 0 });
    main.appendChild(h('section', { class: 'team' },
      h('div', { class: 'team-head', style: { '--tc': g.e.couleur } },
        h('h2', null, g.e.nom, h('small', null, g.ps.length + ' perso(s)')),
        h('div', { class: 'row gap' },
          h('span', { class: 'muted' }, 'Stuff : ' + kam(tot.mkt) + ' · payé ' + kam(tot.paid)),
          g.e.id ? h('button', { class: 'btn ghost sm', onclick: () => promptBox('Renommer l\'équipe', 'Nom', g.e.nom, (n) => { g.e.nom = n; touch(); rerender(); }) }, '✎') : null,
          g.e.id ? h('button', { class: 'btn ghost sm', onclick: () => confirmBox('Supprimer l\'équipe ' + g.e.nom + ' ? (les persos sont conservés)', () => { st.equipes = st.equipes.filter((x) => x !== g.e); touch(); rerender(); }) }, '🗑') : null)),
      h('div', { class: 'grid-cards' }, g.ps.map(persoCard), g.e.id || !g.ps.length ? h('button', { class: 'card add-card', onclick: () => persoForm(null, g.e.id) }, '＋ Ajouter un perso') : null)));
  });
};
function quickTeam() {
  const eq = { id: uid(), nom: 'Ma team', couleur: TEAM_COL[S().equipes.length % TEAM_COL.length] };
  S().equipes.push(eq);
  const defaults = ['Iop', 'Eniripsa', 'Crâ', 'Sadida'];
  defaults.forEach((c, i) => { const cl = CLASSES.find((x) => x.n === c) || CLASSES[0]; newPerso('Perso ' + (i + 1), cl.id, 200, eq.id); });
  touch(); rerender();
}
/* aperçu du personnage (image de la classe, version ♀ ou ♂) */
function classFig(p, cls) {
  const cn = className(p.classe);
  return h('div', { class: 'pc-fig ' + (cls || '') + (p.sexe === 'm' ? ' m' : '') },
    h('img', { alt: cn, referrerpolicy: 'no-referrer', loading: 'lazy', src: 'img/cls/' + p.classe + '.webp',
      onerror: (e) => { const im = e.target; if (!im._f1) { im._f1 = 1; if (window.CLASS_IMG && CLASS_IMG[p.classe]) { im.src = CLASS_IMG[p.classe]; return; } }
        const d = h('div', { class: 'pc-emblem' }, CLASS_ICON[cn] || '⚔'); const par = im.parentNode; if (par) par.replaceChildren(d); } }));
}
function persoCard(p) {
  const b = curBuild(p); const r = computeBuild(p, b); const c = buildCost(b); const T = r.T;
  return h('a', { class: 'card pcard', href: '#/perso/' + p.id },
    h('div', { class: 'pc-body' }, classFig(p),
      h('div', { class: 'pc-info' },
        h('div', { class: 'pc-top' }, h('div', null, h('b', { class: 'pc-name' }, p.nom), h('div', { class: 'muted sm' }, className(p.classe) + ' · niv. ' + p.niveau))),
        h('div', { class: 'pc-stats' },
          h('span', null, h('i', null, 'PA'), T.pa), h('span', null, h('i', null, 'PM'), T.pm), h('span', null, h('i', null, 'PO'), T.po), h('span', null, h('i', null, 'PV'), fmt(T.pv))),
        h('div', { class: 'pc-items' }, Object.values(b.items).slice(0, 14).map((id) => IB.get(id) && itemImg(IB.get(id), 'xs'))))),
    h('div', { class: 'pc-foot muted sm' }, b.nom + ' · ' + c.n + ' objets'));
}
function persoForm(p, equipe) {
  const isNew = !p;
  const o = p ? { ...p } : { nom: '', classe: (CLASSES.find((c) => c.n === 'Iop') || CLASSES[0]).id, niveau: 200, equipe: equipe || '' };
  const nom = h('input', { class: 'inp', value: o.nom, placeholder: 'Nom du personnage' });
  const cl = h('select', { class: 'inp' }, CLASSES.map((c) => h('option', { value: c.id, selected: c.id === o.classe }, c.n)));
  const nv = h('input', { class: 'inp', type: 'number', min: 1, max: 200, value: o.niveau });
  const eq = h('select', { class: 'inp' }, h('option', { value: '' }, '— aucune —'), S().equipes.map((e) => h('option', { value: e.id, selected: e.id === o.equipe }, e.nom)));
  const m = modal(isNew ? 'Nouveau personnage' : 'Modifier le personnage', h('div', { class: 'form' },
    h('label', { class: 'lbl' }, 'Nom'), nom, h('label', { class: 'lbl' }, 'Classe'), cl, h('label', { class: 'lbl' }, 'Niveau'), nv, h('label', { class: 'lbl' }, 'Équipe'), eq,
    h('div', { class: 'row end gap', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'),
      h('button', { class: 'btn primary', onclick: () => {
        const n = nom.value.trim() || 'Sans nom';
        if (isNew) { const np = newPerso(n, +cl.value, clamp(+nv.value || 200, 1, 200), eq.value); m.close(); go('perso/' + np.id); }
        else { p.nom = n; p.classe = +cl.value; p.niveau = clamp(+nv.value || 200, 1, 200); p.equipe = eq.value; touch(); m.close(); rerender(); }
      } }, isNew ? 'Créer' : 'Enregistrer'))), { cls: 'small' });
}

/* ---------------- espace de travail d'un perso ---------------- */
Views.perso = (main, id) => {
  const p = getPerso(id);
  if (!p) { main.appendChild(h('div', { class: 'card' }, 'Personnage introuvable. ', h('a', { href: '#/persos' }, 'Retour'))); return; }
  const b = curBuild(p);
  const jet = S().prefs.jet;
  const res = computeBuild(p, b, jet);
  const ui = (Views._ui = Views._ui || {});

  const head = h('div', { class: 'page-head' },
    h('div', { class: 'row gap' }, h('a', { class: 'btn ghost', href: '#/persos' }, '←'), h('div', { class: 'cl-badge lg' }, CLASS_ICON[className(p.classe)] || '⚔'),
      h('div', null, h('h1', null, p.nom), h('p', { class: 'muted' }, className(p.classe) + ' · niveau ' + p.niveau + (p.equipe && S().equipes.find((e) => e.id === p.equipe) ? ' · ' + S().equipes.find((e) => e.id === p.equipe).nom : '')))),
    h('div', { class: 'row gap' },
      h('label', { class: 'lbl inline' }, 'Jets', h('select', { class: 'inp', onchange: (e) => { S().prefs.jet = e.target.value; touch(); rerender(); } },
        [['max', 'Parfaits (max)'], ['moy', 'Moyens'], ['min', 'Minimum']].map(([k, n]) => h('option', { value: k, selected: k === jet }, n)))),
      h('button', { class: 'btn', onclick: () => persoForm(p) }, '✎ Modifier'),
      h('button', { class: 'btn danger', onclick: () => confirmBox('Supprimer ' + p.nom + ' et tous ses builds ?', () => { S().persos = S().persos.filter((x) => x !== p); delete S().ocre[p.id]; touch(); go('persos'); }) }, '🗑')));
  main.appendChild(head);

  // onglets de builds
  main.appendChild(h('div', { class: 'build-tabs' },
    p.builds.map((x) => h('button', { class: 'btab' + (x.id === b.id ? ' on' : ''), onclick: () => { p.buildSel = x.id; touch(); rerender(); } }, x.nom, h('small', null, buildCost(x).n + ' obj.'))),
    h('button', { class: 'btab add', onclick: () => promptBox('Nouveau build', 'Nom du build', 'Build ' + (p.builds.length + 1), (n) => { const nb = newBuild(n); p.builds.push(nb); p.buildSel = nb.id; touch(); rerender(); }) }, '＋'),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn ghost sm', onclick: () => promptBox('Renommer le build', 'Nom', b.nom, (n) => { b.nom = n; touch(); rerender(); }) }, '✎ Renommer'),
    h('button', { class: 'btn ghost sm', onclick: () => { const nb = JSON.parse(JSON.stringify(b)); nb.id = uid(); nb.nom = b.nom + ' (copie)'; p.builds.push(nb); p.buildSel = nb.id; touch(); rerender(); } }, '⧉ Dupliquer'),
    h('button', { class: 'btn ghost sm', onclick: () => copyBuildTo(p, b) }, '➜ Copier vers un perso'),
    p.builds.length > 1 ? h('button', { class: 'btn ghost sm', onclick: () => confirmBox('Supprimer le build « ' + b.nom + ' » ?', () => { p.builds = p.builds.filter((x) => x !== b); p.buildSel = p.builds[0].id; touch(); rerender(); }) }, '🗑') : null));

  const TABS = [{ k: 'equip', n: '🎒 Équipement & stats' }, { k: 'gen', n: '✨ Générateur' }, { k: 'degats', n: '💥 Dégâts des sorts' }, { k: 'cmp', n: '⚖️ Comparer' }];
  if (!TABS.some((t) => t.k === ui.tab)) ui.tab = 'equip';
  main.appendChild(tabs(TABS, ui.tab, (k) => { ui.tab = k; rerender(); }));
  if (ui.propFor !== b.id) ui.prop = null;

  if (ui.tab === 'equip') {
    // stats ACTUELLES du perso (rien à voir avec le générateur) + points de caractéristiques
    main.appendChild(h('div', { class: 'ws-eq' },
      h('div', { class: 'c-doll' }, paperDoll(p, b, res)),
      h('div', { class: 'c-stats2' }, statsPanel(p, b, res, null)),
      h('div', { class: 'c-cap' }, capitalPanel(p, b),
        h('details', { class: 'card fold' }, h('summary', null, '🎒 Détail des objets équipés'), equipPanel(p, b, res)))));
    return;
  }
  if (ui.tab === 'cmp') { main.appendChild(comparePanel(p, b, jet)); return; }
  if (ui.tab === 'degats') {
    const T = res.T;
    main.appendChild(h('div', { class: 'ws-dmg' },
      h('div', { class: 'card dmg-head' }, h('div', { class: 'kpis' },
        [['PA', T.pa], ['PM', T.pm], ['PO', T.po], ['Puissance', T.pui], ['Dommages', T['do']], ['% Critique', T.cri + ' %'], ['Dom. critiques', T.dcri], ['PV', fmt(T.pv)]].map(([n, v]) => h('div', { class: 'kpi' }, h('i', null, n), h('b', null, v)))),
        h('p', { class: 'muted sm' }, 'Dégâts calculés avec les stats actuelles de « ' + b.nom + ' » (équipement, points de caractéristiques, parchemins, bonus). Indépendant du générateur.')),
      damagePanel(p, b, res)));
    return;
  }

  // ----- générateur -----
  const prop = ui.prop || null;
  const propRes = prop ? computeBuild(exoPseudo(p), { items: prop.items }, jet) : null;
  const parts = generatorPanel(p, b, res);
  const genCard = h('div', { class: 'card gen-one' }, h('h3', null, '✨ Générateur'),
    h('div', { class: 'gl-t' }, 'Que veux-tu optimiser ?'), parts.objective,
    parts.combat,
    parts.exBox,
    h('details', { class: 'bonus' }, h('summary', null, 'Restrictions (emplacements, armes, Dofus…)'), parts.restr),
    parts.bar);
  const colL = h('div', { class: 'c-doll' }, paperDoll(p, b, res));
  const colM = h('div', { class: 'c-stats' }, genStatsPanel(p, b, res, propRes));
  const colR = h('div', { class: 'c-gen' }, genCard, prop ? proposalPanel(p, b, res, prop, propRes) : null);
  main.appendChild(h('div', { class: 'ws3' }, colL, colM, colR));
};

function copyBuildTo(p, b) {
  const others = S().persos.filter((x) => x !== p);
  if (!others.length) { toast('Aucun autre personnage', 'warn'); return; }
  const sel = h('select', { class: 'inp' }, others.map((x) => h('option', { value: x.id }, x.nom + ' (' + className(x.classe) + ')')));
  const m = modal('Copier le build', h('div', null, h('label', { class: 'lbl' }, 'Vers quel personnage ?'), sel,
    h('div', { class: 'row end gap', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'),
      h('button', { class: 'btn primary', onclick: () => { const t = getPerso(sel.value); const nb = JSON.parse(JSON.stringify(b)); nb.id = uid(); nb.px = {}; t.builds.push(nb); m.close(); toast('Build copié (prix remis à zéro)'); touch(); } }, 'Copier'))), { cls: 'small' });
}

/* ----- panneau d'équipement ----- */
function equipPanel(p, b, res) {
  const card = h('div', { class: 'card equip' }, h('h3', null, 'Équipement'));
  const setNames = {};
  res.sets.forEach((s) => { setNames[s.set.id] = s; });
  SLOT_DEFS.forEach((d) => {
    const id = b.items[d.k]; const it = id && IB.get(id);
    const row = h('div', { class: 'slot' + (it ? ' full' : ''), onclick: () => itemPicker(d.k, id, (nit) => equip(p, b, d.k, nit), { maxLevel: Math.max(200, p.niveau) }) });
    row.appendChild(h('div', { class: 'slot-ic' }, it ? itemImg(it) : h('span', null, d.ic)));
    if (it) {
      const px = (b.px[d.k] = b.px[d.k] || {});
      const bad = res.viol.includes(d.k);
      row.appendChild(h('div', { class: 'slot-body' }, itemSummary(it), bad ? h('div', { class: 'condbad', title: it.c }, '⚠ Condition non remplie : ' + it.c) : null, effChips(it, 5)));
      row.appendChild(h('div', { class: 'slot-act', onclick: (e) => e.stopPropagation() },
        h('button', { class: 'btn ghost xs' + (b.lock.includes(d.k) ? ' on' : ''), title: 'Verrouiller pour le générateur', onclick: () => { b.lock = b.lock.includes(d.k) ? b.lock.filter((x) => x !== d.k) : [...b.lock, d.k]; touch(); rerender(); } }, b.lock.includes(d.k) ? '🔒' : '🔓'),
        h('button', { class: 'btn ghost xs', title: 'Retirer', onclick: () => unequip(b, d.k) }, '✕')));
    } else row.appendChild(h('div', { class: 'slot-body muted' }, d.n));
    card.appendChild(row);
  });
  if (res.sets.some((s) => s.n >= 2)) {
    card.appendChild(h('h4', null, 'Panoplies actives'));
    res.sets.filter((s) => s.n >= 2).forEach((s) => card.appendChild(h('div', { class: 'setrow' }, h('b', null, s.set.n), h('span', { class: 'tag gold' }, s.n + '/' + s.set.i.length))));
  }
  return card;
}
/* objets déjà achetés qui vont disparaître du build : on propose de les revendre (avec un prix de vente) */
function replacedOf(b, newItems) {
  const out = [];
  Object.entries(b.items || {}).forEach(([slot, id]) => { if (newItems[slot] !== id) { const px = (b.px || {})[slot]; if (px && px.bought) out.push({ slot, id, px: { ...px } }); } });
  return out;
}
function offerResale(olds) {
  const list = (olds || []).filter((o) => o.px && o.px.bought && IB.get(o.id));
  if (!list.length) return;
  const rows = list.map((o) => {
    const it = IB.get(o.id);
    const inp = h('input', { class: 'inp sm', value: kfmt(o.px.mkt || S().marche[o.id] || 0), placeholder: 'Prix de vente' });
    const chk = h('input', { type: 'checkbox', checked: true });
    return { o, it, inp, chk, row: h('div', { class: 'rs-row' }, h('label', { class: 'chk' }, chk, h('span', { class: 'ilab' }, itemImg(it), it.n)), h('small', { class: 'muted' }, 'payé ' + kam(o.px.paid || 0)), inp) };
  });
  const m = modal('Revendre ce que tu remplaces ?', h('div', null,
    h('p', { class: 'muted' }, 'Tu avais acheté ' + (list.length > 1 ? 'ces objets' : 'cet objet') + '. Indique le prix de vente voulu : ' + (list.length > 1 ? 'ils seront ajoutés' : 'il sera ajouté') + ' aux reventes de la Compta.'),
    rows.map((r) => r.row),
    h('div', { class: 'row end gap', style: { marginTop: '14px' } },
      h('button', { class: 'btn', onclick: () => m.close() }, 'Non, je le garde'),
      h('button', { class: 'btn primary', onclick: () => {
        const CP = S().compta; CP.reventes = CP.reventes || [];
        rows.forEach((r) => { if (r.chk.checked) CP.reventes.push({ id: 'r' + uid(), n: r.it.n, item: r.it.i, paid: r.o.px.paid || 0, vente: parseKamas(r.inp.value), vendu: false }); });
        touch(); m.close(); toast('Ajouté aux reventes (page Compta)'); } }, 'Ajouter aux reventes'))), { cls: 'small' });
}
function unequip(b, slot) { const olds = replacedOf(b, { ...b.items, [slot]: null }); delete b.items[slot]; delete b.px[slot]; touch(); rerender(); offerResale(olds); }
function equip(p, b, slot, it) {
  const dup = Object.entries(b.items).find(([k, v]) => v === it.i && k !== slot);
  if (dup) { toast('Cet objet est déjà équipé dans ce build', 'warn'); return; }
  if (it.l > p.niveau) toast('Attention : objet de niveau ' + it.l + ' > niveau du perso', 'warn');
  const olds = replacedOf(b, { ...b.items, [slot]: it.i });
  b.items[slot] = it.i;
  b.px[slot] = { mkt: S().marche[it.i] || 0, paid: 0, bought: false };
  setTimeout(() => offerResale(olds), 50);
  touch();
  const bad = computeBuild(p, b).viol.map((s) => IB.get(b.items[s]).n);
  if (bad.length) toast('⚠ Condition non remplie : ' + bad.join(', '), 'warn');
  rerender();
}

/* ----- stats ----- */
function statsPanel(p, b, res, propRes) {
  const T = res.T; const dl = (k) => { if (!propRes) return null; const d = Math.round(((propRes.T[k] || 0) - (T[k] || 0)) * 10) / 10; return d ? h('em', { class: 'gd ' + (d > 0 ? 'up' : 'dn') }, ' → ' + Math.round((propRes.T[k] || 0) * 10) / 10) : null; }; const card = h('div', { class: 'card stats' }, h('h3', null, 'Caractéristiques'));
  card.appendChild(h('div', { class: 'hero-stats' },
    h('div', { class: 'hs pv' }, h('i', null, 'PV'), fmt(T.pv), dl('pv')),
    h('div', { class: 'hs' }, h('i', null, 'PA'), T.pa, dl('pa')), h('div', { class: 'hs' }, h('i', null, 'PM'), T.pm, dl('pm')),
    h('div', { class: 'hs' }, h('i', null, 'PO'), T.po, dl('po')), h('div', { class: 'hs' }, h('i', null, 'Crit'), T.cri + '%', dl('cri'))));
  const hide = new Set(['pa', 'pm', 'po', 'cri']);
  Object.keys(GROUPS).forEach((g) => {
    const rows = STAT_DEFS.filter((d) => d[3] === g && !hide.has(d[0]) && (T[d[0]] || (propRes && propRes.T[d[0]]) || g === 'carac'));
    if (!rows.length) return;
    card.appendChild(h('h4', null, GROUPS[g]));
    const t = h('div', { class: 'stat-grid' });
    rows.forEach((d) => {
      const v = T[d[0]]; const pct = d[2].startsWith('%');
      t.appendChild(h('div', { class: 'st' + (v < 0 ? ' neg' : '') }, h('span', null, d[2]), h('b', null, (Math.round(v * 10) / 10) + (pct && d[0].startsWith('rp') && v > 50 ? ' ⚠' : ''), dl(d[0]))));
    });
    card.appendChild(t);
  });
  if (T.autres) card.appendChild(h('div', { class: 'muted sm' }, 'Autres effets ignorés dans le calcul : ' + Object.keys(T.autres).map((k) => LAB[k] || k).join(', ')));
  return card;
}
const CAP_KEYS = [['vit', 'Vitalité', '#e86a8a'], ['sag', 'Sagesse', '#d9c15a'], ['for', 'Force', '#c08a4a'], ['int', 'Intelligence', '#ec6a3c'], ['cha', 'Chance', '#4aa3e8'], ['agi', 'Agilité', '#7ee08a']];
function capMaxFor(p, k) {      // valeur max atteignable pour k avec les points restants
  const c = classOf(p); const tbl = c.cost[k]; const a = (p.alloc || {})[k] || 0;
  const budget = levelCapital(p.niveau) - capitalSpent(p) + capitalCost(tbl, 0, a);
  let v = a; while (capitalCost(tbl, 0, v + 1) <= budget && v < 5000) v++;
  return v;
}
function setAlloc(p, k, v) {
  v = Math.max(0, Math.round(+v || 0)); p.alloc = p.alloc || {};
  if (!p.overCap) v = Math.min(v, capMaxFor(p, k));
  p.alloc[k] = v; touch(); rerender();
}
function capitalPanel(p, b) {
  const c = classOf(p); const spent = capitalSpent(p); const avail = levelCapital(p.niveau); const left = avail - spent;
  const card = h('div', { class: 'card cap' }, h('div', { class: 'row between wrap' }, h('h3', null, 'Points de caractéristiques'),
    h('div', { class: 'row gap' },
      h('label', { class: 'chk', title: 'Autorise à investir plus de points que le niveau n\'en donne (pour tester)' }, h('input', { type: 'checkbox', checked: !!p.overCap, onchange: (e) => { p.overCap = e.target.checked; touch(); rerender(); } }), 'Sans limite'),
      h('button', { class: 'btn ghost sm', onclick: () => { p.alloc = {}; touch(); rerender(); } }, 'Remettre à 0'))));
  card.appendChild(h('div', { class: 'cap-left ' + (left < 0 ? 'neg' : left === 0 ? 'zero' : '') },
    h('div', null, h('i', null, 'Points restants'), h('b', null, left)),
    h('div', { class: 'cap-sub' }, 'Niveau ' + p.niveau + ' → ' + avail + ' points (5 par niveau au-dessus du 1) · ' + spent + ' dépensés')));
  card.appendChild(progress(spent / Math.max(1, avail) * 100));
  const rows = h('div', { class: 'cap-rows' });
  CAP_KEYS.forEach(([k, n, col]) => {
    const tbl = c.cost[k]; const a = (p.alloc || {})[k] || 0; const mx = Math.max(capMaxFor(p, k), a);
    const nextCost = capitalCost(tbl, a, a + 1); const used = capitalCost(tbl, 0, a);
    const par = (p.parchemins || {})[k] || 0; const bon = (p.bonus || {})[k] || 0;
    const stepBtn = (t, d) => h('button', { class: 'cpb', onclick: () => setAlloc(p, k, a + d) }, t);
    const inp = h('input', { class: 'inp xs cp-num', type: 'number', min: 0, value: a, onchange: (e) => setAlloc(p, k, e.target.value) });
    const badge = h('span', { class: 'cp-badge' }, used + ' pts');
    const sl = h('input', { type: 'range', class: 'cp-sl', min: 0, max: mx, value: a, style: { '--ec': col, '--p': (mx ? a / mx * 100 : 0) + '%' },
      oninput: (e) => { const x = +e.target.value; inp.value = x; badge.textContent = capitalCost(tbl, 0, x) + ' pts'; e.target.style.setProperty('--p', (mx ? x / mx * 100 : 0) + '%'); },
      onchange: (e) => setAlloc(p, k, e.target.value) });
    const thr = (tbl && tbl.length ? tbl : [[0, 1]]).map(([th, cc], i, arr) => (i + 1 < arr.length ? th + '–' + (arr[i + 1][0] - 1) : th + '+') + ' : ' + cc + ' pt').join(' · ');
    rows.appendChild(h('div', { class: 'cp-row', style: { '--ec': col } },
      h('div', { class: 'cp-name' }, h('b', null, n), h('small', { title: 'Coût par point selon le palier (' + c.n + ') : ' + thr }, nextCost + ' pt / point')),
      h('div', { class: 'cp-ctl' }, stepBtn('−100', -100), stepBtn('−10', -10), stepBtn('−1', -1), inp, stepBtn('+1', 1), stepBtn('+10', 10), stepBtn('+100', 100),
        h('button', { class: 'cpb max', title: 'Mettre tous les points restants ici', onclick: () => setAlloc(p, k, 99999) }, 'MAX')),
      h('div', { class: 'cp-slide' }, sl, badge),
      h('div', { class: 'cp-par' }, h('span', null, 'Parchemin'),
        h('input', { class: 'inp xs', type: 'number', min: 0, max: 100, value: par, onchange: (e) => { p.parchemins = p.parchemins || {}; p.parchemins[k] = clamp(+e.target.value || 0, 0, 100); touch(); rerender(); } }),
        h('button', { class: 'cpb', title: 'Parchemin à 100', onclick: () => { p.parchemins = p.parchemins || {}; p.parchemins[k] = 100; touch(); rerender(); } }, '100'),
        h('span', { class: 'cp-tot' }, 'Base : ', h('b', null, a + par + bon)))));
  });
  card.appendChild(rows);
  card.appendChild(h('div', { class: 'row gap wrap', style: { marginTop: '10px' } },
    h('button', { class: 'btn sm', onclick: () => { p.parchemins = { for: 100, int: 100, cha: 100, agi: 100, vit: 100, sag: 100 }; touch(); rerender(); } }, 'Parchemins 100 partout'),
    h('button', { class: 'btn sm', onclick: () => { p.parchemins = {}; touch(); rerender(); } }, 'Sans parchemins'),
    ...[['for', 'Tout Force'], ['int', 'Tout Intel'], ['cha', 'Tout Chance'], ['agi', 'Tout Agi']].map(([k, n]) => h('button', { class: 'btn sm', title: 'Répartit les points (10 % en vitalité, le reste ici, coût réel des paliers)', onclick: () => autoAlloc(p, k) }, n))));
  const tt = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Caractéristique'), h('th', null, 'Coût par point selon le nombre de points investis'))));
  const tbd = h('tbody');
  CAP_KEYS.forEach(([k, n]) => { const tbl = c.cost[k] && c.cost[k].length ? c.cost[k] : [[0, 1]]; tbd.appendChild(h('tr', null, h('td', null, n), h('td', null, tbl.map(([th, cc], i, arr) => (i + 1 < arr.length ? th + ' à ' + (arr[i + 1][0] - 1) : 'dès ' + th) + ' → ' + cc + ' pt').join('  ·  ')))); });
  tt.appendChild(tbd);
  card.appendChild(h('details', { class: 'bonus' }, h('summary', null, 'Coûts des paliers pour ' + c.n), tt));
  const bonus = h('details', { class: 'bonus' }, h('summary', null, 'Bonus manuels (buffs, sorts, divers)'),
    h('div', { class: 'cap-grid' }, ['pa', 'pm', 'po', 'pui', 'do', 'cri', 'dcri', 'pro', 'vit'].map((k) => h('label', { class: 'cap-row' }, h('span', null, statLabel(k)),
      h('input', { class: 'inp xs', type: 'number', value: (p.bonus || {})[k] || 0, onchange: (e) => { p.bonus = p.bonus || {}; p.bonus[k] = +e.target.value || 0; touch(); rerender(); } })))));
  card.appendChild(bonus);
  return card;
}
function autoAlloc(p, key) {
  const c = classOf(p); const avail = levelCapital(p.niveau);
  const a = { vit: 0, sag: 0, for: 0, int: 0, cha: 0, agi: 0 };
  // un peu de vitalité (10 %), le reste dans l'élément choisi
  let vv = 0; while (capitalCost(c.cost.vit, 0, vv + 1) <= avail * 0.1) vv++;
  a.vit = vv; let left = avail - capitalCost(c.cost.vit, 0, vv);
  let v = 0;
  while (left > 0) { const cst = capitalCost(c.cost[key], v, v + 1); if (cst > left) break; left -= cst; v++; }
  a[key] = v; p.alloc = a; touch(); rerender();
}

/* ----- dégâts ----- */
function damagePanel(p, b, res) {
  const T = res.T; const c = classOf(p); const cs = p.calc = p.calc || { src: 'arme', melee: true, cible: { rp: [0, 0, 0, 0, 0], rf: [0, 0, 0, 0, 0] } };
  const card = h('div', { class: 'dmg' });
  const weapon = b.items.arme ? IB.get(b.items.arme) : null;
  const rows = [];
  const base = { T, cible: cs.cible, melee: cs.melee };
  if (weapon) {
    const ln = weaponLines(weapon);
    if (ln.length) rows.push({ k: 'arme', n: weapon.n, ic: itemImg(weapon), ap: weapon.ap || 4, po: (weapon.pm || 1) + '-' + (weapon.po || 1),
      rep: damageReport(ln, null, { ...base, type: 'arme', cc: (weapon.cc || 0) + T.cri, cb: weapon.cb || 0 }), mc: weapon.mc || 1 });
  }
  c.sp.forEach((s) => {
    if (!s.d.length) return;
    rows.push({ k: 's' + s.id, n: s.n, ic: spellImg(s.ic), ap: s.ap, po: s.pm + '-' + s.po,
      rep: damageReport(s.d, s.dc && s.dc.length ? s.dc : null, { ...base, type: 'sort', cc: (s.cc || 0) + T.cri, cb: 0 }), mc: s.mc || 99, lv: s.lv });
  });
  card.appendChild(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h3', null, 'Calculateur de dégâts'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cs.melee, onchange: (e) => { cs.melee = e.target.checked; touch(); rerender(); } }), 'Corps à corps')),
    h('details', { class: 'bonus', open: cs.cible.rp.some((x) => x) || cs.cible.rf.some((x) => x) }, h('summary', null, 'Résistances de la cible'),
      h('div', { class: 'tgt' }, ELEM.map((n, i) => h('div', { class: 'tg', style: { '--ec': ELEM_COL[i] } }, h('b', null, n),
        h('input', { class: 'inp xs', type: 'number', title: '% résistance', value: cs.cible.rp[i], onchange: (e) => { cs.cible.rp[i] = +e.target.value || 0; touch(); rerender(); } }), '%',
        h('input', { class: 'inp xs', type: 'number', title: 'résistance fixe', value: cs.cible.rf[i], onchange: (e) => { cs.cible.rf[i] = +e.target.value || 0; touch(); rerender(); } }), 'fixe'))),
      h('div', { class: 'row gap' }, h('button', { class: 'btn sm', onclick: () => { cs.cible = { rp: [20, 20, 20, 20, 20], rf: [25, 25, 25, 25, 25] }; touch(); rerender(); } }, 'Cible moyenne (20 % / 25)'),
        h('button', { class: 'btn sm', onclick: () => { cs.cible = { rp: [0, 0, 0, 0, 0], rf: [0, 0, 0, 0, 0] }; touch(); rerender(); } }, 'Aucune'))),
    h('p', { class: 'muted sm' }, 'Formule : (base × (100 + carac + puissance)/100 + dommages) × (1 + %dommages), puis résistances. Estimation fidèle à la formule classique de Dofus ; les effets spéciaux d\'un sort (états, bonus conditionnels) ne sont pas modélisés.')));
  if (!rows.length) { card.appendChild(h('div', { class: 'card muted' }, 'Aucun sort ou arme offensif à calculer. Équipe une arme.')); return card; }
  rows.sort((a, b2) => (b2.rep.moy / b2.ap) - (a.rep.moy / a.ap));
  const sel = rows.find((r) => r.k === cs.src) || rows[0];
  const det = h('div', { class: 'card' }, h('h3', null, sel.n), h('div', { class: 'muted sm' }, `${sel.ap} PA · portée ${sel.po}`));
  const dt = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Ligne'), h('th', null, 'Normal'), h('th', null, 'Critique'))));
  const tb = h('tbody');
  sel.rep.det.forEach((d) => tb.appendChild(h('tr', null,
    h('td', null, h('span', { class: 'ed', style: { background: ELEM_COL[d.el] } }), ELEM[d.el] + (d.steal ? ' (vol de vie)' : '')),
    h('td', null, `${fmt(d.n[0])} – ${fmt(d.n[2])}`, h('small', null, ' moy ' + fmt(d.n[1]))),
    h('td', null, `${fmt(d.c[0])} – ${fmt(d.c[2])}`, h('small', null, ' moy ' + fmt(d.c[1]))))));
  tb.appendChild(h('tr', { class: 'tot' }, h('td', null, 'Total'), h('td', null, `${fmt(sel.rep.n[0])} – ${fmt(sel.rep.n[2])}`), h('td', null, `${fmt(sel.rep.c[0])} – ${fmt(sel.rep.c[2])}`)));
  dt.appendChild(tb); det.appendChild(dt);
  const casts = Math.max(1, Math.min(sel.mc, Math.floor(T.pa / sel.ap)));
  det.appendChild(h('div', { class: 'kpis' },
    h('div', { class: 'kpi' }, h('i', null, 'Moyenne / lancer'), h('b', null, fmt(sel.rep.moy))),
    h('div', { class: 'kpi' }, h('i', null, 'Chance de crit'), h('b', null, Math.round(sel.rep.pc * 100) + '%')),
    h('div', { class: 'kpi' }, h('i', null, 'Lancers / tour'), h('b', null, casts)),
    h('div', { class: 'kpi hot' }, h('i', null, 'Dégâts / tour'), h('b', null, fmt(sel.rep.moy * casts)))));
  const tbl = h('table', { class: 'tbl hover' }, h('thead', null, h('tr', null, ['Sort', 'PA', 'Moy.', 'Crit moy.', 'Moy/PA', 'Lancers', 'Dégâts / tour'].map((x) => h('th', null, x)))));
  const tb2 = h('tbody');
  const castsOf = (r) => Math.max(1, Math.min(r.mc, Math.floor(T.pa / r.ap)));
  const maxTour = Math.max(1, ...rows.map((r) => r.rep.moy * castsOf(r)));
  rows.forEach((r) => { const ca = castsOf(r); const tour = r.rep.moy * ca;
    tb2.appendChild(h('tr', { class: r === sel ? 'sel' : '', onclick: () => { cs.src = r.k; touch(); rerender(); } },
    h('td', null, h('span', { class: 'ilab' }, r.ic, r.n)), h('td', null, r.ap), h('td', null, fmt(r.rep.n[1])), h('td', null, fmt(r.rep.c[1])), h('td', null, h('b', null, fmt(r.rep.moy / r.ap))),
    h('td', null, '×' + ca), h('td', { class: 'dbar-c' }, h('div', { class: 'dbar' }, h('i', { style: { width: (tour / maxTour * 100) + '%' } }), h('span', null, fmt(tour)))))); });
  tbl.appendChild(tb2);
  card.appendChild(h('div', { class: 'card' }, h('h3', null, 'Dégâts de chaque sort'), h('p', { class: 'muted sm' }, 'Clique sur un sort pour voir le détail ligne par ligne.'), tbl));
  card.appendChild(det);
  return card;
}

/* ----- générateur ----- */
function blockItem(p, id, regen) {
  const g = ensureGen(p); g.excl = g.excl || [];
  if (!g.excl.includes(id)) g.excl.push(id);
  touch(); toast('🚫 ' + ((IB.get(id) || {}).n || 'Objet') + ' bloqué' + (regen ? ' — nouvelle recherche…' : ''));
  rerender();
  if (regen) setTimeout(() => { const bt = document.querySelector('.gen-bar .btn.primary'); if (bt) bt.click(); }, 120);
}
function exoPseudo(p) {
  const e = (p.gen && p.gen.exo) || {}; const bn = Object.assign({}, p.bonus);
  ['pa', 'pm', 'po'].forEach((k) => { if (e[k]) bn[k] = (bn[k] || 0) + 1; });
  return Object.assign({}, p, { bonus: bn });
}
function ensureGen(p) {
  return (p.gen = p.gen || { profil: Object.keys(PROFILS)[0], w: { ...PROFILS[Object.keys(PROFILS)[0]] }, mins: { pa: 11, pm: 5, po: 0 }, noDofus: false, obt: true });
}
function sliderRow(label, min, max, val, fmtV, onv) {
  const badge = h('span', { class: 'sbadge' }, fmtV(val));
  return h('div', { class: 'srow' }, h('span', { class: 'sl' }, label),
    h('input', { type: 'range', min, max, value: val, oninput: (e) => { badge.textContent = fmtV(+e.target.value); onv(+e.target.value); } }), badge);
}
function generatorPanel(p, b, res) {
  const g = ensureGen(p);
  g.cond = g.cond || {}; if (g.mins && !g._mig) { ['pa', 'pm', 'po'].forEach((k) => { if (g.mins[k] && !g.cond[k]) g.cond[k] = { op: '>=', v: g.mins[k] }; }); g._mig = 1; }
  Object.assign(g, { mode: g.mode || 'sorts', crit: g.crit || [], tours: g.tours || 3, defense: g.defense == null ? 0 : g.defense, skip: g.skip || [], wt: g.wt || null, excl: g.excl || [] });
  const spl = spellList(p, b.items);
  const out = h('div', { class: 'gen-out' });
  const nCond = Object.values(g.cond).filter((c) => c && c.v != null && c.v !== '').length;
  const btn = h('button', { class: 'btn primary big', onclick: () => {
    btn.disabled = true; btn.textContent = 'Recherche en cours…';
    setTimeout(() => {
      const t0 = performance.now();
      const cs = (p.calc = p.calc || { src: 'arme', melee: true, cible: { rp: [0, 0, 0, 0, 0], rf: [0, 0, 0, 0, 0] } });
      const o = { w: g.w, mins: {}, conds: g.cond, locked: new Set(b.lock), noDofus: g.noDofus, obtainable: g.obt !== false, maxLevel: p.niveau, jet: S().prefs.jet, tries: 16,
        skip: new Set(g.skip), excl: new Set(g.excl), weaponTypes: g.wt ? new Set(g.wt) : null, exo: g.exo };
      if (g.mode === 'sorts' && g.crit.length) {
        const cfg = { tours: g.tours, defense: g.defense, cible: cs.cible, melee: g.melee !== false };
        const obj = makeObjective(p, g.crit, cfg); obj.calibrate(res.T, b.items);
        o.objective = obj; o.w = obj.aux; o.tries = 10;
      }
      const r = optimizeBuild(p, b.items, o);
      if (o.objective) { const T2 = computeBuild(p, { items: r.items }, S().prefs.jet).T; r.dmgAfter = o.objective.damage(T2, r.items); r.dmgBefore = o.objective.damage(res.T, b.items); }
      btn.disabled = false; btn.textContent = '✨ Générer le build';
      r.ms = Math.round(performance.now() - t0); const ui2 = (Views._ui = Views._ui || {}); ui2.prop = r; ui2.propFor = b.id; rerender(); setTimeout(() => { const el = document.querySelector('.proposal'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }, 30);
  } }, '✨ Générer le build');
  const summary = g.mode === 'sorts' ? (g.crit.length ? g.crit.length + ' sort(s)' : 'aucun sort choisi') : 'profil ' + g.profil;
  const bar = h('div', { class: 'gen-bar' }, h('div', null, h('b', null, 'Générateur'), h('div', { class: 'muted sm' }, summary + ' · ' + nCond + ' condition(s)')), btn);

  // 1. objectif
  const s1 = [];
  s1.push(h('div', { class: 'seg' }, [['sorts', '🎯 Dégâts de sorts'], ['poids', '⚖ Poids de stats']].map(([k, n]) => h('button', { class: g.mode === k ? 'on' : '', onclick: () => { g.mode = k; touch(); rerender(); } }, n))));
  if (g.mode === 'sorts') {
    s1.push(h('p', { class: 'muted sm' }, 'Clique sur les sorts de ton combo. Le + / − règle le nombre de lancers sur la durée du combat.'));
    const lst = h('div', { class: 'spchips' });
    Object.keys(spl).filter((k) => spl[k]).forEach((k) => {
      const s = spl[k]; const c = g.crit.find((x) => x.k === k);
      lst.appendChild(h('div', { class: 'spchip' + (c ? ' on' : ''), onclick: () => { if (c) g.crit = g.crit.filter((x) => x.k !== k); else g.crit.push({ k, n: 1 }); touch(); rerender(); } },
        s.ic ? spellImg(s.ic) : h('span', { class: 'ico' }, '⚔'),
        h('span', { class: 'nm' }, s.n), h('small', null, s.ap + ' PA'),
        c ? h('span', { class: 'step', onclick: (e) => e.stopPropagation() },
          h('button', { onclick: () => { c.n = Math.max(1, c.n - 1); touch(); rerender(); } }, '−'), h('b', null, '×' + c.n), h('button', { onclick: () => { c.n = Math.min(20, c.n + 1); touch(); rerender(); } }, '+')) : null));
    });
    s1.push(lst);
  } else {
    s1.push(h('label', { class: 'lbl' }, 'Profil de départ'));
    s1.push(h('select', { class: 'inp', onchange: (e) => { g.profil = e.target.value; g.w = { ...PROFILS[g.profil] }; touch(); rerender(); } }, Object.keys(PROFILS).map((k) => h('option', { value: k, selected: k === g.profil }, k))));
    s1.push(h('details', { class: 'bonus' }, h('summary', null, 'Ajuster les poids des stats'),
      h('div', { class: 'cap-grid' }, STAT_DEFS.filter((d) => ['carac', 'prim', 'sec', 'dom', 'res', 'tac'].includes(d[3]) && d[0] !== 'pod').map((d) => h('label', { class: 'cap-row' }, h('span', null, d[2]),
        h('input', { class: 'inp xs', type: 'number', step: 0.1, value: g.w[d[0]] || 0, onchange: (e) => { const v = parseFloat(e.target.value); if (v) g.w[d[0]] = v; else delete g.w[d[0]]; touch(); } }))))));
  }
  const objective = h('div', { class: 'gobj' }, ...s1);

  // 2. combat
  const combat = h('div', { class: 'gcombat' });
  g.exo = g.exo || {};
  combat.appendChild(h('div', { class: 'srow' }, h('span', { class: 'sl' }, 'Position'),
    h('div', { class: 'seg' }, [[true, 'Mêlée'], [false, 'Distance']].map(([k, n]) => h('button', { class: (g.melee !== false) === k ? 'on' : '', onclick: () => { g.melee = k; touch(); rerender(); } }, n))), h('span')));
  combat.appendChild(h('div', { class: 'srow' }, h('span', { class: 'sl' }, 'Exos'),
    h('div', { class: 'tgl' }, [['pa', '+1 PA'], ['pm', '+1 PM'], ['po', '+1 PO']].map(([k, n]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!g.exo[k], onchange: (e) => { g.exo[k] = e.target.checked; touch(); rerender(); } }), n))), h('span')));
  if (g.mode === 'sorts') {
    combat.appendChild(sliderRow('Durée', 1, 10, g.tours, (x) => x + (x > 1 ? ' tours' : ' tour'), (x) => { g.tours = x; touch(); }));
    combat.appendChild(sliderRow('Défense auto', 0, 100, Math.round(g.defense * 100), (x) => x + ' %', (x) => { g.defense = x / 100; touch(); }));
    let sc = 0;
    if (g.crit.length) { const cs0 = p.calc || { melee: true, cible: { rp: [0, 0, 0, 0, 0], rf: [0, 0, 0, 0, 0] } }; const ob = makeObjective(p, g.crit, { tours: g.tours, defense: 0, cible: cs0.cible, melee: g.melee !== false }); sc = Math.round(ob.damage(res.T, b.items)); }
    combat.appendChild(h('div', { class: 'srow' }, h('span', { class: 'sl' }, 'Score'), h('div', { class: 'sbadge wide' }, g.crit.length ? fmt(sc) + ' dégâts (build actuel)' : 'Aucun critère sélectionné'), h('span')));
  }

  // 3. restrictions
  const toggles = h('div', { class: 'tgl' },
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: g.noDofus, onchange: (e) => { g.noDofus = e.target.checked; touch(); } }), 'Sans Dofus / Trophées'),
    h('label', { class: 'chk', title: 'Écarte les objets de test, de MJ ou impossibles à obtenir' }, h('input', { type: 'checkbox', checked: g.obt !== false, onchange: (e) => { g.obt = e.target.checked; touch(); } }), 'Objets obtenables uniquement'));
  const fl = h('details', { class: 'bonus' }, h('summary', null, 'Emplacements et types d\'armes'));
  fl.appendChild(h('div', { class: 'sub' }, 'Emplacements à ne pas remplir'));
  fl.appendChild(h('div', { class: 'tgl' }, SLOT_DEFS.map((d) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: g.skip.includes(d.k), onchange: (e) => { g.skip = e.target.checked ? [...g.skip, d.k] : g.skip.filter((x) => x !== d.k); touch(); } }), d.n))));
  const wts = [...new Set(POOL.arme.map((it) => it.t))];
  fl.appendChild(h('div', { class: 'sub' }, 'Types d\'armes autorisés'));
  fl.appendChild(h('div', { class: 'tgl' }, wts.map((t) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !g.wt || g.wt.includes(t), onchange: (e) => { const cur = g.wt || wts.slice(); g.wt = e.target.checked ? [...new Set([...cur, t])] : cur.filter((x) => x !== t); touch(); } }), (TYPES[t] && TYPES[t].n) || t))));
  const exBox = h('div', { class: 'exbox' }, h('div', { class: 'sub' }, '🚫 Objets bloqués (jamais proposés)'));
  const exl = h('div', { class: 'row gap wrap' });
  const drawEx = () => { clear(exl); g.excl.forEach((id) => { const it = IB.get(id); if (it) exl.appendChild(h('span', { class: 'chip', style: { cursor: 'pointer' }, title: 'Retirer', onclick: () => { g.excl = g.excl.filter((x) => x !== id); touch(); drawEx(); } }, it.n + ' ✕')); }); };
  drawEx(); exBox.appendChild(exl);
  exBox.appendChild(searchSelect('Exclure un objet (2 lettres min.)…', (q) => D_ITEMS.filter((it) => norm(it.n).includes(q)), (it) => { if (!g.excl.includes(it.i)) g.excl.push(it.i); touch(); drawEx(); }, (it) => itemLabel(it)));
  const restr = h('div', { class: 'grestr' }, toggles, fl);
  return { bar, out, objective, combat, restr, exBox };
}

/* ----- compta (dans le build) ----- */
function comptaPanel(p, b) {
  const c = buildCost(b);
  const card = h('div', { class: 'compta' });
  card.appendChild(h('div', { class: 'kpis' },
    h('div', { class: 'kpi' }, h('i', null, 'Valeur marché'), h('b', null, kam(c.mkt))),
    h('div', { class: 'kpi' }, h('i', null, 'Reste à acheter'), h('b', null, kam(c.toBuy))),
    h('div', { class: 'kpi' }, h('i', null, 'Déjà payé'), h('b', null, kam(c.paid))),
    h('div', { class: 'kpi ' + (c.loss > 0 ? 'bad' : 'good') }, h('i', null, c.loss > 0 ? 'Perte si revente' : 'Gain si revente'), h('b', null, kam(Math.abs(c.loss))))));
  const t = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Objet'), h('th', null, 'Prix marché'), h('th', null, 'Prix payé'), h('th', null, 'Acheté'))));
  const tb = h('tbody');
  SLOT_DEFS.forEach((d) => {
    const id = b.items[d.k]; const it = id && IB.get(id); if (!it) return;
    const px = (b.px[d.k] = b.px[d.k] || { mkt: S().marche[id] || 0, paid: 0, bought: false });
    const inMk = h('input', { class: 'inp sm', value: kfmt(px.mkt), placeholder: '0', onchange: (e) => { px.mkt = parseKamas(e.target.value); if (px.mkt) S().marche[id] = px.mkt; touch(); rerender(); } });
    const inPd = h('input', { class: 'inp sm', value: kfmt(px.paid), placeholder: '0', onchange: (e) => { px.paid = parseKamas(e.target.value); touch(); rerender(); } });
    tb.appendChild(h('tr', null, h('td', null, h('span', { class: 'ilab' }, itemImg(it), it.n)), h('td', null, inMk), h('td', null, inPd),
      h('td', null, h('input', { type: 'checkbox', checked: px.bought, onchange: (e) => { px.bought = e.target.checked; if (px.bought && !px.paid) px.paid = px.mkt; touch(); rerender(); } }))));
  });
  t.appendChild(tb); card.appendChild(t);
  card.appendChild(h('p', { class: 'muted sm' }, 'Astuce : tape « 1,5m » ou « 250k ». « Perte si revente » = ce que tu as payé moins la valeur marché actuelle des objets déjà achetés. Les prix sont en kamas (affichés en k).'));
  return card;
}

/* ---------------- compta globale ---------------- */
Views.compta = (main) => {
  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Compta des stuffs'), h('p', { class: 'muted' }, 'Coût de chaque perso et de ses objets, ce que tu as payé, ce que ça vaut aujourd\'hui, et ce que tu peux revendre.'))));
  if (!S().persos.length) { main.appendChild(h('div', { class: 'card empty' }, 'Crée d\'abord un personnage.')); return; }
  let G = { paid: 0, mkt: 0, toBuy: 0, loss: 0 };
  const t = h('table', { class: 'tbl hover wide stack' }, h('thead', null, h('tr', null, ['Perso', 'Build', 'Objets', 'Valeur marché', 'Reste à acheter', 'Payé', 'Perte / gain revente', ''].map((x) => h('th', null, x)))));
  const tb = h('tbody');
  S().persos.forEach((p) => p.builds.forEach((b) => {
    const c = buildCost(b); G.paid += c.paid; G.mkt += c.mkt; G.toBuy += c.toBuy; G.loss += c.loss;
    tb.appendChild(h('tr', { onclick: () => { const el = document.getElementById('cp-' + p.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
      h('td', null, h('b', null, p.nom), h('small', null, ' ' + className(p.classe))), h('td', null, b.nom), h('td', null, c.n), h('td', null, kam(c.mkt)),
      h('td', null, kam(c.toBuy)), h('td', null, kam(c.paid)), h('td', { class: c.loss > 0 ? 'neg' : 'pos' }, (c.loss > 0 ? '−' : '+') + kam(Math.abs(c.loss))), h('td', null, '›')));
  }));
  tb.appendChild(h('tr', { class: 'tot' }, h('td', null, 'TOTAL'), h('td'), h('td'), h('td', null, kam(G.mkt)), h('td', null, kam(G.toBuy)), h('td', null, kam(G.paid)), h('td', { class: G.loss > 0 ? 'neg' : 'pos' }, (G.loss > 0 ? '−' : '+') + kam(Math.abs(G.loss))), h('td')));
  t.appendChild(tb);
  main.appendChild(h('div', { class: 'card' }, t));
  // ----- revente des derniers objets + bilan -----
  const CP = S().compta; CP.reventes = CP.reventes || [];
  const R = CP.reventes; const num = (x) => +x || 0;
  const rPaid = R.reduce((a, r) => a + num(r.paid), 0);
  const rSold = R.filter((r) => r.vendu).reduce((a, r) => a + num(r.vente), 0);
  const rWait = R.filter((r) => !r.vendu).reduce((a, r) => a + num(r.vente), 0);
  const depense = G.paid + rPaid;
  const valStuffs = G.mkt - G.toBuy;          // valeur marché des objets déjà achetés
  const netActuel = depense - rSold;
  const netFinal = depense - rSold - rWait;
  const bilanTout = rSold + rWait + valStuffs - depense;   // tout revendu : stuffs au prix marché + reventes
  const sgn = (v) => (v >= 0 ? '+' : '−') + kam(Math.abs(v));
  const bil = h('div', { class: 'card bilan' });
  bil.appendChild(h('div', { class: 'row between wrap' }, h('h3', null, '⚖️ Bilan'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: CP.avec, onchange: (e) => { CP.avec = e.target.checked; touch(); rerender(); } }), ' Compter la revente des stuffs au prix marché')));
  const main1 = CP.avec ? bilanTout : -netFinal;
  bil.appendChild(h('div', { class: 'bilbig ' + (main1 >= 0 ? 'pos' : 'neg') }, h('i', null, CP.avec ? 'Si tout est revendu (stuffs au prix marché + objets en trop)' : 'Coût net après revente des objets en trop'), h('b', null, sgn(main1))));
  bil.appendChild(h('div', { class: 'kpis' },
    h('div', { class: 'kpi' }, h('i', null, 'Dépensé (stuffs)'), h('b', null, kam(G.paid))),
    h('div', { class: 'kpi' }, h('i', null, 'Dépensé (objets en trop)'), h('b', null, kam(rPaid))),
    h('div', { class: 'kpi' }, h('i', null, 'Dépensé total'), h('b', null, kam(depense))),
    h('div', { class: 'kpi good' }, h('i', null, 'Revente encaissée'), h('b', null, kam(rSold))),
    h('div', { class: 'kpi' }, h('i', null, 'Revente à encaisser'), h('b', null, kam(rWait))),
    h('div', { class: 'kpi hot' }, h('i', null, 'Coût net actuel'), h('b', null, kam(netActuel))),
    CP.avec ? h('div', { class: 'kpi' }, h('i', null, 'Valeur marché des stuffs achetés'), h('b', null, kam(valStuffs))) : null));
  main.appendChild(bil);

  // ----- objets, perso par perso -----
  S().persos.forEach((p) => {
    const tc = p.builds.reduce((a, b) => { const c = buildCost(b); a.paid += c.paid; a.mkt += c.mkt; a.toBuy += c.toBuy; a.n += c.n; return a; }, { paid: 0, mkt: 0, toBuy: 0, n: 0 });
    const sec = h('section', { class: 'card cp-perso', id: 'cp-' + p.id },
      h('div', { class: 'cp-head' }, classFig(p, 'sm'),
        h('div', { class: 'cp-hinfo' }, h('h3', null, p.nom), h('div', { class: 'muted sm' }, className(p.classe) + ' · niv. ' + p.niveau + ' · ' + tc.n + ' objets'),
          p.builds.length > 1 ? h('div', { class: 'kpis' },
            h('div', { class: 'kpi' }, h('i', null, 'Valeur marché (tous builds)'), h('b', null, kam(tc.mkt))),
            h('div', { class: 'kpi' }, h('i', null, 'Payé (tous builds)'), h('b', null, kam(tc.paid))),
            h('div', { class: 'kpi' }, h('i', null, 'Reste à acheter'), h('b', null, kam(tc.toBuy)))) : null)));
    p.builds.forEach((b) => {
      const c = buildCost(b);
      sec.appendChild(h('details', { class: 'cp-build', open: (p.builds.length === 1 || b.id === curBuild(p).id) ? '' : null },
        h('summary', null, h('b', null, b.nom), h('span', { class: 'muted sm' }, ' · ' + c.n + ' objets · payé ' + kam(c.paid) + ' · valeur ' + kam(c.mkt))),
        comptaPanel(p, b)));
    });
    main.appendChild(sec);
  });

  const rc =h('div', { class: 'card' }, h('div', { class: 'row between wrap' }, h('h3', null, '🏷️ Objets à revendre'), h('span', { class: 'muted sm' }, 'Objets achetés en trop ou en double : saisis le prix de vente pour voir ton bilan.')));
  const rt = h('table', { class: 'tbl stack' }, h('thead', null, h('tr', null, ['Objet', 'Prix payé', 'Prix de vente', 'Gain / perte', 'Vendu', ''].map((x) => h('th', null, x)))));
  const rb = h('tbody');
  R.forEach((r) => {
    const it = r.item && IB.get(r.item); const gl = num(r.vente) - num(r.paid);
    rb.appendChild(h('tr', { class: r.vendu ? 'sold' : '' },
      h('td', null, h('span', { class: 'ilab' }, it ? itemImg(it) : null, r.n)),
      h('td', null, h('input', { class: 'inp sm', value: kfmt(r.paid), placeholder: '0', onchange: (e) => { r.paid = parseKamas(e.target.value); touch(); rerender(); } })),
      h('td', null, h('input', { class: 'inp sm', value: kfmt(r.vente), placeholder: '0', onchange: (e) => { r.vente = parseKamas(e.target.value); touch(); rerender(); } })),
      h('td', { class: gl >= 0 ? 'pos' : 'neg' }, sgn(gl)),
      h('td', null, h('input', { type: 'checkbox', checked: !!r.vendu, onchange: (e) => { r.vendu = e.target.checked; touch(); rerender(); } })),
      h('td', null, h('button', { class: 'x', title: 'Supprimer', onclick: () => { CP.reventes = R.filter((x) => x !== r); touch(); rerender(); } }, '✕'))));
  });
  if (!R.length) rb.appendChild(h('tr', null, h('td', { colspan: 6, class: 'muted' }, 'Aucun objet à revendre pour le moment.')));
  rb.appendChild(h('tr', { class: 'tot' }, h('td', null, 'TOTAL'), h('td', null, kam(rPaid)), h('td', null, kam(rSold + rWait)), h('td', { class: rSold + rWait - rPaid >= 0 ? 'pos' : 'neg' }, sgn(rSold + rWait - rPaid)), h('td'), h('td')));
  rt.appendChild(rb); rc.appendChild(rt);
  const nIn = h('input', { class: 'inp', placeholder: 'Nom de l\'objet (ex : Gelano)' });
  const pIn = h('input', { class: 'inp sm', placeholder: 'Payé (ex 150k)' }); const vIn = h('input', { class: 'inp sm', placeholder: 'Vente (ex 120k)' });
  let _it; const lookup = (name) => { if (!_it) { _it = new Map(); IB.forEach((x) => { const k = norm(x.n); if (!_it.has(k)) _it.set(k, x); }); } return _it.get(norm(name)); };
  rc.appendChild(h('div', { class: 'row gap wrap addrow' }, nIn, pIn, vIn, h('button', { class: 'btn primary', onclick: () => {
    const n = nIn.value.trim(); if (!n) return toast('Donne un nom d\'objet'); const it = lookup(n);
    R.push({ id: 'r' + Date.now(), n: it ? it.n : n, item: it ? it.i : 0, paid: parseKamas(pIn.value), vente: parseKamas(vIn.value), vendu: false }); touch(); rerender(); } }, '+ Ajouter')));
  main.appendChild(rc);
  // carnet de prix
  const prix = Object.entries(S().marche).map(([id, v]) => [IB.get(+id), v]).filter((x) => x[0]).sort((a, b) => b[1] - a[1]);
  main.appendChild(h('div', { class: 'card' }, h('h3', null, 'Carnet de prix (' + prix.length + ')'),
    prix.length ? h('div', { class: 'price-list' }, prix.slice(0, 120).map(([it, v]) => h('div', { class: 'pl' }, itemLabel(it), h('b', null, kam(v))))) : h('p', { class: 'muted' }, 'Les prix que tu saisis (build, craft) sont mémorisés ici.')));
};


/* ----- tableau de stats avec conditions (comme dofgen) ----- */
function condMet(T, k, c) {
  const v = k === 'pv' ? T.pv : (T[k] || 0);
  return c.op === '<=' ? v <= c.v : c.op === '=' ? v === c.v : v >= c.v;
}
function genStatsPanel(p, b, res, propRes, only) {
  const T = res.T; const g = ensureGen(p); g.cond = g.cond || {};
  const card = h('div', { class: 'card stats gstats' + (propRes ? ' hasprop' : '') }, h('div', { class: 'row between' }, h('h3', null, 'Stats'),
    h('button', { class: 'btn ghost sm', onclick: () => { g.cond = {}; touch(); rerender(); } }, 'Effacer')));
  card.appendChild(h('p', { class: 'muted sm' }, 'Valeur actuelle (→ proposée). Curseur ou case = valeur que le générateur doit atteindre (≥ ≤ =). Vert : remplie, rouge : non remplie.'));
  const base0 = baseStats(p); const rng0 = computeBuild(p, { items: {} }, 'max').T;
  const cache = (genStatsPanel._c = genStatsPanel._c || {});
  const rangeOf = (k) => {
    const lo = Math.round(k === 'pv' ? rng0.pv : (rng0[k] || 0));
    const key = p.niveau + '|' + k; let est = cache[key];
    if (est == null) {
      est = 0;
      SLOT_DEFS.forEach((d) => { let m = 0; (POOL[d.k] || []).forEach((it) => { if (it.l > p.niveau || /\(MJ\)/.test(it.n)) return; (it.e || []).forEach((e) => { if (STAT_BY_ID[e[0]] === k) m = Math.max(m, effVal(e, 'max')); }); }); est += m; });
      cache[key] = est;
    }
    let hi;
    if (k === 'pa') hi = Math.max(lo + 4, 12); else if (k === 'pm') hi = Math.max(lo + 3, 6); else if (k === 'po') hi = lo + 6;
    else if (k === 'pv') hi = lo + Math.round(est * 0.7 + 1500); else hi = lo + Math.max(2, Math.round(est * 0.6));
    return [lo, hi];
  };
  const row = (k, label) => {
    const c = g.cond[k]; const v = k === 'pv' ? T.pv : (T[k] || 0);
    const ok = c && c.v != null && c.v !== '' ? condMet(T, k, c) : null;
    const [lo, hi] = rangeOf(k);
    const opNames = { '>=': '≥', '<=': '≤', '=': '=' };
    const opb = h('button', { class: 'opb', title: 'Changer : ≥ / ≤ / =', onclick: () => { const cur = g.cond[k]; if (!cur) return; cur.op = cur.op === '>=' ? '<=' : cur.op === '<=' ? '=' : '>='; touch(); rerender(); } }, opNames[c ? c.op : '>=']);
    const inp = h('input', { class: 'inp xs', placeholder: '—', value: c && c.v !== '' && c.v != null ? c.v : '', onchange: (e) => {
      const t = e.target.value.trim(); if (t === '' || isNaN(+t)) delete g.cond[k]; else g.cond[k] = { op: (g.cond[k] && g.cond[k].op) || '>=', v: +t };
      touch(); setTimeout(rerender, 0); } });
    const cur = c && c.v !== '' && c.v != null ? clamp(c.v, lo, hi) : lo;
    const pctFill = hi > lo ? ((cur - lo) / (hi - lo)) * 100 : 0;
    const sl = h('input', { type: 'range', class: 'gauge' + (c ? ' on' : ''), min: lo, max: hi, step: 1, value: cur, style: { '--p': (c && c.op === '<=' ? 100 - pctFill : pctFill) + '%', '--dir': c && c.op === '<=' ? 'rtl' : 'ltr' },
      oninput: (e) => { const x = +e.target.value; e.target.style.setProperty('--p', ((x - lo) / Math.max(1, hi - lo) * 100) + '%'); inp.value = x; },
      onchange: (e) => { const x = +e.target.value; if (x <= lo && !(g.cond[k])) { delete g.cond[k]; } else g.cond[k] = { op: (g.cond[k] && g.cond[k].op) || '>=', v: x }; touch(); setTimeout(rerender, 0); } });
    return h('div', { class: 'gst' + (ok === true ? ' ok' : ok === false ? ' ko' : '') }, h('span', { class: 'gl' }, label), h('b', { class: 'gv' }, Math.round(v * 10) / 10, propRes ? (() => { const nv = k === 'pv' ? propRes.T.pv : (propRes.T[k] || 0); const d = Math.round((nv - v) * 10) / 10; return d ? h('em', { class: 'gd ' + (d > 0 ? 'up' : 'dn') }, ' → ' + Math.round(nv * 10) / 10) : null; })() : null), sl, opb, inp);
  };
  const sections = [['pa', 'pm', 'po'], ['pv', 'sag', 'for', 'int', 'cha', 'agi'], ['pui', 'cri', 'ini', 'soin', 'pro', 'pod'], ['tac', 'fui', 'retpa', 'retpm', 'esqpa', 'esqpm'],
    ['do', 'dneu', 'dter', 'dfeu', 'deau', 'dair', 'dcri', 'dpou', 'dsort', 'dmel', 'ddist', 'darm'], ['rfneu', 'rfter', 'rffeu', 'rfair', 'rfeau', 'rcri', 'rpou', 'rpneu', 'rpter', 'rpfeu', 'rpeau', 'rpair', 'rdist', 'rmel']];
  const known = new Set(STAT_DEFS.map((d) => d[0])); known.add('pv');
  const lab = (k) => k === 'pv' ? 'Points de vie' : statLabel(k);
  const TITLES = ['Points d\'action', 'Caractéristiques', 'Secondaires', 'Tacle & esquive', 'Dommages', 'Résistances']; let secIdx = 0;
  (only ? [only] : sections).forEach((sec) => {
    const keys = sec.filter((k) => known.has(k)); if (!keys.length) return;
    if (!only) card.appendChild(h('div', { class: 'gst-title' }, TITLES[secIdx++] || ''));
    card.appendChild(h('div', { class: 'gst-grid' }, keys.map((k) => row(k, lab(k)))));
  });
  return card;
}


/* ----- poupée d'équipement (comme dofgen) ----- */
function paperDoll(p, b, res, po) {
  const items = po ? po.items : b.items;
  const slotEl = (k) => {
    const d = SLOT_DEFS.find((x) => x.k === k); const id = items[k]; const it = id && IB.get(id);
    if (po) {
      const cur = b.items[k]; const chg = id && id !== cur; const same = id && id === cur;
      const e2 = h('div', { 'data-iid': id || null, class: 'ds' + (it ? ' full' : '') + (chg ? ' chg' : '') + (same ? ' same' : ''), title: it ? it.n + (chg ? ' (cliquer pour équiper seulement celui-ci)' : ' (déjà équipé)') : d.n,
        onclick: () => { if (chg) { equip(p, b, k, it); } } }, it ? itemImg(it, 'big') : h('span', { class: 'dph' }, d.ic));
      if (chg) e2.appendChild(h('span', { class: 'dsb' }, '↺')); e2.appendChild(h('small', { class: 'dsn' }, d.n)); return e2;
    }
    const bad = res.viol.includes(k); const locked = b.lock.includes(k); const skip = ((p.gen && p.gen.skip) || []).includes(k);
    const el = h('div', { 'data-iid': id || null, class: 'ds' + (it ? ' full' : '') + (bad ? ' bad' : '') + (locked ? ' lock' : '') + (skip ? ' skip' : ''), title: it ? it.n + (bad ? ' — condition non remplie : ' + it.c : '') : d.n,
      onclick: () => itemPicker(k, id, (nit) => equip(p, b, k, nit), { maxLevel: Math.max(200, p.niveau) }) },
      it ? itemImg(it, 'big') : h('span', { class: 'dph' }, d.ic));
    if (it) el.appendChild(h('div', { class: 'dsa', onclick: (e) => e.stopPropagation() },
      h('button', { title: 'Verrouiller pour le générateur', onclick: () => { b.lock = locked ? b.lock.filter((x) => x !== k) : [...b.lock, k]; touch(); rerender(); } }, locked ? '🔒' : '🔓'),
      h('button', { title: 'Ne jamais proposer cet objet', onclick: () => blockItem(p, id) }, '🚫'),
      h('button', { title: 'Retirer', onclick: () => unequip(b, k) },'✕')));
    el.appendChild(h('small', { class: 'dsn' }, d.n));
    return el;
  };
  const left = ['chapeau', 'amulette', 'anneau1', 'ceinture', 'bottes'], right = ['cape', 'arme', 'bouclier', 'anneau2', 'familier'];
  const cls = className(p.classe);
  const card = h('div', { class: 'card doll' + (po ? ' doll-prop' : '') },
    h('div', { class: 'doll-head' }, h('b', null, po ? '✨ Proposition du générateur' : 'Équipé · ' + cls), h('span', { class: 'muted' }, po ? '' : 'niv. ' + p.niveau)),
    h('div', { class: 'doll-grid' },
      h('div', { class: 'dcol' }, left.map(slotEl)),
      h('div', { class: 'dfig' },
        h('div', { class: 'fig-glow' }),
        h('div', { class: 'fig-wrap' }, h('div', { class: 'fig-crop' + (p.sexe === 'm' ? ' m' : ''), title: 'Clique pour changer ♂/♀', onclick: () => { if (po) return; p.sexe = p.sexe === 'm' ? 'f' : 'm'; touch(); rerender(); } },
          h('img', { class: 'fig-img', alt: cls, referrerpolicy: 'no-referrer', src: 'img/cls/' + p.classe + '.webp',
            onerror: (e) => { const im = e.target; if (!im._f1) { im._f1 = 1; if (window.CLASS_IMG && CLASS_IMG[p.classe]) { im.src = CLASS_IMG[p.classe]; return; } } if (!im._f2) { im._f2 = 1; im.src = 'https://static.ankama.com/dofus/ng/modules/mmorpg/encyclopedia/unity/breeds/assets/breeds/sprite' + p.classe + '.png'; return; } const d = h('div', { class: 'fig-emblem' }, CLASS_ICON[cls] || '⚔'); im.closest('.fig-crop').replaceWith(d); } }))),
        po ? null : h('button', { class: 'btn ghost sm fig-sex', onclick: () => { p.sexe = p.sexe === 'm' ? 'f' : 'm'; touch(); rerender(); } }, p.sexe === 'm' ? '♂ Masculin' : '♀ Féminin'),
        h('div', { class: 'fig-name' }, p.nom),
        h('div', { class: 'fig-base' }),
        h('div', { class: 'fig-pa' }, h('span', null, h('i', null, 'PA'), res.T.pa), h('span', null, h('i', null, 'PM'), res.T.pm), h('span', null, h('i', null, 'PO'), res.T.po), h('span', null, h('i', null, 'PV'), fmt(res.T.pv)))),
      h('div', { class: 'dcol' }, right.map(slotEl))),
    h('div', { class: 'drow' }, ['dofus1', 'dofus2', 'dofus3', 'dofus4', 'dofus5', 'dofus6'].map(slotEl)),
    res.sets.some((s) => s.n >= 2) ? h('div', { class: 'dsets' }, res.sets.filter((s) => s.n >= 2).map((s) => h('span', { class: 'tag gold' }, s.set.n + ' ' + s.n + '/' + s.set.i.length))) : null);
  return card;
}


/* ----- proposition du générateur, comparée à l'équipé ----- */
function proposalPanel(p, b, res, prop, propRes) {
  const card = h('div', { class: 'proposal card' }, h('h3', null, '✨ Proposition'));
  const ch = SLOT_DEFS.filter((d) => prop.items[d.k] && prop.items[d.k] !== b.items[d.k]);
  const kp = [];
  if (prop.dmgAfter != null) kp.push(h('div', { class: 'kpi' }, h('i', null, 'Combo actuel'), h('b', null, fmt(prop.dmgBefore))), h('div', { class: 'kpi hot' }, h('i', null, 'Combo proposé'), h('b', null, fmt(prop.dmgAfter) + (prop.dmgBefore ? ' (' + (prop.dmgAfter >= prop.dmgBefore ? '+' : '') + Math.round((prop.dmgAfter / prop.dmgBefore - 1) * 100) + '%)' : ''))));
  [['pa', 'PA'], ['pm', 'PM'], ['po', 'PO'], ['pv', 'PV']].forEach(([k, n]) => { const x = res.T[k] || 0, y = propRes.T[k] || 0; kp.push(h('div', { class: 'kpi' }, h('i', null, n), h('b', null, Math.round(x) + ' → ', h('span', { class: y > x ? 'up' : y < x ? 'dn' : '' }, Math.round(y))))); });
  card.appendChild(h('div', { class: 'kpis', style: { margin: '8px 0' } }, kp));
  if (propRes.viol && propRes.viol.length) card.appendChild(h('div', { class: 'warnbox' }, 'Conditions d\'objet non remplies : ' + propRes.viol.map((s) => IB.get(prop.items[s]).n).join(', ')));
  const miss = [];
  Object.entries(p.gen.cond || {}).forEach(([k, c]) => { if (!c || c.v == null || c.v === '') return; if (!condMet(propRes.T, k, c)) miss.push(statLabel(k) + ' ' + c.op + ' ' + c.v + ' (obtenu ' + Math.round(propRes.T[k] || 0) + ')'); });
  if (miss.length) card.appendChild(h('div', { class: 'warnbox' }, 'Contraintes non atteintes : ' + miss.join(', ') + '. Assouplis-en une.'));
  const dl = [];
  STAT_DEFS.forEach((d) => { if (['pod', 'vit'].includes(d[0])) return; const x = Math.round((res.T[d[0]] || 0) * 10) / 10, y = Math.round((propRes.T[d[0]] || 0) * 10) / 10; if (x === y) return; dl.push({ n: d[2], x, y, dv: Math.round((y - x) * 10) / 10 }); });
  if (dl.length) {
    const gain = dl.filter((r) => r.dv > 0), loss = dl.filter((r) => r.dv < 0);
    const col = (arr, cls) => h('div', { class: 'dcol2 ' + cls }, arr.length ? arr.map((r) => h('div', { class: 'drow2' }, h('span', null, r.n), h('i', null, r.x + ' → ' + r.y), h('b', null, (r.dv > 0 ? '+' : '') + r.dv))) : h('div', { class: 'muted sm' }, 'rien'));
    card.appendChild(h('h4', null, 'Ce que tu gagnes / perds'));
    card.appendChild(h('div', { class: 'gl-grid' }, h('div', null, h('div', { class: 'gl-h up' }, '▲ Gagné'), col(gain, 'up')), h('div', null, h('div', { class: 'gl-h dn' }, '▼ Perdu'), col(loss, 'dn'))));
  }
  card.appendChild(h('h4', null, ch.length ? ch.length + ' objet(s) à changer' : 'Aucun changement : ton stuff est déjà le meilleur trouvé'));
  ch.forEach((d) => {
    const o = b.items[d.k] && IB.get(b.items[d.k]), n = IB.get(prop.items[d.k]);
    card.appendChild(h('div', { class: 'chg-row' }, h('span', { class: 'chg-slot' }, d.n),
      h('span', { class: 'chg-old', 'data-iid': o ? o.i : null }, o ? itemImg(o, 'xs') : '—', h('small', null, o ? o.n : 'vide')), h('span', null, '→'),
      h('span', { class: 'chg-new', 'data-iid': n.i }, itemImg(n, 'xs'), h('b', null, n.n)),
      h('button', { class: 'btn sm', title: 'Ne plus jamais proposer cet objet', onclick: () => blockItem(p, n.i, true) }, '🚫 Bloquer'),
      h('button', { class: 'btn sm', onclick: () => equip(p, b, d.k, n) }, 'Équiper')));
  });
  card.appendChild(h('div', { class: 'row gap wrap', style: { marginTop: '10px' } },
    h('button', { class: 'btn primary', onclick: () => { const olds = replacedOf(b, prop.items); setTimeout(() => offerResale(olds), 50); b.items = { ...prop.items }; b.px = {}; Object.entries(b.items).forEach(([s, id]) => { b.px[s] = { mkt: S().marche[id] || 0, paid: 0, bought: false }; }); Views._ui.prop = null; touch(); rerender(); toast('Build équipé'); } }, 'Tout équiper'),
    h('button', { class: 'btn', onclick: () => { const nb = newBuild('Généré'); nb.items = { ...prop.items }; Object.entries(nb.items).forEach(([s, id]) => { nb.px[s] = { mkt: S().marche[id] || 0, paid: 0, bought: false }; }); p.builds.push(nb); p.buildSel = nb.id; Views._ui.prop = null; touch(); rerender(); } }, 'Garder à part'),
    h('button', { class: 'btn', onclick: () => { Object.values(prop.items).forEach((id) => { if (RBY.has(id)) addToCraft(id, 1); }); toast('Ajouté à l\'atelier de craft'); } }, '🔨 Craft'),
    h('button', { class: 'btn ghost', onclick: () => { Views._ui.prop = null; rerender(); } }, 'Fermer')));
  return card;
}


/* ----- infobulle objet au survol ----- */
(function () {
  let tip = null;
  const lab = (id) => { const k = STAT_BY_ID[id]; return (k && STAT_BY_KEY[k][2]) || LAB[id] || ('Effet ' + id); };
  const rng = (e) => { const mn = e[1], mx = e[2]; return (mx && mx !== mn) ? (mn + ' à ' + mx) : String(mn); };
  function build(it) {
    const box = h('div', { class: 'itip' });
    box.appendChild(h('div', { class: 'itip-h' }, itemImg(it, 'xs'), h('div', null, h('b', null, it.n), h('div', { class: 'muted sm' }, (typeName(it.t) || '') + (it.l ? ' · niv. ' + it.l : '')))));
    if (it.c) box.appendChild(h('div', { class: 'itip-c' }, '⚠ Condition : ' + it.c));
    const ef = h('div', { class: 'itip-e' });
    (it.e || []).forEach((e) => { if (e[1] === 0 && e[2] === 0) return; const neg = Math.min(e[1], e[2] || e[1]) < 0 || e[1] < 0; ef.appendChild(h('div', { class: neg ? 'neg' : '' }, h('b', null, rng(e)), ' ' + lab(e[0]))); });
    box.appendChild(ef);
    const set = it.s && SETS.get(it.s);
    if (set) {
      box.appendChild(h('div', { class: 'itip-s' }, '🧩 ' + set.n + ' (' + set.i.length + ' pièces)'));
      Object.keys(set.e || {}).sort((a, b) => a - b).forEach((n) => { if (+n < 2) return; box.appendChild(h('div', { class: 'itip-sb' }, h('b', null, n + ' : '), (set.e[n] || []).map(([id, val]) => val + ' ' + lab(id)).join(', '))); });
    }
    return box;
  }
  function hide() { if (tip) { tip.remove(); tip = null; } }
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-iid]'); if (!el) { hide(); return; }
    const it = IB.get(+el.dataset.iid); if (!it) return;
    if (tip && tip._for === el) return;
    hide(); tip = build(it); tip._for = el; document.body.appendChild(tip);
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.right + 10; if (x + tw > innerWidth - 8) x = Math.max(8, r.left - tw - 10);
    let y = Math.min(Math.max(8, r.top), innerHeight - th - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('scroll', hide, true);
})();


/* ---------------- comparateur de builds ---------------- */
function comparePanel(p, b, jet) {
  const ui = Views._ui;
  const prop = ui.prop && ui.propFor === b.id ? ui.prop : null;
  const opts = p.builds.map((x) => ({ k: x.id, n: x.nom + (x.id === b.id ? ' (équipé)' : ''), b: x }));
  if (prop) opts.push({ k: 'prop', n: '✨ Proposition du générateur', b: { id: 'prop', nom: 'Proposition', items: prop.items, px: {} } });
  const pick = (key, dflt) => opts.find((o) => o.k === ui[key]) || opts.find((o) => o.k === dflt) || opts[0];
  const A = pick('cmpA', b.id);
  const B = pick('cmpB', prop ? 'prop' : (p.builds.find((x) => x.id !== A.k) || b).id);
  const rA = computeBuild(p, A.b, jet), rB = computeBuild(p, B.b, jet);
  const sel = (key, cur) => h('select', { class: 'inp', onchange: (e) => { ui[key] = e.target.value; rerender(); } }, opts.map((o) => h('option', { value: o.k, selected: o.k === cur.k }, o.n)));
  const card = h('div', { class: 'card cx' },
    h('div', { class: 'cx-head' }, h('div', null, h('i', { class: 'muted sm' }, 'Build A'), sel('cmpA', A)), h('b', { class: 'cx-vs' }, 'VS'), h('div', null, h('i', { class: 'muted sm' }, 'Build B'), sel('cmpB', B)),
      h('button', { class: 'btn ghost sm', title: 'Inverser', onclick: () => { ui.cmpA = B.k; ui.cmpB = A.k; rerender(); } }, '⇄')));
  if (A.k === B.k) card.appendChild(h('p', { class: 'muted' }, 'Choisis deux builds différents. Tu peux dupliquer un build dans l\'onglet Équipement, ou lancer le générateur pour comparer sa proposition à ton stuff.'));
  const dv = (x, y) => { const d = Math.round((y - x) * 10) / 10; return d ? h('b', { class: d > 0 ? 'pos' : 'neg' }, (d > 0 ? '+' : '') + d) : h('span', { class: 'muted' }, '=') };
  const cA = buildCost(A.b), cB = buildCost(B.b);
  const kp = [['pa', 'PA'], ['pm', 'PM'], ['po', 'PO'], ['pv', 'PV']].map(([k, n]) => h('div', { class: 'kpi' }, h('i', null, n), h('b', null, Math.round(rA.T[k] || 0) + ' → ' + Math.round(rB.T[k] || 0)), dv(rA.T[k] || 0, rB.T[k] || 0)));
  kp.push(h('div', { class: 'kpi' }, h('i', null, 'Prix du stuff'), h('b', null, kam(cA.mkt) + ' → ' + kam(cB.mkt)), dv(cA.mkt, cB.mkt)));
  card.appendChild(h('div', { class: 'kpis', style: { margin: '10px 0' } }, kp));
  const grp = { carac: 'Caractéristiques', prim: 'Primaires', sec: 'Secondaires', dom: 'Dommages' };
  const cols = h('div', { class: 'cx-cols' });
  Object.keys(grp).forEach((g) => {
    const rows = STAT_DEFS.filter((d) => d[3] === g && !['pod'].includes(d[0])).map((d) => [d[2], rA.T[d[0]] || 0, rB.T[d[0]] || 0]).filter((r) => r[1] || r[2]);
    if (!rows.length) return;
    cols.appendChild(h('div', null, h('h4', null, grp[g]), rows.map((r) => h('div', { class: 'drow2 cx-r' + (r[1] !== r[2] ? ' chg' : '') }, h('span', null, r[0]), h('i', null, Math.round(r[1] * 10) / 10 + ' → ' + Math.round(r[2] * 10) / 10), dv(r[1], r[2])))));
  });
  card.appendChild(cols);
  const setN = (r) => (r.sets || []).filter((x) => x.n >= 2).map((x) => ((x.set && x.set.n) || 'Panoplie') + ' ×' + x.n);
  const sA = setN(rA), sB = setN(rB);
  if (sA.length || sB.length) card.appendChild(h('p', { class: 'muted sm' }, 'Panoplies A : ' + (sA.join(', ') || '—') + '  ·  B : ' + (sB.join(', ') || '—')));
  card.appendChild(h('h4', null, 'Objets'));
  const grid = h('div', { class: 'cx-items' });
  SLOT_DEFS.forEach((d) => {
    const a = A.b.items[d.k], bb = B.b.items[d.k]; if (!a && !bb) return;
    const cell = (id) => { const it = id && IB.get(id); return h('span', { class: 'cx-it', 'data-iid': it ? it.i : null }, it ? itemImg(it, 'xs') : '—', h('small', null, it ? it.n : 'vide')); };
    grid.appendChild(h('div', { class: 'chg-row' + (a === bb ? ' same' : '') }, h('span', { class: 'chg-slot' }, d.n), cell(a), h('span', null, a === bb ? '=' : '→'), cell(bb)));
  });
  card.appendChild(grid);
  return card;
}
