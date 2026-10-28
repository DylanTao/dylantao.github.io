(function () {
  const stacks = Array.from(document.querySelectorAll(".home-artifact-stack.has-coffee-stain"));
  if (!stacks.length) return;
  const scriptUrl = document.currentScript?.src || new URL("assets/js/home-coffee-stain.js", document.baseURI).href;
  const pigmentUrl = new URL("../img/home/coffee-deposit-20261028-c91b57ee8c.webp", scriptUrl).href;

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

  // Sirui's dried mug-ring reference: a coherent translucent wash, a dark pinned outer
  // edge, a few pooled deposits and a torn dry arc. Fine paper wicking is secondary to
  // the body of the stain; its centre stays transparent. Perimeter concentration
  // (Deegan et al., Nature 1997) and pigment granulation (Curtis et al., SIGGRAPH 1997)
  // inform this authored density field, not a fluid simulation. New on every visit;
  // ?coffeeSeed= reproduces one, including its small group of dried drops.

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
      radius: size * rand(0.385, 0.4),
      squash: rand(0.965, 1),
      outline: periodic(random, 2, 5, 1.1),
      roughness: periodic(random, 13, 12, 0.55),
      widthNoise: periodic(random, 1, 4, 0.9),
      depthNoise: periodic(random, 1, 5, 0.8),
      beads: periodic(random, 40, 24, 0.35),
      // The foot's band, at its median; it widens where the mug leaned.
      rim: u * rand(12, 15),
      pool: rand(0, TAU),
      // Where the foot sat dry the rim thins to a ghost, as a soft gap rather than a cut.
      gap: { from: rand(1.9, 2.2), span: rand(0.62, 0.95) },
      deposits: Array.from({ length: 3 }, (_, i) => ({ at: (i * TAU) / 3 + rand(-0.4, 0.4), width: rand(0.23, 0.45), amount: rand(0.5, 1) })),
      // One or two places where the coffee crept a little further before it pinned.
      creeps: Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ at: rand(0, TAU), width: rand(0.25, 0.55), reach: rand(0.015, 0.04) })),
    };
    const drops = [
      // A couple of small drips inside the footprint; the centre remains clear paper.
      { x: ring.cx + ring.radius * rand(0.1, 0.3), y: ring.cy + ring.radius * rand(0.3, 0.5), r: size * rand(0.009, 0.014) },
      { x: ring.cx - ring.radius * rand(0.2, 0.4), y: ring.cy + ring.radius * rand(0.1, 0.35), r: size * rand(0.007, 0.011) },
      // The lifted mug leaves one small group below its rim, with varied size and spacing.
      ...Array.from({ length: 3 }, (_, i) => ({
        x: size * (0.44 + i * 0.11 + rand(-0.018, 0.018)),
        y: size * rand(0.925, 0.955),
        r: size * (i === 1 ? rand(0.017, 0.022) : rand(0.008, 0.013)),
      })),
    ].map((d) => ({ ...d, squash: rand(0.72, 1.06), phase: rand(0, TAU), strength: rand(0.55, 1.1) }));
    return { size, u, ring, drops, brew: random(), grainSeed: Math.floor(random() * 1e9) };
  };

  // Smooth value noise for pooled colour and paper tooth, not a texture over the whole page.
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
      let deposit = 0;
      for (const lobe of ring.deposits) {
        const off = Math.atan2(Math.sin(a - lobe.at), Math.cos(a - lobe.at));
        deposit += lobe.amount * Math.exp(-((off / lobe.width) ** 2));
      }
      radius[b] += deposit * 2.5 * (ring.radius / 156);
      // Wider on the side where the mug leaned and the coffee pooled, narrower on the far side.
      width[b] = ring.rim * Math.max(0.45, Math.min(1.5, 0.65 + 0.35 * pooled + 0.6 * deposit + 0.2 * ring.widthNoise(a)));
      // Darker where the liquid pooled, nearly gone on the far side, and beaded along the line where
      // the particles piled up unevenly.
      const d = (0.65 + 0.3 * pooled + 1.25 * deposit + 0.3 * ring.depthNoise(a)) * (0.93 + 0.1 * ring.beads(a));
      depth[b] = Math.max(0, d);
      pool[b] = pooled;
    }
    return { radius, width, depth, pool };
  };

  // Deposited coffee per pixel (roughly 0 to 1) once the ring has dried.
  const densityField = (plan) => {
    const { size, u, ring, drops, grainSeed } = plan;
    const field = new Float32Array(size * size);
    const main = profile(ring);
    const grain = noiseField(grainSeed, size, Math.max(2, 5 * u));
    const mottle = noiseField(grainSeed ^ 0x5bd1e995, size, Math.max(4, 26 * u));
    // Granulation: the coffee's fine solids settle into the paper's tooth, unevenly (Curtis et al. 1997).
    const settle = noiseField(grainSeed ^ 0x27d4eb2d, size, Math.max(1.5, 2.6 * u));
    const tooth = noiseField(grainSeed ^ 0x1b873593, size, Math.max(0.8, 1.6 * u));
    const sample = (x, y, cx, cy, table) => {
      const dx = x - cx,
        dy = (y - cy) / ring.squash;
      const d = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) + TAU) % TAU;
      const b = Math.min(BINS - 1, Math.floor((a / TAU) * BINS));
      return { d, a, r: table.radius[b], w: table.width[b], k: table.depth[b] };
    };
    // A sharp outer deposit over a coherent wash, softer at its irregular inner edge.
    const band = (s, w, k) => {
      const outer = smooth(-0.55 * u, 0.4 * u, s),
        inner = 1 - smooth(w - 1.8 * u, w + 1.1 * u, s);
      if (outer <= 0 || inner <= 0) return 0;
      const t = Math.min(1, Math.max(0, s / w));
      return outer * inner * k * (0.52 + 0.72 * Math.exp(-t / 0.17));
    };
    let row = 0;
    const step = () => {
      const end = Math.min(size, row + 8),
        started = performance.now();
      while (row < end) {
        const y = row++;
        for (let x = 0; x < size; x += 1) {
          const px = x + 0.5,
            py = y + 0.5;
          const m = sample(px, py, ring.cx, ring.cy, main);
          const texture = settle(px, py),
            fine = tooth(px, py);
          const s = m.r - m.d + (texture - 0.5) * u * 0.65 + (fine - 0.5) * u * 0.4;
          // The wash is continuous. Broad pooled colour carries the material; fine
          // granulation only modulates it and the capillary fringe lies outside it.
          let value = band(s, m.w + (texture - 0.5) * 1.5 * u, m.k) * (0.55 + 0.9 * mottle(px, py)) * (0.72 + 0.5 * texture);
          // Short capillary fingers outside the band; never a pale filled interior.
          if (s < 0 && s > -3 * u) value += 0.12 * m.k * Math.exp(s / (1.2 * u)) * smooth(0.43, 0.78, texture);
          value *= 1 - arcWeight(m.a + (texture - 0.5) * 0.12 + (mottle(px, py) - 0.5) * 0.12, ring.gap.from, ring.gap.span, 0.1);
          for (const drop of drops) {
            const dx = px - drop.x,
              dy = (py - drop.y) / drop.squash;
            if (Math.abs(dx) > drop.r * 1.4 || Math.abs(dy) > drop.r * 1.4) continue;
            const a = Math.atan2(dy, dx),
              r = drop.r * (1 + 0.09 * Math.sin(a * 3 + drop.phase) + 0.045 * Math.sin(a * 7 - drop.phase));
            const q = Math.hypot(dx, dy) / r;
            const cover = 1 - smooth(0.85, 1.1, q);
            value += cover * drop.strength * (0.34 + 0.7 * Math.exp(-(((q - 0.8) / 0.18) ** 2))) * (0.9 + 0.2 * texture);
          }
          if (value <= 0) continue;
          // The paper's tooth, kept quiet.
          value *= 0.88 + 0.2 * grain(px, py);
          field[y * size + x] = value;
        }
        if (performance.now() - started > 4) break;
      }
      return row === size;
    };
    return { field, step };
  };

  // Dried coffee is warm amber where it is thin and espresso brown at the rim. Light themes multiply
  // it into the page and the slips. On the evening desk it is the dull brown residue coffee leaves on
  // a dark surface, a little lighter and warmer than the desk, never a pale outline.
  const paint = (plan, field, palette) => {
    const { size, brew } = plan;
    const pixels = new Uint8ClampedArray(size * size * 4);
    const light = palette !== "dark";
    const thin = light ? [181 - 12 * brew, 118 - 10 * brew, 56 - 8 * brew] : [117 + 6 * brew, 78 + 4 * brew, 43];
    const thick = light ? [76 - 12 * brew, 36 - 8 * brew, 13 - 4 * brew] : [184 - 8 * brew, 126 - 8 * brew, 68 - 6 * brew];
    const strength = light ? 3.8 : 2.1;
    for (let i = 0; i < field.length; i += 1) {
      const d = field[i];
      if (!d) continue;
      const t = smooth(0.06, 1.25, d),
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

  // Supersample fine edges, bounded to 512 square pixels even on high-DPR screens.
  const box = parseFloat(window.getComputedStyle(stacks[0], "::before").width) || 220;
  const size = Math.max(160, Math.min(512, Math.round(box * Math.max(1.5, Math.min(2, window.devicePixelRatio || 1)))));
  const paletteFor = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const plan = design(seed, size);
  // Once painted, the mark settles in once as it comes into view: a slow, soft bloom whose edge
  // sharpens as the liquid pins (Sirui, 2026-10-24: the wet-to-dry play read as too much animation).
  // People only: reduced motion and automation (captures stay deterministic) see the dried ring at once.
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const dryIn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && (!navigator.webdriver || forceLive);
  let field = null,
    pigment = null,
    densityJob = null,
    painted = null,
    dried = false;

  // The page's Content-Security-Policy admits data: images but not blob: ones, so each PNG
  // uses the asynchronous toBlob API and is read back as a data URL.
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
    let imageData;
    if (pigment) {
      const pixels = new Uint8ClampedArray(pigment.data),
        tint = 0.96 + plan.brew * 0.08;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue;
        pixels[i] *= tint;
        pixels[i + 1] *= 0.98 + plan.brew * 0.04;
        pixels[i + 3] *= (palette === "dark" ? 0.94 : 1) * (0.97 + plan.brew * 0.06);
      }
      imageData = new ImageData(pixels, size, size);
    } else imageData = paint(plan, field, palette);
    encode(imageData, (url) => {
      if (painted !== palette) return;
      stacks.forEach((stack) => {
        stack.style.setProperty("--home-coffee-stain-image", `url("${url}")`);
        stack.setAttribute("data-coffee-stain-ready", "true");
        stack.setAttribute("data-coffee-stain-source", pigment ? "raster" : "procedural");
      });
      if (dryIn && !dried) watchForView();
    });
  };

  // Decoration yields between at most eight scanlines, aiming for four milliseconds of
  // arithmetic per idle turn. This is a work budget, not a device timing guarantee.
  const later = (callback) => (window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 800 }) : window.setTimeout(callback, 32));
  const work = () => {
    if (!field) {
      densityJob ||= densityField(plan);
      if (densityJob.step()) field = densityJob.field;
      later(work);
      return;
    }
    show();
  };
  // The original generated pigment is the preferred material. It decodes lazily
  // from this classic script's own baseurl; a failed or stalled load uses the
  // deterministic procedural version. No late texture swap or perpetual redraw.
  const image = new Image();
  image.decoding = "async";
  let selected = false,
    loadTimer = 0;
  const fallback = () => {
    if (selected) return;
    selected = true;
    window.clearTimeout(loadTimer);
    later(work);
  };
  image.onerror = fallback;
  image.onload = async () => {
    try {
      await image.decode();
    } catch {
      return fallback();
    }
    if (selected) return;
    selected = true;
    window.clearTimeout(loadTimer);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d"),
      variant = makeRandom(hashSeed("pigment-" + seed));
    context.translate(size / 2, size / 2);
    context.scale(between(variant, 0.98, 1.02), between(variant, 0.98, 1.02));
    // Inset the real alpha mask, including the irregular satellite drops, so
    // the seeded outer placement can turn without clipping against the column.
    context.drawImage(image, -size * 0.43, -size * 0.43, size * 0.86, size * 0.86);
    pigment = context.getImageData(0, 0, size, size);
    later(show);
  };
  const load = () => {
    loadTimer = window.setTimeout(fallback, 1500);
    image.src = pigmentUrl;
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: "320px 0px" }
    );
    stacks.forEach((stack) => observer.observe(stack));
  } else load();

  window.addEventListener("siteThemeChange", () => {
    if ((field || pigment) && paletteFor() !== painted) show();
  });
})();
