#!/usr/bin/env python
"""Codex hook policy for this customized personal site.

The hook is intentionally narrow: it only checks Codex-issued git commit/push
commands and delegates expensive freshness logic to existing repo scripts.
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable


RunCommand = Callable[..., subprocess.CompletedProcess[str]]
LEDGER_AUDIT_TIMEOUT_SECONDS = 75
PUBLISH_BRANCHES = {"main", "master", "v1.0-dev"}

DATE_RE = re.compile(r"\b{key}\s*:\s*['\"]?(?P<date>\d{{4}}-\d{{2}}-\d{{2}})")

PUBLICATION_EXACT_PATHS = {
    "_data/citations.yml",
    "_data/publication_lens.yml",
    "bin/update_scholar_citations.py",
    ".github/workflows/update-citations.yml",
}
PUBLICATION_PREFIXES = (
    "_bibliography/",
    "_includes/publications/",
)
PUBLICATION_SUBSTRINGS = (
    "scholar",
    "citation",
    "publication",
)
HOOK_INFRASTRUCTURE_EXACT_PATHS = {
    ".codex/hooks.json",
    ".codex/hooks/site_policy.py",
    "bin/audit_agentic_usage.py",
    "test/test_codex_hook_policy.py",
}
COMMIT_OPTION_VALUE_FLAGS = {
    "-m",
    "--message",
    "-F",
    "--file",
    "-C",
    "--reuse-message",
    "-c",
    "--reedit-message",
    "--author",
    "--date",
    "--cleanup",
    "-S",
    "--gpg-sign",
    "--fixup",
    "--squash",
    "--pathspec-from-file",
}


def run_command(
    args: list[str],
    *,
    cwd: Path | str | None,
    timeout: int = 30,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=False, timeout=timeout)


def deny(reason: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def add_context(message: str) -> dict[str, Any]:
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": message,
        }
    }


def split_command_segments(command: str) -> list[str]:
    segments: list[str] = []
    current: list[str] = []
    quote: str | None = None
    index = 0

    while index < len(command):
        char = command[index]
        if quote:
            current.append(char)
            if char == quote:
                quote = None
            elif char == "\\" and index + 1 < len(command):
                index += 1
                current.append(command[index])
            index += 1
            continue

        if char in ("'", '"'):
            quote = char
            current.append(char)
            index += 1
            continue

        if char in ";\n":
            segment = "".join(current).strip()
            if segment:
                segments.append(segment)
            current = []
            index += 1
            continue

        if char in "&|":
            segment = "".join(current).strip()
            if segment:
                segments.append(segment)
            current = []
            while index < len(command) and command[index] in "&|":
                index += 1
            continue

        current.append(char)
        index += 1

    segment = "".join(current).strip()
    if segment:
        segments.append(segment)
    return segments


def split_command_tokens(segment: str) -> list[str]:
    try:
        return shlex.split(segment, posix=True)
    except ValueError:
        try:
            return shlex.split(segment, posix=False)
        except ValueError:
            return segment.split()


def extract_git_command(command: str) -> tuple[str, list[str]] | None:
    for segment in split_command_segments(command):
        tokens = split_command_tokens(segment)
        if tokens and tokens[0] == "&":
            tokens = tokens[1:]
        if len(tokens) < 2:
            continue

        executable = Path(tokens[0]).name.lower()
        if executable not in {"git", "git.exe"}:
            continue

        verb = tokens[1].lower()
        if verb not in {"commit", "push"}:
            continue
        return verb, tokens[2:]
    return None


def is_commit_all(args: list[str]) -> bool:
    for arg in args:
        if arg == "--":
            return False
        if arg == "--all" or arg.startswith("--all="):
            return True
        if arg.startswith("-") and not arg.startswith("--") and "a" in arg[1:]:
            return True
    return False


def is_amend(args: list[str]) -> bool:
    return any(arg == "--amend" or arg.startswith("--amend=") for arg in args)


def discover_repo_root(cwd: str | None, runner: RunCommand) -> Path:
    result = runner(["git", "rev-parse", "--show-toplevel"], cwd=cwd or ".", timeout=10)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "could not resolve git repository root")
    return Path(result.stdout.strip()).resolve()


def current_branch(repo_root: Path, runner: RunCommand) -> str:
    result = runner(["git", "branch", "--show-current"], cwd=repo_root, timeout=10)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "could not resolve current git branch")
    return result.stdout.strip()


def run_ledger_check(repo_root: Path, *, include_pending_commit: bool, runner: RunCommand) -> str | None:
    command = [sys.executable, "bin/audit_agentic_usage.py", "--check"]
    remediation = "python bin/audit_agentic_usage.py --write"
    if include_pending_commit:
        command.append("--include-pending-commit")
        remediation += " --include-pending-commit"

    try:
        result = runner(command, cwd=repo_root, timeout=LEDGER_AUDIT_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return (
            "Agentic usage freshness check timed out before commit/push. "
            f"Run `{remediation}`, review `_data/agentic_usage.yml`, then retry."
        )

    if result.returncode == 0:
        return None

    detail = (result.stdout or result.stderr).strip()
    if detail:
        detail = f"\n\nAudit output:\n{detail}"
    return (
        "Agentic usage ledger is stale for this commit/push. "
        f"Run `{remediation}`, review and stage the intended ledger changes, then retry."
        f"{detail}"
    )


def run_stage_aware_ledger_check(
    repo_root: Path,
    *,
    include_pending_commit: bool,
    pending_paths: list[str],
    runner: RunCommand,
) -> str | None:
    command = [sys.executable, "bin/audit_agentic_usage.py", "--check"]
    remediation = "python bin/audit_agentic_usage.py --write"
    if include_pending_commit:
        command.append("--include-pending-commit")
        remediation += " --include-pending-commit"
        for path in pending_paths:
            command.extend(["--pending-path", path])

    try:
        result = runner(command, cwd=repo_root, timeout=LEDGER_AUDIT_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return (
            "Agentic usage freshness check timed out before commit/push. "
            f"Run `{remediation}`, review `_data/agentic_usage.yml`, then retry."
        )

    if result.returncode == 0:
        return None

    detail = (result.stdout or result.stderr).strip()
    if detail:
        detail = f"\n\nAudit output:\n{detail}"
    return (
        "Agentic usage ledger is stale for this commit/push. "
        f"Run `{remediation}`, review and stage the intended ledger changes, then retry."
        f"{detail}"
    )


def staged_paths(repo_root: Path, runner: RunCommand) -> list[str]:
    result = runner(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"],
        cwd=repo_root,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "could not inspect staged paths")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def normalize_path(path: str) -> str:
    normalized = path.replace("\\", "/").lower()
    if normalized.startswith("./"):
        return normalized[2:]
    return normalized


def is_publication_path(path: str) -> bool:
    normalized = normalize_path(path)
    if normalized in PUBLICATION_EXACT_PATHS:
        return True
    if normalized.startswith("_pages/publications"):
        return True
    if any(normalized.startswith(prefix) for prefix in PUBLICATION_PREFIXES):
        return True
    return any(part in normalized for part in PUBLICATION_SUBSTRINGS)


def is_hook_infrastructure_path(path: str) -> bool:
    return normalize_path(path) in HOOK_INFRASTRUCTURE_EXACT_PATHS


def only_hook_infrastructure(paths: list[str]) -> bool:
    return bool(paths) and all(is_hook_infrastructure_path(path) for path in paths)


def commit_pathspecs(args: list[str]) -> list[str]:
    if "--" in args:
        separator = args.index("--")
        return [arg for arg in args[separator + 1 :] if arg]

    pathspecs: list[str] = []
    skip_next = False
    for arg in args:
        if skip_next:
            skip_next = False
            continue
        if arg in COMMIT_OPTION_VALUE_FLAGS:
            skip_next = True
            continue
        if any(arg.startswith(f"{flag}=") for flag in COMMIT_OPTION_VALUE_FLAGS if flag.startswith("--")):
            continue
        if arg.startswith("-"):
            continue
        pathspecs.append(arg)
    return pathspecs


def commit_target_paths(repo_root: Path, args: list[str], runner: RunCommand) -> list[str]:
    pathspecs = commit_pathspecs(args)
    if pathspecs:
        return pathspecs
    return staged_paths(repo_root, runner)


def outgoing_paths(repo_root: Path, runner: RunCommand) -> list[str]:
    upstream = runner(
        ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        cwd=repo_root,
        timeout=10,
    )
    if upstream.returncode != 0:
        return []

    upstream_ref = upstream.stdout.strip()
    if not upstream_ref:
        return []

    result = runner(["git", "diff", "--name-only", f"{upstream_ref}...HEAD"], cwd=repo_root, timeout=10)
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def read_metadata_date(path: Path, key: str) -> date | None:
    if not path.exists():
        return None
    match = re.search(DATE_RE.pattern.format(key=re.escape(key)), path.read_text(encoding="utf-8"))
    if not match:
        return None
    try:
        return datetime.strptime(match.group("date"), "%Y-%m-%d").date()
    except ValueError:
        return None


def citation_status(repo_root: Path, today: date) -> tuple[date | None, bool, bool]:
    last_updated = read_metadata_date(repo_root / "_data" / "citations.yml", "last_updated")
    is_today = last_updated == today
    is_more_than_one_day_stale = last_updated is None or last_updated < today - timedelta(days=1)
    return last_updated, is_today, is_more_than_one_day_stale


def check_scholar_freshness(
    repo_root: Path,
    *,
    commit_args: list[str] | None,
    today: date,
    runner: RunCommand,
) -> dict[str, Any] | None:
    last_updated, is_today, is_more_than_one_day_stale = citation_status(repo_root, today)

    if commit_args is not None:
        paths = staged_paths(repo_root, runner)
        normalized_paths = {normalize_path(path) for path in paths}
        touches_publications = any(is_publication_path(path) for path in paths)
        citations_staged = "_data/citations.yml" in normalized_paths
        publication_lens_staged = "_data/publication_lens.yml" in normalized_paths

        if citations_staged != publication_lens_staged:
            return deny(
                "Scholar citation data files should be staged together. "
                "Run `python bin/update_scholar_citations.py --force`, review `_data/citations.yml` "
                "and `_data/publication_lens.yml`, then stage both intended files."
            )

        if touches_publications and not is_today:
            last_text = last_updated.isoformat() if last_updated else "missing"
            return deny(
                "Staged publication/citation paths require today's Scholar snapshot. "
                f"`_data/citations.yml` last_updated is {last_text}, expected {today.isoformat()}. "
                "Run `python bin/update_scholar_citations.py --force`, review `_data/citations.yml` "
                "and `_data/publication_lens.yml`, then retry the commit."
            )

    if is_more_than_one_day_stale:
        last_text = last_updated.isoformat() if last_updated else "missing"
        return add_context(
            "Google Scholar data is more than one day stale "
            f"(`_data/citations.yml` last_updated: {last_text}). "
            "If this change is publication-adjacent, run `python bin/update_scholar_citations.py --force`; "
            "otherwise the daily GitHub workflow can refresh it."
        )

    return None


def handle_payload(payload: dict[str, Any], *, today: date | None = None, runner: RunCommand = run_command) -> dict[str, Any] | None:
    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command")
    if not isinstance(command, str):
        return None

    parsed = extract_git_command(command)
    if not parsed:
        return None

    verb, args = parsed

    if verb == "commit" and is_commit_all(args):
        return deny(
            "`git commit -a` / `git commit --all` is blocked in this repo. "
            "Stage only the intended files explicitly, then run `git commit`."
        )

    try:
        repo_root = discover_repo_root(payload.get("cwd"), runner)
    except RuntimeError as error:
        return deny(f"Could not run site freshness policy: {error}")

    include_pending_commit = verb == "commit" and not is_amend(args)
    pending_paths: list[str] = []
    if verb == "commit":
        pending_paths = commit_target_paths(repo_root, args, runner)
        if only_hook_infrastructure(pending_paths):
            return None
        branch = current_branch(repo_root, runner)
        # Temporary worker branches can checkpoint without racing the public
        # ledger. The coordinator must integrate them into a publish branch,
        # whose commit and every push still enforce a fresh ledger.
        if not branch or branch in PUBLISH_BRANCHES:
            ledger_error = run_stage_aware_ledger_check(
                repo_root,
                include_pending_commit=include_pending_commit,
                pending_paths=pending_paths,
                runner=runner,
            )
            if ledger_error:
                return deny(ledger_error)
    else:
        pushed_paths = outgoing_paths(repo_root, runner)
        if not only_hook_infrastructure(pushed_paths):
            ledger_error = run_ledger_check(repo_root, include_pending_commit=False, runner=runner)
            if ledger_error:
                return deny(ledger_error)

    try:
        scholar_result = check_scholar_freshness(
            repo_root,
            commit_args=args if verb == "commit" else None,
            today=today or date.today(),
            runner=runner,
        )
    except RuntimeError as error:
        return deny(f"Could not inspect Scholar freshness policy: {error}")
    return scholar_result


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    response = handle_payload(payload)
    if response:
        print(json.dumps(response))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
