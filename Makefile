.PHONY: dev snapshot adr adr-snapshot goals goals-snapshot c4 c4-snapshot gantt gantt-snapshot agile agile-snapshot

# Where this repo's GitHub Pages site lives, worked out from the origin remote (owner/repo → https://owner.github.io/repo/).
# Cards link to the published markdown under it. Override: make snapshot PAGES=https://…/
PAGES ?= $(shell git remote get-url origin 2>/dev/null | sed -nE 's|^.*github\.com[:/]([^/]+)/([^/]+)$$|https://\1.github.io/\2/|p' | sed 's|\.git/$$|/|')

# Each area: one markdown file, edited in its tool's local viewer (Save writes it back) and
# snapshotted by the same tool into card.json + badge.svg beside it.
BIN := node_modules/.bin
ADR_MD   := docs/adr/decisions.md
GOALS_MD := docs/goals/x-matrix.md
C4_MD    := docs/architecture/c4.md
GANTT_MD := docs/schedule/schedule.md
AGILE_MD := docs/board/board.md
ADR   := $(BIN)/adr
HK    := $(BIN)/hoshin-kanri
C4    := $(BIN)/c4
AGILE := $(BIN)/agile
# ponytail: the gantt package is published as @pritzlaff/agile@1.0.1 (aliased in package.json), so its
# `agile` bin clashes with the kanban's; call it by path until it is published as @pritzlaff/gantt.
GANTT := node node_modules/@pritzlaff/gantt/bin/agile.mjs

# $(call snap,<cli>,<SRC env var>,<file.md>): writes card.json and badge.svg beside the markdown.
snap = for c in card badge; do $(2)=$(if $(PAGES),$(PAGES)$(3)) $(1) $$c $(3) || exit 1; done

# Regenerates stale cards and badges, then serves the dashboard on http://localhost:8000/
dev: snapshot
	bun index.ts

# docs/cards.js bundles every docs/**/card.json for the dashboard. make only rebuilds what is older than its sources.
CARDS := docs/adr/card.json docs/goals/card.json docs/architecture/card.json docs/schedule/card.json docs/board/card.json
snapshot: docs/cards.js

docs/cards.js: $(CARDS) scripts/cards.ts
	bun scripts/cards.ts

# A card also depends on its optional <name>.card.json design sidecar (File → Design card… in the viewer).
docs/adr/card.json: $(ADR_MD) $(wildcard docs/adr/decisions.card.json) | node_modules
	$(call snap,$(ADR),ADR_SRC,$(ADR_MD))
docs/goals/card.json: $(GOALS_MD) $(wildcard docs/goals/x-matrix.card.json) | node_modules
	$(call snap,$(HK),HK_SRC,$(GOALS_MD))
docs/architecture/card.json: $(C4_MD) $(wildcard docs/architecture/c4.card.json) | node_modules
	$(call snap,$(C4),C4_SRC,$(C4_MD))
docs/schedule/card.json: $(GANTT_MD) $(wildcard docs/schedule/schedule.card.json) | node_modules
	$(call snap,$(GANTT),AGILE_SRC,$(GANTT_MD))
docs/board/card.json: $(AGILE_MD) | node_modules
	$(call snap,$(AGILE),AGILE_SRC,$(AGILE_MD))

node_modules: package.json
	bun install
	@touch node_modules

# make <area>: opens its file in the tool's viewer on localhost; Save writes it back.
# make <area>-snapshot: rebuilds its card.json and badge.svg now, stale or not, and rebundles docs/cards.js.
adr: | node_modules
	$(ADR) $(ADR_MD)
adr-snapshot: | node_modules
	$(call snap,$(ADR),ADR_SRC,$(ADR_MD))
	bun scripts/cards.ts

goals: | node_modules
	$(HK) $(GOALS_MD)
goals-snapshot: | node_modules
	$(call snap,$(HK),HK_SRC,$(GOALS_MD))
	bun scripts/cards.ts

c4: | node_modules
	$(C4) $(C4_MD)
c4-snapshot: | node_modules
	$(call snap,$(C4),C4_SRC,$(C4_MD))
	bun scripts/cards.ts

gantt: | node_modules
	$(GANTT) $(GANTT_MD)
gantt-snapshot: | node_modules
	$(call snap,$(GANTT),AGILE_SRC,$(GANTT_MD))
	bun scripts/cards.ts

agile: | node_modules
	$(AGILE) $(AGILE_MD)
agile-snapshot: | node_modules
	$(call snap,$(AGILE),AGILE_SRC,$(AGILE_MD))
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
