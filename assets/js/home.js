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

  const portrait = document.getElementById("home-profile-image-container");
  if (!portrait) return;

  const hoverLayer = portrait.querySelector(".home-profile-image-hover-layer");

  const splitAttribute = (name, separator) => (portrait.getAttribute(name) || "").split(separator).filter(Boolean);

  const setupRecordPortrait = () => {
    const recordImages = splitAttribute("data-record-images", "|");
    if (!hoverLayer || recordImages.length === 0) return false;

    const stage = document.querySelector("[data-home-artifact-stage]");
    const recordTitles = splitAttribute("data-record-titles", "|");
    const recordArtists = splitAttribute("data-record-artists", "|");
    const recordCaptions = splitAttribute("data-record-captions", "|");
    const recordDurations = splitAttribute("data-record-durations", "|");
    const recordTones = splitAttribute("data-record-tones", "|");
    const recordSources = splitAttribute("data-record-sources", "|");
    const panel = document.querySelector("[data-home-record-panel]");
    const spinButton = document.querySelector("[data-home-record-play]");
    const previousButton = document.querySelector("[data-home-record-prev]");
    const nextButton = document.querySelector("[data-home-record-next]");
    const linerToggle = panel ? panel.querySelector("[data-home-record-liner-toggle]") : null;
    const linerNote = panel ? panel.querySelector("[data-home-record-liner-note]") : null;
    const titleTarget = panel ? panel.querySelector("[data-home-record-title]") : null;
    const artistTarget = panel ? panel.querySelector("[data-home-record-artist]") : null;
    const captionTarget = panel ? panel.querySelector("[data-home-record-caption]") : null;
    const durationTarget = panel ? panel.querySelector("[data-home-record-duration]") : null;
    const sourceTarget = panel ? panel.querySelector("[data-home-record-source]") : null;

    const records = recordImages.map((src, index) => ({
      src,
      title: recordTitles[index] || "Meme record",
      artist: recordArtists[index] || "",
      caption: recordCaptions[index] || "",
      duration: recordDurations[index] || "",
      tone: recordTones[index] || "submarine",
      source: recordSources[index] || "",
    }));
    const preloadedRecords = records.map((record) => {
      const image = new Image();
      image.src = record.src;
      return image;
    });

    let recordIndex = 0;
    let imageTicket = 0;
    let isPreviewing = false;
    let isRecordEngaged = false;
    let isSpinning = false;
    let isLinerOpen = false;

    const getCurrentRecord = () => records[Math.max(0, recordIndex)] || records[0];

    const syncPanelState = () => {
      const isActive = isRecordEngaged || isLinerOpen;
      if (panel) {
        panel.classList.toggle("is-active", isActive);
        panel.classList.toggle("is-note-open", isLinerOpen);
        panel.setAttribute("data-record-active", String(isActive));
        panel.setAttribute("data-liner-open", String(isLinerOpen));
      }
      if (linerToggle) {
        linerToggle.setAttribute("aria-expanded", String(isLinerOpen));
        linerToggle.setAttribute("aria-label", `${isLinerOpen ? "Close" : "Open"} hidden liner notes`);
      }
      if (linerNote) {
        linerNote.hidden = !isLinerOpen;
        linerNote.setAttribute("aria-hidden", String(!isLinerOpen));
      }
      if (stage) stage.setAttribute("data-record-active", String(isActive));
    };

    const syncRecordVisualState = () => {
      const isPausedRecord = isRecordEngaged && !isSpinning;
      portrait.classList.toggle("is-paused-record", isPausedRecord);
      portrait.classList.toggle("is-playing", isSpinning);
      portrait.setAttribute("data-record-visual", isPausedRecord ? "empty" : isSpinning ? "face" : isPreviewing ? "preview" : "portrait");
      if (isPausedRecord) hoverLayer.classList.remove("is-visible");
      syncPanelState();
    };

    const setPreviewing = (nextPreviewing) => {
      isPreviewing = nextPreviewing;
      portrait.classList.toggle("is-previewing", isPreviewing);
      syncRecordVisualState();
    };

    const setLinerOpen = (nextOpen) => {
      isLinerOpen = nextOpen;
      syncPanelState();
    };

    const setPanelCopy = (record) => {
      if (titleTarget) titleTarget.textContent = record.title;
      if (artistTarget) artistTarget.textContent = record.artist;
      if (captionTarget) captionTarget.textContent = record.caption;
      if (durationTarget) durationTarget.textContent = record.duration;
      if (sourceTarget) {
        sourceTarget.hidden = !record.source;
        sourceTarget.href = record.source || "#";
      }
      if (spinButton) {
        spinButton.setAttribute("aria-label", isSpinning ? `Set down ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
      if (previousButton) previousButton.setAttribute("aria-label", `Previous meme record from ${record.title}`);
      if (nextButton) nextButton.setAttribute("aria-label", `Next meme record from ${record.title}`);
    };

    const syncRecordTheme = (tone) => {
      portrait.setAttribute("data-record-tone", tone);
      if (stage) stage.setAttribute("data-record-tone", tone);
      if (panel) panel.setAttribute("data-record-tone", tone);
    };

    const selectRecord = (nextIndex) => {
      const normalizedIndex = (nextIndex + records.length) % records.length;
      recordIndex = normalizedIndex;
      const record = records[recordIndex];
      setPanelCopy(record);
      syncRecordTheme(record.tone);
      return { image: preloadedRecords[recordIndex], record };
    };

    const showRecord = async (nextIndex) => {
      const ticket = ++imageTicket;
      const { image, record } = selectRecord(nextIndex);

      try {
        if (image.decode) await image.decode();
      } catch {
        // If decode fails, the browser can still attempt to paint the image.
      }

      if (ticket !== imageTicket) return;
      hoverLayer.style.backgroundImage = `url("${record.src}")`;
      window.requestAnimationFrame(() => {
        setPreviewing(true);
        hoverLayer.classList.add("is-visible");
        portrait.classList.add("is-vinyl-preview");
      });
    };

    const showEmptyRecord = () => {
      imageTicket += 1;
      setPreviewing(false);
      portrait.classList.add("is-vinyl-preview");
      hoverLayer.classList.remove("is-visible");
      syncRecordVisualState();
    };

    const hideRecord = (force = false) => {
      if (!force && (isRecordEngaged || isSpinning || isLinerOpen)) return;
      imageTicket += 1;
      setPreviewing(false);
      portrait.classList.remove("is-vinyl-preview");
      hoverLayer.classList.remove("is-visible");
    };

    const updateSpinState = () => {
      const record = getCurrentRecord();
      portrait.classList.toggle("is-playing", isSpinning);
      if (spinButton) {
        spinButton.classList.toggle("is-playing", isSpinning);
        spinButton.setAttribute("aria-pressed", String(isSpinning));
        spinButton.setAttribute("aria-label", isSpinning ? `Set down ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
      syncRecordVisualState();
    };

    const startRecord = async () => {
      isRecordEngaged = true;
      isSpinning = true;
      updateSpinState();
      await showRecord(recordIndex < 0 ? 0 : recordIndex);
    };

    const pauseRecord = () => {
      isRecordEngaged = true;
      isSpinning = false;
      updateSpinState();
      showEmptyRecord();
    };

    const resetRecord = () => {
      isRecordEngaged = false;
      isSpinning = false;
      isLinerOpen = false;
      updateSpinState();
      setLinerOpen(false);
      hideRecord(true);
    };

    const advanceRecord = async (direction = 1) => {
      const nextIndex = recordIndex + direction;
      if (isRecordEngaged && !isSpinning) {
        selectRecord(nextIndex);
        showEmptyRecord();
      } else {
        await showRecord(nextIndex);
      }
    };

    const bindRecordNav = (button, direction) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        advanceRecord(direction);
      });
    };

    selectRecord(0);
    syncPanelState();
    syncRecordVisualState();

    portrait.addEventListener("mouseenter", () => {
      if (!isRecordEngaged && !isSpinning) showRecord(recordIndex);
    });
    portrait.addEventListener("mouseleave", hideRecord);
    portrait.addEventListener("focusin", () => {
      if (!isRecordEngaged && !isSpinning) showRecord(recordIndex);
    });
    portrait.addEventListener("focusout", (event) => {
      if (!portrait.contains(event.relatedTarget) && !panel?.contains(event.relatedTarget)) hideRecord();
    });

    if (spinButton) {
      spinButton.addEventListener("click", () => {
        if (isSpinning) {
          pauseRecord();
        } else {
          startRecord();
        }
      });
    }

    if (linerToggle) {
      linerToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const nextOpen = !isLinerOpen;
        setLinerOpen(nextOpen);
        if (nextOpen && !isRecordEngaged && !isSpinning) showRecord(recordIndex);
      });
    }

    document.addEventListener("click", (event) => {
      const clickedInsidePortrait = portrait.contains(event.target);
      const clickedInsidePanel = Boolean(panel && panel.contains(event.target));
      if ((isRecordEngaged || isLinerOpen) && !clickedInsidePortrait && !clickedInsidePanel) {
        resetRecord();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isLinerOpen) return;
      setLinerOpen(false);
      if (linerToggle) linerToggle.focus({ preventScroll: true });
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
