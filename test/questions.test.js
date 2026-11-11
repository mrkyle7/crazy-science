'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { LEVELS, EXPERIMENTS, makeQuestion } = require('../src/questions.js');

// A repeatable stream of "random" numbers.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('every experiment makes a sound question at every level', () => {
  for (const exp of Object.keys(EXPERIMENTS)) {
    for (const { id: level } of LEVELS) {
      const rng = seeded(level * 1000 + exp.length);
      for (let i = 0; i < 300; i++) {
        const q = makeQuestion(exp, level, rng);
        const where = `${exp} level ${level}: ${q.prompt}`;
        assert.strictEqual(q.exp, exp);
        assert.strictEqual(q.level, level);
        assert.ok(q.prompt.length > 5, where);
        assert.ok(q.options.length >= 2 && q.options.length <= 3, where);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, where);
        const texts = q.options.map((o) => o.text);
        assert.strictEqual(new Set(texts).size, texts.length, `two options read the same in ${where}`);
        assert.ok(q.fact.length > 5, where);
        assert.ok(q.scene && typeof q.scene === 'object', where);
        assert.doesNotMatch(JSON.stringify(q), /undefined|NaN/, where);
      }
    }
  }
});

test('the youngest level keeps questions short', () => {
  for (const exp of Object.keys(EXPERIMENTS)) {
    const rng = seeded(7);
    for (let i = 0; i < 100; i++) {
      const q = makeQuestion(exp, 1, rng);
      assert.ok(q.prompt.length <= 80, q.prompt);
    }
  }
});

test('things float when they are less dense than the liquid', () => {
  const rng = seeded(42);
  for (let i = 0; i < 300; i++) {
    const q = makeQuestion('float', 3, rng);
    const [thing] = q.scene.objects;
    const floats = thing.d < q.scene.liquid.d;
    assert.strictEqual(q.options[q.answer].text, floats ? 'Float' : 'Sink', q.prompt);
  }
});

test('the beam tips to the side with more turning power', () => {
  const rng = seeded(3);
  for (const level of [1, 2, 3]) {
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion('seesaw', level, rng);
      const { left, right } = q.scene;
      const diff = left.n * left.pos - right.n * right.pos;
      const want = diff === 0 ? 'Stays level' : diff > 0 ? 'Left' : 'Right';
      assert.strictEqual(q.options[q.answer].text, want, q.prompt);
    }
  }
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion('seesaw', 4, rng);
    const { left, right } = q.scene;
    assert.strictEqual(left.n * left.pos, right.n * right.pos, q.prompt);
    assert.strictEqual(q.options[q.answer].text, String(right.n));
  }
});

test('an unknown level falls back to a real one', () => {
  assert.strictEqual(makeQuestion('space', 99).level, 4);
  assert.strictEqual(makeQuestion('space', 'x').level, 1);
  assert.throws(() => makeQuestion('alchemy', 1));
});
