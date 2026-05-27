# Architecture Overview — Live2D Viewer

> For AI coding assistants: Read `GEMINI.md` (root) first for quick-start context.
> This document goes deeper into how the pieces fit together.

## Component → Store → Manager Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vue Layer                               │
│                                                                 │
│  App.vue ──── split panel ──── ModelSelector.vue               │
│      │                              │                           │
│      │                         live2dStore.loadModel(url)       │
│      │                              │                           │
│      └──── Live2DViewer.vue ────────┘                           │
│                  │                                              │
│                  │ ref: live2dManager                           │
└──────────────────│──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Live2DManager (facade)                        │
│                  src/utils/live2d/live2d-manager.ts             │
│                                                                 │
│  loadModel()  ──► ModelManager.load()                           │
│  playMotion() ──► AnimationManager.playMotion()                 │
│  setScale()   ──► ModelManager.currentModel.setScale()          │
│  destroy()    ──► all sub-managers destroyed in order           │
└─────────────────────────────────────────────────────────────────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
  CoreManager      ModelManager   AnimationManager  InteractionManager
  (PIXI app)     (HeroModel[])   (motions/exprs)   (mouse/zoom/drag)
                       │
                       ▼
                  HeroModel (×1 per loaded model)
                  - wraps PIXI Live2DModel
                  - owns parameter/expression/motion state
                       │
                       ▼
                 StateSyncManager ──► live2dStore (Pinia)
```

## Key Object Lifecycle

### App startup
1. `main.ts` mounts Vue app, registers Pinia
2. `Live2DViewer.vue` mounts → creates `Live2DManager(container)`
3. `Live2DManager.init()` called → awaits `CoreManager.init()`
4. `CoreManager.init()` loads PIXI (dynamic import) → creates PIXI Application
5. Cubism SDK (`public/live2d.min.js`) must already be in `window.PIXI.live2d`
   (injected via `<script>` tag in `index.html`)
6. `InteractionManager` created after step 4 (needs canvas element)

### Load a model
1. User picks model → `live2dStore.loadModel(url)`
2. Store calls `live2dManager.loadModel(url)`
3. `ModelManager.load(url)` → creates `HeroModel`, adds to PIXI stage
4. `StateSyncManager` registers the model, starts pushing state to store
5. `InteractionManager` attaches pointer listeners to the model

### Teardown
1. Component unmounts → `live2dManager.destroy()`
2. `Live2DManager.destroy()` calls sub-manager destroy in reverse init order
3. `CoreManager.destroy()` destroys PIXI Application, cleans canvas
4. `globalResourceManager.destroyAll()` fires all registered cleanup callbacks

## HeroModel Internal Structure

`HeroModel` wraps the PIXI `Live2DModel` and adds:

| Property | Type | Purpose |
|----------|------|---------|
| `model` | `any` (PIXI Live2DModel) | Raw PIXI model — use for stage operations |
| `cachedExpressions` | `any[]` | Expressions read from model definition |
| `cachedMotions` | `Record<string, any[]>` | Motion groups read from model definition |
| `parametersValues` | object | Current parameter + part opacity state |
| `id` | string | Unique ID (URL-based) for Map lookup |

## Pinia Store Shape (live2d.ts)

```ts
// Key reactive refs in useLive2DStore()
currentModel: Ref<HeroModel | null>
isModelLoaded: Ref<boolean>
modelState: {
  expressions: string[]
  motions: { currentGroup, currentIndex, isPlaying }
  parameters: Record<string, number>
  parts: Record<string, number>
}
settings: ModelSettings   // scale, position, rotation, breathing, etc.
```

## Dependency Map (import directions)

```
components/* → stores/* → utils/live2d/* → utils/resource-manager
                                └──────────────────► (no circular deps)
```

Rules:
- Components never import from `utils/live2d/` directly (only store)
- `utils/live2d/` files never import Vue/Pinia
- `StateSyncManager` holds a reference to the store — injected at runtime, not imported

## File Size Warning

The following files are large and should be navigated with search:

| File | Size | Notes |
|------|------|-------|
| `hero-model.ts` | ~1400 lines | Parameter/expression/motion API surface — split is planned |
| `ModelSettings.vue` | ~100 KB | Dense settings UI — each section is self-contained |
| `ModelSelector.vue` | ~60 KB | Library browser + local browser + URL input |
