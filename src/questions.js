'use strict';

// Every round is one experiment, and every player gets a question about it
// at their own level, so a five-year-old and a grown-up can play the same
// game. A question carries a `scene`: what the player's 3D lab bench shows,
// and what happens on it when the answer is revealed.
//
//   makeQuestion('float', 1, rng) →
//     { exp, level, prompt, options: [{ text, icon?, color? }], answer, fact, scene }
//
// `answer` (an index into options) and `fact` stay on the server until the
// reveal.

const LEVELS = [
  { id: 1, name: 'Sprout', ages: 'Age 5+', icon: '🌱' },
  { id: 2, name: 'Explorer', ages: 'Age 8+', icon: '🔍' },
  { id: 3, name: 'Whiz', ages: 'Age 10+', icon: '⚡' },
  { id: 4, name: 'Professor', ages: 'Grown-ups', icon: '🎓' },
];

const EXPERIMENTS = {
  float: { title: 'Float or Sink?', icon: '🛁' },
  colour: { title: 'Colour Lab', icon: '🎨' },
  drop: { title: 'Gravity Drop', icon: '🪶' },
  seesaw: { title: 'Balance Beam', icon: '⚖️' },
  magnet: { title: 'Magnet Magic', icon: '🧲' },
  circuit: { title: 'Bright Sparks', icon: '💡' },
  space: { title: 'Space Station', icon: '🪐' },
};

// Things that turn up on the bench. `d` is density in g/cm³.
const ITEMS = {
  duck: { name: 'rubber duck', d: 0.2, icon: '🦆' },
  stone: { name: 'stone', d: 2.6, icon: '🪨' },
  wood: { name: 'wooden block', d: 0.6, icon: '🪵' },
  coin: { name: 'coin', d: 8.9, icon: '🪙' },
  ice: { name: 'ice cube', d: 0.92, icon: '🧊' },
  apple: { name: 'apple', d: 0.8, icon: '🍎' },
  cork: { name: 'cork', d: 0.24, icon: '🍾' },
  steel: { name: 'steel ball', d: 7.8, icon: '⚙️' },
  grape: { name: 'grape', d: 1.1, icon: '🍇' },
  egg: { name: 'fresh egg', d: 1.03, icon: '🥚' },
  brick: { name: 'brick', d: 1.9, icon: '🧱' },
  ball: { name: 'beach ball', d: 0.05, icon: '🏐' },
  marble: { name: 'glass marble', d: 2.5, icon: '🔮' },
  candle: { name: 'candle', d: 0.9, icon: '🕯️' },
  gold: { name: 'gold bar', d: 19.3, icon: '🥇' },
  feather: { name: 'feather', icon: '🪶' },
  bowling: { name: 'bowling ball', icon: '🎳' },
  hammer: { name: 'hammer', icon: '🔨' },
  tennis: { name: 'tennis ball', icon: '🎾' },
  cannon: { name: 'cannonball', icon: '⚫' },
  paper: { name: 'flat sheet of paper', icon: '📄' },
  crumple: { name: 'scrunched-up paper ball', icon: '⚪' },
  leaf: { name: 'leaf', icon: '🍃' },
  clip: { name: 'paper clip', icon: '📎' },
  nail: { name: 'iron nail', icon: '📌' },
  bolt: { name: 'steel bolt', icon: '🔩' },
  scissors: { name: 'pair of steel scissors', icon: '✂️' },
  lego: { name: 'plastic brick', icon: '🧱' },
  can: { name: 'aluminium drinks can', icon: '🥫' },
  ring: { name: 'gold ring', icon: '💍' },
  foil: { name: 'ball of kitchen foil', icon: '🌕' },
  spoon: { name: 'metal spoon', icon: '🥄' },
  pencil: { name: 'pencil lead', icon: '✏️' },
  saltwater: { name: 'cup of salty water', icon: '🧂' },
  purewater: { name: 'cup of pure water', icon: '💧' },
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Options as given, with `answer` the index of the right one.
function fixed(prompt, options, answer, fact, scene) {
  return { prompt, options: options.map(asOption), answer, fact, scene };
}

// The right option first, then the wrong ones; shuffled for the player.
function mixed(rng, prompt, right, wrong, fact, scene) {
  const options = shuffled(rng, [right, ...wrong].map(asOption));
  const want = asOption(right).text;
  return { prompt, options, answer: options.findIndex((o) => o.text === want), fact, scene };
}

const asOption = (o) => (typeof o === 'string' ? { text: o } : o);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Float or sink ---------------------------------------------------------------

const LIQUIDS = {
  water: { name: 'water', d: 1.0, color: '#3aa8ff' },
  seawater: { name: 'sea water', d: 1.03, color: '#2f9bd6' },
  saltwater: { name: 'very salty water', d: 1.2, color: '#59c2c9' },
  oil: { name: 'cooking oil', d: 0.9, color: '#e8c63c' },
  honey: { name: 'runny honey', d: 1.4, color: '#e09a1f' },
  mercury: { name: 'liquid mercury', d: 13.6, color: '#c9d1d9' },
};
const FLOAT_SINK = [{ text: 'Float', icon: '⬆️' }, { text: 'Sink', icon: '⬇️' }];

const FLOAT_FACTS = {
  ice: 'Ice is a little lighter than water. That is why icebergs float!',
  grape: 'A grape is just a bit denser than water, so down it goes.',
  egg: 'A fresh egg sinks in tap water. A very old egg floats, because it has more air inside!',
  candle: 'Candle wax is lighter than water, so candles float.',
  cork: 'Cork is full of tiny air pockets, so it bobs right on top.',
  marble: 'Glass is more than twice as dense as water.',
  apple: 'An apple is about a quarter air inside. That is why you can bob for apples!',
};

function floatScene(liquid, kinds) {
  return { liquid: LIQUIDS[liquid], objects: kinds.map((kind) => ({ kind, d: ITEMS[kind].d })) };
}

function floatQuestion(level, rng) {
  if (level === 1) {
    const kind = pick(rng, ['duck', 'stone', 'wood', 'coin', 'apple', 'ball', 'brick', 'steel']);
    const item = ITEMS[kind];
    const floats = item.d < 1;
    return fixed(`Will the ${item.name} float or sink?`, FLOAT_SINK, floats ? 0 : 1,
      floats
        ? `The ${item.name} is lighter than the water it pushes away, so the water holds it up!`
        : `The ${item.name} is heavier than the water it pushes away, so down it goes!`,
      floatScene('water', [kind]));
  }

  if (level === 2) {
    if (rng() < 0.5) {
      const kind = pick(rng, Object.keys(FLOAT_FACTS));
      const item = ITEMS[kind];
      return fixed(`Will the ${item.name} float or sink in water?`, FLOAT_SINK, item.d < 1 ? 0 : 1,
        FLOAT_FACTS[kind], floatScene('water', [kind]));
    }
    const floaters = shuffled(rng, ['duck', 'wood', 'apple', 'cork', 'ice', 'candle', 'ball']);
    const sinkers = shuffled(rng, ['stone', 'coin', 'steel', 'grape', 'egg', 'brick', 'marble']);
    const wantFloat = rng() < 0.5;
    const odd = wantFloat ? floaters[0] : sinkers[0];
    const others = wantFloat ? sinkers.slice(0, 2) : floaters.slice(0, 2);
    const kinds = shuffled(rng, [odd, ...others]);
    return fixed(`Three things drop into the water. Which one will ${wantFloat ? 'FLOAT' : 'SINK'}?`,
      kinds.map((k) => ({ text: cap(ITEMS[k].name), icon: ITEMS[k].icon })), kinds.indexOf(odd),
      wantFloat
        ? `Only the ${ITEMS[odd].name} is less dense than water, so only it floats.`
        : `Only the ${ITEMS[odd].name} is denser than water, so only it sinks.`,
      floatScene('water', kinds));
  }

  if (level === 3) {
    if (rng() < 0.3) {
      return fixed('A fresh egg sinks in tap water. What will it do in VERY salty water?', FLOAT_SINK, 0,
        'Salt makes water denser. The egg is now lighter than the liquid, so it floats, just like swimmers in the Dead Sea!',
        floatScene('saltwater', ['egg']));
    }
    const liquidKey = pick(rng, ['water', 'water', 'saltwater', 'oil', 'honey']);
    const liquid = LIQUIDS[liquidKey];
    const kind = pick(rng, Object.keys(ITEMS).filter((k) => ITEMS[k].d && k !== 'gold'
      && Math.abs(ITEMS[k].d - liquid.d) > 0.07));
    const item = ITEMS[kind];
    const floats = item.d < liquid.d;
    return fixed(`${cap(liquid.name)} has a density of ${liquid.d} g/cm³. The ${item.name} is ${item.d} g/cm³. Float or sink?`,
      FLOAT_SINK, floats ? 0 : 1,
      `${item.d} is ${floats ? 'less' : 'more'} than ${liquid.d}, so it ${floats ? 'floats' : 'sinks'}. Things float when they are less dense than the liquid.`,
      floatScene(liquidKey, [kind]));
  }

  const kind4 = pick(rng, ['iceberg', 'mercury-steel', 'mercury-gold', 'fraction', 'fraction']);
  if (kind4 === 'iceberg') {
    return fixed('Ice is 0.92 g/cm³ and sea water is 1.03 g/cm³. Roughly how much of an iceberg hides below the surface?',
      ['About half', 'About three quarters', 'About 90%'], 2,
      '0.92 ÷ 1.03 ≈ 0.89. Nearly nine tenths of an iceberg is under water: "the tip of the iceberg".',
      floatScene('seawater', ['ice']));
  }
  if (kind4 === 'mercury-steel' || kind4 === 'mercury-gold') {
    const k = kind4 === 'mercury-steel' ? 'steel' : 'gold';
    const floats = ITEMS[k].d < 13.6;
    return fixed(`Liquid mercury has a density of 13.6 g/cm³. A ${ITEMS[k].name} (${ITEMS[k].d} g/cm³) is dropped in. What happens?`,
      ['It floats', 'It hovers in the middle', 'It sinks'], floats ? 0 : 2,
      floats
        ? 'Steel floats on mercury! Mercury is so dense that even a cannonball bobs on top.'
        : 'Gold is one of the few things dense enough to sink in mercury.',
      floatScene('mercury', [k]));
  }
  const k = pick(rng, ['wood', 'apple', 'cork']);
  const pct = Math.round(ITEMS[k].d * 100);
  return mixed(rng, `A ${ITEMS[k].name} has a density of ${ITEMS[k].d} g/cm³. How much of it sits below the waterline?`,
    `${pct}%`, [`${100 - pct}%`, '50%'],
    `A floating object sinks until it has pushed aside its own weight of water: ${ITEMS[k].d} ÷ 1.0 = ${pct}% under. Archimedes worked this out in his bath!`,
    floatScene('water', [k]));
}

// --- Colour lab ------------------------------------------------------------------

const PAINT = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e63e9', orange: '#fb8c00', green: '#43a047',
  purple: '#8e24aa', white: '#f5f5f5', black: '#1b1b1b', pink: '#f48fb1', grey: '#9e9e9e',
  'light blue': '#81d4fa', brown: '#795548', cyan: '#00bcd4', magenta: '#e91e9c',
};
const LIGHT = {
  red: '#ff0000', green: '#00ff00', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff',
  magenta: '#ff00ff', white: '#ffffff', black: '#000000', orange: '#ff8800', brown: '#795548',
  purple: '#8e24aa',
};
const swatch = (table, name) => ({ text: cap(name), color: table[name] });

function colourQuestion(level, rng) {
  const primaries = [['red', 'yellow', 'orange'], ['blue', 'yellow', 'green'], ['red', 'blue', 'purple']];
  const paintScene = (a, b, result) => ({ mode: 'paint', a: PAINT[a], b: PAINT[b], result: PAINT[result] });

  if (level === 1) {
    const [a, b, result] = pick(rng, primaries);
    const wrong = shuffled(rng, ['orange', 'green', 'purple', 'pink', 'brown'].filter((c) => c !== result)).slice(0, 2);
    return mixed(rng, `Mix ${a} paint and ${b} paint. What colour do you get?`,
      swatch(PAINT, result), wrong.map((c) => swatch(PAINT, c)),
      `${cap(a)} and ${b} make ${result}!`, paintScene(a, b, result));
  }

  if (level === 2) {
    if (rng() < 0.4) {
      const [a, b, result] = pick(rng, primaries);
      const pairs = primaries.map(([x, y]) => `${cap(x)} + ${cap(y)}`);
      return mixed(rng, `Which two paints mix to make ${result}?`,
        `${cap(a)} + ${cap(b)}`, pairs.filter((p) => p !== `${cap(a)} + ${cap(b)}`),
        `${cap(a)} and ${b} make ${result}. Red, yellow and blue are the painter's primary colours.`,
        paintScene(a, b, result));
    }
    const [a, b, result] = pick(rng, [['red', 'white', 'pink'], ['black', 'white', 'grey'],
      ['blue', 'white', 'light blue'], ['red', 'green', 'brown'], ...primaries]);
    const wrong = shuffled(rng, ['orange', 'green', 'purple', 'pink', 'brown', 'grey', 'light blue']
      .filter((c) => c !== result)).slice(0, 2);
    return mixed(rng, `Mix ${a} paint and ${b} paint. What colour do you get?`,
      swatch(PAINT, result), wrong.map((c) => swatch(PAINT, c)),
      result === 'brown'
        ? 'Red and green are opposites on the colour wheel. Mixed as paint they make a muddy brown.'
        : `${cap(a)} and ${b} make ${result}.`,
      paintScene(a, b, result));
  }

  if (level === 3) {
    const [lights, result, wrong] = pick(rng, [
      [['red', 'green'], 'yellow', ['brown', 'white']],
      [['red', 'blue'], 'magenta', ['black', 'orange']],
      [['green', 'blue'], 'cyan', ['brown', 'yellow']],
      [['red', 'green', 'blue'], 'white', ['black', 'brown']],
    ]);
    const list = lights.length === 3 ? 'red, green and blue lights' : `a ${lights[0]} light and a ${lights[1]} light`;
    return mixed(rng, `Shine ${list} on the same spot. What colour do you see?`,
      swatch(LIGHT, result), wrong.map((c) => swatch(LIGHT, c)),
      `Light mixes differently from paint: it adds up! Every colour on a screen is made from red, green and blue light.`,
      { mode: 'light', lights: lights.map((c) => LIGHT[c]) });
  }

  const kind = pick(rng, ['ink', 'ink', 'filter', 'opposite']);
  if (kind === 'ink') {
    const [a, b, result] = pick(rng, [['cyan', 'magenta', 'blue'], ['magenta', 'yellow', 'red'], ['cyan', 'yellow', 'green']]);
    return mixed(rng, `A printer mixes ${a} ink and ${b} ink. What colour is printed?`,
      swatch(PAINT, result), ['blue', 'red', 'green'].filter((c) => c !== result).map((c) => swatch(PAINT, c)),
      'Inks take colours away from white light. Cyan soaks up red, magenta soaks up green and yellow soaks up blue; what is left is what you see.',
      paintScene(a, b, result));
  }
  if (kind === 'filter') {
    const [a, b, result, wrong] = pick(rng, [
      ['red', 'green', 'black', ['yellow', 'white']],
      ['yellow', 'cyan', 'green', ['white', 'black']],
      ['magenta', 'yellow', 'red', ['orange', 'black']],
    ]);
    const label = (c) => (c === 'black' ? { text: 'No light at all', color: LIGHT.black } : swatch(LIGHT, c));
    return mixed(rng, `White light shines through a ${a} filter, then a ${b} filter. What comes out?`,
      label(result), wrong.map(label),
      result === 'black'
        ? 'A red filter only lets red light through, and a green filter blocks red. Nothing gets past both!'
        : `Each filter removes part of the light. Only ${result} gets through both.`,
      { mode: 'filter', filters: [LIGHT[a], LIGHT[b]], result: LIGHT[result] });
  }
  return mixed(rng, 'Shine a yellow light and a blue light on the same spot. What colour do you see?',
    swatch(LIGHT, 'white'), [{ text: 'Green', color: '#00ff00' }, swatch(LIGHT, 'black')],
    'Yellow light is red plus green. Add blue and you have all three: white! Blue and yellow are complementary colours.',
    { mode: 'light', lights: [LIGHT.yellow, LIGHT.blue] });
}

// --- Gravity drop ----------------------------------------------------------------

// `k` is how strongly air slows a thing down (0: not at all).
const AIR = { feather: 6, leaf: 4.5, paper: 3.2 };
const G = { earth: 9.8, moon: 1.62, jupiter: 24.8 };

function dropScene(place, kinds, { h = 5, stopwatch = false, places = null, vacuum = false, g = null } = {}) {
  return {
    place, h, stopwatch,
    drops: kinds.map((kind, i) => {
      const where = places ? places[i] : place;
      const air = where === 'earth' && !vacuum;
      return { kind, where, g: g || G[where], k: air ? (AIR[kind] || 0) : 0 };
    }),
  };
}

function dropOptions(a, b) {
  return [
    { text: cap(ITEMS[a].name), icon: ITEMS[a].icon },
    { text: 'Both together', icon: '🤝' },
    { text: cap(ITEMS[b].name), icon: ITEMS[b].icon },
  ];
}

function dropQuestion(level, rng) {
  const slowFall = (heavy, light) => {
    const flip = rng() < 0.5;
    const [a, b] = flip ? [light, heavy] : [heavy, light];
    return fixed(`We drop a ${ITEMS[a].name} and a ${ITEMS[b].name} at the same time. Which lands first?`,
      dropOptions(a, b), flip ? 2 : 0,
      `Air pushes up on the ${ITEMS[light].name} and slows it down. The ${ITEMS[heavy].name} zooms straight through.`,
      dropScene('earth', [a, b]));
  };

  if (level === 1) {
    return slowFall(...pick(rng, [['bowling', 'feather'], ['stone', 'leaf'], ['apple', 'feather']]));
  }

  if (level === 2) {
    const kind = pick(rng, ['same', 'same', 'paper', 'slow']);
    if (kind === 'slow') return slowFall('bowling', 'feather');
    if (kind === 'paper') {
      const flip = rng() < 0.5;
      const [a, b] = flip ? ['paper', 'crumple'] : ['crumple', 'paper'];
      return fixed('Two sheets of paper weigh the same. One is flat, one is scrunched into a ball. Which lands first?',
        dropOptions(a, b), flip ? 2 : 0,
        'Same weight, but the flat sheet catches much more air. Shape matters!',
        dropScene('earth', [a, b]));
    }
    const [a, b] = pick(rng, [['bowling', 'marble'], ['cannon', 'tennis'], ['stone', 'apple']]);
    return fixed(`We drop a heavy ${ITEMS[a].name} and a light ${ITEMS[b].name} at the same time. Which lands first?`,
      dropOptions(a, b), 1,
      'They land together! Gravity speeds up heavy and light things at the same rate. Galileo worked this out 400 years ago.',
      dropScene('earth', [a, b]));
  }

  if (level === 3) {
    const kind = pick(rng, ['moon', 'vacuum', 'earth-moon', 'jupiter']);
    if (kind === 'moon') {
      return fixed('An astronaut on the Moon drops a hammer and a feather at the same time. Which lands first?',
        dropOptions('hammer', 'feather'), 1,
        'There is no air on the Moon, so nothing slows the feather. Astronaut David Scott really did this on Apollo 15 in 1971!',
        dropScene('moon', ['hammer', 'feather'], { h: 2 }));
    }
    if (kind === 'vacuum') {
      return fixed('All the air is pumped out of a tall glass tube. Inside, a coin and a feather are dropped. Which lands first?',
        dropOptions('coin', 'feather'), 1,
        'With no air to slow it, the feather falls just as fast as the coin.',
        dropScene('earth', ['coin', 'feather'], { vacuum: true }));
    }
    const other = kind === 'jupiter' ? 'jupiter' : 'moon';
    const flip = rng() < 0.5;
    const places = flip ? [other, 'earth'] : ['earth', other];
    return fixed(`The same ball is dropped from the same height on Earth and on ${cap(other)}. Where does it land first?`,
      [{ text: `On ${cap(places[0])}`, icon: places[0] === 'earth' ? '🌍' : other === 'moon' ? '🌙' : '🪐' },
        { text: 'Same time', icon: '🤝' },
        { text: `On ${cap(places[1])}`, icon: places[1] === 'earth' ? '🌍' : other === 'moon' ? '🌙' : '🪐' }],
      (other === 'moon') === flip ? 2 : 0,
      other === 'moon'
        ? "The Moon's gravity is only one sixth of Earth's, so things fall slowly there."
        : "Jupiter's gravity is about two and a half times Earth's. You would feel very heavy there!",
      dropScene('earth', ['tennis', 'tennis'], { places, vacuum: true, h: other === 'moon' ? 3 : 5 }));
  }

  const kind = pick(rng, ['time', 'distance', 'speed']);
  if (kind === 'time') {
    const [h, t, opts] = pick(rng, [[20, 2, ['1 s', '2 s', '4 s']], [45, 3, ['3 s', '4.5 s', '9 s']], [5, 1, ['0.5 s', '1 s', '2 s']]]);
    return fixed(`A ball is dropped from ${h} m. Taking g = 10 m/s² and ignoring air, how long until it lands?`,
      opts, opts.indexOf(`${t} s`),
      `Distance fallen = ½ × g × t². So ${h} = 5 × t², which gives t = ${t} s.`,
      dropScene('earth', ['cannon'], { h, stopwatch: true, vacuum: true, g: 10 }));
  }
  if (kind === 'distance') {
    const [t, h, opts] = pick(rng, [[3, 45, ['15 m', '30 m', '45 m']], [2, 20, ['10 m', '20 m', '25 m']]]);
    return fixed(`A dropped ball falls 5 m in its first second. Ignoring air, how far has it fallen after ${t} seconds?`,
      opts, opts.indexOf(`${h} m`),
      `Falling things keep speeding up, so distance grows with time squared: 5 × ${t}² = ${h} m.`,
      dropScene('earth', ['cannon'], { h, stopwatch: true, vacuum: true, g: 10 }));
  }
  const t = pick(rng, [2, 3]);
  const opts = ['10 m/s', `${t * 10} m/s`, `${t * t * 10} m/s`];
  return fixed(`Taking g = 10 m/s² and ignoring air, how fast is a dropped ball moving after ${t} seconds?`,
    opts, 1,
    `Gravity adds 10 m/s of speed every second: after ${t} s that is ${t * 10} m/s, about ${Math.round(t * 36)} km/h!`,
    dropScene('earth', ['cannon'], { h: 5 * t * t, stopwatch: true, vacuum: true, g: 10 }));
}

// --- Balance beam ----------------------------------------------------------------

const SIDES2 = [{ text: 'Left', icon: '⬅️' }, { text: 'Right', icon: '➡️' }];
const SIDES3 = [{ text: 'Left', icon: '⬅️' }, { text: 'Stays level', icon: '⚖️' }, { text: 'Right', icon: '➡️' }];
const blocks = (n) => `${n} block${n === 1 ? '' : 's'}`;

function seesawScene(ln, lp, rn, rp, mystery = false) {
  return { left: { n: ln, pos: lp }, right: { n: rn, pos: rp }, mystery };
}

function seesawQuestion(level, rng) {
  const int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  if (level === 1) {
    const ln = int(1, 4);
    let rn = int(1, 4);
    if (rn === ln) rn = ln === 4 ? 2 : ln + 1;
    return fixed('Which side of the see-saw will go DOWN?', SIDES2, ln > rn ? 0 : 1,
      `${blocks(Math.max(ln, rn))} are heavier than ${blocks(Math.min(ln, rn))}, so that side goes down.`,
      seesawScene(ln, 3, rn, 3));
  }

  if (level === 2) {
    const kind = pick(rng, ['distance', 'distance', 'count', 'level']);
    if (kind === 'count') {
      const ln = int(1, 4);
      let rn = int(1, 4);
      if (rn === ln) rn = ln === 4 ? 1 : ln + 1;
      const p = int(2, 4);
      return fixed('Which side of the beam will go down?', SIDES3, ln > rn ? 0 : 2,
        'Both stacks are the same distance from the middle, so the heavier one wins.',
        seesawScene(ln, p, rn, p));
    }
    const n = int(1, 3);
    const lp = int(1, 4);
    let rp = kind === 'level' ? lp : int(1, 4);
    if (kind !== 'level' && rp === lp) rp = lp === 4 ? 2 : lp + 1;
    return fixed(`Each side has ${blocks(n)}, but look where they sit. Which side goes down?`, SIDES3,
      lp === rp ? 1 : lp > rp ? 0 : 2,
      lp === rp
        ? 'Same weight, same distance from the middle: perfectly balanced.'
        : 'Farther from the middle means more turning power. That is why the end of a see-saw is the best seat!',
      seesawScene(n, lp, n, rp));
  }

  if (level === 3) {
    let ln; let lp; let rn; let rp;
    if (rng() < 0.4) {
      [ln, lp, rn, rp] = pick(rng, [[2, 3, 3, 2], [3, 2, 2, 3], [1, 4, 2, 2], [2, 2, 1, 4], [4, 1, 2, 2],
        [1, 4, 4, 1], [2, 4, 4, 2], [4, 2, 2, 4], [3, 4, 4, 3], [1, 2, 2, 1]]);
    } else {
      do {
        ln = int(1, 4); lp = int(1, 4); rn = int(1, 4); rp = int(1, 4);
      } while (ln === rn || lp === rp || ln * lp === rn * rp);
    }
    const L = ln * lp; const R = rn * rp;
    return fixed(`Left: ${blocks(ln)} at distance ${lp}. Right: ${blocks(rn)} at distance ${rp}. Which side goes down?`,
      SIDES3, L === R ? 1 : L > R ? 0 : 2,
      `Turning power = weight × distance. Left: ${ln} × ${lp} = ${L}. Right: ${rn} × ${rp} = ${R}.`,
      seesawScene(ln, lp, rn, rp));
  }

  const [ln, lp, rp] = pick(rng, [[3, 4, 2], [2, 3, 1], [4, 3, 2], [3, 2, 1], [1, 4, 2], [4, 1, 2],
    [6, 2, 3], [6, 1, 3], [3, 4, 3], [2, 2, 4], [6, 2, 4], [4, 3, 4]]);
  const need = (ln * lp) / rp;
  const wrong = [...new Set([need + 1, need - 1, ln, need + 2, need * 2])]
    .filter((n) => n > 0 && n !== need).slice(0, 2);
  const opts = [need, ...wrong].sort((a, b) => a - b);
  return fixed(`Left side: ${blocks(ln)} at distance ${lp}. How many blocks at distance ${rp} on the right will balance the beam?`,
    opts.map((n) => `${n}`), opts.indexOf(need),
    `The turning powers must match: ${ln} × ${lp} = ${ln * lp}, and ${need} × ${rp} = ${need * rp}. That is the law of the lever.`,
    seesawScene(ln, lp, need, rp, true));
}

// --- Magnet magic ----------------------------------------------------------------

const YES_NO = [{ text: 'Yes', icon: '👍' }, { text: 'No', icon: '👎' }];
const MAGNETIC = new Set(['clip', 'nail', 'bolt', 'scissors']);
const MADE_OF = {
  wood: 'wood', duck: 'rubber', apple: 'fruit', lego: 'plastic', cork: 'cork',
  can: 'aluminium', ring: 'gold', foil: 'aluminium', marble: 'glass',
};

function pickUp(kind, extra = {}) {
  return { mode: 'pick', kind, sticks: MAGNETIC.has(kind), ...extra };
}

function magnetQuestion(level, rng) {
  if (level <= 2) {
    const kind = pick(rng, level === 1
      ? ['clip', 'nail', 'bolt', 'wood', 'duck', 'apple', 'lego', 'cork']
      : ['can', 'ring', 'foil', 'marble', 'can', 'ring', 'nail', 'clip', 'bolt', 'scissors']);
    const item = ITEMS[kind];
    const sticks = MAGNETIC.has(kind);
    let fact;
    if (sticks) fact = `Yes! Magnets pull on things made of iron or steel, like the ${item.name}.`;
    else if (level === 1) fact = `No. Magnets do not pull on ${MADE_OF[kind]}.`;
    else if (kind === 'marble') fact = 'No. Glass is not magnetic.';
    else fact = `No! Not every metal is magnetic. ${cap(MADE_OF[kind])} is not, but iron, nickel and cobalt are.`;
    return fixed(`Will the magnet pick up the ${item.name}?`, YES_NO, sticks ? 0 : 1, fact, pickUp(kind));
  }

  if (level === 3) {
    const kind = pick(rng, ['poles', 'poles', 'metal', 'paper']);
    if (kind === 'poles') {
      const a = pick(rng, ['N', 'S']);
      const b = pick(rng, ['N', 'S']);
      const word = { N: 'NORTH', S: 'SOUTH' };
      return fixed(`Two magnets are pushed together: a ${word[a]} pole facing a ${word[b]} pole. What happens?`,
        [{ text: 'They pull together', icon: '🤝' }, { text: 'They push apart', icon: '↔️' }, { text: 'Nothing', icon: '😴' }],
        a === b ? 1 : 0,
        'Opposite poles attract, and like poles repel. North and south pull together; two norths or two souths push apart.',
        { mode: 'poles', a, b });
    }
    if (kind === 'paper') {
      return fixed('A sheet of paper is slipped between a magnet and a paper clip. Does the magnet still pull the clip?',
        YES_NO, 0,
        'Yes! Magnetic force passes straight through paper, plastic, glass and even your hand.',
        pickUp('clip', { paper: true }));
    }
    return mixed(rng, 'Which of these metals does a magnet pull on?', 'Iron', pick(rng, [['Copper', 'Aluminium'], ['Gold', 'Silver']]),
      'Iron is magnetic. Copper, aluminium, gold and silver are not. Steel is mostly iron, so it sticks too.',
      pickUp('nail'));
  }

  const kind = pick(rng, ['cut', 'earth', 'hot', 'metal']);
  if (kind === 'cut') {
    return fixed('You cut a bar magnet in half. What do you get?',
      ['One north-only piece and one south-only piece', 'Two magnets, each with a north and a south pole', 'Two pieces with no magnetism'], 1,
      'Every piece becomes a complete magnet. Nobody has ever found a north pole without a south pole.',
      { mode: 'cut' });
  }
  if (kind === 'earth') {
    return fixed("The north pole of a compass needle is pulled towards the Arctic. So, as a magnet, what sits up in Earth's Arctic?",
      ['A magnetic north pole', 'A magnetic south pole', 'No magnetic pole at all'], 1,
      "Opposites attract, so the needle's north pole must be pulled by a south pole. Earth's \"North Magnetic Pole\" is really the south pole of Earth's magnet!",
      { mode: 'poles', a: 'N', b: 'S' });
  }
  if (kind === 'hot') {
    return fixed('A magnet is heated until it glows red-hot. What happens to its magnetism?',
      ['It gets stronger', 'It disappears', 'Its poles swap over'], 1,
      'Above the Curie temperature (770 °C for iron) the atoms jiggle too much to stay lined up, and the magnetism is lost.',
      { mode: 'pick', kind: 'clip', sticks: false, hot: true });
  }
  const [right, wrong] = pick(rng, [['Nickel', ['Copper', 'Silver']], ['Cobalt', ['Aluminium', 'Gold']]]);
  return mixed(rng, 'Iron is magnetic. Which of these metals is too?', right, wrong,
    'Only iron, nickel and cobalt (and a few rare metals) are strongly magnetic at room temperature. They are called ferromagnetic.',
    pickUp('bolt'));
}

// --- Bright sparks ---------------------------------------------------------------

const CONDUCTS = new Set(['spoon', 'coin', 'foil', 'clip', 'nail', 'pencil', 'ring', 'can', 'saltwater']);
const BLOCKS = { wood: 'Wood', duck: 'Rubber', lego: 'Plastic', cork: 'Cork', marble: 'Glass' };

function circuitScene(over = {}) {
  return { batteries: 1, bulbs: 1, item: null, open: false, brightness: 1, readout: null, ...over };
}

function circuitQuestion(level, rng) {
  if (level <= 2) {
    if (level === 2 && rng() < 0.15) {
      return fixed('The wires have a gap with nothing in it. Will the bulb light up?', YES_NO, 1,
        'Electricity needs a complete loop to flow around. A gap is like a bridge that is out.',
        circuitScene({ open: true, brightness: 0 }));
    }
    const kind = pick(rng, level === 1
      ? ['spoon', 'coin', 'foil', 'clip', 'wood', 'duck', 'lego', 'cork']
      : ['pencil', 'pencil', 'marble', 'ring', 'can', 'cork', 'nail', 'lego', 'wood']);
    const item = ITEMS[kind];
    const on = CONDUCTS.has(kind);
    let fact;
    if (kind === 'pencil') fact = 'Surprise! Pencil "lead" is really graphite, a kind of carbon that lets electricity through.';
    else if (on) fact = `Yes! Metal lets electricity flow through it. We call it a conductor.`;
    else fact = `No. ${BLOCKS[kind]} blocks electricity. We call it an insulator.`;
    return fixed(`We bridge the gap with a ${item.name}. Will the bulb light up?`, YES_NO, on ? 0 : 1, fact,
      circuitScene({ item: kind, brightness: on ? 1 : 0 }));
  }

  if (level === 3) {
    const kind = pick(rng, ['battery', 'series', 'salt', 'pure']);
    if (kind === 'battery') {
      return fixed('We add a second battery to the circuit. The bulb will be…', ['Brighter', 'The same', 'Dimmer'], 0,
        'Two batteries push twice as hard (double the voltage), so more current flows and the bulb glows brighter.',
        circuitScene({ batteries: 2, brightness: 1.9 }));
    }
    if (kind === 'series') {
      return fixed('Two bulbs are wired one after the other (in series) on one battery. Compared with one bulb alone, each is…',
        ['Brighter', 'The same', 'Dimmer'], 2,
        "In series the bulbs share the battery's push, and the current has twice as much to squeeze through. Both glow dimly.",
        circuitScene({ bulbs: 2, brightness: 0.35 }));
    }
    const salty = kind === 'salt';
    return fixed(`The two bare wire ends are dipped into a ${salty ? 'cup of very salty water' : 'cup of pure, distilled water'}. Will the bulb light up?`,
      YES_NO, salty ? 0 : 1,
      salty
        ? 'Dissolved salt splits into charged particles called ions, which carry the current through the water.'
        : 'Perfectly pure water has almost no ions to carry current, so it is a poor conductor. Tap water is not pure, so never mix it with electricity!',
      circuitScene({ item: salty ? 'saltwater' : 'purewater', brightness: salty ? 0.8 : 0 }));
  }

  const kind = pick(rng, ['ohm', 'ohm', 'power', 'series']);
  if (kind === 'ohm') {
    const [v, r] = pick(rng, [[6, 2], [6, 3], [9, 3], [12, 3], [12, 4], [12, 6], [9, 2]]);
    const i = v / r;
    const opts = [...new Set([i, v * r, v - r, v + r, r / v])].slice(0, 3);
    return mixed(rng, `A ${v} V battery is connected to a ${r} Ω bulb. What current flows?`,
      `${i} A`, opts.slice(1).map((n) => `${Math.round(n * 100) / 100} A`),
      `Ohm's law: current = voltage ÷ resistance = ${v} ÷ ${r} = ${i} A.`,
      circuitScene({ batteries: v > 6 ? 2 : 1, readout: `${i} A` }));
  }
  if (kind === 'power') {
    const [v, i] = pick(rng, [[12, 2], [6, 3], [9, 2], [12, 5]]);
    return mixed(rng, `A ${v} V bulb draws ${i} A. How much power does it use?`,
      `${v * i} W`, [`${v + i} W`, `${v / i} W`],
      `Power = voltage × current = ${v} × ${i} = ${v * i} watts.`,
      circuitScene({ batteries: v > 6 ? 2 : 1, readout: `${v * i} W`, brightness: 1.4 }));
  }
  const [v, r] = pick(rng, [[12, 3], [12, 2], [6, 1]]);
  const i = v / (2 * r);
  return mixed(rng, `Two ${r} Ω bulbs are wired in series across a ${v} V battery. What current flows?`,
    `${i} A`, [`${v / r} A`, `${(2 * v) / r} A`],
    `Resistances in series add up: ${r} + ${r} = ${2 * r} Ω. Then ${v} ÷ ${2 * r} = ${i} A.`,
    circuitScene({ batteries: 2, bulbs: 2, readout: `${i} A`, brightness: 0.5 }));
}

// --- Space station ---------------------------------------------------------------

// [prompt, right, wrong, fact, what the orrery flies to]
const SPACE = {
  1: [
    ['Which one is the BIGGEST?', { text: 'The Sun', icon: '☀️' }, [{ text: 'The Earth', icon: '🌍' }, { text: 'The Moon', icon: '🌙' }],
      'The Sun is enormous. A million Earths could fit inside it!', 'sun'],
    ['Which planet do we live on?', { text: 'Earth', icon: '🌍' }, [{ text: 'Mars', icon: '🔴' }, { text: 'Saturn', icon: '🪐' }],
      'Earth is our home: the blue planet, with lots of water.', 'earth'],
    ['Which planet is called the Red Planet?', { text: 'Mars', icon: '🔴' }, [{ text: 'Earth', icon: '🌍' }, { text: 'Neptune', icon: '🔵' }],
      'Mars looks red because its dust is rusty!', 'mars'],
    ['Which planet has big, beautiful rings?', { text: 'Saturn', icon: '🪐' }, [{ text: 'Earth', icon: '🌍' }, { text: 'Mars', icon: '🔴' }],
      "Saturn's rings are made of billions of pieces of ice.", 'saturn'],
    ['What gives us light in the daytime?', { text: 'The Sun', icon: '☀️' }, [{ text: 'The Moon', icon: '🌙' }, { text: 'Mars', icon: '🔴' }],
      'The Sun is a star. It gives us light and keeps us warm.', 'sun'],
    ['What goes round and round the Earth?', { text: 'The Moon', icon: '🌙' }, [{ text: 'The Sun', icon: '☀️' }, { text: 'Saturn', icon: '🪐' }],
      'The Moon travels around the Earth about once every month.', 'earth'],
  ],
  2: [
    ['Which is the biggest planet?', 'Jupiter', ['Earth', 'Saturn'], 'Jupiter is so big that all the other planets could fit inside it.', 'jupiter'],
    ['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Earth'], 'Mercury races round the Sun in just 88 days.', 'mercury'],
    ['Which planet is farthest from the Sun?', 'Neptune', ['Saturn', 'Mars'], 'Neptune is so far away that its year lasts 165 Earth years.', 'neptune'],
    ['How many planets are in our Solar System?', '8', ['7', '10'], 'Eight: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.', 'all'],
    ['What is the Sun?', 'A star', ['A planet', 'A moon'], 'The Sun is a star, just like the ones you see at night, but much closer.', 'sun'],
    ['Which planet is famous for its rings?', 'Saturn', ['Mercury', 'Mars'], "Saturn's rings are made of ice and rock, some pieces as big as a house.", 'saturn'],
    ['Which planet comes between Earth and Jupiter?', 'Mars', ['Venus', 'Saturn'], 'Mars is the fourth planet from the Sun.', 'mars'],
  ],
  3: [
    ['Which is the hottest planet?', 'Venus', ['Mercury', 'Mars'], "Venus is hotter than Mercury, even though it is farther from the Sun. Its thick air traps heat like a greenhouse: 465 °C!", 'venus'],
    ['Which planet spins tipped over on its side?', 'Uranus', ['Saturn', 'Earth'], 'Uranus rolls around the Sun like a ball, probably after a giant crash long ago.', 'uranus'],
    ['Which planet has the Great Red Spot, a storm bigger than Earth?', 'Jupiter', ['Mars', 'Neptune'], 'The Great Red Spot has been raging for hundreds of years.', 'jupiter'],
    ['Which planet takes the longest to go round the Sun?', 'Neptune', ['Jupiter', 'Mercury'], 'One trip takes Neptune 165 Earth years.', 'neptune'],
    ['Which planet has the tallest volcano in the Solar System?', 'Mars', ['Earth', 'Venus'], 'Olympus Mons on Mars is nearly three times as tall as Mount Everest.', 'mars'],
    ['Which planet has the shortest year?', 'Mercury', ['Earth', 'Venus'], 'Mercury is closest to the Sun, so its orbit is the smallest and fastest: 88 days.', 'mercury'],
    ['Which two planets have no moons at all?', 'Mercury and Venus', ['Mars and Earth', 'Uranus and Neptune'], 'Every other planet has at least one moon. Saturn has more than a hundred!', 'venus'],
  ],
  4: [
    ['On which planet does a day last longer than a year?', 'Venus', ['Mercury', 'Jupiter'], 'Venus takes 243 Earth days to spin once, but only 225 to orbit the Sun.', 'venus'],
    ['About how long does sunlight take to reach Earth?', '8 minutes', ['8 seconds', '8 hours'], 'Light covers the 150 million km in about 8 minutes 20 seconds. You see the Sun as it was 8 minutes ago.', 'earth'],
    ['Which is the densest planet in the Solar System?', 'Earth', ['Jupiter', 'Mercury'], "Earth's iron core makes it the densest planet, at 5.5 g/cm³.", 'earth'],
    ['Which planet is less dense than water?', 'Saturn', ['Neptune', 'Mars'], 'Saturn averages only 0.69 g/cm³. In a big enough bath, it would float!', 'saturn'],
    ['Which planet spins backwards compared with most of the others?', 'Venus', ['Mars', 'Saturn'], 'On Venus the Sun rises in the west and sets in the east.', 'venus'],
    ['Which planet has the shortest day?', 'Jupiter', ['Mercury', 'Earth'], 'Giant Jupiter spins once in under 10 hours.', 'jupiter'],
    ['Which planet moves fastest along its orbit?', 'Mercury', ['Earth', 'Neptune'], 'The closer to the Sun, the faster the orbit: Mercury does 47 km every second (Kepler\'s third law).', 'mercury'],
  ],
};

function spaceQuestion(level, rng) {
  const [prompt, right, wrong, fact, focus] = pick(rng, SPACE[level]);
  return mixed(rng, prompt, right, wrong, fact, { focus });
}

// ---------------------------------------------------------------------------------

const MAKERS = {
  float: floatQuestion,
  colour: colourQuestion,
  drop: dropQuestion,
  seesaw: seesawQuestion,
  magnet: magnetQuestion,
  circuit: circuitQuestion,
  space: spaceQuestion,
};

function makeQuestion(exp, level, rng = Math.random) {
  const maker = MAKERS[exp];
  if (!maker) throw new Error(`unknown experiment ${exp}`);
  const lvl = Math.min(4, Math.max(1, Math.round(Number(level)) || 1));
  return { exp, level: lvl, ...maker(lvl, rng) };
}

module.exports = { LEVELS, EXPERIMENTS, ITEMS, makeQuestion, shuffled };
