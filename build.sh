#!/bin/sh
# Rebuilds every plugin zip from its folder. The desktop app installs from the
# zip, and clients cache by URL, so each release gets its own filename:
# <name>-<version>.zip, version read from the plugin's package.json.
set -e
cd "$(dirname "$0")"
for dir in themes/*/ editors/*/; do
  [ -f "$dir/package.json" ] || continue
  name=$(basename "$dir")
  version=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$dir/package.json")
  rm -f "$dir"/*.zip
  (cd "$dir" && zip -q -X -r "$name-$version.zip" . -x '*.zip' -x '.DS_Store' -x 'ext.json')
  echo "built $dir$name-$version.zip:"; unzip -Z1 "$dir/$name-$version.zip"
done
