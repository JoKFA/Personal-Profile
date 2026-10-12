# the secure element's centre in the window still: the centroid of the die's flat brown fill (master css px, 390x866)
# usage: python phone-spike-die.py window-X-001.webp  -> {"die":[x,y],"bbox":[x0,y0,x1,y1]}
import sys, json
import numpy as np
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); sx = im.width / 390
a = np.asarray(im.resize((390, 866), Image.BOX), dtype=np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
# the fill is the darkest, most saturated flat tone on the face (olive-brown), inside the face's middle band
sat = (r - b) / (r + 1e-3)
m = (sat > 0.28) & (r < 215) & (r > 150)
m[:200] = False; m[520:] = False; m[:, :120] = False; m[:, 320:] = False
# the largest square-ish blob: take the rows/cols with the densest mask
ys, xs = np.nonzero(m)
rows = m.sum(1); cols = m.sum(0)
ry = np.nonzero(rows > 0.5 * rows.max())[0]; cx = np.nonzero(cols > 0.5 * cols.max())[0]
x0, x1, y0, y1 = int(cx.min()), int(cx.max()), int(ry.min()), int(ry.max())
print(json.dumps({'die': [(x0 + x1) / 2, (y0 + y1) / 2], 'bbox': [x0, y0, x1, y1], 'pixels': int(m.sum())}))
