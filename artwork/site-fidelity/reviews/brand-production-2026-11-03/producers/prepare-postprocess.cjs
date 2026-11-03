const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { PurgeCSS } = require("purgecss");
const root = process.cwd(),
  q = __dirname,
  out = path.join(q, "brand-checkpoint"),
  built = path.join(out, "site/al-folio");
const old = require(path.join(out, "previous-purgecss.cjs")),
  current = require(path.join(root, "purgecss.config.js"));
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
(async () => {
  const reports = [];
  for (const [label, config] of [
    ["previous", old],
    ["corrected", current],
  ]) {
    const results = await new PurgeCSS().purge({
      ...config,
      content: ["**/*.html", "**/*.js", "**/*.mjs"].map((g) => path.join(built, g).replaceAll("\\", "/")),
      css: [path.join(built, "assets/css/*.css").replaceAll("\\", "/")],
      skippedContentGlobs: [path.join(built, "assets/**/*.html").replaceAll("\\", "/")],
      rejected: true,
    });
    const rows = [];
    for (const r of results) {
      const name = path.basename(r.file),
        dest = path.join(out, label, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, r.css);
      rows.push({
        file: name,
        bytes: Buffer.byteLength(r.css),
        sha256: hash(r.css),
        brandStateRules: (r.css.match(/data-brand-state/g) || []).length,
        rejected: r.rejected,
      });
    }
    reports.push({ label, rows });
  }
  const css = reports.map((r) => r.rows.find((x) => x.file === "main.css"));
  if (css[0].brandStateRules !== 0 || css[1].brandStateRules < 10) throw Error("The actual deployment failure/control was not reproduced");
  for (const file of fs.readdirSync(path.join(out, "corrected")))
    fs.copyFileSync(path.join(out, "corrected", file), path.join(built, "assets/css", file));
  fs.writeFileSync(
    path.join(out, "POSTPROCESS.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        purgecssVersion: require("purgecss/package.json").version,
        scope:
          "Same complete fresh island production output with previous vs corrected actual publisher CSS cleanup, all HTML/JS/MJS scanned; no source/module/GLB substitutions or omitted scene assets. Only produced CSS copied to this private preview.",
        reports,
      },
      null,
      2
    ) + "\n"
  );
  console.log(JSON.stringify({ mainCss: css.map(({ rejected, ...v }) => ({ ...v, rejectedCount: rejected.length })) }));
})().catch((e) => {
  fs.writeFileSync(path.join(out, "FAILURE.json"), JSON.stringify({ error: String(e) }, null, 2));
  console.error(e);
  process.exitCode = 1;
});
