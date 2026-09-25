// Googly Workshop — the game itself: four grocery stores on one street, shoppers, staff, computer owners,
// the wholesale market and the month clock. It runs on the online server, and inside the page for solo play,
// so both speak exactly the same messages.
import * as D from './data.js';

const { PRODUCTS, PROD, SLOTS, FIXTURES, STAFF, UP, CPUS } = D;
const r2 = v => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
const clampI = (v, a, b) => { v = Math.round(Number(v)); return Number.isFinite(v) ? clamp(v, a, b) : a; };
const MAX_HUMANS = 4;
const SHOPPER_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#e8d5b0', '#a9e34b', '#63e6be', '#c0eb75', '#ff8787', '#91a7ff', '#faa2c1'];

// ------------------------------------------------------------------ walking grid (same for every store; store-local)
const CELL = 0.4, NX = Math.round(D.STORE_W / CELL), NZ = Math.round(D.STORE_D / CELL);
function buildNav(staff) {
  const open = new Uint8Array(NX * NZ);
  const boxes = [...D.solidBoxes(), ...D.wallBoxes()];
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
    const x = -D.STORE_W / 2 + (ix + 0.5) * CELL, z = -(iz + 0.5) * CELL;
    let ok = x > -D.STORE_W / 2 + 0.45 && x < D.STORE_W / 2 - 0.45 && z < -0.35 && z > -D.STORE_D + 0.45;
    if (!staff && z < D.PARTITION_Z + 0.3) ok = false;
    for (const b of boxes) if (Math.abs(x - b.x) < b.w / 2 + 0.36 && Math.abs(z - b.z) < b.d / 2 + 0.36) { ok = false; break; }
    open[iz * NX + ix] = ok ? 1 : 0;
  }
  return open;
}
const NAV_C = buildNav(false), NAV_S = buildNav(true);
const cellOf = (x, z) => [clamp(Math.floor((x + D.STORE_W / 2) / CELL), 0, NX - 1), clamp(Math.floor(-z / CELL), 0, NZ - 1)];
const cellPos = (ix, iz) => [-D.STORE_W / 2 + (ix + 0.5) * CELL, -(iz + 0.5) * CELL];
function nearestOpen(nav, ix, iz) {
  if (nav[iz * NX + ix]) return [ix, iz];
  for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = ix + dx, z = iz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
    if (nav[z * NX + x]) return [x, z];
  }
  return [ix, iz];
}
function lineOpen(nav, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (CELL * 0.5));
  for (let i = 1; i < n; i++) { const [ix, iz] = cellOf(ax + (bx - ax) * i / n, az + (bz - az) * i / n); if (!nav[iz * NX + ix]) return false; }
  return true;
}
/** A* on the store grid, local coords in and out. Returns a list of [x, z] points ending at the goal. */
export function findPath(nav, ax, az, bx, bz) {
  const [sx, sz] = nearestOpen(nav, ...cellOf(ax, az)), [gx, gz] = nearestOpen(nav, ...cellOf(bx, bz));
  const S = sz * NX + sx, G = gz * NX + gx;
  const g = new Float32Array(NX * NZ).fill(1e9), from = new Int32Array(NX * NZ).fill(-1), closed = new Uint8Array(NX * NZ);
  const open = [S]; g[S] = 0;
  const h = i => Math.hypot(i % NX - gx, Math.floor(i / NX) - gz);
  while (open.length) {
    let bi = 0, bf = 1e9;
    for (let k = 0; k < open.length; k++) { const f = g[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
    const cur = open.splice(bi, 1)[0];
    if (cur === G) break;
    closed[cur] = 1;
    const cx = cur % NX, cz = Math.floor(cur / NX);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const ni = nz * NX + nx; if (!nav[ni] || closed[ni]) continue;
      if (dx && dz && (!nav[cz * NX + nx] || !nav[nz * NX + cx])) continue;
      const ng = g[cur] + (dx && dz ? 1.414 : 1);
      if (ng < g[ni]) { if (g[ni] >= 1e9) open.push(ni); g[ni] = ng; from[ni] = cur; }
    }
  }
  const cells = []; let c = G;
  if (from[G] < 0 && G !== S) return [[bx, bz]];
  while (c >= 0 && c !== S) { cells.push(cellPos(c % NX, Math.floor(c / NX))); c = from[c]; }
  cells.reverse();
  // string-pull: skip corners we can see past
  const pts = []; let ox = ax, oz = az;
  for (let i = 0; i < cells.length; i++) {
    const nxt = cells[i + 1];
    if (nxt && lineOpen(nav, ox, oz, nxt[0], nxt[1])) continue;
    pts.push(cells[i]); [ox, oz] = cells[i];
  }
  pts.push([bx, bz]);
  return pts;
}

// ------------------------------------------------------------------ stores
function newStore(i) {
  const cpu = CPUS[i];
  const s = {
    i, ownerId: 0, ownerName: cpu.name, color: cpu.color, name: cpu.store, style: cpu.style,
    cash: D.START_CASH, rating: 3.6, fixtures: SLOTS.map(() => false), secs: SLOTS.map(() => [{ p: null, n: 0 }, { p: null, n: 0 }]),
    back: {}, prices: {}, staff: { cashier: 0, cashier2: 0, stocker: 0, janitor: 0 }, perm: {}, ad: 0, adDays: 0,
    today: blankDay(), sold: {}, soldY: {}, pricey: {}, history: [], queue: [], sc: 0, carry: null,
    boss: null, workers: [], humanScan: false, pos: null, dirty: true, spent: 0, served: 0,
  };
  for (const p of PRODUCTS) { s.prices[p.id] = p.ref; s.back[p.id] = 0; }
  for (const st of D.START_SLOTS) {
    s.fixtures[st.slot] = true;
    st.secs.forEach((pid, k) => { s.secs[st.slot][k] = { p: pid, n: FIXTURES[SLOTS[st.slot].kind].cap }; s.back[pid] = D.BOX; });
  }
  return s;
}
const blankDay = () => ({ gaveup: 0, empty: 0, cut: 0, rev: 0, cogs: 0, costs: 0, served: 0, lost: 0, pricey: 0, oos: 0, walked: 0, units: 0, spoiled: 0 });
const localToWorld = (s, x, z) => [D.storeX(s.i) + x, z];
const worldToLocal = (s, x, z) => [x - D.storeX(s.i), z];
function sectionsFor(s, pid) { const out = []; SLOTS.forEach((sl, k) => { if (!s.fixtures[k]) return; s.secs[k].forEach((sec, j) => { if (sec.p === pid) out.push([k, j]); }); }); return out; }
const carries = (s, pid) => sectionsFor(s, pid).length > 0;
const onShelf = (s, pid) => sectionsFor(s, pid).reduce((a, [k, j]) => a + s.secs[k][j].n, 0);
function pubStore(s) {
  return {
    i: s.i, ownerId: s.ownerId, ownerName: s.ownerName, color: s.color, name: s.name, cash: Math.round(s.cash), rating: r2(s.rating),
    fixtures: s.fixtures, secs: s.secs, back: s.back, prices: s.prices, staff: s.staff, perm: s.perm, ad: s.ad, adDays: s.adDays,
    today: s.today, q: s.queue.length, tills: s.tills || [0, 0], sc: s.sc, carry: s.carry, history: s.history, soldY: s.soldY, sold: s.sold, pricey: s.pricey,
  };
}

// ------------------------------------------------------------------ the core
export class Core {
  constructor({ local = false } = {}) {
    this.local = local; this.rooms = new Map(); this.clients = new Map(); this.nextId = 1; this.nextCid = 1; this.nextW = 1; this.nextSpill = 1;
  }
  /** A browser connected. `send(msg)` delivers to it. Returns the handle the transport feeds messages into. */
  connect(send) {
    const c = { id: this.nextId++, send, name: 'GOOGLY', color: '#9aa0a6', room: null };
    this.clients.set(c.id, c);
    send({ t: 'hello', id: c.id });
    return { id: c.id, recv: m => { try { this.onMsg(c, m); } catch (e) { console.error('msg', m && m.t, e); } }, close: () => this.drop(c) };
  }
  drop(c) { this.leave(c); this.clients.delete(c.id); }
  code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let k; do { k = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (this.rooms.has(k)); return k; }
  bcast(r, m) { for (const c of r.members.values()) c.send(m); }
  humans(r) { return [...r.members.values()]; }

  makeRoom(opts = {}) {
    const r = {
      code: this.code(), public: !!opts.public, solo: !!opts.solo, hostId: 0, members: new Map(), settings: { diff: 1 },
      state: 'lobby', day: 1, t: 0, paused: false, stores: [], customers: [], spills: [], trucks: [], event: null, whole: {},
      snapAcc: 0, storeAcc: 0, brainAcc: 0, spawnAcc: 0, standings: null, closingRung: false, openRung: false,
    };
    this.rooms.set(r.code, r);
    return r;
  }
  roomInfo(r) {
    const seats = this.seats(r);
    return { code: r.code, public: r.public, solo: r.solo, host: r.hostId, state: r.state, settings: r.settings, day: r.day, seats, players: this.humans(r).map(c => ({ id: c.id, name: c.name, color: c.color, host: c.id === r.hostId })) };
  }
  seats(r) {
    const hs = this.humans(r);
    if (r.state === 'lobby') return CPUS.map((cpu, i) => hs[i] ? { human: true, name: hs[i].name, color: hs[i].color, id: hs[i].id } : { human: false, name: cpu.name, color: cpu.color, store: cpu.store });
    return r.stores.map(s => ({ human: !!s.ownerId, name: s.ownerName, color: s.color, id: s.ownerId, store: s.name }));
  }
  pushLobby(r) { this.bcast(r, { t: 'room', room: this.roomInfo(r) }); }
  listRooms() {
    return [...this.rooms.values()].filter(r => r.public && !r.solo && r.members.size).map(r => ({ code: r.code, host: this.humans(r).find(c => c.id === r.hostId)?.name || '?', humans: r.members.size, state: r.state, day: r.day, diff: D.DIFF[r.settings.diff] }));
  }
  join(c, r) {
    if (c.room) this.leave(c);
    if (r.members.size >= MAX_HUMANS) return c.send({ t: 'err', msg: 'That lobby is full (4 shop owners).' });
    if (r.state === 'play' && !r.stores.some(s => !s.ownerId)) return c.send({ t: 'err', msg: 'Every store in that game already has a human owner.' });
    c.room = r; r.members.set(c.id, c);
    if (!r.hostId || !r.members.has(r.hostId)) r.hostId = c.id;
    c.send({ t: 'joined', code: r.code, solo: r.solo });
    this.sys(r, `${c.name} joined`);
    if (r.state === 'play') {
      // take over a store a computer was running
      const s = r.stores.find(s => !s.ownerId);
      this.giveStore(r, s, c);
      c.send(this.startMsg(r));
      this.sys(r, `${c.name} took over ${s.name}`);
    }
    this.pushLobby(r);
  }
  giveStore(r, s, c) {
    s.ownerId = c.id; s.ownerName = c.name; s.color = c.color; s.name = storeName(c);
    if (s.boss) { s.pos = { x: s.boss.x, z: s.boss.z, yaw: s.boss.yaw }; s.workers = s.workers.filter(w => w !== s.boss); s.boss = null; }
    else s.pos = { x: D.storeX(s.i), z: -3, yaw: 0 };
    s.carry = null; s.dirty = true;
  }
  leave(c) {
    const r = c.room; if (!r) return;
    r.members.delete(c.id); c.room = null;
    if (!r.members.size) { this.rooms.delete(r.code); return; }
    if (r.hostId === c.id) r.hostId = this.humans(r)[0].id;
    const s = r.stores.find(s => s.ownerId === c.id);
    if (s) { // a computer keeps the lights on
      if (s.carry) { s.back[s.carry.p] += s.carry.n; s.carry = null; }
      s.ownerId = 0; s.humanScan = false; spawnBoss(this, s); s.dirty = true;
      this.bcast(r, { t: 'owner', i: s.i, ownerId: 0 });
    }
    this.sys(r, `${c.name} left${s ? ' — a computer runs their store now' : ''}`);
    this.pushLobby(r);
  }
  sys(r, text) { this.bcast(r, { t: 'chat', sys: true, text }); }

  // ---------------------------------------------------------------- game start / save / end
  start(r, save) {
    r.state = 'play';
    if (save) Object.assign(r, restore(save));
    else {
      r.day = 1; r.t = 0; r.customers = []; r.spills = []; r.trucks = [];
      r.stores = CPUS.map((_, i) => newStore(i));
      for (const p of PRODUCTS) r.whole[p.id] = 1;
      r.event = rollEvent(r);
    }
    const hs = this.humans(r);
    r.stores.forEach((s, i) => {
      if (save) {
        // a saved solo month: you own the store you owned
        const c = s.ownerId ? hs[0] : null;
        if (c) this.giveStore(r, s, c); else { s.ownerId = 0; }
      } else if (hs[i]) this.giveStore(r, s, hs[i]);
      s.workers = []; s.boss = null; s.queue = []; s.tills = [0, 0]; s.diff = r.settings.diff;
      for (const role of Object.keys(STAFF)) if (s.staff[role]) addWorker(this, s, role);
      if (!s.ownerId) spawnBoss(this, s);
    });
    r.customers = [];
    this.bcast(r, this.startMsg(r));
    this.pushLobby(r);
  }
  startMsg(r) {
    return { t: 'start', day: r.day, tt: r.t, diff: r.settings.diff, solo: r.solo, event: r.event, whole: r.whole, stores: r.stores.map(pubStore), spills: r.spills, code: r.code };
  }
  saveData(r) {
    return {
      v: 1, day: r.day, t: r.t, settings: r.settings, event: r.event, whole: r.whole, spills: [],
      stores: r.stores.map(s => ({ ...pubStore(s), style: s.style, spent: s.spent, served: s.served, queue: [], carry: null, workers: undefined })),
    };
  }
  endGame(r) {
    r.state = 'end';
    const st = r.stores.map(s => ({ i: s.i, name: s.name, owner: s.ownerName, color: s.color, human: !!s.ownerId, ownerId: s.ownerId, cash: Math.round(s.cash), stock: Math.round(stockValue(s, r)), rating: r2(s.rating), served: s.served, history: s.history }))
      .map(x => ({ ...x, worth: x.cash + x.stock })).sort((a, b) => b.worth - a.worth);
    r.standings = st;
    this.bcast(r, { t: 'end', standings: st });
    r.state = 'lobby';
    this.pushLobby(r);
  }

  // ---------------------------------------------------------------- messages
  onMsg(c, m) {
    const r = c.room;
    const s = r && r.state === 'play' ? r.stores.find(s => s.ownerId === c.id) : null;
    switch (m.t) {
      case 'me': c.name = clean(m.name, 14).toUpperCase() || 'GOOGLY'; c.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#9aa0a6'; c.storeName = clean(m.store, 22).toUpperCase(); if (r) this.pushLobby(r); break;
      case 'list': c.send({ t: 'list', rooms: this.listRooms() }); break;
      case 'solo': { const nr = this.makeRoom({ solo: true }); nr.settings.diff = clampI(m.diff, 0, 2); this.join(c, nr); this.start(nr, m.save || null); break; }
      case 'create': { const nr = this.makeRoom({ public: m.public }); nr.settings.diff = clampI(m.diff ?? 1, 0, 2); this.join(c, nr); break; }
      case 'join': { const nr = this.rooms.get(String(m.code || '').toUpperCase().trim()); if (!nr || nr.solo) c.send({ t: 'err', msg: 'No lobby with that code. Check the letters and try again.' }); else this.join(c, nr); break; }
      case 'leave': this.leave(c); c.send({ t: 'left' }); break;
      case 'set': if (r && r.hostId === c.id && r.state === 'lobby') { if (m.diff !== undefined) r.settings.diff = clampI(m.diff, 0, 2); if (m.public !== undefined) r.public = !!m.public; this.pushLobby(r); } break;
      case 'start': if (r && r.hostId === c.id && r.state === 'lobby') this.start(r); break;
      case 'chat': if (r) { const text = clean(m.text, 120); if (text) this.bcast(r, { t: 'chat', from: c.name, color: c.color, text }); } break;
      case 'pause': if (r && r.solo) { r.paused = !!m.on; } break;
      case 'save': if (r && r.solo && r.state === 'play') c.send({ t: 'save', data: this.saveData(r) }); break;
      case 'pos': if (s && [m.x, m.z, m.yaw].every(Number.isFinite)) { s.pos = { x: m.x, z: m.z, yaw: m.yaw }; } break;
      default: if (s) this.action(r, s, c, m);
    }
  }
  near(s, lx, lz, d = 2.6) { if (!s.pos) return false; const [x, z] = worldToLocal(s, s.pos.x, s.pos.z); return Math.hypot(x - lx, z - lz) < d; }
  action(r, s, c, m) {
    const err = msg => c.send({ t: 'err', msg });
    switch (m.t) {
      case 'hold': s.humanScan = !!m.on; break;
      case 'pick': {
        const p = PROD[m.p]; if (!p) return;
        if (s.carry) return err('Your hands are full.');
        if (!this.near(s, D.STOCK_RACK[0], D.STOCK_RACK[1], 3.4)) return err('Go to the stockroom rack to grab a box.');
        const n = Math.min(D.CARRY, s.back[p.id] || 0); if (!n) return err(`No ${p.name} in the stockroom — buy some (B).`);
        s.back[p.id] -= n; s.carry = { p: p.id, n }; s.dirty = true;
        this.bcast(r, { t: 'fx', k: 'boxUp', i: s.i, x: s.pos.x, z: s.pos.z });
        break;
      }
      case 'return': if (s.carry && this.near(s, D.STOCK_RACK[0], D.STOCK_RACK[1], 3.4)) { s.back[s.carry.p] += s.carry.n; s.carry = null; s.dirty = true; } break;
      case 'place': {
        const k = clampI(m.slot, 0, SLOTS.length - 1), j = clampI(m.sec, 0, 1), sl = SLOTS[k];
        if (!s.carry) return; if (!s.fixtures[k]) return err('Buy this fixture first (U).');
        const p = PROD[s.carry.p], f = FIXTURES[sl.kind], sec = s.secs[k][j];
        if (p.kind !== sl.kind) return err(`${p.name} doesn't go on a ${f.name.toLowerCase()} — it needs a ${FIXTURES[p.kind].name.toLowerCase()}.`);
        if (!this.near(s, sl.stand[j][0], sl.stand[j][1], 2.8)) return;
        if (sec.p && sec.p !== p.id && sec.n > 0) return err(`That spot still has ${PROD[sec.p].name} on it.`);
        if (sec.p !== p.id) { sec.p = p.id; sec.n = 0; }
        const mv = Math.min(s.carry.n, f.cap - sec.n); if (mv <= 0) return err('That spot is already full.');
        sec.n += mv; s.carry.n -= mv; if (!s.carry.n) s.carry = null; s.dirty = true;
        this.bcast(r, { t: 'fx', k: 'boxDown', i: s.i, slot: k, sec: j });
        break;
      }
      case 'assign': { // choose what an empty spot sells (from the stock screen)
        const k = clampI(m.slot, 0, SLOTS.length - 1), j = clampI(m.sec, 0, 1), sec = s.secs[k][j];
        if (!s.fixtures[k]) return; if (sec.n > 0) return err('Sell out or restock that spot first.');
        if (m.p === null) { sec.p = null; s.dirty = true; return; }
        const p = PROD[m.p]; if (!p || p.kind !== SLOTS[k].kind) return;
        sec.p = p.id; s.dirty = true; break;
      }
      case 'mop': { const sp = r.spills.find(x => x.id === m.id && x.s === s.i); if (sp && s.pos && Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z) < 2.6) this.cleanSpill(r, sp); break; }
      case 'price': { const p = PROD[m.p]; const v = Number(m.v); if (p && Number.isFinite(v)) { s.prices[p.id] = r2(clamp(v, 0.05, p.ref * 5)); s.dirty = true; } break; }
      case 'prices': { if (m.all && typeof m.all === 'object') for (const [id, v] of Object.entries(m.all)) if (PROD[id] && Number.isFinite(+v)) s.prices[id] = r2(clamp(+v, 0.05, PROD[id].ref * 5)); s.dirty = true; break; }
      case 'order': {
        const items = {}; let boxes = 0, cost = 0;
        for (const [id, b] of Object.entries(m.items || {})) { const p = PROD[id], n = clampI(b, 0, 50); if (!p || !n) continue; items[id] = n; boxes += n; cost += n * D.BOX * r2(p.cost * r.whole[id]); }
        if (!boxes) return;
        if (boxes >= 10) cost *= 0.95;
        cost = r2(cost);
        if (cost > s.cash) return err(`Not enough money: that order costs ${D.money2(cost)}.`);
        this.order(r, s, items, cost);
        c.send({ t: 'ordered', cost, boxes });
        break;
      }
      case 'fixture': {
        const k = clampI(m.slot, 0, SLOTS.length - 1); if (s.fixtures[k]) return;
        const f = FIXTURES[SLOTS[k].kind]; if (s.cash < f.price) return err(`A ${f.name.toLowerCase()} costs ${D.money(f.price)}.`);
        s.cash -= f.price; s.spent += f.price; s.today.costs += f.price; s.fixtures[k] = true; s.dirty = true;
        this.bcast(r, { t: 'fx', k: 'build', i: s.i, slot: k });
        break;
      }
      case 'hire': {
        const role = STAFF[m.role] ? m.role : null; if (!role) return;
        if (m.on && STAFF[role].needs && !s.perm[STAFF[role].needs]) return err('Buy Checkout Lane 2 first (Upgrades).');
        if (m.on && !s.staff[role]) { s.staff[role] = 1; addWorker(this, s, role); this.bcast(r, { t: 'fx', k: 'hire', i: s.i, role }); }
        else if (!m.on && s.staff[role]) { s.staff[role] = 0; s.workers = s.workers.filter(w => w.role !== role); }
        s.dirty = true; break;
      }
      case 'upgrade': {
        const u = UP[m.id]; if (!u) return;
        if (u.perm && s.perm[u.id]) return;
        if (s.cash < u.price) return err(`${u.name} costs ${D.money(u.price)}.`);
        s.cash -= u.price; s.spent += u.price; s.today.costs += u.price;
        if (u.perm) s.perm[u.id] = 1; else { s.ad = Math.max(s.ad, u.ad); s.adDays = Math.max(s.adDays, u.days); }
        s.dirty = true; this.bcast(r, { t: 'fx', k: 'upgrade', i: s.i, id: u.id });
        break;
      }
    }
  }
  order(r, s, items, cost) {
    s.cash -= cost; s.today.cogs += cost; s.spent += cost; s.dirty = true;
    const tr = { s: s.i, t: D.TRUCK_SEC, items }; r.trucks.push(tr);
    this.bcast(r, { t: 'truck', i: s.i, eta: D.TRUCK_SEC, boxes: Object.values(items).reduce((a, b) => a + b, 0) });
  }
  cleanSpill(r, sp) { r.spills = r.spills.filter(x => x !== sp); this.bcast(r, { t: 'spill', id: sp.id, on: 0 }); }

  // ---------------------------------------------------------------- simulation
  tick(dt) { for (const r of this.rooms.values()) { if (r.state === 'play' && !r.paused) { try { this.step(r, dt); } catch (e) { console.error('tick', e); } } } }
  step(r, dt) {
    r.t += dt;
    const open = D.isOpen(r.t), h = D.hourAt(r.t);
    if (open && !r.openRung) { r.openRung = true; this.bcast(r, { t: 'fx', k: 'open' }); }
    if (h >= D.CLOSE_H - 0.5 && !r.closingRung) { r.closingRung = true; this.bcast(r, { t: 'fx', k: 'closing' }); }
    if (r.t >= D.DAY_SEC) { this.endDay(r); return; }
    // trucks
    for (const tr of r.trucks) {
      tr.t -= dt;
      if (tr.t <= 0) { const s = r.stores[tr.s]; for (const [id, n] of Object.entries(tr.items)) s.back[id] += n * D.BOX; s.dirty = true; this.bcast(r, { t: 'fx', k: 'delivered', i: s.i }); }
    }
    r.trucks = r.trucks.filter(tr => tr.t > 0);
    // new shoppers
    if (open && h < D.CLOSE_H - 1.25) {
      r.spawnAcc += dt * this.spawnRate(r);
      while (r.spawnAcc >= 1) { r.spawnAcc -= 1; this.spawnShopper(r); }
    }
    for (const s of r.stores) {
      if (!s.ownerId) cpuThink(this, r, s, dt);
      for (const w of s.workers) workerStep(this, r, s, w, dt);
      this.checkout(r, s, dt);
    }
    for (const cu of r.customers) shopperStep(this, r, cu, dt);
    r.customers = r.customers.filter(cu => { if (cu.gone) { this.bcast(r, { t: 'cdel', id: cu.id }); return false; } return true; });
    // network
    r.snapAcc += dt;
    if (r.snapAcc >= 0.1) {
      r.snapAcc = 0;
      const c = r.customers.map(cu => [cu.id, r2(cu.x), r2(cu.z), r2(cu.yaw), cu.basket.reduce((a, b) => a + b.n, 0), cu.st === 'browse' ? 1 : cu.st === 'queue' ? 2 : 0]);
      const w = []; for (const s of r.stores) for (const k of s.workers) w.push([k.id, s.i, k.role, r2(k.x), r2(k.z), r2(k.yaw), k.carry ? k.carry.p : '', k.busy ? 1 : 0]);
      const o = r.stores.filter(s => s.ownerId && s.pos).map(s => [s.i, r2(s.pos.x), r2(s.pos.z), r2(s.pos.yaw), s.carry ? s.carry.p : '']);
      this.bcast(r, { t: 'snap', tt: r2(r.t), c, w, o });
    }
    r.storeAcc += dt;
    if (r.storeAcc >= 0.25) {
      r.storeAcc = 0;
      for (const s of r.stores) if (s.dirty) { s.dirty = false; this.bcast(r, { t: 'store', s: pubStore(s) }); }
    }
  }
  spawnRate(r) {
    // shoppers per second across the whole street, following the lunch and after-work rushes
    const h = D.hourAt(r.t), wd = (r.day - 1) % 7;
    const curve = 0.55 + 0.55 * Math.exp(-(((h - 12.3) / 1.4) ** 2)) + 0.8 * Math.exp(-(((h - 17.4) / 1.5) ** 2));
    const week = wd >= 5 ? 1.25 : wd === 0 ? 0.9 : 1;
    const growth = 1 + (r.day - 1) * 0.012;                     // the town grows a little every day
    return 6 * curve / 0.95 * week * growth * (r.event?.crowd || 1);
  }
  attraction(r, s, list) {
    let have = 0, idx = 0, n = 0;
    for (const pid of list) {
      if (!carries(s, pid)) continue;
      have++;
      const acc = eventAccept(r, pid);
      if (onShelf(s, pid) > 0) { idx += s.prices[pid] / (PROD[pid].ref * acc); n++; }
      else idx += 1.25, n++;   // an empty shelf looks bad through the window
    }
    const cov = have / list.length, pi = n ? idx / n : 1.3;
    let w = Math.pow(0.12 + cov, 1.3) * Math.exp(-4.2 * (pi - 1)) * Math.pow(s.rating / 3.6, 1.7);
    w *= 1 + (s.adDays > 0 ? s.ad : 0);
    if (s.perm.lights) w *= 1.12;
    if (s.perm.sign) w *= 1.1;
    return w;
  }
  spawnShopper(r) {
    // a shopping list, weighted by what's popular today
    const size = 3 + Math.floor(Math.random() * 3.99), list = [];
    const weights = PRODUCTS.map(p => p.demand * (r.event?.demand?.[p.id] || 1));
    const tot = weights.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (list.length < size && guard++ < 40) { let x = Math.random() * tot, k = 0; while (x > weights[k]) x -= weights[k++]; const id = PRODUCTS[Math.min(k, PRODUCTS.length - 1)].id; if (!list.includes(id)) list.push(id); }
    // shoppers come from all over town: off the bus, across the road, out of the side streets
    const fromLeft = Math.random() < 0.5, x0 = rnd(-D.storeX(3) - 14, D.storeX(3) + 14);
    const ws = r.stores.map(s => this.attraction(r, s, list) * Math.exp(-Math.abs(D.storeX(s.i) - x0) / 120));
    const home = 0.45;
    let tot2 = ws.reduce((a, b) => a + b, 0) + home, x = Math.random() * tot2, choice = -1;
    for (let i = 0; i < ws.length; i++) { if (x < ws[i]) { choice = i; break; } x -= ws[i]; }
    const cu = {
      id: this.nextCid++, s: choice, x: x0, z: rnd(10.6, 12.2), yaw: Math.PI, st: 'street', list, li: 0, basket: [], mood: 0,
      speed: rnd(2.8, 3.5), path: null, wait: 0, patience: 0, qwait: 0, color: pick(SHOPPER_COLORS), look: Math.floor(Math.random() * 6), exitX: fromLeft ? -D.storeX(3) - 30 : D.storeX(3) + 30,
      missing: 0, pricey: 0, found: 0,
    };
    if (choice >= 0) {
      const s = r.stores[choice];
      // they live nearby: start on the far pavement or the corner, close to the store they picked
      cu.x = D.storeX(s.i) + rnd(-9, 9); cu.z = Math.random() < 0.7 ? rnd(10.6, 12.2) : rnd(2.8, 4.2);
      cu.path = [[D.storeX(s.i) + D.DOOR_OUT[0] + rnd(-0.8, 0.8), D.DOOR_OUT[1] + rnd(0, 1)], localToWorld(s, D.DOOR_IN[0], D.DOOR_IN[1])];
      cu.st = 'walkin';
    } else cu.path = [[cu.x + rnd(-4, 4), rnd(2.6, 4.4)], [cu.exitX, rnd(2.6, 4.4)]];   // just walking past
    r.customers.push(cu);
    this.bcast(r, { t: 'cadd', c: { id: cu.id, color: cu.color, look: cu.look, s: cu.s, x: r2(cu.x), z: r2(cu.z) } });
  }
  tillRate(s, t) {
    // who is scanning at lane t? a hired cashier, a computer boss, or you holding E there
    const T = D.TILLS[t]; if (t === 1 && !s.perm.till2) return 0;
    let rate = 0;
    const [cx, cz] = localToWorld(s, T.cashier[0], T.cashier[1]);
    for (const w of s.workers) if ((w.role === (t ? 'cashier2' : 'cashier') || (w.role === 'boss' && w.task === 'till' && w.till === t)) && Math.hypot(w.x - cx, w.z - cz) < 0.6) rate = Math.max(rate, w.role === 'boss' ? [7, 9, 11][this.diffOf(s)] : 12);
    if (s.ownerId && s.humanScan && s.pos && Math.hypot(s.pos.x - cx, s.pos.z - cz) < 1.5) rate = Math.max(rate, 15);
    if (s.perm.scanner) rate *= 1.5;
    return rate;
  }
  checkout(r, s, dt) {
    s.tills = s.tills || [0, 0];
    for (let t = 0; t < D.TILLS.length; t++) {
      const rate = this.tillRate(s, t);
      let cu = s.tills[t] ? r.customers.find(c => c.id === s.tills[t]) : null;
      if (!cu) {
        s.tills[t] = 0;
        // call the next shopper in line (lane 2 only while someone is working it)
        if ((t === 0 || rate > 0) && s.queue.length) {
          const next = r.customers.find(c => c.id === s.queue[0]);
          if (next) { s.queue.shift(); s.tills[t] = next.id; next.till = t; next.st = 'totill'; const [px, pz] = localToWorld(s, ...D.TILLS[t].pay); next.path = Math.hypot(px - next.x, pz - next.z) < 3 ? [[px, pz]] : pathIn(s, NAV_C, next.x, next.z, ...D.TILLS[t].pay); s.dirty = true; }
        }
        continue;
      }
      if (cu.st !== 'pay' || rate <= 0) continue;
      cu.scan += rate * dt;
      const done = Math.floor(cu.scan);
      while (cu.scanned < Math.min(done, cu.units)) { cu.scanned++; s.sc++; s.dirty = true; }
      if (cu.scanned >= cu.units) this.pay(r, s, cu);
    }
  }
  diffOf(s) { return s.diff ?? 1; }
  pay(r, s, cu) {
    const total = r2(cu.basket.reduce((a, b) => a + b.n * b.price, 0));
    s.cash += total; s.today.rev += total; s.today.served++; s.served++; s.today.units += cu.units;
    for (const b of cu.basket) s.sold[b.p] = (s.sold[b.p] || 0) + b.n;
    s.tills[cu.till] = 0; s.dirty = true;
    this.bcast(r, { t: 'sale', i: s.i, amt: total, cid: cu.id });
    finishVisit(this, r, s, cu, true);
  }
  endDay(r) {
    const reports = [];
    for (const cu of r.customers) if (cu.s >= 0 && cu.st !== 'out' && cu.st !== 'street') { r.stores[cu.s].today.cut++; if (globalThis.CUTLOG) globalThis.CUTLOG[cu.st] = (globalThis.CUTLOG[cu.st] || 0) + 1; }
    for (const s of r.stores) {
      // bills
      let power = 0; SLOTS.forEach((sl, k) => { if (s.fixtures[k] && FIXTURES[sl.kind].power) power += D.POWER; });
      let wages = 0; for (const [role, on] of Object.entries(s.staff)) if (on) wages += STAFF[role].wage;
      const bills = D.RENT + power + wages;
      s.cash -= bills; s.today.costs += bills;
      // fresh food goes off overnight
      let spoiled = 0;
      for (const p of PRODUCTS) {
        if (!p.spoil) continue;
        const cut = n => { const k = Math.floor(n * p.spoil + Math.random() * 0.999 * (n > 0)); spoiled += Math.min(k, n); return Math.max(0, n - k); };
        s.back[p.id] = cut(s.back[p.id]);
        for (const [k, j] of sectionsFor(s, p.id)) s.secs[k][j].n = cut(s.secs[k][j].n);
      }
      s.today.spoiled = spoiled; s.lastCut = s.today.cut;
      // the night shift: a stocker fills every shelf from the stockroom before morning
      if (s.staff.stocker) SLOTS.forEach((sl, k) => { if (!s.fixtures[k]) return; for (const sec of s.secs[k]) { if (!sec.p) continue; const mv = Math.min(FIXTURES[sl.kind].cap - sec.n, s.back[sec.p]); if (mv > 0) { sec.n += mv; s.back[sec.p] -= mv; } } });
      const profit = r2(s.today.rev - s.today.cogs - s.today.costs);
      s.history.push({ day: r.day, cash: Math.round(s.cash), profit: Math.round(profit), rev: Math.round(s.today.rev), served: s.today.served, rating: r2(s.rating) });
      reports.push({ i: s.i, ...s.today, bills, rent: D.RENT, power, wages, profit, cash: Math.round(s.cash), rating: r2(s.rating) });
      s.soldY = s.sold; s.sold = {}; s.pricey = {};
      s.today = blankDay();
      if (s.adDays > 0) { s.adDays--; if (!s.adDays) s.ad = 0; }
      s.queue = []; s.tills = [0, 0]; s.dirty = true;
      for (const w of s.workers) { w.task = null; w.path = null; if (w.carry) { s.back[w.carry.p] += w.carry.n; w.carry = null; } }
    }
    // everyone still inside heads home
    r.customers = []; this.bcast(r, { t: 'cclear' });
    this.bcast(r, { t: 'dayend', day: r.day, reports });
    r.day++; r.t = 0; r.openRung = false; r.closingRung = false;
    if (r.day > D.DAYS) { r.day = D.DAYS; this.endGame(r); return; }
    // tomorrow's market
    for (const p of PRODUCTS) { const m = r.whole[p.id] / (r.event?.cost?.[p.id] || 1); r.whole[p.id] = clamp(m + (1 - m) * 0.3 + gauss() * 0.06, 0.8, 1.25); }
    r.event = rollEvent(r);
    for (const p of PRODUCTS) r.whole[p.id] = r2(r.whole[p.id] * (r.event.cost?.[p.id] || 1));
    for (const s of r.stores) this.bcast(r, { t: 'store', s: pubStore(s) });
    this.bcast(r, { t: 'news', day: r.day, event: r.event, whole: r.whole });
  }
}

// ------------------------------------------------------------------ helpers used by the core
function storeName(c) { return c.storeName || `${c.name}'S MARKET`; }
function eventAccept(r, pid) { return (r.event?.accept?.[pid] || 1) * (r.event?.acceptAll || 1); }
function stockValue(s, r) { let v = 0; for (const p of PRODUCTS) { v += (s.back[p.id] + onShelf(s, p.id)) * p.cost; } return v; }
function rollEvent(r) {
  if (r.day === D.FEAST_DAY) return D.FEAST;
  if (r.day === 1) return { id: 'grand', title: 'GRAND OPENING', text: 'Four new grocery stores just opened on Googly Street. Who will be the richest in a month?', crowd: 1.1 };
  const recent = new Set((r.recentEvents || []).slice(-4));
  let e; do { e = pick(D.EVENTS); } while (recent.has(e.id) && Math.random() < 0.9);
  r.recentEvents = [...(r.recentEvents || []), e.id];
  return e;
}
function restore(save) {
  const stores = save.stores.map((x, i) => {
    const s = newStore(i);
    Object.assign(s, { ownerId: x.ownerId ? 1 : 0, ownerName: x.ownerName, color: x.color, name: x.name, cash: x.cash, rating: x.rating, fixtures: x.fixtures, secs: x.secs, back: x.back, prices: x.prices, staff: x.staff, perm: x.perm || {}, ad: x.ad || 0, adDays: x.adDays || 0, today: x.today || blankDay(), history: x.history || [], soldY: x.soldY || {}, sold: x.sold || {}, pricey: x.pricey || {}, style: x.style || s.style, spent: x.spent || 0, served: x.served || 0 });
    return s;
  });
  return { day: save.day, t: save.t, settings: save.settings || { diff: 1 }, event: save.event, whole: save.whole, stores, spills: [], trucks: [] };
}

// ------------------------------------------------------------------ shoppers
function walk(ent, dt) {
  // follow ent.path (world coords); returns true when the path is finished
  if (!ent.path || !ent.path.length) return true;
  const [tx, tz] = ent.path[0], dx = tx - ent.x, dz = tz - ent.z, d = Math.hypot(dx, dz), step = ent.speed * dt;
  if (d > 0.01) { const want = Math.atan2(dx, dz); let dy = ((want - ent.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; ent.yaw += dy * Math.min(1, dt * 10); }
  if (d <= step) { ent.x = tx; ent.z = tz; ent.path.shift(); return !ent.path.length; }
  ent.x += dx / d * step; ent.z += dz / d * step;
  return false;
}
function pathIn(s, nav, fx, fz, lx, lz) {
  const [ax, az] = worldToLocal(s, fx, fz);
  return findPath(nav, ax, az, lx, lz).map(([x, z]) => localToWorld(s, x, z));
}
function bubble(core, r, cu, k, p) { core.bcast(r, { t: 'bubble', cid: cu.id, k, p }); }
function shopperStep(core, r, cu, dt) {
  const s = cu.s >= 0 ? r.stores[cu.s] : null, h = D.hourAt(r.t);
  switch (cu.st) {
    case 'street': if (walk(cu, dt)) cu.gone = true; break;
    case 'walkin':
      if (walk(cu, dt)) { s.today.walked++; core.bcast(r, { t: 'fx', k: 'door', i: s.i }); nextItem(core, r, s, cu); }
      break;
    case 'go': if (walk(cu, dt)) { cu.st = 'browse'; cu.wait = rnd(0.5, 1.0); } break;
    case 'browse':
      cu.wait -= dt;
      if (cu.wait <= 0) { decide(core, r, s, cu); cu.li++; if (h >= D.CLOSE_H - 0.3) cu.li = cu.list.length; nextItem(core, r, s, cu); }
      break;
    case 'toq': case 'queue': {
      const k = s.queue.indexOf(cu.id);
      if (k < 0) { leaveStore(core, r, s, cu); break; }
      const q = D.QUEUE[Math.min(k, D.QUEUE.length - 1)], spot = localToWorld(s, ...q);
      const end = cu.path && cu.path.length ? cu.path[cu.path.length - 1] : null;
      if (!end || Math.hypot(end[0] - spot[0], end[1] - spot[1]) > 0.3) cu.path = cu.st === 'toq' ? pathIn(s, NAV_C, cu.x, cu.z, ...q) : [spot];
      if (walk(cu, dt)) cu.st = 'queue';
      cu.qwait += dt;
      if (cu.qwait > cu.patience) giveUp(core, r, s, cu);
      break;
    }
    case 'totill': if (walk(cu, dt)) { cu.st = 'pay'; cu.scan = 0; cu.scanned = 0; cu.yaw = -Math.PI / 2; } cu.qwait += dt * 0.25; break;
    case 'pay':
      cu.qwait += dt * 0.25;
      if (cu.qwait > cu.patience * 1.6) giveUp(core, r, s, cu);
      break;
    case 'out': if (walk(cu, dt)) { cu.st = 'street'; cu.path = [[cu.x + Math.sign(cu.exitX - cu.x) * 3, rnd(2.6, 4.4)], [cu.exitX, rnd(2.6, 4.4)]]; } break;
  }
  // spills: a clumsy shopper now and then
  if (s && (cu.st === 'go') && Math.random() < dt * 0.0045 * (1 + cu.basket.length)) {
    const sp = { id: core.nextSpill++, s: s.i, x: r2(cu.x), z: r2(cu.z), kind: pick(['milk', 'soda', 'eggs', 'jam']) };
    r.spills.push(sp); core.bcast(r, { t: 'spill', id: sp.id, s: s.i, x: sp.x, z: sp.z, kind: sp.kind, on: 1 });
  }
}
function nextItem(core, r, s, cu) {
  // walk to the next thing on the list the store sells; skip the rest
  while (cu.li < cu.list.length) {
    const pid = cu.list[cu.li], secs = sectionsFor(s, pid);
    if (!secs.length) { cu.missing++; if (Math.random() < 0.15) bubble(core, r, cu, 'nosell', pid); cu.li++; continue; }
    // the fullest spot that sells it
    secs.sort((a, b) => s.secs[b[0]][b[1]].n - s.secs[a[0]][a[1]].n);
    const [k, j] = secs[0]; cu.target = [k, j];
    const [lx, lz] = SLOTS[k].stand[j];
    cu.path = pathIn(s, NAV_C, cu.x, cu.z, lx + rnd(-0.25, 0.25), lz + rnd(-0.15, 0.15)); cu.st = 'go';
    return;
  }
  // done shopping
  if (cu.basket.length) {
    s.queue.push(cu.id); cu.st = 'toq'; cu.path = null; cu.qwait = 0;
    cu.patience = rnd(20, 30) * (s.perm.speakers ? 1.4 : 1);
    cu.units = cu.basket.reduce((a, b) => a + b.n, 0);
    s.dirty = true;
  } else { s.today.lost++; s.today.empty++; finishVisit(core, r, s, cu, false); }
}
function decide(core, r, s, cu) {
  const pid = cu.list[cu.li], p = PROD[pid], [k, j] = cu.target, sec = s.secs[k][j];
  if (sec.p !== pid || sec.n <= 0) { cu.missing++; s.today.oos++; bubble(core, r, cu, 'oos', pid); return; }
  const will = p.ref * eventAccept(r, pid) * (1.1 + Math.abs(gauss()) * 0.4);
  if (s.prices[pid] > will) { cu.pricey++; s.today.pricey++; s.pricey[pid] = (s.pricey[pid] || 0) + 1; bubble(core, r, cu, 'pricey', pid); s.dirty = true; return; }
  const want = 1 + (Math.random() < 0.6) + (Math.random() < 0.4) + (Math.random() < 0.2) + (Math.random() < 0.1), n = Math.min(want, sec.n);
  sec.n -= n; cu.basket.push({ p: pid, n, price: s.prices[pid], k, j }); cu.found++; s.dirty = true;
  if (s.prices[pid] < p.ref * 0.85 && Math.random() < 0.3) bubble(core, r, cu, 'cheap', pid);
}
function giveUp(core, r, s, cu) {
  s.queue = s.queue.filter(id => id !== cu.id);
  if (s.tills && s.tills[cu.till] === cu.id) s.tills[cu.till] = 0;
  putBack(s, cu); s.today.lost++; s.today.gaveup++; cu.mood -= 2; bubble(core, r, cu, 'wait'); s.dirty = true;
  finishVisit(core, r, s, cu, false);
}
function putBack(s, cu) {
  for (const b of cu.basket) { const sec = s.secs[b.k][b.j]; if (sec.p === b.p) sec.n += b.n; else s.back[b.p] += b.n; }
  cu.basket = [];
}
function finishVisit(core, r, s, cu, paid) {
  // how did that go? (rating moves a little with every visit)
  const dirt = r.spills.filter(sp => sp.s === s.i).length;
  let score = 5 - cu.missing * 0.9 - cu.pricey * 0.55 - Math.min(1.5, dirt * 0.45) + (paid ? 0 : -1.8);
  if (paid && cu.qwait > 10) score -= Math.min(1.6, (cu.qwait - 10) * 0.12);
  if (paid && s.perm.lights) score += 0.3;
  score = clamp(score, 1, 5);
  s.rating = clamp(s.rating + (score - s.rating) * 0.035, 1, 5);
  if (paid && score >= 4.4 && Math.random() < 0.4) bubble(core, r, cu, 'happy');
  else if (dirt >= 2 && Math.random() < 0.4) bubble(core, r, cu, 'dirty');
  s.dirty = true;
  leaveStore(core, r, s, cu);
}
function leaveStore(core, r, s, cu) {
  cu.st = 'out';
  cu.path = [...pathIn(s, NAV_C, cu.x, cu.z, D.DOOR_IN[0] - 0.6, D.DOOR_IN[1]), localToWorld(s, D.DOOR_OUT[0] - 0.6, D.DOOR_OUT[1])];
}

// ------------------------------------------------------------------ staff (and computer bosses)
function addWorker(core, s, role) {
  const spot = role === 'cashier' ? D.TILLS[0].cashier : role === 'cashier2' ? D.TILLS[1].cashier : [-6, -14];
  const [x, z] = localToWorld(s, spot[0], spot[1]);
  const w = { id: core.nextW++, role, x, z, yaw: 0, path: null, task: null, carry: null, t: 0, speed: role === 'boss' ? 3.4 : 3.6, busy: false };
  s.workers.push(w);
  return w;
}
function spawnBoss(core, s) { if (s.boss) return; s.boss = addWorker(core, s, 'boss'); const [x, z] = localToWorld(s, 0, -8); s.boss.x = x; s.boss.z = z; }
function sectionNeed(s, claimed) {
  // the emptiest spot we have boxes for
  let best = null, bn = 1e9;
  SLOTS.forEach((sl, k) => {
    if (!s.fixtures[k]) return;
    s.secs[k].forEach((sec, j) => {
      if (!sec.p || claimed.has(k * 2 + j)) return;
      const cap = FIXTURES[sl.kind].cap, room = cap - sec.n;
      if (sec.n > cap * 0.5 || room < 4 || !s.back[sec.p]) return;
      if (sec.n < bn) { bn = sec.n; best = [k, j]; }
    });
  });
  return best;
}
function workerStep(core, r, s, w, dt) {
  const claimed = new Set(s.workers.filter(o => o !== w && o.task === 'stock' && o.target).map(o => o.target[0] * 2 + o.target[1]));
  const go = (lx, lz) => { w.path = pathIn(s, NAV_S, w.x, w.z, lx, lz); };
  const diff = core.diffOf(s);
  if (w.role === 'boss' && w.speed) w.speed = [2.7, 3.2, 3.6][diff];
  w.busy = false;
  // which lane should this worker be at? (-1 = none)
  let lane = w.role === 'cashier' ? 0 : w.role === 'cashier2' ? (s.perm.till2 ? 1 : -1) : -1;
  if (w.role === 'boss' && !(w.task === 'stock' && w.carry)) {
    const waiting = s.queue.length + (s.tills?.[0] ? 1 : 0);
    if (!s.staff.cashier && (waiting > 0 || (w.task === 'till' && w.till === 0 && s.queue.length))) lane = 0;
    else if (s.perm.till2 && !s.staff.cashier2 && (s.queue.length > 2 || (w.task === 'till' && w.till === 1 && (s.queue.length || s.tills?.[1])))) lane = 1;
  }
  if (lane >= 0) {
    if (w.task !== 'till' || w.till !== lane) { w.task = 'till'; w.till = lane; go(...D.TILLS[lane].cashier); }
    if (walk(w, dt)) { w.yaw = Math.PI / 2; w.busy = !!s.tills?.[lane]; }
    return;
  }
  if (w.role === 'cashier' || w.role === 'cashier2') return;
  if (w.task === 'till' && w.role === 'boss') { w.task = null; w.path = null; }
  // janitor (or a boss with nothing better to do)
  const spill = r.spills.filter(sp => sp.s === s.i).sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
  if ((w.role === 'janitor' || (w.role === 'boss' && !s.staff.janitor && !w.carry && diff > 0)) && spill && (w.task === null || w.task === 'mop' || w.task === 'idle')) {
    if (w.task !== 'mop' || w.spill !== spill.id) { w.task = 'mop'; w.spill = spill.id; w.t = 0; const [lx, lz] = worldToLocal(s, spill.x, spill.z); go(lx, lz + 0.5); }
    if (walk(w, dt)) { w.busy = true; w.t += dt; if (w.t > 1.4) { core.cleanSpill(r, spill); w.task = null; } }
    return;
  }
  if (w.task === 'mop' && !r.spills.some(sp => sp.id === w.spill)) w.task = null;
  // stocker (or a boss)
  if (w.role === 'stocker' || w.role === 'boss') {
    if (w.task === 'stock') {
      const [k, j] = w.target, sec = s.secs[k][j];
      if (w.phase === 'fetch') {
        if (walk(w, dt)) {
          w.t += dt; w.busy = true;
          if (w.t > 0.9) { const n = Math.min(D.CARRY, FIXTURES[SLOTS[k].kind].cap - sec.n + 6, s.back[sec.p] || 0); if (!n || !sec.p) { w.task = null; return; } s.back[sec.p] -= n; w.carry = { p: sec.p, n }; s.dirty = true; w.phase = 'carry'; w.t = 0; go(...SLOTS[k].stand[j]); }
        }
      } else if (walk(w, dt)) {
        w.t += dt; w.busy = true;
        if (w.t > 0.8) {
          if (sec.p === w.carry.p || !sec.n) { sec.p = w.carry.p; const cap = FIXTURES[SLOTS[k].kind].cap, mv = Math.min(w.carry.n, cap - sec.n); sec.n += mv; w.carry.n -= mv; }
          if (w.carry.n > 0) s.back[w.carry.p] += w.carry.n;
          w.carry = null; s.dirty = true; w.task = null;
          core.bcast(r, { t: 'fx', k: 'boxDown', i: s.i, slot: k, sec: j });
        }
      }
      return;
    }
    const need = sectionNeed(s, claimed);
    if (need && (w.role === 'stocker' || Math.random() < dt * [1.2, 3, 6][diff])) {
      w.task = 'stock'; w.target = need; w.phase = 'fetch'; w.t = 0; go(...D.STOCK_RACK);
      return;
    }
  }
  // nothing to do: amble somewhere sensible
  if (w.task !== 'idle' || walk(w, dt)) {
    if (w.task !== 'idle' || Math.random() < dt * 0.5) {
      w.task = 'idle';
      const spots = w.role === 'stocker' ? [[-6.8, -18.2], [-7, -14]] : w.role === 'janitor' ? [[6.5, -3.5], [-6.5, -13], [6.5, -13.5]] : [[0, -7.2], [-1, -13.5], [3, -13.5], [-6.5, -6.5]];
      const [lx, lz] = pick(spots); go(lx + rnd(-0.5, 0.5), lz + rnd(-0.4, 0.4));
    }
  }
}

// ------------------------------------------------------------------ computer store owners
const STYLE_MARKUP = { cheap: 0.95, fancy: 1.2, fair: 1.1, shark: 1.06 };
const FIX_ORDER = [3, 1, 4, 7, 8, 5, 9];
function cpuThink(core, r, s, dt) {
  s.brainT = (s.brainT || 0) - dt;
  if (s.brainT > 0) return;
  const diff = core.diffOf(s);
  s.brainT = [3.5, 2.2, 1.4][diff] + Math.random();
  const others = r.stores.filter(o => o !== s);
  // prices
  for (const p of PRODUCTS) {
    if (!carries(s, p.id)) continue;
    let m = STYLE_MARKUP[s.style];
    if (diff > 0) m *= Math.pow(eventAccept(r, p.id), 0.75);
    if (s.style === 'shark') {
      const rival = Math.min(...others.filter(o => carries(o, p.id) && onShelf(o, p.id) > 0).map(o => o.prices[p.id] / p.ref), 9);
      if (rival < 9) m = Math.max(rival - 0.03, (p.cost * r.whole[p.id]) / p.ref * 1.18);
      const oos = others.filter(o => carries(o, p.id) && onShelf(o, p.id) === 0).length;
      if (oos >= 2) m *= 1.12;
    }
    if (diff === 2) {
      // hard computers learn from how many shoppers balked yesterday
      s.learn = s.learn || {};
      const bal = (s.pricey[p.id] || 0), sold = (s.sold[p.id] || 0) + 1;
      const k = s.learn[p.id] || 1;
      s.learn[p.id] = clamp(k * (bal / (sold + bal) > 0.3 ? 0.995 : 1.002), 0.85, 1.12);
      m *= s.learn[p.id];
    }
    const floor = p.cost * r.whole[p.id] * 1.08;
    let v = Math.max(floor, p.ref * m);
    v = Math.max(0.19, Math.round(v * 10) / 10 - 0.01);
    if (Math.abs(v - s.prices[p.id]) > 0.009) { s.prices[p.id] = r2(v); s.dirty = true; }
  }
  if (r.t < 1 && diff === 0 && Math.random() < 0.5) return; // easy owners oversleep
  // restock the stockroom
  const reserve = 60, items = {}; let cost = 0;
  for (const p of PRODUCTS) {
    if (!carries(s, p.id)) continue;
    // keep the shelves full plus a box or two out back (more on busy days)
    const shelfCap = sectionsFor(s, p.id).reduce((a, [k]) => a + FIXTURES[SLOTS[k].kind].cap, 0);
    const busy = Math.max(1, (s.soldY[p.id] || 0) / Math.max(1, shelfCap)) * (r.event?.demand?.[p.id] || 1);
    const target = shelfCap + D.BOX * [0.8, 1.5, 2][diff] * busy;
    const have = s.back[p.id] + onShelf(s, p.id) + inTransit(r, s, p.id);
    if (have < target * 0.6) {
      const boxes = Math.ceil((target - have) / D.BOX), unit = D.BOX * p.cost * r.whole[p.id];
      const can = Math.min(boxes, Math.floor((s.cash - reserve - cost) / unit));
      if (can > 0) { items[p.id] = can; cost += can * unit; }
    }
  }
  if (Object.keys(items).length) { if (Object.values(items).reduce((a, b) => a + b, 0) >= 10) cost *= 0.95; core.order(r, s, items, r2(cost)); }
  // staff
  const hire = role => { if (!s.staff[role]) { s.staff[role] = 1; addWorker(core, s, role); s.dirty = true; } };
  const fire = role => { if (s.staff[role]) { s.staff[role] = 0; s.workers = s.workers.filter(w => w.role !== role); s.dirty = true; } };
  if (s.cash > [900, 600, 400][diff] && r.day >= [2, 1, 1][diff]) hire('cashier');
  if (s.cash > [1200, 900, 600][diff] && r.day >= [3, 1, 1][diff]) hire('stocker');
  if (diff > 0 && s.cash > 1800 && r.spills.filter(sp => sp.s === s.i).length >= 2) hire('janitor');
  if (s.cash < 100) { fire('janitor'); if (s.cash < -100) fire('stocker'); }
  // grow the store
  const lastProfit = s.history.length ? s.history[s.history.length - 1].profit : 0;
  if (r.day <= 23 && r.day >= 2 && lastProfit > -50 && D.hourAt(r.t) < 12) {
    for (const k of FIX_ORDER) {
      if (s.fixtures[k]) continue;
      const f = FIXTURES[SLOTS[k].kind];
      if (s.cash > f.price + [1500, 900, 700][diff] + (s.style === 'cheap' ? -150 : 0)) {
        s.cash -= f.price; s.spent += f.price; s.today.costs += f.price; s.fixtures[k] = true;
        const choices = PRODUCTS.filter(p => p.kind === SLOTS[k].kind && !carries(s, p.id)).sort((a, b) => b.demand * (b.ref - b.cost) - a.demand * (a.ref - a.cost));
        choices.slice(0, 2).forEach((p, j) => { s.secs[k][j] = { p: p.id, n: 0 }; });
        s.dirty = true; core.bcast(r, { t: 'fx', k: 'build', i: s.i, slot: k });
      }
      break;
    }
  }
  // upgrades & ads by personality
  const buy = id => { const u = UP[id]; if ((u.perm && s.perm[id]) || s.cash < u.price + 1100) return; s.cash -= u.price; s.spent += u.price; s.today.costs += u.price; if (u.perm) s.perm[id] = 1; else { s.ad = Math.max(s.ad, u.ad); s.adDays = Math.max(s.adDays, u.days); } s.dirty = true; };
  if (diff > 0 && r.day >= 4) buy('scanner');
  if (!s.perm.till2 && r.day >= [8, 4, 3][diff] && (s.lastCut || 0) > [20, 12, 8][diff] && s.cash > 700) { s.cash -= UP.till2.price; s.spent += UP.till2.price; s.today.costs += UP.till2.price; s.perm.till2 = 1; s.dirty = true; }
  if (s.perm.till2 && s.cash > [1600, 900, 700][diff]) hire('cashier2');
  if (s.style === 'fancy' && r.day >= 3) { buy('lights'); buy('speakers'); }
  if (s.style === 'fair' && r.day >= 6) buy('sign');
  if (diff === 2 && r.day >= 8) { buy('lights'); buy('sign'); }
  const wd = (r.day - 1) % 7;
  if (D.hourAt(r.t) < 9 && !s.adDays && s.cash > 2500) {
    if (s.style === 'cheap' && wd >= 4) buy('flyers');
    const leader = Math.max(...others.map(o => o.cash));
    if (s.style === 'shark' && leader > s.cash + 800) buy('radio');
    if (r.day === D.FEAST_DAY - 1 && diff > 0) buy('radio');
  }
}
function inTransit(r, s, pid) { return r.trucks.filter(t => t.s === s.i).reduce((a, t) => a + (t.items[pid] || 0) * D.BOX, 0); }

/** Headless month for tuning: node test/sim.mjs [diff] [runs] */
export function simulateMonth({ diff = 1, dt = 0.1, log = true, every = 5 } = {}) {
  const core = new Core();
  const lines = [];
  const c = core.connect(m => {
    if (m.t === 'dayend' && log && (m.day % every === 0 || m.day === 1)) lines.push(`day ${String(m.day).padStart(2)} ` + m.reports.map(x => `${String(Math.round(x.rev)).padStart(5)}/${String(Math.round(x.profit)).padStart(5)} s${String(x.served).padStart(3)} w${String(x.walked).padStart(3)} p${String(x.pricey).padStart(3)} o${String(x.oos).padStart(3)} g${x.gaveup} e${x.empty} c${x.cut} ★${x.rating.toFixed(1)} $${x.cash}`).join(' | '));
  });
  c.recv({ t: 'me', name: 'SIM' });
  const r = core.makeRoom({ solo: true }); r.settings.diff = diff;
  core.join(core.clients.get(c.id), r);
  core.start(r);
  // the "human" store is run by a computer too, to compare styles side by side
  const me = r.stores[0]; me.ownerId = 0; me.style = 'fair'; spawnBoss(core, me);
  let t = 0;
  while (r.state === 'play' && t < 60 * 60) { core.step(r, dt); t += dt; }
  if (log) console.log(lines.join('\n') + '\n' + (r.standings || []).map(x => `${x.name.padEnd(18)} ${String(x.worth).padStart(7)} ★${x.rating} served ${x.served}`).join('\n'));
  return r.standings;
}
