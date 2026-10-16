/* ===== Boss de donjon & avis de recherche ===== */
(function () {
  const U = () => (Views._b = Views._b || { tab: 'donjons', q: '', lv: 'all', hide: false, zone: '', rw: '', open: {}, sort: 'niv' });
  const B = () => {
    const b = (S().boss = S().boss || {}); b.avis = b.avis || {};
    delete b.done; delete b.ach; /* anciennes cases à cocher (donjons / succès), supprimées */
    Object.keys(b.avis).forEach((id) => { if (b.avis[id] === 1) { b.avis[id] = {}; S().persos.forEach((p) => { b.avis[id][p.id] = 1; }); } });
    return b;
  };
  /* avis : une pastille par perso, chaque perso se coche seul */
  const hasP = (map, key, pid) => !!(map[key] && map[key][pid]);
  const allP = (map, key) => !!S().persos.length && S().persos.every((p) => hasP(map, key, p.id));
  const togP = (map, key, pid) => { map[key] = map[key] || {}; if (map[key][pid]) delete map[key][pid]; else map[key][pid] = 1; if (!Object.keys(map[key]).length) delete map[key]; touch(); };
  const ELS = [['Neutre', '#b8bcd0'], ['Terre', '#c98a4b'], ['Feu', '#ee6a4d'], ['Eau', '#4db3ee'], ['Air', '#7be0a4']];
  const TAGS = {
    summon: '🧟 Invoque', push: '💨 Pousse', pull: '🧲 Attire', tp: '🌀 Téléporte', retPM: '🦶 Retrait PM', retPA: '⚡ Retrait PA', retPO: '🎯 Retrait PO',
    heal: '💚 Soigne', lifeSteal: '🩸 Vol de vie', erode: '🪨 Érosion', poison: '☠️ Poison', glyph: '🔯 Glyphes', trap: '🪤 Pièges', boostShield: '🛡️ Bouclier',
    malusRes: '📉 Baisse de résistances', malusDmg: '📉 Baisse de dommages', debuff: '🔻 Débuffs', multi: '🎯 Plusieurs cibles',
  };
  const kf = (n) => Number(n).toLocaleString('fr-FR');
  const plain = (e) => /^\d+( à \d+)? (dommages|vol) (Feu|Eau|Air|Terre|Neutre)$/i.test(e) || /^\d+( à \d+)? soins? /i.test(e);
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const poTxt = (po) => (Array.isArray(po) ? po[0] + '–' + po[1] : String(po));
  const spTxt = (s) => `${s.pa} PA · PO ${poTxt(s.po)}${s.cd ? ' · recharge ' + s.cd : ''}${s.mt ? ' · ' + s.mt + '×/tour' : ''}`;

  function load() {
    if (window.D_BOSS) return Promise.resolve();
    return (Views._bp = Views._bp || new Promise((ok, ko) => {
      const sc = document.createElement('script'); sc.src = 'data/boss.js'; sc.onload = ok; sc.onerror = () => { Views._bp = null; ko(new Error('boss.js')); }; document.head.appendChild(sc);
    }));
  }
  const itemIco = (id, cls) => { const it = D_BOSS.items[id]; return it ? itemImg({ ic: it.ic }, cls || 'xs') : null; };

  function resRow(b) {
    return h('div', { class: 'bx-res' }, b.res.map((v, i) => h('div', { class: 'bx-r' + (v < 0 ? ' neg' : v >= 50 ? ' hi' : ''), style: { '--c': ELS[i][1] }, title: 'Résistance ' + ELS[i][0] },
      h('span', { class: 'bx-rn' }, ELS[i][0]), h('b', null, v + '%'), h('span', { class: 'bx-bar2' }, h('i', { style: { width: Math.max(4, Math.min(100, Math.abs(v))) + '%' } })))));
  }
  const stat = (l, v) => h('div', { class: 'bx-st' }, h('i', null, l), h('b', null, v));
  function bossCard(b, opts) {
    opts = opts || {};
    const notable = b.sp.filter((s) => s.eff.some((e) => !plain(e)));
    const hits = b.sp.filter((s) => s.eff.some((e) => /dommages|vol /i.test(e)));
    const dmgOf = (s) => { let m = 0; s.eff.forEach((e) => { const r = /(\d+)(?: à (\d+))? (?:dommages|vol)/i.exec(e); if (r) m = Math.max(m, +(r[2] || r[1])); }); return m; };
    const top = hits.slice().sort((a, c) => dmgOf(c) - dmgOf(a)).slice(0, 3);
    const tags = b.tags.filter((t) => TAGS[t]);
    const els = ['neutral', 'earth', 'fire', 'water', 'air'].filter((t) => b.tags.includes(t)).map((t) => ({ neutral: 'Neutre', earth: 'Terre', fire: 'Feu', water: 'Eau', air: 'Air' }[t]));
    const el = h('div', { class: 'bx-boss' },
      h('div', { class: 'bx-hero' }, h('div', { class: 'bx-portrait' }, monImg(b.gfx, 'bx-img xl')),
        h('div', { class: 'bx-bt' }, h('h3', null, b.n), h('span', { class: 'bx-lvl' }, 'Niveau ' + b.lvl),
          tags.length ? h('div', { class: 'bx-tags' }, tags.map((t) => h('span', { class: 'bx-tag' }, TAGS[t]))) : null)),
      h('div', { class: 'bx-stats' }, stat('PV', kf(b.pv)), stat('PA', b.pa), stat('PM', b.pm), stat('Esquive PA', (b.da || 0) + '%'), stat('Esquive PM', (b.dm || 0) + '%')),
      h('div', { class: 'bx-sec' }, 'Résistances'), resRow(b),
      notable.length ? h('div', { class: 'bx-sec' }, 'Sorts marquants') : null,
      notable.length ? h('div', { class: 'bx-mech' }, notable.slice(0, 5).map((s) => h('div', { class: 'bx-m' }, h('div', { class: 'bx-mh' }, h('b', null, s.n), h('small', { class: 'muted' }, spTxt(s))), h('div', { class: 'sm' }, short(s.eff.filter((e) => !plain(e) || notable.length < 3).join(' ; '), 170))))) : null,
      top.length ? h('div', { class: 'bx-hit' }, h('span', { class: 'bx-sec' }, 'Coups forts'), top.map((s) => h('span', { class: 'bx-chipd' }, `${s.n} · ${dmgOf(s)}`)), els.length ? h('small', { class: 'muted' }, ' éléments : ' + els.join(', ')) : null) : null);
    if (b.sp.length) {
      const d = h('details', { class: 'bx-all' }, h('summary', null, `Tous les sorts (${b.sp.length})`),
        h('div', { class: 'bx-spl' }, b.sp.map((s) => h('div', { class: 'bx-s' }, h('b', null, s.n), h('small', { class: 'muted' }, spTxt(s)), h('div', null, s.eff.join(' ; ') || '—')))));
      el.appendChild(d);
    }
    return el;
  }

  /* ---------- Donjons ---------- */
  function donjons(main) {
    const u = U(), O = D_BOSS;
    main.appendChild(h('div', { class: 'card muted sm' }, h('b', null, 'Les succès de donjon : '), 'battre le boss du donjon ; ceux qui portent un nom de défi entre parenthèses (Duo, Hardi, Zombie…) se valident en réussissant ce défi pendant le combat. La règle de chaque défi est rappelée sous son nom. La « mécanique » du donjon est un résumé de guides communautaires (surtout JeuxOnline, souvent écrits pour Dofus 2) : à recouper en jeu.'));
    const bar = h('div', { class: 'card bx-bar' },
      h('input', { class: 'inp', placeholder: 'Chercher un donjon ou un boss…', value: u.q, oninput: (e) => { u.q = e.target.value; draw(); } }),
      h('div', { class: 'chips' }, [['all', 'Tous'], ['50', '≤ 50'], ['100', '51–100'], ['150', '101–150'], ['200', '151–200']].map(([k, n]) => h('button', { class: 'chip' + (u.lv === k ? ' on' : ''), onclick: () => { u.lv = k; rerender(); } }, n))));
    main.appendChild(bar);
    const list = h('div', { class: 'bx-list' }); main.appendChild(list);
    const inLv = (d) => u.lv === 'all' || (u.lv === '50' ? d.min <= 50 : d.min > +({ 100: 50, 150: 100, 200: 150 }[u.lv]) && d.min <= +u.lv);
    function draw() {
      clear(list); const q = norm(u.q);
      const rows = O.dungeons.filter((d) => inLv(d) && (!q || norm(d.n).includes(q) || d.B.some((i) => norm(O.bosses[i].n).includes(q)))).sort((a, c) => a.min - c.min || a.n.localeCompare(c.n));
      if (!rows.length) list.appendChild(h('div', { class: 'card empty muted' }, 'Aucun donjon ne correspond.'));
      rows.forEach((d) => list.appendChild(dungeon(d)));
    }
    draw();
  }
  function dungeon(d) {
    const u = U(), O = D_BOSS, open = !!u.open['d' + d.id];
    const card = h('div', { class: 'card bx-d' });
    const head = h('div', { class: 'bx-dh', onclick: () => { u.open['d' + d.id] = !open; rerender(); } },
      O.bosses[d.B[0]] ? h('div', { class: 'bx-portrait sm' }, monImg(O.bosses[d.B[0]].gfx, 'bx-img')) : null,
      h('div', { class: 'bx-dt' }, h('b', null, d.n), h('small', { class: 'muted' }, `niv. ${d.min}${d.opt && d.opt !== d.min ? ' (conseillé ' + d.opt + ')' : ''} · ${'★'.repeat(d.df || 1)}${d.sub && d.sub !== d.n ? ' · ' + d.sub : ''}`),
        h('small', { class: 'bx-bn' }, '👹 ' + d.B.map((i) => O.bosses[i].n).join(', ')),
        d.ach.length ? h('small', { class: 'muted' }, `🏆 ${d.ach.length} succès`) : null),
      h('span', { class: 'bx-chev' }, open ? '▾' : '▸'));
    card.appendChild(head);
    if (open) {
      const body = h('div', { class: 'bx-body' }, h('div', { class: 'bx-plan' }, h('b', { class: 'sm' }, '🧭 Mécanique'), h('p', { class: d.m ? 'sm' : 'sm muted' }, d.m || 'Aucune source fiable trouvée pour ce donjon.')), d.B.map((i) => bossCard(O.bosses[i])));
      if (d.keys.length) body.appendChild(h('div', { class: 'bx-key muted sm' }, 'Clé : ', d.keys.map(([id, q]) => h('span', { class: 'bx-k' }, itemIco(id), ' ' + ((O.items[id] || {}).n || '#' + id) + (q > 1 ? ' ×' + q : '')))));
      if (d.ach.length) body.appendChild(h('div', { class: 'bx-achs' }, h('b', { class: 'sm' }, `🏆 Succès du donjon (${d.ach.length})`), h('ul', { class: 'bx-ach' }, d.ach.map((a) => { const x = O.ach[a]; return h('li', null, h('b', null, x.n), x.d ? h('div', { class: 'muted sm' }, x.d) : null); }))));
      if (d.mons && d.mons.length) body.appendChild(h('div', { class: 'muted sm bx-mons' }, 'Monstres du donjon : ' + [...new Set(d.mons)].join(', ')));
      card.appendChild(body);
    }
    return card;
  }

  /* ---------- Avis de recherche ---------- */
  const RW = { 17019: 'Aliton', 13052: 'Aviton', 11196: 'Kamas de glace' };
  function avis(main) {
    const u = U(), O = D_BOSS, done = B().avis;
    const zones = [...new Set(O.bounties.flatMap((b) => b.sub))].sort();
    main.appendChild(h('div', { class: 'card muted sm' }, h('b', null, 'Comment ça marche : '), 'chaque avis se prend auprès d\'une milice (Astrub, Bonta, Brâkmar, Frigost…). On localise le criminel, on le bat, puis on le ramène à la milice pour toucher les jetons (Aliton, Aviton, Kamas de glace). Le monstre ne réapparaît pas tout de suite après sa capture.'));
    const bar = h('div', { class: 'card bx-bar' },
      h('input', { class: 'inp', placeholder: 'Chercher un criminel…', value: u.q, oninput: (e) => { u.q = e.target.value; draw(); } }),
      h('select', { class: 'inp', onchange: (e) => { u.zone = e.target.value; draw(); } }, h('option', { value: '' }, 'Toutes les zones'), zones.map((z) => h('option', { value: z, selected: u.zone === z }, z))),
      h('select', { class: 'inp', onchange: (e) => { u.rw = e.target.value; draw(); } }, [['', 'Toutes les récompenses'], ['17019', 'Aliton'], ['13052', 'Aviton'], ['11196', 'Kamas de glace']].map(([v, n]) => h('option', { value: v, selected: String(u.rw) === v }, n))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: u.hide, onchange: (e) => { u.hide = e.target.checked; draw(); } }), ' Masquer ceux capturés par tous'));
    main.appendChild(bar);
    const cnt = (p) => O.bounties.filter((b) => hasP(done, b.q, p.id)).length;
    main.appendChild(h('div', { class: 'muted sm', style: { margin: '4px 2px 10px' } }, 'Avis capturés : ' + S().persos.map((p) => `${p.nom} ${cnt(p)}`).join(' · ') + ` (sur ${O.bounties.length})`),
      progress(Math.max(...S().persos.map(cnt)) / O.bounties.length * 100));
    const list = h('div', { class: 'bx-list' }); main.appendChild(list);
    function draw() {
      clear(list); const q = norm(u.q);
      const rows = O.bounties.filter((b) => (!q || norm(b.n).includes(q)) && (!u.zone || b.sub.includes(u.zone)) && (!u.rw || b.rw.some((r) => String(r[0]) === String(u.rw))) && (!u.hide || !allP(done, b.q)))
        .sort((a, c) => ((O.bosses[a.m] || {}).lvl || a.lv) - ((O.bosses[c.m] || {}).lvl || c.lv) || a.n.localeCompare(c.n));
      if (!rows.length) list.appendChild(h('div', { class: 'card empty muted' }, 'Aucun avis ne correspond.'));
      rows.forEach((b) => list.appendChild(avisCard(b)));
    }
    draw();
  }
  function avisCard(b) {
    const u = U(), O = D_BOSS, done = B().avis, open = !!u.open['a' + b.q], boss = O.bosses[b.m];
    const ok = allP(done, b.q);
    const card = h('div', { class: 'card bx-d' + (ok ? ' ok' : '') });
    card.appendChild(h('div', { class: 'bx-dh', onclick: () => { u.open['a' + b.q] = !open; rerender(); } },
      boss ? monImg(boss.gfx, 'bx-img sm') : h('span', { class: 'bx-img' }, '👹'),
      h('div', { class: 'bx-dt' }, h('b', null, b.n), h('small', { class: 'muted' }, `niv. ${boss ? boss.lvl : b.lv}${b.sub.length ? ' · ' + b.sub.join(', ') : ''}`),
        h('small', { class: 'bx-rw' }, b.rw.map(([id, q]) => h('span', { class: 'bx-k' }, itemIco(id), ' ' + kf(q) + ' ' + ((O.items[id] || {}).n || RW[id] || '')))),
        h('div', { class: 'gwho' }, S().persos.map((p) => h('button', { class: 'gchip' + (hasP(done, b.q, p.id) ? ' on' : ''), title: 'Capturé par ' + p.nom, onclick: (e) => { e.stopPropagation(); togP(done, b.q, p.id); rerender(); } }, (hasP(done, b.q, p.id) ? '✓ ' : '') + p.nom)))),
      h('span', { class: 'bx-chev' }, open ? '▾' : '▸')));
    if (open) {
      const body = h('div', { class: 'bx-body' });
      if (b.desc) body.appendChild(h('p', { class: 'muted sm bx-desc' }, short(b.desc.split('\n')[0], 220)));
      if (boss) body.appendChild(bossCard(boss)); else body.appendChild(h('p', { class: 'muted sm' }, 'Fiche de combat indisponible pour ce criminel.'));
      card.appendChild(body);
    }
    return card;
  }

  Views.boss = (main) => {
    const u = U(); B();
    if (!S().persos.length) { main.appendChild(h('div', { class: 'card empty' }, h('div', { class: 'big' }, '👹'), h('h2', null, 'Crée d\'abord un personnage'), h('p', { class: 'muted' }, 'Pour valider les boss et les avis, il faut au moins un perso.'), h('a', { class: 'btn primary', href: '#/persos' }, 'Créer un perso'))); return; }
    main.appendChild(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Boss & avis'), h('p', { class: 'muted' }, 'Mécaniques des boss de donjon et des criminels recherchés : l\'essentiel, sans le roman.'))));
    const box = h('div', { class: 'card empty' }, h('div', { class: 'big' }, '👹'), h('p', { class: 'muted' }, 'Chargement…')); main.appendChild(box);
    load().then(() => {
      if (!document.body.contains(box)) return; box.remove();
      main.appendChild(tabs([{ k: 'donjons', n: '🏰 Donjons & boss' }, { k: 'avis', n: '🪧 Avis de recherche' }], u.tab, (k) => { u.tab = k; rerender(); }));
      (u.tab === 'avis' ? avis : donjons)(main);
    }).catch(() => { clear(box); box.appendChild(h('p', null, 'Impossible de charger les données des boss.')); });
  };
})();
