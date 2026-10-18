(function () {
  const grids = Array.from(document.querySelectorAll("[data-project-card-grid]"));
  if (grids.length === 0) return;

  // Decks (project-decks.mjs) open into levels instead of previews; every other card previews in place.
  const cards = Array.from(document.querySelectorAll("[data-project-card]:not([data-project-deck])"));
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phoneQuery = window.matchMedia("(max-width: 767px)");
  const status = document.querySelector("[data-project-card-status]");
  // Everything one change moves shares one spring (assets/js/site-motion.mjs, "layout": damping 0.84,
  // settling in about 600 ms with under 1% overshoot) and one clock. Keyframes sample the spring, so
  // a run that is interrupted hands each card its current speed instead of restarting from rest.
  // Without the motion module the cards change state at once, as they do with reduced motion.
  const KEYFRAMES = 30;
  const CONTENT =
    ".project-card-heading, .project-card-meta, .card-text, .project-card-direct-link, .project-card-story-beat, .project-card-takeaways, .project-card-actions-expanded > *";
  let activeCard = null;
  let clock = null;
  // Where the reader was before a card opened, so closing can give that place back.
  let anchor = null;

  const prefersReducedMotion = () => reduceMotionQuery.matches;
  const springs = () => {
    const motion = window.SiteMotion;
    if (prefersReducedMotion() || !motion?.spring || !("animate" in Element.prototype)) return null;
    return {
      layout: motion.spring("layout"),
      gentle: motion.spring("gentle"),
      confident: motion.spring("confident"),
      playful: motion.spring("playful"),
    };
  };

  const cardTitle = (card) => card?.querySelector(".card-title")?.textContent?.trim() || "Project";

  const announceCardState = (card, isExpanded) => {
    if (!status || !card) return;
    status.textContent = `${cardTitle(card)} preview ${isExpanded ? "opened" : "closed"}.`;
  };

  // The painted area of a picture inside its box. object-fit keeps the picture's own proportions, so
  // a uniform scale carries it between the two layouts without squeezing it.
  const paintedRect = (image) => {
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const box = image.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const style = getComputedStyle(image);
    const ratio = image.naturalWidth / image.naturalHeight;
    const cover = style.objectFit === "cover";
    let width = box.width;
    let height = width / ratio;
    if (cover ? height < box.height : height > box.height) {
      height = box.height;
      width = height * ratio;
    }
    const [px = 50, py = 50] = (style.objectPosition || "50% 50%").split(/\s+/).map((part) => (part.endsWith("%") ? parseFloat(part) : 50));
    return { left: box.left + ((box.width - width) * px) / 100, top: box.top + ((box.height - height) * py) / 100, width, height, box };
  };

  // Deck articles (project-decks.mjs) are not previews, but they glide as one block when a card above
  // them opens, carrying the level they hold. Cards inside a closed level are skipped: measuring them
  // would lay out a hidden subtree, and nothing there is drawn.
  const decks = Array.from(document.querySelectorAll("[data-project-card][data-project-deck]"));
  const shown = (element) => !element.closest("[hidden], .is-folded");
  const measureCards = () => {
    const rects = new Map();
    decks.forEach((deck) => {
      if (shown(deck)) rects.set(deck, { card: deck.getBoundingClientRect() });
    });
    cards.forEach((card) => {
      if (!shown(card)) return;
      rects.set(card, {
        card: card.getBoundingClientRect(),
        surface: card.querySelector(".card")?.getBoundingClientRect() || null,
        body: card.querySelector(".project-card-body")?.getBoundingClientRect() || null,
        picture: paintedRect(card.querySelector(".project-card-media img")),
      });
    });
    return rects;
  };

  // Speed (px/s) each element still had when a run was interrupted, read from its spring. A card still
  // waiting for the ripple to reach it has not started moving.
  const carriedVelocity = () => {
    const velocity = new Map();
    clock?.tracks.forEach((track) => {
      const elapsed = Math.max(0, (track.animation.currentTime || 0) - (track.delay || 0)) / 1000;
      const [, vx] = track.spring.state(track.x0, track.vx0, elapsed);
      const [, vy] = track.spring.state(track.y0, track.vy0, elapsed);
      const [, vs] = track.spring.state(track.s0 - 1, track.vs0, elapsed);
      velocity.set(track.element, { vx, vy, vs });
    });
    return velocity;
  };

  const cancelClock = () => {
    const running = clock;
    if (!running) return;
    clock = null;
    running.timers.forEach((timer) => window.clearTimeout(timer));
    running.animations.forEach((animation) => animation.cancel());
    running.grids?.forEach((grid) => grid.classList.remove("is-reflowing"));
  };

  // An opened card keeps its row: it spans two columns from its own column, or from the one before
  // when it is the last in its row, so the grid never leaves a hole where it was. Phones show one
  // column (or the experiments' sideways row), where the card simply grows.
  const columnCount = (grid) => {
    const style = getComputedStyle(grid);
    if (style.display !== "grid" || !style.gridTemplateColumns || style.gridTemplateColumns === "none") return 0;
    return style.gridTemplateColumns.trim().split(/\s+/).length;
  };

  const placeCard = (card) => {
    card.style.removeProperty("grid-column");
    card.style.removeProperty("grid-row");
    card.style.removeProperty("--project-card-body-top");
    if (!card.classList.contains("is-expanded")) return;
    // The close button lines up with the top of the card's copy, where the plus was: the card's top
    // beside the picture, just below it on a phone, so it never covers the figure.
    const body = card.querySelector(".project-card-body");
    if (body) card.style.setProperty("--project-card-body-top", `${body.offsetTop}px`);
    const grid = card.closest("[data-project-card-grid]");
    const columns = grid ? columnCount(grid) : 0;
    if (columns < 2) return;
    const siblings = Array.from(grid.children).filter((child) => child.matches("[data-project-card]"));
    const index = siblings.indexOf(card);
    if (index < 0) return;
    const column = (index % columns) + 1;
    card.style.gridColumn = `${column === columns ? columns - 1 : column} / span 2`;
    card.style.gridRow = String(Math.floor(index / columns) + 1);
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
    placeCard(card);
  };

  // A spring from offset (x0, y0) and scale s0 to rest, with the speed it already had.
  const springFrames = (spring, duration, { x0 = 0, y0 = 0, vx0 = 0, vy0 = 0, s0 = 1, vs0 = 0 }) =>
    Array.from({ length: KEYFRAMES + 1 }, (_, i) => {
      if (i === KEYFRAMES) return s0 === 1 && vs0 === 0 ? "translate(0px, 0px)" : "translate(0px, 0px) scale(1)";
      const t = (duration / 1000) * (i / KEYFRAMES);
      const x = spring.state(x0, vx0, t)[0];
      const y = spring.state(y0, vy0, t)[0];
      if (s0 === 1 && vs0 === 0) return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(1 + spring.state(s0 - 1, vs0, t)[0]).toFixed(4)})`;
    });

  const runClock = (firstRects, velocity, { openingCard, closingCard, onSettled }) => {
    const motion = springs();
    const running = { animations: [], tracks: [], timers: [] };
    clock = running;
    const settle = () => {
      if (clock !== running) return;
      running.animations.forEach((animation) => {
        if (animation.playState !== "idle") animation.cancel();
      });
      running.grids?.forEach((grid) => grid.classList.remove("is-reflowing"));
      clock = null;
      onSettled?.();
    };
    if (!motion) {
      settle();
      return;
    }

    const { layout, gentle, confident, playful } = motion;
    const duration = layout.duration;
    // The opened card's actions bud out as one liquid drop and split into their buttons
    // (liquid-drop.mjs); without it they rise in with the rest of the story.
    const liquidActions = Boolean(openingCard && window.SiteLiquid?.splitActions);
    const timing = { duration, easing: "linear" };
    const glide = (element, offsets, extra = {}, delay = 0) => {
      const carried = velocity.get(element) || { vx: 0, vy: 0, vs: 0 };
      const track = {
        element,
        spring: layout,
        x0: offsets.x0 || 0,
        y0: offsets.y0 || 0,
        vx0: carried.vx,
        vy0: carried.vy,
        s0: offsets.s0 || 1,
        vs0: offsets.s0 ? carried.vs : 0,
        delay,
      };
      // Cards gliding past squash a little as they land (site-motion.mjs flightFrames); pictures that
      // scale keep the plain spring.
      const transforms =
        offsets.squash && window.SiteMotion?.flightFrames && track.s0 === 1
          ? window.SiteMotion.flightFrames(layout, {
              x0: track.x0,
              y0: track.y0,
              vx0: track.vx0,
              vy0: track.vy0,
              squash: offsets.squash,
              count: KEYFRAMES,
            })
          : springFrames(layout, duration, track);
      const frames = transforms.map((transform) => ({ transform, ...extra }));
      const animation = element.animate(frames, delay ? { ...timing, delay, fill: "backwards" } : timing);
      running.animations.push(animation);
      running.tracks.push({ ...track, animation });
    };

    // Measure the whole new layout before animating anything: a running animation's transform shows
    // up in every rectangle read beneath it.
    const lastRects = measureCards();
    // A card travelling sideways must not widen the page while it glides (wide grids only; the
    // phones' sideways row scrolls by itself).
    grids.forEach((grid) => grid.classList.add("is-reflowing"));
    running.grids = grids;

    // The change spreads from the card that opened (or closed): neighbours wait for the ripple to
    // reach them, nearer ones first.
    const source = openingCard || closingCard;
    const sourceRect = source ? lastRects.get(source)?.card || firstRects.get(source)?.card : null;
    const rippleFrom = sourceRect ? { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 } : null;
    const rippleDelay = (card) => {
      if (!rippleFrom || card === source || !window.SiteMotion?.rippleDelays) return 0;
      const box = lastRects.get(card)?.card;
      if (!box) return 0;
      return window.SiteMotion.rippleDelays([{ x: box.left + box.width / 2, y: box.top + box.height / 2 }], rippleFrom, {
        speed: 9,
        maxDelay: 110,
      })[0];
    };

    // A deck that moved glides as one block; the cards it holds then only travel by what they moved
    // inside it, since its transform already carries them.
    const blockMoves = new Map();
    decks.forEach((deck) => {
      const first = firstRects.get(deck)?.card;
      const last = lastRects.get(deck)?.card;
      if (!first || !last?.width) return;
      const parent = deck.parentElement?.closest("[data-project-card][data-project-deck]");
      const inherited = parent ? blockMoves.get(parent) || { dx: 0, dy: 0 } : { dx: 0, dy: 0 };
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      blockMoves.set(deck, { dx, dy });
      const ownX = dx - inherited.dx;
      const ownY = dy - inherited.dy;
      if (Math.abs(ownX) > 0.5 || Math.abs(ownY) > 0.5) glide(deck, { x0: ownX, y0: ownY }, {}, rippleDelay(deck));
    });
    const inheritedMove = (card) => {
      const deck = card.parentElement?.closest("[data-project-card][data-project-deck]");
      return deck ? blockMoves.get(deck) || { dx: 0, dy: 0 } : { dx: 0, dy: 0 };
    };

    cards.forEach((card) => {
      const first = firstRects.get(card);
      const last = lastRects.get(card)?.card;
      if (!first?.card || !last?.width || !last.height) return;
      const carriedByDeck = inheritedMove(card);
      const dx = first.card.left - last.left - carriedByDeck.dx;
      const dy = first.card.top - last.top - carriedByDeck.dy;
      const carried = velocity.get(card);
      const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || (carried && Math.hypot(carried.vx, carried.vy) > 1);
      // A card that wraps between rows would fly diagonally across its neighbours. It leaves along
      // its row, fading, and arrives at the other end of its new row instead. (An offset is old minus
      // new, so a wrap is the one move whose horizontal and vertical offsets disagree in sign.)
      const column = last.width;
      const wraps = Math.abs(dy) > 8 && Math.abs(dx) > column * 0.5 && Math.sign(dx) !== Math.sign(dy);
      if (wraps) {
        const exit = Math.sign(dx) * 22;
        const cut = 0.32;
        const frames = [
          { offset: 0, transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`, opacity: 1 },
          { offset: cut, transform: `translate(${(dx + exit).toFixed(2)}px, ${dy.toFixed(2)}px)`, opacity: 0 },
        ];
        const tail = layout.duration * (1 - cut);
        springFrames(layout, tail, { x0: -exit }).forEach((transform, i) => {
          const p = i / KEYFRAMES;
          frames.push({ offset: cut + (1 - cut) * p, transform, opacity: Math.min(1, layout.ease(p) * 1.4) });
        });
        const animation = card.animate(frames, timing);
        running.animations.push(animation);
      } else if (moving) {
        glide(card, { x0: dx, y0: dy, squash: card === openingCard || card === closingCard ? 0 : 0.03 }, {}, rippleDelay(card));
      }
      // The opened card's picture travels to its new place at its own proportions.
      const picture = card.querySelector(".project-card-media img");
      const before = card === openingCard ? first.picture : null;
      const after = before ? lastRects.get(card)?.picture : null;
      if (!wraps && before && after) {
        const scale = before.width / after.width;
        const x = before.left - after.box.left - scale * (after.left - after.box.left) - dx;
        const y = before.top - after.box.top - scale * (after.top - after.box.top) - dy;
        if (Math.abs(x) + Math.abs(y) > 0.5 || Math.abs(scale - 1) > 0.004) glide(picture, { x0: x, y0: y, s0: scale }, { transformOrigin: "0 0" });
      }
    });

    // The opened card grows out of the footprint it had, on the same clock.
    const openingSurface = openingCard?.querySelector(".card");
    const firstSurface = openingCard ? firstRects.get(openingCard)?.surface : null;
    const lastSurface = openingCard ? lastRects.get(openingCard)?.surface : null;
    if (openingSurface && firstSurface && lastSurface?.width && lastSurface.height) {
      const right = Math.max(0, lastSurface.width - firstSurface.width);
      const bottom = Math.max(0, lastSurface.height - firstSurface.height);
      if (right > 0.5 || bottom > 0.5) {
        const frames = Array.from({ length: KEYFRAMES + 1 }, (_, i) => {
          if (i === KEYFRAMES) return { clipPath: "inset(0)" };
          const t = (duration / 1000) * (i / KEYFRAMES);
          const r = Math.max(0, layout.state(right, 0, t)[0]);
          const b = Math.max(0, layout.state(bottom, 0, t)[0]);
          return { clipPath: `inset(0px ${r.toFixed(2)}px ${b.toFixed(2)}px 0px)` };
        });
        running.animations.push(openingSurface.animate(frames, timing));
      }
    }

    // Then its words, in reading order: a short rise and fade, so the card's growth reads first and
    // the story arrives as it settles. Copy that only changed place (a phone's single column) stays.
    const stage = (card, start, step) => {
      const firstBody = firstRects.get(card)?.body;
      const body = lastRects.get(card)?.body;
      const moved = Boolean(firstBody && body && Math.hypot(firstBody.left - body.left, firstBody.top - body.top) > 24);
      let index = 0;
      card.querySelectorAll(CONTENT).forEach((element) => {
        if (element.closest("[hidden]") || !element.getClientRects().length || element.matches(".liquid-drop-layer")) return;
        if (liquidActions && card === openingCard && element.parentElement?.matches(".project-card-actions-expanded")) return;
        const fresh =
          element.closest(".project-card-story, .project-card-takeaways, .project-card-panel") || element.matches(".project-card-takeaways");
        if (!moved && !fresh) return;
        const frames = springFrames(gentle, gentle.duration, { y0: 7 }).map((transform, i) => ({
          transform,
          opacity: i === 0 ? 0 : Math.min(1, gentle.ease(i / KEYFRAMES) * 1.25),
        }));
        running.animations.push(
          element.animate(frames, { duration: gentle.duration, delay: start + step * index, easing: "linear", fill: "backwards" })
        );
        index += 1;
      });
    };
    if (openingCard) {
      stage(openingCard, 70, 45);
      // The plus becomes the close button, in the corner where it was.
      const close = openingCard.querySelector("[data-project-card-close]");
      if (close?.getClientRects().length) {
        const frames = springFrames(confident, confident.duration, {}).map((_, i) => {
          const p = confident.ease(i / KEYFRAMES);
          return { transform: `rotate(${(-90 * (1 - p)).toFixed(2)}deg) scale(${(0.6 + 0.4 * p).toFixed(3)})`, opacity: Math.min(1, p * 1.6) };
        });
        running.animations.push(close.animate(frames, { duration: confident.duration, delay: 40, easing: "linear", fill: "backwards" }));
      }
      if (liquidActions) {
        running.animations.push(
          ...window.SiteLiquid.splitActions(openingCard.querySelector(".project-card-actions-expanded"), {
            travel: layout,
            bounce: playful,
            delay: 110,
          })
        );
      }
    }
    if (closingCard) stage(closingCard, 40, 30);

    if (!running.animations.length) {
      settle();
      return;
    }
    Promise.allSettled(running.animations.map((animation) => animation.finished)).then(settle);
  };

  // At most one scroll per change, and only as far as needed to show the whole card.
  const keepInView = (card) => {
    const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
    const margin = phoneQuery.matches ? 12 : 24;
    const rect = card.getBoundingClientRect();
    const top = navBottom + margin;
    const bottom = window.innerHeight - margin;
    let delta = 0;
    if (rect.top < top) delta = rect.top - top;
    else if (rect.bottom > bottom) delta = Math.min(rect.bottom - bottom, rect.top - top);
    const row = card.closest("[data-site-experiment-grid]");
    const sideways =
      row &&
      phoneQuery.matches &&
      (card.offsetLeft < row.scrollLeft - 1 || card.offsetLeft + card.offsetWidth > row.scrollLeft + row.clientWidth + 1);
    if (Math.abs(delta) < 2 && !sideways) return 0;
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (sideways) {
      card.scrollIntoView({ block: "nearest", inline: "start", behavior });
      return delta;
    }
    window.scrollBy({ top: delta, behavior });
    return delta;
  };

  const setActiveCard = (nextCard, options = {}) => {
    const firstRects = measureCards();
    const previousCard = activeCard;
    const openingCard = nextCard && nextCard !== previousCard ? nextCard : null;
    const closingCard = !nextCard && previousCard ? previousCard : null;
    const openingTrigger = openingCard?.querySelector("[data-project-card-trigger]") || null;
    const shouldFocusPrimaryAction = Boolean(options.focusPrimaryAction && openingTrigger && document.activeElement === openingTrigger);
    const shouldRestoreFocus = Boolean(previousCard && options.restoreFocus && previousCard.contains(document.activeElement));
    const focusReturnTarget = !nextCard && shouldRestoreFocus ? previousCard.querySelector("[data-project-card-trigger]") : null;
    if (openingCard && !anchor) anchor = { y: window.scrollY, settledY: null };

    // Keep each element's current speed, then stop the old run.
    const velocity = carriedVelocity();
    cancelClock();

    focusReturnTarget?.focus({ preventScroll: true });

    activeCard = nextCard;

    cards.forEach((card) => {
      // Only the opened card's own grid quiets; cards in other deck levels (often hidden) are left
      // alone, so no transition starts where nobody can see it finish.
      setCardState(card, card === activeCard, Boolean(activeCard) && card.parentElement === activeCard.parentElement);
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

    // A keyboard visitor lands on the opened card's main link as its story arrives, unless they
    // have already moved on.
    const focusPrimary = () => {
      if (openingCard && activeCard === openingCard && shouldFocusPrimaryAction && document.activeElement === openingTrigger) {
        openingCard.querySelector("[data-project-card-primary-action]")?.focus({ preventScroll: true });
      }
    };
    const restore = anchor;
    runClock(firstRects, velocity, {
      openingCard,
      closingCard,
      onSettled: () => {
        const activeElement = document.activeElement;
        if (
          !activeCard &&
          focusReturnTarget &&
          (activeElement === focusReturnTarget || activeElement === document.body || activeElement === document.documentElement)
        ) {
          focusReturnTarget.focus({ preventScroll: true });
        }
        focusPrimary();
        if (activeCard && activeCard === openingCard && options.scroll) {
          const delta = keepInView(activeCard);
          if (restore) restore.settledY = window.scrollY + delta;
        } else if (!activeCard && closingCard && restore) {
          // Closing gives the reader back the place they opened the card from, if they stayed put;
          // otherwise it only makes sure the card they closed is in view.
          anchor = null;
          if (restore.settledY !== null && Math.abs(window.scrollY - restore.settledY) < 3 && Math.abs(window.scrollY - restore.y) > 2) {
            window.scrollTo({ top: restore.y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
          } else if (restore.settledY !== null) {
            keepInView(closingCard);
          }
        }
      },
    });
    if (clock && openingCard) clock.timers.push(window.setTimeout(focusPrimary, 120));
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

  // project-decks.mjs closes any open preview, without motion, before a deck changes level.
  document.addEventListener("project-cards:reset", () => {
    if (!activeCard && !clock) return;
    cancelClock();
    const previous = activeCard;
    activeCard = null;
    anchor = null;
    cards.forEach((card) => setCardState(card, false, false));
    grids.forEach((grid) => grid.classList.remove("has-expanded-project-card"));
    document.body.classList.remove("project-card-preview-open");
    if (previous) announceCardState(previous, false);
  });

  // A change of column count (a rotated tablet, a resized window) re-places the open card at once.
  let placing = 0;
  window.addEventListener(
    "resize",
    () => {
      if (!activeCard || placing) return;
      placing = window.requestAnimationFrame(() => {
        placing = 0;
        if (activeCard) placeCard(activeCard);
      });
    },
    { passive: true }
  );

  // Phones show the site experiments as one scroll-snapped row (_sass/_design-details.scss). The count
  // follows the card most in view, and the row takes focus so arrow keys can scroll it.
  const experimentRow = document.querySelector("[data-site-experiment-grid]");
  const experimentPosition = document.querySelector("[data-site-experiment-position]");
  if (experimentRow && experimentPosition && "IntersectionObserver" in window) {
    const rowCards = Array.from(experimentRow.querySelectorAll(":scope > [data-project-card]"));
    const ratios = new Map();
    const rowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
        let best = rowCards[0];
        rowCards.forEach((card) => {
          if ((ratios.get(card) || 0) > (ratios.get(best) || 0)) best = card;
        });
        experimentPosition.textContent = String(rowCards.indexOf(best) + 1);
      },
      { root: experimentRow, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const syncRow = () => {
      rowObserver.disconnect();
      ratios.clear();
      if (phoneQuery.matches) {
        experimentRow.tabIndex = 0;
        experimentRow.setAttribute("role", "region");
        rowCards.forEach((card) => rowObserver.observe(card));
      } else {
        experimentRow.removeAttribute("tabindex");
        experimentRow.removeAttribute("role");
        experimentPosition.textContent = "1";
      }
    };
    phoneQuery.addEventListener("change", syncRow);
    syncRow();
  }
})();
