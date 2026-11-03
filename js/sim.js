'use strict';
/* ============================================================
 *  Yükseliş — simülasyon çekirdeği
 *  Izgara, inşaat, rota bulma, asansörler, insanlar, ekonomi
 * ============================================================ */

const CW = 12;              // hücre genişliği (dünya px)
const FH = 44;              // kat yüksekliği (dünya px)
const WORLD_W = 240;        // hücre sayısı
const MAX_FLOOR = 90;
const MIN_FLOOR = -9;
const NF = MAX_FLOOR - MIN_FLOOR + 1;
const DAY = 1440;           // dakika
const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const STAR_POP = [0, 0, 300, 1000, 2500, 5000];

const ELEV_SPEED = 2.4;     // kat / oyun dakikası
const DOOR_TIME = 0.45;
const WALK_SPEED = 7;       // hücre / oyun dakikası
const STAIR_TIME = 1.5;
const CAR_CAP = 14;
const MAX_CARS = 4;
const MAX_PEOPLE = 3500;

const TYPES = {
  lobby: {
    name: 'Lobi', icon: '🏛️', w: 4, drag: 'h', costPerCell: 500, star: 1, color: '#c9a96e',
    desc: 'Kulenin girişi. Zemin katta ve her 15 katta bir (gökyüzü lobisi) kurulur. Sürükleyerek genişletin.'
  },
  stairs: {
    name: 'Merdiven', icon: '🪜', w: 4, cost: 5000, star: 1, color: '#7b8494',
    desc: 'Bulunduğu katı bir üst kata bağlar. 1-2 katlık kısa yolculuklar için ucuz çözüm.'
  },
  elevator: {
    name: 'Asansör', icon: '🛗', w: 4, drag: 'v', kind: 'shaft', cost: 40000, costPerFloor: 3500,
    maint: 250, star: 1, maxSpan: 30, speedMul: 1, color: '#5aa9ff',
    desc: 'Dikey sürükleyerek kat aralığını seçin (en fazla 30 kat). Mevcut bir asansörden sürükleyerek uzatabilirsiniz.'
  },
  office: {
    name: 'Ofis', icon: '💼', w: 9, cost: 40000, rent: 2400, cap: 6, star: 1, color: '#4f8cff', minFloor: 1,
    desc: 'Hafta içi 6 çalışan. Kiracı bulunursa günlük kira öder.'
  },
  apartment: {
    name: 'Daire', icon: '🏠', w: 12, cost: 70000, rent: 2000, cap: 3, star: 1, color: '#ff9f43', minFloor: 1,
    desc: '3 kişilik bir hane. Her gün kira öder, akşamları evde olurlar.'
  },
  restaurant: {
    name: 'Restoran', icon: '🍽️', w: 16, cost: 90000, price: 35, maint: 350, cap: 28, star: 1, color: '#ef5b5b',
    desc: 'Öğle ve akşam yemeği müşterileri getirir. Ofis çalışanları da öğlen gelir.'
  },
  shop: {
    name: 'Mağaza', icon: '🛍️', w: 10, cost: 55000, price: 28, maint: 220, cap: 16, star: 2, color: '#22c1a0',
    desc: 'Gün boyu alışveriş müşterileri. Hafta sonları daha kalabalık.'
  },
  hotel: {
    name: 'Otel Odası', icon: '🛏️', w: 5, cost: 24000, price: 650, cap: 2, star: 2, color: '#a678f0', minFloor: 1,
    desc: 'Akşam giriş yapan misafirler sabah çıkışta öder.'
  },
  express: {
    name: 'Ekspres Asansör', icon: '🚀', w: 5, drag: 'v', kind: 'shaft', cost: 120000, costPerFloor: 3000,
    maint: 700, star: 3, maxSpan: 999, speedMul: 2.4, color: '#ffc94d',
    desc: 'Çok hızlıdır ama yalnızca uç katlarda ve gökyüzü lobilerinde (her 15. kat) durur.'
  },
  suite: {
    name: 'Süit', icon: '👑', w: 10, cost: 65000, price: 1800, cap: 2, star: 3, color: '#d16fd1', minFloor: 1,
    desc: 'Lüks otel süiti. Yüksek gecelik ücret.'
  },
  cinema: {
    name: 'Sinema', icon: '🎬', w: 24, cost: 300000, price: 50, maint: 1400, cap: 80, star: 3, color: '#5b6bd6',
    desc: 'Öğleden gece yarısına kadar seyirci çeker. Kalabalığa hazırlıklı olun!'
  },
};
const BUILD_ORDER = ['lobby', 'stairs', 'elevator', 'express', 'office', 'apartment', 'restaurant', 'shop', 'hotel', 'suite', 'cinema'];

/* ---------- yardımcılar ---------- */
const rng = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmtMoney = v => (v < 0 ? '-' : '') + '₺' + Math.round(Math.abs(v)).toLocaleString('tr-TR');
const floorName = f => (f === 0 ? 'Zemin' : f < 0 ? 'B' + -f : f + '. kat');

/* UI tarafından doldurulan geri çağrımlar */
const UI = { toast() {}, refreshTools() {}, refreshInfo() {} };

/* ---------- durum ---------- */
let S = null;   // kaydedilen durum
const R = {     // çalışma zamanı (kaydedilmez)
  grid: new Map(), sgrid: new Map(), people: [], events: [], graph: null, routes: {},
  cars: {}, queues: {}, stops: {}, minX: null, maxX: null, pid: 1,
};

function newLedger() { return { income: 0, expense: 0, cats: {} }; }
function newState() {
  return {
    v: 1, money: 1500000, day: 0, time: 6 * 60, speed: 2, nextId: 1,
    objects: {}, stars: 1, pop: 0, history: [], today: newLedger(),
  };
}
const nowT = () => S.day * DAY + S.time;

function earn(v, cat) { S.money += v; S.today.income += v; S.today.cats[cat] = (S.today.cats[cat] || 0) + v; }
function spend(v, cat) { S.money -= v; S.today.expense += v; S.today.cats[cat] = (S.today.cats[cat] || 0) - v; }

/* ---------- ızgara ---------- */
// Odalar R.grid'de, asansör şaftları R.sgrid'de tutulur; şaftlar lobilerin içinden geçebilir.
function row(f, g = R.grid) {
  let r = g.get(f);
  if (!r) { r = new Int32Array(WORLD_W); g.set(f, r); }
  return r;
}
function roomCell(f, x) {
  if (x < 0 || x >= WORLD_W) return -1;
  const r = R.grid.get(f);
  return r ? r[x] : 0;
}
function shaftCell(f, x) {
  if (x < 0 || x >= WORLD_W) return -1;
  const r = R.sgrid.get(f);
  return r ? r[x] : 0;
}
// birleşik doluluk: önce şaft, sonra oda
function cellAt(f, x) {
  const s = shaftCell(f, x);
  return s !== 0 ? s : roomCell(f, x);
}
function floorsOf(o) {
  if (o.kind !== 'shaft') return [o.f];
  const a = [];
  for (let f = o.bottom; f <= o.top; f++) a.push(f);
  return a;
}
function stamp(o, v) {
  const g = o.kind === 'shaft' ? R.sgrid : R.grid;
  for (const f of floorsOf(o)) {
    const r = row(f, g);
    for (let x = o.x; x < o.x + o.w; x++) r[x] = v;
  }
}
function objectAt(f, x) {
  const id = cellAt(f, Math.floor(x));
  return id > 0 ? S.objects[id] : null;
}
const allRooms = () => Object.values(S.objects).filter(o => o.kind === 'room');
const allShafts = () => Object.values(S.objects).filter(o => o.kind === 'shaft');

function computeExtents() {
  R.minX = R.maxX = null;
  for (let x = 0; x < WORLD_W; x++) {
    if (cellAt(0, x) > 0) { if (R.minX === null) R.minX = x; R.maxX = x; }
  }
}
function exitX() {
  if (R.minX === null) return null;
  return Math.random() < 0.5 ? R.minX - rng(2, 6) : R.maxX + 1 + rng(2, 6);
}
function structureChanged() {
  R.graph = null; R.routes = {};
  computeExtents();
}

/* ---------- asansör şaftları ---------- */
function shaftStops(o) {
  const s = [];
  for (let f = o.bottom; f <= o.top; f++) {
    if (o.type !== 'express' || f === o.bottom || f === o.top || f % 15 === 0) s.push(f);
  }
  return s;
}
function initShaftRuntime(o) {
  R.stops[o.id] = shaftStops(o);
  if (!R.queues[o.id]) R.queues[o.id] = {};
  const cars = R.cars[o.id] || (R.cars[o.id] = []);
  while (cars.length < o.nCars) {
    cars.push({ y: o.bottom + (cars.length ? Math.floor((o.top - o.bottom) * cars.length / o.nCars) : 0), dir: 0, state: 'idle', timer: 0, pass: [], f: o.bottom });
  }
}

/* ---------- inşaat ---------- */
function checkPlace(sp) {
  const T = TYPES[sp.type];
  const res = { ok: false, reason: '', cost: 0 };
  if (!T) return res;
  const isShaft = T.kind === 'shaft';
  const w = sp.w || T.w;
  const lo = isShaft ? sp.bottom : sp.f;
  const hi = isShaft ? sp.top : sp.f;
  const ext = sp.ignoreId ? S.objects[sp.ignoreId] : null;

  if (isShaft) {
    const span = hi - lo + 1;
    res.cost = (ext ? 0 : T.cost) + T.costPerFloor * (span - (ext ? ext.top - ext.bottom + 1 : 0));
  } else if (sp.type === 'lobby') res.cost = T.costPerCell * w;
  else res.cost = T.cost;

  const fail = m => { res.reason = m; return res; };
  if (S.stars < T.star) return fail(`${T.star}★ derece gerekli`);
  if (sp.x < 0 || sp.x + w > WORLD_W) return fail('Arsa sınırı dışında');
  if (lo < MIN_FLOOR || hi > MAX_FLOOR) return fail('Kat sınırı aşıldı');
  if (isShaft) {
    const span = hi - lo + 1;
    if (span < 2) return fail('En az 2 kat sürükleyin');
    if (span > T.maxSpan) return fail(`En fazla ${T.maxSpan} kat`);
    if (ext && ext.x !== sp.x) return fail('Uzatma aynı hizada olmalı');
  } else {
    if (sp.type === 'lobby' && (sp.f < 0 || sp.f % 15 !== 0)) return fail('Lobi: zemin kat veya 15, 30, 45…');
    if (sp.type === 'lobby' && w < 2) return fail('Lobi en az 2 hücre');
    if (T.minFloor !== undefined && sp.f < T.minFloor) return fail('Zemin üstü bir katta olmalı');
  }
  for (let f = lo; f <= hi; f++) {
    for (let x = sp.x; x < sp.x + w; x++) {
      const sc = shaftCell(f, x), rc = roomCell(f, x);
      if (sc < 0) return fail('Arsa sınırı dışında');
      if (isShaft) {
        if (sc !== 0 && sc !== sp.ignoreId) return fail('Alan dolu');
        if (rc !== 0 && S.objects[rc].type !== 'lobby') return fail('Alan dolu');
      } else {
        if (rc !== 0) return fail('Alan dolu');
        if (sc !== 0 && sp.type !== 'lobby') return fail('Alan dolu');
      }
    }
    const nb = f > 0 ? f - 1 : f < 0 ? f + 1 : null;
    if (nb !== null && !(nb >= lo && nb <= hi)) {
      for (let x = sp.x; x < sp.x + w; x++) {
        if (cellAt(nb, x) <= 0) return fail(f > 0 ? 'Altında taşıyıcı yapı yok' : 'Üstünde yapı yok');
      }
    }
  }
  if (S.money < res.cost) return fail('Yetersiz bakiye');
  res.ok = true;
  return res;
}

function place(sp) {
  const c = checkPlace(sp);
  if (!c.ok) { UI.toast(c.reason, 'bad'); return null; }
  const T = TYPES[sp.type];
  spend(c.cost, 'İnşaat');
  let o;
  if (sp.ignoreId) {
    o = S.objects[sp.ignoreId];
    stamp(o, 0);
    o.bottom = sp.bottom; o.top = sp.top;
    stamp(o, o.id);
    initShaftRuntime(o);
    for (const car of R.cars[o.id]) car.y = clamp(car.y, o.bottom, o.top);
  } else if (T.kind === 'shaft') {
    o = { id: S.nextId++, kind: 'shaft', type: sp.type, x: sp.x, w: T.w, bottom: sp.bottom, top: sp.top, nCars: 1 };
    S.objects[o.id] = o;
    stamp(o, o.id);
    initShaftRuntime(o);
  } else {
    o = {
      id: S.nextId++, kind: 'room', type: sp.type, f: sp.f, x: sp.x, w: sp.w || T.w,
      tenant: false, guest: false, guestN: 0, present: 0, sSum: 0, sN: 0, avgStress: 0, badDays: 0,
      income: 0, todayIncome: 0, lastIncome: 0, noAccess: false,
    };
    S.objects[o.id] = o;
    stamp(o, o.id);
  }
  structureChanged();
  if (o.kind === 'room') scheduleRoom(o, S.day, nowT() + 1);
  computePop();
  return o;
}

function canDemolish(o) {
  for (const f of floorsOf(o)) {
    for (let x = o.x; x < o.x + o.w; x++) {
      // hücrede başka bir yapı (lobi/şaft) kalıyorsa üstündekiler taşınmaya devam eder
      const remaining = o.kind === 'room' ? shaftCell(f, x) : roomCell(f, x);
      if (remaining > 0) continue;
      for (const nb of [f >= 0 ? f + 1 : null, f <= 0 ? f - 1 : null]) {
        if (nb === null) continue;
        const a = shaftCell(nb, x), b = roomCell(nb, x);
        if ((a > 0 && a !== o.id) || (b > 0 && b !== o.id)) return false;
      }
    }
  }
  return true;
}
function demolish(id) {
  const o = S.objects[id];
  if (!o) return false;
  if (!canDemolish(o)) { UI.toast('Önce üstündeki/altındaki yapıları yıkın', 'bad'); return false; }
  for (const p of R.people) {
    if (p.dead) continue;
    if (p.roomId === id || p.homeId === id || p.legs.some(L => L.id === id)) killPerson(p);
  }
  stamp(o, 0);
  delete S.objects[id];
  if (o.kind === 'shaft') { delete R.cars[id]; delete R.queues[id]; delete R.stops[id]; }
  structureChanged();
  computePop();
  UI.toast(`${TYPES[o.type].name} yıkıldı`, 'info');
  return true;
}
function addCar(id) {
  const o = S.objects[id];
  if (!o || o.kind !== 'shaft') return;
  const price = Math.round(TYPES[o.type].cost * 0.6);
  if (o.nCars >= MAX_CARS) return UI.toast('Bu şaftta en fazla 4 kabin olabilir', 'bad');
  if (S.money < price) return UI.toast('Yetersiz bakiye', 'bad');
  spend(price, 'İnşaat');
  o.nCars++;
  initShaftRuntime(o);
  UI.toast('Yeni kabin eklendi', 'good');
}
const carPrice = o => Math.round(TYPES[o.type].cost * 0.6);

/* ---------- rota bulma (katlar arası Dijkstra) ---------- */
function buildGraph() {
  const adj = Array.from({ length: NF }, () => []);
  for (const o of Object.values(S.objects)) {
    if (o.kind === 'shaft') {
      const stops = R.stops[o.id];
      const mul = TYPES[o.type].speedMul;
      for (const a of stops) for (const b of stops) {
        if (a === b) continue;
        adj[a - MIN_FLOOR].push({ c: 5 + Math.abs(a - b) * 0.5 / mul, leg: { k: 'e', id: o.id, from: a, to: b } });
      }
    } else if (o.type === 'stairs') {
      adj[o.f - MIN_FLOOR].push({ c: 4, leg: { k: 's', id: o.id, from: o.f, to: o.f + 1 } });
      adj[o.f + 1 - MIN_FLOOR].push({ c: 4, leg: { k: 's', id: o.id, from: o.f + 1, to: o.f } });
    }
  }
  R.graph = adj; R.routes = {};
}
function dijkstra(src) {
  const dist = new Float64Array(NF).fill(Infinity);
  const prev = new Array(NF).fill(null);
  const done = new Uint8Array(NF);
  dist[src - MIN_FLOOR] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < NF; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const e of R.graph[u]) {
      const v = e.leg.to - MIN_FLOOR;
      const nd = best + e.c;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = e; }
    }
  }
  return { dist, prev };
}
function route(a, b) {
  if (a === b) return [];
  if (!R.graph) buildGraph();
  let t = R.routes[a];
  if (!t) t = R.routes[a] = dijkstra(a);
  if (!t.prev[b - MIN_FLOOR]) return null;
  const legs = [];
  let cur = b;
  while (cur !== a) { const e = t.prev[cur - MIN_FLOOR]; legs.push(e.leg); cur = e.leg.from; }
  return legs.reverse();
}
const reachable = f => R.minX !== null && route(0, f) !== null;

/* ---------- olay kuyruğu ---------- */
function addEvent(t, fn) {
  const ev = R.events; // zamana göre azalan
  let lo = 0, hi = ev.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t > t) lo = m + 1; else hi = m; }
  ev.splice(lo, 0, { t, fn });
}
function runEvents(T) {
  const ev = R.events;
  while (ev.length && ev[ev.length - 1].t <= T) ev.pop().fn();
}

/* ---------- insanlar ---------- */
const CLS_COLORS = {
  office: ['#3d7bff', '#2c5fd6', '#5a92ff', '#1f3f8f'],
  resident: ['#ff9f43', '#ffb766', '#e8833a', '#f4c27a'],
  guest: ['#a678f0', '#c49bff', '#8a5ad6'],
  visitor: ['#22c1a0', '#ff6b9a', '#ffd166', '#06d6a0', '#ef476f', '#7bdff2', '#f78c6b'],
};

function spawnTrip(o) {
  const legs = route(o.fromF, o.toF);
  if (!legs) return null;
  const p = {
    id: R.pid++, f: o.fromF, x: o.fromX, legs, li: 0, toX: o.toX, toF: o.toF,
    purpose: o.purpose, roomId: o.roomId, homeId: o.homeId, returnTo: o.returnTo || null,
    color: pick(CLS_COLORS[o.cls] || CLS_COLORS.visitor), cls: o.cls,
    stress: 0, state: 'walk', tx: 0, wait: 0, t: 0, spd: WALK_SPEED * rng(0.85, 1.2), dir: 1,
    phase: Math.random() * 6, leg: null, car: null,
  };
  nextLeg(p);
  R.people.push(p);
  return p;
}
function nextLeg(p) {
  p.state = 'walk';
  if (p.li < p.legs.length) {
    let L = p.legs[p.li];
    if (L.k === 'e') {
      const alt = bestShaft(L, p.x);
      if (alt && alt !== L.id) { L = { k: 'e', id: alt, from: L.from, to: L.to }; p.legs[p.li] = L; }
    }
    const o = S.objects[L.id];
    if (!o) { killPerson(p); return; }
    if (L.k === 'e') p.tx = o.x + o.w / 2 + rng(-1.6, 1.6);
    else p.tx = L.to > L.from ? o.x + 0.6 : o.x + o.w - 0.6;
  } else p.tx = p.toX;
}
// Aynı iki katı bağlayan şaftlar arasında yürüme mesafesi + kuyruk + yolculuk süresine göre seçim
function bestShaft(L, x) {
  let best = 0, bs = Infinity;
  for (const o of allShafts()) {
    const st = R.stops[o.id];
    if (!st.includes(L.from) || !st.includes(L.to)) continue;
    const q = R.queues[o.id][L.from];
    const waiting = q ? q.up.length + q.down.length : 0;
    const score = Math.abs(o.x + o.w / 2 - x) / WALK_SPEED + waiting / (CAR_CAP * o.nCars) * 8 +
      Math.abs(L.to - L.from) * 0.5 / TYPES[o.type].speedMul;
    if (score < bs) { bs = score; best = o.id; }
  }
  return best;
}
function killPerson(p) {
  if (p.dead) return;
  p.dead = true;
  if (p.state === 'wait' && p.leg) {
    const q = R.queues[p.leg.id] && R.queues[p.leg.id][p.leg.from];
    if (q) for (const k of ['up', 'down']) { const i = q[k].indexOf(p); if (i >= 0) q[k].splice(i, 1); }
  }
  if (p.state === 'ride' && p.car) { const i = p.car.pass.indexOf(p); if (i >= 0) p.car.pass.splice(i, 1); }
}
function recordStress(id, s) {
  const r = S.objects[id];
  if (!r || r.kind !== 'room') return;
  r.sSum += Math.min(100, s); r.sN++;
}

function updatePerson(p, dt) {
  switch (p.state) {
    case 'walk': {
      const d = p.tx - p.x, step = p.spd * dt;
      if (Math.abs(d) <= step) { p.x = p.tx; atWaypoint(p); }
      else { p.dir = Math.sign(d); p.x += p.dir * step; }
      p.phase += dt * 9;
      break;
    }
    case 'wait':
      p.wait += dt;
      if (p.wait > 4) p.stress += dt * 1.6;
      if (p.wait > 110) { recordStress(p.homeId, 100); killPerson(p); }
      break;
    case 'stairs': {
      p.t += dt;
      const L = p.legs[p.li];
      const o = S.objects[L.id];
      if (!o) { killPerson(p); break; }
      const k = Math.min(1, p.t / STAIR_TIME);
      const sx = L.to > L.from ? o.x + 0.6 : o.x + o.w - 0.6;
      const ex = L.to > L.from ? o.x + o.w - 0.6 : o.x + 0.6;
      p.x = sx + (ex - sx) * k;
      p.climb = (L.to > L.from ? k : 1 - k);
      p.phase += dt * 9;
      if (k >= 1) { p.f = L.to; p.climb = 0; p.li++; nextLeg(p); }
      break;
    }
  }
}
function atWaypoint(p) {
  if (p.li < p.legs.length) {
    const L = p.legs[p.li];
    const o = S.objects[L.id];
    if (!o) return killPerson(p);
    if (L.k === 'e') {
      const q = R.queues[o.id][L.from] || (R.queues[o.id][L.from] = { up: [], down: [] });
      q[L.to > L.from ? 'up' : 'down'].push(p);
      p.leg = L; p.state = 'wait'; p.wait = 0;
    } else {
      p.state = 'stairs'; p.t = 0; p.stress += 1.5;
    }
    return;
  }
  arrive(p);
}

function arrive(p) {
  p.dead = true;
  const r = S.objects[p.roomId];
  switch (p.purpose) {
    case 'work': case 'home': case 'checkin':
      if (r) { r.present++; recordStress(r.id, p.stress); }
      break;
    case 'leave':
      recordStress(p.homeId, p.stress);
      break;
    case 'visit': {
      if (p.returnTo) recordStress(p.returnTo, p.stress);
      if (!r) break;
      const T = TYPES[r.type];
      if (r.present >= T.cap) {
        recordStress(r.id, 60);
        if (p.returnTo) addEvent(nowT() + 2, () => returnHome(r.id, p.returnTo, true));
        break;
      }
      recordStress(r.id, p.stress);
      r.present++;
      earn(T.price, T.name);
      r.todayIncome += T.price; r.income += T.price;
      const stay = r.type === 'cinema' ? randInt(110, 140) : r.type === 'shop' ? randInt(15, 40) : randInt(25, 55);
      const back = p.returnTo;
      addEvent(nowT() + stay, () => returnHome(r.id, back, false));
      break;
    }
  }
}

function enterFromOutside(roomId, purpose, cls) {
  const r = S.objects[roomId];
  if (!r) return;
  const ex = exitX();
  if (ex === null) { recordStress(roomId, 90); return; }
  const p = spawnTrip({ fromF: 0, fromX: ex, toF: r.f, toX: r.x + rng(1, r.w - 1), purpose, roomId, homeId: roomId, cls });
  if (!p) recordStress(roomId, 90);
}
function leaveRoom(roomId, cls) {
  const r = S.objects[roomId];
  if (!r || r.present <= 0) return;
  const ex = exitX();
  if (ex === null) return;
  r.present--;
  const p = spawnTrip({ fromF: r.f, fromX: r.x + rng(1, r.w - 1), toF: 0, toX: ex, purpose: 'leave', roomId: null, homeId: roomId, cls });
  if (!p) { r.present++; recordStress(roomId, 70); }
}
function visitFromOutside(roomId) {
  if (R.people.length > MAX_PEOPLE) return;
  const r = S.objects[roomId];
  if (!r) return;
  const ex = exitX();
  if (ex === null) return;
  spawnTrip({ fromF: 0, fromX: ex, toF: r.f, toX: r.x + rng(1, r.w - 1), purpose: 'visit', roomId, homeId: roomId, cls: 'visitor' });
}
function outing(fromId, types, cls) {
  const from = S.objects[fromId];
  if (!from || from.present <= 0) return;
  const cands = allRooms().filter(r => types.includes(r.type));
  if (!cands.length) return;
  const dest = pick(cands);
  from.present--;
  const p = spawnTrip({ fromF: from.f, fromX: from.x + rng(1, from.w - 1), toF: dest.f, toX: dest.x + rng(1, dest.w - 1), purpose: 'visit', roomId: dest.id, homeId: dest.id, returnTo: fromId, cls });
  if (!p) { from.present++; recordStress(fromId, 50); }
}
function returnHome(visitId, returnTo, rejected) {
  const v = S.objects[visitId];
  if (v && !rejected) v.present = Math.max(0, v.present - 1);
  if (!v) return;
  const fromX = v.x + rng(1, v.w - 1);
  if (returnTo && S.objects[returnTo]) {
    const h = S.objects[returnTo];
    const p = spawnTrip({ fromF: v.f, fromX, toF: h.f, toX: h.x + rng(1, h.w - 1), purpose: h.type === 'office' ? 'work' : h.type === 'apartment' ? 'home' : 'checkin', roomId: h.id, homeId: h.id, cls: h.type === 'office' ? 'office' : h.type === 'apartment' ? 'resident' : 'guest' });
    if (!p) h.present++;
  } else {
    const ex = exitX();
    if (ex === null) return;
    spawnTrip({ fromF: v.f, fromX, toF: 0, toX: ex, purpose: 'leave', roomId: null, homeId: visitId, cls: 'visitor' });
  }
}

/* ---------- kiracılar ve otel ---------- */
function tryLease(id) {
  const r = S.objects[id];
  if (!r || r.tenant) return;
  if (!reachable(r.f)) { r.noAccess = true; return; }
  r.noAccess = false;
  const chance = 0.55 + S.stars * 0.05;
  if (Math.random() < chance) {
    const T = TYPES[r.type];
    r.tenant = true; r.badDays = 0; r.avgStress = 0; r.sSum = 0; r.sN = 0;
    r.present = r.type === 'apartment' ? T.cap : 0;
    UI.toast(`${T.icon} Yeni kiracı: ${T.name} · ${floorName(r.f)}`, 'good');
    computePop();
  }
}
function tryCheckin(id) {
  const r = S.objects[id];
  if (!r || r.guest) return;
  if (!reachable(r.f)) { r.noAccess = true; return; }
  r.noAccess = false;
  const p = 0.35 + S.stars * 0.1 - r.avgStress / 180;
  if (Math.random() < p) {
    r.guest = true;
    r.guestN = randInt(1, TYPES[r.type].cap);
    for (let i = 0; i < r.guestN; i++) addEvent(nowT() + i * 2 + 1, () => enterFromOutside(id, 'checkin', 'guest'));
    computePop();
  }
}
function checkout(id) {
  const r = S.objects[id];
  if (!r || !r.guest) return;
  const T = TYPES[r.type];
  const tip = r.avgStress < 25 ? 1.1 : r.avgStress > 55 ? 0.7 : 1;
  const pay = Math.round(T.price * tip);
  earn(pay, 'Otel'); r.todayIncome += pay; r.income += pay;
  const n = r.present;
  for (let i = 0; i < n; i++) addEvent(nowT() + i * 2 + 1, () => leaveRoom(id, 'guest'));
  r.guest = false; r.guestN = 0;
  const t = S.time;
  if (t < 1260) addEvent(S.day * DAY + randInt(Math.max(t + 30, 960), 1290), () => tryCheckin(id));
  computePop();
}

/* ---------- günlük plan ---------- */
function scheduleRoom(r, d, fromT) {
  const base = d * DAY;
  const weekend = d % 7 >= 5;
  const at = (min, fn) => { const t = base + min; if (t >= fromT) addEvent(t, fn); };
  const T = TYPES[r.type];
  const id = r.id;
  const hasFood = allRooms().some(o => o.type === 'restaurant');
  const demand = 1 - Math.min(0.8, r.avgStress / 120);
  switch (r.type) {
    case 'office':
      if (!r.tenant) { at(randInt(500, 1000), () => tryLease(id)); break; }
      if (weekend) break;
      for (let i = 0; i < T.cap; i++) {
        at(randInt(450, 560), () => enterFromOutside(id, 'work', 'office'));
        if (hasFood && Math.random() < 0.45) at(randInt(705, 770), () => outing(id, ['restaurant'], 'office'));
        at(randInt(1020, 1140), () => leaveRoom(id, 'office'));
      }
      break;
    case 'apartment':
      if (!r.tenant) { at(randInt(540, 1080), () => tryLease(id)); break; }
      for (let i = 0; i < T.cap; i++) {
        if (!weekend) {
          if (Math.random() < 0.85) {
            at(randInt(400, 540), () => leaveRoom(id, 'resident'));
            at(randInt(1020, 1260), () => enterFromOutside(id, 'home', 'resident'));
          }
        } else if (Math.random() < 0.6) {
          const t0 = randInt(600, 900);
          at(t0, () => leaveRoom(id, 'resident'));
          at(t0 + randInt(120, 300), () => enterFromOutside(id, 'home', 'resident'));
        }
        if (Math.random() < 0.2) at(randInt(1150, 1250), () => outing(id, ['restaurant', 'shop', 'cinema'], 'resident'));
      }
      break;
    case 'hotel': case 'suite':
      if (r.guest) {
        at(randInt(450, 630), () => checkout(id));
        if (hasFood && Math.random() < 0.4) at(randInt(1140, 1230), () => outing(id, ['restaurant', 'cinema'], 'guest'));
      } else at(randInt(960, 1290), () => tryCheckin(id));
      break;
    case 'restaurant': {
      const nL = Math.round(Math.min(T.cap * 1.4, 3 + S.pop * 0.025 + S.stars * 1.5) * (weekend ? 0.6 : 1) * demand);
      const nD = Math.round(Math.min(T.cap * 1.2, 4 + S.pop * 0.02 + S.stars * 2) * (weekend ? 1.3 : 1) * demand);
      for (let i = 0; i < nL; i++) at(randInt(690, 810), () => visitFromOutside(id));
      for (let i = 0; i < nD; i++) at(randInt(1080, 1230), () => visitFromOutside(id));
      break;
    }
    case 'shop': {
      const n = Math.round(Math.min(40, 4 + S.pop * 0.02 + S.stars * 3) * (weekend ? 1.5 : 1) * demand);
      for (let i = 0; i < n; i++) at(randInt(600, 1200), () => visitFromOutside(id));
      break;
    }
    case 'cinema': {
      const n = Math.round(Math.min(150, 15 + S.pop * 0.04 + S.stars * 8) * (weekend ? 1.6 : 1) * demand);
      for (let i = 0; i < n; i++) at(randInt(780, 1320), () => visitFromOutside(id));
      break;
    }
  }
}
function scheduleDay(d, fromT) {
  for (const r of allRooms()) scheduleRoom(r, d, fromT);
  if (d * DAY + 180 >= fromT) addEvent(d * DAY + 180, dailyUpdate);
}

function resetRuntimePeople() {
  R.people = [];
  for (const id in R.queues) R.queues[id] = {};
  for (const id in R.cars) for (const c of R.cars[id]) { c.pass = []; if (c.state !== 'moving') { c.state = 'idle'; c.dir = 0; } }
  for (const r of allRooms()) {
    const T = TYPES[r.type];
    if (r.type === 'apartment') r.present = r.tenant ? T.cap : 0;
    else if (r.type === 'hotel' || r.type === 'suite') r.present = r.guest ? r.guestN : 0;
    else r.present = 0;
  }
}

function dailyUpdate() {
  resetRuntimePeople();
  for (const r of allRooms()) {
    const T = TYPES[r.type];
    r.avgStress = r.sN > 0 ? (r.sSum / r.sN) * 0.7 + r.avgStress * 0.3 : r.avgStress * 0.8;
    r.sSum = 0; r.sN = 0;
    r.lastIncome = r.todayIncome; r.todayIncome = 0;
    if ((r.type === 'office' || r.type === 'apartment') && r.tenant) {
      earn(T.rent, 'Kira'); r.todayIncome += T.rent; r.income += T.rent;
      if (r.avgStress > 50) {
        if (++r.badDays >= 3) {
          r.tenant = false; r.present = 0; r.badDays = 0; r.avgStress = 0;
          UI.toast(`😤 ${T.name} kiracısı taşındı (${floorName(r.f)}) — stres çok yüksekti`, 'bad');
        }
      } else r.badDays = 0;
    }
    if (T.maint) spend(T.maint, 'Bakım');
  }
  for (const o of allShafts()) spend(TYPES[o.type].maint * (1 + 0.5 * (o.nCars - 1)), 'Bakım');
  computePop();
}

function computePop() {
  let pop = 0;
  for (const r of allRooms()) {
    const T = TYPES[r.type];
    if ((r.type === 'office' || r.type === 'apartment') && r.tenant) pop += T.cap;
    else if ((r.type === 'hotel' || r.type === 'suite') && r.guest) pop += r.guestN;
    else if (r.type === 'restaurant') pop += 10;
    else if (r.type === 'shop') pop += 6;
    else if (r.type === 'cinema') pop += 30;
  }
  S.pop = pop;
  let st = S.stars;
  while (st < 5 && pop >= STAR_POP[st + 1]) st++;
  if (st > S.stars) {
    S.stars = st;
    const un = BUILD_ORDER.filter(k => TYPES[k].star === st).map(k => TYPES[k].name);
    UI.toast(`⭐ Kuleniz ${st} yıldıza yükseldi!${un.length ? ' Yeni: ' + un.join(', ') : ''}`, 'star');
    UI.refreshTools();
  }
}

function endDay() {
  S.history.push({ day: S.day, income: S.today.income, expense: S.today.expense, money: S.money, pop: S.pop, cats: S.today.cats });
  if (S.history.length > 60) S.history.shift();
  S.today = newLedger();
}

/* ---------- asansör mantığı ---------- */
function requestsBeyond(o, car, from, dir) {
  for (const p of car.pass) if ((p.leg.to - from) * dir > 0) return true;
  const Q = R.queues[o.id];
  for (const f of R.stops[o.id]) {
    if ((f - from) * dir > 0) { const q = Q[f]; if (q && (q.up.length || q.down.length)) return true; }
  }
  return false;
}
function loadCar(o, car, f) {
  if (car.dir === 0) return;
  const q = R.queues[o.id][f];
  if (!q) return;
  const arr = car.dir > 0 ? q.up : q.down;
  while (arr.length && car.pass.length < CAR_CAP) {
    const p = arr.shift();
    p.state = 'ride'; p.car = car;
    car.pass.push(p);
  }
}
function openDoors(o, car, f, dir) {
  car.state = 'doors'; car.timer = DOOR_TIME; car.f = f; car.y = f;
  const keep = [];
  for (const p of car.pass) {
    if (p.leg.to === f) {
      p.f = f; p.x = o.x + o.w / 2 + rng(-1, 1); p.car = null; p.li++;
      nextLeg(p);
    } else keep.push(p);
  }
  car.pass = keep;
  if (!(dir !== 0 && (car.pass.length || requestsBeyond(o, car, f, dir)))) {
    const q = R.queues[o.id][f];
    const upQ = q && q.up.length, dnQ = q && q.down.length;
    if (dir > 0 && upQ) dir = 1;
    else if (dir < 0 && dnQ) dir = -1;
    else if (upQ) dir = 1;
    else if (dnQ) dir = -1;
    else if (requestsBeyond(o, car, f, 1)) dir = 1;
    else if (requestsBeyond(o, car, f, -1)) dir = -1;
    else dir = 0;
  }
  car.dir = dir;
  loadCar(o, car, f);
}
function checkStop(o, car, f) {
  const q = R.queues[o.id][f];
  const unload = car.pass.some(p => p.leg.to === f);
  const board = q && q[car.dir > 0 ? 'up' : 'down'].length && car.pass.length < CAR_CAP;
  const beyond = requestsBeyond(o, car, f, car.dir);
  const turn = !beyond && q && (q.up.length || q.down.length);
  if (unload || board || turn) { openDoors(o, car, f, car.dir); return true; }
  if (!beyond && !car.pass.length) { car.y = f; car.dir = 0; car.state = 'idle'; return true; }
  return false;
}
function updateCar(o, car, dt) {
  if (car.state === 'doors') {
    car.timer -= dt;
    if (car.timer <= 0) {
      loadCar(o, car, car.f);
      if (car.dir !== 0 && (car.pass.length || requestsBeyond(o, car, car.f, car.dir))) car.state = 'moving';
      else { car.dir = 0; car.state = 'idle'; }
    }
    return;
  }
  if (car.state === 'idle') {
    if (car.pass.length) { car.dir = car.pass[0].leg.to > car.y ? 1 : -1; car.state = 'moving'; return; }
    const Q = R.queues[o.id];
    let best = null, bd = Infinity;
    for (const f of R.stops[o.id]) {
      const q = Q[f];
      if (q && (q.up.length || q.down.length)) { const d = Math.abs(f - car.y); if (d < bd) { bd = d; best = f; } }
    }
    if (best === null) return;
    if (bd < 0.01) openDoors(o, car, best, 0);
    else { car.dir = best > car.y ? 1 : -1; car.state = 'moving'; }
    return;
  }
  const prev = car.y;
  const ny = prev + car.dir * ELEV_SPEED * TYPES[o.type].speedMul * dt;
  const stops = R.stops[o.id];
  if (car.dir > 0) {
    for (let i = 0; i < stops.length; i++) { const f = stops[i]; if (f > prev + 1e-6 && f <= ny + 1e-9 && checkStop(o, car, f)) return; }
  } else {
    for (let i = stops.length - 1; i >= 0; i--) { const f = stops[i]; if (f < prev - 1e-6 && f >= ny - 1e-9 && checkStop(o, car, f)) return; }
  }
  car.y = clamp(ny, o.bottom, o.top);
  if ((car.y >= o.top && car.dir > 0) || (car.y <= o.bottom && car.dir < 0)) { car.dir = 0; car.state = 'idle'; }
}

/* ---------- zaman adımı ---------- */
function simStep(dt) {
  S.time += dt;
  if (S.time >= DAY) {
    S.time -= DAY;
    endDay();
    S.day++;
    scheduleDay(S.day, nowT());
    if (typeof autoSave === 'function') autoSave();
  }
  runEvents(nowT());
  for (const p of R.people) if (!p.dead) updatePerson(p, dt);
  for (const o of allShafts()) for (const car of R.cars[o.id]) updateCar(o, car, dt);
  if (R.people.some(p => p.dead)) R.people = R.people.filter(p => !p.dead);
}

/* ---------- başlatma / kayıt ---------- */
function rebuildRuntime() {
  R.grid = new Map(); R.sgrid = new Map(); R.people = []; R.events = []; R.cars = {}; R.queues = {}; R.stops = {};
  for (const o of Object.values(S.objects)) {
    stamp(o, o.id);
    if (o.kind === 'shaft') initShaftRuntime(o);
  }
  structureChanged();
  resetRuntimePeople();
  scheduleDay(S.day, nowT());
}
function startNewGame() {
  S = newState();
  rebuildRuntime();
}
function serialize() { return JSON.stringify(S); }
function loadFrom(json) {
  const s = JSON.parse(json);
  if (!s || s.v !== 1 || !s.objects) throw new Error('Geçersiz kayıt');
  S = s;
  rebuildRuntime();
}
