(function () {
  const lens = document.querySelector("[data-scholar-lens]");
  const workbench = document.querySelector("[data-publication-workbench]");
  if (!lens || !workbench) return;

  const entries = Array.from(document.querySelectorAll("[data-publication-key].publication-lens-entry"));
  const bars = Array.from(document.querySelectorAll("[data-scholar-bar]"));
  const roleInputs = Array.from(lens.querySelectorAll('input[name="publication-role-filter"]'));
  const typeInputs = Array.from(lens.querySelectorAll('input[name="publication-type-filter"]'));
  const stats = {
    papers: lens.querySelector('[data-scholar-stat="papers"]'),
    citations: lens.querySelector('[data-scholar-stat="citations"]'),
    firstAuthor: lens.querySelector('[data-scholar-stat="first-author"]'),
    types: lens.querySelector('[data-scholar-stat="types"]'),
  };

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  };

  const activeValue = (inputs) => inputs.find((input) => input.checked)?.value || "all";

  const matchesFilters = (element) => {
    const role = activeValue(roleInputs);
    const type = activeValue(typeInputs);
    const roleMatches = role === "all" || element.dataset.publicationRole === role;
    const typeMatches = type === "all" || element.dataset.publicationType === type;
    return roleMatches && typeMatches;
  };

  const matchingBars = () => bars.filter(matchesFilters);

  const matchingEntries = () => entries.filter(matchesFilters);

  const setStatText = (node, value) => {
    if (node) node.textContent = value;
  };

  const updateStats = () => {
    const selected = matchingBars();
    const citations = selected.reduce((sum, bar) => sum + Number(bar.dataset.publicationCitations || 0), 0);
    const firstAuthor = selected.filter((bar) => bar.dataset.publicationRole === "first-author");
    const counts = selected.reduce(
      (acc, bar) => {
        acc[bar.dataset.publicationType] = (acc[bar.dataset.publicationType] || 0) + 1;
        return acc;
      },
      { "full-paper": 0, "workshop-paper": 0, "poster-abstract": 0 }
    );

    setStatText(stats.papers, selected.length);
    setStatText(stats.citations, citations);
    setStatText(stats.firstAuthor, firstAuthor.length);
    setStatText(stats.types, `${counts["full-paper"] || 0} / ${counts["workshop-paper"] || 0} / ${counts["poster-abstract"] || 0}`);
  };

  const updateFilters = () => {
    const hasActiveFilter = activeValue(roleInputs) !== "all" || activeValue(typeInputs) !== "all";

    entries.forEach((entry) => {
      const match = matchesFilters(entry);
      const listItem = entry.closest("li");
      entry.classList.toggle("publication-lens-dimmed", hasActiveFilter && !match);
      entry.classList.toggle("publication-lens-selected", hasActiveFilter && match);
      if (listItem) {
        listItem.classList.toggle("publication-lens-dimmed", hasActiveFilter && !match);
        listItem.classList.toggle("publication-lens-selected", hasActiveFilter && match);
      }
    });

    bars.forEach((bar) => {
      const match = matchesFilters(bar);
      bar.classList.toggle("scholar-lens-bar-dimmed", hasActiveFilter && !match);
      bar.classList.toggle("scholar-lens-bar-selected", hasActiveFilter && match);
    });

    updateStats();
  };

  const setLinkedPaper = (paperKey) => {
    if (!paperKey) return;

    workbench.dataset.activePublication = paperKey;
    entries.forEach((entry) => {
      const match = entry.dataset.publicationKey === paperKey;
      const listItem = entry.closest("li");
      entry.classList.toggle("publication-lens-linked", match);
      entry.classList.toggle("publication-lens-muted-by-link", !match);
      if (listItem) {
        listItem.classList.toggle("publication-lens-linked", match);
        listItem.classList.toggle("publication-lens-muted-by-link", !match);
      }
    });

    bars.forEach((bar) => {
      const match = bar.dataset.publicationKey === paperKey;
      bar.classList.toggle("scholar-lens-bar-linked", match);
      bar.classList.toggle("scholar-lens-bar-muted-by-link", !match);
    });
  };

  const clearLinkedPaper = () => {
    delete workbench.dataset.activePublication;
    entries.forEach((entry) => {
      const listItem = entry.closest("li");
      entry.classList.remove("publication-lens-linked", "publication-lens-muted-by-link");
      if (listItem) listItem.classList.remove("publication-lens-linked", "publication-lens-muted-by-link");
    });
    bars.forEach((bar) => bar.classList.remove("scholar-lens-bar-linked", "scholar-lens-bar-muted-by-link"));
  };

  entries.forEach((entry) => {
    entry.addEventListener("mouseenter", () => setLinkedPaper(entry.dataset.publicationKey));
    entry.addEventListener("mouseleave", clearLinkedPaper);
    entry.addEventListener("focusin", () => setLinkedPaper(entry.dataset.publicationKey));
    entry.addEventListener("focusout", (event) => {
      if (!entry.contains(event.relatedTarget)) clearLinkedPaper();
    });
  });

  bars.forEach((bar) => {
    bar.addEventListener("mouseenter", () => setLinkedPaper(bar.dataset.publicationKey));
    bar.addEventListener("mouseleave", clearLinkedPaper);
    bar.addEventListener("focus", () => setLinkedPaper(bar.dataset.publicationKey));
    bar.addEventListener("blur", clearLinkedPaper);
    bar.addEventListener("click", () => {
      const entry = document.querySelector(`.publication-lens-entry[data-publication-key="${cssEscape(bar.dataset.publicationKey)}"]`);
      if (!entry) return;
      entry.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      const focusTarget = entry.querySelector("a, button, [tabindex]:not([tabindex='-1'])");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  });

  [...roleInputs, ...typeInputs].forEach((input) => input.addEventListener("change", updateFilters));

  updateFilters();
})();
