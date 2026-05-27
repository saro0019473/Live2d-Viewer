# How to Add Features — Developer Guide

> For AI coding assistants: follow these recipes when adding common feature types.
> Each recipe lists exactly which files to touch and in what order.

---

## Recipe 1: Add a New Model Setting (slider or toggle)

**Example:** Add a "Pupil Size" slider that controls a Cubism parameter.

**Files to touch:**

### 1. `src/stores/live2d.ts`
Add the new field to the `ModelSettings` interface and `defaultModelSettings`:
```ts
interface ModelSettings {
  // ...existing...
  pupilSize: number;  // ← add here
}

const defaultModelSettings: ModelSettings = {
  // ...existing...
  pupilSize: 1.0,     // ← add default
};
```

### 2. `src/components/ModelSettings.vue`
Add a `SettingSlider` or `SettingSwitch` in the appropriate `n-collapse-item` section:
```vue
<SettingSlider
  label="Pupil Size"
  :model-value="modelState.settings.pupilSize"
  :min="0" :max="2" :step="0.01"
  @update:model-value="(v) => updateSetting('pupilSize', v)"
/>
```

### 3. `src/stores/live2d.ts` — `updateSetting()` action
If the setting needs to apply to the model in real time, add a case in `updateSetting()`:
```ts
case 'pupilSize':
  manager.value?.setParameter('ParamEyeBall', value)
  break
```

### 4. `src/utils/live2d/live2d-manager.ts` (if needed)
Add a public method on `Live2DManager` if it's a new operation that doesn't map to an existing one.

---

## Recipe 2: Add a New Manager Method

**Example:** Add `Live2DManager.resetPose()`.

1. Add the method to `Live2DManager` in `live2d-manager.ts`:
   ```ts
   resetPose(): void {
     this.modelManager.currentModel?.resetParameters()
     this.logger.log('Pose reset')
   }
   ```
2. Call it from the Pinia store action, not from a Vue component directly:
   ```ts
   // in useLive2DStore
   const resetPose = () => manager.value?.resetPose()
   ```
3. Expose it from the store and call from the component.

---

## Recipe 3: Add a New Online Model Source

The Library tab fetches `/models/live2dMaster.json`. The format is:
```json
{
  "Master": [
    {
      "gameId": "game_id",
      "gameName": "Game Name",
      "character": [
        {
          "charId": "char_id",
          "charName": "Character Name",
          "live2d": [
            {
              "costumeId": "costume_id",
              "costumeName": "Costume Name",
              "path": "https://example.com/path/to/model.model3.json"
            }
          ]
        }
      ]
    }
  ]
}
```

To add a source: either add entries to `live2dMaster.json` or add a new tab in `ModelSelector.vue`.

---

## Recipe 4: Add a Local Model

1. Place the model folder in `public/models/<ModelName>/`
2. Run: `npm run generate-models-index`
3. Restart the dev server (`npm run dev`)
4. The model appears in the **Local** tab of ModelSelector

---

## Recipe 5: Add a New Pinia Store

If a feature needs its own store (e.g., `playlist.ts`):

1. Create `src/stores/playlist.ts` following the same pattern as `live2d.ts`:
   ```ts
   export const usePlaylistStore = defineStore('playlist', () => {
     // setup-style store
   })
   ```
2. Import and use it in components — no registration needed (Pinia auto-registers).
3. Do NOT put rendering logic in stores. Use stores only for reactive UI state.

---

## Recipe 6: Handle a New Interaction Event

To add a new pointer/keyboard interaction:

1. Add the listener in `Live2DInteractionManager` (`interaction-manager.ts`):
   ```ts
   private _onKeyDown(e: KeyboardEvent): void {
     // handle key
   }
   ```
2. Register it via `globalResourceManager`:
   ```ts
   globalResourceManager.addGlobalEventListener(
     'keydown', this._onKeyDown.bind(this)
   )
   ```
3. It will be automatically cleaned up when `globalResourceManager.destroyAll()` is called.

---

## Common Pitfalls

| Mistake | Correct approach |
|---------|-----------------|
| `import { Application } from 'pixi.js'` at top level | Use `const { Application } = await import('pixi.js')` inside an async function |
| Calling `live2dManager.xyz()` from a Vue component | Add the action to `useLive2DStore`, call the store from the component |
| Writing to `live2dStore.modelState` directly | Only `StateSyncManager` writes `modelState`; use `updateSetting()` for settings |
| Using `console.log` directly | Use `createLogger('ClassName').log(...)` in managers; use the local `log()` in components |
| Adding features to `ControlPanel.vue` | This file is deprecated; use `App.vue` split-panel layout |
