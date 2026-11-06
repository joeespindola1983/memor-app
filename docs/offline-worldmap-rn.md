# Memor App — Offline spatial mapping in React Native

Branch: `feat/memor-offline-worldmap` (experimental).

The product UI, navigation, editor, and data model remain in React Native /
TypeScript. On iOS a local Expo module embeds ARKit's ARSCNView. It does NOT
use ReactVision Spatial / Cloud Anchors; ViroReact remains installed only for
legacy QA paths, with `provider: none`.

## Reused Swift code

The following Swift files were copied unchanged from the original
`joeespindola1983/memor` branch
`feat/memor-progressive-world-mapping`:

- `MemorMapExpansionPolicy.swift` — requires relocalization and stable tracking.
- `MemorWorldMapArchiveHistory.swift` — atomic archive replacement, retained
  original and two most recent revisions, restoration/rollback helper.
- `WorldMapAnchorPersistence.swift` — preserves IDs and world transforms
  of saved interventions when extending a map.

Their behavior is adapted by `MemorWorldMapView.swift`, which serves React
Native through `MemorWorldMapModule.swift` and a local Expo module.

## iPhone QA flow (physical device)

1. Create a new place and slowly scan a textured, well-lit environment.
2. Wait until ARKit reports `mapped` and normal tracking.
3. Save the ARWorldMap locally; then name it in React Native with ARKit unmounted.
4. Close the camera / app, reopen the place, and wait for the ARKit session to
   relocalize the previous `initialWorldMap`.
5. Create a text marker (a real ARAnchor is inserted in the saved map).
6. Select **Ampliar mapeamento**. Scan new areas and angles. Do not reset
   tracking or save a separate, unrelated map.
7. Return near the previously mapped region until ARKit reports `mapped`.
8. Select **Salvar mapa ampliado**. The revision is saved atomically; old
   intervention anchors retain their original transforms.
9. Close/reopen. Verify that all markers remain at the same physical location.
10. Try **Cancelar ampliação**, **Restaurar anterior** and **Restaurar original**
    and verify that the original map remains available.

Important: A `mapped` status alone is **not** proof of better relocalization
from the new viewpoint. Compare revisits and drift before accepting expansions.

## Local file contract

- Maps are saved at `Documents/MemorWorldMaps/<uuid>/worldmap.archive`
  under a private iOS app sandbox.
- Historical archives are stored beside the map under `worldmap-history/`.
- The React Native `LabPlace.worldMap` record contains an archive ID and
  local URI, not an upload or cloud anchor.
- Existing AsyncStorage records without `worldMap` remain readable.
- Deleting a local place requests native map cleanup separately.
- Captured maps are NOT uploaded automatically in this iteration.

Supabase integration is the next step: reuse the original Memor Swift archive
v2 (compression / chunks / checksums), adapt the upload client for RN,
preserve private backups and require editorial approval for publication.
Do not label local-only captures as published.

## Android

The RN interface stays shared. Android will get a Kotlin / ARCore adapter, but
iOS ARWorldMap archives cannot be directly loaded into ARCore. Shared place
recognition requires an additional cross-platform visual reference package
with independently validated camera-pose estimation.

## Run on a Mac

```bash
git fetch origin
git switch feat/memor-offline-worldmap
git pull --ff-only
npm install
npm run typecheck
npm run test
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

The new native module needs a fresh Xcode build; Expo Go cannot run it.
**Do not uninstall the old QA app** just to test this branch. It could destroy
locally stored ARWorldMaps and media.

## Known limitations / test gate

This change has **not yet passed Xcode compile / physical iPhone QA**. In
particular validate Expo autolinking, ARSCNView lifecycle, text anchor
persistence, large archives, original-map restore, and retention counts.
The original Swift progressive mapping branch was also marked experimental.
Do not merge to release until physical tests pass.

Historical `reactvision-vps-qa.md` is for old experiments, not the new
production architecture.


## Important: rebuild the native iPhone app after the module registration fix

The Expo Modules registry must include `MemorWorldMapModule` and the CocoaPod
`MemorWorldMap`. A successful TypeScript check alone does not guarantee this.

```bash
git fetch origin
git switch feat/memor-offline-worldmap
git pull --ff-only
npm install

# Fails if Expo cannot find the Swift module class AND its CocoaPod.
npm run native:check
npm run typecheck
npm run test

# Recreates the native Xcode project and reinstalls pods.
npx expo prebuild --clean --platform ios
# Compile AND install a NEW development build on the connected iPhone.
npx expo run:ios --device
```

`expo start` (or Metro hot reload) **cannot add a Swift module to an
already installed iOS binary**. A prebuild only generates the native
project; an installed device build is still required.

If debugging a `Cannot find native module 'MemorWorldMap'` error, inspect
`ios/Podfile.lock` for `MemorWorldMap` and regenerate pods if missing.
The `expo-module.config.json` registration uses `apple.modules`, not
`ios.modules`.

The JS shim intentionally returns null when an older development client is
running, and the iOS capture screen displays an actionable rebuild message
rather than silently falling back to a non-persistent Viro session.
