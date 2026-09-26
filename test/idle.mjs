// node test/idle.mjs — a player who never touches stock: are the shelves still full?
import { Core } from '../public/js/core.js';
import * as D from '../public/js/data.js';
const core = new Core(); const reps = [];
const h = core.connect(m => { if (m.t === 'dayend') reps.push(m.reports[0]); });
h.recv({ t: 'me', name: 'IDLE' }); h.recv({ t: 'solo', diff: 1 });
const r = [...core.rooms.values()][0], s = r.stores[0];
h.recv({ t: 'hire', role: 'cashier', on: true });
let low = 0, samples = 0;
for (let t = 0; t < 60 * 8; t += 0.1) {
  core.step(r, 0.1);
  if (Math.round(t * 10) % 20 === 0) for (const [k, sl] of D.SLOTS.entries()) if (s.fixtures[k]) for (const sec of s.secs[k]) if (sec.p) { samples++; if (sec.n === 0) low++; }
}
for (const x of reps) console.log(`day ${x.served} served, oos ${x.oos}, profit ${Math.round(x.profit)}, cash ${x.cash}`);
console.log(`empty sections ${(low / samples * 100).toFixed(1)}% of the time`);
