// A small corner readout for real-device numbers, present only with ?perf=1 (2026-10-24): how long
// the 3D home took to its first view, recent frame times, the quality tier and what it is drawing,
// plus a button that copies the full summary (with the GPU's name, cores and pixel ratio) as JSON
// so it can be pasted into a message from a phone. `read()` returns the summary; the panel refreshes
// twice a second while connected. It sits in `host` (the full-screen stage, so it stays visible in
// full screen) over the top-left corner of `anchor` (the scene), outside the scene's vignette mask,
// and below the full-screen bar while that bar shows.

export function perfOverlayRequested(search = globalThis.location?.search || "") {
  return new URLSearchParams(search).get("perf") === "1";
}

const format = (value, digits = 0) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

export function summaryLines(summary) {
  const ready = Number.isFinite(summary.readyMs) ? `ready ${format(summary.readyMs / 1000, 1)} s` : `loading: ${summary.stage || "starting"}`;
  const gpu = Number.isFinite(summary.gpuMs) ? `GPU ${format(summary.gpuMs, 1)} ms · ` : "";
  return [
    `${ready} · ${summary.tier || "standard"} · frame p50 ${format(summary.frameP50)} p95 ${format(summary.frameP95)} ms`,
    `${gpu}${summary.buffer?.[0] ?? "–"}×${summary.buffer?.[1] ?? "–"} ×${format(summary.factor, 2)} · MSAA ${summary.samples ?? "–"} · shadow ${summary.shadowMap ?? "–"}`,
    `${summary.programs ?? "–"} programs · ${summary.draws ?? "–"} draws · ${summary.memoryMB ?? "–"} MB · ${summary.view || ""}`,
  ];
}

export function createPerfOverlay(host, read, { anchor = null, interval = 500 } = {}) {
  const panel = document.createElement("div");
  panel.className = "home-scene-perf";
  panel.setAttribute("aria-label", "3D performance readout");
  Object.assign(panel.style, {
    position: "absolute",
    top: "8px",
    left: "8px",
    zIndex: "6",
    maxWidth: "calc(100% - 16px)",
    padding: "4px 6px",
    borderRadius: "5px",
    background: "rgba(10, 16, 20, 0.6)",
    color: "#f4f1ea",
    font: "10px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
  });
  const text = document.createElement("span");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "copy";
  Object.assign(copy.style, {
    marginLeft: "6px",
    pointerEvents: "auto",
    font: "inherit",
    color: "inherit",
    background: "rgba(255, 255, 255, 0.14)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "3px",
    padding: "0 4px",
    cursor: "pointer",
  });
  panel.append(text, copy);
  host.append(panel);
  let last = null,
    frozen = false;
  const place = () => {
    let top = 10,
      left = 10;
    if (anchor?.offsetParent === host) {
      top += anchor.offsetTop;
      left += anchor.offsetLeft;
    }
    const bar = host.querySelector("[data-world-immersive-bar]");
    if (bar && !bar.hidden && bar.offsetParent === host) {
      top = Math.max(top, bar.offsetTop + bar.offsetHeight + 8);
      left = Math.max(left, bar.offsetLeft);
    }
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  };
  const refresh = () => {
    place();
    if (frozen) return;
    try {
      last = read();
      text.textContent = summaryLines(last).join("\n");
    } catch (error) {
      text.textContent = `perf readout unavailable: ${error.message}`;
    }
  };
  let reset = 0;
  copy.addEventListener("click", async () => {
    frozen = false;
    panel.style.userSelect = "";
    panel.style.pointerEvents = "none";
    refresh();
    const json = JSON.stringify({ ...last, at: new Date().toISOString(), page: location.href, userAgent: navigator.userAgent });
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = "copied";
    } catch {
      // Clipboard access can be refused; show the JSON, held still, so it can be selected by hand.
      frozen = true;
      text.textContent = json;
      panel.style.userSelect = "text";
      panel.style.pointerEvents = "auto";
      copy.textContent = "select the text";
    }
    clearTimeout(reset);
    reset = setTimeout(() => (copy.textContent = "copy"), 2500);
  });
  refresh();
  const timer = setInterval(() => {
    if (panel.isConnected) refresh();
  }, interval);
  return {
    element: panel,
    refresh,
    dispose() {
      clearInterval(timer);
      clearTimeout(reset);
      panel.remove();
    },
  };
}
