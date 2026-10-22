#!/usr/bin/env python
"""Write the still poster and the looping videos for each animated publication preview.

Publication previews appear on the homepage, the publications page, and project
references. The two Physion previews are GIFs (2.2 MB and 6.9 MB), so
`_layouts/bib.liquid` shows them as small, muted, looping videos that play by
themselves while they are on screen (assets/js/preview-motion.mjs), with a pause
control, and keeps the first frame as the poster: it is what reduced-motion and
Save-Data visitors, pages without JavaScript and social cards see. The untouched GIF
stays the large zoomed view and the no-JavaScript link.

For each GIF named in _bibliography/papers.bib this writes, next to it:
  <name>-poster.png   lossless first frame (CI's ImageMagick step adds WebP variants)
  <name>.mp4          H.264, yuv420p, +faststart, sized for the 280 px slot at 2x

One H.264 file plays in every browser the site supports; at this size it is 2-5% of the GIF
(a VP9 WebM was tried and came out larger for the first Physion clip), so there is no second
format to keep in step.

Videos need ffmpeg: `python -m pip install imageio-ffmpeg` provides a static binary
(imageio_ffmpeg.get_ffmpeg_exe()); a system ffmpeg on PATH works too. The encodes use
bit-exact flags, so the same ffmpeg version reproduces the same bytes (the committed files came
from imageio-ffmpeg's ffmpeg 7.1).

Usage: python bin/make_preview_media.py [--check] [--posters-only]
  --check          exit 1 if any poster or video is missing or stale instead of writing it.
  --posters-only   leave the videos alone (no ffmpeg needed).
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
BIBLIOGRAPHY = REPO_ROOT / "_bibliography" / "papers.bib"
PREVIEW_DIR = REPO_ROOT / "assets" / "img" / "publication_preview"

# The preview slot is 280 px wide at most (`sizes="280px"` in bib.liquid); 2x covers every screen.
VIDEO_WIDTH = 560
MP4_ARGS = ["-c:v", "libx264", "-preset", "veryslow", "-crf", "23", "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart"]
BITEXACT = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-an"]


def gif_previews() -> list[Path]:
    text = BIBLIOGRAPHY.read_text(encoding="utf-8")
    names = re.findall(r"preview\s*=\s*\{([^}]+\.gif)\}", text)
    return [PREVIEW_DIR / name.strip() for name in names]


def poster_path(gif: Path) -> Path:
    return gif.with_name(f"{gif.stem}-poster.png")


def video_paths(gif: Path) -> dict[str, Path]:
    return {"mp4": gif.with_suffix(".mp4")}


def first_frame(gif: Path) -> Image.Image:
    with Image.open(gif) as image:
        image.seek(0)
        return image.convert("RGBA")


def gif_timing(gif: Path) -> tuple[int, int]:
    """Frame count and frames per second of a GIF with a constant frame delay."""
    durations = []
    with Image.open(gif) as image:
        try:
            while True:
                durations.append(image.info.get("duration", 100) or 100)
                image.seek(image.tell() + 1)
        except EOFError:
            pass
    delay = max(set(durations), key=durations.count)
    return len(durations), max(1, round(1000 / delay))


def find_ffmpeg() -> str | None:
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg")


def ffmpeg_version(ffmpeg: str) -> str:
    output = subprocess.run([ffmpeg, "-version"], capture_output=True, text=True).stdout
    return output.splitlines()[0] if output else "unknown"


def encode(ffmpeg: str, gif: Path, target: Path, codec_args: list[str]) -> None:
    _, fps = gif_timing(gif)
    filters = f"fps={fps},scale={VIDEO_WIDTH}:-2:flags=lanczos,format=yuv420p"
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(gif), "-vf", filters, *codec_args, *BITEXACT, str(target)]
    subprocess.run(command, check=True)


def mp4_atoms(path: Path) -> list[str]:
    """Top-level box types of an MP4, in file order."""
    data = path.read_bytes()
    atoms, offset = [], 0
    while offset + 8 <= len(data):
        size = int.from_bytes(data[offset : offset + 4], "big")
        kind = data[offset + 4 : offset + 8].decode("latin-1")
        if size == 1 and offset + 16 <= len(data):
            size = int.from_bytes(data[offset + 8 : offset + 16], "big")
        atoms.append(kind)
        if size < 8:
            break
        offset += size
    return atoms


def video_problems(gif: Path) -> list[str]:
    """Checks that need no ffmpeg: present, smaller than the GIF, H.264 with the index up front."""
    problems = []
    paths = video_paths(gif)
    for kind, path in paths.items():
        if not path.is_file():
            problems.append(f"missing video {path.relative_to(REPO_ROOT)}")
        elif path.stat().st_size >= gif.stat().st_size:
            problems.append(f"video larger than its GIF {path.relative_to(REPO_ROOT)}")
    mp4 = paths["mp4"]
    if mp4.is_file():
        atoms = mp4_atoms(mp4)
        if "moov" not in atoms or "mdat" not in atoms or atoms.index("moov") > atoms.index("mdat"):
            problems.append(f"{mp4.relative_to(REPO_ROOT)} is not +faststart (moov must precede mdat)")
        if b"avc1" not in mp4.read_bytes()[:200_000]:
            problems.append(f"{mp4.relative_to(REPO_ROOT)} is not H.264")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--posters-only", action="store_true")
    args = parser.parse_args()

    problems = []
    gifs = gif_previews()
    ffmpeg = None if args.posters_only or args.check else find_ffmpeg()
    if not args.posters_only and not args.check and not ffmpeg:
        print("ffmpeg not found: python -m pip install imageio-ffmpeg (or pass --posters-only)", file=sys.stderr)
        return 1
    if ffmpeg:
        print(f"using {ffmpeg_version(ffmpeg)}")

    for gif in gifs:
        if not gif.is_file():
            problems.append(f"missing GIF preview {gif.relative_to(REPO_ROOT)}")
            continue
        poster = poster_path(gif)
        frame = first_frame(gif)
        if args.check:
            if not poster.is_file():
                problems.append(f"missing poster {poster.relative_to(REPO_ROOT)}")
            else:
                with Image.open(poster) as existing:
                    if existing.size != frame.size or existing.convert("RGBA").tobytes() != frame.tobytes():
                        problems.append(f"stale poster {poster.relative_to(REPO_ROOT)}")
            problems.extend(video_problems(gif))
            continue
        frame.save(poster, format="PNG", optimize=True)
        print(f"wrote {poster.relative_to(REPO_ROOT)} ({frame.width}x{frame.height}, {poster.stat().st_size // 1024} KB)")
        if args.posters_only:
            continue
        frames, fps = gif_timing(gif)
        for target in video_paths(gif).values():
            encode(ffmpeg, gif, target, MP4_ARGS)
            print(f"wrote {target.relative_to(REPO_ROOT)} ({frames} frames at {fps} fps, {target.stat().st_size // 1024} KB)")

    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
