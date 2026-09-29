// No renderer or model is fetched until the footer is approaching the viewport.
document.querySelectorAll("[data-footer-coast]").forEach((host) => {
  // Match the still to the site theme without starting WebGL or downloading a model.
  const preview = host.querySelector("[data-coast-preview]");
  const syncPreview = () => {
    const root = document.documentElement;
    const selected = root.dataset.themeMode || (root.dataset.theme === "dark" ? "evening" : "noon");
    const theme = ["morning", "noon", "afternoon", "evening"].includes(selected) ? selected : "noon";
    preview?.querySelectorAll("[data-coast-view]").forEach((image) => {
      const attribute = image.tagName === "SOURCE" ? "srcset" : "src";
      const url = `${preview.dataset.coastPreview}${image.dataset.coastView}-${theme}.webp`;
      if (image.getAttribute(attribute) !== url) image.setAttribute(attribute, url);
    });
  };
  syncPreview();
  const themeObserver = new MutationObserver(syncPreview);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode", "data-theme"] });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) themeObserver.disconnect();
  });
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    try {
      const module = new URL("./scene.mjs", import.meta.url);
      module.search = new URL(import.meta.url).search;
      const { mountCoast } = await import(module.href);
      await mountCoast(host);
    } catch {
      host.dataset.state = "fallback";
    }
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "450px 0px" }
    );
    observer.observe(host);
  } else start();
});
