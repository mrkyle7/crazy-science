'use strict';

// Crazy Science — served at https://crazy-science.cheetahmoongames.com
//
// Serves public/ (the 3D lab), three.js from node_modules at /vendor/, a
// health check, /api/me (who's signed in; see auth.js), and the game itself
// over a WebSocket at /ws. Rooms live in memory (src/rooms.js), so every
// player in a room must reach the same instance.

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
const { createAuth } = require('./auth');
const { createRooms, cleanName } = require('./src/rooms');
const { LEVELS, EXPERIMENTS } = require('./src/questions');

const PUBLIC_DIR = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three');
const SITE = 'https://crazy-science.cheetahmoongames.com/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.webmanifest']);

// /vendor/three.module.js, /vendor/three.core.js and /vendor/jsm/** come from
// the three package; nothing else in node_modules is served.
function vendorFile(pathname) {
  const rel = pathname.slice('/vendor/'.length);
  if (rel === 'three.module.js' || rel === 'three.core.js') return path.join(THREE_DIR, 'build', rel);
  if (rel.startsWith('jsm/') && rel.endsWith('.js')) {
    const root = path.join(THREE_DIR, 'examples', 'jsm');
    const file = path.resolve(root, rel.slice('jsm/'.length));
    if (file.startsWith(root + path.sep)) return file;
  }
  return null;
}

function createServer({ auth = createAuth(), rooms = createRooms() } = {}) {
  const zipped = new Map(); // file → { mtimeMs, body }

  function sendFile(req, res, filePath, cacheControl) {
    fs.stat(filePath, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cacheControl,
      };
      const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (gzip) {
        headers['Content-Encoding'] = 'gzip';
        headers.Vary = 'Accept-Encoding';
        const hit = zipped.get(filePath);
        if (hit && hit.mtimeMs === stat.mtimeMs) {
          res.writeHead(200, headers).end(hit.body);
          return;
        }
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
          return;
        }
        if (!gzip) {
          res.writeHead(200, headers).end(data);
          return;
        }
        zlib.gzip(data, (zipErr, body) => {
          if (zipErr) {
            delete headers['Content-Encoding'];
            res.writeHead(200, headers).end(data);
            return;
          }
          zipped.set(filePath, { mtimeMs: stat.mtimeMs, body });
          res.writeHead(200, headers).end(body);
        });
      });
    });
  }

  const server = http.createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request');
      return;
    }

    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }

    // Who's playing. Players sign in once, at cheetahmoongames.com/login.
    if (pathname === '/api/me') {
      const player = await auth.player(req);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(player
        ? { signedIn: true, id: player.id, name: player.name }
        : { signedIn: false, loginUrl: auth.loginUrl(SITE) }));
      return;
    }

    // The levels and experiments, for the lobby.
    if (pathname === '/api/game') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ levels: LEVELS, experiments: EXPERIMENTS }));
      return;
    }

    if (pathname.startsWith('/vendor/')) {
      const file = vendorFile(pathname);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      sendFile(req, res, file, 'public, max-age=86400');
      return;
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, rel);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    sendFile(req, res, filePath, 'no-cache');
  });

  // --- The game: one WebSocket per player ----------------------------------------

  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });

  server.on('upgrade', async (req, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch { /* falls through to the 404 */ }
    // Only this site's own pages may open the game's socket.
    const origin = req.headers.origin;
    let sameSite = true;
    if (origin) {
      try {
        sameSite = new URL(origin).host === req.headers.host;
      } catch {
        sameSite = false;
      }
    }
    if (pathname !== '/ws' || !sameSite) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
      return;
    }
    let account = null;
    try {
      account = await auth.player(req);
    } catch { /* plays as a guest */ }
    wss.handleUpgrade(req, socket, head, (ws) => connection(ws, account));
  });

  function connection(ws, account) {
    let room = null;
    let player = null;
    let recent = 0;
    let windowStart = Date.now();
    const send = (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      // Nobody needs more than a few messages a second.
      const t = Date.now();
      if (t - windowStart > 5000) {
        windowStart = t;
        recent = 0;
      }
      if (++recent > 60) return;

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.t === 'join') {
        if (room) return;
        let seat;
        let name;
        if (account) {
          seat = `u:${account.id}`;
          name = account.name;
        } else {
          if (typeof msg.token !== 'string' || !/^[\w-]{8,64}$/.test(msg.token)) return;
          seat = `g:${msg.token}`;
          name = cleanName(msg.name) || 'Scientist';
          auth.guestSeen?.(name);
        }
        const result = rooms.join({
          code: typeof msg.room === 'string' && msg.room ? msg.room.trim().slice(0, 8) : null,
          seat, name, level: msg.level, look: msg.look, send,
        });
        if (result.error) {
          send({ t: 'error', msg: result.error });
          return;
        }
        ({ room, player } = result);
        player.kick = () => {
          send({ t: 'moved' });
          ws.close();
        };
        return;
      }

      if (!room) return;
      if (msg.t === 'set') rooms.setOptions(room, player, { level: msg.level, look: msg.look });
      else if (msg.t === 'start') rooms.start(room, player);
      else if (msg.t === 'answer') rooms.answer(room, player, msg.i);
      else if (msg.t === 'again') rooms.again(room, player);
      else if (msg.t === 'cheer') rooms.cheer(room, player);
    });

    ws.on('close', () => {
      if (room) rooms.leave(room, player, send);
    });
    ws.on('error', () => {});
  }

  // Drop connections that have gone quiet, and keep the others open.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 25000);
  heartbeat.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
  });

  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

module.exports = { createServer };
