// Emberfall's sound is all synthesized with WebAudio — no audio files. Short voices for
// the effects (a catch climbs a pentatonic ladder as the combo grows, a husk is a low
// burst of noise) and a slow procedural music loop: soft plucked notes over a pad, a
// little quicker and brighter while the fever burns. The context is created lazily and
// unlocked by the first key or click, as browsers require; M or the speaker button mutes.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const BASE_HZ = 261.63; // C4

function noteHz(semitones) {
  return BASE_HZ * Math.pow(2, semitones / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = 0;
  let nextNoteAt = 0;
  let noteIndex = 0;
  let fever = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      nextNoteAt = ctx.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  /** A single soft oscillator voice with an exponential decay envelope. */
  function voice(freq, { type = 'sine', at = 0, dur = 0.25, vol = 0.2, dest = null, slide = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(dest ?? master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Filtered noise, for the husk's crackle and the dash's whoosh. */
  function noise({ at = 0, dur = 0.2, vol = 0.25, freq = 900, q = 0.8 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + at;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    /** Call from any key or pointer handler: creates/resumes the context. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
      return muted;
    },
    setFever(on) {
      fever = on;
    },
    /** A matched catch: the note climbs the ladder as the combo grows. */
    catch(combo) {
      const step = PENTA[Math.min(combo, PENTA.length - 1) % PENTA.length] + 12 * Math.floor(Math.min(combo, 30) / PENTA.length);
      voice(noteHz(step), { type: 'triangle', dur: 0.28, vol: 0.22 });
      voice(noteHz(step) * 2, { type: 'sine', dur: 0.18, vol: 0.07 });
    },
    /** A wrong-colour catch: the ember douses with a dull, falling thud. */
    wrong() {
      voice(196, { type: 'sine', dur: 0.22, vol: 0.2, slide: -70 });
      noise({ dur: 0.12, vol: 0.06, freq: 500 });
    },
    /** A husk in the cradle: crackle over a low boom. */
    husk() {
      noise({ dur: 0.3, vol: 0.3, freq: 700 });
      voice(82, { type: 'sine', dur: 0.4, vol: 0.32, slide: -30 });
    },
    /** The golden moth: a three-note sparkle. */
    moth() {
      voice(noteHz(19), { type: 'sine', dur: 0.3, vol: 0.16 });
      voice(noteHz(23), { type: 'sine', at: 0.07, dur: 0.3, vol: 0.16 });
      voice(noteHz(26), { type: 'sine', at: 0.14, dur: 0.42, vol: 0.18 });
    },
    switchColor() {
      voice(660, { type: 'sine', dur: 0.07, vol: 0.06 });
    },
    dash() {
      noise({ dur: 0.16, vol: 0.1, freq: 1600 });
    },
    feverStart() {
      voice(noteHz(12), { type: 'sawtooth', dur: 0.5, vol: 0.05, slide: noteHz(24) - noteHz(12) });
      voice(noteHz(24), { type: 'triangle', at: 0.1, dur: 0.4, vol: 0.14 });
    },
    nightClear() {
      [12, 16, 19, 24].forEach((s, i) => voice(noteHz(s), { type: 'triangle', at: i * 0.09, dur: 0.4, vol: 0.16 }));
    },
    gameOver() {
      [7, 4, 0, -5].forEach((s, i) => voice(noteHz(s), { type: 'triangle', at: i * 0.16, dur: 0.5, vol: 0.16 }));
    },
    dawn() {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => voice(noteHz(s), { type: 'triangle', at: i * 0.11, dur: 0.7, vol: 0.15 }));
    },
    /**
     * Advance the music loop; call once a frame with the frame's seconds. Notes are
     * scheduled a little ahead on a slow pentatonic walk, over a two-chord pad that
     * changes every eight notes. During the fever the walk hurries and brightens.
     */
    update(dt) {
      if (!ctx || muted) return;
      musicTimer += dt;
      const interval = fever ? 0.21 : 0.42;
      while (ctx.currentTime + 0.15 >= nextNoteAt) {
        const ahead = Math.max(0, nextNoteAt - ctx.currentTime);
        const walk = [0, 2, 1, 3, 2, 4, 3, 2][noteIndex % 8];
        const chord = Math.floor(noteIndex / 8) % 2 === 0 ? 0 : -3;
        voice(noteHz(PENTA[walk] + chord), { type: 'triangle', at: ahead, dur: 0.5, vol: 0.055, dest: musicGain });
        if (noteIndex % 8 === 0) {
          voice(noteHz(chord - 12), { type: 'sine', at: ahead, dur: 3.4, vol: 0.05, dest: musicGain });
          voice(noteHz(chord - 5), { type: 'sine', at: ahead, dur: 3.4, vol: 0.035, dest: musicGain });
        }
        noteIndex += 1;
        nextNoteAt += interval;
      }
    },
  };
}
