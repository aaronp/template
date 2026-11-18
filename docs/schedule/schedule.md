# bun-app roadmap

## Foundations
- [x] Project skeleton `id:skeleton` `start:2026-11-02` `dur:2d`
- [ ] Persistence layer `id:db` `after:skeleton` `dur:5d` `tags:backend`

## Features
- [ ] HTTP API `id:api` `after:db` `dur:6d` `tags:backend`
- [ ] Web client `id:client` `with:api+2d` `dur:8d` `tags:web`

## Release
- [ ] Beta `id:beta` `after:api,client` `dur:0d`
