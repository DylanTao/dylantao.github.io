// Keep the navbar search control visually stable across platforms.
document.addEventListener("readystatechange", () => {
  if (document.readyState === "interactive") {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const searchToggle = document.querySelector("#search-toggle");
    if (searchToggle) {
      const shortcut = isMac ? "Command K" : "Ctrl K";
      searchToggle.setAttribute("title", `Search (${shortcut})`);
      searchToggle.setAttribute("aria-label", `Search site (${shortcut})`);
    }
  }
});
