// Twin thumb sticks for walking on phones and tablets (walk-controls.mjs): the left one moves, the
// right one looks. Each is a translucent, thumb-sized pad that follows one finger with pointer
// capture, so both thumbs work at once and a finger may slide off the pad without letting go. The
// knob stops at the rim; a small dead zone keeps a resting thumb from creeping.
//
// They are a touch alternative to the keyboard and mouse, so they are hidden from assistive
// technology (the Walk switch, the keyboard and the orbit view stay available) and labelled in plain
// text for the eye.

export const STICK_DEADZONE = 0.12;

// A thumb's offset from the pad's centre as a stick: [right, up] in the unit disc, plus the knob's
// offset in pixels (clamped to the rim).
export function stickVector(dx, dy, radius, deadzone = STICK_DEADZONE) {
  const length = Math.hypot(dx, dy),
    reach = Math.max(1, radius),
    rim = Math.min(length, reach),
    knob = length > 0 ? [(dx / length) * rim, (dy / length) * rim] : [0, 0];
  const magnitude = rim / reach;
  if (!(magnitude > deadzone)) return { vector: [0, 0], knob, magnitude: 0 };
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return { vector: [(dx / length) * scaled, (-dy / length) * scaled], knob, magnitude: scaled };
}

export function createVirtualJoysticks(host, { onInput = () => {} } = {}) {
  const doc = host.ownerDocument;
  const element = doc.createElement("div");
  element.className = "home-world-sticks";
  element.dataset.worldSticks = "";
  element.setAttribute("aria-hidden", "true");
  element.hidden = true;
  const state = { move: [0, 0], look: [0, 0] };
  const sticks = [];
  const cleanups = [];
  for (const [name, label] of [
    ["move", "Move"],
    ["look", "Look"],
  ]) {
    const pad = doc.createElement("div");
    pad.className = "home-world-stick";
    pad.dataset.worldStick = name;
    const knob = doc.createElement("span");
    knob.className = "home-world-stick-knob";
    const caption = doc.createElement("span");
    caption.className = "home-world-stick-label";
    caption.textContent = label;
    pad.append(knob, caption);
    element.append(pad);
    const stick = { name, pad, knob, pointer: null, centre: [0, 0], radius: 1 };
    sticks.push(stick);
    const update = (event) => {
      const { vector, knob: offset } = stickVector(event.clientX - stick.centre[0], event.clientY - stick.centre[1], stick.radius);
      state[name] = vector;
      knob.style.transform = `translate(${offset[0].toFixed(1)}px, ${offset[1].toFixed(1)}px)`;
      onInput(state);
    };
    const release = (event) => {
      if (event.pointerId !== stick.pointer) return;
      stick.pointer = null;
      state[name] = [0, 0];
      knob.style.transform = "";
      pad.classList.remove("is-active");
      onInput(state);
    };
    const listen = (type, fn) => {
      pad.addEventListener(type, fn);
      cleanups.push(() => pad.removeEventListener(type, fn));
    };
    listen("pointerdown", (event) => {
      if (stick.pointer !== null) return;
      event.preventDefault();
      stick.pointer = event.pointerId;
      const rect = pad.getBoundingClientRect();
      stick.centre = [rect.left + rect.width / 2, rect.top + rect.height / 2];
      // The knob reaches the pad's rim at full deflection.
      stick.radius = Math.max(16, rect.width / 2 - 12);
      try {
        pad.setPointerCapture(event.pointerId);
      } catch {
        /* A synthetic pointer cannot be captured; moves over the pad still steer. */
      }
      pad.classList.add("is-active");
      update(event);
    });
    listen("pointermove", (event) => {
      if (event.pointerId === stick.pointer) update(event);
    });
    listen("pointerup", release);
    listen("pointercancel", release);
    listen("lostpointercapture", release);
    listen("contextmenu", (event) => event.preventDefault());
  }
  host.append(element);
  const reset = () => {
    for (const stick of sticks) {
      stick.pointer = null;
      stick.knob.style.transform = "";
      stick.pad.classList.remove("is-active");
    }
    state.move = [0, 0];
    state.look = [0, 0];
  };
  return {
    element,
    state,
    show() {
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
      reset();
    },
    get visible() {
      return !element.hidden;
    },
    get active() {
      return sticks.some((stick) => stick.pointer !== null);
    },
    dispose() {
      cleanups.splice(0).forEach((off) => off());
      element.remove();
    },
  };
}
