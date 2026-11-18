.PHONY: dev snapshot adr clone

# Where this repo's GitHub Pages site lives, worked out from the origin remote (owner/repo → https://owner.github.io/repo/).
# Cards link to the published markdown under it. Override: make snapshot PAGES=https://…/
PAGES ?= $(shell git remote get-url origin 2>/dev/null | sed -nE 's|^.*github\.com[:/]([^/]+)/([^/]+)$$|https://\1.github.io/\2/|p' | sed 's|\.git/$$|/|')
ADR := node_modules/.bin/adr

# Regenerates stale cards and badges, then serves the dashboard on http://localhost:8000/
dev: snapshot
	bun index.ts

# Each area writes <dir>/card.json (+ badge.svg); docs/cards.js bundles them for the dashboard.
# make only rebuilds what is older than its sources.
snapshot: docs/cards.js

docs/cards.js: docs/adr/card.json scripts/cards.ts
	bun scripts/cards.ts

docs/adr/card.json: docs/adr/decisions.md $(wildcard docs/adr/decisions.card.json) | node_modules
	ADR_SRC=$(if $(PAGES),$(PAGES)docs/adr/decisions.md) $(ADR) card docs/adr/decisions.md
	ADR_SRC=$(if $(PAGES),$(PAGES)docs/adr/decisions.md) $(ADR) badge docs/adr/decisions.md

node_modules: package.json
	bun install
	@touch node_modules

# Opens docs/adr/decisions.md in the ADR viewer on localhost (File → Design card… makes decisions.card.json).
adr: | node_modules
	$(ADR) docs/adr/decisions.md

# Template only (make clone removes this block from the copy).
# Copies this template into a new project: make clone [REPO=owner/repo] [NAME="My project"] [DEST=../dir]
clone:
	@REPO=$(REPO) NAME="$(NAME)" DEST=$(DEST) scripts/clone.sh
