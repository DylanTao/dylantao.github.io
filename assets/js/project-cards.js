(function () {
  const grids = Array.from(document.querySelectorAll("[data-project-card-grid]"));
  if (grids.length === 0) return;

  const cards = Array.from(document.querySelectorAll("[data-project-card]"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const status = document.querySelector("[data-project-card-status]");
  const flipTiming = {
    duration: 430,
    easing: "cubic-bezier(.18, .84, .22, 1)",
  };
  let activeCard = null;
  let flipClock = null;

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const cardTitle = (card) => card?.querySelector(".card-title")?.textContent?.trim() || "Project";

  const announceCardState = (card, isExpanded) => {
    if (!status || !card) return;
    status.textContent = `${cardTitle(card)} preview ${isExpanded ? "opened" : "closed"}.`;
  };

  const measureCards = () => {
    const rects = new Map();
    cards.forEach((card) => {
      rects.set(card, {
        card: card.getBoundingClientRect(),
        surface: card.querySelector(".card")?.getBoundingClientRect() || null,
      });
    });
    return rects;
  };

  const cancelFlipClock = () => {
    const clock = flipClock;
    if (!clock) return;

    flipClock = null;
    if (clock.frame) window.cancelAnimationFrame(clock.frame);
    clock.animations.forEach((animation) => animation.cancel());
  };

  const runFlipClock = (firstRects, { openingCard, onSettled } = {}) => {
    const clock = {
      animations: [],
      frame: 0,
    };
    flipClock = clock;

    clock.frame = window.requestAnimationFrame(() => {
      clock.frame = 0;
      if (flipClock !== clock) return;

      if (!prefersReducedMotion() && "animate" in Element.prototype) {
        cards.forEach((card) => {
          const first = firstRects.get(card)?.card;
          const last = card.getBoundingClientRect();
          if (!first || !last.width || !last.height) return;

          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) return;

          clock.animations.push(card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], flipTiming));
        });

        const openingSurface = openingCard?.querySelector(".card");
        const firstSurface = openingCard ? firstRects.get(openingCard)?.surface : null;
        const lastSurface = openingSurface?.getBoundingClientRect();
        if (openingSurface && firstSurface && lastSurface?.width && lastSurface.height) {
          const rightInset = Math.max(0, lastSurface.width - firstSurface.width);
          const bottomInset = Math.max(0, lastSurface.height - firstSurface.height);
          if (rightInset > 0.5 || bottomInset > 0.5) {
            clock.animations.push(
              openingSurface.animate([{ clipPath: `inset(0 ${rightInset}px ${bottomInset}px 0)` }, { clipPath: "inset(0)" }], flipTiming)
            );
          }
        }
      }

      const didAnimate = clock.animations.length > 0;

      const settle = () => {
        if (flipClock !== clock) return;

        clock.animations.forEach((animation) => {
          if (animation.playState !== "idle") animation.cancel();
        });
        flipClock = null;
        onSettled?.();
      };

      if (!didAnimate) {
        settle();
        return;
      }

      Promise.allSettled(clock.animations.map((animation) => animation.finished)).then(settle);
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
    const openingCard = nextCard && nextCard !== previousCard ? nextCard : null;
    const openingTrigger = openingCard?.querySelector("[data-project-card-trigger]") || null;
    const shouldFocusPrimaryAction = Boolean(options.focusPrimaryAction && openingTrigger && document.activeElement === openingTrigger);
    const shouldRestoreFocus = Boolean(previousCard && options.restoreFocus && previousCard.contains(document.activeElement));
    const focusReturnTarget = !nextCard && shouldRestoreFocus ? previousCard.querySelector("[data-project-card-trigger]") : null;
    cancelFlipClock();

    focusReturnTarget?.focus({ preventScroll: true });

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

    const cardToReveal = activeCard && options.scroll ? activeCard : null;
    runFlipClock(firstRects, {
      openingCard,
      onSettled: () => {
        const activeElement = document.activeElement;
        if (
          !activeCard &&
          focusReturnTarget &&
          (activeElement === focusReturnTarget || activeElement === document.body || activeElement === document.documentElement)
        ) {
          focusReturnTarget.focus({ preventScroll: true });
        }
        if (openingCard && activeCard === openingCard && shouldFocusPrimaryAction && document.activeElement === openingTrigger) {
          openingCard.querySelector("[data-project-card-primary-action]")?.focus({ preventScroll: true });
        }
        if (cardToReveal && activeCard === cardToReveal) revealCard(cardToReveal);
      },
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
