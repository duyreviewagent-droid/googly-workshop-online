// node test/sim.mjs [diff] [runs] — plays whole months with computers in every store, for tuning
import { simulateMonth } from '../public/js/core.js';
const diff = +(process.argv[2] ?? 1), runs = +(process.argv[3] ?? 1);
for (let i = 0; i < runs; i++) { const t = Date.now(); simulateMonth({ diff }); console.log(`(${((Date.now() - t) / 1000).toFixed(1)}s)\n`); }
