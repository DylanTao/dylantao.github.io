"""Retain the site's original living-room planting through furniture rebuilds.

The reusable native library is an exact extraction of the site's retained plant geometry,
relocated onto the current floor and credenza. It contains no former floor or furniture.
"""
import re
from pathlib import Path
import bpy

LIBRARY = Path(__file__).resolve().parents[1] / "artwork/coastal-home/living-plants.blend"
PREFIX = "lounge_retained_plant_"
EXPECTED = 6


def ensure_living_plants(scene):
    existing = [obj for obj in scene.objects if obj.name.startswith(PREFIX)]
    if existing:
        if len(existing) != EXPECTED:
            raise RuntimeError(f"partial retained living planting: {len(existing)} of {EXPECTED} parts")
        return existing
    with bpy.data.libraries.load(str(LIBRARY), link=False) as (source, target):
        target.objects = [name for name in source.objects if name.startswith(PREFIX)]
    if len(target.objects) != EXPECTED:
        raise RuntimeError("retained living planting library is incomplete")
    for obj in target.objects:
        scene.collection.objects.link(obj)
        for slot in obj.material_slots:
            original = bpy.data.materials.get(re.sub(r"\.\d{3}$", "", slot.material.name))
            if original:
                slot.material = original
    return target.objects
