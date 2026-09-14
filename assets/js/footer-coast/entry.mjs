// No renderer or model is fetched until the footer is approaching the viewport.
const host = document.querySelector("[data-footer-coast]");
if (host) {
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    try {
      const { mountCoast } = await import("./scene.mjs");
      await mountCoast(host);
    } catch {
      host.dataset.state = "fallback";
      host.querySelector(".footer-coast__actions").hidden = true;
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
}
