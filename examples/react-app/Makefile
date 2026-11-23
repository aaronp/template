# The app's own targets; `project add` appends its managed block below.
.PHONY: dev build site
dev: ; bun run dev
build: ; bun run build
# The app at _site/, the project site (dashboard, docs/, API docs) at _site/project/: what Pages publishes.
site: build ; bunx project build --app dist --out _site

# >>> @pritzlaff/project — managed by `project add/remove/update`; edits inside are overwritten
.PHONY: dashboard dashboard-build snapshot goals c4 celldeck adr decision-map risks gantt agile
dashboard: ; npx project dev
dashboard-build: ; npx project build
snapshot: ; npx project snapshot
goals: ; npx hoshin-kanri docs/goals/x-matrix.md
c4: ; npx c4 docs/architecture/c4.md
celldeck: ; npx celldeck docs/overview/deck.json
adr: ; npx adr docs/adr/decisions.md
decision-map: ; npx decision-map docs/map/map.md
risks: ; npx risk-register docs/risks/risks.md
gantt: ; npx gantt docs/schedule/schedule.md
agile: ; npx agile docs/board/board.md
# <<< @pritzlaff/project
