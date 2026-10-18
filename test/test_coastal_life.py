"""Placement checks for the footer coast's beach life (bin/coastal_life.py).

October 18, 2026: Sirui asked to fix intersecting geometry along the footer
(a fire ring in the surf, stairs into the sea, a hut buried in the bluff,
people standing on benches). These tests keep props on the ground, out of
each other and on dry sand, and keep the people's paths clear.
"""
from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "bin"))

import coastal_life as life  # noqa: E402
from coastal_terrain import ground_height, shoreline  # noqa: E402

MANIFEST = REPO_ROOT / "assets" / "models" / "la-jolla" / "manifest.json"


def outline(item: dict) -> list[tuple[float, float]]:
    if item["kind"] == "rect":
        return [(item["x0"], item["y0"]), (item["x1"], item["y0"]), (item["x1"], item["y1"]), (item["x0"], item["y1"])]
    if item["kind"] == "circle":
        return [(item["x"] + item["r"] * math.cos(a), item["y"] + item["r"] * math.sin(a)) for a in (i * math.tau / 20 for i in range(20))]
    return list(item["points"])


def separated(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> bool:
    """Separating-axis test for two convex outlines."""
    for poly in (a, b):
        for i, (x1, y1) in enumerate(poly):
            x2, y2 = poly[(i + 1) % len(poly)]
            nx, ny = y1 - y2, x2 - x1
            pa = [nx * x + ny * y for x, y in a]
            pb = [nx * x + ny * y for x, y in b]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return True
    return False


def distance_to(point: tuple[float, float], poly: list[tuple[float, float]]) -> float:
    px, py = point
    inside = False
    best = math.inf
    for i, (x1, y1) in enumerate(poly):
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            inside = not inside
        dx, dy = x2 - x1, y2 - y1
        u = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy or 1)))
        best = min(best, math.hypot(px - x1 - dx * u, py - y1 - dy * u))
    return 0.0 if inside else best


class CoastalLifeTests(unittest.TestCase):
    def test_props_do_not_intersect(self) -> None:
        items = life.footprints()
        for i, a in enumerate(items):
            for b in items[i + 1 :]:
                if a["group"] == b["group"]:
                    continue
                if a["z1"] <= b["z0"] or b["z1"] <= a["z0"]:
                    continue
                with self.subTest(a=a["name"], b=b["name"]):
                    self.assertTrue(separated(outline(a), outline(b)), f"{a['name']} intersects {b['name']}")

    def test_beach_props_stay_on_dry_sand(self) -> None:
        beach_groups = {"volleyball", "fire", "boards", "lifeguard"}
        for item in life.footprints():
            if item["group"] not in beach_groups and not item["name"].startswith(("parasol pole", "towel", "DIB beach stair")):
                continue
            if item["name"] == "lifeguard ramp":
                continue
            for x, y in outline(item):
                with self.subTest(item=item["name"], x=round(x, 2)):
                    self.assertGreater(y, shoreline(x) + 0.15, f"{item['name']} reaches the surf")
                    self.assertLess(y, life.beach_back(x) + 0.05, f"{item['name']} climbs into the bluff")

    def test_props_rest_on_the_ground_without_floating(self) -> None:
        for x, y in life.PARASOLS:
            self.assertAlmostEqual(life.surface_height(x, y), life.beach_height(x, y), places=6)
        for seat in life.log_seats():
            # Logs lie on the sand: their underside is at the sand, not above it.
            self.assertAlmostEqual(seat["z"], life.beach_height(seat["x"], seat["y"]), places=6)
        for x, y, angle in life.BENCHES:
            top = life.bench_seat_top(x, y, angle)
            axis, front = life.bench_frame(x, y, angle)
            feet = [life.surface_height(x + axis[0] * s * life.BENCH["foot"], y + axis[1] * s * life.BENCH["foot"]) for s in (-1, 1)]
            rest = life.surface_height(x + front[0] * 0.2, y + front[1] * 0.2)
            with self.subTest(bench=(x, y)):
                # Both feet reach the ground and the seat suits a sitter's legs.
                self.assertGreaterEqual(top - life.BENCH["thick"] - max(feet), 0.05)
                self.assertAlmostEqual(top - rest, life.BENCH["seat"], delta=0.03)
        tennis = life.TENNIS
        for x in (tennis["x"] - tennis["w"] / 2 - 0.2, tennis["x"] + tennis["w"] / 2 + 0.2):
            for y in (tennis["y"] - tennis["d"] / 2 - 0.2, tennis["y"] + tennis["d"] / 2 + 0.2):
                with self.subTest(court_corner=(x, y)):
                    self.assertLess(life.surface_height(x, y), tennis["z"], "the hillside must not poke through the court")

    def test_dib_stair_lands_on_the_sand_above_the_waterline(self) -> None:
        steps = life.dib_stair_steps()
        tops = [top for _, top in steps]
        self.assertEqual(tops, sorted(tops, reverse=True))
        self.assertLess(tops[0], life.DIB_TERRACE["top"])
        x, top = steps[-1]
        stair = life.DIB_STAIR
        sand = life.beach_height(x, stair["y0"])
        self.assertGreater(top, sand)
        self.assertLess(top - sand, 0.06)
        for xx, _ in steps:
            self.assertGreater(stair["y0"], shoreline(xx) + 0.3, "every tread stays clear of the surf")

    def test_pier_reaches_the_bluff(self) -> None:
        pier = life.PIER
        # The landing deck meets the ground instead of ending in mid-air.
        end = ground_height(pier["x"], life.PIER_LANDING["y1"])
        self.assertLess(abs(end - (pier["deck"] + 0.08)), 0.06)

    def test_walkers_keep_clear_of_props(self) -> None:
        def overhead(item: dict) -> bool:
            points = outline(item)
            cx = sum(x for x, _ in points) / len(points)
            cy = sum(y for _, y in points) / len(points)
            return item["z0"] - life.surface_height(cx, cy) > 0.7

        # Parasol canopies pass over a walker's head; everything else must keep clear.
        props = [item for item in life.footprints() if not overhead(item)]
        for name, path in (("shore", life.shore_walk()), ("bluff", life.bluff_walk())):
            for x, y, _ in path:
                for item in props:
                    with self.subTest(path=name, x=round(x, 2), item=item["name"]):
                        self.assertGreater(distance_to((x, y), outline(item)), 0.18)
        for x, y, _ in life.shore_walk():
            self.assertGreater(y, shoreline(x), "walkers stay on the sand")
            self.assertLess(y, life.beach_back(x))

    def test_figures_use_their_props(self) -> None:
        figures = {f["id"]: f for f in life.figures()}
        for i, (x, y, angle) in enumerate(life.BENCHES):
            self.assertAlmostEqual(figures[f"bench-{i}"]["seat"], life.bench_seat_top(x, y, angle))
        for seat, log in zip(figures["fire"]["seats"], life.log_seats()):
            self.assertAlmostEqual(seat["z"], log["z"] + life.LOG_THICKNESS * 2 - 0.01)
        sunbather = figures["sunbather"]
        tx, ty, _ = life.TOWELS[0]
        self.assertEqual((sunbather["x"], sunbather["y"]), (tx, ty))

    def test_manifest_matches_the_placement_module(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["figures"], life.manifest_figures(), "rebuild with bin/build_la_jolla.py after changing coastal_life.py")


if __name__ == "__main__":
    unittest.main()
