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
      const gap = hasExpansionGutter ? 56 : 48;
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

  const createDeskCornerSceneController = (container, records, artifacts) => {
    if (!container || records.length === 0) {
      return {
        preload() {},
        setVisible() {},
        setActiveRecord() {},
        setSpinning() {},
        setDroppedRecords() {},
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
    const projectedHitCenter = { vector: null };
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
    let pointerActionKind = "";
    let pointerTargetEntry = null;
    let suppressNextSceneClick = false;
    let suppressSceneNativeClicksUntil = 0;
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
    let focusedEntryAt = 0;
    let hoveredEntry = null;
    let pointerMoved = false;
    let outsideViewportCheckFrame = 0;
    let droppedRecordIndices = [];
    const callbacks = {};
    const stageElement = container.closest("[data-home-artifact-stage]") || container.parentElement;
    const textureCache = new Map();
    const themeMaterials = {};
    const interactiveObjects = [];
    const albumEntries = [];
    const artifactEntries = [];
    const photoEntries = [];
    const songCardEntries = [];
    const tweens = [];
    const outsideMotionItems = [];
    const orbitOcclusionItems = [];
    const photoVisibilityItems = [];
    const accentMotionItems = [];
    const cleanupListeners = [];

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
    const easeOutQuart = (value) => 1 - Math.pow(1 - value, 4);
    const lerp = (from, to, progress) => from + (to - from) * progress;
    const roomFloorY = -1.22;
    const roomCeilingY = 1.46;
    const droppedPaperY = roomFloorY + 0.082;
    const droppedPaperShadowY = roomFloorY + 0.008;
    const defaultRotation = { x: -0.05, y: -0.2 };
    const outsideDefaultRotation = { x: -0.03, y: 0.16 };
    const roomPitchBounds = { min: -0.34, max: 0.28 };
    const clampRoomPitch = (value) => clamp(value, roomPitchBounds.min, roomPitchBounds.max);
    const sceneAnchors = {
      room: {
        orbitTarget: { x: 0.08, y: -0.04, z: -0.62 },
        zoomTarget: { x: 0.2, y: 0.1, z: -0.52 },
        defaultCamera: { desktop: { x: 0.12, y: 1.3, z: 2.28 }, compact: { x: 0.08, y: 1.16, z: 2.34 } },
        zoomCamera: { desktop: { x: 0.14, y: 1.08, z: 1.54 }, compact: { x: 0.08, y: 1.0, z: 1.68 } },
        window: { x: 0.52, y: 0.13, z: -1.7, width: 3.08, height: 2.92 },
        desk: { x: 0.16, y: 0, z: -0.72 },
        onsen: { x: -0.96, y: -0.9, z: 0.78 },
        chair: { x: 2.16, y: -1.08, z: 0.34 },
      },
      outside: {
        orbitTarget: { x: 1.08, y: -0.03, z: 0.42 },
        defaultCamera: { desktop: { x: 2.58, y: 1.38, z: 3.48 }, compact: { x: 2.34, y: 1.24, z: 3.64 } },
        zoomCamera: { desktop: { x: 1.68, y: 0.98, z: 3.02 }, compact: { x: 1.44, y: 0.9, z: 3.12 } },
        house: { x: 1.08, y: -0.22, z: 0.42 },
        window: { x: -0.04, y: -0.01, z: 0.48, width: 1.34, height: 1.08 },
        shoreline: { x: -1.9, y: -1.11, z: 1.12 },
      },
    };

    const readDeskPalette = () => {
      const isDarkTheme = root.getAttribute("data-theme") === "dark";
      const mode = root.getAttribute("data-theme-mode") || (isDarkTheme ? "evening" : "morning");
      return isDarkTheme
        ? {
            mode,
            isDarkTheme,
            floor: 0xf0d4ad,
            wall: 0xe7d8c5,
            wood: 0x8f6947,
            woodEdge: 0x6f4b2f,
            stone: 0x8a7d6b,
            stoneEdge: 0x5d5246,
            coffee: 0x58351f,
            ceramic: 0xf5eadb,
            recordBase: 0xc6b89e,
            metal: 0x7d817e,
            cardEdge: 0x213133,
            shadow: 0x0a1112,
            shadowOpacity: 0.085,
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
            stone: 0xd8cab7,
            stoneEdge: 0xad9c88,
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
      activeGroup.rotation.x = 0;
      activeGroup.rotation.y = 0;
      const yawBase = activeView === "outside" ? outsideDefaultRotation.y : defaultRotation.y;
      const yaw = (((rotationY - yawBase) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const rearView = yaw > Math.PI * 0.62 && yaw < Math.PI * 1.38;
      const isYawInRange = (start, end) => (start <= end ? yaw >= start && yaw <= end : yaw >= start || yaw <= end);
      orbitOcclusionItems.forEach((item) => {
        if (!item?.material) return;
        const inRange = item.yawStart === undefined ? rearView : isYawInRange(item.yawStart, item.yawEnd);
        const targetOpacity = item.entry && item.entry === focusedEntry ? item.baseOpacity : inRange ? item.occludedOpacity : item.baseOpacity;
        if (item.object && item.hideBelow !== undefined) item.object.visible = targetOpacity > item.hideBelow;
        item.material.opacity += (targetOpacity - item.material.opacity) * (immediate || reduceMotion ? 1 : 0.22);
      });
      photoVisibilityItems.forEach((item) => {
        if (!item?.entry?.group) return;
        item.entry.group.visible = focusedEntry === item.entry || isYawInRange(item.yawStart, item.yawEnd);
      });
    };

    const updateWindowJumpVisibility = () => {
      if (!windowJumpGroup) return;
      const shouldShow = activeView === "desk" && Math.max(zoomLevel, targetZoomLevel) > 0.22;
      if (windowJumpGroup.visible !== shouldShow) {
        windowJumpGroup.visible = shouldShow;
        render();
      }
    };

    const isPointerInWindowRegion = (event) => {
      if (!renderer) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      return x > 0.52 && x < 1.02 && y > 0.03 && y < 0.74;
    };

    const isPointerInOutsideReturnRegion = (event) => {
      if (!renderer) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      return x > 0.34 && x < 0.72 && y > 0.22 && y < 0.68;
    };

    const isPointerInFocusedAlbumInspectRegion = (event) => {
      if (focusedEntry?.kind !== "album" || !renderer) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      return (
        x > (isCompactScene ? 0.18 : 0.24) &&
        x < (isCompactScene ? 0.76 : 0.68) &&
        y > (isCompactScene ? 0.46 : 0.5) &&
        y < (isCompactScene ? 0.95 : 0.96)
      );
    };

    const copyAnchorVector = (anchor) => new THREE.Vector3(anchor.x, anchor.y, anchor.z);

    const setInteriorLookCamera = (baseCamera, baseTarget, yaw, pitch, zoom) => {
      const boundedPitch = clampRoomPitch(pitch);
      const offset = baseTarget.clone().sub(baseCamera);
      const planarRadius = Math.max(0.9, Math.hypot(offset.x, offset.z));
      const baseAngle = Math.atan2(offset.x, offset.z);
      const yawDelta = yaw - defaultRotation.y;
      const pitchDelta = boundedPitch - defaultRotation.x;
      const lookRadius = planarRadius * (1 - zoom * 0.08);
      const vertical = offset.y + pitchDelta * 2.45 * (1 - zoom * 0.24);
      camera.position.copy(baseCamera);
      camera.lookAt(
        baseCamera.x + Math.sin(baseAngle + yawDelta) * lookRadius,
        baseCamera.y + vertical,
        baseCamera.z + Math.cos(baseAngle + yawDelta) * lookRadius
      );
    };

    const setOrbitCamera = (view, baseCamera, baseTarget, yaw, pitch, zoom) => {
      const defaultYaw = view === "outside" ? outsideDefaultRotation.y : defaultRotation.y;
      const defaultPitch = view === "outside" ? outsideDefaultRotation.x : defaultRotation.x;
      const offset = baseCamera.clone().sub(baseTarget);
      const planarRadius = Math.max(0.001, Math.hypot(offset.x, offset.z));
      const baseAngle = Math.atan2(offset.x, offset.z);
      const yawDelta = yaw - defaultYaw;
      const pitchDelta = pitch - defaultPitch;
      const vertical = offset.y + pitchDelta * (view === "outside" ? 3.15 : 3.7) * (1 - zoom * 0.34);
      const radius = planarRadius * (1 - Math.min(0.34, Math.abs(pitchDelta) * 0.18));
      camera.position.set(
        baseTarget.x + Math.sin(baseAngle + yawDelta) * radius,
        baseTarget.y + vertical,
        baseTarget.z + Math.cos(baseAngle + yawDelta) * radius
      );
      camera.lookAt(baseTarget);
    };

    const applyCameraPose = (immediate = false) => {
      if (!camera) return false;
      const speed = immediate || reduceMotion ? 1 : 0.18;
      zoomLevel += (targetZoomLevel - zoomLevel) * speed;
      if (immediate || reduceMotion) zoomLevel = targetZoomLevel;

      if (activeView === "outside") {
        const zoom = easeOutCubic(zoomLevel);
        const defaultCamera = isCompactScene ? sceneAnchors.outside.defaultCamera.compact : sceneAnchors.outside.defaultCamera.desktop;
        const zoomCamera = isCompactScene ? sceneAnchors.outside.zoomCamera.compact : sceneAnchors.outside.zoomCamera.desktop;
        const target = sceneAnchors.outside.orbitTarget;
        const baseCamera = copyAnchorVector({
          x: lerp(defaultCamera.x, zoomCamera.x, zoom),
          y: lerp(defaultCamera.y, zoomCamera.y, zoom),
          z: lerp(defaultCamera.z, zoomCamera.z, zoom),
        });
        const baseTarget = copyAnchorVector({
          x: lerp(target.x, sceneAnchors.outside.house.x, zoom),
          y: lerp(target.y, sceneAnchors.outside.window.y, zoom),
          z: lerp(target.z, sceneAnchors.outside.house.z, zoom),
        });
        camera.fov = lerp(isCompactScene ? 40 : 35, isCompactScene ? 31 : 28, zoom);
        setOrbitCamera("outside", baseCamera, baseTarget, rotationY, rotationX, zoom);
      } else {
        const zoom = easeOutCubic(zoomLevel);
        if (focusedEntry?.kind === "album") {
          camera.fov = lerp(isCompactScene ? 36 : 32, isCompactScene ? 27 : 24, zoom);
          camera.position.set(
            lerp(isCompactScene ? 2.74 : 3.26, isCompactScene ? -0.24 : -0.48, zoom),
            lerp(isCompactScene ? 2.12 : 2.2, isCompactScene ? 3.05 : 3.28, zoom),
            lerp(isCompactScene ? 6.18 : 6.42, isCompactScene ? 1.64 : 1.72, zoom)
          );
          camera.lookAt(lerp(isCompactScene ? -0.1 : -0.16, isCompactScene ? -0.82 : -0.98, zoom), lerp(-0.04, -0.08, zoom), lerp(0.02, 0.08, zoom));
        } else if (focusedEntry?.kind === "artifact") {
          camera.fov = lerp(isCompactScene ? 35 : 31, isCompactScene ? 31 : 29, zoom);
          camera.position.set(
            lerp(isCompactScene ? 3.05 : 3.7, isCompactScene ? 2.42 : 2.7, zoom),
            lerp(isCompactScene ? 2.15 : 2.22, isCompactScene ? 1.72 : 1.84, zoom),
            lerp(isCompactScene ? 6.55 : 6.85, isCompactScene ? 4.38 : 4.68, zoom)
          );
          camera.lookAt(isCompactScene ? -0.04 : 0.02, 0.34, 0.16);
        } else if (focusedEntry?.kind === "photo") {
          const pose = (isCompactScene ? focusedEntry.compactCamera : focusedEntry.camera) || focusedEntry.camera || {};
          const fromPosition = pose.from || (isCompactScene ? sceneAnchors.room.defaultCamera.compact : sceneAnchors.room.defaultCamera.desktop);
          const toPosition = pose.to || fromPosition;
          const fromTarget = pose.lookFrom || sceneAnchors.room.orbitTarget;
          const toTarget = pose.lookAt || focusedEntry.focusLookAt || sceneAnchors.room.orbitTarget;
          camera.fov = lerp(pose.fovFrom || (isCompactScene ? 36 : 31), pose.fovTo || (isCompactScene ? 28 : 24), zoom);
          camera.position.set(
            lerp(fromPosition.x, toPosition.x, zoom),
            lerp(fromPosition.y, toPosition.y, zoom),
            lerp(fromPosition.z, toPosition.z, zoom)
          );
          camera.lookAt(lerp(fromTarget.x, toTarget.x, zoom), lerp(fromTarget.y, toTarget.y, zoom), lerp(fromTarget.z, toTarget.z, zoom));
        } else {
          const defaultCamera = isCompactScene ? sceneAnchors.room.defaultCamera.compact : sceneAnchors.room.defaultCamera.desktop;
          const zoomCamera = isCompactScene ? sceneAnchors.room.zoomCamera.compact : sceneAnchors.room.zoomCamera.desktop;
          const target = sceneAnchors.room.orbitTarget;
          const baseCamera = copyAnchorVector({
            x: lerp(defaultCamera.x, zoomCamera.x, zoom),
            y: lerp(defaultCamera.y, zoomCamera.y, zoom),
            z: lerp(defaultCamera.z, zoomCamera.z, zoom),
          });
          const zoomTarget = sceneAnchors.room.zoomTarget;
          const baseTarget = copyAnchorVector({
            x: lerp(target.x, zoomTarget.x, zoom),
            y: lerp(target.y, zoomTarget.y, zoom),
            z: lerp(target.z, zoomTarget.z, zoom),
          });
          camera.fov = lerp(isCompactScene ? 61 : 56, isCompactScene ? 48 : 44, zoom);
          setInteriorLookCamera(baseCamera, baseTarget, rotationY, rotationX, zoom);
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

    const makeRepeatingCanvasTexture = (draw, width, height, repeatX = 1, repeatY = 1) => {
      const texture = makeCanvasTexture(draw, width, height);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
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

    const createWindowHintTexture = (palette) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          context.fillStyle = palette.isDarkTheme ? "rgba(255,235,205,0.56)" : "rgba(82,57,34,0.54)";
          context.font = "700 24px Inter, system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("click window to go outside", width * 0.5, height * 0.52);
          context.strokeStyle = palette.isDarkTheme ? "rgba(255,214,162,0.28)" : "rgba(150,103,58,0.2)";
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(width * 0.26, height * 0.72);
          context.bezierCurveTo(width * 0.38, height * 0.8, width * 0.62, height * 0.66, width * 0.74, height * 0.72);
          context.stroke();
        },
        520,
        96
      );

    const createRoomFloorTexture = (palette) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          const base = context.createLinearGradient(0, 0, width, height);
          base.addColorStop(0, isEvening ? "#5a4532" : "#f8f0e7");
          base.addColorStop(0.58, isEvening ? "#3f342b" : "#efe0d0");
          base.addColorStop(1, isEvening ? "#272824" : "#e5d1bd");
          context.fillStyle = base;
          context.fillRect(0, 0, width, height);

          const lampGlow = context.createRadialGradient(width * 0.64, height * 0.36, 0, width * 0.64, height * 0.36, width * 0.68);
          lampGlow.addColorStop(0, isEvening ? "rgba(255,211,145,0.2)" : "rgba(255,246,226,0.32)");
          lampGlow.addColorStop(0.48, isEvening ? "rgba(206,143,82,0.08)" : "rgba(223,168,101,0.11)");
          lampGlow.addColorStop(1, "rgba(0,0,0,0)");
          context.fillStyle = lampGlow;
          context.fillRect(0, 0, width, height);

          context.strokeStyle = isEvening ? "rgba(255,226,187,0.16)" : "rgba(126,88,55,0.105)";
          context.lineWidth = 2;
          for (let y = 36; y < height; y += 58) {
            context.beginPath();
            context.moveTo(0, y + Math.sin(y * 0.05) * 2);
            context.bezierCurveTo(width * 0.28, y - 5, width * 0.66, y + 6, width, y - 1);
            context.stroke();
          }

          context.strokeStyle = isEvening ? "rgba(255,231,197,0.09)" : "rgba(141,99,62,0.06)";
          context.lineWidth = 1;
          for (let x = 42; x < width; x += 112) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x + Math.sin(x) * 3, height);
            context.stroke();
          }

          context.fillStyle = isEvening ? "rgba(255,226,186,0.08)" : "rgba(121,81,48,0.055)";
          for (let index = 0; index < 34; index += 1) {
            const x = (index * 83) % width;
            const y = 20 + ((index * 47) % (height - 40));
            context.beginPath();
            context.ellipse(x, y, 9 + (index % 4) * 3, 1.4, (index % 5) * 0.18, 0, Math.PI * 2);
            context.fill();
          }
        },
        512,
        384,
        1.45,
        1.1
      );

    const createRoomWallTexture = (palette) =>
      makeCanvasTexture((context, width, height) => {
        const isEvening = palette.mode === "evening" || palette.isDarkTheme;
        const base = context.createLinearGradient(0, 0, width, height);
        base.addColorStop(0, isEvening ? "#152328" : "#fffaf2");
        base.addColorStop(0.52, isEvening ? "#101c20" : "#fbf0e3");
        base.addColorStop(1, isEvening ? "#0e191c" : "#f0dfcc");
        context.fillStyle = base;
        context.fillRect(0, 0, width, height);

        const windowGlow = context.createRadialGradient(width * 0.73, height * 0.32, 0, width * 0.73, height * 0.32, width * 0.44);
        windowGlow.addColorStop(0, isEvening ? "rgba(255,205,138,0.18)" : "rgba(255,224,169,0.28)");
        windowGlow.addColorStop(0.62, isEvening ? "rgba(126,86,52,0.08)" : "rgba(204,139,82,0.08)");
        windowGlow.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = windowGlow;
        context.fillRect(0, 0, width, height);

        context.strokeStyle = isEvening ? "rgba(255,231,196,0.055)" : "rgba(132,89,54,0.055)";
        context.lineWidth = 1.5;
        for (let x = 54; x < width; x += 92) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x + Math.sin(x * 0.08) * 4, height);
          context.stroke();
        }

        context.strokeStyle = isEvening ? "rgba(255,232,196,0.065)" : "rgba(132,89,54,0.06)";
        context.lineWidth = 1;
        for (let y = 58; y < height; y += 72) {
          context.beginPath();
          context.moveTo(0, y);
          context.bezierCurveTo(width * 0.28, y - 3, width * 0.68, y + 4, width, y);
          context.stroke();
        }

        context.fillStyle = isEvening ? "rgba(0,0,0,0.08)" : "rgba(99,61,34,0.025)";
        context.fillRect(0, height * 0.74, width, height * 0.26);
      });

    const createMugMarkTexture = (palette) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          context.fillStyle = palette.isDarkTheme ? "rgba(24,35,38,0.9)" : "rgba(47,54,55,0.84)";
          context.font = "820 106px Inter, system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("Autodesk", width * 0.5, height * 0.47);
          context.strokeStyle = palette.isDarkTheme ? "rgba(24,35,38,0.42)" : "rgba(47,54,55,0.34)";
          context.lineWidth = 6;
          context.beginPath();
          context.moveTo(width * 0.32, height * 0.74);
          context.lineTo(width * 0.68, height * 0.74);
          context.stroke();
        },
        768,
        192
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

        context.fillStyle = isEvening ? "rgba(47,58,49,0.58)" : "rgba(150,131,96,0.46)";
        context.beginPath();
        context.moveTo(0, height * 0.86);
        context.quadraticCurveTo(width * 0.1, height * 0.76, width * 0.24, height * 0.8);
        context.quadraticCurveTo(width * 0.36, height * 0.84, width * 0.48, height * 0.78);
        context.lineTo(width * 0.58, height);
        context.lineTo(0, height);
        context.closePath();
        context.fill();

        context.fillStyle = isEvening ? "#2b332b" : "#8d7b5c";
        context.beginPath();
        context.moveTo(width * 0.68, height);
        context.lineTo(width, height);
        context.lineTo(width, height * 0.5);
        context.lineTo(width * 0.95, height * 0.53);
        context.quadraticCurveTo(width * 0.9, height * 0.56, width * 0.84, height * 0.66);
        context.quadraticCurveTo(width * 0.77, height * 0.78, width * 0.75, height * 0.9);
        context.quadraticCurveTo(width * 0.72, height * 0.96, width * 0.68, height);
        context.fill();
        context.save();
        context.beginPath();
        context.moveTo(width * 0.68, height);
        context.lineTo(width, height);
        context.lineTo(width, height * 0.5);
        context.lineTo(width * 0.95, height * 0.53);
        context.quadraticCurveTo(width * 0.9, height * 0.56, width * 0.84, height * 0.66);
        context.quadraticCurveTo(width * 0.77, height * 0.78, width * 0.75, height * 0.9);
        context.quadraticCurveTo(width * 0.72, height * 0.96, width * 0.68, height);
        context.clip();
        context.fillStyle = isEvening ? "rgba(18,24,21,0.18)" : "rgba(95,76,51,0.2)";
        [
          [
            [0.74, 0.62],
            [0.98, 0.49],
            [1.02, 0.64],
            [0.84, 0.72],
          ],
          [
            [0.7, 0.8],
            [0.86, 0.7],
            [1.02, 0.76],
            [1.02, 0.92],
            [0.66, 0.94],
          ],
          [
            [0.82, 0.55],
            [0.96, 0.46],
            [1.02, 0.5],
            [0.91, 0.58],
          ],
        ].forEach((points) => {
          context.beginPath();
          points.forEach(([x, y], index) => {
            const px = width * x;
            const py = height * y;
            if (index === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
          });
          context.closePath();
          context.fill();
        });
        context.strokeStyle = isEvening ? "rgba(226,204,164,0.22)" : "rgba(244,213,160,0.36)";
        context.lineWidth = 3;
        [0.58, 0.67, 0.77, 0.87].forEach((lineY, row) => {
          context.beginPath();
          context.moveTo(width * (0.7 - row * 0.025), height * lineY);
          context.bezierCurveTo(width * 0.78, height * (lineY - 0.04), width * 0.9, height * (lineY + 0.04), width * 1.02, height * (lineY - 0.02));
          context.stroke();
        });
        context.restore();

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

    const createOceanSurfaceTexture = (palette) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          const water = context.createLinearGradient(0, 0, width, height);
          water.addColorStop(0, isEvening ? "#1a4657" : "#3197bd");
          water.addColorStop(0.52, isEvening ? "#133342" : "#5bc0d9");
          water.addColorStop(1, isEvening ? "#0d2633" : "#9bd7e5");
          context.fillStyle = water;
          context.fillRect(0, 0, width, height);

          for (let row = 0; row < 9; row += 1) {
            const y = 26 + row * 29;
            const alpha = isEvening ? 0.34 + (row % 3) * 0.04 : 0.42 + (row % 2) * 0.05;
            context.strokeStyle = `rgba(255,255,255,${alpha})`;
            context.lineWidth = row % 3 === 0 ? 3 : 2;
            context.beginPath();
            context.moveTo(-32, y);
            for (let x = -32; x <= width + 40; x += 64) {
              const crest = y + Math.sin((x + row * 31) * 0.036) * (row % 2 ? 8 : 5);
              context.quadraticCurveTo(x + 30, crest - 12, x + 64, crest);
            }
            context.stroke();
          }

          context.strokeStyle = isEvening ? "rgba(141,196,210,0.26)" : "rgba(231,252,255,0.34)";
          context.lineWidth = 1.4;
          for (let row = 0; row < 5; row += 1) {
            const y = 18 + row * 42;
            context.beginPath();
            context.moveTo(-18, y + 6);
            for (let x = -18; x <= width + 36; x += 52) {
              context.bezierCurveTo(x + 16, y - 4, x + 34, y + 16, x + 52, y + 4);
            }
            context.stroke();
          }

          context.fillStyle = isEvening ? "rgba(255,241,201,0.18)" : "rgba(255,255,255,0.2)";
          for (let index = 0; index < 34; index += 1) {
            const x = (index * 47) % width;
            const y = 18 + ((index * 71) % (height - 36));
            context.beginPath();
            context.ellipse(x, y, 10 + (index % 5) * 4, 1.4, (index % 4) * 0.24, 0, Math.PI * 2);
            context.fill();
          }
        },
        512,
        256,
        1.6,
        1.2
      );

    const createFoamSurfaceTexture = (palette) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          for (let row = 0; row < 5; row += 1) {
            context.strokeStyle = isEvening ? `rgba(246,233,203,${0.48 - row * 0.055})` : `rgba(255,255,255,${0.58 - row * 0.065})`;
            context.lineWidth = row === 0 ? 5.6 : row === 1 ? 4 : 2.4;
            context.beginPath();
            const y = 18 + row * 15;
            context.moveTo(-24, y);
            for (let x = -24; x <= width + 32; x += 56) {
              context.quadraticCurveTo(x + 20, y - 10 + row * 2, x + 38, y + Math.sin((x + row * 17) * 0.032) * 5);
              context.quadraticCurveTo(x + 48, y + 9 - row, x + 56, y + Math.sin(x * 0.03) * 4);
            }
            context.stroke();
          }
          context.fillStyle = isEvening ? "rgba(246,233,203,0.34)" : "rgba(255,255,255,0.34)";
          for (let index = 0; index < 30; index += 1) {
            context.beginPath();
            context.arc((index * 37) % width, 18 + ((index * 23) % (height - 28)), 1.5 + (index % 3), 0, Math.PI * 2);
            context.fill();
          }
          context.globalAlpha = isEvening ? 0.22 : 0.3;
          context.fillStyle = "#ffffff";
          for (let index = 0; index < 10; index += 1) {
            context.beginPath();
            context.ellipse((index * 83) % width, 36 + ((index * 31) % 34), 16 + (index % 4) * 6, 2.2, -0.16 + index * 0.05, 0, Math.PI * 2);
            context.fill();
          }
          context.globalAlpha = 1;
        },
        384,
        96,
        1.4,
        1
      );

    const createSandSurfaceTexture = (palette) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          const sand = context.createLinearGradient(0, 0, width, height);
          sand.addColorStop(0, isEvening ? "#c4a67a" : "#f1d9aa");
          sand.addColorStop(0.34, isEvening ? "#b89a70" : "#eed2a0");
          sand.addColorStop(0.66, isEvening ? "#958064" : "#d5b07c");
          sand.addColorStop(1, isEvening ? "#6f5d47" : "#b88958");
          context.fillStyle = sand;
          context.fillRect(0, 0, width, height);

          const wet = context.createLinearGradient(0, 0, width, 0);
          wet.addColorStop(0, isEvening ? "rgba(69,94,102,0.26)" : "rgba(100,184,200,0.22)");
          wet.addColorStop(0.45, isEvening ? "rgba(238,216,176,0.16)" : "rgba(255,250,224,0.28)");
          wet.addColorStop(1, "rgba(255,255,255,0)");
          context.fillStyle = wet;
          context.fillRect(0, 0, width, height);

          for (let index = 0; index < 130; index += 1) {
            const x = (index * 29) % width;
            const y = (index * 47) % height;
            context.fillStyle =
              index % 3
                ? isEvening
                  ? "rgba(255,235,188,0.1)"
                  : "rgba(255,255,246,0.22)"
                : isEvening
                  ? "rgba(71,55,38,0.15)"
                  : "rgba(129,89,49,0.12)";
            context.beginPath();
            context.arc(x, y, 0.8 + (index % 4) * 0.28, 0, Math.PI * 2);
            context.fill();
          }

          context.strokeStyle = isEvening ? "rgba(255,238,199,0.22)" : "rgba(255,255,255,0.36)";
          context.lineWidth = 2;
          [24, 54, 86, 122].forEach((y, row) => {
            context.beginPath();
            context.moveTo(-18, y);
            for (let x = -18; x <= width + 24; x += 72) {
              context.quadraticCurveTo(x + 34, y + (row % 2 ? 4 : -5), x + 72, y + Math.sin((x + row * 31) * 0.04) * 1.8);
            }
            context.stroke();
          });
        },
        512,
        160,
        1.8,
        1
      );

    const createSandGustTexture = (palette) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          const palePrefix = isEvening ? "rgba(255,230,184," : "rgba(255,255,245,";
          const warmPrefix = isEvening ? "rgba(197,155,100," : "rgba(183,125,64,";
          for (let row = 0; row < 7; row += 1) {
            const y = 16 + row * 18;
            context.strokeStyle = `${row % 2 ? warmPrefix : palePrefix}${row % 2 ? 0.1 : 0.18})`;
            context.lineWidth = row % 3 === 0 ? 3.2 : 1.8;
            context.beginPath();
            context.moveTo(-42, y);
            for (let x = -42; x <= width + 60; x += 90) {
              const sway = Math.sin((x + row * 37) * 0.022) * 9;
              context.bezierCurveTo(x + 24, y - 8 + sway, x + 58, y + 10 - sway * 0.4, x + 90, y + Math.sin(x * 0.018) * 3);
            }
            context.stroke();
          }
          context.fillStyle = isEvening ? "rgba(255,236,190,0.16)" : "rgba(255,255,255,0.22)";
          for (let index = 0; index < 54; index += 1) {
            const x = (index * 53) % width;
            const y = 8 + ((index * 31) % (height - 16));
            context.beginPath();
            context.ellipse(x, y, 1.8 + (index % 4) * 0.8, 0.7, (index % 5) * 0.24, 0, Math.PI * 2);
            context.fill();
          }
        },
        512,
        128,
        1.4,
        1
      );

    const createCliffSurfaceTexture = (palette, face = false) =>
      makeRepeatingCanvasTexture(
        (context, width, height) => {
          const isEvening = palette.mode === "evening" || palette.isDarkTheme;
          const base = context.createLinearGradient(0, 0, width, height);
          base.addColorStop(0, isEvening ? "#85745a" : "#cfb384");
          base.addColorStop(0.56, isEvening ? "#6d604a" : "#b79c72");
          base.addColorStop(1, isEvening ? "#5a4e3c" : "#957b59");
          context.fillStyle = base;
          context.fillRect(0, 0, width, height);

          context.globalAlpha = face ? 0.24 : 0.18;
          context.strokeStyle = isEvening ? "#d2b98d" : "#f0d09a";
          context.lineWidth = face ? 4 : 3;
          for (let row = 0; row < 7; row += 1) {
            const y = 18 + row * 28;
            context.beginPath();
            context.moveTo(-24, y);
            for (let x = -24; x <= width + 32; x += 74) {
              context.quadraticCurveTo(x + 34, y - 10 + ((row + x) % 3) * 5, x + 74, y + Math.sin((x + row) * 0.03) * 5);
            }
            context.stroke();
          }

          context.globalAlpha = 1;
          for (let index = 0; index < 90; index += 1) {
            const x = (index * 43) % width;
            const y = (index * 59) % height;
            context.fillStyle =
              index % 3 === 0
                ? isEvening
                  ? "rgba(35,29,22,0.2)"
                  : "rgba(78,55,35,0.18)"
                : isEvening
                  ? "rgba(235,207,156,0.11)"
                  : "rgba(255,232,178,0.18)";
            context.beginPath();
            context.ellipse(x, y, 2.8 + (index % 4), 1.1 + (index % 3) * 0.35, (index % 5) * 0.4, 0, Math.PI * 2);
            context.fill();
          }
        },
        512,
        224,
        face ? 1.2 : 1.5,
        face ? 1.35 : 1
      );

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
      makeCanvasTexture(
        (context, width, height) => {
          const accent = index === 0 ? "#6f9d87" : "#6f98ad";
          context.clearRect(0, 0, width, height);
          drawRoundedRect(context, 24, 18, width - 48, height - 36, 18);
          const paper = context.createLinearGradient(0, 0, width, height);
          paper.addColorStop(0, "#fffefd");
          paper.addColorStop(1, "#f4eddf");
          context.fillStyle = paper;
          context.fill();
          context.lineWidth = 5;
          context.strokeStyle = index === 0 ? "rgba(111,157,135,0.28)" : "rgba(111,152,173,0.28)";
          context.stroke();

          context.save();
          context.strokeStyle = "rgba(80,96,100,0.14)";
          context.lineWidth = 2;
          for (let line = 124; line < height - 72; line += 34) {
            context.beginPath();
            context.moveTo(52, line + (index ? 3 : -2));
            context.bezierCurveTo(width * 0.32, line - 8, width * 0.66, line + 7, width - 64, line - 2);
            context.stroke();
          }
          context.strokeStyle = index === 0 ? "rgba(111,157,135,0.34)" : "rgba(111,152,173,0.34)";
          context.lineWidth = 6;
          context.beginPath();
          context.arc(width - 100, 108, 48, 0.18, Math.PI * 1.78);
          context.stroke();
          context.beginPath();
          context.moveTo(width - 166, 178);
          context.bezierCurveTo(width - 116, 132, width - 68, 218, width - 36, 166);
          context.stroke();
          context.strokeStyle = "rgba(45,58,62,0.28)";
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(62, height - 136);
          context.lineTo(92, height - 104);
          context.lineTo(128, height - 148);
          context.stroke();
          context.restore();

          context.fillStyle = accent;
          context.globalAlpha = 0.14;
          context.beginPath();
          context.arc(width - 116, 106, 78, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 1;
          context.fillStyle = "#66727a";
          context.font = "800 38px Comic Sans MS, Segoe Print, cursive";
          context.fillText(artifact.label || "Desk card", 58, 94);
          context.fillStyle = "#181d20";
          context.font = "900 52px Comic Sans MS, Segoe Print, cursive";
          drawWrappedText(context, artifact.title || "Research card", 58, 176, width - 116, 58, 4);
        },
        420,
        594
      );

    const createSongCardTexture = (record) =>
      makeCanvasTexture(
        (context, width, height) => {
          context.clearRect(0, 0, width, height);
          drawRoundedRect(context, 16, 18, width - 32, height - 36, 30);
          const card = context.createLinearGradient(0, 0, width, height);
          card.addColorStop(0, "#fffaf0");
          card.addColorStop(0.58, "#f7ead6");
          card.addColorStop(1, "#e9d2b4");
          context.fillStyle = card;
          context.fill();
          context.strokeStyle = "rgba(138,92,49,0.3)";
          context.lineWidth = 4;
          context.stroke();

          context.save();
          context.globalAlpha = 0.24;
          context.fillStyle = "#9e6f44";
          context.beginPath();
          context.arc(width - 72, 70, 54, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 0.16;
          context.fillStyle = "#ffffff";
          context.fillRect(42, 54, 132, 132);
          context.globalAlpha = 1;
          context.strokeStyle = "rgba(93,66,42,0.18)";
          context.lineWidth = 3;
          context.strokeRect(42, 54, 132, 132);
          context.fillStyle = "rgba(255,255,255,0.5)";
          context.fillRect(42, 202, width - 86, 1.6);
          context.fillStyle = "rgba(115,78,45,0.13)";
          for (let index = 0; index < 18; index += 1) {
            context.beginPath();
            context.ellipse(210 + ((index * 37) % 260), 74 + ((index * 31) % 210), 10 + (index % 4) * 3, 1.4, index * 0.18, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();

          context.fillStyle = "#8d6847";
          context.font = "800 28px Inter, system-ui, sans-serif";
          context.fillText("album shake card", 204, 78);
          context.fillStyle = "#202528";
          context.font = "820 42px Inter, system-ui, sans-serif";
          drawWrappedText(context, record.title, 204, 132, width - 238, 46, 3);
          context.fillStyle = "#5f686b";
          context.font = "700 27px Inter, system-ui, sans-serif";
          context.fillText(record.artist || "Sirui Tao", 204, height - 52);
        },
        560,
        360
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

    const addBeveledBox = (group, size, position, material, options = {}) => {
      if (!THREE.Shape || !THREE.ExtrudeGeometry) return addBox(group, size, position, material);
      const bevel = options.bevel ?? Math.min(size.x, size.y, size.z) * 0.16;
      const shape = new THREE.Shape();
      shape.moveTo(-size.x / 2, -size.y / 2);
      shape.lineTo(size.x / 2, -size.y / 2);
      shape.lineTo(size.x / 2, size.y / 2);
      shape.lineTo(-size.x / 2, size.y / 2);
      shape.lineTo(-size.x / 2, -size.y / 2);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: size.z,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: options.segments ?? 1,
      });
      geometry.translate(0, 0, -size.z / 2);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);
      group.add(mesh);
      return mesh;
    };

    const addCurvedShell = (group, radius, height, thetaStart, thetaLength, position, material, options = {}) => {
      const geometry = new THREE.CylinderGeometry(radius, radius, height, options.radialSegments || 48, 1, true, thetaStart, thetaLength);
      geometry.scale(options.scaleX || 1, 1, options.scaleZ || 1);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);
      mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
      group.add(mesh);
      return mesh;
    };

    const registerOrbitCutaway = (mesh, options = {}) => {
      if (!mesh?.material) return mesh;
      if (options.cloneMaterial !== false) mesh.material = mesh.material.clone();
      mesh.material.transparent = true;
      mesh.material.opacity = options.baseOpacity ?? mesh.material.opacity ?? 1;
      orbitOcclusionItems.push({
        object: mesh,
        material: mesh.material,
        entry: options.entry || null,
        baseOpacity: mesh.material.opacity,
        occludedOpacity: options.occludedOpacity ?? 0.06,
        hideBelow: options.hideBelow,
        yawStart: options.yawStart ?? 0.18,
        yawEnd: options.yawEnd ?? Math.PI * 2 - 0.18,
      });
      return mesh;
    };

    const createFramedPhotoEntry = (parent, config, materials) => {
      const frame = config.frame ?? 0.08;
      const depth = config.depth ?? 0.05;
      const outerWidth = config.width + frame * 2;
      const outerHeight = config.height + frame * 2;
      const entry = {
        kind: "photo",
        id: config.id,
        src: config.src,
        index: photoEntries.length,
        group: new THREE.Group(),
        lifted: false,
        camera: config.camera,
        compactCamera: config.compactCamera,
        focusLookAt: config.focusLookAt,
        focusPosition: config.focusPosition,
        compactFocusPosition: config.compactFocusPosition,
        focusRotation: config.focusRotation,
        compactFocusRotation: config.compactFocusRotation,
        focusScale: config.focusScale || new THREE.Vector3(1.04, 1.04, 1.04),
        targetRotationX: config.targetRotationX,
        targetRotationY: config.targetRotationY,
      };

      entry.group.position.set(config.position.x, config.position.y, config.position.z);
      entry.group.rotation.set(config.rotation?.x || 0, config.rotation?.y || 0, config.rotation?.z || 0);
      entry.group.scale.setScalar(config.scale || 1);
      entry.basePosition = entry.group.position.clone();
      entry.baseRotation = entry.group.rotation.clone();
      entry.baseScale = entry.group.scale.clone();
      entry.currentRestY = entry.basePosition.y;
      parent.add(entry.group);

      const meshes = [];
      const collect = (mesh) => {
        meshes.push(mesh);
        return mesh;
      };
      entry.meshes = meshes;

      collect(
        addBeveledBox(entry.group, { x: outerWidth, y: outerHeight, z: depth }, { x: 0, y: 0, z: -depth * 0.14 }, materials.back, { bevel: 0.012 })
      );
      collect(
        addBeveledBox(entry.group, { x: outerWidth, y: frame, z: depth * 1.28 }, { x: 0, y: outerHeight / 2 - frame / 2, z: 0 }, materials.frame, {
          bevel: 0.014,
        })
      );
      collect(
        addBeveledBox(entry.group, { x: outerWidth, y: frame, z: depth * 1.28 }, { x: 0, y: -outerHeight / 2 + frame / 2, z: 0 }, materials.frame, {
          bevel: 0.014,
        })
      );
      collect(
        addBeveledBox(entry.group, { x: frame, y: outerHeight, z: depth * 1.28 }, { x: -outerWidth / 2 + frame / 2, y: 0, z: 0 }, materials.frame, {
          bevel: 0.014,
        })
      );
      collect(
        addBeveledBox(entry.group, { x: frame, y: outerHeight, z: depth * 1.28 }, { x: outerWidth / 2 - frame / 2, y: 0, z: 0 }, materials.frame, {
          bevel: 0.014,
        })
      );

      const mat = collect(new THREE.Mesh(new THREE.PlaneGeometry(config.width + 0.08, config.height + 0.08), materials.mat));
      mat.position.z = depth * 0.56;
      entry.group.add(mat);

      const imageMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const image = collect(new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.height), imageMaterial));
      image.position.z = depth * 1.34;
      entry.group.add(image);
      entry.imageMesh = image;
      let backImage = null;
      if (config.doubleSidedArt) {
        backImage = collect(
          new THREE.Mesh(
            new THREE.PlaneGeometry(config.width, config.height),
            new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
          )
        );
        backImage.position.z = -depth * 1.72;
        backImage.rotation.y = Math.PI;
        entry.group.add(backImage);
        entry.backImageMesh = backImage;
      }

      const glass = collect(
        new THREE.Mesh(
          new THREE.PlaneGeometry(config.width, config.height),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: config.glassOpacity ?? 0.085,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        )
      );
      glass.position.z = depth * 1.42;
      entry.group.add(glass);

      const sheen = collect(
        new THREE.Mesh(
          new THREE.PlaneGeometry(config.width * 0.34, config.height * 0.92),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: config.sheenOpacity ?? 0.12,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          })
        )
      );
      sheen.position.set(config.width * 0.18, config.height * 0.02, depth * 1.48);
      sheen.rotation.z = -0.18;
      entry.group.add(sheen);

      const cue = collect(
        new THREE.Mesh(
          new THREE.PlaneGeometry(outerWidth + 0.16, outerHeight + 0.16),
          new THREE.MeshBasicMaterial({
            color: materials.cueColor,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        )
      );
      cue.position.z = depth * 1.54;
      cue.visible = false;
      entry.group.add(cue);
      entry.cue = cue;

      if (config.easel) {
        [
          { x: -outerWidth * 0.32, z: -0.052, rz: -0.12 },
          { x: outerWidth * 0.32, z: -0.052, rz: 0.12 },
        ].forEach((leg) => {
          const mesh = collect(
            addBox(entry.group, { x: 0.028, y: outerHeight * 0.72, z: 0.028 }, { x: leg.x, y: -outerHeight * 0.2, z: leg.z }, materials.frame)
          );
          mesh.rotation.z = leg.rz;
        });
        collect(addBox(entry.group, { x: outerWidth * 0.78, y: 0.03, z: 0.08 }, { x: 0, y: -outerHeight * 0.56, z: 0.01 }, materials.frame));
      }

      const hit = new THREE.Mesh(new THREE.PlaneGeometry(outerWidth + 0.22, outerHeight + 0.22), materials.hit);
      hit.position.z = depth * 1.62;
      entry.group.add(hit);
      registerInteractive(hit, { kind: "photo", id: config.id, index: entry.index, projectionObject: hit }, entry);
      registerInteractive(image, { kind: "photo", id: config.id, index: entry.index, projectionObject: hit }, entry);

      if (config.cutawayOptions) {
        meshes.push(hit);
        meshes.forEach((mesh) => registerOrbitCutaway(mesh, { ...config.cutawayOptions, entry }));
      }
      if (config.visibilityOptions) {
        photoVisibilityItems.push({
          entry,
          yawStart: config.visibilityOptions.yawStart,
          yawEnd: config.visibilityOptions.yawEnd,
        });
      }
      loadTexture(config.src, image.material);
      if (backImage) loadTexture(config.src, backImage.material);

      photoEntries.push(entry);
      return entry;
    };

    const addIrregularSlab = (group, points, yTop, height, material) => {
      const positions = [];
      points.forEach(([x, z]) => positions.push(x, yTop, z));
      points.forEach(([x, z]) => positions.push(x, yTop - height, z));

      const indices = [];
      const count = points.length;
      for (let index = 1; index < count - 1; index += 1) indices.push(0, index, index + 1);
      for (let index = 1; index < count - 1; index += 1) indices.push(count, count + index + 1, count + index);
      for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count;
        indices.push(index, next, count + next, index, count + next, count + index);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      return mesh;
    };

    const addTween = (object, to, duration = 520, options = {}) => {
      for (let index = tweens.length - 1; index >= 0; index -= 1) {
        if (tweens[index].object === object) tweens.splice(index, 1);
      }
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
        arcHeight: options.arcHeight || 0,
        wobbleZ: options.wobbleZ || 0,
        easing: options.easing || easeOutCubic,
        onComplete: options.onComplete,
      });
      scheduleFrame();
    };

    const updateTweens = (time) => {
      if (!tweens.length) return false;
      for (let index = tweens.length - 1; index >= 0; index -= 1) {
        const tween = tweens[index];
        const raw = clamp((time - tween.start) / tween.duration, 0, 1);
        const progress = tween.easing(raw);
        const arcY = tween.arcHeight ? Math.sin(raw * Math.PI) * tween.arcHeight : 0;
        const dampedWobbleZ = tween.wobbleZ ? Math.sin(raw * Math.PI * 2.2) * tween.wobbleZ * (1 - raw) : 0;
        tween.object.position.set(
          lerp(tween.fromPosition.x, tween.toPosition.x, progress),
          lerp(tween.fromPosition.y, tween.toPosition.y, progress) + arcY,
          lerp(tween.fromPosition.z, tween.toPosition.z, progress)
        );
        tween.object.rotation.set(
          lerp(tween.fromRotation.x, tween.toRotation.x, progress),
          lerp(tween.fromRotation.y, tween.toRotation.y, progress),
          lerp(tween.fromRotation.z, tween.toRotation.z, progress) + dampedWobbleZ
        );
        tween.object.scale.set(
          lerp(tween.fromScale.x, tween.toScale.x, progress),
          lerp(tween.fromScale.y, tween.toScale.y, progress),
          lerp(tween.fromScale.z, tween.toScale.z, progress)
        );
        if (raw >= 1) {
          tweens.splice(index, 1);
          tween.onComplete?.();
        }
      }
      return tweens.length > 0;
    };

    const registerInteractive = (mesh, data, entry) => {
      mesh.userData = {
        ...mesh.userData,
        ...data,
        kind: data.kind,
        index: data.index,
        url: data.url || "",
        homeDeskInteractive: true,
        homeDeskEntry: entry,
        homeDeskProjectionObject: data.projectionObject || mesh,
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

    const isObjectVisibleForPicking = (object) => {
      let current = object;
      while (current) {
        if (current.visible === false) return false;
        current = current.parent;
      }
      return true;
    };

    const interactionPriority = (kind) => {
      if (kind === "album") return 7;
      if (kind === "turntable") return 6;
      if (kind === "photo") return 5;
      if (kind === "artifact") return 4;
      if (kind === "windowJump" || kind === "returnInside") return 3;
      return 1;
    };

    const projectedInteractiveDistance = (data) => {
      const target = data?.homeDeskProjectionObject || data?.homeDeskEntry?.group;
      if (!THREE || !camera || !target) return Number.POSITIVE_INFINITY;
      if (!projectedHitCenter.vector) projectedHitCenter.vector = new THREE.Vector3();
      target.getWorldPosition(projectedHitCenter.vector);
      projectedHitCenter.vector.project(camera);
      const dx = projectedHitCenter.vector.x - pointerNdc.x;
      const dy = projectedHitCenter.vector.y - pointerNdc.y;
      return dx * dx + dy * dy;
    };

    const pickProjectedRackAlbum = (excludedEntry = null, options = {}) => {
      const threshold = options.threshold ?? (isCompactScene ? 0.042 : 0.032);
      let bestCandidate = null;
      let bestDistance = threshold;

      albumEntries.forEach((entry) => {
        if (!entry || entry === excludedEntry || entry.thrown || entry.rackSlotHit?.visible === false) return;
        const data = entry.rackSlotHit?.userData;
        if (!data || !isObjectVisibleForPicking(entry.rackSlotHit)) return;
        const distance = projectedInteractiveDistance(data);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = data;
        }
      });

      return bestCandidate;
    };

    const pickUpperRackCapAlbum = (excludedEntry = null) => {
      if (!pointerNdc) return null;
      const insideUpperCap =
        pointerNdc.y > (isCompactScene ? 0.42 : 0.46) &&
        pointerNdc.x > (isCompactScene ? -0.62 : -0.48) &&
        pointerNdc.x < (isCompactScene ? 0.18 : 0.08);
      if (!insideUpperCap) return null;
      const exposedEntry = albumEntries
        .filter((entry) => entry && entry !== excludedEntry && !entry.thrown && entry.rackSlotHit?.visible !== false)
        .sort((first, second) => second.index - first.index)[0];
      const data = exposedEntry?.rackSlotHit?.userData;
      return data && isObjectVisibleForPicking(exposedEntry.rackSlotHit) ? data : null;
    };

    const pickActiveRackFaceAlbum = (entry = null) => {
      if (!pointerNdc || !entry || entry.thrown || entry.rackSlotHit?.visible === false) return null;
      const insideRackFace =
        pointerNdc.y > (isCompactScene ? -0.02 : 0.02) &&
        pointerNdc.y < (isCompactScene ? 0.42 : 0.42) &&
        pointerNdc.x > (isCompactScene ? -0.68 : -0.66) &&
        pointerNdc.x < (isCompactScene ? -0.2 : -0.22);
      const data = insideRackFace ? entry.rackSlotHit?.userData : null;
      return data && isObjectVisibleForPicking(entry.rackSlotHit) ? data : null;
    };

    const pickProjectedRackReplacement = () => {
      if (focusedEntry?.kind !== "album") return null;
      return pickProjectedRackAlbum(focusedEntry);
    };

    const pickProjectedFirstUndroppedRackAlbum = () => {
      if (!pointerNdc || focusedEntry?.kind === "album" || droppedRecordIndices.length === 0) return null;
      const insideFirstUndroppedLane =
        pointerNdc.x > (isCompactScene ? -0.42 : -0.38) &&
        pointerNdc.x < (isCompactScene ? -0.16 : -0.18) &&
        pointerNdc.y > (isCompactScene ? 0.18 : 0.2) &&
        pointerNdc.y < (isCompactScene ? 0.42 : 0.38);
      if (!insideFirstUndroppedLane) return null;
      const droppedSet = new Set(droppedRecordIndices);
      const startIndex = Number.isInteger(activeRecordIndex) ? activeRecordIndex : 0;
      for (let step = 0; step < albumEntries.length; step += 1) {
        const index = (startIndex + step) % albumEntries.length;
        if (!droppedSet.has(index)) {
          const entry = albumEntries[index];
          const data = entry?.rackSlotHit?.userData;
          return data && isObjectVisibleForPicking(entry.rackSlotHit) ? data : null;
        }
      }
      return null;
    };

    const pickObject = (event) => {
      if (!raycaster || !pointerNdc || !camera || !renderer) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      const isDroppedPileGuard =
        activeView === "desk" &&
        droppedRecordIndices.length > 0 &&
        !focusedEntry &&
        pointerNdc.x < (isCompactScene ? -0.48 : -0.45) &&
        pointerNdc.y > (isCompactScene ? 0.06 : 0.08) &&
        pointerNdc.y < (isCompactScene ? 0.46 : 0.42);
      if (isDroppedPileGuard) return null;
      raycaster.setFromCamera(pointerNdc, camera);
      const projectedFirstUndropped = pickProjectedFirstUndroppedRackAlbum();
      if (projectedFirstUndropped) return projectedFirstUndropped;
      const hits = raycaster
        .intersectObjects(interactiveObjects, true)
        .map((hit) => ({ hit, data: findInteractiveData(hit.object) }))
        .filter((candidate) => {
          if (!candidate.data || !isObjectVisibleForPicking(candidate.hit.object)) return false;
          if (candidate.data.kind === "album" && candidate.data.homeDeskEntry?.thrown) return false;
          if (candidate.data.kind === "windowJump") {
            return activeView === "desk" && Math.max(zoomLevel, targetZoomLevel) > 0.42;
          }
          if (candidate.data.kind === "returnInside") return activeView === "outside";
          return activeView === "desk";
        });
      const projectedRackReplacement = pickProjectedRackReplacement();
      const activeAlbumEntry = Number.isInteger(activeRecordIndex) ? albumEntries[activeRecordIndex] : null;
      const projectedActiveFace = !focusedEntry && activeAlbumEntry ? pickActiveRackFaceAlbum(activeAlbumEntry) : null;
      const isUpperRackPointer = pointerNdc.y > (isCompactScene ? 0.26 : 0.38);
      const projectedActiveNeighbor =
        !focusedEntry && activeAlbumEntry && isUpperRackPointer
          ? pickUpperRackCapAlbum(activeAlbumEntry) || pickProjectedRackAlbum(activeAlbumEntry, { threshold: isCompactScene ? 0.058 : 0.05 })
          : null;
      if (projectedActiveFace) return projectedActiveFace;
      if (!hits.length) return projectedRackReplacement || projectedActiveNeighbor;
      hits.sort((first, second) => {
        const priorityDelta = interactionPriority(second.data.kind) - interactionPriority(first.data.kind);
        if (priorityDelta) return priorityDelta;
        if (first.data.kind === "album" && second.data.kind === "album" && first.data.homeDeskEntry !== second.data.homeDeskEntry) {
          if (focusedEntry?.kind === "album") {
            const firstRackReplacement = first.data.rackSlot && first.data.homeDeskEntry !== focusedEntry;
            const secondRackReplacement = second.data.rackSlot && second.data.homeDeskEntry !== focusedEntry;
            if (firstRackReplacement !== secondRackReplacement) return firstRackReplacement ? -1 : 1;
          }
          const screenDelta = projectedInteractiveDistance(first.data) - projectedInteractiveDistance(second.data);
          if (Math.abs(screenDelta) > 0.0002) return screenDelta;
        }
        return first.hit.distance - second.hit.distance;
      });
      if (projectedRackReplacement && hits[0].data.kind === "album" && hits[0].data.homeDeskEntry === focusedEntry) {
        return projectedRackReplacement;
      }
      if (projectedActiveNeighbor && hits[0].data.kind === "album" && hits[0].data.homeDeskEntry === activeAlbumEntry) {
        return projectedActiveNeighbor;
      }
      return hits[0].data;
    };

    const setEntryCue = (entry, active) => {
      if (!entry?.cue) return;
      entry.cue.visible = active;
      if (entry.playLedge) entry.playLedge.visible = active;
      if (entry.cue.material) {
        const activeOpacity = entry.kind === "artifact" ? 0.13 : entry.kind === "photo" ? 0.18 : 0.26;
        entry.cue.material.opacity = active ? activeOpacity : 0;
      }
    };

    const setHoverEntry = (entry) => {
      if (hoveredEntry === entry) return;
      if (hoveredEntry && !hoveredEntry.isDragging && hoveredEntry !== focusedEntry) {
        const restY = hoveredEntry.currentRestY ?? hoveredEntry.basePosition?.y;
        if (Number.isFinite(restY)) hoveredEntry.group.position.y = restY;
        setEntryCue(hoveredEntry, false);
      }
      hoveredEntry = entry;
      if (renderer?.domElement) {
        const isButton = entry?.kind === "turntable" || entry?.kind === "windowJump" || entry?.kind === "returnInside" || entry?.kind === "photo";
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

    const setOutsideMotionTexture = (key, texture) => {
      const item = outsideMotionItems.find((motionItem) => motionItem.key === key);
      if (item) item.texture = texture;
    };

    const applyCoastalShaderPalette = (material, palette, variant = "foam") => {
      if (!material?.uniforms) return;
      const isFoam = variant === "foam";
      material.uniforms.uOpacity.value = isFoam ? (palette.isDarkTheme ? 0.42 : 0.5) : palette.isDarkTheme ? 0.2 : 0.24;
      material.uniforms.uColorA.value.setHex(isFoam ? (palette.isDarkTheme ? 0xe7fbff : 0xffffff) : palette.isDarkTheme ? 0xffdfaa : 0xfff3ca);
      material.uniforms.uColorB.value.setHex(isFoam ? (palette.isDarkTheme ? 0x94d4e6 : 0xbff5ff) : palette.isDarkTheme ? 0xd6a56d : 0xf0c987);
      material.uniforms.uBandOffset.value = isFoam ? 0.24 : 0.36;
      material.uniforms.uBandSpread.value = isFoam ? 0.24 : 0.18;
      if (material.uniforms.uWetReach) material.uniforms.uWetReach.value = isFoam ? 0.16 : 0.28;
      material.needsUpdate = true;
    };

    const createCoastalShaderMaterial = (palette, variant = "foam") => {
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.4 },
          uColorA: { value: new THREE.Color(0xffffff) },
          uColorB: { value: new THREE.Color(0xbff5ff) },
          uBandOffset: { value: 0.24 },
          uBandSpread: { value: 0.24 },
          uWetReach: { value: 0.16 },
        },
        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uOpacity;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uBandOffset;
          uniform float uBandSpread;
          uniform float uWetReach;
          varying vec2 vUv;

          float lineBand(float y, float center, float width) {
            return smoothstep(width, 0.0, abs(y - center));
          }

          void main() {
            float x = vUv.x;
            float y = vUv.y;
            float waveFront = uBandOffset + sin((x + uTime * 0.045) * 11.0) * 0.036 + sin((x * 24.0) - uTime * 0.34) * 0.014;
            float backwash = waveFront + uBandSpread + sin(x * 16.0 + uTime * 0.28) * 0.014;
            float crest = lineBand(y, waveFront, 0.034);
            crest += lineBand(y, backwash, 0.022) * 0.6;
            crest += lineBand(y, waveFront + uBandSpread * 1.72, 0.018) * 0.32;

            float wetBand = smoothstep(waveFront - uWetReach, waveFront + 0.015, y) * (1.0 - smoothstep(waveFront + 0.12, waveFront + 0.28, y));
            float ripple = sin((x * 48.0 + y * 17.0) - uTime * 0.82) * 0.5 + sin((x * 19.0 - y * 43.0) + uTime * 0.44) * 0.5;
            float grains = sin(x * 78.0 + y * 41.0 + uTime * 1.55) * sin(x * 31.0 - y * 59.0 - uTime * 1.15);
            float sandLift = smoothstep(0.5, 1.0, ripple) * wetBand * 0.16;
            float sparkle = smoothstep(0.82, 1.0, grains) * (0.12 + wetBand * 0.12);
            float edgeFade = smoothstep(0.02, 0.14, x) * (1.0 - smoothstep(0.86, 1.0, x));
            edgeFade *= smoothstep(0.04, 0.16, y) * (1.0 - smoothstep(0.88, 1.0, y));

            float alpha = clamp((crest + wetBand * 0.28 + sandLift + sparkle) * uOpacity * edgeFade, 0.0, 0.74);
            vec3 wetColor = uColorB * (0.78 + wetBand * 0.14);
            vec3 color = mix(wetColor, uColorA, clamp(crest + sparkle, 0.0, 1.0));
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });
      applyCoastalShaderPalette(material, palette, variant);
      return material;
    };

    const updateOutsideMotion = (time) => {
      if (!isVisible || activeView !== "outside" || reduceMotion || outsideMotionItems.length === 0) return false;
      const seconds = time * 0.001;
      outsideMotionItems.forEach((item) => {
        if (item.uniforms?.uTime) {
          item.uniforms.uTime.value = seconds + (item.timeOffset || 0);
        }
        if (item.texture) {
          item.texture.offset.x = item.offsetX + seconds * item.speedX;
          item.texture.offset.y = item.offsetY + seconds * item.speedY;
        }
        if (item.mesh && Number.isFinite(item.baseY)) {
          const wave = Math.sin(seconds * item.frequency + item.phase);
          item.mesh.position.y = item.baseY + wave * item.amplitude;
          if (Number.isFinite(item.baseRotationZ) && Number.isFinite(item.rotationAmplitude)) {
            item.mesh.rotation.z = item.baseRotationZ + wave * item.rotationAmplitude;
          }
          if (Number.isFinite(item.baseScaleX) && Number.isFinite(item.scaleAmplitude)) {
            const scaleWave = Math.sin(seconds * (item.scaleFrequency || item.frequency) + item.phase * 0.7);
            item.mesh.scale.set(
              item.baseScaleX + scaleWave * item.scaleAmplitude,
              item.baseScaleY,
              item.baseScaleZ + scaleWave * item.scaleAmplitude * 0.42
            );
          }
          if (item.material && Number.isFinite(item.baseOpacity) && Number.isFinite(item.opacityAmplitude)) {
            const opacityWave = Math.sin(seconds * (item.opacityFrequency || item.frequency) + item.phase * 0.8);
            item.material.opacity = Math.max(0, item.baseOpacity + opacityWave * item.opacityAmplitude);
          }
        }
        if (item.instancedMesh && item.specs && item.dummy) {
          item.specs.forEach((spec, index) => {
            const wave = Math.sin(seconds * spec.frequency + spec.phase);
            const shimmer = 0.78 + Math.sin(seconds * spec.shimmerFrequency + spec.phase * 1.7) * 0.22;
            const drift = Math.sin(seconds * spec.driftFrequency + spec.phase * 0.47) * spec.drift;
            item.dummy.position.set(spec.x + drift, spec.y + wave * spec.amplitude, spec.z + drift * spec.zDrift);
            item.dummy.rotation.set(spec.rx, spec.ry || 0, spec.rz + wave * spec.rotationAmplitude);
            item.dummy.scale.set(spec.scaleX * shimmer, spec.scaleY * (0.9 + shimmer * 0.12), 1);
            item.dummy.updateMatrix();
            item.instancedMesh.setMatrixAt(index, item.dummy.matrix);
          });
          item.instancedMesh.instanceMatrix.needsUpdate = true;
        }
      });
      return true;
    };

    const updateAccentMotionItem = (item, seconds, active) => {
      if (!item?.mesh || !item?.dummy) return;
      item.specs.forEach((spec, index) => {
        const pulse = active ? Math.sin(seconds * spec.speed + spec.phase) : Math.sin(spec.phase) * 0.18;
        const glint = active ? 0.72 + pulse * 0.24 : 0.74;
        const drift = active ? Math.sin(seconds * spec.driftSpeed + spec.phase * 0.63) * spec.drift : 0;
        item.dummy.position.set(spec.x + drift, spec.y + Math.max(0, pulse) * spec.lift, spec.z - drift * 0.34);
        item.dummy.rotation.set(spec.rx, spec.ry || 0, spec.rz + (active ? pulse * 0.055 : 0));
        item.dummy.scale.set(spec.scaleX * glint, spec.scaleY * (0.82 + glint * 0.22), 1);
        item.dummy.updateMatrix();
        item.mesh.setMatrixAt(index, item.dummy.matrix);
      });
      item.mesh.instanceMatrix.needsUpdate = true;
    };

    const updateAccentMotion = (time) => {
      if (!isVisible || activeView !== "desk" || reduceMotion || accentMotionItems.length === 0) return false;
      const shouldAnimate = Boolean(isRecordSpinning || focusedEntry || hoveredEntry || tweens.length);
      const seconds = time * 0.001;
      accentMotionItems.forEach((item) => updateAccentMotionItem(item, seconds, shouldAnimate));
      return shouldAnimate;
    };

    const applyDeskPalette = () => {
      if (!THREE) return;
      const palette = readDeskPalette();
      themeMaterials.floor?.color.setHex(palette.floor);
      replaceMaterialMap(themeMaterials.floor, createRoomFloorTexture(palette));
      themeMaterials.wall?.color.setHex(palette.wall);
      replaceMaterialMap(themeMaterials.wall, createRoomWallTexture(palette));
      themeMaterials.shellRib?.color.setHex(palette.isDarkTheme ? 0xcdb79a : 0xc8b59f);
      if (themeMaterials.shellRib) themeMaterials.shellRib.opacity = palette.isDarkTheme ? 0.54 : 0.42;
      themeMaterials.shellSkin?.color.setHex(palette.isDarkTheme ? 0xd6c3a7 : 0xe5d6c2);
      if (themeMaterials.shellSkin) themeMaterials.shellSkin.opacity = palette.isDarkTheme ? 0.28 : 0.22;
      themeMaterials.wood?.color.setHex(palette.wood);
      themeMaterials.woodEdge?.color.setHex(palette.woodEdge);
      themeMaterials.coffee?.color.setHex(palette.coffee);
      themeMaterials.ceramic?.color.setHex(palette.ceramic);
      themeMaterials.recordBase?.color.setHex(palette.recordBase);
      themeMaterials.metal?.color.setHex(palette.metal);
      themeMaterials.darkArm?.color.setHex(palette.isDarkTheme ? 0x232728 : 0x343838);
      themeMaterials.warmArm?.color.setHex(palette.isDarkTheme ? 0xd0a45f : 0xb9853d);
      themeMaterials.stylusContact?.color.setHex(palette.isDarkTheme ? 0xd6b47c : 0x6d4827);
      if (themeMaterials.stylusContact) themeMaterials.stylusContact.opacity = palette.isDarkTheme ? 0.36 : 0.24;
      themeMaterials.cardEdge?.color.setHex(palette.cardEdge);
      themeMaterials.shadow?.color.setHex(palette.shadow);
      if (themeMaterials.shadow) themeMaterials.shadow.opacity = palette.shadowOpacity;
      albumEntries.forEach((entry) => {
        entry.floorShadow?.material?.color?.setHex(palette.shadow);
      });
      songCardEntries.forEach((entry) => {
        entry.floorShadow?.material?.color?.setHex(palette.shadow);
      });
      themeMaterials.stain?.color.setHex(palette.stain);
      if (themeMaterials.stain) themeMaterials.stain.opacity = palette.stainOpacity;
      themeMaterials.windowFrame?.color.setHex(palette.isDarkTheme ? 0xe5d2b8 : 0x7e6047);
      themeMaterials.windowRecess?.color.setHex(palette.isDarkTheme ? 0x0b1416 : 0xd7c5ae);
      themeMaterials.windowGlass?.color.setHex(palette.isDarkTheme ? 0xa7d0dd : 0xd8f6ff);
      themeMaterials.stone?.color.setHex(palette.stone);
      themeMaterials.stoneEdge?.color.setHex(palette.stoneEdge);
      themeMaterials.roomFuton?.color.setHex(palette.isDarkTheme ? 0x405d62 : 0xc9d8d2);
      themeMaterials.roomPillow?.color.setHex(palette.isDarkTheme ? 0xf2e0c9 : 0xfff0de);
      themeMaterials.onsenWater?.color.setHex(palette.isDarkTheme ? 0x5aa4b8 : 0x9fdbe6);
      if (themeMaterials.onsenWater) themeMaterials.onsenWater.opacity = palette.isDarkTheme ? 0.66 : 0.7;
      themeMaterials.onsenSteam?.color.setHex(palette.isDarkTheme ? 0xf9dfc3 : 0xffffff);
      if (themeMaterials.onsenSteam) themeMaterials.onsenSteam.opacity = palette.isDarkTheme ? 0.2 : 0.24;
      themeMaterials.chairWood?.color.setHex(palette.isDarkTheme ? 0x8a5f3a : 0x9a663b);
      themeMaterials.chairCushion?.color.setHex(palette.isDarkTheme ? 0xf2e8d6 : 0xfff5e6);
      themeMaterials.chairBase?.color.setHex(palette.isDarkTheme ? 0x15191a : 0x1d2021);
      themeMaterials.windowCue?.color.setHex(palette.isDarkTheme ? 0xf2c994 : 0xb97942);
      if (themeMaterials.windowCue) themeMaterials.windowCue.opacity = palette.isDarkTheme ? 0.12 : 0.08;
      themeMaterials.windowSillGlint?.color.setHex(palette.isDarkTheme ? 0xffdfb0 : 0xd79b61);
      if (themeMaterials.windowSillGlint) themeMaterials.windowSillGlint.opacity = palette.isDarkTheme ? 0.22 : 0.16;
      themeMaterials.windowHint?.color.setHex(palette.isDarkTheme ? 0xffe3bd : 0x6a4c32);
      if (themeMaterials.windowHint) {
        themeMaterials.windowHint.opacity = palette.isDarkTheme ? 0.16 : 0.11;
        replaceMaterialMap(themeMaterials.windowHint, createWindowHintTexture(palette));
      }
      themeMaterials.deskGlints?.color.setHex(palette.isDarkTheme ? 0xffe0aa : 0xfff1c7);
      if (themeMaterials.deskGlints) themeMaterials.deskGlints.opacity = palette.isDarkTheme ? 0.24 : 0.2;
      themeMaterials.outsideOcean?.color.setHex(palette.isDarkTheme ? 0x183648 : 0x5bb9cf);
      if (themeMaterials.outsideOcean) themeMaterials.outsideOcean.opacity = palette.isDarkTheme ? 0.6 : 0.52;
      themeMaterials.outsideBeach?.color.setHex(palette.isDarkTheme ? 0xc7aa7e : 0xf0d6a6);
      if (themeMaterials.outsideBeach) themeMaterials.outsideBeach.opacity = palette.isDarkTheme ? 0.66 : 0.58;
      if (themeMaterials.outsideFoam) themeMaterials.outsideFoam.opacity = palette.isDarkTheme ? 0.78 : 0.72;
      themeMaterials.outsideShoreGlints?.color.setHex(palette.isDarkTheme ? 0xdff8ff : 0xffffff);
      if (themeMaterials.outsideShoreGlints) themeMaterials.outsideShoreGlints.opacity = palette.isDarkTheme ? 0.46 : 0.56;
      themeMaterials.outsideSandGlints?.color.setHex(palette.isDarkTheme ? 0xffd6a0 : 0xfff0c7);
      if (themeMaterials.outsideSandGlints) themeMaterials.outsideSandGlints.opacity = palette.isDarkTheme ? 0.2 : 0.26;
      applyCoastalShaderPalette(themeMaterials.outsideFoamShader, palette, "foam");
      applyCoastalShaderPalette(themeMaterials.outsideSandShader, palette, "sand");
      themeMaterials.outsideCliff?.color.setHex(palette.isDarkTheme ? 0x675a46 : 0xc2a775);
      themeMaterials.outsideCliffFace?.color.setHex(palette.isDarkTheme ? 0x5a4f3e : 0xad9365);
      themeMaterials.outsideCaveFace?.color.setHex(palette.isDarkTheme ? 0x9b876c : 0xd6bd94);
      themeMaterials.outsideCliff?.emissive?.setHex(palette.isDarkTheme ? 0x2c241a : 0xc4a26d);
      themeMaterials.outsideCliffFace?.emissive?.setHex(palette.isDarkTheme ? 0x261f18 : 0xa98555);
      themeMaterials.outsideCaveFace?.emissive?.setHex(palette.isDarkTheme ? 0x342a1f : 0xb8905d);
      if (themeMaterials.outsideCliff) themeMaterials.outsideCliff.emissiveIntensity = palette.isDarkTheme ? 0.08 : 0.2;
      if (themeMaterials.outsideCliffFace) themeMaterials.outsideCliffFace.emissiveIntensity = palette.isDarkTheme ? 0.06 : 0.16;
      if (themeMaterials.outsideCaveFace) themeMaterials.outsideCaveFace.emissiveIntensity = palette.isDarkTheme ? 0.1 : 0.18;
      themeMaterials.outsideCliffLine?.color.setHex(palette.isDarkTheme ? 0x867458 : 0xe0c48e);
      themeMaterials.outsideHouse?.color.setHex(palette.isDarkTheme ? 0xefe2d0 : 0xfff7e9);
      themeMaterials.outsideRoof?.color.setHex(palette.isDarkTheme ? 0x4e3a2d : 0x8b5a35);
      themeMaterials.outsideRoofShadow?.color.setHex(palette.isDarkTheme ? 0x756049 : 0xb1865e);
      themeMaterials.outsideBed?.color.setHex(palette.isDarkTheme ? 0xe9dfd2 : 0xfff8ee);
      themeMaterials.outsideRoomFloor?.color.setHex(palette.isDarkTheme ? 0xcfa171 : 0xf1d1a5);
      if (themeMaterials.outsideRoomFloor) replaceMaterialMap(themeMaterials.outsideRoomFloor, createRoomFloorTexture(palette));
      themeMaterials.outsideRoomWall?.color.setHex(palette.isDarkTheme ? 0xf4dcc1 : 0xffefe0);
      if (themeMaterials.outsideRoomWall) replaceMaterialMap(themeMaterials.outsideRoomWall, createRoomWallTexture(palette));
      themeMaterials.outsideTrim?.color.setHex(palette.isDarkTheme ? 0xffead0 : 0xe9d2b4);
      themeMaterials.outsideInterior?.color.setHex(palette.isDarkTheme ? 0xf6c98b : 0xffdeb0);
      if (themeMaterials.outsideInterior) themeMaterials.outsideInterior.opacity = palette.isDarkTheme ? 0.13 : 0.085;
      themeMaterials.outsideGlass?.color.setHex(palette.isDarkTheme ? 0x9ec8d8 : 0xb8e8f6);
      if (themeMaterials.outsideGlass) themeMaterials.outsideGlass.opacity = palette.isDarkTheme ? 0.08 : 0.1;
      themeMaterials.outsideInteriorGlow?.color.setHex(palette.isDarkTheme ? 0xffc98f : 0xffddb0);
      if (themeMaterials.outsideInteriorGlow) themeMaterials.outsideInteriorGlow.opacity = palette.isDarkTheme ? 0.055 : 0.028;
      themeMaterials.outsideCurtain?.color.setHex(palette.isDarkTheme ? 0xf5dfc8 : 0xffead4);
      if (themeMaterials.outsideCurtain) themeMaterials.outsideCurtain.opacity = palette.isDarkTheme ? 0.58 : 0.5;
      themeMaterials.outsideLamp?.color.setHex(palette.isDarkTheme ? 0xffcb78 : 0xf2b15f);
      if (themeMaterials.outsideLamp) themeMaterials.outsideLamp.opacity = palette.isDarkTheme ? 0.86 : 0.68;
      themeMaterials.outsideReturnGlow?.color.setHex(palette.isDarkTheme ? 0xffd6a1 : 0xfff0ca);
      if (themeMaterials.outsideReturnGlow) themeMaterials.outsideReturnGlow.opacity = palette.isDarkTheme ? 0.12 : 0.12;
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
      replaceMaterialMap(themeMaterials.outsideBackdrop, createOutsideBackdropTexture(palette));
      const oceanTexture = createOceanSurfaceTexture(palette);
      replaceMaterialMap(themeMaterials.outsideOcean, oceanTexture);
      setOutsideMotionTexture("ocean", oceanTexture);
      const foamTexture = createFoamSurfaceTexture(palette);
      replaceMaterialMap(themeMaterials.outsideFoam, foamTexture);
      setOutsideMotionTexture("foam", foamTexture);
      const sandTexture = createSandSurfaceTexture(palette);
      replaceMaterialMap(themeMaterials.outsideBeach, sandTexture);
      setOutsideMotionTexture("sand", sandTexture);
      const sandGustTexture = createSandGustTexture(palette);
      replaceMaterialMap(themeMaterials.outsideSandGust, sandGustTexture);
      if (themeMaterials.outsideSandGust) themeMaterials.outsideSandGust.opacity = palette.isDarkTheme ? 0.2 : 0.24;
      setOutsideMotionTexture("sandGust", sandGustTexture);
      replaceMaterialMap(themeMaterials.outsideCliff, createCliffSurfaceTexture(palette));
      replaceMaterialMap(themeMaterials.outsideCliffFace, createCliffSurfaceTexture(palette, true));
      replaceMaterialMap(themeMaterials.outsideCaveFace, createCliffSurfaceTexture(palette, true));
      replaceMaterialMap(themeMaterials.catBlanket, createCatBlanketTexture(palette));
      const laptopScreenMaterials = themeMaterials.laptopScreens || (themeMaterials.laptopScreen ? [themeMaterials.laptopScreen] : []);
      laptopScreenMaterials.forEach((material) => replaceMaterialMap(material, createLaptopScreenTexture(palette)));
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
        rootGroup.scale.setScalar(isCompact ? 0.76 : 0.98);
        rootGroup.position.set(isCompact ? -0.12 : -0.04, isCompact ? -0.1 : -0.06, isCompact ? 0.18 : 0.06);
      }
      if (outsideGroup) {
        outsideGroup.scale.setScalar(isCompact ? 0.58 : 1.02);
        outsideGroup.position.set(isCompact ? -0.14 : -0.14, isCompact ? -0.04 : -0.06, isCompact ? 0.08 : -0.04);
      }
      applyCameraPose(true);
      render();
    };

    const setActiveRecordInternal = (index, notify = false) => {
      activeRecordIndex = (index + records.length) % records.length;
      const record = records[activeRecordIndex];
      if (recordLabelMaterial) loadTexture(record?.src || record?.cover, recordLabelMaterial);
      albumEntries.forEach((entry) => {
        if (!entry.thrown && entry !== focusedEntry) entry.group.scale.setScalar(entry.index === activeRecordIndex ? 1.06 : 1);
      });
      if (notify && callbacks.selectRecord) callbacks.selectRecord(activeRecordIndex);
      scheduleFrame();
    };

    const setToneArm = (playing, immediate = false) => {
      if (!toneArmGroup) return;
      const targetY = playing ? 0.46 : -0.3;
      const targetZ = playing ? 0.42 : 0.13;
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
        520
      );
    };

    const clearFocusedEntry = (duration = 460) => {
      if (!focusedEntry) return false;
      const entry = focusedEntry;
      focusedEntry = null;
      focusedEntryAt = 0;
      container.removeAttribute("data-focused-desk-object");
      entry.lifted = false;
      setEntryCue(entry, false);
      const droppedPose = entry.kind === "album" ? getAlbumDroppedRestPose(entry) : null;
      if (entry.kind === "album" && entry.rackSlotHit) entry.rackSlotHit.visible = !droppedPose;
      const position = droppedPose?.position || entry.basePosition;
      const rotation = droppedPose?.rotation || entry.baseRotation;
      const scale =
        droppedPose?.scale ||
        (entry.kind === "album"
          ? new THREE.Vector3(
              entry.index === activeRecordIndex ? 1.06 : 1,
              entry.index === activeRecordIndex ? 1.06 : 1,
              entry.index === activeRecordIndex ? 1.06 : 1
            )
          : entry.baseScale || new THREE.Vector3(1, 1, 1));
      entry.currentRestY = position.y;
      addTween(
        entry.group,
        {
          position: position.clone(),
          rotation: rotation.clone(),
          scale: scale.clone(),
        },
        duration
      );
      return true;
    };

    const runRecordSwapCue = () => {
      if (!recordGroup) return;
      setToneArm(false);
      if (reduceMotion) {
        setToneArm(true, true);
        return;
      }
      const homePosition = new THREE.Vector3(-0.24, 0.224, 0.0);
      const liftedPosition = homePosition.clone().add(new THREE.Vector3(0.03, 0.2, 0.03));
      const sleevePosition = homePosition.clone().add(new THREE.Vector3(0.5, 0.28, 0.42));
      const insertPosition = homePosition.clone().add(new THREE.Vector3(0.06, 0.22, 0.05));

      addTween(recordGroup, { position: liftedPosition }, 180, {
        arcHeight: 0.018,
        easing: easeOutCubic,
        onComplete: () => {
          addTween(recordGroup, { position: sleevePosition }, 260, {
            arcHeight: 0.08,
            wobbleZ: 0.014,
            easing: easeOutQuart,
            onComplete: () => {
              addTween(recordGroup, { position: insertPosition }, 280, {
                arcHeight: 0.06,
                wobbleZ: -0.012,
                easing: easeOutCubic,
                onComplete: () => {
                  addTween(recordGroup, { position: homePosition }, 220, {
                    easing: easeOutQuart,
                    onComplete: () => setToneArm(true),
                  });
                },
              });
            },
          });
        },
      });
    };

    const returnToRoomView = () => {
      if (activeView !== "desk") return;
      targetZoomLevel = 0;
      targetRotationX = defaultRotation.x;
      targetRotationY = defaultRotation.y;
    };

    const normalizeDroppedRecordIndices = (indices = []) => {
      const seen = new Set();
      return indices
        .map((index) => Number(index))
        .filter((index) => {
          if (!Number.isInteger(index) || index < 0 || index >= records.length || seen.has(index)) return false;
          seen.add(index);
          return true;
        });
    };

    const getDroppedRecordPose = (entry, orderIndex) => {
      const side = entry.dropDirection || (orderIndex % 2 === 0 ? -1 : 1);
      const row = Math.floor(orderIndex / 2);
      const jitter = (((entry.index * 37) % 11) - 5) * 0.012;
      const gravitySettle = 1 - Math.pow(0.58, orderIndex + 1);
      const frictionSlide = (0.18 + row * 0.055) * gravitySettle;
      const restitution = Math.max(0.06, 0.2 - orderIndex * 0.028);
      const fan = side * (0.15 + row * 0.058 + frictionSlide * 0.18) + jitter * 0.82;
      const floorLift = orderIndex * 0.0025;
      const albumX = 1.18 + side * (0.22 + row * 0.086 + frictionSlide) + jitter;
      const albumZ = 1.25 + row * 0.16 + (entry.index % 2) * 0.048 + restitution * 0.12;
      const cardX = -0.12 + side * (0.22 + row * 0.095 + frictionSlide * 0.72) + jitter;
      const cardZ = 1.0 + row * 0.14 + (entry.index % 2) * 0.045 + restitution * 0.09;
      const settlePitch = side * (0.018 + restitution * 0.04);
      const settleRoll = side * (0.016 + row * 0.012);

      return {
        albumPosition: new THREE.Vector3(albumX, roomFloorY + 0.21 + orderIndex * 0.006, albumZ),
        albumRotation: new THREE.Euler(-Math.PI / 2 + settlePitch, settleRoll, fan),
        albumScale: new THREE.Vector3(0.95, 0.95, 0.95),
        cardPosition: new THREE.Vector3(cardX, droppedPaperY + orderIndex * 0.006, cardZ),
        cardRotation: new THREE.Euler(
          side * (0.006 + restitution * 0.018),
          side * 0.006,
          side * (0.13 + row * 0.055 + frictionSlide * 0.08) - jitter
        ),
        cardScale: new THREE.Vector3(1.02, 1.02, 1.02),
        albumShadowPosition: new THREE.Vector3(albumX, roomFloorY + 0.2 + floorLift, albumZ),
        albumShadowRotation: new THREE.Euler(-Math.PI / 2, 0, fan * 0.84),
        albumShadowScale: new THREE.Vector3(0.72 + row * 0.05 + gravitySettle * 0.04, 0.34, 1),
        cardShadowPosition: new THREE.Vector3(cardX, droppedPaperShadowY + floorLift, cardZ),
        cardShadowRotation: new THREE.Euler(-Math.PI / 2, 0, side * (0.13 + row * 0.05) - jitter),
        cardShadowScale: new THREE.Vector3(0.56 + row * 0.032 + gravitySettle * 0.035, 0.23, 1),
      };
    };

    const placeContactShadow = (shadow, pose, immediate, options = {}) => {
      if (!shadow || !pose) return;
      const wasVisible = shadow.visible;
      shadow.visible = true;
      if (shadow.material) shadow.material.opacity = options.opacity ?? 0.22;
      if (!wasVisible || immediate || reduceMotion) {
        shadow.position.copy(pose.position);
        shadow.rotation.copy(pose.rotation);
        shadow.scale.copy(pose.scale);
        if (immediate || reduceMotion) return;
        shadow.scale.multiplyScalar(options.startScale || 0.72);
      }
      addTween(
        shadow,
        {
          position: pose.position.clone(),
          rotation: pose.rotation.clone(),
          scale: pose.scale.clone(),
        },
        options.duration || 520,
        { easing: options.easing || easeOutCubic }
      );
    };

    const hideContactShadow = (shadow) => {
      if (!shadow) return;
      shadow.visible = false;
      if (shadow.material) shadow.material.opacity = 0;
    };

    const getAlbumDroppedRestPose = (entry) => {
      if (!entry || entry.kind !== "album") return null;
      const orderIndex = droppedRecordIndices.indexOf(entry.index);
      if (orderIndex < 0) return null;
      const pose = getDroppedRecordPose(entry, orderIndex);
      const restPose = {
        position: pose.albumPosition.clone(),
        rotation: pose.albumRotation.clone(),
        scale: pose.albumScale.clone(),
      };
      entry.thrown = true;
      entry.dropRestPose = restPose;
      return restPose;
    };

    const placeObject = (object, pose, immediate, options = {}) => {
      if (!object || !pose) return;
      if (immediate || reduceMotion) {
        object.position.copy(pose.position);
        object.rotation.copy(pose.rotation);
        object.scale.copy(pose.scale);
        return;
      }
      addTween(
        object,
        {
          position: pose.position,
          rotation: pose.rotation,
          scale: pose.scale,
        },
        options.duration || 680,
        {
          arcHeight: options.arcHeight || 0,
          wobbleZ: options.wobbleZ || 0,
          easing: options.easing || easeOutQuart,
        }
      );
    };

    const setDroppedRecordState = (indices = [], options = {}) => {
      droppedRecordIndices = normalizeDroppedRecordIndices(indices);
      if (!THREE || albumEntries.length === 0) return;

      const droppedOrder = new Map(droppedRecordIndices.map((index, order) => [index, order]));
      const immediate = options.immediate || reduceMotion;
      albumEntries.forEach((entry) => {
        const orderIndex = droppedOrder.get(entry.index);
        const songCard = songCardEntries[entry.index];

        if (Number.isInteger(orderIndex)) {
          const pose = getDroppedRecordPose(entry, orderIndex);
          const animateThisDrop = options.animate && (options.focusIndex === undefined || options.focusIndex === entry.index);
          entry.thrown = true;
          if (entry.rackSlotHit) entry.rackSlotHit.visible = false;
          entry.dropRestPose = {
            position: pose.albumPosition.clone(),
            rotation: pose.albumRotation.clone(),
            scale: pose.albumScale.clone(),
          };
          entry.currentRestY = pose.albumPosition.y;
          setEntryCue(entry, false);

          if (focusedEntry !== entry) {
            placeObject(
              entry.group,
              {
                position: pose.albumPosition,
                rotation: pose.albumRotation,
                scale: pose.albumScale,
              },
              immediate && !animateThisDrop,
              {
                duration: animateThisDrop ? 820 : 420,
                arcHeight: animateThisDrop ? 0.018 : 0,
                wobbleZ: animateThisDrop ? 0.004 : 0,
                easing: animateThisDrop ? easeOutCubic : easeOutQuart,
              }
            );
          }
          placeContactShadow(
            entry.floorShadow,
            {
              position: pose.albumShadowPosition,
              rotation: pose.albumShadowRotation,
              scale: pose.albumShadowScale,
            },
            immediate && !animateThisDrop,
            { duration: animateThisDrop ? 620 : 320, opacity: 0.2, startScale: 0.62 }
          );

          if (songCard) {
            const wasVisible = songCard.group.visible;
            songCard.group.visible = true;
            if (!wasVisible && animateThisDrop && !immediate) {
              songCard.group.position.copy(pose.cardPosition).add(new THREE.Vector3(-0.14 * (entry.dropDirection || 1), 0.22, -0.1));
              songCard.group.rotation.set(0.14, 0, pose.cardRotation.z - 0.18 * (entry.dropDirection || 1));
              songCard.group.scale.setScalar(0.86);
            }
            placeObject(
              songCard.group,
              {
                position: pose.cardPosition,
                rotation: pose.cardRotation,
                scale: pose.cardScale,
              },
              immediate && !animateThisDrop,
              {
                duration: animateThisDrop ? 760 : 360,
                arcHeight: animateThisDrop ? 0.02 : 0,
                wobbleZ: animateThisDrop ? 0.004 : 0,
                easing: animateThisDrop ? easeOutCubic : easeOutQuart,
              }
            );
            placeContactShadow(
              songCard.floorShadow,
              {
                position: pose.cardShadowPosition,
                rotation: pose.cardShadowRotation,
                scale: pose.cardShadowScale,
              },
              immediate && !animateThisDrop,
              { duration: animateThisDrop ? 560 : 300, opacity: 0.2, startScale: 0.72 }
            );
          }
          return;
        }

        if (entry.thrown && focusedEntry !== entry) {
          entry.thrown = false;
          entry.dropDirection = 0;
          entry.dropRestPose = null;
          entry.currentRestY = entry.basePosition.y;
          if (entry.rackSlotHit) entry.rackSlotHit.visible = true;
          placeObject(
            entry.group,
            {
              position: entry.basePosition,
              rotation: entry.baseRotation,
              scale: new THREE.Vector3(
                entry.index === activeRecordIndex ? 1.06 : 1,
                entry.index === activeRecordIndex ? 1.06 : 1,
                entry.index === activeRecordIndex ? 1.06 : 1
              ),
            },
            immediate,
            { duration: 460 }
          );
        }
        if (songCard) {
          songCard.group.visible = false;
          songCard.group.position.copy(songCard.basePosition);
          songCard.group.rotation.copy(songCard.baseRotation);
          songCard.group.scale.setScalar(0.72);
          hideContactShadow(songCard.floorShadow);
        }
        hideContactShadow(entry.floorShadow);
      });
      render();
      scheduleFrame();
    };

    const focusAlbum = (entry) => {
      if (!entry) return;
      if (focusedEntry && focusedEntry !== entry) clearFocusedEntry(360);
      focusedEntry = entry;
      focusedEntryAt = performance.now();
      container.setAttribute("data-focused-desk-object", `album-${entry.index}`);
      setEntryCue(entry, true);
      if (entry.rackSlotHit) entry.rackSlotHit.visible = false;
      const inspectPosition =
        (isCompactScene ? entry.compactInspectPosition : entry.inspectPosition) ||
        entry.inspectPosition ||
        entry.basePosition.clone().add(new THREE.Vector3(0.4, 0.46, 0.62));
      const inspectRotation =
        (isCompactScene ? entry.compactInspectRotation : entry.inspectRotation) || entry.inspectRotation || new THREE.Euler(-Math.PI / 2, 0.04, 0.08);
      const inspectScale = isCompactScene ? 1.45 : 1.72;
      entry.currentRestY = inspectPosition.y;
      addTween(
        entry.group,
        {
          position: inspectPosition.clone(),
          rotation: inspectRotation.clone(),
          scale: new THREE.Vector3(inspectScale, inspectScale, inspectScale),
        },
        500,
        {
          arcHeight: 0.07,
          wobbleZ: 0.01,
        }
      );
      targetZoomLevel = Math.max(targetZoomLevel, isCompactScene ? 0.34 : 0.38);
      targetRotationX = -0.14;
      targetRotationY = isCompactScene ? -0.12 : -0.08;
      scheduleFrame();
    };

    const releaseAlbumToRack = (entry, duration = 520) => {
      if (!entry) return;
      setEntryCue(entry, false);
      if (entry.rackSlotHit && !entry.thrown) entry.rackSlotHit.visible = true;
      const returnScale = entry.index === activeRecordIndex ? 1.06 : 1;
      entry.currentRestY = entry.basePosition.y;
      addTween(
        entry.group,
        {
          position: entry.basePosition.clone(),
          rotation: entry.baseRotation.clone(),
          scale: new THREE.Vector3(returnScale, returnScale, returnScale),
        },
        duration,
        { arcHeight: 0.06, wobbleZ: -0.01, easing: easeOutQuart }
      );
    };

    const swapFocusedAlbum = (entry) => {
      if (!entry) return;
      setActiveRecordInternal(entry.index, false);
      if (callbacks.playRecord) {
        callbacks.playRecord(entry.index);
      } else {
        setActiveRecordInternal(entry.index, false);
        isRecordSpinning = true;
        setToneArm(true);
      }
      runRecordSwapCue();
      window.setTimeout(
        () => {
          if (focusedEntry !== entry) return;
          focusedEntry = null;
          focusedEntryAt = 0;
          container.removeAttribute("data-focused-desk-object");
          releaseAlbumToRack(entry, 520);
          targetZoomLevel = Math.min(targetZoomLevel, isCompactScene ? 0.22 : 0.24);
          scheduleFrame();
        },
        reduceMotion ? 180 : 760
      );
      scheduleFrame();
    };

    const focusArtifact = (entry) => {
      if (!entry) return;
      if (focusedEntry && focusedEntry !== entry) clearFocusedEntry(360);
      focusedEntry = entry;
      focusedEntryAt = performance.now();
      container.setAttribute("data-focused-desk-object", `artifact-${entry.index}`);
      setEntryCue(entry, true);
      entry.lifted = true;
      const focusPosition = entry.focusPosition || entry.basePosition.clone().add(new THREE.Vector3(-0.08, 0.54, -0.18));
      const focusRotation = entry.focusRotation || new THREE.Euler(1.12, -0.02, entry.index === 0 ? -0.05 : 0.05);
      entry.currentRestY = focusPosition.y;
      addTween(
        entry.group,
        {
          position: focusPosition.clone(),
          rotation: focusRotation.clone(),
          scale: new THREE.Vector3(1.16, 1.16, 1.16),
        },
        560
      );
      targetZoomLevel = isCompactScene ? 0.23 : 0.22;
      targetRotationX = -0.028;
      targetRotationY = -0.11;
      scheduleFrame();
    };

    const focusPhoto = (entry) => {
      if (!entry) return;
      if (focusedEntry && focusedEntry !== entry) clearFocusedEntry(360);
      focusedEntry = entry;
      focusedEntryAt = performance.now();
      container.setAttribute("data-focused-desk-object", `photo-${entry.id}`);
      setEntryCue(entry, true);
      entry.lifted = true;
      entry.meshes?.forEach((mesh) => {
        mesh.visible = true;
      });
      [entry.imageMesh, entry.backImageMesh].forEach((mesh) => {
        if (mesh?.material) mesh.material.opacity = 1;
      });
      if (entry.src) {
        loadTexture(entry.src, entry.imageMesh?.material);
        loadTexture(entry.src, entry.backImageMesh?.material);
      }

      const focusPosition = (isCompactScene ? entry.compactFocusPosition : entry.focusPosition) || entry.focusPosition || entry.basePosition;
      const focusRotation = (isCompactScene ? entry.compactFocusRotation : entry.focusRotation) || entry.focusRotation || entry.baseRotation;
      const focusScale = entry.focusScale || entry.baseScale || new THREE.Vector3(1.04, 1.04, 1.04);
      entry.currentRestY = focusPosition.y;
      addTween(
        entry.group,
        {
          position: focusPosition.clone(),
          rotation: focusRotation.clone(),
          scale: focusScale.clone(),
        },
        520,
        { arcHeight: entry.id === "dog" ? 0.04 : 0, wobbleZ: entry.id === "dog" ? 0.01 : 0 }
      );
      targetZoomLevel = Math.max(targetZoomLevel, isCompactScene ? 0.44 : 0.5);
      targetRotationX = entry.targetRotationX ?? targetRotationX;
      targetRotationY = entry.targetRotationY ?? targetRotationY;
      scheduleFrame();
    };

    const throwAlbum = (entry, deltaX = 1) => {
      if (focusedEntry === entry) {
        focusedEntry = null;
        focusedEntryAt = 0;
        container.removeAttribute("data-focused-desk-object");
      } else if (focusedEntry) {
        clearFocusedEntry(320);
      }
      setEntryCue(entry, false);
      entry.dropDirection = deltaX >= 0 ? 1 : -1;
      const nextDropped = droppedRecordIndices.includes(entry.index) ? droppedRecordIndices : [...droppedRecordIndices, entry.index];
      setDroppedRecordState(nextDropped, { animate: true, focusIndex: entry.index });
      callbacks.dropRecord?.(entry.index);
      returnToRoomView();
      scheduleFrame();
    };

    const resetObjects = () => {
      focusedEntry = null;
      focusedEntryAt = 0;
      container.removeAttribute("data-focused-desk-object");
      const droppedSet = new Set(droppedRecordIndices);
      albumEntries.forEach((entry) => {
        if (droppedSet.has(entry.index)) return;
        setEntryCue(entry, false);
        entry.thrown = false;
        entry.dropDirection = 0;
        entry.currentRestY = entry.basePosition.y;
        addTween(entry.group, { position: entry.basePosition.clone(), rotation: entry.baseRotation.clone(), scale: new THREE.Vector3(1, 1, 1) }, 520);
      });
      artifactEntries.forEach((entry) => {
        setEntryCue(entry, false);
        entry.lifted = false;
        entry.currentRestY = entry.basePosition.y;
        addTween(
          entry.group,
          {
            position: entry.basePosition.clone(),
            rotation: entry.baseRotation.clone(),
            scale: entry.baseScale?.clone() || new THREE.Vector3(1, 1, 1),
          },
          420
        );
      });
      photoEntries.forEach((entry) => {
        setEntryCue(entry, false);
        entry.lifted = false;
        entry.currentRestY = entry.basePosition.y;
        addTween(
          entry.group,
          {
            position: entry.basePosition.clone(),
            rotation: entry.baseRotation.clone(),
            scale: entry.baseScale?.clone() || new THREE.Vector3(1, 1, 1),
          },
          420
        );
      });
      songCardEntries.forEach((entry) => {
        entry.group.visible = false;
        entry.group.position.copy(entry.basePosition);
        entry.group.rotation.copy(entry.baseRotation);
        entry.group.scale.setScalar(0.72);
      });
      setDroppedRecordState(droppedRecordIndices, { immediate: true });
      setToneArm(isRecordSpinning, true);
    };

    const setSceneView = (nextView) => {
      if (focusedEntry) clearFocusedEntry(360);
      focusedEntryAt = 0;
      activeView = nextView === "outside" ? "outside" : "desk";
      if (rootGroup) rootGroup.visible = activeView === "desk";
      if (outsideGroup) outsideGroup.visible = activeView === "outside";
      container.classList.toggle("is-outside-view", activeView === "outside");
      root.classList.toggle("home-desk-outside-active", activeView === "outside");
      const entryZoom = activeView === "outside" ? getOutsideEntryZoom() : 0;
      targetZoomLevel = entryZoom;
      zoomLevel = entryZoom;
      targetRotationX = activeView === "outside" ? outsideDefaultRotation.x : defaultRotation.x;
      targetRotationY = activeView === "outside" ? outsideDefaultRotation.y : defaultRotation.y;
      rotationX = targetRotationX;
      rotationY = targetRotationY;
      applyRootRotation(true);
      applyCameraPose(true);
      updateWindowJumpVisibility();
      scheduleFrame();
    };

    const getOutsideEntryZoom = () => (isCompactScene ? 0.12 : 0.28);
    const getOutsideMaxZoom = () => (isCompactScene ? 0.74 : 1);

    const enterDeskFromOutside = () => {
      setSceneView("desk");
      targetZoomLevel = 0;
      zoomLevel = isCompactScene ? 0.24 : 0.32;
      targetRotationX = defaultRotation.x;
      targetRotationY = defaultRotation.y;
      rotationX = defaultRotation.x;
      rotationY = defaultRotation.y;
      updateWindowJumpVisibility();
      scheduleFrame();
    };

    const clearOutsideView = () => {
      if (activeView === "outside") {
        setSceneView("desk");
        return;
      }
      container.classList.remove("is-outside-view");
      root.classList.remove("home-desk-outside-active");
    };

    const runOutsideViewportCheck = () => {
      outsideViewportCheckFrame = 0;
      if (!isVisible || activeView !== "outside") return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const exitInset = Math.min(180, Math.max(96, viewportHeight * 0.14));
      if (rect.bottom < exitInset || rect.top > viewportHeight - exitInset) {
        clearOutsideView();
      }
    };

    const scheduleOutsideViewportCheck = () => {
      if (!isVisible || activeView !== "outside" || outsideViewportCheckFrame) return;
      outsideViewportCheckFrame = window.requestAnimationFrame(runOutsideViewportCheck);
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
      const keepOutsideMoving = updateOutsideMotion(time);
      const keepAccentMoving = updateAccentMotion(time);

      if (recordGroup && isVisible && isRecordSpinning && !reduceMotion) {
        recordGroup.rotation.y = time * 0.00135;
      }

      if (toneArmGroup && isVisible && isRecordSpinning && !reduceMotion) {
        toneArmGroup.rotation.z = Math.sin(time * 0.0018) * 0.01;
      }

      render();

      if (
        isVisible &&
        ((!reduceMotion && (isRecordSpinning || keepOutsideMoving || keepAccentMoving)) || needsRotationFrame() || keepCameraMoving || keepTweening)
      ) {
        scheduleFrame();
      }
    }

    const addWindow = (palette) => {
      const roomWindow = sceneAnchors.room.window;
      const windowTopY = roomWindow.y + roomWindow.height / 2 + 0.035;
      const windowBottomY = roomWindow.y - roomWindow.height / 2 - 0.035;
      const windowLeftX = roomWindow.x - roomWindow.width / 2 - 0.035;
      const windowRightX = roomWindow.x + roomWindow.width / 2 + 0.035;
      const wallMaterial = new THREE.MeshBasicMaterial({
        color: palette.wall,
        map: createRoomWallTexture(palette),
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
      });
      themeMaterials.wall = wallMaterial;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(5.86, 3.56), wallMaterial);
      wall.position.set(0.08, 0.16, -1.84);
      wall.renderOrder = -3;
      rootGroup.add(wall);

      const recessMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x0b1416 : 0xd7c5ae,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.42 : 0.36,
        depthWrite: false,
        roughness: 0.86,
        metalness: 0.01,
      });
      const frameMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe5d2b8 : 0x7e6047, roughness: 0.62 });
      const stoneTrimMaterial = new THREE.MeshStandardMaterial({ color: palette.stoneEdge, roughness: 0.88, metalness: 0.01 });
      const caveMouthMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x8b7a63 : 0xd2bea5,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.56 : 0.48,
        depthWrite: false,
        roughness: 0.96,
        metalness: 0.01,
      });
      const glassMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xa7d0dd : 0xd8f6ff,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.12 : 0.17,
        depthWrite: false,
      });
      themeMaterials.windowFrame = frameMaterial;
      themeMaterials.windowRecess = recessMaterial;
      themeMaterials.windowGlass = glassMaterial;

      const caveLintel = addBeveledBox(
        rootGroup,
        { x: roomWindow.width + 0.92, y: 0.18, z: 0.34 },
        { x: roomWindow.x, y: windowTopY + 0.2, z: -1.86 },
        caveMouthMaterial,
        { bevel: 0.04, segments: 2 }
      );
      caveLintel.rotation.y = -0.02;
      registerOrbitCutaway(caveLintel, { occludedOpacity: 0.06, yawStart: 0.28, yawEnd: Math.PI * 2 - 0.22 });
      [
        { x: windowLeftX - 0.22, ry: 0.08, sx: 0.42 },
        { x: windowRightX + 0.22, ry: -0.08, sx: 0.42 },
      ].forEach((column) => {
        const mesh = addBeveledBox(
          rootGroup,
          { x: column.sx, y: roomWindow.height + 0.42, z: 0.36 },
          { x: column.x, y: roomWindow.y - 0.02, z: -1.86 },
          caveMouthMaterial,
          { bevel: 0.045, segments: 2 }
        );
        mesh.rotation.y = column.ry;
        registerOrbitCutaway(mesh, { occludedOpacity: 0.06, yawStart: 0.24, yawEnd: Math.PI * 2 - 0.22 });
      });
      [0, 1, 2].forEach((index) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(roomWindow.width / 2 + 0.32 + index * 0.16, 0.034 + index * 0.008, 8, 96, Math.PI),
          caveMouthMaterial
        );
        arch.position.set(roomWindow.x, roomWindow.y - 0.2 + index * 0.02, -1.84 + index * 0.018);
        arch.rotation.z = 0;
        arch.scale.y = 0.86 + index * 0.035;
        rootGroup.add(arch);
        registerOrbitCutaway(arch, { occludedOpacity: 0.07, yawStart: 0.26, yawEnd: Math.PI * 2 - 0.22 });
      });

      const windowBaseFrame = addBeveledBox(
        rootGroup,
        { x: roomWindow.width + 0.72, y: 0.1, z: 0.18 },
        { x: roomWindow.x, y: windowBottomY, z: -1.62 },
        frameMaterial,
        { bevel: 0.018 }
      );
      registerOrbitCutaway(windowBaseFrame, { occludedOpacity: 0.08, yawStart: 0.32, yawEnd: Math.PI * 2 - 0.24 });
      const windowRecessBlock = addBeveledBox(
        rootGroup,
        { x: roomWindow.width + 0.2, y: roomWindow.height + 0.26, z: 0.12 },
        { x: roomWindow.x, y: roomWindow.y, z: -1.795 },
        recessMaterial,
        {
          bevel: 0.018,
        }
      );
      windowRecessBlock.renderOrder = -2;
      registerOrbitCutaway(windowRecessBlock, { occludedOpacity: 0.02, hideBelow: 0.03, yawStart: 0.24, yawEnd: Math.PI * 2 - 0.24 });

      windowMaterial = new THREE.MeshBasicMaterial({
        map: createWindowTexture(palette),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const view = new THREE.Mesh(new THREE.PlaneGeometry(roomWindow.width - 0.24, roomWindow.height - 0.06), windowMaterial);
      view.position.set(roomWindow.x, roomWindow.y, -1.708);
      view.renderOrder = -1.5;
      rootGroup.add(view);
      registerOrbitCutaway(view, { cloneMaterial: false, baseOpacity: 1, occludedOpacity: 0.34 });

      const glass = new THREE.Mesh(new THREE.BoxGeometry(roomWindow.width - 0.34, roomWindow.height - 0.16, 0.018), glassMaterial);
      glass.position.set(roomWindow.x, roomWindow.y, -1.684);
      glass.renderOrder = -1;
      rootGroup.add(glass);
      registerOrbitCutaway(glass, { cloneMaterial: false, baseOpacity: glassMaterial.opacity ?? 0.22, occludedOpacity: 0.035 });

      [
        addBeveledBox(rootGroup, { x: roomWindow.width, y: 0.105, z: 0.18 }, { x: roomWindow.x, y: windowTopY, z: -1.65 }, frameMaterial, {
          bevel: 0.015,
        }),
        addBeveledBox(rootGroup, { x: roomWindow.width, y: 0.12, z: 0.22 }, { x: roomWindow.x, y: windowBottomY, z: -1.62 }, frameMaterial, {
          bevel: 0.015,
        }),
      ].forEach((mesh) => registerOrbitCutaway(mesh, { occludedOpacity: 0.08, yawStart: 0.32, yawEnd: Math.PI * 2 - 0.24 }));
      const leftWindowPost = addBeveledBox(
        rootGroup,
        { x: 0.12, y: roomWindow.height + 0.12, z: 0.18 },
        { x: windowLeftX, y: roomWindow.y, z: -1.65 },
        frameMaterial,
        {
          bevel: 0.015,
        }
      );
      const rightWindowPost = addBeveledBox(
        rootGroup,
        { x: 0.12, y: roomWindow.height + 0.12, z: 0.18 },
        { x: windowRightX, y: roomWindow.y, z: -1.65 },
        frameMaterial,
        {
          bevel: 0.015,
        }
      );
      [leftWindowPost, rightWindowPost].forEach((mesh) =>
        registerOrbitCutaway(mesh, { occludedOpacity: 0.08, yawStart: 0.24, yawEnd: Math.PI * 2 - 0.24 })
      );
      const centerMullion = addBox(
        rootGroup,
        { x: 0.08, y: roomWindow.height - 0.18, z: 0.1 },
        { x: roomWindow.x, y: roomWindow.y, z: -1.62 },
        frameMaterial
      );
      registerOrbitCutaway(centerMullion, { occludedOpacity: 0.06, yawStart: 0.24, yawEnd: Math.PI * 2 - 0.24 });
      const stoneSill = addBeveledBox(
        rootGroup,
        { x: roomWindow.width + 0.1, y: 0.18, z: 0.46 },
        { x: roomWindow.x - 0.04, y: windowBottomY - 0.02, z: -1.5 },
        stoneTrimMaterial,
        {
          bevel: 0.02,
        }
      );
      registerOrbitCutaway(stoneSill, { occludedOpacity: 0.08, yawStart: 0.28, yawEnd: Math.PI * 2 - 0.24 });
      const innerSill = addBeveledBox(
        rootGroup,
        { x: roomWindow.width - 0.7, y: 0.05, z: 0.16 },
        { x: roomWindow.x + 0.04, y: -1.04, z: -1.28 },
        frameMaterial,
        {
          bevel: 0.012,
        }
      );
      registerOrbitCutaway(innerSill, { occludedOpacity: 0.08, yawStart: 0.28, yawEnd: Math.PI * 2 - 0.24 });

      windowJumpGroup = new THREE.Group();
      windowJumpGroup.visible = false;
      windowJumpGroup.position.set(roomWindow.x, roomWindow.y + 0.02, -1.42);
      rootGroup.add(windowJumpGroup);
      const windowCueMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xf2c994 : 0xb97942,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.12 : 0.08,
        depthWrite: false,
      });
      themeMaterials.windowCue = windowCueMaterial;
      [
        { size: { x: roomWindow.width - 0.8, y: 0.014, z: 0.012 }, position: { x: 0, y: 1.14, z: 0.018 } },
        { size: { x: roomWindow.width - 0.8, y: 0.014, z: 0.012 }, position: { x: 0, y: -1.14, z: 0.018 } },
        { size: { x: 0.014, y: roomWindow.height - 0.46, z: 0.012 }, position: { x: -1.41, y: 0, z: 0.018 } },
        { size: { x: 0.014, y: roomWindow.height - 0.46, z: 0.012 }, position: { x: 1.41, y: 0, z: 0.018 } },
      ].forEach((cue) => addBox(windowJumpGroup, cue.size, cue.position, windowCueMaterial));
      const sillGlint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.74, 0.08),
        new THREE.MeshBasicMaterial({
          color: palette.isDarkTheme ? 0xffdfb0 : 0xd79b61,
          transparent: true,
          opacity: palette.isDarkTheme ? 0.22 : 0.16,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      themeMaterials.windowSillGlint = sillGlint.material;
      sillGlint.position.set(0.54, -1.07, 0.024);
      sillGlint.rotation.z = -0.08;
      windowJumpGroup.add(sillGlint);
      const hintMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xffe3bd : 0x6a4c32,
        map: createWindowHintTexture(palette),
        transparent: true,
        opacity: palette.isDarkTheme ? 0.13 : 0.085,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      themeMaterials.windowHint = hintMaterial;
      const hint = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.105), hintMaterial);
      hint.position.set(0.48, -0.98, 0.034);
      hint.renderOrder = 4;
      windowJumpGroup.add(hint);
      const buttonHit = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWindow.width - 0.16, roomWindow.height - 0.08),
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
      registerInteractive(buttonHit, { kind: "windowJump", index: 0 }, entry);
      registerInteractive(view, { kind: "windowJump", index: 0 }, entry);
      registerInteractive(glass, { kind: "windowJump", index: 0 }, entry);
    };

    const addOutsideShorelineAccents = (group, palette) => {
      const makeInstancedAccent = (key, materialName, materialOptions, specs) => {
        const geometry = new THREE.PlaneGeometry(0.16, 0.018);
        const material = new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          ...materialOptions,
        });
        themeMaterials[materialName] = material;
        const instancedMesh = new THREE.InstancedMesh(geometry, material, specs.length);
        instancedMesh.renderOrder = 1;
        group.add(instancedMesh);

        const item = { key, instancedMesh, specs, dummy: new THREE.Object3D() };
        outsideMotionItems.push(item);
        item.specs.forEach((spec, index) => {
          item.dummy.position.set(spec.x, spec.y, spec.z);
          item.dummy.rotation.set(spec.rx, spec.ry || 0, spec.rz);
          item.dummy.scale.set(spec.scaleX, spec.scaleY, 1);
          item.dummy.updateMatrix();
          instancedMesh.setMatrixAt(index, item.dummy.matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
      };

      const foamSpecs = [
        { x: -3.16, y: -1.116, z: 0.86, rz: -0.19, scaleX: 2.35, scaleY: 1.02, phase: 0.1 },
        { x: -2.7, y: -1.114, z: 0.93, rz: -0.09, scaleX: 1.72, scaleY: 0.88, phase: 0.74 },
        { x: -2.22, y: -1.112, z: 1.01, rz: 0.04, scaleX: 2.45, scaleY: 0.96, phase: 1.36 },
        { x: -1.78, y: -1.11, z: 1.09, rz: 0.08, scaleX: 1.85, scaleY: 0.82, phase: 2.02 },
        { x: -1.4, y: -1.108, z: 1.16, rz: -0.02, scaleX: 1.62, scaleY: 0.72, phase: 2.68 },
      ].map((spec) => ({
        rx: -Math.PI / 2,
        frequency: 2.7,
        shimmerFrequency: 3.8,
        amplitude: 0.014,
        rotationAmplitude: 0.03,
        driftFrequency: 1.18,
        drift: 0.048,
        zDrift: 0.35,
        ...spec,
      }));

      const sandSpecs = [
        { x: -2.96, y: -1.06, z: 1.14, rz: 0.1, scaleX: 0.82, scaleY: 0.58, phase: 0.44 },
        { x: -2.5, y: -1.058, z: 1.22, rz: -0.18, scaleX: 0.68, scaleY: 0.5, phase: 1.08 },
        { x: -2.1, y: -1.056, z: 1.31, rz: 0.22, scaleX: 0.78, scaleY: 0.52, phase: 1.64 },
        { x: -1.68, y: -1.054, z: 1.28, rz: -0.08, scaleX: 0.58, scaleY: 0.44, phase: 2.36 },
        { x: -1.28, y: -1.052, z: 1.36, rz: 0.18, scaleX: 0.7, scaleY: 0.46, phase: 3.2 },
      ].map((spec) => ({
        rx: -Math.PI / 2,
        frequency: 1.72,
        shimmerFrequency: 2.9,
        amplitude: 0.006,
        rotationAmplitude: 0.018,
        driftFrequency: 0.88,
        drift: 0.022,
        zDrift: -0.18,
        ...spec,
      }));

      makeInstancedAccent(
        "shoreFoamGlints",
        "outsideShoreGlints",
        { color: palette.isDarkTheme ? 0xdff8ff : 0xffffff, opacity: palette.isDarkTheme ? 0.46 : 0.56 },
        foamSpecs
      );
      makeInstancedAccent(
        "sandGlints",
        "outsideSandGlints",
        { color: palette.isDarkTheme ? 0xffd6a0 : 0xfff0c7, opacity: palette.isDarkTheme ? 0.2 : 0.26 },
        sandSpecs
      );
    };

    const addOutsideVignette = (palette) => {
      outsideGroup = new THREE.Group();
      outsideGroup.visible = false;
      scene.add(outsideGroup);
      outsideMotionItems.length = 0;

      const backdropMaterial = new THREE.MeshBasicMaterial({
        map: createOutsideBackdropTexture(palette),
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });
      themeMaterials.outsideBackdrop = backdropMaterial;
      const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5.6), backdropMaterial);
      backdrop.position.set(0.02, 0.34, -5.2);
      backdrop.renderOrder = -6;
      outsideGroup.add(backdrop);

      const oceanTexture = createOceanSurfaceTexture(palette);
      const oceanMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0x183648 : 0x5bb9cf,
        map: oceanTexture,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.6 : 0.52,
        depthWrite: false,
      });
      themeMaterials.outsideOcean = oceanMaterial;
      const ocean = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.55), oceanMaterial);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(-1.2, -1.39, -1.72);
      ocean.renderOrder = -5;
      outsideGroup.add(ocean);

      const nearOcean = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.62), oceanMaterial);
      nearOcean.rotation.x = -Math.PI / 2;
      nearOcean.rotation.z = 0.052;
      nearOcean.position.set(-1.62, -1.305, 0.18);
      nearOcean.renderOrder = -4;
      outsideGroup.add(nearOcean);

      const sideOcean = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 0.7), oceanMaterial);
      sideOcean.rotation.x = -Math.PI / 2;
      sideOcean.rotation.z = -0.46;
      sideOcean.position.set(1.24, -1.318, 1.95);
      sideOcean.renderOrder = -4;
      outsideGroup.add(sideOcean);

      const foamTexture = createFoamSurfaceTexture(palette);
      const foamMaterial = new THREE.MeshBasicMaterial({
        map: foamTexture,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.78 : 0.72,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      themeMaterials.outsideFoam = foamMaterial;

      const beachTexture = createSandSurfaceTexture(palette);
      const beachMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xc7aa7e : 0xf0d6a6,
        map: beachTexture,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.66 : 0.58,
        depthWrite: false,
        roughness: 0.9,
      });
      const sandGustTexture = createSandGustTexture(palette);
      const sandGustMaterial = new THREE.MeshBasicMaterial({
        map: sandGustTexture,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.2 : 0.24,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const cliffMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x675a46 : 0xc2a775,
        map: createCliffSurfaceTexture(palette),
        emissive: palette.isDarkTheme ? 0x2c241a : 0xc4a26d,
        emissiveIntensity: palette.isDarkTheme ? 0.08 : 0.2,
        roughness: 0.9,
      });
      const cliffFaceMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x5a4f3e : 0xad9365,
        map: createCliffSurfaceTexture(palette, true),
        emissive: palette.isDarkTheme ? 0x261f18 : 0xa98555,
        emissiveIntensity: palette.isDarkTheme ? 0.06 : 0.16,
        roughness: 0.94,
      });
      const cliffLineMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x867458 : 0xe0c48e, roughness: 0.86 });
      const caveFaceMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x9b876c : 0xd6bd94,
        map: createCliffSurfaceTexture(palette, true),
        emissive: palette.isDarkTheme ? 0x342a1f : 0xb8905d,
        emissiveIntensity: palette.isDarkTheme ? 0.1 : 0.18,
        roughness: 0.94,
      });
      const houseMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xefe2d0 : 0xfff7e9, roughness: 0.72 });
      const roofMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x4e3a2d : 0x8b5a35, roughness: 0.78 });
      const bedMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe9dfd2 : 0xfff8ee, roughness: 0.7 });
      const outsideWaterMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x5aa4b8 : 0x9fdbe6,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.62 : 0.68,
        roughness: 0.36,
        metalness: 0.02,
      });
      const outsideLizardMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x81a565 : 0x5f9d52, roughness: 0.72 });
      const outsideLizardBellyMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe7c990 : 0xf3d7a1, roughness: 0.68 });
      const roomFloorMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xcfa171 : 0xf1d1a5,
        map: createRoomFloorTexture(palette),
        roughness: 0.76,
      });
      const roomWallMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xf4dcc1 : 0xffefe0,
        map: createRoomWallTexture(palette),
        roughness: 0.8,
      });
      const trimMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xffead0 : 0xe9d2b4, roughness: 0.58 });
      const interiorMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xf6c98b : 0xffdeb0,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.16 : 0.11,
        depthWrite: false,
      });
      const glassMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0x9ec8d8 : 0xb8e8f6,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.07 : 0.09,
        depthWrite: false,
      });
      const interiorGlowMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xffc98f : 0xffddb0,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.055 : 0.028,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const curtainMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xf5dfc8 : 0xffead4,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.58 : 0.5,
        roughness: 0.78,
      });
      const lampMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xffcb78 : 0xf2b15f,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.86 : 0.68,
      });
      const roofShadowMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x756049 : 0xb1865e,
        roughness: 0.82,
        metalness: 0.01,
      });
      themeMaterials.outsideBeach = beachMaterial;
      themeMaterials.outsideSandGust = sandGustMaterial;
      themeMaterials.outsideCliff = cliffMaterial;
      themeMaterials.outsideCliffFace = cliffFaceMaterial;
      themeMaterials.outsideCaveFace = caveFaceMaterial;
      themeMaterials.outsideCliffLine = cliffLineMaterial;
      themeMaterials.outsideHouse = houseMaterial;
      themeMaterials.outsideRoof = roofMaterial;
      themeMaterials.outsideRoofShadow = roofShadowMaterial;
      themeMaterials.outsideBed = bedMaterial;
      themeMaterials.outsideRoomFloor = roomFloorMaterial;
      themeMaterials.outsideRoomWall = roomWallMaterial;
      themeMaterials.outsideTrim = trimMaterial;
      themeMaterials.outsideInterior = interiorMaterial;
      themeMaterials.outsideGlass = glassMaterial;
      themeMaterials.outsideInteriorGlow = interiorGlowMaterial;
      themeMaterials.outsideCurtain = curtainMaterial;
      themeMaterials.outsideLamp = lampMaterial;
      const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe5b58e, roughness: 0.68 });
      const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8 });
      const pillowMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xf2e6d5 : 0xfff2df, roughness: 0.72 });
      const shirtMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x1d2527 : 0x2b3334, roughness: 0.78 });
      const screenMaterial = new THREE.MeshBasicMaterial({ map: createLaptopScreenTexture(palette), side: THREE.DoubleSide });
      const blanketMaterial = new THREE.MeshStandardMaterial({ map: createCatBlanketTexture(palette), roughness: 0.78 });
      themeMaterials.laptopScreen = screenMaterial;
      themeMaterials.laptopScreens = themeMaterials.laptopScreens || [];
      themeMaterials.laptopScreens.push(screenMaterial);
      themeMaterials.catBlanket = blanketMaterial;

      const beach = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.52), beachMaterial);
      beach.rotation.x = -Math.PI / 2;
      beach.rotation.z = 0.025;
      beach.position.set(-1.98, -1.238, 1.22);
      beach.renderOrder = -3;
      outsideGroup.add(beach);

      const coveSand = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 0.58), beachMaterial);
      coveSand.rotation.x = -Math.PI / 2;
      coveSand.rotation.z = -0.055;
      coveSand.position.set(-1.42, -1.246, 1.58);
      coveSand.renderOrder = -3;
      outsideGroup.add(coveSand);

      const sideBeach = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.54), beachMaterial);
      sideBeach.rotation.x = -Math.PI / 2;
      sideBeach.rotation.z = -0.42;
      sideBeach.position.set(0.72, -1.228, 2.12);
      sideBeach.renderOrder = -3;
      outsideGroup.add(sideBeach);

      const rearBeach = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.5), beachMaterial);
      rearBeach.rotation.x = -Math.PI / 2;
      rearBeach.rotation.z = 0.64;
      rearBeach.position.set(2.18, -1.236, -0.28);
      rearBeach.renderOrder = -3;
      outsideGroup.add(rearBeach);
      outsideMotionItems.push({
        key: "coveSand",
        texture: null,
        mesh: coveSand,
        baseY: coveSand.position.y,
        speedX: 0,
        speedY: 0,
        offsetX: 0,
        offsetY: 0,
        amplitude: 0.003,
        frequency: 0.86,
        phase: 0.42,
        baseRotationZ: coveSand.rotation.z,
        rotationAmplitude: 0.003,
        baseScaleX: coveSand.scale.x,
        baseScaleY: coveSand.scale.y,
        baseScaleZ: coveSand.scale.z,
        scaleAmplitude: 0.004,
        scaleFrequency: 0.72,
      });

      const foam = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 0.18), foamMaterial);
      foam.rotation.x = -Math.PI / 2;
      foam.rotation.z = -0.04;
      foam.position.set(-2.05, -1.18, 0.96);
      foam.renderOrder = -2;
      outsideGroup.add(foam);
      const tideFoam = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.1), foamMaterial);
      tideFoam.rotation.x = -Math.PI / 2;
      tideFoam.rotation.z = 0.035;
      tideFoam.position.set(-1.76, -1.17, 1.22);
      tideFoam.renderOrder = -1;
      outsideGroup.add(tideFoam);
      const sideFoam = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.14), foamMaterial);
      sideFoam.rotation.x = -Math.PI / 2;
      sideFoam.rotation.z = -0.43;
      sideFoam.position.set(0.52, -1.158, 1.88);
      sideFoam.renderOrder = -1;
      outsideGroup.add(sideFoam);
      const sandGust = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.58), sandGustMaterial);
      sandGust.rotation.x = -Math.PI / 2;
      sandGust.rotation.z = -0.035;
      sandGust.position.set(-1.98, -1.105, 1.16);
      sandGust.renderOrder = 0;
      outsideGroup.add(sandGust);
      const foamShaderMaterial = createCoastalShaderMaterial(palette, "foam");
      const foamShader = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 0.44, 64, 8), foamShaderMaterial);
      foamShader.rotation.x = -Math.PI / 2;
      foamShader.rotation.z = -0.036;
      foamShader.position.set(-2.02, -1.104, 1.02);
      foamShader.renderOrder = 2;
      outsideGroup.add(foamShader);
      themeMaterials.outsideFoamShader = foamShaderMaterial;

      const sandShaderMaterial = createCoastalShaderMaterial(palette, "sand");
      const sandShader = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 0.38, 52, 5), sandShaderMaterial);
      sandShader.rotation.x = -Math.PI / 2;
      sandShader.rotation.z = 0.018;
      sandShader.position.set(-1.94, -1.098, 1.34);
      sandShader.renderOrder = 1;
      outsideGroup.add(sandShader);
      themeMaterials.outsideSandShader = sandShaderMaterial;
      addOutsideShorelineAccents(outsideGroup, palette);
      outsideMotionItems.push(
        {
          key: "foamShader",
          uniforms: foamShaderMaterial.uniforms,
          timeOffset: 0,
        },
        {
          key: "sandShader",
          uniforms: sandShaderMaterial.uniforms,
          timeOffset: 1.25,
        },
        {
          key: "ocean",
          texture: oceanTexture,
          mesh: ocean,
          baseY: ocean.position.y,
          speedX: 0.066,
          speedY: 0.14,
          offsetX: 0,
          offsetY: 0,
          amplitude: 0.018,
          frequency: 1.55,
          phase: 0,
          baseRotationZ: ocean.rotation.z,
          rotationAmplitude: 0.006,
          baseScaleX: ocean.scale.x,
          baseScaleY: ocean.scale.y,
          baseScaleZ: ocean.scale.z,
          scaleAmplitude: 0.01,
          scaleFrequency: 1.12,
        },
        {
          key: "nearOcean",
          texture: null,
          mesh: nearOcean,
          baseY: nearOcean.position.y,
          speedX: 0,
          speedY: 0,
          offsetX: 0,
          offsetY: 0,
          amplitude: 0.01,
          frequency: 1.9,
          phase: 0.34,
          baseRotationZ: nearOcean.rotation.z,
          rotationAmplitude: 0.012,
          baseScaleX: nearOcean.scale.x,
          baseScaleY: nearOcean.scale.y,
          baseScaleZ: nearOcean.scale.z,
          scaleAmplitude: 0.008,
          scaleFrequency: 1.42,
        },
        {
          key: "foam",
          texture: foamTexture,
          mesh: foam,
          baseY: foam.position.y,
          speedX: -0.16,
          speedY: 0.044,
          offsetX: 0.18,
          offsetY: 0,
          amplitude: 0.014,
          frequency: 2.4,
          phase: 0.8,
          baseRotationZ: foam.rotation.z,
          rotationAmplitude: 0.018,
          baseScaleX: foam.scale.x,
          baseScaleY: foam.scale.y,
          baseScaleZ: foam.scale.z,
          scaleAmplitude: 0.018,
          scaleFrequency: 2.1,
        },
        {
          key: "tideFoam",
          texture: null,
          mesh: tideFoam,
          baseY: tideFoam.position.y,
          speedX: 0,
          speedY: 0,
          offsetX: 0,
          offsetY: 0,
          amplitude: 0.018,
          frequency: 2.75,
          phase: 1.42,
          baseRotationZ: tideFoam.rotation.z,
          rotationAmplitude: 0.02,
          baseScaleX: tideFoam.scale.x,
          baseScaleY: tideFoam.scale.y,
          baseScaleZ: tideFoam.scale.z,
          scaleAmplitude: 0.022,
          scaleFrequency: 2.36,
        },
        {
          key: "sand",
          texture: beachTexture,
          mesh: beach,
          baseY: beach.position.y,
          speedX: 0.024,
          speedY: 0.035,
          offsetX: 0.04,
          offsetY: 0,
          amplitude: 0.004,
          frequency: 1.25,
          phase: 1.7,
          baseRotationZ: beach.rotation.z,
          rotationAmplitude: 0.004,
          baseScaleX: beach.scale.x,
          baseScaleY: beach.scale.y,
          baseScaleZ: beach.scale.z,
          scaleAmplitude: 0.004,
          scaleFrequency: 0.8,
        },
        {
          key: "sandGust",
          texture: sandGustTexture,
          mesh: sandGust,
          baseY: sandGust.position.y,
          speedX: 0.18,
          speedY: 0.026,
          offsetX: 0.22,
          offsetY: 0,
          amplitude: 0.012,
          frequency: 1.72,
          phase: 2.15,
          baseRotationZ: sandGust.rotation.z,
          rotationAmplitude: 0.012,
          baseScaleX: sandGust.scale.x,
          baseScaleY: sandGust.scale.y,
          baseScaleZ: sandGust.scale.z,
          scaleAmplitude: 0.01,
          scaleFrequency: 1.24,
        }
      );

      [
        { width: 8.4, depth: 0.1, x: -1.44, y: -1.116, z: 0.63, rz: -0.072, opacity: 0.34 },
        { width: 7.2, depth: 0.08, x: -1.62, y: -1.112, z: 0.82, rz: -0.038, opacity: 0.4 },
        { width: 6.2, depth: 0.065, x: -1.92, y: -1.108, z: 1.04, rz: 0.018, opacity: 0.32 },
        { width: 4.6, depth: 0.05, x: -2.22, y: -1.104, z: 1.28, rz: 0.066, opacity: 0.26 },
      ].forEach((band) => {
        const wave = new THREE.Mesh(
          new THREE.PlaneGeometry(band.width, band.depth),
          new THREE.MeshBasicMaterial({
            map: foamTexture,
            transparent: true,
            opacity: band.opacity,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
          })
        );
        wave.rotation.x = -Math.PI / 2;
        wave.rotation.z = band.rz;
        wave.position.set(band.x, band.y, band.z);
        wave.renderOrder = 2;
        outsideGroup.add(wave);
        outsideMotionItems.push({
          key: `shoreBand-${band.z}`,
          texture: null,
          mesh: wave,
          baseY: wave.position.y,
          speedX: 0,
          speedY: 0,
          offsetX: 0,
          offsetY: 0,
          amplitude: 0.01,
          frequency: 1.7 + band.z * 0.5,
          phase: band.z,
          baseRotationZ: wave.rotation.z,
          rotationAmplitude: 0.012,
          baseScaleX: wave.scale.x,
          baseScaleY: wave.scale.y,
          baseScaleZ: wave.scale.z,
          scaleAmplitude: 0.014,
          scaleFrequency: 1.6,
        });
      });

      [
        {
          points: [
            [-3.56, 0.78],
            [-1.88, 0.88],
            [-1.56, 1.22],
            [-2.3, 1.68],
            [-3.62, 1.5],
          ],
          yTop: -1.02,
          height: 0.2,
          material: cliffFaceMaterial,
        },
        {
          points: [
            [-3.28, 0.42],
            [-2.06, 0.5],
            [-1.78, 0.78],
            [-2.42, 1.02],
            [-3.42, 0.92],
          ],
          yTop: -0.86,
          height: 0.16,
          material: cliffMaterial,
        },
        {
          points: [
            [0.08, -0.06],
            [2.56, 0.02],
            [2.82, 0.42],
            [2.2, 0.78],
            [0.18, 0.66],
            [-0.08, 0.24],
          ],
          yTop: -0.62,
          height: 0.22,
          material: cliffMaterial,
        },
        {
          points: [
            [0.18, 0.58],
            [2.38, 0.72],
            [2.58, 1.1],
            [1.84, 1.46],
            [0.34, 1.24],
          ],
          yTop: -0.98,
          height: 0.2,
          material: cliffFaceMaterial,
        },
      ].forEach((terrace) => addIrregularSlab(outsideGroup, terrace.points, terrace.yTop, terrace.height, terrace.material));
      [
        { x: -3.06, y: -0.96, z: 1.1, sx: 0.42, sy: 0.18, sz: 0.12, ry: -0.34 },
        { x: -2.52, y: -0.88, z: 0.7, sx: 0.32, sy: 0.14, sz: 0.1, ry: 0.28 },
        { x: -1.92, y: -1.08, z: 1.34, sx: 0.38, sy: 0.1, sz: 0.13, ry: -0.18 },
        { x: 2.36, y: -0.7, z: 0.62, sx: 0.42, sy: 0.28, sz: 0.13, ry: 0.22 },
        { x: 2.12, y: -1.08, z: 1.18, sx: 0.36, sy: 0.12, sz: 0.16, ry: -0.2 },
      ].forEach((rock) => {
        const mesh = addBox(outsideGroup, { x: rock.sx, y: rock.sy, z: rock.sz }, rock, rock.y < -0.95 ? cliffFaceMaterial : cliffLineMaterial);
        mesh.rotation.y = rock.ry;
      });

      addIrregularSlab(
        outsideGroup,
        [
          [0.82, 0.28],
          [1.78, 0.32],
          [1.94, 0.54],
          [1.54, 0.72],
          [0.92, 0.68],
          [0.58, 0.48],
        ],
        -0.81,
        0.12,
        cliffMaterial
      );
      [
        {
          points: [
            [0.52, 0.42],
            [1.96, 0.48],
            [2.08, 0.74],
            [1.58, 0.96],
            [0.72, 0.9],
            [0.34, 0.62],
          ],
          yTop: -0.93,
          height: 0.1,
          material: cliffFaceMaterial,
        },
        {
          points: [
            [0.78, 0.62],
            [1.72, 0.7],
            [1.86, 0.92],
            [1.38, 1.08],
            [0.92, 0.98],
            [0.58, 0.78],
          ],
          yTop: -1.08,
          height: 0.08,
          material: cliffMaterial,
        },
      ].forEach((terrace) => addIrregularSlab(outsideGroup, terrace.points, terrace.yTop, terrace.height, terrace.material));
      [
        { size: { x: 0.5, y: 0.012, z: 0.014 }, position: { x: 1.52, y: -0.8, z: 0.52 }, rotation: -0.04 },
        { size: { x: 0.26, y: 0.12, z: 0.028 }, position: { x: 0.88, y: -0.91, z: 0.58 }, rotation: 0.1 },
        { size: { x: 0.24, y: 0.1, z: 0.026 }, position: { x: 1.86, y: -0.9, z: 0.58 }, rotation: -0.12 },
        { size: { x: 0.46, y: 0.012, z: 0.016 }, position: { x: 1.26, y: -1.02, z: 0.78 }, rotation: 0.05 },
      ].forEach((strip) => {
        const mesh = addBox(outsideGroup, strip.size, strip.position, cliffLineMaterial);
        mesh.rotation.y = strip.rotation;
      });
      addBox(outsideGroup, { x: 1.68, y: 0.052, z: 0.48 }, { x: 1.12, y: -0.49, z: 0.42 }, cliffMaterial);
      addBox(outsideGroup, { x: 1.26, y: 0.028, z: 0.28 }, { x: 1.1, y: -0.555, z: 0.72 }, cliffLineMaterial);
      addIrregularSlab(
        outsideGroup,
        [
          [0.28, 0.2],
          [1.76, 0.24],
          [1.94, 0.44],
          [1.58, 0.64],
          [0.94, 0.68],
          [0.42, 0.56],
        ],
        -0.76,
        0.06,
        cliffMaterial
      );
      addIrregularSlab(
        outsideGroup,
        [
          [0.62, 0.7],
          [1.72, 0.74],
          [1.88, 0.96],
          [1.42, 1.16],
          [0.72, 1.02],
        ],
        -1.0,
        0.12,
        cliffFaceMaterial
      );
      [
        { x: 0.7, y: -0.77, z: 0.82, sx: 0.14, sy: 0.22, sz: 0.06, ry: 0.18 },
        { x: 1.42, y: -0.79, z: 0.88, sx: 0.18, sy: 0.2, sz: 0.065, ry: -0.12 },
        { x: 1.95, y: -0.78, z: 0.78, sx: 0.12, sy: 0.18, sz: 0.055, ry: 0.08 },
        { x: 0.54, y: -0.68, z: 0.36, sx: 0.1, sy: 0.16, sz: 0.045, ry: -0.22 },
        { x: 2.08, y: -0.68, z: 0.42, sx: 0.12, sy: 0.18, sz: 0.05, ry: 0.24 },
        { x: 0.88, y: -0.95, z: 0.96, sx: 0.16, sy: 0.07, sz: 0.05, ry: -0.3 },
        { x: 1.22, y: -1.01, z: 1.06, sx: 0.12, sy: 0.06, sz: 0.05, ry: 0.28 },
        { x: 1.68, y: -0.98, z: 1.0, sx: 0.18, sy: 0.065, sz: 0.055, ry: -0.18 },
      ].forEach((facet) => {
        const mesh = addBox(outsideGroup, { x: facet.sx, y: facet.sy, z: facet.sz }, facet, cliffFaceMaterial);
        mesh.rotation.y = facet.ry;
      });
      [
        {
          points: [
            [0.12, 0.06],
            [2.18, 0.08],
            [2.36, 0.34],
            [1.96, 0.58],
            [0.44, 0.54],
            [0.08, 0.28],
          ],
          yTop: -0.66,
          height: 0.09,
          material: cliffMaterial,
        },
        {
          points: [
            [0.22, 0.98],
            [1.88, 1.02],
            [2.12, 1.26],
            [1.58, 1.48],
            [0.72, 1.36],
            [0.16, 1.18],
          ],
          yTop: -1.18,
          height: 0.1,
          material: cliffFaceMaterial,
        },
        {
          points: [
            [1.76, 0.24],
            [2.52, 0.32],
            [2.64, 0.72],
            [2.12, 0.9],
            [1.82, 0.62],
          ],
          yTop: -0.9,
          height: 0.18,
          material: cliffFaceMaterial,
        },
      ].forEach((terrace) => addIrregularSlab(outsideGroup, terrace.points, terrace.yTop, terrace.height, terrace.material));
      [
        { x: 0.28, y: -0.82, z: 0.18, sx: 0.18, sy: 0.34, sz: 0.08, ry: -0.32 },
        { x: 2.26, y: -0.86, z: 0.28, sx: 0.22, sy: 0.42, sz: 0.09, ry: 0.26 },
        { x: 0.36, y: -1.15, z: 1.12, sx: 0.24, sy: 0.08, sz: 0.08, ry: -0.22 },
        { x: 2.0, y: -1.18, z: 1.3, sx: 0.3, sy: 0.09, sz: 0.1, ry: 0.18 },
      ].forEach((facet) => {
        const mesh = addBox(outsideGroup, { x: facet.sx, y: facet.sy, z: facet.sz }, facet, cliffLineMaterial);
        mesh.rotation.y = facet.ry;
      });
      [
        [0.38, 0.28],
        [1.82, 0.28],
        [0.46, 0.78],
        [1.74, 0.78],
      ].forEach(([x, z]) => addBox(outsideGroup, { x: 0.045, y: 0.42, z: 0.045 }, { x, y: -0.72, z }, roofMaterial));
      addIrregularSlab(
        outsideGroup,
        [
          [0.12, 0.2],
          [2.08, 0.24],
          [2.34, 0.58],
          [1.72, 0.9],
          [0.46, 0.78],
          [-0.04, 0.44],
        ],
        -0.74,
        0.28,
        cliffMaterial
      );
      addIrregularSlab(
        outsideGroup,
        [
          [0.26, 0.78],
          [1.82, 0.84],
          [2.08, 1.12],
          [1.42, 1.36],
          [0.44, 1.2],
        ],
        -1.04,
        0.16,
        cliffFaceMaterial
      );
      [
        { x: 1.1, z: 0.62, w: 1.28 },
        { x: 1.08, z: 0.9, w: 0.92 },
      ].forEach((rail) => addBox(outsideGroup, { x: rail.w, y: 0.024, z: 0.032 }, { x: rail.x, y: -0.32, z: rail.z }, trimMaterial));
      [
        { x: 0.54, z: 0.28, h: 0.56 },
        { x: 1.08, z: 0.28, h: 0.6 },
        { x: 1.64, z: 0.29, h: 0.54 },
        { x: 1.86, z: 0.76, h: 0.46 },
      ].forEach((pier) =>
        addBox(outsideGroup, { x: 0.045, y: pier.h, z: 0.045 }, { x: pier.x, y: -0.49 - pier.h / 2, z: pier.z }, roofShadowMaterial)
      );
      [
        { x: 0.84, z: 0.31, ry: 0.22 },
        { x: 1.46, z: 0.31, ry: -0.2 },
        { x: 1.72, z: 0.7, ry: 0.18 },
      ].forEach((brace) => {
        const mesh = addBox(outsideGroup, { x: 0.36, y: 0.026, z: 0.036 }, { x: brace.x, y: -0.75, z: brace.z }, roofShadowMaterial);
        mesh.rotation.y = brace.ry;
        mesh.rotation.z = brace.ry > 0 ? 0.32 : -0.32;
      });
      const cliffApron = addBox(outsideGroup, { x: 2.16, y: 0.18, z: 0.42 }, { x: 1.08, y: -0.89, z: 0.66 }, cliffMaterial);
      cliffApron.rotation.y = -0.035;
      addBox(outsideGroup, { x: 1.72, y: 0.035, z: 0.28 }, { x: 1.08, y: -0.77, z: 0.78 }, cliffLineMaterial);

      const house = new THREE.Group();
      const outsideHouse = sceneAnchors.outside.house;
      const outsideWindow = sceneAnchors.outside.window;
      house.position.set(outsideHouse.x - 0.06, outsideHouse.y + 0.36, outsideHouse.z - 0.34);
      house.scale.setScalar(1.34);
      outsideGroup.add(house);
      const caveWindowTop = outsideWindow.y + outsideWindow.height / 2 + 0.05;
      const caveWindowBottom = outsideWindow.y - outsideWindow.height / 2 - 0.05;
      const caveWindowLeft = outsideWindow.x - outsideWindow.width / 2 - 0.06;
      const caveWindowRight = outsideWindow.x + outsideWindow.width / 2 + 0.06;
      [
        {
          size: { x: outsideWindow.width + 0.72, y: 0.16, z: 0.34 },
          position: { x: outsideWindow.x, y: caveWindowTop + 0.1, z: outsideWindow.z - 0.08 },
          ry: -0.02,
        },
        {
          size: { x: outsideWindow.width + 0.58, y: 0.12, z: 0.3 },
          position: { x: outsideWindow.x, y: caveWindowBottom - 0.04, z: outsideWindow.z - 0.02 },
          ry: 0.025,
        },
        {
          size: { x: 0.22, y: outsideWindow.height + 0.36, z: 0.36 },
          position: { x: caveWindowLeft - 0.06, y: outsideWindow.y, z: outsideWindow.z - 0.08 },
          ry: 0.08,
        },
        {
          size: { x: 0.24, y: outsideWindow.height + 0.34, z: 0.36 },
          position: { x: caveWindowRight + 0.06, y: outsideWindow.y - 0.02, z: outsideWindow.z - 0.08 },
          ry: -0.08,
        },
      ].forEach((stone) => {
        const mesh = addBeveledBox(house, stone.size, stone.position, caveFaceMaterial, { bevel: 0.022, segments: 2 });
        mesh.rotation.y = stone.ry;
      });
      [0, 1, 2].forEach((index) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(outsideWindow.width / 2 + 0.18 + index * 0.08, 0.022 + index * 0.004, 8, 72, Math.PI),
          cliffLineMaterial
        );
        arch.position.set(outsideWindow.x, outsideWindow.y - 0.18 + index * 0.015, outsideWindow.z + 0.03 + index * 0.018);
        arch.scale.y = 0.84 + index * 0.04;
        house.add(arch);
      });
      addBox(house, { x: 0.16, y: 0.86, z: 0.94 }, { x: -0.96, y: -0.08, z: 0.08 }, caveFaceMaterial);
      addBox(house, { x: 0.14, y: 0.78, z: 0.88 }, { x: 0.92, y: -0.12, z: 0.08 }, caveFaceMaterial);
      addBox(house, { x: 1.78, y: 0.12, z: 0.94 }, { x: -0.02, y: -0.58, z: 0.1 }, cliffMaterial);
      [
        { x: -0.74, y: -0.44, z: 0.62, sx: 0.28, sy: 0.12, sz: 0.14, ry: -0.18 },
        { x: 0.58, y: -0.46, z: 0.66, sx: 0.32, sy: 0.1, sz: 0.12, ry: 0.16 },
        { x: -0.86, y: 0.36, z: -0.34, sx: 0.18, sy: 0.28, sz: 0.1, ry: 0.12 },
      ].forEach((stone) => {
        const mesh = addBox(house, { x: stone.sx, y: stone.sy, z: stone.sz }, stone, cliffLineMaterial);
        mesh.rotation.y = stone.ry;
      });
      addBeveledBox(house, { x: 1.52, y: 0.08, z: 0.78 }, { x: 0, y: -0.47, z: 0 }, trimMaterial, { bevel: 0.018 });
      addBeveledBox(house, { x: 1.34, y: 0.035, z: 0.62 }, { x: -0.06, y: -0.4, z: 0.02 }, roomFloorMaterial, { bevel: 0.012 });
      addBeveledBox(house, { x: 1.52, y: 0.78, z: 0.08 }, { x: 0, y: -0.05, z: -0.36 }, caveFaceMaterial, { bevel: 0.014 });
      addBox(house, { x: 1.2, y: 0.58, z: 0.035 }, { x: -0.06, y: -0.08, z: -0.31 }, roomWallMaterial);
      addBeveledBox(house, { x: 0.08, y: 0.78, z: 0.76 }, { x: -0.8, y: -0.05, z: 0.02 }, caveFaceMaterial, { bevel: 0.014 });
      addBeveledBox(house, { x: 0.08, y: 0.78, z: 0.76 }, { x: 0.8, y: -0.05, z: 0.02 }, caveFaceMaterial, { bevel: 0.014 });
      addBeveledBox(house, { x: 1.72, y: 0.68, z: 0.09 }, { x: -0.02, y: -0.08, z: -0.58 }, caveFaceMaterial, { bevel: 0.014 });
      addBeveledBox(house, { x: 0.12, y: 0.72, z: 0.86 }, { x: -0.98, y: -0.08, z: -0.02 }, caveFaceMaterial, { bevel: 0.014 });
      addBeveledBox(house, { x: 0.12, y: 0.72, z: 0.86 }, { x: 0.98, y: -0.08, z: -0.02 }, caveFaceMaterial, { bevel: 0.014 });
      addBox(house, { x: 1.42, y: 0.03, z: 0.07 }, { x: -0.02, y: 0.22, z: -0.635 }, trimMaterial);
      addBox(house, { x: 1.42, y: 0.025, z: 0.07 }, { x: -0.02, y: -0.38, z: -0.635 }, roofShadowMaterial);
      [
        { x: -0.52, y: -0.06, z: -0.665, sx: 0.32, sy: 0.42, sz: 0.035 },
        { x: 0.02, y: -0.08, z: -0.67, sx: 0.38, sy: 0.36, sz: 0.035 },
        { x: 0.52, y: -0.04, z: -0.665, sx: 0.3, sy: 0.46, sz: 0.035 },
      ].forEach((panel) => addBox(house, { x: panel.sx, y: panel.sy, z: panel.sz }, panel, roomWallMaterial));
      [-0.54, 0.54].forEach((x) => addBox(house, { x: 0.045, y: 0.52, z: 0.052 }, { x, y: -0.06, z: -0.628 }, trimMaterial));
      addBox(house, { x: 0.72, y: 0.16, z: 0.018 }, { x: -0.04, y: 0.02, z: -0.602 }, glassMaterial);
      addBox(house, { x: 0.78, y: 0.025, z: 0.036 }, { x: -0.04, y: 0.125, z: -0.59 }, trimMaterial);
      addBox(house, { x: 0.78, y: 0.025, z: 0.036 }, { x: -0.04, y: -0.085, z: -0.59 }, trimMaterial);
      addBox(house, { x: 0.034, y: 0.19, z: 0.04 }, { x: -0.34, y: 0.02, z: -0.586 }, trimMaterial);
      addBox(house, { x: 0.034, y: 0.19, z: 0.04 }, { x: 0.26, y: 0.02, z: -0.586 }, trimMaterial);
      addBeveledBox(house, { x: 1.92, y: 0.1, z: 1.04 }, { x: 0, y: 0.48, z: 0.02 }, roofMaterial, { bevel: 0.018 });
      addBox(house, { x: 1.82, y: 0.035, z: 0.96 }, { x: 0, y: 0.415, z: 0.02 }, roofShadowMaterial);
      addBeveledBox(house, { x: 2.1, y: 0.04, z: 1.12 }, { x: 0, y: 0.56, z: 0.04 }, roofMaterial, { bevel: 0.012 });
      addBeveledBox(house, { x: 2.18, y: 0.055, z: 0.26 }, { x: 0, y: 0.525, z: -0.69 }, roofMaterial, { bevel: 0.012 });
      [-0.68, -0.34, 0, 0.34, 0.68].forEach((x) => {
        const rib = addBox(house, { x: 0.034, y: 0.035, z: 0.86 }, { x, y: 0.545, z: 0.04 }, roofShadowMaterial);
        rib.rotation.y = x * 0.035;
      });
      addBox(house, { x: 2.14, y: 0.05, z: 0.065 }, { x: 0, y: 0.505, z: 0.625 }, roofShadowMaterial);
      addBox(house, { x: 2.08, y: 0.045, z: 0.055 }, { x: 0, y: 0.505, z: -0.535 }, roofShadowMaterial);
      addBox(house, { x: 0.07, y: 0.09, z: 1.14 }, { x: -1.06, y: 0.49, z: 0.04 }, roofShadowMaterial);
      addBox(house, { x: 0.07, y: 0.09, z: 1.14 }, { x: 1.06, y: 0.49, z: 0.04 }, roofShadowMaterial);
      addBox(house, { x: 2.06, y: 0.045, z: 0.075 }, { x: 0, y: 0.43, z: 0.58 }, trimMaterial);
      addBox(house, { x: 1.78, y: 0.035, z: 0.075 }, { x: 0, y: 0.39, z: -0.42 }, trimMaterial);
      addBox(house, { x: 1.82, y: 0.032, z: 0.07 }, { x: 0, y: 0.36, z: 0.37 }, roofShadowMaterial);
      addBox(house, { x: 1.64, y: 0.075, z: 0.16 }, { x: -0.02, y: -0.57, z: 0.42 }, roofMaterial);
      addBox(house, { x: 1.56, y: 0.045, z: 0.055 }, { x: -0.02, y: -0.47, z: 0.58 }, trimMaterial);
      [
        [-0.73, 0.39],
        [0.61, 0.39],
        [-0.73, -0.34],
        [0.61, -0.34],
      ].forEach(([x, z]) => addBox(house, { x: 0.038, y: 0.72, z: 0.038 }, { x, y: -0.06, z }, trimMaterial));
      addBox(house, { x: 0.05, y: 0.54, z: 0.52 }, { x: 0.7, y: -0.08, z: 0.08 }, roomWallMaterial);
      addBox(house, { x: 0.042, y: 0.58, z: 0.64 }, { x: 0.76, y: -0.06, z: 0.08 }, trimMaterial);
      addBox(house, { x: 0.035, y: 0.42, z: 0.42 }, { x: 0.79, y: -0.06, z: 0.18 }, interiorMaterial);
      [
        { side: 1, windowY: -0.02, windowZ: 0.08 },
        { side: -1, windowY: -0.035, windowZ: 0.02 },
      ].forEach((sideWall) => {
        const sideX = sideWall.side * 0.988;
        addBox(house, { x: 0.018, y: 0.32, z: 0.46 }, { x: sideX, y: sideWall.windowY, z: sideWall.windowZ }, glassMaterial);
        addBox(
          house,
          { x: 0.038, y: 0.38, z: 0.034 },
          { x: sideX + sideWall.side * 0.014, y: sideWall.windowY, z: sideWall.windowZ - 0.24 },
          trimMaterial
        );
        addBox(
          house,
          { x: 0.038, y: 0.38, z: 0.034 },
          { x: sideX + sideWall.side * 0.014, y: sideWall.windowY, z: sideWall.windowZ + 0.24 },
          trimMaterial
        );
        addBox(
          house,
          { x: 0.038, y: 0.034, z: 0.52 },
          { x: sideX + sideWall.side * 0.014, y: sideWall.windowY + 0.19, z: sideWall.windowZ },
          trimMaterial
        );
        addBox(
          house,
          { x: 0.038, y: 0.034, z: 0.52 },
          { x: sideX + sideWall.side * 0.014, y: sideWall.windowY - 0.19, z: sideWall.windowZ },
          trimMaterial
        );
        addBox(
          house,
          { x: 0.022, y: 0.27, z: 0.15 },
          { x: sideX + sideWall.side * 0.028, y: sideWall.windowY - 0.02, z: sideWall.windowZ - 0.03 },
          interiorMaterial
        );
        addBox(
          house,
          { x: 0.026, y: 0.08, z: 0.22 },
          { x: sideX + sideWall.side * 0.04, y: sideWall.windowY - 0.13, z: sideWall.windowZ + 0.1 },
          blanketMaterial
        );
      });
      addBeveledBox(house, { x: 0.42, y: 0.055, z: 0.82 }, { x: 1.06, y: -0.52, z: 0.12 }, roofShadowMaterial, { bevel: 0.01 });
      addBeveledBox(house, { x: 0.36, y: 0.032, z: 0.72 }, { x: -1.06, y: -0.515, z: 0.05 }, cliffLineMaterial, { bevel: 0.01 });
      [
        { x: 1.05, z: -0.2, r: 0.18 },
        { x: 1.04, z: 0.34, r: -0.08 },
        { x: -1.04, z: -0.28, r: -0.12 },
      ].forEach((brace) => {
        const mesh = addBox(house, { x: 0.028, y: 0.4, z: 0.028 }, { x: brace.x, y: -0.32, z: brace.z }, roofShadowMaterial);
        mesh.rotation.z = brace.r;
      });
      addBox(house, { x: 1.5, y: 0.036, z: 0.05 }, { x: -0.06, y: 0.34, z: -0.255 }, trimMaterial);
      addBox(house, { x: 1.5, y: 0.03, z: 0.05 }, { x: -0.06, y: -0.39, z: -0.255 }, roofShadowMaterial);
      addBeveledBox(
        house,
        { x: outsideWindow.width - 0.04, y: outsideWindow.height + 0.04, z: 0.04 },
        { x: outsideWindow.x, y: outsideWindow.y, z: outsideWindow.z - 0.76 },
        new THREE.MeshStandardMaterial({ color: 0x172225, roughness: 0.65 }),
        { bevel: 0.008 }
      );
      addBox(
        house,
        { x: outsideWindow.width - 0.1, y: outsideWindow.height - 0.02, z: 0.018 },
        { x: outsideWindow.x, y: outsideWindow.y, z: outsideWindow.z - 0.042 },
        interiorMaterial
      );
      addBeveledBox(
        house,
        { x: outsideWindow.width, y: 0.045, z: 0.058 },
        { x: outsideWindow.x, y: outsideWindow.y + outsideWindow.height / 2 + 0.02, z: outsideWindow.z - 0.024 },
        trimMaterial,
        { bevel: 0.008 }
      );
      addBeveledBox(
        house,
        { x: outsideWindow.width, y: 0.045, z: 0.058 },
        { x: outsideWindow.x, y: outsideWindow.y - outsideWindow.height / 2 - 0.02, z: outsideWindow.z - 0.024 },
        trimMaterial,
        { bevel: 0.008 }
      );
      addBeveledBox(
        house,
        { x: 0.048, y: outsideWindow.height, z: 0.058 },
        { x: outsideWindow.x - outsideWindow.width / 2 - 0.02, y: outsideWindow.y, z: outsideWindow.z - 0.024 },
        trimMaterial,
        {
          bevel: 0.008,
        }
      );
      addBeveledBox(
        house,
        { x: 0.048, y: outsideWindow.height, z: 0.058 },
        { x: outsideWindow.x + outsideWindow.width / 2 + 0.02, y: outsideWindow.y, z: outsideWindow.z - 0.024 },
        trimMaterial,
        {
          bevel: 0.008,
        }
      );
      addBox(
        house,
        { x: outsideWindow.width - 0.14, y: outsideWindow.height - 0.08, z: 0.014 },
        { x: outsideWindow.x, y: outsideWindow.y, z: outsideWindow.z + 0.004 },
        glassMaterial
      );
      addBox(
        house,
        { x: 0.044, y: outsideWindow.height - 0.12, z: 0.054 },
        { x: outsideWindow.x, y: outsideWindow.y, z: outsideWindow.z + 0.014 },
        trimMaterial
      );
      addBox(
        house,
        { x: outsideWindow.width - 0.18, y: 0.034, z: 0.054 },
        { x: outsideWindow.x, y: outsideWindow.y, z: outsideWindow.z + 0.018 },
        trimMaterial
      );
      addBeveledBox(
        house,
        { x: outsideWindow.width, y: 0.042, z: 0.1 },
        { x: outsideWindow.x, y: outsideWindow.y - outsideWindow.height / 2 - 0.09, z: outsideWindow.z + 0.028 },
        trimMaterial,
        {
          bevel: 0.009,
        }
      );
      addBeveledBox(
        house,
        { x: outsideWindow.width - 0.34, y: 0.03, z: 0.1 },
        { x: outsideWindow.x, y: outsideWindow.y - outsideWindow.height / 2 + 0.03, z: outsideWindow.z + 0.118 },
        roofShadowMaterial,
        {
          bevel: 0.008,
        }
      );
      const interiorGlow = new THREE.Mesh(new THREE.PlaneGeometry(outsideWindow.width - 0.14, outsideWindow.height - 0.08), interiorGlowMaterial);
      interiorGlow.position.set(outsideWindow.x, outsideWindow.y, outsideWindow.z + 0.028);
      house.add(interiorGlow);
      [
        { x: -0.54, h: 0.46 },
        { x: 0.42, h: 0.42 },
      ].forEach((curtain) =>
        addBox(house, { x: 0.055, y: curtain.h, z: 0.018 }, { x: curtain.x, y: outsideWindow.y, z: outsideWindow.z + 0.045 }, curtainMaterial)
      );
      const balcony = new THREE.Group();
      balcony.position.set(-0.02, -0.48, 0.58);
      house.add(balcony);
      addBox(balcony, { x: 1.46, y: 0.04, z: 0.18 }, { x: 0, y: 0, z: 0 }, roofShadowMaterial);
      [-0.06, -0.02, 0.02, 0.06].forEach((z) => addBox(balcony, { x: 1.36, y: 0.009, z: 0.012 }, { x: 0, y: 0.027, z }, trimMaterial));
      addBox(balcony, { x: 1.32, y: 0.018, z: 0.055 }, { x: 0, y: 0.08, z: 0.106 }, trimMaterial);
      addBox(balcony, { x: 1.24, y: 0.022, z: 0.032 }, { x: 0, y: 0.22, z: 0.112 }, trimMaterial);
      [-0.58, -0.28, 0.02, 0.32, 0.58].forEach((x) => addBox(balcony, { x: 0.026, y: 0.28, z: 0.026 }, { x, y: 0.1, z: 0.112 }, trimMaterial));
      [0, 1].forEach((step) => {
        const tread = addBox(
          house,
          { x: 0.28 - step * 0.025, y: 0.012, z: 0.052 },
          { x: 0.54, y: -0.56 - step * 0.044, z: 0.75 + step * 0.068 },
          trimMaterial
        );
        tread.rotation.y = -0.08;
      });

      const room = new THREE.Group();
      room.position.set(-0.08, -0.03, 0.28);
      room.scale.set(1.36, 1.2, 1.24);
      house.add(room);
      [
        { x: -0.58, y: -0.04, z: -0.04, sx: 0.045, sy: 0.58, sz: 0.58, ry: -0.16 },
        { x: 0.52, y: -0.04, z: -0.04, sx: 0.04, sy: 0.54, sz: 0.54, ry: 0.14 },
        { x: -0.02, y: 0.22, z: -0.47, sx: 0.92, sy: 0.05, sz: 0.08, ry: 0 },
      ].forEach((rib) => {
        const mesh = addBox(room, { x: rib.sx, y: rib.sy, z: rib.sz }, rib, roomWallMaterial);
        mesh.rotation.y = rib.ry;
      });
      addBox(room, { x: 1.02, y: 0.035, z: 0.54 }, { x: -0.02, y: -0.34, z: 0.0 }, roomFloorMaterial);
      const miniOnsen = new THREE.Group();
      miniOnsen.position.set(-0.22, -0.25, -0.22);
      miniOnsen.rotation.y = 0.14;
      miniOnsen.scale.set(0.7, 0.72, 0.7);
      room.add(miniOnsen);
      addBeveledBox(miniOnsen, { x: 0.9, y: 0.06, z: 0.58 }, { x: 0, y: 0, z: 0 }, trimMaterial, { bevel: 0.006 });
      const miniPoolWall = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.18, 48, 1, true), cliffLineMaterial);
      miniPoolWall.scale.set(1.18, 1, 0.78);
      miniPoolWall.position.set(0, 0.12, 0);
      miniOnsen.add(miniPoolWall);
      const miniWater = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.018, 48), outsideWaterMaterial);
      miniWater.scale.set(1.18, 1, 0.78);
      miniWater.position.set(0, 0.21, 0);
      miniOnsen.add(miniWater);
      for (let index = 0; index < 10; index += 1) {
        const angle = (index / 10) * Math.PI * 2;
        const block = addBox(
          miniOnsen,
          { x: 0.08, y: 0.04, z: 0.05 },
          { x: Math.cos(angle) * 0.45, y: 0.21, z: Math.sin(angle) * 0.28 },
          index % 2 ? cliffLineMaterial : trimMaterial
        );
        block.rotation.y = -angle;
      }
      const miniLizard = new THREE.Group();
      miniLizard.position.set(-0.08, 0.24, -0.02);
      miniLizard.rotation.y = -0.36;
      miniOnsen.add(miniLizard);
      const miniBody = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), outsideLizardMaterial);
      miniBody.scale.set(1.34, 0.38, 0.84);
      miniLizard.add(miniBody);
      const miniHead = new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 12), outsideLizardMaterial);
      miniHead.scale.set(1.1, 0.92, 0.9);
      miniHead.position.set(-0.14, 0.055, -0.04);
      miniLizard.add(miniHead);
      const miniSnout = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), outsideLizardBellyMaterial);
      miniSnout.scale.set(1.2, 0.6, 0.86);
      miniSnout.position.set(-0.19, 0.048, -0.045);
      miniLizard.add(miniSnout);
      [-0.16, -0.22].forEach((x) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), hairMaterial);
        eye.position.set(x, 0.08, -0.09 + (x + 0.19) * 0.28);
        miniLizard.add(eye);
      });
      addBox(miniOnsen, { x: 0.36, y: 0.02, z: 0.14 }, { x: 0.28, y: 0.29, z: -0.1 }, roofMaterial);
      addBox(
        miniOnsen,
        { x: 0.2, y: 0.012, z: 0.12 },
        { x: 0.22, y: 0.315, z: -0.1 },
        new THREE.MeshStandardMaterial({ color: 0x1a1f22, roughness: 0.42, metalness: 0.2 })
      );
      const laptopScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), screenMaterial);
      laptopScreen.position.set(0.22, 0.39, -0.16);
      laptopScreen.rotation.set(-0.46, -0.08, 0);
      miniOnsen.add(laptopScreen);
      const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.044, 24, 14), lampMaterial);
      lampGlow.scale.set(1, 0.62, 1);
      lampGlow.position.set(-0.46, -0.02, 0.2);
      room.add(lampGlow);
      addBox(room, { x: 0.018, y: 0.08, z: 0.018 }, { x: -0.46, y: -0.08, z: 0.2 }, trimMaterial);

      const roomDesk = new THREE.Group();
      roomDesk.position.set(0.38, -0.14, 0.34);
      roomDesk.rotation.y = -0.46;
      roomDesk.scale.setScalar(1.04);
      room.add(roomDesk);
      const miniVinylMaterial = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.54, metalness: 0.04 });
      const miniPaperMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xfff3de : 0xfffbf2, roughness: 0.68 });
      const miniAccentMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe4b780 : 0xa96b3d, roughness: 0.52 });
      addBox(roomDesk, { x: 0.72, y: 0.045, z: 0.36 }, { x: 0, y: -0.035, z: 0.0 }, roofMaterial);
      [
        [-0.3, -0.13],
        [0.3, -0.13],
        [-0.3, 0.13],
        [0.3, 0.13],
      ].forEach(([x, z]) => addBox(roomDesk, { x: 0.035, y: 0.28, z: 0.035 }, { x, y: -0.18, z }, trimMaterial));
      addBox(roomDesk, { x: 0.28, y: 0.028, z: 0.2 }, { x: -0.2, y: 0.006, z: -0.02 }, trimMaterial);
      const miniRecord = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.018, 48), miniVinylMaterial);
      miniRecord.position.set(-0.22, 0.04, -0.02);
      roomDesk.add(miniRecord);
      const miniLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.021, 32), miniPaperMaterial);
      miniLabel.position.set(-0.22, 0.054, -0.02);
      roomDesk.add(miniLabel);
      addBox(roomDesk, { x: 0.2, y: 0.012, z: 0.09 }, { x: 0.12, y: 0.035, z: -0.08 }, miniPaperMaterial);
      addBox(roomDesk, { x: 0.2, y: 0.012, z: 0.09 }, { x: 0.18, y: 0.039, z: 0.05 }, miniPaperMaterial);
      const miniCup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.047, 0.11, 32), bedMaterial);
      miniCup.position.set(0.31, 0.072, 0.08);
      roomDesk.add(miniCup);
      records.slice(0, 4).forEach((recordItem, index) => {
        const sleeveGroup = new THREE.Group();
        sleeveGroup.position.set(-0.06 + index * 0.055, 0.12 + index * 0.002, -0.18 - index * 0.01);
        sleeveGroup.rotation.set(-0.1, -0.24 + index * 0.08, 0.04);
        roomDesk.add(sleeveGroup);
        addBeveledBox(sleeveGroup, { x: 0.116, y: 0.15, z: 0.014 }, { x: 0, y: 0, z: -0.006 }, miniPaperMaterial, { bevel: 0.003 });
        const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, side: THREE.DoubleSide });
        const sleeve = new THREE.Mesh(new THREE.PlaneGeometry(0.106, 0.14), sleeveMaterial);
        sleeve.position.set(0, 0, 0.004);
        sleeveGroup.add(sleeve);
        loadTexture(recordItem.cover || recordItem.src, sleeveMaterial);
      });
      addBox(roomDesk, { x: 0.04, y: 0.012, z: 0.16 }, { x: 0.29, y: 0.07, z: -0.08 }, miniAccentMaterial);

      returnInsideGroup = new THREE.Group();
      returnInsideGroup.position.set(0.92, 0.16, 0.92);
      outsideGroup.add(returnInsideGroup);
      const returnGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.46, 0.86),
        new THREE.MeshBasicMaterial({
          color: palette.isDarkTheme ? 0xffd6a1 : 0xfff0ca,
          transparent: true,
          opacity: palette.isDarkTheme ? 0.12 : 0.12,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        })
      );
      themeMaterials.outsideReturnGlow = returnGlow.material;
      returnGlow.renderOrder = 3;
      returnGlow.position.set(-0.06, 0.0, 0.018);
      returnInsideGroup.add(returnGlow);
      outsideMotionItems.push({
        key: "returnGlow",
        mesh: returnGlow,
        material: returnGlow.material,
        baseY: returnGlow.position.y,
        speedX: 0,
        speedY: 0,
        offsetX: 0,
        offsetY: 0,
        amplitude: 0.004,
        frequency: 1.55,
        phase: 0.65,
        baseRotationZ: returnGlow.rotation.z,
        rotationAmplitude: 0.004,
        baseScaleX: returnGlow.scale.x,
        baseScaleY: returnGlow.scale.y,
        baseScaleZ: returnGlow.scale.z,
        scaleAmplitude: 0.034,
        scaleFrequency: 1.18,
        baseOpacity: returnGlow.material.opacity,
        opacityAmplitude: 0.045,
        opacityFrequency: 1.36,
      });
      const returnHit = new THREE.Mesh(
        new THREE.PlaneGeometry(1.62, 1.12),
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
      registerInteractive(returnHit, { kind: "returnInside", index: 0 }, returnEntry);
    };

    const addDeskGlints = (table, palette) => {
      const glintGeometry = new THREE.PlaneGeometry(0.12, 0.018);
      const glintMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xffe0aa : 0xfff1c7,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.24 : 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      themeMaterials.deskGlints = glintMaterial;
      const specs = [
        {
          x: -1.5,
          y: -0.088,
          z: -0.08,
          rx: -Math.PI / 2,
          rz: -0.36,
          scaleX: 0.78,
          scaleY: 0.62,
          phase: 0.2,
          speed: 2.2,
          driftSpeed: 0.8,
          drift: 0.008,
          lift: 0.004,
        },
        {
          x: -1.06,
          y: -0.12,
          z: 0.18,
          rx: -Math.PI / 2,
          rz: 0.28,
          scaleX: 0.56,
          scaleY: 0.5,
          phase: 1.1,
          speed: 1.8,
          driftSpeed: 0.7,
          drift: 0.006,
          lift: 0.004,
        },
        {
          x: -0.18,
          y: -0.214,
          z: 0.36,
          rx: -Math.PI / 2,
          rz: -0.05,
          scaleX: 0.52,
          scaleY: 0.48,
          phase: 2.2,
          speed: 1.5,
          driftSpeed: 0.9,
          drift: 0.005,
          lift: 0.003,
        },
        {
          x: 0.48,
          y: -0.216,
          z: 0.5,
          rx: -Math.PI / 2,
          rz: -0.12,
          scaleX: 0.62,
          scaleY: 0.52,
          phase: 2.8,
          speed: 1.7,
          driftSpeed: 0.74,
          drift: 0.006,
          lift: 0.003,
        },
        {
          x: 0.98,
          y: -0.212,
          z: -0.1,
          rx: -Math.PI / 2,
          rz: 0.16,
          scaleX: 0.58,
          scaleY: 0.5,
          phase: 3.6,
          speed: 1.9,
          driftSpeed: 0.86,
          drift: 0.006,
          lift: 0.003,
        },
        {
          x: 1.56,
          y: 0.166,
          z: 0.59,
          rx: -Math.PI / 2,
          rz: -0.26,
          scaleX: 0.46,
          scaleY: 0.42,
          phase: 4.2,
          speed: 2.4,
          driftSpeed: 0.65,
          drift: 0.004,
          lift: 0.002,
        },
        {
          x: 1.76,
          y: -0.224,
          z: 0.72,
          rx: -Math.PI / 2,
          rz: 0.32,
          scaleX: 0.42,
          scaleY: 0.38,
          phase: 4.9,
          speed: 2.0,
          driftSpeed: 0.82,
          drift: 0.004,
          lift: 0.002,
        },
        {
          x: -1.38,
          y: -0.152,
          z: -0.67,
          rx: -Math.PI / 2,
          rz: 0.08,
          scaleX: 0.4,
          scaleY: 0.38,
          phase: 5.7,
          speed: 1.6,
          driftSpeed: 0.72,
          drift: 0.004,
          lift: 0.003,
        },
      ];
      const glintMesh = new THREE.InstancedMesh(glintGeometry, glintMaterial, specs.length);
      glintMesh.renderOrder = 14;
      table.add(glintMesh);
      const item = { mesh: glintMesh, material: glintMaterial, specs, dummy: new THREE.Object3D() };
      accentMotionItems.push(item);
      updateAccentMotionItem(item, 0, false);
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

      const floorMaterial = new THREE.MeshBasicMaterial({ color: palette.floor, map: createRoomFloorTexture(palette), depthWrite: false });
      const woodMaterial = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.82, metalness: 0.02 });
      const woodEdgeMaterial = new THREE.MeshStandardMaterial({ color: palette.woodEdge, roughness: 0.86, metalness: 0.02 });
      const stoneMaterial = new THREE.MeshStandardMaterial({ color: palette.stone, roughness: 0.92, metalness: 0.01 });
      const stoneEdgeMaterial = new THREE.MeshStandardMaterial({ color: palette.stoneEdge, roughness: 0.94, metalness: 0.01 });
      const coffeeMaterial = new THREE.MeshStandardMaterial({ color: palette.coffee, roughness: 0.46 });
      const ceramicMaterial = new THREE.MeshStandardMaterial({ color: palette.ceramic, roughness: 0.42, metalness: 0.02 });
      const recordBaseMaterial = new THREE.MeshStandardMaterial({ color: palette.recordBase, roughness: 0.68, metalness: 0.08 });
      const vinylMaterial = new THREE.MeshStandardMaterial({ color: 0x101111, roughness: 0.5, metalness: 0.05 });
      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xd9c2a4 : 0xffffff,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.085 : 0.072,
        depthWrite: false,
      });
      const metalMaterial = new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.38, metalness: 0.42 });
      const darkArmMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x232728 : 0x343838, roughness: 0.42, metalness: 0.34 });
      const warmArmMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xd0a45f : 0xb9853d, roughness: 0.36, metalness: 0.28 });
      const cardEdgeMaterial = new THREE.MeshStandardMaterial({ color: palette.cardEdge, roughness: 0.72, metalness: 0.02 });
      const stainMaterial = new THREE.MeshBasicMaterial({
        color: palette.stain,
        transparent: true,
        opacity: palette.stainOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      themeMaterials.floor = floorMaterial;
      themeMaterials.wood = woodMaterial;
      themeMaterials.woodEdge = woodEdgeMaterial;
      themeMaterials.stone = stoneMaterial;
      themeMaterials.stoneEdge = stoneEdgeMaterial;
      themeMaterials.coffee = coffeeMaterial;
      themeMaterials.ceramic = ceramicMaterial;
      themeMaterials.recordBase = recordBaseMaterial;
      themeMaterials.metal = metalMaterial;
      themeMaterials.darkArm = darkArmMaterial;
      themeMaterials.warmArm = warmArmMaterial;
      themeMaterials.cardEdge = cardEdgeMaterial;
      themeMaterials.stain = stainMaterial;

      addWindow(palette);
      addOutsideVignette(palette);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.88, 5.88), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, roomFloorY, 0.56);
      rootGroup.add(floor);
      const floorSlab = addBeveledBox(rootGroup, { x: 5.94, y: 0.16, z: 5.94 }, { x: 0, y: roomFloorY - 0.09, z: 0.56 }, woodEdgeMaterial, {
        bevel: 0.035,
      });
      floorSlab.rotation.y = -0.012;

      const shellRibMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xcdb79a : 0xc8b59f,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.54 : 0.42,
        roughness: 0.92,
        metalness: 0.01,
      });
      themeMaterials.shellRib = shellRibMaterial;
      const shellSkinMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xd6c3a7 : 0xe5d6c2,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.28 : 0.22,
        roughness: 0.96,
        metalness: 0.01,
        side: THREE.DoubleSide,
      });
      themeMaterials.shellSkin = shellSkinMaterial;
      const rearShell = addCurvedShell(rootGroup, 3.12, 3.25, Math.PI * 0.08, Math.PI * 0.86, { x: -0.08, y: 0.04, z: -0.78 }, shellSkinMaterial, {
        scaleX: 1.18,
        scaleZ: 0.62,
        ry: Math.PI / 2,
        radialSegments: 72,
      });
      registerOrbitCutaway(rearShell, {
        cloneMaterial: false,
        baseOpacity: shellSkinMaterial.opacity,
        occludedOpacity: palette.isDarkTheme ? 0.1 : 0.07,
        yawStart: 0.18,
        yawEnd: Math.PI * 2 - 0.18,
      });
      [
        { radius: 2.94, tube: 0.04, y: roomFloorY + 0.04, z: -1.62, sx: 1.02, rz: 0.01 },
        { radius: 2.58, tube: 0.026, y: roomFloorY + 0.06, z: -1.34, sx: 0.96, rz: -0.018 },
      ].forEach((arch) => {
        const mesh = new THREE.Mesh(new THREE.TorusGeometry(arch.radius, arch.tube, 10, 96, Math.PI), shellRibMaterial);
        mesh.position.set(-0.08, arch.y, arch.z);
        mesh.rotation.z = arch.rz;
        mesh.scale.x = arch.sx;
        rootGroup.add(mesh);
      });

      const onsenStoneAccentMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x746756 : 0xc6b59f,
        roughness: 0.94,
        metalness: 0.01,
      });
      const onsenWaterMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x5aa4b8 : 0x9fdbe6,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.66 : 0.7,
        roughness: 0.32,
        metalness: 0.02,
      });
      const onsenSteamMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xf9dfc3 : 0xffffff,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.2 : 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const lizardMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x7fa55f : 0x5a9b4e, roughness: 0.72 });
      const lizardBellyMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xe7c990 : 0xf3d7a1, roughness: 0.68 });
      const lizardDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x101514, roughness: 0.58 });
      const lizardTowelMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0xf1d6b7 : 0xf7dec4, roughness: 0.76 });
      const chairWoodMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x8a5f3a : 0x9a663b, roughness: 0.5, metalness: 0.03 });
      const chairCushionMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xf2e8d6 : 0xfff5e6,
        roughness: 0.78,
        metalness: 0.01,
      });
      const chairBaseMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x15191a : 0x1d2021,
        roughness: 0.44,
        metalness: 0.32,
      });
      themeMaterials.onsenStone = onsenStoneAccentMaterial;
      themeMaterials.onsenWater = onsenWaterMaterial;
      themeMaterials.onsenSteam = onsenSteamMaterial;
      themeMaterials.chairWood = chairWoodMaterial;
      themeMaterials.chairCushion = chairCushionMaterial;
      themeMaterials.chairBase = chairBaseMaterial;

      const leftNookWall = addBox(rootGroup, { x: 0.42, y: 2.56, z: 3.52 }, { x: -2.62, y: -0.04, z: -0.05 }, stoneMaterial);
      leftNookWall.rotation.y = 0.08;
      registerOrbitCutaway(leftNookWall, { occludedOpacity: 0.08, yawStart: 0.32, yawEnd: Math.PI * 2 - 0.2 });
      const rearStoneShelf = addBox(rootGroup, { x: 2.88, y: 0.16, z: 0.42 }, { x: 0.52, y: -1.08, z: -1.38 }, stoneEdgeMaterial);
      rearStoneShelf.rotation.y = -0.04;
      const stoneHearth = addBox(rootGroup, { x: 1.14, y: 0.18, z: 0.66 }, { x: -1.78, y: -1.075, z: -0.76 }, stoneEdgeMaterial);
      stoneHearth.rotation.y = 0.12;
      [
        { x: -2.36, y: 0.18, z: -1.34, sx: 0.18, sy: 2.36, sz: 0.24, ry: -0.24 },
        { x: -2.12, y: 0.28, z: -1.52, sx: 0.18, sy: 2.2, sz: 0.22, ry: -0.12 },
        { x: -1.84, y: 0.38, z: -1.62, sx: 0.16, sy: 1.96, sz: 0.2, ry: 0.02 },
        { x: -1.52, y: 0.52, z: -1.62, sx: 0.14, sy: 1.64, sz: 0.18, ry: 0.16 },
      ].forEach((rib) => {
        const mesh = addBox(rootGroup, { x: rib.sx, y: rib.sy, z: rib.sz }, rib, stoneMaterial);
        mesh.rotation.y = rib.ry;
      });
      [
        { x: -2.88, y: 0.1, z: 0.9, sx: 0.3, sy: 2.28, sz: 1.16, ry: -0.5 },
        { x: -2.68, y: 0.24, z: 1.32, sx: 0.22, sy: 2.02, sz: 0.78, ry: -0.34 },
        { x: -2.32, y: 0.56, z: 1.58, sx: 0.18, sy: 1.42, sz: 0.5, ry: -0.16 },
        { x: 3.14, y: 0.12, z: -0.5, sx: 0.14, sy: 2.42, sz: 2.08, ry: 0.12 },
      ].forEach((rib) => {
        const mesh = addBox(rootGroup, { x: rib.sx, y: rib.sy, z: rib.sz }, rib, stoneMaterial);
        mesh.rotation.y = rib.ry;
        if (rib.x > 2.8 || rib.z > 0.8) registerOrbitCutaway(mesh, { occludedOpacity: 0.07, yawStart: 0.24, yawEnd: Math.PI * 2 - 0.24 });
      });
      const carvedCeiling = addBox(rootGroup, { x: 5.84, y: 0.09, z: 2.36 }, { x: -0.06, y: roomCeilingY + 0.22, z: -0.26 }, stoneEdgeMaterial);
      carvedCeiling.rotation.y = -0.035;
      registerOrbitCutaway(carvedCeiling, { occludedOpacity: 0.12, yawStart: 0.32, yawEnd: Math.PI * 2 - 0.32 });
      [
        { x: -1.72, z: -1.32, w: 0.96, ry: 0.1 },
        { x: -0.54, z: -1.38, w: 1.2, ry: 0.02 },
        { x: 0.82, z: -1.35, w: 1.34, ry: -0.04 },
        { x: 2.06, z: -1.2, w: 0.82, ry: -0.1 },
      ].forEach((beam) => {
        const mesh = addBox(rootGroup, { x: beam.w, y: 0.055, z: 0.1 }, { x: beam.x, y: roomCeilingY + 0.08, z: beam.z }, woodEdgeMaterial);
        mesh.rotation.y = beam.ry;
      });
      const stoneWindowBench = addBox(rootGroup, { x: 3.05, y: 0.12, z: 0.44 }, { x: 0.96, y: -1.12, z: -1.12 }, stoneEdgeMaterial);
      stoneWindowBench.rotation.y = -0.035;

      const galleryMatMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xf6ead6 : 0xfff5e8,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      const galleryBackMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x3e352c : 0x5f452d,
        roughness: 0.62,
        metalness: 0.08,
      });
      const galleryFrameMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xcda15c : 0xb78a42,
        roughness: 0.42,
        metalness: 0.18,
      });
      const sidePhotoFrameMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x7b5f43 : 0x8a6040,
        roughness: 0.58,
        metalness: 0.04,
      });
      const sidePhotoBackMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x2e3130 : 0x4d4035,
        roughness: 0.78,
        metalness: 0.02,
      });
      const frontWallCutaway = {
        baseOpacity: 1,
        occludedOpacity: 0.015,
        hideBelow: 0.03,
        yawStart: Math.PI * 1.76,
        yawEnd: Math.PI * 0.24,
      };
      const galleryWallMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xd9c6aa : 0xe7d6c0,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.78 : 0.72,
        roughness: 0.9,
        metalness: 0.01,
      });
      const galleryWall = addBeveledBox(rootGroup, { x: 2.78, y: 2.12, z: 0.12 }, { x: -0.38, y: 0.04, z: 3.68 }, galleryWallMaterial, {
        bevel: 0.018,
      });
      registerOrbitCutaway(galleryWall, {
        cloneMaterial: false,
        baseOpacity: galleryWallMaterial.opacity,
        occludedOpacity: 0.015,
        hideBelow: 0.03,
        yawStart: frontWallCutaway.yawStart,
        yawEnd: frontWallCutaway.yawEnd,
      });
      const rearBaseboard = addBeveledBox(rootGroup, { x: 2.94, y: 0.12, z: 0.16 }, { x: -0.38, y: -1.12, z: 3.57 }, woodEdgeMaterial, {
        bevel: 0.014,
      });
      rearBaseboard.rotation.y = -0.018;
      registerOrbitCutaway(rearBaseboard, {
        occludedOpacity: 0.025,
        yawStart: frontWallCutaway.yawStart,
        yawEnd: frontWallCutaway.yawEnd,
      });
      const rearTopTrim = addBeveledBox(rootGroup, { x: 2.66, y: 0.07, z: 0.12 }, { x: -0.38, y: 1.12, z: 3.58 }, stoneEdgeMaterial, {
        bevel: 0.012,
      });
      rearTopTrim.rotation.y = -0.018;
      registerOrbitCutaway(rearTopTrim, {
        occludedOpacity: 0.025,
        yawStart: frontWallCutaway.yawStart,
        yawEnd: frontWallCutaway.yawEnd,
      });
      createFramedPhotoEntry(
        rootGroup,
        {
          id: "lizard",
          src: siruiPhotoAssets.lizard,
          width: 0.5,
          height: 0.5,
          frame: 0.065,
          depth: 0.07,
          doubleSidedArt: true,
          position: { x: 0.22, y: 1.08, z: 3.55 },
          rotation: { y: Math.PI },
          visibilityOptions: { yawStart: Math.PI * 0.72, yawEnd: Math.PI * 1.62 },
          focusPosition: new THREE.Vector3(0.44, 0.48, -0.14),
          compactFocusPosition: new THREE.Vector3(0.28, 0.46, -0.06),
          focusRotation: new THREE.Euler(0, 0.02, 0),
          compactFocusRotation: new THREE.Euler(0, 0.02, 0),
          focusScale: new THREE.Vector3(1.22, 1.22, 1.22),
          targetRotationX: -0.03,
          targetRotationY: -0.1,
          focusLookAt: { x: 0.32, y: 0.48, z: -0.14 },
          camera: {
            from: sceneAnchors.room.defaultCamera.desktop,
            to: { x: 2.2, y: 1.14, z: 3.04 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 0.32, y: 0.48, z: -0.14 },
            fovFrom: 31,
            fovTo: 24,
          },
          compactCamera: {
            from: sceneAnchors.room.defaultCamera.compact,
            to: { x: 1.9, y: 1.04, z: 2.92 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 0.16, y: 0.46, z: -0.06 },
            fovFrom: 36,
            fovTo: 28,
          },
        },
        {
          frame: galleryFrameMaterial,
          back: galleryBackMaterial,
          mat: galleryMatMaterial,
          hit: hitMaterial,
          cueColor: palette.isDarkTheme ? 0xffd08b : 0xb76f38,
        }
      );

      const capyWallMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xcab69a : 0xddc7ad,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.7 : 0.62,
        roughness: 0.9,
        metalness: 0.01,
      });
      const capyWall = addBeveledBox(rootGroup, { x: 0.12, y: 1.58, z: 1.52 }, { x: 2.76, y: 0.08, z: 0.56 }, capyWallMaterial, {
        bevel: 0.016,
      });
      registerOrbitCutaway(capyWall, {
        cloneMaterial: false,
        baseOpacity: capyWallMaterial.opacity,
        occludedOpacity: 0.08,
        yawStart: 0.08,
        yawEnd: 1.3,
      });
      createFramedPhotoEntry(
        rootGroup,
        {
          id: "capy",
          src: siruiPhotoAssets.capy,
          width: 0.62,
          height: 0.62,
          frame: 0.065,
          depth: 0.052,
          position: { x: 2.685, y: 0.16, z: 0.58 },
          rotation: { y: -Math.PI / 2 },
          focusScale: new THREE.Vector3(1.08, 1.08, 1.08),
          targetRotationX: -0.02,
          targetRotationY: defaultRotation.y + Math.PI * 0.62,
          focusLookAt: { x: 2.66, y: 0.16, z: 0.58 },
          camera: {
            from: sceneAnchors.room.defaultCamera.desktop,
            to: { x: 1.24, y: 0.56, z: 1.16 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 2.66, y: 0.16, z: 0.58 },
            fovFrom: 31,
            fovTo: 25,
          },
          compactCamera: {
            from: sceneAnchors.room.defaultCamera.compact,
            to: { x: 1.2, y: 0.6, z: 1.22 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 2.66, y: 0.16, z: 0.58 },
            fovFrom: 36,
            fovTo: 28,
          },
        },
        {
          frame: sidePhotoFrameMaterial,
          back: sidePhotoBackMaterial,
          mat: galleryMatMaterial,
          hit: hitMaterial,
          cueColor: palette.isDarkTheme ? 0xffd08b : 0xb76f38,
        }
      );

      const addScaledSphere = (group, radius, position, scale, material, segments = 24) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(12, Math.floor(segments * 0.66))), material);
        mesh.scale.set(scale.x, scale.y, scale.z);
        mesh.position.set(position.x, position.y, position.z);
        group.add(mesh);
        return mesh;
      };

      const addTube = (group, points, radius, material, segments = 24) => {
        const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
        group.add(mesh);
        return mesh;
      };

      const addStarBase = (group, center, radius, material, options = {}) => {
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(options.hubRadius || 0.1, options.hubRadius || 0.1, options.hubHeight || 0.11, 32),
          material
        );
        hub.position.set(center.x, center.y + 0.08, center.z);
        group.add(hub);
        for (let index = 0; index < (options.legs || 5); index += 1) {
          const angle = (index / (options.legs || 5)) * Math.PI * 2 + (options.phase || 0);
          const leg = addBox(
            group,
            { x: radius, y: options.legHeight || 0.038, z: options.legDepth || 0.052 },
            {
              x: center.x + Math.cos(angle) * radius * 0.36,
              y: center.y,
              z: center.z + Math.sin(angle) * radius * 0.36,
            },
            material
          );
          leg.rotation.y = -angle;
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.022, 18), material);
          foot.position.set(center.x + Math.cos(angle) * radius * 0.82, center.y - 0.02, center.z + Math.sin(angle) * radius * 0.82);
          group.add(foot);
        }
        return hub;
      };

      const onsen = new THREE.Group();
      onsen.position.set(sceneAnchors.room.onsen.x, sceneAnchors.room.onsen.y, sceneAnchors.room.onsen.z);
      onsen.rotation.y = -0.18;
      onsen.scale.setScalar(0.48);
      rootGroup.add(onsen);

      const onsenBase = addBeveledBox(onsen, { x: 1.72, y: 0.18, z: 1.12 }, { x: 0, y: 0.02, z: 0 }, stoneEdgeMaterial, { bevel: 0.026 });
      onsenBase.rotation.y = -0.035;
      const poolWall = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.82, 0.34, 72, 1, true), onsenStoneAccentMaterial);
      poolWall.scale.set(1.18, 1, 0.78);
      poolWall.position.set(-0.02, 0.24, 0.01);
      onsen.add(poolWall);
      const basinShadow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.64, 0.16, 72),
        new THREE.MeshBasicMaterial({ color: 0x182323, transparent: true, opacity: 0.18 })
      );
      basinShadow.scale.set(1.18, 1, 0.78);
      basinShadow.position.set(-0.02, 0.25, 0.01);
      onsen.add(basinShadow);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 12, 96), stoneEdgeMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1.18, 0.78, 1);
      rim.position.set(-0.02, 0.43, 0.01);
      onsen.add(rim);
      for (let index = 0; index < 16; index += 1) {
        const angle = (index / 16) * Math.PI * 2;
        const block = addBox(
          onsen,
          { x: 0.18 + (index % 3) * 0.018, y: 0.08 + (index % 2) * 0.018, z: 0.12 },
          {
            x: -0.02 + Math.cos(angle) * 0.82,
            y: 0.38 + (index % 2) * 0.01,
            z: 0.01 + Math.sin(angle) * 0.53,
          },
          index % 2 ? stoneMaterial : onsenStoneAccentMaterial
        );
        block.rotation.y = -angle + 0.08 * Math.sin(index);
      }
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.6, 0.034, 96), onsenWaterMaterial);
      water.scale.set(1.18, 1, 0.78);
      water.position.set(-0.02, 0.43, 0.01);
      onsen.add(water);
      [0.26, 0.39, 0.5].forEach((radius, index) => {
        const ripple = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.004, 8, 72),
          new THREE.MeshBasicMaterial({
            color: palette.isDarkTheme ? 0xd4f2ff : 0xffffff,
            transparent: true,
            opacity: 0.18 - index * 0.035,
            depthWrite: false,
          })
        );
        ripple.rotation.x = Math.PI / 2;
        ripple.scale.set(1.18, 0.78, 1);
        ripple.position.set(-0.04 + index * 0.04, 0.455 + index * 0.004, -0.03 + index * 0.02);
        onsen.add(ripple);
      });

      const steamSpecs = [
        { x: -0.42, z: -0.06, h: 0.54, drift: -0.1 },
        { x: -0.12, z: 0.18, h: 0.62, drift: 0.08 },
        { x: 0.2, z: -0.1, h: 0.5, drift: 0.11 },
        { x: 0.44, z: 0.12, h: 0.46, drift: -0.06 },
      ];
      steamSpecs.forEach((steam, index) => {
        const mesh = addTube(
          onsen,
          [
            new THREE.Vector3(steam.x, 0.48, steam.z),
            new THREE.Vector3(steam.x + steam.drift * 0.34, 0.6 + index * 0.015, steam.z + 0.03),
            new THREE.Vector3(steam.x + steam.drift, 0.48 + steam.h, steam.z - 0.02),
          ],
          0.007 + index * 0.001,
          onsenSteamMaterial,
          22
        );
        mesh.renderOrder = 2;
      });

      const lizard = new THREE.Group();
      lizard.position.set(-0.17, 0.48, -0.02);
      lizard.rotation.y = -0.34;
      onsen.add(lizard);
      addScaledSphere(lizard, 1, { x: 0, y: -0.03, z: 0.02 }, { x: 0.3, y: 0.075, z: 0.18 }, lizardMaterial, 28);
      addScaledSphere(lizard, 1, { x: -0.23, y: 0.065, z: -0.07 }, { x: 0.14, y: 0.105, z: 0.12 }, lizardMaterial, 24);
      addScaledSphere(lizard, 1, { x: -0.31, y: 0.06, z: -0.08 }, { x: 0.07, y: 0.045, z: 0.06 }, lizardBellyMaterial, 18);
      addScaledSphere(lizard, 1, { x: -0.215, y: 0.085, z: -0.155 }, { x: 0.018, y: 0.022, z: 0.018 }, lizardDarkMaterial, 12);
      addScaledSphere(lizard, 1, { x: -0.31, y: 0.09, z: -0.125 }, { x: 0.018, y: 0.022, z: 0.018 }, lizardDarkMaterial, 12);
      addTube(
        lizard,
        [new THREE.Vector3(0.22, -0.02, 0.05), new THREE.Vector3(0.42, 0.0, 0.18), new THREE.Vector3(0.5, 0.04, 0.34)],
        0.025,
        lizardMaterial,
        22
      );
      [
        [new THREE.Vector3(-0.12, 0.02, -0.1), new THREE.Vector3(-0.28, 0.03, -0.32), new THREE.Vector3(-0.42, 0.04, -0.42)],
        [new THREE.Vector3(0.04, 0.01, 0.12), new THREE.Vector3(0.2, 0.035, 0.34), new THREE.Vector3(0.36, 0.04, 0.42)],
      ].forEach((points) => addTube(lizard, points, 0.018, lizardMaterial, 18));
      const towel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 44, Math.PI * 1.1), lizardTowelMaterial);
      towel.rotation.set(Math.PI / 2.2, 0.1, -0.42);
      towel.position.set(-0.23, 0.13, -0.08);
      lizard.add(towel);

      const ledge = new THREE.Group();
      ledge.position.set(0.74, 0.46, 0.36);
      ledge.rotation.y = -0.18;
      onsen.add(ledge);
      addBeveledBox(ledge, { x: 0.46, y: 0.055, z: 0.22 }, { x: 0, y: 0, z: 0 }, woodEdgeMaterial, { bevel: 0.012 });
      const cocktailGlassMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xcce8ef : 0xf4ffff,
        transparent: true,
        opacity: 0.38,
        roughness: 0.18,
        metalness: 0.02,
      });
      const cocktail = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.036, 0.13, 28), cocktailGlassMaterial);
      cocktail.position.set(0.1, 0.094, 0.01);
      ledge.add(cocktail);
      const drink = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.034, 0.04, 28),
        new THREE.MeshBasicMaterial({ color: 0xf0a75a, transparent: true, opacity: 0.62 })
      );
      drink.position.set(0.1, 0.13, 0.01);
      ledge.add(drink);
      const straw = addBox(ledge, { x: 0.012, y: 0.19, z: 0.012 }, { x: 0.145, y: 0.18, z: -0.01 }, warmArmMaterial);
      straw.rotation.z = -0.34;
      const citrus = addScaledSphere(ledge, 1, { x: 0.045, y: 0.155, z: 0.052 }, { x: 0.035, y: 0.01, z: 0.035 }, warmArmMaterial, 14);
      citrus.rotation.x = Math.PI / 2;

      const lapDesk = new THREE.Group();
      lapDesk.position.set(0.28, 0.55, -0.12);
      lapDesk.rotation.y = -0.16;
      onsen.add(lapDesk);
      addBeveledBox(lapDesk, { x: 0.78, y: 0.045, z: 0.34 }, { x: 0, y: 0, z: 0 }, woodMaterial, { bevel: 0.012 });
      addBox(lapDesk, { x: 0.72, y: 0.018, z: 0.035 }, { x: 0, y: 0.04, z: 0.17 }, warmArmMaterial);
      [-0.34, 0.34].forEach((x) => {
        const support = addBox(lapDesk, { x: 0.032, y: 0.24, z: 0.032 }, { x, y: -0.1, z: -0.12 }, chairBaseMaterial);
        support.rotation.z = x > 0 ? -0.1 : 0.1;
      });
      const onsenScreenMaterial = new THREE.MeshBasicMaterial({ map: createLaptopScreenTexture(palette), side: THREE.DoubleSide });
      themeMaterials.laptopScreens = themeMaterials.laptopScreens || [];
      themeMaterials.laptopScreens.push(onsenScreenMaterial);
      addBeveledBox(lapDesk, { x: 0.42, y: 0.025, z: 0.27 }, { x: -0.08, y: 0.052, z: 0.0 }, darkArmMaterial, { bevel: 0.006 });
      const laptopScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.27), onsenScreenMaterial);
      laptopScreen.position.set(-0.08, 0.205, -0.13);
      laptopScreen.rotation.x = -0.42;
      lapDesk.add(laptopScreen);
      [0, 1, 2, 3].forEach((row) =>
        addBox(lapDesk, { x: 0.28 - row * 0.04, y: 0.006, z: 0.01 }, { x: -0.08, y: 0.074 + row * 0.002, z: -0.03 + row * 0.035 }, warmArmMaterial)
      );

      const loungeCorner = new THREE.Group();
      loungeCorner.position.set(sceneAnchors.room.chair.x, sceneAnchors.room.chair.y, sceneAnchors.room.chair.z);
      loungeCorner.rotation.y = -0.68;
      loungeCorner.scale.setScalar(0.56);
      rootGroup.add(loungeCorner);
      const chairShadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.96, 64),
        new THREE.MeshBasicMaterial({ color: palette.shadow, transparent: true, opacity: palette.isDarkTheme ? 0.11 : 0.075, depthWrite: false })
      );
      chairShadow.rotation.x = -Math.PI / 2;
      chairShadow.scale.set(1.28, 0.62, 1);
      chairShadow.position.set(0.18, -0.12, 0.12);
      loungeCorner.add(chairShadow);
      addStarBase(loungeCorner, { x: 0, y: 0, z: 0 }, 0.62, chairBaseMaterial, {
        hubRadius: 0.078,
        hubHeight: 0.13,
        legHeight: 0.034,
        legDepth: 0.05,
      });
      const swivelPost = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.34, 28), chairBaseMaterial);
      swivelPost.position.set(0, 0.18, 0);
      loungeCorner.add(swivelPost);
      const seatShell = addCurvedShell(loungeCorner, 0.5, 0.78, Math.PI * 0.18, Math.PI * 0.66, { x: 0, y: 0.42, z: 0.02 }, chairWoodMaterial, {
        rz: Math.PI / 2,
        rx: -0.12,
        scaleX: 1.04,
        scaleZ: 0.86,
        radialSegments: 56,
      });
      seatShell.rotation.y = -0.02;
      addScaledSphere(loungeCorner, 1, { x: 0.02, y: 0.48, z: 0.08 }, { x: 0.43, y: 0.11, z: 0.34 }, chairCushionMaterial, 28);
      const backShell = addCurvedShell(loungeCorner, 0.56, 0.78, Math.PI * 0.08, Math.PI * 0.68, { x: -0.06, y: 0.78, z: -0.36 }, chairWoodMaterial, {
        rz: Math.PI / 2,
        rx: -0.74,
        scaleX: 1.05,
        scaleZ: 0.74,
        radialSegments: 56,
      });
      backShell.rotation.y = -0.03;
      addScaledSphere(loungeCorner, 1, { x: -0.06, y: 0.82, z: -0.26 }, { x: 0.42, y: 0.16, z: 0.22 }, chairCushionMaterial, 28).rotation.x = -0.32;
      const headShell = addCurvedShell(loungeCorner, 0.42, 0.62, Math.PI * 0.06, Math.PI * 0.62, { x: -0.08, y: 1.08, z: -0.54 }, chairWoodMaterial, {
        rz: Math.PI / 2,
        rx: -0.82,
        scaleX: 1.08,
        scaleZ: 0.66,
        radialSegments: 48,
      });
      headShell.rotation.y = -0.04;
      addScaledSphere(loungeCorner, 1, { x: -0.08, y: 1.12, z: -0.47 }, { x: 0.32, y: 0.1, z: 0.16 }, chairCushionMaterial, 24).rotation.x = -0.28;
      [
        { x: -0.42, y: 0.62, z: -0.08, side: -1 },
        { x: 0.42, y: 0.62, z: -0.08, side: 1 },
      ].forEach((arm) => {
        addTube(
          loungeCorner,
          [new THREE.Vector3(arm.x, 0.35, 0.18), new THREE.Vector3(arm.x + arm.side * 0.02, 0.54, -0.08), new THREE.Vector3(arm.x, 0.7, -0.3)],
          0.022,
          chairBaseMaterial,
          26
        );
        const pad = addBeveledBox(loungeCorner, { x: 0.15, y: 0.055, z: 0.38 }, { x: arm.x, y: 0.67, z: -0.08 }, chairCushionMaterial, {
          bevel: 0.018,
        });
        pad.rotation.y = arm.side * 0.04;
      });

      const ottoman = new THREE.Group();
      ottoman.position.set(0.68, 0.02, 0.58);
      ottoman.rotation.y = 0.14;
      loungeCorner.add(ottoman);
      addStarBase(ottoman, { x: 0, y: -0.01, z: 0 }, 0.4, chairBaseMaterial, {
        hubRadius: 0.052,
        hubHeight: 0.09,
        legHeight: 0.026,
        legDepth: 0.04,
        phase: 0.32,
      });
      const ottomanPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.24, 24), chairBaseMaterial);
      ottomanPost.position.set(0, 0.12, 0);
      ottoman.add(ottomanPost);
      addCurvedShell(ottoman, 0.38, 0.58, Math.PI * 0.12, Math.PI * 0.72, { x: 0, y: 0.32, z: 0.02 }, chairWoodMaterial, {
        rz: Math.PI / 2,
        rx: -0.08,
        scaleX: 1.12,
        scaleZ: 0.78,
        radialSegments: 44,
      });
      addScaledSphere(ottoman, 1, { x: 0, y: 0.38, z: 0.04 }, { x: 0.35, y: 0.085, z: 0.24 }, chairCushionMaterial, 24);

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
      floorShadow.position.set(0.08, roomFloorY + 0.015, 0.82);
      rootGroup.add(floorShadow);
      const wovenRugMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xe2c59e : 0xc89564,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.12 : 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.26, 64), wovenRugMaterial);
      rug.rotation.x = -Math.PI / 2;
      rug.scale.set(1.55, 0.42, 1);
      rug.position.set(0.35, roomFloorY + 0.018, 0.72);
      rootGroup.add(rug);

      const table = new THREE.Group();
      table.position.set(sceneAnchors.room.desk.x, sceneAnchors.room.desk.y, sceneAnchors.room.desk.z);
      table.scale.set(0.86, 1, 0.82);
      rootGroup.add(table);
      addBox(table, { x: 4.08, y: 0.16, z: 1.68 }, { x: 0, y: -0.46, z: 0.18 }, woodMaterial);
      addBox(table, { x: 4.14, y: 0.08, z: 0.08 }, { x: 0, y: -0.39, z: 1.05 }, woodEdgeMaterial);
      [
        [-1.72, 0.82],
        [1.72, 0.82],
        [-1.72, -0.42],
        [1.72, -0.42],
      ].forEach(([x, z]) => addBox(table, { x: 0.14, y: 0.72, z: 0.14 }, { x, y: -0.84, z }, woodEdgeMaterial));
      const shelfGlowMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0xffc987 : 0xf5b067,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.16 : 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const shelfGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.22), shelfGlowMaterial);
      shelfGlow.position.set(-1.2, 0.16, -0.88);
      shelfGlow.rotation.x = -0.12;
      table.add(shelfGlow);
      const branchMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x4d684f : 0x597b52, roughness: 0.78 });
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 24), ceramicMaterial);
      vase.position.set(1.92, -0.2, -0.52);
      table.add(vase);
      [
        { x: -0.04, y: 0.14, z: -0.03, rx: 0.18, rz: -0.42 },
        { x: 0.02, y: 0.17, z: 0.0, rx: -0.12, rz: 0.28 },
        { x: 0.05, y: 0.13, z: 0.04, rx: 0.1, rz: 0.5 },
      ].forEach((leaf) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.012), branchMaterial);
        mesh.position.set(1.92 + leaf.x, -0.07 + leaf.y, -0.52 + leaf.z);
        mesh.rotation.set(leaf.rx, 0, leaf.rz);
        table.add(mesh);
      });

      const dogFrameMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x1f2425 : 0x222729, roughness: 0.5, metalness: 0.22 });
      const dogBackMaterial = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x0f1415 : 0x3c3027, roughness: 0.76, metalness: 0.03 });
      const dogMatMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xf4eadb : 0xfff8ed,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      const dogPhoto = createFramedPhotoEntry(
        table,
        {
          id: "dog",
          src: siruiPhotoAssets.dog,
          width: 0.42,
          height: 0.42,
          frame: 0.045,
          depth: 0.04,
          position: { x: 1.14, y: 0.02, z: -0.42 },
          rotation: { x: -0.08, y: -0.18, z: 0.02 },
          easel: true,
          focusPosition: new THREE.Vector3(0.78, 0.54, -0.08),
          compactFocusPosition: new THREE.Vector3(0.62, 0.46, -0.02),
          focusRotation: new THREE.Euler(0.01, -0.06, 0.0),
          compactFocusRotation: new THREE.Euler(0.02, -0.04, 0.0),
          focusScale: new THREE.Vector3(1.52, 1.52, 1.52),
          targetRotationX: -0.03,
          targetRotationY: -0.1,
          focusLookAt: { x: 1.04, y: 0.42, z: -0.92 },
          camera: {
            from: sceneAnchors.room.defaultCamera.desktop,
            to: { x: 2.2, y: 1.16, z: 2.96 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 1.04, y: 0.42, z: -0.92 },
            fovFrom: 31,
            fovTo: 24,
          },
          compactCamera: {
            from: sceneAnchors.room.defaultCamera.compact,
            to: { x: 1.92, y: 1.02, z: 2.9 },
            lookFrom: sceneAnchors.room.orbitTarget,
            lookAt: { x: 0.92, y: 0.38, z: -0.86 },
            fovFrom: 36,
            fovTo: 27,
          },
        },
        {
          frame: dogFrameMaterial,
          back: dogBackMaterial,
          mat: dogMatMaterial,
          hit: hitMaterial,
          cueColor: palette.isDarkTheme ? 0xffd08b : 0xb76f38,
        }
      );
      const dogPhotoShadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 40),
        new THREE.MeshBasicMaterial({
          color: palette.shadow,
          transparent: true,
          opacity: palette.isDarkTheme ? 0.16 : 0.1,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      dogPhotoShadow.rotation.x = -Math.PI / 2;
      dogPhotoShadow.scale.set(1.22, 0.42, 1);
      dogPhotoShadow.position.set(dogPhoto.basePosition.x, -0.266, dogPhoto.basePosition.z + 0.03);
      table.add(dogPhotoShadow);

      const player = new THREE.Group();
      player.position.set(-1.02, -0.29, 0.46);
      table.add(player);
      const playerBase = addBox(player, { x: 1.5, y: 0.16, z: 1.08 }, { x: 0, y: 0.02, z: 0 }, recordBaseMaterial);
      registerInteractive(playerBase, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      const turntableHit = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.08), hitMaterial);
      turntableHit.rotation.x = -Math.PI / 2;
      turntableHit.position.set(-0.12, 0.28, 0.02);
      player.add(turntableHit);
      registerInteractive(turntableHit, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.075, 112), metalMaterial);
      platter.position.set(-0.24, 0.115, 0);
      player.add(platter);
      const platterMat = new THREE.MeshStandardMaterial({ color: palette.isDarkTheme ? 0x2f3332 : 0xb9aa92, roughness: 0.42, metalness: 0.28 });
      const platterTop = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.03, 112), platterMat);
      platterTop.position.set(-0.24, 0.168, 0);
      player.add(platterTop);
      const rubberMatMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0x171b1c : 0x24282a,
        roughness: 0.72,
        metalness: 0.02,
      });
      const rubberMat = new THREE.Mesh(new THREE.CylinderGeometry(0.535, 0.54, 0.018, 112), rubberMatMaterial);
      rubberMat.position.set(-0.24, 0.194, 0);
      player.add(rubberMat);
      const platterLip = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.012, 10, 96), metalMaterial);
      platterLip.rotation.x = Math.PI / 2;
      platterLip.position.set(-0.24, 0.19, 0);
      player.add(platterLip);
      const platterTickMaterial = new THREE.MeshStandardMaterial({
        color: palette.isDarkTheme ? 0xd7caa7 : 0xf2e0bd,
        roughness: 0.46,
        metalness: 0.18,
      });
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2;
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.008, 0.006), platterTickMaterial);
        tick.position.set(-0.24 + Math.cos(angle) * 0.62, 0.216, Math.sin(angle) * 0.62);
        tick.rotation.y = -angle;
        player.add(tick);
      }
      recordGroup = new THREE.Group();
      recordGroup.position.set(-0.24, 0.224, 0.0);
      player.add(recordGroup);
      const record = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.055, 112), vinylMaterial);
      recordGroup.add(record);
      const recordLip = new THREE.Mesh(new THREE.TorusGeometry(0.495, 0.009, 8, 112), grooveMaterial);
      recordLip.rotation.x = Math.PI / 2;
      recordLip.position.y = 0.035;
      recordGroup.add(recordLip);
      [0.18, 0.235, 0.29, 0.32, 0.37, 0.415, 0.455].forEach((radius, index) => {
        const groove = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0026, 6, 96), grooveMaterial);
        groove.rotation.x = Math.PI / 2;
        groove.position.y = 0.038 + index * 0.0014;
        recordGroup.add(groove);
      });
      const recordWellMaterial = new THREE.MeshBasicMaterial({
        color: palette.isDarkTheme ? 0x000000 : 0x362717,
        transparent: true,
        opacity: palette.isDarkTheme ? 0.14 : 0.095,
        depthWrite: false,
      });
      const recordWell = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.008, 8, 84), recordWellMaterial);
      recordWell.rotation.x = Math.PI / 2;
      recordWell.position.y = 0.052;
      recordGroup.add(recordWell);
      recordLabelMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.02 });
      const recordLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.062, 72), recordLabelMaterial);
      recordLabel.position.y = 0.041;
      recordGroup.add(recordLabel);
      const labelRim = new THREE.Mesh(new THREE.TorusGeometry(0.323, 0.011, 8, 72), warmArmMaterial);
      labelRim.rotation.x = Math.PI / 2;
      labelRim.position.y = 0.078;
      recordGroup.add(labelRim);
      const labelInnerRim = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.0055, 8, 52), warmArmMaterial);
      labelInnerRim.rotation.x = Math.PI / 2;
      labelInnerRim.position.y = 0.084;
      recordGroup.add(labelInnerRim);
      const centerHole = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 32), darkArmMaterial);
      centerHole.position.y = 0.091;
      recordGroup.add(centerHole);
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 32), metalMaterial);
      spindle.position.set(-0.24, 0.296, 0);
      player.add(spindle);
      const spindleHalo = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.006, 8, 42), warmArmMaterial);
      spindleHalo.rotation.x = Math.PI / 2;
      spindleHalo.position.set(-0.24, 0.346, 0);
      player.add(spindleHalo);
      const spindleCap = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 14), metalMaterial);
      spindleCap.scale.set(1, 0.36, 1);
      spindleCap.position.set(-0.24, 0.35, 0);
      player.add(spindleCap);
      const cueLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 24, 12),
        new THREE.MeshBasicMaterial({
          color: palette.isDarkTheme ? 0xffd28a : 0xc47b32,
          transparent: true,
          opacity: palette.isDarkTheme ? 0.58 : 0.4,
        })
      );
      cueLamp.scale.set(1, 0.34, 1);
      cueLamp.position.set(0.28, 0.218, 0.34);
      player.add(cueLamp);
      registerInteractive(record, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });
      registerInteractive(recordLabel, { kind: "turntable", index: 0 }, { kind: "turntable", group: player });

      toneArmGroup = new THREE.Group();
      toneArmGroup.position.set(0.58, 0.365, 0.42);
      toneArmGroup.rotation.y = 0.46;
      player.add(toneArmGroup);
      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 36), metalMaterial);
      toneArmGroup.add(pivot);
      const pivotRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 8, 44), warmArmMaterial);
      pivotRing.rotation.x = Math.PI / 2;
      pivotRing.position.y = 0.045;
      toneArmGroup.add(pivotRing);
      const pivotCap = new THREE.Mesh(new THREE.SphereGeometry(0.074, 24, 14), metalMaterial);
      pivotCap.scale.set(1, 0.42, 1);
      pivotCap.position.y = 0.074;
      toneArmGroup.add(pivotCap);
      const counterWeight = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.11, 32), metalMaterial);
      counterWeight.rotation.z = Math.PI / 2;
      counterWeight.position.set(0.12, 0.008, 0.1);
      toneArmGroup.add(counterWeight);
      const counterWeightRim = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.006, 8, 32), darkArmMaterial);
      counterWeightRim.rotation.y = Math.PI / 2;
      counterWeightRim.position.set(0.18, 0.008, 0.1);
      toneArmGroup.add(counterWeightRim);
      [-0.024, 0, 0.024].forEach((offset) => {
        const counterTick = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.052, 0.003), warmArmMaterial);
        counterTick.position.set(0.18 + offset, 0.086, 0.1);
        counterTick.rotation.z = Math.PI / 2;
        toneArmGroup.add(counterTick);
      });
      const armRest = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.18, 24), darkArmMaterial);
      armRest.position.set(-0.12, -0.01, 0.04);
      armRest.rotation.z = -0.2;
      toneArmGroup.add(armRest);
      const armRestFelt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.19, 24), rubberMatMaterial);
      armRestFelt.position.set(-0.122, 0.018, 0.04);
      armRestFelt.rotation.z = -0.2;
      toneArmGroup.add(armRestFelt);
      const armCurve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0.015, 0.02, -0.055),
          new THREE.Vector3(-0.16, 0.023, -0.22),
          new THREE.Vector3(-0.36, 0.018, -0.43),
          new THREE.Vector3(-0.52, 0.006, -0.58),
        ],
        false,
        "catmullrom",
        0.5
      );
      const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 44, 0.018, 10, false), metalMaterial);
      toneArmGroup.add(arm);
      const armHighlight = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 44, 0.006, 8, false), warmArmMaterial);
      armHighlight.position.y = 0.018;
      toneArmGroup.add(armHighlight);
      const headshell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.13), warmArmMaterial);
      headshell.position.set(-0.565, 0.002, -0.615);
      headshell.rotation.y = -0.38;
      toneArmGroup.add(headshell);
      [
        [-0.6, 0.03, -0.59],
        [-0.545, 0.03, -0.642],
      ].forEach(([x, y, z]) => {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 14), darkArmMaterial);
        screw.position.set(x, y, z);
        screw.rotation.x = Math.PI / 2;
        toneArmGroup.add(screw);
      });
      const cartridge = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.04, 0.075), darkArmMaterial);
      cartridge.position.set(-0.63, -0.034, -0.68);
      cartridge.rotation.y = -0.38;
      toneArmGroup.add(cartridge);
      const cantileverCurve = new THREE.CatmullRomCurve3(
        [new THREE.Vector3(-0.64, -0.048, -0.69), new THREE.Vector3(-0.655, -0.07, -0.706), new THREE.Vector3(-0.666, -0.103, -0.718)],
        false,
        "catmullrom",
        0.48
      );
      const cantilever = new THREE.Mesh(new THREE.TubeGeometry(cantileverCurve, 16, 0.0045, 8, false), warmArmMaterial);
      toneArmGroup.add(cantilever);
      const stylus = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.076, 16), darkArmMaterial);
      stylus.position.set(-0.665, -0.078, -0.718);
      stylus.rotation.x = Math.PI;
      toneArmGroup.add(stylus);
      const stylusTip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), warmArmMaterial);
      stylusTip.position.set(-0.665, -0.122, -0.718);
      toneArmGroup.add(stylusTip);
      const stylusGlint = new THREE.Mesh(
        new THREE.SphereGeometry(0.0065, 10, 8),
        new THREE.MeshBasicMaterial({ color: palette.isDarkTheme ? 0xffdf9f : 0xfff0c8, transparent: true, opacity: 0.88 })
      );
      stylusGlint.position.set(-0.676, -0.13, -0.724);
      toneArmGroup.add(stylusGlint);
      const stylusShadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 18),
        new THREE.MeshBasicMaterial({
          color: palette.isDarkTheme ? 0xd6b47c : 0x6d4827,
          transparent: true,
          opacity: palette.isDarkTheme ? 0.36 : 0.24,
          depthWrite: false,
        })
      );
      stylusShadow.rotation.x = -Math.PI / 2;
      stylusShadow.position.set(-0.67, -0.126, -0.72);
      toneArmGroup.add(stylusShadow);
      themeMaterials.stylusContact = stylusShadow.material;

      const albumRack = new THREE.Group();
      rootGroup.add(albumRack);
      const rackWallX = -2.34;
      const rackCenterY = 0.12;
      const rackCenterZ = 0.55;
      const rackSleeveYaw = Math.PI / 2 - 0.34;
      const rackSleeveNormal = new THREE.Vector3(Math.sin(rackSleeveYaw), 0, Math.cos(rackSleeveYaw));
      addBox(albumRack, { x: 0.08, y: 0.76, z: 1.28 }, { x: rackWallX - 0.04, y: rackCenterY + 0.12, z: rackCenterZ }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.16, y: 0.08, z: 1.3 }, { x: rackWallX + 0.08, y: rackCenterY - 0.23, z: rackCenterZ }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.16, y: 0.08, z: 1.22 }, { x: rackWallX + 0.09, y: rackCenterY + 0.49, z: rackCenterZ }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.14, y: 0.68, z: 0.08 }, { x: rackWallX + 0.08, y: rackCenterY + 0.1, z: rackCenterZ - 0.66 }, woodEdgeMaterial);
      addBox(albumRack, { x: 0.14, y: 0.68, z: 0.08 }, { x: rackWallX + 0.08, y: rackCenterY + 0.1, z: rackCenterZ + 0.66 }, woodEdgeMaterial);
      records.slice(0, 4).forEach((recordItem, index) => {
        const entry = { kind: "album", index, group: new THREE.Group(), thrown: false };
        entry.group.position.set(rackWallX + 0.14 + index * 0.01, rackCenterY + 0.1 + index * 0.012, rackCenterZ - 0.36 + index * 0.24);
        entry.group.rotation.set(-0.014, rackSleeveYaw + index * 0.014, -0.052 + index * 0.022);
        entry.basePosition = entry.group.position.clone();
        entry.baseRotation = entry.group.rotation.clone();
        entry.playPosition = new THREE.Vector3(2.12, 0.84, 0.9);
        entry.playRotation = new THREE.Euler(0.04, 0.02, 0.012);
        entry.compactPlayPosition = new THREE.Vector3(1.72, 0.8, 0.82);
        entry.compactPlayRotation = new THREE.Euler(0.05, -0.04, 0.024);
        entry.inspectPosition = new THREE.Vector3(-0.78, 0.62, 0.28);
        entry.inspectRotation = new THREE.Euler(-Math.PI / 2, 0.04, 0.08);
        entry.compactInspectPosition = new THREE.Vector3(-0.72, 0.54, 0.3);
        entry.compactInspectRotation = new THREE.Euler(-Math.PI / 2, 0.02, 0.06);
        entry.currentRestY = entry.basePosition.y;
        albumRack.add(entry.group);
        const sleeveBack = addBeveledBox(entry.group, { x: 0.44, y: 0.62, z: 0.048 }, { x: 0, y: 0, z: -0.018 }, cardEdgeMaterial, { bevel: 0.011 });
        const coverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.59), coverMaterial);
        cover.position.set(0, 0.01, 0.034);
        cover.renderOrder = 2;
        entry.group.add(cover);
        addBox(entry.group, { x: 0.032, y: 0.58, z: 0.056 }, { x: -0.238, y: 0, z: -0.006 }, cardEdgeMaterial);
        addBox(entry.group, { x: 0.38, y: 0.03, z: 0.054 }, { x: 0, y: -0.323, z: -0.006 }, cardEdgeMaterial);
        const albumCue = new THREE.Mesh(
          new THREE.PlaneGeometry(0.64, 0.84),
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
        const albumPlayLedge = new THREE.Group();
        albumPlayLedge.visible = false;
        addBox(albumPlayLedge, { x: 0.56, y: 0.035, z: 0.07 }, { x: 0, y: -0.335, z: 0.036 }, woodEdgeMaterial);
        addBox(albumPlayLedge, { x: 0.44, y: 0.018, z: 0.04 }, { x: 0, y: -0.29, z: 0.058 }, warmArmMaterial);
        entry.group.add(albumPlayLedge);
        entry.playLedge = albumPlayLedge;
        const albumShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.5, 48),
          new THREE.MeshBasicMaterial({
            color: palette.shadow,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        albumShadow.visible = false;
        albumShadow.renderOrder = -1;
        albumRack.add(albumShadow);
        entry.floorShadow = albumShadow;
        const albumHit = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.1), hitMaterial);
        albumHit.position.set(0, 0.04, 0.09);
        albumHit.rotation.x = -0.04;
        entry.group.add(albumHit);
        const rackSlotHit = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.96), hitMaterial);
        rackSlotHit.position
          .copy(entry.basePosition)
          .add(rackSleeveNormal.clone().multiplyScalar(0.07))
          .add(new THREE.Vector3(0, 0.02, 0));
        rackSlotHit.rotation.copy(entry.baseRotation);
        albumRack.add(rackSlotHit);
        entry.rackSlotHit = rackSlotHit;
        registerInteractive(sleeveBack, { kind: "album", index }, entry);
        registerInteractive(cover, { kind: "album", index }, entry);
        registerInteractive(albumHit, { kind: "album", index }, entry);
        registerInteractive(rackSlotHit, { kind: "album", index, rackSlot: true, projectionObject: rackSlotHit }, entry);
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
        const songShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.5, 48),
          new THREE.MeshBasicMaterial({
            color: palette.shadow,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        songShadow.visible = false;
        songShadow.renderOrder = -1;
        table.add(songShadow);
        songEntry.floorShadow = songShadow;
        addBeveledBox(songEntry.group, { x: 0.72, y: 0.018, z: 0.48 }, { x: 0, y: -0.014, z: 0 }, cardEdgeMaterial, { bevel: 0.006 });
        const songMaterial = new THREE.MeshStandardMaterial({
          map: createSongCardTexture(recordItem),
          roughness: 0.62,
          metalness: 0.01,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const song = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.44), songMaterial);
        song.rotation.x = -Math.PI / 2;
        song.position.y = 0.006;
        songEntry.group.add(song);
        const songCoverMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56, metalness: 0.01, side: THREE.DoubleSide });
        const songCover = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), songCoverMaterial);
        songCover.rotation.x = -Math.PI / 2;
        songCover.position.set(-0.22, 0.016, -0.03);
        songEntry.group.add(songCover);
        loadTexture(recordItem.cover || recordItem.src, songCoverMaterial);
        songCardEntries.push(songEntry);
      });

      artifacts.slice(0, 2).forEach((artifact, index) => {
        const entry = { kind: "artifact", index, url: artifact.url || "", group: new THREE.Group(), lifted: false };
        entry.group.position.set(index === 0 ? 0.42 : 1.22, -0.262 + index * 0.006, index === 0 ? 0.58 : 0.28);
        entry.group.rotation.set(index === 0 ? -0.08 : -0.06, 0, index === 0 ? -0.07 : 0.045);
        entry.basePosition = entry.group.position.clone();
        entry.baseRotation = entry.group.rotation.clone();
        entry.focusPosition = new THREE.Vector3(index === 0 ? -0.06 : 0.18, 0.72, index === 0 ? 0.2 : 0.0);
        entry.focusRotation = new THREE.Euler(1.13, -0.018, index === 0 ? -0.02 : 0.026);
        entry.currentRestY = entry.basePosition.y;
        table.add(entry.group);
        const base = addBeveledBox(entry.group, { x: 0.72, y: 0.038, z: 1.02 }, { x: 0, y: 0, z: 0 }, cardEdgeMaterial, { bevel: 0.009 });
        const topMaterial = new THREE.MeshBasicMaterial({
          map: createArtifactTexture(artifact, index, palette),
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        });
        const top = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), topMaterial);
        top.rotation.x = -Math.PI / 2;
        top.position.y = 0.045;
        top.renderOrder = 2;
        entry.group.add(top);
        const artifactCue = new THREE.Mesh(
          new THREE.PlaneGeometry(1.72, 0.9),
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
        const cardHit = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.42), hitMaterial);
        cardHit.rotation.x = -Math.PI / 2;
        cardHit.position.y = 0.082;
        entry.group.add(cardHit);
        const readingHit = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.18), hitMaterial);
        readingHit.position.set(0, 0.26, 0.02);
        entry.group.add(readingHit);
        registerInteractive(base, { kind: "artifact", index, url: entry.url }, entry);
        registerInteractive(top, { kind: "artifact", index, url: entry.url }, entry);
        registerInteractive(cardHit, { kind: "artifact", index, url: entry.url }, entry);
        registerInteractive(readingHit, { kind: "artifact", index, url: entry.url }, entry);
        const tableReadingHit = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 1.22), hitMaterial);
        tableReadingHit.position.set(entry.basePosition.x, 0.08, entry.basePosition.z + 0.08);
        tableReadingHit.rotation.z = entry.baseRotation.z;
        table.add(tableReadingHit);
        registerInteractive(tableReadingHit, { kind: "artifact", index, url: entry.url }, entry);
        artifactEntries.push(entry);
      });

      const tableRing = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.48, 72), stainMaterial);
      tableRing.rotation.x = -Math.PI / 2;
      tableRing.position.set(1.72, -0.271, 0.86);
      table.add(tableRing);
      [
        { x: 1.34, z: 0.96, s: 0.052 },
        { x: 2.02, z: 0.9, s: 0.04 },
        { x: 1.54, z: 0.5, s: 0.032 },
      ].forEach((drop) => {
        const droplet = new THREE.Mesh(new THREE.CircleGeometry(drop.s, 24), stainMaterial);
        droplet.rotation.x = -Math.PI / 2;
        droplet.position.set(drop.x, -0.268, drop.z);
        droplet.scale.set(1.4, 0.8, 1);
        table.add(droplet);
      });

      const cup = new THREE.Group();
      cup.position.set(1.9, -0.08, 0.92);
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
      const handleCurve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0.228, 0.132, 0.026),
          new THREE.Vector3(0.398, 0.118, 0.04),
          new THREE.Vector3(0.414, -0.08, 0.038),
          new THREE.Vector3(0.228, -0.136, 0.026),
        ],
        false,
        "catmullrom",
        0.58
      );
      const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 48, 0.018, 16, false), ceramicMaterial);
      cup.add(handle);
      [
        { y: 0.132, z: 0.026 },
        { y: -0.136, z: 0.026 },
      ].forEach((anchor) => {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 12), ceramicMaterial);
        pad.position.set(0.222, anchor.y, anchor.z);
        pad.scale.set(0.62, 1.14, 0.46);
        cup.add(pad);
      });
      mugMarkMaterial = new THREE.MeshBasicMaterial({
        map: createMugMarkTexture(palette),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.239, 0.226, 0.19, 64, 1, true, -0.9, 1.8), mugMarkMaterial);
      mark.position.set(0, -0.038, 0);
      cup.add(mark);

      addDeskGlints(table, palette);

      setActiveRecordInternal(activeRecordIndex);
      setToneArm(isRecordSpinning, true);
      setDroppedRecordState(droppedRecordIndices, { immediate: true });
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
      const armSceneNativeClickSuppressor = (duration = 360) => {
        suppressNextSceneClick = true;
        suppressSceneNativeClicksUntil = performance.now() + duration;
        container.setAttribute("data-desk-mode-lock-until", String(Date.now() + duration + 160));
      };

      const onPointerDown = (event) => {
        if (!isVisible || (event.pointerType === "mouse" && event.button !== 0)) return;
        window.getSelection?.()?.removeAllRanges?.();
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest("[data-home-desk-controls]")) {
          document.activeElement.blur();
        }
        const hit = pickObject(event);
        const hitEntry = hit?.homeDeskEntry || null;
        const draggableEntry = hitEntry && (hitEntry.kind === "album" || hitEntry.kind === "artifact") ? hitEntry : null;
        armSceneNativeClickSuppressor();
        pointerId = event.pointerId;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
        pointerMoved = false;
        activeEntry = draggableEntry;
        pointerTargetEntry = hitEntry;
        pointerActionKind = hit?.kind || "rotate";
        pointerMode = draggableEntry ? hit?.kind || draggableEntry.kind : "rotate";
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
          if (activeView === "outside") {
            targetRotationY = rotationStartY + deltaX * 0.003;
            targetRotationX = clamp(rotationStartX + deltaY * 0.0035, -0.42, 0.34);
          } else {
            targetRotationY = rotationStartY + deltaX * 0.003;
            targetRotationX = clampRoomPitch(rotationStartX + deltaY * 0.0035);
          }
        } else if (activeEntry?.kind === "album") {
          const lift = clamp(0.035 + Math.hypot(deltaX, deltaY) * 0.0003, 0.046, 0.11);
          activeEntry.group.position.set(
            activeEntry.dragStartPosition.x + clamp(deltaX * 0.003, -0.44, 0.44),
            activeEntry.dragStartPosition.y + lift,
            activeEntry.dragStartPosition.z + clamp(deltaY * 0.0026, -0.32, 0.34)
          );
          activeEntry.group.rotation.x = activeEntry.dragStartRotation.x + clamp(deltaY * -0.00045, -0.06, 0.06);
          activeEntry.group.rotation.y = activeEntry.dragStartRotation.y + clamp(deltaX * 0.00036, -0.052, 0.052);
          activeEntry.group.rotation.z = activeEntry.dragStartRotation.z + clamp(deltaX * 0.00115, -0.18, 0.18);
        } else if (activeEntry?.kind === "artifact") {
          const lift = clamp(0.06 + Math.hypot(deltaX, deltaY) * 0.00055, 0.08, 0.2);
          activeEntry.group.position.set(
            activeEntry.dragStartPosition.x + deltaX * 0.0038,
            activeEntry.dragStartPosition.y + lift,
            activeEntry.dragStartPosition.z + deltaY * 0.0038
          );
          activeEntry.group.rotation.z = activeEntry.dragStartRotation.z + deltaX * 0.002;
          activeEntry.group.rotation.x = activeEntry.dragStartRotation.x + clamp(deltaY * -0.0008, -0.12, 0.12);
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
        const clickedFocusedAlbum = !movedEnough && isPointerInFocusedAlbumInspectRegion(event);
        const clickedEntry = !movedEnough ? releasedEntry || pointerTargetEntry || (clickedFocusedAlbum ? focusedEntry : null) : releasedEntry;
        const clickedWindowRegion = !movedEnough && activeView === "desk" && isPointerInWindowRegion(event);

        if (!movedEnough && activeView === "outside" && isPointerInOutsideReturnRegion(event)) {
          enterDeskFromOutside();
        } else if (clickedEntry?.kind === "album") {
          if (movedEnough && Math.abs(deltaX) + Math.abs(deltaY) > 32) {
            throwAlbum(clickedEntry, deltaX || 1);
          } else if (focusedEntry === clickedEntry) {
            swapFocusedAlbum(clickedEntry);
          } else {
            focusAlbum(clickedEntry);
          }
        } else if (clickedWindowRegion && pointerActionKind !== "album" && pointerActionKind !== "artifact" && pointerActionKind !== "turntable") {
          setSceneView("outside");
        } else if (clickedEntry?.kind === "photo" && !movedEnough) {
          focusPhoto(clickedEntry);
        } else if (releasedEntry?.kind === "artifact") {
          const focusedLongEnough = performance.now() - focusedEntryAt > 1200;
          if (!movedEnough && focusedEntry === releasedEntry && releasedEntry.url && focusedLongEnough) {
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
                position: releasedEntry.basePosition
                  .clone()
                  .add(new THREE.Vector3(clamp(deltaX * 0.0011, -0.18, 0.18), 0.04, clamp(deltaY * 0.0011, -0.14, 0.18))),
                rotation: new THREE.Euler(
                  releasedEntry.baseRotation.x + 0.035,
                  releasedEntry.baseRotation.y,
                  releasedEntry.baseRotation.z + clamp(deltaX * 0.0008, -0.1, 0.1)
                ),
                scale: new THREE.Vector3(1.02, 1.02, 1.02),
              },
              360,
              { arcHeight: 0.05, wobbleZ: 0.025 }
            );
          }
        } else if (
          !movedEnough &&
          activeView === "desk" &&
          isPointerInWindowRegion(event) &&
          pointerActionKind !== "album" &&
          pointerActionKind !== "artifact" &&
          pointerActionKind !== "turntable"
        ) {
          setSceneView("outside");
        } else if (pointerActionKind === "turntable" && !movedEnough) {
          if (callbacks.toggleSpin) callbacks.toggleSpin();
          else {
            isRecordSpinning = !isRecordSpinning;
            setToneArm(isRecordSpinning);
          }
        } else if (pointerActionKind === "windowJump" && !movedEnough) {
          setSceneView("outside");
        } else if (pointerActionKind === "returnInside" && !movedEnough) {
          enterDeskFromOutside();
        } else if (pointerMode === "rotate" && !movedEnough && activeView === "desk" && (focusedEntry || targetZoomLevel > 0.04)) {
          clearFocusedEntry();
          targetZoomLevel = 0;
          targetRotationX = defaultRotation.x;
          targetRotationY = defaultRotation.y;
        }

        if (releasedEntry) releasedEntry.isDragging = false;
        activeEntry = null;
        pointerId = null;
        pointerMode = "";
        pointerActionKind = "";
        pointerTargetEntry = null;
        window.getSelection?.()?.removeAllRanges?.();
        container.classList.remove("is-dragging");
        setHoverEntry(null);
        scheduleFrame();
        armSceneNativeClickSuppressor();
        event.preventDefault();
      };

      const onPointerCancel = (event) => {
        if (event.pointerId !== pointerId) return;
        if (activeEntry) {
          activeEntry.isDragging = false;
          const droppedPose = activeEntry.kind === "album" ? getAlbumDroppedRestPose(activeEntry) : null;
          addTween(
            activeEntry.group,
            {
              position: (droppedPose?.position || activeEntry.basePosition).clone(),
              rotation: (droppedPose?.rotation || activeEntry.baseRotation).clone(),
              scale: (droppedPose?.scale || new THREE.Vector3(1, 1, 1)).clone(),
            },
            280
          );
        }
        activeEntry = null;
        pointerId = null;
        pointerMode = "";
        pointerActionKind = "";
        pointerTargetEntry = null;
        container.classList.remove("is-dragging");
        armSceneNativeClickSuppressor();
        event.preventDefault();
      };

      const suppressCanvasClick = (event) => {
        const eventTarget = event.target;
        const isStageClick = !stageElement || (eventTarget instanceof Node && stageElement.contains(eventTarget));
        if (!suppressNextSceneClick && (!isStageClick || performance.now() > suppressSceneNativeClicksUntil)) return;
        suppressNextSceneClick = false;
        suppressSceneNativeClicksUntil = 0;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      };

      const onWheel = (event) => {
        if (!isVisible) return;
        const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (!delta) return;
        if (activeView === "outside") {
          const outsideEntryZoom = getOutsideEntryZoom();
          targetZoomLevel = clamp(targetZoomLevel - delta * 0.00115, outsideEntryZoom, getOutsideMaxZoom());
          event.preventDefault();
          scheduleFrame();
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
        if (delta > 0 && targetZoomLevel <= 0.04) return;
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
      document.addEventListener("click", suppressCanvasClick, true);
      container.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("scroll", scheduleOutsideViewportCheck, { passive: true });
      window.addEventListener("resize", scheduleOutsideViewportCheck);
      cleanupListeners.push(
        () => canvas.removeEventListener("pointerdown", onPointerDown),
        () => canvas.removeEventListener("pointermove", onPointerMove),
        () => canvas.removeEventListener("pointerup", onPointerUp),
        () => canvas.removeEventListener("pointercancel", onPointerCancel),
        () => document.removeEventListener("click", suppressCanvasClick, true),
        () => container.removeEventListener("wheel", onWheel),
        () => window.removeEventListener("scroll", scheduleOutsideViewportCheck),
        () => window.removeEventListener("resize", scheduleOutsideViewportCheck)
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
          clearOutsideView();
          if (outsideViewportCheckFrame) {
            window.cancelAnimationFrame(outsideViewportCheckFrame);
            outsideViewportCheckFrame = 0;
          }
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
      setDroppedRecords(indices, options = {}) {
        setDroppedRecordState(indices, options);
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
        clearOutsideView();
        if (outsideViewportCheckFrame) window.cancelAnimationFrame(outsideViewportCheckFrame);
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
      }
    };

    const replayAllDroppedRecordCards = (options = {}) => {
      if (!pile || droppedRecords.size < records.length) return false;
      clearDroppedRecordCards();
      pile.hidden = false;
      ensureRecordHalo();

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
          window.setTimeout(clearDropState, 1560 + index * 80);
        }
      });

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
      if (cardCount === 0) pile.style.removeProperty("--record-card-pile-height");
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
      baseHeight: isCompactPile ? 13.4 : 16.8,
      bottomPad: isCompactPile ? 1.12 : 1.28,
      collisionGap: isCompactPile ? 0.34 : 0.42,
      collisionStep: isCompactPile ? 3.8 : 4.4,
      collisionXDrift: isCompactPile ? 0.2 : 0.26,
      projectedHeight: isCompactPile ? 5.2 : 6.2,
      projectedWidth: isCompactPile ? 10.1 : 12.9,
      zBase: isCompactPile ? 0.42 : 0.5,
      zStep: 0.045,
      slots: isCompactPile
        ? [
            { x: -4.68, y: 0.26, rotate: -3.2, tilt: 55.8, scale: 0.986 },
            { x: 4.7, y: 0.64, rotate: 3.6, tilt: 56.5, scale: 0.974 },
            { x: -4.28, y: 6.12, rotate: 4.2, tilt: 56.1, scale: 0.972 },
            { x: 4.5, y: 6.48, rotate: -4.6, tilt: 56.8, scale: 0.966 },
            { x: 0.2, y: 10.32, rotate: -1.6, tilt: 57, scale: 0.958 },
          ]
        : [
            { x: -9.72, y: 0.36, rotate: -3.4, tilt: 55.8, scale: 0.988 },
            { x: 9.76, y: 0.82, rotate: 3.8, tilt: 56.4, scale: 0.976 },
            { x: -8.16, y: 7.74, rotate: 4.4, tilt: 56.1, scale: 0.974 },
            { x: 8.4, y: 8.12, rotate: -4.8, tilt: 56.8, scale: 0.968 },
            { x: 0.26, y: 12.96, rotate: -1.8, tilt: 57.1, scale: 0.96 },
          ],
    });

    const cardFootprintsOverlap = (first, second, gap) =>
      first.left < second.right && first.right > second.left && first.top < second.bottom + gap && first.bottom + gap > second.top;

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
        let footprint = createCardFootprint(layout, profile);
        let attempts = 0;

        while (attempts < 8 && layouts.some((placed) => cardFootprintsOverlap(footprint, placed.footprint, profile.collisionGap))) {
          layout.y += profile.collisionStep;
          layout.x += side * profile.collisionXDrift;
          footprint = createCardFootprint(layout, profile);
          attempts += 1;
        }

        layouts.push({ ...layout, footprint });
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
      const openX = x * (isCompactPile ? 0.36 : 0.34);
      const openY = Math.max(isCompactPile ? -1.04 : -1.18, y - (isCompactPile ? 1.92 : 2.14));
      const openZ = z + (isCompactPile ? 4.45 : 5.15);
      card.style.setProperty(
        "--card-rest-transform",
        `translate3d(${x.toFixed(2)}rem, ${y.toFixed(2)}rem, ${z.toFixed(2)}rem) rotateZ(${rotate.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg) rotateY(${(side * -0.52).toFixed(2)}deg) scale(${scale.toFixed(3)})`
      );
      card.style.setProperty(
        "--card-open-transform",
        `translate3d(${openX.toFixed(2)}rem, ${openY.toFixed(2)}rem, ${openZ.toFixed(2)}rem) rotateZ(${(rotate * 0.28).toFixed(2)}deg) rotateX(5.2deg) rotateY(${(side * -1.6).toFixed(2)}deg) scale(${Math.min(1.048, scale + 0.038).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-impact",
        `translate3d(${(x + side * 0.09).toFixed(2)}rem, ${(y + 0.1).toFixed(2)}rem, ${Math.max(0.08, z - 0.08).toFixed(2)}rem) rotateZ(${(rotate + side * 0.24).toFixed(2)}deg) rotateX(${(tilt + 1.3).toFixed(2)}deg) rotateY(${(side * -0.44).toFixed(2)}deg) scale(${Math.min(1.006, scale + 0.006).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-bounce",
        `translate3d(${(x - side * 0.035).toFixed(2)}rem, ${(y - 0.015).toFixed(2)}rem, ${(z + 0.035).toFixed(2)}rem) rotateZ(${(rotate - side * 0.08).toFixed(2)}deg) rotateX(${(tilt - 0.28).toFixed(2)}deg) rotateY(${(side * -0.42).toFixed(2)}deg) scale(${Math.min(1.002, scale + 0.002).toFixed(3)})`
      );
      card.style.setProperty(
        "--card-drop-settle",
        `translate3d(${(x + side * 0.024).toFixed(2)}rem, ${(y + 0.018).toFixed(2)}rem, ${Math.max(0.1, z - 0.01).toFixed(2)}rem) rotateZ(${(rotate + side * 0.045).toFixed(2)}deg) rotateX(${(tilt + 0.18).toFixed(2)}deg) rotateY(${(side * -0.46).toFixed(2)}deg) scale(${Math.min(1.003, scale + 0.003).toFixed(3)})`
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
      card.style.setProperty(
        "--card-drop-land",
        `translate3d(${(dropSide * 0.14).toFixed(2)}rem, 0.68rem, 0.24rem) rotateZ(${(dropSide * -0.5).toFixed(2)}deg) rotateX(54deg) rotateY(${(dropSide * -0.3).toFixed(2)}deg) scale(0.996)`
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

    const dropRecordCard = async (options = {}) => {
      const targetIndex = Number.isInteger(options.index) ? ((options.index % records.length) + records.length) % records.length : recordIndex;
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

      if (options.autoAdvance !== false && options.reveal !== false && !isRecordEngaged && !isSpinning) {
        const nextIndex = getNextUndroppedRecordIndex(targetIndex);
        if (nextIndex !== targetIndex) {
          window.setTimeout(
            () => {
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
    setDeskMode("2d");
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
