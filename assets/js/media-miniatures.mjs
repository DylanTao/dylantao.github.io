// Five drawings made to be read both at thumb size and through the loupe.
// Each plate has its own marks and silhouettes. Coordinate space is 320 by 68.
import { illustrateListeningRoom } from "./listening-room-illustration.mjs";
const W = 320,
  H = 68;
const looks = ["cosmic", "field-guide", "pencil", "paint", "thermal"];
const plates = new Map();

function path(c, d, fill, stroke, width = 1) {
  const p = new Path2D(d);
  if (fill) {
    c.fillStyle = fill;
    c.fill(p);
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke(p);
  }
}
function oval(c, x, y, rx, ry, color, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, 2 * Math.PI);
  c.fillStyle = color;
  c.fill();
}
function line(c, x, y, ex, ey, ink, w = 1) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  c.lineWidth = w;
  c.strokeStyle = ink;
  c.stroke();
}
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function seed(i) {
  const x = Math.sin(i * 193.13 + 23.19) * 7218.29;
  return x - Math.floor(x);
}
function sky(c, a, b) {
  const g = c.createLinearGradient(0, 0, 0, 68);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  rect(c, 0, 0, W, H, g);
}
// A cliff observatory, a tilted moon, a lab desk and one untroubled, long-tailed
// visitor. Black silhouette ratios and flat cast shadows do most of the work.
function cosmic(c) {
  sky(c, "#7dd2d9", "#f0d99e");
  path(c, "M0 34 Q39 29 65 33 T132 32 L320 32 L320 68 H0Z", "#408a9d");
  oval(c, 54, 17, 12, 11, "#ffc16b");
  path(c, "M34 23 Q47 14 67 12 Q78 10 74 13 Q60 21 36 24Z", "#8a5f94", "#283950", 0.7);
  for (let i = 0; i < 26; i++)
    line(c, seed(i) * 320, 34 + seed(i + 50) * 24, seed(i) * 320 + 2 + seed(i + 4) * 8, 34 + seed(i + 50) * 24, "#b0ece3", 0.55);
  path(c, "M79 61 Q91 47 101 46 Q113 44 117 40 L158 42 L170 31 L199 35 L218 25 L320 25 V68 H0 V63Z", "#d78f63", "#263a4a", 1.6);
  path(c, "M122 45 L128 22 Q152 16 178 18 L208 25 L209 45Z", "#e8dfaf", "#253746", 1.8);
  path(c, "M123 23 Q151 10 179 13 L214 21 L211 25 Q163 17 127 28Z", "#ac807b", "#263848", 1.5);
  path(c, "M133 27 Q145 23 155 23 L155 39 L132 41Z", "#384b66");
  path(c, "M160 23 L181 23 L181 39 L160 39Z", "#695b76", "#273642", 1);
  path(c, "M186 24 L201 27 L201 40 L186 39Z", "#f6ae68", "#283746", 1);
  path(c, "M143 36 H151 M146 36 V40 M162 34 H177 M164 34 L163 39 M174 34 V39", null, "#f7cb87", 0.9);
  path(c, "M108 50 Q124 45 140 46 L190 46 L241 33 L250 34 L196 50 L140 51Z", "#995f5d");
  path(
    c,
    "M227 47 Q245 48 249 38 Q251 32 255 32 Q258 32 258 35 Q264 35 266 41 L273 44 L264 43 L262 47 L258 47 L256 43 Q251 46 247 47 Q234 53 227 47Z",
    "#739754",
    "#223441",
    1
  );
  oval(c, 255, 34.5, 1.1, 1.2, "#ffe5ad");
  oval(c, 255.4, 34.6, 0.45, 0.7, "#222e3a");
  path(c, "M284 63 Q291 50 292 37 Q290 30 298 28 Q302 25 306 24 M292 38 Q289 32 280 32", null, "#342f49", 3.3);
  for (const [x, y, r] of [
    [280, 29, 10],
    [297, 24, 12],
    [309, 22, 9],
  ]) {
    oval(c, x, y, r, 4.5, "#223d4c");
    oval(c, x - 1, y - 1.2, r - 1, 3.2, "#578b84");
  }
  path(c, "M0 60 Q31 48 50 54 T91 62 L123 57 Q157 51 169 56 Q192 65 224 59 T320 54 V68 H0Z", "#514462");
}
// A tide-pool field plate. Fine stipple, bladder kelp and a little heron are
// individually drawn, like observations made from the same stretch of shore.
function fieldNotes(c) {
  sky(c, "#d8d2b5", "#eee3c3");
  const ink = "#353d33";
  path(c, "M0 25 Q30 18 49 22 T89 22 T147 24 L201 18 L227 22 L320 20 V49 H0Z", "#a7b6a6");
  path(c, "M0 38 Q60 30 113 36 Q154 39 186 30 Q224 18 244 24 Q262 28 282 22 Q298 17 320 20 V68 H0Z", "#bea67d", ink, 0.75);
  for (let i = 0; i < 190; i++) {
    const x = seed(i + 15) * 320,
      y = seed(i + 412) * 31 + 39;
    oval(c, x, y, 0.23 + seed(i + 811) * 0.4, 0.32, "#736e52");
  }
  path(c, "M49 32 L67 22 L90 23 L103 29 L102 38 L49 38Z", "#ddd0a8", ink, 0.9);
  path(c, "M52 31 L67 25 L84 25 L84 35 L53 36Z", "#85978a", ink, 0.55);
  for (let x = 57; x < 83; x += 5) line(c, x, 29, x, 35, "#526352", 0.5);
  path(c, "M102 51 Q126 39 150 43 Q173 46 198 37 Q223 31 240 35 Q222 36 206 42 Q170 57 133 50 Q115 48 102 51Z", "#839e96", ink, 0.65);
  function kelp(x, y, h, d) {
    path(c, `M${x} ${y} q${d * 5} ${-h * 0.5} ${d * 3} ${-h}`, null, ink, 0.72);
    for (let i = 1; i < 7; i++) {
      const a = i / 7,
        px = x + d * 3 * a,
        py = y - h * a,
        dx = d * (i % 2 ? 7 : -7) * (1.12 - 0.5 * a);
      path(c, `M${px} ${py} q${dx * 0.43} -4 ${dx} -5 q${-dx * 0.22} 5 ${-dx} 5Z`, "#798963", ink, 0.48);
      oval(c, px + dx * 0.83, py - 4.7, 1.2, 1.05, "#b28b53");
    }
  }
  kelp(25, 70, 62, 1);
  kelp(39, 69, 33, -1);
  kelp(285, 72, 53, 1);
  kelp(301, 69, 42, -1);
  for (const [x, y, s] of [
    [141, 47, 0.9],
    [224, 39, 0.64],
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    path(
      c,
      "M-7 -1 Q-3 -6 2 -5 Q7 -5 7 -10 Q6 -15 10 -16 Q13 -17 14 -15 L21 -14.8 L14 -13 L11 -13 Q9 -11 10 -8 Q11 -3 5 -1 L1 1 L-6 1Z",
      "#e9e2c7",
      ink,
      0.75
    );
    line(c, 0, 1, -1, 9, ink, 0.6);
    line(c, 3, 1, 5, 8, ink, 0.6);
    line(c, -7, 1, -12, 4, ink, 0.7);
    c.restore();
  }
  for (let i = 0; i < 12; i++) {
    const x = 59 + seed(i + 70) * 175,
      y = 54 + seed(i + 17) * 9;
    path(c, `M${x} ${y} q3 -2 6 0 q-1 1 -6 0`, null, "#706b56", 0.45);
  }
}
// An inked Venetian blind throws a wedge across a listening booth. The lamp
// and record pick out a face in negative space without filling the sheet black.
function pencil(c) {
  sky(c, "#d4d1c9", "#f4f1e9");
  const black = "#292829";
  path(c, "M0 0 H72 L38 44 L0 50Z", black);
  path(c, "M0 62 L75 41 L142 40 L178 46 L278 27 L320 28 V68 H0Z", "#a8a49e");
  path(c, "M12 3 L93 4 L64 35 L0 44Z", "#dcdad3", black, 1.2);
  for (let i = 0; i < 7; i++) line(c, 0, 10 + i * 5, 89 - i * 4, 4 + i * 3.1, black, 1.6);
  path(c, "M93 8 L204 8 L193 42 L81 42Z", "#ebe9e2", black, 1.35);
  path(c, "M100 13 L195 13 L187 34 L94 34Z", "#535354");
  for (let i = 0; i < 21; i++) line(c, 95 + i * 4, 33, 105 + i * 4, 14, "#cccac1", 0.55);
  path(c, "M137 35 Q148 27 153 30 Q164 34 174 27 L185 27 L183 32 Q166 37 146 36Z", "#f0ede6");
  path(c, "M205 5 L234 5 L248 20 L199 20Z", black);
  path(c, "M205 19 H242 L227 37 L211 40Z", "#f7f4ec");
  line(c, 219, 0, 219, 6, black, 0.8);
  path(c, "M120 47 L172 40 L199 45 L144 54Z", black);
  oval(c, 160, 45.7, 11.4, 3.4, "#918c87", -0.12);
  oval(c, 161, 45.5, 2.4, 0.9, "#ece9de");
  line(c, 150, 52, 148, 63, black, 1.6);
  line(c, 186, 46, 183, 56, black, 1.1);
  path(c, "M250 46 Q248 36 254 34 Q260 31 267 36 L277 40 L284 53 L272 59 L254 57Z", "#62605f", black, 1.6);
  path(c, "M250 34 Q255 28 260 28 Q267 29 268 35 L273 37 Q260 39 247 37Z", black);
  for (let i = 0; i < 83; i++) {
    const x = seed(i) * 315,
      y = seed(91 + i) * 15 + 48;
    line(c, x, y, x + 2 + seed(i + 201) * 8, y - 2 - seed(i + 93) * 3, "#5f5d5d", 0.47);
  }
  path(c, "M0 67 Q45 53 71 57 T116 63 L138 61 M228 58 L237 55 M287 55 L307 48", null, black, 0.9);
}
// Small opaque bristle marks change direction with each plane, from water to
// cliff to the cypress. The sun and its broken reflection supply the light.
function brush(c) {
  sky(c, "#767d9d", "#f8ccb1");
  oval(c, 208, 21, 8.5, 8.1, "#ffd697");
  path(c, "M0 30 Q66 24 116 30 T214 29 L320 27 V68 H0Z", "#717f92");
  path(c, "M0 8 Q15 6 32 20 T76 32 Q88 36 102 36 L69 44 L24 50 L0 54Z", "#765c71");
  path(c, "M0 27 Q14 22 37 31 T85 36 L38 42 L0 47Z", "#ce936f");
  path(c, "M104 49 Q140 34 159 33 L176 23 L199 24 L206 36 L219 39 L242 39 L258 34 L287 31 L320 35 V68 H79Z", "#bf8d74");
  path(c, "M148 37 L161 25 L191 20 L207 27 L203 39Z", "#a15e53");
  path(c, "M157 35 L165 28 L182 25 L180 34Z", "#f8cd8f");
  for (let i = 0; i < 490; i++) {
    const x = seed(i + 80) * 320,
      y = seed(i + 992) * 68;
    let colors, dx, dy;
    if (y < 27) {
      colors = ["#f3cbaa", "#9b92a1", "#b9a7ad"];
      dx = 3 + seed(i) * 10;
      dy = -0.65;
    } else if (x < 122 && y < 55) {
      colors = ["#b2a8b0", "#8193a0", "#dfb394"];
      dx = 3 + seed(i) * 8;
      dy = -0.15;
    } else {
      colors = ["#b37867", "#957984", "#dcac8a", "#9c7b71"];
      dx = 2 + seed(i) * 6;
      dy = -1.8;
    }
    c.globalAlpha = 0.27 + seed(i + 42) * 0.24;
    line(c, x, y, x + dx, y + dy, colors[i % colors.length], 0.45 + seed(i + 51) * 1.1);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 15; i++) {
    const y = 31 + i * 1.8,
      x = 204 + Math.sin(i * 6) * i * 0.5;
    line(c, x, y, x + 3 + i * 0.45, y - 0.15, "#fbd398", 0.7);
  }
  path(c, "M65 57 Q64 45 72 35 Q75 29 70 25 M70 38 Q59 32 53 33", null, "#5c4b5a", 2.4);
  for (let i = 0; i < 50; i++) {
    const x = 55 + seed(i + 70) * 26,
      y = 22 + seed(i + 31) * 12;
    line(c, x, y, x + 3, y - 1, ["#55535f", "#655767", "#8d716d"][i % 3], 1.4);
  }
}
// In thermal print only warm bodies and the amp run through the hot inks.
// Registration, Ben Day dots, and isotherms have different visual jobs.
function thermal(c) {
  sky(c, "#1e2558", "#384574");
  const ink = "#191a38";
  path(c, "M0 34 L76 32 L87 22 L127 22 L139 28 L182 29 L188 16 L240 13 L256 26 L320 18 V68 H0Z", "#514184", ink, 1.5);
  path(c, "M67 38 L94 24 L119 24 L133 30 L126 43Z", "#ad377f", ink, 1.2);
  path(c, "M75 39 L90 31 L123 29 L121 37Z", "#374b85");
  path(c, "M150 35 L189 24 L236 20 L256 26 L242 45 L183 53Z", "#34264f", "#e64b88", 1.25);
  for (let i = 0; i < 7; i++) {
    const r = 1 - i * 0.108;
    oval(c, 213, 34, 19 * r, 9 * r, ["#743988", "#a03686", "#d74684", "#f36b67", "#f39b58", "#ffd378", "#fff2ac"][i], -0.15);
  }
  path(c, "M0 55 L67 47 L120 52 L177 43 L204 47 L251 41 L320 43 V68 H0Z", "#3f5986", ink, 1.2);
  for (let i = 0; i < 8; i++) {
    const t = 1 - i * 0.1;
    for (const x of [147, 155])
      oval(c, x, 54, 10 * t, 4.6 * t, ["#654090", "#88338e", "#ad3889", "#d24a80", "#e75e71", "#f28b5d", "#f9b768", "#ffde8a"][i], -0.16);
  }
  for (let x = 1; x < 320; x += 3.8)
    for (let y = 2 + (Math.floor(x / 3.8) % 2) * 1.8; y < 67; y += 3.8) {
      const r = 0.22 + 0.48 * (1 + Math.sin(x * 0.09 + y * 0.18)) * 0.5;
      oval(c, x, y, r, r, "#262644");
    }
  for (let i = 0; i < 6; i++) path(c, `M${14 + i * 2.5} 68 Q${26 + i * 3} 22 ${59 + i * 4} 8`, null, i % 2 ? "#67babf" : "#bb65a1", 0.46);
  path(c, "M270 12 Q254 49 279 53 Q290 54 298 43", null, "#9ad1cd", 0.8);
}
const painters = { cosmic, "field-guide": fieldNotes, pencil, paint: brush, thermal };
function plate(id, volume) {
  const key = id + (volume ? "/console" : "/room");
  if (plates.has(key)) return plates.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 220;
  const c = canvas.getContext("2d");
  if (!c) return null;
  let shore;
  if (!volume) {
    shore = document.createElement("canvas");
    shore.width = W * 2;
    shore.height = H * 2;
    const ctx = shore.getContext("2d");
    ctx.scale(2, 2);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    painters[id](ctx);
  }
  c.scale(2.5, 2.5);
  illustrateListeningRoom(c, id, shore, volume);
  plates.set(key, canvas);
  return canvas;
}
const rails = new WeakMap();
function renderAt(rail, state, n) {
  const lo = Math.floor(n),
    hi = Math.ceil(n),
    f = n - lo;
  const a = plate(looks[lo], state.volume),
    b = hi === lo ? null : plate(looks[hi], state.volume);
  if (!a) return;
  for (const c of state.contexts) {
    c.globalAlpha = 1;
    c.drawImage(a, 0, 0);
    if (b) {
      c.globalAlpha = f * f * (3 - 2 * f);
      c.drawImage(b, 0, 0);
      c.globalAlpha = 1;
    }
  }
  if (!state.volume) rail.style.setProperty("--u", n / (looks.length - 1));
  state.position = n;
}
export function drawMiniature(rail, value, direct = false) {
  const n = Math.max(0, Math.min(looks.length - 1, value));
  let state = rails.get(rail);
  if (!state) {
    const contexts = [];
    for (const holder of rail.querySelectorAll(".coastal-slider-scene, .coastal-slider-lens")) {
      const canvas = holder.appendChild(document.createElement("canvas"));
      canvas.width = 1000;
      canvas.height = 220;
      const ctx = canvas.getContext("2d");
      if (ctx) contexts.push(ctx);
    }
    state = { contexts, volume: rail.hasAttribute("data-volume-rail"), position: n, frame: 0 };
    rails.set(rail, state);
    direct = true;
  }
  if (state.target === n && !direct) return;
  cancelAnimationFrame(state.frame);
  state.target = n;
  rail.dataset.plate = looks[Math.round(n)];
  if (direct || window.siteMotion?.paused || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderAt(rail, state, n);
    return;
  }
  const from = state.position,
    start = performance.now();
  const slide = (now) => {
    const t = Math.min(1, (now - start) / 290),
      u = t * t * (3 - 2 * t);
    renderAt(rail, state, from + (n - from) * u);
    if (t < 1) state.frame = requestAnimationFrame(slide);
  };
  state.frame = requestAnimationFrame(slide);
}
