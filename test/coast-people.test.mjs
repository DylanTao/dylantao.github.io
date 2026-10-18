// People on the footer coast: postures stay on their supports, paths and courts.
// Samples the pure pose module against the exported coastal manifest (bin/coastal_life.py).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCast, poseActor, actorParts, isVisible, stroll } from "../assets/js/footer-coast/people-pose.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/la-jolla/manifest.json", import.meta.url), "utf8"));
const figures = manifest.figures;
const TIMES = [0, 0.37, 1.1, 2.9, 4.6, 7.3, 11.9, 15.8, 23.4, 33.3, 47.2, 61.7, 97.1, 143.9];
const PERIODS = ["morning", "noon", "afternoon", "evening"];
const sole = (part) => part.a[1] - part.r;
const horizontal = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2];
  const len = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / len));
  return Math.hypot(p[0] - (a[0] + dx * u), p[2] - (a[2] + dz * u));
}
function pathHeight(path, p) {
  // Height of the nearest path segment under a point.
  let best = Infinity,
    height = path[0][1];
  for (let i = 1; i < path.length; i++) {
    const d = segmentDistance(p, path[i - 1], path[i]);
    if (d < best) {
      best = d;
      const a = path[i - 1],
        b = path[i];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[2] - a[2]) * (b[2] - a[2])) / (len * len)));
      height = a[1] + (b[1] - a[1]) * u;
    }
  }
  return { distance: best, height };
}

test("the manifest places every kind of person the coast promises", () => {
  const kinds = new Set(figures.map((f) => f.kind));
  for (const kind of ["tennis", "volleyball", "fire", "walker", "sitter", "surfer", "swimmer", "sunbather"]) assert.ok(kinds.has(kind), kind);
  assert.ok(
    figures.some((f) => f.dog),
    "a walker brings a dog to the beach"
  );
  for (const period of PERIODS)
    assert.ok(
      figures.some((f) => isVisible(f, period)),
      `${period} has people`
    );
  // The fire circle and its warmers appear only at night; sports only by day.
  assert.deepEqual(figures.find((f) => f.kind === "fire").when, ["evening"]);
  assert.ok(!figures.find((f) => f.kind === "tennis").when.includes("evening"));
});

test("every pose is finite at every sampled time", () => {
  const cast = createCast(figures);
  for (const t of TIMES)
    for (const actor of cast) {
      poseActor(actor, t);
      for (const part of actorParts(actor))
        for (const v of [...part.a, ...part.b, part.r, part.r2, part.r3]) assert.ok(Number.isFinite(v), `${actor.figure.id} at ${t}`);
    }
});

test("still frames are deterministic: the t = 0 pose repeats exactly", () => {
  const a = createCast(figures),
    b = createCast(figures);
  for (let i = 0; i < a.length; i++) {
    poseActor(a[i], 0);
    poseActor(b[i], 13.7);
    poseActor(b[i], 0);
    assert.deepEqual(
      actorParts(a[i]).map((p) => [...p.a, ...p.b]),
      actorParts(b[i]).map((p) => [...p.a, ...p.b]),
      a[i].figure.id
    );
  }
});

test("standing and walking feet rest on their ground and never sink into it", () => {
  const cast = createCast(figures);
  for (const actor of cast) {
    const f = actor.figure;
    if (!["walker", "tennis", "volleyball"].includes(f.kind)) continue;
    let planted = 0;
    for (const t of TIMES) {
      poseActor(actor, t);
      actor.people.forEach((h) => {
        const ground = f.kind === "walker" ? pathHeight(f.path, h.root).height : f.court.center[1];
        const lowest = Math.min(sole(h.parts.footL), sole(h.parts.footR));
        assert.ok(lowest >= ground - 0.006, `${f.id} foot sinks ${(ground - lowest).toFixed(3)} at ${t}`);
        assert.ok(lowest <= ground + (f.gait === "run" ? 0.12 : 0.05), `${f.id} floats ${(lowest - ground).toFixed(3)} at ${t}`);
        if (lowest <= ground + 0.012) planted++;
      });
    }
    assert.ok(planted >= TIMES.length * 0.5, `${f.id} keeps a foot on the ground most of the time`);
  }
});

test("seated people sit on the seat with their feet on the ground", () => {
  const cast = createCast(figures);
  for (const actor of cast) {
    const f = actor.figure;
    const seats =
      f.kind === "sitter" ? [{ seat: f.at[1], feet: f.feet }] : f.kind === "fire" ? f.seats.map((s) => ({ seat: s.at[1], feet: f.center[1] })) : null;
    if (!seats) continue;
    for (const t of TIMES) {
      poseActor(actor, t);
      actor.people.forEach((h, i) => {
        const { seat, feet } = seats[i];
        const hips = Math.min(h.parts.thighL.a[1], h.parts.thighR.a[1]) - h.parts.thighL.r;
        assert.ok(Math.abs(hips - seat) < 0.02, `${f.id} hips ${hips.toFixed(3)} on seat ${seat.toFixed(3)}`);
        for (const foot of [h.parts.footL, h.parts.footR]) {
          assert.ok(sole(foot) >= feet - 0.006, `${f.id} foot below ground at ${t}`);
          assert.ok(sole(foot) <= feet + 0.03, `${f.id} foot dangles ${(sole(foot) - feet).toFixed(3)} at ${t}`);
        }
        // Knees bend: a seated thigh runs forward rather than down a straight leg.
        const knee = h.parts.thighL.b,
          hip = h.parts.thighL.a;
        assert.ok(knee[1] > hip[1] - 0.08, `${f.id} knee drops below a sitting thigh`);
      });
    }
  }
});

test("by the fire, warmers hold their hands toward the flames", () => {
  const [actor] = createCast(figures.filter((f) => f.kind === "fire"));
  const center = actor.figure.center;
  for (const t of TIMES) {
    poseActor(actor, t);
    actor.figure.seats.forEach((seat, i) => {
      const h = actor.people[i];
      if (seat.action !== "warm") return;
      for (const hand of [h.parts.handL.a, h.parts.handR.a])
        assert.ok(horizontal(hand, center) < horizontal(seat.at, center) - 0.15, "hands reach toward the fire");
      assert.ok(Math.min(h.parts.handL.a[1], h.parts.handR.a[1]) > center[1] + 0.1, "hands stay above the flames' base");
    });
    // The roaster's marshmallow hangs over the fire.
    const [, mallow] = actor.props;
    assert.ok(horizontal(mallow.a, center) < 0.3, "marshmallow over the fire");
  }
});

test("the tennis rally: the ball clears the net, bounces in court, and meets a racket", () => {
  const [actor] = createCast(figures.filter((f) => f.kind === "tennis"));
  const { center, length, width, net } = actor.figure.court;
  const ball = actor.props[4];
  let prevSide = null,
    contacts = 0;
  for (let i = 0; i <= 600; i++) {
    const t = i * 0.025;
    poseActor(actor, t);
    const u = ball.a[0] - center[0],
      v = ball.a[2] - center[2],
      h = ball.a[1] - center[1];
    const side = Math.sign(u);
    if (prevSide !== null && side !== prevSide) assert.ok(h > net + 0.03, `ball clears the net at ${t.toFixed(2)} (${h.toFixed(3)})`);
    prevSide = side;
    assert.ok(Math.abs(v) <= width / 2, "ball stays between the sidelines");
    if (h < 0.035) assert.ok(Math.abs(u) <= length / 2, "the bounce lands in court");
    // Contact: the ball is at a racket head.
    for (let p = 0; p < 2; p++) {
      const head = actor.props[p * 2 + 1];
      if (Math.hypot(head.a[0] - ball.a[0], head.a[1] - ball.a[1], head.a[2] - ball.a[2]) < 0.07) contacts++;
    }
    actor.people.forEach((player, p) => {
      const pu = player.root[0] - center[0];
      assert.ok(p === 0 ? pu < -0.4 : pu > 0.4, "players stay on their own side");
      assert.ok(Math.abs(pu) <= length / 2 + 0.45 && Math.abs(player.root[2] - center[2]) <= width / 2 + 0.3, "players stay on the court");
    });
  }
  // 15 seconds hold 12 shots; each should be met by a racket.
  assert.ok(contacts >= 10, `rackets meet the ball (${contacts} contact frames)`);
});

test("walkers stay on their paths, pause to look at the sea, and the dog keeps close", () => {
  const cast = createCast(figures.filter((f) => f.kind === "walker"));
  for (const actor of cast) {
    const f = actor.figure;
    let paused = 0;
    for (let i = 0; i < 400; i++) {
      const t = i * 0.73;
      poseActor(actor, t);
      for (const h of actor.people) assert.ok(pathHeight(f.path, h.root).distance < (f.pair ? 0.13 : 0.02), `${f.id} leaves its path at ${t}`);
      if (stroll(actor.path, f.speed, f.pause, f.start ?? 0, t).weight === 0) paused++;
      if (actor.dog) {
        const d = horizontal(actor.dog.root, actor.people[0].root);
        assert.ok(d > 0.12 && d < 0.75, `dog distance ${d.toFixed(2)} at ${t}`);
        const paws = ["legFL", "legFR", "legBL", "legBR"].map((k) => actor.dog.parts[k].b[1]);
        const ground = pathHeight(f.path, actor.dog.root).height;
        assert.ok(Math.min(...paws) >= ground - 0.005 && Math.min(...paws) < ground + 0.03, "the dog's paws touch the sand");
      }
    }
    assert.ok(paused > 0, `${f.id} pauses at the ends of its walk`);
  }
});

test("people never walk through each other", () => {
  const cast = createCast(figures);
  const bodies = (actor) => [...actor.people.map((h) => h.parts.torso.a), ...(actor.dog ? [actor.dog.root] : [])];
  for (const period of PERIODS) {
    const shown = cast.filter((a) => isVisible(a.figure, period) && a.figure.kind !== "surfer");
    for (const t of TIMES) {
      for (const a of shown) poseActor(a, t);
      for (let i = 0; i < shown.length; i++)
        for (let j = i + 1; j < shown.length; j++)
          for (const p of bodies(shown[i]))
            for (const q of bodies(shown[j])) {
              if (Math.abs(p[1] - q[1]) > 0.6) continue;
              assert.ok(horizontal(p, q) > 0.3, `${shown[i].figure.id} and ${shown[j].figure.id} overlap in the ${period} at ${t}`);
            }
    }
  }
});

test("surfers stay on their boards and the swimmer stays in the water", () => {
  const cast = createCast(figures.filter((f) => f.kind === "surfer" || f.kind === "swimmer"));
  for (const actor of cast) {
    for (const t of TIMES) {
      poseActor(actor, t);
      const h = actor.people[0];
      if (actor.figure.stance === "ride") {
        // Board frame: feet on the deck, along the board.
        for (const foot of [h.parts.footL, h.parts.footR]) {
          assert.ok(Math.abs(sole(foot) - 0.043) < 0.01, "rider's feet on the deck");
          assert.ok(Math.abs(foot.a[0]) < 0.4 && Math.abs(foot.a[2]) < 0.12, "rider's feet stay on the board");
        }
      } else if (actor.figure.stance === "wait" || actor.figure.stance === "paddle") {
        const hips = h.parts.thighL.a;
        assert.ok(hips[1] > 0.03 && hips[1] < 0.15, `${actor.figure.id} rests on the deck`);
      } else {
        assert.ok(h.parts.head.a[1] > h.root[1] - 0.01 && h.parts.head.a[1] < h.root[1] + 0.12, "swimmer's head at the surface");
      }
    }
  }
});
