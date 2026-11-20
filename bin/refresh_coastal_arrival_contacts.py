"""Fit the straight-arrival watercourse, portal footing and indoor dining set."""

from argparse import ArgumentParser
import json
from pathlib import Path
import sys

DINING_SHIFT = 0.86
DINING_Z = {"dining-table": 11.05, **{
    f"dining-chair-{index}": 11.87 if index <= 3 else 10.23 for index in range(1, 7)
}}
NATIVE_MARK = "straightArrivalContactFit"


def fit_manifest_dining(config):
    anchors = {item["id"]: item for item in config["furniture"] if item["id"] in DINING_Z}
    if anchors.keys() != DINING_Z.keys():
        raise ValueError("Expected the indoor dining table and six chairs")
    for name, anchor in anchors.items():
        initial = DINING_Z[name]
        fitted = round(initial - DINING_SHIFT, 2)
        if anchor["room"] != "kitchen" or anchor["position"][2] not in (initial, fitted):
            raise ValueError(f"Unexpected authored anchor for {name}")
        anchor["position"][2] = fitted
    for lamp in config["interiorLights"]["dining"]:
        if lamp[2] not in (11.05, 10.19):
            raise ValueError("Unknown dining pendant alignment")
        lamp[2] = 10.19


def fit_dining_fittings(scene):
    """Move the two actual pendant assemblies and rug with their table."""
    if scene.get("straightArrivalDiningFittings"):
        return
    from mathutils import Vector
    from coastal_breakfast_nook import _inside, _islands

    pendants = [
        ([x - .246, 1.48, 10.80], [x + .246, 2.365, 11.30])
        for x in (-2.40, -1.30)
    ]
    carpet = [([-3.51, -.001, 9.66], [-.19, .017, 12.44])]
    for name, boxes, count in (
        ("pale oak", pendants, 2), ("polished nickel", pendants, 4),
        ("dining lantern paper", pendants, 2),
        ("oatmeal wool textile", carpet, 1), ("linen", carpet, 4),
    ):
        obj = scene.objects[f"kitchen__{name}"]
        islands = [row for row in _islands(obj) if any(_inside(row, lo, hi) for lo, hi in boxes)]
        if len(islands) != count:
            raise ValueError(f"Expected {count} complete dining fittings in {name}, got {len(islands)}")
        shift = obj.matrix_world.to_3x3().inverted() @ Vector((0, DINING_SHIFT, 0))
        for row in islands:
            for i in row["vertices"]:
                obj.data.vertices[i].co += shift
        obj.data.update()
    scene["straightArrivalDiningFittings"] = True


def fit_native_contacts(scene):
    """Replay against the authored house or its baked copy with the same topology."""
    import bmesh
    import bpy
    from coastal_shell import boolean

    if not scene.get("coastalArrivalStraightB"):
        raise ValueError("The straight B arrival must be authored first")
    fit_dining_fittings(scene)
    if scene.get(NATIVE_MARK):
        return

    def extent(obj, axis):
        values = [(obj.matrix_world @ vertex.co)[axis] for vertex in obj.data.vertices]
        return min(values), max(values)

    # The kerbs own the edge strips. Water and finished bed elevation stay put.
    outer = scene.objects["core_arrival_B_rill_kerb_outer"]
    inner = scene.objects["core_arrival_B_rill_kerb_inner"]
    bed = scene.objects["core_arrival_B_rill_bed"]
    inside = (extent(outer, 0)[1], extent(inner, 0)[0])
    old = extent(bed, 0)
    if abs(inside[1] - inside[0] - .4) > 1e-5:
        raise ValueError("Unexpected rill kerb opening")
    matrix = bed.matrix_world.copy()
    inverse = matrix.inverted()
    for vertex in bed.data.vertices:
        point = matrix @ vertex.co
        side = 0 if abs(point.x - old[0]) < 1e-5 else 1
        if abs(point.x - old[side]) >= 1e-5:
            raise ValueError("Expected the bed's two side planes")
        point.x = inside[side]
        vertex.co = inverse @ point
    bed.data.update()

    # Socket the landing into its actual sandstone. Keep the full top and
    # masonry skirt so the landing remains supported across the irregular lip.
    stone = scene.objects["core__golden coastal sandstone"]
    plinth = scene.objects["core_arrival_B_portal_plinth"]
    top = extent(plinth, 2)[1]

    def top_area():
        return sum(polygon.area for polygon in plinth.data.polygons if polygon.normal.z > .999
                   and all(abs((plinth.matrix_world @ plinth.data.vertices[index].co).z - top) < 1e-5
                           for index in polygon.vertices))

    before = top_area()
    boolean(plinth, stone, "DIFFERENCE")
    plinth.data.update()
    fitted = bmesh.new()
    fitted.from_mesh(plinth.data)
    try:
        if (abs(extent(plinth, 2)[1] - top) > 1e-5 or abs(top_area() - before) > 1e-5
                or not fitted.faces or any(not edge.is_manifold for edge in fitted.edges)
                or fitted.calc_volume(signed=True) <= 0):
            raise ValueError("Portal socket lost the finished top or a closed support face")
    finally:
        fitted.free()

    proxies = {obj["furniturePlaceholder"]: obj for obj in scene.objects
               if obj.get("furniturePlaceholder") in DINING_Z}
    if proxies.keys() != DINING_Z.keys():
        raise ValueError("Expected seven native dining stand-ins")
    for obj in proxies.values():
        transform = obj.matrix_world.copy()
        transform.translation.y += DINING_SHIFT
        obj.matrix_world = transform
    bpy.context.view_layer.update()
    scene[NATIVE_MARK] = True
    print(f"Fitted arrival contacts: {len(proxies)} dining stand-ins, {before:.6f} m² finished landing", flush=True)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--save-as", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--manifest-out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
    if (bool(args.manifest) != bool(args.manifest_out)
            or not (args.save_as or args.manifest)
            or (args.manifest and args.manifest.resolve() == args.manifest_out.resolve())):
        parser.error("Use a distinct --save-as or a --manifest/--manifest-out pair")
    if args.save_as:
        import bpy
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        if args.save_as.resolve() == Path(bpy.data.filepath).resolve():
            parser.error("Use a separate native output")
        fit_native_contacts(bpy.context.scene)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_as.resolve()), compress=True)
    if args.manifest:
        config = json.loads(args.manifest.read_text(encoding="utf-8"))
        fit_manifest_dining(config)
        args.manifest_out.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
