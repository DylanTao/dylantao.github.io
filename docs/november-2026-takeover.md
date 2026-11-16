# November 2026 takeover: resume here

Claude (Fable 5.2) picked the site up from Codex on November 13, 2026, after Codex ran out of tokens mid-batch. This file is the running todo list and notebook for that takeover. The [October handoff](october-2026-handoff.md) stays the history; this file says what is open now, what was tried, and what the next model should do first.

Sirui's request, in his words: finish the unfinished todos, check the site's own open-problem lists, critique and improve the design with the lessons from [YC's Design Review with Marvin Schwaibold](https://youtu.be/eojywvxqoLc), try the Graphics Lab's research queue for real, make the 3D scene better and faster, "be fun and record todos and notes as you go along."

## How to read this file

- **The list** is the whole plan on one screen, and **What Sirui has asked for** keeps his requests in his own words. Read both first; update the list whenever a section changes.
- **Todo** is the live checklist. `[x]` means verified with the evidence named beside it. `[ ]` with a **Best effort** note means a real attempt fell short; the note says why and what to try next.
- **Notebook** holds the lessons, in the October studio log's card format (frame, dimensions, move, backtalk, reframe).
- Nothing here claims "photoreal" or "state of the art" unless a measurement on this scene says so.

## Where the first session stopped (November 13, about 10:40 Pacific)

Sirui asked for a wrap-up to save tokens. Everything below is committed and pushed to `main`; nothing is left half done in the working tree.

**Shipped this session**

- Codex's dinner fix, CI timeouts and the first-scene budget correction (A1 to A3).
- The house: a court garden with its own lantern light in the bay under the bedroom (B1); the cut rock under the lifted roof drawn as hatched section material (B2 steps 1 and 1c); a whole-home orbit that can no longer enter the cliff (B2 step 1b).
- The site: three homepage and project-card fixes from the design review, and a video row a mouse can throw (C1 to C7).
- An experimental print treatment of the 3D home, off unless `?print=1` (R3).
- Two new rows on the Graphics Lab page and its record, and corrections to stale record entries.

**Check first next time**

1. CI for the last push. The visual workflow takes about an hour over 46 jobs. If only desktop-1440 `scene-rooms` fails on time, re-run that job (section G).
2. Sirui has seen none of this session's visual work. His eye is the open gate on the garden (day, night and a phone), the hatched section, the orbit limits and the print treatment. `?print=1` on the homepage, then 3D, shows the print.
3. The code-activity refresh: the scheduled refresh landed just before the first push, so nothing was owed.

**Next, in the order I would take them**

1. Ask Sirui for the view where he saw the hard sunlit edge in the study (B3). Two looks at noon did not find it.
2. The print treatment at dusk and night, and a phone (R3). The colourways for those hours have never been looked at on a frame.
3. The rock above the cut, only if Sirui still sees leftover masses now that the orbit keeps to the open side (B2 step 2). It is the largest item: a split of the cliff mesh and a full shell export.
4. Lift the lid (B2 step 3). A first try at drawing the lifted roof as a floating outline read as scratches, not as a roof: the roof solids are cliff-shaped, so their rims are ragged. A plain rise-and-fade of the real pieces is the remaining idea.
5. The transmission copy experiment (E1), and the sun-bounce measurement (R2).

## The list

Sirui, November 14: "show me a high level list of the todos ... so we can align that you didn't forget anything or lost anything between session change ... it is ok that the task is hard ... as long as we write that down, we can just keep pushing with every week's token ... but i don't want to keep re-explain myself."

This is that list. It is the first thing to read and the first thing to update. Letters point to the sections under "Todo"; the detail and the evidence live there. Nothing here needs to finish in one session.

**How this is checked** (Sirui, November 14: "could you do more automated testing in browser instead of asking me a lot, could be more autonomous")

I look myself, every session, before reporting: contact sheets of each look in the coast, section and room views at noon, dusk and night, at desktop and phone sizes; the flash recorder with the visitor's adaptive quality on (`bin/record_coastal_flashes.cjs --query=quality=auto`); the browser cases. Sirui is asked only for taste once something is worth his time, and for facts only he has. Nothing is "waiting on him" to be verified. Before a push that touches the frame loop or scene timing, the affected browser cases also run under CI's slow clock (section G, November 15).

**The standard** (Sirui, November 14, with a hand-painted browser game as the bottom line): "now your work in different styles feel sloppy and fuzzy, like you just apply a cheap filter ... i want a well crafted experience, where details are crisp but just give a whole new different vibe and physics, aesthetics etc, and ui ux all adapt the new style, as well my character". Version 1 of the cartoon and the woodblock do not meet it. Nothing in "Looks and worlds" counts as shipped until it does.

**The house**

| What                                                                                                                                    | State                                                                | Where      |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
| Garden under the bedroom, with its lantern                                                                                              | shipped                                                              | B1         |
| Cut rock drawn as hatched section; whole-home orbit kept out of the cliff                                                               | shipped                                                              | B2         |
| Bars loaded his way, his warm-up, deadlift clear of the legs                                                                            | shipped                                                              | H2, H3, H6 |
| Lamps ease between rooms; no blank frame when the resolution adapts (the flash)                                                         | shipped                                                              | H7         |
| **The section still buries rooms: the gym, the bedroom's bath, part of the library and upper floor** (what he sees as "weird geometry") | measured; the night tone is fixed; the carving goes with the arrival | B2 step 2  |
| The top floor: its subtle lighting and its garden                                                                                       | open: a design pass                                                  | O          |
| Under the pool: structure that looks designed and engineered                                                                            | open: a design pass                                                  | O          |
| **The arrival: a stair that leads into the living room and reveals the sea**                                                            | **next big piece; options to mass first**                            | K          |
| The stair hall as its own place; shadow refit at doorways; curtain over the lens                                                        | open                                                                 | H7         |
| The same bar-through-body audit for squat, bench and press, on every avatar                                                             | open                                                                 | H5         |
| A roof that visibly lifts                                                                                                               | open                                                                 | B2 step 3  |
| Hard sunlit edge in the study                                                                                                           | not found twice; closed unless seen again                            | B3         |
| Light bake at 736,041 of 750,000 triangles                                                                                              | watch before adding geometry                                         | B1         |

**Looks and worlds**

| What                                                                           | State                                                                                                                                                              | Where  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Cartoon and woodblock as two settings of one pass, switch in the lab menu      | version 1, judged by him: "fuzzy", "vague", "too similar"                                                                                                          | H1, R3 |
| Give looks the scene's structure: surface direction, object identity, distance | built for the cartoon; costs about 28 % more draw calls while on                                                                                                   | J1     |
| The cartoon done properly, with the craft list                                 | lines and fills now come from structure and are crisp; shading is three hard steps; **waits for his eye**; designed shadows, material colour and timing still open | J2     |
| A one-page rule sheet per world before any shader                              | next                                                                                                                                                               | J8     |
| Watercolour: the one that is uniquely his; one room first                      | open; starts with choosing its parents                                                                                                                             | J3     |
| Pencil; comic print; field guide                                               | open                                                                                                                                                               | J4-J6  |
| Heat: a thermal camera's house, with a real heat model                         | designed, not built                                                                                                                                                | J9     |
| His own figure and a companion for each world; physics and timing per world    | open                                                                                                                                                               | J7     |
| A look switch for visitors; dusk, night and phone checks                       | after he approves a look                                                                                                                                           | H4, R3 |
| Worlds across the whole site: tokens, skins, behaviours, states                | later; one world on one page first                                                                                                                                 | M      |
| The film: a choreographed tour of the house, any look, with music              | designed on paper                                                                                                                                                  | N      |

**Sound**

| What                                                                                           | State                                                      | Where  |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| An engine and a switch, off until asked; eight interface sounds; a key and a bed for each hour | built and pushed behind `?sound=1`; **waits for his ears** | L1, L2 |
| The house's own sounds; a timbre per world; sonifications                                      | open                                                       | L3, L4 |

**The site's pages**

| What                                                                               | State                                   | Where |
| ---------------------------------------------------------------------------------- | --------------------------------------- | ----- |
| Homepage and project-card fixes; a row a mouse can throw                           | shipped                                 | C1-C7 |
| Every page read against the video's lessons (one thing per section, motion, story) | homepage and first screens only         | C     |
| The throwable row on other rows; one style and feel across the site                | open                                    | C7    |
| The footer: the lit building's reflection in the water does not match it           | shipped November 15                     | P     |
| The open-problem lists on the public record pages, worked through                  | two stale entries left; the rest unread | F     |

**Research and speed** (Sirui, November 14: "focus on those that will auto-research process improve our 3d quality and performance and also how to make the website great and enhance the whole experience. prioritize those first, like music is also part of those")

| What                                                                             | State                         | Where  |
| -------------------------------------------------------------------------------- | ----------------------------- | ------ |
| The outside view at 2K (about 15 frames a second): the passes, not small objects | one experiment named, not run | E1     |
| The sun's bounce: measure it in the sea-facing rooms before any network          | open                          | R2     |
| Fixed-point water                                                                | parked: nothing to gain       | R1, S  |
| The panel as separate agents; one command that reports his numbers               | open                          | I1, I2 |
| A smaller light cache from a small quantized network                             | idea                          | S      |

**Keeping the record**

- This file first, then the memory notes, then the Graphics Lab record when something ships.
- Every push: watch all CI jobs; section G lists the known flakes.

## What Sirui has asked for, in his words

So he does not have to say it twice. Dated; newest last. The list above says where each stands.

- **November 3 (phone review, via Codex):** the study "looks brighter, still a tiny bit sharp divide of where sun is shining"; "some weird geometry curving"; "when i am sleeping, my bedroom should maybe have curtain"; "breakfast nook can be extended and fill the space under the bedroom with some nice and comfy plant surrounding"; screenshots of "sharp big empty curving or geometry removal".
- **November 13, first message:** finish Codex's todos; check "the unfinished todo list on website"; "site critique and improvement" from the Design Review video, where "each section of the page should be about one thing" and "even subtle motions are well designed"; "try the auto-research task in the graphics lab to see if you can beat sota and also make the 3d scene we have even better in quality and more performant"; "be fun and record todos and notes as you go along".
- **November 13:** use Blender, the browser, Docker, the 3080 Ti, local models: "unlimited electricity ... limited weekly token"; "animation things like disney or sony spiderverse quality"; non-photoreal rendering done well this time; better design "everywhere in my website, in the 3d scene and beyond" from graphics, art history, illustration, 2D animation, architecture, film, UX and storytelling; "record and iterative and improve and write ideas down as you go"; "you are sorta like an auto-evolving agent of sirui's creative ideas".
- **November 13:** study the Blossom carousel, "make sure ours is even better", leave room for "our own effects and motions"; "make the whole website sync and coherent in style and vibe".
- **November 13, after the print:** "maybe a bit more rick and morty vibe, it is a bit too grim"; the plates: "two blue 45 plate for leg things and for bench, i do the 45lbs black one with weight holder"; "there are still geometry intersection like bar and my leg"; "use graphics experts in the domain as simulated experts to grill the idea and study the best auto-research pipeline and 3d technique and product rollout so we have continuously improving and sota performance and quality for our website 3d, aesthetic, and funness, and other good metric i care without hurting other ones i also care about"; "think how we best switch between different stylistic rendering".
- **November 13, the worlds:** the ones he likes: Rick and Morty, _Common Side Effects_, _Spider-Verse_ ("the new sony bold color"), pencil ("black and white with different gray ... truly floaty feeling"); "they should not just cheaply do a trivial shitty transform"; "super high quality and unique art style and material texture, render, even physics can be different"; "a version of me that is different for each world and a different companion"; and "a sirui-style that is uniquely sirui ... illustration like water color crazy world with vibrant color and wacky physics and expressive stroke"; "study art history"; "gradually develop our own artistic style and iterate and record this process".
- **November 14:** warm-up "with bar and then 1 plate", then his working plates with "smaller plates for later sets"; the cartoon: "check and improve, lots of animation technique you can learn"; the entrance "is a weird squarely resolving stairs ... it can lead into the main living room area better and the main entrance at the lower floor living should also be better designed so we can see sea view and get the wow moment"; "the 3d scene sometimes has weird flashing issue, should be fixed".
- **November 14, heat:** "the thermal camera view ... really good heat simulation and temperature prediction ... for different material, like water, solid, human, light, fire spot, food, when lifting"; "we have to make it really aesthetic"; later, "those style can be globally applied to my whole site ... truly changing the whole ui and ux properly before we launch".
- **November 14, sound:** "make some music to go along with my website's different theme etc. and different effect ... really adaptive and customized, like click, scroll, and where there would be delightful interaction moment".
- **November 14, autonomy:** "could you do more automated testing in browser instead of asking me a lot, could be more autonomous".
- **November 14, the thermal reference** (screenshots of a stop-motion film shot through a thermal camera: a miniature reef set, props warmed under heat lamps, a tiny white-hot figure on deep indigo, corals and fish in orange): "dude is using stop motion ... you can maybe do a better job in our physics world where you control everything and you can see the dude also using many great scene composition like it is a movie and composition and layout in the scene matter".
- **November 14, the film:** "could you also be more intentional when designing the walk through experience or have fly over drone short things; people can switch to different non-photoreal render or the most photoreal one in the beginning and they can freely switch when in our well choreographed experience ... a better mini-movie like experience; now we can also add our own music".
- **November 14, on what shipped:** the cartoon "is not bad, but feel like it can be better, and some weird geometry issue you still haven't fixed. also the toon version feel too fuzzy and too vague, not crisp artistic identity and not interesting"; the print "feel too similar to toon"; "i see flash again"; the house: "some part of house is not well designed. such as the top floor subtle lighting and gardening, and also part under the pool, though it is just structural part, feel like better design and engineering can also go there"; "footer building lighting reflection in water is not really matching".
- **November 14, priority:** research that improves "our 3d quality and performance" and "how to make the website great and enhance the whole experience" comes first; "music is also part of those".
- **November 14, sound again:** "can you not make music ... i can give you access to many tools you need ... a senior game designers told me sound is soul of game and animation".
- **November 14, the standard:** the styles "feel sloppy and fuzzy, like you just apply a cheap filter ... i want a well crafted experience, where details are crisp but just give a whole new different vibe and physics, aesthetics etc, and ui ux all adapt the new style, as well my character"; the example and bottom line: "a hand painted style game built in under an hour, runs in a browser" (a painted autumn wood, a small figure in a blue cloak and straw hat, brushed leaves, dappled light).
- **November 15:** moved the work into the Claude app "so you can have more access to things, feel free to use docker, browser, blender whatever you need"; if music is still hard, "we can wait till next model update".
- **November 14, how to work:** keep the list; hard and slow is fine "as long as we write that down"; "we can even wait for later better, more capable model like we did".

## Fifth round (November 15, in the Claude app)

Sirui moved the work into the Claude app: "feel free to use docker, browser, blender whatever you need, if it is still hard for you to make music, we can wait till next model update".

Done and pushed:

- **The footer's reflection (P1).** Four causes, each measured; a browser case and a capture tool keep it.
- **CI repaired.** The flash fix's push had failed three visual jobs. Both causes were in that change and both show only under CI's slow frame clock; section G says how to run that clock here before pushing.
- **Sound (L1, L2), behind `?sound=1`.** A key for each hour, a bed, and eight interface sounds, all synthesised. I cannot hear it; the notebook card "Sound an agent can check" says how it was checked. **It waits for his ears:** open `https://dylantao.github.io/?sound=1`, open the theme panel (the sun in the navigation) and turn on Sound; or run `node bin/render_site_sound.cjs` and play `.jekyll-cache/sound/day.wav`, the four hours in 90 seconds.

Also done after that push: CI for it came back green on every workflow, including the new sound case on Linux; the cut rock keeps a tone at night (B2 step 1d); and the "weird geometry" he still sees is now measured instead of guessed (B2 step 2): the cut is level, and the fault is rooms with no roof to lift, the gym above all.

Also done: **the cartoon is redrawn from the scene's structure (J1, first half of J2).** His verdict on version 1 was "too fuzzy and too vague ... like you just apply a cheap filter". While the cartoon is on, the scene is drawn once more into a buffer that says which object is at each pixel, which way it faces and how far it is; lines are cut where objects meet, where a surface breaks and where it folds, in three weights, and a fill stops at its object's edge. Look at it with `?scene-lab=1&look=toon`. Soft-gradient pixels fell from 12 % of the frame to 8 % (the render has 37 %). It costs about 28 % more draw calls while on and nothing when off. The woodblock is untouched and now clearly a different picture.

Next, in this order unless he says otherwise: one pass over the house in Blender that carves roofs over the buried rooms and builds the new arrival (B2 step 2 with K); the looks rebuilt on the scene's structure so they are crisp (J1, J2).

## Fourth round (November 14 to 15)

Sirui looked at the cartoon, the print and the house, sent the thermal film he had been inspired by, and raised the bar: crisp, crafted worlds, not filters; a choreographed film of the house; sound; more autonomy and fewer questions.

Done and pushed: the flash he kept seeing. It was a blank frame every time the adaptive resolution or the quality tier changed (H7). Found only after turning on what automation normally pins and after fixing a recorder that could not see a transparent frame.

Done and pushed: the footer's reflection (P1). The flash fix's own push failed three visual jobs on CI. Both causes were mine, both are fixed, and both now reproduce on this machine (G has how): a frame asked for from inside a frame, and a test that assumed a fast machine.

Recorded, not built: the film (N), house design passes for the top floor and under the pool (O), the footer's reflection (P), the thermal reference now that I have seen it (J9), and the standard that version 1 of the looks fails. My answer on music: yes, as code. I can write the notes, the harmony and the instruments and have the page synthesise them, and I can render files offline; what I cannot do is hear the result, so analysis guards the levels and his ears judge the music.

## Third round (November 14)

Sirui's notes, in order: his warm-up is the empty bar and then one plate; the cartoon can be improved with real animation and illustration craft; he could not say where the hard sunlit edge in the study was ("maybe you fixed it"); the entrance is "a weird squarely resolving stairs" that should lead into the living room and give "the wow moment" of the sea; "the 3d scene sometimes has weird flashing issue"; a thermal-camera world with real heat simulation; later, the worlds applied to the whole site, changing its interface and behaviour properly; and adaptive music and interaction sound.

Done and pushed: the warm-up (H6) and a dimmer for the house's lamps (H7), which is the one cause of flashing I could measure. Everything else is recorded as a plan: the arrival (K), the thermal world (J9), sound (L), worlds for the whole site (M), and the craft list for the cartoon (under J2).

Two things I could not do: watch the Instagram reel he linked for the thermal look (the page needs a login), and reproduce a flash while standing still (there is none: 259 frames in the stair hall changed by nothing).

## Second session (November 13, evening)

Sirui looked at the print and wrote back: "a bit too grim", "maybe a bit more Rick and Morty vibe"; the bar's plates did not match what he loads; the deadlift was better but the bar still passed through his leg. He asked what "quantized water" and "sun-bounce network" meant, for simulated experts to grill the ideas, for a research and rollout pipeline that keeps improving the 3D without hurting what else he cares about, and for a good way to switch between drawn styles. "Finish some of the easy ones and record other ones."

Done and pushed (section H has the detail): a cartoon look beside the woodblock, the bars loaded his way, a deadlift whose bar stays in front of the legs, and the formatter failure from the first push (two generated reports). The first push's 46 visual jobs all passed.

Recorded, not built: the visitor-facing look switch, the expert panel as separate agents, the research loop, and Sirui's larger direction of several drawn worlds with their own materials, physics, avatar and companion, including a watercolour world of his own (sections H, I and J, and the notebook cards "Looks are settings, not renderers", "A research loop for this house" and "A world is more than a filter").

## State at takeover (November 13, 00:10 Pacific)

- `main` was at `4fd43cafc`; a fast-forward to `88b95c89b` brought in eighteen scheduled weather, activity and Scholar commits.
- Codex left one unfinished change uncommitted: a dinner fix (hands went to the dessert plate before it was served), its unit test, a browser case, and longer CI timeouts for three workflows. The unit test fails on the old code and passes on the fix.
- Sirui's last phone review (November 3) is the brief for the house: the study is brighter but still has a hard sunlit edge; some geometry "curves weirdly"; the bedroom needed sleep curtains (shipped in `1e7adb981`); the bay under the bedroom should become a planted, comfortable extension of the breakfast nook; five screenshots mark the empty bay, the crown above the living rooms, the gym-side terrace cut and the library-side hanging sheet.
- The cliff "F6" branch reached version 383 without an accepted shape. Its notes are in `artwork/coastal-home/reviews/terrain-f6-2026-10-29/WORKING.md`.

## Todo

### A. Codex's unfinished batch

- [x] **A1. Dinner pause.** At dinner, both hands went to the dessert plate during the pause before it was brought forward. Codex's one-line fix in `dining-motion.mjs` keeps the main plate in front until the swap. The unit test fails on the old code and passes on the fix. Its browser case waited for a redraw that a paused scene never owes; that step now clicks without the wait. Four widths pass on a local production-style build. Commit `4cbba72d5`.
- [x] **A2. The 4 MiB first-scene budget counted the wrong bytes.** See the notebook card "The gate that measured the source". Verified by `python -m unittest discover -s test -p "test_coastal_assets.py"` (7 pass) and `bundle exec ruby test/site_module_assets_test.rb` (3 pass, 34 s). Commit `757b3e986`.
- [x] **A3. Longer CI timeouts** for the Prettier, integration and upgrade workflows (Codex's uncommitted change; full checkouts of this 3 GB repository outran the old limits). Commit `9ceac52e8`.

### B. Sirui's November 3 house review

- [x] **B1. A garden refuge under the bedroom.** Built by `bin/coastal_garden_refuge.py`: a _tsubo-niwa_ in the bay beside the breakfast nook. Ray casts on the house file give the bay as 2.98 m wide, 2.9 m deep and 1.54 m high, one 20 cm step below the terrace, so nobody stands in it: a low timber deck carries a futon with two bolsters, two floor cushions, a tea table and a standing paper lantern; ferns, cast-iron plants and moss fill the back and west side; three stepping stones lead in past a stone basin. 16 meshes, 4,280 triangles, all additive (no rock cut, nothing moved). The objects are `kitchen_garden__*`, so only `room-kitchen.glb` is re-exported and the shell keeps its bytes. Review packet: `artwork/coastal-home/reviews/garden-refuge-2026-11-13/README.md`.
  - Control first: re-exporting the unchanged kitchen with the ported exporter reproduced the shipped file byte for byte (sha256 `6f8ef82b…`), so any difference after the install is the garden.
  - Cost: `room-kitchen.glb` grows by 20,906 bytes gzip. The overlap audit is unchanged where it counts: 939 offenders, 306 deep sites over 5 cm, no garden pair among them, no garden z-fighting in the source or the decoded delivery. The first candidate had one new deep site (a moss mound inside an accent stone I had placed 8 cm apart); the stone is gone.
  - The lantern is a real light at night, without a new light in every shader. See the notebook card "A light only its neighbours pay for."
  - Watch: the light bake now collects 736,041 triangles against its 750,000 ceiling. The next piece of geometry inside a light region needs that ceiling looked at first.
  - Not seen yet: a phone, and Sirui's eye.
- [ ] **B2. The cut-away reads as broken geometry.** Orbiting hides fourteen "lift-away" roof solids (`caveRoof` in `controller.mjs`). What is left are their seats: flat ledges and walls in the same sandstone as the natural cliff, the brightest thing in the view, plus rock outside the lifted solids (the library-side sheet, the gym-side lump). Codex spent 383 versions re-sculpting the rock. My reading: it is a drawing problem first.
  - [x] **Step 1, the cut faces.** `section-cut.mjs` finds every seat per pixel and prints it in one muted umber, an architect's poché. Commit `bd3fc9ea6`; unit tests 3 of 3; the browser case passes at four widths (the tone is visible, and nothing is drawn with the roof on). See the notebook card "A section is a drawing."
  - [x] **Step 1c, the cut is hatched.** From above, the cut seats were 40 to 60 percent of the picture in one flat dark tone: still "big and empty", only darker. They now carry fine hatch lines 42 cm apart, half as light again as the tone: the planes x + y + z = constant, rebuilt from each pixel's depth, so they cross level and upright faces at 45°, turn where the rock turns, and stay fixed to it as the view moves. Where they would fall closer than a few pixels they fade out. `hatchLine` in `section-cut.mjs` mirrors the shader for the unit test.
  - [x] **Step 1b, the orbit no longer enters the cliff.** Found by driving the whole-home view with real drags: a 47° turn east at the arrival height put the camera inside the cliff (a grey frame with only contact shadows on it), and 54° west filled the frame with the bedroom wing's seat. Both predate the takeover. The view now turns all the way round only from 0.95 rad of pitch or more; lower down it is held to the 71° arc that faces the sea (`frontEnvelope` in `camera.mjs`, `views.overview.envelope.front` in the manifest). See the notebook card "Which way a cave house can be looked at."
  - [x] **Step 1d, the cut keeps a tone at night.** His night capture showed big black slabs around the lit rooms. The cut was lit only by the hour, so at night it was pure black and read as holes. It now has a dim, cool light of its own that fades in as daylight leaves (`sectionLight` in `section-cut.mjs`): dark slate with its hatch, darker than any lit room. A noon frame is unchanged to the pixel (mean difference 0.01 of 255). Unit case and a night check in the section's browser case.
  - [ ] **Step 2, open the rooms the section still buries.** Measured on November 15 with two probes that cast rays straight down over the plan, one in the house file (`bin/probe_coastal_cutaway.py`) and one in the live scene. What they changed in my reading:
    - **The cut is already level.** Inside the main roof's footprint the cliff is a flat plateau at 5.83 m (155 m²); only 18 m² rises above 6 m, at the footprint's left edge and front-right corner. The "sheet" and the "lump" are not leftovers on top of the house. They are the hill around the excavation, seen from inside the pit.
    - **The real fault: rooms with no roof to lift.** Of 253 m² of room surface under the plan, a viewer straight above sees 34 %. Cliff rock still covers 24 % (61 m²): the whole gym (15.5 m²), the bedroom's bath (about 10 m²), part of the library (8 m²) and of the upper floor (7 m²), the arrival hall (4 m²). Clifftop planting covers another 36 % in the house file; the live scene hides the plants rooted on lifted roofs, and my captures show none over the rooms.
    - **In the live scene, top down:** 54 % of the plan is cut rock at 5.83 m, 30 % rooms, 11 % pool and terrace. That is why the view from above is mostly dark hatched mass.
    - **Plan:** carve a lift-away roof over each buried room the way Codex carved the bath wing's (`excavate` in `bin/coastal_bathrooms.py`: copy the mainland, intersect the copy with a box from the room's ceiling up, subtract the box from the mainland, tag the copy `caveRoof`, `closedSolid`, `cutawaySection`). The gym first. The clifftop court, deck and paths above the gym must hide with it. This re-exports `home-shell.glb` and sits beside the stair hall, so it belongs in the same pass over the house as the arrival (K). Read the probe again afterwards: the gym should move to "open".
    - **Capture pitfall found on the way:** the scene's weather comes from a file the bot refreshes. Two noon captures taken hours apart, across a rebuild, differed in sun and shade and I first took it for a bug. Compare frames only within one build.
  - [ ] **Step 3, lift the lid.** Raise and fade the roof over about 400 ms when the section opens, so the motion says where it went. Tried once as a drawing instead: the seat outline of each lifted piece (2,112 line segments from the 14 pieces) floating a metre above the section, like the dashed roof of an exploded axonometric. It read as scratches. The pieces are cliff-shaped, their rims are ragged, and one-pixel lines are too weak at this scale. Not kept.
- [ ] **B3. A hard sunlit edge in the study at noon.** Looked for on November 13 and not found: the Study destination at 12:00 and 13:30 on November 3, at 1600 × 900 and at a 390 px phone size (embedded, full screen, and after a quarter turn), shows soft light only. The right wall carries faint diagonal streaks with soft edges and a warm gradient from the desk lamp. Needs Sirui's screenshot or the direction he was looking. Codex's notes (`docs/coastal-rendering-research-2026-11.md`, "Daylight transport, November 3") already measured that the sun's single bounce is small in the study, so missing bounce is unlikely to be what he saw; a sun patch's own edge is the likelier candidate, and that is a shadow-filter question.
- [x] **B4. Bedroom curtains during sleep.** Shipped by Codex in `1e7adb981`, clock pinned in `4fd43cafc`.

### C. The site, read against the video

Observed on the local build at 1440 × 1000, light theme:

- [x] **C1. Chips that looked like buttons.** Now a labelled line of plain words. Commit `916548cd3`.
- [x] **C2. The loudest thing on the page was the least important.** The Connect icons drew at 51 px because a 36 px rule lost the cascade; fixed. Commit `916548cd3`.
- [x] **C3. Selected publications leave a third of the row empty** on the homepage. Left alone: `_home.scss` caps the list at a reading measure on purpose ("so the dividers end where the words do").
- [x] **C4. Interruption audit** of the project cards. Nothing to fix: a second card answers 26 ms after its click while the first is still opening; five clicks 60 ms apart settle in the right state with no animation left running.
- [x] **C5. Phone pass** at 390 px. Found the Scholar icon orphaned on a second row and a wrapped line starting with a separator; both fixed in `916548cd3`.
- [x] **C6. A wide figure left a hole in its opened card.** HotSpot's strip now opens across the card. Commit `916548cd3`.
- [x] **C7. A row you can throw.** Sirui's follow-up: study Blossom Carousel (the video, 1:04:27) and do at least as well. `assets/js/shelf.mjs` is this site's own version, first used on the Spooder-Man video row. See the notebook card "A row you can take hold of." Commit `3524d9742`; unit tests 5 of 5; the browser case passes 12 of 12 (three repeats at four widths). Next rows to give a handle: the phone deck carousels already scroll natively; the candidates are any future gallery and the paper strip on the publications page.

- [x] **C8. Inner pages, first screens.** Publications, CV, the design notebook and the blog at 1440 × 1000 and 390 × 844 on November 13: nothing broken and nothing changed. One observation for Sirui, not a fix: on a phone the Publications page opens with the Wall of Rejection, the Failure XP card, the list and constellation switch and the filter, so the first paper starts below the first screen.

### D. Research queue (run for real, on the local GPU)

- [x] **R1. Fixed-point water.** Parked after checking what it would buy: see section S.
- [ ] **R2. A small network for the sun's bounce.** Read Codex's result before starting: a traced grid of 289 sun directions at the 128 probes failed both ways. It was inaccurate at held-out directions around the study's apertures (normalized RMS error about 7.85 against a reference whose maximum was only 0.00417 in unit-illuminance irradiance) and too large (834,743 bytes against the cache's 800,000-byte ceiling). The signal itself is small in the study. So the first step is a measurement, not a network: the exact one-bounce solar term at every probe through a day, as a share of the sky and lamp light already there. If it is under a few percent everywhere, drop this. If the sea-facing rooms show a real term in the afternoon, a network conditioned on sun direction is the candidate, and the 289-direction table is the baseline to beat on error and bytes.
- [x] **R3. A woodblock-print treatment** for the home, version 1. `?look=print` (at first `?print=1` and a lab toggle; the woodblock is now one of two drawn looks, see H1). See the notebook card "Same blocks, different hours". Commit `e5ed6da82`; unit tests 4 of 4, browser case at four widths, full suites 420 Python and 1,080 Node passing. Sirui has not seen it yet. Open: a visible control for visitors, the paper margin and seal, night and dusk frames, phone cost.

### E. Performance

- [ ] **E1. The outside view is slow:** about 2,110 draws at 2560 × 1440 and 15.6 frames a second on an RTX 3080 Ti. Read `docs/performance-notes.md` first; Codex measured and withdrew uniform-upload reuse, material sharing, two batching variants (254 fewer draws, slower), a 15 Hz sea mirror and a smaller transmission capture, and found the GPU busy 99 to 100 percent at 2K as well.
  - Census, November 13 (`getSceneEvidence` plus a scene walk, 2560 × 1440): the outside frame submits 2,146 draws for 692 object draws, so every object is drawn about 3.1 times (shadow map until the cache settles, three's transmission copy, the sea mirror, beauty). Only 22 of the 692 are under 2 px in radius and 52 under 4 px. Culling small things is not the lever; the passes are.
  - Not tried yet: dropping the transmission copy while no refracting surface covers more than a few pixels of the frame, by hiding those surfaces rather than changing their material (no program change, and three skips the copy when the list is empty). The onsen water has to be shown to be out of sight first.

### S. Simulation and learning ideas, checked against what they would buy

Sirui asked for "quantized physics" and "a light network trained on quantized bigger models". Checked on November 13 before building either:

- **Fixed-point onsen water (R1).** The solver is a 40 × 40 grid stepped at 120 Hz in Float64, uploaded as a 40 × 40 float texture with nearest filtering. It costs almost nothing, it already runs on phones, and it uses only arithmetic that every engine rounds the same way. An integer version would be a curiosity, not a gain. Parked.
- **A network for the sun's bounce (R2).** See R2: the signal is small where it was measured. A measurement comes first.
- Where bytes do matter: the light cache is 712,655 bytes (about 187 KB compressed) of the first scene's 4 MiB. A small quantized network that reproduces the probes' transport is the honest version of the second idea. It would have to beat the current packing on bytes at equal error, and its decode would have to cost less than the transfer it saves.

### F. Stale entries on the public records

The record pages listed these as open; the code says otherwise.

- [x] "Minify the ES modules" (Graphics Lab `next-performance`, website-revamp `page-weight`): removed on November 13. Done since `_plugins/site_module_assets.rb`; the live `controller.mjs` is 105,698 bytes against 218,320 in source.
- [x] `sidenotes` was listed as blocked: removed on November 13; the backlog says they are implemented.
- [ ] `temporal-antialiasing` is listed as blocked; `temporal-aa.mjs` exists and the backlog says its opt-in study met its gate on October 23. Read the study before changing the row.
- [ ] `spectral-ocean` asks for a prototype; `fft-ocean.mjs` is one. Same: read it first.

### G. CI

- The first push of this takeover (`bd3fc9ea6`) failed one of 46 visual jobs: desktop-1440 `scene-rooms` hit the 20-minute limit of "every Rooms destination receives pointer input", which renders at 2560 × 1440 on software WebGL. A re-run of that job passed (that case took 12.3 minutes), so the run is green.
- The commit did not slow the scene in general: the same nine cases on the other three viewports ran as fast as or faster than the last green run before the takeover (laptop: 64 s, 3.9 min and 2.8 min for the first three cases, against 104 s, 7.5 min and 5.3 min). On this machine a forced still frame of the whole-home view takes the same time with the section cut on or off.
- A second, rarer flake, seen once in six local runs on November 13: "the gym frames the face and full exercise poses" collects `GL_INVALID_VALUE: glGetProgramiv: Program object expected` (a retired shader program polled once more; `program-lifetime.mjs` exists to prevent it). It passed four of four on repeat. Re-run before investigating.
- **November 15: two failures that only CI's clock shows, and how to see them here.** CI draws the scene on software WebGL, and the tests slow their frame clock to match (`useSoftwareSceneCadence` in `test/visual/scene-clock.js`): a frame asked for from inside a frame arrives 100 ms later, or a full second later in the room journeys, while a frame asked for by an input arrives at once. The flash fix (`221ae7b7a`) broke two cases under that clock and none on this GPU. (1) The deferred resize called `requestFrame()` from inside the frame that drew it. That slow frame then stood in front of the next input's frame, and "the pool visit" read its state before any frame had drawn it (desktop and phone `scene-held-stairs`). Fixed: the resize made inside a frame asks for no further frame (`resize({ redraw: false })`). (2) My blank-frame case assumed the governor stays at full resolution. With 100 ms frames it finds "slow frames" and steps to 0.8 by itself (desktop `scene-live`). Fixed: the lab holds the factor from its first request (`labScene.stepResolution`; `null` hands it back), and the case pins it before it measures. **Before pushing a change to the frame loop or to scene timing, run the affected cases under CI's clock:** `$env:VISUAL_TRANSPORT_SOFTWARE="1"` for desk-scene cases and `$env:VISUAL_SCENE_BACKEND="llvmpipe"` for the room journeys (1 Hz). Both failures reproduced on the first try that way.
- The desktop job itself has now been slow twice (6.7 minutes for that case on November 8; over 20 and then 12.3 on November 13). Hosted runners vary by a factor of two between jobs of one run, and this case has no slack for a slow one. If it fails again on a commit that passes elsewhere, re-run the job before reading anything into it; if it keeps taking over 12 minutes, the limit is the thing to look at.

### H. Sirui's November 13 evening note

- [x] **H1. A cartoon look.** `?look=toon` (and now `?print=1`): the same pass as the woodblock with other settings: near-white paper, lifted values in four hard steps, full colour, shadows that darken more than they turn blue, no grain, one heavier even outline. `?look=print` keeps the woodblock. The lab's Graphics studies has a three-way switch. Unit tests 5 of 5; the browser case walks realistic, cartoon, woodblock and back. Sirui has not seen it; night and a phone have not been looked at.
- [x] **H2. The bars carry what Sirui loads.** Leg lifts (rack and platform) take blue 45 bumpers, two a side at his working weights, and the red 55s stay on the tree. The bench takes black plates with a clamp collar. `training.mjs` (`BUMPERS`, `BUMPER_STATIONS`, `CLAMPED_STATIONS`), `gym-props.mjs`. The weights themselves still come from his program in the manifest (training maxes: bench 235, press 130, squat 315, deadlift 310, as of October 15). If the numbers on the bar are still wrong, those maxes are what to correct.
- [x] **H3. The deadlift bar no longer passes through the legs.** Measured first: on the test skeleton the bar was behind the leg's line in 25 of 37 sampled frames of a repetition, up to 8.5 cm inside the thigh, because hips and bar rose together and the knees were still forward when the bar passed them. Now the knees straighten first with the hips back, and the hips come through after the bar is past the knees; the feet stand 7 cm behind the bar's line and the hips finish 2.5 cm behind it. Zero frames behind, 2 mm clear at the closest for the conventional lift and 6 mm for sumo, hands still on the bar. `test/coastal-lift-rig.test.mjs` holds it. Not checked: each avatar's own leg thickness (the test uses one build), and the squat, bench and press for the same fault.
- [ ] **H4. A look switch for visitors.** Design in the notebook card "Looks are settings, not renderers". Needs Sirui's yes on the cartoon first.
- [ ] **H5. The same audit for the other lifts.** The probe that measured the deadlift (bar against limb centre lines, in the plane the bar crosses) works for the squat's bar against the neck and the bench's against the chest and face.

- [x] **H6. Warm-up as Sirui does it.** The empty bar for ten, then one plate a side (135 lb) for five, then the working sets. A first working set at or under 135 lb warms up at 60 % as before. `warmupWeight` in `training.mjs`; a unit test walks the squat day in the manifest.
- [ ] **H7. "The 3d scene sometimes has weird flashing issue."** Measured with a frame recorder that keeps every drawn frame as a small luma image (`bin/record_coastal_flashes.cjs`, new; the repository's own `bin/measure_coastal_flicker.cjs` gave the first lead).
  - [x] **Lamps snapped when the visitor changed room.** The schedules depend on the room the visitor is in. Walking past the kitchen at night took the dining lights from 30 % to 100 % and the downlights and shelf from 20 % to 100 % in one frame, and back 1.8 s later. They now ease like a dimmer (`dimmer.mjs`: 0.3 s up, 0.8 s down; stills and paused scenes still arrive at once). Unit tests 3 of 3; in the live scene the levels pass through intermediate values and the settling flag clears.
  - [ ] **The sun's shadow is refitted on every room change during a walk** (`walkRoomChanged` calls `fitSunShadow(true)`), so shadow edges can jump at a doorway. Not measured yet.
  - [ ] **On the entrance stairs the walker belongs to rooms behind the walls.** `roomAt` picks the nearest room on the walker's storey, and the stair hall is not a room: descending it reads outside, then the private living floor, then a bathroom. Each change moves light levels and refits the shadow. The hall should be its own place; it goes with the arrival redesign (K).
  - [ ] **At the glass front a curtain can cover the lens for one frame** while walking (one white frame in a recording). Curtains should give way to the walker's head, or the near plane should fade them.
  - [ ] **Orbiting a room can pass a thin post in front of the lens** (one flagged frame in the study). The camera's arm ignores pieces under 45 cm.
  - [x] **A blank frame at every adaptive step: this was the flash.** He saw it "again" while holding still to take a screenshot in the print look. Resizing a canvas clears it, and the frame loop resized at the end of the frame, after drawing, whenever the adaptive resolution or the quality tier changed; a ResizeObserver callback did the same. On a 3840 × 2160 buffer at rest in the cartoon look: three blank frames in 40 s, at exactly the two steps and the tier switch. Now the resize waits for the start of the next frame and is drawn in the same task: five steps and a tier switch, no blank frame. A browser case steps the resolution through the governor's own path and reads every drawn frame over white. Why it took three tries: under automation the governor is pinned unless `?quality=auto` and the frame is GPU-bound, and my recorder drew each copy over the last one, so a transparent frame was invisible to it. The first push of this fix failed two cases on CI's slow clock; section G has both causes and the way to run that clock here.

### I. A research loop, and a panel to grill it

- [ ] **I1. Run the panel as separate agents** on the next proposal before building it (the roles and their standing questions are in the notebook card "A research loop for this house"). This session's panel was one model arguing each role in turn, which is cheaper and weaker.
- [ ] **I2. One command that reports the numbers Sirui cares about** for a candidate against `main`: frame time outside and in a room at 2K, first-scene bytes, time to ready, draws, and three fixed frames per look. Most pieces exist (`bin/measure_coastal_views.cjs`, `bin/compare_coastal_stills.cjs`, the asset budget test); they are not yet one report.

### J. Worlds: one house, several ways of drawing it

Sirui, November 13, after seeing the first cartoon frames (with a poster of _Common Side Effects_ attached): render the house in the drawn styles he likes: the television cartoon already named, the _Common Side Effects_ manner, the _Spider-Verse_ manner ("the new Sony bold color", high resolution "yet still micro"), pencil ("black and white with different gray", "truly floaty feeling"), and one that is "uniquely Sirui": "illustration like water color crazy world with vibrant color and wacky physics and expressive stroke". They "should not just cheaply do a trivial shitty transform": each needs its own material texture and rendering, and "even physics can be different". Each world gets its own version of him and its own companion. Study art history, develop the style gradually, and record the process.

Nothing below is built. It is the plan, in the order I would take it. The notebook card "A world is more than a filter" has the reasoning.

- [x] **J1. A structure pass.** Built November 15 for the cartoon (`createStructure` in `print-look.mjs`): one more draw of the scene with one small material into a half-float target the size of the frame, holding the surface's view normal, a number per object (and per material part) and the distance in metres. See-through things, cut-out cards, effects and plants are left out. It runs only while a look that asks for it is on. Cost on this PC at 1600 by 900: 176 more draw calls in the living room (638 to 814), 488 more in the whole-home view (1,663 to 2,151), about 5 ms of GPU time. Not built yet: the materials' own flat colours and a light term separate from colour. Those need either a second target or the frame divided by albedo, and they are what designed shadows (J2) will stand on.
- [ ] **J2. The cartoon, done properly.** Flat colour taken from the material, not from lit pixels. One shadow step cut from the real light, its edge cleaned so it reads as a drawn shape. Outlines from object edges at one even weight. Version 1 (H1) posterises the finished frame, which is the cheap transform.
  - [x] **Lines and fills from structure (November 15).** Outlines where a surface breaks in depth, contact lines where two objects meet, folds inside a form, in three weights from one ring of twelve taps; fills averaged inside one object only. `LOOKS.toon` in `print-look.mjs`. Before and after frames are in `.jekyll-cache/looks/` (not committed).
  - [x] **Three hard steps, with the top one kept for lamps and sky.** Without the ceiling, the sunlit cliff broke into white blotches: the coast was the worst frame. Chosen from three settings compared in the coast, the living room and the study.
  - [ ] **What still makes it less than a designed cartoon.** (1) Every lit surface prints at about the same lightness, because the steps are cut from lit pixels: a white cushion and a tan wall differ by hue alone. It needs the materials' own colours: a second target in the structure pass holding each material's colour times its texture's average, then light as the frame divided by that. (2) Shadow shapes are the render's soft shadows hardened, not shapes drawn for the form. (3) Thin slabs draw two lines (a rug's edge). (4) Lines step in a few levels at one device pixel per pixel. (5) Water, glass, steam and plants have no lines. (6) The figure is the realistic one outlined; J7 gives each world its own.
  - **Waiting on his eye before more is built on it.**
  - Craft to bring in (Sirui, November 14: "lots of animation technique you can learn"): a line-weight hierarchy, heavier on the silhouette than inside the form, with interior lines in a darker shade of the fill rather than black; one designed shadow shape per form plus a rim light, instead of stepped gradients; saturated shadows; a colour key for each hour with one accent; people crisp and flat over a softer, painted house, the way cel characters sit on a painted background; drawn effects for water, steam and fire that boil at eight to twelve drawings a second. For motion, the principles in Thomas and Johnston's _The Illusion of Life_ that the procedural rigs do not have yet: anticipation before a lift, overshoot and settle on arrival, held poses, a smear on the fastest moves, overlap in hair and cloth.
- [ ] **J3. Sirui's own: watercolour.** The one to spend the most on. First a page of rules with their sources (see the card), then one room, the kitchen nook and garden, before the whole house.
- [ ] **J4. Pencil.** Greys only, hatching that stays on the surface and keeps its stroke width at any distance, contours drawn two or three times a little apart, paper showing through, the picture fading out toward the edge of the sheet. Lighter gravity for cloth, steam and hair; slow settling.
- [ ] **J5. Comic print** (the _Spider-Verse_ manner). Halftone dots carry the mid-tones and hatching the darks; colour plates printed out of register stand in for focus blur; line weight varies; people move on twos while the camera moves on ones; colour is bold and complementary. Snappy motion with overshoot and holds.
- [ ] **J6. Field guide** (the _Common Side Effects_ manner, from the poster): one thin, slightly irregular black line; flat dusty natural colour with a single darker shadow shape; off-white ground; marks only where they explain a texture; one or two saturated glowing accents (here the lantern, the fire, the pool). Deadpan timing: ordinary physics, long holds.
- [ ] **J7. A Sirui and a companion for each world.** Five manners of avatar exist (`manifest.avatars`). A world chooses one; a new world gets designs drawn for it. The companion has one design today.
- [ ] **J8. A page per world before any shader:** five to seven rules that can each be checked on a frame, three fixed frames, what the physics and timing are, and what it is named. Then the panel, then a flag, then the lab, then Sirui's eye (the research loop).

- [ ] **J9. Heat: a thermal camera's house.** Sirui, November 14: a thermal-camera view with "really good heat simulation and temperature prediction" for water, solids, people, lights, the fire, food, lifting; and "we have to make it really aesthetic". The design is the notebook card "Heat: what a thermal camera would see here". Order of work: (0) get the look he liked: the reel needs a login, so a screenshot or three words about its palette; (1) a temperature pass that replaces the lit render in this world, with a temperature and an emissivity per material, automatic gain, a palette and a legend; (2) time: the cliff's thermal mass through the day, and the things the routine heats (coffee, stove, fire, lamps, bed); (3) bodies; (4) prints that fade: feet, hands, seats; the pointer as a spot meter; (5) the sensor's character and sound.

Naming and sources: on the site a world is named for how it is made (Cartoon, Field guide, Comic print, Pencil, Watercolour), and its record row credits what it learned from. No show's characters, logos or frames are copied; what is taken is technique.

### K. The arrival

Sirui, November 14: "the current entrance to house is a weird squarely resolving stairs which is not a great design, i feel it can lead into the main living room area better and the main entrance at the lower floor living should also be better designed so we can see sea view and get the wow moment". He says he asked for this before.

- What is there: from the clifftop portal (8.3 m up) three flights turn round a square core in a windowless shaft and land in a foyer at the back of the living floor, about ten metres behind the glass front, facing a wall. His screenshot of the hall also shows a ceiling whose baked light fans out in triangles, three downlight discs that float under the ceiling, and a boxy glow round one fitting.
- What exists already: Codex built a straight arrival privately and never enabled it (`artwork/coastal-home/reviews/entrance-inspection-2026-11-02/README.md`, the handoff's "straight-arrival v14" and "direct-arrival v5" entries, and the worktree `C:/dev/site-takeover-worktrees/straight-arrival-20261101`). Read those and open its house file before drawing anything new.
- [ ] **K1. Decide the sequence on paper,** with three massing options rendered in Blender's workbench before any export. The notebook card "An arrival that earns the sea" has the brief, the precedents and a test for the wow.
- [ ] **K2. Build it** as a shell delivery like the garden's, with the hall as its own place for the walker and the lights (H7), fittings recessed, and a ceiling fine enough for its baked light.
- [ ] **K3. A first-visit arrival:** the walk from the portal as the way the house is first shown, once, skippable, still under reduced motion.

### L. Sound

Sirui, November 14: "make some music to go along with my website's different theme etc. and different effect ... really adaptive and customized, like click, scroll, and where there would be delightful interaction moment".

- [x] **L1. An engine and a switch.** Pushed November 15, behind `?sound=1` (withdrawn by `?sound=0`). The switch sits in the theme panel beside Pause motion and is hidden from everyone who has not been offered it. An ordinary visitor loads one small script that does nothing; an offered visitor fetches the instrument when the switch is shown, and the audio context is made inside the click that turns it on. Everything is synthesised (`assets/js/sound/engine.mjs`: a plucked string, a struck bar, a knock, a pad), goes through a generated room and one limiter, and a hidden tab is suspended. Eight interface sounds (`score.mjs` `EVENTS`): a press, pointing along the navigation (a rising scale, placed left to right between the speakers), a switch (up for on, down for off), opening and closing, a homepage section arriving, the hour changing, a thrown row landing. Browser cases: nothing is fetched or made without the offer; one context, running, after the click; what the visitor does is played; hidden is silent; off is remembered; every sound's level.
- [x] **L2. The key of the hour.** Morning D major, noon G major, afternoon E minor, evening A minor, all pentatonic, neighbours sharing four or five notes, the evening lowest and slowest. Every interface sound is a note of the hour's key. The bed is six loops, one note each, with periods that share no common measure (Eno's tape loops), so no minute repeats another: 12 to 18 notes a minute, mostly one to three voices, never more than five. Rendered offline: a switch peaks near -15 dBFS, a pointed-at link near -25, the bed averages near -38. **Not yet judged by ear.** If he likes the direction, the next steps are L3 and L4; if not, the keys, the bed's loops and every voice are a few numbers each in `score.mjs` and `engine.mjs`.
- [ ] **L3. The house.** The sea, room tone, the fire, and sounds on the simulation's own events: the bamboo drip, a plate going on the bar, a step on stone or oak.
- [ ] **L4. A timbre per world,** and the sonifications: the Build Rhythm chart played as a rhythm, the paper constellation as notes, the thermal pointer as pitch.
- The reasoning and the list of moments are in the notebook card "Sound made of the site".

### M. Worlds for the whole site (later)

Sirui, November 14: "later I am thinking if those style can be globally applied to my whole site ... make sure it truly changing the whole ui and ux properly before we launch, like many interaction behavior would change, layout, as well as the basic ui and ux".

- [ ] **M1. One world, one page, end to end** behind `?world=`, before any second world or page. The notebook card "A world is a contract" says what a world must supply and what must not change.
- [ ] **M2. The checklist that falls out of M1,** then the visual harness sampled across worlds.

### N. The film

Sirui, November 14: a walk-through or drone fly-over designed like a film, where the visitor can switch look at any moment, starting from the most photoreal, with the site's own music.

- [ ] **N1. A shot list on one page** before any code: six to eight shots, each with what it is for, its lens, its move, its length and the hour. The notebook card "A film of the house" has the first draft.
- [ ] **N2. A camera on rails:** a small module that plays keyed shots (position, target, lens, easing) over the live scene, pausable, scrubbable, skippable, still under reduced motion (it becomes a set of stills).
- [ ] **N3. Looks during the film:** the switch stays live; a cut may also change look on purpose.
- [ ] **N4. Sound to picture** once the engine exists (L).

### O. The house, designed further

Sirui, November 14: "some part of house is not well designed. such as the top floor subtle lighting and gardening, and also part under the pool, though it is just structural part".

- [ ] **O1. The top floor and the clifftop garden at night.** Seen from the sea at night the top of the house is black with a few agave shapes. Needs low, warm, shielded light (path markers, a wash on the garden wall, light under the pergola) and planting with a plan: groups, heights, a path, not scatter. The lantern taught the method: authored installation points that only their neighbours pay for.
- [ ] **O2. Under the pool.** The cantilever's underside is an undesigned dark mass. It should read as engineering: ribs or a tapered slab, a visible bearing on the rock, a drip edge, a maintenance stair or a ladder, and one line of light under the lip so the pool floats at night.
- [ ] **O3. The arrival (K)** and **the rock above the cut (B2 step 2)** belong to the same pass over the house's architecture.

### P. The footer

- [x] **P1. The lit building's reflection.** Sirui, November 14: "footer building lighting reflection in water is not really matching". Shipped November 15. His screenshot is the phone layout, where the building stands at the water's edge. Measured there at 21:00 on an evening the studio light is on (two in five), four things were wrong.
  - **Streaks ran along the world's z axis.** The phone's camera stands 7.5 degrees off it, so every streak leaned about 19 degrees on screen instead of hanging below its light: lean -0.27 to -0.38 before, within 0.07 now. The sway, the streaks and the glitter of the fire and pier lamps now follow the view (`viewAxes`).
  - **The long side of a streak pointed at the shore.** It points at the viewer now, as the facets that can turn a light to the eye do, and as the pier lamps' glitter always did.
  - **The threshold was taken off each channel, which reddened the streak.** The pane is about 16 times white beside its lamp and shows pale yellow; its streak was a deep orange flame, 18 to 45 % of its light orange. None of it is now: a streak keeps its lamp's hue and eases as the display eases the lamp (`streakLight`).
  - **The phone's mirror was 363 by 119 pixels,** so the building's reflection was a blocky dark box. It is 725 by 237 now and the glazing bars show (`mirrorDensity`).
  - Checked by me at phone and desktop widths at noon, late afternoon, dusk and night, and on the homepage miniature; day frames are unchanged. Five new unit cases in `test/coast-water.test.mjs`, and a browser case at phone width that reads the streak from the canvas (under the window, lean under 0.15, no orange), using `getCoastEvidence({ projectLandmarks: true }).studioLight`.
  - On a wide screen the window's mirror point sits at the frame's bottom edge, so only the streak's head shows there. That is where a level sea puts it.
  - The pane's 16-times-white value comes from the point light 0.12 units in front of it, not from its emission. It looks right on screen; left alone.
  - **A tool for looking at the footer:** `node bin/capture_footer_coast.cjs out.png --time=2026-11-13T21:00:00-08:00 --width=390 --height=844 --density=3 --mirror=mirror.png --streak`. It serves `assets/js/footer-coast/*.mjs` from the working tree, so an edit to the sea needs no Jekyll rebuild; it can write the mirror texture and measure the studio window's streak with the browser case's own measure (`test/visual/coast-streak.cjs`).

## Ideas ledger

Ideas wait here until someone tries them. Each names what it would change, why it might be right, and the cheapest test.

- **Same blocks, different hours.** Hiroshi Yoshida printed one set of woodblocks in several colourways (_Sailing Boats_: morning, forenoon, afternoon, mist, evening, night). This site already changes palette by the hour. A print treatment for the 3D home would use the same idea: one keyblock of lines from depth edges, flat colour blocks, shadows pushed toward Prussian blue, paper grain, and the hour choosing the colourway. Kawase Hasui's dusk prints, with lit windows against blue, are the reference for evening. It suits low-polygon rock better than a photographic look does. Cheapest test: one full-screen pass after tone mapping, behind `?look=print`, judged on four fixed frames.
- **On twos.** In the print treatment, step the avatars at 12 poses a second while the camera stays smooth, as _Spider-Verse_ does. One line in the mixer update; costs nothing.
- **The drawing gets painted.** The loading sketch already grows line by line. In print mode it could hand over to colour block by block instead of cutting to the render.
- **Lift the lid.** When the view goes from outside to the section, raise the roof pieces half a metre and fade them over about 400 ms, back to front, and settle them back on the way out. The motion explains where the roof went; under reduced motion it stays a cut.
- **The orange as a seal.** A shin-hanga print carries its maker's red seal in a corner. The brand mark is already a small orange sun: in full-screen print mode it can sit where the seal would.
- **A dial panel for the look.** The video's point about exposing the dials: a hidden `?dials=1` panel for line weight, band count and shadow hue would let Sirui tune the print by hand instead of by message.

## Notebook

### What the Design Review video teaches, and what it means here

Source: [Design Review, Marvin Schwaibold (Shopify)](https://youtu.be/eojywvxqoLc). I read the full transcript and looked at the frames around 9:20 and 20:05, the two moments Sirui pointed to.

- **9:20, the bookshelf.** Collins's case studies are books of unequal height on a shelf. A toggle lays them flat as a stack of spines. On hover the books lift, settle on each other and land once more as the last one arrives. The motion is small, physical and specific to the object: it says "these are books" rather than "this is a card grid." The lesson is not "add bounce." It is that one object on the page carries the craft, and its motion follows from what the object is.
- **20:05, the interruptible grid.** A 2 × 3 grid of clips; tap one and it grows from its own cell, drag down and it returns. The first build made him wait for the return before the next tap. His fix: every state can be interrupted, because "our thought patterns are interruptible." He drew the states as plain colored boxes to explain it. The lesson: test every open/close on the site by clicking the next thing before the first one settles.
- **One thing per section.** His studio's rule: each homepage section is the first chapter of a child page, in the order of the navigation, most important first, because readers drop off with depth. A page "has to dictate": one thing in each viewport takes the eye first.
- **Progressive disclosure, but not burial.** Assume nobody opens a tab. Show three things, each one tap from its detail, and let the page be long.
- **Curate.** AI makes animation cheap; an animated dot that explains nothing subtracts. Reusing one decorative effect in every card drains it.
- **Type.** Five sizes in one viewport is noise. A display face is for headlines only.
- **Scroll.** Never smooth-scroll or hijack the wheel. Carousels drag; whole cards are the tap target; hover answers at once.
- **Expose the dials.** When a value has to be felt (spring stiffness, grass length), build a small panel and tune it by hand instead of describing it in chat.

Most of this is already in `WEBSITE_DESIGN_HEURISTICS.md` (native scroll, one motion language, interruption hands velocity on). The parts worth testing against the rendered site are: what each viewport dictates, how many type sizes the first screen uses, whether every open/close really is interruptible, and whether the site has its one "bookshelf."

### The gate that measured the source

- **Frame:** The "complete first scene" test allows 4 MiB of transfer. It had 2,461 bytes left, so every new mesh, however small, failed it. Codex's garden and cliff work both ran into this.
- **Dimensions:** bytes counted versus bytes served; where each number comes from.
- **Move:** The test summed the gzip size of the scene modules' _source_. Pages serves them after the site's own Terser step, which is 263,875 bytes smaller for the 140 modules (736,459 against 472,584, gzip level 6, measured with the build's compiler on November 13). `test/fixtures/first-scene-transfer.json` now holds a 240 KiB credit; the Python budget subtracts it, and `test/site_module_assets_test.rb` compiles every module and fails if the real saving ever drops below the credit.
- **Backtalk:** Headroom went from 2,461 to 248,221 bytes with the 4 MiB ceiling untouched. The Ruby guard adds about 34 s to the unit job. The vendored three.js files are also minified on the way out (about 21 KB) and are deliberately not credited.
- **Reframe:** Budgets should read what a visitor downloads. The next check of this kind belongs in the deploy job, against `_site` itself.
- **Concept:** A proxy metric drifts from its target when the pipeline between them changes. Here the pipeline gained a minifier in October and the proxy kept counting the old bytes.

### Same blocks, different hours

- **Frame:** Sirui asked for a non-photoreal look after an earlier toon-and-hatch attempt disappointed him. The old attempt swapped every material for a three-step toon ramp, so it threw away the lighting the home already had.
- **Dimensions:** where the line comes from (geometry, not shading); how flat the colour is; how many pigments; what the hour changes; cost.
- **Move:** `assets/js/home-scene/print-look.mjs` keeps the realistic frame and redraws it in one pass. Lines come from the second difference of the depth buffer, which is zero on any flat surface and jumps at a fold or an edge. Colour is averaged inside each surface by a 12-tap filter that weighs neighbours by colour distance in OKLab, then settles into five soft steps. Shadows lean toward one blue; the green-to-magenta axis is muted so the palette stays on the site's orange-to-blue axis. The home's minute picks the colourway.
- **Backtalk:** Three failures on the way. (1) No lines at all: a multisampled target throws away its depth samples after the first resolve, and my pass was the second thing to resolve it. Fix: take the output pass's place and tone-map inside. (2) Cow-print blotches on every sloping plane: the depth texture is unfiltered, and off-centre taps rounded unevenly. Fix: snap every tap to a texel centre a whole number of texels away. (3) Trees as black scribble: every leaf is an edge. Fix: a line runs in some direction, so where all four directions break at once the cut is thinned to a stipple. The first frames with these fixed read closer to _ligne claire_ than to a woodblock; honest name for now is "print treatment."
- **Reframe:** Judge it at dusk and night, where Kawase Hasui's lit windows are the reference, and on a phone. Then decide whether it earns a visible control.
- **Concept:** Saito and Takahashi drew contour and crease lines from first and second differences of a depth image in 1990 ("Comprehensible Rendering of 3-D Shapes"). The flatten-then-quantize colour step follows Winnemöller, Olsen and Gooch, "Real-Time Video Abstraction" (2006). OKLab is Björn Ottosson's (2020).

### A section is a drawing

- **Frame:** In the cut-away, the eye went to the leftover rock, not the rooms. Sirui called it "sharp big empty curving or geometry removal."
- **Dimensions:** which pixels are cut material; their tone against the rooms; how much of the sun's shadow the cut keeps; cost per frame.
- **Move:** `assets/js/home-scene/section-cut.mjs` merges the lifted roof solids into one mesh at load. While the section is open it draws their back faces once, with no depth test, and keeps a pixel only where that face's depth equals the depth the frame already holds. Those pixels are, exactly, surfaces the roof was sitting on. The haze composite, which already reads depth, mixes them to a flat umber lit by the hour's sun and sky.
- **Backtalk:** Four matched frames at noon. Untreated, the seats are the brightest shapes in the picture and carry hard shadow patterns. With a multiply-only tone they went dark but stayed busy. A first flat tone was too light and looked like the untreated rock again. The chosen tone (flat colour 0.072, 0.06, 0.052, nine-tenths flat) sits between the rock and a black fill, and the rooms become the subject. The tall cut wall on the library side takes the tone too. The lump and sheet outside the lifted solids are untouched.
- **Reframe:** Geometry decides what lifts; drawing decides how the cut reads. Step 2 is an authoring change (a crown piece), not more shader.
- **Concept:** _Poché_, from the Beaux-Arts habit of inking the cut walls of a plan solid, so a reader separates mass from room at a glance. The mask is a depth-equal decal test, the same idea as a decal that only lands where it touches a surface.

### A row you can take hold of

- **Frame:** In the video Marvin Schwaibold drags a row of cards with a mouse, throws it, and it lands on a card; the page keeps its native scroll. The reviewed sites failed the same test: carousels that only move by their arrow buttons. On this site the Spooder-Man video row was one of those for mouse users.
- **Dimensions:** who needs help (mouse only; touch, trackpad, wheel and keys already scroll); what a release does (carry speed, land on a stop); what interrupts (everything); frame-rate independence; reduced motion.
- **Move:** I read Blossom Carousel's engine (Jesper Vos, Apache-2.0, `packages/core/src/index.ts` at `fbfcaa3`). Its ideas, kept: the row is a real scroll container with CSS snap; JavaScript engages only for fine pointers and can be lazy-loaded; a press becomes a drag after a few pixels so clicks survive; the release is projected to the snap point it was heading for; wheel, keys and outside scrolls stop the motion at once; past an end the row leans instead of stopping dead. `assets/js/shelf.mjs` is written from those ideas in this site's spring language, with five differences: momentum is in seconds, exact per frame, so 60 and 120 Hz land on the same pixel (Blossom multiplies speed by 0.72 every frame); the landing is the site's `layout` spring carrying the release velocity; reduced motion and Pause motion get a drag with no flight; no prototype or global is patched (Blossom wraps `Element.prototype.scrollIntoView` and listens for keys on `window`); text in the row stays selectable until a drag begins.
- **Backtalk:** The first live run never flew: I read the snap points after switching snapping off for the drag, so there were none, and the row "landed" where it was released. Reading them before taking over fixed it. A first version also moved the opened (enlarged) video card to wherever a throw rested; that reflowed the row under the hand, and a trackpad scroll does no such thing, so a throw now leaves the open card alone. Measured on the built page: a 240 px drag follows 1:1; a release at rest settles on the nearest stop; an eight-step flick lands two stops on; a wheel tick mid-flight returns control within 60 ms; pulled 240 px past the start the row leans 112 px and returns.
- **Reframe:** One primitive, named for the desk it sits on. New rows should start as native scrollers with snap and add `createShelf` only if a mouse user would otherwise be stuck. Effects (a stack on phones, a ripple through neighbours when one card is dropped) can build on its `shelf:rest` event and state.
- **Concept:** Progressive enhancement: start from what the platform already does well for most inputs and add only the missing behaviour, so the fallback is the product, not a degraded copy.

### A light only its neighbours pay for

The garden's first lantern was a white box in a dark bay: an emissive material with no light behind it. The obvious repair, a ninth warm practical, would have added a point light to every lit shader in the house for the sake of three square metres.

The house already has the right tool. `light-installations.mjs` evaluates authored lines and points analytically, and each material only sees the lights of its receiver group, each light only inside its own box. A lamp there is one entry in the manifest (`installationPoints`, id `tea-garden-lantern`) and costs nothing outside its box.

What made it fiddly, and worth remembering:

- **Three receiver groups are full.** `living`, `upper` and `architecture` each carry ten points, the shader's limit. The lamp's box therefore stops inside the rock fin (x = -5.42) and under the bedroom slab (y = 1.36), so it joins only `exterior` (now 5 points) and `library` (3). `test/coastal-garden-refuge.test.mjs` holds that.
- **Geometry chooses its group by custom property.** Room models default to their room's group. The garden's objects carry `installationGroup = "exterior"` from the builder, exported as glTF extras, so the garden is lit with the terrace it opens onto. No scene code changed.
- **The rock around the garden stays dark.** The slab above and the cliff behind belong to `architecture`, which is full. At night that reads as a lit garden against dark stone, which is how a court garden looks; from a low camera the unlit ceiling just above the lantern is a visible lie. Raising the limit from ten points to twelve would cost every installation shader two more loop turns.
- **Paper needs less light than you think.** The living room's washi (`emissiveFactor` 0.6, 0.48, 0.33) at its night level prints as a white box, because the night exposure is high. The garden's paper is 0.6, 0.3, 0.12, scaled by the lamp's 0.45: a peach shade.
- **The lamp belongs above the seats.** The first lantern stood 44 cm tall at the bay's mouth, lower than the table top and two metres from it, so the seats stayed dark. The second stands 78 cm on the deck between the cushions, lamp at 0.49 m, within 60 cm of the table, both cushions and the path's last two stones.

### Which way a cave house can be looked at

A dollhouse can be turned all the way round. This house cannot: it stands inside a cliff, open on one side. The whole-home view allowed a full turn anyway, and trusted the spring arm to keep the camera out of the rock. The arm measures "somewhere in open air to stand", and with the roof lifted the space where the roof was counts as open air, so a low camera behind the house stood inside the hill and drew a grey frame.

The fix is a statement about the building, not a better collision test. From the sea the house can be seen from any height. From the sides and from behind it can only be seen from above, looking down past the rock, where it reads as a plan. So yaw is free above 0.95 rad of pitch and held to the seaward arc below it, and behind the house the view cannot be lowered. Both limits are ordinary envelope edges, so the drag cushion that already softens every room's limits softens these too.

- **Check the public controls, not the lab camera.** A lab camera can be placed anywhere, and my first "views from the side" were inside the rock for that reason. The broken views a visitor could actually reach only showed up when I dragged the real canvas in steps.
- **One state, one envelope.** The envelope depends on where the orbit is (inside the arc and low, inside and high, outside). Every legal orbit is unchanged by its own envelope, so crossing from one case to another never moves the camera. The shown, still-settling orbit is clamped by its own case rather than the requested one, so it cannot be snapped across a corner.
- **What it does not fix.** At the arc's western end the bedroom wing's cut face is a large dark shape on the right of the frame. From above, the cut seats cover 40 to 60 percent of the picture; the hatch (step 1c) is what keeps that from reading as empty.

### Looks are settings, not renderers

Sirui asked how best to switch between drawn styles. The cartoon was the test: it took no new shader, only a second set of numbers for the pass the woodblock uses, plus one new dial (a lift on lightness). That is the rule worth keeping.

- **One pass, many looks.** A look is a name, a set of dials and a function on the hour's colourway (`LOOKS` in `print-look.mjs`). Switching sets uniforms, so it is instant, compiles nothing and cannot hitch. A new look earns a new shader feature only when no setting of the existing ones gets there (halftone dots, hatching by tone, a wet edge), and then every look can use the feature.
- **One name everywhere.** `?look=toon` in the URL, the same word in session storage, in the lab's switch and in the evidence. `?print=1` stays as "the drawn look I last used".
- **What a look may change, and what it may not.** It may change colour, line and the people's frame rate (drawn looks step them on twos). It may not change geometry, camera, what is clickable or what the hour is: a dusk is a dusk in every look, so the looks stay comparable frame for frame.
- **For visitors:** one labelled choice beside Rooms, not a toggle that changes its own label: Realistic, Cartoon, Woodblock. Remembered for the session, never forced, and absent on the low tier until a phone has been measured. A 250 ms blend between two looks is possible because they are numbers, and is worth doing only if the cut feels abrupt.
- **Judging a look:** the same three frames each time (coast at noon, the section at dusk, a room at night), a phone, and Sirui's eye. Numbers that catch accidents, not taste: unique colours, share of pixels that are line, mean lightness.

### What "quantized water" and "a sun-bounce network" meant

Both were shorthand in the first session's notes, and Sirui rightly asked.

- **Quantized water.** The onsen's water is simulated on a small grid of numbers with fractions. "Quantized" would mean doing the same sums with whole numbers only, which is exactly repeatable and can be smaller and faster on weak devices. Checked: this grid is 40 by 40, already costs almost nothing and already repeats exactly. Nothing to gain. Parked.
- **A sun-bounce network.** Sunlight that lands on a floor lights the room around it by bouncing. The house's stored lighting includes bounce from the sky and the lamps but not from direct sun, because the sun moves all day and storing every position is too big (Codex tried a table of 289 sun positions; it was both too large and inaccurate). A small neural network could learn "sun direction in, bounce at each probe out" and stand in for the table. Checked: in the study the missing bounce is tiny. So the first step is to measure it in the sea-facing rooms in the afternoon; if it is tiny there too, drop the idea.

### A research loop for this house

What Sirui asked for: keep improving the 3D's quality, speed, look and fun without hurting the other things he cares about. The lesson of both sessions is that the cheap step is a measurement and the expensive step is building the wrong thing: two of the first session's research ideas died in an hour of checking, and the two fixes that started from a probe (the orbit, the deadlift) turned a complaint into a number first.

1. **Start from a complaint or a number.** "It looks grim", "the bar goes through my leg", "15.6 frames a second outside". Not from a technique.
2. **Measure before building.** Write the smallest probe that turns it into a number on this scene (37 frames of a repetition; nine yaws of an orbit; draws by size on screen). Many ideas end here.
3. **Grill it.** Each role gets one standing question, and the proposal has to answer all of them in writing:
   - _Rendering engineer:_ what does it cost per frame at 2K and on a phone, and what does it do when the roof is on, the print is on, or the context is lost?
   - _Lighting artist:_ what does it look like at dusk and at night, not only at noon?
   - _Animator:_ does anything pass through anything, and does the motion start and stop like a body with weight?
   - _Architect:_ does the drawing still say what is cut, what is beyond, and where you are?
   - _Product designer:_ what does a first-time visitor see without being told, and what is the one control?
   - _Performance engineer:_ which existing budget does it spend (4 MiB first scene, 750,000 bake triangles, ten lights per receiver), and what gives it back?
   - _Sirui:_ is it more fun, and is it still his house?
4. **Build behind a flag, with a test that would have failed before.** `?look=`, `?section=0`; a unit test on the rule and one real-input browser case.
5. **Roll out in steps:** flag, then the lab menu, then an opt-in control, then the default. Each step needs the fixed frames, a phone and Sirui's eye. Anything can stop at any step and stay there.
6. **Write down what was rejected and why,** in the public record's limits and in this notebook. Nothing is "state of the art" here unless a like-for-like measurement against a named method says so.

The panel this session was one model taking each role in turn on the cartoon look and the deadlift. It caught two things: the cartoon turned bushes into black scribble (the lighting and architect questions; foliage lines were cut back), and the first deadlift fix let the hands drift 4 cm off the bar (the animator's question; a sweep found values that keep both). Running the roles as separate agents is I1.

### A world is more than a filter

Sirui's warning was against "a trivial shitty transform". The first cartoon (H1) is one: it re-colours the finished picture. It was the right first step because it was nearly free and answered "is brighter and flatter the right direction?", but it cannot become any of the worlds he described. What separates a world from a filter:

- **It draws from the scene's structure, not from its pixels.** A drawn shadow is a shape with an edge someone chose. That needs the light as its own quantity. A flat colour is the material's colour, not an average of lit texture. A line belongs to an object's edge, not to a jump in depth. Hence J1.
- **It has its own materials.** Pencil is graphite on tooth; watercolour is pigment that pools at an edge and thins in the middle; a comic is ink dots on newsprint. These are properties of the medium and they live on the sheet or on the surface, never floating between the two (a pattern fixed to the screen slides over moving objects, the "shower door" effect; a pattern fixed to the surface shrinks with distance; the published answers blend scales, as in tonal art maps).
- **It has its own time.** Twos or ones, holds, how fast a thing settles. The house already steps its people at twelve poses a second in drawn looks.
- **It has its own physics, within reason.** The cloth, water, steam and springs all have dials (stiffness, damping, gravity). A pencil world can be lighter and slower; a watercolour world can overshoot and wobble. One dial at a time, and nothing a visitor has to learn.
- **It has its own cast.** A person drawn for that world, not a model from another world pushed through its shader.

What to read before the watercolour, and what each is for:

- Curtis, Anderson, Seims, Fleischer and Salesin, _Computer-Generated Watercolor_ (SIGGRAPH 1997): what the medium physically does: dark edges where a wash dries, backruns, granulation in the paper's valleys, glazes that mix like filters.
- Bousseau, Kaplan, Thollot and Sillion, _Interactive Watercolor Rendering with Temporal Coherence and Abstraction_ (NPAR 2006): how to get those effects in real time and keep them from swimming when things move.
- Montesdeoca, Seah, Rall and Benvenuti, _Art-Directed Watercolor Stylization of 3D Animations in Real-Time_ (Computers & Graphics, 2017): colour bleeding, and "gaps and overlaps" where the wash misses the line, placed by an artist rather than everywhere.
- Meier, _Painterly Rendering for Animation_ (SIGGRAPH 1996), and Hertzmann, _Painterly Rendering with Curved Brush Strokes of Multiple Sizes_ (SIGGRAPH 1998): strokes that follow form and stay put from frame to frame.
- For pencil: Praun, Hoppe, Webb and Finkelstein, _Real-Time Hatching_ (SIGGRAPH 2001, already in the Graphics Lab's sources), and Lee, Kwon and Lee, _Real-Time Pencil Rendering_ (NPAR 2006).
- For the comic print: Sony Pictures Imageworks' own published accounts of the two _Spider-Verse_ films (halftones, hatching, misregistration in place of blur, mixed frame rates). Read them before writing a rule; I have not verified details against them yet.

Painters to look at before deciding what "uniquely Sirui" means, each for one thing: Raoul Dufy, for colour laid in loose patches that deliberately miss the drawn line; the Fauves (Matisse, Derain), for colour chosen for feeling rather than for the object; Paul Klee's watercolours, for stepped glazes; John Singer Sargent's, for light made by leaving the paper white; Chinese freehand ink painting, for few strokes and deliberate empty space; Hiroshi Yoshida and Kawase Hasui, already behind the woodblock, for one drawing printed as many hours. The first exercise is to pick three parents and write one sentence for what is taken from each. That page is J8 for the watercolour.

Not verified, and to check before any of it is quoted publicly: the page numbers and exact titles above are from memory.

### Heat: what a thermal camera would see here

Sirui wants a thermal-camera world that simulates heat and is beautiful. The cheap version, a colour map over the lit picture, is wrong in ways anyone who has used such a camera would feel: it would show sunlight as heat and let you see through glass. The design starts from what the instrument measures.

**What the camera sees.** A long-wave infrared camera reads what a surface emits and what it reflects: emissivity times the glow of its own temperature, plus the rest as a mirror of its surroundings. So:

- Light does not count; temperature does. A sunlit wall is bright because it has been warming for hours, and it stays bright after the sun leaves it. A shadow that has just moved leaves a cool patch behind.
- Glass is opaque and mirror-like. The glass front shows the sky and the sea, not the rooms. Sirui's spectacles are two dark discs.
- Polished metal is a mirror too: the brass rails and the bar's chrome read as the cold sky even when warm. Blackened steel and rubber read true.
- Water shows only its skin: the onsen bright at about 41 °C, the pool middling, the sea dark by day. Wet things read cool, so wet footprints from the pool are dark and fade as they dry.
- People: face and neck warmest, nose and fingers cooler, hair and clothes cooler still. The working muscles warm over a set and fade in the rest. After the onsen the whole figure glows.
- Things touched keep the touch: a handprint on the bar, a warm seat after standing, the shape of a sleeper in the bed.
- By day the rock is warmer than the sea; at night it is the other way round. Twice a day they match and the picture goes flat (the thermal crossover). The clear night sky is the coldest thing in view.
- The instrument has a character: few pixels, a soft lens, a little noise, a faint trail behind anything hot that moves, and a shutter that clicks and freezes the picture for a moment when it recalibrates. Its picture always spans the coldest to the hottest thing in view, with a scale down the side.

**The model, small enough to run every frame.**

- A temperature and an emissivity for each material, from a table keyed by the material names the house already uses.
- The day: outside air from the site's own forecast, the sea from the season (the pier at Scripps has a daily record that could be fetched like the forecast), and two thermal masses, a quick one (timber, leaves, cloth) and a slow one (rock), each a first-order lag behind the sun. The baked sky-visibility in the vertex colours says how exposed a surface is.
- Things with their own heat, driven by the routine that already runs the house: the coffee cools on Newton's curve from the minute it was made, the stove and the fire heat and cool, lamps warm when lit, the bed holds the night.
- Bodies as regions with their own temperatures, plus exertion per lift and wetness after water.
- Memory: a top-down texture of the floors that feet stamp and time fades, and a scalar per seat and per grip.
- What reaches the camera: emissivity times the surface, plus the rest reflecting the sky outdoors or the room indoors.

**How it is drawn.** In this world the lit render is not needed at all. One pass draws every object with one small material that writes apparent temperature, at the sensor's low resolution; a second maps it through the palette with the automatic span, the lens, the noise and the trail. That is far less work than the realistic frame, so this world should be the fastest one. The pointer is a spot meter that reads the true value under it and says what the thing is. A click leaves a handprint.

**The look.** Palettes designed in OKLab so they do not band. Three to try: the classic ironbow; one built on the site's own colours, with body temperature landing on the brand orange and the night sea on indigo; and white-hot with grain. Sirui's reference is a reel I could not open, so the first frames are a question to him.

**Checks, so "prediction" means something.** The coffee against a measured cooling curve; skin regions against published thermography; the rock's daily swing against measured sandstone; the sea against the pier.

**What to read first.** Emissivity tables in a heat-transfer text (Incropera and DeWitt). Vickers, "Plateau equalization algorithm for real-time display of high-quality infrared imagery" (Optical Engineering, 1996), for the automatic span. Berdahl and Martin on clear-sky emissivity (1984) for the night sky. Ring and Ammer, "Infrared thermal imaging in medicine" (2012), and the exercise thermography reviews, for bodies. The synthetic infrared scene generators (DIRSIG at RIT) for how the full problem is posed. All from memory: check each before it is cited publicly.

**Honest limits to state when it ships.** Air is invisible to such a camera, so warm plumes over the fire would be a labelled extra, not the instrument. The temperatures are a model of a house that does not exist.

### What flashes

"The 3d scene sometimes has weird flashing issue" had no place or time attached, and under automation the scene pins its quality tier, so the first captures could not show what a visitor's machine does. The method that worked: keep every drawn frame as a 192 × 108 luma image inside the page, in the same task that drew it, then look for frames whose change reverses on the next frame or whose mean brightness jumps, and log the room and the light levels beside them.

- Standing still in the stair hall: 259 frames, no change at all. Nothing flickers by itself.
- Walking: every change of room moved lamps in one frame and refitted the sun's shadow. On the entrance stairs the "room" changes three times because the hall is not a room.
- The lamps now ease (H7). The rest is listed there.
- The lesson for next time: when a complaint has no coordinates, record everything and let the numbers say where to look, and say plainly which cause was found and which was not.

### An arrival that earns the sea

The house's best view is the Pacific through the cave mouth. The present entrance spends three flights in a square shaft and delivers the visitor to a wall. The brief:

- **Hide, then show.** Japanese stroll gardens call it _miegakure_; Wright called his version compression and release. The stair should be narrow, low and dim, in the rock, and the first sight of the sea should come at a chosen step, not gradually.
- **An axis to the horizon.** The local precedent is two miles up the coast: at Kahn's Salk Institute a line of water in the court runs straight at the Pacific. This house already has a rill at its arrival (`arrival-rill.mjs`). The last flight should come down on the living room's centre line, facing the glass front, with the horizon appearing under a lintel set for that purpose.
- **A threshold at the bottom.** A place to stop: the bench and hooks that are there, a change of floor, then the room.
- **Options to mass before building:** (A) keep the upper flights and replace the last with a straight run on the axis; (B) one straight stair in a rock-cut slot beside the rill, which is what Codex's private candidate appears to be; (C) a path down the outside of the cliff, with the sea in view the whole way and therefore no reveal.
- **A test for the wow,** so it is not a matter of taste alone: from the portal to the last landing, sea and sky are under 2 % of a 60° view; within two steps they pass a third of it, with the horizon in the middle third of the frame.
- **What the hall must not repeat:** a ceiling too coarse for its baked light, fittings that float, lamps whose glow is a box.

### Sound made of the site

Sirui asked for music that adapts to the theme and to what the visitor does. The honest constraints first: I cannot record or compose audio files, browsers refuse sound before a gesture, and unasked-for sound on a personal site is hostile. Within them there is a good answer: synthesise everything in the page.

- **Off until asked.** One switch, remembered. Nothing plays, and no audio engine is created, before the visitor turns it on. Quiet, limited, silent when the tab is hidden.
- **One instrument, tuned by the hour.** The hour picks a scale and a tempo the way it picks the palette: open and sparse at dawn, bright at noon, minor and slow at night. A bed of two or three slow voices sits under everything, very low.
- **Every interface sound is a note in that scale,** so nothing clashes. The five navigation links are five notes, left to right. A switch going on rises; going off falls. A card opening plays an arpeggio as long as its spring. The thrown video row is air whose pitch follows its speed, with a soft knock when it lands. Scrolling is nearly silent, with one tone as each section arrives.
- **The house makes its own sound** from the simulation's events, so it can never drift out of step: the bamboo drips when the simulated drop lands, a plate rings when it goes on the bar, steps change from stone to oak, the sea is filtered noise shaped by the same wind the forecast gives the waves.
- **Each world has a timbre:** struck wood and plucked strings for the woodblock, slide whistles and xylophone for the cartoon, graphite on paper for pencil, drops and bowed glass for watercolour, a hum and a shutter click for heat, where the pointer's temperature is a pitch.
- **Moments worth a sound:** P noticing the pointer, the orange on the missing-page, a badge on the Wall of Rejection, the Build Rhythm chart played as the rhythm it is, the paper constellation as notes.
- **Cost and checks:** a few kilobytes, no files. A browser test that no audio context exists before the switch, and an offline render of each sound measured for peak level.

### Sound an agent can check

I cannot hear. That does not make sound unverifiable; it changes what is checked, and it leaves taste to Sirui's ears.

- **Keep the music as numbers.** `score.mjs` has no audio in it: keys, notes, times, levels. Arithmetic can then be tested: every interface note is in the hour's key, a row of links rises, on rises and off falls, the bed never piles above five voices or rests longer than twelve beats, no minute repeats.
- **Render without a speaker.** The engine's voices take any audio context, so the same code renders offline. `node bin/render_site_sound.cjs` writes a WAV file, a spectrogram and a row of measurements for every sound, each hour's bed and a 90-second day.
- **Look at it.** A spectrogram on a pitch axis shows what a listener would notice first: the note and its overtones, how hard the attack is, how long the tail rings, whether the room smears it. Looking found two faults before anyone had to hear them: the pad's two detuned oscillators cancelled completely once a second (a pulsing organ), and a sub-octave put most of the bed's energy between 55 and 100 Hz, where it is rumble on headphones and nothing on a laptop.
- **Measure it.** Peak and RMS in dBFS for every sound, the strongest pitch against the note the score asked for (within a few cents), and how long each sound stays audible.
- **Say what was not checked.** Whether it is pleasant, whether the bed is music or wallpaper, whether a knock on every press is charming or tiring by the tenth. Those need ears, and the record says so.

### A world is a contract

Applying a world to the whole site means more than colours. Before any of it launches, a world has to supply, and be tested for:

- **Tokens:** colour, type, radius, shadow, motion curves, sound. Layered so the hour's palette still works inside the world.
- **Skins** for the handful of components the site is made of: navigation, card, button, tag, figure, table, footer.
- **Three signature behaviours** that only this world has, each replacing a default rather than adding to it. In heat, what the pointer touches warms and the warmth fades; visited links are still warm. In pencil, a hover is a drawn underline that redraws itself. In the comic, a page change is a panel turn. In watercolour, colour bleeds past the edge of a pressed button.
- **Its states:** loading, empty, error, focus, print.
- **The 3D home's look and its sound set,** so the site and the house agree.

And what a world may never change: the words, the reading order, what is a link, contrast and focus that pass in every world, reduced motion, and the default world's page weight (a world's assets load only when it is chosen).

How to get there without breaking the site: one world on one page behind a flag; write down everything that broke; turn that list into the checklist for the next; sample the visual harness across worlds rather than multiplying 46 jobs by five.

### The flash that only a visitor could see

Three rounds to find one blank frame. What hid it:

- **Automation is not a visitor.** The scene pins its quality tier under `navigator.webdriver`, and even with `?quality=auto` the governor acts only when frames are slow because of the GPU, not the page's script. A headless run at an ordinary size never met that condition. A 4K buffer in the costliest look did, within ten seconds.
- **The instrument was blind to the fault.** The recorder copied each frame onto a 2D canvas without clearing it. A cleared WebGL canvas is transparent, so copying it changed nothing and the recorder reported a still picture. Drawing over white made the blank frame the loudest thing in the log.
- **His description was exact.** "I screenshot ... and i see flash again": the governor waits until the camera has rested 0.6 s. Holding still to take a screenshot is the trigger.

The rule that comes out of it: a canvas is only resized at the start of a frame that will draw it. And for the method: when an instrument reports "nothing", test it against a fault made on purpose before believing it.

### A film of the house

The thermal film Sirui sent is a lesson in staging more than in thermal imaging. Its maker controls three things: what is warm (so what the eye goes to), where the camera stands, and how long each picture lasts. The house has all three under program control, plus the hour.

A first shot list, to argue with:

1. **The coast, far and high, at dawn.** The house is a small warm mark in a cliff. Slow push in. This is the establishing shot, in the realistic look.
2. **Down the arrival stair** (when K exists): dark, close, the sound of water; then the room and the horizon. The reveal.
3. **The living floor, one slow lateral move** at standing height: fire, kitchen, the garden under the bedroom.
4. **A day in four cuts,** the same framing at breakfast, at the desk, in the gym, in the onsen: the house as a routine. This is where a cut can change look on purpose.
5. **The section:** rise through the roof until the house is a plan, hatched rock around lit rooms.
6. **Dusk from the sea:** the lamps come up on their dimmer, the pool glows, pull back to the first frame.

Rules for it: every shot is about one thing; no move without a reason; cuts on action or on the hour; the visitor can leave the rails at any moment and is standing exactly where the camera was; any look can be chosen at any time and the film does not restart. Reduced motion gets the same shots as stills with captions.

### What the thermal film is made of

Now seen (seven screenshots Sirui sent, November 14). It is stop motion on a miniature reef set, shot through a real thermal camera, with props warmed under heat lamps so that heat does the job of light:

- **Palette:** deep indigo for cold, through blue and teal, to red-orange, yellow and white for hot. Two complementary families and nothing else.
- **The figure is the hottest thing** in every frame, a small white shape; the set glows orange where the maker warmed it; the water is the indigo ground.
- **Softness is the medium:** low resolution, glow round hot things, gradients across the floor where a lamp fell. But silhouettes stay readable because the temperature differences are staged.
- **Composition carries it:** a diagonal of warm coral against a cold field, a small figure placed on a third, a spiral of warm fish round a centre, a top-down shot. Each frame would work as a poster.

What it changes in the plan for J9: the heat model is still the base (it is what makes the picture truthful), but the art direction is "heat as light": decide for each shot what should be warm, and let the routine supply it honestly (a body after the onsen, the fire, the coffee, sun-warmed rock at dusk against a cold sea). The palette is this one. And it belongs in the film (N) as much as in free roaming.
