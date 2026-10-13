# Mean absolute difference between two images, as % of 255, after scaling the second to the first's size.
# usage: python phone-bake-diff.py a b   -> prints the number
import sys
import numpy as np
from PIL import Image
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
if b.size != a.size: b = b.resize(a.size, Image.LANCZOS)
print('%.4f' % (np.abs(np.asarray(a, dtype=np.float32) - np.asarray(b, dtype=np.float32)).mean() / 255 * 100))
