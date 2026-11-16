// Emberfall — every tuning number and colour in one place. The vale is a fixed 1280x720
// logical field; the renderer scales it to the window, so no rule below depends on the
// screen size.

export const FIELD = { width: 1280, height: 720, floorY: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The keeper's skiff: how wide its catch cradle is, how fast it glides, how the dash feels. */
export const KEEPER = {
  width: 92,
  height: 30,
  catchWidth: 104,
  catchY: 600,
  speed: 640,
  dashSpeed: 1500,
  dashSeconds: 0.16,
  dashCooldown: 1.1,
  invulnerable: 1.5,
};

/** The three ember colours the lantern can burn. The keeper starts with the first two. */
export const EMBER_COLORS = [
  { id: 'amber', name: 'Amber', core: '#ffd98a', glow: '#ff9d3c', deep: '#c25e10' },
  { id: 'teal', name: 'Teal', core: '#a7f3e8', glow: '#2fd8c0', deep: '#0e7a6d' },
  { id: 'violet', name: 'Violet', core: '#e3ccff', glow: '#a678ff', deep: '#5f3bb3' },
];

/** Violet embers join the fall on this night; before it only amber and teal fall. */
export const VIOLET_NIGHT = 3;

export const EMBER = {
  radius: 13,
  speed: 215,
  speedPerNight: 34,
  interval: 0.84,
  intervalPerNight: 0.09,
  minInterval: 0.34,
  points: 10,
};

export const HUSK = {
  radius: 17,
  speed: 245,
  speedPerNight: 30,
  /** Share of spawns that are husks instead of embers, and how it grows by night. */
  share: 0.16,
  sharePerNight: 0.02,
};

export const MOTH = {
  radius: 15,
  /** Mean seconds between golden moths. */
  every: 26,
  points: 50,
  fullPoints: 100,
};

export const HEARTS = { start: 3, max: 5 };

/** A run is five nights; survive them all and dawn breaks (a win). */
export const NIGHTS = { count: 5, seconds: 40, clearBonus: 150, interlude: 2.4 };

/** Combo: every consecutive matched catch adds one; the multiplier steps up every 8. */
export const COMBO = { perTier: 8, maxMultiplier: 5, feverAt: 16, feverSeconds: 8 };

/** Wind gusts arrive from this night on and push the fall sideways. */
export const GUST = { fromNight: 4, minSeconds: 5, maxSeconds: 10, strength: 130, seconds: 2.6 };

/** How many falling things and particles can exist at once; pools are allocated once. */
export const POOL = { fallers: 96, particles: 420, texts: 24 };

export const PALETTE = {
  skyTop: '#0b1026',
  skyMid: '#1b2340',
  skyLow: '#3a2b4d',
  dawnTop: '#2c3e63',
  dawnLow: '#e8875a',
  ridgeFar: '#232c4e',
  ridgeNear: '#161d36',
  floor: '#10182e',
  floorLine: '#2c3a5e',
  mist: 'rgba(160,180,230,0.07)',
  text: '#f2ead8',
  muted: '#9aa3c0',
  panel: 'rgba(13,18,36,0.82)',
  panelEdge: 'rgba(255,217,138,0.35)',
  heart: '#ff7a6b',
  heartEmpty: 'rgba(255,255,255,0.16)',
  fever: '#ffe066',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
