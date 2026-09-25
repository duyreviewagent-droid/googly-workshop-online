// Googlies: glossy jelly-bean people with wobbly googly eyes. Shop owners wear an apron and cap,
// staff wear coloured aprons, shoppers carry baskets. Anyone can carry a box of groceries.
import * as THREE from 'three';
import { productTexture } from './art.js';

const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
// geometry is shared by every googly on the street
const G = {
  body: new THREE.CapsuleGeometry(0.3, 0.38, 8, 20),
  bodyLo: new THREE.CapsuleGeometry(0.3, 0.38, 5, 12),
  belly: new THREE.SphereGeometry(0.24, 16, 10),
  rim: new THREE.CylinderGeometry(0.134, 0.134, 0.03, 22).rotateX(Math.PI / 2),
  white: new THREE.CylinderGeometry(0.125, 0.125, 0.036, 22).rotateX(Math.PI / 2),
  pupil: new THREE.CylinderGeometry(0.062, 0.062, 0.012, 16).rotateX(Math.PI / 2),
  mouth: new THREE.TorusGeometry(0.07, 0.016, 6, 14, Math.PI),
  arm: new THREE.CapsuleGeometry(0.045, 1, 3, 8),
  hand: new THREE.SphereGeometry(0.068, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.055, 0.17, 3, 8),
  shin: new THREE.CapsuleGeometry(0.05, 0.17, 3, 8),
  shoe: new THREE.SphereGeometry(0.1, 12, 8),
  apron: (() => { const g = new THREE.CylinderGeometry(0.315, 0.33, 0.5, 20, 1, true, -1.25, 2.5); return g; })(),
  strap: new THREE.TorusGeometry(0.31, 0.018, 6, 30, Math.PI * 0.9),
  cap: new THREE.SphereGeometry(0.29, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  brim: new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI),
  box: new THREE.BoxGeometry(0.62, 0.34, 0.42),
  basket: new THREE.CylinderGeometry(0.2, 0.16, 0.17, 14, 1, true),
  basketBase: new THREE.CircleGeometry(0.16, 14).rotateX(-Math.PI / 2),
  handle: new THREE.TorusGeometry(0.17, 0.012, 5, 16, Math.PI),
  item: new THREE.BoxGeometry(0.1, 0.12, 0.08),
  mopStick: new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6),
  mopHead: new THREE.CylinderGeometry(0.1, 0.13, 0.12, 10),
  bag: new THREE.BoxGeometry(0.34, 0.4, 0.22),
  baguette: new THREE.CapsuleGeometry(0.04, 0.4, 4, 8),
  leaf: new THREE.ConeGeometry(0.05, 0.22, 6),
  milk: new THREE.BoxGeometry(0.1, 0.22, 0.1),
  hairBun: new THREE.SphereGeometry(0.1, 10, 8),
  bow: new THREE.TorusGeometry(0.06, 0.03, 6, 10),
};
const M = {
  rim: std(0x15151a, 0.5), white: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 }), pupil: std(0x050505, 0.2),
  mouth: std(0x2a0c12, 0.4), shoe: new THREE.MeshPhysicalMaterial({ color: 0x1c1c22, roughness: 0.35, clearcoat: 0.8 }),
  cardboard: std(0xc79a5b, 0.85), basket: std(0xe8352a, 0.5, 0, { side: THREE.DoubleSide }), metal: std(0xb8bec8, 0.3, 0.9),
  mopHead: std(0xe8e0c8, 0.95), stick: std(0x3a6fd8, 0.4), paper: std(0xc9a26a, 0.9), bread: std(0xd08a3a, 0.7), leaf: std(0x3fae3a, 0.6), milk: std(0xf4f7ff, 0.4),
  strap: std(0x222228, 0.7),
};
const itemMats = ['#ff3b30', '#ffd23a', '#34c759', '#2f7bff', '#ff9500', '#f4f7ff', '#bf5af2'].map(c => std(c, 0.5));
const colorMats = new Map();
function bodyMat(color) {
  if (!colorMats.has(color)) {
    const c = new THREE.Color(color);
    colorMats.set(color, {
      body: new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.5) }),
      dark: std(c.clone().multiplyScalar(0.62), 0.45), belly: std(c.clone().lerp(new THREE.Color('#fff'), 0.2), 0.4),
    });
  }
  return colorMats.get(color);
}
const clothMats = new Map();
const cloth = c => { if (!clothMats.has(c)) clothMats.set(c, std(c, 0.8, 0, { side: THREE.DoubleSide })); return clothMats.get(c); };

export function textSprite(text, { size = 44, color = '#fff', bg = 'rgba(0,0,0,.6)', border = null, pad = 12, font = '"Avenir Next", system-ui, sans-serif', weight = 900, scale = 200 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const f = `${weight} ${size}px ${font}`;
  g.font = f;
  const lines = String(text).split('\n');
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + pad * 2, h = size * 1.2 * lines.length + pad * 2;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  g.font = f;
  if (bg) { g.fillStyle = bg; rr(g, 0, 0, c.width, c.height, Math.min(18, c.height / 2)); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 5; rr(g, 3, 3, c.width - 6, c.height - 6, Math.min(15, c.height / 2 - 3)); g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, pad + size * 0.62 + i * size * 1.2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(c.width / scale, c.height / scale, 1); s.renderOrder = 10;
  return s;
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x, y, r); g.closePath(); }

const boxMats = new Map();
function boxMaterial(pid) {
  if (!boxMats.has(pid)) {
    const label = new THREE.MeshStandardMaterial({ map: productTexture(pid, 'box'), roughness: 0.8 });
    boxMats.set(pid, [M.cardboard, M.cardboard, M.cardboard, M.cardboard, label, label]);
  }
  return boxMats.get(pid);
}

export class Googly {
  /**
   * @param {object} o color, name, role ('owner'|'staff'|'shopper'), apron (colour), cap (colour), lite (cheaper eyes), look (shopper variety)
   */
  constructor({ color = '#9aa0a6', name = '', role = 'shopper', apron = null, cap = null, lite = false, look = 0, tag = null, scale = 1 } = {}) {
    this.group = new THREE.Group();
    this.root = new THREE.Group(); this.root.scale.setScalar(1.12 * scale); this.group.add(this.root);
    this.lite = lite; this.role = role;
    const mats = bodyMat(color);
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.5; this.root.add(this.pelvis);
    this.body = new THREE.Group(); this.pelvis.add(this.body);
    this.bodyMesh = new THREE.Mesh(lite ? G.bodyLo : G.body, mats.body); this.bodyMesh.position.y = 0.4; this.bodyMesh.castShadow = true; this.body.add(this.bodyMesh);
    const belly = new THREE.Mesh(G.belly, mats.belly); belly.scale.set(1, 1.3, 0.4); belly.position.set(0, 0.25, 0.19); this.body.add(belly);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(side * 0.125, 0.66, 0.27); e.rotation.set(-0.08, side * 0.28, 0);
      e.add(new THREE.Mesh(G.rim, M.rim)); e.add(new THREE.Mesh(G.white, M.white));
      const pupil = new THREE.Mesh(G.pupil, M.pupil); pupil.position.set(0, -0.03, 0.022); e.add(pupil);
      this.body.add(e);
      this.eyes.push({ node: e, pupil, p: new THREE.Vector2(0, -0.03), v: new THREE.Vector2(), last: null, lastV: new THREE.Vector3() });
    }
    this.mouth = new THREE.Mesh(G.mouth, M.mouth); this.mouth.position.set(0, 0.49, 0.29); this.mouth.rotation.z = Math.PI; this.body.add(this.mouth);
    // apron + cap for workers
    if (apron) {
      const a = new THREE.Mesh(G.apron, cloth(apron)); a.position.set(0, 0.22, 0.0); a.rotation.y = 0; this.body.add(a);
      const st = new THREE.Mesh(G.strap, M.strap); st.rotation.set(Math.PI / 2, 0, Math.PI * 0.05 + Math.PI); st.position.y = 0.47; st.scale.set(1.02, 1.02, 1); this.body.add(st);
    }
    if (cap) {
      const c = new THREE.Group(); c.position.set(0, 0.74, -0.01); c.rotation.x = -0.12;
      const dome = new THREE.Mesh(G.cap, cloth(cap)); dome.scale.set(1.02, 0.55, 1.02); c.add(dome);
      const brim = new THREE.Mesh(G.brim, cloth(cap)); brim.position.set(0, 0.0, 0.24); brim.scale.set(1.1, 1, 1.15); c.add(brim);
      this.body.add(c);
    }
    if (role === 'shopper' && look % 3 === 1) { const bun = new THREE.Mesh(G.hairBun, mats.dark); bun.position.set(0, 0.86, -0.12); this.body.add(bun); }
    if (role === 'shopper' && look % 4 === 2) { const bow = new THREE.Mesh(G.bow, cloth(['#ff2d55', '#2f7bff', '#ffd23a'][look % 3])); bow.position.set(0.14, 0.8, 0.05); bow.rotation.set(0.3, 0.6, 0); this.body.add(bow); }
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(G.arm, mats.body), hand = new THREE.Mesh(G.hand, mats.body);
      arm.castShadow = !lite; this.body.add(arm); this.body.add(hand);
      this.arms.push({ arm, hand, sh: new THREE.Vector3(side * 0.28, 0.42, 0), side });
    }
    this.hips = []; this.knees = [];
    for (const side of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.13, 0.02, 0); this.pelvis.add(hp);
      const th = new THREE.Mesh(G.thigh, mats.dark); th.position.y = -0.12; hp.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.23; hp.add(kn);
      const sn = new THREE.Mesh(G.shin, mats.dark); sn.position.y = -0.11; kn.add(sn);
      const sh = new THREE.Mesh(G.shoe, M.shoe); sh.scale.set(0.85, 0.55, 1.45); sh.position.set(0, -0.24, 0.06); kn.add(sh);
      if (!lite) { th.castShadow = sn.castShadow = sh.castShadow = true; }
      this.hips.push(hp); this.knees.push(kn);
    }
    // things in hands
    this.held = new THREE.Group(); this.body.add(this.held);
    this.holding = null; this.holdKey = '';
    this.phase = Math.random() * 6; this.gait = 0; this.t = Math.random() * 10; this.lastSide = 0; this.onStep = null;
    this.bob = 0; this.work = 0; this.mood = 0; this.moodT = 0;
    if (name) this.setName(name, tag);
  }
  setName(name, tag) {
    if (this.tag) this.group.remove(this.tag);
    if (!name) { this.tag = null; return; }
    this.tag = textSprite(name, { size: 34, border: tag || '#fff' }); this.tag.position.y = 2.05; this.group.add(this.tag);
  }
  /** what's in the hands: null | {box: pid} | {basket: n} | 'bag' | 'mop' */
  hold(h) {
    const key = h ? JSON.stringify(h) : '';
    if (key === this.holdKey) return;
    this.holdKey = key; this.holding = h;
    this.held.clear();
    if (!h) return;
    if (h.box) {
      const b = new THREE.Mesh(G.box, boxMaterial(h.box)); b.position.set(0, 0.36, 0.42); b.castShadow = true; this.held.add(b);
      if (h.two) { const b2 = b.clone(); b2.position.y = 0.7; b2.rotation.y = 0.08; this.held.add(b2); }
    } else if (h.basket !== undefined) {
      const g = new THREE.Group(); g.position.set(0.3, 0.12, 0.2);
      g.add(new THREE.Mesh(G.basket, M.basket)); const base = new THREE.Mesh(G.basketBase, M.basket); base.position.y = -0.085; g.add(base);
      const hd = new THREE.Mesh(G.handle, M.metal); hd.position.y = 0.08; hd.rotation.y = Math.PI / 2; g.add(hd);
      for (let i = 0; i < Math.min(8, h.basket); i++) { const it = new THREE.Mesh(G.item, itemMats[(i * 3 + h.basket) % itemMats.length]); it.position.set(((i % 3) - 1) * 0.1, -0.02 + Math.floor(i / 3) * 0.06, ((i % 2) - 0.5) * 0.1); it.rotation.y = i; g.add(it); }
      this.held.add(g);
    } else if (h === 'bag') {
      const g = new THREE.Group(); g.position.set(0, 0.28, 0.38);
      const bag = new THREE.Mesh(G.bag, M.paper); bag.castShadow = true; g.add(bag);
      const bg = new THREE.Mesh(G.baguette, M.bread); bg.position.set(-0.08, 0.3, -0.02); bg.rotation.z = 0.25; g.add(bg);
      const milk = new THREE.Mesh(G.milk, M.milk); milk.position.set(0.08, 0.22, 0.02); g.add(milk);
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(G.leaf, M.leaf); l.position.set(0.02 + i * 0.04, 0.3, -0.05); l.rotation.z = -0.3 + i * 0.3; g.add(l); }
      this.held.add(g);
    } else if (h === 'mop') {
      const g = new THREE.Group(); g.position.set(0.32, 0.1, 0.25); g.rotation.x = 0.5;
      const st = new THREE.Mesh(G.mopStick, M.stick); g.add(st);
      const hd = new THREE.Mesh(G.mopHead, M.mopHead); hd.position.y = -0.68; g.add(hd);
      this.held.add(g);
    }
  }
  react(kind) { this.mood = kind === 'happy' ? 1 : -1; this.moodT = 1.6; }

  update(dt, { speed = 0, work = false } = {}) {
    this.t += dt;
    this.gait += (Math.min(1, speed / 3) - this.gait) * (1 - Math.exp(-8 * dt));
    this.phase += speed / 1.2 * Math.PI * 2 * dt;
    this.work += ((work ? 1 : 0) - this.work) * (1 - Math.exp(-10 * dt));
    this.moodT = Math.max(0, this.moodT - dt);
    const g = this.gait, s = Math.sin(this.phase), c = Math.cos(this.phase);
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + (i ? Math.PI : 0), swing = Math.max(0, Math.cos(ph));
      this.hips[i].rotation.set(-0.7 * Math.sin(ph) * g, 0, (i ? 1 : -1) * 0.07);
      this.knees[i].rotation.x = 1.3 * Math.pow(swing, 1.3) * g + 0.08;
    }
    const side = s > 0 ? 0 : 1;
    if (side !== this.lastSide && g > 0.3) this.onStep?.(side === 0 ? 1 : 0.7);
    this.lastSide = side;
    const hop = this.moodT > 0 && this.mood > 0 ? Math.abs(Math.sin(this.t * 12)) * 0.12 * this.moodT : 0;
    this.pelvis.position.y = 0.5 + (0.06 * Math.max(0, s) + 0.02 * Math.abs(c)) * g + hop;
    const stomp = this.moodT > 0 && this.mood < 0 ? Math.sin(this.t * 22) * 0.12 * this.moodT : 0;
    this.body.rotation.set(0.1 * g + this.work * 0.25, 0.12 * c * g + stomp, 0.09 * s * g + Math.sin(this.t * 0.9) * 0.02);
    const breath = 1 + Math.sin(this.t * 2.2) * 0.012;
    this.bodyMesh.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    // arms: carry a box out front, swing a basket, sweep a mop, or swing loose
    const h = this.holding;
    for (const a of this.arms) {
      let tgt;
      if (h && h.box) tgt = new THREE.Vector3(a.side * 0.3, 0.38 + (h.two ? 0.15 : 0), 0.42);
      else if (h === 'bag') tgt = new THREE.Vector3(a.side * 0.2, 0.3, 0.38);
      else if (h && h.basket !== undefined && a.side > 0) tgt = new THREE.Vector3(0.3, 0.22 + Math.sin(this.phase) * 0.03, 0.2);
      else if (h === 'mop') tgt = new THREE.Vector3(a.side > 0 ? 0.32 : 0.2, 0.2 + (a.side > 0 ? 0 : 0.18), 0.28 + Math.sin(this.t * 9) * 0.08 * this.work);
      else if (this.work > 0.2) tgt = new THREE.Vector3(a.side * 0.26, 0.42 + Math.sin(this.t * 14 + a.side) * 0.06 * this.work, 0.36);
      else { const sw = Math.sin(this.phase + (a.side > 0 ? Math.PI : 0)) * 0.22 * g; tgt = new THREE.Vector3(a.side * 0.36, 0.06, sw + 0.02); }
      if (this.moodT > 0 && this.mood > 0 && !h) tgt.set(a.side * 0.42, 0.85, 0.1);
      const d = tgt.clone().sub(a.sh), L = d.length();
      a.arm.position.copy(a.sh).addScaledVector(d, 0.5);
      a.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      a.arm.scale.set(1, Math.max(0.05, (L - 0.09) / 1.09), 1);
      a.hand.position.copy(tgt);
    }
    if (h === 'mop') this.held.children[0] && (this.held.children[0].rotation.z = Math.sin(this.t * 9) * 0.3 * this.work);
    this.mouth.rotation.z = this.moodT > 0 && this.mood < 0 ? 0 : Math.PI;
    // googly eyes: pupils rattle around under gravity and motion
    if (this.lite && this.t % 0.1 > dt * 2 && this.gait < 0.1) return;
    this.root.updateMatrixWorld(true);
    const E = _v1, q = _q, ux = _v2, uy = _v3;
    for (const e of this.eyes) {
      e.node.getWorldPosition(E); e.node.getWorldQuaternion(q);
      ux.set(1, 0, 0).applyQuaternion(q); uy.set(0, 1, 0).applyQuaternion(q);
      if (!e.last) { e.last = E.clone(); e.lastV.set(0, 0, 0); }
      const ve = _v4.copy(E).sub(e.last).divideScalar(Math.max(dt, 1e-3));
      const ae = _v5.copy(ve).sub(e.lastV).divideScalar(Math.max(dt, 1e-3)); if (ae.length() > 250) ae.setLength(250);
      e.last.copy(E); e.lastV.copy(ve);
      const a3 = _v6.set(0, -22, 0).sub(ae), ax = a3.dot(ux), ay = a3.dot(uy);
      for (let k = 0; k < 2; k++) {
        const hh = dt / 2;
        e.v.x += ax * hh; e.v.y += ay * hh; e.v.multiplyScalar(1 - 1.6 * hh);
        e.p.x += e.v.x * hh; e.p.y += e.v.y * hh;
        const maxD = 0.061, d = e.p.length();
        if (d > maxD) { const nx = e.p.x / d, ny = e.p.y / d; e.p.set(nx * maxD, ny * maxD); const vn = e.v.x * nx + e.v.y * ny; if (vn > 0) { e.v.x -= nx * vn * 1.55; e.v.y -= ny * vn * 1.55; } }
      }
      e.pupil.position.set(e.p.x, e.p.y, 0.022);
    }
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _q = new THREE.Quaternion();
