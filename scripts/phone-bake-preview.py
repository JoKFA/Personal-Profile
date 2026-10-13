# PM preview: the phone (a vw x vh browser viewport) simulated offline from the baked frames.
#   entrance -> cover -> pan to X-001 -> pan to SR-01 -> pan back to X-001 -> open X-001 (window) -> close X-001
# The stage fit rule (PM, 10-12):
#   cover = max(vw / master.w, vh / master.h)            the master always covers the viewport
#   fit   = min(vw * 0.62 / reticleW, bandH * 0.9 / reticleH)        band = 64 .. vh - panel; panel 252 (cover stop 168), 150 when vh < 600
#   s     = max(cover, min(fit, 1.1))
#   the reticle is centred in the band; taller than the band: its top sits at band top + 8; then the translation is clamped so the
#   master still covers the viewport (tx in [vw - master.w * s, 0], ty in [vh - master.h * s, 0])
#   window: s = vw / master.w, top-aligned; open / close: the transform moves by the frame's camK; pans: smoothstep of the clip's progress
# usage: python phone-bake-preview.py <public/phone dir> <out dir> [vw vh]
import sys, os, json, glob, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
vw, vh = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (390, 664)
M = json.load(open(os.path.join(d, 'manifest.json')))
MW, MH = M['master']['w'], M['master']['h']
SC = 2  # output pixels per css px
os.makedirs(out, exist_ok=True)
tmp = os.path.join(out, '_frames'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)

def decode(name, file):
    p = os.path.join(tmp, name); os.makedirs(p)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, file), os.path.join(p, 'f-%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(p, 'f-*.png')))

def stop_T(id):
    r = M['stops'][id]['reticle']; rw, rh = r['x1'] - r['x0'], r['y1'] - r['y0']
    panel = 150 if vh < 600 else (168 if id == 'YW-000' else 252)
    b0, b1 = 64, vh - panel; bh = b1 - b0
    cover = max(vw / MW, vh / MH)
    fit = min(vw * 0.62 / rw, bh * 0.9 / rh)
    s = max(cover, min(fit, 1.1))
    cx, cy = (r['x0'] + r['x1']) / 2, (r['y0'] + r['y1']) / 2
    tx = vw / 2 - s * cx
    ty = (b0 + b1) / 2 - s * cy
    if rh * s > bh: ty = b0 + 8 - s * r['y0']
    tx = min(0.0, max(vw - MW * s, tx)); ty = min(0.0, max(vh - MH * s, ty))
    return (s, tx, ty)   # screen = s * master + (tx, ty)
WIN_T = (vw / MW, 0.0, 0.0)
lerp = lambda a, b, t: tuple(x + (y - x) * t for x, y in zip(a, b))
smooth = lambda t: t * t * (3 - 2 * t)

def uncovered(T):
    s, ox, oy = T
    # fraction of the viewport the master does not reach
    x0, y0, x1, y1 = ox, oy, ox + s * MW, oy + s * MH
    cw = max(0, min(vw, x1) - max(0, x0)); ch = max(0, min(vh, y1) - max(0, y0))
    return 1 - (cw * ch) / (vw * vh)

def render(img, T):
    s, ox, oy = T
    w, h = round(MW * s * SC), round(MH * s * SC)
    im = img.convert('RGB').resize((w, h), Image.LANCZOS)
    W, H = vw * SC, vh * SC
    # paste with edge replication where the master does not cover the viewport
    X0, Y0 = round(ox * SC), round(oy * SC)
    canvas = Image.new('RGB', (W, H))
    padded = np.asarray(im)
    pl, pt = max(0, X0), max(0, Y0)
    pr, pb = max(0, W - (X0 + w)), max(0, H - (Y0 + h))
    arr = np.pad(padded, ((pt, pb), (pl, pr), (0, 0)), mode='edge')
    ax, ay = max(0, -X0), max(0, -Y0)
    arr = arr[ay:ay + H, ax:ax + W]
    return Image.fromarray(arr[:H, :W])

frames = []   # (PIL image or path, T, label)
def still(file): return Image.open(os.path.join(d, file))
def add_hold(file, T, n, label):
    im = still(file)
    for _ in range(n): frames.append((im, T, label))
def add_clip(name, c, Tf, label):
    fs = decode(name, c['file'])
    for i, f in enumerate(fs): frames.append((f, Tf(i, len(fs)), label))

cover = M['stops']['YW-000']; T_cov = stop_T('YW-000'); T_x1 = stop_T('X-001'); T_sr = stop_T('SR-01')
add_clip('entrance', M['entrance'], lambda i, n: T_cov, 'entrance')
add_hold(cover['still']['file'], T_cov, 20, 'cover')
add_clip('pan1', M['pans']['YW-000>X-001'], lambda i, n: lerp(T_cov, T_x1, smooth(i / (n - 1))), 'pan YW-000 > X-001')
add_hold(M['stops']['X-001']['still']['file'], T_x1, 20, 'X-001')
add_clip('pan2', M['pans']['X-001>SR-01'], lambda i, n: lerp(T_x1, T_sr, smooth(i / (n - 1))), 'pan X-001 > SR-01')
add_hold(M['stops']['SR-01']['still']['file'], T_sr, 20, 'SR-01')
add_clip('pan3', M['pans']['SR-01>X-001'], lambda i, n: lerp(T_sr, T_x1, smooth(i / (n - 1))), 'pan SR-01 > X-001')
add_hold(M['stops']['X-001']['still']['file'], T_x1, 20, 'X-001')
o = M['open']['X-001']
add_clip('open', o, lambda i, n: lerp(T_x1, WIN_T, o['cam'][i]), 'open X-001')
add_hold(o['window']['file'], WIN_T, 30, 'window')
c = M['close']['X-001']
add_clip('close', c, lambda i, n: lerp(T_x1, WIN_T, c['cam'][i]), 'close X-001')
add_hold(M['stops']['X-001']['still']['file'], T_x1, 20, 'X-001')

# render
seq = os.path.join(out, '_seq'); shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
labels = []
for i, (f, T, label) in enumerate(frames):
    img = f if isinstance(f, Image.Image) else Image.open(f)
    render(img, T).save(os.path.join(seq, f'f-{i + 1:04d}.png'), compress_level=1); labels.append(label)
mp4 = os.path.join(out, f'phone-preview-{vw}x{vh}.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '25', '-i', os.path.join(seq, 'f-%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4], check=True)

# contact sheet: one frame every 0.2 s
idx = list(range(0, len(frames), 5)); cols = 10; tw, th = vw, vh
rows = (len(idx) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 16)), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
for k, i in enumerate(idx):
    im = Image.open(os.path.join(seq, f'f-{i + 1:04d}.png')).resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, (k // cols) * (th + 16)
    sheet.paste(im, (x, y + 16)); dr.text((x + 3, y + 2), f'{i / 25:.1f}s {labels[i]}', fill=(255, 255, 255))
sheet.save(os.path.join(out, f'phone-preview-{vw}x{vh}-sheet.jpg'), quality=85)
shutil.rmtree(seq); shutil.rmtree(tmp)
info = {'viewport': [vw, vh], 'frames': len(frames), 'seconds': len(frames) / 25,
        'transforms': {k: {'s': round(v[0], 4), 'ox': round(v[1], 1), 'oy': round(v[2], 1), 'uncovered_viewport_fraction': round(uncovered(v), 4)} for k, v in {'cover': T_cov, 'X-001': T_x1, 'SR-01': T_sr, 'window': WIN_T}.items()}}
json.dump(info, open(os.path.join(out, f'phone-preview-{vw}x{vh}.json'), 'w'), indent=1)
print(json.dumps(info))
