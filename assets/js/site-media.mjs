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
  // A native range updates on touch-down, before the browser knows whether the
  // finger is scrolling the menu. Apply taps, deliberate drags and key presses.
  function listenToRange(slider, change) {
    let touch = null;
    const apply = (event) => change(slider.valueAsNumber, event);
    const directionAt = (event) => {
      const across = Math.abs(event.clientX - touch.x);
      const down = Math.abs(event.clientY - touch.y);
      if (Math.max(across, down) < 6) return null;
      return across > down ? "horizontal" : "vertical";
    };
    slider.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" && event.isPrimary) {
        touch = { id: event.pointerId, x: event.clientX, y: event.clientY, direction: null };
      }
    });
    slider.addEventListener("pointermove", (event) => {
      if (event.pointerId !== touch?.id || touch.direction) return;
      touch.direction = directionAt(event);
      if (touch.direction === "horizontal") apply(event);
    });
    slider.addEventListener("pointerup", (event) => {
      if (event.pointerId !== touch?.id) return;
      const appliedDrag = touch.direction === "horizontal";
      const direction = touch.direction ?? directionAt(event);
      touch = null;
      if (direction === "vertical") reflect();
      else if (!appliedDrag) apply(event);
    });
    const cancel = (event) => {
      if (event.pointerId !== touch?.id) return;
      touch = null;
      reflect();
    };
    slider.addEventListener("pointercancel", cancel);
    slider.addEventListener("lostpointercapture", cancel);
    slider.addEventListener("input", (event) => {
      if (!touch || touch.direction === "horizontal") apply(event);
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
