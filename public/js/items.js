// The things that turn up on the lab bench: makeItem('duck') gives a small
// model, about half a unit across, centred on its own middle.
import * as THREE from 'three';
import { mat, metal, glass, mesh, box, ball, tube, canvasTexture } from './kit.js';

const SILVER = 0xd5dbe3;

const MAKERS = {
  duck(g) {
    const yellow = mat(0xffd21f, { roughness: 0.35 });
    const body = mesh(ball(0.2), yellow);
    body.scale.set(1.25, 0.9, 1);
    const head = mesh(ball(0.13), yellow, 0.16, 0.2, 0);
    const beak = mesh(new THREE.ConeGeometry(0.06, 0.12, 12), mat(0xff7a1a), 0.3, 0.18, 0);
    beak.rotation.z = -Math.PI / 2;
    const tail = mesh(new THREE.ConeGeometry(0.07, 0.14, 10), yellow, -0.24, 0.08, 0);
    tail.rotation.z = 0.9;
    g.add(body, head, beak, tail);
    for (const z of [-0.07, 0.07]) g.add(mesh(ball(0.025, 8), mat(0x111111), 0.25, 0.25, z));
  },
  stone(g) {
    const m = mesh(new THREE.DodecahedronGeometry(0.25), mat(0x8a8f98, { flatShading: true, roughness: 0.9 }));
    m.scale.set(1.15, 0.8, 0.95);
    g.add(m);
  },
  wood(g) {
    g.add(mesh(box(0.46, 0.3, 0.3), mat(0xb9793d, { roughness: 0.8 })));
    for (const y of [-0.07, 0.05]) g.add(mesh(box(0.465, 0.02, 0.305), mat(0x8d5524), 0, y, 0));
  },
  coin(g) {
    const c = mesh(tube(0.22, 0.22, 0.045, 32), metal(0xf2b632, 0.25));
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), metal(0xd99a1c, 0.3));
    rim.rotation.x = Math.PI / 2;
    const tilt = new THREE.Group();
    tilt.add(c, rim);
    tilt.rotation.set(1.15, 0, 0.3);
    g.add(tilt);
  },
  ice(g) {
    const m = mesh(box(0.36, 0.36, 0.36), new THREE.MeshStandardMaterial({
      color: 0xdff6ff, transparent: true, opacity: 0.7, roughness: 0.08, metalness: 0.1,
    }));
    m.castShadow = true;
    g.add(m, mesh(box(0.2, 0.2, 0.2), mat(0xffffff, { transparent: true, opacity: 0.5 })));
  },
  apple(g) {
    const a = mesh(ball(0.22), mat(0xe02b2b, { roughness: 0.3 }));
    a.scale.set(1, 0.9, 1);
    const stalk = mesh(tube(0.012, 0.016, 0.12, 6), mat(0x5b3a1e), 0, 0.23, 0);
    const leaf = mesh(ball(0.07, 10), mat(0x3fae49), 0.07, 0.25, 0);
    leaf.scale.set(1, 0.2, 0.5);
    g.add(a, stalk, leaf);
  },
  cork(g) {
    g.add(mesh(tube(0.13, 0.15, 0.3, 20), mat(0xcfa26b, { roughness: 0.95 })));
  },
  steel(g) {
    g.add(mesh(ball(0.2, 32), metal(0xcfd6de, 0.15)));
  },
  grape(g) {
    g.add(mesh(ball(0.13), mat(0x7b3fc4, { roughness: 0.25 })), mesh(tube(0.01, 0.012, 0.08, 6), mat(0x5b7a2e), 0, 0.15, 0));
  },
  egg(g) {
    const e = mesh(ball(0.17), mat(0xf6e7cf, { roughness: 0.6 }));
    e.scale.set(1, 1.3, 1);
    g.add(e);
  },
  brick(g) {
    g.add(mesh(box(0.46, 0.2, 0.24), mat(0xb5462f, { roughness: 0.9 })));
    for (const x of [-0.11, 0.11]) g.add(mesh(box(0.14, 0.205, 0.1), mat(0x8e3320), x, 0, 0));
  },
  ball(g) {
    const stripes = canvasTexture(256, (ctx, s) => {
      const colours = ['#ff4d4d', '#ffffff', '#ffd23f', '#ffffff', '#3fa9ff', '#ffffff'];
      colours.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect((i * s) / 6, 0, s / 6 + 1, s);
      });
    });
    g.add(mesh(ball(0.28, 32), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.3 })));
  },
  marble(g) {
    const m = mesh(ball(0.13), new THREE.MeshStandardMaterial({
      color: 0x4fc3f7, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.2,
    }));
    m.castShadow = true;
    const swirl = mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 16), mat(0xff5fa2));
    g.add(m, swirl);
  },
  candle(g) {
    g.add(mesh(tube(0.09, 0.09, 0.4, 20), mat(0xf7efd8, { roughness: 0.4 })),
      mesh(tube(0.008, 0.008, 0.07, 6), mat(0x222222), 0, 0.23, 0));
  },
  gold(g) {
    const bar = mesh(tube(0.2, 0.3, 0.18, 4), metal(0xffc531, 0.2));
    bar.rotation.y = Math.PI / 4;
    bar.scale.set(1.3, 1, 0.7);
    g.add(bar);
  },
  feather(g) {
    const vane = mesh(ball(0.3, 16), mat(0xf4f6ff, { roughness: 0.9 }));
    vane.scale.set(0.3, 0.03, 1);
    const quill = mesh(tube(0.01, 0.014, 0.7, 6), mat(0xd9c9a3));
    quill.rotation.x = Math.PI / 2;
    const tip = mesh(ball(0.1, 12), mat(0x7ad7ff));
    tip.scale.set(0.5, 0.05, 1);
    tip.position.z = -0.24;
    g.add(vane, quill, tip);
    g.rotation.set(0.2, 0.6, 0.15);
  },
  bowling(g) {
    g.add(mesh(ball(0.27, 32), mat(0x2233aa, { roughness: 0.12, metalness: 0.3 })));
    for (const [x, y] of [[-0.05, 0.1], [0.05, 0.1], [0, 0.02]]) {
      const hole = mesh(tube(0.03, 0.03, 0.02, 12), mat(0x05060f), x, y, 0.255);
      hole.rotation.x = Math.PI / 2;
      g.add(hole);
    }
  },
  hammer(g) {
    g.add(mesh(tube(0.03, 0.035, 0.5, 10), mat(0xa9713a), 0, -0.05, 0), mesh(box(0.3, 0.12, 0.12), metal(0x9aa3ad, 0.35), 0, 0.22, 0));
    g.rotation.z = 0.3;
  },
  tennis(g) {
    g.add(mesh(ball(0.15), mat(0xd7f23a, { roughness: 0.9 })));
    const seam = mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 32), mat(0xffffff));
    seam.rotation.set(0.9, 0.4, 0);
    g.add(seam);
  },
  cannon(g) {
    g.add(mesh(ball(0.24, 32), mat(0x2a2d33, { roughness: 0.35, metalness: 0.7 })));
  },
  paper(g) {
    g.add(mesh(box(0.42, 0.008, 0.56), mat(0xfbfbfb, { roughness: 0.9 })));
    for (let i = -2; i <= 2; i++) g.add(mesh(box(0.3, 0.009, 0.012), mat(0x9fb8e8), 0, 0.001, i * 0.09));
  },
  crumple(g) {
    g.add(mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(0xf4f4f4, { flatShading: true, roughness: 0.95 })));
  },
  leaf(g) {
    const blade = mesh(ball(0.26, 16), mat(0x4caf50, { roughness: 0.7 }));
    blade.scale.set(0.6, 0.03, 1);
    const stem = mesh(tube(0.008, 0.008, 0.62, 6), mat(0x2e7d32));
    stem.rotation.x = Math.PI / 2;
    g.add(blade, stem);
    g.rotation.set(0.3, 0.5, 0.2);
  },
  clip(g) {
    const wire = metal(SILVER, 0.25);
    const outer = mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24), wire);
    outer.scale.set(1, 2.1, 1);
    const inner = mesh(new THREE.TorusGeometry(0.065, 0.014, 8, 24), wire, 0, -0.03, 0);
    inner.scale.set(1, 2.1, 1);
    g.add(outer, inner);
    g.rotation.x = -1.2;
  },
  nail(g) {
    const steel = metal(0x9ea7b3, 0.35);
    const shaft = mesh(tube(0.022, 0.022, 0.5, 10), steel);
    const head = mesh(tube(0.06, 0.06, 0.02, 14), steel, 0, 0.25, 0);
    const point = mesh(new THREE.ConeGeometry(0.022, 0.07, 10), steel, 0, -0.285, 0);
    point.rotation.x = Math.PI;
    g.add(shaft, head, point);
    g.rotation.z = Math.PI / 2 - 0.15;
  },
  bolt(g) {
    const steel = metal(0xb4bcc7, 0.3);
    g.add(mesh(tube(0.11, 0.11, 0.09, 6), steel, 0, 0.16, 0), mesh(tube(0.055, 0.055, 0.36, 12), steel, 0, -0.06, 0));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.TorusGeometry(0.057, 0.008, 6, 14), metal(0x8d96a3), 0, -0.2 + i * 0.05, 0).rotateX(Math.PI / 2));
    g.rotation.z = Math.PI / 2 - 0.2;
  },
  scissors(g) {
    const steel = metal(SILVER, 0.2);
    for (const s of [-1, 1]) {
      const half = new THREE.Group();
      half.add(mesh(box(0.05, 0.36, 0.012), steel, 0, 0.14, 0));
      const handle = mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 20), mat(0xe53935), 0, -0.12, 0);
      half.add(handle);
      half.rotation.z = s * 0.22;
      half.position.z = s * 0.008;
      g.add(half);
    }
    g.rotation.x = -1.25;
  },
  lego(g) {
    const red = mat(0xe53935, { roughness: 0.25 });
    g.add(mesh(box(0.42, 0.2, 0.22), red));
    for (const x of [-0.105, 0.105]) g.add(mesh(tube(0.06, 0.06, 0.05, 16), red, x, 0.12, 0));
  },
  can(g) {
    g.add(mesh(tube(0.13, 0.13, 0.36, 24), mat(0xe53935, { roughness: 0.25, metalness: 0.6 })),
      mesh(tube(0.115, 0.13, 0.03, 24), metal(SILVER), 0, 0.195, 0),
      mesh(tube(0.13, 0.115, 0.03, 24), metal(SILVER), 0, -0.195, 0),
      mesh(tube(0.132, 0.132, 0.1, 24), mat(0xffffff, { roughness: 0.3 }), 0, 0.02, 0));
  },
  ring(g) {
    const band = mesh(new THREE.TorusGeometry(0.15, 0.035, 12, 32), metal(0xffc531, 0.15));
    const gem = mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({
      color: 0x7fe9ff, emissive: 0x2299cc, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.3,
    }), 0, 0.2, 0);
    g.add(band, gem);
  },
  foil(g) {
    g.add(mesh(new THREE.IcosahedronGeometry(0.19, 1), new THREE.MeshStandardMaterial({
      color: 0xe3e8ee, metalness: 0.95, roughness: 0.3, flatShading: true,
    })));
  },
  spoon(g) {
    const steel = metal(SILVER, 0.18);
    const bowl = mesh(ball(0.11), steel, 0.22, 0, 0);
    bowl.scale.set(1.3, 0.3, 1);
    g.add(bowl, mesh(box(0.42, 0.02, 0.04), steel, -0.08, 0, 0));
  },
  pencil(g) {
    const body = mesh(tube(0.035, 0.035, 0.46, 6), mat(0xffc400, { roughness: 0.4 }));
    const dark = mat(0x333333, { roughness: 0.3 });
    const wood = mat(0xe8c79a);
    for (const s of [-1, 1]) {
      const cone = mesh(new THREE.ConeGeometry(0.035, 0.09, 6), wood, 0, s * 0.275, 0);
      const tip = mesh(new THREE.ConeGeometry(0.014, 0.036, 6), dark, 0, s * 0.302, 0);
      if (s < 0) {
        cone.rotation.x = Math.PI;
        tip.rotation.x = Math.PI;
      }
      g.add(cone, tip);
    }
    g.add(body);
    g.rotation.z = Math.PI / 2;
  },
  saltwater(g) {
    beaker(g, 0x7fd6e8, true);
  },
  purewater(g) {
    beaker(g, 0x9fdcff, false);
  },
};

function beaker(g, colour, salty) {
  g.add(mesh(tube(0.24, 0.22, 0.42, 24, true), glass(0xe8f8ff, 0.3)),
    mesh(tube(0.215, 0.2, 0.3, 24), new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: 0.6, roughness: 0.1 }), 0, -0.05, 0),
    mesh(tube(0.22, 0.22, 0.02, 24), glass(0xe8f8ff, 0.4), 0, -0.21, 0));
  if (salty) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      g.add(mesh(box(0.02, 0.02, 0.02), mat(0xffffff), Math.cos(a) * 0.12 * ((i % 3) / 2), -0.18 + (i % 4) * 0.012, Math.sin(a) * 0.12 * ((i % 3) / 2)));
    }
  }
}

export function makeItem(kind) {
  const g = new THREE.Group();
  (MAKERS[kind] || MAKERS.stone)(g);
  // A holder, so callers can move and spin the item without losing its pose.
  const holder = new THREE.Group();
  holder.add(g);
  holder.userData.kind = kind;
  return holder;
}
