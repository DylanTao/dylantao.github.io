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

  // The ring a mug leaves on a desk once the coffee has dried (Sirui found the brushed ensō heavy and
  // rigid on 2026-10-19, and the dried-drop version a pale disc on 2026-10-24). A mug does not leave a
  // dried drop: coffee runs down its side onto the foot, and the foot prints a band a few millimetres
  // wide, a clean circle inside where it never touched (as in photographs of real mug rings). Both
  // edges of that band are pinned contact lines, so the coffee-ring effect (Deegan et al., Nature
  // 1997) gathers the coffee at both, most at the outer one, with grainy solids between. The band is
  // wider and darker where the mug leaned and the coffee pooled, thins to a ghost where the foot sat
  // dry, and sometimes the mug was set down twice. Low, irregular wobble, never a perfect circle or a
  // brush stroke. New on every visit; ?coffeeSeed= reproduces one.

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

  // How far angle a lies inside the arc that starts at `from` and runs `span` radians, eased at both ends.
  const arcWeight = (a, from, span, ease) => {
    const t = (((a - from) % TAU) + TAU) % TAU;
    if (t > span) return 0;
    return smooth(0, ease, t) * smooth(0, ease, span - t);
  };

  // Lay out one stain for a size x size canvas (all lengths scale with the canvas).
  const design = (seedLabel, size) => {
    const random = makeRandom(hashSeed(String(seedLabel)));
    const rand = (min, max) => between(random, min, max);
    const u = size / 400;
    const ring = {
      cx: size * rand(0.485, 0.515),
      cy: size * rand(0.485, 0.515),
      radius: size * rand(0.3, 0.32),
      squash: rand(0.965, 1),
      outline: periodic(random, 2, 5, 1.1),
      roughness: periodic(random, 13, 12, 0.55),
      widthNoise: periodic(random, 1, 4, 0.9),
      depthNoise: periodic(random, 1, 5, 0.8),
      beads: periodic(random, 40, 24, 0.35),
      // The foot's band, at its median; it widens where the mug leaned.
      rim: u * rand(7.5, 10.5),
      pool: rand(0, TAU),
      // Where the foot sat dry the rim thins to a ghost, as a soft gap rather than a cut.
      gap: random() < 0.75 ? { from: rand(0, TAU), span: rand(0.45, 0.95) } : null,
      // One or two places where the coffee crept a little further before it pinned.
      creeps: Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ at: rand(0, TAU), width: rand(0.25, 0.55), reach: rand(0.015, 0.04) })),
    };
    // Set down twice: a fainter, partial ring a little off the first.
    const turn = rand(0, TAU);
    const second =
      random() < 0.5
        ? {
            dx: Math.cos(turn) * ring.radius * rand(0.16, 0.3),
            dy: Math.sin(turn) * ring.radius * rand(0.16, 0.3),
            scale: rand(0.97, 1.03),
            from: turn + rand(-0.6, 0.6),
            span: rand(1.6, 2.8),
            strength: rand(0.3, 0.45),
          }
        : null;
    return { size, u, ring, second, brew: random(), grainSeed: Math.floor(random() * 1e9) };
  };

  // Smooth value noise on a coarse lattice, for the paper's tooth (no visible fibres or hatching).
  const noiseField = (seed, size, cell) => {
    const random = makeRandom(seed);
    const cols = Math.ceil(size / cell) + 2;
    const lattice = new Float32Array(cols * cols);
    for (let i = 0; i < lattice.length; i += 1) lattice[i] = random();
    return (x, y) => {
      const gx = x / cell,
        gy = y / cell;
      const ix = Math.floor(gx),
        iy = Math.floor(gy);
      const fx = gx - ix,
        fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => lattice[(iy + j) * cols + ix + i];
      return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy;
    };
  };

  const BINS = 2048;

  // Per-angle radius, rim width and rim darkness for one ring, sampled once.
  const profile = (ring, scale = 1) => {
    const radius = new Float32Array(BINS),
      width = new Float32Array(BINS),
      depth = new Float32Array(BINS),
      pool = new Float32Array(BINS);
    for (let b = 0; b < BINS; b += 1) {
      const a = (b / BINS) * TAU;
      let creep = 0;
      for (const bump of ring.creeps) {
        const off = Math.atan2(Math.sin(a - bump.at), Math.cos(a - bump.at));
        creep += bump.reach * Math.exp(-((off / bump.width) ** 2));
      }
      radius[b] = ring.radius * scale * (1 + 0.034 * ring.outline(a) + 0.005 * ring.roughness(a) + creep);
      const pooled = 0.5 + 0.5 * Math.cos(a - ring.pool);
      // Wider on the side where the mug leaned and the coffee pooled, narrower on the far side.
      width[b] = ring.rim * (0.65 + 0.9 * Math.pow(pooled, 1.3) + 0.2 * ring.widthNoise(a));
      // Darker where the liquid pooled, nearly gone on the far side, and beaded along the line where
      // the particles piled up unevenly.
      let d = (0.5 + 0.75 * Math.pow(pooled, 1.6) + 0.22 * ring.depthNoise(a)) * (0.8 + 0.3 * ring.beads(a));
      if (ring.gap) d *= 1 - 0.78 * arcWeight(a, ring.gap.from, ring.gap.span, 0.18);
      depth[b] = Math.max(0.04, d);
      pool[b] = pooled;
    }
    return { radius, width, depth, pool };
  };

  // Deposited coffee per pixel (roughly 0 to 1) once the ring has dried.
  const densityField = (plan) => {
    const { size, u, ring, second, grainSeed } = plan;
    const field = new Float32Array(size * size);
    const main = profile(ring);
    const grain = noiseField(grainSeed, size, Math.max(2, 5 * u));
    const mottle = noiseField(grainSeed ^ 0x5bd1e995, size, Math.max(4, 26 * u));
    // Granulation: the coffee's fine solids settle into the paper's tooth, unevenly (Curtis et al. 1997).
    const settle = noiseField(grainSeed ^ 0x27d4eb2d, size, Math.max(1.5, 2.6 * u));
    const sample = (x, y, cx, cy, table) => {
      const dx = x - cx,
        dy = (y - cy) / ring.squash;
      const d = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) + TAU) % TAU;
      const b = Math.min(BINS - 1, Math.floor((a / TAU) * BINS));
      return { d, a, r: table.radius[b], w: table.width[b], k: table.depth[b] };
    };
    // Coffee at distance s inside a band's outer edge, for a band of width w and darkness k: sharp at
    // both contact lines, gathered most at the outer one and a little at the inner, grainy between.
    const band = (s, w, k) => {
      const outer = smooth(-0.55 * u, 0.4 * u, s),
        inner = smooth(-0.55 * u, 0.4 * u, w - s);
      if (outer <= 0 || inner <= 0) return 0;
      const t = Math.min(1, Math.max(0, s / w));
      return outer * inner * k * (0.42 + 0.62 * Math.exp(-t / 0.2) + 0.3 * Math.exp(-(1 - t) / 0.14));
    };
    const secondTable = second ? profile(ring, second.scale) : null;
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1) {
        const px = x + 0.5,
          py = y + 0.5;
        const m = sample(px, py, ring.cx, ring.cy, main);
        const s = m.r - m.d; // distance inside the band's outer edge
        if ((s < -2 * u || s > m.w + 14 * u) && !second) continue;
        let value = band(s, m.w, m.k) * (0.7 + 0.6 * mottle(px, py)) * (0.72 + 0.56 * settle(px, py));
        // A little coffee wicked past each edge into the paper: a faint, soft halo, so the clean
        // circle inside meets the band without a hard pale edge.
        if (s > m.w) value += 0.014 * m.k * Math.exp(-(s - m.w) / (5 * u));
        else if (s < 0) value += 0.012 * m.k * Math.exp(s / (2.5 * u));
        if (second) {
          const n = sample(px, py, ring.cx + second.dx, ring.cy + second.dy, secondTable);
          value += second.strength * band(n.r - n.d, n.w * 0.8, n.k) * arcWeight(n.a, second.from, second.span, 0.7);
        }
        if (value <= 0) continue;
        // The paper's tooth, kept quiet.
        value *= 0.88 + 0.2 * grain(px, py);
        field[y * size + x] = value;
      }
    return field;
  };

  // Dried coffee is warm amber where it is thin and espresso brown at the rim. Light themes multiply
  // it into the page and the slips. On the evening desk it is the dull brown residue coffee leaves on
  // a dark surface, a little lighter and warmer than the desk, never a pale outline.
  const paint = (plan, field, palette) => {
    const { size, brew } = plan;
    const pixels = new Uint8ClampedArray(size * size * 4);
    const light = palette !== "dark";
    const thin = light ? [208 - 10 * brew, 152 - 12 * brew, 82 - 12 * brew] : [112 + 6 * brew, 86 + 4 * brew, 58];
    const thick = light ? [146 - 18 * brew, 90 - 12 * brew, 36 - 6 * brew] : [168 - 8 * brew, 124 - 8 * brew, 74 - 6 * brew];
    const strength = light ? 2.8 : 1.9;
    for (let i = 0; i < field.length; i += 1) {
      const d = field[i];
      if (!d) continue;
      const t = smooth(0.06, 0.75, d),
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
    stack.style.setProperty("--home-coffee-stain-rotation", `${number(between(random, -24, 24))}deg`);
    stack.style.setProperty("--home-coffee-stain-x", `${number(between(random, -0.3, 0.45))}rem`);
    stack.style.setProperty("--home-coffee-stain-y", `${number(between(random, -0.35, 0.2))}rem`);
    stack.style.setProperty("--home-coffee-stain-scale", String(number(between(random, 0.96, 1.06))));
    stack.dataset.coffeeStainSeed = index === 0 ? seed : `${seed}-${index}`;
  });

  // The stain's box at device resolution (at most 2x; it is a quiet desk cue).
  const box = parseFloat(window.getComputedStyle(stacks[0], "::before").width) || 220;
  const size = Math.max(160, Math.min(512, Math.round(box * Math.min(2, window.devicePixelRatio || 1))));
  const paletteFor = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const plan = design(seed, size);
  // Once painted, the mark settles in once as it comes into view: a slow, soft bloom whose edge
  // sharpens as the liquid pins (Sirui, 2026-10-24: the wet-to-dry play read as too much animation).
  // People only: reduced motion and automation (captures stay deterministic) see the dried ring at once.
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const dryIn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && (!navigator.webdriver || forceLive);
  let field = null,
    painted = null,
    dried = false;

  // The page's Content-Security-Policy admits data: images but not blob: ones, so each PNG is
  // encoded off the main thread (toBlob) and read back as a data URL.
  const encode = (imageData, done) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => done(reader.result);
      reader.readAsDataURL(blob);
    });
  };

  // The stain is decoration, so it may wait for its moment: a person sees the mark settle once a
  // quarter of the slips is on screen (attribute names are spelled out for the deploy's PurgeCSS).
  const startDrying = () => {
    if (dried) return;
    dried = true;
    stacks.forEach((stack) => stack.setAttribute("data-coffee-stain-drying", "true"));
  };

  const watchForView = () => {
    stacks.forEach((stack) => stack.setAttribute("data-coffee-stain-drying", "pending"));
    if (!("IntersectionObserver" in window)) return startDrying();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startDrying();
      },
      { threshold: 0.25 }
    );
    stacks.forEach((stack) => observer.observe(stack));
  };

  const show = () => {
    const palette = paletteFor();
    painted = palette;
    encode(paint(plan, field, palette), (url) => {
      if (painted !== palette) return;
      stacks.forEach((stack) => {
        stack.style.setProperty("--home-coffee-stain-image", `url("${url}")`);
        stack.setAttribute("data-coffee-stain-ready", "true");
      });
      if (dryIn && !dried) watchForView();
    });
  };

  // Painting a stain is tens of milliseconds of arithmetic, so it runs in idle slices (the ring,
  // then the paint) and never holds up the page.
  const later = (callback) => (window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 800 }) : window.setTimeout(callback, 32));
  const work = () => {
    if (!field) {
      field = densityField(plan);
      later(work);
      return;
    }
    show();
  };
  later(work);

  window.addEventListener("siteThemeChange", () => {
    if (field && paletteFor() !== painted) show();
  });
})();
