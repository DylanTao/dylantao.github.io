(() => {
  const root = document.querySelector("[data-openai-build-week-story]");
  if (!root) return;

  const steps = Array.from(root.querySelectorAll("[data-build-week-step]"));
  const kicker = root.querySelector("[data-build-week-story-kicker]");
  const title = root.querySelector("[data-build-week-story-title]");
  const copy = root.querySelector("[data-build-week-story-copy]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
  let activeChapter = "";
  let demoCancelled = false;

  const activate = (chapter) => {
    const step = steps.find((candidate) => candidate.dataset.buildWeekStep === chapter);
    if (!step || chapter === activeChapter) return;

    activeChapter = chapter;
    root.dataset.activeChapter = chapter;
    steps.forEach((candidate) => {
      const isActive = candidate === step;
      candidate.classList.toggle("is-active", isActive);
      if (isActive) candidate.setAttribute("aria-current", "step");
      else candidate.removeAttribute("aria-current");
    });

    if (kicker) kicker.textContent = step.dataset.kicker || "Selected evidence";
    if (title) title.textContent = step.dataset.title || "Build Week evidence";
    if (copy) copy.textContent = step.dataset.copy || "";

    root.dispatchEvent(new CustomEvent("openai-build-week-chapter", { detail: { chapter } }));
  };

  root.classList.add("is-enhanced");
  root.dataset.state = "ready";
  window.openAIBuildWeekStory = { activate, steps: steps.map((step) => step.dataset.buildWeekStep) };

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    root.dataset.activeChapter = "all";
  } else {
    const visibleSteps = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleSteps.set(entry.target, entry.intersectionRatio);
          else visibleSteps.delete(entry.target);
        });

        const strongest = Array.from(visibleSteps.entries()).sort((first, second) => second[1] - first[1])[0]?.[0];
        if (strongest) activate(strongest.dataset.buildWeekStep);
      },
      { rootMargin: "-24% 0px -52% 0px", threshold: [0, 0.2, 0.45, 0.75] }
    );

    steps.forEach((step) => observer.observe(step));
    activate(steps[0]?.dataset.buildWeekStep || "boundary");
  }

  if (!demoMode) return;

  document.body.classList.add("openai-build-week-demo-mode");
  root.dataset.demoState = "preparing";

  const cancelDemo = (event) => {
    if (event.type === "keydown" && !["Escape", " ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    demoCancelled = true;
    root.dataset.demoState = "cancelled";
  };

  ["pointerdown", "wheel", "keydown"].forEach((eventName) =>
    window.addEventListener(eventName, cancelDemo, { once: true, passive: eventName !== "keydown" })
  );

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));
  const demoDurations = [16000, 21000, 23000, 24000, 23000, 23000];

  const runDemo = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await wait(1000);
    root.dataset.demoState = "playing";

    for (let index = 0; index < steps.length; index += 1) {
      if (demoCancelled) return;
      const step = steps[index];
      activate(step.dataset.buildWeekStep);
      step.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
      await wait(demoDurations[index] || 20000);
    }

    if (demoCancelled) return;
    document.querySelector("#build-week-design-memory")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
    await wait(5000);
    root.dataset.demoState = "complete";
    root.dispatchEvent(new CustomEvent("openai-build-week-demo-complete"));
  };

  runDemo();
})();
