"""Install the Onsen-side noren rail in the current arrival hall's upper reveal.

Call install_onsen_noren(bpy.context.scene) before refreshing the house export
and light cache. Runtime fabric uses only this rail's final web-frame extra.
"""

import json

import bpy

from coastal_decor import material
from coastal_office import Parts, box, cylinder

FRAME = {
    "version": 1,
    "translation": [2.70, 4.74, 15.55],
    "yaw": 0,
    "span": 1.08,
    "drop": 0.96,
}
PREFIX = "core_onsen_noren__"
LAUNDRY_POSTS = "core_laundry_frame_posts"


def install_onsen_noren(scene):
    """Replace the owned laundry hardware and set the bronze rail in its stone returns."""
    for obj in list(scene.objects):
        if obj.name.startswith(PREFIX) or (obj.name == LAUNDRY_POSTS and obj.get("nativeLaundryFrame")):
            bpy.data.objects.remove(obj, do_unlink=True)

    x, crown, z = FRAME["translation"]
    half = FRAME["span"] / 2
    bronze = material("onsen noren oiled bronze", (0.19, 0.117, 0.069), 0.43, 0.78)
    parts = Parts("core_onsen_noren")
    metal = parts.bm(bronze)
    ends = (x - half - 0.043, x + half + 0.043)
    # The slim channel grips the two staggered linen sleeves along their whole header.
    box(metal, (x, -z, crown), (ends[1] - ends[0], 0.104, 0.03), radius=0.004)
    for end in ends:
        # Returns seat into the interior side of the sandstone reveal at 15.62 m.
        cylinder(metal, (end, -z, crown), (end, -15.628, crown), 0.009, 12)
        box(metal, (end, -15.616, crown), (0.038, 0.013, 0.036), radius=0.004)
    objects = parts.finish()
    for obj in objects:
        obj["nativeNorenFrame"] = json.dumps(FRAME, separators=(",", ":"))
        obj["installationGroup"] = "upper"
    return objects
