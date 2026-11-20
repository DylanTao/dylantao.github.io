"""Trace the retained coastal house with a frozen sample of its live T2 Pacific."""

from argparse import ArgumentParser
from math import asin, atan2, radians, tan
from pathlib import Path
import hashlib
import json
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def native(world):
    x, up, sea = world
    return Vector((x, -sea, up))


def link(tree, source, destination):
    tree.links.new(source, destination)


def plain_material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def land_bvh(scene):
    points, faces = [], []
    for obj in scene.objects:
        if (
            obj.type != "MESH"
            or obj.hide_render
            or not obj.name.startswith(("coast_", "core__golden coastal sandstone"))
        ):
            continue
        base = len(points)
        points.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        faces.extend(tuple(base + i for i in polygon.vertices) for polygon in obj.data.polygons)
    return BVHTree.FromPolygons(points, faces)


def ocean_material():
    mat = plain_material(
        "T3 sampled Pacific | dielectric and residual T2 foam", (0.998, 0.999, 1.0), 0.078
    )
    tree = mat.node_tree
    n = tree.nodes
    water = n.get("Principled BSDF")
    water.inputs["Transmission Weight"].default_value = 1
    water.inputs["IOR"].default_value = 1.333
    water.inputs["Specular IOR Level"].default_value = 0.5
    geom = n.new("ShaderNodeNewGeometry")
    fine = n.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 25
    fine.inputs["Roughness"].default_value = 0.62
    fine.inputs["Detail"].default_value = 2
    link(tree, geom.outputs["Position"], fine.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.34
    bump.inputs["Distance"].default_value = 0.006
    link(tree, fine.outputs["Fac"], bump.inputs["Height"])
    link(tree, bump.outputs["Normal"], water.inputs["Normal"])
    surf = n.new("ShaderNodeAttribute")
    surf.attribute_name = "t2_foam"
    foam_variation = n.new("ShaderNodeMath")
    foam_variation.operation = "MULTIPLY_ADD"
    foam_variation.inputs[1].default_value = 0.9
    foam_variation.inputs[2].default_value = 0.56
    link(tree, fine.outputs["Fac"], foam_variation.inputs[0])
    foam_coverage = n.new("ShaderNodeMath")
    foam_coverage.operation = "MULTIPLY_ADD"
    foam_coverage.inputs[1].default_value = 2.0
    foam_coverage.inputs[2].default_value = -0.025
    foam_coverage.use_clamp = True
    link(tree, surf.outputs["Fac"], foam_coverage.inputs[0])
    foam_fraction = n.new("ShaderNodeMath")
    foam_fraction.operation = "MULTIPLY"
    foam_fraction.use_clamp = True
    link(tree, foam_variation.outputs[0], foam_fraction.inputs[0])
    link(tree, foam_coverage.outputs[0], foam_fraction.inputs[1])
    foam = n.new("ShaderNodeBsdfDiffuse")
    foam.inputs["Color"].default_value = (0.75, 0.79, 0.76, 1)
    foam.inputs["Roughness"].default_value = 0.52
    blend = n.new("ShaderNodeMixShader")
    link(tree, foam_fraction.outputs[0], blend.inputs[0])
    link(tree, water.outputs[0], blend.inputs[1])
    link(tree, foam.outputs[0], blend.inputs[2])
    output = n.get("Material Output")
    link(tree, blend.outputs[0], output.inputs["Surface"])
    absorption = n.new("ShaderNodeVolumeAbsorption")
    absorption.inputs["Color"].default_value = (0.65, 0.83, 0.95, 1)
    absorption.inputs["Density"].default_value = 0.22
    scattering = n.new("ShaderNodeVolumeScatter")
    scattering.inputs["Color"].default_value = (0.40, 0.65, 0.72, 1)
    scattering.inputs["Density"].default_value = 0.013
    scattering.inputs["Anisotropy"].default_value = 0.27
    volume = n.new("ShaderNodeAddShader")
    link(tree, absorption.outputs[0], volume.inputs[0])
    link(tree, scattering.outputs[0], volume.inputs[1])
    link(tree, volume.outputs[0], output.inputs["Volume"])
    return mat


def install_pacific(scene, receipt, bytes_path):
    grid = receipt["grid"]
    if digest(bytes_path) != grid["sha256"]:
        raise ValueError("The sampled water grid does not match the WebGL receipt")
    xs, zs = np.asarray(grid["xs"]), np.asarray(grid["zs"])
    data = np.fromfile(bytes_path, dtype="<f4").reshape((len(zs), len(xs), 5))
    solver_area = float(receipt["config"]["seaLevel"])
    heights, foam, moisture, floor, depth = np.moveaxis(data, 2, 0)
    physical = np.isfinite(heights)
    bed = land_bvh(scene)
    levels = heights.copy()
    # Close the dry shoreline below its actual stone/sand so the optical volume
    # has a watertight end without a second visible boundary on top of the bed.
    for j, i in np.argwhere(~physical):
        ground, normal, _, _ = bed.ray_cast(
            Vector((float(xs[i]), float(-zs[j]), -4.5)), Vector((0, 0, -1)), 19
        )
        if ground is not None and normal.z > 0.05:
            levels[j, i] = min(solver_area + 0.22, ground.z - 0.016)
        elif np.isfinite(floor[j, i]):
            levels[j, i] = min(solver_area + 0.22, float(floor[j, i]) - 0.016)
        else:
            levels[j, i] = solver_area - 0.066
    # The analytic display's far horizon is finite. Continue just its mean
    # sea plane to a 6 km rim to receive the path-traced horizon reflection.
    xx = np.r_[-6000, xs, 6000]
    zz = np.r_[-6000, zs]
    zz[0] = -6000
    field = np.full((len(zz), len(xx)), solver_area, dtype=np.float32)
    ribbons = np.zeros_like(field)
    field[1:, 1:-1] = levels
    ribbons[1:, 1:-1] = np.where(physical, foam, 0)
    w, h = len(xx), len(zz)
    vertex = [
        (float(x), float(-z), float(field[j, i])) for j, z in enumerate(zz) for i, x in enumerate(xx)
    ]
    faces = [
        (j * w + i, (j + 1) * w + i, (j + 1) * w + i + 1, j * w + i + 1)
        for j in range(h - 1)
        for i in range(w - 1)
    ]
    cap = (
        list(range(0, w))
        + [j * w + w - 1 for j in range(1, h)]
        + list(range(h * w - 2, (h - 1) * w - 1, -1))
        + [j * w for j in range(h - 2, 0, -1)]
    )
    bottom = []
    for index in cap:
        x, y, _ = vertex[index]
        bottom.append(len(vertex))
        vertex.append((x, y, -24.0))
    for i in range(len(cap)):
        j = (i + 1) % len(cap)
        faces.append((cap[i], cap[j], bottom[j], bottom[i]))
    faces.append(tuple(bottom))
    mesh = bpy.data.meshes.new("Pacific sampled surface mesh")
    mesh.from_pydata(vertex, [], faces)
    mesh.update()
    ob = bpy.data.objects.new("T3 Pacific reconstructed from live surface", mesh)
    scene.collection.objects.link(ob)
    mesh.materials.append(ocean_material())
    for face in mesh.polygons:
        face.use_smooth = face.index < (h - 1) * (w - 1)
    values = mesh.attributes.new(name="t2_foam", type="FLOAT", domain="POINT")
    values.data.foreach_set("value", np.r_[ribbons.flatten(), np.zeros(len(cap), np.float32)])
    return {
        "surfaceVertices": int(w * h),
        "sourceSamples": int(data.shape[0] * data.shape[1]),
        "wetResolved": int(physical.sum()),
        "shoreMissingClosedBelowBed": int((~physical).sum()),
        "meanSeaLevel": solver_area,
        "highestSample": float(np.nanmax(heights)),
        "lowestSample": float(np.nanmin(heights)),
        "maxFoam": float(foam.max()),
        "farExtensionM": 6000,
        "volumeBottomM": -24,
    }, (xs, zs, moisture)


def wet_sand(wetness):
    xs, zs, moisture = wetness
    # Bake just the runtime moisture scalar to a uniform world-space data image.
    min_x, max_x, min_y, max_y = -31.0, 78.0, 5.0, 40.0
    x = np.linspace(min_x, max_x, 768)
    y = np.linspace(min_y, max_y, 256)
    across = np.array([np.interp(x, xs, row, left=0, right=0) for row in moisture])
    data = np.array([np.interp(y, -zs[::-1], row[::-1], left=0, right=0) for row in across.T]).T
    pixels = np.ones((len(y), len(x), 4), dtype=np.float32)
    pixels[:, :, :3] = data[:, :, None]
    mask = bpy.data.images.new(
        "T2 moisture in native XY", width=len(x), height=len(y), float_buffer=True
    )
    mask.colorspace_settings.name = "Non-Color"
    mask.pixels.foreach_set(pixels.ravel())
    mask.pack()
    prepared = []
    for mat in bpy.data.materials:
        if not mat.use_nodes or not any(
            name in mat.name.lower() for name in ("beach sand", "tideline sand")
        ):
            continue
        tree = mat.node_tree
        shader = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if shader is None:
            continue
        n = tree.nodes
        geom = n.new("ShaderNodeNewGeometry")
        shift = n.new("ShaderNodeVectorMath")
        shift.operation = "SUBTRACT"
        shift.inputs[1].default_value = (min_x, min_y, 0)
        vector = n.new("ShaderNodeVectorMath")
        vector.operation = "MULTIPLY"
        vector.inputs[1].default_value = (1 / (max_x - min_x), 1 / (max_y - min_y), 1)
        image = n.new("ShaderNodeTexImage")
        image.image = mask
        image.extension = "CLIP"
        link(tree, geom.outputs["Position"], shift.inputs[0])
        link(tree, shift.outputs["Vector"], vector.inputs[0])
        link(tree, vector.outputs["Vector"], image.inputs["Vector"])
        wet = n.new("ShaderNodeRGBToBW")
        link(tree, image.outputs["Color"], wet.inputs["Color"])
        base = shader.inputs["Base Color"]
        mark = n.new("ShaderNodeMixRGB")
        mark.blend_type = "MULTIPLY"
        mark.inputs[2].default_value = (0.52, 0.56, 0.59, 1)
        if base.is_linked:
            link(tree, base.links[0].from_socket, mark.inputs[1])
        else:
            mark.inputs[1].default_value = base.default_value
        link(tree, wet.outputs["Val"], mark.inputs[0])
        link(tree, mark.outputs[0], base)
        gloss = n.new("ShaderNodeMath")
        gloss.operation = "MULTIPLY_ADD"
        rough = shader.inputs["Roughness"]
        gloss.inputs[1].default_value = 0.30 - rough.default_value
        gloss.inputs[2].default_value = rough.default_value
        if not rough.is_linked:
            link(tree, wet.outputs["Val"], gloss.inputs[0])
            link(tree, gloss.outputs[0], rough)
        prepared.append(mat.name)
    return prepared


def illumination(scene, receipt):
    sun_state = receipt["browser"]["sun"]
    direction = native(sun_state["towardWorld"]).normalized()
    world = bpy.data.worlds.new("T3 clear sky and one matched sun")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    sky = tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False
    sky.sun_elevation = asin(direction.z)
    sky.sun_rotation = atan2(direction.y, direction.x)
    sky.altitude = 0.03
    sky.air_density = 1.0
    sky.dust_density = 0.85
    sky.ozone_density = 1.0
    background = tree.nodes.get("Background")
    background.inputs["Strength"].default_value = 0.32
    link(tree, sky.outputs["Color"], background.inputs["Color"])
    lamp = bpy.data.lights.new("T3 matched Pacific Sun", type="SUN")
    lamp.energy = 2.65
    lamp.angle = radians(0.533)
    daylight = sun_state["linearColor"]
    lamp.color = tuple(value / max(daylight) for value in daylight)
    ob = bpy.data.objects.new("T3 matched Pacific Sun", lamp)
    scene.collection.objects.link(ob)
    ob.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    incoming = [o.name for o in scene.objects if o.type == "LIGHT" and o != ob]
    return {
        "towardNative": list(direction),
        "solarElevationDeg": asin(direction.z) * 180 / np.pi,
        "angles": "radians for sky",
        "sunEnergy": lamp.energy,
        "sunDiameterDeg": 0.533,
        "worldStrength": background.inputs["Strength"].default_value,
        "retainedNativePracticals": incoming,
    }


def camera(scene, receipt, width, height):
    part = bpy.data.cameras.new("T3 matched standing lens")
    ob = bpy.data.objects.new("T3 matched standing lens", part)
    scene.collection.objects.link(ob)
    ob.location = native(receipt["browser"]["camera"])
    forward = (native(receipt["browser"]["target"]) - ob.location).normalized()
    ob.rotation_euler = forward.to_track_quat("-Z", "Y").to_euler()
    vfov = receipt["browser"].get("fov") or receipt["viewRequested"]["fov"]
    part.sensor_fit = "HORIZONTAL"
    part.sensor_width = 36
    part.lens = 36 / (2 * tan(radians(vfov) / 2) * (width / height))
    part.clip_start = 0.045
    part.clip_end = 12000
    scene.camera = ob
    return {
        "nativeEye": list(ob.location),
        "nativeForward": list(forward),
        "verticalFovDeg": vfov,
        "sensorWidthMm": 36,
        "lensMm": part.lens,
    }


def run():
    ap = ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--capture", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--draft", action="store_true")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    if args.samples < 1 or args.threads < 1:
        ap.error("Samples and CPU threads must be positive")
    if args.source.resolve() == (args.out / "shore-reference.blend").resolve():
        ap.error("Use a distinct output directory for the prepared scene")
    data = args.capture / "webgl-receipt.json"
    receipt = json.loads(data.read_text(encoding="utf8"))
    args.out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
    scene = bpy.context.scene
    dimensions = receipt["browser"]["drawingBuffer"]
    lens = camera(scene, receipt, *dimensions)
    water, wet = install_pacific(scene, receipt, args.capture / "water-grid.f32")
    sand = wet_sand(wet)
    sun = illumination(scene, receipt)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.seed = 94
    scene.cycles.max_bounces = 11
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 5
    scene.cycles.transmission_bounces = 8
    scene.cycles.volume_bounces = 2
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.028 if not args.draft else 0.075
    scene.cycles.adaptive_min_samples = 12 if not args.draft else 5
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.denoising_use_gpu = False
    if not args.draft:
        bpy.context.view_layer.cycles.denoising_store_passes = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = args.threads
    scene.render.resolution_x, scene.render.resolution_y = dimensions
    scene.render.resolution_percentage = 50 if args.draft else 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35
    output_format = "PNG" if args.draft else "OPEN_EXR_MULTILAYER"
    scene.render.image_settings.file_format = output_format
    scene.render.image_settings.color_depth = "16" if args.draft else "32"
    scene.render.filepath = str(
        (args.out / ("preview.png" if args.draft else "cycles-linear.exr")).resolve()
    )
    output = {
        "engine": "Blender Cycles",
        "version": bpy.app.version_string,
        "device": "CPU",
        "threads": args.threads,
        "samples": args.samples,
        "denoise": "OpenImageDenoise on CPU",
        "seed": 94,
        "adaptiveThreshold": scene.cycles.adaptive_threshold,
        "dimensions": dimensions,
        "resolutionPercentage": scene.render.resolution_percentage,
        "viewTransform": "AgX, Medium High Contrast, exposure -0.35",
        "sourceFile": args.source.name,
        "sourceSha256": digest(args.source),
        "webglReceiptSha256": digest(data),
        "waterGridSha256": receipt["grid"]["sha256"],
        "camera": lens,
        "water": water,
        "sandMoistureMaterials": sand,
        "light": sun,
        "waterRepresentation": "Single frozen sampled water volume. Upper geometry uses actual T2 physical heights, residual foam channels and the browser seabed field. The dielectric, foam closure, micronormal, absorption and scatter are Cycles approximations. Dry points close beneath retained native ground. Open ocean beyond the authored grid is a flat mean-level extension.",
        "date": receipt["config"]["date"],
        "T2StudySeconds": receipt["config"]["waterStudySeconds"],
    }
    (args.out / "settings.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf8")
    print("STUDY", json.dumps(output), flush=True)
    if not args.draft:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(
            filepath=str((args.out / "shore-reference.blend").resolve()), compress=True
        )
    begin = time.monotonic()
    bpy.ops.render.render(write_still=True)
    if not args.draft:
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_depth = "16"
        scene.render.image_settings.color_mode = "RGB"
        bpy.data.images["Render Result"].save_render(
            str((args.out / "cycles-reference.png").resolve()), scene=scene
        )
    output["seconds"] = round(time.monotonic() - begin, 2)
    names = (
        ["preview.png"]
        if args.draft
        else ["cycles-linear.exr", "cycles-reference.png", "shore-reference.blend"]
    )
    output["files"] = {
        name: {"bytes": (args.out / name).stat().st_size, "sha256": digest(args.out / name)}
        for name in names
    }
    (args.out / "settings.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    run()
