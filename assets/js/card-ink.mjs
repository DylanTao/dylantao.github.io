// A 240 ms afterimage of the closing card's prose. The real card closes and returns focus now.
// Figures, controls and live content never enter the filter; interruption removes the whole copy.
let serial = 0;
export function dissolveCardInk(card) {
  const view = card?.ownerDocument?.defaultView;
  if (
    !view ||
    view.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (view.navigator.webdriver && !/[?&]cinematic=live(?:&|$)/.test(view.location.search))
  )
    return null;
  const source = card.querySelector("[data-project-card-story]");
  const box = source?.getBoundingClientRect();
  if (!box?.width || !box.height || box.bottom < 0 || box.top > view.innerHeight) return null;
  const doc = card.ownerDocument;
  const ghost = doc.createElement("div");
  ghost.className = "project-card-ink";
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "30",
  });
  const copy = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  copies.forEach((node, index) => {
    const style = view.getComputedStyle(originals[index]);
    for (const key of [
      "display",
      "box-sizing",
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "font-stretch",
      "font-variation-settings",
      "font-feature-settings",
      "line-height",
      "letter-spacing",
      "color",
      "margin",
      "padding",
      "gap",
      "grid-template-columns",
      "text-transform",
      ...["top", "right", "bottom", "left"].flatMap((side) => [`border-${side}-width`, `border-${side}-style`, `border-${side}-color`]),
    ])
      node.style.setProperty(key, style.getPropertyValue(key));
    node.removeAttribute("id");
    node.removeAttribute("aria-label");
  });
  // This surface accepts prose only even if a future card author adds media to the story.
  copy.querySelectorAll("img, picture, svg, canvas, video, iframe, button, input").forEach((node) => node.remove());
  const ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.display = "block";
  const id = `card-ink-${++serial}`;
  svg.innerHTML = `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="7" result="grain"/><feColorMatrix in="grain" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .333 .333 .333 0 0"/><feComponentTransfer><feFuncA type="linear" slope="8" intercept="1"/></feComponentTransfer><feComposite in="SourceGraphic" operator="in"/></filter></defs>`;
  copy.style.filter = `url(#${id})`;
  copy.style.margin = "0";
  ghost.append(svg, copy);
  doc.body.append(ghost);
  const alpha = svg.querySelector("feFuncA");
  const start = view.performance.now();
  let frame = 0,
    removed = false;
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  const cancel = () => {
    if (removed) return;
    removed = true;
    view.cancelAnimationFrame(frame);
    ghost.remove();
    finish();
  };
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 240);
    alpha.setAttribute("intercept", String(1 - 9 * t));
    if (t === 1) cancel();
    else frame = view.requestAnimationFrame(tick);
  };
  frame = view.requestAnimationFrame(tick);
  return {
    cancel,
    finished,
    // A closing phone card often gives its old story's space to the next paragraph. An afterimage
    // belongs only in empty space; never paint it over a newly available link, word or figure.
    keepIfClear() {
      const overlaps = [
        ...doc.querySelectorAll(
          "main p, main h1, main h2, main h3, main h4, main a, main button, main img, main canvas, main svg, #main p, #main h1, #main h2, #main h3, #main h4, #main a, #main button, #main img, #main canvas, #main svg"
        ),
      ].some((node) => {
        if (ghost.contains(node) || !node.getClientRects().length) return false;
        const style = view.getComputedStyle(node);
        if (style.visibility === "hidden" || Number(style.opacity) < 0.05) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.right > box.left && rect.left < box.right && rect.bottom > box.top && rect.top < box.bottom;
      });
      if (overlaps) cancel();
      return !overlaps;
    },
  };
}
