# Record source activation and cold onsen loading

October 2, 2026. These two narrow fixes preserve the approved public layout and shared record state.

## Reproduced defects and changes

- Discover a record with D, focus its card, press Enter, then focus **Listen on Spotify** and press Enter. The parent card previously canceled the anchor's native activation. `home.js` now handles Enter/Space only when the card itself is the event target. Card-root Enter still opens the card; the source opens its existing URL without changing the selected record or discovered cards.
- Start 3D at 18:35 Pacific and hold the selected avatar GLB request while the onsen loads. The new water adapter previously dereferenced the missing actor in a scheduled render. `controller.mjs` now requires an actor before marking the pool occupied. After release, one actor arrives, its 0.17 m obstacle is installed, water volume remains conserved, and reduced motion retains a composed still frame.

Both defects failed native browser checks before the fixes. The source-link failure timed out waiting for a popup; the delayed-avatar failure recorded the exact undefined-position error. The latter can recover after the avatar loads, so this is a premature render error rather than proof of a permanent loading failure.

## Accepted evidence

The ignored bundle lives in `.jekyll-cache/visual-qa/transport-review/`.

- Chromium source activation passes at 1440, 1280, 768 and 390 pixels, including actual Tab traversal, native Enter/popup activation and preserved selection.
- Chromium cold onsen arrival passes at the same four widths. `heartbeat-fixes` contains seven passing cases plus a desktop cold-load attempt that ran against the stale preview. The fresh desktop rerun and existing moving transport/pause/recovery case both pass in `heartbeat-final-desktop`.
- Mobile WebKit cold arrival and existing moving transport/pause/recovery pass in `heartbeat-final-webkit`. Source activation passes in `heartbeat-webkit-source`; mobile WebKit requires explicit link focus in this fixture before native Enter because its default Tab policy skips anchors. This does not prove sequential keyboard traversal in Safari with every system setting.
- 166 Python tests, targeted Prettier, style contract and diff checks pass. The Docker production build with `/al-folio` passes; its minified `home.js` matches the served preview. The 34 selected scene assets match source after rebuilding. The existing 80-entry override audit is unchanged.

`heartbeat-fixes.png` is a labeled board of actual before-loading and after-arrival screenshots at the same Pacific time. They represent different load stages, not a material redesign. Raw screenshots, failure traces and the initial delayed-download probe remain in the bundle. No new visual concepts were promoted while taste feedback is pending.

The primary numerical and rendering limits remain in [the transport checkpoint](../../coastal-transport-checkpoint.md); [record intent evidence](../record-intent-2026-10-02/README.md) covers the earlier shared-state corrections. This pass adds no public controls or new simulation claims.
