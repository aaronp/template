#!/usr/bin/env bash
# Starts a new project repo: an empty repo with this README, then `project add all` and `project pages`.
# REPO, NAME, DEST and TEMPLATE may be set in the environment; anything missing is prompted for.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -n "${REPO:-}" ] || read -rp "GitHub repo for the new project (owner/repo or URL): " REPO
# Accepts owner/repo, https://github.com/owner/repo(.git), git@github.com:owner/repo.git
SLUG=$(echo "$REPO" | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##; s#/$##')
[[ $SLUG =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "Can't parse repo: $REPO" >&2; exit 1; }
OWNER=${SLUG%/*}
REPO_NAME=${SLUG#*/}

[ -n "${NAME:-}" ] || read -rp "Project name [$REPO_NAME]: " NAME
NAME=${NAME:-$REPO_NAME}
# Kept simple so it can go into HTML, JS strings and sed replacements unescaped.
[[ $NAME =~ ^[A-Za-z0-9\ _.-]+$ ]] || { echo "Project name may only use letters, digits, spaces, _ . -" >&2; exit 1; }

[ -n "${DEST:-}" ] || read -rp "Destination dir [../$REPO_NAME]: " DEST
DEST=${DEST:-../$REPO_NAME}
[ ! -e "$DEST" ] || [ -z "$(ls -A "$DEST")" ] || { echo "$DEST exists and is not empty" >&2; exit 1; }

# The "Generated from" link: this checkout's origin.
TEMPLATE=${TEMPLATE:-$(git remote get-url origin 2>/dev/null | sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##' || true)}
TEMPLATE=${TEMPLATE:-https://github.com/aaronp/template}

OWNER_LC=$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')
if [ "$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]')" = "$OWNER_LC.github.io" ]; then
  PAGES="https://$OWNER_LC.github.io/"
else
  PAGES="https://$OWNER_LC.github.io/$REPO_NAME/"
fi

mkdir -p "$DEST"
cp README.md "$DEST/"
cd "$DEST"
printf '{\n  "name": "%s",\n  "private": true,\n  "devDependencies": {}\n}\n' "$REPO_NAME" > package.json
perl -0pi -e 's/<!-- template:start -->.*?<!-- template:end -->\n//s' README.md
perl -pi -e "s#^\# project-template#\# $NAME#; s#^Dashboard: .*#Dashboard: $PAGES · Generated from [project-template]($TEMPLATE)#" README.md

git init -q -b main
git remote add origin "git@github.com:$SLUG.git"

# Installs the tools (needs network) and wires them into docs/, then writes the Pages workflow.
npx -y @pritzlaff/project add all && npx project pages \
  || echo "Setup failed; in $DEST run: npx -y @pritzlaff/project add all && npx project pages" >&2

cat <<MSG
Created $DEST  (remote: git@github.com:$SLUG.git)
Next:
  cd $DEST
  git add . && git commit -m "Initial project from template" && git push -u origin main
  Then on GitHub: Settings → Pages → Source: GitHub Actions
Live at: $PAGES
MSG
