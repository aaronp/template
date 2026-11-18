# project-template

<!-- template:start -->
A template repository for keeping every project artifact (goals, architecture, decisions, risks,
interfaces, schedule, delivery) as plain Markdown and JSON next to the code, with a dashboard that
summarizes them.

- `Template.dc.html`: the page describing this template (served at `/` here).
- `Main.dc.html`: the project's own dashboard and walkthrough. This is what a new project gets.

## Using this template

Create an empty repo on GitHub, then:

```sh
make clone        # asks for owner/repo and a project name; or REPO=… NAME=… DEST=…
```

This copies the repo to `../<repo>` (tracked and new files only) and fills in the project's name,
GitHub links and Pages URL. It also removes the template-only parts: `Template.dc.html`,
`scripts/clone.sh`, the `clone` target and this section. The dashboard's footer links back to this
template, using this checkout's `origin` (or `TEMPLATE=<url>`).

<!-- template:end -->
![Decisions](docs/badges/adr.svg)

Dashboard: https://your-org.github.io/project-template/

## Running

```sh
make dev          # regenerates stale summaries, then serves on http://localhost:8000/
make summaries    # just the summaries and badges
make test         # bun test scripts
bun install && make adr   # open docs/adr/decisions.md in the ADR viewer locally
```

Each area's source file (e.g. `docs/adr/decisions.md`) is summarized by `scripts/summarize.ts` into
`docs/summaries/<area>.json` (and `docs/badges/<area>.svg`). `make` only reruns an area when its
source is newer than its summary. `docs/summaries.js` bundles them for `Main.dc.html`; cards with no
summary yet show example figures.

## Adding an area

Add a function to `AREAS` in `scripts/summarize.ts`, a rule in the `Makefile`, and
`summary: '<area>'` on its card in `Main.dc.html`.

## Hosting

Pushes to `main`/`master` publish the repo to GitHub Pages (`.github/workflows/pages.yml`;
Settings → Pages → Source: **GitHub Actions**).
