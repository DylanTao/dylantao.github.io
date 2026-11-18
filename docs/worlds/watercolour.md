# The watercolour world: rule sheet

The world that is Sirui's own. A one-page contract to agree before any shader is written (docs/todo.md, item 12; takeover notes J3 and J8). Written by Claude as creative director on November 17, 2026. Change it when Sirui's eye says so, and record why.

## What it is

Sirui, November 13: "a sirui-style that is uniquely sirui ... illustration like water color crazy world with vibrant color and wacky physics and expressive stroke". On every drawn world: "they should not just cheaply do a trivial shitty transform"; "super high quality and unique art style and material texture, render, even physics can be different". The mood for the whole home (November 16): calm and beautiful, never eerie.

So: a sunlit sketchbook of the house, painted fast and confidently in transparent colour on white paper, where things are a little alive. Vivid, but airy, never muddy. Joy, not chaos.

## How watercolour works, and what that asks of the renderer

Taken as technique only, from the research that modelled it. No painting is copied.

- **Paper is the light.** Watercolour is transparent: the brightest thing in the picture is the paper showing through, and darks are built by layering. Highlights are left, not painted. The renderer starts from white paper and subtracts colour, the opposite of the painted look's opaque strokes. (Curtis et al., "Computer-Generated Watercolor", SIGGRAPH 1997, model pigment as layers that absorb light over the paper.)
- **Edges darken.** As a wash dries, pigment flows to its rim and leaves a darker edge. Every colour area gets a soft dark rim, and that rim, not an ink line, is what draws the shapes. (Curtis et al. 1997; Bousseau et al., "Interactive watercolor rendering with temporal coherence and abstraction", NPAR 2006.)
- **Granulation and the paper's tooth.** Pigment settles into the paper's grain, more in the darks and in some colours (blues, earths) than others. A paper texture fixed to the sheet, deepening where colour is dense. (Bousseau et al. 2006.)
- **Wet in wet.** Where two wet colours meet they bleed into each other with soft feathered edges; where one is laid over a dry one, the edge is crisp. The renderer chooses: big masses (sky, sea, distant land) wet in wet; near objects wet on dry.
- **Abstraction.** A watercolourist leaves things out. Detail is simplified by distance and by importance: the subject of a view is described, the rest is a wash. (Bousseau et al. 2006 abstract the image before stylising it; MNPR, Montesdeoca et al., Expressive 2018, lets an artist paint where the effect is stronger or weaker.)
- **Art direction in place.** Every effect (edge darkening, bleeding, granulation, dry brush, abstraction) is a control a person can paint onto parts of the scene, not one global knob. (MNPR, Montesdeoca et al. 2018; "Art-directed watercolor stylization of 3D animations in real-time", Montesdeoca et al., Computers & Graphics, 2017.)

## The rules

1. **White paper, transparent colour.** No opaque white paint. Highlights are paper.
2. **Few, vivid colours per view.** A palette of five to seven pigments mixed on the page, after the site's own: the orange (cadmium-like), a warm yellow, a cerulean and an ultramarine, a sap green, a burnt sienna, a violet for shadow. Shadows are cool colour, never grey.
3. **Shapes are drawn by edge darkening and the paper's white,** with a fine pencil underdrawing that shows through in places (a few lines, never an outline round everything).
4. **Masses wet in wet, subjects wet on dry.** The sky and the sea bleed; the subject of the view has crisp edges.
5. **Abstraction follows attention.** The view's subject is described in detail; what is behind it dissolves into washes; the frame's edges vignette to paper.
6. **The hour changes the palette and the water.** Morning: cool, much paper. Noon: vivid, crisp. Dusk: warm glazes, more bleeding. Night: deep ultramarine glazes with the lamps left as paper, glowing.
7. **Nothing swims.** Paper texture is fixed to the sheet; washes and granulation are fixed to the surfaces they colour, so a moving camera does not drag texture across the world.

## Wacky physics, gently

The world is a little alive, the way an illustration is: things settle with a soft bounce instead of stopping dead, plants sway more, water ripples bloom outward as colour rings, a door swings with a little overshoot, the companion bobs. Exaggerated timing (squash and stretch, anticipation, follow-through), never chaos, never motion sickness: off under reduced motion. Physics stays plausible enough that walking still works.

## His figure, his companion, the sound

- **Sirui** as a few confident brush marks with a pencil line, his clothes in two washes; his walk a little springy.
- **A companion** of the world's own: a small ink-and-wash creature (to choose with him).
- **Sound** (with item 8): soft and papery. Brush on paper for steps, water drips for clicks, a light piano or clarinet motif for the hour, never by default.

## What must not change

The house, its rooms and their layout; walking, the Rooms panel and every control; accessibility and reduced motion; the realistic render as the default. A world is a contract, not a filter (takeover notebook card "A world is a contract").

## How it is judged

Beside the references in `docs/creative-direction.md`, "The bar", and against these rules, in four views: the coast at noon; the living room at dusk; the kitchen nook at night with its lamp; Sirui in the gym. First one room, the living room, end to end, before any other room (J3). It is ready when Sirui would hang a frame of it on a wall.

## Sources

- Cassidy J. Curtis, Sean E. Anderson, Joshua E. Seims, Kurt W. Fleischer and David H. Salesin. Computer-Generated Watercolor. SIGGRAPH 1997.
- Adrien Bousseau, Matt Kaplan, Joëlle Thollot and François X. Sillion. Interactive Watercolor Rendering with Temporal Coherence and Abstraction. NPAR 2006.
- Santiago E. Montesdeoca, Hock Soon Seah, Hans-Martin Rall and Davide Benvenuti. Art-directed Watercolor Stylization of 3D Animations in Real-time. Computers & Graphics, 2017.
- Santiago E. Montesdeoca, Hock Soon Seah, Amir Semmo, Pierre Bénard, Romain Vergne, Joëlle Thollot and Davide Benvenuti. MNPR: A Framework for Real-Time Expressive Non-Photorealistic Rendering of 3D Computer Graphics. Expressive 2018.

Check each citation against the paper before it goes into the Graphics Lab record.
