# The todo list

Everything open on Sirui's site, in priority order, for any model on any machine. Started by Claude (Opus 5.5) on November 17, 2026. Keep it current: whoever works an item updates its **State**, adds what was learned under **Progress**, ticks what is done, and commits.

**Read first.** AGENTS.md, then `docs/creative-direction.md` (who does what, the reference works with links, and the briefs). Sirui's own words for every request are in `docs/november-2026-takeover.md`, "What Sirui has asked for"; where a brief and his words disagree, his words win. The mood is calm and beautiful, never eerie. Verify in the browser yourself before showing him anything, and never show him a broken capture.

**Machines.**

- **PC**, the desktop with the RTX 3080 Ti, Blender 4.5.9 and Docker. Claude (Fable 5.2 and Opus 5.5) runs there. Items marked **PC** need its GPU or Blender: renders, path tracing, Blender exports, GPU measurements.
- **Laptop**, where Codex on GPT-6.2 Astra leads, with Sol subagents when available. Everything else.
- Never rent cloud GPUs (Sirui, November 15). Each machine keeps its own Google Analytics key in its Downloads folder.

**Models** (Sirui's split, November 17). Astra leads and builds; Sol takes mundane parts; Claude directs, judges frames and does look research where range matters. The other model reviews any large change.

**Images.** `docs/images/` holds Sirui's own screenshots and our frames. Other people's works are linked, never committed.

## Open, in priority order

### 1. The painted world, from good to a masterpiece

- **State.** Second pass live: add `?look=paint` to the homepage and switch to 3D. Sirui, November 17: "oil painting style look good enough for me to push, we can keep iterating". GPU cost on the PC: 0.4 to 4.4 ms over the cartoon, 510 to 560 more draw calls.
- **Where it stands.** `docs/images/painted-second-pass-2026-11-17.jpg`, the six views he judges it by: the coast at 3 pm, dusk and 9 pm; the living room at 3 pm and 9 pm; the kitchen nook at 9 pm.
- **References.** Jake Eaton's stroke paintings, https://x.com/jkeatn/status/2119874018706874601 (light as the subject). Blendi's painted game, https://patch.gg/blendi/oil-paint (the colour rule; 1.5 million strokes a frame). rewind's painted walk, https://x.com/rewind02/status/2121991760825995575 (gouache by day, oil at sunset; "judge each frame like a painting, not a game").
- **Analysis.** The backgrounds read as paintings now. What separates them from the references is light and composition, not strokes: every view is lit as the realistic render lights it, so nothing in it is the subject. The land at dusk is one rose, night interiors carry loud streaks, rough rock breaks cast shadows into islands, and plants, the pool and the bath show the coat.
- **Next.**
  - [ ] Judge it on a real phone. (Scaling done November 17: touch screens and machines with at most 4 GB or 4 cores get half the strokes, `paintThin`; the `strokeThin` dial overrides. When a phone looks right, show the Rooms panel's look choice on touch screens too.)
  - [ ] One motivated light per view a visitor arrives at, with real darks.
  - [x] Quiet the strokes of night interiors (November 17: oil is only a little more broken than gouache now).
  - [x] Dusk: warm lit faces against cool turned planes (November 17: the afterglow warms only what looks toward it).
  - [ ] Mass the cliff's shadows. Tried November 17: doubling `shadowMass` (0.008 to 0.016) changed almost nothing, because the islands are not small cast shadows but the rough rock's own facets turning from the sun, shaded from each pixel's raw normal. Then, the same day: form is shaded from the surface's direction averaged over about a metre of the same thing, in the coat and the strokes, which cleared the speckles. The large shapes left are true cast shadows from overhangs; soften or mass those only if they still read as noise.
  - [x] The pool (November 17): the coat paints its surface as clear water over the floor, tinted by depth, with the sky on it where it is looked along, brushed cells and glints; strokes under it are left to it.
  - [x] The bath (November 17): the onsen's water, painted the same way, holding the room's warm light instead of the sky.
  - [ ] Paint the plants. Why they show only the coat: plants are instanced meshes marked `flora`, and water is see-through, so neither is scattered. How, as Claude reads it (November 17): plants get strokes scattered once per plant model in its own space and drawn with each instance's matrix (one stroke set per model, not per copy), shaded like land's scrub; the pool and the bath are flat water at known heights, so they can be painted like the sea (`seaPaint`), with strokes pinned to their planes, the bottom's tile showing through where shallow, and the room's light in the reflection. Start with the pool: one plane, the most seen.
  - [x] Strokes follow curvature (November 17: a rounded made thing is painted around its form where it bends faster than 2.5 radians a metre; boards, walls and posts keep their grain).
  - [x] A public look switch (H4), November 17: "Drawn as: Realistic / Painted" inside the Rooms panel, so the homepage keeps its two buttons. Hidden on touch screens until the paint is scaled for phones; then show it there too.
- **Fit.** Claude for the look and the judging; Astra for device scaling and the switch. **Machine:** any; frames from the PC are the steadiest.
- **Size.** 1.5 to 3 billion tokens; 3 to 5 weeks. **Detail:** brief 1; record entry `painted-strokes`; takeover J10.

### 2. Learn from visitors, then fix what loses them

- **State.** Reading works. Test browsers stopped reporting on November 17. `python bin/site_analytics_report.py` prints the last 28 days against the 28 before, real site only, and writes to a private folder. Click events for the 3D home and the orange have been sent since November 17.
- **His words.** "are you able to track google analytics data for later data-driven self improvement".
- **Analysis** (first read, aggregates only). Before November 17 most recorded users were our own test browsers. Real visitors come mostly on desktop. The homepage and the CV hold attention. The projects, blog and AI index pages are passed through in about fifteen seconds, which is what an index is for: `/projects` as the first page of a visit is among the best engaged. What loses people is arriving straight at a project page, DesignWeaver above all (about a quarter of those visits engage), and visits with no first page recorded, which look automated. The numbers are small (four weeks, a few hundred visitors); treat them as leads. AI assistants, referrals and search bring the most engaged visits. With a few hundred visitors a month, depth beats reach: make each page worth its visit.
- **Next.**
  - [ ] Run the report weekly on the laptop (Windows Task Scheduler), into the private folder.
  - Outbound clicks, 90 days: nearly all from the homepage (the lab sites, GitHub, and 22 downloads of the CV PDF counting the CV page). DesignWeaver's Paper, Code and Talk links drew two clicks each, so people who land there mostly leave without taking anything. Leads to test: how fast the cinematic page shows something, whether its first screen says what DesignWeaver is for a newcomer, and whether search and AI-assistant visitors expect the ACM paper.
  - [x] DesignWeaver's first paint, November 17: on a throttled phone its largest paint came at about ten seconds (other pages: about two), because the hero's faint mesh background was a 170 kB image that arrived last, behind fonts and full-size figures loading early further down. The mesh is now 32 kB and the figures below the fold load lazily. Re-measure on the live site and compare the page's engagement after a few weeks.
  - [ ] Find out what someone arriving straight at a project page wants (the paper, a video, a demo, the code) and give it to them on the first screen, starting with DesignWeaver. Then the index pages: does each lead somewhere worth going?
  - [ ] After two to four weeks, read the 3D events: how many enter 3D, which looks and rooms.
  - [x] Count the keys and the sound switch (November 17: V and F as `walk_start` and `scene_fullscreen` with `by: key`; the sound switch as `sound_change`).
- **Fit.** Astra for the pages and the writing; Sol for the schedule. **Machine:** the laptop, with its own key.
- **Size.** 0.3 to 0.6; a week, then ongoing. **Detail:** brief 8.

### 3. The gym, used

- **His words.** "don't waste the area ... a few different boxing bag etc, and a rowing and biking machine facing the ocean so i can do cardio while viewing ocean."
- **As it stands.** `docs/images/sirui-2026-11-16-gym-as-it-stands.png`.
- **Analysis.** A rack, a platform and a training screen, then dark empty floor. The sea is the reason to train in this room, so the cardio faces it and the bags take the dim side.
- **Next.**
  - [x] Plan on paper (November 17): `docs/house/gym-plan.md`.
  - [ ] Build in Blender to real sizes: rower and bike at the glass, bag corner with a heavy bag, a double-end bag and a speed bag.
  - [ ] Rowing, riding and bag work for every avatar, audited for a handle or a pedal through the body (H5).
  - [ ] The bag swings as a damped pendulum; the rower's fan and the bike's wheel spin down.
  - [ ] Judge at 7 am and 9 pm from the room and from the sea; keep the light bake inside its triangle budget.
- **Fit.** Astra builds; Claude judges frames. **Machine: PC** for Blender.
- **Size.** 0.3 to 0.5; 2 to 3 days. **Detail:** brief 2; takeover O4.

### 4. The speakeasy, a longer study, and the glass lift

- **His words.** "leverage the empty area of the study room, maybe it can be a better decorated speakeasy bar and also the study room can also further go into that area, and the elevator go down from speakeasy to bottom"; "a transparent cliff elevator ... while appreciating the view from ocean".
- **Where.** `docs/images/sirui-2026-11-16-house-at-night-speakeasy-and-lift.webp`: his orange ring is the dark rock right of the study, and his two lines run down to the beach.
- **Analysis.** A bar reached through a bookcase keeps the surprise the word speakeasy promises. The lift ties the house to the beach, and later perhaps to the sea below (item 9).
- **Next.**
  - [ ] Three massings on paper, rendered in Blender's workbench. Written November 17: `docs/house/speakeasy-massing.md` (behind the bookcase, along the cliff face, a half level down; recommendation: along the cliff face with the bookcase door). Render them next.
  - [ ] One chosen with Sirui.
  - [ ] Build the study's extension and the bar.
  - [ ] Build the lift and ride it in walk mode.
  - [ ] Ask Sirui whether the shaft goes below the tide line.
- **Fit.** Astra builds; Claude critiques the massings. **Machine: PC.**
- **Size.** 1.1 to 1.9 for both; about 2 weeks. **Detail:** brief 3; takeover O5, O6.

### 5. The bedroom, as a room

- **His words.** "the bedroom can be bigger and much better well designed instead of just having a bed"; November 3: "my bedroom should maybe have curtain".
- **Next.**
  - [ ] Plan: the bed facing the sea, a headboard wall with a niche and reading lights, a chair at the glass, somewhere to dress, a rug, planting, the curtain, low warm night light.
  - [ ] Build in the same architecture pass as item 4.
- **Machine: PC.** **Size.** 0.4 to 0.7; 3 to 5 days. **Detail:** brief 4; takeover O7.

### 6. The arrival that reveals the sea

- **His words** (November 14). "the current entrance to house is a weird squarely resolving stairs ... it can lead into the main living room area better and the main entrance at the lower floor living should also be better designed so we can see sea view and get the wow moment".
- **Existing work.** Codex built a straight arrival in October that was never merged. Its worktree `straight-arrival-20261101`, uncommitted changes included, is in the PC archive in OneDrive (item 16).
- **Next.**
  - [ ] Read that work.
  - [ ] Three massings.
  - [ ] Build with the stair hall as its own place (H7).
  - [ ] A first-visit walk from the portal.
- **Machine: PC.** **Size.** 0.6 to 1.0; about a week. **Detail:** takeover K, notebook card "An arrival that earns the sea".

### 7. Moving through the house

- **His words.** "the controllability of the visitor movement in 3d should be further improved".
- **Reference.** rewind's Harbour Stack, https://x.com/rewind02/status/2118404190041235738: hour buttons, ways to move (orbit, walk, boat) and six named views with a line of text each.
- **Next.**
  - [ ] Audit as a visitor, with mouse, keys and touch. A first pass with the mouse and keys on a desktop (November 17, from the outside view; one route, so treat as leads): orbit 0.46 degrees a pixel across and 0.34 up and down, which is in the usual range; tilt from -20 to 77 degrees; **zoom 17.5 percent a wheel tick, a little fast** (10 to 15 is usual), radius 1.6 to 160 m; walking 2.05 m/s; **Shift slows the walk (0.81 m/s) instead of running**; **walking into something stops dead** (no metre gained in five seconds of holding forward, no sliding along it); dragging in walk mode did not change the orbit's heading, which may be how it was measured (walk keeps its own heading), so check how a visitor turns while walking; Esc leaves walk mode. Touch is not audited yet.
  - [ ] Fix what ranks first: tap to walk, named views, sliding along walls, a card of the controls, a thumb stick.
  - [ ] Later, a boat along the shore.
- **Size.** 0.3 to 0.6; 3 to 5 days. **Detail:** brief 5; takeover Q.

### 8. Sound and music

- **His words.** On a walk where steps are heard: the same "when people in our thing walk past grass, scroll, enter water, swimming". On the synthesised sounds of November 15: "okish, maybe just use them in minor places". On music: violin first, then cello, piano, clarinet, guitar and a Dylan-style whistle; classical, with the feel of Bob Dylan's and the Beatles' instruments.
- **References.** rewind's walk with sound, https://x.com/rewind02/status/2121933776884269192; Abyssal Garden's live-synthesised sea, https://noniv.github.io/abyssal-garden/.
- **Next.**
  - [ ] Steps by ground; brushing plants; wading and swimming; scrolling. Recorded quality or nothing.
  - [ ] One short composed piece, checked by measurement, for his ears before anything wide.
- **Fit.** Claude for composition and direction; Astra for building it. **Machine:** offline renders on the PC.
- **Size.** 0.5 to 1.0 for the sounds; 1.5 to 3 for the music. **Detail:** brief 6; takeover L3, L5.

### 9. La Jolla's sea under the surface

- **His words.** "later we can also study La Jolla local sea env".
- **Reference.** Noniv's Abyssal Garden, https://github.com/Noniv/abyssal-garden, live at https://noniv.github.io/abyssal-garden/ (about two million kelp leaves in raw WebGPU; MIT).
- **Next.**
  - [ ] Study the place from citable sources: kelp, fish, rays, seals, the bottom, the water's colour by season.
  - [ ] Build: light shafts, caustics, kelp, schools, a crossing at the surface.
  - [ ] A way down (item 4's lift, or a swim).
- **Size.** 2 to 4; 4 to 8 weeks; the study in a day. **Detail:** brief 7; takeover U.

### 10. The photoreal bar

- **His words.** "can you use code and things and blender etc. to get to similar or better quality for things we have?"
- **References.** William Faucher, https://www.fab.com/sellers/William%20Faucher, and his Easy Waterscape, https://www.fab.com/listings/ddd28113-6f59-4ba3-bf60-ad7b1920a547.
- **Next.**
  - [ ] Our sea and shore beside the listing's images, with a written list of gaps, largest first (T1).
  - [ ] Close the largest gap and measure it (T2).
  - [ ] A path-traced reference of our own in Blender Cycles (T3).
- **Machine: PC.** **Size.** 0.1 for the side by side; 1 to 2 for the sea; 0.5 to 1 for the reference. **Detail:** takeover T.

### 11. The film

- **His words** (November 14). "a better mini-movie like experience", switching looks during a choreographed walk-through or drone flight, with the site's own music.
- **References.** Riley Brown's two-minute Blender film, https://www.youtube.com/watch?v=Bvb4DxB35MM (details: https://claude.ai/artifact/BkA6dzdGMx796WymCFpRyZ). techfren's headless Blender short, https://x.com/techfren/status/2119926681716834440. CCapture.js for frame-exact capture.
- **Next.**
  - [x] A shot list on one page (N1), November 17: `docs/film/shot-list.md` (nine shots, about two minutes).
  - [ ] A camera on rails over the live scene (N2).
  - [ ] Looks during the film (N3).
  - [ ] Sound to picture (N4).
- **Machine: PC** for overnight renders. **Size.** 1.5 to 3; 4 to 6 weeks. **Detail:** takeover N.

### 12. More worlds

- **His words.** A watercolour world that is "uniquely sirui ... vibrant color and wacky physics and expressive stroke"; pencil; the manners of _Common Side Effects_ and _Spider-Verse_; a thermal camera's view with real heat. "they should not just cheaply do a trivial shitty transform."
- **References.** Ebby Amir's Starry Night ride, https://starrynightrider.com. The shows themselves. A stop-motion film shot through a thermal camera (an Instagram reel; ask Sirui for a screenshot).
- **Next.**
  - [ ] A one-page rule sheet per world before any shader (J8). The watercolour world's is drafted: `docs/worlds/watercolour.md` (November 17); it waits for Sirui's eye.
  - [ ] Watercolour first, one room (J3).
- **Size.** 1 to 3 each. **Detail:** takeover J, notebook cards "A world is more than a filter" and "A world is a contract".

### 13. The house, designed further

- [ ] The top floor and its garden at night (O1).
- [ ] Under the pool (O2).
- [ ] Rooms the section buries (B2 step 2).
- [ ] The stair hall (H7).
- [ ] A bar through a body in the squat, bench and press, on every avatar (H5).
- [ ] A roof that visibly lifts (B2 step 3).

**Machine: PC.** **Size:** 0.15 to 0.5 each. **Detail:** takeover B, H, O.

### 14. The site's pages

- [ ] Every page read against the Design Review video's lessons (C).
- [ ] The throwable row on other rows (C7).
- [ ] Worlds across the whole site, later (M).

Item 2's data says where to start.

### 15. Research and speed

- [ ] The outside view at 2K (E1): three see-through surfaces cost a fifth of the frame.
- [ ] The sun's bounce in the sea-facing rooms (R2).
- [ ] The review panel as agents (I1, I2).
- [ ] A smaller light cache (S).

**Machine: PC** for measurements. **Detail:** takeover E, R, I, S.

### 16. Housekeeping

- [x] The PC archive in Sirui's OneDrive, `site-pc-archive-20261117`: 42 branches and the October worktrees' uncommitted changes, with a README. Keep it private; some may hold material from a private study that must never be published. Triaged November 17 (`TRIAGE.md` there): 35 branches are almost certainly superseded (they conflict with main, and main has rewritten every file they touched since), 4 add nothing, and 7 carry files main never got; those 7 were read the same day: what main never got is October review renders and notes, four small tests and one module from features that landed differently since. Nothing needs folding in; the archive is history.
- [ ] Follow AGENTS.md's standing rules: the end-of-batch code activity refresh, Google Scholar freshness, and never pushing during the nightly metrics run.
- [ ] Known CI flakes: takeover G.

## Done recently

- **November 17.** The painted world's second pass, then: calmer at night, a dusk with form, rock modelled as masses, strokes that wrap rounded things, half the strokes on phones and small machines, its GPU cost measured, and a public Realistic / Painted choice in the Rooms panel. Visitor data: reading works, test browsers no longer report, a report script, events for clicks, keys and the sound switch. DesignWeaver's first paint on a slow phone brought from about ten seconds toward the others' two (its background image 170 kB to 46 kB; figures below the fold lazy). The paper-accent generator renders again. The PC's 42 old branches archived in OneDrive and triaged: nothing needs folding in. The hand-over to Codex, and this list.
- **November 16.** The orange that rolls off the Page not found page into the footer's sea. Calm drawn looks. The painted world's first pass. A designed sea and sky. The cartoon's colour rebuilt.
- **November 15.** The footer's lit building reflected properly. The novelty passage in the research starter pack. A sound engine behind `?sound=1`, judged "okish".

## Progress notes

Add a dated line under the item you worked on, and keep the long story in the takeover notes' notebook, so this file stays a list.
