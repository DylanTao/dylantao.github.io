(() => {
  const MIN_SECTION_COUNT = 2;
  const SKIPPED_HEADINGS = new Set(["bibtex", "references"]);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const normalizeText = (text) => text.trim().replace(/\s+/g, " ");

  const slugify = (text) =>
    normalizeText(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const ensureHeadingId = (heading, usedIds) => {
    if (heading.id) {
      usedIds.add(heading.id);
      return heading.id;
    }

    const base = slugify(heading.textContent) || "section";
    let id = base;
    let count = 2;

    while (usedIds.has(id)) {
      id = `${base}-${count}`;
      count += 1;
    }

    heading.id = id;
    usedIds.add(id);
    return id;
  };

  const createLink = (section) => {
    const link = document.createElement("a");
    link.className = "section-reading-aid-link";
    link.href = `#${section.id}`;
    link.dataset.sectionId = section.id;

    const text = document.createElement("span");
    text.className = "section-reading-aid-link-text";
    text.textContent = section.title;
    link.appendChild(text);

    return link;
  };

  const createDesktopNav = (sections) => {
    const nav = document.createElement("nav");
    nav.className = "section-reading-aid section-reading-aid-desktop";
    nav.setAttribute("aria-label", "On this page");

    const label = document.createElement("span");
    label.className = "section-reading-aid-kicker";
    label.textContent = "On this page";
    nav.appendChild(label);

    const list = document.createElement("ol");
    list.className = "section-reading-aid-list";

    sections.forEach((section) => {
      const item = document.createElement("li");
      item.appendChild(createLink(section));
      list.appendChild(item);
    });

    nav.appendChild(list);
    return nav;
  };

  const createMobileNav = (sections) => {
    const details = document.createElement("details");
    details.className = "section-reading-aid section-reading-aid-mobile";

    const summary = document.createElement("summary");
    const label = document.createElement("span");
    label.className = "section-reading-aid-mobile-label";
    label.textContent = "On this page";

    const current = document.createElement("strong");
    current.className = "section-reading-aid-current";
    current.dataset.readingAidCurrent = "";
    current.textContent = sections[0].title;

    summary.append(label, current);
    details.appendChild(summary);

    const list = document.createElement("ol");
    list.className = "section-reading-aid-list";

    sections.forEach((section) => {
      const item = document.createElement("li");
      item.appendChild(createLink(section));
      list.appendChild(item);
    });

    details.appendChild(list);
    return details;
  };

  const getContentRoot = (pageRoot) => {
    if (pageRoot.classList.contains("blog-post")) {
      return pageRoot.querySelector("#markdown-content");
    }

    return pageRoot.querySelector("article");
  };

  const getReadableHeadings = (contentRoot) =>
    Array.from(contentRoot.children).filter((element) => {
      if (!element.matches("h2")) return false;

      const title = normalizeText(element.textContent);
      return title && !SKIPPED_HEADINGS.has(title.toLowerCase());
    });

  const uniqueElements = (elements) => [...new Set(elements.filter(Boolean))];

  const scrollToHeading = (heading) => {
    heading.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const initReadingAid = (pageRoot) => {
    if (pageRoot.dataset.readingAidInitialized === "true") return;

    const contentRoot = getContentRoot(pageRoot);
    if (!contentRoot) return;

    const headings = getReadableHeadings(contentRoot);
    if (headings.length < MIN_SECTION_COUNT) return;

    pageRoot.dataset.readingAidInitialized = "true";
    pageRoot.classList.add("section-reading-aid-page");

    const usedIds = new Set(Array.from(document.querySelectorAll("[id]")).map((element) => element.id));
    const sections = headings.map((heading) => {
      const title = normalizeText(heading.textContent);
      const id = ensureHeadingId(heading, usedIds);
      heading.classList.add("section-reading-aid-target");

      return { heading, id, title };
    });

    const desktopNav = createDesktopNav(sections);
    const mobileNav = createMobileNav(sections);
    const currentLabel = mobileNav.querySelector("[data-reading-aid-current]");
    const links = [...desktopNav.querySelectorAll("a"), ...mobileNav.querySelectorAll("a")];

    pageRoot.appendChild(desktopNav);
    contentRoot.insertBefore(mobileNav, sections[0].heading);

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();

        const section = sections.find((item) => item.id === link.dataset.sectionId);
        if (!section) return;

        if (mobileNav.contains(link)) mobileNav.open = false;
        setActiveSection(section);
        scrollToHeading(section.heading);

        if (history.pushState) {
          history.pushState(null, "", `#${section.id}`);
        }
      });
    });

    let railAvoidanceBlocks = [];

    const refreshRailAvoidanceBlocks = () => {
      const proseWidth = Math.max(...sections.map((section) => section.heading.getBoundingClientRect().width), 0);
      const children = Array.from(contentRoot.children);
      const firstHeadingIndex = children.indexOf(sections[0].heading);
      const topContent = firstHeadingIndex > 0 ? children.slice(0, firstHeadingIndex) : [];
      const header = pageRoot.querySelector(":scope > .post-header");
      const projectHero = contentRoot.querySelector(":scope > .project-case-hero");

      const measuredBlocks = children.filter((element) => {
        if (element === mobileNav || element.classList.contains("section-reading-aid")) return false;

        const rect = element.getBoundingClientRect();
        return rect.width > proseWidth + 48;
      });

      railAvoidanceBlocks = uniqueElements([header, projectHero, ...topContent, ...measuredBlocks]);
    };

    const setActiveSection = (activeSection) => {
      currentLabel.textContent = activeSection.title;

      links.forEach((link) => {
        const isActive = link.dataset.sectionId === activeSection.id;
        link.classList.toggle("is-active", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    const updateDesktopRailClearance = () => {
      const navRect = desktopNav.getBoundingClientRect();
      if (!navRect.width || !navRect.height) return false;

      let availableHeight = window.innerHeight - navRect.top - 32;

      const isCovered = railAvoidanceBlocks.some((block) => {
        const rect = block.getBoundingClientRect();
        const overlapsRailColumn = rect.left < navRect.right && rect.right > navRect.left;
        if (!overlapsRailColumn || rect.bottom <= navRect.top + 8) return false;

        if (rect.top <= navRect.top + 10) return true;

        availableHeight = Math.min(availableHeight, rect.top - navRect.top - 12);
        return false;
      });

      desktopNav.style.setProperty("--section-reading-aid-visible-height", `${Math.max(0, availableHeight)}px`);
      return isCovered || availableHeight < 72;
    };

    const updateReadingAid = () => {
      const threshold = Math.min(window.innerHeight * 0.34, 240);
      let activeSection = sections[0];

      sections.forEach((section) => {
        if (section.heading.getBoundingClientRect().top <= threshold) {
          activeSection = section;
        }
      });

      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) {
        const visibleSections = sections.filter((section) => section.heading.getBoundingClientRect().top < window.innerHeight * 0.9);
        if (visibleSections.length) {
          activeSection = visibleSections[visibleSections.length - 1];
        }
      }

      setActiveSection(activeSection);

      const firstHeadingTop = sections[0].heading.getBoundingClientRect().top;
      const contentBottom = contentRoot.getBoundingClientRect().bottom;
      const bodyEntryThreshold = Math.min(window.innerHeight * 0.28, 260);
      const inReadableZone = firstHeadingTop <= bodyEntryThreshold && contentBottom > window.innerHeight * 0.22;
      const isObscured = inReadableZone && updateDesktopRailClearance();

      desktopNav.classList.toggle("is-readable", inReadableZone);
      desktopNav.classList.toggle("is-obscured", isObscured);
    };

    let ticking = false;
    const requestUpdate = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        updateReadingAid();
        ticking = false;
      });
    };

    refreshRailAvoidanceBlocks();
    updateReadingAid();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", () => {
      refreshRailAvoidanceBlocks();
      requestUpdate();
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".post.blog-post, .post.project-detail").forEach(initReadingAid);
  });
})();
