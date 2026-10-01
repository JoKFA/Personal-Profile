# The archive drive as a precision assembly: an encrypted storage module.
# Method after RhineLabUI's art/build_archive.py (MIT, github.com/LBEILC/RhineLabUI): thin layered
# parts with radiused edges, detail kept behind a frosted cover, one mesh per material for
# instancing. The design is our own: ivory end caps with titanium fasteners, a frosted shell, and
# behind it a secure element with its guard ring and a serpentine anti-tamper mesh, the way a
# hardware security module protects its keys.
#
# Run headless:  blender -b --python art/build_drive.py
# Writes public/assets/drive-module.glb. Blender is Z-up with the front toward -Y; glTF export
# turns that into the site's frame (y up, front toward +z).
import bpy, math, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── site frame: width 5 (x), height 3.7 (z here), thickness 0.46 (y here) ──
W, H, T = 5.0, 3.7, 0.376
CAP = 0.16                    # ivory end caps
FY = -T / 2                   # the front plane
BOARD_Y = -((T - 0.16) / 2 + 0.002)   # the substrate face; the site overlays its etched layer here


def material(name, color, rough=.4, metal=0., transmission=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = 1.46
    return m


shell = material('Frosted_Shell', (.985, .972, .955), .3, 0, .8)
frame = material('Ivory_Frame', (.955, .925, .885), .36)
diffuser = material('Diffuser', (.50, .39, .28), .7)
ceramic = material('Ceramic', (.62, .59, .56), .5, .05)
titanium = material('Titanium', (.74, .74, .72), .3, .6)
champagne = material('Champagne', (.66, .50, .32), .32, .55)
moulded = material('Moulded_Edge', (.93, .905, .87), .3)
engraving = material('Engraving', (.42, .39, .35), .6)


def cube(name, loc, size, mat, bevel=.01, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        m = o.modifiers.new('radiused edge', 'BEVEL'); m.width = bevel; m.segments = segments; m.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
        o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL').keep_sharp = True
    return o


def channel(name, pts, y, radius, mat):
    """A moulded channel following (x, z) points at depth y."""
    c = bpy.data.curves.new(name, 'CURVE'); c.dimensions = '3D'; c.bevel_depth = radius; c.bevel_resolution = 2
    s = c.splines.new('POLY'); s.points.add(len(pts) - 1)
    for p, (x, z) in zip(s.points, pts): p.co = (x, y, z, 1)
    o = bpy.data.objects.new(name, c); scene.collection.objects.link(o); c.materials.append(mat)
    return o


def text(name, body, x, z, size, mat, y=FY - 0.0015, spacing=1.1):
    c = bpy.data.curves.new(name, 'FONT'); c.body = body; c.size = size; c.extrude = .0004; c.space_character = spacing
    o = bpy.data.objects.new(name, c); scene.collection.objects.link(o)
    o.location = (x, y, z); o.rotation_euler = (math.pi / 2, 0, 0); c.materials.append(mat)
    return o


def screw(x, z, front=True):
    y = (FY - .012) if front else (-FY + .012)
    bpy.ops.mesh.primitive_cylinder_add(radius=.036, depth=.014, vertices=24, location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object; o.name = 'Fastener'; o.data.materials.append(titanium)
    m = o.modifiers.new('radiused edge', 'BEVEL'); m.width = .004; m.segments = 2
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons: p.use_smooth = True
    # hex recess
    bpy.ops.mesh.primitive_cylinder_add(radius=.014, depth=.004, vertices=6, location=(x, y + (-.006 if front else .006), z), rotation=(math.pi / 2, 0, 0))
    r = bpy.context.object; r.name = 'Fastener recess'; r.data.materials.append(engraving)


inner = W - 2 * CAP
# ── shell and carrier ──
# the covers stand proud of the top rail: from above, light falls on two rounded cover edges and
# into the recessed rail between them, a bright line, a shadowed groove, a bright line
cube('Front frosted cover', (0, FY + .0225, H / 2), (inner + .02, .045, H), shell, .02, 4)
cube('Rear frosted cover', (0, -FY - .0225, H / 2), (inner + .02, .045, H), shell, .02, 4)
cube('Top rail', (0, 0, H - .045), (inner + .02, T - .1, .07), frame, .012)
cube('Bottom rail', (0, 0, .03), (inner + .02, T - .03, .06), frame, .014)
for sx in (-1, 1):
    x = sx * (W / 2 - CAP / 2)
    cube('End cap', (x, 0, H / 2), (CAP, T + .03, H + .02), frame, .03, 4)
    cube('Cap seam', (sx * (W / 2 - CAP - .004), 0, H / 2), (.006, T + .006, H - .04), moulded, .002)
    for z in (.32, H - .32):
        screw(x, z, True); screw(x, z, False)
# the diffuser volume and the substrate inside
cube('Diffuser core', (0, 0, H / 2), (inner - .2, T - .16, H - .25), diffuser, .01)
cube('Substrate face', (0, BOARD_Y + .003, H / 2), (inner - .26, .006, H - .36), ceramic, .002)

# ── behind the frost: the secure element and its guard ring ──
SE = (1.0, 2.0)                                    # centre (x, z)
cube('Secure element', (SE[0], BOARD_Y - .012, SE[1]), (.82, .024, .64), ceramic, .006)
cube('Secure element lid', (SE[0], BOARD_Y - .025, SE[1]), (.62, .006, .44), champagne, .003)
for k, (w, h) in enumerate([(1.02, .84), (1.14, .96)]):
    x0, x1, z0, z1 = SE[0] - w / 2, SE[0] + w / 2, SE[1] - h / 2, SE[1] + h / 2
    channel('Guard ring', [(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)], BOARD_Y - .006 - k * .002, .005, moulded)
for i in range(9):                                 # bond pads along the lid
    cube('Bond pad', (SE[0] - .28 + i * .07, BOARD_Y - .016, SE[1] - .36), (.03, .006, .03), champagne, .002)
    cube('Bond pad', (SE[0] - .28 + i * .07, BOARD_Y - .016, SE[1] + .36), (.03, .006, .03), champagne, .002)

# ── the anti-tamper mesh: one serpentine track filling the lower left ──
pts, x, z, step, up = [], -2.02, .52, .07, True
while x < -.3:
    pts += [(x, .52 if up else 1.32), (x, 1.32 if up else .52)]
    x += step; up = not up
channel('Tamper mesh', pts, BOARD_Y - .004, .006, moulded)
channel('Tamper mesh return', [(-2.06, .46), (-.26, .46), (-.26, 1.38)], BOARD_Y - .004, .006, moulded)

# ── on the cover: engraving, calibration, vents ──
text('Edge inscription', 'Y W    E N C R Y P T E D    A R C H I V E', -2.2, .2, .085, engraving)
text('Spec', 'SEALED  ·  AES-256-GCM  ·  TAMPER-EVIDENT', .45, .2, .062, engraving)
for i in range(21):
    cube('Calibration mark', (-2.24, FY - .0012, .7 + i * .05), (.03 if i % 5 else .07, .003, .006), engraving, 0)
for i in range(14):
    o = cube('Laser vent', (1.25 + i * .055, FY - .0012, .62), (.022, .004, .11), engraving, .002); o.rotation_euler.y = .4
cube('Index inlay', (W / 2 - CAP / 2, FY - .016, H / 2), (.03, .01, .9), champagne, .004)
cube('Index inlay', (W / 2 - CAP / 2, -FY + .016, H / 2), (.03, .01, .9), champagne, .004)

# ── bake: text and curves to mesh, apply modifiers, one object per material ──
for o in list(scene.objects):
    bpy.context.view_layer.objects.active = o
    if o.type in ('FONT', 'CURVE'):
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.ops.object.convert(target='MESH')
    for m in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception: pass
for mat in list(bpy.data.materials):
    obs = [o for o in scene.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0] == mat]
    if not obs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join()
    o = bpy.context.object; o.name = mat.name
    scene.cursor.location = (0, 0, 0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

out = ROOT / 'public/assets/drive-module.glb'; out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_apply=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == 'MESH')
print('exported', out, 'groups', len(scene.objects), 'tris', tris)
