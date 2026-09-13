import { createPortrait } from "./portrait.mjs";
import { companion } from "./bridge.mjs";
import { choosePerch, clearAt, phrase, randomSource, spring } from "./behaviour.mjs";

const root = document.documentElement;
if (!document.querySelector(".pip-companion") && !location.pathname.startsWith("/ai/") && !document.querySelector("[data-ai-profile]")) start();

function start() {
  const params = new URLSearchParams(location.search),
    lab = params.has("companion-lab");
  const random = randomSource(lab ? Number(params.get("seed") || 41) : crypto.getRandomValues(new Uint32Array(1))[0]);
  const read = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* Private browsing still gets a companion. */
    }
  };
  const el = document.createElement("aside");
  el.className = "pip-companion";
  el.dataset.visible = "false";
  el.setAttribute("aria-label", "Pip, the little studio companion");
  el.innerHTML =
    '<canvas aria-hidden="true"></canvas><span class="pip-fallback" aria-hidden="true"></span><button class="pip-hit" aria-label="Say hello to Pip"></button><span class="pip-speech" aria-hidden="true"></span><button class="pip-nap" aria-label="Let Pip nap" title="Let Pip nap">☾</button>';
  document.body.append(el);
  let portrait;
  try {
    portrait = createPortrait(el.querySelector("canvas"));
  } catch {
    /* The composed CSS face is the graphics fallback. */
  }
  if (!portrait) el.dataset.fallback = "true";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    fine = matchMedia("(pointer:fine)");
  const hit = el.querySelector(".pip-hit"),
    nap = el.querySelector(".pip-nap"),
    bubble = el.querySelector(".pip-speech");
  companion.napping = read("pip-napping") === "1";
  companion.reduced = reduced.matches;
  let x = innerWidth - 85,
    y = 330,
    vx = 0,
    vy = 0,
    gx = 0,
    gy = 0,
    target = null,
    obstacles = [],
    rail;
  let raf = 0,
    last = 0,
    elapsed = 0,
    nextPerch = 0,
    lastLayout = 0,
    lastScroll = 0,
    lastPointer = -Infinity;
  let ignoreUntil = 0,
    nextWander = 9 + random() * 8,
    nextSpeech = 28 + random() * 25,
    speakingUntil = 0;
  let nextBump = 35 + random() * 28,
    bumpAnimation = null,
    repairAt = 0,
    section = "",
    priorSection = "",
    mode = "page";
  let nextBlink = 3 + random() * 4,
    blinkUntil = 0,
    worldEscapeUntil = 0,
    nextEscape = 35 + random() * 25,
    wasWorldVisible = false;
  let visible = false,
    frames = 0,
    layoutDirty = true,
    scrolled = false,
    disposed = false,
    bumpCount = 0,
    repaired = 0;
  const canvas = el.querySelector("canvas");
  canvas.addEventListener("webglcontextlost", (event) => {
    if (disposed) return;
    event.preventDefault();
    portrait = null;
    el.dataset.fallback = "true";
    request();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (disposed) return;
    try {
      portrait = createPortrait(canvas);
    } catch {
      portrait = null;
    }
    el.dataset.fallback = String(!portrait);
    request();
  });
  const saved = read("pip-arrival");
  if (saved) {
    try {
      const p = JSON.parse(saved);
      if (Date.now() - p.at < 15000) {
        x = p.x * innerWidth;
        y = p.y * innerHeight;
        nextSpeech = 3;
        scrolled = true;
      }
    } catch {
      /* Ignore an obsolete saved arrival. */
    }
  }

  function theme() {
    companion.theme = root.getAttribute("data-theme-setting") || root.getAttribute("data-theme-mode") || "noon";
    if (!["morning", "noon", "afternoon", "evening"].includes(companion.theme))
      companion.theme = root.getAttribute("data-theme") === "dark" ? "evening" : "noon";
    request();
  }
  function speak(event, explicit = false) {
    if (!explicit && (companion.napping || companion.reduced || !visible)) return;
    const box = { left: x - 180, right: x + 8, top: y - 116, bottom: y - 64 };
    if (!explicit && obstacles.some((r) => box.left < r.right && box.right > r.left && box.top < r.bottom && box.bottom > r.top)) return;
    bubble.textContent = phrase(location.pathname, section, event, random);
    speakingUntil = elapsed + 3.5;
    el.dataset.speaking = "true";
  }
  function refreshLayout() {
    const main = document.querySelector("#main") || document.querySelector("main");
    rail = main?.getBoundingClientRect();
    obstacles = [
      ...document.querySelectorAll(
        "#main h1,#main h2,#main h3,#main p,#main li,#main figure,#main img,#main pre,#main table,#main input,#main textarea,#main button,#main a,#main label,#main summary,#main .home-portrait-frame,#main .home-artifact-card,#main [data-home-desk-scene] canvas,#main .home-world-controls,header,nav.navbar,.ninja-keys,.modal.show,#back-to-top"
      ),
    ]
      .filter(
        (node) => !node.closest(".pip-companion") && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none"
      )
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 70 && r.top < innerHeight);
    const headings = [...document.querySelectorAll("#main h2,#main h1")];
    const near = headings
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top < innerHeight * 0.65 && rect.bottom > 0)
      .sort((a, b) => Math.abs(a.rect.top - innerHeight * 0.3) - Math.abs(b.rect.top - innerHeight * 0.3))[0];
    const sectionId = near?.node.closest("section")?.id;
    section =
      { work: "projects", focus: "research", taste: "research", students: "contact", publications: "publications", updates: "blog" }[sectionId] ||
      near?.node.textContent.trim() ||
      section;
    if (section !== priorSection) {
      priorSection = section;
      nextSpeech = Math.min(nextSpeech, elapsed + 9 + random() * 8);
    }
    layoutDirty = false;
    lastLayout = elapsed;
  }
  function dock() {
    const album = document.querySelector(".home-portrait-frame")?.getBoundingClientRect();
    const stage = document.querySelector("[data-home-artifact-stage]")?.getBoundingClientRect();
    if (album && stage && album.bottom > 100 && album.top < innerHeight - 140)
      return { x: Math.min(innerWidth - 60, stage.right - 48), y: Math.min(innerHeight - 80, album.bottom - 5) };
    return {
      x: Math.min(innerWidth - 52, (rail?.right || innerWidth) + 45),
      y: Math.min(innerHeight - 80, Math.max(145, lastScroll ? innerHeight * 0.62 : 330)),
    };
  }
  function choose(follow = false) {
    if (layoutDirty || elapsed - lastLayout > 0.7) refreshLayout();
    if (visible && el.matches(":hover,:focus-within") && clearAt(x, y, obstacles, innerWidth < 600 ? 68 : 82)) {
      target = { x, y };
      nextPerch = elapsed + 0.5;
      return;
    }
    let preferred = dock();
    if (follow && fine.matches && companion.pointer.at > 0 && elapsed - ignoreUntil > 0 && performance.now() - companion.pointer.at < 6000) {
      preferred = { x: companion.pointer.x + (companion.pointer.x > innerWidth / 2 ? -95 : 95), y: companion.pointer.y + 75 };
    } else if (elapsed > nextWander && !reduced.matches && !companion.napping) {
      preferred.y = 140 + random() * Math.max(10, innerHeight - 240);
      nextWander = elapsed + 12 + random() * 14;
      ignoreUntil = elapsed + 3 + random() * 5;
    }
    const size = innerWidth < 600 ? 68 : 82;
    target = choosePerch({ width: innerWidth, height: innerHeight, preferred, obstacles, size, rail });
    if (target && !visible) {
      x = target.x;
      y = target.y;
      vx = vy = 0;
    }
    visible = Boolean(target);
    nextPerch = elapsed + 0.5;
  }
  function restore() {
    if (bumpAnimation) {
      bumpAnimation.cancel();
      bumpAnimation = null;
      repaired++;
    }
    repairAt = 0;
  }
  function nudge(force = false) {
    if (companion.reduced || companion.napping || companion.paused || bumpAnimation) return false;
    const candidates = [...document.querySelectorAll(".home-artifact-card,#main .home-featured-title,#main h2")].filter(
      (node) =>
        !node.matches(":hover,:focus-within") && node.getBoundingClientRect().top > 100 && node.getBoundingClientRect().bottom < innerHeight - 70
    );
    const card = candidates.sort((a, b) => {
      const A = a.getBoundingClientRect(),
        B = b.getBoundingClientRect();
      return Math.hypot(A.right - x, A.top - y) - Math.hypot(B.right - x, B.top - y);
    })[0];
    if (!card) return false;
    const rect = card.getBoundingClientRect();
    if (!force && Math.hypot(rect.right - x, rect.top + rect.height * 0.5 - y) > 200) return false;
    bumpAnimation = card.animate(
      [
        { translate: "0 0", rotate: "0deg" },
        { translate: "0 7px", rotate: "1.5deg", offset: 0.14 },
        { translate: "0 7px", rotate: "1.5deg", offset: 0.64 },
        { translate: "0 -1px", rotate: "-.3deg", offset: 0.92 },
        { translate: "0 0", rotate: "0deg" },
      ],
      { duration: 2300, easing: "ease-in-out" }
    );
    companion.mood = 1;
    bumpCount++;
    repairAt = elapsed + 2.3;
    speak("bump", force);
    bumpAnimation.finished
      .then(() => {
        bumpAnimation = null;
        repaired++;
        repairAt = 0;
        companion.mood = 0;
        speak("repair", force);
      })
      .catch(() => {});
    return true;
  }
  function setNap(value) {
    companion.napping = value;
    write("pip-napping", value ? "1" : "0");
    el.dataset.napping = String(value);
    nap.setAttribute("aria-label", value ? "Wake Pip up" : "Let Pip nap");
    nap.title = value ? "Wake Pip up" : "Let Pip nap";
    nap.textContent = value ? "☀" : "☾";
    restore();
    request();
  }
  hit.addEventListener("click", () => {
    if (companion.napping) setNap(false);
    companion.boops++;
    companion.mood = 0.8;
    speak("hello", true);
    nextSpeech = elapsed + 45;
    request();
  });
  nap.addEventListener("click", () => setNap(!companion.napping));
  document.addEventListener(
    "pointermove",
    (event) => {
      companion.pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
      lastPointer = elapsed;
      request();
    },
    { passive: true }
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch") {
        companion.pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
        request();
      }
    },
    { passive: true }
  );
  document.addEventListener(
    "click",
    (event) => {
      const a = event.target.closest("a[href]");
      if (a && !a.href.startsWith("javascript:")) write("pip-arrival", JSON.stringify({ x: x / innerWidth, y: y / innerHeight, at: Date.now() }));
    },
    { capture: true }
  );
  window.addEventListener(
    "scroll",
    () => {
      layoutDirty = true;
      lastScroll = elapsed;
      scrolled = true;
      nextPerch = 0;
      request();
    },
    { passive: true }
  );
  window.addEventListener(
    "resize",
    () => {
      layoutDirty = true;
      nextPerch = 0;
      request();
    },
    { passive: true }
  );
  reduced.addEventListener("change", () => {
    companion.reduced = reduced.matches;
    restore();
    request();
  });
  const observer = new MutationObserver(() => {
    layoutDirty = true;
    theme();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-theme-setting", "data-theme-mode"] });
  const stage = document.querySelector("[data-home-artifact-stage]");
  if (stage)
    observer.observe(stage, { attributes: true, subtree: true, childList: true, attributeFilter: ["data-desk-mode", "data-scene-state", "class"] });
  document.addEventListener("visibilitychange", () => {
    last = 0;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      restore();
      el.dataset.speaking = "false";
    } else {
      layoutDirty = true;
      request();
    }
  });
  window.addEventListener("pagehide", (event) => {
    cancelAnimationFrame(raf);
    raf = 0;
    restore();
    if (!event.persisted) {
      disposed = true;
      portrait?.dispose();
      observer.disconnect();
    }
  });
  window.addEventListener("pageshow", () => {
    if (!disposed) {
      last = 0;
      request();
    }
  });
  document.fonts.ready.then(() => {
    layoutDirty = true;
    nextPerch = 0;
    request();
  });

  function request() {
    if (!raf && !document.hidden && !disposed) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const still = companion.reduced || companion.napping || companion.paused;
    elapsed += dt;
    if (layoutDirty || elapsed - lastLayout > 1.2) refreshLayout();
    const scene = document.querySelector("[data-home-desk-scene]"),
      rect = scene?.getBoundingClientRect();
    const worldVisible =
      stage?.dataset.deskMode === "3d" &&
      scene?.dataset.sceneState === "ready" &&
      rect?.bottom > innerHeight * 0.28 &&
      rect?.top < innerHeight * 0.62;
    if (worldVisible && !wasWorldVisible) nextEscape = elapsed + 35 + random() * 25;
    wasWorldVisible = Boolean(worldVisible);
    if (worldVisible && !still && elapsed > nextEscape) {
      worldEscapeUntil = elapsed + 7 + random() * 5;
      nextEscape = elapsed + 60 + random() * 45;
      companion.excursion = true;
    }
    const nextMode = worldVisible && elapsed > worldEscapeUntil ? "world" : "page";
    if (mode !== nextMode) {
      if (nextMode === "page" && companion.projected) {
        x = Math.max(45, Math.min(innerWidth - 45, companion.projected.x));
        y = Math.max(110, Math.min(innerHeight - 65, companion.projected.y));
        vx = 35;
        vy = -25;
        scrolled = true;
        nextSpeech = elapsed + 2;
      }
      mode = nextMode;
      companion.owner = mode;
      window.dispatchEvent(new Event("pip:change"));
      layoutDirty = true;
      nextPerch = 0;
    }
    if (mode === "world") {
      el.dataset.visible = "false";
      visible = false;
      el.dataset.speaking = "false";
    } else {
      if (elapsed >= nextPerch || !target || layoutDirty) choose(!still && elapsed - lastPointer < 5);
      if (target) {
        if (still) {
          x = target.x;
          y = target.y;
          vx = vy = 0;
        } else {
          [x, vx] = spring(x, vx, target.x, dt, 2.1);
          [y, vy] = spring(y, vy, target.y, dt, 2.1);
        }
        // If a moving page puts text under Pip, wait in the next clear gap.
        const clear = clearAt(x, y, obstacles, innerWidth < 600 ? 58 : 70);
        el.dataset.visible = String(visible && (clear || el.matches(":focus-within")));
        el.dataset.side = x < innerWidth / 2 ? "left" : "right";
        const w = innerWidth < 600 ? 72 : 88,
          h = innerWidth < 600 ? 92 : 112;
        el.style.transform = `translate3d(${(x - w / 2).toFixed(2)}px,${(y - h / 2).toFixed(2)}px,0) rotate(${still ? 0 : Math.max(-7, Math.min(7, vx * 0.055))}deg)`;
      }
      if (elapsed > nextSpeech) {
        speak(scrolled ? "catchup" : undefined);
        scrolled = false;
        nextSpeech = elapsed + 45 + random() * 35;
      }
      if (elapsed > nextBump && !still) {
        if (random() < 0.55) nudge();
        nextBump = elapsed + 55 + random() * 45;
      }
      if (elapsed > speakingUntil) el.dataset.speaking = "false";
      if (!still && elapsed > nextBlink) {
        blinkUntil = elapsed + 0.17;
        nextBlink = elapsed + 3 + random() * 5;
      }
      const glance = companion.pointer.at > 0 && performance.now() - companion.pointer.at < 6000 && elapsed > ignoreUntil && !still;
      gx += (Math.max(-1, Math.min(1, (companion.pointer.x - x) / 180)) * (glance ? 1 : 0) - gx) * 0.09;
      gy += (Math.max(-1, Math.min(1, (y - companion.pointer.y) / 160)) * (glance ? 1 : 0) - gy) * 0.09;
      companion.mood *= Math.exp(-dt * 1.5);
      if (visible)
        portrait?.draw({
          time: still ? 0 : elapsed,
          gaze: [gx, gy],
          blink: companion.napping ? 1 : elapsed < blinkUntil ? Math.sin(((blinkUntil - elapsed) / 0.17) * Math.PI) : 0,
          mood: companion.mood,
          theme: companion.theme,
        });
    }
    el.inert = el.dataset.visible !== "true";
    el.setAttribute("aria-hidden", String(el.inert));
    frames++;
    if (!still || speakingUntil > elapsed) request();
  }
  el.getCompanionEvidence = () => ({
    owner: companion.owner,
    x,
    y,
    target: target ? { x: target.x, y: target.y } : null,
    gaze: [gx, gy],
    visible: el.dataset.visible === "true",
    napping: companion.napping,
    reduced: companion.reduced,
    theme: companion.theme,
    frames,
    bumpCount,
    repaired,
    repairing: Boolean(bumpAnimation),
    text: bubble.textContent,
    renderer: portrait ? "webgl" : "css",
  });
  if (lab)
    el.previewCompanion = (action) => {
      if (action === "bump") return nudge(true);
      if (action === "speak") speak(undefined, true);
      if (action === "escape") {
        worldEscapeUntil = elapsed + 10;
        nextPerch = 0;
      }
      request();
    };
  setNap(companion.napping);
  theme();
  request();
}
