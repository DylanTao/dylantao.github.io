"""Keep sub-millimetre arrival water sheets closed in the pinned glTF exporter.

Only these two new transparent materials need finer position quantization. All
opaque primitives still call the unmodified encoder with the original settings.
The independent decoded audit, rather than this adapter, proves their closure.
"""

import inspect


WATER_MATERIALS = frozenset(("arrival flowing spring water", "arrival spring rill spill"))


def precision_encoder(original, records):
    """Wrap the Blender4.5.9 primitive boundary without modifying SDK files."""
    expected = ("primitive", "dll", "export_settings", "encoded_primitives_cache")
    if tuple(inspect.signature(original).parameters) != expected:
        raise RuntimeError("The pinned glTF primitive encoder signature changed")

    def encode(primitive, dll, export_settings, encoded_primitives_cache):
        name = getattr(primitive.material, "name", None)
        if name not in WATER_MATERIALS:
            return original(primitive, dll, export_settings, encoded_primitives_cache)
        settings = dict(export_settings)
        settings["gltf_draco_position_quantization"] = 18
        settings["gltf_draco_normal_quantization"] = 10
        records.append({"material": name, "positionBits": 18, "normalBits": 10})
        return original(primitive, dll, settings, encoded_primitives_cache)

    encode.coastal_water_precision = True
    return encode


def install_water_precision():
    import bpy
    from io_scene_gltf2.io.exp import draco

    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Water precision is pinned to Blender4.5.9")
    original = draco.__encode_primitive
    if getattr(original, "coastal_water_precision", False):
        raise RuntimeError("Water precision must be installed once per export process")
    records = []
    draco.__encode_primitive = precision_encoder(original, records)
    return records
