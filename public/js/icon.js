// ?icon=1 — draws the app icon: a grey googly hugging a big bag of groceries.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Googly } from './googly.js';

export function renderIcon() {
  const N = 1024;
  document.body.innerHTML = '';
  document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent';
  // background tile: warm grocery-store yellow with a soft green floor and a sunburst
  const bg = document.createElement('canvas'); bg.width = bg.height = N; bg.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  const g = bg.getContext('2d');
  g.beginPath(); g.roundRect(40, 40, N - 80, N - 80, 200); g.save(); g.clip();
  const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, '#ffe066'); gr.addColorStop(0.62, '#ffb627'); gr.addColorStop(0.62, '#2f9e44'); gr.addColorStop(1, '#1f7a33');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.globalAlpha = 0.18; g.fillStyle = '#fff';
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.beginPath(); g.moveTo(N / 2, N * 0.42); g.arc(N / 2, N * 0.42, N, a, a + 0.12); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  // awning stripes along the top
  for (let x = 0; x < N; x += 86) { g.fillStyle = (x / 86) % 2 ? '#fff6e0' : '#e8452c'; g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 86, 40); g.lineTo(x + 86, 150); g.arc(x + 43, 150, 43, 0, Math.PI); g.closePath(); g.fill(); }
  g.restore();
  document.body.appendChild(bg);
  const out = document.createElement('canvas'); out.width = out.height = N; out.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  document.body.appendChild(out);
  const r = new THREE.WebGLRenderer({ canvas: out, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(N, N, false); r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 5); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff0c0, 1.4); rim.position.set(-4, 3, -3); scene.add(rim);
  const fig = new Googly({ color: '#9aa0a6', role: 'owner' });
  fig.hold('bag');
  // make the groceries big and proud
  fig.held.scale.setScalar(1.25); fig.held.position.set(0.2, -0.34, 0.12); fig.held.rotation.y = -0.25;
  // extra goodies poking out of the bag
  const bag = fig.held.children[0];
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe0302a, roughness: 0.3, clearcoat: 0.8 })); apple.position.set(0.1, 0.26, 0.06); bag.add(apple);
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xff8a1c })); carrot.position.set(-0.02, 0.3, 0.07); carrot.rotation.set(Math.PI, 0, 0.35); bag.add(carrot);
  scene.add(fig.group);
  fig.group.rotation.y = 0.15;
  for (let i = 0; i < 60; i++) fig.update(1 / 60, { speed: 0 });
  // both hands wrap around the bag
  fig.arms.forEach(a => { const tgt = new THREE.Vector3(a.side > 0 ? 0.42 : 0.02, 0.05, 0.36); const d = tgt.clone().sub(a.sh), L = d.length(); a.arm.position.copy(a.sh).addScaledVector(d, 0.5); a.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); a.arm.scale.set(1, Math.max(0.05, (L - 0.09) / 1.09), 1); a.hand.position.copy(tgt); });
  fig.eyes.forEach((e, i) => e.pupil.position.set(i ? -0.02 : 0.018, 0.012, 0.022));
  fig.mouth.scale.set(1.3, 1.1, 1);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(-0.3, 1.45, 4.3); cam.lookAt(0.05, 0.92, 0);
  r.render(scene, cam);
  document.title = 'icon-ready';
}
