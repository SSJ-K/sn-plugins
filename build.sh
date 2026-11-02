#!/bin/sh
# Rebuilds every plugin zip from its folder (the desktop app installs from the zip).
set -e
cd "$(dirname "$0")"
for dir in themes/*/ editors/*/; do
  [ -f "$dir/package.json" ] || continue
  name=$(basename "$dir")
  rm -f "$dir/$name.zip"
  (cd "$dir" && zip -q -X -r "$name.zip" . -x '*.zip' -x '.DS_Store' -x 'ext.json')
  echo "built $dir$name.zip:"; unzip -Z1 "$dir/$name.zip"
done
