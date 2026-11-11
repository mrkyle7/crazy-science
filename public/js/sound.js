// Bleeps, chimes and a rocket rumble, made on the spot with Web Audio, and
// reading questions aloud for the youngest scientists.

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('cs.muted') === '1';
} catch { /* private browsing */ }

function audio() {
  if (muted) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, start, length, { type = 'sine', gain = 0.12, slideTo = null } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function noise(start, length, { gain = 0.2, from = 900, to = 120 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + length);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.4, length / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t);
}

export const sound = {
  get muted() { return muted; },
  setMuted(value) {
    muted = value;
    try {
      localStorage.setItem('cs.muted', value ? '1' : '0');
    } catch { /* fine */ }
    if (value) window.speechSynthesis?.cancel();
  },
  tap() { tone(520, 0, 0.08, { type: 'triangle', gain: 0.08 }); },
  pick() { tone(440, 0, 0.09, { type: 'triangle' }); tone(660, 0.07, 0.12, { type: 'triangle' }); },
  join() { tone(392, 0, 0.1); tone(523, 0.09, 0.1); tone(659, 0.18, 0.16); },
  boing() { tone(220, 0, 0.22, { type: 'square', gain: 0.05, slideTo: 520 }); },
  intro() { noise(0, 0.5, { gain: 0.07, from: 300, to: 3000 }); tone(330, 0.3, 0.14); tone(494, 0.42, 0.22); },
  tick() { tone(880, 0, 0.05, { type: 'square', gain: 0.04 }); },
  right() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', gain: 0.13 })); },
  wrong() { tone(300, 0, 0.18, { type: 'sawtooth', gain: 0.06, slideTo: 200 }); tone(200, 0.16, 0.3, { type: 'sawtooth', gain: 0.06, slideTo: 140 }); },
  launch() { noise(0, 9, { gain: 0.28, from: 200, to: 900 }); [0, 0.7, 1.4].forEach((t) => tone(440, t, 0.15, { gain: 0.1 })); tone(880, 2.1, 0.5, { gain: 0.1 }); },
  fanfare() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.25, { type: 'triangle', gain: 0.12 })); },
};

export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth || muted) return;
  try {
    synth.cancel();
    const say = new SpeechSynthesisUtterance(text);
    say.rate = 0.92;
    say.pitch = 1.1;
    say.lang = 'en-GB';
    synth.speak(say);
  } catch { /* no voices */ }
}

export function hush() {
  window.speechSynthesis?.cancel();
}
