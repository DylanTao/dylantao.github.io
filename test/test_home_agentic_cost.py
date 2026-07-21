import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class HomeAgenticCostContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.layout = (ROOT / "_layouts" / "home.liquid").read_text(encoding="utf-8")
        cls.styles = (ROOT / "_sass" / "_home.scss").read_text(encoding="utf-8")
        cls.ledger_doc = (ROOT / "docs" / "agentic-usage-ledger.md").read_text(encoding="utf-8")
        cls.ledger_skill = (ROOT / ".codex" / "skills" / "agentic-usage-ledger" / "SKILL.md").read_text(encoding="utf-8")

    def test_price_replay_is_bound_only_to_the_site_build_label(self):
        self.assertIn(
            "{% assign total_cost_label = agentic_usage.total.api_cost_equivalence.usd_label %}",
            self.layout,
        )
        self.assertNotIn("combined_lifetime.api_cost", self.layout)
        self.assertNotIn("direct_tracker.api_cost", self.layout)
        self.assertEqual(self.layout.count('class="home-agentic-stat"'), 4)

        cost_block = re.search(
            r'{% if total_cost_label %}(.*?id="home-agentic-cost-tooltip".*?){% endif %}',
            self.layout,
            re.DOTALL,
        )
        self.assertIsNotNone(cost_block)
        cost_copy = cost_block.group(1)
        self.assertIn('data-affordance="cost-estimate"', cost_copy)
        self.assertIn('aria-label="Show the site-build API-rate comparison"', cost_copy)
        self.assertRegex(cost_copy, r'<svg[^>]+class="home-agentic-cost-mark"[^>]+aria-hidden="true"')
        self.assertIn("{{ total_cost_label }}", cost_copy)
        self.assertIn("retained site-build logs", cost_copy)
        self.assertIn("Standard public-API rates", cost_copy)
        self.assertIn("Not an actual Codex bill", cost_copy)
        self.assertIn("cache-write tokens", cost_copy)
        self.assertIn("sam-money-altman.png", cost_copy)
        self.assertRegex(cost_copy, r'<img[^>]+alt=""')

    def test_lifetime_heartbeat_has_no_price_language_or_control(self):
        heartbeat = self.layout.split("{% assign direct_tracker", 1)[1]
        heartbeat = heartbeat.split("</a>", 1)[0]
        self.assertNotRegex(heartbeat, r"(?i)invoice|public-api|api-rate|cost|\$")
        self.assertNotIn("home-agentic-info-cost", heartbeat)

    def test_cost_tooltip_has_zoom_and_narrow_view_containment(self):
        self.assertIn("max-height: calc(100vh - 2rem);", self.styles)
        self.assertIn("overflow-y: auto;", self.styles)
        self.assertIn("overflow-wrap: anywhere;", self.styles)
        self.assertIn("@media (max-width: 24rem)", self.styles)
        self.assertTrue((ROOT / "assets" / "img" / "home" / "sam-money-altman.png").is_file())

    def test_guidance_keeps_four_cells_and_retires_the_tree_headline(self):
        for source in (self.ledger_doc, self.ledger_skill):
            self.assertIn("four compact stat cells", source)
            self.assertIn("former tree-sacrifice headline", source)
            self.assertIn("combined-lifetime", source)
        self.assertIn("total.api_cost_equivalence.usd_label", self.ledger_doc)
        self.assertIn("total.api_cost_equivalence.usd_label", self.ledger_skill)
        self.assertIn("price-replay disclosure", self.ledger_doc)
        self.assertIn("price-replay disclosure", self.ledger_skill)


if __name__ == "__main__":
    unittest.main()
