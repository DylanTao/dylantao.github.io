(function () {
  const formatSwitch = document.querySelector("[data-site-format-switch]");
  const humanFormatLink = formatSwitch?.querySelector('[data-site-format="human"]');
  const aiFormatLink = formatSwitch?.querySelector('[data-site-format="ai"]');

  const updateHumanHomeFormatTarget = (sectionOverride = "") => {
    if (!formatSwitch?.hasAttribute("data-home-format-context") || !aiFormatLink) return;
    const aiHome = formatSwitch.dataset.aiHome || aiFormatLink.getAttribute("href") || "/ai/";
    const humanAnchor = sectionOverride || window.location.hash.replace(/^#/, "");
    const aiTargets = {
      start: "",
      taste: "research",
      focus: "research",
      publications: "publications",
      updates: "routes",
      students: "routes",
      connect: "sources",
    };
    const aiTarget = aiTargets[humanAnchor];
    aiFormatLink.setAttribute("href", aiTarget ? `${aiHome}#${aiTarget}` : aiHome);
  };

  if (formatSwitch?.hasAttribute("data-home-format-context")) {
    updateHumanHomeFormatTarget();
    window.addEventListener("hashchange", () => updateHumanHomeFormatTarget());
    window.addEventListener("popstate", () => updateHumanHomeFormatTarget());
    window.addEventListener("home-active-section-change", (event) => updateHumanHomeFormatTarget(event.detail?.sectionId || ""));
  }

  const root = document.querySelector("[data-ai-view]");
  if (!root) return;

  const copyButton = root.querySelector("[data-ai-copy]");
  const copyLabel = root.querySelector("[data-ai-copy-label]");
  const status = root.querySelector("[data-ai-copy-status]");
  const aiNavigationLinks = Array.from(document.querySelectorAll("[data-ai-nav-link]"));
  const navbar = document.getElementById("navbar");
  const mobileNavigation = document.getElementById("navbarNav");
  const mobileNavigationToggle = document.querySelector('[aria-controls="navbarNav"]');
  const mobileNavigationQuery = window.matchMedia("(max-width: 767.98px)");
  const aiSections = Array.from(root.querySelectorAll(".ai-section[id]"));
  let snapFrame = 0;
  let visibleSectionFrame = 0;
  let locationTransitionGeneration = 0;
  let activeLocationTransition = 0;
  let pendingVisibleSectionSync = false;

  const updateFormatNavigation = (sectionOverride = "") => {
    let hashId = window.location.hash.slice(1);
    try {
      hashId = decodeURIComponent(hashId);
    } catch {
      hashId = "";
    }

    const anchor = hashId ? document.getElementById(hashId) : document.getElementById("identity");
    const isPaper = Boolean(anchor?.matches("[data-publication-key]"));
    const isKnownSection = aiSections.some((section) => section.id === hashId);
    const isKnownTarget = !hashId || isPaper || isKnownSection;
    const knownSection = isKnownSection ? hashId : "identity";
    const activeSection = sectionOverride || (isPaper ? "publications" : knownSection);

    if (humanFormatLink && formatSwitch) {
      const home = formatSwitch.dataset.humanHome || humanFormatLink.getAttribute("href") || "/";
      const humanTargets = {
        identity: home,
        research: formatSwitch.dataset.humanResearch || `${home}#focus`,
        publications: formatSwitch.dataset.humanPublications || home,
        routes: home,
        sources: home,
      };
      const publicationBase = formatSwitch.dataset.humanPublications || home;
      const preservePaperTarget = isPaper && activeSection === "publications";
      const humanTarget = preservePaperTarget ? `${publicationBase}${hashId}/` : humanTargets[activeSection] || home;
      humanFormatLink.setAttribute("href", humanTarget);
      if (isKnownTarget && (preservePaperTarget || ["identity", "research", "publications"].includes(activeSection))) {
        humanFormatLink.setAttribute("rel", "alternate");
      } else {
        humanFormatLink.removeAttribute("rel");
      }
    }

    if (aiFormatLink) {
      const aiAnchor = isPaper && activeSection === "publications" ? hashId : activeSection;
      aiFormatLink.setAttribute("href", `${window.location.pathname}#${aiAnchor}`);
    }

    aiNavigationLinks.forEach((link) => {
      const isCurrent = link.dataset.aiNavLink === activeSection;
      link.closest(".nav-item")?.classList.toggle("active", isCurrent);
      if (isCurrent) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateVisibleSection = () => {
    if (!aiSections.length) return;
    if (activeLocationTransition) {
      pendingVisibleSectionSync = true;
      return;
    }
    window.cancelAnimationFrame(visibleSectionFrame);
    const scheduledGeneration = locationTransitionGeneration;
    visibleSectionFrame = window.requestAnimationFrame(() => {
      visibleSectionFrame = 0;
      if (activeLocationTransition || scheduledGeneration !== locationTransitionGeneration) {
        pendingVisibleSectionSync = true;
        return;
      }
      const readingLine = (navbar?.getBoundingClientRect().bottom || 0) + Math.min(120, window.innerHeight * 0.2);
      const atDocumentEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const active = atDocumentEnd
        ? aiSections[aiSections.length - 1]
        : aiSections.reduce((current, section) => (section.getBoundingClientRect().top <= readingLine ? section : current), aiSections[0]);
      updateFormatNavigation(active.id);
    });
  };

  const getHashTarget = (hash = window.location.hash) => {
    let targetId = hash.replace(/^#/, "");
    try {
      targetId = decodeURIComponent(targetId);
    } catch {
      return null;
    }
    return targetId ? document.getElementById(targetId) : null;
  };

  const focusArrivalTarget = (target) => {
    if (!(target instanceof HTMLElement)) return;
    if (window.SiteMotion?.markAnchorArrival) {
      window.SiteMotion.markAnchorArrival(target, { focus: true });
      return;
    }

    const hadTabindex = target.hasAttribute("tabindex");
    if (!hadTabindex) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    if (document.activeElement !== target) mobileNavigationToggle?.focus({ preventScroll: true });
    if (!hadTabindex) {
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  };

  const snapTargetBelowNavbar = (target, { focus = false, onSettled = null } = {}) => {
    if (!(target instanceof HTMLElement)) {
      onSettled?.();
      return;
    }
    window.cancelAnimationFrame(snapFrame);
    snapFrame = window.requestAnimationFrame(() => {
      snapFrame = window.requestAnimationFrame(() => {
        const navbarBottom = navbar?.getBoundingClientRect().bottom || 0;
        const targetTop = target.getBoundingClientRect().top;
        const gap = 12;
        // Cancel page-level smooth scrolling so intermediate sections cannot overwrite the explicit hash state.
        window.scrollBy({ top: targetTop - navbarBottom - gap, behavior: "instant" });
        if (focus) focusArrivalTarget(target);
        snapFrame = window.requestAnimationFrame(() => {
          snapFrame = window.requestAnimationFrame(() => {
            snapFrame = 0;
            onSettled?.();
          });
        });
      });
    });
  };

  const beginLocationTransition = (target, { focus = false, beforeSnap = null } = {}) => {
    const generation = ++locationTransitionGeneration;
    activeLocationTransition = generation;
    pendingVisibleSectionSync = false;
    window.cancelAnimationFrame(visibleSectionFrame);
    visibleSectionFrame = 0;
    updateFormatNavigation();
    if (!(target instanceof HTMLElement)) {
      activeLocationTransition = 0;
      return;
    }

    const startSnap = () => {
      if (activeLocationTransition !== generation) return;
      snapTargetBelowNavbar(target, {
        focus,
        onSettled() {
          if (activeLocationTransition !== generation) return;
          activeLocationTransition = 0;
          pendingVisibleSectionSync = false;
          updateVisibleSection();
        },
      });
    };

    if (beforeSnap) {
      Promise.resolve(beforeSnap).then(startSnap);
    } else {
      startSnap();
    }
  };

  const closeMobileNavigation = () =>
    new Promise((resolve) => {
      if (!mobileNavigation || !mobileNavigationToggle) {
        resolve();
        return;
      }

      const expanded = Boolean(
        mobileNavigation &&
        mobileNavigationToggle &&
        (mobileNavigation.classList.contains("show") ||
          mobileNavigation.classList.contains("collapsing") ||
          mobileNavigationToggle.getAttribute("aria-expanded") === "true")
      );
      if (!expanded) {
        mobileNavigationToggle.classList.add("collapsed");
        mobileNavigationToggle.setAttribute("aria-expanded", "false");
        resolve();
        return;
      }

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        mobileNavigation.classList.remove("show", "collapsing");
        mobileNavigation.classList.add("collapse");
        mobileNavigationToggle.classList.add("collapsed");
        mobileNavigationToggle.setAttribute("aria-expanded", "false");
        resolve();
      };

      const jQuery = window.jQuery;
      if (jQuery?.fn?.collapse) {
        jQuery(mobileNavigation).one("hidden.bs.collapse", finish).collapse("hide");
        window.setTimeout(finish, 420);
      } else {
        finish();
      }
    });

  aiNavigationLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetUrl = new URL(link.href, window.location.href);
      const samePage = targetUrl.origin === window.location.origin && targetUrl.pathname === window.location.pathname;
      const target = samePage ? getHashTarget(targetUrl.hash) : null;
      if (!target) return;

      const expanded =
        mobileNavigation.classList.contains("show") ||
        mobileNavigation.classList.contains("collapsing") ||
        mobileNavigationToggle.getAttribute("aria-expanded") === "true";
      if (mobileNavigationQuery.matches && (!mobileNavigation || !mobileNavigationToggle || !expanded)) return;

      event.preventDefault();
      const nextLocation = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextLocation !== currentLocation) window.history.pushState(null, "", nextLocation);
      if (mobileNavigationQuery.matches) {
        beginLocationTransition(target, { focus: true, beforeSnap: closeMobileNavigation() });
      } else {
        beginLocationTransition(target, { focus: true });
      }
    });
  });

  const handleLocationChange = () => {
    beginLocationTransition(getHashTarget());
  };

  const initialHashTarget = getHashTarget();
  if (initialHashTarget) {
    beginLocationTransition(initialHashTarget);
  } else {
    updateFormatNavigation();
  }
  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("popstate", handleLocationChange);
  window.addEventListener("scroll", updateVisibleSection, { passive: true });
  window.addEventListener("resize", updateVisibleSection);

  if (!copyButton) return;

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    if (!copied) throw new Error("Clipboard fallback was rejected");
  };

  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    const source = copyButton.getAttribute("data-copy-source");
    if (!source) return;

    copyButton.disabled = true;
    copyButton.setAttribute("data-copy-state", "working");
    if (copyLabel) copyLabel.textContent = "Copy full Markdown";
    if (status) status.textContent = "Preparing the canonical Markdown profile.";

    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${source}`);

      await copyText(await response.text());
      copyButton.setAttribute("data-copy-state", "copied");
      if (copyLabel) copyLabel.textContent = "Copied Markdown";
      if (status) status.textContent = "Copied the full profile as Markdown.";
    } catch {
      copyButton.setAttribute("data-copy-state", "error");
      if (copyLabel) copyLabel.textContent = "Copy full Markdown";
      if (status) status.textContent = "Copy failed. Open the full profile link instead.";
    } finally {
      copyButton.disabled = false;
    }
  });
})();
