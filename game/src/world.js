// Emberfall's simulation: the keeper's skiff, the falling embers, husks and moths,
// the five nights, combos and the fever. Fixed-step and seeded, so a seed always
// plays the same fall. The renderer only reads the state; the sound board only
// listens to the event bits a step returns.
//
// Rules in brief: glide the skiff (or dash) to catch embers in the colour your
// lantern burns — J/K/L, 1/2/3, Q/E or a click on the orbs changes it. A matched
// catch scores and grows the combo (and its multiplier); a wrong colour douses
// the combo. Ash husks cost a heart unless you dash through them. The golden
// moth scores heavily and mends a heart. Survive all five nights for dawn.

import {
  COMBO, EMBER, EMBER_COLORS, FIELD, GUST, HEARTS, HUSK, KEEPER, MOTH, NIGHTS, POOL, VIOLET_NIGHT,
} from './config.js';
import { range } from './random.js';

export const KIND_EMBER = 0;
export const KIND_HUSK = 1;
export const KIND_MOTH = 2;

export const EVENT_CATCH = 1;
export const EVENT_WRONG = 2;
export const EVENT_HUSK = 4;
export const EVENT_MOTH = 8;
export const EVENT_SWITCH = 16;
export const EVENT_DASH = 32;
export const EVENT_FEVER = 64;
export const EVENT_NIGHT = 128;
export const EVENT_WIN = 256;
export const EVENT_OVER = 512;
export const EVENT_GUST = 1024;
export const EVENT_HUSK_DODGED = 2048;

export const PHASE_PLAY = 'play';
export const PHASE_INTERLUDE = 'interlude';
export const PHASE_WON = 'won';
export const PHASE_OVER = 'over';

function makeFallers() {
  return Array.from({ length: POOL.fallers }, () => ({
    active: false, kind: KIND_EMBER, color: 0, x: 0, y: 0, vx: 0, vy: 0, phase: 0,
  }));
}

function makeParticles() {
  return Array.from({ length: POOL.particles }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', gravity: 0,
  }));
}

function makeTexts() {
  return Array.from({ length: POOL.texts }, () => ({
    active: false, x: 0, y: 0, life: 0, value: '', color: '#ffffff', size: 20,
  }));
}

export function createWorld(random) {
  const state = {
    time: 0,
    phase: PHASE_PLAY,
    night: 1,
    nightTime: 0,
    interludeTime: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    multiplier: 1,
    feverTime: 0,
    hearts: HEARTS.start,
    caught: 0,
    moths: 0,
    husksDodged: 0,
    keeper: {
      x: FIELD.width / 2, facing: 1, colorIndex: 0,
      dashTime: 0, dashCooldown: 0, invulnerable: 0,
    },
    gust: { active: false, dir: 1, timeLeft: 0, untilNext: 6 },
    shake: 0,
    fallers: makeFallers(),
    particles: makeParticles(),
    texts: makeTexts(),
    spawnTimer: 0.5,
    mothTimer: MOTH.every * 0.6,
  };

  function burst(x, y, color, count, speed, gravity = 300) {
    let made = 0;
    for (const p of state.particles) {
      if (made >= count) break;
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v - speed * 0.35;
      p.maxLife = range(random, 0.35, 0.8);
      p.life = p.maxLife;
      p.size = range(random, 1.6, 3.6);
      p.color = color;
      p.gravity = gravity;
      made += 1;
    }
  }

  function floatText(x, y, value, color, size = 20) {
    for (const t of state.texts) {
      if (t.active) continue;
      t.active = true;
      t.x = x; t.y = y; t.life = 0.9;
      t.value = value; t.color = color; t.size = size;
      return;
    }
  }

  function spawnFaller(demo) {
    for (const f of state.fallers) {
      if (f.active) continue;
      const night = state.night;
      const huskShare = HUSK.share + HUSK.sharePerNight * (night - 1);
      f.kind = !demo && random() < huskShare ? KIND_HUSK : KIND_EMBER;
      f.color = rangeInt_(random, 0, night >= VIOLET_NIGHT || demo ? EMBER_COLORS.length - 1 : 1);
      f.x = range(random, 50, FIELD.width - 50);
      f.y = -30;
      f.vx = 0;
      const base = f.kind === KIND_HUSK
        ? HUSK.speed + HUSK.speedPerNight * (night - 1)
        : EMBER.speed + EMBER.speedPerNight * (night - 1);
      f.vy = base * range(random, 0.9, 1.15);
      f.phase = random() * Math.PI * 2;
      f.active = true;
      return;
    }
  }

  function spawnMoth() {
    for (const f of state.fallers) {
      if (f.active) continue;
      f.kind = KIND_MOTH;
      f.color = 0;
      f.x = range(random, 90, FIELD.width - 90);
      f.y = -30;
      f.vx = 0;
      f.vy = EMBER.speed * 0.72;
      f.phase = random() * Math.PI * 2;
      f.active = true;
      return;
    }
  }

  function rangeInt_(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function catchFaller(f) {
    const keeper = state.keeper;
    let events = 0;
    if (f.kind === KIND_EMBER) {
      if (f.color === keeper.colorIndex) {
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perTier));
        if (state.combo >= COMBO.feverAt && state.feverTime <= 0) {
          state.feverTime = COMBO.feverSeconds;
          events |= EVENT_FEVER;
          floatText(keeper.x, KEEPER.catchY - 90, 'FEVER!', '#ffe066', 30);
        }
        const points = EMBER.points * state.multiplier * (state.feverTime > 0 ? 2 : 1);
        state.score += points;
        state.caught += 1;
        burst(f.x, KEEPER.catchY, EMBER_COLORS[f.color].glow, 14, 190);
        floatText(f.x, KEEPER.catchY - 34, `+${points}`, EMBER_COLORS[f.color].core, 20);
        events |= EVENT_CATCH;
      } else {
        state.combo = 0;
        state.multiplier = 1;
        burst(f.x, KEEPER.catchY, '#8b93a3', 10, 130);
        floatText(f.x, KEEPER.catchY - 34, 'doused', '#9aa3c0', 17);
        events |= EVENT_WRONG;
      }
    } else if (f.kind === KIND_HUSK) {
      if (keeper.invulnerable > 0 || keeper.dashTime > 0) {
        state.husksDodged += 1;
        state.score += 5;
        burst(f.x, KEEPER.catchY, '#c9cfdd', 16, 230);
        floatText(f.x, KEEPER.catchY - 34, 'shattered +5', '#c9cfdd', 17);
        events |= EVENT_HUSK_DODGED;
      } else {
        state.hearts -= 1;
        state.combo = 0;
        state.multiplier = 1;
        keeper.invulnerable = KEEPER.invulnerable;
        state.shake = 0.45;
        burst(f.x, KEEPER.catchY, '#e5534b', 22, 260);
        floatText(keeper.x, KEEPER.catchY - 60, 'the lantern cracks!', '#ff9a8a', 20);
        events |= EVENT_HUSK;
        if (state.hearts <= 0) {
          state.phase = PHASE_OVER;
          events |= EVENT_OVER;
        }
      }
    } else {
      state.caught += 1;
      state.moths += 1;
      let points = MOTH.points;
      if (state.hearts < HEARTS.max) {
        state.hearts += 1;
        floatText(f.x, KEEPER.catchY - 40, `+${points} and a heart`, '#ffe9a3', 19);
      } else {
        points = MOTH.fullPoints;
        floatText(f.x, KEEPER.catchY - 40, `+${points}`, '#ffe9a3', 21);
      }
      state.score += points;
      burst(f.x, KEEPER.catchY, '#ffd94d', 20, 210);
      events |= EVENT_MOTH;
    }
    f.active = false;
    return events;
  }

  function updateFallers(dt, demo) {
    let events = 0;
    const keeper = state.keeper;
    for (const f of state.fallers) {
      if (!f.active) continue;
      f.phase += dt * 6;
      const gustPush = state.gust.active ? state.gust.dir * GUST.strength : 0;
      f.vx += (gustPush - f.vx) * Math.min(1, dt * 2.2);
      f.x += f.vx * dt + (f.kind === KIND_MOTH ? Math.sin(state.time * 2.6 + f.phase) * 46 * dt : 0);
      f.y += f.vy * dt;
      if (f.x < 24) f.x = 24;
      if (f.x > FIELD.width - 24) f.x = FIELD.width - 24;
      const radius = f.kind === KIND_HUSK ? HUSK.radius : f.kind === KIND_MOTH ? MOTH.radius : EMBER.radius;
      const inCradle = Math.abs(f.x - keeper.x) <= KEEPER.catchWidth / 2 + radius * 0.35;
      if (!demo && inCradle && f.y + radius >= KEEPER.catchY && f.y - radius <= KEEPER.catchY + 30) {
        events |= catchFaller(f);
        continue;
      }
      if (f.y - radius > FIELD.floorY + 16) {
        if (f.kind === KIND_EMBER) burst(f.x, FIELD.floorY, EMBER_COLORS[f.color].deep, 5, 70, 60);
        f.active = false;
      }
    }
    return events;
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const t of state.texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.active = false;
    }
  }

  function moveKeeper(dt, control) {
    const keeper = state.keeper;
    let events = 0;
    if (control.switchTo !== null && control.switchTo !== undefined
      && control.switchTo >= 0 && control.switchTo < EMBER_COLORS.length
      && control.switchTo !== keeper.colorIndex) {
      keeper.colorIndex = control.switchTo;
      burst(keeper.x, KEEPER.catchY - 16, EMBER_COLORS[keeper.colorIndex].glow, 6, 90, 40);
      events |= EVENT_SWITCH;
    }
    keeper.dashCooldown = Math.max(0, keeper.dashCooldown - dt);
    keeper.invulnerable = Math.max(0, keeper.invulnerable - dt);
    const hasTarget = control.targetX !== null && control.targetX !== undefined;
    const dx = hasTarget ? control.targetX - keeper.x : 0;
    let dir = control.move || 0;
    if (hasTarget) dir = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
    if (dir !== 0) keeper.facing = dir;
    if (control.dash && keeper.dashCooldown <= 0 && keeper.dashTime <= 0) {
      keeper.dashTime = KEEPER.dashSeconds;
      keeper.dashCooldown = KEEPER.dashCooldown;
      events |= EVENT_DASH;
    }
    if (keeper.dashTime > 0) {
      keeper.dashTime -= dt;
      keeper.x += keeper.facing * KEEPER.dashSpeed * dt;
    } else if (hasTarget) {
      keeper.x += Math.sign(dx) * Math.min(Math.abs(dx), KEEPER.speed * dt);
    } else if (dir !== 0) {
      keeper.x += dir * KEEPER.speed * dt;
    }
    keeper.x = Math.min(FIELD.width - KEEPER.width / 2, Math.max(KEEPER.width / 2, keeper.x));
    return events;
  }

  function stepPlay(dt, control, demo) {
    let events = 0;
    events |= moveKeeper(dt, control);
    if (!demo) {
      state.feverTime = Math.max(0, state.feverTime - dt);
      // Spawning.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnFaller(false);
        const interval = Math.max(EMBER.minInterval, EMBER.interval - EMBER.intervalPerNight * (state.night - 1));
        state.spawnTimer = interval * range(random, 0.72, 1.28);
      }
      state.mothTimer -= dt;
      if (state.mothTimer <= 0) {
        spawnMoth();
        state.mothTimer = MOTH.every * range(random, 0.7, 1.45);
      }
      // Gusts, from the fourth night.
      if (state.night >= GUST.fromNight) {
        if (state.gust.active) {
          state.gust.timeLeft -= dt;
          if (state.gust.timeLeft <= 0) state.gust.active = false;
        } else {
          state.gust.untilNext -= dt;
          if (state.gust.untilNext <= 0) {
            state.gust.active = true;
            state.gust.dir = random() < 0.5 ? -1 : 1;
            state.gust.timeLeft = GUST.seconds;
            state.gust.untilNext = range(random, GUST.minSeconds, GUST.maxSeconds);
            events |= EVENT_GUST;
          }
        }
      }
      // The night itself.
      state.nightTime += dt;
      if (state.nightTime >= NIGHTS.seconds) {
        state.score += NIGHTS.clearBonus;
        if (state.night >= NIGHTS.count) {
          state.phase = PHASE_WON;
          events |= EVENT_WIN;
        } else {
          state.phase = PHASE_INTERLUDE;
          state.interludeTime = NIGHTS.interlude;
          for (const f of state.fallers) f.active = false;
          events |= EVENT_NIGHT;
        }
      }
    } else {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnFaller(true);
        state.spawnTimer = 0.55 * range(random, 0.7, 1.3);
      }
    }
    events |= updateFallers(dt, demo);
    return events;
  }

  return {
    state,
    reset() {
      state.phase = PHASE_PLAY;
      state.night = 1;
      state.nightTime = 0;
      state.interludeTime = 0;
      state.score = 0;
      state.combo = 0;
      state.bestCombo = 0;
      state.multiplier = 1;
      state.feverTime = 0;
      state.hearts = HEARTS.start;
      state.caught = 0;
      state.moths = 0;
      state.husksDodged = 0;
      state.keeper.x = FIELD.width / 2;
      state.keeper.colorIndex = 0;
      state.keeper.dashTime = 0;
      state.keeper.dashCooldown = 0;
      state.keeper.invulnerable = 0;
      state.gust.active = false;
      state.gust.untilNext = 6;
      state.shake = 0;
      state.spawnTimer = 0.5;
      state.mothTimer = MOTH.every * 0.6;
      for (const f of state.fallers) f.active = false;
      for (const p of state.particles) p.active = false;
      for (const t of state.texts) t.active = false;
    },
    /**
     * Advance one fixed step. `control` is { move, targetX, switchTo, dash };
     * `demo` runs the attract-mode fall behind the title (no catches, no stakes).
     * Returns the event bits that fired.
     */
    step(dt, control, demo = false) {
      state.time += dt;
      state.shake = Math.max(0, state.shake - dt);
      let events = 0;
      if (state.phase === PHASE_PLAY) {
        events = stepPlay(dt, control, demo);
      } else if (state.phase === PHASE_INTERLUDE) {
        events |= moveKeeper(dt, control);
        state.interludeTime -= dt;
        if (state.interludeTime <= 0) {
          state.night += 1;
          state.nightTime = 0;
          state.spawnTimer = 0.6;
          state.phase = PHASE_PLAY;
        }
      } else {
        events |= moveKeeper(dt, control);
      }
      updateParticles(dt);
      return events;
    },
  };
}
