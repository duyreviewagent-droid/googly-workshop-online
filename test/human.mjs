// node test/human.mjs — drives a human-owned store through every action
import { Core } from '../public/js/core.js';
import * as D from '../public/js/data.js';
const core = new Core(); const got = [];
const h = core.connect(m => got.push(m));
h.recv({ t: 'me', name: 'VIN', color: '#9aa0a6' });
h.recv({ t: 'solo', diff: 1 });
const r = [...core.rooms.values()][0], s = r.stores[0], X = D.storeX(0);
const at = (x, z) => h.recv({ t: 'pos', x: X + x, z, yaw: 0 });
const errs = () => got.filter(m => m.t === 'err').map(m => m.msg).splice(0);
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
ok(s.ownerId === h.id && s.name === "VIN'S MARKET", 'owns store 0');
at(...D.STOCK_RACK); h.recv({ t: 'pick', p: 'banana' });
ok(s.carry && s.carry.p === 'banana' && s.carry.n === 24, 'picked bananas ' + JSON.stringify(s.carry) + errs());
s.secs[0][0].n = 10;
at(...D.SLOTS[0].stand[0]); h.recv({ t: 'place', slot: 0, sec: 0 });
ok(s.secs[0][0].n === 34 && !s.carry, 'stocked bananas ' + s.secs[0][0].n + errs());
at(...D.STOCK_RACK); h.recv({ t: 'pick', p: 'milk' }); at(...D.SLOTS[0].stand[1]); h.recv({ t: 'place', slot: 0, sec: 1 });
ok(errs().length === 1 && s.carry, 'milk refused on produce stand');
at(...D.STOCK_RACK); h.recv({ t: 'return' }); ok(!s.carry, 'returned box');
const c0 = s.cash; h.recv({ t: 'order', items: { cheese: 2 } }); ok(s.cash < c0 && r.trucks.length, 'ordered cheese');
h.recv({ t: 'fixture', slot: 7 }); ok(s.fixtures[7], 'built fridge');
for (let t = 0; t < 8; t += 0.1) core.step(r, 0.1);
ok(s.back.cheese === 48, 'truck delivered cheese ' + s.back.cheese);
at(...D.STOCK_RACK); h.recv({ t: 'pick', p: 'cheese' }); at(...D.SLOTS[7].stand[0]); h.recv({ t: 'place', slot: 7, sec: 0 });
ok(s.secs[7][0].p === 'cheese' && s.secs[7][0].n === 40 && s.carry.n === 8, 'stocked new fridge with cheese');
h.recv({ t: 'price', p: 'cheese', v: 6.49 }); ok(s.prices.cheese === 6.49, 'price set');
h.recv({ t: 'hire', role: 'cashier2', on: true }); ok(!s.staff.cashier2, 'cashier2 needs lane');
h.recv({ t: 'upgrade', id: 'till2' }); h.recv({ t: 'hire', role: 'cashier2', on: true }); ok(s.staff.cashier2 && s.perm.till2, 'lane 2 + cashier2');
h.recv({ t: 'hire', role: 'cashier2', on: false });
// run the till myself
at(...D.TILLS[0].cashier); h.recv({ t: 'hold', on: true });
let served0 = s.today.served;
for (let t = 0; t < 30; t += 0.1) { core.step(r, 0.1); at(...D.TILLS[0].cashier); }
ok(s.today.served > served0, 'served shoppers myself: ' + s.today.served);
h.recv({ t: 'save' }); const sv = got.find(m => m.t === 'save'); ok(sv && sv.data.day === 1, 'save works');
// load it
const core2 = new Core(); const h2 = core2.connect(() => { }); h2.recv({ t: 'me', name: 'VIN' }); h2.recv({ t: 'solo', diff: 1, save: JSON.parse(JSON.stringify(sv.data)) });
const r2 = [...core2.rooms.values()][0]; ok(r2.stores[0].ownerId === h2.id && r2.stores[0].fixtures[7] && r2.stores[0].perm.till2, 'loaded save');
for (let t = 0; t < 100; t += 0.1) core2.step(r2, 0.1);
ok(r2.day === 3, 'days advance after load: ' + r2.day);
