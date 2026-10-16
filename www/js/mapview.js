/* ===== Carte du monde illustrée : tuiles, zoom, déplacement, couches ===== */
'use strict';
const MAPIMG = 'img/map/';
/* Calibration par monde (pixels de l'espace « base » ; case (X,Y) = coin haut-gauche à (ox + X*cw, oy + Y*ch)).
   lo = vue d'ensemble (chunks de 1024 px de l'espace base), hi = détail (chunks de 512 px de l'espace base, image 2x) */
const WORLD_CFG = {
  1: { W: 5632, H: 4608, cw: 1204 / 32, ch: 859 / 32, ox: 3584, oy: 2816, lo: 'w2', hi: 'w3', chunks: window.MAP_CHUNKS || { w2: [], w3: [] },
       hiAt: 0.62, maxS: 4.2, minS: 0.07, over: [-20, 25, -45, 20], start: [2, -4] },
  2: { W: 1536, H: 1792, cw: 1204 / 32 * 4, ch: 859 / 32 * 4, ox: 512, oy: 768, lo: 'i4', hi: 'i5', chunks: window.MAP_CHUNKS2 || { i4: [], i5: [] },
       hiAt: 0.8, maxS: 3.2, minS: 0.2, over: [-3, 5, -6, 1], start: [1, -3] }
};
const WM = WORLD_CFG[1];

function mountWorld(box, opt) {
  opt = opt || {};
  const WM = WORLD_CFG[opt.wm || 1], MAPCH = WM.chunks;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = h('canvas', { class: 'mapcv wcv' });
  const tip = h('div', { class: 'maptip' });
  const zoomBox = h('div', { class: 'mapzoom' },
    h('button', { class: 'mz', title: 'Zoom +', onclick: () => zoomBy(1.5) }, '+'),
    h('button', { class: 'mz', title: 'Zoom −', onclick: () => zoomBy(1 / 1.5) }, '−'),
    h('button', { class: 'mz', title: 'Vue d\'ensemble', onclick: () => API.viewCells(WM.over[0], WM.over[1], WM.over[2], WM.over[3]) }, '⌖'));
  box.appendChild(canvas); box.appendChild(tip); box.appendChild(zoomBox);
  const ctx = canvas.getContext('2d');
  let W = 400, H = 400, s = 1, cx = WM.ox + WM.start[0] * WM.cw, cy = WM.oy + WM.start[1] * WM.ch;
  const API = { layers: [], hover: null, cw: () => WM.cw * s, destroyed: false };
  const minS = () => Math.max(WM.minS, Math.min(W / WM.W, H / WM.H) * 0.9);
  const MAXS = WM.maxS;

  /* ---- images ---- */
  const imgs = new Map(); let tick = 0;
  function getImg(name) {
    let e = imgs.get(name);
    if (!e) {
      e = { im: new Image(), ok: false, t: 0 };
      e.im.onload = () => { e.ok = true; API.draw(); };
      e.im.onerror = () => { e.bad = true; };
      e.im.src = MAPIMG + name + '.webp';
      imgs.set(name, e);
    }
    e.t = ++tick;
    return e.ok ? e.im : null;
  }
  function evict() {
    const loaded = [...imgs.entries()].filter(([n, e]) => n.startsWith(WM.hi + '_') && e.ok);
    if (loaded.length <= 14) return;
    loaded.sort((a, b) => a[1].t - b[1].t).slice(0, loaded.length - 14).forEach(([n, e]) => { e.im.src = ''; imgs.delete(n); });
  }

  /* ---- conversions ---- */
  const toScr = (px, py) => [(px - cx) * s + W / 2, (py - cy) * s + H / 2];
  const toWld = (sx, sy) => [(sx - W / 2) / s + cx, (sy - H / 2) / s + cy];
  API.cellRect = (X, Y) => { const [a, b] = toScr(WM.ox + X * WM.cw, WM.oy + Y * WM.ch); return [a, b, WM.cw * s, WM.ch * s]; };
  API.cellAt = (sx, sy) => { const [px, py] = toWld(sx, sy); return [Math.floor((px - WM.ox) / WM.cw), Math.floor((py - WM.oy) / WM.ch)]; };
  API.cellCenter = (X, Y) => { const r = API.cellRect(X, Y); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; };
  API.visible = () => { const a = API.cellAt(0, 0), b = API.cellAt(W, H); return [a[0] - 1, b[0] + 1, a[1] - 1, b[1] + 1]; };
  API.size = () => [W, H];

  /* ---- dessin ---- */
  let raf = 0;
  API.draw = () => { if (raf || API.destroyed) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); };
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a1018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const k = dpr * s, ox = dpr * (W / 2 - cx * s), oy = dpr * (H / 2 - cy * s);
    const vx0 = cx - W / 2 / s, vx1 = cx + W / 2 / s, vy0 = cy - H / 2 / s, vy1 = cy + H / 2 / s;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    // fond : vue d'ensemble
    (MAPCH[WM.lo] || []).forEach(([i, j]) => {
      const x = i * 1024, y = j * 1024;
      if (x > vx1 || y > vy1 || x + 1024 < vx0 || y + 1024 < vy0) return;
      const im = getImg(WM.lo + '_' + i + '_' + j); if (im) ctx.drawImage(im, x, y, im.width + 0.6, im.height + 0.6);
    });
    // détail
    if (s >= WM.hiAt) {
      (MAPCH[WM.hi] || []).forEach(([i, j]) => {
        const x = i * 512, y = j * 512;
        if (x > vx1 || y > vy1 || x + 512 < vx0 || y + 512 < vy0) return;
        const im = getImg(WM.hi + '_' + i + '_' + j); if (im) ctx.drawImage(im, x, y, im.width / 2 + 0.6, im.height / 2 + 0.6);
      });
      evict();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cwp = WM.cw * s;
    const [X0, X1, Y0, Y1] = API.visible();
    if (cwp >= 34) {
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let X = X0; X <= X1 + 1; X++) { const [a, b] = API.cellRect(X, Y0); ctx.moveTo(Math.round(a) + .5, 0); ctx.lineTo(Math.round(a) + .5, H); }
      for (let Y = Y0; Y <= Y1 + 1; Y++) { const [a, b] = API.cellRect(X0, Y); ctx.moveTo(0, Math.round(b) + .5); ctx.lineTo(W, Math.round(b) + .5); }
      ctx.stroke();
      if (cwp >= 80) {
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        for (let X = X0; X <= X1; X++) for (let Y = Y0; Y <= Y1; Y++) { const r = API.cellRect(X, Y); ctx.fillText(X + ',' + Y, r[0] + 3, r[1] + 2); }
      }
    }
    API.layers.forEach((fn) => fn(ctx, API));
    if (API.hover) {
      const r = API.cellRect(API.hover[0], API.hover[1]);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(255,200,80,.8)'; ctx.shadowBlur = 8; ctx.strokeRect(r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2); ctx.shadowBlur = 0;
    }
  }

  /* ---- vue ---- */
  function clampView() {
    s = Math.max(minS(), Math.min(MAXS, s));
    cx = Math.max(0, Math.min(WM.W, cx)); cy = Math.max(0, Math.min(WM.H, cy));
  }
  function zoomAt(f, sx, sy) {
    const [wx, wy] = toWld(sx, sy); s = Math.max(minS(), Math.min(MAXS, s * f));
    cx = wx - (sx - W / 2) / s; cy = wy - (sy - H / 2) / s; clampView(); API.draw();
  }
  function zoomBy(f) { zoomAt(f, W / 2, H / 2); }
  API.view = (X, Y, cellPx) => { cx = WM.ox + (X + 0.5) * WM.cw; cy = WM.oy + (Y + 0.5) * WM.ch; if (cellPx) s = cellPx / WM.cw; clampView(); API.draw(); };
  API.viewCells = (x0, x1, y0, y1) => {
    const w = (x1 - x0 + 1) * WM.cw, hh = (y1 - y0 + 1) * WM.ch; s = Math.min(W / w, H / hh) * 0.92;
    cx = WM.ox + (x0 + x1 + 1) / 2 * WM.cw; cy = WM.oy + (y0 + y1 + 1) / 2 * WM.ch; clampView(); API.draw();
  };

  /* ---- interactions ---- */
  const ptr = new Map(); let moved = 0, pinch0 = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (ptr.has(e.pointerId)) {
      const p = ptr.get(e.pointerId);
      if (ptr.size === 1) { const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); cx -= dx / s; cy -= dy / s; clampView(); API.draw(); }
      else if (ptr.size === 2 && pinch0) {
        ptr.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...ptr.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        moved += 10; const mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top; zoomAt(Math.max(.2, Math.min(5, pinch0.s * d / pinch0.d)) / s, mx, my); return;
      }
      ptr.set(e.pointerId, [e.clientX, e.clientY]);
    }
    hoverAt(sx, sy, e.pointerType === 'mouse' || !ptr.size);
  });
  const up = (e) => {
    const r = canvas.getBoundingClientRect();
    if (ptr.size === 1 && moved < 6 && ptr.has(e.pointerId)) { const c = API.cellAt(e.clientX - r.left, e.clientY - r.top); opt.onClick && opt.onClick(c, e); }
    ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { ptr.delete(e.pointerId); pinch0 = null; });
  canvas.addEventListener('pointerleave', () => { if (!ptr.size) { API.hover = null; tip.style.display = 'none'; opt.onHover && opt.onHover(null); API.draw(); } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const r = canvas.getBoundingClientRect();
    zoomAt(Math.pow(1.0017, -e.deltaY * (e.deltaMode === 1 ? 16 : 1)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => { const r = canvas.getBoundingClientRect(); zoomAt(1.8, e.clientX - r.left, e.clientY - r.top); });
  function hoverAt(sx, sy, showTip) {
    const c = API.cellAt(sx, sy);
    if (!API.hover || API.hover[0] !== c[0] || API.hover[1] !== c[1]) { API.hover = c; API.draw(); opt.onHover && opt.onHover(c); }
    const t = showTip && opt.tip ? opt.tip(c) : null;
    if (t) { clear(tip); tip.appendChild(typeof t === 'string' ? document.createTextNode(t) : t); tip.style.display = 'block'; tip.style.left = Math.min(W - 230, sx + 16) + 'px'; tip.style.top = Math.max(4, Math.min(H - 80, sy + 12)) + 'px'; }
    else tip.style.display = 'none';
  }

  /* ---- taille ---- */
  const ro = new ResizeObserver(() => {
    const r = box.getBoundingClientRect(); W = Math.max(200, Math.floor(r.width)); H = Math.max(200, Math.floor(r.height));
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    clampView(); API.draw();
  });
  ro.observe(box);
  API.wm = opt.wm || 1;
  API.destroy = () => { API.destroyed = true; ro.disconnect(); imgs.forEach((e) => { e.im.src = ''; }); imgs.clear(); };
  if (opt.view) API.view(opt.view[0], opt.view[1], opt.view[2]);
  setTimeout(() => { const r = box.getBoundingClientRect(); W = Math.max(200, Math.floor(r.width)); H = Math.max(200, Math.floor(r.height)); canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; if (opt.view) API.view(opt.view[0], opt.view[1], opt.view[2]); else if (opt.fit) API.viewCells(opt.fit[0], opt.fit[1], opt.fit[2], opt.fit[3]); API.draw(); }, 0);
  return API;
}
