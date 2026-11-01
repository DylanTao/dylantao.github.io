from __future__ import annotations

import copy
from contextlib import nullcontext
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("coastal_research", ROOT / "bin/coastal_research.py")
RESEARCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RESEARCH)
SCHEMA_BYTES = (ROOT / "bin/coastal_research_result.schema.json").read_bytes()

FAKE_CLI = r'''
import json, pathlib, re, subprocess, sys, time
mode = sys.argv[1]
args = sys.argv[2:]
if mode.startswith('early-child:'):
    marker = mode.split(':',1)[1]
    child = subprocess.Popen([sys.executable,'-c','import pathlib,time;time.sleep(0.9);pathlib.Path('+repr(marker)+').write_text("escaped")'])
    pathlib.Path(marker+'-spawned').write_text(str(child.pid))
    time.sleep(0.6)
    sys.stdin.buffer.read()
    raise SystemExit(0)
if '--version' in args:
    print('codex-cli fixture-only')
    raise SystemExit(0)
if '--help' in args:
    print('--sandbox --json --output-schema --output-last-message --cd --ephemeral')
    raise SystemExit(0)
prompt = sys.stdin.buffer.read().decode('utf-8')
if mode in {'exit-with-usage','sleep-with-usage','turn-failed-with-usage','invalid-jsonl-with-usage'}:
    print(json.dumps({'type':'turn.completed','usage':{'input_tokens':11,'cached_input_tokens':3,'output_tokens':5}}),flush=True)
    if mode == 'exit-with-usage':
        raise SystemExit(9)
    if mode == 'sleep-with-usage':
        time.sleep(30)
if mode == 'exit':
    print(json.dumps({'type':'turn.started'}),flush=True)
    print('fixture process error',file=sys.stderr)
    raise SystemExit(9)
if mode == 'sleep':
    print(json.dumps({'type':'turn.started'}), flush=True)
    time.sleep(30)
if mode.startswith('orphan:'):
    marker = mode.split(':',1)[1]
    subprocess.Popen([sys.executable, '-c', 'import pathlib,time;time.sleep(1);pathlib.Path('+repr(marker)+').write_text("escaped")'])
    if 'timeout-orphan' in args:
        time.sleep(30)
    raise SystemExit(0)
root = pathlib.Path(args[args.index('--cd')+1])
ident = re.search(r'# Coastal experiment: ([a-z0-9-]+)',prompt).group(1)
qa = re.search(r'Generated evidence directory: (.+)/\n',prompt).group(1)
evidence = qa + '/gate.txt'
(root/evidence).parent.mkdir(parents=True,exist_ok=True)
(root/evidence).write_text('fixture gate result; not a real model or GPU result',encoding='utf-8')
changes = []
if mode != 'no-change':
    name = 'assets/js/home-scene/example.mjs'
    (root/name).write_text('export const fixture = 2;\n',encoding='utf-8')
    changes = [name]
if mode == 'outside':
    (root/'outside.txt').write_text('not leased')
if mode == 'ignored-native':
    name = root/'assets/models/home/static-light-field.json'
    name.parent.mkdir(parents=True,exist_ok=True)
    name.write_text('{}')
if mode == 'ref-change':
    subprocess.run(['git','-C',str(root),'update-ref','refs/heads/main','HEAD~1'],check=True)
if mode == 'commit':
    subprocess.run(['git','-C',str(root),'add',changes[0]],check=True)
    subprocess.run(['git','-C',str(root),'commit','-qm','fixture out-of-contract commit'],check=True)
result = {
    'experiment_id':ident,'outcome': 'no-change' if mode == 'no-change' else 'continue' if mode == 'continue' else 'blocked' if mode == 'blocked' else 'candidate',
    'summary':'Synthetic CLI fixture, never a model execution.',
    'source_review':[{'url':'https://jcgt.org/published/0014/02/01/','review':'method-reviewed','fit':'fixture only','limits':['not a scientific review']}],
    'changes':changes,'gates':[{'id':'unit','status':'pass','evidence':evidence,'limits':'synthetic process test only'}],
    'evidence':[evidence],'failures':[], 'next_hypothesis':'Review the retained fixture result.'
}
if mode == 'schema':
    del result['next_hypothesis']
if mode == 'unbound-evidence':
    result['gates'][0]['evidence'] = 'nonexistent.log'
if mode == 'omitted-gate':
    result['gates'] = []
if mode == 'false-changes':
    result['changes'] = []
if mode == 'qualified':
    result['outcome'] = 'renderer-qualified'
if mode == 'new-file':
    name = 'assets/js/home-scene/new.mjs'
    (root/name).write_text('export const newFixture = true;\n')
    result['changes'].append(name)
if mode != 'missing-result':
    pathlib.Path(args[args.index('--output-last-message')+1]).write_text(json.dumps(result),encoding='utf-8')
if mode in {'invalid-jsonl','invalid-jsonl-with-usage'}:
    print('unstructured unexpected stdout')
elif mode in {'turn-failed','turn-failed-with-usage'}:
    print(json.dumps({'type':'turn.failed','error':{'message':'fixture failure'}}))
else:
    event = {'type':'turn.completed'}
    if mode != 'no-usage':
        event['usage'] = {'input_tokens':11,'cached_input_tokens':3,'output_tokens':5}
    print(json.dumps(event))
'''


class CoastalResearchTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="coastal-research-test-")
        self.base = Path(self.temporary.name).resolve()
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Research Test Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "core.hooksPath", str(self.base / "no-hooks"))
        product = self.repo / "assets/js/home-scene/example.mjs"
        product.parent.mkdir(parents=True)
        product.write_text("export const fixture = 0;\n", encoding="utf-8")
        (self.repo / "evidence.md").write_text("Fixture baseline, not scene evidence.\n")
        (self.repo / ".gitignore").write_text(".jekyll-cache/\nassets/models/\n")
        self.git("add", "assets/js/home-scene/example.mjs", "evidence.md", ".gitignore")
        self.git("commit", "-qm", "fixture baseline parent")
        product.write_text("export const fixture = 1;\n", encoding="utf-8")
        self.git("add", "assets/js/home-scene/example.mjs")
        self.git("commit", "-qm", "fixture baseline")
        self.sha = self.git("rev-parse", "HEAD")
        self.fake = self.base / "fake_cli.py"
        self.fake.write_text(FAKE_CLI, encoding="utf-8")
        self.state = self.base / "private-state"
        self.worktrees = self.base / "worktrees"
        self.item = {
            "id": "fixture",
            "title": "Process fixture, not rendering research",
            "state": "ready",
            "hypothesis": "A synthetic CLI can prove orchestration boundaries.",
            "rationale": "Do not spend model tokens to test process failures.",
            "allowed_paths": ["assets/js/home-scene/example.mjs"],
            "primary_sources": [{"url": "https://jcgt.org/published/0014/02/01/", "title": "Fixture primary URL", "review": "method-reviewed", "fit_notes": ["Fixture only, no actual method-fit claim."]}],
            "baseline": {"source_sha": self.sha, "evidence": ["evidence.md"], "limits": ["Synthetic fixture only."]},
            "gates": [{"id": "unit", "command": [sys.executable, "-c", "print('fixture')"], "expectation": "Bound synthetic evidence."}],
            "next_step": "Review the synthetic receipt.",
        }
        self.queue = {"version": 1, "primary_hosts": ["jcgt.org"], "experiments": [self.item]}

    def tearDown(self):
        # Only this explicitly created system-temp fixture is recursively removed.
        self.assertEqual(self.base.parent, Path(tempfile.gettempdir()).resolve())
        self.temporary.cleanup()

    def git(self, *args):
        return RESEARCH.git(self.repo, *args)

    def run_fixture(self, mode="success", **overrides):
        kwargs = {"max_seconds": 10, "max_iterations": 1}
        kwargs.update(overrides)
        return RESEARCH.run_experiment(self.repo, self.item, json.dumps(self.queue).encode(), SCHEMA_BYTES, [sys.executable, str(self.fake), mode], self.state, self.worktrees, **kwargs)

    def test_shipped_queue_has_no_admitted_or_ready_experiments(self):
        queue = RESEARCH.load_queue(ROOT / RESEARCH.QUEUE)
        self.assertGreaterEqual(len(queue["experiments"]), 3)
        self.assertTrue(all(x["state"] == "proposed" for x in queue["experiments"]))
        self.assertTrue(any(s["review"] == "abstract-reviewed" for x in queue["experiments"] for s in x["primary_sources"]))
        for item in queue["experiments"]:
            for name in item["allowed_paths"] + item["baseline"]["evidence"]:
                self.assertTrue((ROOT / name).is_file(), name)

    def test_queue_rejects_unknown_fields_and_duplicate_ids(self):
        for mutate in (lambda q: q.update(unknown=True), lambda q: q["experiments"].append(copy.deepcopy(q["experiments"][0]))):
            queue = copy.deepcopy(self.queue)
            mutate(queue)
            with self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.validate_queue(queue)

    def test_queue_requires_pinned_baseline_and_reviewed_ready_fit(self):
        for key, value in (("sha", "main"), ("review", "abstract-reviewed"), ("fit", []), ("gates", [])):
            queue = copy.deepcopy(self.queue)
            item = queue["experiments"][0]
            if key == "sha":
                item["baseline"]["source_sha"] = value
            elif key == "review":
                item["primary_sources"][0]["review"] = value
            elif key == "fit":
                item["primary_sources"][0]["fit_notes"] = value
            else:
                item["gates"][0]["command"] = value
            with self.subTest(key=key), self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.validate_queue(queue)

    def test_exact_paths_reject_escape_glob_and_protected_outputs(self):
        for path in ("../main.txt", "/absolute", "C:/other", "a\\b", "a//b", "a/./b", ".git/config", "assets/js/**", "assets/models/home/manifest.json", "artwork/native.blend", "_data/code_activity.json", ".github/workflows/publish.yml", "cache/static-light-field.json"):
            with self.subTest(path=path), self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.allowed_path(path)

    def test_sources_require_exact_allowlisted_https(self):
        for url in ("http://jcgt.org/", "https://jcgt.org.evil.invalid/", "https://user:pass@jcgt.org/", "https://jcgt.org:444/", "https://jcgt.org/#fragment", "file:///etc/passwd"):
            with self.subTest(url=url), self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.source_url(url, ["jcgt.org"])

    def test_private_dns_and_redirects_are_rejected(self):
        answer = [(2, 1, 6, "", ("127.0.0.1", 443))]
        with patch.object(RESEARCH.socket, "getaddrinfo", return_value=answer):
            with self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.public_address("https://jcgt.org/", ["jcgt.org"])
        handler = RESEARCH.PrimaryRedirect(["jcgt.org"])
        with self.assertRaises(RESEARCH.ResearchError):
            handler.redirect_request(None, None, 302, "", {}, "https://unlisted.invalid/")

    def test_discovery_hashes_complete_body_without_reviewing_method(self):
        body = b"<title>Primary source &amp; method</title><p>fixture</p>"
        class Response(io.BytesIO):
            headers = {"Content-Type": "text/html; charset=utf-8", "ETag": "fixture"}
            status = 200
            url = "https://jcgt.org/published/0014/02/01/"
        class Opener:
            def open(self, request, timeout):
                return Response(body)
        with patch.object(RESEARCH, "public_address"), patch.object(RESEARCH, "build_opener", return_value=Opener()):
            result = RESEARCH.fetch_source(Response.url, ["jcgt.org"])
        self.assertEqual(result["sha256"], RESEARCH.digest(body))
        self.assertEqual(result["title"], "Primary source & method")
        self.assertFalse(result["method_reviewed"])
        self.assertFalse(result["renderer_qualified"])
        with patch.object(RESEARCH, "public_address"), patch.object(RESEARCH, "build_opener", return_value=Opener()), patch.object(RESEARCH, "MAX_SOURCE_BYTES", 8):
            with self.assertRaises(RESEARCH.ResearchError):
                RESEARCH.fetch_source(Response.url, ["jcgt.org"])

    def test_context_is_portable_evidence_first_and_has_no_promotion(self):
        brief = RESEARCH.context_brief(self.item)
        for text in (self.sha, "Allowed product files", "Primary sources", "Baseline limits", "Do not push", "hidden chain of thought", "Software functional proof", "actual", "not a hard token cap"):
            if text == "not a hard token cap":
                self.assertIn("Never claim renderer qualification or a hard token cap", brief)
            else:
                self.assertIn(text, brief)

    def test_future_model_is_forwarded_once_without_default_substitution(self):
        plain = RESEARCH.command_for(["codex"], Path("work"), Path("schema"), Path("result"))
        chosen = RESEARCH.command_for(["codex"], Path("work"), Path("schema"), Path("result"), "future/vendor-model.2")
        self.assertNotIn("--model", plain)
        self.assertEqual(chosen[chosen.index("--model") + 1], "future/vendor-model.2")
        self.assertEqual(chosen.count("--model"), 1)
        self.assertEqual(chosen[-1], "-")
        self.assertIn("workspace-write", chosen)
        self.assertNotIn("--dangerously-bypass-approvals-and-sandbox", chosen)

    def test_key_environment_is_not_used_for_account_runner(self):
        with patch.dict(RESEARCH.os.environ, {"OPENAI_API_KEY": "fixture-never-a-secret", "CODEX_API_KEY": "fixture-never-a-secret"}):
            self.assertNotIn("OPENAI_API_KEY", RESEARCH.private_env())
            self.assertNotIn("CODEX_API_KEY", RESEARCH.private_env())
            self.assertEqual(RESEARCH.private_env()["PYTHONDONTWRITEBYTECODE"], "1")

    def test_shared_lease_rejects_second_runner_and_never_auto_breaks(self):
        common = RESEARCH.common_dir(self.repo)
        with RESEARCH.Lease(common, "first"):
            with self.assertRaises(RESEARCH.ResearchError):
                with RESEARCH.Lease(common, "second"):
                    self.fail("second runner entered")
        self.assertFalse((common / "coastal-research-runner.lock").exists())

    def test_state_and_worktree_roots_cannot_be_inside_git(self):
        with self.assertRaises(RESEARCH.ResearchError):
            RESEARCH.external_dir(self.repo / "ignored-private-state")

    def test_success_retains_worktree_and_hashes_diff_result_and_logs(self):
        before = RESEARCH.protected_refs(self.repo)
        directory, receipt = self.run_fixture()
        self.assertEqual(receipt["status"], "candidate")
        self.assertEqual(RESEARCH.protected_refs(self.repo), before)
        self.assertTrue(Path(receipt["worktree"]).is_dir())
        self.assertIn("fixture = 2", (directory / "changes.patch").read_text())
        self.assertEqual(receipt["iterations"][0]["usage_as_reported"], [{"input_tokens": 11, "cached_input_tokens": 3, "output_tokens": 5}])
        self.assertIsNone(receipt["bounds"]["hard_token_cap"])
        self.assertEqual(receipt["product_changes"], self.item["allowed_paths"])
        manifest = json.loads((directory / "MANIFEST.json").read_text())
        for row in manifest["files"]:
            self.assertEqual(RESEARCH.digest((directory / row["path"]).read_bytes()), row["sha256"])
        self.assertTrue(any(x["path"].endswith("stdout.jsonl") for x in manifest["files"]))
        with self.assertRaises(FileExistsError):
            RESEARCH.seal(directory, receipt)

    def test_new_product_file_is_preserved_outside_git_as_well_as_worktree(self):
        self.item["allowed_paths"].append("assets/js/home-scene/new.mjs")
        directory, receipt = self.run_fixture("new-file")
        self.assertEqual(receipt["status"], "candidate")
        self.assertTrue((directory / "product/assets/js/home-scene/new.mjs").is_file())

    def test_no_usage_is_reported_as_unavailable_not_estimated(self):
        _, receipt = self.run_fixture("no-usage")
        self.assertEqual(receipt["status"], "candidate")
        self.assertEqual(receipt["iterations"][0]["usage_as_reported"], [])

    def test_no_change_is_distinct_from_candidate(self):
        _, receipt = self.run_fixture("no-change")
        self.assertEqual(receipt["status"], "no-change")
        self.assertEqual(receipt["product_changes"], [])

    def test_iteration_limit_is_real_and_preserves_every_attempt(self):
        directory, receipt = self.run_fixture("continue", max_iterations=2)
        self.assertEqual(receipt["status"], "iteration-limit")
        self.assertEqual(len(receipt["iterations"]), 2)
        self.assertTrue((directory / "iteration-02-prompt.txt").is_file())
        self.assertIn("Previous structured handback", (directory / "iteration-02-prompt.txt").read_text(encoding="utf-8"))

    def test_proposed_experiment_never_launches_model(self):
        self.item["state"] = "proposed"
        with patch.object(RESEARCH, "process") as process:
            with self.assertRaises(RESEARCH.ResearchError):
                self.run_fixture()
            process.assert_not_called()

    def test_dirty_runner_source_never_launches_model(self):
        (self.repo / "untracked.txt").write_text("preserve this unrelated work")
        with patch.object(RESEARCH, "process") as process:
            with self.assertRaises(RESEARCH.ResearchError):
                self.run_fixture()
            process.assert_not_called()

    def test_bounds_cannot_be_removed_or_expanded_without_limit(self):
        for kwargs in ({"max_seconds": 0}, {"max_seconds": 3601}, {"max_iterations": 0}, {"max_iterations": 4}):
            with self.subTest(kwargs=kwargs), self.assertRaises(RESEARCH.ResearchError):
                self.run_fixture(**kwargs)

    def test_model_and_process_failures_are_sealed_and_stop_future_runs(self):
        _, receipt = self.run_fixture("turn-failed")
        self.assertEqual(receipt["status"], "guarded-failure")
        self.assertTrue(Path(receipt["worktree"]).is_dir())
        with self.assertRaises(RESEARCH.ResearchError):
            self.run_fixture()

    def test_process_nonzero_and_missing_result_have_no_automatic_retry(self):
        for mode in ("exit", "missing-result"):
            with self.subTest(mode=mode):
                directory, receipt = self.run_fixture(mode)
                self.assertEqual(receipt["status"], "guarded-failure")
                self.assertEqual(len(receipt["iterations"]), 1)
                self.assertTrue((directory / "iteration-01-stderr.log").is_file())
                (RESEARCH.common_dir(self.repo) / "coastal-research-BLOCKED.json").unlink()

    def test_symlink_escape_is_not_an_allowed_product_file(self):
        product = self.repo / self.item["allowed_paths"][0]
        external = self.base / "external.txt"
        external.write_text("preserve external fixture")
        product.unlink()
        try:
            product.symlink_to(external)
        except OSError:
            if os.name != "nt":
                raise
            # Windows permits directory junctions without Developer Mode. Exercise
            # the actual resolved-path guard rather than waiving the escape case.
            product.parent.rmdir()  # The only file was removed above; nonrecursive.
            external_dir = self.base / "external-directory"
            external_dir.mkdir()
            external = external_dir / product.name
            external.write_text("preserve external fixture")
            quote = lambda value: "'" + str(value).replace("'", "''") + "'"
            command = f"New-Item -ItemType Junction -Path {quote(product.parent)} -Target {quote(external_dir)} | Out-Null"
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", command], check=True, capture_output=True)
        failures, products, _ = RESEARCH.path_guards(self.repo, self.sha, self.item, ".jekyll-cache/visual-qa/fixture")
        self.assertTrue(failures)
        self.assertEqual(products, [])
        self.assertEqual(external.read_text(), "preserve external fixture")

    def test_invalid_result_schema_cannot_be_promoted(self):
        for mode in ("schema", "unbound-evidence", "omitted-gate", "false-changes", "qualified", "invalid-jsonl"):
            with self.subTest(mode=mode):
                directory, receipt = self.run_fixture(mode)
                self.assertEqual(receipt["status"], "guarded-failure")
                self.assertTrue((directory / "MANIFEST.json").is_file())
                # Explicit operator review of this isolated fixture, never automatic runner recovery.
                blocked = RESEARCH.common_dir(self.repo) / "coastal-research-BLOCKED.json"
                blocked.unlink()

    def test_out_of_lease_ignored_native_and_commit_writes_are_caught(self):
        for mode in ("outside", "ignored-native", "commit"):
            with self.subTest(mode=mode):
                _, receipt = self.run_fixture(mode)
                self.assertEqual(receipt["status"], "guarded-failure")
                self.assertTrue(receipt["failures"])
                witness = "outside.txt" if mode == "outside" else "assets/models/home/static-light-field.json" if mode == "ignored-native" else "HEAD changed"
                self.assertTrue(any(witness in value for value in receipt["failures"]), receipt["failures"])
                (RESEARCH.common_dir(self.repo) / "coastal-research-BLOCKED.json").unlink()

    def test_main_ref_change_is_caught_without_reset_or_rollback(self):
        _, receipt = self.run_fixture("ref-change")
        self.assertEqual(receipt["status"], "guarded-failure")
        self.assertNotEqual(receipt["refs_before"], receipt["refs_after"])
        self.assertEqual(self.git("rev-parse", "main"), self.git("rev-parse", f"{self.sha}~1"))

    def test_process_timeout_is_bounded(self):
        result = RESEARCH.process([sys.executable, str(self.fake), "sleep"], "fixture", self.base, self.base / "stdout", self.base / "stderr", 0.2)
        self.assertTrue(result["timed_out"])
        self.assertTrue(result["tree_stop_confirmed"])
        self.assertLess(result["wall_seconds"], 5)

    def test_children_cannot_outlive_successful_process(self):
        marker = self.base / "orphan-marker"
        result = RESEARCH.process([sys.executable, str(self.fake), f"orphan:{marker}"], "fixture", self.base, self.base / "stdout", self.base / "stderr", 2)
        self.assertEqual(result["returncode"], 0)
        self.assertTrue(result["tree_stop_confirmed"])
        time.sleep(1.15)
        self.assertFalse(marker.exists(), "owned child escaped the process job/group")

    def test_immediate_child_cannot_race_delayed_windows_job_assignment(self):
        marker = self.base / "immediate-child-marker"
        spawned = Path(str(marker) + "-spawned")
        original = RESEARCH.WindowsJob.assign
        testcase = self
        def delayed_assign(job, child):
            time.sleep(0.4)
            testcase.assertFalse(spawned.exists(), "target started before the Job's stdin gate opened")
            return original(job, child)
        with patch.object(RESEARCH.WindowsJob, "assign", delayed_assign) if os.name == "nt" else nullcontext():
            result = RESEARCH.process([sys.executable, str(self.fake), f"early-child:{marker}"], "fixture", self.base, self.base / "stdout", self.base / "stderr", 3)
        self.assertEqual(result["returncode"], 0)
        self.assertTrue(result["tree_stop_confirmed"])
        self.assertTrue(spawned.is_file(), "control never actually spawned its immediate child")
        time.sleep(1.15)
        self.assertFalse(marker.exists(), "immediate child escaped the assigned Job/process group")

    def test_failed_and_timed_out_iterations_keep_usage_as_reported(self):
        for mode in ("exit-with-usage", "sleep-with-usage", "turn-failed-with-usage", "invalid-jsonl-with-usage"):
            with self.subTest(mode=mode):
                directory, receipt = self.run_fixture(mode, max_seconds=2)
                self.assertEqual(receipt["status"], "guarded-failure")
                row = receipt["iterations"][0]
                self.assertEqual(row["usage_as_reported"], [{"input_tokens": 11, "cached_input_tokens": 3, "output_tokens": 5}])
                self.assertEqual(row["events"]["usage_events"][0]["event_type"], "turn.completed")
                self.assertTrue((directory / "iteration-01-stdout.jsonl").is_file())
                self.assertIn("finished", row)
                (RESEARCH.common_dir(self.repo) / "coastal-research-BLOCKED.json").unlink()

    def test_partial_and_invalid_utf8_events_do_not_erase_prior_usage(self):
        events = self.base / "events.jsonl"
        valid = json.dumps({"type": "turn.completed", "usage": {"output_tokens": 7}}).encode()
        events.write_bytes(valid + b'\n{"type":"turn.failed"}\n{"partial":\xff')
        report = RESEARCH.jsonl_report(events)
        self.assertEqual(report["usage_as_reported"], [{"output_tokens": 7}])
        self.assertGreaterEqual(len(report["failures"]), 3)

    def test_actual_timeout_receipt_and_lock_are_retained_safely(self):
        # A synthetic timeout avoids even one model invocation.
        def timeout(command, prompt, cwd, stdout, stderr, seconds):
            stdout.write_text("")
            stderr.write_text("fixture timeout")
            return {"returncode": -1, "timed_out": True, "tree_stop_confirmed": False}
        with patch.object(RESEARCH, "process", side_effect=timeout):
            directory, receipt = self.run_fixture()
        self.assertEqual(receipt["status"], "guarded-failure")
        self.assertTrue((directory / "receipt.json").is_file())
        self.assertTrue((RESEARCH.common_dir(self.repo) / "coastal-research-runner.lock").exists())

    def test_discovery_never_calls_cli_and_does_not_rewrite_queue(self):
        original = copy.deepcopy(self.queue)
        def fetch(url, hosts):
            return {"url": url, "review": "metadata-discovered", "sha256": "0" * 64, "method_reviewed": False, "renderer_qualified": False}
        with patch.object(RESEARCH, "cli_info") as cli, patch.object(RESEARCH, "process") as process:
            directory, receipt = RESEARCH.discover(self.repo, self.queue, self.state, fetch=fetch)
            cli.assert_not_called()
            process.assert_not_called()
        self.assertEqual(self.queue, original)
        self.assertEqual(receipt["status"], "discovered")
        self.assertFalse(receipt["sources"][0]["method_reviewed"])
        self.assertTrue((directory / "MANIFEST.json").is_file())

    def test_discovery_stops_on_unknown_failure_and_preserves_receipt(self):
        with patch.object(RESEARCH, "fetch_source"):
            def fail(url, hosts):
                raise RuntimeError("fixture network failure")
            directory, receipt = RESEARCH.discover(self.repo, self.queue, self.state, fetch=fail)
        self.assertEqual(receipt["status"], "failed")
        self.assertEqual(len(receipt["failures"]), 1)
        self.assertTrue((directory / "receipt.json").is_file())


if __name__ == "__main__":
    unittest.main()
