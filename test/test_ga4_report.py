"""Offline contract checks for the private, read-only GA4 reporting utility."""

from contextlib import redirect_stderr, redirect_stdout
from datetime import date
from importlib.util import module_from_spec, spec_from_file_location
from io import StringIO
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location("ga4_report", ROOT / "bin/ga4_report.py")
ga4 = module_from_spec(SPEC)
SPEC.loader.exec_module(ga4)


def page(values, count, metadata=None):
    return {
        "dimensionHeaders": [{"name": "pagePath"}],
        "metricHeaders": [{"name": "screenPageViews", "type": "TYPE_INTEGER"}],
        "rows": [
            {"dimensionValues": [{"value": value}], "metricValues": [{"value": "3"}]}
            for value in values
        ],
        "rowCount": count,
        "metadata": metadata or {},
        "propertyQuota": {"tokensPerHour": {"remaining": 120}},
    }


class PlanTests(unittest.TestCase):
    def test_offline_plan_runs_without_site_packages_or_credentials(self):
        result = subprocess.run(
            [sys.executable, "-I", "-S", str(ROOT / "bin/ga4_report.py"), "--plan", "--property-id", "467687350", "--end", "2026-10-01"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertEqual(plan["property"], "properties/467687350")
        self.assertEqual(len(plan["reports"]), 8)
        self.assertNotIn("private_key", result.stdout)

    def test_every_report_filters_exact_production_hostname(self):
        plan = ga4.build_plan("467687350", "2026-07-01", "2026-09-28")
        prohibited = {"pageLocation", "pagePathPlusQueryString", "landingPagePlusQueryString", "searchTerm", "pageReferrer", "linkUrl", "linkText", "city"}
        for report in plan["reports"]:
            request = report["request"]
            self.assertEqual(request["dimensionFilter"]["andGroup"]["expressions"][0], ga4.exact_filter("hostName", "dylantao.github.io"))
            self.assertFalse(prohibited.intersection(item["name"] for item in request["dimensions"]))
            self.assertTrue(request["returnPropertyQuota"])
        self.assertEqual(plan["scope"], "https://www.googleapis.com/auth/analytics.readonly")

    def test_resource_reports_use_existing_event_definitions(self):
        reports = {item["name"]: item["request"] for item in ga4.build_plan("1", "2026-07-01", "2026-09-28")["reports"]}
        self.assertIn(ga4.exact_filter("eventName", "file_download"), reports["downloads"]["dimensionFilter"]["andGroup"]["expressions"])
        self.assertIn(ga4.exact_filter("outbound", "true"), reports["outbound_domains"]["dimensionFilter"]["andGroup"]["expressions"])

    def test_default_window_has_ninety_inclusive_days_and_buffer(self):
        start, end = ga4.date_window(None, None, 90, today=date(2026, 10, 24))
        self.assertEqual(end, "2026-10-22")
        self.assertEqual((date.fromisoformat(end) - date.fromisoformat(start)).days + 1, 90)

    def test_invalid_dates_ranges_and_ids_fail_without_echoing_values(self):
        for start, end, days in ((None, "2026-10-23", 90), ("2026-10-22", "2026-10-01", 90), (None, "bad-secret", 90), (None, "20261001", 90), (None, None, 367)):
            with self.assertRaises(ga4.ReportError) as error:
                ga4.date_window(start, end, days, today=date(2026, 10, 24))
            self.assertNotIn("bad-secret", str(error.exception))
        for identifier in ("G-L4SQ3C88KH", "properties/123", "0", True, "123&secret=example", None):
            with self.assertRaises(ga4.ReportError):
                ga4.property_id(identifier)

    def test_private_paths_reject_public_paths_traversal_and_root(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.assertEqual(ga4.private_path(".codex/local/analytics/reports/new", root), root / ".codex/local/analytics/reports/new")
            for path in ("assets/report.json", ".codex/local/analytics/../../public.json", ".codex/local/analytics"):
                with self.assertRaises(ga4.ReportError):
                    ga4.private_path(path, root)

    def test_gitignore_is_required_before_authentication(self):
        result = Mock(returncode=1)
        with patch.object(ga4.subprocess, "run", return_value=result), self.assertRaises(ga4.ReportError):
            ga4.assert_ignored(ROOT / ".codex/local/analytics/config.json")


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.request = {
            "dimensions": [{"name": "pagePath"}],
            "metrics": [{"name": "screenPageViews"}],
            "limit": "2",
        }

    def test_pagination_preserves_each_pages_quality_metadata(self):
        metadata = {"subjectToThresholding": True, "dataLossFromOtherRow": True, "samplingMetadatas": [{"samplesReadCount": "10", "samplingSpaceSize": "50"}], "timeZone": "America/Los_Angeles"}
        with patch.object(ga4, "api_request", side_effect=[page(["/", "/cv/"], 3, metadata), page(["/research/"], 3)]) as api:
            result = ga4.fetch_report(Mock(), "properties/467687350", self.request)
        self.assertEqual([call.args[3]["offset"] for call in api.call_args_list], ["0", "2"])
        self.assertEqual(len(result["rows"]), 3)
        self.assertTrue(result["complete"])
        self.assertEqual(result["pages"][0]["metadata"], metadata)
        self.assertEqual(result["pages"][1]["propertyQuota"]["tokensPerHour"]["remaining"], 120)
        self.assertNotIn("offset", self.request)

    def test_empty_report_is_complete_and_retains_empty_reason(self):
        with patch.object(ga4, "api_request", return_value=page([], 0, {"emptyReason": "NO_DATA"})):
            result = ga4.fetch_report(Mock(), "properties/1", self.request)
        self.assertEqual(result["rowCount"], 0)
        self.assertEqual(result["pages"][0]["metadata"]["emptyReason"], "NO_DATA")

    def test_missing_repeated_or_changing_pages_fail_closed(self):
        cases = (
            [page(["/"], 2), page([], 2)],
            [page(["/"], 2), page(["/"], 2)],
            [page(["/"], 2), page(["/cv/"], 3)],
        )
        for pages in cases:
            with self.subTest(pages=pages), patch.object(ga4, "api_request", side_effect=pages), self.assertRaises(ga4.ReportError):
                ga4.fetch_report(Mock(), "properties/1", self.request)

    def test_unexpected_headers_and_unbounded_rows_fail_closed(self):
        wrong_headers = page([], 0)
        wrong_headers["metricHeaders"] = [{"name": "privateUnexpectedField"}]
        for response in (wrong_headers, page([], ga4.MAX_ROWS + 1)):
            with patch.object(ga4, "api_request", return_value=response), self.assertRaises(ga4.ReportError):
                ga4.fetch_report(Mock(), "properties/1", self.request)

    def test_schema_compatibility_checks_only_selected_fields(self):
        request = {"dimensions": [], "metrics": [{"name": "sessions"}], "dimensionFilter": {}}
        response = {
            "dimensionCompatibilities": [{"dimensionMetadata": {"apiName": "unselected"}, "compatibility": "INCOMPATIBLE"}],
            "metricCompatibilities": [{"metricMetadata": {"apiName": "sessions"}, "compatibility": "COMPATIBLE"}],
        }
        with patch.object(ga4, "api_request", return_value=response):
            ga4.check_compatibility(Mock(), "properties/1", request)
        response["metricCompatibilities"][0]["compatibility"] = "INCOMPATIBLE"
        with patch.object(ga4, "api_request", return_value=response), self.assertRaises(ga4.ReportError):
            ga4.check_compatibility(Mock(), "properties/1", request)

    def test_provider_error_bodies_and_transport_secrets_are_not_echoed(self):
        marker = "SYNTHETIC_PRIVATE_TOKEN_DO_NOT_PRINT"
        response = Mock(status_code=403)
        response.json.return_value = {"error": {"message": marker}}
        session = Mock()
        session.post.return_value = response
        with self.assertRaises(ga4.ReportError) as error:
            ga4.api_request(session, "properties/1", "runReport", {})
        self.assertNotIn(marker, str(error.exception))
        response.json.assert_not_called()
        session.post.side_effect = RuntimeError(marker)
        with self.assertRaises(ga4.ReportError) as error:
            ga4.api_request(session, "properties/1", "runReport", {})
        self.assertNotIn(marker, str(error.exception))

    def test_unexpected_auth_exception_is_bounded_and_does_not_write(self):
        marker = "SYNTHETIC_PRIVATE_KEY_DO_NOT_PRINT"
        stdout, stderr = StringIO(), StringIO()
        with patch.object(ga4, "load_config", return_value={}), patch.object(ga4, "assert_ignored"), patch.object(ga4, "authenticated_session", side_effect=RuntimeError(marker)), patch.object(Path, "exists", return_value=False), patch.object(Path, "mkdir") as mkdir, redirect_stdout(stdout), redirect_stderr(stderr):
            result = ga4.main(["--property-id", "467687350", "--end", "2026-10-01"])
        self.assertEqual(result, 2)
        self.assertNotIn(marker, stdout.getvalue() + stderr.getvalue())
        mkdir.assert_not_called()

    def test_authentication_uses_only_readonly_scope_and_google_token_endpoint(self):
        factory = Mock(return_value=object())
        authorized = Mock(return_value=Mock())
        modules = {
            "google.auth.transport.requests": SimpleNamespace(AuthorizedSession=authorized),
            "google.oauth2": SimpleNamespace(service_account=SimpleNamespace(Credentials=SimpleNamespace(from_service_account_info=factory))),
        }
        info = {"type": "service_account", "token_uri": "https://oauth2.googleapis.com/token", "private_key": "SYNTHETIC_KEY"}
        with patch.dict(sys.modules, modules), patch.object(Path, "read_text", return_value=json.dumps(info)):
            ga4.authenticated_session(Path("synthetic.json"))
        self.assertEqual(factory.call_args.kwargs, {"scopes": [ga4.SCOPE]})
        factory.reset_mock()
        info["token_uri"] = "https://example.com/steal-token"
        with patch.dict(sys.modules, modules), patch.object(Path, "read_text", return_value=json.dumps(info)), self.assertRaises(ga4.ReportError):
            ga4.authenticated_session(Path("synthetic.json"))
        factory.assert_not_called()

    def test_report_failure_does_not_write_a_partial_snapshot(self):
        stdout, stderr = StringIO(), StringIO()
        with patch.object(ga4, "load_config", return_value={}), patch.object(ga4, "assert_ignored"), patch.object(ga4, "authenticated_session", return_value=Mock()), patch.object(ga4, "check_compatibility"), patch.object(ga4, "fetch_report", side_effect=[{}, ga4.ReportError("Incomplete report.")]), patch.object(Path, "exists", return_value=False), patch.object(Path, "mkdir") as mkdir, redirect_stdout(stdout), redirect_stderr(stderr):
            result = ga4.main(["--property-id", "467687350", "--end", "2026-10-01"])
        self.assertEqual(result, 2)
        mkdir.assert_not_called()

    def test_transport_rejects_nonreporting_or_custom_endpoints(self):
        session = Mock()
        for resource, method in (("properties/1", "create"), ("https://example.com/", "runReport"), ("properties/1?secret=x", "runReport")):
            with self.assertRaises(ga4.ReportError):
                ga4.api_request(session, resource, method, {})
        session.post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
