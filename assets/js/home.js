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
    const armState = { rotation: 0.56, lift: 0.44 };
    const armTarget = { rotation: 0.56, lift: 0.44 };
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
      armTarget.rotation = playing ? -0.18 : 0.56;
      armTarget.lift = playing ? 0.28 : 0.48;
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

      const vinyl = new THREE.Mesh(new THREE.RingGeometry(0.62, 2.42, 192), vinylMaterial);
      recordGroup.add(vinyl);

      for (let index = 0; index < 38; index += 1) {
        const radius = 0.72 + index * 0.044;
        const groove = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.0032, 192), grooveMaterial);
        groove.position.z = 0.012 + index * 0.0006;
        recordGroup.add(groove);
      }

      const gloss = new THREE.Mesh(
        new THREE.CircleGeometry(2.26, 96, Math.PI * 0.12, Math.PI * 0.28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })
      );
      gloss.position.set(-0.1, 0.05, 0.032);
      recordGroup.add(gloss);

      const label = new THREE.Mesh(new THREE.CircleGeometry(0.58, 128), labelMaterial);
      label.position.z = 0.052;
      recordGroup.add(label);

      const labelRim = new THREE.Mesh(new THREE.RingGeometry(0.585, 0.615, 128), accentMaterial);
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
    let recordDisc = null;
    let recordLabelMaterial = null;
    let ambientLight = null;
    let keyLight = null;
    let sideLight = null;
    let themeObserver = null;
    let activeRecordIndex = 0;
    let isLoaded = false;
    let isLoading = false;
    let isVisible = false;
    let isDragging = false;
    let isRecordSpinning = false;
    let pointerId = null;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let rotationStartX = -0.07;
    let rotationStartY = -0.34;
    let rotationX = -0.07;
    let rotationY = -0.34;
    let targetRotationX = -0.07;
    let targetRotationY = -0.34;
    let dropStartedAt = 0;
    const textureCache = new Map();
    const droppedCards = [];
    const themeMaterials = {};

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
    const lerp = (from, to, progress) => from + (to - from) * progress;

    const readDeskPalette = () => {
      const isDarkTheme = root.getAttribute("data-theme") === "dark";
      return isDarkTheme
        ? {
            isDarkTheme,
            floor: 0x101a1b,
            wood: 0x8d6847,
            coffee: 0x58351f,
            ceramic: 0xf5eadb,
            recordBase: 0x8d826b,
            metal: 0x7d817e,
            shadow: 0x030708,
            shadowOpacity: 0.1,
            stain: 0xb47a47,
            stainOpacity: 0.16,
            wallLine: 0x324142,
            wallLineOpacity: 0.18,
            ambientColor: 0xded4c6,
            ambientIntensity: 1.18,
            keyIntensity: 1.78,
            sideColor: 0xb79270,
            sideIntensity: 0.48,
          }
        : {
            isDarkTheme,
            floor: 0xfaf4ef,
            wood: 0xa9784e,
            coffee: 0x5f3921,
            ceramic: 0xfffbf2,
            recordBase: 0xcabca0,
            metal: 0x787c7a,
            shadow: 0x6d4630,
            shadowOpacity: 0.035,
            stain: 0x8e552c,
            stainOpacity: 0.13,
            wallLine: 0xd4bfaa,
            wallLineOpacity: 0.18,
            ambientColor: 0xfffbf1,
            ambientIntensity: 1.08,
            keyIntensity: 1.95,
            sideColor: 0xffd6aa,
            sideIntensity: 0.62,
          };
    };

    const applyDeskPalette = () => {
      if (!THREE) return;
      const palette = readDeskPalette();
      themeMaterials.floor?.color.setHex(palette.floor);
      themeMaterials.wood?.color.setHex(palette.wood);
      themeMaterials.coffee?.color.setHex(palette.coffee);
      themeMaterials.ceramic?.color.setHex(palette.ceramic);
      themeMaterials.recordBase?.color.setHex(palette.recordBase);
      themeMaterials.metal?.color.setHex(palette.metal);
      themeMaterials.shadow?.color.setHex(palette.shadow);
      if (themeMaterials.shadow) themeMaterials.shadow.opacity = palette.shadowOpacity;
      themeMaterials.stain?.color.setHex(palette.stain);
      if (themeMaterials.stain) themeMaterials.stain.opacity = palette.stainOpacity;
      themeMaterials.wallLine?.color.setHex(palette.wallLine);
      if (themeMaterials.wallLine) themeMaterials.wallLine.opacity = palette.wallLineOpacity;
      ambientLight?.color.setHex(palette.ambientColor);
      if (ambientLight) ambientLight.intensity = palette.ambientIntensity;
      if (keyLight) keyLight.intensity = palette.keyIntensity;
      sideLight?.color.setHex(palette.sideColor);
      if (sideLight) sideLight.intensity = palette.sideIntensity;
      render();
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

    const needsRotationFrame = () => Math.abs(rotationX - targetRotationX) > 0.002 || Math.abs(rotationY - targetRotationY) > 0.002;

    const applyRootRotation = (immediate = false) => {
      if (!rootGroup) return;
      const speed = immediate || reduceMotion ? 1 : 0.12;
      rotationX += (targetRotationX - rotationX) * speed;
      rotationY += (targetRotationY - rotationY) * speed;
      if (immediate || reduceMotion) {
        rotationX = targetRotationX;
        rotationY = targetRotationY;
      }
      rootGroup.rotation.x = rotationX;
      rootGroup.rotation.y = rotationY;
    };

    const resize = () => {
      if (!renderer || !camera) return;
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || 1));
      const height = Math.max(1, Math.round(rect.height || width * 0.74));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.fov = width < 560 ? 34 : 32;
      camera.aspect = width / height;
      camera.position.set(width < 560 ? 3.35 : 4.4, width < 560 ? 2.05 : 2.38, width < 560 ? 7.65 : 8.25);
      camera.lookAt(0.06, -0.48, 0.14);
      camera.updateProjectionMatrix();
      if (rootGroup) {
        rootGroup.scale.setScalar(width < 560 ? 0.76 : 0.82);
        rootGroup.position.set(width < 560 ? -0.1 : -0.02, width < 560 ? -0.18 : -0.12, width < 560 ? 0.34 : 0.2);
      }
      render();
    };

    const scheduleFrame = () => {
      if (!isLoaded || animationFrame) return;
      animationFrame = window.requestAnimationFrame(tick);
    };

    const updateDroppedCards = (time) => {
      if (droppedCards.length === 0) return false;
      if (!dropStartedAt) dropStartedAt = time;
      let needsFrame = false;

      droppedCards.forEach((entry, index) => {
        const raw = reduceMotion ? 1 : clamp((time - dropStartedAt - index * 180) / 980, 0, 1);
        const progress = easeOutCubic(raw);
        const bounce = raw >= 0.74 ? Math.sin(((raw - 0.74) / 0.26) * Math.PI) * 0.06 * (1 - raw) : Math.sin(raw * Math.PI) * 0.18;

        entry.mesh.position.set(
          lerp(entry.start.x, entry.end.x, progress),
          lerp(entry.start.y, entry.end.y, progress) + bounce,
          lerp(entry.start.z, entry.end.z, progress)
        );
        entry.mesh.rotation.set(
          lerp(entry.start.rx, entry.end.rx, progress),
          lerp(entry.start.ry, entry.end.ry, progress),
          lerp(entry.start.rz, entry.end.rz, progress)
        );
        entry.mesh.scale.setScalar(lerp(0.78, 1, progress));
        needsFrame = needsFrame || raw < 1;
      });

      return needsFrame;
    };

    function tick(time) {
      animationFrame = null;
      if (!isLoaded) return;

      applyRootRotation();
      const keepDropping = isVisible && updateDroppedCards(time);

      if (recordDisc && isVisible && isRecordSpinning && !reduceMotion) {
        recordDisc.rotation.y = time * 0.0012;
      }

      render();

      if (isVisible && ((!reduceMotion && isRecordSpinning) || needsRotationFrame() || keepDropping)) {
        scheduleFrame();
      }
    }

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

    const createArtifactTexture = (artifact, index) =>
      makeCanvasTexture((context, width, height) => {
        const accent = index === 0 ? "#6f9d87" : "#6f98ad";
        context.clearRect(0, 0, width, height);
        drawRoundedRect(context, 18, 22, width - 36, height - 44, 34);
        context.fillStyle = index === 0 ? "#fffdf8" : "#fbfdff";
        context.fill();
        context.lineWidth = 7;
        context.strokeStyle = index === 0 ? "rgba(111,157,135,0.34)" : "rgba(111,152,173,0.34)";
        context.stroke();
        context.fillStyle = accent;
        context.globalAlpha = 0.18;
        context.beginPath();
        context.arc(width - 126, 100, 82, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = "#66727a";
        context.font = "700 38px ui-monospace, SFMono-Regular, Consolas, monospace";
        context.fillText((artifact.label || "Desk card").toUpperCase(), 68, 132);
        context.fillStyle = "#202528";
        context.font = "800 58px Inter, system-ui, sans-serif";
        const words = (artifact.title || "Research card").split(" ");
        let line = "";
        let y = 220;
        words.forEach((word, wordIndex) => {
          const next = `${line}${line ? " " : ""}${word}`;
          if (context.measureText(next).width > width - 160 && line) {
            context.fillText(line, 68, y);
            line = word;
            y += 68;
          } else {
            line = next;
          }
          if (wordIndex === words.length - 1) context.fillText(line, 68, y);
        });
      });

    const loadTexture = (src, material) => {
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

    const buildScene = () => {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
      renderer.domElement.className = "home-desk-corner-canvas";
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      textureLoader = new THREE.TextureLoader();

      const palette = readDeskPalette();

      ambientLight = new THREE.AmbientLight(palette.ambientColor, palette.ambientIntensity);
      keyLight = new THREE.DirectionalLight(0xffffff, palette.keyIntensity);
      keyLight.position.set(-3.2, 4.6, 5.9);
      sideLight = new THREE.DirectionalLight(palette.sideColor, palette.sideIntensity);
      sideLight.position.set(4.4, 1.8, 2.6);
      scene.add(ambientLight, keyLight, sideLight);

      rootGroup = new THREE.Group();
      rootGroup.rotation.set(rotationX, rotationY, 0);
      scene.add(rootGroup);

      const floorMaterial = new THREE.MeshBasicMaterial({
        color: palette.floor,
        depthWrite: false,
      });
      const woodMaterial = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.8, metalness: 0.02 });
      const coffeeMaterial = new THREE.MeshStandardMaterial({ color: palette.coffee, roughness: 0.46 });
      const ceramicMaterial = new THREE.MeshStandardMaterial({ color: palette.ceramic, roughness: 0.42, metalness: 0.02 });
      const recordBaseMaterial = new THREE.MeshStandardMaterial({ color: palette.recordBase, roughness: 0.66, metalness: 0.08 });
      const vinylMaterial = new THREE.MeshStandardMaterial({ color: 0x121313, roughness: 0.5, metalness: 0.05 });
      const metalMaterial = new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.38, metalness: 0.42 });
      const stainMaterial = new THREE.MeshBasicMaterial({
        color: palette.stain,
        transparent: true,
        opacity: palette.stainOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      themeMaterials.floor = floorMaterial;
      themeMaterials.wood = woodMaterial;
      themeMaterials.coffee = coffeeMaterial;
      themeMaterials.ceramic = ceramicMaterial;
      themeMaterials.recordBase = recordBaseMaterial;
      themeMaterials.metal = metalMaterial;
      themeMaterials.stain = stainMaterial;

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.8), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -1.22, 0.7);
      rootGroup.add(floor);

      const wallLineMaterial = new THREE.MeshBasicMaterial({
        color: palette.wallLine,
        transparent: true,
        opacity: palette.wallLineOpacity,
      });
      themeMaterials.wallLine = wallLineMaterial;
      const cornerLine = addBox(rootGroup, { x: 0.016, y: 2.88, z: 0.016 }, { x: 2.48, y: 0.32, z: -1.72 }, wallLineMaterial);
      cornerLine.renderOrder = -1;

      const floorShadowMaterial = new THREE.MeshBasicMaterial({
        color: palette.shadow,
        transparent: true,
        opacity: palette.shadowOpacity,
        depthWrite: false,
      });
      themeMaterials.shadow = floorShadowMaterial;
      const floorShadow = new THREE.Mesh(new THREE.CircleGeometry(2.3, 80), floorShadowMaterial);
      floorShadow.rotation.x = -Math.PI / 2;
      floorShadow.scale.set(1.18, 0.38, 1);
      floorShadow.position.set(0.1, -1.205, 1.0);
      rootGroup.add(floorShadow);

      const table = new THREE.Group();
      table.position.set(0, 0, 0.1);
      rootGroup.add(table);
      addBox(table, { x: 4.42, y: 0.17, z: 1.94 }, { x: 0, y: -0.46, z: 0.16 }, woodMaterial);
      [
        [-1.86, 0.86],
        [1.86, 0.86],
        [-1.86, -0.48],
        [1.86, -0.48],
      ].forEach(([x, z]) => addBox(table, { x: 0.14, y: 0.74, z: 0.14 }, { x, y: -0.84, z }, woodMaterial));

      const artifactTextures = artifacts.slice(0, 2).map((artifact, index) => createArtifactTexture(artifact, index));
      artifactTextures.forEach((texture, index) => {
        const card = new THREE.Mesh(
          new THREE.PlaneGeometry(1.78, 0.78),
          new THREE.MeshStandardMaterial({ map: texture, roughness: 0.64, metalness: 0.01, side: THREE.DoubleSide })
        );
        card.rotation.x = -Math.PI / 2;
        card.rotation.z = index === 0 ? -0.14 : 0.08;
        card.position.set(0.46 + index * 0.42, -0.335 + index * 0.006, 0.22 + index * 0.2);
        table.add(card);
      });

      const tableRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.48, 72), stainMaterial);
      tableRing.rotation.x = -Math.PI / 2;
      tableRing.position.set(1.54, -0.326, -0.34);
      table.add(tableRing);

      const cup = new THREE.Group();
      cup.position.set(1.54, -0.14, -0.34);
      table.add(cup);
      const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.42, 56, 1, true), ceramicMaterial);
      cup.add(cupBody);
      const cupTop = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 12, 64), ceramicMaterial);
      cupTop.rotation.x = Math.PI / 2;
      cupTop.position.y = 0.22;
      cup.add(cupTop);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.22, 56), coffeeMaterial);
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 0.226;
      cup.add(coffee);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 10, 34, Math.PI * 1.32), ceramicMaterial);
      handle.rotation.set(0, Math.PI / 2, 0.18);
      handle.position.set(0.28, 0.02, 0.02);
      cup.add(handle);

      const player = new THREE.Group();
      player.position.set(-1.28, -0.33, 0.02);
      table.add(player);
      addBox(player, { x: 1.72, y: 0.16, z: 1.24 }, { x: 0, y: 0.02, z: 0 }, recordBaseMaterial);
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.05, 96), vinylMaterial);
      platter.position.set(-0.18, 0.14, 0.02);
      player.add(platter);
      recordDisc = platter;
      recordLabelMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.02 });
      const recordLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.058, 64), recordLabelMaterial);
      recordLabel.position.set(-0.18, 0.18, 0.02);
      player.add(recordLabel);
      const playerArm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.72), metalMaterial);
      playerArm.position.set(0.46, 0.22, -0.22);
      playerArm.rotation.y = -0.55;
      player.add(playerArm);
      const playerHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.14), metalMaterial);
      playerHead.position.set(0.2, 0.22, -0.5);
      playerHead.rotation.y = -0.55;
      player.add(playerHead);

      const albumMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.54, side: THREE.DoubleSide });
      const album = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), albumMaterial);
      album.position.set(-1.75, 0.22, -0.72);
      album.rotation.y = 0.18;
      rootGroup.add(album);
      loadTexture(records[0]?.cover || records[0]?.src, albumMaterial);

      const cardFloorPositions = [
        { x: -1.42, y: -1.178, z: 1.82, rz: -0.3 },
        { x: -0.68, y: -1.172, z: 2.12, rz: 0.16 },
        { x: 0.12, y: -1.166, z: 1.9, rz: -0.04 },
      ];

      records.slice(0, 3).forEach((record, index) => {
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0.02, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), material);
        const end = cardFloorPositions[index] || cardFloorPositions[0];
        const start = { x: -2.02, y: 0.38 - index * 0.08, z: -0.72 + index * 0.03, rx: 0.16, ry: 0.38, rz: -0.2 + index * 0.16 };
        mesh.position.set(start.x, start.y, start.z);
        mesh.rotation.set(start.rx, start.ry, start.rz);
        rootGroup.add(mesh);
        droppedCards.push({
          mesh,
          start,
          end: { ...end, rx: -Math.PI / 2, ry: 0, rz: end.rz },
        });
        loadTexture(record.cover || record.src, material);
      });

      loadTexture(records[activeRecordIndex]?.src || records[activeRecordIndex]?.cover, recordLabelMaterial);

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
        themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      }

      const canvas = renderer.domElement;
      canvas.addEventListener("pointerdown", (event) => {
        if (!isVisible || (event.pointerType === "mouse" && event.button !== 0)) return;
        isDragging = true;
        pointerId = event.pointerId;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
        rotationStartX = targetRotationX;
        rotationStartY = targetRotationY;
        container.classList.add("is-dragging");
        canvas.setPointerCapture?.(pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!isDragging || event.pointerId !== pointerId) return;
        const deltaX = event.clientX - pointerStartX;
        const deltaY = event.clientY - pointerStartY;
        targetRotationY = clamp(rotationStartY + deltaX * 0.006, -0.82, 0.26);
        targetRotationX = clamp(rotationStartX + deltaY * 0.0035, -0.22, 0.18);
        scheduleFrame();
      });
      const endDrag = (event) => {
        if (event.pointerId !== pointerId) return;
        isDragging = false;
        pointerId = null;
        container.classList.remove("is-dragging");
      };
      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);
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
          dropStartedAt = 0;
          scheduleFrame();
        } else {
          stopLoop();
          render();
        }
      },
      setActiveRecord(index) {
        activeRecordIndex = (index + records.length) % records.length;
        if (!recordLabelMaterial) return;
        const record = records[activeRecordIndex];
        loadTexture(record?.src || record?.cover, recordLabelMaterial);
      },
      setSpinning(nextSpinning) {
        isRecordSpinning = nextSpinning;
        if (isVisible) scheduleFrame();
      },
      resetView() {
        targetRotationX = -0.07;
        targetRotationY = -0.34;
        scheduleFrame();
      },
      dispose() {
        stopLoop();
        if (resizeObserver) resizeObserver.disconnect();
        if (!resizeObserver) window.removeEventListener("resize", resize);
        if (themeObserver) themeObserver.disconnect();
        textureCache.forEach((texture) => texture.dispose());
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
    const artifactCards = Array.from(document.querySelectorAll(".home-artifact-card"))
      .slice(0, 2)
      .map((card) => ({
        label: card.querySelector(".home-artifact-copy > span")?.textContent?.trim() || "",
        title: card.querySelector(".home-artifact-copy strong")?.textContent?.trim() || "",
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
