// The blog's two layouts (2026-10-18): the list (the default, as the blog has always been) and cards
// that group the notes by kind, stack each series like a project deck, and light up the notes that
// share a topic with the one under the pointer or focus. The choice is remembered per visitor
// (localStorage, read before the first paint by the inline script in _pages/blog.md).
//
// The toggle's selected drop is liquid glass (liquid-drop.mjs): it pulls away from one icon, a
// bridge stretches and snaps, and it pools under the other; where the browser can, a lens bends the
// icon under it. Switching layouts carries each note's title from its row to its card with a
// same-document view transition. Reduced motion and automation (unless ?cinematic=live) switch at
// once.

export const LAYOUT_KEY = "blog:layout";
export const LAYOUTS = Object.freeze(["list", "cards"]);

export function normalizeLayout(value) {
  return value === "cards" ? "cards" : "list";
}

// The stored layout, or the list when storage is missing, blocked or holds something else.
export function readLayout(storage) {
  try {
    return normalizeLayout(storage?.getItem(LAYOUT_KEY));
  } catch {
    return "list";
  }
}

// Remember a layout; false when storage refuses (private windows, blocked site data).
export function writeLayout(storage, value) {
  try {
    storage.setItem(LAYOUT_KEY, normalizeLayout(value));
    return true;
  } catch {
    return false;
  }
}

export function parseTags(value) {
  return String(value || "")
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// The topics two notes share, in the first note's order.
export function sharedTags(a, b) {
  const other = new Set(b);
  return a.filter((tag, index) => other.has(tag) && a.indexOf(tag) === index);
}

// For one note among many, which others share a topic with it and through which tags.
export function relatedNotes(source, notes) {
  const out = new Map();
  notes.forEach((note) => {
    if (note === source) return;
    const tags = sharedTags(source.tags, note.tags);
    if (tags.length) out.set(note, tags);
  });
  return out;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const toggle = document.querySelector("[data-blog-layout-toggle]");
  if (toggle) boot(toggle);
}

function boot(toggle) {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  const live = () => !reduce.matches && (!navigator.webdriver || forceLive);
  const buttons = Array.from(toggle.querySelectorAll("[data-blog-layout]"));
  const blobs = {
    rest: toggle.querySelector('[data-blog-blob="rest"]'),
    travel: toggle.querySelector('[data-blog-blob="travel"]'),
  };
  const lens = toggle.querySelector(".blog-layout-lens");
  const liquid = window.SiteLiquid;
  const springs = () => {
    const motion = window.SiteMotion;
    return motion?.spring ? { layout: motion.spring("layout"), gentle: motion.spring("gentle"), playful: motion.spring("playful") } : null;
  };

  // The goo merges the drops; the lens (Chromium) bends the icon under the selected drop.
  const goo = liquid?.ensureGooFilter?.("blog-layout-goo", 4);
  if (goo) toggle.querySelector(".blog-layout-liquid")?.setAttribute("data-goo", "");
  const fitLens = () => {
    if (!lens || !liquid?.ensureLensFilter || !root.hasAttribute("data-liquid-glass")) return;
    const box = lens.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (width < 8 || height < 8) return;
    const id = `blog-layout-lens-${width}x${height}`;
    if (liquid.ensureLensFilter(id, width, height, { scale: 10, bevel: 0.45 })) lens.style.setProperty("--blog-lens-filter", `url("#${id}")`);
  };
  fitLens();

  let layout = normalizeLayout(root.getAttribute("data-blog-layout"));
  const sync = () => {
    buttons.forEach((button) => {
      const selected = button.dataset.blogLayout === layout;
      button.setAttribute("aria-checked", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
  };
  sync();

  const offsetOf = (value) => {
    const button = buttons.find((item) => item.dataset.blogLayout === value);
    return button ? button.offsetLeft : 0;
  };

  // The drop: one stays and drains while the other travels, so the goo draws a bridge that thins and
  // snaps; the traveller lands with the playful spring's bounce and the resting drop refills under it.
  const pour = (from, to) => {
    const motion = springs();
    if (!motion || !blobs.rest || !blobs.travel || !live()) return;
    const dx = offsetOf(from) - offsetOf(to);
    if (Math.abs(dx) < 1) return;
    const { layout: travel, gentle, playful } = motion;
    const duration = travel.duration * 1.08;
    blobs.travel.getAnimations().forEach((animation) => animation.cancel());
    blobs.rest.getAnimations().forEach((animation) => animation.cancel());
    lens?.getAnimations().forEach((animation) => animation.cancel());
    const drop = liquid?.dropFrames ? liquid.dropFrames(travel, playful, { x0: dx, s0: 0.92, stretch: 0.34 }) : null;
    if (drop)
      blobs.travel.animate(drop, { duration, easing: "linear", fill: "both" }).finished.then(
        () => blobs.travel.getAnimations().forEach((animation) => animation.cancel()),
        () => {}
      );
    blobs.rest.animate(
      [
        { offset: 0, transform: `translateX(${dx}px) scale(1)` },
        { offset: 0.5, transform: `translateX(${dx}px) scale(0.05)` },
        { offset: 0.51, transform: "translateX(0px) scale(0.05)" },
        { offset: 0.78, transform: "translateX(0px) scale(0.2)" },
        { offset: 1, transform: "translateX(0px) scale(1)" },
      ],
      { duration, easing: gentle ? "linear" : "ease-out" }
    );
    if (lens && drop) lens.animate(drop, { duration, easing: "linear" });
  };

  // Each note's title travels from its row to its card (or back).
  const morphable = () => {
    const entries = new Map();
    document.querySelectorAll(".blog-list-view [data-entry]").forEach((row) => {
      const link = row.querySelector("a[href]");
      const title = row.querySelector("[data-entry-title]");
      if (link && title) entries.set(link.href, { row: title });
    });
    document.querySelectorAll(".blog-cards-view .blog-card").forEach((card) => {
      const title = card.querySelector("[data-entry-title]");
      const entry = entries.get(card.href);
      if (entry && title) entry.card = title;
    });
    return Array.from(entries.values()).filter((entry) => entry.row && entry.card);
  };

  const apply = (value) => {
    layout = value;
    if (layout === "cards") root.setAttribute("data-blog-layout", "cards");
    else root.removeAttribute("data-blog-layout");
    sync();
    if (layout === "cards") settleCards();
  };

  const choose = (value, { focus = false } = {}) => {
    const next = normalizeLayout(value);
    if (next === layout) return;
    const from = layout;
    writeLayout(window.localStorage, next);
    const canMorph = live() && typeof document.startViewTransition === "function";
    pour(from, next);
    if (!canMorph) {
      apply(next);
      if (focus) buttons.find((button) => button.dataset.blogLayout === next)?.focus();
      cascade();
      return;
    }
    const pairs = morphable();
    const view = window.innerHeight;
    const named = [];
    pairs.forEach((pair, index) => {
      const box = pair.row.getBoundingClientRect();
      if (box.bottom < -120 || box.top > view + 120) return;
      pair.row.style.viewTransitionName = pair.card.style.viewTransitionName = `blog-note-${index}`;
      pair.row.style.viewTransitionClass = pair.card.style.viewTransitionClass = "blog-note";
      named.push(pair);
    });
    // The toggle keeps still through the swap; its own drop carries the motion.
    toggle.style.viewTransitionName = "blog-layout-toggle";
    root.classList.add("blog-layout-morphing");
    const transition = document.startViewTransition(() => apply(next));
    transition.finished.finally(() => {
      named.forEach((pair) => {
        pair.row.style.viewTransitionName = pair.card.style.viewTransitionName = "";
        pair.row.style.viewTransitionClass = pair.card.style.viewTransitionClass = "";
      });
      toggle.style.viewTransitionName = "";
      root.classList.remove("blog-layout-morphing");
    });
    if (focus) transition.updateCallbackDone.then(() => buttons.find((button) => button.dataset.blogLayout === next)?.focus());
  };

  // Without a view transition the cards arrive in a short ripple from the toggle.
  const cascade = () => {
    const motion = springs();
    if (!motion || !live() || layout !== "cards") return;
    const origin = toggle.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll(".blog-cards-view .blog-card-item, .blog-cards-view .blog-series"));
    const delays = window.SiteMotion.rippleDelays(
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }),
      { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 },
      { speed: 6, maxDelay: 180 }
    );
    cards.forEach((card, index) => {
      const frames = window.SiteMotion.springSamples(motion.gentle, 14, 0, motion.gentle.duration, 24).map((y, i) => ({
        transform: `translateY(${y.toFixed(2)}px)`,
        opacity: i === 0 ? 0 : Math.min(1, motion.gentle.ease(i / 24) * 1.4),
      }));
      card.animate(frames, { duration: motion.gentle.duration, delay: delays[index], easing: "linear", fill: "backwards" });
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => choose(button.dataset.blogLayout));
  });
  // A radio group: arrows move the choice, as in any native radio group.
  toggle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = LAYOUTS.indexOf(layout);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? LAYOUTS.length - 1
          : (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + LAYOUTS.length) % LAYOUTS.length;
    choose(LAYOUTS[next], { focus: true });
  });

  // Cards: the glass needs the teasers it already loaded, and pointers need the topic links.
  function settleCards() {
    document.querySelectorAll(".blog-cards-view .blog-card").forEach((card) => window.SiteGlass?.paintTeaser?.(card));
  }
  if (layout === "cards") settleCards();

  // Topics: the note under the pointer or focus lights the notes that share a topic with it.
  const cards = Array.from(document.querySelectorAll(".blog-cards-view .blog-card"));
  const notes = cards.map((element) => ({ element, tags: parseTags(element.getAttribute("data-blog-tags")) }));
  let lit = null;
  let dimTimer = 0;
  const unlight = () => {
    lit = null;
    notes.forEach((note) => {
      note.element.removeAttribute("data-blog-relation");
      const label = note.element.querySelector("[data-blog-related]");
      if (label) label.textContent = "";
    });
  };
  const light = (element) => {
    window.clearTimeout(dimTimer);
    const source = notes.find((note) => note.element === element);
    if (!source || lit === source) return;
    unlight();
    lit = source;
    const related = relatedNotes(source, notes);
    if (!related.size) return;
    source.element.setAttribute("data-blog-relation", "source");
    notes.forEach((note) => {
      if (note === source) return;
      const tags = related.get(note);
      note.element.setAttribute("data-blog-relation", tags ? "related" : "quiet");
      const label = note.element.querySelector("[data-blog-related]");
      if (label && tags) label.textContent = `shares #${tags[0]}${tags.length > 1 ? ` +${tags.length - 1}` : ""}`;
    });
  };
  const dim = () => {
    window.clearTimeout(dimTimer);
    dimTimer = window.setTimeout(unlight, 120);
  };
  cards.forEach((card) => {
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") light(card);
    });
    card.addEventListener("pointerleave", dim);
    card.addEventListener("focus", () => light(card));
    card.addEventListener("blur", dim);
  });

  // Series: a stack opens in place; its notes fan out of the top card and the cards after it make room.
  document.querySelectorAll("[data-blog-series]").forEach((series, seriesIndex) => {
    const button = series.querySelector("[data-blog-series-toggle]");
    const members = Array.from(series.querySelectorAll(".blog-series-member"));
    members.forEach((member, index) => {
      member.id ||= `blog-series-${seriesIndex}-${index + 1}`;
      member.hidden = true;
    });
    if (!button || !members.length) return;
    button.setAttribute("aria-controls", members.map((member) => member.id).join(" "));
    series.classList.add("is-stacked");
    button.addEventListener("click", () => {
      const grid = series.closest(".blog-cards");
      const items = Array.from(grid.querySelectorAll(".blog-card-item, .blog-series, .blog-series .blog-card"));
      const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
      const top = series.querySelector(".blog-card:not(.blog-series-member)");
      const origin = top?.getBoundingClientRect();
      const opening = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", opening ? "true" : "false");
      series.classList.toggle("is-fanned", opening);
      series.classList.toggle("is-stacked", !opening);
      members.forEach((member) => (member.hidden = !opening));
      members.forEach((member) => window.SiteGlass?.paintTeaser?.(member));
      const motion = springs();
      if (!motion || reduce.matches) return;
      const { layout: travel, playful } = motion;
      items.forEach((item) => {
        const old = before.get(item);
        const now = item.getBoundingClientRect();
        if (!now.width || !old) return;
        if (members.includes(item) && opening && origin) {
          const dx = origin.left - now.left;
          const dy = origin.top - now.top;
          const drop = liquid?.dropFrames ? liquid.dropFrames(travel, playful, { x0: dx, y0: dy, s0: 0.9, stretch: 0.08 }) : null;
          if (drop) item.animate(drop, { duration: travel.duration, easing: "linear", fill: "backwards", delay: 40 });
          return;
        }
        if (!old.width) return;
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        const flight = window.SiteMotion.flightFrames(travel, { x0: dx, y0: dy, squash: 0.03 }).map((transform) => ({ transform }));
        item.animate(flight, { duration: travel.duration, easing: "linear" });
      });
    });
  });

  window.SiteBlogLayout = { choose, layout: () => layout };
}
