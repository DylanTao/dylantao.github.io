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

    const knownModes = new Set(["design", "evaluate", "situated"]);
    const buttonForMode = (mode) => buttons.find((button) => button.getAttribute("data-research-mode") === mode);
    const getModeSummary = (mode) => {
      const button = buttonForMode(mode);
      return button?.getAttribute("data-research-summary") || button?.querySelector("small")?.textContent?.trim() || "";
    };

    const state = {
      mode: buttons[0]?.getAttribute("data-research-mode") || "design",
      previousMode: null,
      transitionStart: 0,
      transitionMs: 420,
      pulseStartedAt: Number.NEGATIVE_INFINITY,
      kineticEnergy: 0,
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
        design: makeSeries(mobile ? 22 : tablet ? 32 : 38),
        evaluate: makeSeries(mobile ? 20 : tablet ? 28 : 34),
        situated: makeSeries(mobile ? 24 : tablet ? 32 : 38),
        particles: {
          design: makeParticles(mobile ? 7 : tablet ? 10 : 14, mobile ? 3 : 5),
          evaluate: makeParticles(mobile ? 8 : tablet ? 11 : 15, mobile ? 3 : 6),
          situated: makeParticles(mobile ? 7 : tablet ? 10 : 14, 4),
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

    const drawTraceParticle = (x, y, radius, fill, alpha = 1, angle = 0, energy = 0) => {
      const boundedEnergy = clamp(energy, 0, 1);
      const trailLength = lerp(4.6, 7.2, boundedEnergy);
      const glowRadius = lerp(3, 3.8, boundedEnergy);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha * lerp(0.24, 0.42, boundedEnergy);
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(0.7, radius * lerp(0.4, 0.54, boundedEnergy));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-radius * trailLength, 0);
      ctx.lineTo(-radius * 1.5, 0);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * glowRadius);
      glow.addColorStop(0, fill);
      glow.addColorStop(0.34, fill);
      glow.addColorStop(1, transparentColor(fill));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius * glowRadius, 0, Math.PI * 2);
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

    const updateKineticEnergy = (now) => {
      if (state.reduceMotion) {
        state.kineticEnergy = 0;
      } else {
        const modePulse = clamp(1 - (now - state.pulseStartedAt) / 860, 0, 1);
        state.kineticEnergy = clamp(Math.max(state.pointer.intent, modePulse * 0.72), 0, 1);
      }

      const energyState = state.kineticEnergy > 0.12 ? "engaged" : "resting";
      if (wrap.getAttribute("data-motion-energy") !== energyState) {
        wrap.setAttribute("data-motion-energy", energyState);
      }
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
      const intent = state.pointer.intent;
      const kineticEnergy = state.kineticEnergy;
      const pointerX = (state.pointer.x - 0.5) * lerp(12, 52, intent);
      const pointerY = (state.pointer.y - 0.5) * lerp(6, 28, intent);
      const centerX = b.cx + pointerX;
      const centerY = b.cy + pointerY;
      const leftX = b.left + b.width * 0.04;
      const rightX = b.right - b.width * 0.04;
      const top = b.top + b.height * 0.05;
      const bottom = b.bottom - b.height * 0.05;

      beginMode(pal, 0.34 * alpha, state.width < 560 ? 0.7 : 0.82);
      series.forEach(({ index, t, phase }) => {
        const y0 = lerp(top, bottom, t) + Math.sin(time * 0.7 + phase) * b.height * 0.025;
        const y1 = lerp(bottom, top, t) - Math.sin(time * 0.62 + phase) * b.height * 0.018;
        const compareLift = Math.sin(t * Math.PI) * b.height * 0.11;
        const pointerPull = (state.pointer.y - 0.5) * b.height * 0.13 * Math.sin(t * Math.PI) * intent;

        ctx.beginPath();
        ctx.moveTo(leftX, y0);
        ctx.bezierCurveTo(lerp(leftX, centerX, 0.35), y0 + compareLift, centerX - b.width * 0.1, centerY + pointerPull, centerX, centerY);
        ctx.bezierCurveTo(centerX + b.width * 0.1, centerY - pointerPull, lerp(centerX, rightX, 0.65), y1 - compareLift, rightX, y1);
        ctx.stroke();

        if (index % 4 === 0) {
          drawDot(leftX, y0, state.width < 560 ? 1.2 : 1.5, pal.dot, 0.44 * alpha);
          drawDot(rightX, y1, state.width < 560 ? 1.1 : 1.4, pal.dot, 0.38 * alpha);
        }
      });

      ctx.globalAlpha = 0.18 * alpha;
      ctx.strokeStyle = pal.lineC;
      ctx.lineWidth = 1;
      [0.38, 0.5, 0.62].forEach((mark) => {
        const x = lerp(b.left, b.right, mark);
        ctx.beginPath();
        ctx.moveTo(x, b.top + b.height * 0.18);
        ctx.lineTo(x, b.bottom - b.height * 0.18);
        ctx.stroke();
      });

      endMode();

      const designParticles = state.geometry.particles?.design || [];
      designParticles.forEach((particle) => {
        const laneCount = state.width < 560 ? 3 : 5;
        const laneT = clamp((particle.lane + 0.55) / laneCount, 0.08, 0.92);
        const routeSpeed = lerp(0.9, 1.58, kineticEnergy);
        const routeT = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.035 * particle.speed * routeSpeed);
        const y0 = lerp(top, bottom, laneT) + Math.sin(time * 0.48 + particle.phase) * b.height * 0.015;
        const y1 = lerp(bottom, top, laneT) - Math.sin(time * 0.44 + particle.phase) * b.height * 0.012;
        const compareLift = Math.sin(laneT * Math.PI) * b.height * 0.11;
        const pointerPull = (state.pointer.y - 0.5) * b.height * 0.1 * Math.sin(laneT * Math.PI) * intent;
        const localT = routeT < 0.5 ? routeT * 2 : (routeT - 0.5) * 2;
        const firstHalf = routeT < 0.5;
        const x = firstHalf
          ? cubic(leftX, lerp(leftX, centerX, 0.35), centerX - b.width * 0.1, centerX, localT)
          : cubic(centerX, centerX + b.width * 0.1, lerp(centerX, rightX, 0.65), rightX, localT);
        const y = firstHalf
          ? cubic(y0, y0 + compareLift, centerY + pointerPull, centerY, localT)
          : cubic(centerY, centerY - pointerPull, y1 - compareLift, y1, localT);
        const angle = firstHalf ? Math.atan2(centerY - y0, centerX - leftX) : Math.atan2(y1 - centerY, rightX - centerX);
        const particleAlpha = state.reduceMotion ? 0.34 : 0.3 + 0.22 * Math.sin(routeT * Math.PI);
        drawTraceParticle(
          x,
          y,
          state.width < 560 ? 1 : 1.25,
          particle.lane % 2 ? pal.lineC : pal.lineB,
          particleAlpha * lerp(0.92, 1.16, kineticEnergy) * alpha,
          angle,
          kineticEnergy
        );
      });

      drawDot(centerX, centerY, state.width < 560 ? 2.8 : 3.6, pal.lineB, 0.74 * alpha);

      drawGuideLabel("vary", leftX, b.bottom + 20, pal, "left", alpha);
      drawGuidePill("compare", centerX, centerY - b.height * 0.24, pal, "center", alpha);
      drawGuideLabel("refine", rightX, b.bottom + 20, pal, "right", alpha);
    };

    const drawEvaluate = (time, pal, alpha = 1) => {
      const b = plotBounds();
      const series = state.geometry.evaluate || [];
      const floor = b.bottom - b.height * 0.05;
      const top = b.top + b.height * 0.07;
      const pointerLift = (0.5 - state.pointer.y) * b.height * 0.18 * state.pointer.intent;
      const kineticEnergy = state.kineticEnergy;
      const scanT = state.reduceMotion ? 0.58 : wrap01(time * 0.11 * lerp(0.9, 1.46, kineticEnergy));
      const scanX = lerp(b.left + b.width * 0.05, b.right - b.width * 0.05, scanT);

      beginMode(pal, 0.14 * alpha, 1);
      ctx.strokeStyle = pal.lineC;
      [0.25, 0.5, 0.75].forEach((mark) => {
        const y = lerp(top, floor, mark);
        ctx.beginPath();
        ctx.moveTo(b.left, y);
        ctx.lineTo(b.right, y);
        ctx.stroke();
      });
      endMode();

      ctx.save();
      const scanBand = ctx.createLinearGradient(scanX - 46, 0, scanX + 46, 0);
      scanBand.addColorStop(0, transparentColor(pal.bgB));
      scanBand.addColorStop(0.48, pal.bgB);
      scanBand.addColorStop(1, transparentColor(pal.bgB));
      ctx.globalAlpha = 0.2 * alpha;
      ctx.fillStyle = scanBand;
      ctx.fillRect(scanX - 46, top, 92, floor - top);
      ctx.restore();

      beginMode(pal, 0.32 * alpha, state.width < 560 ? 0.7 : 0.82);
      series.forEach(({ index, t, phase }) => {
        const x = lerp(b.left + b.width * 0.05, b.right - b.width * 0.05, t);
        const evidence = 0.35 + 0.32 * Math.sin(t * Math.PI) + 0.07 * Math.sin(time * 0.85 + phase);
        const y = floor - b.height * evidence + pointerLift * Math.sin(t * Math.PI);
        const probeTop = y - b.height * (0.09 + 0.05 * Math.cos(time * 0.7 + phase));

        ctx.beginPath();
        ctx.moveTo(x, floor);
        ctx.lineTo(x, clamp(probeTop, top, floor));
        ctx.stroke();

        if (index % 3 === 0) {
          drawDot(x, clamp(probeTop, top, floor), state.width < 560 ? 1.2 : 1.5, pal.dot, 0.48 * alpha);
        }
      });
      endMode();

      beginMode(pal, 0.54 * alpha, state.width < 560 ? 0.9 : 1.05);
      ctx.beginPath();
      series.forEach(({ t, phase }, index) => {
        const x = lerp(b.left + b.width * 0.05, b.right - b.width * 0.05, t);
        const y = floor - b.height * (0.26 + 0.23 * Math.sin(t * Math.PI)) - Math.sin(time * 0.65 + phase) * b.height * 0.025;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.globalAlpha = 0.32 * alpha;
      ctx.strokeStyle = pal.lineB;
      ctx.lineWidth = state.width < 560 ? 1.1 : 1.45;
      ctx.beginPath();
      ctx.moveTo(scanX, top);
      ctx.lineTo(scanX, floor);
      ctx.stroke();
      endMode();

      const evaluateParticles = state.geometry.particles?.evaluate || [];
      evaluateParticles.forEach((particle) => {
        const progress = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.085 * particle.speed * lerp(0.9, 1.62, kineticEnergy));
        const x = lerp(b.left + b.width * 0.06, b.right - b.width * 0.06, progress);
        const evidence = 0.22 + 0.34 * Math.sin(progress * Math.PI) + 0.035 * Math.sin(time * 1.8 + particle.phase);
        const y = floor - b.height * evidence + pointerLift * Math.sin(progress * Math.PI) * 0.7;
        const pulse = state.reduceMotion ? 0.58 : 0.5 + 0.5 * Math.sin(time * 3.2 + particle.phase);
        const color = particle.lane % 3 === 0 ? pal.lineB : particle.lane % 3 === 1 ? pal.lineA : pal.lineC;
        drawTraceParticle(
          x,
          clamp(y, top, floor),
          state.width < 560 ? 1 : 1.25 + pulse * 0.28,
          color,
          (0.22 + pulse * 0.22) * lerp(0.92, 1.14, kineticEnergy) * alpha,
          -Math.PI / 2,
          kineticEnergy
        );
      });

      drawGuideLabel("trace", b.left + b.width * 0.05, floor + 20, pal, "left", alpha);
      drawGuidePill("evidence", scanX, top - 18, pal, "center", alpha);
      drawGuideLabel("revise", b.right - b.width * 0.05, floor + 20, pal, "right", alpha);
    };

    const drawSituated = (time, pal, alpha = 1) => {
      const b = plotBounds();
      const series = state.geometry.situated || [];
      const intent = state.pointer.intent;
      const kineticEnergy = state.kineticEnergy;
      const centerX = b.cx + (state.pointer.x - 0.5) * lerp(b.width * 0.02, b.width * 0.082, intent);
      const centerY = b.cy + (state.pointer.y - 0.5) * lerp(b.height * 0.02, b.height * 0.088, intent);
      const radiusX = b.width * 0.36;
      const radiusY = b.height * 0.32;
      const anchors = [
        { x: b.left + b.width * 0.18, y: b.top + b.height * 0.28 },
        { x: b.left + b.width * 0.72, y: b.top + b.height * 0.2 },
        { x: b.left + b.width * 0.82, y: b.top + b.height * 0.72 },
        { x: b.left + b.width * 0.28, y: b.top + b.height * 0.8 },
      ];

      beginMode(pal, 0.12 * alpha, 1);
      ctx.strokeStyle = pal.lineC;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX * 0.42, radiusY * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      endMode();

      beginMode(pal, 0.34 * alpha, state.width < 560 ? 0.7 : 0.82);
      series.forEach(({ index, t, phase }) => {
        const source = anchors[index % anchors.length];
        const angle = Math.PI * 2 * t + Math.sin(time * 0.45 + phase) * 0.08;
        const targetX = clamp(centerX + Math.cos(angle) * radiusX, b.left, b.right);
        const targetY = clamp(centerY + Math.sin(angle) * radiusY, b.top, b.bottom);
        const bend = Math.sin(t * Math.PI * 2 + time * 0.35) * b.height * lerp(0.04, 0.072, intent);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.bezierCurveTo(
          lerp(source.x, centerX, 0.42),
          lerp(source.y, centerY, 0.42) - bend,
          lerp(targetX, centerX, 0.42),
          lerp(targetY, centerY, 0.42) + bend,
          targetX,
          targetY
        );
        ctx.stroke();

        if (index % 6 === 0) {
          drawDot(targetX, targetY, state.width < 560 ? 1.2 : 1.5, pal.dot, 0.42 * alpha);
        }
      });
      endMode();

      anchors.forEach((anchor, index) => {
        drawDot(anchor.x, anchor.y, state.width < 560 ? 2 : 2.55, index % 2 ? pal.lineC : pal.lineA, 0.72 * alpha);
      });

      if (state.width >= 580) {
        ["person", "task", "tool", "space"].forEach((label, index) => {
          const anchor = anchors[index];
          const xOffset = index === 0 || index === 3 ? -10 : 10;
          const align = index === 0 || index === 3 ? "right" : "left";
          drawGuideLabel(label, anchor.x + xOffset, anchor.y - 14, pal, align, alpha);
        });
      }

      const situatedParticles = state.geometry.particles?.situated || [];
      situatedParticles.forEach((particle) => {
        const source = anchors[particle.lane % anchors.length];
        const speedScale = lerp(0.9, 1.56, kineticEnergy);
        const orbit = state.reduceMotion ? particle.seed : wrap01(particle.seed + time * 0.032 * particle.speed * speedScale);
        const travel = state.reduceMotion ? wrap01(particle.seed + 0.28) : wrap01(particle.seed + time * 0.072 * particle.speed * speedScale);
        const angle = Math.PI * 2 * orbit + Math.sin(time * 0.38 + particle.phase) * 0.06;
        const targetX = clamp(centerX + Math.cos(angle) * radiusX, b.left, b.right);
        const targetY = clamp(centerY + Math.sin(angle) * radiusY, b.top, b.bottom);
        const bend = Math.sin(particle.seed * Math.PI * 2 + time * 0.28) * b.height * 0.05;
        const x = cubic(source.x, lerp(source.x, centerX, 0.42), lerp(targetX, centerX, 0.42), targetX, travel);
        const y = cubic(source.y, lerp(source.y, centerY, 0.42) - bend, lerp(targetY, centerY, 0.42) + bend, targetY, travel);
        const nextX = cubic(source.x, lerp(source.x, centerX, 0.42), lerp(targetX, centerX, 0.42), targetX, clamp(travel + 0.02, 0, 1));
        const nextY = cubic(source.y, lerp(source.y, centerY, 0.42) - bend, lerp(targetY, centerY, 0.42) + bend, targetY, clamp(travel + 0.02, 0, 1));
        drawTraceParticle(
          x,
          y,
          state.width < 560 ? 1 : 1.2,
          particle.lane % 2 ? pal.lineC : pal.lineA,
          0.28 * lerp(0.92, 1.2, kineticEnergy) * alpha,
          Math.atan2(nextY - y, nextX - x),
          kineticEnergy
        );
      });

      drawDot(centerX, centerY, state.width < 560 ? 3 : 3.8, pal.lineB, 0.78 * alpha);
      drawGuidePill("context", centerX, centerY - radiusY * 0.62, pal, "center", alpha);
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
      updateKineticEnergy(now);
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
      const hasButtonMode = Boolean(buttonForMode(mode));
      const nextMode = hasButtonMode || knownModes.has(mode) ? mode : "design";
      const now = performance.now();

      if (nextMode !== state.mode) {
        state.previousMode = canCrossfadeModes() ? state.mode : null;
        state.transitionStart = now;
        state.pulseStartedAt = now;
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

      const activeButton = buttonForMode(state.mode);
      const label = activeButton?.querySelector("span")?.textContent || "Design";
      const summary = getModeSummary(state.mode);
      if (readout) readout.textContent = label;
      if (readoutSummary) readoutSummary.textContent = summary;
      if (status) status.textContent = `Showing the ${label} motion sketch.${summary ? ` ${summary}` : ""}`;

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
