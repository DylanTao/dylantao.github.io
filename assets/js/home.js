(function () {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = reduceMotionQuery.matches;
  const homeScriptSrc = document.currentScript?.src || new URL("/assets/js/home.js", window.location.origin).href;
  const homeScriptBase = homeScriptSrc.split("?")[0];
  const threeModuleUrl = new URL("three.module.min.js", homeScriptBase).href;
  const siruiPhotoAssets = {
    dog: new URL("../img/home/sirui_dog.jpg", homeScriptBase).href,
    lizard: new URL("../img/home/sirui_lizard.jpg", homeScriptBase).href,
    capy: new URL("../img/home/sirui_capy.jpg", homeScriptBase).href,
  };
  const revealItems = Array.from(document.querySelectorAll(".home-reveal"));

  const setupBackToTopStageGuard = () => {
    const stage = document.querySelector("[data-home-artifact-stage]");
    const backToTop = document.getElementById("back-to-top");
    if (!(stage instanceof HTMLElement) || !(backToTop instanceof HTMLElement)) return false;

    const originallyInert = backToTop.hasAttribute("inert");
    let isSuppressed = null;

    const setSuppressed = (nextSuppressed) => {
      if (nextSuppressed === isSuppressed) return;
      isSuppressed = nextSuppressed;

      if (nextSuppressed) {
        const activeElement = document.activeElement;
        backToTop.setAttribute("data-home-stage-suppressed", "");
        backToTop.setAttribute("aria-hidden", "true");
        backToTop.setAttribute("inert", "");
        if (activeElement instanceof HTMLElement && (activeElement === backToTop || backToTop.contains(activeElement))) {
          activeElement.blur();
        }
        return;
      }

      backToTop.removeAttribute("data-home-stage-suppressed");
      backToTop.setAttribute("aria-hidden", String(backToTop.classList.contains("hidden")));
      if (!originallyInert) backToTop.removeAttribute("inert");
    };

    const stageIntersectsViewport = () => {
      const rect = stage.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    };
    const syncSuppression = () => setSuppressed(stageIntersectsViewport());

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => setSuppressed(Boolean(entry?.isIntersecting && entry.intersectionRatio > 0)), {
        threshold: 0,
      });
      observer.observe(stage);
    } else {
      let syncFrame = 0;
      const scheduleSync = () => {
        if (syncFrame) return;
        syncFrame = window.requestAnimationFrame(() => {
          syncFrame = 0;
          syncSuppression();
        });
      };
      window.addEventListener("scroll", scheduleSync, { passive: true });
      window.addEventListener("resize", scheduleSync);
    }

    window.addEventListener("pagehide", () => setSuppressed(false));
    window.addEventListener("pageshow", syncSuppression);
    syncSuppression();
    return true;
  };

  if (!setupBackToTopStageGuard() && document.readyState !== "complete") {
    window.addEventListener("load", setupBackToTopStageGuard, { once: true });
  }

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
  let activeRailSection = "";

  const setActiveRailLink = (sectionId) => {
    if (!sectionId || sectionId === activeRailSection) return;
    activeRailSection = sectionId;
    railLinks.forEach((link) => {
      const isActive = link.getAttribute("data-home-rail-link") === sectionId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    window.dispatchEvent(new CustomEvent("home-active-section-change", { detail: { sectionId } }));
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
      const gap = hasExpansionGutter ? 28 : 32;
      const minAnchor = hasExpansionGutter ? 8 + collapsedWidth : 14;
      const anchor = Math.max(minAnchor, titleRect.left - gap);
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
      armTarget.rotation = playing ? -0.12 : 0.56;
      armTarget.lift = playing ? 0.27 : 0.52;
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
      const darkDetailMaterial = new THREE.MeshStandardMaterial({
        color: 0x1d2020,
        metalness: 0.18,
        roughness: 0.48,
      });
      const armMaterial = new THREE.MeshStandardMaterial({
        color: 0x6f7070,
        metalness: 0.62,
        roughness: 0.26,
      });
      const armDarkMaterial = new THREE.MeshStandardMaterial({
        color: 0x292b2b,
        metalness: 0.26,
        roughness: 0.48,
      });
      const recordSheenMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
      });

      const baseGroup = new THREE.Group();
      baseGroup.rotation.x = -0.13;
      baseGroup.rotation.y = 0.03;
      scene.add(baseGroup);

      const platter = new THREE.Mesh(new THREE.CircleGeometry(2.64, 160), platterMaterial);
      platter.position.z = -0.08;
      baseGroup.add(platter);
      const platterRimMaterial = accentMaterial.clone();
      platterRimMaterial.transparent = true;
      platterRimMaterial.opacity = 0.2;
      const platterRim = new THREE.Mesh(new THREE.RingGeometry(2.48, 2.6, 176), platterRimMaterial);
      platterRim.position.z = -0.024;
      baseGroup.add(platterRim);
      const platterStrobeMaterial = armMaterial.clone();
      platterStrobeMaterial.transparent = true;
      platterStrobeMaterial.opacity = 0.28;
      for (let index = 0; index < 30; index += 1) {
        const angle = (index / 30) * Math.PI * 2;
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.012), platterStrobeMaterial);
        tick.position.set(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, -0.004);
        tick.rotation.z = angle;
        baseGroup.add(tick);
      }

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

      [
        { inner: 1.12, outer: 1.18, opacity: 0.028 },
        { inner: 1.52, outer: 1.6, opacity: 0.038 },
        { inner: 1.96, outer: 2.06, opacity: 0.03 },
      ].forEach((band) => {
        const material = recordSheenMaterial.clone();
        material.opacity = band.opacity;
        const sheen = new THREE.Mesh(new THREE.RingGeometry(band.inner, band.outer, 192), material);
        sheen.position.z = 0.019;
        recordGroup.add(sheen);
      });

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
      const labelInnerRim = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.205, 80), accentMaterial.clone());
      labelInnerRim.material.transparent = true;
      labelInnerRim.material.opacity = 0.5;
      labelInnerRim.position.z = 0.066;
      recordGroup.add(labelInnerRim);
      const labelHole = new THREE.Mesh(new THREE.CircleGeometry(0.09, 48), darkDetailMaterial);
      labelHole.position.z = 0.071;
      recordGroup.add(labelHole);

      const outerBevel = new THREE.Mesh(new THREE.RingGeometry(2.37, 2.46, 192), accentMaterial);
      outerBevel.position.z = 0.063;
      outerBevel.material = accentMaterial.clone();
      outerBevel.material.transparent = true;
      outerBevel.material.opacity = 0.24;
      recordGroup.add(outerBevel);
      const outerCatchlight = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.24, 192), recordSheenMaterial.clone());
      outerCatchlight.material.opacity = 0.058;
      outerCatchlight.position.z = 0.074;
      recordGroup.add(outerCatchlight);

      const spindleWasher = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0065, 10, 44), spindleMaterial);
      spindleWasher.position.z = 0.124;
      baseGroup.add(spindleWasher);
      const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.095, 28), spindleMaterial);
      centerPin.rotation.x = Math.PI / 2;
      centerPin.position.z = 0.13;
      baseGroup.add(centerPin);
      const centerPinTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 12), spindleMaterial);
      centerPinTip.scale.set(1, 1, 0.46);
      centerPinTip.position.z = 0.185;
      baseGroup.add(centerPinTip);

      armGroup = new THREE.Group();
      armGroup.position.set(2.18, 1.55, armState.lift);
      armGroup.rotation.z = armState.rotation;
      baseGroup.add(armGroup);

      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 48), spindleMaterial);
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(0, 0, 0.03);
      armGroup.add(pivot);
      const pivotCap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 10, 48), accentMaterial);
      pivotCap.position.z = 0.098;
      armGroup.add(pivotCap);

      const counterWeight = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 36), armMaterial);
      counterWeight.rotation.x = Math.PI / 2;
      counterWeight.position.set(0.18, 0.18, 0.08);
      armGroup.add(counterWeight);
      const counterWeightRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.008, 8, 40), armDarkMaterial);
      counterWeightRim.position.set(0.18, 0.18, 0.176);
      armGroup.add(counterWeightRim);
      const cueLever = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.032), armDarkMaterial);
      cueLever.position.set(-0.08, 0.2, 0.12);
      cueLever.rotation.z = -0.22;
      armGroup.add(cueLever);

      const armCurve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-0.05, -0.08, 0.1),
          new THREE.Vector3(-0.34, -0.42, 0.105),
          new THREE.Vector3(-0.78, -0.82, 0.095),
          new THREE.Vector3(-1.14, -1.14, 0.08),
        ],
        false,
        "catmullrom",
        0.42
      );
      const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 52, 0.034, 12, false), armMaterial);
      armGroup.add(arm);
      const armHighlight = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 52, 0.009, 8, false), spindleMaterial);
      armHighlight.position.set(0.015, 0.008, 0.028);
      armGroup.add(armHighlight);

      const headshell = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.058), accentMaterial);
      headshell.position.set(-1.27, -1.21, 0.09);
      headshell.rotation.z = -0.72;
      armGroup.add(headshell);
      [
        [-1.2, -1.16],
        [-1.31, -1.26],
      ].forEach(([x, y]) => {
        const screw = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), spindleMaterial);
        screw.position.set(x, y, 0.124);
        armGroup.add(screw);
      });

      const cartridge = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.105, 0.065), armDarkMaterial);
      cartridge.position.set(-1.37, -1.31, 0.04);
      cartridge.rotation.z = -0.72;
      armGroup.add(cartridge);
      const cantileverCurve = new THREE.CatmullRomCurve3(
        [new THREE.Vector3(-1.38, -1.32, 0.02), new THREE.Vector3(-1.41, -1.35, -0.01), new THREE.Vector3(-1.42, -1.37, -0.052)],
        false,
        "catmullrom",
        0.5
      );
      const cantilever = new THREE.Mesh(new THREE.TubeGeometry(cantileverCurve, 18, 0.006, 8, false), spindleMaterial);
      armGroup.add(cantilever);

      const stylus = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.16, 18), armDarkMaterial);
      stylus.rotation.x = Math.PI;
      stylus.position.set(-1.42, -1.36, -0.02);
      armGroup.add(stylus);
      const stylusTip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 8), accentMaterial);
      stylusTip.position.set(-1.42, -1.39, -0.075);
      armGroup.add(stylusTip);
      const stylusGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.072, 24),
        new THREE.MeshBasicMaterial({ color: 0xb99538, transparent: true, opacity: 0.16, depthWrite: false })
      );
      stylusGlow.position.set(-1.42, -1.36, -0.075);
      armGroup.add(stylusGlow);

      updateAccent();
      updateArmTarget(isPlaying);
      applyArmPose(0, true);
      resize();
      applyRecordTexture(currentRecord);
      render();
      container.classList.add("is-three-record");

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

  // The 2D album state stays here; the inhabited world loads only on demand.
  const createDeskCornerSceneController = (container, records, artifacts) => {
    let controller = null;
    let loading = null;
    const state = { visible: false, index: 0, spinning: false, dropped: [], callbacks: {} };
    const get = () => {
      if (controller) return Promise.resolve(controller);
      if (!loading)
        loading = import(new URL("home-scene/controller.mjs", homeScriptBase).href)
          .then((module) => {
            controller = module.createCoastalHome(container, records, artifacts);
            controller.setCallbacks(state.callbacks);
            controller.setActiveRecord(state.index);
            controller.setSpinning(state.spinning);
            controller.setDroppedRecords(state.dropped);
            return controller;
          })
          .catch(() => {
            loading = null;
            container.dispatchEvent(new CustomEvent("home-scene-unavailable", { bubbles: true }));
            return null;
          });
      return loading;
    };
    return {
      preload() {},
      setVisible(value) {
        state.visible = value;
        if (value) get().then((instance) => instance?.setVisible(state.visible));
        else controller?.setVisible(false);
      },
      setActiveRecord(index) {
        state.index = index;
        controller?.setActiveRecord(index);
      },
      setSpinning(value) {
        state.spinning = value;
        controller?.setSpinning(value);
      },
      setDroppedRecords(indices, options) {
        state.dropped = [...indices];
        controller?.setDroppedRecords(indices, options);
      },
      setCallbacks(value) {
        state.callbacks = value;
        controller?.setCallbacks(value);
      },
      resetView() {
        controller?.resetView();
      },
      dispose() {
        controller?.dispose();
        controller = null;
        loading = null;
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
    const droppedRecordOrder = [];
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
    let shakeSuppressionTimer = 0;
    let reflowRecordCardsFrame = 0;
    let recordDropSequence = 0;
    let shakeShouldReplayAllRecords = false;
    let deskModePointerTarget = null;

    const compactPileQuery = window.matchMedia("(max-width: 767px)");

    const getCurrentRecord = () => records[Math.max(0, recordIndex)] || records[0];

    const syncDroppedRecordsToDesk = (options = {}) => {
      deskScene.setDroppedRecords(droppedRecordOrder, options);
      if (stage) stage.setAttribute("data-dropped-records", droppedRecordOrder.join(","));
    };

    const markRecordDropped = (index, options = {}) => {
      if (!droppedRecords.has(index)) {
        droppedRecords.add(index);
        droppedRecordOrder.push(index);
      }
      if (stage) stage.setAttribute("data-dropped-records", droppedRecordOrder.join(","));
      if (options.syncDesk !== false) {
        syncDroppedRecordsToDesk({ animate: options.animate3D, focusIndex: index });
      }
    };

    const getNextUndroppedRecordIndex = (fromIndex = recordIndex) => {
      if (droppedRecords.size >= records.length) return fromIndex;
      for (let offset = 1; offset <= records.length; offset += 1) {
        const nextIndex = (fromIndex + offset) % records.length;
        if (!droppedRecords.has(nextIndex)) return nextIndex;
      }
      return fromIndex;
    };

    const clearDroppedRecordCards = () => {
      closeActiveCard({ bringToTop: false });
      droppedRecords.clear();
      droppedRecordOrder.splice(0, droppedRecordOrder.length);
      if (pile) {
        pile.querySelectorAll("[data-home-record-card]").forEach((card) => card.remove());
        pile.classList.remove("has-ground-shadow");
      }
    };

    const replayAllDroppedRecordCards = (options = {}) => {
      if (!pile || droppedRecords.size < records.length) return false;
      clearDroppedRecordCards();
      pile.hidden = false;

      records.forEach((record, index) => {
        recordDropSequence += 1;
        markRecordDropped(index, { syncDesk: false });
        const card = createRecordCard(record, index, recordDropSequence);
        if (!reduceMotion) card.style.animationDelay = `${index * 80}ms`;
        pile.appendChild(card);
        const clearDropState = () => {
          card.classList.remove("is-dropping");
          card.style.removeProperty("animation-delay");
        };
        if (reduceMotion) {
          clearDropState();
        } else {
          card.addEventListener("animationend", clearDropState, { once: true });
          window.setTimeout(clearDropState, 1080 + index * 80);
        }
      });
      ensureRecordHalo(reduceMotion ? 0 : 600);

      syncDroppedRecordsToDesk({ animate: options.animate3D, focusIndex: records.length - 1 });
      reflowRecordCards();
      syncPileState();
      return true;
    };

    const setDeskMode = (mode, userInitiated = false) => {
      if (mode !== "3d") {
        const lockedUntil = Number(deskSceneElement?.getAttribute("data-desk-mode-lock-until") || 0);
        if (lockedUntil && Date.now() < lockedUntil) return;
      }
      if (userInitiated) {
        try {
          sessionStorage.setItem("sirui-scene-mode", mode);
        } catch {
          /* Session storage is optional. */
        }
      }
      const is3D = mode === "3d";
      if (stage) {
        stage.classList.toggle("is-desk-3d", is3D);
        stage.setAttribute("data-desk-mode", is3D ? "3d" : "2d");
      }
      if (deskControls) {
        deskControls.setAttribute("aria-hidden", String(!is3D));
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
      if (is3D) syncDroppedRecordsToDesk({ immediate: true });
      if (is3D && userInitiated && stage && compactPileQuery.matches) {
        window.requestAnimationFrame(() => {
          stage.scrollIntoView({ block: "center", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        });
      }
    };

    const syncPileState = () => {
      if (!pile) return;
      const cardCount = pile.querySelectorAll("[data-home-record-card]").length;
      const hasHalo = Boolean(pile.querySelector("[data-home-record-halo]"));
      pile.hidden = cardCount === 0;
      pile.classList.toggle("has-cards", cardCount > 0);
      pile.classList.toggle("has-halo", hasHalo);
      pile.setAttribute("data-card-count", String(cardCount));
      if (cardCount === 0) {
        pile.style.removeProperty("--record-card-pile-height");
        pile.classList.remove("has-ground-shadow");
      }
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

    const getRecordCardLayoutProfile = (isCompactPile) => ({
      baseHeight: isCompactPile ? 12.6 : 13.8,
      bottomPad: isCompactPile ? 0.9 : 1.05,
      projectedHeight: isCompactPile ? 6.3 : 7,
      projectedWidth: isCompactPile ? 12 : 13.2,
      zBase: 0.18,
      zStep: 0.02,
      slots: isCompactPile
        ? [
            { x: -1.58, y: 0.24, rotate: -3.8, tilt: 17, scale: 0.99 },
            { x: -0.54, y: 1.46, rotate: -1.3, tilt: 18, scale: 0.982 },
            { x: 0.56, y: 2.68, rotate: 1.6, tilt: 19, scale: 0.974 },
            { x: 1.62, y: 3.9, rotate: 4, tilt: 20, scale: 0.966 },
            { x: 0.08, y: 5.12, rotate: -0.8, tilt: 19, scale: 0.958 },
          ]
        : [
            { x: -3.02, y: 0.24, rotate: -4.4, tilt: 17, scale: 0.99 },
            { x: -1.02, y: 1.68, rotate: -1.6, tilt: 18, scale: 0.982 },
            { x: 1.02, y: 3.12, rotate: 1.9, tilt: 19, scale: 0.974 },
            { x: 3.04, y: 4.56, rotate: 4.6, tilt: 20, scale: 0.966 },
            { x: 0.12, y: 6, rotate: -0.9, tilt: 19, scale: 0.958 },
          ],
    });

    const createCardFootprint = (layout, profile) => {
      const width = profile.projectedWidth * layout.scale;
      const height = profile.projectedHeight * layout.scale;
      return {
        left: layout.x - width / 2,
        right: layout.x + width / 2,
        top: layout.y,
        bottom: layout.y + height,
      };
    };

    const buildRecordCardLayouts = (cardCount) => {
      const isCompactPile = compactPileQuery.matches;
      const profile = getRecordCardLayoutProfile(isCompactPile);
      const layouts = [];

      for (let visualOrder = 0; visualOrder < cardCount; visualOrder += 1) {
        const slot = profile.slots[visualOrder % profile.slots.length];
        const cycle = Math.floor(visualOrder / profile.slots.length);
        const side = visualOrder % 2 === 0 ? -1 : 1;
        const layout = {
          x: slot.x + side * cycle * (isCompactPile ? 0.22 : 0.3),
          y: slot.y + cycle * (isCompactPile ? 1.38 : 1.64),
          z: Math.max(0.16, profile.zBase - visualOrder * profile.zStep),
          rotate: slot.rotate,
          tilt: slot.tilt,
          scale: slot.scale,
          side,
        };
        layouts.push({ ...layout, footprint: createCardFootprint(layout, profile) });
      }

      const lastBottom = layouts.reduce((bottom, layout) => Math.max(bottom, layout.footprint.bottom), 0);
      const pileHeight = Math.max(profile.baseHeight, lastBottom + profile.bottomPad);
      return { layouts, pileHeight };
    };

    const setCardRestTransform = (card, layout, visualOrder, cardCount) => {
      const recordOrder = Number(card.getAttribute("data-record-index")) || 0;
      const isCompactPile = compactPileQuery.matches;
      const { x, y, z, side, tilt, scale } = layout;
      const rotate = layout.rotate + ((recordOrder % 3) - 1) * 0.28;
      const openX = x * 0.18;
      const openY = Math.max(isCompactPile ? -0.72 : -0.84, y - (isCompactPile ? 1.12 : 1.34));
      const openZ = z + (isCompactPile ? 1.08 : 1.28);
      card.style.setProperty(
        "--card-drop-start",
        `translate3d(${(x * 0.08).toFixed(2)}rem, -3.82rem, 1.18rem) rotateZ(${(side * -5.2).toFixed(2)}deg) rotateX(24deg) rotateY(${(side * 2.8).toFixed(2)}deg) scale(0.9)`
      );
      card.style.setProperty(
        "--card-drop-mid",
        `translate3d(${(x * 0.52).toFixed(2)}rem, ${(y - 1.28).toFixed(2)}rem, 0.58rem) rotateZ(${(rotate + side * 2.2).toFixed(2)}deg) rotateX(${Math.max(8, tilt - 7).toFixed(2)}deg) rotateY(${(side * -0.8).toFixed(2)}deg) scale(${Math.min(0.984, scale + 0.006).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-rest-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${z.toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg) rotateY(${(side * -0.52).toFixed(2)}deg) scale(${scale.toFixed(3)})`
      );
      card.style.setProperty(
        "--card-open-transform",
        `translate3d(${openX.toFixed(2)}rem, ${openY.toFixed(2)}rem, ${openZ.toFixed(2)}rem) rotateZ(${(rotate * 0.28).toFixed(2)}deg) rotateX(3.5deg) rotateY(${(side * -1.2).toFixed(2)}deg) scale(${Math.min(1.034, scale + 0.026).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-impact",
        `translate3d(${(x + side * 0.09).toFixed(2)}rem, ${(y + 0.1).toFixed(2)}rem, ${Math.max(0.08, z - 0.08).toFixed(2)}rem) rotateZ(${(rotate + side * 0.24).toFixed(2)}deg) rotateX(${(tilt + 1.3).toFixed(2)}deg) rotateY(${(side * -0.44).toFixed(2)}deg) scale(${Math.min(1.006, scale + 0.006).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-bounce",
        `translate3d(${(x - side * 0.035).toFixed(2)}rem, ${(y - 0.015).toFixed(2)}rem, ${(z + 0.035).toFixed(2)}rem) rotateZ(${(rotate - side * 0.08).toFixed(2)}deg) rotateX(${(tilt - 0.28).toFixed(2)}deg) rotateY(${(side * -0.42).toFixed(2)}deg) scale(${Math.min(1.002, scale + 0.002).toFixed(3)})`
      );
      card.dataset.stackOrder = String(visualOrder);
      card.dataset.cardLaneY = y.toFixed(2);
      card.style.zIndex = card.classList.contains("is-open") ? "80" : String(40 + Math.max(0, cardCount - visualOrder));
    };

    const reflowRecordCards = () => {
      if (!pile) return;
      const cards = Array.from(pile.querySelectorAll("[data-home-record-card]")).sort((first, second) => {
        const firstOrder = Number(first.dataset.dropSequence) || 0;
        const secondOrder = Number(second.dataset.dropSequence) || 0;
        return firstOrder - secondOrder;
      });
      const cardLayout = buildRecordCardLayouts(cards.length);
      pile.style.setProperty("--record-card-pile-height", `${cardLayout.pileHeight.toFixed(2)}rem`);
      cards.forEach((card, chronologicalOrder) => {
        const visualOrder = cards.length - 1 - chronologicalOrder;
        setCardRestTransform(card, cardLayout.layouts[visualOrder], visualOrder, cards.length);
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

    const closeActiveCard = (options = {}) => {
      if (!activeCard) return;
      const card = activeCard;
      card.classList.remove("is-open");
      card.setAttribute("aria-expanded", "false");
      if (options.bringToTop !== false) {
        recordDropSequence += 1;
        card.dataset.dropSequence = String(recordDropSequence);
        card.classList.add("is-settling");
        window.setTimeout(() => card.classList.remove("is-settling"), reduceMotion ? 0 : 560);
      }
      activeCard = null;
      if (pile) pile.classList.remove("is-viewing-card");
      reflowRecordCards();
    };

    const openRecordCard = (card) => {
      if (activeCard && activeCard !== card) closeActiveCard();
      activeCard = card;
      card.classList.add("is-open");
      card.setAttribute("aria-expanded", "true");
      card.style.zIndex = "80";
      if (pile) pile.classList.add("is-viewing-card");
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

    const ensureRecordHalo = (delay = 0) => {
      if (!pile) return;
      if (pile.classList.contains("has-ground-shadow")) return;
      const showGroundShadow = () => {
        if (pile.querySelector("[data-home-record-card]")) pile.classList.add("has-ground-shadow");
      };
      if (delay > 0 && !reduceMotion) {
        window.setTimeout(showGroundShadow, delay);
      } else {
        showGroundShadow();
      }
    };

    const createRecordCard = (record, index, dropSequence) => {
      const card = document.createElement("article");
      const dropSide = index % 2 === 0 ? -1 : 1;
      card.className = "home-record-card is-dropping";
      card.tabIndex = 0;
      card.dataset.homeRecordCard = String(index);
      card.dataset.dropSequence = String(dropSequence);
      card.setAttribute("data-record-index", String(index));
      card.setAttribute("data-record-tone", record.tone || "");
      card.setAttribute("aria-expanded", "false");
      card.setAttribute("aria-label", `${record.title} by ${record.artist}`);
      card.style.setProperty(
        "--card-drop-start",
        `translate3d(${(dropSide * 1.18).toFixed(2)}rem, -3.62rem, 2.2rem) rotateZ(${(dropSide * -6.2).toFixed(2)}deg) rotateX(30deg) rotateY(${(dropSide * 4.2).toFixed(2)}deg) scale(0.86)`
      );
      card.style.setProperty(
        "--card-drop-mid",
        `translate3d(${(dropSide * -0.3).toFixed(2)}rem, -1.34rem, 1.16rem) rotateZ(${(dropSide * 3.8).toFixed(2)}deg) rotateX(47deg) rotateY(${(dropSide * -2.2).toFixed(2)}deg) scale(0.95)`
      );

      const cover = document.createElement("span");
      cover.className = "home-record-card-cover";
      cover.setAttribute("aria-hidden", "true");
      cover.style.backgroundImage = `url("${record.cover}")`;

      const body = document.createElement("span");
      body.className = "home-record-card-body";

      const eyebrow = document.createElement("span");
      eyebrow.className = "home-record-card-eyebrow";
      eyebrow.textContent = "found in the album shake";

      const title = document.createElement("strong");
      title.textContent = record.title;

      const artist = document.createElement("em");
      artist.textContent = record.artist;

      body.append(eyebrow, title, artist);

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

    let pendingRecordAdvance = 0;

    const dropRecordCard = async (options = {}) => {
      const hasExplicitIndex = Number.isInteger(options.index);
      let targetIndex = hasExplicitIndex ? ((options.index % records.length) + records.length) % records.length : recordIndex;
      // A discovery gesture that lands before the carousel has advanced past the
      // record it just dropped moves on to the next unfound record instead of
      // reporting the current one as already found.
      if (!hasExplicitIndex && pendingRecordAdvance && droppedRecords.has(targetIndex)) {
        window.clearTimeout(pendingRecordAdvance);
        pendingRecordAdvance = 0;
        targetIndex = getNextUndroppedRecordIndex(targetIndex);
      }
      const record = records[targetIndex] || getCurrentRecord();
      const showVinyl = isRecordEngaged || isSpinning;
      if (options.reveal !== false) {
        await showRecord(targetIndex, { vinyl: showVinyl });
      }

      if (!pile || droppedRecords.has(targetIndex)) {
        pulseAlreadyFound();
        return;
      }

      closeActiveCard({ bringToTop: false });
      recordDropSequence += 1;
      markRecordDropped(targetIndex, { syncDesk: options.syncDesk !== false, animate3D: options.animate3D });
      const card = createRecordCard(record, targetIndex, recordDropSequence);
      pile.hidden = false;
      pile.appendChild(card);
      ensureRecordHalo(reduceMotion ? 0 : 600);
      reflowRecordCards();

      const clearDropState = () => card.classList.remove("is-dropping");
      if (reduceMotion) {
        clearDropState();
      } else {
        card.addEventListener("animationend", clearDropState, { once: true });
        window.setTimeout(clearDropState, 1080);
      }

      if (options.autoAdvance !== false && options.reveal !== false && !isRecordEngaged && !isSpinning) {
        const nextIndex = getNextUndroppedRecordIndex(targetIndex);
        if (nextIndex !== targetIndex) {
          if (pendingRecordAdvance) window.clearTimeout(pendingRecordAdvance);
          pendingRecordAdvance = window.setTimeout(
            () => {
              pendingRecordAdvance = 0;
              showRecord(nextIndex, { vinyl: false });
            },
            reduceMotion ? 0 : 460
          );
        }
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
      dropRecord(index) {
        dropRecordCard({ index, reveal: false, syncDesk: false, autoAdvance: false });
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
      shakeShouldReplayAllRecords = false;
      lastShakeDirection = 0;
      portrait.classList.remove("is-dragging-record");
      portrait.removeAttribute("data-record-shakes");
      portrait.style.removeProperty("--record-drag-x");
      portrait.style.removeProperty("--record-drag-tilt");
      recordScene.setDrag(0, 0);
      if (shakeSuppressionTimer) window.clearTimeout(shakeSuppressionTimer);
      if (suppressNextSpinClick) {
        shakeSuppressionTimer = window.setTimeout(() => {
          suppressNextSpinClick = false;
          shakeSuppressionTimer = 0;
        }, 420);
      }
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
      shakeShouldReplayAllRecords = droppedRecords.size >= records.length;
      if (droppedRecords.size >= records.length) {
        selectRecord(0);
      } else if (droppedRecords.has(recordIndex)) {
        const nextIndex = getNextUndroppedRecordIndex(recordIndex);
        if (nextIndex !== recordIndex) selectRecord(nextIndex);
      }
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
            if (shakeShouldReplayAllRecords) {
              replayAllDroppedRecordCards({ animate3D: true });
            } else {
              dropRecordCard({ animate3D: true });
            }
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
    let initialDeskMode = "2d";
    try {
      const savedMode = sessionStorage.getItem("sirui-scene-mode");
      if (["2d", "3d"].includes(savedMode)) initialDeskMode = savedMode;
    } catch {
      /* The portrait is the default when storage is unavailable. */
    }
    stage?.addEventListener("home-scene-unavailable", () => {
      setDeskMode("2d");
      deskScene.dispose();
    });
    setDeskMode(initialDeskMode);
    deskModeButtons.forEach((button) => {
      button.addEventListener(
        "pointerdown",
        (event) => {
          deskModePointerTarget = event.currentTarget;
        },
        true
      );
      button.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        if (event.detail !== 0 && deskModePointerTarget !== event.currentTarget) {
          deskModePointerTarget = null;
          return;
        }
        deskModePointerTarget = null;
        setDeskMode(button.getAttribute("data-home-desk-mode") || "2d", true);
      });
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
        if (suppressNextSpinClick && event.detail > 0) {
          event.preventDefault();
          suppressNextSpinClick = false;
          return;
        }
        if (suppressNextSpinClick) {
          suppressNextSpinClick = false;
          if (shakeSuppressionTimer) {
            window.clearTimeout(shakeSuppressionTimer);
            shakeSuppressionTimer = 0;
          }
        }
        toggleRecordPlayback();
      });
    }

    portrait.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() !== "d" || stage?.dataset.deskMode !== "2d") return;
      event.preventDefault();
      if (droppedRecords.size >= records.length) {
        replayAllDroppedRecordCards({ animate3D: true });
      } else {
        dropRecordCard({ animate3D: true });
      }
    });

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
      } else if (stage?.dataset.deskMode === "3d") {
        deskScene.resetView();
        deskControls?.querySelector('[data-home-desk-control="reset"]')?.focus({ preventScroll: true });
      } else if (!isSpinning && isRecordEngaged) {
        resetRecord();
        if (spinButton) spinButton.focus({ preventScroll: true });
      }
    });

    bindRecordNav(previousButton, -1);
    bindRecordNav(nextButton, 1);

    window.addEventListener("pagehide", (event) => {
      if (event.persisted) {
        recordScene.setVisible(false);
        return;
      }
      resetRecord();
      recordScene.dispose();
      deskScene.dispose();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) syncRecordVisualState();
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
