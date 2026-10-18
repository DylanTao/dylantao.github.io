// Project decks (2026-10-18). The site experiments nest: the website revamp holds the 3D home and the
// other experiments, the 3D home holds the Graphics Lab, and the lab holds its experiments. Each
// parent is a deck on the projects index. Opening one turns its card into a banner at the top of the
// level and fans its children out of it; the cards of the level above fold into the trail, which
// names every level and walks back up. Escape goes up one level, focus follows the reader, and
// #deck/<slug> keeps the state shareable (an inline script in _pages/projects.md applies it before
// the first paint).
//
// Motion: one clock per change on the site's springs (site-motion.mjs): the opened card travels to
// the banner on the layout spring and grows out of its old footprint; children fly out of the deck in
// a ripple ordered by distance, stretch a little as they speed up, squash as they land and settle with
// the playful spring's bounce; cards leaving fold toward the trail. An interrupted change continues
// from where everything is. Reduced motion changes level at once.

const KEYFRAMES = 30;

// #deck/<slug> -> slug, or null.
export function parseDeckHash(hash) {
  const match = /^#deck\/([a-z0-9-]+)$/.exec(hash || "");
  return match ? match[1] : null;
}

// The path from the outermost deck to `slug`, given each deck's parent slug (null at the top).
// Unknown slugs and cycles give an empty path.
export function deckPath(slug, parentOf) {
  const path = [];
  const seen = new Set();
  let current = slug;
  while (current) {
    if (seen.has(current) || !parentOf.has(current)) return [];
    seen.add(current);
    path.unshift(current);
    current = parentOf.get(current);
  }
  return path;
}

// Which decks a change opens and closes.
export function deckChange(from, to) {
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1;
  return { closing: from.slice(shared).reverse(), opening: to.slice(shared), depthChange: to.length - from.length };
}

// The angle each child starts at, fanned like a hand of cards around the deck: at most 14 degrees
// either way, wider for more cards.
export function fanAngles(count, spread = 5) {
  if (count <= 1) return count === 1 ? [0] : [];
  const middle = (count - 1) / 2;
  const step = Math.min(spread, 28 / (count - 1));
  return Array.from({ length: count }, (_, i) => +((i - middle) * step).toFixed(2));
}

// Keyframes for a card flying out of a deck to its place: it starts at offset (x0, y0), scaled by s0
// and turned by r0 degrees, fades in during the first quarter, travels on `travel` (with a stretch
// as it speeds up and a squash as it slows, area kept) and settles its size on `bounce`, whose
// overshoot is the small bounce at the end. Springs are site-motion.mjs objects; the last frame is
// exactly at rest.
export function fanFrames(travel, bounce, { x0 = 0, y0 = 0, s0 = 1, r0 = 0, squash = 0.035, fade = true } = {}, count = KEYFRAMES) {
  const seconds = travel.duration / 1000;
  const distance = Math.hypot(x0, y0);
  const ax = distance > 0.5 ? -x0 / distance : 1;
  const ay = distance > 0.5 ? -y0 / distance : 0;
  const angle = (Math.atan2(ay, ax) * 180) / Math.PI;
  const omega = (2 * Math.PI) / travel.period;
  const reference = Math.max(1, omega * omega * Math.max(distance, 1));
  const amplitude = squash * Math.min(1, distance / 240);
  // The bounce spring runs on the same clock, compressed so it settles with the travel.
  const bounceScale = bounce.seconds / seconds;
  const frames = [];
  for (let i = 0; i <= count; i++) {
    const p = i / count;
    if (i === count) {
      frames.push({ offset: 1, transform: "translate(0px, 0px) rotate(0deg) scale(1)", opacity: 1 });
      break;
    }
    const t = seconds * p;
    const h = 1e-4;
    const [x, vx] = travel.state(x0, 0, t);
    const [y, vy] = travel.state(y0, 0, t);
    const [, vxh] = travel.state(x0, 0, t + h);
    const [, vyh] = travel.state(y0, 0, t + h);
    const along = ((vxh - vx) / h) * ax + ((vyh - vy) / h) * ay;
    const ramp = Math.min(1, t / 0.08);
    const k = amplitude ? Math.max(-1, Math.min(1, along / reference)) * amplitude * ramp * ramp * (3 - 2 * ramp) : 0;
    const r = travel.state(r0, 0, t)[0];
    const s = 1 + bounce.state(s0 - 1, 0, t * bounceScale)[0];
    const stretch = 1 + k;
    frames.push({
      offset: p,
      transform:
        `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) ` +
        `rotate(${angle.toFixed(1)}deg) scale(${(s * stretch).toFixed(4)}, ${(s / stretch).toFixed(4)}) rotate(${(-angle).toFixed(1)}deg)`,
      opacity: fade ? Math.min(1, p * 4) : 1,
    });
  }
  return frames;
}

// Keyframes for a card leaving: from rest toward offset (x1, y1), shrinking to s1 and turning to r1,
// fading out on the way, eased by `travel` (a site-motion spring).
export function foldFrames(travel, { x1 = 0, y1 = 0, s1 = 0.4, r1 = 0 } = {}, count = 18) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const p = i / count;
    const e = travel.ease(p);
    return {
      offset: p,
      transform: `translate(${(x1 * e).toFixed(2)}px, ${(y1 * e).toFixed(2)}px) rotate(${(r1 * e).toFixed(2)}deg) scale(${(1 + (s1 - 1) * e).toFixed(4)})`,
      opacity: +(1 - Math.min(1, e * 1.15)).toFixed(3),
    };
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const stage = document.querySelector("[data-project-deck-stage]");
  if (stage) boot(stage);
}

function boot(stage) {
  const root = document.documentElement;
  const decks = Array.from(stage.querySelectorAll("[data-project-deck]"));
  if (!decks.length) return;
  const trail = stage.querySelector("[data-project-deck-trail]");
  const trailList = trail?.querySelector("ol");
  const status = document.querySelector("[data-project-card-status]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phone = window.matchMedia("(max-width: 767px)");
  const bySlug = new Map(decks.map((deck) => [deck.dataset.projectDeck, deck]));
  const parentDeck = (element) => element.parentElement?.closest("[data-project-deck]") || null;
  const parentOf = new Map(decks.map((deck) => [deck.dataset.projectDeck, parentDeck(deck)?.dataset.projectDeck || null]));
  const childrenOf = (deck) => deck.querySelector(":scope > [data-project-deck-children]");
  const surfaceOf = (deck) => deck.querySelector(":scope > .card");
  const titleOf = (deck) => surfaceOf(deck)?.querySelector(".card-title")?.textContent.trim() || "Projects";
  const rootLabel = stage.querySelector("#site-experiments-title")?.textContent.trim() || "Site experiments";
  const following = () => {
    const out = [];
    for (let node = stage.nextElementSibling; node; node = node.nextElementSibling) out.push(node);
    return out;
  };

  let path = (root.getAttribute("data-project-deck-path") || "").split("/").filter((slug) => bySlug.has(slug));
  let run = null;

  const springs = () => {
    const motion = window.SiteMotion;
    if (reduce.matches || !motion?.spring || !("animate" in Element.prototype)) return null;
    return {
      layout: motion.spring("layout"),
      gentle: motion.spring("gentle"),
      playful: motion.spring("playful"),
      confident: motion.spring("confident"),
    };
  };

  // Pictures inside a closed deck load lazily; a reader who points at or focuses a deck is about to
  // open it, so its level starts loading then.
  const warm = (deck) => {
    const container = childrenOf(deck);
    if (!container || container.dataset.warm) return;
    container.dataset.warm = "1";
    container.querySelectorAll("img[loading='lazy']").forEach((image) => {
      if (image.closest("[data-project-deck-children]") === container) image.loading = "eager";
    });
  };

  // Cards that appear with a level never wait for the scroll reveal; they arrive with the deck.
  const markRevealed = (container) => {
    container?.querySelectorAll(".card.site-reveal, .lab-card").forEach((card) => card.classList.add("site-visible", "site-revealed"));
    container?.querySelectorAll(".card, .lab-card").forEach((card) => window.SiteGlass?.paintTeaser?.(card));
  };

  const renderTrail = (next) => {
    if (!trail || !trailList) return;
    trail.hidden = next.length === 0;
    const items = [{ slug: "", label: rootLabel }].concat(next.map((slug) => ({ slug, label: titleOf(bySlug.get(slug)) })));
    trailList.replaceChildren(
      ...items.map((item, index) => {
        const li = document.createElement("li");
        if (index === items.length - 1) {
          li.setAttribute("aria-current", "location");
          const span = document.createElement("span");
          span.textContent = item.label;
          li.append(span);
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("data-project-deck-crumb", item.slug);
          button.textContent = item.label;
          li.append(button);
        }
        return li;
      })
    );
    // On a phone the trail is one sideways line; show its end, where the reader is.
    trailList.scrollLeft = trailList.scrollWidth;
  };

  const applyState = (next) => {
    decks.forEach((deck) => {
      const slug = deck.dataset.projectDeck;
      const index = next.indexOf(slug);
      const open = index >= 0;
      const current = open && index === next.length - 1;
      deck.classList.toggle("is-open", open);
      deck.classList.toggle("is-current", current);
      deck.setAttribute("data-project-deck-state", open ? "open" : "closed");
      const container = childrenOf(deck);
      if (container) {
        if (open) container.removeAttribute("hidden");
        else container.setAttribute("hidden", "until-found");
      }
      const trigger = surfaceOf(deck)?.querySelector("[data-project-deck-trigger]");
      trigger?.setAttribute("aria-expanded", open ? "true" : "false");
      const panel = surfaceOf(deck)?.querySelector("[data-project-card-panel]");
      if (panel) panel.hidden = !current;
    });
    stage.querySelectorAll(".is-folded").forEach((element) => element.classList.remove("is-folded"));
    next.forEach((slug) => {
      const deck = bySlug.get(slug);
      Array.from(deck.parentElement.children).forEach((sibling) => {
        if (sibling !== deck) sibling.classList.add("is-folded");
      });
    });
    if (next.length) root.setAttribute("data-project-deck-path", next.join("/"));
    else root.removeAttribute("data-project-deck-path");
    stage.classList.toggle("has-open-deck", next.length > 0);
    renderTrail(next);
    path = next;
    if (next.length) {
      const current = bySlug.get(next.at(-1));
      markRevealed(childrenOf(current));
      // The close button sits at the top of the banner's copy, where the stack icon was: beside the
      // picture on wide screens, just below it on a phone.
      const surface = surfaceOf(current);
      const body = surface?.querySelector(".project-card-body");
      if (body) surface.style.setProperty("--project-card-body-top", `${body.offsetTop}px`);
    }
    syncRow();
  };

  // Everything a change might move: every card and experiment in the stage, the banner surfaces, and
  // the sections after the stage. Rects are measured with any running animation still applied, so an
  // interrupted change continues from what the reader sees.
  const visible = (element) => element.getClientRects().length > 0;
  const tracked = () => [
    ...stage.querySelectorAll("[data-project-card]:not([data-project-deck]), .lab-deck-item"),
    ...decks.map((deck) => surfaceOf(deck)).filter(Boolean),
  ];
  const measure = () => {
    const rects = new Map();
    tracked().forEach((element) => {
      if (visible(element)) rects.set(element, element.getBoundingClientRect());
    });
    following().forEach((element) => rects.set(element, element.getBoundingClientRect()));
    return rects;
  };
  const crumbRect = (slug) => {
    const button = trailList?.querySelector(`[data-project-deck-crumb="${slug}"]`);
    const current = trailList?.querySelector("[aria-current]");
    return (button || current)?.getBoundingClientRect() || trail?.getBoundingClientRect() || null;
  };

  const ghostLayer = () => {
    let layer = stage.querySelector(":scope > .project-deck-ghosts");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "project-deck-ghosts";
      layer.setAttribute("aria-hidden", "true");
      stage.append(layer);
    }
    return layer;
  };
  // A visual copy of something that is leaving, left where it was so it can fold away while the real
  // element is already gone from the layout.
  const ghostOf = (element, rect, stageRect) => {
    const ghost = element.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    ghost.setAttribute("inert", "");
    ghost.classList.add("project-deck-ghost");
    ghost.classList.remove("is-folded");
    Object.assign(ghost.style, {
      left: `${rect.left - stageRect.left}px`,
      top: `${rect.top - stageRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    ghostLayer().append(ghost);
    return ghost;
  };

  const settle = () => {
    if (!run) return;
    const finished = run;
    run = null;
    finished.animations.forEach((animation) => animation.cancel());
    root.removeAttribute("data-project-deck-moving");
    finished.onSettled?.();
  };

  const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

  const animate = (before, after, plan, onSettled) => {
    const motion = springs();
    const current = { animations: [], onSettled };
    run = current;
    if (!motion) {
      settle();
      return;
    }
    root.setAttribute("data-project-deck-moving", "");
    const { layout, gentle, playful } = motion;
    const stageRect = stage.getBoundingClientRect();
    const timing = (duration, delay = 0, fill = "backwards") => ({ duration, delay, easing: "linear", fill });
    const opened = plan.openedDeck;
    const closed = plan.closedDeck;
    // Where children fly out of (opening) or back into (closing): the deck's card as it was or will be.
    const deckRectBefore = opened ? before.get(surfaceOf(opened)) : null;
    const deckRectAfter = closed ? after.get(surfaceOf(closed)) : null;

    // 1. Things leaving fold away as ghosts: into the trail when going down, into their deck going up.
    const leaving = [...before.keys()].filter((element) => !after.has(element) && stage.contains(element));
    const foldTarget = (element) => {
      if (closed && closed.contains(element) && deckRectAfter) return deckRectAfter;
      const parentSlug = plan.direction === "down" ? (plan.from.at(-1) ?? "") : "";
      return crumbRect(parentSlug);
    };
    leaving.forEach((element, index) => {
      const rect = before.get(element);
      if (!rect?.width || !rect.height) return;
      const target = foldTarget(element);
      const ghost = ghostOf(element.matches(".card") ? element.closest("[data-project-card]") || element : element, rect, stageRect);
      if (element.matches(".card")) {
        // A banner folding away: only its own surface, not the children it held.
        ghost.querySelectorAll(":scope > [data-project-deck-children], :scope > .project-deck-sheets").forEach((node) => node.remove());
      }
      const from = center(rect);
      const to = target ? center(target) : { x: from.x, y: from.y - 40 };
      const scale = target ? Math.max(0.12, Math.min(0.5, target.width / rect.width)) : 0.6;
      const frames = foldFrames(gentle, { x1: to.x - from.x, y1: to.y - from.y, s1: scale, r1: (index % 2 ? 1 : -1) * 4 });
      const animation = ghost.animate(frames, timing(gentle.duration * 0.7, Math.min(index, 8) * 14, "both"));
      animation.finished.finally(() => ghost.remove());
    });

    // 2. Things staying glide from where they were, with the squash of the shared springs.
    const SiteMotion = window.SiteMotion;
    after.forEach((rect, element) => {
      const old = before.get(element);
      if (!old) return;
      if (element.matches(".card")) return; // banner surfaces are handled in step 3
      const dx = old.left - rect.left;
      const dy = old.top - rect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      const frames = SiteMotion.flightFrames(layout, {
        x0: dx,
        y0: dy,
        squash: element.closest(".projects") && stage.contains(element) ? 0.03 : 0,
      }).map((transform) => ({ transform }));
      current.animations.push(element.animate(frames, timing(layout.duration)));
    });

    // 3. The deck that opens travels to the banner and grows out of its old footprint; a deck that
    //    closes shrinks back into its place in the grid.
    decks.forEach((deck) => {
      const surface = surfaceOf(deck);
      const old = before.get(surface);
      const rect = after.get(surface);
      if (!surface || !rect) return;
      if (!old) {
        // A banner coming back out of the trail unfolds from its crumb.
        const crumb = crumbRect(deck.dataset.projectDeck);
        if (!crumb || plan.direction !== "up") return;
        const from = center(crumb);
        const to = center(rect);
        const frames = fanFrames(layout, playful, {
          x0: from.x - to.x,
          y0: from.y - to.y,
          s0: Math.max(0.15, Math.min(0.6, crumb.width / rect.width)),
          r0: 0,
          squash: 0.02,
        });
        current.animations.push(surface.animate(frames, timing(layout.duration)));
        return;
      }
      const dx = old.left - rect.left;
      const dy = old.top - rect.top;
      const right = Math.max(0, rect.width - old.width);
      const bottom = Math.max(0, rect.height - old.height);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && right < 0.5 && bottom < 0.5) return;
      const frames = SiteMotion.springSamples(layout, 1, 0, layout.duration, KEYFRAMES).map((offset, i) => {
        const x = dx * offset;
        const y = dy * offset;
        const r = Math.max(0, right * offset);
        const b = Math.max(0, bottom * offset);
        return {
          offset: i / KEYFRAMES,
          transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`,
          clipPath: i === KEYFRAMES ? "inset(0px 0px 0px 0px)" : `inset(0px ${r.toFixed(2)}px ${b.toFixed(2)}px 0px round var(--md-lite-radius-md))`,
        };
      });
      current.animations.push(surface.animate(frames, timing(layout.duration)));
    });

    // 4. Things arriving: children fly out of the deck that opened, in a ripple from it; anything else
    //    that appears (a level coming back from the trail) unfolds from the trail.
    const arriving = [...after.keys()].filter((element) => !before.has(element) && stage.contains(element) && !element.matches(".card"));
    const origin = deckRectBefore
      ? center(deckRectBefore)
      : (() => {
          const crumb = crumbRect(plan.to.at(-1) ?? "");
          return crumb ? center(crumb) : null;
        })();
    if (origin) {
      const rects = arriving.map((element) => after.get(element));
      const delays = SiteMotion.rippleDelays(rects.map(center), origin, { speed: 7, maxDelay: 140 });
      const angles = fanAngles(arriving.length);
      arriving.forEach((element, index) => {
        const rect = rects[index];
        if (!rect?.width || !rect.height) return;
        const c = center(rect);
        const fit = deckRectBefore ? Math.min(deckRectBefore.width / rect.width, deckRectBefore.height / rect.height) * 0.62 : 0.35;
        const frames = fanFrames(layout, playful, {
          x0: origin.x - c.x,
          y0: origin.y - c.y,
          s0: Math.max(0.18, Math.min(0.9, fit)),
          r0: angles[index] ?? 0,
        });
        current.animations.push(element.animate(frames, timing(layout.duration, delays[index])));
      });
    }

    // 5. The banner's story arrives in reading order once the card has grown.
    const banner = plan.direction === "down" ? opened : plan.to.length ? bySlug.get(plan.to.at(-1)) : null;
    if (banner && plan.direction === "down") {
      let index = 0;
      surfaceOf(banner)
        ?.querySelectorAll(".project-card-story-beat, .project-card-takeaways, .project-card-actions-expanded > *, .project-card-close")
        .forEach((element) => {
          if (!visible(element)) return;
          const frames = window.SiteMotion.springSamples(gentle, 8, 0, gentle.duration, KEYFRAMES).map((y, i) => ({
            transform: `translateY(${y.toFixed(2)}px)`,
            opacity: i === 0 ? 0 : Math.min(1, gentle.ease(i / KEYFRAMES) * 1.3),
          }));
          current.animations.push(element.animate(frames, timing(gentle.duration, 120 + index * 45)));
          index += 1;
        });
    }
    // 6. A new crumb slides in beside the others.
    const lastCrumb = trailList?.lastElementChild;
    if (lastCrumb && plan.direction === "down") {
      current.animations.push(
        lastCrumb.animate(
          [
            { transform: "translateX(-10px)", opacity: 0 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 360, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "backwards" }
        )
      );
    }

    if (!current.animations.length) {
      settle();
      return;
    }
    Promise.allSettled(current.animations.map((animation) => animation.finished)).then(() => {
      if (run === current) settle();
    });
  };

  // At most one scroll per change: bring the trail (or the stage) under the navigation bar when the
  // new level starts above the viewport.
  const keepInView = () => {
    const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
    const anchor = path.length ? trail : stage;
    const top = anchor?.getBoundingClientRect().top ?? 0;
    const margin = phone.matches ? 10 : 18;
    if (top < navBottom + margin || top > window.innerHeight * 0.6) {
      window.scrollBy({ top: top - navBottom - margin, behavior: reduce.matches ? "auto" : "smooth" });
    }
  };

  const announce = (text) => {
    if (status) status.textContent = text;
  };

  const go = (next, { focus = "auto", scroll = true, updateHash = true } = {}) => {
    if (next.join("/") === path.join("/")) return;
    const from = path;
    const change = deckChange(from, next);
    const plan = {
      from,
      to: next,
      direction: change.depthChange > 0 ? "down" : "up",
      openedDeck: change.opening.length ? bySlug.get(change.opening.at(-1)) : null,
      closedDeck: change.closing.length ? bySlug.get(change.closing.at(-1)) : null,
    };
    // Close any open preview inside the level first (project-cards.js), without its own motion.
    document.dispatchEvent(new CustomEvent("project-cards:reset"));
    const before = measure();
    settle();
    applyState(next);
    const after = measure();
    animate(before, after, plan, null);
    if (updateHash && window.history?.replaceState) {
      const url = `${window.location.pathname}${window.location.search}${next.length ? `#deck/${next.at(-1)}` : ""}`;
      window.history.replaceState(window.history.state, "", url);
    }
    if (next.length) {
      const deck = bySlug.get(next.at(-1));
      const size = deck.dataset.projectDeckSize;
      announce(`${titleOf(deck)} opened, ${size} inside.`);
    } else {
      announce(`Back to ${rootLabel.toLowerCase()}.`);
    }
    // Focus: down a level, the banner's title; up a level, the deck the reader came out of.
    if (focus !== "none") {
      if (plan.direction === "down" && plan.openedDeck) {
        const heading = surfaceOf(plan.openedDeck)?.querySelector(".card-title");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      } else if (plan.closedDeck) {
        surfaceOf(plan.closedDeck)?.querySelector("[data-project-deck-trigger]")?.focus({ preventScroll: true });
      }
    }
    if (scroll) keepInView();
  };

  // Phones show a level's cards as one scroll-snapped row (_sass/_glass.scss); its count follows the
  // card most in view.
  let rowObserver = null;
  function syncRow() {
    rowObserver?.disconnect();
    rowObserver = null;
    if (!phone.matches || !path.length || !("IntersectionObserver" in window)) return;
    const container = childrenOf(bySlug.get(path.at(-1)));
    const row = container?.querySelector(":scope > .project-card-grid");
    const position = container?.querySelector("[data-project-deck-position]");
    if (!row || !position) return;
    const cards = Array.from(row.children).filter((child) => child.matches("[data-project-card]"));
    const ratios = new Map();
    rowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
        let best = cards[0];
        cards.forEach((card) => {
          if ((ratios.get(card) || 0) > (ratios.get(best) || 0)) best = card;
        });
        position.textContent = String(cards.indexOf(best) + 1);
      },
      { root: row, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    cards.forEach((card) => rowObserver.observe(card));
  }
  phone.addEventListener("change", syncRow);

  // Wiring.
  decks.forEach((deck) => {
    const surface = surfaceOf(deck);
    const slug = deck.dataset.projectDeck;
    surface?.querySelector("[data-project-deck-trigger]")?.addEventListener("click", () => {
      const index = path.indexOf(slug);
      if (index >= 0) go(path.slice(0, index), { focus: "auto" });
      else go(deckPath(slug, parentOf));
    });
    surface?.querySelector("[data-project-deck-close]")?.addEventListener("click", () => {
      const index = path.indexOf(slug);
      go(index >= 0 ? path.slice(0, index) : path);
    });
    deck.addEventListener("pointerenter", () => warm(deck), { once: true });
    deck.addEventListener("focusin", () => warm(deck), { once: true });
    // Find in page reaches a card inside a closed deck: open the path to it so the match can show.
    childrenOf(deck)?.addEventListener("beforematch", () => {
      go(deckPath(slug, parentOf), { focus: "none", scroll: false });
    });
  });
  trail?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-project-deck-crumb]") : null;
    if (!button) return;
    const slug = button.getAttribute("data-project-deck-crumb");
    go(slug ? deckPath(slug, parentOf) : []);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !path.length || event.defaultPrevented) return;
    // An open preview closes first (project-cards.js handles that Escape).
    if (document.querySelector(".projects .project-card.is-expanded:not([data-project-deck])")) return;
    if (document.querySelector("ninja-keys[opened], .theme-menu:not([hidden])")) return;
    go(path.slice(0, -1));
  });
  window.addEventListener("hashchange", () => {
    const slug = parseDeckHash(window.location.hash);
    if (slug && bySlug.has(slug)) go(deckPath(slug, parentOf), { updateHash: false });
  });

  // Start from the state the inline script applied (or the hash), with no motion.
  const initial = parseDeckHash(window.location.hash);
  const start = initial && bySlug.has(initial) ? deckPath(initial, parentOf) : [];
  path = [];
  applyState(start);
  if (start.length) {
    window.requestAnimationFrame(() => {
      const anchor = trail && !trail.hidden ? trail : stage;
      const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
      const top = anchor.getBoundingClientRect().top;
      if (top < navBottom || top > window.innerHeight * 0.75) window.scrollBy({ top: top - navBottom - 18, behavior: "auto" });
    });
  }

  window.SiteDecks = { go: (slug) => go(slug ? deckPath(slug, parentOf) : []), path: () => path.slice() };
}
