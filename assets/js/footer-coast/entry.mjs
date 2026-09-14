// No renderer or model is fetched until the footer is approaching the viewport.
document.querySelectorAll("[data-footer-coast]").forEach((host) => {
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    try {
      const { mountCoast } = await import("./scene.mjs");
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
