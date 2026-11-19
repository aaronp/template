# Installable project dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this template repo into `@pritzlaff/project`, a Node CLI (`list`, `add`, `remove`, `update`, `snapshot`, `build`, `dev`, `pages`) driven by a published `manifest.json`, so existing repos can install the areas they want.

**Architecture:** `manifest.json` (this repo, published by Pages) lists the tools. `add` records each entry in the host's `docs/project.json`; `snapshot`/`build`/`dev` read only that file. Cards come from the tool's `card`/`badge` commands, a card script copied from beside the manifest, or a basic card the CLI writes. One renderer turns `dashboard/dashboard.dc.html` (today's `Main.dc.html`) into a self-contained page for `build` and a served page for `dev`.

**Tech Stack:** Node ≥ 22 ES modules (`.mjs`), stdlib only (`node:fs`, `node:http`, `node:child_process`, `node:test`). No new dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-11-19-installable-project-design.md`

## Global Constraints

- Node ≥ 22; plain `.mjs`; no bun or make needed by host repos; no runtime dependencies.
- Never overwrite an existing area file, workflow, `index.html` or `package.json` script in the host; `remove` never deletes area files.
- `snapshot`, `build`, `dev` never touch the network; only `list`, `add`, `update` fetch the manifest.
- Default manifest: `https://aaronp.github.io/template/manifest.json`; `--manifest <url|path>` overrides. Inside this repo every flow passes `--manifest ./manifest.json` and runs `bin/project.mjs` from the checkout.
- Card contract: generator gets the area file as its argument and the published file URL in the env (`srcEnv` for tool commands, `SRC` for scripts); writes `card.json` (and optionally `badge.svg`) beside the file. `card.json` is version 1, the shape `adr card` writes.
- Pages URL default from `origin`: `owner.github.io/repo/`, or `owner.github.io/` for a `owner.github.io` repo, owner lowercased (as `scripts/clone.sh` does today).
- Package-manager detection: `bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm.
- Area order everywhere = manifest order: goals, architecture, overview, decisions, risks, schedule, work.

## Review Focus

1. A host file at a conventional path but not in `docs/project.json` (e.g. its own `docs/adr/decisions.md`) must be ignored by snapshot/build: test in Task 2.
2. `docs/project.json` lists a tool whose file is missing: snapshot warns and skips, build still succeeds: test in Task 2.
3. `--pages` without a trailing slash would break every `?src=` link; normalise to one trailing slash: test in Task 2.
4. `build --out` pointed at an existing site dir with its own `index.html`: must be left untouched: test in Task 3.
5. `add` run twice for the same tool: no duplicate entry, existing area file untouched: test in Task 4.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `manifest.json` | The tool list (published; not in npm `files`) |
| `cards/celldeck.mjs` | Cell Deck card script (port of `scripts/deck-card.ts`) |
| `lib/manifest.mjs` | Load manifest, resolve a tool name, read/write `docs/project.json` |
| `lib/snapshot.mjs` | Pages URL, bin resolution, running card generators, basic card |
| `lib/render.mjs` | Dashboard HTML for `build` (inlined) and `dev` (served) |
| `lib/build.mjs` | `build` command: snapshot, write `dashboard.html`, copy sources, `index.html` |
| `lib/install.mjs` | `list`, `add`, `remove`, `update`, `pages` |
| `lib/dev.mjs` | `dev` server (port of `index.ts`) |
| `bin/project.mjs` | Arg parsing and dispatch |
| `dashboard/dashboard.dc.html` | Dashboard source (from `Main.dc.html`) |
| `test/*.test.mjs` | `node --test` |

---

### Task 1: Manifest and the host record

**Files:**
- Create: `manifest.json`, `lib/manifest.mjs`, `test/manifest.test.mjs`

**Interfaces:**
- Produces:
  - `loadManifest(src: string): Promise<Manifest>`: `src` is a URL (fetch) or a path. Throws if `version !== 1`. Returns `{ version, tools: Entry[], base: string }`, where `base` is the URL or directory the manifest came from (used to resolve card script paths).
  - `findTool(manifest, name: string): Entry`: matches `id` or `aliases`. Throws `Unknown tool "<name>". Try: project list`.
  - `readRecord(cwd): { manifestVersion: number, tools: Entry[] }`: `docs/project.json`, or `{ manifestVersion: 0, tools: [] }` if absent.
  - `writeRecord(cwd, record)`: keeps `tools` in manifest order by `order` (index in the manifest, stored on each entry), 2-space JSON plus a trailing newline.
  - `Entry` fields, exactly as the spec's example: `id, aliases, name, tool, package, bin, file, srcEnv, homepage, spec, viewer, dashboard: { tint, question, noLead }`, optional `card` (`{ script }` or `false`).

- [ ] **Step 1: Write the failing tests** in `test/manifest.test.mjs`
  - `manifest has the seven areas in walkthrough order`: `loadManifest('./manifest.json')` gives ids `['goals','architecture','overview','decisions','risks','schedule','work']`.
  - `aliases match today's make targets`: `findTool(m,'adr').id === 'decisions'`, `'risks'→'risks'`, `'c4'→'architecture'`, `'celldeck'→'overview'`, `'gantt'→'schedule'`, `'agile'→'work'`, `'goals'→'goals'`; `findTool(m,'nope')` throws `/Unknown tool "nope"/`.
  - `overview uses the card script`: `findTool(m,'celldeck').card` deep-equals `{ script: 'cards/celldeck.mjs' }`; every other entry has no `card` key.
  - `record round-trips and keeps manifest order`: write `[schedule, goals]` to a temp dir, read back ids `['goals','schedule']`.
- [ ] **Step 2: Run** `node --test test/manifest.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3: Write `manifest.json`** with the seven entries. Copy `name`, `tool`, `tint`, `question`, `noLead`, `file` from the `AREAS` array in `Main.dc.html:205-246`, and `package`, `homepage`, `spec` from the table in README.md. `bin` and `srcEnv` come from the Makefile (`ADR_SRC`, `HK_SRC`, `C4_SRC`, `RR_SRC`, `GANTT_SRC`, `AGILE_SRC`). `viewer` = `https://aaronp.github.io/<slug>/` (Goals: `https://aaronp.github.io/Hoshin-Kanri/`). Overview has `srcEnv: null` and `card: { "script": "cards/celldeck.mjs" }`.
- [ ] **Step 4: Implement `lib/manifest.mjs`.**
- [ ] **Step 5: Run** `node --test test/manifest.test.mjs`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: manifest.json and docs/project.json record`

### Task 2: Snapshot

**Files:**
- Create: `lib/snapshot.mjs`, `cards/celldeck.mjs`, `test/snapshot.test.mjs`, `test/helpers.mjs`

**Interfaces:**
- Consumes: `readRecord`, `Entry`.
- Produces:
  - `pagesUrl(cwd, override?: string): string | ''`: `override` normalised to exactly one trailing `/`, else from `git remote get-url origin` (constraint above), else `''`.
  - `resolveBin(cwd, entry): string`: `<cwd>/node_modules/.bin/<bin>` if present, else the bin path from `require.resolve('<package>/package.json')` via `createRequire(import.meta.url)` and the package's `bin` field. Throws `<package> is not installed: run your package manager's install`.
  - `snapshot({ cwd, pages, force }): Promise<string[]>`: returns the `card.json` paths written. For each recorded entry: if the file is missing, `console.warn` `skipping <id>: <file> not found (project add <id>)` and continue. Stale = `card.json` missing, or older than the file, `<stem>.card.json` sidecar, or `docs/cards/<id>.mjs`.
  - Generators, by `entry.card`:
    - undefined: `node <bin> card <file>`, then `node <bin> badge <file>`, env `{ [srcEnv]: pages + file }`. Leave `srcEnv` unset when `pages` is empty: the tools fall back to the bare path.
    - `{ script }`: `node docs/cards/<id>.mjs <file>`, env `SRC`.
    - `false`: the CLI writes a basic card (below).
  - `basicCard(cwd, entry, pages)`: version-1 card `{ title: name, subtitle: tool, status: { label: 'Not summarised', tone: 'neutral' }, heading: { primary: <git log -1 --format=%cs -- file, or 'new'>, label: 'last changed' }, legend: [], report: {}, source: { label: file, url: viewer + '?src=' + (pages + file) } }`.
- `cards/celldeck.mjs`: `scripts/deck-card.ts` ported to Node `fs`, same output, reading `process.env.SRC` instead of building from `PAGES`. The viewer URL stays `https://aaronp.github.io/celldeck/?src=` + `SRC ?? file`.

- [ ] **Step 1: Write `test/helpers.mjs`**: `acmeProject(): string` makes a temp dir, copies `examples/acme/docs` to `<tmp>/docs`, copies `cards/celldeck.mjs` to `<tmp>/docs/cards/overview.mjs`, and writes `docs/project.json` from `./manifest.json` with all seven entries.
- [ ] **Step 2: Write the failing tests** in `test/snapshot.test.mjs`
  - `writes a card for every area`: `snapshot({cwd, pages:'https://x.github.io/y', force:true})` returns 7 paths. `docs/adr/card.json` has `version: 1`, and its `source.url` contains `src=https%3A%2F%2Fx.github.io%2Fy%2Fdocs%2Fadr%2Fdecisions.md` or `src=https://x.github.io/y/docs/adr/decisions.md`. `docs/overview/card.json` has `subtitle: 'Cell Deck'`.
  - `pagesUrl adds one trailing slash`: `pagesUrl(cwd,'https://x.github.io/y') === 'https://x.github.io/y/'`, and the same for an input with `/`.
  - `unrecorded files are ignored`: a record with only `decisions`, plus a stray `docs/risks/risks.md`, gives one path and no `docs/risks/card.json`.
  - `missing file is skipped`: a record with `decisions` and the adr file deleted returns `[]` and does not throw.
  - `card false writes a basic card`: set the decisions entry's `card: false`. `docs/adr/card.json` gets `status.label === 'Not summarised'` and `heading.label === 'last changed'`.
  - `not stale, not rebuilt`: a second `snapshot({force:false})` returns `[]`.
- [ ] **Step 3: Run** `node --test test/snapshot.test.mjs`. Expected: FAIL.
- [ ] **Step 4: Implement `lib/snapshot.mjs` and `cards/celldeck.mjs`.**
- [ ] **Step 5: Run** `node --test test/`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: snapshot cards from the record`

### Task 3: Dashboard renderer and `build`

**Files:**
- Create: `dashboard/dashboard.dc.html` (`git mv Main.dc.html`), `lib/render.mjs`, `lib/build.mjs`, `test/build.test.mjs`

**Interfaces:**
- Consumes: `readRecord`, `snapshot`, `pagesUrl`.
- Produces:
  - `projectData({ cwd, pages, name? }) → { project: { name, repo, template }, areas: Entry[], cards: { [cardPath]: Card } }`. `name` = `--name`, or `package.json` `name`. `repo` = `owner/repo` from origin, or `''`. `template` = `'https://github.com/aaronp/template'`.
  - `renderDashboard(data, { inline: boolean }) → string`. Inline: each `<script src="./vendor/react.js">`, `react-dom.js`, `support.js` is replaced by its file contents (read relative to the package root), and `<script src="./docs/cards.js">` is replaced by `<script>window.PROJECT = <JSON>;</script>`. Escape `</` as `<\/` in the JSON. Not inline (dev): the scripts point at `/vendor/react.js`, `/vendor/react-dom.js`, `/support.js`, `/project.js`, `/local.js`.
  - `build({ cwd, out = '_site', pages, name }) → Promise<void>`: `snapshot({force:true})`, write `<out>/dashboard.html`, then copy each recorded entry's file plus its `card.json` and `badge.svg` (where present) to `<out>/<same path>`. Write `<out>/index.html` as a meta-refresh to `dashboard.html` only if absent.
- Dashboard changes in `dashboard/dashboard.dc.html`:
  - Delete the `AREAS` array, `PROJECT` and `TOOLS_HOST`.
  - Read `const { project: PROJECT, areas: ENTRIES, cards: CARDS } = window.PROJECT`.
  - Map each entry to the old shape: `area: name`, `tool`, `path: file`, `tint`, `question`, `noLead` (from `dashboard`), `card: dirname(file) + '/card.json'`.
  - Areas with no card in `CARDS` fall back to the basic look: status `'No card yet'`, metric `'—'`, no segments, and `href = viewer + '?src=' + file URL`.
  - Drop the "Generated from" wording for "Made with project".
  - Keep the `<head>` script tags as the renderer's replacement anchors (above).

- [ ] **Step 1: Write the failing tests** in `test/build.test.mjs` (using `acmeProject()`)
  - `builds a self-contained dashboard`: `build({cwd, out:<tmp>/site, pages:'https://x.github.io/y/'})`. `site/dashboard.html` contains `window.PROJECT =`, contains no `src="./vendor`, and its embedded JSON has 7 areas and 7 cards. `site/docs/adr/decisions.md` and `site/docs/overview/deck.json` exist. `site/index.html` contains `dashboard.html`.
  - `keeps an existing index.html`: pre-write `site/index.html` as `'mine'`; after build it is still `'mine'`.
  - `basic card renders`: with the decisions entry `card: false`, the build passes and the embedded `docs/adr/card.json` has status `'Not summarised'`.
- [ ] **Step 2: Run** `node --test test/build.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the renderer, build and dashboard edits.
- [ ] **Step 4: Run** `node --test test/`. Expected: PASS.
- [ ] **Step 5: Look at it.** Open `site/dashboard.html` from `file://`. It should show 7 Acme cards with figures, and the walkthrough should show the same order and questions as today's `https://aaronp.github.io/template/demo/Main.dc.html`.
- [ ] **Step 6: Commit** `feat: project build writes a self-contained dashboard`

### Task 4: CLI, install commands, `pages`

**Files:**
- Create: `bin/project.mjs`, `lib/install.mjs`, `test/install.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `detectPM(cwd) → 'bun'|'pnpm'|'yarn'|'npm'`, and `pmArgs(pm, 'add'|'remove'|'update', pkgs) → string[]` (`bun add -d`, `pnpm add -D`, `yarn add -D`, `npm i -D`; `remove`/`uninstall`; `update --latest` / `npm i -D <pkg>@latest`).
  - `wire(cwd, manifest, entry)`: records the entry (with `order`). Copies the card script from `new URL(script, manifest.base)` (fetch for a URL base, copy for a dir base) to `docs/cards/<id>.mjs`. Creates `entry.file` empty with `mkdir -p` only if absent. Idempotent.
  - `unwire(cwd, id)`: removes the entry, `docs/cards/<id>.mjs`, and the area's `card.json` and `badge.svg`. Prints `kept <file>`.
  - `list(cwd, manifest) → string` (lines: marker, id, name, package, installed version from `node_modules/<pkg>/package.json` or `-`). Marker: `*` installed, `~` installed but the recorded entry differs from the manifest, blank otherwise.
  - `add(cwd, manifest, names, { install = true })`: one PM call installing all the packages, plus `@pritzlaff/project` if it is not in `package.json`. Then `wire` each tool, `writeRecord` with `manifestVersion`, and `snapshot`. Prints the next commands (`npx project dev`, `npx project build`, `npx project pages`).
  - `remove(cwd, names)`: `unwire` each tool, then one PM remove.
  - `update(cwd, manifest, names?)`: defaults to every recorded tool. Prints a per-entry JSON diff of the changed keys, overwrites the entries and card scripts (`wire`), upgrades the packages, and snapshots.
  - `pages(cwd)`: writes `.github/workflows/pages.yml` if absent, else prints the build step. The workflow is today's `pages.yml` with bun swapped for `actions/setup-node@v4` (`node-version: 22`) and install by detected PM. Its build step is `npx project build --out _site --pages https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/`, and it uploads `_site`.
  - `bin/project.mjs`: parses `<cmd> [args] [--manifest x] [--pages x] [--out x] [--name x] [--port n] [--force]` with `node:util` `parseArgs`. Commands: `list add remove update snapshot build dev pages help`. `add all` expands to every manifest id. Unknown command: print usage, exit 1.

- [ ] **Step 1: Write the failing tests** in `test/install.test.mjs`
  - `detectPM picks by lockfile`: `bun.lock`→bun, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, none→npm.
  - `wire is idempotent and never overwrites`: pre-write `docs/adr/decisions.md` = `'mine'`, then `wire` decisions twice. The record has one `decisions` entry, and the file is still `'mine'`.
  - `wire copies the card script`: wire overview with `manifest.base` = repo dir; `docs/cards/overview.mjs` equals `cards/celldeck.mjs`.
  - `unwire keeps data`: wire then unwire decisions. The record has none, `docs/adr/card.json` is gone, and `docs/adr/decisions.md` still exists.
  - `list marks installed and drifted`: with decisions recorded and its `dashboard.question` edited, the output line for decisions starts with `~` and the goals line starts with a space.
  - `pages does not overwrite`: pre-write the workflow as `'mine'`; `pages(cwd)` leaves it unchanged.
- [ ] **Step 2: Run** `node --test test/install.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/install.mjs` and `bin/project.mjs`.
- [ ] **Step 4: Run** `node --test test/` and `node bin/project.mjs list --manifest ./manifest.json`. Expected: PASS, and 7 lines.
- [ ] **Step 5: Commit** `feat: project CLI with list/add/remove/update/pages`

### Task 5: `dev` server

**Files:**
- Create: `lib/dev.mjs`
- Delete: `index.ts`

**Interfaces:**
- Consumes: `readRecord`, `resolveBin`, `snapshot`, `projectData`, `renderDashboard`.
- Produces: `dev({ cwd, port = 8000, pages })`. It is `index.ts` ported to `node:http` and `fs.watch`, with the same behaviour:
  - Spawn `node <bin> <file>` per entry, detached, with env `PORT=port+1+i` and `NO_OPEN=1`. Capture the first URL each one prints into `local[file]`, and kill each process group on exit.
  - Serve `/` → `renderDashboard(projectData(...), {inline:false})` and `/project.js` → `window.PROJECT = …`. `/local.js` and `/version` work as today. `/vendor/*` and `/support.js` come from the package root. Everything else is served from `cwd`, with CORS `*` and `..` rejected.
  - Watch `docs/`, filtered by `/\.md$|\.card\.json$|deck\.json$/`. After a 300 ms settle, run `snapshot({force:false})` and bump `version`. (The `-W` mtime workaround goes: staleness compares mtimes in ms.)

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify by hand.** In an `acmeProject()` copy, run `node <repo>/bin/project.mjs dev`. Check three things:
  - `curl -s localhost:8000/ | grep -c 'window.PROJECT'` gives `0` (it is in `/project.js` instead).
  - `curl -s localhost:8000/local.js` lists 7 editor URLs.
  - Appending a decision to `docs/adr/decisions.md` bumps `curl localhost:8000/version` within ~1 s.

  Stop it, then kill any leftover editors by port **outside the sandbox**, since the sandbox hides them.
- [ ] **Step 3: Commit** `feat: project dev (local editors, live reload)`

### Task 6: Convert this repo to use its own package

**Files:**
- Modify: `package.json`, `Makefile`, `scripts/clone.sh`, `.github/workflows/pages.yml`, `README.md`, `Template.dc.html`, `index.html`
- Create: `docs/project.json`, `Main.dc.html` (redirect stub)
- Delete: `scripts/cards.ts`, `scripts/deck-card.ts`, `docs/cards.js`

**Interfaces:** consumes the CLI only (`node bin/project.mjs … --manifest ./manifest.json`).

- [ ] **Step 1: `package.json`:**
  - `"name": "@pritzlaff/project"`, `"version": "0.1.0"`, `"bin": { "project": "bin/project.mjs" }`.
  - `"files": ["bin","lib","dashboard","support.js","vendor"]`, `"engines": { "node": ">=22" }`.
  - `repository`, `homepage` and `license` as in `adr/package.json`, with `"publishConfig": { "access": "public" }`.
  - `"scripts": { "test": "node --test test/" }`. Keep the tool devDependencies.
- [ ] **Step 2: `docs/project.json`.** Run `node bin/project.mjs add all --manifest ./manifest.json`. The tools are already installed, so the install step is a no-op; this repo's existing empty area files are kept and `docs/cards/overview.mjs` appears.
- [ ] **Step 3: `Makefile`.** Set `P := node bin/project.mjs --manifest ./manifest.json` and add these targets:
  - `dev` → `$(P) dev`
  - `snapshot` → `$(P) snapshot`
  - `<area>` → `$(BIN)/<bin> <file>`, as now
  - `<area>-snapshot` → `$(P) snapshot --force`
  - `test` → `node --test test/`
  - `demo-build` → temp project from `examples/acme/docs` plus `docs/project.json` and `docs/cards`, then `$(P) build --out $(DEMO) --pages $(DEMO_PAGES)`
  - `demo` → `demo-build`, then `cd` into the temp project and `$(P) dev`
  - `clone` → `scripts/clone.sh`

  Delete the per-area `card.json` rules, `CARDS` and `node_modules` rules beyond `bun install`.
- [ ] **Step 4: `scripts/clone.sh`.** Keep the REPO, NAME and DEST prompts and checks. Replace the `git ls-files | tar` copy and the `perl` rewrites with these steps:
  - Create `$DEST` and write a minimal `package.json`: `{ "name": "<repo>", "private": true, "devDependencies": {} }`.
  - Copy README.md, stripping the template block and setting the name and Pages line, as now.
  - `git init`, then add the origin.
  - Run `npx -y @pritzlaff/project add all && npx project pages`, falling back to a message if it fails.
  - Print next steps.
- [ ] **Step 5: Pages workflow.** `.github/workflows/pages.yml` steps:
  - setup-bun (repo dev only); `bun install`
  - `node bin/project.mjs --manifest ./manifest.json build --out _site --pages https://<owner>.github.io/<repo>/`
  - `cp -R Template.dc.html index.html Main.dc.html manifest.json cards vendor support.js _site/`
  - the existing `if: hashFiles('examples/acme/docs/**')` demo step, now `make demo-build DEMO=_site/demo DEMO_PAGES=…/demo/`, then `cp Main.dc.html _site/demo/`
  - upload `_site`
- [ ] **Step 6: Redirects and links.** `Main.dc.html` becomes a meta-refresh to `dashboard.html`. In README.md and Template.dc.html, `Main.dc.html` links become `dashboard.html`. README sections:
  - "Using this template" also gets an "Adding to an existing repo" block: `npx @pritzlaff/project add adr risks`, `npx project build --out _site/project --pages …`, `npx project pages`.
  - "Running", "Cards" and "Adding an area" describe the CLI and the manifest (`card` field), replacing Makefile, `cards.ts` and `deck-card.ts`.

  The user's uncommitted README edits are kept: edit around them.
- [ ] **Step 7: Verify.**
  - `make test`: all pass.
  - `npm pack --dry-run`: lists only `bin/ lib/ dashboard/ support.js vendor/ package.json README.md`.
  - `make demo-build DEMO=temp/site DEMO_PAGES=https://aaronp.github.io/template/demo/`: then `temp/site/dashboard.html` opens with the 7 Acme cards.
  - `make dev`: the dashboard at :8000 shows this repo's empty areas, and `make adr` opens the editor.
- [ ] **Step 8: Commit** `refactor: the template is @pritzlaff/project and uses its own CLI`

Publishing `0.1.0` (`npm publish`) and pushing are left to the user; `make clone` needs the package on npm.
