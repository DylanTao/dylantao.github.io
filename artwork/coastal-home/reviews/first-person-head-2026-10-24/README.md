# First-person head exclusion — 24 October 2026

This review closes the retained South Park extreme-down defect from the [first-person collar review](../first-person-collar-2026-10-24/README.md#retained-south-park-extreme-down-defect). Its scope is the primary Walk view. It makes no claims about physical-phone performance, mirror art direction or the broader scene roadmap. `artwork/` is excluded from the public Jekyll output.

## Diagnosis

The delivered Draco avatars were measured with `test/helpers/coastal-native-avatar.mjs`.

- **All five rigs bind the head rigidly.** Every vertex carries a Head-subtree weight (Head, EyeL, EyeR) of exactly 0 or 1, and no triangle mixes head and body.
- **The horizontal cut misses part of every head.** The cut sits at Head + 0.04 m (1.40 m) and removes what lies above it. Every style still has Head-owned triangles reaching below it.
  - South Park is the extreme case, and it produced the defect:
    - 13,653 skin triangles reach down to 1.209 m;
    - the 587-triangle mouth spans 1.318–1.396 m;
    - 752 tooth triangles sit in the shared `warm white` primitive.
  - In the other styles the leftovers are chins, lips and hair ends. They sit within a few centimetres of the cut, except Lizard's long hair, which reaches 1.236 m.

At the maximum reachable down-look (pitch −1.4), the visitor saw their own lower face:

- the whole mouth and teeth for South Park;
- a large chin dome for Simpsons and Rick and Morty;
- lips for Ghibli.

## Change

`assets/js/home-scene/walk-presence.mjs` builds a body-only index once per shared geometry. The index keeps every triangle except the rigid Head-owned ones. It is cached in a `WeakMap`, so a style switch reuses it and never re-uploads it.

While `withoutHead()` draws the primary view, the walking clone's meshes swap in that index in `onBeforeRender` and restore the full one in `onAfterRender`. A draw that throws mid-pass also restores it.

The swap reaches no other pass:

- three's shadow pass calls `onBeforeShadow`, not `onBeforeRender`, so the sun shadow keeps the whole head;
- mirrors draw outside `withoutHead()`, so they keep the whole person;
- the routine avatar shares the geometry but keeps its own hooks.

It also adds nothing:

- no shader programs or variants, so warmup is unchanged;
- no draw calls, no render passes, and no per-frame mesh work.

The plane cut, the collar liner and the measured optical anchor are unchanged.

The primary view also stops submitting the head's skinned triangles. In the native fixture's South Park down-look, triangles per render fall from 566,672 to 371,824. That is twice the 97,424 excluded, because the body is drawn twice in that render.

## Evidence

**Native fixture.** Run `native/capture.cjs`; the receipt is [native/evidence/evidence.json](native/evidence/evidence.json).

- It renders the delivered avatars with the real bathroom mirror module, controlled lights, and the actual full-avatar sun-shadow target.
- It covers all five styles, before (`excludeHead: false`) and after.
- Results:
  - the mirror-view pixel hash is identical before and after;
  - the sun-shadow hash is identical in all three views;
  - the shadow control is avatar-sensitive and restores exactly;
  - complete idle and walk cycles run with no GL, shader or page errors.
- Changed pixels in the down-looks:

  | Style          | Pitch −1.4 | Pitch −1.2 |
  | -------------- | ---------- | ---------- |
  | South Park     | 33.5%      | 32.8%      |
  | Simpsons       | 12.3%      | 2.7%       |
  | Rick and Morty | 9.6%       | 0          |
  | Ghibli         | 4.0%       | 0          |
  | Lizard         | 0.02%      | 0          |

- Captures:
  - South Park [before](native/evidence/south-park-down80-before.webp) / [after](native/evidence/south-park-down80-after.webp) / [after at −1.2](native/evidence/south-park-down69-after.webp);
  - Simpsons [before](native/evidence/simpsons-down80-before.webp) / [after](native/evidence/simpsons-down80-after.webp);
  - Rick and Morty [before](native/evidence/rick-and-morty-down80-before.webp) / [after](native/evidence/rick-and-morty-down80-after.webp);
  - Ghibli [after](native/evidence/ghibli-down80-after.webp).
- In every after image the shoulders, neck, hands and shoes remain, and the head's full shadow still lies on the floor.

**Unit tests.**

- `test/walk-presence.test.mjs` uses a synthetic rig and covers:
  - the primary-only swap;
  - full draws outside the scope;
  - an untouched shadow hook;
  - restoration after a failed draw;
  - cache reuse across a style switch.
- `test/walk-head-exclusion.test.mjs` uses all five delivered avatars and covers:
  - rigid bindings;
  - exact excluded and kept triangles per primitive;
  - South Park's mouth leaving entirely;
  - the shoes' 2,016 triangles and the neck, arms and hands' 29,822 triangles staying.

**Real house.** Run `house-check.cjs` against the complete root-served local build of `main`, with only the working `walk-presence.mjs` overlaid read-only. `NO_OVERLAY=1` runs the previous module as a control.

- Both runs pass at desktop 1440 × 1000 and touch 390 × 1000, with the Intel Arc D3D11 backend, full assets and quality, and native timers and RAF.
- Each run covers all five avatars in Walk at pitch −1.4. The actual primary draw camera looks down (forward Y = −0.985).
- Desktop also walks a short distance. Both runs then return to the routine, with the source shown again and no runtime errors.
- The control reproduces the defect: [desktop](house/desktop-south-park-down-before.webp), [mobile](house/mobile-south-park-down-before.webp).
- With the change, the mouth and teeth are gone, and the shoes, shoulders and neck remain: [desktop](house/desktop-south-park-down-after.webp), [mobile](house/mobile-south-park-down-after.webp). Also [Simpsons](house/desktop-simpsons-down-after.webp) and [Rick and Morty](house/desktop-rick-and-morty-down-after.webp).
- Receipts: [after](house/evidence-after.json) and [control](house/evidence-before.json).
- Lab placement stages a valid capsule pose at the Walk entry (the library desk). This does not add entrance-route claims.

Before adding an overlay to a script that calls the test helper `preparePage()`, note that its catch-all `page.route("**/*")` continues to the network. Playwright runs the newest matching route first, so register overlays after it. An overlay registered earlier is silently bypassed. The first run of this check loaded the old module this way and is not evidence.

## Deployed acceptance

The same `house-check.cjs`, run with `BASE_URL=https://dylantao.github.io/` and no overlays, passes against source `a7c8534e536a91d09303c5701364eec8deb23aa6`, served by Pages commit `c4a910d41f8dc5708e32876cc98862b7cd800139`.

- Desktop and touch both cover all five avatars, with the exclusion active, at pitch −1.4 with the draw camera looking down.
- Desktop also walks a short distance; the routine returns, and there are no runtime errors.
- Receipt: [live receipt](house/evidence-live.json). Captures: [desktop](house/live-desktop-south-park-down.webp), [mobile](house/live-mobile-south-park-down.webp).
- The first attempt began while Pages was still building, and its desktop half loaded the previous module from the CDN. Only the rerun is evidence.

## Limits

- Hair ends below the cut belong to the head, so first person now hides them in every style. Mirrors and shadows still show them.
- The fixture's presence-update timings were taken on a host shared with three parallel workers, and include the native pose update. The exclusion adds no work to `update()`.
- This is desktop Chromium and touch-viewport emulation on the Intel Arc D3D11 backend. It is not a physical phone or mobile Safari.
