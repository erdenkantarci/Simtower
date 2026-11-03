'use strict';
/* ============================================================
 *  Yükseliş — arayüz ve giriş
 * ============================================================ */

const $ = s => document.querySelector(s);
const SAVE_KEY = 'yukselis-save-v1';
const Tool = { cur: 'inspect' };
const Input = { pointers: new Map(), down: false, pan: false, moved: false, sx: 0, sy: 0, mx: 0, my: 0, dragStart: null, pinch: null, keys: {} };

const TOOL_GROUPS = [
  { title: 'Araçlar', items: ['inspect', 'bulldoze'] },
  { title: 'Ulaşım', items: ['lobby', 'stairs', 'elevator', 'express'] },
  { title: 'Kiralık', items: ['office', 'apartment'] },
  { title: 'Ticari', items: ['restaurant', 'shop', 'cinema'] },
  { title: 'Konaklama', items: ['hotel', 'suite'] },
];
const META_TOOLS = {
  inspect: { name: 'İncele', icon: '🔍', desc: 'Bir yapıya tıklayarak detaylarını görün. Sürükleyerek kamerayı kaydırın.' },
  bulldoze: { name: 'Yık', icon: '🧨', desc: 'Bir yapıyı yıkar. Üstünde/altında yapı varsa önce onları yıkmalısınız.' },
};

/* ---------- toast ---------- */
UI.toast = (msg, kind = 'info') => {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4700);
};

/* ---------- araç çubuğu ---------- */
function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = '';
  for (const g of TOOL_GROUPS) {
    const h = document.createElement('div');
    h.className = 'tgroup';
    h.textContent = g.title;
    tb.appendChild(h);
    for (const k of g.items) {
      const T = TYPES[k] || META_TOOLS[k];
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.tool = k;
      let cost = '';
      if (TYPES[k]) cost = T.drag === 'h' ? fmtMoney(T.costPerCell) + '/hücre' : T.kind === 'shaft' ? fmtMoney(T.cost) + '+' : fmtMoney(T.cost);
      b.innerHTML = `<span class="ti">${T.icon}</span><span class="tn">${T.name}<small>${cost}</small></span><span class="lock"></span>`;
      if (TYPES[k]) b.style.setProperty('--acc', T.color);
      b.addEventListener('click', () => selectTool(k));
      b.addEventListener('mouseenter', e => showTip(`<b>${T.icon} ${T.name}</b><br>${T.desc}${TYPES[k] && T.star > 1 ? `<br><em>${'★'.repeat(T.star)} gerekir</em>` : ''}`, e.clientX + 16, e.clientY));
      b.addEventListener('mouseleave', hideTip);
      tb.appendChild(b);
    }
  }
  UI.refreshTools();
}
UI.refreshTools = () => {
  document.querySelectorAll('.tool').forEach(b => {
    const k = b.dataset.tool;
    const T = TYPES[k];
    const locked = T && S.stars < T.star;
    b.classList.toggle('locked', !!locked);
    b.querySelector('.lock').textContent = locked ? '★' + T.star : '';
    b.classList.toggle('active', Tool.cur === k);
  });
};
function selectTool(k) {
  const T = TYPES[k];
  if (T && S.stars < T.star) { UI.toast(`${T.name} için ${T.star}★ derece gerekli`, 'bad'); return; }
  Tool.cur = k;
  Input.dragStart = null;
  View.ghost = null;
  cv.style.cursor = k === 'inspect' ? 'grab' : k === 'bulldoze' ? 'not-allowed' : 'crosshair';
  UI.refreshTools();
}

/* ---------- ipucu ---------- */
function showTip(html, x, y) {
  const t = $('#tooltip');
  t.innerHTML = html;
  t.classList.remove('hidden');
  const r = t.getBoundingClientRect();
  t.style.left = Math.min(x, innerWidth - r.width - 10) + 'px';
  t.style.top = Math.min(y, innerHeight - r.height - 10) + 'px';
}
function hideTip() { $('#tooltip').classList.add('hidden'); }

/* ---------- inşaat şablonu ---------- */
function cellUnder(sx, sy) {
  const { wx, wy } = screenToWorld(sx, sy);
  return { x: wx / CW, f: Math.floor(-wy / FH) };
}
function specFor(cell) {
  const k = Tool.cur, T = TYPES[k];
  if (!T) return null;
  const ds = Input.dragStart;
  if (T.drag === 'h') {
    if (ds) {
      const a = ds.x, b = Math.floor(cell.x);
      return { type: k, f: ds.f, x: Math.min(a, b), w: Math.abs(a - b) + 1 };
    }
    return { type: k, f: cell.f, x: Math.floor(cell.x - T.w / 2 + 0.5), w: T.w };
  }
  if (T.drag === 'v') {
    if (ds) {
      let lo = Math.min(ds.f, cell.f), hi = Math.max(ds.f, cell.f);
      if (ds.ext) { const e = S.objects[ds.ext]; if (e) { lo = Math.min(lo, e.bottom); hi = Math.max(hi, e.top); } }
      return { type: k, x: ds.x, w: T.w, bottom: lo, top: hi, ignoreId: ds.ext || 0 };
    }
    return { type: k, x: Math.floor(cell.x - T.w / 2 + 0.5), w: T.w, bottom: cell.f, top: cell.f + 1 };
  }
  return { type: k, f: cell.f, x: Math.round(cell.x - T.w / 2), w: T.w };
}
function updateGhost() {
  if (!TYPES[Tool.cur] || Input.pan) { View.ghost = null; return; }
  const cell = cellUnder(Input.mx, Input.my);
  const sp = specFor(cell);
  if (!sp) return;
  const res = checkPlace(sp);
  View.ghost = { sp, res };
  const T = TYPES[sp.type];
  let extra = '';
  if (T.kind === 'shaft') extra = ` · ${sp.top - sp.bottom + 1} kat`;
  showTip(`<b>${T.icon} ${T.name}</b>${extra}<br>${fmtMoney(res.cost)}${res.ok ? '' : `<br><span class="bad">${res.reason}</span>`}`, Input.mx + 18, Input.my + 14);
}

/* ---------- giriş ---------- */
function setupInput() {
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    Input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Input.pointers.size === 2) {
      const [a, b] = [...Input.pointers.values()];
      Input.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Cam.z };
      Input.dragStart = null; Input.down = false;
      return;
    }
    Input.down = true; Input.moved = false;
    Input.sx = Input.mx = e.clientX; Input.sy = Input.my = e.clientY;
    Input.pan = e.button === 1 || e.button === 2;
    const T = TYPES[Tool.cur];
    if (!Input.pan && e.button === 0 && T && T.drag) {
      const c = cellUnder(e.clientX, e.clientY);
      if (T.drag === 'h') Input.dragStart = { x: Math.floor(c.x), f: c.f };
      else {
        const o = objectAt(c.f, c.x);
        if (o && o.kind === 'shaft' && o.type === Tool.cur) Input.dragStart = { x: o.x, f: c.f, ext: o.id };
        else Input.dragStart = { x: Math.floor(c.x - T.w / 2 + 0.5), f: c.f, ext: 0 };
      }
      updateGhost();
    }
  });
  cv.addEventListener('pointermove', e => {
    if (Input.pointers.has(e.pointerId)) Input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Input.pinch && Input.pointers.size === 2) {
      const [a, b] = [...Input.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, Input.pinch.z * d / Input.pinch.d / Cam.z);
      return;
    }
    const dx = e.clientX - Input.mx, dy = e.clientY - Input.my;
    Input.mx = e.clientX; Input.my = e.clientY;
    if (Input.down) {
      if (Math.hypot(e.clientX - Input.sx, e.clientY - Input.sy) > 6) Input.moved = true;
      if (!Input.dragStart && Input.moved) Input.pan = true;
      if (Input.pan) {
        Cam.x -= dx / Cam.z; Cam.y -= dy / Cam.z;
        clampCam();
        cv.style.cursor = 'grabbing';
        hideTip();
        return;
      }
    }
    if (TYPES[Tool.cur]) updateGhost();
    else hoverInspect();
  });
  const end = e => {
    Input.pointers.delete(e.pointerId);
    if (Input.pinch) { if (Input.pointers.size < 2) Input.pinch = null; Input.down = false; return; }
    if (!Input.down) return;
    Input.down = false;
    const wasPan = Input.pan;
    Input.pan = false;
    cv.style.cursor = Tool.cur === 'inspect' ? 'grab' : Tool.cur === 'bulldoze' ? 'not-allowed' : 'crosshair';
    if (e.type === 'pointercancel') { Input.dragStart = null; return; }
    if (Input.dragStart) {
      const sp = specFor(cellUnder(e.clientX, e.clientY));
      Input.dragStart = null;
      if (sp && place(sp)) onBuilt(sp);
      updateGhost();
      return;
    }
    if (wasPan || Input.moved) return;
    clickAt(e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!Input.down) { View.ghost = null; hideTip(); } });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    Input.keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    if (e.key === 'Escape') { selectTool('inspect'); View.selected = null; renderInfo(); closeModals(); }
    if (e.key === '+' || e.key === '=') zoomAt(VW / 2, VH / 2, 1.2);
    if (e.key === '-') zoomAt(VW / 2, VH / 2, 1 / 1.2);
    if (e.key.toLowerCase() === 'b') selectTool('bulldoze');
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) setSpeed([1, 2, 4, 10][n - 1]);
  });
  addEventListener('keyup', e => { Input.keys[e.key.toLowerCase()] = false; });
}
function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  Cam.z = clamp(Cam.z * factor, 0.25, 4);
  const after = screenToWorld(sx, sy);
  Cam.x += before.wx - after.wx; Cam.y += before.wy - after.wy;
  clampCam();
}
function clampCam() {
  Cam.x = clamp(Cam.x, -600, WORLD_W * CW + 600);
  Cam.y = clamp(Cam.y, -(MAX_FLOOR + 3) * FH, -MIN_FLOOR * FH + 200);
}
function keyPan(dt) {
  const k = Input.keys, sp = 600 * dt / Cam.z;
  if (k['a'] || k['arrowleft']) Cam.x -= sp;
  if (k['d'] || k['arrowright']) Cam.x += sp;
  if (k['w'] || k['arrowup']) Cam.y -= sp;
  if (k['s'] || k['arrowdown']) Cam.y += sp;
  clampCam();
}
function clickAt(sx, sy) {
  const c = cellUnder(sx, sy);
  const o = objectAt(c.f, c.x);
  if (Tool.cur === 'bulldoze') {
    if (o && demolish(o.id)) { if (View.selected === o.id) View.selected = null; renderInfo(); }
    return;
  }
  if (Tool.cur === 'inspect') {
    View.selected = o ? o.id : null;
    renderInfo();
    return;
  }
  const sp = specFor(c);
  if (sp && place(sp)) onBuilt(sp);
  updateGhost();
}
function onBuilt(sp) {
  const T = TYPES[sp.type];
  if (sp.ignoreId) UI.toast(`${T.icon} ${T.name} uzatıldı`, 'good');
  else UI.toast(`${T.icon} ${T.name} inşa edildi`, 'good');
  renderInfo();
}
function hoverInspect() {
  const c = cellUnder(Input.mx, Input.my);
  const o = objectAt(c.f, c.x);
  if (!o) { hideTip(); return; }
  const T = TYPES[o.type];
  let sub = o.kind === 'shaft' ? `${floorName(o.bottom)} → ${floorName(o.top)}` : floorName(o.f);
  if (o.kind === 'room' && T.cap) sub += ` · ${o.present} kişi`;
  showTip(`<b>${T.icon} ${T.name}</b><br>${sub}`, Input.mx + 18, Input.my + 14);
}

/* ---------- bilgi paneli ---------- */
function stressBar(v) {
  const p = clamp(v / 80, 0, 1) * 100;
  const col = v < 25 ? '#2ecc71' : v < 50 ? '#f1c40f' : '#e74c3c';
  return `<div class="meter"><i style="width:${p}%;background:${col}"></i></div>`;
}
function renderInfo() {
  const box = $('#info');
  const o = View.selected && S.objects[View.selected];
  if (!o) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const T = TYPES[o.type];
  let html = `<div class="ih" style="--acc:${T.color}"><span class="big">${T.icon}</span><div><h3>${T.name}</h3><small>${o.kind === 'shaft' ? floorName(o.bottom) + ' → ' + floorName(o.top) : floorName(o.f)}</small></div><button class="x" data-act="close">✕</button></div>`;
  const rows = [];
  if (o.kind === 'shaft') {
    const Q = R.queues[o.id] || {};
    let waiting = 0, maxWait = 0;
    for (const f in Q) for (const k of ['up', 'down']) for (const p of Q[f][k]) { waiting++; maxWait = Math.max(maxWait, p.wait); }
    const riding = (R.cars[o.id] || []).reduce((a, c) => a + c.pass.length, 0);
    rows.push(['Kabin sayısı', `${o.nCars} / ${MAX_CARS}`], ['Durak sayısı', R.stops[o.id].length], ['Bekleyen', waiting], ['En uzun bekleme', Math.round(maxWait) + ' dk'], ['Kabindeki yolcu', riding], ['Günlük bakım', fmtMoney(T.maint * (1 + 0.5 * (o.nCars - 1)))]);
    html += table(rows);
    html += `<div class="btns"><button data-act="car" ${o.nCars >= MAX_CARS ? 'disabled' : ''}>➕ Kabin ekle (${fmtMoney(carPrice(o))})</button><button class="danger" data-act="del">🧨 Yık</button></div>`;
    html += `<p class="hint">İpucu: Asansör aracıyla bu şaftın üst/alt ucundan sürükleyerek uzatabilirsiniz.</p>`;
  } else {
    const vac = vacantOf(o);
    let status = '';
    if (o.type === 'office' || o.type === 'apartment') status = o.tenant ? '<span class="ok">Kiracı var</span>' : o.noAccess ? '<span class="bad">Ulaşım yok</span>' : '<span class="warn">Kiracı aranıyor</span>';
    else if (o.type === 'hotel' || o.type === 'suite') status = o.guest ? `<span class="ok">Dolu (${o.guestN} misafir)</span>` : o.noAccess ? '<span class="bad">Ulaşım yok</span>' : '<span class="warn">Boş</span>';
    else if (['restaurant', 'shop', 'cinema'].includes(o.type)) status = isOpen(o, S.time / 60, S.day % 7 >= 5) ? '<span class="ok">Açık</span>' : '<span class="warn">Kapalı</span>';
    if (status) rows.push(['Durum', status]);
    if (T.cap) rows.push(['İçeride', `${o.present}${T.cap ? ' / ' + T.cap : ''}`]);
    if (T.rent) rows.push(['Günlük kira', fmtMoney(T.rent)]);
    if (T.price) rows.push([o.type === 'hotel' || o.type === 'suite' ? 'Gecelik' : 'Kişi başı', fmtMoney(T.price)]);
    if (T.maint) rows.push(['Günlük bakım', fmtMoney(T.maint)]);
    if (o.type !== 'lobby' && o.type !== 'stairs') {
      rows.push(['Bugünkü gelir', fmtMoney(o.todayIncome)], ['Dünkü gelir', fmtMoney(o.lastIncome)], ['Toplam gelir', fmtMoney(o.income)]);
    }
    html += table(rows);
    if (o.type !== 'lobby' && o.type !== 'stairs') {
      html += `<div class="sl"><span>Ortalama stres</span><b>${Math.round(o.avgStress)}</b></div>${stressBar(o.avgStress)}`;
      if (o.badDays) html += `<p class="hint bad">⚠ ${o.badDays} gündür memnuniyetsiz. 3 günde taşınırlar!</p>`;
      if (vac && o.noAccess) html += `<p class="hint bad">Bu kata zeminden ulaşım yok. Asansör ya da merdiven bağlayın.</p>`;
    }
    html += `<div class="btns"><button class="danger" data-act="del">🧨 Yık</button></div>`;
  }
  box.innerHTML = html;
  box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'close') { View.selected = null; renderInfo(); }
    if (a === 'del' && demolish(o.id)) { View.selected = null; renderInfo(); }
    if (a === 'car') { addCar(o.id); renderInfo(); }
  }));
}
UI.refreshInfo = renderInfo;
const table = rows => `<table>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;

/* ---------- üst çubuk ---------- */
function setSpeed(v) {
  S.speed = v;
  document.querySelectorAll('#speedBtns button').forEach(b => b.classList.toggle('active', +b.dataset.speed === v));
}
let prevSpeed = 2;
function togglePause() {
  if (S.speed) { prevSpeed = S.speed; setSpeed(0); } else setSpeed(prevSpeed || 2);
}
function updateTopbar() {
  $('#sMoney').textContent = fmtMoney(S.money);
  $('#sMoney').classList.toggle('neg', S.money < 0);
  const net = S.today.income - S.today.expense;
  const n = $('#sNet');
  n.textContent = (net >= 0 ? '+' : '') + fmtMoney(net) + ' bugün';
  n.className = net >= 0 ? 'pos' : 'neg';
  $('#sPop').textContent = S.pop.toLocaleString('tr-TR');
  const nextP = S.stars < 5 ? STAR_POP[S.stars + 1] : null;
  const prevP = STAR_POP[S.stars] || 0;
  $('#sStarBar').style.width = nextP ? clamp((S.pop - prevP) / (nextP - prevP), 0, 1) * 100 + '%' : '100%';
  $('#sPopNext').textContent = nextP ? `${S.stars + 1}★ için ${nextP.toLocaleString('tr-TR')}` : 'En yüksek derece';
  $('#sStars').innerHTML = '★'.repeat(S.stars) + '<span class="dim">' + '★'.repeat(5 - S.stars) + '</span>';
  const h = Math.floor(S.time / 60), m = Math.floor(S.time % 60);
  $('#sTime').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  $('#sDay').textContent = `${S.day + 1}. gün · ${WEEKDAYS[S.day % 7]}`;
  $('#sIcon').textContent = h >= 6 && h < 19 ? '☀️' : '🌙';
}

/* ---------- rapor ---------- */
function openFinance() {
  $('#modal-finance').classList.remove('hidden');
  drawFinance();
}
function drawFinance() {
  const c = $('#chart');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = c.clientWidth, H = c.clientHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const data = S.history.slice(-30).map(d => ({ ...d, label: d.day + 1 }));
  data.push({ day: S.day, income: S.today.income, expense: S.today.expense, money: S.money, label: 'Bugün' });
  const pad = { l: 64, r: 64, t: 18, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const maxV = Math.max(1000, ...data.map(d => Math.max(d.income, d.expense)));
  const mons = data.map(d => d.money);
  const mMin = Math.min(...mons), mMax = Math.max(...mons);
  const mSpan = Math.max(1, mMax - mMin);
  g.font = '11px Outfit, system-ui, sans-serif';
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.fillStyle = 'rgba(255,255,255,0.5)';
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih * (1 - i / 4);
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
    g.fillText(shortMoney(maxV * i / 4), pad.l - 8, y);
  }
  g.textAlign = 'left';
  g.fillStyle = 'rgba(167,139,250,0.85)';
  for (let i = 0; i <= 4; i++) g.fillText(shortMoney(mMin + mSpan * i / 4), W - pad.r + 8, pad.t + ih * (1 - i / 4));
  const bw = iw / data.length;
  data.forEach((d, i) => {
    const x = pad.l + i * bw;
    const hi = d.income / maxV * ih, he = d.expense / maxV * ih;
    g.fillStyle = '#34d399'; g.beginPath(); g.roundRect(x + bw * 0.12, pad.t + ih - hi, bw * 0.36, hi, 2); g.fill();
    g.fillStyle = '#f87171'; g.beginPath(); g.roundRect(x + bw * 0.52, pad.t + ih - he, bw * 0.36, he, 2); g.fill();
    if (data.length < 16 || i % 3 === 0 || i === data.length - 1) {
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.textAlign = 'center';
      g.fillText(d.label, x + bw / 2, H - 12);
    }
  });
  g.strokeStyle = '#a78bfa'; g.lineWidth = 2;
  g.beginPath();
  data.forEach((d, i) => {
    const x = pad.l + i * bw + bw / 2, y = pad.t + ih * (1 - (d.money - mMin) / mSpan);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();

  // özet
  const rs = allRooms();
  const count = t => rs.filter(r => r.type === t).length;
  const occ = (t, f) => rs.filter(r => r.type === t && f(r)).length;
  const stressRooms = rs.filter(r => !['lobby', 'stairs'].includes(r.type));
  const avgS = stressRooms.length ? stressRooms.reduce((a, r) => a + r.avgStress, 0) / stressRooms.length : 0;
  let waiting = 0;
  for (const id in R.queues) for (const f in R.queues[id]) waiting += R.queues[id][f].up.length + R.queues[id][f].down.length;
  const cats = Object.entries(S.today.cats).sort((a, b) => b[1] - a[1]);
  const kpi = (l, v, s = '') => `<div class="kpi"><label>${l}</label><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  $('#finStats').innerHTML = `
    <div class="kpis">
      ${kpi('Bakiye', fmtMoney(S.money))}
      ${kpi('Nüfus', S.pop.toLocaleString('tr-TR'), '★'.repeat(S.stars))}
      ${kpi('Ofis doluluk', `${occ('office', r => r.tenant)}/${count('office')}`)}
      ${kpi('Daire doluluk', `${occ('apartment', r => r.tenant)}/${count('apartment')}`)}
      ${kpi('Otel doluluk', `${occ('hotel', r => r.guest) + occ('suite', r => r.guest)}/${count('hotel') + count('suite')}`)}
      ${kpi('Ortalama stres', Math.round(avgS), avgS < 25 ? 'mutlu' : avgS < 50 ? 'idare eder' : 'kritik')}
      ${kpi('Binadaki insan', R.people.length.toLocaleString('tr-TR'), `${waiting} asansör bekliyor`)}
      ${kpi('Asansör şaftı', allShafts().length)}
    </div>
    <h4>Bugünün kalemleri</h4>
    <div class="cats">${cats.length ? cats.map(([k, v]) => `<div><span>${k}</span><b class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</b></div>`).join('') : '<em>Henüz hareket yok</em>'}</div>`;
}
function shortMoney(v) {
  const a = Math.abs(v);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(0) + 'B' : Math.round(a) + '';
  return (v < 0 ? '-' : '') + '₺' + s;
}
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

/* ---------- kayıt ---------- */
function autoSave() {
  try { localStorage.setItem(SAVE_KEY, serialize()); } catch (e) { /* depolama yok */ }
}
function trySaved() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { loadFrom(s); return true; } } catch (e) { /* bozuk kayıt */ }
  return false;
}

/* ---------- kurulum ---------- */
function setupUI() {
  buildToolbar();
  setupInput();
  document.querySelectorAll('#speedBtns button').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  setSpeed(S.speed);
  document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => {
    View.mode = b.dataset.view;
    document.querySelectorAll('#views button').forEach(x => x.classList.toggle('active', x === b));
    $('#legend').classList.toggle('hidden', View.mode === 'normal');
    $('#legend').innerHTML = View.mode === 'stress' ? '<span>Sakin</span><i></i><span>Stresli</span>' :
      View.mode === 'income' ? '<span>Yüksek gelir</span><i></i><span>Düşük gelir</span>' : '<span>Dolu</span><i></i><span>Boş</span>';
  }));
  $('#btnFinance').addEventListener('click', openFinance);
  $('#btnHelp').addEventListener('click', () => $('#modal-help').classList.remove('hidden'));
  $('#btnSave').addEventListener('click', () => { autoSave(); UI.toast('💾 Oyun kaydedildi', 'good'); });
  $('#btnNew').addEventListener('click', () => {
    if (!confirm('Yeni oyuna başlansın mı? Mevcut kule silinecek.')) return;
    startNewGame(); View.selected = null; renderInfo(); UI.refreshTools(); setSpeed(S.speed);
    Cam.x = WORLD_W * CW / 2; Cam.y = -FH * 3; Cam.z = 1.5;
    autoSave();
  });
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.dataset.close !== undefined) m.classList.add('hidden'); }));
  addEventListener('resize', () => { if (!$('#modal-finance').classList.contains('hidden')) drawFinance(); });
  addEventListener('beforeunload', autoSave);
}

let uiTimer = 0, infoTimer = 0;
UI.tick = dt => {
  uiTimer += dt; infoTimer += dt;
  if (uiTimer > 0.15) { uiTimer = 0; updateTopbar(); }
  if (infoTimer > 0.5) {
    infoTimer = 0;
    if (View.selected) {
      if (!S.objects[View.selected]) View.selected = null;
      if (!$('#info').matches(':hover')) renderInfo();
    }
    if (!$('#modal-finance').classList.contains('hidden')) drawFinance();
  }
};
