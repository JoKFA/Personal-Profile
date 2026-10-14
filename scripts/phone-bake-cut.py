# Cut a clip's frames at the first frame whose distance to the destination still is <= a threshold (mean abs diff, % of 255, at the
# frames' size), then blend the last N kept frames, frame by frame, into the still (weights 1/N ... 1), so the clip's last frame IS the still.
# The source directory is left as rendered; the kept frames go to <out_dir>.
# usage: python phone-bake-cut.py <still.png> <frames_dir> <out_dir> <threshold_pct> <blend_n> <search_from_frame>
#   -> {"cut": i, "frames": i+1, "residual": <% at the cut, before the blend>, "series": [...]}
import sys, glob, os, shutil, json
import numpy as np
from PIL import Image
still_p, d, out, thr, n, start = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
fs = sorted(glob.glob(os.path.join(d, 'f-*.png')))
size = Image.open(fs[0]).size
still = np.asarray(Image.open(still_p).convert('RGB').resize(size, Image.LANCZOS), dtype=np.float32)
series = []; cut = None
for i, f in enumerate(fs):
    dd = float(np.abs(np.asarray(Image.open(f).convert('RGB'), dtype=np.float32) - still).mean() / 255 * 100)
    series.append(round(dd, 3))
    if cut is None and i >= start and dd <= thr: cut = i
    if cut is not None and i >= cut: break
if cut is None: raise SystemExit(f'no frame reaches {thr}% of the still')
if cut + 1 < n: raise SystemExit('cut too early to blend')
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
blend = []   # how far each blended frame moved from its clean frame (mean abs diff, % of 255)
for i in range(cut + 1):
    src = fs[i]
    if i > cut - n:
        w = (i - (cut - n)) / n
        a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
        b = np.rint(a * (1 - w) + still * w).clip(0, 255)
        blend.append(round(float(np.abs(b - a).mean() / 255 * 100), 3))
        Image.fromarray(b.astype(np.uint8)).save(os.path.join(out, f'f-{i:04d}.png'), compress_level=3)
    else: shutil.copyfile(src, os.path.join(out, f'f-{i:04d}.png'))
print(json.dumps({'cut': cut, 'frames': cut + 1, 'residual': series[cut], 'blend': blend, 'series': series}))
