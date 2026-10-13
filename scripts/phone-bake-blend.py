# Blend the last N frames of a clip's frame directory, frame by frame, into the destination's canonical still, so the clip's
# last frame IS the still (weights 1/N … 1).  usage: python phone-bake-blend.py <still.png> <frames_dir> <N>
import sys, glob, os
import numpy as np
from PIL import Image
still_p, d, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(glob.glob(os.path.join(d, 'f-*.png')))
first = Image.open(fs[-1]); size = first.size
still = np.asarray(Image.open(still_p).convert('RGB').resize(size, Image.LANCZOS), dtype=np.float32)
for j, f in enumerate(fs[-n:], start=1):
    w = j / n
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.float32)
    Image.fromarray(np.rint(a * (1 - w) + still * w).clip(0, 255).astype(np.uint8)).save(f, compress_level=3)
print('blended', n, 'frames into', os.path.basename(still_p))
