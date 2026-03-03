<template>
    <div
        ref="viewerContainer"
        class="live2d-viewer"
        id="viewer-place"
        :style="petModeStyle"
    >
        <!-- Loading State Indicator -->
        <div v-if="isLoading" class="loading-overlay">
            <n-spin size="large">
                <template #description>
                    <n-text>Loading model...</n-text>
                </template>
            </n-spin>
        </div>

        <!-- Error State Indicator -->
        <div v-if="error" class="error-overlay">
            <n-result
                status="error"
                title="Model Loading Failed"
                :description="error"
            >
                <template #footer>
                    <n-space>
                        <n-button @click="retryLoadModel" type="primary">
                            Retry
                        </n-button>
                        <n-button @click="clearError" quaternary>
                            Clear Error
                        </n-button>
                    </n-space>
                </template>
            </n-result>
        </div>

        <!-- PIXI app will render here -->

        <!-- Text Container -->
        <div id="text-container" class="text-container"></div>
    </div>
</template>

<script>
import {
    ref,
    onMounted,
    onUnmounted,
    nextTick,
    computed,
    shallowRef,
} from "vue";
import { useLive2DStore } from "../stores/live2d";
import { Live2DManager } from "../utils/live2d/index.js";

import { globalStateSyncManager } from "../utils/live2d/state-sync-manager.js";
import { globalResourceManager } from "../utils/resource-manager.js";
import {
    isPetMode as _isPetMode,
    getPetModeConfig,
    getPetModeStyle,
    handlePetModeHover as _handlePetModeHover,
    handlePetModeLeave as _handlePetModeLeave,
    createPetModeAutoInteraction,
    initPetModeFeatures as _initPetModeFeatures,
    getPetModeStatus,
} from "../utils/live2d/pet-mode.js";

// Constants
const DEFAULT_MODEL_SCALE = 0.2; // Default model scale value

// Logging utility function
// - "error" / "warn"  → always emitted (console.error / console.warn)
// - "debug" / "info"  → only in DEV or when window.DEBUG_LIVE2D is set
const __VIEWER_DEV__ = import.meta.env.DEV;
const log = (message, level = "info") => {
    const prefix = "[Live2DViewer]";
    const timestamp = new Date().toISOString();

    switch (level) {
        case "error":
            console.error(`${timestamp} ${prefix} ${message}`);
            break;
        case "warn":
            console.warn(`${timestamp} ${prefix} ${message}`);
            break;
        case "debug":
            if (__VIEWER_DEV__ || window.DEBUG_LIVE2D) {
                console.debug(`${timestamp} ${prefix} ${message}`);
            }
            break;
        default:
            // "info" — only emit in dev / when debug flag is on
            if (__VIEWER_DEV__ || window.DEBUG_LIVE2D) {
                console.log(`${timestamp} ${prefix} ${message}`);
            }
            break;
    }
};

export default {
    setup() {
        const viewerContainer = ref(null);
        const live2dStore = useLive2DStore();
        let live2dManager = null;

        // ResizeObserver for responsive canvas
        let resizeObserver = null;

        // Visibility-based render pausing
        let visibilityHandler = null;

        // Pet mode — delegated entirely to the pet-mode.js helper module.
        const petMode = computed(() => _isPetMode());
        const petModeConfig = computed(() => getPetModeConfig());
        const petModeStyle = computed(() => getPetModeStyle());

        // Computed properties for safe store state access
        const isLoading = computed(() => live2dStore?.isLoading || false);
        const error = computed(() => live2dStore?.error || null);

        const initLive2D = async () => {
            if (!viewerContainer.value) return;

            try {
                log("Starting Live2D manager initialization...", "debug");

                // Create Live2D manager instance
                live2dManager = new Live2DManager(viewerContainer.value);

                // Base configuration
                const baseConfig = {
                    maxFPS: 60,
                    minFPS: 60,
                    enableCulling: true,
                    enableBatching: true,
                    contextAttributes: {
                        alpha: true,
                        depth: false,
                        stencil: false,
                        premultipliedAlpha: false,
                        preserveDrawingBuffer: false,
                    },
                };

                // Select mode-specific configuration
                const cfg = petModeConfig.value;
                const modeConfig = cfg
                    ? {
                          textureGCMode: cfg.performance.textureGCMode,
                          antialias: cfg.performance.antialias,
                          powerPreference: cfg.performance.powerPreference,
                          transparent: true,
                          preserveDrawingBuffer: false,
                          clearBeforeRender: false,
                          contextAttributes: {
                              ...baseConfig.contextAttributes,
                              antialias: false,
                          },
                          batchSize: 4096,
                          maxTextures: 16,
                          textureGC: {
                              mode: "aggressive",
                              maxIdle: 15 * 60,
                              checkInterval: 30,
                          },
                      }
                    : {
                          textureGCMode: "auto",
                          antialias: true,
                          powerPreference: "high-performance",
                          batchSize: 8192,
                          maxTextures: 32,
                          textureGC: {
                              mode: "auto",
                              maxIdle: 30 * 60,
                              checkInterval: 60,
                          },
                      };

                const initOptions = { ...baseConfig, ...modeConfig };

                log(
                    `Using config mode: ${petMode.value ? "pet" : "standard"} | FPS: ${initOptions.maxFPS} | batch: ${initOptions.batchSize} | textures: ${initOptions.maxTextures}`,
                    "debug",
                );

                await live2dManager.init(initOptions);

                // ── WebGL context loss / restore callbacks ──
                // The core manager now detects context loss events on the
                // canvas and exposes two callbacks we can hook into so the
                // application layer can react (pause UI, show message, etc.)
                if (live2dManager.coreManager) {
                    live2dManager.coreManager.onContextLost = () => {
                        log(
                            "⚠️ WebGL context was lost — rendering paused",
                            "warn",
                        );
                        live2dStore.setError(
                            "WebGL context lost. Waiting for recovery…",
                        );
                    };

                    live2dManager.coreManager.onContextRestored = () => {
                        log(
                            "✅ WebGL context restored — resuming rendering",
                            "info",
                        );
                        live2dStore.setError(null);

                        // After context restore PIXI re-uploads textures
                        // automatically, but we nudge a resize so the
                        // projection matrix is recalculated correctly.
                        if (viewerContainer.value) {
                            const w = viewerContainer.value.clientWidth;
                            const h = viewerContainer.value.clientHeight;
                            if (w > 0 && h > 0) {
                                live2dManager.coreManager.resize(w, h);
                            }
                        }
                    };

                    log(
                        "🛡️ WebGL context loss/restore callbacks registered",
                        "debug",
                    );
                }

                // Store manager in store
                live2dStore.setManager(live2dManager);

                // Pet mode special initialization (delegated to pet-mode.js)
                if (petMode.value) {
                    _initPetModeFeatures(live2dManager);
                }

                log("Live2D manager initialized successfully", "debug");
            } catch (error) {
                log(
                    `Live2D Viewer initialization failed: ${error.message}`,
                    "error",
                );
                live2dStore.setError(error.message);
            }
        };

        const loadModel = async (modelData) => {
            if (!live2dManager) {
                const errorMsg = "Live2D Manager is not initialized";
                log(errorMsg, "error");
                live2dStore.setError(errorMsg);
                return false;
            }

            if (!modelData || !modelData.id || !modelData.url) {
                const errorMsg =
                    "Invalid model data: missing required id or url fields";
                log(errorMsg, "error");
                live2dStore.setError(errorMsg);
                return false;
            }

            let heroModel = null;
            let initTimeout = null;

            try {
                log("Starting model load", "debug");

                // Set loading state
                live2dStore.setLoading(true);
                live2dStore.setError(null);

                // Check if model is already loaded
                const currentModel = live2dManager.getCurrentModel();
                if (currentModel && currentModel.id === modelData.id) {
                    log(
                        `Model already loaded, skipping: ${modelData.id}`,
                        "debug",
                    );
                    live2dStore.setLoading(false);
                    return true;
                }

                // Load model
                heroModel =
                    await live2dManager.modelManager.loadModel(modelData);

                // Wait for model initialization
                await new Promise((resolve, reject) => {
                    initTimeout = globalResourceManager.registerTimer(
                        setTimeout(() => {
                            reject(new Error("Model initialization timed out"));
                        }, 30000),
                    );

                    const checkModel = () => {
                        if (heroModel?.model?.internalModel) {
                            clearTimeout(initTimeout);
                            resolve();
                        } else if (heroModel?.model) {
                            heroModel.model.once("ready", () => {
                                clearTimeout(initTimeout);
                                resolve();
                            });
                            heroModel.model.once("error", (error) => {
                                clearTimeout(initTimeout);
                                reject(error);
                            });
                        } else {
                            reject(new Error("Model instance is invalid"));
                        }
                    };

                    checkModel();
                });

                // Bind interaction events
                log(
                    `Binding model interaction events: ${modelData.id}`,
                    "debug",
                );
                if (live2dManager.interactionManager) {
                    live2dManager.interactionManager.bindModelInteractionEvents(
                        modelData.id,
                        heroModel,
                    );
                }

                // Add model to store
                live2dStore.addLoadedModel(modelData, heroModel);
                // Switch current model
                live2dStore.setCurrentModel(modelData);

                // Set loading complete state
                live2dStore.setLoading(false);

                // Ensure all states are updated
                await nextTick();

                // Safely apply current settings to newly loaded model
                await applyCurrentSettingsToModel(heroModel, modelData.id);

                // Register model state sync
                registerModelStateSync(modelData.id, heroModel);

                // Auto-fit to canvas size
                if (viewerContainer.value) {
                    const canvasWidth = viewerContainer.value.clientWidth;
                    const canvasHeight = viewerContainer.value.clientHeight;
                    if (canvasWidth > 0 && canvasHeight > 0) {
                        // Check if user has already set a custom scale value
                        const currentScale = heroModel.getScale();
                        const hasUserScale =
                            currentScale &&
                            ((typeof currentScale === "object" &&
                                (currentScale.x !== DEFAULT_MODEL_SCALE ||
                                    currentScale.y !== DEFAULT_MODEL_SCALE)) ||
                                (typeof currentScale === "number" &&
                                    currentScale !== DEFAULT_MODEL_SCALE));

                        if (!hasUserScale) {
                            // Only auto-fit if no user scale has been set
                            heroModel.autoFitToCanvas(
                                canvasWidth,
                                canvasHeight,
                                0.8,
                            );
                            heroModel.setPosition(
                                canvasWidth / 2,
                                canvasHeight / 2,
                            );
                        } else {
                            log(
                                "User-defined scale detected, skipping auto-fit",
                                "debug",
                            );
                        }
                    }
                }

                log(`Model loaded successfully: ${modelData.id}`);
                return true;
            } catch (error) {
                log(`Model load failed: ${error.message}`, "error");
                live2dStore.setError(error.message || "Model load failed");
                live2dStore.setLoading(false);

                // Clean up resources
                if (initTimeout) {
                    clearTimeout(initTimeout);
                }

                if (heroModel?.model) {
                    try {
                        // Remove event listeners
                        heroModel.model.removeAllListeners();
                        // Destroy model
                        heroModel.model.destroy({
                            children: true,
                            texture: true,
                            baseTexture: true,
                        });
                    } catch (cleanupError) {
                        log(
                            `Error cleaning up failed model: ${cleanupError.message}`,
                            "error",
                        );
                    }
                }

                return false;
            }
        };

        const removeModel = (modelId) => {
            if (!live2dManager) {
                log("Live2D Manager is not initialized", "warn");
                return false;
            }

            try {
                log(`Removing model: ${modelId}`, "debug");

                // Unregister state sync
                unregisterModelStateSync(modelId);

                // Use Live2DManager's removeModel method
                live2dManager.removeModel(modelId);

                // Remove model from store
                live2dStore.removeLoadedModel(modelId);

                // If removing the current model, clear current model
                if (live2dStore.currentModel?.id === modelId) {
                    live2dStore.setCurrentModel(null);
                }

                log(`Model removed successfully: ${modelId}`);
                return true;
            } catch (error) {
                log(`Failed to remove model: ${error.message}`, "error");
                return false;
            }
        };

        // Retry loading model
        const retryLoadModel = async () => {
            if (live2dStore.currentModel) {
                log("Retrying model load", "debug");
                await loadModel(live2dStore.currentModel);
            }
        };

        // Clear error state
        const clearError = () => {
            live2dStore.setError(null);
        };

        // Pet mode event handlers — delegated to pet-mode.js
        const handlePetModeHover = () =>
            _handlePetModeHover(live2dManager?.getCurrentModel() ?? null);
        const handlePetModeLeave = () =>
            _handlePetModeLeave(live2dManager?.getCurrentModel() ?? null);

        // Pet mode auto-interaction — managed via the pet-mode.js controller
        const petAutoInteract = createPetModeAutoInteraction();
        const startPetModeAutoInteraction = () =>
            petAutoInteract.start(() => live2dManager?.getCurrentModel());
        const stopPetModeAutoInteraction = () => petAutoInteract.stop();

        // Safely apply current settings to the newly loaded model
        const applyCurrentSettingsToModel = async (heroModel, modelId) => {
            try {
                if (!heroModel || !live2dStore.modelState?.settings) {
                    log(
                        "No current settings or invalid model, skipping settings apply",
                        "debug",
                    );
                    return;
                }

                const settings = live2dStore.modelState.settings;
                log(
                    `Applying current settings to new model: ${JSON.stringify(settings)}`,
                    "debug",
                );

                // Safely apply basic settings
                if (typeof settings.scale === "number" && settings.scale > 0) {
                    const clampedScale = Math.max(
                        0.01,
                        Math.min(1, settings.scale),
                    );
                    heroModel.setScale(clampedScale);
                }

                if (typeof settings.rotation === "number") {
                    const clampedRotation = Math.max(
                        0,
                        Math.min(360, settings.rotation),
                    );
                    heroModel.setAngle(clampedRotation);
                }

                // Apply boolean settings (use defaults as fallback)
                heroModel.setBreathing(
                    settings.breathing !== undefined
                        ? Boolean(settings.breathing)
                        : true,
                );
                heroModel.setEyeBlinking(
                    settings.eyeBlinking !== undefined
                        ? Boolean(settings.eyeBlinking)
                        : true,
                );
                heroModel.setInteractive(
                    settings.interactive !== undefined
                        ? Boolean(settings.interactive)
                        : true,
                );

                // Apply interaction settings
                if (live2dManager && typeof settings.wheelZoom === "boolean") {
                    live2dManager.setWheelZoomEnabled(settings.wheelZoom);
                }

                // Apply zoom settings
                if (live2dManager && settings.zoomSettings) {
                    log(
                        `Zoom settings applied: ${JSON.stringify(settings.zoomSettings)}`,
                        "debug",
                    );
                }

                log("Settings applied to new model", "debug");
            } catch (error) {
                log(
                    `Failed to apply settings to model: ${error.message}`,
                    "error",
                );
                // Do not rethrow, to avoid disrupting the model load flow
            }
        };

        // Handle WebSocket Live2D model config updates
        const handleLive2DModelConfig = (event) => {
            try {
                const { modelInfo, confName, confUid } = event.detail;
                log(
                    `Received Live2D model config update: ${JSON.stringify(modelInfo)}`,
                    "debug",
                );

                if (!live2dManager || !modelInfo) return;

                const currentModel = live2dManager.getCurrentModel();
                if (!currentModel) {
                    log(
                        "No model currently loaded, cannot apply config",
                        "warn",
                    );
                    return;
                }

                // Safely apply model configuration
                if (modelInfo.tapMotions) {
                    // Update tap interaction config
                    const modelId =
                        live2dManager.modelManager.getModelId(currentModel);
                    if (modelId && live2dManager.interactionManager) {
                        live2dManager.interactionManager.setModelTapMotions(
                            modelId,
                            modelInfo.tapMotions,
                        );
                        log("Model tap interaction config updated", "debug");
                    }
                }

                // Update model data in store
                const modelId =
                    live2dManager.modelManager.getModelId(currentModel);
                if (modelId) {
                    const existingData =
                        live2dStore.getModelData(modelId) || {};
                    live2dStore.setModelData(modelId, {
                        ...existingData,
                        ...modelInfo,
                        confName,
                        confUid,
                    });
                }
            } catch (error) {
                log(
                    `Failed to handle Live2D model config: ${error.message}`,
                    "error",
                );
            }
        };

        // Safe Store synchronization method
        const syncSettingToStore = (settingKey, value) => {
            try {
                if (!live2dStore.modelState) {
                    log("Store state not initialized, skipping sync", "debug");
                    return;
                }

                const currentSettings = live2dStore.modelState.settings || {};
                const updatedSettings = { ...currentSettings };

                // Safely update based on setting type
                switch (settingKey) {
                    case "scale":
                        updatedSettings.scale = value;
                        break;
                    case "position":
                        updatedSettings.positionX = value.x;
                        updatedSettings.positionY = value.y;
                        break;
                    case "rotation":
                        updatedSettings.rotation = value;
                        break;
                    default:
                        updatedSettings[settingKey] = value;
                }

                // Update Store
                live2dStore.updateModelState({
                    ...live2dStore.modelState,
                    settings: updatedSettings,
                });

                // Also sync to state sync manager
                const model = live2dManager?.getCurrentModel();
                const modelId = live2dManager?.modelManager?.getModelId(model);
                if (modelId && model) {
                    globalStateSyncManager.syncUISettingsToModel(
                        modelId,
                        model,
                        { [settingKey]: value },
                    );
                }

                log(
                    `Setting synced to Store and state manager: ${settingKey} = ${JSON.stringify(value)}`,
                    "debug",
                );
            } catch (error) {
                log(`Store sync failed: ${error.message}`, "error");
                // Do not rethrow, to avoid disrupting API functionality
            }
        };

        // State sync manager integration
        const registerModelStateSync = (modelId, heroModel) => {
            if (!modelId || !heroModel) return;

            // Register sync callback to monitor model state changes
            globalStateSyncManager.registerSyncCallback(
                modelId,
                (currentState) => {
                    if (!currentState) return;

                    // Sync model state back to Store
                    // Assumes currentState contains a settings object compatible with live2dStore.modelState.settings
                    // and that globalStateSyncManager has an internal mechanism to prevent circular sync
                    live2dStore.updateModelState({
                        ...live2dStore.modelState,
                        settings: {
                            ...(live2dStore.modelState?.settings || {}), // Preserve existing settings
                            ...(currentState.settings || {}), // Override with latest settings from model
                        },
                    });

                    log(
                        `Model state synced to Store from state sync manager: ${modelId}`,
                        "debug",
                    );
                },
            );

            log(`Model state sync registered: ${modelId}`, "debug");
        };

        const unregisterModelStateSync = (modelId) => {
            if (!modelId) return;

            globalStateSyncManager.unregisterSyncCallback(modelId);
            log(`Model state sync unregistered: ${modelId}`, "debug");
        };

        const validateModelStateConsistency = (
            modelId,
            heroModel,
            expectedState,
        ) => {
            if (!modelId || !heroModel || !expectedState) return null;

            return globalStateSyncManager.validateStateConsistency(
                modelId,
                heroModel,
                expectedState,
            );
        };

        onMounted(() => {
            initLive2D().then(() => {
                // ── ResizeObserver: auto-resize PIXI renderer on container resize ──
                if (viewerContainer.value && live2dManager?.coreManager?.app) {
                    const debounceResize = (() => {
                        let timer = null;
                        return (fn, delay) => {
                            if (timer !== null) clearTimeout(timer);
                            timer = setTimeout(fn, delay);
                        };
                    })();

                    resizeObserver = new ResizeObserver((entries) => {
                        debounceResize(() => {
                            for (const entry of entries) {
                                const { width, height } = entry.contentRect;
                                if (
                                    width > 0 &&
                                    height > 0 &&
                                    live2dManager?.coreManager?.app
                                ) {
                                    live2dManager.coreManager.resize(
                                        width,
                                        height,
                                    );
                                    log(
                                        `📐 Canvas resized to ${Math.round(width)}×${Math.round(height)}`,
                                        "debug",
                                    );
                                }
                            }
                        }, 150);
                    });
                    resizeObserver.observe(viewerContainer.value);
                    log("📐 ResizeObserver attached to viewer container");
                }

                // ── Page Visibility: pause ticker when tab is hidden ──
                visibilityHandler = () => {
                    const app = live2dManager?.coreManager?.app;
                    if (!app) return;

                    if (document.hidden) {
                        app.ticker.stop();
                        log("⏸️ Tab hidden — PIXI ticker paused", "debug");
                    } else {
                        app.ticker.start();
                        log("▶️ Tab visible — PIXI ticker resumed", "debug");
                    }
                };
                document.addEventListener(
                    "visibilitychange",
                    visibilityHandler,
                );
                log("👁️ Visibility change listener registered");

                // Mount live2dManager main methods globally
                if (live2dManager) {
                    window.live2d = {
                        // === Existing methods (kept for backward compatibility) ===
                        speak: (...args) =>
                            live2dManager.getCurrentModel()?.speak?.(...args),
                        expression: (...args) =>
                            live2dManager
                                .getCurrentModel()
                                ?.expression?.(...args),
                        setExpression: (...args) =>
                            live2dManager
                                .getCurrentModel()
                                ?.setExpression?.(...args),
                        playRandomMotion: (...args) =>
                            live2dManager
                                .getCurrentModel()
                                ?.playRandomMotion?.(...args),

                        // === New safe API methods ===

                        // Get model info
                        getModelInfo: () => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) return null;

                                return {
                                    id: live2dManager.modelManager.getModelId(
                                        model,
                                    ),
                                    expressions: model.getExpressions?.() || [],
                                    motions: model.getMotions?.() || {},
                                    isLoaded: true,
                                    scale: model.model?.scale?.x || 1,
                                    position: {
                                        x: model.model?.x || 0,
                                        y: model.model?.y || 0,
                                    },
                                };
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to get model info:",
                                    error,
                                );
                                return null;
                            }
                        },

                        // Set model scale
                        setScale: (scale) => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    log("No model currently loaded", "warn");
                                    return false;
                                }

                                if (
                                    typeof scale !== "number" ||
                                    scale <= 0 ||
                                    scale > 5
                                ) {
                                    log(
                                        `Invalid scale value (must be 0–5): ${scale}`,
                                        "warn",
                                    );
                                    return false;
                                }

                                // Apply to model
                                model.setScale(scale);

                                // Sync to Store and state manager via syncSettingToStore
                                syncSettingToStore("scale", scale);

                                log(`Model scale set: ${scale}`, "debug");
                                return true;
                            } catch (error) {
                                log(
                                    `Failed to set scale: ${error.message}`,
                                    "error",
                                );
                                return false;
                            }
                        },

                        // Set model position
                        setPosition: (x, y) => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    log("No model currently loaded", "warn");
                                    return false;
                                }

                                if (
                                    typeof x !== "number" ||
                                    typeof y !== "number"
                                ) {
                                    log(
                                        `Invalid position values: x=${x}, y=${y}`,
                                        "warn",
                                    );
                                    return false;
                                }

                                const clampedX = Math.max(
                                    -1000,
                                    Math.min(1000, x),
                                );
                                const clampedY = Math.max(
                                    -1000,
                                    Math.min(1000, y),
                                );

                                // Apply to model
                                model.setPosition(clampedX, clampedY);

                                // Sync to Store and state manager via syncSettingToStore
                                syncSettingToStore("position", {
                                    x: clampedX,
                                    y: clampedY,
                                });

                                log(
                                    `Model position set: (${clampedX}, ${clampedY})`,
                                    "debug",
                                );
                                return true;
                            } catch (error) {
                                log(
                                    `Failed to set position: ${error.message}`,
                                    "error",
                                );
                                return false;
                            }
                        },

                        // Play specified motion
                        playMotion: (group, index = 0, priority = 2) => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    log("No model currently loaded", "warn");
                                    return false;
                                }

                                if (!group || typeof group !== "string") {
                                    log(
                                        `Invalid motion group name: ${group}`,
                                        "warn",
                                    );
                                    return false;
                                }

                                model.playMotion(group, index, priority);
                                log(
                                    `Playing motion: ${group}[${index}]`,
                                    "debug",
                                );
                                return true;
                            } catch (error) {
                                log(
                                    `Failed to play motion: ${error.message}`,
                                    "error",
                                );
                                return false;
                            }
                        },

                        // Get manager status
                        getManagerStatus: () => {
                            try {
                                return {
                                    isInitialized: live2dManager.isInitialized,
                                    hasModel: !!live2dManager.getCurrentModel(),
                                    modelCount:
                                        live2dManager.getAllModelIds().length,
                                    currentModelId:
                                        live2dManager.modelManager
                                            .currentModelId,
                                };
                            } catch (error) {
                                log(
                                    `Failed to get manager status: ${error.message}`,
                                    "error",
                                );
                                return null;
                            }
                        },

                        // Get all available motion groups
                        getAvailableMotions: () => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) return {};

                                return model.getMotions?.() || {};
                            } catch (error) {
                                log(
                                    `Failed to get motion list: ${error.message}`,
                                    "error",
                                );
                                return {};
                            }
                        },

                        // Get all available expressions
                        getAvailableExpressions: () => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) return [];

                                return model.getExpressions?.() || [];
                            } catch (error) {
                                log(
                                    `Failed to get expression list: ${error.message}`,
                                    "error",
                                );
                                return [];
                            }
                        },

                        // === Debug and diagnostics API ===

                        // Check interactivity status
                        checkInteractivity: () => {
                            try {
                                const app = live2dManager?.coreManager?.app;
                                const model = live2dManager?.getCurrentModel();
                                const canvas =
                                    document.getElementById("live2d-canvas");

                                const status = {
                                    pixiApp: {
                                        exists: !!app,
                                        stageInteractive:
                                            app?.stage?.interactive,
                                        stageInteractiveChildren:
                                            app?.stage?.interactiveChildren,
                                        stageEventMode: app?.stage?.eventMode,
                                        pixiVersion:
                                            window.PIXI?.VERSION || "unknown",
                                    },
                                    model: {
                                        exists: !!model,
                                        interactive: model?.model?.interactive,
                                        buttonMode: model?.model?.buttonMode,
                                        eventMode: model?.model?.eventMode,
                                        cursor: model?.model?.cursor,
                                        hasEventListeners:
                                            !!model?.model?._events,
                                    },
                                    canvas: {
                                        exists: !!canvas,
                                        pointerEvents:
                                            canvas?.style?.pointerEvents,
                                        touchAction: canvas?.style?.touchAction,
                                        userSelect: canvas?.style?.userSelect,
                                        hasDirectListeners: canvas
                                            ? Object.keys(canvas).filter(
                                                  (key) => key.startsWith("on"),
                                              ).length > 0
                                            : false,
                                    },
                                    manager: {
                                        initialized:
                                            live2dManager?.isInitialized,
                                        hasInteractionManager:
                                            !!live2dManager?.interactionManager,
                                        hasCoreManager:
                                            !!live2dManager?.coreManager,
                                    },
                                };

                                log(
                                    `Interactivity status: ${JSON.stringify(status)}`,
                                    "debug",
                                );
                                return status;
                            } catch (error) {
                                log(
                                    `Failed to check interactivity status: ${error.message}`,
                                    "error",
                                );
                                return null;
                            }
                        },

                        // === Zoom settings API ===

                        // Set wheel zoom enabled state
                        setWheelZoomEnabled: (enabled) => {
                            try {
                                live2dManager?.setWheelZoomEnabled(
                                    Boolean(enabled),
                                );
                                log(
                                    `Wheel zoom ${enabled ? "enabled" : "disabled"}`,
                                    "debug",
                                );
                            } catch (error) {
                                log(
                                    `Failed to set wheel zoom: ${error.message}`,
                                    "error",
                                );
                            }
                        },

                        // === Pet mode specific API ===

                        // Get pet mode status
                        getPetModeStatus: () => {
                            try {
                                return getPetModeStatus(petAutoInteract);
                            } catch (error) {
                                log(
                                    `Failed to get pet mode status: ${error.message}`,
                                    "error",
                                );
                                return null;
                            }
                        },

                        // Pet mode interaction control
                        setPetInteraction: (enabled) => {
                            try {
                                if (!petMode.value) {
                                    log("Not in pet mode", "warn");
                                    return false;
                                }

                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    log("No model currently loaded", "warn");
                                    return false;
                                }

                                // Set interaction state
                                model.setInteractive(Boolean(enabled));

                                // Sync to Store
                                syncSettingToStore(
                                    "interactive",
                                    Boolean(enabled),
                                );

                                log(
                                    `Pet interaction ${enabled ? "enabled" : "disabled"}`,
                                    "debug",
                                );
                                return true;
                            } catch (error) {
                                log(
                                    `Failed to set pet interaction: ${error.message}`,
                                    "error",
                                );
                                return false;
                            }
                        },

                        // Pet mode performance optimization control
                        setPetPerformanceMode: (mode) => {
                            try {
                                if (!petMode.value) {
                                    log("Not in pet mode", "warn");
                                    return false;
                                }

                                if (!live2dManager) {
                                    log(
                                        "Live2D manager is not initialized",
                                        "warn",
                                    );
                                    return false;
                                }

                                // Adjust performance settings based on mode
                                const performanceSettings = {
                                    low: { maxFPS: 15, minFPS: 10 },
                                    normal: { maxFPS: 30, minFPS: 15 },
                                    high: { maxFPS: 60, minFPS: 30 },
                                };

                                const settings = performanceSettings[mode];
                                if (!settings) {
                                    log(
                                        `Invalid performance mode: ${mode}`,
                                        "warn",
                                    );
                                    return false;
                                }

                                // Apply performance settings (if supported by manager)
                                if (live2dManager.coreManager?.pixiApp) {
                                    const app =
                                        live2dManager.coreManager.pixiApp;
                                    app.ticker.maxFPS = settings.maxFPS;
                                    app.ticker.minFPS = settings.minFPS;
                                }

                                log(
                                    `Pet performance mode set: ${mode} (maxFPS=${settings.maxFPS})`,
                                    "debug",
                                );
                                return true;
                            } catch (error) {
                                log(
                                    `Failed to set pet performance mode: ${error.message}`,
                                    "error",
                                );
                                return false;
                            }
                        },
                    };

                    log("Global Live2D API mounted", "debug");
                }

                // Register WebSocket event listener
                window.addEventListener(
                    "websocket:live2d-model-config",
                    handleLive2DModelConfig,
                );
                log("WebSocket event listener registered", "debug");

                // Show resource manager status in development environment
                if (import.meta.env.DEV) {
                    log(
                        `Resource manager status: ${JSON.stringify(globalResourceManager.getResourceCount())}`,
                        "debug",
                    );
                }
            }); // end initLive2D().then()
        }); // end onMounted()

        onUnmounted(() => {
            log(
                "Component unmounting, starting Live2D manager cleanup",
                "debug",
            );

            try {
                // 0a. Disconnect ResizeObserver
                if (resizeObserver) {
                    resizeObserver.disconnect();
                    resizeObserver = null;
                    log("ResizeObserver disconnected", "debug");
                }

                // 0b. Remove visibility change listener
                if (visibilityHandler) {
                    document.removeEventListener(
                        "visibilitychange",
                        visibilityHandler,
                    );
                    visibilityHandler = null;
                    log("Visibility change listener removed", "debug");
                }

                // 1. Clean up pet mode resources
                if (petMode.value) {
                    stopPetModeAutoInteraction();

                    if (viewerContainer.value) {
                        try {
                            viewerContainer.value.removeEventListener(
                                "mouseenter",
                                handlePetModeHover,
                            );
                            viewerContainer.value.removeEventListener(
                                "mouseleave",
                                handlePetModeLeave,
                            );
                        } catch (error) {
                            console.error(
                                "❌ [Live2DViewer] Failed to clean up pet hover events:",
                                error,
                            );
                        }
                    }
                    log("Pet mode resources cleaned up", "debug");
                }

                // 2. Clean up Live2D manager
                if (live2dManager) {
                    try {
                        live2dManager.destroy();
                        log("Live2D manager destroyed", "debug");
                    } catch (error) {
                        console.error(
                            "❌ [Live2DViewer] Failed to destroy Live2D manager:",
                            error,
                        );
                    }
                    live2dManager = null;
                }

                // 3. Clean up global live2d object
                if (window.live2d) {
                    try {
                        delete window.live2d;
                        log("Global live2d object cleaned up", "debug");
                    } catch (error) {
                        console.error(
                            "❌ [Live2DViewer] Failed to clean up global live2d object:",
                            error,
                        );
                    }
                }

                // 4. Clean up WebSocket event listener
                try {
                    window.removeEventListener(
                        "websocket:live2d-model-config",
                        handleLive2DModelConfig,
                    );
                    log("WebSocket event listener cleaned up", "debug");
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up WebSocket event listener:",
                        error,
                    );
                }

                // 5. Clean up state sync manager
                try {
                    globalStateSyncManager.cleanup();
                    log("State sync manager cleaned up", "debug");
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up state sync manager:",
                        error,
                    );
                }

                // 6. Clean up all resources registered in resource manager
                try {
                    globalResourceManager.cleanupAll();
                    log(
                        "All resources in resource manager cleaned up",
                        "debug",
                    );
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up resource manager:",
                        error,
                    );
                }

                log("Component unmount cleanup complete", "debug");
            } catch (error) {
                console.error(
                    "❌ [Live2DViewer] Component unmount cleanup failed:",
                    error,
                );
            }
        });

        return {
            viewerContainer,
            petModeStyle,
            retryLoadModel,
            clearError,
            isLoading,
            error,
            loadModel,
        };
    },
};
</script>

<style scoped>
.live2d-viewer {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: transparent; /* removed !important */
}

:deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto; /* removed !important */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

/* Text container styles */
.text-container {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: auto;
    max-width: 80%;
    pointer-events: none;
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* Text content styles */
.text-container :deep(.text-content) {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    margin: 0 auto;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 16px;
    line-height: 1.5;
    max-width: 800px;
    word-wrap: break-word;
    text-align: center;
    box-shadow: 0 2px 6px rgba(255, 255, 255, 0.1);
    text-shadow: 0 1px 3px rgba(255, 255, 255, 0.2);
    display: block;
    position: relative;
}

/* Loading state indicator styles */
.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

/* Error state indicator styles */
.error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
</style>
