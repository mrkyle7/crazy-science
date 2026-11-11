// The seven experiments. Each builder takes the question's `scene` and gives
//   { group, tick(dt, time), reveal(), duration }
// `group` sits on the stage (y = 0 is the stage top), `reveal()` runs the
// experiment, and `duration` is how many seconds until its result shows.
import * as THREE from 'three';
import { Timeline, ease, clamp01, lerp, mat, metal, glow, glass, mesh, box, ball, tube, label, pop } from './kit.js';
import { makeItem } from './items.js';

function base() {
  const group = new THREE.Group();
  const tl = new Timeline();
  const tickers = [];
  return {
    group, tl, tickers,
    // The timeline only runs once the experiment does, so anything put on it
    // while building happens that long after reveal().
    finish(reveal, duration) {
      let started = false;
      return {
        group, duration,
        reveal() {
          if (started) return;
          started = true;
          reveal();
        },
        tick(dt, time) {
          if (started) tl.update(dt);
          for (const fn of tickers) fn(dt, time);
        },
      };
    },
  };
}

function popLabel(b, sprite, at) {
  pop(sprite, 0);
  b.tl.at(at, 0.45, (k) => pop(sprite, k), ease.back);
}

// --- Float or sink ---------------------------------------------------------------

function float(scene) {
  const b = base();
  const W = 3.4; const D = 1.5; const H = 1.9; const level = 1.3;
  const liquid = scene.liquid;
  const opaque = liquid.d > 5;

  b.group.add(mesh(box(W + 0.2, 0.08, D + 0.2), mat(0x2b3050), 0, 0.04, 0));
  const tank = mesh(box(W, H, D), glass(0xd8f3ff, 0.14), 0, 0.08 + H / 2, 0);
  b.group.add(tank);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box(W, H, D)), new THREE.LineBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.7 }));
  edges.position.copy(tank.position);
  b.group.add(edges);

  const water = mesh(box(W - 0.06, level, D - 0.06), new THREE.MeshStandardMaterial({
    color: liquid.color, transparent: !opaque, opacity: opaque ? 1 : 0.5, roughness: opaque ? 0.15 : 0.08,
    metalness: opaque ? 0.95 : 0.1, depthWrite: opaque,
  }), 0, 0.08 + level / 2, 0);
  water.castShadow = false;
  b.group.add(water);
  const surfaceY = 0.08 + level;
  const name = label(liquid.name, { height: 0.26, color: '#dff6ff' });
  name.position.set(0, 0.42, D / 2 + 0.05);
  b.group.add(name);

  // Bubbles drifting up, for life.
  const bubbles = [];
  if (!opaque) {
    for (let i = 0; i < 10; i++) {
      const s = mesh(ball(0.03 + (i % 3) * 0.012, 8), glass(0xffffff, 0.5));
      s.userData = { x: (Math.random() - 0.5) * (W - 0.4), z: (Math.random() - 0.5) * (D - 0.4), o: Math.random() };
      bubbles.push(s);
      b.group.add(s);
    }
    b.tickers.push((dt, time) => {
      for (const s of bubbles) {
        const k = (time * 0.18 + s.userData.o) % 1;
        s.position.set(s.userData.x + Math.sin(time * 2 + s.userData.o * 9) * 0.03, 0.12 + k * (level - 0.1), s.userData.z);
      }
    });
  }

  const n = scene.objects.length;
  const things = scene.objects.map((o, i) => {
    const item = makeItem(o.kind);
    const x = n === 1 ? 0 : (i - (n - 1) / 2) * 1.05;
    item.position.set(x, 2.75, 0);
    b.group.add(item);
    const floats = o.d < liquid.d;
    const tag = label(floats ? 'Floats!' : 'Sinks!', { height: 0.34, color: floats ? '#8dffb0' : '#ffb08d' });
    tag.position.set(x, 3.25, 0);
    b.group.add(tag);
    pop(tag, 0);
    return { item, d: o.d, x, y: 2.75, v: 0, falling: false, phase: i * 1.7, splashed: false, tag, r: 0.22 };
  });

  const splashes = [];
  function splash(x) {
    for (let i = 0; i < 9; i++) {
      const drop = mesh(ball(0.04, 6), mat(liquid.color, { roughness: 0.1 }), x, surfaceY, 0);
      const a = (i / 9) * Math.PI * 2;
      drop.userData = { vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.5, vy: 2.2 + Math.random(), life: 0 };
      splashes.push(drop);
      b.group.add(drop);
    }
  }

  const GRAV = 14;
  b.tickers.push((dt, time) => {
    const step = Math.min(dt, 0.033);
    for (const t of things) {
      if (!t.falling) {
        t.item.position.y = 2.75 + Math.sin(time * 2 + t.phase) * 0.06;
        t.item.rotation.y += dt * 0.6;
        continue;
      }
      const sub = clamp01((surfaceY - (t.y - t.r)) / (2 * t.r));
      let ratio = liquid.d / t.d;
      if (ratio < 1) ratio = Math.min(ratio, 0.8); // sinks at a watchable pace
      const a = Math.max(-GRAV, Math.min(GRAV * 3, -GRAV + GRAV * ratio * sub));
      t.v += a * step;
      t.v *= 1 - Math.min(0.9, 3.4 * sub * step);
      t.y += t.v * step;
      const floor = 0.08 + t.r + 0.02;
      if (t.y < floor) {
        t.y = floor;
        t.v = 0;
      }
      if (sub > 0 && !t.splashed) {
        t.splashed = true;
        splash(t.x);
      }
      t.item.position.y = t.y;
      t.item.rotation.z = Math.sin(time * 1.7 + t.phase) * 0.08 * sub;
    }
    for (const d of splashes) {
      d.userData.life += step;
      d.userData.vy -= 9 * step;
      d.position.x += d.userData.vx * step;
      d.position.z += d.userData.vz * step;
      d.position.y += d.userData.vy * step;
      d.visible = d.position.y > surfaceY - 0.05 && d.userData.life < 1.2;
    }
  });

  return b.finish(() => {
    things.forEach((t, i) => {
      b.tl.at(0.3 + i * 0.35, 0, () => { t.falling = true; t.y = t.item.position.y; });
      b.tl.at(3.6, 0.45, (k) => {
        pop(t.tag, k);
        t.tag.position.y = Math.max(t.item.position.y + 0.55, surfaceY + 0.45);
      }, ease.back);
    });
  }, 4);
}

// --- Colour lab ------------------------------------------------------------------

function flask(colour) {
  const g = new THREE.Group();
  const liquidMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.2, emissive: colour, emissiveIntensity: 0.25 });
  const liquid = mesh(new THREE.ConeGeometry(0.3, 0.42, 24), liquidMat, 0, 0.24, 0);
  g.add(liquid, mesh(new THREE.ConeGeometry(0.36, 0.62, 24, 1, true), glass(0xe8f8ff, 0.3), 0, 0.33, 0),
    mesh(tube(0.09, 0.09, 0.3, 16, true), glass(0xe8f8ff, 0.3), 0, 0.72, 0),
    mesh(new THREE.TorusGeometry(0.095, 0.02, 8, 20), glass(0xe8f8ff, 0.6), 0, 0.87, 0).rotateX(Math.PI / 2));
  g.userData.liquid = liquid;
  return g;
}

function paint(scene) {
  const b = base();
  const iron = mat(0x2a2d3a, { roughness: 0.5, metalness: 0.6 });
  const pot = mesh(new THREE.SphereGeometry(0.85, 32, 20, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), iron, 0, 0.85, 0);
  pot.material.side = THREE.DoubleSide;
  const rim = mesh(new THREE.TorusGeometry(0.72, 0.07, 12, 32), iron, 0, 1.3, 0).rotateX(Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.group.add(mesh(tube(0.07, 0.05, 0.3, 8), iron, Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5));
  }
  const brewMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ee, roughness: 0.25, emissive: 0x000000, emissiveIntensity: 0.5 });
  const brew = mesh(tube(0.7, 0.7, 0.04, 32), brewMat, 0, 1.22, 0);
  b.group.add(pot, rim, brew);

  const from = new THREE.Color(0xe9e9ee);
  const to = new THREE.Color(scene.result);
  const sides = [[-1, scene.a], [1, scene.b]].map(([s, colour]) => {
    const holder = new THREE.Group();
    holder.position.set(s * 1.55, 2.05, 0);
    const f = flask(colour);
    f.position.y = -0.4;
    holder.add(f);
    const stream = mesh(tube(0.05, 0.035, 1, 10), new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.4, roughness: 0.2 }));
    stream.visible = false;
    b.group.add(holder, stream);
    return { s, holder, f, stream };
  });

  const pops = [];
  for (let i = 0; i < 12; i++) {
    const p = mesh(ball(0.07 + (i % 3) * 0.03, 10), new THREE.MeshStandardMaterial({ color: scene.result, emissive: scene.result, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
    p.visible = false;
    p.userData = { a: i * 2.1, o: i / 12 };
    pops.push(p);
    b.group.add(p);
  }
  let bubbling = false;
  b.tickers.push((dt, time) => {
    sides.forEach((side, i) => {
      if (!side.tilted) side.holder.position.y = 2.05 + Math.sin(time * 1.8 + i * 2) * 0.05;
    });
    if (!bubbling) return;
    for (const p of pops) {
      const k = (time * 0.45 + p.userData.o) % 1;
      p.visible = true;
      p.position.set(Math.cos(p.userData.a) * 0.4 * (0.4 + p.userData.o), 1.25 + k * 1.5, Math.sin(p.userData.a) * 0.4 * (0.4 + p.userData.o));
      p.scale.setScalar((1 - k) * 1.1 + 0.05);
    }
  });

  return b.finish(() => {
    for (const side of sides) {
      side.tilted = true;
      b.tl.at(0.2, 0.9, (k) => {
        side.holder.rotation.z = side.s * k * 1.95;
        side.holder.position.x = side.s * lerp(1.55, 0.95, k);
      });
      b.tl.at(0.9, 0.3, (k) => {
        side.stream.visible = true;
        const top = 2.0; const bottom = lerp(top, 1.25, k);
        side.stream.scale.y = Math.max(0.01, top - bottom);
        side.stream.position.set(side.s * 0.42, (top + bottom) / 2, 0);
      }, ease.linear);
      b.tl.at(1.2, 1.5, (k) => {
        side.f.userData.liquid.scale.setScalar(Math.max(0.02, 1 - k));
      }, ease.linear);
      b.tl.at(2.7, 0.25, (k) => {
        side.stream.scale.y = Math.max(0.01, 0.75 * (1 - k));
        side.stream.position.y = 1.25 + 0.375 * (1 - k);
        if (k >= 1) side.stream.visible = false;
      }, ease.linear);
    }
    b.tl.at(1.2, 1.8, (k) => {
      brewMat.color.copy(from).lerp(to, k);
      brewMat.emissive.copy(to).multiplyScalar(k * 0.5);
    });
    b.tl.at(2.2, 0, () => { bubbling = true; });
  }, 3.4);
}

function lights(scene) {
  const b = base();
  const screen = mesh(box(3.6, 2.5, 0.08), mat(0x14151f, { roughness: 0.95 }), 0, 1.75, -0.7);
  const frame = mesh(box(3.8, 2.7, 0.06), mat(0x3a3f66), 0, 1.75, -0.76);
  b.group.add(screen, frame);
  const n = scene.lights.length;
  const R = 0.72;
  const spots = scene.lights.map((colour, i) => {
    const apart = n === 2 ? [[-0.95, 0], [0.95, 0]][i] : [[-1.15, 0.3], [0, -0.3], [1.15, 0.3]][i];
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const close = n === 2 ? [[-0.36, 0], [0.36, 0]][i] : [Math.cos(a) * 0.4, -Math.sin(a) * 0.4];
    const material = new THREE.MeshBasicMaterial({ color: colour, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), material);
    disc.position.set(apart[0], 1.75 + apart[1], -0.65 + i * 0.002);
    const lamp = new THREE.Group();
    lamp.add(mesh(tube(0.16, 0.1, 0.34, 16), mat(0x2b2f45, { metalness: 0.5 })), mesh(tube(0.14, 0.14, 0.03, 16), glow(colour, 2.2), 0, 0.17, 0));
    lamp.position.set((i - (n - 1) / 2) * 1.1, 0.35, 1.1);
    lamp.lookAt(disc.position);
    lamp.rotateX(Math.PI / 2);
    b.group.add(disc, lamp, mesh(tube(0.03, 0.03, 0.3, 8), mat(0x2b2f45), lamp.position.x, 0.15, 1.1));
    return { disc, apart, close, lamp };
  });
  return b.finish(() => {
    for (const s of spots) {
      b.tl.at(0.4, 1.8, (k) => {
        s.disc.position.x = lerp(s.apart[0], s.close[0], k);
        s.disc.position.y = 1.75 + lerp(s.apart[1], s.close[1], k);
        s.lamp.lookAt(s.disc.getWorldPosition(new THREE.Vector3()));
        s.lamp.rotateX(Math.PI / 2);
      });
    }
  }, 2.6);
}

function filters(scene) {
  const b = base();
  const lamp = new THREE.Group();
  lamp.add(mesh(tube(0.22, 0.3, 0.5, 20), mat(0x2b2f45, { metalness: 0.5 })).rotateZ(Math.PI / 2), mesh(ball(0.16), glow(0xffffff, 0.2), 0.2, 0, 0));
  lamp.position.set(-2.2, 1.5, 0);
  b.group.add(lamp, mesh(tube(0.05, 0.08, 1.3, 10), mat(0x2b2f45), -2.3, 0.65, 0));
  const bulb = lamp.children[1].material;

  const xs = [-0.9, 0.4];
  scene.filters.forEach((colour, i) => {
    b.group.add(mesh(box(0.06, 1.3, 1.1), new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: 0.55, roughness: 0.1, emissive: colour, emissiveIntensity: 0.15 }), xs[i], 1.5, 0),
      mesh(box(0.14, 0.12, 1.2), mat(0x3a3f66), xs[i], 0.8, 0), mesh(box(0.1, 0.8, 0.1), mat(0x3a3f66), xs[i], 0.4, 0));
  });
  const screen = mesh(box(0.08, 1.7, 1.5), mat(0x14151f, { roughness: 0.95 }), 2.2, 1.5, 0);
  screen.rotation.y = -0.6;
  b.group.add(screen, mesh(box(0.1, 0.7, 0.1), mat(0x3a3f66), 2.2, 0.35, 0));

  const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const stops = [-2.0, xs[0], xs[1], 2.15];
  const colours = ['#ffffff', scene.filters[0], scene.result];
  const beams = colours.map((c, i) => {
    const m = new THREE.Mesh(tube(0.2, 0.2, 1, 20, true), beamMat(c));
    m.rotation.z = Math.PI / 2;
    m.visible = false;
    b.group.add(m);
    return { m, from: stops[i], to: stops[i + 1], dark: c === '#000000' };
  });
  const dark = scene.result === '#000000';
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshBasicMaterial({ color: scene.result, toneMapped: false }));
  spot.position.set(2.14, 1.5, 0.03);
  spot.rotation.y = -Math.PI / 2 - 0.6;
  spot.visible = false;
  b.group.add(spot);
  const none = label('No light gets through!', { height: 0.32, color: '#ffd9a8' });
  none.position.set(1.3, 2.75, 0);
  b.group.add(none);
  pop(none, 0);

  return b.finish(() => {
    b.tl.at(0.2, 0.3, (k) => { bulb.emissiveIntensity = 0.2 + k * 3; });
    beams.forEach((beam, i) => {
      if (beam.dark) return;
      b.tl.at(0.5 + i * 0.8, 0.7, (k) => {
        beam.m.visible = true;
        const len = Math.max(0.01, (beam.to - beam.from) * k);
        beam.m.scale.y = len;
        beam.m.position.set(beam.from + len / 2, 1.5, 0);
      }, ease.linear);
    });
    if (dark) popLabel(b, none, 2.3);
    else b.tl.at(2.8, 0, () => { spot.visible = true; });
  }, 3);
}

function colour(scene) {
  if (scene.mode === 'light') return lights(scene);
  if (scene.mode === 'filter') return filters(scene);
  return paint(scene);
}

// --- Gravity drop ----------------------------------------------------------------

const PLACE = { earth: 'Earth', moon: 'Moon', jupiter: 'Jupiter' };

function drop(scene) {
  const b = base();
  const TOP = 3.3;
  const frame = mat(0x4a5080, { metalness: 0.4, roughness: 0.4 });
  for (const x of [-1.9, 1.9]) b.group.add(mesh(tube(0.07, 0.09, TOP + 0.35, 12), frame, x, (TOP + 0.35) / 2, -0.3));
  b.group.add(mesh(box(4, 0.14, 0.2), frame, 0, TOP + 0.4, -0.3));
  for (let i = 1; i <= 5; i++) b.group.add(mesh(box(0.2, 0.025, 0.03), glow(0x7fe9ff, 1.2), -1.9, (i / 5) * TOP, -0.2));

  const split = new Set(scene.drops.map((d) => d.where)).size > 1;
  const onMoon = scene.place === 'moon';
  const ground = mesh(tube(2.3, 2.3, 0.06, 40), mat(onMoon ? 0x9a9da6 : 0x3d8f4f, { roughness: 0.95 }), 0, 0.03, 0);
  b.group.add(ground);
  if (onMoon) {
    for (const [x, z, r] of [[-1.2, 0.5, 0.3], [0.9, -0.6, 0.22], [1.4, 0.8, 0.18], [-0.3, -1, 0.25]]) {
      b.group.add(mesh(new THREE.TorusGeometry(r, 0.035, 6, 20), mat(0x7d808a, { roughness: 1 }), x, 0.06, z).rotateX(Math.PI / 2));
    }
    const earth = mesh(ball(0.3), new THREE.MeshStandardMaterial({ color: 0x2f7fff, emissive: 0x1a4fd0, emissiveIntensity: 0.7 }), 1.5, 3.2, -1);
    earth.add(mesh(ball(0.305, 10), mat(0x3fae49, { flatShading: true, transparent: true, opacity: 0.6 })));
    b.group.add(earth);
  }
  const allVacuum = scene.drops.every((d) => d.k === 0);
  const tubeGlass = scene.place === 'earth' && allVacuum && !split && scene.drops.length === 2 && !scene.stopwatch;
  if (tubeGlass) {
    b.group.add(mesh(tube(1.25, 1.25, TOP + 0.3, 32, true), glass(0xd8f3ff, 0.16), 0, (TOP + 0.3) / 2 + 0.05, 0));
    const tag = label('No air inside', { height: 0.26, color: '#dff6ff' });
    tag.position.set(0, 0.5, 1.3);
    b.group.add(tag);
  }

  const n = scene.drops.length;
  // Real seconds, unless two falls would finish too close together to see.
  const fallTime = (d) => Math.sqrt((2 * scene.h) / d.g);
  let slow = 1;
  if (n === 2 && scene.drops.every((d) => d.k === 0)) {
    const gap = Math.abs(fallTime(scene.drops[0]) - fallTime(scene.drops[1]));
    if (gap > 0.01 && gap < 0.6) slow = 0.45;
  }

  const things = scene.drops.map((d, i) => {
    const x = n === 1 ? 0 : (i === 0 ? -0.75 : 0.75);
    const item = makeItem(d.kind);
    item.position.set(x, TOP, 0);
    const claw = mesh(box(0.5, 0.08, 0.3), frame, x, TOP + 0.3, 0);
    b.group.add(item, claw, mesh(tube(0.03, 0.03, 0.1, 8), frame, x, TOP + 0.36, -0.15));
    if (split) {
      const tag = label(`${d.where === 'earth' ? '🌍' : d.where === 'moon' ? '🌙' : '🪐'} ${PLACE[d.where]}`, { height: 0.3 });
      tag.position.set(x, 0.42, 1.2);
      b.group.add(tag);
    }
    return { ...d, item, x, s: 0, v: 0, t: 0, landed: false, landedAt: 0, phase: i * 2 };
  });

  const watch = scene.stopwatch ? label('0.00 s', { height: 0.42, color: '#ffe680' }) : null;
  if (watch) {
    watch.position.set(1.5, 2.3, 0.6);
    b.group.add(watch);
  }
  let watchText = '';
  function setWatch(text) {
    if (!watch || text === watchText) return;
    watchText = text;
    const next = label(text, { height: 0.42, color: '#ffe680' });
    watch.material.map.dispose();
    watch.material.map = next.material.map;
    watch.scale.copy(next.scale);
    next.material.dispose();
  }

  const result = label('', { height: 0.4 });
  result.position.set(0, 2.2, 1.2);
  b.group.add(result);
  pop(result, 0);

  let running = false;
  let clock = 0;
  let shown = false;
  b.tickers.push((dt, time) => {
    if (!running) {
      for (const t of things) t.item.rotation.y = Math.sin(time * 1.2 + t.phase) * 0.3;
      return;
    }
    const step = Math.min(dt, 0.033) * slow;
    clock += step;
    for (const t of things) {
      if (t.landed) continue;
      t.v += (t.g - t.k * t.v) * step;
      t.s += t.v * step;
      t.t += step;
      const k = clamp01(t.s / scene.h);
      t.item.position.y = lerp(TOP, 0.3, k);
      if (t.k > 0) {
        t.item.position.x = t.x + Math.sin(t.t * 4) * 0.22 * (1 - k * 0.3);
        t.item.rotation.z = Math.sin(t.t * 4 + 1) * 0.5;
      } else {
        t.item.rotation.x += step * 2;
      }
      if (k >= 1) {
        t.landed = true;
        t.landedAt = clock;
        // The step overshoots the ground a little; take that back.
        t.t -= (t.s - scene.h) / Math.max(t.v, 0.01);
      }
    }
    if (scene.stopwatch) {
      const t = things[0];
      setWatch(`${t.t.toFixed(2)} s   ${Math.round(t.g * t.t)} m/s`);
    }
    if (!shown && things.every((t) => t.landed)) {
      shown = true;
      let text = '';
      if (n === 2) {
        const gap = things[0].landedAt - things[1].landedAt;
        text = Math.abs(gap) < 0.06 ? 'They land together!' : null;
        if (text === null) {
          const first = gap < 0 ? things[0] : things[1];
          const tag = label('First!', { height: 0.36, color: '#8dffb0' });
          tag.position.set(first.x, 1.05, 0.4);
          b.group.add(tag);
          popLabel(b, tag, 0);
        }
      }
      if (text) {
        const next = label(text, { height: 0.4, color: '#8dffb0' });
        result.material = next.material;
        result.userData = next.userData;
        popLabel(b, result, 0);
      }
    }
  });

  const slowest = Math.max(...scene.drops.map((d) => (d.k > 0 ? scene.h / (d.g / d.k) + 0.4 : fallTime(d)))) / slow;
  return b.finish(() => {
    b.tl.at(0.5, 0, () => { running = true; });
  }, Math.min(5.5, 0.5 + slowest + 0.5));
}

// --- Balance beam ----------------------------------------------------------------

function seesaw(scene) {
  const b = base();
  const STEP = 0.52; const SIZE = 0.34; const PIVOT = 1.0;
  const steel = mat(0x4a5080, { metalness: 0.4, roughness: 0.4 });
  const fulcrum = mesh(new THREE.ConeGeometry(0.55, PIVOT, 4), mat(0xffb13d, { roughness: 0.4 }), 0, PIVOT / 2, 0);
  fulcrum.rotation.y = Math.PI / 4;
  fulcrum.scale.z = 1.4;
  b.group.add(fulcrum);

  const beam = new THREE.Group();
  beam.position.y = PIVOT;
  beam.add(mesh(box(4.7, 0.1, 0.6), mat(0xe9eefc, { roughness: 0.35 }), 0, 0.05, 0));
  for (let p = -4; p <= 4; p++) {
    if (p === 0) continue;
    beam.add(mesh(box(0.03, 0.105, 0.6), mat(0x4a5080), p * STEP, 0.05, 0));
    const num = label(`${Math.abs(p)}`, { height: 0.2, bg: null, color: '#cdd6ff' });
    num.position.set(p * STEP, -0.14, 0.34);
    beam.add(num);
  }
  b.group.add(beam);

  const stack = (side, colour, s) => {
    const list = [];
    for (let i = 0; i < side.n; i++) {
      const blockMesh = mesh(box(SIZE, SIZE, SIZE), mat(colour, { roughness: 0.3 }), s * side.pos * STEP, 0.1 + SIZE / 2 + i * (SIZE + 0.01), 0);
      beam.add(blockMesh);
      list.push(blockMesh);
    }
    return list;
  };
  stack(scene.left, 0xff8a3d, -1);
  const rightBlocks = stack(scene.right, 0x3dd6d0, 1);

  let mystery = null;
  if (scene.mystery) {
    for (const blk of rightBlocks) blk.visible = false;
    mystery = label('?', { height: 0.7, color: '#ffe680' });
    mystery.position.set(scene.right.pos * STEP, 0.6, 0);
    beam.add(mystery);
  }

  // Props hold the beam level until the experiment runs.
  const props = [-1, 1].map((s) => {
    const p = mesh(tube(0.06, 0.08, PIVOT, 10), steel, s * 2.15, PIVOT / 2, 0);
    b.group.add(p);
    return p;
  });

  const torque = scene.right.n * scene.right.pos - scene.left.n * scene.left.pos;
  const target = torque === 0 ? 0 : -Math.sign(torque) * 0.3;
  const verdict = label(torque === 0 ? 'Balanced!' : torque > 0 ? 'Right side goes down!' : 'Left side goes down!', { height: 0.4, color: '#8dffb0' });
  verdict.position.set(0, 3.2, 0);
  b.group.add(verdict);

  let wobble = 0;
  b.tickers.push((dt, time) => {
    if (wobble > 0) beam.rotation.z = target + Math.sin(time * 5) * 0.035 * wobble;
    if (mystery && mystery.visible) mystery.position.y = 0.6 + Math.sin(time * 3) * 0.06;
  });

  let start = 0.4;
  if (scene.mystery) start += 0.3 + rightBlocks.length * 0.28 + 0.4;
  popLabel(b, verdict, start + 2.1);
  return b.finish(() => {
    if (scene.mystery) {
      b.tl.at(0.2, 0.2, (k) => pop(mystery, 1 - k));
      rightBlocks.forEach((blk, i) => {
        const rest = blk.position.y;
        b.tl.at(0.5 + i * 0.28, 0.4, (k) => {
          blk.visible = true;
          blk.position.y = lerp(rest + 2.2, rest, k);
        }, ease.bounce);
      });
    }
    for (const p of props) {
      b.tl.at(start, 0.5, (k) => {
        p.position.y = PIVOT / 2 - k * (PIVOT + 0.2);
        p.visible = k < 1;
      }, ease.in);
    }
    if (target === 0) {
      b.tl.at(start + 0.4, 1.6, (k, raw) => { wobble = Math.sin(raw * Math.PI); }, ease.linear);
    } else {
      b.tl.at(start + 0.4, 1.7, (k) => { beam.rotation.z = target * k; }, ease.spring);
    }
  }, start + 2.2);
}

// --- Magnet magic ----------------------------------------------------------------

const NORTH = 0xe53935; const SOUTH = 0x2f6fed;

function horseshoe(hot) {
  const g = new THREE.Group();
  const red = hot
    ? new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3300, emissiveIntensity: 2.4, roughness: 0.5 })
    : mat(NORTH, { roughness: 0.3 });
  const arc = mesh(new THREE.TorusGeometry(0.42, 0.14, 14, 28, Math.PI), red, 0, 0.5, 0);
  g.add(arc);
  for (const s of [-1, 1]) {
    g.add(mesh(tube(0.14, 0.14, 0.36, 16), red, s * 0.42, 0.32, 0), mesh(tube(0.142, 0.142, 0.16, 16), metal(0xdfe5ec, 0.25), s * 0.42, 0.08, 0));
  }
  return g;
}

function barMagnet(leftPole) {
  const g = new THREE.Group();
  const colour = (p) => (p === 'N' ? NORTH : SOUTH);
  const rightPole = leftPole === 'N' ? 'S' : 'N';
  [[leftPole, -0.4], [rightPole, 0.4]].forEach(([p, x]) => {
    g.add(mesh(box(0.8, 0.34, 0.42), mat(colour(p), { roughness: 0.3 }), x, 0, 0));
    const letter = label(p, { height: 0.3, bg: null });
    letter.position.set(x, 0, 0.25);
    g.add(letter);
  });
  return g;
}

function magnet(scene) {
  const b = base();
  b.group.add(mesh(tube(1.5, 1.6, 0.5, 32), mat(0x3a3f66, { roughness: 0.5 }), 0, 0.25, 0),
    mesh(tube(1.52, 1.52, 0.03, 32), glow(0x7fe9ff, 1.1), 0, 0.5, 0));
  const TABLE = 0.52;

  if (scene.mode === 'pick') {
    const item = makeItem(scene.kind);
    item.position.set(0, TABLE + 0.3, 0);
    b.group.add(item);
    const rig = new THREE.Group();
    const m = horseshoe(scene.hot);
    rig.add(m, mesh(tube(0.025, 0.025, 3, 6), mat(0x9aa3ad), 0, 2.5, 0));
    if (scene.paper) rig.add(mesh(box(1.5, 0.012, 1.1), mat(0xfdfdfd, { roughness: 0.9 }), 0, -0.04, 0));
    rig.position.y = 2.7;
    b.group.add(rig);
    if (scene.hot) {
      const heat = new THREE.PointLight(0xff5a1f, 12, 5, 2);
      heat.position.y = 0.5;
      rig.add(heat);
    }
    const verdict = label(scene.sticks ? 'It sticks!' : 'Nothing happens!', { height: 0.4, color: scene.sticks ? '#8dffb0' : '#ffb08d' });
    verdict.position.set(0, 3.5, 0);
    b.group.add(verdict);
    popLabel(b, verdict, 3.3);

    const hover = 1.35;
    let held = false;
    b.tickers.push((dt, time) => {
      if (!held) item.rotation.y += dt * 0.7;
      else item.rotation.z = Math.sin(time * 9) * 0.06;
    });
    return b.finish(() => {
      b.tl.at(0.3, 1.2, (k) => { rig.position.y = lerp(2.7, hover, k); });
      if (scene.sticks) {
        b.tl.at(1.5, 0.22, (k) => {
          held = true;
          item.position.y = lerp(TABLE + 0.3, hover - (scene.paper ? 0.2 : 0.14), k);
        }, ease.in);
        b.tl.at(2.1, 1.3, (k) => {
          rig.position.y = lerp(hover, 2.35, k);
          item.position.y = rig.position.y - (scene.paper ? 0.2 : 0.14);
        });
      } else {
        b.tl.at(1.5, 0.9, (k, raw) => { rig.position.x = Math.sin(raw * Math.PI * 4) * 0.12; }, ease.linear);
        b.tl.at(2.5, 1.2, (k) => { rig.position.y = lerp(hover, 2.5, k); });
      }
    }, 3.4);
  }

  if (scene.mode === 'poles') {
    // The left magnet's right end is pole `a`; the right magnet's left end is `b`.
    const left = barMagnet(scene.a === 'N' ? 'S' : 'N');
    const right = barMagnet(scene.b);
    left.position.set(-1.9, TABLE + 0.2, 0);
    right.position.set(1.9, TABLE + 0.2, 0);
    b.group.add(left, right);
    const attract = scene.a !== scene.b;
    const verdict = label(attract ? 'Snap! They pull together' : 'They push apart!', { height: 0.4, color: '#8dffb0' });
    verdict.position.set(0, 2.2, 0);
    b.group.add(verdict);
    popLabel(b, verdict, 2.9);
    return b.finish(() => {
      b.tl.at(0.3, 1.3, (k) => {
        left.position.x = lerp(-1.9, -1.15, k);
        right.position.x = lerp(1.9, 1.15, k);
      });
      if (attract) {
        b.tl.at(1.7, 0.18, (k) => {
          left.position.x = lerp(-1.15, -0.8, k);
          right.position.x = lerp(1.15, 0.8, k);
        }, ease.in);
        b.tl.at(1.88, 0.5, (k, raw) => {
          const j = Math.sin(raw * Math.PI * 5) * 0.03 * (1 - raw);
          left.position.y = TABLE + 0.2 + j;
          right.position.y = TABLE + 0.2 + j;
        }, ease.linear);
      } else {
        b.tl.at(1.7, 1.1, (k) => {
          left.position.x = lerp(-1.15, -2.15, k);
          right.position.x = lerp(1.15, 2.15, k);
          left.rotation.y = k * 0.5;
          right.rotation.y = -k * 0.5;
        }, ease.out);
      }
    }, 3);
  }

  // Cutting a magnet in two: quarters, so each half can show both its poles.
  const quarters = ['N', 'N', 'S', 'S'].map((p, i) => {
    const q = mesh(box(0.6, 0.4, 0.5), mat(p === 'N' ? NORTH : SOUTH, { roughness: 0.3 }), -0.9 + i * 0.6, TABLE + 0.6, 0);
    b.group.add(q);
    return q;
  });
  const letters = [['N', -0.6], ['S', 0.6]].map(([p, x]) => {
    const l = label(p, { height: 0.34, bg: null });
    l.position.set(x, TABLE + 0.6, 0.3);
    b.group.add(l);
    return l;
  });
  const after = ['N', 'S', 'N', 'S'].map((p, i) => {
    const l = label(p, { height: 0.3, bg: null });
    l.position.set(0, 0, 0.3);
    quarters[i].add(l);
    pop(l, 0);
    return l;
  });
  const blade = mesh(box(0.03, 1.2, 0.9), glow(0x7fe9ff, 3), 0, 3, 0);
  b.group.add(blade, mesh(tube(0.4, 0.5, 0.36, 20), mat(0x2b3050), 0, TABLE + 0.2, 0));
  const verdict = label('Two complete magnets!', { height: 0.4, color: '#8dffb0' });
  verdict.position.set(0, 2.5, 0);
  b.group.add(verdict);
  popLabel(b, verdict, 3.2);
  const nCol = new THREE.Color(NORTH); const sCol = new THREE.Color(SOUTH);
  return b.finish(() => {
    b.tl.at(0.3, 0.5, (k) => { blade.position.y = lerp(3, TABLE + 0.6, k); }, ease.in);
    b.tl.at(0.9, 0.4, (k) => { blade.position.y = lerp(TABLE + 0.6, 3.4, k); blade.visible = k < 1; });
    b.tl.at(1.0, 0.9, (k) => {
      quarters.forEach((q, i) => { q.position.x = -0.9 + i * 0.6 + (i < 2 ? -1 : 1) * 0.55 * k; });
      for (const l of letters) pop(l, 1 - k);
    }, ease.out);
    b.tl.at(1.9, 0.9, (k) => {
      quarters[1].material.color.copy(nCol).lerp(sCol, k);
      quarters[2].material.color.copy(sCol).lerp(nCol, k);
      for (const l of after) pop(l, k);
    });
  }, 3.3);
}

// --- Bright sparks ---------------------------------------------------------------

function circuit(scene) {
  const b = base();
  b.group.add(mesh(box(4.4, 0.12, 2.6), mat(0x1f7a5a, { roughness: 0.7 }), 0, 0.06, 0));
  const Y = 0.2;
  const corners = [[-1.8, 1], [-1.8, -0.9], [1.8, -0.9], [1.8, 1]];
  const wireMat = mat(0xffb13d, { roughness: 0.35, metalness: 0.5 });
  const wire = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const w = mesh(tube(0.035, 0.035, len, 8), wireMat, (x1 + x2) / 2, Y, (z1 + z2) / 2);
    w.rotation.z = Math.PI / 2;
    w.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    b.group.add(w);
  };
  wire(-1.8, 1, -1.8, -0.9);
  wire(-1.8, -0.9, 1.8, -0.9);
  wire(1.8, -0.9, 1.8, 1);
  const GAP = 0.42;
  wire(-1.8, 1, -GAP, 1);
  wire(GAP, 1, 1.8, 1);
  for (const s of [-1, 1]) b.group.add(mesh(tube(0.07, 0.09, 0.3, 12), metal(0xdfe5ec, 0.3), s * GAP, 0.27, 1));

  // Batteries on the left side.
  const cells = [];
  for (let i = 0; i < scene.batteries; i++) {
    const cell = new THREE.Group();
    cell.add(mesh(tube(0.2, 0.2, 0.62, 20), mat(0x22252f, { roughness: 0.35 })).rotateX(Math.PI / 2),
      mesh(tube(0.202, 0.202, 0.2, 20), mat(0xffb13d, { metalness: 0.6, roughness: 0.3 }), 0, 0, -0.22).rotateX(Math.PI / 2),
      mesh(tube(0.07, 0.07, 0.06, 12), metal(0xdfe5ec), 0, 0, -0.34).rotateX(Math.PI / 2));
    cell.position.set(-1.8, Y + 0.2, scene.batteries === 1 ? 0.05 : 0.42 - i * 0.74);
    cells.push(cell);
    b.group.add(cell);
  }
  // In "add a second battery", the second one arrives when the experiment runs.
  const extra = scene.batteries === 2 && !scene.readout && scene.bulbs === 1 ? cells[1] : null;
  if (extra) extra.position.y = 3.6;

  const bulbs = [];
  for (let i = 0; i < scene.bulbs; i++) {
    const x = scene.bulbs === 1 ? 0 : (i ? 0.7 : -0.7);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff6d5, emissive: 0xffd65a, emissiveIntensity: 0, transparent: true, opacity: 0.55, roughness: 0.05 });
    const filament = new THREE.MeshStandardMaterial({ color: 0x66584a, emissive: 0xffc93a, emissiveIntensity: 0 });
    const light = new THREE.PointLight(0xffd65a, 0, 7, 2);
    light.position.set(x, 1.0, -0.9);
    b.group.add(mesh(tube(0.16, 0.2, 0.34, 16), metal(0xaab2bd, 0.4), x, Y + 0.17, -0.9),
      mesh(ball(0.3, 24), glassMat, x, 0.92, -0.9), mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), filament, x, 0.88, -0.9), light);
    bulbs.push({ glassMat, filament, light });
  }

  let item = null;
  if (scene.item) {
    item = makeItem(scene.item);
    item.scale.setScalar(scene.item.endsWith('water') ? 1.3 : 1.5);
    item.position.set(0, 1.9, 1);
    b.group.add(item);
  }

  const dots = [];
  const path = [...corners, [GAP, 1], [-GAP, 1]];
  const per = [];
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const [x1, z1] = path[i]; const [x2, z2] = path[(i + 1) % path.length];
    per.push(Math.hypot(x2 - x1, z2 - z1));
    total += per[i];
  }
  for (let i = 0; i < 18; i++) {
    const d = mesh(ball(0.055, 8), glow(0x7fe9ff, 3));
    d.visible = false;
    dots.push(d);
    b.group.add(d);
  }
  const flows = scene.brightness > 0;
  let flowing = 0;
  let offset = 0;
  b.tickers.push((dt, time) => {
    if (item && !item.userData.placed) {
      item.position.y = 1.9 + Math.sin(time * 2) * 0.06;
      item.rotation.y += dt * 0.6;
    }
    if (!flowing) return;
    offset = (offset + dt * (0.5 + scene.brightness) * 0.9) % total;
    dots.forEach((d, i) => {
      let s = (offset + (i / dots.length) * total) % total;
      let seg = 0;
      while (s > per[seg]) { s -= per[seg]; seg += 1; }
      const [x1, z1] = path[seg]; const [x2, z2] = path[(seg + 1) % path.length];
      const k = s / per[seg];
      d.visible = true;
      d.position.set(lerp(x1, x2, k), Y + 0.02, lerp(z1, z2, k));
    });
    const flicker = 1 + Math.sin(time * 30) * 0.03;
    for (const bulb of bulbs) {
      bulb.glassMat.emissiveIntensity = scene.brightness * 2.6 * flowing * flicker;
      bulb.filament.emissiveIntensity = scene.brightness * 6 * flowing;
      bulb.light.intensity = scene.brightness * 14 * flowing;
    }
  });

  const verdictText = scene.readout
    ? `Reads ${scene.readout}`
    : flows ? (scene.brightness > 1.5 ? 'Brighter!' : scene.brightness < 0.5 ? 'Dimmer!' : 'It lights up!') : 'The bulb stays dark';
  const verdict = label(verdictText, { height: 0.4, color: flows ? '#ffe680' : '#ffb08d' });
  verdict.position.set(0, 2.4, -0.9);
  b.group.add(verdict);
  popLabel(b, verdict, 2.6);

  return b.finish(() => {
    let go = 0.4;
    if (item) {
      const rest = scene.item.endsWith('water') ? Y + 0.3 : Y + 0.26;
      b.tl.at(0.3, 0.9, (k) => {
        item.userData.placed = true;
        item.position.y = lerp(1.9, rest, k);
        item.rotation.y = lerp(item.rotation.y, 0, k);
      }, ease.bounce);
      go = 1.4;
    }
    if (extra) {
      b.tl.at(0.3, 0.9, (k) => { extra.position.y = lerp(3.6, Y + 0.2, k); }, ease.bounce);
      go = 1.4;
    }
    if (flows) b.tl.at(go, 0.9, (k) => { flowing = Math.max(0.001, k); }, ease.out);
  }, 2.8);
}

// --- Space station ---------------------------------------------------------------

const PLANETS = [
  { key: 'mercury', name: 'Mercury', r: 0.8, size: 0.07, colour: 0xa9a29a, speed: 1.6 },
  { key: 'venus', name: 'Venus', r: 1.08, size: 0.11, colour: 0xe8c27a, speed: 1.17 },
  { key: 'earth', name: 'Earth', r: 1.4, size: 0.12, colour: 0x2f7fff, speed: 1 },
  { key: 'mars', name: 'Mars', r: 1.72, size: 0.09, colour: 0xd9532b, speed: 0.8 },
  { key: 'jupiter', name: 'Jupiter', r: 2.2, size: 0.28, colour: 0xd9a066, speed: 0.43 },
  { key: 'saturn', name: 'Saturn', r: 2.72, size: 0.22, colour: 0xe6cf8f, speed: 0.32 },
  { key: 'uranus', name: 'Uranus', r: 3.15, size: 0.16, colour: 0x8fe3e8, speed: 0.23 },
  { key: 'neptune', name: 'Neptune', r: 3.5, size: 0.15, colour: 0x3f5fe0, speed: 0.18 },
];

function space(scene) {
  const b = base();
  const tilt = new THREE.Group();
  tilt.position.y = 1.7;
  tilt.rotation.x = 0.42;
  b.group.add(tilt, mesh(tube(0.5, 0.7, 0.3, 24), mat(0x2b3050), 0, 0.15, 0), mesh(tube(0.04, 0.04, 1.2, 8), mat(0x4a5080), 0, 0.85, 0));

  const sun = mesh(ball(0.42, 32), glow(0xffc531, 3.2));
  sun.castShadow = false;
  const sunLight = new THREE.PointLight(0xffd9a0, 30, 12, 2);
  tilt.add(sun, sunLight);

  const bodies = PLANETS.map((p, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.008, 6, 96), new THREE.MeshBasicMaterial({ color: 0x8fa8ff, transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    tilt.add(ring);
    const pivot = new THREE.Group();
    const planet = mesh(ball(p.size, 24), mat(p.colour, { roughness: 0.6, emissive: p.colour, emissiveIntensity: 0.25 }));
    planet.castShadow = false;
    if (p.key === 'earth') {
      planet.add(mesh(ball(p.size * 1.02, 8), mat(0x3fae49, { flatShading: true, transparent: true, opacity: 0.7 })));
      const moon = mesh(ball(0.035, 10), mat(0xd9dce3));
      moon.position.x = 0.22;
      pivot.userData.moon = moon;
      planet.add(moon);
    }
    if (p.key === 'jupiter') {
      for (const y of [-0.12, 0, 0.12]) planet.add(mesh(new THREE.TorusGeometry(Math.sqrt(p.size ** 2 - y * y) * 1.005, 0.018, 6, 32), mat(0xa9683c), 0, y, 0).rotateX(Math.PI / 2));
      planet.add(mesh(ball(0.05, 10), mat(0xc0392b), 0.2, -0.08, 0.17));
    }
    if (p.key === 'saturn' || p.key === 'uranus') {
      const rings = new THREE.Mesh(new THREE.RingGeometry(p.size * 1.35, p.size * (p.key === 'saturn' ? 2.3 : 1.7), 48),
        new THREE.MeshBasicMaterial({ color: p.key === 'saturn' ? 0xf1dfae : 0xbff3f5, side: THREE.DoubleSide, transparent: true, opacity: p.key === 'saturn' ? 0.85 : 0.45 }));
      rings.rotation.x = p.key === 'saturn' ? Math.PI / 2 - 0.45 : 0.15;
      planet.add(rings);
    }
    planet.position.x = p.r;
    pivot.add(planet);
    pivot.rotation.y = i * 2.4 + 0.5;
    tilt.add(pivot);
    const tag = label(p.name, { height: 0.34, color: '#ffe680' });
    b.group.add(tag);
    pop(tag, 0);
    return { ...p, pivot, planet, tag, shown: 0, grow: 1 };
  });
  const sunTag = label('The Sun', { height: 0.36, color: '#ffe680' });
  b.group.add(sunTag);
  pop(sunTag, 0);

  let pace = 1;
  let sunShown = 0;
  const v = new THREE.Vector3();
  b.tickers.push((dt, time) => {
    sun.scale.setScalar((1 + Math.sin(time * 3) * 0.03) * (1 + sunShown * 0.35));
    for (const p of bodies) {
      p.pivot.rotation.y += dt * p.speed * 0.5 * pace;
      p.planet.rotation.y += dt * 1.5;
      p.planet.scale.setScalar(p.grow);
      if (p.shown > 0) {
        p.planet.getWorldPosition(v);
        b.group.worldToLocal(v);
        p.tag.position.set(v.x, v.y + p.size * p.grow + 0.42, v.z);
      }
    }
    if (sunShown > 0) sunTag.position.set(0, 1.7 + 0.95, 0);
  });

  return b.finish(() => {
    b.tl.at(0.2, 1.2, (k) => { pace = lerp(1, 0.12, k); });
    const focus = scene.focus;
    if (focus === 'sun') {
      b.tl.at(1, 0.6, (k) => { sunShown = k; pop(sunTag, k); }, ease.back);
      return;
    }
    for (const p of bodies) {
      if (focus !== 'all' && p.key !== focus) continue;
      const big = focus === 'all' ? 1.25 : p.size > 0.2 ? 1.6 : 2.6;
      b.tl.at(focus === 'all' ? 0.5 + bodies.indexOf(p) * 0.22 : 1, 0.6, (k) => {
        p.shown = k;
        p.grow = lerp(1, big, k);
        pop(p.tag, k);
      }, ease.back);
    }
  }, 2.8);
}

// ---------------------------------------------------------------------------------

const BUILDERS = { float, colour, drop, seesaw, magnet, circuit, space };

export function buildExperiment(exp, scene) {
  return (BUILDERS[exp] || float)(scene);
}
