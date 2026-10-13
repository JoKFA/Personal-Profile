# The secure element's centre in a window still, measured on the pixels (the analytic projection of the etched die is ~20 px off: P0).
# usage: python phone-bake-die.py <still> <master_w> <face_x0> <face_y0> <face_x1> <face_y1>
#   -> {"die":[x,y],"bbox":[x0,y0,x1,y1],"area":n}   (master css px; the face rect is the inner face quad's box)
# The die is the face's one big flat block darker than the board: found as the largest blob left after opening away the thin
# dark things (text, hatching, pins), inside the middle of the face.
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

path, mw = sys.argv[1], int(sys.argv[2])
fx0, fy0, fx1, fy1 = [float(v) for v in sys.argv[3:7]]
im = Image.open(path).convert('RGB')
mh = round(im.height * mw / im.width)
a = np.asarray(im.resize((mw, mh), Image.BOX), dtype=np.float32)
lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
x0, x1, y0, y1 = int(max(0, fx0)), int(min(mw, fx1)), int(max(0, fy0)), int(min(mh, fy1))
face = lum[y0:y1, x0:x1]
bg = np.median(face)
# the search box: the middle of the face
w, h = x1 - x0, y1 - y0
sx0, sx1, sy0, sy1 = int(w * 0.25), int(w * 0.80), int(h * 0.25), int(h * 0.80)
dark = np.zeros_like(face, dtype=bool)
dark[sy0:sy1, sx0:sx1] = (face[sy0:sy1, sx0:sx1] < bg - 14)
opened = ndi.binary_opening(dark, structure=np.ones((13, 13)))
lab, n = ndi.label(opened)
if n == 0: raise SystemExit('no die found: nothing darker than the board survives the opening')
sizes = ndi.sum(opened, lab, range(1, n + 1))
k = int(np.argmax(sizes)) + 1
ys, xs = np.nonzero(lab == k)
area = int(sizes[k - 1])
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
if area < 1200 or not (0.55 < bw / bh < 1.8) or area < 0.7 * bw * bh: raise SystemExit(f'implausible die blob: area {area}, box {bw}x{bh}')
print(json.dumps({'die': [x0 + (bx0 + bx1 + 1) / 2, y0 + (by0 + by1 + 1) / 2], 'bbox': [int(x0 + bx0), int(y0 + by0), int(x0 + bx1 + 1), int(y0 + by1 + 1)], 'area': area}))
