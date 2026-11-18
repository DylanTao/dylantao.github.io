#!/usr/bin/env python3
"""A read-only summary of the personal website's Google Analytics, for deciding what to improve.

Sirui, November 17, 2026: "are you able to track google analytics data for later data-driven self
improvement". This reads the GA4 property through the Data API with the read-only service account
`website-analytics-reader` and keeps aggregates only: no visitor rows, nothing personal.

Every request is filtered to the real site's host. Before November 17 the site's own test runs
reported to the same property from 127.0.0.1 and were most of the recorded users
(docs/creative-direction.md, brief 8).

The key file is never in this repository. It is found through GOOGLE_APPLICATION_CREDENTIALS, or
as the newest luminous-byway-386322-*.json in the Downloads folder. Output goes to a folder outside
the repository (by default ~/.local/share/site-analytics), because the repository is public.

    python bin/site_analytics_report.py                 # the last 28 days against the 28 before
    python bin/site_analytics_report.py --days 90 --out D:/private/site-analytics
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PROPERTY = os.environ.get("GA4_PROPERTY_ID", "467687350")
HOST = os.environ.get("SITE_HOST", "dylantao.github.io")
KEY_PATTERN = "luminous-byway-386322-*.json"
SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
API = "https://analyticsdata.googleapis.com/v1beta/properties/{}:runReport"

TOTALS = ("activeUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration")
REPORTS = {
    "pages": {"dimensions": ("pagePath",), "metrics": ("screenPageViews", "activeUsers", "userEngagementDuration"), "order": "screenPageViews", "limit": 25},
    "landing": {"dimensions": ("landingPage",), "metrics": ("sessions", "engagementRate"), "order": "sessions", "limit": 15},
    "channels": {"dimensions": ("sessionDefaultChannelGroup",), "metrics": ("sessions", "engagementRate"), "order": "sessions"},
    "devices": {"dimensions": ("deviceCategory",), "metrics": ("activeUsers", "engagementRate", "averageSessionDuration"), "order": "activeUsers"},
    "countries": {"dimensions": ("country",), "metrics": ("activeUsers",), "order": "activeUsers", "limit": 10},
    "events": {"dimensions": ("eventName",), "metrics": ("eventCount",), "order": "eventCount", "limit": 25},
}


def host_filter(host: str = HOST) -> dict:
    return {"filter": {"fieldName": "hostName", "stringFilter": {"value": host}}}


def report_body(days, dimensions=(), metrics=(), order=None, limit=None, offset=0, host=HOST) -> dict:
    """One runReport request over `days` whole days ending yesterday, `offset` such periods back."""
    end = days * offset + 1
    body = {
        "dateRanges": [{"startDate": f"{end + days - 1}daysAgo", "endDate": "yesterday" if end == 1 else f"{end}daysAgo"}],
        "dimensions": [{"name": name} for name in dimensions],
        "metrics": [{"name": name} for name in metrics],
        "dimensionFilter": host_filter(host),
    }
    if order:
        body["orderBys"] = [{"metric": {"metricName": order}, "desc": True}]
    if limit:
        body["limit"] = limit
    return body


def rows(response: dict) -> list[dict]:
    """A runReport response as a list of dicts, with the metrics as numbers."""
    dimensions = [header["name"] for header in response.get("dimensionHeaders", [])]
    metrics = [header["name"] for header in response.get("metricHeaders", [])]
    out = []
    for row in response.get("rows", []):
        item = {name: value["value"] for name, value in zip(dimensions, row.get("dimensionValues", []))}
        item.update({name: float(value["value"]) for name, value in zip(metrics, row.get("metricValues", []))})
        out.append(item)
    return out


def collect(run, days: int) -> dict:
    """Every report, through `run` (a request body in, a response out)."""
    data = {"current": rows(run(report_body(days, metrics=TOTALS))), "previous": rows(run(report_body(days, metrics=TOTALS, offset=1)))}
    for name, spec in REPORTS.items():
        data[name] = rows(run(report_body(days, **spec)))
    return data


def change(now: float, before: float) -> str:
    return "new" if not before else f"{(now - before) / before * 100:+.0f}%"


def summarise(data: dict, days: int, host: str = HOST, today: str | None = None) -> str:
    """A short page an agent or Sirui reads before choosing what to improve."""
    today = today or dt.date.today().isoformat()
    now = (data.get("current") or [{}])[0]
    before = (data.get("previous") or [{}])[0]
    lines = [f"# {host}: the last {days} days, to yesterday (read {today})", ""]
    for key, label, form in (
        ("activeUsers", "Visitors", "{:.0f}"),
        ("sessions", "Visits", "{:.0f}"),
        ("screenPageViews", "Page views", "{:.0f}"),
        ("engagementRate", "Engaged visits", "{:.0%}"),
        ("averageSessionDuration", "Average visit", "{:.0f} s"),
    ):
        value = now.get(key, 0.0)
        lines.append(f"- {label}: {form.format(value)} ({change(value, before.get(key, 0.0))} on the {days} days before)")
    lines += ["", "## Pages (views, visitors, engaged seconds per visitor)"]
    for page in data.get("pages", [])[:12]:
        each = page["userEngagementDuration"] / max(page["activeUsers"], 1)
        lines.append(f"- {page['pagePath']}: {page['screenPageViews']:.0f} views, {page['activeUsers']:.0f} visitors, {each:.0f} s each")
    lines += ["", "## Where visits come from (visits, engaged)"]
    for channel in data.get("channels", []):
        lines.append(f"- {channel['sessionDefaultChannelGroup']}: {channel['sessions']:.0f}, {channel['engagementRate']:.0%}")
    lines += ["", "## Devices (visitors, engaged, average visit)"]
    for device in data.get("devices", []):
        lines.append(f"- {device['deviceCategory']}: {device['activeUsers']:.0f}, {device['engagementRate']:.0%}, {device['averageSessionDuration']:.0f} s")
    lines += ["", "## First page of a visit (visits, engaged)"]
    for page in data.get("landing", [])[:8]:
        lines.append(f"- {page['landingPage']}: {page['sessions']:.0f}, {page['engagementRate']:.0%}")
    return "\n".join(lines) + "\n"


def output_dir(path: str) -> Path:
    """Where to write, refusing anywhere inside this public repository."""
    out = Path(path).expanduser().resolve()
    if out == REPO or REPO in out.parents:
        raise SystemExit(f"refusing to write visitor data inside the public repository: {out}")
    return out


def key_file() -> str:
    named = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if named:
        return named
    found = sorted(glob.glob(str(Path.home() / "Downloads" / KEY_PATTERN)), key=os.path.getmtime)
    if not found:
        raise SystemExit(f"no key: set GOOGLE_APPLICATION_CREDENTIALS, or put {KEY_PATTERN} in Downloads")
    return found[-1]


def runner(key: str):
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account

    session = AuthorizedSession(service_account.Credentials.from_service_account_file(key, scopes=[SCOPE]))

    def run(body: dict) -> dict:
        response = session.post(API.format(PROPERTY), json=body, timeout=60)
        if response.status_code != 200:
            raise SystemExit(f"Analytics answered {response.status_code}: {response.json().get('error', {}).get('message', '')[:200]}")
        return response.json()

    return run


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--out", default=str(Path.home() / ".local" / "share" / "site-analytics"))
    args = parser.parse_args(argv)
    out = output_dir(args.out)
    data = collect(runner(key_file()), args.days)
    today = dt.date.today().isoformat()
    summary = summarise(data, args.days, today=today)
    out.mkdir(parents=True, exist_ok=True)
    record = {"host": HOST, "property": PROPERTY, "days": args.days, "read": today, **data}
    (out / f"site-analytics-{today}-{args.days}d.json").write_text(json.dumps(record, indent=1), encoding="utf-8")
    (out / "latest.md").write_text(summary, encoding="utf-8")
    sys.stdout.write(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
