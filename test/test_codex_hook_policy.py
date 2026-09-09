from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from datetime import date
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = REPO_ROOT / ".codex" / "hooks" / "site_policy.py"
HOOKS_CONFIG_PATH = REPO_ROOT / ".codex" / "hooks.json"

REPO_ROOT_COMMAND = ["git", "rev-parse", "--show-toplevel"]
STAGED_PATHS_COMMAND = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"]


def load_policy_module() -> Any:
    spec = importlib.util.spec_from_file_location("site_policy", POLICY_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


site_policy = load_policy_module()


class HookPolicyTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.repo = Path(self.tempdir.name)
        (self.repo / "_data").mkdir(parents=True)
        self.write_citations("2026-06-20")
        self.write_publication_lens("2026-06-20")

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def write_citations(self, last_updated: str) -> None:
        (self.repo / "_data" / "citations.yml").write_text(
            f"metadata:\n  last_updated: '{last_updated}'\npapers: {{}}\n",
            encoding="utf-8",
        )

    def write_publication_lens(self, totals_last_synced: str) -> None:
        (self.repo / "_data" / "publication_lens.yml").write_text(
            f"metadata:\n  totals_last_synced: {totals_last_synced}\npapers: {{}}\n",
            encoding="utf-8",
        )

    def payload(self, command: str) -> dict[str, Any]:
        return {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "cwd": str(self.repo),
            "tool_input": {"command": command},
        }

    def runner(self, *, staged_paths: list[str] | None = None):
        staged_paths = staged_paths or []
        calls: list[list[str]] = []

        def run(args: list[str], *, cwd: Path | str | None, timeout: int = 30):
            calls.append(args)
            if args == REPO_ROOT_COMMAND:
                return subprocess.CompletedProcess(args, 0, stdout=f"{self.repo}\n", stderr="")
            if args == STAGED_PATHS_COMMAND:
                return subprocess.CompletedProcess(args, 0, stdout="\n".join(staged_paths), stderr="")
            self.fail(f"unexpected command: {args}")

        run.calls = calls  # type: ignore[attr-defined]
        return run

    def assert_denied(self, response: dict[str, Any] | None) -> str:
        self.assertIsNotNone(response)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertEqual(output["permissionDecision"], "deny")
        return output["permissionDecisionReason"]

    def assert_context(self, response: dict[str, Any] | None) -> str:
        self.assertIsNotNone(response)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertNotIn("permissionDecision", output)
        return output["additionalContext"]

    def test_fresh_normal_commit_exits_cleanly(self) -> None:
        runner = self.runner(staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload('git commit -m "site polish"'), today=date(2026, 6, 20), runner=runner)

        self.assertIsNone(response)
        self.assertEqual(runner.calls, [REPO_ROOT_COMMAND, STAGED_PATHS_COMMAND])

    def test_amend_commit_still_runs_the_scholar_check(self) -> None:
        self.write_citations("2026-06-18")
        runner = self.runner(staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload("git commit --amend --no-edit"), today=date(2026, 6, 20), runner=runner)

        self.assertIn("Google Scholar data is more than one day stale", self.assert_context(response))

    def test_push_with_fresh_scholar_data_exits_cleanly(self) -> None:
        runner = self.runner()
        response = site_policy.handle_payload(self.payload("git push origin main"), today=date(2026, 6, 20), runner=runner)

        self.assertIsNone(response)
        self.assertEqual(runner.calls, [REPO_ROOT_COMMAND])

    def test_quoted_git_push_search_text_does_not_trigger_hook(self) -> None:
        runner = self.runner()
        response = site_policy.handle_payload(
            self.payload('rg -n "git push origin main" docs'),
            today=date(2026, 6, 20),
            runner=runner,
        )

        self.assertIsNone(response)
        self.assertEqual(runner.calls, [])

    def test_real_push_after_separator_still_triggers_hook(self) -> None:
        self.write_citations("2026-06-18")
        runner = self.runner()
        response = site_policy.handle_payload(
            self.payload("Write-Output ok; git push origin main"),
            today=date(2026, 6, 20),
            runner=runner,
        )

        self.assertIn("Google Scholar data is more than one day stale", self.assert_context(response))
        self.assertEqual(runner.calls[0], REPO_ROOT_COMMAND)

    def test_publication_commit_blocks_when_citations_are_not_today(self) -> None:
        self.write_citations("2026-06-19")
        runner = self.runner(staged_paths=["_bibliography/papers.bib"])
        response = site_policy.handle_payload(self.payload('git commit -m "publication update"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("today's Scholar snapshot", reason)
        self.assertIn("python bin/update_scholar_citations.py --force", reason)

    def test_unrelated_commit_gets_context_when_scholar_is_more_than_one_day_stale(self) -> None:
        self.write_citations("2026-06-18")
        runner = self.runner(staged_paths=["assets/js/home.js"])
        response = site_policy.handle_payload(self.payload('git commit -m "layout update"'), today=date(2026, 6, 20), runner=runner)

        self.assertIsNotNone(response)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertNotIn("permissionDecision", output)
        self.assertIn("Google Scholar data is more than one day stale", output["additionalContext"])

    def test_commit_all_is_denied_before_checks(self) -> None:
        runner = self.runner(staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload('git commit -am "sweep"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("Stage only the intended files explicitly", reason)
        self.assertEqual(runner.calls, [])

    def test_citation_data_files_must_be_staged_together(self) -> None:
        runner = self.runner(staged_paths=["_data/citations.yml"])
        response = site_policy.handle_payload(self.payload('git commit -m "citation update"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("Scholar citation data files should be staged together", reason)

    def test_policy_has_no_ledger_surface(self) -> None:
        self.assertNotIn("audit_agentic_usage", POLICY_PATH.read_text(encoding="utf-8"))
        for name in (
            "run_ledger_check",
            "run_stage_aware_ledger_check",
            "ledger_audit_is_throttled",
            "LEDGER_AUDIT_STAMP_RELPATH",
        ):
            self.assertFalse(hasattr(site_policy, name), name)

    def test_hook_config_points_at_policy_and_names_scholar(self) -> None:
        hooks = json.loads(HOOKS_CONFIG_PATH.read_text(encoding="utf-8"))
        pre_tool_use = hooks["hooks"]["PreToolUse"]

        self.assertEqual(len(pre_tool_use), 1)
        self.assertEqual(len(pre_tool_use[0]["hooks"]), 1)
        hook = pre_tool_use[0]["hooks"][0]
        self.assertIn("site_policy.py", hook["command"])
        self.assertIn("site_policy.py", hook["commandWindows"])
        self.assertEqual(hook["statusMessage"], "Checking Scholar citation freshness")
        self.assertEqual(hook["timeout"], 30)


if __name__ == "__main__":
    unittest.main()
