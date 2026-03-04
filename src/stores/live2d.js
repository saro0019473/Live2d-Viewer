import { defineStore } from "pinia";
import { ref, reactive, computed } from "vue";
import { globalStateSyncManager } from "../utils/live2d/state-sync-manager.js";

// Log utility function
const log = (message, level = "info") => {
  const prefix = "[Live2DStore]";
  const timestamp = new Date().toISOString();

  switch (level) {
    case "error":
      console.error(`${timestamp} ${prefix} ${message}`);
      break;
    case "warn":
      console.warn(`${timestamp} ${prefix} ${message}`);
      break;
    case "debug":
      if (window.DEBUG_LIVE2D) {
        console.log(`${timestamp} ${prefix} ${message}`);
      }
      break;
    default:
      console.log(`${timestamp} ${prefix} ${message}`);
  }
};

export const useLive2DStore = defineStore("live2d", () => {
  // State
  const manager = ref(null);
  const currentModel = ref(null);
  const loadedModels = ref(new Map()); // Store HeroModel instances
  const modelDataMap = ref(new Map()); // Store model data
  const isLoading = ref(false);
  const error = ref(null);

  // Settings
  const settings = reactive({
    showText: true,
    enableAudio: true,
    canvasWidth: 1200,
    canvasHeight: 800,
    autoResize: true,

    // AI control settings
    enableAIControl: true,
    autoExpression: true,
    autoMotion: true,
    autoLipSync: true,
    textDisplayDuration: 3000,

    // Expression mapping settings
    emotionMapping: {
      neutral: 0,
      happy: 1,
      sad: 2,
      angry: 3,
      surprised: 4,
      fear: 5,
      disgust: 6,
    },
  });

  // Model state - simplified to basic data storage, no sync logic
  const modelState = reactive({
    // Basic settings - data storage only, no sync handling
    settings: {
      scale: 0.2,
      position: { x: 0, y: 0 },
      rotation: 0,
      breathing: true,
      eyeBlinking: true,
      interactive: true,
      // Extended settings
      wheelZoom: true,
      clickInteraction: true,
      zoomSettings: {
        speed: 0.01,
        min: 0.01,
        max: 5.0,
      },
      enableAudio: true,
      showText: true,
    },
  });

  // Default model settings
  const defaultModelSettings = {
    scale: 0.2,
    position: { x: 0, y: 0 },
    rotation: 0,
    breathing: true,
    eyeBlinking: true,
    interactive: true,
  };

  // Actions
  const setManager = (newManager) => {
    manager.value = newManager;

    // Integrate state sync manager
    if (newManager) {
      globalStateSyncManager.integrateWithStore({
        updateModelState: updateModelState,
        getCurrentModelState: getCurrentModelState,
      });
      console.log("🔗 [Live2DStore] State sync manager integrated");
    }
  };

  const setCurrentModel = (model) => {
    currentModel.value = model;

    // Sync set the current model in the model manager
    if (manager.value && model?.id) {
      try {
        manager.value.setCurrentModel(model.id);
        console.log(
          "🎯 [Live2DStore] Synced current model in model manager:",
          model.id,
        );
      } catch (error) {
        console.error(
          "❌ [Live2DStore] Failed to set current model in model manager:",
          error,
        );
      }
    }

    if (!model) {
      // If null, reset modelState and return safely
      Object.assign(modelState.settings, {
        scale: 0.2,
        position: { x: 0, y: 0 },
        rotation: 0,
        breathing: true,
        eyeBlinking: true,
        interactive: true,
      });
      return;
    }

    // Check if there is already a user-set scale value
    const hasUserScale =
      modelState.settings.scale && modelState.settings.scale !== 0.2;

    // Sync state
    const meta = modelDataMap.value.get(model.id);
    if (meta && meta.defaultState) {
      // Preserve user-set scale value
      const userScale = hasUserScale ? modelState.settings.scale : undefined;
      Object.assign(modelState.settings, meta.defaultState);
      if (userScale !== undefined) {
        modelState.settings.scale = userScale;
      }
    } else {
      // Preserve user-set scale value
      const userScale = hasUserScale ? modelState.settings.scale : 0.2;
      Object.assign(modelState.settings, {
        scale: userScale,
        position: { x: 0, y: 0 },
        rotation: 0,
        breathing: true,
        eyeBlinking: true,
        interactive: true,
      });
    }
  };

  const addLoadedModel = (modelData, modelInstance) => {
    if (!modelData || !modelData.id) return;
    // Avoid duplicate loading of the same id
    if (loadedModels.value.has(modelData.id)) return;
    // Avoid duplicate loading of the same url
    for (const data of modelDataMap.value.values()) {
      if (modelData.url && data.url === modelData.url) return;
    }
    loadedModels.value.set(modelData.id, modelInstance);
    const fullModelData = {
      id: modelData.id,
      url: modelData.url || "",
      name: modelData.name || modelData.id,
      description: modelData.description || "",
      thumbnail: modelData.thumbnail || "",
      version: modelData.version || "",
      author: modelData.author || "",
      tags: modelData.tags || [],
    };
    modelDataMap.value.set(modelData.id, fullModelData);
  };

  const removeLoadedModel = (id) => {
    loadedModels.value.delete(id);
    modelDataMap.value.delete(id);
  };

  const setModelData = (modelData = {}) => {
    if (!modelData.id) return;
    if (modelDataMap.value.has(modelData.id)) {
      const old = modelDataMap.value.get(modelData.id);
      modelDataMap.value.set(modelData.id, {
        ...old,
        ...modelData,
        name: modelData.name || old.name || modelData.id,
        url: modelData.url || old.url || "",
      });
      return;
    }
    const fullModelData = {
      id: modelData.id,
      url: modelData.url || "",
      name: modelData.name || modelData.id,
      description: modelData.description || "",
      thumbnail: modelData.thumbnail || "",
      version: modelData.version || "",
      author: modelData.author || "",
      tags: modelData.tags || [],
    };
    modelDataMap.value.set(modelData.id, fullModelData);
  };

  const getModelData = (id) => modelDataMap.value.get(id) || null;

  const setLoading = (loading) => {
    isLoading.value = loading;
  };

  const setError = (err) => {
    error.value = err;
  };

  // === State Management API ===
  // Note: State sync logic is handled by state-sync-manager.js
  // This only handles data storage, not sync logic

  /**
   * Update model state data (data storage only, no sync handling)
   * @param {Object} newState - New state data
   */
  const updateModelState = (newState) => {
    try {
      // Only update data storage, no sync logic handling
      // Sync logic is handled by state-sync-manager.js
      if (newState && typeof newState === "object") {
        Object.assign(modelState, newState);
        console.log("📝 [Live2DStore] Model state data updated:", newState);
      }
    } catch (error) {
      log(`Failed to update model state: ${error.message}`, "error");
    }
  };

  /**
   * Get current model state data (returns data only, no sync)
   * @returns {Object} Copy of current state data
   */
  const getCurrentModelState = () => {
    return { ...modelState };
  };

  /**
   * Update settings data (data storage only, no sync handling)
   * @param {Object} settings - New settings data
   */
  const updateSettingsData = (settings) => {
    try {
      // Only update settings data storage, no sync logic handling
      if (settings && typeof settings === "object") {
        Object.assign(modelState.settings || {}, settings);
        console.log("📝 [Live2DStore] Settings data updated:", settings);
      }
    } catch (error) {
      log(`Failed to update settings data: ${error.message}`, "error");
    }
  };

  // Removed duplicate updateSettings method to avoid confusion with the one in live2d-manager.js
  // State sync logic is handled uniformly by state-sync-manager.js

  // AI control related methods
  const handleAIResponse = (aiResponse) => {
    if (!manager.value || !settings.enableAIControl) {
      return;
    }

    manager.value.handleAIResponse(aiResponse);
  };

  const setAIControlEnabled = (enabled) => {
    settings.enableAIControl = enabled;
    if (manager.value) {
      manager.value.setAIControlEnabled(enabled);
    }
  };

  const updateEmotionMapping = (mapping) => {
    Object.assign(settings.emotionMapping, mapping);
  };

  const triggerExpression = (emotionName) => {
    if (!manager.value || !settings.enableAIControl) return;

    const expressionIndex = settings.emotionMapping[emotionName.toLowerCase()];
    if (typeof expressionIndex === "number") {
      const currentModel = manager.value.getCurrentModel();
      if (currentModel) {
        currentModel.setExpression(expressionIndex);
      }
    }
  };

  const triggerMotion = (group, index, priority = "NORMAL") => {
    if (!manager.value) return;

    const currentModel = manager.value.getCurrentModel();
    if (currentModel) {
      // Convert string priority to number
      let numericPriority = 2;
      switch (priority) {
        case "IDLE":
          numericPriority = 1;
          break;
        case "NORMAL":
          numericPriority = 2;
          break;
        case "FORCE":
          numericPriority = 3;
          break;
      }

      currentModel.playMotion(group, index, numericPriority);
    }
  };

  // Getters
  const hasLoadedModels = () => {
    return loadedModels.value.size > 0;
  };

  const getModelById = (id) => loadedModels.value.get(id) || null;

  const getAllModels = () => Array.from(loadedModels.value.values()) || [];

  const getModelByUrl = (url) => {
    for (const [id, modelData] of modelDataMap.value.entries()) {
      if (modelData.url === url) {
        return {
          id,
          model: loadedModels.value.get(id) || null,
          data: modelData,
        };
      }
    }
    return null;
  };

  // Get default model
  const getDefaultModel = () => {
    // First try to get the current model
    if (currentModel.value) {
      return currentModel.value;
    }

    // If there is no current model, try to get the first loaded model
    const models = getAllModels();
    if (models.length > 0) {
      const firstModel = models[0];
      const modelId = firstModel.id || Object.keys(modelDataMap.value)[0];
      if (modelId) {
        return modelDataMap.value.get(modelId);
      }
    }
  };

  return {
    // State
    manager,
    currentModel,
    loadedModels,
    modelDataMap,
    isLoading,
    error,
    settings,
    modelState,

    // Actions
    setManager,
    setCurrentModel,
    addLoadedModel,
    removeLoadedModel,
    setModelData,
    getModelData,
    setLoading,
    setError,
    updateSettingsData,
    updateModelState,

    // AI Control Actions
    handleAIResponse,
    setAIControlEnabled,
    updateEmotionMapping,
    triggerExpression,
    triggerMotion,

    // Getters
    hasLoadedModels,
    getModelById,
    getAllModels,
    getModelByUrl,
    getDefaultModel,

    // Additional Getters
    getCurrentModelState,
  };
});
