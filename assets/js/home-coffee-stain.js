(function () {
  const TAU = Math.PI * 2;
  const hashSeed = (input) => {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    return hash >>> 0;
  };
  const makeRandom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let mixed = Math.imul(value ^ (value >>> 15), value | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  };
  const between = (random, low, high) => low + random() * (high - low);
  const smooth = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const periodic = (random, first, count, slope) => {
    const terms = [];
    let total = 0;
    for (let k = first; k < first + count; k++) {
      const amplitude = Math.pow(k, -slope) * (0.5 + random());
      total += amplitude;
      terms.push([k, amplitude, random() * TAU]);
    }
    return (angle) => terms.reduce((sum, [k, amplitude, phase]) => sum + amplitude * Math.cos(k * angle + phase), 0) / total;
  };
  const arcWeight = (angle, from, span, ease) => {
    const t = (((angle - from) % TAU) + TAU) % TAU;
    return t > span ? 0 : smooth(0, ease, t) * smooth(0, ease, span - t);
  };

  // The retained fallback's seeded angular-profile / density structure now
  // generates the primary material. This is authored deposition, not a fluid
  // simulation. Seeds change the actual contact, wash and drop geometry.
  const design = (seed, size) => {
    if (![1024, 1536].includes(size)) throw new RangeError("A bounded 1024 or 1536 pixel pigment field is required");
    const random = makeRandom(hashSeed(String(seed))),
      rand = (a, b) => between(random, a, b);
    const ring = {
      cx: size * rand(0.492, 0.508),
      cy: size * rand(0.453, 0.478),
      radius: size * rand(0.36, 0.38),
      squash: rand(0.94, 1.015),
      rim: size * rand(0.038, 0.049),
      outline: periodic(random, 2, 6, 1.0),
      roughness: periodic(random, 15, 19, 0.55),
      widthNoise: periodic(random, 1, 7, 0.7),
      depthNoise: periodic(random, 2, 8, 0.8),
      beads: periodic(random, 47, 31, 0.3),
      gaps: [{ from: rand(1.8, 3.4), span: rand(0.4, 1.12), loss: rand(0.91, 0.995) }],
      pinBreaks: Array.from({ length: 2 + Math.floor(random() * 3) }, () => ({
        from: rand(0, TAU),
        span: rand(0.02, 0.055),
        loss: rand(0.8, 0.995),
      })),
      deposits: Array.from({ length: 2 + Math.floor(random() * 4) }, () => ({ at: rand(0, TAU), width: rand(0.1, 0.38), amount: rand(0.28, 1.1) })),
      creeps: Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({ at: rand(0, TAU), width: rand(0.1, 0.35), reach: rand(0.005, 0.018) })),
    };
    for (let i = 0, count = 1 + Math.floor(random() * 3); i < count; i++)
      ring.gaps.push({ from: rand(0, TAU), span: rand(0.05, 0.18), loss: rand(0.25, 0.7) });
    const drops = [];
    // Place complete drops in a circular inset before drawing, rather than
    // clipping alpha after rotation. 1.5 includes contour, squash and fringe.
    const boundedDrop = (x, y, radius) => {
      const distance = Math.hypot(x - 0.5, y - 0.5),
        limit = 0.44 - 1.5 * radius;
      return distance <= limit ? [x, y] : [0.5 + ((x - 0.5) * limit) / distance, 0.5 + ((y - 0.5) * limit) / distance];
    };
    const add = (x, y, radius) => {
      drops.push({ x: x * size, y: y * size, r: radius * size, squash: rand(0.7, 1.16), phase: rand(0, TAU), strength: rand(0.45, 1.1) });
    };
    // Complete unequal drips, distributed in two dimensions rather than an ellipsis.
    const anchor = [rand(0.66, 0.77), rand(0.79, 0.84)];
    add(anchor[0], anchor[1], rand(0.017, 0.027));
    for (let i = 0, count = 2 + Math.floor(random() * 4); i < count; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const angle = rand(0, TAU),
          distance = rand(0.045, 0.12),
          radius = rand(0.004, 0.013);
        const x = Math.max(0.55, Math.min(0.86, anchor[0] + Math.cos(angle) * distance)),
          y = Math.max(0.74, Math.min(0.89, anchor[1] + Math.sin(angle) * distance));
        if (drops.some((drop) => Math.hypot(x - drop.x / size, y - drop.y / size) < radius + drop.r / size + 0.012)) continue;
        add(x, y, radius);
        break;
      }
    }
    for (let i = 0, count = Math.floor(random() * 3); i < count; i++) add(rand(0.4, 0.63), rand(0.4, 0.58), rand(0.003, 0.007));
    // Safety placement must not reroll the unrelated contact/wash pigment.
    for (const drop of drops) {
      const [x, y] = boundedDrop(drop.x / size, drop.y / size, drop.r / size);
      drop.x = x * size;
      drop.y = y * size;
    }
    return { size, u: size / 400, seed: String(seed), ring, drops, brew: random(), grainSeed: Math.floor(random() * 0xffffffff) };
  };
  const noiseField = (seed, size, cellX, cellY = cellX) => {
    // Hash grid corners on demand: no large unchunked noise-lattice fill.
    const corner = (x, y) => {
      let value = Math.imul(x ^ seed, 0x1e35a7bd) ^ Math.imul(y, 0x94d049bb);
      value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
    };
    return (x, y) => {
      const gx = x / cellX,
        gy = y / cellY,
        ix = Math.floor(gx),
        iy = Math.floor(gy),
        sx = smooth(0, 1, gx - ix),
        sy = smooth(0, 1, gy - iy);
      return (corner(ix, iy) * (1 - sx) + corner(ix + 1, iy) * sx) * (1 - sy) + (corner(ix, iy + 1) * (1 - sx) + corner(ix + 1, iy + 1) * sx) * sy;
    };
  };
  const BINS = 4096;
  const profile = (ring) => {
    const radius = new Float32Array(BINS),
      width = new Float32Array(BINS),
      depth = new Float32Array(BINS),
      pools = new Float32Array(BINS),
      pin = new Float32Array(BINS);
    let bin = 0;
    const table = {
      radius,
      width,
      depth,
      pools,
      pin,
      ready: false,
      step() {
        for (let i = bin, end = Math.min(BINS, bin + 256); i < end; i++, bin++) {
          const angle = (i * TAU) / BINS;
          let creep = 0,
            deposit = 0,
            contact = 1;
          for (const bump of ring.creeps) {
            const off = Math.atan2(Math.sin(angle - bump.at), Math.cos(angle - bump.at));
            creep += bump.reach * Math.exp(-((off / bump.width) ** 2));
          }
          for (const lobe of ring.deposits) {
            const off = Math.atan2(Math.sin(angle - lobe.at), Math.cos(angle - lobe.at));
            deposit += lobe.amount * Math.exp(-((off / lobe.width) ** 2));
          }
          for (const gap of ring.gaps) contact *= 1 - gap.loss * arcWeight(angle, gap.from, gap.span, Math.min(0.16, gap.span / 3));
          let pinned = contact;
          for (const gap of ring.pinBreaks) pinned *= 1 - gap.loss * arcWeight(angle, gap.from, gap.span, gap.span / 4);
          radius[i] = ring.radius * (1 + 0.035 * ring.outline(angle) + 0.009 * ring.roughness(angle) + creep);
          width[i] = Math.min(ring.radius * 0.17, ring.rim * Math.max(0.35, 0.95 + 0.55 * ring.widthNoise(angle) + deposit * 0.5));
          depth[i] = Math.max(0.01, contact * (0.65 + 0.55 * ring.depthNoise(angle) + deposit * 0.4) * (0.83 + 0.27 * ring.beads(angle)));
          pools[i] = deposit;
          pin[i] = pinned * (0.9 + 0.18 * ring.beads(angle));
        }
        table.ready = bin === BINS;
      },
    };
    return table;
  };
  const densityField = (plan, { wet = false } = {}) => {
    const { size, u, ring, drops, grainSeed } = plan,
      table = profile(ring),
      field = new Float32Array(size * size);
    const washField = wet ? new Float32Array(size * size) : null;
    const broad = noiseField(grainSeed, size, size / 28),
      flow = noiseField(grainSeed ^ 0x5bd1e995, size, size / 85);
    const fiber = noiseField(grainSeed ^ 0x27d4eb2d, size, size / 470, size / 260),
      tooth = noiseField(grainSeed ^ 0x1b873593, size, size / 700);
    // One intermediate pigment scale between the broad wash and fine tooth.
    // Its cells are about0.7–1.2CSSpx at the intended footprint; the wash
    // retains at least75percent of its body under the local granulation.
    const pigment = noiseField(grainSeed ^ 0x7f4a7c15, size, size / 245, size / 190);
    const stats = { chunks: 0, cpuMs: 0, maxChunkMs: 0, rows: 0, sampledPixels: 0 };
    let row = 0;
    const step = (maxRows = 24, maxMs = 4) => {
      const start = performance.now(),
        end = Math.min(size, row + maxRows);
      if (!table.ready) {
        table.step();
        const elapsed = performance.now() - start;
        stats.chunks++;
        stats.cpuMs += elapsed;
        stats.maxChunkMs = Math.max(stats.maxChunkMs, elapsed);
        return false;
      }
      while (row < end) {
        const y = row++,
          py = y + 0.5;
        for (let x = 0; x < size; x++) {
          const px = x + 0.5,
            dx = px - ring.cx,
            dy = (py - ring.cy) / ring.squash,
            distance = Math.hypot(dx, dy);
          let value = 0,
            wetValue = 0;
          if (distance > ring.radius * 0.78 && distance < ring.radius * 1.085) {
            const angle = (Math.atan2(dy, dx) + TAU) % TAU,
              at = (angle / TAU) * BINS,
              i = Math.floor(at),
              t = at - i,
              next = (i + 1) % BINS;
            const sample = (array) => array[i] * (1 - t) + array[next] * t;
            const radius = sample(table.radius),
              width = sample(table.width),
              contact = sample(table.depth),
              pool = sample(table.pools),
              pin = sample(table.pin),
              s0 = radius - distance;
            if (s0 > -4 * u && s0 < width * 1.65 + 3 * u) {
              stats.sampledPixels++;
              const m = broad(px, py),
                f = flow(px, py),
                fibers = fiber(px, py),
                grain = tooth(px, py),
                granule = pigment(px, py);
              const s = s0 + (f - 0.5) * 1.5 * u + (fibers - 0.5) * 0.48 * u,
                wetWidth = width * (0.65 + m * 0.8 + (f - 0.5) * 0.3);
              const cover = smooth(-0.15 * u, 0.22 * u, s) * (1 - smooth(wetWidth * 0.7, wetWidth + 0.7 * u, s));
              // The wash has broad material variation; contact-line concentration
              // is broken and localized, without a uniform radial bevel.
              const wash = cover * (0.24 + 0.85 * m * m + 0.32 * f + 0.06 * grain) * (0.68 + pool * 0.6);
              const edge =
                smooth(-0.15 * u, 0.25 * u, s) *
                Math.exp(-(((s - 0.7 * u) / (0.9 * u + 0.25 * grain * u)) ** 2)) *
                (0.55 + 0.45 * smooth(0.18, 0.78, f));
              const pooled = cover * pool * 0.26 * smooth(0.12, 0.77, f + (m - 0.5) * 0.6);
              const bleed = s < 0 ? 0.055 * Math.exp(s / (0.8 * u)) * smooth(0.64, 0.91, fibers) * (0.4 + m) : 0;
              const pigmentDetail = 1 + 0.5 * (granule - 0.5);
              const pinWear = 0.9 + 0.2 * granule;
              value = contact * (wash * pigmentDetail + pooled + bleed) * (0.92 + grain * 0.14) + pin * edge * 0.95 * pinWear;
              const wetCover = smooth(-0.65 * u, 0.3 * u, s) * (1 - smooth(wetWidth * 0.85, wetWidth * 1.18 + u, s));
              wetValue = contact * (wetCover * (0.22 + m * 0.27 + pool * 0.08) + edge * 0.08 + bleed * 0.25);
            }
          }
          for (const drop of drops) {
            const dx = px - drop.x,
              dy = (py - drop.y) / drop.squash;
            if (Math.abs(dx) > drop.r * 1.25 || Math.abs(dy) > drop.r * 1.25) continue;
            const a = Math.atan2(dy, dx),
              radius = drop.r * (1 + 0.1 * Math.sin(a * 3 + drop.phase) + 0.055 * Math.sin(a * 7 - drop.phase)),
              q = Math.hypot(dx, dy) / radius;
            if (q > 1.12) continue;
            const f = flow(px, py),
              grain = tooth(px, py),
              cover = 1 - smooth(0.86 + (grain - 0.5) * 0.09, 1.07, q);
            const edge = Math.exp(-(((q - 0.87) / 0.085) ** 2)) * (0.5 + f * 0.5);
            value += cover * drop.strength * (0.085 + f * 0.16 + grain * 0.04 + edge * 0.95);
            wetValue += cover * drop.strength * (0.26 + f * 0.18);
          }
          field[y * size + x] = value;
          if (washField) washField[y * size + x] = wetValue;
        }
        if (performance.now() - start >= maxMs) break;
      }
      const elapsed = performance.now() - start;
      stats.chunks++;
      stats.cpuMs += elapsed;
      stats.maxChunkMs = Math.max(stats.maxChunkMs, elapsed);
      stats.rows = row;
      return row === size;
    };
    return { field, washField, step, stats };
  };
  const paintField = (plan, field, palette, pixels = new Uint8ClampedArray(plan.size * plan.size * 4)) => {
    const { size, brew } = plan,
      light = palette !== "dark",
      thin = light ? [184 - 12 * brew, 100 - 8 * brew, 20] : [114, 75, 38];
    const thick = light ? [84 - 8 * brew, 34 - 4 * brew, 10] : [178 - 10 * brew, 115 - 8 * brew, 55];
    let row = 0;
    const stats = { chunks: 0, cpuMs: 0, maxChunkMs: 0 };
    return {
      pixels,
      stats,
      step(maxRows = 32, maxMs = 4) {
        const start = performance.now(),
          end = Math.min(size, row + maxRows);
        while (row < end) {
          const last = ++row * size;
          for (let i = last - size; i < last; i++) {
            const d = field[i],
              offset = i * 4,
              t = smooth(0.12, 1.1, d);
            pixels[offset] = thin[0] + (thick[0] - thin[0]) * t;
            pixels[offset + 1] = thin[1] + (thick[1] - thin[1]) * t;
            pixels[offset + 2] = thin[2] + (thick[2] - thin[2]) * t;
            pixels[offset + 3] = 255 * (1 - Math.exp(-5.0 * d));
          }
          if (performance.now() - start >= maxMs) break;
        }
        const elapsed = performance.now() - start;
        stats.chunks++;
        stats.cpuMs += elapsed;
        stats.maxChunkMs = Math.max(stats.maxChunkMs, elapsed);
        return row === size;
      },
    };
  };
  // Exercise the same generator in Node without a DOM, Canvas or GPU.
  if (typeof module === "object" && module.exports) {
    module.exports = { design, densityField, paintField, hashSeed, makeRandom };
    return;
  }

  const stacks = Array.from(document.querySelectorAll(".home-artifact-stack.has-coffee-stain"));
  if (!stacks.length) return;
  const bytes = new Uint32Array(1);
  window.crypto?.getRandomValues?.(bytes);
  const seed = new URLSearchParams(window.location.search).get("coffeeSeed") || String(bytes[0] || Math.floor(Math.random() * 0xffffffff));
  const random = makeRandom(hashSeed(`position-${seed}`)),
    number = (value) => Number(value.toFixed(2));
  stacks.forEach((stack, i) => {
    stack.style.setProperty("--home-coffee-stain-rotation", `${number(between(random, -24, 24))}deg`);
    stack.style.setProperty("--home-coffee-stain-x", `${number(between(random, -0.3, 0.45))}rem`);
    stack.style.setProperty("--home-coffee-stain-y", `${number(between(random, -0.35, 0.2))}rem`);
    stack.style.setProperty("--home-coffee-stain-scale", String(number(between(random, 0.96, 1.06))));
    stack.dataset.coffeeStainSeed = i ? `${seed}-${i}` : seed;
  });
  const box = parseFloat(getComputedStyle(stacks[0], "::before").width) || 220;
  const size = Math.min(1536, Math.max(1024, Math.ceil((box * Math.max(1, window.devicePixelRatio || 1)) / 512) * 512));
  const planStartedAt = performance.now();
  const plan = design(seed, size),
    paletteFor = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const planMs = performance.now() - planStartedAt;
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const dryIn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && (!navigator.webdriver || forceLive);
  let density = null,
    field = null,
    washField = null,
    washUrl = null,
    washPalette = null,
    pixels = null,
    paletteJob = null,
    encoding = false,
    started = false,
    dried = false,
    settled = !dryIn,
    fallback = false,
    pending = false;
  const startedAt = performance.now(),
    canvas = document.createElement("canvas");
  const evidence = {
    version: 2,
    seed,
    size,
    fieldBytes: size * size * 4 * (dryIn ? 2 : 1),
    rgbaBytes: size * size * 4,
    profileBytes: BINS * 5 * 4,
    planMs,
    setupMs: 0,
    rgbaAllocationMs: 0,
    canvasPutMs: 0,
    pngAndReadWallMs: 0,
    density: null,
    palette: null,
    encodedBytes: 0,
    morphology: "seeded wash and pinned pigment; authored deposition, not fluid simulation",
  };
  stacks.forEach((stack) => (stack.coffeeStainEvidence = evidence));
  // A timer backstop also services missing/starved idle callbacks. Both density
  // generation and palette conversion yield after a small bounded row batch.
  const later = (callback) => {
    let called = false,
      idle = 0;
    const run = () => {
      if (called) return;
      called = true;
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback?.(idle);
      callback();
    };
    const timer = window.setTimeout(run, 48);
    if (window.requestIdleCallback) idle = window.requestIdleCallback(run, { timeout: 80 });
  };
  const queueWork = () => {
    if (pending) return;
    pending = true;
    later(() => {
      pending = false;
      work();
    });
  };
  const finishDrying = () => {
    if (settled) return;
    settled = true;
    washField = null;
    washUrl = null;
    stacks.forEach((stack) => {
      stack.style.removeProperty("--home-coffee-stain-wash-image");
      stack.removeAttribute("data-coffee-stain-wash");
      stack.setAttribute("data-coffee-stain-settled", "true");
    });
  };
  stacks.forEach((stack) =>
    stack.addEventListener("animationend", (event) => {
      if (event.animationName === "home-coffee-stain-settle") finishDrying();
    })
  );
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (event) => {
    if (event.matches) finishDrying();
  });
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
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startDrying();
        }
      },
      { threshold: 0.25 }
    );
    stacks.forEach((stack) => observer.observe(stack));
  };
  const publish = (url, source) => {
    stacks.forEach((stack) => {
      if (washUrl && !settled) {
        stack.style.setProperty("--home-coffee-stain-wash-image", `url("${washUrl}")`);
        stack.setAttribute("data-coffee-stain-wash", "true");
      }
      stack.style.setProperty("--home-coffee-stain-image", `url("${url}")`);
      stack.setAttribute("data-coffee-stain-ready", "true");
      stack.setAttribute("data-coffee-stain-source", source);
      stack.setAttribute("data-coffee-stain-resolution", String(source === "raster-fallback" ? 512 : size));
    });
    if (dryIn && !dried && !settled) watchForView();
  };
  const recover = () => {
    if (fallback) return;
    finishDrying();
    fallback = true;
    field = washField = pixels = paletteJob = density = null;
    canvas.width = canvas.height = 0;
    const script =
      document.querySelector('script[src*="home-coffee-stain"]')?.src || new URL("assets/js/home-coffee-stain.js", document.baseURI).href;
    // The retained image is only a last resort if Canvas/encoding fails.
    publish(new URL("../img/home/coffee-deposit-20261028-c91b57ee8c.webp", script).href, "raster-fallback");
  };
  const work = () => {
    if (fallback) return;
    try {
      if (!field) {
        if (!density) {
          const began = performance.now();
          density = densityField(plan, { wet: dryIn && !settled });
          evidence.setupMs = performance.now() - began;
          evidence.fieldBytes = density.field.byteLength + (density.washField?.byteLength || 0);
        }
        if (density.step()) {
          field = density.field;
          washField = settled ? null : density.washField;
          evidence.density = { ...density.stats };
          density = null;
        }
        queueWork();
        return;
      }
      if (encoding) return;
      const palette = paletteFor();
      const mode = washField && !settled && (!washUrl || washPalette !== palette) ? "wash" : "dry";
      if (!pixels) {
        const began = performance.now();
        pixels = new Uint8ClampedArray(size * size * 4);
        evidence.rgbaAllocationMs = performance.now() - began;
      }
      if (!paletteJob || paletteJob.palette !== palette || paletteJob.mode !== mode)
        paletteJob = { ...paintField(plan, mode === "wash" ? washField : field, palette, pixels), palette, mode };
      if (!paletteJob.step()) {
        queueWork();
        return;
      }
      pixels = paletteJob.pixels;
      evidence.palette = { ...paletteJob.stats };
      paletteJob = null;
      encoding = true;
      const canvasStartedAt = performance.now();
      canvas.width = canvas.height = size;
      canvas.getContext("2d").putImageData(new ImageData(pixels, size, size), 0, 0);
      evidence.canvasPutMs += performance.now() - canvasStartedAt;
      const encodeStartedAt = performance.now();
      const complete = (url) => {
        evidence.pngAndReadWallMs += performance.now() - encodeStartedAt;
        encoding = false;
        if (palette !== paletteFor()) {
          queueWork();
          return;
        }
        if (mode === "wash") {
          washUrl = url;
          washPalette = palette;
          queueWork();
          return;
        }
        evidence.readyAfterMs = performance.now() - startedAt;
        evidence.paintedPalette = palette;
        publish(url, "procedural");
        canvas.width = canvas.height = 1;
      };
      canvas.toBlob((blob) => {
        if (!blob) {
          try {
            complete(canvas.toDataURL("image/png"));
          } catch {
            recover();
          }
          return;
        }
        evidence.encodedBytes = blob.size;
        const reader = new FileReader();
        reader.onload = () => complete(reader.result);
        reader.onerror = recover;
        reader.readAsDataURL(blob);
      }, "image/png");
    } catch {
      recover();
    }
  };
  const start = () => {
    if (started) return;
    started = true;
    queueWork();
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "320px 0px" }
    );
    stacks.forEach((stack) => observer.observe(stack));
  } else start();
  window.addEventListener("siteThemeChange", () => {
    if (field && !fallback && !encoding && paletteFor() !== evidence.paintedPalette) queueWork();
  });
})();
