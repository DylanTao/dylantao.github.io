import { highlightSearchTerm } from "./highlight-search-term.js";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("bibsearch");
  const list = document.getElementById("publication-list-view");
  if (!input || !list) return;

  const status = document.getElementById("bibsearch-status");
  const entrySelector = "#publication-list-view .bibliography > li";
  const rows = Array.from(list.querySelectorAll(".bibliography > li"));
  const historyKey = "siruiBibliography";
  let timer = null;

  const normalized = (value) => value.trim().toLowerCase();
  const doi = (value) => normalized(value).match(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/)?.[1];
  const indexed = rows.map((row) => [row, doi(row.querySelector('a[href*="//doi.org/"]')?.href || "")]);
  const matches = (row, query, queryDoi, rowDoi) => normalized(row.textContent).includes(query) || (queryDoi && queryDoi === rowDoi);

  const decodedFragment = () => {
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return "";
    }
  };
  const fragmentTarget = (id) => document.getElementById(id) || Array.from(document.getElementsByName(id)).find((node) => node.tagName === "A");

  const fragmentFilter = () => {
    const raw = location.hash.slice(1);
    if (raw.startsWith("filter=")) return new URLSearchParams(raw).get("filter");
    const fragment = decodedFragment();
    // Prefer native fragments, including bibliography keys and named anchors.
    if (!fragment || fragmentTarget(fragment)) return null;

    // Older share links used a bare title, year or DOI as the fragment.
    const query = normalized(fragment);
    const queryDoi = doi(fragment);
    return indexed.some(([row, rowDoi]) => matches(row, query, queryDoi, rowDoi)) ? fragment : null;
  };

  const renderFilter = (value) => {
    const query = normalized(value);
    const queryDoi = doi(value);
    if (CSS.highlights) highlightSearchTerm({ search: query, selector: entrySelector });
    let count = 0;
    for (const [row, rowDoi] of indexed) {
      const show = !query || matches(row, query, queryDoi, rowDoi);
      row.classList.toggle("unloaded", !show);
      if (show) count++;
    }

    for (const year of list.querySelectorAll("h2.bibliography")) {
      let yearVisible = false;
      let subgroup = null;
      for (let node = year.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) {
        if (node.tagName === "H3") subgroup = node;
        if (node.tagName !== "OL") continue;
        const visible = Array.from(node.children).some((row) => !row.classList.contains("unloaded"));
        node.classList.toggle("unloaded", !visible);
        subgroup?.classList.toggle("unloaded", !visible);
        subgroup = null;
        yearVisible ||= visible;
      }
      year.classList.toggle("unloaded", !yearVisible);
    }
    const message = count === 1 ? "1 paper shown" : count ? String(count) + " papers shown" : "No papers match";
    if (status.textContent !== message) status.textContent = message;
  };

  const currentState = () => {
    const state = history.state?.[historyKey];
    return state?.hash === location.hash ? state : null;
  };
  const persist = (query, record, url = new URL(location.href)) => {
    history.replaceState({ ...history.state, [historyKey]: { hash: url.hash, query, record } }, "", url);
  };

  const recordLink = (record) => {
    if (!record) return null;
    const entry = list.querySelector('[data-publication-key="' + CSS.escape(record.key) + '"]');
    if (!entry || entry.closest(".unloaded")) return null;
    return Array.from(entry.querySelectorAll("a[href]")).find((link) => link.getAttribute("href") === record.href);
  };

  const applyHistory = () => {
    clearTimeout(timer);
    timer = null;
    const state = currentState();
    const target = fragmentTarget(decodedFragment());
    const hiddenTarget = target?.closest(".unloaded");
    input.value = state?.query ?? fragmentFilter() ?? "";
    renderFilter(input.value);
    // The native scroll may have happened while a prior query hid the target.
    if (hiddenTarget && target.getClientRects().length) target.scrollIntoView({ behavior: "instant" });
    if (state?.record?.guide) {
      const guide = recordLink(state.record)?.closest("details[data-publication-why-cite]");
      if (guide) guide.open = true;
    }
  };

  const applyInput = () => {
    clearTimeout(timer);
    timer = null;
    const url = new URL(location.href);
    // A new typed query is local to this entry, even when it began at a share URL.
    if (fragmentFilter() !== null) url.hash = "";
    persist(input.value, null, url);
    renderFilter(input.value);
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(applyInput, 300);
  });
  input.addEventListener("change", () => {
    if (timer !== null) applyInput();
  });
  window.addEventListener("pagehide", () => {
    if (timer !== null) applyInput();
  });
  window.addEventListener("popstate", applyHistory);
  window.addEventListener("hashchange", applyHistory);

  list.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest("a[href]");
    const entry = link?.closest("[data-publication-key]");
    if (!entry || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const destination = new URL(link.href);
    if (!["https:", "http:"].includes(destination.protocol)) return;
    if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) return;
    if (timer !== null) applyInput();
    persist(input.value, {
      key: entry.dataset.publicationKey,
      href: link.getAttribute("href"),
      guide: Boolean(link.closest("details[data-publication-why-cite]")?.open),
      top: link.getBoundingClientRect().top,
      keyboard: event.detail === 0,
    });
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted || performance.getEntriesByType("navigation")[0]?.type !== "back_forward") return;
    const saved = currentState()?.record;
    const link = recordLink(saved);
    if (!link) return;
    // Let native history restore scroll first. Correct only a displaced return.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const bounds = link.getBoundingClientRect();
        const navbar = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
        if (bounds.top < navbar || bounds.bottom > innerHeight) {
          const top = Math.max(navbar + 8, Math.min(saved.top, innerHeight - bounds.height - 8));
          window.scrollBy({ top: bounds.top - top, behavior: "instant" });
        }
        if (saved.keyboard && document.activeElement === document.body) link.focus({ preventScroll: true });
      })
    );
  });

  applyHistory();
});
