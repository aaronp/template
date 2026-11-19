.PHONY: dev snapshot test adr adr-snapshot goals goals-snapshot c4 c4-snapshot gantt gantt-snapshot agile agile-snapshot risks risks-snapshot celldeck celldeck-snapshot

# This checkout's CLI and manifest (never the npm copy or the published manifest).
P := node $(CURDIR)/bin/project.mjs --manifest $(CURDIR)/manifest.json
BIN := node_modules/.bin

# Serves the dashboard on http://localhost:8000/ with every area's editor beside it (Save writes to this
# checkout); saving a docs/ file rebuilds its card and reloads the dashboard.
dev: | node_modules
	$(P) dev

# Rewrites stale cards and badges beside each area's file.
snapshot: | node_modules
	$(P) snapshot

test:
	node --test test/*.test.mjs

node_modules: package.json
	bun install
	@touch node_modules

# make <area>: opens its file in the tool's viewer on localhost; Save writes it back.
# make <area>-snapshot: rewrites every card and badge now, stale or not.
adr: | node_modules
	$(BIN)/adr docs/adr/decisions.md
goals: | node_modules
	$(BIN)/hoshin-kanri docs/goals/x-matrix.md
c4: | node_modules
	$(BIN)/c4 docs/architecture/c4.md
gantt: | node_modules
	$(BIN)/gantt docs/schedule/schedule.md
agile: | node_modules
	$(BIN)/agile docs/board/board.md
risks: | node_modules
	$(BIN)/risk-register docs/risks/risks.md
celldeck: | node_modules
	$(BIN)/celldeck docs/overview/deck.json
adr-snapshot goals-snapshot c4-snapshot gantt-snapshot agile-snapshot risks-snapshot celldeck-snapshot: | node_modules
	$(P) snapshot --force

# Template only.
.PHONY: clone demo demo-build

# Starts a new project repo (an install into an empty repo): make clone [REPO=owner/repo] [NAME="My project"] [DEST=../dir]
clone:
	@REPO=$(REPO) NAME="$(NAME)" DEST=$(DEST) scripts/clone.sh

# A fictional Acme project with every area filled in from examples/acme/docs (each tool's Acme example).
# demo-build copies it into $(DEMO_SRC) and builds the site into $(DEMO) (replacing earlier ones), its cards
# linking under DEMO_PAGES; demo then serves it locally with the editors. Pages publishes the build at <site>/demo/.
DEMO_SRC ?= temp/demo-src
DEMO ?= temp/demo
demo-build: | node_modules
	rm -rf $(DEMO_SRC) $(DEMO)
	mkdir -p $(DEMO_SRC)
	cp -R examples/acme/docs $(DEMO_SRC)/
	cp -R docs/project.json docs/cards $(DEMO_SRC)/docs/
	cd $(DEMO_SRC) && $(P) build --name Acme --out $(abspath $(DEMO)) $(if $(DEMO_PAGES),--pages $(DEMO_PAGES))

demo: demo-build
	cd $(DEMO_SRC) && $(P) dev
