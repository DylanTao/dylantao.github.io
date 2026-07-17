#!/usr/bin/env python
"""Audit Codex/agentic usage counters for this customized site.

The default mode is read-only. Modern Codex logs are counted from additive
``last_token_usage`` records after copied fork ancestry is globally deduped.
Older retained logs fall back to conservative cumulative deltas.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

try:
    import yaml
except ImportError:  # pragma: no cover - handled in compare output.
    yaml = None


REPO_NEEDLE = "dylantao.github.io"
MAX_IDLE_GAP_SECONDS = 45 * 60
ONE_SHOT_SESSION_HOURS = 0.05
TOKEN_RHYTHM_LABEL = "Site revamp retained-session estimate"
TOKEN_RHYTHM_PRIVACY_NOTE = (
    "Rounded daily cumulative estimates only; private identities and event-level detail are not published."
)

REVAMP_CUTOFF_UTC = datetime(2026, 5, 23, 1, 5, tzinfo=timezone.utc)
DESK_CUTOFF_UTC = datetime(2026, 6, 17, 3, 0, tzinfo=timezone.utc)
LOCAL_LIFETIME_CUTOFF_UTC = datetime(2026, 6, 19, 7, 0, tzinfo=timezone.utc)
GPT_5_6_CUTOVER_UTC = datetime(2026, 7, 9, 21, 28, 23, 394000, tzinfo=timezone.utc)
REVAMP_GIT_SINCE = "2026-05-22T18:05:00-07:00"
DESK_GIT_SINCE = "2026-06-16T20:00:00-07:00"
GPT_5_6_GIT_SINCE = "2026-07-09T14:28:23.394-07:00"
DESK_PATHS = [
    "assets/js/home.js",
    "_sass/_home.scss",
    "_includes/home/hero.liquid",
    "docs/homepage-desk-scene-brief.md",
    "assets/img/home",
]

INTENDED_MODEL = "gpt-5.6-sol"
INTENDED_EFFORT = "ultra"
MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION = 31
# Acknowledgments are exact retained-turn signatures, not model-wide exceptions.
# A new turn id or any changed signature remains unacknowledged and fails closed.
MODEL_DEVIATION_ACKNOWLEDGMENTS: dict[str, dict[str, str]] = {
    "019f4f8c-36c0-7dd1-9bab-e8b3b935ef3f": {
        "timestamp": "2026-07-11T05:00:19.703Z",
        "model": "gpt-5.4-mini",
        "effort": "ultra",
        "acknowledged_at": "2026-07-14",
        "reason": (
            "One-shot Codex-LB routing smoke test requested an exact OK response; retained as "
            "historical non-site development evidence."
        ),
        "provenance": "Retained Codex-LB turn_context and user prompt, audited 2026-07-14.",
    },
    "019f4f8c-ae4b-7471-9ad5-333c04e74596": {
        "timestamp": "2026-07-11T05:00:49.076Z",
        "model": "gpt-5.4-mini",
        "effort": "high",
        "acknowledged_at": "2026-07-14",
        "reason": (
            "One-shot Codex-LB routing smoke test requested an exact OK response; retained as "
            "historical non-site development evidence."
        ),
        "provenance": "Retained Codex-LB turn_context and user prompt, audited 2026-07-14.",
    },
    "019f613b-3b92-7a42-9676-8fe24bb0b808": {
        "timestamp": "2026-07-14T15:24:59.814Z",
        "model": "gpt-5.6-sol",
        "effort": "medium",
        "acknowledged_at": "2026-07-14",
        "reason": (
            "Provider-managed Plan-mode turn for a Codex-LB usage-reset planning request used "
            "host-selected effort and was interrupted before completion."
        ),
        "provenance": (
            "Retained turn_context, exact Codex-LB usage-reset planning prompt, and interrupted-turn "
            "event, audited 2026-07-14."
        ),
    },
    "019f613b-902a-75c1-a544-f1c27c606778": {
        "timestamp": "2026-07-14T15:25:22.541Z",
        "model": "gpt-5.6-sol",
        "effort": "medium",
        "acknowledged_at": "2026-07-14",
        "reason": (
            "Provider-managed Plan-mode turn for a Codex-LB usage-reset planning request used "
            "host-selected effort rather than the declared interactive development default."
        ),
        "provenance": (
            "Retained turn_context and exact Codex-LB usage-reset planning prompt, audited "
            "2026-07-14."
        ),
    },
    "019f615c-e9f3-7891-b9ee-e2e7317c4da3": {
        "timestamp": "2026-07-14T16:01:47.515Z",
        "model": "gpt-5.6-sol",
        "effort": "high",
        "acknowledged_at": "2026-07-14",
        "reason": (
            "Provider-managed verification or automation worker used host-selected effort rather "
            "than changing the declared interactive development default."
        ),
        "provenance": "Retained turn_context and 2026-07-14 coordinator verification audit.",
    },
    "019f648d-aeb5-7f50-97ac-4c8761cba158": {
        "timestamp": "2026-07-15T06:54:09.815Z",
        "model": "gpt-5.6-sol",
        "effort": "xhigh",
        "acknowledged_at": "2026-07-15",
        "reason": (
            "Read-only Codex-LB direct-routing smoke requested the exact DIRECT_OK response and "
            "did not perform site development work."
        ),
        "provenance": (
            "Retained turn_context and exact no-tools DIRECT_OK prompt, audited 2026-07-15."
        ),
    },
    "019f64a1-6822-7ef1-87b9-2bb6c7224a5e": {
        "timestamp": "2026-07-15T07:15:27.525Z",
        "model": "gpt-5.6-sol",
        "effort": "xhigh",
        "acknowledged_at": "2026-07-15",
        "reason": (
            "Explicit direct-OpenAI maintenance lane performed a read-only audit for the private "
            "Codex-LB usage tracker, separate from the declared site-development default."
        ),
        "provenance": (
            "Retained turn_context and exact direct-OpenAI maintenance-lane prompt, audited "
            "2026-07-15."
        ),
    },
    "019f693b-c505-72b2-9b99-a7c1a6ce7a90": {
        "timestamp": "2026-07-16T04:42:37.790Z",
        "model": "gpt-5.6-sol",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "A separate personal-metrics and Codex-LB migration startup turn was recorded at low "
            "before higher-effort thread settings applied, then interrupted before any work; it "
            "did not perform site development."
        ),
        "provenance": (
            "Retained turn_context, exact personal-metrics status prompt, later thread-settings "
            "event, and turn_aborted event, audited 2026-07-16."
        ),
    },
    "019f69a3-ad73-7fa3-8461-3f1bbe3f7fad": {
        "timestamp": "2026-07-16T06:36:07.459Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a VariationWeaver-Canvas tool-action "
            "request and returned an allow decision; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact untrusted-transcript review prompt, and "
            "allow decision, audited 2026-07-16."
        ),
    },
    "019f69a6-0518-7960-acb7-f4400305fdd8": {
        "timestamp": "2026-07-16T06:38:36.667Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a VariationWeaver-Canvas process-level "
            "inspection request and returned a deny decision; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact untrusted-transcript review prompt, and deny "
            "decision, audited 2026-07-16."
        ),
    },
    "019f69bd-d860-7e60-b4b2-b78a26fada2d": {
        "timestamp": "2026-07-16T07:04:42.676Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a semantic-scaffolding-map process "
            "termination request and returned an allow decision; it did not perform site "
            "development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact untrusted-transcript review prompt, and "
            "allow decision, audited 2026-07-16."
        ),
    },
    "019f6a05-b982-7fa3-af7f-e912da833d7e": {
        "timestamp": "2026-07-16T08:23:08.269Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a VariationWeaver-Canvas "
            "request to start a temporary local Vite server; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact first local Vite Start-Process request, and "
            "allow decision, audited 2026-07-16."
        ),
    },
    "019f6a07-76dd-7612-a6a3-9f7d83d4e557": {
        "timestamp": "2026-07-16T08:25:02.089Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a VariationWeaver-Canvas "
            "retry that started a temporary local Vite server; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact second local Vite Start-Process request, and "
            "allow decision, audited 2026-07-16."
        ),
    },
    "019f6a07-f9dd-79a3-ab62-1babf3823a37": {
        "timestamp": "2026-07-16T08:25:36.182Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed an escalated "
            "VariationWeaver-Canvas retry that started a temporary local Vite server; it did not "
            "perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact escalated local Vite Start-Process request, "
            "and allow decision, audited 2026-07-16."
        ),
    },
    "019f6a0d-b77c-70e1-8de2-e30efc43c880": {
        "timestamp": "2026-07-16T08:31:51.847Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove a workspace __pycache__ directory; it "
            "did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact workspace-bounded Remove-Item request, "
            "reviewed session id, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6a16-6582-7d42-b41d-36e74ef95324": {
        "timestamp": "2026-07-16T08:41:20.984Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "VariationWeaver-Canvas request to remove its temporary local-server runtime "
            "directory; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact workspace-bounded Remove-Item request, "
            "reviewed session id, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6aa1-0d01-7630-9fef-bf549e7fd7f1": {
        "timestamp": "2026-07-16T11:12:47.576Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove its tools/__pycache__ directory after a "
            "resolved-path workspace guard; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact planned Remove-Item command, reviewed "
            "session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6aa2-acbf-72c1-b413-78170ed853fa": {
        "timestamp": "2026-07-16T11:14:34.052Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to create a temporary detached Git worktree for "
            "fresh-checkout portability proof; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact planned git worktree add command for commit "
            "b6a273eb, reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, "
            "audited 2026-07-16."
        ),
    },
    "019f6aa4-de12-7203-ab31-e2d77b99c441": {
        "timestamp": "2026-07-16T11:16:57.557Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove its temporary failed portability-proof "
            "worktree; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact planned git worktree remove --force command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6ab3-70b8-7523-a871-9c5801e7ee36": {
        "timestamp": "2026-07-16T11:32:52.778Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove a regenerated tools/__pycache__ after "
            "canonical validation; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact resolved-path-guarded Remove-Item command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6ac3-093a-7763-ac61-b1749d1e7b31": {
        "timestamp": "2026-07-16T11:49:54.711Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove tools/__pycache__ after a resolved-path "
            "workspace guard; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact guarded Remove-Item command, reviewed "
            "session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6ac3-f40b-7283-a602-c23a523fab09": {
        "timestamp": "2026-07-16T11:50:54.823Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to create a corrected temporary detached worktree "
            "for final fresh-checkout portability proof; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact planned git worktree add command for commit "
            "e2bbe996, reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, "
            "audited 2026-07-16."
        ),
    },
    "019f6ac5-1dad-7621-89d1-8ad8b20be6f2": {
        "timestamp": "2026-07-16T11:52:11.001Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a bounded "
            "semantic-scaffolding-map request to remove the now-passing temporary portability "
            "proof worktree; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact planned git worktree remove --force command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6ca5-8281-7ed2-b963-77d28d4b3104": {
        "timestamp": "2026-07-16T20:36:59.135Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the Dockerized production "
            "Jekyll build for this site's first responsive-polish checkpoint; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose run Jekyll build command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6ca9-2a5e-7790-a17f-1afba84e4ee4": {
        "timestamp": "2026-07-16T20:40:54.009Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a localhost smoke request "
            "while the responsive-polish verification server was starting; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact localhost curl command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6ca9-9daa-7e60-8e65-f4d6b0e25cf0": {
        "timestamp": "2026-07-16T20:41:23.224Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a repeated localhost smoke "
            "request while the same verification server was building; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact repeated localhost curl command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6cae-9658-7710-81f9-48e92dfc7f19": {
        "timestamp": "2026-07-16T20:46:49.626Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the final localhost smoke "
            "request after the responsive-polish verification server finished building; the "
            "review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact final localhost curl command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6cb0-db9e-7290-8a2c-44a5baf0f190": {
        "timestamp": "2026-07-16T20:49:17.801Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the targeted four-viewport "
            "Playwright acceptance run for the responsive-polish checkpoint; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact targeted Playwright command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6cb3-9957-7a21-8619-4a70291aa361": {
        "timestamp": "2026-07-16T20:52:17.487Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the four-viewport ledger "
            "screenshot acceptance run for the responsive-polish checkpoint; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact ledger screenshot Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6cc4-4f77-7b02-ba9f-8130494b3be5": {
        "timestamp": "2026-07-16T21:10:33.395Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a read-only Crossref DOI "
            "lookup for the separate semantic-scaffolding-map metadata audit; it did not perform "
            "site development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact C&C 2026 Crossref DOI lookup command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6cc4-ba09-7973-874b-71b69d748e96": {
        "timestamp": "2026-07-16T21:11:00.401Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a read-only Crossref "
            "proceedings query for the separate semantic-scaffolding-map metadata audit; it did "
            "not perform site development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact C&C 2026 Crossref proceedings query, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6cc5-1365-7710-a5d9-62256cbf68fd": {
        "timestamp": "2026-07-16T21:11:22.915Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a read-only official C&C "
            "proceedings fetch for the separate semantic-scaffolding-map metadata audit; it did "
            "not perform site development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact official C&C 2026 proceedings fetch and "
            "session-count command, reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and "
            "allow decision, audited 2026-07-16."
        ),
    },
    "019f6cc6-7865-7ee0-81ab-7bfe242eba33": {
        "timestamp": "2026-07-16T21:12:59.253Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a retry of an exact copy-only patch in "
            "the separate VariationWeaver-Canvas study interface; it did not perform site "
            "development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact StudySurveyPage autosave-copy patch, reviewed "
            "session 019f6a1d-9cd2-7d42-a736-a06f6ef2ac9c, and retry assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cc6-c2b0-7752-99ac-088af26452e6": {
        "timestamp": "2026-07-16T21:13:18.566Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a narrowly scoped cache cleanup in the "
            "separate semantic-scaffolding-map repository; it did not perform site development "
            "work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact tools/__pycache__ removal command, reviewed "
            "session 019f69b1-73e5-7303-9229-8de060348501, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cd1-ba67-76f2-a4d7-3ffbb7aa950f": {
        "timestamp": "2026-07-16T21:25:12.044Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a local responsive-layout verification "
            "server and test command in the separate VariationWeaver-Canvas study interface; it "
            "did not perform site development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact local Vite and responsive-layout test "
            "command, reviewed session 019f6a1d-9cd2-7d42-a736-a06f6ef2ac9c, and approval "
            "assessment, audited 2026-07-16."
        ),
    },
    "019f6cd0-fe68-7a33-b358-009d7fab6fbd": {
        "timestamp": "2026-07-16T21:24:29.063Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a workspace-bounded test-cache cleanup "
            "in the separate semantic-scaffolding-map repository; it did not perform site "
            "development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact resolved-path tests/__pycache__ removal "
            "command, reviewed session 019f6cc9-917c-7f60-a3ec-dada060ad21a, and approval "
            "assessment, audited 2026-07-16."
        ),
    },
    "019f6cd9-179f-7b31-be7d-91fb86144f19": {
        "timestamp": "2026-07-16T21:33:20.048Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a read-only process inspection of the "
            "checkpoint-two Jekyll container; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cd9-f8c2-7391-8dc7-0f927c7901e5": {
        "timestamp": "2026-07-16T21:34:12.330Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a Git fetch in the separate "
            "VariationWeaver-Canvas repository; it did not perform site development work or "
            "change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git fetch origin main command, reviewed "
            "session 019f6a1d-9cd2-7d42-a736-a06f6ef2ac9c, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cda-4d6e-7781-9c31-c7a0fde96b64": {
        "timestamp": "2026-07-16T21:34:34.425Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a read-only CPU-aware process "
            "inspection of the checkpoint-two Jekyll container; the review lane did not change "
            "the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose CPU process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cda-dae6-7aa1-9b30-385a1fe3e029": {
        "timestamp": "2026-07-16T21:35:10.577Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a read-only memory-aware process "
            "inspection of the checkpoint-two Jekyll container; the review lane did not change "
            "the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose memory process command, "
            "reviewed session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, "
            "audited 2026-07-16."
        ),
    },
    "019f6cdb-219d-7e90-bade-d4e741d80a95": {
        "timestamp": "2026-07-16T21:35:33.298Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a workspace-bounded cache cleanup in "
            "the separate semantic-scaffolding-map repository; it did not perform site "
            "development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact resolved-path tools/__pycache__ removal "
            "command, reviewed session 019f6cb6-ccdd-7560-b08c-2162e9c5c64e, and approval "
            "assessment, audited 2026-07-16."
        ),
    },
    "019f6cdb-c44b-7f61-8de3-b1b6473ab70b": {
        "timestamp": "2026-07-16T21:36:10.067Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated another read-only process inspection of "
            "the checkpoint-two Jekyll container; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cdc-2690-7943-b56e-b0e085559cda": {
        "timestamp": "2026-07-16T21:36:35.180Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the focused mobile Paper Constellation "
            "Playwright run; the review lane did not change the declared interactive development "
            "default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact externally served mobile-390 Playwright "
            "command, reviewed session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval "
            "assessment, audited 2026-07-16."
        ),
    },
    "019f6cdc-d93b-7ff3-baa3-2bd3f63b58da": {
        "timestamp": "2026-07-16T21:37:20.981Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a repeated workspace-bounded cache "
            "cleanup in the separate semantic-scaffolding-map repository; it did not perform site "
            "development work or change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact repeated resolved-path tools/__pycache__ "
            "removal command, reviewed session 019f6cb6-ccdd-7560-b08c-2162e9c5c64e, and "
            "approval assessment, audited 2026-07-16."
        ),
    },
    "019f6cdf-38ad-7de1-bc02-497a474c0580": {
        "timestamp": "2026-07-16T21:39:56.789Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a restart of the checkpoint-two Jekyll "
            "verification container after the receipt-layout correction; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose restart command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cdf-c644-7ca2-88ac-ab80a8bc2dde": {
        "timestamp": "2026-07-16T21:40:32.931Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a read-only process check during the "
            "checkpoint-two rebuild; the review lane did not change the declared interactive "
            "development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6ce0-543e-7bc3-81e9-f79afe93f230": {
        "timestamp": "2026-07-16T21:41:09.436Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a final read-only process check during "
            "the checkpoint-two rebuild; the review lane did not change the declared interactive "
            "development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6ce1-4469-73b0-a978-ced69caa8546": {
        "timestamp": "2026-07-16T21:42:10.626Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the final process-and-log inspection for "
            "the checkpoint-two Jekyll rebuild; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process and tail-log command, "
            "reviewed session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, "
            "audited 2026-07-16."
        ),
    },
    "019f6ce1-d540-7332-8e5f-35b3d104a153": {
        "timestamp": "2026-07-16T21:42:47.545Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a repeated Git fetch in the separate "
            "VariationWeaver-Canvas repository; it did not perform site development work or "
            "change the declared site-development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git fetch origin main command, reviewed "
            "session 019f6a1d-9cd2-7d42-a736-a06f6ef2ac9c, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6ce1-d70d-7f43-b33f-c1369f05d646": {
        "timestamp": "2026-07-16T21:42:48.008Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a final read-only process check while "
            "the checkpoint-two Jekyll build settled; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6ce2-9724-7f70-a576-d0b79e4a66d2": {
        "timestamp": "2026-07-16T21:43:37.289Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the last read-only process check before "
            "the checkpoint-two Jekyll container was stopped; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose process command, reviewed "
            "session 019f6cca-4709-7a40-9ea1-dfa0ce6a5845, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cec-ff9f-7cf3-8e21-4d3cffd501ae": {
        "timestamp": "2026-07-16T21:54:59.440Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the fetch required after a safe "
            "non-fast-forward push rejection; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git fetch origin main command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6ced-564a-7521-9aac-35730bda91b8": {
        "timestamp": "2026-07-16T21:55:21.371Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated an attempted full-blob fetch using the "
            "abbreviated remote commit identifier; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact abbreviated-ref no-filter fetch command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and failed-ref result, audited "
            "2026-07-16."
        ),
    },
    "019f6ced-9145-7e33-8dc9-46a41eb57b91": {
        "timestamp": "2026-07-16T21:55:36.677Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the exact full-ref fetch used to inspect "
            "the remote metrics commit; the review lane did not change the declared interactive "
            "development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact full-ref no-filter fetch command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cf1-30e4-7690-983d-5ab2b466ef4d": {
        "timestamp": "2026-07-16T21:59:34.102Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated creation of the detached checkpoint-one "
            "publish worktree used to protect unstaged checkpoint-two work; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git worktree add command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited 2026-07-16."
        ),
    },
    "019f6cf1-854e-7992-be60-a922e221b1d2": {
        "timestamp": "2026-07-16T21:59:55.516Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated replay of the single verified "
            "checkpoint onto the refreshed remote history; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact checkpoint cherry-pick command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and clean cherry-pick result, audited "
            "2026-07-16."
        ),
    },
    "019f6cf1-ba70-7211-99a2-6c1b7aa9a062": {
        "timestamp": "2026-07-16T22:00:09.131Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the exact-history ledger refresh in the "
            "isolated publish worktree; the review lane did not change the declared interactive "
            "development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact audit write command and isolated worktree, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, "
            "audited 2026-07-16."
        ),
    },
    "019f6cf3-6891-7fe2-aa20-dbcc8047d5b2": {
        "timestamp": "2026-07-16T22:01:59.756Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a read-only query of the isolated "
            "worktree ledger used to identify exact integration deviations; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact ripgrep acknowledgment query, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cf4-9ba3-7041-a683-d93dde25ef91": {
        "timestamp": "2026-07-16T22:03:17.844Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated copying the exact policy and policy-test "
            "files into the isolated publish worktree; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact two-file Copy-Item command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited 2026-07-16."
        ),
    },
    "019f6cf5-39f7-7350-826e-085b6c34bf4f": {
        "timestamp": "2026-07-16T22:03:58.583Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the explicit seven-file stash used to "
            "protect checkpoint-two work before rebasing; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact path-scoped git stash command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and approval assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6cf5-609e-76b1-a4b4-b6dd7ad2cce4": {
        "timestamp": "2026-07-16T22:04:08.276Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated rebasing the single checkpoint onto the "
            "inspected metrics-bot refresh; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git rebase origin/main command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and clean rebase result, audited "
            "2026-07-16."
        ),
    },
    "019f6cf5-83ef-7710-8986-a4ee2087b8df": {
        "timestamp": "2026-07-16T22:04:17.309Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated restoring the exact checkpoint-two "
            "stash after the clean rebase; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git stash pop command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, and clean restore result, audited 2026-07-16."
        ),
    },
    "019f6cfc-57d4-7ca1-93e6-66875e905369": {
        "timestamp": "2026-07-16T22:11:45.039Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the Dockerized fast Jekyll build used "
            "to render the final mobile constellation for interaction QA; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose build command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and successful build result, audited "
            "2026-07-16."
        ),
    },
    "019f6d02-ba0c-7ed0-98c8-e217f1183b41": {
        "timestamp": "2026-07-16T22:18:43.195Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the focused mobile Playwright run that "
            "loaded the site's declared external assets; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact external-server Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and two-pass one-skip result, "
            "audited 2026-07-16."
        ),
    },
    "019f6d05-8325-7963-a4c1-8a3980c57b5b": {
        "timestamp": "2026-07-16T22:21:50.681Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a requested Python-cache cleanup in the "
            "separate semantic-scaffolding-map workspace; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Remove-Item request, reviewed session "
            "019f6cb7-2ec2-7363-86a5-e43f65fff4bc, and approval assessment, audited 2026-07-16."
        ),
    },
    "019f6d06-7cef-75b3-b928-f3e9d27de2f7": {
        "timestamp": "2026-07-16T22:22:49.886Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review rejected force-removing a dirty temporary "
            "checkpoint worktree; no removal occurred and the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git worktree remove --force request, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and explicit rejection, "
            "audited 2026-07-16."
        ),
    },
    "019f6d08-d0d0-7fe2-9738-d59f8d7fc4d6": {
        "timestamp": "2026-07-16T22:25:22.178Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the path-verified Python-cache cleanup "
            "in the separate semantic-scaffolding-map workspace; the review lane did not change "
            "the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Resolve-Path and Remove-Item request, "
            "reviewed session 019f6cb7-2ec2-7363-86a5-e43f65fff4bc, and approval assessment, "
            "audited 2026-07-16."
        ),
    },
    "019f6d0b-96ae-77c3-9851-9b05708a6305": {
        "timestamp": "2026-07-16T22:28:24.006Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated use of the configured user Python "
            "environment for the full site test suite; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact unittest discovery command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and 102-test pass, audited 2026-07-16."
        ),
    },
    "019f6d11-0ffd-7b92-a8fc-be5a6a2eadff": {
        "timestamp": "2026-07-16T22:34:22.785Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the Dockerized production-baseurl "
            "Jekyll build with image conversion disabled; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose Jekyll command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and successful rendered build, audited "
            "2026-07-16."
        ),
    },
    "019f6d14-b745-7353-b61f-c4b716347d8d": {
        "timestamp": "2026-07-16T22:38:22.285Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the required pre-publish retained-log "
            "ledger refresh; the review lane did not change the declared interactive development "
            "default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact pending-commit audit write command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and successful refresh, "
            "audited 2026-07-16."
        ),
    },
    "019f6d36-54ff-7612-bf76-e978e153a37d": {
        "timestamp": "2026-07-16T23:15:05.382Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the Dockerized production-baseurl Jekyll "
            "verification build for checkpoint-three story pages and compiled Sass; the review lane "
            "did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose Jekyll command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, and allow assessment, audited 2026-07-16."
        ),
    },
    "019f6d3e-86cc-7391-a831-3922ab08d480": {
        "timestamp": "2026-07-16T23:24:02.817Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the incremental root-site Docker build "
            "used to refresh checkpoint-three pages for responsive QA; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact incremental docker compose Jekyll command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and allow assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6d42-ecca-7c92-962c-dbaf3388f239": {
        "timestamp": "2026-07-16T23:28:50.809Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the full root-site Docker build used to "
            "refresh checkpoint-three pages for browser QA; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact docker compose Jekyll command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and successful build "
            "result, audited 2026-07-16."
        ),
    },
    "019f6d47-0e25-7701-b27b-cea82e2a0709": {
        "timestamp": "2026-07-16T23:33:21.589Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the focused checkpoint-three Playwright "
            "matrix against a local production-baseurl build; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact external-server Playwright command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and harness-only "
            "base-path failure, audited 2026-07-16."
        ),
    },
    "019f6d49-58dd-7c23-8a77-b6e2ad81baa5": {
        "timestamp": "2026-07-16T23:35:51.851Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated starting a localhost-only static server "
            "and probing the Paper Constellation route to diagnose the checkpoint-three harness; "
            "the review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact hidden localhost server and curl probe, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and HTTP 200 "
            "result, audited 2026-07-16."
        ),
    },
    "019f6d4a-6eab-7463-bcd2-ccfd4a383330": {
        "timestamp": "2026-07-16T23:37:02.714Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated a localhost-served desktop Playwright "
            "slice for the three checkpoint-three stories; the review lane did not change the "
            "declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact temporary-server desktop Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and "
            "sandbox-only external-asset failure, audited 2026-07-16."
        ),
    },
    "019f6d4b-4715-7082-af2d-a3a41b380309": {
        "timestamp": "2026-07-16T23:37:58.111Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the network-enabled desktop Playwright "
            "retry needed to distinguish sandbox-only asset failures from page regressions; the "
            "review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact temporary-server desktop Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and "
            "three-pass result, audited 2026-07-16."
        ),
    },
    "019f6d4c-29c2-7f33-b6a2-42a6561e0559": {
        "timestamp": "2026-07-16T23:38:56.070Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated the complete network-enabled "
            "checkpoint-three responsive Playwright matrix served from localhost; the review lane "
            "did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact temporary-server full Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and allow assessment, audited "
            "2026-07-16."
        ),
    },
    "019f6d57-9d11-7062-8d03-cbe2ef47b513": {
        "timestamp": "2026-07-16T23:51:26.682Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated removal of one path-verified Build Rhythm "
            "capture after its SHA-256 was recorded; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact hash-and-Remove-Item command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, bare allow decision, and successful exact-file "
            "removal result, audited 2026-07-16."
        ),
    },
    "019f6d5b-2d47-7490-9750-1efd37849d7f": {
        "timestamp": "2026-07-16T23:55:20.025Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated path-verified removal of the generated "
            "_site_codex build directory after checkpoint-three verification; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact guarded _site_codex Remove-Item command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow assessment, and "
            "successful cleanup result, audited 2026-07-16."
        ),
    },
    "019f6d5c-567b-7283-b026-b3016ccdeb28": {
        "timestamp": "2026-07-16T23:56:36.159Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a scoped restore of "
            "content-equal-to-HEAD paths before the checkpoint-three rebase; the review lane did "
            "not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact ten-path git restore command, reviewed "
            "session 019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and subsequent scoped "
            "status, audited 2026-07-16."
        ),
    },
    "019f6d5c-cf07-74c0-8aeb-1f1ba4ff42b2": {
        "timestamp": "2026-07-16T23:57:06.770Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed explicit staging of the "
            "verified checkpoint-three paths for safe integration; the review lane did not change "
            "the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact path-scoped git add command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and staged status, audited "
            "2026-07-16."
        ),
    },
    "019f6d5c-fab4-7e71-bb37-aaa6e1a0be8c": {
        "timestamp": "2026-07-16T23:57:17.969Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed rebasing the staged "
            "checkpoint over the inspected anonymous-tracker refresh using autostash; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact autostash rebase command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and subsequent rebased checkpoint "
            "workflow, audited 2026-07-16."
        ),
    },
    "019f6d5e-d9a5-7371-b0a5-db0bb6f524b5": {
        "timestamp": "2026-07-16T23:59:20.735Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the Dockerized Jekyll "
            "verification build for checkpoint three; the review lane did not change the declared "
            "interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Docker Jekyll command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and successful rendered build, "
            "audited 2026-07-16."
        ),
    },
    "019f6d61-6024-74d1-8d9f-cfaa376aedc2": {
        "timestamp": "2026-07-17T00:02:06.437Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed a read-only Docker status "
            "check while the checkpoint-three Jekyll build was running; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Docker status commands, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and running-container result, "
            "audited 2026-07-16."
        ),
    },
    "019f6d61-ee3d-7f80-a18b-6b85a085fc3b": {
        "timestamp": "2026-07-17T00:02:42.460Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the targeted three-route "
            "responsive Playwright verification against a temporary localhost server; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact localhost-server and Playwright command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow decision, server cleanup, "
            "and passing responsive-matrix report, audited 2026-07-16."
        ),
    },
    "019f6d68-8f06-7841-b54a-e1e3257a7fe5": {
        "timestamp": "2026-07-17T00:09:56.958Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed workspace-bounded cleanup of "
            "a rejected privacy-sensitive historical capture and generated Playwright report; the "
            "review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact resolved-path-guarded Remove-Item command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and subsequent "
            "clean artifact status, audited 2026-07-16."
        ),
    },
    "019f6d69-a13c-70a2-b309-780689683648": {
        "timestamp": "2026-07-17T00:11:07.625Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed explicit restaging of the "
            "verified checkpoint-three files before ledger accounting; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact path-scoped git add command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and staged status, audited "
            "2026-07-16."
        ),
    },
    "019f6d6a-2ce8-7c10-beb4-a6f09bfce8dc": {
        "timestamp": "2026-07-17T00:11:45.505Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the required pending-commit "
            "usage-ledger refresh, which reads retained local evidence and writes aggregate in-repo "
            "counters; the review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Python ledger-audit command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, allow decision, and resulting retained-log "
            "deviation inventory, audited 2026-07-16."
        ),
    },
    "019f6d6e-ee03-7e93-80ad-ba5307ff669b": {
        "timestamp": "2026-07-17T00:16:54.675Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the final regenerated "
            "Python-cache cleanup after completed canonical validation and browser QA; it did not "
            "perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Remove-Item request, reviewed session "
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6d7a-1581-7bb1-bad5-60edadcaf402": {
        "timestamp": "2026-07-17T00:29:05.571Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed explicit restaging of the "
            "checkpoint-three text files after formatting normalization; the review lane did not "
            "change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact path-scoped git add command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, low-risk allow decision, and staged status, "
            "audited 2026-07-16."
        ),
    },
    "019f6d94-a390-7221-9a2a-b78bf84c9f72": {
        "timestamp": "2026-07-17T00:58:06.053Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the pre-push fetch and "
            "ancestry inspection used to detect a new anonymous tracker commit; the review lane "
            "did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git fetch and read-only ancestry command, "
            "reviewed session 019f652f-7154-7822-ad1c-daa5a066134b, and low-risk allow decision, "
            "audited 2026-07-16."
        ),
    },
    "019f6d95-05d1-7713-b52f-026eb3499130": {
        "timestamp": "2026-07-17T00:58:30.856Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed replaying the single "
            "verified checkpoint-three commit over the newly fetched anonymous tracker refresh; "
            "the review lane did not change the declared interactive development default."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git rebase command, reviewed session "
            "019f652f-7154-7822-ad1c-daa5a066134b, medium-risk allow decision, and successful "
            "one-commit rebase result, audited 2026-07-16."
        ),
    },
    "019f6d97-5a2a-7940-afb8-b4451f93fdf5": {
        "timestamp": "2026-07-17T01:01:04.343Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed removal of a regenerated "
            "Python cache after a successful canonical export and validation in the separate "
            "semantic-scaffolding-map workspace; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact Remove-Item request, reviewed session "
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited 2026-07-16."
        ),
    },
    "019f6d98-6d9e-7353-8f12-5c4b1bce502d": {
        "timestamp": "2026-07-17T01:02:15.161Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed creation of a temporary "
            "detached worktree for a fresh-checkout canonical-pipeline proof in the separate "
            "semantic-scaffolding-map workspace; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git worktree add command for commit "
            "1832ec76, reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, "
            "audited 2026-07-16."
        ),
    },
    "019f6d98-ef1d-7500-bd60-6022ac88b67b": {
        "timestamp": "2026-07-17T01:02:47.201Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the read-only canonical "
            "validator in that temporary fresh worktree; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact validate-canonical-pipeline command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6d99-a101-7aa0-be84-e96fad887897": {
        "timestamp": "2026-07-17T01:03:32.692Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed the read-only clean-status "
            "and resolved-path check before removing that temporary proof worktree; it did not "
            "perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git status and Resolve-Path command, "
            "reviewed session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited "
            "2026-07-16."
        ),
    },
    "019f6d99-d18f-7c40-bb21-20766db501c7": {
        "timestamp": "2026-07-17T01:03:45.119Z",
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            "Provider-managed Codex auto-review evaluated and allowed removal of the verified "
            "clean temporary portability-proof worktree; it did not perform site development."
        ),
        "provenance": (
            "Retained auto-review turn_context, exact git worktree remove command, reviewed "
            "session 019f62bf-ce97-79c2-a6a9-21a59c04b3ad, and allow decision, audited 2026-07-16."
        ),
    },
}


def _checkpoint_four_auto_review_acknowledgment(
    timestamp: str,
    reviewed_session: str,
    reason_action: str,
    provenance_action: str,
) -> dict[str, str]:
    """Build one exact checkpoint-four provider-review acknowledgment."""

    return {
        "timestamp": timestamp,
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            f"Provider-managed Codex auto-review evaluated and allowed {reason_action}; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            f"Retained auto-review turn_context, exact {provenance_action}, reviewed session "
            f"{reviewed_session}, and allow decision, audited 2026-07-16."
        ),
    }


MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6da5-a128-74b0-b83e-100b4039a088": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:16:44.129Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "creation of the temporary detached exact-commit IKEA capture worktree",
            "git worktree add command for commit 15d94c048",
        ),
        "019f6da5-f9dd-7c32-a7a2-95c1dfd55f18": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:17:02.200Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the first Dockerized exact-commit IKEA historical build",
            "Docker Compose historical Jekyll build with an empty base URL",
        ),
        "019f6da6-9b17-78c2-8bb7-6e5a6372180b": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:17:43.374Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the corrected exact-commit IKEA historical build retry",
            "Docker Compose historical Jekyll build retry using the commit's own configuration",
        ),
        "019f6daa-7fc9-7b92-869d-256018d9c3f3": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:21:58.284Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "a read-only status check for the timed-out historical-build container",
            "docker compose -p ikea-capture-first ps -a command",
        ),
        "019f6daa-a98e-7f21-84d0-e91b12cbaff9": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:09.035Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "shutdown of the temporary historical-replay Compose project after the bounded build failed",
            "docker compose -p ikea-capture-first down --remove-orphans command",
        ),
        "019f6daa-ce23-7570-a441-5aa1e260baa8": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:18.364Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the read-only check that the temporary historical-replay container had stopped",
            "repeated Docker Compose status command",
        ),
        "019f6daa-f2cc-7db0-8480-6d059d648ea3": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:27.729Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "stopping the still-running one-off historical-build container",
            "docker compose -p ikea-capture-first stop command",
        ),
        "019f6dab-1544-7183-920d-b722792252ed": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:36.623Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the read-only confirmation that the one-off historical-build container was stopped",
            "post-stop Docker Compose status command",
        ),
        "019f6dab-3f28-7a71-8ac9-eee60a7e9ee4": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:47.354Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "force-removal of the single named temporary Docker build container left by the timeout",
            "one-container docker rm -f command",
        ),
        "019f6dab-655c-7b63-bc35-3c588a2beeba": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:22:57.367Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "removal of the now-unused temporary historical-replay Docker network",
            "final Docker Compose down command",
        ),
        "019f6dad-71c6-7110-a4a8-e21dcdbd5b30": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:25:11.385Z",
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad",
            "the one-shot read-only READY-05 runtime-attestation canary in semantic-scaffolding-map",
            "codex exec gpt-5.6-sol/max read-only runtime-attestation canary command",
        ),
        "019f6dad-a6ff-7b22-b476-ea80afa56658": {
            "timestamp": "2026-07-17T01:25:25.818Z",
            "model": "gpt-5.6-sol",
            "effort": "max",
            "acknowledged_at": "2026-07-16",
            "reason": (
                "One-shot read-only READY-05 runtime-attestation canary used explicitly requested "
                "maximum effort in the separate semantic-scaffolding-map repository, returned only "
                "the required canary string, and performed no site development or substantive research."
            ),
            "provenance": (
                "Retained turn_context, exact runtime-attestation prompt and response, completed leaf "
                "session 019f6dad-9fe6-7de0-8778-c5eecf005a2a, audited 2026-07-16."
            ),
        },
        "019f6db0-9f8a-7ec2-9d4d-cb69cb75bb05": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:28:39.613Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "removal of the verified temporary detached IKEA capture worktree after the replay attempt",
            "git worktree remove --force command",
        ),
        "019f6db0-c734-71b1-8241-ebb30d463cba": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:28:49.777Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the final read-only confirmation that temporary IKEA capture resources were gone",
            "Test-Path, git worktree list, and filtered docker ps command",
        ),
        "019f6db3-bd37-7ba0-bde8-731c1770971b": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:32:08.916Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "a configured one-request Crossref metadata canary in semantic-scaffolding-map",
            "run-metadata-canary command with one bounded HTTPS request",
        ),
        "019f6db9-573b-71f2-bbc1-13c77e0948ce": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:38:16.029Z",
            "019f6da4-7fbc-7c33-a592-d71d430822c2",
            "removal of two explicitly named path-guarded temporary SQLite artifacts in semantic-scaffolding-map",
            "canonical-storage-bounded Remove-Item command",
        ),
        "019f6dba-4d15-7cb1-a611-c246f07852cc": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:39:14.393Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the Dockerized checkpoint-four rendered-page verification build",
            "Docker Jekyll fast-build command",
        ),
        "019f6dc2-a9ac-7b61-bc43-eebd57212f9d": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:48:22.087Z",
            "019f6da4-7fbc-7c33-a592-d71d430822c2",
            "path-bounded removal of regenerated SQLite temporary files in semantic-scaffolding-map",
            "guarded two-file Remove-Item command",
        ),
        "019f6dc4-1887-78d1-8ded-9faa68c4de70": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:49:55.831Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "the focused MetadataCanaryTests run in semantic-scaffolding-map",
            "python unittest MetadataCanaryTests command",
        ),
        "019f6dc4-c2ca-7d71-bc96-48452e63c76b": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:50:39.540Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "the official-track review of the cached C&C metadata canary",
            "review-metadata-canary command with reviewer, timestamp, track, and evidence URL",
        ),
        "019f6dc5-2a81-7063-b155-5ec711714fa6": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:51:05.929Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "a read-only rendering of the metadata canary summary",
            "Python metadata_canary_summary command",
        ),
        "019f6dc5-856b-75e3-807f-a970980a6e75": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:51:29.293Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the Dockerized fast Jekyll build used for checkpoint-four rendered QA",
            "Docker Compose fast Jekyll build command",
        ),
        "019f6dc6-fb62-7811-bed6-89f2ea186125": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:53:05.155Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "resolved-workspace-guarded removal of the semantic-scaffolding-map tools bytecode cache",
            "Resolve-Path, StartsWith, and Remove-Item command",
        ),
        "019f6dc7-e17b-72b1-9c62-3b8feabac4cf": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T01:54:04.074Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the hidden local server and focused Playwright matrix for all ten fun-project stories",
            "port-4114 Start-Process, Playwright, and guaranteed-stop command",
        ),
        "019f6dd0-eba6-7f22-b128-af3bfc02a84a": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:03:56.584Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the hidden local server and focused IKEA and Dogtor Playwright repair run",
            "port-4115 Start-Process, Playwright, and guaranteed-stop command",
        ),
        "019f6dd1-98d3-7d72-95b6-870d2e2df137": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:04:40.673Z",
            "019f6da4-7fbc-7c33-a592-d71d430822c2",
            "path-bounded cleanup of regenerated canonical-storage SQLite temporary files",
            "guarded temporary-SQLite Remove-Item command",
        ),
        "019f6dd4-6a5c-7741-ac80-cd54cfdc8de2": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:07:45.300Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "rebasing checkpoint-four work onto the inspected origin/main with autostash",
            "git rebase with autostash and status command",
        ),
        "019f6dd4-f6e1-7c32-96cd-aa6b95dbbc47": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:08:21.536Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "starting a hidden loopback HTTP server for deployed-shape smoke verification",
            "Python http.server Start-Process command on port 4178",
        ),
        "019f6dd5-bcf7-74b3-9aad-670b05af18fd": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:09:11.989Z",
            "019f6da4-7fbc-7c33-a592-d71d430822c2",
            "a third path-bounded cleanup of regenerated canonical-storage SQLite temporary files",
            "guarded temporary-SQLite Remove-Item command",
        ),
        "019f6dd7-6da7-7d91-a779-985f9cdc95e9": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:11:03.440Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "read-only inspection of the Gemfile and local al-folio Docker image identity",
            "Gemfile read and docker image inspect command",
        ),
        "019f6dd8-24b9-7bd2-bd84-a6d906c1714f": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:11:49.937Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "a Dockerized Jekyll build from a read-only repo bind into a unique temporary destination",
            "temporary-directory creation and two-bind docker run Jekyll command",
        ),
        "019f6dd7-db90-7211-9ad4-785ab6e457e7": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:11:52.089Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the full site Python unittest suite in the configured user environment",
            "python unittest discovery command",
        ),
        "019f6dd8-7e0d-7643-935b-000edf4afe3e": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:12:12.525Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the Dockerized fast Jekyll verification build after checkpoint-four integration",
            "Docker Compose fast Jekyll build command",
        ),
        "019f6dd8-7f1e-7732-bc18-6bd7a460a919": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:12:12.883Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "the no-disk-cache Dockerized Jekyll retry into the temporary QA destination",
            "read-only-repo and writable-temp bind docker run Jekyll command",
        ),
        "019f6dda-c552-7ff0-a910-5e712496c892": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:14:42.053Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "starting a hidden localhost-only static server for the temporary rendered QA site",
            "Python http.server Start-Process command",
        ),
        "019f6ddb-0536-7762-8003-e637b7bcdfb3": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:14:58.210Z",
            "019f6d31-a4ba-7df3-8b5c-a52e53dd7d90",
            "checking the localhost QA listener and rendered IKEA route",
            "Get-NetTCPConnection and curl command",
        ),
        "019f6dea-0a81-7002-9858-6fd81fe22fd1": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:31:22.636Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "removal of the verified repo-local generated Playwright report after an exact-path guard",
            "Resolve-Path and Remove-Item command",
        ),
        "019f6dea-7005-7933-b628-569122dbbaf2": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:31:48.759Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "stopping the specific localhost QA server process",
            "Stop-Process command for PID 25280",
        ),
        "019f6dea-e2d8-75b2-aef3-d3791f7db31c": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:32:18.538Z",
            "019f6da4-7fbc-7c33-a592-d71d430822c2",
            "removal of the exact resolved Python bytecode cache in semantic-scaffolding-map",
            "Resolve-Path guard and Remove-Item command",
        ),
        "019f6deb-4d5a-7f20-81e3-440ae59c8c0d": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:32:45.418Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the full Python test suite after final audit-driven corrections",
            "unittest-discovery command",
        ),
        "019f6deb-9d22-74a2-9522-e62a6e42eaea": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:33:05.754Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a bounded Docker Jekyll fast render for final accessibility verification",
            "Docker Compose Jekyll fast-build command",
        ),
        "019f6dee-ddfb-7e50-ab70-e3f8df55b118": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:36:39.091Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "starting the final hidden localhost-only QA server on a checked-free port",
            "port-4179 check and Python http.server Start-Process command",
        ),
        "019f6df0-5d51-7651-8f8c-a52ae5da0d77": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:38:16.974Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "six focused public-route Playwright cases against localhost with outbound asset access",
            "desktop-1440 and mobile-390 Playwright command with route grep",
        ),
        "019f6df1-955a-7371-818c-62eb66d3da48": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:39:37.108Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "focused desktop-Chromium and mobile-WebKit project-card interaction checks",
            "Playwright interaction-test command with three-case grep",
        ),
        "019f6df6-45b7-79a0-a432-45460669cc8d": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:44:44.460Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "stopping the first QA server and creating a temporary repo-local prefixed-site junction",
            "Stop-Process and New-Item junction command",
        ),
        "019f6df6-8fa7-74f2-aaa7-130693f44c88": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:45:03.114Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "starting the remounted hidden localhost-only QA server on port 4180",
            "Python http.server Start-Process command",
        ),
        "019f6df6-c662-7c42-a0a0-d7dc52abbf49": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:45:17.093Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "six focused project-card interaction cases against the correctly prefixed local build",
            "prefixed Playwright interaction-test command with three-case grep",
        ),
        "019f6df8-3916-7073-a31a-f53ccd4c5dbe": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:46:52.029Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "creation of the checked temporary root-relative asset junction required by the fast-build fixture",
            "Test-Path and New-Item junction command",
        ),
        "019f6df8-6a62-7260-b2a9-24fc48342300": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:47:04.894Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the focused project-card interaction trio after prefixed pages and assets became available",
            "prefixed Playwright interaction-test command with three-case grep",
        ),
        "019f6df9-6f50-7922-8f19-263d100e9e83": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:48:11.644Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "stopping the final localhost QA server after the interaction tests passed",
            "Stop-Process command for PID 28644",
        ),
        "019f6df9-f51e-7d51-bcc2-15fdbf3dc5a1": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:48:45.660Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "removal of the verified temporary repo-local junctions and empty mount root",
            "path and link-type guards plus Remove-Item command",
        ),
        "019f6dfc-5e0f-7b43-8382-d2814daf9906": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:51:23.950Z",
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad",
            "path-scoped staging and checkout of three semantic-scaffolding-map canary manifests for LF normalization",
            "three-path git add and git checkout-index command",
        ),
        "019f6e01-eba1-77f3-9ba2-46b47a8bcf4c": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T02:57:28.061Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "removal of the semantic-scaffolding-map tools Python bytecode cache",
            "Remove-Item command",
        ),
        "019f6e04-eda3-7102-8b59-216a89c76d6b": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:00:45.060Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "refreshing origin/main and inspecting branch divergence before the final ledger audit",
            "git fetch, status, and log command",
        ),
        "019f6e05-348c-7f63-b0ec-f1ce1980c261": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:01:02.792Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the required pending-commit agentic-ledger refresh before staging checkpoint four",
            "scoped PYTHONPATH and Miniconda ledger-audit command",
        ),
    }
)

MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6e0f-212c-70c2-8ceb-4b6607f3481c": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:11:53.757Z",
            "019f6da4-4359-7d60-83a8-a3ae9e1bd333",
            "workspace-bounded removal of Python bytecode caches in semantic-scaffolding-map",
            "existence-guarded tools and tests __pycache__ Remove-Item command",
        ),
        "019f6e10-f63b-7ab1-b94b-1d7656e05a9b": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:13:53.311Z",
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad",
            "the fresh nonce-bound read-only READY-05 runtime-attestation canary in semantic-scaffolding-map",
            "nonce-generating read-only gpt-5.6-sol/max Codex canary command",
        ),
        "019f6e11-1bd4-7033-8d18-58b03fafff3b": {
            "timestamp": "2026-07-17T03:14:04.346Z",
            "model": "gpt-5.6-sol",
            "effort": "max",
            "acknowledged_at": "2026-07-16",
            "reason": (
                "One-shot read-only READY-05 runtime-attestation canary used explicitly requested "
                "maximum effort in the separate semantic-scaffolding-map repository, returned only "
                "the nonce-bound canary string, and performed no site development, tool use, or "
                "substantive research."
            ),
            "provenance": (
                "Retained turn_context, exact nonce-bound runtime-attestation prompt and matching "
                "response, completed leaf session 019f6e11-1390-7a03-b9de-c01f1faafeff, audited "
                "2026-07-16."
            ),
        },
    }
)

MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6e1c-f573-7a50-8462-598ff5921474": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:27:04.583Z",
            "019f6e10-9c08-7b21-9859-e0baf08a73d1",
            "the deterministic event-ledger split in semantic-scaffolding-map, moving retained build and snapshot rows to the generated ledger while preserving operational canary events",
            "apply_patch limited to map/data/pipeline_build_events.jsonl and map/data/pipeline_events.jsonl",
        ),
        "019f6e1e-dc0a-73b3-a55f-952ff1b03749": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:29:04.171Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "an index refresh for four named Prettier-normalized files with unchanged content",
            "four-path git add followed by read-only status and staged-name checks",
        ),
        "019f6e1f-0b4f-7b20-b91c-36b8eb56cccc": _checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:29:16.433Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the scoped checkpoint-four rebase over one inspected anonymous tracker refresh",
            "git rebase with autostash followed by a read-only branch-status check",
        ),
    }
)

MODEL_DEVIATION_ACKNOWLEDGMENTS[
    "019f6e24-79fa-7951-a8c9-fc6d1a6aac64"
] = _checkpoint_four_auto_review_acknowledgment(
    "2026-07-17T03:35:17.160Z",
    "019f6d27-749c-7fa3-bfb7-bee6cd5c7ced",
    "removal of one exact generated canonical_batch bytecode file in semantic-scaffolding-map",
    "Remove-Item command limited to tools/__pycache__/canonical_batch.cpython-312.pyc",
)

MODEL_DEVIATION_ACKNOWLEDGMENTS[
    "019f6e2b-4052-70c1-ac45-8173d77c1e9e"
] = _checkpoint_four_auto_review_acknowledgment(
    "2026-07-17T03:42:36.565Z",
    "019f652f-7154-7822-ad1c-daa5a066134b",
    "the explicit checkpoint-four staging and staged-diff integrity review",
    "named-path git add followed by branch status, staged stat, and staged diff checks",
)

del _checkpoint_four_auto_review_acknowledgment


def _post_checkpoint_four_auto_review_acknowledgment(
    timestamp: str,
    reviewed_session: str,
    reason_action: str,
    provenance_action: str,
) -> dict[str, str]:
    """Build one exact post-checkpoint-four provider-review acknowledgment."""

    return {
        "timestamp": timestamp,
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-16",
        "reason": (
            f"Provider-managed Codex auto-review evaluated and allowed {reason_action}; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            f"Retained auto-review turn_context, exact {provenance_action}, reviewed session "
            f"{reviewed_session}, and allow decision, audited 2026-07-16."
        ),
    }


MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6e36-5727-7652-b74f-5f704c25d5a4": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:54:43.299Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the initial read-only GitHub Actions run-list status query for checkpoint commit 2070991b0",
            "Invoke-RestMethod actions/runs query filtered to head SHA 2070991b0d2046694e1179968a57173f02dd16f8",
        ),
        "019f6e37-dfff-78d1-bf2b-14bcf95d4aea": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:56:23.826Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a repeated read-only GitHub Actions run-list status query for exact checkpoint SHA 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting id, name, status, conclusion, and updated_at",
        ),
        "019f6e38-b8ad-7c91-85a8-ad7c75581ae5": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:57:19.269Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a repeated read-only GitHub Actions run-list status query for exact checkpoint SHA 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting id, name, status, conclusion, and updated_at",
        ),
        "019f6e39-006f-77d1-848c-80ca56176ec1": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:57:42.306Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "the raw read-only GitHub Actions run-list request for exact checkpoint SHA 2070991b0",
            "curl request to the public actions/runs endpoint filtered to the exact checkpoint SHA",
        ),
        "019f6e39-59e6-7d40-a19f-c34c80191e78": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:58:00.253Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "the full-metadata read-only GitHub Actions run-list poll for checkpoint commit 2070991b0",
            "Invoke-RestMethod actions/runs query selecting event, timestamps, and workflow URLs",
        ),
        "019f6e39-e2ab-7d92-91f7-773d7b422b40": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:58:35.766Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a repeated read-only GitHub Actions run-list status query for exact checkpoint SHA 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting id, name, status, conclusion, and updated_at",
        ),
        "019f6e3a-02c0-7292-8eb6-656c8542396e": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:58:43.499Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated compact read-only GitHub Actions status poll for checkpoint commit 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting compact status fields",
        ),
        "019f6e3a-f32b-7731-9702-9d9d00a17624": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T03:59:45.437Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated compact read-only GitHub Actions status poll for checkpoint commit 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting compact status fields",
        ),
        "019f6e3b-35ac-7df0-9519-71fc2059ae2e": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:00:02.111Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only GitHub Actions query filtered to remaining nonterminal checkpoint runs",
            "Invoke-RestMethod actions/runs query with status and conclusion filtering",
        ),
        "019f6e3b-f22b-7d71-b35d-4afd8213bf76": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:00:50.318Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e3c-dd0e-7fa2-b52a-44388c0d90e6": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:01:50.865Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e3d-aeff-7343-9eb8-c9ef49663757": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:02:44.549Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e3d-bae8-7f63-92e7-4b35d6521173": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:02:47.223Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the cache-busted read-only deployment smoke check for the homepage, project index, and Build Rhythm route",
            "Invoke-WebRequest checks for checkpoint usage labels and storytelling markers on three public routes",
        ),
        "019f6e3e-b132-71b0-be95-97a47f66af1d": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:03:50.314Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e3f-9961-7aa2-8b82-ede898dc6e93": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:04:49.741Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e40-2f29-7941-808a-362d9605e932": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:05:28.394Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only deployed marker smoke test across all ten fun-project routes",
            "cache-busted Invoke-WebRequest loop checking each public fun-project route and its expected story marker",
        ),
        "019f6e40-c904-7202-b4c0-543972150fa9": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:06:07.507Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e40-f6ad-78c2-8f3f-e5072169c1d5": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:06:19.231Z",
            "019f62bf-ce97-79c2-a6a9-21a59c04b3ad",
            "workspace-bounded removal of the tools and tests Python bytecode caches in semantic-scaffolding-map",
            "resolved-root and StartsWith-guarded Remove-Item command for tools/__pycache__ and tests/__pycache__",
        ),
        "019f6e41-e3a9-77a2-a2bb-8dd52a7f9d2f": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:07:20.490Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e43-0795-7202-a08a-e18d79451a60": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:08:35.026Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e43-e28d-7fc1-8337-d97592cf9b59": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:09:30.640Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only deployed HTML contract checks for project-card fields, mobile constellation structure, and Dogtor privacy",
            "cache-busted requests to projects, publications, and Dogtor pages with structural counts and private-fragment absence checks",
        ),
        "019f6e44-334a-7d62-b6f1-fc07dedb732f": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:09:51.248Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e45-4468-7570-8fef-a1295d68da4f": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:11:01.218Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e46-7fbc-7601-9054-663826efea12": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:12:22.418Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e47-b46e-77a0-bd98-a8bda2c2a1d7": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:13:41.165Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e48-caf0-7451-934a-2b2e83819e8e": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:14:52.983Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e49-457c-7030-8d21-c7aea43e7e9c": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:15:23.621Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only GitHub Actions job-detail inspection for visual job 87800802047",
            "Invoke-RestMethod actions/jobs/87800802047 query for current step and elapsed-state fields",
        ),
        "019f6e4a-12ad-7bd0-bc42-2376d9e11f75": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:16:16.482Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e4b-2d8f-7030-b5a8-bb48c227801b": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:17:28.969Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e4b-5696-73a0-a71f-828c02572ba4": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:17:44.037Z",
            "019f6e49-9e2c-7790-94a8-53dcefe8e5cf",
            "download of prior visual-checkpoint artifact 8364713474 into the temporary directory for trace inspection",
            "curl download to the exact temporary visual-checkpoint-artifacts-8364713474.zip path using the issued short-lived artifact URL",
        ),
        "019f6e4c-5475-7793-a72f-eb96d140a0f1": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:18:44.492Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e4d-33d1-7000-b9ab-5a9c7812876c": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:19:41.561Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only GitHub Actions job-detail inspection for visual job 87800802047",
            "Invoke-RestMethod actions/jobs/87800802047 query for current step and elapsed-state fields",
        ),
        "019f6e4d-6a96-74d1-ace5-23bfbd9d9828": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:19:55.315Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e4e-8145-7cc0-8b1b-c36bd0b6632c": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:21:06.761Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e52-9316-79a1-8f10-bbee1dfe763e": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:25:33.780Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "a repeated read-only status poll for final visual workflow run 29553496287",
            "Invoke-RestMethod actions/runs/29553496287 query selecting status, conclusion, timestamp, and URL fields",
        ),
        "019f6e52-e4b1-7c12-bab5-44d26ff0bf2d": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T04:25:54.533Z",
            "019f6e36-b098-7ab2-bf6a-f5a7fc65a0ed",
            "the final read-only GitHub Actions run-list query recording terminal evidence for checkpoint commit 2070991b0",
            "sorted Invoke-RestMethod actions/runs query selecting terminal status, timestamps, and workflow URLs",
        ),
    }
)

MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6e76-fc20-7610-9dad-1d9575c02124": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:05:24.456Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a read-only inventory of relevant Windows Scheduled Tasks to identify installed usage-refresh automation",
            "filtered Get-ScheduledTask inventory command",
        ),
        "019f6e77-4fe6-7e03-8549-adf3fe7667ee": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:05:40.874Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "read-only inspection of the direct-account task schedule, action, principal, settings, and latest result",
            "Get-ScheduledTask and Get-ScheduledTaskInfo command for Dylan Codex Direct Account Usage",
        ),
        "019f6e77-bbcc-7302-ab73-5714950f29cc": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:06:08.519Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "read-only inspection of the protected tracker file inventory and configuration shape without credential or account values",
            "protected tracker Get-ChildItem and config-property-type command",
        ),
        "019f6e78-2e72-7061-9536-889f19632c46": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:06:37.877Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a key-only view of tracker configuration structure to map collection and publication targets without account values",
            "tracker config Shape function and key-only JSON projection command",
        ),
        "019f6e78-64d2-7f00-9c6f-277d4af18f91": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:06:51.851Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a read-only runtime-source search for publication targets, cadence, and exit-code behavior",
            "scoped rg command over the installed tracker runtime",
        ),
        "019f6e78-9d3a-7341-b06b-0e96d9d6f449": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:07:06.244Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a read-only view of non-identity tracker paths and cadence values to determine its publication flow",
            "sanitized tracker path and timing JSON projection command",
        ),
        "019f6e78-d4eb-7832-b613-4351986648d4": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:07:24.654Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a read-only scan of scheduled-task action strings for tracker, website, profile, and GitHub publishers",
            "filtered Get-ScheduledTask action-string scan",
        ),
        "019f6e7d-0da5-7501-9443-aaafe70ee46a": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:12:02.260Z",
            "019f6e7c-1481-7cc1-b2a1-ba5bdb45be78",
            "read-only inspection of matching Windows task definitions and latest results to diagnose stale token refresh",
            "filtered Get-ScheduledTask plus Get-ScheduledTaskInfo diagnostic command",
        ),
        "019f6e7e-d3a0-7fd0-89fc-b12ac5f67216": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:13:53.704Z",
            "019f6e7c-1481-7cc1-b2a1-ba5bdb45be78",
            "a read-only inventory of protected direct-account tracker files to verify its collection mechanism",
            "protected tracker Get-ChildItem file-list command",
        ),
        "019f6e7f-3ea0-7320-80e4-45d31563269c": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:14:20.766Z",
            "019f6e7c-1481-7cc1-b2a1-ba5bdb45be78",
            "a redacted read-only diagnostic of tracker configuration, runtime matches, public projection, attempt health, and publication state",
            "sanitized tracker config, runtime, state, and public-projection inspection command",
        ),
        "019f6e81-10a9-70e2-911b-a3e6c67abc86": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:16:22.057Z",
            "019f6e7c-1481-7cc1-b2a1-ba5bdb45be78",
            "a read-only installed-schema search for account/usage/read and lifetimeTokens support",
            "scoped rg command over tracker and installed Codex schemas",
        ),
        "019f6e81-5298-74b2-8c01-9852aabac068": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:16:36.968Z",
            "019f6e7c-1481-7cc1-b2a1-ba5bdb45be78",
            "read-only inspection of generated account/usage/read request and response schemas to confirm parameters and lifetimeTokens type",
            "exact GetAccountTokenUsageResponse and ClientRequest schema read command",
        ),
        "019f6e9c-6481-76a3-951c-c86ee4709d8c": _post_checkpoint_four_auto_review_acknowledgment(
            "2026-07-17T05:46:11.106Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "restoration of only two generated tracker files whose line endings were normalized during a Prettier check, preserving the intentional blog edit",
            "two-path git restore followed by a read-only status command",
        ),
    }
)

del _post_checkpoint_four_auto_review_acknowledgment


def _usage_checkpoint_auto_review_acknowledgment(
    timestamp: str,
    reviewed_session: str,
    reason_action: str,
    provenance_action: str,
) -> dict[str, str]:
    """Build one exact usage-checkpoint provider-review acknowledgment."""

    return {
        "timestamp": timestamp,
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-17",
        "reason": (
            f"Provider-managed Codex auto-review evaluated and allowed {reason_action}; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            f"Retained auto-review turn_context, exact {provenance_action}, reviewed session "
            f"{reviewed_session}, and allow decision, audited 2026-07-17."
        ),
    }


MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6ec5-6af5-7523-b406-82d37c95a2dd": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:30:59.731Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the initial read-only public GitHub Actions run-list query for writing checkpoint commit 9e05b3dd4",
            "Invoke-RestMethod actions/runs query filtered to head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc and selecting workflow ids, names, status, conclusion, timestamps, and URLs",
        ),
        "019f6ec6-001e-7250-8f85-c3322869c64c": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:31:38.055Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a compact JSON repeat of the public GitHub Actions run-list query for writing checkpoint commit 9e05b3dd4",
            "Invoke-RestMethod actions/runs query filtered to head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc and selecting id, name, status, conclusion, and updated_at fields",
        ),
        "019f6ec6-a940-7790-9fd5-f41ffdca03de": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:32:21.132Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "another compact JSON status poll for the writing checkpoint workflows",
            "repeated Invoke-RestMethod actions/runs query for exact head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc with id, name, status, conclusion, and updated_at projection",
        ),
        "019f6ec6-e1d2-73c3-ba92-21f1c6779c27": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:32:35.610Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the first cache-busted deployed blog and homepage marker smoke for the writing checkpoint",
            "Invoke-WebRequest checks for the Wobbrock map, repeatable loop, Scott E. Hudson credit, and 6.65B plus 471 homepage labels",
        ),
        "019f6ec7-25ee-79f0-9ec3-7d315f14f740": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:32:53.036Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the corrected cache-busted deployed blog and homepage marker smoke for the writing checkpoint",
            "corrected Invoke-WebRequest checks using the homepage variable for the Wobbrock map, repeatable loop, Scott E. Hudson credit, and 6.65B plus 471 labels",
        ),
        "019f6ec7-5f2f-7533-a84e-51752a6922f8": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:33:07.696Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a cache-busted deployment-propagation recheck of the public blog and homepage",
            "Invoke-WebRequest status, content-length, Wobbrock and repeatable-text counts, and 6.64B versus 6.65B homepage marker checks",
        ),
        "019f6ec8-08a8-7dc2-9e17-365b58c3a448": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:33:51.079Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "another compact JSON GitHub Actions status poll for writing checkpoint commit 9e05b3dd4",
            "Invoke-RestMethod actions/runs query for exact head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc with id, name, status, conclusion, and updated_at projection",
        ),
        "019f6ec9-daf5-7152-8650-47deb5765af2": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:35:50.452Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a later compact JSON GitHub Actions status poll for writing checkpoint commit 9e05b3dd4",
            "later Invoke-RestMethod actions/runs query for exact head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc with id, name, status, conclusion, and updated_at projection",
        ),
        "019f6eca-552e-7733-8735-edc91c3d1ce8": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:36:21.780Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the final cache-busted deployed blog and homepage content-marker recheck",
            "Invoke-WebRequest checks for Keep Wobbrock, My repeatable writing loop, Scott E. Hudson, and the 6.65B plus 471 homepage labels",
        ),
        "019f6eca-e3de-7fb2-b689-6deeb8669784": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:37:03.245Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a targeted status query for the Dylan Codex Direct Account Usage and Dylan Metrics Refresh scheduled-task names",
            "Get-ScheduledTask and Get-ScheduledTaskInfo projection of state, latest result, next run, trigger count, and action executable for both exact task names",
        ),
        "019f6eca-fabc-7112-b494-2662e584e050": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:37:04.126Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a further compact JSON GitHub Actions status poll for the writing checkpoint",
            "Invoke-RestMethod actions/runs query for exact head SHA 9e05b3dd442e1d9aeb0417f4f324ebe1e355bbfc with id, name, status, conclusion, and updated_at projection",
        ),
        "019f6ecb-3995-7891-ba24-46bddb3617f0": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:37:20.242Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "the corrected JSON-form status query for the Dylan Codex Direct Account Usage and Dylan Metrics Refresh task names",
            "Get-ScheduledTask and Get-ScheduledTaskInfo JSON array of state, latest result, next run, trigger count, and action executable for both exact task names",
        ),
        "019f6ecb-8923-7012-869e-9c183609d250": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:37:40.923Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a broader read-only inventory of scheduled tasks whose names matched Dylan, Codex, Metric, Profile, or Usage",
            "filtered Get-ScheduledTask inventory with path, state, latest result, next run, and action-executable fields",
        ),
        "019f6ecc-2e82-7080-82fa-6d75f718035a": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:38:22.939Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the read-only Visual checkpoints workflow status query for writing checkpoint commit 9e05b3dd4",
            "Invoke-RestMethod actions/runs query filtered to the Visual checkpoints workflow with id, status, conclusion, updated_at, and URL fields",
        ),
        "019f6ecc-6534-7453-98ca-a049c3a75608": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:38:36.946Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a sanitized read-only diagnostic of the protected direct-usage tracker configuration, attempt health, runtime manifest, and last-valid projection",
            "protected tracker PowerShell projection limited to task-safe schema, count, path-match, and health metadata",
        ),
        "019f6ecd-3c49-7dd3-afea-8597274a9bd9": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:39:32.016Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a two-isolated-home Codex app-server diagnostic using the installed direct-usage collector",
            "Python _poll_account_via_app_server probe emitting account ordinals, response shapes, identity distinctness, and sanitized failure categories",
        ),
        "019f6ecd-9946-7253-a8c1-360d401c5acf": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:39:55.800Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a generated-schema search for the account/usage/read method",
            "Select-String account/usage/read search with bounded context across configured Codex schema files",
        ),
        "019f6ecd-d85e-7e40-8d9e-b828d2572c1f": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:40:11.976Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a generated-schema search for lifetimeTokens and AccountUsage response types",
            "Select-String lifetimeTokens or AccountUsage search with bounded context across configured Codex schema files",
        ),
        "019f6ece-0fc5-70c0-94c7-2a03ab842cd8": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:40:26.135Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a bounded exact slice of the generated account-usage protocol schema",
            "lines 12566 through 12700 of codex_app_server_protocol.v2.schemas.json selected after resolving the configured schema directory",
        ),
        "019f6ece-801d-7823-8f5e-a893e2a1d40f": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:40:55.110Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a two-home account/usage/read diagnostic using temporary in-memory method allowlists",
            "Python account/usage/read probe emitting only validation booleans, response field names, identity distinctness, and sanitized failures",
        ),
        "019f6ecf-1286-7441-a23a-1f37b82eb3df": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:41:32.405Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a follow-up two-home usage-read diagnostic that classified remote protocol errors safely",
            "Python account/usage/read probe with SafeRemoteError sanitization and no identity, secret, or raw usage output",
        ),
        "019f6ed0-56aa-7ce0-938c-0194a891d008": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:42:55.399Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a read-only publisher-task, state-file, and latest-30-log-line diagnostic",
            "Dylan Personal Metrics Refresh task metadata, protected state projection, and refresh.log tail of 30 lines",
        ),
        "019f6ed1-31a1-7290-b6b5-b1a41f04067d": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:43:51.632Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a narrower publisher-state and latest-20-log-line failure diagnostic",
            "protected DylanPersonalMetricsRefresh state projection and refresh.log tail of 20 lines",
        ),
        "019f6ed1-bc0c-7f13-b388-7d17d628b3aa": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:44:26.832Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a top-level file inventory of the protected personal-metrics publisher runtime",
            "Get-ChildItem over DylanPersonalMetricsRefresh selecting name, length, and last-write time",
        ),
        "019f6ed1-fd5a-7592-870d-9029b5d735a8": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:44:43.558Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a sanitized publisher-state and log-file metadata projection",
            "protected publisher state fields plus log filenames, lengths, and last-write times without log content",
        ),
        "019f6ed2-417c-7d93-ba80-fd204fe2995c": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:45:01.002Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a read-only inspection of the final 24 personal-metrics refresh log lines",
            "ReadAllLines on protected refresh.log followed by an exact 24-line tail",
        ),
        "019f6ed2-8494-7653-a8e5-cab170cd3333": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:45:18.164Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a function-name inventory of the installed personal-metrics PowerShell module",
            "ReadAllLines over DylanMetricsRefresh.psm1 selecting only function declarations and total line count",
        ),
        "019f6ed2-b5b0-7622-b665-5c6e20c1033d": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:45:30.759Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a bounded inspection of the installed publisher module's importer failure path",
            "lines 551 through 660 of the protected DylanMetricsRefresh.psm1 module",
        ),
        "019f6ed2-fe3a-7c73-86ef-1dc07df5422e": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:45:49.306Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a read-only schedule and execution-settings projection for Dylan Personal Metrics Refresh",
            "Get-ScheduledTask trigger intervals, duration, instance policy, execution limit, restart settings, and network condition",
        ),
        "019f6ed4-39d4-7c73-9c5c-b4c15f9200c5": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:47:10.861Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a filename-only inventory of generated schemas whose names matched Usage or Token",
            "Get-ChildItem over the configured schema directory filtered to Usage or Token filenames",
        ),
        "019f6ed4-f4ee-7d01-b37f-19c82404c9d1": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:47:58.028Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a SHA-256 drift comparison between three installed direct-usage runtime files and their Codex-LB source copies",
            "Get-FileHash comparisons for direct_account_usage.py, direct_account_usage_runner.py, and Invoke-DirectAccountUsageTracker.ps1",
        ),
        "019f6ed5-441a-79e2-94f2-c2440465fe74": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:48:18.275Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a normalized equality comparison of the installed publisher module against local main and origin/main source",
            "DylanMetricsRefresh.psm1 installed-versus-local and installed-versus-origin boolean comparison",
        ),
        "019f6ed5-9b4b-7ba3-9fcb-ae79c41d0a42": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:48:45.636Z",
            "019f6ec8-7e75-7713-9bc5-021a2bf9c15a",
            "the three-file direct-lifetime schema-v3 wording patch for the ledger docs, skill, and audit helper",
            "apply_patch replacing quota-health wording with the anonymous rounded combined-lifetime contract in docs/agentic-usage-ledger.md, .codex/skills/agentic-usage-ledger/SKILL.md, and bin/audit_agentic_usage.py",
        ),
        "019f6ed5-eb9f-7343-9c13-12744a65a608": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:49:01.280Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a bounded inspection of the installed publisher module's scheduling logic",
            "lines 284 through 317 of the protected DylanMetricsRefresh.psm1 module",
        ),
        "019f6ed6-b517-7c62-bf68-e9c3d7433923": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:49:52.993Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "a ten-repeat deployed desktop Playwright reproduction of reciprocal Human and AI research-link focus",
            "NO_WEBSERVER public.config.js desktop-1440 test filtered to Human focus and AI research keep reciprocal format context with repeat-each 10",
        ),
        "019f6ed8-73fb-7820-ad3d-6a601bf54d0c": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:51:47.213Z",
            "019f6ec8-e248-7110-a674-448a432d1005",
            "a read-only trigger, execution-setting, principal, and latest-result projection for Dylan Codex Direct Account Usage",
            "Get-ScheduledTask and Get-ScheduledTaskInfo diagnostic covering trigger intervals, instance policy, limits, principal, and latest result",
        ),
        "019f6edb-ea18-75e0-b92d-370966c6d40d": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T06:55:34.513Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the GitHub connector request to rerun only failed jobs for visual workflow run 29560193398",
            "github.rerun_failed_workflow_run_jobs call for DylanTao/dylantao.github.io run 29560193398",
        ),
        "019f6eea-c7b2-78f0-901b-eb2a47a3d85f": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T07:11:48.581Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the repository's full Python unit-test discovery run",
            "python -m unittest discover -s test -p test_*.py command",
        ),
        "019f6ef0-81f2-7950-90d4-898782853b00": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T07:18:03.846Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "guarded removal of the generated playwright-report directory inside the site workspace",
            "resolved-root containment check, recursive Remove-Item of playwright-report, and follow-up git status command",
        ),
        "019f6ef1-e61b-7d53-983a-bad9ba5a709f": _usage_checkpoint_auto_review_acknowledgment(
            "2026-07-17T07:19:35.181Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "the pending-commit write audit for the current website usage checkpoint",
            "python bin/audit_agentic_usage.py --write --include-pending-commit command",
        ),
    }
)

del _usage_checkpoint_auto_review_acknowledgment


def _policy_tail_auto_review_acknowledgment(
    timestamp: str,
    reviewed_session: str,
    reason_action: str,
    provenance_action: str,
) -> dict[str, str]:
    """Build one exact tail-closure provider-review acknowledgment."""

    return {
        "timestamp": timestamp,
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-17",
        "reason": (
            f"Provider-managed Codex auto-review evaluated and allowed {reason_action}; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            f"Retained auto-review turn_context, exact {provenance_action}, reviewed session "
            f"{reviewed_session}, and allow decision, audited 2026-07-17."
        ),
    }


MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6eff-464d-7743-8451-3b4a8d047425": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:34:16.336Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "a same-value no-op patch probe on the isolated coastal-theme worktree's global background token",
            "apply_patch replacing #fffefd with the identical #fffefd value in D:/dev/dylantao-coastal-theme/_sass/_themes.scss",
        ),
        "019f6f01-c5f8-7b82-aab4-cd502670c4f2": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:36:55.177Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the four-phase pastel-orange coastal token rewrite in the isolated theme worktree",
            "apply_patch updating global backgrounds, text, primary colors, surfaces, outlines, shadows, mint and sky accents, nav glass, footer, and evening tokens in D:/dev/dylantao-coastal-theme/_sass/_themes.scss",
        ),
        "019f6f02-3cc4-7b71-a774-7ea7c58485ad": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:37:25.867Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the navbar migration to the new phase-aware navigation background token in the isolated theme worktree",
            "apply_patch replacing hard-coded light and evening navbar backgrounds with --global-nav-bg-color in D:/dev/dylantao-coastal-theme/_sass/_navbar.scss",
        ),
        "019f6f02-9e4e-73c3-b0ef-6219dbf01fba": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:37:50.789Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the material-lite elevation and focus-ring migration to global shadow and primary tokens in the isolated theme worktree",
            "apply_patch updating --md-lite elevation, focus-color, focus-ring, and focus-shadow variables in D:/dev/dylantao-coastal-theme/_sass/_material-lite.scss",
        ),
        "019f6f02-e1d0-71d0-98d3-f63bd90702cd": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:38:07.828Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the shared component shadow migration to the global shadow token in the isolated theme worktree",
            "apply_patch replacing three hard-coded component shadow colors with --global-shadow-color in D:/dev/dylantao-coastal-theme/_sass/_components.scss",
        ),
        "019f6f03-6e08-7c72-8839-ad7ad1436d32": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:38:43.739Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the publication-surface shadow migration to the phase-aware global shadow RGB token in the isolated theme worktree",
            "apply_patch replacing publication shadow RGB literals with rgba(var(--global-shadow-rgb), alpha) in D:/dev/dylantao-coastal-theme/_sass/_publications.scss",
        ),
        "019f6f04-172d-7030-9a2a-e7652c1f54e3": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:39:27.050Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the homepage paper, card, and general shadow migration to phase-aware surface and shadow tokens in the isolated theme worktree",
            "apply_patch updating home paper color-mixes and shadow declarations in D:/dev/dylantao-coastal-theme/_sass/_home.scss while retaining material-specific scene colors",
        ),
        "019f6f04-16e7-7eb1-ba5f-b49b2891d77c": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:39:31.943Z",
            "019f6ef6-2f10-7c42-a7bd-477d779c8088",
            "the direct installed-WindowsApps Python probe used to locate a PyYAML-capable interpreter for the required ledger audit",
            "PowerShell invocation of the exact PythonSoftwareFoundation.Python.3.12 WindowsApps python.exe path with a sys.executable and yaml.__version__ import probe",
        ),
        "019f6f04-f2ff-75b1-b8cd-8d55049ef030": _policy_tail_auto_review_acknowledgment(
            "2026-07-17T07:40:23.340Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the fruit-specific orange and leaf palette lift across all four phases in the isolated theme worktree",
            "apply_patch updating highlight, rind, deep-orange, outline, pore, and leaf tokens in D:/dev/dylantao-coastal-theme/_sass/_brand-orange.scss",
        ),
    }
)

del _policy_tail_auto_review_acknowledgment


def _final_tail_auto_review_acknowledgment(
    timestamp: str,
    reviewed_session: str,
    reason_action: str,
    provenance_action: str,
) -> dict[str, str]:
    """Build one exact final-tail provider-review acknowledgment."""

    return {
        "timestamp": timestamp,
        "model": "codex-auto-review",
        "effort": "low",
        "acknowledged_at": "2026-07-17",
        "reason": (
            f"Provider-managed Codex auto-review evaluated and allowed {reason_action}; the review "
            "lane did not change the declared interactive development default."
        ),
        "provenance": (
            f"Retained auto-review turn_context, exact {provenance_action}, reviewed session "
            f"{reviewed_session}, and allow decision, audited 2026-07-17."
        ),
    }


MODEL_DEVIATION_ACKNOWLEDGMENTS.update(
    {
        "019f6efa-35ec-7a93-a9e8-d8e06003d84f": _final_tail_auto_review_acknowledgment(
            "2026-07-17T07:28:39.823Z",
            "019f652f-7154-7822-ad1c-daa5a066134b",
            "creation of the isolated coastal-theme branch worktree from origin/main",
            "git worktree add -b codex/coastal-theme D:/dev/dylantao-coastal-theme origin/main command",
        ),
        "019f6efd-29ae-75b0-8ba0-1e3097e867b4": {
            "timestamp": "2026-07-17T07:31:55.274Z",
            "model": "gpt-5.6-sol",
            "effort": "max",
            "acknowledged_at": "2026-07-17",
            "reason": (
                "Explicit no-tools semantic-scaffolding-map runtime-attestation canary requested "
                "max effort and an exact all-zero nonce response; it did not perform site development."
            ),
            "provenance": (
                "Retained leaf session 019f6efd-1ca1-70c3-877f-ea7febcd5f6a, exact prompt "
                "requesting runtime-attestation-canary:00000000000000000000000000000000, matching "
                "one-line response, and turn_context, audited 2026-07-17."
            ),
        },
        "019f6efd-9cb1-7b93-9411-d815d528a14b": {
            "timestamp": "2026-07-17T07:32:24.039Z",
            "model": "gpt-5.6-sol",
            "effort": "max",
            "acknowledged_at": "2026-07-17",
            "reason": (
                "Explicit no-tools semantic-scaffolding-map runtime-attestation canary requested "
                "max effort and an exact nonce-bound response; it did not perform site development."
            ),
            "provenance": (
                "Retained leaf session 019f6efd-9304-7bd2-91a1-7f1c129f9fe2, exact prompt "
                "requesting runtime-attestation-canary:b8da737f6860218cf2977c5f8147577b, matching "
                "one-line response, and turn_context, audited 2026-07-17."
            ),
        },
        "019f6f05-aaee-7df1-a766-1c014a00ee60": _final_tail_auto_review_acknowledgment(
            "2026-07-17T07:41:10.673Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the JavaScript fallback-color alignment with the coastal theme in the isolated worktree",
            "apply_patch updating fallback accents, mint, sky, text, grid, surfaces, and research-motion colors in D:/dev/dylantao-coastal-theme/assets/js/github-activity.js and assets/js/research-motion.js",
        ),
        "019f6f06-3c3c-7763-bcd2-214e3c756711": _final_tail_auto_review_acknowledgment(
            "2026-07-17T07:41:47.587Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the What Happened and Why page's migration from rust literals to global theme roles in the isolated worktree",
            "apply_patch replacing trace accents, borders, shadows, focus echoes, and evening selectors with global theme tokens in D:/dev/dylantao-coastal-theme/_projects/what-happened-and-why.md",
        ),
        "019f6f06-de17-7523-9f0f-64f853d060be": _final_tail_auto_review_acknowledgment(
            "2026-07-17T07:42:29.001Z",
            "019f6efa-b036-7cd2-8338-84bf041e7185",
            "the four-phase project-card palette rebalance in the isolated coastal-theme worktree",
            "apply_patch updating morning, noon, afternoon, and evening card colors in D:/dev/dylantao-coastal-theme/_data/project_cards.yml",
        ),
    }
)

del _final_tail_auto_review_acknowledgment


WH_PER_TOKEN_MIDPOINT = 0.0006
WH_PER_TOKEN_LOW = 0.0002
WH_PER_TOKEN_HIGH = 0.002
KG_CO2E_PER_KWH = 0.373
TREE_YEAR_METRIC_TONS_CO2E = 0.060
CUT_TREE_CO2E_KG = 600
TOKEN_USAGE_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
)
PUBLIC_CHECK_FIELDS = (
    ("commits",),
    ("token_count",),
    ("tokens_label",),
    ("hours_count",),
    ("hours_label",),
    ("energy_equivalence", "kwh_midpoint"),
    ("energy_equivalence", "kg_co2e_midpoint"),
    ("energy_equivalence", "tree_years_midpoint"),
    ("energy_equivalence", "tree_years_range"),
    ("energy_equivalence", "cut_tree_midpoint"),
    ("energy_equivalence", "cut_tree_range"),
    ("energy_equivalence", "public_note"),
    ("api_cost_equivalence", "usd_midpoint"),
    ("api_cost_equivalence", "usd_label"),
    ("api_cost_equivalence", "public_note"),
    ("legacy_api_cost_equivalence", "usd_midpoint"),
    ("legacy_api_cost_equivalence", "usd_label"),
    ("codexbar_cost_estimate", "token_count"),
    ("codexbar_cost_estimate", "usd_midpoint"),
    ("codexbar_cost_estimate", "usd_label"),
    ("codexbar_cost_estimate", "public_note"),
)
TOTAL_ONLY_PUBLIC_CHECK_FIELDS = (("token_rhythm",),)
MODEL_TRACKING_CHECK_FIELDS = (
    ("intended_model",),
    ("intended_effort",),
    ("cutover_at",),
    ("acknowledgment_policy_version",),
    ("status",),
    ("post_cutover_deviation_count",),
    ("post_cutover_acknowledged_deviation_count",),
    ("post_cutover_unacknowledged_deviation_count",),
    ("post_cutover_deviations",),
    ("public_note",),
)
LOCAL_LIFETIME_CHECK_FIELDS = (
    ("sessions",),
    ("token_count",),
    ("tokens_label",),
    ("api_cost_equivalence", "usd_midpoint"),
    ("api_cost_equivalence", "usd_label"),
    ("api_cost_equivalence", "unpriced_token_usage", "total_tokens"),
)
METRICS_BOT_EMAILS = frozenset({"metrics-bot@users.noreply.github.com"})

PRICE_SOURCE_URL = "https://developers.openai.com/api/docs/pricing"
MODEL_PRICE_AS_OF = "2026-07-12"
LONG_CONTEXT_THRESHOLD_INPUT_TOKENS = 272_000
MODEL_STANDARD_RATES: dict[str, dict[str, float | None]] = {
    "gpt-5.5": {
        "input_usd_per_million": 5.00,
        "cached_input_usd_per_million": 0.50,
        "output_usd_per_million": 30.00,
        "cache_write_input_usd_per_million": None,
        "long_context_input_usd_per_million": 10.00,
        "long_context_cached_input_usd_per_million": 1.00,
        "long_context_output_usd_per_million": 45.00,
        "long_context_cache_write_input_usd_per_million": None,
    },
    "gpt-5.6-sol": {
        "input_usd_per_million": 5.00,
        "cached_input_usd_per_million": 0.50,
        "output_usd_per_million": 30.00,
        "cache_write_input_usd_per_million": 6.25,
        "long_context_input_usd_per_million": 10.00,
        "long_context_cached_input_usd_per_million": 1.00,
        "long_context_output_usd_per_million": 45.00,
        "long_context_cache_write_input_usd_per_million": 12.50,
    },
}
API_COST_CAVEAT = (
    "API list-price replay from logged request tokens; cache writes and actual Codex billing are not included."
)
LEGACY_PRICE_MODEL = "gpt-5.3-codex"
LEGACY_PRICE_AS_OF = "2026-06-19"
LEGACY_INPUT_USD_PER_MILLION = 1.75
LEGACY_CACHED_INPUT_USD_PER_MILLION = 0.175
LEGACY_OUTPUT_USD_PER_MILLION = 14.00
LEGACY_API_COST_CAVEAT = (
    "Legacy gpt-5.3-codex API list-price lens retained for continuity; "
    "it is not the logged-model estimate or an actual Codex bill."
)
CODEXBAR_COST_SOURCE = "CodexBar local dashboard screenshot"
CODEXBAR_COST_SOURCE_AS_OF = "2026-06-19"
CODEXBAR_REFERENCE_USD = 2616.40
CODEXBAR_REFERENCE_TOKENS = 3_000_000_000
CODEXBAR_COST_CAVEAT = "Historical diagnostic only; Win-CodexBar 0.42 overcounts forked and replayed local history."
LEDGER_HEADER = """# Estimated Codex/agentic work ledger for the customized Sirui/Dylan site.
# Update this with docs/agentic-usage-ledger.md after substantial site work.
"""


def empty_usage() -> dict[str, int]:
    return {field_name: 0 for field_name in TOKEN_USAGE_FIELDS}


def normalized_usage(value: Any) -> dict[str, int]:
    mapping = value if isinstance(value, dict) else {}
    result: dict[str, int] = {}
    for field_name in TOKEN_USAGE_FIELDS:
        try:
            result[field_name] = max(0, int(mapping.get(field_name) or 0))
        except (TypeError, ValueError):
            result[field_name] = 0
    return result


def usage_signature(usage: dict[str, int]) -> tuple[int, ...]:
    return tuple(usage.get(field_name, 0) for field_name in TOKEN_USAGE_FIELDS)


def add_usage(target: dict[str, int], addition: dict[str, int]) -> None:
    for field_name in TOKEN_USAGE_FIELDS:
        target[field_name] = target.get(field_name, 0) + addition.get(field_name, 0)


def positive_usage_delta(current: dict[str, int], previous: dict[str, int]) -> dict[str, int]:
    return {
        field_name: max(0, current.get(field_name, 0) - previous.get(field_name, 0))
        for field_name in TOKEN_USAGE_FIELDS
    }


@dataclass(frozen=True)
class TurnContextRecord:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str
    model: str
    effort: str
    path: Path
    ordinal: int


@dataclass(frozen=True)
class TokenEvent:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str | None
    model: str
    effort: str
    total_usage: dict[str, int]
    last_usage: dict[str, int] | None
    path: Path
    ordinal: int


@dataclass(frozen=True)
class CountedUsageEvent:
    timestamp: datetime
    leaf_session_id: str
    turn_id: str | None
    model: str
    effort: str
    usage: dict[str, int]
    total_usage: dict[str, int]
    source: str
    path: Path
    ordinal: int


@dataclass
class SessionRecord:
    session_id: str
    cwd: str
    started_at: datetime | None = None
    paths: set[Path] = field(default_factory=set)
    contexts: list[TurnContextRecord] = field(default_factory=list)
    token_events: list[TokenEvent] = field(default_factory=list)
    fork_preamble_events_skipped: int = 0


@dataclass
class UsageDataset:
    sessions: dict[str, SessionRecord]
    usage_events: list[CountedUsageEvent]
    contexts_by_turn: dict[str, TurnContextRecord]
    source_counts: dict[str, int]


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def timestamp_calendar_date(value: Any) -> date | None:
    """Return the Pacific calendar date represented by an account timestamp.

    Account activity timestamps are currently emitted in UTC while the daily
    buckets follow the account's Pacific calendar.  Keep this dependency-free
    for the Windows refresher by applying the post-2007 US daylight-saving
    rules directly instead of requiring the optional ``tzdata`` package.
    """

    if not isinstance(value, str) or not value:
        return None
    try:
        observed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    observed_utc = observed.astimezone(timezone.utc)
    year = observed_utc.year

    march_first = date(year, 3, 1)
    first_sunday_offset = (6 - march_first.weekday()) % 7
    second_sunday = march_first + timedelta(days=first_sunday_offset + 7)
    dst_start_utc = datetime.combine(
        second_sunday,
        datetime.min.time(),
        tzinfo=timezone.utc,
    ) + timedelta(hours=10)

    november_first = date(year, 11, 1)
    first_sunday = november_first + timedelta(days=(6 - november_first.weekday()) % 7)
    dst_end_utc = datetime.combine(
        first_sunday,
        datetime.min.time(),
        tzinfo=timezone.utc,
    ) + timedelta(hours=9)
    offset_hours = -7 if dst_start_utc <= observed_utc < dst_end_utc else -8
    return (observed_utc + timedelta(hours=offset_hours)).date()


def format_timestamp_utc(timestamp: datetime) -> str:
    timespec = "milliseconds" if timestamp.microsecond else "seconds"
    return timestamp.astimezone(timezone.utc).isoformat(timespec=timespec).replace("+00:00", "Z")


def sessions_root_from_args(value: str | None) -> Path:
    if value:
        return Path(value).expanduser()

    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "sessions"

    return Path.home() / ".codex" / "sessions"


def scan_sessions(root: Path, repo_needle: str | None) -> dict[str, SessionRecord]:
    """Read every retained year and keep the first session_meta as leaf identity."""

    sessions: dict[str, SessionRecord] = {}
    if not root.exists():
        return sessions

    for path in sorted(root.rglob("*.jsonl")):
        leaf_id: str | None = None
        leaf_cwd = ""
        leaf_started_at: datetime | None = None
        leaf_forked_from_id: str | None = None
        seen_turn_context = False
        fork_preamble_events_skipped = 0
        contexts: list[TurnContextRecord] = []
        token_events: list[TokenEvent] = []
        current_turn_id: str | None = None
        current_model = "unknown"
        current_effort = "unknown"

        try:
            with path.open("r", encoding="utf-8") as handle:
                for ordinal, line in enumerate(handle):
                    line = line.strip()
                    if not line:
                        continue
                    # JSONL response items can contain entire prompts and tool
                    # outputs. The top-level type appears near the beginning,
                    # so avoid decoding large irrelevant records.
                    prefix = line[:256]
                    # Most JSONL lines are messages or tool payloads and can be
                    # very large. Parse only the three record shapes used by
                    # this audit; looking for the generic event_msg wrapper
                    # made the publish hook needlessly reparse every message.
                    if not any(
                        marker in prefix
                        for marker in (
                            '"type":"session_meta"',
                            '"type": "session_meta"',
                            '"type":"turn_context"',
                            '"type": "turn_context"',
                            '"type":"token_count"',
                            '"type": "token_count"',
                        )
                    ):
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    timestamp = parse_timestamp(event.get("timestamp"))
                    event_type = event.get("type")
                    payload = event.get("payload") or {}

                    if event_type == "session_meta" and leaf_id is None:
                        candidate_id = payload.get("id")
                        leaf_id = str(candidate_id) if candidate_id else str(path)
                        leaf_cwd = str(payload.get("cwd") or "")
                        leaf_started_at = timestamp
                        forked_from_id = payload.get("forked_from_id")
                        source = payload.get("source")
                        source_parent_id = None
                        if isinstance(source, dict):
                            subagent = source.get("subagent")
                            if isinstance(subagent, dict):
                                thread_spawn = subagent.get("thread_spawn")
                                if isinstance(thread_spawn, dict):
                                    source_parent_id = thread_spawn.get("parent_thread_id")
                        parent_id = forked_from_id or source_parent_id
                        leaf_forked_from_id = str(parent_id) if parent_id else None
                        continue

                    if leaf_id is None or timestamp is None:
                        continue

                    if event_type == "turn_context":
                        turn_id = str(payload.get("turn_id") or "").strip()
                        if not turn_id:
                            continue
                        current_turn_id = turn_id
                        current_model = str(payload.get("model") or "unknown")
                        current_effort = str(payload.get("effort") or "unknown")
                        seen_turn_context = True
                        contexts.append(
                            TurnContextRecord(
                                timestamp=timestamp,
                                leaf_session_id=leaf_id,
                                turn_id=turn_id,
                                model=current_model,
                                effort=current_effort,
                                path=path,
                                ordinal=ordinal,
                            )
                        )
                        continue

                    if event_type != "event_msg" or payload.get("type") != "token_count":
                        continue
                    info = payload.get("info") or {}
                    total_usage = normalized_usage(info.get("total_token_usage"))
                    if total_usage["total_tokens"] <= 0:
                        continue
                    # Some explicit forks replay cumulative parent token events
                    # immediately after leaf metadata but omit the copied parent
                    # turn_context. Those events are ancestry, not unknown child
                    # usage. The first leaf context marks the end of the replay.
                    if leaf_forked_from_id and not seen_turn_context:
                        fork_preamble_events_skipped += 1
                        continue
                    raw_last_usage = info.get("last_token_usage")
                    last_usage = normalized_usage(raw_last_usage) if isinstance(raw_last_usage, dict) else None
                    if last_usage is not None and last_usage["total_tokens"] <= 0:
                        last_usage = None
                    token_events.append(
                        TokenEvent(
                            timestamp=timestamp,
                            leaf_session_id=leaf_id,
                            turn_id=current_turn_id,
                            model=current_model,
                            effort=current_effort,
                            total_usage=total_usage,
                            last_usage=last_usage,
                            path=path,
                            ordinal=ordinal,
                        )
                    )
        except OSError as error:
            print(f"warning: could not read {path}: {error}", file=sys.stderr)
            continue

        if leaf_id is None or (repo_needle and repo_needle.lower() not in leaf_cwd.lower()):
            continue

        record = sessions.setdefault(leaf_id, SessionRecord(session_id=leaf_id, cwd=leaf_cwd))
        record.paths.add(path)
        if leaf_started_at and (record.started_at is None or leaf_started_at < record.started_at):
            record.started_at = leaf_started_at
        record.contexts.extend(contexts)
        record.token_events.extend(token_events)
        record.fork_preamble_events_skipped += fork_preamble_events_skipped

    return sessions


def sessions_matching_repo(sessions: dict[str, SessionRecord], repo_needle: str) -> dict[str, SessionRecord]:
    """Return retained leaf sessions whose first cwd names the requested repo."""

    needle = repo_needle.lower()
    return {
        session_id: record
        for session_id, record in sessions.items()
        if needle in record.cwd.lower()
    }


def earliest_contexts(sessions: dict[str, SessionRecord]) -> dict[str, TurnContextRecord]:
    contexts: dict[str, TurnContextRecord] = {}
    all_contexts = [context for record in sessions.values() for context in record.contexts]
    for context in sorted(all_contexts, key=lambda item: (item.timestamp, str(item.path), item.ordinal)):
        contexts.setdefault(context.turn_id, context)
    return contexts


def prepare_usage_dataset(sessions: dict[str, SessionRecord]) -> UsageDataset:
    """Deduplicate copied ancestry, then retain additive usage events."""

    candidates: list[CountedUsageEvent] = []
    for record in sessions.values():
        events_by_path: dict[Path, list[TokenEvent]] = defaultdict(list)
        for event in record.token_events:
            events_by_path[event.path].append(event)

        for path, path_events in events_by_path.items():
            previous = empty_usage()
            for event in sorted(path_events, key=lambda item: (item.timestamp, item.ordinal)):
                if event.last_usage is not None:
                    usage = event.last_usage
                    source = "last_token_usage"
                else:
                    usage = positive_usage_delta(event.total_usage, previous)
                    source = "legacy_cumulative_delta"
                previous = event.total_usage
                if usage["total_tokens"] <= 0:
                    continue
                candidates.append(
                    CountedUsageEvent(
                        timestamp=event.timestamp,
                        leaf_session_id=event.leaf_session_id,
                        turn_id=event.turn_id,
                        model=event.model,
                        effort=event.effort,
                        usage=usage,
                        total_usage=event.total_usage,
                        source=source,
                        path=path,
                        ordinal=event.ordinal,
                    )
                )

    seen_snapshots: set[tuple[str, tuple[int, ...]]] = set()
    usage_events: list[CountedUsageEvent] = []
    source_counts: dict[str, int] = defaultdict(int)
    source_counts["fork_preamble_events_skipped"] = sum(
        record.fork_preamble_events_skipped for record in sessions.values()
    )
    ordered = sorted(candidates, key=lambda item: (item.timestamp, str(item.path), item.ordinal))
    for event in ordered:
        # Modern fork copies share turn_id and the complete cumulative snapshot.
        # Legacy logs have no turn identity, so the full five-field snapshot is
        # the conservative fallback key. Exact independent collisions are
        # possible but much safer than summing copied cumulative ancestry.
        identity = event.turn_id or "__legacy_without_turn_id__"
        dedupe_key = (identity, usage_signature(event.total_usage))
        if dedupe_key in seen_snapshots:
            source_counts["copied_or_repeated_snapshots_skipped"] += 1
            continue
        seen_snapshots.add(dedupe_key)
        usage_events.append(event)
        source_counts[event.source] += 1

    return UsageDataset(
        sessions=sessions,
        usage_events=usage_events,
        contexts_by_turn=earliest_contexts(sessions),
        source_counts=dict(source_counts),
    )


def git_commit_count(repo_root: Path, since: str, paths: list[str]) -> int:
    command = ["git", "log", "--format=%ae", f"--since={since}", "HEAD", "--", *paths]
    result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")
    return sum(
        1
        for email in result.stdout.splitlines()
        if email.strip().casefold() not in METRICS_BOT_EMAILS
    )


def is_shallow_repository(repo_root: Path) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--is-shallow-repository"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "could not determine whether the repository is shallow")
    return result.stdout.strip().lower() == "true"


def require_complete_git_history(repo_root: Path) -> None:
    if is_shallow_repository(repo_root):
        raise RuntimeError(
            "Agentic usage audit requires complete git history; this checkout is shallow. "
            "Run `git fetch --unshallow origin` before checking or writing the ledger."
        )


def has_pending_changes(repo_root: Path, paths: list[str]) -> bool:
    diff_commands = [
        ["git", "diff", "--quiet", "--", *paths],
        ["git", "diff", "--cached", "--quiet", "--", *paths],
    ]
    for command in diff_commands:
        result = subprocess.run(command, cwd=repo_root, capture_output=True, text=True, check=False)
        if result.returncode == 1:
            return True
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(command)}")

    untracked_command = ["git", "ls-files", "--others", "--exclude-standard", "--", *paths]
    result = subprocess.run(untracked_command, cwd=repo_root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git command failed: {' '.join(untracked_command)}")
    return bool(result.stdout.strip())


def normalize_repo_path(path: str) -> str:
    normalized = path.replace("\\", "/").lstrip("./")
    return normalized.rstrip("/")


def path_matches_scope(path: str, scope: str) -> bool:
    normalized_path = normalize_repo_path(path)
    normalized_scope = normalize_repo_path(scope)
    return normalized_path == normalized_scope or normalized_path.startswith(f"{normalized_scope}/")


def paths_matching_scope(paths: list[str], scopes: list[str]) -> list[str]:
    return [
        path
        for path in paths
        if any(path_matches_scope(path, scope) or path_matches_scope(scope, path) for scope in scopes)
    ]


def rounded_token_count(raw_tokens: int) -> int:
    step = 10_000_000 if raw_tokens >= 100_000_000 else 1_000_000
    return int(((raw_tokens + step // 2) // step) * step)


def token_label(tokens: int) -> str:
    if tokens >= 1_000_000_000:
        decimals = 1 if tokens >= 10_000_000_000 else 2
        label = f"{tokens / 1_000_000_000:.{decimals}f}".rstrip("0").rstrip(".")
        return f"{label}B"
    if tokens >= 1_000_000:
        return f"{round(tokens / 1_000_000):.0f}M"
    if tokens >= 1_000:
        return f"{round(tokens / 1_000):.0f}K"
    return str(tokens)


def build_token_rhythm(
    dataset: UsageDataset,
    cutoff: datetime,
    *,
    updated_at: date | None = None,
) -> dict[str, Any] | None:
    """Build a privacy-safe cumulative daily series from deduplicated repo events."""

    scoped_events = [event for event in dataset.usage_events if event.timestamp >= cutoff]
    if not scoped_events:
        return None

    since_date = timestamp_calendar_date(format_timestamp_utc(cutoff))
    if since_date is None:  # pragma: no cover - ``cutoff`` is already a datetime.
        raise ValueError("Token-rhythm cutoff must resolve to a Pacific calendar date.")

    daily_tokens: dict[date, int] = defaultdict(int)
    for event in scoped_events:
        event_date = timestamp_calendar_date(format_timestamp_utc(event.timestamp))
        if event_date is None:  # pragma: no cover - counted events carry parsed datetimes.
            continue
        daily_tokens[event_date] += max(0, int(event.usage.get("total_tokens") or 0))

    if not daily_tokens:
        return None

    if updated_at is None:
        updated_at = timestamp_calendar_date(format_timestamp_utc(datetime.now(timezone.utc)))
    if updated_at is None:  # pragma: no cover - current UTC time always parses.
        raise ValueError("Token-rhythm update time must resolve to a Pacific calendar date.")

    final_date = max(updated_at, max(daily_tokens))
    points: list[dict[str, Any]] = []
    cumulative_tokens = 0
    current_date = since_date
    while current_date <= final_date:
        cumulative_tokens += daily_tokens.get(current_date, 0)
        rounded_tokens = rounded_token_count(cumulative_tokens)
        points.append(
            {
                "date": current_date.isoformat(),
                "token_count": rounded_tokens,
                "tokens_label": token_label(rounded_tokens),
            }
        )
        current_date += timedelta(days=1)

    return {
        "schema": 1,
        "label": TOKEN_RHYTHM_LABEL,
        "units": "estimated tokens",
        "grain": "day",
        "aggregation": "cumulative",
        "method": "deduplicated_repo_retained_logs",
        "since": since_date.isoformat(),
        "updated_at": final_date.isoformat(),
        "confidence": "estimate",
        "privacy_note": TOKEN_RHYTHM_PRIVACY_NOTE,
        "points": points,
    }


def compact_decimal(value: float, small_threshold: float = 0.3) -> float:
    if abs(value) < small_threshold:
        return round(value, 2)
    return round(value, 1)


def range_label(low: float, high: float, small_threshold: float = 0.3) -> str:
    low_value = compact_decimal(low, small_threshold)
    high_value = compact_decimal(high, small_threshold)
    return f"{low_value:g}-{high_value:g}"


def energy_equivalence(tokens: int) -> dict[str, Any]:
    kwh_midpoint = tokens * WH_PER_TOKEN_MIDPOINT / 1000
    kg_midpoint = kwh_midpoint * KG_CO2E_PER_KWH
    kg_low = tokens * WH_PER_TOKEN_LOW / 1000 * KG_CO2E_PER_KWH
    kg_high = tokens * WH_PER_TOKEN_HIGH / 1000 * KG_CO2E_PER_KWH

    return {
        "wh_per_token_midpoint": WH_PER_TOKEN_MIDPOINT,
        "wh_per_token_range": "0.0002-0.002",
        "kg_co2e_per_kwh": KG_CO2E_PER_KWH,
        "tree_year_metric_tons_co2e": TREE_YEAR_METRIC_TONS_CO2E,
        "kwh_midpoint": round(kwh_midpoint),
        "kg_co2e_midpoint": round(kg_midpoint),
        "tree_years_midpoint": round(kg_midpoint / 60, 1),
        "tree_years_range": range_label(kg_low / 60, kg_high / 60, small_threshold=0),
        "cut_tree_co2e_kg": CUT_TREE_CO2E_KG,
        "cut_tree_midpoint": compact_decimal(kg_midpoint / CUT_TREE_CO2E_KG),
        "cut_tree_range": range_label(kg_low / CUT_TREE_CO2E_KG, kg_high / CUT_TREE_CO2E_KG),
    }


def rounded_money(value: float) -> int:
    if value >= 1000:
        step = 100
    elif value >= 50:
        step = 10
    elif value >= 10:
        step = 5
    else:
        step = 1
    return int(round(value / step) * step)


def money_amount_label(value: float) -> str:
    rounded = rounded_money(value)
    if rounded >= 1000:
        return f"~${rounded / 1000:.1f}K"
    return f"~${rounded}"


def money_label(value: float) -> str:
    return f"{money_amount_label(value)} API-rate replay"


def money_range_label(low: float, high: float) -> str:
    low_label = money_amount_label(low).removeprefix("~")
    high_label = money_amount_label(high).removeprefix("~")
    return f"{low_label}-{high_label}"


def codexbar_cost_estimate(token_count: int) -> dict[str, Any]:
    usd_per_million = CODEXBAR_REFERENCE_USD / (CODEXBAR_REFERENCE_TOKENS / 1_000_000)
    usd_midpoint = token_count * usd_per_million / 1_000_000
    usd_label = money_amount_label(usd_midpoint)
    return {
        "label": "Legacy CodexBar ratio",
        "source": CODEXBAR_COST_SOURCE,
        "source_as_of": CODEXBAR_COST_SOURCE_AS_OF,
        "source_note": "$2,616.40 / 3B tokens from the local CodexBar dashboard screenshot.",
        "reference_usd": CODEXBAR_REFERENCE_USD,
        "reference_tokens": CODEXBAR_REFERENCE_TOKENS,
        "usd_per_million_tokens": round(usd_per_million, 3),
        "token_count": token_count,
        "usd_midpoint": rounded_money(usd_midpoint),
        "usd_label": usd_label,
        "caveat": CODEXBAR_COST_CAVEAT,
        "public_note": f"Legacy CodexBar ratio: {usd_label} (diagnostic only).",
    }


def api_cost_equivalence(scoped_events: Iterable[CountedUsageEvent]) -> dict[str, Any]:
    """Replay logged requests against current Standard short/long-context rates."""

    usd_estimate = 0.0
    priced_usage = empty_usage()
    unpriced_usage = empty_usage()
    price_breakdown: dict[str, dict[str, Any]] = {}
    long_context_usage = empty_usage()
    long_context_request_count = 0
    long_context_usd_estimate = 0.0

    for event in scoped_events:
        usage = normalized_usage(event.usage)
        model = str(event.model or "unknown")
        effort = str(event.effort or "unknown")
        key = model_effort_key(model, effort)
        rates = MODEL_STANDARD_RATES.get(model)
        if rates is None:
            add_usage(unpriced_usage, usage)
            continue

        uncached_input = max(0, usage["input_tokens"] - usage["cached_input_tokens"])
        is_long_context = usage["input_tokens"] > LONG_CONTEXT_THRESHOLD_INPUT_TOKENS
        prefix = "long_context_" if is_long_context else ""
        bucket_cost = (
            uncached_input * float(rates[f"{prefix}input_usd_per_million"] or 0)
            + usage["cached_input_tokens"] * float(rates[f"{prefix}cached_input_usd_per_million"] or 0)
            + usage["output_tokens"] * float(rates[f"{prefix}output_usd_per_million"] or 0)
        ) / 1_000_000
        usd_estimate += bucket_cost
        add_usage(priced_usage, usage)
        bucket = price_breakdown.setdefault(
            key,
            {
                "model": model,
                "effort": effort,
                "token_usage": empty_usage(),
                "uncached_input_tokens": 0,
                "request_count": 0,
                "long_context_request_count": 0,
                "long_context_token_usage": empty_usage(),
                "usd_estimate": 0.0,
            },
        )
        add_usage(bucket["token_usage"], usage)
        bucket["uncached_input_tokens"] += uncached_input
        bucket["request_count"] += 1
        bucket["usd_estimate"] += bucket_cost
        if is_long_context:
            long_context_request_count += 1
            long_context_usd_estimate += bucket_cost
            add_usage(long_context_usage, usage)
            bucket["long_context_request_count"] += 1
            add_usage(bucket["long_context_token_usage"], usage)

    for bucket in price_breakdown.values():
        bucket["usd_estimate"] = round(bucket["usd_estimate"], 2)

    usd_label = money_label(usd_estimate)
    return {
        "label": "Logged-model API cost lens",
        "pricing_tier": "Standard, request-aware",
        "pricing_as_of": MODEL_PRICE_AS_OF,
        "source_url": PRICE_SOURCE_URL,
        "model_rates": copy.deepcopy(MODEL_STANDARD_RATES),
        "long_context_threshold_input_tokens": LONG_CONTEXT_THRESHOLD_INPUT_TOKENS,
        "long_context_request_count": long_context_request_count,
        "long_context_token_usage": long_context_usage,
        "long_context_usd_estimate": round(long_context_usd_estimate, 2),
        "cache_write_tokens": None,
        "cache_write_note": (
            "Retained logs do not identify cache-write tokens, so cache-write rates are not applied."
        ),
        "priced_token_usage": priced_usage,
        "unpriced_token_usage": unpriced_usage,
        "model_effort_price_breakdown": price_breakdown,
        "usd_estimate": round(usd_estimate, 2),
        "usd_midpoint": rounded_money(usd_estimate),
        "usd_label": usd_label,
        "caveat": API_COST_CAVEAT,
        "public_note": f"{usd_label}. {API_COST_CAVEAT}",
    }


def legacy_api_cost_equivalence(token_usage: dict[str, int]) -> dict[str, Any]:
    input_tokens = token_usage.get("input_tokens", 0)
    cached_input_tokens = token_usage.get("cached_input_tokens", 0)
    output_tokens = token_usage.get("output_tokens", 0)
    uncached_input_tokens = max(0, input_tokens - cached_input_tokens)
    usd_estimate = (
        uncached_input_tokens * LEGACY_INPUT_USD_PER_MILLION
        + cached_input_tokens * LEGACY_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_cached_usd = (
        input_tokens * LEGACY_CACHED_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000
    all_uncached_usd = (
        input_tokens * LEGACY_INPUT_USD_PER_MILLION
        + output_tokens * LEGACY_OUTPUT_USD_PER_MILLION
    ) / 1_000_000

    return {
        "label": "Legacy Codex API cost lens",
        "model": LEGACY_PRICE_MODEL,
        "pricing_as_of": LEGACY_PRICE_AS_OF,
        "source_url": PRICE_SOURCE_URL,
        "input_usd_per_million": LEGACY_INPUT_USD_PER_MILLION,
        "cached_input_usd_per_million": LEGACY_CACHED_INPUT_USD_PER_MILLION,
        "output_usd_per_million": LEGACY_OUTPUT_USD_PER_MILLION,
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "uncached_input_tokens": uncached_input_tokens,
        "output_tokens": output_tokens,
        "reasoning_output_tokens": token_usage.get("reasoning_output_tokens", 0),
        "total_tokens": token_usage.get("total_tokens", 0),
        "usd_estimate": round(usd_estimate, 2),
        "usd_midpoint": rounded_money(usd_estimate),
        "usd_label": money_label(usd_estimate),
        "usd_range_label": money_range_label(all_cached_usd, all_uncached_usd),
        "caveat": LEGACY_API_COST_CAVEAT,
        "public_note": f"{money_label(usd_estimate)}. {LEGACY_API_COST_CAVEAT}",
    }


def model_effort_key(model: str, effort: str) -> str:
    return f"{model or 'unknown'}/{effort or 'unknown'}"


def active_hours_after_cutoff(
    dataset: UsageDataset,
    cutoff: datetime,
    scoped_events: list[CountedUsageEvent],
) -> tuple[float, dict[str, float]]:
    """Count activity from globally unique events, grouped by leaf session."""

    relevant_leaves = {event.leaf_session_id for event in scoped_events}
    scoped_by_leaf: dict[str, list[CountedUsageEvent]] = defaultdict(list)
    for event in scoped_events:
        scoped_by_leaf[event.leaf_session_id].append(event)

    points_by_leaf: dict[str, list[tuple[datetime, str, str, str]]] = defaultdict(list)
    for leaf_id in relevant_leaves:
        record = dataset.sessions.get(leaf_id)
        if record and record.started_at:
            points_by_leaf[leaf_id].append((record.started_at, "unknown", "unknown", "session_start"))

    for context in dataset.contexts_by_turn.values():
        if context.leaf_session_id in relevant_leaves:
            points_by_leaf[context.leaf_session_id].append(
                (context.timestamp, context.model, context.effort, f"context:{context.turn_id}")
            )

    for event in dataset.usage_events:
        if event.leaf_session_id in relevant_leaves:
            points_by_leaf[event.leaf_session_id].append(
                (
                    event.timestamp,
                    event.model,
                    event.effort,
                    f"usage:{event.turn_id or 'legacy'}:{usage_signature(event.total_usage)}",
                )
            )

    hours_by_key: dict[str, float] = defaultdict(float)
    total_hours = 0.0
    for leaf_id in sorted(relevant_leaves):
        points = sorted(set(points_by_leaf.get(leaf_id, [])), key=lambda item: (item[0], item[3]))
        leaf_hours = 0.0
        leaf_hours_by_key: dict[str, float] = defaultdict(float)
        active_model = "unknown"
        active_effort = "unknown"

        for start, end in zip(points, points[1:]):
            start_time, start_model, start_effort, _ = start
            end_time, end_model, end_effort, _ = end
            if start_model != "unknown":
                active_model, active_effort = start_model, start_effort
            if end_time <= cutoff:
                if end_model != "unknown":
                    active_model, active_effort = end_model, end_effort
                continue
            clipped_start = max(start_time, cutoff)
            gap_seconds = (end_time - clipped_start).total_seconds()
            if gap_seconds > 0:
                seconds = min(gap_seconds, MAX_IDLE_GAP_SECONDS)
                # Attribute elapsed work to the context active at the start of
                # the interval. Only the session-start -> first-context gap has
                # no active model and therefore uses the arriving context.
                model = active_model if active_model != "unknown" else end_model
                effort = active_effort if active_model != "unknown" else end_effort
                key = model_effort_key(model, effort)
                hours = seconds / 3600
                leaf_hours += hours
                leaf_hours_by_key[key] += hours
            if end_model != "unknown":
                active_model, active_effort = end_model, end_effort

        if scoped_by_leaf[leaf_id] and leaf_hours < ONE_SHOT_SESSION_HOURS:
            dominant = max(
                scoped_by_leaf[leaf_id],
                key=lambda event: event.usage.get("total_tokens", 0),
            )
            key = model_effort_key(dominant.model, dominant.effort)
            floor_delta = ONE_SHOT_SESSION_HOURS - leaf_hours
            leaf_hours += floor_delta
            leaf_hours_by_key[key] += floor_delta

        total_hours += leaf_hours
        for key, hours in leaf_hours_by_key.items():
            hours_by_key[key] += hours

    return total_hours, dict(hours_by_key)


def build_model_effort_breakdown(
    dataset: UsageDataset,
    cutoff: datetime,
    scoped_events: list[CountedUsageEvent],
    hours_by_key: dict[str, float],
) -> dict[str, dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    turn_sets: dict[str, set[str]] = defaultdict(set)
    session_sets: dict[str, set[str]] = defaultdict(set)

    for event in scoped_events:
        key = model_effort_key(event.model, event.effort)
        bucket = buckets.setdefault(
            key,
            {
                "model": event.model,
                "effort": event.effort,
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        add_usage(bucket["token_usage"], event.usage)
        if event.turn_id:
            turn_sets[key].add(event.turn_id)
        session_sets[key].add(event.leaf_session_id)

    # Turn counts describe retained ordered contexts, including a context whose
    # final token event is absent from a truncated log. Copied contexts have
    # already been reduced to their globally earliest turn_id occurrence.
    for context in dataset.contexts_by_turn.values():
        if context.timestamp < cutoff:
            continue
        key = model_effort_key(context.model, context.effort)
        buckets.setdefault(
            key,
            {
                "model": context.model,
                "effort": context.effort,
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        turn_sets[key].add(context.turn_id)
        session_sets[key].add(context.leaf_session_id)

    for key, hours in hours_by_key.items():
        bucket = buckets.setdefault(
            key,
            {
                "model": key.rsplit("/", 1)[0],
                "effort": key.rsplit("/", 1)[-1],
                "turns": 0,
                "sessions": 0,
                "token_usage": empty_usage(),
                "raw_hours": 0.0,
            },
        )
        bucket["raw_hours"] = round(hours, 4)

    for key, bucket in buckets.items():
        bucket["turns"] = len(turn_sets[key])
        bucket["sessions"] = len(session_sets[key])

    return dict(sorted(buckets.items()))


def audit_scope(dataset: UsageDataset, cutoff: datetime, commit_count: int) -> dict[str, Any]:
    scoped_events = [event for event in dataset.usage_events if event.timestamp >= cutoff]
    raw_usage = empty_usage()
    for event in scoped_events:
        add_usage(raw_usage, event.usage)

    active_hours, hours_by_key = active_hours_after_cutoff(dataset, cutoff, scoped_events)
    model_breakdown = build_model_effort_breakdown(dataset, cutoff, scoped_events, hours_by_key)
    raw_tokens = raw_usage["total_tokens"]
    rounded_tokens = rounded_token_count(raw_tokens)
    hours_count = round(active_hours)
    energy = energy_equivalence(rounded_tokens)

    return {
        "commits": commit_count,
        "sessions": len({event.leaf_session_id for event in scoped_events}),
        "turns": len({event.turn_id for event in scoped_events if event.turn_id}),
        "usage_events": len(scoped_events),
        "raw_token_count": raw_tokens,
        "token_usage": raw_usage,
        "token_count": rounded_tokens,
        "tokens_label": token_label(rounded_tokens),
        "raw_hours": active_hours,
        "hours_count": hours_count,
        "hours_label": str(hours_count),
        "model_effort_breakdown": model_breakdown,
        "energy_equivalence": energy,
        "api_cost_equivalence": api_cost_equivalence(scoped_events),
        "legacy_api_cost_equivalence": legacy_api_cost_equivalence(raw_usage),
        "codexbar_cost_estimate": codexbar_cost_estimate(rounded_tokens),
    }


def model_deviation_acknowledgment(deviation: dict[str, Any]) -> tuple[bool, dict[str, Any] | None]:
    policy = MODEL_DEVIATION_ACKNOWLEDGMENTS.get(deviation["turn_id"])
    if policy is None:
        return False, None

    signature_matches = all(
        deviation[field_name] == policy.get(field_name)
        for field_name in ("timestamp", "model", "effort")
    )
    reason = policy.get("reason", "").strip()
    provenance = policy.get("provenance", "").strip()
    acknowledged_at = policy.get("acknowledged_at", "").strip()
    complete = bool(reason and provenance and acknowledged_at)
    acknowledgment = {
        "policy_version": MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION,
        "acknowledged_at": acknowledged_at,
        "reason": reason,
        "provenance": provenance,
        "signature_matches": signature_matches,
    }
    return signature_matches and complete, acknowledgment


def build_model_tracking(dataset: UsageDataset) -> dict[str, Any]:
    contexts = [
        context
        for context in dataset.contexts_by_turn.values()
        if context.timestamp >= GPT_5_6_CUTOVER_UTC
    ]
    contexts.sort(key=lambda item: (item.timestamp, item.turn_id))
    observed: dict[str, int] = defaultdict(int)
    deviations: list[dict[str, str]] = []
    for context in contexts:
        observed[model_effort_key(context.model, context.effort)] += 1
        if context.model != INTENDED_MODEL or context.effort != INTENDED_EFFORT:
            deviation: dict[str, Any] = {
                "turn_id": context.turn_id,
                "timestamp": format_timestamp_utc(context.timestamp),
                "model": context.model,
                "effort": context.effort,
            }
            acknowledged, acknowledgment = model_deviation_acknowledgment(deviation)
            deviation["acknowledged"] = acknowledged
            if acknowledgment is not None:
                deviation["acknowledgment"] = acknowledgment
            deviations.append(deviation)

    acknowledged_count = sum(bool(item["acknowledged"]) for item in deviations)
    unacknowledged_count = len(deviations) - acknowledged_count

    if not contexts:
        status = "unobserved"
    elif unacknowledged_count:
        status = "deviation_detected"
    elif deviations:
        status = "acknowledged_deviations"
    else:
        status = "aligned"
    return {
        "intended_model": INTENDED_MODEL,
        "intended_effort": INTENDED_EFFORT,
        "cutover_at": format_timestamp_utc(GPT_5_6_CUTOVER_UTC),
        "cutover_label": "Jul 9, 2026 at 2:28 PM PDT",
        "acknowledgment_policy_version": MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION,
        "post_cutover_turns_observed": len(contexts),
        "post_cutover_observed_breakdown": dict(sorted(observed.items())),
        "post_cutover_deviation_count": len(deviations),
        "post_cutover_acknowledged_deviation_count": acknowledged_count,
        "post_cutover_unacknowledged_deviation_count": unacknowledged_count,
        "post_cutover_deviations": deviations,
        "status": status,
        "public_note": f"Dev work now: {INTENDED_MODEL} · {INTENDED_EFFORT}.",
        "caveat": (
            "Checks all deduplicated retained-local turn_context records; missing or deleted local logs "
            "cannot be reconstructed. Exact acknowledged deviations remain visible and do not alter "
            "their observed model or effort."
        ),
    }


def load_current_ledger(repo_root: Path) -> dict[str, Any]:
    if yaml is None:
        return {}
    ledger_path = repo_root / "_data" / "agentic_usage.yml"
    if not ledger_path.exists():
        return {}
    with ledger_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


class IndentedSafeDumper(yaml.SafeDumper if yaml else object):
    def increase_indent(self, flow=False, indentless=False):  # type: ignore[override]
        return super().increase_indent(flow, False)


def public_energy_note(energy: dict[str, Any]) -> str:
    return (
        f"Tree lens: about {energy['kwh_midpoint']} kWh, or ~{energy['cut_tree_midpoint']} "
        f"ten-year urban trees' stored carbon. Range: {energy['cut_tree_range']}."
    )


def public_desk_note(energy: dict[str, Any]) -> str:
    return f"roughly {energy['cut_tree_midpoint']} trees cut"


def merge_scope_data(current: dict[str, Any], result: dict[str, Any], *, desk: bool = False) -> dict[str, Any]:
    next_scope = copy.deepcopy(current)
    next_scope["commits"] = result["commits"]
    # A checkout can have complete git history while retained session logs live
    # on another machine or were started from a parent workspace. Keep the
    # previously audited usage snapshot in that case instead of publishing a
    # destructive zero. Commit counts remain independently refreshable.
    current_rhythm = current.get("token_rhythm") if isinstance(current, dict) else None
    has_published_rhythm = bool(
        isinstance(current_rhythm, dict)
        and isinstance(current_rhythm.get("points"), list)
        and current_rhythm["points"]
    )
    if result.get("usage_events", 0) == 0 and (
        int(current.get("token_count") or 0) > 0 or has_published_rhythm
    ):
        return next_scope
    for field_name in (
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
        "token_usage",
        "model_effort_breakdown",
    ):
        next_scope[field_name] = result[field_name]

    energy = copy.deepcopy(next_scope.get("energy_equivalence") or {})
    energy.update(result["energy_equivalence"])
    energy.setdefault("label", "Energy lens")
    energy.setdefault(
        "cut_tree_basis",
        "EPA urban tree annual sequestration over 10 years; stored-carbon basis if removed and eventually released.",
    )
    energy["public_note"] = public_desk_note(energy) if desk else public_energy_note(energy)
    next_scope["energy_equivalence"] = energy
    next_scope["api_cost_equivalence"] = result["api_cost_equivalence"]
    next_scope["legacy_api_cost_equivalence"] = result["legacy_api_cost_equivalence"]
    next_scope["codexbar_cost_estimate"] = result["codexbar_cost_estimate"]
    if isinstance(result.get("token_rhythm"), dict):
        next_scope["token_rhythm"] = copy.deepcopy(result["token_rhythm"])
    return next_scope


def merge_local_lifetime_data(current: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    next_scope = copy.deepcopy(current)
    # Retained sessions can be unavailable on another machine or when the
    # configured sessions root is missing or partial. This is cumulative
    # retained-local evidence, so fail closed on a zero or lower scan instead
    # of letting cross-machine/deleted-log gaps shrink the public lifetime.
    current_raw = int(current.get("raw_token_count") or current.get("token_count") or 0)
    current_rounded = int(current.get("token_count") or 0)
    result_raw = int(result.get("raw_token_count") or 0)
    result_rounded = int(result.get("token_count") or 0)
    if current_rounded > 0 and (
        result.get("usage_events", 0) == 0 or result_raw < current_raw or result_rounded < current_rounded
    ):
        return next_scope
    for field_name in (
        "sessions",
        "turns",
        "usage_events",
        "raw_token_count",
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
        "token_usage",
        "model_effort_breakdown",
    ):
        next_scope[field_name] = result[field_name]
    next_scope["api_cost_equivalence"] = result["api_cost_equivalence"]
    next_scope.update(
        {
            "label": "Local Codex replay",
            "since": "2026-06-19 00:00 PDT",
            "since_label": "Jun 19, 2026",
            "confidence": "deduplicated retained-log slice",
            "note": "Deduplicated request usage replayed from retained logs on this machine since Jun 19, 2026.",
        }
    )
    return next_scope


def sparkline_points(daily: list[dict[str, Any]], width: float = 112, height: float = 28) -> str:
    values = [max(0, int(row.get("tokens") or 0)) for row in daily]
    if not values:
        return ""
    maximum = max(values) or 1
    step = width / max(1, len(values) - 1)
    padding = 2.0
    usable_height = height - padding * 2
    return " ".join(
        f"{index * step:.2f},{height - padding - (value / maximum) * usable_height:.2f}"
        for index, value in enumerate(values)
    )


def short_date_label(value: str) -> str:
    parsed = date.fromisoformat(value)
    return f"{parsed.strftime('%b')} {parsed.day}"


def build_ledger_data(
    current: dict[str, Any],
    total: dict[str, Any],
    desk: dict[str, Any],
    since_gpt_5_6: dict[str, Any],
    local_lifetime: dict[str, Any],
    model_tracking: dict[str, Any],
) -> dict[str, Any]:
    next_data = copy.deepcopy(current)
    next_data["updated_at"] = date.today().isoformat()
    next_data["source_note"] = (
        "Retained local logs and git history supply repo-scoped estimates. "
        "Rounded lifetime Codex usage is published separately from sanitized collector output."
    )
    next_data["model_tracking"] = copy.deepcopy(model_tracking)
    next_data["total"] = merge_scope_data(next_data.get("total", {}), total)
    next_data["desk_scene"] = merge_scope_data(next_data.get("desk_scene", {}), desk, desk=True)
    next_data["desk_scene"]["note"] = (
        "Desk commits are path-scoped; tokens and hours are an all-repo retained-session "
        "time-window estimate since the desk cutoff, not desk-only attribution."
    )

    next_data["since_gpt_5_6"] = merge_scope_data(
        next_data.get("since_gpt_5_6", {}),
        since_gpt_5_6,
    )
    next_data["since_gpt_5_6"].update(
        {
            "label": "Since gpt-5.6-sol cutover",
            "since": "2026-07-09 14:28 PDT",
            "since_label": "Jul 9, 2026",
            "confidence": "retained-log estimate",
            "note": (
                "All-repo retained-session usage after the model cutover; commits are repo-wide "
                "and usage is attributed from ordered turn_context records."
            ),
        }
    )
    next_data["local_lifetime"] = merge_local_lifetime_data(
        next_data.get("local_lifetime", {}),
        local_lifetime,
    )
    # Account-level usage is not part of this public ledger. The direct tracker
    # publishes one anonymous rounded lifetime total, kept
    # separate from every retained-session estimate.
    next_data.pop("account_lifetime", None)
    return next_data


def nested_value(data: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def check_public_freshness(current: dict[str, Any], proposed: dict[str, Any]) -> list[str]:
    mismatches: list[str] = []
    for scope_name in ("total", "desk_scene", "since_gpt_5_6"):
        current_scope = current.get(scope_name, {}) if isinstance(current, dict) else {}
        proposed_scope = proposed.get(scope_name, {}) if isinstance(proposed, dict) else {}
        check_fields = PUBLIC_CHECK_FIELDS + (
            TOTAL_ONLY_PUBLIC_CHECK_FIELDS if scope_name == "total" else ()
        )
        for field_path in check_fields:
            current_value = nested_value(current_scope, field_path)
            proposed_value = nested_value(proposed_scope, field_path)
            if current_value != proposed_value:
                label = ".".join((scope_name, *field_path))
                mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")

    current_lifetime = current.get("local_lifetime", {}) if isinstance(current, dict) else {}
    proposed_lifetime = proposed.get("local_lifetime", {}) if isinstance(proposed, dict) else {}
    for field_path in LOCAL_LIFETIME_CHECK_FIELDS:
        current_value = nested_value(current_lifetime, field_path)
        proposed_value = nested_value(proposed_lifetime, field_path)
        if current_value != proposed_value:
            label = ".".join(("local_lifetime", *field_path))
            mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")

    for field_path in MODEL_TRACKING_CHECK_FIELDS:
        current_value = nested_value(current.get("model_tracking", {}), field_path)
        proposed_value = nested_value(proposed.get("model_tracking", {}), field_path)
        if current_value != proposed_value:
            label = ".".join(("model_tracking", *field_path))
            mismatches.append(f"{label}: current={current_value!r}, expected={proposed_value!r}")
    return mismatches


def write_ledger(repo_root: Path, data: dict[str, Any], dry_run: bool = False) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML is required for --write.")
    text = LEDGER_HEADER + "\n" + yaml.dump(
        data,
        Dumper=IndentedSafeDumper,
        width=1000,
        sort_keys=False,
        allow_unicode=True,
    )
    ledger_path = repo_root / "_data" / "agentic_usage.yml"
    if dry_run:
        print("\n--- proposed _data/agentic_usage.yml ---")
        print(text.rstrip())
        return
    ledger_path.write_text(text, encoding="utf-8")
    print(f"\nUpdated {ledger_path}")


def delta_text(current: Any, proposed: Any) -> str:
    if isinstance(current, int) and isinstance(proposed, int):
        delta = proposed - current
        if delta == 0:
            return "no change"
        sign = "+" if delta > 0 else ""
        return f"{sign}{delta}"
    if current == proposed:
        return "no change"
    return f"was {current!r}"


def print_scope(
    name: str,
    result: dict[str, Any],
    current: dict[str, Any],
    *,
    include_commits: bool = True,
) -> None:
    current_scope = current.get(name, {}) if isinstance(current, dict) else {}
    energy = result["energy_equivalence"]
    cost = result["api_cost_equivalence"]
    legacy_cost = result["legacy_api_cost_equivalence"]
    codexbar_cost = result["codexbar_cost_estimate"]
    print(f"\n[{name}]")
    keys = ("commits", "token_count", "tokens_label", "hours_count", "hours_label") if include_commits else (
        "token_count",
        "tokens_label",
        "hours_count",
        "hours_label",
    )
    for key in keys:
        proposed = result[key]
        current_value = current_scope.get(key)
        print(f"{key}: {proposed} ({delta_text(current_value, proposed)})")
    print(f"raw_token_count: {result['raw_token_count']:,}")
    usage = result["token_usage"]
    print(
        "token_usage: "
        f"input={usage['input_tokens']:,}, "
        f"cached_input={usage['cached_input_tokens']:,}, "
        f"output={usage['output_tokens']:,}, "
        f"reasoning_output={usage['reasoning_output_tokens']:,}"
    )
    print(f"raw_hours: {result['raw_hours']:.2f}")
    print(f"sessions_counted: {result['sessions']}")
    print(f"turns_counted: {result['turns']}")
    print(f"usage_events_counted: {result['usage_events']}")
    print("model_effort_breakdown:")
    for key, bucket in result["model_effort_breakdown"].items():
        print(
            f"  {key}: turns={bucket['turns']}, "
            f"tokens={bucket['token_usage']['total_tokens']:,}, hours={bucket['raw_hours']:.2f}"
        )
    print(f"kwh_midpoint: {energy['kwh_midpoint']}")
    print(f"kg_co2e_midpoint: {energy['kg_co2e_midpoint']}")
    print(f"cut_tree_midpoint: {energy['cut_tree_midpoint']}")
    print(f"cut_tree_range: {energy['cut_tree_range']}")
    print(f"api_cost_equivalence: {cost['usd_label']} (request-aware Standard rates)")
    print(f"legacy_api_cost_equivalence: {legacy_cost['usd_label']} ({LEGACY_PRICE_MODEL})")
    print(
        f"codexbar_cost_estimate: {codexbar_cost['usd_label']} "
        f"({codexbar_cost['usd_per_million_tokens']} USD / 1M tokens)"
    )


def build_json_output(
    root: Path,
    dataset: UsageDataset,
    total: dict[str, Any],
    desk: dict[str, Any],
    since_gpt_5_6: dict[str, Any],
    local_lifetime: dict[str, Any],
    model_tracking: dict[str, Any],
) -> dict[str, Any]:
    return {
        "sessions_root": str(root),
        "repo_sessions": len(dataset.sessions),
        "usage_event_sources": dataset.source_counts,
        "model_tracking": model_tracking,
        "total": total,
        "desk_scene": desk,
        "since_gpt_5_6": since_gpt_5_6,
        "local_lifetime": local_lifetime,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit the site agentic usage ledger without modifying files.")
    parser.add_argument(
        "--sessions-root",
        help="Codex sessions root to scan recursively. Defaults to CODEX_HOME/sessions or ~/.codex/sessions.",
    )
    parser.add_argument("--repo-root", default=".", help="Repository root. Defaults to the current directory.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Exit non-zero if public ledger fields are stale, model tracking is unobserved, or "
            "post-cutover model/effort deviations are unacknowledged."
        ),
    )
    parser.add_argument("--write", action="store_true", help="Update _data/agentic_usage.yml with the proposed values.")
    parser.add_argument("--dry-run", action="store_true", help="Show the proposed write output without changing files.")
    parser.add_argument(
        "--include-pending-commit",
        action="store_true",
        help="Add one commit to scopes with pending worktree changes so a final uncommitted batch can be estimated before commit.",
    )
    parser.add_argument(
        "--pending-path",
        action="append",
        default=[],
        help="Restrict --include-pending-commit checks to this path. Can be repeated.",
    )
    return parser.parse_args()


def model_deviation_messages(model_tracking: dict[str, Any]) -> list[str]:
    return [
        (
            f"{item['timestamp']} turn {item['turn_id']} used "
            f"{item['model']}/{item['effort']} instead of {INTENDED_MODEL}/{INTENDED_EFFORT}; "
            f"not acknowledged by model-deviation policy v{MODEL_DEVIATION_ACKNOWLEDGMENT_POLICY_VERSION}"
        )
        for item in model_tracking.get("post_cutover_deviations", [])
        if not item.get("acknowledged", False)
    ]


def model_tracking_check_messages(model_tracking: dict[str, Any]) -> list[str]:
    if model_tracking.get("status") == "unobserved":
        return [
            "No retained post-cutover turn_context records were found; "
            f"cannot verify {INTENDED_MODEL}/{INTENDED_EFFORT}."
        ]
    return model_deviation_messages(model_tracking)


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    sessions_root = sessions_root_from_args(args.sessions_root)

    try:
        require_complete_git_history(repo_root)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 2

    all_sessions = scan_sessions(sessions_root, None)
    sessions = sessions_matching_repo(all_sessions, REPO_NEEDLE)
    dataset = prepare_usage_dataset(sessions)
    local_dataset = prepare_usage_dataset(all_sessions)
    total_commits = git_commit_count(repo_root, REVAMP_GIT_SINCE, ["."])
    desk_commits = git_commit_count(repo_root, DESK_GIT_SINCE, DESK_PATHS)
    since_gpt_5_6_commits = git_commit_count(repo_root, GPT_5_6_GIT_SINCE, ["."])
    if args.include_pending_commit:
        pending_paths = args.pending_path or ["."]
        if has_pending_changes(repo_root, pending_paths):
            total_commits += 1
            since_gpt_5_6_commits += 1
        desk_pending_paths = paths_matching_scope(pending_paths, DESK_PATHS) if args.pending_path else DESK_PATHS
        if desk_pending_paths and has_pending_changes(repo_root, desk_pending_paths):
            desk_commits += 1

    total = audit_scope(dataset, REVAMP_CUTOFF_UTC, total_commits)
    token_rhythm = build_token_rhythm(dataset, REVAMP_CUTOFF_UTC)
    if token_rhythm is not None:
        total["token_rhythm"] = token_rhythm
    desk = audit_scope(dataset, DESK_CUTOFF_UTC, desk_commits)
    since_gpt_5_6 = audit_scope(dataset, GPT_5_6_CUTOVER_UTC, since_gpt_5_6_commits)
    local_lifetime = audit_scope(local_dataset, LOCAL_LIFETIME_CUTOFF_UTC, commit_count=0)
    # The declared model/effort default applies to all retained local Codex
    # development work, not only sessions whose first cwd matches this repo.
    # Site usage scopes remain repo-filtered; policy tracking uses the complete
    # deduplicated retained-local context inventory.
    model_tracking = build_model_tracking(local_dataset)

    if args.check:
        if yaml is None:
            print("PyYAML is required for --check.", file=sys.stderr)
            return 2
        current = load_current_ledger(repo_root)
        proposed = build_ledger_data(current, total, desk, since_gpt_5_6, local_lifetime, model_tracking)
        mismatches = check_public_freshness(current, proposed)
        model_issues = model_tracking_check_messages(model_tracking)
        if mismatches or model_issues:
            if mismatches:
                print("Agentic usage ledger public fields are stale:")
                for mismatch in mismatches:
                    print(f"- {mismatch}")
            if model_issues:
                print("Post-cutover model/effort policy is not accepted:")
                for issue in model_issues:
                    print(f"- {issue}")
            return 1
        print(
            "Agentic usage ledger public fields are fresh; "
            "post-cutover model/effort policy is accepted."
        )
        return 0

    if args.json:
        print(
            json.dumps(
                build_json_output(
                    sessions_root,
                    dataset,
                    total,
                    desk,
                    since_gpt_5_6,
                    local_lifetime,
                    model_tracking,
                ),
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    print("Agentic usage audit")
    print(f"sessions_root: {sessions_root}")
    print(f"local_sessions: {len(all_sessions)}")
    print(f"repo_sessions: {len(sessions)}")
    print(f"usage_event_sources: {json.dumps(dataset.source_counts, sort_keys=True)}")
    print(
        "model_tracking: "
        f"{model_tracking['status']} "
        f"({model_tracking['post_cutover_turns_observed']} retained turns, "
        f"{model_tracking['post_cutover_deviation_count']} deviations: "
        f"{model_tracking['post_cutover_acknowledged_deviation_count']} acknowledged, "
        f"{model_tracking['post_cutover_unacknowledged_deviation_count']} unacknowledged)"
    )
    current = load_current_ledger(repo_root)
    if yaml is None:
        print("warning: PyYAML is not installed; skipping comparison with _data/agentic_usage.yml")

    print_scope("total", total, current)
    print_scope("desk_scene", desk, current)
    print_scope("since_gpt_5_6", since_gpt_5_6, current)
    print_scope("local_lifetime", local_lifetime, current, include_commits=False)
    if args.write or args.dry_run:
        next_data = build_ledger_data(current, total, desk, since_gpt_5_6, local_lifetime, model_tracking)
        write_ledger(repo_root, next_data, dry_run=args.dry_run)
    else:
        print("\nThis was a read-only audit. Use --write after reviewing the deltas to update _data/agentic_usage.yml.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
