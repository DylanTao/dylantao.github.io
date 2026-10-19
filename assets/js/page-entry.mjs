// Card-to-page entry (2026-10-18). Same-origin navigations already cross-fade (@view-transition in
// head.liquid). This adds shared elements: a card, row or experiment marked [data-entry] gives its
// surface, title ([data-entry-title]) and picture ([data-entry-media]) the names entry-surface,
// entry-title and entry-media when its link is followed; the inline pagereveal listener in
// head.liquid gives the same names to the page's hero, so the card grows into the page
// (_sass/_transitions.scss). Leaving a page by any route, its hero takes the names too, and the
// listener on the page it returns to lands it on the matching card. Browsers without cross-document
// view transitions navigate as before.

export const ENTRY_KEY = "site:entry";
export const TARGET_SELECTOR = "[data-entry-target], .project-case-hero, .blog-post .post-header, .publication-context-hero";

// The address a navigation lands on, without its fragment or query, for matching cards and pages.
export function pageKey(url) {
  try {
    const parsed = new URL(url, "http://localhost/");
    return parsed.origin + parsed.pathname;
  } catch {
    return null;
  }
}

// Whether a click on this link should carry its card into the next page.
export function followsEntry(link, { origin, pathname }, modifiers = {}) {
  if (!link || modifiers.button > 0 || modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey || modifiers.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute?.("download")) return false;
  if (link.origin !== origin) return false;
  // Files (a PDF, the BibTeX, a Markdown copy) are not pages a card can grow into.
  if (/\.(pdf|md|bib|ris|json|txt|zip|png|jpe?g|webp|gif|svg|mp4)$/i.test(link.pathname)) return false;
  return link.pathname !== pathname;
}

if (typeof window !== "undefined" && typeof document !== "undefined" && "CSSViewTransitionRule" in window) {
  const named = new Set();
  const clear = () => {
    named.forEach((element) => (element.style.viewTransitionName = ""));
    named.clear();
  };
  const name = (element, value) => {
    if (!element || named.has(element) || !element.getClientRects().length) return;
    element.style.viewTransitionName = value;
    named.add(element);
  };
  const remember = (value) => {
    try {
      sessionStorage.setItem(ENTRY_KEY, JSON.stringify(value));
    } catch {
      /* private mode: the page still cross-fades */
    }
  };
  let marked = false;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!followsEntry(link, window.location, event)) return;
    const entry = link.closest("[data-entry]");
    if (!entry) return;
    clear();
    name(entry.querySelector(":scope > .card") || entry, "entry-surface");
    name(entry.querySelector("[data-entry-title]"), "entry-title");
    name(entry.querySelector("[data-entry-media] img"), "entry-media");
    marked = true;
    remember({ to: pageKey(link.href), from: pageKey(window.location.href) });
  });

  // A navigation that did not start on a card (Back, a nav link, a trail link): a page with a hero
  // lends it to the page it goes to, which lands it on the matching card if it has one.
  window.addEventListener("pageswap", (event) => {
    if (!event.viewTransition) return;
    if (marked) return;
    const destination = event.activation?.entry?.url;
    const hero = document.querySelector(TARGET_SELECTOR);
    if (!destination || !hero) return;
    clear();
    name(hero, "entry-surface");
    name(hero.querySelector("h1"), "entry-title");
    name(hero.querySelector(".project-case-media img"), "entry-media");
    remember({ back: pageKey(window.location.href), backTo: pageKey(destination) });
  });

  // Restored from the back/forward cache: forget the names this page lent out.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    marked = false;
    clear();
  });
}
