// The lab: a rooftop laboratory under the Cheetah Moon, with a stage for the
// experiments, the scientists gathered round it, and the team's rocket at the
// back. main.js tells it what the game is doing; it draws.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ease, clamp01, lerp, mat, metal, glow, glass, mesh, box, ball, tube, label, pop, canvasTexture, dispose } from './kit.js';
import { buildExperiment } from './experiments.js';

export const LOOKS = ['#ff5d5d', '#ffa53d', '#ffe14d', '#6fdc6f', '#3dd6d0', '#5aa2ff', '#b07cff', '#ff7ad1'];
const STAGE_TOP = 0.35;
const ROCKET = new THREE.Vector3(0, 0, -8);

// How high the rocket gets on how much fuel (0 to 1).
export const MILESTONES = [
  { fuel: 0, height: 9, text: 'A little hop off the pad!' },
  { fuel: 0.3, height: 48, text: 'Up above the clouds!' },
  { fuel: 0.5, height: 95, text: 'All the way into space!' },
  { fuel: 0.7, height: 150, text: 'It reached the Moon!' },
  { fuel: 0.9, height: 215, text: 'All the way to Mars!' },
];
export function milestoneFor(fuel) {
  return MILESTONES.filter((m) => fuel >= m.fuel).pop();
}

// --- A scientist -----------------------------------------------------------------

class Avatar {
  constructor(look) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.look = -1;
    this.target = new THREE.Vector3();
    this.placed = false;
    this.jump = 0;
    this.jumpHeight = 0.5;
    this.spin = 0;
    this.shake = 0;
    this.phase = Math.random() * 6;
    this.nameTag = null;
    this.statusTag = null;
    this.status = '';
    this.ring = mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.setLook(look);
  }

  setLook(look) {
    if (look === this.look) return;
    this.look = look;
    for (const child of [...this.body.children]) {
      this.body.remove(child);
      dispose(child);
    }
    const colour = LOOKS[look % LOOKS.length];
    const skin = mat(colour, { roughness: 0.45 });
    const coat = mat(0xffffff, { roughness: 0.6 });
    const dark = mat(0x1d2033, { roughness: 0.4 });
    const b = this.body;
    b.add(mesh(new THREE.CapsuleGeometry(0.34, 0.34, 8, 20), skin, 0, 0.62, 0));
    // Lab coat, open at the front.
    const coatMesh = mesh(new THREE.CylinderGeometry(0.37, 0.43, 0.56, 20, 1, true, 0.5, Math.PI * 2 - 1), coat, 0, 0.42, 0);
    coatMesh.material.side = THREE.DoubleSide;
    b.add(coatMesh);
    for (const s of [-1, 1]) {
      b.add(mesh(ball(0.1, 12), dark, s * 0.16, 0.08, 0.05));
      const arm = mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 10), coat, s * 0.42, 0.56, 0.04);
      arm.rotation.z = s * 0.5;
      arm.userData.side = s;
      b.add(arm);
    }
    this.arms = b.children.filter((c) => c.userData.side);
    // Goggles.
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.14, 0.86, 0.28);
      eye.add(mesh(tube(0.115, 0.115, 0.07, 20), dark).rotateX(Math.PI / 2),
        mesh(tube(0.09, 0.09, 0.075, 20), mat(0xffffff, { roughness: 0.15 })).rotateX(Math.PI / 2),
        mesh(ball(0.04, 10), dark, s * -0.015, 0, 0.035));
      b.add(eye);
    }
    b.add(mesh(new THREE.TorusGeometry(0.345, 0.025, 6, 28), dark, 0, 0.86, 0).rotateX(Math.PI / 2));
    const smile = mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16, Math.PI), dark, 0, 0.7, 0.31);
    smile.rotation.z = Math.PI;
    b.add(smile);
    // Crazy hair: a different do for each look.
    const hairColour = ['#ffffff', '#7fe9ff', '#ff7ad1', '#ffe14d'][look % 4];
    const hair = mat(hairColour, { roughness: 0.7 });
    const style = look % 4;
    if (style === 0) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.07, 0.3, 8), hair, Math.cos(a) * 0.17, 1.2, Math.sin(a) * 0.17);
        spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        b.add(spike);
      }
      b.add(mesh(new THREE.ConeGeometry(0.08, 0.34, 8), hair, 0, 1.28, 0));
    } else if (style === 1) {
      for (let i = 0; i < 5; i++) b.add(mesh(new THREE.ConeGeometry(0.08, 0.34 - Math.abs(i - 2) * 0.05, 8), hair, 0, 1.24 - Math.abs(i - 2) * 0.03, (i - 2) * 0.11));
    } else if (style === 2) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.add(mesh(ball(0.11, 10), hair, Math.cos(a) * 0.2, 1.13 + (i % 2) * 0.07, Math.sin(a) * 0.2));
      }
      b.add(mesh(ball(0.13, 10), hair, 0, 1.24, 0));
    } else {
      for (const s of [-1, 1]) {
        const stalk = mesh(tube(0.018, 0.018, 0.32, 6), dark, s * 0.13, 1.22, 0);
        stalk.rotation.z = -s * 0.3;
        b.add(stalk, mesh(ball(0.07, 12), glow(hairColour, 1.6), s * 0.18, 1.39, 0));
      }
    }
  }

  setName(text, you) {
    if (this.nameText === text && this.you === you) return;
    this.nameText = text;
    this.you = you;
    if (this.nameTag) {
      this.group.remove(this.nameTag);
      dispose(this.nameTag);
    }
    this.nameTag = label(text, { height: 0.3, color: you ? '#ffe680' : '#ffffff', border: you ? '#ffe680' : null });
    this.nameTag.position.y = 1.78;
    this.group.add(this.nameTag);
    this.ring.visible = you;
  }

  // '' | 'done' (has answered) | 'right' | 'wrong' | 'away'
  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    if (this.statusTag) {
      this.group.remove(this.statusTag);
      dispose(this.statusTag);
      this.statusTag = null;
    }
    const icon = { done: '✅', right: '⭐', wrong: '💭', away: '💤' }[status];
    if (!icon) return;
    this.statusTag = label(icon, { height: 0.42, bg: null });
    this.statusTag.position.y = 2.18;
    this.group.add(this.statusTag);
    this.statusPop = 0;
  }

  hop(height = 0.5) {
    this.jump = 1;
    this.jumpHeight = height;
  }

  cheer() {
    this.hop(0.8);
    this.spin = 1;
  }

  sigh() {
    this.shake = 1;
  }

  update(dt, time, camera) {
    if (!this.placed) {
      this.group.position.copy(this.target);
      this.placed = true;
    } else {
      this.group.position.lerp(this.target, 1 - Math.exp(-dt * 4));
    }
    this.group.position.y = 0;
    const moving = this.group.position.distanceToSquared(this.target) > 0.01;
    let y = Math.abs(Math.sin(time * (moving ? 9 : 2.2) + this.phase)) * (moving ? 0.12 : 0.035);
    if (this.jump > 0) {
      this.jump = Math.max(0, this.jump - dt * 2.2);
      y += Math.sin((1 - this.jump) * Math.PI) * this.jumpHeight;
    }
    this.body.position.y = y;
    // Face the camera, more or less.
    const face = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z);
    let turn = face;
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 1.4);
      turn += ease.inOut(1 - this.spin) * Math.PI * 2;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.1);
      turn += Math.sin(this.shake * 16) * 0.35 * this.shake;
    }
    this.body.rotation.y = turn;
    const wave = this.jump > 0 ? 2.4 : 0.5 + Math.sin(time * 2 + this.phase) * 0.08;
    for (const arm of this.arms) arm.rotation.z = arm.userData.side * lerp(Math.abs(arm.rotation.z), wave, 1 - Math.exp(-dt * 10));
    if (this.statusTag && this.statusPop < 1) {
      this.statusPop = Math.min(1, this.statusPop + dt * 4);
      pop(this.statusTag, ease.back(this.statusPop));
    }
    this.ring.rotation.z = time;
  }
}

// --- The lab ---------------------------------------------------------------------

export class Lab {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090a1c);
    this.scene.fog = new THREE.Fog(0x15103a, 26, 70);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
    this.camPos = new THREE.Vector3(0, 6, 14);
    this.camLook = new THREE.Vector3(0, 1.9, 0);
    this.camera.position.copy(this.camPos);

    this.time = 0;
    this.phase = 'home';
    this.avatars = new Map();
    this.order = [];
    this.experiment = null;
    this.inset = 0;
    this.insetNow = 0;
    this.fuel = 0;
    this.fuelNow = 0;
    this.flight = null;
    this.sparks = [];
    // ?gfx=low starts plain, for slow devices; otherwise watchSpeed() decides.
    const low = new URLSearchParams(location.search).get('gfx') === 'low';
    this.pixelRatio = low ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.bloomOn = !low;
    renderer.shadowMap.enabled = !low;
    this.side = 0;
    this.sideNow = 0;
    this.frames = 0;
    this.slowFor = 0;

    this.buildLights();
    this.buildSky();
    this.buildRoom();
    this.buildRocket();

    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.3, 0.35, 1.25);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    this.last = performance.now();
    renderer.setAnimationLoop(() => this.frame());
  }

  // --- Building ----------------------------------------------------------------

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xa9bcff, 0x2a1a4a, 0.55));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.25);
    key.position.set(6, 13, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    key.shadow.bias = -0.0015;
    key.shadow.normalBias = 0.03;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb07cff, 0.6);
    rim.position.set(-7, 6, -10);
    this.scene.add(rim);
    const stageGlow = new THREE.PointLight(0x7fe9ff, 6, 12, 2);
    stageGlow.position.set(0, 0.8, 3.6);
    this.scene.add(stageGlow);
  }

  buildSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.MeshBasicMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      map: canvasTexture(512, (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#04040f');
        g.addColorStop(0.42, '#0c0b2a');
        g.addColorStop(0.5, '#3b1f78');
        g.addColorStop(0.54, '#7a3a9a');
        g.addColorStop(0.6, '#1a1040');
        g.addColorStop(1, '#090818');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }),
    }));
    this.scene.add(sky);

    const n = 1800;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 160;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = -30 + Math.random() * 420;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
    this.scene.add(stars);

    // The Cheetah Moon, low over the lab.
    this.scene.add(this.cheetahMoon(7, 26, 21, -60));

    // What the rocket passes on its way up.
    const cloud = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, fog: false, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 16; i++) {
      const puff = new THREE.Group();
      for (let j = 0; j < 5; j++) puff.add(new THREE.Mesh(ball(2 + Math.random() * 1.6, 12), cloud).translateX((j - 2) * 2.2).translateY(Math.random() * 1.2));
      const a = (i / 16) * Math.PI * 2;
      puff.position.set(Math.cos(a) * (14 + (i % 3) * 7), 34 + (i % 5) * 5, ROCKET.z + Math.sin(a) * (10 + (i % 4) * 5));
      this.scene.add(puff);
    }
    this.scene.add(this.cheetahMoon(11, -15, 150, ROCKET.z - 14));
    const mars = new THREE.Mesh(ball(12, 40), new THREE.MeshStandardMaterial({ color: 0xd9532b, roughness: 0.9, fog: false, emissive: 0x5a1a0a, emissiveIntensity: 0.6 }));
    mars.position.set(17, 215, ROCKET.z - 18);
    for (let i = 0; i < 9; i++) {
      const crater = new THREE.Mesh(ball(1.2 + (i % 3) * 0.9, 12), new THREE.MeshStandardMaterial({ color: 0xa63a1c, roughness: 1, fog: false }));
      crater.position.setFromSphericalCoords(11.6, 0.6 + i * 0.25, -0.6 + i * 0.9);
      crater.scale.z = 0.3;
      crater.lookAt(0, 0, 0);
      mars.add(crater);
    }
    this.scene.add(mars);
  }

  cheetahMoon(radius, x, y, z) {
    const moon = new THREE.Mesh(ball(radius, 48), new THREE.MeshStandardMaterial({
      fog: false, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.95,
      emissiveMap: canvasTexture(512, (ctx, s) => {
        ctx.fillStyle = '#f6dc8a';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 70; i++) {
          const px = (i * 97.3) % s; const py = ((i * 57.7) % (s * 0.8)) + s * 0.1; const r = 9 + (i % 4) * 4;
          ctx.strokeStyle = '#8a5a1c';
          ctx.lineWidth = 6;
          ctx.fillStyle = '#c98f2e';
          ctx.beginPath();
          ctx.ellipse(px, py, r * 0.6, r, i, 0, Math.PI * 1.7);
          ctx.fill();
          ctx.stroke();
        }
      }),
      color: 0x000000,
    }));
    moon.position.set(x, y, z);
    moon.rotation.y = -1.2;
    return moon;
  }

  buildRoom() {
    const s = this.scene;
    const tiles = canvasTexture(256, (ctx, size) => {
      const h = size / 2;
      ctx.fillStyle = '#262a52';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#2f3566';
      ctx.fillRect(0, 0, h, h);
      ctx.fillRect(h, h, h, h);
      ctx.strokeStyle = '#1a1d3d';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, h, h);
      ctx.strokeRect(h, h, h, h);
    });
    tiles.wrapS = THREE.RepeatWrapping;
    tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(9, 9);
    const floor = mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.55, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    s.add(floor, mesh(tube(13, 12.4, 1.2, 64), mat(0x1a1d3d), 0, -0.61, 0),
      mesh(new THREE.TorusGeometry(13, 0.09, 8, 96), glow(0xb07cff, 1.2), 0, 0.05, 0).rotateX(Math.PI / 2));
    // Railing round the back of the roof.
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + (i / 26) * Math.PI;
      if (Math.abs(a - Math.PI * 1.5) < 0.2) continue;
      s.add(mesh(tube(0.06, 0.06, 1.1, 8), mat(0x4a5080, { metalness: 0.5 }), Math.cos(a) * 12.5, 0.55, Math.sin(a) * 12.5),
        mesh(ball(0.1, 10), glow(i % 2 ? 0x7fe9ff : 0xff7ad1, 1.15), Math.cos(a) * 12.5, 1.15, Math.sin(a) * 12.5));
    }

    // The stage.
    s.add(mesh(tube(3.2, 3.4, STAGE_TOP, 64), mat(0x3a3f66, { roughness: 0.4, metalness: 0.3 }), 0, STAGE_TOP / 2, 0),
      mesh(tube(3.05, 3.05, 0.02, 64), mat(0x20233f, { roughness: 0.3, metalness: 0.4 }), 0, STAGE_TOP, 0),
      mesh(new THREE.TorusGeometry(3.22, 0.06, 8, 96), glow(0x7fe9ff, 1.4), 0, STAGE_TOP, 0).rotateX(Math.PI / 2));
    this.bench = new THREE.Group();
    this.bench.position.y = STAGE_TOP + 0.01;
    this.bench.scale.setScalar(1.2);
    s.add(this.bench);

    // Shelves of glowing potions either side.
    this.potions = [];
    for (const side of [-1, 1]) {
      const rack = new THREE.Group();
      rack.position.set(side * 7.4, 0, -4.2);
      rack.rotation.y = -side * 0.55;
      rack.add(mesh(box(3.2, 0.12, 0.8), mat(0x4a3a6e), 0, 1.1, 0), mesh(box(3.2, 0.12, 0.8), mat(0x4a3a6e), 0, 2.3, 0));
      for (const x of [-1.5, 1.5]) rack.add(mesh(box(0.14, 2.5, 0.8), mat(0x3a2d5a), x, 1.25, 0));
      const colours = [0x6fff8f, 0xff7ad1, 0x7fe9ff, 0xffe14d, 0xb07cff, 0xff8a3d];
      for (let i = 0; i < 8; i++) {
        const c = colours[(i + (side > 0 ? 2 : 0)) % colours.length];
        const y = i < 4 ? 1.16 : 2.36;
        const x = -1.05 + (i % 4) * 0.7;
        const round = i % 2 === 0;
        const liquid = mesh(round ? ball(0.2, 16) : new THREE.ConeGeometry(0.22, 0.4, 16), glow(c, 1.1), x, y + (round ? 0.22 : 0.2), 0);
        rack.add(liquid, mesh(round ? ball(0.24, 16) : new THREE.ConeGeometry(0.27, 0.5, 16), glass(0xffffff, 0.18), x, y + (round ? 0.24 : 0.25), 0),
          mesh(tube(0.06, 0.06, 0.22, 10, true), glass(0xffffff, 0.3), x, y + 0.55, 0));
        this.potions.push(liquid);
      }
      const lamp = new THREE.PointLight(side > 0 ? 0xff7ad1 : 0x6fff8f, 8, 10, 2);
      lamp.position.set(0, 2, 1.2);
      rack.add(lamp);
      s.add(rack);
    }

    // A Tesla coil on the right, a bubbling vat on the left.
    const coil = new THREE.Group();
    coil.position.set(8.6, 0, 0.2);
    coil.add(mesh(tube(0.7, 0.9, 0.5, 20), mat(0x2b3050), 0, 0.25, 0), mesh(tube(0.22, 0.3, 2.8, 16), metal(0xc98f2e, 0.4), 0, 1.9, 0));
    for (let i = 0; i < 12; i++) coil.add(mesh(new THREE.TorusGeometry(0.29 - i * 0.004, 0.035, 6, 20), metal(0xffb13d, 0.3), 0, 0.7 + i * 0.2, 0).rotateX(Math.PI / 2));
    coil.add(mesh(new THREE.TorusGeometry(0.5, 0.22, 14, 28), metal(0xdfe5ec, 0.15), 0, 3.4, 0).rotateX(Math.PI / 2));
    this.coilTop = new THREE.Vector3(8.6, 3.4, 0.2);
    this.arc = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xbfe9ff }));
    this.arc.visible = false;
    this.arc.frustumCulled = false;
    this.arcLight = new THREE.PointLight(0x9fd8ff, 0, 9, 2);
    this.arcLight.position.copy(this.coilTop);
    s.add(coil, this.arc, this.arcLight);

    const vat = new THREE.Group();
    vat.position.set(-8.6, 0, 0.2);
    vat.add(mesh(tube(1, 1.1, 0.4, 24), mat(0x2b3050), 0, 0.2, 0), mesh(tube(0.9, 0.9, 2.6, 24, true), glass(0xd8f3ff, 0.16), 0, 1.7, 0),
      mesh(tube(0.84, 0.84, 2.1, 24), new THREE.MeshStandardMaterial({ color: 0x6fff8f, emissive: 0x2fd65f, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 }), 0, 1.45, 0),
      mesh(tube(1, 1, 0.16, 24), mat(0x2b3050), 0, 3.05, 0));
    this.vatBubbles = [];
    for (let i = 0; i < 9; i++) {
      const bubble = mesh(ball(0.08 + (i % 3) * 0.04, 8), glow(0xd5ffe0, 1.1));
      bubble.userData = { a: i * 2.2, o: i / 9 };
      vat.add(bubble);
      this.vatBubbles.push(bubble);
    }
    s.add(vat);

    // Sparkles for the right answers.
    this.sparkPool = [];
    for (let i = 0; i < 60; i++) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true }));
      spark.visible = false;
      spark.userData = { life: 0, v: new THREE.Vector3() };
      s.add(spark);
      this.sparkPool.push(spark);
    }
  }

  buildRocket() {
    const r = new THREE.Group();
    r.position.copy(ROCKET);
    const white = mat(0xf4f6ff, { roughness: 0.3, metalness: 0.2 });
    const red = mat(0xff4d4d, { roughness: 0.3 });
    r.add(mesh(tube(0.95, 0.95, 4.2, 32), white, 0, 3.3, 0), mesh(new THREE.ConeGeometry(0.95, 1.9, 32), red, 0, 6.35, 0),
      mesh(tube(0.95, 0.7, 0.5, 32), mat(0x3a3f66, { metalness: 0.5 }), 0, 0.95, 0),
      mesh(new THREE.TorusGeometry(0.96, 0.07, 8, 32), red, 0, 4.9, 0).rotateX(Math.PI / 2));
    for (let i = 0; i < 3; i++) {
      const fin = mesh(box(0.12, 1.7, 1.1), red, 0, 1.6, 0);
      const holder = new THREE.Group();
      fin.position.set(0, 1.6, 1.25);
      fin.rotation.x = -0.25;
      holder.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 3;
      holder.add(fin);
      r.add(holder);
    }
    const porthole = mesh(tube(0.36, 0.36, 0.12, 24), mat(0x3a3f66, { metalness: 0.6 }), 0, 4.2, 0.92).rotateX(Math.PI / 2);
    r.add(porthole, mesh(tube(0.27, 0.27, 0.14, 24), glow(0x7fe9ff, 1.3), 0, 4.2, 0.93).rotateX(Math.PI / 2));
    // The fuel gauge: a glass strip down the front that fills as the team scores.
    r.add(mesh(box(0.34, 2.3, 0.08), mat(0x151833), 0, 2.45, 0.93));
    this.fuelBar = mesh(box(0.24, 2.2, 0.08), glow(0x6fff8f, 2.4), 0, 2.45, 0.96);
    r.add(this.fuelBar);
    this.flame = new THREE.Group();
    this.flame.add(new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 20), glow(0xffa53d, 4)).rotateX(Math.PI).translateY(1.5),
      new THREE.Mesh(new THREE.ConeGeometry(0.34, 2, 16), glow(0xfff3b0, 5)).rotateX(Math.PI).translateY(1));
    this.flame.position.y = 0.7;
    this.flame.visible = false;
    this.flameLight = new THREE.PointLight(0xffa53d, 0, 30, 2);
    this.flameLight.position.y = -1;
    r.add(this.flame, this.flameLight);
    this.rocket = r;
    this.scene.add(r, mesh(tube(1.9, 2.1, 0.3, 32), mat(0x3a3f66, { metalness: 0.4 }), ROCKET.x, 0.15, ROCKET.z));
    // Smoke and exhaust.
    this.smoke = [];
    for (let i = 0; i < 40; i++) {
      const puff = new THREE.Mesh(ball(0.5, 10), new THREE.MeshStandardMaterial({ color: 0xe8e8f4, transparent: true, opacity: 0.8, roughness: 1 }));
      puff.visible = false;
      puff.userData = { life: 0, v: new THREE.Vector3() };
      this.scene.add(puff);
      this.smoke.push(puff);
    }
    this.setFuel(0, true);
  }

  // --- What main.js asks for -----------------------------------------------------

  setPhase(phase) {
    if (phase === this.phase) return;
    const was = this.phase;
    this.phase = phase;
    if (phase !== 'final' && was === 'final') this.resetRocket();
    if (phase === 'home' || phase === 'lobby' || phase === 'final') this.clearExperiment();
    this.seat();
  }

  // players: [{ id, name, look, icon, you, status }]
  setPlayers(players) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      let a = this.avatars.get(p.id);
      if (!a) {
        a = new Avatar(p.look);
        this.avatars.set(p.id, a);
        this.scene.add(a.group);
        a.hop(0.6);
      }
      a.setLook(p.look);
      a.setName(`${p.icon} ${p.name}`, p.you);
      a.setStatus(p.status);
    }
    for (const [id, a] of this.avatars) {
      if (seen.has(id)) continue;
      this.scene.remove(a.group);
      dispose(a.group);
      this.avatars.delete(id);
    }
    this.order = players.map((p) => p.id);
    this.seat();
  }

  // Where everyone stands: on the stage between games, round the back of it
  // while an experiment is on.
  seat() {
    const n = this.order.length;
    const onStage = this.phase === 'home' || this.phase === 'lobby';
    const narrow = this.aspect < 0.9;
    this.order.forEach((id, i) => {
      const a = this.avatars.get(id);
      if (!a) return;
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      if (onStage) {
        const span = Math.min(1.5, 0.42 * (n - 1));
        const angle = Math.PI / 2 - t * span * 2 * (narrow ? 0.8 : 1);
        const radius = n > 4 ? 2.4 : 1.9;
        a.target.set(Math.cos(angle) * radius * (n === 1 ? 0 : 1), 0, (Math.sin(angle) - 1) * radius * 0.9 + 0.9);
        a.group.position.y = 0;
        a.stageLift = STAGE_TOP;
      } else if (this.phase === 'final') {
        const span = Math.min(2.2, 0.5 * (n - 1));
        const angle = -Math.PI / 2 + t * span;
        a.target.set(ROCKET.x + Math.cos(angle) * 4.2 * (n === 1 ? 0 : 1) + (n === 1 ? 3.2 : 0), 0, ROCKET.z + 4.6 + Math.sin(angle) * -1.2);
        a.stageLift = 0;
      } else {
        const span = Math.min(narrow ? 2.0 : 2.5, Math.max(1.5, 0.5 * (n - 1)));
        const angle = Math.PI * 1.5 + t * span;
        const rx = narrow ? 3.9 : 5.0;
        a.target.set(Math.cos(angle) * rx + (n === 1 ? rx * 0.82 : 0), 0, Math.sin(angle) * 4.1 + (n === 1 ? 3.2 : 0));
        a.stageLift = 0;
      }
    });
  }

  react(id, kind) {
    const a = this.avatars.get(id);
    if (!a) return;
    if (kind === 'right') {
      a.cheer();
      this.burst(a.group.position.x, 1.6, a.group.position.z, LOOKS[a.look % LOOKS.length]);
    } else if (kind === 'wrong') a.sigh();
    else a.hop(kind === 'cheer' ? 0.75 : 0.45);
  }

  burst(x, y, z, colour = '#ffe680') {
    let made = 0;
    for (const spark of this.sparkPool) {
      if (spark.userData.life > 0) continue;
      spark.userData.life = 1;
      spark.visible = true;
      spark.position.set(x, y, z);
      spark.material.color.set(made % 2 ? colour : '#ffe680');
      spark.userData.v.set((Math.random() - 0.5) * 3.2, 2.4 + Math.random() * 2.6, (Math.random() - 0.5) * 3.2);
      if (++made >= 14) break;
    }
  }

  setExperiment(exp, scene) {
    this.clearExperiment();
    try {
      this.experiment = buildExperiment(exp, scene);
    } catch (err) {
      console.error(err);
      return;
    }
    this.experiment.age = 0;
    this.experiment.group.scale.setScalar(0.001);
    this.bench.add(this.experiment.group);
  }

  clearExperiment() {
    if (!this.experiment) return;
    this.bench.remove(this.experiment.group);
    dispose(this.experiment.group);
    this.experiment = null;
  }

  // Runs the experiment; returns how many seconds until its result shows.
  reveal() {
    if (!this.experiment) return 0.5;
    this.experiment.reveal();
    return this.experiment.duration;
  }

  setFuel(fuel, now = false) {
    this.fuel = clamp01(fuel);
    if (now) this.fuelNow = this.fuel;
  }

  // The finale: the rocket flies as high as the team's fuel takes it.
  launch(fuel, onArrive) {
    const stop = milestoneFor(fuel);
    this.flight = { t: 0, height: stop.height, onArrive, arrived: false };
  }

  resetRocket() {
    this.flight = null;
    this.rocket.position.copy(ROCKET);
    this.rocket.rotation.set(0, 0, 0);
    this.flame.visible = false;
    this.flameLight.intensity = 0;
    for (const puff of this.smoke) puff.visible = false;
  }

  // Pixels at the bottom of the screen covered by the question panel.
  // `side`: pixels covered by a card at the left (positive) or right (negative).
  setInset(px, side = 0) {
    this.inset = px;
    this.side = side;
  }

  // --- Every frame ---------------------------------------------------------------

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.aspect = w / h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.seat();
  }

  aimCamera(dt) {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const open = Math.max(0.35, (this.height - this.insetNow) / this.height);
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const sway = Math.sin(this.time * 0.25);

    if (this.phase === 'final' && this.flight) {
      const y = this.rocket.position.y;
      const back = Math.max(15, 5.2 / (tan * this.aspect));
      pos.set(4 + sway * 1.5, y + 2.6, ROCKET.z + back);
      look.set(0, y + 3.4, ROCKET.z);
    } else {
      const lobby = this.phase === 'home' || this.phase === 'lobby';
      const crowd = this.order.length > 3;
      const halfW = lobby ? 3.3 : (this.aspect < 0.9 ? 4.0 : crowd ? 5.4 : 4.3);
      const halfH = lobby ? 2.2 : 2.9;
      const wide = Math.max(0.4, (this.width - Math.abs(this.sideNow)) / this.width);
      const d = Math.max(lobby ? 8 : 9, halfW / (tan * this.aspect * wide), halfH / (tan * open));
      const tilt = lobby ? 0.2 : 0.36;
      const swing = lobby ? sway * 0.4 : sway * 0.05;
      look.set(0, lobby ? 1.25 : 1.6, 0);
      pos.set(Math.sin(swing) * d * Math.cos(tilt), look.y + d * Math.sin(tilt), Math.cos(swing) * d * Math.cos(tilt));
    }
    const k = 1 - Math.exp(-dt * (this.flight ? 6 : 2.5));
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // Slide the picture up so the stage sits in the part the panel leaves clear.
    if (this.insetNow > 1 || Math.abs(this.sideNow) > 1) {
      this.camera.setViewOffset(this.width, this.height, -this.sideNow / 2, this.insetNow / 2, this.width, this.height);
    }
    else this.camera.clearViewOffset();
  }

  fly(dt) {
    const f = this.flight;
    if (!f) return;
    f.t += dt;
    const COUNTDOWN = 2.2;
    const climb = Math.min(9, 4 + f.height / 30);
    const k = clamp01((f.t - COUNTDOWN) / climb);
    const y = f.height * (k < 1 ? ease.inOut(k) * 0.999 : 1);
    const burning = f.t > COUNTDOWN - 0.7 && k < 0.97;
    this.rocket.position.set(ROCKET.x + (burning ? (Math.random() - 0.5) * 0.05 : 0), y + (k >= 1 ? Math.sin(f.t * 1.2) * 0.4 : 0), ROCKET.z);
    this.rocket.rotation.y += dt * (k > 0 ? 0.5 : 0);
    this.flame.visible = burning;
    this.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
    this.flameLight.intensity = burning ? 120 : 0;
    if (burning) {
      for (let i = 0; i < 2; i++) {
        const puff = this.smoke.find((p) => p.userData.life <= 0);
        if (!puff) break;
        puff.userData.life = 1;
        puff.visible = true;
        puff.position.set(ROCKET.x + (Math.random() - 0.5) * 0.8, Math.max(0.4, y - 0.6), ROCKET.z + (Math.random() - 0.5) * 0.8);
        const out = y < 3 ? 5 : 1;
        puff.userData.v.set((Math.random() - 0.5) * out, y < 3 ? 0.6 : -3, (Math.random() - 0.5) * out);
      }
    }
    if (k >= 1 && !f.arrived) {
      f.arrived = true;
      this.burst(ROCKET.x, y + 4, ROCKET.z);
      this.burst(ROCKET.x + 2, y + 5, ROCKET.z);
      this.burst(ROCKET.x - 2, y + 5, ROCKET.z);
      f.onArrive?.();
    }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.watchSpeed(now - this.last);
    this.last = now;
    this.time += dt;
    const time = this.time;

    this.insetNow = lerp(this.insetNow, this.inset, 1 - Math.exp(-dt * 6));
    this.sideNow = lerp(this.sideNow, this.side, 1 - Math.exp(-dt * 6));
    this.aimCamera(dt);

    for (const a of this.avatars.values()) {
      a.update(dt, time, this.camera);
      a.group.position.y = lerp(a.liftNow || 0, a.stageLift || 0, 1 - Math.exp(-dt * 5));
      a.liftNow = a.group.position.y;
    }

    if (this.experiment) {
      const e = this.experiment;
      e.age += dt;
      e.group.scale.setScalar(ease.back(clamp01(e.age / 0.6)) * (e.group.userData.size || 1));
      // In small steps, so a slow frame doesn't upset the physics.
      const steps = Math.ceil(dt / 0.034);
      for (let i = 1; i <= steps; i++) e.tick(dt / steps, time - dt + (dt * i) / steps);
    }

    this.fuelNow = lerp(this.fuelNow, this.fuel, 1 - Math.exp(-dt * 2));
    const fill = Math.max(0.02, this.fuelNow);
    this.fuelBar.scale.y = fill;
    this.fuelBar.position.y = 1.35 + 1.1 * fill;
    this.fly(dt);

    this.potions.forEach((p, i) => { p.material.emissiveIntensity = 1.15 + Math.sin(time * 2 + i) * 0.35; });
    for (const bubble of this.vatBubbles) {
      const k = (time * 0.25 + bubble.userData.o) % 1;
      bubble.position.set(Math.cos(bubble.userData.a) * 0.5, 0.5 + k * 2, Math.sin(bubble.userData.a) * 0.5);
    }
    // The coil crackles now and then.
    const zap = Math.sin(time * 1.3) > 0.93 || Math.sin(time * 0.37 + 1) > 0.985;
    this.arc.visible = zap;
    this.arcLight.intensity = zap ? 30 + Math.random() * 30 : 0;
    if (zap) {
      const arr = this.arc.geometry.attributes.position;
      const a = Math.floor(time * 3) * 1.7;
      for (let i = 0; i < 10; i++) {
        const k = i / 9;
        arr.setXYZ(i, this.coilTop.x + Math.cos(a) * k * 2 + (Math.random() - 0.5) * 0.35 * Math.sin(k * Math.PI),
          this.coilTop.y + k * 0.4 + (Math.random() - 0.5) * 0.5 * Math.sin(k * Math.PI),
          this.coilTop.z + Math.sin(a) * k * 2 + (Math.random() - 0.5) * 0.35);
      }
      arr.needsUpdate = true;
    }

    for (const spark of this.sparkPool) {
      const u = spark.userData;
      if (u.life <= 0) continue;
      u.life -= dt * 0.9;
      u.v.y -= 6 * dt;
      spark.position.addScaledVector(u.v, dt);
      spark.rotation.x += dt * 6;
      spark.rotation.y += dt * 4;
      spark.material.opacity = clamp01(u.life * 2);
      spark.visible = u.life > 0;
    }
    for (const puff of this.smoke) {
      const u = puff.userData;
      if (u.life <= 0) continue;
      u.life -= dt * 0.55;
      puff.position.addScaledVector(u.v, dt);
      puff.scale.setScalar(1 + (1 - u.life) * 3.5);
      puff.material.opacity = clamp01(u.life) * 0.75;
      puff.visible = u.life > 0;
    }

    if (this.bloomOn) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // On a slow device, give up the glow first, then the sharpness.
  watchSpeed(ms) {
    if (document.hidden || ms > 500) return;
    this.frames += 1;
    if (this.frames < 90) return;
    this.slowFor = ms > 42 ? this.slowFor + 1 : Math.max(0, this.slowFor - 2);
    if (this.slowFor < 70) return;
    this.slowFor = 0;
    if (this.bloomOn) this.bloomOn = false;
    else if (this.pixelRatio > 1) {
      this.pixelRatio = 1;
      this.resize();
    } else if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
  }
}

// When the 3D lab can't start (no WebGL), the game still plays in its panels.
export class NoLab {
  setPhase() {}
  setPlayers() {}
  react() {}
  setExperiment() {}
  clearExperiment() {}
  reveal() { return 0.8; }
  setFuel() {}
  launch(fuel, onArrive) { setTimeout(() => onArrive?.(), 600); }
  resetRocket() {}
  setInset() {}
  burst() {}
}
