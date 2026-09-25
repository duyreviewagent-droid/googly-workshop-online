// Googly Workshop — online lobbies. Serves the game page and runs every shared street on the server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Core } from './public/js/core.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT || 8000);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  const file = path.join(ROOT, path.normalize(url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

const core = new Core();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
wss.on('connection', ws => {
  const h = core.connect(m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); });
  ws.on('message', raw => { let m; try { m = JSON.parse(raw); } catch { return; } if (m && typeof m.t === 'string' && m.t !== 'solo') h.recv(m); });
  ws.on('close', () => h.close());
});
let last = performance.now();
setInterval(() => { const t = performance.now(), dt = Math.min(0.2, (t - last) / 1000); last = t; core.tick(dt); }, 50);
server.listen(PORT, () => console.log(`Googly Workshop on http://localhost:${PORT}`));
