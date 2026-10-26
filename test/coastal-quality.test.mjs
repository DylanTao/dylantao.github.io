import test from "node:test";
import assert from "node:assert/strict";
import {
  createQualityGovernor,
  initialTier,
  lowerTier,
  QUALITY_TIERS,
  requestedTier,
  targetMemory,
  TIERS,
} from "../assets/js/home-scene/quality.mjs";
import { createResolutionGovernor, detailFor, RESOLUTION_PROFILES } from "../assets/js/home-scene/resolution.mjs";
import { chooseLevel, reachFor } from "../assets/js/home-scene/detail-levels.mjs";

test("a device starts at standard, a compact touch screen low, and ?quality pins either", () => {
  assert.equal(initialTier({}), "standard");
  assert.equal(initialTier({ maxTextureSize: 16384, deviceMemory: 8 }), "standard");
  assert.equal(initialTier({ compact: true }), "low");
  assert.equal(initialTier({ maxTextureSize: 4096 }), "low");
  assert.equal(initialTier({ maxTextureSize: 16384, deviceMemory: 2 }), "low");
  assert.equal(initialTier({ maxTextureSize: 16384, cap: "low" }), "low", "a lost context restarts lower");
  assert.equal(initialTier({ cap: "standard" }), "standard", "a cap never raises the tier");
  assert.equal(initialTier({ compact: true, pinned: "high" }), "high");
  assert.equal(lowerTier("high"), "standard");
  assert.equal(lowerTier("low"), "low");
  assert.equal(requestedTier("?quality=high"), "high");
  assert.equal(requestedTier("?quality=ultra"), null);
  assert.equal(requestedTier(""), null);
});

test("each tier costs more than the one below it, in settings that no shader program depends on", () => {
  const keys = Object.keys(QUALITY_TIERS.standard).sort();
  for (const tier of TIERS) assert.deepEqual(Object.keys(QUALITY_TIERS[tier]).sort(), keys);
  const embed = (tier) => QUALITY_TIERS[tier].embed?.pixelBudget ?? RESOLUTION_PROFILES.embed.pixelBudget;
  assert.ok(embed("low") < embed("standard") && embed("standard") < embed("high"));
  for (const key of ["contactScale", "reflectionScale", "hazeSteps", "lodReach", "memoryBudget"])
    assert.ok(QUALITY_TIERS.low[key] < QUALITY_TIERS.standard[key] && QUALITY_TIERS.standard[key] < QUALITY_TIERS.high[key], key);
});

test("the standard tier leaves the resolution and every detail exactly as they were", () => {
  for (const [width, height, fullscreen, compact] of [
    [545, 461, false, false],
    [1500, 720, false, false],
    [3840, 2160, true, false],
    [2560, 1440, true, false],
    [585, 1266, true, true],
  ]) {
    const options = { width, height, fullscreen, compact, maxTextureSize: 16384, maxSamples: 4 };
    assert.deepEqual(detailFor({ ...options, tier: QUALITY_TIERS.standard }), detailFor(options), `${width}x${height}`);
  }
  for (const compact of [false, true]) {
    const plain = createResolutionGovernor({ compact, devicePixelRatio: () => 3, basePixelRatio: 1.5 });
    const tiered = createResolutionGovernor({ compact, devicePixelRatio: () => 3, basePixelRatio: 1.5 });
    assert.equal(tiered.setTier(QUALITY_TIERS.standard), false, "standard asks for no resize");
    for (const profile of ["embed", "fullscreen", "embed"]) {
      plain.setProfile(profile);
      tiered.setProfile(profile);
      assert.deepEqual(tiered.size(390, 700), plain.size(390, 700), `${profile}, compact ${compact}`);
    }
  }
  const level = { near: 4, fullscreen: true };
  assert.equal(
    reachFor(level, { bufferHeight: 900, fullscreen: true, reachScale: QUALITY_TIERS.standard.lodReach }),
    reachFor(level, { bufferHeight: 900, fullscreen: true })
  );
});

test("low and high move the budget, density, samples, shadow map, contact pass, mirrors and reach", () => {
  const dpr = { value: 2 };
  const g = createResolutionGovernor({ devicePixelRatio: () => dpr.value, basePixelRatio: 1.5 });
  const standard = g.size(1000, 480);
  assert.equal(standard.density, 1.5);
  assert.equal(g.setTier(QUALITY_TIERS.high), true);
  const high = g.size(1000, 480);
  assert.equal(high.density, 2, "a 4K screen's embed draws every device pixel");
  assert.equal(g.setTier(QUALITY_TIERS.low), true);
  assert.equal(g.size(1000, 480).density, 1.25);
  g.setProfile("fullscreen");
  assert.equal(g.evidence().budget, QUALITY_TIERS.low.fullscreen.pixelBudget);
  assert.equal(g.evidence().minFactor, 0.6);
  g.setTier(QUALITY_TIERS.standard);
  assert.equal(g.evidence().budget, RESOLUTION_PROFILES.fullscreen.pixelBudget, "standard restores the full-screen profile");

  const embed = { width: 2000, height: 960, maxTextureSize: 16384, maxSamples: 4 };
  const low = detailFor({ ...embed, tier: QUALITY_TIERS.low }),
    base = detailFor(embed),
    rich = detailFor({ ...embed, tier: QUALITY_TIERS.high });
  assert.deepEqual([low.samples, base.samples, rich.samples], [2, 4, 4]);
  assert.deepEqual([low.shadowMapSize, base.shadowMapSize, rich.shadowMapSize], [1024, 2048, 4096]);
  assert.ok(low.contactLongSide < base.contactLongSide && base.contactLongSide < rich.contactLongSide);
  assert.ok(low.reflection[0] < base.reflection[0] && base.reflection[0] < rich.reflection[0]);
  assert.equal(detailFor({ ...embed, maxTextureSize: 4096, tier: QUALITY_TIERS.high }).shadowMapSize, 2048, "4096 needs an 8192 texture limit");

  const levels = [{}, { near: 4 }];
  assert.equal(chooseLevel(levels, 0, { distance: 4.5, bufferHeight: 600, reachScale: 1 }), 0);
  assert.equal(chooseLevel(levels, 0, { distance: 4.5, bufferHeight: 600, reachScale: QUALITY_TIERS.high.lodReach }), 1);
  assert.equal(chooseLevel(levels, 0, { distance: 3.4, bufferHeight: 600, reachScale: 1 }), 1);
  assert.equal(chooseLevel(levels, 0, { distance: 3.4, bufferHeight: 600, reachScale: QUALITY_TIERS.low.lodReach }), 0);
});

test("render-target memory grows with pixels, samples and the shadow map", () => {
  const base = { width: 1000, height: 600, samples: 4, shadowMapSize: 2048 };
  assert.ok(targetMemory({ ...base, width: 2000, height: 1200 }) > targetMemory(base));
  assert.ok(targetMemory({ ...base, samples: 0 }) < targetMemory(base));
  assert.ok(targetMemory({ ...base, shadowMapSize: 4096 }) - targetMemory(base) === (4096 * 4096 - 2048 * 2048) * 16);
});

// Feed frames on a controllable clock.
function frames(governor, clock, count, intervalMs, gpuMs = null, { holding = false, submitMs = 4 } = {}) {
  let switched = null;
  for (let i = 0; i < count; i++) {
    clock.t += intervalMs;
    const next = governor.observe(intervalMs, gpuMs, { holding, submitMs });
    if (next) switched = next;
  }
  return switched;
}

test("measured GPU headroom promotes to high only while the view rests", () => {
  const clock = { t: 0 };
  const governor = createQualityGovernor({ now: () => clock.t });
  clock.t = 5000;
  assert.equal(frames(governor, clock, 120, 16.7, 3, { holding: true }), null, "never while the visitor moves");
  let reads = 0;
  const gpu = () => (reads++, 3);
  assert.equal(frames(governor, clock, 1, 16.7, gpu), "high", "the held evidence decides at the first resting frame");
  assert.equal(reads, 1, "the GPU time is read only when a decision is due");
  assert.equal(governor.tier, "high");
  const busy = createQualityGovernor({ now: () => clock.t });
  clock.t += 4000;
  assert.equal(frames(busy, clock, 120, 16.7, 9), null, "a GPU near its frame budget stays at standard");
});

test("a device without a GPU timer needs clearly fast frames to earn high", () => {
  const clock = { t: 5000 };
  const governor = createQualityGovernor({ now: () => clock.t });
  assert.equal(frames(governor, clock, 120, 16.7), null, "vsync-paced frames alone are not headroom");
  const fast = createQualityGovernor({ now: () => clock.t });
  clock.t += 4000; // past the settling time after the first view
  assert.equal(frames(fast, clock, 120, 8), "high");
  const unable = createQualityGovernor({ canPromote: false, now: () => clock.t });
  clock.t += 4000;
  assert.equal(frames(unable, clock, 120, 8, 1), null, "no promotion past the memory budget");
});

test("sustained slow GPU-bound frames demote one tier, and a demoted device is never promoted again", () => {
  const clock = { t: 5000 };
  const governor = createQualityGovernor({ tier: "high", now: () => clock.t });
  assert.equal(frames(governor, clock, 90, 60, 30), "standard", "one full window of slow frames");
  clock.t += 4000;
  assert.equal(frames(governor, clock, 120, 16.7, 2), null, "no promotion after a demotion");
  assert.equal(frames(governor, clock, 90, 60, 30), "low");
  assert.equal(governor.evidence().demoted, true);
  assert.equal(governor.evidence().history.length, 2);
});

test("slow frames spent in the page's own script keep their tier", () => {
  const clock = { t: 5000 };
  const governor = createQualityGovernor({ now: () => clock.t });
  assert.equal(frames(governor, clock, 200, 55, null, { submitMs: 48 }), null, "fewer pixels would not shorten them");
  assert.equal(governor.tier, "standard");
});

test("a pinned tier never changes, and a reset starts a clean window", () => {
  const clock = { t: 5000 };
  const pinned = createQualityGovernor({ tier: "low", pinned: true, now: () => clock.t });
  assert.equal(frames(pinned, clock, 200, 4, 1), null);
  assert.equal(frames(pinned, clock, 200, 90, 60), null);
  assert.equal(pinned.tier, "low");
  const governor = createQualityGovernor({ now: () => clock.t });
  clock.t += 4000;
  frames(governor, clock, 89, 60);
  governor.reset();
  assert.equal(frames(governor, clock, 89, 60), null, "the window refills after a reset");
  assert.equal(frames(governor, clock, 1, 60), "low");
});
