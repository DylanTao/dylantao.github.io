import { clamp } from "./duh-motion.mjs";

export const DUH_FORMS = ["dot", "apple", "peach", "watermelon", "square", "triangle"];
const colors = {
  dot: [25, 27, 30],
  apple: [168, 44, 49],
  peach: [236, 150, 126],
  watermelon: [59, 120, 71],
  square: [25, 27, 30],
  triangle: [25, 27, 30],
};
const count = 20;
function radius(form, a) {
  if (form === "square") return 0.91 / Math.pow(Math.pow(Math.cos(a), 4) + Math.pow(Math.sin(a), 4), 0.25);
  if (form === "triangle") return 0.96 + 0.17 * Math.cos(3 * (a + Math.PI / 2));
  if (form === "apple") return 0.98 + 0.07 * Math.cos(2 * a) - 0.14 * Math.exp(-Math.pow((a + Math.PI / 2) / 0.3, 2));
  if (form === "peach") return 1 + 0.07 * Math.cos(2 * a) - 0.08 * Math.exp(-Math.pow((a + Math.PI / 2) / 0.25, 2));
  return 1;
}

// Twenty fixed-angle radii preserve a simple boundary. Quadratic midpoints
// stay inside their control hull; springs never alter the center collider.
export function createDuhPortrait(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = 96 * dpr;
  let form = "dot",
    radii = Array(count).fill(1),
    dents = Array(count).fill(0),
    speeds = Array(count).fill(0),
    color = [...colors.dot];
  let morphing = false;
  function change(next, still) {
    form = DUH_FORMS.includes(next) ? next : "dot";
    morphing = true;
    if (still) {
      radii = radii.map((_, i) => radius(form, -Math.PI + (i * Math.PI * 2) / count));
      color = [...colors[form]];
      dents.fill(0);
      speeds.fill(0);
    }
  }
  function pet(angle = -Math.PI / 2, still = false) {
    if (still) return;
    dents = dents.map((v, i) => {
      const a = -Math.PI + (i * Math.PI * 2) / count;
      const difference = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
      return clamp(v - 0.16 * Math.exp((-difference * difference) / 0.18), -0.2, 0.2);
    });
    morphing = true;
  }
  function draw({ dt = 1 / 60, gaze = [0, 0], squash = 0, mood = "content", theme = "noon", blink = false, still = false, hug = false } = {}) {
    const blend = still ? 1 : 1 - Math.exp(-12 * clamp(dt, 0, 0.05));
    let motion = 0;
    for (let i = 0; i < count; i++) {
      const target = radius(form, -Math.PI + (i * Math.PI * 2) / count);
      radii[i] += (target - radii[i]) * blend;
      if (still) dents[i] = speeds[i] = 0;
      else {
        // Analytic damped radial spring avoids frame-dependent integration drift.
        const d = clamp(dt, 0, 0.05),
          e = Math.exp(-16 * d),
          c = speeds[i] + 16 * dents[i];
        speeds[i] = (speeds[i] - 16 * c * d) * e;
        dents[i] = clamp((dents[i] + c * d) * e, -0.2, 0.2);
      }
      motion += Math.abs(target - radii[i]) + Math.abs(dents[i]);
    }
    color = color.map((v, i) => v + (colors[form][i] - v) * blend);
    morphing = motion > 0.002 || color.some((v, i) => Math.abs(v - colors[form][i]) > 0.2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 96, 96);
    ctx.fillStyle = theme === "evening" ? "rgba(0,0,0,.22)" : "rgba(20,30,40,.1)";
    ctx.beginPath();
    ctx.ellipse(48, 81, 19, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(48, 47);
    ctx.scale(Math.exp(squash), Math.exp(-squash));
    const points = radii.map((r, i) => {
      const a = -Math.PI + (i * Math.PI * 2) / count;
      return [Math.cos(a) * 28 * (r + dents[i]), Math.sin(a) * 28 * (r + dents[i])];
    });
    const path = new Path2D();
    path.moveTo((points[19][0] + points[0][0]) / 2, (points[19][1] + points[0][1]) / 2);
    points.forEach((p, i) => {
      const next = points[(i + 1) % count];
      path.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
    });
    path.closePath();
    const gradient = ctx.createRadialGradient(-11, -17, 2, 10, 16, 49);
    gradient.addColorStop(0, `rgb(${color.map((v) => Math.min(255, v + 14)).join(",")})`);
    gradient.addColorStop(1, `rgb(${color.map((v) => Math.max(0, v - 8)).join(",")})`);
    ctx.fillStyle = gradient;
    ctx.fill(path);
    ctx.strokeStyle = theme === "evening" ? "#a4a2b5" : "rgba(0,0,0,.16)";
    ctx.lineWidth = theme === "evening" ? 1.4 : 0.7;
    ctx.stroke(path);
    ctx.save();
    ctx.clip(path);
    if (form === "watermelon") {
      ctx.strokeStyle = "rgba(187,207,120,.55)";
      ctx.lineWidth = 3.2;
      for (let x = -30; x <= 30; x += 11) {
        ctx.beginPath();
        ctx.moveTo(x, -32);
        ctx.bezierCurveTo(x + 9, -12, x - 8, 10, x + 2, 33);
        ctx.stroke();
      }
    }
    if (["apple", "peach"].includes(form)) {
      // Deterministic static stipple: skin/fuzz, no animated noise texture.
      for (let i = 0; i < 110; i++) {
        const x = ((i * 37) % 61) - 30,
          y = ((i * 53) % 59) - 29;
        ctx.fillStyle = `rgba(255,239,214,${form === "peach" ? 0.2 : 0.14})`;
        ctx.fillRect(x, y, 0.8, 0.8);
      }
    }
    if (form === "peach") {
      ctx.strokeStyle = "rgba(145,65,57,.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1, -26);
      ctx.bezierCurveTo(-5, -15, 7, 5, 1, 26);
      ctx.stroke();
    }
    ctx.restore();
    if (["apple", "peach"].includes(form)) {
      ctx.strokeStyle = "#6f5032";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.quadraticCurveTo(-2, -29, 1, -33);
      ctx.stroke();
      ctx.fillStyle = "#668451";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.quadraticCurveTo(4, -39, 13, -33);
      ctx.quadraticCurveTo(9, -26, 0, -28);
      ctx.fill();
    }
    const gx = clamp(gaze[0], -1, 1) * 3,
      gy = clamp(gaze[1], -1, 1) * 2;
    const face = form === "peach" ? "#3b2930" : "#fffaf1";
    ctx.strokeStyle = ctx.fillStyle = face;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    for (const x of [-7, 7]) {
      ctx.beginPath();
      if (blink || mood === "giggle" || hug) {
        ctx.moveTo(x - 3 + gx, -2 + gy);
        ctx.quadraticCurveTo(x + gx, -5 + gy, x + 3 + gx, -2 + gy);
        ctx.stroke();
      } else {
        ctx.ellipse(x + gx, -3 + gy, 2.7, mood === "curious" ? 4.4 : 3.5, x < 0 ? -0.06 : 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (["happy", "giggle", "delighted"].includes(mood) || hug) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3 + gx, 6 + gy);
      ctx.quadraticCurveTo(gx, 10 + gy, 3 + gx, 6 + gy);
      ctx.stroke();
    }
    ctx.restore();
    if (hug) {
      ctx.strokeStyle = theme === "evening" ? "#b7b2e3" : "#596974";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(48 + side * 24, 52);
        ctx.quadraticCurveTo(48 + side * 39, 44, 48 + side * 36, 34);
        ctx.stroke();
      }
    }
  }
  return { change, pet, draw, active: () => morphing, form: () => form };
}
