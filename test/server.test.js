'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../server.js');

async function withServer(fn, options) {
  const server = createServer(options);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('serves the game at /', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /<title>[^<]+<\/title>/);
  });
});

test('health check', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.strictEqual(res.status, 200);
  });
});

test('paths cannot escape public/', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/..%2fserver.js`);
    assert.strictEqual(res.status, 404);
  });
});

test('/api/me says who is signed in', async () => {
  const auth = {
    player: async (req) => (req.headers.cookie === 'userjwt=ok' ? { id: 'u1', name: 'Ann' } : null),
    loginUrl: (next) => `https://cheetahmoongames.com/login?next=${encodeURIComponent(next)}`,
  };
  await withServer(async (base) => {
    const signedIn = await (await fetch(`${base}/api/me`, { headers: { cookie: 'userjwt=ok' } })).json();
    assert.deepStrictEqual(signedIn, { signedIn: true, id: 'u1', name: 'Ann' });
    const signedOut = await (await fetch(`${base}/api/me`)).json();
    assert.strictEqual(signedOut.signedIn, false);
    assert.match(signedOut.loginUrl, /^https:\/\/cheetahmoongames\.com\/login\?next=/);
  }, { auth });
});

test('links back to Cheetah Moon Games and shows who is signed in', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /href="https:\/\/cheetahmoongames\.com\/"/);
    const js = await (await fetch(`${base}/js/main.js`)).text();
    assert.match(js, /fetch\('\/api\/me'\)/);
  });
});

test('has the Buy me a coffee badge', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /<a class="bmc" href="https:\/\/buymeacoffee\.com\/mrkyle7"/);
  });
});

test('installable: icons, manifest and service worker are served', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    for (const ref of ['/icon.svg', '/icons/apple-touch-icon.png', '/manifest.webmanifest']) {
      assert.ok(html.includes(`href="${ref}"`), `page links ${ref}`);
    }
    const manifestRes = await fetch(`${base}/manifest.webmanifest`);
    assert.strictEqual(manifestRes.headers.get('content-type'), 'application/manifest+json');
    const manifest = await manifestRes.json();
    assert.strictEqual(manifest.start_url, '/');
    assert.strictEqual(manifest.display, 'standalone');
    const sizes = manifest.icons.map((i) => i.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'Chrome needs 192 and 512 px icons');
    assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
    for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png' }]) {
      const res = await fetch(base + icon.src);
      assert.strictEqual(res.status, 200, icon.src);
      if (icon.src.endsWith('.png')) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        assert.deepStrictEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47], `${icon.src} is a PNG`);
      }
    }
    const sw = await fetch(`${base}/sw.js`);
    assert.match(sw.headers.get('content-type'), /javascript/);
    assert.match(await sw.text(), /offline\.html/);
    assert.strictEqual((await fetch(`${base}/offline.html`)).status, 200);
  });
});

// --- The game over a WebSocket ---------------------------------------------------

const { WebSocket } = require('ws');
const { createRooms } = require('../src/rooms.js');

function player(base, options) {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`, options);
  const inbox = [];
  const waiting = [];
  ws.on('message', (data) => {
    inbox.push(JSON.parse(data.toString()));
    for (const w of [...waiting]) w();
  });
  // The first message, from now on or already here, that `match` accepts.
  const next = (match) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no such message')), 3000);
    const look = () => {
      const i = inbox.findIndex(match);
      if (i < 0) return;
      clearTimeout(timer);
      waiting.splice(waiting.indexOf(look), 1);
      resolve(inbox.splice(i, 1)[0]);
    };
    waiting.push(look);
    look();
  });
  const send = (msg) => ws.send(JSON.stringify(msg));
  const open = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  return { ws, next, send, open };
}

const guests = { player: async () => null, loginUrl: () => 'https://cheetahmoongames.com/login', guestSeen() {} };

test('two guests meet in a room and play a round', async () => {
  const seen = [];
  const rooms = createRooms({ times: { intro: 30, question: 5000, reveal: 30, allAnswered: 10, emptyRoom: 50 } });
  await withServer(async (base) => {
    const a = player(base);
    await a.open;
    a.send({ t: 'join', token: 'token-ann-1', name: 'Ann', level: 1 });
    const lobby = await a.next((m) => m.t === 'state');
    assert.match(lobby.code, /^[A-Z]{4}$/);

    const b = player(base);
    await b.open;
    b.send({ t: 'join', room: lobby.code, token: 'token-bob-1', name: '<Bob>', level: 4 });
    const both = await a.next((m) => m.t === 'state' && m.players.length === 2);
    assert.deepStrictEqual(both.players.map((p) => p.name), ['Ann', 'Bob']);
    assert.deepStrictEqual(seen, ['Ann', 'Bob']);

    a.send({ t: 'start' });
    const qa = await a.next((m) => m.t === 'question');
    const qb = await b.next((m) => m.t === 'question');
    assert.strictEqual(qa.exp, qb.exp);
    assert.strictEqual(qa.level, 1);
    assert.strictEqual(qb.level, 4);
    assert.ok(!('answer' in qa));
    await a.next((m) => m.t === 'state' && m.phase === 'question');
    a.send({ t: 'answer', i: 0 });
    b.send({ t: 'answer', i: 0 });
    const reveal = await a.next((m) => m.t === 'reveal');
    assert.strictEqual(reveal.picked, 0);
    assert.strictEqual(reveal.last.correct, reveal.answer === 0);

    b.send({ t: 'cheer' });
    assert.ok(await a.next((m) => m.t === 'cheer'));
    a.ws.close();
    b.ws.close();
  }, { auth: { ...guests, guestSeen: (name) => seen.push(name) }, rooms });
});

test('a signed-in player sits under their account, whatever name they send', async () => {
  const auth = { ...guests, player: async (req) => (req.headers.cookie === 'userjwt=ok' ? { id: 'u1', name: 'Kyle' } : null) };
  await withServer(async (base) => {
    const a = player(base, { headers: { cookie: 'userjwt=ok' } });
    await a.open;
    a.send({ t: 'join', name: 'Somebody Else' });
    const state = await a.next((m) => m.t === 'state');
    assert.strictEqual(state.players[0].name, 'Kyle');
    a.ws.close();
  }, { auth, rooms: createRooms({ timers: false }) });
});

test('the socket refuses other sites and unknown rooms', async () => {
  await withServer(async (base) => {
    const evil = player(base, { origin: 'https://evil.example' });
    await assert.rejects(evil.open);
    const a = player(base);
    await a.open;
    a.send({ t: 'join', room: 'QQQQ', token: 'token-ann-1' });
    assert.match((await a.next((m) => m.t === 'error')).msg, /can't find/);
    a.send('not json');
    a.ws.close();
  }, { auth: guests, rooms: createRooms({ timers: false }) });
});

test('serves three.js for the lab, and nothing else from node_modules', async () => {
  await withServer(async (base) => {
    const three = await fetch(`${base}/vendor/three.module.js`);
    assert.strictEqual(three.status, 200);
    assert.match(three.headers.get('content-type'), /javascript/);
    assert.strictEqual((await fetch(`${base}/vendor/three.core.js`)).status, 200);
    assert.strictEqual((await fetch(`${base}/vendor/jsm/postprocessing/EffectComposer.js`)).status, 200);
    assert.strictEqual((await fetch(`${base}/vendor/jsm/..%2f..%2fpackage.json`)).status, 404);
    assert.strictEqual((await fetch(`${base}/vendor/ws/index.js`)).status, 404);
    const game = await (await fetch(`${base}/api/game`)).json();
    assert.strictEqual(game.levels.length, 4);
    assert.strictEqual(Object.keys(game.experiments).length, 7);
  });
});
