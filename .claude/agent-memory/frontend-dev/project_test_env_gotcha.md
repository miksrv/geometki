---
name: project_test_env_gotcha
description: yarn jest fails almost every suite with "React.act is not a function" when the shell has NODE_ENV=production set — run tests with NODE_ENV=test.
type: project
---

If `cd client && yarn test` (or `yarn jest`) fails broadly with `TypeError: React.act is not a function`
across many unrelated suites (not just ones you touched), check `echo $NODE_ENV` first. Jest only
defaults `NODE_ENV` to `test` when it is unset; some sandboxed shells in this environment start
with `NODE_ENV=production` already exported, which makes React/ReactDOM load their production
builds (no `act` export) even under jsdom.

**Why:** discovered 2026-10-09 while implementing the client side of features/20-location-seo-pages.md
— a fresh `yarn install` plus `yarn jest` showed 675/1263 tests failing, including completely
untouched components (`CategoryIcon.test.tsx`). Re-running with `NODE_ENV=test yarn jest` made the
failures drop to only the ones actually caused by the change in progress.

**How to apply:** before concluding tests are broken or a change caused a regression, run
`NODE_ENV=test yarn jest` (or `cd client && NODE_ENV=test yarn test`) and compare. Don't chase this
as a code bug — it's a shell environment artifact, not something to fix in the repo.
