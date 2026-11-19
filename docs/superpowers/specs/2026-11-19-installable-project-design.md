# Installable project dashboard (`@pritzlaff/project`)

## Intent

Today this repo is a template: you clone it (`make clone`) and build on it. Each area's tool
(`@pritzlaff/adr`, `agile`, `c4`, `celldeck`, `gantt`, `hoshin-kanri`, `risk-register`) is already a
self-contained npm package you can `add` to any repo. The glue around them (snapshotting cards and
badges, the dashboard, local editing, GitHub Pages) is not: it lives in this repo's `Makefile`,
`index.ts`, `scripts/*.ts` and `Main.dc.html`, and assumes it owns the repo root.

Make the glue installable the same way, so an **existing** repo can pick the areas it wants and get
snapshots, a dashboard and (optionally) a Pages workflow, without cloning the template.

Three independently released components come out of it:

1. **The tools**, as now.
2. **The `project` CLI** (`@pritzlaff/project`, this repo): lists, installs, snapshots, builds, serves.
3. **The manifest** (`manifest.json`, published from this repo's Pages site): which tools exist and how
   to wire each one in. Adding, changing or removing a tool is a manifest edit, not a CLI release.

## Goals

- `npx @pritzlaff/project list` shows every tool in the manifest and which are installed here.
- `project add adr risks` in an existing repo installs those tools and wires them in by convention;
  `remove` and `update` undo and refresh that.
- `project snapshot` rebuilds `card.json` (+ `badge.svg` where there is one) for every installed area.
- `project build --out <dir>` writes one self-contained `dashboard.html` plus the area sources beside it,
  so a repo whose Pages site is already built by an Actions workflow can add one step to publish it.
- `project dev` gives today's `make dev`: local editors, Save writes to the checkout, live reload.
- `project pages` writes a Pages workflow for repos that don't have one.
- Snapshot, build and dev work offline and give the same result every run: only `list`, `add` and
  `update` read the network.
- This template repo becomes the package and uses its own CLI, so clone and install can't drift.

## Non-goals

- Jekyll-built Pages sites (Jekyll renders `.md` to HTML, breaking the raw `?src=` links). All target
  sites are built by Actions.
- Customising the dashboard's layout from the host repo (forks can). Its per-area wording *can* be
  changed by editing the recorded entry in `docs/project.json`.
- The placeholder Interfaces area (no tool yet). It is dropped until a tool exists; adding one later is
  a manifest entry.

## Anti-goals

- Requiring `make` or `bun` in the host repo. The CLI and card scripts are plain Node (≥ 22), like every
  tool's `bin/*.mjs`.
- Touching anything in the host repo it didn't create: never overwrite an existing area file, workflow
  or `package.json` script; `remove` never deletes area data.
- Running code fetched from a URL at build time. Remote card scripts are copied into the repo by `add`
  and `update`, where they are reviewed and committed like any other code.
- Bundling the tools into the package. The host owns the tool versions (and so the matching
  `node_modules/@pritzlaff/<tool>/spec.md` an agent reads).

## The manifest

`manifest.json` at this repo's root, published at `https://aaronp.github.io/template/manifest.json`
(the CLI's default; `--manifest <url|path>` overrides, e.g. a local path while developing). Shape:

```json
{
  "version": 1,
  "tools": [
    {
      "id": "decisions",
      "aliases": ["adr"],
      "name": "Decisions",
      "tool": "ADR log",
      "package": "@pritzlaff/adr",
      "bin": "adr",
      "file": "docs/adr/decisions.md",
      "srcEnv": "ADR_SRC",
      "homepage": "https://github.com/aaronp/adr",
      "spec": "https://aaronp.github.io/adr/spec.md",
      "viewer": "https://aaronp.github.io/adr/",
      "dashboard": { "tint": "#E6DCFF", "question": "Do you know why it’s built this way?",
                     "noLead": "Record each decision with its options and the trade-off you chose." }
    }
  ]
}
```

Array order is the walkthrough order. Today's seven areas (the table in README.md and the `AREAS`
array in `Main.dc.html`) become the first seven entries. `id` or any alias is accepted by `add`,
`remove` and `update` (today's `make` target names are the aliases), plus `all`.

### Cards: one contract, three ways to meet it

A card generator is run with the area file as its argument and `SRC=<published URL of the file>` in the
environment (the tool's `srcEnv` name for tool commands), and writes `card.json` beside the file, plus
`badge.svg` if it has one. That is what the tools' `card`/`badge` commands do today. An entry's
optional `card` field picks how:

| `card` | Runs | Today |
| --- | --- | --- |
| omitted (default) | `<bin> card <file>` then `<bin> badge <file>` | adr, c4, gantt, agile, risk-register, hoshin-kanri |
| `{ "script": "cards/celldeck.mjs" }` | `node docs/cards/<id>.mjs <file>`: the script is hosted next to `manifest.json` (path relative to it) and copied into the host by `add`/`update` | celldeck (today's `scripts/deck-card.ts`, ported to plain Node) |
| `false` | nothing; the dashboard shows a basic card: name, tool, the file's last-changed date from `git log`, a link to open it in `viewer` with `?src=` | any tool with no summary yet |

If celldeck gains its own `card` command, its entry drops the `card` field: no CLI release.

## The host's record: `docs/project.json`

`add` copies each tool's manifest entry (as fetched, plus the `version` of the manifest it came from)
into `docs/project.json`, keyed by id in walkthrough order. This file is the only thing `snapshot`,
`build` and `dev` read to know what's installed and how to wire it, which is what makes them offline
and repeatable. It is committed. Hosts may edit an entry's `dashboard` wording; `update` overwrites
entries from the manifest, so it prints the diff of each entry it changes.

- **Installed** = has an entry in `docs/project.json`. A file at a conventional path with no entry
  (say a host's own `docs/adr/decisions.md`) is ignored. An entry whose file is missing is skipped
  with a warning; one whose bin can't be found fails with "run your package manager's install".
- **Finding a tool's bin**: the host's `node_modules/.bin/<bin>` first; failing that, resolve the package
  from the CLI's own location. That fallback lets `make demo` and the smoke test run in temp dirs with
  no `node_modules`, using this repo's installed tools, with no network.

## Commands

All that link to published files take `--pages <url>`; it defaults to the `origin` remote's Pages URL,
worked out as the Makefile's `PAGES` does today (`owner.github.io/repo/`, or the bare
`owner.github.io/` repo).

- **`project list`**: fetches the manifest; prints id, name, package and installed version (from
  `docs/project.json` and `node_modules`), marking ones installed here and ones whose recorded entry
  differs from the manifest.
- **`project add <tool…|all>`**: for each: installs the package as a dev dependency with the repo's
  package manager (`bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm; also adds
  `@pritzlaff/project` itself if missing), records the entry in `docs/project.json`, copies its card
  script if any, creates the area file empty if absent, then runs `snapshot`. Prints what it did and
  the next commands.
- **`project remove <tool…>`**: uninstalls the package, removes its entry and card script and its
  generated `card.json`/`badge.svg`. Leaves the area file alone and says so.
- **`project update [tool…]`**: refreshes the recorded entries and card scripts from the manifest
  (all installed ones by default) and upgrades the packages to latest, then snapshots.
- **`project snapshot [--force]`**: for each installed area, runs its card generator when the file (or
  its `<name>.card.json` design sidecar, or its card script) is newer than `card.json`, or always with
  `--force`. Cards and badges are committed (README badges point at them).
- **`project build [--out _site] [--pages <url>]`**: `snapshot --force`, then writes
  `<out>/dashboard.html` and copies every installed area's file, card and badge to the same relative
  path under `<out>`. `--pages` must be the URL `<out>` is served at, so cards' `?src=<pages>docs/…`
  resolve. `dashboard.html` inlines React, `support.js`, the installed entries, the cards and the
  project info, and opens from `file://` too. It also writes `<out>/index.html` redirecting to
  `dashboard.html`, only if none exists.
- **`project dev [--port 8000]`**: today's `index.ts` on `node:http`: snapshot, start each installed
  area's editor (`<bin> <file>`) on PORT+1…, serve the dashboard at `/` with `local.js` mapping files to
  editors, watch `docs/` and re-snapshot + reload on save. Editors run in their own process groups and
  are killed as a group.
- **`project pages`**: writes `.github/workflows/pages.yml` (checkout, setup-node, install,
  `npx project build --out _site`, upload, deploy) if no file of that name exists. If one does, prints
  the `project build` step to add to it instead.

Project info shown on the dashboard: name from `--name`, else `package.json` `displayName`, else its `name`, repo
from `origin`, footer "Made with" link to this repo.

## This repo after the change

- `package.json` becomes `@pritzlaff/project` with `bin: { project: "bin/project.mjs" }` and a `files`
  list of just the CLI, the dashboard source, `support.js` and `vendor/`. It keeps the tools as dev
  dependencies (for its own docs and the demo).
- `manifest.json` and `cards/celldeck.mjs` at the root, published by Pages, not in the npm `files`.
- The dashboard source moves from `Main.dc.html` into the package (e.g. `dashboard/dashboard.html`),
  with the area list injected from `docs/project.json` instead of hardcoded.
- This repo's own `docs/project.json` lists all seven tools (it dogfoods the install).
- `Makefile` shrinks to thin wrappers: `make dev` → `node bin/project.mjs dev`, `make snapshot`, `make
  <area>` → run that tool on its file, plus the template-only `clone`, `demo`, `test`. Inside this repo,
  every flow (Makefile, demo, test, CI) runs this checkout's `bin/project.mjs` with `--manifest
  ./manifest.json`, never the npm copy or the published manifest.
- `index.ts`, `scripts/cards.ts`, `scripts/deck-card.ts` and `docs/cards.js` go (absorbed by the CLI and
  `cards/celldeck.mjs`).
- `make clone` becomes: new dir, minimal `package.json` + README, `git init`, `project add all`,
  `project pages`. A clone is an install into an empty repo. It writes `@pritzlaff/project` at the
  published version, so `0.1.0` must be on npm first.
- `make test` becomes the smoke test below. The old clone-into-`temp/test`-and-serve flow is dropped;
  `make demo` already builds and serves a full clone.
- `make demo` / `demo-build`: copy `examples/acme/docs` and this repo's `docs/project.json` into a temp
  project and `project build` it; Pages publishes it at `/demo/` as now.
- This repo's Pages workflow runs `project build --out _site`, then adds `Template.dc.html`,
  `index.html`, `manifest.json`, `cards/` and the demo. README and `Template.dc.html` links to
  `Main.dc.html` become `dashboard.html`. The site keeps `Main.dc.html` and `demo/Main.dc.html`
  redirect stubs so shared links still work.
- Publishing is by hand (`npm publish`), as for the tool modules (none has a release workflow);
  `npm pack --dry-run` checks the `files` list first. Manifest changes publish with a push.

## Approaches considered

Packaging:

- **This repo becomes the package (chosen).** One repo; the template dogfoods the install path, and
  its Pages site is a live test of it. Cost: the repo is both template and package, so the `files`
  list and `make clone` must keep template-only parts out.
- **A new `aaronp/project` repo, laid out like adr/c4.** Two repos to release in step, and the template
  would be left as little more than `package.json` + `docs/`.
- **Ship a `project.mk` to `include`.** Dropped: needs make and bun in the host; clashes with existing
  Makefiles.
- **Copy the dashboard into the repo (shadcn-style).** Dropped: upgrades become merges; the dependency
  route keeps "data, not software" true for the host.

Where snapshot/build/dev read tool details from:

- **Recorded copy in `docs/project.json` (chosen).** Offline, repeatable CI; installed areas explicit
  in one file; hosts can reword dashboard copy. Cost: one file in the host (reversing an earlier
  "no config file" call).
- **Fetch the manifest every run.** No host file, changes live instantly, but every CI build needs the
  network and a manifest edit can break builds in repos that changed nothing.
- **Tools self-describe in their own `package.json`.** Offline with no host file, but needs a field in
  all seven tool repos and puts this dashboard's copy in the tools.

## Testing

One `node --test` smoke test: copy `examples/acme/docs` and `docs/project.json` into a temp dir, run
`build` with this repo's installed tools, assert `dashboard.html` exists and contains every area's card
(including celldeck's, from the card script), and each source is copied under `<out>/docs/…`. A second
case marks one entry `"card": false` and asserts the basic card. Network steps (`list`, `add`,
`update`'s fetch and install) are not tested.

## Left to the builder

- Exact dashboard source layout inside the package, and how data is injected (a `<script>` block
  replaced at build, served as `/project.js` in dev); `dev` and `build` should share one renderer.
- Wording of CLI output and help; `list`'s output format.
- Whether `docs/project.json` stores the manifest `version` once or per entry.
