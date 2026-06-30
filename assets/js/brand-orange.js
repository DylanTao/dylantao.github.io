(function () {
  const STORAGE_KEY = "sirui-brand-orange-seed-v2";
  const SVG_NS = "http://www.w3.org/2000/svg";

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function next() {
      let value = (seed += 0x6d2b79f5);
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getStoredSeed() {
    try {
      const stored = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (stored) return hashString(stored);

      const fresh = String(Date.now()) + ":" + Math.random().toString(36).slice(2);
      window.localStorage && window.localStorage.setItem(STORAGE_KEY, fresh);
      return hashString(fresh);
    } catch (error) {
      return hashString(window.location.pathname || "sirui-tao");
    }
  }

  function randomBetween(random, min, max) {
    return min + (max - min) * random();
  }

  function makeBlobPath(random) {
    const cx = 32;
    const cy = 35;
    const rx = randomBetween(random, 19.2, 20.9);
    const ry = randomBetween(random, 19.1, 20.8);
    const points = [];

    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
      const organic = randomBetween(random, 0.965, 1.045);
      const x = cx + Math.cos(angle) * rx * organic;
      const y = cy + Math.sin(angle) * ry * organic;
      points.push({ x, y });
    }

    const start = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
    let path = `M${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

    for (let index = 1; index <= points.length; index += 1) {
      const current = points[index % points.length];
      const next = points[(index + 1) % points.length];
      const midpoint = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      };
      path += `Q${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midpoint.x.toFixed(2)} ${midpoint.y.toFixed(2)}`;
    }

    return `${path}Z`;
  }

  function pointInsideFruit(random) {
    const radius = Math.sqrt(random()) * randomBetween(random, 0.24, 0.78);
    const angle = randomBetween(random, 0, Math.PI * 2);
    return {
      x: 32 + Math.cos(angle) * 17.8 * radius,
      y: 35 + Math.sin(angle) * 16.8 * radius,
    };
  }

  function rebuildPores(mark, random) {
    const pores = mark.querySelector("[data-brand-pores]");
    if (!pores) return;
    pores.textContent = "";

    const count = Math.round(randomBetween(random, 5, 9));
    for (let index = 0; index < count; index += 1) {
      const point = pointInsideFruit(random);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("class", "brand-orange-pore");
      circle.setAttribute("cx", point.x.toFixed(2));
      circle.setAttribute("cy", point.y.toFixed(2));
      circle.setAttribute("r", randomBetween(random, 0.32, 0.62).toFixed(2));
      circle.setAttribute("opacity", randomBetween(random, 0.16, 0.3).toFixed(2));
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
    const bottomX = waistX - normalX * width * 0.78;
    const bottomY = waistY - normalY * width * 0.78;
    return [
      `M${baseX.toFixed(2)} ${baseY.toFixed(2)}`,
      `C${topX.toFixed(2)} ${topY.toFixed(2)} ${(tipX - cos * length * 0.22).toFixed(2)} ${(tipY - sin * length * 0.18).toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
      `C${bottomX.toFixed(2)} ${bottomY.toFixed(2)} ${(baseX + cos * length * 0.2).toFixed(2)} ${(baseY + sin * length * 0.12).toFixed(2)} ${baseX.toFixed(2)} ${baseY.toFixed(2)}Z`,
    ].join("");
  }

  function rebuildLeaves(mark, random) {
    const leaves = mark.querySelector("[data-brand-leaves]");
    if (!leaves) return;
    leaves.textContent = "";

    const leafCount = random() < 0.78 ? 1 : 2;

    for (let index = 0; index < leafCount; index += 1) {
      const path = document.createElementNS(SVG_NS, "path");
      const side = index === 0 ? 1 : -1;
      const angle = randomBetween(random, -0.9, -0.46) * side + (side < 0 ? Math.PI : 0);
      const baseX = randomBetween(random, 30.8, 34.4);
      const baseY = randomBetween(random, 14.3, 16.1);
      const length = randomBetween(random, 14.4, 18.2);
      const width = randomBetween(random, 4.2, 6.0);
      const curve = randomBetween(random, -1.1, 1.4);
      path.setAttribute("class", `brand-orange-leaf brand-orange-leaf-${index === 0 ? "a" : "b"}`);
      path.setAttribute("d", makeLeafPath(baseX, baseY, length, width, angle, curve));
      path.style.animationDelay = `${randomBetween(random, -5.6, -0.4).toFixed(2)}s`;
      leaves.appendChild(path);
    }
  }

  function enhanceMark(mark, seed) {
    const random = mulberry32(seed);
    const body = mark.querySelector("[data-brand-body]");
    const bodyClip = mark.querySelector("[data-brand-body-clip]");
    const highlight = mark.querySelector("[data-brand-highlight]");

    const bodyPath = makeBlobPath(random);
    if (body) body.setAttribute("d", bodyPath);
    if (bodyClip) bodyClip.setAttribute("d", bodyPath);
    if (highlight) {
      const startX = randomBetween(random, 18.2, 21.4);
      const startY = randomBetween(random, 24.2, 27.2);
      const endX = randomBetween(random, 27.4, 30.8);
      const endY = randomBetween(random, 18.8, 22.0);
      highlight.setAttribute(
        "d",
        `M${startX.toFixed(2)} ${startY.toFixed(2)}C${(startX + 1.2).toFixed(2)} ${(startY - 3.7).toFixed(2)} ${(endX - 4.2).toFixed(2)} ${(endY - 1.2).toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`
      );
    }

    rebuildPores(mark, random);
    rebuildLeaves(mark, random);
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
    const seed = getStoredSeed();
    marks.forEach(function (mark, index) {
      enhanceMark(mark, seed + index * 97);
      setupInteraction(mark, reduceMotion);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
