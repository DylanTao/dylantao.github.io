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
  const mobileSurface = constellation.querySelector("[data-constellation-mobile]");
  const mobileTrail = constellation.querySelector("[data-constellation-mobile-trail]");
  const mobileGraph = constellation.querySelector("[data-constellation-mobile-graph]");
  const mobileEdges = Array.from(constellation.querySelectorAll("[data-constellation-mobile-edge]"));
  const mobileRails = Array.from(constellation.querySelectorAll("[data-constellation-mobile-rail]"));
  const mobileMemberships = Array.from(constellation.querySelectorAll("[data-constellation-mobile-membership]"));
  const detail = constellation.querySelector("[data-constellation-detail]");
  const detailDock = constellation.querySelector("[data-constellation-detail-dock]");
  const detailEmpty = constellation.querySelector("[data-constellation-detail-empty]");
  const detailArticles = Array.from(constellation.querySelectorAll("[data-constellation-detail-paper]"));
  const clearButton = constellation.querySelector("[data-constellation-clear]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 820px)");

  let currentView = "list";
  let pinnedKey = null;
  let lastPinnedControl = null;
  let mobileGeometryFrame = 0;
  let visiblePaperKeys = new Set(paperButtons.map((button) => button.dataset.publicationKey));

  const centerWithin = (element, rootRect) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left - rootRect.left + rect.width / 2,
      y: rect.top - rootRect.top + rect.height / 2,
    };
  };

  const mobileNode = (id) =>
    Array.from(constellation.querySelectorAll("[data-constellation-mobile-node-id]")).find((node) => node.dataset.constellationMobileNodeId === id);

  const mobileNodeAnchor = (id, rootRect) => centerWithin(mobileNode(id)?.querySelector("[data-constellation-mobile-anchor]"), rootRect);

  const mobileThreadStart = (id, rootRect) => {
    const label = Array.from(constellation.querySelectorAll("[data-constellation-mobile-rail-start]")).find(
      (candidate) => candidate.dataset.constellationMobileRailStart === id
    );
    return centerWithin(label?.querySelector("i"), rootRect);
  };

  const mobileThreadOrigin = (id, rootRect) => {
    const origin = Array.from(constellation.querySelectorAll("[data-constellation-mobile-thread-origin]")).find(
      (candidate) => candidate.dataset.constellationMobileThreadOrigin === id
    );
    return centerWithin(origin, rootRect);
  };

  const mobileEndpoint = (kind, id, rootRect) => {
    if (kind === "thread") return mobileThreadStart(id, rootRect);
    return mobileNodeAnchor(id, rootRect);
  };

  const mobileCurve = (source, target) => {
    const controlY = source.y + (target.y - source.y) / 2;
    return `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} C ${source.x.toFixed(2)} ${controlY.toFixed(2)}, ${target.x.toFixed(
      2
    )} ${controlY.toFixed(2)}, ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
  };

  const updateMobileGeometry = () => {
    mobileGeometryFrame = 0;
    if (!mobileQuery.matches || currentView !== "constellation" || !mobileTrail || !mobileGraph) return;
    const rootRect = mobileTrail.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0) return;

    mobileGraph.setAttribute("viewBox", `0 0 ${rootRect.width.toFixed(2)} ${rootRect.height.toFixed(2)}`);
    mobileGraph.setAttribute("width", rootRect.width.toFixed(2));
    mobileGraph.setAttribute("height", rootRect.height.toFixed(2));

    const lastRow = constellation.querySelector("[data-constellation-mobile-paper-row]:last-child");
    const lastRowRect = lastRow?.getBoundingClientRect();
    const railEndY = lastRowRect ? lastRowRect.bottom - rootRect.top - 10 : rootRect.height - 10;
    mobileRails.forEach((rail) => {
      const thread = rail.dataset.constellationMobileRail;
      const start = mobileThreadStart(thread, rootRect);
      const origin = mobileThreadOrigin(thread, rootRect);
      if (!start || !origin) {
        rail.setAttribute("d", "");
        return;
      }
      const controlY = start.y + (origin.y - start.y) * 0.62;
      rail.setAttribute(
        "d",
        `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${start.x.toFixed(2)} ${controlY.toFixed(2)}, ${origin.x.toFixed(
          2
        )} ${controlY.toFixed(2)}, ${origin.x.toFixed(2)} ${origin.y.toFixed(2)} L ${origin.x.toFixed(2)} ${railEndY.toFixed(2)}`
      );
    });

    mobileEdges.forEach((edge) => {
      const source = mobileEndpoint(edge.dataset.edgeSourceKind, edge.dataset.edgeSource, rootRect);
      const target = mobileEndpoint(edge.dataset.edgeTargetKind, edge.dataset.edgeTarget, rootRect);
      edge.setAttribute("d", source && target ? mobileCurve(source, target) : "");
    });

    mobileMemberships.forEach((membership) => {
      const source = mobileNodeAnchor(membership.dataset.membershipPaper, rootRect);
      const threadOrigin = mobileThreadOrigin(membership.dataset.membershipThread, rootRect);
      if (!source || !threadOrigin) {
        membership.setAttribute("d", "");
        return;
      }
      const target = { x: threadOrigin.x, y: source.y };
      const controlX = source.x + (target.x - source.x) / 2;
      membership.setAttribute(
        "d",
        `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} C ${controlX.toFixed(2)} ${source.y.toFixed(2)}, ${controlX.toFixed(
          2
        )} ${target.y.toFixed(2)}, ${target.x.toFixed(2)} ${target.y.toFixed(2)}`
      );
    });
  };

  const scheduleMobileGeometry = () => {
    if (mobileGeometryFrame) window.cancelAnimationFrame(mobileGeometryFrame);
    mobileGeometryFrame = window.requestAnimationFrame(updateMobileGeometry);
  };

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
    mobileMemberships.forEach((membership) => {
      const paperKey = membership.dataset.membershipPaper;
      const isActive = active.has(paperKey) || related.has(paperKey);
      membership.classList.toggle("paper-constellation-mobile-membership-active", isActive);
      membership.classList.toggle("paper-constellation-mobile-membership-muted", hasFocus && !isActive);
    });
  };

  const restoreDetailDock = () => {
    if (!detail || !detailDock || detail.parentElement === detailDock) return;
    detailDock.append(detail);
    scheduleMobileGeometry();
  };

  const placeMobileDetail = (key) => {
    if (!detail || !detailDock) return;
    if (!mobileQuery.matches || !key) {
      restoreDetailDock();
      return;
    }
    const slot = Array.from(constellation.querySelectorAll("[data-constellation-detail-slot]")).find(
      (candidate) => candidate.dataset.constellationDetailSlot === key
    );
    if (!slot || detail.parentElement === slot) return;
    slot.append(detail);
    scheduleMobileGeometry();
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
    const previousKey = pinnedKey;
    let focusTarget = lastPinnedControl;
    if (restoreFocus && previousKey) {
      const preferredSurface = mobileQuery.matches ? mobileSurface : constellation.querySelector("[data-constellation-desktop]");
      focusTarget = Array.from(preferredSurface?.querySelectorAll("[data-constellation-paper]") || []).find(
        (button) => button.dataset.publicationKey === previousKey
      );
    }
    pinnedKey = null;
    lastPinnedControl = null;
    hideDetail();
    restoreDetailDock();
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
    placeMobileDetail(key);
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
    mobileMemberships.forEach((membership) => {
      membership.classList.toggle("paper-constellation-mobile-membership-filtered", !visiblePaperKeys.has(membership.dataset.membershipPaper));
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
      scheduleMobileGeometry();
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

  const handleMobileBreakpoint = () => {
    if (pinnedKey) {
      placeMobileDetail(pinnedKey);
    } else {
      restoreDetailDock();
    }
    scheduleMobileGeometry();
  };

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", handleMobileBreakpoint);
  } else {
    mobileQuery.addListener(handleMobileBreakpoint);
  }
  window.addEventListener("resize", scheduleMobileGeometry, { passive: true });
  window.addEventListener("load", scheduleMobileGeometry, { once: true });

  if ("ResizeObserver" in window && mobileTrail) {
    const mobileGeometryObserver = new ResizeObserver(scheduleMobileGeometry);
    mobileGeometryObserver.observe(mobileTrail);
    constellation.querySelectorAll("[data-constellation-mobile-paper-row], .paper-constellation-mobile-future-field").forEach((node) => {
      mobileGeometryObserver.observe(node);
    });
  }
  document.fonts?.ready.then(scheduleMobileGeometry);

  switcher.hidden = false;
  applyFilter(currentFilterKeys());
  scheduleMobileGeometry();
})();
