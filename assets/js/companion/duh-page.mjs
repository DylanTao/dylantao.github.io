import { createDuhMotion, clamp } from "./duh-motion.mjs";
import { createDuhPortrait } from "./duh-portrait.mjs";
import { choosePerch, clearAt } from "./behaviour.mjs";
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
    '<canvas aria-hidden="true"></canvas><span class="duh-fallback" aria-hidden="true">••</span><button type="button" class="duh-hit" aria-label="Pet duh. Drag with a mouse, or open duh controls to move." aria-describedby="duh-help"></button>';
  const dock = document.createElement("details");
  dock.className = "duh-dock";
  dock.innerHTML = `<summary aria-label="duh controls">duh<span class="duh-dock-dot" aria-hidden="true"></span></summary>
    <div class="duh-panel"><p id="duh-help">Tap to pet. Drag to play.</p>
    <div class="duh-actions"><button type="button" data-duh-action="pause" aria-pressed="false">Pause</button><button type="button" data-duh-action="reset" aria-label="Reset & invite back">Reset</button></div>
    <button type="button" data-duh-action="move" aria-pressed="false">Move mode</button>
    <div class="duh-move" hidden><p>Drag with touch, use arrow keys on duh, or tap a direction.</p><div class="duh-actions"><button type="button" data-duh-action="left">Left</button><button type="button" data-duh-action="up">Up</button><button type="button" data-duh-action="down">Down</button><button type="button" data-duh-action="right">Right</button><button type="button" data-duh-action="toss">Little toss</button></div></div>
    <p class="duh-status" role="status" aria-live="polite">Here, quietly.</p><a class="duh-project-link">Meet duh & P</a></div>`;
  dock.querySelector("a").href = new URL("../../../projects/p/", import.meta.url).href;
  document.body.append(el, dock);
  const hit = el.querySelector("button"),
    canvas = el.querySelector("canvas"),
    status = dock.querySelector(".duh-status");
  const portrait = createDuhPortrait(canvas);
  el.dataset.fallback = String(!portrait);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer:fine)");
  let paused = false,
    moveMode = false,
    disposed = false,
    raf = 0,
    last = 0,
    timer = 0,
    frames = 0,
    layoutScans = 0;
  let pointerId = null,
    touchTap = null,
    suppressedClick = false,
    obstacles = [],
    layoutDirty = true,
    visible = true;
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
  const interactive = "a,button,input,select,textarea,summary,[role='button'],[contenteditable='true'],[tabindex]";
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
      visible &&
      !["RETREAT", "TIDY"].includes(s.state) &&
      !greetTarget &&
      !hugUntil &&
      !outing &&
      (s.state === "HELD" || clearAt(s.x, s.y, obstacles, 82))
        ? "auto"
        : "none";
  }
  function restorePieces() {
    for (const a of animations) a.cancel();
    animations.clear();
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
    touchTap = null;
    if (id !== null && hit.hasPointerCapture(id)) hit.releasePointerCapture(id);
    model.cancel();
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
    // A fresh layout invalidates the entire invitation, including its path.
    // Moving to a new perch must never resume an approach to an old target.
    if (greetTarget || hugUntil || outing) {
      model.cancel();
      outing = null;
      tilt = effort = 0;
      greetTarget = null;
      hugUntil = 0;
    }
    cursor = null;
    obstacles = [];
    const surfaces = [];
    const nodes = document.querySelectorAll(
      `#main p, #main h1, #main h2, #main h3, #main h4, #main h5, #main h6, #main li, #main dl, #main dt, #main dd, #main figcaption, #main caption, #main .caption, #main .project-case-facts, #main pre, #main table, #main figure, #main svg, #main canvas, #main img, ${interactive}, header, nav`
    );
    for (const node of nodes) {
      if (node.closest(".duh-companion,.duh-dock") || (node.closest("[data-duh-playground]") && !node.matches(interactive))) continue;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      if (node.matches("p,h1,h2,h3,h4,li")) {
        if (!node.closest("nav,header,[data-pip-studio]") && !node.matches("[data-duh-static]") && r.width > 30 && r.height > 8)
          surfaces.push({ node, rect: r, reading: true });
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.bottom > 0 && rect.top < innerHeight) obstacles.push(rect);
      } else obstacles.push(r);
      if (obstacles.length > 1200) break;
    }
    obstacles.push(dock.getBoundingClientRect());
    if (dock.open) obstacles.push(dock.querySelector(".duh-panel").getBoundingClientRect());
    heavy = [...document.querySelectorAll("[data-duh-heavy]")].slice(0, 4).map((node) => ({ node, rect: node.getBoundingClientRect() }));
    model.setSurfaces([...heavy, ...surfaces]);
    parts = [...document.querySelectorAll("[data-duh-piece][aria-hidden='true']")]
      .slice(0, 4)
      .map((node) => ({ node, rect: node.getBoundingClientRect() }));
    if (!["HELD", "AIRBORNE"].includes(s.state)) perch();
  }
  function perch() {
    const target = choosePerch({
      width: innerWidth,
      height: innerHeight,
      preferred: { x: s.x, y: s.y },
      obstacles,
      size: 100,
      rail: main?.getBoundingClientRect(),
    });
    visible = Boolean(target);
    if (target) {
      s.x = target.x;
      s.y = target.y;
    }
  }
  function pet(x = s.x, y = s.y - 20, throughPointer = false) {
    if (outing) clearGesture();
    if (s.state === "RETREAT") model.reset();
    if (!throughPointer) model.pet(still());
    portrait?.pet(Math.atan2(y - s.y, x - s.x), still());
    lastActivity = s.time;
    notify(s.mood === "giggle" ? "A happy little squish." : "Pet received.");
    request();
  }
  function reset() {
    clearGesture();
    model.reset();
    portrait?.change("dot", still());
    nextWander = s.time + 6;
    nextMorph = s.time + 5;
    morphUntil = 0;
    formIndex = 1;
    paused = false;
    moveMode = false;
    dock.querySelector("[data-duh-action='pause']").textContent = "Pause";
    dock.querySelector("[data-duh-action='pause']").setAttribute("aria-pressed", "false");
    setMove(false);
    layoutDirty = true;
    notify("Here, quietly.");
    request();
  }
  function setMove(value) {
    moveMode = value;
    el.dataset.move = String(value);
    dock.querySelector(".duh-move").hidden = !value;
    dock.querySelector("[data-duh-action='move']").setAttribute("aria-pressed", String(value));
    hit.setAttribute(
      "aria-label",
      value ? "Move duh with arrow keys. Enter to pet. Escape to cancel." : "Pet duh. Drag with a mouse, or open duh controls to move."
    );
  }
  function startOuting(target, kind = "hop") {
    const arc = kind === "roll" ? 0 : 22;
    const samples = Math.max(6, Math.ceil(Math.hypot(target.x - s.x, target.y - s.y) / 24));
    if (
      !Array.from({ length: samples + 1 }, (_, i) => i / samples).every((t) =>
        clearAt(s.x + (target.x - s.x) * t, s.y + (target.y - s.y) * t - Math.sin(Math.PI * t) * arc, obstacles, 96)
      )
    )
      return false;
    outing = { from: { x: s.x, y: s.y }, to: target, at: s.time, kind, arc };
    outings++;
    s.state = kind === "tidy" ? "TIDY" : "PLAY";
    s.mood = kind === "tidy" ? "curious" : "happy";
    return true;
  }
  function greet(explicit = false) {
    if (still() || !visible || s.state !== "REST" || outing) return;
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
      dock.open ||
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
    if (still() || event.speed < 460 || s.time - lastImpact < 0.6 || getSelection()?.toString()) return;
    lastImpact = s.time;
    const close = event.target
      ? [event.target]
      : heavy.filter(({ rect: r }) => event.x > r.left - 100 && event.x < r.right + 100 && event.y > r.top - 100 && event.y < r.bottom + 100);
    for (const { node, rect, reading } of close) {
      if (reading) {
        if (displaced.length >= 2 || displaced.some((p) => p.node === node)) continue;
        const strength = clamp(event.speed / 65, 8, 18);
        const dx = clamp(-(event.nx || -Math.sign(s.vx)) * strength, -Math.max(0, rect.left - 6), Math.max(0, innerWidth - rect.right - 6));
        const dy = clamp(-(event.ny || 0.25) * strength, -10, 10);
        // Additive translation preserves authored transforms, layout and native selection.
        const a = node.animate(
          [{ translate: "0px 0px" }, { translate: dx + "px " + dy + "px", offset: 0.45 }, { translate: dx * 0.6 + "px " + dy * 0.6 + "px" }],
          { duration: 480, fill: "forwards", composite: "add", easing: "cubic-bezier(.2,.8,.3,1)" }
        );
        animations.add(a);
        displaced.push({ node, rect, dx: dx * 0.6, dy: dy * 0.6, animation: a });
        pageContacts++;
      } else {
        const a = node.animate([{ translate: "0px 0px" }, { translate: "4px 2px" }, { translate: "-3px 0px" }, { translate: "0px 0px" }], {
          duration: 360,
          composite: "add",
        });
        animations.add(a);
        a.finished.then(() => animations.delete(a)).catch(() => {});
      }
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
    for (const { node, dx, dy, animation } of displaced) {
      animation.cancel();
      animations.delete(animation);
      animations.add(
        node.animate(
          [{ translate: dx + "px " + dy + "px" }, { translate: dx * 0.8 + "px " + dy * 0.8 + "px", offset: 0.25 }, { translate: "0px 0px" }],
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
    if (layoutDirty) scan();
    if (!paused) for (const contact of model.step(dt, reduced.matches)) impact(contact);
    if (outing && !still()) {
      const t = s.time - outing.at;
      s.state = outing.kind === "tidy" ? "TIDY" : "PLAY";
      if (t < 0.18) s.squash = Math.sin(((t / 0.18) * Math.PI) / 2) * 0.15;
      else {
        const u = clamp((t - 0.18) / 0.72, 0, 1),
          eased = u * u * (3 - 2 * u);
        const nx = outing.from.x + (outing.to.x - outing.from.x) * eased;
        const ny = outing.from.y + (outing.to.y - outing.from.y) * eased - Math.sin(u * Math.PI) * outing.arc;
        s.vx = (nx - s.x) / dt;
        s.vy = (ny - s.y) / dt;
        s.x = nx;
        s.y = ny;
        tilt = outing.kind === "roll" ? Math.sin(u * Math.PI) * Math.sign(outing.to.x - outing.from.x) * 0.85 : Math.sin(u * Math.PI * 2) * 0.12;
        if (u === 1) {
          const kind = outing.kind;
          outing = null;
          tilt = 0;
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
        notify("Taking a little breather. Invite duh back whenever you like.");
      }
      if (s.state === "REST") {
        perch();
        if (previousState === "RETREAT") notify("Back again.");
      }
    }
    if (cursor && cursor.safe && fine.matches && !still() && s.state === "REST" && s.time - cursor.at > 0.7 && s.time > nextGreeting) greet();
    autonomous();
    el.dataset.state = s.state;
    el.dataset.mood = s.mood;
    el.dataset.visible = String(visible && s.state !== "RETREAT");
    el.style.transform = `translate3d(${s.x - 48}px,${s.y - 47}px,0)`;
    hit.tabIndex = visible && s.state !== "RETREAT" ? 0 : -1;
    updatePointerPolicy();
    portrait?.draw({
      dt,
      gaze: still() ? [0, 0] : gaze,
      squash: still() ? 0 : s.squash,
      mood: s.mood,
      theme: root.dataset.themeMode || "noon",
      blink: s.time < blinkUntil,
      still: still(),
      hug: Boolean(hugUntil) && !still(),
      velocity: [s.vx, s.vy],
      acceleration: [s.ax, s.ay],
      held: s.state === "HELD",
      grounded: !["AIRBORNE", "HELD"].includes(s.state) && !outing,
      tilt: still() ? 0 : tilt,
      effort: still() ? 0 : effort,
      contactAngle: s.contactAngle,
    });
    frames++;
    const active =
      !still() &&
      (["HELD", "AIRBORNE", "PLAY", "TIDY"].includes(s.state) ||
        outing ||
        greetTarget ||
        hugUntil ||
        Math.abs(s.squash) > 0.001 ||
        s.time < blinkUntil ||
        portrait?.active());
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
    if (paused) {
      notify("Resume to play, or reset to start again.");
      return;
    }
    lastActivity = s.time;
    outing = null;
    tilt = 0;
    restorePieces();
    greetTarget = null;
    hugUntil = 0;
    if (event.pointerType === "touch" && !moveMode) {
      touchTap = { x: event.clientX, y: event.clientY, id: event.pointerId };
      return;
    }
    pointerId = event.pointerId;
    model.grab(event.clientX, event.clientY, event.timeStamp);
    hit.setPointerCapture(pointerId);
    request();
  });
  hit.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) {
      model.drag(event.clientX, event.clientY, event.timeStamp);
      request();
    }
    if (touchTap && Math.hypot(touchTap.x - event.clientX, touchTap.y - event.clientY) > 8) touchTap = null;
  });
  hit.addEventListener("pointerup", (event) => {
    if (pointerId === event.pointerId) {
      model.release(event.timeStamp, still());
      if (s.state === "REST") layoutDirty = true;
      pointerId = null;
      if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
      suppressedClick = true;
      if (s.state === "PLAY") pet(event.clientX, event.clientY, true);
      request();
    } else if (touchTap?.id === event.pointerId) {
      touchTap = null;
      suppressedClick = true;
      pet(event.clientX, event.clientY);
    }
  });
  hit.addEventListener("click", (event) => {
    if (suppressedClick) {
      suppressedClick = false;
      return;
    }
    if (!paused && event.detail === 0) pet();
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
    const x = clamp(s.x + dx, 36, innerWidth - 36),
      y = clamp(s.y + dy, 100, innerHeight - 42);
    if (!clearAt(x, y, obstacles, 100)) {
      notify("That spot is for reading. Try another direction.");
      return;
    }
    s.x = x;
    s.y = y;
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
    if (event.key.toLowerCase() === "p") dock.querySelector("[data-duh-action='pause']").click();
    if (event.key.toLowerCase() === "r") reset();
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const direction = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    if (direction) nudge(...direction);
  });
  dock.addEventListener("click", (event) => {
    const action = event.target.closest("[data-duh-action]")?.dataset.duhAction;
    if (!action) return;
    if (action === "reset") return reset();
    if (action === "pause") {
      clearGesture();
      paused = !paused;
      event.target.textContent = paused ? "Resume" : "Pause";
      event.target.setAttribute("aria-pressed", String(paused));
      notify(paused ? "Paused. Reset is always available." : "Here, quietly.");
      request();
      return;
    }
    if (action === "move") {
      clearGesture();
      setMove(!moveMode);
      request();
      return;
    }
    if (paused) return;
    if (action === "pet") pet();
    if (action === "greet") greet(true);
    const directions = { left: [-24, 0], right: [24, 0], up: [0, -24], down: [0, 24] };
    if (directions[action]) nudge(...directions[action]);
    if (action === "toss") {
      model.toss(s.x > innerWidth / 2 ? -450 : 450, -470, still());
      visible = true;
      notify(reduced.matches ? "A quiet pose with reduced motion." : "A little toss.");
      request();
    }
  });
  dock.addEventListener("toggle", () => {
    layoutDirty = true;
    request();
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (pointerId !== null || event.pointerType === "touch") return;
      gaze = [(event.clientX - s.x) / 100, (event.clientY - s.y) / 100];
      const safe =
        !event.target.closest(`${interactive},.duh-dock,.duh-companion`) &&
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
      if (!event.target.closest(".duh-companion,.duh-dock") && (displaced.length || pieces.length)) {
        clearGesture();
        request();
      }
      if ((!event.isPrimary && (pointerId !== null || touchTap)) || (pointerId !== null && pointerId !== event.pointerId)) {
        clearGesture();
        request();
      }
    },
    { passive: true }
  );
  document.addEventListener("keydown", (event) => {
    if (!event.target.closest(".duh-dock,.duh-companion")) {
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
      dock.open = false;
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
  window.addEventListener(
    "scroll",
    () => {
      clearGesture();
      layoutDirty = true;
      request();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    clearGesture();
    model.resize(innerWidth, innerHeight);
    layoutDirty = true;
    request();
  });
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
    }
  });
  window.addEventListener("pageshow", () => {
    last = 0;
    layoutDirty = true;
    request();
  });
  function inviteToPlayground() {
    const stage = document.querySelector("[data-duh-playground]")?.getBoundingClientRect();
    if (!stage || stage.top < 80 || stage.bottom > innerHeight) return;
    clearGesture();
    model.reset(stage.left + Math.min(140, stage.width * 0.28), stage.top + 140);
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
    moveMode,
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
