// The street: four grocery stores side by side, the road, the alley out back and all the fixtures inside.
// Textures are painted on canvases at load, nothing to download.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as D from './data.js';
import { productUnit, productTexture } from './art.js';
import { textSprite, rr } from './googly.js';

const { SLOTS, FIXTURES, STORE_W, STORE_D } = D;
const std = o => new THREE.MeshStandardMaterial(o);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const texCache = new Map();
function tex(key, w, h, draw, rep = [1, 1]) {
  let base = texCache.get(key);
  if (!base) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    base = new THREE.CanvasTexture(c); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    texCache.set(key, base);
  }
  const t = base.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true;
  return t;
}
const speck = (g, w, h, n, cols, size = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, size, size); } };
const T = {
  tile: rep => tex('tile', 256, 256, (g, w) => {
    const s = w / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#e9e4d8' : '#f6f3ec'; g.fillRect(x * s, y * s, s, s); }
    speck(g, w, w, 1500, ['rgba(0,0,0,.04)', 'rgba(255,255,255,.2)'], 2);
    g.strokeStyle = 'rgba(120,110,95,.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }, rep),
  concrete: rep => tex('concrete', 256, 256, (g, w) => { g.fillStyle = '#9a9890'; g.fillRect(0, 0, w, w); speck(g, w, w, 9000, ['#8e8c84', '#a6a49c', '#83817a'], 2); g.strokeStyle = 'rgba(50,50,50,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, w); }, rep),
  asphalt: rep => tex('asphalt', 512, 512, (g, w) => { g.fillStyle = '#3a3b3e'; g.fillRect(0, 0, w, w); speck(g, w, w, 30000, ['#333437', '#46474b', '#2c2d30', '#55565a'], 2); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(20,20,22,.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * w, 20 + Math.random() * 60, 8 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); } }, rep),
  pavement: rep => tex('pavement', 256, 256, (g, w) => { g.fillStyle = '#b9b5ab'; g.fillRect(0, 0, w, w); speck(g, w, w, 6000, ['#aba79d', '#c6c2b8', '#a09c92'], 2); g.strokeStyle = 'rgba(70,65,55,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, w); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, w); g.stroke(); }, rep),
  brick: (rep, col = '#a0523a') => tex('brick' + col, 256, 256, (g, w) => {
    g.fillStyle = '#cfc5b4'; g.fillRect(0, 0, w, w);
    const c = new THREE.Color(col);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const k = 0.8 + Math.random() * 0.35; g.fillStyle = `rgb(${c.r * 255 * k | 0},${c.g * 255 * k | 0},${c.b * 255 * k | 0})`; g.fillRect(x * 32 + (y % 2) * 16 + 1.5, y * 16 + 1.5, 29, 13); }
    speck(g, w, w, 1500, ['rgba(0,0,0,.08)'], 2);
  }, rep),
  paint: (rep, col) => tex('paint' + col, 128, 128, (g, w) => { g.fillStyle = col; g.fillRect(0, 0, w, w); speck(g, w, w, 600, ['rgba(0,0,0,.03)', 'rgba(255,255,255,.05)'], 3); }, rep),
  grass: rep => tex('grass', 256, 256, (g, w) => { g.fillStyle = '#4f8a3a'; g.fillRect(0, 0, w, w); for (let i = 0; i < 9000; i++) { g.strokeStyle = ['#5d9a44', '#467d33', '#6aa84f', '#3d6e2c'][i % 4]; g.beginPath(); const x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 4); g.stroke(); } }, rep),
  awning: col => tex('awning' + col, 256, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#f6f3ec' : col; g.fillRect(x, 0, 32, h); } const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
  wood: rep => tex('wood', 256, 128, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = `rgb(${150 + Math.random() * 30},${105 + Math.random() * 20},${60 + Math.random() * 15})`; g.fillRect(0, y, w, 15); for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(80,50,20,.25)'; g.fillRect(Math.random() * w, y + Math.random() * 15, 20 + Math.random() * 50, 1); } } }, rep),
};

// ------------------------------------------------------------------ fixture geometry
function unitSpots(kind, j) {
  // where each product unit sits on section j of a fixture (fixture-local, plus a yaw)
  const out = [];
  if (kind === 'shelf') {
    const side = j === 0 ? -1 : 1;
    for (const y of [0.12, 0.52, 0.92, 1.32]) for (const x of [0.36, 0.17]) out.push({ x: side * x, y, z0: -1.85, z1: 1.85, yaw: side * Math.PI / 2, along: 'z' });
  } else if (kind === 'fridge' || kind === 'freezer') {
    const x0 = j === 0 ? -1.42 : 0.06, x1 = j === 0 ? -0.06 : 1.42;
    if (kind === 'fridge') for (const y of [0.18, 0.62, 1.06, 1.5]) for (const z of [0.18, -0.06, -0.3]) out.push({ y, z, x0, x1, yaw: 0, along: 'x' });
    else for (const y of [0.32, 0.46]) for (const z of [0.26, 0.04, -0.18]) out.push({ y, z, x0, x1, yaw: 0, along: 'x' });
  } else if (kind === 'produce') {
    const x0 = j === 0 ? -1.2 : 0.1, x1 = j === 0 ? -0.1 : 1.2;
    for (let r = 0; r < 5; r++) for (let layer = 0; layer < 2; layer++) { const z = 0.5 - r * 0.24, y = 0.72 + (0.5 - z) * 0.3 + layer * 0.05; out.push({ y, z: z - layer * 0.08, x0: x0 + layer * 0.05, x1: x1 - layer * 0.05, yaw: 0, along: 'x', tilt: -0.3, jitter: true }); }
  }
  return out;
}
function expandSpots(kind, j, pid) {
  const [, , fw] = productUnit(pid), spots = [], R = rng(pid.length * 97 + j * 13 + kind.length);
  for (const row of unitSpots(kind, j)) {
    const a0 = row.along === 'z' ? row.z0 : row.x0, a1 = row.along === 'z' ? row.z1 : row.x1, n = Math.max(1, Math.floor((a1 - a0) / (fw + 0.015)));
    for (let k = 0; k < n; k++) {
      const a = a0 + (k + 0.5) * (a1 - a0) / n, jx = row.jitter ? (R() - 0.5) * 0.05 : 0;
      spots.push(row.along === 'z' ? { x: row.x, y: row.y, z: a, yaw: row.yaw } : { x: a + jx, y: row.y, z: row.z + jx, yaw: row.yaw + (row.jitter ? (R() - 0.5) * 0.8 : 0), tilt: row.tilt || 0 });
    }
  }
  return spots;
}

function buildFixture(kind, acc) {
  const g = new THREE.Group(), f = FIXTURES[kind];
  const metal = std({ color: 0xd7dade, roughness: 0.4, metalness: 0.6 }), dark = std({ color: 0x2a2d33, roughness: 0.5, metalness: 0.4 });
  const box = (w, h, d, m, x, y, z, cast = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
  if (kind === 'shelf') {
    box(0.08, f.h, f.d, metal, 0, f.h / 2, 0);                                   // back panel
    box(f.w, 0.1, f.d, dark, 0, 0.05, 0);                                        // kick plate
    for (const y of [0.1, 0.5, 0.9, 1.3]) { box(f.w, 0.025, f.d, metal, 0, y, 0, false); for (const s of [-1, 1]) box(0.02, 0.05, f.d, acc, s * f.w / 2, y + 0.02, 0, false); }
    box(f.w + 0.04, 0.12, f.d + 0.04, acc, 0, f.h, 0);                           // top header in the store colour
    for (const z of [-f.d / 2, f.d / 2]) box(f.w, f.h, 0.04, metal, 0, f.h / 2, z);
  } else if (kind === 'produce') {
    const wood = std({ map: T.wood([2, 1]), roughness: 0.8 });
    box(f.w, 0.62, f.d, wood, 0, 0.31, 0);
    const bed = box(f.w - 0.1, 0.06, f.d - 0.1, std({ color: 0x3f6f2a, roughness: 0.9 }), 0, 0.8, 0.0); bed.rotation.x = 0.3;
    for (const s of [-1, 1]) { const side = box(0.06, 0.5, f.d, wood, s * (f.w / 2 - 0.03), 0.8, 0); side.rotation.x = 0; }
    box(0.04, 0.35, f.d, wood, 0, 0.82, 0);
    box(f.w, 0.22, 0.05, wood, 0, 0.72, f.d / 2);
    box(f.w, 0.5, 0.05, wood, 0, 1.05, -f.d / 2);
  } else if (kind === 'fridge') {
    box(f.w, f.h, 0.08, metal, 0, f.h / 2, -f.d / 2 + 0.04);
    for (const s of [-1, 0, 1]) box(0.06, f.h, f.d, dark, s * (f.w / 2 - 0.03), f.h / 2, 0);
    box(f.w, 0.14, f.d, dark, 0, 0.07, 0); box(f.w, 0.22, f.d, acc, 0, f.h - 0.11, 0);
    for (const y of [0.16, 0.6, 1.04, 1.48]) box(f.w - 0.1, 0.02, f.d - 0.12, std({ color: 0xeef2f5, roughness: 0.3, metalness: 0.3 }), 0, y, -0.03, false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.12, f.h - 0.4), std({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 0.55, roughness: 1 })); glow.position.set(0, f.h / 2, -f.d / 2 + 0.085); g.add(glow);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(f.w - 0.1, f.h - 0.38, 0.02), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.16, metalness: 0.1, depthWrite: false }));
    glass.position.set(0, f.h / 2 + 0.02, f.d / 2 - 0.02); g.add(glass);
    for (const s of [-0.75, 0.75]) box(0.03, 0.5, 0.04, metal, s * 0.1 + (s > 0 ? 0.08 : -0.08), f.h / 2, f.d / 2 + 0.02, false);
  } else if (kind === 'freezer') {
    const white = std({ color: 0xf2f4f6, roughness: 0.35 });
    box(f.w, 0.24, f.d, white, 0, 0.12, 0);
    for (const s of [-1, 1]) { box(f.w, 0.62, 0.05, white, 0, 0.55, s * (f.d / 2 - 0.025)); box(0.05, 0.62, f.d, white, s * (f.w / 2 - 0.025), 0.55, 0); }
    box(f.w, 0.08, 0.06, acc, 0, 0.84, f.d / 2 - 0.02);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.1, f.d - 0.1), std({ color: 0xbfe6ff, emissive: 0x9fd8ff, emissiveIntensity: 0.35, roughness: 0.6 })); inside.rotation.x = -Math.PI / 2; inside.position.y = 0.26; g.add(inside);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(f.w - 0.08, 0.02, f.d - 0.08), new THREE.MeshPhysicalMaterial({ color: 0xd7efff, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false }));
    glass.position.y = 0.87; g.add(glass);
    const frost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, f.d - 0.08), std({ color: 0x888c94, metalness: 0.7, roughness: 0.3 })); frost.position.y = 0.88; g.add(frost);
  }
  return g;
}
function buildTill(acc) {
  const g = new THREE.Group();
  const counter = std({ color: 0xf2efe8, roughness: 0.5 }), dark = std({ color: 0x24262b, roughness: 0.6 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new RoundedBoxGeometry(1.0, 0.9, 2.4, 3, 0.04), counter, 0, 0.45, 0);
  add(new THREE.BoxGeometry(0.96, 0.08, 2.4), acc, 0, 0.12, 0);
  const belt = add(new THREE.BoxGeometry(0.62, 0.03, 1.6), dark, 0.05, 0.915, 0.35);
  g.userData.belt = belt;
  add(new THREE.BoxGeometry(0.34, 0.02, 0.34), new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.2, emissive: 0xff2020, emissiveIntensity: 0.25 }), 0.05, 0.92, -0.6);
  const reg = new THREE.Group(); reg.position.set(-0.28, 0.9, -0.75); g.add(reg);
  const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; reg.add(o); return o; };
  b(0.36, 0.1, 0.38, dark, 0, 0.05, 0);
  const scr = b(0.3, 0.2, 0.03, dark, 0, 0.26, 0.05); scr.rotation.y = -Math.PI / 2; scr.rotation.x = 0.2;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), std({ color: 0x40ff90, emissive: 0x30ff80, emissiveIntensity: 0.9 })); glow.position.set(-0.02, 0.26, 0.05); glow.rotation.y = -Math.PI / 2; reg.add(glow);
  b(0.04, 0.16, 0.04, dark, 0.02, 0.16, 0.05);
  // bag carousel and a little lane-number light
  const pole = add(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8), dark, 0.42, 1.4, -1.1);
  const lamp = add(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18), acc, 0.42, 2.12, -1.1); lamp.rotation.z = Math.PI / 2;
  g.userData.lamp = lamp;
  return g;
}

// ------------------------------------------------------------------ the world
export class World {
  constructor(canvas, { lowq = false, mobile = false } = {}) {
    this.lowq = lowq; this.mobile = mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowq, powerPreference: 'high-performance' });
    // phones: cap the pixel ratio and use a cheaper, smaller shadow map
    this.renderer.setPixelRatio(Math.min(lowq ? 1 : mobile ? 1.5 : 2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = !lowq; this.renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.45;
    this.sky = new THREE.Color('#9fd3ff'); this.scene.background = this.sky.clone(); this.scene.fog = new THREE.Fog(this.sky.clone(), 70, 190);
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x6b5a45, 1.0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.4); this.sun.castShadow = !lowq;
    this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.colliders = [];
    this.stores = [];
    this.floaters = []; this.trucks = []; this.spills = new Map();
    this.ents = new THREE.Group(); this.scene.add(this.ents);
    this.buildStreet();
    for (let i = 0; i < 4; i++) this.stores.push(this.buildStore(i));
    this.buildRain();
    this.resize();
    addEventListener('resize', () => this.resize());
    if (mobile) { addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250)); window.visualViewport?.addEventListener('resize', () => this.resize()); }
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // a tall phone screen sees very little sideways at the desktop angle, so widen the view in portrait
    if (this.mobile) this.camera.fov = w < h ? 66 : 46;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- street
  buildStreet() {
    const S = this.scene, R = rng(7);
    const plane = (w, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; S.add(o); return o; };
    const box = (w, h, d, m, x, y, z, cast = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; S.add(o); return o; };
    const L = 240;
    plane(L, 400, std({ map: T.grass([60, 100]), roughness: 1 }), 0, -0.02, 0);
    this.road = plane(L, 5, std({ map: T.asphalt([40, 1]), roughness: 0.85 }), 0, 0.005, 7.6);
    // lane markings + crosswalks
    const white = std({ color: 0xf2f2ea, roughness: 0.7 }), yellow = std({ color: 0xf2c232, roughness: 0.7 });
    for (let x = -L / 2; x < L / 2; x += 4) plane(2, 0.14, yellow, x, 0.012, 7.6);
    for (const cx of [-D.STORE_GAP, 0, D.STORE_GAP]) for (let k = -6; k <= 6; k++) plane(0.42, 4.4, white, cx + k * 0.8, 0.013, 7.6);
    // pavements with curbs
    plane(L, 5, std({ map: T.pavement([L / 2.5, 2]), roughness: 0.9 }), 0, 0.12, 2.6);
    box(L, 0.14, 0.2, std({ color: 0x9a968c, roughness: 0.8 }), 0, 0.06, 5.05, false);
    plane(L, 4, std({ map: T.pavement([L / 2.5, 1.6]), roughness: 0.9 }), 0, 0.12, 12.1);
    box(L, 0.14, 0.2, std({ color: 0x9a968c, roughness: 0.8 }), 0, 0.06, 10.1, false);
    const fill = box(L, 0.12, 5, std({ color: 0x8e8a80 }), 0, 0.06, 2.6, false); fill.visible = false;
    // back alley
    plane(L, 9, std({ map: T.asphalt([40, 2]), roughness: 0.9 }), 0, 0.006, -24.8);
    for (let x = -L / 2; x < L / 2; x += 8) plane(0.12, 1.2, white, x, 0.012, -24.8);
    // houses and shops across the road
    const facade = ['#e8c9a0', '#b9d4e8', '#f2b5a0', '#c9e0b0', '#f0e0a8', '#d8c0e8', '#f4f0e6'];
    for (let x = -100; x < 100; x += 9.5) {
      const w = 8.6, h = 5 + R() * 5, col = facade[Math.floor(R() * facade.length)];
      const b = box(w, h, 7, std({ map: T.paint([2, 1], col), roughness: 0.85 }), x, h / 2, 18.2);
      const roof = box(w + 0.4, 0.4, 7.4, std({ color: 0x6b4a3a, roughness: 0.8 }), x, h + 0.2, 18.2);
      for (let wy = 1.6; wy < h - 1; wy += 2.4) for (let wx = -2.6; wx <= 2.6; wx += 2.6) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), std({ color: 0x2a3a4a, roughness: 0.15, metalness: 0.5, emissive: 0xffc070, emissiveIntensity: 0 })); win.position.set(x + wx, wy, 14.69); win.rotation.y = Math.PI; S.add(win); (this.houseWindows ||= []).push(win); }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), std({ color: ['#6b3a2a', '#2a4a6b', '#3a6b3a'][Math.floor(R() * 3)] })); door.position.set(x + (R() - 0.5) * 3, 1.05, 14.68); door.rotation.y = Math.PI; S.add(door);
      this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: 14.7, z1: 21.7 });
    }
    // trees, lamps, benches, a bus stop
    const trunk = std({ color: 0x6b4a2a, roughness: 0.9 }), leaves = [std({ color: 0x3f8a36, roughness: 0.85 }), std({ color: 0x4f9a3e, roughness: 0.85 }), std({ color: 0x357a2e, roughness: 0.85 })];
    this.lamps = [];
    const pole = std({ color: 0x2a2d33, roughness: 0.4, metalness: 0.6 });
    for (let x = -96; x <= 96; x += 11) {
      if (Math.abs(((x % D.STORE_GAP) + D.STORE_GAP) % D.STORE_GAP - D.STORE_GAP / 2) < 3) continue;
      const t = new THREE.Group(); t.position.set(x + 2, 0.12, 13.3);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), trunk); tr.position.y = 1.2; tr.castShadow = true; t.add(tr);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 - k * 0.2, 1), leaves[k]); b.position.set((R() - 0.5) * 0.6, 2.7 + k * 0.6, (R() - 0.5) * 0.6); b.castShadow = true; t.add(b); }
      S.add(t);
    }
    for (let x = -88; x <= 88; x += 22) {
      for (const z of [4.6, 10.6]) {
        const g = new THREE.Group(); g.position.set(x + (z > 8 ? 11 : 0), 0.12, z);
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), pole); p.position.y = 2.2; p.castShadow = true; g.add(p);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), pole); arm.position.set(0, 4.35, z > 8 ? 0.5 : -0.5); g.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std({ color: 0xfff4d0, emissive: 0xffd080, emissiveIntensity: 0.1 })); bulb.position.set(0, 4.22, z > 8 ? 0.95 : -0.95); g.add(bulb);
        this.lamps.push(bulb);
        S.add(g);
      }
    }
    const benchM = std({ map: T.wood([1, 1]), roughness: 0.8 });
    for (const x of [-D.STORE_GAP * 1.5 - 9, D.STORE_GAP * 1.5 + 9, -6, 16]) { box(1.8, 0.08, 0.5, benchM, x, 0.62, 12.6); box(1.8, 0.5, 0.08, benchM, x, 0.9, 12.9); box(0.08, 0.5, 0.4, pole, x - 0.8, 0.37, 12.6); box(0.08, 0.5, 0.4, pole, x + 0.8, 0.37, 12.6); }
    // bus stop shelter
    const bs = new THREE.Group(); bs.position.set(-D.STORE_GAP * 0.5, 0.12, 12.5);
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.05), glassM); g1.position.set(0, 1.2, 0.9); bs.add(g1);
    const rf = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.6), std({ color: 0x2f7bff })); rf.position.set(0, 2.35, 0.2); rf.castShadow = true; bs.add(rf);
    const sign = textSprite('BUS', { size: 40, bg: '#2f7bff', color: '#fff' }); sign.position.set(1.9, 2.8, 0); bs.add(sign);
    S.add(bs);
    // alley: dumpsters and a fence
    for (let i = 0; i < 4; i++) { const x = D.storeX(i) - 5.5; box(1.8, 1.2, 1.1, std({ color: [0x2e7a3a, 0x2a4a8a, 0x2e7a3a, 0x6b6b6b][i], roughness: 0.6, metalness: 0.2 }), x, 0.6, -21.2); this.colliders.push({ x0: x - 0.9, x1: x + 0.9, z0: -21.75, z1: -20.65 }); }
    box(L, 2, 0.1, std({ color: 0x8a7a60, roughness: 0.9 }), 0, 1, -29.4);
    // hills far away
    const hill = std({ color: 0x5a8a4a, roughness: 1 });
    for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(30 + R() * 20, 16, 8), hill); m.position.set(-150 + k * 40, -12, 70 + R() * 20); S.add(m); }
    // side walls of the whole street block so nobody wanders off forever
    this.colliders.push({ x0: -130, x1: 130, z0: 14.2, z1: 14.4 }, { x0: -130, x1: 130, z0: -29.5, z1: -29.3 }, { x0: -60, x1: -59.8, z0: -30, z1: 15 }, { x0: 59.8, x1: 60, z0: -30, z1: 15 });
    // the blocks between stores
    for (let k = 0; k < 5; k++) {
      const cx = D.storeX(0) - D.STORE_GAP / 2 + k * D.STORE_GAP, w = D.STORE_GAP - STORE_W - 0.2;
      if (k === 0 || k === 4) { box(20, 5.5, STORE_D, std({ map: T.brick([6, 2], '#8a6a5a'), roughness: 0.9 }), cx + (k === 0 ? -10 + w / 2 : 10 - w / 2), 2.75, -STORE_D / 2); this.colliders.push({ x0: cx + (k === 0 ? -20 + w / 2 : -w / 2), x1: cx + (k === 0 ? w / 2 : 20 - w / 2), z0: -STORE_D, z1: 0 }); }
      else { box(w, 3.2, 0.2, std({ color: 0x8a7a60, roughness: 0.9 }), cx, 1.6, -STORE_D + 0.1); this.colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: -STORE_D, z1: -STORE_D + 0.2 }); }
    }
  }

  // ---------------------------------------------------------------- a store
  buildStore(i) {
    const X = D.storeX(i), g = new THREE.Group(); g.position.x = X; this.scene.add(g);
    const st = { i, g, accent: std({ color: 0x888888, roughness: 0.45 }), walls: [], fixtures: [], secs: [], tags: [], forSale: [], color: null, name: null, sectionState: [], built: [] };
    const box = (w, h, d, m, x, y, z, cast = true, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; };
    // floors
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(STORE_W, -D.PARTITION_Z), std({ map: T.tile([STORE_W / 1.6, -D.PARTITION_Z / 1.6]), roughness: 0.35, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.02, D.PARTITION_Z / 2); floor.receiveShadow = true; g.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(STORE_W, STORE_D + D.PARTITION_Z), std({ map: T.concrete([4, 1]), roughness: 0.8 }));
    back.rotation.x = -Math.PI / 2; back.position.set(0, 0.02, (D.PARTITION_Z - STORE_D) / 2); back.receiveShadow = true; g.add(back);
    // walls: interior paint, exterior brick, each with its own material so it can fade out of the camera's way
    const H = 3.4;
    for (const w of D.wallBoxes()) {
      const front = Math.abs(w.z) < 0.01;
      const isSide = w.d > w.w;
      const mat = front ? null : std({ map: T.paint([Math.max(w.w, w.d) / 2, 1], w.z === D.PARTITION_Z ? '#d8d4c8' : '#efe8d8'), roughness: 0.85, transparent: true, opacity: 1 });
      if (front) continue;
      const m = box(w.w, H, w.d, mat, w.x, H / 2, w.z);
      if (isSide) { const outer = box(0.02, H, w.d, std({ map: T.brick([w.d / 2.5, 1.4]), roughness: 0.9 }), w.x + Math.sign(w.x) * (w.w / 2 + 0.011), H / 2, w.z, false); m.userData.skin = outer; }
      m.userData.box = { x0: X + w.x - w.w / 2, x1: X + w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2 };
      st.walls.push(m);
      this.colliders.push({ ...m.userData.box, store: i });
    }
    // accent stripe around the inside
    st.stripe = std({ color: 0x888888, roughness: 0.5 });
    for (const [w, d, x, z] of [[STORE_W - 0.4, 0.02, 0, D.PARTITION_Z + 0.17], [0.02, -D.PARTITION_Z, -STORE_W / 2 + 0.17, D.PARTITION_Z / 2], [0.02, -D.PARTITION_Z, STORE_W / 2 - 0.17, D.PARTITION_Z / 2]]) box(w, 0.35, d, st.stripe, x, 2.4, z, false);
    // glass front with the sliding doors
    const frameM = std({ color: 0x2a2d33, roughness: 0.4, metalness: 0.6 });
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.14, depthWrite: false });
    const frontM = frameM.clone(); st.frontParts = [];
    for (const w of D.wallBoxes().filter(w => Math.abs(w.z) < 0.01)) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w.w, H - 0.3, 0.04), glassM); gl.position.set(w.x, (H - 0.3) / 2 + 0.15, 0); g.add(gl);
      box(w.w, 0.3, 0.3, frameM, w.x, 0.15, 0); st.frontParts.push(box(w.w, 0.12, 0.3, frontM, w.x, H - 0.06, 0));
      for (let x = w.x - w.w / 2; x <= w.x + w.w / 2 + 0.01; x += w.w / Math.max(1, Math.round(w.w / 2.2))) st.frontParts.push(box(0.08, H, 0.14, frontM, x, H / 2, 0, false));
      this.colliders.push({ x0: X + w.x - w.w / 2, x1: X + w.x + w.w / 2, z0: -0.15, z1: 0.15, store: i });
    }
    st.doors = [];
    for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry((D.DOOR.x1 - D.DOOR.x0) / 2, 2.5, 0.04), glassM); d.position.set((D.DOOR.x0 + D.DOOR.x1) / 2 + s * (D.DOOR.x1 - D.DOOR.x0) / 4, 1.3, 0.05); const fr = new THREE.Mesh(new THREE.BoxGeometry((D.DOOR.x1 - D.DOOR.x0) / 2, 0.06, 0.06), frameM); fr.position.y = 1.25; d.add(fr); g.add(d); st.doors.push({ m: d, s, x: d.position.x }); }
    st.doorHeader = box(D.DOOR.x1 - D.DOOR.x0, 0.9, 0.3, frontM, (D.DOOR.x0 + D.DOOR.x1) / 2, H - 0.45, 0);
    st.doorOpen = 0;
    // facade: sign band and striped awning
    st.signBand = box(STORE_W + 0.3, 1.3, 0.4, std({ color: 0x777777, roughness: 0.6 }), 0, H + 0.65, 0.05);
    st.signMesh = new THREE.Mesh(new THREE.PlaneGeometry(STORE_W - 1, 1.05), std({ color: 0xffffff, roughness: 0.5, transparent: true }));
    st.signMesh.position.set(0, H + 0.65, 0.27); g.add(st.signMesh);
    st.awning = new THREE.Mesh(new THREE.PlaneGeometry(STORE_W, 1.6), std({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
    st.awning.position.set(0, H - 0.25, 0.75); st.awning.rotation.x = -Math.PI / 2 + 0.45; st.awning.castShadow = true; g.add(st.awning);
    // side walls rise to meet the sign band
    const caps = [-1, 1].map(s => box(0.3, 1.3, 0.4, frameM.clone(), s * (STORE_W / 2 + 0.15), H + 0.65, 0.05));
    // the whole shop front fades away when you're inside, so the camera can see over it
    st.facade = [st.signBand, st.signMesh, st.awning, ...caps, st.frontParts[0]];
    for (const m of st.facade) { m.material.transparent = true; }
    st.facadeK = 1;
    // stockroom rack, back door, truck bay
    const rack = new THREE.Group(); rack.position.set(D.STOCK_RACK_BOX.x, 0, D.STOCK_RACK_BOX.z); g.add(rack);
    const steel = std({ color: 0x3a6fd8, roughness: 0.5, metalness: 0.4 }), orange = std({ color: 0xff8a1c, roughness: 0.5, metalness: 0.3 });
    for (const x of [-3.15, -1.05, 1.05, 3.15]) box(0.08, 2.4, 1.0, steel, x, 1.2, 0, true, rack);
    for (const y of [0.1, 0.95, 1.8]) box(6.4, 0.07, 1.05, orange, 0, y, 0, false, rack);
    st.rack = rack; st.rackBoxes = [];
    const rollM = std({ color: 0xa8acb2, roughness: 0.5, metalness: 0.5 });
    st.backDoor = box(D.BACK_DOOR.x1 - D.BACK_DOOR.x0, 2.8, 0.1, rollM, (D.BACK_DOOR.x0 + D.BACK_DOOR.x1) / 2, 1.4, -STORE_D);
    box(D.BACK_DOOR.x1 - D.BACK_DOOR.x0 + 0.3, 0.6, 0.35, frameM, (D.BACK_DOOR.x0 + D.BACK_DOOR.x1) / 2, H - 0.3, -STORE_D);
    // "STAFF ONLY" over the stockroom door
    const staffOnly = textSprite('STAFF ONLY', { size: 30, bg: '#c8102e', color: '#fff', scale: 260 }); staffOnly.position.set((D.STOCK_DOOR.x0 + D.STOCK_DOOR.x1) / 2, 2.7, D.PARTITION_Z + 0.2); g.add(staffOnly);
    const stockSign = textSprite('STOCKROOM', { size: 34, bg: 'rgba(0,0,0,.55)', color: '#ffd23a', scale: 220 }); stockSign.position.set(D.STOCK_RACK_BOX.x, 2.9, D.STOCK_RACK_BOX.z); g.add(stockSign);
    // pallets of delivered boxes by the back door
    st.pallet = new THREE.Group(); st.pallet.position.set(4.8, 0, -18.7); g.add(st.pallet);
    box(1.4, 0.14, 1.2, std({ map: T.wood([1, 1]), roughness: 0.9 }), 0, 0.07, 0, false, st.pallet);
    // tills
    st.tills = D.TILLS.map((t, k) => { const tg = buildTill(st.accent); tg.position.set(t.x, 0, t.z); g.add(tg); return tg; });
    st.till2Closed = textSprite('LANE 2 CLOSED\nbuy it in Upgrades (U)', { size: 26, bg: 'rgba(0,0,0,.65)', color: '#ffd23a', scale: 240 });
    st.till2Closed.position.set(D.TILLS[1].x, 1.7, D.TILLS[1].z); g.add(st.till2Closed);
    st.laneSigns = D.TILLS.map((t, k) => { const s = textSprite(String(k + 1), { size: 44, bg: '#222', color: '#fff', scale: 300 }); s.position.set(t.x + 0.42, 2.45, t.z - 1.1); g.add(s); return s; });
    // fixtures in every slot (built or not)
    SLOTS.forEach((sl, k) => {
      const f = FIXTURES[sl.kind];
      const fg = buildFixture(sl.kind, st.accent); fg.position.set(sl.x, 0, sl.z); g.add(fg); fg.visible = false;
      st.fixtures.push(fg);
      // an empty spot waiting to be bought: dashed floor outline and a price sign (only shown in your own store)
      const c = document.createElement('canvas'); c.width = 256; c.height = 256 * f.d / f.w > 512 ? 512 : Math.round(256 * f.d / f.w); const cg = c.getContext('2d');
      cg.strokeStyle = '#ffd23a'; cg.lineWidth = 10; cg.setLineDash([22, 16]); cg.strokeRect(8, 8, c.width - 16, c.height - 16);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const outline = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
      outline.rotation.x = -Math.PI / 2; outline.position.set(sl.x, 0.03, sl.z); g.add(outline);
      const sign = textSprite(`+ ${f.name.toUpperCase()}\n${D.money(f.price)}`, { size: 30, bg: 'rgba(20,20,20,.7)', color: '#ffd23a', border: '#ffd23a', scale: 230 });
      sign.position.set(sl.x, 1.2, sl.z); g.add(sign);
      outline.visible = sign.visible = false;
      st.forSale.push({ outline, sign });
      st.secs.push([null, null]); st.tags.push([null, null]); st.sectionState.push([{}, {}]); st.built.push(false);
    });
    st.light = new THREE.PointLight(0xfff0d8, 0, 26, 1.2); st.light.position.set(0, 3.2, -8); g.add(st.light);
    return st;
  }

  /** Paint a store in its owner's colours and name. */
  dressStore(i, name, color) {
    const st = this.stores[i];
    if (st.name === name && st.color === color) return;
    st.name = name; st.color = color;
    if (['#9aa0a6', '#f2f2f7', '#3a3a3c'].includes(color.toLowerCase())) color = '#2f9e44';
    const c = new THREE.Color(color);
    st.signBand.material.color.copy(c.clone().multiplyScalar(0.55));
    st.stripe.color.copy(c);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 72; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 72); gr.addColorStop(0, '#' + c.clone().lerp(new THREE.Color('#fff'), 0.15).getHexString()); gr.addColorStop(1, '#' + c.clone().multiplyScalar(0.8).getHexString());
    g.fillStyle = gr; rr(g, 0, 0, 1024, 72, 14); g.fill();
    g.font = '900 52px Futura, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(name, 515, 41); g.fillStyle = '#fff'; g.fillText(name, 512, 38);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    st.signMesh.material.map?.dispose(); st.signMesh.material.map = tx; st.signMesh.material.emissive = new THREE.Color(0xffffff); st.signMesh.material.emissiveMap = tx; st.signMesh.material.emissiveIntensity = 0.15; st.signMesh.material.needsUpdate = true;
    st.awning.material.map = T.awning(color); st.awning.material.needsUpdate = true;
    st.accent.color.copy(c);
  }

  /** Bring a store's shelves, fixtures, lanes and stockroom up to date with the server's copy. */
  setStore(p, mine) {
    const st = this.stores[p.i];
    this.dressStore(p.i, p.name, p.color);
    SLOTS.forEach((sl, k) => {
      const built = !!p.fixtures[k];
      if (built !== st.built[k]) { st.built[k] = built; st.fixtures[k].visible = built; }
      st.forSale[k].outline.visible = !built && mine; st.forSale[k].sign.visible = !built && mine;
      for (let j = 0; j < 2; j++) {
        const sec = p.secs[k][j], ss = st.sectionState[k][j], price = p.prices[sec.p];
        if (!built) { if (st.secs[k][j]) st.secs[k][j].visible = false; if (st.tags[k][j]) st.tags[k][j].visible = false; continue; }
        if (ss.p !== sec.p) {
          if (st.secs[k][j]) { st.g.remove(st.secs[k][j]); st.secs[k][j].dispose(); st.secs[k][j] = null; }
          if (sec.p) {
            const [geo, mat] = productUnit(sec.p), spots = expandSpots(sl.kind, j, sec.p);
            const im = new THREE.InstancedMesh(geo, mat, spots.length); im.userData.spots = spots; im.castShadow = false; im.receiveShadow = true;
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
            spots.forEach((s, n) => { e.set(s.tilt || 0, s.yaw, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(sl.x + s.x, s.y, sl.z + s.z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(n, m4); });
            im.instanceMatrix.needsUpdate = true;
            st.g.add(im); st.secs[k][j] = im;
          }
          ss.p = sec.p; ss.n = -1;
        }
        const im = st.secs[k][j];
        if (im) { im.visible = true; const cap = FIXTURES[sl.kind].cap, show = sec.n <= 0 ? 0 : Math.max(1, Math.round(sec.n / cap * im.userData.spots.length)); if (show !== ss.n) { im.count = show; ss.n = show; } }
        // price tag on the shelf edge
        const tagKey = sec.p ? `${sec.p}|${price}|${sec.n > 0 ? 1 : 0}` : 'none';
        if (ss.tag !== tagKey) { ss.tag = tagKey; this.setTag(st, k, j, sec, price); }
        if (st.tags[k][j]) st.tags[k][j].visible = true;
      }
    });
    // checkout lane 2
    const t2 = !!p.perm?.till2;
    st.till2Closed.visible = !t2; st.tills[1].traverse(o => { if (o.isMesh) o.material.transparent = !t2, o.material.opacity = t2 ? 1 : 0.999; });
    st.tills[1].userData.lamp.visible = t2;
    // stockroom rack: a box for every 24 units, up to what fits
    const boxes = []; for (const [pid, n] of Object.entries(p.back)) for (let b = 0; b < Math.ceil(n / D.BOX); b++) boxes.push(pid);
    const key = boxes.join(',');
    if (key !== st.rackKey) {
      st.rackKey = key;
      for (const b of st.rackBoxes) b.parent.remove(b); st.rackBoxes = [];
      const geo = new THREE.BoxGeometry(0.6, 0.34, 0.42);
      boxes.slice(0, 60).forEach((pid, n) => {
        const mat = [cardboard, cardboard, cardboard, cardboard, labelMat(pid), labelMat(pid)];
        const m = new THREE.Mesh(geo, mat);
        if (n < 42) { const shelf = Math.floor(n / 14), col = n % 14; m.position.set(-2.9 + (col % 7) * 0.9 + (col >= 7 ? 0.05 : 0), 0.3 + shelf * 0.85 + (col >= 7 ? 0.34 : 0), 0.15 - (col >= 7 ? 0.1 : 0)); st.rack.add(m); }
        else { const k2 = n - 42; m.position.set(((k2 % 2) - 0.5) * 0.62, 0.31 + Math.floor(k2 / 2) * 0.35, 0); st.pallet.add(m); }
        m.castShadow = true; st.rackBoxes.push(m);
      });
    }
  }
  setTag(st, k, j, sec, price) {
    const sl = SLOTS[k];
    if (!st.tags[k][j]) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      // put the tag where shoppers look
      const [sx, sz] = sl.stand[j];
      if (sl.kind === 'shelf') { m.position.set(sl.x + (j ? 0.515 : -0.515), 1.02, sl.z); m.rotation.y = j ? Math.PI / 2 : -Math.PI / 2; }
      else if (sl.kind === 'produce') { m.position.set(sx, 0.75, sl.z + 0.73); }
      else if (sl.kind === 'fridge') { m.position.set(sx, 2.12, sl.z + 0.46); }
      else { m.position.set(sx, 0.92, sl.z + 0.47); }
      st.g.add(m); st.tags[k][j] = m; m.userData.canvas = c;
    }
    const m = st.tags[k][j], c = m.userData.canvas, g = c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.fillStyle = sec.p ? (sec.n > 0 ? '#ffe14a' : '#ff5a4a') : 'rgba(255,255,255,.7)'; rr(g, 2, 2, 252, 92, 12); g.fill();
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (sec.p) { g.font = '900 50px Futura, "Arial Black", sans-serif'; g.fillText(sec.n > 0 ? D.money2(price) : 'SOLD OUT', 128, 40); g.font = '700 22px "Avenir Next", sans-serif'; g.fillText(D.PROD[sec.p].name.toUpperCase(), 128, 78); }
    else { g.font = '800 28px "Avenir Next", sans-serif'; g.fillText('EMPTY SPOT', 128, 48); }
    m.material.map.needsUpdate = true;
  }

  // ---------------------------------------------------------------- effects
  floatText(x, y, z, text, color = '#7dff7d', big = false) {
    const s = textSprite(text, { size: big ? 50 : 38, color, bg: 'rgba(0,0,0,.55)', scale: 230 });
    s.position.set(x, y, z); this.scene.add(s);
    this.floaters.push({ s, t: 0, life: 1.6 });
  }
  bubble(fig, text, color = '#fff', bg = 'rgba(0,0,0,.7)') {
    if (fig.bubble) { fig.group.remove(fig.bubble); fig.bubble.material.map.dispose(); }
    const s = textSprite(text, { size: 30, color, bg, scale: 240 }); s.position.y = 2.1;
    fig.group.add(s); fig.bubble = s; fig.bubbleT = 2.2;
  }
  addSpill(id, x, z, kind) {
    const col = { milk: 0xf4f7ff, soda: 0x7a2a10, eggs: 0xffd23a, jam: 0xb3243a }[kind] || 0xffffff;
    const g = new THREE.Group(); g.position.set(x, 0.035, z);
    const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 });
    const R = rng(id * 31);
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.15 + R() * 0.25, 18), m); c.rotation.x = -Math.PI / 2; c.position.set((R() - 0.5) * 0.5, k * 0.001, (R() - 0.5) * 0.5); g.add(c); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 4), std({ color: 0xffd23a, roughness: 0.5 })); cone.position.set(0.45, 0.22, 0.2); cone.castShadow = true; g.add(cone);
    this.scene.add(g); this.spills.set(id, g);
  }
  removeSpill(id) { const g = this.spills.get(id); if (g) { this.scene.remove(g); this.spills.delete(id); } }
  truck(i, eta) {
    // a wholesale truck drives down the alley and backs up to the store's back door
    const t = this.makeTruck();
    const [x, z] = [D.storeX(i) + D.TRUCK_SPOT[0], D.TRUCK_SPOT[1]];
    t.position.set(x - 70, 0, z - 0.8); t.rotation.y = Math.PI / 2;
    this.scene.add(t);
    this.trucks.push({ t, i, x, z, age: 0, eta, phase: 0 });
  }
  makeTruck() {
    const g = new THREE.Group();
    const white = std({ color: 0xf2f4f6, roughness: 0.45 }), green = std({ color: 0x2f9e44, roughness: 0.4 }), dark = std({ color: 0x1c1d20, roughness: 0.6 }), glass = std({ color: 0x223344, roughness: 0.1, metalness: 0.5 });
    const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.06), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    b(2.3, 2.4, 4.6, white, 0, 1.75, -0.9);
    b(2.3, 1.7, 1.8, green, 0, 1.35, 2.3);
    b(2.1, 0.7, 0.05, glass, 0, 1.75, 3.2);
    b(2.4, 0.3, 6.6, dark, 0, 0.45, 0.1);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const cg = c.getContext('2d');
    cg.fillStyle = '#f2f4f6'; cg.fillRect(0, 0, 512, 256); cg.fillStyle = '#2f9e44'; cg.font = '900 64px Futura, "Arial Black", sans-serif'; cg.textAlign = 'center'; cg.fillText('GOOGLY', 256, 100); cg.fillText('WHOLESALE', 256, 170);
    cg.fillStyle = '#ff8a1c'; cg.fillRect(40, 200, 432, 16);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), std({ map: tx, roughness: 0.5 })); p.position.set(s * 1.16, 1.8, -0.9); p.rotation.y = s * Math.PI / 2; g.add(p); }
    const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18); wheelG.rotateZ(Math.PI / 2);
    g.userData.wheels = [];
    for (const z of [-2.2, -1.2, 2.3]) for (const s of [-1, 1]) { const w = new THREE.Mesh(wheelG, dark); w.position.set(s * 1.1, 0.42, z); g.add(w); g.userData.wheels.push(w); }
    return g;
  }
  buildRain() {
    const n = this.lowq || this.mobile ? 900 : 2600, pos = new Float32Array(n * 6);
    for (let k = 0; k < n; k++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 20, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x + 0.05, y - 0.5, z], k * 6); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaaccee, transparent: true, opacity: 0.45 }));
    this.rain.visible = false; this.rain.frustumCulled = false; this.scene.add(this.rain);
  }

  /** Time of day: hour 7..21, rain on/off. */
  setTime(hour, rain) {
    const day = THREE.MathUtils.clamp((hour - 6.5) / 1.5, 0, 1) * THREE.MathUtils.clamp((20.5 - hour) / 1.8, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(hour - 19.2) / 1.6, 0, 1);
    const ang = (hour - 6) / 14 * Math.PI;
    this.sunDir = new THREE.Vector3(-Math.cos(ang) * 0.8, Math.max(0.12, Math.sin(ang)), 0.45).normalize();
    this.sun.intensity = (0.25 + 2.3 * day) * (rain ? 0.35 : 1);
    this.sun.color.setHSL(0.1 - dusk * 0.05, 0.6 + dusk * 0.3, 0.9 - dusk * 0.25);
    this.hemi.intensity = (0.35 + 0.7 * day) * (rain ? 0.8 : 1);
    const sky = new THREE.Color('#9fd3ff').lerp(new THREE.Color('#ffa36a'), dusk * 0.7).lerp(new THREE.Color('#1a2440'), 1 - day);
    if (rain) sky.lerp(new THREE.Color('#7d8894'), 0.6 * day);
    this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    const night = 1 - day;
    for (const l of this.lamps) l.material.emissiveIntensity = 0.1 + night * 2.2;
    for (const w of this.houseWindows || []) w.material.emissiveIntensity = night * 0.9;
    for (const st of this.stores) { st.light.intensity = 3 + night * 20; }
    this.rain.visible = !!rain;
    this.road.material.roughness = rain ? 0.25 : 0.85;
  }

  /** Fade walls standing between the camera and the player. */
  fadeWalls(cam, target) {
    for (const st of this.stores) for (const w of st.walls) {
      const b = w.userData.box;
      const hit = segHitsBox(cam.x, cam.z, target.x, target.z, b.x0 - 0.3, b.x1 + 0.3, b.z0 - 0.3, b.z1 + 0.3) && cam.y > 0;
      const want = hit ? 0.15 : 1;
      w.material.opacity += (want - w.material.opacity) * 0.2;
      w.material.depthWrite = w.material.opacity > 0.9;
      if (w.userData.skin) w.userData.skin.visible = w.material.opacity > 0.9;
    }
  }

  update(dt, focus) {
    // follow the player with the sun's shadow box
    if (focus) {
      const d = this.sunDir || new THREE.Vector3(0.3, 1, 0.4);
      this.sun.target.position.set(focus.x, 0, focus.z);
      this.sun.position.set(focus.x + d.x * 50, d.y * 50, focus.z + d.z * 50);
    }
    for (const f of this.floaters) { f.t += dt; f.s.position.y += dt * 0.7; f.s.material.opacity = Math.min(1, 2 * (1 - f.t / f.life)); }
    this.floaters = this.floaters.filter(f => { if (f.t >= f.life) { this.scene.remove(f.s); f.s.material.map.dispose(); return false; } return true; });
    // trucks: drive in, back up, wait, drive off
    for (const tr of this.trucks) {
      tr.age += dt;
      const t = tr.t, arrive = Math.max(1.5, tr.eta - 1.2);
      if (tr.age < arrive - 1.2) { const k = tr.age / (arrive - 1.2); t.position.x = tr.x - 70 + 66 * easeOut(k); t.position.z = tr.z - 0.8; t.rotation.y = Math.PI / 2; }
      else if (tr.age < arrive) { const k = (tr.age - (arrive - 1.2)) / 1.2; t.position.x = tr.x - 4 + 4 * k; t.position.z = tr.z - 0.8 + 0.8 * k; t.rotation.y = Math.PI / 2 - k * Math.PI / 2 + Math.PI; }
      else if (tr.age < arrive + 3.2) { t.rotation.y = Math.PI; t.position.set(tr.x, 0, tr.z); }
      else { const k = (tr.age - arrive - 3.2) / 3.5; t.rotation.y = Math.PI / 2; t.position.set(tr.x + 70 * k * k, 0, tr.z - 0.6); }
      for (const w of t.userData.wheels) w.rotation.x += dt * 6;
    }
    this.trucks = this.trucks.filter(tr => { if (tr.age > Math.max(1.5, tr.eta - 1.2) + 7) { this.scene.remove(tr.t); return false; } return true; });
    // sliding doors, fading shop fronts
    for (const st of this.stores) {
      const want = st.hideFront ? 0.12 : 1;
      st.facadeK += (want - st.facadeK) * (1 - Math.exp(-6 * dt));
      for (const m of st.facade) { m.material.opacity = st.facadeK; m.material.depthWrite = st.facadeK > 0.9; m.castShadow = st.facadeK > 0.5; }
      st.hideFront = false;
      st.doorOpen += ((st.wantDoor ? 1 : 0) - st.doorOpen) * (1 - Math.exp(-8 * dt));
      for (const d of st.doors) d.m.position.x = d.x + d.s * st.doorOpen * (D.DOOR.x1 - D.DOOR.x0) * 0.46;
      st.wantDoor = false;
    }
    if (this.rain.visible) { this.rain.position.y = -((performance.now() / 1000 * 18) % 10); if (focus) { this.rain.position.x = focus.x; this.rain.position.z = focus.z; } }
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
const easeOut = k => 1 - Math.pow(1 - Math.min(1, k), 3);
const cardboard = std({ color: 0xc79a5b, roughness: 0.85 });
const labelMats = new Map();
function labelMat(pid) { if (!labelMats.has(pid)) labelMats.set(pid, std({ map: productTexture(pid, 'box'), roughness: 0.8 })); return labelMats.get(pid); }
function segHitsBox(ax, az, bx, bz, x0, x1, z0, z1) {
  // does the segment a→b cross the rectangle? (slab test)
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
  }
  return t1 > 0.02 && t0 < 0.97;
}
