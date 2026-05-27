/**
 * useLive2DStore \u2014 Pinia Store: Live2D Model & App State
 *
 * This is the single source of truth for all model-related state that Vue
 * components need to read reactively.
 *
 * State shape (simplified):
 *   manager          \u2014 Live2DManager instance (held here so components don't
 *                       need to import it directly)
 *   currentModel     \u2014 HeroModel | null (the currently displayed model)
 *   loadedModels     \u2014 Map<id, HeroModel> (all models in the PIXI stage)
 *   isLoading        \u2014 true while a model URL is being fetched/parsed
 *   error            \u2014 last load error message (null = no error)
 *   modelState       \u2014 mirror of HeroModel's live parameter/expression state,
 *                       pushed by StateSyncManager (do NOT write to this directly)
 *   settings         \u2014 persistent UI settings (scale, position, audio, etc.)
 *
 * Key actions:
 *   setManager(mgr)         \u2014 called by Live2DViewer.vue on mount; integrates sync
 *   loadModel(url, meta?)   \u2014 main entry point; delegates to manager.loadModel()
 *   unloadModel(id)         \u2014 removes model from stage + store
 *   updateSetting(key, val) \u2014 updates a single model setting + applies to model
 *   updateModelState(state) \u2014 called ONLY by StateSyncManager (not components)
 *
 * Rule: never import PIXI or Cubism types here. All rendering goes through
 * `manager` (Live2DManager) or `globalStateSyncManager`.
 */
import { defineStore } from "pinia";
import { ref, reactive } from "vue";
import { globalStateSyncManager } from "../utils/live2d/state-sync-manager";
import { HeroModel } from "../utils/live2d/hero-model";
import type { Live2DManager } from "../utils/live2d/live2d-manager";

interface ModelMeta {
  id: string;
  url: string;
  name: string;
  description: string;
  thumbnail: string;
  version: string;
  author: string;
  tags: string[];
  defaultState?: Record<string, unknown>;
}

interface EmotionMapping {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  surprised: number;
  fear: number;
  disgust: number;
}

interface ZoomSettings {
  speed: number;
  min: number;
  max: number;
}

interface ModelSettings {
  scale: number;
  position: { x: number; y: number };
  rotation: number;
  breathing: boolean;
  eyeBlinking: boolean;
  interactive: boolean;
  lookAtMouse: boolean;
  wheelZoom: boolean;
  clickInteraction: boolean;
  zoomSettings: ZoomSettings;
  enableAudio: boolean;
  showText: boolean;
  [key: string]: unknown;
}

interface StoreSettings {
  showText: boolean;
  enableAudio: boolean;
  canvasWidth: number;
  canvasHeight: number;
  autoResize: boolean;
  enableAIControl: boolean;
  autoExpression: boolean;
  autoMotion: boolean;
  autoLipSync: boolean;
  textDisplayDuration: number;
  emotionMapping: EmotionMapping;
}

interface ModelStateContainer {
  settings: ModelSettings;
  [key: string]: unknown;
}

/**
 * Motion playback priority (mirrors Cubism SDK priority levels).
 *   IDLE   — plays only if nothing else is playing; lowest priority
 *   NORMAL — interrupts IDLE, plays alongside other NORMAL (default)
 *   FORCE  — interrupts everything; use for user-triggered motions
 */
type Priority = "IDLE" | "NORMAL" | "FORCE";

const log = (message: string, level: "info" | "warn" | "error" | "debug" = "info") => {
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
      if ((window as any).DEBUG_LIVE2D) {
        console.log(`${timestamp} ${prefix} ${message}`);
      }
      break;
    default:
      console.log(`${timestamp} ${prefix} ${message}`);
  }
};

const defaultEmotionMapping: EmotionMapping = {
  neutral: 0,
  happy: 1,
  sad: 2,
  angry: 3,
  surprised: 4,
  fear: 5,
  disgust: 6,
};

const defaultModelSettings: ModelSettings = {
  scale: 0.2,
  position: { x: 0, y: 0 },
  rotation: 0,
  breathing: true,
  eyeBlinking: true,
  interactive: true,
  lookAtMouse: false,
  wheelZoom: true,
  clickInteraction: true,
  zoomSettings: { speed: 0.01, min: 0.01, max: 5.0 },
  enableAudio: true,
  showText: true,
};

const defaultSettings: StoreSettings = {
  showText: true,
  enableAudio: true,
  canvasWidth: 1200,
  canvasHeight: 800,
  autoResize: true,
  enableAIControl: true,
  autoExpression: true,
  autoMotion: true,
  autoLipSync: true,
  textDisplayDuration: 3000,
  emotionMapping: { ...defaultEmotionMapping },
};

export const useLive2DStore = defineStore("live2d", () => {
  const manager = ref<Live2DManager | null>(null);
  const currentModel = ref<HeroModel | null>(null);
  const loadedModels = ref<Map<string, HeroModel>>(new Map<string, HeroModel>());
  const modelDataMap = ref<Map<string, ModelMeta>>(new Map<string, ModelMeta>());
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const settings = reactive<StoreSettings>({ ...defaultSettings, emotionMapping: { ...defaultEmotionMapping } });

  const modelState = reactive<ModelStateContainer>({
    settings: { ...defaultModelSettings },
  });

  /**
   * Register the Live2DManager with the store.
   * Called by Live2DViewer.vue after `live2dManager.init()` completes.
   * Also wires up StateSyncManager so model-state changes push into this store.
   */
  const setManager = (newManager: Live2DManager | null) => {
    manager.value = newManager;

    if (newManager) {
      globalStateSyncManager.integrateWithStore({
        updateModelState,
        getCurrentModelState,
      });
      console.log("🔗 [Live2DStore] State sync manager integrated");
    }
  };

  /**
   * Set the currently focused model.
   * Called by ModelManager after a model finishes loading.
   * Resets `modelState.settings` to defaults (or `meta.defaultState` if available).
   * Passing `null` clears the selection and resets all settings to defaults.
   */
  const setCurrentModel = (model: HeroModel | null) => {
    currentModel.value = model;

    if (manager.value && model?.id) {
      try {
        manager.value.modelManager.setCurrentModel(model.id);
        console.log(
          "🎯 [Live2DStore] Synced current model in model manager:",
          model.id,
        );
      } catch (err) {
        console.error(
          "❌ [Live2DStore] Failed to set current model in model manager:",
          err,
        );
      }
    }

    if (!model) {
      Object.assign(modelState.settings, {
        scale: 0.2,
        position: { x: 0, y: 0 },
        rotation: 0,
        breathing: true,
        eyeBlinking: true,
        interactive: true,
        lookAtMouse: false,
      });
      return;
    }

    const hasUserScale =
      modelState.settings.scale && modelState.settings.scale !== 0.2;

    const meta = modelDataMap.value.get(model.id);
    if (meta?.defaultState) {
      const userScale = hasUserScale ? modelState.settings.scale : undefined;
      Object.assign(modelState.settings, meta.defaultState);
      if (userScale !== undefined) {
        modelState.settings.scale = userScale;
      }
    } else {
      const userScale = hasUserScale ? modelState.settings.scale : 0.2;
      Object.assign(modelState.settings, {
        scale: userScale,
        position: { x: 0, y: 0 },
        rotation: 0,
        breathing: true,
        eyeBlinking: true,
        interactive: true,
        lookAtMouse: false,
      });
    }
  };

  /**
   * Register a newly loaded model in the store.
   * Silently no-ops if the id or url already exists (dedup guard).
   * Called by ModelManager — do not call from components.
   */
  const addLoadedModel = (modelData: Partial<ModelMeta> & { id: string }, modelInstance: HeroModel) => {
    if (!modelData?.id) return;
    if (loadedModels.value.has(modelData.id)) return;
    for (const data of modelDataMap.value.values()) {
      if (modelData.url && data.url === modelData.url) return;
    }
    loadedModels.value.set(modelData.id, modelInstance);
    const fullModelData: ModelMeta = {
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

  /** Remove a model entry from the store maps. Called by ModelManager.removeModel(). */
  const removeLoadedModel = (id: string) => {
    loadedModels.value.delete(id);
    modelDataMap.value.delete(id);
  };

  /** Upsert model metadata (name, url, author, etc.) in modelDataMap. */
  const setModelData = (modelData: Partial<ModelMeta> & { id: string }) => {
    if (!modelData.id) return;
    if (modelDataMap.value.has(modelData.id)) {
      const old = modelDataMap.value.get(modelData.id)!;
      modelDataMap.value.set(modelData.id, {
        ...old,
        ...modelData,
        name: modelData.name || old.name || modelData.id,
        url: modelData.url || old.url || "",
      });
      return;
    }
    const fullModelData: ModelMeta = {
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

  const getModelData = (id: string): ModelMeta | null =>
    modelDataMap.value.get(id) || null;

  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  /**
   * Receive a model state snapshot from StateSyncManager.
   * ⚠️ Do NOT call this from components or UI code.
   * Only StateSyncManager should call this, via `integrateWithStore()`.
   */
  const updateModelState = (newState: Partial<ModelStateContainer>) => {
    try {
      if (newState && typeof newState === "object") {
        Object.assign(modelState, newState);
        console.log("📝 [Live2DStore] Model state data updated:", newState);
      }
    } catch (err: any) {
      log(`Failed to update model state: ${err.message}`, "error");
    }
  };

  const getCurrentModelState = (): ModelStateContainer => {
    return { ...modelState };
  };

  /**
   * Batch-update model settings (scale, position, rotation, etc.).
   * Changes are merged into `modelState.settings` but NOT automatically
   * applied to the PIXI model — callers must also call the appropriate
   * Live2DManager method if real-time application is needed.
   */
  const updateSettingsData = (newSettings: Partial<ModelSettings>) => {
    try {
      if (newSettings && typeof newSettings === "object") {
        Object.assign(modelState.settings, newSettings);
        console.log("📝 [Live2DStore] Settings data updated:", newSettings);
      }
    } catch (err: any) {
      log(`Failed to update settings data: ${err.message}`, "error");
    }
  };

  const handleAIResponse = (aiResponse: unknown) => {
    if (!manager.value || !settings.enableAIControl) {
      return;
    }
    (manager.value as any).handleAIResponse(aiResponse);
  };

  const setAIControlEnabled = (enabled: boolean) => {
    settings.enableAIControl = enabled;
    if (manager.value) {
      (manager.value as any).setAIControlEnabled(enabled);
    }
  };

  const updateEmotionMapping = (mapping: Partial<EmotionMapping>) => {
    Object.assign(settings.emotionMapping, mapping);
  };

  /**
   * Trigger an expression by emotion name (uses `settings.emotionMapping`).
   * Example: `triggerExpression('happy')` → maps to expression index 1 by default.
   * Only works when `settings.enableAIControl` is true.
   */
  const triggerExpression = (emotionName: string) => {
    if (!manager.value || !settings.enableAIControl) return;

    const expressionIndex =
      settings.emotionMapping[emotionName.toLowerCase() as keyof EmotionMapping];
    if (typeof expressionIndex === "number") {
      const curModel = manager.value.getCurrentModel();
      if (curModel) {
        curModel.setExpression(expressionIndex);
      }
    }
  };

  /**
   * Play a motion by group name + index.
   * Example: `triggerMotion('Idle', 0)` plays the first Idle motion.
   * `priority` mirrors Cubism SDK priority (IDLE / NORMAL / FORCE).
   */
  const triggerMotion = (group: string, index: number, _priority: Priority = "NORMAL") => {
    if (!manager.value) return;

    const curModel = manager.value.getCurrentModel();
    if (curModel) {
      curModel.playMotion(group, index);
    }
  };

  const hasLoadedModels = (): boolean => {
    return loadedModels.value.size > 0;
  };

  const getModelById = (id: string): HeroModel | null =>
    (loadedModels.value.get(id) as HeroModel) || null;

  const getAllModels = (): HeroModel[] =>
    Array.from(loadedModels.value.values() as Iterable<HeroModel>);

  const getModelByUrl = (
    url: string,
  ): { id: string; model: HeroModel | null; data: ModelMeta } | null => {
    for (const [id, modelData] of modelDataMap.value.entries()) {
      if (modelData.url === url) {
        return {
          id,
          model: (loadedModels.value.get(id) as HeroModel) || null,
          data: modelData,
        };
      }
    }
    return null;
  };

  const getDefaultModel = (): ModelMeta | undefined => {
    if (currentModel.value) {
      return;
    }

    const models = getAllModels();
    if (models.length > 0) {
      const firstModel = models[0];
      const modelId = firstModel.id || modelDataMap.value.keys().next().value as string;
      if (modelId) {
        return modelDataMap.value.get(modelId);
      }
    }
  };

  return {
    manager,
    currentModel,
    loadedModels,
    modelDataMap,
    isLoading,
    error,
    settings,
    modelState,

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

    handleAIResponse,
    setAIControlEnabled,
    updateEmotionMapping,
    triggerExpression,
    triggerMotion,

    hasLoadedModels,
    getModelById,
    getAllModels,
    getModelByUrl,
    getDefaultModel,

    getCurrentModelState,
  };
});
