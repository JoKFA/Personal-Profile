# Scan a run of run.mjs: blank frames and hard cuts from the moment the entry page is on screen, the handover window in detail, and a contact sheet every 0.25 s.
#   python scan.py <outDir> <tag> [step=0.25] [cols=8]
import sys, glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
res = json.load(open(os.path.join(out, f'result-{tag}.json')))
fs = sorted(glob.glob(os.path.join(out, f'screencast-{tag}', 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs])
# the run's clock: performance.now() ms since the navigation; the screencast stamps are epoch seconds
origin = None
for k in ('timeOrigin',):
    origin = res.get(k)
if origin is None:
    # derived: gate visible at nav.gateVisibleAt ms; the first frame showing the gate is not known, so fall back to the first frame
    origin = ts[0] * 1000
ms = ts * 1000 - origin
t_gate = res['nav']['gateVisibleAt']; E = res['entry']
t_cover = E['coverAt']
# the compositor's own evidence of the first painted entry page: the first frame with any content (a name, a print) rather than bare paper
allsmall = lambda f: np.asarray(Image.open(f).convert('L').resize((195, 332)), dtype=np.float32)
first_paint = next((ms[i] for i in range(len(fs)) if ms[i] >= t_gate - 1 and allsmall(fs[i]).std() >= 1.0), None)
# what is on screen before the entry page: the compositor's frames from the start of the run (luma, and the colours of a few corner pixels)
pre = [i for i in range(len(fs)) if ms[i] < (first_paint or t_gate)]
if pre:
    corner = sorted({Image.open(fs[i]).convert('RGB').getpixel((5, 5)) for i in pre})
    lum = [float(allsmall(fs[i]).mean()) for i in pre]
    print('before the entry page: %d compositor frames, first at %.2fs, last at %.2fs; luma %.0f..%.0f; distinct corner colours %s' % (len(pre), ms[pre[0]] / 1000, ms[pre[-1]] / 1000, min(lum), max(lum), corner[:4]))
else:
    print('before the entry page: no compositor frames (the first frame already has the page on it)')
print('first compositor frame with the entry page on it: %.2fs after navigation start (visibility set at %.2fs, first byte %.2fs)' % ((first_paint or 0) / 1000, t_gate / 1000, res['nav']['responseStart'] / 1000))
res['firstPaintMs'] = first_paint; json.dump(res, open(os.path.join(out, f'result-{tag}.json'), 'w'), indent=1)
small = lambda f: np.asarray(Image.open(f).convert('L').resize((195, 332)), dtype=np.float32)
# the window starts at the first frame that has the entry page on it (the frames before are the page still loading: flat paper, no name yet)
start = next((i for i in range(len(fs)) if ms[i] >= t_gate - 1 and small(fs[i]).std() >= 1.0), 0)
sel = [i for i in range(len(fs)) if i >= start and ms[i] <= t_cover + 1400]
A = {i: small(fs[i]) for i in sel}
blank = [(i, round(ms[i] / 1000, 3), round(float(A[i].mean()), 1), round(float(A[i].std()), 1)) for i in sel if A[i].std() < 1.0 or A[i].mean() < 40 or A[i].mean() > 250]
e = []
for a, b in zip(sel[:-1], sel[1:]):
    e.append((b, float(np.abs(A[b] - A[a]).mean()), max(1.0, ms[b] - ms[a])))
print(f'run {tag}: frames in window {len(sel)}  span {(ms[sel[-1]] - ms[sel[0]]) / 1000:.2f}s  (gate visible at {t_gate / 1000:.2f}s, sealed {E["sealedAt"] / 1000:.2f}s, first frame {E["firstFrameAt"] / 1000:.2f}s, gate gone {E["gateGoneAt"] / 1000:.2f}s, cover {t_cover / 1000:.2f}s)')
print('blank (flat std<1, luma<40 or >250) frames in window:', len(blank), blank[:6])
# handover window: from the seal to 0.8 s after the gate is gone
w0, w1 = E['sealedAt'] - 100, E['gateGoneAt'] + 300
print('handover window changes per frame (ms: mean abs diff, per ms):')
row = []
for (b, d, dt) in e:
    if w0 <= ms[b] <= w1: row.append(f'{ms[b] / 1000:.2f}s={d:.1f}')
print('  ' + ' '.join(row))
mx = max((d for (b, d, dt) in e if w0 <= ms[b] <= w1), default=0)
print(f'handover max change {mx:.1f}   whole-window max {max(d for (_, d, _) in e):.1f}')
# contact sheet
ticks = np.arange(t_gate, t_cover + 1200, step * 1000)
pick = []
for t in ticks:
    j = max([i for i in range(len(fs)) if ms[i] <= t] or [0]); pick.append((t, j))
W, H = 156, 273
rows = (len(pick) + cols - 1) // cols
sh = Image.new('RGB', (W * cols, H * rows), 'white')
for n, (t, j) in enumerate(pick):
    im = Image.open(fs[j]).convert('RGB').resize((W, H)); d = ImageDraw.Draw(im); d.rectangle((0, 0, 44, 11), fill=(255, 255, 255)); d.text((2, 0), f'{(t - t_gate) / 1000:.2f}', fill=(200, 0, 0))
    sh.paste(im, ((n % cols) * W, (n // cols) * H))
sh.save(os.path.join(out, f'sheet-{tag}.jpg'), quality=82); print('sheet', len(pick), sh.size)
