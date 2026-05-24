(function () {
  const previews = Array.from(document.querySelectorAll("[data-heuristics-preview]"));
  if (previews.length === 0) return;

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
    document.execCommand("copy");
    textarea.remove();
  };

  previews.forEach(async (preview) => {
    const source = preview.getAttribute("data-heuristics-src");
    const content = preview.querySelector("[data-heuristics-content]");
    const copyButton = preview.querySelector("[data-heuristics-copy]");
    const status = preview.querySelector("[data-heuristics-status]");

    if (!source || !content) return;

    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${source}`);

      const text = await response.text();
      content.textContent = text;

      if (copyButton) {
        copyButton.disabled = false;
        copyButton.addEventListener("click", async () => {
          try {
            await copyText(text);
            if (status) status.textContent = "Copied heuristics to clipboard.";
          } catch {
            if (status) status.textContent = "Copy failed; use the source link or download button.";
          }
        });
      }
    } catch {
      content.textContent = "Could not load the heuristics preview. Use the source link or download button instead.";
      if (status) status.textContent = "Preview unavailable.";
    }
  });
})();
