// Small progressive enhancements, authored for this Jekyll site. Interaction
// references: Aceternity Lens/Link Preview/Compare and React Bits Folder/Chroma.
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const asset = (path) => new URL("../" + path, import.meta.url).href;

if (location.pathname.includes("/projects/designweaver/")) {
  document.querySelectorAll("article img").forEach((img) => {
    if (!/tool_design_all_features|user_study_workflow/.test(img.src)) return;
    const frame = img.closest("figure") || img.parentElement;
    frame.classList.add("research-lens");
    const lens = document.createElement("span");
    lens.className = "research-lens__glass";
    lens.ariaHidden = "true";
    frame.append(lens);
    const link = document.createElement("a");
    link.href = img.src;
    // The original source carries more detail than the responsive thumbnail.
    if (img.dataset.src) link.href = img.dataset.src;
    link.textContent = "Open full image ↗";
    link.className = "research-lens__open";
    frame.after(link);
    frame.addEventListener("pointermove", (event) => {
      if (!fine.matches || reduced.matches || event.pointerType === "touch") return;
      const r = img.getBoundingClientRect(),
        f = frame.getBoundingClientRect();
      const x = event.clientX - r.left,
        y = event.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        lens.hidden = true;
        return;
      }
      lens.hidden = false;
      Object.assign(lens.style, {
        display: "block",
        left: `${event.clientX - f.left - 85}px`,
        top: `${event.clientY - f.top - 85}px`,
        backgroundImage: `url("${link.href}")`,
        backgroundSize: `${r.width * 2}px ${r.height * 2}px`,
        backgroundPosition: `${85 - x * 2}px ${85 - y * 2}px`,
      });
    });
    frame.addEventListener("pointerleave", () => (lens.style.display = "none"));
  });
}

const previews = {
  designweaver: ["DesignWeaver", "img/publication_preview/designweaver.png"],
  "la-jolla": ["A little La Jolla", "models/la-jolla/miniature.webp"],
  p: ["P · Prototype / ProtoLab", "models/pip/poster.webp"],
};
let timer, current;
const preview = document.createElement("div");
preview.className = "project-link-preview";
preview.hidden = true;
preview.role = "tooltip";
preview.id = "project-link-preview";
preview.innerHTML = '<img alt=""><span></span>';
document.body.append(preview);
function hide() {
  clearTimeout(timer);
  preview.hidden = true;
  current?.removeAttribute("aria-describedby");
  current = null;
}
function place(link) {
  const r = link.getBoundingClientRect();
  preview.style.left = `${Math.max(12, Math.min(innerWidth - 248, r.left + r.width / 2 - 118))}px`;
  preview.style.top = `${r.top > 175 ? r.top - 168 : r.bottom + 12}px`;
}
document.querySelectorAll(".home-page p a, .home-motion-detail-link, .blog-post p a, .project-detail p a").forEach((link) => {
  const slug = new URL(link.href).pathname.match(/\/projects\/([^/]+)\/?$/)?.[1],
    data = previews[slug];
  if (!data || link.querySelector("img")) return;
  function show() {
    hide();
    current = link;
    timer = setTimeout(() => {
      preview.querySelector("img").src = asset(data[1]);
      preview.querySelector("span").textContent = data[0];
      preview.hidden = false;
      place(link);
      link.setAttribute("aria-describedby", preview.id);
    }, 200);
  }
  link.addEventListener("pointerenter", () => {
    if (fine.matches) show();
  });
  link.addEventListener("pointerleave", () => {
    if (document.activeElement !== link) hide();
  });
  link.addEventListener("focus", show);
  link.addEventListener("blur", hide);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hide();
});
window.addEventListener(
  "scroll",
  () => {
    // Keyboard focus can cause a native scroll. Keep its preview attached to
    // the focused link instead of cancelling the pending focus disclosure.
    if (current && document.activeElement === current) {
      if (!preview.hidden) place(current);
    } else hide();
  },
  { passive: true }
);

document.querySelectorAll("[data-compare]").forEach((figure) => {
  const range = figure.querySelector('input[type="range"]');
  const update = () => {
    figure.style.setProperty("--compare", `${range.value}%`);
    range.setAttribute("aria-valuetext", `${range.value}% after`);
  };
  range.addEventListener("input", update);
  update();
});
document.querySelectorAll("[data-site-experiment-grid]").forEach((grid) => grid.classList.add("chroma-ready"));
