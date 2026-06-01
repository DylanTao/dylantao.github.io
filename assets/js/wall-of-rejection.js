(function () {
  const wall = document.querySelector(".wall-of-rejection");
  if (!wall) return;

  const cards = Array.from(wall.querySelectorAll("[data-rejection-card]"));
  const receiptTray = wall.querySelector("[data-rejection-receipt-tray]");
  const receiptSources = new Map(
    Array.from(wall.querySelectorAll("[data-rejection-receipt-source]")).map((source) => [source.dataset.rejectionSourceId, source])
  );
  const memeViewer = document.querySelector("[data-rejection-meme-viewer]");
  const memeOpenButtons = Array.from(document.querySelectorAll("[data-rejection-meme-open]"));
  const memeCloseButtons = Array.from(document.querySelectorAll("[data-rejection-meme-close]"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pinnedCard = null;
  let lastMemeTrigger = null;
  let receiptCloseAnimation = null;

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const openXpRule = () => Array.from(wall.querySelectorAll(".failure-xp-rules")).find((detail) => detail.open);

  const updateBodyState = () => {
    const xpRulesOpen = Boolean(openXpRule());
    const receiptOpen = Boolean(receiptTray && !receiptTray.hidden);
    document.body.classList.toggle("wall-of-rejection-open", xpRulesOpen || receiptOpen || Boolean(memeViewer && !memeViewer.hidden));
  };

  const closeXpRule = () => {
    const detail = openXpRule();
    if (!detail) return null;
    detail.open = false;
    updateBodyState();
    return detail;
  };

  const hideReceiptTray = (options = { animate: true }) => {
    if (!receiptTray || receiptTray.hidden) return;

    receiptCloseAnimation?.cancel();
    receiptCloseAnimation = null;

    const finish = () => {
      receiptTray.hidden = true;
      receiptTray.classList.remove("rejection-receipt-tray-active", "rejection-receipt-tray-pinned", "rejection-receipt-tray-closing");
      receiptTray.innerHTML = "";
      updateBodyState();
    };

    if (options.animate && !prefersReducedMotion() && "animate" in receiptTray) {
      receiptTray.classList.add("rejection-receipt-tray-closing");
      receiptCloseAnimation = receiptTray.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(-0.22rem)" },
        ],
        { duration: 150, easing: "ease-in" }
      );
      receiptCloseAnimation.addEventListener("finish", finish, { once: true });
      return;
    }

    finish();
  };

  const clearCardState = (options = { animate: true }) => {
    cards.forEach((candidate) => {
      candidate.classList.remove("rejection-badge-active", "rejection-badge-pinned");
      candidate.setAttribute("aria-expanded", "false");
    });
    hideReceiptTray(options);
    updateBodyState();
  };

  const setActiveCard = (card, options = { pinned: false, focusTray: false }) => {
    const source = receiptSources.get(card.dataset.rejectionSourceId);
    if (!source || !receiptTray) return;

    receiptCloseAnimation?.cancel();
    receiptCloseAnimation = null;

    cards.forEach((candidate) => {
      const active = candidate === card;
      candidate.classList.toggle("rejection-badge-active", active);
      candidate.classList.toggle("rejection-badge-pinned", active && options.pinned);
      candidate.setAttribute("aria-expanded", active ? "true" : "false");
    });

    receiptTray.hidden = false;
    receiptTray.innerHTML = source.innerHTML;
    receiptTray.classList.add("rejection-receipt-tray-active");
    receiptTray.classList.remove("rejection-receipt-tray-closing");
    receiptTray.classList.toggle("rejection-receipt-tray-pinned", Boolean(options.pinned));
    updateBodyState();

    if (!prefersReducedMotion() && "animate" in receiptTray) {
      receiptTray.getAnimations().forEach((animation) => animation.cancel());
      receiptTray.animate(
        [
          { opacity: 0.72, transform: "translateY(-0.2rem)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 180, easing: "ease-out" }
      );
    }

    if (options.focusTray) {
      receiptTray.focus({ preventScroll: true });
    }
  };

  const togglePinned = (card) => {
    if (pinnedCard === card) {
      pinnedCard = null;
      clearCardState();
      return;
    }

    pinnedCard = card;
    setActiveCard(card, { pinned: true });
  };

  const openMemeViewer = (trigger) => {
    if (!memeViewer) return;
    lastMemeTrigger = trigger || document.activeElement;
    memeViewer.hidden = false;
    document.documentElement.classList.add("rejection-meme-viewer-open");
    document.body.classList.add("rejection-meme-viewer-open");
    updateBodyState();

    const closeButton = memeViewer.querySelector("[data-rejection-meme-close]");
    closeButton?.focus({ preventScroll: true });
  };

  const closeMemeViewer = () => {
    if (!memeViewer || memeViewer.hidden) return;
    memeViewer.hidden = true;
    document.documentElement.classList.remove("rejection-meme-viewer-open");
    document.body.classList.remove("rejection-meme-viewer-open");
    updateBodyState();

    if (lastMemeTrigger && typeof lastMemeTrigger.focus === "function") {
      lastMemeTrigger.focus({ preventScroll: true });
    }
    lastMemeTrigger = null;
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => togglePinned(card));
    card.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = cards.indexOf(card);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % cards.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + cards.length) % cards.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = cards.length - 1;
      }
      pinnedCard = null;
      clearCardState();
      cards[nextIndex].focus();
    });
  });

  wall.querySelectorAll("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      updateBodyState();
    });
  });

  memeOpenButtons.forEach((button) => {
    button.addEventListener("click", () => openMemeViewer(button));
  });

  memeCloseButtons.forEach((button) => {
    button.addEventListener("click", closeMemeViewer);
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;

    const activeXpRule = openXpRule();
    if (activeXpRule && !activeXpRule.contains(target)) {
      closeXpRule();
    }

    if (!pinnedCard || target.closest("[data-rejection-card], [data-rejection-receipt-tray]")) return;

    pinnedCard = null;
    clearCardState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (memeViewer && !memeViewer.hidden) {
      closeMemeViewer();
      return;
    }

    const activeXpRule = openXpRule();
    if (activeXpRule) {
      const summary = activeXpRule.querySelector("summary");
      closeXpRule();
      summary?.focus({ preventScroll: true });
      return;
    }

    if (pinnedCard) {
      const cardToFocus = pinnedCard;
      pinnedCard = null;
      clearCardState();
      cardToFocus.focus({ preventScroll: true });
    }
  });
})();
