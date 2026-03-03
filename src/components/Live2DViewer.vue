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

// Constants
const DEFAULT_MODEL_SCALE = 0.2; // Default model scale value

// Logging utility function
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
            if (window.DEBUG_LIVE2D) {
                console.log(`${timestamp} ${prefix} ${message}`);
            }
            break;
        default:
            console.log(`${timestamp} ${prefix} ${message}`);
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

        // Check if in pet mode
        const isPetMode = () => {
            if (typeof window !== "undefined") {
                return window.location.search.includes("mode=pet");
            }
            return false;
        };
        const petMode = computed(() => isPetMode());

        // Computed properties for safe store state access
        const isLoading = computed(() => live2dStore?.isLoading || false);
        const error = computed(() => live2dStore?.error || null);

        // Pet mode specific configuration
        const petModeConfig = computed(() => {
            if (!petMode.value) return null;

            return {
                // Pet mode specific settings
                autoHide: true, // Auto-hide to system tray
                alwaysOnTop: true, // Always on top
                clickThrough: false, // Click-through
                autoInteraction: true, // Auto interaction
                reducedAnimation: false, // Reduce animation to save performance

                // Interaction optimization
                interaction: {
                    clickSensitivity: 1.2, // Increased click sensitivity
                    hoverResponse: true, // Mouse hover response
                    edgeSnap: true, // Edge snapping
                    autoMove: false, // Auto move
                },

                // Performance optimization
                performance: {
                    maxFPS: 60, // Unified 60 FPS for synchronization
                    minFPS: 60,
                    enableCulling: true,
                    enableBatching: true,
                    textureGCMode: "aggressive", // Aggressive texture garbage collection
                    antialias: false, // Disable antialiasing to save performance
                    powerPreference: "low-power", // Low power mode
                },
            };
        });

        const petModeStyle = computed(() =>
            petMode.value
                ? {
                      background: "transparent",
                      "-webkit-app-region": "drag",
                      position: "absolute",
                      width: "100vw",
                      height: "100vh",
                      pointerEvents: "auto",
                      // Pet mode specific styles
                      zIndex: 9999,
                      userSelect: "none",
                      overflow: "hidden",
                  }
                : {},
        );

        const initLive2D = async () => {
            if (!viewerContainer.value) return;

            try {
                log("Starting Live2D manager initialization...");

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
                const modeConfig =
                    petMode.value && petModeConfig.value
                        ? {
                              textureGCMode:
                                  petModeConfig.value.performance.textureGCMode,
                              antialias:
                                  petModeConfig.value.performance.antialias,
                              powerPreference:
                                  petModeConfig.value.performance
                                      .powerPreference,
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

                const initOptions = {
                    ...baseConfig,
                    ...modeConfig,
                };

                log(
                    "Using config mode:",
                    petMode.value ? "pet mode" : "standard mode",
                );
                log("Base optimization config:", {
                    frameRate: `${initOptions.maxFPS} FPS`,
                    batchSize: initOptions.batchSize,
                    textureUnits: initOptions.maxTextures,
                    webGLDepthBuffer: initOptions.contextAttributes?.depth
                        ? "enabled"
                        : "disabled",
                    webGLStencilBuffer: initOptions.contextAttributes?.stencil
                        ? "enabled"
                        : "disabled",
                    textureGCMode: initOptions.textureGC?.mode,
                    textureGCInterval: `${initOptions.textureGC?.maxIdle / 60} min`,
                });

                await live2dManager.init(initOptions);

                // Store manager in store
                live2dStore.setManager(live2dManager);

                // Pet mode special initialization
                if (petMode.value && petModeConfig.value) {
                    await initPetModeFeatures();
                }

                log("Live2D manager initialized successfully");

                // Output performance optimization info
                log("Performance optimizations enabled:", {
                    webGLOptimization: "depth buffer off, stencil buffer off",
                    batchOptimization: `batch size: ${initOptions.batchSize || "default"}`,
                    textureOptimization: `texture units: ${initOptions.maxTextures || "default"}`,
                    memoryOptimization: "draw buffer not preserved",
                    frameRateSync: "60 FPS unified frame rate",
                });
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
                            console.log(
                                "📐 [Live2DViewer] User-defined scale detected, skipping auto-fit",
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

        // Pet mode special feature initialization
        const initPetModeFeatures = async () => {
            if (!petMode.value || !petModeConfig.value) return;

            log("Initializing pet mode features...");

            // Apply pet mode specific configuration
            if (live2dManager) {
                // Enable auto interaction
                live2dManager.setPetInteraction(true);

                // Apply performance optimizations
                live2dManager.setPerformanceMode("pet");

                log("Pet mode features initialized");
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

        // Pet mode hover handler
        const handlePetModeHover = () => {
            try {
                const model = live2dManager?.getCurrentModel();
                if (model && petModeConfig.value?.interaction?.hoverResponse) {
                    // Trigger hover motion or expression
                    model.playRandomMotion?.();
                    log("🐾 [Live2DViewer] Pet hover response triggered");
                }
            } catch (error) {
                log("❌ [Live2DViewer] Pet hover handler failed:", error);
            }
        };

        const handlePetModeLeave = () => {
            try {
                const model = live2dManager?.getCurrentModel();
                if (model && petModeConfig.value?.interaction?.hoverResponse) {
                    // Optionally trigger on-leave motion
                    log("🐾 [Live2DViewer] Pet hover leave");
                }
            } catch (error) {
                log("❌ [Live2DViewer] Pet leave handler failed:", error);
            }
        };

        // Pet mode auto-interaction
        let petModeAutoInteractionTimer = null;
        const startPetModeAutoInteraction = () => {
            try {
                if (petModeAutoInteractionTimer) {
                    clearInterval(petModeAutoInteractionTimer);
                }

                // Trigger auto interaction every 30-60 seconds
                const intervalTime = 30000 + Math.random() * 30000; // 30-60 seconds random
                petModeAutoInteractionTimer =
                    globalResourceManager.registerTimer(
                        setInterval(() => {
                            const model = live2dManager?.getCurrentModel();
                            if (model && petModeConfig.value?.autoInteraction) {
                                // Randomly trigger motion or expression
                                if (Math.random() > 0.5) {
                                    model.playRandomMotion?.();
                                } else {
                                    model.playRandomExpression?.();
                                }
                                console.log(
                                    "🐾 [Live2DViewer] Pet auto-interaction triggered",
                                );
                            }
                        }, intervalTime),
                    );

                console.log(
                    "✅ [Live2DViewer] Pet auto-interaction started, interval:",
                    Math.round(intervalTime / 1000),
                    "s",
                );
            } catch (error) {
                console.error(
                    "❌ [Live2DViewer] Failed to start pet auto-interaction:",
                    error,
                );
            }
        };

        const stopPetModeAutoInteraction = () => {
            if (petModeAutoInteractionTimer) {
                clearInterval(petModeAutoInteractionTimer);
                petModeAutoInteractionTimer = null;
                console.log("🛑 [Live2DViewer] Pet auto-interaction stopped");
            }
        };

        // Safely apply current settings to the newly loaded model
        const applyCurrentSettingsToModel = async (heroModel, modelId) => {
            try {
                if (!heroModel || !live2dStore.modelState?.settings) {
                    console.log(
                        "📝 [Live2DViewer] No current settings or invalid model, skipping settings apply",
                    );
                    return;
                }

                const settings = live2dStore.modelState.settings;
                console.log(
                    "⚙️ [Live2DViewer] Applying current settings to new model:",
                    settings,
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
                    console.log(
                        "⚙️ [Live2DViewer] Zoom settings applied:",
                        settings.zoomSettings,
                    );
                }

                console.log("✅ [Live2DViewer] Settings applied to new model");
            } catch (error) {
                console.error(
                    "❌ [Live2DViewer] Failed to apply settings to model:",
                    error,
                );
                // Do not rethrow, to avoid disrupting the model load flow
            }
        };

        // Handle WebSocket Live2D model config updates
        const handleLive2DModelConfig = (event) => {
            try {
                const { modelInfo, confName, confUid } = event.detail;
                console.log(
                    "📨 [Live2DViewer] Received Live2D model config update:",
                    modelInfo,
                );

                if (!live2dManager || !modelInfo) return;

                const currentModel = live2dManager.getCurrentModel();
                if (!currentModel) {
                    console.warn(
                        "⚠️ [Live2DViewer] No model currently loaded, cannot apply config",
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
                        console.log(
                            "✅ [Live2DViewer] Model tap interaction config updated",
                        );
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
                console.error(
                    "❌ [Live2DViewer] Failed to handle Live2D model config:",
                    error,
                );
            }
        };

        // Safe Store synchronization method
        const syncSettingToStore = (settingKey, value) => {
            try {
                if (!live2dStore.modelState) {
                    console.log(
                        "📝 [Live2DViewer] Store state not initialized, skipping sync",
                    );
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

                console.log(
                    "✅ [Live2DViewer] Setting synced to Store and state manager:",
                    settingKey,
                    value,
                );
            } catch (error) {
                console.error("❌ [Live2DViewer] Store sync failed:", error);
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

                    console.log(
                        "🔄 [Live2DViewer] Model state received from state sync manager and synced to Store:",
                        modelId,
                        currentState,
                    );
                },
            );

            console.log(
                "📝 [Live2DViewer] Model state sync registered:",
                modelId,
            );
        };

        const unregisterModelStateSync = (modelId) => {
            if (!modelId) return;

            globalStateSyncManager.unregisterSyncCallback(modelId);
            console.log(
                "🗑️ [Live2DViewer] Model state sync unregistered:",
                modelId,
            );
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
                            if (timer) clearTimeout(timer);
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
                                    console.warn(
                                        "⚠️ [Live2D API] No model currently loaded",
                                    );
                                    return false;
                                }

                                if (
                                    typeof scale !== "number" ||
                                    scale <= 0 ||
                                    scale > 5
                                ) {
                                    console.warn(
                                        "⚠️ [Live2D API] Invalid scale value, must be between 0 and 5:",
                                        scale,
                                    );
                                    return false;
                                }

                                // Apply to model
                                model.setScale(scale);

                                // Sync to Store and state manager via syncSettingToStore
                                syncSettingToStore("scale", scale);

                                console.log(
                                    "✅ [Live2D API] Model scale set:",
                                    scale,
                                );
                                return true;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to set scale:",
                                    error,
                                );
                                return false;
                            }
                        },

                        // Set model position
                        setPosition: (x, y) => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    console.warn(
                                        "⚠️ [Live2D API] No model currently loaded",
                                    );
                                    return false;
                                }

                                if (
                                    typeof x !== "number" ||
                                    typeof y !== "number"
                                ) {
                                    console.warn(
                                        "⚠️ [Live2D API] Invalid position values:",
                                        x,
                                        y,
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

                                console.log(
                                    "✅ [Live2D API] Model position set:",
                                    clampedX,
                                    clampedY,
                                );
                                return true;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to set position:",
                                    error,
                                );
                                return false;
                            }
                        },

                        // Play specified motion
                        playMotion: (group, index = 0, priority = 2) => {
                            try {
                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    console.warn(
                                        "⚠️ [Live2D API] No model currently loaded",
                                    );
                                    return false;
                                }

                                if (!group || typeof group !== "string") {
                                    console.warn(
                                        "⚠️ [Live2D API] Invalid motion group name:",
                                        group,
                                    );
                                    return false;
                                }

                                model.playMotion(group, index, priority);
                                console.log(
                                    "✅ [Live2D API] Playing motion:",
                                    group,
                                    index,
                                );
                                return true;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to play motion:",
                                    error,
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
                                console.error(
                                    "❌ [Live2D API] Failed to get manager status:",
                                    error,
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
                                console.error(
                                    "❌ [Live2D API] Failed to get motion list:",
                                    error,
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
                                console.error(
                                    "❌ [Live2D API] Failed to get expression list:",
                                    error,
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

                                console.log(
                                    "🔍 [Live2D API] Interactivity status check:",
                                    status,
                                );
                                return status;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to check interactivity status:",
                                    error,
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
                                console.log(
                                    `✅ [Live2D API] Wheel zoom ${enabled ? "enabled" : "disabled"}`,
                                );
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to set wheel zoom:",
                                    error,
                                );
                            }
                        },

                        // === Pet mode specific API ===

                        // Get pet mode status
                        getPetModeStatus: () => {
                            try {
                                return {
                                    enabled: petMode.value,
                                    config: petModeConfig.value,
                                    isActive:
                                        petMode.value &&
                                        !!live2dManager?.getCurrentModel(),
                                };
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to get pet mode status:",
                                    error,
                                );
                                return null;
                            }
                        },

                        // Pet mode interaction control
                        setPetInteraction: (enabled) => {
                            try {
                                if (!petMode.value) {
                                    console.warn(
                                        "⚠️ [Live2D API] Not in pet mode",
                                    );
                                    return false;
                                }

                                const model = live2dManager.getCurrentModel();
                                if (!model) {
                                    console.warn(
                                        "⚠️ [Live2D API] No model currently loaded",
                                    );
                                    return false;
                                }

                                // Set interaction state
                                model.setInteractive(Boolean(enabled));

                                // Sync to Store
                                syncSettingToStore(
                                    "interactive",
                                    Boolean(enabled),
                                );

                                console.log(
                                    "✅ [Live2D API] Pet interaction set:",
                                    enabled ? "enabled" : "disabled",
                                );
                                return true;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to set pet interaction:",
                                    error,
                                );
                                return false;
                            }
                        },

                        // Pet mode performance optimization control
                        setPetPerformanceMode: (mode) => {
                            try {
                                if (!petMode.value) {
                                    console.warn(
                                        "⚠️ [Live2D API] Not in pet mode",
                                    );
                                    return false;
                                }

                                if (!live2dManager) {
                                    console.warn(
                                        "⚠️ [Live2D API] Live2D manager is not initialized",
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
                                    console.warn(
                                        "⚠️ [Live2D API] Invalid performance mode:",
                                        mode,
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

                                console.log(
                                    "✅ [Live2D API] Pet performance mode set:",
                                    mode,
                                    settings,
                                );
                                return true;
                            } catch (error) {
                                console.error(
                                    "❌ [Live2D API] Failed to set pet performance mode:",
                                    error,
                                );
                                return false;
                            }
                        },
                    };

                    console.log("✅ [Live2DViewer] Global Live2D API mounted");
                }

                // Register WebSocket event listener
                window.addEventListener(
                    "websocket:live2d-model-config",
                    handleLive2DModelConfig,
                );
                console.log(
                    "✅ [Live2DViewer] WebSocket event listener registered",
                );

                // Show resource manager status in development environment
                if (import.meta.env.DEV) {
                    console.log(
                        "📊 [Live2DViewer] Resource manager status:",
                        globalResourceManager.getResourceCount(),
                    );
                }
            }); // end initLive2D().then()
        }); // end onMounted()

        onUnmounted(() => {
            console.log(
                "🧹 [Live2DViewer] Component unmounting, starting Live2D manager cleanup",
            );

            try {
                // 0a. Disconnect ResizeObserver
                if (resizeObserver) {
                    resizeObserver.disconnect();
                    resizeObserver = null;
                    console.log(
                        "🧹 [Live2DViewer] ResizeObserver disconnected",
                    );
                }

                // 0b. Remove visibility change listener
                if (visibilityHandler) {
                    document.removeEventListener(
                        "visibilitychange",
                        visibilityHandler,
                    );
                    visibilityHandler = null;
                    console.log(
                        "🧹 [Live2DViewer] Visibility change listener removed",
                    );
                }

                // 1. Clean up pet mode resources
                if (petMode.value) {
                    console.log(
                        "🧹 [Live2DViewer] Cleaning up pet mode resources...",
                    );

                    // Stop auto interaction
                    stopPetModeAutoInteraction();

                    // Clean up hover event listeners (if registered)
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
                            console.log(
                                "🧹 [Live2DViewer] Pet hover event listeners cleaned up",
                            );
                        } catch (error) {
                            console.error(
                                "❌ [Live2DViewer] Failed to clean up pet hover events:",
                                error,
                            );
                        }
                    }

                    console.log(
                        "🧹 [Live2DViewer] Pet mode resources cleaned up",
                    );
                }

                // 2. Clean up Live2D manager
                if (live2dManager) {
                    console.log(
                        "🧹 [Live2DViewer] Destroying Live2D manager...",
                    );
                    try {
                        live2dManager.destroy();
                        console.log(
                            "✅ [Live2DViewer] Live2D manager destroyed",
                        );
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
                        console.log(
                            "🧹 [Live2DViewer] Global live2d object cleaned up",
                        );
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
                    console.log(
                        "🧹 [Live2DViewer] WebSocket event listener cleaned up",
                    );
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up WebSocket event listener:",
                        error,
                    );
                }

                // 5. Clean up state sync manager
                try {
                    if (globalStateSyncManager) {
                        // globalStateSyncManager exposes cleanup(), not destroy()
                        globalStateSyncManager.cleanup();
                        console.log(
                            "🧹 [Live2DViewer] State sync manager cleaned up",
                        );
                    }
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up state sync manager:",
                        error,
                    );
                }

                // 6. Clean up all resources registered in resource manager
                try {
                    globalResourceManager.cleanupAll();
                    console.log(
                        "✅ [Live2DViewer] All resources in resource manager cleaned up",
                    );
                } catch (error) {
                    console.error(
                        "❌ [Live2DViewer] Failed to clean up resource manager:",
                        error,
                    );
                }

                console.log(
                    "✅ [Live2DViewer] Component unmount cleanup complete",
                );
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
