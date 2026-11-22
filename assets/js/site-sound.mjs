// A Sound switch is offered by default. Only a deliberate gesture opens the audio
// context. A visitor who left it on still needs a fresh gesture after reloading.
const params = new URLSearchParams(location.search);
const instrumentLab = params.get("sound-lab") === "1";
const CHOICE = instrumentLab ? "site-sound-instrument" : "site-sound";
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // The preference still applies to this page.
    }
  },
};

if (params.get("sound") === "0") {
  store.set("site-sound", null);
  store.set("site-sound-instrument", null);
  document.documentElement.dataset.sound = "off";
} else {
  const controls = [...document.querySelectorAll("[data-sound-toggle]")];
  let site = null;
  let loading = null;
  let audioContext = null;
  let requested = false;
  let on = false;
  let generation = 0;
  let transition = Promise.resolve(false);
  let record = null;
  const mediaSources = new WeakMap();
  const storedVolume = store.get("site-sound-volume");
  let volume = storedVolume !== null && Number.isFinite(+storedVolume) ? Math.min(1, Math.max(0, +storedVolume)) : 1;
  let previousVolume = volume || 1;

  function reflect() {
    document.documentElement.dataset.sound = on ? "on" : "off";
    for (const control of controls) control.setAttribute("aria-checked", String(on));
    window.dispatchEvent(new CustomEvent("siteSoundChange", { detail: { on, volume } }));
  }

  function load() {
    return (loading ||= import("./sound/site.mjs").then(({ createSiteSound }) => {
      site = createSiteSound({ audioContext, instrumentLab, recordSelected: () => Boolean(record) });
      site.sound.setVolume(volume);
      return site;
    }));
  }

  async function turn(next) {
    const ticket = ++generation;
    requested = next;
    if (!next) {
      on = false;
      record?.pause();
      reflect();
      store.set(CHOICE, "off");
      if (site) await site.stop();
      else if (audioContext?.state !== "closed") await audioContext?.suspend();
      return;
    }
    try {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context && record?.canPlayType("audio/mpeg")) {
        record.volume = volume;
        on = true;
        reflect();
        return true;
      }
      if (!Context) throw new Error("Audio context unavailable");
      audioContext ||= new Context({ latencyHint: "interactive" });
      // Resume synchronously during the trusted gesture, even when the module
      // is still on the network or Safari has only transient activation.
      const unlocked = audioContext.state === "running" ? null : audioContext.resume();
      const [session] = await Promise.all([load(), unlocked]);
      if (ticket !== generation) return;
      const started = await session.start();
      if (ticket !== generation) return;
      on = requested = started;
      if (instrumentLab && started) session.sound.play("switch", { on: true });
      store.set(CHOICE, on ? "on" : "off");
    } catch {
      if (ticket !== generation) return;
      on = requested = false;
      loading = null;
      await audioContext?.suspend().catch(() => {});
    }
    if (ticket === generation) reflect();
    return on;
  }

  function rememberVolume(value) {
    volume = value;
    if (value > 0) previousVolume = value;
    store.set("site-sound-volume", String(value));
    site?.sound.setVolume(value);
    if (record && !audioContext) record.volume = value;
    reflect();
  }
  function choose(next) {
    if (next && volume === 0) rememberVolume(previousVolume);
    if (requested !== next) transition = turn(next);
    return transition;
  }
  function releaseRecord() {
    if (!record) return;
    const last = record;
    record = null;
    last.pause();
    if (!audioContext) requested = on = false;
    site?.refresh();
    reflect();
  }
  async function attachMediaElement(element) {
    if (!(element instanceof HTMLMediaElement) || document.hidden) return false;
    if (record !== element) releaseRecord();
    record = element;
    site?.refresh();
    await choose(true);
    if (!on || record !== element) return false;
    const graph = site?.sound.graph;
    if (!mediaSources.has(element)) {
      const source = graph?.context.createMediaElementSource(element);
      if (source) source.connect(graph.dry);
      mediaSources.set(element, source ?? null);
      for (const type of ["play", "pause", "ended", "emptied"]) element.addEventListener(type, reflect);
    }
    return true;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) record?.pause();
  });
  window.addEventListener("siteArtChange", releaseRecord);
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest?.('[data-home-desk-mode="3d"]')) releaseRecord();
    },
    true
  );
  const gesture = (event) => {
    if (!event.isTrusted || event.target.closest?.("[data-sound-toggle]")) return;
    window.removeEventListener("pointerdown", gesture, true);
    window.removeEventListener("keydown", gesture, true);
    if (store.get(CHOICE) === "on" && !requested) void choose(true);
  };
  for (const control of controls) {
    control.hidden = false;
    control.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      if (!requested) releaseRecord();
      void choose(!requested).catch(() => {});
    });
  }
  if (store.get(CHOICE) === "on") {
    window.addEventListener("pointerdown", gesture, true);
    window.addEventListener("keydown", gesture, true);
  }
  globalThis.siteSound = {
    attachMediaElement,
    gesture: (kind, strength, pan, material) => {
      if (on) site?.gesture(kind, strength, pan, material);
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      rememberVolume(Math.min(1, Math.max(0, value)));
      void choose(volume > 0);
    },
    evidence: () => ({
      offered: true,
      on,
      volume,
      recordTitle: record && !record.paused ? record.dataset.title : null,
      ...(site?.evidence() ?? { context: null, bound: false, instrumentLab }),
    }),
  };
  reflect();
}
