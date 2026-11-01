import { LIFT_LABELS, sessionPlan } from "./training.mjs";

const LIFTS = ["squat", "deadlift", "bench", "ohp"];
const VIEWS = ["today", "progress", "program"];
const TITLES = { today: "Today", progress: "Progress", program: "Program" };
const clamp = (v, hi) => Math.max(0, Math.min(hi, v || 0));
const dateLabel = (key) =>
  key ? new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Display conversion only. The authored pound loads, plate selection and performance are untouched.
export function trainingWeight(pounds, unit = "lb") {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: unit === "kg" ? 1 : 0 }).format(unit === "kg" ? pounds * 0.45359237 : pounds);
}

export function trainingDashboardModel(training, info, display = {}) {
  const unit = display.unit === "kg" ? "kg" : "lb";
  const lift = LIFTS.includes(display.lift) ? display.lift : "squat";
  const view = VIEWS.includes(display.view) ? display.view : "today";
  const template = Object.hasOwn(training.templates, display.template) ? display.template : info?.plan?.template || training.anchor.template;
  const day = clamp(
    Number.isInteger(display.day) ? display.day : (info?.plan?.day ?? training.anchor.day),
    training.templates[template].days.length - 1
  );
  const plan = info?.plan;
  const finished = Boolean(plan && !info.state && info.minute >= info.endMinute);
  const counts = Object.fromEntries(
    (plan?.lifts || []).map((l) => [l.lift, finished ? l.sets.length : clamp(info?.state?.done?.[l.lift], l.sets.length)])
  );
  const total = (plan?.lifts || []).reduce((n, l) => n + l.sets.length, 0);
  const completed = Object.values(counts).reduce((a, b) => a + b, 0);
  const segment = info?.state?.segment;
  const current = segment?.kind === "set" && !segment.warmup ? { lift: segment.lift, set: segment.set } : null;
  const phase = !plan
    ? "Rest day"
    : finished
      ? "Session complete"
      : !info.state
        ? "Planned session"
        : segment?.warmup
          ? "Warm-up"
          : {
              set: "Working set",
              superset: "Superset",
              rest: "Between sets",
              load: "Changing plates",
              board: "At the screen",
              arrive: "Arriving",
              leave: "Winding down",
              walk: "Moving stations",
              setup: "Setting up",
              rerack: "Re-racking",
            }[segment?.kind] || "In the gym";
  return {
    view,
    unit,
    lift,
    template,
    day,
    asOf: training.asOf,
    recordedDate: dateLabel(training.asOf),
    date: dateLabel(info?.key),
    key: info?.key || "",
    program: training.program,
    plan,
    counts,
    completed,
    total,
    current,
    phase,
    maxes: LIFTS.map((key) => ({ key, label: LIFT_LABELS[key], value: training.trainingMax[key], points: training.progress?.[key] || [] })),
    // A house performance never appends to the recorded log or advances these totals.
    cycles: training.cycles || [],
    programPlan: sessionPlan({ template, day, cycle: info?.position?.cycle ?? training.anchor.cycle }, training),
  };
}

export function trainingDashboardKey(model) {
  return JSON.stringify([model.view, model.unit, model.lift, model.template, model.day, model.key, model.phase, model.counts, model.current]);
}

// Cheap semantic guard for the frame loop; constructing charts/program views and
// drawing/uploading the large texture happens only after this key changes.
export function trainingSessionKey(info, display = {}) {
  const segment = info?.state?.segment;
  return JSON.stringify([
    display,
    info?.key,
    info?.plan?.template,
    info?.plan?.day,
    info?.plan?.cycle,
    Boolean(info?.plan && !info.state && info.minute >= info.endMinute),
    info?.state?.done,
    segment?.kind,
    Boolean(segment?.warmup),
    segment?.kind === "set" ? [segment.lift, segment.set] : null,
  ]);
}

const setLabel = (set, unit) => `${trainingWeight(set.weight, unit)} × ${set.reps}${set.amrap ? "+" : ""}`;
const stat = (label, value, note = "") =>
  `<div class="home-training-stat"><span>${escape(label)}</span><strong>${escape(value)}</strong>${note ? `<small>${escape(note)}</small>` : ""}</div>`;
const setsMarkup = (lift, model, performed = false) =>
  `<ol class="home-training-sets">${lift.sets
    .map((set, i) => {
      const done = performed && i < model.counts[lift.lift],
        current = performed && model.current?.lift === lift.lift && model.current.set === i;
      return `<li${done ? ' data-done="true"' : ""}${current ? ' aria-current="step"' : ""}><span>${i + 1}</span><strong>${escape(setLabel(set, model.unit))}</strong><small>${done ? "Done" : current ? "Now" : `${set.percent}% TM`}</small></li>`;
    })
    .join("")}</ol>`;

function progressChart(points, unit) {
  if (!points.length) return "<p>No recorded points.</p>";
  const values = points.map((p) => p[1]),
    low = Math.floor(Math.min(...values) / 10) * 10 - 10,
    high = Math.ceil(Math.max(...values) / 10) * 10 + 10;
  const start = Date.parse(points[0][0]),
    end = Date.parse(points.at(-1)[0]);
  const x = (date) => 66 + ((Date.parse(date) - start) / Math.max(1, end - start)) * 628,
    y = (v) => 190 - ((v - low) / (high - low)) * 152;
  const grid = [low, (low + high) / 2, high]
    .map((v) => `<line x1="66" x2="694" y1="${y(v)}" y2="${y(v)}"/><text x="54" y="${y(v) + 4}" text-anchor="end">${trainingWeight(v, unit)}</text>`)
    .join("");
  return `<svg class="home-training-chart" viewBox="0 0 732 232" role="img" aria-label="Recorded training max, ${escape(dateLabel(points[0][0]))} to ${escape(dateLabel(points.at(-1)[0]))}"><g class="home-training-grid">${grid}</g><path class="home-training-trend" d="${points.map(([d, v], i) => `${i ? "L" : "M"}${x(d)},${y(v)}`).join(" ")}"/>${points.map(([d, v]) => `<circle cx="${x(d)}" cy="${y(v)}" r="4"/>`).join("")}<text x="66" y="218">${escape(dateLabel(points[0][0]))}</text><text x="694" y="218" text-anchor="end">${escape(dateLabel(points.at(-1)[0]))}</text></svg>`;
}

function panelMarkup(model, training) {
  const m = model,
    w = (v) => `${trainingWeight(v, m.unit)} ${m.unit}`;
  if (m.view === "today")
    return `<div class="home-training-heading"><div><p class="home-training-eyebrow">House session · ${escape(m.date)}</p><h3>${escape(m.phase)}</h3></div>${m.total ? stat("Working sets", `${m.completed} / ${m.total}`, "In this house session") : ""}</div>${m.plan ? `<p class="home-training-context">${escape(m.plan.templateLabel)} · day ${m.plan.day + 1} · ${escape(m.plan.kind)} body</p><div class="home-training-lifts">${m.plan.lifts.map((l) => `<section><div class="home-training-lift-title"><h4>T${l.tier} · ${escape(LIFT_LABELS[l.lift])}</h4><span>with ${escape(LIFT_LABELS[l.superset])}</span></div>${setsMarkup(l, m, true)}</section>`).join("")}</div><p class="home-training-note">${m.plan.finisher ? `${escape(LIFT_LABELS[m.plan.finisher])} to finish. ` : ""}The house follows the program; recorded history stays in Progress.</p>` : `<p class="home-training-context">A pause in the house’s training rhythm.</p><div class="home-training-stats">${m.maxes.map((l) => stat(l.label, w(l.value), "Training max")).join("")}</div><p class="home-training-note">Explore the recorded training maxes in Progress, or browse the six-day split in Program.</p>`}`;
  if (m.view === "progress") {
    const selected = m.maxes.find((l) => l.key === m.lift),
      points = selected.points,
      gain = points.length ? points.at(-1)[1] - points[0][1] : 0;
    return `<div class="home-training-heading"><div><p class="home-training-eyebrow">Recorded history · through ${escape(m.recordedDate)}</p><h3>Training maxes</h3></div><span class="home-training-caption">The program’s working baseline</span></div><div class="home-training-lift-switch" role="group" aria-label="Choose a lift">${m.maxes.map((l) => `<button type="button" data-training-lift="${l.key}" aria-pressed="${l.key === m.lift}"><span>${escape(l.label)}</span><strong>${w(l.value)}</strong></button>`).join("")}</div><section class="home-training-history"><div class="home-training-heading"><h4>${escape(selected.label)}</h4><span>${gain > 0 ? "+" : ""}${trainingWeight(gain, m.unit)} ${m.unit} across the record</span></div>${progressChart(points, m.unit)}<details><summary>View the recorded values</summary><table><thead><tr><th scope="col">Date</th><th scope="col">Training max (${m.unit})</th></tr></thead><tbody>${points.map(([date, value]) => `<tr><th scope="row">${escape(dateLabel(date))}</th><td>${trainingWeight(value, m.unit)}</td></tr>`).join("")}</tbody></table></details></section><section class="home-training-cycles"><h4>Recorded cycles</h4><table><thead><tr><th scope="col">Started</th><th scope="col">Template</th><th scope="col">Sets</th><th scope="col">Missed</th></tr></thead><tbody>${m.cycles.map((c) => `<tr><th scope="row">${escape(dateLabel(c.start))}</th><td>${escape(training.templates[c.template].label)}</td><td>${c.sets} / ${c.of}</td><td>${c.failed}</td></tr>`).join("")}</tbody></table></section>`;
  }
  const plan = m.programPlan;
  return `<div class="home-training-heading"><div><p class="home-training-eyebrow">Program · based on recorded training maxes</p><h3>The six-day split</h3></div></div><div class="home-training-template" role="group" aria-label="Program template">${Object.entries(
    training.templates
  )
    .map(([key, t]) => `<button type="button" data-training-template="${key}" aria-pressed="${key === m.template}">${escape(t.label)}</button>`)
    .join(
      ""
    )}</div><div class="home-training-days" role="group" aria-label="Program day">${training.templates[m.template].days.map((d, i) => `<button type="button" data-training-day="${i}" aria-pressed="${i === m.day}">Day ${i + 1}<small>${escape(d.kind)}</small></button>`).join("")}</div><div class="home-training-lifts">${plan.lifts.map((l) => `<section><div class="home-training-lift-title"><h4>T${l.tier} · ${escape(LIFT_LABELS[l.lift])}</h4><span>TM ${w(l.trainingMax)} · with ${escape(LIFT_LABELS[l.superset])}</span></div>${setsMarkup(l, m)}</section>`).join("")}</div><p class="home-training-note">+ marks the program’s open-ended final set. ${m.unit === "kg" ? "Kilograms are a display conversion of the pound loads. " : ""}Browsing keeps the house’s session unchanged.</p>`;
}

// One stable dialog shell; semantic session changes refresh only the panel and the screen.
export function createGymDashboard({ stage, controls, canvas, training, getInfo, onOpenChange = () => {}, onDisplayChange = () => {} }) {
  const doc = stage.ownerDocument,
    listeners = [],
    display = { view: "today", unit: "lb", lift: "squat" };
  let info = null,
    key = "",
    returnFocus = null,
    modalActive = false,
    disposed = false;
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "home-training-open";
  button.dataset.worldTraining = "";
  button.hidden = true;
  button.textContent = "Training";
  button.setAttribute("aria-label", "Open training screen");
  button.title = "Open training screen (T)";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-keyshortcuts", "T");
  controls.querySelector(".home-world-quiet-actions").prepend(button);
  const dialog = doc.createElement("dialog");
  dialog.className = "home-training-dialog";
  dialog.dataset.trainingDialog = "";
  dialog.setAttribute("aria-labelledby", "home-training-title");
  dialog.innerHTML = `<header class="home-training-header"><div><p class="home-training-eyebrow">The coastal home · training</p><h2 id="home-training-title">${escape(training.program)}</h2></div><button type="button" data-training-close aria-label="Close training screen">×</button></header><div class="home-training-toolbar"><div class="home-training-tabs" role="tablist" aria-label="Training views">${VIEWS.map((view, i) => `<button type="button" role="tab" id="home-training-tab-${view}" data-training-view="${view}" aria-controls="home-training-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${TITLES[view]}</button>`).join("")}</div><div class="home-training-units" role="group" aria-label="Weight unit"><button type="button" data-training-unit="lb" aria-pressed="true">lb</button><button type="button" data-training-unit="kg" aria-pressed="false">kg</button></div></div><div class="home-training-panel" id="home-training-panel" role="tabpanel" tabindex="0"></div>`;
  stage.append(dialog);
  const panel = dialog.querySelector("[role=tabpanel]");
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const focusKey = (element) => (element?.matches?.("button") ? Object.entries(element.dataset).find(([k]) => k.startsWith("training")) : null);
  function update(next = getInfo(), force = false) {
    info = next;
    const model = trainingDashboardModel(training, info, display),
      nextKey = trainingDashboardKey(model);
    if (!force && nextKey === key) return;
    key = nextKey;
    onDisplayChange({ ...display });
    if (!dialog.open) return;
    const focused = panel.contains(doc.activeElement) ? focusKey(doc.activeElement) : null,
      scrollTop = panel.scrollTop;
    panel.innerHTML = panelMarkup(model, training);
    panel.setAttribute("aria-labelledby", `home-training-tab-${model.view}`);
    panel.scrollTop = scrollTop;
    if (focused) [...panel.querySelectorAll("button")].find((b) => b.dataset[focused[0]] === focused[1])?.focus({ preventScroll: true });
    dialog.querySelectorAll("[data-training-view]").forEach((b) => {
      const selected = b.dataset.trainingView === model.view;
      b.setAttribute("aria-selected", String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    dialog.querySelectorAll("[data-training-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.trainingUnit === model.unit)));
  }
  function finishClose() {
    // Native close notifications can wait behind rendering. Release input in
    // the closing action, and let a later notification finish at most once.
    if (dialog.open || !modalActive) return;
    modalActive = false;
    onOpenChange(false);
    const origin = returnFocus;
    returnFocus = null;
    if (!disposed) (origin?.isConnected && !origin.hidden ? origin : canvas)?.focus({ preventScroll: true });
  }
  function close() {
    if (dialog.open) dialog.close();
    finishClose();
  }
  function open(origin = button) {
    if (disposed || dialog.open) return;
    finishClose();
    returnFocus = origin;
    // Keep the modal outside the hero grid and the popover fallback: WebKit can
    // report correct bounds while painting a nested top-layer dialog elsewhere.
    // Actual native fullscreen requires the dialog inside its fullscreen stage.
    const nativeFullscreen = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    const parent = nativeFullscreen?.contains(stage) ? stage : doc.body;
    if (dialog.parentElement !== parent) parent.append(dialog);
    modalActive = true;
    onOpenChange(true);
    try {
      dialog.showModal();
    } catch {
      modalActive = false;
      returnFocus = null;
      onOpenChange(false);
      return;
    }
    update(getInfo(), true);
    dialog.querySelector(`[data-training-view="${display.view}"]`).focus({ preventScroll: true });
  }
  on(button, "click", () => open(button));
  on(dialog, "close", finishClose);
  on(dialog, "cancel", (event) => {
    event.preventDefault();
    close();
  });
  // Fullscreen owns Escape at the stage capture phase. A dashboard Escape consumes it earlier.
  on(
    doc,
    "keydown",
    (event) => {
      if (dialog.open && event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    true
  );
  on(dialog, "click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-training-close")) return close();
    const choices = { trainingView: "view", trainingUnit: "unit", trainingLift: "lift", trainingTemplate: "template", trainingDay: "day" };
    for (const [data, field] of Object.entries(choices))
      if (data in b.dataset) display[field] = field === "day" ? Number(b.dataset[data]) : b.dataset[data];
    panel.scrollTop = 0;
    update(info, true);
  });
  on(dialog.querySelector("[role=tablist]"), "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = VIEWS.indexOf(display.view),
      next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    display.view = VIEWS[next];
    panel.scrollTop = 0;
    update(info, true);
    dialog.querySelector(`[data-training-view="${display.view}"]`).focus();
  });
  return {
    open,
    close,
    update,
    setAvailable(available) {
      button.hidden = !available;
    },
    get isOpen() {
      return dialog.open;
    },
    evidence: () => ({ open: dialog.open, display: { ...display }, key }),
    dispose() {
      disposed = true;
      close();
      listeners.forEach((off) => off());
      dialog.remove();
      button.remove();
    },
  };
}

// Reuses the delivered board's face and UVs; 2× native canvas resolution keeps close inspections crisp.
export function drawTrainingScreen(g, model) {
  const W = 1024,
    H = 696,
    orange = "#f6a574",
    muted = "#a9c0c6",
    ink = "#edf5f4",
    blue = "#7cb9c8";
  g.save();
  g.scale(g.canvas.width / W, g.canvas.height / H);
  g.fillStyle = "#14282f";
  g.fillRect(0, 0, W, H);
  const text = (s, x, y, size = 24, color = ink, weight = 500) => {
    g.fillStyle = color;
    g.font = `${weight} ${size}px Inter, sans-serif`;
    g.fillText(String(s), x, y);
  };
  const line = (x, y, w, color = "#35505a", width = 1) => {
    g.beginPath();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
  };
  text("SIRUI / TRAINING", 44, 54, 20, muted, 600);
  text(model.program, 44, 101, 34, ink, 600);
  // A quiet coastal trace, rather than a badge or an ornamental chart.
  g.fillStyle = orange;
  g.beginPath();
  g.arc(942, 64, 15, Math.PI, 0);
  g.fill();
  line(918, 70, 48, blue, 2);
  line(930, 80, 24, "#d6a18a", 1.5);
  VIEWS.forEach((view, i) => {
    text(TITLES[view], 44 + i * 150, 155, 23, model.view === view ? orange : muted, model.view === view ? 650 : 400);
    if (view === model.view) line(44 + i * 150, 169, 85, orange, 3);
  });
  text(model.unit.toUpperCase(), 936, 155, 20, muted);
  line(44, 184, 936);
  const value = (v) => trainingWeight(v, model.unit);
  if (model.view === "today") {
    text("HOUSE SESSION", 44, 229, 18, blue, 600);
    text(model.phase, 44, 280, 42, ink, 600);
    text(model.date, 44, 317, 20, muted);
    if (model.plan) {
      text(`${model.completed} / ${model.total}`, 773, 280, 44, orange, 600);
      text("working sets", 773, 315, 20, muted);
      model.plan.lifts.forEach((lift, i) => {
        const y = 385 + i * 115;
        text(`T${lift.tier}  ${LIFT_LABELS[lift.lift]}`, 44, y, 29, ink, 600);
        text(`with ${LIFT_LABELS[lift.superset]}`, 44, y + 34, 20, muted);
        const top = Math.max(...lift.sets.map((s) => s.weight));
        text(`${value(top)} ${model.unit}`, 530, y, 30, orange, 600);
        text("heaviest planned load", 530, y + 33, 17, muted);
        lift.sets.forEach((s, j) => {
          g.fillStyle = j < model.counts[lift.lift] ? blue : "#35505a";
          g.fillRect(794 + j * 19, y - 19, 12, 18);
        });
      });
    } else {
      text("Between sessions", 44, 393, 27, ink);
      text("Explore the training record or the six-day split.", 44, 433, 22, muted);
      model.maxes.forEach((l, i) => {
        const x = 44 + i * 238;
        text(l.key === "ohp" ? "Overhead press" : l.label, x, 531, 19, muted);
        text(`${value(l.value)} ${model.unit}`, x, 574, 30, ink, 600);
      });
    }
  } else if (model.view === "progress") {
    const selected = model.maxes.find((l) => l.key === model.lift),
      points = selected.points;
    text("RECORDED TRAINING MAX", 44, 229, 18, blue, 600);
    text(selected.label, 44, 282, 38, ink, 600);
    text(`${value(selected.value)} ${model.unit}`, 712, 282, 44, orange, 600);
    if (points.length) {
      const values = points.map((p) => p[1]),
        lo = Math.min(...values),
        hi = Math.max(...values),
        t0 = Date.parse(points[0][0]),
        t1 = Date.parse(points.at(-1)[0]);
      line(44, 457, 936);
      g.beginPath();
      g.strokeStyle = orange;
      g.lineWidth = 4;
      points.forEach(([d, v], i) => {
        const x = 54 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * 906,
          y = 440 - ((v - lo) / Math.max(1, hi - lo)) * 120;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
      text(dateLabel(points[0][0]), 44, 488, 18, muted);
      text(dateLabel(points.at(-1)[0]), 785, 488, 18, muted);
    }
    model.maxes.forEach((l, i) => {
      const x = 44 + i * 238;
      text(l.key === "ohp" ? "Overhead press" : l.label, x, 550, 19, muted);
      text(`${value(l.value)} ${model.unit}`, x, 589, 29, l.key === model.lift ? orange : ink, 600);
    });
  } else {
    const plan = model.programPlan;
    text("PROGRAM / PLANNED LOADS", 44, 229, 18, blue, 600);
    text(`${plan.templateLabel} · day ${model.day + 1}`, 44, 282, 37, ink, 600);
    plan.lifts.forEach((lift, i) => {
      const y = 350 + i * 115;
      text(`T${lift.tier}  ${LIFT_LABELS[lift.lift]}`, 44, y, 28, ink, 600);
      text(`${lift.sets.length} sets · with ${LIFT_LABELS[lift.superset]}`, 44, y + 33, 20, muted);
      text(`TM ${value(lift.trainingMax)} ${model.unit}`, 735, y, 27, orange, 600);
    });
    text("Open to browse all six days and every set.", 44, 570, 22, muted);
  }
  line(44, 625, 936);
  text(`Record · ${model.recordedDate}`, 44, 663, 18, muted);
  text("Open training  ↗", 776, 663, 20, orange, 600);
  g.restore();
}
