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

  // A coffee ring painted like watercolour, new on every visit. Each mark follows how coffee dries
  // (Deegan et al., Nature 1997): the liquid's edge stays pinned while it evaporates, so coffee flows
  // out to it and the edge dries dark and sharp, fading inward. A mug's foot leaves a wet ring that
  // is heavier where the coffee pooled and breaks where the foot sat dry; a second placement leaves
  // a fainter ring; pooled coffee and spills dry as washes with dark edges and the thin veins of a
  // backrun; splashes land on one side. The paper's grain and uneven drying run through all of it.

  // Tileable value-noise fbm, sampled bilinearly with wrap.
  const noiseField = (random, size, octaves, firstCells, falloff = 0.55) => {
    const out = new Float32Array(size * size);
    let amp = 1,
      total = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      const cells = firstCells << octave;
      const lattice = new Float32Array(cells * cells);
      for (let i = 0; i < lattice.length; i += 1) lattice[i] = random();
      for (let y = 0; y < size; y += 1) {
        const fy = (y / size) * cells,
          y0 = Math.floor(fy),
          ty = fy - y0,
          sy = ty * ty * (3 - 2 * ty),
          y1 = (y0 + 1) % cells;
        for (let x = 0; x < size; x += 1) {
          const fx = (x / size) * cells,
            x0 = Math.floor(fx),
            tx = fx - x0,
            sx = tx * tx * (3 - 2 * tx),
            x1 = (x0 + 1) % cells;
          const a = lattice[y0 * cells + x0],
            b = lattice[y0 * cells + x1],
            c = lattice[y1 * cells + x0],
            d = lattice[y1 * cells + x1];
          const top = a + (b - a) * sx;
          out[y * size + x] += amp * (top + (c + (d - c) * sx - top) * sy);
        }
      }
      total += amp;
      amp *= falloff;
    }
    for (let i = 0; i < out.length; i += 1) out[i] /= total;
    return (x, y) => {
      x = ((x % size) + size) % size;
      y = ((y % size) + size) % size;
      const x0 = x | 0,
        y0 = y | 0,
        tx = x - x0,
        ty = y - y0,
        x1 = (x0 + 1) % size,
        y1 = (y0 + 1) % size;
      const a = out[y0 * size + x0],
        b = out[y0 * size + x1],
        c = out[y1 * size + x0],
        d = out[y1 * size + x1];
      const top = a + (b - a) * tx;
      return top + (c + (d - c) * tx - top) * ty;
    };
  };

  // A periodic function of angle with a pink spectrum, tabulated, roughly in [-1, 1].
  const ANGLES = 1024;
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
    const table = new Float32Array(ANGLES);
    for (let i = 0; i < ANGLES; i += 1) {
      const t = (i / ANGLES) * TAU;
      let sum = 0;
      for (let j = 0; j < ks.length; j += 1) sum += amps[j] * Math.cos(ks[j] * t + phases[j]);
      table[i] = sum / norm;
    }
    return table;
  };
  const angleIndex = (dx, dy) => {
    let t = Math.atan2(dy, dx);
    if (t < 0) t += TAU;
    const i = (t * (ANGLES / TAU)) | 0;
    return i >= ANGLES ? ANGLES - 1 : i;
  };

  // The ring a mug's foot leaves: an annulus with a pinned outer edge, dark and sharp there, fading to
  // a softer inner edge, with thin tide lines where the drying front paused.
  const makeRing = (random, o) => {
    const { cx, cy, R, strength, cover, px, pool, squash } = o;
    const shape = periodic(random, 2, 6, 1.1),
      fringe = periodic(random, 24, 32, 0.5),
      widthN = periodic(random, 1, 7, 1.0),
      coverN = periodic(random, 1, 5, 0.8),
      darkN = periodic(random, 1, 9, 0.8),
      tideN = periodic(random, 1, 5, 1),
      tideCover = periodic(random, 1, 4, 0.8);
    const W0 = R * o.width,
      outerEdge = new Float32Array(ANGLES),
      width = new Float32Array(ANGLES),
      darkOuter = new Float32Array(ANGLES),
      darkInner = new Float32Array(ANGLES),
      wash = new Float32Array(ANGLES),
      tideAt = new Float32Array(ANGLES),
      tideAmp = new Float32Array(ANGLES);
    for (let i = 0; i < ANGLES; i += 1) {
      const t = (i / ANGLES) * TAU,
        pooled = Math.pow(0.5 + 0.5 * Math.cos(t - pool), 2.2);
      const c = smooth(cover[0], cover[1], 0.5 + 0.5 * coverN[i] + 0.25 * pooled);
      outerEdge[i] = R * (1 + o.wobble * shape[i]) + px * 0.6 * fringe[i];
      width[i] = W0 * (0.55 + 0.3 * widthN[i] + 0.95 * pooled) * c;
      darkOuter[i] = strength * (0.6 + 0.32 * darkN[i] + 0.22 * pooled) * Math.sqrt(c);
      darkInner[i] = strength * (0.26 + 0.16 * darkN[(i + 150) % ANGLES]) * c;
      wash[i] = strength * (0.17 + 0.07 * widthN[(i + 350) % ANGLES] + 0.12 * pooled) * c;
      tideAt[i] = 0.38 + 0.24 * tideN[i];
      tideAmp[i] = strength * 0.3 * smooth(0.2, 0.65, 0.5 + 0.5 * tideCover[i]) * c;
    }
    const outer = R * (1 + o.wobble) + 4 * px,
      inner = Math.max(0, R * (1 - o.wobble - o.width * 2.6) - 6 * px);
    return {
      bounds: [cx - outer, cy - outer, cx + outer, cy + outer],
      may(x, y) {
        const dx = x - cx,
          dy = (y - cy) / squash,
          r2 = dx * dx + dy * dy;
        return r2 < outer * outer && r2 > inner * inner;
      },
      density(x, y, warpX, warpY, feather) {
        const dx = x + warpX - cx,
          dy = (y + warpY - cy) / squash,
          r = Math.sqrt(dx * dx + dy * dy);
        const i = angleIndex(dx, dy),
          u = outerEdge[i] - r,
          w = width[i] * (0.8 + 0.4 * feather);
        if (w <= 0.05 * px) return 0;
        if (u < 0) return darkOuter[i] * 0.6 * Math.exp(u / (0.6 * px)); // a fibrous bleed past the pinned edge
        if (u > w + 4 * px) return 0;
        const edgeIn = Math.min(1, Math.max(0, (w - u) / (1.4 * px) + 0.5));
        const tide = tideAmp[i] * Math.exp(-Math.pow((u - w * tideAt[i]) / (0.75 * px), 2));
        return (wash[i] + darkOuter[i] * Math.exp(-u / (1.9 * px)) + darkInner[i] * Math.exp(-(w - u) / (1.8 * px)) + tide) * edgeIn;
      },
    };
  };

  // A drop, a spill or a puddle: the same edge darkening at its own scale around a lighter middle.
  // Wide washes dry heavier toward the edge, blotchy, and veined where the drying front backran.
  const makeBlob = (random, o) => {
    const { cx, cy, R, px } = o;
    const shape = periodic(random, 2, o.lumpy ? 9 : 4, o.lumpy ? 0.85 : 1.4),
      amount = o.lumpy ? 0.17 : 0.07;
    const edge = new Float32Array(ANGLES);
    for (let i = 0; i < ANGLES; i += 1) edge[i] = R * (1 + amount * shape[i]);
    const stretch = o.stretch || 1,
      reach = R * (1 + amount) * stretch + 3 * px,
      cos = Math.cos(o.angle || 0),
      sin = Math.sin(o.angle || 0),
      decay = Math.max(0.8 * px, R * o.decay);
    return {
      bounds: [cx - reach, cy - reach, cx + reach, cy + reach],
      may(x, y) {
        const dx = x - cx,
          dy = y - cy;
        return dx * dx + dy * dy < reach * reach;
      },
      density(x, y, warpX, warpY, feather) {
        const wx = x + warpX * o.warp - cx,
          wy = y + warpY * o.warp - cy;
        const dx = (wx * cos + wy * sin) / stretch,
          dy = -wx * sin + wy * cos;
        const r = Math.sqrt(dx * dx + dy * dy);
        const u = edge[angleIndex(dx, dy)] - r;
        if (u < 0) return o.rim * 0.55 * Math.exp(u / (0.55 * px));
        const toward = Math.exp(-u / (R * 0.35));
        let wash = o.fill * (0.45 + 0.55 * toward) * (0.55 + 0.9 * feather);
        if (o.lumpy) wash += o.fill * 1.6 * Math.exp(-Math.pow((feather - o.vein) / 0.018, 2)) * (1 - toward * 0.6);
        return (wash + o.rim * Math.exp(-u / decay)) * Math.min(1, u / (0.9 * px) + 0.5);
      },
    };
  };

  // Lay out one stain for a size x size canvas in two idle slices (the paper's noise, then the
  // shapes); rows are filled later, a slice at a time.
  const layout = (seedLabel, size) => {
    const random = makeRandom(hashSeed(String(seedLabel)));
    const rand = (min, max) => between(random, min, max);
    const px = size / 400; // one pixel of a 400 px design canvas
    const mottle = noiseField(random, 128, 4, 3),
      warp = noiseField(random, 64, 3, 2),
      grain = noiseField(random, 64, 2, 16, 0.6);
    return () => shapes(random, rand, px, size, mottle, warp, grain);
  };

  const shapes = (random, rand, px, size, mottle, warp, grain) => {
    const features = [];
    const R = size * rand(0.3, 0.35),
      cx = size * rand(0.47, 0.53),
      cy = size * rand(0.47, 0.53),
      pool = rand(0, TAU);
    features.push(
      makeRing(random, {
        cx,
        cy,
        R,
        px,
        pool,
        squash: rand(0.95, 1),
        wobble: rand(0.012, 0.026),
        strength: rand(0.85, 1),
        width: rand(0.08, 0.125),
        cover: [rand(0.02, 0.18), rand(0.28, 0.42)],
      })
    );
    if (random() < 0.6) {
      const r = R * rand(0.32, 0.5),
        d = R - r * rand(0.55, 0.85);
      features.push(
        makeBlob(random, {
          cx: cx + Math.cos(pool) * d,
          cy: cy + Math.sin(pool) * d,
          R: r,
          px,
          lumpy: true,
          fill: rand(0.08, 0.13),
          rim: rand(0.42, 0.6),
          decay: 0.035,
          warp: 1.4,
          vein: rand(0.42, 0.58),
        })
      );
    }
    if (random() < 0.55) {
      const a = rand(0, TAU),
        off = R * rand(0.1, 0.28);
      features.push(
        makeRing(random, {
          cx: cx + Math.cos(a) * off,
          cy: cy + Math.sin(a) * off,
          R: R * rand(0.97, 1.03),
          px,
          pool: pool + rand(-1, 1),
          squash: rand(0.95, 1),
          wobble: rand(0.012, 0.024),
          strength: rand(0.4, 0.62),
          width: rand(0.045, 0.075),
          cover: [rand(0.32, 0.48), rand(0.58, 0.72)],
        })
      );
    }
    const side = pool + rand(-1.2, 1.2);
    if (random() < 0.45) {
      const a = side + rand(-0.4, 0.4),
        d = R * rand(1.0, 1.15);
      features.push(
        makeBlob(random, {
          cx: cx + Math.cos(a) * d,
          cy: cy + Math.sin(a) * d,
          R: R * rand(0.1, 0.18),
          px,
          lumpy: true,
          fill: rand(0.14, 0.22),
          rim: rand(0.6, 0.8),
          decay: 0.05,
          warp: 1,
          vein: rand(0.42, 0.58),
        })
      );
    }
    const drops = 4 + Math.floor(random() * 9);
    for (let k = 0; k < drops; k += 1) {
      const a = side + rand(-0.85, 0.85),
        d = R * rand(1.08, 1.55),
        r = px * (k < 2 ? rand(3.2, 6.5) : rand(0.8, 2.6));
      features.push(
        makeBlob(random, {
          cx: cx + Math.cos(a) * d,
          cy: cy + Math.sin(a) * d,
          R: r,
          px,
          lumpy: false,
          fill: rand(0.22, 0.4),
          rim: rand(0.5, 0.8),
          decay: 0.25,
          warp: 0.3,
          angle: a,
          stretch: random() < 0.35 ? rand(1.4, 2.4) : 1,
        })
      );
    }
    return {
      size,
      features,
      density: new Float32Array(size * size),
      brew: random(),
      fillRow(y) {
        const mottleScale = 128 / (size * 0.5),
          warpScale = 64 / (size * 0.32),
          grainScale = 64 / (size * 0.11),
          warpAmount = 3.4 * px,
          count = features.length;
        for (let x = 0; x < size; x += 1) {
          let need = false;
          for (let f = 0; f < count; f += 1) {
            const b = features[f].bounds;
            if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && features[f].may(x, y)) {
              need = true;
              break;
            }
          }
          if (!need) continue;
          const wx = (warp(x * warpScale, y * warpScale) - 0.5) * 2 * warpAmount,
            wy = (warp(x * warpScale + 31.7, y * warpScale + 17.3) - 0.5) * 2 * warpAmount,
            m = mottle(x * mottleScale, y * mottleScale);
          let keep = 1;
          for (let f = 0; f < count; f += 1) {
            const feature = features[f],
              b = feature.bounds;
            if (x < b[0] || x > b[2] || y < b[1] || y > b[3] || !feature.may(x, y)) continue;
            const d = feature.density(x, y, wx, wy, m);
            if (d > 0) keep *= 1 - (d < 0.995 ? d : 0.995);
          }
          if (keep === 1) continue;
          // The paper: pigment granulates in its fibres and the wash dries unevenly.
          const value = (1 - keep) * (0.7 + 0.6 * m) * (0.72 + 0.56 * grain(x * grainScale, y * grainScale));
          this.density[y * size + x] = value > 1 ? 1 : value;
        }
      },
    };
  };

  // Espresso-dark where the coffee is thick, a warm translucent amber where it is thin. Light themes
  // multiply it into the page; evening shows dried coffee as a pale residue on a dark desk.
  const paint = (field, palette) => {
    const { density, size, brew } = field;
    const pixels = new Uint8ClampedArray(size * size * 4);
    const light = palette !== "dark";
    const thin = light ? [220 - 12 * brew, 152 - 18 * brew, 80 - 16 * brew] : [158, 114, 76];
    const thick = light ? [96 - 30 * brew, 40 - 14 * brew, 10 - 4 * brew] : [236, 202, 158];
    const strength = light ? 2.3 : 1.9;
    for (let i = 0; i < density.length; i += 1) {
      const d = density[i];
      if (!d) continue;
      const t = smooth(0.06, 0.8, d),
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
  let field = null,
    painted = null;

  // The page's Content-Security-Policy admits data: images but not blob: ones, so the PNG is
  // encoded off the main thread (toBlob) and read back as a data URL.
  const show = () => {
    const palette = paletteFor();
    painted = palette;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").putImageData(paint(field, palette), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob || painted !== palette) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (painted !== palette) return;
        stacks.forEach((stack) => {
          stack.style.setProperty("--home-coffee-stain-image", `url("${reader.result}")`);
          stack.dataset.coffeeStainReady = "true";
        });
      };
      reader.readAsDataURL(blob);
    });
  };

  // Painting a stain is about 60-100 ms of arithmetic, so it runs in short slices while the
  // browser is idle and never holds up the page.
  const later = (callback) => (window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 800 }) : window.setTimeout(callback, 32));
  let row = 0,
    pending = null;
  const work = () => {
    if (!field) {
      if (pending) field = pending();
      else pending = layout(seed, size);
      later(work);
      return;
    }
    const until = performance.now() + 8;
    while (row < size && performance.now() < until) field.fillRow(row++);
    if (row < size) later(work);
    else show();
  };
  later(work);

  window.addEventListener("siteThemeChange", () => {
    if (row >= size && field && paletteFor() !== painted) show();
  });
})();
