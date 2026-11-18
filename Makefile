.PHONY: dev snapshot adr adr-snapshot goals goals-snapshot c4 c4-snapshot gantt gantt-snapshot agile agile-snapshot risks risks-snapshot celldeck celldeck-snapshot

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
RISKS_MD := docs/risks/risks.md
DECK     := docs/overview/deck.json
ADR   := $(BIN)/adr
HK    := $(BIN)/hoshin-kanri
C4    := $(BIN)/c4
AGILE := $(BIN)/agile
GANTT := $(BIN)/gantt
RR    := $(BIN)/risk-register
CELLDECK := $(BIN)/celldeck

# $(call snap,<cli>,<SRC env var>,<file.md>): writes card.json and badge.svg beside the markdown.
snap = for c in card badge; do $(2)=$(if $(PAGES),$(PAGES)$(3)) $(1) $$c $(3) || exit 1; done

# Regenerates stale cards and badges, then serves the dashboard on http://localhost:8000/ with every area's
# editor on 8001+ (Save writes to this checkout); locally the dashboard's cards link to those editors.
# Saving any docs/ file rebuilds its card and reloads the open dashboard.
dev: snapshot
	bun index.ts $(ADR):$(ADR_MD) $(HK):$(GOALS_MD) $(C4):$(C4_MD) $(RR):$(RISKS_MD) $(GANTT):$(GANTT_MD) $(AGILE):$(AGILE_MD) $(CELLDECK):$(DECK)

# docs/cards.js bundles every docs/**/card.json for the dashboard. make only rebuilds what is older than its sources.
CARDS := docs/adr/card.json docs/goals/card.json docs/architecture/card.json docs/overview/card.json docs/schedule/card.json docs/board/card.json docs/risks/card.json
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
	$(call snap,$(GANTT),GANTT_SRC,$(GANTT_MD))
docs/board/card.json: $(AGILE_MD) | node_modules
	$(call snap,$(AGILE),AGILE_SRC,$(AGILE_MD))
docs/risks/card.json: $(RISKS_MD) $(wildcard docs/risks/risks.card.json) | node_modules
	$(call snap,$(RR),RR_SRC,$(RISKS_MD))
# Cell Deck has no card export, so the template writes its card (no badge).
docs/overview/card.json: $(DECK) scripts/deck-card.ts
	PAGES=$(PAGES) bun scripts/deck-card.ts $(DECK)

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
	$(call snap,$(GANTT),GANTT_SRC,$(GANTT_MD))
	bun scripts/cards.ts

agile: | node_modules
	$(AGILE) $(AGILE_MD)
agile-snapshot: | node_modules
	$(call snap,$(AGILE),AGILE_SRC,$(AGILE_MD))
	bun scripts/cards.ts

risks: | node_modules
	$(RR) $(RISKS_MD)
risks-snapshot: | node_modules
	$(call snap,$(RR),RR_SRC,$(RISKS_MD))
	bun scripts/cards.ts

celldeck: | node_modules
	$(CELLDECK) $(DECK)
celldeck-snapshot:
	PAGES=$(PAGES) bun scripts/deck-card.ts $(DECK)
	bun scripts/cards.ts

# Template only (make clone removes this block from the copy).
.PHONY: clone test demo demo-build

# Copies this template into a new project: make clone [REPO=owner/repo] [NAME="My project"] [DEST=../dir]
clone:
	@REPO=$(REPO) NAME="$(NAME)" DEST=$(DEST) scripts/clone.sh

# Clones into ./temp/test (replacing any earlier one) as aaronp/test, then serves it.
# Card links assume aaronp/test is pushed and published. In another terminal: cd temp/test && make adr
test:
	rm -rf temp/test
	$(MAKE) clone REPO=aaronp/test NAME="Test project" DEST=./temp/test
	cd temp/test && $(MAKE) dev

# A fictional Acme project with every area filled in from examples/acme/docs (each tool's Acme example),
# served locally with the editors. The Pages workflow publishes the same build at <site>/demo/.
demo: demo-build
	cd $(DEMO) && $(MAKE) dev

# Builds the Acme project into $(DEMO) (replacing any earlier one): a clone, with its cards linking under DEMO_PAGES.
DEMO ?= temp/demo
DEMO_REPO ?= acme/acme
demo-build:
	rm -rf $(DEMO)
	$(MAKE) clone REPO=$(DEMO_REPO) NAME="Acme" DEST=$(DEMO)
	cp -R examples/acme/docs/. $(DEMO)/docs/
	cd $(DEMO) && $(MAKE) -B snapshot $(if $(DEMO_PAGES),PAGES=$(DEMO_PAGES))
