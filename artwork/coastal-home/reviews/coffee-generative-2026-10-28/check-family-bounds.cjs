// Run against the actual density/alpha, preserving the existing placement gate.
const path = require("node:path");
const fs = require("node:fs");
const source = process.env.COFFEE_SOURCE || path.resolve(__dirname, "../../../../assets/js/home-coffee-stain.js");
const { design, densityField, paintField } = require(source);
const rows = [];
for (let seed = 1; seed <= 64; seed++) {
  const plan = design(String(seed), 1024),
    job = densityField(plan);
  while (!job.step()) {}
  const paint = paintField(plan, job.field, "light");
  while (!paint.step()) {}
  let maxX = -Infinity,
    witness = null;
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++)
      if (paint.pixels[(y * 1024 + x) * 4 + 3] >= 8) {
        const dx = (x + 0.5) / 1024 - 0.5,
          dy = (y + 0.5) / 1024 - 0.5;
        for (const degrees of [-24, 0, 24]) {
          const angle = (degrees * Math.PI) / 180,
            value = 0.5 + 1.06 * (Math.cos(angle) * dx - Math.sin(angle) * dy);
          if (value > maxX) {
            maxX = value;
            witness = { x, y, degrees };
          }
        }
      }
  rows.push({ seed, maxX, witness });
  if (maxX > 1.0009) break;
}
const output = process.env.COFFEE_BOUNDS_OUTPUT || path.join(__dirname, "family-bounds.json");
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      scope:
        "Actual alpha >= 8 at all existing maximum rotation/scale corners. Normalized 1.0009 retains the desktop 1px tolerance at maximum x translation.",
      sourceSha256Lf: require("node:crypto").createHash("sha256").update(fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n")).digest("hex"),
      rows,
    },
    null,
    2
  ) + "\n"
);
console.log(JSON.stringify({ seeds: rows.length, maximum: Math.max(...rows.map((row) => row.maxX)), output }));
if (rows.length !== 64 || rows.some((row) => row.maxX > 1.0009)) process.exitCode = 1;
