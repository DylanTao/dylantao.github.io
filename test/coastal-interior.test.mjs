// The interior pass (2026-10-20): the open kitchen, the sunken breakfast nook and the dining room, and the
// furniture anchors shared with the designed pieces. Reads the delivered manifest and GLBs, not the
// authoring scripts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { staticLightRegions } from "../assets/js/home-scene/static-light-field.mjs";
import { practicalSourcesFor } from "../assets/js/home-scene/warm-practicals.mjs";
import { supportHeight } from "../assets/js/home-scene/shore.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
const room = (id) => manifest.rooms.find((r) => r.id === id);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const inside = (p, region, pad = 0) => p.every((v, a) => v >= region.min[a] - pad && v <= region.max[a] + pad);
function glbJson(file) {
  const bytes = fs.readFileSync(new URL(`../assets/models/home/${file}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8"));
}
// The seated clips put the hips 51.5 cm over the actor and the feet 22 cm over it.
const HIPS = 0.515,
  FEET = 0.22;

const ITEMS = new Set([
  "italian-range",
  "range-hood",
  "pot-filler",
  "glass-fridge",
  "dining-table",
  "dining-chair",
  "eames-lounge",
  "aeron",
  "floating-fireplace",
  "cast-iron-pan",
  "dumbbells",
  "dumbbell",
]);

test("furniture anchors follow the shared interface", () => {
  assert.ok(Array.isArray(manifest.furniture) && manifest.furniture.length > 0);
  assert.match(manifest.furnitureFrame.yaw, /front faces \[sin\(yaw\), 0, cos\(yaw\)\]/);
  const ids = new Set(),
    rooms = new Set(manifest.rooms.map((r) => r.id));
  for (const anchor of manifest.furniture) {
    assert.ok(!ids.has(anchor.id), `${anchor.id} is unique`);
    ids.add(anchor.id);
    assert.ok(ITEMS.has(anchor.item), `${anchor.item} is an index key`);
    assert.ok(rooms.has(anchor.room), `${anchor.id} names a room`);
    assert.equal(anchor.position.length, 3);
    assert.ok(anchor.position.every(Number.isFinite) && Number.isFinite(anchor.yaw));
    // Inside the house's plan, at most a pit's depth below the ground floor.
    const native = anchor.room === "study" ? manifest.retreat?.workstationNativeTranslation || [0, 0, 0] : [0, 0, 0];
    const [x, y, z] = anchor.position.map((value, axis) => value - [native[0], native[2], -native[1] + (manifest.retreat?.setbackMetres || 0)][axis]);
    assert.ok(x > -5.3 && x < 11.5 && z > -7.8 && z < 8.5 && y > -0.5 && y < 3, `${anchor.id} stands in the house`);
  }
  for (const id of ["kitchen-range", "kitchen-range-hood", "kitchen-pot-filler", "kitchen-glass-fridge", "dining-table"]) assert.ok(ids.has(id), id);
  assert.equal(manifest.furniture.filter((a) => a.item === "dining-chair").length, 6);
});

test("every anchor keeps a placeholder in its room's GLB", () => {
  const byRoom = new Map();
  for (const anchor of manifest.furniture) {
    if (!byRoom.has(anchor.room)) byRoom.set(anchor.room, new Set());
    byRoom.get(anchor.room).add(anchor.id);
  }
  for (const [id, anchorIds] of byRoom) {
    const placeholders = new Set(
      glbJson(room(id).file)
        .nodes.map((n) => n.extras?.furniturePlaceholder)
        .filter(Boolean)
    );
    for (const anchor of anchorIds) assert.ok(placeholders.has(anchor), `${id} GLB holds the ${anchor} placeholder`);
  }
});

test("the dining room seats six around its table, chairs facing it", () => {
  const table = manifest.furniture.find((a) => a.id === "dining-table");
  const chairs = manifest.furniture.filter((a) => a.item === "dining-chair");
  for (const chair of chairs) {
    const toward = [table.position[0] - chair.position[0], table.position[2] - chair.position[2]];
    const front = [Math.sin(chair.yaw), Math.cos(chair.yaw)];
    assert.ok(front[0] * toward[0] + front[1] * toward[1] > 0, `${chair.id} faces the table`);
    const gap = Math.abs(chair.position[2] - table.position[2]);
    assert.ok(gap > 0.7 && gap < 1.0, `${chair.id} sits at the table's long side`);
  }
});

test("breakfast and every meal sit Sirui on the sunken nook's banquette, feet on the table's ring", () => {
  const kitchen = room("kitchen"),
    [x, y, z] = kitchen.actor;
  const floor = supportHeight(x, z, manifest.terrain, y);
  assert.ok(Math.abs(floor + 0.42) < 1e-6, "the actor's support is the nook floor");
  // A 46 cm banquette seat over the nook floor; the feet land 16.5 cm over it, on the foot ring.
  assert.ok(Math.abs(y + HIPS - (floor + 0.46)) < 1e-3);
  assert.ok(Math.abs(y + FEET - (floor + 0.165)) < 1e-3);
  assert.deepEqual(manifest.equipment.coffee.seat, kitchen.actor);
  assert.equal(kitchen.facing, Math.PI, "facing the sea");
  // The coffee walk climbs the nook's treads: its turning point stands on the kitchen floor.
  const way = manifest.equipment.coffee.approach[1];
  assert.equal(supportHeight(way[0], way[2], manifest.terrain, 0), 0);
});

test("the capybara print hangs on the nook's wall under its picture light", () => {
  const art = manifest.wallArt,
    light = practicalSourcesFor(manifest).find((s) => s.id === "kitchen");
  assert.ok(distance(light.position, art.light) < 0.1, "the warm practical sits at the brass picture light");
  assert.ok(art.light[1] - art.position[1] > 0.44 && distance(art.light, art.position) < 0.7, "the light is just over the frame");
  // The print faces into the room, away from the wall it hangs on.
  const front = [Math.sin(art.yaw), Math.cos(art.yaw)];
  assert.ok(front[0] > 0.99, "the print on the south wall faces north");
});

test("the light field and the kitchen's installations cover the nook and the dining room", () => {
  const region = (id) => staticLightRegions(manifest).find((r) => r.id === id);
  const kitchen = room("kitchen");
  assert.ok(inside(kitchen.actor, region("kitchen"), 0.25));
  const table = manifest.furniture.find((a) => a.id === "dining-table").position;
  assert.ok(inside([table[0], 0.8, table[2]], region("dining")));
  const lights = manifest.interiorLights;
  assert.ok(inside(lights.pendant, lights.region));
  for (const at of [...lights.downlights, ...lights.vault, ...lights.dining]) assert.ok(inside(at, lights.region));
  assert.equal(lights.dining.length, 2, "each actual saucer pendant has its own emitter");
  assert.ok(lights.dining.every((at) => Math.abs(at[2] - table[2]) < 0.1 && at[1] > table[1] + 1.4));
  assert.ok(lights.dining[0][0] < table[0] && lights.dining[1][0] > table[0], "pendants span the table");
});

test("the ground floor's walk passes behind the dining room, clear of its table", () => {
  const nav = manifest.navigation;
  const table = manifest.furniture.find((a) => a.id === "dining-table").position;
  // The table runs 1.0 m deep (z), its inland chairs 0.85 m behind its centre.
  assert.ok(nav.lowerAisleZ > table[2] + 1.4, "the aisle passes behind the inland chairs");
  assert.equal(nav.lowerStairApproach[0][2], nav.lowerAisleZ);
});

test("clifftop arrival is a connected supported stair with native capsule clearance", () => {
  const entry = manifest.entrance;
  const measured = JSON.parse(
    fs.readFileSync(new URL("../artwork/coastal-home/reviews/retreat-2026-10-24/native-contacts.json", import.meta.url), "utf8")
  );
  const contacts = measured.samples.filter((sample) => sample.route === "main-entry");
  const treads = manifest.terrain.supportSurfaces.filter((surface) => surface.id.startsWith("retreat-arrival-tread-"));
  assert.equal(entry.floor, 0, "the main arrival reaches public living directly");
  assert.equal(entry.curved, true);
  assert.equal(treads.length, 48);
  assert.ok(Math.abs(entry.riser * treads.length - entry.top) < 1e-8);
  assert.ok(
    Math.abs(entry.going - (6 * Math.PI * 0.6) / 48) < 1e-9,
    "the curved centre spacing is measured independently of its overlapping 31cm tread patches"
  );
  assert.equal(contacts.length, manifest.walk.mainEntryRoute.length);
  assert.ok(entry.stairWidth >= 1.5 && entry.riser < 0.19);
  for (const tread of contacts) {
    assert.ok(tread.headroom > 2.1);
    assert.ok(tread.floorError < 0.01);
  }
  for (const [i, tread] of treads.entries()) {
    if (i) assert.ok(Math.abs(treads[i - 1].height - tread.height - entry.riser) < 1e-5);
  }
  for (const p of entry.route) {
    assert.ok(Math.abs(supportHeight(p[0], p[2], manifest.terrain, p[1]) - p[1]) < 0.03);
  }
  assert.deepEqual(manifest.walk.mainEntryRoute[0], manifest.walk.start.position);
  assert.equal(manifest.walk.mainEntryRoute.at(-1)[1], 0);
  assert.equal(manifest.privateEntrance.route.at(-1)[1], 2.6, "the discreet separate arrival retains private onsen access");
  assert.equal(measured.passed, true, "actual native floor/headroom/body probes pass, alongside the delivered capsule suite");
});

test("living pit seats Sirui with feet on the cushion and a continuous fireplace flue", () => {
  const lounge = room("lounge"),
    floor = supportHeight(lounge.actor[0], lounge.actor[2], manifest.terrain, lounge.actor[1]);
  assert.equal(floor, -0.42);
  assert.ok(Math.abs(lounge.actor[1] + HIPS - (floor + 0.44)) < 1e-4);
  const fire = manifest.furniture.find((a) => a.id === manifest.fireplace.anchor);
  assert.equal(fire.position[1], floor);
  assert.ok(manifest.fireplace.flueTop[1] > manifest.fireplace.cap[1]);
  assert.ok(manifest.fireplace.flueStart[1] < 1.9 && manifest.fireplace.flueTop[1] > 7);
});

test("infinity basin has a supported dry approach and native water excluded from Walk", () => {
  const pool = manifest.infinityPool;
  assert.equal(pool.depth, 1.35);
  assert.deepEqual(
    pool.zones.filter((zone) => Number.isFinite(zone.depth)).map((zone) => [zone.id, zone.depth]),
    [
      ["swim", 1.35],
      ["sun-shelf", 0.22],
      ["social", 0.85],
    ]
  );
  assert.equal(pool.waterline, -0.09);
  assert.ok(pool.waveAmplitude <= 0.005);
  for (const p of pool.access) assert.ok(Math.abs(supportHeight(p[0], p[2], manifest.terrain, p[1]) - p[1]) < 0.03);
  const water = glbJson(manifest.shell).nodes.find((n) => n.name === pool.node);
  assert.ok(water?.extras?.water, "native water is a Walk exclusion");
});
