// node test/online.mjs [ws://localhost:8321/ws] — two players make a lobby, start, and both run a store
import WebSocket from 'ws';
const URL = process.argv[2] || 'ws://localhost:8321/ws';
function client(name) {
  const ws = new WebSocket(URL), c = { ws, name, msgs: [], id: 0, send: m => ws.send(JSON.stringify(m)) };
  ws.on('message', d => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'hello') c.id = m.id; });
  return new Promise(r => ws.on('open', () => { c.send({ t: 'me', name }); r(c); }));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const a = await client('ANNA'), b = await client('BOB');
a.send({ t: 'create', public: true }); await wait(300);
const code = a.msgs.find(m => m.t === 'joined')?.code; ok(!!code, 'lobby ' + code);
b.send({ t: 'list' }); await wait(200); ok(b.msgs.find(m => m.t === 'list')?.rooms.some(r => r.code === code), 'lobby is listed');
b.send({ t: 'join', code }); await wait(300);
const room = a.msgs.filter(m => m.t === 'room').pop().room; ok(room.seats.filter(s => s.human).length === 2, 'two humans, two computers');
b.send({ t: 'start' }); await wait(200); ok(!a.msgs.some(m => m.t === 'start'), 'only host can start');
a.send({ t: 'start' }); await wait(500);
const st = a.msgs.find(m => m.t === 'start'); ok(st && st.stores[0].ownerId === a.id && st.stores[1].ownerId === b.id, 'both own stores');
b.send({ t: 'order', items: { milk: 1 } }); await wait(300); ok(b.msgs.some(m => m.t === 'ordered'), 'bob ordered');
a.send({ t: 'pos', x: -33, z: -3, yaw: 0 }); await wait(400);
ok(b.msgs.filter(m => m.t === 'snap').pop()?.o.some(o => o[0] === 0), 'bob sees anna walking');
a.send({ t: 'chat', text: 'hi bob' }); await wait(200); ok(b.msgs.some(m => m.t === 'chat' && m.text === 'hi bob'), 'chat');
b.ws.close(); await wait(400);
ok(a.msgs.some(m => m.t === 'owner' && m.i === 1 && m.ownerId === 0), 'computer takes over bob\'s store');
const c2 = await client('CARL'); c2.send({ t: 'join', code }); await wait(500);
ok(c2.msgs.find(m => m.t === 'start')?.stores.some(s => s.ownerId === c2.id), 'late joiner takes over a store');
a.ws.close(); c2.ws.close();
