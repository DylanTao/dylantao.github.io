(function () {
  const root = document.querySelector("[data-ai-view]");
  if (!root) return;

  const copyButton = root.querySelector("[data-ai-copy]");
  const copyLabel = root.querySelector("[data-ai-copy-label]");
  const status = root.querySelector("[data-ai-copy-status]");
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
