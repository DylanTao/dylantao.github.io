(function () {
  const STORAGE_KEY = "sirui-brand-orange-seed-v1";
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
    const rx = randomBetween(random, 19.4, 21.6);
    const ry = randomBetween(random, 19.2, 21.8);
    const points = [];

    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14 - Math.PI / 2;
      const organic = randomBetween(random, 0.93, 1.075);
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
    const radius = Math.sqrt(random()) * randomBetween(random, 0.18, 0.86);
    const angle = randomBetween(random, 0, Math.PI * 2);
    return {
      x: 32 + Math.cos(angle) * 18.5 * radius,
      y: 35 + Math.sin(angle) * 17.5 * radius,
    };
  }

  function rebuildPores(mark, random) {
    const pores = mark.querySelector("[data-brand-pores]");
    if (!pores) return;
    pores.textContent = "";

    const count = Math.round(randomBetween(random, 11, 19));
    for (let index = 0; index < count; index += 1) {
      const point = pointInsideFruit(random);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("class", "brand-orange-pore");
      circle.setAttribute("cx", point.x.toFixed(2));
      circle.setAttribute("cy", point.y.toFixed(2));
      circle.setAttribute("r", randomBetween(random, 0.34, 0.78).toFixed(2));
      circle.setAttribute("opacity", randomBetween(random, 0.1, 0.22).toFixed(2));
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

    const leafRoll = random();
    const leafCount = leafRoll < 0.14 ? 0 : leafRoll < 0.72 ? 1 : 2;
    mark.classList.toggle("brand-orange--leafless", leafCount === 0);

    for (let index = 0; index < leafCount; index += 1) {
      const path = document.createElementNS(SVG_NS, "path");
      const side = index === 0 ? 1 : -1;
      const angle = randomBetween(random, -1.02, -0.52) * side + (side < 0 ? Math.PI : 0);
      const baseX = randomBetween(random, 30.8, 34.4);
      const baseY = randomBetween(random, 15.1, 16.8);
      const length = randomBetween(random, 12.2, 17.4);
      const width = randomBetween(random, 3.1, 4.9);
      const curve = randomBetween(random, -1.5, 1.8);
      path.setAttribute("class", `brand-orange-leaf brand-orange-leaf-${index === 0 ? "a" : "b"}`);
      path.setAttribute("d", makeLeafPath(baseX, baseY, length, width, angle, curve));
      path.style.animationDelay = `${randomBetween(random, -5.6, -0.4).toFixed(2)}s`;
      leaves.appendChild(path);
    }
  }

  function enhanceMark(mark, seed) {
    const random = mulberry32(seed);
    const initials = mark.getAttribute("data-brand-initials") || "ST";
    const body = mark.querySelector("[data-brand-body]");
    const text = mark.querySelector("[data-brand-initials-text]");
    const highlight = mark.querySelector("[data-brand-highlight]");

    if (body) body.setAttribute("d", makeBlobPath(random));
    if (text) text.textContent = initials;
    if (highlight) {
      const cx = randomBetween(random, 23.2, 27.6);
      const cy = randomBetween(random, 22.8, 27.4);
      highlight.setAttribute("cx", cx.toFixed(2));
      highlight.setAttribute("cy", cy.toFixed(2));
      highlight.setAttribute("rx", randomBetween(random, 6.8, 8.8).toFixed(2));
      highlight.setAttribute("ry", randomBetween(random, 4.4, 5.9).toFixed(2));
      highlight.setAttribute("transform", `rotate(${randomBetween(random, -31, -17).toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})`);
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
      mark.style.setProperty("--brand-orange-shine-x", "0px");
      mark.style.setProperty("--brand-orange-shine-y", "0px");
      mark.classList.remove("brand-orange--pressed");
    }

    link.addEventListener("pointermove", function (event) {
      const bounds = mark.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const dx = (event.clientX - bounds.left) / bounds.width - 0.5;
      const dy = (event.clientY - bounds.top) / bounds.height - 0.5;

      mark.style.setProperty("--brand-orange-tilt", `${(dx * 7).toFixed(2)}deg`);
      mark.style.setProperty("--brand-orange-nudge-x", `${(dx * 0.72).toFixed(2)}px`);
      mark.style.setProperty("--brand-orange-nudge-y", `${(dy * 0.5).toFixed(2)}px`);
      mark.style.setProperty("--brand-orange-shine-x", `${(dx * 1.25).toFixed(2)}px`);
      mark.style.setProperty("--brand-orange-shine-y", `${(dy * 0.95).toFixed(2)}px`);
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
