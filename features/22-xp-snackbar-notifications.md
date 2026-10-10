# Feature 22 — XP Snackbar & Notification Groups

> **Status: not started.** Today an `experience` notification from the 15-second poll is rendered by `components/layout/snackbar/Notification.tsx` as one toast per event ("+N XP" with a static `LevelProgress`); there is no grouping and no client-side optimistic XP.

## Overview

Make XP gains feel rewarding: show an animated level-progress bar when the user earns experience, and merge rapid XP events (e.g. uploading 10 photos) into one updating snack instead of 10 toasts.

## Group Slots

`app/notificationSlice.ts` gets a second lane next to `list`:

```
state.notification.list    — individual toasts (unchanged)
state.notification.groups  — named slots, updated in place within a merge window
```

A slot stays open for N seconds after its last event; a new event for the same group updates it and resets the auto-dismiss timer.

| Group | Merge | Source | Component |
|-------|-------|--------|-----------|
| `xp` | yes, 4 s | client (optimistic) + server poll | `GroupSnackItem` + `LevelProgressAnimated` |
| `achievement` | no, queued | server | future |
| others | — | — | existing `Notification` |

```typescript
type GroupSlot = {
    groupId: 'xp' | 'achievement'
    id: string
    actions: string[]       // labels of merged actions
    xpTotal: number
    fromExperience: number
    toExperience: number
    fromLevel: number
    toLevel: number
    toNextLevel: number
    mergeUntil: number
    read: boolean
}
```

Reducers `openGroupSlot` / `mergeGroupSlot` / `closeGroupSlot` and a thunk `NotifyXp({ action, xpGained, levelData })`: merge into `groups.xp` if it is open, otherwise open a new slot and schedule its close (~10 s).

## Components

- **`LevelProgressAnimated`** (`components/shared/level-progress-animated/`): renders at `fromExperience`, after ~300 ms transitions to `toExperience` (CSS `width 0.8s`). On level-up: fill to 100%, swap `LevelBadge` to the new level, reset to 0, animate to the new progress.
- **`GroupSnackItem`** (`components/layout/snackbar/`): level badge, last action label + "+N XP", "and N more actions", animated bar.
- **`Snackbar.tsx`**: render `groups` above `list`; route polled `experience` / `level` notifications through `NotifyXp`.

## Call Sites

Dispatch `NotifyXp` on mutation success in: `PhotoUploader`, `PlaceDescription`, `PlaceCoverEditor`, `PlaceForm` (new place), `WasHereButton`, `PlaceRatePrompt` (rating).

XP values are the `MODIFIER_*` constants in `server/app/Config/Constants.php`; they are not exposed to the client yet — return them from `GET /auth/me` (or a small endpoint) instead of hardcoding.

## Server Poll Deduplication

When the poll delivers an `experience` notification already shown optimistically:
- slot still open → same `toExperience`: skip; different (race): quiet merge with server values;
- slot closed → mark read without showing.

## Not Changed

`Notify` thunk and its call sites, the app-bar notification list, backend delivery, `ApiModel.Notification`.
