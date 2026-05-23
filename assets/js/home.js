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

  const portrait = document.getElementById("home-profile-image-container");
  if (!portrait) return;

  const hoverLayer = portrait.querySelector(".home-profile-image-hover-layer");
  const images = (portrait.getAttribute("data-images") || "").split(",").filter(Boolean);

  if (!hoverLayer || images.length === 0) return;

  hoverLayer.style.backgroundImage = `url("${images[0]}")`;
  portrait.addEventListener("mouseenter", () => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    hoverLayer.style.backgroundImage = `url("${randomImage}")`;
  });
})();
