"""One export recipe for P's retained articulated geometry."""
import bpy


def export_model(destination):
    if bpy.app.version != (4, 5, 9):
        raise RuntimeError("Use exact Blender4.5.9")
    body = bpy.data.objects.get("PipBody")
    if body is None:
        raise RuntimeError("The retained P source has no PipBody root")
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    for obj in body.children_recursive:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination), export_format="GLB", use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False,
        # P has no image textures or UV-driven runtime materials. Preserve the
        # native UVs in .blend; omit only this unused delivered attribute.
        export_texcoords=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=14,
        export_draco_color_quantization=8,
        export_draco_generic_quantization=12,
    )
