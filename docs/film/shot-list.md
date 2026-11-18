# The film of the house: a shot list

docs/todo.md, item 11, step N1: the film on one page, before any camera code. Developed by Claude as creative director on November 17, 2026 from the first list in the takeover notes' notebook card "A film of the house". Sirui, November 14: "a better mini-movie like experience", a choreographed walk-through or drone flight where visitors "can switch to different non-photoreal render or the most photoreal one in the beginning and they can freely switch", with the site's own music.

**About two minutes. Nine shots.** Lenses are full-frame equivalents. Every move eases in and out. Shots marked _later_ wait for the room they show.

| #   | Shot                                     | What it is for                                                                          | Lens and move                                   | Length  | Hour                         | Look                                                                            | Sound                                 |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ------- | ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | The coast, far and high                  | Where this is: a small warm mark in a long cliff                                        | 85 mm, slow push in from the sea, 40 m up       | 12 s    | dawn                         | realistic                                                                       | the sea, a low string note            |
| 2   | Down the arrival stair _(later, item 6)_ | The reveal: dark and close, then the room and the horizon                               | 24 mm, handheld-steady walk at eye height       | 14 s    | morning                      | realistic                                                                       | steps on stone, the sea grows         |
| 3   | The living floor                         | The house as a home: fire, kitchen, the garden under the bedroom                        | 35 mm, one slow lateral move at standing height | 15 s    | morning                      | realistic                                                                       | room tone, a kettle                   |
| 4   | A day in four cuts                       | The house as a routine: breakfast, the desk, the gym at the glass _(item 3)_, the onsen | 50 mm, the same framing each time, locked off   | 4 × 5 s | breakfast, noon, dusk, night | a cut may change look on purpose: realistic, painted, painted, painted at night | the hour's motif, one bar each        |
| 5   | The section                              | The plan: rise through the roof until the house is hatched rock around lit rooms        | 50 mm, crane straight up                        | 10 s    | noon                         | realistic, then the drawn section                                               | quiet                                 |
| 6   | Behind the bookcase _(later, item 4)_    | The secret: the study, the bookcase swings, the warm bar, the slot of sea               | 28 mm, push through the door                    | 10 s    | evening                      | painted (oil)                                                                   | the bookcase's hinge, a record starts |
| 7   | The glass lift down _(later, item 4)_    | The cliff and the sea from the cab, all the way down                                    | 24 mm, inside the cab facing out                | 12 s    | dusk                         | realistic                                                                       | the cab's hum, gulls                  |
| 8   | Dusk from the sea                        | The lamps come up on their dimmer, the pool glows                                       | 85 mm, slow pull back to shot 1's frame         | 14 s    | dusk to night                | painted at dusk, oil by night                                                   | the motif in full                     |
| 9   | The title                                | Stillness on the night coast; the name; the visitor takes over                          | locked off on shot 8's last frame               | 6 s     | night                        | any                                                                             | the last note                         |

## Rules

- Every shot is about one thing; no move without a reason; cuts on action or on the hour.
- The visitor can leave the rails at any moment and stands exactly where the camera was.
- Any look can be chosen at any time, and the film does not restart.
- Reduced motion gets the same shots as stills with captions.
- The camera never passes through geometry; each move is checked against the collision grid and the section's lifted roofs.

## Making it

- **N2:** a small module that plays keyed shots (position, target, lens, easing, hour, look) over the live scene: pausable, scrubbable, skippable.
- **Capture for a file** (a trailer, a social clip): frame-exact capture of the canvas (CCapture.js, from the tools list in `docs/creative-direction.md`), rendered overnight on the PC, never rented GPUs.
- **Music:** item 8's first composed piece, cut to the shot lengths above.
- **Judge it** like a film: a contact sheet of every shot's first, middle and last frame beside the references before any full render.
