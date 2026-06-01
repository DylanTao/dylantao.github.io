(function () {
  const lens = document.querySelector("[data-scholar-lens]");
  const workbench = document.querySelector("[data-publication-workbench]");
  if (!lens || !workbench) return;

  const rejectionWall = document.querySelector(".wall-of-rejection");
  const entries = Array.from(document.querySelectorAll("[data-publication-key].publication-lens-entry"));
  const yearBars = Array.from(lens.querySelectorAll("[data-scholar-year-bar]"));
  const roleInputs = Array.from(lens.querySelectorAll('input[name="publication-role-filter"]'));
  const typeInputs = Array.from(lens.querySelectorAll('input[name="publication-type-filter"]'));
  const typeSelect = lens.querySelector("select[data-scholar-type-filter]");
  const activeYearLabel = lens.querySelector("[data-scholar-active-year]");
  const stats = {
    papers: lens.querySelector('[data-scholar-stat="papers"]'),
    citations: lens.querySelector('[data-scholar-stat="citations"]'),
    firstAuthor: lens.querySelector('[data-scholar-stat="first-author"]'),
    firstAuthorCitations: lens.querySelector('[data-scholar-stat="first-author-citations"]'),
    types: lens.querySelector('[data-scholar-stat="types"]'),
  };

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  };

  const entryByKey = new Map(entries.map((entry) => [entry.dataset.publicationKey, entry]));

  const activeRole = () => roleInputs.find((input) => input.checked)?.value || "all";
  const activeType = () => typeInputs.find((input) => input.checked)?.value || typeSelect?.value || "all";

  const parseContributions = (bar) =>
    (bar.dataset.yearPapers || "")
      .split(";")
      .map((pair) => {
        const [key, rawCount] = pair.split(":");
        return { key, citations: Number(rawCount || 0) };
      })
      .filter((item) => item.key);

  const paperMatches = (entry) => {
    const role = activeRole();
    const type = activeType();
    const entryRole = entry.dataset.publicationRole;
    const roleMatches = role === "all" || entryRole === role || (role === "first-author" && entryRole === "co-first");
    const typeMatches = type === "all" || entry.dataset.publicationGroup === type;
    return roleMatches && typeMatches;
  };

  const matchingEntries = () => entries.filter(paperMatches);

  const setStatText = (node, value) => {
    if (node) node.textContent = value;
  };

  const citationWord = (count) => (Number(count) === 1 ? "citation" : "citations");

  const visibleYearTotal = (bar) => Number(bar.dataset.visibleTotal || bar.dataset.yearTotal || 0);

  const paperTitle = (entry) => {
    const title = entry?.querySelector(".title")?.textContent?.replace(/\s+/g, " ").trim();
    return title || entry?.dataset.publicationKey || "paper";
  };

  const resetYearPaperShare = (bar, visibleTotal = visibleYearTotal(bar)) => {
    const label = bar.querySelector("[data-year-total-label]");
    if (label) label.textContent = visibleTotal;
    bar.classList.remove("scholar-lens-year-paper-share");
    bar.style.removeProperty("--paper-share-ratio");
    bar.style.removeProperty("--paper-share-height");
    delete bar.dataset.paperShare;
    delete bar.dataset.paperShareTotal;
    bar.removeAttribute("title");
    bar.setAttribute("aria-label", `${bar.dataset.year}: ${visibleTotal} ${citationWord(visibleTotal)} in the active lens`);
  };

  const resetYearPaperShares = () => {
    yearBars.forEach((bar) => resetYearPaperShare(bar));
  };

  const applyPaperShares = (entry) => {
    if (!entry || !paperMatches(entry)) return 0;

    const key = entry.dataset.publicationKey;
    const title = paperTitle(entry);
    let activeCitations = 0;

    yearBars.forEach((bar) => {
      const visibleTotal = visibleYearTotal(bar);
      const contribution = parseContributions(bar).find((item) => item.key === key)?.citations || 0;
      if (!visibleTotal || !contribution) return;

      const yearRatio = Number.parseFloat(bar.style.getPropertyValue("--year-ratio")) || 0;
      const paperShareRatio = (contribution / visibleTotal) * 100;
      const paperShareHeight = Math.min(yearRatio, (paperShareRatio / 100) * yearRatio);
      const label = bar.querySelector("[data-year-total-label]");
      const roundedShare = Math.round(paperShareRatio);
      const shareLabel = `${contribution} of ${visibleTotal} ${citationWord(visibleTotal)} from ${title}`;

      bar.classList.add("scholar-lens-year-paper-share");
      bar.dataset.paperShare = String(contribution);
      bar.dataset.paperShareTotal = String(visibleTotal);
      bar.style.setProperty("--paper-share-ratio", `${paperShareRatio}%`);
      bar.style.setProperty("--paper-share-height", `${paperShareHeight}%`);
      if (label) label.textContent = `${contribution}`;
      bar.title = shareLabel;
      bar.setAttribute("aria-label", `${bar.dataset.year}: ${shareLabel}, ${roundedShare}% of active-lens ${citationWord(visibleTotal)}`);
      activeCitations += contribution;
    });

    return activeCitations;
  };

  const yearVisibleTotal = (bar) =>
    parseContributions(bar).reduce((sum, contribution) => {
      const entry = entryByKey.get(contribution.key);
      return entry && paperMatches(entry) ? sum + contribution.citations : sum;
    }, 0);

  const updateStats = () => {
    const selected = matchingEntries();
    const citations = selected.reduce((sum, entry) => sum + Number(entry.dataset.publicationCitations || 0), 0);
    const firstAuthor = selected.filter((entry) => entry.dataset.publicationRole === "first-author" || entry.dataset.publicationRole === "co-first");
    const firstAuthorCitations = firstAuthor.reduce((sum, entry) => sum + Number(entry.dataset.publicationCitations || 0), 0);
    const fullPapers = selected.filter((entry) => entry.dataset.publicationGroup === "full-paper").length;
    const shortPapers = selected.filter((entry) => entry.dataset.publicationGroup === "short-form").length;

    setStatText(stats.papers, selected.length);
    setStatText(stats.citations, citations);
    setStatText(stats.firstAuthor, firstAuthor.length);
    setStatText(stats.firstAuthorCitations, `${firstAuthorCitations} cites`);
    setStatText(stats.types, `${fullPapers} / ${shortPapers}`);
  };

  const updateYearBars = () => {
    const totals = yearBars.map(yearVisibleTotal);
    const maxTotal = Math.max(...totals, 1);

    yearBars.forEach((bar, index) => {
      const visibleTotal = totals[index];
      bar.dataset.visibleTotal = visibleTotal;
      bar.style.setProperty("--year-ratio", `${(visibleTotal / maxTotal) * 100}%`);
      bar.classList.toggle("scholar-lens-year-empty", visibleTotal === 0);
      resetYearPaperShare(bar, visibleTotal);
    });
  };

  const updateFilters = () => {
    const hasActiveFilter = activeRole() !== "all" || activeType() !== "all";

    entries.forEach((entry) => {
      const match = paperMatches(entry);
      const listItem = entry.closest("li");
      entry.classList.toggle("publication-lens-dimmed", hasActiveFilter && !match);
      entry.classList.toggle("publication-lens-selected", hasActiveFilter && match);
      if (listItem) {
        listItem.classList.toggle("publication-lens-dimmed", hasActiveFilter && !match);
        listItem.classList.toggle("publication-lens-selected", hasActiveFilter && match);
      }
    });

    updateStats();
    updateYearBars();
  };

  const setLinkedPapers = (paperKeys, sourceLabel, activeYearBar = null, options = {}) => {
    const keys = new Set(paperKeys.filter(Boolean));
    if (!keys.size) return;

    workbench.dataset.activePublication = Array.from(keys).join(" ");
    resetYearPaperShares();

    entries.forEach((entry) => {
      const match = keys.has(entry.dataset.publicationKey);
      const listItem = entry.closest("li");
      entry.classList.toggle("publication-lens-linked", match);
      entry.classList.toggle("publication-lens-muted-by-link", !match);
      if (listItem) {
        listItem.classList.toggle("publication-lens-linked", match);
        listItem.classList.toggle("publication-lens-muted-by-link", !match);
      }
      const citationChip = entry.querySelector("[data-publication-citation-chip]");
      if (citationChip) citationChip.classList.toggle("publication-lens-citation-linked", match);
    });

    yearBars.forEach((bar) => {
      const contributions = parseContributions(bar);
      const match = activeYearBar
        ? bar === activeYearBar
        : contributions.some((contribution) => {
            const entry = entryByKey.get(contribution.key);
            return keys.has(contribution.key) && entry && paperMatches(entry);
          });
      bar.classList.toggle("scholar-lens-year-linked", match);
      bar.classList.toggle("scholar-lens-year-muted-by-link", !match);
    });

    if (options.paperEntry) {
      const activeCitations = applyPaperShares(options.paperEntry);
      if (activeYearLabel)
        activeYearLabel.textContent = `${paperTitle(options.paperEntry)}: ${activeCitations} visible ${citationWord(activeCitations)}`;
    } else if (activeYearLabel && sourceLabel) {
      activeYearLabel.textContent = sourceLabel;
    }
  };

  const clearLinkedPapers = () => {
    delete workbench.dataset.activePublication;
    if (activeYearLabel) activeYearLabel.textContent = "All papers";
    resetYearPaperShares();
    entries.forEach((entry) => {
      const listItem = entry.closest("li");
      entry.classList.remove("publication-lens-linked", "publication-lens-muted-by-link");
      if (listItem) listItem.classList.remove("publication-lens-linked", "publication-lens-muted-by-link");
      entry.querySelector("[data-publication-citation-chip]")?.classList.remove("publication-lens-citation-linked");
    });
    yearBars.forEach((bar) => bar.classList.remove("scholar-lens-year-linked", "scholar-lens-year-muted-by-link", "scholar-lens-year-active"));
  };

  const setActiveYear = (bar) => {
    const contributions = parseContributions(bar).filter((contribution) => {
      const entry = entryByKey.get(contribution.key);
      return entry && paperMatches(entry) && contribution.citations > 0;
    });
    if (!contributions.length) return;

    yearBars.forEach((candidate) => candidate.classList.toggle("scholar-lens-year-active", candidate === bar));
    setLinkedPapers(
      contributions.map((contribution) => contribution.key),
      `${bar.dataset.year}: ${bar.dataset.visibleTotal || bar.dataset.yearTotal} cites`,
      bar
    );
  };

  entries.forEach((entry) => {
    const paperKey = entry.dataset.publicationKey;
    entry.addEventListener("mouseenter", () => setLinkedPapers([paperKey], paperTitle(entry), null, { paperEntry: entry }));
    entry.addEventListener("mouseleave", clearLinkedPapers);
    entry.addEventListener("focusin", () => setLinkedPapers([paperKey], paperTitle(entry), null, { paperEntry: entry }));
    entry.addEventListener("focusout", (event) => {
      if (!entry.contains(event.relatedTarget)) clearLinkedPapers();
    });
  });

  yearBars.forEach((bar) => {
    bar.addEventListener("mouseenter", () => setActiveYear(bar));
    bar.addEventListener("mouseleave", clearLinkedPapers);
    bar.addEventListener("focus", () => setActiveYear(bar));
    bar.addEventListener("blur", clearLinkedPapers);
    bar.addEventListener("click", () => {
      const firstContribution = parseContributions(bar).find((contribution) => {
        const entry = entryByKey.get(contribution.key);
        return entry && paperMatches(entry) && contribution.citations > 0;
      });
      if (!firstContribution) return;
      const entry = document.querySelector(`.publication-lens-entry[data-publication-key="${cssEscape(firstContribution.key)}"]`);
      if (!entry) return;
      entry.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      const focusTarget = entry.querySelector("a, button, [tabindex]:not([tabindex='-1'])");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  });

  roleInputs.forEach((input) => input.addEventListener("change", updateFilters));
  typeInputs.forEach((input) => input.addEventListener("change", updateFilters));
  typeSelect?.addEventListener("change", updateFilters);

  const setupAdaptiveLens = () => {
    if (!rejectionWall) {
      workbench.classList.add("publication-workbench-paper-focus");
      return;
    }

    const desktopQuery = window.matchMedia("(min-width: 992px)");
    let scheduled = false;

    const updateLensWidth = () => {
      scheduled = false;
      const wallBottom = rejectionWall.getBoundingClientRect().bottom;
      const stickyOffset = Number.parseFloat(getComputedStyle(lens).top) || 80;
      const isPaperFocus = desktopQuery.matches && wallBottom <= stickyOffset + 12;
      workbench.classList.toggle("publication-workbench-paper-focus", isPaperFocus);
    };

    const scheduleLensWidthUpdate = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(updateLensWidth);
    };

    window.addEventListener("scroll", scheduleLensWidthUpdate, { passive: true });
    window.addEventListener("resize", scheduleLensWidthUpdate);
    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", scheduleLensWidthUpdate);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(scheduleLensWidthUpdate);
    }
    updateLensWidth();
  };

  updateFilters();
  setupAdaptiveLens();
})();
