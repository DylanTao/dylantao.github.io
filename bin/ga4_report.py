#!/usr/bin/env python3
"""Export a bounded, private GA4 baseline without changing collection/settings."""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_RELATIVE = Path(".codex/local/analytics")
HOSTNAME = "dylantao.github.io"
SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
API = "https://analyticsdata.googleapis.com/v1beta/"
PAGE_SIZE = 1000
MAX_ROWS = 100000

# Keep dimensions path-only and coarse. No arbitrary queries or user-level data.
PRESETS = (
    ("overview", (), ("sessions", "totalUsers", "screenPageViews", "engagedSessions", "userEngagementDuration", "eventCount")),
    ("daily", ("date",), ("sessions", "totalUsers", "screenPageViews", "engagedSessions")),
    ("landing_pages", ("landingPage", "deviceCategory"), ("sessions", "totalUsers", "engagedSessions", "userEngagementDuration")),
    ("pages", ("pagePath", "deviceCategory"), ("screenPageViews", "totalUsers", "userEngagementDuration")),
    ("acquisition", ("sessionSourceMedium", "deviceCategory"), ("sessions", "engagedSessions")),
    ("events", ("eventName",), ("eventCount", "totalUsers")),
    ("downloads", ("fileExtension", "pagePath"), ("eventCount", "totalUsers")),
    ("outbound_domains", ("linkDomain", "pagePath"), ("eventCount", "totalUsers")),
)

LIMITS = (
    "Measured production-host events only; consent, blockers, missing tags, and direct PDF entries limit coverage.",
    "Event/download/link counts are access attempts, not comprehension, reading, reuse, or inquiries.",
    "Do not sum unique users across days, devices, pages, or event types; sessions can also overlap across page rows.",
    "Do not combine timing_complete values: existing page_load and time_on_page use different units.",
    "Engagement depends on the property's key-event definitions and is not a scholarly outcome.",
    "Before/after comparisons are observational; annotate releases, announcements, and acquisition changes.",
    "GA4 cannot establish AI-search rank or all AI referrals; sparse slices do not justify causal claims.",
    "Property filters, consent settings, retention, key-event definitions, and modeled-data coverage were not audited by this exporter.",
)


class ReportError(Exception):
    """An intentionally bounded, safe-to-display operational error."""


def private_path(value: str | Path, root: Path = ROOT) -> Path:
    """Reject public destinations, traversal, and symlinks escaping private storage."""
    root = root.resolve()
    allowed = root / PRIVATE_RELATIVE
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    if not resolved.is_relative_to(allowed) or resolved == allowed:
        raise ReportError("Use a file or subdirectory inside .codex/local/analytics/.")
    return resolved


def assert_ignored(path: Path, root: Path = ROOT) -> None:
    result = subprocess.run(
        ["git", "check-ignore", "--quiet", "--", str(path.relative_to(root.resolve()))],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise ReportError("Private analytics storage must be gitignored before authentication or export.")


def property_id(value: object) -> str:
    if not isinstance(value, (str, int)) or isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]{0,19}", str(value)):
        raise ReportError("Provide the numeric GA4 property ID, not the public G- measurement ID.")
    return str(value)


def date_window(start: str | None, end: str | None, days: int, today: date | None = None) -> tuple[str, str]:
    today = today or datetime.now(timezone.utc).date()
    if not 1 <= days <= 366:
        raise ReportError("The report window must contain 1 to 366 days.")
    try:
        if any(value is not None and not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) for value in (start, end)):
            raise ValueError
        finish = date.fromisoformat(end) if end else today - timedelta(days=2)
        begin = date.fromisoformat(start) if start else finish - timedelta(days=days - 1)
    except ValueError:
        raise ReportError("Dates must be valid ISO dates in YYYY-MM-DD format.") from None
    if begin > finish or (finish - begin).days >= 366:
        raise ReportError("Use an ordered report window of at most 366 days.")
    if finish >= today - timedelta(days=1):
        raise ReportError("End at least two UTC calendar days ago to avoid partial property days.")
    return begin.isoformat(), finish.isoformat()


def exact_filter(field: str, value: str) -> dict:
    return {"filter": {"fieldName": field, "stringFilter": {"matchType": "EXACT", "value": value, "caseSensitive": True}}}


def build_plan(identifier: str, start: str, end: str) -> dict:
    reports = []
    for name, dimensions, metrics in PRESETS:
        filters = [exact_filter("hostName", HOSTNAME)]
        if name == "downloads":
            filters.append(exact_filter("eventName", "file_download"))
        elif name == "outbound_domains":
            filters.extend((exact_filter("eventName", "click"), exact_filter("outbound", "true")))
        request = {
            "dateRanges": [{"startDate": start, "endDate": end}],
            "dimensions": [{"name": item} for item in dimensions],
            "metrics": [{"name": item} for item in metrics],
            "dimensionFilter": {"andGroup": {"expressions": filters}},
            "limit": str(PAGE_SIZE),
            "returnPropertyQuota": True,
        }
        if dimensions:
            request["orderBys"] = [{"dimension": {"dimensionName": item}} for item in dimensions]
        reports.append({"name": name, "request": request})
    return {
        "schema_version": 1,
        "property": f"properties/{property_id(identifier)}",
        "hostname": HOSTNAME,
        "scope": SCOPE,
        "date_range": {"start": start, "end": end, "selection_clock": "UTC", "processing_buffer_days": 2},
        "reports": reports,
        "limits": list(LIMITS),
    }


def load_config(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(config, dict) or set(config) - {"property_id", "credentials"}:
            raise ValueError
        return config
    except (OSError, ValueError):
        raise ReportError("Local config must be JSON with only property_id and optional credentials fields.") from None


def authenticated_session(credentials_path: Path):
    # Import only on explicit execution: --plan needs no Google dependencies.
    try:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account
    except ImportError:
        raise ReportError("Install optional reporting dependencies: python -m pip install -r requirements-analytics.txt") from None
    try:
        info = json.loads(credentials_path.read_text(encoding="utf-8"))
        if (
            not isinstance(info, dict)
            or info.get("type") != "service_account"
            or info.get("token_uri") != "https://oauth2.googleapis.com/token"
            or info.get("universe_domain", "googleapis.com") != "googleapis.com"
        ):
            raise ValueError
        credentials = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
        return AuthorizedSession(credentials)
    except (OSError, ValueError, TypeError, KeyError):
        raise ReportError("A valid Google service-account JSON file is required in private analytics storage.") from None


def api_request(session, resource: str, method: str, payload: dict) -> dict:
    # Fixed endpoints: never accept a credential or config-supplied report URL.
    if not re.fullmatch(r"properties/[1-9][0-9]{0,19}", resource) or method not in {"runReport", "checkCompatibility"}:
        raise ReportError("Unsupported reporting endpoint.")
    try:
        response = session.post(f"{API}{resource}:{method}", json=payload, timeout=60)
        if response.status_code != 200:
            code = int(response.status_code)
            raise ReportError(f"GA4 reporting returned HTTP {code}. Check Data API enablement, property ID, Viewer access, and quota.")
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError
        return result
    except ReportError:
        raise
    except Exception:
        # Never echo provider bodies, auth exceptions, request headers, or tokens.
        raise ReportError("GA4 reporting failed. Check connectivity and local read-only credentials; no provider body was logged.") from None


def check_compatibility(session, resource: str, request: dict) -> None:
    payload = {key: deepcopy(request[key]) for key in ("dimensions", "metrics", "dimensionFilter")}
    result = api_request(session, resource, "checkCompatibility", payload)
    for kind in ("dimension", "metric"):
        selected = {item["name"] for item in request[f"{kind}s"]}
        entries = {
            item.get(f"{kind}Metadata", {}).get("apiName"): item.get("compatibility")
            for item in result.get(f"{kind}Compatibilities", [])
        }
        if any(entries.get(name) != "COMPATIBLE" for name in selected):
            raise ReportError("A report preset is incompatible with this property's schema; no definitions were changed.")


def fetch_report(session, resource: str, request: dict) -> dict:
    rows = []
    pages = []
    expected_count = None
    headers = None
    seen = set()
    while True:
        page_request = deepcopy(request)
        page_request["offset"] = str(len(rows))
        result = api_request(session, resource, "runReport", page_request)
        current_headers = (result.get("dimensionHeaders", []), result.get("metricHeaders", []))
        try:
            if any(
                [item["name"] for item in current_headers[index]] != [item["name"] for item in request[field]]
                for index, field in enumerate(("dimensions", "metrics"))
            ):
                raise ValueError
        except (TypeError, ValueError, KeyError):
            raise ReportError("GA4 returned unexpected report headers; export stopped.") from None
        try:
            count = int(result.get("rowCount", 0))
        except (ValueError, TypeError):
            raise ReportError("GA4 returned an invalid row count; export stopped.") from None
        if count < 0 or count > MAX_ROWS:
            raise ReportError("Report exceeds the bounded private export size; narrow the date window.")
        if expected_count is None:
            expected_count, headers = count, current_headers
        elif expected_count != count or headers != current_headers:
            raise ReportError("GA4 report changed while paging; rerun a stable historical window.")
        batch = result.get("rows", [])
        if not isinstance(batch, list) or len(rows) + len(batch) > count:
            raise ReportError("GA4 returned inconsistent pagination; export stopped.")
        for row in batch:
            try:
                key = tuple(item["value"] for item in row.get("dimensionValues", []))
                if len(key) != len(current_headers[0]) or len(row["metricValues"]) != len(current_headers[1]) or key in seen:
                    raise ValueError
                seen.add(key)
            except (TypeError, ValueError, KeyError, AttributeError):
                raise ReportError("GA4 returned malformed or duplicate rows; export stopped.") from None
        pages.append({
            "offset": len(rows),
            "returned_rows": len(batch),
            "metadata": result.get("metadata", {}),
            "propertyQuota": result.get("propertyQuota", {}),
        })
        rows.extend(batch)
        if len(rows) == count:
            break
        if not batch:
            raise ReportError("GA4 pagination ended before rowCount; incomplete data was not exported.")
    return {
        "dimensionHeaders": headers[0],
        "metricHeaders": headers[1],
        "rows": rows,
        "rowCount": expected_count,
        "complete": True,
        "pages": pages,
    }


def git_revision() -> str:
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=False)
    revision = result.stdout.strip()
    return revision if result.returncode == 0 and re.fullmatch(r"[0-9a-f]{40}", revision) else "unknown"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Print fixed report requests without credentials, dependencies, network, or file writes.")
    parser.add_argument("--property-id", help="Numeric GA4 property ID (not G- measurement ID).")
    parser.add_argument("--config", default=str(PRIVATE_RELATIVE / "config.json"))
    parser.add_argument("--credentials", help="Service-account JSON inside private analytics storage.")
    parser.add_argument("--output", help="New directory inside private analytics storage; never a published route.")
    parser.add_argument("--start", help="Inclusive YYYY-MM-DD; otherwise end minus days plus one.")
    parser.add_argument("--end", help="Inclusive YYYY-MM-DD; default two UTC calendar days ago.")
    parser.add_argument("--days", type=int, default=90)
    args = parser.parse_args(argv)
    try:
        config_path = private_path(args.config)
        assert_ignored(config_path)
        config = load_config(config_path)
        identifier = property_id(args.property_id or config.get("property_id"))
        start, end = date_window(args.start, args.end, args.days)
        plan = build_plan(identifier, start, end)
        if args.plan:
            print(json.dumps(plan, indent=2))
            return 0
        credentials_path = private_path(args.credentials or config.get("credentials") or PRIVATE_RELATIVE / "ga4-reader.json")
        assert_ignored(credentials_path)
        output = private_path(args.output or PRIVATE_RELATIVE / "reports" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
        assert_ignored(output)
        if output.exists():
            raise ReportError("Output must be a new private directory; existing reports are never overwritten.")
        session = authenticated_session(credentials_path)
        try:
            # Check every definition before reading event statistics.
            for report in plan["reports"]:
                check_compatibility(session, plan["property"], report["request"])
            reports = {
                report["name"]: fetch_report(session, plan["property"], report["request"])
                for report in plan["reports"]
            }
        finally:
            session.close()
        snapshot = {
            **plan,
            "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "repository_revision": git_revision(),
            "results": reports,
        }
        # Publish no partial snapshot if any request or completeness check fails.
        output.mkdir(parents=True, exist_ok=False)
        (output / "snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        print("Saved eight complete aggregate reports in private analytics storage. No collection or settings were changed.")
        print(f"Report directory: {output.relative_to(ROOT)}")
        return 0
    except ReportError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    except Exception:
        print("Error: Local analytics operation failed; no credential or provider details were logged.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
