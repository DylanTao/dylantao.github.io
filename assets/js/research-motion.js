(function () {
  const root = document.documentElement;
  const wrap = document.querySelector("[data-research-motion]");
  if (!wrap) return;

  const canvas = wrap.querySelector("[data-research-motion-canvas]");
  const ctx = canvas.getContext("2d");
  const buttons = Array.from(document.querySelectorAll("[data-research-mode]"));
  const readout = document.querySelector("[data-research-motion-readout]");
  const readoutSummary = document.querySelector(".home-motion-readout strong");
  const status = document.querySelector("[data-research-motion-status]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const modeCopy = {
    design: "Comparison as a working surface",
    evaluate: "Evidence before decisions harden",
    situated: "Context changes the shape of help",
  };

  const state = {
    mode: buttons[0]?.getAttribute("data-research-mode") || "design",
    width: 0,
    height: 0,
    dpr: 1,
    raf: null,
    visible: true,
    reduceMotion: reduceMotionQuery.matches,
    pointer: {
      active: false,
      x: 0.5,
      y: 0.5,
      tx: 0.5,
      ty: 0.5,
    },
  };

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

  const resize = () => {
    const rect = wrap.getBoundingClientRect();
    state.width = Math.max(1, Math.floor(rect.width));
    state.height = Math.max(1, Math.floor(rect.height));
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    render(performance.now());
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  const drawDot = (x, y, radius, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const drawBackground = (pal) => {
    const { width, height } = state;
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, pal.bgA);
    base.addColorStop(0.55, pal.bgC);
    base.addColorStop(1, pal.bgA);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.52, height * 0.98, 0, width * 0.52, height * 0.98, Math.max(width, height) * 0.72);
    glow.addColorStop(0, pal.bgB);
    glow.addColorStop(0.42, pal.glow);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  };

  const updatePointer = () => {
    const speed = state.pointer.active ? 0.11 : 0.035;
    state.pointer.x = lerp(state.pointer.x, state.pointer.tx, speed);
    state.pointer.y = lerp(state.pointer.y, state.pointer.ty, speed);
  };

  const makeStroke = (pal, alpha = 1) => {
    const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
    gradient.addColorStop(0, pal.lineA);
    gradient.addColorStop(0.5, pal.lineB);
    gradient.addColorStop(1, pal.lineC);
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const drawDesign = (time, pal) => {
    const { width, height } = state;
    const count = width < 520 ? 34 : 64;
    const centerX = width * 0.5 + (state.pointer.x - 0.5) * (state.pointer.active ? 34 : 10);
    const centerY = height * 0.55 + (state.pointer.y - 0.5) * (state.pointer.active ? 18 : 6);
    const leftX = width * 0.14;
    const rightX = width * 0.86;
    const top = height * 0.2;
    const bottom = height * 0.78;

    makeStroke(pal, 0.58);
    ctx.lineWidth = width < 520 ? 0.85 : 1.05;

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const wave = Math.sin(time * 0.8 + i * 0.37) * height * 0.018;
      const y0 = lerp(top, bottom, t) + wave;
      const y1 = lerp(bottom, top, t) - wave * 0.6;
      const spread = Math.sin(t * Math.PI) * height * 0.08;
      const pull = state.pointer.active ? (state.pointer.y - 0.5) * height * 0.08 * Math.sin(t * Math.PI) : 0;

      ctx.beginPath();
      ctx.moveTo(leftX, y0);
      ctx.bezierCurveTo(width * 0.28, y0 + spread, centerX - width * 0.12, centerY + pull, centerX, centerY);
      ctx.bezierCurveTo(centerX + width * 0.12, centerY - pull, width * 0.72, y1 - spread, rightX, y1);
      ctx.stroke();

      if (i % 2 === 0) {
        drawDot(leftX, y0, width < 520 ? 1.4 : 1.8, pal.dot);
        drawDot(rightX, y1, width < 520 ? 1.2 : 1.6, pal.dot);
      }
    }

    ctx.globalAlpha = 0.9;
    drawDot(centerX, centerY, width < 520 ? 3.2 : 4.2, pal.lineB);
  };

  const drawEvaluate = (time, pal) => {
    const { width, height } = state;
    const count = width < 520 ? 28 : 48;
    const left = width * 0.12;
    const right = width * 0.88;
    const floor = height * 0.82;
    const span = right - left;
    const pointerLift = state.pointer.active ? (0.5 - state.pointer.y) * height * 0.16 : 0;

    makeStroke(pal, 0.42);
    ctx.lineWidth = width < 520 ? 0.8 : 1;

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const x = left + span * t;
      const curve = Math.sin(t * Math.PI * 1.18 + time * 0.7) * height * 0.08;
      const heightValue = height * (0.34 + 0.24 * Math.sin(t * Math.PI) + 0.07 * Math.cos(time * 1.1 + i));
      const y = floor - heightValue - curve + pointerLift * Math.sin(t * Math.PI);

      ctx.beginPath();
      ctx.moveTo(x, floor);
      ctx.lineTo(x, y);
      ctx.stroke();

      if (i % 3 === 0) {
        drawDot(x, y, width < 520 ? 1.5 : 2, pal.dot);
      }
    }

    makeStroke(pal, 0.68);
    ctx.lineWidth = width < 520 ? 1.1 : 1.35;
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const x = left + span * t;
      const y = floor - height * (0.2 + 0.22 * Math.sin(t * Math.PI)) - Math.sin(time * 0.9 + t * 5.2) * height * 0.04;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const scanX = left + ((time * 0.08) % 1) * span;
    ctx.globalAlpha = 0.46;
    ctx.strokeStyle = pal.lineB;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scanX, height * 0.18);
    ctx.lineTo(scanX, floor);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawSituated = (time, pal) => {
    const { width, height } = state;
    const count = width < 520 ? 36 : 62;
    const anchorX = width * (state.pointer.active ? lerp(0.34, 0.66, state.pointer.x) : 0.38);
    const anchorY = height * (state.pointer.active ? lerp(0.36, 0.66, state.pointer.y) : 0.52);
    const radius = Math.min(width, height) * 0.56;

    makeStroke(pal, 0.5);
    ctx.lineWidth = width < 520 ? 0.85 : 1.05;

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = -Math.PI * 0.9 + t * Math.PI * 1.55;
      const drift = Math.sin(time * 0.65 + i * 0.23) * 0.1;
      const x0 = width * 0.5 + Math.cos(angle + drift) * radius;
      const y0 = height * 0.85 + Math.sin(angle + drift) * radius * 0.62;
      const x1 = width * 0.52 + Math.cos(angle * 0.72 - drift) * radius * 0.72;
      const y1 = height * 0.86 + Math.sin(angle * 0.72 - drift) * radius * 0.46;
      const bend = Math.sin(t * Math.PI) * height * 0.22;

      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.bezierCurveTo(anchorX + (x0 - anchorX) * 0.3, anchorY - bend, x1, y1 - bend * 0.25, x0, y0);
      ctx.stroke();

      if (i % 4 === 0) {
        drawDot(x0, y0, width < 520 ? 1.5 : 2, pal.dot);
      }
    }

    ctx.globalAlpha = 0.82;
    drawDot(anchorX, anchorY, width < 520 ? 4 : 5, pal.lineB);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = pal.lineC;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, Math.min(width, height) * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const render = (now) => {
    const time = state.reduceMotion ? 0.2 : now * 0.001;
    const pal = palette();

    updatePointer();
    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground(pal);

    if (state.mode === "evaluate") {
      drawEvaluate(time, pal);
    } else if (state.mode === "situated") {
      drawSituated(time, pal);
    } else {
      drawDesign(time, pal);
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
    state.mode = modeCopy[mode] ? mode : "design";

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

    render(performance.now());
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.getAttribute("data-research-mode")));
  });

  wrap.addEventListener("pointermove", (event) => {
    const rect = wrap.getBoundingClientRect();
    state.pointer.active = true;
    state.pointer.tx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    state.pointer.ty = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  });

  wrap.addEventListener("pointerleave", () => {
    state.pointer.active = false;
    state.pointer.tx = 0.5;
    state.pointer.ty = 0.5;
  });

  reduceMotionQuery.addEventListener("change", (event) => {
    state.reduceMotion = event.matches;
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
