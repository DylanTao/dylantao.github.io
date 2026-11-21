# Desk recordings

_A Tugboat for Two_ and _All the Windows Open_ are original chamber pieces for Sirui’s homepage. The first trades short mandolin and banjo phrases above an offbeat guitar bass. The second begins with viola and guitar and grows into a rising violin coda. The instrumental parts use samples recorded by Philharmonia musicians. [Philharmonia samples and terms](https://philharmonia.co.uk/resources/sound-samples/)

The other two recordings are _A Pocketful of Sky_ and _Five Cuts in Pearwood_ from the coastal house. The links on each sleeve credit the artwork inspiration. [Coastal house recording credits](../coastal-score/CREDITS.md)

The [written scores and renderer](../../../bin/render_desk_records.py) use the same sample archive and stereo mix as the coastal house. With the Philharmonia Strings ZIP stored separately, run:

```powershell
python bin/render_desk_records.py --strings <path-to-Strings.zip> --review <private-review-folder>
```
