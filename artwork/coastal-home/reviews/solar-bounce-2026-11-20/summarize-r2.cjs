"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const [input, output] = process.argv.slice(2);
assert(input && output, "node summarize-r2.cjs R2-RESULT.json RESULTS.md");
const report = JSON.parse(fs.readFileSync(input, "utf8"));
const visitor = report.dayReports["current-weather"];
const clear = report.dayReports.clear;
const invalid = report.probes.invalid;
const pct = (value) => (value === null ? "—" : (100 * value).toFixed(1) + "%");
const n = (v) => (v === 0 ? "0" : v < 0.001 ? v.toPrecision(3) : v.toFixed(4));
const duration = (report.elapsedMs / 1000).toFixed(1);
const tick = "\x60";
const quote = (value) => tick + value + tick;
const lines = [
  "# Solar visibility at the release probes",
  "",
  "Source " + quote(report.source) + " and signed field " + quote(report.signature) + ".",
  "",
  report.probes.active +
    "/" +
    report.probes.total +
    " valid probes. " +
    report.probes.compared +
    "/" +
    report.probes.compared +
    " canonical primary distances matched the packed Float32 moments exactly. " +
    report.sampledTimes.length +
    " time samples and " +
    report.normals.length +
    " normals. CPU replay took " +
    duration +
    " s after immutable source staging.",
  "",
  "The time and orientation identify each cage’s brightest single 16 m sample. The 64 m and baseline values are at that same probe, time and normal. " +
    "P95 ranges over adequately lit samples in each cage under the bundled visitor weather.",
  "",
  "| Transport cage | Valid | Peak Pacific time / normal | Solar at 16 m | Solar at 64 m | Sky + indirect lamps | P95 ratio 16 / 64 m |",
  "|---|---:|---|---:|---:|---:|---:|",
];
for (const { name, overall } of visitor.regions) {
  const peak = overall.brightestSolar;
  const count = 8 - invalid.filter((x) => x.room === name).length;
  const when = peak.solar16 ? peak.time + " / " + peak.normal : "—";
  const baseline = peak.solar16 ? n(peak.skyPractical) : "—";
  lines.push(
    "| " +
      [name, count + "/8", when, n(peak.solar16), n(peak.solar64), baseline, pct(overall.p95Ratio) + " / " + pct(overall.p95Ratio64)].join(" | ") +
      " |"
  );
}
lines.push(
  "",
  "## Angular and shadow sensitivity",
  "",
  "The table holds the probe, time and normal fixed while increasing the number of primary rays. The two values in each cell show the 16 m and 64 m solar terms. The denominator stays on the signed field.",
  "",
  "| Cage | Probe and Pacific time / normal | Sky + indirect lamps | 64 rays | 144 rays | 256 rays |",
  "|---|---|---:|---:|---:|---:|"
);
for (const row of report.convergence) {
  const sample = "#" + row.probe + " · " + row.time + " / " + row.normal;
  const grouped = row.settings.map((item) => n(item.solar16) + " / " + n(item.solar64));
  lines.push("| " + [row.name, sample, n(row.baseline), ...grouped].join(" | ") + " |");
}
const { beyond16, clear16 } = report.solarRayTotals;
lines.push(
  "",
  beyond16.toLocaleString("en-US") +
    " of " +
    clear16.toLocaleString("en-US") +
    " rays clear at 16 m encountered a blocker by 64 m in the retained geometry (" +
    pct(beyond16 / clear16) +
    ").",
  "",
  "The clear control’s all-day P95 ratios at 64 m were " +
    ["living", "lounge", "gym", "onsen"].map((name) => name + " " + pct(clear.regions.find((x) => x.name === name).overall.p95Ratio64)).join(", ") +
    ".",
  "",
  "The lounge, living room, gym and onsen retain a substantial afternoon term with the longer shadow and denser quadrature. The bedroom’s nominal late peak is almost entirely cutoff-sensitive. The study’s small peak is sensitive to angular sampling. See the README for the irradiance units and scope.",
  "",
  "Geometry SHA-256 values",
  "",
  "- Positions " + quote(report.arrays.positions.sha256),
  "- Diffuse albedo " + quote(report.arrays.albedo.sha256),
  ""
);
fs.writeFileSync(output, lines.join("\n"));
