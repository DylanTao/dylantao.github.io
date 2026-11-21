"""Render the two original chamber pieces for the homepage records."""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from render_coastal_world_music import RATE, SOURCE, Recordings, master, stereo_note, write_audio


CREDIT = f"Original chamber composition for Sirui's site. Instrument samples by Philharmonia musicians. {SOURCE}"

# Guitar positions list the low note first, then its fifth and the two upper colours.
VOICINGS = {
    "Em": ("E2", "B2", "G3", "D4"),
    "Em9": ("E2", "B2", "G3", "Fs4"),
    "G": ("G2", "D3", "B3", "G4"),
    "G6": ("G2", "D3", "B3", "E4"),
    "Cmaj7": ("C3", "G2", "E3", "B3"),
    "Am7": ("A2", "E3", "C4", "G3"),
    "Bm7": ("B2", "Fs3", "D4", "A3"),
    "D": ("D3", "A2", "Fs3", "D4"),
    "D6": ("D3", "A2", "Fs3", "B3"),
    "Fsminor": ("Fs2", "Cs3", "A3", "E4"),
    "Asus4": ("A2", "E3", "D4", "A4"),
    "A": ("A2", "E3", "Cs4", "A4"),
}

# Events are (beat within the measure, pitch, length in beats).
# The mandolin asks a question and the lower banjo changes its shape in reply.
TUGBOAT = (
    ("Em", "mandolin", [(0.31, "E4", .44), (.87, "G4", .40), (1.53, "B4", .51), (2.24, "A4", .35), (2.81, "Fs4", .88)]),
    ("G6", "banjo", [(.48, "D4", .46), (1.17, "E4", .40), (1.79, "G4", .53), (2.62, "B3", 1.04)]),
    ("Cmaj7", "mandolin", [(.16, "E4", .39), (.74, "G4", .39), (1.38, "C5", .62), (2.38, "B4", .32), (2.91, "G4", .70)]),
    ("Am7", "banjo", [(.49, "C4", .40), (1.13, "E4", .50), (1.97, "G4", .38), (2.58, "E4", .90)]),
    ("Em", "mandolin", [(.29, "E4", .43), (.86, "G4", .35), (1.46, "B4", .50), (2.22, "D5", .52), (2.95, "B4", .67)]),
    ("Bm7", "banjo", [(.52, "Fs4", .35), (1.06, "D4", .56), (1.77, "A3", .40), (2.32, "B3", .80)]),
    ("Cmaj7", "mandolin", [(.39, "E4", .45), (1.00, "B4", .36), (1.61, "D5", .42), (2.17, "C5", .67), (3.13, "G4", .57)]),
    ("D6", "banjo", [(.40, "Fs4", .53), (1.14, "B4", .41), (1.71, "A4", .36), (2.37, "D4", .87)]),
    ("G6", "mandolin", [(.18, "B4", .48), (.81, "D5", .46), (1.50, "E5", .56), (2.42, "G5", .83)]),
    ("D6", "banjo", [(.54, "Fs4", .53), (1.30, "A4", .40), (1.93, "B4", .51), (2.78, "A4", .70)]),
    ("Em", "mandolin", [(.29, "G4", .55), (1.05, "B4", .44), (1.75, "G5", .48), (2.53, "E5", .93)]),
    ("Am7", "banjo", [(.48, "E4", .37), (1.10, "C5", .44), (1.79, "B4", .43), (2.42, "A4", .75)]),
    ("Cmaj7", "mandolin", [(.28, "E4", .34), (.82, "G4", .40), (1.44, "B4", .47), (2.22, "C5", .90)]),
    ("Bm7", "banjo", [(.48, "D4", .42), (1.14, "Fs4", .49), (1.92, "A4", .44), (2.65, "B4", .68)]),
    ("Em", "mandolin", [(.23, "G4", .41), (.94, "B4", .35), (1.61, "D5", .56), (2.48, "E5", 1.10)]),
    ("Em", "banjo", [(.28, "B3", .45), (1.01, "G4", .44), (1.62, "E4", 1.53)]),
)

# A viola opens quietly, then the violin picks up the original rising line.
WINDOWS = (
    ("D6", [(1.40, "A3", 1.31)]),
    ("Em9", [(.14, "B3", .82), (1.18, "Fs4", .56), (1.97, "E4", .84)]),
    ("Bm7", [(.14, "D4", .82), (1.17, "Fs4", 1.48)]),
    ("G6", [(.18, "E4", .78), (1.23, "D4", .58), (2.01, "B3", .86)]),
    ("D", [(.17, "A3", .69), (1.04, "D4", .72), (2.02, "Fs4", .79)]),
    ("Fsminor", [(.18, "E4", .85), (1.20, "A4", 1.37)]),
    ("G", [(.10, "B4", .86), (1.17, "A4", .56), (1.98, "G4", .94)]),
    ("Asus4", [(.16, "D4", .64), (1.05, "E4", 1.42)]),
    ("Bm7", [(.10, "B4", .78), (1.10, "D5", .70), (2.03, "Fs5", .84)]),
    ("Em9", [(.12, "E5", .78), (1.11, "G5", .71), (2.06, "B5", .82)]),
    ("G6", [(.12, "A5", .78), (1.10, "G5", .70), (2.01, "E5", .88)]),
    ("D6", [(.13, "Fs5", 1.44), (1.90, "D5", .90)]),
    ("Bm7", [(.11, "D5", .78), (1.08, "Fs5", .67), (1.97, "A5", .88)]),
    ("G", [(.11, "B5", 1.45), (1.92, "G5", .93)]),
    ("A", [(.14, "E5", .73), (1.10, "A5", .74), (2.06, "Cs6", .73)]),
    ("D6", [(.07, "D6", 1.31), (1.66, "B5", .42), (2.20, "A5", 1.56)]),
)
WINDOWS_VIOLA_CODA = ("D4", "G4", "B3", "Fs4", "Fs4", "G4", "E4", "D4")


def tugboat(note):
    for bar, (chord, voice, phrase) in enumerate(TUGBOAT):
        bass, fifth, lower, upper = VOICINGS[chord]
        if bar == len(TUGBOAT) - 1:
            bass_line = [(0, bass, .75), (1.95, bass, 1.82)]
            taps = [(1.19, fifth, .63), (2.28, lower, .63), (2.40, upper, .70)]
        else:
            bass_line = [(0, bass, .60), (1.41, fifth, .36), (2.01, bass, .49), (3.20, fifth, .44)]
            taps = [(0.82, lower, .41), (2.73, upper, .41)]
        for at, pitch, length in bass_line:
            note(bar, at, "guitar", pitch, length, -24.7 if at == 0 else -27.4, .65, firm=True)
        for at, pitch, length in taps:
            note(bar, at, "guitar", pitch, length, -34.0, .94)
        level = -23.8 if voice == "mandolin" else -25.3
        for i, (at, pitch, length) in enumerate(phrase):
            note(bar, at, voice, pitch, length, level - .65 * (i % 2), .50 if voice == "mandolin" else 1.08, firm=bar in (8, 10))
    for bar, pitch in enumerate(("B3", "A3", "G3", "E4"), 8):
        note(bar, .78, "viola", pitch, 2.46, -32.4, .81)


def windows(note):
    for bar, (chord, phrase) in enumerate(WINDOWS):
        bass, fifth, lower, upper = VOICINGS[chord]
        for at, pitch, length, level in (
            (0, bass, 2.37, -30.2),
            (.62, fifth, 1.57, -33.2),
            (1.24, lower, 1.40, -31.5),
            (2.17, upper, .93, -33.4),
        ):
            note(bar, at, "guitar", pitch, length, level, .48)
        note(bar, .12, "cello", bass, 2.58, -35.4 if bar < 8 else -31.7, .90)
        if bar >= 8:
            note(bar, .30, "viola", WINDOWS_VIOLA_CODA[bar - 8], 2.46, -27.2, 1.07)
        for index, (at, pitch, length) in enumerate(phrase):
            note(bar, at, "viola" if bar < 8 else "violin", pitch, length, -24.4 + .75 * (index == 0), .72)
    note(15, 1.44, "guitar", "D4", 2.27, -29.9, .49)
    note(15, 1.91, "cello", "D3", 1.54, -29.8, .91)


def render(library, output, review, *, slug, title, score, tempo, meter, bars, tail, dynamics):
    beat = 60 / tempo
    lead_in = .10
    total_seconds = lead_in + bars * meter * beat + tail
    mix = np.zeros((round(total_seconds * RATE), 2))
    log = []
    marks, db = np.asarray(dynamics).T

    def note(bar, at, part, pitch, length, level, pan, *, firm=False):
        gain = level + np.interp(bar + at / meter, marks, db)
        stereo_note(library, mix, log, lead_in + (bar * meter + at) * beat, part, pitch, beat * length, gain, pan, firm=firm)

    score(note)
    # Leave the phrasing intact while rounding the tallest attacks on the picked strings.
    knee = 3.6 * np.sqrt(np.mean(mix ** 2))
    peaks = np.abs(mix) > knee
    headroom = .7 * knee
    mix[peaks] = np.sign(mix[peaks]) * (knee + headroom * np.tanh((np.abs(mix[peaks]) - knee) / headroom))
    pcm = master(mix, -5.5)
    music = output / (slug + ".mp3")
    write_audio(pcm, music, f"{title}. {CREDIT}")
    if review:
        review.mkdir(parents=True, exist_ok=True)
        wavfile.write(review / (slug + ".wav"), RATE, pcm)
        (review / (slug + ".json")).write_text(
            json.dumps({"title": title, "seconds": round(len(pcm) / RATE, 3), "notes": log}, indent=2) + "\n", encoding="utf-8"
        )
    print(f"{title}  {len(pcm) / RATE:.3f} s  {len(log)} notes  {music.stat().st_size} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strings", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("assets/audio/desk-records"))
    parser.add_argument("--review", type=Path)
    options = parser.parse_args()
    library = Recordings(options.strings)
    try:
        render(library, options.output, options.review,
               slug="a-tugboat-for-two", title="A Tugboat for Two", score=tugboat, tempo=116, meter=4,
               bars=len(TUGBOAT), tail=.80, dynamics=[(0,-1.8),(4,-.7),(8,1.1),(12,.2),(16,-2.4)])
        render(library, options.output, options.review,
               slug="all-the-windows-open", title="All the Windows Open", score=windows, tempo=90, meter=3,
               bars=len(WINDOWS), tail=1.25, dynamics=[(0,-3.2),(4,-1.6),(7,-.7),(9,.3),(13,1.1),(15,.6),(16,-2.3)])
    finally:
        library.archive.close()


if __name__ == "__main__":
    main()
