// Actual served dining/drinking states for the life checkpoints: one avatar and activity at a time,
// from the same lab camera, at 4K-class full screen (1920x1080 CSS at DPR 2) or a 390-wide phone.
//
//   node bin/capture_coastal_dining.cjs --label=before --avatars=lizard,ghibli --activities=dinner
//   node bin/capture_coastal_dining.cjs --label=after --viewport=phone --camera=default
//   node bin/capture_coastal_dining.cjs --label=after --frames=24 --interval=0.25 --activities=dinner
//
// Options: --base-url (default http://127.0.0.1:4210), --date (an ISO Pacific time; the routine
// clock is fixed by a Date-only override, native RAF and performance.now keep running), --viewport
// (4k | phone | desktop), --camera (default | table | close | <json {target,yaw,pitch,radius}>),
// --still (reduced-motion composed still; the default for single captures), --frames/--interval
// (a live sequence sampled every interval seconds), --out (output directory).
// Every capture records getSceneEvidence() beside its PNG. No product asset is replaced.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { collectRuntimeErrors } = require("../test/visual/helpers");

// Skinned-vertex contact measurement in the page: how deep hands and forearms reach into the
// nook's table (a 0.5 m disc, 5 cm thick, its top measured by dining.mjs or the authored 0.795 m
// above the seat anchor), how deep the seated body sinks below the banquette's cushion top, and
// where the held utensil's working end is relative to the mouth or the food.
async function measureContacts(page, table = true) {
  return page.evaluate(async (table) => {
    const THREE = await import("/assets/js/three.module.min.js");
    const element = document.querySelector("[data-home-desk-scene]");
    const e = element.getSceneEvidence();
    const actor = element.labScene.scene.getObjectByName("active-Sirui");
    if (!actor) return null;
    actor.updateMatrixWorld(true);
    const seat = new THREE.Matrix4().compose(
      new THREE.Vector3(...e.actorPosition),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), e.actorFacing),
      new THREE.Vector3(1, 1, 1)
    );
    const toSeat = seat.clone().invert();
    const surface = e.dining?.layout?.surface ?? 0.795;
    const centre = [-0.03, 0.76];
    const cushion = surface - 0.795 + 0.515; // the banquette's cushion top in the seat frame
    const out = { surface, hands: { depth: 0, vertices: 0, parts: {} }, seat: { depth: 0, vertices: 0 } };
    // The lounge has neither the nook's table nor its banquette: nothing to measure against.
    if (!table) return { surface: null, hands: null, seat: null, dining: null };
    const v = new THREE.Vector3();
    actor.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const skin = o.geometry.attributes.skinIndex,
        weight = o.geometry.attributes.skinWeight,
        bones = o.skeleton.bones;
      for (let i = 0; i < o.geometry.attributes.position.count; i++) {
        let name = null,
          best = 0;
        for (let k = 0; k < 4; k++) {
          const w = weight.getComponent(i, k);
          if (w > best) {
            best = w;
            name = bones[skin.getComponent(i, k)]?.name || null;
          }
        }
        if (!name) continue;
        const arm = /^(Hand|Forearm)/.test(name),
          hips = /^(Hips|Thigh)/.test(name);
        if (!arm && !hips) continue;
        o.getVertexPosition(i, v);
        v.applyMatrix4(o.matrixWorld).applyMatrix4(toSeat);
        if (arm) {
          const inside = Math.hypot(v.x - centre[0], v.z - centre[1]) < 0.5 && v.y < surface && v.y > surface - 0.05;
          if (inside) {
            out.hands.vertices++;
            // Which bone sinks deepest, and where (seat frame), to tell a palm from a forearm on the edge.
            const part = (out.hands.parts[name] ||= { vertices: 0, depth: 0, at: null });
            part.vertices++;
            if (surface - v.y > part.depth) {
              part.depth = surface - v.y;
              part.at = [v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000);
            }
            out.hands.depth = Math.max(out.hands.depth, surface - v.y);
          }
        } else if (Math.abs(v.x) < 0.3 && v.z > -0.25 && v.z < 0.3 && v.y < cushion) {
          out.seat.vertices++;
          out.seat.depth = Math.max(out.seat.depth, cushion - v.y);
        }
      }
    });
    const probe = element.labScene && element.getSceneEvidence().dining;
    out.dining = probe ? { phase: probe.phase, beat: probe.beat, contacts: probe.contacts } : null;
    return out;
  }, table);
}

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => args.includes(`--${name}`);

// Lab cameras in the seated actor's frame: `turn` is measured from the actor's facing (0 looks at
// the face), `forward` and `height` place the target from the placement point (seated clips lower
// the Root, so the placement sits about half a metre under the seat).
const CAMERAS = {
  // The kitchen arrival as authored.
  default: null,
  // Across the table: face, both hands, plate, glass and napkin in one frame.
  table: { turn: 0.62, pitch: 0.42, radius: 1.55, forward: 0.3, height: 1.08 },
  // Face and hands, slightly from the front: aimed at the avatar's own head joint.
  close: { turn: 0.38, pitch: 0.1, radius: 0.85, head: [0, 0.16, 0.06] },
  // The setting from above (menu contact sheets).
  plate: { turn: 0.15, pitch: 1.05, radius: 0.95, forward: 0.5, height: 0.82 },
};

(async () => {
  const label = option("label", "current");
  const base = option("base-url", process.env.VISUAL_BASE_URL || "http://127.0.0.1:4210").replace(/\/$/, "");
  const avatars = option("avatars", "lizard,south-park,simpsons,ghibli,rick-and-morty").split(",");
  const activities = option("activities", "dinner").split(",");
  const viewportName = option("viewport", "4k");
  // --target=x,y,z with --yaw, --pitch and --radius frames a fixed world point (shells mangle JSON).
  if (option("target", null))
    CAMERAS.fixed = {
      target: option("target").split(",").map(Number),
      yaw: Number(option("yaw", "0")),
      pitch: Number(option("pitch", "0.4")),
      radius: Number(option("radius", "3")),
    };
  const cameraOption = option("camera", CAMERAS.fixed ? "fixed" : "table,close");
  const cameraNames = cameraOption.startsWith("{") ? [cameraOption] : cameraOption.split(",");
  const date = option("date", "2026-10-24T19:11:00-07:00");
  const frames = Number(option("frames", "0"));
  const interval = Number(option("interval", "0.25"));
  const still = frames ? false : !flag("live");
  const out = path.resolve(option("out", `.jekyll-cache/visual-qa/life-2026-10-24/${label}`));
  await fs.mkdir(out, { recursive: true });
  const viewport =
    viewportName === "phone"
      ? { width: 390, height: 1000, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : viewportName === "desktop"
        ? { width: 1440, height: 1000, deviceScaleFactor: 1 }
        : { width: 1920, height: 1080, deviceScaleFactor: 2 };
  const browser = await chromium.launch({
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const report = { label, base, date, viewport: viewportName, cameras: cameraNames, still, captures: [] };
  try {
    report.browser = browser.version();
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: Boolean(viewport.isMobile),
      hasTouch: Boolean(viewport.hasTouch),
      timezoneId: "America/Los_Angeles",
      reducedMotion: still ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = collectRuntimeErrors(page);
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    // --baseline=<ref>: the original runtime (no dining hooks), for a before in the same session.
    const baseline = option("baseline", null);
    if (baseline) {
      const original = execFileSync("git", ["show", `${baseline}:assets/js/home-scene/controller.mjs`], { maxBuffer: 16 * 1024 * 1024 });
      await page.route("**/assets/js/home-scene/controller.mjs*", (route) => route.fulfill({ contentType: "text/javascript", body: original }));
    }
    // Count shader programs linked by the page: the setting should add none of its own.
    await page.addInitScript(() => {
      window.__programLinks = 0;
      // Each linked program's identity: its main #define lines and a hash of both sources.
      window.__programs = [];
      const hash = (text) => {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
        return (h >>> 0).toString(16);
      };
      for (const Context of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
        if (!Context) continue;
        const link = Context.prototype.linkProgram;
        Context.prototype.linkProgram = function (program) {
          window.__programLinks++;
          try {
            const sources = this.getAttachedShaders(program).map((shader) => this.getShaderSource(shader) || "");
            const defines = sources[1]
              .split("\n")
              .filter((line) => /^#define (SHADER_NAME|USE_|DOUBLE_SIDED|FLIP_SIDED|ALPHA|PHYSICAL|STANDARD|OPAQUE)/.test(line))
              .join(" ");
            window.__programs.push({ id: hash(sources.join("\n")), defines });
          } catch (error) {
            window.__programs.push({ id: "unreadable", defines: String(error) });
          }
          return link.call(this, program);
        };
      }
    });
    await page.addInitScript((iso) => {
      const NativeDate = Date,
        fixedDate = NativeDate.parse(iso);
      globalThis.Date = new Proxy(NativeDate, {
        construct: (target, a, newTarget) => Reflect.construct(target, a.length ? a : [fixedDate], newTarget),
        apply: () => new NativeDate(fixedDate).toString(),
        get: (target, property, receiver) => (property === "now" ? () => fixedDate : Reflect.get(target, property, receiver)),
      });
      sessionStorage.setItem("theme", "evening");
      sessionStorage.setItem("theme-manual", "true");
    }, date);
    await page.goto(`${base}/?scene-lab=1&weather=clear`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
    const controls = page.locator("[data-home-world-controls]");
    const evidence = () => scene.evaluate((element) => element.getSceneEvidence());
    // A composed still draws only on request; ask for each frame rather than waiting for motion.
    const waitFrames = async (count = 3) => {
      const start = (await evidence()).frames;
      await page.waitForFunction(
        ([s, c, live]) => {
          const element = document.querySelector("[data-home-desk-scene]");
          const e = element.getSceneEvidence();
          if (e.frames < s + c) element.labScene?.requestFrame();
          // A live scene always has its next frame pending; a still settles.
          return e.frames >= s + c && (live || !e.framePending);
        },
        [start, count, !still],
        { timeout: 90000, polling: 100 }
      );
    };
    if (viewportName !== "phone") {
      await page.locator("[data-world-fullscreen]").click();
      await page.waitForTimeout(800);
    } else await scene.scrollIntoViewIfNeeded();
    for (const avatar of avatars) {
      for (const activity of activities) {
        await controls.locator("[data-world-lab]>summary").click();
        await controls.locator("[data-world-avatar]").selectOption(avatar);
        await page.waitForFunction((id) => document.querySelector("[data-home-desk-scene]")?.dataset.avatar === id, avatar, { timeout: 60000 });
        await controls.locator("[data-world-activity]").selectOption(activity);
        await controls.locator("[data-world-lab]>summary").click();
        await page.waitForFunction(
          (id) => {
            const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
            return e.activity === id && !e.traveling;
          },
          activity,
          { timeout: 90000 }
        );
        // A meal's setting streams in after the activity changes (dining.mjs).
        if (!baseline && ["breakfast", "lunch", "dinner", "lounge"].includes(activity))
          await page
            .waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().dining?.ready, null, { timeout: 60000 })
            .catch(() => console.error(`${avatar} ${activity}: the setting never became ready`));
        await waitFrames(4);
        const view = await evidence();
        for (const cameraName of cameraNames) {
          const camera = CAMERAS[cameraName] ?? (cameraName.startsWith("{") ? JSON.parse(cameraName) : null);
          if (camera) {
            const actor = view.actorPosition,
              facing = view.actorFacing;
            const head = view.joints?.Head;
            const target =
              camera.target ||
              (camera.head && head
                ? [head[0] + Math.sin(facing) * camera.head[2], head[1] + camera.head[1], head[2] + Math.cos(facing) * camera.head[2]]
                : [actor[0] + Math.sin(facing) * camera.forward, actor[1] + camera.height, actor[2] + Math.cos(facing) * camera.forward]);
            // Measured from the actor's facing so every seat gets the same framing.
            const yaw = camera.target ? camera.yaw : facing + camera.turn;
            await scene.evaluate((element, c) => element.setLabCamera(c), { target, yaw, pitch: camera.pitch, radius: camera.radius });
          }
          await waitFrames(still ? 8 : 4);
          const stem = `${viewportName}-${cameraName.startsWith("{") ? "custom" : cameraName}-${activity}-${avatar}`;
          if (!frames) {
            const file = path.join(out, `${stem}.png`);
            await (viewportName === "phone" ? scene : page).screenshot({ path: file });
            const e = await evidence();
            const contacts = flag("measure") ? await measureContacts(page, activity !== "lounge") : null;
            if (contacts) contacts.programLinks = await page.evaluate(() => window.__programLinks);
            if (contacts) contacts.programs = await page.evaluate(() => window.__programs.map((p) => p.id));
            report.captures.push({ file, avatar, activity, camera: cameraName, evidence: summarize(e), contacts });
            console.log(
              JSON.stringify({
                file: path.basename(file),
                phase: e.dining?.phase ?? e.activityPhase,
                beat: e.dining?.beat ?? null,
                menu: e.dining?.menu ?? null,
                contacts,
              })
            );
          } else {
            for (let i = 0; i < frames; i++) {
              const t0 = (await evidence()).animationSeconds;
              await page.waitForFunction(
                ([s, dt]) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().animationSeconds >= s + dt,
                [t0, interval],
                { timeout: 60000 }
              );
              const file = path.join(out, `${stem}-f${String(i).padStart(3, "0")}.png`);
              await (viewportName === "phone" ? scene : page).screenshot({ path: file });
              const e = await evidence();
              report.captures.push({ file, avatar, activity, camera: cameraName, frame: i, evidence: summarize(e) });
            }
            console.log(JSON.stringify({ avatar, activity, camera: cameraName, frames }));
          }
        }
      }
    }
    report.errors = errors;
    report.programs = await page.evaluate(() => window.__programs);
    await fs.writeFile(
      path.join(out, `evidence-${viewportName}-${cameraNames.join("+").replace(/[{}":,]/g, "")}.json`),
      JSON.stringify(report, null, 2) + "\n"
    );
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function summarize(e) {
  return {
    activity: e.activity,
    animation: e.animation,
    phase: e.activityPhase,
    seconds: e.animationSeconds,
    actorPosition: e.actorPosition,
    actorFacing: e.actorFacing,
    gripDrift: e.gripDrift,
    dining: e.dining ?? null,
    drawCalls: e.drawCalls,
    triangles: e.triangles,
    programs: e.resources?.programs ?? null,
    geometries: e.resources?.geometries,
    textures: e.resources?.textures,
  };
}
