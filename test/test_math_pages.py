from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_INCLUDE = REPO_ROOT / "_includes" / "scripts.liquid"
CONTENT_DIRS = ("_pages", "_posts", "_projects", "_news")

# Non-prose regions where a dollar sign or backslash is not TeX.
NON_PROSE = [
    re.compile(r"```.*?```", re.S),
    re.compile(r"~~~.*?~~~", re.S),
    re.compile(r"<(script|style|pre|code)\b.*?</\1>", re.S | re.I),
    re.compile(r"\{%-?\s*raw\s*-?%\}.*?\{%-?\s*endraw\s*-?%\}", re.S),
    re.compile(r"\{%.*?%\}", re.S),
    re.compile(r"\{\{.*?\}\}", re.S),
    re.compile(r"`[^`\n]+`"),
]
# Display math, \( \) and \[ \] delimiters, and inline $...$ that opens and closes on non-space text.
TEX = re.compile(r"\$\$|\\\(|\\\[|(?<![\\$\w])\$(?=\S)[^$\n]*?(?<=\S)\$(?!\w)")


def split_front_matter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    _, block, body = text.split("---", 2)
    return yaml.safe_load(block) or {}, body


def tex_lines(body: str) -> list[str]:
    for pattern in NON_PROSE:
        body = pattern.sub(" ", body)
    return [line.strip() for line in body.splitlines() if TEX.search(line)]


class MathPagesTests(unittest.TestCase):
    """MathJax loads only on pages that declare math (2026-10-12).

    The library is about 250 KB compressed and over 1 MB of script, and every page loaded it. The
    scripts include now requires `math: true`, `pseudocode`, or `tikzjax` in front matter; this test
    catches a page that writes TeX without declaring it.
    """

    def test_scripts_include_gates_mathjax_per_page(self) -> None:
        source = SCRIPTS_INCLUDE.read_text(encoding="utf-8")
        self.assertIn("{% if page.math or page.pseudocode or page.tikzjax %}", source)

    def test_pages_that_write_tex_declare_math(self) -> None:
        undeclared = {}
        for directory in CONTENT_DIRS:
            for path in sorted((REPO_ROOT / directory).glob("*")):
                if path.suffix not in {".md", ".html"}:
                    continue
                data, body = split_front_matter(path.read_text(encoding="utf-8"))
                if data.get("math") or data.get("pseudocode") or data.get("tikzjax"):
                    continue
                lines = tex_lines(body)
                if lines:
                    undeclared[str(path.relative_to(REPO_ROOT))] = lines[:2]
        self.assertEqual(undeclared, {}, "add `math: true` to the front matter of pages that use TeX")

    def test_the_detector_finds_tex_and_ignores_code(self) -> None:
        self.assertTrue(tex_lines("a high $R^2$ value"))
        self.assertTrue(tex_lines("$$E = mc^2$$"))
        self.assertTrue(tex_lines(r"inline \(x\) math"))
        self.assertFalse(tex_lines("it costs $5 to $10 dollars"))
        self.assertFalse(tex_lines("<script>const id = `${a}|${b}`;</script>"))
        self.assertFalse(tex_lines("```\necho $HOME $PATH\n```"))


if __name__ == "__main__":
    unittest.main()
