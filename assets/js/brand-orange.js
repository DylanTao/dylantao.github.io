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

  function hsl(hue, saturation, lightness, alpha = 1) {
    const base = `hsl(${number(hue, 1)}deg ${number(saturation, 1)}% ${number(lightness, 1)}%`;
    return alpha < 1 ? `${base} / ${number(alpha, 2)})` : `${base})`;
  }

  function setVariantColors(mark, random) {
    const hue = randomBetween(random, 24, 34);
    const saturation = randomBetween(random, 79, 91);
    const rindLightness = randomBetween(random, 48, 58);
    const leafHue = randomBetween(random, 92, 126);
    const leafSaturation = randomBetween(random, 32, 48);
    const leafLightness = randomBetween(random, 39, 50);

    mark.style.setProperty("--brand-orange-highlight", hsl(hue + randomBetween(random, 4, 12), 88, randomBetween(random, 69, 78), 0.96));
    mark.style.setProperty("--brand-orange-rind", hsl(hue, saturation, rindLightness));
    mark.style.setProperty(
      "--brand-orange-deep",
      hsl(hue - randomBetween(random, 4, 9), saturation + 2, rindLightness - randomBetween(random, 13, 19))
    );
    mark.style.setProperty("--brand-orange-outline", hsl(hue - 5, 76, Math.max(31, rindLightness - 21), 0.38));
    mark.style.setProperty("--brand-orange-detail", hsl(hue + 16, 92, 82, randomBetween(random, 0.42, 0.62)));
    mark.style.setProperty("--brand-orange-pore", hsl(hue + 8, 85, randomBetween(random, 68, 78), 0.72));
    mark.style.setProperty("--brand-orange-pore-shadow", hsl(hue - 8, 78, randomBetween(random, 31, 39), 0.3));
    mark.style.setProperty("--brand-orange-leaf", hsl(leafHue, leafSaturation, leafLightness));
    mark.style.setProperty("--brand-orange-leaf-deep", hsl(leafHue - 10, leafSaturation + 5, leafLightness - 15));
    mark.style.setProperty("--brand-orange-stem", hsl(randomBetween(random, 26, 36), randomBetween(random, 42, 56), randomBetween(random, 31, 41)));
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

  function pointInsideFruit(random, body) {
    const radius = Math.sqrt(random()) * randomBetween(random, 0.16, 0.86);
    const angle = randomBetween(random, 0, Math.PI * 2);
    return pointOnBody({ cx: body.cx, cy: body.cy, rx: body.rx * 0.86, ry: body.ry * 0.84, angle, radius });
  }

  function rebuildPores(mark, random, body) {
    const pores = mark.querySelector("[data-brand-pores]");
    if (!pores) return;
    pores.textContent = "";

    const count = Math.round(randomBetween(random, 13, 24));
    for (let index = 0; index < count; index += 1) {
      const point = pointInsideFruit(random, body);
      const circle = document.createElementNS(SVG_NS, "circle");
      const shadow = random() < 0.26;
      circle.setAttribute("class", shadow ? "brand-orange-pore brand-orange-pore-shadow" : "brand-orange-pore");
      circle.setAttribute("cx", number(point.x));
      circle.setAttribute("cy", number(point.y));
      circle.setAttribute("r", number(randomBetween(random, 0.24, shadow ? 0.42 : 0.58)));
      circle.setAttribute("opacity", number(randomBetween(random, shadow ? 0.08 : 0.14, shadow ? 0.2 : 0.34)));
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

    setVariantColors(mark, random);
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

  function init() {
    const marks = Array.from(document.querySelectorAll("[data-brand-orange]"));
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
