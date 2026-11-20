"""The Door Is Open, an original chamber score for the visitor's film.

Each part gives its entrance in quarter notes within the named shot, pitch,
length in beats and level in dB. A common 96 bpm lets a pickup cross an edit.
"""

TITLE = "The Door Is Open"
BEAT = 60 / 96

# The player looks up the cut it actually admitted. The unscored training
# shot belongs to the rower's chain and fan.
CUTS = (
    ("coast-dawn", 12),
    ("arrival", 14),
    ("living-floor", 15),
    ("dining-terrace", 5),
    ("breakfast", 5),
    ("desk", 5),
    ("training", 5),
    ("onsen", 5),
    ("section", 10),
    ("listening-room", 10),
    ("glass-lift", 12),
    ("coast-dusk", 14),
    ("coast-night", 6),
)

# D, the upward fourth to G, and the half-step back to F sharp carry the
# question. It passes from a guitar near the centre to the bow over the sea.
PARTS = {
    "coast-dawn": {
        "guitar": [
            (1.00, "D3", 3.8, -27), (5.02, "D3", 3.9, -29),
            (9.00, "D4", 2.7, -25), (12.04, "G4", 1.76, -25.5),
            (14.02, "Fs4", 3.6, -26), (16.01, "A2", 2.9, -31),
        ],
    },
    "arrival": {
        # Leave the first flight entirely to the visitor's shoes. The guitar
        # begins to anticipate the room as the bottom landing comes into view.
        "guitar": [(14.41, "A2", 3.4, -31), (18.43, "D3", 2.4, -28.5), (21.45, "A3", 0.78, -30)],
    },
    "living-floor": {
        "guitar": [
            (0, "D3", 2.9, -25), (1.50, "A3", 1.38, -29), (1.55, "D4", 1.42, -30),
            (3.51, "A2", 0.70, -29), (4, "G2", 2.95, -25), (5.51, "B3", 1.40, -28.5),
            (5.56, "D4", 1.42, -30.5), (7.48, "A2", 0.76, -29.5),
            (8, "B2", 2.84, -25), (9.52, "D4", 1.40, -29), (9.56, "A3", 1.34, -30),
            (11.52, "B3", 0.80, -29.5), (12, "G2", 2.95, -25.5), (13.52, "A3", 1.43, -29),
            (13.55, "D4", 1.46, -29.5), (15.52, "G3", 0.74, -30),
            (16, "D3", 2.93, -25), (17.52, "A3", 1.44, -28), (17.57, "Fs4", 1.40, -30),
            (19.52, "D3", 0.88, -29), (20, "A2", 2.95, -26), (21.49, "E4", 1.84, -28),
        ],
        "cello": [
            (0.20, "D3", 2.48, -24), (3.14, "G3", 1.27, -23), (4.74, "Fs3", 3.02, -23.5),
            (8.18, "A3", 2.56, -22.5), (11.10, "B3", 1.06, -24), (12.55, "G3", 2.83, -23),
            (16.24, "Fs3", 2.64, -23.5), (19.58, "E3", 2.63, -24),
        ],
    },
    "dining-terrace": {
        "guitar": [(0, "D3", 2.98, -26), (1.51, "A3", 1.37, -29), (3.53, "D4", 0.82, -28.5),
                  (4, "G2", 2.97, -26), (5.53, "B3", 1.45, -28), (5.58, "E4", 1.5, -30)],
        "cello": [(0.11, "Fs3", 2.85, -24), (4.16, "G3", 2.81, -23.8)],
    },
    "breakfast": {
        "guitar": [(0, "D3", 2.9, -26), (1.49, "Fs4", 1.58, -29), (3.56, "A3", 0.82, -30),
                  (4, "A2", 2.98, -27), (5.54, "E4", 1.71, -29.5)],
        "cello": [(0.15, "A3", 2.97, -23.5), (4.15, "E3", 2.68, -25)],
    },
    "desk": {
        "guitar": [(0.03, "D3", 3.9, -28), (0.15, "A3", 3.7, -30.5), (4.10, "D4", 2.55, -30)],
    },
    "onsen": {
        "guitar": [(3.56, "A3", 3.5, -31.5), (5.07, "D4", 2.46, -34)],
    },
    "section": {
        "guitar": [(0.40, "D3", 4.8, -29), (6.41, "A3", 3.25, -29.5),
                  (12.42, "D4", 2.7, -28), (15.01, "E4", 0.63, -29)],
        "cello": [(8.54, "A2", 3.00, -28.5), (13.14, "D3", 2.69, -27)],
    },
    "listening-room": {
        # One player leans out into the gap between the other two. Leave
        # most of the second bar under the bow empty.
        "guitar": [(0.00, "G2", 3.50, -26), (1.53, "D4", 2.15, -29), (4.03, "D3", 3.72, -26.5),
                  (8.00, "B2", 3.03, -25.8), (9.53, "A3", 1.40, -29), (9.58, "D4", 1.68, -30),
                  (12, "G2", 3.4, -26), (13.54, "B3", 1.79, -29)],
        "violin": [(0.31, "D4", 2.54, -23.4), (3.32, "G4", 2.73, -22), (6.40, "Fs4", 3.0, -22.8),
                   (10.67, "A4", 2.59, -22.2), (13.78, "G4", 1.95, -24)],
    },
    "glass-lift": {
        # The open fifth continues across the descent. Its third is withheld
        # until the last panorama, so opening the view changes the harmony.
        "guitar": [(0.22, "D3", 4.36, -27.8), (5.41, "A3", 3.79, -29.8),
                  (12.15, "A2", 3.83, -29), (17.62, "E4", 1.23, -29.5)],
        "cello": [(1.33, "D3", 2.95, -26.5), (10.37, "A2", 2.92, -27)],
    },
    "coast-dusk": {
        "guitar": [(0, "D3", 3.10, -24.5), (1.50, "A3", 1.80, -28), (1.56, "Fs4", 2, -28.5),
                  (4, "G2", 2.95, -24.8), (5.50, "B3", 1.74, -28), (7.49, "A2", 0.78, -29),
                  (8, "B2", 3.18, -24.8), (9.52, "D4", 1.83, -27.5), (9.58, "A3", 1.87, -29),
                  (12, "G2", 3.15, -25), (13.53, "A3", 1.60, -28.5), (15.51, "B3", 0.79, -29),
                  (16, "D3", 3.47, -25.2), (17.52, "Fs4", 1.88, -28.5), (20, "A2", 1.85, -27.8)],
        "violin": [(0.23, "A4", 2.73, -22.4), (3.19, "D5", 2.93, -20.8), (6.41, "Cs5", 2.12, -22.3),
                   (9.12, "B4", 2.85, -22.4), (12.31, "G4", 2.74, -23), (16.16, "Fs4", 2.96, -23),
                   (20.16, "E4", 1.91, -25.6)],
        "cello": [(0.12, "Fs3", 2.80, -26.8), (8.15, "D3", 2.81, -26.5), (16.10, "A2", 2.91, -27.5)],
    },
    "coast-night": {
        "guitar": [(0.04, "D3", 5.2, -27.3), (0.27, "A3", 4.2, -30.4), (2.61, "D4", 3.35, -29.1)],
        "cello": [(0.17, "D3", 2.98, -26.2)],
    },
}
