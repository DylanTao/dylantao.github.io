// Cinematic layer: scroll-driven and pointer-aware motion for pages that declare `cinematic: true`.
// Bounded on purpose: nothing hijacks scrolling, every effect is a still page under reduced motion,
// and automation (Playwright's navigator.webdriver) gets the still page too unless the URL carries
// `?cinematic=live`, so visual captures stay deterministic while a human sees the motion.
(() => {
  const root = document.documentElement;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const wide = window.matchMedia("(min-width: 992px)");
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const automated = Boolean(navigator.webdriver) && !forceLive;
  const live = Boolean(gsap && ScrollTrigger) && !reduceMotion.matches && !automated;

  const scenes = Array.from(document.querySelectorAll(".cinematic [data-case-scroll]"));
  const stillScene = (scene) => {
    scene.classList.add("is-static");
    scene.querySelectorAll("[data-case-step]").forEach((step) => step.classList.add("is-active"));
  };

  root.classList.add("cinematic-ready");
  if (!live) {
    scenes.forEach(stillScene);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("cinematic-live");

  // 1. Page header: the title lingers a little as the page starts to move.
  const header = document.querySelector(".cinematic .post-header");
  if (header) {
    const title = header.querySelector(".post-title");
    if (title) {
      gsap.to(title, {
        yPercent: 28,
        ease: "none",
        scrollTrigger: { trigger: header, start: "top top", end: "bottom top", scrub: true },
      });
    }
  }

  // 2. Card grids: cards rise into place as they enter, section headings slide in.
  const grids = gsap.utils.toArray(".cinematic [data-project-card-grid]");
  grids.forEach((grid) => {
    const cards = gsap.utils.toArray(grid.querySelectorAll("[data-project-card]"));
    if (!cards.length) return;

    cards.forEach((card) => card.querySelector(":scope > .card")?.classList.add("site-visible"));
    gsap.set(cards, { opacity: 0, y: 26 });

    const reveal = (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.07,
        overwrite: true,
        clearProps: "opacity,transform",
      });

    ScrollTrigger.batch(cards, { start: "top 90%", once: true, onEnter: reveal });

    // Keyboard visitors never wait for the scroll position: a focused card is shown at once.
    grid.addEventListener("focusin", (event) => {
      const card = event.target instanceof Element ? event.target.closest("[data-project-card]") : null;
      if (card) gsap.to(card, { opacity: 1, y: 0, duration: 0.2, overwrite: true, clearProps: "opacity,transform" });
    });
  });

  gsap.utils
    .toArray(".cinematic .project-category-heading, .cinematic .site-experiment-index-heading, .cinematic .project-subsection-heading")
    .forEach((heading) => {
      gsap.from(heading, {
        opacity: 0,
        x: -18,
        duration: 0.7,
        ease: "power3.out",
        clearProps: "opacity,transform",
        scrollTrigger: { trigger: heading, start: "top 92%", once: true },
      });
    });

  // 3. Spotlight: a soft light follows the pointer across a grid and lights the card under it.
  if (finePointer.matches) {
    grids.forEach((grid) => {
      grid.classList.add("has-spotlight");
      const surfaces = gsap.utils.toArray(grid.querySelectorAll("[data-project-card] > .card"));
      let frame = 0;
      let pointer = null;

      const paint = () => {
        frame = 0;
        if (!pointer) return;
        surfaces.forEach((surface) => {
          const box = surface.getBoundingClientRect();
          surface.style.setProperty("--spot-x", `${(pointer.x - box.left).toFixed(1)}px`);
          surface.style.setProperty("--spot-y", `${(pointer.y - box.top).toFixed(1)}px`);
        });
      };

      grid.addEventListener(
        "pointermove",
        (event) => {
          pointer = { x: event.clientX, y: event.clientY };
          grid.style.setProperty("--spot-o", "1");
          if (!frame) frame = window.requestAnimationFrame(paint);
        },
        { passive: true }
      );
      grid.addEventListener("pointerleave", () => grid.style.setProperty("--spot-o", "0"));
    });
  }

  // 4. Tilt: the card under the pointer leans toward it by a few degrees while its image drifts
  //    the other way. The expanded preview and the FLIP that opens it never tilt.
  if (finePointer.matches) {
    root.classList.add("cinematic-tilt");
    gsap.utils.toArray(".cinematic [data-project-card]").forEach((card) => {
      const surface = card.querySelector(":scope > .card");
      if (!surface) return;
      const media = card.querySelector(".project-card-media");
      const rotateX = gsap.quickTo(surface, "rotationX", { duration: 0.45, ease: "power2.out" });
      const rotateY = gsap.quickTo(surface, "rotationY", { duration: 0.45, ease: "power2.out" });
      const lift = gsap.quickTo(surface, "y", { duration: 0.45, ease: "power2.out" });
      let tilting = false;

      const idle = () => card.classList.contains("is-expanded") || Boolean(card.closest(".has-expanded-project-card"));
      const settle = () => {
        if (!tilting) return;
        tilting = false;
        rotateX(0);
        rotateY(0);
        lift(0);
        media?.style.removeProperty("--tilt-x");
        media?.style.removeProperty("--tilt-y");
        gsap.delayedCall(0.5, () => {
          if (!tilting) gsap.set(surface, { clearProps: "transform" });
        });
      };

      card.addEventListener(
        "pointermove",
        (event) => {
          if (idle()) {
            settle();
            return;
          }
          const box = surface.getBoundingClientRect();
          if (!box.width || !box.height) return;
          const px = (event.clientX - box.left) / box.width - 0.5;
          const py = (event.clientY - box.top) / box.height - 0.5;
          if (!tilting) {
            tilting = true;
            gsap.set(surface, { transformPerspective: 900 });
          }
          rotateX(-py * 6);
          rotateY(px * 7);
          lift(-3);
          media?.style.setProperty("--tilt-x", `${(-px * 8).toFixed(1)}px`);
          media?.style.setProperty("--tilt-y", `${(-py * 8).toFixed(1)}px`);
        },
        { passive: true }
      );
      card.addEventListener("pointerleave", settle);
      card.querySelector("[data-project-card-trigger]")?.addEventListener("click", settle);
    });
  }

  // 5. Case study hero: copy and figure arrive in sequence; the scroll hint fades once reading starts.
  const hero = document.querySelector(".cinematic .project-case-hero");
  if (hero) {
    const copyItems = gsap.utils.toArray(hero.querySelectorAll(":scope > .project-case-copy > *"));
    const media = hero.querySelector(":scope > .project-case-media");
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (copyItems.length) timeline.from(copyItems, { opacity: 0, y: 16, duration: 0.7, stagger: 0.07, clearProps: "opacity,transform" }, 0.05);
    if (media) timeline.from(media, { opacity: 0, y: 26, duration: 0.9, clearProps: "opacity,transform" }, 0.2);

    const hint = hero.querySelector(".case-scroll-hint");
    if (hint) {
      ScrollTrigger.create({
        start: 80,
        onEnter: () => gsap.to(hint, { opacity: 0, duration: 0.3, overwrite: true }),
        onLeaveBack: () => gsap.to(hint, { opacity: 1, duration: 0.3, overwrite: true }),
      });
    }
  }

  // 6. Case study scene: three steps scroll past a sticky figure; a lens moves to the part each
  //    step talks about and the caption follows. Narrow screens read it as a still list.
  scenes.forEach((scene) => {
    const steps = gsap.utils.toArray(scene.querySelectorAll("[data-case-step]"));
    const lens = scene.querySelector("[data-case-lens-box]");
    const caption = scene.querySelector("[data-case-caption-out]");
    const restingCaption = caption?.textContent?.trim() || "";
    if (!steps.length) return;
    if (!wide.matches) {
      stillScene(scene);
      return;
    }

    const parseLens = (step) => {
      const parts = (step.dataset.caseLens || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
    };

    const swapCaption = (text) => {
      if (!caption || caption.textContent.trim() === text) return;
      gsap.killTweensOf(caption);
      gsap
        .timeline()
        .to(caption, { opacity: 0, y: 5, duration: 0.16, ease: "power1.in" })
        .add(() => {
          caption.textContent = text;
        })
        .to(caption, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    };

    const activate = (step) => {
      steps.forEach((item) => item.classList.toggle("is-active", item === step));
      const box = lens ? parseLens(step) : null;
      if (lens && box) {
        lens.classList.add("is-on");
        gsap.to(lens, {
          left: `${box[0]}%`,
          top: `${box[1]}%`,
          width: `${box[2]}%`,
          height: `${box[3]}%`,
          duration: 0.7,
          ease: "power3.inOut",
          overwrite: true,
        });
      } else {
        lens?.classList.remove("is-on");
      }
      swapCaption(step.dataset.caseCaption || restingCaption);
    };

    const rest = () => {
      steps.forEach((item) => item.classList.remove("is-active"));
      lens?.classList.remove("is-on");
      swapCaption(restingCaption);
    };

    steps.forEach((step) => {
      ScrollTrigger.create({
        trigger: step,
        start: "top 62%",
        end: "bottom 38%",
        onEnter: () => activate(step),
        onEnterBack: () => activate(step),
      });
    });
    ScrollTrigger.create({ trigger: steps[0], start: "top 62%", onLeaveBack: rest });
  });

  // 7. Reading blocks below a case hero rise into view once, in reading order.
  gsap.utils
    .toArray(
      ".cinematic article > h2, .cinematic article > h3, .cinematic article > p, .cinematic article > ul, .cinematic article > ol, .cinematic article > .row, .cinematic article > .caption, .cinematic article > pre, .cinematic article > .project-author-strip"
    )
    .forEach((block) => {
      if (block.closest(".project-case-hero") || block.classList.contains("sr-only")) return;
      gsap.from(block, {
        opacity: 0,
        y: 22,
        duration: 0.7,
        ease: "power3.out",
        clearProps: "opacity,transform",
        scrollTrigger: { trigger: block, start: "top 92%", once: true },
      });
    });

  // 8. Proof numbers count up once when the page opens.
  gsap.utils.toArray(".cinematic [data-count-up]").forEach((node) => {
    const match = node.textContent.match(/^(\s*)(\d[\d,]*)([\s\S]*)$/);
    if (!match) return;
    const target = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(target) || target <= 0) return;
    const counter = { value: 0 };
    node.textContent = `${match[1]}0${match[3]}`;
    gsap.to(counter, {
      value: target,
      duration: 1.1,
      ease: "power2.out",
      delay: 0.35,
      onUpdate: () => {
        node.textContent = `${match[1]}${Math.round(counter.value).toLocaleString("en-US")}${match[3]}`;
      },
    });
  });
})();
