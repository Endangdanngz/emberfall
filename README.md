# emberfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Endangdanngz/emberfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Endangdanngz/emberfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberfall — Lantern of the Vale.** An original arcade game for the browser: for five
nights, embers rain over a mountain vale, and you are the lantern keeper gliding below
them on a skiff. Catch each ember in the colour your lantern burns — amber, teal or
violet — to score and build your combo. Catch one in the wrong colour and the combo is
doused. Ash husks crack the lantern (three cracks and the light goes out), unless you
dash through them. The golden moth mends a heart. Chain 16 matched catches to raise the
FEVER, when every ember is worth double. Survive all five nights — violet embers join
the fall on night 3, and the gusts rise on night 4 — and dawn breaks: you win.

## How to play

- **Glide:** ← / →, A / D, or the mouse (touch works too — drag).
- **Switch the lantern's colour:** J / K / L, or 1 / 2 / 3, or Q / E to cycle. The orbs at
  the bottom left show the current flame.
- **Dash:** Shift — a short burst that shatters husks instead of cracking the lantern.
- **Pause:** P or Esc. **Mute:** M. **Start / restart:** Space, Enter or click.
- Matched catches score 10 × your combo multiplier (up to ×5, doubling again in the
  FEVER). Clearing a night adds 150. The best score is kept in the browser.

## Run it

Play it locally (Node 22 or later, no dependencies, no build step):

```sh
node serve.ts
# then open http://localhost:8080
```

Hand it in the way the grader does — this copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` there with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## What's inside

- `game/index.html` — the page; everything it loads lives under `game/`, so the game
  plays fully offline.
- `game/src/world.js` — the simulation: the fall, the five nights, combos, the fever,
  gusts, hearts and scoring, in fixed 1/60 s steps from a seeded generator.
- `game/src/render.js` — the canvas renderer: the vale, the moon's arc, the keeper and
  the fall, the HUD, and the title, pause, game-over and dawn screens.
- `game/src/input.js` — keyboard, mouse and touch, with latched one-shot actions.
- `game/src/audio.js` — every sound synthesized with WebAudio (catch chimes climb a
  pentatonic ladder with your combo; a slow procedural music loop runs underneath).
- `game/src/shots.js` — the autopilots that stage the screenshots in `shots.json`
  (`?shot=title|play|win|over&seed=N` renders a real, deterministic frame).
- `game/src/config.js`, `game/src/random.js` — every tuning number in one place, and
  the seeded random generator.
- `screenshots/` — four frames of the real game: title, a fever moment on night 2,
  the dawn victory, and the game-over screen.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `main.ts`, `serve.ts` — the hand-in program and the local static server.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=w00a2ztr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
