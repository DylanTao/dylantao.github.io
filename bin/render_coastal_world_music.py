"""Render the house's original chamber pieces and short musical responses."""

import argparse
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import subprocess
from zipfile import ZipFile

import imageio_ffmpeg
import numpy as np
from scipy import signal
from scipy.io import wavfile

import coastal_film_score as film
from coastal_world_scores import CHORDS, SCORES
from render_coastal_landing import RATE, SOURCE

SHORE = Path(__file__).resolve().parents[1] / "artwork/coastal-home/audio/la-jolla-cliff-2015.flac"
SHORE_CREDIT = (
    "Coastal field recording: ocean-LaJolla.wav by Xavier Serra (xserra), January 28, 2015; "
    "edited and mixed under CC BY 4.0. https://freesound.org/people/xserra/sounds/262593/ "
    "https://creativecommons.org/licenses/by/4.0/"
)


def pitch_number(name):
    return (int(name[-1]) + 1) * 12 + {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]] + ("s" in name)


def fingered_octave(name, lowest):
    if pitch_number(name) < pitch_number(lowest):
        return name[:-1] + str(int(name[-1]) + 1)
    return name


class Recordings:
    def __init__(self, source):
        self.archive = ZipFile(source)
        self.paths = set(self.archive.namelist())

    @lru_cache(None)
    def read(self, path):
        data = self.archive.read(path)
        pcm = subprocess.run(
            [
                imageio_ffmpeg.get_ffmpeg_exe(),
                "-v",
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
        samples = np.frombuffer(pcm, dtype="<f4").astype(float)
        block = round(0.025 * RATE)
        rms = np.sqrt(np.mean(samples[: len(samples) // block * block].reshape(-1, block) ** 2, axis=1))
        audible = np.flatnonzero(rms > max(rms.max() * 0.035, 0.00008))
        start = max(0, (audible[0] - 1) * block)
        end = min(len(samples), (audible[-1] + 4) * block)
        return (
            samples[start:end],
            max(0.0001, float(np.percentile(rms[rms > rms.max() * 0.24], 70))),
            hashlib.sha256(data).hexdigest(),
        )

    def choose(self, part, note, seconds, *, firm=False):
        family = part.split("-")[0]
        base = f"Strings/{family}/{family}_{note.rstrip('*')}_"
        if note.endswith("*"):
            return base + "phrase_mezzo-forte_arco-legato.mp3"
        if family in ("guitar", "banjo", "mandolin"):
            choices = ("very-long_piano_normal", "very-long_forte_normal")
            if firm:
                choices = choices[::-1]
        elif part.endswith("-pizz"):
            choices = [
                f"{length}_{level}_pizz-normal"
                for length in ("1", "05", "025")
                for level in ("piano", "mezzo-piano", "mezzo-forte", "forte", "fortissimo", "pianissimo")
            ]
        else:
            lengths = ("15", "1", "05") if seconds > 0.84 else ("1", "05", "15")
            choices = [
                f"{length}_{level}_arco-normal"
                for length in lengths
                for level in ("mezzo-piano", "mezzo-forte", "piano", "forte", "pianissimo", "fortissimo")
            ]
            # A whole expressive bow can carry the long upper question without
            # either looping it or borrowing the timbre of an adjacent pitch.
            if seconds >= 1.22:
                choices = ["long_mezzo-forte_molto-vibrato", "very-long_crescendo_arco-normal", *choices]
        for name in choices:
            path = base + name + ".mp3"
            if path in self.paths and not (
                family == "violin" and note == "E5" and name == "15_mezzo-piano_arco-normal"
            ):
                return path
        raise ValueError(f"No recorded {part} {note}")


def guitar_phrase(style, bar, chord, total):
    root, fifth, color = CHORDS[chord]
    if style == "watercolour":
        if bar < 2:
            return [(0, root, 2.1, -4), (2.55, "D4" if bar else fifth, 1.23, -5)]
        if bar in (7, 13):
            return [(0, root, 1.9, -2), (2.06, color, 1.53, -3)]
        if bar == 14:  # Clear the space beneath the one played turn.
            return [(2.02, root, 1.8, -2)]
        if bar < 7:
            return [(0, root, 2.6, -1), (2.54, fifth, 1.3, -3)]
        if bar < total - 1:
            pickup = (3.48, fifth, 0.80, -5) if bar % 2 else (2.56, root, 1.0, -3)
            return [(0, root, 2.65, 0), (1.48, fifth, 1.21, -3), (1.53, color, 1.36, -3), pickup]
        return [(0, root, 3.8, -1), (0.33, fifth, 3.1, -3), (0.68, color, 2.8, -4)]
    if style == "realistic":
        return [(0, root, 2.58, -1), (1.74 if bar % 2 else 2.02, color, 1.25, -4)]
    if style == "paint":
        return [(0.10, fifth, 2.12, -2), (1.84, color, 1.23, -3)] if bar % 3 else [(0, root, 2.73, -0.8)]
    if style == "print":
        return [(0, root, 2.12, 0), (2.06, fifth, 1.39, -3), (3.61, color, 1.18, -4)]
    # A single anacrusis, an empty bar near the turn and an offbeat answer.
    if bar == 7:
        return []
    return [(0, root, 1.61, -1)] if bar % 2 == 0 else [(0.98, color, 1.11, -2)]


def stereo_note(library, mix, log, at, part, pitch, seconds, db, pan, *, firm=False):
    path = library.choose(part, pitch, seconds, firm=firm)
    audio, body_rms, digest = library.read(path)
    # This second G2 take has 60 ms of finger preparation before the pick.
    # Line up the pick itself with the thumb beat of the opening guitar.
    if path == "Strings/guitar/guitar_G2_very-long_forte_normal.mp3":
        audio = audio[round(0.060 * RATE):]
    pluck = part in ("guitar", "banjo", "mandolin") or part.endswith("pizz")
    count = min(len(audio), round((seconds + (0.12 if pluck else 0.11)) * RATE), len(mix) - round(at * RATE))
    if count <= 0:
        return
    audio = audio[:count].copy()
    attack = min(count // 4, round((0.013 if pluck else 0.09) * RATE))
    release = min(count // 3, round((0.17 if pluck else 0.20) * RATE))
    audio[:attack] *= np.sin(np.linspace(0, np.pi / 2, attack)) ** 2
    audio[-release:] *= np.cos(np.linspace(0, np.pi / 2, release)) ** 2
    # A gentle shelf tames close-mic bow rasp while leaving its lower harmonics.
    filtered = signal.sosfilt(TONE, audio)
    audio = (0.64 * audio + 0.36 * filtered) * (10 ** (db / 20) / body_rms)
    pos = round(at * RATE)
    mix[pos : pos + count] += audio[:, None] * np.array([np.cos(pan), np.sin(pan)])
    log.append(
        dict(part=part, pitch=pitch, start=round(at, 3), end=round(at + count / RATE, 3), file=path, sha256=digest)
    )


TONE = signal.butter(2, 2700, fs=RATE, output="sos")


def master(mix, peak):
    dry = mix.copy()
    for delay, amount in ((0.024, 0.07), (0.049, 0.048), (0.092, 0.028)):
        i = round(delay * RATE)
        mix[i:] += dry[:-i, ::-1] * amount
    # Preserve the musicians' headroom and the score's dynamic arc. A quiet
    # note remains quiet within a piece and the interface has its own bus.
    mix *= min(10 ** (peak / 20) / np.abs(mix).max(), 10 ** (-20.8 / 20) / np.sqrt(np.mean(mix**2)))
    return np.rint(np.clip(mix, -1, 1) * 32767).astype("<i2")


def write_audio(pcm, path, credit=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-loglevel",
            "error",
            "-y",
            "-f",
            "s16le",
            "-ar",
            str(RATE),
            "-ac",
            "2",
            "-i",
            "pipe:0",
            "-map_metadata",
            "-1",
            *(["-metadata", "comment=" + credit] if credit else []),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(path),
        ],
        input=pcm.tobytes(),
        check=True,
    )


def piece(library, style, out, private):
    score = SCORES[style]
    beat = 60 / score["tempo"]
    bars = len(score["harmony"])
    meter = score["beats"]
    mix = np.zeros((round((0.14 + bars * meter * beat + 1.15) * RATE), 2))
    events = []
    time, dynamic = np.array(score["arc"]).T
    for bar, chord in enumerate(score["harmony"]):
        for t, pitch, length, accent in guitar_phrase(style, bar, chord, bars):
            part = score["partner"]
            lowest = {"guitar": "E2", "mandolin": "G3", "banjo": "C3"}[part]
            pitch = fingered_octave(pitch, lowest)
            # Voice missing pitches one octave higher on the same instrument.
            try:
                library.choose(part, pitch, beat * length)
            except ValueError:
                pitch = pitch[:-1] + str(int(pitch[-1]) + 1)
            level = -24.9 if bar < 2 and style == "watercolour" else -27.9
            stereo_note(
                library,
                mix,
                events,
                0.14 + (bar * meter + t) * beat,
                part,
                pitch,
                length * beat,
                level + accent + np.interp(bar, time, dynamic),
                0.65,
                firm=style == "watercolour" and t == 0 and (
                    (pitch == "G2" and bar in (1, 5, 10, 17)) or (pitch == "D3" and bar in (7, 15))
                ),
            )
    for bar, t, pitch, length in score["line"]:
        stereo_note(
            library,
            mix,
            events,
            0.14 + (bar * meter + t) * beat,
            score["lead"],
            pitch,
            length * beat,
            -22.7 + np.interp(bar + t / meter, time, dynamic),
            0.88,
        )
    end = round((max(event["end"] for event in events) + 0.31) * RATE)
    pcm = master(mix[:end], -3.6)
    write_audio(pcm, out / (style + ".mp3"))
    wavfile.write(private / (style + ".wav"), RATE, pcm)
    return dict(
        title=score["title"],
        seconds=round(len(pcm) / RATE, 3),
        rmsDbfs=round(float(10 * np.log10(np.mean((pcm.astype(float) / 32768) ** 2))), 2),
        melodyEntries=len(score["line"]),
        events=sorted(events, key=lambda e: e["start"]),
    )


def responses(library, out):
    buffer = np.zeros((round(29 * RATE), 2))
    marks = {}
    log = []
    cursor = 0.15
    for style, score in SCORES.items():
        a, b, c, d = score["cue"]
        part = score["partner"]
        low = {"guitar": "E2", "mandolin": "G3", "banjo": "C3"}[part]
        # The select acknowledgement is an upward pair, the arrival a slower
        # open interval. A room threshold answers in contrary motion.
        phrases = {
            "select": ((0, a, 0.20), (0.09, b, 0.25)),
            "arrival": ((0, a, 0.44), (0.23, c, 0.39)),
            "threshold": ((0, c, 0.26), (0.12, d, 0.25), (0.29, b, 0.32)),
        }
        marks[style] = {}
        for kind, notes in phrases.items():
            for i, (at, note, hold) in enumerate(notes):
                pitch = fingered_octave(note, low)
                try:
                    library.choose(part, pitch, hold)
                except ValueError:
                    pitch = pitch[:-1] + str(int(pitch[-1]) + 1)
                stereo_note(library, buffer, log, cursor + at, part, pitch, hold, -26.5 - i * 1.3, 0.72 + i * 0.06)
            length = max(at + hold for at, _, hold in notes) + 0.28
            marks[style][kind] = [round(cursor, 3), round(length, 3)]
            cursor += length + 0.35
    pcm = master(buffer[: round(cursor * RATE)], -8)
    write_audio(pcm, out / "responses.mp3")
    return marks


def mix_coast(pcm, starts, cuts):
    """Return the film mix and retain the musicians' separate, unchanged master."""
    decoded = subprocess.check_output(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(SHORE),
         "-ac", "2", "-ar", str(RATE), "-f", "f32le", "pipe:1"]
    )
    field = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2)
    # The recording is from the cliff. Keep the swell and the stereo spread;
    # ease the wind on the microphones and the close fizz above the surf.
    band = signal.butter(2, [70, 4100], btype="bandpass", fs=RATE, output="sos")
    field = signal.sosfilt(band, field, axis=0)
    reference = np.sqrt(np.mean(field**2))
    mixed = pcm.copy()
    takes = {}
    # The evening wave keeps its original time across the cut from paint to night.
    for shot, source, delay, attack, release, level in (
        ("coast-dawn", 4, 1.45, 1.25, 1.2, -38),
        ("coast-dusk", 17, 0, 1.0, 0, -36.5),
        ("coast-night", 17 + cuts["coast-dusk"]["seconds"], 0, 0, 1.65, -36.5),
    ):
        length = cuts[shot]["seconds"] * RATE
        water = field[source * RATE : source * RATE + length].copy()
        if len(water) != length:
            raise ValueError(f"The retained La Jolla recording is too short for {shot}")
        water *= 10 ** (level / 20) / reference
        hold, rise, fall = (round(seconds * RATE) for seconds in (delay, attack, release))
        water[:hold] = 0
        if rise:
            water[hold : hold + rise] *= np.sin(np.linspace(0, np.pi / 2, rise))[:, None] ** 2
        if fall:
            water[-fall:] *= np.cos(np.linspace(0, np.pi / 2, fall))[:, None] ** 2
        region = slice(starts[shot] * RATE, starts[shot] * RATE + length)
        summed = np.rint(pcm[region] + 32768 * water)
        if summed.max() > 32767 or summed.min() < -32768:
            raise ValueError(f"Coast mix clips in {shot}")
        mixed[region] = summed.astype("<i2")
        takes[shot] = {
            "originalStartSeconds": 200 + source,
            "fieldRmsDbFS": round(float(10 * np.log10(np.mean(water**2))), 2),
        }
    return mixed, takes


def film_music(library, out, private):
    total = sum(length for _, length in film.CUTS)
    mix = np.zeros((total * RATE, 2))
    events = []
    cuts = {}
    starts = {}
    at = 0
    for shot, length in film.CUTS:
        starts[shot] = at
        parts = film.PARTS.get(shot, {})
        for part, phrase in parts.items():
            # A single centred player out on the bluff. The open room and
            # sunset separate the guitar on the left from the bows on the right.
            pan = 0.785 if shot == "coast-dawn" else {"guitar": 0.56, "cello": 0.86, "violin": 1.03}[part]
            for beat, pitch, beats, db in phrase:
                stereo_note(library, mix, events, at + beat * film.BEAT, part, pitch, beats * film.BEAT, db, pan)
        cuts[shot] = {"seconds": length, "scored": bool(parts)}
        at += length

    # One master across the whole film preserves the quiet of the stair
    # and the level of the late reveal on every supported rail edit.
    pcm = master(mix, -3.6)
    wavfile.write(private / "the-door-is-open.wav", RATE, pcm)
    pcm, shore_takes = mix_coast(pcm, starts, cuts)
    wavfile.write(private / "the-door-is-open-on-the-coast.wav", RATE, pcm)
    at = 0
    for shot, length in film.CUTS:
        if cuts[shot]["scored"]:
            samples = pcm[at * RATE : (at + length) * RATE].astype(float)
            edge = round(0.018 * RATE)
            ramp = np.sin(np.linspace(0, np.pi / 2, edge))[:, None] ** 2
            samples[:edge] *= ramp
            samples[-edge:] *= ramp[::-1]
            credit = SHORE_CREDIT if shot in shore_takes else None
            write_audio(np.rint(samples).astype("<i2"), out / "film" / (shot + ".mp3"), credit)
        at += length
    performance = {
        "source": SOURCE,
        "shore": {"credit": SHORE_CREDIT, "takes": shore_takes},
        "cuts": cuts,
        "events": sorted(events, key=lambda event: event["start"]),
    }
    (private / "film-performance.json").write_text(
        json.dumps(performance, indent=2) + "\n", encoding="utf-8"
    )
    return {"title": film.TITLE, "cuts": cuts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strings", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--review", type=Path, required=True)
    args = parser.parse_args()
    args.review.mkdir(parents=True, exist_ok=True)
    library = Recordings(args.strings)
    try:
        pieces = {style: piece(library, style, args.output, args.review) for style in SCORES}
        cues = responses(library, args.output)
        film_index = film_music(library, args.output, args.review)
    finally:
        library.archive.close()
    index = {
        "version": 1,
        "themes": {key: {k: v for k, v in s.items() if k in ("title", "seconds")} for key, s in pieces.items()},
        "cues": cues,
        "film": film_index,
    }
    (args.output / "score.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    (args.review / "performance.json").write_text(
        json.dumps({"source": SOURCE, "pieces": pieces}, indent=2) + "\n", encoding="utf-8"
    )
    for key, p in pieces.items():
        print(key, p["title"], p["seconds"], p["rmsDbfs"], p["melodyEntries"])


if __name__ == "__main__":
    main()
