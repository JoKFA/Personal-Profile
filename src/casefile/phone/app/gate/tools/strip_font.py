# The name around the moment the web font arrives and the text is set in it (the system-font name becomes the Manrope name), in 0.05 s steps.
#   python strip_font.py <outDir> <tag> [before=0.3] [after=0.4] [step=0.05]
import sys, glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw
out, tag = sys.argv[1], sys.argv[2]
pre = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
post = float(sys.argv[4]) if len(sys.argv) > 4 else 0.4
step = float(sys.argv[5]) if len(sys.argv) > 5 else 0.05
res = json.load(open(os.path.join(out, f'result-{tag}.json')))
fs = sorted(glob.glob(os.path.join(out, f'screencast-{tag}', 's-*.jpg')))
ts = np.array([float(re.search(r'-([0-9.]+)\.jpg$', f).group(1)) for f in fs]) * 1000 - res['timeOrigin']
fa = [t for t, fam in res.get('fontAt', []) if 'Manrope' in fam]
if not fa: sys.exit('no Manrope loading event in the run')
t_font = fa[0]
rows = []
for t in np.arange(t_font - pre * 1000, t_font + post * 1000 + 1, step * 1000):
    j = max([i for i in range(len(fs)) if ts[i] <= t] or [0])
    im = Image.open(fs[j]).convert('RGB'); W, H = im.size
    c = im.crop((0, 0, W, int(H * 0.115)))
    d = ImageDraw.Draw(c); d.rectangle((c.width - 210, 0, c.width, 11), fill=(255, 255, 255))
    d.text((c.width - 208, 0), f'{(t - t_font) / 1000:+.2f}s (frame {ts[j] / 1000:.2f}s)' + (' FONT IN' if abs(t - t_font) < step * 500 else ''), fill=(200, 0, 0))
    rows.append(c)
sh = Image.new('RGB', (rows[0].width, sum(r.height + 2 for r in rows)), (150, 150, 150)); y = 0
for r in rows: sh.paste(r, (0, y)); y += r.height + 2
sh.save(os.path.join(out, f'strip-name-fontswap-{tag}.png')); print(len(rows), sh.size, 'Manrope loaded at %.2fs; gate visible %.2fs' % (t_font / 1000, res['nav']['gateVisibleAt'] / 1000))
