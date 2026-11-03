'use strict';
/* ============================================================
 *  Yükseliş — çizim katmanı (Canvas 2D)
 * ============================================================ */

const Cam = { x: WORLD_W * CW / 2, y: -FH * 3, z: 1.5 };
const View = { mode: 'normal', ghost: null, selected: null, hoverCell: null };
let cv, ctx, VW = 0, VH = 0, DPR = 1;

function initRender(canvas) {
  cv = canvas;
  ctx = cv.getContext('2d');
  resize();
  addEventListener('resize', resize);
  genScenery();
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
const screenToWorld = (sx, sy) => ({ wx: (sx - VW / 2) / Cam.z + Cam.x, wy: (sy - VH / 2) / Cam.z + Cam.y });
const worldToScreen = (wx, wy) => ({ sx: (wx - Cam.x) * Cam.z + VW / 2, sy: (wy - Cam.y) * Cam.z + VH / 2 });
function setWorld() { ctx.setTransform(DPR * Cam.z, 0, 0, DPR * Cam.z, DPR * (VW / 2 - Cam.x * Cam.z), DPR * (VH / 2 - Cam.y * Cam.z)); }
function setScreen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }

/* ---------- renk yardımcıları ---------- */
const _rgb = {};
function C(h) {
  if (_rgb[h]) return _rgb[h];
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s, 16);
  return (_rgb[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (h1, h2, t) => rgba(mixRGB(C(h1), C(h2), t));
const smooth = t => t * t * (3 - 2 * t);

/* ---------- gökyüzü ---------- */
const SKY = [
  [0, '#060a1c', '#151c44'], [4.5, '#091031', '#222759'], [6, '#3b4f8f', '#f3a77d'],
  [7.5, '#4b8fe0', '#bfe0ff'], [12, '#3a83e0', '#c8e8ff'], [17, '#4b7fd6', '#f5d7a6'],
  [19, '#3a3f86', '#f0855a'], [20.5, '#141a40', '#3a2f63'], [24, '#060a1c', '#151c44'],
];
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      return [mixRGB(C(a[1]), C(b[1]), t), mixRGB(C(a[2]), C(b[2]), t)];
    }
  }
  return [C(SKY[0][1]), C(SKY[0][2])];
}
function daylight(h) {
  if (h < 5 || h > 20.5) return 0;
  if (h < 7.5) return smooth((h - 5) / 2.5);
  if (h > 18) return smooth(1 - (h - 18) / 2.5);
  return 1;
}

/* ---------- sahne dekoru ---------- */
const Scn = { stars: [], clouds: [], far: [], near: [], trees: [], traffic: [], lamps: [] };
const SKY_P = 6000;
function genScenery() {
  for (let i = 0; i < 200; i++) Scn.stars.push({ x: Math.random(), y: Math.random() * 0.8, r: rng(0.4, 1.5), p: Math.random() * 6 });
  for (let i = 0; i < 11; i++) Scn.clouds.push({ x: Math.random() * 3000, y: rng(0.05, 0.45), s: rng(0.6, 1.7), v: rng(5, 14) });
  const mk = (arr, hMin, hMax, wMin, wMax, win) => {
    let x = 0;
    while (x < SKY_P) {
      const w = rng(wMin, wMax), h = rng(hMin, hMax);
      const b = { x, w, h, roof: Math.random(), wins: [] };
      if (win) {
        for (let wy = 10; wy < h - 8; wy += 13) for (let wx = 6; wx < w - 6; wx += 10) {
          if (Math.random() < 0.28) b.wins.push(wx, wy, Math.random() < 0.15 ? 1 : 0);
        }
      }
      arr.push(b);
      x += w + rng(4, 30);
    }
  };
  mk(Scn.far, 120, 520, 50, 130, false);
  mk(Scn.near, 60, 300, 40, 100, true);
  for (let x = -1400; x < WORLD_W * CW + 1400; x += rng(40, 90)) Scn.trees.push({ x, s: rng(0.8, 1.3), k: Math.random() });
  for (let x = -1400; x < WORLD_W * CW + 1400; x += 150) Scn.lamps.push(x);
  const carCols = ['#e63946', '#f1faee', '#457b9d', '#ffb703', '#2a9d8f', '#8d99ae', '#ef476f', '#222'];
  for (let i = 0; i < 12; i++) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    Scn.traffic.push({ x: rng(-1400, WORLD_W * CW + 1400), dir, v: rng(60, 120), c: pick(carCols), lane: dir > 0 ? 0 : 1 });
  }
}

/* ---------- açık/kapalı ---------- */
function isOpen(r, h, weekend) {
  switch (r.type) {
    case 'restaurant': return h >= 11 && h < 22;
    case 'shop': return h >= 10 && h < 21;
    case 'cinema': return h >= 13 || h < 1;
    case 'office': return !weekend && h >= 8 && h < 19 && r.tenant;
    default: return false;
  }
}

/* ---------- ana çizim ---------- */
let lastFrame = performance.now();
function render() {
  const now = performance.now();
  const rdt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const h = S.time / 60;
  const env = { h, day: daylight(h), weekend: S.day % 7 >= 5, t: now / 1000 };
  env.night = 1 - env.day;

  setScreen();
  drawSky(env);
  drawBackdrop(env, rdt);

  setWorld();
  const wx0 = Cam.x - VW / 2 / Cam.z, wx1 = Cam.x + VW / 2 / Cam.z;
  const wy0 = Cam.y - VH / 2 / Cam.z, wy1 = Cam.y + VH / 2 / Cam.z;
  const fTop = Math.floor(-wy0 / FH), fBot = Math.floor(-wy1 / FH);
  const vis = { x0: wx0 / CW - 1, x1: wx1 / CW + 1, f0: Math.max(MIN_FLOOR, fBot), f1: Math.min(MAX_FLOOR, fTop) };

  drawGround(env, wx0, wx1, wy1);
  drawStreet(env, wx0, wx1, rdt);

  const labels = [];
  const cache = roomColorCache(env);
  const objs = Object.values(S.objects);
  for (const o of objs) {
    if (o.kind !== 'room' || o.x + o.w < vis.x0 || o.x > vis.x1 || o.f < vis.f0 || o.f > vis.f1) continue;
    drawRoom(o, env, cache, labels);
  }
  for (const o of objs) {
    if (o.kind !== 'shaft' || o.x + o.w < vis.x0 || o.x > vis.x1 || o.top < vis.f0 || o.bottom > vis.f1) continue;
    drawShaft(o, env, vis, labels);
  }
  drawPeople(vis);
  drawGhost();
  drawSelection();

  setScreen();
  drawLabels(labels);
  drawFloorGutter(vis);
}

function drawSky(env) {
  const [top, bot] = skyAt(env.h);
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, rgba(top)); g.addColorStop(1, rgba(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);

  if (env.night > 0.05) {
    ctx.fillStyle = '#fff';
    for (const s of Scn.stars) {
      const tw = 0.6 + 0.4 * Math.sin(env.t * 2 + s.p);
      ctx.globalAlpha = env.night * tw * 0.9;
      ctx.fillRect(s.x * VW, s.y * VH, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }
  // güneş / ay
  const h = env.h;
  let body = null;
  if (h >= 5.5 && h <= 19.5) body = { t: (h - 5.5) / 14, sun: true };
  else body = { t: ((h + 24 - 19.5) % 24) / 10, sun: false };
  if (body.t >= 0 && body.t <= 1) {
    const x = VW * (0.08 + 0.84 * body.t);
    const y = VH * 0.62 - Math.sin(Math.PI * body.t) * VH * 0.5;
    const R0 = body.sun ? 26 : 18;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, R0 * 5);
    glow.addColorStop(0, body.sun ? 'rgba(255,230,160,0.55)' : 'rgba(200,215,255,0.25)');
    glow.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - R0 * 5, y - R0 * 5, R0 * 10, R0 * 10);
    ctx.fillStyle = body.sun ? '#fff3c4' : '#e9eefc';
    ctx.beginPath(); ctx.arc(x, y, R0, 0, 7); ctx.fill();
    if (!body.sun) {
      ctx.fillStyle = rgba(skyAt(h)[0]);
      ctx.beginPath(); ctx.arc(x + 7, y - 4, R0 * 0.85, 0, 7); ctx.fill();
    }
  }
}

function drawBackdrop(env, rdt) {
  const gy = worldToScreen(0, 0).sy;
  // bulutlar
  const cloudCol = rgba(mixRGB(C('#3a4170'), C('#ffffff'), env.day), 0.55 + env.day * 0.3);
  ctx.fillStyle = cloudCol;
  for (const c of Scn.clouds) {
    c.x += c.v * rdt * (S.speed ? 1 : 0.2);
    const w = 3000 + VW;
    const x = ((c.x - Cam.x * 0.08) % w + w) % w - 300;
    const y = c.y * VH + (gy - VH) * 0.04;
    const s = c.s * 34;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 2.2, s * 0.6, 0, 0, 7);
    ctx.ellipse(x - s, y + 4, s * 1.2, s * 0.5, 0, 0, 7);
    ctx.ellipse(x + s * 0.6, y - s * 0.35, s * 1.1, s * 0.6, 0, 0, 7);
    ctx.fill();
  }
  // şehir silüeti
  const layer = (arr, p, colDay, colNight, sc, alpha) => {
    const col = rgba(mixRGB(C(colNight), C(colDay), env.day), alpha);
    const z = Cam.z * sc;
    const off = Cam.x * p;
    const by = VH / 2 + (0 - Cam.y) * Cam.z * (0.4 + p * 0.6);
    if (by < -50) return;
    ctx.fillStyle = col;
    const span = SKY_P;
    for (const b of arr) {
      const bx = (((b.x - off) % span) + span) % span - span / 2;
      const sx = bx * z + VW / 2;
      const w = b.w * z, hh = b.h * z;
      if (sx + w < 0 || sx > VW) continue;
      ctx.fillRect(sx, by - hh, w, hh + VH);
      if (b.roof > 0.7) ctx.fillRect(sx + w * 0.4, by - hh - 14 * z, w * 0.2, 14 * z);
      if (b.roof > 0.9) ctx.fillRect(sx + w * 0.48, by - hh - 34 * z, 1.5, 22 * z);
    }
    return { off, by, z, span };
  };
  layer(Scn.far, 0.15, '#9fb6d8', '#141a36', 0.7, 0.8);
  const L = layer(Scn.near, 0.35, '#7d93b5', '#0f1430', 0.9, 0.95);
  if (L && env.night > 0.1) {
    ctx.fillStyle = `rgba(255,214,140,${0.85 * env.night})`;
    for (const b of Scn.near) {
      const bx = (((b.x - L.off) % L.span) + L.span) % L.span - L.span / 2;
      const sx = bx * L.z + VW / 2;
      if (sx + b.w * L.z < 0 || sx > VW) continue;
      const top = L.by - b.h * L.z;
      for (let i = 0; i < b.wins.length; i += 3) {
        ctx.fillRect(sx + b.wins[i] * L.z, top + b.wins[i + 1] * L.z, 4 * L.z, 5 * L.z);
      }
    }
  }
}

function drawGround(env, wx0, wx1, wy1) {
  if (wy1 < -10) return;
  const x0 = wx0 - 10, w = wx1 - wx0 + 20;
  // kaldırım
  ctx.fillStyle = mix('#2a2f3a', '#9aa3ae', env.day * 0.8 + 0.2);
  ctx.fillRect(x0, -2, w, 4);
  // toprak
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(60, -MIN_FLOOR * FH + 60));
  g.addColorStop(0, mix('#2b2118', '#6d5440', env.day * 0.7 + 0.3));
  g.addColorStop(1, mix('#120d09', '#2e2219', env.day * 0.7 + 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(x0, 2, w, Math.max(wy1, 100));
  // katmanlar
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 40; y < wy1; y += 70) ctx.fillRect(x0, y, w, 2);
}

function drawStreet(env, wx0, wx1, rdt) {
  // ağaçlar ve lambalar (kulenin arkasında)
  const leaf = mix('#173323', '#3d9a5c', env.day * 0.8 + 0.2);
  const leaf2 = mix('#10261a', '#2f7d49', env.day * 0.8 + 0.2);
  for (const t of Scn.trees) {
    if (t.x < wx0 - 40 || t.x > wx1 + 40) continue;
    const s = t.s;
    ctx.fillStyle = '#4a3726';
    ctx.fillRect(t.x - 1.5 * s, -14 * s, 3 * s, 14 * s);
    ctx.fillStyle = t.k > 0.5 ? leaf : leaf2;
    ctx.beginPath();
    ctx.arc(t.x, -20 * s, 9 * s, 0, 7);
    ctx.arc(t.x - 6 * s, -15 * s, 6 * s, 0, 7);
    ctx.arc(t.x + 6 * s, -15 * s, 6 * s, 0, 7);
    ctx.fill();
  }
  for (const x of Scn.lamps) {
    if (x < wx0 - 40 || x > wx1 + 40) continue;
    ctx.fillStyle = '#39404d';
    ctx.fillRect(x - 0.8, -30, 1.6, 30);
    ctx.fillRect(x - 0.8, -30, 7, 1.6);
    if (env.night > 0.2) {
      const g = ctx.createRadialGradient(x + 6, -28, 0, x + 6, -28, 26);
      g.addColorStop(0, `rgba(255,220,150,${0.6 * env.night})`);
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 20, -54, 52, 54);
    }
  }
  // trafik
  const xMin = -1400, xMax = WORLD_W * CW + 1400;
  for (const c of Scn.traffic) {
    c.x += c.dir * c.v * rdt * (S.speed ? 1 : 0);
    if (c.x > xMax) c.x = xMin; if (c.x < xMin) c.x = xMax;
    if (c.x < wx0 - 40 || c.x > wx1 + 40) continue;
    const y = c.lane ? -1 : -0.5;
    ctx.fillStyle = c.c;
    ctx.beginPath(); ctx.roundRect(c.x - 11, y - 7, 22, 5, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(c.x - 6, y - 11, 12, 5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.8)';
    ctx.fillRect(c.x - 4.5, y - 10, 9, 3);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(c.x - 6, y - 1.5, 2, 0, 7); ctx.arc(c.x + 6, y - 1.5, 2, 0, 7); ctx.fill();
    if (env.night > 0.3) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.fillRect(c.dir > 0 ? c.x + 10 : c.x - 12, y - 6, 2, 2);
      const g = ctx.createLinearGradient(c.x, 0, c.x + c.dir * 40, 0);
      g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(c.x + c.dir * 11, y - 5); ctx.lineTo(c.x + c.dir * 45, y - 10); ctx.lineTo(c.x + c.dir * 45, y); ctx.fill();
    }
  }
}

/* ---------- odalar ---------- */
function roomColorCache(env) {
  const out = {};
  for (const k in TYPES) {
    const c = C(TYPES[k].color);
    const day = mixRGB(c, [255, 255, 255], 0.76);
    const litN = mixRGB(c, C('#ffdca0'), 0.62);
    const darkN = mixRGB(c, C('#0a0e1a'), 0.84);
    out[k] = {
      lit: rgba(mixRGB(litN, day, env.day)),
      dark: rgba(mixRGB(darkN, mixRGB(day, [120, 130, 150], 0.3), env.day)),
      furn: rgba(mixRGB(c, C('#1a2030'), 0.55)),
      acc: TYPES[k].color,
    };
  }
  return out;
}

function vacantOf(r) {
  if (r.type === 'office' || r.type === 'apartment') return !r.tenant;
  if (r.type === 'hotel' || r.type === 'suite') return !r.guest;
  return false;
}

function drawRoom(r, env, cache, labels) {
  const T = TYPES[r.type];
  const X = r.x * CW, Y = -(r.f + 1) * FH, W = r.w * CW, H = FH;
  const cc = cache[r.type];
  const vacant = vacantOf(r);
  const open = isOpen(r, env.h, env.weekend);
  const lit = !vacant && (r.present > 0 || r.type === 'lobby' || r.type === 'stairs' || open);

  ctx.fillStyle = lit ? cc.lit : cc.dark;
  ctx.fillRect(X, Y, W, H);
  if (lit && env.night > 0.1) {
    const g = ctx.createLinearGradient(0, Y, 0, Y + H);
    g.addColorStop(0, `rgba(255,230,170,${0.35 * env.night})`);
    g.addColorStop(0.5, 'rgba(255,230,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(X, Y, W, H);
  }

  ctx.save();
  ctx.translate(X, Y);
  if (Cam.z > 0.45) drawFurniture(r, W, H, cc, lit, env);
  if (Cam.z > 0.45) drawOccupants(r, W, H);
  ctx.restore();

  // cam yansıması
  ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.06 * env.day})`;
  ctx.beginPath();
  ctx.moveTo(X + W * 0.15, Y); ctx.lineTo(X + W * 0.35, Y); ctx.lineTo(X + W * 0.15, Y + H); ctx.lineTo(X, Y + H); ctx.lineTo(X, Y + H * 0.7);
  ctx.closePath(); ctx.fill();
  // kayıtlar
  if (r.type !== 'stairs') {
    ctx.fillStyle = 'rgba(14,20,32,0.45)';
    for (let i = 3; i < r.w; i += 3) ctx.fillRect(X + i * CW - 0.6, Y + 2, 1.2, H - 5);
  }
  if (vacant) {
    ctx.fillStyle = 'rgba(16,20,32,0.38)';
    ctx.fillRect(X, Y, W, H);
  }
  // döşeme ve tavan
  ctx.fillStyle = '#2a3242';
  ctx.fillRect(X, Y + H - 3, W, 3);
  ctx.fillStyle = '#4c566a';
  ctx.fillRect(X, Y, W, 1.6);
  ctx.fillStyle = cc.acc;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(X, Y + H - 3.6, W, 0.9);
  ctx.globalAlpha = 1;
  // yan duvarlar
  ctx.fillStyle = 'rgba(20,26,38,0.8)';
  ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);

  // veri katmanı
  if (View.mode !== 'normal' && r.type !== 'stairs' && r.type !== 'lobby') {
    let v = null;
    if (View.mode === 'stress') v = clamp(r.avgStress / 60, 0, 1);
    else if (View.mode === 'income') v = 1 - clamp((r.lastIncome || r.todayIncome) / 1500, 0, 1);
    else if (View.mode === 'occupancy') v = vacant ? 1 : 0;
    if (v !== null) {
      const col = v < 0.5 ? mixRGB(C('#2ecc71'), C('#f1c40f'), v * 2) : mixRGB(C('#f1c40f'), C('#e74c3c'), (v - 0.5) * 2);
      ctx.fillStyle = rgba(col, 0.55);
      ctx.fillRect(X, Y, W, H);
    }
  }

  if (Cam.z > 0.75) {
    if (r.noAccess && vacant) labels.push({ wx: X + W / 2, wy: Y + H / 2, text: '⚠ Ulaşım yok', kind: 'warn' });
    else if (vacant && (r.type === 'office' || r.type === 'apartment')) labels.push({ wx: X + W / 2, wy: Y + H / 2, text: 'KİRALIK', kind: 'tag' });
    if (View.mode === 'stress' && r.avgStress > 0 && r.type !== 'stairs' && r.type !== 'lobby') labels.push({ wx: X + W / 2, wy: Y + 10, text: Math.round(r.avgStress) + '', kind: 'num' });
  }
}

function person(x, y, col, s = 1) {
  ctx.fillStyle = '#1b2230';
  ctx.fillRect(x - 1.5 * s, y - 5 * s, 1.2 * s, 5 * s);
  ctx.fillRect(x + 0.3 * s, y - 5 * s, 1.2 * s, 5 * s);
  ctx.fillStyle = col;
  ctx.fillRect(x - 2 * s, y - 11 * s, 4 * s, 6.5 * s);
  ctx.fillStyle = '#f0cba8';
  ctx.beginPath(); ctx.arc(x, y - 13 * s, 2 * s, 0, 7); ctx.fill();
}

function drawOccupants(r, W, H) {
  const n = r.present;
  if (n <= 0 || r.type === 'lobby' || r.type === 'stairs') return;
  const slots = Math.max(1, Math.floor(W / 9));
  const k = Math.min(n, slots);
  const cls = r.type === 'office' ? CLS_COLORS.office : r.type === 'apartment' ? CLS_COLORS.resident :
    (r.type === 'hotel' || r.type === 'suite') ? CLS_COLORS.guest : CLS_COLORS.visitor;
  for (let i = 0; i < k; i++) {
    const x = ((i * 0.618 * slots) % slots + 0.5) * (W / slots);
    person(x, H - 3, cls[(i + r.id) % cls.length], 0.9);
  }
}

function drawFurniture(r, W, H, cc, lit, env) {
  const fl = H - 3; // zemin çizgisi
  const f = cc.furn;
  switch (r.type) {
    case 'office':
      for (let m = 0; m + 30 <= W; m += 36) {
        ctx.fillStyle = f;
        ctx.fillRect(m + 6, fl - 12, 24, 2.5);
        ctx.fillRect(m + 8, fl - 10, 1.5, 10); ctx.fillRect(m + 27, fl - 10, 1.5, 10);
        ctx.fillStyle = '#222b3a';
        ctx.fillRect(m + 14, fl - 21, 10, 8);
        ctx.fillStyle = lit ? '#8fd8ff' : '#2d3748';
        ctx.fillRect(m + 15, fl - 20, 8, 6);
        ctx.fillStyle = '#222b3a';
        ctx.fillRect(m + 18, fl - 13, 2, 1.5);
      }
      ctx.fillStyle = '#2f8f57';
      ctx.beginPath(); ctx.arc(W - 5, fl - 10, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a5a3c'; ctx.fillRect(W - 7, fl - 7, 4, 7);
      break;
    case 'apartment': {
      ctx.fillStyle = f;
      ctx.beginPath(); ctx.roundRect(8, fl - 10, 34, 10, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(8, fl - 16, 34, 7, 3); ctx.fill();
      ctx.fillStyle = '#222b3a'; ctx.fillRect(56, fl - 30, 22, 13);
      ctx.fillStyle = lit && r.present ? '#9be7ff' : '#2d3748'; ctx.fillRect(57.5, fl - 28.5, 19, 10);
      ctx.fillStyle = '#e7e3dc'; ctx.fillRect(W - 50, fl - 8, 42, 8);
      ctx.fillStyle = cc.acc; ctx.fillRect(W - 40, fl - 8, 32, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(W - 49, fl - 11, 9, 4);
      ctx.fillStyle = f; ctx.fillRect(W - 52, fl - 18, 3, 18);
      ctx.fillStyle = '#5a4637'; ctx.fillRect(48, fl - 22, 1.5, 22);
      ctx.fillStyle = lit ? '#ffe6a8' : '#5a6070';
      ctx.beginPath(); ctx.moveTo(44, fl - 22); ctx.lineTo(54, fl - 22); ctx.lineTo(51, fl - 28); ctx.lineTo(47, fl - 28); ctx.fill();
      break;
    }
    case 'hotel': case 'suite': {
      const beds = r.type === 'suite' ? [W * 0.62] : [W / 2];
      for (const bx of beds) {
        ctx.fillStyle = f; ctx.fillRect(bx - 22, fl - 20, 4, 20);
        ctx.fillStyle = '#eef0f6'; ctx.fillRect(bx - 18, fl - 9, 38, 9);
        ctx.fillStyle = cc.acc; ctx.fillRect(bx - 8, fl - 9, 28, 6);
        ctx.fillStyle = '#fff'; ctx.fillRect(bx - 17, fl - 12, 9, 4);
        ctx.fillStyle = f; ctx.fillRect(bx + 24, fl - 7, 6, 7);
        ctx.fillStyle = lit ? '#ffe6a8' : '#5a6070'; ctx.fillRect(bx + 25, fl - 12, 4, 5);
      }
      if (r.type === 'suite') {
        ctx.fillStyle = f;
        ctx.beginPath(); ctx.roundRect(8, fl - 10, 30, 10, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(8, fl - 15, 30, 6, 3); ctx.fill();
        ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W * 0.35, 2); ctx.lineTo(W * 0.35, 8); ctx.stroke();
        ctx.fillStyle = lit ? '#ffe9a8' : '#8a7a50';
        ctx.beginPath(); ctx.arc(W * 0.35, 10, 3.5, 0, 7); ctx.fill();
      }
      break;
    }
    case 'restaurant':
      ctx.fillStyle = f; ctx.fillRect(4, fl - 15, Math.min(48, W * 0.25), 15);
      ctx.fillStyle = cc.acc; ctx.fillRect(4, fl - 16, Math.min(48, W * 0.25), 2);
      for (let x = 66; x + 14 < W; x += 28) {
        ctx.fillStyle = '#f5f1e8'; ctx.fillRect(x, fl - 11, 16, 2);
        ctx.fillStyle = f; ctx.fillRect(x + 7, fl - 9, 2, 9);
        ctx.fillRect(x - 5, fl - 8, 3, 8); ctx.fillRect(x + 18, fl - 8, 3, 8);
        ctx.strokeStyle = 'rgba(30,30,40,0.6)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x + 8, 1.6); ctx.lineTo(x + 8, 12); ctx.stroke();
        ctx.fillStyle = lit ? '#ffd27a' : '#55606f';
        ctx.beginPath(); ctx.moveTo(x + 4, 16); ctx.lineTo(x + 12, 16); ctx.lineTo(x + 10, 12); ctx.lineTo(x + 6, 12); ctx.fill();
      }
      break;
    case 'shop': {
      const pal = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b'];
      for (let x = 6, i = 0; x + 18 < W - 30; x += 24, i++) {
        ctx.fillStyle = f; ctx.fillRect(x, fl - 30, 18, 30);
        ctx.fillStyle = mix('#ffffff', '#e8edf3', 0.5); ctx.fillRect(x + 1.5, fl - 28.5, 15, 27);
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = f; ctx.fillRect(x + 1.5, fl - 20 + s * 9 - 1, 15, 1);
          for (let b = 0; b < 3; b++) { ctx.fillStyle = pal[(i * 3 + s + b + r.id) % pal.length]; ctx.fillRect(x + 3 + b * 5, fl - 25 + s * 9, 3.5, 4); }
        }
      }
      ctx.fillStyle = f; ctx.fillRect(W - 26, fl - 12, 22, 12);
      ctx.fillStyle = cc.acc; ctx.fillRect(W - 26, fl - 13, 22, 2);
      break;
    }
    case 'cinema': {
      const sw = Math.min(W * 0.32, 90);
      ctx.fillStyle = '#10131f'; ctx.fillRect(6, 5, sw, H - 18);
      const on = r.present > 0;
      const g = ctx.createLinearGradient(8, 0, 8 + sw, 0);
      g.addColorStop(0, on ? '#9fd3ff' : '#2a3142'); g.addColorStop(1, on ? '#e0c3ff' : '#232a3a');
      ctx.fillStyle = g; ctx.fillRect(8, 7, sw - 4, H - 22);
      for (let x = sw + 20, i = 0; x + 8 < W; x += 11, i++) {
        const lift = Math.min(10, i * 1.2);
        ctx.fillStyle = mix('#1a1f33', TYPES.cinema.color, 0.3); ctx.fillRect(x - 3, fl - lift - 1, 11, lift + 1);
        ctx.fillStyle = '#b8323f'; ctx.fillRect(x, fl - lift - 9, 6, 8);
      }
      break;
    }
    case 'lobby': {
      ctx.fillStyle = mix('#ffffff', '#c2b8a3', 0.4); ctx.fillRect(0, fl - 2, W, 2);
      for (let x = 30; x < W - 10; x += 72) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, 2, 6, fl - 2);
        ctx.fillStyle = 'rgba(80,60,40,0.25)'; ctx.fillRect(x + 4.5, 2, 1.5, fl - 2);
      }
      if (W >= 96) {
        const cx = W / 2;
        ctx.fillStyle = '#6b4d33'; ctx.beginPath(); ctx.roundRect(cx - 18, fl - 12, 36, 12, 2); ctx.fill();
        ctx.fillStyle = '#d9b45a'; ctx.fillRect(cx - 18, fl - 13, 36, 1.5);
      }
      for (const px of [8, W - 8]) {
        ctx.fillStyle = '#3c3f48'; ctx.fillRect(px - 3, fl - 6, 6, 6);
        ctx.fillStyle = '#2f8f57'; ctx.beginPath(); ctx.arc(px, fl - 10, 5, 0, 7); ctx.arc(px - 3, fl - 13, 3.5, 0, 7); ctx.arc(px + 3, fl - 14, 3.5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      for (let x = 60; x < W - 20; x += 72) { ctx.beginPath(); ctx.arc(x, 6, 2.5, 0, 7); ctx.fill(); }
      break;
    }
    case 'stairs': {
      ctx.fillStyle = 'rgba(20,26,38,0.35)'; ctx.fillRect(0, 0, W, H);
      const n = 8;
      ctx.fillStyle = mix('#cfd6e0', '#7b8494', 0.4);
      for (let i = 0; i < n; i++) {
        const sx = 3 + i * (W - 6) / n;
        const sy = fl - (i + 1) * (H - 4) / n;
        ctx.fillRect(sx, sy, (W - 6) / n + 0.5, (i + 1) * (H - 4) / n);
      }
      ctx.strokeStyle = '#e6c35c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(3, fl - 8); ctx.lineTo(W - 3, -6); ctx.stroke();
      break;
    }
  }
}

/* ---------- asansörler ---------- */
function drawShaft(o, env, vis, labels) {
  const T = TYPES[o.type];
  const X = o.x * CW, W = o.w * CW;
  const lo = Math.max(o.bottom, vis.f0), hi = Math.min(o.top, vis.f1);
  const yTop = -(hi + 1) * FH, yBot = -lo * FH;
  ctx.fillStyle = '#0f151f';
  ctx.fillRect(X, yTop, W, yBot - yTop);
  ctx.fillStyle = mix('#182132', '#2a3548', env.day);
  ctx.fillRect(X + 3, yTop, W - 6, yBot - yTop);
  ctx.fillStyle = '#3b475c';
  ctx.fillRect(X + 4, yTop, 1, yBot - yTop);
  ctx.fillRect(X + W - 5, yTop, 1, yBot - yTop);

  const cars = R.cars[o.id] || [];
  const stopSet = R.stops[o.id] || [];
  const Q = R.queues[o.id] || {};
  for (let f = lo; f <= hi; f++) {
    const y = -(f + 1) * FH;
    ctx.fillStyle = '#2a3242';
    ctx.fillRect(X, y + FH - 3, W, 3);
    if (o.type === 'express' && !stopSet.includes(f)) continue;
    // kapı
    const openCar = cars.find(c => c.state === 'doors' && c.f === f);
    const dw = W - 16, dh = FH - 14, dx = X + 8, dy = y + FH - 3 - dh;
    ctx.fillStyle = '#2c3546'; ctx.fillRect(dx - 1.5, dy - 1.5, dw + 3, dh + 1.5);
    const k = openCar ? 0.42 : 0;
    ctx.fillStyle = mix('#7d8aa0', '#b9c4d4', env.day);
    ctx.fillRect(dx, dy, dw / 2 * (1 - k), dh);
    ctx.fillRect(dx + dw / 2 + dw / 2 * k, dy, dw / 2 * (1 - k), dh);
    ctx.fillStyle = T.color;
    ctx.fillRect(dx + dw / 2 - 2, dy - 5, 4, 2);
    const q = Q[f];
    const waiting = q ? q.up.length + q.down.length : 0;
    if (waiting >= 5 && Cam.z > 0.5) labels.push({ wx: X + W / 2, wy: y + 6, text: waiting + '', kind: waiting > 20 ? 'hot' : 'q' });
  }
  // kablolar ve kabinler
  ctx.strokeStyle = 'rgba(150,165,190,0.5)';
  ctx.lineWidth = 0.6;
  for (const car of cars) {
    const cy = -(car.y + 1) * FH;
    if (cy > yBot || cy + FH < yTop) continue;
    ctx.beginPath(); ctx.moveTo(X + W / 2, -(o.top + 1) * FH); ctx.lineTo(X + W / 2, cy + 5); ctx.stroke();
    const bx = X + 4, bw = W - 8, by = cy + 6, bh = FH - 10;
    ctx.fillStyle = T.color;
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 3); ctx.fill();
    ctx.fillStyle = mix('#e9eef6', '#ffffff', env.day);
    ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, bw - 2, bh - 2, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    ctx.fillRect(bx + 3, by + 2, bw - 6, 1.5);
    const n = car.pass.length;
    const cols = Math.max(1, Math.floor((bw - 4) / 5));
    for (let i = 0; i < n; i++) {
      const cx = bx + 4 + (i % cols) * 5, row = Math.floor(i / cols);
      const py = by + bh - 3 - row * 6;
      ctx.fillStyle = car.pass[i].color;
      ctx.fillRect(cx - 1.5, py - 6, 3, 5);
      ctx.fillStyle = '#f0cba8';
      ctx.fillRect(cx - 1, py - 8, 2, 2);
    }
    if (car.state === 'doors') {
      ctx.fillStyle = 'rgba(120,255,180,0.9)';
      ctx.fillRect(bx + bw / 2 - 2, by - 3, 4, 1.5);
    }
  }
}

/* ---------- insanlar ---------- */
function drawPeople(vis) {
  const z = Cam.z;
  for (const p of R.people) {
    if (p.dead || p.state === 'ride') continue;
    if (p.f < vis.f0 - 1 || p.f > vis.f1 + 1 || p.x < vis.x0 || p.x > vis.x1) continue;
    const x = p.x * CW;
    const y = -p.f * FH - 3 - (p.climb || 0) * (FH - 2);
    if (z < 0.6) { ctx.fillStyle = p.color; ctx.fillRect(x - 1.5, y - 10, 3, 10); continue; }
    const sw = (p.state === 'walk' || p.state === 'stairs') ? Math.sin(p.phase) * 1.4 : 0;
    ctx.fillStyle = '#1b2230';
    ctx.fillRect(x - 1.5 + sw * 0.5, y - 5, 1.2, 5);
    ctx.fillRect(x + 0.3 - sw * 0.5, y - 5, 1.2, 5);
    ctx.fillStyle = p.color;
    ctx.fillRect(x - 2, y - 11, 4, 6.5);
    ctx.fillStyle = '#f0cba8';
    ctx.beginPath(); ctx.arc(x, y - 13, 2, 0, 7); ctx.fill();
    if (p.stress > 25) {
      ctx.fillStyle = p.stress > 50 ? '#ff3b3b' : '#ffb020';
      ctx.beginPath(); ctx.arc(x, y - 18, 1.4, 0, 7); ctx.fill();
    }
  }
}

/* ---------- inşaat önizleme ve seçim ---------- */
function drawGhost() {
  const g = View.ghost;
  if (!g) return;
  const T = TYPES[g.sp.type];
  const isShaft = T.kind === 'shaft';
  const w = (g.sp.w || T.w) * CW;
  const X = g.sp.x * CW;
  const top = isShaft ? g.sp.top : g.sp.f, bot = isShaft ? g.sp.bottom : g.sp.f;
  const Y = -(top + 1) * FH, H = (top - bot + 1) * FH;
  ctx.fillStyle = g.res.ok ? 'rgba(80,220,140,0.28)' : 'rgba(255,80,90,0.28)';
  ctx.fillRect(X, Y, w, H);
  ctx.strokeStyle = g.res.ok ? '#5be39a' : '#ff5a64';
  ctx.lineWidth = 1.5 / Cam.z;
  ctx.setLineDash([4 / Cam.z, 3 / Cam.z]);
  ctx.strokeRect(X, Y, w, H);
  ctx.setLineDash([]);
}
function drawSelection() {
  const o = View.selected && S.objects[View.selected];
  if (!o) return;
  const X = o.x * CW, W = o.w * CW;
  const top = o.kind === 'shaft' ? o.top : o.f, bot = o.kind === 'shaft' ? o.bottom : o.f;
  const Y = -(top + 1) * FH, H = (top - bot + 1) * FH;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 250);
  ctx.strokeStyle = `rgba(120,220,255,${pulse})`;
  ctx.lineWidth = 2.5 / Cam.z;
  ctx.strokeRect(X - 1, Y - 1, W + 2, H + 2);
}

/* ---------- ekran etiketleri ---------- */
function drawLabels(labels) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const L of labels) {
    const { sx, sy } = worldToScreen(L.wx, L.wy);
    if (L.kind === 'tag') {
      ctx.font = '600 10px Outfit, system-ui, sans-serif';
      const w = ctx.measureText(L.text).width + 12;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 8, w, 16, 8); ctx.fill();
      ctx.fillStyle = '#2b3445'; ctx.fillText(L.text, sx, sy + 0.5);
    } else if (L.kind === 'warn') {
      ctx.font = '600 10px Outfit, system-ui, sans-serif';
      const w = ctx.measureText(L.text).width + 12;
      ctx.fillStyle = 'rgba(255,90,90,0.92)';
      ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 8, w, 16, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(L.text, sx, sy + 0.5);
    } else if (L.kind === 'q' || L.kind === 'hot') {
      ctx.font = '700 10px Outfit, system-ui, sans-serif';
      ctx.fillStyle = L.kind === 'hot' ? '#ff4d5e' : '#ffb020';
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(L.text, sx, sy + 0.5);
    } else if (L.kind === 'num') {
      ctx.font = '700 11px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
      ctx.strokeText(L.text, sx, sy); ctx.fillText(L.text, sx, sy);
    }
  }
}
function drawFloorGutter(vis) {
  if (Cam.z < 0.35) return;
  ctx.font = '600 10px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const x = (innerWidth > 720 ? 236 : 8);
  for (let f = vis.f0; f <= vis.f1; f++) {
    if (Cam.z < 0.7 && f % 5 !== 0) continue;
    const { sy } = worldToScreen(0, -(f + 0.5) * FH);
    const t = f === 0 ? 'Z' : f < 0 ? 'B' + -f : '' + f;
    const sky = f > 0 && f % 15 === 0;
    ctx.fillStyle = sky ? 'rgba(255,201,77,0.85)' : 'rgba(10,14,28,0.45)';
    ctx.beginPath(); ctx.roundRect(x, sy - 8, 26, 16, 5); ctx.fill();
    ctx.fillStyle = sky ? '#1a1a1a' : 'rgba(255,255,255,0.85)';
    ctx.fillText(t, x + 13 - ctx.measureText(t).width / 2, sy + 0.5);
  }
}
