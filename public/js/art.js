// Product artwork, all painted on canvases: little icons for the menus, labels for boxes and packets,
// and the 3D shapes that sit on the shelves.
import * as THREE from 'three';
import { PROD } from './data.js';

/** Draw a product icon centred at (x, y), about `s` pixels tall. */
export function drawIcon(g, pid, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const O = (w = 5) => { g.lineWidth = w; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke(); };
  const F = c => { g.fillStyle = c; g.fill(); };
  const P = pts => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  const rect = (x0, y0, w, h, r = 6) => { g.beginPath(); g.roundRect(x0, y0, w, h, r); };
  const label = (t, yy, c = '#fff', sz = 15) => { g.fillStyle = c; g.font = `900 ${sz}px Futura, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, yy); };
  switch (pid) {
    case 'banana':
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-38, -20 + i * 6); g.quadraticCurveTo(-10 + i * 4, 50 - i * 6, 40, -8 + i * 8); g.quadraticCurveTo(0, 26 - i * 6, -30, -26 + i * 6); g.closePath(); F(['#f7c62a', '#ffd84a', '#ffe36e'][i]); O(4); }
      g.beginPath(); g.moveTo(-38, -22); g.lineTo(-44, -34); g.lineWidth = 8; g.strokeStyle = '#6b4a1a'; g.stroke(); break;
    case 'apple': case 'tomato':
      g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(30, -44, 52, -6, 36, 22); g.bezierCurveTo(26, 44, 8, 42, 0, 36); g.bezierCurveTo(-8, 42, -26, 44, -36, 22); g.bezierCurveTo(-52, -6, -30, -44, 0, -24); F(pid === 'apple' ? '#e0302a' : '#ff4a2a'); O();
      g.beginPath(); g.ellipse(-16, -8, 8, 14, -0.5, 0, 7); F('rgba(255,255,255,.45)');
      if (pid === 'apple') { g.beginPath(); g.moveTo(0, -24); g.lineTo(4, -42); g.lineWidth = 6; g.strokeStyle = '#6b4a1a'; g.stroke(); g.beginPath(); g.ellipse(16, -38, 14, 7, -0.4, 0, 7); F('#3fae3a'); O(3); }
      else { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.moveTo(0, -26); g.lineTo(Math.cos(a) * 18, -26 + Math.sin(a) * 8); } g.lineWidth = 6; g.strokeStyle = '#2f8f2a'; g.stroke(); }
      break;
    case 'carrot':
      P([-12, -22, 12, -22, 2, 46, -2, 46]); F('#ff8a1c'); O();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-10, -6 + i * 12); g.lineTo(-2, -4 + i * 12); g.lineWidth = 3; g.strokeStyle = '#c85a0a'; g.stroke(); }
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * 10, -36, 6, 16, i * 0.4, 0, 7); F('#3fae3a'); O(3); }
      break;
    case 'milk':
      P([-24, -18, 0, -40, 24, -18, 24, 44, -24, 44]); F('#f4f7ff'); O();
      rect(-24, 2, 48, 26, 0); F('#2f7bff'); label('MILK', 15, '#fff', 14);
      P([-24, -18, 0, -40, 24, -18]); F('#dfe6f5'); O(3); break;
    case 'eggs':
      rect(-44, -4, 88, 40, 8); F('#d9c3a0'); O();
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-28 + i * 28, -8, 12, 16, 0, 0, 7); F('#fff3dd'); O(3); }
      label('EGGS', 20, '#6b4a1a', 14); break;
    case 'cheese':
      P([-44, 26, 40, 26, 40, -6, -44, 10]); F('#ffc21a'); O();
      P([-44, 10, 40, -6, 22, -26]); F('#ffd966'); O();
      for (const [cx, cy, r] of [[-10, 14, 6], [18, 8, 5], [4, 20, 4]]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); F('#e0a000'); }
      break;
    case 'chicken':
      g.beginPath(); g.ellipse(-4, 4, 30, 24, -0.5, 0, 7); F('#e8a87a'); O();
      rect(14, -34, 12, 30, 6); g.save(); g.rotate(0.6); g.restore();
      g.beginPath(); g.moveTo(16, -12); g.lineTo(34, -34); g.lineWidth = 10; g.strokeStyle = '#f7ead9'; g.stroke();
      g.beginPath(); g.arc(36, -38, 7, 0, 7); g.arc(28, -42, 7, 0, 7); F('#f7ead9');
      g.beginPath(); g.ellipse(-12, 0, 10, 6, -0.5, 0, 7); F('rgba(255,255,255,.35)'); break;
    case 'icecream':
      P([-30, -10, 30, -10, 24, 40, -24, 40]); F('#ff9ed2'); O();
      g.beginPath(); g.ellipse(0, -12, 32, 10, 0, 0, 7); F('#fff'); O(3);
      g.beginPath(); g.arc(-10, -20, 12, 0, 7); F('#ffe0f0'); g.beginPath(); g.arc(10, -22, 12, 0, 7); F('#7a4a22');
      label('ICE', 16, '#fff', 14); break;
    case 'pizza':
      rect(-44, -30, 88, 64, 6); F('#d83a2a'); O();
      g.beginPath(); g.arc(0, 2, 24, 0, 7); F('#ffcf5a'); O(3);
      for (const [cx, cy] of [[-10, -6], [10, 4], [-4, 12], [8, -12]]) { g.beginPath(); g.arc(cx, cy, 5, 0, 7); F('#b3241a'); }
      break;
    case 'bread':
      g.beginPath(); g.moveTo(-44, 24); g.bezierCurveTo(-48, -30, 48, -30, 44, 24); g.closePath(); F('#d08a3a'); O();
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 20 - 6, -8); g.lineTo(i * 20 + 6, 4); g.lineWidth = 5; g.strokeStyle = '#8a5418'; g.stroke(); }
      rect(-44, 18, 88, 10, 3); F('#b87028'); break;
    case 'cereal':
      rect(-28, -42, 56, 86, 4); F('#2f7bff'); O();
      g.beginPath(); g.arc(0, 8, 18, 0, Math.PI); F('#fff'); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-10 + (i % 3) * 10, 6 - Math.floor(i / 3) * 6, 5, 0, 7); F(['#ffd23a', '#ff8a1c'][i % 2]); }
      label('O\'S', -22, '#ffd23a', 18); break;
    case 'chips':
      P([-30, -40, 30, -40, 34, 40, -34, 40]); F('#ffcc00'); O();
      g.beginPath(); g.ellipse(0, 4, 18, 12, 0.3, 0, 7); F('#e8a020'); O(3);
      rect(-30, -40, 60, 10, 0); F('#e0162b'); label('CHIPS', -18, '#e0162b', 14); break;
    case 'soda':
      rect(-20, -40, 40, 82, 10); F('#e0162b'); O();
      g.beginPath(); g.moveTo(-20, 0); g.bezierCurveTo(-5, -12, 5, 12, 20, 0); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
      rect(-14, -44, 28, 6, 3); F('#c8ccd4'); break;
    case 'cookies':
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-22 + i * 22, 6 - (i % 2) * 14, 20, 0, 7); F('#c98a3e'); O(3); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-22 + i * 22 + Math.cos(k * 2) * 9, 6 - (i % 2) * 14 + Math.sin(k * 2.3) * 9, 3.5, 0, 7); F('#4a2a14'); } }
      break;
    case 'coffee':
      P([-28, -34, 28, -34, 32, 42, -32, 42]); F('#4a2a14'); O();
      P([-28, -34, 28, -34, 22, -44, -22, -44]); F('#6b4424'); O(3);
      g.beginPath(); g.ellipse(0, 8, 12, 17, 0, 0, 7); F('#c98a3e'); g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(-6, 4, 6, 12, 0, 24); g.lineWidth = 3; g.strokeStyle = '#4a2a14'; g.stroke(); break;
    case 'pasta':
      rect(-38, -26, 76, 56, 4); F('#1450c8'); O();
      rect(-24, -16, 48, 30, 12); F('#fff'); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-18 + i * 12, -10); g.lineTo(-14 + i * 12, 8); g.lineWidth = 5; g.strokeStyle = '#ffd35a'; g.stroke(); }
      break;
    case 'tp':
      for (let i = 0; i < 2; i++) { rect(-38 + i * 38, -30, 36, 64, 8); F('#f4f7ff'); O(); g.beginPath(); g.ellipse(-20 + i * 38, -30, 18, 7, 0, 0, 7); F('#fff'); O(3); g.beginPath(); g.ellipse(-20 + i * 38, -30, 6, 2.5, 0, 0, 7); F('#c8b89a'); }
      break;
    default: g.beginPath(); g.arc(0, 0, 36, 0, 7); F(PROD[pid]?.color || '#999'); O();
  }
  g.restore();
}
const iconCache = new Map();
/** A data-URL icon for HTML menus. */
export function iconURL(pid, size = 64) {
  const k = pid + size; if (iconCache.has(k)) return iconCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawIcon(c.getContext('2d'), pid, size / 2, size / 2, size * 0.9);
  const u = c.toDataURL(); iconCache.set(k, u); return u;
}
const texCache = new Map();
/** 'box' = a brown wholesale box with a printed label; 'pack' = the packet on the shelf. */
export function productTexture(pid, kind = 'pack') {
  const key = pid + kind; if (texCache.has(key)) return texCache.get(key);
  const p = PROD[pid], c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  if (kind === 'box') {
    g.fillStyle = '#c79a5b'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,60,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1); }
    g.fillStyle = '#f5ecd8'; g.beginPath(); g.roundRect(28, 30, 200, 196, 14); g.fill();
    g.strokeStyle = p.color; g.lineWidth = 8; g.stroke();
    drawIcon(g, pid, 128, 108, 120);
    g.fillStyle = '#2a1a0a'; g.font = '900 30px Futura, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText(p.name.toUpperCase(), 128, 206);
    g.fillStyle = 'rgba(40,20,5,.5)'; g.fillRect(0, 118, 256, 6);
  } else {
    g.fillStyle = p.color; g.fillRect(0, 0, 256, 256);
    const lt = g.createLinearGradient(0, 0, 256, 256); lt.addColorStop(0, 'rgba(255,255,255,.25)'); lt.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = lt; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(24, 40, 208, 170, 20); g.fill();
    drawIcon(g, pid, 128, 110, 120);
    g.fillStyle = '#222'; g.font = '900 26px Futura, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText(p.name.toUpperCase(), 128, 196);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}

// 3D shapes for one unit of each product on a shelf: [geometry, material, footprint w, d, height]
const unitCache = new Map();
const std = (o) => new THREE.MeshStandardMaterial(o);
export function productUnit(pid) {
  if (unitCache.has(pid)) return unitCache.get(pid);
  const p = PROD[pid];
  const packMat = () => { const t = productTexture(pid, 'pack'); const side = std({ color: p.color, roughness: 0.5 }); return [side, side, side, side, std({ map: t, roughness: 0.45 }), std({ map: t, roughness: 0.45 })]; };
  let u;
  switch (pid) {
    case 'banana': { const g = new THREE.CapsuleGeometry(0.035, 0.16, 3, 8); g.rotateZ(Math.PI / 2); g.translate(0, 0.04, 0); u = [g, std({ color: '#f7c62a', roughness: 0.55 }), 0.24, 0.1, 0.08]; break; }
    case 'apple': u = [new THREE.SphereGeometry(0.045, 12, 8).translate(0, 0.045, 0), new THREE.MeshPhysicalMaterial({ color: '#d42a22', roughness: 0.3, clearcoat: 0.6 }), 0.1, 0.1, 0.09]; break;
    case 'tomato': u = [new THREE.SphereGeometry(0.042, 12, 8).scale(1, 0.85, 1).translate(0, 0.036, 0), new THREE.MeshPhysicalMaterial({ color: '#ff3b1a', roughness: 0.25, clearcoat: 0.8 }), 0.09, 0.09, 0.075]; break;
    case 'carrot': { const g = new THREE.ConeGeometry(0.025, 0.2, 8); g.rotateZ(Math.PI / 2); g.translate(0, 0.025, 0); u = [g, std({ color: '#ff8a1c', roughness: 0.6 }), 0.22, 0.06, 0.05]; break; }
    case 'milk': u = [new THREE.BoxGeometry(0.1, 0.22, 0.1).translate(0, 0.11, 0), packMat(), 0.12, 0.12, 0.22]; break;
    case 'eggs': u = [new THREE.BoxGeometry(0.26, 0.07, 0.11).translate(0, 0.035, 0), packMat(), 0.28, 0.13, 0.07]; break;
    case 'cheese': u = [new THREE.CylinderGeometry(0.08, 0.08, 0.07, 3).translate(0, 0.035, 0), std({ color: '#ffc21a', roughness: 0.5 }), 0.17, 0.15, 0.07]; break;
    case 'chicken': u = [new THREE.BoxGeometry(0.24, 0.06, 0.16).translate(0, 0.03, 0), packMat(), 0.26, 0.18, 0.06]; break;
    case 'icecream': u = [new THREE.CylinderGeometry(0.07, 0.06, 0.12, 14).translate(0, 0.06, 0), std({ color: '#ff9ed2', roughness: 0.4 }), 0.15, 0.15, 0.12]; break;
    case 'pizza': u = [new THREE.BoxGeometry(0.28, 0.04, 0.28).translate(0, 0.02, 0), packMat(), 0.3, 0.3, 0.04]; break;
    case 'bread': { const g = new THREE.CapsuleGeometry(0.06, 0.16, 4, 10); g.rotateZ(Math.PI / 2); g.scale(1, 0.85, 1); g.translate(0, 0.05, 0); u = [g, std({ color: '#d08a3a', roughness: 0.75 }), 0.3, 0.13, 0.1]; break; }
    case 'cereal': u = [new THREE.BoxGeometry(0.2, 0.28, 0.07).translate(0, 0.14, 0), packMat(), 0.22, 0.09, 0.28]; break;
    case 'chips': u = [new THREE.BoxGeometry(0.17, 0.24, 0.06).translate(0, 0.12, 0), packMat(), 0.19, 0.08, 0.24]; break;
    case 'soda': u = [new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12).translate(0, 0.06, 0), new THREE.MeshPhysicalMaterial({ color: '#e0162b', roughness: 0.25, metalness: 0.4, clearcoat: 1 }), 0.08, 0.08, 0.12]; break;
    case 'cookies': { const g = new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12); g.rotateZ(Math.PI / 2); g.translate(0, 0.045, 0); u = [g, std({ color: '#7a4a22', roughness: 0.6 }), 0.22, 0.1, 0.09]; break; }
    case 'coffee': u = [new THREE.BoxGeometry(0.12, 0.2, 0.08).translate(0, 0.1, 0), packMat(), 0.14, 0.1, 0.2]; break;
    case 'pasta': u = [new THREE.BoxGeometry(0.16, 0.2, 0.06).translate(0, 0.1, 0), packMat(), 0.18, 0.08, 0.2]; break;
    case 'tp': u = [new THREE.CylinderGeometry(0.055, 0.055, 0.11, 14).translate(0, 0.055, 0), std({ color: '#f4f7ff', roughness: 0.95 }), 0.12, 0.12, 0.11]; break;
    default: u = [new THREE.BoxGeometry(0.1, 0.1, 0.1).translate(0, 0.05, 0), std({ color: p.color }), 0.12, 0.12, 0.1];
  }
  unitCache.set(pid, u); return u;
}
