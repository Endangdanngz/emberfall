// Keyboard, mouse and touch input. Held keys give the glide direction; the pointer
// steers the skiff directly while it moves. One-shot actions (confirm, pause, switch
// colour, dash, mute) are latched as bits until the game takes them, so a tap between
// frames is never lost. Colour keys: J / K / L or 1 / 2 / 3 choose the lantern colour,
// Q / E (or Tab) cycle it; Shift dashes; Space / Enter confirms; P / Esc pauses; M mutes.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_SWITCH_0 = 16;
export const ACTION_SWITCH_1 = 32;
export const ACTION_SWITCH_2 = 64;
export const ACTION_CYCLE_UP = 128;
export const ACTION_CYCLE_DOWN = 256;

const SWITCH_BITS = [ACTION_SWITCH_0, ACTION_SWITCH_1, ACTION_SWITCH_2];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerX = null;
  let pointerActive = false;

  function latch(bit) {
    actions |= bit;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      return;
    }
    switch (event.key) {
      case 'ArrowLeft': case 'ArrowRight': case ' ':
        event.preventDefault();
        break;
      default:
        break;
    }
    held.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    switch (event.key) {
      case ' ': case 'Enter': latch(ACTION_CONFIRM); break;
      case 'p': case 'P': case 'Escape': latch(ACTION_PAUSE); break;
      case 'm': case 'M': latch(ACTION_MUTE); break;
      case 'Shift': latch(ACTION_DASH); break;
      case 'j': case 'J': case '1': latch(ACTION_SWITCH_0); break;
      case 'k': case 'K': case '2': latch(ACTION_SWITCH_1); break;
      case 'l': case 'L': case '3': latch(ACTION_SWITCH_2); break;
      case 'q': case 'Q': latch(ACTION_CYCLE_DOWN); break;
      case 'e': case 'E': case 'Tab':
        if (event.key === 'Tab') event.preventDefault();
        latch(ACTION_CYCLE_UP);
        break;
      default: break;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => held.clear());

  function toField(clientX) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * 1280;
  }

  canvas.addEventListener('pointermove', (event) => {
    const x = toField(event.clientX);
    if (x !== null) {
      pointerX = x;
      pointerActive = true;
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    const x = toField(event.clientX);
    if (x !== null) {
      pointerX = x;
      pointerActive = true;
    }
    latch(ACTION_CONFIRM);
  });
  canvas.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  return {
    /** -1, 0 or 1 from the held arrow / WASD keys. */
    direction() {
      const left = held.has('ArrowLeft') || held.has('a');
      const right = held.has('ArrowRight') || held.has('d');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The pointer's field x while the player is steering with it, else null. */
    pointer() {
      return pointerActive ? pointerX : null;
    },
    /** The latched action bits since the last take; taking clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Which colour a latched switch action chose (0, 1, 2), or -1 for none. */
    switchTarget(bits) {
      for (let i = 0; i < SWITCH_BITS.length; i += 1) {
        if (bits & SWITCH_BITS[i]) return i;
      }
      return -1;
    },
  };
}
