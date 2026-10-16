/* ===== Composants objets : détail, sélecteur ===== */
'use strict';

function effText(e) {
  const k = STAT_BY_ID[e[0]];
  const lab = k ? statLabel(k) : (LAB[e[0]] || ('effet ' + e[0]));
  const [, mn, mx] = e;
  const val = (mx === 0 && mn > 0) || mn === mx ? `${mn}` : `${mn} à ${mx}`;
  return { txt: `${val} ${lab}`, neg: Math.max(mn, mx) < 0 || (mn < 0 && mx <= 0), k, lab, val };
}
function effChips(it, max) {
  const wrap = h('div', { class: 'chips' });
  const list = (it.e || []).filter((e) => e[0] in STAT_BY_ID);
  list.slice(0, max || 99).forEach((e) => {
    const x = effText(e);
    wrap.appendChild(h('span', { class: 'chip' + (x.neg ? ' neg' : ''), title: x.txt }, x.txt));
  });
  if (max && list.length > max) wrap.appendChild(h('span', { class: 'chip more' }, '+' + (list.length - max)));
  return wrap;
}
function setOf(it) { return it.s ? SETS.get(it.s) : null; }

function itemDetail(it) {
  const set = setOf(it);
  const rec = RBY.get(it.i);
  const body = h('div', { class: 'idet' },
    h('div', { class: 'row gap' }, itemImg(it, 'big'),
      h('div', null, h('h2', null, it.n), h('div', { class: 'muted' }, typeName(it.t) + ' · niveau ' + it.l))),
    it.c ? h('div', { class: 'cond' }, '🔒 Conditions : ' + it.c) : null,
    (it.w || []).length ? h('div', { class: 'wdmg' }, h('h4', null, 'Arme'),
      h('div', { class: 'muted' }, `${it.ap || '?'} PA · portée ${it.pm || 1}-${it.po || 1} · critique ${it.cc || 0}% (+${it.cb || 0}) · ${it.mc || 1} lancer(s)/tour`),
      it.w.map((w) => h('div', { class: 'wline' }, `${w[1]} à ${w[2]} — ${w[3]}`))) : null,
    h('h4', null, 'Effets'),
    h('ul', { class: 'efl' }, (it.e || []).map((e) => { const x = effText(e); return h('li', { class: x.neg ? 'neg' : '' }, x.txt); })),
    set ? h('div', null, h('h4', null, 'Panoplie : ' + set.n),
      h('div', { class: 'chips' }, set.i.map((id) => { const x = IB.get(id); return x ? h('span', { class: 'chip', style: { cursor: 'pointer' }, onclick: () => itemDetail(x) }, x.n) : null; })),
      Object.keys(set.e).sort((a, b) => a - b).filter((n) => n >= 2).map((n) =>
        h('div', { class: 'setln' }, h('b', null, n + ' pièces : '), set.e[n].map(([id, v]) => `${v} ${STAT_BY_ID[id] ? statLabel(STAT_BY_ID[id]) : (LAB[id] || id)}`).join(', ')))) : null,
    rec ? h('div', null, h('h4', null, 'Recette'),
      rec.map((r) => h('div', { class: 'recipe-box' },
        h('div', { class: 'muted' }, (REC.jobs[r.j] || {}).n || 'Métier'),
        h('div', { class: 'chips' }, r.g.map(([id, q]) => { const x = IB.get(id); return h('span', { class: 'chip' }, q + '× ' + (x ? x.n : '#' + id)); })),
        h('button', { class: 'btn sm', onclick: () => { addToCraft(it.i, 1); toast('Ajouté à l\'atelier de craft'); } }, '➕ Ajouter au craft')))) : null,
    h('div', { class: 'row gap', style: { marginTop: '12px' } },
      h('label', { class: 'lbl' }, 'Prix marché connu'),
      h('input', { class: 'inp', style: { width: '150px' }, value: kfmt(S().marche[it.i]), placeholder: 'ex: 1,5m',
        onchange: (e) => { const v = parseKamas(e.target.value); if (v) S().marche[it.i] = v; else delete S().marche[it.i]; touch(); } })));
  modal(it.n, body, { cls: 'wide' });
}

function itemSummary(it) {
  const set = setOf(it);
  return h('div', { class: 'islot-in' },
    itemImg(it),
    h('div', { class: 'islot-txt' },
      h('a', { class: 'iname', onclick: (e) => { e.stopPropagation(); itemDetail(it); } }, it.n),
      h('div', { class: 'muted sm' }, 'niv. ' + it.l + (set ? ' · ' + set.n : ''))));
}

/* sélecteur d'objet pour un emplacement */
function itemPicker(slot, current, onPick, extra) {
  const def = SLOT_BY[slot];
  const pool = POOL[slot];
  const st = { q: '', lmin: 1, lmax: (extra && extra.maxLevel) || 200, sort: 'lvl', setOnly: false, stat: '' };
  const list = h('div', { class: 'picker-list' });
  const count = h('div', { class: 'muted sm' });
  const render = () => {
    clear(list);
    const q = norm(st.q);
    let arr = pool.filter((it) => it.l >= st.lmin && it.l <= st.lmax
      && (!q || norm(it.n).includes(q))
      && (!st.setOnly || it.s)
      && (!st.stat || (it.e || []).some((e) => STAT_BY_ID[e[0]] === st.stat)));
    if (st.sort === 'lvl') arr.sort((a, b) => b.l - a.l || a.n.localeCompare(b.n));
    else if (st.sort === 'name') arr.sort((a, b) => a.n.localeCompare(b.n));
    else if (st.sort === 'prix') arr.sort((a, b) => (S().marche[b.i] || 0) - (S().marche[a.i] || 0));
    else if (st.sort === 'stat' && st.stat) arr.sort((a, b) => statOf(b, st.stat) - statOf(a, st.stat));
    count.textContent = arr.length + ' objet(s)';
    arr.slice(0, 80).forEach((it) => {
      const set = setOf(it); const mk = S().marche[it.i];
      list.appendChild(h('div', { class: 'pick-row' + (it.i === current ? ' cur' : ''), onclick: () => { m.close(); onPick(it); } },
        itemImg(it),
        h('div', { class: 'pick-main' },
          h('div', { class: 'pick-name' }, it.n, h('em', null, 'niv. ' + it.l), set ? h('span', { class: 'tag' }, set.n) : null, mk ? h('span', { class: 'tag gold' }, kam(mk)) : null),
          effChips(it, 7),
          (it.w || []).length ? h('div', { class: 'muted sm' }, it.w.filter((w) => WEAPON_DMG[w[0]]).map((w) => `${w[1]}-${w[2]} ${w[3].replace('dommages ', '')}`).join(' · ') + ` · ${it.ap}PA`) : null,
          it.c ? h('div', { class: 'cond sm' }, '🔒 ' + it.c) : null)));
    });
    if (arr.length > 80) list.appendChild(h('div', { class: 'muted center' }, 'Affinez la recherche pour voir les ' + (arr.length - 80) + ' autres…'));
  };
  const statOf = (it, k) => { const e = (it.e || []).find((x) => STAT_BY_ID[x[0]] === k); return e ? effVal(e, 'max') : -1e9; };
  const search = h('input', { class: 'inp', placeholder: 'Rechercher un objet…', oninput: (e) => { st.q = e.target.value; render(); } });
  const selStat = h('select', { class: 'inp', onchange: (e) => { st.stat = e.target.value; if (st.stat) { st.sort = 'stat'; selSort.value = 'stat'; } render(); } },
    h('option', { value: '' }, 'Toute stat'), STAT_DEFS.filter((d) => ['carac', 'prim', 'sec', 'dom', 'res'].includes(d[3])).map((d) => h('option', { value: d[0] }, d[2])));
  const selSort = h('select', { class: 'inp', onchange: (e) => { st.sort = e.target.value; render(); } },
    h('option', { value: 'lvl' }, 'Niveau ↓'), h('option', { value: 'name' }, 'Nom'), h('option', { value: 'prix' }, 'Prix marché ↓'), h('option', { value: 'stat' }, 'Stat choisie ↓'));
  const body = h('div', { class: 'picker' },
    h('div', { class: 'picker-bar' }, search,
      h('label', { class: 'lbl inline' }, 'Niv.', h('input', { class: 'inp xs', type: 'number', value: st.lmin, onchange: (e) => { st.lmin = +e.target.value || 1; render(); } }), '–',
        h('input', { class: 'inp xs', type: 'number', value: st.lmax, onchange: (e) => { st.lmax = +e.target.value || 200; render(); } })),
      selStat, selSort,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: (e) => { st.setOnly = e.target.checked; render(); } }), 'Panoplies'),
      count),
    list);
  const m = modal(def.n + ' — choisir un objet', body, { cls: 'wide' });
  setTimeout(() => search.focus(), 40);
  render();
}
