// Emberfall's boot and one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), the renderer
// paints what is there, and the sound board answers the world's events. The game
// moves between five screens: title (over the attract fall), play, paused, game
// over and dawn.
//
// ?seed=N fixes the fall's pattern. ?shot=title|play|win|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice, reports
// window.__shotInfo and sets window.__shotReady for a screenshot.

import { BEST_KEY, EMBER_COLORS, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CATCH, EVENT_DASH, EVENT_FEVER, EVENT_GUST, EVENT_HUSK,
  EVENT_HUSK_DODGED, EVENT_MOTH, EVENT_NIGHT, EVENT_OVER, EVENT_SWITCH, EVENT_WIN,
  EVENT_WRONG,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_CYCLE_DOWN, ACTION_CYCLE_UP, ACTION_DASH, ACTION_MUTE,
  ACTION_PAUSE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      const s = world.state;
      window.__shotInfo = {
        screen: scene.screen, score: s.score, combo: s.combo, night: s.night,
        hearts: s.hearts, phase: s.phase, caught: s.caught, fever: s.feverTime,
      };
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let wasFever = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Night 1 of 5. Catch the embers in your lantern colour.');
  }

  function finishGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Dawn breaks. Final score ${world.state.score}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  /** Translate this frame's input into the control the world steps with. */
  function readControl(actions) {
    const state = world.state;
    let switchTo = input.switchTarget(actions);
    if (switchTo < 0 && (actions & ACTION_CYCLE_UP)) {
      switchTo = (state.keeper.colorIndex + 1) % EMBER_COLORS.length;
    }
    if (switchTo < 0 && (actions & ACTION_CYCLE_DOWN)) {
      switchTo = (state.keeper.colorIndex + EMBER_COLORS.length - 1) % EMBER_COLORS.length;
    }
    return {
      move: input.direction(),
      targetX: input.pointer(),
      switchTo: switchTo < 0 ? null : switchTo,
      dash: (actions & ACTION_DASH) !== 0,
    };
  }

  function react(events) {
    const state = world.state;
    if (events & EVENT_CATCH) audio.catch(state.combo);
    if (events & EVENT_WRONG) audio.wrong();
    if (events & EVENT_HUSK) {
      audio.husk();
      announce(state.hearts === 1 ? 'The lantern cracks. One heart left.' : `The lantern cracks. ${state.hearts} hearts left.`);
    }
    if (events & EVENT_HUSK_DODGED) audio.dash();
    if (events & EVENT_MOTH) audio.moth();
    if (events & EVENT_SWITCH) audio.switchColor();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_FEVER) {
      audio.feverStart();
      announce('Fever! Embers are worth double.');
    }
    if (events & EVENT_GUST) announce('A gust rises — the fall drifts.');
    if (events & EVENT_NIGHT) {
      audio.nightClear();
      announce(`Night ${state.night} cleared.`);
    }
    if (events & EVENT_WIN) {
      audio.dawn();
      finishGame(true);
    } else if (events & EVENT_OVER) {
      audio.gameOver();
      finishGame(false);
    }
    const fever = state.feverTime > 0;
    if (fever !== wasFever) {
      audio.setFever(fever);
      wasFever = fever;
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return ACTION_CONFIRM;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return ACTION_PAUSE;
    }
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return ACTION_PAUSE | ACTION_CONFIRM;
    }
    return 0;
  }

  function step(actions) {
    const state = world.state;
    if (screen === SCREEN_TITLE) {
      const sway = {
        move: 0,
        targetX: FIELD.width / 2 + Math.sin(state.time * 0.7) * 180,
        switchTo: null,
        dash: false,
      };
      world.step(STEP, sway, true);
      return;
    }
    if (screen === SCREEN_PLAY) {
      react(world.step(STEP, readControl(actions), false));
      return;
    }
    // End screens: let particles and text settle over the finished vale.
    world.step(STEP, { move: 0, targetX: null, switchTo: null, dash: false }, false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    audio.update(dt);
    const actions = input.takeActions();
    const consumed = handleActions(actions);
    const rest = actions & ~consumed;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(rest);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      while (accumulator >= STEP) {
        step(0);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('pointerdown', () => audio.unlock());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to light the lantern.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
