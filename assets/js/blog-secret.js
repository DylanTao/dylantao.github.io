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
    const body = makeOrganicOval(
      random,
      randomBetween(random, 36, 38),
      randomBetween(random, 32, 34),
      randomBetween(random, 17.5, 19.5),
      randomBetween(random, 22, 24),
      20
    );
    const cutBody = makeOrganicOval(random, 22, 43, randomBetween(random, 10.5, 12), randomBetween(random, 12.5, 14), 16);

    return makeSvg(
      "mango",
      index,
      `
        <defs>
          <linearGradient id="${id}-skin" x1="13" x2="53" y1="16" y2="51" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6f9f42"></stop>
            <stop offset="38%" stop-color="#f2bd36"></stop>
            <stop offset="72%" stop-color="#f08a2e"></stop>
            <stop offset="100%" stop-color="#c94f38"></stop>
          </linearGradient>
          <radialGradient id="${id}-blush" cx="67%" cy="72%" r="45%">
            <stop offset="0%" stop-color="#dc4f33" stop-opacity="0.72"></stop>
            <stop offset="100%" stop-color="#dc4f33" stop-opacity="0"></stop>
          </radialGradient>
          <linearGradient id="${id}-flesh" x1="12" x2="34" y1="31" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff3a4"></stop>
            <stop offset="68%" stop-color="#ffc64a"></stop>
            <stop offset="100%" stop-color="#ed9f27"></stop>
          </linearGradient>
        </defs>
        <ellipse cx="33" cy="56" rx="20" ry="4.5" fill="rgba(48, 35, 19, 0.15)"></ellipse>
        <g transform="rotate(-10 36 33)">
          <path d="${body}" fill="url(#${id}-skin)" stroke="rgba(92, 48, 24, 0.34)" stroke-width="1.35"></path>
          <path d="${body}" fill="url(#${id}-blush)"></path>
          <path d="M28 18C34 12 45 13 50 21" fill="none" opacity="0.72" stroke="rgba(255, 245, 184, 0.75)" stroke-linecap="round" stroke-width="2.8"></path>
        </g>
        <path d="${cutBody}" fill="url(#${id}-flesh)" stroke="rgba(150, 87, 18, 0.38)" stroke-width="1.05"></path>
        <path d="M14 42L27 54M20 33L31 49M11 47L22 57M13 41C19 39 26 37 33 36M12 48C19 45 27 43 34 41" fill="none" stroke="rgba(151, 89, 21, 0.3)" stroke-linecap="round" stroke-width="0.9"></path>
        <path d="M35 11C40 7 48 8 52 13C45 17 39 17 35 11Z" fill="#6f9c4b" stroke="#3f723b" stroke-width="0.85"></path>
        <path d="M35 12Q32 15 31 19" fill="none" stroke="#74421d" stroke-linecap="round" stroke-width="1.4"></path>
      `
    );
  };

  const orangeArt = (random, index) => {
    const id = `sirui-secret-orange-${index}`;
    const body = makeOrganicOval(
      random,
      randomBetween(random, 38, 40),
      randomBetween(random, 33, 35),
      randomBetween(random, 17.5, 19),
      randomBetween(random, 17.5, 19),
      20
    );
    const pores = Array.from({ length: Math.round(randomBetween(random, 30, 42)) }, () => {
      const point = pointOnEllipse(39, 34, 15.5, 15, randomBetween(random, 0, Math.PI * 2), Math.sqrt(randomBetween(random, 0.02, 0.86)));
      const opacity = number(randomBetween(random, 0.16, 0.38), 3);
      return `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="${number(randomBetween(random, 0.2, 0.5))}" fill="rgba(255, 238, 181, ${opacity})"></circle>`;
    }).join("");

    return makeSvg(
      "orange",
      index,
      `
        <defs>
          <radialGradient id="${id}-rind" cx="31%" cy="25%" r="76%">
            <stop offset="0%" stop-color="#ffd984"></stop>
            <stop offset="58%" stop-color="#f58220"></stop>
            <stop offset="100%" stop-color="#c95818"></stop>
          </radialGradient>
          <radialGradient id="${id}-slice" cx="44%" cy="42%" r="60%">
            <stop offset="0%" stop-color="#fff4b3"></stop>
            <stop offset="36%" stop-color="#ffc647"></stop>
            <stop offset="100%" stop-color="#f08321"></stop>
          </radialGradient>
        </defs>
        <ellipse cx="34" cy="56" rx="20" ry="4.4" fill="rgba(48, 28, 12, 0.15)"></ellipse>
        <path d="${body}" fill="url(#${id}-rind)" stroke="rgba(123, 56, 18, 0.34)" stroke-width="1.25"></path>
        <g opacity="0.85">${pores}</g>
        <circle cx="25" cy="40" r="13.4" fill="url(#${id}-slice)" stroke="rgba(255, 240, 190, 0.85)" stroke-width="2.5"></circle>
        <circle cx="25" cy="40" r="2.1" fill="#fff3b5"></circle>
        <path d="M25 27L25 53M12 40H38M16.2 31.2L33.8 48.8M33.8 31.2L16.2 48.8M19.2 28.5L30.8 51.5M30.8 28.5L19.2 51.5" fill="none" stroke="rgba(255, 246, 205, 0.82)" stroke-linecap="round" stroke-width="1.08"></path>
        <path d="M38 14Q40 9 45 8" fill="none" stroke="#81552e" stroke-linecap="round" stroke-width="2.1"></path>
        <path d="M39 15Q44 11 50 14Q45 18 39 15Z" fill="#76a95e" stroke="#447840" stroke-width="0.8"></path>
        <circle cx="41" cy="48" r="1.25" fill="rgba(113, 49, 13, 0.42)"></circle>
      `
    );
  };

  const strawberryArt = (random, index) => {
    const id = `sirui-secret-strawberry-${index}`;
    const width = randomBetween(random, 0.92, 1.08);
    const body = `M32 58C20 50 ${number(13 - width)} 40 ${number(15 - width)} 28C17 17 27 17 32 25C37 17 48 17 50 28C52 40 44 50 32 58Z`;
    const seeds = Array.from({ length: Math.round(randomBetween(random, 28, 36)) }, () => {
      const y = randomBetween(random, 27, 50);
      const rowWidth = Math.max(4.5, (53 - y) * 0.55);
      const x = randomBetween(random, 32 - rowWidth, 32 + rowWidth);
      const tilt = randomBetween(random, -18, 18);
      return `<ellipse cx="${number(x)}" cy="${number(y)}" rx="0.55" ry="1" fill="#ffe8a9" opacity="${number(randomBetween(random, 0.58, 0.86), 2)}" transform="rotate(${number(tilt)} ${number(x)} ${number(y)})"></ellipse>`;
    }).join("");

    return makeSvg(
      "strawberry",
      index,
      `
        <defs>
          <linearGradient id="${id}-berry" x1="20" x2="45" y1="18" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ff7865"></stop>
            <stop offset="55%" stop-color="#eb3f38"></stop>
            <stop offset="100%" stop-color="#b51d32"></stop>
          </linearGradient>
          <radialGradient id="${id}-glow" cx="34%" cy="24%" r="50%">
            <stop offset="0%" stop-color="#ffd5cb" stop-opacity="0.58"></stop>
            <stop offset="100%" stop-color="#ffd5cb" stop-opacity="0"></stop>
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="57" rx="16.5" ry="3.8" fill="rgba(63, 19, 24, 0.15)"></ellipse>
        <path d="${body}" fill="url(#${id}-berry)" stroke="rgba(116, 20, 31, 0.38)" stroke-width="1.22"></path>
        <path d="${body}" fill="url(#${id}-glow)"></path>
        <path d="M21 22Q17 16 12 15Q20 14 26 20Q27 13 31 10Q34 16 32 22Q39 14 48 15Q43 18 38 23Q33 21 27 23Z" fill="#78a85f" stroke="#477942" stroke-linejoin="round" stroke-width="0.85"></path>
        <path d="M28 18Q31 12 35 9" fill="none" stroke="#81552e" stroke-linecap="round" stroke-width="1.7"></path>
        <g>${seeds}</g>
        <path d="M22 28C26 23 34 21 42 24" fill="none" opacity="0.42" stroke="#ffd3c9" stroke-linecap="round" stroke-width="2.8"></path>
      `
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
            <stop offset="0%" stop-color="#fff7a9"></stop>
            <stop offset="55%" stop-color="#f8d83c"></stop>
            <stop offset="100%" stop-color="#d99f16"></stop>
          </linearGradient>
          <linearGradient id="${id}-banana-top" x1="14" x2="54" y1="22" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#ffe96a"></stop>
            <stop offset="100%" stop-color="#f1bd24"></stop>
          </linearGradient>
        </defs>
        <ellipse cx="33" cy="57" rx="21" ry="4.2" fill="rgba(58, 44, 14, 0.14)"></ellipse>
        <g transform="translate(-1 ${number(lift)})">
          <path d="M12 38C23 54 47 56 58 37C52 57 25 62 8 45C8 42 9 40 12 38Z" fill="url(#${id}-banana)" stroke="rgba(126, 90, 12, 0.42)" stroke-linejoin="round" stroke-width="1.15"></path>
          <path d="M12 30C25 44 47 46 56 27C54 48 26 53 8 37C8 34 9 31 12 30Z" fill="#ffe864" stroke="rgba(126, 90, 12, 0.36)" stroke-linejoin="round" stroke-width="1.05"></path>
          <path d="M17 24C30 34 46 34 53 19C51 37 29 43 14 30C13 27 14 25 17 24Z" fill="url(#${id}-banana-top)" stroke="rgba(126, 90, 12, 0.34)" stroke-linejoin="round" stroke-width="1"></path>
          <path d="M12 24Q9 20 13 17Q18 19 19 24Q16 25 12 24Z" fill="#6f9843" stroke="#56752f" stroke-width="0.7"></path>
          <path d="M53 19Q57 17 59 20Q58 25 54 27Z" fill="#74421d"></path>
          <path d="M17 40C29 49 45 50 54 39M18 32C30 39 44 39 52 29M21 26C32 31 44 30 50 21" fill="none" opacity="0.48" stroke="#fff6aa" stroke-linecap="round" stroke-width="1.45"></path>
          <path d="M9 45Q7 41 10 38" fill="none" stroke="#74421d" stroke-linecap="round" stroke-width="2.05"></path>
        </g>
      `
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
      })
    );
    routeTimer = window.setTimeout(
      () => {
        window.location.assign(secretUrl);
      },
      reducedMotion.matches ? 120 : 720
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
