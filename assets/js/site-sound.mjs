// A trusted gesture unlocks interaction effects. The music transport starts
// paused in every document, even when a recording played on the previous page.
const params = new URLSearchParams(location.search);
const instrumentLab = params.get("sound-lab") === "1";
const EFFECTS_KEY = "site-effects";
const VOLUME_KEY = "site-sound-volume";
const GESTURES = ["pointerdown", "pointerup", "keydown", "click"];
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
      localStorage.setItem(key, value);
    } catch {
      // The preference still applies to this page.
    }
  },
};

const musicControls = [...document.querySelectorAll("[data-sound-toggle]")];
const effectsControls = [...document.querySelectorAll("[data-effects-toggle]")];
const transportControls = "[data-sound-toggle], [data-effects-toggle]";
const root = document.documentElement;

if (params.get("sound") === "0") {
  root.dataset.sound = "off";
  root.dataset.effects = "off";
  root.dataset.music = "off";
  for (const control of [...musicControls, ...effectsControls]) control.hidden = true;
} else {
  let site = null;
  let loading = null;
  let activation = null;
  let audioContext = null;
  let musicOn = false;
  let effectsOn = store.get(EFFECTS_KEY) !== "off";
  let musicIntent = 0;
  let gestureEpoch = 0;
  let record = null;
  const mediaSources = new WeakMap();
  const storedVolume = store.get(VOLUME_KEY);
  let volume = storedVolume !== null && Number.isFinite(+storedVolume) ? Math.min(1, Math.max(0, +storedVolume)) : 1;
  const wantsAudio = () => effectsOn || musicOn;

  function reflect() {
    const label = musicOn ? "Pause music" : "Play music";
    root.dataset.effects = root.dataset.sound = effectsOn ? "on" : "off";
    root.dataset.music = musicOn ? "on" : "off";
    for (const control of musicControls) {
      control.setAttribute("aria-pressed", String(musicOn));
      if (control.getAttribute("role") === "switch" || control.hasAttribute("aria-checked")) {
        control.setAttribute("aria-checked", String(musicOn));
      }
      control.setAttribute("aria-label", label);
      const text = control.querySelector("[data-music-label]");
      if (text) text.textContent = label;
    }
    for (const control of effectsControls) control.setAttribute("aria-checked", String(effectsOn));
    window.dispatchEvent(new CustomEvent("siteSoundChange", { detail: { on: musicOn, musicOn, effectsOn, volume } }));
  }

  function load() {
    return (loading ||= import("./sound/site.mjs")
      .then(({ createSiteSound }) => {
        site = createSiteSound({
          audioContext,
          instrumentLab,
          recordSelected: () => Boolean(record),
          musicEnabled: () => musicOn,
          effectsEnabled: () => effectsOn,
        });
        site.sound.setVolume(volume);
        return site;
      })
      .catch((error) => {
        loading = null;
        throw error;
      }));
  }

  // Resume on the trusted call stack. A late module import checks current
  // transport choices before it may put a sound on the newly unlocked graph.
  function activate() {
    if (!wantsAudio() || document.hidden) return Promise.resolve(false);
    if (site?.sound.on && audioContext?.state === "running") {
      site.refresh();
      return Promise.resolve(true);
    }
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return Promise.resolve(false);
    let unlocked;
    try {
      audioContext ||= new Context({ latencyHint: "interactive" });
      unlocked = audioContext.state === "running" ? Promise.resolve() : audioContext.resume();
    } catch {
      return Promise.resolve(false);
    }
    if (activation) {
      void unlocked.catch(() => {});
      return activation;
    }
    activation = Promise.all([load(), unlocked])
      .then(async ([session]) => {
        if (!wantsAudio() || document.hidden) return false;
        return session.start();
      })
      .catch(() => false)
      .finally(() => {
        activation = null;
        updateSession();
      });
    return activation;
  }

  function updateSession() {
    if (wantsAudio() && !document.hidden) site?.refresh();
    else if (!wantsAudio()) {
      if (site?.sound.on) void site.stop().catch(() => {});
      else if (audioContext?.state === "running") void audioContext.suspend().catch(() => {});
    }
    reflect();
  }

  function releaseRecord() {
    const last = record;
    record = null;
    last?.pause();
  }

  async function setMusic(next) {
    const intent = ++musicIntent;
    musicOn = Boolean(next);
    if (!musicOn) {
      releaseRecord();
      updateSession();
      return false;
    }
    if (!audioContext && !(globalThis.AudioContext || globalThis.webkitAudioContext) && record?.canPlayType("audio/mpeg")) {
      record.volume = volume;
      updateSession();
      return true;
    }
    // Polling or rendering may publish the visual state synchronously. The
    // score does not start until activate has a running graph.
    reflect();
    const started = await activate();
    if (intent !== musicIntent || !musicOn) return false;
    if (!started) {
      musicOn = false;
      releaseRecord();
      updateSession();
      return false;
    }
    site.refresh({ explicitMusic: true });
    return true;
  }

  function setEffects(next) {
    effectsOn = Boolean(next);
    updateSession();
    if (effectsOn) void activate();
  }

  async function attachMediaElement(element) {
    if (!(element instanceof HTMLMediaElement) || document.hidden) return false;
    if (record !== element) releaseRecord();
    record = element;
    // Reserve the music bus before unlocking, so this choice cannot also
    // start the page score. A new recording may use the same audio element.
    site?.refresh();
    if (!(await setMusic(true)) || record !== element) return false;
    const graph = site?.sound.graph;
    if (!mediaSources.has(element)) {
      const source = graph?.context.createMediaElementSource(element);
      if (source) source.connect(graph.dry);
      mediaSources.set(element, source ?? null);
      for (const type of ["play", "pause", "ended", "emptied"]) element.addEventListener(type, reflect);
    }
    return true;
  }

  const stopSelectedRecord = () => {
    if (record) void setMusic(false);
  };
  window.addEventListener("pagehide", () => {
    if (musicOn) void setMusic(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSelectedRecord();
  });
  window.addEventListener("siteArtChange", stopSelectedRecord);
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest?.('[data-home-desk-mode="3d"]')) stopSelectedRecord();
    },
    true
  );

  const unlockEffects = (event) => {
    if (!effectsOn || !event.isTrusted || event.target.closest?.(transportControls)) return;
    if (!site?.sound.on || audioContext?.state !== "running") void activate();
  };
  for (const type of GESTURES) window.addEventListener(type, unlockEffects, { capture: true, passive: true });

  document.addEventListener("click", (event) => {
    if (!event.isTrusted || !effectsOn || instrumentLab) return;
    const target = event.target;
    if (site?.sound.on) site.press(target);
    else if (activation) void activation.then((started) => started && effectsOn && site.press(target));
  });

  for (const control of musicControls) {
    control.hidden = false;
    control.addEventListener("click", (event) => {
      if (event.isTrusted) void setMusic(!musicOn);
    });
  }
  for (const control of effectsControls) {
    control.hidden = false;
    control.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      const enabled = !effectsOn;
      store.set(EFFECTS_KEY, enabled ? "on" : "off");
      setEffects(enabled);
    });
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== EFFECTS_KEY) return;
    effectsOn = event.newValue !== "off";
    updateSession();
  });

  globalThis.siteSound = {
    attachMediaElement,
    detachMediaElement(element) {
      if (record === element) stopSelectedRecord();
    },
    playMusic: () => setMusic(true),
    pauseMusic: () => setMusic(false),
    gesture(kind, strength, pan, material) {
      if (kind === "rest") gestureEpoch++;
      if (!effectsOn) return;
      if (site?.sound.on) site.gesture(kind, strength, pan, material);
      else if (activation && kind !== "rest") {
        const epoch = gestureEpoch;
        void activation.then((started) => started && effectsOn && epoch === gestureEpoch && site.gesture(kind, strength, pan, material));
      }
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.min(1, Math.max(0, value));
      store.set(VOLUME_KEY, String(volume));
      site?.sound.setVolume(volume);
      if (record && !audioContext) record.volume = volume;
      reflect();
    },
    evidence: () => ({
      offered: true,
      ...(site?.evidence() ?? { context: audioContext?.state ?? null, bound: false, instrumentLab }),
      on: musicOn,
      musicOn,
      effectsOn,
      volume,
      recordTitle: record && !record.paused ? record.dataset.title : null,
    }),
  };
  reflect();
}
