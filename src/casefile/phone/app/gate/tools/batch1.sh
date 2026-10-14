#!/bin/bash
# the P4 evidence batch: the three paths (and a pause) with no throttle, then the network profiles
cd "$(dirname "$0")"
E="E:/Codebase/Persoanl Profile/.codex-runtime/direction/evidence/M1-P4"
for spec in "hold none" "auto none" "skip none" "pause none" "hold 4g" "auto 4g" "skip 4g" "hold slow" "skip slow"; do
  set -- $spec
  node run.mjs "$E/runs" --path=$1 --net=$2 > "$E/runs/log-$1-$2.txt" 2>&1
  python scan.py "$E/runs" $1-$2 >> "$E/runs/log-$1-$2.txt" 2>&1
done
echo ALLDONE > "$E/runs/alldone.txt"
