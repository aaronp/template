.PHONY: dev summaries test adr clone

# Regenerates stale summaries, then serves the dashboard.
dev: summaries
	bun index.ts

# Each area's summary and badge are rebuilt only when its source (or the script) is newer.
summaries: docs/summaries/adr.json

docs/summaries/adr.json: docs/adr/decisions.md scripts/summarize.ts
	bun scripts/summarize.ts adr

test:
	bun test scripts

# Opens docs/adr/decisions.md in the ADR viewer (needs `bun install`).
adr:
	bun run adr

# Template only (make clone removes this block from the copy).
# Copies this template into a new project: make clone [REPO=owner/repo] [NAME="My project"] [DEST=../dir]
clone:
	@REPO=$(REPO) NAME="$(NAME)" DEST=$(DEST) scripts/clone.sh
