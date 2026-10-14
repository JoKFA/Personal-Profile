#!/bin/bash
cd "$(dirname "$0")"
E="E:/Codebase/Persoanl Profile/.codex-runtime/direction/evidence/M1-P4"
bash batch1.sh
node sizes.mjs "$E/sizes" > "$E/sizes.log" 2>&1
node visits.mjs "$E/visits" > "$E/visits.log" 2>&1
echo ALLDONE > "$E/final-done.txt"
