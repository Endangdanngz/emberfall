// Emberfall's renderer: everything the player sees, drawn on one canvas in the
// 1280x720 logical field. A layered night vale (stars, the travelling moon, two
// ridges, mist, a lantern-lit floor), the falling embers, husks and moths, the
// keeper's skiff, particles and floating score text, the HUD, and the title,
// paused, game-over and dawn screens. Nothing here changes the world; it only
// reads the state the world keeps.

import {
  COMBO, EMBER_COLORS, FIELD, FONT, HEARTS, KEEPER, NIGHTS, PALETTE,
} from './config.js';
import { KIND_EMBER, KIND_HUSK, KIND_MOTH, PHASE_INTERLUDE, PHASE_WON } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

/** Fixed starfield and ridge lines, generated once from their own seed: the vale looks the same every visit. */
const starRandom = createRandom(20261116);
const STARS = Array.from({ length: 150 }, () => ({
  x: starRandom() * FIELD.width,
  y: starRandom() * 430,
  r: 0.7 + starRandom() * 1.5,
  tw: starRandom() * TAU,
}));
const RIDGE_FAR = ridgePoints(46, 470, 42, 7);
const RIDGE_NEAR = ridgePoints(30, 540, 54, 13);

function ridgePoints(step, base, amp, seed) {
  const rng = createRandom(seed);
  const pts = [];
  let y = base;
  for (let x = -40; x <= FIELD.width + 40; x += step) {
    y = base + (rng() - 0.5) * amp;
    pts.push({ x, y });
  }
  return pts;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    return { scale, ox, oy };
  }

  function drawSky(state, dawn) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    if (dawn) {
      g.addColorStop(0, PALETTE.dawnTop);
      g.addColorStop(0.55, '#7a4a63');
      g.addColorStop(1, PALETTE.dawnLow);
    } else {
      g.addColorStop(0, PALETTE.skyTop);
      g.addColorStop(0.6, PALETTE.skyMid);
      g.addColorStop(1, PALETTE.skyLow);
    }
    ctx.fillStyle = g;
    ctx.fillRect(-80, -80, FIELD.width + 160, FIELD.height + 160);
  }

  function drawStars(state, dawn) {
    if (dawn) return;
    for (const s of STARS) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(state.time * 0.7 + s.tw));
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The moon rides an arc across the sky as the nights pass; at dawn the sun takes its place. */
  function drawMoon(state, dawn) {
    const progress = dawn
      ? 1
      : ((state.night - 1) + Math.min(1, state.nightTime / 40)) / NIGHTS.count;
    const x = 120 + progress * (FIELD.width - 240);
    const y = 118 - Math.sin(progress * Math.PI) * 52;
    if (dawn) {
      const sun = ctx.createRadialGradient(x, y + 190, 10, x, y + 190, 260);
      sun.addColorStop(0, 'rgba(255,190,110,0.95)');
      sun.addColorStop(0.25, 'rgba(255,160,90,0.5)');
      sun.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(x - 280, y - 90, 560, 560);
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(x, y + 190, 34, 0, TAU);
      ctx.fill();
      return;
    }
    const glow = ctx.createRadialGradient(x, y, 8, x, y, 90);
    glow.addColorStop(0, 'rgba(240,240,210,0.5)');
    glow.addColorStop(1, 'rgba(240,240,210,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = '#f4f1dc';
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(11,16,38,0.9)';
    ctx.beginPath();
    ctx.arc(x + 11, y - 6, 21, 0, TAU);
    ctx.fill();
  }

  function drawRidge(pts, base, color, parallax) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-80, FIELD.height);
    for (const p of pts) ctx.lineTo(p.x + parallax, p.y);
    ctx.lineTo(FIELD.width + 80, FIELD.height);
    ctx.closePath();
    ctx.fill();
    void base;
  }

  function drawMist(state) {
    ctx.fillStyle = PALETTE.mist;
    for (let i = 0; i < 3; i += 1) {
      const y = 470 + i * 52;
      const x = ((state.time * (6 + i * 3) + i * 420) % (FIELD.width + 500)) - 250;
      ctx.beginPath();
      ctx.ellipse(x, y, 260, 17, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawFloor(state) {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(-80, FIELD.floorY, FIELD.width + 160, FIELD.height - FIELD.floorY + 80);
    ctx.fillStyle = PALETTE.floorLine;
    ctx.fillRect(-80, FIELD.floorY, FIELD.width + 160, 2);
    // Shimmering light pool under the lantern.
    const k = state.keeper;
    const glowColor = EMBER_COLORS[k.colorIndex].glow;
    const pool = ctx.createRadialGradient(k.x, FIELD.floorY + 8, 6, k.x, FIELD.floorY + 8, 190);
    pool.addColorStop(0, glowColor + '55');
    pool.addColorStop(1, glowColor + '00');
    ctx.fillStyle = pool;
    ctx.fillRect(k.x - 200, FIELD.floorY - 6, 400, 60);
  }

  function drawFireflies(state) {
    ctx.fillStyle = '#ffe9a3';
    for (let i = 0; i < 22; i += 1) {
      const x = (i * 173.3 + Math.sin(state.time * 0.4 + i * 2.1) * 36) % FIELD.width;
      const y = 300 + ((i * 97.7) % 300) + Math.cos(state.time * 0.55 + i) * 16;
      ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(state.time * 0.9 + i * 1.7));
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmber(f, state) {
    const c = EMBER_COLORS[f.color];
    const flick = 1 + Math.sin(f.phase) * 0.12;
    const r = 13 * flick;
    const glow = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, r * 3.1);
    glow.addColorStop(0, c.glow + 'cc');
    glow.addColorStop(1, c.glow + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - r * 3.2, f.y - r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = c.glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 0.72, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.core;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 0.4, 0, TAU);
    ctx.fill();
    void state;
  }

  function drawHusk(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.sin(f.phase * 0.6) * 0.5);
    ctx.fillStyle = '#232733';
    ctx.strokeStyle = '#454c61';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const spikes = 9;
    for (let i = 0; i < spikes; i += 1) {
      const a = (i / spikes) * TAU;
      const rr = i % 2 === 0 ? 19 : 13;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // The ember heart still burning inside the husk.
    ctx.fillStyle = '#ff7847';
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(f.phase * 1.7);
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMoth(f) {
    const flap = Math.sin(f.phase * 2.2) * 0.55;
    const glow = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 44);
    glow.addColorStop(0, 'rgba(255,217,77,0.55)');
    glow.addColorStop(1, 'rgba(255,217,77,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - 46, f.y - 46, 92, 92);
    ctx.fillStyle = '#ffdf6b';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(side * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(side * 11, -2, 12, 6.5, side * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 5.4, 0, TAU);
    ctx.fill();
  }

  function drawFallers(state) {
    for (const f of state.fallers) {
      if (!f.active) continue;
      if (f.kind === KIND_EMBER) drawEmber(f, state);
      else if (f.kind === KIND_HUSK) drawHusk(f);
      else drawMoth(f);
    }
  }

  function drawKeeper(state) {
    const k = state.keeper;
    const c = EMBER_COLORS[k.colorIndex];
    const blink = k.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0;
    ctx.save();
    if (state.shake > 0) {
      const m = state.shake * 14;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    if (blink) ctx.globalAlpha = 0.35;
    // Dash ghosts.
    if (k.dashTime > 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = c.glow;
      ctx.beginPath();
      ctx.ellipse(k.x - k.facing * 44, KEEPER.catchY + 6, 44, 13, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = blink ? 0.35 : 1;
    }
    // Lantern light halo.
    const halo = ctx.createRadialGradient(k.x, KEEPER.catchY - 26, 4, k.x, KEEPER.catchY - 26, 120);
    halo.addColorStop(0, c.glow + (state.feverTime > 0 ? 'aa' : '77'));
    halo.addColorStop(1, c.glow + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(k.x - 124, KEEPER.catchY - 150, 248, 248);
    // The skiff: a curved wooden hull with a rim the embers land in.
    ctx.fillStyle = '#5a3d22';
    ctx.beginPath();
    ctx.moveTo(k.x - 52, KEEPER.catchY + 2);
    ctx.quadraticCurveTo(k.x, KEEPER.catchY + 30, k.x + 52, KEEPER.catchY + 2);
    ctx.lineTo(k.x + 42, KEEPER.catchY + 16);
    ctx.quadraticCurveTo(k.x, KEEPER.catchY + 34, k.x - 42, KEEPER.catchY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a552e';
    ctx.fillRect(k.x - 54, KEEPER.catchY - 2, 108, 6);
    // The keeper: a small hooded figure amidships.
    ctx.fillStyle = '#1c2438';
    ctx.beginPath();
    ctx.arc(k.x, KEEPER.catchY - 26, 10, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(k.x - 11, KEEPER.catchY - 2);
    ctx.quadraticCurveTo(k.x, KEEPER.catchY - 22, k.x + 11, KEEPER.catchY - 2);
    ctx.closePath();
    ctx.fill();
    // The lantern on its pole, burning the current colour.
    ctx.strokeStyle = '#0f1424';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(k.x + 16, KEEPER.catchY - 2);
    ctx.lineTo(k.x + 22, KEEPER.catchY - 44);
    ctx.stroke();
    ctx.fillStyle = c.glow;
    ctx.beginPath();
    ctx.arc(k.x + 23, KEEPER.catchY - 48, 7.5 + Math.sin(state.time * 7) * 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.core;
    ctx.beginPath();
    ctx.arc(k.x + 23, KEEPER.catchY - 48, 3.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.min(1, t.life / 0.5);
      ctx.font = `600 ${t.size}px ${FONT}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.value, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHeart(x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.05, 1.05);
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-13, -2, -8, -12, 0, -5);
    ctx.bezierCurveTo(8, -12, 13, -2, 0, 9);
    ctx.closePath();
    ctx.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, best) {
    // Hearts, top left.
    for (let i = 0; i < HEARTS.max; i += 1) {
      drawHeart(40 + i * 30, 38, i < state.hearts);
    }
    // Night and moon progress, top centre.
    ctx.textAlign = 'center';
    ctx.font = `700 19px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`NIGHT ${state.night} OF ${NIGHTS.count}`, FIELD.width / 2, 36);
    const barW = 300;
    const barX = FIELD.width / 2 - barW / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, 46, barW, 7, 4);
    ctx.fill();
    const p = Math.min(1, state.nightTime / NIGHTS.seconds);
    ctx.fillStyle = '#f4f1dc';
    roundRect(ctx, barX, 46, Math.max(7, barW * p), 7, 4);
    ctx.fill();
    // Score, top right.
    ctx.textAlign = 'right';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(state.score), FIELD.width - 28, 44);
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width - 28, 66);
    // Lantern colour orbs, bottom left: the current flame ringed, keys beneath.
    ctx.textAlign = 'center';
    EMBER_COLORS.forEach((c, i) => {
      const x = 52 + i * 62;
      const y = FIELD.height - 44;
      if (i === state.keeper.colorIndex) {
        ctx.strokeStyle = c.core;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 24 + Math.sin(state.time * 5) * 1.6, 0, TAU);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x, y, 1, x, y, 20);
      g.addColorStop(0, c.core);
      g.addColorStop(1, c.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, TAU);
      ctx.fill();
      ctx.font = `700 13px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(['J · 1', 'K · 2', 'L · 3'][i], x, y + 40);
    });
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText('lantern colour', 28, FIELD.height - 92);
    // Combo and fever, bottom right.
    ctx.textAlign = 'right';
    if (state.feverTime > 0) {
      ctx.font = `800 24px ${FONT}`;
      ctx.fillStyle = PALETTE.fever;
      ctx.fillText('FEVER — double embers!', FIELD.width - 28, FIELD.height - 74);
      ctx.fillStyle = 'rgba(255,224,102,0.25)';
      roundRect(ctx, FIELD.width - 228, FIELD.height - 62, 200, 9, 5);
      ctx.fill();
      ctx.fillStyle = PALETTE.fever;
      roundRect(ctx, FIELD.width - 228, FIELD.height - 62, 200 * (state.feverTime / COMBO.feverSeconds), 9, 5);
      ctx.fill();
    } else if (state.combo > 1) {
      ctx.font = `800 24px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`COMBO ${state.combo}`, FIELD.width - 28, FIELD.height - 74);
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      const toNext = COMBO.perTier - (state.combo % COMBO.perTier);
      ctx.fillText(
        state.multiplier >= COMBO.maxMultiplier ? 'multiplier max' : `×${state.multiplier} — ${toNext} more to ×${state.multiplier + 1}`,
        FIELD.width - 28, FIELD.height - 50,
      );
    }
    // Dash readiness, under the skiff.
    const k = state.keeper;
    if (k.dashCooldown > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, k.x - 30, KEEPER.catchY + 44, 60, 5, 3);
      ctx.fill();
      ctx.fillStyle = '#a7f3e8';
      roundRect(ctx, k.x - 30, KEEPER.catchY + 44, 60 * (1 - k.dashCooldown / 1.1), 5, 3);
      ctx.fill();
    }
    // Gust warning.
    if (state.gust.active) {
      ctx.textAlign = 'center';
      ctx.font = `800 19px ${FONT}`;
      ctx.fillStyle = '#a7f3e8';
      const arrow = state.gust.dir > 0 ? '>>>' : '<<<';
      ctx.fillText(`GUST ${arrow}`, FIELD.width / 2, 92);
    }
  }

  function panel(w, h) {
    const x = FIELD.width / 2 - w / 2;
    const y = FIELD.height / 2 - h / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
    return { x, y };
  }

  function drawTitleScreen(state, best) {
    ctx.fillStyle = 'rgba(5,8,18,0.35)';
    ctx.fillRect(-80, -80, FIELD.width + 160, FIELD.height + 160);
    const { y } = panel(700, 470);
    const cx = FIELD.width / 2;
    ctx.textAlign = 'center';
    const titleGrad = ctx.createLinearGradient(0, y + 40, 0, y + 130);
    titleGrad.addColorStop(0, '#ffe9a3');
    titleGrad.addColorStop(0.55, '#ffb35c');
    titleGrad.addColorStop(1, '#ff7847');
    ctx.font = `900 84px ${FONT}`;
    ctx.fillStyle = titleGrad;
    ctx.fillText('EMBERFALL', cx, y + 118);
    ctx.font = `600 21px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('— Lantern of the Vale —', cx, y + 152);
    ctx.font = `400 17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Five nights of falling embers. Keep your lantern lit until dawn.', cx, y + 188);
    // How to play, with the colour chips.
    ctx.font = `400 16.5px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'left';
    const lx = cx - 300;
    ctx.fillText('Glide with  ← → ,  A / D  or the mouse.  SHIFT dashes through danger.', lx, y + 232);
    ctx.fillText('Catch embers in the colour your lantern burns:', lx, y + 262);
    EMBER_COLORS.forEach((c, i) => {
      const ox = lx + 402 + i * 78;
      const g = ctx.createRadialGradient(ox, y + 256, 1, ox, y + 256, 15);
      g.addColorStop(0, c.core);
      g.addColorStop(1, c.glow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, y + 256, 12, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Switch the flame with  J / K / L  (or 1 2 3, Q / E). Wrong colour douses your combo.', lx, y + 292);
    ctx.fillText('Ash husks crack the lantern — dash through them or stay clear.', lx, y + 322);
    ctx.fillText('The golden moth mends a heart. Chain 16 catches to raise the FEVER.', lx, y + 352);
    ctx.textAlign = 'center';
    ctx.font = `800 23px ${FONT}`;
    ctx.fillStyle = '#ffe9a3';
    const pulse = 0.75 + 0.25 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillText('Press SPACE or click to light the lantern', cx, y + 408);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`Best score so far: ${best}`, cx, y + 440);
    }
  }

  function statsRows(state, best) {
    return [
      ['Score', String(state.score)],
      ['Best', String(Math.max(best, state.score))],
      ['Embers caught', String(state.caught)],
      ['Best combo', `${state.bestCombo}`],
      ['Golden moths', String(state.moths)],
      ['Husks shattered', String(state.husksDodged)],
    ];
  }

  function drawEndScreen(state, best, won) {
    const { y } = panel(560, 480);
    const cx = FIELD.width / 2;
    ctx.textAlign = 'center';
    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = won ? '#ffe9a3' : '#ff9a8a';
    ctx.fillText(won ? 'DAWN BREAKS' : 'THE LIGHT GOES OUT', cx, y + 84);
    ctx.font = `400 17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(
      won ? 'You kept the lantern lit through all five nights.' : `The vale went dark on night ${state.night}.`,
      cx, y + 118,
    );
    ctx.font = `600 19px ${FONT}`;
    statsRows(state, best).forEach(([label, value], i) => {
      const ry = y + 168 + i * 36;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, cx - 190, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(value, cx + 190, ry);
    });
    ctx.textAlign = 'center';
    ctx.font = `800 21px ${FONT}`;
    ctx.fillStyle = '#ffe9a3';
    ctx.fillText('Press SPACE or click to play again', cx, y + 168 + 6 * 36 + 26);
  }

  function drawInterlude(state) {
    ctx.fillStyle = 'rgba(5,8,18,0.45)';
    ctx.fillRect(-80, -80, FIELD.width + 160, FIELD.height + 160);
    const cx = FIELD.width / 2;
    ctx.textAlign = 'center';
    ctx.font = `900 52px ${FONT}`;
    ctx.fillStyle = '#ffe9a3';
    ctx.fillText(`NIGHT ${state.night} CLEARED`, cx, 300);
    ctx.font = `600 21px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`+${150} for seeing it through`, cx, 342);
    ctx.font = `400 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const next = state.night + 1;
    const teaser = next === 3
      ? 'Night 3: violet embers join the fall.'
      : next === 4
        ? 'Night 4: the gusts rise — the fall will drift.'
        : next === 5
          ? 'Night 5: the last dark before dawn. Hold on.'
          : `Night ${next}: the fall quickens.`;
    ctx.fillText(teaser, cx, 380);
  }

  function drawPausedVeil() {
    ctx.fillStyle = 'rgba(5,8,18,0.55)';
    ctx.fillRect(-80, -80, FIELD.width + 160, FIELD.height + 160);
    ctx.textAlign = 'center';
    ctx.font = `900 54px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 6);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or Esc to resume · M to mute', FIELD.width / 2, FIELD.height / 2 + 32);
  }

  /** Paint one frame: the vale, the fall, the keeper, then the screen's own layer. */
  function draw(state, screen, best) {
    fit();
    const dawn = screen === SCREEN_WIN || state.phase === PHASE_WON;
    drawSky(state, dawn);
    drawStars(state, dawn);
    drawMoon(state, dawn);
    const parallax = (state.keeper.x - FIELD.width / 2) * 0.012;
    drawRidge(RIDGE_FAR, 470, PALETTE.ridgeFar, parallax * 0.5);
    drawRidge(RIDGE_NEAR, 540, PALETTE.ridgeNear, parallax);
    drawMist(state);
    drawFloor(state);
    drawFireflies(state);
    drawFallers(state);
    drawKeeper(state);
    drawParticles(state);
    drawTexts(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state, best);
      drawTitleScreen(state, best);
    } else if (screen === SCREEN_OVER) {
      drawEndScreen(state, best, false);
    } else if (screen === SCREEN_WIN) {
      drawEndScreen(state, best, true);
    } else {
      drawHud(state, best);
      if (state.phase === PHASE_INTERLUDE) drawInterlude(state);
      if (screen === SCREEN_PAUSED) drawPausedVeil();
    }
  }

  return { draw };
}
