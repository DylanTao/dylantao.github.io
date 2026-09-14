"""A neutral render of the actual local Hunyuan mesh, for comparison with its inputs."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'artwork/la-jolla/reconstruction/multiview-shape.glb'))
bpy.ops.object.light_add(type='AREA',location=(-3,-4,5));bpy.context.object.data.energy=500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add(location=(2.6,-3.8,2.7));cam=bpy.context.object;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8
s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.samples=16;s.world.color=(.5,.5,.5);s.render.resolution_x=s.render.resolution_y=800;s.render.resolution_percentage=100
s.render.filepath=str(ROOT/'artwork/la-jolla/reconstruction/clay.png');bpy.ops.render.render(write_still=True)
