// Small helpers shared by the lab and its experiments.
import * as THREE from 'three';

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  // Overshoots, wobbles, settles: for things that land or swing.
  spring: (t) => 1 - Math.exp(-6 * t) * Math.cos(11 * t),
  bounce: (t) => {
    const n = 7.5625; const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// Things that happen at set times: tl.at(start, duration, (eased, raw) => …).
export class Timeline {
  constructor() {
    this.items = [];
    this.t = 0;
  }

  at(start, dur, fn, easing = ease.inOut) {
    this.items.push({ start: this.t + start, dur, fn, easing, done: false });
    return this;
  }

  update(dt) {
    this.t += dt;
    for (const it of this.items) {
      if (it.done || this.t < it.start) continue;
      const k = it.dur <= 0 ? 1 : Math.min(1, (this.t - it.start) / it.dur);
      it.fn(it.easing(k), k);
      if (k >= 1) it.done = true;
    }
    if (this.items.length > 64) this.items = this.items.filter((it) => !it.done);
  }
}

export function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...options });
}

export function metal(color, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.9 });
}

// Bright enough to pick up the bloom.
export function glow(color, intensity = 2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

export function glass(color = 0xcfefff, opacity = 0.22) {
  return new THREE.MeshStandardMaterial({
    color, transparent: true, opacity, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = !material.transparent;
  m.receiveShadow = !material.transparent;
  return m;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const ball = (r, seg = 24) => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7)));
export const tube = (rTop, rBottom, h, seg = 24, open = false) => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);

// Text that always faces the camera. `height` is in lab units.
export function label(text, { height = 0.4, color = '#ffffff', bg = 'rgba(16,18,40,0.82)', border = null } = {}) {
  const fontPx = 72;
  const font = `800 ${fontPx}px "Baloo 2", "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const padX = bg ? 34 : 8;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = fontPx + 44;
  canvas.width = w;
  canvas.height = h;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, h / 2);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (!bg) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(10,10,30,0.85)';
    ctx.strokeText(text, w / 2, h / 2 + 4);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set((height * w) / h, height, 1);
  sprite.renderOrder = 10;
  sprite.userData.aspect = w / h;
  sprite.userData.height = height;
  return sprite;
}

// Show or hide a label with a pop. k: 0 → 1.
export function pop(sprite, k) {
  const s = Math.max(0.0001, k);
  sprite.visible = k > 0.001;
  sprite.scale.set(sprite.userData.height * sprite.userData.aspect * s, sprite.userData.height * s, 1);
}

export function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Free the GPU memory of everything under `root`.
export function dispose(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}
