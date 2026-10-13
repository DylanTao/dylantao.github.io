import { createDuhBody, deformDuhContour } from "./duh-body.mjs";
import { createDuhSoftBody } from "./duh-softbody.mjs";
import { clamp } from "./duh-motion.mjs";

export const DUH_FORMS = ["dot", "apple", "peach", "watermelon", "square", "triangle"];
const colors = {
  dot: [25, 27, 30],
  apple: [168, 44, 49],
  peach: [243, 168, 120],
  watermelon: [59, 120, 71],
  square: [25, 27, 30],
  triangle: [25, 27, 30],
};
const count = 20;
function radius(form, a) {
  if (form === "square") return 0.91 / Math.pow(Math.pow(Math.cos(a), 4) + Math.pow(Math.sin(a), 4), 0.25);
  if (form === "triangle") return 0.96 + 0.17 * Math.cos(3 * (a + Math.PI / 2));
  if (form === "apple") return 0.98 + 0.07 * Math.cos(2 * a) - 0.14 * Math.exp(-Math.pow((a + Math.PI / 2) / 0.3, 2));
  if (form === "peach")
    return (
      1 + 0.12 * Math.cos(2 * a) - 0.23 * Math.exp(-Math.pow((a + Math.PI / 2) / 0.34, 2)) + 0.08 * Math.exp(-Math.pow((a - Math.PI / 2) / 0.3, 2))
    );
  return 1;
}

// Light for the soft variant's shading, keyed to the four time-of-day themes: a key highlight and a
// rim on the far side. The charcoal silhouette itself stays stable.
const softLight = {
  morning: { key: [255, 244, 226], keyAlpha: 0.3, rim: [255, 214, 170], rimAlpha: 0.32 },
  noon: { key: [255, 255, 250], keyAlpha: 0.34, rim: [190, 214, 236], rimAlpha: 0.26 },
  afternoon: { key: [255, 230, 196], keyAlpha: 0.32, rim: [255, 186, 120], rimAlpha: 0.34 },
  evening: { key: [214, 210, 255], keyAlpha: 0.24, rim: [176, 168, 236], rimAlpha: 0.5 },
};
const targetRadii = (form) => Array.from({ length: count }, (_, i) => radius(form, -Math.PI + (i * Math.PI * 2) / count));

// Twenty fixed-angle radii preserve a simple boundary. Quadratic midpoints
// stay inside their control hull; springs never alter the center collider.
// `soft: true` draws the XPBD soft body (duh-softbody.mjs) instead of the inertial shell, with
// follow-through eyes, smear on fast moves, and theme-keyed rim and key light.
export function createDuhPortrait(canvas, { soft = false } = {}) {
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
  const body = createDuhBody();
  const softBody = soft ? createDuhSoftBody() : null;
  const eyeLag = [0, 0];
  const look = [0, 0];
  const expression = { open: 1, smile: 0, arch: 0 };
  let expressionActive = false;
  let emotion = [0, 0, 0],
    emotionActive = false,
    contact = { bottom: 28, halfWidth: 28 };
  const texture = Object.fromEntries(DUH_FORMS.map((f) => [f, f === "dot" ? 1 : 0]));
  function change(next, still) {
    form = DUH_FORMS.includes(next) ? next : "dot";
    morphing = true;
    softBody?.setShape(targetRadii(form));
    if (still) {
      radii = radii.map((_, i) => radius(form, -Math.PI + (i * Math.PI * 2) / count));
      color = [...colors[form]];
      dents.fill(0);
      speeds.fill(0);
    }
  }
  function pet(angle = -Math.PI / 2, still = false) {
    if (still) return;
    if (softBody) {
      softBody.pet(angle);
      return;
    }
    dents = dents.map((v, i) => {
      const a = -Math.PI + (i * Math.PI * 2) / count;
      const difference = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
      return clamp(v - 0.16 * Math.exp((-difference * difference) / 0.18), -0.2, 0.2);
    });
    morphing = true;
  }
  function draw({
    dt = 1 / 60,
    gaze = [0, 0],
    squash = 0,
    mood = "content",
    theme = "noon",
    blink = false,
    still = false,
    hug = false,
    velocity = [0, 0],
    acceleration = [0, 0],
    held = false,
    grounded = true,
    tilt = 0,
    effort = 0,
    tuck = 0,
    contactAngle = Math.PI / 2,
    time = 0,
  } = {}) {
    const blend = still ? 1 : 1 - Math.exp(-5 * clamp(dt, 0, 0.05));
    const shell = body.step(dt, { vx: velocity[0], vy: velocity[1], ax: acceleration[0], ay: acceleration[1], held, grounded, still });
    for (const key of DUH_FORMS) texture[key] += ((form === key ? 1 : 0) - texture[key]) * blend;
    look.forEach((v, i) => (look[i] = v + (gaze[i] - v) * (still ? 1 : 1 - Math.exp(-10 * dt))));
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
    const warmth =
      ["happy", "giggle", "delighted"].includes(mood) || hug
        ? [7, 2, -1]
        : mood === "curious"
          ? [-1, 3, 8]
          : mood === "sleepy"
            ? [-3, -1, 3]
            : [0, 0, 0];
    emotion = emotion.map((v, i) => v + (warmth[i] - v) * blend);
    emotionActive = emotion.some((v, i) => Math.abs(v - warmth[i]) > 0.03);
    color = color.map((v, i) => v + (colors[form][i] - v) * blend);
    morphing = motion > 0.002 || color.some((v, i) => Math.abs(v - colors[form][i]) > 0.2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 96, 96);
    ctx.save();
    ctx.translate(48, 47 + tuck * 12);
    ctx.scale(1 - tuck * 0.38, 1 - tuck * 0.48);
    ctx.rotate(tilt);
    // Hard landings read a touch harder on the soft body (exaggeration), within its contact bound.
    const points = softBody
      ? softBody.step(dt, { ax: acceleration[0], ay: acceleration[1], held, grounded, still, squash: squash * 1.3, contactAngle, time })
      : deformDuhContour(radii, dents, shell, squash, contactAngle);
    const n = points.length;
    contact = {
      bottom: tuck * 12 + (1 - tuck * 0.48) * Math.max(...points.map(([x, y]) => x * Math.sin(tilt) + y * Math.cos(tilt))),
      halfWidth: (1 - tuck * 0.38) * Math.max(...points.map(([x, y]) => Math.abs(x * Math.cos(tilt) - y * Math.sin(tilt)))),
    };
    const outline = (offsetX = 0, offsetY = 0) => {
      const shape = new Path2D();
      shape.moveTo((points[n - 1][0] + points[0][0]) / 2 + offsetX, (points[n - 1][1] + points[0][1]) / 2 + offsetY);
      points.forEach((p, i) => {
        const next = points[(i + 1) % n];
        shape.quadraticCurveTo(p[0] + offsetX, p[1] + offsetY, (p[0] + next[0]) / 2 + offsetX, (p[1] + next[1]) / 2 + offsetY);
      });
      shape.closePath();
      return shape;
    };
    const path = outline();
    const speed = Math.hypot(velocity[0], velocity[1]);
    if (softBody && !still && speed > 900) {
      // Smear: two faint trailing copies along the motion, like an animator's smear frame.
      const strength = clamp((speed - 900) / 900, 0, 1);
      ctx.fillStyle = `rgb(${color.map((v) => Math.round(v)).join(",")})`;
      for (const [k, alpha] of [
        [0.012, 0.16],
        [0.024, 0.08],
      ]) {
        ctx.globalAlpha = alpha * strength;
        ctx.fill(outline(-velocity[0] * k, -velocity[1] * k));
      }
      ctx.globalAlpha = 1;
    }
    const gradient = ctx.createRadialGradient(-11, -17, 2, 10, 16, 49);
    gradient.addColorStop(0, `rgb(${color.map((v, i) => clamp(v + 14 + emotion[i], 0, 255)).join(",")})`);
    gradient.addColorStop(1, `rgb(${color.map((v, i) => clamp(v - 8 + emotion[i] * 0.35, 0, 255)).join(",")})`);
    ctx.fillStyle = gradient;
    ctx.fill(path);
    ctx.strokeStyle = theme === "evening" ? "#a4a2b5" : "rgba(0,0,0,.16)";
    ctx.lineWidth = theme === "evening" ? 1.4 : 0.7;
    ctx.stroke(path);
    if (softBody) {
      // An inflated look without per-pixel normals: a rim band on the side away from the key light,
      // a soft key highlight that rides with the deformed outline, and a core shadow toward the
      // contact. All three follow the body's actual bounds, so they squash with it.
      const light = softLight[theme] || softLight.noon;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [px, py] of points) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      const w = maxX - minX,
        h = maxY - minY;
      ctx.save();
      ctx.clip(path);
      const rim = ctx.createLinearGradient(minX, minY, maxX, maxY);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(0.55, "rgba(0,0,0,0)");
      rim.addColorStop(1, `rgba(${light.rim.join(",")},${light.rimAlpha})`);
      ctx.strokeStyle = rim;
      ctx.lineWidth = 7;
      ctx.stroke(path);
      const keyX = minX + w * 0.32,
        keyY = minY + h * 0.26;
      const key = ctx.createRadialGradient(keyX, keyY, 0.5, keyX, keyY, w * 0.32);
      key.addColorStop(0, `rgba(${light.key.join(",")},${light.keyAlpha})`);
      key.addColorStop(1, `rgba(${light.key.join(",")},0)`);
      ctx.fillStyle = key;
      ctx.fillRect(minX, minY, w, h);
      const core = ctx.createRadialGradient(minX + w * 0.55, maxY + h * 0.18, h * 0.2, minX + w * 0.55, maxY, h * 0.75);
      core.addColorStop(0, "rgba(0,0,0,.22)");
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.fillRect(minX, minY, w, h);
      ctx.restore();
    }
    ctx.save();
    ctx.clip(path);
    if (texture.watermelon > 0.01) {
      ctx.globalAlpha = texture.watermelon;
      ctx.strokeStyle = "rgba(187,207,120,.55)";
      ctx.lineWidth = 3.2;
      for (let x = -30; x <= 30; x += 11) {
        ctx.beginPath();
        ctx.moveTo(x, -32);
        ctx.bezierCurveTo(x + 9, -12, x - 8, 10, x + 2, 33);
        ctx.stroke();
      }
    }
    if (texture.peach > 0.01) {
      ctx.globalAlpha = texture.peach;
      const blush = ctx.createRadialGradient(17, 0, 2, 11, 0, 35);
      blush.addColorStop(0, "rgba(221,78,97,.7)");
      blush.addColorStop(1, "rgba(255,204,130,0)");
      ctx.fillStyle = blush;
      ctx.fillRect(-40, -40, 80, 80);
      const velvet = ctx.createRadialGradient(-15, -12, 1, -8, -8, 27);
      velvet.addColorStop(0, "rgba(255,229,160,.32)");
      velvet.addColorStop(1, "rgba(255,229,160,0)");
      ctx.fillStyle = velvet;
      ctx.fillRect(-40, -40, 80, 80);
    }
    if (texture.apple + texture.peach > 0.01) {
      ctx.globalAlpha = Math.min(1, texture.apple + texture.peach);
      // Deterministic static stipple: skin/fuzz, no animated noise texture.
      for (let i = 0; i < 110; i++) {
        const x = ((i * 37) % 61) - 30,
          y = ((i * 53) % 59) - 29;
        ctx.fillStyle = `rgba(255,239,214,${form === "peach" ? 0.2 : 0.14})`;
        ctx.fillRect(x, y, 0.8, 0.8);
      }
    }
    if (texture.peach > 0.01) {
      ctx.globalAlpha = texture.peach;
      ctx.strokeStyle = "rgba(173,75,76,.52)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.bezierCurveTo(-6, -10, 9, 11, 0, 28);
      ctx.stroke();
    }
    ctx.restore();
    if (texture.apple + texture.peach > 0.01) {
      ctx.globalAlpha = Math.min(1, texture.apple + texture.peach);
      ctx.strokeStyle = "#6f5032";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.save();
      ctx.translate(0, texture.peach * 4);
      ctx.scale(1 + texture.peach * 0.2, 1 - texture.peach * 0.16);
      ctx.moveTo(0, -24);
      ctx.quadraticCurveTo(-2, -29, 1, -33);
      ctx.stroke();
      ctx.fillStyle = "#668451";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.quadraticCurveTo(4, -39, 13, -33);
      ctx.quadraticCurveTo(9, -26, 0, -28);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.rotate(-tilt * 0.7);
    if (softBody) {
      // Follow-through: the face trails the body's centroid on a faster spring, so it settles a
      // beat after the body instead of being painted on.
      const [cx, cy] = softBody.centroid();
      const follow = still ? 1 : 1 - Math.exp(-14 * clamp(dt, 0, 0.05));
      eyeLag[0] += (cx * 0.9 - eyeLag[0]) * follow;
      eyeLag[1] += (cy * 0.9 - eyeLag[1]) * follow;
      ctx.translate(eyeLag[0], eyeLag[1]);
    } else ctx.translate(shell.x * 0.65, shell.y * 0.65);
    const gx = clamp(look[0], -1, 1) * 4,
      gy = clamp(look[1], -1, 1) * 3;
    const face = color[0] * 0.21 + color[1] * 0.72 + color[2] * 0.07 > 150 ? "#3b2930" : "#fffaf1";
    ctx.strokeStyle = ctx.fillStyle = face;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    const cheerful = ["happy", "giggle", "delighted"].includes(mood) || hug;
    const targets = {
      open: blink ? 0.06 : mood === "sleepy" ? 0.08 : mood === "shy" ? 0.4 : mood === "alert" ? 1.4 : mood === "curious" ? 1.2 : 1,
      smile: cheerful ? 1 : mood === "sleepy" ? 0.2 : 0,
      arch: mood === "giggle" || hug || effort > 0.6 ? 1 : 0,
    };
    const faceBlend = still ? 1 : 1 - Math.exp(-20 * dt);
    for (const key of Object.keys(expression)) expression[key] += (targets[key] - expression[key]) * faceBlend;
    expressionActive = Object.keys(expression).some((key) => Math.abs(targets[key] - expression[key]) > 0.005);
    for (const x of [-7, 7]) {
      const side = x < 0 ? -1 : 1;
      const attention = clamp(look[0] * side, -1, 1) * 0.12;
      ctx.save();
      ctx.translate(x + gx, -3 + gy + attention);
      ctx.rotate(side * (0.04 + expression.smile * 0.05));
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.7 + expression.arch * 0.4, Math.max(0.45, 3.5 * expression.open * (1 - expression.arch * 0.84)), 0, 0, Math.PI * 2);
      ctx.fill();
      if (expression.arch > 0.05) {
        ctx.globalAlpha = expression.arch;
        ctx.beginPath();
        ctx.moveTo(-3.2, 0.5);
        ctx.quadraticCurveTo(0, -3, 3.2, 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = Math.max(expression.smile, mood === "alert" ? 1 : 0);
    ctx.beginPath();
    if (mood === "alert") ctx.ellipse(gx, 7 + gy, 1.6, 2.3, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(-3 + gx, 6 + gy);
      ctx.quadraticCurveTo(gx, 6 + expression.smile * 4 + gy, 3 + gx, 6 + gy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    if (hug || effort > 0) {
      ctx.strokeStyle = theme === "evening" ? "#b7b2e3" : "#596974";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      const distance = Math.hypot(...look) || 1,
        dx = look[0] / distance,
        dy = look[1] / distance;
      for (const side of [-1, 1]) {
        const px = -dy * side,
          py = dx * side;
        ctx.beginPath();
        ctx.moveTo(48 + px * 20 + dx * 12, 47 + py * 20 + dy * 12);
        ctx.quadraticCurveTo(
          48 + px * 27 + dx * 32,
          47 + py * 27 + dy * 32,
          48 + px * 10 + dx * (38 - effort * 4),
          47 + py * 10 + dy * (38 - effort * 4)
        );
        ctx.stroke();
      }
    }
  }
  return {
    change,
    pet,
    draw,
    active: () => morphing || body.active() || Boolean(softBody?.active()) || expressionActive || emotionActive,
    form: () => form,
    contact: () => ({ ...contact }),
    evidence: () => ({ ...body.evidence(), contact: { ...contact }, emotion: [...emotion], soft: softBody?.evidence() || null }),
  };
}
