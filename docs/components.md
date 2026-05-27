# Component Reference

> Quick lookup for AI assistants: what each component does, what it reads/writes, and its key refs.

## App.vue
**Role:** Layout shell. Routes between settings panels via icon sidebar.

| Thing | Value |
|-------|-------|
| Location | `src/App.vue` |
| Lines | ~390 |
| Reads from | `useLive2DStore`, `useThemeStore` |
| Children | `Live2DViewer`, `ModelSelector`, `ModelSettings` |

**Key state:**
- `activeKey: Ref<string>` — which menu panel is open (`'model'` / `'settings'` / `'canvas'`)
- `settingsCollapsed: Ref<boolean>` — whether the settings side panel is visible

---

## Live2DViewer.vue
**Role:** Canvas host. Creates and owns the `Live2DManager` instance.

| Thing | Value |
|-------|-------|
| Location | `src/components/Live2DViewer.vue` |
| Lines | ~960 |
| Reads from | `useLive2DStore` (isLoading, error) |
| Writes to | `useLive2DStore.setManager()` |

**Key refs:**
- `viewerContainer` — the `<div>` that PIXI mounts its `<canvas>` into
- `live2dManager` — module-level `let`, NOT a Vue ref (avoids reactivity overhead)

**Lifecycle:**
- `onMounted` → `initLive2D()` → `live2dManager.init()`
- `onUnmounted` → `live2dManager.destroy()`

---

## ModelSelector.vue
**Role:** Left panel. Three ways to pick a model URL.

| Thing | Value |
|-------|-------|
| Location | `src/components/ModelSelector.vue` |
| Lines | ~1580 |
| Reads from | `useLive2DStore.modelDataMap` |
| Writes to | `useLive2DStore.loadModel(url)` |

**Tabs:** `'local'` (index.json + URL input) | `'library'` (live2dMaster.json catalog)

**Data flow:**
```
/models/index.json      → localModelOptions   (Local tab dropdown)
/models/live2dMaster.json → masterData        (Library tree)
user clicks costume     → live2dStore.loadModel(costume.path)
```

---

## ModelSettings.vue
**Role:** Right panel. All controls for the currently loaded model.

| Thing | Value |
|-------|-------|
| Location | `src/components/ModelSettings.vue` |
| Lines | ~2560 |
| Reads from | `useLive2DStore.currentModel`, `modelState`, `settings` |
| Writes to | `useLive2DStore.updateSetting()`, `useLive2DStore.playExpression()` |
| Emits | `back` |

**Sections (n-collapse-item):**

| name | Content |
|------|---------|
| `display` | Scale, position X/Y, rotation sliders |
| `behavior` | Breathing, eye blink, click interaction, look-at-mouse toggles |
| `expressions` | Expression buttons (calls `live2dStore.setExpression`) |
| `motions` | Motion group + index picker, play/loop controls |
| `parameters` | Raw Cubism parameter sliders |

---

## ErrorBoundary.vue
**Role:** Vue error boundary. Catches render errors from child components.

| Thing | Value |
|-------|-------|
| Location | `src/components/ErrorBoundary.vue` |
| Lines | ~70 |

---

## settings/SettingSlider.vue
**Role:** Reusable slider row with label + value display.

**Props:**
- `label: string`
- `modelValue: number`
- `min / max / step: number`

**Emits:** `update:modelValue`

---

## settings/SettingSwitch.vue
**Role:** Reusable toggle row with label.

**Props:**
- `label: string`
- `modelValue: boolean`

**Emits:** `update:modelValue`
