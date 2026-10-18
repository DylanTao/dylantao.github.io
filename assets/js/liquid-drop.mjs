// Liquid glass that splits and re-merges (2026-10-18), used in two places: the blog's layout toggle,
// whose selected drop pulls away from one icon and pools under the other, and an opened project
// card's actions, which bud out of the close button as one drop and split into their buttons.
//
// Two layers make it. A goo filter (blur, then a hard alpha threshold) merges drops that touch, so
// a drop leaving another stretches a bridge that thins and snaps. And where SVG filters draw inside
// backdrop-filter (Chromium; liquid-glass.js sets html[data-liquid-glass]), a lens bends what is
// under the selected drop like the rim of a glass bead. Firefox and Safari parse the same rule and
// draw nothing, so they keep the plain frosted drop.

// A displacement map for a lens of width x height pixels: neutral (128, 128) in the middle, and
// toward the rim, a pull toward the centre that grows over the outer `bevel` fraction, so what lies
// under the rim is drawn from further in and the edge magnifies. RGBA bytes, row by row.
export function lensMap(width, height, { bevel = 0.42, strength = 1 } = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const inner = 1 - bevel;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const r = Math.hypot(u, v);
      let dx = 0;
      let dy = 0;
      if (r > inner && r <= 1 && r > 0) {
        const t = (r - inner) / bevel;
        const m = t * t * (3 - 2 * t) * strength;
        dx = (-u / r) * m;
        dy = (-v / r) * m;
      }
      const i = (y * width + x) * 4;
      data[i] = Math.round(128 + 127 * dx);
      data[i + 1] = Math.round(128 + 127 * dy);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return data;
}

// Keyframes for one drop of a split: it buds from offset (x0, y0) as a small bead (scale s0), travels
// out on `travel` while stretching along its path in proportion to its speed, and lands with the
// overshoot of `bounce`. Springs come from site-motion.mjs; the last frame is exactly at rest.
export function dropFrames(travel, bounce, { x0 = 0, y0 = 0, s0 = 0.3, stretch = 0.28, count = 28 } = {}) {
  const seconds = travel.duration / 1000;
  const distance = Math.hypot(x0, y0);
  const angle = distance > 0.5 ? (Math.atan2(-y0, -x0) * 180) / Math.PI : 0;
  // Fastest speed a release from this distance reaches, to normalise the stretch.
  let peak = 1;
  for (let i = 0; i <= 40; i++) {
    const t = (seconds * i) / 40;
    peak = Math.max(peak, Math.hypot(travel.state(x0, 0, t)[1], travel.state(y0, 0, t)[1]));
  }
  const bounceScale = bounce.seconds / seconds;
  const frames = [];
  for (let i = 0; i <= count; i++) {
    const p = i / count;
    if (i === count) {
      frames.push({ offset: 1, transform: "translate(0px, 0px) scale(1)" });
      break;
    }
    const t = seconds * p;
    const [x, vx] = travel.state(x0, 0, t);
    const [y, vy] = travel.state(y0, 0, t);
    const s = 1 + bounce.state(s0 - 1, 0, t * bounceScale)[0];
    const k = distance > 0.5 ? 1 + stretch * (Math.hypot(vx, vy) / peak) : 1;
    frames.push({
      offset: p,
      transform:
        `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${angle.toFixed(1)}deg) ` +
        `scale(${(s * k).toFixed(4)}, ${(s / k).toFixed(4)}) rotate(${(-angle).toFixed(1)}deg)`,
    });
  }
  return frames;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function defs() {
  let svg = document.getElementById("liquid-drop-defs");
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("id", "liquid-drop-defs");
    svg.setAttribute("class", "liquid-glass-defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    document.body.append(svg);
  }
  return svg;
}

// The goo: drops closer than about two blur radii melt into one shape with a crisp edge.
export function ensureGooFilter(id = "liquid-drop-goo", blur = 4.5) {
  if (typeof document === "undefined") return null;
  if (document.getElementById(id)) return id;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.innerHTML =
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blur"/>` +
    `<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo"/>` +
    `<feComposite in="SourceGraphic" in2="goo" operator="atop"/>`;
  defs().append(filter);
  return id;
}

// The lens, drawn for one size (a lens map is not resolution independent).
export function ensureLensFilter(id, width, height, { scale = 9, bevel = 0.42 } = {}) {
  if (typeof document === "undefined") return null;
  if (document.getElementById(id)) return id;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.putImageData(new ImageData(lensMap(width, height, { bevel }), width, height), 0, 0);
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.innerHTML =
    `<feImage href="${canvas.toDataURL("image/png")}" preserveAspectRatio="none" result="map"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
  defs().append(filter);
  return id;
}

// An opened card's actions bud out of the panel's edge as one drop: the first stretches from a bead
// into its button, the next pulls away from it (the goo draws the bridge until it snaps), and each
// button's label settles in as its drop lands. The drops are a throwaway layer under the real
// buttons, coloured like them, removed when the motion ends. Returns the animations it started.
export function splitActions(container, { travel, bounce, delay = 90 } = {}) {
  if (typeof document === "undefined" || !container || !travel || !bounce) return [];
  const actions = Array.from(container.children).filter(
    (child) => child.matches("a, button") && child.getClientRects().length && !child.classList.contains("liquid-drop-layer")
  );
  if (!actions.length) return [];
  const goo = ensureGooFilter();
  const box = container.getBoundingClientRect();
  const layer = document.createElement("span");
  layer.className = "liquid-drop-layer";
  layer.setAttribute("aria-hidden", "true");
  if (goo) layer.style.filter = `url("#${goo}")`;
  container.prepend(layer);
  const first = actions[0].getBoundingClientRect();
  // The bud: a bead at the first button's leading end.
  const bud = { x: first.left - box.left + first.height / 2, y: first.top - box.top + first.height / 2 };
  const animations = [];
  actions.forEach((action, index) => {
    const rect = action.getBoundingClientRect();
    const style = getComputedStyle(action);
    const drop = document.createElement("span");
    drop.className = "liquid-drop";
    Object.assign(drop.style, {
      left: `${rect.left - box.left}px`,
      top: `${rect.top - box.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: style.backgroundColor === "rgba(0, 0, 0, 0)" ? "var(--glass-tint-strong)" : style.backgroundColor,
    });
    layer.append(drop);
    // From a bead at the bud to its own button: the bead is a circle the button's height across.
    const cx = rect.left - box.left + rect.width / 2;
    const cy = rect.top - box.top + rect.height / 2;
    const bead = Math.max(0.12, rect.height / rect.width);
    const frames = dropFrames(travel, bounce, { x0: bud.x - cx, y0: bud.y - cy, s0: 1, stretch: 0.2 }).map((frame, i, list) => {
      const p = frame.offset;
      // Width grows from the bead to the full button as it travels; height holds.
      const grow = bead + (1 - bead) * travel.ease(Math.min(1, p * 1.1));
      return { offset: p, transform: `${frame.transform} scaleX(${i === list.length - 1 ? 1 : grow.toFixed(4)})` };
    });
    animations.push(drop.animate(frames, { duration: travel.duration, delay: delay + index * 70, easing: "linear", fill: "backwards" }));
    animations.push(
      action.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], {
        duration: travel.duration,
        delay: delay + index * 70,
        easing: "ease-out",
        fill: "backwards",
      })
    );
  });
  Promise.allSettled(animations.map((animation) => animation.finished)).then(() => layer.remove());
  return animations;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.SiteLiquid = Object.assign(window.SiteLiquid || {}, { lensMap, dropFrames, ensureGooFilter, ensureLensFilter, splitActions });
}
