---
name: project-map-layers
description: Pattern for adding additional map layers (Pastvu, Wikimedia Commons) to the InteractiveMap component
metadata:
    type: project
---

Additional map layers follow a strict pattern. Use `historical-photos/` or `wikimedia-commons/` as reference implementations. Wikipedia layer also demonstrates the Popup variant (lazy getExtract → Leaflet Popup) vs the lightbox variant (lazy getImageInfo → onPhotoClick).

Each layer lives in `components/map/<layer-name>/` with:

- `constants.ts` — color constants and limits
- `utils.ts` — pure functions: `buildParams`, icon creator, data transformers
- `utils.test.ts` — unit tests with `jest.mock('leaflet', () => ({ divIcon: jest.fn().mockReturnValue({}) }))`
- `<ComponentName>.tsx` — React component using `useMapEvents` + `useEffect` for initial fetch
- `<ComponentName>.test.tsx` — component tests mocking `react-leaflet` and the API slice
- `styles.module.sass` — marker styles
- `index.ts` — barrel export

Integration checklist:

1. `api/apiXxx.ts` — RTK Query slice with `reducerPath: 'APIXxx'`
2. `components/map/types.ts` — add value to `MapAdditionalLayersEnum`
3. `layer-switcher-control/LayerSwitcherControl.tsx` — add to `titleAdditionalMapType` Record (must be exhaustive)
4. `InteractiveMap.tsx` — add conditional render alongside HistoricalPhotos
5. `app/store.ts` — import, add to `combinedReducer`, HYDRATE merge block, and middleware chain

**Why:** TypeScript Record<MapAdditionalLayersEnum, string> is exhaustive — adding an enum value without updating the Record causes a compile error.

**How to apply:** When adding any new additional layer, follow all 5 integration steps or the build will fail.
