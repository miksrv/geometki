# Geometki Mobile — Development Roadmap

> **Document version:** 1.0
> **Date:** 2026-03-24
> **Status:** Active planning document — update as decisions are made

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Current State Audit](#4-current-state-audit)
5. [Phase 0 — Foundation & Upgrade](#phase-0--foundation--upgrade)
6. [Phase 1 — Authentication & User Profile](#phase-1--authentication--user-profile)
7. [Phase 2 — Places, Map & Photo Upload](#phase-2--places-map--photo-upload)
8. [Phase 3 — Route Recording & Background Tracking](#phase-3--route-recording--background-tracking)
9. [Phase 4 — Gamification Layer](#phase-4--gamification-layer)
10. [Phase 5 — Social Features](#phase-5--social-features)
11. [Phase 6 — Advanced Platform Features](#phase-6--advanced-platform-features)
12. [Phase 7 — Polish, Performance & Accessibility](#phase-7--polish-performance--accessibility)
13. [App Store Publishing Plan](#app-store-publishing-plan)
14. [Dependency Reference](#dependency-reference)

---

## 1. Vision & Goals

The Geometki mobile app is the primary interface for active users — people who are physically moving through the world, discovering points of interest, recording routes, and contributing location data. The web client handles discovery and curation; the mobile client handles **field work**.

### Core capabilities required

| Capability | Priority | Notes |
|---|---|---|
| Browse & discover POIs on an interactive map | P0 | Already partially implemented |
| Capture and upload photos from the field | P0 | Not yet implemented |
| Record waypoints during a trip | P0 | Not yet implemented |
| Measure distance traveled and steps taken | P0 | Must run in the background |
| Create new places while on-site | P1 | Not yet implemented |
| Full authentication and user account management | P0 | Currently stubs |
| Gamification: streaks, badges, challenges, XP | P1 | Not yet implemented |
| Ghost place capture via GPS | P1 | Server-side planned |
| Offline-capable core flows | P2 | Graceful degradation |

---

## 2. Technology Stack

### 2.1 Framework: React Native with Expo (Managed Workflow + EAS)

**Decision: Stay with React Native / Expo and upgrade to the latest SDK.**

React Native is the correct choice for this project. The key question is whether to use Expo Managed, Expo Bare, or vanilla React Native. The recommendation is **Expo Managed Workflow with Expo Application Services (EAS)** for the following reasons:

- All required native capabilities (background location, pedometer, camera, push notifications) are fully supported in the current Expo SDK via first-party packages — no ejecting required.
- EAS Build provides CI/CD pipelines for both iOS and Android without maintaining a local Xcode/Gradle environment.
- EAS Submit automates App Store and Play Store submission.
- The existing codebase is already Expo-based; upgrading is significantly less work than a full migration.
- If a native module arises that Expo does not support, Expo's **config plugins** allow adding native code without fully ejecting.

**Upgrade path:** Current SDK is ~47 (EOL). Target SDK is **~52** (latest stable at time of writing). This is a multi-step upgrade (47→48→49→50→51→52) but tooling exists (`npx expo-doctor` and changelogs per version) to guide it.

### 2.2 Full Stack Decision

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native | 0.76+ (bundled with Expo 52) |
| Expo SDK | Expo | ~52.0 |
| Language | TypeScript | 5.x (strict mode) |
| Build & CI | EAS Build | latest |
| Submit | EAS Submit | latest |
| OTA Updates | EAS Update | latest |
| Navigation | React Navigation | v7 |
| State management | Redux Toolkit + RTK Query | latest |
| Secure storage | expo-secure-store | ~14.x |
| Maps | react-native-maps | ~1.18 |
| Location | expo-location | ~18.x |
| Background tasks | expo-task-manager | ~12.x |
| Background location | expo-location (background mode) | ~18.x |
| Step counter | expo-sensors (Pedometer API) | ~14.x |
| Camera | expo-camera | ~16.x |
| Image picker | expo-image-picker | ~16.x |
| Image manipulation | expo-image-manipulator | ~13.x |
| File system | expo-file-system | ~18.x |
| Push notifications | expo-notifications | ~0.29.x |
| Local notifications | expo-notifications | (same package) |
| Haptics | expo-haptics | ~14.x |
| UI components | React Native Paper | v5 |
| Icons | @expo/vector-icons | (bundled) |
| Animations | react-native-reanimated | ~3.x |
| Gestures | react-native-gesture-handler | ~2.20 |
| Map clustering | react-native-map-clustering | ~3.4 |
| Offline persistence | redux-persist + AsyncStorage | latest |
| Date utilities | date-fns | v3 |
| Form handling | react-hook-form | v7 |
| Form validation | zod | v3 |
| Linting | ESLint + eslint-config-expo | latest |
| Formatting | Prettier | 3.x |
| Testing | Jest + @testing-library/react-native | latest |

### 2.3 Why This Stack Covers All Required Features

**Photo uploading:**
- `expo-camera` for in-app camera with full control over capture settings (flash, front/rear, quality).
- `expo-image-picker` for selecting from the device photo library (with multi-select support).
- `expo-image-manipulator` to resize and compress images before upload (reduces bandwidth and server load).
- `expo-file-system` to buffer files locally and retry failed uploads.
- Upload flow: compress → multipart POST to `/photos` API → attach to place entity.

**Waypoint capture:**
- `expo-location` with foreground tracking during an active trip session.
- Waypoints stored locally via Redux Persist (in case of connectivity loss), then synced to server on trip completion.
- Each waypoint includes: latitude, longitude, altitude (if available), accuracy, timestamp.

**Background distance & step tracking:**
- `expo-task-manager` defines a named background task (`GEOMETKI_LOCATION_TASK`).
- `expo-location` with `startLocationUpdatesAsync()` and `accuracy: High` registers the background task. On iOS this requires the `location` background mode in `app.json`. On Android it requires a foreground service notification.
- `expo-sensors` Pedometer API (`Pedometer.watchStepCount()`) tracks steps in real time during foreground. On iOS, HealthKit provides step data; on Android, the hardware step sensor is used.
- Background step counting is platform-constrained: iOS only delivers step data reliably in the foreground unless HealthKit is queried retrospectively. The recommended pattern is: foreground step watch while screen is active + query the device health store for cumulative step delta when the app returns to foreground.
- Distance is calculated from the sequence of GPS coordinates using the Haversine formula, accumulated per trip.

---

## 3. Architecture Overview

```
mobile/
├── app.json                    # Expo config (permissions, plugins, splash, icons)
├── eas.json                    # EAS Build profiles (development, preview, production)
├── babel.config.js
├── tsconfig.json
├── .env                        # Environment variables (not committed)
├── assets/
│   ├── fonts/
│   ├── icons/                  # App icons at all required sizes
│   └── images/
├── src/
│   ├── api/
│   │   ├── client.ts           # fetchBaseQuery base config with auth header injection
│   │   ├── store.ts            # Redux store + redux-persist config
│   │   ├── authSlice.ts        # Auth state (token, user, isAuthenticated)
│   │   ├── trackingSlice.ts    # Active trip state (waypoints, steps, distance)
│   │   └── endpoints/
│   │       ├── placesApi.ts    # RTK Query: places CRUD
│   │       ├── photosApi.ts    # RTK Query: photo upload/attach
│   │       ├── userApi.ts      # RTK Query: user profile, settings
│   │       ├── activityApi.ts  # RTK Query: streaks, challenges, XP
│   │       ├── tripsApi.ts     # RTK Query: trip recording sync
│   │       └── ghostApi.ts     # RTK Query: ghost place endpoints
│   ├── navigation/
│   │   ├── RootNavigator.tsx   # Auth gate: unauthenticated vs authenticated stacks
│   │   ├── AuthStack.tsx       # Login, Registration, ForgotPassword
│   │   ├── AppTabs.tsx         # Bottom tab navigator (Map, Explore, Record, Profile)
│   │   └── types.ts            # Navigation param types
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegistrationScreen.tsx
│   │   ├── map/
│   │   │   ├── MapScreen.tsx
│   │   │   └── PlacePreviewSheet.tsx  # Bottom sheet on marker tap
│   │   ├── explore/
│   │   │   ├── ExploreScreen.tsx      # Filterable list of places
│   │   │   └── PlaceDetailScreen.tsx
│   │   ├── create/
│   │   │   ├── CreatePlaceScreen.tsx
│   │   │   └── PhotoCaptureScreen.tsx
│   │   ├── record/
│   │   │   ├── RecordScreen.tsx       # Trip recording dashboard
│   │   │   └── TripSummaryScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── AchievementsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── notifications/
│   │       └── NotificationsScreen.tsx
│   ├── components/
│   │   ├── common/             # Buttons, inputs, cards, loaders
│   │   ├── map/                # MapView wrapper, markers, clusters
│   │   ├── photo/              # PhotoPicker, PhotoGrid, UploadProgress
│   │   ├── tracking/           # StepCounter, DistanceMeter, WaypointDot
│   │   └── gamification/       # StreakBadge, XPBar, AchievementCard
│   ├── hooks/
│   │   ├── useLocation.ts      # Foreground location with permission handling
│   │   ├── useBackgroundTracking.ts  # Start/stop background location task
│   │   ├── usePedometer.ts     # Step counting with platform handling
│   │   ├── usePhotoUpload.ts   # Pick/capture → compress → upload pipeline
│   │   └── useAuth.ts          # Token injection, refresh, logout
│   ├── tasks/
│   │   └── backgroundLocation.ts  # expo-task-manager task definition
│   ├── lib/
│   │   ├── haversine.ts        # Distance between two GPS coordinates
│   │   ├── compress.ts         # Image compression helpers
│   │   └── storage.ts          # expo-secure-store wrappers for tokens
│   └── constants/
│       ├── api.ts
│       ├── map.ts
│       └── tracking.ts
```

### Navigation structure

```
RootNavigator
├── AuthStack (when not authenticated)
│   ├── LoginScreen
│   └── RegistrationScreen
└── AppTabs (when authenticated)
    ├── Tab: Map
    │   └── MapScreen
    │       └── modal: PlacePreviewSheet
    ├── Tab: Explore
    │   ├── ExploreScreen
    │   └── PlaceDetailScreen
    │       └── modal: PhotoCaptureScreen
    ├── Tab: Record  (route/trip recording)
    │   ├── RecordScreen
    │   └── TripSummaryScreen
    └── Tab: Profile
        ├── ProfileScreen
        ├── AchievementsScreen
        ├── NotificationsScreen
        └── SettingsScreen
```

### State management

- **Server state:** RTK Query handles all API calls, caching, and invalidation.
- **Auth state:** `authSlice` holds JWT token (persisted to `expo-secure-store`), user object, and auth status.
- **Trip state:** `trackingSlice` holds the active trip's waypoints array, current distance, current step count, and recording status. This slice is NOT persisted via redux-persist across app restarts (a trip ends if the app is killed).
- **Offline state:** `redux-persist` persists the RTK Query cache to `AsyncStorage` so the places list is readable without connectivity.

---

## 4. Current State Audit

| Item | Status | Action |
|---|---|---|
| Expo SDK | ~47 (EOL) | Upgrade to ~52 |
| React Native | 0.70.5 | Upgrade to 0.76+ via Expo upgrade |
| Navigation | v6 Drawer only | Migrate to Tab + Stack + Drawer |
| API base URL | Hardcoded | Move to env variable |
| Authentication | Stub screens | Implement fully |
| Map screen | Working (basic) | Enhance, refactor |
| List screen | Stub | Implement |
| Profile screen | Stub | Implement |
| Login/Registration | Stubs | Implement |
| RTK Query | Working (2 endpoints) | Extend |
| TypeScript | Configured | Already in strict mode |
| EAS Build | Not configured | Add `eas.json` |
| Tests | None | Add Jest setup |

---

## Phase 0 — Foundation & Upgrade

**Goal:** Stable, modern foundation before any feature work begins.

### 0.1 Upgrade Expo SDK

```bash
# Step through each major version
npx expo install expo@48 && npx expo-doctor
npx expo install expo@49 && npx expo-doctor
npx expo install expo@50 && npx expo-doctor
npx expo install expo@51 && npx expo-doctor
npx expo install expo@52 && npx expo-doctor
```

Each step: install, run `expo-doctor`, fix any breaking changes per the official migration guide before proceeding to the next version. Do not skip versions.

### 0.2 EAS Configuration

Create `eas.json`:

```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 0.3 app.json permissions and plugins

Update `app.json` to declare all required permissions up front. iOS requires justification strings for every permission requested:

```json
{
  "expo": {
    "name": "Geometki",
    "slug": "geometki",
    "version": "2.0.0",
    "scheme": "geometki",
    "ios": {
      "bundleIdentifier": "pro.miksoft.geometki",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Geometki uses your location to show nearby places and pin new discoveries.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Geometki tracks your route in the background while you record a trip.",
        "NSLocationAlwaysUsageDescription": "Geometki tracks your route in the background while you record a trip.",
        "NSMotionUsageDescription": "Geometki counts your steps during route recording.",
        "NSCameraUsageDescription": "Geometki uses the camera to photograph places you discover.",
        "NSPhotoLibraryUsageDescription": "Geometki accesses your photo library so you can attach photos to places.",
        "NSPhotoLibraryAddUsageDescription": "Geometki saves photos you take in-app to your library.",
        "UIBackgroundModes": ["location", "fetch"]
      }
    },
    "android": {
      "package": "pro.miksoft.geometki",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "ACTIVITY_RECOGNITION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      "expo-location",
      "expo-camera",
      "expo-image-picker",
      ["expo-notifications", { "icon": "./assets/notification-icon.png" }]
    ]
  }
}
```

### 0.4 Project restructure

Reorganize the existing flat structure into `src/` as outlined in Section 3. Move existing working code (MapScreen, API files, store) to their new locations and update all imports.

### 0.5 Development client build

```bash
eas build --profile development --platform ios
```

Install the development client on a physical device (or simulator) and verify the existing map functionality works before proceeding to feature phases.

### 0.6 CI setup

Add a GitHub Actions workflow (`.github/workflows/mobile.yml`) that runs on every PR targeting `main`:
1. `npm install`
2. `npx expo-doctor` — checks for dependency mismatches
3. `npx tsc --noEmit` — TypeScript check
4. `npx eslint src/` — lint check
5. `npx jest` — unit tests

**Estimated effort:** 1–2 weeks

---

## Phase 1 — Authentication & User Profile

**Goal:** Fully functional auth flow with JWT, secure token storage, and profile screen.

### 1.1 Auth slice and token management

- `authSlice.ts` stores: `token: string | null`, `user: IUser | null`, `isAuthenticated: boolean`.
- On app launch, attempt to load token from `expo-secure-store`. If found, fetch `/users/me` to validate and hydrate user object. If the fetch fails (expired/invalid token), clear storage and go to login.
- On logout, clear `expo-secure-store` and reset auth slice.

```typescript
// src/lib/storage.ts
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'geometki_auth_token'

export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token)
export const loadToken = () => SecureStore.getItemAsync(TOKEN_KEY)
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN_KEY)
```

- RTK Query `baseQuery` reads the token from the Redux store and injects `Authorization: Bearer <token>` on every request.

### 1.2 Login screen

- Email + password form using `react-hook-form` + `zod` validation.
- Calls `POST /auth/login` via RTK Query mutation.
- On success: stores token, dispatches `authSlice.login(user)`, navigates to `AppTabs`.
- On failure: displays server error message below the form.
- Keyboard-aware scroll view so the form is not obscured by the soft keyboard.

### 1.3 Registration screen

- Name, email, password, confirm-password fields.
- Calls `POST /auth/register`.
- On success: auto-login (store token, navigate to tabs).

### 1.4 Profile screen

- Avatar image (tappable to upload a new photo via `expo-image-picker`).
- Display name, registration date, level, XP.
- Stats row: places created, photos uploaded, trips recorded.
- `SettingsScreen` accessible from profile (logout, notifications, account deletion).

### 1.5 RootNavigator auth gate

```typescript
// src/navigation/RootNavigator.tsx
const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated)

return isAuthenticated ? <AppTabs /> : <AuthStack />
```

**Estimated effort:** 1 week

---

## Phase 2 — Places, Map & Photo Upload

**Goal:** Complete CRUD for places; convenient in-field photo capture and upload.

### 2.1 Map screen enhancements

- Upgrade `react-native-maps` and clustering library to latest versions compatible with SDK 52.
- Bottom sheet (`@gorhom/bottom-sheet`) on marker tap showing place preview: cover photo, name, category, distance from user, rating.
- "Open full detail" button navigates to `PlaceDetailScreen`.
- "Add place here" FAB (floating action button) centered on current map position triggers `CreatePlaceScreen`.
- Layer toggle button to switch between standard map, satellite, and ghost-places overlay.

### 2.2 Explore (list) screen

- Paginated list of places fetching from `/places` with RTK Query infinite scroll.
- Filter chips: by category, by distance radius, by rating.
- Search bar with debounced query.
- Each card shows: cover photo, name, category chip, distance, star rating.
- Pull-to-refresh.

### 2.3 Place detail screen

- Full detail view: all photos in a horizontal scroll, name, category, description, coordinates, ratings.
- Photo gallery with lightbox on tap.
- "Rate this place" stars widget.
- "Add photo" button → photo upload flow.
- Map thumbnail showing pin location.

### 2.4 Create place screen

- Location is pre-filled from current GPS position (user can adjust by dragging a pin on a mini-map).
- Name, category picker, description fields.
- Photo attachment (required at least one for submission, optional for draft).
- Validation with `zod`: name required, category required.
- Submits to `POST /places` then navigates to the new place detail page.

### 2.5 Photo capture and upload pipeline

This is a core field capability and must be seamless:

```
User taps "Add photo"
    ↓
ActionSheet: [Take photo] [Choose from library]
    ↓
expo-camera (full-screen) OR expo-image-picker (library)
    ↓
expo-image-manipulator: resize to max 2048px, quality 0.85, format JPEG
    ↓
Show preview with [Retake] [Use this photo] options
    ↓
Upload: multipart POST /photos (temp upload)
    ↓
On success: attach photo ID to place (POST /places/{id}/photos)
    ↓
Show upload progress bar; retry on failure with exponential backoff
```

**`usePhotoUpload` hook** encapsulates this pipeline. It exposes: `pickFromLibrary()`, `takePhoto()`, `uploadProgress: number`, `isUploading: boolean`, `error: string | null`.

Multiple photo support: allow queuing up to 10 photos per place. Upload in parallel (Promise.all) with individual progress indicators.

**Estimated effort:** 2–3 weeks

---

## Phase 3 — Route Recording & Background Tracking

**Goal:** Record trips with GPS waypoints, measure distance and steps, running reliably in the background.

### 3.1 Background location task

Define the task once at module load time — this must be at the top level of the app, not inside a component:

```typescript
// src/tasks/backgroundLocation.ts
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import { store } from '../api/store'
import { addWaypoint } from '../api/trackingSlice'

export const LOCATION_TASK_NAME = 'GEOMETKI_BACKGROUND_LOCATION'

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation]', error)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    locations.forEach(loc => {
      store.dispatch(addWaypoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude ?? undefined,
        accuracy: loc.coords.accuracy ?? undefined,
        timestamp: loc.timestamp,
      }))
    })
  }
})
```

This file must be imported in `App.tsx` (or the root entry file) so the task is registered before any navigation renders.

### 3.2 Requesting background location permission

```typescript
// src/hooks/useBackgroundTracking.ts
const { status: foreground } = await Location.requestForegroundPermissionsAsync()
if (foreground !== 'granted') { /* show explanation, return */ }

const { status: background } = await Location.requestBackgroundPermissionsAsync()
// On iOS, this shows the "Always Allow" prompt — only shown once by the OS.
// On Android 10+, it directs the user to Settings; handle both cases.
```

Show a clear, friendly explanation screen *before* requesting "Always" location — iOS will only show the system prompt once, and users who deny it must go to Settings manually.

### 3.3 Starting and stopping a trip

```typescript
// Start
await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: Location.Accuracy.High,         // best GPS accuracy
  distanceInterval: 5,                       // update every 5 meters moved
  timeInterval: 10_000,                      // or every 10 seconds
  showsBackgroundLocationIndicator: true,    // iOS blue bar — required
  foregroundService: {                       // Android foreground service
    notificationTitle: 'Geometki — Recording trip',
    notificationBody: 'Tap to return to the app',
    notificationColor: '#aa18ea',
  },
  pausesUpdatesAutomatically: false,
})

// Stop
await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
```

### 3.4 Distance calculation

Use the Haversine formula on each pair of consecutive waypoints:

```typescript
// src/lib/haversine.ts
export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

Apply GPS accuracy filtering: discard waypoints where `accuracy > 20` meters to avoid GPS drift inflating the distance. Accumulate distance in `trackingSlice` as each waypoint arrives.

### 3.5 Step counting

```typescript
// src/hooks/usePedometer.ts
import { Pedometer } from 'expo-sensors'

// Check availability (some Android devices lack hardware step sensor)
const available = await Pedometer.isAvailableAsync()

// Watch steps in real time (foreground only)
const subscription = Pedometer.watchStepCount(result => {
  dispatch(setSteps(result.steps))
})

// On iOS: also query HealthKit for the trip's time range on trip end
// to backfill steps while app was backgrounded
const { steps } = await Pedometer.getStepCountAsync(tripStartDate, tripEndDate)
```

**Platform notes:**
- **iOS:** `watchStepCount` only fires in the foreground. When the app is backgrounded, steps are delivered via HealthKit. Query `getStepCountAsync(start, end)` when the app returns to foreground to fill the gap.
- **Android:** The hardware step sensor can continue counting while the app is in the background if the foreground service (started with the location task) holds a wake lock. Test on real hardware; emulators do not support the step sensor.

### 3.6 Record screen UI

The Record screen shows a live dashboard during an active trip:

- Large distance counter (km, 2 decimal places).
- Step counter with cadence indicator.
- Duration timer (HH:MM:SS).
- Waypoints captured count.
- Mini-map showing the route traced so far (polyline from waypoints array).
- [START / STOP] toggle button with haptic feedback on state change.
- Warning banner if GPS accuracy degrades below 20m.

### 3.7 Trip summary and sync

On trip end:

1. Stop location updates.
2. Calculate final distance, duration, avg speed, step count.
3. Show `TripSummaryScreen`: route on full map, stats, option to add a name/note.
4. Sync to server via `POST /trips`: `{ waypoints, distance_m, steps, duration_s, started_at, ended_at, name? }`.
5. Award XP locally (optimistic), confirm from server response.

**Estimated effort:** 2–3 weeks

---

## Phase 4 — Gamification Layer

**Goal:** Surface the platform's engagement mechanics on mobile.

### 4.1 XP and level display

- Persistent XP bar at the top of the Profile screen.
- Level badge on the user avatar throughout the app.
- XP animation: when XP is gained, show a floating `+N XP` toast with a brief animation.

### 4.2 Activity streaks

- `GET /users/me/streak` returns `{ current_streak, longest_streak, multiplier }`.
- Streak flame icon in the top-right of the header showing current streak count.
- Tap the flame to see a 90-day activity heatmap (grid of colored squares, GitHub contribution style).
- On first open each day, show a toast if the streak was extended.

### 4.3 Achievements and badges

- `AchievementsScreen` accessible from Profile.
- Two tabs: **Earned** (with earned date) and **In Progress** (with progress bar toward threshold).
- Badge tiles: icon, name, tier color (bronze/silver/gold), XP value.
- On first achievement unlock: full-screen celebration modal with animation.
- Badge shelf on Profile showing top 6 most recent or rarest badges.

### 4.4 Daily and weekly challenges

- Challenge widget on the Map screen (collapsible card at the bottom).
- Shows active daily and weekly challenges with progress bars.
- Countdown timer to next reset.
- Tap to see all challenges on a dedicated sheet.
- Push notification at 09:00 local time when new daily challenges are available.

### 4.5 Push notifications

- Register for push notifications on login via `expo-notifications`.
- Store the Expo push token on the server (`POST /users/me/push-token`).
- Handle notifications in the foreground (in-app banner) and background (system notification).
- Tap on a notification navigates to the relevant screen (deep link via `scheme://`).

**Estimated effort:** 2 weeks

---

## Phase 5 — Social Features

**Goal:** Surface social interactions that are meaningful in the field.

### 5.1 Comments on places

- Comment list on `PlaceDetailScreen` with avatar, name, text, timestamp.
- "Add comment" text input pinned to the bottom of the screen (keyboard-aware).
- Calls `POST /places/{id}/comments`.

### 5.2 Ratings

- Star rating widget on place detail — tapping submits immediately via `POST /places/{id}/ratings`.
- Show the user's existing rating pre-selected if they rated before.

### 5.3 Kudos (endorsements)

- On another user's profile: "Give kudos" button opening a bottom sheet with the 5 kudos types.
- The button is hidden for the current user's own profile.
- After giving kudos, the option for that type is grayed out for the month.
- Kudos counts shown below the user's avatar on their profile.

### 5.4 Notifications screen

- Full list of all notifications: XP gains, achievement unlocks, kudos received, comments on your places, challenge completions.
- Unread count badge on the Profile tab icon.

**Estimated effort:** 1–2 weeks

---

## Phase 6 — Advanced Platform Features

**Goal:** Differentiated features that make Geometki compelling as a field tool.

### 6.1 Ghost places (Overpass / OSM integration)

- Map layer toggle: "Show ghost places" reveals semi-transparent gray markers.
- Ghost place detail sheet shows OSM data: name, website, opening hours, Wikipedia excerpt.
- "Capture this place" button:
  - If the user is within 200 meters (verified by current GPS position): GPS capture (3x XP bonus).
  - Otherwise: web capture — fill in a description or upload a photo to claim (2x XP bonus).
- Post-capture animation: marker transitions from gray to full color with an XP burst animation.

### 6.2 Territory ownership

- Map region boundaries visible as subtle polygons (fetched from `GET /regions`).
- Tap a region to see: current champion avatar, score, user's rank in that region, top 5 leaderboard.
- Profile badge showing regions where the user is champion.

### 6.3 Seasonal events

- Event banner on the Map and Explore screens when an event is active.
- Event detail screen: description, category target, community progress bar, leaderboard, user's contribution count.
- Event-specific marker pins for places in the targeted categories.

### 6.4 Offline support

- `redux-persist` ensures the last fetched places list is readable without connectivity.
- Trip recording works fully offline: waypoints are stored locally in Redux and synced on next network availability using `NetInfo`.
- Place creation: save as local draft if offline, auto-submit when connection returns.
- Show a subtle "offline" banner when there is no network connection.

**Estimated effort:** 3–4 weeks

---

## Phase 7 — Polish, Performance & Accessibility

**Goal:** Production-quality app that passes App Review and earns high user ratings.

### 7.1 Performance

- Use `React.memo`, `useCallback`, and `useMemo` on all list items and heavy components.
- FlatList with `getItemLayout` for fixed-height place cards.
- Map markers: avoid re-rendering unchanged markers by keying on stable IDs.
- Image caching: use `expo-image` (replaces `Image` from React Native) which has built-in disk caching.
- Bundle size: analyze with `npx expo-bundle-analyzer` and lazy-load heavy screens.

### 7.2 Accessibility

- All interactive elements have `accessibilityLabel` and `accessibilityRole`.
- Color contrast ratios meet WCAG AA (4.5:1 for text).
- Support Dynamic Type on iOS (use relative font sizes).
- VoiceOver (iOS) and TalkBack (Android) manual testing pass for core flows.

### 7.3 Error boundaries and crash reporting

- Add a top-level React error boundary so unexpected errors show a friendly recovery screen.
- Integrate `expo-error-reporter` or Sentry (`@sentry/react-native`) for crash reporting.
- All RTK Query error states have user-facing error messages (not raw API error strings).

### 7.4 Dark mode

- Honor the system color scheme using `useColorScheme()`.
- All colors defined as theme tokens — never hardcoded hex values in component styles.

### 7.5 Localization

- Use `i18n-js` or `expo-localization` + `i18next` to support Russian (default) and English.
- Match the translation key structure used in the web client (`public/locales/`) where possible.

**Estimated effort:** 2 weeks

---

## App Store Publishing Plan

This section covers the complete process for submitting the iOS app to the Apple App Store.

### Prerequisites

#### Apple Developer Program

1. Enroll at [developer.apple.com/programs](https://developer.apple.com/programs). The annual fee is **$99 USD**.
2. Enrollment requires a valid Apple ID, legal name, and payment method. For organizations, a DUNS number is required (can take 1–2 weeks to obtain).
3. Once enrolled, access App Store Connect at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

#### Certificates and identifiers (handled automatically by EAS)

EAS Build manages provisioning profiles and signing certificates automatically when you run:

```bash
eas credentials
```

This creates:
- **Distribution certificate** — identifies your developer account to Apple.
- **App Store provisioning profile** — links the certificate to your App ID.

You only need to intervene manually if you are managing certificates across multiple machines or EAS accounts.

### Step 1 — Create the App in App Store Connect

1. Log in to App Store Connect → **My Apps** → **+** → **New App**.
2. Fill in:
   - **Platform:** iOS
   - **Name:** Geometki (this is the name shown on the App Store — maximum 30 characters)
   - **Primary language:** Russian or English (choose the language of your primary market)
   - **Bundle ID:** `pro.miksoft.geometki` (must match `app.json` exactly)
   - **SKU:** An internal identifier, e.g. `geometki-ios-001` (not shown to users)
   - **User access:** Full access

### Step 2 — App information

In the App Store Connect listing, fill in the following **before** submitting for review:

#### App metadata

| Field | Requirement | Notes |
|---|---|---|
| **Name** | Max 30 characters | Shown on the App Store |
| **Subtitle** | Max 30 characters | Shown below the name; use keywords |
| **Category** | Required | Primary: Navigation; Secondary: Social Networking or Travel |
| **Content rights** | Required | Confirm you own or have rights to all content |
| **Age rating** | Required | Complete the questionnaire; likely 4+ with location-sharing |

#### Description and keywords

| Field | Requirement |
|---|---|
| **Description** | Max 4,000 characters. Describe core features; lead with the most compelling ones. Include mentions of: place discovery, route recording, photo sharing, step tracking, community features. |
| **Keywords** | Max 100 characters total, comma-separated. Choose terms users would search for: maps, routes, poi, places, hiking, exploration, steps, tracker. Do NOT repeat words already in the title. |
| **Promotional text** | Max 170 characters. Can be updated without a new submission — use this for seasonal messaging. |
| **Support URL** | Required — must be a working URL. Can be a page on your website or a GitHub issues page. |
| **Marketing URL** | Optional but recommended — links to your website. |
| **Privacy Policy URL** | **Mandatory.** Must be publicly accessible. See Step 3. |

#### Screenshots (required)

Apple requires screenshots for each device class you support. Screenshots must be actual app screenshots (not mockups without a device frame, unless the device frame is included in the image). Required sizes:

| Device | Required Size | Notes |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px | **Required** |
| iPhone 6.5" (iPhone 14 Plus) | 1284 × 2778 px | Required if not providing 6.9" |
| iPhone 5.5" (iPhone 8 Plus) | 1242 × 2208 px | Required if supporting older devices |
| iPad Pro 13" (M4) | 2064 × 2752 px | Required if `supportsTablet: true` |
| iPad Pro 12.9" (3rd gen) | 2048 × 2732 px | Required for iPad support |

Minimum: **3 screenshots** per device size, maximum 10. Recommended screenshots:
1. Map view with POI markers
2. Route recording with live stats
3. Photo capture in action
4. Achievements/gamification screen
5. Place detail view

Screenshots can be generated using the iOS Simulator in Xcode (Device → Screenshot) or tools like `fastlane snapshot`.

#### App preview video (optional but strongly recommended)

A 15–30 second video demo significantly improves conversion. Record directly on device or in the iOS Simulator. Format: `.mp4` or `.mov`, portrait orientation, matching the screenshot device size.

### Step 3 — Privacy requirements

Since iOS 17 and the Apple privacy enforcement wave in 2024, privacy compliance is **strictly enforced at review time**. Missing any of these will result in rejection.

#### Privacy Policy

Write and host a Privacy Policy that clearly discloses:
- What data you collect (location, photos, account details, usage analytics).
- Why you collect it (provide app functionality, improve the service).
- Who you share it with (your server, any third-party SDKs).
- How users can request data deletion.
- Contact information.

The policy must be hosted at a stable public URL (e.g., `https://geometki.com/privacy`).

#### App Privacy Nutrition Label

In App Store Connect → Your App → **App Privacy**, complete the privacy questionnaire for every data type your app collects or shares. For Geometki, you will likely need to declare:

| Data type | Collected | Linked to user | Used for tracking |
|---|---|---|---|
| Precise location | Yes | Yes | No |
| Coarse location | Yes | Yes | No |
| Photos or videos | Yes | Yes | No |
| Name | Yes | Yes | No |
| Email address | Yes | Yes | No |
| User ID | Yes | Yes | No |
| Product interaction (usage analytics) | Yes | Yes | No |
| Crash data | Yes | No | No |

#### Privacy Manifest (`PrivacyInfo.xcprivacy`)

Required for any app using APIs that Apple has designated as "required reason APIs." Expo SDK 52 generates this file automatically as part of the EAS Build for apps using `expo-location`, `expo-sensors`, and `expo-file-system`. Verify it is present in the build output. If any third-party native library accesses the file system timestamps or user defaults, it must also declare its reasons in this manifest.

#### Permission justification strings

Every permission in `NSLocationAlwaysAndWhenInUseUsageDescription` and similar keys must explain **specifically** why the app needs the permission, in plain language, matching what the app actually does. Generic strings like "We need your location" are rejected. Example of an approved string: *"Geometki uses your precise location to show you nearby points of interest and to trace your route while recording a trip."*

### Step 4 — Build and upload

```bash
# Build the production binary
eas build --platform ios --profile production

# EAS Build will:
# 1. Bundle the JavaScript
# 2. Run native compilation on EAS servers (no Xcode required locally)
# 3. Sign with your distribution certificate
# 4. Upload to App Store Connect automatically (with --auto-submit flag)
# Or: submit manually with:
eas submit --platform ios --latest
```

Alternatively, download the `.ipa` from the EAS dashboard and upload via **Transporter** (free Mac app from Apple).

### Step 5 — TestFlight (mandatory pre-release testing)

Before App Review, test via TestFlight:

1. In App Store Connect → **TestFlight** → your build appears after processing (10–30 minutes).
2. Add **Internal Testers** (up to 100, must be added to your developer team in App Store Connect).
3. After Apple's beta review (usually 1 business day for the first build, instant thereafter), share the TestFlight link with **External Testers** (up to 10,000 people via email or public link).
4. Collect feedback for at least one week before submitting for App Review.

**TestFlight beta review checklist:**
- All three permission prompts (location foreground, location always, pedometer) appear correctly.
- Background location indicator (blue bar on iOS) appears when a trip is recording.
- App does not crash when backgrounded during a recording session.
- Photo upload completes successfully on a real device.
- The app works on the minimum supported iOS version (recommend iOS 16+).

### Step 6 — App Review submission

1. In App Store Connect → Your App → **App Store** tab → click your build under "Build."
2. In the **App Review Information** section, provide:
   - **Demo account credentials** — create a test account on your server specifically for reviewers. The reviewer must be able to log in and use all features without needing to be near a specific location (ghost place capture via GPS may need to be demonstrable via a fallback or explained in the review notes).
   - **Notes for App Review** — explain any non-obvious behaviors. Crucially: explain why background location is needed ("The app records the user's GPS route for the duration of a trip, which can last several hours. Background location is required so the route is accurate even when the user locks their screen."). This is the most common reason for rejection in apps like Geometki.
   - **Contact information** — phone number where Apple can reach you if they have questions (they do sometimes call).
3. Click **Submit for Review**.

### Step 7 — App Review timeline and common rejections

Apple's App Review typically takes **1–3 business days** for the first submission. Subsequent submissions after fixes are usually reviewed within 24 hours. You can request **Expedited Review** for critical bug fixes.

#### Common rejection reasons for apps like Geometki and how to avoid them

| Rejection reason | Prevention |
|---|---|
| **Background location used without clear user benefit** | Write detailed review notes explaining the trip recording feature. Ensure the foreground service notification on Android is shown. On iOS, make sure the blue location indicator is always visible during recording. |
| **"Always On" location requested immediately on launch** | Request foreground location first. Only request "Always" permission when the user explicitly taps "Start Trip Recording." Show a pre-permission explanation screen. |
| **Pedometer/motion data not disclosed in privacy label** | Declare `NSMotionUsageDescription` in `app.json`. Add motion/fitness data to the privacy nutrition label in App Store Connect. |
| **App requires sign-in before showing any content** | The map and place discovery should work without login. Login is only required for contributing content. |
| **Guideline 5.1.1 — Location used for advertising** | Do not pass location to any ad SDK. |
| **Crashes during review** | Test on the oldest iOS version you support. Reviewers often use older devices. |
| **Missing or broken privacy policy URL** | Host the privacy policy before submitting. Test the URL loads correctly without a login wall. |

### Step 8 — Post-approval

1. Choose a **release date**: immediate release, scheduled date, or manual release (you press the button).
2. Set **pricing**: Free (Geometki is a free app — in-app purchases or subscriptions can be added later).
3. Configure **availability**: select which countries/regions the app is available in.
4. Once live, monitor:
   - **App Store Connect Analytics** — downloads, sessions, retention.
   - **Crash reporter** (Sentry or Xcode Organizer) — crash-free rate should be >99.5%.
   - **Reviews and ratings** — respond to all 1–3 star reviews promptly.

### Step 9 — Ongoing release process

After the initial release, use EAS Update for minor JavaScript changes that do not require a native code change:

```bash
eas update --channel production --message "Fix: map cluster tap target"
```

This delivers an over-the-air update without a new App Store submission. OTA updates are limited to JavaScript bundle changes — any change to native permissions, plugins, or the `app.json` configuration requires a new binary build and App Store submission.

**Release cadence recommendation:**
- OTA updates: as needed for bug fixes.
- App Store builds: every 2–4 weeks for feature releases.
- Always test on TestFlight for at least 3 days before promoting to production.

---

## Dependency Reference

Full list of packages to install after Expo upgrade:

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack @react-navigation/drawer react-native-screens react-native-safe-area-context

# Bottom sheet
npx expo install @gorhom/bottom-sheet

# Location and background tracking
npx expo install expo-location expo-task-manager

# Sensors (pedometer)
npx expo install expo-sensors

# Camera and photos
npx expo install expo-camera expo-image-picker expo-image-manipulator

# File system
npx expo install expo-file-system

# Notifications
npx expo install expo-notifications

# Haptics
npx expo install expo-haptics

# Secure storage
npx expo install expo-secure-store

# Async storage (for redux-persist)
npx expo install @react-native-async-storage/async-storage

# State management
yarn add @reduxjs/toolkit react-redux redux-persist

# UI
yarn add react-native-paper react-native-vector-icons

# Forms
yarn add react-hook-form zod @hookform/resolvers

# Date utilities
yarn add date-fns

# Network awareness (offline detection)
npx expo install @react-native-community/netinfo

# Image component with caching
npx expo install expo-image

# Crash reporting (optional but recommended)
yarn add @sentry/react-native
npx expo install @sentry/react-native

# Testing
yarn add --dev jest @testing-library/react-native @testing-library/jest-native
```

---

*This roadmap is a living document. Update it as the project evolves, features are reprioritized, or the API surface changes. Each phase should end with a tagged release in the repository and a TestFlight build for stakeholder review.*
