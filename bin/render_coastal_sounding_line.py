"""Render The Sounding Line, an original coastal violin study, from recorded bows."""

import argparse
from functools import lru_cache
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from scipy.io import wavfile

from render_coastal_landing import RATE, SOURCE, read_bow

# One D–A–F–E question. Its answer reaches an octave higher each time.
# Times are the player's entrances, in seconds. Long bows run over the pulse.
# The brief F5–E-flat6–F5 shift and the E5–F5 trill are whole played gestures.
D_LOW = "D4_very-long_mezzo-piano_non-vibrato"
D_WARM = "D4_long_mezzo-forte_molto-vibrato"
A_RISE = "A4_very-long_crescendo_arco-normal"
A_FALL = "A4_very-long_decrescendo_arco-normal"
F_LOW = "F4_long_forte_molto-vibrato"
E_LOW = "E4_long_forte_molto-vibrato"
F_HIGH = "F5_very-long_decrescendo_arco-normal"
E_HIGH = "E5_very-long_crescendo_arco-normal"
D_HARM = "D5_1_mezzo-forte_natural-harmonic"
A_HARM = "A5_1_mezzo-forte_natural-harmonic"

LINE = (
    (0.27, D_LOW),
    (4.12, A_RISE),
    (8.48, F_LOW),
    (10.37, E_LOW),
    (12.86, D_WARM),
    (15.63, "G4_long_mezzo-forte_molto-vibrato"),
    (17.93, A_RISE),
    (21.62, F_LOW),
    (23.55, E_LOW),
    (25.88, D_WARM),
    (28.13, "A4_15_fortissimo_arco-normal"),
    (30.12, "D5_phrase_mezzo-forte_arco-legato"),
    (30.86, "D5_very-long_pianissimo_arco-tremolo"),
    (33.21, A_HARM),
    (34.34, F_HIGH),
    (38.00, E_HIGH),
    (41.37, "D5_very-long_fortissimo_arco-tremolo"),
    (43.86, "F5_phrase_mezzo-forte_arco-legato"),
    (44.59, "E5_phrase_mezzo-piano_arco-major-trill"),
    (45.82, D_HARM),
    (47.04, A_HARM),
    (48.39, "D6_long_forte_molto-vibrato"),
    (50.59, F_HIGH),
    (54.51, E_HIGH),
    (58.30, A_FALL),
    (61.91, F_LOW),
    (63.79, E_LOW),
    (66.39, D_LOW),
)

# Sustained open strings below the melody. D rings under the A-string line,
# A under the high E string, and the G string answers the lower D-string line.
# Each lower bow has one real attack and one release. Their changing order
# carries the pulse into the high passage without a repeated plucked ostinato.
RESONANCE = (
    (17.94, 3.42, D_LOW, -12.0),
    (21.60, 1.59, "G3_long_mezzo-forte_molto-vibrato", -12.0),
    (25.85, 1.75, "G3_long_mezzo-forte_molto-vibrato", -10.0),
    (28.23, 3.74, D_LOW, -9.8),
    (32.56, 1.72, "D4_15_forte_arco-normal", -10.5),
    (34.61, 3.08, A_FALL, -10.0),
    (38.02, 3.50, A_RISE, -9.8),
    (41.80, 2.25, D_WARM, -10.0),
    (47.94, 2.68, A_RISE, -9.0),
    (54.56, 3.48, A_FALL, -13.0),
)

# This dynamic arc belongs to the phrase. Individual recordings keep their
# attacks, vibrato, bow-pressure changes and release. The high point is inside
# one note, past its attack. The descent takes almost twenty seconds.
DYNAMICS = (
    (0, -31.0),
    (4, -28.5),
    (10, -28.0),
    (15, -27.5),
    (22, -25.0),
    (29, -24.2),
    (35, -22.7),
    (42, -20.7),
    (46, -20.1),
    (49.4, -18.4),
    (54, -22.2),
    (61, -27.0),
    (67, -28.8),
    (73, -33.0),
)


def body(samples):
    """Measure 50 ms acoustic energy, leaving the recorded bow shape intact."""
    width = round(0.05 * RATE)
    frames = samples[: len(samples) // width * width].reshape(-1, width)
    levels = 10 * np.log10(np.maximum(np.mean(frames**2, axis=1), 1e-12))
    active = np.flatnonzero(levels > levels.max() - 21)
    pickup = max(0, active[0] * width - round(0.12 * RATE))
    played = levels[active[0] : active[-1] + 1]
    return samples[pickup:], float(np.percentile(played, 70))


def join_changes(mix, onsets):
    """Difference in adjacent 240 ms RMS windows at internal melodic entries."""
    width = round(0.24 * RATE)
    result = []
    for at in onsets:
        mid = round(at * RATE)
        left, right = mix[mid - width : mid], mix[mid : mid + width]
        if len(left) == width and len(right) == width:
            levels = [10 * np.log10(np.mean(side**2) + 1e-12) for side in (left, right)]
            if min(levels) >= -50:
                result.append(abs(levels[1] - levels[0]))
    return dict(
        windowMs=240,
        audibleFloorDbfs=-50,
        joins=len(result),
        medianDb=round(float(np.median(result)), 2),
        p90Db=round(float(np.percentile(result, 90)), 2),
        maximumDb=round(max(result), 2),
    )


def render(library, output, previous=None):
    mix = np.zeros(round(73.5 * RATE))
    events = []
    times, levels = np.array(DYNAMICS).T
    with ZipFile(library) as strings:

        @lru_cache(None)
        def recording(name):
            note, digest = read_bow(strings, name)
            audio, level = body(note)
            return audio, level, digest

        def play(at, name, duration, offset, voice, last=False):
            audio, level, digest = recording(name)
            count = min(len(audio), round(duration * RATE))
            excerpt = audio[:count].copy()
            # Complementary half-cosine handovers retain bow grain. A lower
            # open string has a softer entry so the melodic attack stays clear.
            attack_time = 0.19 if voice == "melody" else 0.31
            if name == "D5_very-long_fortissimo_arco-tremolo":
                attack_time = 0.62
            attack = min(count // 3, round(attack_time * RATE))
            release = min(
                count // 3, round((0.31 if voice == "melody" else 0.40) * RATE)
            )
            excerpt[:attack] *= np.sin(np.linspace(0, np.pi / 2, attack))
            if not last:
                excerpt[-release:] *= np.cos(np.linspace(0, np.pi / 2, release))
            seconds = at + np.arange(count) / RATE
            excerpt *= 10 ** ((np.interp(seconds, times, levels) + offset - level) / 20)
            start = round(at * RATE)
            mix[start : start + count] += excerpt
            events.append(
                dict(
                    voice=voice,
                    start=at,
                    end=round(at + count / RATE, 3),
                    recording=name,
                    sha256=digest,
                )
            )

        for i, (at, name) in enumerate(LINE):
            last = i + 1 == len(LINE)
            span = 6 if last else LINE[i + 1][0] - at + 0.42
            play(at, name, span, 0, "melody", last=last)
        for at, span, name, offset in RESONANCE:
            play(at, name, span, offset, "open string")

    # A handful of quiet early room reflections join the recorded air between
    # bows. The direct signal remains in the center of a single mono channel.
    dry = mix.copy()
    for delay, fraction in (
        (0.021, 0.09),
        (0.041, 0.057),
        (0.079, 0.039),
        (0.138, 0.022),
    ):
        n = round(delay * RATE)
        mix[n:] += fraction * dry[:-n]
    last_end = max(event["end"] for event in events)
    mix = mix[: round((last_end + 0.42) * RATE)]
    mix *= 10 ** (-2.5 / 20) / np.max(np.abs(mix))
    output.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(output, RATE, np.rint(mix * 32767).astype(np.int16))
    spans = np.diff([at for at, _ in LINE] + [last_end])
    report = dict(
        title="The Sounding Line",
        take=5,
        source=SOURCE,
        credit="Original setting using violin recordings by Philharmonia Orchestra musicians",
        format="mono, native pitch and speed; layered open-string double stops",
        seconds=round(len(mix) / RATE, 3),
        peakDbfs=-2.5,
        rmsDbfs=round(float(10 * np.log10(np.mean(mix**2))), 2),
        melodicEntries=len(LINE),
        openStringEntries=len(RESONANCE),
        timeOnMelodicSpansAtLeast1_4s=round(
            float(spans[spans >= 1.4].sum() / spans.sum()), 3
        ),
        joins=join_changes(mix, [at for at, _ in LINE[1:]]),
        sections={
            "first question": 0.27,
            "open-string pulse": 17.94,
            "upper answer": 30.12,
            "cadenza": 43.86,
            "crest": 48.39,
            "return": 58.30,
        },
        events=sorted(events, key=lambda e: e["start"]),
    )
    if previous:
        rate, pcm = wavfile.read(previous)
        if rate != RATE or pcm.ndim != 1 or pcm.dtype != np.int16:
            raise ValueError(
                "The previous review must be the original mono 44.1 kHz PCM16 WAV"
            )
        before = json.loads(previous.with_suffix(".json").read_text(encoding="utf-8"))
        starts = [e["start"] for e in before["events"] if e["voice"] == "bow"]
        report["previous"] = dict(
            title=before["title"],
            events=len(before["events"]),
            joins=join_changes(pcm.astype(float) / 32768, starts[1:]),
        )
    output.with_suffix(".json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in report.items() if k != "events"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strings", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--previous", type=Path)
    args = parser.parse_args()
    render(args.strings, args.output, args.previous)
