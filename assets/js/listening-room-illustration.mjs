// A miniature cut through the cliff house. Coordinates are millimetres on a
// 400 x 88 drawing. The alcove, furniture, lighting and marks are drawn anew
// for each medium; the window holds that medium's illustration of the shore.
const colors = {
  cosmic: ["#232545", "#655182", "#a47894", "#e6a35d", "#ffdc83", "#57b9b4", "#b9dfcd", "#423552", "#f68d61"],
  "field-guide": ["#343d38", "#6c7360", "#b8b095", "#c59366", "#eee3bb", "#809b84", "#d9d4aa", "#514638", "#cb7355"],
  pencil: ["#252427", "#535153", "#a09c99", "#c1bcb4", "#eeeae1", "#8e8d8a", "#f2eee5", "#363538", "#dedbd3"],
  paint: ["#3b354b", "#78677e", "#cc9c92", "#cd895c", "#ffd392", "#7ca4a4", "#dfcabc", "#675064", "#da7053"],
  thermal: ["#191739", "#42346e", "#704486", "#bd4385", "#ffc96f", "#599ba9", "#819eb0", "#342853", "#ff715e"],
};
const rand = (i) => {
  const s = Math.sin(i * 48.713 + 21.718) * 43927.2;
  return s - Math.floor(s);
};
function shape(g, d, fill, stroke, w = 0.8) {
  const p = new Path2D(d);
  if (fill) {
    g.fillStyle = fill;
    g.fill(p);
  }
  if (stroke) {
    g.lineWidth = w;
    g.strokeStyle = stroke;
    g.stroke(p);
  }
}
function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}
function stroke(g, x, y, xx, yy, ink, w = 0.6) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(xx, yy);
  g.lineWidth = w;
  g.strokeStyle = ink;
  g.stroke();
}
function box(g, x, y, w, h, fill) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}
function gradient(g, x, y, xx, yy, stops) {
  const a = g.createLinearGradient(x, y, xx, yy);
  for (const [at, color] of stops) a.addColorStop(at, color);
  return a;
}
function shadow(g, x, y, w, ink) {
  g.save();
  g.globalAlpha = 0.25;
  ellipse(g, x, y, w, 2.5, ink, -0.02);
  g.restore();
}
function horn(g, x, y, r, p, id) {
  const [ink, shade, , wood, light, , , deep] = p;
  // Off-axis inner throat and successive elliptical laminations make a real
  // flare. The near rim catches a different light from the rear of the bell.
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  g.scale(1, 1.04);
  ellipse(g, 0.4, 1, r + 1, r + 0.8, ink);
  ellipse(g, 0, 0, r, r, wood);
  const h = g.createRadialGradient(-r * 0.3, -r * 0.22, 0.4, 0, 1, r);
  for (const [s, c] of [
    [0, deep],
    [0.18, ink],
    [0.38, shade],
    [0.72, wood],
    [0.94, id === "thermal" ? p[8] : wood],
    [1, light],
  ])
    h.addColorStop(s, c);
  ellipse(g, 0, 0, r - 0.7, r - 0.7, h);
  ellipse(g, -r * 0.25, -r * 0.16, r * 0.17, r * 0.2, ink);
  g.save();
  g.globalAlpha = 0.24;
  for (let i = 0; i < 23; i++) {
    const t = (i / 23) * Math.PI * 2,
      xx = Math.cos(t),
      yy = Math.sin(t);
    g.beginPath();
    g.moveTo(-r * 0.25 + r * 0.24 * xx, -r * 0.14 + r * 0.24 * yy);
    g.quadraticCurveTo(r * 0.68 * xx - r * 0.1, r * 0.65 * yy, r * 0.925 * xx, r * 0.925 * yy);
    g.lineWidth = i % 3 === 0 ? 0.7 : 0.35;
    g.strokeStyle = i % 3 === 0 ? light : ink;
    g.stroke();
  }
  g.restore();
  g.restore();
}
function vinyl(g, x, y, r, p) {
  const [ink, shade, , wood, light, sea] = p;
  g.save();
  g.translate(x, y);
  g.rotate(-0.13);
  g.scale(1, 0.5);
  ellipse(g, 0, 0, r + 1, r + 1, shade);
  ellipse(g, 0, -0.8, r, r, ink);
  for (let i = 3; i < r; i += 2) {
    g.beginPath();
    g.arc(0, -0.8, i, 3.21, 5.2);
    g.lineWidth = 0.35;
    g.strokeStyle = shade;
    g.stroke();
  }
  ellipse(g, 0, -0.8, r * 0.3, r * 0.3, sea);
  ellipse(g, 0, -0.8, 0.8, 0.8, light);
  g.restore();
}
function recordRack(g, x, y, w, h, p, id) {
  const [ink, shade, wall, wood, light, sea, paper, deep, hot] = p;
  box(g, x, y, w, h, deep);
  let pos = x + 1.2;
  for (let i = 0; pos < x + w - 1; i++) {
    const sw = 0.58 + rand(i + 64) * 1.5,
      hh = h * (0.78 + rand(i) * 0.17);
    const c = [wood, paper, shade, sea, hot, wall][Math.floor(rand(i + 34) * 6)];
    shape(g, `M${pos} ${y + h - 1} l${i % 7 === 0 ? 2 : 0.1} ${-hh} l${sw} -.1 l${i % 7 === 0 ? -2 : -0.1} ${hh}Z`, c);
    if (i % 4 === 0) stroke(g, pos + 0.2, y + h - 3, pos + 0.4, y + h - 4.5, light, 0.45);
    pos += sw + 0.39;
  }
  box(g, x - 1, y + h - 0.5, w + 2, 1.4, wood);
  if (id === "pencil") stroke(g, x, y + h + 0.5, x + w, y + h + 0.7, ink, 0.45);
}
function branches(g, x, y, s, p, id) {
  const [ink, shade, , wood, , sea, paper] = p;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shape(g, "M-4 8 Q-2 -4 -3 -12 Q-5 -19 -15 -21 M-2 -6 Q3 -16 12 -20 M-2 -2 Q6 -8 15 -9 M-4 -12 Q-8 -24 -3 -30", null, wood, 1.4);
  for (const [a, b, t] of [
    [-14, -21, -0.5],
    [-10, -18, 0.2],
    [12, -21, -0.6],
    [5, -16, -0.8],
    [15, -9, -0.25],
    [-3, -31, -1.25],
    [-5, -22, -0.9],
  ]) {
    if (id === "cosmic") {
      ellipse(g, a, b, 5.8, 2.4, ink, t);
      ellipse(g, a, b - 0.7, 5.4, 2, sea, t);
    } else {
      for (let i = 0; i < 4; i++) {
        const dx = (i - 1.5) * 1.95;
        ellipse(g, a + dx, b + (i % 2) - 1, 2.6, 1.0, i % 2 ? sea : shade, t + dx * 0.16);
      }
      stroke(g, a - 1, b + 1, a + 2, b - 2, paper, 0.38);
    }
  }
  g.restore();
}
function room(g, id, exterior) {
  const p = colors[id],
    [ink, shade, wall, wood, light, sea, paper, deep, hot] = p;
  const thick = id === "cosmic" ? 1.25 : id === "field-guide" ? 0.6 : 0.83;
  box(g, 0, 0, 400, 88, shade);
  // Bright Pacific and the inhabited window ledge take the left third.
  const window = new Path2D("M0 5 Q51 -3 113 3 Q133 4 137 17 L137 55 L0 65Z");
  g.save();
  g.clip(window);
  g.drawImage(exterior, -12, -1, 163, 68);
  g.restore();
  shape(g, "M0 0 H149 L147 51 L135 59 L135 20 Q134 9 121 7 Q80 3 0 9Z", wood, ink, thick);
  shape(g, "M-5 64 L139 50 L150 55 L0 74Z", paper, ink, thick);
  shape(g, "M0 72 L148 54 L149 65 L0 85Z", shade, ink, 0.7);
  // Inside the vault the rear wall cools with distance from the hearth.
  const masonry = gradient(g, 145, 0, 391, 72, [
    [0, shade],
    [0.27, wall],
    [0.7, wood],
    [1, shade],
  ]);
  shape(g, "M140 0 H400 V65 L283 66 L151 60 L137 52 V18 Q137 9 129 5Z", masonry);
  shape(g, "M143 3 Q204 16 277 6 Q344 -2 400 7 V0 H142Z", deep, ink, 0.55);
  for (let i = 0; i < 10; i++) {
    const y = 4 + i * 4.6;
    g.save();
    g.globalAlpha = id === "field-guide" ? 0.42 : 0.23;
    shape(g, `M138 ${y} q19 5 38 3 t52 -1 t59 -3 t54 1 t60 -1`, null, i % 2 ? light : shade, i % 3 === 0 ? 1.3 : 0.6);
    g.restore();
  }
  shape(g, "M126 64 L220 53 L400 58 V88 H0 V80Z", wood, ink, 0.65);
  for (let i = 0; i < 17; i++) {
    const x = -60 + i * 34;
    stroke(g, 215 + (x - 215) * 0.08, 54, x, 88, shade, 0.52);
  }
  shape(g, "M79 83 L150 66 L259 64 L299 78 L201 88H78Z", shade, ink, 0.8);
  shape(g, "M93 82 L153 68 L255 66 L287 77 L198 86Z", sea);
  for (let i = 0; i < 25; i++) {
    const x = 100 + i * 4.8;
    stroke(g, x, 82 + (x - 100) * 0.028, x + 32, 74 + (x - 100) * 0.01, shade, 0.43);
  }
  // Splayed jamb and a second thin wall around an original record cabinet.
  shape(g, "M150 54 V16 Q149 6 164 6 H229 Q240 5 241 14 V56Z", deep, ink, thick);
  shape(g, "M154 52 V18 Q154 10 165 10 L230 9 Q236 10 237 17 V51Z", wall);
  shape(g, "M154 48 L233 46 L242 51 L162 56Z", wood, ink, 0.85);
  shape(g, "M156 52 L240 50 L240 66 L161 70 L154 66Z", wood, ink, 0.8);
  recordRack(g, 161, 54, 73, 12, p, id);
  horn(g, 172.4, 31.8, 13.1, p, id);
  horn(g, 221.0, 30.0, 14, p, id);
  ellipse(g, 196.2, 27, 8.3, 8.3, light);
  ellipse(g, 196.7, 27.5, 7.5, 7.5, wood);
  for (let i = 0; i < 5; i++) shape(g, `M190 ${23 + i * 1.7} q3 -1 8 .3 t4 .3`, null, light, 0.52);
  vinyl(g, 196, 47, 9, p);
  stroke(g, 206, 43, 202, 46, paper, 1.05);
  // A reading chair in the glow of a paper-shaded floor lamp.
  shape(g, "M250 63 Q244 58 249 51 Q251 47 255 49 L262 56 L278 57 L280 60 L271 67Z", deep, ink, thick);
  shape(g, "M241 63 Q244 56 253 55 Q256 53 259 48 Q262 43 269 44 Q278 45 283 53 L285 58 Q284 62 276 64 L254 69Z", sea, ink, thick);
  shape(g, "M247 61 Q262 60 273 56 L282 55 Q282 59 275 61 L253 67 L245 66Z", paper, ink, 0.65);
  for (const [a, b, xx, yy] of [
    [251, 67, 248, 74],
    [276, 62, 276, 68],
    [260, 65, 262, 70],
  ])
    stroke(g, a, b, xx, yy, ink, 1.8);
  stroke(g, 286, 33, 286, 62, wood, 1.1);
  ellipse(g, 286, 63, 3.5, 1, deep);
  shape(g, "M277 33 L280 22 Q286 20 291 22 L295 32 Q286 36 277 33Z", light, ink, 0.75);
  for (let y = 24; y < 33; y += 2.1) shape(g, `M279 ${y} q7 2 14 -.5`, null, wood, 0.45);
  // Cropped masonry fireplace forms a dark counterweight at the other end.
  shape(
    g,
    "M330 0 L386 0 L369 21 L371 39 Q374 46 386 51 Q392 55 387 58 L326 62 Q316 62 320 56 Q324 51 336 44 Q346 39 346 32 L345 18Z",
    deep,
    ink,
    thick
  );
  shape(g, "M324 57 Q355 61 385 54 Q384 61 372 65 Q348 70 327 64Z", ink, shade, 0.65);
  for (const [dx, sy] of [
    [-9, 1.0],
    [0, 1.35],
    [8, 0.78],
  ]) {
    g.save();
    g.translate(353 + dx, 63);
    g.scale(1, sy);
    shape(g, "M-5 0 Q-8 -4 -3 -8 Q1 -10 -1 -15 Q6 -10 3 -7 Q2 -5 5 -5 Q7 0 2 1Z", hot);
    shape(g, "M-2 0 Q-1 -3 1 -6 Q4 -2 2 0Z", light);
    g.restore();
  }
  if (id === "pencil") {
    for (let i = 0; i < 7; i++) shape(g, `M${65 + i * 16} 5 l-34 55 5 -1 35 -55Z`, "rgba(37,35,38,.24)");
  }
  if (id === "thermal") {
    for (let i = 0; i < 6; i++) {
      const t = 1 - i * 0.13;
      ellipse(g, 263, 60, 6 * t, 2.1 * t, [wall, "#ab4385", hot, "#ff955c", light, "#fff2ac"][i]);
    }
    shape(g, "M323 56 Q343 60 366 53 T389 46 M326 61 Q345 65 369 60", null, "#ff94ae", 0.7);
  }
  // Duh is an orange with a single leaf, sitting beside a spine-out sketchbook.
  shadow(g, 113, 65, 10, ink);
  ellipse(g, 113, 59, 6.2, 6.0, ink);
  ellipse(g, 113.0, 58.4, 5.7, 5.65, hot);
  shape(g, "M112 53 Q111 49 115 49 Q118 50 114 53Z", sea, ink, 0.52);
  ellipse(g, 111, 58, 0.55, 0.75, ink);
  ellipse(g, 114.2, 57.5, 0.55, 0.75, ink);
  shape(g, "M111.8 60 Q113 61.2 114.5 59.7", null, ink, 0.46);
  shape(g, "M83 66 L100 63 L106 65 L89 69Z", light, ink, 0.65);
  // Off-centre foreground shapes bring the viewer inside the opening.
  shape(g, "M36 66 Q39 53 36 48 Q30 39 23 40 M37 53 Q42 42 54 39", null, deep, 1.7);
  for (const [x, y, r] of [
    [23, 39, 7],
    [31, 41, 5],
    [51, 38, 8],
    [45, 42, 4],
  ]) {
    ellipse(g, x, y, r, 2.1, ink, -0.08);
    ellipse(g, x - 0.5, y - 0.8, r - 0.6, 1.6, sea, -0.08);
  }
  shape(g, "M28 63 Q36 61 44 62 L42 70 Q37 73 31 70Z", wood, ink, 0.95);
  shape(g, "M9 66 L19 65 L22 69 L9 71Z", hot, ink, 0.6);
  branches(g, 301, 62, 0.56, p, id);
  shape(g, "M296 59 Q300 57 305 58 L304 65 Q301 67 297 65Z", paper, ink, 0.7);
  shadeMarks(g, p, id);
}
function consolePlate(g, id) {
  const p = colors[id],
    [ink, shade, wall, wood, light, sea, paper, deep, hot] = p;
  box(
    g,
    0,
    0,
    400,
    88,
    gradient(g, 0, 0, 400, 78, [
      [0, deep],
      [0.55, wall],
      [1, wood],
    ])
  );
  for (let i = 0; i < 5; i++) stroke(g, 0, 11 + i * 4, 400, 3 + i * 3.5, shade, 0.7);
  // A listening session, seen close: sleeves, the deck, two warmly lit
  // needle meters, and one horn. The quiet space around them is intentional.
  shape(g, "M0 24 L140 15 L146 67 L0 80Z", deep, ink, 1.5);
  recordRack(g, 5, 24, 113, 45, p, id);
  shape(g, "M19 59 L34 20 L63 25 L49 65Z", light, ink, 1.2);
  shape(g, "M24 54 L33 35 L55 31 L51 42 L40 44Z", sea);
  ellipse(g, 43, 34, 4.3, 4.2, hot);
  shape(g, "M111 55 L183 28 L238 37 L237 58 L157 77 L111 68Z", wood, ink, 1.6);
  shape(g, "M112 54 L182 28 L238 37 L159 61Z", paper, ink, 1);
  g.save();
  g.translate(175, 44);
  g.transform(1, 0.018, -0.27, 0.8, 0, 0);
  vinyl(g, 0, 0, 36, p);
  g.restore();
  ellipse(g, 216, 37, 3.1, 1.7, wood);
  shape(g, "M216 37 L205 45 Q198 48 191 48 L185 50", null, ink, 1.8);
  shape(g, "M216 37 L205 44 Q199 47 191 47", null, paper, 0.6);
  box(g, 180, 48.3, 6.8, 2.2, hot);
  shape(g, "M241 36 L297 30 L316 35 L314 63 L243 70Z", deep, ink, 1.3);
  for (const [i, x] of [246, 270].entries()) {
    shape(g, `M${x} 42 l19 -2 v10 l-19 3Z`, light, ink, 0.75);
    for (let k = 0; k < 6; k++) stroke(g, x + 2 + k * 2.8, 45 - k * 0.15, x + 2.5 + k * 2.8, 43.2 - k * 0.15, ink, 0.55);
    stroke(g, x + 8, 50, x + 10 + 3 * i, 43, hot, 1.1);
  }
  for (let i = 0; i < 4; i++) ellipse(g, 251 + i * 13, 59 - i * 0.9, 2.65, 2.9, wood, -0.05);
  shape(g, "M321 14 L373 9 L387 16 L388 68 L323 72Z", wood, ink, 1.5);
  horn(g, 354, 38, 21.3, p, id);
  for (let i = 0; i < 6; i++) stroke(g, 327 + i * 8, 62, 331 + i * 8, 62, deep, 1.1);
  branches(g, 112, 31, 0.65, p, id);
  shape(g, "M106 29 L116 27 L116 33 L109 36Z", hot, ink, 0.9);
  shadeMarks(g, p, id);
}
function shadeMarks(g, p, id) {
  const [ink, shade, , wood, light] = p;
  g.save();
  if (id === "pencil") {
    for (let i = 0; i < 560; i++) {
      const x = rand(i + 101) * 400,
        y = rand(i + 901) * 88;
      if (y > 55 || (x > 140 && y > 9 && y < 48)) {
        g.globalAlpha = 0.12 + rand(i + 71) * 0.2;
        stroke(g, x, y, x + 1 + rand(i + 33) * 3.8, y - 1 - rand(i + 6) * 3, ink, 0.44);
      }
    }
  } else if (id === "paint") {
    for (let i = 0; i < 580; i++) {
      const x = rand(i + 12) * 400,
        y = rand(i + 13) * 88;
      g.globalAlpha = 0.12 + rand(i) * 0.16;
      stroke(g, x, y, x + 2 + rand(i + 52) * 4, y + (x < 140 ? -0.6 : 1.5) * (rand(i) - 0.2), i % 3 ? light : shade, 0.48 + rand(i + 5) * 0.82);
    }
  } else if (id === "thermal") {
    g.globalAlpha = 0.34;
    for (let x = 0; x < 400; x += 3.4)
      for (let y = 1 + (Math.round(x / 3.4) % 2) * 1.7; y < 88; y += 3.4) {
        const r = 0.19 + 0.5 * (0.55 + 0.45 * Math.sin(x * 0.034 + y * 0.12));
        ellipse(g, x, y, r, r, ink);
      }
  } else if (id === "field-guide") {
    g.globalAlpha = 0.35;
    for (let i = 0; i < 945; i++) {
      const x = rand(i + 60) * 400,
        y = rand(i + 181) * 88;
      if (y > 62 || y < 11 || (x > 145 && y > 22)) ellipse(g, x, y, 0.22 + rand(i) * 0.4, 0.28, ink);
    }
  } else {
    shape(g, "M138 52 L151 60 L128 64 L132 59Z M294 32 L299 39 L295 41 L290 34Z M382 60 L397 63 L399 69 L373 65Z", "rgba(42,37,73,.26)");
  }
  g.restore();
}
export function illustrateListeningRoom(ctx, id, exterior, volume) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  volume ? consolePlate(ctx, id) : room(ctx, id, exterior);
  ctx.restore();
}
