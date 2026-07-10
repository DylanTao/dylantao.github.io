(() => {
  const inlineToc = document.querySelector("details.blog-inline-toc");
  if (!inlineToc) return;

  const mobileQuery = window.matchMedia("(max-width: 576px)");
  const syncInlineToc = (event) => {
    inlineToc.open = !event.matches;
  };

  syncInlineToc(mobileQuery);
  mobileQuery.addEventListener?.("change", syncInlineToc);
})();
