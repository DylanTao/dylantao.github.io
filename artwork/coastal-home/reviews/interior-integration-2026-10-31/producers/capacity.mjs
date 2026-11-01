import fs from "node:fs";
import { createLightInstallations, MAX_LINES, MAX_POINTS, roomLightSources } from "../../../assets/js/home-scene/light-installations.mjs";
const root = new URL("../../../", import.meta.url),
  q = new URL(".", import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL("assets/models/home/manifest.json", root), "utf8"));
const before = JSON.parse(fs.readFileSync(new URL("baseline-manifest.json", q), "utf8"));
const cache = JSON.parse(fs.readFileSync(new URL("assets/models/home/static-light-field.json", root), "utf8"));
const lights = createLightInstallations(config);
try {
  const receiverPacks = lights.evidence().receiverPacks;
  for (const pack of Object.values(receiverPacks)) if (pack.lines > MAX_LINES || pack.points > MAX_POINTS) throw Error("Receiver capacity exceeded");
  const fixture = lights.lines.find((l) => l.source === "private-living-reading-lantern");
  if (!fixture || fixture.transport !== false) throw Error("Reading line must remain direct-only");
  const transport = roomLightSources(config),
    oldTransport = roomLightSources(before),
    channels = JSON.parse(cache.configuration).practicalSources.length;
  if (JSON.stringify(transport) !== JSON.stringify(oldTransport) || channels !== 28) throw Error("Original transport channels changed");
  if (cache.transport.length !== cache.probes.length * (channels + 3) * 12) throw Error("Unexpected SH layout");
  const result = {
    method: "Actual final runtime pack construction, original transport-source equality and official cache readback",
    limits: { lines: MAX_LINES, points: MAX_POINTS },
    receiverPacks,
    practicalChannels: channels,
    probes: cache.probes.length,
    authoredTransportSourcesExact: true,
    directOnlyReadingLine: true,
    statistics: cache.statistics,
  };
  fs.writeFileSync(new URL("capacity.json", q), JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      packs: Object.fromEntries(Object.entries(receiverPacks).map(([n, p]) => [n, [p.lines, p.points]])),
      channels,
      probes: cache.probes.length,
    })
  );
} finally {
  lights.dispose();
}
