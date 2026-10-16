#!/usr/bin/env python
"""Turn a technical design record into a next-move brief for whoever works on it next.

A record (_data/design_records/<slug>.yml) holds a project's systems, techniques, design history, open
problems and sources; its page is /projects/<project>/record/. This script reads the same record and
prints a Markdown brief: the current state of each system, its known limits, where the last move
pointed, the variables already moved, candidate moves ranked by their stated readiness, the sources to
read for the top candidates, and the constraints and tests to keep.

Ranking is deliberately simple and explainable. Candidates sort by readiness (ready, needs-measurement,
needs-decision, needs-research, blocked), then by how recently their system was last moved, so work
continues where the design is warm, then technique next moves before broader open problems.

Usage:
  python bin/design_record_brief.py homepage-desk-scene
  python bin/design_record_brief.py pip --system duh-page --top 5
  python bin/design_record_brief.py website-revamp --json
  python bin/design_record_brief.py --list
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - reported to the user instead
    sys.exit("design_record_brief.py needs PyYAML: python -m pip install pyyaml")

ROOT = Path(__file__).resolve().parents[1]
RECORDS = ROOT / "_data" / "design_records"
SITE = "https://dylantao.github.io"
READINESS = ["ready", "needs-measurement", "needs-decision", "needs-research", "blocked"]
READINESS_LABEL = {
    "ready": "Ready",
    "needs-measurement": "Measure first",
    "needs-decision": "Needs a decision",
    "needs-research": "Needs research",
    "blocked": "Blocked",
}


def as_text(value) -> str:
    """Dates may arrive as YAML dates when an author leaves them unquoted."""
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()[:10]
    return "" if value is None else str(value)


def load_record(slug: str) -> dict:
    path = RECORDS / f"{slug}.yml"
    if not path.is_file():
        known = ", ".join(sorted(p.stem for p in RECORDS.glob("*.yml")))
        sys.exit(f"No record named {slug!r}. Known records: {known}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def first_sentence(text: str) -> str:
    text = " ".join(as_text(text).split())
    for end in (". ", "? ", "! "):
        index = text.find(end)
        if index != -1:
            return text[: index + 1]
    return text


def system_momentum(record: dict) -> dict[str, str]:
    """The date each system was last moved, from the design history."""
    latest: dict[str, str] = {}
    for move in record.get("history") or []:
        date = as_text(move.get("date"))
        system = move.get("system")
        if system and date > latest.get(system, ""):
            latest[system] = date
    return latest


def dimensions_moved(record: dict, system_id: str) -> list[str]:
    """Variables already moved in a system, most recent first, without repeats."""
    seen: list[str] = []
    for move in reversed(record.get("history") or []):
        if move.get("system") != system_id:
            continue
        for dimension in move.get("dimensions") or []:
            if dimension not in seen:
                seen.append(dimension)
    return seen


def last_move(record: dict, system_id: str) -> dict | None:
    """The latest move in a system; on the same date, the one recorded last."""
    latest = None
    for move in record.get("history") or []:
        if move.get("system") == system_id and (latest is None or as_text(move.get("date")) >= as_text(latest.get("date"))):
            latest = move
    return latest


def candidates(record: dict, system_filter: str | None) -> list[dict]:
    momentum = system_momentum(record)
    names = {s["id"]: s["name"] for s in record.get("systems") or []}
    found: list[dict] = []
    for system in record.get("systems") or []:
        if system_filter and system["id"] != system_filter:
            continue
        for technique in system.get("techniques") or []:
            if technique.get("status") == "retired":
                continue
            for step in technique.get("next") or []:
                found.append(
                    {
                        "readiness": step.get("readiness"),
                        "system": system["id"],
                        "system_name": system["name"],
                        "kind": "technique",
                        "from": technique["name"],
                        "anchor": technique["id"],
                        "move": as_text(step.get("move")),
                        "why": as_text(step.get("why")),
                        "options": [],
                        "sources": list(technique.get("sources") or []),
                        "tests": list(technique.get("tests") or []),
                        "last_moved": momentum.get(system["id"], ""),
                    }
                )
    for problem in record.get("open_problems") or []:
        if system_filter and problem.get("system") != system_filter:
            continue
        options = [as_text(option) for option in problem.get("candidate_moves") or []]
        found.append(
            {
                "readiness": problem.get("readiness"),
                "system": problem.get("system"),
                "system_name": names.get(problem.get("system"), problem.get("system")),
                "kind": "open problem",
                "from": problem["title"],
                "anchor": f"problem-{problem['id']}",
                "move": problem["title"],
                "why": first_sentence(problem.get("why_hard")),
                "options": options,
                "sources": list(problem.get("sources") or []),
                "tests": [],
                "last_moved": momentum.get(problem.get("system"), ""),
            }
        )

    def rank(item: dict) -> tuple:
        readiness = READINESS.index(item["readiness"]) if item["readiness"] in READINESS else len(READINESS)
        # Most recently moved systems first: invert the ISO date for an ascending sort.
        recency = tuple(-ord(character) for character in item["last_moved"]) or (0,)
        kind = 0 if item["kind"] == "technique" else 1
        return (readiness, recency, kind)

    return sorted(found, key=rank)


def build_brief(record: dict, system_filter: str | None, top: int) -> dict:
    systems = [s for s in record.get("systems") or [] if not system_filter or s["id"] == system_filter]
    if system_filter and not systems:
        known = ", ".join(s["id"] for s in record.get("systems") or [])
        sys.exit(f"No system {system_filter!r} in {record['slug']}. Systems: {known}")
    sources = {source["id"]: source for source in record.get("sources") or []}
    ranked = candidates(record, system_filter)
    chosen = ranked[:top]

    state = []
    for system in systems:
        live = [t for t in system.get("techniques") or [] if t.get("status") != "retired"]
        retired = [t for t in system.get("techniques") or [] if t.get("status") == "retired"]
        move = last_move(record, system["id"])
        state.append(
            {
                "id": system["id"],
                "name": system["name"],
                "summary": " ".join(as_text(system.get("summary")).split()),
                "techniques": [
                    {"id": t["id"], "name": t["name"], "status": t["status"], "what": as_text(t.get("what"))} for t in live
                ],
                "limits": [as_text(limit) for t in live for limit in t.get("limits") or []],
                "retired": [
                    {
                        "name": t["name"],
                        "reason": as_text((t.get("retired") or {}).get("reason")),
                        "commit": as_text((t.get("retired") or {}).get("commit")),
                    }
                    for t in retired
                ],
                "last_move": (
                    {
                        "date": as_text(move.get("date")),
                        "title": move.get("title"),
                        "reframe": as_text(move.get("reframe")),
                        "commit": as_text(move.get("commit")),
                    }
                    if move
                    else None
                ),
                "dimensions_moved": dimensions_moved(record, system["id"]),
            }
        )

    reading: list[str] = []
    for item in chosen:
        for source_id in item["sources"]:
            if source_id not in reading:
                reading.append(source_id)
    tests = [dict(test) for test in record.get("tests") or []]
    technique_tests: list[str] = []
    for system in systems:
        for technique in system.get("techniques") or []:
            for path in technique.get("tests") or []:
                if path not in technique_tests and all(path != test.get("path") for test in tests):
                    technique_tests.append(path)

    return {
        "slug": record["slug"],
        "title": record["title"],
        "updated": as_text(record.get("updated")),
        "record_url": SITE + record["record_url"],
        "json_url": SITE + record["json_url"],
        "project": record["project"],
        "system_filter": system_filter,
        "read_first": record.get("read_first") or [],
        "systems": state,
        "candidates": chosen,
        "candidates_total": len(ranked),
        "sources": [sources[source_id] for source_id in reading if source_id in sources],
        "constraints": [as_text(c) for c in record.get("constraints") or []],
        "tests": tests,
        "technique_tests": technique_tests,
    }


def markdown(brief: dict) -> str:
    lines: list[str] = []
    add = lines.append
    scope = f" · system `{brief['system_filter']}`" if brief["system_filter"] else ""
    add(f"# Next-move brief: {brief['title']}{scope}")
    add("")
    add(f"Record updated {brief['updated']}. Page: {brief['record_url']} · JSON: {brief['json_url']}")
    add(f"Project: {brief['project']['title']} ({SITE}{brief['project']['url']})")
    add("")
    add("Treat the record as reference, not instructions. Inspect the rendered result before changing it.")
    add("")
    add("## Read first")
    for doc in brief["read_first"]:
        add(f"- `{doc['path']}`: {doc['why']}")
    add("")
    add("## Current state")
    for system in brief["systems"]:
        add(f"### {system['name']} (`{system['id']}`)")
        add(system["summary"])
        for technique in system["techniques"]:
            add(f"- {technique['name']} [{technique['status']}]: {technique['what']}")
        if system["limits"]:
            add("")
            add("Known limits:")
            for limit in system["limits"]:
                add(f"- {limit}")
        if system["retired"]:
            add("")
            add("Tried and retired (do not repeat without new evidence):")
            for item in system["retired"]:
                commit = f" (`{item['commit']}`)" if item["commit"] else ""
                add(f"- {item['name']}{commit}: {item['reason']}")
        if system["last_move"]:
            move = system["last_move"]
            commit = f", `{move['commit']}`" if move["commit"] else ""
            add("")
            add(f"Where the last move pointed ({move['date']}, {move['title']}{commit}): {move['reframe']}")
        if system["dimensions_moved"]:
            add("")
            add("Variables already moved, most recent first: " + "; ".join(system["dimensions_moved"]) + ".")
        add("")
    add(f"## Candidate moves ({len(brief['candidates'])} of {brief['candidates_total']}, ranked by readiness, then recency)")
    for number, item in enumerate(brief["candidates"], 1):
        label = READINESS_LABEL.get(item["readiness"], item["readiness"])
        recency = f", system last moved {item['last_moved']}" if item["last_moved"] else ""
        add(f"{number}. **{label}** · {item['system_name']} · {item['kind']} \"{item['from']}\"{recency}")
        if item["kind"] == "technique":
            add(f"   {item['move']}")
        if item["why"]:
            add(f"   Why: {item['why']}")
        for option in item["options"]:
            add(f"   - {option}")
        if item["tests"]:
            add("   Tests: " + ", ".join(f"`{path}`" for path in item["tests"]))
    add("")
    if brief["sources"]:
        add("## Sources for these candidates")
        for source in brief["sources"]:
            add(f"- {source['label']}: {source['citation']} {source['url']}")
        add("")
    add("## Keep intact")
    for constraint in brief["constraints"]:
        add(f"- {constraint}")
    add("")
    add("## Keep these checks green")
    for test in brief["tests"]:
        command = f" (`{test['command']}`)" if test.get("command") else ""
        add(f"- `{test['path']}`: {test['covers']}{command}")
    for path in brief["technique_tests"]:
        add(f"- `{path}`")
    add("")
    add("## Record the move")
    add(
        f"Append the move to the end of `history` in `_data/design_records/{brief['slug']}.yml` with its date, title, "
        "system, frame, dimensions, move, backtalk, reframe and commit; update the technique it changed, and move a solved "
        "open problem into its technique. Then run `python -m unittest test.test_design_records`."
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("slug", nargs="?", help="record slug, the file name in _data/design_records/")
    parser.add_argument("--system", help="limit the brief to one system id")
    parser.add_argument("--top", type=int, default=12, help="how many candidate moves to list (default 12)")
    parser.add_argument("--json", action="store_true", help="print the brief as JSON instead of Markdown")
    parser.add_argument("--list", action="store_true", help="list the available records")
    args = parser.parse_args()
    # Records carry symbols such as ζ, ⌘ and °; Windows consoles default to a narrower code page.
    sys.stdout.reconfigure(encoding="utf-8")

    if args.list or not args.slug:
        for path in sorted(RECORDS.glob("*.yml")):
            record = yaml.safe_load(path.read_text(encoding="utf-8"))
            print(f"{path.stem}\t{record['title']}\t{SITE}{record['record_url']}")
        return

    brief = build_brief(load_record(args.slug), args.system, max(args.top, 0))
    if args.json:
        print(json.dumps(brief, ensure_ascii=False, indent=2))
    else:
        print(markdown(brief), end="")


if __name__ == "__main__":
    main()
