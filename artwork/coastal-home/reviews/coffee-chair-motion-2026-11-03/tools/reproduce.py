"""Rebuild only this private CPU fixture; never install it into the website."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import time


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def relative_name(value):
    name = PurePosixPath(value)
    if name.is_absolute() or ".." in name.parts or ":" in value or "\\" in value:
        raise ValueError("Unsafe archived relative path: " + value)
    return name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", required=True, type=Path)
    parser.add_argument("--raw-dir", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--dense", action="store_true", help="Also rerun all five dense pull fixtures; no complete-routine claim.")
    args = parser.parse_args()
    packet = Path(__file__).resolve().parents[1]
    manifest = json.loads((packet / "MANIFEST.json").read_bytes())
    for row in manifest["files"]:
        source = packet.joinpath(*relative_name(row["path"]).parts)
        if source.stat().st_size != row["bytes"] or digest(source) != row["sha256"]:
            raise ValueError("Packet custody mismatch: " + row["path"])
    inputs = json.loads((packet / "REPLAY-INPUTS.json").read_bytes())
    models = args.models.resolve(strict=True)
    expected_names = {row["path"] for row in inputs["models"]}
    actual_names = {p.relative_to(models).as_posix() for p in models.rglob("*") if p.is_file()}
    if actual_names != expected_names:
        raise ValueError("The complete frozen model inventory differs; do not substitute a partial or newer export.")
    for row in inputs["models"]:
        source = models.joinpath(*relative_name(row["path"]).parts)
        if source.stat().st_size != row["bytes"] or digest(source) != row["sha256"]:
            raise ValueError("Model custody mismatch: " + row["path"])
    raw = args.raw_dir.resolve(strict=True)
    for row in inputs["requiredRaw"]:
        source = raw.joinpath(*relative_name(row["path"]).parts)
        if source.stat().st_size != row["bytes"] or digest(source) != row["sha256"]:
            raise ValueError("Original raw input mismatch: " + row["path"])
    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    if args.check_only:
        print(json.dumps({"pass": True, "models": len(expected_names), "node": node_version, "createdNothing": True, "packetManifestSHA256": digest(packet / "MANIFEST.json"), "replayInputsSHA256": digest(packet / "REPLAY-INPUTS.json")}))
        return 0
    if args.out is None:
        parser.error("--out is required unless --check-only is used")
    allowed = (Path.cwd() / ".jekyll-cache" / "visual-qa").resolve()
    target = args.out.resolve()
    if target == allowed or not target.is_relative_to(allowed) or target.exists():
        raise ValueError("Use a NEW named directory below this checkout's .jekyll-cache/visual-qa; existing paths are never overwritten.")
    copy_targets = [target / row["path"] for row in inputs["sourceFiles"]]
    copy_targets.extend(target / inputs["fixtureRelative"] / "current-pavilion-models-v28" / row["path"] for row in inputs["models"])
    if os.name == "nt" and max(len(str(path)) for path in copy_targets) >= 260:
        raise ValueError("This normal-path Windows copy exceeds259characters; choose a shorter NEW --out name, such as .jekyll-cache/visual-qa/cpm1. No target was created.")
    target.mkdir(parents=True)
    archive = packet / inputs["sourceArchive"]["path"]
    if digest(archive) != inputs["sourceArchive"]["sha256"]:
        raise ValueError("Source archive mismatch")
    with tarfile.open(archive, "r:gz") as stream:
        for member in stream:
            if not member.isfile():
                raise ValueError("Only ordinary source files are permitted in the archive")
            destination = target.joinpath(*relative_name(member.name).parts)
            if not destination.resolve().is_relative_to(target):
                raise ValueError("Archive destination escaped the private fixture")
            destination.parent.mkdir(parents=True, exist_ok=True)
            with stream.extractfile(member) as source, destination.open("xb") as output:
                shutil.copyfileobj(source, output)
    snapshot = inputs["sourceFiles"]
    for row in snapshot:
        destination = target.joinpath(*relative_name(row["path"]).parts)
        if digest(destination) != row["sha256"]:
            raise ValueError("Extracted source mismatch: " + row["path"])
    q = target / inputs["fixtureRelative"]
    for row in inputs["models"]:
        source = models.joinpath(*relative_name(row["path"]).parts)
        destination = q / "current-pavilion-models-v28" / Path(row["path"])
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        if digest(destination) != row["sha256"]:
            raise ValueError("Copied model mismatch")
    for row in inputs["requiredRaw"]:
        source = raw.joinpath(*relative_name(row["path"]).parts)
        destination = q.joinpath(*relative_name(row["path"]).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        if digest(destination) != row["sha256"]:
            raise ValueError("Copied raw input mismatch")
    environment = {key: value for key, value in os.environ.items() if not key.startswith("COFFEE_") and key != "NODE_OPTIONS"}
    environment.update({"COFFEE_ENTRY_METADATA": "PULLBACK-ENTRY-STAGES-V8.json", "COFFEE_FORCE_FRAMES": "", "COFFEE_STOP_ON_FAILURE": "1"})
    replay_tools = target / ".replay-tools"
    replay_tools.mkdir()
    for name in ["path-map.cjs", "path-map-loader.mjs"]:
        shutil.copyfile(packet / "tools" / name, replay_tools / name)
    environment.update({"COFFEE_REPLAY_ORIGINAL_ROOT": inputs["originalSourceRoot"], "COFFEE_REPLAY_ROOT": str(target), "COFFEE_REPLAY_MAP_LOG": str(target / "RESOLVED-INPUTS.jsonl")})
    jobs = [
        ("audit-coffee-chair-motion-v109-replay.mjs", "COFFEE-CHAIR-MOTION-V112-ALL5-REPLAY", "lizard,south-park,simpsons,ghibli,rick-and-morty", "10000"),
        ("audit-coffee-chair-motion-v114-original-reference.mjs", "COFFEE-CHAIR-MOTION-V114-ALL5-ORIGINAL-REFERENCE", "lizard,south-park,simpsons,ghibli,rick-and-morty", "10000"),
    ]
    if args.dense:
        jobs.extend(("audit-pavilion-west-pull-v103-actual-dining.mjs", "DENSE-" + avatar, avatar, "1") for avatar in ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"])
    report = {"node": node_version, "python": sys.version, "target": str(target), "createdUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(), "packetManifestSHA256": digest(packet / "MANIFEST.json"), "replayInputsSHA256": digest(packet / "REPLAY-INPUTS.json"), "sourceArchiveSHA256": digest(archive), "modelInput": str(models), "rawInput": str(raw), "jobs": [], "scope": "Private numerical replay only. No site/model/cache installation, publication, renderer/phone performance or full entry/draw/return/lifecycle acceptance."}
    for producer, label, avatars, step in jobs:
        command = ["node", "--require", str(replay_tools / "path-map.cjs"), "--experimental-loader", (replay_tools / "path-map-loader.mjs").as_uri(), str(q / producer)]
        env = {**environment, "COFFEE_ENTRY_ID": label, "COFFEE_AVATARS": avatars, "COFFEE_CONTACT_STEP": step}
        before = {row["path"]: digest(target / row["path"]) for row in snapshot}
        started = time.monotonic()
        code = None
        failure = None
        try:
            with (target / (label + ".log")).open("xb") as log:
                code = subprocess.run(command, cwd=target, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, timeout=1800).returncode
        except subprocess.TimeoutExpired:
            failure = "The direct Node process exceeded1800seconds and was stopped; outputs retained."
        after = {row["path"]: digest(target / row["path"]) for row in snapshot}
        result = {"command": command, "avatars": avatars, "contactStep": step, "actualNodeExit": code, "failure": failure, "functionalWallSeconds": time.monotonic() - started, "sourceUnchanged": before == after}
        report["jobs"].append(result)
        report["pass"] = code == 0 and failure is None and before == after
        (target / "REPRODUCTION.json").write_bytes((json.dumps(report, indent=2) + "\n").encode())
        print(json.dumps(result), flush=True)
        if not report["pass"]:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
