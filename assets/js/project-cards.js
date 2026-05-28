(function () {
  const grids = Array.from(document.querySelectorAll("[data-project-card-grid]"));
  if (grids.length === 0) return;

  const cards = Array.from(document.querySelectorAll("[data-project-card]"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeCard = null;

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const measureCards = () => {
    const rects = new Map();
    cards.forEach((card) => rects.set(card, card.getBoundingClientRect()));
    return rects;
  };

  const animateLayout = (firstRects) => {
    if (prefersReducedMotion() || !("animate" in Element.prototype)) return;

    cards.forEach((card) => {
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
        duration: 420,
        easing: "cubic-bezier(.2, .75, .2, 1)",
      });
    });
  };

  const setCardState = (card, isExpanded, hasActiveCard) => {
    const trigger = card.querySelector("[data-project-card-trigger]");
    const panel = card.querySelector("[data-project-card-panel]");

    card.classList.toggle("is-expanded", isExpanded);
    card.classList.toggle("is-dimmed", hasActiveCard && !isExpanded);
    card.setAttribute("data-project-card-state", isExpanded ? "expanded" : "collapsed");

    if (trigger) {
      trigger.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    }

    if (panel) {
      panel.hidden = !isExpanded;
    }
  };

  const setActiveCard = (nextCard, options = {}) => {
    const firstRects = measureCards();
    activeCard = nextCard;

    cards.forEach((card) => {
      setCardState(card, card === activeCard, Boolean(activeCard));
    });

    window.requestAnimationFrame(() => {
      animateLayout(firstRects);
      if (activeCard && options.scroll) {
        const block = window.matchMedia("(max-width: 767px)").matches ? "center" : "nearest";
        activeCard.scrollIntoView({ block, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    });
  };

  cards.forEach((card) => {
    const trigger = card.querySelector("[data-project-card-trigger]");
    const closeButton = card.querySelector("[data-project-card-close]");

    if (trigger) {
      trigger.addEventListener("click", () => {
        setActiveCard(activeCard === card ? null : card, { scroll: true });
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        setActiveCard(null);
        if (trigger) trigger.focus({ preventScroll: true });
      });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeCard) return;

    const trigger = activeCard.querySelector("[data-project-card-trigger]");
    setActiveCard(null);
    if (trigger) trigger.focus({ preventScroll: true });
  });
})();
