(function () {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = reduceMotionQuery.matches;
  const revealItems = Array.from(document.querySelectorAll(".home-reveal"));

  const isAlreadyReadable = (item) => {
    const rect = item.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
  };

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("home-visible"));
  } else {
    revealItems.forEach((item) => {
      if (isAlreadyReadable(item)) item.classList.add("home-visible");
    });

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

  root.classList.add("home-motion-ready");

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
    let railUpdateRaf = null;

    const pickReadableSection = () => {
      const navbar = document.getElementById("navbar");
      const headerOffset = navbar ? navbar.getBoundingClientRect().bottom : 0;
      const readingLine = headerOffset + (window.innerHeight - headerOffset) * 0.38;

      return sectionItems
        .map((section) => {
          const rect = section.getBoundingClientRect();
          const visibleTop = Math.max(rect.top, headerOffset);
          const visibleBottom = Math.min(rect.bottom, window.innerHeight);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const anchor = Math.min(Math.max(readingLine, rect.top), rect.bottom);
          return {
            id: section.getAttribute("data-home-section"),
            distance: Math.abs(anchor - readingLine),
            visibleHeight,
          };
        })
        .filter((section) => section.visibleHeight > 0)
        .sort((a, b) => a.distance - b.distance || b.visibleHeight - a.visibleHeight)[0];
    };

    const syncRailLink = () => {
      const visibleSection = pickReadableSection();

      if (!visibleSection) return;
      setActiveRailLink(visibleSection.id);
    };

    const scheduleRailSync = () => {
      if (railUpdateRaf) return;
      railUpdateRaf = window.requestAnimationFrame(() => {
        railUpdateRaf = null;
        syncRailLink();
      });
    };

    const railObserver = new IntersectionObserver(scheduleRailSync, { rootMargin: "-28% 0px -52% 0px", threshold: [0.08, 0.25, 0.5, 0.75] });

    sectionItems.forEach((section) => railObserver.observe(section));
    railLinks.forEach((link) => {
      link.addEventListener("click", () => setActiveRailLink(link.getAttribute("data-home-rail-link")));
    });
    window.addEventListener("scroll", scheduleRailSync, { passive: true });
    window.addEventListener("resize", scheduleRailSync);
    scheduleRailSync();
  }

  const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const createSeededRandom = (seed) => {
    let state = hashString(seed) || 1;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  const setupArtifactCoffeeStains = () => {
    const cards = Array.from(document.querySelectorAll(".home-artifact-card")).slice(0, 2);
    if (cards.length === 0) return;

    const random = createSeededRandom(`home-coffee-${Date.now()}-${Math.random()}`);

    cards.forEach((card, index) => {
      const size = 4.08 + random() * 0.78 + index * 0.12;
      const top = -0.58 + random() * 0.85;
      const right = index === 0 ? -0.05 + random() * 1.05 : 0.75 + random() * 1.15;
      const rotate = -18 + random() * 36;
      const scale = 0.9 + random() * 0.18;
      const wobble = -0.34 + random() * 0.68;
      const morphDuration = 16 + random() * 10;
      const bloomDuration = 120 + random() * 70;

      card.classList.add("has-coffee-stain");
      card.style.setProperty("--coffee-stain-size", `${size.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-top", `${top.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-right", `${right.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-rotate", `${rotate.toFixed(2)}deg`);
      card.style.setProperty("--coffee-stain-scale", scale.toFixed(3));
      card.style.setProperty("--coffee-stain-wobble", `${wobble.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-morph-duration", `${morphDuration.toFixed(2)}s`);
      card.style.setProperty("--coffee-stain-bloom-duration", `${bloomDuration.toFixed(2)}s`);
    });
  };

  setupArtifactCoffeeStains();

  const portrait = document.getElementById("home-profile-image-container");
  if (!portrait) return;

  const hoverLayer = portrait.querySelector(".home-profile-image-hover-layer");

  const splitAttribute = (name, separator) => (portrait.getAttribute(name) || "").split(separator).filter(Boolean);

  const setupRecordPortrait = () => {
    const recordImages = splitAttribute("data-record-images", "|");
    if (!hoverLayer || recordImages.length === 0) return false;

    const stage = document.querySelector("[data-home-artifact-stage]");
    const pile = document.querySelector("[data-home-record-pile]");
    const recordTitles = splitAttribute("data-record-titles", "|");
    const recordArtists = splitAttribute("data-record-artists", "|");
    const recordDurations = splitAttribute("data-record-durations", "|");
    const recordTones = splitAttribute("data-record-tones", "|");
    const recordSources = splitAttribute("data-record-sources", "|");
    const spinButton = document.querySelector("[data-home-record-play]");
    const previousButton = document.querySelector("[data-home-record-prev]");
    const nextButton = document.querySelector("[data-home-record-next]");
    const recordSurface = portrait.querySelector(".home-record-vinyl");
    const recordArt = portrait.querySelector(".home-record-art");

    const records = recordImages.map((src, index) => ({
      src,
      title: recordTitles[index] || "Meme record",
      artist: recordArtists[index] || "",
      duration: recordDurations[index] || "",
      tone: recordTones[index] || "submarine",
      source: recordSources[index] || "",
    }));
    const preloadedRecords = records.map((record) => {
      const image = new Image();
      image.src = record.src;
      return image;
    });

    const droppedRecords = new Set();
    let activeCard = null;
    let recordIndex = 0;
    let imageTicket = 0;
    let isPreviewing = false;
    let isRecordEngaged = false;
    let isSpinning = false;
    let activePointerId = null;
    let activePointerStartedOnPlayButton = false;
    let gestureStartX = 0;
    let gestureStartY = 0;
    let lastShakeX = 0;
    let lastShakeDirection = 0;
    let shakeCount = 0;
    let suppressNextSpinClick = false;

    const getCurrentRecord = () => records[Math.max(0, recordIndex)] || records[0];

    const syncPileState = () => {
      if (!pile) return;
      const cardCount = pile.querySelectorAll("[data-home-record-card]").length;
      pile.hidden = cardCount === 0;
      pile.classList.toggle("has-cards", cardCount > 0);
      pile.setAttribute("data-card-count", String(cardCount));
      if (stage) stage.setAttribute("data-record-card-count", String(cardCount));
    };

    const syncRecordVisualState = () => {
      const isPausedRecord = isRecordEngaged && !isSpinning;
      const isActive = isRecordEngaged || isSpinning || isPreviewing;
      portrait.classList.toggle("is-paused-record", isPausedRecord);
      portrait.classList.toggle("is-playing", isSpinning);
      portrait.setAttribute("data-record-visual", isPausedRecord ? "paused" : isSpinning ? "spinning" : isPreviewing ? "preview" : "portrait");
      if (stage) stage.setAttribute("data-record-active", String(isActive));
    };

    const setPreviewing = (nextPreviewing) => {
      isPreviewing = nextPreviewing;
      portrait.classList.toggle("is-previewing", isPreviewing);
      syncRecordVisualState();
    };

    const syncRecordControls = (record) => {
      if (spinButton) {
        spinButton.setAttribute("aria-label", isSpinning ? `Pause ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
      if (previousButton) previousButton.setAttribute("aria-label", `Previous meme record from ${record.title}`);
      if (nextButton) nextButton.setAttribute("aria-label", `Next meme record from ${record.title}`);
    };

    const syncRecordTheme = (tone) => {
      portrait.setAttribute("data-record-tone", tone);
      if (stage) stage.setAttribute("data-record-tone", tone);
      if (pile) pile.setAttribute("data-record-tone", tone);
    };

    const selectRecord = (nextIndex) => {
      const normalizedIndex = (nextIndex + records.length) % records.length;
      recordIndex = normalizedIndex;
      const record = records[recordIndex];
      syncRecordControls(record);
      syncRecordTheme(record.tone);
      return { image: preloadedRecords[recordIndex], record };
    };

    const showRecord = async (nextIndex) => {
      const ticket = ++imageTicket;
      const { image, record } = selectRecord(nextIndex);
      hoverLayer.style.backgroundImage = `url("${record.src}")`;
      portrait.style.setProperty("--record-image", `url("${record.src}")`);
      if (recordSurface) recordSurface.style.setProperty("--record-image", `url("${record.src}")`);
      if (recordArt) recordArt.style.backgroundImage = `url("${record.src}")`;
      window.requestAnimationFrame(() => {
        if (ticket !== imageTicket) return;
        setPreviewing(true);
        hoverLayer.classList.add("is-visible");
        portrait.classList.add("is-vinyl-preview");
      });

      try {
        if (image.decode) await image.decode();
      } catch {
        // If decode fails, the browser can still attempt to paint the image.
      }

      if (ticket !== imageTicket) return;
    };

    const hideRecord = (force = false) => {
      if (!force && (isRecordEngaged || isSpinning)) return;
      imageTicket += 1;
      setPreviewing(false);
      portrait.classList.remove("is-vinyl-preview");
      portrait.style.removeProperty("--record-image");
      if (recordSurface) recordSurface.style.removeProperty("--record-image");
      if (recordArt) recordArt.style.removeProperty("background-image");
      hoverLayer.classList.remove("is-visible");
    };

    const updateSpinState = () => {
      const record = getCurrentRecord();
      portrait.classList.toggle("is-playing", isSpinning);
      if (spinButton) {
        spinButton.classList.toggle("is-playing", isSpinning);
        spinButton.setAttribute("aria-pressed", String(isSpinning));
        spinButton.setAttribute("aria-label", isSpinning ? `Pause ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
      syncRecordVisualState();
    };

    const startRecord = async () => {
      isRecordEngaged = true;
      isSpinning = true;
      updateSpinState();
      await showRecord(recordIndex);
    };

    const pauseRecord = () => {
      isRecordEngaged = true;
      isSpinning = false;
      updateSpinState();
      showRecord(recordIndex);
    };

    const resetRecord = () => {
      isRecordEngaged = false;
      isSpinning = false;
      shakeCount = 0;
      portrait.classList.remove("is-dragging-record", "is-record-card-found");
      portrait.removeAttribute("data-record-shakes");
      portrait.style.removeProperty("--record-drag-x");
      portrait.style.removeProperty("--record-drag-tilt");
      updateSpinState();
      hideRecord(true);
    };

    const setCardRestTransform = (card, order) => {
      const recordOrder = Number(card.getAttribute("data-record-index")) || 0;
      const side = order % 2 === 0 ? -1 : 1;
      const x = side * (1.35 + (order % 3) * 0.36);
      const y = 0.14 + order * 0.48;
      const z = order * 0.2;
      const rotate = side * (3.4 + (recordOrder % 3) * 0.72) + order * 0.42;
      const tilt = 2.5 - Math.min(order, 4) * 0.34;
      card.style.setProperty(
        "--card-rest-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${z.toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg)`
      );
      card.style.setProperty("--card-open-transform", `translate3d(0, -1.28rem, 5.8rem) rotateZ(0deg) rotateX(0deg) scale(1.025)`);
      card.style.zIndex = String(20 + order);

      const tab = pile?.querySelector(`[data-home-record-card-tab][data-record-index="${recordOrder}"]`);
      if (tab) {
        const tabX = x + side * 8.05;
        const tabY = y + 1.05;
        tab.style.setProperty(
          "--card-tab-transform",
          `translate3d(${tabX.toFixed(2)}rem, ${tabY.toFixed(2)}rem, 5.2rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(0deg)`
        );
        tab.style.zIndex = String(58 + order);
      }
    };

    const reflowRecordCards = () => {
      if (!pile) return;
      Array.from(pile.querySelectorAll("[data-home-record-card]")).forEach((card, order) => setCardRestTransform(card, order));
      syncPileState();
    };

    const closeActiveCard = ({ sendToTop = true } = {}) => {
      if (!activeCard) return;
      const card = activeCard;
      card.classList.remove("is-open");
      card.setAttribute("aria-expanded", "false");
      activeCard = null;
      if (pile && sendToTop) {
        pile.appendChild(card);
        reflowRecordCards();
      }
      if (pile) pile.classList.remove("is-reading-card");
    };

    const openRecordCard = (card) => {
      if (activeCard && activeCard !== card) closeActiveCard({ sendToTop: false });
      activeCard = card;
      card.classList.add("is-open");
      card.setAttribute("aria-expanded", "true");
      card.style.zIndex = "80";
      if (pile) pile.classList.add("is-reading-card");
    };

    const createRecordCard = (record, index) => {
      const card = document.createElement("article");
      const dropSide = index % 2 === 0 ? -1 : 1;
      card.className = "home-record-card is-dropping";
      card.tabIndex = 0;
      card.dataset.homeRecordCard = String(index);
      card.setAttribute("data-record-index", String(index));
      card.setAttribute("aria-expanded", "false");
      card.setAttribute("aria-label", `Pick up ${record.title} by ${record.artist}`);
      card.style.setProperty(
        "--card-drop-start",
        `translate3d(${(dropSide * 1.35).toFixed(2)}rem, -6.7rem, 3.6rem) rotateZ(${(dropSide * -12).toFixed(2)}deg) rotateX(18deg)`
      );
      card.style.setProperty(
        "--card-drop-mid",
        `translate3d(${(dropSide * -0.62).toFixed(2)}rem, -1.4rem, 2.2rem) rotateZ(${(dropSide * 6.5).toFixed(2)}deg) rotateX(-4deg)`
      );

      const cover = document.createElement("span");
      cover.className = "home-record-card-cover";
      cover.setAttribute("aria-hidden", "true");
      cover.style.backgroundImage = `url("${record.src}")`;

      const body = document.createElement("span");
      body.className = "home-record-card-body";

      const title = document.createElement("strong");
      title.textContent = record.title;

      const artist = document.createElement("em");
      artist.textContent = record.artist;

      body.append(title, artist);

      if (record.source) {
        const source = document.createElement("a");
        source.className = "home-record-card-link";
        source.href = record.source;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Listen on Spotify";
        source.addEventListener("click", (event) => event.stopPropagation());
        body.append(source);
      }

      card.append(cover, body);
      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        event.stopPropagation();
        openRecordCard(card);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openRecordCard(card);
      });

      const tab = document.createElement("button");
      tab.className = "home-record-card-tab";
      tab.type = "button";
      tab.dataset.homeRecordCardTab = String(index);
      tab.setAttribute("data-record-index", String(index));
      tab.setAttribute("aria-label", `Pick up ${record.title}`);
      tab.addEventListener("click", (event) => {
        event.stopPropagation();
        openRecordCard(card);
      });

      return { card, tab };
    };

    const pulseAlreadyFound = () => {
      portrait.classList.add("is-record-card-found");
      window.setTimeout(() => portrait.classList.remove("is-record-card-found"), 520);
    };

    const dropRecordCard = async () => {
      const record = getCurrentRecord();
      isRecordEngaged = true;
      await showRecord(recordIndex);

      if (!pile || droppedRecords.has(recordIndex)) {
        pulseAlreadyFound();
        return;
      }

      droppedRecords.add(recordIndex);
      const { card, tab } = createRecordCard(record, recordIndex);
      pile.hidden = false;
      pile.appendChild(card);
      pile.appendChild(tab);
      reflowRecordCards();

      if (reduceMotion) {
        card.classList.remove("is-dropping");
      } else {
        card.addEventListener("animationend", () => card.classList.remove("is-dropping"), { once: true });
      }
    };

    const advanceRecord = async (direction = 1) => {
      const nextIndex = recordIndex + direction;
      await showRecord(nextIndex);
    };

    const bindRecordNav = (button, direction) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        advanceRecord(direction);
      });
    };

    const toggleRecordPlayback = () => {
      if (isSpinning) {
        pauseRecord();
      } else {
        startRecord();
      }
    };

    const endShakeGesture = () => {
      if (activePointerId === null) return;
      activePointerId = null;
      activePointerStartedOnPlayButton = false;
      lastShakeDirection = 0;
      portrait.classList.remove("is-dragging-record");
      portrait.removeAttribute("data-record-shakes");
      portrait.style.removeProperty("--record-drag-x");
      portrait.style.removeProperty("--record-drag-tilt");
    };

    const startShakeGesture = (event) => {
      if (!window.PointerEvent || (event.pointerType === "mouse" && event.button !== 0)) return;
      const startedOnPlayButton = event.target.closest("[data-home-record-play]");
      if (event.target.closest("a") || (event.target.closest("button") && !startedOnPlayButton)) return;

      activePointerId = event.pointerId;
      activePointerStartedOnPlayButton = Boolean(startedOnPlayButton);
      gestureStartX = event.clientX;
      gestureStartY = event.clientY;
      lastShakeX = event.clientX;
      lastShakeDirection = 0;
      shakeCount = 0;
      showRecord(recordIndex);
      portrait.classList.add("is-dragging-record");
      if (!activePointerStartedOnPlayButton && portrait.setPointerCapture) portrait.setPointerCapture(activePointerId);
    };

    const updateShakeGesture = (event) => {
      if (activePointerId !== event.pointerId) return;

      const totalX = event.clientX - gestureStartX;
      const totalY = event.clientY - gestureStartY;
      if (Math.abs(totalX) < 10 && Math.abs(totalY) < 10) return;
      if (Math.abs(totalY) > Math.abs(totalX) * 1.35) return;
      suppressNextSpinClick = true;

      const dragX = Math.max(-18, Math.min(18, totalX * 0.16));
      const dragTilt = Math.max(-10, Math.min(10, totalX * 0.14));
      portrait.style.setProperty("--record-drag-x", `${dragX.toFixed(2)}px`);
      portrait.style.setProperty("--record-drag-tilt", `${dragTilt.toFixed(2)}deg`);

      const segmentX = event.clientX - lastShakeX;
      if (Math.abs(segmentX) >= 20) {
        const direction = Math.sign(segmentX);
        if (lastShakeDirection && direction !== lastShakeDirection) {
          shakeCount += 1;
          portrait.setAttribute("data-record-shakes", String(Math.min(shakeCount, 3)));
          if (shakeCount >= 3) {
            dropRecordCard();
            endShakeGesture();
            event.preventDefault();
            return;
          }
        }
        lastShakeDirection = direction;
        lastShakeX = event.clientX;
      }

      event.preventDefault();
    };

    selectRecord(0);
    syncRecordVisualState();
    syncPileState();

    portrait.addEventListener("mouseenter", () => {
      if (!isRecordEngaged && !isSpinning) showRecord(recordIndex);
    });
    portrait.addEventListener("mouseleave", () => hideRecord());
    portrait.addEventListener("focusin", () => {
      if (!isRecordEngaged && !isSpinning) showRecord(recordIndex);
    });
    portrait.addEventListener("focusout", (event) => {
      if (!portrait.contains(event.relatedTarget) && !pile?.contains(event.relatedTarget)) hideRecord();
    });
    portrait.addEventListener("pointerdown", startShakeGesture);
    portrait.addEventListener("pointermove", updateShakeGesture);
    portrait.addEventListener("pointerup", endShakeGesture);
    portrait.addEventListener("pointercancel", endShakeGesture);
    portrait.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      if (suppressNextSpinClick) {
        event.preventDefault();
        suppressNextSpinClick = false;
        return;
      }
      if (isSpinning) return;
      startRecord();
    });

    if (spinButton) {
      spinButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (suppressNextSpinClick) {
          event.preventDefault();
          suppressNextSpinClick = false;
          return;
        }
        toggleRecordPlayback();
      });
    }

    document.addEventListener("click", (event) => {
      const clickedInsidePortrait = portrait.contains(event.target);
      const clickedInsidePile = Boolean(pile && pile.contains(event.target));

      if (activeCard && !clickedInsidePile) closeActiveCard();
      if (!isSpinning && isRecordEngaged && !clickedInsidePortrait && !clickedInsidePile) resetRecord();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (activeCard) {
        closeActiveCard();
      } else if (!isSpinning && isRecordEngaged) {
        resetRecord();
        if (spinButton) spinButton.focus({ preventScroll: true });
      }
    });

    bindRecordNav(previousButton, -1);
    bindRecordNav(nextButton, 1);

    window.addEventListener("pagehide", resetRecord);
    return true;
  };

  const setupClassicPortraitHover = () => {
    const images = splitAttribute("data-images", ",");
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
  };

  if (!setupRecordPortrait()) setupClassicPortraitHover();
})();
