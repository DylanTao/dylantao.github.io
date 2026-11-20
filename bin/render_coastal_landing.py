"""Render The Long Landing, an original monophonic violin score, from whole recorded bows.

The recording library is private input. Pass the Philharmonia Strings.zip with
--strings and a WAV path with --output. Only the finished composition is shared.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from zipfile import ZipFile

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

SOURCE = "https://philharmonia.co.uk/resources/sound-samples/"
RATE = 44100
# A complete performed gesture, its gain in dB, then a rest in seconds. The
# pauses follow the player's release, so the pulse grows out of bows of unequal
# length. The first part keeps returning to A and D, with the third withheld.
SCORE = (
    (
        "threshold",
        (
            ("A3_1_pianissimo_arco-normal", -5.0, 2.35),
            ("D4_very-long_mezzo-piano_non-vibrato", -5.0, 1.75),
            ("A3_1_piano_arco-normal", -4.7, 2.18),
            ("G3_long_mezzo-forte_molto-vibrato", -6.5, 0.92),
            ("D4_15_piano_arco-normal", -3.7, 1.38),
        ),
    ),
    (
        "turn",
        (
            ("Cs4_very-long_piano_arco-normal", -4.6, 0.55),
            ("D4_phrase_mezzo-piano_arco-legato", -3.9, 0.36),
            ("G4_long_mezzo-forte_molto-vibrato", -4.0, 1.04),
            ("A3_phrase_mezzo-forte_arco-tenuto", -2.3, 0.65),
            ("D4_long_mezzo-forte_molto-vibrato", -2.4, 0.68),
            ("A4_very-long_crescendo_arco-normal", -2.1, 0.94),
        ),
    ),
    (
        "reveal",
        (
            ("D4_phrase_forte_arco-martele", -2.2, 0.22),
            ("G4_phrase_mezzo-forte_arco-legato", -2.0, 0.10),
            ("A4_phrase_fortissimo_arco-au-talon", -1.4, 0.13),
            ("D5_phrase_mezzo-forte_arco-legato", -0.7, 0.16),
            ("E5_very-long_crescendo_arco-normal", -0.4, 0.17),
            ("A5_15_forte_arco-normal", -0.4, 0.11),
            ("D6_long_forte_molto-vibrato", 1.0, 1.4),
        ),
    ),
    (
        "landing",
        (
            ("A4_very-long_decrescendo_arco-normal", -1.3, 1.20),
            ("D4_15_piano_arco-normal", -4.7, 1.85),
        ),
    ),
)


def read_bow(strings, name):
    path = "Strings/violin/violin_" + name + ".mp3"
    data = strings.read(path)
    output = subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-ac",
            "1",
            "-ar",
            str(RATE),
            "-f",
            "f32le",
            "pipe:1",
        ],
        input=data,
        stdout=subprocess.PIPE,
        check=True,
    ).stdout
    samples = np.frombuffer(output, dtype="<f4")
    window = 220
    energy = np.abs(
        samples[: len(samples) // window * window].reshape(-1, window)
    ).mean(axis=1)
    active = np.flatnonzero(energy > max(0.00004, energy.max() * 0.004))
    if not len(active):
        raise ValueError("Empty violin gesture: " + name)
    # Discard silence around the recording. Keep the unaltered attack, body
    # and sympathetic decay, including a quarter-second of its actual room.
    start = max(0, active[0] * window - round(0.035 * RATE))
    end = min(len(samples), (active[-1] + 1) * window + round(0.24 * RATE))
    bow = samples[start:end].astype(float)
    fade = min(round(0.012 * RATE), len(bow) // 2)
    bow[:fade] *= np.linspace(0, 1, fade)
    bow[-fade:] *= np.linspace(1, 0, fade)
    return bow, hashlib.sha256(data).hexdigest()


def render(strings_path, destination):
    output = [np.zeros(round(0.16 * RATE))]
    count = len(output[0])
    sections, events = {}, []
    with ZipFile(strings_path) as strings:
        for passage, notes in SCORE:
            sections[passage] = round(count / RATE, 3)
            for name, gain, rest in notes:
                note, digest = read_bow(strings, name)
                events.append(
                    {
                        "recording": name,
                        "sha256": digest,
                        "start": round(count / RATE, 3),
                        "length": round(len(note) / RATE, 3),
                        "gainDb": gain,
                        "rest": rest,
                    }
                )
                pause = np.zeros(round(rest * RATE))
                output.extend((note * 10 ** (gain / 20), pause))
                count += len(note) + len(pause)
    music = np.concatenate(output)
    music *= 10 ** (-2.3 / 20) / max(abs(music))
    destination.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(destination, RATE, np.rint(music * 32767).astype(np.int16))
    result = {
        "title": "The Long Landing",
        "source": SOURCE,
        "credit": "Philharmonia Orchestra musicians",
        "recordingFormat": "original performance of each gesture, mono mix; native pitch and timing",
        "composition": "Original solo score for Sirui's coastal house",
        "seconds": round(len(music) / RATE, 3),
        "sections": sections,
        "peakDbfs": -2.3,
        "rmsDbfs": round(10 * np.log10(np.mean(music**2)), 2),
        "events": events,
    }
    destination.with_suffix(".json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps({k: result[k] for k in ("title", "seconds", "sections", "rmsDbfs")})
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strings", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    render(args.strings, args.output)
