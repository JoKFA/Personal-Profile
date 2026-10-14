# Compositor-level DOM sync on the production shell. In each screencast frame of the open or close clip: which clip frame is the picture (i),
# and which frame's face corners are the four ink marks on (m)? Both are read under the stage transform the DOM had set (the fit between the
# stop's and the window's, by that frame's cam), which is searched too (j). m - i is how far the marks are from the picture (0 = locked).
# usage: python domsync.py <screencast dir> <result-*.json> <refs dir: f-NNNN.png at master size> <open|close> <manifest.json>
import sys, glob, json
import numpy as np
from PIL import Image

sc, res, refs, kind, man = sys.argv[1:6]
R = json.load(open(res)); MAN = json.load(open(man))
fits = R['fits']; win = R['winFit']; cam = R['openCam'] if kind == 'open' else R['closeCam']
quads = np.array([[[p['x'], p['y']] for p in q] for q in MAN[kind]['X-001']['quads']])
stop = fits[1]
files = sorted(glob.glob(refs + '/f-*.png')); N = len(files)
MW, MH = Image.open(files[0]).size
Q = 4                                                    # the (i, j) search runs at 1/4 size
R_ = [Image.open(f).convert('L') for f in files]
Rs = [r.resize((MW // Q, MH // Q), Image.BOX) for r in R_]


def fit(j):
    # j may be fractional (the page layer interpolates between frames): the camera progress is interpolated the same way
    a = int(np.floor(min(j, len(cam) - 1))); b = min(a + 1, len(cam) - 1); f = j - a
    k = cam[a] + (cam[b] - cam[a]) * f
    return (stop['s'] + (win['s'] - stop['s']) * k, stop['tx'] + (win['tx'] - stop['tx']) * k, stop['ty'] + (win['ty'] - stop['ty']) * k)


def warp(img, s, tx, ty, size):
    # screen = master * s + t  ->  the inverse for PIL's affine (it maps output pixel to input pixel)
    return np.asarray(img.transform(size, Image.AFFINE, (1 / s, 0, -tx / s, 0, 1 / s, -ty / s), resample=Image.BILINEAR, fillcolor=229), dtype=np.float32)


def marks(img):
    a = np.asarray(img.convert('L'), dtype=np.float32)
    m = a < 70
    ys, xs = np.nonzero(m); seen = set(); pts = []
    for y, x in zip(ys, xs):
        if (y, x) in seen: continue
        st = [(y, x)]; seen.add((y, x)); comp = []
        while st:
            cy, cx = st.pop(); comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (cy + dy, cx + dx)
                    if q not in seen and 0 <= q[0] < m.shape[0] and 0 <= q[1] < m.shape[1] and m[q]: seen.add(q); st.append(q)
        if 8 <= len(comp) <= 60: pts.append((np.mean([c[1] for c in comp]), np.mean([c[0] for c in comp])))
    return np.array(pts)


out = []
for f in sorted(glob.glob(sc + '/s-*.jpg')):
    img = Image.open(f).convert('RGB'); sw, sh = img.size
    c = sw / 390.0                                       # screencast px per css px (viewport width 390)
    p = marks(img)
    if len(p) != 4: continue
    # 1. the DOM's state: the frame index j whose face corners, under that frame's own stage transform, the four ink marks sit on
    cost = []
    JS = np.arange(0, N - 1 + 1e-9, 0.25)
    for j in JS:
        s, tx, ty = fit(j)
        a = int(np.floor(j)); b = min(a + 1, N - 1)
        qj = quads[a] + (quads[b] - quads[a]) * (j - a)
        q = (qj * s + np.array([tx, ty])) * c
        cost.append(sum(float(np.min(np.linalg.norm(q - pt, axis=1))) for pt in p) / 4)
    j = float(JS[int(np.argmin(cost))]); cj = min(cost)
    if cj > 4.0: continue                           # the marks are not on a face (the lock ramp, a fade, something else dark)
    # 2. the picture's state: the clip frame that best matches the screen under the DOM's own transform
    small = np.asarray(img.convert('L').resize((sw // Q, sh // Q), Image.BOX), dtype=np.float32)
    top, bot = (int(64 * c) + 4) // Q, int(sh * 0.6) // Q    # the stage's band: under the bar, above the panel
    s, tx, ty = fit(j)
    errs = [float(np.abs(warp(Rs[i], s * c, tx * c / Q, ty * c / Q, (sw // Q, sh // Q))[top:bot] - small[top:bot]).mean()) for i in range(N)]
    i0 = int(np.argmin(errs))
    if errs[i0] > 12: continue                           # not a frame of this clip
    # refine at full size around the coarse match (the marks are masked: they are the page's, not the picture's)
    full = np.asarray(img.convert('L'), dtype=np.float32)
    mask = np.ones_like(full, dtype=bool)
    for (x, y) in p: mask[max(0, int(y) - 6):int(y) + 7, max(0, int(x) - 6):int(x) + 7] = False
    t1, b1 = int(64 * c) + 4, int(sh * 0.6)
    fe = {}
    for i in range(max(0, i0 - 4), min(N, i0 + 5)):
        w = warp(R_[i], s * c, tx * c, ty * c, (sw, sh))
        m = mask[t1:b1]
        fe[i] = float(np.abs(w[t1:b1] - full[t1:b1])[m].mean())
    i = min(fe, key=fe.get)
    errs[i] = fe[i]
    out.append((i, j, j, errs[i], cj))

LO, HI = (6, 24)                                        # clear of the lock ramp, and before the camera and the drive settle (after that adjacent frames are the same picture, so an offset cannot be read)
sel = [r for r in out if LO <= r[0] <= HI]
print(kind, 'screencast frames with the marks on a face and a picture match:', len(out), '; with the picture on clip frames', LO, '-', HI, ':', len(sel))
d = np.array([r[1] - r[0] for r in sel])
vals, cnt = np.unique(np.round(d * 4) / 4, return_counts=True)
print('DOM frame (marks and stage transform) minus picture frame, in clip frames, to the quarter frame (0 = locked):', dict(zip(map(float, vals), map(int, cnt))))
print('mean offset %.2f frames; within a quarter frame: %d of %d; within half a frame: %d; within one frame: %d' % (d.mean(), int((abs(d) <= 0.25).sum()), len(d), int((abs(d) <= 0.5).sum()), int((abs(d) <= 1.0).sum())))
print('rounded to whole frames:', dict(zip(*[list(map(int, x)) for x in np.unique(np.round(d), return_counts=True)])))
if sel:
    print('within +-1: %d of %d; exactly 0 (|d|<0.5): %d' % (sum(1 for r in sel if abs(r[1] - r[0]) <= 1), len(sel), sum(1 for r in sel if abs(r[1] - r[0]) < 0.5)))
    print('mean mark-to-corner distance px: %.2f' % np.mean([r[4] for r in sel]), '; mean picture match error: %.2f' % np.mean([r[3] for r in sel]))
