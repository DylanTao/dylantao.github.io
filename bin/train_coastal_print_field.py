"""Fit an original 2D print with learned grids and a small coordinate decoder.

This is an original bounded field experiment, not DANF or a 3D reconstruction.
Only the deterministic training-coordinate split participates in optimization.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import platform
import time
import numpy as np
from PIL import Image
import torch
from torch import nn
from torch.nn import functional as F

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artwork/coastal-home/learned-print"
SOURCE = ROOT / "artwork/coastal-home/coastal-print.webp"
SIZES = [(16, 8), (48, 24), (128, 64)]


def split_codes(width, height):
    y, x = np.mgrid[:height, :width].astype(np.uint64)
    # Coordinate-only hash: split assignment never reads target colors.
    h = ((x * 73856093) ^ (y * 19349663) ^ 1701) % 10
    return np.where(h == 0, 2, np.where(h == 1, 1, 0)).astype(np.uint8)


class Field(nn.Module):
    def __init__(self):
        super().__init__()
        self.grids = nn.ParameterList([nn.Parameter(torch.randn(1, 4, h, w) * .05) for w, h in SIZES])
        self.layers = nn.ModuleList([nn.Linear(14, 24), nn.Linear(24, 24), nn.Linear(24, 4)])

    def forward(self, uv):
        pos = uv.reshape(1, 1, -1, 2) * 2 - 1
        features = [uv * 2 - 1]
        features += [F.grid_sample(g, pos, mode="bilinear", padding_mode="border", align_corners=True).reshape(4, -1).T for g in self.grids]
        v = torch.cat(features, dim=1)
        for layer in self.layers[:-1]:
            v = F.relu(layer(v))
        return torch.sigmoid(self.layers[-1](v))


def evaluate(model, uv, values, indices):
    total, count = np.zeros(4, dtype=np.float64), 0
    with torch.no_grad():
        for ix in indices.split(16384):
            diff = (model(uv[ix]) - values[ix]).numpy().astype(np.float64)
            total += np.square(diff).sum(axis=0)
            count += len(ix)
    mse = total / count
    return {"count": count, "premultiplied_rgba_mse": mse.tolist(), "rgba_psnr_db": -10 * math.log10(float(mse.mean())), "rgb_psnr_db": -10 * math.log10(float(mse[:3].mean())), "alpha_rmse": math.sqrt(float(mse[3]))}


def export(model, output):
    chunks, blocks, offset = [], [], 0
    def add(name, a):
        nonlocal offset
        a = np.ascontiguousarray(a, dtype=np.float32)
        scale = max(float(np.abs(a).max()) / 32767, 1e-10)
        q = np.rint(a / scale).clip(-32767, 32767).astype("<i2")
        blocks.append({"name": name, "shape": list(a.shape), "offset": offset, "count": a.size, "scale": scale})
        offset += a.size
        chunks.append(q.reshape(-1))
    for i, g in enumerate(model.grids):
        add(f"grid{i}", g.detach().numpy()[0].transpose(1, 2, 0))
    for i, l in enumerate(model.layers):
        add(f"weight{i}", l.weight.detach().numpy())
        add(f"bias{i}", l.bias.detach().numpy())
    data = np.concatenate(chunks).tobytes()
    (output / "field.i16").write_bytes(data)
    manifest = {"schema_version": 1, "representation": "learned-bilinear-feature-grids-with-relu-decoder", "domain": "2D normalized image coordinates; no 3D geometry or radiance", "sizes": SIZES, "hidden": 24, "features_per_level": 4, "input_channels": 14, "output": "sigmoid premultiplied sRGB and alpha", "quantization": "symmetric signed int16 per block; little endian", "blocks": blocks, "weights_bytes": len(data), "weights_sha256": hashlib.sha256(data).hexdigest()}
    (output / "field.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    quantized = copy.deepcopy(model)
    for b, c in zip(blocks, chunks):
        a = torch.from_numpy((c.astype(np.float32) * b["scale"]).reshape(b["shape"]))
        if b["name"].startswith("grid"):
            quantized.grids[int(b["name"][-1])].data.copy_(a.permute(2, 0, 1).unsqueeze(0))
        else:
            part = "weight" if b["name"].startswith("weight") else "bias"
            getattr(quantized.layers[int(b["name"][-1])], part).data.copy_(a)
    return manifest, quantized


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--steps", type=int, default=3000)
    p.add_argument("--batch", type=int, default=4096)
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--output", type=Path, default=OUT)
    args = p.parse_args()
    torch.manual_seed(1701)
    torch.set_num_threads(args.threads)
    torch.use_deterministic_algorithms(True)
    args.output.mkdir(parents=True, exist_ok=True)
    image = np.asarray(Image.open(SOURCE).convert("RGBA"), dtype=np.float32) / 255
    height, width = image.shape[:2]
    image[..., :3] *= image[..., 3:4]
    y, x = np.mgrid[:height, :width]
    uv = torch.from_numpy(np.stack((x / (width - 1), y / (height - 1)), -1).reshape(-1, 2).astype(np.float32))
    values = torch.from_numpy(image.reshape(-1, 4))
    codes = split_codes(width, height).reshape(-1)
    splits = [torch.from_numpy(np.flatnonzero(codes == c)) for c in range(3)]
    model = Field()
    optimizer = torch.optim.Adam(model.parameters(), lr=.006)
    baseline = evaluate(model, uv, values, splits[1])
    best, best_loss, history = None, math.inf, []
    started = time.perf_counter()
    for step in range(1, args.steps + 1):
        ix = splits[0][torch.randint(len(splits[0]), (args.batch,))]
        pred = model(uv[ix])
        loss = F.mse_loss(pred, values[ix])
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()
        for group in optimizer.param_groups:
            group["lr"] = .006 * (1 - step / args.steps) + .0003
        if step == 1 or step % 200 == 0 or step == args.steps:
            result = evaluate(model, uv, values, splits[1])
            error = float(np.mean(result["premultiplied_rgba_mse"]))
            if error < best_loss:
                best_loss, best = error, copy.deepcopy(model.state_dict())
            row = {"step": step, "training_batch_mse": loss.item(), "validation": result, "elapsed_seconds": time.perf_counter() - started}
            history.append(row)
            print(json.dumps(row), flush=True)
    model.load_state_dict(best)
    manifest, quantized = export(model, args.output)
    # Test coordinates are read here for the first and only model evaluation.
    report = {"schema_version": 1, "trainer_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "source": str(SOURCE.relative_to(ROOT)).replace('\\', '/'), "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "source_bytes": SOURCE.stat().st_size, "resolution": [width, height], "calibration": "Exact original image-plane UV coordinates; no camera or 3D calibration claim.", "seed": 1701, "steps": args.steps, "batch": args.batch, "threads": args.threads, "device": "cpu", "torch": torch.__version__, "python": platform.python_version(), "elapsed_seconds": time.perf_counter() - started, "split_counts": {"train": len(splits[0]), "validation": len(splits[1]), "test": len(splits[2])}, "split_sha256": hashlib.sha256(codes.tobytes()).hexdigest(), "selection": "Lowest full validation RGBA MSE among logged checkpoints; test coordinates never optimized or used for checkpoint selection.", "initial_validation": baseline, "history": history, "float_test": evaluate(model, uv, values, splits[2]), "quantized_test": evaluate(quantized, uv, values, splits[2]), "artifact": manifest, "limitations": ["Held-out coordinates test spatial interpolation within one original static illustration, not unseen 3D viewpoints or a new illustration.", "No prescribed or learned discontinuity curves; this is not a reproduction of Belhe et al. or Liu et al.", "No relighting, hidden geometry, dynamic scene, or house replacement is represented."]}
    preview = []
    with torch.no_grad():
        for batch in uv.split(16384): preview.append(quantized(batch).numpy())
    rgba = np.concatenate(preview).reshape(height, width, 4)
    alpha = rgba[..., 3:4]
    rgba[..., :3] /= np.maximum(alpha, 1e-5)
    Image.fromarray(np.rint(rgba.clip(0, 1) * 255).astype(np.uint8), "RGBA").save(args.output / "reconstruction.png")
    (args.output / "training.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"done": True, "seconds": report["elapsed_seconds"], "test": report["quantized_test"], "bytes": manifest["weights_bytes"]}), flush=True)

if __name__ == "__main__": main()
