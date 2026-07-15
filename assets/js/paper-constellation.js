(function () {
  const constellation = document.querySelector("[data-paper-constellation]");
  const workbench = document.querySelector("[data-publication-workbench]");
  const switcher = document.querySelector("[data-publication-view-switcher]");
  if (!constellation || !workbench || !switcher) return;

  const viewButtons = Array.from(switcher.querySelectorAll("[data-publication-view-button]"));
  const viewPanels = Array.from(workbench.querySelectorAll("[data-publication-view-panel]"));
  const viewStatus = switcher.querySelector("[data-publication-view-status]");
  const paperButtons = Array.from(constellation.querySelectorAll("[data-constellation-paper]"));
  const graphNodes = Array.from(constellation.querySelectorAll("[data-constellation-node-id]"));
  const graphEdges = Array.from(constellation.querySelectorAll("[data-constellation-edge]"));
  const detail = constellation.querySelector("[data-constellation-detail]");
  const detailEmpty = constellation.querySelector("[data-constellation-detail-empty]");
  const detailArticles = Array.from(constellation.querySelectorAll("[data-constellation-detail-paper]"));
  const clearButton = constellation.querySelector("[data-constellation-clear]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let currentView = "list";
  let pinnedKey = null;
  let lastPinnedControl = null;
  let visiblePaperKeys = new Set(paperButtons.map((button) => button.dataset.publicationKey));

  const paperLabel = (key) => {
    const button = paperButtons.find((candidate) => candidate.dataset.publicationKey === key);
    return button?.querySelector("strong")?.textContent?.replace(/\s+/g, " ").trim() || key;
  };

  const broadcastFocus = (paperKeys, label) => {
    document.dispatchEvent(
      new CustomEvent("publication:focus", {
        detail: { paperKeys, label, source: "paper-constellation" },
      })
    );
  };

  const broadcastClear = () => {
    document.dispatchEvent(new CustomEvent("publication:clear", { detail: { source: "paper-constellation" } }));
  };

  const connectedState = (paperKeys) => {
    const active = new Set(paperKeys);
    const related = new Set();
    const activeEdges = new Set();

    graphEdges.forEach((edge) => {
      const source = edge.dataset.edgeSource;
      const target = edge.dataset.edgeTarget;
      if (!active.has(source) && !active.has(target)) return;
      activeEdges.add(edge);
      if (!active.has(source)) related.add(source);
      if (!active.has(target)) related.add(target);
    });

    return { active, related, activeEdges };
  };

  const updateGraphFocus = (paperKeys = []) => {
    const keys = paperKeys.filter((key) => visiblePaperKeys.has(key));
    const hasFocus = keys.length > 0;
    const { active, related, activeEdges } = connectedState(keys);

    constellation.classList.toggle("paper-constellation-has-focus", hasFocus);
    graphNodes.forEach((node) => {
      const nodeId = node.dataset.constellationNodeId;
      const isActive = active.has(nodeId);
      const isRelated = related.has(nodeId);
      node.classList.toggle("paper-constellation-node-active", isActive);
      node.classList.toggle("paper-constellation-node-related", isRelated);
      node.classList.toggle("paper-constellation-node-muted", hasFocus && !isActive && !isRelated);
    });
    graphEdges.forEach((edge) => {
      const isActive = activeEdges.has(edge);
      edge.classList.toggle("paper-constellation-edge-active", isActive);
      edge.classList.toggle("paper-constellation-edge-muted", hasFocus && !isActive);
    });
  };

  const showDetail = (key) => {
    if (!detail) return;
    if (detailEmpty) detailEmpty.hidden = true;
    detailArticles.forEach((article) => {
      article.hidden = article.dataset.constellationDetailPaper !== key;
    });
    if (clearButton) clearButton.hidden = false;
    detail.classList.add("paper-constellation-detail-active");
    paperButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.publicationKey === key ? "true" : "false"));
  };

  const hideDetail = () => {
    if (!detail) return;
    if (detailEmpty) detailEmpty.hidden = false;
    detailArticles.forEach((article) => {
      article.hidden = true;
    });
    if (clearButton) clearButton.hidden = true;
    detail.classList.remove("paper-constellation-detail-active");
    paperButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  };

  const clearPinned = ({ broadcast = true, restoreFocus = false } = {}) => {
    const focusTarget = lastPinnedControl;
    pinnedKey = null;
    lastPinnedControl = null;
    hideDetail();
    updateGraphFocus();
    if (broadcast) broadcastClear();
    if (restoreFocus && focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
  };

  const pinPaper = (key, control) => {
    if (pinnedKey === key) {
      clearPinned({ restoreFocus: true });
      return;
    }
    pinnedKey = key;
    lastPinnedControl = control;
    updateGraphFocus([key]);
    showDetail(key);
    broadcastFocus([key], paperLabel(key));
  };

  const previewPaper = (key) => {
    if (pinnedKey) return;
    updateGraphFocus([key]);
    broadcastFocus([key], paperLabel(key));
  };

  const clearPreview = () => {
    if (pinnedKey) return;
    updateGraphFocus();
    broadcastClear();
  };

  const applyFilter = (keys) => {
    visiblePaperKeys = new Set(keys);
    graphNodes.forEach((node) => {
      const paperButton = node.querySelector("[data-constellation-paper]");
      const paperKey = paperButton?.dataset.publicationKey;
      const filtered = Boolean(paperKey && !visiblePaperKeys.has(paperKey));
      node.classList.toggle("paper-constellation-node-filtered", filtered);
      if (paperButton) {
        paperButton.disabled = filtered;
        paperButton.tabIndex = filtered ? -1 : 0;
        node.setAttribute("aria-hidden", filtered ? "true" : "false");
      }
    });
    graphEdges.forEach((edge) => {
      const sourceIsHidden = edge.dataset.edgeSourceKind === "paper" && !visiblePaperKeys.has(edge.dataset.edgeSource);
      const targetIsHidden = edge.dataset.edgeTargetKind === "paper" && !visiblePaperKeys.has(edge.dataset.edgeTarget);
      edge.classList.toggle("paper-constellation-edge-filtered", sourceIsHidden || targetIsHidden);
    });
    if (pinnedKey && !visiblePaperKeys.has(pinnedKey)) clearPinned();
  };

  const currentFilterKeys = () => {
    const role = document.querySelector('input[name="publication-role-filter"]:checked')?.value || "all";
    const type = document.querySelector('input[name="publication-type-filter"]:checked')?.value || "all";
    return paperButtons
      .filter((button) => {
        const roleMatches = role === "all" || button.dataset.publicationRole === role;
        const typeMatches = type === "all" || button.dataset.publicationGroup === type;
        return roleMatches && typeMatches;
      })
      .map((button) => button.dataset.publicationKey);
  };

  const setView = (view) => {
    if (!viewPanels.some((panel) => panel.dataset.publicationViewPanel === view)) return;
    currentView = view;
    workbench.dataset.publicationView = view;
    viewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.publicationViewPanel !== view;
    });
    viewButtons.forEach((button) => {
      const active = button.dataset.publicationViewButton === view;
      button.classList.toggle("publication-view-button-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (viewStatus) viewStatus.textContent = view === "list" ? "Paper List shown." : "Paper Constellation shown.";

    if (view === "constellation") {
      applyFilter(currentFilterKeys());
      constellation.classList.remove("paper-constellation-entered");
      if (reduceMotionQuery.matches) {
        constellation.classList.add("paper-constellation-entered");
      } else {
        window.requestAnimationFrame(() => constellation.classList.add("paper-constellation-entered"));
      }
    } else {
      clearPinned();
    }
  };

  paperButtons.forEach((button) => {
    const key = button.dataset.publicationKey;
    button.addEventListener("mouseenter", () => previewPaper(key));
    button.addEventListener("mouseleave", clearPreview);
    button.addEventListener("focus", () => previewPaper(key));
    button.addEventListener("blur", clearPreview);
    button.addEventListener("click", () => pinPaper(key, button));
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.publicationViewButton));
  });

  clearButton?.addEventListener("click", () => clearPinned({ restoreFocus: true }));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || currentView !== "constellation" || !pinnedKey) return;
    event.preventDefault();
    clearPinned({ restoreFocus: true });
  });

  document.addEventListener("publication:focus", (event) => {
    if (event.detail?.source === "paper-constellation" || pinnedKey) return;
    updateGraphFocus(event.detail?.paperKeys || []);
  });

  document.addEventListener("publication:clear", (event) => {
    if (event.detail?.source === "paper-constellation" || pinnedKey) return;
    updateGraphFocus();
  });

  document.addEventListener("publication:filter", (event) => {
    applyFilter(event.detail?.visiblePaperKeys || []);
  });

  switcher.hidden = false;
  applyFilter(currentFilterKeys());
})();
