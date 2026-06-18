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
  const storyRail = document.querySelector(".home-story-rail");
  const homeTitle = document.querySelector(".home-title");

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

  if (storyRail && homeTitle) {
    let railPlacementRaf = null;

    const syncRailPlacement = () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        storyRail.style.removeProperty("--home-rail-anchor");
        storyRail.removeAttribute("data-rail-compact");
        return;
      }

      const titleRect = homeTitle.getBoundingClientRect();
      const collapsedWidth = storyRail.getBoundingClientRect().width || 38;
      const expandedWidth = Math.min(Math.max(window.innerWidth * 0.07, 89), 116);
      const hasExpansionGutter = titleRect.left >= expandedWidth + 72;
      const gap = hasExpansionGutter ? 56 : 10;
      const anchor = Math.max(8 + collapsedWidth, titleRect.left - gap);
      storyRail.style.setProperty("--home-rail-anchor", `${anchor.toFixed(1)}px`);
      storyRail.toggleAttribute("data-rail-compact", !hasExpansionGutter);
    };

    const scheduleRailPlacement = () => {
      if (railPlacementRaf) return;
      railPlacementRaf = window.requestAnimationFrame(() => {
        railPlacementRaf = null;
        syncRailPlacement();
      });
    };

    window.addEventListener("resize", scheduleRailPlacement);
    window.addEventListener("orientationchange", scheduleRailPlacement);
    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleRailPlacement).catch(() => {});
    }
    scheduleRailPlacement();
  }

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
    const armState = { rotation: 0.68, lift: 0.5 };
    const armTarget = { rotation: 0.68, lift: 0.5 };
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

    const updateArmTarget = (playing) => {
      armTarget.rotation = playing ? -0.12 : 0.74;
      armTarget.lift = playing ? 0.27 : 0.56;
    };

    const armNeedsFrame = () => {
      if (!armGroup) return false;
      return Math.abs(armState.rotation - armTarget.rotation) > 0.002 || Math.abs(armState.lift - armTarget.lift) > 0.002;
    };

    const applyArmPose = (time = 0, immediate = false) => {
      if (!armGroup) return false;
      const speed = immediate || reduceMotion ? 1 : 0.11;
      armState.rotation += (armTarget.rotation - armState.rotation) * speed;
      armState.lift += (armTarget.lift - armState.lift) * speed;

      if (immediate || reduceMotion) {
        armState.rotation = armTarget.rotation;
        armState.lift = armTarget.lift;
      }

      const playingDrift = isPlaying && !reduceMotion ? Math.sin(time * 0.0014) * 0.006 : 0;
      armGroup.rotation.z = armState.rotation + playingDrift;
      armGroup.position.z = armState.lift;
      return armNeedsFrame();
    };

    const tick = (time) => {
      animationFrame = null;
      if (!isVisible || reduceMotion || !recordGroup) {
        applyArmPose(time, true);
        render();
        return;
      }

      if (isPlaying) {
        recordGroup.rotation.z = time * 0.00084;
      }

      const keepAnimatingArm = applyArmPose(time);
      render();

      if (isPlaying || keepAnimatingArm) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const scheduleRender = () => {
      if (!isLoaded) return;
      stopLoop();
      if (isVisible && !reduceMotion && (isPlaying || armNeedsFrame())) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        applyArmPose(0, true);
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
        color: 0xd4c3a8,
        metalness: 0.32,
        roughness: 0.54,
      });
      const vinylMaterial = new THREE.MeshStandardMaterial({
        color: 0x111214,
        metalness: 0.05,
        roughness: 0.56,
      });
      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.052,
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
        transparent: true,
        opacity: 0.72,
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

      const vinyl = new THREE.Mesh(new THREE.RingGeometry(0.82, 2.42, 192), vinylMaterial);
      recordGroup.add(vinyl);

      for (let index = 0; index < 38; index += 1) {
        const radius = 0.92 + index * 0.038;
        const groove = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.0032, 192), grooveMaterial);
        groove.position.z = 0.012 + index * 0.0006;
        recordGroup.add(groove);
      }

      const label = new THREE.Mesh(new THREE.CircleGeometry(0.94, 128), labelMaterial);
      label.position.z = 0.052;
      recordGroup.add(label);

      const labelRim = new THREE.Mesh(new THREE.RingGeometry(0.945, 0.99, 128), accentMaterial);
      labelRim.position.z = 0.058;
      recordGroup.add(labelRim);

      const spindleWasher = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0065, 10, 44), spindleMaterial);
      spindleWasher.position.z = 0.124;
      baseGroup.add(spindleWasher);

      armGroup = new THREE.Group();
      armGroup.position.set(2.18, 1.55, armState.lift);
      armGroup.rotation.z = armState.rotation;
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
      updateArmTarget(isPlaying);
      applyArmPose(0, true);
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
        updateArmTarget(isPlaying);
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

  const createDeskCornerSceneController = (container, records, artifacts) => {
    if (!container || records.length === 0) {
      return {
        preload() {},
        setVisible() {},
        setActiveRecord() {},
        setSpinning() {},
        setCallbacks() {},
        resetView() {},
        dispose() {},
      };
    }

    let THREE = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let textureLoader = null;
    let resizeObserver = null;
    let animationFrame = null;
    let rootGroup = null;
    let raycaster = null;
    let pointerNdc = null;
    let recordGroup = null;
    let recordLabelMaterial = null;
    let toneArmGroup = null;
    let windowMaterial = null;
    let windowJumpGroup = null;
    let outsideGroup = null;
    let returnInsideGroup = null;
    let mugMarkMaterial = null;
    let ambientLight = null;
    let keyLight = null;
    let sideLight = null;
    let themeObserver = null;
    let activeRecordIndex = 0;
    let isLoaded = false;
    let isLoading = false;
    let isVisible = false;
    let isRecordSpinning = false;
    let pointerId = null;
    let pointerMode = "";
    let pointerStartX = 0;
    let pointerStartY = 0;
    let rotationStartX = -0.05;
    let rotationStartY = -0.28;
    let rotationX = -0.05;
    let rotationY = -0.28;
    let targetRotationX = -0.05;
    let targetRotationY = -0.28;
    let zoomLevel = 0;
    let targetZoomLevel = 0;
    let isCompactScene = false;
    let activeView = "desk";
    let activeEntry = null;
    let focusedEntry = null;
    let hoveredEntry = null;
    let pointerMoved = false;
    const callbacks = {};
    const textureCache = new Map();
    const themeMaterials = {};
    const interactiveObjects = [];
    const albumEntries = [];
    const artifactEntries = [];
    const songCardEntries = [];
    const tweens = [];
    const cleanupListeners = [];

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
    const lerp = (from, to, progress) => from + (to - from) * progress;
    const defaultRotation = { x: -0.05, y: -0.28 };

    const readDeskPalette = () => {
      const isDarkTheme = root.getAttribute("data-theme") === "dark";
      const mode = root.getAttribute("data-theme-mode") || (isDarkTheme ? "evening" : "morning");
      return isDarkTheme
        ? {
            mode,
            isDarkTheme,
            floor: 0x101819,
            wall: 0x111b1d,
            wood: 0x8f6947,
            woodEdge: 0x6f4b2f,
            coffee: 0x58351f,
            ceramic: 0xf5eadb,
            recordBase: 0xc6b89e,
            metal: 0x7d817e,
            cardEdge: 0x213133,
            shadow: 0x030708,
            shadowOpacity: 0.13,
            stain: 0xb47a47,
            stainOpacity: 0.18,
            ambientColor: 0xded4c6,
            ambientIntensity: 1.24,
            keyIntensity: 1.82,
            sideColor: 0xb79270,
            sideIntensity: 0.52,
          }
        : {
            mode,
            isDarkTheme,
            floor: 0xf6eee6,
            wall: 0xfffaf2,
            wood: 0xad7b50,
            woodEdge: 0x8b5a35,
            coffee: 0x5f3921,
            ceramic: 0xfffbf2,
            recordBase: 0xd4c7ab,
            metal: 0x787c7a,
            cardEdge: 0xd0bda8,
            shadow: 0x6d4630,
            shadowOpacity: 0.055,
            stain: 0x8e552c,
            stainOpacity: 0.16,
            ambientColor: 0xfffbf1,
            ambientIntensity: 1.14,
            keyIntensity: 1.96,
            sideColor: 0xffd6aa,
            sideIntensity: 0.64,
          };
    };

    const render = () => {
      if (!renderer || !scene || !camera) return;
      renderer.render(scene, camera);
    };

    const stopLoop = () => {
      if (!animationFrame) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    const scheduleFrame = () => {
      if (!isLoaded || animationFrame) return;
      animationFrame = window.requestAnimationFrame(tick);
    };

    const needsRotationFrame = () => Math.abs(rotationX - targetRotationX) > 0.002 || Math.abs(rotationY - targetRotationY) > 0.002;
    const needsZoomFrame = () => Math.abs(zoomLevel - targetZoomLevel) > 0.002;

    const applyRootRotation = (immediate = false) => {
      const activeGroup = activeView === "outside" ? outsideGroup : rootGroup;
      if (!activeGroup) return;
      const speed = immediate || reduceMotion ? 1 : 0.13;
      rotationX += (targetRotationX - rotationX) * speed;
      rotationY += (targetRotationY - rotationY) * speed;
      if (immediate || reduceMotion) {
        rotationX = targetRotationX;
        rotationY = targetRotationY;
      }
      activeGroup.rotation.x = rotationX;
      activeGroup.rotation.y = rotationY;
    };

    const updateWindowJumpVisibility = () => {
      if (!windowJumpGroup) return;
      const shouldShow = activeView === "desk" && zoomLevel > 0.68;
      if (windowJumpGroup.visible !== shouldShow) {
        windowJumpGroup.visible = shouldShow;
        render();
      }
    };

    const applyCameraPose = (immediate = false) => {
      if (!camera) return false;
      const speed = immediate || reduceMotion ? 1 : 0.18;
      zoomLevel += (targetZoomLevel - zoomLevel) * speed;
      if (immediate || reduceMotion) zoomLevel = targetZoomLevel;

      if (activeView === "outside") {
        camera.fov = isCompactScene ? 38 : 34;
        camera.position.set(isCompactScene ? 2.86 : 3.38, isCompactScene ? 1.46 : 1.72, isCompactScene ? 5.15 : 5.42);
        camera.lookAt(isCompactScene ? 0.1 : 0.24, -0.14, 0.04);
      } else {
        const zoom = easeOutCubic(zoomLevel);
        if (focusedEntry?.kind === "album") {
          camera.fov = lerp(isCompactScene ? 35 : 31, isCompactScene ? 30 : 27, zoom);
          camera.position.set(
            lerp(isCompactScene ? 3.05 : 3.7, isCompactScene ? 2.46 : 2.82, zoom),
            lerp(isCompactScene ? 2.1 : 2.2, isCompactScene ? 1.66 : 1.74, zoom),
            lerp(isCompactScene ? 6.45 : 6.7, isCompactScene ? 4.36 : 4.72, zoom)
          );
          camera.lookAt(isCompactScene ? -0.9 : -1.08, -0.12, -0.22);
        } else if (focusedEntry?.kind === "artifact") {
          camera.fov = lerp(isCompactScene ? 35 : 31, isCompactScene ? 29 : 26, zoom);
          camera.position.set(
            lerp(isCompactScene ? 3.05 : 3.7, isCompactScene ? 1.92 : 2.24, zoom),
            lerp(isCompactScene ? 2.15 : 2.22, isCompactScene ? 1.48 : 1.6, zoom),
            lerp(isCompactScene ? 6.55 : 6.85, isCompactScene ? 3.24 : 3.62, zoom)
          );
          camera.lookAt(isCompactScene ? -0.04 : 0.04, 0.28, 0.28);
        } else {
          camera.fov = lerp(isCompactScene ? 33 : 29, isCompactScene ? 28 : 25, zoom);
          camera.position.set(
            lerp(isCompactScene ? 2.72 : 3.18, isCompactScene ? 1.24 : 1.48, zoom),
            lerp(isCompactScene ? 1.96 : 2.0, isCompactScene ? 1.42 : 1.58, zoom),
            lerp(isCompactScene ? 5.86 : 5.98, isCompactScene ? 3.45 : 3.62, zoom)
          );
          camera.lookAt(lerp(isCompactScene ? -0.1 : -0.02, 1.08, zoom), lerp(-0.38, 0.52, zoom), lerp(0.04, -1.1, zoom));
        }
      }
      camera.updateProjectionMatrix();
      updateWindowJumpVisibility();
      return needsZoomFrame();
    };

    const makeCanvasTexture = (draw, width = 768, height = 480) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      draw(context, width, height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
      texture.needsUpdate = true;
      return texture;
    };

    const drawRoundedRect = (context, x, y, width, height, radius) => {
      if (context.roundRect) {
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
        return;
      }
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + width - radius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + radius);
      context.lineTo(x + width, y + height - radius);
      context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      context.lineTo(x + radius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
    };

    const drawWrappedText = (context, text, x, y, maxWidth, lineHeight, maxLines = 3) => {
      const words = String(text || "")
        .split(/\s+/)
        .filter(Boolean);
      let line = "";
      let lines = 0;
      words.forEach((word, wordIndex) => {
        if (lines >= maxLines) return;
        const next = `${line}${line ? " " : ""}${word}`;
        if (context.measureText(next).width > maxWidth && line) {
          context.fillText(line, x, y + lines * lineHeight);
          line = word;
          lines += 1;
        } else {
          line = next;
        }
        if (wordIndex === words.length - 1 && lines < maxLines) {
          context.fillText(line, x, y + lines * lineHeight);
        }
      });
    };

    const createWindowTexture = (palette) =>
      makeCanvasTexture((context, width, height) => {
        const isEvening = palette.mode === "evening" || palette.isDarkTheme;
        const isAfternoon = palette.mode === "afternoon";
        const sky = context.createLinearGradient(0, 0, 0, height * 0.68);
        sky.addColorStop(0, isEvening ? "#10212f" : isAfternoon ? "#f0b173" : "#92c8e4");
        sky.addColorStop(0.62, isEvening ? "#26384b" : isAfternoon ? "#ffd49f" : "#d8eef7");
        sky.addColorStop(1, isEvening ? "#3d5360" : "#f6efe0");
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);

        if (isEvening) {
          context.fillStyle = "rgba(255,255,232,0.86)";
          [70, 142, 228, 408, 520, 650].forEach((x, index) => {
            context.beginPath();
            context.arc(x, 42 + (index % 3) * 34, index % 2 ? 1.7 : 2.4, 0, Math.PI * 2);
            context.fill();
          });
        } else {
          context.fillStyle = isAfternoon ? "rgba(255,245,213,0.74)" : "rgba(255,255,255,0.7)";
          context.beginPath();
          context.ellipse(width * 0.72, height * 0.18, 48, 26, -0.12, 0, Math.PI * 2);
          context.fill();
        }

        const ocean = context.createLinearGradient(0, height * 0.48, 0, height);
        ocean.addColorStop(0, isEvening ? "#244859" : "#2e8db1");
        ocean.addColorStop(0.72, isEvening ? "#132b38" : "#58b5cf");
        context.fillStyle = ocean;
        context.fillRect(0, height * 0.48, width, height * 0.52);
        context.strokeStyle = isEvening ? "rgba(206,224,228,0.22)" : "rgba(255,255,255,0.48)";
        context.lineWidth = 3;
        for (let i = 0; i < 5; i += 1) {
          context.beginPath();
          context.moveTo(22 + i * 104, height * (0.62 + i * 0.028));
          context.bezierCurveTo(
            82 + i * 95,
            height * (0.59 + i * 0.02),
            142 + i * 84,
            height * (0.68 + i * 0.01),
            224 + i * 76,
            height * (0.63 + i * 0.018)
          );
          context.stroke();
        }

        context.fillStyle = isEvening ? "#1b2a25" : "#8c795d";
        context.beginPath();
        context.moveTo(0, height);
        context.lineTo(width * 0.38, height);
        context.quadraticCurveTo(width * 0.28, height * 0.73, width * 0.1, height * 0.66);
        context.lineTo(0, height * 0.7);
        context.closePath();
        context.fill();
        context.fillStyle = isEvening ? "#c5ad84" : "#efd7aa";
        context.fillRect(0, height * 0.84, width * 0.47, height * 0.16);

        context.strokeStyle = isEvening ? "rgba(247,230,190,0.6)" : "rgba(43,75,90,0.58)";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(width * 0.72, height * 0.28);
        context.quadraticCurveTo(width * 0.79, height * 0.2, width * 0.86, height * 0.28);
        context.stroke();
        context.fillStyle = context.strokeStyle;
        context.beginPath();
        context.arc(width * 0.78, height * 0.39, 4, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = isEvening ? "rgba(247,230,190,0.52)" : "rgba(27,57,67,0.56)";
        context.beginPath();
        context.moveTo(width * 0.54, height * 0.7);
        context.quadraticCurveTo(width * 0.58, height * 0.67, width * 0.63, height * 0.7);
        context.stroke();
      });

    const createMugMarkTexture = (palette) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          context.fillStyle = palette.isDarkTheme ? "rgba(25,38,42,0.84)" : "rgba(54,61,62,0.72)";
          context.font = "700 58px Inter, system-ui, sans-serif";
          context.fillText("Autodesk", 38, 136);
          context.strokeStyle = palette.isDarkTheme ? "rgba(25,38,42,0.42)" : "rgba(54,61,62,0.34)";
          context.lineWidth = 8;
          context.beginPath();
          context.moveTo(40, 166);
          context.lineTo(266, 166);
          context.stroke();
        },
        420,
        220
      );

    const createDeskButtonTexture = (palette, label) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          const glow = context.createRadialGradient(width * 0.5, height * 0.48, 10, width * 0.5, height * 0.48, width * 0.46);
          glow.addColorStop(0, palette.isDarkTheme ? "rgba(255,221,175,0.68)" : "rgba(255,183,102,0.68)");
          glow.addColorStop(0.58, palette.isDarkTheme ? "rgba(255,203,146,0.22)" : "rgba(173,123,80,0.18)");
          glow.addColorStop(1, "rgba(255,255,255,0)");
          context.fillStyle = glow;
          context.fillRect(0, 0, width, height);
          context.beginPath();
          context.arc(width * 0.5, height * 0.5, width * 0.26, 0, Math.PI * 2);
          context.fillStyle = palette.isDarkTheme ? "rgba(24,34,36,0.72)" : "rgba(255,250,241,0.76)";
          context.fill();
          context.lineWidth = 7;
          context.strokeStyle = palette.isDarkTheme ? "rgba(255,221,175,0.42)" : "rgba(122,83,45,0.32)";
          context.stroke();
          context.fillStyle = palette.isDarkTheme ? "rgba(255,229,191,0.88)" : "rgba(104,70,42,0.86)";
          context.font = "800 70px Inter, system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, width * 0.5, height * 0.51);
        },
        256,
        256
      );

    const createOutsideBackdropTexture = (palette) =>
      makeCanvasTexture((context, width, height) => {
        const isEvening = palette.mode === "evening" || palette.isDarkTheme;
        const isAfternoon = palette.mode === "afternoon";
        const sky = context.createLinearGradient(0, 0, 0, height * 0.62);
        sky.addColorStop(0, isEvening ? "#0f1d2c" : isAfternoon ? "#f1a96c" : "#8bc6e6");
        sky.addColorStop(0.54, isEvening ? "#23364d" : isAfternoon ? "#ffd09a" : "#d8f0fb");
        sky.addColorStop(1, isEvening ? "#455762" : "#f6efe2");
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);

        if (isEvening) {
          context.fillStyle = "rgba(255,246,210,0.82)";
          [58, 142, 230, 302, 386, 494, 570, 690].forEach((x, index) => {
            context.beginPath();
            context.arc(x, 38 + ((index * 31) % 106), index % 3 === 0 ? 2.5 : 1.5, 0, Math.PI * 2);
            context.fill();
          });
        } else {
          context.fillStyle = isAfternoon ? "rgba(255,243,209,0.76)" : "rgba(255,255,255,0.82)";
          context.beginPath();
          context.ellipse(width * 0.78, height * 0.16, 52, 30, -0.18, 0, Math.PI * 2);
          context.fill();
        }

        const ocean = context.createLinearGradient(0, height * 0.46, 0, height);
        ocean.addColorStop(0, isEvening ? "#21465a" : "#257fa9");
        ocean.addColorStop(0.64, isEvening ? "#153140" : "#52b5d3");
        ocean.addColorStop(1, isEvening ? "#0f2733" : "#8fd2e2");
        context.fillStyle = ocean;
        context.fillRect(0, height * 0.46, width, height * 0.54);

        context.strokeStyle = isEvening ? "rgba(216,234,238,0.24)" : "rgba(255,255,255,0.58)";
        context.lineWidth = 4;
        for (let index = 0; index < 7; index += 1) {
          const y = height * (0.58 + index * 0.055);
          context.beginPath();
          context.moveTo(-20 + index * 42, y);
          context.bezierCurveTo(width * 0.16, y - 26, width * 0.3, y + 28, width * 0.46, y - 2);
          context.bezierCurveTo(width * 0.62, y - 24, width * 0.76, y + 18, width + 20, y - 8);
          context.stroke();
        }

        context.fillStyle = isEvening ? "#2b332b" : "#8d7b5c";
        context.beginPath();
        context.moveTo(width * 0.58, height);
        context.lineTo(width, height);
        context.lineTo(width, height * 0.48);
        context.quadraticCurveTo(width * 0.82, height * 0.56, width * 0.72, height * 0.76);
        context.quadraticCurveTo(width * 0.64, height * 0.9, width * 0.58, height);
        context.fill();

        context.fillStyle = isEvening ? "#c8ae82" : "#edd5a7";
        context.beginPath();
        context.moveTo(0, height);
        context.lineTo(width * 0.72, height);
        context.quadraticCurveTo(width * 0.46, height * 0.88, width * 0.2, height * 0.86);
        context.quadraticCurveTo(width * 0.08, height * 0.86, 0, height * 0.9);
        context.closePath();
        context.fill();

        context.strokeStyle = isEvening ? "rgba(247,230,190,0.62)" : "rgba(31,68,80,0.56)";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(width * 0.2, height * 0.28);
        context.quadraticCurveTo(width * 0.27, height * 0.18, width * 0.34, height * 0.28);
        context.stroke();
        context.beginPath();
        context.moveTo(width * 0.15, height * 0.68);
        context.quadraticCurveTo(width * 0.2, height * 0.64, width * 0.26, height * 0.68);
        context.stroke();

        const fade = context.createRadialGradient(width * 0.58, height * 0.55, width * 0.18, width * 0.58, height * 0.55, width * 0.55);
        fade.addColorStop(0, "rgba(0,0,0,1)");
        fade.addColorStop(0.58, "rgba(0,0,0,0.98)");
        fade.addColorStop(0.86, "rgba(0,0,0,0.24)");
        fade.addColorStop(1, "rgba(0,0,0,0)");
        context.globalCompositeOperation = "destination-in";
        context.fillStyle = fade;
        context.fillRect(0, 0, width, height);
        context.globalCompositeOperation = "source-over";
      });

    const createCatBlanketTexture = (palette) =>
      makeCanvasTexture(
        (context, width, height) => {
          const base = context.createLinearGradient(0, 0, width, height);
          base.addColorStop(0, palette.isDarkTheme ? "#45636a" : "#b9dde1");
          base.addColorStop(1, palette.isDarkTheme ? "#6b5848" : "#f0d3b7");
          context.fillStyle = base;
          context.fillRect(0, 0, width, height);
          for (let row = 0; row < 4; row += 1) {
            for (let col = 0; col < 6; col += 1) {
              const x = 50 + col * 92 + (row % 2) * 34;
              const y = 44 + row * 62;
              context.fillStyle = row % 2 ? "rgba(255,248,229,0.8)" : "rgba(43,53,56,0.72)";
              context.beginPath();
              context.moveTo(x - 20, y - 4);
              context.lineTo(x - 8, y - 24);
              context.lineTo(x + 2, y - 7);
              context.lineTo(x + 16, y - 24);
              context.lineTo(x + 22, y - 2);
              context.arc(x, y, 22, 0.08, Math.PI * 1.92);
              context.fill();
              context.fillStyle = row % 2 ? "rgba(43,53,56,0.58)" : "rgba(255,248,229,0.78)";
              context.beginPath();
              context.arc(x - 8, y - 1, 2.2, 0, Math.PI * 2);
              context.arc(x + 8, y - 1, 2.2, 0, Math.PI * 2);
              context.fill();
              context.strokeStyle = context.fillStyle;
              context.lineWidth = 2;
              context.beginPath();
              context.moveTo(x - 4, y + 8);
              context.quadraticCurveTo(x, y + 12, x + 4, y + 8);
              context.stroke();
            }
          }
        },
        640,
        320
      );

    const createLaptopScreenTexture = (palette) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.fillStyle = palette.isDarkTheme ? "#111b20" : "#17222a";
          context.fillRect(0, 0, width, height);
          context.fillStyle = "#212d35";
          context.fillRect(0, 0, width, 42);
          context.fillStyle = "#77d2a8";
          context.font = "700 28px ui-monospace, SFMono-Regular, Consolas, monospace";
          context.fillText("VS Code", 24, 29);
          context.fillStyle = "#9ed5ff";
          context.fillText("Codex", width - 122, 29);
          context.fillStyle = "#ffd38b";
          context.fillRect(24, 72, 92, 10);
          context.fillStyle = "#d6e6ef";
          [104, 144, 184, 224].forEach((y, index) => {
            context.fillRect(24, y, 320 - index * 42, 8);
          });
          context.fillStyle = "rgba(119,210,168,0.62)";
          context.fillRect(24, 270, 180, 12);
        },
        480,
        320
      );

    const createArtifactTexture = (artifact, index, palette) =>
      makeCanvasTexture((context, width, height) => {
        const accent = index === 0 ? "#6f9d87" : "#6f98ad";
        context.clearRect(0, 0, width, height);
        drawRoundedRect(context, 20, 24, width - 40, height - 48, 34);
        context.fillStyle = palette.isDarkTheme ? "#f8faf6" : index === 0 ? "#fffdf8" : "#fbfdff";
        context.fill();
        context.lineWidth = 7;
        context.strokeStyle = index === 0 ? "rgba(111,157,135,0.34)" : "rgba(111,152,173,0.34)";
        context.stroke();
        context.fillStyle = accent;
        context.globalAlpha = 0.14;
        context.beginPath();
        context.arc(width - 116, 106, 78, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = "#66727a";
        context.font = "700 34px ui-monospace, SFMono-Regular, Consolas, monospace";
        context.fillText((artifact.label || "Desk card").toUpperCase(), 62, 126);
        context.fillStyle = "#202528";
        context.font = "800 52px Inter, system-ui, sans-serif";
        drawWrappedText(context, artifact.title || "Research card", 62, 210, width - 138, 62, 3);
      });

    const createSongCardTexture = (record) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          drawRoundedRect(context, 18, 18, width - 36, height - 36, 22);
          context.fillStyle = "#fffaf1";
          context.fill();
          context.strokeStyle = "rgba(138,92,49,0.28)";
          context.lineWidth = 5;
          context.stroke();
          context.fillStyle = "#8d6847";
          context.font = "700 28px ui-monospace, SFMono-Regular, Consolas, monospace";
          context.fillText("MEME VINYL", 44, 74);
          context.fillStyle = "#202528";
          context.font = "800 44px Inter, system-ui, sans-serif";
          drawWrappedText(context, record.title, 44, 138, width - 86, 48, 2);
          context.fillStyle = "#6c7375";
          context.font = "600 30px Inter, system-ui, sans-serif";
          context.fillText(record.artist || "Sirui Tao", 44, height - 52);
        },
        520,
        320
      );

    const loadTexture = (src, material, options = {}) => {
      if (!src || !textureLoader || !material) return;
      const cachedTexture = textureCache.get(src);
      if (cachedTexture) {
        material.map = cachedTexture;
        material.needsUpdate = true;
        render();
        return;
      }

      textureLoader.load(
        src,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
          if (options.repeat) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(options.repeat.x, options.repeat.y);
          }
          textureCache.set(src, texture);
          material.map = texture;
          material.needsUpdate = true;
          render();
        },
        undefined,
        () => render()
      );
    };

    const addBox = (group, size, position, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
      mesh.position.set(position.x, position.y, position.z);
      group.add(mesh);
      return mesh;
    };

    const addTween = (object, to, duration = 520) => {
      tweens.push({
        object,
        start: performance.now(),
        duration: reduceMotion ? 1 : duration,
        fromPosition: object.position.clone(),
        fromRotation: object.rotation.clone(),
        fromScale: object.scale.clone(),
        toPosition: to.position ? to.position.clone() : object.position.clone(),
        toRotation: to.rotation ? to.rotation.clone() : object.rotation.clone(),
        toScale: to.scale ? to.scale.clone() : object.scale.clone(),
      });
      scheduleFrame();
    };

    const updateTweens = (time) => {
      if (!tweens.length) return false;
      for (let index = tweens.length - 1; index >= 0; index -= 1) {
        const tween = tweens[index];
        const raw = clamp((time - tween.start) / tween.duration, 0, 1);
        const progress = easeOutCubic(raw);
        tween.object.position.set(
          lerp(tween.fromPosition.x, tween.toPosition.x, progress),
          lerp(tween.fromPosition.y, tween.toPosition.y, progress),
          lerp(tween.fromPosition.z, tween.toPosition.z, progress)
        );
        tween.object.rotation.set(
          lerp(tween.fromRotation.x, tween.toRotation.x, progress),
          lerp(tween.fromRotation.y, tween.toRotation.y, progress),
          lerp(tween.fromRotation.z, tween.toRotation.z, progress)
        );
        tween.object.scale.set(
          lerp(tween.fromScale.x, tween.toScale.x, progress),
          lerp(tween.fromScale.y, tween.toScale.y, progress),
          lerp(tween.fromScale.z, tween.toScale.z, progress)
        );
        if (raw >= 1) tweens.splice(index, 1);
      }
      return tweens.length > 0;
    };

    const registerInteractive = (mesh, data, entry) => {
      mesh.userData = {
        ...mesh.userData,
        kind: data.kind,
        index: data.index,
        url: data.url || "",
        homeDeskInteractive: true,
        homeDeskEntry: entry,
      };
      interactiveObjects.push(mesh);
      return mesh;
    };

    const findInteractiveData = (object) => {
      let current = object;
      while (current) {
        if (current.userData?.homeDeskInteractive) return current.userData;
        current = current.parent;
      }
      return null;
    };

    const pickObject = (event) => {
      if (!raycaster || !pointerNdc || !camera || !renderer) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObjects(interactiveObjects, true)[0];
      return hit ? findInteractiveData(hit.object) : null;
    };

    const setEntryCue = (entry, active) => {
      if (!entry?.cue) return;
      entry.cue.visible = active;
      if (entry.cue.material) {
        entry.cue.material.opacity = active ? (entry.kind === "artifact" ? 0.13 : 0.22) : 0;
      }
    };

    const setHoverEntry = (entry) => {
      if (hoveredEntry === entry) return;
      if (hoveredEntry && !hoveredEntry.isDragging && hoveredEntry !== focusedEntry) {
        hoveredEntry.group.position.y = hoveredEntry.currentRestY ?? hoveredEntry.basePosition.y;
        setEntryCue(hoveredEntry, false);
      }
      hoveredEntry = entry;
      if (renderer?.domElement) {
        const isButton = entry?.kind === "turntable" || entry?.kind === "windowJump" || entry?.kind === "returnInside";
        renderer.domElement.style.cursor = entry ? (isButton ? "pointer" : "grab") : "grab";
      }
      if (
        entry &&
        entry !== focusedEntry &&
        !entry.isDragging &&
        entry.kind !== "turntable" &&
        entry.kind !== "windowJump" &&
        entry.kind !== "returnInside"
      ) {
        entry.group.position.y = (entry.currentRestY ?? entry.basePosition.y) + 0.035;
        setEntryCue(entry, true);
        render();
      }
    };

    const replaceMaterialMap = (material, texture) => {
      if (!material) return;
      material.map?.dispose?.();
      material.map = texture;
      material.needsUpdate = true;
    };

    const applyDeskPalette = () => {
      if (!THREE) return;
      const palette = readDeskPalette();
      themeMaterials.floor?.color.setHex(palette.floor);
      themeMaterials.wall?.color.setHex(palette.wall);
      themeMaterials.wood?.color.setHex(palette.wood);
      themeMaterials.woodEdge?.color.setHex(palette.woodEdge);
      themeMaterials.coffee?.color.setHex(palette.coffee);
      themeMaterials.ceramic?.color.setHex(palette.ceramic);
      themeMaterials.recordBase?.color.setHex(palette.recordBase);
      themeMaterials.metal?.color.setHex(palette.metal);
      themeMaterials.cardEdge?.color.setHex(palette.cardEdge);
      themeMaterials.shadow?.color.setHex(palette.shadow);
      if (themeMaterials.shadow) themeMaterials.shadow.opacity = palette.shadowOpacity;
      themeMaterials.stain?.color.setHex(palette.stain);
      if (themeMaterials.stain) themeMaterials.stain.opacity = palette.stainOpacity;
      themeMaterials.windowFrame?.color.setHex(palette.isDarkTheme ? 0xe5d2b8 : 0x7e6047);
      themeMaterials.windowRecess?.color.setHex(palette.isDarkTheme ? 0x0b1416 : 0xd7c5ae);
      themeMaterials.windowGlass?.color.setHex(palette.isDarkTheme ? 0xa7d0dd : 0xd8f6ff);
      themeMaterials.outsideOcean?.color.setHex(palette.isDarkTheme ? 0x183648 : 0x58b5cf);
      themeMaterials.outsideBeach?.color.setHex(palette.isDarkTheme ? 0xc7aa7e : 0xf0d6a6);
      themeMaterials.outsideCliff?.color.setHex(palette.isDarkTheme ? 0x62533e : 0x9b825f);
      themeMaterials.outsideHouse?.color.setHex(palette.isDarkTheme ? 0xefe2d0 : 0xfff7e9);
      themeMaterials.outsideRoof?.color.setHex(palette.isDarkTheme ? 0x4e3a2d : 0x8b5a35);
      themeMaterials.outsideBed?.color.setHex(palette.isDarkTheme ? 0xe9dfd2 : 0xfff8ee);
      ambientLight?.color.setHex(palette.ambientColor);
      if (ambientLight) ambientLight.intensity = palette.ambientIntensity;
      if (keyLight) keyLight.intensity = palette.keyIntensity;
      sideLight?.color.setHex(palette.sideColor);
      if (sideLight) sideLight.intensity = palette.sideIntensity;
      if (windowMaterial) {
        replaceMaterialMap(windowMaterial, createWindowTexture(palette));
      }
      if (mugMarkMaterial) {
        replaceMaterialMap(mugMarkMaterial, createMugMarkTexture(palette));
      }
      replaceMaterialMap(themeMaterials.windowButton, createDeskButtonTexture(palette, "OUT"));
      replaceMaterialMap(themeMaterials.returnButton, createDeskButtonTexture(palette, "IN"));
      replaceMaterialMap(themeMaterials.outsideBackdrop, createOutsideBackdropTexture(palette));
      replaceMaterialMap(themeMaterials.catBlanket, createCatBlanketTexture(palette));
      replaceMaterialMap(themeMaterials.laptopScreen, createLaptopScreenTexture(palette));
      render();
    };

    const resize = () => {
      if (!renderer || !camera) return;
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || 1));
      const height = Math.max(1, Math.round(rect.height || width * 0.74));
      const isCompact = width < 560;
      isCompactScene = isCompact;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (rootGroup) {
        rootGroup.scale.setScalar(isCompact ? 0.84 : 1.14);
        rootGroup.position.set(isCompact ? -0.18 : -0.08, isCompact ? -0.13 : -0.08, isCompact ? 0.2 : 0.02);
      }
      if (outsideGroup) {
        outsideGroup.scale.setScalar(isCompact ? 0.78 : 0.98);
        outsideGroup.position.set(isCompact ? -0.14 : -0.04, isCompact ? -0.1 : -0.04, isCompact ? 0.16 : 0);
      }
      applyCameraPose(true);
      render();
    };

    const setActiveRecordInternal = (index, notify = false) => {
      activeRecordIndex = (index + records.length) % records.length;
      const record = records[activeRecordIndex];
      if (recordLabelMaterial) loadTexture(record?.src || record?.cover, recordLabelMaterial);
      albumEntries.forEach((entry) => {
        entry.group.scale.setScalar(entry.index === activeRecordIndex ? 1.06 : 1);
      });
      if (notify && callbacks.selectRecord) callbacks.selectRecord(activeRecordIndex);
      scheduleFrame();
    };

    const setToneArm = (playing, immediate = false) => {
      if (!toneArmGroup) return;
      const targetY = playing ? -0.4 : 0.38;
      const targetZ = playing ? -0.17 : -0.36;
      if (immediate || reduceMotion) {
        toneArmGroup.rotation.y = targetY;
        toneArmGroup.position.z = targetZ;
        return;
      }
      addTween(
        toneArmGroup,
        {
          position: new THREE.Vector3(toneArmGroup.position.x, toneArmGroup.position.y, targetZ),
          rotation: new THREE.Euler(toneArmGroup.rotation.x, targetY, toneArmGroup.rotation.z),
          scale: toneArmGroup.scale.clone(),
        },
        360
      );
    };

    const clearFocusedEntry = (duration = 460) => {
      if (!focusedEntry) return false;
      const entry = focusedEntry;
      focusedEntry = null;
      container.removeAttribute("data-focused-desk-object");
      entry.lifted = false;
      entry.currentRestY = entry.basePosition.y;
      setEntryCue(entry, false);
      addTween(
        entry.group,
        {
          position: entry.basePosition.clone(),
          rotation: entry.baseRotation.clone(),
          scale: new THREE.Vector3(1, 1, 1),
        },
        duration
      );
      return true;
    };

    const focusAlbum = (entry) => {
      if (!entry) return;
      if (focusedEntry && focusedEntry !== entry) clearFocusedEntry(360);
      focusedEntry = entry;
      container.setAttribute("data-focused-desk-object", `album-${entry.index}`);
      setEntryCue(entry, true);
      entry.thrown = false;
      const playPosition = entry.playPosition || entry.basePosition.clone().add(new THREE.Vector3(0, 0.08, 0));
      const playRotation = entry.playRotation || new THREE.Euler(-Math.PI / 2, 0.04, 0.08);
      entry.currentRestY = playPosition.y;
      setActiveRecordInternal(entry.index, true);
      if (callbacks.playRecord) {
        callbacks.playRecord(entry.index);
      } else {
        isRecordSpinning = true;
        setToneArm(true);
      }
      addTween(
        entry.group,
        {
          position: playPosition.clone(),
          rotation: playRotation.clone(),
          scale: new THREE.Vector3(1.13, 1.13, 1.13),
        },
        620
      );
      targetZoomLevel = Math.max(targetZoomLevel, 0.34);
      targetRotationX = -0.04;
      targetRotationY = -0.22;
      scheduleFrame();
    };

    const focusArtifact = (entry) => {
      if (!entry) return;
      if (focusedEntry && focusedEntry !== entry) clearFocusedEntry(360);
      focusedEntry = entry;
      container.setAttribute("data-focused-desk-object", `artifact-${entry.index}`);
      setEntryCue(entry, true);
      entry.lifted = true;
      const focusPosition = entry.focusPosition || entry.basePosition.clone().add(new THREE.Vector3(0, 0.56, -0.16));
      const focusRotation = entry.focusRotation || new THREE.Euler(0.88, 0.02, entry.index === 0 ? -0.05 : 0.05);
      entry.currentRestY = focusPosition.y;
      addTween(
        entry.group,
        {
          position: focusPosition.clone(),
          rotation: focusRotation.clone(),
          scale: new THREE.Vector3(1.42, 1.42, 1.42),
        },
        560
      );
      targetZoomLevel = Math.max(targetZoomLevel, 0.68);
      targetRotationX = -0.035;
      targetRotationY = -0.2;
      scheduleFrame();
    };

    const throwAlbum = (entry, deltaX = 1) => {
      if (focusedEntry === entry) {
        focusedEntry = null;
        container.removeAttribute("data-focused-desk-object");
      }
      setEntryCue(entry, false);
      entry.thrown = true;
      entry.currentRestY = -1.145;
      const side = deltaX >= 0 ? 1 : -1;
      addTween(
        entry.group,
        {
          position: new THREE.Vector3(-1.25 + side * (0.45 + entry.index * 0.08), -1.145, 1.64 + entry.index * 0.13),
          rotation: new THREE.Euler(-Math.PI / 2, 0.05 * side, -0.42 * side + entry.index * 0.12),
          scale: new THREE.Vector3(0.94, 0.94, 0.94),
        },
        680
      );
      const songCard = songCardEntries[entry.index];
      if (songCard) {
        songCard.group.visible = true;
        addTween(
          songCard.group,
          {
            position: new THREE.Vector3(-0.86 + side * 0.26, -1.12, 1.18 + entry.index * 0.08),
            rotation: new THREE.Euler(-Math.PI / 2, 0, 0.28 * side),
            scale: new THREE.Vector3(1, 1, 1),
          },
          560
        );
      }
      scheduleFrame();
    };

    const resetObjects = () => {
      focusedEntry = null;
      container.removeAttribute("data-focused-desk-object");
      albumEntries.forEach((entry) => {
        setEntryCue(entry, false);
        entry.thrown = false;
        entry.currentRestY = entry.basePosition.y;
        addTween(entry.group, { position: entry.basePosition.clone(), rotation: entry.baseRotation.clone(), scale: new THREE.Vector3(1, 1, 1) }, 520);
      });
      artifactEntries.forEach((entry) => {
        setEntryCue(entry, false);
        entry.lifted = false;
        entry.currentRestY = entry.basePosition.y;
        addTween(entry.group, { position: entry.basePosition.clone(), rotation: entry.baseRotation.clone(), scale: new THREE.Vector3(1, 1, 1) }, 420);
      });
      songCardEntries.forEach((entry) => {
        entry.group.visible = false;
        entry.group.position.copy(entry.basePosition);
        entry.group.rotation.copy(entry.baseRotation);
        entry.group.scale.setScalar(0.72);
      });
      setToneArm(isRecordSpinning, true);
    };

    const setSceneView = (nextView) => {
      if (focusedEntry) clearFocusedEntry(360);
      activeView = nextView === "outside" ? "outside" : "desk";
      if (rootGroup) rootGroup.visible = activeView === "desk";
      if (outsideGroup) outsideGroup.visible = activeView === "outside";
      container.classList.toggle("is-outside-view", activeView === "outside");
      root.classList.toggle("home-desk-outside-active", activeView === "outside");
      targetZoomLevel = 0;
      zoomLevel = 0;
      targetRotationX = activeView === "outside" ? -0.03 : defaultRotation.x;
      targetRotationY = activeView === "outside" ? 0.16 : defaultRotation.y;
      rotationX = targetRotationX;
      rotationY = targetRotationY;
      applyRootRotation(true);
      applyCameraPose(true);
      updateWindowJumpVisibility();
      scheduleFrame();
    };

    const resetSceneView = () => {
      setSceneView("desk");
      targetZoomLevel = 0;
      zoomLevel = 0;
      applyCameraPose(true);
      updateWindowJumpVisibility();
    };

    function tick(time) {
      animationFrame = null;
      if (!isLoaded) return;

      applyRootRotation();
      const keepCameraMoving = applyCameraPose();
      const keepTweening = updateTweens(time);

      if (recordGroup && isVisible && isRecordSpinning && !reduceMotion) {
        recordGroup.rotation.y = time * 0.00135;
      }

      if (toneArmGroup && isVisible && isRecordSpinning && !reduceMotion) {
        toneArmGroup.rotation.z = Math.sin(time * 0.0018) * 0.01;
      }

      render();

      if (isVisible && ((!reduceMotion && isRecordSpinning) || needsRotationFrame() || keepCameraMoving || keepTweening)) {
        scheduleFrame();
      }
    }

    const addWindow = (palette) => {
      const wallMaterial = new THREE.MeshBasicMaterial({ color: palette.wall, transparent: true, opacity: 0.98, depthWrite: false });
      themeMaterials.wall = wallMaterial;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.08), wallMaterial);
      wall.position.set(0.22, 0.2, -1.78);
      wall.renderOrder = -3;
      rootGroup.add(wall);

      const recessMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x0b1416 : 0xd7c5ae, roughness: 0.86, metalness: 0.01 });
      const frameMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe5d2b8 : 0x7e6047, roughness: 0.62 });
      const glassMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xa7d0dd : 0xd8f6ff,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.16 : 0.22,
        depthWrite: false,
      });
      themeMaterials.windowFrame = frameMaterial;
      themeMaterials.windowRecess = recessMaterial;
      themeMaterials.windowGlass = glassMaterial;

      addBox(rootGroup, { x: 2.18, y: 1.45, z: 0.09 }, { x: 1.16, y: 0.68, z: -1.765 }, recessMaterial);

      windowMaterial = new THREE.MeshBasicMaterial({ map: createWindowTexture(palette), transparent: true });
      const view = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.08), windowMaterial);
      view.position.set(1.16, 0.68, -1.708);
      view.renderOrder = -2;
      rootGroup.add(view);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1), glassMaterial);
      glass.position.set(1.16, 0.68, -1.69);
      glass.renderOrder = -1;
      rootGroup.add(glass);

      addBox(rootGroup, { x: 1.96, y: 0.08, z: 0.11 }, { x: 1.16, y: 1.27, z: -1.66 }, frameMaterial);
      addBox(rootGroup, { x: 1.96, y: 0.08, z: 0.11 }, { x: 1.16, y: 0.09, z: -1.66 }, frameMaterial);
      addBox(rootGroup, { x: 0.08, y: 1.22, z: 0.11 }, { x: 0.16, y: 0.68, z: -1.66 }, frameMaterial);
      addBox(rootGroup, { x: 0.08, y: 1.22, z: 0.11 }, { x: 2.16, y: 0.68, z: -1.66 }, frameMaterial);
      addBox(rootGroup, { x: 0.06, y: 1.08, z: 0.08 }, { x: 1.16, y: 0.68, z: -1.63 }, frameMaterial);
      addBox(rootGroup, { x: 1.72, y: 0.045, z: 0.08 }, { x: 1.16, y: 0.68, z: -1.63 }, frameMaterial);
      addBox(rootGroup, { x: 2.2, y: 0.1, z: 0.28 }, { x: 1.12, y: 0.0, z: -1.58 }, frameMaterial);

      windowJumpGroup = new THREE.Group();
      windowJumpGroup.visible = false;
      windowJumpGroup.position.set(1.94, 0.34, -1.54);
      rootGroup.add(windowJumpGroup);
      const buttonMaterial = new THREE.MeshBasicMaterial({
        map: createDeskButtonTexture(palette, "OUT"),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      themeMaterials.windowButton = buttonMaterial;
      const button = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), buttonMaterial);
      windowJumpGroup.add(button);
      const buttonHit = new THREE.Mesh(
        new THREE.PlaneGeometry(0.54, 0.54),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      buttonHit.position.z = 0.01;
      windowJumpGroup.add(buttonHit);
      const entry = {
        kind: "windowJump",
        group: windowJumpGroup,
        basePosition: windowJumpGroup.position.clone(),
        baseRotation: windowJumpGroup.rotation.clone(),
        currentRestY: windowJumpGroup.position.y,
      };
      registerInteractive(button, { kind: "windowJump", index: 0 }, entry);
      registerInteractive(buttonHit, { kind: "windowJump", index: 0 }, entry);
    };

    const addOutsideVignette = (palette) => {
      outsideGroup = new THREE.Group();
      outsideGroup.visible = false;
      scene.add(outsideGroup);

      const backdropMaterial = new THREE.MeshBasicMaterial({
        map: createOutsideBackdropTexture(palette),
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });
      themeMaterials.outsideBackdrop = backdropMaterial;
      const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.02), backdropMaterial);
      backdrop.position.set(0.1, 0.34, -1.9);
      outsideGroup.add(backdrop);

      const oceanMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0x183648 : 0x58b5cf,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
      themeMaterials.outsideOcean = oceanMaterial;
      const ocean = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.9), oceanMaterial);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(-0.72, -1.18, 0.1);
      outsideGroup.add(ocean);

      const beachMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xc7aa7e : 0xf0d6a6, roughness: 0.9 });
      const cliffMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x62533e : 0x9b825f, roughness: 0.88 });
      const houseMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xefe2d0 : 0xfff7e9, roughness: 0.72 });
      const roofMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x4e3a2d : 0x8b5a35, roughness: 0.78 });
      const bedMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe9dfd2 : 0xfff8ee, roughness: 0.7 });
      themeMaterials.outsideBeach = beachMaterial;
      themeMaterials.outsideCliff = cliffMaterial;
      themeMaterials.outsideHouse = houseMaterial;
      themeMaterials.outsideRoof = roofMaterial;
      themeMaterials.outsideBed = bedMaterial;
      const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe5b58e, roughness: 0.68 });
      const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8 });
      const pillowMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xf2e6d5 : 0xfff2df, roughness: 0.72 });
      const shirtMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x1d2527 : 0x2b3334, roughness: 0.78 });
      const screenMaterial = new THREE.MeshBasicMaterial({ map: createLaptopScreenTexture(palette), side: THREE.DoubleSide });
      const blanketMaterial = new THREE.MeshStandardMaterial({ map: createCatBlanketTexture(palette), roughness: 0.78 });
      themeMaterials.laptopScreen = screenMaterial;
      themeMaterials.catBlanket = blanketMaterial;

      const beach = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.82), beachMaterial);
      beach.rotation.x = -Math.PI / 2;
      beach.position.set(-0.9, -1.15, 1.5);
      outsideGroup.add(beach);

      addBox(outsideGroup, { x: 1.34, y: 0.68, z: 0.42 }, { x: 1.82, y: -0.94, z: 0.7 }, cliffMaterial);
      addBox(outsideGroup, { x: 1.72, y: 0.12, z: 0.54 }, { x: 1.62, y: -0.56, z: 0.48 }, cliffMaterial);
      addBox(outsideGroup, { x: 0.86, y: 0.16, z: 0.28 }, { x: 0.86, y: -0.02, z: 0.34 }, cliffMaterial);

      const house = new THREE.Group();
      house.position.set(1.16, 0.2, 0.05);
      house.scale.setScalar(1.08);
      outsideGroup.add(house);
      addBox(house, { x: 1.46, y: 0.92, z: 0.72 }, { x: 0, y: 0, z: 0 }, houseMaterial);
      addBox(house, { x: 1.62, y: 0.18, z: 0.88 }, { x: 0, y: 0.55, z: 0 }, roofMaterial);
      addBox(house, { x: 1.2, y: 0.08, z: 0.16 }, { x: -0.08, y: -0.55, z: 0.38 }, roofMaterial);
      addBox(house, { x: 1.2, y: 0.035, z: 0.04 }, { x: -0.08, y: -0.45, z: 0.52 }, houseMaterial);
      addBox(
        house,
        { x: 0.9, y: 0.56, z: 0.035 },
        { x: -0.12, y: 0.02, z: 0.38 },
        new THREE.MeshStandardMaterial({ color: 0x1d2a2e, roughness: 0.65 })
      );

      const room = new THREE.Group();
      room.position.set(-0.12, -0.02, 0.43);
      house.add(room);
      addBox(room, { x: 0.82, y: 0.1, z: 0.46 }, { x: -0.04, y: -0.2, z: 0 }, bedMaterial);
      addBox(room, { x: 0.34, y: 0.07, z: 0.2 }, { x: -0.34, y: -0.12, z: -0.03 }, pillowMaterial);
      addBox(room, { x: 0.42, y: 0.07, z: 0.16 }, { x: -0.08, y: -0.06, z: 0.03 }, shirtMaterial);
      addBox(room, { x: 0.7, y: 0.09, z: 0.4 }, { x: 0.05, y: -0.035, z: 0.03 }, blanketMaterial);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 18), skinMaterial);
      head.scale.set(1.06, 0.88, 0.82);
      head.position.set(-0.29, 0.03, 0.08);
      room.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 18), hairMaterial);
      hair.scale.set(1.2, 0.64, 0.9);
      hair.position.set(-0.32, 0.055, 0.07);
      room.add(hair);
      addBox(
        room,
        { x: 0.24, y: 0.016, z: 0.18 },
        { x: -0.08, y: 0.035, z: 0.18 },
        new THREE.MeshStandardMaterial({ color: 0x1a1f22, roughness: 0.42, metalness: 0.2 })
      );
      const laptopScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), screenMaterial);
      laptopScreen.position.set(-0.08, 0.15, 0.08);
      laptopScreen.rotation.set(-0.44, 0.02, 0);
      room.add(laptopScreen);

      returnInsideGroup = new THREE.Group();
      returnInsideGroup.position.set(-2.35, 0.98, -0.82);
      outsideGroup.add(returnInsideGroup);
      const returnMaterial = new THREE.MeshBasicMaterial({
        map: createDeskButtonTexture(palette, "IN"),
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      themeMaterials.returnButton = returnMaterial;
      const returnButton = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), returnMaterial);
      returnInsideGroup.add(returnButton);
      const returnHit = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      returnHit.position.z = 0.01;
      returnInsideGroup.add(returnHit);
      const returnEntry = {
        kind: "returnInside",
        group: returnInsideGroup,
        basePosition: returnInsideGroup.position.clone(),
        baseRotation: returnInsideGroup.rotation.clone(),
        currentRestY: returnInsideGroup.position.y,
      };
      registerInteractive(returnButton, { kind: "returnInside", index: 0 }, returnEntry);
      registerInteractive(returnHit, { kind: "returnInside", index: 0 }, returnEntry);
    };

    const buildScene = () => {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
      renderer.domElement.className = "home-desk-corner-canvas";
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      textureLoader = new THREE.TextureLoader();
      raycaster = new THREE.Raycaster();
      pointerNdc = new THREE.Vector2();

      const palette = readDeskPalette();

      ambientLight = new THREE.AmbientLight(palette.ambientColor, palette.ambientIntensity);
      keyLight = new THREE.DirectionalLight(0xffffff, palette.keyIntensity);
      keyLight.position.set(-3.2, 4.4, 5.6);
      sideLight = new THREE.DirectionalLight(palette.sideColor, palette.sideIntensity);
      sideLight.position.set(4.2, 2.2, 2.8);
      scene.add(ambientLight, keyLight, sideLight);

      rootGroup = new THREE.Group();
      rootGroup.rotation.set(rotationX, rotationY, 0);
      scene.add(rootGroup);

      const floorMaterial = new THREE.MeshBasicMaterial({ color: palette.floor, depthWrite: false });
      const woodMaterial = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.82, metalness: 0.02 });
      const woodEdgeMaterial = new THREE.MeshStandardMaterial({ color: palette.woodEdge, roughness: 0.86, metalness: 0.02 });
      const coffeeMaterial = new THREE.MeshStandardMaterial({ color: palette.coffee, roughness: 0.46 });
      const ceramicMaterial = new THREE.MeshStandardMaterial({ color: palette.ceramic, roughness: 0.42, metalness: 0.02 });
      const recordBaseMaterial = new THREE.MeshStandardMaterial({ color: palette.recordBase, roughness: 0.68, metalness: 0.08 });
      const vinylMaterial = new THREE.MeshStandardMaterial({ color: 0x101111, roughness: 0.5, metalness: 0.05 });
      const metalMaterial = new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.38, metalness: 0.42 });
      const cardEdgeMaterial = new THREE.MeshStandardMaterial({ color: palette.cardEdge, roughness: 0.72, metalness: 0.02 });
      const stainMaterial = new THREE.MeshBasicMaterial({
        color: palette.stain,
        transparent: true,
        opacity: palette.stainOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      themeMaterials.floor = floorMaterial;
      themeMaterials.wood = woodMaterial;
      themeMaterials.woodEdge = woodEdgeMaterial;
      themeMaterials.coffee = coffeeMaterial;
      themeMaterials.ceramic = ceramicMaterial;
      themeMaterials.recordBase = recordBaseMaterial;
      themeMaterials.metal = metalMaterial;
      themeMaterials.cardEdge = cardEdgeMaterial;
      themeMaterials.stain = stainMaterial;

      addWindow(palette);
      addOutsideVignette(palette);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.9), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -1.22, 0.82);
      rootGroup.add(floor);

      const floorShadowMaterial = new THREE.MeshBasicMaterial({
        color: palette.shadow,
        transparent: true,
        opacity: palette.shadowOpacity,
        depthWrite: false,
      });
      themeMaterials.shadow = floorShadowMaterial;
      const floorShadow = new THREE.Mesh(new THREE.CircleGeometry(2.22, 80), floorShadowMaterial);
      floorShadow.rotation.x = -Math.PI / 2;
      floorShadow.scale.set(1.2, 0.36, 1);
      floorShadow.position.set(0.08, -1.205, 1.02);
      rootGroup.add(floorShadow);

      const table = new THREE.Group();
      table.position.set(0, 0, 0.1);
      rootGroup.add(table);
      addBox(table, { x: 4.08, y: 0.16, z: 1.68 }, { x: 0, y: -0.46, z: 0.18 }, woodMaterial);
      addBox(table, { x: 4.14, y: 0.08, z: 0.08 }, { x: 0, y: -0.39, z: 1.05 }, woodEdgeMaterial);
      [
        [-1.72, 0.82],
        [1.72, 0.82],
        [-1.72, -0.42],
        [1.72, -0.42],
      ].forEach(([x, z]) => addBox(table, { x: 0.14, y: 0.72, z: 0.14 }, { x, y: -0.84, z }, woodEdgeMaterial));

      const player = new THREE.Group();
      player.position.set(-1.18, -0.31, -0.04);
      table.add(player);
      const playerBase = addBox(player, { x: 1.5, y: 0.16, z: 1.08 }, { x: 0, y: 0.02, z: 0 }, recordBaseMaterial);
      registerInteractive(playerBase, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const turntableHit = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.08), hitMaterial);
      turntableHit.rotation.x = -Math.PI / 2;
      turntableHit.position.set(-0.12, 0.28, 0.02);
      player.add(turntableHit);
      registerInteractive(turntableHit, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      recordGroup = new THREE.Group();
      recordGroup.position.set(-0.24, 0.16, 0.0);
      player.add(recordGroup);
      const record = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.055, 112), vinylMaterial);
      recordGroup.add(record);
      recordLabelMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.02 });
      const recordLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.062, 72), recordLabelMaterial);
      recordLabel.position.y = 0.036;
      recordGroup.add(recordLabel);
      registerInteractive(record, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      registerInteractive(recordLabel, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });

      toneArmGroup = new THREE.Group();
      toneArmGroup.position.set(0.43, 0.22, -0.36);
      toneArmGroup.rotation.y = 0.38;
      player.add(toneArmGroup);
      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 36), metalMaterial);
      toneArmGroup.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.7), metalMaterial);
      arm.position.set(-0.26, 0, -0.26);
      arm.rotation.y = -0.48;
      toneArmGroup.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.13), metalMaterial);
      head.position.set(-0.48, 0, -0.52);
      head.rotation.y = -0.48;
      toneArmGroup.add(head);

      const albumRack = new THREE.Group();
      albumRack.position.set(-1.76, -0.2, -0.66);
      table.add(albumRack);
      addBox(albumRack, { x: 1.42, y: 0.08, z: 0.24 }, { x: 0.02, y: 0.02, z: -0.07 }, woodEdgeMaterial);
      addBox(albumRack, { x: 1.48, y: 0.08, z: 0.08 }, { x: 0.02, y: 0.42, z: -0.19 }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.08, y: 0.56, z: 0.12 }, { x: -0.7, y: 0.24, z: -0.08 }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.08, y: 0.56, z: 0.12 }, { x: 0.74, y: 0.24, z: -0.08 }, woodEdgeMaterial);
      records.slice(0, 4).forEach((recordItem, index) => {
        const entry = { kind: "album", index, group: new THREE.Group(), thrown: false };
        entry.group.position.set(-0.45 + index * 0.3, 0.36 + index * 0.01, 0.01 - index * 0.018);
        entry.group.rotation.set(-0.02, -0.18 + index * 0.06, -0.055 + index * 0.028);
        entry.basePosition = entry.group.position.clone();
        entry.baseRotation = entry.group.rotation.clone();
        entry.playPosition = new THREE.Vector3(0.34, 0.58, 0.58);
        entry.playRotation = new THREE.Euler(-Math.PI / 2, 0.04, 0.08);
        entry.currentRestY = entry.basePosition.y;
        albumRack.add(entry.group);
        const sleeveBack = addBox(entry.group, { x: 0.46, y: 0.64, z: 0.045 }, { x: 0, y: 0, z: -0.018 }, cardEdgeMaterial);
        const coverMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide });
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.61), coverMaterial);
        cover.position.set(0, 0.01, 0.008);
        entry.group.add(cover);
        const albumCue = new THREE.Mesh(
          new THREE.PlaneGeometry(0.52, 0.7),
          new THREE.MeshBasicMaterial({
            color: palette.isDarkTheme ? 0xf2c38d : 0xb76f38,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        albumCue.position.set(0, 0.01, 0.004);
        albumCue.visible = false;
        entry.group.add(albumCue);
        entry.cue = albumCue;
        registerInteractive(sleeveBack, { kind: "album", index }, entry);
        registerInteractive(cover, { kind: "album", index }, entry);
        loadTexture(recordItem.cover || recordItem.src, coverMaterial);
        albumEntries.push(entry);

        const songEntry = { kind: "song", index, group: new THREE.Group() };
        songEntry.group.position.set(-1.75 + index * 0.08, -0.2, -0.54);
        songEntry.group.rotation.set(-0.12, 0.24, -0.12);
        songEntry.group.scale.setScalar(0.72);
        songEntry.group.visible = false;
        songEntry.basePosition = songEntry.group.position.clone();
        songEntry.baseRotation = songEntry.group.rotation.clone();
        table.add(songEntry.group);
        const songMaterial = new THREE.MeshStandardMaterial({
          map: createSongCardTexture(recordItem),
          roughness: 0.62,
          metalness: 0.01,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const song = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.4), songMaterial);
        song.rotation.x = -Math.PI / 2;
        songEntry.group.add(song);
        songCardEntries.push(songEntry);
      });

      artifacts.slice(0, 2).forEach((artifact, index) => {
        const entry = { kind: "artifact", index, url: artifact.url || "", group: new THREE.Group(), lifted: false };
        entry.group.position.set(index === 0 ? 0.42 : 0.98, -0.265 + index * 0.006, index === 0 ? 0.56 : -0.22);
        entry.group.rotation.set(0, 0, index === 0 ? -0.045 : 0.04);
        entry.basePosition = entry.group.position.clone();
        entry.baseRotation = entry.group.rotation.clone();
        entry.focusPosition = new THREE.Vector3(index === 0 ? -0.22 : 0.04, 0.74, index === 0 ? 0.34 : 0.08);
        entry.focusRotation = new THREE.Euler(1.08, 0.02, index === 0 ? -0.035 : 0.035);
        entry.currentRestY = entry.basePosition.y;
        table.add(entry.group);
        const base = addBox(entry.group, { x: 1.38, y: 0.035, z: 0.62 }, { x: 0, y: 0, z: 0 }, cardEdgeMaterial);
        const topMaterial = new THREE.MeshStandardMaterial({
          map: createArtifactTexture(artifact, index, palette),
          roughness: 0.64,
          metalness: 0.01,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const top = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.62), topMaterial);
        top.rotation.x = -Math.PI / 2;
        top.position.y = 0.026;
        entry.group.add(top);
        const artifactCue = new THREE.Mesh(
          new THREE.PlaneGeometry(1.62, 0.82),
          new THREE.MeshBasicMaterial({
            color: palette.isDarkTheme ? 0xf0c48f : 0xb86f38,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        artifactCue.rotation.x = -Math.PI / 2;
        artifactCue.position.y = 0.031;
        artifactCue.visible = false;
        entry.group.add(artifactCue);
        entry.cue = artifactCue;
        const cardHit = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.78), hitMaterial);
        cardHit.rotation.x = -Math.PI / 2;
        cardHit.position.y = 0.055;
        entry.group.add(cardHit);
        registerInteractive(base, { kind: "artifact", index, url: entry.url }, entry);
        registerInteractive(top, { kind: "artifact", index, url: entry.url }, entry);
        registerInteractive(cardHit, { kind: "artifact", index, url: entry.url }, entry);
        artifactEntries.push(entry);
      });

      const tableRing = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.48, 72), stainMaterial);
      tableRing.rotation.x = -Math.PI / 2;
      tableRing.position.set(1.6, -0.271, 0.66);
      table.add(tableRing);
      [
        { x: 1.24, z: 0.8, s: 0.052 },
        { x: 1.92, z: 0.76, s: 0.04 },
        { x: 1.46, z: 0.25, s: 0.032 },
      ].forEach((drop) => {
        const droplet = new THREE.Mesh(new THREE.CircleGeometry(drop.s, 24), stainMaterial);
        droplet.rotation.x = -Math.PI / 2;
        droplet.position.set(drop.x, -0.268, drop.z);
        droplet.scale.set(1.4, 0.8, 1);
        table.add(droplet);
      });

      const cup = new THREE.Group();
      cup.position.set(1.6, -0.08, 0.66);
      table.add(cup);
      const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.44, 64, 1, true), ceramicMaterial);
      cup.add(cupBody);
      const cupTop = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 12, 64), ceramicMaterial);
      cupTop.rotation.x = Math.PI / 2;
      cupTop.position.y = 0.23;
      cup.add(cupTop);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.21, 56), coffeeMaterial);
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 0.236;
      cup.add(coffee);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 10, 34, Math.PI * 1.35), ceramicMaterial);
      handle.rotation.set(0, Math.PI / 2, 0.12);
      handle.position.set(0.27, 0.02, 0.02);
      cup.add(handle);
      mugMarkMaterial = new THREE.MeshBasicMaterial({ map: createMugMarkTexture(palette), transparent: true, depthWrite: false });
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), mugMarkMaterial);
      mark.position.set(0.0, 0.02, 0.252);
      cup.add(mark);

      setActiveRecordInternal(activeRecordIndex);
      setToneArm(isRecordSpinning, true);
      applyRootRotation(true);
      resize();
      render();

      resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
      if (resizeObserver) {
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", resize);
      }
      if (!themeObserver && "MutationObserver" in window) {
        themeObserver = new MutationObserver(applyDeskPalette);
        themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode"] });
      }

      const canvas = renderer.domElement;
      const onPointerDown = (event) => {
        if (!isVisible || (event.pointerType === "mouse" && event.button !== 0)) return;
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest("[data-home-desk-controls]")) {
          document.activeElement.blur();
        }
        const hit = pickObject(event);
        pointerId = event.pointerId;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
        pointerMoved = false;
        activeEntry = hit?.homeDeskEntry || null;
        pointerMode = hit?.kind || "rotate";
        rotationStartX = targetRotationX;
        rotationStartY = targetRotationY;
        if (activeEntry) {
          activeEntry.isDragging = true;
          activeEntry.dragStartPosition = activeEntry.group.position.clone();
          activeEntry.dragStartRotation = activeEntry.group.rotation.clone();
        }
        container.classList.add("is-dragging");
        canvas.setPointerCapture?.(pointerId);
        event.preventDefault();
      };

      const onPointerMove = (event) => {
        if (pointerId === null || event.pointerId !== pointerId) {
          setHoverEntry(pickObject(event)?.homeDeskEntry || null);
          return;
        }
        const deltaX = event.clientX - pointerStartX;
        const deltaY = event.clientY - pointerStartY;
        pointerMoved = pointerMoved || Math.abs(deltaX) + Math.abs(deltaY) > 7;

        if (pointerMode === "rotate") {
          targetRotationY = clamp(rotationStartY + deltaX * 0.006, -0.82, 0.28);
          targetRotationX = clamp(rotationStartX + deltaY * 0.0035, -0.22, 0.18);
        } else if (activeEntry?.kind === "album") {
          activeEntry.group.position.set(
            activeEntry.dragStartPosition.x + deltaX * 0.0048,
            activeEntry.dragStartPosition.y + 0.09,
            activeEntry.dragStartPosition.z + deltaY * 0.0048
          );
          activeEntry.group.rotation.z = activeEntry.dragStartRotation.z + deltaX * 0.0028;
        } else if (activeEntry?.kind === "artifact") {
          activeEntry.group.position.set(
            activeEntry.dragStartPosition.x + deltaX * 0.0038,
            activeEntry.dragStartPosition.y + 0.12,
            activeEntry.dragStartPosition.z + deltaY * 0.0038
          );
          activeEntry.group.rotation.z = activeEntry.dragStartRotation.z + deltaX * 0.002;
          activeEntry.group.rotation.x = -0.08;
        }
        scheduleFrame();
        event.preventDefault();
      };

      const onPointerUp = (event) => {
        if (event.pointerId !== pointerId) return;
        const deltaX = event.clientX - pointerStartX;
        const deltaY = event.clientY - pointerStartY;
        const movedEnough = pointerMoved || Math.abs(deltaX) + Math.abs(deltaY) > 10;
        const releasedEntry = activeEntry;

        if (releasedEntry?.kind === "album") {
          if (movedEnough && Math.abs(deltaX) + Math.abs(deltaY) > 32) {
            throwAlbum(releasedEntry, deltaX || 1);
          } else {
            focusAlbum(releasedEntry);
          }
        } else if (releasedEntry?.kind === "artifact") {
          if (!movedEnough && focusedEntry === releasedEntry && releasedEntry.url) {
            if (callbacks.openArtifact) callbacks.openArtifact(releasedEntry.url);
            else window.location.href = releasedEntry.url;
          } else if (!movedEnough) {
            focusArtifact(releasedEntry);
          } else {
            if (focusedEntry === releasedEntry) {
              focusedEntry = null;
              container.removeAttribute("data-focused-desk-object");
            }
            releasedEntry.lifted = true;
            releasedEntry.currentRestY = releasedEntry.basePosition.y + 0.13;
            addTween(
              releasedEntry.group,
              {
                position: releasedEntry.basePosition.clone().add(new THREE.Vector3(deltaX * 0.0012, 0.13, deltaY * 0.0012)),
                rotation: new THREE.Euler(-0.07, releasedEntry.baseRotation.y, releasedEntry.baseRotation.z + clamp(deltaX * 0.001, -0.12, 0.12)),
                scale: new THREE.Vector3(1.03, 1.03, 1.03),
              },
              280
            );
          }
        } else if (pointerMode === "turntable" && !movedEnough) {
          if (callbacks.toggleSpin) callbacks.toggleSpin();
          else {
            isRecordSpinning = !isRecordSpinning;
            setToneArm(isRecordSpinning);
          }
        } else if (pointerMode === "windowJump" && !movedEnough) {
          setSceneView("outside");
        } else if (pointerMode === "returnInside" && !movedEnough) {
          setSceneView("desk");
        }

        if (releasedEntry) releasedEntry.isDragging = false;
        activeEntry = null;
        pointerId = null;
        pointerMode = "";
        container.classList.remove("is-dragging");
        setHoverEntry(null);
        scheduleFrame();
      };

      const onPointerCancel = (event) => {
        if (event.pointerId !== pointerId) return;
        if (activeEntry) {
          activeEntry.isDragging = false;
          addTween(
            activeEntry.group,
            { position: activeEntry.basePosition.clone(), rotation: activeEntry.baseRotation.clone(), scale: new THREE.Vector3(1, 1, 1) },
            280
          );
        }
        activeEntry = null;
        pointerId = null;
        pointerMode = "";
        container.classList.remove("is-dragging");
      };

      const onWheel = (event) => {
        if (!isVisible) return;
        const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (!delta) return;
        if (activeView === "outside") {
          if (delta > 0) {
            setSceneView("desk");
            event.preventDefault();
            scheduleFrame();
          }
          return;
        }
        if (delta > 0 && (focusedEntry || targetZoomLevel > 0.04)) {
          clearFocusedEntry();
          targetZoomLevel = 0;
          targetRotationX = defaultRotation.x;
          targetRotationY = defaultRotation.y;
          event.preventDefault();
          scheduleFrame();
          return;
        }
        targetZoomLevel = clamp(targetZoomLevel - delta * 0.00135, 0, 1);
        if (targetZoomLevel > 0.5) {
          targetRotationX = defaultRotation.x;
          targetRotationY = defaultRotation.y;
        }
        event.preventDefault();
        scheduleFrame();
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      cleanupListeners.push(
        () => canvas.removeEventListener("pointerdown", onPointerDown),
        () => canvas.removeEventListener("pointermove", onPointerMove),
        () => canvas.removeEventListener("pointerup", onPointerUp),
        () => canvas.removeEventListener("pointercancel", onPointerCancel),
        () => canvas.removeEventListener("wheel", onWheel)
      );
    };

    const ensureLoaded = async () => {
      if (isLoaded || isLoading) return;
      isLoading = true;
      try {
        THREE = await import(threeModuleUrl);
        buildScene();
        isLoaded = true;
      } catch {
        container.classList.add("is-three-desk-failed");
      } finally {
        isLoading = false;
      }
    };

    return {
      preload() {
        ensureLoaded();
      },
      async setVisible(nextVisible) {
        isVisible = nextVisible;
        container.classList.toggle("is-visible", isVisible);
        container.setAttribute("aria-hidden", String(!isVisible));
        if (isVisible) {
          await ensureLoaded();
          scheduleFrame();
        } else {
          root.classList.remove("home-desk-outside-active");
          stopLoop();
          render();
        }
      },
      setActiveRecord(index) {
        setActiveRecordInternal(index);
      },
      setSpinning(nextSpinning) {
        isRecordSpinning = nextSpinning;
        setToneArm(isRecordSpinning);
        if (isVisible) scheduleFrame();
      },
      setCallbacks(nextCallbacks = {}) {
        Object.assign(callbacks, nextCallbacks);
      },
      resetView() {
        resetSceneView();
        resetObjects();
        scheduleFrame();
      },
      dispose() {
        stopLoop();
        root.classList.remove("home-desk-outside-active");
        cleanupListeners.forEach((cleanup) => cleanup());
        if (resizeObserver) resizeObserver.disconnect();
        if (!resizeObserver) window.removeEventListener("resize", resize);
        if (themeObserver) themeObserver.disconnect();
        textureCache.forEach((texture) => texture.dispose());
        windowMaterial?.map?.dispose?.();
        mugMarkMaterial?.map?.dispose?.();
        renderer?.dispose();
      },
    };
  };

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
    const deskSceneElement = stage?.querySelector("[data-home-desk-scene]");
    const deskModeButtons = stage ? Array.from(stage.querySelectorAll("[data-home-desk-mode]")) : [];
    const deskControls = stage?.querySelector("[data-home-desk-controls]");
    const deskPreviousButton = deskControls?.querySelector('[data-home-desk-control="previous"]');
    const deskNextButton = deskControls?.querySelector('[data-home-desk-control="next"]');
    const deskSpinButton = deskControls?.querySelector('[data-home-desk-control="spin"]');
    const deskResetButton = deskControls?.querySelector('[data-home-desk-control="reset"]');
    const deskControlItems = deskControls ? Array.from(deskControls.querySelectorAll("button, a")) : [];
    const deskNote = stage?.querySelector("[data-home-desk-note]");
    const artifactCards = Array.from(document.querySelectorAll(".home-artifact-card"))
      .slice(0, 2)
      .map((card) => ({
        label: card.querySelector(".home-artifact-copy > span")?.textContent?.trim() || "",
        title: card.querySelector(".home-artifact-copy strong")?.textContent?.trim() || "",
        url: card.getAttribute("href") || "",
      }));

    const records = recordImages.map((src, index) => ({
      src,
      cover: recordCovers[index] || src,
      title: recordTitles[index] || "Meme record",
      artist: recordArtists[index] || "",
      duration: recordDurations[index] || "",
      tone: recordTones[index] || "submarine",
      source: recordSources[index] || "",
    }));
    const deskScene = createDeskCornerSceneController(deskSceneElement, records, artifactCards);
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
    let reflowRecordCardsFrame = 0;
    let recordDropSequence = 0;

    const compactPileQuery = window.matchMedia("(max-width: 767px)");

    const getCurrentRecord = () => records[Math.max(0, recordIndex)] || records[0];

    const setDeskMode = (mode) => {
      const is3D = mode === "3d";
      if (stage) {
        stage.classList.toggle("is-desk-3d", is3D);
        stage.setAttribute("data-desk-mode", is3D ? "3d" : "2d");
      }
      if (deskControls) {
        deskControls.setAttribute("aria-hidden", String(!is3D));
      }
      if (deskNote) {
        deskNote.setAttribute("aria-hidden", String(!is3D));
      }
      deskControlItems.forEach((control) => {
        if (is3D) {
          control.removeAttribute("tabindex");
        } else {
          control.setAttribute("tabindex", "-1");
        }
      });
      deskModeButtons.forEach((button) => {
        const isActive = button.getAttribute("data-home-desk-mode") === mode;
        button.setAttribute("aria-pressed", String(isActive));
      });
      deskScene.setVisible(is3D);
    };

    const syncPileState = () => {
      if (!pile) return;
      const cardCount = pile.querySelectorAll("[data-home-record-card]").length;
      const hasHalo = Boolean(pile.querySelector("[data-home-record-halo]"));
      pile.hidden = cardCount === 0;
      pile.classList.toggle("has-cards", cardCount > 0);
      pile.classList.toggle("has-halo", hasHalo);
      pile.setAttribute("data-card-count", String(cardCount));
      if (stage) stage.setAttribute("data-record-card-count", String(cardCount));
    };

    const syncRecordVisualState = () => {
      const isPausedRecord = isRecordEngaged && !isSpinning;
      const isActive = isRecordEngaged || isSpinning || isPreviewing;
      portrait.classList.toggle("is-paused-record", isPausedRecord);
      portrait.classList.toggle("is-playing", isSpinning);
      portrait.classList.toggle("is-vinyl-mode", isRecordEngaged || isSpinning);
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
      if (deskPreviousButton) deskPreviousButton.setAttribute("aria-label", `Previous meme record from ${record.title}`);
      if (deskNextButton) deskNextButton.setAttribute("aria-label", `Next meme record from ${record.title}`);
      if (deskSpinButton) {
        deskSpinButton.setAttribute("aria-label", isSpinning ? `Pause ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
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
      deskScene.setActiveRecord(recordIndex);
      return { image: preloadedRecords[recordIndex], record };
    };

    const showRecord = async (nextIndex, options = {}) => {
      const showVinyl = options.vinyl ?? (isRecordEngaged || isSpinning);
      const ticket = ++imageTicket;
      const { image, record } = selectRecord(nextIndex);
      portrait.style.setProperty("--record-image", `url("${record.src}")`);
      hoverLayer.style.backgroundImage = `url("${record.src}")`;
      if (recordFallbackArt) recordFallbackArt.style.backgroundImage = `url("${record.src}")`;
      recordScene.setRecord(record);
      recordScene.setVisible(showVinyl);

      if (showVinyl) {
        setPreviewing(false);
        hoverLayer.classList.remove("is-visible");
        portrait.classList.remove("is-vinyl-preview");
        portrait.classList.add("is-vinyl-mode");
      } else {
        portrait.classList.remove("is-vinyl-mode");
        portrait.classList.add("is-vinyl-preview");
      }

      window.requestAnimationFrame(() => {
        if (ticket !== imageTicket) return;
        if (!showVinyl) {
          setPreviewing(true);
          hoverLayer.classList.add("is-visible");
        }
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
      portrait.classList.remove("is-vinyl-mode");
      portrait.style.removeProperty("--record-image");
      if (recordFallbackArt) recordFallbackArt.style.removeProperty("background-image");
      recordScene.setVisible(false);
      hoverLayer.classList.remove("is-visible");
    };

    const updateSpinState = () => {
      const record = getCurrentRecord();
      portrait.classList.toggle("is-playing", isSpinning);
      portrait.classList.toggle("is-vinyl-mode", isRecordEngaged || isSpinning);
      if (spinButton) {
        spinButton.classList.toggle("is-playing", isSpinning);
        spinButton.setAttribute("aria-pressed", String(isSpinning));
        spinButton.setAttribute("aria-label", isSpinning ? `Pause ${record.title} meme record` : `Spin ${record.title} meme record`);
      }
      if (deskSpinButton) {
        deskSpinButton.classList.toggle("is-playing", isSpinning);
        deskSpinButton.setAttribute("aria-pressed", String(isSpinning));
        deskSpinButton.setAttribute("aria-label", isSpinning ? `Pause ${record.title} meme record` : `Spin ${record.title} meme record`);
        deskSpinButton.setAttribute("title", isSpinning ? "Pause meme record" : "Spin meme record");
      }
      recordScene.setPlaying(isSpinning);
      deskScene.setSpinning(isSpinning);
      syncRecordVisualState();
    };

    const startRecord = async () => {
      isRecordEngaged = true;
      isSpinning = true;
      updateSpinState();
      await showRecord(recordIndex, { vinyl: true });
    };

    const pauseRecord = () => {
      isRecordEngaged = true;
      isSpinning = false;
      updateSpinState();
      showRecord(recordIndex, { vinyl: true });
    };

    const resetRecord = () => {
      isRecordEngaged = false;
      isSpinning = false;
      shakeCount = 0;
      portrait.classList.remove("is-dragging-record", "is-record-card-found", "is-vinyl-mode");
      portrait.removeAttribute("data-record-shakes");
      portrait.style.removeProperty("--record-drag-x");
      portrait.style.removeProperty("--record-drag-tilt");
      recordScene.setDrag(0, 0);
      updateSpinState();
      hideRecord(true);
    };

    const setCardRestTransform = (card, visualOrder, cardCount) => {
      const recordOrder = Number(card.getAttribute("data-record-index")) || 0;
      const isCompactPile = compactPileQuery.matches;
      const scatterSlots = isCompactPile
        ? [
            { x: 0, y: 1.08, rotate: -0.7, tilt: 56.5, scale: 1 },
            { x: -1.34, y: 1.66, rotate: -5.2, tilt: 59.4, scale: 0.984 },
            { x: 1.46, y: 1.96, rotate: 4.6, tilt: 58.2, scale: 0.976 },
            { x: -0.46, y: 2.54, rotate: 2.2, tilt: 60.8, scale: 0.966 },
            { x: 0.82, y: 2.86, rotate: -3.6, tilt: 60.2, scale: 0.956 },
          ]
        : [
            { x: 0, y: 1.12, rotate: -0.6, tilt: 58.2, scale: 1 },
            { x: -2.02, y: 1.78, rotate: -5.8, tilt: 61, scale: 0.984 },
            { x: 2.14, y: 2.1, rotate: 5.1, tilt: 60.1, scale: 0.976 },
            { x: -0.72, y: 2.74, rotate: 2.5, tilt: 62, scale: 0.966 },
            { x: 1.16, y: 3.1, rotate: -4, tilt: 61.4, scale: 0.956 },
          ];
      const slot = scatterSlots[visualOrder % scatterSlots.length];
      const cycle = Math.floor(visualOrder / scatterSlots.length);
      const side = visualOrder % 2 === 0 ? -1 : 1;
      const x = slot.x + side * cycle * (isCompactPile ? 0.2 : 0.28);
      const y = slot.y + cycle * (isCompactPile ? 0.36 : 0.42);
      const z = Math.max(0.16, (isCompactPile ? 0.72 : 0.86) - visualOrder * 0.08);
      const rotate = slot.rotate + ((recordOrder % 3) - 1) * 0.28;
      const tilt = slot.tilt;
      const scale = slot.scale;
      card.style.setProperty(
        "--card-rest-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${z.toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg) rotateY(${(side * -0.52).toFixed(2)}deg) scale(${scale.toFixed(3)})`
      );
      card.style.setProperty(
        "--card-open-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${(z + 0.08).toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg) rotateY(${(side * -0.52).toFixed(2)}deg) scale(${scale.toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-settle",
        `translate3d(${(x + side * 0.06).toFixed(2)}rem, ${(y + 0.1).toFixed(2)}rem, ${Math.max(0.12, z - 0.06).toFixed(2)}rem) rotateZ(${(rotate + side * 0.28).toFixed(2)}deg) rotateX(${(tilt + 1.8).toFixed(2)}deg) rotateY(${(side * -0.5).toFixed(2)}deg) scale(${Math.min(1.012, scale + 0.012).toFixed(3)})`
      );
      card.dataset.stackOrder = String(visualOrder);
      card.style.zIndex = card.classList.contains("is-open") ? "80" : String(40 + Math.max(0, cardCount - visualOrder));
    };

    const reflowRecordCards = () => {
      if (!pile) return;
      const cards = Array.from(pile.querySelectorAll("[data-home-record-card]")).sort((first, second) => {
        const firstOrder = Number(first.dataset.dropSequence) || 0;
        const secondOrder = Number(second.dataset.dropSequence) || 0;
        return firstOrder - secondOrder;
      });
      cards.forEach((card, chronologicalOrder) => {
        const visualOrder = cards.length - 1 - chronologicalOrder;
        setCardRestTransform(card, visualOrder, cards.length);
      });
      syncPileState();
    };

    const scheduleRecordCardReflow = () => {
      if (reflowRecordCardsFrame) window.cancelAnimationFrame(reflowRecordCardsFrame);
      reflowRecordCardsFrame = window.requestAnimationFrame(() => {
        reflowRecordCardsFrame = 0;
        reflowRecordCards();
      });
    };

    const closeActiveCard = () => {
      if (!activeCard) return;
      const card = activeCard;
      card.classList.remove("is-open");
      card.setAttribute("aria-expanded", "false");
      activeCard = null;
      reflowRecordCards();
    };

    const openRecordCard = (card) => {
      if (activeCard && activeCard !== card) closeActiveCard();
      activeCard = card;
      card.classList.add("is-open");
      card.setAttribute("aria-expanded", "true");
      card.style.zIndex = "80";
    };

    const pickRecordCardFromPoint = (clientX, clientY) => {
      if (!pile) return null;
      const cards = Array.from(pile.querySelectorAll("[data-home-record-card]")).sort((first, second) => {
        const firstZ = Number.parseInt(window.getComputedStyle(first).zIndex, 10) || 0;
        const secondZ = Number.parseInt(window.getComputedStyle(second).zIndex, 10) || 0;
        const firstOrder = Number(first.dataset.stackOrder) || 0;
        const secondOrder = Number(second.dataset.stackOrder) || 0;
        return secondZ - firstZ || secondOrder - firstOrder;
      });
      return (
        cards.find((card) => {
          const rect = card.getBoundingClientRect();
          return clientX >= rect.left - 8 && clientX <= rect.right + 8 && clientY >= rect.top - 8 && clientY <= rect.bottom + 8;
        }) || null
      );
    };

    const ensureRecordHalo = () => {
      if (!pile) return;
      pile.classList.add("has-ground-shadow");
    };

    const createRecordCard = (record, index, dropSequence) => {
      const card = document.createElement("article");
      const dropSide = index % 2 === 0 ? -1 : 1;
      card.className = "home-record-card is-dropping";
      card.tabIndex = 0;
      card.dataset.homeRecordCard = String(index);
      card.dataset.dropSequence = String(dropSequence);
      card.setAttribute("data-record-index", String(index));
      card.setAttribute("aria-expanded", "false");
      card.setAttribute("aria-label", `${record.title} by ${record.artist}`);
      card.style.setProperty(
        "--card-drop-start",
        `translate3d(${(dropSide * 0.86).toFixed(2)}rem, -8.2rem, 7.6rem) rotateZ(${(dropSide * -10).toFixed(2)}deg) rotateX(12deg) rotateY(${(dropSide * 7.4).toFixed(2)}deg) scale(0.78)`
      );
      card.style.setProperty(
        "--card-drop-mid",
        `translate3d(${(dropSide * -0.3).toFixed(2)}rem, -1.92rem, 4.2rem) rotateZ(${(dropSide * 5.2).toFixed(2)}deg) rotateX(36deg) rotateY(${(dropSide * -3.6).toFixed(2)}deg) scale(0.94)`
      );
      card.style.setProperty(
        "--card-drop-land",
        `translate3d(${(dropSide * 0.08).toFixed(2)}rem, 1.18rem, 0.88rem) rotateZ(${(dropSide * -0.48).toFixed(2)}deg) rotateX(57deg) rotateY(${(dropSide * -0.52).toFixed(2)}deg) scale(1.006)`
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

      return card;
    };

    const pulseAlreadyFound = () => {
      portrait.classList.add("is-record-card-found");
      recordScene.pulse();
      window.setTimeout(() => portrait.classList.remove("is-record-card-found"), 520);
    };

    const dropRecordCard = async () => {
      const record = getCurrentRecord();
      const showVinyl = isRecordEngaged || isSpinning;
      await showRecord(recordIndex, { vinyl: showVinyl });

      if (!pile || droppedRecords.has(recordIndex)) {
        pulseAlreadyFound();
        return;
      }

      closeActiveCard();
      droppedRecords.add(recordIndex);
      recordDropSequence += 1;
      const card = createRecordCard(record, recordIndex, recordDropSequence);
      pile.hidden = false;
      ensureRecordHalo();
      pile.appendChild(card);
      reflowRecordCards();

      const clearDropState = () => card.classList.remove("is-dropping");
      if (reduceMotion) {
        clearDropState();
      } else {
        card.addEventListener("animationend", clearDropState, { once: true });
        window.setTimeout(clearDropState, 1400);
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

    deskScene.setCallbacks({
      selectRecord(index) {
        isRecordEngaged = true;
        showRecord(index, { vinyl: true });
        syncRecordVisualState();
      },
      playRecord(index) {
        selectRecord(index);
        isRecordEngaged = true;
        isSpinning = true;
        updateSpinState();
        showRecord(recordIndex, { vinyl: true });
      },
      toggleSpin: toggleRecordPlayback,
      openArtifact(url) {
        if (url) window.location.href = url;
      },
    });

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
      showRecord(recordIndex, { vinyl: isRecordEngaged || isSpinning });
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
    setDeskMode("2d");
    deskModeButtons.forEach((button) => {
      button.addEventListener("click", () => setDeskMode(button.getAttribute("data-home-desk-mode") || "2d"));
    });
    if (deskControls) {
      deskControls.addEventListener("click", (event) => event.stopPropagation());
    }
    if (deskPreviousButton) {
      deskPreviousButton.addEventListener("click", (event) => {
        event.stopPropagation();
        advanceRecord(-1);
      });
    }
    if (deskNextButton) {
      deskNextButton.addEventListener("click", (event) => {
        event.stopPropagation();
        advanceRecord(1);
      });
    }
    if (deskSpinButton) {
      deskSpinButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleRecordPlayback();
      });
    }
    if (deskResetButton) {
      deskResetButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deskScene.resetView();
      });
    }
    const prewarmDeskScene = () => deskScene.preload();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prewarmDeskScene, { timeout: 1200 });
    } else {
      window.setTimeout(prewarmDeskScene, 420);
    }
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
    });

    if (pile) {
      pile.addEventListener("click", (event) => {
        if (event.target.closest("a, button, [data-home-record-card]")) return;
        const card = pickRecordCardFromPoint(event.clientX, event.clientY);
        if (!card) return;
        event.stopPropagation();
        openRecordCard(card);
      });
    }

    if (compactPileQuery.addEventListener) {
      compactPileQuery.addEventListener("change", scheduleRecordCardReflow);
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
      deskScene.dispose();
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
