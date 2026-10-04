const path = require("node:path");
const manifest = require("./scene-groups.json");

const caseKey = ({ file, title }) => JSON.stringify([file, title]);
const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function groupPattern(name) {
  const members = manifest.groups[name];
  if (!members) throw new Error(`Unknown scene group: ${name}`);
  return new RegExp(members.map(({ file, title }) => `(?:^|[\\s/\\\\])${escapePattern(file)}\\s+(?:.*\\s+)?${escapePattern(title)}$`).join("|"));
}

function registeredCases(report) {
  const cases = [];
  function visit(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) cases.push({ file: path.basename(spec.file), title: spec.title, project: test.projectName });
    }
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites || []) visit(suite);
  return cases;
}

function verifyInventory(registry, selections, project) {
  const cases = registry.filter((test) => test.project === project);
  const keys = cases.map(caseKey);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate unfiltered cases for ${project}`);
  const expected = Object.values(manifest.groups).flat().map(caseKey);
  if (new Set(expected).size !== expected.length) throw new Error("Duplicate scene group membership");
  const missing = keys.filter((key) => !expected.includes(key));
  const extra = expected.filter((key) => !keys.includes(key));
  if (missing.length || extra.length) throw new Error(`Scene registry mismatch for ${project}: ${JSON.stringify({ missing, extra })}`);
  const union = [];
  const counts = {};
  for (const [name, members] of Object.entries(manifest.groups)) {
    const selected = selections[name].filter((test) => test.project === project).map(caseKey);
    const wanted = members.map(caseKey);
    const missing = wanted.filter((key) => !selected.includes(key));
    const extra = selected.filter((key) => !wanted.includes(key));
    if (missing.length || extra.length || new Set(selected).size !== selected.length)
      throw new Error(`Scene group mismatch for ${project}/${name}: ${JSON.stringify({ missing, extra, selectedCount: selected.length })}`);
    counts[name] = selected.length;
    union.push(...selected);
  }
  if (union.length !== keys.length || new Set(union).size !== union.length) throw new Error(`Scene groups do not partition ${project}`);
  return { project, completeCaseCount: keys.length, groupCounts: counts, missing: 0, extra: 0, duplicates: 0 };
}

module.exports = { manifest, caseKey, groupPattern, registeredCases, verifyInventory };
