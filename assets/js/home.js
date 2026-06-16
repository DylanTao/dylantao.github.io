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
    const recordCaptions = splitAttribute("data-record-captions", "|");
    const recordDurations = splitAttribute("data-record-durations", "|");
    const recordTones = splitAttribute("data-record-tones", "|");
    const panel = document.querySelector("[data-home-record-panel]");
    const playButton = document.querySelector("[data-home-record-play]");
    const previousButton = document.querySelector("[data-home-record-prev]");
    const nextButton = document.querySelector("[data-home-record-next]");
    const volumeToggle = panel ? panel.querySelector("[data-home-record-volume-toggle]") : null;
    const volumePanel = panel ? panel.querySelector("[data-home-record-volume-panel]") : null;
    const volumeInput = panel ? panel.querySelector("[data-home-record-volume]") : null;
    const volumeControl = volumeInput ? volumeInput.closest(".home-record-volume") : null;
    const seekInput = panel ? panel.querySelector("[data-home-record-seek]") : null;
    const titleTarget = panel ? panel.querySelector("[data-home-record-title]") : null;
    const captionTarget = panel ? panel.querySelector("[data-home-record-caption]") : null;
    const durationTarget = panel ? panel.querySelector("[data-home-record-duration]") : null;
    const elapsedTarget = panel ? panel.querySelector("[data-home-record-elapsed]") : null;
    const progressTarget = panel ? panel.querySelector("[data-home-record-progress]") : null;
    const audioContextClass = window.AudioContext || window.webkitAudioContext;
    const reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const soundEnabled = stage ? stage.getAttribute("data-home-sound-enabled") === "true" : false;
    const volumeStorageKey = "sirui-home-record-volume";
    const legacyMutedStorageKey = "sirui-home-record-muted";
    const defaultRecordVolume = 0.5;
    const records = recordImages.map((src, index) => ({
      src,
      title: recordTitles[index] || "Meme record",
      caption: recordCaptions[index] || "",
      duration: recordDurations[index] || "0:18",
      tone: recordTones[index] || "submarine",
    }));
    const preloadedRecords = records.map((record) => {
      const image = new Image();
      image.src = record.src;
      return image;
    });
    const soundProfiles = {
      submarine: { notes: [261.63, 329.63, 392, 293.66], step: 0.19, duration: 0.105, volume: 0.034, type: "triangle" },
      jude: { notes: [293.66, 349.23, 392, 440], step: 0.21, duration: 0.115, volume: 0.031, type: "sine" },
      wind: { notes: [220, 246.94, 293.66, 329.63], step: 0.24, duration: 0.14, volume: 0.026, type: "triangle" },
      sunday: { notes: [196, 261.63, 311.13, 392], step: 0.16, duration: 0.085, volume: 0.032, type: "square" },
    };

    let recordIndex = 0;
    let imageTicket = 0;
    let audioContext = null;
    let isPreviewing = false;
    let isPlayerActive = false;
    let isPlaying = false;
    let loopTimer = null;
    let noteTimers = [];
    let progressRaf = null;
    let playbackStartedAt = 0;
    let playbackOffsetSeconds = 0;
    let volumeOpen = false;
    const clampVolume = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : defaultRecordVolume));
    const clampSeekRatio = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

    let recordVolume = soundEnabled ? defaultRecordVolume : 0;

    try {
      const storedVolumePreference = window.localStorage ? window.localStorage.getItem(volumeStorageKey) : null;
      const legacyMutedPreference = window.localStorage ? window.localStorage.getItem(legacyMutedStorageKey) : null;
      if (storedVolumePreference !== null) {
        const parsedVolume = Number.parseFloat(storedVolumePreference);
        recordVolume = clampVolume(parsedVolume > 1 ? parsedVolume / 100 : parsedVolume);
      } else if (legacyMutedPreference === "true") {
        recordVolume = 0;
        try {
          window.localStorage.setItem(volumeStorageKey, "0");
        } catch {
          // The migrated preference still applies for this session.
        }
      } else if (reducedMotionQuery && reducedMotionQuery.matches) {
        recordVolume = 0;
      }
    } catch {
      if (reducedMotionQuery && reducedMotionQuery.matches) recordVolume = 0;
    }

    const parseDuration = (value) => {
      const parts = String(value || "")
        .split(":")
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 1) return parts[0];
      return 18;
    };

    const formatTime = (seconds) => {
      const clampedSeconds = Math.max(0, Math.floor(seconds));
      const minutes = Math.floor(clampedSeconds / 60);
      return `${minutes}:${String(clampedSeconds % 60).padStart(2, "0")}`;
    };

    const canAdjustSound = () => soundEnabled && Boolean(audioContextClass);

    const canPlaySound = () => canAdjustSound() && recordVolume > 0;

    const getCurrentRecord = () => records[Math.max(0, recordIndex)] || records[0];

    const getCurrentDurationSeconds = () => Math.max(1, parseDuration(getCurrentRecord().duration));

    const getElapsedPlaybackSeconds = () => {
      const durationSeconds = getCurrentDurationSeconds();
      if (!isPlaying) return Math.min(playbackOffsetSeconds, durationSeconds);
      return (playbackOffsetSeconds + (performance.now() - playbackStartedAt) / 1000) % durationSeconds;
    };

    const updateProgressDisplay = (elapsedSeconds, durationSeconds = getCurrentDurationSeconds()) => {
      const safeDuration = Math.max(1, durationSeconds);
      const safeElapsed = Math.min(Math.max(0, elapsedSeconds), safeDuration);
      const progressRatio = clampSeekRatio(safeElapsed / safeDuration);

      if (elapsedTarget) elapsedTarget.textContent = formatTime(safeElapsed);
      if (progressTarget) progressTarget.style.transform = `scaleX(${progressRatio})`;
      if (seekInput) {
        seekInput.value = String(Math.round(progressRatio * Number.parseInt(seekInput.max || "1000", 10)));
        seekInput.style.setProperty("--home-record-progress", `${Math.round(progressRatio * 1000) / 10}%`);
        seekInput.setAttribute("aria-valuetext", `${formatTime(safeElapsed)} of ${formatTime(safeDuration)}`);
      }
    };

    const syncVolumeInput = () => {
      const canAdjust = canAdjustSound();
      if (!canAdjust) volumeOpen = false;
      if (volumeToggle) {
        volumeToggle.hidden = !canAdjust;
        volumeToggle.setAttribute("aria-expanded", String(volumeOpen && canAdjust));
        volumeToggle.setAttribute("aria-label", `${volumeOpen ? "Hide" : "Show"} meme record volume`);
        const icon = volumeToggle.querySelector("i");
        if (icon) {
          icon.className = `fa-solid ${recordVolume <= 0 ? "fa-volume-xmark" : recordVolume < 0.62 ? "fa-volume-low" : "fa-volume-high"}`;
        }
      }
      if (volumePanel) {
        volumePanel.hidden = !volumeOpen || !canAdjust;
        volumePanel.setAttribute("aria-hidden", String(!volumeOpen || !canAdjust));
      }
      if (!volumeInput) return;
      if (volumeControl) volumeControl.hidden = !canAdjust;
      volumeInput.value = String(Math.round(recordVolume * 100));
      volumeInput.style.setProperty("--home-record-volume", `${Math.round(recordVolume * 100)}%`);
      volumeInput.setAttribute("aria-valuetext", recordVolume <= 0 ? "Silent" : `${Math.round(recordVolume * 100)} percent`);
    };

    const setPlayerActive = (nextActive) => {
      isPlayerActive = nextActive;
      if (panel) {
        panel.classList.toggle("is-active", nextActive);
        panel.setAttribute("data-player-active", String(nextActive));
        panel.setAttribute("aria-hidden", String(!nextActive));
        panel.toggleAttribute("inert", !nextActive);
      }
      if (stage) stage.setAttribute("data-player-active", String(nextActive));
      if (!nextActive) {
        volumeOpen = false;
        syncVolumeInput();
      }
      syncRecordVisualState();
    };

    const setPreviewing = (nextPreviewing) => {
      isPreviewing = nextPreviewing;
      portrait.classList.toggle("is-previewing", isPreviewing);
      syncRecordVisualState();
    };

    const syncRecordVisualState = () => {
      const isPausedRecord = isPlayerActive && !isPlaying;
      portrait.classList.toggle("is-paused-record", isPausedRecord);
      portrait.setAttribute("data-record-visual", isPausedRecord ? "empty" : isPlaying ? "face" : isPreviewing ? "preview" : "portrait");
      if (isPausedRecord) hoverLayer.classList.remove("is-visible");
    };

    const setPanelCopy = (record) => {
      if (titleTarget) titleTarget.textContent = record.title;
      if (captionTarget) captionTarget.textContent = record.caption;
      if (durationTarget) durationTarget.textContent = record.duration;
      if (playButton) {
        playButton.setAttribute("aria-label", `${isPlaying ? "Pause" : "Play"} ${record.title} meme-record preview`);
      }
      if (previousButton) previousButton.setAttribute("aria-label", `Previous meme record from ${record.title}`);
      if (nextButton) nextButton.setAttribute("aria-label", `Next meme record from ${record.title}`);
      if (!isPlaying) {
        updateProgressDisplay(playbackOffsetSeconds, Math.max(1, parseDuration(record.duration)));
      }
    };

    const syncRecordTheme = (tone) => {
      portrait.setAttribute("data-record-tone", tone);
      if (stage) stage.setAttribute("data-record-tone", tone);
      if (panel) panel.setAttribute("data-record-tone", tone);
    };

    const stopProgress = (reset = false) => {
      if (progressRaf) window.cancelAnimationFrame(progressRaf);
      progressRaf = null;
      if (reset) {
        playbackOffsetSeconds = 0;
        updateProgressDisplay(0);
      }
    };

    const tickProgress = () => {
      if (!isPlaying) return;
      const durationSeconds = getCurrentDurationSeconds();
      const elapsedSeconds = getElapsedPlaybackSeconds();
      updateProgressDisplay(elapsedSeconds, durationSeconds);
      progressRaf = window.requestAnimationFrame(tickProgress);
    };

    const selectRecord = (nextIndex) => {
      const normalizedIndex = (nextIndex + records.length) % records.length;
      const recordChanged = normalizedIndex !== recordIndex;
      recordIndex = normalizedIndex;
      if (recordChanged) playbackOffsetSeconds = 0;
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
      if (!force && (isPlayerActive || isPlaying)) return;
      imageTicket += 1;
      setPreviewing(false);
      portrait.classList.remove("is-vinyl-preview");
      hoverLayer.classList.remove("is-visible");
    };

    const ensureAudioContext = async () => {
      if (!audioContextClass) return null;
      if (!audioContext) audioContext = new audioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      return audioContext;
    };

    const clearLoopTimers = () => {
      if (loopTimer) window.clearTimeout(loopTimer);
      noteTimers.forEach((timer) => window.clearTimeout(timer));
      loopTimer = null;
      noteTimers = [];
    };

    const playNote = (context, frequency, duration, volume, type) => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.025);
    };

    const scheduleRecordLoop = async () => {
      if (!isPlaying || !canPlaySound()) return;
      const context = await ensureAudioContext();
      if (!context || !isPlaying || !canPlaySound()) return;

      const record = records[Math.max(0, recordIndex)];
      const profile = soundProfiles[record.tone] || soundProfiles.submarine;
      profile.notes.forEach((frequency, index) => {
        const timer = window.setTimeout(
          () => {
            const gainVolume = profile.volume * recordVolume;
            if (isPlaying && canPlaySound() && gainVolume > 0) playNote(context, frequency, profile.duration, gainVolume, profile.type);
          },
          index * profile.step * 1000
        );
        noteTimers.push(timer);
      });
      loopTimer = window.setTimeout(scheduleRecordLoop, profile.notes.length * profile.step * 1000 + 420);
    };

    const updatePlayState = () => {
      const record = getCurrentRecord();
      portrait.classList.toggle("is-playing", isPlaying);
      if (playButton) {
        playButton.classList.toggle("is-playing", isPlaying);
        playButton.setAttribute("aria-pressed", String(isPlaying));
        playButton.setAttribute("aria-label", isPlaying ? `Pause ${record.title} meme-record preview` : `Play ${record.title} meme-record preview`);
      }
      syncRecordVisualState();
    };

    const startRecord = async () => {
      isPlaying = true;
      setPlayerActive(true);
      playbackStartedAt = performance.now();
      updatePlayState();
      await showRecord(recordIndex < 0 ? 0 : recordIndex);
      clearLoopTimers();
      stopProgress();
      tickProgress();
      scheduleRecordLoop();
    };

    const pauseRecord = () => {
      const pausedOffsetSeconds = getElapsedPlaybackSeconds();
      isPlaying = false;
      playbackOffsetSeconds = pausedOffsetSeconds;
      updatePlayState();
      clearLoopTimers();
      stopProgress(false);
      updateProgressDisplay(playbackOffsetSeconds);
      showEmptyRecord();
    };

    const resetRecordPlayer = () => {
      isPlaying = false;
      playbackOffsetSeconds = 0;
      playbackStartedAt = 0;
      volumeOpen = false;
      updatePlayState();
      clearLoopTimers();
      stopProgress(true);
      setPlayerActive(false);
      hideRecord(true);
    };

    const advanceRecord = async (direction = 1) => {
      const nextIndex = recordIndex + direction;
      if (isPlaying) {
        clearLoopTimers();
        await showRecord(nextIndex);
        playbackStartedAt = performance.now();
        stopProgress(true);
        tickProgress();
        scheduleRecordLoop();
      } else if (isPlayerActive) {
        selectRecord(nextIndex);
        stopProgress(true);
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

    setPanelCopy(records[0]);
    syncRecordTheme(records[0].tone);
    syncVolumeInput();
    setPlayerActive(false);

    portrait.addEventListener("mouseenter", () => {
      if (!isPlayerActive && !isPlaying) showRecord(recordIndex);
    });
    portrait.addEventListener("mouseleave", hideRecord);
    portrait.addEventListener("focusin", () => {
      if (!isPlayerActive && !isPlaying) showRecord(recordIndex);
    });
    portrait.addEventListener("focusout", (event) => {
      if (!portrait.contains(event.relatedTarget)) hideRecord();
    });

    if (playButton) {
      playButton.addEventListener("click", () => {
        if (isPlaying) {
          pauseRecord();
        } else {
          startRecord();
        }
      });
    }

    if (seekInput) {
      seekInput.addEventListener("input", (event) => {
        event.stopPropagation();
        const seekMax = Number.parseInt(seekInput.max || "1000", 10);
        const seekRatio = clampSeekRatio(Number.parseInt(seekInput.value || "0", 10) / Math.max(1, seekMax));
        const durationSeconds = getCurrentDurationSeconds();
        playbackOffsetSeconds = seekRatio * durationSeconds;
        if (isPlaying) playbackStartedAt = performance.now();
        updateProgressDisplay(playbackOffsetSeconds, durationSeconds);
        clearLoopTimers();
        if (isPlaying && canPlaySound()) scheduleRecordLoop();
      });
    }

    if (volumeToggle) {
      volumeToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        volumeOpen = !volumeOpen;
        syncVolumeInput();
        if (volumeOpen && volumeInput) volumeInput.focus({ preventScroll: true });
      });
    }

    if (volumeInput) {
      volumeInput.addEventListener("input", (event) => {
        event.stopPropagation();
        recordVolume = clampVolume(Number.parseInt(volumeInput.value, 10) / 100);
        syncVolumeInput();
        try {
          window.localStorage.setItem(volumeStorageKey, String(recordVolume));
        } catch {
          // Volume still works for this session if storage is unavailable.
        }
        clearLoopTimers();
        if (isPlaying && canPlaySound()) scheduleRecordLoop();
      });
    }

    document.addEventListener("click", (event) => {
      const clickedInsidePortrait = portrait.contains(event.target);
      const clickedInsidePanel = Boolean(panel && panel.contains(event.target));
      if (volumeOpen && !clickedInsidePanel) {
        volumeOpen = false;
        syncVolumeInput();
      }
      if (isPlayerActive && !clickedInsidePortrait && !clickedInsidePanel) {
        resetRecordPlayer();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !volumeOpen) return;
      volumeOpen = false;
      syncVolumeInput();
      if (volumeToggle) volumeToggle.focus({ preventScroll: true });
    });

    bindRecordNav(previousButton, -1);
    bindRecordNav(nextButton, 1);

    window.addEventListener("pagehide", resetRecordPlayer);
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
