/**
 * Live2D State Sync Manager — Rendering ↔ Pinia Bridge
 *
 * `globalStateSyncManager` (exported singleton) is the ONLY place where
 * rendering-layer state flows into Vue/Pinia. This keeps the rendering code
 * free of Vue dependencies.
 *
 * How it works:
 *   1. ModelManager calls `globalStateSyncManager.registerModel(heroModel, store)`
 *   2. StateSyncManager polls / listens for model state changes
 *   3. State is pushed into the Pinia store via `store.updateModelState(state)`
 *
 * Consumers:
 *   - `useLive2DStore` calls `globalStateSyncManager.syncToStore(store)` on init
 *   - Components read state from the Pinia store (never directly from managers)
 * See: docs/architecture.md
 */

import { globalResourceManager } from "../resource-manager";

const __DEV__ = import.meta.env.DEV;

export interface ModelState {
  expressions: string[];
  motions: {
    currentGroup?: string;
    currentIndex?: number;
    isPlaying: boolean;
  } | null;
  parameters: Record<string, number>;
  parts: Record<string, number>;
  [key: string]: unknown;
}

export interface UISettings {
  expressions?: Record<string, boolean>;
  motions?: Record<string, number>;
  parameters?: Record<string, number>;
  parts?: Record<string, number>;
}

export interface Live2DStore {
  updateModelState: (state: any) => void;
  getCurrentModelState?: () => any;
  [key: string]: any;
}

// Helper to safely get the underlying PIXI Live2DModel from a HeroModel or other wrapper
function getPixiModel(model: any): any {
  if (!model) return null;
  if (model.model) {
    return model.model;
  }
  return model;
}

// Unified state sync utilities
const StateSyncUtils = {
  // Get model state
  getModelState(model: any): ModelState | null {
    const pixiModel = getPixiModel(model);
    if (!pixiModel?.internalModel) return null;

    try {
      const state: ModelState = {
        expressions: this.getExpressionState(pixiModel),
        motions: this.getMotionState(pixiModel),
        parameters: this.getParameterState(pixiModel),
        parts: this.getPartState(pixiModel),
      };
      return state;
    } catch (error) {
      console.error("Failed to get model state:", error);
      return null;
    }
  },

  // Get expression state
  getExpressionState(model: any): string[] {
    try {
      const pixiModel = getPixiModel(model);
      const expressions =
        pixiModel.internalModel.settings.getExpressionDefinitions();
      return expressions ? expressions.map((expr: any) => expr.name) : [];
    } catch (error) {
      console.warn("Failed to get expression state:", error);
      return [];
    }
  },

  // Get motion state
  getMotionState(model: any): ModelState["motions"] {
    try {
      const pixiModel = getPixiModel(model);
      const motionManager = pixiModel.internalModel.motionManager;
      return motionManager
        ? {
            currentGroup: motionManager.currentMotion?.group,
            currentIndex: motionManager.currentMotion?.index,
            isPlaying: motionManager.isPlaying,
          }
        : null;
    } catch (error) {
      console.warn("Failed to get motion state:", error);
      return null;
    }
  },

  // Get parameter state
  getParameterState(model: any): Record<string, number> {
    try {
      const pixiModel = getPixiModel(model);
      const parameters: Record<string, number> = {};
      const coreModel = pixiModel.internalModel.coreModel;
      const live2dCoreModel = coreModel.getModel();
      const parameterCount = live2dCoreModel.parameters.count;
      const parameterIds = live2dCoreModel.parameters.ids;

      for (let i = 0; i < parameterCount; i++) {
        const paramId = parameterIds[i];
        parameters[paramId] = coreModel.getParameterValueByIndex(i);
      }

      return parameters;
    } catch (error) {
      console.warn("Failed to get parameter state:", error);
      return {};
    }
  },

  // Get part state
  getPartState(model: any): Record<string, number> {
    try {
      const pixiModel = getPixiModel(model);
      const parts: Record<string, number> = {};
      const coreModel = pixiModel.internalModel.coreModel;

      // Use public API to get part information
      const partCount = coreModel.getPartCount();
      for (let i = 0; i < partCount; i++) {
        const partId = coreModel.getPartId(i);
        parts[partId] = coreModel.getPartOpacityById(partId);
      }

      return parts;
    } catch (error) {
      console.warn("Failed to get part state:", error);
      return {};
    }
  },

  // Apply UI settings to model
  applyUISettings(model: any, uiSettings: UISettings): boolean {
    const pixiModel = getPixiModel(model);
    if (!pixiModel?.internalModel) return false;

    try {
      // Apply expression settings
      if (uiSettings.expressions) {
        this.applyExpressionSettings(pixiModel, uiSettings.expressions);
      }

      // Apply motion settings
      if (uiSettings.motions) {
        this.applyMotionSettings(pixiModel, uiSettings.motions);
      }

      // Apply parameter settings
      if (uiSettings.parameters) {
        this.applyParameterSettings(pixiModel, uiSettings.parameters);
      }

      // Apply part settings
      if (uiSettings.parts) {
        this.applyPartSettings(pixiModel, uiSettings.parts);
      }

      return true;
    } catch (error) {
      console.error("Failed to apply UI settings:", error);
      return false;
    }
  },

  // Apply expression settings
  applyExpressionSettings(model: any, expressionSettings: Record<string, boolean>): void {
    try {
      const pixiModel = getPixiModel(model);
      Object.entries(expressionSettings).forEach(([expressionId, enabled]) => {
        if (enabled) {
          const expressions =
            pixiModel.internalModel.settings.getExpressionDefinitions();
          const expression = expressions?.find(
            (expr: any) => expr.name === expressionId,
          );
          if (expression) {
            pixiModel.internalModel.expression(expression.name);
          }
        }
      });
    } catch (error) {
      console.warn("Failed to apply expression settings:", error);
    }
  },

  // Apply motion settings
  applyMotionSettings(model: any, motionSettings: Record<string, number>): void {
    try {
      const pixiModel = getPixiModel(model);
      const motionManager = pixiModel.internalModel.motionManager;
      if (!motionManager) return;

      Object.entries(motionSettings).forEach(([group, index]) => {
        if (typeof index === "number") {
          motionManager.startMotion(group, index);
        }
      });
    } catch (error) {
      console.warn("Failed to apply motion settings:", error);
    }
  },

  // Apply parameter settings
  applyParameterSettings(model: any, parameterSettings: Record<string, number>): void {
    try {
      const pixiModel = getPixiModel(model);
      const coreModel = pixiModel.internalModel.coreModel;
      Object.entries(parameterSettings).forEach(([paramId, value]) => {
        coreModel.setParameterValueById(paramId, value);
      });
    } catch (error) {
      console.warn("Failed to apply parameter settings:", error);
    }
  },

  // Apply part settings
  applyPartSettings(model: any, partSettings: Record<string, number>): void {
    try {
      const pixiModel = getPixiModel(model);
      const coreModel = pixiModel.internalModel.coreModel;
      Object.entries(partSettings).forEach(([partId, value]) => {
        coreModel.setPartOpacityById(partId, value);
      });
    } catch (error) {
      console.warn("Failed to apply part settings:", error);
    }
  },
};

export class Live2DStateSyncManager {
  private syncCallbacks = new Map<string, (state: ModelState) => void>();
  private syncTimers = new Map<string, any>();
  private expressionStates = new Map<string, any>(); // Expression states
  private motionStates = new Map<string, any>(); // Motion states
  private parameterStates = new Map<string, any>(); // Parameter states
  private partStates = new Map<string, any>(); // Part states

  // State cache
  private stateCache = new Map<string, { state: ModelState; timestamp: number }>();

  // Sync configuration
  public syncInterval = 100; // Sync interval (milliseconds)
  public isEnabled = true;

  // Circular sync guard
  private syncInProgress = new Set<string>();

  constructor() {
    // Register with global resource manager
    globalResourceManager.registerCleanupCallback(() => this.cleanup());
  }

  /**
   * Register sync callback
   * @param modelId - Model ID
   * @param callback - Sync callback function
   */
  public registerSyncCallback(modelId: string, callback: (state: ModelState) => void): void {
    this.syncCallbacks.set(modelId, callback);
    __DEV__ &&
      console.debug(`[StateSyncManager] Registered sync callback: ${modelId}`);
  }

  /**
   * Unregister sync callback
   * @param modelId - Model ID
   */
  public unregisterSyncCallback(modelId: string): void {
    this.syncCallbacks.delete(modelId);
    __DEV__ &&
      console.debug(
        `[StateSyncManager] Unregistered sync callback: ${modelId}`,
      );
  }

  /**
   * Sync model state to UI
   * @param modelId - Model ID
   * @param model - Model instance
   */
  public syncModelStateToUI(modelId: string, model: any): void {
    if (!model) {
      console.warn("⚠️ [StateSyncManager] Invalid model, cannot sync state");
      return;
    }

    const callback = this.syncCallbacks.get(modelId);
    if (!callback) {
      __DEV__ &&
        console.debug(
          `[StateSyncManager] No sync callback registered for: ${modelId}`,
        );
      return;
    }

    try {
      const currentState = StateSyncUtils.getModelState(model);
      if (currentState) {
        callback(currentState);
      }
    } catch (error) {
      console.error("❌ [StateSyncManager] Failed to sync model state:", error);
    }
  }

  /**
   * Sync UI settings to model
   * @param modelId - Model ID
   * @param model - Model instance
   * @param uiSettings - UI settings
   */
  public syncUISettingsToModel(modelId: string, model: any, uiSettings: UISettings): boolean {
    if (!model) {
      console.warn(
        "⚠️ [StateSyncManager] Invalid model, cannot apply UI settings",
      );
      return false;
    }

    try {
      const success = StateSyncUtils.applyUISettings(model, uiSettings);
      return success;
    } catch (error) {
      console.error("❌ [StateSyncManager] Failed to sync UI settings:", error);
      return false;
    }
  }

  /**
   * Batch sync all model states
   * @param models - Model map
   */
  public syncAllModelStates(models: Map<string, any>): void {
    try {
      models.forEach((model, modelId) => {
        this.syncModelStateToUI(modelId, model);
      });
    } catch (error) {
      console.error("❌ [StateSyncManager] Batch sync failed:", error);
    }
  }

  /**
   * Validate state consistency
   * @param modelId - Model ID
   * @param expectedState - Expected state
   * @param actualState - Actual state
   */
  public validateStateConsistency(
    modelId: string,
    expectedState: any,
    actualState: any
  ): { isConsistent: boolean; inconsistencies: any[] } {
    const inconsistencies: any[] = [];

    if (!expectedState || !actualState) {
      return {
        isConsistent: false,
        inconsistencies: [{ type: "general", message: "Missing expected or actual state" }],
      };
    }

    // Validate parameter state
    if (expectedState.parameters && actualState.parameters) {
      Object.entries(expectedState.parameters).forEach(
        ([paramId, expectedVal]) => {
          const expectedValue = expectedVal as number;
          const actualValue = actualState.parameters[paramId] as number | undefined;
          if (actualValue === undefined || Math.abs(actualValue - expectedValue) > 0.001) {
            inconsistencies.push({
              type: "parameter",
              id: paramId,
              expected: expectedValue,
              actual: actualValue,
            });
          }
        },
      );
    }

    // Validate part state
    if (expectedState.parts && actualState.parts) {
      Object.entries(expectedState.parts).forEach(([partId, expectedVal]) => {
        const expectedValue = expectedVal as number;
        const actualValue = actualState.parts[partId] as number | undefined;
        if (actualValue === undefined || Math.abs(actualValue - expectedValue) > 0.001) {
          inconsistencies.push({
            type: "part",
            id: partId,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      });
    }

    if (inconsistencies.length > 0) {
      console.warn(
        "⚠️ [StateSyncManager] State inconsistency:",
        modelId,
        inconsistencies,
      );
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
    };
  }

  /**
   * Force sync state
   * @param modelId - Model ID
   * @param model - Model instance
   * @param targetState - Target state
   */
  public forceSyncState(modelId: string, model: any, targetState: any): boolean {
    if (!model || !targetState) {
      console.warn("⚠️ [StateSyncManager] Model or target state is invalid");
      return false;
    }

    try {
      // Apply target state
      const success = StateSyncUtils.applyUISettings(model, targetState);

      if (success) {
        // Validate sync result
        const actualState = StateSyncUtils.getModelState(model);
        const validation = this.validateStateConsistency(
          modelId,
          targetState,
          actualState,
        );

        if (validation.isConsistent) {
          return true;
        } else {
          console.warn(
            "⚠️ [StateSyncManager] State still inconsistent after force sync:",
            modelId,
            validation.inconsistencies,
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("❌ [StateSyncManager] Force sync failed:", error);
      return false;
    }
  }

  /**
   * Save state to cache
   * @param modelId - Model ID
   * @param state - State data
   */
  public saveStateToCache(modelId: string, state: ModelState): void {
    this.stateCache.set(modelId, {
      state: structuredClone(state),
      timestamp: Date.now(),
    });
  }

  public restoreStateFromCache(modelId: string, model: any): boolean {
    try {
      const cachedData = this.stateCache.get(modelId);
      if (!cachedData || !model) {
        return false;
      }

      // Convert ModelState to UISettings for applyUISettings
      const uiSettings: UISettings = {
        parameters: cachedData.state.parameters,
        parts: cachedData.state.parts,
      };

      if (cachedData.state.motions) {
        const { currentGroup, currentIndex } = cachedData.state.motions;
        if (currentGroup !== undefined && currentIndex !== undefined) {
          uiSettings.motions = { [currentGroup]: currentIndex };
        }
      }

      // Use unified tool to apply state
      const success = StateSyncUtils.applyUISettings(model, uiSettings);

      if (!success) {
        console.warn(
          "⚠️ [StateSyncManager] State restoration failed:",
          modelId,
        );
      }

      return success;
    } catch (error) {
      console.error("❌ [StateSyncManager] State restoration error:", error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    try {
      // Clean up sync callbacks
      this.syncCallbacks.clear();

      // Clean up timers
      this.syncTimers.forEach((timerId) => {
        clearTimeout(timerId);
      });
      this.syncTimers.clear();

      // Clean up state caches
      this.stateCache.clear();
      this.expressionStates.clear();
      this.motionStates.clear();
      this.parameterStates.clear();
      this.partStates.clear();

      // Clean up circular sync guard
      this.syncInProgress.clear();
    } catch (error) {
      console.error("❌ [StateSyncManager] Resource cleanup failed:", error);
    }
  }

  /**
   * Integrate with Live2D Store
   * @param live2dStore - Live2D Store instance
   */
  public integrateWithStore(live2dStore: Live2DStore): void {
    if (!live2dStore) {
      console.warn("⚠️ [StateSyncManager] Live2D Store is invalid");
      return;
    }

    // Register state sync callback
    this.registerSyncCallback("store", (state) => {
      // Prevent circular sync
      if (this.syncInProgress.has("store")) {
        __DEV__ &&
          console.debug("[StateSyncManager] Skipping circular sync: store");
        return;
      }

      this.syncInProgress.add("store");

      try {
        // Update state in the Store
        live2dStore.updateModelState(state);
      } catch (error) {
        console.error("[StateSyncManager] Store sync failed:", error);
      } finally {
        this.syncInProgress.delete("store");
      }
    });
  }

  /**
   * Get model state
   * @param model - Model instance
   * @returns Model state
   */
  public getModelState(model: any): ModelState | null {
    return StateSyncUtils.getModelState(model);
  }
}

// Create global state sync manager instance
export const globalStateSyncManager = new Live2DStateSyncManager();

// Register cleanup on page unload
globalResourceManager.registerGlobalEventListener(
  "state-sync-cleanup",
  "beforeunload",
  () => {
    globalStateSyncManager.cleanup();
  },
);
