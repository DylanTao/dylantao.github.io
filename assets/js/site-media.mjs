// One glass lens over a continuous miniature of the house. The values stay
// native ranges for touch, keyboard and speech input.
import { drawMiniature } from "./media-miniatures.mjs";

const art = window.siteArt;
const panels = [...document.querySelectorAll("[data-site-media]")];
const scene = document.querySelector("[data-home-desk-scene]");
const stage = scene?.closest("[data-home-artifact-stage]");
const absoluteMute = new URLSearchParams(location.search).get("sound") === "0";

if (art && panels.length) {
  function reflect() {
    const filmed = stage?.classList.contains("is-world-immersive") && stage.classList.contains("is-world-visit");
    const look = (filmed && scene.dataset.drawing) || art.look;
    const index = Math.max(
      0,
      art.worlds.findIndex((world) => world.id === art.publicId(look))
    );
    const world = art.worlds[index];
    const sound = window.siteSound?.evidence();
    const level = Math.round((sound?.volume ?? 1) * 100);
    for (const panel of panels) {
      const style = panel.querySelector("[data-art-slider]");
      style.value = String(index);
      style.setAttribute("aria-valuetext", world.name);
      panel.querySelector("[data-art-name]").textContent = world.name;
      const volume = panel.querySelector("[data-volume-slider]");
      volume.value = String(level);
      volume.setAttribute("aria-valuetext", sound?.on ? level + "%" : level + "%, sound off");
      panel.querySelector("[data-volume-name]").textContent = level + "%";
      const rail = panel.querySelector("[data-volume-rail]");
      rail.style.setProperty("--u", level / 100);
      const film = filmed && scene.getFilmPlayback?.();
      const title = sound?.recordTitle || (film ? "The Door Is Open" : world.music);
      panel.querySelector("[data-art-piece]").textContent = title;
      if (!panel.closest("[data-theme-menu]").hidden) {
        if (!panel.hasAttribute("data-dragging-style")) {
          drawMiniature(panel.querySelector("[data-art-rail]"), index);
          drawMiniature(rail, index);
        }
        const sleeve = [...panel.querySelectorAll("template[data-recording]")].find((entry) => entry.dataset.recording === title);
        const cover = panel.querySelector("[data-media-cover]");
        if (sleeve && cover.getAttribute("src") !== sleeve.dataset.cover) cover.src = sleeve.dataset.cover;
        cover.hidden = !sleeve;
      }
    }
  }
  // A native range can change before a finger has chosen to tap or scroll.
  // WebKit even cancels the pointer during a stationary tap. The touch contact
  // itself lasts until the finger lifts or the browser actually cancels it.
  function listenToRange(slider, change) {
    let finger = null;
    let direction = null;
    const passive = { passive: true };
    const apply = (event) => change(slider.valueAsNumber, event);
    const movedFinger = (event) => Array.from(event.changedTouches).find((point) => point.identifier === finger?.identifier);
    const directionAt = (point) => {
      const across = Math.abs(point.clientX - finger.clientX);
      const down = Math.abs(point.clientY - finger.clientY);
      if (Math.max(across, down) < 6) return null;
      return across > down ? "horizontal" : "vertical";
    };
    function start(event) {
      if (finger) return;
      finger = event.changedTouches[0];
      direction = null;
    }
    function move(event) {
      const point = movedFinger(event);
      if (!point || direction) return;
      direction = directionAt(point);
      if (direction === "horizontal") apply(event);
    }
    function end(event) {
      const point = movedFinger(event);
      if (!point) return;
      const scrolling = (direction ?? directionAt(point)) === "vertical";
      finger = null;
      if (scrolling) reflect();
      else if (direction !== "horizontal") apply(event);
    }
    function cancel(event) {
      if (!movedFinger(event)) return;
      finger = null;
      reflect();
    }
    slider.addEventListener("touchstart", start, passive);
    slider.addEventListener("touchmove", move, passive);
    slider.addEventListener("touchend", end, passive);
    slider.addEventListener("touchcancel", cancel, passive);
    slider.addEventListener("input", (event) => {
      if (!finger || direction === "horizontal") apply(event);
    });
  }
  const size = (rail) => {
    const width = rail.getBoundingClientRect().width;
    if (width > 0) rail.style.setProperty("--rail-width", width + "px");
  };
  const observer = window.ResizeObserver && new ResizeObserver((entries) => entries.forEach(({ target }) => size(target)));
  for (const panel of panels) {
    for (const rail of panel.querySelectorAll(".coastal-slider")) {
      size(rail);
      observer?.observe(rail);
      const range = rail.querySelector("input");
      let held = null;
      const stop = () => {
        if (held) window.siteSound?.gesture("rest");
        held = null;
      };
      range.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary) return;
        held = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
      });
      function glide(point, time) {
        if (!held) return;
        const dx = point.clientX - held.x,
          dy = point.clientY - held.y,
          dt = time - held.at;
        if (dt < 16 || Math.abs(dx) < 1 || Math.abs(dy) > Math.abs(dx)) return;
        const force = Math.min(1, Math.abs(dx) / Math.max(16, dt));
        const pan = (range.valueAsNumber / Number(range.max) - 0.5) * 0.7;
        window.siteSound?.gesture("rail", force, pan);
        held.x = point.clientX;
        held.y = point.clientY;
        held.at = time;
      }
      range.addEventListener("pointermove", (event) => {
        if (held?.id === event.pointerId && event.pointerType !== "touch") glide(event, event.timeStamp);
      });
      range.addEventListener(
        "touchmove",
        (event) => {
          if (event.touches.length === 1) glide(event.touches[0], event.timeStamp);
        },
        { passive: true }
      );
      range.addEventListener("pointercancel", (event) => {
        if (event.pointerType !== "touch") stop();
      });
      window.addEventListener("pointerup", stop);
      range.addEventListener("touchend", stop, { passive: true });
      range.addEventListener("touchcancel", stop, { passive: true });
      window.addEventListener("blur", stop);
      range.addEventListener("blur", stop);
      range.addEventListener("keydown", (event) => {
        if (event.key === "Escape") stop();
      });
    }
    if (absoluteMute) {
      panel.querySelector("[data-volume-row]").hidden = true;
      panel.querySelector("[data-media-footer]").hidden = true;
    }
    listenToRange(panel.querySelector("[data-art-slider]"), (index, event) => {
      if (event.isTrusted && art.worlds[index].id !== art.look)
        window.siteSound?.gesture("detent", index / (art.worlds.length - 1), (index / (art.worlds.length - 1) - 0.5) * 0.7);
      art.set(art.worlds[index].id);
    });
    const slider = panel.querySelector("[data-art-slider]");
    const styleRail = slider.closest(".coastal-slider");
    let start = null;
    function preview(point) {
      if (!start || Math.abs(point.clientX - start.x) < 3 || Math.abs(point.clientY - start.y) > Math.abs(point.clientX - start.x)) return;
      panel.setAttribute("data-dragging-style", "");
      const bounds = slider.getBoundingClientRect(),
        thumb = styleRail.querySelector(".coastal-slider-lens").offsetWidth;
      const u = Math.max(0, Math.min(1, (point.clientX - bounds.left - thumb / 2) / Math.max(1, bounds.width - thumb)));
      drawMiniature(styleRail, u * (art.worlds.length - 1), true);
      drawMiniature(panel.querySelector("[data-volume-rail]"), u * (art.worlds.length - 1), true);
    }
    function finishPreview() {
      start = null;
      if (!panel.hasAttribute("data-dragging-style")) return;
      panel.removeAttribute("data-dragging-style");
      reflect();
    }
    slider.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY };
    });
    slider.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch") preview(e);
    });
    slider.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) preview(e.touches[0]);
      },
      { passive: true }
    );
    window.addEventListener("pointerup", finishPreview);
    slider.addEventListener("blur", finishPreview);
    slider.addEventListener("pointercancel", (e) => {
      if (e.pointerType !== "touch") finishPreview();
    });
    slider.addEventListener("touchend", finishPreview, { passive: true });
    slider.addEventListener("touchcancel", finishPreview, { passive: true });
    listenToRange(panel.querySelector("[data-volume-slider]"), (level, event) => {
      if (event.isTrusted) window.siteSound?.setVolume(level / 100);
    });
    // A menu can open after initial layout on browsers without ResizeObserver.
    panel.closest("[data-theme-control]")?.addEventListener("focusin", () => panel.querySelectorAll(".coastal-slider").forEach(size));
    new MutationObserver(reflect).observe(panel.closest("[data-theme-menu]"), { attributes: true, attributeFilter: ["hidden"] });
  }
  if (stage && scene) {
    const observer = new MutationObserver(reflect);
    observer.observe(scene, { attributes: true, attributeFilter: ["data-drawing"] });
    observer.observe(stage, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("siteArtChange", reflect);
  window.addEventListener("siteSoundChange", reflect);
  reflect();
}
