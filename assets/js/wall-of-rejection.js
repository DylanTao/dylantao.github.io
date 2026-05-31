(function () {
  const wall = document.querySelector(".wall-of-rejection");
  if (!wall) return;

  const cards = Array.from(wall.querySelectorAll("[data-rejection-card]"));
  const receiptTray = wall.querySelector("[data-rejection-receipt-tray]");
  const receiptSources = new Map(
    Array.from(wall.querySelectorAll("[data-rejection-receipt-source]")).map((source) => [source.dataset.rejectionSourceId, source])
  );
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const setActiveCard = (card, options = { focusTray: false }) => {
    const source = receiptSources.get(card.dataset.rejectionSourceId);
    if (!source || !receiptTray) return;

    cards.forEach((candidate) => {
      const active = candidate === card;
      candidate.classList.toggle("rejection-badge-active", active);
      candidate.setAttribute("aria-expanded", active ? "true" : "false");
    });

    receiptTray.innerHTML = source.innerHTML;
    receiptTray.hidden = false;
    receiptTray.classList.add("rejection-receipt-tray-active");
    document.body.classList.add("wall-of-rejection-open");

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

  cards.forEach((card) => {
    card.addEventListener("click", () => setActiveCard(card));
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
      cards[nextIndex].focus();
      setActiveCard(cards[nextIndex]);
    });
  });

  wall.querySelectorAll("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      document.body.classList.toggle("wall-of-rejection-open", detail.open || receiptTray?.classList.contains("rejection-receipt-tray-active"));
    });
  });
})();
