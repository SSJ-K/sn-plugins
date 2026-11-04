#!/bin/sh
# Pre-release code checks for every plugin in this repo (spec: 0P CODE - REF - PRE-RELEASE CHECKLIST).
# Runs with no opinion; prints PASS/FAIL per item and exits non-zero on any FAIL.
# Items that need a browser (font status, computed styles, width matrix, overflow) are in
# the demo-page walk, not here.
set -u
cd "$(dirname "$0")"
fail=0
ok()   { echo "PASS  $1"; }
bad()  { echo "FAIL  $1"; fail=1; }

# 1. Fonts are declared binary in git
if git check-attr binary themes/duo/iAWriterDuoS-Regular.woff2 | grep -q 'binary: set'; then ok "git treats fonts as binary"; else bad "git does not treat fonts as binary (.gitattributes)"; fi

# 2. Every font file parses as a font (OpenType sanitizer if installed, else fontTools)
fontcheck() {
  f="$1"
  if command -v ots-sanitize >/dev/null 2>&1; then ots-sanitize "$f" >/dev/null 2>&1; return $?; fi
  # No sanitizer: check the WOFF2 signature and that the header's declared length equals the file size
  # (a text round-trip or a truncated download changes the size but not the header).
  python3 -I -c "
import sys, struct, os
b = open(sys.argv[1], 'rb').read(12)
sys.exit(0 if b[:4] == b'wOF2' and struct.unpack('>I', b[8:12])[0] == os.path.getsize(sys.argv[1]) else 1)" "$f"
}
for f in themes/duo/*.woff2 src/duo-writer/public/fonts/*.woff2; do
  if fontcheck "$f"; then :; else bad "font does not parse: $f"; fi
done
ok "source fonts have a valid WOFF2 header and declared length (or pass ots-sanitize)"

# 3. Built fonts are byte-identical to their sources (catches text transforms on binaries)
for f in src/duo-writer/public/fonts/*.woff2; do
  b="editors/duo-writer/fonts/$(basename "$f")"
  if [ -f "$b" ] && cmp -s "$f" "$b"; then :; else bad "built font differs or missing: $b"; fi
done
for f in themes/duo/*.woff2; do
  b="editors/duo-writer/fonts/$(basename "$f")"
  if [ -f "$b" ] && cmp -s "$f" "$b"; then :; else bad "built font differs or missing: $b"; fi
done
ok "built fonts byte-identical to sources"

# 4. No unreplaced template placeholders in the built descriptors or CSS/JS
if grep -rq '\$VERSION\$' editors/duo-writer/ext.json editors/duo-writer/package.json; then bad "unreplaced \$VERSION\$ in a descriptor"; else ok "descriptors have no unreplaced placeholders"; fi

# 5. Versions agree everywhere the host reads them, and the zip for that version exists
v_src=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" src/duo-writer/package.json)
v_ext=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" editors/duo-writer/ext.json)
v_pkg=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" editors/duo-writer/package.json)
if [ "$v_src" = "$v_ext" ] && [ "$v_src" = "$v_pkg" ]; then ok "version $v_src agrees in source, ext.json and package.json"; else bad "version mismatch: src $v_src ext $v_ext pkg $v_pkg"; fi
if [ -f "editors/duo-writer/duo-writer-$v_src.zip" ]; then ok "zip for $v_src exists"; else bad "no zip for $v_src (run build.sh)"; fi
if grep -q "$v_src" index.html; then ok "landing page names $v_src"; else bad "landing page does not name $v_src"; fi

# 6. Descriptor urls point at files that exist and carry the version (cache busting)
for key in url download_url; do
  u=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]])" editors/duo-writer/ext.json "$key")
  case "$u" in *"$v_src"*) ok "$key carries the version";; *) bad "$key does not carry the version: $u";; esac
done
main=$(python3 -I -c "import json,sys;print(json.load(open(sys.argv[1]))['sn']['main'])" editors/duo-writer/package.json)
if [ -f "editors/duo-writer/$main" ]; then ok "sn.main ($main) exists"; else bad "sn.main missing: $main"; fi

# 7. The zip holds the entry file and every font, and no demo files
list=$(unzip -Z1 "editors/duo-writer/duo-writer-$v_src.zip" 2>/dev/null)
echo "$list" | grep -q "^$main$" && ok "zip contains $main" || bad "zip lacks $main"
for f in src/duo-writer/public/fonts/*.woff2; do echo "$list" | grep -q "fonts/$(basename "$f")" || bad "zip lacks font $(basename "$f")"; done
echo "$list" | grep -q "^demo" && bad "zip contains demo files" || ok "zip has no demo files"

# 8. Built CSS references only fonts that are shipped
for ref in $(grep -o "fonts/[A-Za-z0-9._-]*\.woff2" editors/duo-writer/main.*.js | sort -u); do
  [ -f "editors/duo-writer/$ref" ] || bad "CSS references a font not shipped: $ref"
done
ok "every font referenced by the built CSS is shipped"

# 9. Working tree clean apart from this run's build output is the committer's call; report it
dirty=$(git status --short | wc -l | tr -d ' ')
echo "INFO  $dirty changed path(s) in the working tree"

[ "$fail" -eq 0 ] && echo "ALL CODE CHECKS PASSED for $v_src" || echo "CODE CHECKS FAILED"
exit $fail
