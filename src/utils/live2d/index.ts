/**
 * Live2D Utilities — Public API Barrel
 *
 * External callers (Vue components, Pinia stores) should only ever import
 * `Live2DManager` from here. The sub-managers are exported for typing
 * purposes only; do NOT instantiate them directly outside of `live2d-manager.ts`.
 *
 * Load order (enforced at runtime by `waitForLive2D`):
 *   1. `public/live2d.min.js` injects `window.PIXI` + Cubism SDK
 *   2. PIXI.js is loaded via dynamic `import()` in `core-manager.ts`
 *   3. Only after both are ready does `Live2DManager.init()` proceed
 * See: docs/architecture.md
 */

export { Live2DManager } from "./live2d-manager";
export { Live2DCoreManager } from "./core-manager";
export { Live2DModelManager } from "./model-manager";
export { Live2DInteractionManager } from "./interaction-manager";
export { Live2DAnimationManager } from "./animation-manager";
export * from "./utils";
export { Live2DManager as default } from "./live2d-manager";
