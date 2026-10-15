# Chip sync on a pips-only recording (the same measure as domsync.py, for the interior's chips). In each screencast frame of a station's own sequence:
#   i = which clip frame the PICTURE is (matched against the decoded clip frames of every station, under the stage's window fit),
#   j = which (fractional) clip frame the baked anchors would have to be at for the page layer's pips (the small ink squares at each chip's anchor) to sit on them.
# j - i is how far the chips are from the picture in clip frames (0 = locked); the page layer leads by half a frame on purpose.
# usage: python p3c-chipsync.py <screencast dir> <public/phone dir> <out.txt> [vw]
import sys, glob, os, re, json, subprocess, shutil, tempfile
import numpy as np
from PIL import Image

sc, pub, out = sys.argv[1:4]; vw = int(sys.argv[4]) if len(sys.argv) > 4 else 390
M = json.load(open(os.path.join(pub, 'manifest.json'))); S = json.load(open(os.path.join(pub, M['space']['file'])))
MW, MH = 480, 960; s = vw / MW
tmp = tempfile.mkdtemp()
# decoded clip frames of the six stations at the window scale, gray, region rows only (master y 64..536 -> screen)
y0, y1 = int(64 * s) + 20, int(536 * s) - 4
refs = []
for i, st in enumerate(S['stations']):
    p = os.path.join(tmp, f'st{i}'); os.makedirs(p)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(pub, st['clip']['file']), '-vf', f'scale={vw}:{round(MH * s)}', os.path.join(p, 'f-%04d.png')], check=True)
    fr = sorted(glob.glob(p + '/f-*.png'))
    refs.append(np.stack([np.asarray(Image.open(f).convert('L'), dtype=np.float32)[y0:y1] for f in fr]))
files = sorted(glob.glob(os.path.join(sc, 's-*.jpg')))
res = []
from scipy import ndimage
def pips(a):
    m = a < 70
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    pts = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        comp = lab[sl] == k; cnt = int(comp.sum())
        if 14 <= cnt <= 60:
            h, w = comp.shape
            if abs(h - w) <= 2 and cnt >= 0.7 * h * w:
                ys, xs = np.nonzero(comp); pts.append((float(xs.mean() + sl[1].start), float(ys.mean() + sl[0].start)))
    return np.array(pts)
for f in files:
    img = Image.open(f).convert('L'); W, H = img.size
    c = W / vw
    a = np.asarray(img, dtype=np.float32)
    P = pips(a) / c if True else None
    if P is None or len(P) == 0: continue
    small = np.asarray(img.resize((vw, round(H / c))), dtype=np.float32)[y0:y1]
    if not len(P): continue
    # the picture: the best (station, frame) over the region, the pips masked
    best = (1e9, -1, -1); curve = None
    mask = np.ones_like(small, dtype=bool)
    for (x, y) in P: mask[max(0, int(y) - y0 - 6):int(y) - y0 + 7, max(0, int(x) - 6):int(x) + 7] = False
    for k, R in enumerate(refs):
        err = np.abs(R[:, ::2, ::2] - small[::2, ::2])[:, mask[::2, ::2]].mean(axis=1)
        j = int(np.argmin(err))
        if err[j] < best[0]: best = (float(err[j]), k, j); curve = err
    if best[0] > 9: continue
    _, k, i = best
    st = S['stations'][k]
    # the anchors that are on at a fractional frame j, in screen px
    def anchors(j):
        n = st['clip']['frames'] - 1; a0 = int(np.floor(min(max(j, 0), n))); a1 = min(n, a0 + 1); fr = j - a0
        out_ = []
        for ch in st['chips']:
            if ch['on'][a0] and ch['on'][a1]:
                out_.append(((ch['x'][a0] + (ch['x'][a1] - ch['x'][a0]) * fr) * s, (ch['y'][a0] + (ch['y'][a1] - ch['y'][a0]) * fr) * s))
        return np.array(out_)
    # which anchors the page layer draws at j: every chip that is on gets one 5x5 pip, so a screencast frame whose pips are all on the picture must show
    # exactly as many pips as chips are on; the pips are matched to the anchors one to one (Hungarian), so one chip cannot stand for two pips
    from scipy.optimize import linear_sum_assignment
    def fit(j):
        A = anchors(j)
        if len(A) < len(P): return 1e9
        D = np.linalg.norm(A[:, None, :] - P[None, :, :], axis=2)
        r_, c_ = linear_sum_assignment(D)          # every pip to its own anchor (pips are a subset of the anchors that are on)
        return float(D[r_, c_].mean())
    def fit_drop1(j):
        # the same with the one worst pip left out: a picture's own dark mark can look like a pip, and a pip whose anchor is past the screen edge is cut by it
        if len(P) < 2: return fit(j)
        best_ = 1e9
        for d in range(len(P)):
            Q = np.delete(P, d, axis=0); A = anchors(j)
            if len(A) < len(Q): continue
            D = np.linalg.norm(A[:, None, :] - Q[None, :, :], axis=2); r_, c_ = linear_sum_assignment(D)
            best_ = min(best_, float(D[r_, c_].mean()))
        return best_
    JS = np.arange(max(0, i - 4), min(st['clip']['frames'] - 1, i + 4) + 1e-9, 0.25)
    cost = [fit(j) for j in JS]; cost2 = [fit_drop1(j) for j in JS]
    sharp = float(min(curve[max(0, i - 3)], curve[min(len(curve) - 1, i + 3)]) - curve[i])
    res.append({'k': k, 'i': i, 'js': [float(x) for x in JS], 'cost': [min(c, 99.0) for c in cost], 'cost2': [min(c, 99.0) for c in cost2], 'pips': len(P), 'match': best[0], 'sharp': sharp, 'f': os.path.basename(f)})
import json as _j
_j.dump(res, open(out + '.samples.json', 'w'))
print(len(res), 'samples written to', out + '.samples.json')
shutil.rmtree(tmp, ignore_errors=True)
