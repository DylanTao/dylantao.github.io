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

  // 0. Card-to-hero morph: the project image a visitor clicks becomes the case page's hero image
  //    through a cross-document view transition, and comes back to its card on the way out. The
  //    hero side of the name lives in CSS; the index side is set here (forward) and by the inline
  //    `pagereveal` listener in head.liquid (back), which runs before the first frame.
  const morphKey = "cinematic:morph-href";
  Array.from(document.querySelectorAll(".cinematic [data-project-card-primary-action]")).forEach((link) => {
    if (link.target === "_blank" || link.origin !== window.location.origin) return;
    link.addEventListener("click", () => {
      const image = link.closest("[data-project-card]")?.querySelector(".project-card-media img");
      if (!image) return;
      image.style.viewTransitionName = "project-hero";
      try {
        sessionStorage.setItem(morphKey, link.href);
      } catch (error) {
        /* private mode: the transition falls back to the root crossfade */
      }
    });
  });

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
      ".cinematic.project-case-page article > h2, .cinematic.project-case-page article > h3, .cinematic.project-case-page article > p, .cinematic.project-case-page article > ul, .cinematic.project-case-page article > ol, .cinematic.project-case-page article > .row, .cinematic.project-case-page article > .caption, .cinematic.project-case-page article > pre, .cinematic.project-case-page article > .project-author-strip"
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

  // 8. Proof numbers count up once as they come into view, keeping their original digit grouping.
  gsap.utils.toArray(".cinematic [data-count-up]").forEach((node) => {
    const match = node.textContent.match(/^(\s*)(\d[\d,]*)([\s\S]*)$/);
    if (!match) return;
    const target = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(target) || target <= 0) return;
    const grouped = match[2].includes(",");
    const format = (value) => (grouped ? Math.round(value).toLocaleString("en-US") : String(Math.round(value)));
    const counter = { value: 0 };
    node.textContent = `${match[1]}0${match[3]}`;
    gsap.to(counter, {
      value: target,
      duration: 1.1,
      ease: "power2.out",
      delay: 0.2,
      scrollTrigger: { trigger: node, start: "top 92%", once: true },
      onUpdate: () => {
        node.textContent = `${match[1]}${format(counter.value)}${match[3]}`;
      },
    });
  });

  // 9. Threads: one line runs down a column of sections, fills as the reader scrolls, and lights a
  //    node for the section being read. `anchors` are the elements each node sits beside; a
  //    section's active span runs from its anchor to the next one (or the container's end).
  const threadThrough = ({ container, track, fill, anchors, nodeClass, headOffset = 40, tailOffset = 56, nodeOffset = 12 }) => {
    if (!container || !track || !anchors.length) return;
    const nodes = anchors.map(() => {
      const node = document.createElement("span");
      node.className = nodeClass;
      track.appendChild(node);
      return node;
    });
    const layout = () => {
      const box = container.getBoundingClientRect();
      const first = anchors[0].getBoundingClientRect();
      const last = anchors[anchors.length - 1].getBoundingClientRect();
      const top = first.top - box.top + headOffset;
      const bottom = last.top - box.top + tailOffset;
      track.style.top = `${top}px`;
      track.style.height = `${Math.max(0, bottom - top)}px`;
      anchors.forEach((anchor, index) => {
        nodes[index].style.top = `${anchor.getBoundingClientRect().top - box.top - top + nodeOffset}px`;
      });
    };
    layout();
    ScrollTrigger.addEventListener("refreshInit", layout);
    if (fill) {
      gsap.fromTo(
        fill,
        { scaleY: 0 },
        { scaleY: 1, ease: "none", scrollTrigger: { trigger: track, start: "top 55%", end: "bottom 55%", scrub: 0.4 } }
      );
    }
    anchors.forEach((anchor, index) => {
      const next = anchors[index + 1];
      ScrollTrigger.create({
        trigger: anchor,
        start: "top 55%",
        endTrigger: next || container,
        end: next ? "top 55%" : "bottom 55%",
        toggleClass: { targets: nodes[index], className: "is-active" },
      });
    });
  };

  // 10. Homepage: the thread runs down the story below the desk, headings drift a little slower than
  //     the page, a marker sweeps the thesis question as it arrives, and the claim and update cards
  //     rise in sequence. The 3D desk above all of this is untouched.
  const home = document.querySelector(".home-page.cinematic");
  if (home) {
    const thread = home.querySelector("[data-home-thread]");
    const sections = gsap.utils.toArray(home.querySelectorAll(".home-section")).filter((section) => !section.classList.contains("home-hero"));
    if (thread && sections.length) {
      threadThrough({
        container: home,
        track: thread,
        fill: thread.querySelector("[data-home-thread-fill]"),
        anchors: sections.map((section) => section.querySelector(".home-section-heading, .home-why-now-copy") || section),
        nodeClass: "home-thread-node",
      });
    }

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

    const mark = home.querySelector(".home-thread-mark");
    if (mark) {
      gsap.fromTo(
        mark,
        { "--mark-w": "0%" },
        { "--mark-w": "100%", ease: "none", scrollTrigger: { trigger: mark, start: "top 82%", end: "top 45%", scrub: true } }
      );
    }

    [".home-why-now-claims > article", ".home-news-strip > article"].forEach((selector) => {
      const items = gsap.utils.toArray(home.querySelectorAll(selector));
      if (!items.length) return;
      gsap.from(items, {
        opacity: 0,
        y: 22,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.09,
        clearProps: "opacity,transform",
        scrollTrigger: { trigger: items[0].parentElement, start: "top 85%", once: true },
      });
    });
  }

  // 11. Publications: the year headings get the same thread beside the paper list, and the Scholar
  //     citation bars grow into place the first time the chart comes into view.
  const paperColumn = document.querySelector(".cinematic .publication-list-column");
  if (paperColumn) {
    const years = gsap.utils.toArray(paperColumn.querySelectorAll("h2.bibliography"));
    if (years.length > 1) {
      const track = document.createElement("div");
      track.className = "cinematic-thread";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "cinematic-thread-fill";
      track.appendChild(fill);
      paperColumn.appendChild(track);
      threadThrough({
        container: paperColumn,
        track,
        fill,
        anchors: years,
        nodeClass: "cinematic-thread-node",
        headOffset: 18,
        tailOffset: 34,
        nodeOffset: 28,
      });
    }
    const bars = gsap.utils.toArray(".cinematic .scholar-lens-year-fill");
    if (bars.length) {
      gsap.from(bars, {
        scaleY: 0,
        transformOrigin: "bottom",
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.06,
        clearProps: "transform",
        scrollTrigger: { trigger: ".cinematic .scholar-lens-year-chart", start: "top 85%", once: true },
      });
    }
  }
})();
