/* ===== Atelier de craft + Atelier de métiers ===== */
'use strict';

function addToCraft(id, qty) {
  const c = S().craft; const e = c.liste.find((x) => x.id === id);
  if (e) e.qty += qty || 1; else c.liste.push({ id, qty: qty || 1 });
  touch();
}
function bestRecipe(id) { const r = RBY.get(id); return r ? r[0] : null; }

/* développe la liste en ressources de base ; stock consommé au passage */
function expandCraft(list, dev, stock) {
  const base = new Map(), inter = new Map(), tot = new Map(), left = { ...stock };
  const need = (id, qty, depth, chain) => {
    // on consomme d'abord le stock
    const have = left[id] || 0; const use = Math.min(have, qty);
    left[id] = have - use; tot.set(id, (tot.get(id) || 0) + qty); qty -= use;
    if (qty <= 0) { if (!base.has(id) && !inter.has(id)) base.set(id, 0); return; }
    const r = bestRecipe(id);
    if (r && (depth === 0 || (dev && depth < 6 && !chain.includes(id)))) {
      const e = inter.get(id) || { id, q: 0, r }; e.q += qty; inter.set(id, e);
      r.g.forEach(([ing, q]) => need(ing, q * qty, depth + 1, [...chain, id]));
    } else base.set(id, (base.get(id) || 0) + qty);
  };
  list.forEach((x) => need(x.id, x.qty, 0, []));
  return { base, inter, tot };
}

function whereToFind(it) {
  const parts = [];
  const z = HARV.get(it.i);
  if (z && z.length) parts.push('Récolte : ' + z.slice(0, 3).map((s) => s.n).join(', ') + (z.length > 3 ? ' +' + (z.length - 3) : ''));
  const names = (it.d || []).map((m) => (MONDE.mons[m] || {}).n).filter(Boolean);
  if (names.length) parts.push('Drop : ' + [...new Set(names)].slice(0, 3).join(', ') + (names.length > 3 ? '…' : ''));
  else if ((it.d || []).length) parts.push('Drop : ' + it.d.length + ' monstre(s)');
  return parts;
}

Views.craft = (main) => {
  const C = S().craft;
  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Atelier de craft'), h('p', { class: 'muted' }, 'Recettes, ressources nécessaires et liste de courses consolidée.')),
    h('div', { class: 'row gap' },
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: C.dev, onchange: (e) => { C.dev = e.target.checked; touch(); rerender(); } }), 'Développer les sous-recettes'),
      h('button', { class: 'btn', onclick: () => confirmBox('Vider la liste de craft ?', () => { C.liste = []; touch(); rerender(); }) }, 'Vider'))));

  const left = h('div', { class: 'card' }, h('h3', null, 'À fabriquer'));
  left.appendChild(searchSelect('Chercher un objet à crafter…', (q) => ITEMS.filter((i) => RBY.has(i.i) && norm(i.n).includes(q)).sort((a, b) => b.l - a.l),
    (it) => { addToCraft(it.i, 1); rerender(); }, (it) => itemLabel(it, h('small', { class: 'muted' }, (REC.jobs[RBY.get(it.i)[0].j] || {}).n))));
  // depuis un perso / build
  if (S().persos.length) {
    const sel = h('select', { class: 'inp' }, S().persos.flatMap((p) => p.builds.map((b) => h('option', { value: p.id + '|' + b.id }, p.nom + ' — ' + b.nom))));
    left.appendChild(h('div', { class: 'row gap', style: { marginTop: '10px' } }, sel, h('button', { class: 'btn sm', onclick: () => {
      const [pid, bid] = sel.value.split('|'); const b = getPerso(pid).builds.find((x) => x.id === bid); let n = 0;
      Object.values(b.items).forEach((id) => { if (RBY.has(id)) { addToCraft(id, 1); n++; } }); toast(n + ' objet(s) craftable(s) ajouté(s)'); rerender();
    } }, 'Ajouter un build')));
  }
  const ul = h('div', { class: 'craft-list' });
  if (!C.liste.length) ul.appendChild(h('div', { class: 'muted', style: { padding: '14px 0' } }, 'Ta liste est vide. Cherche un objet ci-dessus, ou ajoute-en depuis un build, l\'Almanax ou la fiche d\'un objet.'));
  C.liste.forEach((x) => {
    const it = IB.get(x.id); if (!it) return; const r = bestRecipe(x.id);
    ul.appendChild(h('div', { class: 'cl-row' }, itemImg(it), h('div', { class: 'cl-n' }, h('a', { class: 'iname', onclick: () => itemDetail(it) }, it.n), h('div', { class: 'muted sm' }, 'niv. ' + it.l + ' · ' + (r ? ((REC.jobs[r.j] || {}).n || '') + ' · ' + (REC.skills[r.s] || '') : 'ressource à récolter / acheter'))),
      h('input', { class: 'inp xs', type: 'number', min: 1, value: x.qty, onchange: (e) => { x.qty = Math.max(1, +e.target.value || 1); touch(); rerender(); } }),
      h('button', { class: 'btn ghost xs', onclick: () => { C.liste = C.liste.filter((y) => y !== x); touch(); rerender(); } }, '✕')));
  });
  left.appendChild(ul);
  const two = h('div', { class: 'two craft-two' }); two.appendChild(left);

  const { base, inter, tot } = expandCraft(C.liste, C.dev, C.stock);
  const right = h('div', { class: 'card' }, h('h3', null, 'Ressources nécessaires'));
  if (!base.size && !inter.size) right.appendChild(h('div', { class: 'muted' }, 'Rien à calculer pour le moment.'));
  const t = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Ressource'), h('th', null, 'Besoin'), h('th', null, 'En stock'), h('th', null, 'Prix unit.'), h('th', null, 'Coût'))));
  const tb = h('tbody'); let total = 0; const txt = [];
  [...base.entries()].sort((a, b) => (IB.get(a[0]) || {}).n > (IB.get(b[0]) || {}).n ? 1 : -1).forEach(([id, q]) => {
    const it = IB.get(id); const pu = S().marche[id] || 0; total += pu * q; if (q > 0) txt.push(q + ' × ' + (it ? it.n : id)); const ok = q <= 0;
    const where = it ? whereToFind(it) : [];
    tb.appendChild(h('tr', { class: ok ? 'rowok' : '' }, h('td', null, h('span', { class: 'ilab' }, it ? itemImg(it) : null, h('span', null, (ok ? '✓ ' : '') + (it ? it.n : '#' + id), where.length ? h('small', { class: 'muted block' }, where.join(' · ')) : null))),
      h('td', null, h('b', null, fmt(tot.get(id) || q))),
      h('td', null, h('input', { class: 'inp xs', type: 'number', min: 0, value: C.stock[id] || 0, title: 'Quantité déjà possédée', onchange: (e) => { C.stock[id] = Math.max(0, +e.target.value || 0); touch(); rerender(); } })),
      h('td', null, h('input', { class: 'inp sm', value: kfmt(pu), placeholder: '0', onchange: (e) => { const v = parseKamas(e.target.value); if (v) S().marche[id] = v; else delete S().marche[id]; touch(); rerender(); } })),
      h('td', null, ok ? 'Complet' : pu ? kam(pu * q) : '–')));
  });
  t.appendChild(tb);
  if (base.size) {
    right.appendChild(t);
    right.appendChild(h('div', { class: 'kpis' }, h('div', { class: 'kpi' }, h('i', null, 'Ressources différentes'), h('b', null, base.size)), h('div', { class: 'kpi hot' }, h('i', null, 'Coût estimé (prix saisis)'), h('b', null, kam(total)))));
    right.appendChild(h('button', { class: 'btn sm', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(txt.join('\n')); toast('Liste copiée'); } }, '📋 Copier la liste de courses'));
  }
  if (inter.size > C.liste.length || (inter.size && C.dev)) {
    right.appendChild(h('h4', null, 'Étapes de fabrication'));
    [...inter.values()].reverse().forEach((e) => { const it = IB.get(e.id); right.appendChild(h('div', { class: 'step' }, h('span', { class: 'ilab' }, it ? itemImg(it) : null, e.q + '× ' + (it ? it.n : e.id)), h('small', { class: 'muted' }, (REC.jobs[e.r.j] || {}).n || ''))); });
  }
  two.appendChild(right); main.appendChild(two);
};

/* ===================== Atelier métiers ===================== */
const CRAFT_JOBS = [...new Set(REC.recipes.map((r) => r.j))].filter((j) => REC.jobs[j]).sort((a, b) => REC.jobs[a].n.localeCompare(REC.jobs[b].n));
/* Formules DofusDB (outil « XP Métier ») : XP cumulée au niveau n = 10·n·(n-1) ;
   XP d'un craft = floor(20·niv.recette / (((niv.métier − niv.recette)^1,1)/10 + 1) × ratio), ratio propre à l'objet ou à son type. */
const XPR_ITEM = Object.fromEntries('286:25,399:50,420:0,468:50,521:8,996:10,1001:0,1182:50,1461:0,1462:1,1463:20,1575:100,1811:8,1813:50,1829:8,1830:50,1949:100,2020:10,2034:5,2151:0,7508:10,7509:5,8545:150,9312:0,9571:5,9686:20,9687:20,9688:20,9689:20,9690:20,9968:0,9979:0,9980:0,9981:0,9982:0,9983:0,10019:10,10030:0,10031:0,10041:0,10046:0,10064:0,10065:0,10070:0,10083:0,10204:0,10223:0,10272:0,10285:0,10833:1,10839:1,11279:10,11280:20,11281:10,11282:20,11701:0,13588:2,14290:100,14293:50,15533:20,15660:10,16401:10,16402:8,16440:100,16489:100,16670:100,17168:15,17272:25,17273:25,17274:25,17275:25,17422:10,17442:0,17443:0,17444:0,17460:0,17772:0,17774:0,17777:0,17781:0,17785:0,17792:0,17850:200,17851:200,17852:200,17853:200,18113:0,18203:0,18208:0,18348:0,18525:400,18741:0,18742:0,18743:0,18836:0,19415:0,19637:10,19639:10,19641:10,19643:10,19644:10,19654:1,19693:0,19953:10,21682:50,21683:50,21684:50,21685:50,21686:50,21687:50,21689:50,21695:50,21698:50,21701:50,21705:50,21707:50,21711:50,21712:50,21713:0,21727:0,21752:0,21753:0,21754:0,21755:0,21756:0,21878:50,21984:10,22105:0,22113:0,22132:20,23094:10,23340:10,23341:10,23342:10,23343:10,23344:10,23794:10,25809:20,26353:30,26354:30,26355:30,26358:30,26369:20,27413:40,27493:25,27494:25,27495:25,27496:25,27913:50,27914:50,27915:50,27916:50,27917:50,27918:50,27919:50,27920:50,27921:50,28268:5,28269:100,28270:10,29024:10,30059:0,31517:50,31519:10,31520:10,31521:10,31522:10,31620:20,32521:50'.split(',').map((x) => x.split(':').map(Number)));
const XPR_TYPE = Object.fromEntries('12:5,26:10,33:5,40:30,42:5,43:20,49:5,50:10,51:10,58:3,60:2,69:10,70:10,84:60,95:20,99:5,151:300,165:10,167:20,174:0,179:5,183:20,197:0,323:5,326:5'.split(',').map((x) => x.split(':').map(Number)));
function craftRatio(id) { const it = IB.get(id); if (!it) return 1; if (XPR_ITEM[it.i] != null) return XPR_ITEM[it.i] / 100; if (XPR_TYPE[it.t] != null) return XPR_TYPE[it.t] / 100; return 1; }
function craftXp(rl, jl, ratio, coef, boosted) {
  if (jl - 100 > rl || jl < rl) return 0;
  const v = 20 * rl * (boosted ? 3 : 1) / (Math.pow(jl - rl, 1.1) / 10 + 1);
  const r = Math.floor(v * (ratio == null ? 1 : ratio)) * ((coef || 100) / 100);
  return Number.isNaN(r) ? 0 : Math.floor(r);
}
const xpToLevel = (x) => Math.max(Math.min(Math.floor((Math.sqrt(1 + 0.4 * x) + 1) / 2), 200), 1);

Views.metiers = (main) => {
  const st = S(); st.prefs = st.prefs || {};
  const M = (st.prefs.metier = st.prefs.metier || { job: CRAFT_JOBS[0], startingXp: 0, coef: 100, boosted: false, selected: [] });
  const U = (Views._met = Views._met || { search: '', page: 1 });
  const recsAll = () => REC.recipes.filter((r) => r.j === M.job && IB.get(r.r));
  const stepOf = () => (M.job === 79 ? 5 : 10);
  const xpFor = (r, lvl) => craftXp(r.l, lvl, craftRatio(r.r), M.coef, M.boosted);
  const keyOf = (r) => r.r + '/' + r.s;
  const byKey = () => { const m = new Map(); recsAll().forEach((r) => m.set(keyOf(r), r)); return m; };
  // rejoue les crafts (du plus ancien au plus récent) pour recalculer l'XP gagnée
  let actualXp = M.startingXp;
  const replay = () => {
    const bk = byKey(); actualXp = M.startingXp;
    M.selected = M.selected.filter((x) => bk.has(x.k));
    for (let i = M.selected.length - 1; i >= 0; i--) { const x = M.selected[i], r = bk.get(x.k); x.xp = 0; for (let n = 0; n < x.amount; n++) { const g = xpFor(r, xpToLevel(actualXp)); actualXp += g; x.xp += g; } }
  };
  replay();
  const save = () => { touch(); rerender(); };
  const addOne = (r, count) => {
    const k = keyOf(r); const g = xpFor(r, xpToLevel(actualXp));
    if (M.selected.length && M.selected[0].k === k) M.selected[0].amount += 1; else M.selected.unshift({ k, amount: 1, xp: 0 });
    M.selected[0].xp += g; actualXp += g;
  };
  const addToLevel = (r, target) => { let guard = 0; while (xpToLevel(actualXp) < target && guard++ < 20000) { if (xpFor(r, xpToLevel(actualXp)) < 1) break; addOne(r); } };
  const nextStep = (extra) => { const t = stepOf(); let l = xpToLevel(actualXp), e = extra || 0; while (e >= 0) { if (l % t !== 0) l -= l % t; l += t; e--; } return l; };

  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'XP Métier'), h('p', { class: 'muted' }, 'Choisis un métier, ton niveau (ou ton XP) et le coefficient d\'XP, puis ajoute les recettes qui t\'intéressent. Formules identiques à l\'outil XP Métier de DofusDB.'))));
  const lvlIn = h('input', { class: 'inp xs', type: 'number', min: 0, max: 200, value: xpToLevel(M.startingXp) });
  lvlIn.addEventListener('change', () => { const l = clamp(+lvlIn.value || 0, 0, 200); M.startingXp = l * (l - 1) * 10; if (M.startingXp < 0) M.startingXp = 0; M.selected = []; save(); });
  const xpIn = h('input', { class: 'inp sm', type: 'number', min: 0, value: M.startingXp });
  xpIn.addEventListener('change', () => { M.startingXp = Math.max(0, +xpIn.value || 0); save(); });
  main.appendChild(h('div', { class: 'card filters' },
    h('label', { class: 'lbl inline' }, 'Métier', h('select', { class: 'inp', onchange: (e) => { M.job = +e.target.value; M.selected = []; U.page = 1; save(); } }, CRAFT_JOBS.map((j) => h('option', { value: j, selected: j === M.job }, REC.jobs[j].n)))),
    h('label', { class: 'lbl inline' }, 'Niveau', lvlIn),
    h('label', { class: 'lbl inline', title: 'Ton XP actuelle dans le métier (la barre d\'XP en jeu)' }, 'Expérience', xpIn),
    h('label', { class: 'lbl inline', title: 'Bonus d\'XP (Almanax, etc.)' }, 'Coefficient d\'XP', h('select', { class: 'inp', onchange: (e) => { M.coef = +e.target.value; save(); } }, [100, 125, 150, 200, 225, 250, 300, 375, 400, 450, 600].map((c) => h('option', { value: c, selected: c === M.coef }, c + '%')))),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!M.boosted, onchange: (e) => { M.boosted = e.target.checked; save(); } }), 'Bonus serveur épique (×3)')));

  // ----- progression + crafts sélectionnés
  const curLvl = xpToLevel(actualXp), bk = byKey();
  const lo = curLvl * (curLvl - 1) * 10, hi = (curLvl + 1) * curLvl * 10;
  const prog = Math.min(100, Math.floor((actualXp - lo) / (hi - lo) * 100));
  const panel = h('div', { class: 'card' },
    h('div', { class: 'xp-lvl' }, 'Niveau : ', h('b', null, xpToLevel(M.startingXp)), actualXp !== M.startingXp ? [' → ', h('b', null, curLvl), h('span', { class: 'muted' }, ' (+' + fmt(actualXp - M.startingXp) + ' xp)')] : null),
    h('div', { class: 'xp-bar', title: prog + '% (' + fmt(actualXp) + ' / ' + fmt(hi) + ')' }, h('i', { style: { width: prog + '%' } })));
  if (M.selected.length) {
    const need = new Map();
    M.selected.forEach((x) => { const r = bk.get(x.k); r.g.forEach(([id, q]) => need.set(id, (need.get(id) || 0) + q * x.amount)); });
    panel.appendChild(h('div', { class: 'row gap wrap', style: { justifyContent: 'center', margin: '8px 0' } },
      h('button', { class: 'btn ghost sm', title: 'Prend le niveau atteint comme nouveau point de départ', onclick: () => { M.startingXp = actualXp; M.selected = []; save(); } }, 'Enregistrer la progression'),
      h('button', { class: 'btn ghost sm', onclick: () => { M.selected = []; save(); } }, 'Tout supprimer'),
      h('button', { class: 'btn sm', onclick: () => { M.selected.forEach((x) => addToCraft(bk.get(x.k).r, x.amount)); toast('Ajouté à l\'atelier de craft'); go('craft'); } }, '🔨 Envoyer vers l\'atelier de craft')));
    const t = h('table', { class: 'tbl stack' }, h('thead', null, h('tr', null, ['Objet', 'Niveau', 'Quantité', 'XP gagnée', 'Ingrédients', ''].map((x) => h('th', null, x)))));
    const tb = h('tbody');
    M.selected.forEach((x, i) => { const r = bk.get(x.k), it = IB.get(r.r);
      const qty = h('input', { class: 'inp xs', type: 'number', min: 1, value: x.amount });
      qty.addEventListener('change', () => { x.amount = Math.max(1, Math.floor(+qty.value) || 1); save(); });
      tb.appendChild(h('tr', null, h('td', null, h('span', { class: 'ilab' }, itemImg(it), h('a', { class: 'iname', onclick: () => itemDetail(it) }, it.n))), h('td', null, r.l), h('td', null, qty), h('td', null, fmt(x.xp)),
        h('td', null, r.g.map(([id, q]) => fmt(q * x.amount) + '× ' + (IB.get(id) ? IB.get(id).n : id)).join(', ')),
        h('td', null, h('button', { class: 'btn ghost xs', title: 'Supprimer', onclick: () => { M.selected.splice(i, 1); save(); } }, '🗑')))); });
    t.appendChild(tb); panel.appendChild(t);
    panel.appendChild(h('h4', null, 'Tous les objets nécessaires'));
    const list = h('div', { class: 'recipes-grid' });
    [...need.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, q]) => { const it = IB.get(id); const pu = st.marche[id] || 0;
      list.appendChild(h('div', { class: 'rcp', onclick: () => it && itemDetail(it) }, it ? itemImg(it) : null, h('div', null, h('b', null, fmt(q) + '× ' + (it ? it.n : '#' + id)), pu ? h('div', { class: 'muted sm' }, kam(pu * q)) : null))); });
    panel.appendChild(list);
    panel.appendChild(h('button', { class: 'btn sm', onclick: () => { navigator.clipboard && navigator.clipboard.writeText([...need.entries()].map(([id, q]) => q + ' × ' + (IB.get(id) ? IB.get(id).n : id)).join('\n')); toast('Liste copiée'); } }, '📋 Copier la liste'));
  }
  main.appendChild(panel);

  // ----- recettes disponibles (niveau actuel, du plus haut au plus bas)
  const q = h('input', { class: 'inp', placeholder: 'Rechercher une recette…', value: U.search });
  q.addEventListener('change', () => { U.search = q.value; U.page = 1; rerender(); });
  const sq = norm(U.search || '');
  const list = recsAll().filter((r) => r.l <= curLvl && (!sq || norm(IB.get(r.r).n).includes(sq))).sort((a, b) => b.l - a.l || IB.get(a.r).n.localeCompare(IB.get(b.r).n));
  const size = 10, max = Math.max(1, Math.ceil(list.length / size)); U.page = clamp(U.page, 1, max);
  const rows = list.slice((U.page - 1) * size, U.page * size);
  const t = h('table', { class: 'tbl stack' }, h('thead', null, h('tr', null, ['Objet', 'Niveau', 'XP', 'Ingrédients', 'Actions'].map((x) => h('th', null, x)))));
  const tb = h('tbody');
  if (!rows.length) tb.appendChild(h('tr', null, h('td', { colspan: 5, class: 'muted' }, 'Aucun résultat')));
  rows.forEach((r) => { const it = IB.get(r.r), g = xpFor(r, curLvl), can = curLvl < 200 && g > 0;
    tb.appendChild(h('tr', null, h('td', null, h('span', { class: 'ilab' }, itemImg(it), h('a', { class: 'iname', onclick: () => itemDetail(it) }, it.n))), h('td', null, r.l), h('td', null, fmt(g)),
      h('td', null, r.g.map(([id, qq]) => qq + '× ' + (IB.get(id) ? IB.get(id).n : id)).join(', ')),
      h('td', null, h('div', { class: 'row gap' },
        h('button', { class: 'btn sm', title: 'Ajouter 1 objet', onclick: () => { addOne(r); touch(); rerender(); } }, '+1'),
        can ? h('button', { class: 'btn sm', title: 'Fabriquer jusqu\'au niveau ' + nextStep(0), onclick: () => { addToLevel(r, nextStep(0)); touch(); rerender(); } }, '→' + nextStep(0)) : null,
        can && curLvl < 200 - stepOf() ? h('button', { class: 'btn sm', title: 'Fabriquer jusqu\'au niveau ' + nextStep(1), onclick: () => { addToLevel(r, nextStep(1)); touch(); rerender(); } }, '→' + nextStep(1)) : null)))); });
  t.appendChild(tb);
  const pager = max > 1 ? h('div', { class: 'row gap', style: { justifyContent: 'center', marginTop: '10px' } },
    h('button', { class: 'btn ghost sm', disabled: U.page <= 1, onclick: () => { U.page--; rerender(); } }, '‹'), h('span', { class: 'muted' }, 'Page ' + U.page + ' / ' + max), h('button', { class: 'btn ghost sm', disabled: U.page >= max, onclick: () => { U.page++; rerender(); } }, '›')) : null;
  main.appendChild(h('div', { class: 'card' }, h('div', { class: 'row gap', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('h3', null, 'Recettes (niveau ≤ ' + curLvl + ')'), q), t, pager));
};
