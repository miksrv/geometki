# Memory Index

## Project
- [project_architecture.md](./project_architecture.md) — Core stack (Next.js 16/Pages Router, React 19, RTK Query, Leaflet, next-i18next, SASS modules), file structure, and key patterns in the geometki client.
- [project_known_bugs.md](./project_known_bugs.md) — Five critical bugs identified in March 2026 audit (auth cookie, stale closures, broken regex, MapEvents effect).

## Testing
- `client/__mocks__/commonMocks.ts` — shared test store factory, renderWithStore helper, mockRouter, mockUseTranslation, and fixture data.
- `client/__mocks__/simple-react-ui-kit.tsx` — manual CJS mock for pure-ESM simple-react-ui-kit; mapped via moduleNameMapper in jest.config.ts.
- `identity-obj-proxy` and `@testing-library/dom` are required devDeps (not installed by default) — install if tests fail with "Cannot find module".
- **87 test files, 887 tests, all passing as of 2026-03-27.** Components in `layout/`, `shared/`, `ui/`, and `map/` all have co-located `.test.tsx` files.
- Inline store pattern (not commonMocks) required for components that import Redux slices directly — see project_architecture.md for the full mocking checklist.
- Map component tests: mock `react-leaflet`, `leaflet`, and context hooks (`useLeafletContext`, `useMapEvents`, `useMap`) — never use real Leaflet in jsdom.
