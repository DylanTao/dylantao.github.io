// Liquid glass for the navigation bar. A lip below the bar bends what scrolls beneath it like the
// rounded edge of a glass slab: its top rows show the page a few pixels lower, so a passing line
// stretches as it slides under. Chromium draws SVG filters inside backdrop-filter; Firefox and
// Safari parse the same rule and draw nothing, so they keep the frosted bar. Reduced transparency,
// more contrast and forced colors keep it too.
(function () {
  const brands = navigator.userAgentData?.brands || [];
  if (!brands.some((entry) => entry.brand === "Chromium")) return;

  const plain = window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)");
  // Displacement map: green encodes the vertical offset (128 = none, 255 = half the scale lower).
  const map =
    "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' preserveAspectRatio='none'>" +
    "<defs><linearGradient id='bevel' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='rgb(128,255,0)'/><stop offset='0.55' stop-color='rgb(128,170,0)'/><stop offset='1' stop-color='rgb(128,128,0)'/>" +
    "</linearGradient></defs><rect width='8' height='8' fill='url(%23bevel)'/></svg>";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "liquid-glass-defs");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = `
    <filter id="liquid-glass-lip" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage href="data:image/svg+xml;utf8,${map}" preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="8" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
  document.body.append(svg);

  const sync = () => {
    if (plain.matches) document.documentElement.removeAttribute("data-liquid-glass");
    else document.documentElement.setAttribute("data-liquid-glass", "");
  };
  sync();
  plain.addEventListener("change", sync);
})();
