#!/bin/sh
# Deploy the freshly built vsix to BOTH sides of the user's Qoder remote setup:
#   1. local Qoder IDE  (~/.qoder/extensions)
#   2. remote qoder-server (<server>:~/.qoder-server/extensions)
# Also removes the pre-rename identity (yushuailong.qodercli-contextbridge).
# Run from the repo root:  sh scripts/deploy-test.sh [vsix]
set -e
VSIX="${1:-qodercli-for-vscode-0.4.1.vsix}"
VER="0.4.1"
ID="yushuailong.qodercli-for-vscode"
OLD_ID="yushuailong.qodercli-contextbridge"
HOST="server"

# ---- local ----
LE="$HOME/.qoder/extensions"
cp "$LE/extensions.json" "$LE/extensions.json.bak-rename"
rm -rf "$LE/$ID-$VER" "$LE"/"$OLD_ID"-* /tmp/cb-vsix-extract
unzip -q "$VSIX" -d /tmp/cb-vsix-extract
cp -R /tmp/cb-vsix-extract/extension "$LE/$ID-$VER"
node -e '
const fs = require("fs");
const ver = process.argv[1], id = "yushuailong.qodercli-for-vscode", old = "yushuailong.qodercli-contextbridge";
const p = process.env.HOME + "/.qoder/extensions/extensions.json";
const j = JSON.parse(fs.readFileSync(p, "utf8")).filter(e => e.identifier.id !== old);
const dir = process.env.HOME + "/.qoder/extensions/" + id + "-" + ver;
const entry = {
  identifier: { id },
  version: ver,
  location: { $mid: 1, path: dir, scheme: "file" },
  relativeLocation: id + "-" + ver,
  metadata: { installedTimestamp: Date.now(), pinned: true, source: "vsix" },
};
j.push(entry);
fs.writeFileSync(p, JSON.stringify(j, null, "\t"));
console.log("[local] registered", id, ver);
' "$VER"
rm -rf "$HOME/Library/Application Support/Qoder/User/globalStorage/$OLD_ID"

# ---- remote ----
scp -q "$VSIX" "$HOST:/tmp/cb-$VER.vsix"
ssh "$HOST" sh -s "$VER" <<'REMOTE'
set -e
VER="$1"
ID="yushuailong.qodercli-for-vscode"
OLD_ID="yushuailong.qodercli-contextbridge"
E="$HOME/.qoder-server/extensions"
D="$E/$ID-$VER"
T=$(mktemp -d)
unzip -q "/tmp/cb-$VER.vsix" -d "$T"
rm -rf "$D" "$E"/"$OLD_ID"-*
cp -R "$T/extension" "$D"
node -e '
const fs = require("fs");
const ver = process.argv[1], id = "yushuailong.qodercli-for-vscode", old = "yushuailong.qodercli-contextbridge";
const dir = process.env.HOME + "/.qoder-server/extensions/" + id + "-" + ver;
const p = process.env.HOME + "/.qoder-server/extensions/extensions.json";
const j = JSON.parse(fs.readFileSync(p, "utf8")).filter(e => e.identifier.id !== old);
const entry = {
  identifier: { id },
  version: ver,
  location: { $mid: 1, path: dir, scheme: "file" },
  relativeLocation: id + "-" + ver,
  metadata: { installedTimestamp: Date.now(), source: "vsix", updated: false, isPreReleaseVersion: false, targetPlatform: "undefined" },
};
j.push(entry);
fs.writeFileSync(p, JSON.stringify(j, null, "\t"));
console.log("[remote] registered", id, ver);
' "$VER"
rm -rf "$HOME/.qoder-server/data/User/globalStorage/$OLD_ID"
REMOTE

echo "deploy done: local + remote @ $VER (old identity removed)"
