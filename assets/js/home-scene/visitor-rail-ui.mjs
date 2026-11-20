export function bindVisitorRailUi(ui, listen, actions) {
  const panel = ui.querySelector("[data-world-visit-controls]");
  if (!panel) return () => {};
  const entries = [...ui.querySelectorAll("[data-world-visit-start]")];
  const caption = panel.querySelector("[data-world-visit-caption]");
  const play = panel.querySelector("[data-world-visit-play]");
  const scrub = panel.querySelector("[data-world-visit-scrub]");
  const prior = panel.querySelector("[data-world-visit-prior]");
  const next = panel.querySelector("[data-world-visit-next]");
  const takeOver = panel.querySelector("[data-world-visit-takeover]");
  for (const entry of entries) listen(entry, "click", () => actions.start(entry.dataset.worldVisitStart));
  listen(play, "click", actions.togglePause);
  listen(prior, "click", () => actions.skip(-1));
  listen(next, "click", () => actions.skip(1));
  listen(scrub, "input", () => actions.seek(scrub.valueAsNumber));
  listen(takeOver, "click", () => actions.stop({ keepView: true }));
  listen(panel.querySelector("[data-world-visit-return]"), "click", () => actions.stop());
  let shown = false;
  return ({ ready, state, pose }) => {
    for (const entry of entries) entry.hidden = !ready || Boolean(state);
    panel.hidden = !state;
    if (!state) {
      shown = false;
      return;
    }
    // Do not steal the slider from a finger or a keyboard slider adjustment.
    if (scrub.ownerDocument.activeElement !== scrub) scrub.value = state.seconds;
    if (caption.textContent !== pose.caption) caption.textContent = pose.caption;
    scrub.max = state.duration;
    play.hidden = state.reduced;
    play.textContent = state.paused ? "Play" : "Pause";
    prior.disabled = !state.hasPrior;
    next.disabled = !state.hasNext;
    takeOver.hidden = pose.lift !== null;
    if (!shown) {
      shown = true;
      (play.hidden ? scrub : play).focus({ preventScroll: true });
    }
  };
}
