// Googly Workshop — the browser side: menus, lobbies, walking around your store, the shop panels and the HUD.
// Solo games run the whole simulation right here in the page; online games talk to the server.
import * as THREE from 'three';
import * as D from './data.js';
import { World } from './world.js';
import { Googly, textSprite } from './googly.js';
import { iconURL } from './art.js';
import { Core } from './core.js';
import { sfx, music, unlockAudio, setMusic, setSfx, audioState, setListener } from './sfx.js';

const Q = new URLSearchParams(location.search);
const macLog = msg => { try { window.webkit?.messageHandlers?.gw?.postMessage({ type: 'log', msg: String(msg) }); } catch { } };
addEventListener('error', e => macLog('ERROR ' + e.message + ' ' + (e.filename || '') + ':' + (e.lineno || '')));
addEventListener('unhandledrejection', e => macLog('REJECT ' + (e.reason?.message || e.reason)));
if (Q.has('icon')) { import('./icon.js').then(m => m.renderIcon()); throw new Error('icon mode'); }
if (Q.has('shim')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('gw.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gw.' + k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem('gw.' + k); } catch { } },
};
const { PRODUCTS, PROD, SLOTS, FIXTURES, STAFF, UPGRADES, UP } = D;
const prof = { name: store.get('name', ''), store: store.get('store', ''), color: store.get('color', '#9aa0a6'), diff: store.get('diff', 1) };
const SERVER_PAGE = (() => { const s = Q.get('server'); if (s) return s.replace(/\/$/, ''); if (/^https?:$/.test(location.protocol)) return location.origin; return 'https://googly-workshop.onrender.com'; })();
const SERVER_WS = SERVER_PAGE.replace(/^http/, 'ws');
const world = new World($('view'), { lowq: Q.has('lq') });
const clock = new THREE.Clock();

// ------------------------------------------------------------------ screens
const SCREENS = ['scr-title', 'scr-online', 'scr-lobby', 'scr-pause', 'scr-end', 'scr-help'];
let screen = 'scr-title', prevScreen = 'scr-title';
function show(id) { if (id !== screen) prevScreen = screen; screen = id; for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
function toast(t, ms = 2400) { const e = $('toast'); e.innerHTML = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.opacity = 0, ms); }
document.querySelectorAll('.back').forEach(b => b.onclick = () => { sfx.click(); show(screen === 'scr-help' ? prevScreen : 'scr-title'); if (screen === 'scr-title') conn?.close?.(); });
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
document.addEventListener('keydown', () => unlockAudio(), { capture: true });

$('nm').value = prof.name; $('snm').value = prof.store;
$('nm').oninput = () => { prof.name = $('nm').value.replace(/[<>&"]/g, '').slice(0, 14); store.set('name', prof.name); $('snm').placeholder = (prof.name || 'YOUR NAME').toUpperCase() + "'S MARKET"; sendMe(); };
$('snm').oninput = () => { prof.store = $('snm').value.replace(/[<>&"]/g, '').slice(0, 22); store.set('store', prof.store); sendMe(); };
$('snm').placeholder = (prof.name || 'YOUR NAME').toUpperCase() + "'S MARKET";
function drawSwatches() {
  $('swatches').innerHTML = D.PLAYER_COLORS.map(c => `<div data-c="${c}" style="background:${c}" class="${c === prof.color ? 'on' : ''}"></div>`).join('');
  $('swatches').querySelectorAll('div').forEach(d => d.onclick = () => { prof.color = d.dataset.c; store.set('color', prof.color); sfx.click(); drawSwatches(); sendMe(); if (!G) buildTitleFig(); });
}
drawSwatches();
function drawDiff() { $('diffseg').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.d === prof.diff)); }
$('diffseg').querySelectorAll('button').forEach(b => b.onclick = () => { prof.diff = +b.dataset.d; store.set('diff', prof.diff); sfx.click(); drawDiff(); });
drawDiff();
function needName() { if (!prof.name.trim()) { $('nm').focus(); toast('Type your name first'); sfx.error(); return true; } return false; }
$('b-solo').onclick = () => { if (needName()) return; sfx.click(); startSolo(null); };
$('b-continue').onclick = () => { if (needName()) return; const sv = store.get('save', null); if (!sv) return; sfx.click(); startSolo(sv); };
$('b-online').onclick = () => { if (needName()) return; sfx.click(); goOnline(); };
$('b-help').onclick = $('p-help').onclick = () => { sfx.click(); show('scr-help'); };
const fsToggle = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen not available here')); };
$('b-fs').onclick = $('p-fs').onclick = () => { sfx.click(); fsToggle(); };
function drawAudioBtns() { const a = audioState(); for (const id of ['b-music', 'p-music']) $(id).textContent = a.music ? '♪ Music: on' : '♪ Music: off'; for (const id of ['b-sfx', 'p-sfx']) $(id).textContent = a.sfx ? '🔊 Sound: on' : '🔈 Sound: off'; }
$('b-music').onclick = $('p-music').onclick = () => { setMusic(!audioState().music); drawAudioBtns(); };
$('b-sfx').onclick = $('p-sfx').onclick = () => { setSfx(!audioState().sfx); drawAudioBtns(); sfx.click(); };
drawAudioBtns();
function drawContinue() {
  const sv = store.get('save', null);
  $('b-continue').classList.toggle('hidden', !sv);
  if (sv) $('b-continue').textContent = `CONTINUE MONTH · DAY ${sv.day} · ${D.money(sv.stores.find(s => s.ownerId)?.cash ?? 0)}`;
}
drawContinue();
let pendingRoom = (Q.get('room') || '').toUpperCase().slice(0, 4);
function drawInvite() {
  $('invite').classList.toggle('hidden', !pendingRoom);
  $('invite').innerHTML = `You've been invited to lobby <b>${esc(pendingRoom)}</b> — type your name and press JOIN`;
  $('b-online').innerHTML = pendingRoom ? `👥 JOIN ${esc(pendingRoom)}` : '👥 PLAY WITH FRIENDS <small>(optional)</small>';
}
drawInvite();
window.__joinCode = code => { pendingRoom = String(code).toUpperCase().slice(0, 4); if (G) leaveGame(); drawInvite(); show('scr-title'); if (prof.name) goOnline(); else toast('Type your name, then press JOIN'); };

// ------------------------------------------------------------------ connection (local core or online server)
let conn = null, myId = 0, online = false, room = null;
function localConn() {
  const core = new Core({ local: true });
  let handle = null, alive = true;
  const c = { send: m => { if (alive) handle.recv(JSON.parse(JSON.stringify(m))); }, close: () => { alive = false; clearInterval(timer); handle.close(); }, core };
  let last = performance.now();
  const timer = setInterval(() => { const t = performance.now(), dt = Math.min(0.25, (t - last) / 1000); last = t; core.tick(dt); }, 50);
  handle = core.connect(m => { if (alive) { const copy = JSON.parse(JSON.stringify(m)); queueMicrotask(() => onMsg(copy)); } });
  return c;
}
function wsConn(onOpen) {
  const ws = new WebSocket(SERVER_WS + '/ws');
  const c = { send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }, close: () => { c.closed = true; ws.close(); } };
  ws.onopen = () => onOpen?.();
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = () => {
    if (c.closed) return;
    if (conn === c) { toast('Lost connection to the server.', 4000); if (G) leaveGame(); room = null; show('scr-title'); conn = null; }
  };
  ws.onerror = () => { $('on-status').textContent = `Can't reach the online server (${SERVER_PAGE}). It may be waking up — try again in 30 seconds.`; };
  return c;
}
const send = m => conn?.send(m);
function sendMe() { send({ t: 'me', name: prof.name.trim() || 'GOOGLY', color: prof.color, store: prof.store.trim() }); }
function startSolo(save) {
  conn?.close?.(); online = false;
  conn = localConn();
  sendMe();
  send({ t: 'solo', diff: prof.diff, save });
}
function goOnline() {
  conn?.close?.(); online = true;
  $('on-status').textContent = 'Connecting…';
  conn = wsConn(() => {
    $('on-status').textContent = '';
    sendMe();
    if (pendingRoom) { send({ t: 'join', code: pendingRoom }); pendingRoom = ''; drawInvite(); }
    else { show('scr-online'); send({ t: 'list' }); }
  });
  show('scr-online');
}
$('on-pub').onclick = () => { sfx.click(); send({ t: 'create', public: true, diff: prof.diff }); };
$('on-priv').onclick = () => { sfx.click(); send({ t: 'create', public: false, diff: prof.diff }); };
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length !== 4) return toast('Lobby codes are 4 letters'); sfx.click(); send({ t: 'join', code: c }); };
$('on-code').onkeydown = e => { if (e.key === 'Enter') $('on-join').click(); };
$('on-ref').onclick = () => { sfx.click(); send({ t: 'list' }); };
setInterval(() => { if (screen === 'scr-online' && online && !G) send({ t: 'list' }); }, 4000);
function drawRooms(list) {
  $('rooms').innerHTML = list.length ? list.map(r => `<div class="roomrow"><div><b>${esc(r.host)}'s street</b><small>${r.humans}/4 shop owners · computers: ${esc(r.diff)} · ${r.state === 'lobby' ? 'waiting' : `day ${r.day} — take over a store`}</small></div><button class="green" data-c="${r.code}">JOIN</button></div>`).join('')
    : `<div class="empty">No open lobbies right now. Make one and send your friends the code!</div>`;
  $('rooms').querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'join', code: b.dataset.c }); });
}
// lobby
const amHost = () => room && room.host === myId;
function drawLobby() {
  if (!room) return;
  $('lb-code').textContent = room.code;
  $('lb-seats').innerHTML = room.seats.map(s => `<div class="seat ${s.human ? 'human' : ''}"><span class="dot" style="background:${esc(s.color)}"></span>${esc(s.name)}${s.id === myId ? ' (you)' : ''}<small>${s.human ? (s.id === room.host ? 'HOST' : 'PLAYER') : 'COMPUTER · ' + esc(s.store || '')}</small></div>`).join('');
  $('lb-diff').value = String(room.settings.diff); $('lb-pub').checked = room.public;
  $('lb-hostctl').classList.toggle('hidden', !amHost());
  $('lb-start').classList.toggle('hidden', !amHost());
  const hostName = room.players.find(p => p.id === room.host)?.name || 'the host';
  $('lb-wait').textContent = amHost() ? 'Send friends the code or link. Empty stores are run by computers. Press OPEN THE STORES when ready.' : `Waiting for ${hostName} to open the stores… (computers: ${D.DIFF[room.settings.diff]})`;
}
$('lb-diff').onchange = () => send({ t: 'set', diff: +$('lb-diff').value });
$('lb-pub').onchange = () => send({ t: 'set', public: $('lb-pub').checked });
$('lb-start').onclick = () => { sfx.click(); send({ t: 'start' }); };
$('lb-leave').onclick = () => { sfx.click(); send({ t: 'leave' }); room = null; show('scr-online'); send({ t: 'list' }); };
const inviteLink = () => `${SERVER_PAGE}/?room=${room.code}`;
$('lb-copy').onclick = async () => {
  sfx.click();
  const link = inviteLink();
  try { await navigator.clipboard.writeText(link); toast('Invite link copied! Paste it to your friends:<br>' + esc(link), 4000); }
  catch { prompt('Send this link to your friends:', link); }
};
$('lb-form').onsubmit = e => { e.preventDefault(); const t = $('lb-msg').value.trim(); if (t) send({ t: 'chat', text: t }); $('lb-msg').value = ''; };
function addChat(m) {
  const line = m.sys ? `<div class="sys">${esc(m.text)}</div>` : `<div><b style="color:${esc(m.color)}">${esc(m.from)}:</b> ${esc(m.text)}</div>`;
  for (const id of ['lb-log', 'log']) { const el = $(id); el.insertAdjacentHTML('beforeend', line); while (el.children.length > 40) el.firstChild.remove(); el.scrollTop = 1e6; }
  if (!m.sys) sfx.chat();
}

function onMsg(m) {
  switch (m.t) {
    case 'hello': myId = m.id; break;
    case 'list': drawRooms(m.rooms); break;
    case 'err': toast(m.msg, 3200); sfx.error(); break;
    case 'joined': sfx.join(); $('lb-log').innerHTML = ''; if (!m.solo && !G) show('scr-lobby'); if (!m.solo && /^https?:$/.test(location.protocol)) history.replaceState(null, '', '?room=' + m.code); break;
    case 'left': if (/^https?:$/.test(location.protocol)) history.replaceState(null, '', location.pathname); break;
    case 'room': room = m.room; drawLobby(); break;
    case 'chat': addChat(m); break;
    case 'start': enterGame(m); break;
    case 'save': if (m.data) { store.set('save', m.data); flashSaved(); } break;
    case 'ordered': sfx.order(); toast(`Ordered ${m.boxes} box${m.boxes > 1 ? 'es' : ''} for ${D.money2(m.cost)}. Truck on the way!`); break;
    default: if (G) onGameMsg(m);
  }
}

// ------------------------------------------------------------------ the game
let G = null;
const me = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, fig: null };
const cam = { yaw: 0, pitch: 0.95, dist: 12, tx: 0, tz: 0 };
function enterGame(m) {
  if (G) leaveGame(true);
  G = { solo: m.solo, day: m.day, tt: m.tt, event: m.event, whole: m.whole, stores: m.stores, mine: -1, shoppers: new Map(), workers: new Map(), owners: new Map(), lastSc: [], lastScanSfx: 0, sendT: 0, saveT: 0, prevQ: 0, lastHour: 0, code: m.code };
  G.mine = G.stores.findIndex(s => s.ownerId === myId);
  G.stores.forEach((s, i) => { world.setStore(s, i === G.mine); G.lastSc[i] = s.sc; });
  for (const [id] of world.spills) world.removeSpill(id);
  for (const sp of m.spills || []) world.addSpill(sp.id, sp.x, sp.z, sp.kind);
  const X = D.storeX(Math.max(0, G.mine));
  Object.assign(me, { x: X, z: -3.2, yaw: Math.PI, vx: 0, vz: 0 });
  if (me.fig) world.ents.remove(me.fig.group);
  me.fig = new Googly({ color: prof.color, role: 'owner', apron: '#2f9e44', cap: prof.color === '#f2f2f7' ? '#ffd23a' : '#f2f2f7' });
  me.fig.onStep = v => sfx.step(null, v * 0.7);
  world.ents.add(me.fig.group);
  cam.yaw = 0; cam.tx = me.x; cam.tz = me.z;
  if (titleFig) { world.ents.remove(titleFig.group); titleFig = null; }
  $('hud').classList.remove('hidden'); show(null); closePanels();
  $('log').innerHTML = '';
  $('chatbox').classList.toggle('hidden', G.solo);
  showNews(m.event, m.day);
  music.play('store');
  if (Q.has('panel')) openPanel(Q.get('panel'));
}
function leaveGame(keep) {
  if (!G) return;
  for (const e of [...G.shoppers.values(), ...G.workers.values(), ...G.owners.values()]) world.ents.remove(e.fig.group);
  if (me.fig) { world.ents.remove(me.fig.group); me.fig = null; }
  G = null;
  $('hud').classList.add('hidden'); closePanels(); $('dayrep').classList.add('hidden');
  music.play('menu');
  if (!keep) { buildTitleFig(); drawContinue(); }
}
const myStore = () => G && G.mine >= 0 ? G.stores[G.mine] : null;
const tillPos = (i, t = 0) => [D.storeX(i) + D.TILLS[t].x, 1.2, D.TILLS[t].z];

function onGameMsg(m) {
  const t = performance.now() / 1000;
  switch (m.t) {
    case 'snap': {
      G.tt = m.tt;
      const seen = new Set();
      for (const a of m.c) {
        let e = G.shoppers.get(a[0]); if (!e) continue;
        e.buf.push({ t, x: a[1], z: a[2], yaw: a[3] }); if (e.buf.length > 20) e.buf.shift();
        e.n = a[4]; e.st = a[5]; seen.add(a[0]);
      }
      const wseen = new Set();
      for (const a of m.w) {
        let e = G.workers.get(a[0]);
        if (!e) { e = addWorker(a); }
        e.buf.push({ t, x: a[3], z: a[4], yaw: a[5] }); if (e.buf.length > 20) e.buf.shift();
        e.carry = a[6]; e.busy = a[7]; wseen.add(a[0]);
      }
      for (const [id, e] of G.workers) if (!wseen.has(id)) { world.ents.remove(e.fig.group); G.workers.delete(id); }
      const oseen = new Set();
      for (const a of m.o) {
        const s = G.stores[a[0]]; if (a[0] === G.mine) continue;
        let e = G.owners.get(a[0]);
        if (!e || e.ownerId !== s.ownerId) { if (e) world.ents.remove(e.fig.group); e = { ownerId: s.ownerId, buf: [], fig: new Googly({ color: s.color, role: 'owner', apron: '#2f9e44', cap: '#f2f2f7', name: s.ownerName, tag: s.color }) }; world.ents.add(e.fig.group); G.owners.set(a[0], e); }
        e.buf.push({ t, x: a[1], z: a[2], yaw: a[3] }); if (e.buf.length > 20) e.buf.shift(); e.carry = a[4]; oseen.add(a[0]);
      }
      for (const [i, e] of G.owners) if (!oseen.has(i)) { world.ents.remove(e.fig.group); G.owners.delete(i); }
      break;
    }
    case 'cadd': {
      const c = m.c;
      const fig = new Googly({ color: c.color, role: 'shopper', lite: true, look: c.look, scale: 0.92 + (c.look % 3) * 0.05 });
      fig.group.position.set(c.x, 0, c.z);
      fig.hold({ basket: 0 });
      world.ents.add(fig.group);
      G.shoppers.set(c.id, { id: c.id, fig, buf: [{ t, x: c.x, z: c.z, yaw: Math.PI }], s: c.s, n: 0, st: 0, paid: false });
      break;
    }
    case 'cdel': { const e = G.shoppers.get(m.id); if (e) { world.ents.remove(e.fig.group); G.shoppers.delete(m.id); } break; }
    case 'cclear': for (const e of G.shoppers.values()) world.ents.remove(e.fig.group); G.shoppers.clear(); break;
    case 'store': {
      const s = m.s, old = G.stores[s.i];
      G.stores[s.i] = s;
      if (s.i === G.mine && old && old.carry?.p !== s.carry?.p) { /* carry changed */ }
      if (old && old.ownerId !== s.ownerId) G.mine = G.stores.findIndex(x => x.ownerId === myId);
      world.setStore(s, s.i === G.mine);
      // checkout beeps
      const d = s.sc - (G.lastSc[s.i] ?? s.sc); G.lastSc[s.i] = s.sc;
      if (d > 0) { const n = Math.min(d, 8); for (let k = 0; k < n; k++) setTimeout(() => sfx.scan(tillPos(s.i)), k * 75); }
      if (s.i === G.mine) refreshPanels();
      break;
    }
    case 'owner': break;
    case 'sale': {
      const [x, y, z] = tillPos(m.i, 0);
      const e = G.shoppers.get(m.cid);
      const at = e ? [e.fig.group.position.x, 2.1, e.fig.group.position.z] : [x, y, z];
      if (e) { e.paid = true; e.fig.hold('bag'); }
      if (m.i === G.mine || dist2(me.x, me.z, x, z) < 400) { world.floatText(at[0], at[1], at[2], '+' + D.money2(m.amt), '#7dff7d'); sfx.chaching(at, m.amt); }
      break;
    }
    case 'bubble': {
      const e = G.shoppers.get(m.cid); if (!e) break;
      const p = m.p ? PROD[m.p]?.name : '';
      const B = { pricey: [`${p}? TOO PRICEY!`, '#ff9a8a'], oos: [`No ${p}?!`, '#ffd23a'], nosell: [`No ${p} here…`, '#ddd'], wait: ['TOO SLOW! 😤', '#ff7a6a'], happy: ['♥ Great store!', '#ff9ed2'], dirty: ['Eww, sticky floor', '#c9f'], cheap: ['Bargain!', '#7dff7d'] }[m.k];
      if (!B) break;
      world.bubble(e.fig, B[0], B[1]);
      const pos = [e.fig.group.position.x, 1.5, e.fig.group.position.z];
      const near = dist2(me.x, me.z, pos[0], pos[2]) < 300;
      if (near) { if (m.k === 'happy' || m.k === 'cheap') { sfx.happy(pos); e.fig.react('happy'); } else if (m.k === 'wait') { sfx.angry(pos); e.fig.react('angry'); } else { sfx.grumble(pos); e.fig.react('angry'); } }
      break;
    }
    case 'spill':
      if (m.on) { world.addSpill(m.id, m.x, m.z, m.kind); if (m.s === G.mine) { sfx.spill([m.x, 0.3, m.z]); if (!G.spillTip) { G.spillTip = true; toast('Someone spilled something! Stand on it and <b>hold E</b> to mop, or hire a janitor (U).', 4000); } } }
      else { world.removeSpill(m.id); if (dist2(me.x, me.z, ...(spillPos(m.id) || [1e9, 1e9])) < 30) sfx.mop(null); }
      break;
    case 'truck': world.truck(m.i, m.eta); if (m.i === G.mine) setTimeout(() => G && sfx.truck([D.storeX(m.i) + 5, 1, -21]), Math.max(0, m.eta - 3.2) * 1000); break;
    case 'fx': {
      const X = D.storeX(m.i ?? 0);
      if (m.k === 'boxUp' && m.i === G.mine) sfx.boxUp(null);
      else if (m.k === 'boxDown') { const sl = SLOTS[m.slot]; sfx.boxDown([X + sl.x, 1, sl.z]); }
      else if (m.k === 'build') { sfx.upgrade(); if (m.i === G.mine) toast(`New ${FIXTURES[SLOTS[m.slot].kind].name.toLowerCase()} built! Bring boxes from the stockroom to stock it.`); }
      else if (m.k === 'hire' && m.i === G.mine) sfx.hire();
      else if (m.k === 'upgrade' && m.i === G.mine) sfx.upgrade();
      else if (m.k === 'delivered' && m.i === G.mine) { toast('📦 Delivery is in the stockroom!'); sfx.boxUp(null); }
      else if (m.k === 'door') { world.stores[m.i].wantDoor = true; if (dist2(me.x, me.z, X + 4, 0) < 120) sfx.door([X + 4, 1.5, 0]); }
      else if (m.k === 'open') { sfx.bell(); }
      else if (m.k === 'closing') { sfx.closing(); toast('🔔 The stores close soon!'); }
      break;
    }
    case 'dayend': dayReport(m); break;
    case 'news': G.day = m.day; G.event = m.event; G.whole = m.whole; G.tt = 0; showNews(m.event, m.day); if (G.solo) requestSave(); refreshPanels(); break;
    case 'end': endScreen(m.standings); break;
  }
}
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
function spillPos(id) { const g = world.spills.get(id); return g ? [g.position.x, g.position.z] : null; }
function addWorker(a) {
  const [id, si, role] = a, s = G.stores[si];
  const col = role === 'boss' ? s.color : ['#ffb3a0', '#a0d8ff', '#c9f7a0', '#ffe08a', '#e0b0ff'][id % 5];
  const fig = new Googly({ color: col, role: 'staff', apron: role === 'boss' ? '#2f9e44' : STAFF[role].color, cap: role === 'boss' ? '#f2f2f7' : STAFF[role].color, name: role === 'boss' ? s.ownerName : STAFF[role].name.toUpperCase(), tag: role === 'boss' ? s.color : STAFF[role].color, lite: role !== 'boss' });
  if (role !== 'boss' && fig.tag) { fig.tag.scale.multiplyScalar(0.7); fig.tag.position.y = 1.95; }
  if (role === 'janitor') fig.hold('mop');
  world.ents.add(fig.group);
  const e = { id, si, role, fig, buf: [], carry: '', busy: 0 };
  G.workers.set(id, e);
  return e;
}

// ------------------------------------------------------------------ news, reports, end
function showNews(ev, day) {
  if (!ev) return;
  const wd = D.WEEKDAYS[(day - 1) % 7];
  $('h-news').innerHTML = `<b>📰 ${esc(ev.title)}</b>DAY ${day} · ${wd}${(day - 1) % 7 >= 5 ? ' (weekend: more shoppers!)' : ''} — ${esc(ev.text)}`;
  $('h-news').classList.remove('hidden');
  sfx.news();
  clearTimeout(showNews.t); showNews.t = setTimeout(() => $('h-news').classList.add('hidden'), 7000);
}
function dayReport(m) {
  sfx.dayEnd();
  const r = m.reports.find(x => x.i === G.mine); if (!r) return;
  const rank = [...m.reports].sort((a, b) => b.cash - a.cash).findIndex(x => x.i === G.mine) + 1;
  $('dayrep').innerHTML = `<h3>DAY ${m.day} DONE</h3>
    <div class="l"><span>Sales</span><b class="ok">${D.money2(r.rev)}</b></div>
    <div class="l"><span>Stock bought</span><b>−${D.money2(r.cogs)}</b></div>
    <div class="l"><span>Rent, power, wages, upgrades</span><b>−${D.money2(r.costs)}</b></div>
    <div class="l big"><span>Profit</span><b class="${r.profit >= 0 ? 'ok' : 'bad'}">${D.money2(r.profit)}</b></div>
    <div class="l"><span>Shoppers served</span><b>${r.served}</b></div>
    <div class="l"><span>Said "too pricey"</span><b class="${r.pricey > 8 ? 'bad' : ''}">${r.pricey}</b></div>
    <div class="l"><span>Found empty shelves</span><b class="${r.oos > 6 ? 'bad' : ''}">${r.oos}</b></div>
    <div class="l"><span>Walked out (slow till)</span><b class="${r.gaveup > 3 ? 'bad' : ''}">${r.gaveup}</b></div>
    ${r.spoiled ? `<div class="l"><span>Food spoiled overnight</span><b class="warn">${r.spoiled}</b></div>` : ''}
    <div class="l"><span>Rating</span><b>${stars(r.rating)}</b></div>
    <div class="l big"><span>Rank</span><b>#${rank} of 4</b></div>`;
  $('dayrep').classList.remove('hidden');
  clearTimeout(dayReport.t); dayReport.t = setTimeout(() => $('dayrep').classList.add('hidden'), 9000);
}
const stars = r => { const n = Math.round(r); let s = ''; for (let k = 1; k <= 5; k++) s += k <= n ? '★' : '<span>★</span>'; return s; };
function endScreen(st) {
  const mineIdx = st.findIndex(x => x.ownerId === myId);
  const won = mineIdx === 0;
  $('end-title').textContent = won ? '🏆 YOU WIN THE MONTH!' : mineIdx >= 0 ? `YOU FINISHED #${mineIdx + 1}` : 'END OF THE MONTH';
  $('end-podium').innerHTML = st.map((x, k) => `<div class="pod p${k + 1}"><div class="place">#${k + 1}</div><span class="dot" style="background:${esc(x.color)}"></span> ${esc(x.owner)}<br><small>${esc(x.name)}</small><br>${D.money(x.worth)}</div>`).join('');
  $('end-list').innerHTML = `<div class="stand head"><span></span><span>STORE</span><span class="r">NET WORTH</span><span class="r">SHOPPERS</span><span class="r">RATING</span></div>` +
    st.map((x, k) => `<div class="stand ${x.ownerId === myId ? 'me' : ''}"><span>#${k + 1}</span><span><span class="dot" style="background:${esc(x.color)}"></span> ${esc(x.name)} <small>(${esc(x.owner)}${x.human ? '' : ', computer'})</small></span><span class="r">${D.money(x.worth)}</span><span class="r">${x.served}</span><span class="r">★${x.rating.toFixed(1)}</span></div>`).join('');
  drawChart(st);
  if (won) sfx.win(); else sfx.lose();
  music.play('end');
  if (G?.solo) store.del('save');
  leaveGame(true);
  show('scr-end');
}
function drawChart(st) {
  const c = $('end-chart'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const all = st.flatMap(x => x.history.map(h => h.cash)), lo = Math.min(0, ...all), hi = Math.max(D.START_CASH, ...all);
  const X = d => 40 + (d - 1) / (D.DAYS - 1) * (W - 60), Y = v => H - 20 - (v - lo) / (hi - lo || 1) * (H - 40);
  g.strokeStyle = '#ffffff22'; g.fillStyle = '#ffffff88'; g.font = '12px "Avenir Next", sans-serif';
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; g.beginPath(); g.moveTo(40, Y(v)); g.lineTo(W - 20, Y(v)); g.stroke(); g.fillText(D.money(v), 2, Y(v) + 4); }
  for (const x of st) { g.strokeStyle = x.color; g.lineWidth = x.ownerId === myId ? 4 : 2; g.beginPath(); x.history.forEach((h, k) => k ? g.lineTo(X(h.day), Y(h.cash)) : g.moveTo(X(h.day), Y(h.cash))); g.stroke(); }
}
$('end-again').onclick = () => { sfx.click(); if (online && room) { show('scr-lobby'); } else startSolo(null); };
$('end-title-btn').onclick = () => { sfx.click(); if (online) { send({ t: 'leave' }); conn?.close(); conn = null; } show('scr-title'); buildTitleFig(); drawContinue(); music.play('menu'); };

// ------------------------------------------------------------------ saving (solo)
function requestSave() { if (G?.solo) send({ t: 'save' }); }
function flashSaved() { $('saved').classList.add('on'); clearTimeout(flashSaved.t); flashSaved.t = setTimeout(() => $('saved').classList.remove('on'), 1200); }
setInterval(() => { if (G?.solo && !paused) requestSave(); }, 30000);
addEventListener('beforeunload', () => { if (G?.solo) { try { const d = conn?.core && [...conn.core.rooms.values()][0]; if (d) store.set('save', conn.core.saveData(d)); } catch { } } });

// ------------------------------------------------------------------ pause
let paused = false;
function openPause() {
  if (!G) return;
  paused = true; show('scr-pause'); closePanels();
  $('pause-title').textContent = G.solo ? 'PAUSED' : 'MENU';
  $('pause-note').textContent = G.solo ? 'The clock is stopped.' : 'Online games keep running — your store stays open!';
  if (G.solo) send({ t: 'pause', on: true });
}
function resume() { paused = false; show(null); if (G?.solo) send({ t: 'pause', on: false }); }
$('p-resume').onclick = () => { sfx.click(); resume(); };
$('p-quit').onclick = () => {
  sfx.click();
  if (G?.solo) { const r = conn?.core && [...conn.core.rooms.values()][0]; if (r) { store.set('save', conn.core.saveData(r)); } }
  paused = false; send({ t: 'leave' }); conn?.close?.(); conn = null; leaveGame(); show('scr-title');
};

// ------------------------------------------------------------------ input
const keys = new Set();
let holdE = false, holdT = 0, holdKind = null, confirmBuy = null;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.key === 'Escape') e.target.blur(); if (e.key === 'Enter' && e.target.id === 'chatin') { const t = e.target.value.trim(); if (t) send({ t: 'chat', text: t }); e.target.value = ''; $('chatform').classList.add('hidden'); e.target.blur(); } return; }
  const k = e.key.toLowerCase();
  if (k === 'tab') { e.preventDefault(); if (G) { $('pn-board').classList.remove('hidden'); drawBoard(); } return; }
  if (!G) return;
  if (k === 'escape') { if (openPanelId) closePanels(); else if (screen === 'scr-pause') resume(); else if (screen === 'scr-help') show('scr-pause'); else openPause(); return; }
  if (paused) return;
  if (openPanelId === 'pick' && /^[1-9]$/.test(k)) { const b = $('pick-list').querySelectorAll('.pbtn:not(.none)')[+k - 1]; b?.click(); return; }
  if (k === 'b') return togglePanel('order');
  if (k === 'p') return togglePanel('prices');
  if (k === 'u') return togglePanel('up');
  if (k === 'm') { setMusic(!audioState().music); drawAudioBtns(); return; }
  if (k === 't' && !G.solo) { e.preventDefault(); $('chatform').classList.remove('hidden'); $('chatin').focus(); return; }
  if (openPanelId) return;
  keys.add(k);
  if (k === 'e' && !e.repeat) interact(true);
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === 'tab') $('pn-board').classList.add('hidden');
  if (k === 'e') interact(false);
});
addEventListener('blur', () => { keys.clear(); interact(false); });
// camera: drag to turn, wheel to zoom
let drag = null;
$('view').addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => drag = null);
addEventListener('pointermove', e => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - drag.y) * 0.004, 0.35, 1.3); drag = { x: e.clientX, y: e.clientY }; });
$('view').addEventListener('wheel', e => { cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 5, 26); }, { passive: true });

// ------------------------------------------------------------------ walking & bumping into things
function colliders() {
  const out = world.colliders.slice();
  if (!G) return out;
  G.stores.forEach((s, i) => {
    const X = D.storeX(i);
    D.solidBoxes().forEach((b, k) => { if (b.slot && !s.fixtures[k]) return; out.push({ x0: X + b.x - b.w / 2, x1: X + b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }); });
  });
  return out;
}
function moveMe(dt) {
  let ix = 0, iz = 0;
  if (keys.has('w')) iz -= 1; if (keys.has('s')) iz += 1; if (keys.has('a')) ix -= 1; if (keys.has('d')) ix += 1;
  if (keys.has('arrowleft')) cam.yaw += dt * 1.8; if (keys.has('arrowright')) cam.yaw -= dt * 1.8;
  if (keys.has('arrowup')) iz -= 1; if (keys.has('arrowdown')) iz += 1;
  const L = Math.hypot(ix, iz);
  const sp = (keys.has('shift') ? 6.2 : 4.3) * (holdKind ? 0 : 1);
  let wx = 0, wz = 0;
  if (L > 0) { const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw); const lx = ix / L, lz = iz / L; wx = lx * c + lz * s; wz = -lx * s + lz * c; }
  const k = 1 - Math.exp(-14 * dt);
  me.vx += (wx * sp - me.vx) * k; me.vz += (wz * sp - me.vz) * k;
  me.x += me.vx * dt; me.z += me.vz * dt;
  const R = 0.36;
  for (let pass = 0; pass < 2; pass++) for (const b of colliders()) {
    const cx = Math.max(b.x0, Math.min(me.x, b.x1)), cz = Math.max(b.z0, Math.min(me.z, b.z1)), dx = me.x - cx, dz = me.z - cz, d = Math.hypot(dx, dz);
    if (d < R) {
      if (d > 1e-6) { me.x = cx + dx / d * R; me.z = cz + dz / d * R; }
      else { const pen = [[me.x - b.x0, -1, 0], [b.x1 - me.x, 1, 0], [me.z - b.z0, 0, -1], [b.z1 - me.z, 0, 1]].sort((a, b2) => a[0] - b2[0])[0]; me.x += pen[1] * (pen[0] + R); me.z += pen[2] * (pen[0] + R); }
    }
  }
  const spd = Math.hypot(me.vx, me.vz);
  if (spd > 0.3) { const want = Math.atan2(me.vx, me.vz); let d = ((want - me.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; me.yaw += d * Math.min(1, dt * 12); }
  return spd;
}
function localPos() { return G && G.mine >= 0 ? [me.x - D.storeX(G.mine), me.z] : [1e9, 1e9]; }
const insideStore = (i, x, z) => Math.abs(x - D.storeX(i)) < D.STORE_W / 2 && z < 0 && z > -D.STORE_D;

// ------------------------------------------------------------------ what can I do here?
function findAction() {
  const s = myStore(); if (!s) return null;
  const [lx, lz] = localPos();
  if (!insideStore(G.mine, me.x, me.z)) {
    const other = G.stores.findIndex((o, i) => insideStore(i, me.x, me.z));
    return other >= 0 ? { kind: 'visit', i: other } : null;
  }
  const cands = [];
  const d = (x, z) => Math.hypot(lx - x, lz - z);
  // spills
  for (const [id, g] of world.spills) { const [sx, sz] = [g.position.x - D.storeX(G.mine), g.position.z]; if (Math.abs(sx) < 8 && d(sx, sz) < 1.2) cands.push({ kind: 'mop', id, d: d(sx, sz) - 0.5 }); }
  // tills
  D.TILLS.forEach((t, k) => { const dd = d(...t.cashier); if (dd < 1.3) cands.push(k === 1 && !s.perm.till2 ? { kind: 'till2buy', d: dd } : { kind: 'till', t: k, d: dd - 0.3 }); });
  // stockroom rack
  { const dd = d(...D.STOCK_RACK); if (dd < 1.9 && lz < D.PARTITION_Z) cands.push({ kind: 'rack', d: dd }); }
  // shelves
  SLOTS.forEach((sl, k) => {
    const f = FIXTURES[sl.kind];
    if (!s.fixtures[k]) {
      const ex = Math.max(Math.abs(lx - sl.x) - f.w / 2, 0), ez = Math.max(Math.abs(lz - sl.z) - f.d / 2, 0), dd = Math.hypot(ex, ez);
      if (dd < 0.9) cands.push({ kind: 'buy', slot: k, d: dd + 0.2 });
      return;
    }
    sl.stand.forEach(([sx, sz], j) => { const dd = d(sx, sz); if (dd < 1.35) cands.push({ kind: 'sec', slot: k, sec: j, d: dd }); });
  });
  cands.sort((a, b) => a.d - b.d);
  return cands[0] || null;
}
function describe(a) {
  const s = myStore(); if (!a) return '';
  const K = t => `<kbd>${t}</kbd>`;
  switch (a.kind) {
    case 'visit': { const o = G.stores[a.i]; return `<span class="dim">👀 Snooping in ${esc(o.name)}… check their price tags!</span>`; }
    case 'mop': return `${K('hold E')} Mop the spill`;
    case 'till': { const waiting = s.q + (s.tills?.[a.t] ? 1 : 0); return `${K('hold E')} Scan shoppers${waiting ? ` <span class="warn">(${waiting} waiting)</span>` : ' <span class="dim">(nobody waiting)</span>'}`; }
    case 'till2buy': return `${K('E')} Lane 2 is closed — open Upgrades to buy it`;
    case 'rack': return s.carry ? `${K('E')} Put the ${esc(PROD[s.carry.p].name)} back` : `${K('E')} Grab a trolley of stock`;
    case 'buy': { const f = FIXTURES[SLOTS[a.slot].kind]; return confirmBuy === a.slot ? `${K('E')} again to buy a ${f.name.toLowerCase()} for ${D.money(f.price)}` : `${K('E')} Buy a ${f.name.toLowerCase()} here · ${D.money(f.price)}${s.cash < f.price ? ' <span class="bad">(not enough cash)</span>' : ''}`; }
    case 'sec': {
      const sl = SLOTS[a.slot], sec = s.secs[a.slot][a.sec], cap = FIXTURES[sl.kind].cap;
      if (s.carry) {
        const p = PROD[s.carry.p];
        if (p.kind !== sl.kind) return `<span class="bad">${esc(p.name)} goes on a ${FIXTURES[p.kind].name.toLowerCase()}, not here</span>`;
        if (sec.p && sec.p !== p.id && sec.n > 0) return `<span class="bad">This spot still has ${esc(PROD[sec.p].name)}</span>`;
        if (sec.p === p.id && sec.n >= cap) return `<span class="dim">${esc(p.name)} is already full</span>`;
        return `${K('E')} Stock ${esc(p.name)} here (${sec.p === p.id ? sec.n : 0} → ${Math.min(cap, (sec.p === p.id ? sec.n : 0) + s.carry.n)})`;
      }
      if (!sec.p) return `<span class="dim">Empty ${FIXTURES[sl.kind].name.toLowerCase()} spot — grab a trolley in the stockroom</span>`;
      return `${esc(PROD[sec.p].name)} · ${sec.n}/${cap} on shelf · ${s.back[sec.p]} in stockroom · ${K('E')} change price (${D.money2(s.prices[sec.p])})`;
    }
  }
  return '';
}
function interact(down) {
  if (!G || paused || openPanelId) { if (!down) stopHold(); return; }
  if (!down) { stopHold(); return; }
  const a = findAction(), s = myStore(); if (!a || !s) return;
  switch (a.kind) {
    case 'mop': holdKind = 'mop'; holdT = 0; me.fig.hold('mop'); G.holdId = a.id; break;
    case 'till': holdKind = 'till'; send({ t: 'hold', on: true }); break;
    case 'till2buy': openPanel('up'); break;
    case 'rack': if (s.carry) { send({ t: 'return' }); sfx.boxUp(null); } else openPanel('pick'); break;
    case 'buy': {
      const f = FIXTURES[SLOTS[a.slot].kind];
      if (s.cash < f.price) { sfx.error(); toast(`You need ${D.money(f.price)} for a ${f.name.toLowerCase()}.`); break; }
      if (confirmBuy === a.slot) { send({ t: 'fixture', slot: a.slot }); confirmBuy = null; }
      else { confirmBuy = a.slot; sfx.click(); setTimeout(() => { if (confirmBuy === a.slot) confirmBuy = null; }, 2500); }
      break;
    }
    case 'sec': {
      const sec = s.secs[a.slot][a.sec];
      if (s.carry) { send({ t: 'place', slot: a.slot, sec: a.sec }); }
      else if (sec.p) { openPanel('prices'); highlightPrice(sec.p); }
      else toast('Grab a trolley in the stockroom (at the back) and bring it here.');
      break;
    }
  }
}
function stopHold() {
  if (holdKind === 'till') send({ t: 'hold', on: false });
  if (holdKind === 'mop') me.fig?.hold(null);
  holdKind = null; holdT = 0; $('h-hold').classList.add('hidden');
}

// ------------------------------------------------------------------ panels
let openPanelId = null;
const PANELS = { order: 'pn-order', prices: 'pn-prices', up: 'pn-up', pick: 'pn-pick' };
function openPanel(id) { closePanels(); drawUp.last = drawPick.last = null; if (!G || G.mine < 0) return; openPanelId = id; $(PANELS[id]).classList.remove('hidden'); keys.clear(); stopHold(); sfx.click(); refreshPanels(true); }
function closePanels() { openPanelId = null; for (const p of Object.values(PANELS)) $(p).classList.add('hidden'); }
function togglePanel(id) { if (openPanelId === id) closePanels(); else openPanel(id); }
document.querySelectorAll('.panel .close').forEach(b => b.onclick = () => { sfx.click(); closePanels(); });
document.querySelectorAll('.panel').forEach(p => p.addEventListener('pointerdown', e => { if (e.target === p) closePanels(); }));
function refreshPanels(force) {
  if (!openPanelId || !G) return;
  if (openPanelId === 'order') drawOrder(force);
  if (openPanelId === 'prices') drawPrices(force);
  if (openPanelId === 'up') drawUp();
  if (openPanelId === 'pick') drawPick();
}
// --- ordering
const cart = {};
const unitCost = pid => Math.round(PROD[pid].cost * (G.whole[pid] || 1) * 100) / 100;
function carried(s, pid) { return SLOTS.some((sl, k) => s.fixtures[k] && s.secs[k].some(sec => sec.p === pid)); }
function hasRoom(s, pid) { const kind = PROD[pid].kind; return SLOTS.some((sl, k) => s.fixtures[k] && sl.kind === kind && s.secs[k].some(sec => !sec.p || sec.p === pid)); }
function drawOrder(force) {
  const s = myStore();
  $('auto-order').checked = !!s.auto;
  if (force || !$('order-list').children.length) {
    const sorted = [...PRODUCTS].sort((a, b) => (carried(s, b.id) - carried(s, a.id)) || (hasRoom(s, b.id) - hasRoom(s, a.id)));
    $('order-list').innerHTML = `<div class="prow orow head"><span></span><span>PRODUCT</span><span>COST TODAY</span><span>BOX OF 24</span><span>YOU HAVE</span><span class="qty">BOXES</span></div>` + sorted.map(p => `<div class="prow orow" data-p="${p.id}"><img src="${iconURL(p.id)}"><span class="nm"><b>${p.name}</b><small data-w></small></span><span data-c></span><span data-b></span><span data-h></span><span class="qty"><button class="grey mini" data-d="-1">−</button><b data-q>0</b><button class="green mini" data-d="1">+</button><button class="grey mini" data-d="5">+5</button></span></div>`).join('');
    $('order-list').querySelectorAll('.orow[data-p] button').forEach(b => b.onclick = () => { const pid = b.closest('.orow').dataset.p; cart[pid] = Math.max(0, Math.min(50, (cart[pid] || 0) + +b.dataset.d)); sfx.click(); drawOrder(); });
  }
  let boxes = 0, total = 0;
  $('order-list').querySelectorAll('.orow[data-p]').forEach(row => {
    const pid = row.dataset.p, p = PROD[pid], u = unitCost(pid), q = cart[pid] || 0, trend = (G.whole[pid] || 1);
    boxes += q; total += q * u * D.BOX;
    row.querySelector('[data-c]').innerHTML = `${D.money2(u)} <small class="${trend > 1.05 ? 'bad' : trend < 0.95 ? 'ok' : ''}">${trend > 1.05 ? '▲' : trend < 0.95 ? '▼' : ''}</small><br><small style="opacity:.6">sells ~${D.money2(p.ref)}</small>`;
    row.querySelector('[data-b]').textContent = D.money2(u * D.BOX);
    row.querySelector('[data-h]').innerHTML = `${s.back[pid]} in back<br><small>${onShelfOf(s, pid)} on shelf</small>`;
    row.querySelector('[data-q]').textContent = q;
    row.querySelector('[data-w]').innerHTML = carried(s, pid) ? `${FIXTURES[p.kind].name}` : hasRoom(s, pid) ? `<span class="warn">new! goes on a ${FIXTURES[p.kind].name.toLowerCase()}</span>` : `<span class="bad">no ${FIXTURES[p.kind].name.toLowerCase()} space — buy one (U)</span>`;
    row.classList.toggle('dim', !carried(s, pid) && !hasRoom(s, pid));
  });
  if (boxes >= 10) total *= 0.95;
  $('order-total').innerHTML = `Total: ${D.money2(total)} <small style="font-size:13px;opacity:.75">${boxes} box${boxes === 1 ? '' : 'es'}${boxes >= 10 ? ' · 5% off!' : ''} · you have ${D.money(s.cash)}</small>`;
  $('order-go').disabled = !boxes || total > s.cash;
}
const onShelfOf = (s, pid) => SLOTS.reduce((a, sl, k) => a + (s.fixtures[k] ? s.secs[k].reduce((b, sec) => b + (sec.p === pid ? sec.n : 0), 0) : 0), 0);
$('order-go').onclick = () => { const items = {}; for (const [k, v] of Object.entries(cart)) if (v) items[k] = v; send({ t: 'order', items }); for (const k in cart) cart[k] = 0; drawOrder(); };
$('auto-order').onchange = () => { send({ t: 'auto', on: $('auto-order').checked }); sfx.click(); toast($('auto-order').checked ? 'Auto-order ON: stock arrives by itself.' : 'Auto-order OFF: order stock yourself with B.'); };
$('order-clear').onclick = () => { for (const k in cart) cart[k] = 0; sfx.click(); drawOrder(); };
// --- prices
function rivalBest(pid) {
  let best = null;
  G.stores.forEach((o, i) => { if (i === G.mine || !carried(o, pid)) return; const v = o.prices[pid]; if (best === null || v < best.v) best = { v, name: o.ownerName, color: o.color }; });
  return best;
}
function drawPrices(force) {
  const s = myStore();
  const list = PRODUCTS.filter(p => carried(s, p.id) || s.back[p.id] > 0);
  const key = list.map(p => p.id).join();
  if (force || key !== drawPrices.key) {
    drawPrices.key = key;
    $('price-list').innerHTML = `<div class="prow pr head"><span></span><span>PRODUCT</span><span>COST</span><span>NORMAL</span><span>CHEAPEST RIVAL</span><span class="qty">YOUR PRICE</span></div>` + list.map(p => `<div class="prow pr" data-p="${p.id}"><img src="${iconURL(p.id)}"><span class="nm"><b>${p.name}</b><small data-s></small></span><span data-c></span><span>${D.money2(p.ref * accept(p.id))}</span><span data-r></span><span class="qty"><button class="grey mini" data-d="-0.1">−</button><input data-v inputmode="decimal"><button class="grey mini" data-d="0.1">+</button></span></div>`).join('') + (list.length ? '' : '<div class="empty">Nothing on your shelves yet.</div>');
    $('price-list').querySelectorAll('.pr[data-p]').forEach(row => {
      const pid = row.dataset.p, inp = row.querySelector('[data-v]');
      row.querySelectorAll('button').forEach(b => b.onclick = () => { const v = Math.max(0.05, Math.round(((myStore().prices[pid]) + +b.dataset.d) * 100) / 100); send({ t: 'price', p: pid, v }); sfx.click(); myStore().prices[pid] = v; drawPrices(); });
      inp.onchange = () => { const v = parseFloat(inp.value.replace('$', '')); if (Number.isFinite(v) && v > 0) { send({ t: 'price', p: pid, v }); myStore().prices[pid] = v; sfx.click(); } drawPrices(); };
      inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); };
    });
  }
  $('price-list').querySelectorAll('.pr[data-p]').forEach(row => {
    const pid = row.dataset.p, p = PROD[pid], price = s.prices[pid], cost = unitCost(pid), rb = rivalBest(pid), inp = row.querySelector('[data-v]');
    if (document.activeElement !== inp) inp.value = price.toFixed(2);
    const margin = Math.round((price - cost) / price * 100);
    row.querySelector('[data-c]').innerHTML = `${D.money2(cost)}<br><small class="${margin < 10 ? 'bad' : margin > 45 ? 'ok' : ''}">${margin}% profit</small>`;
    row.querySelector('[data-r]').innerHTML = rb ? `<span class="dot" style="background:${esc(rb.color)}"></span> ${D.money2(rb.v)} <small>${esc(rb.name)}</small>` : '<small>nobody else sells it</small>';
    const sold = s.sold?.[pid] || 0, pr = s.pricey?.[pid] || 0;
    row.querySelector('[data-s]').innerHTML = `sold ${sold} today${pr ? ` · <span class="bad">${pr} said too pricey</span>` : ''}`;
  });
}
const accept = pid => (G.event?.accept?.[pid] || 1) * (G.event?.acceptAll || 1);
function highlightPrice(pid) { setTimeout(() => { const row = $('price-list').querySelector(`[data-p="${pid}"]`); if (row) { row.scrollIntoView({ block: 'center' }); row.style.outline = '2px solid #ffd23a'; setTimeout(() => row.style.outline = '', 1500); } }, 30); }
$('pn-prices').querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
  const s = myStore(), k = +b.dataset.all, all = {};
  for (const p of PRODUCTS) all[p.id] = Math.max(0.19, Math.round(p.ref * accept(p.id) * k * 10) / 10 - 0.01);
  send({ t: 'prices', all }); Object.assign(s.prices, all); sfx.click(); drawPrices();
});
// --- upgrades & staff
function drawUp() {
  const s = myStore();
  const row = (name, desc, btn) => `<div class="prow up"><span class="nm"><b>${name}</b><small>${desc}</small></span>${btn}</div>`;
  let h = `<div class="sec-title">FIXTURES — more space, more kinds of food</div>`;
  const kinds = {};
  SLOTS.forEach((sl, k) => { (kinds[sl.kind] ||= []).push(k); });
  for (const [kind, ks] of Object.entries(kinds)) {
    const f = FIXTURES[kind], have = ks.filter(k => s.fixtures[k]).length, next = ks.find(k => !s.fixtures[k]);
    const holds = PRODUCTS.filter(p => p.kind === kind).map(p => p.name).join(', ');
    h += row(`${f.name} <small>(${have}/${ks.length})</small>`, `Holds ${f.cap} per side, 2 products. ${holds}.${f.power ? ` Power: ${D.money(D.POWER)}/day.` : ''}`, next === undefined ? '<button disabled class="grey">ALL BUILT</button>' : `<button class="green" data-fix="${next}" ${s.cash < f.price ? 'disabled' : ''}>BUILD ${D.money(f.price)}</button>`);
  }
  h += `<div class="sec-title">STAFF — paid every night</div>`;
  for (const [role, st] of Object.entries(STAFF)) {
    const on = !!s.staff[role], locked = st.needs && !s.perm[st.needs];
    h += row(`${st.name} <small>${D.money(st.wage)}/day</small>`, st.desc, on ? `<button class="red" data-fire="${role}">LET GO</button>` : `<button class="green" data-hire="${role}" ${locked ? 'disabled' : ''}>${locked ? 'NEEDS LANE 2' : 'HIRE'}</button>`);
  }
  h += `<div class="sec-title">UPGRADES & ADS</div>`;
  for (const u of UPGRADES) {
    const own = u.perm && s.perm[u.id], running = !u.perm && s.adDays > 0;
    h += row(`${u.name}`, u.desc + (running && u.ad === s.ad ? ` <span class="ok">(running: ${s.adDays} day${s.adDays > 1 ? 's' : ''} left)</span>` : ''), own ? '<button disabled class="grey">OWNED ✓</button>' : `<button class="gold" data-up="${u.id}" ${s.cash < u.price ? 'disabled' : ''}>BUY ${D.money(u.price)}</button>`);
  }
  h += `<p class="tiny left">Rent is ${D.money(D.RENT)}/day. Your cash: <b>${D.money(s.cash)}</b></p>`;
  if (h === drawUp.last) return; drawUp.last = h;
  $('up-list').innerHTML = h;
  $('up-list').querySelectorAll('[data-fix]').forEach(b => b.onclick = () => { send({ t: 'fixture', slot: +b.dataset.fix }); });
  $('up-list').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { send({ t: 'hire', role: b.dataset.hire, on: true }); });
  $('up-list').querySelectorAll('[data-fire]').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'hire', role: b.dataset.fire, on: false }); });
  $('up-list').querySelectorAll('[data-up]').forEach(b => b.onclick = () => { send({ t: 'upgrade', id: b.dataset.up }); });
}
// --- grab a trolley
function drawPick() {
  const s = myStore();
  const list = PRODUCTS.filter(p => s.back[p.id] > 0 || carried(s, p.id)).sort((a, b) => (s.back[b.id] > 0) - (s.back[a.id] > 0));
  let n = 0;
  const html = list.map(p => { const has = s.back[p.id] > 0; if (has) n++; return `<div class="pbtn ${has ? '' : 'none'}" data-p="${p.id}">${has && n <= 9 ? `<kbd>${n}</kbd>` : ''}<img src="${iconURL(p.id)}">${p.name}<small>${s.back[p.id]} in back · ${onShelfOf(s, p.id)} on shelf</small></div>`; }).join('') || '<div class="empty">The stockroom is empty. Press B to buy stock!</div>';
  if (html === drawPick.last) return; drawPick.last = html; $('pick-list').innerHTML = html;
  $('pick-list').querySelectorAll('.pbtn:not(.none)').forEach(b => b.onclick = () => { send({ t: 'pick', p: b.dataset.p }); closePanels(); });
}
function drawBoard() {
  const rows = G.stores.map((s, i) => ({ s, i, worth: s.cash })).sort((a, b) => b.worth - a.worth);
  $('board-body').innerHTML = `<h2>STANDINGS · DAY ${G.day}/${D.DAYS}</h2><table><tr><th></th><th>STORE</th><th>OWNER</th><th class="r">CASH</th><th class="r">TODAY</th><th class="r">RATING</th><th class="r">STAFF</th></tr>` +
    rows.map((r, k) => { const s = r.s, today = s.today.rev - s.today.cogs - s.today.costs; return `<tr class="${r.i === G.mine ? 'me' : ''}"><td>#${k + 1}</td><td><span class="dot" style="background:${esc(s.color)}"></span> ${esc(s.name)}</td><td>${esc(s.ownerName)}${s.ownerId ? '' : ' 🤖'}</td><td class="r">${D.money(s.cash)}</td><td class="r ${today >= 0 ? 'ok' : 'bad'}">${D.money(today)}</td><td class="r">★${s.rating.toFixed(1)}</td><td class="r">${Object.values(s.staff).reduce((a, b) => a + b, 0)}</td></tr>`; }).join('') + '</table>';
}

// ------------------------------------------------------------------ HUD
function drawHUD() {
  const s = myStore(); if (!s) return;
  $('h-cash').textContent = D.money(s.cash); $('h-cash').classList.toggle('neg', s.cash < 0);
  const today = s.today.rev - s.today.cogs - s.today.costs;
  $('h-today').innerHTML = `Today: <span class="${today >= 0 ? 'ok' : 'bad'}">${today >= 0 ? '+' : ''}${D.money(today)}</span> · ${s.today.served} served`;
  $('h-stars').innerHTML = stars(s.rating) + ` <small style="display:inline;color:#fff;opacity:.7">${s.rating.toFixed(1)}</small>`;
  const wd = D.WEEKDAYS[(G.day - 1) % 7];
  $('h-day').textContent = `DAY ${G.day} / ${D.DAYS} · ${wd.toUpperCase()}`;
  $('h-time').textContent = D.clockText(G.tt) + (D.isOpen(G.tt) ? '' : D.hourAt(G.tt) < D.OPEN_H ? ' · opening soon' : ' · closed');
  $('h-dayfill').style.width = (G.tt / D.DAY_SEC * 100).toFixed(1) + '%';
  const leftSec = (D.DAYS - G.day) * D.DAY_SEC + (D.DAY_SEC - G.tt);
  $('h-left').textContent = `${Math.floor(leftSec / 60)}:${String(Math.floor(leftSec % 60)).padStart(2, '0')} left in the month`;
  const rows = G.stores.map((x, i) => ({ x, i })).sort((a, b) => b.x.cash - a.x.cash);
  $('h-board').innerHTML = '<small>RICHEST STORE WINS</small>' + rows.map((r, k) => `<div class="r ${r.i === G.mine ? 'me' : ''}"><b>${k + 1}</b><span class="dot" style="background:${esc(r.x.color)}"></span><span class="n">${esc(r.x.ownerName)}</span><span>${D.money(r.x.cash)}</span><span class="st">★${r.x.rating.toFixed(1)}</span></div>`).join('');
  // carrying
  if (s.carry) { $('h-carry').classList.remove('hidden'); $('h-carry').innerHTML = `<img src="${iconURL(s.carry.p)}"><div>${esc(PROD[s.carry.p].name)} × ${s.carry.n}<small>find a ${FIXTURES[PROD[s.carry.p].kind].name.toLowerCase()} and press E</small></div>`; }
  else $('h-carry').classList.add('hidden');
  // queue warning
  const waiting = s.q + (s.tills?.[0] ? 1 : 0) + (s.tills?.[1] ? 1 : 0);
  const staffed = s.staff.cashier || holdKind === 'till';
  $('h-q').classList.toggle('hidden', waiting === 0);
  $('h-q').classList.toggle('warn', waiting >= 3 && !staffed);
  $('h-q').innerHTML = `🧺 ${waiting} at the checkout${!staffed ? ' — <b>go to the till and hold E</b> (or hire a cashier)' : ''}`;
  if (waiting >= 4 && !staffed && G.prevQ < 4) sfx.warn();
  G.prevQ = waiting;
  // prompt
  const a = findAction();
  $('h-prompt').innerHTML = describe(a);
}

// ------------------------------------------------------------------ title backdrop
let titleFig = null, titleT = 0;
function buildTitleFig() {
  if (titleFig) world.ents.remove(titleFig.group);
  titleFig = new Googly({ color: prof.color, role: 'owner', apron: '#2f9e44', cap: '#f2f2f7' });
  titleFig.hold('bag');
  titleFig.group.position.set(D.storeX(1) + 3.2, 0.12, 2.2); titleFig.group.rotation.y = 0.35;
  world.ents.add(titleFig.group);
  for (let i = 0; i < 4; i++) world.dressStore(i, D.CPUS[i].store, D.CPUS[i].color);
  world.dressStore(1, (prof.store || ((prof.name || 'YOUR') + "'S MARKET")).toUpperCase(), prof.color === '#9aa0a6' ? '#2f9e44' : prof.color);
  for (let i = 0; i < 4; i++) { const st = world.stores[i]; D.START_SLOTS.forEach(ss => { st.fixtures[ss.slot].visible = true; }); }
}
function titleScene(dt) {
  titleT += dt;
  const X = D.storeX(1) + 2;
  const a = 0.35 + Math.sin(titleT * 0.08) * 0.35;
  world.camera.position.set(X - 2.5 + Math.sin(a) * 9, 3.2, 8.5 + Math.cos(a) * 3);
  world.camera.lookAt(X - 1.2, 1.6, 0);
  world.setTime(11.5, false);
  world.update(dt, { x: X, z: 0 });
  if (titleFig) { titleFig.update(dt, { speed: 0 }); if (Math.random() < dt * 0.3) titleFig.react('happy'); }
}

// ------------------------------------------------------------------ main loop
const _tmp = new THREE.Vector3();
function interp(e, rt) {
  const b = e.buf; if (!b.length) return null;
  if (b.length === 1 || rt <= b[0].t) return b[0];
  for (let k = b.length - 1; k > 0; k--) if (b[k - 1].t <= rt) {
    const A = b[k - 1], B = b[k], f = Math.min(1, (rt - A.t) / Math.max(1e-3, B.t - A.t));
    let dy = ((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, yaw: A.yaw + dy * f };
  }
  return b[b.length - 1];
}
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if (!G) { titleScene(dt); world.render(); return; }
  const spd = paused || openPanelId ? (me.vx = me.vz = 0) : moveMe(dt);
  // hold-E jobs
  if (holdKind === 'mop') { holdT += dt; $('h-hold').classList.remove('hidden'); $('h-holdfill').style.width = Math.min(100, holdT / 1.0 * 100) + '%'; if (holdT >= 1.0) { send({ t: 'mop', id: G.holdId }); stopHold(); } }
  if (holdKind === 'till') { const a = findAction(); if (!a || a.kind !== 'till') stopHold(); }
  const s = myStore();
  me.fig.group.position.set(me.x, 0, me.z); me.fig.group.rotation.y = me.yaw;
  if (holdKind !== 'mop') me.fig.hold(s?.carry ? { box: s.carry.p, two: s.carry.n > D.BOX } : null);
  me.fig.update(dt, { speed: spd, work: holdKind === 'till' || holdKind === 'mop' });
  if (holdKind === 'till') me.fig.group.rotation.y = Math.PI / 2;
  G.sendT -= dt;
  if (G.sendT <= 0) { G.sendT = 1 / 15; send({ t: 'pos', x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, yaw: Math.round(me.yaw * 100) / 100 }); }
  // everyone else, drawn a little in the past so movement is smooth
  const rt = performance.now() / 1000 - 0.12;
  const doorNear = [];
  for (const e of G.shoppers.values()) {
    const p = interp(e, rt); if (!p) continue;
    const g = e.fig.group, ox = g.position.x, oz = g.position.z;
    g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw;
    const v = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
    if (!e.paid) e.fig.hold({ basket: e.n });
    e.fig.update(dt, { speed: Math.min(4, v), work: e.st === 1 });
    if (e.fig.bubbleT > 0) { e.fig.bubbleT -= dt; if (e.fig.bubbleT <= 0) { e.fig.group.remove(e.fig.bubble); e.fig.bubble = null; } }
    if (p.z > -2.5 && p.z < 2.5) doorNear.push(p.x);
  }
  for (const e of G.workers.values()) {
    const p = interp(e, rt); if (!p) continue;
    const g = e.fig.group, ox = g.position.x, oz = g.position.z;
    g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw;
    const v = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
    if (e.role !== 'janitor') e.fig.hold(e.carry ? { box: e.carry } : null);
    e.fig.update(dt, { speed: Math.min(4, v), work: !!e.busy });
  }
  for (const e of G.owners.values()) {
    const p = interp(e, rt); if (!p) continue;
    const g = e.fig.group, ox = g.position.x, oz = g.position.z;
    g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw;
    const v = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
    e.fig.hold(e.carry ? { box: e.carry } : null);
    e.fig.update(dt, { speed: Math.min(6, v) });
    if (p.z > -2.5 && p.z < 2.5) doorNear.push(p.x);
  }
  if (me.z > -2.5 && me.z < 2.5) doorNear.push(me.x);
  for (const x of doorNear) for (let i = 0; i < 4; i++) if (Math.abs(x - (D.storeX(i) + 4)) < 2.6) world.stores[i].wantDoor = true;
  // camera
  cam.tx += (me.x - cam.tx) * (1 - Math.exp(-8 * dt)); cam.tz += (me.z - cam.tz) * (1 - Math.exp(-8 * dt));
  const cd = cam.dist, cp = cam.pitch;
  world.camera.position.set(cam.tx + Math.sin(cam.yaw) * Math.cos(cp) * cd, 0.8 + Math.sin(cp) * cd, cam.tz + Math.cos(cam.yaw) * Math.cos(cp) * cd);
  world.camera.lookAt(cam.tx, 0.9, cam.tz - 0.5);
  world.fadeWalls(world.camera.position, { x: me.x, z: me.z });
  for (let i = 0; i < 4; i++) if (insideStore(i, me.x, me.z) && world.camera.position.z > 0) world.stores[i].hideFront = true;
  setListener(me.x, 1.5, me.z, cam.yaw);
  const hour = D.hourAt(G.tt);
  world.setTime(hour, !!G.event?.rain);
  world.update(dt, { x: me.x, z: me.z });
  // music follows the day
  music.play(hour >= 18 ? 'evening' : 'store');
  music.setRush(s ? Math.min(1, (s.q || 0) / 6) : 0);
  if (!paused) drawHUD();
  if (openPanelId === 'order' || openPanelId === 'prices') { G.panelT = (G.panelT || 0) - dt; if (G.panelT <= 0) { G.panelT = 0.5; refreshPanels(); } }
  world.render();
}
buildTitleFig();
music.play('menu');
requestAnimationFrame(tick);
if (Q.has('auto') || Q.has('mactest')) setTimeout(() => macLog(`running: G=${!!G} stores=${G?.stores?.length} shoppers=${G?.shoppers?.size} day=${G?.day} tt=${G?.tt}`), 9000);
if (Q.has('auto')) { prof.name = prof.name || 'TESTER'; startSolo(null); }
// fast-forward the local simulation for tests: ?auto=1&ff=SECONDS
if (Q.has('ff')) setTimeout(() => { const core = conn?.core; if (!core) return; const r = [...core.rooms.values()][0]; for (let t = 0; t < +Q.get('ff'); t += 0.1) core.step(r, 0.1); }, 300);
if (Q.has('cam')) { const [x, z, yaw, dist, pitch] = Q.get('cam').split(',').map(Number); setTimeout(() => { Object.assign(me, { x, z }); cam.yaw = yaw || 0; if (dist) cam.dist = dist; if (pitch) cam.pitch = pitch; cam.tx = x; cam.tz = z; }, 500); }
