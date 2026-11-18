#!/usr/bin/env bash
# Copies this template into a new project repo, filling in its name and GitHub repo,
# and leaves the template-only parts (Template.dc.html, examples/, this script, `make clone`) behind.
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

# The "Generated from" link: this checkout's origin, else what Main.dc.html already says.
TEMPLATE=${TEMPLATE:-$(git remote get-url origin 2>/dev/null | sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##' || true)}
TEMPLATE=${TEMPLATE:-$(sed -nE "s#.*template: '([^']+)'.*#\1#p" Main.dc.html)}

OWNER_LC=$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')
if [ "$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]')" = "$OWNER_LC.github.io" ]; then
  PAGES="https://$OWNER_LC.github.io/"
else
  PAGES="https://$OWNER_LC.github.io/$REPO_NAME/"
fi

# Tracked and new (not ignored) files, minus the template-only ones.
mkdir -p "$DEST"
git ls-files -co --exclude-standard -z \
  | grep -zv -e '^Template\.dc\.html$' -e '^examples/' -e '^scripts/clone\.sh$' \
  | tar --null -T - -cf - | tar -xf - -C "$DEST"

cd "$DEST"
perl -pi -e "s#^    const PROJECT = .*#    const PROJECT = { name: '$NAME', repo: '$SLUG', template: '$TEMPLATE' };#; s#^<title>.*#<title>$NAME — dashboard</title>#" Main.dc.html
perl -pi -e 's#Template\.dc\.html#Main.dc.html#g; s#>project-template<#>'"$NAME"'<#' index.html
perl -pi -e 's#"name": "project-template"#"name": "'"$REPO_NAME"'"#' package.json
perl -0pi -e 's/\n# Template only.*//s' Makefile
perl -0pi -e 's/<!-- template:start -->.*?<!-- template:end -->\n//s' README.md
perl -pi -e "s#^\# project-template#\# $NAME#; s#^Dashboard: .*#Dashboard: $PAGES · Generated from [project-template]($TEMPLATE)#" README.md

git init -q -b main
git remote add origin "git@github.com:$SLUG.git"

# Re-snapshot every card (-B) so they link to the new repo's Pages site (needs network for `bun install`).
make -B snapshot || echo "make snapshot failed; run it in $DEST once dependencies install" >&2

cat <<MSG
Created $DEST  (remote: git@github.com:$SLUG.git)
Next:
  cd $DEST
  git add . && git commit -m "Initial project from template" && git push -u origin main
  Then on GitHub: Settings → Pages → Source: GitHub Actions
Live at: $PAGES
MSG
