'use strict';

// Rooms of scientists, kept in memory. A game is a run of rounds; each round
// is one experiment:
//
//   lobby → [ intro → question → reveal ] × rounds → final → (again) lobby
//
// Every player answers a question at their own level (questions.js), scores
// for themselves, and adds fuel to the team's rocket, which launches in the
// final. The server owns the clock: `advance()` moves a room to its next
// phase, called by a timer, or straight away once everyone has answered.
//
// A player is a seat: 'u:<account id>' for signed-in players, 'g:<token>' for
// guests, so a dropped connection can come back to the same score.

const { EXPERIMENTS, makeQuestion, shuffled } = require('./questions');

const TIMES = { intro: 4500, question: 30000, reveal: 12000, allAnswered: 900, emptyRoom: 5 * 60 * 1000 };
const MAX_PLAYERS = 8;
const LOOKS = 8;
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
const POINTS = 100;
const SPEED_BONUS = 30;

function cleanName(name) {
  // eslint-disable-next-line no-control-regex
  return String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

function createRooms({ rng = Math.random, now = Date.now, timers = true, times = TIMES } = {}) {
  const rooms = new Map();
  let nextId = 1;

  function newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function schedule(room, ms) {
    clearTimeout(room.timer);
    room.timer = null;
    room.endsAt = ms ? now() + ms : null;
    if (ms && timers) {
      room.timer = setTimeout(() => advance(room), ms);
      room.timer.unref?.();
    }
  }

  function connected(room) {
    return room.players.filter((p) => p.send);
  }

  function host(room) {
    return connected(room)[0] || room.players[0] || null;
  }

  function publicState(room) {
    const h = host(room);
    const showAnswers = room.phase === 'reveal' || room.phase === 'final';
    const possible = room.players.length * room.plan.length;
    return {
      t: 'state',
      code: room.code,
      phase: room.phase,
      round: room.round,
      rounds: room.plan.length,
      exp: room.phase === 'lobby' || room.phase === 'final' ? null : room.plan[room.round - 1],
      left: room.endsAt ? Math.max(0, room.endsAt - now()) : null,
      fuel: possible ? room.players.reduce((n, p) => n + p.correct, 0) / possible : 0,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        look: p.look,
        score: p.score,
        correct: p.correct,
        host: p === h,
        here: Boolean(p.send),
        answered: p.answer !== null,
        last: showAnswers ? p.last : null,
      })),
    };
  }

  function questionFor(room, p) {
    if (!p.q) p.q = makeQuestion(room.plan[room.round - 1], p.level, rng);
    return p.q;
  }

  // What one player needs beyond the shared state: their own question, and
  // in the reveal, how they did.
  function personal(room, p) {
    if (!p.send) return;
    if (room.phase === 'intro' || room.phase === 'question' || room.phase === 'reveal') {
      const q = questionFor(room, p);
      p.send({
        t: 'question', round: room.round, exp: q.exp, level: q.level, prompt: q.prompt,
        options: q.options, scene: q.scene, picked: p.answer,
      });
      if (room.phase === 'reveal') {
        p.send({ t: 'reveal', round: room.round, answer: q.answer, fact: q.fact, picked: p.answer, last: p.last });
      }
    }
  }

  function broadcast(room) {
    const state = publicState(room);
    for (const p of connected(room)) p.send({ ...state, you: p.id });
  }

  function enter(room, phase) {
    room.phase = phase;
    if (phase === 'intro') {
      room.round += 1;
      for (const p of room.players) {
        p.q = null;
        p.answer = null;
        p.last = null;
      }
      schedule(room, times.intro);
    } else if (phase === 'question') {
      room.questionStarted = now();
      schedule(room, times.question);
    } else if (phase === 'reveal') {
      for (const p of room.players) {
        const q = questionFor(room, p);
        const correct = p.answer === q.answer;
        const gained = correct ? POINTS + Math.round(SPEED_BONUS * p.speed) : 0;
        p.last = { correct, gained, answered: p.answer !== null };
        if (correct) {
          p.score += gained;
          p.correct += 1;
        }
      }
      schedule(room, times.reveal);
    } else {
      schedule(room, 0);
    }
    broadcast(room);
    for (const p of room.players) personal(room, p);
  }

  function advance(room) {
    if (!rooms.has(room.code)) return;
    if (room.phase === 'intro') enter(room, 'question');
    else if (room.phase === 'question') enter(room, 'reveal');
    else if (room.phase === 'reveal') enter(room, room.round >= room.plan.length ? 'final' : 'intro');
  }

  function reset(room) {
    room.round = 0;
    room.plan = [];
    // Whoever left during the game doesn't sit in the next lobby.
    room.players = room.players.filter((p) => p.send);
    for (const p of room.players) Object.assign(p, { score: 0, correct: 0, q: null, answer: null, last: null, speed: 0 });
    enter(room, 'lobby');
  }

  function watchEmpty(room) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
    if (connected(room).length) return;
    if (!timers) return;
    room.emptyTimer = setTimeout(() => close(room), room.players.length ? times.emptyRoom : 0);
    room.emptyTimer.unref?.();
  }

  function close(room) {
    clearTimeout(room.timer);
    clearTimeout(room.emptyTimer);
    rooms.delete(room.code);
  }

  // --- What players do -----------------------------------------------------------

  // Sit `seat` in a room (a new one without `code`) and send it updates
  // through `send`. Returns { room, player } or { error }.
  function join({ code, seat, name, level, look, send }) {
    let room;
    if (code) {
      room = rooms.get(String(code).toUpperCase());
      if (!room) return { error: "We can't find that lab. Check the code and try again." };
    } else {
      room = {
        code: newCode(), players: [], phase: 'lobby', round: 0, plan: [],
        timer: null, endsAt: null, emptyTimer: null, questionStarted: 0,
      };
      rooms.set(room.code, room);
    }

    let p = room.players.find((x) => x.seat === seat);
    if (p) {
      // The same player from another tab or after a dropped connection.
      if (p.send && p.kick) p.kick();
    } else {
      if (room.players.length >= MAX_PLAYERS) return { error: 'That lab is full (8 scientists).' };
      const taken = new Set(room.players.map((x) => x.look));
      let freeLook = 0;
      while (taken.has(freeLook) && freeLook < LOOKS - 1) freeLook += 1;
      p = {
        seat, id: `p${nextId++}`, name: 'Scientist', level: 2, look: freeLook,
        score: 0, correct: 0, q: null, answer: null, last: null, speed: 0, send: null, kick: null,
      };
      room.players.push(p);
    }
    p.send = send;
    const shown = cleanName(name);
    if (shown) p.name = shown;
    applyOptions(p, { level, look });
    watchEmpty(room);
    broadcast(room);
    personal(room, p);
    return { room, player: p };
  }

  function applyOptions(p, { level, look }) {
    if ([1, 2, 3, 4].includes(level)) p.level = level;
    if (Number.isInteger(look) && look >= 0 && look < LOOKS) p.look = look;
  }

  // Level and look. The level counts from the next question on.
  function setOptions(room, p, options) {
    applyOptions(p, options || {});
    broadcast(room);
  }

  function leave(room, p, send) {
    if (p.send !== send) return; // an older connection of a seat that has moved on
    p.send = null;
    p.kick = null;
    if (room.phase === 'lobby') room.players = room.players.filter((x) => x !== p);
    broadcast(room);
    maybeFinishQuestion(room);
    watchEmpty(room);
  }

  function start(room, p) {
    if (p !== host(room) || room.phase !== 'lobby') return;
    room.plan = shuffled(rng, Object.keys(EXPERIMENTS));
    room.round = 0;
    enter(room, 'intro');
  }

  function answer(room, p, index) {
    if (room.phase !== 'question' || p.answer !== null) return;
    const q = questionFor(room, p);
    if (!Number.isInteger(index) || index < 0 || index >= q.options.length) return;
    p.answer = index;
    const span = times.question || 1;
    p.speed = Math.min(1, Math.max(0, 1 - (now() - room.questionStarted) / span));
    broadcast(room);
    maybeFinishQuestion(room);
  }

  function maybeFinishQuestion(room) {
    if (room.phase !== 'question') return;
    const here = connected(room);
    if (!here.length || here.some((p) => p.answer === null)) return;
    const left = room.endsAt - now();
    if (left > times.allAnswered) schedule(room, times.allAnswered);
  }

  function again(room, p) {
    if (p !== host(room) || room.phase !== 'final') return;
    reset(room);
  }

  // A little jump everyone sees.
  function cheer(room, p) {
    const t = now();
    if (t - (p.cheered || 0) < 700) return;
    p.cheered = t;
    for (const x of connected(room)) x.send({ t: 'cheer', id: p.id });
  }

  return { rooms, join, leave, setOptions, start, answer, again, cheer, advance, publicState, close };
}

module.exports = { createRooms, cleanName, TIMES, MAX_PLAYERS };
