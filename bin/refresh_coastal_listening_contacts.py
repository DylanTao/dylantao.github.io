"""Rebuild only the fitted contact surfaces in the already authored coastal source.

    blender --background INPUT.blend --python-exit-code 1 --python \
        bin/refresh_coastal_listening_contacts.py -- --save-as=OUTPUT.blend

Pass --fit-sleeve to fit just the featured LP and its walnut cradle.
Rebake the changed receivers before delivering the refreshed shell.
"""

import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coastal_cliff_lift as lift
import coastal_listening_bar as bar
import coastal_listening_joinery as timber


ARCHITECTURE = {"plinth", "gable", "cut_vault"}
JOINERY = {"sofa_seat", "sofa_back", "record_sleeves", "featured_sleeve", "sleeve_ledge", "small_tables"}


def originals_for(prefix, pieces):
    return {
        obj.name: obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.name.startswith(prefix)
        and obj.name.removeprefix(prefix).split("__")[0] in pieces
    }


def install(originals, fresh, prefix):
    replacements = {f"{prefix}{piece}__{obj.data.materials[0].name}": obj for piece, obj in fresh}
    if originals.keys() != replacements.keys():
        raise ValueError(f"Unexpected installed contacts: {originals.keys() ^ replacements.keys()}")
    for name, original in originals.items():
        new = replacements[name]
        if original.matrix_world != new.matrix_world:
            raise ValueError(f"Native transform differs for {name}")
        timber.map_finish(new)
        old_data = original.data
        original.data = new.data
        if "bakedLighting" in original:
            del original["bakedLighting"]
        bpy.data.objects.remove(new, do_unlink=True)
        if not old_data.users:
            bpy.data.meshes.remove(old_data)
        print(f"[listening contacts] {name}", flush=True)


def refresh(*, sleeve_only=False):
    scene = bpy.context.scene
    if not scene.get("studyReadingThresholdCut"):
        raise ValueError("This refresh expects the existing listening room, study threshold and lift")
    jobs = (
        (bar.PREFIX, "speakeasy", ARCHITECTURE, bar.architecture),
        (bar.PREFIX, "speakeasy", JOINERY, bar.listening_end),
        (lift.PREFIX, "cliff-lift", {"gallery_lamp"}, lift.structure),
    )
    if sleeve_only:
        jobs = ((bar.PREFIX, "speakeasy", {"featured_sleeve", "sleeve_ledge"}, bar.listening_end),)
    for prefix, group, pieces, build in jobs:
        old = originals_for(prefix, pieces)
        builder = bar.Joinery(prefix, group)
        build(builder)
        install(old, builder.finish(pieces), prefix)
    if not sleeve_only:
        study = bar.PREFIX + "study_"
        old = originals_for(study, {"nook"})
        install(old, bar.reading_threshold({"nook"}), study)
    bpy.context.view_layer.update()


if __name__ == "__main__":
    dest = Path(next(a.split("=", 1)[1] for a in sys.argv if a.startswith("--save-as="))).resolve()
    if dest == Path(bpy.data.filepath).resolve():
        raise ValueError("Write the refreshed contacts to a separate Blender file")
    refresh(sleeve_only="--fit-sleeve" in sys.argv)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dest), compress=True)
