(function () {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = reduceMotionQuery.matches;
  const homeScriptSrc = document.currentScript?.src || new URL("/assets/js/home.js", window.location.origin).href;
  const homeScriptBase = homeScriptSrc.split("?")[0];
  const threeModuleUrl = new URL("three.module.min.js", homeScriptBase).href;
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

  const createRecordSceneController = (container) => {
    const fallback = container?.querySelector(".home-record-scene-fallback");
    const fallbackArt = fallback?.querySelector(".home-record-art");

    if (!container) {
      return {
        setRecord() {},
        setVisible() {},
        setPlaying() {},
        setDrag() {},
        pulse() {},
        dispose() {},
      };
    }

    let THREE = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let recordGroup = null;
    let armGroup = null;
    let labelMaterial = null;
    let accentMaterial = null;
    let textureLoader = null;
    let resizeObserver = null;
    let animationFrame = null;
    let currentRecord = null;
    let isLoaded = false;
    let isLoading = false;
    let isVisible = false;
    let isPlaying = false;
    const textureCache = new Map();

    const render = () => {
      if (!renderer || !scene || !camera) return;
      renderer.render(scene, camera);
    };

    const readAccent = () => getComputedStyle(container).getPropertyValue("--record-accent").trim() || "#b99538";

    const updateAccent = () => {
      if (!THREE || !accentMaterial) return;
      try {
        accentMaterial.color.set(readAccent());
      } catch {
        accentMaterial.color.set("#b99538");
      }
    };

    const resize = () => {
      if (!renderer || !camera) return;
      const rect = container.getBoundingClientRect();
      const size = Math.max(1, Math.round(Math.min(rect.width || 1, rect.height || 1)));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      render();
    };

    const stopLoop = () => {
      if (!animationFrame) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    const tick = (time) => {
      animationFrame = null;
      if (!isVisible || reduceMotion || !recordGroup) {
        render();
        return;
      }

      if (isPlaying) {
        recordGroup.rotation.z = time * 0.00084;
        if (armGroup) armGroup.rotation.z = -0.18 + Math.sin(time * 0.0014) * 0.008;
        render();
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        if (armGroup) armGroup.rotation.z = -0.18;
        render();
      }
    };

    const scheduleRender = () => {
      if (!isLoaded) return;
      stopLoop();
      if (isVisible && isPlaying && !reduceMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        render();
      }
    };

    const applyRecordTexture = (record) => {
      if (!record) return;
      if (fallbackArt) fallbackArt.style.backgroundImage = `url("${record.src}")`;
      if (!isLoaded || !textureLoader || !labelMaterial) return;

      const cachedTexture = textureCache.get(record.src);
      if (cachedTexture) {
        labelMaterial.map = cachedTexture;
        labelMaterial.needsUpdate = true;
        render();
        return;
      }

      textureLoader.load(
        record.src,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
          textureCache.set(record.src, texture);
          if (currentRecord?.src === record.src) {
            labelMaterial.map = texture;
            labelMaterial.needsUpdate = true;
            render();
          }
        },
        undefined,
        () => {
          render();
        }
      );
    };

    const buildScene = () => {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.domElement.className = "home-record-canvas";
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 7.35);
      camera.lookAt(0, 0, 0);

      const ambient = new THREE.AmbientLight(0xffffff, 1.45);
      const key = new THREE.DirectionalLight(0xffffff, 1.75);
      key.position.set(-2.1, 3.2, 5.5);
      const low = new THREE.DirectionalLight(0xffe4c8, 0.56);
      low.position.set(3.4, -2.4, 3.2);
      scene.add(ambient, key, low);

      const platterMaterial = new THREE.MeshStandardMaterial({
        color: 0xd6c5aa,
        metalness: 0.34,
        roughness: 0.5,
      });
      const vinylMaterial = new THREE.MeshStandardMaterial({
        color: 0x101113,
        metalness: 0.08,
        roughness: 0.42,
      });
      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.085,
        depthWrite: false,
      });
      labelMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.46,
        metalness: 0.02,
      });
      accentMaterial = new THREE.MeshStandardMaterial({
        color: 0xb99538,
        metalness: 0.18,
        roughness: 0.38,
      });
      const spindleMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2eee3,
        metalness: 0.7,
        roughness: 0.24,
      });
      const armMaterial = new THREE.MeshStandardMaterial({
        color: 0x6f7070,
        metalness: 0.62,
        roughness: 0.26,
      });

      const baseGroup = new THREE.Group();
      baseGroup.rotation.x = -0.13;
      baseGroup.rotation.y = 0.03;
      scene.add(baseGroup);

      const platter = new THREE.Mesh(new THREE.CircleGeometry(2.64, 160), platterMaterial);
      platter.position.z = -0.08;
      baseGroup.add(platter);

      const recordShadow = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 2.5, 160),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
      );
      recordShadow.position.set(0.08, -0.1, -0.045);
      baseGroup.add(recordShadow);

      recordGroup = new THREE.Group();
      recordGroup.position.z = 0.02;
      baseGroup.add(recordGroup);

      const vinyl = new THREE.Mesh(new THREE.RingGeometry(0.74, 2.42, 176), vinylMaterial);
      recordGroup.add(vinyl);

      for (let index = 0; index < 26; index += 1) {
        const radius = 0.86 + index * 0.058;
        const groove = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.004, 176), grooveMaterial);
        groove.position.z = 0.012 + index * 0.0006;
        recordGroup.add(groove);
      }

      const gloss = new THREE.Mesh(
        new THREE.CircleGeometry(2.26, 96, Math.PI * 0.12, Math.PI * 0.28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })
      );
      gloss.position.set(-0.1, 0.05, 0.032);
      recordGroup.add(gloss);

      const label = new THREE.Mesh(new THREE.CircleGeometry(0.72, 128), labelMaterial);
      label.position.z = 0.052;
      recordGroup.add(label);

      const labelRim = new THREE.Mesh(new THREE.RingGeometry(0.725, 0.76, 128), accentMaterial);
      labelRim.position.z = 0.058;
      recordGroup.add(labelRim);

      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.088, 0.14, 40), spindleMaterial);
      spindle.rotation.x = Math.PI / 2;
      spindle.position.z = 0.14;
      baseGroup.add(spindle);

      armGroup = new THREE.Group();
      armGroup.position.set(2.18, 1.55, 0.28);
      armGroup.rotation.z = -0.18;
      baseGroup.add(armGroup);

      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 48), spindleMaterial);
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(0, 0, 0.03);
      armGroup.add(pivot);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.72, 0.055), armMaterial);
      arm.position.set(-0.64, -0.69, 0.08);
      arm.rotation.z = -0.88;
      armGroup.add(arm);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), accentMaterial);
      head.position.set(-1.24, -1.18, 0.1);
      head.rotation.z = -0.88;
      armGroup.add(head);

      const stylus = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 20), armMaterial);
      stylus.rotation.x = Math.PI;
      stylus.position.set(-1.38, -1.3, 0.02);
      armGroup.add(stylus);

      updateAccent();
      resize();
      applyRecordTexture(currentRecord);
      render();
      container.classList.add("is-three-record");
      if (fallback) fallback.hidden = true;

      resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
      if (resizeObserver) {
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", resize);
      }
    };

    const ensureLoaded = async () => {
      if (isLoaded || isLoading || reduceMotion) return;
      isLoading = true;
      try {
        THREE = await import(threeModuleUrl);
        textureLoader = new THREE.TextureLoader();
        buildScene();
        isLoaded = true;
        applyRecordTexture(currentRecord);
        scheduleRender();
      } catch {
        container.classList.add("is-three-record-failed");
      } finally {
        isLoading = false;
      }
    };

    return {
      setRecord(record) {
        currentRecord = record;
        updateAccent();
        applyRecordTexture(record);
      },
      setVisible(nextVisible) {
        isVisible = nextVisible;
        container.classList.toggle("is-visible", isVisible);
        if (isVisible) ensureLoaded();
        scheduleRender();
      },
      setPlaying(nextPlaying) {
        isPlaying = nextPlaying;
        container.classList.toggle("is-playing", isPlaying);
        scheduleRender();
      },
      setDrag(x, tilt) {
        container.style.setProperty("--record-drag-x", `${x.toFixed(2)}px`);
        container.style.setProperty("--record-drag-tilt", `${tilt.toFixed(2)}deg`);
      },
      pulse() {
        container.classList.add("is-found-pulse");
        window.setTimeout(() => container.classList.remove("is-found-pulse"), 520);
      },
      dispose() {
        stopLoop();
        if (resizeObserver) resizeObserver.disconnect();
        if (!resizeObserver) window.removeEventListener("resize", resize);
        textureCache.forEach((texture) => texture.dispose());
        renderer?.dispose();
      },
    };
  };

  const setupArtifactCoffeeStains = () => {
    const cards = Array.from(document.querySelectorAll(".home-artifact-card")).slice(0, 2);
    if (cards.length === 0) return;

    const random = createSeededRandom(`home-coffee-${Date.now()}-${Math.random()}`);

    cards.forEach((card, index) => {
      const layout = index === 0 ? { size: 6.25, top: -1.42, right: -1.08 } : { size: 5.75, top: 1.7, right: -0.82 };
      const size = layout.size + random() * 0.92;
      const top = layout.top + random() * 0.46;
      const right = layout.right + random() * 0.5;
      const rotate = -22 + random() * 44;
      const scale = 0.96 + random() * 0.16;
      const wobble = -0.42 + random() * 0.84;
      const morphDuration = 22 + random() * 12;
      const bloomDuration = 150 + random() * 90;
      const density = 0.82 + random() * 0.34;

      card.classList.add("has-coffee-stain");
      card.style.setProperty("--coffee-stain-size", `${size.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-top", `${top.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-right", `${right.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-rotate", `${rotate.toFixed(2)}deg`);
      card.style.setProperty("--coffee-stain-scale", scale.toFixed(3));
      card.style.setProperty("--coffee-stain-wobble", `${wobble.toFixed(2)}rem`);
      card.style.setProperty("--coffee-stain-density", density.toFixed(3));
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
    const recordCovers = splitAttribute("data-record-covers", "|");
    const recordSources = splitAttribute("data-record-sources", "|");
    const spinButton = document.querySelector("[data-home-record-play]");
    const previousButton = document.querySelector("[data-home-record-prev]");
    const nextButton = document.querySelector("[data-home-record-next]");
    const recordSceneElement = portrait.querySelector("[data-home-record-scene]");
    const recordFallbackArt = recordSceneElement?.querySelector(".home-record-art");
    const recordScene = createRecordSceneController(recordSceneElement);

    const records = recordImages.map((src, index) => ({
      src,
      cover: recordCovers[index] || src,
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
    records.forEach((record) => {
      const cover = new Image();
      cover.src = record.cover;
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
      portrait.style.setProperty("--record-image", `url("${record.src}")`);
      if (recordFallbackArt) recordFallbackArt.style.backgroundImage = `url("${record.src}")`;
      recordScene.setRecord(record);
      recordScene.setVisible(true);
      window.requestAnimationFrame(() => {
        if (ticket !== imageTicket) return;
        setPreviewing(true);
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
      if (recordFallbackArt) recordFallbackArt.style.removeProperty("background-image");
      recordScene.setVisible(false);
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
      recordScene.setPlaying(isSpinning);
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
      recordScene.setDrag(0, 0);
      updateSpinState();
      hideRecord(true);
    };

    const setCardRestTransform = (card, order) => {
      const recordOrder = Number(card.getAttribute("data-record-index")) || 0;
      const side = order % 2 === 0 ? -1 : 1;
      const x = side * (1.15 + (order % 3) * 0.42);
      const y = 1.14 + order * 0.34;
      const z = order * 0.12;
      const rotate = side * (4.2 + (recordOrder % 3) * 0.8) + order * 0.48;
      const tilt = 66 - Math.min(order, 4) * 1.2;
      card.style.setProperty(
        "--card-rest-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${z.toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg)`
      );
      card.style.setProperty("--card-open-transform", `translate3d(0, -2.05rem, 6.4rem) rotateZ(0deg) rotateX(3deg) scale(1.025)`);
      card.style.zIndex = String(20 + order);

      const tab = pile?.querySelector(`[data-home-record-card-tab][data-record-index="${recordOrder}"]`);
      if (tab) {
        const tabX = x + side * 8.05;
        const tabY = y + 1.35;
        tab.style.setProperty(
          "--card-tab-transform",
          `translate3d(${tabX.toFixed(2)}rem, ${tabY.toFixed(2)}rem, 1.5rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(64deg)`
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

    const pickRecordCardFromPoint = (clientX, clientY) => {
      if (!pile) return null;
      const cards = Array.from(pile.querySelectorAll("[data-home-record-card]")).reverse();
      return (
        cards.find((card) => {
          const rect = card.getBoundingClientRect();
          return clientX >= rect.left - 8 && clientX <= rect.right + 8 && clientY >= rect.top - 8 && clientY <= rect.bottom + 8;
        }) || null
      );
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
        `translate3d(${(dropSide * 1.42).toFixed(2)}rem, -8.2rem, 7.4rem) rotateZ(${(dropSide * -14).toFixed(2)}deg) rotateX(24deg) rotateY(${(dropSide * 10).toFixed(2)}deg)`
      );
      card.style.setProperty(
        "--card-drop-mid",
        `translate3d(${(dropSide * -0.55).toFixed(2)}rem, -2.2rem, 4.1rem) rotateZ(${(dropSide * 7.5).toFixed(2)}deg) rotateX(48deg) rotateY(${(dropSide * -5).toFixed(2)}deg)`
      );
      card.style.setProperty(
        "--card-drop-land",
        `translate3d(${(dropSide * 0.18).toFixed(2)}rem, 1.42rem, 0.42rem) rotateZ(${(dropSide * -1.2).toFixed(2)}deg) rotateX(72deg)`
      );

      const cover = document.createElement("span");
      cover.className = "home-record-card-cover";
      cover.setAttribute("aria-hidden", "true");
      cover.style.backgroundImage = `url("${record.cover}")`;

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
      recordScene.pulse();
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
      recordScene.setDrag(0, 0);
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
      recordScene.setDrag(dragX, dragTilt);

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

    if (pile) {
      pile.addEventListener("click", (event) => {
        if (event.target.closest("a, button, [data-home-record-card], [data-home-record-card-tab]")) return;
        const card = pickRecordCardFromPoint(event.clientX, event.clientY);
        if (!card) return;
        event.stopPropagation();
        openRecordCard(card);
      });
    }

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

    window.addEventListener("pagehide", () => {
      resetRecord();
      recordScene.dispose();
    });
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
