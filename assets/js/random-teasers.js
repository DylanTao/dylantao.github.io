(function () {
  const teaserFrames = Array.from(document.querySelectorAll("[data-random-teasers]"));
  if (teaserFrames.length === 0) return;

  const chooseTeaser = (teasers) => teasers[Math.floor(Math.random() * teasers.length)];

  teaserFrames.forEach((frame) => {
    const teasers = (frame.dataset.randomTeasers || "")
      .split("|")
      .map((teaser) => teaser.trim())
      .filter(Boolean);
    const image = frame.querySelector("img");
    if (!image || teasers.length < 2) return;

    const teaser = chooseTeaser(teasers);
    const fallback = image.dataset.originalSrc || image.getAttribute("src");
    frame.classList.toggle("random-teaser-title", /title|verse-title/.test(teaser));
    frame.querySelectorAll("source").forEach((source) => source.remove());
    // Teasers are responsive WebP variants; a build without ImageMagick shows the original image.
    image.onerror = () => {
      image.onerror = null;
      if (fallback && image.getAttribute("src") !== fallback) image.src = fallback;
    };
    image.src = teaser;
    image.removeAttribute("srcset");
  });
})();
