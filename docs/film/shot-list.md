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

## Playable cut · November 20

From Rooms, choose Film. Thirteen shots take 1 minute 58 seconds. The separate Boat trip has two legs and takes 33 seconds. The opening holds on the coast, follows the actual stair through stone, and releases into the living room. A short shot under the study roof lets the viewer place the table between study and bar. Breakfast, the desk, rowing and the upper bath cover the working day. The section, record wall and moving lift carry the viewer back out to dusk and night. The day opens in Realistic. The kitchen and desk furniture, the rower and the horn are native camera anchors. [Contact sheet of the thirteen shots and two boat legs](../../artwork/concepts/coastal-home/2026-11-19/film-and-boat-12.webp).

The visitor can change the look, pause, scrub, skip or leave. Reduced motion holds a composed still at each cut. The 1.50 m eye in the descent clears the measured soffit throughout. Boat verification sampled 11,855 positions over the two legs and found at least 0.605 m of water. Exiting restored the saved camera with zero measured drift. Sound follows the cuts when the visitor enables it. Each world has its own score and recorded interaction replies. [Music and cue sheet](../house/world-music.md).

_The Door Is Open_ runs for all thirteen cuts. Sound sits beside Pause. A guitar introduces D–G–F♯ on the coast. The stair keeps its first nine seconds for steps, the five-second gym cut belongs to the rower, and the first violin waits for the record cabinet. The returning guitar and violin open out together at dusk. Pausing, seeking or turning Sound on in mid-film keeps the visitor on the musical beat of the current shot. [Score by cut](../house/world-music.md#the-film-score).

From the upper bath at night, cut directly to the already open section at noon. The camera can then spend the shot on the rooms within the rock. For a timing check on a fresh browser, start at 59 seconds and continue through the section. A second pass on the same device measures the cost after its graphics programs have loaded. [Cold and warm playback notes](../november-2026-takeover.md#november-20--music-for-one-walk-home).

## Returning to the first view

The first guitar notes find the house from the Pacific. The camera tracks 34 m along the coast at a constant height. A nearer shoulder of sandstone gives way to the two-storey arch. The lens moves from 41° to 34° as the warm interior comes into view. At 98 seconds the violin takes the opening figure over the reverse move. The final low D has the original offshore frame to itself. Selecting House film from the entrance prepares the headland and the clifftop planting before the first shot.

The November study used 7:05 a.m. with the sun 7.0° above the horizon. On June 21 the same light arrives at 6:23 a.m. The evening return runs from a sun height of 1.7° down to −6.5°. The training window, the glass lift and the boat follow the same solar calendar. The breakfast and desk cuts keep their local hours. Use `visitorRailShots(house, dateKey)` to reproduce any of these days. [Original concept and playable frames](../../artwork/concepts/coastal-home/2026-11-20/house-from-the-water.webp).

The film uses the clear air of the camera study. At the same focal length on a marine morning, the terrace almost disappeared behind the low cloud on a phone. Return restores the weather for the visitor’s own place and time. Boat uses that day’s weather throughout. The clifftop gliders fly while the sun is more than three degrees above the horizon, leaving the last evening shot to the windows and the sea.
