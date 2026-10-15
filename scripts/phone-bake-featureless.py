# Scan the interior's flights for dead frames: runs of >= 2 frames with no scene feature (luma std < the threshold on a 195 x 332 luma).
# A frame with a trace bundle in it (the bus lines, even faint) has std 2-4; a frame with nothing in it, paper only, is under 1.5. The gate is std < 1.5 (PM: 'nothing in frame').
# usage: python phone-bake-featureless.py <public/phone dir> [json out] [std threshold, default 1.5]   (decodes fly-*, in-*, out-* and the exit from the manifest's space json)
import sys, os, json, glob, shutil, subprocess
import numpy as np
from PIL import Image
d = sys.argv[1]; THR = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5; M = json.load(open(os.path.join(d, 'manifest.json'))); S = json.load(open(os.path.join(d, M['space']['file'])))
tmp = os.path.join(d, '..', '_featureless'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
clips = {}
for k, c in S['fly'].items(): clips[f"fly-{k.replace('>', '-')}"] = c
for k, c in S['out'].items(): clips[f'out-{k}'] = c
for k, c in S['in'].items(): clips[f'in-{k}'] = c
clips['space-exit'] = S['exit']; clips['space-intro'] = S['intro']
rep = {}; bad = 0
for n, c in sorted(clips.items()):
    p = os.path.join(tmp, n); os.makedirs(p)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, c['file']), p + '/f-%03d.png'], check=True)
    fs = sorted(glob.glob(p + '/f-*.png'))
    sd = [float(np.asarray(Image.open(f).convert('L').resize((195, 332)), dtype=np.float32).std()) for f in fs]
    runs = []; i = 0
    while i < len(sd):
        if sd[i] < THR:
            j = i
            while j + 1 < len(sd) and sd[j + 1] < THR: j += 1
            if j - i + 1 >= 2: runs.append([i + 1, j + 1])   # 1-based frame numbers
            i = j + 1
        else: i += 1
    rep[n] = {'frames': len(fs), 'runs': runs, 'minStd': round(min(sd), 2)}
    if runs: bad += sum(b - a + 1 for a, b in runs)
shutil.rmtree(tmp)
print(json.dumps({k: v for k, v in rep.items() if v['runs']}, indent=0)); print('clips with runs >= 2 frames:', sum(1 for v in rep.values() if v['runs']), ' featureless frames in those runs:', bad)
if len(sys.argv) > 2: json.dump(rep, open(sys.argv[2], 'w'), indent=1)
