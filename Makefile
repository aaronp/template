.PHONY: dev snapshot adr adr-snapshot goals goals-snapshot

# Where this repo's GitHub Pages site lives, worked out from the origin remote (owner/repo → https://owner.github.io/repo/).
# Cards link to the published markdown under it. Override: make snapshot PAGES=https://…/
PAGES ?= $(shell git remote get-url origin 2>/dev/null | sed -nE 's|^.*github\.com[:/]([^/]+)/([^/]+)$$|https://\1.github.io/\2/|p' | sed 's|\.git/$$|/|')
ADR := node_modules/.bin/adr
ADR_SNAPSHOT = for c in card badge; do ADR_SRC=$(if $(PAGES),$(PAGES)docs/adr/decisions.md) $(ADR) $$c docs/adr/decisions.md || exit 1; done
HK := node_modules/.bin/hoshin-kanri
GOALS_SNAPSHOT = for c in card badge; do HK_SRC=$(if $(PAGES),$(PAGES)docs/goals/x-matrix.md) $(HK) $$c docs/goals/x-matrix.md || exit 1; done

# Regenerates stale cards and badges, then serves the dashboard on http://localhost:8000/
dev: snapshot
	bun index.ts

# Each area writes <dir>/card.json (+ badge.svg); docs/cards.js bundles them for the dashboard.
# make only rebuilds what is older than its sources.
snapshot: docs/cards.js

docs/cards.js: docs/adr/card.json docs/goals/card.json scripts/cards.ts
	bun scripts/cards.ts

docs/adr/card.json: docs/adr/decisions.md $(wildcard docs/adr/decisions.card.json) | node_modules
	$(ADR_SNAPSHOT)

docs/goals/card.json: docs/goals/x-matrix.md | node_modules
	$(GOALS_SNAPSHOT)

node_modules: package.json
	bun install
	@touch node_modules

# Opens docs/adr/decisions.md in the ADR viewer on localhost; File → Save writes it back
# (File → Design card… makes decisions.card.json).
adr: | node_modules
	bun run adr

# Rebuilds docs/adr/card.json and badge.svg now, stale or not, and rebundles docs/cards.js.
adr-snapshot: | node_modules
	$(ADR_SNAPSHOT)
	bun scripts/cards.ts

# Opens docs/goals/x-matrix.md (Hoshin Kanri X-Matrix) in its viewer on localhost; Save writes it back.
goals: | node_modules
	bun run goals

# Rebuilds docs/goals/card.json, badge.svg and summary.svg now, stale or not, and rebundles docs/cards.js.
goals-snapshot: | node_modules
	$(GOALS_SNAPSHOT)
	bun scripts/cards.ts

# Template only (make clone removes this block from the copy).
.PHONY: clone test

# Copies this template into a new project: make clone [REPO=owner/repo] [NAME="My project"] [DEST=../dir]
clone:
	@REPO=$(REPO) NAME="$(NAME)" DEST=$(DEST) scripts/clone.sh

# Clones into ./temp/test (replacing any earlier one) as aaronp/test, then serves it.
# Card links assume aaronp/test is pushed and published. In another terminal: cd temp/test && make adr
test:
	rm -rf temp/test
	$(MAKE) clone REPO=aaronp/test NAME="Test project" DEST=./temp/test
	cd temp/test && $(MAKE) dev
