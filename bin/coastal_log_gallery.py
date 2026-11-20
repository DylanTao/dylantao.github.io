"""Build the fixed living-wall oak gallery and its dry split-wood stack."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from math import cos, sin
from pathlib import Path
from random import Random
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_office import Parts, box


PREFIX = "core_living_log_gallery"
BAY_X = (2.05, 3.10)
BAY_Z = (15.24, 15.60)
HEIGHT = 0.52
SHELF_Y = 0.077


def native(x, y, z):
    return (x, -z, y)


def material(name, color, roughness):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = mat.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def insert_box(parts, surface, low, high, radius=0.0):
    origin = native(*(sum(pair) / 2 for pair in zip(low, high)))
    size = high[0] - low[0], high[2] - low[2], high[1] - low[1]
    box(parts.bm(surface), origin, size, radius, segments=2)


def body_parts():
    oak = bpy.data.materials.get("pale oak")
    if oak is None:
        raise ValueError("The living gallery requires the loft's pale oak")
    back = material("gallery charcoal oak back", (0.073, 0.052, 0.036), 0.78)
    stone = material("gallery honed smoke limestone", (0.43, 0.405, 0.351), 0.62)
    parts = Parts(PREFIX)
    insert_box(parts, back, (2.09, 0, 15.289), (2.132, 0.031, 15.545), 0.002)
    insert_box(parts, back, (3.018, 0, 15.289), (3.060, 0.031, 15.545), 0.002)
    insert_box(parts, oak, (2.072, 0.029, 15.266), (3.078, SHELF_Y, 15.58), 0.005)
    insert_box(parts, oak, (2.072, SHELF_Y - .001, 15.266), (2.118, 0.471, 15.578), 0.005)
    insert_box(parts, oak, (3.032, SHELF_Y - .001, 15.266), (3.078, 0.471, 15.578), 0.005)
    insert_box(parts, oak, (2.116, 0.443, 15.263), (3.034, 0.469, 15.578), 0.004)
    insert_box(parts, back, (2.115, SHELF_Y - .001, 15.556), (3.035, 0.444, 15.58), 0.003)
    insert_box(parts, stone, (BAY_X[0], 0.469, BAY_Z[0]), (BAY_X[1], HEIGHT, BAY_Z[1]), 0.005)
    objects = parts.finish()
    for obj in objects:
        obj["walk"] = "solid"
        obj["closedSolid"] = True
    return objects


class Trimmings:
    def __init__(self, materials):
        self.vertices = []
        self.faces = []
        self.slots = []
        self.materials = materials

    def polygon(self, points, material_index):
        first = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(first, len(self.vertices))))
        self.slots.append(material_index)

    def finish(self, scene, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        for material in self.materials:
            mesh.materials.append(material)
        for polygon, slot in zip(mesh.polygons, self.slots):
            polygon.material_index = slot
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(obj)
        obj["walk"] = "through"
        return obj


def split_profile(random, width, height, turn):
    extent = random.uniform(0.9, 1.46)
    arc_count = random.randint(5, 7)
    angles = [turn + extent * (2 * i / (arc_count - 1) - 1) for i in range(arc_count)]
    radii = [random.uniform(0.86, 1.04) for _ in angles]
    outer = [(r * cos(theta), r * sin(theta)) for r, theta in zip(radii, angles)]
    # The two cleft planes meet off centre. The perimeter is bark only along
    # the continuous arc from the original trunk, never on the split faces.
    cleft = (0.05 * cos(turn) + 0.028, 0.08 * sin(turn) - 0.035)
    corners = [cleft, *outer]
    lo = (min(x for x, _ in corners), min(y for _, y in corners))
    hi = (max(x for x, _ in corners), max(y for _, y in corners))
    def scale(point):
        return ((point[0] - lo[0]) * width / (hi[0] - lo[0]), (point[1] - lo[1]) * height / (hi[1] - lo[1]))
    return corners, angles, min(radii), scale


def face_range(corners, along_x):
    intersections = []
    for a, b in zip(corners, corners[1:] + corners[:1]):
        if abs(b[0] - a[0]) < 1e-9:
            if abs(along_x - a[0]) < 1e-9:
                intersections.extend((a[1], b[1]))
        elif min(a[0], b[0]) - 1e-9 <= along_x <= max(a[0], b[0]) + 1e-9:
            amount = (along_x - a[0]) / (b[0] - a[0])
            intersections.append(a[1] + amount * (b[1] - a[1]))
    return (min(intersections), max(intersections)) if intersections else None


def rest_on(projected, prior):
    required = SHELF_Y
    solver_x = min(point[0] for point in projected), max(point[0] for point in projected)
    for row in prior:
        left = max(solver_x[0], min(p[0] for p in row))
        right = min(solver_x[1], max(p[0] for p in row))
        if left > right:
            continue
        breakpoints = {left, right, *(p[0] for p in projected + row if left < p[0] < right)}
        for x in breakpoints:
            lower, upper = face_range(row, x), face_range(projected, x)
            if lower and upper:
                required = max(required, lower[1] - upper[0] + 0.00035)
    return required


def make_stack(scene):
    cleft_materials = [
        material("split wood chalk cleft", (0.69, 0.51, 0.326), 0.82),
        material("split wood pale radial cleft", (0.83, 0.668, 0.434), 0.79),
        material("split wood subdued radial cleft", (0.73, 0.568, 0.363), 0.82),
    ]
    end_materials = [
        material("split wood dry end grain", (0.77, 0.61, 0.414), 0.80),
        material("split wood tawny end grain", (0.64, 0.464, 0.285), 0.82),
        material("split wood sapwood end", (0.855, 0.701, 0.49), 0.78),
    ]
    bark = [
        material("split wood ash bark", (0.253, 0.185, 0.132), 0.90),
        material("split wood narrow bark fissure", (0.119, 0.087, 0.066), 0.94),
        material("split wood lifted bark edge", (0.332, 0.253, 0.187), 0.88),
    ]
    annual = material("split wood dry growth rings", (0.53, 0.374, 0.216), 0.84)
    check = material("split wood dark end checks", (0.227, 0.143, 0.084), 0.89)
    surfaces = [*end_materials, *cleft_materials, *bark]
    grains = Trimmings([annual, check])
    random = Random(239101)
    # Lower row and the staggered upper row use different profiles and log
    # lengths. The right bay and a notch above the middle remain open.
    layout = (
        (2.133, .122, .118,  .22, 0),
        (2.271, .128, .109, 2.04, 0),
        (2.413, .134, .147, 4.12, 0),
        (2.567, .128, .108, 1.15, 0),
        (2.707, .136, .129, 5.63, 0),
        (2.169, .139, .110, 4.67, 1),
        (2.325, .124, .115, 0.82, 1),
        (2.535, .126, .123, 2.63, 1),
        (2.673, .139, .103, 5.13, 1),
    )
    prior = []
    result = []
    for index, (left, width, height, turn, row) in enumerate(layout):
        left += 0.158  # The open overflow is on the visitor's right.
        corners, angles, radius, scale = split_profile(random, width, height, turn)
        projection = [(left + a, b) for a, b in map(scale, corners)]
        toe = rest_on(projection, prior) if row else SHELF_Y
        world = [(x, y + toe) for x, y in projection]
        prior.append(world)
        front = random.uniform(15.292, 15.331)
        rear = random.uniform(15.498, 15.538)
        bevel = random.uniform(-.017, .015)
        nodes = [
            native(x, y, depth + bevel * (x - left) / width)
            for depth in (front, rear)
            for x, y in world
        ]
        n = len(world)
        faces = [list(reversed(range(n))), list(range(n, 2*n))]
        faces.extend((i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n))
        name = f"{PREFIX}_billet_{index + 1:02d}"
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(nodes, [], faces)
        for surface in surfaces:
            mesh.materials.append(surface)
        mesh.polygons[0].material_index = index % 3
        mesh.polygons[1].material_index = (index + 1) % 3
        for j, face in enumerate(mesh.polygons[2:]):
            face.material_index = (3 + (index + j) % 3) if j in (0, n-1) else 6 + random.randrange(3)
        mesh.update()
        item = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(item)
        item["walk"] = "through"
        item["closedSolid"] = True
        item["splitDryLog"] = True
        result.append(item)

        def face_point(r, angle, direction):
            x, y = scale((r*cos(angle), r*sin(angle)))
            plane = front if direction < 0 else rear
            return native(x+left, y+toe, plane + bevel*x/width + .00072*direction)

        # The fixed dark cabinet back seals the rear ends from view.
        end = -1
        for ring in range(3, 8):
            r = radius * ring / 9
            width_fraction = random.uniform(.0033, .0072)
            first = angles[0] + random.uniform(.044, .077)
            last = angles[-1] - random.uniform(.044, .077)
            for k in range(9):
                if (k + index + ring) % 9 == 0:
                    continue
                a, b = [first+(last-first)*t/9 for t in (k, k+1)]
                grains.polygon([face_point(r,a,end), face_point(r,b,end),
                    face_point(r+width_fraction,b,end), face_point(r+width_fraction,a,end)], 0)
        if (index + end) % 3:
            a = turn + random.uniform(-.37, .37)
            grains.polygon([face_point(radius*.38,a,end), face_point(radius*.86,a+.021,end),
                face_point(radius*.89,a-.012,end)], 1)
    result.append(grains.finish(scene, PREFIX + "_endgrain_checks"))
    return result


def build_gallery(scene):
    if any(obj.name.startswith(PREFIX) for obj in scene.objects):
        raise ValueError("The living gallery is already present")
    objects = [*body_parts(), *make_stack(scene)]
    bpy.context.view_layer.update()
    for obj in objects:
        obj["installationGroup"] = "living"
        obj["architectureComponent"] = "fixed living room log gallery"
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    if (low[0] < BAY_X[0] - 1e-5 or high[0] > BAY_X[1] + 1e-5 or
        low[1] < -BAY_Z[1] - 1e-5 or high[1] > -BAY_Z[0] + 1e-5 or
        low[2] < -1e-5 or high[2] > HEIGHT + 1e-5):
        raise ValueError(f"Gallery exceeded its verified wall bay: {low}, {high}")
    return {
        "nativeBounds": [low, high],
        "webBounds": [[low[0], low[2], -high[1]], [high[0], high[2], -low[1]]],
        "objects": [obj.name for obj in objects],
        "billets": sum(bool(obj.get("splitDryLog")) for obj in objects),
    }


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source, output, report = (p.resolve() for p in (args.source, args.output, args.report))
    if len({source, output, report}) != 3 or sha256(source.read_bytes()).hexdigest() != args.expected_source:
        parser.error("Pin the input by SHA-256 and use distinct output paths")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result = build_gallery(bpy.context.scene)
    output.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    result.update({"sourceSha256": args.expected_source, "outputSha256": sha256(output.read_bytes()).hexdigest()})
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
