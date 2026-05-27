# Live2D Viewer — AI Master Context & Rules

Welcome! This file is the absolute source of truth for all AI systems (Gemini, Claude, Cursor, Copilot) working on the Live2D Viewer codebase. It contains the architecture map, coding conventions, and workflow rules.

---

## 📝 Development Log & Project History Rule (Critical)
- **Always read** `DEVELOPMENT_LOG.md` at the start of the session to understand recent updates and history.
- **Do not rely on the git commit log** for historical context, as it may be clean/empty.
- **Always append** a new entry to `DEVELOPMENT_LOG.md` in the `## Changelog` section whenever you complete a task, feature, or refactoring. Include the date, summary of changes, modified files, and technical decisions.

---

## 🚀 Project Profile & Stack
- **Framework**: Vue 3 (Composition API, `<script setup lang="ts">`)
- **Build Engine**: Vite 6
- **UI System**: Naive UI (Components are auto-imported)
- **State Store**: Pinia 2
- **WebGL Rendering**: PIXI.js 7 (loaded dynamically)
- **Live2D Engine**: Cubism SDK 3/4 (loaded dynamically from CDN)

---

## ⚠️ MANDATORY AI CODING RULES (NEVER VIOLATE)

1. **Lazy Loading Constraint (Critical)**:
   - **NEVER** statically import `pixi.js` at the top of a file.
   - **ALWAYS** import dynamically inside functions: `const { Application } = await import('pixi.js');`
   - The Cubism SDK (`live2d.min.js`) resides in `public/`. It is loaded by `index.html` via a CDN script tag and lives on `window.PIXI.live2d`. Do not import or bundle it.

2. **Clean Component Scope**:
   - UI Vue components must **never** import or control sub-managers inside `src/utils/live2d/` directly.
   - Flow must go: Components ➔ Pinia Store (`useLive2DStore()`) ➔ `Live2DManager` facade.

3. **Resource Disposing**:
   - Clean up all custom resources, intervals, timers, and event listeners by registering them inside the global singleton resource manager:
     `globalResourceManager.register(() => { ... cleanup ... })`

4. **Class-level Logging**:
   - Create class-specific loggers using `createLogger('ClassName')` from `src/utils/live2d/utils.ts` instead of raw `console.log`.

---

## 📂 Directory Layout & Key Components
```
src/
├── App.vue                    # Root shell layout (3-column split layout)
├── main.ts                    # App bootstrap
├── components/
│   ├── Live2DViewer.vue        # Canvas host (mounts and destroys Live2DManager)
│   ├── ModelSelector.vue       # Left panel (loading models)
│   └── ModelSettings.vue       # Right panel (parameter sliders)
├── stores/
│   └── live2d.ts               # Pinia store
└── utils/
    ├── resource-manager.ts     # Global resource tracker & cleanup
    └── live2d/                 # Rendering engine core
        ├── live2d-manager.ts   # Main facade composes sub-managers
        ├── state-sync-manager.ts # Store bridge (relays state to Pinia)
        └── hero-model.ts       # HeroModel wrapper (large model node)
```

---

## 📐 Coding Conventions

### 1. Naming Conventions
- **Classes**: `PascalCase` (e.g. `Live2DCoreManager`, `HeroModel`)
- **Stores**: `use<Name>Store` (e.g. `useLive2DStore`)
- **Vue Components**: `PascalCase.vue`
- **Constants**: `UPPER_SNAKE_CASE`

### 2. Logging
- Use `createLogger` from `src/utils/live2d/utils.ts`:
  ```ts
  import { createLogger } from './utils';
  const logger = createLogger('MyClassName');
  logger.log('message');
  ```

### 3. Cleanup & Resource Management
- Register all disposable assets/events with the global resource manager:
  ```ts
  import { globalResourceManager } from '../resource-manager';
  const timer = setTimeout(...);
  globalResourceManager.register(() => clearTimeout(timer));
  ```

---

## 📖 Deep-dive Documentation Reference
- `docs/architecture.md` — Lifecycles, data flows, relationships.
- `docs/components.md` — Vue component mapping, props, emits.
- `docs/how-to-add-features.md` — Step-by-step feature integration recipes.
