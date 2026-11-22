import { controlArt } from "./coastal-control-art.mjs";

const svgNS = "http://www.w3.org/2000/svg";
const looks = ["realistic", "cosmic", "field-guide", "pencil", "paint", "thermal"];
const rails = new WeakMap();
let sequence = 0;

function node(tag, attributes) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function mount(rail, position) {
  const prefix = "coastal-plate-" + ++sequence + "-";
  const volume = rail.hasAttribute("data-volume-rail");
  const dimensions = {
    viewBox: volume ? "0 0 612 66" : "0 0 612 156",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": "true",
    focusable: "false",
  };
  const surface = node("svg", dimensions),
    lens = node("svg", dimensions);
  const defs = node("defs", {}),
    frame = node("g", { id: prefix + "frame" });
  const first = node("use", {}),
    second = node("use", {});
  frame.append(first, second);
  surface.append(defs, frame);
  lens.append(node("use", { href: "#" + prefix + "frame" }));
  rail.querySelector(".coastal-slider-scene").append(surface);
  rail.querySelector(".coastal-slider-lens").append(lens);
  const state = { prefix, volume, defs, first, second, position, target: null, frame: 0, drawn: new Set() };
  rails.set(rail, state);
  return state;
}

function impression(s, index) {
  const key = looks[index],
    id = s.prefix + key;
  if (!s.drawn.has(index)) {
    const group = node("g", { id });
    group.innerHTML = controlArt(key, s.volume, id + "-");
    s.defs.append(group);
    s.drawn.add(index);
  }
  return "#" + id;
}

function show(rail, s, position) {
  const lo = Math.floor(position),
    hi = Math.ceil(position),
    t = position - lo;
  const base = impression(s, lo);
  if (s.first.getAttribute("href") !== base) s.first.setAttribute("href", base);
  if (hi !== lo) {
    const overlay = impression(s, hi);
    if (s.second.getAttribute("href") !== overlay) s.second.setAttribute("href", overlay);
    s.second.setAttribute("opacity", String(t * t * (3 - 2 * t)));
  } else s.second.setAttribute("opacity", "0");
  if (!s.volume) rail.style.setProperty("--u", position / (looks.length - 1));
  s.position = position;
}

// The actual picture and the lens instance have the very same vector source.
// A pointer moves continuously between stops; keyboard selection settles from
// the last visible position, including an interrupted change or reversal.
export function drawMiniature(rail, value, direct = false) {
  const n = Math.max(0, Math.min(looks.length - 1, value));
  const s = rails.get(rail) || mount(rail, n);
  if (n === s.target && !direct) return;
  cancelAnimationFrame(s.frame);
  s.target = n;
  rail.dataset.plate = looks[Math.round(n)];
  if (direct || s.position === n || window.siteMotion?.paused || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    show(rail, s, n);
    return;
  }
  const from = s.position,
    start = performance.now();
  function slide(now) {
    const t = Math.min(1, (now - start) / 310);
    show(rail, s, from + (n - from) * t * t * (3 - 2 * t));
    if (t < 1) s.frame = requestAnimationFrame(slide);
  }
  s.frame = requestAnimationFrame(slide);
}
