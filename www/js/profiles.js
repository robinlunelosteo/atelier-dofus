/* ===== Profils : une aventure = un profil (solo, duo, équipe), avec sa propre progression ===== */
'use strict';
(function () {
  const SERVERS = ['Brial', 'Dathura', 'Draconiros', 'Eratz', 'Henual', 'Hell Mina', 'Imagiro', 'Julith', 'Kourial', 'Mikhal', 'Nidas', 'Ombre', 'Orukam', 'Rafal', 'Salar', 'Tal Kasha', 'Terra Cogita', 'Tylezia'];
  const icon = (n) => (n >= 3 ? '🛡️' : n === 2 ? '👥' : '🧍');
  const sub = (p) => { const n = nPersos(p); return (p.server ? p.server + ' · ' : '') + n + ' perso' + (n > 1 ? 's' : ''); };
  const cur = () => { const st = S(); return st.profiles.find((p) => p.id === st.pid); };
  const nPersos = (p) => (p.id === S().pid ? (S().persos || []).length : (p.n || 0));

  async function switchTo(id) {
    const st = S(); if (id === st.pid) return; const t = st.profiles.find((p) => p.id === id); if (!t) return;
    await Store.switchProfile(id); Views._g = null; location.hash = '#/accueil'; rerender(); refresh();
    toast('Profil : ' + t.name);
  }
  async function create(name, server, persos) {
    const st = S(); const id = 'p' + Date.now().toString(36);
    st.profiles.push({ id, name, server: server || '', n: 0 }); await Store.putProfile(id, { data: {}, sel: {} });
    await switchTo(id); persos.forEach((x) => newPerso(x.nom, x.classe, x.niveau, '')); touch(); rerender(); refresh();
  }
  async function remove(id) {
    const st = S(); if (st.profiles.length < 2) return;
    if (id === st.pid) await switchTo(st.profiles.find((p) => p.id !== id).id);
    st.profiles = st.profiles.filter((p) => p.id !== id); await Store.putProfile(id, { data: {}, sel: {} }); touch(); refresh();
  }

  async function exportProfile(id) {
    const st = S(); const p = st.profiles.find((x) => x.id === id) || cur(); const pd = await Store.profileData(p.id);
    const safe = p.name.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'profil';
    downloadFile('profil-' + safe + '-' + todayStr() + '.json', JSON.stringify({ kind: 'atelier-profil', v: 1, name: p.name, server: p.server || '', data: pd.data, at: new Date().toISOString() }));
    toast('Profil « ' + p.name + ' » exporté');
  }
  async function importProfile(o) {
    if (!o || o.kind !== 'atelier-profil' || !o.data) throw new Error('fichier non reconnu');
    const st = S(); let name = o.name || 'Profil importé'; if (st.profiles.some((x) => x.name === name)) name += ' (importé)';
    const id = 'p' + Date.now().toString(36); st.profiles.push({ id, name, server: o.server || '', n: (o.data.persos || []).length });
    await Store.putProfile(id, { data: o.data, sel: {} }); touch(); await switchTo(id);
  }
  function pickFile(cb) { const inp = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { cb(JSON.parse(t)); } catch (er) { toast('Fichier invalide : ' + er.message, 'warn'); } }); inp.remove(); } }); document.body.appendChild(inp); inp.click(); }
  function chip(where) {
    const p = cur();
    return h('button', { class: 'prof-chip ' + (where || ''), title: 'Changer de profil', onclick: openMgr }, h('span', { class: 'pc-i' }, icon(nPersos(p))), h('span', { class: 'pc-t' }, h('b', null, p.name), h('small', null, sub(p))), h('span', { class: 'pc-d' }, '▾'));
  }
  function refresh() { document.querySelectorAll('.prof-chip').forEach((el) => { const w = el.classList.contains('nav') ? 'nav' : el.classList.contains('home') ? 'home' : ''; el.replaceWith(chip(w)); }); }

  const srvInput = (val) => { const dl = 'srv-list'; if (!document.getElementById(dl)) document.body.appendChild(h('datalist', { id: dl }, SERVERS.map((x) => h('option', { value: x })))); return h('input', { class: 'inp', list: dl, placeholder: 'Serveur (ex. Imagiro)', value: val || '', style: { flex: 1, minWidth: '150px' } }); };
  function editProf(p, done) {
    const nm = h('input', { class: 'inp', value: p.name, style: { width: '100%' } }); const sv = srvInput(p.server);
    const m = modal('Modifier le profil', h('div', null, h('label', { class: 'lbl' }, 'Nom'), nm, h('label', { class: 'lbl', style: { marginTop: '10px' } }, 'Serveur'), sv,
      h('div', { class: 'row end gap', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'), h('button', { class: 'btn primary', onclick: () => { const v = nm.value.trim(); if (!v) return; p.name = v; p.server = sv.value.trim(); touch(); m.close(); refresh(); done && done(); } }, 'Enregistrer'))), { cls: 'small' });
  }
  function openMgr() {
    const body = h('div', { class: 'prof-mgr' }); let m;
    const draw = () => {
      clear(body); const st = S();
      body.appendChild(h('p', { class: 'muted sm' }, 'Chaque profil a ses propres personnages, guides, craft, métiers et suivis : un profil par aventure.'));
      st.profiles.forEach((p) => { const on = p.id === st.pid;
        body.appendChild(h('div', { class: 'prof-row' + (on ? ' on' : '') },
          h('button', { class: 'prof-pick', onclick: () => { m.close(); switchTo(p.id); } }, h('span', { class: 'pc-i' }, icon(nPersos(p))), h('span', { class: 'pc-t' }, h('b', null, p.name), h('small', null, sub(p) + (on ? ' · actif' : '')))),
          h('button', { class: 'btn ghost sm', title: 'Exporter ce profil (fichier de sauvegarde)', onclick: () => exportProfile(p.id) }, '⬇'),
          h('button', { class: 'btn ghost sm', title: 'Modifier le nom et le serveur', onclick: () => editProf(p, draw) }, '✎'),
          st.profiles.length > 1 ? h('button', { class: 'btn ghost sm', title: 'Supprimer', onclick: () => confirmBox('Supprimer le profil « ' + p.name + ' » et toute sa progression ?', () => remove(p.id).then(draw), 'Supprimer') }, '🗑') : null)); });
      body.appendChild(newForm());
      body.appendChild(h('div', { class: 'prof-new' }, h('h4', null, '⬆ Importer un profil'), h('p', { class: 'muted sm' }, 'Charge un fichier exporté depuis un profil : il est ajouté comme un nouveau profil, sans toucher aux autres.'), h('button', { class: 'btn', onclick: () => pickFile((o) => { m.close(); importProfile(o); }) }, 'Choisir un fichier…')));
    };
    function newForm() {
      const nm = h('input', { class: 'inp', placeholder: 'Nom du profil (ex. Duo avec Chloé)', style: { flex: 1, minWidth: '180px' } }); const sv = srvInput('');
      const rows = [{ nom: '', classe: CLASSES[0].id, niveau: 1 }]; const list = h('div', { class: 'prof-persos' });
      const drawRows = () => { clear(list); rows.forEach((r, i) => list.appendChild(h('div', { class: 'prof-prow' },
        h('input', { class: 'inp', placeholder: 'Nom du perso', value: r.nom, style: { flex: 1, minWidth: '110px' }, oninput: (e) => { r.nom = e.target.value; } }),
        h('select', { class: 'inp', onchange: (e) => { r.classe = +e.target.value; } }, CLASSES.map((c) => h('option', { value: c.id, selected: c.id === r.classe }, c.n))),
        h('input', { class: 'inp', type: 'number', min: 1, max: 200, value: r.niveau, title: 'Niveau', style: { width: '70px' }, oninput: (e) => { r.niveau = clampLvl(e.target.value); } }),
        rows.length > 1 ? h('button', { class: 'btn ghost sm', onclick: () => { rows.splice(i, 1); drawRows(); } }, '✕') : null))); };
      const clampLvl = (v) => Math.max(1, Math.min(200, +v || 1));
      drawRows();
      const copyCur = () => { S().persos.forEach((p) => rows.push({ nom: p.nom, classe: p.classe, niveau: p.niveau })); if (rows.length > 1 && !rows[0].nom) rows.shift(); drawRows(); };
      return h('div', { class: 'prof-new' }, h('h4', null, '＋ Nouveau profil'), h('div', { class: 'row gap wrap' }, nm, sv),
        h('div', { class: 'lbl', style: { margin: '12px 0 6px' } }, 'Personnages'), list,
        h('div', { class: 'row gap wrap', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: () => { rows.push({ nom: '', classe: CLASSES[0].id, niveau: 1 }); drawRows(); } }, '＋ Ajouter un perso'),
          S().persos.length ? h('button', { class: 'btn sm', title: 'Copie nom, classe et niveau (sans progression)', onclick: copyCur }, '⧉ Reprendre ceux du profil actuel') : null),
        h('button', { class: 'btn primary', style: { marginTop: '12px' }, onclick: () => { const n = nm.value.trim(); if (!n) { nm.focus(); return; } const ps = rows.filter((r) => r.nom.trim()).map((r) => ({ nom: r.nom.trim(), classe: r.classe, niveau: clampLvl(r.niveau) })); m.close(); create(n, sv.value.trim(), ps); } }, 'Créer et ouvrir'));
    }
    m = modal('👤 Profils', body, {}); draw();
  }
  window.Profiles = { exportProfile, importProfile, pickFile, chip, refresh, switchTo, create, remove, open: openMgr, cur };
})();
