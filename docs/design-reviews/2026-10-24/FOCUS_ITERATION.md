# Mobile Research Focus: give the agenda room to read

24 October 2026. One bounded implementation of the identity and attention guidance
in [the design review](DESIGN_REVIEW.md), [video adaptation](VIDEO_REVIEW.md), and
[canonical heuristics](../../../WEBSITE_DESIGN_HEURISTICS.md#visual-hierarchy).

## Observation and intended benefit

On the live homepage at 390 × 1000, the three Research Focus buttons occupied
112-pixel columns. Their labels rendered at 9.28 px and their titles at 11.52 px;
the supporting descriptions were hidden. The sketch immediately below occupied
350 × 265 pixels. The words explaining Sirui's Design/Evaluate/Situate agenda
were much smaller than the surrounding prose and the sketch they introduce.

The interpretation is an attention mismatch: the research framing should be
readable before someone chooses a sketch. This is a rendered observation and
design hypothesis, not evidence that visitors misunderstood Sirui.

## One change, within the existing language

Below 768 px, stack the same three native buttons into full-width rows. Use
14 px labels and 16 px titles, and give the selected row a 3 px start edge in the
existing time-of-day accent. Forced colors use the system Highlight color.
Keep the existing tonal surfaces, Inter, orange identity, coastal setting, copy,
button behavior, detailed explanations, and publication links.

Only the mobile Research Focus rules in `_sass/_home.scss` change. The research
sequence, homepage opening, papers, scene, scripts, and analytics collection stay
as they were. A smaller font adjustment within three columns was considered;
stacking gives the actual phrases enough width without continued microtype.

## Matched before and after

Baseline: live commit `0876a30ae7d6582f32d7dfae537ecd48a399a7d6`.
After: the local production build based on `ebfb1048d` with this mobile CSS change.
Both use the same viewport, theme, initial Design state, reduced motion, loaded
Inter fonts and images, and heading alignment below the fixed navbar.

| State          | Before                                                  | After                                                  |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Mobile noon    | [Full view](focus-evidence/before-mobile-noon.png)      | [Full view](focus-evidence/after-mobile-noon.png)      |
| Mobile evening | [Full view](focus-evidence/before-mobile-evening.png)   | [Full view](focus-evidence/after-mobile-evening.png)   |
| Noon controls  | [Control crop](focus-evidence/before-controls-noon.png) | [Control crop](focus-evidence/after-controls-noon.png) |

At 390 px, the control group changes from 350 × 82.391 px to 350 × 210 px.
Its three rows are 64, 66, and 64 px tall. The extra 127.609 px is the deliberate
tradeoff: the sketch and detailed lens move farther down the page in exchange
for readable choices. No content is removed to compensate.

The four matched states retain the same research-copy digest:
`08d411499b046b3d28ae250e2372cc9ac47ca70a14fd9d089b4ee6b273d3c88d`.
Desktop geometry and typography are unchanged. Raw observations are retained in
[before.json](focus-evidence/before.json) and [after.json](focus-evidence/after.json).

## Proportional verification

- The production Jekyll preview builds successfully.
- All four standard viewport checkpoint tests pass, each checking light and dark.
- Eight focused checks pass: 390 px in noon and evening, 320 px reflow, unchanged
  768/1280/1440 px geometry, no-JavaScript reading and publication access, and
  forced colors.
- Real touch and keyboard actions cycle through all three modes, repeat, and
  return. Pressed state, readout, status, and the active detail remain consistent.
- Mobile labels/titles compute to 14/16 px; every button exceeds the 44 px target.
  Keyboard focus is visible and distinct from selection. See [keyboard focus](focus-evidence/keyboard-focus.png)
  and [forced colors](focus-evidence/forced-colors.png).
- Minimum sampled text contrast is 8.08:1 in noon and 9.56:1 in evening (rounded).
  These samples check the affected control surfaces; they are not a sitewide
  accessibility certification.
- No horizontal overflow or runtime errors occur. Reduced motion retains the
  still diagram and its explanation; the ordinary publications route also works
  without JavaScript.

The [focused verification record](focus-evidence/verification.json) retains the
actual geometry, copy, actions, focus, and contrast samples.

## Decision and remaining uncertainty

Keep this bounded refinement: Sirui's existing agenda is readable at the same
scale as the surrounding language, with an inspectable selected state. The cost
is additional mobile scrolling. Actual comprehension, identity recall, and
preference remain unmeasured; a brief task with an unfamiliar reader is the next
useful check. No traffic or engagement change is attributed to this patch.
