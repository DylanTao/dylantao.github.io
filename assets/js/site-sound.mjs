// The site's sound switch. Sound is a trial: the switch appears in the theme panel only for a visitor
// who has opened a page with ?sound=1 (remembered until ?sound=0), and nothing is loaded for anyone
// else. Even then no audio exists until the switch is turned on: the instrument (sound/site.mjs) is
// fetched when the switch is first shown, and its audio context is made inside the click that asks
// for it. Sirui, November 14, 2026: "sound is soul of game and animation".
const OFFERED = "site-sound-offered",
  CHOICE = "site-sound";
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
      // Private browsing: the choice lasts for this page.
    }
  },
};

const asked = new URLSearchParams(location.search).get("sound");
if (asked === "1") store.set(OFFERED, "1");
if (asked === "0") {
  store.set(OFFERED, null);
  store.set(CHOICE, null);
}
const offered = asked === "1" || (asked !== "0" && store.get(OFFERED) === "1");

if (offered) {
  const switches = () => [...document.querySelectorAll("[data-sound-toggle]")];
  let site = null,
    loading = null,
    on = false;
  const reflect = () => {
    document.documentElement.dataset.sound = on ? "on" : "off";
    for (const control of switches()) control.setAttribute("aria-checked", String(on));
  };
  const load = () => (loading ||= import("./sound/site.mjs").then(({ createSiteSound }) => (site = createSiteSound())));
  async function turn(next) {
    if (next) {
      // A first click that beats the fetch still counts: browsers keep the page's activation.
      if (!site) await load();
      on = await site.start();
    } else {
      on = false;
      await site?.stop();
    }
    store.set(CHOICE, on ? "on" : "off");
    reflect();
    return on;
  }
  for (const control of switches()) {
    control.hidden = false;
    control.addEventListener("click", () => {
      turn(!on).then((now) => now && site.sound.play("switch", { on: true }));
    });
  }
  reflect();
  load();
  // A visitor who left sound on hears it again from their first press or key on this page: a
  // browser will not start audio before one.
  if (store.get(CHOICE) === "on") {
    const resume = (event) => {
      if (event.target.closest?.("[data-sound-toggle]")) return;
      turn(true);
    };
    addEventListener("pointerdown", resume, { once: true, capture: true });
    addEventListener("keydown", resume, { once: true, capture: true });
  }
  // What the page's sound is doing, for tests and the curious.
  globalThis.siteSound = { evidence: () => ({ offered: true, on, ...(site?.evidence() ?? { context: null, bound: false }) }) };
}
