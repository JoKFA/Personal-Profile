# PM film of the profile drive's interior (P3c), simulated offline on a 390 x 664 phone from the baked clips (no page layer but the paper):
#   cover -> door -> intro -> station 1 -> flight -> station 2 -> out-2 -> exit -> cover   (stations 1-based here; the manifest's keys are 0-based) The stage: the cover is fitted like the reel's cover stop; the door
# moves to the window fit (s = vw / 480, top aligned) by the shot's cam; the interior is on the window fit; the exit moves back by its cam.
# The paper (semi-transparent) is where the page lays out: the top bar, and below the interior's region (master y 536) the words.
# usage: python phone-bake-film-space.py <public/phone dir> <out dir> [vw vh]
import sys, os, json, glob, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
vw, vh = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (390, 664)
M = json.load(open(os.path.join(d, 'manifest.json'))); S = json.load(open(os.path.join(d, M['space']['file'])))
MW, MH = 480, 960; SC = 2
os.makedirs(out, exist_ok=True)
tmp = os.path.join(out, '_frames'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
lerp = lambda a, b, t: tuple(x + (y - x) * t for x, y in zip(a, b))

def decode(name, file):
    p = os.path.join(tmp, name); os.makedirs(p)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, file), os.path.join(p, 'f-%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(p, 'f-*.png')))

# the cover's fit (PM rule of 10-13: band 250 .. vh - 80, s = max(cover, min(fit, 1.1)), face-centred, clamped to cover)
r = M['stops']['YW-000']['reticle']; rw, rh = r['x1'] - r['x0'], r['y1'] - r['y0']
b0, b1 = 250, vh - 80; bh = b1 - b0
s = max(max(vw / MW, vh / MH), min(min(vw * 0.62 / rw, bh * 0.9 / rh), 1.1)); cx, cy = (r['x0'] + r['x1']) / 2, (r['y0'] + r['y1']) / 2
ty = (b0 + b1) / 2 - s * cy
faceH = (rh - 24) / 1.1
if faceH * s > bh: ty = b1 - (cy + faceH / 2) * s
T_cov = (s, min(0.0, max(vw - MW * s, vw / 2 - s * cx)), min(0.0, max(vh - MH * s, ty)))
WIN = (vw / MW, 0.0, 0.0)
O_cov = (250, 80)                       # the cover's sheet and one-line panel (heights, css px)
O_in = (64, vh - 536 * WIN[0])          # the bar, and the paper under the interior's region

PAPER = (231, 228, 221)
def render(img, T, ov):
    s, ox, oy = T
    w, h = round(MW * s * SC), round(MH * s * SC)
    im = img.convert('RGB').resize((w, h), Image.LANCZOS)
    W, H = vw * SC, vh * SC
    X0, Y0 = round(ox * SC), round(oy * SC)
    pl, pt = max(0, X0), max(0, Y0); pr, pb = max(0, W - (X0 + w)), max(0, H - (Y0 + h))
    arr = np.pad(np.asarray(im), ((pt, pb), (pl, pr), (0, 0)), mode='edge')
    arr = arr[max(0, -Y0):max(0, -Y0) + H, max(0, -X0):max(0, -X0) + W]
    base = Image.fromarray(arr[:H, :W]).convert('RGBA')
    lay = Image.new('RGBA', base.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(lay); a = (*PAPER, 215)
    if ov[0] > 0: dr.rectangle([0, 0, W, round(ov[0] * SC)], fill=a)
    if ov[1] > 0: dr.rectangle([0, H - round(ov[1] * SC), W, H], fill=a)
    return Image.alpha_composite(base, lay).convert('RGB')

frames = []   # (source, T, overlay, label)
def hold(file, T, ov, n, label):
    im = Image.open(os.path.join(d, file))
    frames.extend([(im, T, ov, label)] * n)
def clip(name, file, Tf, Of, label):
    fs = decode(name, file); n = len(fs)
    for i, f in enumerate(fs): frames.append((f, Tf(i, n), Of(i, n), label))

cover = M['stops']['YW-000']['still']['file']
hold(cover, T_cov, O_cov, 20, 'cover')
dr_ = M['door']['YW-000']
clip('door', dr_['file'], lambda i, n: lerp(T_cov, WIN, dr_['cam'][i]), lambda i, n: lerp(O_cov, O_in, dr_['cam'][i]), 'door')
fixed = lambda i, n: WIN; ovin = lambda i, n: O_in
clip('intro', S['intro']['file'], fixed, ovin, 'intro')
clip('st0', S['stations'][0]['clip']['file'], fixed, ovin, 'station 1')
clip('fl0', S['fly']['0>1']['file'], fixed, ovin, 'flight 1>2')
clip('st1', S['stations'][1]['clip']['file'], fixed, ovin, 'station 2')
clip('out1', S['out']['1']['file'], fixed, ovin, 'out-2 (to the hub)')
ex = S['exit']
clip('exit', ex['file'], lambda i, n: lerp(T_cov, WIN, ex['cam'][i]), lambda i, n: lerp(O_cov, O_in, ex['cam'][i]), 'exit')
hold(cover, T_cov, O_cov, 20, 'cover')

seq = os.path.join(out, '_seq'); shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
labels = []
for i, (f, T, ov, label) in enumerate(frames):
    img = f if isinstance(f, Image.Image) else Image.open(f)
    render(img, T, ov).save(os.path.join(seq, f'f-{i + 1:05d}.png'), compress_level=1); labels.append(label)
mp4 = os.path.join(out, f'phone-interior-{vw}x{vh}.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '25', '-i', os.path.join(seq, 'f-%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], check=True)

idx = list(range(0, len(frames), 6)); cols = 12; tw, th = vw // 2, vh // 2   # one frame every 0.24 s (6 frames of 25 fps) ~ 0.25 s
rows = (len(idx) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 14)), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
for k, i in enumerate(idx):
    im = Image.open(os.path.join(seq, f'f-{i + 1:05d}.png')).resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, (k // cols) * (th + 14)
    sheet.paste(im, (x, y + 14)); dr.text((x + 2, y + 1), f'{i / 25:.2f}s {labels[i]}', fill=(255, 255, 255))
sheet.save(os.path.join(out, f'phone-interior-{vw}x{vh}-sheet.jpg'), quality=85)
# tiles every 0.08 s (every 2nd frame) of the door and of the exit, as the PM cuts them with ffmpeg's tile
def tile(label, name):
    ids = [i for i, l in enumerate(labels) if l == label][::2]
    cols = 12; tw2, th2 = 130, 224; rows2 = (len(ids) + cols - 1) // cols
    T = Image.new('RGB', (cols * tw2, rows2 * (th2 + 12)), (30, 30, 30)); d2 = ImageDraw.Draw(T)
    for k, i in enumerate(ids):
        x, y = (k % cols) * tw2, (k // cols) * (th2 + 12)
        T.paste(Image.open(os.path.join(seq, f'f-{i + 1:05d}.png')).resize((tw2, th2), Image.LANCZOS), (x, y + 12)); d2.text((x + 2, y), f'{i / 25:.2f}s', fill=(255, 255, 255))
    T.save(os.path.join(out, name), quality=88)
tile('door', f'door-tile-0.08s-{vw}x{vh}.jpg'); tile('exit', f'exit-tile-0.08s-{vw}x{vh}.jpg')
shutil.rmtree(seq); shutil.rmtree(tmp)
info = {'viewport': [vw, vh], 'frames': len(frames), 'seconds': len(frames) / 25, 'cover_fit': [round(v, 3) for v in T_cov], 'window_fit': [round(v, 3) for v in WIN],
        'segments': {}}
last = None; start = 0
for i, l in enumerate(labels + [None]):
    if l != last:
        if last is not None: info['segments'][f'{start / 25:.2f}s {last}'] = round((i - start) / 25, 2)
        last = l; start = i
json.dump(info, open(os.path.join(out, f'phone-interior-{vw}x{vh}.json'), 'w'), indent=1)
print(json.dumps(info)[:400])
