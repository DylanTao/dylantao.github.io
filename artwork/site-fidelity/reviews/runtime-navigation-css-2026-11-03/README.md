# Runtime navigation and production CSS, November 3

The final audit found two concrete production failures: the CV sections control
scrolled away on phones, and the reading dock sat below the article. JavaScript
created both correctly, but publisher cleanup discarded their runtime selectors.
[The original processed baseline](runtime-navigation-baseline-v1/REPORT.json.gz)
measures both as `position:static`; the corresponding screenshots retain the
actual complete page at390px.

The extractor now recognizes actual `dataset` property names in shipped scripts
and retains their dashed attributes. One narrow prefix also preserves the
reading helper's constructed inline/dock variants. The original brand-state
retention and keyframes stay intact. No public copy, icon, palette, runtime
module, geometry, cache or data changes.

The actual pinnedPurgeCSS8.0.0processor reproduces the previous540,250-byte CSS
with SHA`44246a54…`; corrected output is544,293bytes with SHA`f81623d3…`, an
uncompressed4,043-byte increase. [Both complete outputs and rejected selectors](runtime-navigation-checkpoint-v2/POSTPROCESS.json.gz)
are retained. The processor tests include the original failing extractor and
an unused-selector control, so cleanup still removes unreferenced rules.

[The complete production build and unit gates](runtime-navigation-checkpoint-v2/UNIT-GATES.json.gz)
pass420Python tests,1,043Node tests with7existing skips, and the style contract.
The four-width checkpoint passes CV semantics/native links/print/no-script,
light/dark CV and DesignWeaver pages, and the full brand motion case. Sixteen
cases pass in[the main run](runtime-navigation-visual-v3/VISUAL.json.gz); the
four corrected[reading-dock cases](runtime-navigation-dock-v4/VISUAL.json.gz)
also pass. The original four failures remain retained: the first new assertion
asked for the dock over the hero, where it intentionally stays quiet. The
corrected test crosses an actual body heading, opens the fixed dock by keyboard,
and checks focus and the URL at the selected section. It does not alter product
visibility or JavaScript.

[Actual current390px measurements](runtime-navigation-after-v1/REPORT.json.gz)
show CV sticky at67.2px and the reading dock fixed within the viewport.
[Modern WebKit trusted-touch checks](runtime-navigation-webkit-v1/REPORT.json.gz)
also pass CV and reading navigation/focus, the persistent floating orange phrase,
and the native home reset. Device emulation is not a physical-iPhone result.
The coordinator inspected the actual before/after route screenshots.

[Producer corrections](runtime-navigation-final-v1/PRODUCER-CORRECTIONS.json.gz)
retain the failed mixed-CSS preparation, a routing404attempt and the too-broad
old-selector assertion. None is admitted as successful application evidence.
The final build uses every fresh owning CSS input and the complete HTML/JS/MJS
output; no application responses or styles are substituted during captures.

CI and exact live delivery of this repair remain a subsequent gate. The
preceding[room-metering publication](../../../coastal-home/reviews/room-metering-publication-2026-11-03/README.md)
is independently green and live. Review payloads are losslessly compressed with
original and compressed hashes in `MANIFEST.json`; earlier sealed packets stay
unchanged.
