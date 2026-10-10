import { createDuhMotion, clamp } from "./duh-motion.mjs";
import { createDuhPortrait } from "./duh-portrait.mjs";
import { clearAt } from "./behaviour.mjs";
import { chooseDuhPerch } from "./duh-viewport.mjs";
import { companion } from "./bridge.mjs";

const root = document.documentElement;
if (!document.querySelector(".duh-companion") && !document.querySelector("[data-ai-profile]") && !location.pathname.startsWith("/ai/")) start();

function start() {
  const model = createDuhMotion(innerWidth, innerHeight),
    s = model.state;
  const el = document.createElement("aside");
  el.className = "duh-companion";
  el.setAttribute("aria-label", "duh, a little company");
  el.innerHTML =
    '<span class="duh-shadow" aria-hidden="true"></span><canvas aria-hidden="true"></canvas><span class="duh-fallback" aria-hidden="true">••</span><button type="button" class="duh-hit" aria-label="Pet duh" aria-describedby="duh-help" aria-keyshortcuts="P R H T ArrowUp ArrowDown ArrowLeft ArrowRight" title="Tap to pet or wake. Drag to play. Hold to let duh sleep. Shift-click to reset."></button><span id="duh-help" class="duh-sr-only">Tap to pet or wake. Drag to play. Hold still for a moment to pause. Shift-click or R resets. P pauses, H greets, T tosses, arrow keys move. Double-tap then tap empty space to move without dragging. Alt Shift D recalls duh anywhere.</span><span class="duh-sr-only duh-status" role="status" aria-live="polite">Here, quietly.</span>';
  document.body.append(el);
  const hit = el.querySelector("button"),
    canvas = el.querySelector("canvas"),
    shadow = el.querySelector(".duh-shadow"),
    status = el.querySelector(".duh-status");
  const portrait = createDuhPortrait(canvas);
  el.dataset.fallback = String(!portrait);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer:fine)");
  const viewport = window.visualViewport;
  let view,
    navigationUntil = 0;
  const navigating = () => performance.now() < navigationUntil;
  function readViewport() {
    const css = getComputedStyle(el);
    const inset = (name) => parseFloat(css.getPropertyValue("--duh-safe-" + name)) || 0;
    view = {
      width: viewport?.width || innerWidth,
      height: viewport?.height || innerHeight,
      left: viewport?.offsetLeft || 0,
      top: viewport?.offsetTop || 0,
      bottom: inset("bottom"),
      insetLeft: inset("left"),
      insetRight: inset("right"),
      insetTop: inset("top"),
    };
    model.setViewport(view);
  }
  readViewport();
  let paused = false,
    disposed = false,
    raf = 0,
    last = 0,
    timer = 0,
    frames = 0,
    layoutScans = 0;
  let pointerId = null,
    holdTimer = 0,
    holdPoint = null,
    recovery = null,
    initialized = false,
    groundY = s.y,
    elevation = 0,
    tuck = 0,
    suppressedClick = false,
    inviteArmed = false,
    lastPetAt = -10,
    obstacles = [],
    layoutDirty = true,
    visible = true,
    readingLink = false;
  let gaze = [0, 0],
    cursor = null,
    hugUntil = 0,
    greetTarget = null,
    nextGreeting = 0,
    lastActivity = -10,
    blinkUntil = 0,
    outing = null,
    tilt = 0,
    effort = 0,
    nextWander = 6,
    nextMorph = 5,
    morphUntil = 0,
    formIndex = 1,
    outings = 0;
  let parts = [],
    heavy = [],
    pieces = [],
    lastImpact = -10,
    tidyAt = Infinity,
    tidyUntil = 0,
    displaced = [],
    pageContacts = 0,
    repairs = 0;
  const animations = new Set();
  const main = document.querySelector("#main") || document.querySelector("main");
  // Duh stays on the reading surface in both homepage modes. The retained
  // 3D robot must not become a second default companion. P's project controller
  // still owns its own playground; duh never drives P's motor state.
  const syncP = () => {
    if (document.querySelector("[data-pip-studio]")) return;
    companion.owner = "page";
    companion.theme = root.dataset.themeMode || "noon";
    companion.reduced = reduced.matches;
    window.dispatchEvent(new Event("pip:change"));
  };
  const still = () => paused || reduced.matches;
  const interactive = "a,button,input,select,textarea,summary,[role='button'],[contenteditable='true'],[tabindex]:not([tabindex='-1'])";
  function request() {
    clearTimeout(timer);
    timer = 0;
    if (!raf && !disposed && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function notify(message) {
    if (status.textContent !== message) status.textContent = message;
  }
  function updatePointerPolicy() {
    hit.style.pointerEvents =
      visible && s.state !== "TIDY" && !greetTarget && !hugUntil && (s.state === "HELD" || (!navigating() && clearAt(s.x, s.y, obstacles, 72)))
        ? "auto"
        : "none";
  }
  function restorePieces() {
    for (const a of animations) a.cancel();
    animations.clear();
    readingLink = false;
    for (const p of pieces) {
      p.ghost.remove();
      p.source.style.opacity = p.opacity;
    }
    pieces = [];
    displaced = [];
    tidyAt = Infinity;
    tidyUntil = 0;
  }
  function clearGesture() {
    const id = pointerId;
    pointerId = null;
    clearTimeout(holdTimer);
    holdTimer = 0;
    holdPoint = null;
    if (id !== null && hit.hasPointerCapture(id)) hit.releasePointerCapture(id);
    model.cancel();
    recovery = null;
    inviteArmed = false;
    outing = null;
    tilt = effort = 0;
    greetTarget = null;
    hugUntil = 0;
    cursor = null;
    restorePieces();
  }
  function scan() {
    layoutDirty = false;
    layoutScans++;
    if (displaced.length || pieces.length) restorePieces();
    obstacles = [];
    const surfaces = [];
    const nodes = document.querySelectorAll(
      `#main p, #main h1, #main h2, #main h3, #main h4, #main h5, #main h6, #main li, #main dl, #main dt, #main dd, #main figcaption, #main caption, #main .caption, #main .project-case-facts, #main pre, #main table, #main figure, #main svg, #main canvas, #main img, ${interactive}, header, nav`
    );
    for (const node of nodes) {
      // P is another moving character, not fixed page geometry. Caching its
      // current button as a wall made harmless reflows relocate duh.
      if (node.closest(".duh-companion,.pip-companion,.pip-portals") || node.closest("[aria-hidden='true']")) continue;
      // Article headers contain large empty areas on short Safari viewports.
      // Their headings, paragraphs and links are already protected by ink.
      if (node.matches("header") && node.closest("#main,main") && !node.matches("[data-duh-static]")) continue;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      if (node.matches("p,h1,h2,h3,h4,li")) {
        if (!node.closest("nav,header,[data-pip-studio]") && !node.matches("[data-duh-static]") && r.width > 30 && r.height > 8) {
          const ink = document.createRange();
          ink.selectNodeContents(node);
          // Nested list paragraphs own their contact. Long reading columns stay still.
          if (!node.querySelector("p,li") && r.height < 180)
            for (const line of ink.getClientRects())
              if (line.width > 20 && line.height > 8) surfaces.push({ node, rect: line, blockRect: r, reading: true });
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.bottom > 0 && rect.top < innerHeight) obstacles.push(rect);
      } else obstacles.push(r);
      if (obstacles.length > 1200) break;
    }
    heavy = [...document.querySelectorAll("[data-duh-heavy]")].slice(0, 4).map((node) => ({ node, rect: node.getBoundingClientRect() }));
    model.setSurfaces([...heavy, ...surfaces]);
    parts = [...document.querySelectorAll("[data-duh-piece][aria-hidden='true']")]
      .slice(0, 4)
      .map((node) => ({ node, rect: node.getBoundingClientRect() }));
    // Reflow only invalidates a path if new geometry actually blocks it.
    if (outing && !pathClear(outing.to, outing.arc)) {
      model.cancel();
      outing = greetTarget = null;
      hugUntil = tilt = effort = 0;
      cursor = null;
    }
    if (!["HELD", "AIRBORNE"].includes(s.state) && !outing) perch();
  }
  function perch() {
    if (navigating() || pointerId !== null) return;
    const b = model.bounds();
    const target = chooseDuhPerch(view, b, { x: s.x, y: s.y }, obstacles, main?.getBoundingClientRect());
    if (clearAt(s.x, s.y, obstacles, 96) && s.x >= b.left && s.x <= b.right && s.y >= b.top && s.y <= b.bottom) {
      visible = true;
      recovery = null;
    } else if (!initialized) {
      visible = Boolean(target);
      if (target) {
        s.x = target.x;
        s.y = target.y;
      }
    } else if (still()) {
      // No surprise repositioning during reduced-motion reading or a pause.
      visible = false;
      recovery = null;
    } else if (target && !recovery) {
      if (!startOuting(target, "recover"))
        recovery = {
          from: { x: s.x, y: s.y },
          target,
          at: s.time,
          duration: Math.max(0.35, Math.hypot(target.x - s.x, target.y - s.y) / 240),
        };
    } else if (!target) {
      visible = false;
      recovery = null;
    }
    initialized = true;
  }

  function pet(x = s.x, y = s.y - 20, throughPointer = false) {
    if (outing) clearGesture();
    if (s.state === "RETREAT") model.reset(s.x, s.y);
    if (!throughPointer) model.pet(still());
    if (throughPointer) {
      inviteArmed = s.time - lastPetAt < 0.45 && s.mood !== "giggle";
      lastPetAt = s.time;
    }
    portrait?.pet(Math.atan2(y - s.y, x - s.x), still());
    lastActivity = s.time;
    if (inviteArmed) notify("Tap an empty spot to invite duh there. Escape cancels.");
    else notify(s.mood === "giggle" ? "A happy little squish." : "Pet received.");
    request();
  }
  function reset() {
    navigationUntil = 0;
    // Explicit recall may choose a safe nearby perch; viewport updates preserve position.
    initialized = false;
    clearGesture();
    model.reset(s.x, s.y);
    portrait?.change("dot", still());
    nextWander = s.time + 6;
    nextMorph = s.time + 5;
    morphUntil = 0;
    formIndex = 1;
    paused = false;
    syncPauseState();
    recovery = null;
    layoutDirty = true;
    notify("Here, quietly.");
    request();
  }
  function pause(value = !paused) {
    clearGesture();
    paused = value;
    syncPauseState();
    notify(value ? "Sleeping. Tap to wake, or press R to reset." : "Here, quietly.");
    request();
  }
  function syncPauseState() {
    el.dataset.paused = String(paused);
    hit.setAttribute("aria-label", paused ? "Wake duh" : "Pet duh");
  }
  function pathClear(target, arc = 0) {
    const samples = Math.max(6, Math.ceil(Math.hypot(target.x - s.x, target.y - s.y) / 24));
    return Array.from({ length: samples + 1 }, (_, i) => i / samples).every((t) =>
      clearAt(s.x + (target.x - s.x) * t, s.y + (target.y - s.y) * t - Math.sin(Math.PI * t) * arc, obstacles, 96)
    );
  }
  function startOuting(target, kind = "hop") {
    const arc = kind === "roll" ? 0 : 22;
    if (!pathClear(target, arc)) return false;
    const distance = Math.hypot(target.x - s.x, target.y - s.y);
    if (kind !== "greet") gaze = [(target.x - s.x) / 90, (target.y - s.y) / 90];
    outing = { from: { x: s.x, y: s.y }, to: target, at: s.time, kind, arc, duration: clamp(distance / 115, 0.6, 2.4) };
    groundY = s.y;
    outings++;
    s.state = kind === "tidy" ? "TIDY" : "PLAY";
    s.mood = kind === "tidy" ? "curious" : "happy";
    return true;
  }
  function greet(explicit = false) {
    if (still() || !visible || s.state !== "REST" || outing || inviteArmed) return;
    const p = cursor;
    if (p?.safe && s.time > nextGreeting && Math.hypot(p.x - s.x, p.y - s.y) < 360) {
      const dx = s.x - p.x,
        dy = s.y - p.y,
        distance = Math.hypot(dx, dy) || 1;
      const target = { x: p.x + (dx / distance) * 43, y: p.y + (dy / distance) * 43 };
      if (startOuting(target, "greet")) {
        greetTarget = target;
        nextGreeting = s.time + 12;
        lastActivity = s.time;
        request();
        return;
      }
    }
    if (explicit) {
      pet();
      hugUntil = s.time + 0.9;
    }
  }
  function autonomous() {
    if (
      still() ||
      !visible ||
      s.state !== "REST" ||
      outing ||
      recovery ||
      inviteArmed ||
      readingLink ||
      getSelection()?.toString() ||
      document.activeElement?.matches("input,textarea,[contenteditable='true']") ||
      s.time - lastActivity < 3
    )
      return;
    if (morphUntil && s.time > morphUntil) {
      portrait?.change("dot", false);
      morphUntil = 0;
    }
    if (s.time > nextMorph && !morphUntil) {
      const forms = ["apple", "dot", "peach", "watermelon", "square", "triangle"];
      portrait?.change(forms[(formIndex++ - 1) % forms.length], false);
      model.pet();
      nextMorph = s.time + 14;
      morphUntil = s.time + 6;
    }
    if (s.time > nextWander) {
      nextWander = s.time + 11;
      const direction = outings % 2 ? 1 : -1,
        b = model.bounds();
      for (const [dx, dy] of [
        [direction * 76, 0],
        [-direction * 64, 0],
        [0, -62],
        [0, 62],
      ]) {
        const target = { x: clamp(s.x + dx, b.left + 18, b.right - 18), y: clamp(s.y + dy, b.top + 8, b.bottom - 8) };
        if (Math.hypot(target.x - s.x, target.y - s.y) > 30 && startOuting(target, outings % 2 ? "roll" : "hop")) break;
      }
    }
  }
  function impact(event) {
    if (still() || readingLink || event.speed < 460 || s.time - lastImpact < 0.6 || getSelection()?.toString()) return;
    lastImpact = s.time;
    const close = event.target
      ? [event.target]
      : heavy.filter(({ rect: r }) => event.x > r.left - 100 && event.x < r.right + 100 && event.y > r.top - 100 && event.y < r.bottom + 100);
    for (const { node, rect, blockRect, reading } of close) {
      if (displaced.length >= 3 || displaced.some((p) => p.node === node)) continue;
      const box = blockRect || rect;
      const strength = clamp(event.speed / (reading ? 260 : 380), 1.5, reading ? 4 : 3);
      const dx = clamp(-(event.nx || -Math.sign(s.vx)) * strength, -Math.max(0, box.left - 6), Math.max(0, innerWidth - box.right - 6));
      const dy = clamp(-(event.ny || 0.2) * strength, -2, 2);
      const lever = clamp((event.y - (box.top + box.height / 2)) / Math.max(15, box.height / 2), -1, 1);
      const angle = clamp(
        (dx * lever - dy * Math.sign(event.x - box.left - box.width / 2)) * (reading ? 0.075 : 0.55),
        reading ? -0.35 : -1.8,
        reading ? 0.35 : 1.8
      );
      const residue = reading ? 0.22 : 0.3;
      // A small damped impulse around the contact, with the original semantic
      // nodes intact. Heavy objects have lower travel and slower settling.
      const keys = [0, 1, -0.42, 0.2, -0.07, residue].map((v, i) => ({
        translate: dx * v + "px " + dy * v + "px",
        rotate: angle * v + "deg",
        offset: [0, 0.16, 0.4, 0.63, 0.83, 1][i],
      }));
      const a = node.animate(keys, { duration: reading ? 650 : 1100, fill: "forwards", composite: "add", easing: "ease-in-out" });
      animations.add(a);
      displaced.push({ node, rect: box, dx: dx * residue, dy: dy * residue, angle: angle * residue, animation: a });
      pageContacts++;
    }
    tidyAt = s.time + 1.4;
    if (!close.some((t) => !t.reading) || pieces.length) return;
    for (const { node, rect: r } of parts) {
      if (r.bottom < 80 || r.top > innerHeight - 50) continue;
      const ghost = document.createElement("span");
      ghost.className = "duh-loose-piece";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = node.textContent;
      const textStyle = getComputedStyle(node);
      ghost.style.font = textStyle.font;
      ghost.style.color = textStyle.color;
      ghost.style.left = `${r.left}px`;
      ghost.style.top = `${r.top}px`;
      document.body.append(ghost);
      const opacity = node.style.opacity;
      node.style.opacity = "0.25";
      const dx = clamp((r.left - event.x) * 0.25, -70, 70),
        dy = clamp(70, 0, innerHeight - r.bottom - 30);
      ghost.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 5}deg)`;
      const a = ghost.animate(
        [
          { transform: "translate(0) rotate(0)" },
          { transform: `translate(${dx * 0.4}px,-18px) rotate(${dx / 10}deg)`, offset: 0.35 },
          { transform: ghost.style.transform },
        ],
        { duration: 650, easing: "cubic-bezier(.2,.65,.3,1)" }
      );
      animations.add(a);
      a.finished.then(() => animations.delete(a)).catch(() => {});
      pieces.push({ ghost, source: node, opacity });
    }
    tidyAt = s.time + 3;
  }
  function finishTidy() {
    outing = null;
    s.state = "TIDY";
    s.mood = "happy";
    tidyUntil = s.time + 1.1;
    repairs++;
    for (const { node, dx, dy, angle, animation } of displaced) {
      animation.cancel();
      animations.delete(animation);
      animations.add(
        node.animate(
          [
            { translate: dx + "px " + dy + "px", rotate: angle + "deg" },
            { translate: dx * 0.8 + "px " + dy * 0.8 + "px", rotate: angle * 0.8 + "deg", offset: 0.25 },
            { translate: "0px 0px", rotate: "0deg" },
          ],
          { duration: 1000, composite: "add", easing: "ease-in-out" }
        )
      );
    }
    for (const { ghost } of pieces)
      animations.add(
        ghost.animate([{ transform: ghost.style.transform }, { transform: "translate(0) rotate(0)" }], {
          duration: 1000,
          fill: "forwards",
          easing: "ease-in-out",
        })
      );
  }
  function tidy() {
    if (still()) {
      restorePieces();
      return;
    }
    tidyAt = Infinity;
    const r = displaced[0]?.rect || parts[0]?.rect;
    if (r) {
      gaze = [(r.left + r.width / 2 - s.x) / 100, (r.top - s.y) / 100];
      const b = model.bounds();
      for (const target of [
        { x: r.left - 54, y: r.top + r.height / 2 },
        { x: r.right + 54, y: r.top + r.height / 2 },
        { x: s.x, y: s.y - 18 },
      ]) {
        if (target.x > b.left && target.x < b.right && target.y > b.top && target.y < b.bottom && startOuting(target, "tidy")) return;
      }
    }
    finishTidy();
  }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    const previousState = s.state;
    if (layoutDirty && !navigating()) scan();
    if (!paused) for (const contact of model.step(dt, reduced.matches)) impact(contact);
    if (outing && !still()) {
      const t = s.time - outing.at;
      s.state = outing.kind === "tidy" ? "TIDY" : "PLAY";
      if (t < 0.18) s.squash = Math.sin(((t / 0.18) * Math.PI) / 2) * 0.15;
      else {
        const u = clamp((t - 0.18) / outing.duration, 0, 1),
          eased = u * u * u * (10 + u * (-15 + 6 * u));
        const nx = outing.from.x + (outing.to.x - outing.from.x) * eased;
        const ny = outing.from.y + (outing.to.y - outing.from.y) * eased - Math.sin(u * Math.PI) * outing.arc;
        elevation = Math.sin(u * Math.PI) * outing.arc;
        groundY = ny + elevation;
        s.ax = clamp(((nx - s.x) / dt - s.vx) / dt, -16000, 16000);
        s.ay = clamp(((ny - s.y) / dt - s.vy) / dt, -16000, 16000);
        s.vx = (nx - s.x) / dt;
        s.vy = (ny - s.y) / dt;
        s.x = nx;
        s.y = ny;
        tilt = outing.kind === "roll" ? Math.sin(u * Math.PI) * Math.sign(outing.to.x - outing.from.x) * 0.85 : Math.sin(u * Math.PI * 2) * 0.12;
        if (u === 1) {
          const kind = outing.kind;
          outing = null;
          tilt = 0;
          elevation = 0;
          s.vx = s.vy = 0;
          s.squashV = 2;
          if (kind === "greet") {
            greetTarget = null;
            hugUntil = s.time + 1.1;
          } else if (kind === "tidy") finishTidy();
          else s.state = "REST";
        }
      }
    }
    if ((greetTarget || hugUntil) && !still()) s.state = "PLAY";
    if (hugUntil && s.time >= hugUntil) {
      hugUntil = 0;
      s.state = "REST";
    }
    if ((pieces.length || displaced.length) && s.state === "REST" && s.time > tidyAt) tidy();
    effort = tidyUntil ? Math.sin((tidyUntil - s.time) * Math.PI * 3) * 0.5 + 0.5 : 0;
    if (tidyUntil) s.squash = Math.sin((tidyUntil - s.time) * Math.PI * 4) * 0.08;
    if (tidyUntil && s.time > tidyUntil) {
      restorePieces();
      s.state = "REST";
      s.mood = "content";
    }
    if (previousState !== s.state) {
      if (s.state === "RETREAT") {
        restorePieces();
        notify("Taking a little breather. Tap the tucked-up duh to invite it back.");
      }
      if (s.state === "REST") {
        perch();
        if (previousState === "RETREAT") notify("Back again.");
      }
    }
    if (cursor && cursor.safe && fine.matches && !still() && s.state === "REST" && s.time - cursor.at > 0.7 && s.time > nextGreeting) greet();
    if (!navigating() && !recovery) autonomous();
    el.dataset.state = s.state;
    el.dataset.mood = s.mood;
    if (recovery && !navigating()) {
      const u = clamp((s.time - recovery.at) / recovery.duration, 0, 1);
      const eased = u * u * u * (10 + u * (-15 + 6 * u));
      const nx = recovery.from.x + (recovery.target.x - recovery.from.x) * eased;
      const ny = recovery.from.y + (recovery.target.y - recovery.from.y) * eased;
      s.vx = (nx - s.x) / Math.max(dt, 0.001);
      s.vy = (ny - s.y) / Math.max(dt, 0.001);
      s.x = nx;
      s.y = ny;
      visible = true;
      if (u === 1) {
        recovery = null;
        s.vx = s.vy = 0;
      }
    }
    el.style.opacity = visible ? (navigating() ? "0.22" : recovery ? "0.5" : "1") : "0";
    tuck += ((s.state === "RETREAT" ? 1 : 0) - tuck) * (still() ? 1 : 1 - Math.exp(-8 * dt));
    el.dataset.visible = String(visible);
    el.style.transform = `translate3d(${s.x - 48}px,${s.y - 47}px,0)`;
    hit.tabIndex = visible ? 0 : -1;
    if (s.state === "RETREAT") hit.setAttribute("aria-label", "Invite duh back");
    else if (!paused) hit.setAttribute("aria-label", "Pet duh");
    if (!outing) {
      if (!["AIRBORNE", "HELD"].includes(s.state)) groundY = s.y;
      else if (s.state === "AIRBORNE") groundY = model.bounds().bottom;
      groundY = Math.max(groundY, s.y);
      elevation = clamp(groundY - s.y, 0, innerHeight);
    }
    updatePointerPolicy();
    portrait?.draw({
      dt,
      gaze: still() ? [0, 0] : gaze,
      squash: still() ? 0 : s.squash,
      mood: paused ? "sleepy" : s.state === "RETREAT" ? "shy" : s.state === "AIRBORNE" ? "alert" : s.mood,
      theme: root.dataset.themeMode || "noon",
      blink: s.time < blinkUntil,
      still: still(),
      hug: Boolean(hugUntil) && !still(),
      velocity: [s.vx, s.vy],
      acceleration: [s.ax, s.ay],
      held: s.state === "HELD",
      tuck,
      grounded: !["AIRBORNE", "HELD"].includes(s.state) && !outing,
      tilt: still() ? 0 : tilt,
      effort: still() ? 0 : effort,
      contactAngle: s.contactAngle,
    });
    const footprint = portrait?.contact() || { bottom: 28, halfWidth: 28 };
    shadow.style.top = 47 + (elevation > 0.5 ? 28 : footprint.bottom) - 4 + "px";
    shadow.style.transform =
      "translate(" +
      clamp(s.vx * 0.003, -5, 5) +
      "px," +
      elevation +
      "px) scale(" +
      (1 + Math.min(elevation, 160) / 180) * (1 + s.squash * 0.7) * (1 - tuck * 0.38) +
      "," +
      (1 + Math.min(elevation, 160) / 110) +
      ")";
    shadow.style.opacity = String((root.dataset.themeMode === "evening" ? 0.32 : 0.19) * Math.exp(-elevation / 65) * (1 - tuck * 0.45));
    frames++;
    const active =
      navigating() ||
      layoutDirty ||
      (!still() &&
        (["HELD", "AIRBORNE", "PLAY", "TIDY"].includes(s.state) ||
          outing ||
          recovery ||
          navigating() ||
          layoutDirty ||
          Math.abs(tuck - (s.state === "RETREAT" ? 1 : 0)) > 0.002 ||
          greetTarget ||
          hugUntil ||
          Math.abs(s.squash) > 0.001 ||
          s.time < blinkUntil ||
          portrait?.active()));
    if (active) request();
    else {
      last = 0;
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          if (document.hidden || paused) return;
          // Advance semantic idle timers without replaying missed physics frames.
          s.time += s.state === "RETREAT" ? 0.25 : 1;
          if (!still() && Math.floor(s.time) % 5 === 0) blinkUntil = s.time + 0.12;
          request();
        },
        s.state === "RETREAT" ? 250 : 1000
      );
    }
  }
  hit.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      clearGesture();
      request();
      return;
    }
    if (event.shiftKey) {
      reset();
      suppressedClick = true;
      return;
    }
    if (paused || s.state === "RETREAT") {
      pause(false);
      model.reset(s.x, s.y);
      pet();
      suppressedClick = true;
      return;
    }
    event.preventDefault();
    lastActivity = s.time;
    navigationUntil = 0;
    recovery = null;
    outing = null;
    tilt = 0;
    restorePieces();
    greetTarget = null;
    hugUntil = 0;
    pointerId = event.pointerId;
    model.grab(event.clientX, event.clientY, event.timeStamp);
    hit.setPointerCapture(pointerId);
    holdPoint = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => {
      suppressedClick = true;
      pause(true);
    }, 700);
    request();
  });
  hit.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) {
      if (holdPoint && Math.hypot(holdPoint.x - event.clientX, holdPoint.y - event.clientY) > 6) {
        clearTimeout(holdTimer);
        holdPoint = null;
      }
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples) model.drag(sample.clientX, sample.clientY, sample.timeStamp);
      model.drag(event.clientX, event.clientY, event.timeStamp);
      request();
    }
  });
  hit.addEventListener("pointerup", (event) => {
    if (pointerId === event.pointerId) {
      clearTimeout(holdTimer);
      holdPoint = null;
      model.drag(event.clientX, event.clientY, event.timeStamp);
      model.release(event.timeStamp, still());
      if (s.state === "REST") layoutDirty = true;
      pointerId = null;
      if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
      suppressedClick = true;
      if (s.state === "PLAY") pet(event.clientX, event.clientY, true);
      request();
    }
  });

  hit.addEventListener("click", (event) => {
    if (suppressedClick && event.detail !== 0) {
      suppressedClick = false;
      return;
    }
    suppressedClick = false;
    if (event.detail === 0) {
      if (paused || s.state === "RETREAT") {
        pause(false);
        model.reset(s.x, s.y);
      }
      pet();
    }
  });
  hit.addEventListener("pointercancel", () => {
    clearGesture();
    request();
  });
  hit.addEventListener("lostpointercapture", () => {
    if (pointerId !== null) {
      clearGesture();
      request();
    }
  });
  function nudge(dx, dy) {
    if (paused) return;
    clearGesture();
    const b = model.bounds();
    const x = clamp(s.x + dx, b.left, b.right),
      y = clamp(s.y + dy, b.top, b.bottom);
    if (!clearAt(x, y, obstacles, 100)) {
      notify("That spot is for reading. Try another direction.");
      return;
    }
    if (still()) {
      s.x = x;
      s.y = y;
    } else startOuting({ x, y }, "roll");
    visible = true;
    request();
  }
  hit.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearGesture();
      layoutDirty = true;
      request();
    }
    if (event.key.toLowerCase() === "h") greet(true);
    if (event.key.toLowerCase() === "p") pause();
    if (event.key.toLowerCase() === "t" && !paused) {
      model.toss(s.x > innerWidth / 2 ? -450 : 450, -470, still());
      request();
    }
    if (event.key.toLowerCase() === "r") reset();
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const direction = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    if (direction) nudge(...direction);
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (pointerId !== null || event.pointerType === "touch") return;
      gaze = [(event.clientX - s.x) / 100, (event.clientY - s.y) / 100];
      const safe =
        !event.target.closest(`${interactive},.duh-companion`) &&
        !getSelection()?.toString() &&
        !document.activeElement?.matches("input,textarea,[contenteditable='true']");
      if (!cursor || Math.hypot(cursor.x - event.clientX, cursor.y - event.clientY) > 4)
        cursor = { x: event.clientX, y: event.clientY, safe, at: s.time };
      else cursor.safe = safe;
      if (!safe && (greetTarget || hugUntil || (outing && outing.kind !== "tidy"))) {
        restorePieces();
        greetTarget = null;
        hugUntil = 0;
        outing = null;
        tilt = 0;
        model.cancel();
      }
      if (!still()) request();
    },
    { passive: true }
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (inviteArmed && !event.target.closest(".duh-companion")) {
        inviteArmed = false;
        cursor = null;
        nextGreeting = s.time + 12;
        const b = model.bounds();
        const target = { x: clamp(event.clientX, b.left, b.right), y: clamp(event.clientY, b.top, b.bottom) };
        if (!event.target.closest(interactive) && clearAt(target.x, target.y, obstacles, 96)) {
          clearGesture();
          if (still()) {
            s.x = target.x;
            s.y = target.y;
          } else startOuting(target, "hop");
          lastActivity = s.time;
          cursor = null;
          nextGreeting = s.time + 12;
          request();
        } else notify("That spot needs room. Double-tap and try a clear spot.");
      }
      if (!event.target.closest(".duh-companion") && (displaced.length || pieces.length)) {
        if (event.target.closest(interactive)) {
          // Freeze the clicked visual target until click dispatch selects its
          // native link/button action; moving it on pointer-down can lose a click.
          readingLink = true;
          for (const animation of animations) {
            // pause() alone waits for the next animation tick. Resolve its
            // hold time now so a pressed link cannot drift by one more frame.
            const time = animation.currentTime;
            animation.pause();
            if (time !== null) animation.currentTime = time;
          }
          model.cancel();
          outing = greetTarget = null;
          hugUntil = 0;
          tidyAt = Infinity;
        } else clearGesture();
        request();
      }
      if ((!event.isPrimary && pointerId !== null) || (pointerId !== null && pointerId !== event.pointerId)) {
        clearGesture();
        request();
      }
    },
    { passive: true }
  );
  document.addEventListener("click", () => {
    if (readingLink) {
      clearGesture();
      request();
    }
  });
  for (const event of ["pointercancel", "dragstart"])
    document.addEventListener(event, () => {
      if (readingLink) {
        clearGesture();
        request();
      }
    });
  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "KeyD") {
      event.preventDefault();
      reset();
      hit.focus();
      return;
    }
    if (!event.target.closest(".duh-companion")) {
      if (greetTarget || hugUntil || outing) model.cancel();
      restorePieces();
      outing = null;
      tilt = 0;
      cursor = null;
      greetTarget = null;
      hugUntil = 0;
    }
    if (event.key === "Escape") {
      clearGesture();
      layoutDirty = true;
      request();
    }
  });
  document.addEventListener("selectionchange", () => {
    if (getSelection()?.toString()) {
      restorePieces();
      if (greetTarget || hugUntil || outing) model.cancel();
      restorePieces();
      outing = null;
      tilt = 0;
      cursor = null;
      greetTarget = null;
      hugUntil = 0;
      request();
    }
  });
  function viewportChanged() {
    readViewport();
    layoutDirty = true;
    // Safari may resize browser chrome while a finger is captured. Its new
    // bounds do not end the gesture or reset the character's coordinates.
    if (pointerId === null) {
      if (!navigating()) {
        clearGesture();
        lastActivity = s.time;
        nextWander = s.time + 6;
        nextGreeting = s.time + 12;
      }
      navigationUntil = performance.now() + 180;
    }
    request();
  }
  window.addEventListener("scroll", viewportChanged, { passive: true });
  window.addEventListener("resize", viewportChanged, { passive: true });
  viewport?.addEventListener("resize", viewportChanged, { passive: true });
  viewport?.addEventListener("scroll", viewportChanged, { passive: true });
  window.addEventListener("blur", () => {
    clearGesture();
    last = 0;
    request();
  });
  document.addEventListener("visibilitychange", () => {
    clearGesture();
    last = 0;
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(timer);
    if (!document.hidden) request();
  });
  reduced.addEventListener("change", () => {
    syncP();
    clearGesture();
    notify(reduced.matches ? "Reduced motion: quiet poses, with all controls available." : "Here, quietly.");
    request();
  });
  const themeObserver = new MutationObserver(() => {
    syncP();
    request();
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme-mode", "data-theme"] });
  const reflow = () => {
    layoutDirty = true;
    request();
  };
  const resizeObserver = new ResizeObserver(reflow);
  if (main) resizeObserver.observe(main);
  // Body padding (for example the reading-progress setup) and ancestor
  // classes/transforms can move main without changing its content-box size.
  // Observe those low-frequency causes; do not measure layout every frame.
  const ancestorObserver = new MutationObserver(reflow);
  for (let node = main || document.body; node; node = node.parentElement)
    ancestorObserver.observe(node, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
  const contentObserver = new MutationObserver(reflow);
  if (main) contentObserver.observe(main, { childList: true, subtree: true });
  document.fonts?.ready.then(reflow);
  document.addEventListener("load", reflow, true);
  window.addEventListener("pagehide", (event) => {
    clearGesture();
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(timer);
    if (!event.persisted) {
      disposed = true;
      themeObserver.disconnect();
      resizeObserver.disconnect();
      ancestorObserver.disconnect();
      contentObserver.disconnect();
      viewport?.removeEventListener("resize", viewportChanged);
      viewport?.removeEventListener("scroll", viewportChanged);
    }
  });
  window.addEventListener("pageshow", () => {
    last = 0;
    layoutDirty = true;
    request();
  });
  function inviteToPlayground() {
    navigationUntil = 0;
    const stage = document.querySelector("[data-duh-playground]")?.getBoundingClientRect();
    if (!stage) return;
    const b = model.bounds();
    const top = Math.max(b.top + 10, stage.top + 65);
    const bottom = Math.min(b.bottom - 23, stage.bottom - 100);
    if (bottom < top) return;
    clearGesture();
    paused = false;
    syncPauseState();
    model.reset(stage.left + Math.min(140, stage.width * 0.28), clamp(stage.top + 140, top, bottom));
    lastActivity = s.time;
    nextGreeting = s.time + 1;
    layoutDirty = true;
    request();
  }
  document.querySelector("[data-duh-invite]")?.addEventListener("click", inviteToPlayground);
  inviteToPlayground();
  syncP();
  el.getDuhEvidence = () => ({
    ...model.evidence(),
    form: portrait?.form() || "dot",
    paused,
    reduced: reduced.matches,
    elevation,
    recovering: Boolean(recovery),
    navigating: navigating(),
    viewport: { ...view },
    bounds: model.bounds(),
    inviteArmed,
    visible,
    frames,
    layoutScans,
    running: Boolean(raf),
    fragments: pieces.length,
    displaced: displaced.length,
    pageContacts,
    repairs,
    outings,
    outing: outing?.kind || null,
    body: portrait?.evidence(),
    pointerId,
    greeting: Boolean(greetTarget || hugUntil),
    theme: root.dataset.themeMode || "noon",
    gaze: [...gaze],
    lastActivity,
  });
  request();
}
