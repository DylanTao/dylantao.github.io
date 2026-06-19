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

  const makeDashArray = (random, count, tight = false) => {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const isMark = index % 2 === 0;
      const min = isMark ? (tight ? 18 : 24) : tight ? 8 : 11;
      const max = isMark ? (tight ? 58 : 86) : tight ? 24 : 36;
      values.push(number(between(random, min, max)));
    }
    return values.join(" ");
  };

  const ellipse = ({ cx, cy, rx, ry, rotation, fill = "none", stroke = "none", strokeWidth = 1, opacity = 1, dash = "", filter = "" }) =>
    `<ellipse cx="${number(cx)}" cy="${number(cy)}" rx="${number(rx)}" ry="${number(ry)}" transform="rotate(${number(rotation)} ${number(cx)} ${number(
      cy
    )})" fill="${fill}" stroke="${stroke}" stroke-width="${number(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" opacity="${number(
      opacity
    )}"${dash ? ` stroke-dasharray="${dash}"` : ""}${filter ? ` filter="${filter}"` : ""}/>`;

  const pointOnEllipse = (cx, cy, rx, ry, angle, rotation) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotated = (rotation / 180) * Math.PI;
    return {
      x: cx + rx * cos * Math.cos(rotated) - ry * sin * Math.sin(rotated),
      y: cy + rx * cos * Math.sin(rotated) + ry * sin * Math.cos(rotated),
    };
  };

  const createStainSvg = (seedLabel) => {
    const seed = hashSeed(seedLabel);
    const random = makeRandom(seed);
    const cx = between(random, 174, 194);
    const cy = between(random, 178, 198);
    const rotation = between(random, -18, 16);
    const outerRx = between(random, 126, 144);
    const outerRy = outerRx * between(random, 0.92, 1.04);
    const edge = "#603017";
    const warmEdge = "#8d552b";
    const pale = "#b9824f";
    const wash = "#d1a16e";
    const noiseSeed = seed % 997;
    const rings = [];

    rings.push(
      ellipse({
        cx,
        cy,
        rx: outerRx,
        ry: outerRy,
        rotation,
        stroke: edge,
        strokeWidth: between(random, 7.5, 10.5),
        opacity: between(random, 0.28, 0.38),
        dash: makeDashArray(random, 18),
        filter: "url(#ragged)",
      })
    );

    const ringCount = 3 + Math.floor(random() * 2);
    for (let index = 0; index < ringCount; index += 1) {
      const inset = 13 + index * between(random, 10, 16);
      rings.push(
        ellipse({
          cx: cx + between(random, -4, 5),
          cy: cy + between(random, -5, 4),
          rx: outerRx - inset,
          ry: outerRy - inset * between(random, 0.8, 1.08),
          rotation: rotation + between(random, -5, 6),
          stroke: index % 2 ? warmEdge : pale,
          strokeWidth: between(random, 2.4, 5.8),
          opacity: between(random, 0.12, 0.24),
          dash: makeDashArray(random, 14, true),
          filter: "url(#ragged)",
        })
      );
    }

    const offsetRingAngle = between(random, 0, Math.PI * 2);
    rings.push(
      ellipse({
        cx: cx + Math.cos(offsetRingAngle) * between(random, 28, 44),
        cy: cy + Math.sin(offsetRingAngle) * between(random, 16, 32),
        rx: outerRx * between(random, 0.56, 0.72),
        ry: outerRy * between(random, 0.48, 0.66),
        rotation: rotation + between(random, -22, 24),
        stroke: warmEdge,
        strokeWidth: between(random, 3.6, 6.6),
        opacity: between(random, 0.1, 0.18),
        dash: makeDashArray(random, 12),
        filter: "url(#ragged)",
      })
    );

    const fills = [
      ellipse({
        cx: cx + between(random, -8, 10),
        cy: cy + between(random, -10, 8),
        rx: outerRx * between(random, 0.72, 0.86),
        ry: outerRy * between(random, 0.66, 0.82),
        rotation,
        fill: wash,
        opacity: between(random, 0.035, 0.065),
        filter: "url(#soft)",
      }),
      ellipse({
        cx: cx + between(random, -38, 36),
        cy: cy + between(random, -28, 32),
        rx: outerRx * between(random, 0.24, 0.38),
        ry: outerRy * between(random, 0.16, 0.28),
        rotation: rotation + between(random, -18, 18),
        fill: pale,
        opacity: between(random, 0.035, 0.075),
        filter: "url(#soft)",
      }),
    ];

    const blobs = [];
    const perimeterBlobs = 5 + Math.floor(random() * 3);
    for (let index = 0; index < perimeterBlobs; index += 1) {
      const angle = between(random, -0.15, Math.PI * 2 - 0.15);
      const point = pointOnEllipse(cx, cy, outerRx * between(random, 0.9, 1.04), outerRy * between(random, 0.9, 1.04), angle, rotation);
      blobs.push(
        ellipse({
          cx: point.x,
          cy: point.y,
          rx: between(random, 5, 18),
          ry: between(random, 2.6, 9),
          rotation: (angle * 180) / Math.PI + rotation + between(random, -38, 38),
          fill: random() > 0.42 ? edge : warmEdge,
          opacity: between(random, 0.12, 0.31),
          filter: "url(#droplet)",
        })
      );
    }

    const satellites = [];
    const satelliteCount = 4 + Math.floor(random() * 3);
    for (let index = 0; index < satelliteCount; index += 1) {
      const angle = between(random, -0.55, Math.PI * 2 - 0.12);
      const distance = between(random, 126, 178);
      const size = Math.pow(random(), 1.85);
      const x = cx + Math.cos(angle) * distance + between(random, -12, 12);
      const y = cy + Math.sin(angle) * distance * between(random, 0.76, 1.06) + between(random, -10, 10);
      const rx = between(random, 2.4, 16) * (0.38 + size);
      const ry = between(random, 2.2, 12) * (0.42 + size);
      satellites.push(
        ellipse({
          cx: x,
          cy: y,
          rx,
          ry,
          rotation: between(random, -70, 72),
          fill: random() > 0.28 ? warmEdge : edge,
          opacity: between(random, 0.12, 0.36),
          filter: "url(#droplet)",
        })
      );
    }

    const streaks = [];
    const streakCount = 2 + Math.floor(random() * 3);
    for (let index = 0; index < streakCount; index += 1) {
      const angle = between(random, -0.3, Math.PI * 2 - 0.3);
      const start = pointOnEllipse(cx, cy, outerRx * between(random, 0.86, 1.0), outerRy * between(random, 0.86, 1.0), angle, rotation);
      const length = between(random, 18, 48);
      const end = {
        x: start.x + Math.cos(angle) * length + between(random, -8, 8),
        y: start.y + Math.sin(angle) * length + between(random, -8, 8),
      };
      streaks.push(
        `<path d="M${number(start.x)} ${number(start.y)} C${number((start.x + end.x) / 2 + between(random, -8, 8))} ${number(
          (start.y + end.y) / 2 + between(random, -8, 8)
        )} ${number((start.x + end.x) / 2 + between(random, -8, 8))} ${number((start.y + end.y) / 2 + between(random, -8, 8))} ${number(
          end.x
        )} ${number(end.y)}" fill="none" stroke="${random() > 0.38 ? warmEdge : edge}" stroke-width="${number(
          between(random, 2.2, 5.8)
        )}" stroke-linecap="round" opacity="${number(between(random, 0.11, 0.24))}" filter="url(#droplet)"/>`
      );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 380" role="img" aria-label="Procedural coffee ring stain">
  <defs>
    <filter id="ragged" x="-18%" y="-18%" width="136%" height="136%">
      <feTurbulence type="fractalNoise" baseFrequency="${number(between(random, 0.035, 0.052))} ${number(
        between(random, 0.07, 0.12)
      )}" numOctaves="4" seed="${noiseSeed}"/>
      <feDisplacementMap in="SourceGraphic" scale="${number(between(random, 4.8, 7.8))}"/>
    </filter>
    <filter id="soft" x="-24%" y="-24%" width="148%" height="148%">
      <feGaussianBlur stdDeviation="${number(between(random, 2.4, 3.6))}"/>
    </filter>
    <filter id="droplet" x="-42%" y="-42%" width="184%" height="184%">
      <feGaussianBlur stdDeviation="${number(between(random, 0.45, 1.05))}"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.13 0.2" numOctaves="2" seed="${(noiseSeed + 37) % 997}"/>
      <feDisplacementMap in="SourceGraphic" scale="${number(between(random, 1.2, 2.8))}"/>
    </filter>
  </defs>
  <g>${fills.join("")}${rings.join("")}${blobs.join("")}${streaks.join("")}${satellites.join("")}</g>
</svg>`;
  };

  const seed = randomSeed();
  const random = makeRandom(hashSeed(`position-${seed}`));
  const svg = createStainSvg(seed);
  const image = encodeSvg(svg);

  stacks.forEach((stack, index) => {
    stack.style.setProperty("--home-coffee-stain-image", image);
    stack.style.setProperty("--home-coffee-stain-rotation", `${number(between(random, -16, -5))}deg`);
    stack.style.setProperty("--home-coffee-stain-x", `${number(between(random, 0.38, 0.82))}rem`);
    stack.style.setProperty("--home-coffee-stain-y", `${number(between(random, -0.7, -0.28))}rem`);
    stack.style.setProperty("--home-coffee-stain-scale", String(number(between(random, 1.03, 1.13))));
    stack.dataset.coffeeStainSeed = index === 0 ? seed : `${seed}-${index}`;
  });
})();
