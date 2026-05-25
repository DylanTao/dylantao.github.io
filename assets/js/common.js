$(document).ready(function () {
  // add toggle functionality to abstract, award and bibtex buttons
  const togglePublicationPanel = ($button, panelClass) => {
    const $entry = $button.closest(".links").parent();
    const panelClasses = ["abstract", "award", "bibtex"];
    const $targetPanels = $entry.find(`.${panelClass}.hidden`);
    const shouldOpen = !$targetPanels.first().hasClass("open");

    panelClasses.forEach((currentClass) => {
      const isOpen = currentClass === panelClass && shouldOpen;
      $entry.find(`.${currentClass}.hidden`).toggleClass("open", isOpen).attr("aria-hidden", String(!isOpen));
      $entry.find(`a.${currentClass}[aria-expanded]`).attr("aria-expanded", String(isOpen));
    });
  };

  $("a.abstract, a.award, a.bibtex").click(function (event) {
    event.preventDefault();

    const panelClass = ["abstract", "award", "bibtex"].find((currentClass) => this.classList.contains(currentClass));
    if (!panelClass) return;

    togglePublicationPanel($(this), panelClass);
  });
  $("a").removeClass("waves-effect waves-light");

  // bootstrap-toc
  if ($("#toc-sidebar").length) {
    // remove related publications years from the TOC
    $(".publications h2").each(function () {
      $(this).attr("data-toc-skip", "");
    });
    var navSelector = "#toc-sidebar";
    var $myNav = $(navSelector);
    Toc.init($myNav);
    $("body").scrollspy({
      target: navSelector,
      offset: 100,
    });
  }

  // add css to jupyter notebooks
  const cssLink = document.createElement("link");
  cssLink.href = "../css/jupyter.css";
  cssLink.rel = "stylesheet";
  cssLink.type = "text/css";

  let jupyterTheme = determineComputedTheme();

  $(".jupyter-notebook-iframe-container iframe").each(function () {
    $(this).contents().find("head").append(cssLink);

    if (jupyterTheme == "dark") {
      $(this).bind("load", function () {
        $(this).contents().find("body").attr({
          "data-jp-theme-light": "false",
          "data-jp-theme-name": "JupyterLab Dark",
        });
      });
    }
  });

  // trigger popovers
  $('[data-toggle="popover"]').popover({
    trigger: "hover",
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = Array.from(
    document.querySelectorAll(
      ".featured-posts, .post-list > li, .publications ol.bibliography > li, .projects .grid-item, .card, .news table tr, .cv .card"
    )
  ).filter((item) => !item.closest(".home-page"));

  if (revealItems.length) {
    revealItems.forEach((item) => item.classList.add("site-reveal"));
  }

  const isAlreadyReadable = (item) => {
    const rect = item.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
  };

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("site-visible"));
  } else {
    revealItems.forEach((item) => {
      if (isAlreadyReadable(item)) item.classList.add("site-visible");
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("site-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  if (revealItems.length) {
    document.documentElement.classList.add("site-motion-ready");
  }
});
