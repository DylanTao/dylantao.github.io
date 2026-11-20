"""Render Sirui's second solo violin study, The Match, from a score and recorded bows.

Use --samples for a local folder containing VSCO 2 CE's Solo Violin/spic and
Solo Violin/Arco Vib WAVs (either flat or in their original folders).
"""

import argparse
from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path
import re

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from fractions import Fraction


REVISION = "440300901dfe9275fd84e0b7763af1f8443ae62e"
SOURCE = "https://github.com/sgossner/VSCO-2-CE/tree/" + REVISION + "/Strings/Solo%20Violin"
RATE = 44100
PITCHES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# Each bar is two quarter notes. Numbers are duration in sixteenths. A dot is
# a rest, ! a thrown accent, ~ a carried bow, and + two adjacent strings.
# The opening lifts through an added sixth. The middle plays that reach very
# softly in another register; it returns as a pair of voices over open A.
SCORE = (
    (146, .83, "A3+E4:2! .:1 C#5:1 F#5:2 E5:1 B4:1"),
    (151, .70, "A4:1 E5:1 C#5:1 A4:1 B4:2 .:1 E4:1"),
    (153, .79, "F#4:2! A4:1 C#5:1 E5:1 A4:1 F#5:1 A4:1"),
    (140, .89, "G#5:3~ E5:1 A5:2! .:2"),
    (149, .65, "D5:1 A4:1 F#5:1 A4:1 D6:2! A5:1 F#5:1"),
    (153, .73, "C#5:1 A4:1 E5:1 A4:1 C#6:2 A5:1 E5:1"),
    (155, .80, "B4:1 E5:1 D5:1 G#5:1 B5:2! G#5:1 E5:1"),
    (135, .84, "C#5+A5:3~ B4+G#5:2 .:3"),
    (143, .47, "F#4:1 .:1 C#5:2~ A4:1 .:1 E5:2"),
    (149, .51, "D4:1 .:1 A4:1 D5:1 F#5:2~ E5:2"),
    (145, .58, "B3:2! F#4:1 A4:1 C#5:2 B4:1 A4:1"),
    (135, .60, "G#4:1 B4:1 E5:4~ .:2"),
    (155, .77, "A3:1 E4:1 A4:1 C#5:1 E5:1 F#5:1 A5:1 C#6:1"),
    (159, .84, "B5:1 E5:1 G#5:1 E5:1 B5:1 G#5:1 E6:2!"),
    (158, .90, "D6:1 A5:1 F#5:1 D5:1 E5:1 A5:1 C#6:1 E6:1"),
    (135, .95, "F#6:3~ E6:1 A5:2! .:2"),
    (149, .58, "C#5+A5:2 E5:1 .:1 B4+G#5:2 E5:1 .:1"),
    (151, .69, "A4+F#5:2 D5:1 A4:1 B4+G#5:2 E5:2"),
    (151, .82, "C#5+A5:2! B4+G#5:2 A4+F#5:2 G#4+E5:2"),
    (134, .87, "F#4+D5:2 E4+C#5:1 D4+B4:1 E4+B4:2! .:2"),
    (148, .51, "A3:1 .:1 E4:1 A4:1 C#5:3~ E5:1"),
    (155, .66, "F#5:1 A4:1 E5:1 A4:1 C#5:1 E5:1 A5:1 C#6:1"),
    (161, .83, "D6:1 A5:1 F#5:1 D5:1 B4:1 D5:1 F#5:1 A5:1"),
    (159, .89, "G#5:1 E5:1 B5:1 G#5:1 E6:1 B5:1 G#6:2!"),
    (141, .97, "A6:4~ E6:1 C#6:1 A5:1 E5:1"),
    (151, .80, "A4+C#5:2! E5:1 A5:1 C#6:2! .:2"),
    (153, .86, "D5+A5:2 C#5+A5:2 B4+G#5:2 E4+B4:2!"),
    (137, .94, "A3+E4:2! .:1 A4:1 C#5:1 E5:1 A5:1 C#6:1"),
    (125, .91, "E6:3~ C#6:1 A5:2! .:2"),
    (114, .91, "C#5+A5:3~ .:2 A3+E4:3!"),
)


def midi(name):
    letter, sharp, octave = re.fullmatch(r"([A-G])(#?)([0-8])", name).groups()
    return 12 * (int(octave) + 1) + PITCHES[letter] + bool(sharp)


def instruments(folder):
    bank = {}
    for path in folder.rglob("LLVln_*.wav"):
        match = re.fullmatch(r"LLVln_(ArcoVib|spic)_([A-G][0-8])_(f|p|v[12])(?:_rr([12]))?", path.stem)
        if match:
            art, name, layer, bow = match.groups()
            # This library's short takes label middle C as C3, its long
            # takes label it C4. A measured A4 file sounds at 880 / 440 Hz.
            root = midi(name) + (12 if art == "spic" else 0)
            bank.setdefault((art, layer, int(bow or 1)), {})[root] = path
    return bank


@lru_cache(maxsize=144)
def recorded_note(path, transpose):
    rate, pcm = wavfile.read(path)
    if rate != RATE or pcm.dtype != np.int16:
        raise ValueError(f"Unexpected recording format in {path.name}")
    wave = np.atleast_2d(pcm.T).T.astype(np.float64) / 32768
    if not transpose:
        return wave
    ratio = Fraction(2 ** (-transpose / 12)).limit_denominator(400)
    return resample_poly(wave, ratio.numerator, ratio.denominator, axis=0)


def render(folder, output):
    bank = instruments(folder)
    bows, used, events = {}, {}, []
    rng = np.random.default_rng(241119)
    seconds = .085
    mix = np.zeros((int((sum(120 / b for b, _, _ in SCORE) + 2.5) * RATE), 2))
    accent_pattern = (1.0, .83, .91, .86, .95, .84, .91, .82)
    for bar, (bpm, dynamic, notes) in enumerate(SCORE, 1):
        unit, beat = 15 / bpm, 0
        for token in notes.split():
            chord, length, style = re.fullmatch(r"([A-G#0-8+.]+):(\d+)([!~]?)", token).groups()
            count = int(length)
            if chord != ".":
                accent = style == "!"
                strength = dynamic * accent_pattern[beat] * (1.13 if accent else 1)
                art = "ArcoVib" if style == "~" else "spic"
                layer = ("p" if strength < .65 else "f") if art == "ArcoVib" else ("v1" if strength < .65 else "v2")
                roll = rng.uniform(.009, .023)
                onset = seconds + rng.uniform(-.003, .003)
                voices = chord.split("+")
                for i, name in enumerate(voices):
                    pitch = midi(name)
                    key = (art, layer, pitch)
                    bow = 1 + (bows.get(key, 0) % 2) if art == "spic" else 1
                    bows[key] = bows.get(key, 0) + 1
                    takes = bank[art, layer, bow]
                    root = min(takes, key=lambda n: abs(n - pitch))
                    path = takes[root]
                    used[path.name] = path
                    wave = recorded_note(path, pitch - root)
                    duration = count * unit
                    # Let a short bow's recorded release ring underneath
                    # the next attack; carried bows release more slowly.
                    release = .11 if art == "spic" else .065
                    held = duration * (.89 if art == "ArcoVib" else .73)
                    take = wave[: round((held + release) * RATE)].copy()
                    tail = max(1, min(len(take), round(release * RATE)))
                    take[-tail:] *= (.5 + .5 * np.cos(np.linspace(0, np.pi, tail)))[:, None]
                    start = round((onset + i * roll) * RATE)
                    gain = strength ** .78 * (.81 if len(voices) == 2 else 1)
                    mix[start : start + len(take)] += take * gain
                    events.append((bar, pitch, round(start / RATE, 4), path.name))
            beat += count
            seconds += count * unit
        if beat != 8:
            raise ValueError(f"Bar {bar} has {beat} sixteenths")
    mix = mix[: round((seconds + .6) * RATE)]
    mix *= (10 ** (-2.5 / 20)) / np.max(np.abs(mix))
    output.parent.mkdir(exist_ok=True, parents=True)
    wavfile.write(output, RATE, np.rint(mix * 32767).astype(np.int16))
    receipt = {
        "title": "The Match",
        "composition": "Original solo in A major for the coastal house, study 2",
        "recordings": SOURCE,
        "license": "CC0 1.0",
        "recordists": "Sam Gossner and Simon Dalzell; sample cutting by Elan Hickler",
        "seconds": round(len(mix) / RATE, 3),
        "notes": len(events),
        "peakDbfs": -2.5,
        "rmsDbfs": [round(x, 2) for x in 20 * np.log10(np.sqrt(np.mean(mix**2, axis=0)))],
        "sources": {name: sha256(path.read_bytes()).hexdigest() for name, path in sorted(used.items())},
        "performance": events,
    }
    output.with_suffix(".json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"{output} · {receipt['seconds']} s · {len(events)} notes, {len(used)} recorded takes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    options = parser.parse_args()
    render(options.samples, options.output)
