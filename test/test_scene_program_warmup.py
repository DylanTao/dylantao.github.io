from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTROLLER = REPO_ROOT / "assets" / "js" / "home-scene" / "controller.mjs"
WARMUP = REPO_ROOT / "assets" / "js" / "home-scene" / "program-warmup.mjs"
REALISM = REPO_ROOT / "assets" / "js" / "home-scene" / "realism.mjs"
ENVIRONMENT = REPO_ROOT / "assets" / "js" / "home-scene" / "environment.mjs"
WORLD_CONTROLS = REPO_ROOT / "_includes" / "home" / "world_controls.liquid"


class SceneProgramWarmupTests(unittest.TestCase):
    """The 3D home prepares shader programs before drawing (docs/evidence/coastal-startup-2026-10-12).

    Drawing a material first and reading its program log froze the page for 26 s in all; the
    warmup keeps that work on the driver's threads. These checks keep the contract in place.
    """

    def test_first_view_waits_for_programs_before_it_can_draw(self) -> None:
        source = CONTROLLER.read_text(encoding="utf-8")
        self.assertIn('import { prepareFramePrograms } from "./program-warmup.mjs";', source)
        initialize = source[source.index("async function initialize()") :]
        compile_at = initialize.index("await compilePrograms(")
        ready_at = initialize.index("compositionReady = true;")
        self.assertLess(compile_at, ready_at)

    def test_streamed_rooms_count_only_after_their_programs(self) -> None:
        source = CONTROLLER.read_text(encoding="utf-8")
        load_room = source[source.index("async function loadRoom(") : source.index("function release(")]
        self.assertLess(load_room.index("await compilePrograms();"), load_room.index("rooms.set(id, root);"))

    def test_warmup_polls_wall_clock_work_and_skips_software_rasterizers(self) -> None:
        source = WARMUP.read_text(encoding="utf-8")
        self.assertIn("scheduler?.postTask", source)
        self.assertRegex(source, r"swiftshader\|llvmpipe")
        self.assertIn('renderer.extensions.has("KHR_parallel_shader_compile")', source)
        # The shadow pass draws without a scene, so its programs are keyed without fog.
        self.assertRegex(source, re.compile(r"scene\.fog = null;.*scene\.fog = fog;", re.S))

    def test_scene_programs_are_created_in_batches(self) -> None:
        # One renderer.compile(scene) created every program in a single 0.1-1.6 s task (2026-10-13).
        source = WARMUP.read_text(encoding="utf-8")
        batches = source[source.index("async function compileSceneInBatches(") : source.index("// Full-screen passes")]
        self.assertIn("await new Promise((resolve) => later(resolve, 0));", batches)
        # Every material is restored before the task boundary, where other code may draw.
        self.assertLess(batches.index("finally"), batches.index("await new Promise"))
        prepare = source[source.index("export async function prepareFramePrograms(") :]
        self.assertIn("await compileSceneInBatches(", prepare)
        self.assertNotIn("renderer.compile(scene, camera)", prepare)

    def test_compiles_wait_for_free_cores(self) -> None:
        # Submitting every batch at once kept all 22 cores compiling while the page's thread
        # waited up to 1.5 s for a turn (2026-10-13, docs/studio-log-2026-10.md card 26).
        source = WARMUP.read_text(encoding="utf-8")
        self.assertIn("navigator?.hardwareConcurrency", source)
        batches = source[source.index("async function compileSceneInBatches(") : source.index("// Full-screen passes")]
        self.assertLess(batches.index("later(resolve, 0)"), batches.index("await queue.drain(slots);"))
        prepare = source[source.index("export async function prepareFramePrograms(") :]
        self.assertIn("return queue.drain(0, report);", prepare)

    def test_custom_depth_materials_compile_in_their_shadow_state(self) -> None:
        # The shadow pass copies the caster's side onto a custom depth material before drawing, so a
        # double-sided plant's wind depth material linked late, at the first frame (0.4 s).
        source = WARMUP.read_text(encoding="utf-8")
        casters = source[source.index("function compileShadowCastersWithoutFog(") : source.index("// A transmissive, double-sided")]
        self.assertIn("pending.push([object, object[custom], material]);", casters)
        self.assertIn("if (caster) copyShadowState(material, caster);", casters)

    def test_environment_capture_keeps_its_programs(self) -> None:
        # A generator disposed after each capture released its blur program; the first capture
        # also waited on the sky's program.
        source = ENVIRONMENT.read_text(encoding="utf-8")
        make = source[source.index("function makeEnvironment()") : source.index("function setPalette(")]
        self.assertNotIn("new THREE.PMREMGenerator", make)
        self.assertNotIn("pmrem.dispose()", make)
        before = source[: source.index("function makeEnvironment()")]
        self.assertIn("renderer.compile(capture, captureCamera);", before)
        self.assertIn("pmrem.dispose();", source[source.index("function dispose()") :])

    def test_loading_bar_reports_finished_work(self) -> None:
        controls = WORLD_CONTROLS.read_text(encoding="utf-8")
        source = CONTROLLER.read_text(encoding="utf-8")
        self.assertIn('role="progressbar"', controls)
        for step in ("house", "coast", "room", "sirui", "view"):
            with self.subTest(step=step):
                self.assertIn(f'data-progress-step="{step}"', controls)
                self.assertIn(f'"{step}"', source)
        # Progress never moves backward and hides once the first view is drawn.
        self.assertIn("!(fill > progressFill[step])", source)
        self.assertIn("progressBar.hidden = true", source)

    def test_finish_pipeline_declares_its_extra_programs(self) -> None:
        source = REALISM.read_text(encoding="utf-8")
        self.assertIn("programWarmup:", source)
        for name in ("contact.normalMaterial", "contact.ssaoMaterial", "contact.blurMaterial", "output.material"):
            with self.subTest(name=name):
                self.assertIn(name, source[source.index("programWarmup:") : source.index("setVolume(next)")])


if __name__ == "__main__":
    unittest.main()
