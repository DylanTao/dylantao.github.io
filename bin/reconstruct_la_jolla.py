"""Local, repeatable multiview shape experiment; Blender remains the authoring source.

Run with Hunyuan3D-2 on PYTHONPATH inside a CUDA PyTorch environment. The
unmodified upstream model is external to this site and never shipped to readers.
"""
import json
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artwork/la-jolla/reconstruction"
OUT.mkdir(parents=True, exist_ok=True)
record = {"model": "tencent/Hunyuan3D-2mv", "subfolder": "hunyuan3d-dit-v2-mv",
          "revision": "3a761b539b29fe4ff64714813aa9560fd66f5de0",
          "seed": 20260914, "steps": 30, "octree": 256,
          "inputs": ["direction/front.png", "direction/back.png"],
          "status": "started", "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
started = time.monotonic()
try:
    import torch
    from PIL import Image
    from hy3dgen.rembg import BackgroundRemover
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from huggingface_hub import snapshot_download
    record["gpu"] = torch.cuda.get_device_name(0)
    remove = BackgroundRemover()
    images = {side: remove(Image.open(ROOT / f"artwork/la-jolla/direction/{side}.png").convert("RGB")) for side in ("front", "back")}
    weights = snapshot_download(record["model"], revision=record["revision"],
                                allow_patterns=[record["subfolder"] + "/*"])
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        weights, subfolder=record["subfolder"], variant="fp16")
    mesh = pipeline(image=images, num_inference_steps=record["steps"], octree_resolution=record["octree"],
                    num_chunks=12000, generator=torch.manual_seed(record["seed"]), output_type="trimesh")[0]
    mesh.export(OUT / "multiview-shape.glb")
    record.update(status="generated", vertices=len(mesh.vertices), faces=len(mesh.faces))
except Exception:
    record.update(status="failed", error=traceback.format_exc())
    traceback.print_exc()
finally:
    record["seconds"] = round(time.monotonic()-started, 2)
    (OUT / "attempt.json").write_text(json.dumps(record, indent=2)+"\n", encoding="utf8")
    print(json.dumps(record, indent=2))
