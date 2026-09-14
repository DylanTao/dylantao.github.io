import { createPortrait } from "./portrait.mjs";
import { companion, pipProjectUrl } from "./bridge.mjs";
import { choosePerch, clearAt, phrase, randomSource, spring } from "./behaviour.mjs";
import { planTravel, sampleTravel, segmentClear } from "./travel.mjs";

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
  el.setAttribute("aria-label", "P, the little studio companion");
  el.innerHTML =
    '<canvas aria-hidden="true"></canvas><span class="pip-fallback" aria-hidden="true"><svg viewBox="0 0 88 112"><defs><linearGradient id="pip-shell" x2="0.8" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#bbcbd0"/></linearGradient></defs><ellipse cx="44" cy="103" rx="20" ry="3" fill="#12222c" opacity=".16"/><g fill="url(#pip-shell)" stroke="#8a9da3" stroke-width=".55"><path d="M25 29 19 10M62 29 69 10" stroke-width="1.2"/><rect x="15" y="27" width="58" height="32" rx="12"/><path d="M44 61C20 60 30 95 44 96C58 95 68 60 44 61Z"/><ellipse cx="25" cy="75" rx="3" ry="10"/><ellipse cx="63" cy="75" rx="3" ry="10"/></g><path d="M35 43h17" stroke="#263941" stroke-width="2"/><g fill="#10222b" stroke="#647f8b"><circle cx="32" cy="43" r="10"/><circle cx="57" cy="43" r="8"/></g><g fill="var(--global-theme-color, #6fc6ca)"><ellipse cx="32" cy="43" rx="3.4" ry="5.2"/><ellipse cx="57" cy="43" rx="3" ry="4.5"/></g><g fill="#fff" opacity=".75"><ellipse cx="29" cy="38" rx="2.4" ry="1.3"/><ellipse cx="55" cy="39" rx="1.6" ry=".8"/></g><circle cx="48" cy="70" r="1.5" fill="#f07a38"/></svg></span><a class="pip-hit" aria-label="Meet P, the floating studio companion" title="Meet P"><span class="pip-label" aria-hidden="true">Meet P ↗</span></a><span class="pip-speech" aria-hidden="true"></span>';
  document.body.append(el);
  const portals = document.createElement("div");
  portals.className = "pip-portals";
  portals.setAttribute("aria-hidden", "true");
  portals.innerHTML = '<span class="pip-portal"></span><span class="pip-portal"></span>';
  document.body.append(portals);
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
    bubble = el.querySelector(".pip-speech");
  hit.href = pipProjectUrl;
  companion.napping = false;
  try {
    sessionStorage.removeItem("pip-napping");
  } catch {
    /* Optional storage. */
  }
  let restTimer = 0;
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
    nextWander = 4 + random() * 4,
    nextSpeech = 28 + random() * 25,
    speakingUntil = 0;
  let nextBump = 55 + random() * 50,
    bumpAnimation = null,
    repairAt = 0,
    section = "",
    priorSection = "",
    mode = "page";
  let journey = null,
    journeyStart = 0,
    contact = null,
    travelPose = null,
    lastTravel = "rest",
    lastEncounter = "none";
  const travels = { fly: 0, squeeze: 0, portal: 0 };
  let invitation = null,
    invitedUntil = 0;
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
    if (journey) return;
    el.dataset.speaking = "false";
    bubble.textContent = phrase(location.pathname, section, event, random);
    bubble.style.translate = "none";
    const rect = bubble.getBoundingClientRect(),
      gap = (innerWidth < 600 ? 68 : 82) * 0.55 + 10;
    const positions = [
      { left: rect.left, top: rect.top },
      { left: x - rect.width / 2, top: y + gap },
      { left: x - gap - rect.width, top: y - rect.height / 2 },
      { left: x + gap, top: y - rect.height / 2 },
    ];
    const position = positions.find(
      (p) =>
        p.left > 10 &&
        p.top > 90 &&
        p.left + rect.width < innerWidth - 10 &&
        p.top + rect.height < innerHeight - 12 &&
        !obstacles.some((r) => p.left < r.right + 6 && p.left + rect.width > r.left - 6 && p.top < r.bottom + 6 && p.top + rect.height > r.top - 6)
    );
    if (!position) return;
    bubble.style.translate = `${position.left - rect.left}px ${position.top - rect.top}px`;
    speakingUntil = elapsed + 3.5;
    el.dataset.speaking = "true";
  }
  function refreshLayout() {
    const main = document.querySelector("#main") || document.querySelector("main");
    rail = main?.getBoundingClientRect();
    obstacles = [
      ...document.querySelectorAll(
        "#main h1,#main h2,#main h3,#main p,#main li,#main figure,#main img,#main pre,#main table,#main input,#main textarea,#main button,#main a,#main label,#main summary,#main .home-portrait-frame,#main .home-artifact-card,#main [data-project-card],#main .blog-pinned-card,#main [data-home-desk-scene] canvas,#main .home-world-controls,header,nav.navbar,.ninja-keys,.modal.show,#back-to-top"
      ),
    ]
      .filter(
        (node) => !node.closest(".pip-companion") && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none"
      )
      .flatMap((node) => {
        const bounds = node.getBoundingClientRect();
        if (bounds.bottom < 70 || bounds.top > innerHeight) return [];
        const style = getComputedStyle(node);
        // Protect the actual lines, leaving the empty end of a paragraph usable.
        // Painted boxes and interactive controls retain their complete bounds.
        if (node.matches("p,h1,h2,h3") && style.backgroundColor === "rgba(0, 0, 0, 0)" && style.backgroundImage === "none") {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()];
        }
        return [bounds];
      })
      .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 70 && r.top < innerHeight);
    if (journey) {
      const sample = sampleTravel(journey, elapsed - journeyStart);
      const remaining = journey.kind === "portal" ? journey.points : [sample, ...journey.points.slice(sample.segment)];
      const size = innerWidth < 600 ? 68 : 82;
      const fits =
        journey.kind === "portal"
          ? remaining.every((p) => clearAt(p.x, p.y, obstacles, size))
          : clearAt(sample.x, sample.y, obstacles, size * sample.scale) &&
            remaining.slice(1).every((p, i) => segmentClear(remaining[i], p, obstacles, journey.footprint));
      if (!fits) {
        clearTravel();
        visible = false;
      }
    }
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
    if (journey || contact || bumpAnimation || elapsed < speakingUntil) return;
    if (layoutDirty || elapsed - lastLayout > 0.7) refreshLayout();
    if (visible && el.matches(":hover,:focus-within") && clearAt(x, y, obstacles, innerWidth < 600 ? 68 : 82)) {
      target = { x, y };
      nextPerch = elapsed + 0.5;
      return;
    }
    let preferred = target || dock();
    if (elapsed > nextWander && !reduced.matches && !companion.napping) {
      preferred = { x: innerWidth * (0.12 + random() * 0.76), y: 140 + random() * Math.max(10, innerHeight - 240) };
      if (Math.hypot(preferred.x - x, preferred.y - y) < 150) preferred.x = innerWidth - x;
      nextWander = elapsed + 12 + random() * 12;
      ignoreUntil = elapsed + 3 + random() * 5;
    } else if (follow && fine.matches && companion.pointer.at > 0 && elapsed - ignoreUntil > 0 && performance.now() - companion.pointer.at < 6000) {
      preferred = { x: companion.pointer.x + (companion.pointer.x > innerWidth / 2 ? -95 : 95), y: companion.pointer.y + 75 };
    }
    const size = innerWidth < 600 ? 68 : 82;
    const next = choosePerch({ width: innerWidth, height: innerHeight, preferred, obstacles, size, rail });
    target = next;
    if (target && !visible) {
      x = target.x;
      y = target.y;
      vx = vy = 0;
    }
    visible = Boolean(target);
    if (target && !companion.reduced && !companion.napping && !companion.paused && Math.hypot(target.x - x, target.y - y) > 34) beginTravel(target);
    nextPerch = elapsed + 0.5;
  }
  function beginTravel(destination, kind) {
    if (companion.reduced || companion.napping || companion.paused) return false;
    const size = innerWidth < 600 ? 68 : 82;
    if (!clearAt(x, y, obstacles, size)) {
      const safe = choosePerch({ width: innerWidth, height: innerHeight, preferred: { x, y }, obstacles, size, rail });
      if (!safe) return false;
      x = safe.x;
      y = safe.y;
    }
    const start = { x, y };
    portals.style.opacity = "0";
    travelPose = null;
    journey = planTravel(start, destination, { obstacles, width: innerWidth, height: innerHeight, size, kind });
    journeyStart = elapsed;
    lastTravel = journey.kind;
    travels[journey.kind]++;
    target = destination;
    if (journey.kind === "portal") companion.motion.play("peek");
    return true;
  }
  function clearTravel() {
    journey = null;
    contact = null;
    travelPose = null;
    portals.style.opacity = "0";
    el.dataset.travel = "rest";
    el.style.opacity = "";
    nextPerch = 0;
  }
  function showPortals(plan, sample) {
    portals.style.opacity = String(sample.portal);
    portals.style.setProperty("--pip-portal-turn", `${(elapsed - journeyStart) * 110}deg`);
    for (let i = 0; i < 2; i++) {
      const p = plan.points[i ? plan.points.length - 1 : 0];
      portals.children[i].style.transform = `translate(${p.x - 15}px,${p.y - 48}px) scale(${sample.portal},${0.65 + sample.portal * 0.35})`;
    }
  }
  function restore() {
    clearTravel();
    el.dataset.speaking = "false";
    speakingUntil = 0;
    if (bumpAnimation) {
      bumpAnimation.cancel();
      bumpAnimation = null;
      repaired++;
    }
    repairAt = 0;
  }
  function nudge(force = false, type) {
    if (companion.reduced || companion.napping || companion.paused || bumpAnimation || contact) return false;
    const selector =
      type === "stumble"
        ? "#main h2,#main .home-featured-title,#main .pip-encounter-note"
        : ".home-artifact-card,#main [data-project-card],#main .blog-pinned-card,#main .home-featured-item,#main h2,#main .pip-encounter-note";
    const candidates = [...document.querySelectorAll(selector)].filter(
      (node) =>
        !node.matches(":hover,:focus-within") && node.getBoundingClientRect().top > 100 && node.getBoundingClientRect().bottom < innerHeight - 70
    );
    refreshLayout();
    const size = innerWidth < 600 ? 68 : 82;
    // Narrow layouts often have room above a card, but none beside it.
    const approaches = candidates.flatMap((card) => {
      const rect = card.getBoundingClientRect();
      const sides = [
        { x: rect.right + size * 0.39 + 7, y: rect.top + Math.min(rect.height / 2, 65) },
        { x: rect.left - size * 0.39 - 7, y: rect.top + Math.min(rect.height / 2, 65) },
      ];
      for (const fraction of [0.85, 0.15, 0.5])
        for (const y of [rect.top - size * 0.48 - 7, rect.bottom + size * 0.48 + 7]) sides.push({ x: rect.left + rect.width * fraction, y });
      return sides.map((p) => ({ ...p, card }));
    });
    const destination = approaches
      .filter(
        (p) =>
          p.x > size * 0.5 + 5 &&
          p.x < innerWidth - size * 0.5 - 5 &&
          p.y > 100 &&
          p.y < innerHeight - size * 0.5 - 5 &&
          clearAt(p.x, p.y, obstacles, size)
      )
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (!destination || (!force && Math.hypot(destination.x - x, destination.y - y) > 200)) return false;
    const { card } = destination;
    contact = { card, force, type: type || (card.matches("h2,.home-featured-title,.pip-encounter-note") ? "stumble" : "bump") };
    if (Math.hypot(destination.x - x, destination.y - y) > 24) {
      if (!beginTravel(destination)) {
        contact = null;
        return false;
      }
    } else {
      x = destination.x;
      y = destination.y;
      target = destination;
      performContact();
    }
    return true;
  }
  function performContact() {
    if (!contact) return;
    const { card, force, type } = contact;
    contact = null;
    if (!card.isConnected || card.matches(":hover,:focus-within") || companion.reduced || companion.napping) return;
    const amount = type === "stumble" ? 2.5 : 5;
    lastEncounter = type;
    bumpAnimation = card.animate(
      [
        { translate: "0 0", rotate: "0deg" },
        { translate: `${amount}px 1px`, rotate: ".7deg", offset: 0.1 },
        { translate: `${-amount * 0.55}px -1px`, rotate: "-.5deg", offset: 0.2 },
        { translate: `${amount * 0.3}px 0`, rotate: ".25deg", offset: 0.3 },
        { translate: "1px 1px", rotate: ".1deg", offset: 0.64 },
        { translate: "0 -1px", rotate: "-.1deg", offset: 0.88 },
        { translate: "0 0", rotate: "0deg" },
      ],
      { duration: 2300, easing: "ease-in-out" }
    );
    companion.mood = 1;
    companion.motion.play("repair");
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
  }
  function setNap(value) {
    clearTimeout(restTimer);
    companion.napping = value;
    el.dataset.napping = String(value);
    if (value)
      restTimer = setTimeout(() => {
        setNap(false);
        window.dispatchEvent(new Event("pip:nap"));
      }, 12000);
    restore();
    request();
  }
  let lastHello = -10;
  const greet = () => {
    if (journey) {
      clearTravel();
      target = { x, y };
      nextPerch = elapsed + 2;
    }
    if (elapsed - lastHello < 6 || companion.napping || companion.reduced) return;
    lastHello = elapsed;
    companion.motion.play("hello");
    speak("hello", true);
    request();
  };
  hit.addEventListener("pointerenter", greet);
  hit.addEventListener("focus", greet);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pip-trip]");
    if (!button) return;
    const status = document.querySelector("[data-pip-trip-status]");
    if (companion.reduced || companion.napping || companion.paused) {
      if (status) status.textContent = "P is resting. Wake it up or allow motion to try a little journey.";
      return;
    }
    invitedUntil = elapsed + 14;
    invitation = button.dataset.pipTrip;
    restore();
    if (status)
      status.textContent = {
        fly: "Taking the scenic route.",
        squeeze: "Tuck in. Just enough room.",
        portal: "A little shortcut.",
        bump: "Careful… oh. One second.",
      }[invitation];
    request();
  });
  for (const controls of document.querySelectorAll(".pip-trip-controls")) controls.hidden = false;
  window.addEventListener("pip:nap", () => setNap(companion.napping));
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
      if (journey) clearTravel();
      el.dataset.speaking = "false";
      speakingUntil = 0;
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
      clearTravel();
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
      clearTimeout(restTimer);
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
      companion.worldReady &&
      rect?.bottom > innerHeight * 0.28 &&
      rect?.top < innerHeight * 0.62;
    if (worldVisible && !wasWorldVisible) nextEscape = elapsed + 35 + random() * 25;
    wasWorldVisible = Boolean(worldVisible);
    if (worldVisible && !still && elapsed > nextEscape) {
      worldEscapeUntil = elapsed + 7 + random() * 5;
      nextEscape = elapsed + 60 + random() * 45;
      companion.excursion = true;
    }
    const studio = document.querySelector("[data-pip-studio]")?.getBoundingClientRect();
    const studioVisible = studio && studio.bottom > innerHeight * 0.25 && studio.top < innerHeight * 0.8;
    const nextMode = invitedUntil > elapsed ? "page" : studioVisible ? "studio" : worldVisible && elapsed > worldEscapeUntil ? "world" : "page";
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
      restore();
      companion.owner = mode;
      window.dispatchEvent(new Event("pip:change"));
      layoutDirty = true;
      nextPerch = 0;
    }
    if (mode !== "page") {
      el.dataset.visible = "false";
      visible = false;
      el.dataset.speaking = "false";
    } else {
      if (elapsed >= nextPerch || !target || layoutDirty) choose(!still && elapsed - lastPointer < 5);
      if (invitation) {
        const action = invitation;
        invitation = null;
        if (!performTrip(action)) {
          const status = document.querySelector("[data-pip-trip-status]");
          if (status) status.textContent = "A little crowded here. I’ll wait for a clear gap.";
        }
      }
      if (!target) {
        el.dataset.visible = "false";
        el.style.opacity = "";
      }
      if (target) {
        if (still) {
          x = target.x;
          y = target.y;
          vx = vy = 0;
        } else if (journey) {
          const priorX = x,
            priorY = y;
          travelPose = sampleTravel(journey, elapsed - journeyStart);
          x = travelPose.x;
          y = travelPose.y;
          vx = (x - priorX) / Math.max(dt, 0.001);
          vy = (y - priorY) / Math.max(dt, 0.001);
          el.dataset.travel = journey.kind;
          if (journey.kind === "portal") showPortals(journey, travelPose);
          if (travelPose.done) {
            journey = null;
            el.dataset.travel = "rest";
            portals.style.opacity = "0";
            travelPose = null;
            nextPerch = elapsed + 2;
            performContact();
          }
        } else {
          [x, vx] = spring(x, vx, target.x, dt, 2.1);
          [y, vy] = spring(y, vy, target.y, dt, 2.1);
        }
        // If a moving page puts text under P, wait in the next clear gap.
        const clear = clearAt(x, y, obstacles, (innerWidth < 600 ? 68 : 82) * (travelPose?.scale || 1));
        el.dataset.visible = String(visible && (clear || el.matches(":focus-within")));
        el.dataset.side = x < innerWidth / 2 ? "left" : "right";
        el.style.opacity = travelPose && el.dataset.visible === "true" ? String(travelPose.opacity) : "";
        const w = innerWidth < 600 ? 72 : 88,
          h = innerWidth < 600 ? 92 : 112;
        el.style.transform = `translate3d(${(x - w / 2).toFixed(2)}px,${(y - h / 2).toFixed(2)}px,0) rotate(${still ? 0 : (travelPose?.bank ?? Math.max(-7, Math.min(7, vx * 0.055)))}deg) scale(${travelPose?.scale || 1})`;
      }
      if (elapsed > nextSpeech) {
        speak(scrolled ? "catchup" : undefined);
        scrolled = false;
        nextSpeech = elapsed + 45 + random() * 35;
      }
      if (elapsed > nextBump && !still) {
        if (!journey && random() < 0.3) nudge();
        nextBump = elapsed + 85 + random() * 65;
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
          pose: companion.motion.update(dt, {
            gaze: [gx, gy],
            still,
            nap: companion.napping,
            blink: elapsed < blinkUntil ? Math.sin(((blinkUntil - elapsed) / 0.17) * Math.PI) : 0,
            flight: vx * 0.0004,
            squeeze: journey?.kind === "squeeze" ? (1 - (travelPose?.scale || 1)) / 0.44 : 0,
          }),
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
    travel: journey?.kind || "rest",
    lastTravel,
    travels: { ...travels },
    lastEncounter,
    portalVisible: Number(portals.style.opacity || 0) > 0,
    repairing: Boolean(bumpAnimation),
    text: bubble.textContent,
    renderer: portrait ? "webgl" : "css",
  });
  function performTrip(action) {
    if (action === "bump") return nudge(true);
    if (action === "stumble") return nudge(true, "stumble");
    if (["fly", "squeeze", "portal"].includes(action)) {
      refreshLayout();
      const size = innerWidth < 600 ? 68 : 82;
      const options = {
        width: innerWidth,
        height: innerHeight,
        obstacles,
        size,
        rail,
      };
      const start = clearAt(x, y, obstacles, size) ? { x, y } : choosePerch({ ...options, preferred: { x, y } });
      if (!start) return false;
      const preferred = { x: x < innerWidth / 2 ? innerWidth - 55 : 55, y: Math.max(130, innerHeight - y) };
      const destination = choosePerch({ ...options, preferred });
      // An invitation names a motion, not a destination. On a narrow article,
      // the opposite margin may only be reachable by portal. Try nearby clear
      // endpoints in the current connected gap before changing the motion.
      const candidates = [destination];
      if (action !== "portal") {
        for (const radius of [100, 180])
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4)
            candidates.push(choosePerch({ ...options, preferred: { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius } }));
      }
      const seen = new Set();
      for (const point of candidates) {
        if (!point || Math.hypot(point.x - start.x, point.y - start.y) < 28) continue;
        const key = `${Math.round(point.x)},${Math.round(point.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const plan = planTravel(start, point, { ...options, kind: action });
        if (plan.kind === action) return beginTravel(point, action);
      }
      if (destination && beginTravel(destination, action)) {
        const status = document.querySelector("[data-pip-trip-status]");
        if (status && journey.kind === "portal") status.textContent = "A tight corner. I’ll use a little shortcut.";
        return true;
      }
      return false;
    }
    if (action === "speak") speak(undefined, true);
    if (action === "escape") {
      worldEscapeUntil = elapsed + 10;
      nextPerch = 0;
    }
    request();
  }
  if (lab) el.previewCompanion = performTrip;
  setNap(companion.napping);
  theme();
  request();
}
