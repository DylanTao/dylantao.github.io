// One glass lens over a continuous miniature of the house. The values stay
// native ranges for touch, keyboard and speech input.
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
      art.worlds.findIndex((world) => world.id === look)
    );
    const world = art.worlds[index];
    const sound = window.siteSound?.evidence();
    const level = Math.round((sound?.volume ?? 1) * 100);
    for (const panel of panels) {
      const style = panel.querySelector("[data-art-slider]");
      style.value = String(index);
      style.setAttribute("aria-valuetext", world.name);
      panel.querySelector("[data-art-name]").textContent = world.name;
      panel.querySelector("[data-art-rail]").style.setProperty("--u", index / (art.worlds.length - 1));
      const volume = panel.querySelector("[data-volume-slider]");
      volume.value = String(level);
      volume.setAttribute("aria-valuetext", sound?.on ? level + "%" : level + "%, sound off");
      panel.querySelector("[data-volume-name]").textContent = level + "%";
      const rail = panel.querySelector("[data-volume-rail]");
      rail.style.setProperty("--u", level / 100);
      rail.style.setProperty("--band", index + 1);
      const film = filmed && scene.getFilmPlayback?.();
      panel.querySelector("[data-art-piece]").textContent = sound?.recordTitle || (film ? "The Door Is Open" : world.music);
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
    }
    if (absoluteMute) {
      panel.querySelector("[data-volume-row]").hidden = true;
      panel.querySelector("[data-media-footer]").hidden = true;
    }
    listenToRange(panel.querySelector("[data-art-slider]"), (index) => art.set(art.worlds[index].id));
    listenToRange(panel.querySelector("[data-volume-slider]"), (level, event) => {
      if (event.isTrusted) window.siteSound?.setVolume(level / 100);
    });
    // A menu can open after initial layout on browsers without ResizeObserver.
    panel.closest("[data-theme-control]")?.addEventListener("focusin", () => panel.querySelectorAll(".coastal-slider").forEach(size));
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
