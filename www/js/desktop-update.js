/* ===== Mise à jour en un clic (appli installée uniquement : l'enveloppe Electron expose window.atelierApp) ===== */
(function () {
  'use strict';
  const A = window.atelierApp; if (!A) return;
  let ver = '', avail = null, busy = false;
  const css = document.createElement('style');
  css.textContent = '.upd{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.upd button{width:100%;border:0;border-radius:10px;padding:9px 12px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;background:var(--gold);color:#1a1205;box-shadow:0 0 0 0 var(--glow);animation:updp 2.4s infinite}.upd button[disabled]{opacity:.7;cursor:default;animation:none}.upd small{color:var(--muted);text-align:center;font-size:11px}@keyframes updp{50%{box-shadow:0 0 0 6px transparent}}';
  document.head.appendChild(css);
  const box = document.createElement('div'); box.className = 'upd';
  function draw() {
    box.textContent = '';
    if (avail) {
      const b = document.createElement('button');
      b.textContent = busy ? 'Mise à jour en cours…' : '⬆ Mettre à jour vers ' + avail.version; b.disabled = busy; b.title = avail.notes || '';
      b.onclick = () => { busy = true; draw(); A.install().catch(() => { busy = false; draw(); window.toast && toast('Mise à jour impossible — vérifie ta connexion', 'warn'); }); };
      box.appendChild(b);
    }
    const s = document.createElement('small'); s.textContent = 'Version ' + ver; s.style.cursor = 'pointer'; s.title = 'Rechercher une mise à jour';
    s.onclick = () => A.check().then((r) => { if (!r) window.toast && toast('Impossible de vérifier (connexion ?)', 'warn'); else if (!r.version) window.toast && toast('Atelier Dofus est à jour'); });
    box.appendChild(s);
  }
  function mount() { const f = document.querySelector('.nav-foot'); if (!f) return false; if (!box.isConnected) f.insertBefore(box, f.firstChild); return true; }
  A.onUpdate((m) => { avail = m && m.version ? m : null; draw(); });
  A.onProgress((i, n) => { const b = box.querySelector('button'); if (b) b.textContent = 'Mise à jour… ' + Math.round(i / n * 100) + ' %'; });
  A.info().then((v) => { ver = v; draw(); });
  const t = setInterval(() => { if (mount()) { draw(); } }, 500); setTimeout(() => clearInterval(t), 30000);
  new MutationObserver(() => { if (!box.isConnected) mount(); }).observe(document.body, { childList: true, subtree: true });
})();
