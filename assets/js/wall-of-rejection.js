(function () {
  const grids = Array.from(document.querySelectorAll("[data-rejection-wall-grid]"));
  if (grids.length === 0) return;

  const cards = Array.from(document.querySelectorAll("[data-rejection-card]"));
  const details = Array.from(document.querySelectorAll(".wall-of-rejection details"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const measureCards = () => {
    const rects = new Map();
    cards.forEach((card) => rects.set(card, card.getBoundingClientRect()));
    return rects;
  };

  const syncOpenState = () => {
    document.body.classList.toggle(
      "wall-of-rejection-open",
      details.some((detail) => detail.open)
    );
  };

  const animateLayout = (firstRects) => {
    if (prefersReducedMotion() || !("animate" in Element.prototype)) return;

    cards.forEach((card) => {
      if ("getAnimations" in card) {
        card.getAnimations().forEach((animation) => animation.cancel());
      }

      const first = firstRects.get(card);
      const last = card.getBoundingClientRect();
      if (!first || !last.width || !last.height) return;

      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const sx = first.width / last.width;
      const sy = first.height / last.height;
      const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01;
      if (!moved) return;

      card.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "translate(0, 0) scale(1, 1)" }], {
        duration: 360,
        easing: "cubic-bezier(.18, .84, .22, 1)",
      });
    });
  };

  cards.forEach((card) => {
    const summary = card.querySelector("summary");
    if (!summary) return;

    summary.addEventListener("click", () => {
      const firstRects = measureCards();
      window.requestAnimationFrame(() => animateLayout(firstRects));
    });

    card.addEventListener("toggle", () => {
      card.setAttribute("data-rejection-state", card.open ? "expanded" : "collapsed");
      syncOpenState();
    });
  });

  details
    .filter((detail) => !detail.matches("[data-rejection-card]"))
    .forEach((detail) => {
      detail.addEventListener("toggle", syncOpenState);
    });
})();
