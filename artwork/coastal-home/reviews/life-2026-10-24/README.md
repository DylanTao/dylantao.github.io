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

## Banquette and cloud sofa (house's F12 anchors)

`seating-banquette-eat*`: on the nook's new L banquette (item `banquette`), every style seated in the eat clip lands where the house's nook actor sits: 0.44-0.46 m back from the bench front, matching the actor's 0.445 m. The back cushions' faces stand where the placeholder's upright backs stood. The humans press at most 1.3 cm into the back cushions and nothing hard. The Lizard's tail goes 5 cm into the cushions, and 3 of its vertices 1.1 cm into the plinth.

`seating-cloud-sofa-lounge*`, `seating-cloud-sofa-drink*`: on the lounge's U sofa (item `cloud-sofa`), at the house's lounge seat, nothing touches a hard part. The pillows sit clear of Sirui's place. Every style's right shin presses 6-8 cm into the right side run's corner seat (Lizard 8.3 cm).

Best effort so far, the sofa's corner seat: the house's lounge actor sits at x 1.045 in the sofa's frame, 0.11 m from where the right side run begins (x 1.155 on the back run, its seats from x 1.28). In the lounge and drink clips the knees and shins splay toward that side. Pulling the side seats back from x 1.22 to the placeholder's 1.28 cut the press from 8.5 to 7 cm (Ghibli); the placeholder itself left the shins in that spot. Next hypothesis: move the lounge actor about 0.25 m toward the sofa's centre (sofa frame x about 0.8, the middle of the back run's fourth seat). That is a house manifest change, so it is offered to house rather than made here.
