"""Extract the pinned Three.js worker into a static same-origin entry point."""

from pathlib import Path

base = Path(__file__).resolve().parents[1] / "assets/js/vendor/three-r164"
source = (base / "loaders/DRACOLoader.js").read_text(encoding="utf-8")
worker = source[
    source.index("function DRACOWorker()") : source.index("export { DRACOLoader")
]
(base / "libs/draco/draco-worker.js").write_text(
    "// Three.js r164 DRACOWorker, MIT. Static same-origin entry point.\n"
    'importScripts("./draco_wasm_wrapper.js");\n' + worker + "\nDRACOWorker();\n",
    encoding="utf-8",
)
