#!/usr/bin/env bash
#
# Deploy the Bike Workshop Calculator to the Rückenwind Strato host.
#
# Steps: push the current branch, build, then sync dist/ to the server over
# SFTP — uploads all build output and prunes stale hashed assets.

set -euo pipefail

# Run from the repo root regardless of where the script is invoked from.
cd "$(dirname "$0")/.."
REPO="$PWD"

command -v expect >/dev/null || { echo "error: 'expect' is required (brew install expect)"; exit 1; }

for v in DEPLOY_USER DEPLOY_HOST PASSWORD REMOTE_DIR DEPLOY_URL; do
  [ -n "${!v:-}" ] || { echo "error: $v must be set"; exit 1; }
done

# 1. Push (best-effort — a deploy shouldn't fail just because the remote is
#    unreachable or there's nothing new to push).
echo "==> Pushing branch"
git push origin HEAD || echo "    (push skipped/failed — continuing to deploy)"

# 2. Build.
echo "==> Building"
npm run build

# Space-separated so the membership test below (a shell `case` glob) works.
LOCAL_ASSETS="$(cd dist/assets && printf '%s ' *)"
echo "==> Built assets: $LOCAL_ASSETS"

# 3. Upload every generated directory and file, including public web-app assets.
# Keep hashed assets first and index.html last so the entry point is published
# after its dependencies. Paths are generated locally, never from remote input.
PAGE_CMDS=""
while IFS= read -r dir; do
  dir="${dir#dist/}"
  PAGE_CMDS="$PAGE_CMDS
send -- \"mkdir $dir\r\"; expect \"sftp>\""
done < <(find dist -mindepth 1 -type d | LC_ALL=C sort)
while IFS= read -r file; do
  file="${file#dist/}"
  PAGE_CMDS="$PAGE_CMDS
send -- \"put $file $file\r\"; expect \"sftp>\""
done < <(find dist -type f ! -path 'dist/assets/*' ! -path 'dist/index.html' | LC_ALL=C sort)
echo "==> Uploading"
OUT="$(expect <<EOF
log_user 1
set timeout 300
spawn sftp -o StrictHostKeyChecking=accept-new $DEPLOY_USER@$DEPLOY_HOST
expect "assword:"; send -- "$PASSWORD\r"
expect "sftp>"
send -- "lcd $REPO/dist/assets\r"; expect "sftp>"
send -- "cd $REMOTE_DIR/assets\r"; expect "sftp>"
send -- "put *\r"; expect "sftp>"
send -- "lcd $REPO/dist\r"; expect "sftp>"
send -- "cd $REMOTE_DIR\r"; expect "sftp>"
$PAGE_CMDS
send -- "put index.html\r"; expect "sftp>"
send -- "ls -1 assets\r"; expect "sftp>"
send -- "bye\r"
expect eof
EOF
)"

# 4. Prune stale assets. Every asset filename (local or remote) appears in the
#    captured output; subtracting the just-built set leaves only orphans to rm.
ALL="$(printf '%s\n' "$OUT" | grep -oE 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u || true)"
STALE=""
for f in $ALL; do
  case " $LOCAL_ASSETS " in
    *" $f "*) : ;;                 # current build — keep
    *) STALE="$STALE $f" ;;        # left over from a previous build — remove
  esac
done

# Safety net: never rm a file that exists in the build we just uploaded, no
# matter what the membership test above decided.
for f in $STALE; do
  if [ -e "dist/assets/$f" ]; then
    echo "error: refusing to prune $f — it's part of the current build"; exit 1
  fi
done

if [ -n "${STALE// /}" ]; then
  echo "==> Pruning stale assets:$STALE"
  RM_CMDS=""
  for f in $STALE; do
    RM_CMDS="$RM_CMDS
send -- \"rm assets/$f\r\"; expect \"sftp>\""
  done
  expect <<EOF
log_user 1
set timeout 120
spawn sftp -o StrictHostKeyChecking=accept-new $DEPLOY_USER@$DEPLOY_HOST
expect "assword:"; send -- "$PASSWORD\r"
expect "sftp>"
send -- "cd $REMOTE_DIR\r"; expect "sftp>"
$RM_CMDS
send -- "bye\r"
expect eof
EOF
else
  echo "==> No stale assets to prune"
fi

# 5. Verify the live site references the freshly-built files.
echo "==> Verifying live site"
LIVE="$(curl -s "$DEPLOY_URL" \
  | grep -oE 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u || true)"
echo "    live references: $LIVE"
for f in $LOCAL_ASSETS; do
  # Images are loaded by the JavaScript, not referenced in the entry HTML.
  case "$f" in index-*.js|index-*.css) ;; *) continue ;; esac
  case "$LIVE" in
    *"$f"*) : ;;
    *) echo "    ERROR: $f not referenced live yet (CDN/browser cache?)"; exit 1 ;;
  esac
done

# Verify the manifest and icons too: a successful HTML upload alone is not
# sufficient for home-screen installation.
node scripts/verify-web-app.mjs

echo "==> Done."
