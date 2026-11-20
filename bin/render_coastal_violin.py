"""Render the first original solo violin study for the coastal house.

The score gives each note its duration in eighth notes, bow group and dynamic.
The bridge force uses harmonics of an ideal stick–slip cycle, coloured by a
resonant body. The body and room are synthesized, with no sampled performance.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io.wavfile import write

RATE = 44100
EIGHTH = 0.322
# MIDI note 62 is the violin's open D. A zero pitch is breathing room.
SCORE = (
    ((57, 1.00, 1, 0.41),),
    ((62, 3.0, 2, 0.63), (65, 2.0, 2, 0.74), (64, 1.0, 2, 0.66)),
    ((69, 2.0, 3, 0.82), (67, 1.0, 3, 0.75), (65, 2.0, 4, 0.69), (64, 1.0, 4, 0.60)),
    ((62, 3.6, 5, 0.68), (57, 2.4, 6, 0.48)),
    ((60, 1.7, 7, 0.52), (62, 3.45, 7, 0.55), (0, 0.85, 0, 0)),
    ((69, 2.0, 8, 0.73), (71, 1.0, 8, 0.78), (74, 3.0, 9, 0.91)),
    ((72, 2.9, 10, 0.87), (69, 2.0, 10, 0.78), (67, 1.1, 10, 0.71)),
    ((65, 2.8, 11, 0.69), (64, 1.15, 11, 0.60), (62, 2.05, 12, 0.55)),
    ((67, 3.85, 13, 0.72), (69, 1.22, 13, 0.67), (0, 0.93, 0, 0)),
    ((72, 1.5, 14, 0.79), (71, 1.5, 14, 0.75), (69, 3.0, 15, 0.72)),
    ((67, 2.0, 16, 0.66), (65, 1.0, 16, 0.64), (62, 3.0, 17, 0.68)),
    ((57, 1.8, 18, 0.49), (60, 1.2, 18, 0.57), (64, 2.0, 19, 0.62), (62, 1.0, 19, 0.54)),
    ((62, 5.4, 20, 0.55),),
)
BAR_TEMPI = (0.95, 1.00, 0.98, 1.04, 1.09, 0.97, 0.99, 1.02, 1.07, 0.97, 1.01, 1.07, 1.16)


def resonant_body(frequency):
    # Low air and plate modes, other wood modes and the broader bridge hill.
    modes = (
        (280, 37, 0.64),
        (432, 42, 1.08),
        (536, 61, 0.91),
        (760, 106, 0.37),
        (1120, 152, 0.36),
        (1515, 190, 0.31),
        (2520, 530, 0.53),
        (3040, 395, 0.29),
    )
    return 0.19 + sum(gain / (1 + ((frequency - centre) / width) ** 2) for centre, width, gain in modes)


def note_voice(midi, duration, dynamic, slurred, continues, previous_pitch, rng):
    tail = 0.034 if continues else 0.097
    t = np.arange(round((duration + tail) * RATE)) / RATE
    pitch = 440 * 2 ** ((midi - 69) / 12)
    # The hand settles into vibrato after the beginning of a sustained note.
    depth = (1 - np.exp(-np.maximum(t - 0.072, 0) / 0.20)) * (9 + 11 * dynamic)
    if midi in (62, 69):
        depth *= 0.25
    hand = rng.uniform(4.95, 5.65)
    cents = depth * np.sin(2 * np.pi * (hand * t + 0.032 * np.sin(6.2 * t)) + rng.uniform(-0.4, 0.4))
    onset = np.clip((previous_pitch - midi) * 7, -31, 28) if slurred else -7
    cents += onset * np.exp(-t / 0.035) + 1.7 * np.sin(2 * np.pi * 1.85 * t)
    phase = 2 * np.pi * np.cumsum(pitch * 2 ** (cents / 1200)) / RATE
    tone = np.zeros_like(t)
    pressure = (0.84 + 0.16 * np.sin(np.pi * np.minimum(t / duration, 1))) * dynamic
    contact = rng.uniform(0.082, 0.112)
    for n in range(1, min(42, int(12500 / pitch)) + 1):
        frequency = n * pitch
        bandwidth = np.exp(-frequency / (3250 + 4200 * dynamic))
        bow = (0.36 + 0.64 * abs(np.sinc(n * contact))) / n
        gain = resonant_body(frequency) * bandwidth * bow
        tone += gain * np.sin(n * phase + 0.22 * np.arctan2(frequency - 530, 170)) * pressure ** (0.18 + n * 0.025)
    dust = signal.sosfilt(
        signal.butter(2, (970, 6700), btype="bandpass", fs=RATE, output="sos"), rng.normal(size=t.size)
    )
    force = 0.0022 + (0.004 if slurred else 0.026) * np.exp(-t / 0.040)
    tone += dust * force * (0.76 + 0.24 * np.cos(phase))
    attack = 0.016 if slurred else 0.072 + 0.042 * (1 - dynamic)
    envelope = np.sin(0.5 * np.pi * np.minimum(t / attack, 1)) ** 1.75
    envelope *= np.cos(0.5 * np.pi * np.clip((t - duration) / tail, 0, 1)) ** 2
    return tone * pressure * envelope


def chamber(dry, rng):
    # Early reflections come from distinct walls. The same close violin is
    # present in both ears, with a quiet, darker diffuse tail behind it.
    pair = []
    for taps in (((0.007, 0.100), (0.021, -0.061), (0.034, 0.045)), ((0.012, 0.087), (0.026, 0.060), (0.049, -0.039))):
        time = np.arange(int(0.65 * RATE)) / RATE
        impulse = np.zeros_like(time)
        impulse[0] = 1.0
        for delay, gain in taps:
            impulse[round(delay * RATE)] += gain
        noise = signal.sosfilt(signal.butter(2, 4300, fs=RATE, output="sos"), rng.normal(size=time.size))
        window = (1 - np.exp(-time / 0.031)) * np.exp(-time / 0.095)
        impulse += 0.0028 * window * noise
        pair.append(signal.fftconvolve(dry, impulse))
    return np.column_stack(pair)


def render(directory):
    directory.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(191126)
    notes = [
        (pitch, length * EIGHTH * tempo, group, dynamic)
        for bar, tempo in zip(SCORE, BAR_TEMPI, strict=True)
        for pitch, length, group, dynamic in bar
    ]
    dry = np.zeros(round((sum(note[1] for note in notes) + 0.65) * RATE))
    clock, previous_group, previous_pitch = 0.22, 0, 62
    for i, (pitch, duration, group, dynamic) in enumerate(notes):
        if pitch:
            continues = i + 1 < len(notes) and notes[i + 1][2] == group
            voice = note_voice(pitch, duration, dynamic, group == previous_group, continues, previous_pitch, rng)
            start = round(clock * RATE)
            dry[start : start + len(voice)] += voice
            previous_pitch = pitch
        clock += duration
        previous_group = group
    for hz in (196.0, 293.665, 440.0, 659.255):
        b, a = signal.iirpeak(hz, 94, fs=RATE)
        dry += 0.039 * signal.lfilter(b, a, dry)
    result = chamber(dry, rng)
    result *= 0.71 / np.max(np.abs(result))
    output = directory / "the-stone-window-violin-01.wav"
    write(output, RATE, np.round(result * 32767).astype("<i2"))
    levels = np.sqrt(np.mean(result**2, axis=0))
    stats = {
        "title": "The Stone Window",
        "version": 1,
        "seconds": round(len(result) / RATE, 3),
        "pitchedEvents": sum(bool(p) for p, *_ in notes),
        "sampleRate": RATE,
        "peakDbFS": round(20 * np.log10(np.max(np.abs(result))), 2),
        "rmsDbFS": [round(20 * np.log10(value), 2) for value in levels],
        "clippedSamples": int(np.count_nonzero(np.abs(result) >= 1)),
    }
    (directory / "the-stone-window-violin-01.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    render(parser.parse_args().directory)
