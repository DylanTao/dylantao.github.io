# The heat world: rule sheet

A one-page contract to agree before any shader (docs/todo.md, item 12; takeover notes J9, and the notebook card "Heat: what a thermal camera would see here", which holds the physics). Written by Claude as creative director on November 17, 2026.

## What it is

Sirui, November 14: "the thermal camera view ... really good heat simulation and temperature prediction ... for different material, like water, solid, human, light, fire spot, food, when lifting"; "we have to make it really aesthetic". His reference was a stop-motion film shot through a real thermal camera on a miniature reef: deep indigo cold to orange and white hot, a tiny white-hot figure, every frame composed like a film still. He wants it done better "in our physics world where you control everything", and "composition and layout in the scene matter".

So: the house as a thermal camera would see it, where temperature is the only light, and the composition is a film's.

## What a thermal camera shows, and what that asks of the renderer

- **Temperature, not light.** Each surface has a temperature from physics: sun-warmed rock and glass by day, cooling at night; people at body heat; the fire, lamps and the stove hot; water cool and slow to change; food warm for a while; a working muscle warming in the gym.
- **Emissivity.** Polished metal and glass reflect the heat of their surroundings instead of showing their own, so a window can show a ghost of the sky's cold.
- **Heat spreads and lingers.** A chair keeps the warmth of whoever sat in it; footprints fade on the floor; steam rises warm from the onsen.
- **One palette, one range.** Indigo for the coldest, through violet and red to orange, yellow and white for the hottest, mapped over a range chosen for each view so the subject sits in the warm end (as a camera operator sets the span).
- **Soft and a little low-resolution,** as a thermal sensor is: slight blur, a little noise, no hard lines.

## The rules

1. **Every temperature comes from the heat model,** never painted by hand to look good.
2. **The palette is fixed;** only its span moves, per view, eased between views.
3. **The subject is the hottest thing in frame:** Sirui, the fire, a cup of coffee. Compose for it.
4. **Lingering heat tells what happened:** a warm seat, fading footprints, a warm bar after a lift.
5. **Night is where it shines:** the cold sea and sky make every warm thing glow.

## His figure, a companion, sound

Sirui as a warm, glowing figure whose hands and face are hottest and whose working muscles warm in the gym. A companion that is cold-blooded and nearly invisible until it basks on a warm stone. Sound: a low hum, as of the camera itself, and the house's real sounds muffled.

## What must not change

The house, rooms, controls, accessibility and reduced motion, and the realistic render as the default.

## How it is judged

In four views: the gym mid-lift, the living room with the fire at night, the onsen's steam, and the coast at night from the sea. It is ready when a frame reads at a glance as a thermal image, and as a composed still.
