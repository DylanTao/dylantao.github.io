(function () {
  const root = document.documentElement;
  const wraps = Array.from(document.querySelectorAll("[data-research-motion]"));
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    const section = wrap.closest("[data-research-motion-section]") || wrap.closest("[data-home-section='focus']") || document;
    const canvas = wrap.querySelector("[data-research-motion-canvas]");
    const ctx = canvas.getContext("2d");
    const buttons = Array.from(section.querySelectorAll("[data-research-mode]"));
    const details = Array.from(section.querySelectorAll("[data-research-detail]"));
    const readout = section.querySelector("[data-research-motion-readout]");
    const readoutSummary = section.querySelector(".home-motion-readout strong");
    const status = section.querySelector("[data-research-motion-status]");
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const modeCopy = {
      design: "Vary-compare-refine",
      evaluate: "Build-test-learn",
      situated: "Assistance bends to context",
    };

    const modeStatus = {
      design: "Alternatives branch, compare, loop back, and refine.",
      evaluate: "Prototype traces organize into sharper questions and revisions.",
      situated: "An assistance field bends around practice, medium, and setting.",
    };

    const state = {
      mode: buttons[0]?.getAttribute("data-research-mode") || "design",
      previousMode: null,
      transitionStart: 0,
      transitionMs: 420,
      width: 0,
      height: 0,
      dpr: 1,
      raf: null,
      visible: true,
      reduceMotion: reduceMotionQuery.matches,
      geometry: {},
      pointer: {
        active: false,
        intent: 0,
        targetIntent: 0,
        x: 0.5,
        y: 0.5,
        tx: 0.5,
        ty: 0.5,
      },
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const cubic = (a, b, c, d, t) => {
      const inv = 1 - t;
      return inv * inv * inv * a + 3 * inv * inv * t * b + 3 * inv * t * t * c + t * t * t * d;
    };
    const wrap01 = (value) => value - Math.floor(value);
    const cssVar = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
    const colorParser = document.createElement("canvas").getContext("2d");
    const transparentColor = (color) => {
      if (!colorParser) return "transparent";

      colorParser.fillStyle = "#000000";
      colorParser.fillStyle = color;
      const parsed = colorParser.fillStyle;
      const rgb = parsed.match(/^rgba?\(([^)]+)\)$/i);

      if (rgb) {
        const channels = rgb[1].split(",").map((part) => part.trim());
        return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, 0)`;
      }

      const hex = parsed.replace("#", "");
      if (hex.length === 6) {
        const red = parseInt(hex.slice(0, 2), 16);
        const green = parseInt(hex.slice(2, 4), 16);
        const blue = parseInt(hex.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, 0)`;
      }

      return "transparent";
    };
    const canCrossfadeModes = () => !state.reduceMotion && state.width >= 560;

    const palette = () => ({
      bgA: cssVar("--research-motion-bg-a", "#fffaf6"),
      bgB: cssVar("--research-motion-bg-b", "rgba(178, 214, 242, 0.36)"),
      bgC: cssVar("--research-motion-bg-c", "#f7fbfb"),
      lineA: cssVar("--research-motion-line-a", "#4f9bd8"),
      lineB: cssVar("--research-motion-line-b", "#f2b36a"),
      lineC: cssVar("--research-motion-line-c", "#5daea3"),
      dot: cssVar("--research-motion-dot", "#2f7ec7"),
      glow: cssVar("--research-motion-glow", "rgba(79, 155, 216, 0.1)"),
      ink: cssVar("--global-text-color", "#201916"),
      muted: cssVar("--global-text-color-light", "#746760"),
    });

    const plotBounds = () => {
      const padX = clamp(state.width * 0.1, 32, 96);
      const padTop = clamp(state.height * 0.18, 48, 78);
      const padBottom = clamp(state.height * 0.17, 46, 74);
      const left = padX;
      const right = state.width - padX;
      const top = padTop;
      const bottom = state.height - padBottom;
      return {
        left,
        right,
        top,
        bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        cx: (left + right) / 2,
        cy: (top + bottom) / 2,
      };
    };

    const makeSeries = (count) =>
      Array.from({ length: count }, (_, index) => ({
        index,
        t: count === 1 ? 0 : index / (count - 1),
        phase: index * 0.37,
      }));

    const makeParticles = (count, lanes = 4) =>
      Array.from({ length: count }, (_, index) => ({
        index,
        lane: index % lanes,
        phase: index * 1.61,
        seed: wrap01(index * 0.61803398875),
        speed: 0.72 + (index % 5) * 0.08,
      }));

    const generateGeometry = () => {
      const mobile = state.width < 560;
      const tablet = state.width < 920;
      state.geometry = {
        design: makeSeries(mobile ? 10 : tablet ? 16 : 20),
        evaluate: makeSeries(mobile ? 18 : tablet ? 24 : 28),
        situated: makeSeries(mobile ? 18 : tablet ? 24 : 28),
        particles: {
          design: makeParticles(mobile ? 6 : tablet ? 9 : 12, mobile ? 3 : 5),
          evaluate: makeParticles(mobile ? 7 : tablet ? 10 : 13, mobile ? 3 : 5),
          situated: makeParticles(mobile ? 8 : tablet ? 10 : 13, 3),
        },
      };
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      state.width = Math.max(1, Math.floor(rect.width));
      state.height = Math.max(1, Math.floor(rect.height));
      state.dpr = Math.min(window.devicePixelRatio || 1, state.width > 900 ? 1.5 : 2);
      canvas.width = Math.floor(state.width * state.dpr);
      canvas.height = Math.floor(state.height * state.dpr);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      generateGeometry();
      render(performance.now());
    };

    const drawDot = (x, y, radius, fill, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };

    const drawTraceParticle = (x, y, radius, fill, alpha = 1, angle = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha * 0.28;
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(0.7, radius * 0.42);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-radius * 5.2, 0);
      ctx.lineTo(-radius * 1.5, 0);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 3.2);
      glow.addColorStop(0, fill);
      glow.addColorStop(0.34, fill);
      glow.addColorStop(1, transparentColor(fill));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = Math.min(1, alpha + 0.12);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawGuideLabel = (text, x, y, pal, align = "center", alpha = 1) => {
      if (state.width < 580) return;

      ctx.save();
      ctx.globalAlpha = 0.58 * alpha;
      ctx.fillStyle = pal.muted;
      ctx.font = `700 ${state.width < 760 ? 10 : 11}px ${cssVar("--font-mono", "monospace")}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(text.toUpperCase(), x, y);
      ctx.restore();
    };

    const drawGuidePill = (text, x, y, pal, align = "center", alpha = 1) => {
      if (state.width < 760) return;

      ctx.save();
      ctx.font = `700 11px ${cssVar("--font-mono", "monospace")}`;
      const metrics = ctx.measureText(text.toUpperCase());
      const width = metrics.width + 18;
      const height = 22;
      const left = align === "left" ? x : align === "right" ? x - width : x - width / 2;
      ctx.globalAlpha = 0.16 * alpha;
      ctx.fillStyle = pal.lineB;
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(left, y - height / 2, width, height, 11);
      } else {
        const top = y - height / 2;
        const radius = 11;
        ctx.moveTo(left + radius, top);
        ctx.lineTo(left + width - radius, top);
        ctx.quadraticCurveTo(left + width, top, left + width, top + radius);
        ctx.lineTo(left + width, top + height - radius);
        ctx.quadraticCurveTo(left + width, top + height, left + width - radius, top + height);
        ctx.lineTo(left + radius, top + height);
        ctx.quadraticCurveTo(left, top + height, left, top + height - radius);
        ctx.lineTo(left, top + radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
      }
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.68 * alpha;
      ctx.fillStyle = pal.ink;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(text.toUpperCase(), x, y);
      ctx.restore();
    };

    const drawRoundedRectPath = (x, y, width, height, radius) => {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, r);
        return;
      }

      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    };

    const drawSurfacePanel = (x, y, width, height, pal, alpha = 1, accent = pal.lineB) => {
      ctx.save();
      const cx = x + width / 2;
      const cy = y + height / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      glow.addColorStop(0, pal.bgB);
      glow.addColorStop(0.58, pal.glow);
      glow.addColorStop(1, transparentColor(pal.bgB));
      ctx.globalAlpha = 0.34 * alpha;
      ctx.fillStyle = glow;
      ctx.fillRect(x - width * 0.28, y - height * 0.32, width * 1.56, height * 1.64);

      drawRoundedRectPath(x, y, width, height, Math.min(18, height * 0.28));
      ctx.globalAlpha = 0.2 * alpha;
      ctx.fillStyle = pal.bgA;
      ctx.fill();
      ctx.globalAlpha = 0.34 * alpha;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const drawNodeGlyph = (shape, x, y, size, color, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = 0.22 * alpha;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (shape === "triangle") {
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.92, y + size * 0.64);
        ctx.lineTo(x - size * 0.92, y + size * 0.64);
        ctx.closePath();
      } else if (shape === "square") {
        drawRoundedRectPath(x - size * 0.82, y - size * 0.82, size * 1.64, size * 1.64, size * 0.34);
      } else if (shape === "diamond") {
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 0.72 * alpha;
      ctx.stroke();
      ctx.restore();
    };

    const drawArrowHead = (x, y, angle, size, color, alpha = 1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.55, -size * 0.48);
      ctx.lineTo(-size * 0.34, 0);
      ctx.lineTo(-size * 0.55, size * 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawBackground = (pal) => {
      const { width, height } = state;
      const base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, pal.bgA);
      base.addColorStop(0.56, pal.bgC);
      base.addColorStop(1, pal.bgA);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width * 0.5, height * 1.06, 0, width * 0.5, height * 1.06, Math.max(width, height) * 0.58);
      glow.addColorStop(0, pal.bgB);
      glow.addColorStop(0.42, pal.glow);
      glow.addColorStop(1, transparentColor(pal.bgB));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    };

    const updatePointer = () => {
      const speed = state.pointer.targetIntent > 0 ? 0.092 : 0.055;
      state.pointer.x = lerp(state.pointer.x, state.pointer.tx, speed);
      state.pointer.y = lerp(state.pointer.y, state.pointer.ty, speed);
      state.pointer.intent = lerp(state.pointer.intent, state.pointer.targetIntent, state.pointer.targetIntent > 0 ? 0.066 : 0.09);
    };

    const strokeGradient = (pal) => {
      const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
      gradient.addColorStop(0, pal.lineA);
      gradient.addColorStop(0.5, pal.lineB);
      gradient.addColorStop(1, pal.lineC);
      return gradient;
    };

    const beginMode = (pal, alpha, width = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeGradient(pal);
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    const endMode = () => {
      ctx.restore();
    };

    const drawDesign = (time, pal, alpha = 1) => {
      const b = plotBounds();
      const series = state.geometry.design || [];
      const mobile = state.width < 560;
      const intent = state.pointer.intent;
      const centerX = b.cx + (state.pointer.x - 0.5) * lerp(10, 42, intent);
      const centerY = b.cy + (state.pointer.y - 0.5) * lerp(6, 22, intent);
      const leftX = b.left + b.width * (mobile ? 0.08 : 0.06);
      const varyX = b.left + b.width * 0.28;
      const refineX = b.right - b.width * 0.24;
      const rightX = b.right - b.width * 0.05;
      const top = b.top + b.height * 0.06;
      const bottom = b.bottom - b.height * 0.06;
      const surfaceW = clamp(b.width * 0.22, mobile ? 92 : 118, 170);
      const surfaceH = clamp(b.height * 0.35, mobile ? 54 : 62, 88);
      const surfaceLeft = centerX - surfaceW / 2;
      const surfaceRight = centerX + surfaceW / 2;
      const surfaceTop = centerY - surfaceH / 2;

      drawSurfacePanel(surfaceLeft, surfaceTop, surfaceW, surfaceH, pal, alpha, pal.lineB);

      beginMode(pal, (mobile ? 0.2 : 0.21) * alpha, mobile ? 0.68 : 0.84);
      series.forEach(({ t, phase }) => {
        const sourceY = lerp(top, bottom, t) + Math.sin(time * 0.5 + phase) * b.height * 0.012;
        const spreadY = centerY + (t - 0.5) * b.height * 0.74 + Math.sin(time * 0.42 + phase) * b.height * 0.018;
        const compareY = centerY + (t - 0.5) * surfaceH * 0.72;
        const refineY = centerY + (0.5 - t) * b.height * 0.24 + Math.sin(time * 0.45 + phase) * b.height * 0.012;
        const directionY = centerY + (0.5 - t) * b.height * 0.3;

        ctx.beginPath();
        ctx.moveTo(leftX, sourceY);
        ctx.bezierCurveTo(leftX + b.width * 0.1, sourceY, varyX - b.width * 0.05, spreadY, surfaceLeft, compareY);
        ctx.bezierCurveTo(surfaceRight, compareY, refineX - b.width * 0.06, refineY, rightX, directionY);
        ctx.stroke();

        if (t < 0.1 || t > 0.9) return;
        if (Math.round(t * 100) % 17 === 0) {
          drawDot(leftX, sourceY, mobile ? 1 : 1.35, pal.dot, 0.36 * alpha);
        }
      });
      endMode();

      const clusterOffsets = mobile ? [-0.24, 0.08] : [-0.3, -0.08, 0.14, 0.32];
      ctx.save();
      ctx.strokeStyle = pal.lineC;
      ctx.lineWidth = mobile ? 0.8 : 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      clusterOffsets.forEach((offset, index) => {
        const rootX = varyX - b.width * 0.05;
        const rootY = centerY + offset * b.height + Math.sin(time * 0.38 + index) * b.height * 0.01;
        const childX = varyX + b.width * (mobile ? 0.012 : 0.02);
        const leafX = varyX + b.width * (mobile ? 0.07 : 0.085);
        const split = (index % 2 ? -1 : 1) * b.height * (mobile ? 0.055 : 0.07);
        const childA = rootY + split;
        const childB = rootY - split * 0.72;
        const leafY = lerp(childA, childB, 0.52);

        ctx.globalAlpha = 0.3 * alpha;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        ctx.lineTo(childX, childA);
        ctx.moveTo(rootX, rootY);
        ctx.lineTo(childX, childB);
        ctx.moveTo(childX, childA);
        ctx.lineTo(leafX, leafY);
        ctx.moveTo(childX, childB);
        ctx.lineTo(leafX, leafY);
        ctx.stroke();

        const nodeSize = mobile ? 2.2 : 2.8;
        drawNodeGlyph(index % 3 === 0 ? "circle" : index % 3 === 1 ? "square" : "triangle", rootX, rootY, nodeSize, pal.lineA, alpha);
        drawNodeGlyph("circle", childX, childA, nodeSize * 0.78, pal.lineC, alpha);
        drawNodeGlyph("square", childX, childB, nodeSize * 0.74, pal.lineB, alpha);
        drawNodeGlyph("diamond", leafX, leafY, nodeSize * 0.82, pal.lineC, alpha);
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = mobile ? 0.8 : 1;
      ctx.lineCap = "round";
      ctx.setLineDash(mobile ? [4, 7] : [5, 8]);
      clusterOffsets.slice(0, mobile ? 1 : 3).forEach((offset, index) => {
        const loopY = centerY + (offset + 0.04) * b.height;
        const targetX = varyX + b.width * (index % 2 ? 0.02 : -0.02);
        const targetY = centerY + (offset + (index % 2 ? -0.06 : 0.06)) * b.height;
        ctx.globalAlpha = 0.24 * alpha;
        ctx.beginPath();
        ctx.moveTo(surfaceLeft + surfaceW * 0.15, loopY);
        ctx.bezierCurveTo(centerX - b.width * 0.14, loopY - b.height * 0.1, targetX + b.width * 0.08, targetY, targetX, targetY);
        ctx.stroke();
        drawArrowHead(targetX, targetY, Math.PI, mobile ? 4 : 5, pal.lineB, alpha);
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = mobile ? 1.05 : 1.35;
      ctx.lineCap = "round";
      [-0.18, 0, 0.18].slice(0, mobile ? 2 : 3).forEach((offset, index) => {
        const startY = centerY + offset * surfaceH;
        const endY = centerY - offset * b.height * 0.78 + (index - 1) * b.height * 0.025;
        ctx.globalAlpha = 0.5 * alpha;
        ctx.beginPath();
        ctx.moveTo(surfaceRight - surfaceW * 0.08, startY);
        ctx.bezierCurveTo(refineX - b.width * 0.06, startY, refineX + b.width * 0.02, endY, rightX, endY);
        ctx.stroke();
        drawDot(rightX, endY, mobile ? 1.35 : 1.7, pal.lineB, 0.52 * alpha);
      });
      ctx.restore();

      ctx.save();
      const tileCount = mobile ? 2 : 3;
      const tileW = (surfaceW - (tileCount + 1) * 8) / tileCount;
      const tileH = surfaceH * 0.52;
      for (let index = 0; index < tileCount; index += 1) {
        const tileX = surfaceLeft + 8 + index * (tileW + 8);
        const tileY = centerY - tileH / 2 + Math.sin(time * 0.45 + index) * 1.5;
        drawRoundedRectPath(tileX, tileY, tileW, tileH, 6);
        ctx.globalAlpha = 0.18 * alpha;
        ctx.fillStyle = index === 1 ? pal.lineB : pal.lineC;
        ctx.fill();
        ctx.globalAlpha = 0.42 * alpha;
        ctx.strokeStyle = index === 1 ? pal.lineB : pal.lineC;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.globalAlpha = 0.34 * alpha;
        ctx.strokeStyle = pal.ink;
        ctx.beginPath();
        ctx.moveTo(tileX + tileW * 0.22, tileY + tileH * 0.38);
        ctx.lineTo(tileX + tileW * 0.78, tileY + tileH * 0.38);
        ctx.moveTo(tileX + tileW * 0.28, tileY + tileH * 0.62);
        ctx.lineTo(tileX + tileW * 0.68, tileY + tileH * 0.62);
        ctx.stroke();
      }
      ctx.restore();

      const designParticles = state.geometry.particles?.design || [];
      designParticles.forEach((particle) => {
        const laneCount = mobile ? 3 : 5;
        const laneT = clamp((particle.lane + 0.55) / laneCount, 0.08, 0.92);
        const routeT = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.046 * particle.speed);
        const routeKind = particle.seed < 0.26 ? "loop" : particle.seed > 0.66 ? "branch" : "forward";
        const sourceY = lerp(top, bottom, laneT) + Math.sin(time * 0.44 + particle.phase) * b.height * 0.01;
        const spreadY = centerY + (laneT - 0.5) * b.height * 0.72;
        const compareY = centerY + (laneT - 0.5) * surfaceH * 0.64;
        const branchX = varyX + b.width * 0.07;
        const branchY = spreadY + (particle.seed > 0.5 ? -1 : 1) * b.height * (mobile ? 0.08 : 0.11);
        const outY = centerY + (0.5 - laneT) * b.height * 0.28;

        const pointAt = (progress) => {
          if (routeKind === "loop") {
            if (progress < 0.42) {
              const local = progress / 0.42;
              return {
                x: cubic(leftX, leftX + b.width * 0.1, varyX - b.width * 0.04, surfaceLeft, local),
                y: cubic(sourceY, sourceY, spreadY, compareY, local),
              };
            }
            if (progress < 0.62) {
              const local = (progress - 0.42) / 0.2;
              return {
                x: cubic(surfaceLeft + surfaceW * 0.16, centerX - b.width * 0.12, branchX, branchX, local),
                y: cubic(compareY, compareY - b.height * 0.08, branchY, branchY, local),
              };
            }
            if (progress < 0.8) {
              const local = (progress - 0.62) / 0.18;
              return {
                x: cubic(branchX, varyX + b.width * 0.12, surfaceLeft, surfaceRight, local),
                y: cubic(branchY, spreadY, compareY, compareY, local),
              };
            }
            const local = (progress - 0.8) / 0.2;
            return {
              x: cubic(surfaceRight, refineX - b.width * 0.04, refineX + b.width * 0.04, rightX, local),
              y: cubic(compareY, outY, outY, outY, local),
            };
          }

          if (routeKind === "branch") {
            if (progress < 0.32) {
              const local = progress / 0.32;
              return {
                x: cubic(leftX, leftX + b.width * 0.08, varyX, branchX, local),
                y: cubic(sourceY, sourceY, spreadY, branchY, local),
              };
            }
            if (progress < 0.58) {
              const local = (progress - 0.32) / 0.26;
              return {
                x: cubic(branchX, branchX + b.width * 0.05, centerX - b.width * 0.11, surfaceLeft, local),
                y: cubic(branchY, spreadY, compareY, compareY, local),
              };
            }
            if (progress < 0.72) {
              const local = (progress - 0.58) / 0.14;
              return { x: lerp(surfaceLeft, surfaceRight, local), y: compareY };
            }
            const local = (progress - 0.72) / 0.28;
            return {
              x: cubic(surfaceRight, refineX - b.width * 0.06, refineX + b.width * 0.04, rightX, local),
              y: cubic(compareY, outY, outY, outY, local),
            };
          }

          if (progress < 0.5) {
            const local = progress / 0.5;
            return {
              x: cubic(leftX, leftX + b.width * 0.1, varyX - b.width * 0.04, surfaceLeft, local),
              y: cubic(sourceY, sourceY, spreadY, compareY, local),
            };
          }
          if (progress < 0.64) {
            const local = (progress - 0.5) / 0.14;
            return { x: lerp(surfaceLeft, surfaceRight, local), y: compareY };
          }
          const local = (progress - 0.64) / 0.36;
          return {
            x: cubic(surfaceRight, refineX - b.width * 0.06, refineX + b.width * 0.05, rightX, local),
            y: cubic(compareY, outY, outY, outY, local),
          };
        };

        const point = pointAt(routeT);
        const next = pointAt(clamp(routeT + 0.018, 0, 1));
        const angle = Math.atan2(next.y - point.y, next.x - point.x);
        const particleAlpha = state.reduceMotion ? 0.36 : 0.24 + 0.34 * Math.sin(routeT * Math.PI);
        const color = routeKind === "loop" ? pal.lineB : routeKind === "branch" ? pal.lineC : particle.lane % 2 ? pal.lineA : pal.lineB;
        drawTraceParticle(point.x, point.y, mobile ? 1 : 1.2, color, particleAlpha * alpha, angle);
      });

      drawGuideLabel("vary", varyX, b.bottom + 20, pal, "center", alpha);
      drawGuidePill("compare/refine", centerX, surfaceTop - 18, pal, "center", alpha);
      drawGuideLabel("refine", refineX, b.bottom + 20, pal, "center", alpha);
    };

    const drawEvaluate = (time, pal, alpha = 1) => {
      const b = plotBounds();
      const series = state.geometry.evaluate || [];
      const mobile = state.width < 560;
      const intent = state.pointer.intent;
      const centerX = b.cx + (state.pointer.x - 0.5) * lerp(8, 32, intent);
      const centerY = b.cy + (state.pointer.y - 0.5) * lerp(4, 18, intent);
      const surfaceW = clamp(b.width * 0.28, mobile ? 104 : 138, 210);
      const surfaceH = clamp(b.height * 0.42, mobile ? 68 : 78, 112);
      const surfaceLeft = centerX - surfaceW / 2;
      const surfaceTop = centerY - surfaceH / 2;
      const surfaceRight = centerX + surfaceW / 2;
      const protoX = b.left + b.width * 0.07;
      const protoW = clamp(b.width * 0.12, mobile ? 42 : 54, 78);
      const protoH = clamp(b.height * 0.18, mobile ? 28 : 34, 46);
      const questionX = b.right - b.width * 0.1;
      const questionY = centerY - b.height * 0.02;
      const protoCount = mobile ? 2 : 3;
      const protoYs = Array.from({ length: protoCount }, (_, index) => {
        const t = protoCount === 1 ? 0.5 : index / (protoCount - 1);
        return centerY + (t - 0.5) * b.height * 0.52;
      });

      drawSurfacePanel(surfaceLeft, surfaceTop, surfaceW, surfaceH, pal, alpha, pal.lineC);

      ctx.save();
      ctx.strokeStyle = pal.lineC;
      ctx.lineWidth = 1;
      protoYs.forEach((y, index) => {
        const x = protoX + (index % 2) * (mobile ? 3 : 6);
        drawRoundedRectPath(x, y - protoH / 2, protoW, protoH, 7);
        ctx.globalAlpha = 0.18 * alpha;
        ctx.fillStyle = index % 2 ? pal.lineA : pal.lineB;
        ctx.fill();
        ctx.globalAlpha = 0.46 * alpha;
        ctx.strokeStyle = index % 2 ? pal.lineA : pal.lineB;
        ctx.stroke();

        ctx.globalAlpha = 0.34 * alpha;
        ctx.strokeStyle = pal.ink;
        ctx.beginPath();
        ctx.moveTo(x + protoW * 0.18, y - protoH * 0.12);
        ctx.lineTo(x + protoW * 0.72, y - protoH * 0.12);
        ctx.moveTo(x + protoW * 0.18, y + protoH * 0.14);
        ctx.lineTo(x + protoW * 0.55, y + protoH * 0.14);
        ctx.stroke();
      });
      ctx.restore();

      beginMode(pal, 0.2 * alpha, mobile ? 0.7 : 0.84);
      series.forEach(({ index, phase }) => {
        const protoIndex = index % protoCount;
        const seed = wrap01(index * 0.61803398875);
        const startX = protoX + protoW;
        const startY = protoYs[protoIndex] + Math.sin(time * 0.44 + phase) * protoH * 0.18;
        const endX = surfaceLeft + surfaceW * (0.12 + seed * 0.76);
        const endY = surfaceTop + surfaceH * (0.22 + wrap01(seed * 1.73) * 0.56) + Math.sin(time * 0.36 + phase) * surfaceH * 0.025;
        const lift = (seed - 0.5) * b.height * 0.16;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(startX + b.width * 0.09, startY + lift, surfaceLeft - b.width * 0.08, endY - lift * 0.35, endX, endY);
        ctx.stroke();
      });
      endMode();

      ctx.save();
      ctx.globalAlpha = 0.22 * alpha;
      ctx.strokeStyle = pal.lineC;
      ctx.lineWidth = 1;
      const axisY = surfaceTop + surfaceH * 0.7;
      ctx.beginPath();
      ctx.moveTo(surfaceLeft + surfaceW * 0.12, axisY);
      ctx.lineTo(surfaceRight - surfaceW * 0.1, axisY);
      ctx.stroke();
      [0.24, 0.42, 0.6, 0.78].forEach((mark) => {
        const x = surfaceLeft + surfaceW * mark;
        ctx.beginPath();
        ctx.moveTo(x, axisY - surfaceH * 0.06);
        ctx.lineTo(x, axisY + surfaceH * 0.06);
        ctx.stroke();
      });
      ctx.restore();

      const signalPoints = series.map(({ index, phase }) => {
        const seed = wrap01(index * 0.61803398875);
        const cluster = index % 5;
        const baseX = surfaceLeft + surfaceW * (0.2 + (cluster / 4) * 0.58);
        const baseY = surfaceTop + surfaceH * (0.28 + wrap01(seed * 1.41) * 0.42);
        return {
          x: baseX + Math.sin(seed * Math.PI * 2 + time * 0.28) * surfaceW * 0.025,
          y: baseY + Math.cos(phase + time * 0.3) * surfaceH * 0.028,
          selected: index % 7 === 1 || index % 11 === 0,
          seed,
        };
      });

      signalPoints.forEach((point) => {
        const selectedAlpha = point.selected ? 0.68 : 0.34;
        const radius = point.selected ? (mobile ? 1.7 : 2.05) : mobile ? 1.05 : 1.25;
        drawDot(point.x, point.y, radius, point.selected ? pal.lineB : pal.lineC, selectedAlpha * alpha);
      });

      ctx.save();
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = mobile ? 1 : 1.25;
      ctx.lineCap = "round";
      signalPoints
        .filter((point) => point.selected)
        .slice(0, mobile ? 2 : 3)
        .forEach((point, index) => {
          ctx.globalAlpha = 0.46 * alpha;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.bezierCurveTo(
            surfaceRight + b.width * 0.05,
            point.y,
            questionX - b.width * 0.08,
            questionY + (index - 1) * b.height * 0.04,
            questionX,
            questionY
          );
          ctx.stroke();
        });
      ctx.restore();

      drawNodeGlyph("diamond", questionX, questionY, mobile ? 9 : 12, pal.lineB, alpha);
      drawDot(questionX, questionY, mobile ? 2.4 : 3.1, pal.lineB, 0.72 * alpha);

      ctx.save();
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = mobile ? 0.8 : 1;
      ctx.setLineDash(mobile ? [4, 7] : [5, 8]);
      protoYs.slice(0, mobile ? 1 : 2).forEach((y, index) => {
        const targetX = protoX + protoW * 0.22;
        const targetY = y + (index % 2 ? -1 : 1) * protoH * 0.34;
        ctx.globalAlpha = 0.34 * alpha;
        ctx.beginPath();
        ctx.moveTo(questionX - b.width * 0.02, questionY + (index - 0.5) * b.height * 0.08);
        ctx.bezierCurveTo(centerX + b.width * 0.1, b.bottom - b.height * 0.02, protoX + b.width * 0.16, b.bottom - b.height * 0.03, targetX, targetY);
        ctx.stroke();
        drawArrowHead(targetX, targetY, Math.PI * 0.92, mobile ? 4.4 : 5.5, pal.lineB, alpha);
      });
      ctx.restore();

      const evaluateParticles = state.geometry.particles?.evaluate || [];
      evaluateParticles.forEach((particle) => {
        const routeT = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.072 * particle.speed);
        const protoIndex = particle.lane % protoCount;
        const seed = particle.seed;
        const startX = protoX + protoW;
        const startY = protoYs[protoIndex] + Math.sin(time * 0.42 + particle.phase) * protoH * 0.14;
        const clusterX = surfaceLeft + surfaceW * (0.18 + wrap01(seed * 1.9) * 0.64);
        const clusterY = surfaceTop + surfaceH * (0.24 + wrap01(seed * 1.37) * 0.5);
        const loopBack = seed > 0.62;

        const pointAt = (progress) => {
          if (loopBack) {
            if (progress < 0.42) {
              const local = progress / 0.42;
              return {
                x: cubic(startX, startX + b.width * 0.1, surfaceLeft - b.width * 0.05, clusterX, local),
                y: cubic(startY, startY, clusterY, clusterY, local),
              };
            }
            if (progress < 0.64) {
              const local = (progress - 0.42) / 0.22;
              return {
                x: cubic(clusterX, surfaceRight + b.width * 0.05, questionX - b.width * 0.07, questionX, local),
                y: cubic(clusterY, clusterY, questionY, questionY, local),
              };
            }
            const local = (progress - 0.64) / 0.36;
            return {
              x: cubic(questionX, centerX + b.width * 0.1, protoX + b.width * 0.18, protoX + protoW * 0.18, local),
              y: cubic(questionY, b.bottom - b.height * 0.02, b.bottom - b.height * 0.03, protoYs[protoIndex], local),
            };
          }

          if (progress < 0.54) {
            const local = progress / 0.54;
            return {
              x: cubic(startX, startX + b.width * 0.08, surfaceLeft - b.width * 0.05, clusterX, local),
              y: cubic(startY, startY, clusterY, clusterY, local),
            };
          }
          if (progress < 0.72) {
            const local = (progress - 0.54) / 0.18;
            return {
              x: clusterX + Math.sin(local * Math.PI * 2 + seed) * surfaceW * 0.035,
              y: clusterY + Math.cos(local * Math.PI * 2 + seed) * surfaceH * 0.035,
            };
          }
          const local = (progress - 0.72) / 0.28;
          return {
            x: cubic(clusterX, surfaceRight + b.width * 0.05, questionX - b.width * 0.06, questionX, local),
            y: cubic(clusterY, clusterY, questionY, questionY, local),
          };
        };

        const point = pointAt(routeT);
        const next = pointAt(clamp(routeT + 0.018, 0, 1));
        const pulse = state.reduceMotion ? 0.48 : 0.5 + 0.5 * Math.sin(time * 2.8 + particle.phase);
        const color = loopBack ? pal.lineB : particle.lane % 2 ? pal.lineA : pal.lineC;
        drawTraceParticle(
          point.x,
          point.y,
          mobile ? 1 : 1.18 + pulse * 0.22,
          color,
          (0.22 + pulse * 0.2) * alpha,
          Math.atan2(next.y - point.y, next.x - point.x)
        );
      });

      drawGuideLabel("build", protoX + protoW * 0.5, b.bottom + 20, pal, "center", alpha);
      drawGuidePill("traces", centerX, surfaceTop - 18, pal, "center", alpha);
      drawGuideLabel("learn", questionX, b.bottom + 20, pal, "center", alpha);
    };

    const drawSituated = (time, pal, alpha = 1) => {
      const b = plotBounds();
      const mobile = state.width < 560;
      const intent = state.pointer.intent;
      const drift = state.reduceMotion ? 0.36 : time * 0.22;
      const focusX = b.cx + Math.cos(drift) * b.width * 0.055 + (state.pointer.x - 0.5) * lerp(b.width * 0.025, b.width * 0.09, intent);
      const focusY =
        b.cy + Math.sin(drift * 1.18 + 0.5) * b.height * 0.07 + (state.pointer.y - 0.5) * lerp(b.height * 0.025, b.height * 0.09, intent);
      const fieldRadiusX = b.width * (mobile ? 0.22 : 0.26);
      const fieldRadiusY = b.height * (mobile ? 0.28 : 0.34);
      const gridLeft = b.left + b.width * 0.04;
      const gridRight = b.right - b.width * 0.04;
      const gridTop = b.top + b.height * 0.05;
      const gridBottom = b.bottom - b.height * 0.05;

      const warpPoint = (x, y, strength = 1) => {
        const dx = x - focusX;
        const dy = y - focusY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalized = Math.pow(dx / fieldRadiusX, 2) + Math.pow(dy / fieldRadiusY, 2);
        const influence = Math.exp(-normalized * 1.45) * strength * lerp(0.9, 1.32, intent);
        const push = influence * (mobile ? 10 : 18);
        const turn = influence * (mobile ? 4 : 7) * Math.sin(time * 0.36 + dx * 0.01);

        return {
          x: x + (dx / distance) * push - (dy / distance) * turn,
          y: y + (dy / distance) * push + (dx / distance) * turn,
        };
      };

      ctx.save();
      const assistanceGlow = ctx.createRadialGradient(focusX, focusY, 0, focusX, focusY, fieldRadiusX * 1.12);
      assistanceGlow.addColorStop(0, pal.bgB);
      assistanceGlow.addColorStop(0.5, pal.glow);
      assistanceGlow.addColorStop(1, transparentColor(pal.bgB));
      ctx.globalAlpha = 0.3 * alpha;
      ctx.fillStyle = assistanceGlow;
      ctx.beginPath();
      ctx.ellipse(focusX, focusY, fieldRadiusX * 0.95, fieldRadiusY * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = pal.lineC;
      ctx.lineWidth = mobile ? 0.65 : 0.78;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.19 * alpha;
      const rowCount = mobile ? 5 : 7;
      const colCount = mobile ? 7 : 9;
      const samplesX = mobile ? 18 : 26;
      const samplesY = mobile ? 12 : 18;

      for (let row = 0; row < rowCount; row += 1) {
        const y = lerp(gridTop, gridBottom, rowCount === 1 ? 0.5 : row / (rowCount - 1));
        ctx.beginPath();
        for (let sample = 0; sample < samplesX; sample += 1) {
          const x = lerp(gridLeft, gridRight, samplesX === 1 ? 0.5 : sample / (samplesX - 1));
          const point = warpPoint(x, y);
          if (sample === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }

      for (let col = 0; col < colCount; col += 1) {
        const x = lerp(gridLeft, gridRight, colCount === 1 ? 0.5 : col / (colCount - 1));
        ctx.beginPath();
        for (let sample = 0; sample < samplesY; sample += 1) {
          const y = lerp(gridTop, gridBottom, samplesY === 1 ? 0.5 : sample / (samplesY - 1));
          const point = warpPoint(x, y);
          if (sample === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = mobile ? 0.95 : 1.15;
      ctx.lineCap = "round";
      [0.42, 0.64, 0.86].forEach((scale, index) => {
        ctx.globalAlpha = (0.34 - index * 0.055) * alpha;
        ctx.beginPath();
        const segments = 36;
        for (let step = 0; step <= segments; step += 1) {
          const angle = (step / segments) * Math.PI * 2;
          const rawX = focusX + Math.cos(angle) * fieldRadiusX * scale;
          const rawY = focusY + Math.sin(angle) * fieldRadiusY * scale;
          const point = warpPoint(rawX, rawY, 0.55);
          if (step === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      });
      ctx.restore();

      const anchors = [
        { label: "practice", x: b.left + b.width * 0.17, y: b.top + b.height * 0.25, align: "right", color: pal.lineA },
        { label: "medium", x: b.right - b.width * 0.17, y: b.top + b.height * 0.28, align: "left", color: pal.lineC },
        { label: "setting", x: b.cx, y: b.bottom - b.height * 0.11, align: "center", color: pal.lineB },
      ];

      ctx.save();
      ctx.strokeStyle = pal.lineA;
      ctx.lineWidth = mobile ? 0.9 : 1.08;
      ctx.lineCap = "round";
      anchors.forEach((anchor, index) => {
        const midA = warpPoint(lerp(anchor.x, focusX, 0.36), lerp(anchor.y, focusY, 0.36), 0.62);
        const midB = warpPoint(lerp(anchor.x, focusX, 0.68), lerp(anchor.y, focusY, 0.68), 0.72);
        ctx.globalAlpha = 0.36 * alpha;
        ctx.strokeStyle = anchor.color;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.bezierCurveTo(midA.x, midA.y, midB.x, midB.y, focusX, focusY);
        ctx.stroke();

        drawDot(anchor.x, anchor.y, mobile ? 2.25 : 2.8, anchor.color, 0.8 * alpha);
        const xOffset = anchor.align === "right" ? -10 : anchor.align === "left" ? 10 : 0;
        const yOffset = index === 2 ? 16 : -14;
        drawGuideLabel(anchor.label, anchor.x + xOffset, anchor.y + yOffset, pal, anchor.align, alpha);
      });
      ctx.restore();

      const situatedParticles = state.geometry.particles?.situated || [];
      situatedParticles.forEach((particle) => {
        const orbit = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.038 * particle.speed);
        const angle = Math.PI * 2 * orbit + particle.lane * 0.56;
        const localRadiusX = fieldRadiusX * (0.38 + (particle.lane % 3) * 0.16);
        const localRadiusY = fieldRadiusY * (0.36 + (particle.lane % 3) * 0.13);
        const rawX = focusX + Math.cos(angle) * localRadiusX;
        const rawY = focusY + Math.sin(angle) * localRadiusY;
        const nextRawX = focusX + Math.cos(angle + 0.08) * localRadiusX;
        const nextRawY = focusY + Math.sin(angle + 0.08) * localRadiusY;
        const point = warpPoint(rawX, rawY, 0.5);
        const next = warpPoint(nextRawX, nextRawY, 0.5);
        const pulse = state.reduceMotion ? 0.46 : 0.5 + 0.5 * Math.sin(time * 2.2 + particle.phase);
        drawTraceParticle(
          point.x,
          point.y,
          mobile ? 1 : 1.16 + pulse * 0.18,
          particle.lane % 2 ? pal.lineC : pal.lineA,
          (0.28 + pulse * 0.2) * alpha,
          Math.atan2(next.y - point.y, next.x - point.x)
        );
      });

      ctx.save();
      drawRoundedRectPath(focusX - (mobile ? 11 : 14), focusY - (mobile ? 8 : 10), mobile ? 22 : 28, mobile ? 16 : 20, 6);
      ctx.globalAlpha = 0.18 * alpha;
      ctx.fillStyle = pal.lineB;
      ctx.fill();
      ctx.globalAlpha = 0.72 * alpha;
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      drawDot(focusX, focusY, mobile ? 2.4 : 3.1, pal.lineB, 0.78 * alpha);
      drawGuidePill("assistance", focusX, Math.max(b.top + 18, focusY - fieldRadiusY * 0.86), pal, "center", alpha);
    };

    const drawMode = (mode, time, pal, alpha) => {
      if (mode === "evaluate") {
        drawEvaluate(time, pal, alpha);
      } else if (mode === "situated") {
        drawSituated(time, pal, alpha);
      } else {
        drawDesign(time, pal, alpha);
      }
    };

    const render = (now) => {
      const time = state.reduceMotion ? 0.32 : now * 0.001;
      const pal = palette();

      updatePointer();
      ctx.clearRect(0, 0, state.width, state.height);
      drawBackground(pal);

      let progress = 1;
      if (state.previousMode && canCrossfadeModes()) {
        progress = clamp((now - state.transitionStart) / state.transitionMs, 0, 1);
      }

      if (state.previousMode && progress < 1) {
        const eased = easeOutCubic(progress);
        drawMode(state.previousMode, time, pal, 1 - eased);
        drawMode(state.mode, time, pal, eased);
      } else {
        state.previousMode = null;
        drawMode(state.mode, time, pal, 1);
      }

      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      render(now);
      if (!state.reduceMotion && state.visible && document.visibilityState === "visible") {
        state.raf = window.requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (state.reduceMotion || !state.visible || document.visibilityState !== "visible" || state.raf) return;
      state.raf = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!state.raf) return;
      window.cancelAnimationFrame(state.raf);
      state.raf = null;
    };

    const setMode = (mode) => {
      const nextMode = modeCopy[mode] ? mode : "design";
      const now = performance.now();

      if (nextMode !== state.mode) {
        state.previousMode = canCrossfadeModes() ? state.mode : null;
        state.transitionStart = now;
        state.mode = nextMode;
      }

      buttons.forEach((button) => {
        const isActive = button.getAttribute("data-research-mode") === state.mode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      details.forEach((detail) => {
        const isActive = detail.getAttribute("data-research-detail") === state.mode;
        detail.hidden = !isActive;
        detail.classList.toggle("is-active", isActive);
      });

      const activeButton = buttons.find((button) => button.getAttribute("data-research-mode") === state.mode);
      const label = activeButton?.querySelector("span")?.textContent || "Design";
      if (readout) readout.textContent = label;
      if (readoutSummary) readoutSummary.textContent = modeCopy[state.mode];
      if (status) status.textContent = `Showing the ${label} motion sketch. ${modeStatus[state.mode] || modeCopy[state.mode]}`;

      render(now);
      start();
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.getAttribute("data-research-mode")));
    });

    const updatePointerFromEvent = (event) => {
      if (state.reduceMotion) return;
      const rect = wrap.getBoundingClientRect();
      const dx = event.clientX < rect.left ? rect.left - event.clientX : event.clientX > rect.right ? event.clientX - rect.right : 0;
      const dy = event.clientY < rect.top ? rect.top - event.clientY : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0;
      const distance = Math.hypot(dx, dy);
      const cushion = clamp(Math.min(rect.width, rect.height) * 0.82, 160, 320);
      const proximity = clamp(1 - distance / cushion, 0, 1);
      const intent = easeOutCubic(proximity);

      state.pointer.active = intent > 0.02;
      state.pointer.targetIntent = intent;
      state.pointer.tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      state.pointer.ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      if (state.pointer.active) start();
    };

    section.addEventListener("pointermove", updatePointerFromEvent);

    section.addEventListener("pointerleave", () => {
      state.pointer.active = false;
      state.pointer.targetIntent = 0;
      state.pointer.tx = 0.5;
      state.pointer.ty = 0.5;
    });

    reduceMotionQuery.addEventListener("change", (event) => {
      state.reduceMotion = event.matches;
      state.previousMode = null;
      state.pointer.active = false;
      state.pointer.intent = 0;
      state.pointer.targetIntent = 0;
      state.pointer.tx = 0.5;
      state.pointer.ty = 0.5;
      if (state.reduceMotion) {
        stop();
        render(performance.now());
      } else {
        start();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    });

    window.addEventListener("siteThemeChange", () => render(performance.now()));

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          state.visible = entries.some((entry) => entry.isIntersecting);
          if (state.visible) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(wrap);
    }

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(wrap);
    } else {
      window.addEventListener("resize", resize);
    }

    resize();
    setMode(state.mode);
    if (state.reduceMotion) {
      render(performance.now());
    } else {
      start();
    }
  });
})();
