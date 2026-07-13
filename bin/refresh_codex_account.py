#!/usr/bin/env python3
"""Refresh the public Codex account snapshot without invoking a model.

The collector intentionally reads only the access token and account id from
``~/.codex/auth.json`` and never serializes the authenticated response.  It
publishes the existing sanitized contracts after validating the account-owned
daily and cumulative series in memory.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import audit_agentic_usage as audit


ACCOUNT_ENDPOINT = "https://chatgpt.com/backend-api/wham/profiles/me"
GITHUB_ACTIVITY_ENDPOINT = (
    "https://raw.githubusercontent.com/DylanTao/DylanTao/main/docs/github-activity.json"
)
HEARTBEAT_AFTER = timedelta(hours=18)
MAX_SOURCE_AGE = timedelta(hours=6)
MAX_RESPONSE_BYTES = 5 * 1024 * 1024

EXIT_AUTH = 20
EXIT_ENDPOINT = 21
EXIT_SCHEMA = 22
EXIT_STALE = 23


class RefreshError(RuntimeError):
    exit_code = EXIT_SCHEMA


class AuthError(RefreshError):
    exit_code = EXIT_AUTH


class EndpointError(RefreshError):
    exit_code = EXIT_ENDPOINT


class ContractError(RefreshError):
    exit_code = EXIT_SCHEMA


class StaleError(RefreshError):
    exit_code = EXIT_STALE


@dataclass(frozen=True)
class RefreshStatus:
    changed: bool
    source_as_of: str
    account_changed: bool
    github_fallback_changed: bool
    reason: str
    github_sync: str

    def public_dict(self) -> dict[str, Any]:
        return {
            "changed": self.changed,
            "sourceAsOf": self.source_as_of,
            "accountChanged": self.account_changed,
            "githubFallbackChanged": self.github_fallback_changed,
            "reason": self.reason,
            "githubSync": self.github_sync,
        }


def parse_aware_timestamp(value: Any, label: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ContractError(f"{label} must be an ISO timestamp with timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractError(
            f"{label} must be an ISO timestamp with timezone"
        ) from error
    if parsed.tzinfo is None:
        raise ContractError(f"{label} must be an ISO timestamp with timezone")
    return parsed.astimezone(timezone.utc)


def require_int(value: Any, label: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ContractError(
            f"{label} must be an integer greater than or equal to {minimum}"
        )
    return value


def read_auth() -> tuple[str, str]:
    auth_path = Path.home() / ".codex" / "auth.json"
    try:
        payload = json.loads(auth_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AuthError("Codex authentication is unavailable") from error
    tokens = payload.get("tokens") if isinstance(payload, dict) else None
    access_token = tokens.get("access_token") if isinstance(tokens, dict) else None
    account_id = tokens.get("account_id") if isinstance(tokens, dict) else None
    if not isinstance(access_token, str) or not access_token:
        raise AuthError("Codex authentication is unavailable")
    if not isinstance(account_id, str) or not account_id:
        raise AuthError("Codex authentication is unavailable")
    return access_token, account_id


def fetch_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    authentication_required: bool = False,
) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "dylan-metrics-refresh/1.0",
            **(headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise EndpointError("Metrics endpoint returned an unexpected status")
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as error:
        if authentication_required and error.code in {401, 403}:
            raise AuthError("Codex authentication was rejected") from error
        raise EndpointError("Metrics endpoint request failed") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise EndpointError("Metrics endpoint request failed") from error
    if len(body) > MAX_RESPONSE_BYTES:
        raise EndpointError("Metrics endpoint response was too large")
    try:
        return json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ContractError("Metrics endpoint response was not valid JSON") from error


def load_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError("Input fixture is not valid JSON") from error


def validate_bucket_rows(value: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ContractError(f"{label} must be a non-empty list")
    rows: list[dict[str, Any]] = []
    previous: date | None = None
    for index, row in enumerate(value):
        if not isinstance(row, dict) or set(row) != {"start_date", "tokens"}:
            raise ContractError(f"{label}[{index}] has an unexpected shape")
        try:
            observed = date.fromisoformat(str(row.get("start_date") or ""))
        except ValueError as error:
            raise ContractError(f"{label}[{index}].start_date is invalid") from error
        if previous is not None and observed <= previous:
            raise ContractError(f"{label} dates must be strictly increasing")
        rows.append(
            {
                "date": observed,
                "tokens": require_int(row.get("tokens"), f"{label}[{index}].tokens"),
            }
        )
        previous = observed
    return rows


def validate_raw_account(
    raw: Any,
    current_account: dict[str, Any],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ContractError("Account response must be an object")
    metadata = raw.get("metadata")
    stats = raw.get("stats")
    if not isinstance(metadata, dict) or not isinstance(stats, dict):
        raise ContractError("Account response is missing metadata or stats")
    if metadata.get("stats_error") is not None:
        raise ContractError("Account response reports a statistics error")

    source_as_of = metadata.get("generated_at")
    observed_at = parse_aware_timestamp(source_as_of, "metadata.generated_at")
    current_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    age = current_time - observed_at
    if age > MAX_SOURCE_AGE:
        raise StaleError("Account response is stale")
    if age < -timedelta(minutes=5):
        raise StaleError("Account response timestamp is in the future")
    try:
        stats_as_of = date.fromisoformat(str(metadata.get("stats_as_of") or ""))
    except ValueError as error:
        raise ContractError("metadata.stats_as_of must be an ISO date") from error
    if stats_as_of != observed_at.date():
        raise ContractError("metadata.stats_as_of must match the generated UTC date")

    daily = validate_bucket_rows(
        stats.get("daily_usage_buckets"), "daily_usage_buckets"
    )
    cumulative = validate_bucket_rows(
        stats.get("cumulative_daily_usage_buckets"),
        "cumulative_daily_usage_buckets",
    )
    if len(daily) != len(cumulative):
        raise ContractError("Daily and cumulative bucket counts do not match")
    running = 0
    for index, (day_row, cumulative_row) in enumerate(zip(daily, cumulative)):
        if day_row["date"] != cumulative_row["date"]:
            raise ContractError(f"Cumulative bucket {index} has a mismatched date")
        running += day_row["tokens"]
        if cumulative_row["tokens"] != running:
            raise ContractError(
                f"Cumulative bucket {index} does not match the daily sum"
            )

    lifetime = require_int(
        stats.get("lifetime_tokens"), "stats.lifetime_tokens", minimum=1
    )
    if running != lifetime:
        raise ContractError("Lifetime tokens do not match cumulative activity")
    tasks = require_int(stats.get("total_threads"), "stats.total_threads", minimum=1)
    peak_tokens = require_int(
        stats.get("peak_daily_tokens"),
        "stats.peak_daily_tokens",
        minimum=1,
    )
    computed_peak = max(daily, key=lambda row: row["tokens"])
    if peak_tokens != computed_peak["tokens"]:
        raise ContractError("Peak tokens do not match daily activity")

    source_calendar_date = audit.timestamp_calendar_date(source_as_of)
    if source_calendar_date is None or daily[-1]["date"] != source_calendar_date:
        raise ContractError(
            "Final daily bucket must match the source-local partial date"
        )
    expected_recent_dates = [
        source_calendar_date - timedelta(days=29 - offset) for offset in range(30)
    ]
    if daily[0]["date"] > expected_recent_dates[0]:
        raise ContractError(
            "The account response does not cover the complete recent calendar range"
        )
    daily_by_date = {row["date"]: row["tokens"] for row in daily}
    # The account endpoint omits genuine zero-usage dates.  Canonicalize only
    # the bounded 30-day calendar range; dates outside the response's observed
    # first/last boundary are never invented.
    recent_rows = [
        {"date": observed_date, "tokens": daily_by_date.get(observed_date, 0)}
        for observed_date in expected_recent_dates
    ]

    # Weekly rows are not published because the service uses a different week
    # boundary.  Validate their primitive contract, then derive Sunday buckets
    # from the canonical daily rows below.
    validate_bucket_rows(stats.get("weekly_usage_buckets"), "weekly_usage_buckets")

    current_source = parse_aware_timestamp(
        current_account.get("source_as_of"),
        "current account source_as_of",
    )
    current_tokens = require_int(
        current_account.get("token_count"),
        "current account token_count",
        minimum=1,
    )
    current_tasks = require_int(
        current_account.get("tasks"), "current account tasks", minimum=1
    )
    current_peak = require_int(
        current_account.get("peak_daily_tokens"),
        "current account peak_daily_tokens",
        minimum=1,
    )
    if observed_at < current_source:
        raise StaleError("Account response predates the published snapshot")
    if lifetime < current_tokens or tasks < current_tasks or peak_tokens < current_peak:
        raise StaleError("Account totals are non-monotonic")
    if peak_tokens == current_peak:
        current_peak_date = str(current_account.get("peak_daily_date") or "")
        if current_peak_date and computed_peak["date"].isoformat() != current_peak_date:
            raise StaleError("Account peak date changed without a new peak")

    return {
        "source_as_of": source_as_of,
        "observed_at": observed_at,
        "token_count": lifetime,
        "tasks": tasks,
        "peak_daily_tokens": peak_tokens,
        "peak_daily_date": computed_peak["date"].isoformat(),
        "daily": [
            {"date": row["date"].isoformat(), "tokens": row["tokens"]}
            for row in recent_rows
        ],
    }


def build_account_snapshot(
    current_account: dict[str, Any],
    validated: dict[str, Any],
) -> dict[str, Any]:
    candidate = copy.deepcopy(current_account)
    old_tokens = int(current_account["token_count"])
    old_cost = copy.deepcopy(current_account.get("api_cost_equivalence") or {})
    old_usd = float(old_cost.get("usd_estimate") or 0)
    if old_tokens <= 0 or old_usd <= 0:
        raise ContractError("Published API-equivalent rate is unavailable")
    usd_per_token = old_usd / old_tokens
    new_usd = validated["token_count"] * usd_per_token

    candidate.update(
        {
            "label": "Codex lifetime",
            "source": "Codex account activity",
            "source_as_of": validated["source_as_of"],
            "token_count": validated["token_count"],
            "tokens_label": audit.token_label(validated["token_count"]),
            "tasks": validated["tasks"],
            "peak_daily_tokens": validated["peak_daily_tokens"],
            "peak_daily_date": validated["peak_daily_date"],
        }
    )
    old_cost.update(
        {
            "account_source_as_of": validated["source_as_of"],
            "usd_estimate": round(new_usd, 2),
            "usd_midpoint": audit.rounded_money(new_usd),
            "usd_label": audit.money_amount_label(new_usd),
        }
    )
    candidate["api_cost_equivalence"] = old_cost
    candidate["recent_activity"] = {
        "label": "Last 30 calendar days",
        "partial_last_day": True,
        "daily": copy.deepcopy(validated["daily"]),
    }
    candidate = audit.refresh_account_lifetime_data(candidate, {})
    return candidate


def account_semantics(account: dict[str, Any]) -> dict[str, Any]:
    recent = account.get("recent_activity") or {}
    return {
        "token_count": account.get("token_count"),
        "tasks": account.get("tasks"),
        "peak_daily_tokens": account.get("peak_daily_tokens"),
        "peak_daily_date": account.get("peak_daily_date"),
        "daily": recent.get("daily"),
    }


def account_publication_reason(
    current_account: dict[str, Any],
    candidate_account: dict[str, Any],
) -> str:
    if account_semantics(candidate_account) != account_semantics(current_account):
        return "data"
    current_source = parse_aware_timestamp(
        current_account.get("source_as_of"), "current source"
    )
    candidate_source = parse_aware_timestamp(
        candidate_account.get("source_as_of"), "candidate source"
    )
    if candidate_source - current_source >= HEARTBEAT_AFTER:
        return "heartbeat"
    return "unchanged"


def validate_github_activity(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or set(raw) != {"schema", "generatedAt", "weeks"}:
        raise ContractError("GitHub activity response has an unexpected shape")
    if raw.get("schema") != 2:
        raise ContractError("GitHub activity schema is unsupported")
    parse_aware_timestamp(raw.get("generatedAt"), "github generatedAt")
    weeks = raw.get("weeks")
    if not isinstance(weeks, list) or not weeks:
        raise ContractError("GitHub activity weeks must be non-empty")
    previous: date | None = None
    for index, row in enumerate(weeks):
        if not isinstance(row, dict) or set(row) != {
            "week",
            "additions",
            "deletions",
            "commits",
        }:
            raise ContractError(f"GitHub activity week {index} has an unexpected shape")
        try:
            week = date.fromisoformat(str(row.get("week") or ""))
        except ValueError as error:
            raise ContractError(f"GitHub activity week {index} is invalid") from error
        if week.weekday() != 6 or (
            previous is not None and week != previous + timedelta(days=7)
        ):
            raise ContractError("GitHub activity weeks must be sequential Sundays")
        for field in ("additions", "deletions", "commits"):
            require_int(row.get(field), f"GitHub activity week {index}.{field}")
        previous = week
    return copy.deepcopy(raw)


def ledger_text(data: dict[str, Any]) -> str:
    if audit.yaml is None:
        raise ContractError("PyYAML is required for account refresh")
    return (
        audit.LEDGER_HEADER
        + "\n"
        + audit.yaml.dump(
            data,
            Dumper=audit.IndentedSafeDumper,
            width=1000,
            sort_keys=False,
            allow_unicode=True,
        )
    )


def atomic_write_texts(files: dict[Path, str]) -> None:
    originals = {path: path.read_bytes() if path.exists() else None for path in files}
    temporary: dict[Path, Path] = {}
    replaced: list[Path] = []
    try:
        for path, text in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            handle, temp_name = tempfile.mkstemp(
                prefix=f".{path.name}.", dir=path.parent
            )
            temp_path = Path(temp_name)
            with os.fdopen(handle, "w", encoding="utf-8", newline="") as stream:
                stream.write(text)
                stream.flush()
                os.fsync(stream.fileno())
            temporary[path] = temp_path
        for path, temp_path in temporary.items():
            os.replace(temp_path, path)
            replaced.append(path)
    except OSError as error:
        for path in reversed(replaced):
            original = originals[path]
            if original is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(original)
        raise RefreshError("Could not atomically publish generated data") from error
    finally:
        for temp_path in temporary.values():
            temp_path.unlink(missing_ok=True)


def refresh(
    repo_root: Path,
    raw_account: Any,
    *,
    raw_github: Any | None = None,
    github_sync: str = "skipped",
    write: bool = False,
    now: datetime | None = None,
) -> RefreshStatus:
    if audit.yaml is None:
        raise ContractError("PyYAML is required for account refresh")
    ledger_path = repo_root / "_data" / "agentic_usage.yml"
    current = audit.load_current_ledger(repo_root)
    current_account = (
        current.get("account_lifetime") if isinstance(current, dict) else None
    )
    if not isinstance(current_account, dict):
        raise ContractError("Published account snapshot is unavailable")

    validated = validate_raw_account(raw_account, current_account, now=now)
    candidate_account = build_account_snapshot(current_account, validated)
    snapshot_issues = audit.account_snapshot_check_messages(
        candidate_account,
        now=(now or datetime.now(timezone.utc)),
    )
    if snapshot_issues:
        raise ContractError("Derived account snapshot failed its public contract")

    account_reason = account_publication_reason(current_account, candidate_account)
    account_publish = account_reason != "unchanged"

    next_ledger = copy.deepcopy(current)
    history = audit.load_account_history(repo_root)
    committed_history = audit.load_committed_account_history(repo_root)
    if account_publish:
        next_ledger["updated_at"] = audit.timestamp_calendar_date(
            validated["source_as_of"]
        ).isoformat()
        next_ledger["account_lifetime"] = candidate_account
        history = audit.merge_account_history(history, candidate_account)
    selected_account = candidate_account if account_publish else current_account

    history_issues = audit.account_history_check_messages(
        history,
        selected_account,
        committed_history,
    )
    if history_issues:
        raise ContractError("Account history failed its append-only contract")
    public_text = audit.public_profile_usage_text(selected_account, history)

    github_path = repo_root / "_data" / "github_activity.json"
    github_changed = False
    github_text: str | None = None
    if raw_github is not None:
        github = validate_github_activity(raw_github)
        current_github = load_json_file(github_path)
        current_github = validate_github_activity(current_github)
        incoming_at = parse_aware_timestamp(github["generatedAt"], "github generatedAt")
        current_at = parse_aware_timestamp(
            current_github["generatedAt"], "current github generatedAt"
        )
        if incoming_at < current_at:
            raise StaleError("GitHub activity response predates the embedded fallback")
        if incoming_at == current_at and github != current_github:
            raise ContractError(
                "GitHub activity response conflicts at the published timestamp"
            )
        github_changed = github != current_github
        if github_changed:
            github_text = json.dumps(github, indent=2, ensure_ascii=False) + "\n"

    changed = account_publish or github_changed
    if account_reason == "data":
        reason = "data"
    elif account_reason == "heartbeat":
        reason = "heartbeat"
    elif github_changed:
        reason = "github-fallback"
    else:
        reason = "unchanged"
    if write and changed:
        files: dict[Path, str] = {}
        if account_publish:
            files[ledger_path] = ledger_text(next_ledger)
            files[repo_root / "_data" / "codex_account_history.json"] = (
                json.dumps(history, indent=2, ensure_ascii=False) + "\n"
            )
            files[repo_root / "assets" / "data" / "codex-profile-usage.json"] = (
                public_text
            )
        if github_text is not None:
            files[github_path] = github_text
        atomic_write_texts(files)

    return RefreshStatus(
        changed=changed,
        source_as_of=str(selected_account.get("source_as_of") or ""),
        account_changed=account_publish,
        github_fallback_changed=github_changed,
        reason=reason,
        github_sync=github_sync,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh sanitized Codex account metrics without invoking a model."
    )
    parser.add_argument(
        "--repo-root", default=".", help="Repository root (default: current directory)."
    )
    parser.add_argument(
        "--write", action="store_true", help="Atomically update generated files."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate and report without writing."
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Read an account response fixture instead of the endpoint.",
    )
    parser.add_argument(
        "--github-input",
        type=Path,
        help="Read a GitHub activity fixture instead of its public endpoint.",
    )
    parser.add_argument(
        "--skip-github-sync",
        action="store_true",
        help="Do not refresh the embedded homepage GitHub fallback.",
    )
    parser.add_argument(
        "--json-status",
        action="store_true",
        help="Emit a sanitized JSON status object.",
    )
    args = parser.parse_args()
    if args.write and args.dry_run:
        parser.error("--write and --dry-run are mutually exclusive")
    if not args.write and not args.dry_run:
        parser.error("choose --write or --dry-run")
    return args


def main() -> int:
    args = parse_args()
    try:
        if args.input:
            raw_account = load_json_file(args.input)
        else:
            access_token, account_id = read_auth()
            raw_account = fetch_json(
                ACCOUNT_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "ChatGPT-Account-Id": account_id,
                },
                authentication_required=True,
            )

        raw_github: Any | None = None
        github_sync = "skipped"
        if not args.skip_github_sync:
            try:
                raw_github = (
                    load_json_file(args.github_input)
                    if args.github_input
                    else fetch_json(GITHUB_ACTIVITY_ENDPOINT)
                )
                github_sync = "validated"
            except EndpointError:
                # Account publication remains independent from a transient
                # public GitHub endpoint failure; the last good fallback stays.
                github_sync = "unavailable"

        status = refresh(
            Path(args.repo_root).resolve(),
            raw_account,
            raw_github=raw_github,
            github_sync=github_sync,
            write=args.write,
        )
    except RefreshError as error:
        print(f"refresh=failed category={error.exit_code}", file=sys.stderr)
        return error.exit_code

    if args.json_status:
        print(json.dumps(status.public_dict(), separators=(",", ":"), sort_keys=True))
    else:
        state = "changed" if status.changed else "unchanged"
        print(f"refresh={state} source_as_of={status.source_as_of}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
