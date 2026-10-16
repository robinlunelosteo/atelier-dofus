/* ===== Suivi Ocre (archimonstres) + Almanax ===== */
'use strict';

/* ---------------- Suivi Ocre ---------------- */
const ARCH_INFO = ARCHI.map((a) => {
  const subs = a.sub.map((id) => SUBS.get(id)).filter(Boolean);
  const zone = subs[0] ? subs[0].an : 'Inconnue';
  return { ...a, subs, zone, subN: subs.map((s) => s.n) };
});
const OCRE_ZONES = [...new Set(ARCH_INFO.map((a) => a.zone))].sort((a, b) => a.localeCompare(b));

function ocreOf(pid) { const o = S().ocre; if (!o[pid]) o[pid] = {}; return o[pid]; }
function ocreCount(pid) { return Object.keys(S().ocre[pid] || {}).length; }

Views.ocre = (main) => {
  const st = S();
  const U = (Views._ocre = Views._ocre || { q: '', zone: '', statut: 'tous', lmin: 1, lmax: 200, group: true, sort: 'zone' });
  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Suivi Ocre'),
    h('p', { class: 'muted' }, 'Archimonstres à capturer pour le Dofus Ocre — coche ceux que ton perso a déjà.'))));
  if (!st.persos.length) {
    main.appendChild(h('div', { class: 'card empty' }, h('div', { class: 'big' }, '🟠'), h('p', null, 'Crée un personnage pour suivre sa progression Ocre.'), h('a', { class: 'btn primary', href: '#/persos' }, 'Créer un personnage')));
    return;
  }
  const total = ARCHI.length;
  if (!st.prefs.ocrePerso || !getPerso(st.prefs.ocrePerso)) st.prefs.ocrePerso = st.persos[0].id;
  const pid = st.prefs.ocrePerso;
  const mine = ocreOf(pid);
  const multi = st.persos.length > 1; const allOn = multi && !!st.prefs.ocreTous; /* « les N » : une capture s'applique à tous les persos */
  const setFor = (a, v) => { (allOn ? st.persos.map((x) => x.id) : [pid]).forEach((id) => { const o = ocreOf(id); if (v) o[a.id] = true; else delete o[a.id]; }); };

  // vue d'ensemble
  main.appendChild(h('div', { class: 'ocre-over' }, st.persos.map((p) => {
    const n = ocreCount(p.id);
    return h('button', { class: 'ocre-p' + (p.id === pid ? ' on' : ''), onclick: () => { st.prefs.ocrePerso = p.id; touch(); rerender(); } },
      h('div', { class: 'row between' }, h('b', null, p.nom), h('span', { class: 'muted sm' }, className(p.classe))),
      progress(n / total * 100), h('div', { class: 'row between' }, h('span', null, n + ' / ' + total), h('b', null, (n / total * 100).toFixed(1) + ' %')));
  })));

  const list = h('div', { class: 'ocre-list' });
  const info = h('div', { class: 'muted sm' });
  const render = () => {
    clear(list);
    const q = norm(U.q);
    let arr = ARCH_INFO.filter((a) => a.l >= U.lmin && a.l <= U.lmax && (!U.zone || a.zone === U.zone)
      && (U.statut === 'tous' || (U.statut === 'ok' ? mine[a.id] : !mine[a.id]))
      && (!q || norm(a.n).includes(q) || norm(a.base).includes(q) || a.subN.some((s) => norm(s).includes(q))));
    const sorter = { niveau: (a, b) => a.l - b.l || a.n.localeCompare(b.n), nom: (a, b) => a.n.localeCompare(b.n), zone: (a, b) => a.zone.localeCompare(b.zone) || a.l - b.l };
    arr.sort(sorter[U.sort] || sorter.zone);
    info.textContent = arr.length + ' archimonstre(s) affiché(s) — ' + arr.filter((a) => mine[a.id]).length + ' capturé(s)';
    const card = (a) => h('div', { class: 'arch' + (mine[a.id] ? ' ok' : ''), onclick: () => { setFor(a, !mine[a.id]); touch(); const sc = $('#main').scrollTop; rerender(); $('#main').scrollTop = sc; } },
      monImg(a.g, 'lg'), h('div', { class: 'arch-main' }, h('b', null, a.n), h('div', { class: 'muted sm' }, 'niv. ' + a.l + (a.base ? ' · ' + a.base : '')),
        h('div', { class: 'muted sm' }, '📍 ' + (a.subN.slice(0, 2).join(', ') || a.zone))),
      h('div', { class: 'tick' }, mine[a.id] ? '✓' : ''));
    if (U.group) {
      const byZ = new Map();
      arr.forEach((a) => { if (!byZ.has(a.zone)) byZ.set(a.zone, []); byZ.get(a.zone).push(a); });
      byZ.forEach((as, z) => {
        const done = as.filter((a) => mine[a.id]).length;
        list.appendChild(h('div', { class: 'zone-head' }, h('h3', null, z), h('span', { class: 'muted' }, done + ' / ' + as.length), progress(done / as.length * 100)));
        list.appendChild(h('div', { class: 'arch-grid' }, as.map(card)));
      });
    } else list.appendChild(h('div', { class: 'arch-grid' }, arr.map(card)));
    if (!arr.length) list.appendChild(h('div', { class: 'muted center' }, 'Aucun résultat.'));
    visible = arr;
  };
  let visible = [];
  const bar = h('div', { class: 'card filters' },
    h('input', { class: 'inp', placeholder: 'Rechercher (nom, zone…)', value: U.q, oninput: (e) => { U.q = e.target.value; render(); } }),
    h('select', { class: 'inp', onchange: (e) => { U.zone = e.target.value; render(); } }, h('option', { value: '' }, 'Toutes les zones'), OCRE_ZONES.map((z) => h('option', { value: z, selected: z === U.zone }, z))),
    h('select', { class: 'inp', onchange: (e) => { U.statut = e.target.value; render(); } }, [['tous', 'Tous'], ['ko', 'Manquants'], ['ok', 'Capturés']].map(([k, n]) => h('option', { value: k, selected: k === U.statut }, n))),
    h('label', { class: 'lbl inline' }, 'Niv.', h('input', { class: 'inp xs', type: 'number', value: U.lmin, onchange: (e) => { U.lmin = +e.target.value || 1; render(); } }), '–', h('input', { class: 'inp xs', type: 'number', value: U.lmax, onchange: (e) => { U.lmax = +e.target.value || 200; render(); } })),
    h('select', { class: 'inp', onchange: (e) => { U.sort = e.target.value; render(); } }, [['zone', 'Tri : zone'], ['niveau', 'Tri : niveau'], ['nom', 'Tri : nom']].map(([k, n]) => h('option', { value: k, selected: k === U.sort }, n))),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: U.group, onchange: (e) => { U.group = e.target.checked; render(); } }), 'Grouper par zone'),
    multi ? h('button', { class: 'btn sm' + (allOn ? ' primary' : ''), title: 'Quand c\'est activé, cocher ou décocher un archimonstre s\'applique à tous tes persos', onclick: () => { st.prefs.ocreTous = !allOn; touch(); rerender(); } }, (allOn ? '✓ ' : '') + '👥 Les ' + st.persos.length + ' persos') : null,
    h('button', { class: 'btn sm', onclick: () => { visible.forEach((a) => setFor(a, true)); touch(); rerender(); } }, 'Tout cocher (affichés)'),
    h('button', { class: 'btn sm', onclick: () => { visible.forEach((a) => setFor(a, false)); touch(); rerender(); } }, 'Tout décocher'));
  main.appendChild(bar); main.appendChild(info); main.appendChild(list);
  render();
};

/* ---------------- Almanax ---------------- */
function almDone(pid, date) { return !!S().almanax.fait[pid + '|' + date]; }
function almToggle(pid, date) { const k = pid + '|' + date; if (S().almanax.fait[k]) delete S().almanax.fait[k]; else S().almanax.fait[k] = true; touch(); }
function almItem(a) { return IB.get(a.o); }

Views.almanax = (main, dateArg) => {
  const st = S(); const today = todayStr();
  const U = (Views._alm = Views._alm || { sel: today, month: today.slice(0, 7), days: 14 });
  if (dateArg) U.sel = dateArg;
  const a = ALM.get(U.sel);
  main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Almanax'), h('p', { class: 'muted' }, 'Bonus du jour, offrande à apporter, calendrier et suivi.')),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn', onclick: () => { U.sel = addDays(U.sel, -1); U.month = U.sel.slice(0, 7); rerender(); } }, '‹'),
      h('button', { class: 'btn', onclick: () => { U.sel = today; U.month = today.slice(0, 7); rerender(); } }, "Aujourd'hui"),
      h('button', { class: 'btn', onclick: () => { U.sel = addDays(U.sel, 1); U.month = U.sel.slice(0, 7); rerender(); } }, '›'))));

  // carte du jour
  const hero = h('div', { class: 'card alm-hero' });
  hero.appendChild(h('div', { class: 'alm-date' }, h('span', { class: 'tag gold' }, U.sel === today ? "Aujourd'hui" : (U.sel > today ? 'À venir' : 'Passé')), h('h2', null, dateLong(U.sel))));
  if (!a) {
    hero.appendChild(h('p', { class: 'muted' }, 'Pas de donnée Almanax pour cette date (les données du jeu couvrent ' + [...ALM.keys()][0] + ' → ' + [...ALM.keys()].pop() + ').'));
  } else {
    const it = almItem(a);
    hero.appendChild(h('div', { class: 'alm-body' },
      h('div', { class: 'alm-off' }, it ? itemImg(it, 'huge') : null, h('div', null, h('div', { class: 'muted sm' }, 'Offrande'), h('div', { class: 'alm-q' }, a.q + '× ' + a.on),
        h('div', { class: 'muted sm' }, 'à apporter à ' + a.r),
        it && RBY.has(it.i) ? h('button', { class: 'btn sm', style: { marginTop: '8px' }, onclick: () => { addToCraft(it.i, a.q); toast('Ajouté à l\'atelier de craft'); } }, '🔨 Voir la recette') : null,
        it ? h('button', { class: 'btn ghost sm', style: { marginTop: '8px' }, onclick: () => itemDetail(it) }, 'Détails') : null)),
      h('div', { class: 'alm-bonus' }, h('div', { class: 'muted sm' }, 'Bonus — ' + a.bt), h('p', null, a.b),
        h('div', { class: 'kpis' }, h('div', { class: 'kpi' }, h('i', null, 'Kamas'), h('b', null, fmt(a.k))), h('div', { class: 'kpi' }, h('i', null, 'Ratio XP'), h('b', null, '×' + a.x)), h('div', { class: 'kpi' }, h('i', null, 'Niv. optimal'), h('b', null, a.ol))))));
    const chk = h('div', { class: 'alm-chk' }, h('h4', null, 'Offrande faite'));
    if (st.persos.length) st.persos.forEach((p) => chk.appendChild(h('label', { class: 'chk big' }, h('input', { type: 'checkbox', checked: almDone(p.id, U.sel), onchange: () => { almToggle(p.id, U.sel); rerender(); } }), p.nom)));
    chk.appendChild(h('label', { class: 'chk big' }, h('input', { type: 'checkbox', checked: almDone('all', U.sel), onchange: () => { almToggle('all', U.sel); rerender(); } }), st.persos.length ? 'Toute l\'équipe' : 'Fait'));
    hero.appendChild(chk);
  }
  main.appendChild(hero);

  const two = h('div', { class: 'two' });
  // calendrier mensuel
  const [y, mo] = U.month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1); const nd = new Date(y, mo, 0).getDate(); const off = (first.getDay() + 6) % 7;
  const cal = h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('button', { class: 'btn ghost sm', onclick: () => { const d = new Date(y, mo - 2, 1); U.month = todayStr(d).slice(0, 7); rerender(); } }, '‹'),
      h('h3', null, MOIS[mo - 1] + ' ' + y), h('button', { class: 'btn ghost sm', onclick: () => { const d = new Date(y, mo, 1); U.month = todayStr(d).slice(0, 7); rerender(); } }, '›')));
  const g = h('div', { class: 'cal' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => h('div', { class: 'cal-h' }, d)));
  for (let i = 0; i < off; i++) g.appendChild(h('div', { class: 'cal-c empty' }));
  for (let d = 1; d <= nd; d++) {
    const ds = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const x = ALM.get(ds); const it = x && almItem(x);
    const done = st.persos.length ? st.persos.every((p) => almDone(p.id, ds)) || almDone('all', ds) : almDone('all', ds);
    g.appendChild(h('div', { class: 'cal-c' + (ds === U.sel ? ' sel' : '') + (ds === today ? ' today' : '') + (done ? ' done' : '') + (x ? '' : ' nodata'), onclick: () => { U.sel = ds; rerender(); }, title: x ? x.q + '× ' + x.on : '' },
      h('span', { class: 'cd' }, d), it ? itemImg(it, 'xs') : null, x ? h('small', null, x.q + '× ') : null, done ? h('span', { class: 'cal-ok' }, '✓') : null));
  }
  cal.appendChild(g); two.appendChild(cal);

  // besoins sur N jours
  const need = new Map();
  for (let i = 0; i < U.days; i++) { const ds = addDays(today, i); const x = ALM.get(ds); if (x) { const k = x.o; const cur = need.get(k) || { it: IB.get(k), n: x.on, q: 0, dates: [] }; cur.q += x.q; cur.dates.push(ds); need.set(k, cur); } }
  const nb = h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, 'Offrandes à préparer'),
    h('label', { class: 'lbl inline' }, 'sur', h('select', { class: 'inp', onchange: (e) => { U.days = +e.target.value; rerender(); } }, [7, 14, 30, 60, 90].map((n) => h('option', { value: n, selected: n === U.days }, n + ' jours'))))));
  const lst = h('div', { class: 'need' });
  [...need.values()].sort((p, q) => q.q - p.q).forEach((x) => lst.appendChild(h('div', { class: 'need-r' }, x.it ? itemImg(x.it) : null, h('div', { class: 'need-n' }, h('b', null, x.q + '× ' + x.n), h('div', { class: 'muted sm' }, x.dates.length + ' jour(s) : ' + x.dates.slice(0, 4).map((d) => d.slice(8) + '/' + d.slice(5, 7)).join(', ') + (x.dates.length > 4 ? '…' : ''))),
    h('div', { class: 'row gap' }, x.it && S().marche[x.it.i] ? h('span', { class: 'muted sm' }, kam(S().marche[x.it.i] * x.q)) : null, x.it && RBY.has(x.it.i) ? h('button', { class: 'btn sm', title: 'Ajouter au craft', onclick: () => { addToCraft(x.it.i, x.q); toast('Ajouté au craft'); } }, '🔨') : null))));
  if (!need.size) lst.appendChild(h('div', { class: 'muted' }, 'Aucune donnée sur la période.'));
  nb.appendChild(lst);
  const tot = [...need.values()].reduce((s, x) => s + (S().marche[x.it && x.it.i] || 0) * x.q, 0);
  if (tot) nb.appendChild(h('div', { class: 'muted' }, 'Coût estimé (prix connus) : ' + kam(tot)));
  two.appendChild(nb);
  main.appendChild(two);

  // recherche d'offrande
  const res = h('div', { class: 'need' });
  const sr = h('input', { class: 'inp', placeholder: 'Quand dois-je offrir… (nom d\'objet) ?', oninput: (e) => {
    clear(res); const q = norm(e.target.value); if (q.length < 3) return;
    [...ALM.values()].filter((x) => x.d >= today && norm(x.on).includes(q)).slice(0, 25).forEach((x) => res.appendChild(h('div', { class: 'need-r', style: { cursor: 'pointer' }, onclick: () => { U.sel = x.d; U.month = x.d.slice(0, 7); rerender(); window.scrollTo(0, 0); } },
      h('b', null, dateLong(x.d)), h('span', { class: 'muted' }, x.q + '× ' + x.on))));
  } });
  main.appendChild(h('div', { class: 'card' }, h('h3', null, 'Rechercher une offrande'), sr, res));

  // stats de série
  if (st.persos.length) {
    let streakHtml = st.persos.map((p) => {
      let n = 0; let d = today; if (!almDone(p.id, d) && !almDone('all', d)) d = addDays(d, -1);
      while (almDone(p.id, d) || almDone('all', d)) { n++; d = addDays(d, -1); if (n > 400) break; }
      return h('div', { class: 'kpi' }, h('i', null, p.nom), h('b', null, n + ' j de suite'));
    });
    main.appendChild(h('div', { class: 'card' }, h('h3', null, 'Séries d\'offrandes'), h('div', { class: 'kpis' }, streakHtml)));
    /* pages de journal : 1 page par offrande faite ; 365 pour le Dolmanax */
    const dates = new Set(Object.keys(st.almanax.fait).map((k) => k.split('|')[1]));
    const pages = (pid) => [...dates].filter((d) => almDone(pid, d) || almDone('all', d)).length;
    main.appendChild(h('div', { class: 'card' }, h('h3', null, '📖 Pages de journal'),
      h('p', { class: 'muted sm' }, '1 page par offrande faite (cochée ci-dessus) · 365 pages pour le Dofus Dolmanax.'),
      h('div', { class: 'kpis' }, st.persos.map((p) => { const n = pages(p.id); return h('div', { class: 'kpi' }, h('i', null, p.nom), h('b', null, n + ' / 365'), progress(Math.min(100, n / 365 * 100)), h('small', { class: 'muted' }, n >= 365 ? 'Dolmanax débloqué !' : 'encore ' + (365 - n))); }))));
  }
};
