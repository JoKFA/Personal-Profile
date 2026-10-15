# A real-time recording (CDP screencast frames) as an mp4 at the frames' own times, plus a contact sheet (one frame every 0.5 s) labelled with the flows' marks.
# usage: python p3c-film.py <screencast dir> <flows.json> <out dir> [name]
import sys, glob, os, re, json, subprocess
import numpy as np
from PIL import Image, ImageDraw

d, fj, out = sys.argv[1:4]; name = sys.argv[4] if len(sys.argv) > 4 else 'recording'
os.makedirs(out, exist_ok=True)
F = json.load(open(fj, encoding='utf-8'))
fs = sorted(glob.glob(os.path.join(d, 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs])
lst = os.path.join(out, f'{name}.txt')
with open(lst, 'w') as w:
    for i, f in enumerate(fs):
        dur = (ts[i + 1] - ts[i]) if i + 1 < len(fs) else 0.04
        w.write(f"file '{os.path.abspath(f).replace(chr(92), '/')}'\nduration {min(max(dur, 0.001), 1.5):.4f}\n")
mp4 = os.path.join(out, f'{name}.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'fps=25,scale=390:664', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4], check=True)
os.remove(lst)
t0 = ts[0]; marks = [(F['t0'] / 1000.0 + s['t'] - t0, s['name']) for s in F['steps']]
idx = []; t = 0.0
while t < ts[-1] - t0:
    idx.append(int(np.searchsorted(ts - t0, t))); t += 0.5
idx = [min(i, len(fs) - 1) for i in idx]
cols = 16; tw, th = 130, 221
rows = (len(idx) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 14)), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
for k, i in enumerate(idx):
    im = Image.open(fs[i]).convert('RGB').resize((tw, th))
    x, y = (k % cols) * tw, (k // cols) * (th + 14)
    sheet.paste(im, (x, y + 14))
    tt = ts[i] - t0
    label = max(((m, n) for m, n in marks if m <= tt), default=(0, ''), key=lambda z: z[0])[1]
    dr.text((x + 2, y + 1), f'{tt:5.1f}s {label[:16]}', fill=(255, 255, 255))
sheet.save(os.path.join(out, f'{name}-sheet.jpg'), quality=80)
print(mp4, sheet.size, len(idx), 'frames on the sheet')
