(function () {
  const stacks = Array.from(document.querySelectorAll(".home-artifact-stack.has-coffee-stain"));
  if (!stacks.length) return;

  const hashSeed = (input) => {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const makeRandom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  };

  const randomSeed = () => {
    const querySeed = new URLSearchParams(window.location.search).get("coffeeSeed");
    if (querySeed) return querySeed;
    const bytes = new Uint32Array(1);
    window.crypto?.getRandomValues?.(bytes);
    return String(bytes[0] || Math.floor(Math.random() * 0xffffffff));
  };

  const number = (value) => Number(value.toFixed(2));
  const between = (random, min, max) => min + random() * (max - min);
  const TAU = Math.PI * 2;
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // The ring a coffee mug leaves, drawn the way a brush draws an ensō (Sirui's lab mate found the
  // realistic stain ugly; October 2026): one confident stroke around the mug's footprint, pressed in
  // where the brush lands, splitting into dry-brush streaks as the ink runs out, and left open where
  // it lifts. Coffee still dries the way coffee dries (Deegan et al., Nature 1997): ink gathers at
  // the edge of each mark, so every stroke and drop has a darker rim. A few drops fly off where the
  // brush lifts, and sometimes one of them lands as a small heart. New on every visit; ?coffeeSeed=
  // reproduces one.

  // A periodic function of angle with a soft spectrum, roughly in [-1, 1].
  const periodic = (random, kMin, terms, slope) => {
    const ks = [],
      amps = [],
      phases = [];
    let norm = 0;
    for (let k = kMin; k < kMin + terms; k += 1) {
      const amp = Math.pow(k, -slope) * (0.5 + random());
      ks.push(k);
      amps.push(amp);
      phases.push(random() * TAU);
      norm += amp;
    }
    return (t) => {
      let sum = 0;
      for (let j = 0; j < ks.length; j += 1) sum += amps[j] * Math.cos(ks[j] * t + phases[j]);
      return sum / norm;
    };
  };

  // Lay out one stroke for a size x size canvas (all lengths scale with the canvas).
  const design = (seedLabel, size) => {
    const random = makeRandom(hashSeed(String(seedLabel)));
    const rand = (min, max) => between(random, min, max);
    const u = size / 400;
    const wobble = periodic(random, 2, 4, 1.2);
    const tremor = periodic(random, 7, 6, 0.8);
    // The stroke stays open where the brush lifts; the opening (and the heart, when there is one)
    // faces up and to the right, the open desk beside the slips.
    const gap = TAU - rand(5.3, 5.8);
    const gapCentre = rand(-1.75, -0.35);
    const stroke = {
      cx: size * rand(0.485, 0.515),
      cy: size * rand(0.485, 0.515),
      radius: size * rand(0.3, 0.325),
      squash: rand(0.95, 1.0),
      start: gapCentre + gap / 2,
      sweep: TAU - gap,
      width: u * rand(19, 25),
      wobble,
      tremor,
    };
    // Bristles across the brush: their own weight, ink and the moment each runs dry.
    const bristles = Array.from({ length: 30 }, (_, i) => ({
      across: (i + 0.5) / 30 - 0.5 + (random() - 0.5) * 0.02,
      weight: u * rand(1.1, 2.4),
      ink: rand(0.55, 1),
      dry: rand(0.66, 0.97),
      jitter: random() * TAU,
    }));
    // Where the brush lifts, a few drops fly on along its path; sometimes one lands as a heart.
    const lift = stroke.start + stroke.sweep;
    const drops = Array.from({ length: 1 + Math.floor(random() * 3) }, (_, i) => {
      const along = lift + rand(0.05, 0.22);
      const out = stroke.radius * rand(1.07, 1.2);
      return {
        x: stroke.cx + Math.cos(along) * out,
        y: stroke.cy + Math.sin(along) * out * stroke.squash,
        r: u * (i === 0 ? rand(3.6, 5.2) : rand(1.4, 3)),
      };
    });
    // Sometimes the circle closes with a heart: a drop that landed in the gap the brush left.
    const heart =
      random() < 0.6
        ? (() => {
            const gapMiddle = stroke.start + stroke.sweep + (TAU - stroke.sweep) * rand(0.42, 0.58);
            return {
              x: stroke.cx + Math.cos(gapMiddle) * stroke.radius,
              y: stroke.cy + Math.sin(gapMiddle) * stroke.radius * stroke.squash,
              size: stroke.width * rand(1.45, 1.7),
              tilt: rand(-0.35, 0.35),
            };
          })()
        : null;
    return { size, u, stroke, bristles, drops, heart, brew: random(), grainSeed: Math.floor(random() * 1e9) };
  };

  // The centreline point and its outward normal at stroke progress t (0 to 1).
  const along = (stroke, t) => {
    const a = stroke.start + stroke.sweep * t;
    const r = stroke.radius * (1 + 0.022 * stroke.wobble(a) + 0.006 * stroke.tremor(a * 3));
    const x = stroke.cx + Math.cos(a) * r,
      y = stroke.cy + Math.sin(a) * r * stroke.squash;
    const nx = Math.cos(a),
      ny = Math.sin(a) * stroke.squash,
      n = Math.hypot(nx, ny) || 1;
    return { x, y, nx: nx / n, ny: ny / n };
  };

  // Brush width along the stroke: wide where it lands and through the turn, thinning as it lifts.
  const widthAt = (stroke, t) =>
    stroke.width * (1.12 + 0.18 * smooth(0, 0.05, t)) * (1.1 - 0.2 * t) * (1 + 0.13 * stroke.tremor(t * 7)) * (1 - 0.62 * smooth(0.7, 1, t));

  // Ink density (0 to 1) for the whole mark, drawn with the canvas's own anti-aliased lines.
  const inkField = (plan) => {
    const { size, u, stroke, bristles, drops, heart } = plan;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000";
    context.fillStyle = "#000";
    const steps = Math.ceil(stroke.sweep * stroke.radius * 0.9);
    for (const bristle of bristles) {
      let previous = null;
      context.lineWidth = bristle.weight;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const p = along(stroke, t);
        const w = widthAt(stroke, t);
        const offset = bristle.across * w + Math.sin(t * 40 + bristle.jitter) * u * 0.35;
        const point = { x: p.x + p.nx * offset, y: p.y + p.ny * offset };
        // A bristle runs dry near its own moment: thinner ink, then gaps that lengthen.
        // The brush lands loaded (the first few percent of the stroke carry extra ink).
        const left = Math.min(1, bristle.ink * (1 + 0.5 * (1 - smooth(0, 0.06, t)))) * (1 - smooth(bristle.dry - 0.22, bristle.dry + 0.05, t));
        const skip = left < 0.32 && Math.sin(t * 160 + bristle.jitter * 7) + Math.sin(t * 61 + bristle.jitter) > 1.1 - left * 2.5;
        if (previous && left > 0.04 && !skip) {
          context.globalAlpha = Math.min(1, 0.16 + 0.62 * left);
          context.beginPath();
          context.moveTo(previous.x, previous.y);
          context.lineTo(point.x, point.y);
          context.stroke();
        }
        previous = point;
      }
    }
    context.globalAlpha = 0.9;
    for (const drop of drops) {
      context.beginPath();
      context.ellipse(drop.x, drop.y, drop.r * 1.12, drop.r, drop.r, 0, TAU);
      context.fill();
    }
    if (heart) {
      // Two lobes and a point, drawn like a drip that happened to land this way.
      const { x, y, size: s, tilt } = heart;
      context.save();
      context.translate(x, y);
      context.rotate(tilt);
      context.globalAlpha = 0.82;
      context.beginPath();
      context.moveTo(0, s * 0.32);
      context.bezierCurveTo(-s * 0.58, -s * 0.06, -s * 0.36, -s * 0.52, 0, -s * 0.22);
      context.bezierCurveTo(s * 0.36, -s * 0.52, s * 0.58, -s * 0.06, 0, s * 0.32);
      context.closePath();
      context.fill();
      context.restore();
    }
    const pixels = context.getImageData(0, 0, size, size).data;
    const density = new Float32Array(size * size);
    for (let i = 0; i < density.length; i += 1) density[i] = pixels[i * 4 + 3] / 255;
    return density;
  };

  // Separable box blur, used to find where ink thins out at the edge of each mark.
  const blurred = (field, size, radius) => {
    const temp = new Float32Array(field.length),
      out = new Float32Array(field.length),
      span = radius * 2 + 1;
    for (let y = 0; y < size; y += 1) {
      let sum = 0;
      for (let x = -radius; x <= radius; x += 1) sum += field[y * size + Math.min(size - 1, Math.max(0, x))];
      for (let x = 0; x < size; x += 1) {
        temp[y * size + x] = sum / span;
        sum += field[y * size + Math.min(size - 1, x + radius + 1)] - field[y * size + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      for (let y = -radius; y <= radius; y += 1) sum += temp[Math.min(size - 1, Math.max(0, y)) * size + x];
      for (let y = 0; y < size; y += 1) {
        out[y * size + x] = sum / span;
        sum += temp[Math.min(size - 1, y + radius + 1) * size + x] - temp[Math.max(0, y - radius) * size + x];
      }
    }
    return out;
  };

  // Coffee dries darker at the rim of each mark and granulates in the paper's tooth.
  const dried = (plan, density) => {
    const { size, u, grainSeed } = plan;
    const soft = blurred(density, size, Math.max(1, Math.round(4.2 * u)));
    const random = makeRandom(grainSeed);
    const grain = new Float32Array(64 * 64);
    for (let i = 0; i < grain.length; i += 1) grain[i] = random();
    const out = new Float32Array(density.length);
    const cell = Math.max(1, size / 160);
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1) {
        const i = y * size + x,
          d = density[i];
        if (d < 0.01) continue;
        const rim = Math.max(0, d - soft[i]);
        const g = grain[(((y / cell) | 0) & 63) * 64 + (((x / cell) | 0) & 63)];
        out[i] = Math.min(1, (d * 0.52 + rim * 1.85) * (0.8 + 0.4 * g));
      }
    return out;
  };

  // Espresso where the ink is thick, warm amber where it is thin. Light themes multiply it into
  // the page; evening shows it as pale dried crema on a dark desk.
  const paint = (plan, field, palette) => {
    const { size, brew } = plan;
    const pixels = new Uint8ClampedArray(size * size * 4);
    const light = palette !== "dark";
    const thin = light ? [208 - 10 * brew, 138 - 14 * brew, 66 - 12 * brew] : [158, 114, 76];
    const thick = light ? [92 - 16 * brew, 46 - 10 * brew, 16 - 4 * brew] : [240, 208, 162];
    const strength = light ? 2.4 : 1.8;
    for (let i = 0; i < field.length; i += 1) {
      const d = field[i];
      if (!d) continue;
      const t = smooth(0.05, 0.85, d),
        o = i * 4;
      pixels[o] = thin[0] + (thick[0] - thin[0]) * t;
      pixels[o + 1] = thin[1] + (thick[1] - thin[1]) * t;
      pixels[o + 2] = thin[2] + (thick[2] - thin[2]) * t;
      pixels[o + 3] = 255 * (1 - Math.exp(-strength * d));
    }
    return new ImageData(pixels, size, size);
  };

  const seed = randomSeed();
  const random = makeRandom(hashSeed(`position-${seed}`));
  stacks.forEach((stack, index) => {
    stack.style.setProperty("--home-coffee-stain-rotation", `${number(between(random, -16, -5))}deg`);
    stack.style.setProperty("--home-coffee-stain-x", `${number(between(random, 0.38, 0.82))}rem`);
    stack.style.setProperty("--home-coffee-stain-y", `${number(between(random, -0.7, -0.28))}rem`);
    stack.style.setProperty("--home-coffee-stain-scale", String(number(between(random, 1.03, 1.13))));
    stack.dataset.coffeeStainSeed = index === 0 ? seed : `${seed}-${index}`;
  });

  // The stain's box at device resolution (at most 2x; it is a quiet desk cue).
  const box = parseFloat(window.getComputedStyle(stacks[0], "::before").width) || 220;
  const size = Math.max(160, Math.min(512, Math.round(box * Math.min(2, window.devicePixelRatio || 1))));
  const paletteFor = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const plan = design(seed, size);
  // The stroke draws itself in from where the brush landed (a conic mask in _home.scss), unless
  // the visitor prefers stillness or the page is under automation (captures stay deterministic).
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const drawIn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && (!navigator.webdriver || forceLive);
  stacks.forEach((stack) => {
    stack.style.setProperty("--home-coffee-stain-from", `${number((plan.stroke.start * 180) / Math.PI + 90)}deg`);
    stack.style.setProperty("--home-coffee-stain-cx", `${number((plan.stroke.cx / size) * 100)}%`);
    stack.style.setProperty("--home-coffee-stain-cy", `${number((plan.stroke.cy / size) * 100)}%`);
  });
  let field = null,
    painted = null,
    drawn = false;

  // The page's Content-Security-Policy admits data: images but not blob: ones, so the PNG is
  // encoded off the main thread (toBlob) and read back as a data URL.
  const show = () => {
    const palette = paletteFor();
    painted = palette;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").putImageData(paint(plan, field, palette), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob || painted !== palette) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (painted !== palette) return;
        stacks.forEach((stack) => {
          stack.style.setProperty("--home-coffee-stain-image", `url("${reader.result}")`);
          if (!drawn && drawIn) stack.dataset.coffeeStainDrawing = "true";
          stack.dataset.coffeeStainReady = "true";
        });
        drawn = true;
      };
      reader.readAsDataURL(blob);
    });
  };

  // Painting a stain is tens of milliseconds of arithmetic, so it runs in idle slices: the stroke,
  // then the drying, then the paint, and never holds up the page.
  const later = (callback) => (window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 800 }) : window.setTimeout(callback, 32));
  let ink = null;
  const work = () => {
    if (!ink) {
      ink = inkField(plan);
      later(work);
      return;
    }
    field = dried(plan, ink);
    show();
  };
  later(work);

  window.addEventListener("siteThemeChange", () => {
    if (field && paletteFor() !== painted) show();
  });
})();
