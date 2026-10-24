// Offline native-QA input: sample the same route, rounding, hover and settling
// used by the real world companion. No path search runs in the browser.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { roomRoute } from "../assets/js/home-scene/navigation.mjs";
import { createPipClearanceFlight, samplePipClearanceFlight } from "../assets/js/companion/clearance.mjs";
import { beachPoint } from "../assets/js/home-scene/shore.mjs";

const [manifest = "assets/models/home/manifest.json", output = ".jekyll-cache/companion-flights.jsonl"] = process.argv.slice(2);
const bytes = readFileSync(manifest),
  config = JSON.parse(bytes),
  unavailable = new Set(config.companion.unavailableRooms || []),
  rooms = config.rooms.filter((room) => !unavailable.has(room.id)),
  perches = config.companion.perches,
  hover = (id) => config.companion.hover[id] || 0.72;
mkdirSync(dirname(resolve(output)), { recursive: true });
const runtimeSha256 = {};
for (const path of ["home-scene/navigation.mjs", "home-scene/companion.mjs", "companion/clearance.mjs", "companion/performance.mjs"])
  runtimeSha256[path] = createHash("sha256")
    .update(readFileSync(new URL(`../assets/js/${path}`, import.meta.url)))
    .digest("hex");
writeFileSync(
  output,
  JSON.stringify({ type: "context", manifestSha256: createHash("sha256").update(bytes).digest("hex"), runtimeSha256, timeStride: 0.005 }) + "\n"
);
let flights = 0,
  samples = 0;
function record(id, points, startHover, endHover) {
  const flight = createPipClearanceFlight(points, startHover, endHover, { config }),
    centers = [];
  const at = (time) => {
    const pose = samplePipClearanceFlight(flight, time);
    centers.push([pose.position[0], pose.position[1] + pose.hover + pose.lift, pose.position[2]]);
  };
  for (let time = 0; time < flight.duration; time += 0.005) at(time);
  at(flight.duration);
  appendFileSync(output, JSON.stringify({ type: "flight", id, points, centers }) + "\n");
  flights++;
  samples += centers.length;
}
for (const from of rooms)
  for (const to of rooms)
    for (const [a, start] of perches[from.id].entries())
      for (const [b, end] of perches[to.id].entries()) {
        if (from.id === to.id) {
          if (a !== b) record(`wander:${from.id}:${a}:${b}`, [start, end], hover(from.id), hover(to.id));
          continue;
        }
        const route = roomRoute(config, from, to, start, { companion: true });
        record(`${from.id}:${a}->${to.id}:${b}`, [...route.points.slice(0, -1), end], hover(from.id), hover(to.id));
      }
const lounge = rooms.find((room) => room.id === "lounge"),
  coast = perches.lounge[0],
  beach = beachPoint(6, 0.35, config.beach),
  approach = config.companion.beachApproach || [
    [3.4, 0, -4.4],
    [3.8, 0, -7.4],
    [3.8, -5.8, -10.5],
  ];
for (const from of rooms)
  for (const [index, start] of perches[from.id].entries()) {
    const route = roomRoute(config, from, lounge, start, { companion: true }),
      points = [...route.points.slice(0, -1), coast, ...approach, beach];
    record(`beach-out:${from.id}:${index}`, points, hover(from.id), 0.72);
    record(`beach-return:${from.id}:${index}`, points.toReversed(), 0.72, hover(from.id));
  }
console.log(JSON.stringify({ output, flights, samples }));
