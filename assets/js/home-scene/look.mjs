// Look lab: matched previews of the realistic home's tone curve, bloom and fabric sheen. Flags come
// from the URL and stay for the browser session, so a preview survives moving around the site:
//   ?tone=aces|agx|neutral   ?bloom=1|0   ?sheen=1|0   ?look=reset
// The shipped look (chosen 2026-10-13 from the matched sheet) is ACES Filmic with bloom on actual
// light sources and a sheen on woven fabric; no flags means exactly that.
export const SHIPPED_LOOK = Object.freeze({ tone: "aces", bloom: true, sheen: true });

const KEY = "scene-look";
const TONES = ["aces", "agx", "neutral"];

export function readLook(search = "", storage = null) {
  const params = new URLSearchParams(search);
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(KEY) || "{}") || {};
  } catch {
    saved = {};
  }
  if (params.get("look") === "reset") saved = {};
  const flag = (name) => (params.has(name) ? params.get(name) !== "0" : typeof saved[name] === "boolean" ? saved[name] : SHIPPED_LOOK[name]);
  const tone = [params.get("tone"), saved.tone].find((value) => TONES.includes(value)) || SHIPPED_LOOK.tone;
  const look = { tone, bloom: flag("bloom"), sheen: flag("sheen") };
  try {
    if (Object.keys(SHIPPED_LOOK).some((key) => look[key] !== SHIPPED_LOOK[key])) storage?.setItem(KEY, JSON.stringify(look));
    else storage?.removeItem(KEY);
  } catch {
    /* Private browsing may disable storage; the URL still applies. */
  }
  return look;
}
