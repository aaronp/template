# React app example

A hello-world Vite + React + Tailwind + [shadcn/ui](https://ui.shadcn.com) app (one `Button`), as it looks after
adding the project tools. The app stays at the Pages root; the dashboard, `docs/` and TypeDoc API docs go under `/project/`.

| | URL |
|---|---|
| App | `https://<owner>.github.io/<repo>/` |
| Links page | `https://<owner>.github.io/<repo>/project/` |
| Dashboard | `https://<owner>.github.io/<repo>/project/dashboard.html` |
| API docs (TypeDoc) | `https://<owner>.github.io/<repo>/project/api/` |

The template repo publishes this example at [aaronp.github.io/template/react-app/](https://aaronp.github.io/template/react-app/)
(dashboard: [.../react-app/project/dashboard.html](https://aaronp.github.io/template/react-app/project/dashboard.html)).

## How it got here

Starting from the plain app (`package.json`, `vite.config.ts` with `base: './'`, `src/`, `components.json`,
`typedoc.json`, and a `Makefile` with `dev`, `build`, `site`):

```sh
bunx @pritzlaff/project add all   # installs the tools, writes docs/ and .project, appends the managed Makefile block
bunx project pages                # writes .github/workflows/pages.yml; package.json has a build script, so it
                                  # builds the app, then runs: npx project build --app dist --out _site
```

## Running

```sh
make dev              # the app, with Vite (http://localhost:5173)
make dashboard        # the dashboard with every area's editor (http://localhost:8000)
make adr              # one area's editor (likewise goals, risks, gantt, …)
make site             # what Pages publishes: the app in _site/, the project site in _site/project/
python3 -m http.server -d _site   # then http://localhost:8000/ and http://localhost:8000/project/
```

`typedoc.json` is what turns on the API docs; without it, `project/` holds just the dashboard and `docs/`.
In a repo of its own, `.github/workflows/pages.yml` here is the one that publishes it. In the template repo, the
root workflow builds it instead (`make react-app-build`), since GitHub only runs workflows at the repo root.
