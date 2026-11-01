# CV section navigation, November 1

The desktop CV rail loses its white card, border and shadow. Regular-weight section labels have more vertical room and a slim active marker. At large widths the rail moves64px farther left while the reading column stays within6.4px of its earlier position. At1440 the rail is248px wide, so long labels fit without an awkward second line. All type uses existing compact roles.

The production-built CV route is checked in light/dark at1440,1280,768 and390. Native keyboard navigation, current-section state, mobile disclosure, print semantics and horizontal overflow pass. Final production captures at1440,2560 and390 include real theme settling and no CSS overlay; the prototype's initial transition-timing failure remains compressed. The paired older screenshots are controls, not the final source.

Only the CV layout class and scoped CV Sass change. Other section rails, CV content, PDF and mobile navigation stay under their existing contracts. The reviewed default-layout override is acknowledged. This packet is local acceptance; CI and deployed-body confirmation require their own release receipt.
