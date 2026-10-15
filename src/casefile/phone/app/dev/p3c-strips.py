# 0.04 s strips of a real-time recording (CDP screencast): for each event "label:step name:offset s" the frames at 40 ms steps around step-start + offset
# (the nearest recorded frame to each step; the strip says how far off it is), as one PNG per event, plus the energy (frame-to-frame change) of each step.
# usage: python p3c-strips.py <screencast dir> <flows.json> <out dir> "label:step:offset" ... [--half=0.24] [--scale=1]
import sys, glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith('--')]
d, fj, out, events = args[0], args[1], args[2], args[3:]
half = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--half=')), 0.24))
sc = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--scale=')), 1))
crop = next((tuple(int(v) for v in a.split('=')[1].split(',')) for a in sys.argv if a.startswith('--crop=')), None)
os.makedirs(out, exist_ok=True)
F = json.load(open(fj, encoding='utf-8'))
fs = sorted(glob.glob(os.path.join(d, 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs])
t0 = F['t0'] / 1000.0
step_t = {s['name']: t0 + s['t'] for s in F['steps']}
tw, th = (int(130 * sc), int(221 * sc)) if not crop else (int((crop[2] - crop[0]) * sc), int((crop[3] - crop[1]) * sc))
for ev in events:
    label, step, off = ev.split(':')
    c = step_t[step] + float(off)
    targets = np.arange(c - half, c + half + 1e-6, 0.04)
    idx = [int(np.argmin(abs(ts - t))) for t in targets]
    sheet = Image.new('RGB', (tw * len(idx), th + 16), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
    prev = None; en = []
    for k, i in enumerate(idx):
        im = Image.open(fs[i]).convert('RGB')
        if crop: im = im.crop(crop)
        a = np.asarray(im.convert('L').resize((195, 332) if not crop else (im.width, im.height)), dtype=np.float32)
        en.append(0.0 if prev is None else float(np.abs(a - prev).mean())); prev = a
        sheet.paste(im.resize((tw, th)), (k * tw, 16))
        dr.text((k * tw + 2, 2), f'{targets[k] - c:+.2f}s e{en[-1]:.0f}', fill=(255, 255, 255))
    p = os.path.join(out, f'{label}.png'); sheet.save(p)
    print(label, step, off, 'frames', len(idx), 'max energy', round(max(en), 1), p)
