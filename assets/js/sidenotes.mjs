// Move the original footnotes into the margin. No duplicate prose or duplicate keyboard stops.
// Without JS, at narrow widths, and in print, Kramdown's references/endnotes remain ordinary links.
export function placeNotes(notes, gap = 20) {
  let bottom = -Infinity;
  return notes.map(({ anchor, height }) => {
    const top = Math.max(anchor, bottom + gap);
    bottom = top + height;
    return top;
  });
}

if (typeof document !== "undefined") {
  const content = document.querySelector("[data-sidenotes] #markdown-content");
  const footnotes = content?.querySelector(".footnotes");
  if (footnotes) {
    const wide = matchMedia("(min-width: 1440px)");
    const notes = [...footnotes.querySelectorAll(":scope > ol > li")];
    footnotes.setAttribute("aria-label", "Notes");
    let frame = 0;
    const layout = () => {
      frame = 0;
      content.classList.toggle("has-sidenotes", wide.matches);
      content.style.removeProperty("min-height");
      if (!wide.matches) return;
      const root = content.getBoundingClientRect();
      const refs = [...content.querySelectorAll("a.footnote")];
      const measurements = notes.map((note) => {
        const ref = refs.find((link) => decodeURIComponent(link.hash.slice(1)) === note.id);
        return { anchor: ref ? ref.getBoundingClientRect().top - root.top : 0, height: note.getBoundingClientRect().height };
      });
      const tops = placeNotes(measurements);
      notes.forEach((note, i) => note.style.setProperty("--note-top", `${Math.round(tops[i])}px`));
      content.style.minHeight = `${Math.ceil(Math.max(0, ...tops.map((top, i) => top + measurements[i].height)))}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    wide.addEventListener("change", schedule);
    addEventListener("resize", schedule, { passive: true });
    content.addEventListener("load", schedule, true);
    document.fonts?.ready.then(schedule);
    schedule();
  }
}
