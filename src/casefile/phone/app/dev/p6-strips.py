"""P6b: the strips of p6-strips.mjs: for each flow (pan, open, close) a contact sheet of the 40 ms frames of two builds (rows: base, after), and the numbers:
the mean absolute difference per frame between two runs of the same build (the noise: video decode, springs), and between the builds, and the frame at which the picture first moves.
usage: python p6-strips.py <dir> <flow> <baseTag> <baseTag2> <afterTag> <afterTag2> <out.png> [step]"""
import json, os, sys
from PIL import Image, ImageChops, ImageStat

d, flow, b1, b2, a1, a2, out = sys.argv[1:8]
step = int(sys.argv[8]) if len(sys.argv) > 8 else 2


def load(tag):
    j = json.load(open(os.path.join(d, f'{tag}-{flow}.json')))
    return [(f['t'], Image.open(os.path.join(d, f['file'])).convert('RGB').resize((130, 221))) for f in j['frames']]


R = {t: load(t) for t in (b1, b2, a1, a2)}
n = min(len(v) for v in R.values())


def diff(x, y):
    return [ImageStat.Stat(ImageChops.difference(x[i][1], y[i][1])).mean[0] for i in range(n)]


def first_move(x, thr=1.5):
    for i in range(1, n):
        if ImageStat.Stat(ImageChops.difference(x[i][1], x[0][1])).mean[0] > thr:
            return x[i][0]
    return None


noise = diff(R[b1], R[b2]); noise_a = diff(R[a1], R[a2]); cross = diff(R[b1], R[a1]); cross2 = diff(R[b2], R[a2])
avg = lambda v: sum(v) / len(v)
print(f'{flow}: frames {n} (t from {R[b1][0][0]} ms to {R[b1][n-1][0]} ms, every 40 ms)')
print(f'  noise  base vs base  : mean {avg(noise):.2f}  max {max(noise):.1f}')
print(f'  noise  after vs after: mean {avg(noise_a):.2f}  max {max(noise_a):.1f}')
print(f'  base vs after (run 1): mean {avg(cross):.2f}  max {max(cross):.1f}   (run 2): mean {avg(cross2):.2f}  max {max(cross2):.1f}')
print('  first frame that moves (ms from the gesture): base', first_move(R[b1]), first_move(R[b2]), ' after', first_move(R[a1]), first_move(R[a2]))
idx = list(range(0, n, step))
W, H = 130, 221
sheet = Image.new('RGB', (len(idx) * W + 40, 2 * H + 10), (255, 255, 255))
for r, tag in enumerate((b1, a1)):
    for c, i in enumerate(idx):
        sheet.paste(R[tag][i][1], (40 + c * W, r * (H + 10)))
sheet.save(out)
json.dump({'flow': flow, 'frames': n, 'noise_base_mean': avg(noise), 'noise_after_mean': avg(noise_a), 'base_vs_after_mean': [avg(cross), avg(cross2)], 'base_vs_after_max': [max(cross), max(cross2)],
           'first_move_ms': {'base': [first_move(R[b1]), first_move(R[b2])], 'after': [first_move(R[a1]), first_move(R[a2])]}}, open(out.replace('.png', '.json'), 'w'), indent=1)
