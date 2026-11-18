# Creative direction

Written by Claude on November 17, 2026, as the hand-over to Codex. Sirui asked that day for Claude to act as creative director and finish the design, and for Codex to be the engineer who builds it, "and in that process, also has its creative freedom of interpretation and execution while semi-respect your original goal, yet also try to interpret my original request".

So this file holds three things: who does what, the bar every frame is judged against, and the briefs. The list of open work with estimates, and Sirui's requests in his own words, stay in `docs/november-2026-takeover.md` ("The list" and "What Sirui has asked for"). Read those first. When a brief here and his words there disagree, his words win. Quotes here are lightly corrected for spelling; the verbatim words are in the takeover notes.

## Who does what

- **Sirui** owns the site and has the last word on taste. He judges frames, not code. Ask him for taste and for facts only he has; verify everything else yourself in the browser.
- **Codex on GPT-6.2 Astra, the lead.** The one agent this hands over to (Sirui, November 17: "consider you have one boss agent to hand over to"). It owns the website work end to end: the briefs (three.js and shaders, the Blender pipeline, the frontend), the writing and content passes with `.codex/skills/portfolio-writing-voice/SKILL.md`, the maintenance, and the analytics pipeline. It may hand mundane parts (branch triage, data refreshes, CI flakes, test upkeep, audits) to GPT-6.2 Sol subagents when Sol is available; on November 17 it was not.
- **Claude, creative director.** Wrote these briefs and is called in for direction and review: revising briefs after Sirui's verdicts, judging frames against the references, look and shader research where range matters (the painted world, the thermal view, the watercolour world), and reading diffs with fresh eyes.
- **A review across models.** Before a large change reaches `main`, the other model reads the diff and the frames. Each catches different faults.

**Creative freedom.** A brief gives a goal and a direction, not a specification. Change how, and even what, when it serves the goal and Sirui's words better. Write down what you changed and why in the takeover notes, and show the frames. Never change the mood: calm and beautiful, not eerie (his words, November 16).

**The loop for every piece.** Read his words and the brief, build the smallest version that can be judged, put frames on a labelled sheet beside the references, criticise it honestly, then show him. Record each round in the takeover notes. One representative view while iterating; the full matrix only at a checkpoint (AGENTS.md, "Proportional Visual QA").

## The bar

Sirui named these as the standard to reach and pass, and asked that they be remembered so he does not have to send them again. Take techniques, never the works: no copied frames, characters, tunes or textures. Credit a source in the Graphics Lab record (`_data/design_records/graphics-lab.yml`) when its technique is used. Keep the makers' names, so their newer work can be checked as models improve.

**Photoreal.** William Faucher's Unreal Engine scenes: `https://www.fab.com/sellers/William%20Faucher`, and the ocean he linked, Easy Waterscape (`https://www.fab.com/listings/ddd28113-6f59-4ba3-bf60-ad7b1920a547`): layered swell, foam where the water folds, run-up and surf along a coast, an underwater view, buoyancy.

**Made in code, by people using these models:**

1. **Jake Eaton**, paintings of several hundred thousand simulated brush strokes (`https://x.com/jkeatn/status/2119874018706874601`): a parking garage in a low band of warm sun, an empty stage with a ghost light, a container port in saturated colour. Light is the subject. Claude keeps local copies of the three outside the repo (`C:\Users\dylan\.claude\projects\c--dev-dylantao-github-io\memory\reference-images\`); never commit them.
2. **techfren**, a pelican riding a bicycle rendered headless in Blender (`https://x.com/techfren/status/2119926681716834440`): every mesh, rig and shader generated in Python, Cycles on the GPU, five shots with motion blur.
3. **Riley Brown**, "The Fable of Clawd", a two-minute film from one prompt (`https://x.com/rileybrown/status/2121642720045261185`, `https://www.youtube.com/watch?v=Bvb4DxB35MM`). It rented cloud GPUs. **Sirui does not want that: this PC's RTX 3080 Ti and Blender only.**
4. **Ebby Amir**, Van Gogh riding through his Starry Night as a game (`https://starrynightrider.com`).
5. **Blendi**, a painted browser game of about 1.5 million brush strokes a frame (`https://patch.gg/blendi/oil-paint`, code MIT, art CC0). The painted look takes its colour rule: each thing has a light, a half-tone and a shade mix.
6. **Noniv**, Abyssal Garden (`https://github.com/Noniv/abyssal-garden`, MIT): a kelp forest to swim through in one 96 KB file of raw WebGPU, about two million kelp leaves, light shafts, caustics, sound synthesised live, three detail levels. The bar for the sea in brief 7.
7. **rewind** (`rewind02` on X): a painted walk whose paint "turns from gouache into oil" as the sun goes down (`https://x.com/rewind02/status/2121991760825995575`); a walk where every step is heard (`https://x.com/rewind02/status/2121933776884269192`); Harbour Stack, a miniature harbour at dusk whose controls are the example for brief 5 (`https://x.com/rewind02/status/2118404190041235738`). Two lines to work by: "judge each frame like a painting, not a game", and "the brushstrokes hide what code-built shapes can't fake".
8. **Shoopy** (`0xShoopy` on X), fifteen free tools (`https://x.com/0xShoopy/status/2122346129715011960`). The ones that fit here: Blender (in use), CCapture.js for frame-exact capture of the film, Gaussian splats if a real place is ever scanned. Image and video models only on the local GPU.
9. A RedNote video of Claude making a classical oil painting in which the painted hand picks something up (`https://xhslink.cn/o/8Zr5xiVwNtH`). It shows a login page to a script; ask Sirui for a screenshot before drawing anything from it.

**The shows he named for the cartoon:** _Rick and Morty_, _Common Side Effects_ (thin even line, flat dusty colour, a few glowing accents), and _Spider-Verse_'s bold colour. **For the heat view:** a stop-motion film shot through a real thermal camera on a miniature reef, deep indigo to orange and white, every frame composed like a film still (takeover notes, J9).

**What they share.** Light is the subject. Ordinary places and people at work. Warm light against cool shade. Saturated local colour with crisp shapes. Deliberate, visible marks. Every frame composed like a still from a film. All of it made in code. Judge a frame beside these, never beside the previous frame.

## Briefs

In order of priority. Letters point to the sections of the takeover notes, where the estimates and the history are.

### 1. The painted world (J10)

**State.** Second pass shipped November 17 (`?look=paint`, or Painted in the lab menu at `?scene-lab=1`). Sirui: "oil painting style look good enough for me to push, we can keep iterating, but also ok to push something to public for feedback". The record entry `painted-strokes` says what it does and where it falls short.

**Direction.** A painting first, a game second. One motivated light per view and real darks. The views a visitor arrives at composed as a painter would compose them, with a place for the eye to rest. Paint follows form. The hour changes the manner of the paint as well as its colour.

**Next, in order.** Measure the GPU cost and scale stroke counts by device; check a phone. Quiet the streaky strokes in night interiors. Break up the single rose of the land at dusk with warmer lit faces and cooler turned planes. Mass the cliff's cast shadows so rough rock stops breaking them into islands. Paint the plants, the pool and the bath. Take stroke direction from curvature. Then a public look switch (H4). The homepage keeps two public controls today and a browser case holds it to that (`test/visual/desk-scene.spec.js`, "quiet public controls"). Change that contract on purpose, and update the case in the same commit.

### 2. The gym, used (O4)

**His words.** "don't waste the area ... a few different boxing bag etc, and a rowing and biking machine facing the ocean so i can do cardio while viewing ocean."

**Direction.** A training room that faces the sea. A rower and a bike side by side at the glass, each on its own mat, the sea filling the window in front of them. A bag corner on the dim side: a heavy bag on a beam, a double-end bag, a speed bag platform, gloves and wraps on a shelf, one warm pendant. Keep the rack and platform as they are. Machines are generic, made to real sizes in Blender like the rest of the house; copy no maker's design or mark.

**Life in it.** Rowing, riding and bag work as activities for every avatar, audited for a handle or a pedal through the body the way the bars were (H5). The heavy bag swings as a damped pendulum when struck and settles. The rower's fan and the bike's wheel spin down. Each machine has its sound once brief 6 exists.

**Done when** the room reads as used at 7 am and at 9 pm from the room view and from the sea, the light bake stays inside its triangle budget (B1), and the gym's browser cases pass.

### 3. The speakeasy and the glass lift (O5, O6)

**His words.** "leverage the empty area of the study room, maybe it can be a better decorated speakeasy bar and also the study room can also further go into that area, and the elevator go down from speakeasy to bottom"; "a transparent cliff elevator to go from the house to bottom of the cliff while appreciating the view from ocean". He ringed the solid rock to the right of the study, as seen from the sea.

**Direction.** A bookcase in the study swings open onto a low, warm room cut into the rock. A ribbed plaster vault; a back bar of brass and amber glass lit from below; a short counter with five stools; a banquette; a record player that plays his records; one slot of window at the level of the sea, framed like a painting. Warm pools of light and deep shade, never neon and never murky. The study itself grows a few metres into the rock with its own shelves.

From the speakeasy's landing a glass cab runs in a glass and steel shaft set into a notch in the cliff, down to the beach, about eight metres, ridden in walk mode with the sea in view all the way down. Lit at night as one line of light on the cliff.

**First** three massings on paper, rendered in Blender's workbench, before any export (the method of K1). **Open question for Sirui**, not decided: whether the shaft goes on below the tide line to a window under the water, which would join it to brief 7.

### 4. The bedroom, as a room (O7)

**His words.** "the bedroom can be bigger and much better well designed instead of just having a bed"; and on November 3, "when i am sleeping, my bedroom should maybe have curtain".

**Direction.** The bed set so the sea is the first thing seen on waking. A headboard wall with a niche and two reading lights. A chair and a small table at the glass. Somewhere to dress. A rug, planting, the curtain. Night light low and warm. Bigger means carving, so it goes in the same architecture pass as brief 3 and the arrival (K).

### 5. Moving through the house (Q)

**His words.** "the controllability of the visitor movement in 3d should be further improved", with Harbour Stack as the example: buttons for the hour, ways to move (orbit, walk, boat), and a bar of six named views, each with a title and a line of text.

**Direction.** First an audit, as a visitor would meet it: mouse, keys and touch; where turning, stopping, stairs, walls and getting back go wrong. Recorded from the browser, not read from the code. Then the fixes it ranks first. Likely candidates: tap a spot on the floor and walk there (the collision grid exists); a bar of named views; sliding along walls instead of stopping; a visible card of the controls; a thumb stick on touch screens. Later, a boat along the shore, which the film (N) can also use.

### 6. Sound and music (L3, L5)

**His words.** On a walk where every step is heard: the same "when people in our thing walk past grass, scroll, enter water, swimming". On the first synthesised sounds: "okish, maybe just use them in minor places". On music: violin first, then cello, piano, clarinet, guitar and a Bob Dylan style whistle; classical writing with the instrument feel of Bob Dylan and the Beatles; original music only.

**Direction.** Recorded quality or nothing. Steps change with the ground (stone, oak, sand, grass), plants are heard brushing past, wading and swimming have their own sounds, scrolling the page has one. Instruments modelled offline and rendered on this PC, checked by measurement (pitch, level, spectrum). One short piece goes to Sirui before anything is built wide. Sound stays off until the visitor turns it on.

### 7. La Jolla's sea under the surface (U)

**His words.** "later we can also study La Jolla local sea env". Later, and a study first: what lives off La Jolla and how it looks under the surface, from sources that can be cited (the kelp forest, fish and rays, the seals and sea lions already above the water, the rock and sand of the bottom, the water's clarity and colour by season). Then light shafts from a moving surface, caustics, swaying kelp, schools that turn together, drifting specks, and a crossing at the surface that reads as going under. Abyssal Garden is the bar; ours shares a frame with the house.

### 8. Learning from visitors (new, November 17)

**His words.** "are you able to track google analytics data for later data-driven self improvement ... if we have a pipeline to monitor visitor usage and iterate that will be great."

**What exists (confirmed November 17).** The site sends Google Analytics 4 events through `al_analytics` (`_config.yml`, measurement ID `G-L4SQ3C88KH`), gated by the cookie banner. Reading works: the property is `467687350` ("Sirui's Personal Website"), read through the service account `website-analytics-reader` in the Google Cloud project `luminous-byway-386322`, which has Viewer on the property; the Data and Admin APIs are on, and none of it costs anything. Each machine has its own key file in its Downloads folder, named `luminous-byway-386322-<key id>.json`. Point `GOOGLE_APPLICATION_CREDENTIALS` at it; never copy it into a repository, a commit, a log or a chat.

**What the first read showed.** Most of the users recorded in the last four weeks were our own test browsers: Playwright runs against the local preview report to the real property under the host `127.0.0.1` and paths starting `/al-folio/`, each a new user, seconds long. Real visitors are the host `dylantao.github.io`. Among them, desktop dominates; the homepage draws most visits, the CV holds attention longest, and the projects, blog and AI pages hold it briefly; referrals, search and AI assistants bring the most engaged sessions, and direct visits the least.

**Do first, in order.** (1) Filter every report to `hostName` `dylantao.github.io`. (2) Stop automation from reporting at all: do not load the tag on `localhost` or `127.0.0.1` or when `navigator.webdriver` is true, and stub it in every Playwright context, including scratch tools. (3) The weekly pipeline below. (4) Then read it for what to improve, starting with why the projects, blog and AI pages lose people so fast.

**Direction.** A read-only pipeline. A weekly script calls the GA4 Data API for aggregates only: views and engaged time per route, device class, country, entry pages, channels, and the 3D events below. It writes them to the private metrics repository, never to this public one, plus a short summary the agents read before choosing what to improve. On GitHub the key and the property ID are repository secrets. New events, all within consent: `scene_enter_3d`, `look_change`, `room_visit`, `walk_start`, `orange_roll`, `sound_on`. No personal data and no raw visitor rows anywhere public.

### 9. Later

Other worlds (watercolour, pencil, comic print, field guide, heat: J3 to J9), the film (N), and the worlds across the whole site (M) are in the takeover notes. The rule for all of them: a world is a contract, not a filter (notebook card "A world is a contract").

## Judging a frame

- The six views Sirui judges the painted look by: the coast at 3 pm, at dusk and at 9 pm; the living room at 3 pm and at 9 pm; the kitchen nook at 9 pm. Same views, same hours, labelled, side by side.
- In the lab (`?scene-lab=1`), the scene element exposes `setLabCamera({ target, yaw, pitch, radius, free })`, and `labScene.printLook` has `set(...)` and `evidence()`. Rooms and places are buttons (`[data-world-room]`, `[data-world-destination]`); fix the page clock to choose the hour. `bin/capture_footer_coast.cjs` captures the footer's sea.
- Check a capture's framing by number before showing it. Sirui sees every image and reads a broken test capture (a camera inside a wall, a half-built look) as the work.
- Ask of every frame: does it hold beside the references; is there one light and a real dark; is it composed; is it calm.

## Housekeeping on the PC

- **State on November 17, after a first pass.** Claude deleted six local branches whose merge into `main` changes nothing, with their three clean worktrees. Left: 42 branches whose merge would change `main`, 4 that add nothing but sit in worktrees with files that are not committed, and 20 worktrees. A worktree with uncommitted files needs Sirui's word before it is removed. Uncommitted work sits in `C:/dev/cqa1102`, `C:/dev/cqa1103`, `C:/dev/dqa1103`, the three under `C:/dev/site-takeover-worktrees/` and two under `C:/Users/dylan/.codex/worktrees/`. Most are October work, and much of it may have landed on `main` in another form. Triage: compare each with `main`, fold what is useful, and ask Sirui before discarding anything unmerged. Do not push them wholesale: some may hold material from a private study whose source must never be named or published. This has to happen on this PC, where they live.
- Follow AGENTS.md's end-of-batch rules: the code activity refresh, and never pushing the site while the nightly metrics task runs.
