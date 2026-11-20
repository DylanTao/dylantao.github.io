"""Render the fourth coastal violin study from recorded violin bows and plucks."""

import argparse
from functools import lru_cache
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from scipy.io import wavfile

from render_coastal_landing import RATE, SOURCE, read_bow

# Each bar has four beats. In the opening the three accents are implied by
# rests. They become the plucked 3+3+2 underneath the returning bowed line.
TEMPI = [
    90,
    90,
    91,
    92,
    94,
    96,
    97,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    98,
    97,
    96,
    93,
    86,
]
ROOTS = [
    "D4",
    "D4",
    "D4",
    "G3",
    "D4",
    "G3",
    "D4",
    "F4",
    "D4",
    "G3",
    "F4",
    "E4",
    "D4",
    "G3",
    "F4",
    "E4",
    "D4",
    "G3",
    "F4",
    "E4",
    "D4",
    "G3",
    "D4",
    "D4",
]

# Beat, pitch, length in beats, dynamic. Long notes use the musician's
# natural change of bow pressure. The F falling to E is the answering motif.
MELODY = [
    [(0, "D4", 2, "piano")],
    [(0, "D4", 1, "piano"), (3, "A3", 0.7, "piano")],
    [(0, "D4", 2.5, "piano"), (3.5, "E4", 0.48, "piano")],
    [(0, "F4", 1.55, "piano"), (2.5, "E4", 1.35, "piano")],
    [(0, "D4", 2.8, "piano")],
    [(0, "G3", 1.35, "piano"), (1.5, "D4", 1.3, "piano"), (3, "E4", 0.8, "piano")],
    [
        (0, "F4", 1.35, "mezzo-forte"),
        (1.5, "E4", 1.25, "piano"),
        (3, "D4", 0.82, "piano"),
    ],
    [(0, "A4", 3.75, "crescendo")],
    [
        (0, "A4", 1.35, "mezzo-forte"),
        (1.5, "D5", 1.20, "mezzo-forte"),
        (3, "C5", 0.83, "mezzo-forte"),
    ],
    [
        (0.5, "A4", 0.75, "mezzo-forte"),
        (1.5, "G4", 1.60, "mezzo-forte"),
        (3.5, "A4", 0.45, "piano"),
    ],
    [
        (0, "F5", 2.45, "mezzo-forte"),
        (2.75, "E5", 0.70, "piano"),
        (3.5, "D5", 0.45, "piano"),
    ],
    [(0, "A4", 2.45, "mezzo-forte"), (3, "G4", 0.82, "piano")],
    [
        (0, "A4", 0.93, "mezzo-forte"),
        (1.5, "D5", 0.84, "forte"),
        (2.5, "E5", 0.46, "mezzo-forte"),
        (3, "F5", 0.9, "forte"),
    ],
    [
        (0, "G5", 2.0, "mezzo-forte"),
        (2.5, "F5", 0.73, "mezzo-forte"),
        (3.5, "E5", 0.42, "piano"),
    ],
    [
        (0, "F5", 1.40, "forte"),
        (1.5, "C5", 0.65, "mezzo-forte"),
        (2.5, "D5", 1.4, "mezzo-forte"),
    ],
    [(0, "E5", 3.82, "crescendo")],
    [
        (0, "A5", 2.33, "forte"),
        (2.5, "G5", 0.78, "mezzo-forte"),
        (3.5, "F5", 0.47, "mezzo-forte"),
    ],
    [
        (0, "D5", 1.25, "forte"),
        (1.5, "A4", 0.77, "mezzo-forte"),
        (2.5, "D5", 1.4, "forte"),
    ],
    [(0, "C6", 2.63, "crescendo"), (3, "A5", 0.92, "forte")],
    [
        (0, "G5", 1.40, "forte"),
        (1.5, "F5", 1.4, "mezzo-forte"),
        (3, "E5", 0.91, "mezzo-forte"),
    ],
    [(0, "D5", 2.74, "mezzo-forte"), (3, "A4", 0.91, "piano")],
    [(0, "G4", 1.38, "piano"), (1.5, "F4", 0.91, "piano"), (2.75, "E4", 1.16, "piano")],
    [(0, "D4", 3.8, "piano")],
    [(0, "A3", 1.36, "piano"), (1.5, "D4", 2.6, "piano")],
]


def render(library, output):
    seconds = 60 / np.array(TEMPI)
    starts = np.r_[0.2, 0.2 + np.cumsum(4 * seconds)]
    mix = np.zeros(round((starts[-1] + 1.3) * RATE))
    events = []
    with ZipFile(library) as strings:
        names = {
            Path(n).stem.removeprefix("violin_")
            for n in strings.namelist()
            if n.startswith("Strings/violin/violin_") and n.endswith(".mp3")
        }

        @lru_cache(None)
        def recording(name):
            return read_bow(strings, name)

        def play(name, at, length, gain, voice):
            natural, digest = recording(name)
            audio = natural
            if length and len(audio) > length * RATE:
                audio = audio[: round(length * RATE)].copy()
                release = min(
                    len(audio) // 2, round(RATE * (0.14 if length > 0.55 else 0.065))
                )
                audio[-release:] *= np.cos(np.linspace(0, np.pi / 2, release)) ** 2
            pos = round(at * RATE)
            mix[pos : pos + len(audio)] += audio * 10 ** (gain / 20)
            events.append(
                dict(
                    voice=voice,
                    start=round(at, 3),
                    end=round(at + len(audio) / RATE, 3),
                    recording=name,
                    gainDb=round(gain, 2),
                    sha256=digest,
                )
            )

        for bar, notes in enumerate(MELODY):
            beat, downbeat = seconds[bar], starts[bar]
            for i, (offset, pitch, beats, dynamic) in enumerate(notes):
                span = beat * beats
                if dynamic == "crescendo":
                    name = f"{pitch}_very-long_crescendo_arco-normal"
                else:
                    lengths = sorted(
                        ((0.25, "025"), (0.5, "05"), (1, "1"), (1.5, "15")),
                        key=lambda item: abs(item[0] - span),
                    )
                    choices = [
                        f"{pitch}_{duration}_{level}_arco-normal"
                        for _, duration in lengths
                        for level in dict.fromkeys(
                            (dynamic, "mezzo-forte", "piano", "forte")
                        )
                    ]
                    name = next(n for n in choices if n in names)
                # The high bowed register naturally carries. Keep the player
                # close when the dynamics open to give the entrance room.
                gain = np.interp(
                    bar, [0, 5, 8, 17, 20, 23], [-4, -3, -1.4, -0.4, -2, -4.2]
                )
                breath = (
                    (0, 0.017, -0.009, 0.012)[(bar + i) % 4] if i else 0.005 * (bar % 3)
                )
                play(name, downbeat + offset * beat + breath, span + 0.048, gain, "bow")

            # A single, soft pluck under the sustained opening becomes three
            # off-centre accents. Vary the answering note and decay in each bar.
            pattern = (
                []
                if bar < 3
                else [0] if bar < 5 or bar > 21 else [0, 3] if bar < 7 else [0, 1.5, 3]
            )
            if bar in (9, 13, 17):
                pattern = [0, 1.5, 2.75, 3.5]
            for i, offset in enumerate(pattern):
                root = ROOTS[bar]
                pitch = (
                    root
                    if i != 1 or bar < 7
                    else {"D4": "G3", "G3": "D4", "F4": "C5", "E4": "G3"}[root]
                )
                soft = f"{pitch}_025_piano_pizz-normal"
                strong = next(
                    (
                        n
                        for n in (
                            f"{pitch}_025_mezzo-forte_pizz-normal",
                            f"{pitch}_025_forte_pizz-normal",
                            soft,
                        )
                        if n in names
                    )
                )
                name = (
                    soft
                    if soft in names and (bar < 7 or i == 2 or bar >= 21)
                    else strong
                )
                level = (
                    np.interp(
                        bar,
                        [3, 6, 8, 15, 18, 21, 23],
                        [-13, -7, -2.8, -2.2, -2.3, -6.0, -12.0],
                    )
                    - 0.9 * i
                )
                play(
                    name,
                    downbeat + offset * beat + (0.009, 0.021, 0.014, 0.016)[i],
                    None,
                    level,
                    "pizzicato",
                )

    mix *= 10 ** (-2.3 / 20) / np.max(np.abs(mix))
    output.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(output, RATE, np.rint(mix * 32767).astype(np.int16))
    fields = dict(
        title="Breakwater",
        source=SOURCE,
        credit="Philharmonia Orchestra musicians",
        seconds=round(len(mix) / RATE, 3),
        mono=True,
        tempoBpm=TEMPI,
        sections={
            s: round(starts[n], 3)
            for s, n in (
                ("opening", 0),
                ("first pluck", 3),
                ("pickup", 7),
                ("groove", 8),
                ("crest", 16),
                ("return", 20),
            )
        },
        rmsDbfs=round(10 * np.log10(np.mean(mix**2)), 2),
        events=events,
    )
    output.with_suffix(".json").write_text(
        json.dumps(fields, indent=2) + "\n", encoding="utf-8"
    )
    print(fields["seconds"], fields["sections"], len(events), fields["rmsDbfs"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strings", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    render(args.strings, args.output)
