// Enable the blog's localized glass lens where Chromium draws SVG backdrop filters. The navbar
// keeps its ordinary frosted surface: refracting the page below it stretched passing text.
// Reduced transparency, more contrast and forced colors keep the lens plain as well.
(function () {
  const brands = navigator.userAgentData?.brands || [];
  if (!brands.some((entry) => entry.brand === "Chromium")) return;

  const plain = window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)");
  const sync = () => {
    if (plain.matches) document.documentElement.removeAttribute("data-liquid-glass");
    else document.documentElement.setAttribute("data-liquid-glass", "");
  };
  sync();
  plain.addEventListener("change", sync);
})();
