(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEBUG_QUERY_KEY = "fruitSeed";
  const FRUIT_PASS_KEY = "siruiSecretFruitPass";

  const trigger = document.getElementById("sirui-secret-dog");
  const dialog = document.getElementById("sirui-secret-dialog");
  const closeButton = document.getElementById("sirui-secret-close");
  const form = document.getElementById("sirui-secret-form");
  const status = document.getElementById("sirui-secret-status");
  const fruitButtons = Array.from(document.querySelectorAll("[data-sirui-fruit]"));

  if (!trigger || !dialog || !closeButton || !form || !status || !fruitButtons.length) return;

  const secretUrl = trigger.dataset.secretUrl;
  const animationClasses = ["is-curious", "is-curious", "is-suspicious", "is-wiggle", "is-victory-roll", "is-glitch-secret"];
  const animationClassSet = new Set(animationClasses);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeAnimation = "";
  let resetTimer;
  let routeTimer;

  const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const mulberry32 = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  };

  const randomSeed = () => {
    const querySeed = new URLSearchParams(window.location.search).get(DEBUG_QUERY_KEY);
    if (querySeed) return querySeed;

    const bytes = new Uint32Array(2);
    window.crypto?.getRandomValues?.(bytes);
    const cryptoSeed = bytes[0] || bytes[1];
    if (cryptoSeed) return `${cryptoSeed}-${Date.now()}`;

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const randomBetween = (random, min, max) => min + (max - min) * random();
  const number = (value, precision = 2) => Number(value.toFixed(precision));

  const pointOnEllipse = (cx, cy, rx, ry, angle, radius = 1) => ({
    x: cx + Math.cos(angle) * rx * radius,
    y: cy + Math.sin(angle) * ry * radius,
  });

  const makeOrganicOval = (random, cx, cy, rx, ry, count = 18) => {
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const wobble = 1 + randomBetween(random, -0.055, 0.055) + Math.sin(angle * 2.4) * randomBetween(random, -0.018, 0.018);
      points.push(pointOnEllipse(cx, cy, rx, ry, angle, wobble));
    }

    let path = `M${number((points[0].x + points[1].x) / 2)} ${number((points[0].y + points[1].y) / 2)}`;
    for (let index = 1; index <= points.length; index += 1) {
      const current = points[index % points.length];
      const next = points[(index + 1) % points.length];
      path += `Q${number(current.x)} ${number(current.y)} ${number((current.x + next.x) / 2)} ${number((current.y + next.y) / 2)}`;
    }
    return `${path}Z`;
  };

  const makeSvg = (fruit, index, content) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", `sirui-secret-fruit-svg sirui-secret-fruit-svg-${fruit}`);
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = content;
    return svg;
  };

  const mangoArt = (random, index) => {
    const id = `sirui-secret-mango-${index}`;
    const body = makeOrganicOval(random, randomBetween(random, 33, 35), randomBetween(random, 32, 34), randomBetween(random, 18, 20), randomBetween(random, 21, 24));
    const cutX = number(randomBetween(random, 16, 19));
    const cutY = number(randomBetween(random, 37, 40));

    return makeSvg(
      "mango",
      index,
      `
        <defs>
          <linearGradient id="${id}-skin" x1="13" x2="53" y1="16" y2="51" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6f8f3d"></stop>
            <stop offset="44%" stop-color="#f4b43e"></stop>
            <stop offset="100%" stop-color="#bd4a32"></stop>
          </linearGradient>
          <linearGradient id="${id}-flesh" x1="12" x2="35" y1="34" y2="57" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ffe184"></stop>
            <stop offset="100%" stop-color="#f2a92e"></stop>
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="18" ry="4.2" fill="rgba(48, 35, 19, 0.16)"></ellipse>
        <path d="${body}" fill="url(#${id}-skin)" stroke="rgba(92, 48, 24, 0.34)" stroke-width="1.3"></path>
        <path d="M${cutX} ${cutY}C22 31 34 32 39 39C37 49 27 57 17 53C11 49 11 42 ${cutX} ${cutY}Z" fill="url(#${id}-flesh)" stroke="rgba(150, 87, 18, 0.38)" stroke-width="1"></path>
        <path d="M18 38L30 53M25 34L34 48M14 44L25 56M17 48C23 45 31 43 38 41M13 43C20 41 28 38 35 36" fill="none" stroke="rgba(141, 83, 17, 0.28)" stroke-linecap="round" stroke-width="0.85"></path>
        <path d="M22 20C27 14 37 12 45 18" fill="none" opacity="0.72" stroke="rgba(255, 239, 172, 0.72)" stroke-linecap="round" stroke-width="2.6"></path>
        <path d="M33 12C39 8 46 8 50 13C43 17 37 17 33 12Z" fill="#6e944d" stroke="#3e6f39" stroke-width="0.8"></path>
      `,
    );
  };

  const orangeArt = (random, index) => {
    const id = `sirui-secret-orange-${index}`;
    const body = makeOrganicOval(random, randomBetween(random, 34, 35), randomBetween(random, 34, 35), randomBetween(random, 18.5, 20), randomBetween(random, 18, 19.5));
    const pores = Array.from({ length: Math.round(randomBetween(random, 30, 42)) }, () => {
      const point = pointOnEllipse(34, 35, 16, 15, randomBetween(random, 0, Math.PI * 2), Math.sqrt(randomBetween(random, 0.02, 0.86)));
      const opacity = number(randomBetween(random, 0.16, 0.38), 3);
      return `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="${number(randomBetween(random, 0.2, 0.5))}" fill="rgba(255, 238, 181, ${opacity})"></circle>`;
    }).join("");

    return makeSvg(
      "orange",
      index,
      `
        <defs>
          <radialGradient id="${id}-rind" cx="32%" cy="26%" r="74%">
            <stop offset="0%" stop-color="#ffd984"></stop>
            <stop offset="58%" stop-color="#f58220"></stop>
            <stop offset="100%" stop-color="#c95818"></stop>
          </radialGradient>
        </defs>
        <ellipse cx="33" cy="55" rx="18" ry="4.4" fill="rgba(48, 28, 12, 0.15)"></ellipse>
        <path d="${body}" fill="url(#${id}-rind)" stroke="rgba(123, 56, 18, 0.34)" stroke-width="1.25"></path>
        <g opacity="0.85">${pores}</g>
        <circle cx="24" cy="39" r="11.6" fill="#ffbe37" stroke="rgba(255, 239, 187, 0.7)" stroke-width="2.2"></circle>
        <circle cx="24" cy="39" r="2" fill="#fff1b3"></circle>
        <path d="M24 28L24 50M13 39H35M16.4 31.5L31.6 46.5M31.6 31.5L16.4 46.5" fill="none" stroke="rgba(255, 244, 194, 0.78)" stroke-linecap="round" stroke-width="1.05"></path>
        <path d="M34 14Q36 9 41 8" fill="none" stroke="#81552e" stroke-linecap="round" stroke-width="2.1"></path>
        <path d="M35 15Q39 11 45 14Q40 18 35 15Z" fill="#74a85c" stroke="#447840" stroke-width="0.8"></path>
        <circle cx="35" cy="49" r="1.1" fill="rgba(113, 49, 13, 0.48)"></circle>
      `,
    );
  };

  const strawberryArt = (random, index) => {
    const id = `sirui-secret-strawberry-${index}`;
    const width = randomBetween(random, 0.92, 1.08);
    const body = `M32 56C19 47 ${number(13 - width)} 36 ${number(16 - width)} 25C19 14 28 18 32 23C36 17 46 14 49 25C52 36 45 48 32 56Z`;
    const seeds = Array.from({ length: Math.round(randomBetween(random, 24, 34)) }, () => {
      const y = randomBetween(random, 25, 49);
      const rowWidth = (50 - y) * 0.56 + 4;
      const x = randomBetween(random, 32 - rowWidth, 32 + rowWidth);
      const tilt = randomBetween(random, -18, 18);
      return `<ellipse cx="${number(x)}" cy="${number(y)}" rx="0.62" ry="1.08" fill="#ffe6a7" opacity="${number(randomBetween(random, 0.62, 0.9), 2)}" transform="rotate(${number(tilt)} ${number(x)} ${number(y)})"></ellipse>`;
    }).join("");

    return makeSvg(
      "strawberry",
      index,
      `
        <defs>
          <linearGradient id="${id}-berry" x1="20" x2="45" y1="18" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ff6b5d"></stop>
            <stop offset="58%" stop-color="#e73333"></stop>
            <stop offset="100%" stop-color="#a9192c"></stop>
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="56" rx="15" ry="3.6" fill="rgba(63, 19, 24, 0.15)"></ellipse>
        <path d="${body}" fill="url(#${id}-berry)" stroke="rgba(116, 20, 31, 0.4)" stroke-width="1.2"></path>
        <path d="M23 22Q18 16 14 15Q21 14 26 19Q27 13 31 10Q33 16 32 21Q38 14 46 14Q42 18 38 23Z" fill="#78a85f" stroke="#477942" stroke-linejoin="round" stroke-width="0.85"></path>
        <path d="M28 18Q31 13 34 9" fill="none" stroke="#81552e" stroke-linecap="round" stroke-width="1.7"></path>
        <g>${seeds}</g>
        <path d="M22 27C25 22 33 20 41 23" fill="none" opacity="0.38" stroke="#ffd0c2" stroke-linecap="round" stroke-width="2.6"></path>
      `,
    );
  };

  const bananaArt = (random, index) => {
    const id = `sirui-secret-banana-${index}`;
    const lift = number(randomBetween(random, -1.4, 1.4));

    return makeSvg(
      "banana",
      index,
      `
        <defs>
          <linearGradient id="${id}-banana" x1="12" x2="54" y1="28" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff19a"></stop>
            <stop offset="58%" stop-color="#f6d431"></stop>
            <stop offset="100%" stop-color="#dba719"></stop>
          </linearGradient>
        </defs>
        <ellipse cx="34" cy="56" rx="19" ry="4" fill="rgba(58, 44, 14, 0.15)"></ellipse>
        <path d="M14 ${number(36 + lift)}C23 49 43 55 55 40C50 55 25 61 11 42Z" fill="url(#${id}-banana)" stroke="rgba(126, 90, 12, 0.4)" stroke-width="1.15"></path>
        <path d="M13 ${number(30 + lift)}C26 43 46 46 55 29C52 46 25 52 10 35Z" fill="#ffe55b" stroke="rgba(126, 90, 12, 0.34)" stroke-width="1"></path>
        <path d="M15 ${number(24 + lift)}C29 33 45 34 52 20C50 35 28 41 12 29Z" fill="#f8d338" stroke="rgba(126, 90, 12, 0.34)" stroke-width="1"></path>
        <path d="M13 ${number(24 + lift)}Q10 21 13 18Q17 19 18 ${number(24 + lift)}Z" fill="#6f8e3f"></path>
        <path d="M52 20Q56 18 58 21Q57 25 53 27Z" fill="#74421d"></path>
        <path d="M18 39C29 47 43 49 52 40M18 31C29 38 42 38 50 29" fill="none" opacity="0.42" stroke="#fff4a5" stroke-linecap="round" stroke-width="1.4"></path>
        <path d="M11 ${number(42 + lift)}Q9 39 11 36" fill="none" stroke="#74421d" stroke-linecap="round" stroke-width="2"></path>
      `,
    );
  };

  const fruitArt = {
    banana: bananaArt,
    mango: mangoArt,
    orange: orangeArt,
    strawberry: strawberryArt,
  };

  const renderFruitArt = () => {
    const seed = randomSeed();
    document.querySelectorAll("[data-sirui-fruit-art]").forEach((slot, index) => {
      const fruit = slot.dataset.siruiFruitArt;
      const draw = fruitArt[fruit];
      if (!draw) return;

      const random = mulberry32(hashString(`${seed}-${fruit}-${index}`));
      slot.replaceChildren(draw(random, index));
    });
  };

  const safeSessionSet = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Visitors without sessionStorage simply return to the visible gate.
    }
  };

  const clearAnimation = () => {
    animationClassSet.forEach((className) => trigger.classList.remove(className));
    activeAnimation = "";
  };

  const startHoverAnimation = () => {
    window.clearTimeout(resetTimer);

    if (!finePointer.matches || reducedMotion.matches || activeAnimation) return;

    activeAnimation = animationClasses[Math.floor(Math.random() * animationClasses.length)];
    trigger.classList.add(activeAnimation);
  };

  const stopHoverAnimation = () => {
    if (!activeAnimation) return;

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(clearAnimation, 140);
  };

  const pulseTrigger = () => {
    if (reducedMotion.matches) return;

    window.clearTimeout(resetTimer);
    trigger.classList.remove("is-booping");
    void trigger.offsetWidth;
    trigger.classList.add("is-booping");
    window.setTimeout(() => trigger.classList.remove("is-booping"), 820);
  };

  const resetFruitState = () => {
    window.clearTimeout(routeTimer);
    form.classList.remove("is-unlocked");
    status.textContent = "";
    fruitButtons.forEach((button) => {
      button.disabled = false;
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
  };

  const openDialog = () => {
    pulseTrigger();
    resetFruitState();
    dialog.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    window.setTimeout(() => fruitButtons[0]?.focus(), 0);
  };

  const closeDialog = () => {
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  };

  const selectFruit = (button) => {
    const fruit = button?.dataset.siruiFruit || "fruit";
    fruitButtons.forEach((fruitButton) => {
      const selected = fruitButton === button;
      fruitButton.disabled = true;
      fruitButton.classList.toggle("is-selected", selected);
      fruitButton.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    form.classList.add("is-unlocked");
    status.textContent = "wow, you guessed correctly!";
    safeSessionSet(
      FRUIT_PASS_KEY,
      JSON.stringify({
        fruit,
        unlockedAt: Date.now(),
      }),
    );
    routeTimer = window.setTimeout(
      () => {
        window.location.assign(secretUrl);
      },
      reducedMotion.matches ? 120 : 720,
    );
  };

  renderFruitArt();
  fruitButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));

  trigger.addEventListener("pointerenter", startHoverAnimation);
  trigger.addEventListener("pointerleave", stopHoverAnimation);
  trigger.addEventListener("focus", startHoverAnimation);
  trigger.addEventListener("blur", stopHoverAnimation);
  trigger.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) closeDialog();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitter = event.submitter instanceof HTMLElement ? event.submitter : document.activeElement;
    const button = submitter?.closest("[data-sirui-fruit]") || fruitButtons[0];
    selectFruit(button);
  });
})();
