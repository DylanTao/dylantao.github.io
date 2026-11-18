import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("site_analytics_report", ROOT / "bin" / "site_analytics_report.py")
report = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(report)


class SiteAnalyticsReportTest(unittest.TestCase):
    def test_every_request_is_filtered_to_the_real_site_and_covers_whole_days(self) -> None:
        body = report.report_body(28, metrics=("activeUsers",), host="dylantao.github.io")
        self.assertEqual(body["dimensionFilter"]["filter"]["fieldName"], "hostName")
        self.assertEqual(body["dimensionFilter"]["filter"]["stringFilter"]["value"], "dylantao.github.io")
        self.assertEqual(body["dateRanges"], [{"startDate": "28daysAgo", "endDate": "yesterday"}])
        self.assertEqual(report.report_body(28, offset=1)["dateRanges"], [{"startDate": "56daysAgo", "endDate": "29daysAgo"}])
        ordered = report.report_body(7, dimensions=("pagePath",), metrics=("screenPageViews",), order="screenPageViews", limit=5)
        self.assertEqual(ordered["orderBys"][0]["metric"]["metricName"], "screenPageViews")
        self.assertEqual(ordered["limit"], 5)
        self.assertNotIn("limit", report.report_body(7))

    def test_a_response_becomes_rows_with_numbers(self) -> None:
        response = {
            "dimensionHeaders": [{"name": "pagePath"}],
            "metricHeaders": [{"name": "screenPageViews"}],
            "rows": [{"dimensionValues": [{"value": "/cv/"}], "metricValues": [{"value": "12"}]}],
        }
        self.assertEqual(report.rows(response), [{"pagePath": "/cv/", "screenPageViews": 12.0}])
        self.assertEqual(report.rows({}), [])

    def test_collect_asks_for_both_periods_and_every_report(self) -> None:
        asked = []

        def run(body):
            asked.append(body)
            return {}

        data = report.collect(run, 28)
        self.assertEqual(len(asked), 2 + len(report.REPORTS))
        self.assertTrue(all(body["dimensionFilter"] == report.host_filter() for body in asked))
        self.assertEqual(set(data), {"current", "previous", *report.REPORTS})

    def test_the_summary_compares_with_the_period_before(self) -> None:
        data = {
            "current": [{"activeUsers": 120.0, "sessions": 150.0, "screenPageViews": 300.0, "engagementRate": 0.4, "averageSessionDuration": 150.0}],
            "previous": [{"activeUsers": 100.0, "sessions": 150.0, "screenPageViews": 200.0, "engagementRate": 0.5, "averageSessionDuration": 100.0}],
            "pages": [{"pagePath": "/cv/", "screenPageViews": 20.0, "activeUsers": 10.0, "userEngagementDuration": 1650.0}],
            "channels": [{"sessionDefaultChannelGroup": "AI Assistant", "sessions": 24.0, "engagementRate": 0.55}],
            "devices": [{"deviceCategory": "desktop", "activeUsers": 110.0, "engagementRate": 0.37, "averageSessionDuration": 140.0}],
            "landing": [{"landingPage": "/", "sessions": 90.0, "engagementRate": 0.3}],
        }
        text = report.summarise(data, 28, host="dylantao.github.io", today="2026-11-17")
        self.assertTrue(text.startswith("# dylantao.github.io: the last 28 days, to yesterday (read 2026-11-17)"))
        self.assertIn("- Visitors: 120 (+20% on the 28 days before)", text)
        self.assertIn("- Engaged visits: 40% (-20% on the 28 days before)", text)
        self.assertIn("- /cv/: 20 views, 10 visitors, 165 s each", text)
        self.assertIn("- AI Assistant: 24, 55%", text)
        self.assertIn("- desktop: 110, 37%, 140 s", text)
        self.assertEqual(report.change(5.0, 0.0), "new")
        self.assertIn("- Visitors: 0 (new on the 7 days before)", report.summarise({}, 7))

    def test_it_never_writes_visitor_data_into_the_public_repository(self) -> None:
        for inside in (ROOT, ROOT / "_data", ROOT / "assets" / "deep"):
            with self.assertRaises(SystemExit):
                report.output_dir(str(inside))
        elsewhere = ROOT.parent / "site-analytics-elsewhere"
        self.assertEqual(report.output_dir(str(elsewhere)), elsewhere.resolve())

    def test_a_recent_summary_is_reused_without_asking_analytics(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, "latest.md").write_text("# last week\n", encoding="utf-8")
            printed = io.StringIO()
            with contextlib.redirect_stdout(printed):
                self.assertEqual(report.main(["--out", folder, "--if-older-than", "7"]), 0)
            self.assertEqual(printed.getvalue(), "# last week\n")


if __name__ == "__main__":
    unittest.main()
