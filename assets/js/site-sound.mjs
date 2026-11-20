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

  function reflect() {
    document.documentElement.dataset.sound = on ? "on" : "off";
    for (const control of controls) control.setAttribute("aria-checked", String(on));
  }

  function load() {
    return (loading ||= import("./sound/site.mjs").then(({ createSiteSound }) => (site = createSiteSound({ audioContext, instrumentLab }))));
  }

  async function turn(next) {
    const ticket = ++generation;
    requested = next;
    if (!next) {
      on = false;
      reflect();
      store.set(CHOICE, "off");
      if (site) await site.stop();
      else if (audioContext?.state !== "closed") await audioContext?.suspend();
      return;
    }
    try {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
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
  }

  const gesture = (event) => {
    if (!event.isTrusted || event.target.closest?.("[data-sound-toggle]")) return;
    window.removeEventListener("pointerdown", gesture, true);
    window.removeEventListener("keydown", gesture, true);
    if (store.get(CHOICE) === "on" && !requested) void turn(true);
  };
  for (const control of controls) {
    control.hidden = false;
    control.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      void turn(!requested).catch(() => {});
    });
  }
  reflect();
  if (store.get(CHOICE) === "on") {
    window.addEventListener("pointerdown", gesture, true);
    window.addEventListener("keydown", gesture, true);
  }
  globalThis.siteSound = { evidence: () => ({ offered: true, on, ...(site?.evidence() ?? { context: null, bound: false, instrumentLab }) }) };
}
