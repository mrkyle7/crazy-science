# Crazy Science

A live, online science game on [Cheetah Moon Games](https://cheetahmoongames.com/), at **https://crazy-science.cheetahmoongames.com**.

Up to 8 scientists share a lab. Each round is one experiment in a 3D lab: everyone guesses what will happen, then watches it run. A five-year-old and a grown-up can play together, because each player picks a level and gets their own question about the same experiment:

| Level | For | Example (Float or Sink?) |
| --- | --- | --- |
| 🌱 Sprout | age 5+ | Will the rubber duck float or sink? (read aloud, picture answers) |
| 🔍 Explorer | age 8+ | Three things drop into the water. Which one will float? |
| ⚡ Whiz | age 10+ | Very salty water is 1.2 g/cm³. The egg is 1.03 g/cm³. Float or sink? |
| 🎓 Professor | grown-ups | How much of an iceberg hides below the surface? |

Right answers score points (a few more for speed) and add fuel to the team's rocket. After seven experiments it launches: the more the team got right, the higher it flies, from a hop off the pad to Mars.

The experiments: Float or Sink?, Colour Lab, Gravity Drop, Balance Beam, Magnet Magic, Bright Sparks and Space Station.

## Run it

```sh
npm install
npm test
npm start           # http://localhost:8080
```

Open it in two windows to play against yourself: start a lab in one, and join with its code in the other. Add `?gfx=low` to the address for plain graphics (no glow or shadows); the game also drops to them by itself on a slow device.

## How it's built

```
server.js             static files, three.js at /vendor/, /api/me, and the game's WebSocket at /ws
auth.js               who's signed in (the shared Cheetah Moon account); guests play under a typed name
src/questions.js      every experiment's questions at each level, with the answer, a fact and the 3D scene
src/rooms.js          rooms in memory: lobby → (intro → question → reveal) × 7 → final
public/index.html     the screens round the lab          public/style.css
public/js/main.js     the page: the WebSocket, panels, scores
public/js/lab.js      the 3D lab: stage, scientists, rocket, camera
public/js/experiments.js   one builder per experiment: what's on the stage, and what happens when it runs
public/js/items.js    the things on the bench (duck, coin, feather, ...)
public/js/kit.js      shared 3D helpers          public/js/sound.js   sounds and reading aloud
```

- **The server owns the game.** It makes each player's question, keeps the answer until the reveal, and runs the clock. A question carries a `scene`, which tells the player's own lab what to show, so players at different levels see different versions of the same experiment.
- **Rooms live in memory,** so the service runs as one instance (`max_instances = 1` in mrkyle7/cheetahmoongames' `terraform/games.tf`). A deploy ends the games in play.
- **Seats.** A signed-in player's seat is their account; a guest's is a random token kept in their browser. Either way a dropped connection comes back to the same score.
- **3D** is [three.js](https://threejs.org), served from `node_modules` (no CDN). Everything is built from simple shapes in code; there are no model or texture files.

## Adding an experiment

1. In `src/questions.js`: add it to `EXPERIMENTS`, write a maker that returns a question for each of the four levels, and add it to `MAKERS`. Check the science.
2. In `public/js/experiments.js`: add a builder that turns the question's `scene` into a `{ group, tick, reveal, duration }` and add it to `BUILDERS`.
3. `npm test` checks every experiment makes sound questions at every level.

A game is one round of each experiment, so a new one makes games a round longer.
