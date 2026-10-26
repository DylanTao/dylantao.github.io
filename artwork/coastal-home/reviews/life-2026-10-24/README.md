# Life review, October 24-26

Evidence for the life checkpoints: meals at the nook, the Lizard's face, and comfortable seating. Screens and measurements are under `.jekyll-cache/visual-qa/life-2026-10-24/` (not committed); the files here are the ones worth keeping.

## Meals (L1-L3, on main)

Five breakfasts, five lunches, seven dinners and five desserts rotate by date. Each dish carries one or two salient ingredients that still read at a 390-pixel phone width, rather than a full recipe: the balance Susan Kare calls "just enough detail" ([Designing Icons & Graphics for the Original Mac](https://www.youtube.com/watch?v=YEvLKzsEwMw), Startup School 2026).

At the composed stills no hand or forearm vertex is inside the nook's table, at breakfast, lunch or dinner, for any style. The Lizard now sits on the banquette's cushion instead of 1.2 cm inside it.

## The Lizard's face

`character-finish.json` (from `bin/refresh_coastal_character_finish.py`). The face skin was rebuilt as one continuous surface, and the same open mouth was cut again with its original tool, so the lips no longer zigzag at 4K. Nothing realistic was added: the aim was a cleaner face, not a more detailed one, which is Kare's "just enough detail" again. The other four styles were inspected at 4K and needed no change.

## Dining armchairs

`seating-dining-chair-eat.json` and the `seating-dining-chair-eat-*.png` stills come from `bin/review_coastal_seating.py`. Each style sits in its eat clip with its pelvis 1 cm into the seat cushion and its back 5 mm from the backrest. No style touches the oak frame except the Lizard's tail (5 vertices, 8 mm) and a South Park hand resting on an arm (1.9 mm). The hips clear the arms by 3.2-7.3 cm.

## Whiskey corner, feet up

`seating-whiskey-loveseat-lounge.json` and its stills: each style sits in its lounge clip on the loveseat's left seat, with both ankles laid on the ottoman by an IK solve of each leg (`--feet`), knees up. The lounge clip itself keeps the feet down, so feet up needs that leg solve at runtime too. With the ottoman's centre 0.86 m in front of the loveseat's origin and in line with its left seat, every style's ankles reach (0 mm gap) with the knees bent 25-37 degrees, and nothing touches a hard part. Soft contact is at most 2.3 cm, except the Lizard's 7.3 cm (its tail into the cushions).
