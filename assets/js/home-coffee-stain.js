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

  const encodeSvg = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22")}")`;

  const number = (value) => Number(value.toFixed(2));
  const between = (random, min, max) => min + random() * (max - min);

  // A coffee ring shaped by how one dries (Deegan et al., Nature 1997): capillary flow carries the
  // coffee to the pinned edge, so the rim is dark and sharp outside and fades inward, thickest where
  // the drop pooled. Stick-slip leaves partial tide lines inside; the interior is a faint, uneven
  // tint; a second, partial ring marks the cup set down again; drips get their own little rims. The
  // evening palette is lighter, like dried coffee on a dark desk.
  const createStainSvg = (seedLabel, palette = "light") => {
    const seed = hashSeed(seedLabel);
    const random = makeRandom(seed);
    const between = (min, max) => min + random() * (max - min);
    const n = (value) => Number(value.toFixed(2));
    const colors =
      palette === "dark"
        ? { edge: "#e2c39f", band: "#c99e74", tide: "#d8b48d", wash: "#a98463", drip: "#e8cba8" }
        : { edge: "#5b2c12", band: "#7c4420", tide: "#8e5529", wash: "#c18d5a", drip: "#6a3518" };

    const cx = between(178, 198),
      cy = between(178, 198),
      R = between(128, 142),
      squash = between(0.93, 1.0),
      tilt = between(0, Math.PI * 2);
    // Gentle low-frequency wobble: a real cup rim on paper is round but never a perfect circle.
    const waves = [1, 2, 3, 5].map((k) => ({ k, a: between(0.004, 0.014) / Math.sqrt(k), p: between(0, Math.PI * 2) }));
    const radiusAt = (theta, scale = 1, shift = 0) =>
      R * scale * (1 + waves.reduce((sum, w) => sum + w.a * Math.cos(w.k * (theta + shift) + w.p), 0));
    const pointAt = (theta, r, ox = cx, oy = cy) => {
      const x = Math.cos(theta) * r,
        y = Math.sin(theta) * r * squash;
      return [ox + x * Math.cos(tilt) - y * Math.sin(tilt), oy + x * Math.sin(tilt) + y * Math.cos(tilt)];
    };
    const STEPS = 144;
    const contour = (radiusOf, ox, oy, from = 0, span = Math.PI * 2) => {
      const pts = [];
      const steps = Math.max(8, Math.round((STEPS * span) / (Math.PI * 2)));
      for (let i = 0; i <= steps; i++) {
        const theta = from + (span * i) / steps;
        pts.push(pointAt(theta, radiusOf(theta), ox, oy));
      }
      return pts;
    };
    const pathOf = (pts, close = true) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")}${close ? " Z" : ""}`;

    // The rim: thicker where the drop pooled (pool angle), thin on the far side.
    const pool = between(0, Math.PI * 2),
      width = R * between(0.04, 0.055);
    const rimWidth = (theta) => width * (0.55 + 0.75 * Math.pow(0.5 + 0.5 * Math.cos(theta - pool), 1.6));
    const outer = contour((t) => radiusAt(t)),
      inner = contour((t) => radiusAt(t) - rimWidth(t)).reverse(),
      fadeInner = contour((t) => radiusAt(t) - rimWidth(t) * 2.6).reverse();
    const band = `${pathOf(outer)} ${pathOf(inner)}`;
    const fade = `${pathOf(contour((t) => radiusAt(t) - rimWidth(t) * 0.9))} ${pathOf(fadeInner)}`;

    // Stick-slip tide lines: partial, thin, inside the rim.
    const tides = [];
    const tideCount = 1 + Math.floor(random() * 2);
    for (let i = 0; i < tideCount; i++) {
      const scale = between(0.78, 0.92),
        from = between(0, Math.PI * 2),
        span = between(Math.PI * 1.1, Math.PI * 1.9);
      tides.push(
        `<path d="${pathOf(
          contour((t) => radiusAt(t, scale, 0.3), cx + between(-3, 3), cy + between(-3, 3), from, span),
          false
        )}" fill="none" stroke="${colors.tide}" stroke-width="${n(
          between(0.7, 1.3)
        )}" stroke-linecap="round" opacity="${n(between(0.22, 0.36))}" filter="url(#fiber)"/>`
      );
    }

    // A second, partial ring where the cup was set down again, fading out at both ends.
    let second = "";
    if (random() > 0.35) {
      const angle = between(0, Math.PI * 2),
        offset = R * between(0.24, 0.4);
      const ox = cx + Math.cos(angle) * offset,
        oy = cy + Math.sin(angle) * offset;
      const from = angle - between(0.9, 1.4),
        span = between(Math.PI * 0.6, Math.PI * 1.1);
      const pts = contour((t) => radiusAt(t, between(0.97, 0.99), 0.7), ox, oy, from, span);
      const [x0, y0] = pts[0],
        [x1, y1] = pts.at(-1);
      second = `<linearGradient id="arcfade" gradientUnits="userSpaceOnUse" x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}">
      <stop offset="0" stop-color="${colors.band}" stop-opacity="0"/><stop offset=".35" stop-color="${colors.band}" stop-opacity="1"/>
      <stop offset=".7" stop-color="${colors.band}" stop-opacity="1"/><stop offset="1" stop-color="${colors.band}" stop-opacity="0"/></linearGradient>
      <path d="${pathOf(pts, false)}" fill="none" stroke="url(#arcfade)" stroke-width="${n(between(2.2, 3.6))}" stroke-linecap="round" opacity="${n(between(0.32, 0.46))}" filter="url(#fiber)"/>`;
    }

    // Drips: tiny drops, each with its own darker rim (the same capillary effect at small scale).
    const drips = [];
    const dripCount = 2 + Math.floor(random() * 4);
    for (let i = 0; i < dripCount; i++) {
      const theta = pool + between(-1.1, 1.1),
        r = radiusAt(theta) * between(1.06, 1.32);
      const [x, y] = pointAt(theta, r);
      const size = between(1.6, 6.5) * (i === 0 ? 1.3 : 1);
      drips.push(
        `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(size)}" ry="${n(size * between(0.75, 1))}" transform="rotate(${n(between(0, 180))} ${n(x)} ${n(y)})" fill="${colors.wash}" fill-opacity=".35" stroke="${colors.drip}" stroke-width="${n(
          between(0.6, 1.1)
        )}" stroke-opacity=".75" filter="url(#fiber)"/>`
      );
    }
    // One splash streak leaving the rim on the pooled side.
    const theta = pool + between(-0.5, 0.5);
    const [sx, sy] = pointAt(theta, radiusAt(theta) * 0.99),
      [ex, ey] = pointAt(theta + between(-0.08, 0.08), radiusAt(theta) * between(1.1, 1.18));
    const streak = `<path d="M${n(sx)} ${n(sy)} Q${n((sx + ex) / 2 + between(-4, 4))} ${n((sy + ey) / 2 + between(-4, 4))} ${n(ex)} ${n(ey)}" fill="none" stroke="${colors.band}" stroke-width="${n(
      between(1.6, 2.8)
    )}" stroke-linecap="round" opacity="${n(between(0.3, 0.45))}" filter="url(#fiber)"/>`;

    const noiseSeed = seed % 997;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 380" role="img" aria-label="Procedural coffee ring stain">
  <defs>
    <filter id="fiber" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.32 0.14" numOctaves="2" seed="${noiseSeed}" result="grain"/>
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="${n(between(1.6, 2.4))}" result="moved"/>
      <feGaussianBlur in="moved" stdDeviation="0.35"/>
    </filter>
    <filter id="mottle" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="${(noiseSeed + 11) % 997}" result="clouds"/>
      <feColorMatrix in="clouds" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0.45" result="patch"/>
      <feComposite in="SourceGraphic" in2="patch" operator="in"/>
    </filter>
    <radialGradient id="pool" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}">
      <stop offset="0" stop-color="${colors.wash}" stop-opacity=".35"/>
      <stop offset=".72" stop-color="${colors.wash}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${colors.band}" stop-opacity=".9"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="1.4"/></filter>
    ${second ? second.slice(0, second.indexOf("</linearGradient>") + "</linearGradient>".length) : ""}
  </defs>
  <path d="${pathOf(contour((t) => radiusAt(t) - rimWidth(t) * 0.5))}" fill="url(#pool)" opacity="${n(between(0.16, 0.22))}" filter="url(#mottle)"/>
  <path d="${fade}" fill="${colors.band}" fill-rule="evenodd" opacity="${n(between(0.1, 0.16))}" filter="url(#soft)"/>
  <path d="${band}" fill="${colors.band}" fill-rule="evenodd" opacity="${n(between(0.46, 0.58))}" filter="url(#fiber)"/>
  <path d="${pathOf(outer)}" fill="none" stroke="${colors.edge}" stroke-width="${n(between(1.1, 1.6))}" stroke-linejoin="round" opacity="${n(between(0.66, 0.82))}" filter="url(#fiber)"/>
  ${tides.join("")}
  ${second ? second.slice(second.indexOf("</linearGradient>") + "</linearGradient>".length) : ""}
  ${streak}
  ${drips.join("")}
</svg>`;
  };

  const seed = randomSeed();
  const random = makeRandom(hashSeed(`position-${seed}`));
  const paletteFor = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  let palette = paletteFor();
  const image = () => encodeSvg(createStainSvg(seed, palette));
  window.addEventListener("siteThemeChange", () => {
    if (paletteFor() === palette) return;
    palette = paletteFor();
    const next = image();
    stacks.forEach((stack) => stack.style.setProperty("--home-coffee-stain-image", next));
  });

  const first = image();
  stacks.forEach((stack, index) => {
    stack.style.setProperty("--home-coffee-stain-image", first);
    stack.style.setProperty("--home-coffee-stain-rotation", `${number(between(random, -16, -5))}deg`);
    stack.style.setProperty("--home-coffee-stain-x", `${number(between(random, 0.38, 0.82))}rem`);
    stack.style.setProperty("--home-coffee-stain-y", `${number(between(random, -0.7, -0.28))}rem`);
    stack.style.setProperty("--home-coffee-stain-scale", String(number(between(random, 1.03, 1.13))));
    stack.dataset.coffeeStainSeed = index === 0 ? seed : `${seed}-${index}`;
  });
})();
