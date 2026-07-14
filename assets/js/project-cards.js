(function () {
  const grids = Array.from(document.querySelectorAll("[data-project-card-grid]"));
  if (grids.length === 0) return;

  const cards = Array.from(document.querySelectorAll("[data-project-card]"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const status = document.querySelector("[data-project-card-status]");
  let activeCard = null;

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const cardTitle = (card) => card?.querySelector(".card-title")?.textContent?.trim() || "Project";

  const announceCardState = (card, isExpanded) => {
    if (!status || !card) return;
    status.textContent = `${cardTitle(card)} preview ${isExpanded ? "opened" : "closed"}.`;
  };

  const measureCards = () => {
    const rects = new Map();
    cards.forEach((card) => rects.set(card, card.getBoundingClientRect()));
    return rects;
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
        duration: 430,
        easing: "cubic-bezier(.18, .84, .22, 1)",
      });
    });
  };

  const revealCard = (card) => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const scrollTarget = isMobile ? card.querySelector("[data-project-card-primary-action]") || card : card;
    const rect = scrollTarget.getBoundingClientRect();
    const margin = isMobile ? 16 : 28;
    const isVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
    if (isVisible) return;

    scrollTarget.scrollIntoView({
      block: isMobile ? "end" : "center",
      inline: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
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
    const previousCard = activeCard;
    const shouldRestoreFocus = Boolean(previousCard && options.restoreFocus && previousCard.contains(document.activeElement));
    activeCard = nextCard;

    cards.forEach((card) => {
      setCardState(card, card === activeCard, Boolean(activeCard));
    });
    grids.forEach((grid) => {
      grid.classList.toggle("has-expanded-project-card", Boolean(activeCard));
    });
    document.body.classList.toggle("project-card-preview-open", Boolean(activeCard));
    if (activeCard) {
      announceCardState(activeCard, true);
    } else if (previousCard) {
      announceCardState(previousCard, false);
    }

    window.requestAnimationFrame(() => {
      animateLayout(firstRects);
      if (activeCard && options.scroll) {
        const cardToReveal = activeCard;
        revealCard(cardToReveal);

        if (!prefersReducedMotion()) {
          window.setTimeout(() => {
            if (activeCard === cardToReveal) revealCard(cardToReveal);
          }, 460);
        }
      }
      if (activeCard && options.focusPrimaryAction) {
        const primaryAction = activeCard.querySelector("[data-project-card-primary-action]");
        if (primaryAction) {
          primaryAction.focus({ preventScroll: true });
        }
      }
      if (!activeCard && previousCard && shouldRestoreFocus) {
        previousCard.querySelector("[data-project-card-trigger]")?.focus({ preventScroll: true });
      }
    });
  };

  cards.forEach((card) => {
    const trigger = card.querySelector("[data-project-card-trigger]");
    const closeButton = card.querySelector("[data-project-card-close]");

    if (trigger) {
      trigger.addEventListener("click", (event) => {
        setActiveCard(activeCard === card ? null : card, {
          focusPrimaryAction: event.detail === 0,
          restoreFocus: true,
          scroll: true,
        });
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        setActiveCard(null, { restoreFocus: true });
      });
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!activeCard || event.button > 0) return;

    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;
    if (target.closest("[data-project-card]")) return;
    if (target.closest("a, button, input, textarea, select, summary, [role='button']")) return;

    setActiveCard(null, { restoreFocus: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeCard) return;

    setActiveCard(null, { restoreFocus: true });
  });
})();
