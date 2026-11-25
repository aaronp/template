.PHONY: usage dev dashboard dashboard-build snapshot testadr adr-snapshot goals goals-snapshot c4 c4-snapshot gantt gantt-snapshot agile agile-snapshot risks risks-snapshot celldeck celldeck-snapshot

# This checkout's CLI and manifest (never the npm copy or the published manifest).
P := node $(CURDIR)/bin/project.mjs --manifest $(CURDIR)/manifest.json
BIN := node_modules/.bin

# make usage: the CLI's commands, plus each server (dashboard, one editor per area) with its port and how to start it.
usage: | node_modules
	@$(P) usage

# make dashboard: serves the dashboard on http://localhost:8000/ and opens it (NO_OPEN=1 skips), with every
# area's editor beside it (Save writes to this checkout); saving a docs/ file rebuilds its card and reloads it.
dashboard dev: | node_modules
	$(P) dev

# make dashboard-build: the self-contained site Pages publishes, in _site/ (open _site/dashboard.html).
dashboard-build: | node_modules
	$(P) build

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

# The React app example (examples/react-app) as Pages publishes it: the app at $(REACT_APP)/, the dashboard and
# API docs under $(REACT_APP)/project/, its cards linking under REACT_APP_PAGES. Needs the network (bun install).
.PHONY: react-app-build
REACT_APP ?= temp/react-app
react-app-build: | node_modules
	cd examples/react-app && bun install && bun run build && \
	  $(P) build --app dist --out $(abspath $(REACT_APP)) $(if $(REACT_APP_PAGES),--pages $(REACT_APP_PAGES))

# make package: the npm tarball, as `npm publish` would upload it, in temp/.
.PHONY: package test-install
VERSION := $(shell node -p "require('./package.json').version")
TARBALL := $(CURDIR)/temp/pritzlaff-project-$(VERSION).tgz
package:
	mkdir -p temp
	npm pack --pack-destination temp

# make test-install: installs that tarball into a fresh repo in $(INSTALL_TEST) (replacing any earlier one) that
# already has its own Makefile, adds $(INSTALL_AREAS) from this checkout's manifest, and builds the site.
# Needs the network (bun fetches the tools). Then: cd $(INSTALL_TEST) && make dev, or open _site/dashboard.html.
INSTALL_TEST ?= temp/install-test
INSTALL_AREAS ?= adr risks celldeck
test-install: package
	rm -rf $(INSTALL_TEST)
	mkdir -p $(INSTALL_TEST)
	cd $(INSTALL_TEST) \
	  && printf '{ "name": "install-test", "private": true }\n' > package.json \
	  && printf 'build:\n\t@echo the host repo build\n' > Makefile \
	  && bun add -d $(TARBALL) \
	  && bunx project add $(INSTALL_AREAS) --manifest $(CURDIR)/manifest.json \
	  && bunx project build \
	  && test -f _site/dashboard.html && test -f docs/project.json \
	  && grep -q '^build:' Makefile && grep -q '@pritzlaff/project' Makefile \
	  && $(MAKE) -s build && $(MAKE) -s snapshot
	@echo "OK: $(INSTALL_TEST)/_site/dashboard.html (or: cd $(INSTALL_TEST) && make dev)"

# Bumps package.json, commits and tags v<version> (needs a clean tree).
.PHONY: publish bump-patch bump-minor bump-major
bump-patch bump-minor bump-major:
	npm version $(@:bump-%=%)

# Publishes @pritzlaff/project to npm. Bump first: make bump-patch|bump-minor|bump-major
publish: test
	npm publish

# >>> @pritzlaff/project — managed by `project add/remove/update`; edits inside are overwritten
.PHONY: dashboard decision-map
dashboard: ; npx project dev
decision-map: ; npx decision-map docs/map/map.md
# <<< @pritzlaff/project
