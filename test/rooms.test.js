'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createRooms, cleanName, MAX_PLAYERS } = require('../src/rooms.js');

// Rooms with no timers: the tests move the clock and call advance().
function setup() {
  const clock = { t: 1000 };
  const rooms = createRooms({ timers: false, now: () => clock.t });
  const sit = (code, seat, extra = {}) => {
    const inbox = [];
    const result = rooms.join({ code, seat, name: seat, send: (m) => inbox.push(m), ...extra });
    const last = (type) => inbox.filter((m) => m.t === type).pop();
    return { ...result, inbox, last, send: result.player?.send };
  };
  return { rooms, clock, sit };
}

test('a new room has a four-letter code and its first player hosts', () => {
  const { sit } = setup();
  const a = sit(null, 'ann');
  assert.match(a.room.code, /^[A-Z]{4}$/);
  const b = sit(a.room.code.toLowerCase(), 'bob', { level: 4 });
  assert.strictEqual(b.room, a.room);
  const state = b.last('state');
  assert.strictEqual(state.phase, 'lobby');
  assert.deepStrictEqual(state.players.map((p) => [p.name, p.host, p.level]), [['ann', true, 2], ['bob', false, 4]]);
  assert.notStrictEqual(state.players[0].look, state.players[1].look);
  assert.strictEqual(state.you, b.player.id);
});

test('joining a room that is missing or full says why', () => {
  const { sit } = setup();
  assert.match(sit('ZZZZ', 'ann').error, /can't find/);
  const a = sit(null, 'p0');
  for (let i = 1; i < MAX_PLAYERS; i++) sit(a.room.code, `p${i}`);
  assert.match(sit(a.room.code, 'late').error, /full/);
});

test('a whole game: questions at each level, scores, fuel and the final', () => {
  const { rooms, clock, sit } = setup();
  const a = sit(null, 'ann', { level: 1 });
  const b = sit(a.room.code, 'bob', { level: 4 });
  rooms.start(a.room, b.player); // only the host may start
  assert.strictEqual(a.room.phase, 'lobby');
  rooms.start(a.room, a.player);
  assert.strictEqual(a.room.phase, 'intro');
  assert.strictEqual(a.last('state').rounds, 7);

  for (let round = 1; round <= 7; round++) {
    const qa = a.last('question');
    const qb = b.last('question');
    assert.strictEqual(qa.round, round);
    assert.strictEqual(qa.exp, qb.exp);
    assert.strictEqual(qa.level, 1);
    assert.strictEqual(qb.level, 4);
    assert.strictEqual(qa.answer, undefined, 'the answer stays on the server');
    assert.strictEqual(qa.fact, undefined);

    rooms.answer(a.room, a.player, 0); // too early: still the intro
    assert.strictEqual(a.player.answer, null);
    rooms.advance(a.room);
    assert.strictEqual(a.room.phase, 'question');

    clock.t += 3000;
    rooms.answer(a.room, a.player, a.player.q.answer); // Ann is always right
    rooms.answer(a.room, a.player, 1); // and can't change her mind
    assert.strictEqual(a.player.answer, a.player.q.answer);
    assert.strictEqual(b.last('state').players[0].answered, true);
    rooms.answer(a.room, b.player, 99); // not an option
    assert.strictEqual(b.player.answer, null);
    rooms.answer(a.room, b.player, (b.player.q.answer + 1) % b.player.q.options.length); // Bob never is

    rooms.advance(a.room);
    assert.strictEqual(a.room.phase, 'reveal');
    const ra = a.last('reveal');
    assert.strictEqual(ra.answer, a.player.q.answer);
    assert.ok(ra.fact);
    assert.deepStrictEqual(ra.last, { correct: true, gained: 127, answered: true });
    assert.strictEqual(b.last('reveal').last.correct, false);
    rooms.advance(a.room);
  }

  assert.strictEqual(a.room.phase, 'final');
  const end = a.last('state');
  assert.strictEqual(end.fuel, 0.5);
  assert.deepStrictEqual(end.players.map((p) => [p.score, p.correct]), [[127 * 7, 7], [0, 0]]);

  rooms.again(a.room, b.player);
  assert.strictEqual(a.room.phase, 'final');
  rooms.again(a.room, a.player);
  assert.strictEqual(a.room.phase, 'lobby');
  assert.deepStrictEqual(a.last('state').players.map((p) => p.score), [0, 0]);
});

test('the question ends early once everyone here has answered', () => {
  const { rooms, clock, sit } = setup();
  const a = sit(null, 'ann');
  const b = sit(a.room.code, 'bob');
  rooms.start(a.room, a.player);
  rooms.advance(a.room);
  const full = a.room.endsAt - clock.t;
  rooms.answer(a.room, a.player, 0);
  assert.strictEqual(a.room.endsAt - clock.t, full);
  rooms.answer(a.room, b.player, 0);
  assert.ok(a.room.endsAt - clock.t < 1000);
});

test('a dropped player keeps their seat and score, and the host moves on', () => {
  const { rooms, sit } = setup();
  const a = sit(null, 'ann');
  const b = sit(a.room.code, 'bob');
  rooms.start(a.room, a.player);
  rooms.advance(a.room);
  rooms.answer(a.room, a.player, a.player.q.answer);
  rooms.advance(a.room);
  const score = a.player.score;
  assert.ok(score > 0);

  rooms.leave(a.room, a.player, a.send);
  let state = b.last('state');
  assert.deepStrictEqual(state.players.map((p) => [p.here, p.host]), [[false, false], [true, true]]);

  const back = sit(a.room.code, 'ann');
  assert.strictEqual(back.player, a.player);
  assert.strictEqual(back.player.score, score);
  state = back.last('state');
  assert.strictEqual(state.players.length, 2);
  assert.ok(back.last('question'), 'gets the round in play');
  assert.ok(back.last('reveal'));
});

test('leaving the lobby frees the seat; a second tab takes over the first', () => {
  const { rooms, sit } = setup();
  const a = sit(null, 'ann');
  const b = sit(a.room.code, 'bob');
  rooms.leave(a.room, b.player, b.send);
  assert.strictEqual(a.last('state').players.length, 1);

  let kicked = false;
  a.player.kick = () => { kicked = true; };
  const tab = sit(a.room.code, 'ann');
  assert.ok(kicked);
  assert.strictEqual(tab.player, a.player);
  rooms.leave(a.room, a.player, a.send); // the old tab closing changes nothing
  assert.ok(a.player.send);
  assert.strictEqual(a.room.players.length, 1);
});

test('level and colour can change; the level counts from the next question', () => {
  const { rooms, sit } = setup();
  const a = sit(null, 'ann', { level: 1 });
  rooms.setOptions(a.room, a.player, { level: 3, look: 5 });
  rooms.setOptions(a.room, a.player, { level: 9, look: -1 });
  assert.strictEqual(a.player.level, 3);
  assert.strictEqual(a.player.look, 5);
});

test('names are tidied', () => {
  assert.strictEqual(cleanName('  Mia   the <b>Great</b> scientist  '), 'Mia the bGreat/b');
  assert.strictEqual(cleanName(null), '');
});
