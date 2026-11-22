// Six original views of the same bluff. All marks are vector paths at the
// final CSS size, including those seen through the moving optical lens.
const plates = {
  realistic: ["#91a9bd", "#f6debc", "#f4cda2", "#79949e", "#386573", "#b68a69", "#dbb697", "#644e53", "#383e44", "#dba46e", "#eee6d6"],
  cosmic: ["#7478a8", "#f4be99", "#ffdb92", "#9691a6", "#487587", "#bd745e", "#edb082", "#684e70", "#35334b", "#ff9960", "#fff0c7"],
  "field-guide": ["#b5c4b7", "#efe1b6", "#ede0ab", "#8d9d94", "#5a7e7c", "#ac936d", "#d4bf94", "#716652", "#404c43", "#c58a5b", "#f3e7c6"],
  pencil: ["#a6a5a4", "#e6e3dd", "#f7f3e8", "#aaa8a3", "#888785", "#a5a098", "#c7c3ba", "#787773", "#38383a", "#b6b2aa", "#f7f5ed"],
  paint: ["#8a91aa", "#facdab", "#ffda91", "#ae9bab", "#687c93", "#be7b62", "#e0a37a", "#866477", "#463f55", "#f19155", "#fae0b5"],
  thermal: ["#25264b", "#55547d", "#a7a7bd", "#595880", "#393d70", "#6d5288", "#916297", "#493765", "#292443", "#ff7b65", "#ffc77a"],
};

const path = (d, fill, attrs = "") => '<path d="' + d + '" fill="' + fill + '" ' + attrs + "/>";
const ink = (d, color, width, opacity = 1) =>
  path(
    d,
    "none",
    'stroke="' + color + '" stroke-width="' + width + '" stroke-opacity="' + opacity + '" stroke-linecap="round" stroke-linejoin="round"'
  );
const circle = (cx, cy, r, fill, attrs = "") => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" ' + attrs + "/>";
const num = (n) => Number(n.toFixed(2));
function random(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function grad(id, stops, vertical = true) {
  return (
    '<linearGradient id="' +
    id +
    '" x2="' +
    (vertical ? "0" : "1") +
    '" y2="' +
    (vertical ? "1" : "0") +
    '">' +
    stops.map(([s, c]) => '<stop offset="' + s + '" stop-color="' + c + '"/>').join("") +
    "</linearGradient>"
  );
}
const url = (id) => "url(#" + id + ")";
const cliff =
  "M229 128 Q252 123 266 111 L276 104 Q274 99 282 96 C301 93 313 86 324 83 Q343 79 351 70 Q359 62 375 61 Q398 60 410 52 Q423 43 442 45 Q461 48 480 38 Q496 40 514 34 Q542 22 568 23 Q592 15 616 18 V161 H219 Q233 152 229 148 Q217 143 229 138 L238 132Z";
const bay = "M350 101 Q354 83 375 75 Q393 68 421 69 L490 65 L490 103 L349 116Z";

function pine(x, y, scale, colors, medium) {
  const [, , , , , bark, , shade, dark, , paper] = colors;
  const rng = random(917);
  let canopies = "";
  for (const [cx, cy, rx, ry] of [
    [-23, -31, 21, 7],
    [-11, -39, 22, 7],
    [10, -45, 22, 6],
    [26, -46, 17, 5],
    [-36, -24, 14, 5],
  ]) {
    let d = "M" + (cx - rx) + " " + cy;
    for (let i = 0; i < 21; i++) {
      const a = Math.PI + (i * Math.PI) / 20;
      d += "L" + num(cx + rx * Math.cos(a)) + " " + num(cy + ry * Math.sin(a) - rng() * 2.7);
    }
    d += "Q" + (cx + rx * 0.35) + " " + (cy + ry * 0.34) + " " + cx + " " + (cy + ry * 0.45) + "T" + (cx - rx) + " " + cy + "Z";
    canopies += path(d, dark);
    if (medium !== "cosmic") {
      let needles = "";
      for (let i = 0; i < 32; i++) {
        const xx = cx + (rng() - 0.5) * rx * 1.6,
          yy = cy - ry * 0.3 - rng() * ry * 0.4;
        needles += "M" + num(xx) + " " + num(yy) + "l2.4 -1.1";
      }
      canopies += ink(needles, medium === "pencil" ? paper : bark, 0.45, 0.66);
    }
  }
  return (
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    scale +
    ')">' +
    path(
      "M-4 1 Q1 -8 -1 -15 C-4 -24 -13 -26 -25 -29 Q-10 -27 -3 -21 Q-5 -32 -17 -38 Q-5 -34 1 -25 Q4 -36 16 -45 L25 -47 Q12 -40 7 -31 Q13 -34 23 -34 C13 -30 4 -23 3 -17 Q6 -9 3 -1Z",
      dark
    ) +
    ink("M-.5 -.8 Q2 -11 .4 -17 T-8 -30 M1 -22 Q6 -33 17 -42", shade, 0.85) +
    canopies +
    "</g>"
  );
}

function pavilion(c, medium, prefix) {
  const [sky, , sun, air, water, rock, light, shade, dark, lamp, paper] = c;
  const gl = url(prefix + "glass"),
    cut = url(prefix + "bay");
  let s = path(bay, dark);
  s += '<g clip-path="' + cut + '">' + path("M352 107 Q359 84 379 78 Q399 71 426 72 L491 68 V104 L349 116Z", gl);
  s += path("M346 108 430 96 497 91V106L346 124Z", shade);
  s += path("M353 105 393 96 430 93 475 86 492 86 491 90 353 112Z", lamp, 'opacity=".69"');
  for (const x of [367, 383, 405, 425, 447, 470, 486]) {
    const y = 103 - (x - 350) * 0.123;
    s += ink("M" + x + " " + num(y - 37) + "v41", dark, 1.65) + ink("M" + (x + 0.95) + " " + num(y - 37) + "v40", light, 0.55, 0.9);
  }
  s += path("M386 99 v-4 q0-3 3-3 h6 q2 0 2 3v2h8v-3q0-2 3-2h4v6l-26 4z", paper);
  s += ink("M415 89v8m-3-9q3-5 6-1z", sun, 1.2);
  s += path("M454 84h18v1.3h-18zm-1 4h21v1.1h-21z", lamp);
  s += ink("M362 92 375 76m13 15 15-20m-7 21 13-18", paper, 1.2, 0.24);
  s += "</g>";
  s += ink("M348 112Q353 83 375 75Q395 67 426 68L490 64", medium === "pencil" ? dark : light, 1.4, 0.95);
  s += path("M330 116 486 94 507 94 354 120Z", light) + path("M330 116 354 120 507 94 506 97 353 125 330 120Z", shade);
  s += ink("M338 116 338 109 386 102 433 96 482 89m-115 23v-6m35 1v-6m33 2v-7m32 1v-6", dark, 0.8, 0.85);
  return s;
}

function shore(c, medium, prefix) {
  const [sky, haze, sun, air, water, rock, light, shade, dark, lamp, paper] = c;
  const r = random(7463),
    strata = [],
    marks = [[], [], []],
    surf = [[], []];
  // Folded cross-bedding is cut by the outline; ridges stay longer and
  // flatter at the foot, with small dark weathered pockets between seams.
  for (let i = 0; i < 20; i++) {
    let d = "",
      lo = "";
    for (let x = 215; x <= 625; x += 6) {
      const y =
        70 +
        i * 3.55 -
        0.108 * (x - 280) +
        3.2 * Math.sin(x * 0.026 + i * 0.16) +
        1.3 * Math.sin(x * 0.077 + i * 0.3) +
        0.62 * Math.sin(x * 0.193 + i * 0.57);
      d += (x === 215 ? "M" : "L") + x + " " + num(y);
      lo = "L" + x + " " + num(y + 0.68 + 1.4 * Math.sin(x * 0.031 + i * 0.28) ** 2) + lo;
    }
    strata.push(path(d + lo + "Z", i % 3 === 0 ? shade : light, 'opacity="' + (medium === "pencil" ? 0.52 : 0.29 + (i % 4) * 0.063) + '"'));
  }
  for (let i = 0; i < 490; i++) {
    const x = 230 + r() * 388,
      y = 28 + r() * 130,
      len = 1 + r() * (medium === "paint" ? 10 : 4);
    marks[i % 3].push("M" + num(x) + " " + num(y) + "l" + num(len) + " " + num(-len * (0.06 + 0.19 * r())));
  }
  for (let i = 0; i < 256; i++) {
    const y = 78 + r() * 77,
      x = r() * 460,
      w = (1 + r() * 7) * (0.25 + (y - 76) / 62);
    surf[i % 2].push("M" + num(x) + " " + num(y) + "q" + num(w * 0.4) + " " + num(-Math.min(1, w * 0.13)) + " " + num(w) + " 0");
  }
  const u = (id) => url(prefix + id);
  let d =
    "<defs>" +
    grad(prefix + "sky", [
      [0, sky],
      [0.67, haze],
      [1, sun],
    ]) +
    grad(prefix + "water", [
      [0, air],
      [0.26, water],
      [0.69, air],
      [1, water],
    ]) +
    grad(prefix + "stone", [
      [0, light],
      [0.45, rock],
      [0.77, shade],
      [1, rock],
    ]) +
    grad(prefix + "glass", [
      [0, sky],
      [0.41, air],
      [0.57, haze],
      [1, shade],
    ]) +
    '<clipPath id="' +
    prefix +
    'land">' +
    path(cliff, "white") +
    '</clipPath><clipPath id="' +
    prefix +
    'bay">' +
    path(bay, "white") +
    "</clipPath></defs>";
  d += path("M0 0h612v156H0z", u("sky"));
  d += circle(113, 52, 17, sun, 'opacity=".9"');
  d += path("M0 72 Q19 69 38 72T78 74 Q112 72 131 76L198 74Q230 68 258 70Q277 66 301 68L333 76v14H0Z", air, 'opacity=".57"');
  d += path("M0 78 Q88 77 155 78T310 78h302v78H0Z", u("water"));
  d += ink("M0 78.7Q91 78 153 78.7T297 78", paper, 0.75, 0.67);
  for (let i = 0; i < 16; i++) {
    const y = 82 + i * 3.8,
      spread = 4 + i * 0.9,
      x = 112 + (r() - 0.5) * spread * 1.75;
    d += ink(
      "M" + num(x - spread * 0.5) + " " + num(y) + "q" + num(spread * 0.6) + " -1 " + num(spread) + " -.2",
      sun,
      0.65 + i * 0.045,
      0.43 - i * 0.016
    );
  }
  d += ink(surf[0].join(""), paper, 0.75, 0.46) + ink(surf[1].join(""), dark, 0.46, 0.27);
  d += path(
    "M111 146 Q154 143 175 136 Q185 135 191 128 Q205 128 218 120 Q237 119 255 112 Q260 108 275 109 L307 119 264 151 155 160Z",
    shade,
    'opacity=".48"'
  );
  d += ink("M67 155Q122 142 149 145T204 133Q218 126 234 125M184 143Q206 136 214 131L243 128", paper, 1.5, 0.85);
  d += path(cliff, u("stone"));
  d +=
    '<g clip-path="' +
    u("land") +
    '">' +
    strata.join("") +
    ink(marks[0].join(""), paper, 0.52, 0.47) +
    ink(marks[1].join(""), shade, 0.75, 0.46) +
    ink(marks[2].join(""), dark, 0.47, 0.4) +
    "</g>";
  d += path(
    "M271 103q31-9 53-20 21-5 31-16 16-9 41-11 23-5 42-14 18-2 40-8 23-2 44-9l51-10 39-4v8q-24 1-46 8-24 0-47 9l-37 6-35 9q-23-1-37 9l-37 10-19 9-25 9-35 13z",
    light
  );
  d += ink("M277 102q47-13 79-37 15-8 38-9 20-3 42-13 16 2 42-8m8 .5q20-1 37-8l42-9", dark, 0.65, 0.65);
  d += pavilion(c, medium, prefix);
  d += pine(431, 46, 0.88, c, medium) + pine(501, 34, 0.48, c, medium);
  d += ink("M154 43q4-2 6 3 2-4 6-4m16 6q3-2 5 1 1-3 4-3", dark, 1.05, 0.78);
  if (medium === "realistic") d += paleMist(paper);
  if (medium === "pencil" || medium === "field-guide") {
    const h = [[], []];
    for (let i = 0; i < 570; i++) {
      const x = 232 + r() * 378,
        y = 30 + r() * 127,
        l = 2 + r() * 8;
      h[i % 2].push("M" + num(x) + " " + num(y) + "l" + num(l) + " " + num(-l * (medium === "pencil" ? 0.76 : 0.37)));
    }
    d += '<g clip-path="' + u("land") + '">' + ink(h[0].join(""), dark, 0.64, 0.55) + ink(h[1].join(""), paper, 0.55, 0.67) + "</g>";
    if (medium === "field-guide") d += ink("M55 43q4 2 9 1M58 49q3 1 5 0M58 38q3-2 7 1", shade, 0.8, 0.7);
  } else if (medium === "thermal") {
    let dots = "";
    for (let y = 5; y < 155; y += 5) for (let x = 221 + (y % 2) * 2.6; x < 612; x += 6) dots += "M" + num(x) + " " + y + "h.32";
    d += '<g clip-path="' + u("land") + '">' + ink(dots, dark, 1.25, 0.44) + "</g>";
    d += ink("M352 102q10-25 30-29 22-5 40-4l65-5", lamp, 2) + ink("M354 104q7-22 28-29 22-6 40-4l65-5", paper, 0.76);
  } else if (medium === "paint") {
    const skyMarks = [],
      seaMarks = [];
    for (let i = 0; i < 165; i++) {
      const x = r() * 380,
        y = r() * 67;
      skyMarks.push("M" + num(x) + " " + num(y) + "l" + num(2 + r() * 10) + " -1");
      seaMarks.push("M" + num(x) + " " + num(81 + r() * 74) + "l" + num(1 + r() * 8) + " -.5");
    }
    d += ink(skyMarks.join(""), paper, 1.55, 0.22) + ink(seaMarks.join(""), sun, 1.25, 0.25);
  } else if (medium === "cosmic") {
    d += '<g transform="rotate(-16 103 41)">' + ink("M79 41q11 6 30 4t24-9q-1-3-10-3", dark, 1.65) + ink("M82 42q14 5 29 2t19-6", sun, 1.6) + "</g>";
    d += ink(cliff, dark, 1.35, 0.9);
  }
  return d + foreground(medium, c, prefix);
}
// The steady horizon keeps a drag legible. The observer, marks and source of
// light change from plate to plate. Each silhouette has a job at phone size.
function foreground(medium, c, prefix) {
  const [, , sun, air, sea, rock, light, shade, inkColor, lamp, paper] = c;
  const r = random(4329);
  let image = "";
  if (medium === "realistic") {
    // A lateen sail belongs at the first lens position. The short wake and
    // the reflected canvas give it a scale against the distant headland.
    image += '<g transform="translate(30 -2)">' + path("M45 92q12 2 25-1l-5 4-15 1z", shade);
    image += path("M58 66 57 91 45 92Q51 83 58 66Z", paper);
    image += path("m60 73 7 17-8 1z", light) + ink("M59 65v29", inkColor, 0.76);
    image += ink("M34 97q10-2 18 0t25-2m-31 5 11-.9m1 3 6-.6", paper, 1, 0.66) + "</g>";
    for (let i = 0; i < 6; i++) {
      const x = 143 + i * 11,
        y = 132 - i * 1.35,
        h = 3 + (i % 3) * 2.2;
      image += path("M" + x + " " + y + "q3-" + num(h) + " 7-" + num(h) + "l7 " + num(h - 1) + "-3 1z", shade);
      image += ink("M" + (x - 2) + " " + (y + 1) + "q7 1 19-1", paper, 0.9, 0.86);
    }
  }
  if (medium === "cosmic") {
    // A glowing aperture stands upright in the swell; the far ellipse and
    // small falling stones establish depth with a few uncluttered ink planes.
    const turn = 'transform="rotate(15 157 85)"';
    image +=
      "<g " +
      turn +
      '><ellipse cx="157" cy="85" rx="25" ry="35" fill="' +
      inkColor +
      '"/><ellipse cx="156" cy="84" rx="22" ry="31" fill="#92d4bb"/><ellipse cx="154" cy="84" rx="15" ry="25" fill="#526c84"/>';
    image += ink("M146 108q-13-20 1-42 5-7 13-7m-6 7q-13 16-9 32", paper, 2.2) + ink("M164 56q15 11 7 31-6 16-14 22", inkColor, 1.3) + "</g>";
    image += ink("M120 120q20-6 43-4m-29 8q18-3 33-1m13-12 10-2", sun, 2.2, 0.86);
    for (const [x, y, s] of [
      [190, 65, 1],
      [201, 54, 0.7],
      [127, 105, 0.64],
    ])
      image +=
        '<g transform="translate(' +
        x +
        " " +
        y +
        ") scale(" +
        s +
        ')">' +
        path("m-6 2 4-6 7 1 2 5-4 4-7-1z", light, 'stroke="' + inkColor + '" stroke-width="1.6"') +
        ink("m-1-3 2 4 4-1", rock, 1.1) +
        "</g>";
  }
  if (medium === "field-guide") {
    // Shorebird in profile. The backward knee, S-neck, folded flight feathers
    // and spear bill read first; the finer quill marks survive magnification.
    image += '<g transform="translate(75 0)">' + path("M120 143q17-13 38-11l34-8q19-2 35 5l6 12-11 8-47 5-51-4z", shade);
    image += ink("M128 142q22 2 48-9l23-3m-48 17 33-6", light, 1.8, 0.85);
    image += '<g transform="translate(167 82)">' + ink("M-1 23 1 39l-1 10-8 4m9-6 7 2M6 22l6 12-4 11 5 2", inkColor, 1.7);
    image += path(
      "M-24 24q9-4 16-14 7-7 16-4l3-2q-11-12-2-23 5-6 13-4l5 3 17 3-17 1-6 3q-9 0-8 7l8 14q5 13-5 20-12 4-22-2l-21 1z",
      paper,
      'stroke="' + inkColor + '" stroke-width="1.6"'
    );
    image += path("M-24 25Q-5 0 8 9q9 9 1 14l-12-1z", air) + ink("m-14 19 17-8m-14 11 16-8m-11 9 13-5M10-19q8-4 11-1l8 2", inkColor, 0.85);
    image += circle(20, -17.5, 1.4, inkColor) + path("m25-2 18 1-17 2z", lamp, 'transform="translate(0 -15)"') + "</g>";
    image += ink("M209 49q20-7 29-19h14m-7 3 7 0", shade, 0.65, 0.75) + "</g>";
  }
  if (medium === "pencil") {
    const mask = prefix + "blinds";
    image += '<defs><clipPath id="' + mask + '">' + path("M0 0h612v156H0z", "white") + '</clipPath></defs><g clip-path="' + url(mask) + '">';
    // Broad oblique venetian-blind shadows take the foreground into a dark
    // room. The distant bluff is the light shape carved out of the graphite.
    image += path("M0 0h69L0 61zm0 86L109 0h17L0 105zm0 53L170 0h12L0 153z", inkColor, 'opacity=".55"');
    image += ink("M0 152 185 0M0 102 128 0", inkColor, 1.35, 0.72);
    const grain = [];
    for (let i = 0; i < 135; i++) {
      const x = r() * 114,
        y = 70 + r() * 88;
      grain.push("M" + num(x) + " " + num(y) + "l" + num(6 + r() * 14) + " " + num(-5 - r() * 8));
    }
    image += ink(grain.join(""), inkColor, 0.49, 0.61);
    image += path("M452 104q24-11 38-11 15-7 31-9 22-13 44-15l47-5v92H344q54-20 108-52z", inkColor, 'opacity=".55"');
    image += ink("M365 106q3-16 16-25t44-11l64-5", paper, 1.55, 0.73) + "</g>";
  }
  if (medium === "paint") {
    // Opaque sweeps break through transparent marine wash. Knife marks cross
    // the current at different speeds on the far and near water.
    const strokes = [[], [], []];
    for (let i = 0; i < 245; i++) {
      const y = 81 + r() * 68,
        x = 100 + (r() - 0.5) * (13 + (y - 79) * 1.75),
        w = 2 + r() * (1 + (y - 78) * 0.28);
      strokes[i % 3].push("M" + num(x) + " " + num(y) + "q" + num(w * 0.52) + " -1.2 " + num(w) + " -.7");
    }
    image += ink(strokes[0].join(""), "#f1ad72", 1.9, 0.77) + ink(strokes[1].join(""), sun, 1.28, 0.75) + ink(strokes[2].join(""), paper, 0.84, 0.8);
    image += path("M7 50q28-7 72-4l46-1-41 4q-51-2-77 1zm137 15 65-5 20 2-63 6z", paper, 'opacity=".41"');
    image += ink("M239 128q38-16 60-21m-40 7 31-10m19-15 38-10m48-22 26-5m45-15 57-11", sun, 2.5, 0.75);
  }
  if (medium === "thermal") {
    // A seated reader in the glazed room and the warm hollow left on the
    // stone are the two emitters against a cool sea. Isotherms follow them.
    image +=
      '<g transform="translate(397 83) rotate(-5)">' +
      path("M-21 16h54v4h-54z", "#c05590") +
      path("M-19 19v11m47-12v10", "none", 'stroke="#7b8bba" stroke-width="2"');
    image += path("M-6 13q1-7 4-12 5-4 9-1l4 8 11 3 3 6-3 11-4-1 1-12-15 1z", "#f47670");
    image +=
      circle(3, -6, 5.2, "#ffac70") +
      circle(3, -7, 2.7, "#ffe5a4") +
      ink("M1 0q3 6 4 10l8 1", paper, 2.6) +
      ink("M12 19q8 2 13-1m-2 5 6-2", "#ff9374", 1.6) +
      "</g>";
    image += ink("M241 126q26-8 39-17t46-13m-78 36q23-7 43-19t30-11", "#9b81b0", 1.15, 0.88);
    image += ink("M46 103q8-15 23-17 12-1 20 9m-49 12q13-22 29-23 14-2 24 9", "#72abb8", 0.92, 0.66);
    // Five warm fingertip traces in the rightmost glass reveal contact with
    // the stone. Their separate cooling contours stay legible at thumb size.
    image +=
      '<g transform="translate(541 78) rotate(-19)"><path d="M-21 11q-7-6-3-12 3-3 8 2l3 2-3-17q0-5 3-4l5 15-1-21q1-5 4-4l3 23 3-19q1-4 4-3l-1 24 5-13q3-3 5 0l-5 23q-2 9-12 12-11 0-18-8z" fill="#b45f8d" stroke="#e98284" stroke-width="1.4"/>';
    image += path("M-11 8q-5-6-8-3-1 3 5 8 7 8 15 5 6-2 8-9 0-3-4-4-9-4-16 3Z", "#f18779");
    for (const [x, y] of [
      [-13, -14],
      [-5, -22],
      [5, -18],
      [13, -8],
    ])
      image += circle(x, y, 2.2, "#ffc087");
    image += ink("M-27 13q9 16 22 16 17-1 23-16m-46 6q14 18 31 14", "#db8dab", 1, 0.9) + "</g>";
  }
  return image;
}
function paleMist(paper) {
  return ink("M4 70 Q91 68 149 71 T245 70 M17 75Q57 74 94 75", paper, 1.65, 0.3);
}

// 108 equal-time RMS windows of each shipped original, normalized per track
// and encoded on a 64-level scale. Opening a preference sends no MP3 request.
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const waveforms = {
  realistic: "IRMJHFIMDOUYcdcdaJRVeRXKPZLXckkccUMAcXiopjdJRdglnlniTQbaglmmgGgfnsuw_hGdbigLUhhHeceWenjWIXYdggfeYNWfZYceYP60",
  cosmic: "2JPIFD60EcLJE6dRE5fH9VbKKI7rjYMH30ePAHI8FgJC530000000CkeSKB3aB6MKDF_daOC2Q96FLChdPMID1ZpYPQC9RB8440OI62JA410",
  "field-guide": "OME8PMLF85NISUeidTUgkdYZWSORUEdiOamXYQOLOIRGBQOdfnwmanfZibKRep_ngpgYgUIYgdojYYjkodEcsZbtpaUVXRJYjlakdPipebX2",
  pencil: "OSUXYiNajYXPZRfbdegGWfWcZgWlaiVdRdjXfmVbjbiUicghfjlPfvpxplTptrnoid_rtitftyvpwkhzpzr-bs-rlpgmxeshrXqruyshgM00",
  paint: "3SRUbhhcEFXedfikLBJilihjhJISfemnNNgOXmqojWRC9YjjqtysPMnkp_twR19conquygBeutpJLqnJfgnomdD2KiijhgOKADWZihecLG50",
  thermal: "GjbVOLHD5ZbOK7biZLLMOLKYhU8XxhZNUQDDgeQLPolYPNXPMGNJCNupcUOMXqdbYL9c_eOSXWNKocQCbjaRLKRNKiUHAPiaTPLKG94LGB40",
};
export function controlArt(medium, volume, prefix) {
  const c = plates[medium];
  if (!volume) return shore(c, medium, prefix);
  const [, , sun, , water, , light, , dark, lamp] = c,
    samples = waveforms[medium];
  let bars = "";
  for (let i = 0; i < samples.length; i++) {
    const x = ((i + 0.5) * 612) / samples.length,
      half = 1 + alphabet.indexOf(samples[i]) * 0.41;
    bars += "M" + num(x) + " " + num(33 - half) + "v" + num(2 * half);
  }
  return (
    "<defs>" +
    grad(
      prefix + "vinyl",
      [
        [0, dark],
        [0.59, water],
        [1, dark],
      ],
      false
    ) +
    grad(
      prefix + "signal",
      [
        [0, light],
        [0.48, sun],
        [1, lamp],
      ],
      false
    ) +
    "</defs>" +
    path("M0 0h612v66H0z", url(prefix + "vinyl")) +
    ink("M0 33H612", sun, 0.6, 0.22) +
    ink(bars, url(prefix + "signal"), 2.45, 0.93)
  );
}
