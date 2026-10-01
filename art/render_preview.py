# Preview render of the drive model: builds it, then renders a 3/4 front view with Eevee.
#   blender -b --python art/render_preview.py
# Writes art/.cache/preview.png (not shipped).
import bpy, math, runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / 'art/build_drive.py'))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
world = bpy.data.worlds.new('studio'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.92, 0.9, 0.87, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
sun = bpy.data.lights.new('key', 'SUN'); sun.energy = 3.5
k = bpy.data.objects.new('key', sun); scene.collection.objects.link(k); k.rotation_euler = (math.radians(50), 0, math.radians(-35))
cam = bpy.data.cameras.new('cam'); cam.lens = 85
c = bpy.data.objects.new('cam', cam); scene.collection.objects.link(c); scene.camera = c
c.location = (-4.5, -11.5, 4.2)
direction = (0 - c.location[0], 0 - c.location[1], 1.85 - c.location[2])
from mathutils import Vector
c.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
out = ROOT / 'art/.cache/preview.png'; out.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
print('rendered', out)
