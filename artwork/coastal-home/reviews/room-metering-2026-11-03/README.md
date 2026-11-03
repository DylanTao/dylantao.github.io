# Room-subject metering, November 3

The bedroom's authored orbit camera sits outside the finite sleep light cage.
The [preceding published daylight repair](../daylight-transport-2026-11-03/README.md)
therefore leaves that view too dark. The room view now meters its authored
subject. Walk, free look and coast views still meter the actual eye. Turning
toward a lamp cannot change the target. The1.8×cap,0.65-second adaptation,
physical source powers, weak-moon transport and renderer paths stay unchanged.

## Local acceptance

- The [owning cache readback](validation/CACHE-READBACK.json.gz) is exact against
  `116bcc675`: every transport, moment and probe value plus configuration and
  manifest body remains identical. Only the controller/exposure dependency
  fingerprints change. The new official cache is `05515f73…`,712,558bytes and
  186,925gzip. No geometry, triangle budget, GPU texture, shader or visitor ray
  is added. This is camera presentation, not additional light energy.
- [The complete production build](validation/BUILD-GATES.json.gz),
  [420Python/1,048Node cases](validation/UNIT-GATES.json.gz) and style contract
  pass; seven existing Node skips remain. The bedroom outside-cage regression,
  first-person/coast/invalid-subject fallbacks, bounded/scale-invariant exposure
  and time-based adaptation are covered.
- [The desktop GPU/loading/navigation cases](validation/TARGETED-VISUAL.json.gz)
  pass, with [laptop/tablet/mobile public navigation](validation/NAV-VIEWPORTS.json.gz)
  completing the four-width check. Real Rooms-to-Walk transitions assert eye
  metering at the actual camera position. Existing registered cases are extended;
  no new scene roster entry is introduced.
- `native-rooms` and `webkit-rooms` retain six complete authored rooms by day
  and evening, plus exact streamed-byte readback without response substitutions.
  Native Chromium uses requested high/fixed detail. Phone-size modern WebKit
  uses automatic standard/adaptive detail: its copied high/fixed prose is wrong,
  and the [explicit caption correction](controls/SUBJECT-PHONE-CAPTION-CORRECTION.json.gz)
  binds the actual per-view state without rewriting the original report. These
  are visual/function checks, not physical-phone or frame-time acceptance.
- `controls/subject-metering-v1` retains the earlier disclosed single-controller
  private experiment. Final production views above use the actual complete
  build and official owning cache; they do not substitute that prototype.

The actual bedroom walls, bedding, floor and gym equipment become easier to
read. The living room retains its direct-sun shadows and material texture;
evening remains darker and warm. This closes the observed camera-cage metering
defect. It does not claim converged solar interreflection, a general graphics
speedup or completion of the separate cliff/arrival/garden and coffee work.

Publication and a finished-build physical-iPhone comparison remain separate.
Exact machine/source payloads are losslessly gzipped; `MANIFEST.json` binds
compressed and original bytes. Copied producers retain their original QA paths
and need fresh source binding before replay. Earlier sealed packets are intact.
