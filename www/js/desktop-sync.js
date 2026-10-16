/* ===== Synchronisation entre appareils via un dépôt GitHub PRIVÉ (version installée / hors artifact) =====
   Branche l'interface « claude.use('db') » attendue par Store sur l'API GitHub. N'agit que si un dépôt + jeton sont réglés. */
(function () {
  'use strict';
  if (window.claude) return;                       // version en ligne : le vrai stockage cloud existe déjà
  const KEY = 'atelier-sync';
  const conf = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.repo && c.token ? c : null; } catch (e) { return null; } };
  const API = window.ATELIER_API || 'https://api.github.com';
  const b64 = (s) => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
  const unb64 = (b) => { const bin = atob(b.replace(/\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
  const hdr = (c) => ({ Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  const url = (c, p) => API + '/repos/' + c.repo + '/contents/data/' + p.split('/').map(encodeURIComponent).join('/') + '.json';

  const sha = new Map();        // chemin -> sha du fichier connu
  const pending = new Map();    // chemin -> texte JSON à envoyer
  let timer = null, busy = Promise.resolve();
  const state = { last: null, err: null };
  const note = (ok, msg) => { state.last = Date.now(); state.err = ok ? null : msg; try { if (window.Store && Store.status) Store.status(ok ? 'Synchronisé' : 'Synchro impossible'); } catch (e) { /* rien */ } };

  async function getRemote(c, p) {
    const r = await fetch(url(c, p), { headers: hdr(c), cache: 'no-store' });
    if (r.status === 404) { sha.delete(p); return null; }
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json(); sha.set(p, j.sha);
    return j.content ? unb64(j.content) : null;
  }
  async function putRemote(c, p, txt, keep) {
    const body = () => JSON.stringify({ message: 'sync ' + p, content: b64(txt), sha: sha.get(p) || undefined });
    let r = await fetch(url(c, p), { method: 'PUT', headers: hdr(c), body: body(), keepalive: !!keep && txt.length < 40000 });
    if (r.status === 409 || r.status === 422) {                       // sha périmé : on relit et on réessaie une fois
      await getRemote(c, p).catch(() => {}); r = await fetch(url(c, p), { method: 'PUT', headers: hdr(c), body: body() });
    }
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json(); if (j.content && j.content.sha) sha.set(p, j.content.sha);
  }
  function flush(keep) {
    clearTimeout(timer); timer = null; const c = conf(); if (!c || !pending.size) return busy;
    const batch = [...pending.entries()]; pending.clear();
    busy = busy.then(async () => {
      try { for (const [p, txt] of batch) await putRemote(c, p, txt, keep); note(true); }
      catch (e) { batch.forEach(([p, t]) => { if (!pending.has(p)) pending.set(p, t); }); note(false, String(e.message || e)); }
    });
    return busy;
  }
  const schedule = () => { if (!timer) timer = setTimeout(() => flush(false), 4000); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
  window.addEventListener('pagehide', () => flush(true));

  function makeDb() {
    const c = conf(); if (!c) return null;
    return { doc: (p) => ({
      async get() {
        if (pending.has(p)) { const t = pending.get(p); return { exists: true, data: () => JSON.parse(t) }; }
        const txt = await getRemote(c, p); return txt ? { exists: true, data: () => JSON.parse(txt) } : { exists: false, data: () => null };
      },
      async set(obj) { pending.set(p, JSON.stringify(obj)); schedule(); },
    }) };
  }
  window.claude = { use: async (n) => (n === 'db' ? makeDb() : null) };

  /* API pour la page Paramètres */
  window.AtelierSync = {
    get: conf, state,
    save(repo, token) { localStorage.setItem(KEY, JSON.stringify({ repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''), token: token.trim() })); },
    clear() { localStorage.removeItem(KEY); },
    flush,
    async test() {
      const c = conf(); if (!c) throw new Error('Renseigne le dépôt et le jeton.');
      const r = await fetch(API + '/repos/' + c.repo, { headers: hdr(c), cache: 'no-store' });
      if (r.status === 404) throw new Error('Dépôt introuvable (ou jeton sans accès à ce dépôt).');
      if (r.status === 401) throw new Error('Jeton refusé.');
      if (!r.ok) throw new Error('GitHub ' + r.status);
      const j = await r.json();
      if (!j.private) throw new Error('Ce dépôt est PUBLIC : tes données seraient visibles de tous. Utilise un dépôt privé.');
      if (j.permissions && !j.permissions.push) throw new Error('Le jeton n\'a pas le droit d\'écrire dans ce dépôt (Contents : Read and write).');
      const has = !!(await getRemote(c, 'app/idx').catch(() => null));
      return { repo: j.full_name, hasData: has };
    },
  };
})();
