(function () {
  const root = document.documentElement;
  const wrap = document.querySelector("[data-research-motion]");
  if (!wrap) return;

  const section = wrap.closest("[data-home-section='focus']") || document;
  const canvas = wrap.querySelector("[data-research-motion-canvas]");
  const ctx = canvas.getContext("2d");
  const buttons = Array.from(section.querySelectorAll("[data-research-mode]"));
  const readout = section.querySelector("[data-research-motion-readout]");
  const readoutSummary = section.querySelector(".home-motion-readout strong");
  const status = section.querySelector("[data-research-motion-status]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const modeCopy = {
    design: "Comparison as a working surface",
    evaluate: "Evidence before decisions harden",
    situated: "Context changes the shape of help",
  };

  const state = {
    mode: buttons[0]?.getAttribute("data-research-mode") || "design",
    previousMode: null,
    transitionStart: 0,
    transitionMs: 520,
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
  const cssVar = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;

  const palette = () => ({
    bgA: cssVar("--research-motion-bg-a", "#fffaf6"),
    bgB: cssVar("--research-motion-bg-b", "#ffe3cb"),
    bgC: cssVar("--research-motion-bg-c", "#dceee7"),
    lineA: cssVar("--research-motion-line-a", "#e76f37"),
    lineB: cssVar("--research-motion-line-b", "#f3a43f"),
    lineC: cssVar("--research-motion-line-c", "#3d8c82"),
    dot: cssVar("--research-motion-dot", "#bf5c2a"),
    glow: cssVar("--research-motion-glow", "rgba(217, 107, 53, 0.28)"),
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

  const generateGeometry = () => {
    const mobile = state.width < 560;
    const tablet = state.width < 920;
    state.geometry = {
      design: makeSeries(mobile ? 28 : tablet ? 40 : 52),
      evaluate: makeSeries(mobile ? 24 : tablet ? 32 : 40),
      situated: makeSeries(mobile ? 30 : tablet ? 40 : 48),
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

  const drawBackground = (pal) => {
    const { width, height } = state;
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, pal.bgA);
    base.addColorStop(0.52, pal.bgC);
    base.addColorStop(1, pal.bgA);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 1.02, 0, width * 0.5, height * 1.02, Math.max(width, height) * 0.7);
    glow.addColorStop(0, pal.bgB);
    glow.addColorStop(0.42, pal.glow);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  };

  const updatePointer = () => {
    const speed = state.pointer.targetIntent > 0 ? 0.075 : 0.04;
    state.pointer.x = lerp(state.pointer.x, state.pointer.tx, speed);
    state.pointer.y = lerp(state.pointer.y, state.pointer.ty, speed);
    state.pointer.intent = lerp(state.pointer.intent, state.pointer.targetIntent, state.pointer.targetIntent > 0 ? 0.055 : 0.08);
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
    const pointerX = (state.pointer.x - 0.5) * lerp(8, 34, intent);
    const pointerY = (state.pointer.y - 0.5) * lerp(4, 18, intent);
    const centerX = b.cx + pointerX;
    const centerY = b.cy + pointerY;
    const leftX = b.left + b.width * 0.04;
    const rightX = b.right - b.width * 0.04;
    const top = b.top + b.height * 0.05;
    const bottom = b.bottom - b.height * 0.05;

    beginMode(pal, 0.54 * alpha, state.width < 560 ? 0.75 : 0.95);

    series.forEach(({ index, t, phase }) => {
      const y0 = lerp(top, bottom, t) + Math.sin(time * 0.7 + phase) * b.height * 0.025;
      const y1 = lerp(bottom, top, t) - Math.sin(time * 0.62 + phase) * b.height * 0.018;
      const compareLift = Math.sin(t * Math.PI) * b.height * 0.11;
      const pointerPull = (state.pointer.y - 0.5) * b.height * 0.08 * Math.sin(t * Math.PI) * intent;

      ctx.beginPath();
      ctx.moveTo(leftX, y0);
      ctx.bezierCurveTo(lerp(leftX, centerX, 0.35), y0 + compareLift, centerX - b.width * 0.1, centerY + pointerPull, centerX, centerY);
      ctx.bezierCurveTo(centerX + b.width * 0.1, centerY - pointerPull, lerp(centerX, rightX, 0.65), y1 - compareLift, rightX, y1);
      ctx.stroke();

      if (index % 4 === 0) {
        drawDot(leftX, y0, state.width < 560 ? 1.3 : 1.7, pal.dot, 0.62 * alpha);
        drawDot(rightX, y1, state.width < 560 ? 1.2 : 1.55, pal.dot, 0.5 * alpha);
      }
    });

    ctx.globalAlpha = 0.28 * alpha;
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
    drawDot(centerX, centerY, state.width < 560 ? 3 : 4, pal.lineB, 0.9 * alpha);
  };

  const drawEvaluate = (time, pal, alpha = 1) => {
    const b = plotBounds();
    const series = state.geometry.evaluate || [];
    const floor = b.bottom - b.height * 0.05;
    const top = b.top + b.height * 0.07;
    const pointerLift = (0.5 - state.pointer.y) * b.height * 0.12 * state.pointer.intent;

    beginMode(pal, 0.18 * alpha, 1);
    ctx.strokeStyle = pal.lineC;
    [0.25, 0.5, 0.75].forEach((mark) => {
      const y = lerp(top, floor, mark);
      ctx.beginPath();
      ctx.moveTo(b.left, y);
      ctx.lineTo(b.right, y);
      ctx.stroke();
    });
    endMode();

    beginMode(pal, 0.42 * alpha, state.width < 560 ? 0.75 : 0.95);
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
        drawDot(x, clamp(probeTop, top, floor), state.width < 560 ? 1.35 : 1.75, pal.dot, 0.62 * alpha);
      }
    });
    endMode();

    beginMode(pal, 0.72 * alpha, state.width < 560 ? 1 : 1.2);
    ctx.beginPath();
    series.forEach(({ t, phase }, index) => {
      const x = lerp(b.left + b.width * 0.05, b.right - b.width * 0.05, t);
      const y = floor - b.height * (0.26 + 0.23 * Math.sin(t * Math.PI)) - Math.sin(time * 0.65 + phase) * b.height * 0.025;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const scanX = lerp(b.left + b.width * 0.05, b.right - b.width * 0.05, state.reduceMotion ? 0.58 : (time * 0.07) % 1);
    ctx.globalAlpha = 0.45 * alpha;
    ctx.strokeStyle = pal.lineB;
    ctx.lineWidth = state.width < 560 ? 1.3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(scanX, top);
    ctx.lineTo(scanX, floor);
    ctx.stroke();
    endMode();
  };

  const drawSituated = (time, pal, alpha = 1) => {
    const b = plotBounds();
    const series = state.geometry.situated || [];
    const intent = state.pointer.intent;
    const centerX = b.cx + (state.pointer.x - 0.5) * lerp(b.width * 0.025, b.width * 0.1, intent);
    const centerY = b.cy + (state.pointer.y - 0.5) * lerp(b.height * 0.025, b.height * 0.12, intent);
    const radiusX = b.width * 0.36;
    const radiusY = b.height * 0.32;
    const anchors = [
      { x: b.left + b.width * 0.18, y: b.top + b.height * 0.28 },
      { x: b.left + b.width * 0.72, y: b.top + b.height * 0.2 },
      { x: b.left + b.width * 0.82, y: b.top + b.height * 0.72 },
      { x: b.left + b.width * 0.28, y: b.top + b.height * 0.8 },
    ];

    beginMode(pal, 0.16 * alpha, 1);
    ctx.strokeStyle = pal.lineC;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX * 0.42, radiusY * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    endMode();

    beginMode(pal, 0.48 * alpha, state.width < 560 ? 0.75 : 0.95);
    series.forEach(({ index, t, phase }) => {
      const source = anchors[index % anchors.length];
      const angle = Math.PI * 2 * t + Math.sin(time * 0.45 + phase) * 0.08;
      const targetX = clamp(centerX + Math.cos(angle) * radiusX, b.left, b.right);
      const targetY = clamp(centerY + Math.sin(angle) * radiusY, b.top, b.bottom);
      const bend = Math.sin(t * Math.PI * 2 + time * 0.35) * b.height * lerp(0.045, 0.08, intent);

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
        drawDot(targetX, targetY, state.width < 560 ? 1.3 : 1.75, pal.dot, 0.55 * alpha);
      }
    });
    endMode();

    anchors.forEach((anchor, index) => {
      drawDot(anchor.x, anchor.y, state.width < 560 ? 2.2 : 2.8, index % 2 ? pal.lineC : pal.lineA, 0.82 * alpha);
    });
    drawDot(centerX, centerY, state.width < 560 ? 3.4 : 4.4, pal.lineB, 0.92 * alpha);
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
    if (state.previousMode && !state.reduceMotion) {
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
      state.previousMode = state.reduceMotion ? null : state.mode;
      state.transitionStart = now;
      state.mode = nextMode;
    }

    buttons.forEach((button) => {
      const isActive = button.getAttribute("data-research-mode") === state.mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const activeButton = buttons.find((button) => button.getAttribute("data-research-mode") === state.mode);
    const label = activeButton?.querySelector("span")?.textContent || "Design";
    if (readout) readout.textContent = label;
    if (readoutSummary) readoutSummary.textContent = modeCopy[state.mode];
    if (status) status.textContent = `Showing the ${label} motion sketch. ${modeCopy[state.mode]}`;

    render(now);
    start();
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.getAttribute("data-research-mode")));
  });

  wrap.addEventListener("pointermove", (event) => {
    if (state.reduceMotion) return;
    const rect = wrap.getBoundingClientRect();
    state.pointer.active = true;
    state.pointer.targetIntent = 1;
    state.pointer.tx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    state.pointer.ty = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    start();
  });

  wrap.addEventListener("pointerleave", () => {
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
})();
