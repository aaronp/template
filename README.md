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
[![Goals](docs/goals/badge.svg)](Main.dc.html) [![Architecture](docs/architecture/badge.svg)](Main.dc.html) [![Decisions](docs/adr/badge.svg)](Main.dc.html) [![Schedule](docs/schedule/badge.svg)](Main.dc.html) [![Delivery](docs/board/badge.svg)](Main.dc.html)

Dashboard: https://your-org.github.io/project-template/

## Running

```sh
make dev          # regenerates stale cards and badges, then serves on http://localhost:8000/
make snapshot     # just the cards and badges
make <area>          # edit the area's file in its tool's viewer on localhost (Save writes it back)
make <area>-snapshot # rebuild that area's card.json and badge.svg now, even if not stale
```

| Area | `make` target | File | Tool | Status |
| --- | --- | --- | --- | --- |
| Goals | `goals` | `docs/goals/x-matrix.md` | [`@pritzlaff/hoshin-kanri`](https://github.com/aaronp/Hoshin-Kanri) | migrated |
| Architecture | `c4` | `docs/architecture/c4.md` | [`@pritzlaff/c4`](https://github.com/aaronp/c4) | migrated |
| Decisions | `adr` | `docs/adr/decisions.md` | [`@pritzlaff/adr`](https://github.com/aaronp/adr) | migrated |
| Schedule | `gantt` | `docs/schedule/schedule.md` | [gantt](https://github.com/aaronp/gantt) (published as `@pritzlaff/agile@1.0.1`, aliased) | migrated |
| Delivery | `agile` | `docs/board/board.md` | [`@pritzlaff/agile`](https://github.com/aaronp/agile) `1.0.0` | migrated |
| Risks | — | — | [risk-register](https://github.com/aaronp/risk-register) | TODO: no npm package / card CLI yet |
| Interfaces | — | — | — | TODO: example figures on the dashboard |

## Cards

Each area keeps its source next to the code and snapshots it into a `card.json` (plus a `badge.svg`)
in the same folder, e.g. `docs/adr/decisions.md` → `docs/adr/card.json` via `adr card` from
[`@pritzlaff/adr`](https://github.com/aaronp/adr). `card.json` is a tool-neutral format (version 1:
title, status pill, big number, a legend with counts and links), so the dashboard styles every
area the same way. `make` only rebuilds a card when its source is newer.
`scripts/cards.ts` bundles every `docs/**/card.json` into `docs/cards.js` for `Main.dc.html`;
areas without a card show example figures.

Goals works the same way with `hoshin-kanri card`: its headline is the first section's count, with one
legend entry per section.

Card links open the hosted viewer with `?src=` pointing at the published markdown on this repo's
Pages site (worked out from the `origin` remote, or `make snapshot PAGES=https://…/`), so they work
once the repo is pushed and published. To change a card's titles, labels or colours, use
**File → Design card…** in the viewer (`make adr`) and save `decisions.card.json` beside the markdown.

## Adding an area

Have its tool write `<dir>/card.json` in the same format, add a Makefile rule for it (and list it
under `docs/cards.js`), then set `card: '<dir>/card.json'` on its entry in `Main.dc.html`.

## Hosting

Pushes to `main`/`master` publish the repo to GitHub Pages (`.github/workflows/pages.yml`, which
re-snapshots the cards first; Settings → Pages → Source: **GitHub Actions**).
