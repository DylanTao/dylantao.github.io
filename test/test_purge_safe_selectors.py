from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SASS = REPO_ROOT / "_sass"
SPOODER_SCRIPT = REPO_ROOT / "assets" / "js" / "spooder-project.js"


class PurgeSafeSelectorTests(unittest.TestCase):
    """Deploy runs PurgeCSS over the built site (purgecss.config.js); some valid CSS does not survive it."""

    def test_no_is_selector_holds_only_pseudo_classes(self) -> None:
        # PurgeCSS drops a rule such as `.a:is(:hover, :focus-visible) img` (2026-10-13), so the
        # rule works locally and silently disappears in production. Write the selectors out instead.
        offenders = []
        for path in sorted(SASS.rglob("*.scss")):
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if line.lstrip().startswith("//"):
                    continue
                for group in re.findall(r":is\(([^()]*)\)", line):
                    parts = [part.strip() for part in group.split(",") if part.strip()]
                    if parts and all(part.startswith(":") for part in parts):
                        offenders.append(f"{path.relative_to(REPO_ROOT)}:{number}")
        self.assertEqual(offenders, [])

    def test_spooder_print_attribute_is_named_literally(self) -> None:
        # The gallery's print styles key off an attribute the script adds; PurgeCSS keeps an
        # attribute selector only when its literal name appears in the scanned scripts.
        source = SPOODER_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('setAttribute("data-spooder-verse", "")', source)
        self.assertNotIn("dataset.spooderVerse", source)


if __name__ == "__main__":
    unittest.main()
