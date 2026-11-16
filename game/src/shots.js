// The screenshot scenes behind ?shot=title|play|win|over. Each one plays the real
// rules forward from a fresh world with an autopilot at the helm, so the frame is
// what a real game looks like and the same seed always gives the same frame.
//
// The strong pilot plays properly: it reads each faller's time to the catch line,
// steers for the most urgent ember or moth, switches the lantern to match, and
// dashes clear of husks. The careless pilot (for the game-over scene) never
// switches colour and never looks up — it is caught out, as a hurried player is.

import { EMBER_COLORS, FIELD, KEEPER, STEP } from './config.js';
import {
  KIND_EMBER, KIND_HUSK, KIND_MOTH, PHASE_OVER, PHASE_WON,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const CATCH_Y = KEEPER.catchY;
const PLAY_SECONDS = 80;
const LIMIT_SECONDS = 420;

function eta(f) {
  return Math.max(0, (CATCH_Y - f.y) / Math.max(1, f.vy));
}

function predictedX(f) {
  return f.x + f.vx * eta(f) * 0.8;
}

/** The husk that will reach the cradle soonest near a given x, and when. */
function huskThreat(state, x, within) {
  let worst = null;
  for (const f of state.fallers) {
    if (!f.active || f.kind !== KIND_HUSK) continue;
    const t = eta(f);
    if (t > within) continue;
    if (Math.abs(predictedX(f) - x) < 86 && (worst === null || t < worst.t)) worst = { f, t };
  }
  return worst;
}

function strongControl(state) {
  const k = state.keeper;
  const control = { move: 0, targetX: null, switchTo: null, dash: false };
  // Survival first: a husk arriving where we stand means dash or step aside.
  const threat = huskThreat(state, k.x, 0.6);
  if (threat) {
    const away = threat.f.x <= k.x ? 1 : -1;
    const safeX = Math.min(FIELD.width - 70, Math.max(70, k.x + away * 170));
    if (!huskThreat(state, safeX, 0.6)) {
      control.targetX = safeX;
      if (k.dashCooldown <= 0 && Math.abs(safeX - k.x) > 90) {
        control.move = away;
        control.dash = true;
      }
      return control;
    }
  }
  // Otherwise pick the most worthwhile catch: urgent first, moths prized, the
  // colour we already burn preferred, a husk waiting at the spot a warning.
  let best = null;
  let bestScore = -Infinity;
  for (const f of state.fallers) {
    if (!f.active || f.kind === KIND_HUSK) continue;
    const t = eta(f);
    if (t > 2.4) continue;
    const x = predictedX(f);
    let score = -t * 3 - Math.abs(x - k.x) / 300;
    if (f.kind === KIND_MOTH) score += 2.2;
    if (f.kind === KIND_EMBER && f.color === k.colorIndex) score += 0.8;
    if (huskThreat(state, x, t + 0.15)) score -= 2.5;
    if (score > bestScore) {
      bestScore = score;
      best = { f, x };
    }
  }
  if (best) {
    control.targetX = best.x;
    if (best.f.kind === KIND_EMBER && best.f.color !== k.colorIndex) {
      control.switchTo = best.f.color;
    }
    return control;
  }
  control.targetX = FIELD.width / 2;
  return control;
}

function carelessControl(state) {
  const k = state.keeper;
  let nearest = null;
  let nearestEta = Infinity;
  for (const f of state.fallers) {
    if (!f.active || f.kind !== KIND_EMBER) continue;
    const t = eta(f);
    if (t < nearestEta) {
      nearestEta = t;
      nearest = f;
    }
  }
  return {
    move: 0,
    targetX: nearest ? nearest.x : k.x,
    switchTo: null,
    dash: false,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * score to show as best. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    // Play into the second night, where the fall is denser, and stop on a fever
    // moment if one is burning; otherwise the clock decides.
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, strongControl(state), false);
      if (state.phase === PHASE_OVER || state.phase === PHASE_WON) break;
      if (state.night >= 2 && state.feverTime > 1.5) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'win') {
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, strongControl(state), false);
      if (state.phase === PHASE_WON || state.phase === PHASE_OVER) break;
    }
    return { screen: state.phase === PHASE_WON ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
  }
  if (name === 'over') {
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, carelessControl(state), false);
      if (state.phase === PHASE_OVER) break;
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  // Title: four seconds of the attract fall, the keeper swaying under it.
  for (let i = 0; i < 4 / STEP; i += 1) {
    const sway = {
      move: 0,
      targetX: FIELD.width / 2 + Math.sin(i * STEP * 0.7) * 180,
      switchTo: null,
      dash: false,
    };
    world.step(STEP, sway, true);
  }
  void EMBER_COLORS;
  return { screen: SCREEN_TITLE, best: 0 };
}
