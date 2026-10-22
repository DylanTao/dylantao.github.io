// Physical controllers for walking (walk-controls.mjs), through the Gamepad API's standard mapping
// (https://w3c.github.io/gamepad/#remapping): the left stick moves, the right stick looks, the left
// stick's click, the left bumper or the left trigger runs, and Y (triangle) switches between orbiting
// and walking. Sticks get a radial dead zone (a resting stick drifts by a few percent) rescaled so
// the response starts at zero just past it and still reaches full deflection.

export const STICK_DEADZONE = 0.16;

export function radialDeadzone(x, y, deadzone = STICK_DEADZONE) {
  const length = Math.hypot(x, y);
  if (!(length > deadzone)) return [0, 0];
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return [(x / length) * scaled, (y / length) * scaled];
}

const pressed = (button) => Boolean(button && (button.pressed || button.value > 0.5));

// One controller's state: move is [right, forward] and look is [right, up], each in the unit disc.
export function readGamepad(pad, deadzone = STICK_DEADZONE) {
  const axes = pad?.axes || [],
    buttons = pad?.buttons || [];
  const [mx, my] = radialDeadzone(axes[0] || 0, axes[1] || 0, deadzone),
    [lx, ly] = radialDeadzone(axes[2] || 0, axes[3] || 0, deadzone);
  // Screen-down is positive on both sticks.
  const move = [mx, -my],
    look = [lx, -ly];
  return {
    move,
    look,
    run: pressed(buttons[10]) || pressed(buttons[4]) || pressed(buttons[6]),
    toggle: pressed(buttons[3]),
    active: Boolean(mx || my || lx || ly),
  };
}

// Every connected controller, combined: the strongest stick wins and the toggle reports one press.
export function createGamepads({ getGamepads = () => globalThis.navigator?.getGamepads?.() || [] } = {}) {
  let wasToggle = false,
    connected = 0;
  return {
    poll() {
      let pads = [];
      try {
        pads = [...getGamepads()].filter((pad) => pad && pad.connected !== false);
      } catch {
        pads = [];
      }
      connected = pads.length;
      const state = { move: [0, 0], look: [0, 0], run: false, toggled: false, active: false, connected };
      let toggle = false;
      for (const pad of pads) {
        const read = readGamepad(pad);
        if (Math.hypot(...read.move) > Math.hypot(...state.move)) state.move = read.move;
        if (Math.hypot(...read.look) > Math.hypot(...state.look)) state.look = read.look;
        state.run ||= read.run;
        state.active ||= read.active;
        toggle ||= read.toggle;
      }
      state.toggled = toggle && !wasToggle;
      wasToggle = toggle;
      return state;
    },
    get connected() {
      return connected;
    },
  };
}
