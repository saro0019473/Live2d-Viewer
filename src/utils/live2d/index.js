/**
 * Live2D Module Index
 * Unified export of all Live2D related classes and utility functions
 */

// Main manager
export { Live2DManager } from "./live2d-manager.js";

// Sub-managers
export { Live2DCoreManager } from "./core-manager.js";
export { Live2DModelManager } from "./model-manager.js";
export { Live2DInteractionManager } from "./interaction-manager.js";
export { Live2DAnimationManager } from "./animation-manager.js";

// Utility functions
export * from "./utils.js";

// Default export: main manager
export { Live2DManager as default } from "./live2d-manager.js";
