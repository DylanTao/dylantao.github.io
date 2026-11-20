# Strength training in the coastal gym

Five delivered avatar meshes were posed with the same bar path and skinned clothing that visitors see. The 14.5 mm shaft gauge includes its faceted surface. Hands and upper-back or front-shoulder support are intended contact. A positive value in the table measures clearance from the gauge in millimetres. The number after the slash is the normalized phase of the repetition.

The initial full sweeps found the shaft inside four front-rack sleeves or forearms, a small back-squat forearm rub, and a gap at several overhead grips. The fitted front rack changes the outward elbow and grip reach for those bodies. The overhead press reuses the existing held-grip extension. All three bench variants clear the lower chest by at least 16.0 mm. The densest overhead run cleared every head by at least 8.85 mm. Clothing uses opaque skinned geometry. Bedroom linen is a separate cloth simulation.

Each row covers a held work repetition. Setup and reracking can be tested as separate actions. The focused tests cover eight cases. For an exact triangle and phase, run from the checkout.

```powershell
node bin/audit_coastal_lift_contacts.mjs --avatar lizard --lift front-squat --phase 0.4609375 --out .jekyll-cache/lift-witness.json
```

That pose reproduced a 6.2068 mm forearm gap at skin triangle 43254. A 129-phase overhead sweep for all five avatars used 128.36 seconds on the shared Windows laptop. Repeat the full diagnostic when an avatar, shirt, bar or pose changes. The ordinary test suite keeps its smaller phase set.

| Avatar         | Lift             | Phases | Head                  | Torso                  | Upper arm or forearm      | Clothing                 | Least engaged hand     |
| -------------- | ---------------- | -----: | --------------------- | ---------------------- | ------------------------- | ------------------------ | ---------------------- |
| lizard         | Back squat       |     97 | 1.77 / 0.46875 head   | 3.00 / 0.46875 torso   | 1.37 / 0.00000 forearm    | 3.00 / 0.46875 torso     | -10.11 / 0.79167 handR |
| lizard         | Front squat      |    129 | 101.59 / 0.00000 head | 6.50 / 0.00000 torso   | 2.49 / 0.46094 upper-arm  | 2.49 / 0.46094 upper-arm | -14.50 / 0.00000 handL |
| lizard         | Flat bench       |     49 | 222.74 / 0.45833 head | 18.32 / 0.45833 torso  | 105.41 / 0.66667 forearm  | 18.32 / 0.45833 torso    | -14.50 / 0.00000 handL |
| lizard         | Incline bench    |     49 | 74.90 / 0.18750 head  | 19.85 / 0.45833 torso  | 108.19 / 0.70833 forearm  | 19.85 / 0.45833 torso    | -14.50 / 0.00000 handL |
| lizard         | Close-grip bench |     49 | 222.74 / 0.45833 head | 18.32 / 0.45833 torso  | 87.53 / 0.45833 upper-arm | 18.32 / 0.45833 torso    | -14.50 / 0.00000 handL |
| lizard         | Overhead press   |    129 | 17.01 / 0.64063 head  | —                      | 53.34 / 0.90625 forearm   | —                        | 0.14 / 0.34375 handL   |
| south-park     | Back squat       |     97 | 14.45 / 0.46875 head  | 1.90 / 0.46875 torso   | 37.75 / 0.94792 forearm   | 1.90 / 0.46875 torso     | -14.50 / 0.00000 handL |
| south-park     | Front squat      |     97 | 18.38 / 0.46875 head  | 2.08 / 0.00000 torso   | 8.81 / 1.00000 upper-arm  | 2.08 / 0.00000 torso     | -14.50 / 0.00000 handL |
| south-park     | Flat bench       |     49 | 91.18 / 0.45833 head  | 16.04 / 0.45833 torso  | 56.66 / 0.66667 forearm   | 16.04 / 0.45833 torso    | -14.50 / 0.00000 handL |
| south-park     | Incline bench    |     49 | 78.79 / 0.60417 head  | 18.43 / 0.45833 torso  | 56.31 / 0.22917 forearm   | 18.43 / 0.45833 torso    | -14.50 / 0.00000 handL |
| south-park     | Close-grip bench |     49 | 91.18 / 0.45833 head  | 16.04 / 0.45833 torso  | 52.31 / 0.75000 forearm   | 16.04 / 0.45833 torso    | -14.50 / 0.00000 handL |
| south-park     | Overhead press   |    129 | 15.10 / 0.21094 head  | —                      | 33.85 / 1.00000 forearm   | —                        | -14.50 / 0.00000 handL |
| simpsons       | Back squat       |     97 | 7.09 / 0.46875 head   | 1.17 / 0.46875 torso   | 21.00 / 0.00000 forearm   | 1.17 / 0.46875 torso     | -11.86 / 0.00000 handR |
| simpsons       | Front squat      |     97 | 43.87 / 0.00000 head  | 1.94 / 0.00000 torso   | 1.57 / 0.46875 upper-arm  | 1.57 / 0.46875 upper-arm | -14.50 / 0.00000 handL |
| simpsons       | Flat bench       |     49 | 217.61 / 0.45833 head | 16.06 / 0.45833 torso  | 68.75 / 0.27083 forearm   | 16.06 / 0.45833 torso    | -14.50 / 0.00000 handL |
| simpsons       | Incline bench    |     49 | 143.14 / 0.62500 head | 22.31 / 0.45833 torso  | 66.71 / 0.70833 forearm   | 22.31 / 0.45833 torso    | -14.50 / 0.00000 handL |
| simpsons       | Close-grip bench |     49 | 217.61 / 0.45833 head | 16.06 / 0.45833 torso  | 61.40 / 0.25000 forearm   | 16.06 / 0.45833 torso    | -14.50 / 0.00000 handL |
| simpsons       | Overhead press   |    129 | 26.28 / 0.64844 head  | —                      | 55.18 / 0.15625 forearm   | —                        | -14.50 / 0.00000 handL |
| ghibli         | Back squat       |     97 | 6.16 / 0.46875 head   | 2.83 / 0.46875 torso   | 24.66 / 0.00000 forearm   | 2.83 / 0.46875 torso     | -13.56 / 0.00000 handR |
| ghibli         | Front squat      |     97 | 79.50 / 0.46875 head  | 1.93 / 0.00000 torso   | 1.62 / 0.46875 upper-arm  | 1.62 / 0.46875 upper-arm | -14.50 / 0.00000 handL |
| ghibli         | Flat bench       |     49 | 254.24 / 0.45833 head | 16.10 / 0.45833 torso  | 67.87 / 0.27083 forearm   | 16.10 / 0.45833 torso    | -14.50 / 0.00000 handL |
| ghibli         | Incline bench    |     49 | 189.76 / 0.33333 head | 22.32 / 0.45833 torso  | 66.86 / 0.25000 forearm   | 22.32 / 0.45833 torso    | -14.50 / 0.00000 handL |
| ghibli         | Close-grip bench |     49 | 254.24 / 0.45833 head | 16.10 / 0.45833 torso  | 62.02 / 0.25000 forearm   | 16.10 / 0.45833 torso    | -14.50 / 0.00000 handL |
| ghibli         | Overhead press   |    129 | 54.53 / 0.70313 head  | 54.23 / 0.00000 torso  | 45.72 / 0.17969 forearm   | 54.23 / 0.00000 torso    | -14.50 / 0.00000 handL |
| rick-and-morty | Back squat       |     97 | 6.93 / 0.46875 head   | 1.19 / 0.46875 torso   | 15.87 / 0.00000 forearm   | 1.19 / 0.46875 torso     | -14.50 / 0.00000 handL |
| rick-and-morty | Front squat      |     97 | 50.07 / 0.46875 head  | 1.95 / 0.00000 torso   | 5.53 / 0.46875 upper-arm  | 1.95 / 0.00000 torso     | -14.50 / 0.00000 handL |
| rick-and-morty | Flat bench       |     49 | 221.36 / 0.45833 head | 16.04 / 0.45833 torso  | 75.73 / 0.87500 forearm   | 16.04 / 0.45833 torso    | -14.50 / 0.00000 handL |
| rick-and-morty | Incline bench    |     49 | 158.60 / 0.33333 head | 22.34 / 0.45833 torso  | 80.21 / 0.06250 forearm   | 22.34 / 0.45833 torso    | -14.50 / 0.00000 handL |
| rick-and-morty | Close-grip bench |     49 | 221.36 / 0.45833 head | 16.04 / 0.45833 torso  | 67.51 / 0.25000 forearm   | 16.04 / 0.45833 torso    | -14.50 / 0.00000 handL |
| rick-and-morty | Overhead press   |    129 | 8.85 / 0.24219 head   | 109.41 / 0.00000 torso | 68.32 / 0.18750 forearm   | 109.41 / 0.00000 torso   | -14.50 / 0.00000 handL |
