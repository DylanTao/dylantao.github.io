from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from datetime import date
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = REPO_ROOT / ".codex" / "hooks" / "site_policy.py"


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

    def write_publication_lens(self, last_synced: str) -> None:
        (self.repo / "_data" / "publication_lens.yml").write_text(
            f"metadata:\n  last_synced: {last_synced}\npapers: {{}}\n",
            encoding="utf-8",
        )

    def payload(self, command: str) -> dict[str, Any]:
        return {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "cwd": str(self.repo),
            "tool_input": {"command": command},
        }

    def runner(
        self,
        *,
        ledger_returncode: int = 0,
        staged_paths: list[str] | None = None,
        outgoing_paths: list[str] | None = None,
    ):
        staged_paths = staged_paths or []
        outgoing_paths = outgoing_paths or []
        calls: list[list[str]] = []
        timeouts: list[tuple[list[str], int]] = []

        def run(args: list[str], *, cwd: Path | str | None, timeout: int = 30):
            calls.append(args)
            timeouts.append((args, timeout))
            if args == ["git", "rev-parse", "--show-toplevel"]:
                return subprocess.CompletedProcess(args, 0, stdout=f"{self.repo}\n", stderr="")
            if args == ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]:
                return subprocess.CompletedProcess(args, 0, stdout="origin/main\n", stderr="")
            if args[:5] == ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMRT"]:
                return subprocess.CompletedProcess(args, 0, stdout="\n".join(staged_paths), stderr="")
            if args == ["git", "diff", "--name-only", "origin/main...HEAD"]:
                return subprocess.CompletedProcess(args, 0, stdout="\n".join(outgoing_paths), stderr="")
            if any(str(part).endswith("audit_agentic_usage.py") for part in args):
                stdout = "" if ledger_returncode == 0 else "Agentic usage ledger public fields are stale."
                return subprocess.CompletedProcess(args, ledger_returncode, stdout=stdout, stderr="")
            self.fail(f"unexpected command: {args}")

        run.calls = calls  # type: ignore[attr-defined]
        run.timeouts = timeouts  # type: ignore[attr-defined]
        return run

    def assert_denied(self, response: dict[str, Any] | None) -> str:
        self.assertIsNotNone(response)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertEqual(output["permissionDecision"], "deny")
        return output["permissionDecisionReason"]

    def test_normal_commit_blocks_when_ledger_is_stale(self) -> None:
        runner = self.runner(ledger_returncode=1, staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload('git commit -m "site polish"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("Agentic usage ledger is stale", reason)
        self.assertIn("python bin/audit_agentic_usage.py --write --include-pending-commit", reason)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertIn("--check", audit_calls[0])
        self.assertIn("--include-pending-commit", audit_calls[0])
        self.assertEqual(audit_calls[0][-2:], ["--pending-path", "AGENTS.md"])

    def test_fresh_normal_commit_exits_cleanly(self) -> None:
        runner = self.runner(ledger_returncode=0, staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload('git commit -m "site polish"'), today=date(2026, 6, 20), runner=runner)

        self.assertIsNone(response)
        audit_timeouts = [
            timeout
            for args, timeout in runner.timeouts
            if any(str(part).endswith("audit_agentic_usage.py") for part in args)
        ]
        self.assertEqual(audit_timeouts, [site_policy.LEDGER_AUDIT_TIMEOUT_SECONDS])

    def test_amend_commit_uses_read_only_check_without_pending_commit(self) -> None:
        runner = self.runner(ledger_returncode=1, staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload("git commit --amend --no-edit"), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("python bin/audit_agentic_usage.py --write", reason)
        self.assertNotIn("--write --include-pending-commit", reason)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertEqual(audit_calls[0][-1], "--check")
        self.assertNotIn("--include-pending-commit", audit_calls[0])

    def test_push_uses_read_only_check_without_pending_commit(self) -> None:
        runner = self.runner(ledger_returncode=0, outgoing_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload("git push origin main"), today=date(2026, 6, 20), runner=runner)

        self.assertIsNone(response)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertEqual(audit_calls[0][-1], "--check")
        self.assertNotIn("--include-pending-commit", audit_calls[0])

    def test_hook_only_commit_skips_ledger_check(self) -> None:
        runner = self.runner(
            ledger_returncode=1,
            staged_paths=[
                ".codex/hooks.json",
                ".codex/hooks/site_policy.py",
                "bin/audit_agentic_usage.py",
                "test/test_codex_hook_policy.py",
            ],
        )
        response = site_policy.handle_payload(
            self.payload('git commit --only -m "Add Codex freshness hooks" -- .codex/hooks.json .codex/hooks/site_policy.py bin/audit_agentic_usage.py test/test_codex_hook_policy.py'),
            today=date(2026, 6, 20),
            runner=runner,
        )

        self.assertIsNone(response)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertEqual(audit_calls, [])

    def test_hook_only_push_skips_ledger_check(self) -> None:
        runner = self.runner(
            ledger_returncode=1,
            outgoing_paths=[
                ".codex/hooks.json",
                ".codex/hooks/site_policy.py",
                "bin/audit_agentic_usage.py",
                "test/test_codex_hook_policy.py",
            ],
        )
        response = site_policy.handle_payload(self.payload("git push origin main"), today=date(2026, 6, 20), runner=runner)

        self.assertIsNone(response)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertEqual(audit_calls, [])

    def test_quoted_git_push_search_text_does_not_trigger_hook(self) -> None:
        runner = self.runner(ledger_returncode=1)
        response = site_policy.handle_payload(
            self.payload('rg -n "git push origin main" docs'),
            today=date(2026, 6, 20),
            runner=runner,
        )

        self.assertIsNone(response)
        self.assertEqual(runner.calls, [])

    def test_real_push_after_separator_still_triggers_hook(self) -> None:
        runner = self.runner(ledger_returncode=0)
        response = site_policy.handle_payload(
            self.payload("Write-Output ok; git push origin main"),
            today=date(2026, 6, 20),
            runner=runner,
        )

        self.assertIsNone(response)
        audit_calls = [call for call in runner.calls if any(str(part).endswith("audit_agentic_usage.py") for part in call)]
        self.assertEqual(audit_calls[0][-1], "--check")

    def test_publication_commit_blocks_when_citations_are_not_today(self) -> None:
        self.write_citations("2026-06-19")
        runner = self.runner(ledger_returncode=0, staged_paths=["_bibliography/papers.bib"])
        response = site_policy.handle_payload(self.payload('git commit -m "publication update"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("today's Scholar snapshot", reason)
        self.assertIn("python bin/update_scholar_citations.py --force", reason)

    def test_unrelated_commit_gets_context_when_scholar_is_more_than_one_day_stale(self) -> None:
        self.write_citations("2026-06-18")
        runner = self.runner(ledger_returncode=0, staged_paths=["assets/js/home.js"])
        response = site_policy.handle_payload(self.payload('git commit -m "layout update"'), today=date(2026, 6, 20), runner=runner)

        self.assertIsNotNone(response)
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertNotIn("permissionDecision", output)
        self.assertIn("Google Scholar data is more than one day stale", output["additionalContext"])

    def test_commit_all_is_denied_before_checks(self) -> None:
        runner = self.runner(ledger_returncode=0, staged_paths=["AGENTS.md"])
        response = site_policy.handle_payload(self.payload('git commit -am "sweep"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("Stage only the intended files explicitly", reason)
        self.assertEqual(runner.calls, [])

    def test_citation_data_files_must_be_staged_together(self) -> None:
        runner = self.runner(ledger_returncode=0, staged_paths=["_data/citations.yml"])
        response = site_policy.handle_payload(self.payload('git commit -m "citation update"'), today=date(2026, 6, 20), runner=runner)

        reason = self.assert_denied(response)
        self.assertIn("Scholar citation data files should be staged together", reason)


if __name__ == "__main__":
    unittest.main()
