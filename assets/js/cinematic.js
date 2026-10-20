// Cinematic layer: scroll-driven and pointer-aware motion for pages that declare `cinematic: true`.
// Bounded on purpose: nothing hijacks scrolling, every effect is a still page under reduced motion,
// and automation (Playwright's navigator.webdriver) gets the still page too unless the URL carries
// `?cinematic=live`, so visual captures stay deterministic while a human sees the motion.
// Every entrance starts from a readable state (2026-10-19): words, pictures and chart values are
// visible before their trigger fires, and the motion only carries them the last few pixels, so a
// full-page screenshot, a quick fling or a trigger that never fires still shows the whole page.
(() => {
  const root = document.documentElement;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 992px)");
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const automated = Boolean(navigator.webdriver) && !forceLive;
  const live = Boolean(gsap && ScrollTrigger) && !reduceMotion.matches && !automated;
  // The site's springs (assets/js/site-motion.mjs) drive the entrances, so a card rising here moves
  // like a card opening on the projects index; GSAP's own eases stand in if the module is missing.
  const springEase = (name, fallback) => {
    const spring = window.SiteMotion?.spring?.(name);
    return spring ? { ease: spring.ease, duration: spring.seconds } : { ease: fallback, duration: null };
  };
  const arrive = springEase("gentle", "power3.out");
  const travel = springEase("layout", "power3.inOut");

  const scenes = Array.from(document.querySelectorAll(".cinematic [data-case-scroll]"));
  const stillScene = (scene) => {
    scene.classList.add("is-static");
    scene.querySelectorAll("[data-case-step]").forEach((step) => step.classList.add("is-active"));
  };

  // 0. The card-to-hero morph lives in page-entry.mjs and head.liquid now (2026-10-18), for every
  //    card, blog row and experiment, with the card's surface and title as well as its picture.

  root.classList.add("cinematic-ready");
  if (!live) {
    scenes.forEach(stillScene);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("cinematic-live");

  // 1. Card grids: cards rise into place as they enter, section headings slide in.
  const grids = gsap.utils.toArray(".cinematic [data-project-card-grid]").filter((grid) => !grid.closest("[data-project-deck-children]"));
  grids.forEach((grid) => {
    const cards = gsap.utils.toArray(grid.querySelectorAll(":scope > [data-project-card]"));
    if (!cards.length) return;

    cards.forEach((card) => card.querySelector(":scope > .card")?.classList.add("site-visible"));
    gsap.set(cards, { y: 26 });

    const reveal = (batch) =>
      gsap.to(batch, {
        y: 0,
        duration: arrive.duration ?? 0.75,
        ease: arrive.ease,
        stagger: 0.06,
        overwrite: true,
        clearProps: "transform",
      });

    ScrollTrigger.batch(cards, { start: "top 90%", once: true, onEnter: reveal });

    // Keyboard visitors never wait for the scroll position: a focused card settles at once.
    grid.addEventListener("focusin", (event) => {
      const card = event.target instanceof Element ? event.target.closest("[data-project-card]") : null;
      if (card) gsap.to(card, { y: 0, duration: 0.2, overwrite: true, clearProps: "transform" });
    });
  });

  gsap.utils
    .toArray(".cinematic .project-category-heading, .cinematic .site-experiment-index-heading, .cinematic .project-subsection-heading")
    .forEach((heading) => {
      gsap.from(heading, {
        x: -18,
        duration: arrive.duration ?? 0.7,
        ease: arrive.ease,
        clearProps: "transform",
        scrollTrigger: { trigger: heading, start: "top 92%", once: true },
      });
    });

  // 3-4. The spotlight and tilt over card grids moved to glass-motion.mjs (2026-10-18): the glass
  //      highlight follows the pointer and every glass card leans, on every page, not only here.

  // 5. Case study hero: copy and figure arrive in sequence; the scroll hint fades once reading starts.
  const hero = document.querySelector(".cinematic .project-case-hero");
  if (hero) {
    const copyItems = gsap.utils.toArray(hero.querySelectorAll(":scope > .project-case-copy > *"));
    const media = hero.querySelector(":scope > .project-case-media");
    const timeline = gsap.timeline({ defaults: { ease: arrive.ease } });
    if (copyItems.length) timeline.from(copyItems, { y: 16, duration: arrive.duration ?? 0.7, stagger: 0.06, clearProps: "transform" }, 0.05);
    // Depth as the hero scrolls away: the figure well lags the copy by a few dozen pixels, whole and
    // uncropped, so the diagram stays inspectable. The DesignWeaver scene pins its own stage instead.
    const mediaDrifts = Boolean(media) && !hero.hasAttribute("data-case-scroll") && wide.matches;
    if (media && mediaDrifts) {
      gsap.to(media, { y: -44, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    } else if (media) {
      timeline.from(media, { y: 26, duration: 0.9, clearProps: "transform" }, 0.2);
    }

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
          duration: travel.duration ?? 0.7,
          ease: travel.ease,
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
      ".cinematic.project-case-page article > h2, .cinematic.project-case-page article > h3, .cinematic.project-case-page article > p, .cinematic.project-case-page article > ul, .cinematic.project-case-page article > ol, .cinematic.project-case-page article > .row, .cinematic.project-case-page article > .caption, .cinematic.project-case-page article > pre, .cinematic.project-case-page article > .project-author-strip"
    )
    .forEach((block) => {
      if (block.closest(".project-case-hero") || block.classList.contains("sr-only")) return;
      gsap.from(block, {
        y: 22,
        duration: arrive.duration ?? 0.7,
        ease: arrive.ease,
        clearProps: "transform",
        scrollTrigger: { trigger: block, start: "top 92%", once: true },
      });
    });

  // Evidence stays readable throughout the reveal, including its first frame.
  gsap.utils.toArray(".cinematic [data-count-up]").forEach((node) => {
    gsap.fromTo(
      node,
      { y: 5 },
      {
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: node, start: "top 92%", once: true },
        clearProps: "transform",
      }
    );
  });

  // 9. Homepage: headings drift a little slower than the page, a marker sweeps the thesis question as
  //    it arrives, and the claim and update cards rise in sequence. The 3D desk above is untouched.
  const home = document.querySelector(".home-page.cinematic");
  if (home) {
    gsap.utils.toArray(home.querySelectorAll(".home-section:not(.home-hero) .home-section-heading h2, .home-why-now-copy h2")).forEach((heading) => {
      gsap.fromTo(
        heading,
        { yPercent: 12 },
        {
          yPercent: -12,
          ease: "none",
          scrollTrigger: { trigger: heading.closest(".home-section"), start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    });

    // Thesis copy stays fully readable at every scroll position. The bounded
    // underline below carries the emphasis without dimming the paragraph.

    // The why-now framing drifts shallowly beside its evidence on wide screens.
    [{ node: home.querySelector(".home-why-now-copy"), section: home.querySelector(".home-why-now"), travel: 36 }].forEach(
      ({ node, section, travel }) => {
        if (!node || !section || !wide.matches) return;
        gsap.fromTo(
          node,
          { y: travel },
          { y: -travel, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true } }
        );
      }
    );

    const mark = home.querySelector(".home-thread-mark");
    if (mark) {
      gsap.fromTo(
        mark,
        { "--mark-w": "0%" },
        { "--mark-w": "100%", ease: "none", scrollTrigger: { trigger: mark, start: "top 82%", end: "top 45%", scrub: true } }
      );
    }

    [".home-why-now-claims > article", ".home-news-strip > article", ".home-recruiting-steps ol > li"].forEach((selector) => {
      const items = gsap.utils.toArray(home.querySelectorAll(selector));
      if (!items.length) return;
      gsap.from(items, {
        y: 22,
        duration: arrive.duration ?? 0.7,
        ease: arrive.ease,
        stagger: 0.08,
        clearProps: "transform",
        scrollTrigger: { trigger: items[0].parentElement, start: "top 85%", once: true },
      });
    });

    // Research Focus as a scroll story. On wide screens the sketch pins beside the three lens notes,
    // which all stay visible in reading order; the note in the middle of the viewport picks the mode,
    // through the same buttons a click would use, so the sketch changes lens as the reader reads.
    // research-motion.js reads the attribute set here and keeps every note visible while it is present.
    const focus = home.querySelector("[data-research-motion-section]");
    if (focus && wide.matches) {
      focus.setAttribute("data-research-scroll-story", "");
      gsap.utils.toArray(focus.querySelectorAll("[data-research-detail]")).forEach((detail) => {
        const button = focus.querySelector(`[data-research-mode="${detail.getAttribute("data-research-detail")}"]`);
        if (!button) return;
        const pick = () => {
          if (button.getAttribute("aria-pressed") !== "true") button.click();
        };
        ScrollTrigger.create({ trigger: detail, start: "top 58%", end: "bottom 42%", onEnter: pick, onEnterBack: pick });
      });
    }
  }

  // 10. Publications: the Scholar citation bars no longer grow from zero (2026-10-19). A bar that
  //     grows passes through counts the record never had, and an empty chart waited on the scroll
  //     trigger; numerical evidence keeps its exact value at every frame.

  // 11. Blog posts: the title block arrives first, then each block of the note rises into view once as
  //     the reader reaches it. Pull quotes settle from a touch larger, so they read as a pause.
  const post = document.querySelector(".blog-post.cinematic");
  if (post) {
    const header = gsap.utils.toArray(post.querySelectorAll(".post-header > *"));
    if (header.length) {
      gsap.from(header, { y: 14, duration: arrive.duration ?? 0.7, ease: arrive.ease, stagger: 0.07, clearProps: "transform" });
    }
    // Figures drift a little slower than the words around them, whole and uncropped, so screenshots
    // and diagrams stay inspectable. They skip the rise so the two motions never fight.
    const content = post.querySelector("#markdown-content");
    const drifting = new Set(
      content
        ? Array.from(content.children).filter(
            (block) =>
              !block.matches("p, ul, ol, table, blockquote, section, nav, details, pre, hr, h1, h2, h3, h4") && block.querySelector("img:not(.emoji)")
          )
        : []
    );
    if (content) gsap.utils.toArray(content.querySelectorAll(":scope > p > img:only-child:not(.emoji)")).forEach((img) => drifting.add(img));
    gsap.utils.toArray(post.querySelectorAll("#markdown-content > *, .post-content > details")).forEach((block) => {
      if (block.classList.contains("sr-only") || block.matches("script, style, template, [hidden]")) return;
      if (drifting.has(block)) return;
      const quote = block.matches("blockquote");
      gsap.from(block, {
        y: quote ? 10 : 20,
        scale: quote ? 1.015 : 1,
        transformOrigin: "left center",
        duration: (arrive.duration ?? 0.7) * (quote ? 1.25 : 1),
        ease: arrive.ease,
        clearProps: "transform",
        scrollTrigger: { trigger: block, start: "top 92%", once: true },
      });
    });
    drifting.forEach((figure) => {
      gsap.fromTo(
        figure,
        { y: 18 },
        { y: -18, ease: "none", scrollTrigger: { trigger: figure, start: "top bottom", end: "bottom top", scrub: true } }
      );
    });
  }
})();
