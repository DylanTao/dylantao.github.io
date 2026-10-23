import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { planetPositions } from "../assets/js/home-scene/planets.mjs";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/planet-horizons.json", import.meta.url)));
test("planet positions and brightness agree with 20 seasonal JPL Horizons references", () => {
  for (const reference of fixture.references) {
    const p = planetPositions(Date.parse(reference.utc)).find((p) => p.name === reference.name);
    const ra = Math.abs(((p.ra - reference.ra + 540) % 360) - 180) * Math.cos((reference.dec * Math.PI) / 180);
    const separation = Math.hypot(ra, p.dec - reference.dec);
    assert.ok(separation < 0.25, `${reference.name} ${reference.utc}: ${separation} degrees`);
    assert.ok(Math.abs(p.magnitude - reference.magnitude) < 0.2, `${reference.name}: magnitude ${p.magnitude} vs ${reference.magnitude}`);
    assert.ok(Math.abs(Math.hypot(...p.direction) - 1) < 1e-12);
  }
});
test("ephemeris refuses dates outside the fit and is deterministic", () => {
  assert.deepEqual(planetPositions(Date.parse("2101-01-01")), []);
  assert.deepEqual(planetPositions(1.78e12), planetPositions(1.78e12));
});
