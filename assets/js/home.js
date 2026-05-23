(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = Array.from(document.querySelectorAll(".home-reveal"));

  root.classList.add("home-motion-ready");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("home-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("home-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  const sectionItems = Array.from(document.querySelectorAll("[data-home-section]"));
  const railLinks = Array.from(document.querySelectorAll("[data-home-rail-link]"));

  const setActiveRailLink = (sectionId) => {
    railLinks.forEach((link) => {
      const isActive = link.getAttribute("data-home-rail-link") === sectionId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  if (railLinks.length > 0 && sectionItems.length > 0 && "IntersectionObserver" in window) {
    const railObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) return;
        setActiveRailLink(visibleEntry.target.getAttribute("data-home-section"));
      },
      { rootMargin: "-28% 0px -52% 0px", threshold: [0.08, 0.25, 0.5, 0.75] }
    );

    sectionItems.forEach((section) => railObserver.observe(section));
    railLinks.forEach((link) => {
      link.addEventListener("click", () => setActiveRailLink(link.getAttribute("data-home-rail-link")));
    });
  }

  const portrait = document.getElementById("home-profile-image-container");
  if (!portrait) return;

  const hoverLayer = portrait.querySelector(".home-profile-image-hover-layer");
  const images = (portrait.getAttribute("data-images") || "").split(",").filter(Boolean);

  if (!hoverLayer || images.length === 0) return;

  const preloaded = images.map((src) => {
    const image = new Image();
    image.src = src;
    return image;
  });
  let imageIndex = -1;
  let isHovering = false;

  const setHoverImage = async () => {
    isHovering = true;
    imageIndex = (imageIndex + 1) % images.length;
    const image = preloaded[imageIndex];
    try {
      if (image.decode) await image.decode();
    } catch {
      // If decode fails, the browser can still attempt to paint the image.
    }
    hoverLayer.style.backgroundImage = `url("${images[imageIndex]}")`;
    window.requestAnimationFrame(() => {
      if (isHovering) hoverLayer.classList.add("is-visible");
    });
  };

  portrait.addEventListener("mouseenter", setHoverImage);
  portrait.addEventListener("mouseleave", () => {
    isHovering = false;
    hoverLayer.classList.remove("is-visible");
  });
})();
