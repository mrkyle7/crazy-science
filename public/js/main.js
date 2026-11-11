// Crazy Science, in the browser: the screens around the 3D lab, and the
// WebSocket that keeps every scientist in a room in step (see src/rooms.js).
import { Lab, NoLab, LOOKS, milestoneFor } from './lab.js';
import { sound, speak, hush } from './sound.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch { /* private browsing: nothing is remembered */ }
  },
};

let LEVELS = [
  { id: 1, name: 'Sprout', ages: 'Age 5+', icon: '🌱' },
  { id: 2, name: 'Explorer', ages: 'Age 8+', icon: '🔍' },
  { id: 3, name: 'Whiz', ages: 'Age 10+', icon: '⚡' },
  { id: 4, name: 'Professor', ages: 'Grown-ups', icon: '🎓' },
];
let EXPERIMENTS = {};
const levelIcon = (id) => (LEVELS.find((l) => l.id === id) || LEVELS[1]).icon;

let lab;
try {
  lab = new Lab($('lab'));
} catch (err) {
  console.error('The 3D lab could not start', err);
  lab = new NoLab();
  $('lab').hidden = true;
}
window.__lab = lab;

// --- Who's playing ---------------------------------------------------------------

let me = { signedIn: false };
let myLevel = Number(store.get('cs.level', '2')) || 2;
let token = store.get('cs.token');
if (!token || !/^[\w-]{8,64}$/.test(token)) {
  token = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  store.set('cs.token', token);
}

fetch('/api/me').then((r) => r.json()).then((info) => {
  me = info;
  const el = $('account');
  if (me.signedIn) {
    const name = document.createElement('strong');
    name.textContent = me.name;
    el.append('Signed in as ', name);
  } else {
    const a = document.createElement('a');
    a.href = me.loginUrl;
    a.textContent = 'Sign in';
    el.append(a);
    $('name-field').hidden = false;
    $('name').value = store.get('cs.name', '');
  }
}).catch(() => {
  $('name-field').hidden = false;
});

fetch('/api/game').then((r) => r.json()).then((info) => {
  LEVELS = info.levels;
  EXPERIMENTS = info.experiments;
  drawLevels();
}).catch(() => {});

function drawLevels() {
  for (const host of [$('home-levels'), $('room-levels')]) {
    host.querySelectorAll('.level').forEach((b) => b.remove());
    host.setAttribute('role', 'radiogroup');
    for (const level of LEVELS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(level.id === myLevel));
      b.innerHTML = '<span class="emoji"></span><span class="name"></span><span class="ages"></span>';
      b.children[0].textContent = level.icon;
      b.children[1].textContent = level.name;
      b.children[2].textContent = level.ages;
      b.addEventListener('click', () => {
        myLevel = level.id;
        store.set('cs.level', String(myLevel));
        sound.tap();
        drawLevels();
        send({ t: 'set', level: myLevel });
      });
      host.append(b);
    }
  }
}
drawLevels();

// --- The connection --------------------------------------------------------------

let ws = null;
let state = null; // the room, as the server last described it
let question = null; // my question this round
let revealed = null; // the answer, once the server has sent it
let resultRound = 0; // the last round whose result is on screen
let roomCode = null;
let leaving = false;
let retry = 0;
let endsAt = 0;
let phaseLength = 1;
const timers = new Set();

function later(fn, ms) {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function toast(text, ms = 0) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = !text;
  if (text && ms) setTimeout(() => { if (el.textContent === text) el.hidden = true; }, ms);
}

function connect(code) {
  leaving = false;
  $('home-error').textContent = '';
  const name = $('name').value.trim();
  if (name) store.set('cs.name', name);
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = socket;
  socket.addEventListener('open', () => {
    retry = 0;
    toast('');
    send({ t: 'join', room: code || undefined, token, name, level: myLevel });
  });
  socket.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handlers[msg.t]?.(msg);
  });
  socket.addEventListener('close', () => {
    if (ws !== socket) return;
    ws = null;
    if (leaving || !roomCode) {
      if (!roomCode && !leaving && !$('home-error').textContent) $('home-error').textContent = "Couldn't reach the lab. Try again.";
      return;
    }
    // Dropped: keep trying to get back to the same seat.
    retry += 1;
    toast('Reconnecting…');
    setTimeout(() => { if (!ws && roomCode && !leaving) connect(roomCode); }, Math.min(5000, 600 * retry));
  });
}

function leave() {
  leaving = true;
  roomCode = null;
  state = null;
  question = null;
  revealed = null;
  for (const id of timers) clearTimeout(id);
  timers.clear();
  ws?.close();
  ws = null;
  hush();
  history.replaceState(null, '', '/');
  atHome();
}

// Nobody's here yet: a few scientists mind the lab.
function atHome() {
  lab.setPhase('home');
  lab.setPlayers([
    { id: 'demo1', name: 'Sprout', look: 3, icon: '🌱', you: false, status: '' },
    { id: 'demo2', name: 'Whiz', look: 0, icon: '⚡', you: false, status: '' },
    { id: 'demo3', name: 'Professor', look: 6, icon: '🎓', you: false, status: '' },
  ]);
  lab.setFuel(0.6, true);
  show('home');
}

const handlers = {
  error(msg) {
    leaving = true;
    roomCode = null;
    ws?.close();
    $('home-error').textContent = msg.msg;
    history.replaceState(null, '', '/');
    atHome();
  },
  moved() {
    leaving = true;
    roomCode = null;
    $('home-error').textContent = 'You joined this lab from another tab or device.';
    atHome();
  },
  state(msg) {
    const was = state;
    state = msg;
    if (!roomCode) {
      sound.join();
      lab.setFuel(0, true);
    }
    roomCode = msg.code;
    if (new URLSearchParams(location.search).get('room') !== msg.code) history.replaceState(null, '', `/?room=${msg.code}`);
    if (msg.left !== null) {
      endsAt = performance.now() + msg.left;
      if (!was || was.phase !== msg.phase || was.round !== msg.round) phaseLength = Math.max(msg.left, 1);
    }
    const myself = msg.players.find((p) => p.id === msg.you);
    if (myself && was === null) myLevel = myself.level;
    if (!was || was.phase !== msg.phase || was.round !== msg.round) enterPhase(msg, was);
    draw();
  },
  question(msg) {
    if (question && question.round === msg.round && question.prompt === msg.prompt) {
      question.picked = msg.picked;
    } else {
      question = msg;
      revealed = null;
      lab.setExperiment(msg.exp, msg.scene);
      drawQuestion();
    }
    draw();
  },
  reveal(msg) {
    if (revealed && revealed.round === msg.round) return;
    revealed = msg;
    if (question) question.picked = msg.picked;
    hush();
    const seconds = lab.reveal();
    $('hint').textContent = 'Watch the experiment…';
    drawOptions();
    later(showResult, seconds * 1000 + 300);
  },
  cheer(msg) {
    lab.react(msg.id, 'cheer');
    sound.boing();
  },
};

// --- Screens ---------------------------------------------------------------------

function show(screen) {
  $('home').hidden = screen !== 'home';
  $('room').hidden = screen !== 'room';
  $('game').hidden = screen !== 'game';
  $('final').hidden = screen !== 'final';
  document.body.classList.toggle('playing', screen === 'game' || screen === 'final');
  measurePanel();
}

function enterPhase(s, was) {
  const phase = s.phase;
  lab.setPhase(phase);
  $('banner').hidden = true;
  if (phase === 'lobby') {
    question = null;
    revealed = null;
    resultRound = 0;
    lab.setFuel(0, true);
    show('room');
    return;
  }
  if (phase === 'final') {
    show('game');
    $('panel').hidden = true;
    $('timer').hidden = true;
    lab.setInset(0);
    lab.setFuel(s.fuel);
    sound.launch();
    const stop = milestoneFor(s.fuel);
    lab.launch(s.fuel, () => {
      if (state !== s && state?.phase !== 'final') return;
      sound.fanfare();
      drawFinal(stop);
      show('final');
      for (const p of state.players) lab.react(p.id, 'cheer');
    });
    // The lab-less page has no rocket to wait for.
    return;
  }
  show('game');
  if (phase === 'intro') {
    const exp = EXPERIMENTS[s.exp] || { title: 'Next experiment', icon: '🧪' };
    $('banner-icon').textContent = exp.icon;
    $('banner-sub').textContent = `Experiment ${s.round} of ${s.rounds}`;
    $('banner-title').textContent = exp.title;
    $('banner').hidden = false;
    $('panel').hidden = true;
    $('timer').hidden = true;
    lab.setInset(0);
    sound.intro();
  } else if (phase === 'question') {
    $('panel').hidden = false;
    $('timer').hidden = false;
    drawQuestion();
    // Every question is read out, at every level.
    if (question && question.picked === null) readAloud();
  } else if (phase === 'reveal') {
    $('panel').hidden = false;
    $('timer').hidden = true;
  }
  if (was === null && phase !== 'intro') drawQuestion();
}

function draw() {
  if (!state) return;
  const s = state;
  const resultOut = s.phase === 'reveal' && resultRound === s.round;

  lab.setPlayers(s.players.map((p) => ({
    id: p.id,
    name: p.name,
    look: p.look,
    icon: levelIcon(p.level),
    you: p.id === s.you,
    status: !p.here ? 'away'
      : s.phase === 'question' && p.answered ? 'done'
        : resultOut && p.last ? (p.last.correct ? 'right' : 'wrong') : '',
  })));

  if (s.phase === 'lobby') {
    $('room-code').textContent = s.code;
    const myself = s.players.find((p) => p.id === s.you);
    const host = s.players.find((p) => p.host);
    fillList($('roster'), s.players, (p, li) => {
      li.append(dot(p), `${levelIcon(p.level)} ${p.name}${p.host ? ' 👑' : ''}`);
    }, s.you);
    $('start').hidden = !myself?.host;
    $('room-waiting').hidden = Boolean(myself?.host);
    $('room-waiting').textContent = host ? `Waiting for ${host.name} to start…` : '';
    $('start').textContent = s.players.length === 1 ? '🚀 Start on my own' : '🚀 Start the experiments!';
    drawLooks(myself);
    $('room-levels').querySelectorAll('.level').forEach((b, i) => b.setAttribute('aria-checked', String(LEVELS[i].id === myself?.level)));
    return;
  }

  const exp = EXPERIMENTS[s.exp];
  $('round-pill').textContent = s.phase === 'final' ? '🚀 Lift-off!' : `${s.round}/${s.rounds} · ${exp ? `${exp.icon} ${exp.title}` : ''}`;
  // Scores and fuel move when the experiment has shown its result, not before.
  const pending = s.phase === 'reveal' && !resultOut;
  const possible = s.players.length * s.rounds;
  const fuel = pending && possible
    ? s.fuel - s.players.filter((p) => p.last?.correct).length / possible
    : s.fuel;
  $('fuel-fill').style.width = `${Math.round(fuel * 100)}%`;
  $('fuel-text').textContent = `${Math.round(fuel * 100)}%`;
  if (s.phase !== 'final') lab.setFuel(fuel);

  fillList($('chips'), s.players, (p, li) => {
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = String(pending && p.last ? p.score - p.last.gained : p.score);
    li.append(dot(p), p.name, score);
    let mark = '';
    if (!p.here) mark = '💤';
    else if (s.phase === 'question') mark = p.answered ? '✅' : '🤔';
    else if (resultOut && p.last) mark = p.last.correct ? `+${p.last.gained}` : '💭';
    if (mark) {
      const m = document.createElement('span');
      m.className = 'gain';
      m.textContent = mark;
      li.append(m);
    }
    li.classList.toggle('away', !p.here);
  }, s.you);

  if (s.phase === 'question' && question) {
    const waitingOn = s.players.filter((p) => p.here && !p.answered).length;
    if (question.picked !== null && question.picked !== undefined) {
      $('hint').textContent = waitingOn ? `Locked in! Waiting for ${waitingOn} more…` : 'Everyone is in!';
    } else {
      $('hint').textContent = '';
    }
  }
  measurePanel();
}

function dot(p) {
  const d = document.createElement('span');
  d.className = 'dot';
  d.style.background = LOOKS[p.look % LOOKS.length];
  return d;
}

function fillList(ul, players, fill, you) {
  ul.textContent = '';
  for (const p of players) {
    const li = document.createElement('li');
    if (p.id === you) li.classList.add('you');
    fill(p, li);
    ul.append(li);
  }
}

function drawLooks(myself) {
  const host = $('looks');
  if (!host.children.length) {
    LOOKS.forEach((colour, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'look';
      b.style.background = colour;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `Colour ${i + 1}`);
      b.addEventListener('click', () => {
        sound.tap();
        send({ t: 'set', look: i });
      });
      host.append(b);
    });
  }
  [...host.children].forEach((b, i) => b.setAttribute('aria-checked', String(myself?.look === i)));
}

// --- A question ------------------------------------------------------------------

function drawQuestion() {
  if (!question) return;
  $('prompt').textContent = question.prompt;
  $('result').hidden = true;
  $('fact').hidden = true;
  $('hint').textContent = '';
  drawOptions();
  measurePanel();
}

function drawOptions() {
  const host = $('options');
  const q = question;
  if (!q) return;
  host.textContent = '';
  const longest = Math.max(...q.options.map((o) => o.text.length));
  host.classList.toggle('stack', longest > 22);
  const out = revealed && resultRound === q.round;
  const locked = q.picked !== null && q.picked !== undefined;
  host.classList.toggle('locked', locked || Boolean(revealed));
  q.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    if (o.icon) {
      const e = document.createElement('span');
      e.className = 'emoji';
      e.textContent = o.icon;
      b.append(e);
    }
    if (o.color) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = o.color;
      b.append(sw);
    }
    const text = document.createElement('span');
    text.textContent = o.text;
    b.append(text);
    b.disabled = locked || Boolean(revealed) || state?.phase !== 'question';
    if (q.picked === i) b.classList.add('picked');
    if (out && revealed.answer === i) b.classList.add('right');
    if (out && q.picked === i && revealed.answer !== i) b.classList.add('missed');
    b.addEventListener('click', () => {
      if (question.picked !== null && question.picked !== undefined) return;
      question.picked = i;
      send({ t: 'answer', i });
      sound.pick();
      hush();
      drawOptions();
      draw();
    });
    host.append(b);
  });
}

function showResult() {
  if (!revealed || !state || state.phase !== 'reveal' || state.round !== revealed.round) return;
  resultRound = revealed.round;
  const r = revealed;
  const el = $('result');
  const right = Boolean(r.last?.correct);
  el.hidden = false;
  el.className = `result ${right ? 'good' : 'bad'}`;
  el.textContent = right ? `⭐ Correct! +${r.last.gained}`
    : r.picked === null ? "⏰ Time's up!" : '💭 Not this time!';
  $('fact').hidden = false;
  $('fact').textContent = r.fact;
  $('hint').textContent = '';
  drawOptions();
  if (right) sound.right();
  else sound.wrong();
  for (const p of state.players) {
    if (p.last && p.here) lab.react(p.id, p.last.correct ? 'right' : 'wrong');
  }
  draw();
  // And so are the answer and why.
  const verdict = right ? 'Correct!' : r.picked === null ? "Time's up!" : 'Not this time.';
  const answer = question?.options[r.answer]?.text;
  speak(`${verdict} ${answer ? `The answer is: ${answer}.` : ''} ${r.fact}`);
}

function readAloud() {
  if (!question) return;
  const options = question.options.map((o) => o.text);
  speak(`${question.prompt} ... ${options.slice(0, -1).join(', ')}, or ${options[options.length - 1]}?`);
}

// Tell the lab which part of the screen the panels and cards cover, so it can
// keep the stage in the part that's clear.
function measurePanel() {
  const wide = window.innerWidth >= 900 && window.innerHeight >= 560;
  const height = (el) => el.getBoundingClientRect().height;
  const width = (el) => el.getBoundingClientRect().width + window.innerWidth * 0.04;
  if (!$('game').hidden) {
    lab.setInset($('panel').hidden ? 0 : height($('panel')));
  } else if (!$('home').hidden) {
    const card = $('home').firstElementChild;
    lab.setInset(0, wide ? width(card) : 0);
  } else {
    const card = ($('room').hidden ? $('final') : $('room')).firstElementChild;
    if (wide) lab.setInset(0, -width(card));
    else lab.setInset(height(card));
  }
}
window.addEventListener('resize', measurePanel);
for (const id of ['room', 'final']) new ResizeObserver(measurePanel).observe($(id).firstElementChild);
new ResizeObserver(measurePanel).observe($('panel'));

function drawFinal(stop) {
  const s = state;
  const total = s.players.reduce((n, p) => n + p.correct, 0);
  $('final-title').textContent = `🚀 ${stop.text}`;
  $('final-team').textContent = `Your team got ${total} of ${s.players.length * s.rounds} right: ${Math.round(s.fuel * 100)}% fuel.`;
  const ranked = [...s.players].sort((a, b) => b.score - a.score);
  const ol = $('podium');
  ol.textContent = '';
  ranked.forEach((p, i) => {
    const li = document.createElement('li');
    if (p.id === s.you) li.classList.add('you');
    const medal = document.createElement('span');
    medal.className = 'medal';
    const place = ranked.findIndex((x) => x.score === p.score);
    medal.textContent = ['🥇', '🥈', '🥉'][place] || `${place + 1}`;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `${levelIcon(p.level)} ${p.name}`;
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.textContent = `${p.correct}/${s.rounds} ⭐`;
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = String(p.score);
    li.append(medal, dot(p), who, stars, score);
    ol.append(li);
    void i;
  });
  const myself = s.players.find((p) => p.id === s.you);
  const host = s.players.find((p) => p.host);
  $('again').hidden = !myself?.host;
  $('final-waiting').hidden = Boolean(myself?.host);
  $('final-waiting').textContent = host ? `${host.name} can start another game.` : '';
}

// --- Buttons ---------------------------------------------------------------------

$('create').addEventListener('click', () => {
  sound.tap();
  if (!ws) connect(null);
});
$('join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = $('code').value.trim().toUpperCase();
  if (code.length !== 4) {
    $('home-error').textContent = 'Type the 4-letter lab code.';
    return;
  }
  sound.tap();
  if (!ws) connect(code);
});
$('start').addEventListener('click', () => send({ t: 'start' }));
$('again').addEventListener('click', () => send({ t: 'again' }));
$('leave').addEventListener('click', leave);
$('final-leave').addEventListener('click', leave);
$('read').addEventListener('click', readAloud);
$('invite').addEventListener('click', async () => {
  const url = `${location.origin}/?room=${roomCode}`;
  const text = `Join my Crazy Science lab! Code ${roomCode}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Crazy Science', text, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied!', 2000);
    }
  } catch { /* closed the share sheet */ }
});
$('lab').addEventListener('pointerdown', () => {
  if (state && state.phase !== 'final') send({ t: 'cheer' });
});

function drawMute() {
  $('mute').textContent = sound.muted ? '🔇' : '🔊';
  $('mute').setAttribute('aria-pressed', String(sound.muted));
}
$('mute').addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  drawMute();
});
drawMute();

// The countdown bar, and ticks for the last five seconds.
let lastTick = 0;
function clock() {
  requestAnimationFrame(clock);
  if (!state || state.phase !== 'question') return;
  const left = Math.max(0, endsAt - performance.now());
  $('timer-fill').style.transform = `scaleX(${Math.min(1, left / phaseLength)})`;
  $('timer').classList.toggle('low', left < 6000);
  const second = Math.ceil(left / 1000);
  if (second <= 5 && second > 0 && second !== lastTick && question?.picked === null) {
    lastTick = second;
    sound.tick();
  }
}
clock();

// An invite link opens with the code filled in.
const invited = new URLSearchParams(location.search).get('room');
if (invited && /^[A-Za-z]{4}$/.test(invited)) {
  $('code').value = invited.toUpperCase();
  $('create').classList.add('alt');
  $('join-form').querySelector('button').classList.remove('alt');
  $('join-form').querySelector('button').textContent = `Join lab ${invited.toUpperCase()}`;
}
atHome();
