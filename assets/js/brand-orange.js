// Grows the procedural orange specimen on the 404 page: a new shape, rind, pores, calyx and leaves on
// every visit (?orangeSeed= repeats one). The navbar mark is the fixed orange sun and needs no script.
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEBUG_QUERY_KEY = "orangeSeed";

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6d2b79f5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    const querySeed = new URLSearchParams(window.location.search).get(DEBUG_QUERY_KEY);
    if (querySeed) return querySeed;

    const bytes = new Uint32Array(2);
    window.crypto?.getRandomValues?.(bytes);
    const cryptoSeed = bytes[0] || bytes[1];
    if (cryptoSeed) return `${cryptoSeed}-${Date.now()}`;

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function randomBetween(random, min, max) {
    return min + (max - min) * random();
  }

  function number(value, precision = 2) {
    return Number(value.toFixed(precision));
  }

  function setVariantScale(mark, random) {
    mark.style.setProperty("--brand-orange-scale", number(randomBetween(random, 0.95, 1.07)));
  }

  function pointOnBody({ cx, cy, rx, ry, angle, radius = 1 }) {
    return {
      x: cx + Math.cos(angle) * rx * radius,
      y: cy + Math.sin(angle) * ry * radius,
    };
  }

  function makeBodyPath(random) {
    const cx = randomBetween(random, 31.5, 32.6);
    const cy = randomBetween(random, 34.2, 35.3);
    const rx = randomBetween(random, 18.5, 21.0);
    const ry = randomBetween(random, 18.2, 20.7);
    const harmonics = {
      a: randomBetween(random, -0.018, 0.022),
      b: randomBetween(random, -0.014, 0.018),
      c: randomBetween(random, -0.016, 0.016),
    };
    const points = [];
    const count = 18;

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const sideLift = Math.cos(angle) * randomBetween(random, -0.012, 0.012);
      const organic =
        1 +
        Math.sin(angle * 2.2 + 0.4) * harmonics.a +
        Math.cos(angle * 3.1 - 0.8) * harmonics.b +
        Math.sin(angle * 5.3) * harmonics.c +
        sideLift +
        randomBetween(random, -0.018, 0.018);
      const bottomRoundness = Math.sin(angle) > 0.68 ? randomBetween(random, -0.012, 0.012) : 0;
      points.push(pointOnBody({ cx, cy, rx, ry: ry * (1 + bottomRoundness), angle, radius: organic }));
    }

    const start = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
    let path = `M${number(start.x)} ${number(start.y)}`;

    for (let index = 1; index <= points.length; index += 1) {
      const current = points[index % points.length];
      const next = points[(index + 1) % points.length];
      const midpoint = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      };
      path += `Q${number(current.x)} ${number(current.y)} ${number(midpoint.x)} ${number(midpoint.y)}`;
    }

    return {
      path: `${path}Z`,
      cx,
      cy,
      rx,
      ry,
      top: cy - ry,
      bottom: cy + ry,
    };
  }

  function updateGradient(mark, random) {
    const gradient = mark.querySelector("[data-brand-gradient]");
    if (!gradient) return;

    const x1 = randomBetween(random, 12, 23);
    const y1 = randomBetween(random, 11, 20);
    const x2 = randomBetween(random, 43, 53);
    const y2 = randomBetween(random, 48, 57);
    gradient.setAttribute("x1", number(x1));
    gradient.setAttribute("y1", number(y1));
    gradient.setAttribute("x2", number(x2));
    gradient.setAttribute("y2", number(y2));
  }

  function pointInsideFruit(random, body, options = {}) {
    const minRadius = options.minRadius ?? 0.16;
    const maxRadius = options.maxRadius ?? 0.86;
    const radius = Math.sqrt(random()) * (maxRadius - minRadius) + minRadius;
    const angle = randomBetween(random, 0, Math.PI * 2);
    return pointOnBody({ cx: body.cx, cy: body.cy, rx: body.rx * 0.86, ry: body.ry * 0.84, angle, radius });
  }

  function poreShade(point, body) {
    const side = (point.x - body.cx) / body.rx;
    const vertical = (point.y - body.cy) / body.ry;
    return side * 0.42 + vertical * 0.34;
  }

  function rebuildPores(mark, random, body) {
    const pores = mark.querySelector("[data-brand-pores]");
    if (!pores) return;
    pores.textContent = "";

    const count = Math.round(randomBetween(random, 46, 68));
    for (let index = 0; index < count; index += 1) {
      const point = pointInsideFruit(random, body, { minRadius: 0.08, maxRadius: 0.9 });
      const circle = document.createElementNS(SVG_NS, "circle");
      const shade = poreShade(point, body);
      const shadowChance = 0.16 + Math.max(0, shade) * 0.22;
      const glintChance = 0.24 + Math.max(0, -shade) * 0.16;
      const roll = random();
      const isShadow = roll < shadowChance;
      const isGlint = !isShadow && roll < shadowChance + glintChance;
      const className = isShadow
        ? random() < 0.58
          ? "brand-orange-pore brand-orange-pore-dimple"
          : "brand-orange-pore brand-orange-pore-shadow"
        : isGlint
          ? "brand-orange-pore brand-orange-pore-glint"
          : "brand-orange-pore brand-orange-pore-soft";
      const maxRadius = isShadow ? 0.48 : isGlint ? 0.42 : 0.54;
      const minRadius = isGlint ? 0.18 : 0.22;
      const opacity = isShadow ? randomBetween(random, 0.18, 0.34) : isGlint ? randomBetween(random, 0.24, 0.46) : randomBetween(random, 0.18, 0.36);
      circle.setAttribute("class", className);
      circle.setAttribute("cx", number(point.x));
      circle.setAttribute("cy", number(point.y));
      circle.setAttribute("r", number(randomBetween(random, minRadius, maxRadius)));
      circle.style.setProperty("--brand-orange-pore-opacity", number(opacity, 3));
      pores.appendChild(circle);
    }
  }

  function makeLeafPath(baseX, baseY, length, width, angle, curve) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const normalX = -sin;
    const normalY = cos;
    const tipX = baseX + cos * length;
    const tipY = baseY + sin * length;
    const waistX = baseX + cos * length * 0.48 + normalX * curve;
    const waistY = baseY + sin * length * 0.48 + normalY * curve;
    const topX = waistX + normalX * width;
    const topY = waistY + normalY * width;
    const bottomX = waistX - normalX * width * 0.76;
    const bottomY = waistY - normalY * width * 0.76;
    return [
      `M${number(baseX)} ${number(baseY)}`,
      `C${number(topX)} ${number(topY)} ${number(tipX - cos * length * 0.22)} ${number(tipY - sin * length * 0.16)} ${number(tipX)} ${number(tipY)}`,
      `C${number(bottomX)} ${number(bottomY)} ${number(baseX + cos * length * 0.18)} ${number(baseY + sin * length * 0.13)} ${number(baseX)} ${number(baseY)}Z`,
    ].join("");
  }

  function makeLeafVein(baseX, baseY, length, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return `M${number(baseX + cos * 1.7)} ${number(baseY + sin * 1.7)}L${number(baseX + cos * length * 0.78)} ${number(baseY + sin * length * 0.78)}`;
  }

  function rebuildLeaves(mark, random, body) {
    const leaves = mark.querySelector("[data-brand-leaves]");
    if (!leaves) return;
    leaves.textContent = "";

    const roll = random();
    const leafCount = roll < 0.14 ? 0 : roll < 0.74 ? 1 : 2;
    mark.dataset.orangeLeafCount = String(leafCount);

    const sides = leafCount === 1 ? [random() < 0.68 ? 1 : -1] : [1, -1];
    sides.forEach(function (side, index) {
      const group = document.createElementNS(SVG_NS, "g");
      const path = document.createElementNS(SVG_NS, "path");
      const vein = document.createElementNS(SVG_NS, "path");
      const angle =
        side > 0
          ? randomBetween(random, (-72 * Math.PI) / 180, (-34 * Math.PI) / 180)
          : randomBetween(random, (-150 * Math.PI) / 180, (-108 * Math.PI) / 180);
      const baseX = randomBetween(random, body.cx - 1.8, body.cx + 2.2);
      const baseY = randomBetween(random, body.top - 0.7, body.top + 2.0);
      const length = randomBetween(random, 10.6, 16.2) * (leafCount === 2 ? randomBetween(random, 0.88, 1.02) : 1);
      const width = randomBetween(random, 3.1, 5.0);
      const curve = randomBetween(random, -1.0, 1.25);

      group.setAttribute("class", `brand-orange-leaf-group brand-orange-leaf-group-${index === 0 ? "a" : "b"}`);
      group.style.animationDelay = `${number(randomBetween(random, -5.6, -0.4))}s`;
      path.setAttribute("class", `brand-orange-leaf brand-orange-leaf-${index === 0 ? "a" : "b"}`);
      path.setAttribute("d", makeLeafPath(baseX, baseY, length, width, angle, curve));
      vein.setAttribute("class", "brand-orange-leaf-vein");
      vein.setAttribute("d", makeLeafVein(baseX, baseY, length, angle));
      group.appendChild(path);
      group.appendChild(vein);
      leaves.appendChild(group);
    });
  }

  function rebuildStem(mark, random, body) {
    const stem = mark.querySelector("[data-brand-stem]");
    if (!stem) return;

    const baseX = randomBetween(random, body.cx - 0.9, body.cx + 1.4);
    const baseY = randomBetween(random, body.top + 0.2, body.top + 1.6);
    const endX = baseX + randomBetween(random, 1.4, 5.2);
    const endY = baseY - randomBetween(random, 4.6, 7.2);
    const curveX = baseX + randomBetween(random, 0.1, 2.4);
    const curveY = baseY - randomBetween(random, 3.2, 5.8);
    stem.setAttribute("d", `M${number(baseX)} ${number(baseY)}Q${number(curveX)} ${number(curveY)} ${number(endX)} ${number(endY)}`);
  }

  function makeSepalPath(cx, cy, angle, length, width) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const normalX = -sin;
    const normalY = cos;
    const tipX = cx + cos * length;
    const tipY = cy + sin * length;
    return [
      `M${number(cx + normalX * width)} ${number(cy + normalY * width)}`,
      `Q${number((cx + tipX) / 2 + normalX * width * 0.3)} ${number((cy + tipY) / 2 + normalY * width * 0.3)} ${number(tipX)} ${number(tipY)}`,
      `Q${number((cx + tipX) / 2 - normalX * width * 0.26)} ${number((cy + tipY) / 2 - normalY * width * 0.26)} ${number(cx - normalX * width)} ${number(cy - normalY * width)}Z`,
    ].join("");
  }

  function rebuildCalyx(mark, random, body) {
    const calyx = mark.querySelector("[data-brand-calyx]");
    if (!calyx) return;
    calyx.textContent = "";

    const cx = randomBetween(random, body.cx - 1.1, body.cx + 1.1);
    const cy = randomBetween(random, body.top + 1.2, body.top + 2.7);
    const count = Math.round(randomBetween(random, 4, 6));
    for (let index = 0; index < count; index += 1) {
      const sepal = document.createElementNS(SVG_NS, "path");
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count + randomBetween(random, -0.12, 0.12);
      sepal.setAttribute("class", "brand-orange-calyx-sepal");
      sepal.setAttribute("d", makeSepalPath(cx, cy, angle, randomBetween(random, 2.0, 3.5), randomBetween(random, 0.55, 0.86)));
      calyx.appendChild(sepal);
    }
  }

  function rebuildNavel(mark, random, body) {
    const navel = mark.querySelector("[data-brand-navel]");
    if (!navel) return;
    navel.textContent = "";

    const cx = randomBetween(random, body.cx - 1.7, body.cx + 1.7);
    const cy = randomBetween(random, body.bottom - 5.6, body.bottom - 3.5);
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("class", "brand-orange-navel-dot");
    dot.setAttribute("cx", number(cx));
    dot.setAttribute("cy", number(cy));
    dot.setAttribute("r", number(randomBetween(random, 0.62, 1.05)));
    navel.appendChild(dot);

    const creaseCount = Math.round(randomBetween(random, 3, 5));
    for (let index = 0; index < creaseCount; index += 1) {
      const angle = (Math.PI * 2 * index) / creaseCount + randomBetween(random, -0.24, 0.24);
      const length = randomBetween(random, 1.4, 2.3);
      const crease = document.createElementNS(SVG_NS, "path");
      crease.setAttribute("class", "brand-orange-navel-crease");
      crease.setAttribute(
        "d",
        `M${number(cx)} ${number(cy)}L${number(cx + Math.cos(angle) * length)} ${number(cy + Math.sin(angle) * length * 0.78)}`
      );
      navel.appendChild(crease);
    }
  }

  function updateHighlight(mark, random, body) {
    const highlight = mark.querySelector("[data-brand-highlight]");
    if (!highlight) return;

    const start = pointOnBody({
      cx: body.cx,
      cy: body.cy,
      rx: body.rx,
      ry: body.ry,
      angle: randomBetween(random, (-168 * Math.PI) / 180, (-130 * Math.PI) / 180),
      radius: randomBetween(random, 0.62, 0.8),
    });
    const end = pointOnBody({
      cx: body.cx,
      cy: body.cy,
      rx: body.rx,
      ry: body.ry,
      angle: randomBetween(random, (-118 * Math.PI) / 180, (-82 * Math.PI) / 180),
      radius: randomBetween(random, 0.45, 0.68),
    });
    highlight.setAttribute(
      "d",
      `M${number(start.x)} ${number(start.y)}C${number(start.x + randomBetween(random, 1.1, 3.2))} ${number(start.y - randomBetween(random, 3.0, 5.1))} ${number(end.x - randomBetween(random, 3.2, 5.2))} ${number(end.y - randomBetween(random, 0.4, 2.2))} ${number(end.x)} ${number(end.y)}`
    );
    highlight.setAttribute("opacity", number(randomBetween(random, 0.42, 0.68)));
  }

  function enhanceMark(mark, seedLabel, index) {
    const seed = hashString(`${seedLabel}-${index}`);
    const random = mulberry32(seed);
    const body = mark.querySelector("[data-brand-body]");
    const bodyClip = mark.querySelector("[data-brand-body-clip]");
    const bodyShape = makeBodyPath(random);

    setVariantScale(mark, random);
    updateGradient(mark, random);
    if (body) body.setAttribute("d", bodyShape.path);
    if (bodyClip) bodyClip.setAttribute("d", bodyShape.path);

    updateHighlight(mark, random, bodyShape);
    rebuildPores(mark, random, bodyShape);
    rebuildNavel(mark, random, bodyShape);
    rebuildCalyx(mark, random, bodyShape);
    rebuildStem(mark, random, bodyShape);
    rebuildLeaves(mark, random, bodyShape);

    mark.dataset.orangeSeed = seedLabel;
    mark.classList.add("brand-orange--js");
  }

  function setupInteraction(mark, reduceMotion) {
    const link = mark.closest("a") || mark;
    if (reduceMotion) return;

    function resetTilt() {
      mark.style.setProperty("--brand-orange-tilt", "0deg");
      mark.style.setProperty("--brand-orange-nudge-x", "0px");
      mark.style.setProperty("--brand-orange-nudge-y", "0px");
      mark.classList.remove("brand-orange--pressed");
    }

    link.addEventListener("pointermove", function (event) {
      const bounds = mark.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const dx = (event.clientX - bounds.left) / bounds.width - 0.5;
      const dy = (event.clientY - bounds.top) / bounds.height - 0.5;

      mark.style.setProperty("--brand-orange-tilt", `${(dx * 7).toFixed(2)}deg`);
      mark.style.setProperty("--brand-orange-nudge-x", `${(dx * 0.42).toFixed(2)}px`);
      mark.style.setProperty("--brand-orange-nudge-y", `${(dy * 0.32).toFixed(2)}px`);
    });

    link.addEventListener("pointerleave", resetTilt);
    link.addEventListener("blur", resetTilt);
    link.addEventListener("pointerdown", function () {
      mark.classList.add("brand-orange--pressed");
    });
    link.addEventListener("pointerup", resetTilt);
    link.addEventListener("pointercancel", resetTilt);
  }

  function initFloatingBrand() {
    const brand = document.querySelector("#navbar .site-brand:not([data-brand-static])");
    if (!brand) return;
    const fallback = brand.querySelector("[data-brand-discover]");
    if (!fallback) return;
    // Without JavaScript both visible identity parts remain native home links. With it, the
    // name is an actual button; touch never has to cancel a home link to tell its story.
    const name = document.createElement("button");
    name.type = "button";
    name.className = fallback.className;
    name.setAttribute("data-brand-discover", "");
    name.setAttribute("aria-label", "Let Sirui float away");
    while (fallback.firstChild) name.append(fallback.firstChild);
    fallback.replaceWith(name);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let dwell = null,
      raf = 0,
      last = null,
      painted = 0,
      elapsed = 0,
      pulseAt = -Infinity,
      visible = true;

    const waveClip = brand.querySelector(".brand-orange-wave-clip");
    const front = brand.querySelector(".brand-orange-sea");
    const fine = brand.querySelector(".brand-orange-sea-fine");
    const back = brand.querySelector(".brand-orange-sea-back");
    const frontGlint = brand.querySelector(".brand-orange-glint-front");
    const fineGlint = brand.querySelector(".brand-orange-glint-fine");
    const backGlint = brand.querySelector(".brand-orange-glint-back");
    const water = [waveClip, front, fine, back, frontGlint, fineGlint, backGlint];
    const rest = water.map((path) => path?.getAttribute("d"));

    // Cubic Hermite samples of two slow wave components. The mask and the blue/gold edge
    // consume one curve, so water really occludes the fixed sun instead of rocking its icon.
    function wavePath(left, right, level, amplitude, wavelength, phase) {
      const k = (Math.PI * 2) / wavelength;
      const secondary = 0.12 * Math.sin(elapsed * 0.23);
      const sample = (x) => ({
        y: level - amplitude * (Math.sin(x * k - phase) + secondary * Math.sin(x * k * 1.73 + phase * 0.61)),
        slope: -amplitude * k * (Math.cos(x * k - phase) + secondary * 1.73 * Math.cos(x * k * 1.73 + phase * 0.61)),
      });
      let x = left,
        point = sample(x),
        path = `M${number(x)} ${number(point.y)}`;
      while (x < right) {
        const end = Math.min(right, x + 4);
        const next = sample(end);
        const third = (end - x) / 3;
        path += `C${number(x + third)} ${number(point.y + point.slope * third)} ${number(end - third)} ${number(next.y - next.slope * third)} ${number(end)} ${number(next.y)}`;
        x = end;
        point = next;
      }
      return path;
    }
    function paintWater() {
      const phase = (elapsed * Math.PI * 2) / 5.6;
      const surge = Number.isFinite(pulseAt) ? Math.max(0, elapsed - pulseAt) : 0;
      const pulse = Number.isFinite(pulseAt) ? Math.exp(-surge * 2.8) * Math.sin(surge * Math.PI * 2.2) : 0;
      const amplitude = 1.1 + 0.65 * pulse;
      const a = wavePath(-2, 34, 19, amplitude, 25, phase);
      const b = wavePath(3, 29, 22, 0.38, 23, phase * 0.87 + 0.7);
      const c = wavePath(6, 27, 24.7, 0.56, 25, phase * 0.73 + 1.4);
      waveClip.setAttribute("d", `${a}V-20H-2Z`);
      front.setAttribute("d", a);
      fine.setAttribute("d", b);
      back.setAttribute("d", c);
      frontGlint.setAttribute("d", a);
      fineGlint.setAttribute("d", b);
      backGlint.setAttribute("d", c);
    }
    function animate(now) {
      if (last !== null) elapsed += Math.max(0, now - last) / 1000;
      last = now;
      if (now - painted >= 1000 / 30) {
        paintWater();
        painted = now;
      }
      raf = requestAnimationFrame(animate);
    }
    function finishDiscovery() {
      brand.dataset.brandState = "adrift";
      name.setAttribute("aria-label", "Make waves around the orange");
    }

    // Preserve native home navigation and the button's action name. Only decorative letters drift.
    const first = brand.querySelector(".brand-name-first");
    const comma = first.querySelector(".brand-name-comma");
    const identity = Array.from(first.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim();
    first.textContent = "";
    Array.from(identity).forEach((letter, index) => {
      const span = document.createElement("span");
      span.className = "brand-wave-letter";
      span.style.setProperty("--brand-letter", index);
      span.textContent = letter;
      first.append(span);
    });
    first.append(comma);
    let phase = 0;
    brand.querySelectorAll(".brand-name-story > span").forEach(function (line) {
      const words = line.textContent.split(" ");
      line.textContent = "";
      words.forEach(function (word, index) {
        if (index) line.append(document.createTextNode(" "));
        const group = document.createElement("span");
        group.className = "brand-wave-word";
        Array.from(word).forEach(function (letter) {
          const span = document.createElement("span");
          span.className = "brand-wave-letter";
          span.style.setProperty("--brand-letter", phase++);
          span.textContent = letter;
          group.append(span);
        });
        line.append(group);
      });
    });

    function discover() {
      if (brand.dataset.brandState) {
        if (!reduceMotion.matches && !window.siteMotion?.paused) pulseAt = elapsed;
        return;
      }
      if (reduceMotion.matches || window.siteMotion?.paused) finishDiscovery();
      else brand.dataset.brandState = "discovering";
      syncMotion();
    }

    brand.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch" || !finePointer.matches) return;
      // A page appearing beneath a stationary pointer is not a new discovery. In particular,
      // refreshing or following this home link must bring back the composed name first.
      if ((!event.movementX && !event.movementY) || dwell || brand.dataset.brandState) return;
      dwell = window.setTimeout(discover, 120);
    });
    brand.addEventListener("pointerleave", function () {
      window.clearTimeout(dwell);
      dwell = null;
    });
    brand.addEventListener("focusin", function (event) {
      if (event.target.matches(":focus-visible")) discover();
    });
    name.addEventListener("click", discover);
    brand.addEventListener("animationend", function (event) {
      if (event.animationName === "brand-name-drift" || event.animationName === "brand-compact-name-drift") finishDiscovery();
    });
    reduceMotion.addEventListener("change", function () {
      if (reduceMotion.matches && brand.dataset.brandState) finishDiscovery();
      syncMotion();
    });
    function syncMotion() {
      const paused = Boolean(window.siteMotion?.paused);
      brand.classList.toggle("brand-motion-paused", document.hidden || paused);
      if (paused && brand.dataset.brandState) finishDiscovery();
      name.setAttribute("aria-disabled", String(Boolean(brand.dataset.brandState && (paused || reduceMotion.matches))));
      cancelAnimationFrame(raf);
      last = null;
      if (reduceMotion.matches) water.forEach((path, index) => path?.setAttribute("d", rest[index]));
      if (brand.dataset.brandState && !document.hidden && !paused && !reduceMotion.matches && visible) raf = requestAnimationFrame(animate);
    }
    document.addEventListener("visibilitychange", syncMotion);
    window.addEventListener("siteMotionChange", syncMotion);
    window.addEventListener("pagehide", () => {
      cancelAnimationFrame(raf);
      last = null;
    });
    window.addEventListener("pageshow", syncMotion);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncMotion();
      });
      observer.observe(brand);
    }
    syncMotion();
  }

  function init() {
    initFloatingBrand();
    const marks = Array.from(document.querySelectorAll("[data-orange-specimen]"));
    if (!marks.length) return;

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seed = randomSeed();
    marks.forEach(function (mark, index) {
      enhanceMark(mark, seed, index);
      setupInteraction(mark, reduceMotion);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
