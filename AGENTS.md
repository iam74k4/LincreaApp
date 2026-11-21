This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npm test                    # unit tests (jest-expo; files in src/__tests__/ named *-test.ts)
npm run check:pages         # check the scripts injected into EZCraft pages
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck, `npm test` and `npm run check:pages` before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Architecture (layers under `src/`)

A folder may import from its own layer and from lower layers, never from a higher one. `src/__tests__/architecture-test.ts` enforces this (and fails on a file placed outside these folders, on runtime import cycles, on a provider folder under `src/api/` imported from anywhere but `api/`, `auth/`, `webview/` or a feature's `*Source.ts`, and on runtime imports inside `src/webview/page/` of packages or of files outside `page/`).

| Layer | Folders | What lives there |
| --- | --- | --- |
| 7 | `app/` | Expo Router routes only. A route wires a screen: it reads params, sets navigator options and passes callbacks; the screen UI lives in `screens/` or `components/`. |
| 6 | `screens/` | Screens (`LoginScreen`, `MyAppsScreen`). |
| 5 | `components/` | UI parts. A large part gets its own folder with its hooks (`components/EzcraftWebView/`). |
| 4 | `myApps/` `shortcuts/` `attendance/` `session/` | Features. Provider-independent: they work with `models/` types. The only file in a feature that may import a provider folder is its `*Source.ts`. |
| 3 | `auth/` `webview/` | The login flow and credential storage / the EZCraft page integration. `webview/page/` builds the scripts and CSS injected into pages (pure string builders, checked by `npm run check:pages`); the rest of `webview/` is the app side (messages from pages, caches, background saves). |
| 2 | `api/` | External APIs. `api/http.ts` is the transport shared by every API (timeouts, network errors, error text). Each provider has its own folder: `api/ezcraft/`. |
| 1 | `models/` `platform/` `core/` `shims/` | Provider-independent data types / per-device adapters / config, clock, theme / Metro shims. |

Adding an external API (e.g. a new REST API next to EZCraft):

1. Put its client in `src/api/<provider>/` and use `serverFetch` and the errors from `src/api/http.ts`. Provider-specific rules (auth headers, tokens, how it reports an expired login) stay in that folder, like `api/ezcraft/server.ts`.
2. Convert responses into a type in `src/models/` inside the client; nothing outside `api/<provider>/` sees the raw response shape.
3. Screens and components never import `src/api/<provider>/`. Expose the call through a feature module that names the source in one place — e.g. `src/myApps/myAppsSource.ts` re-exports today's EZCraft `fetchMyApps`; switching the list to another API means changing that file only.
4. Put base URLs and other endpoint settings in `src/core/config.ts`.

## Building and distributing (TestFlight via GitHub Actions — no EAS)

This project does not use EAS (no `eas.json`, no `eas build` / `eas submit` / `eas update`, no `expo-updates`).
Every push to `develop` (a merged pull request, except docs/tests/scripts-only changes) and a monthly schedule run the `release` job of `.github/workflows/testflight.yml` on a GitHub-hosted macOS runner:
checks → `npx expo prebuild --platform ios` → `xcodebuild archive` (automatic signing with the App Store Connect API key, stored only in the `testflight` GitHub Environment) → upload to TestFlight. Pull requests run the unsigned `build` job (no secrets). The shared steps live in `.github/actions/prepare-ios/`.
The build number and commit are set by the workflow (`ios.buildNumber`, `extra.gitSha`); do not add them to `app.json`.
`develop` is what testers run via TestFlight; `main` (when it exists) records what was released on the App Store. Details: `docs/distribution.md`.
To ship a fix, merge it into `develop` — there are no over-the-air updates.

Android (not on Google Play yet): `.github/workflows/android.yml` on an ubuntu runner. Pull requests run the `build` job (`npx expo prebuild --platform android` → `./gradlew assembleRelease`, debug key, no secrets); a manual run on `develop` / `hotfix/*` runs `release` (`./gradlew bundleRelease` signed with the upload key from the `google-play` GitHub Environment, kept as an Actions artifact for a manual Play Console upload). Shared steps: `.github/actions/prepare-android/`. The workflow sets `android.versionCode` (minutes since 1970) and `extra.gitSha`; do not add them to `app.json`. Release signing is inserted into the generated `app/build.gradle` by `plugins/withAndroidReleaseSigning.js` from the `ANDROID_UPLOAD_*` environment variables (debug key when they are missing). Details: `docs/android-release.md`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios` locally (the simulator needs no signing).
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- Every dependency runs during the signed release builds next to the App Store Connect key (iOS) and the Android upload key, so add one only when an Expo module or a few lines of our own code cannot do the job.
- A package patched in `patches/` is pinned to the exact patched version in `package.json` (no `~`/`^`). When upgrading it, re-create the patch or drop it if upstream fixed the issue.
- Our own native code lives only in local Expo modules under `modules/` (`health`: daily steps from HealthKit on iOS and Health Connect on Android, the same functions on both; `background-time`: iOS background time during saves), each called through one wrapper in `src/platform/` that returns a no-op/`null` when the module is missing (Expo Go, or a device without it). Config plugins of our own live in `plugins/` and are listed in `app.json`.
- `patches/react-native-webview+14.0.1.patch` makes Android match iOS: `injectedJavaScriptBeforeContentLoaded` runs as a document-start script (`WebViewCompat.addDocumentStartJavaScript`), before the page's own scripts; and a main-frame message reports the page URL as `nativeEvent.url` (upstream reports only the origin, which would make `trustedSenderApp` reject every per-app message). Frames, and every message on old WebViews that fall back to `addJavascriptInterface`, report the origin only (never trusted as an app). Re-check both when upgrading react-native-webview.
- One codebase for iOS and Android: do not write `{ ios, android }` names or `Platform.OS` branches in screens or data files. A per-device difference lives in exactly one small module that the rest of the code calls by a device-independent name — icons in `src/platform/icons.tsx`, WebView load-error numbers in `src/webview/loadErrors.ts`, the in-app PDF switch `PDF_IN_APP` and `mimeFor` in `src/platform/files.ts`, biometric names, strength and whether saving also asks for biometrics (`saveAsksBiometrics`) in `src/auth/faceId.ts`, Liquid Glass in `src/components/GlassButton.tsx`, save parking `CAN_PARK` in `src/components/SavePark.tsx`, steps and the step source's name (`healthSourceName`, given by the native module) in `src/platform/health.ts`, background time in `src/platform/backgroundTime.ts`, app-switcher privacy in `src/platform/privacyScreen.ts`, the build number shown in the version label in `src/core/appVersion.ts`. Prefer asking whether a capability exists (the module returns `null` / `false`) over asking which device it is.
