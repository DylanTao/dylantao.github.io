"""Preserve the two qualified geology meshes through Blender4.5.9 glTF export.

Blender's ordinary Mesh.validate() merges distinct native edge-chart ports and
removes opposite faces with the same vertex set. The site retains those exact
ports and corner fields. Only the two named, static, directed-closed meshes
bypass that destructive call. Their opaque POSITION stream is lossless; the
existing NORMAL8, COLOR6 and other meshes' codec settings remain unchanged.

This is an export adapter, not a native repair, volume certificate, LOD change,
or publication gate. Native fields/body/volume, actual WASM, and budgets still
need their independent qualification.
"""
from collections import Counter
from pathlib import Path
import difflib
import hashlib
import inspect
import json


OWNERS = frozenset(("core__golden coastal sandstone", "coast_shared_golden coastal sandstone"))
INSTALLED_NODES_SHA256 = "1666975fb1262cb5ebc5ba618def33836a87c30911bc7ad2c7119448526fce2d"
INSTALLED_GATHER_SHA256 = "90ed015df9ab5dc6578395d7e9cb84f680b2d625cfc4e50faf6be52870fa2209"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def qualify_static_ports(obj):
    """Read native port identities, including parallel edges; never validate/weld."""
    import bpy
    import numpy as np

    users = [o for o in bpy.data.objects if o.type == "MESH" and o.data == obj.data]
    if obj.type != "MESH" or obj.modifiers or obj.data.shape_keys or len(users) != 1:
        raise RuntimeError("Geology custody requires a unique, static native mesh: " + obj.name)
    mesh = obj.data
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    normals = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    if not np.isfinite(positions).all() or not np.isfinite(normals).all():
        raise RuntimeError("Nonfinite geology field: " + obj.name)
    incidence, direction = Counter(), Counter()
    for face in mesh.polygons:
        loops = list(face.loop_indices)
        for li, lj in zip(loops, loops[1:] + loops[:1]):
            loop = mesh.loops[li]
            a, b = loop.vertex_index, mesh.loops[lj].vertex_index
            edge = mesh.edges[loop.edge_index]
            u, v = edge.vertices
            if {a, b} != {u, v}:
                raise RuntimeError("Native geology edge endpoint mismatch: " + obj.name)
            incidence[edge.index] += 1
            direction[edge.index] += 1 if (a, b) == (u, v) else -1
    if any(incidence[i] != 2 or direction[i] != 0 for i in range(len(mesh.edges))):
        raise RuntimeError("Native geology directed port boundary: " + obj.name)
    return {"vertices": len(mesh.vertices), "faces": len(mesh.polygons),
            "loops": len(mesh.loops), "explicitEdges": len(mesh.edges),
            "endpointFailures": 0, "incidenceFailures": 0, "directedFailures": 0}


class ExportCustody:
    def __init__(self, source, expected_source_sha256, archive):
        import bpy
        from io_scene_gltf2.blender.exp import nodes
        from io_scene_gltf2.io.exp import draco

        if bpy.app.version != (4, 5, 9):
            raise RuntimeError("Geology export custody requires Blender4.5.9")
        self.source = Path(source).resolve()
        self.source_hash = expected_source_sha256
        if sha(self.source) != self.source_hash:
            raise RuntimeError("Geology source SHA changed before export")
        self.archive = Path(archive).resolve()
        self.archive.mkdir(parents=True, exist_ok=False)
        self.nodes_path = Path(nodes.__file__)
        if sha(self.nodes_path) != INSTALLED_NODES_SHA256:
            raise RuntimeError("Installed glTF gatherer bytes differ; requalify the narrow adapter")
        original_source = inspect.getsource(getattr(nodes, "__gather_mesh"))
        if hashlib.sha256(original_source.encode()).hexdigest() != INSTALLED_GATHER_SHA256:
            raise RuntimeError("Installed gatherer function differs")
        old_line = "res = blender_object.data.validate()"
        if original_source.count(old_line) != 1:
            raise RuntimeError("Gatherer validation hunk differs")
        adapted_source = original_source.replace(old_line, "res = _coastal_guarded_validate(blender_object)")
        (self.archive / "gather-mesh-original.py").write_text(original_source, encoding="utf-8")
        (self.archive / "gather-mesh-adapted.py").write_text(adapted_source, encoding="utf-8")
        (self.archive / "PRECISE-DIFF.txt").write_text("".join(difflib.unified_diff(
            original_source.splitlines(True), adapted_source.splitlines(True),
            fromfile="installed-original", tofile="private-adapter")), encoding="utf-8")
        self.validation_calls, self.codec_calls = [], []
        self.current_owner = None

        def guarded_validate(obj):
            if obj.name not in OWNERS:
                changed = obj.data.validate()
                self.validation_calls.append({"owner": obj.name, "ordinaryValidationExecuted": True,
                                              "changedByOrdinaryValidation": changed})
                return changed
            result = qualify_static_ports(obj)
            self.validation_calls.append({"owner": obj.name, "ordinaryValidationExecuted": False,
                                          "nativePortGuard": result})
            return False

        nodes._coastal_guarded_validate = guarded_validate
        exec(compile(adapted_source, str(self.archive / "gather-mesh-adapted.py"), "exec"), nodes.__dict__)
        original_node = getattr(draco, "__encode_node")
        original_primitive = getattr(draco, "__encode_primitive")
        if tuple(inspect.signature(original_primitive).parameters) != (
            "primitive", "dll", "export_settings", "encoded_primitives_cache"
        ):
            raise RuntimeError("Installed Draco primitive signature differs")

        def observed_node(node, dll, settings, cache):
            previous, self.current_owner = self.current_owner, node.name
            try:
                return original_node(node, dll, settings, cache)
            finally:
                self.current_owner = previous

        def encode(primitive, dll, export_settings, encoded_primitives_cache):
            settings, cache = export_settings, encoded_primitives_cache
            material = primitive.material
            name = getattr(material, "name", None)
            extensions = getattr(material, "extensions", None) or {}
            transmission = extensions.get("KHR_materials_transmission", {})
            transmission = getattr(transmission, "extension", transmission) or {}
            pbr = getattr(material, "pbr_metallic_roughness", None)
            base = getattr(pbr, "base_color_factor", None) or [1, 1, 1, 1]
            opaque = (getattr(material, "alpha_mode", None) in (None, "OPAQUE")
                      and float(base[3]) >= .999 and not transmission.get("transmissionFactor", 0))
            selected = self.current_owner in OWNERS
            actual = dict(settings) if selected else settings
            if selected:
                if not opaque or settings["gltf_draco_normal_quantization"] != 8:
                    raise RuntimeError("Requalify changed geology material/normal policy")
                actual["gltf_draco_position_quantization"] = 0
            self.codec_calls.append({"owner": self.current_owner, "material": name,
                                     "selectedGeology": selected,
                                     "positionBefore": settings["gltf_draco_position_quantization"],
                                     "positionActual": actual["gltf_draco_position_quantization"],
                                     "normalBitsUnchanged": actual["gltf_draco_normal_quantization"]})
            return original_primitive(primitive, dll, actual, cache)

        setattr(draco, "__encode_node", observed_node)
        setattr(draco, "__encode_primitive", encode)
        self.original_source, self.adapted_source = original_source, adapted_source

    def finish(self):
        report = {"source": str(self.source), "sourceSha256": self.source_hash,
                  "sourceUnchanged": sha(self.source) == self.source_hash,
                  "installedNodesSha256": INSTALLED_NODES_SHA256,
                  "installedSdkBytesUnchanged": sha(self.nodes_path) == INSTALLED_NODES_SHA256,
                  "originalFunctionSha256": hashlib.sha256(self.original_source.encode()).hexdigest(),
                  "adaptedFunctionSha256": hashlib.sha256(self.adapted_source.encode()).hexdigest(),
                  "owningHelperSha256": sha(__file__), "validationCalls": self.validation_calls,
                  "codecCalls": self.codec_calls,
                  "limit": "Only export preservation. Independent source/field/body/volume, production-WASM, exact geometric-chain, budgets and appearance gates remain required."}
        report["passed"] = report["sourceUnchanged"] and report["installedSdkBytesUnchanged"]
        (self.archive / "CUSTODY.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        if not report["passed"]:
            raise RuntimeError("Source or installed SDK changed during export")
        return report


def install_geology_export_custody(source, expected_source_sha256, archive):
    return ExportCustody(source, expected_source_sha256, archive)
