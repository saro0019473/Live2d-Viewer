/**
 * Live2D State Sync Manager
 * Centralized management of synchronization between model state and UI
 */

import { globalResourceManager } from "../resource-manager.js";

// Unified state sync utilities
const StateSyncUtils = {
  // Get model state
  getModelState(model) {
    if (!model?.internalModel) return null;

    try {
      const state = {
        expressions: this.getExpressionState(model),
        motions: this.getMotionState(model),
        parameters: this.getParameterState(model),
        parts: this.getPartState(model),
      };
      return state;
    } catch (error) {
      console.error("Failed to get model state:", error);
      return null;
    }
  },

  // Get expression state
  getExpressionState(model) {
    try {
      const expressions =
        model.internalModel.settings.getExpressionDefinitions();
      return expressions ? expressions.map((expr) => expr.name) : [];
    } catch (error) {
      console.warn("Failed to get expression state:", error);
      return [];
    }
  },

  // Get motion state
  getMotionState(model) {
    try {
      const motionManager = model.internalModel.motionManager;
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
  getParameterState(model) {
    try {
      const parameters = {};
      const coreModel = model.internalModel.coreModel;
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
  getPartState(model) {
    try {
      const parts = {};
      const coreModel = model.internalModel.coreModel;

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
  applyUISettings(model, uiSettings) {
    if (!model?.internalModel) return false;

    try {
      // Apply expression settings
      if (uiSettings.expressions) {
        this.applyExpressionSettings(model, uiSettings.expressions);
      }

      // Apply motion settings
      if (uiSettings.motions) {
        this.applyMotionSettings(model, uiSettings.motions);
      }

      // Apply parameter settings
      if (uiSettings.parameters) {
        this.applyParameterSettings(model, uiSettings.parameters);
      }

      // Apply part settings
      if (uiSettings.parts) {
        this.applyPartSettings(model, uiSettings.parts);
      }

      return true;
    } catch (error) {
      console.error("Failed to apply UI settings:", error);
      return false;
    }
  },

  // Apply expression settings
  applyExpressionSettings(model, expressionSettings) {
    try {
      Object.entries(expressionSettings).forEach(([expressionId, enabled]) => {
        if (enabled) {
          const expressions =
            model.internalModel.settings.getExpressionDefinitions();
          const expression = expressions?.find(
            (expr) => expr.name === expressionId,
          );
          if (expression) {
            model.internalModel.expression(expression.name);
          }
        }
      });
    } catch (error) {
      console.warn("Failed to apply expression settings:", error);
    }
  },

  // Apply motion settings
  applyMotionSettings(model, motionSettings) {
    try {
      const motionManager = model.internalModel.motionManager;
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
  applyParameterSettings(model, parameterSettings) {
    try {
      const coreModel = model.internalModel.coreModel;
      Object.entries(parameterSettings).forEach(([paramId, value]) => {
        coreModel.setParameterValueById(paramId, value);
      });
    } catch (error) {
      console.warn("Failed to apply parameter settings:", error);
    }
  },

  // Apply part settings
  applyPartSettings(model, partSettings) {
    try {
      const coreModel = model.internalModel.coreModel;
      Object.entries(partSettings).forEach(([partId, value]) => {
        coreModel.setPartOpacityById(partId, value);
      });
    } catch (error) {
      console.warn("Failed to apply part settings:", error);
    }
  },
};

export class Live2DStateSyncManager {
  constructor() {
    this.syncCallbacks = new Map();
    this.syncTimers = new Map();
    this.expressionStates = new Map(); // Expression states
    this.motionStates = new Map(); // Motion states
    this.parameterStates = new Map(); // Parameter states
    this.partStates = new Map(); // Part states
    this.audioStates = new Map(); // Audio states
    this.textStates = new Map(); // Text states

    // State cache
    this.stateCache = new Map();

    // Sync configuration
    this.syncInterval = 100; // Sync interval (milliseconds)
    this.isEnabled = true;

    // Circular sync guard
    this.syncInProgress = new Set();

    // Register with global resource manager
    globalResourceManager.registerCleanupCallback(() => this.cleanup());
  }

  /**
   * Register sync callback
   * @param {string} modelId - Model ID
   * @param {Function} callback - Sync callback function
   */
  registerSyncCallback(modelId, callback) {
    this.syncCallbacks.set(modelId, callback);
    console.log(`📝 [StateSyncManager] Registered sync callback: ${modelId}`);
  }

  /**
   * Unregister sync callback
   * @param {string} modelId - Model ID
   */
  unregisterSyncCallback(modelId) {
    this.syncCallbacks.delete(modelId);
    console.log(`🗑️ [StateSyncManager] Unregistered sync callback: ${modelId}`);
  }

  /**
   * Sync model state to UI
   * @param {string} modelId - Model ID
   * @param {Object} model - Model instance
   */
  syncModelStateToUI(modelId, model) {
    if (!model) {
      console.warn("⚠️ [StateSyncManager] Invalid model, cannot sync state");
      return;
    }

    const callback = this.syncCallbacks.get(modelId);
    if (!callback) {
      console.warn("⚠️ [StateSyncManager] Sync callback not found:", modelId);
      return;
    }

    try {
      const currentState = StateSyncUtils.getModelState(model);
      if (currentState) {
        callback(currentState);
        console.log(
          "🔄 [StateSyncManager] Model state synced to UI:",
          modelId,
          currentState,
        );
      }
    } catch (error) {
      console.error("❌ [StateSyncManager] Failed to sync model state:", error);
    }
  }

  /**
   * Sync UI settings to model
   * @param {string} modelId - Model ID
   * @param {Object} model - Model instance
   * @param {Object} uiSettings - UI settings
   */
  syncUISettingsToModel(modelId, model, uiSettings) {
    if (!model) {
      console.warn(
        "⚠️ [StateSyncManager] Invalid model, cannot apply UI settings",
      );
      return false;
    }

    try {
      const success = StateSyncUtils.applyUISettings(model, uiSettings);
      if (success) {
        console.log(
          "✅ [StateSyncManager] UI settings synced to model:",
          modelId,
          uiSettings,
        );
      }
      return success;
    } catch (error) {
      console.error("❌ [StateSyncManager] Failed to sync UI settings:", error);
      return false;
    }
  }

  /**
   * Batch sync all model states
   * @param {Map} models - Model map
   */
  syncAllModelStates(models) {
    try {
      models.forEach((model, modelId) => {
        this.syncModelStateToUI(modelId, model);
      });
      console.log("🔄 [StateSyncManager] All model states synced");
    } catch (error) {
      console.error("❌ [StateSyncManager] Batch sync failed:", error);
    }
  }

  /**
   * Validate state consistency
   * @param {string} modelId - Model ID
   * @param {Object} expectedState - Expected state
   * @param {Object} actualState - Actual state
   */
  validateStateConsistency(modelId, expectedState, actualState) {
    const inconsistencies = [];

    // Validate parameter state
    if (expectedState.parameters && actualState.parameters) {
      Object.entries(expectedState.parameters).forEach(
        ([paramId, expectedValue]) => {
          const actualValue = actualState.parameters[paramId];
          if (Math.abs(actualValue - expectedValue) > 0.001) {
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
      Object.entries(expectedState.parts).forEach(([partId, expectedValue]) => {
        const actualValue = actualState.parts[partId];
        if (Math.abs(actualValue - expectedValue) > 0.001) {
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
   * @param {string} modelId - Model ID
   * @param {Object} model - Model instance
   * @param {Object} targetState - Target state
   */
  forceSyncState(modelId, model, targetState) {
    if (!model || !targetState) {
      console.warn("⚠️ [StateSyncManager] Model or target state is invalid");
      return false;
    }

    try {
      console.log(
        "🔄 [StateSyncManager] Force syncing state:",
        modelId,
        targetState,
      );

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
          console.log("✅ [StateSyncManager] Force sync successful:", modelId);
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
   * @param {string} modelId - Model ID
   * @param {Object} state - State data
   */
  saveStateToCache(modelId, state) {
    this.stateCache.set(modelId, {
      state: structuredClone(state),
      timestamp: Date.now(),
    });
    console.log("💾 [StateSyncManager] State saved to cache:", modelId);
  }

  /**
   * Restore state from cache
   * @param {string} modelId - Model ID
   * @param {Object} model - Model instance
   * @returns {boolean} Whether restoration was successful
   */
  restoreStateFromCache(modelId, model) {
    try {
      const cachedData = this.stateCache.get(modelId);
      if (!cachedData || !model) {
        return false;
      }

      console.log("🔄 [StateSyncManager] Restoring state from cache:", modelId);

      // Use unified tool to apply state, passing cachedData.state instead of the entire cachedData object
      const success = StateSyncUtils.applyUISettings(model, cachedData.state);

      if (success) {
        console.log(
          "✅ [StateSyncManager] State restoration successful:",
          modelId,
        );
      } else {
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
  cleanup() {
    console.log("🧹 [StateSyncManager] Starting resource cleanup...");

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
      this.audioStates.clear();
      this.textStates.clear();

      // Clean up circular sync guard
      this.syncInProgress.clear();

      console.log("✅ [StateSyncManager] Resource cleanup complete");
    } catch (error) {
      console.error("❌ [StateSyncManager] Resource cleanup failed:", error);
    }
  }

  /**
   * Integrate with Live2D Store
   * @param {Object} live2dStore - Live2D Store instance
   */
  integrateWithStore(live2dStore) {
    if (!live2dStore) {
      console.warn("⚠️ [StateSyncManager] Live2D Store is invalid");
      return;
    }

    // Register state sync callback
    this.registerSyncCallback("store", (state) => {
      // Prevent circular sync
      if (this.syncInProgress.has("store")) {
        console.log("🔄 [StateSyncManager] Skipping circular sync:", "store");
        return;
      }

      this.syncInProgress.add("store");

      try {
        // Update state in the Store
        live2dStore.updateModelState(state);
      } catch (error) {
        console.error("❌ [StateSyncManager] Store sync failed:", error);
      } finally {
        this.syncInProgress.delete("store");
      }
    });

    console.log(
      "✅ [StateSyncManager] Integrated with Live2D Store (with circular sync guard)",
    );
  }

  /**
   * Get model state
   * @param {Object} model - Model instance
   * @returns {Object|null} Model state
   */
  getModelState(model) {
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
