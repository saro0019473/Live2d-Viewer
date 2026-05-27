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

<script setup lang="ts">
/**
 * Live2DViewer.vue — Canvas Host & Manager Lifecycle
 *
 * This is the bridge between Vue and the Live2D rendering engine.
 * The PIXI canvas is mounted directly inside `viewerContainer` (the root div).
 *
 * Responsibilities:
 *   - Creates and owns `live2dManager` (Live2DManager instance)
 *   - Calls `live2dManager.init()` on mount, `live2dManager.destroy()` on unmount
 *   - Registers the manager with `live2dStore.setManager()` so the store can
 *     delegate model load/unload calls to the manager
 *   - Handles ResizeObserver to keep the canvas sized correctly
 *   - Handles Page Visibility API to pause/resume rendering when tab is hidden
 *   - Applies Pet Mode styling (CSS position: fixed, transparent bg)
 *
 * Pet Mode:
 *   Activated when URL contains `?mode=pet`. Pet mode functions come from
 *   `pet-mode.ts` and control overlay behavior (always-on-top emulation,
 *   click-through, auto-interaction). Electron shell uses this mode.
 *
 * Signal flow:
 *   App.vue                                 (layout)
 *     └─ Live2DViewer.vue                    (canvas + manager)
 *           ├─ live2dStore.setManager()       (hand off manager reference)
 *           └─ globalStateSyncManager          (model state → store)
 */
import {
    ref,
    onMounted,
    onUnmounted,
    nextTick,
    computed,
} from "vue";
import { useLive2DStore } from "../stores/live2d";
import { Live2DManager } from "../utils/live2d/index";
import { globalStateSyncManager } from "../utils/live2d/state-sync-manager";
import { globalResourceManager } from "../utils/resource-manager";
import {
    isPetMode as _isPetMode,
    getPetModeConfig,
    getPetModeStyle,
    handlePetModeHover as _handlePetModeHover,
    handlePetModeLeave as _handlePetModeLeave,
    createPetModeAutoInteraction,
    initPetModeFeatures as _initPetModeFeatures,
    getPetModeStatus,
} from "../utils/live2d/pet-mode";
import type { HeroModel } from "../utils/live2d/hero-model";

const DEFAULT_MODEL_SCALE = 0.2;

const __VIEWER_DEV__ = import.meta.env.DEV;
type LogLevel = "error" | "warn" | "debug" | "info";

const log = (message: string, level: LogLevel = "info") => {
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
            if (__VIEWER_DEV__ || (window as any).DEBUG_LIVE2D) {
                console.debug(`${timestamp} ${prefix} ${message}`);
            }
            break;
        default:
            if (__VIEWER_DEV__ || (window as any).DEBUG_LIVE2D) {
                console.log(`${timestamp} ${prefix} ${message}`);
            }
            break;
    }
};

const viewerContainer = ref<HTMLElement | null>(null);
const live2dStore = useLive2DStore();
let live2dManager: Live2DManager | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibilityHandler: (() => void) | null = null;

const petMode = computed(() => _isPetMode());
const petModeConfig = computed(() => getPetModeConfig());
const petModeStyle = computed(() => getPetModeStyle());

const isLoading = computed(() => live2dStore.isLoading || false);
const error = computed(() => live2dStore.error || null);

const initLive2D = async () => {
    if (!viewerContainer.value) return;

    try {
        log("Starting Live2D manager initialization...", "debug");

        const pixiGlobal = (window as any).PIXI;
        if (pixiGlobal?.live2d?.config) {
            pixiGlobal.live2d.config.sound = false;
            pixiGlobal.live2d.config.motionSync = false;
            log("🔇 pixi-live2d built-in sound disabled (audio handled externally)", "debug");
        }

        live2dManager = new Live2DManager(viewerContainer.value);

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

        const cfg = petModeConfig.value as any;
        const modeConfig = cfg
            ? {
                  textureGCMode: cfg.performance.textureGCMode,
                  antialias: cfg.performance.antialias,
                  powerPreference: cfg.performance.powerPreference,
                  transparent: true,
                  preserveDrawingBuffer: false,
                  clearBeforeRender: false,
                  contextAttributes: { ...baseConfig.contextAttributes, antialias: false },
                  batchSize: 4096,
                  maxTextures: 16,
                  textureGC: { mode: "aggressive", maxIdle: 15 * 60, checkInterval: 30 },
              }
            : {
                  textureGCMode: "auto",
                  antialias: true,
                  powerPreference: "high-performance",
                  batchSize: 8192,
                  maxTextures: 32,
                  textureGC: { mode: "auto", maxIdle: 30 * 60, checkInterval: 60 },
              };

        const initOptions = { ...baseConfig, ...modeConfig };

        log(`Using config mode: ${petMode.value ? "pet" : "standard"} | FPS: ${initOptions.maxFPS} | batch: ${initOptions.batchSize} | textures: ${initOptions.maxTextures}`, "debug");

        await live2dManager.init(initOptions);

        if (live2dManager.coreManager) {
            live2dManager.coreManager.onContextLost = () => {
                log("⚠️ WebGL context was lost — rendering paused", "warn");
                live2dStore.setError("WebGL context lost. Waiting for recovery…");
            };

            live2dManager.coreManager.onContextRestored = () => {
                log("✅ WebGL context restored — resuming rendering", "info");
                live2dStore.setError(null);
                if (viewerContainer.value && live2dManager?.coreManager) {
                    const w = viewerContainer.value.clientWidth;
                    const h = viewerContainer.value.clientHeight;
                    if (w > 0 && h > 0) {
                        live2dManager.coreManager.resize(w, h);
                    }
                }
            };
            log("🛡️ WebGL context loss/restore callbacks registered", "debug");
        }

        live2dStore.setManager(live2dManager);

        if (petMode.value) {
            _initPetModeFeatures(live2dManager);
        }

        log("Live2D manager initialized successfully", "debug");
    } catch (err: any) {
        log(`Live2D Viewer initialization failed: ${err.message}`, "error");
        live2dStore.setError(err.message);
    }
};

interface ModelDataInput {
    id: string;
    url: string;
    [key: string]: unknown;
}

const loadModel = async (modelData: ModelDataInput): Promise<boolean> => {
    if (!live2dManager) {
        const errorMsg = "Live2D Manager is not initialized";
        log(errorMsg, "error");
        live2dStore.setError(errorMsg);
        return false;
    }

    if (!modelData || !modelData.id || !modelData.url) {
        const errorMsg = "Invalid model data: missing required id or url fields";
        log(errorMsg, "error");
        live2dStore.setError(errorMsg);
        return false;
    }

    let heroModel: HeroModel | null = null;
    let initTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
        log("Starting model load", "debug");

        live2dStore.setLoading(true);
        live2dStore.setError(null);

        const currentModel = live2dManager.getCurrentModel();
        if (currentModel && currentModel.id === modelData.id) {
            log(`Model already loaded, skipping: ${modelData.id}`, "debug");
            live2dStore.setLoading(false);
            return true;
        }

        heroModel = await live2dManager.modelManager.loadModel(modelData);

        await new Promise<void>((resolve, reject) => {
            initTimeout = globalResourceManager.registerTimer(
                setTimeout(() => {
                    reject(new Error("Model initialization timed out"));
                }, 30000),
            ) as unknown as ReturnType<typeof setTimeout>;

            const checkModel = () => {
                if (heroModel?.model?.internalModel) {
                    clearTimeout(initTimeout!);
                    resolve();
                } else if (heroModel?.model) {
                    (heroModel.model as any).once("ready", () => {
                        clearTimeout(initTimeout!);
                        resolve();
                    });
                    (heroModel.model as any).once("error", (err: Error) => {
                        clearTimeout(initTimeout!);
                        reject(err);
                    });
                } else {
                    reject(new Error("Model instance is invalid"));
                }
            };

            checkModel();
        });

        log(`Binding model interaction events: ${modelData.id}`, "debug");
        if (live2dManager.interactionManager) {
            live2dManager.interactionManager.bindModelInteractionEvents(modelData.id, heroModel);
        }

        live2dStore.addLoadedModel(modelData as any, heroModel);
        live2dStore.setCurrentModel(modelData as any);
        live2dStore.setLoading(false);

        await nextTick();

        await applyCurrentSettingsToModel(heroModel, modelData.id);
        registerModelStateSync(modelData.id, heroModel);

        if (viewerContainer.value) {
            const canvasWidth = viewerContainer.value.clientWidth;
            const canvasHeight = viewerContainer.value.clientHeight;
            if (canvasWidth > 0 && canvasHeight > 0) {
                const currentScale = heroModel.getScale();
                const hasUserScale =
                    currentScale &&
                    ((typeof currentScale === "object" &&
                        (currentScale.x !== DEFAULT_MODEL_SCALE || currentScale.y !== DEFAULT_MODEL_SCALE)) ||
                        (typeof currentScale === "number" && currentScale !== DEFAULT_MODEL_SCALE));

                if (!hasUserScale) {
                    heroModel.autoFitToCanvas(canvasWidth, canvasHeight, 0.8);
                    heroModel.setPosition(canvasWidth / 2, canvasHeight / 2);
                } else {
                    log("User-defined scale detected, skipping auto-fit", "debug");
                }
            }
        }

        log(`Model loaded successfully: ${modelData.id}`);
        return true;
    } catch (err: any) {
        log(`Model load failed: ${err.message}`, "error");
        live2dStore.setError(err.message || "Model load failed");
        live2dStore.setLoading(false);

        if (initTimeout) {
            clearTimeout(initTimeout);
        }

        if (heroModel?.model) {
            try {
                (heroModel.model as any).removeAllListeners();
                (heroModel.model as any).destroy({ children: true, texture: true, baseTexture: true });
            } catch (cleanupErr: any) {
                log(`Error cleaning up failed model: ${cleanupErr.message}`, "error");
            }
        }

        return false;
    }
};

const removeModel = (modelId: string): boolean => {
    if (!live2dManager) {
        log("Live2D Manager is not initialized", "warn");
        return false;
    }

    try {
        log(`Removing model: ${modelId}`, "debug");
        unregisterModelStateSync(modelId);
        live2dManager.removeModel(modelId);
        live2dStore.removeLoadedModel(modelId);

        if (live2dStore.currentModel?.id === modelId) {
            live2dStore.setCurrentModel(null);
        }

        log(`Model removed successfully: ${modelId}`);
        return true;
    } catch (err: any) {
        log(`Failed to remove model: ${err.message}`, "error");
        return false;
    }
};

const retryLoadModel = async () => {
    if (live2dStore.currentModel) {
        log("Retrying model load", "debug");
        await loadModel(live2dStore.currentModel as unknown as ModelDataInput);
    }
};

const clearError = () => {
    live2dStore.setError(null);
};

const handlePetModeHover = () =>
    _handlePetModeHover(live2dManager?.getCurrentModel() ?? null);
const handlePetModeLeave = () =>
    _handlePetModeLeave(live2dManager?.getCurrentModel() ?? null);

const petAutoInteract = createPetModeAutoInteraction();
const startPetModeAutoInteraction = () =>
    petAutoInteract.start(() => live2dManager?.getCurrentModel());
const stopPetModeAutoInteraction = () => petAutoInteract.stop();

const applyCurrentSettingsToModel = async (heroModel: HeroModel, _modelId: string) => {
    try {
        if (!heroModel || !live2dStore.modelState?.settings) {
            log("No current settings or invalid model, skipping settings apply", "debug");
            return;
        }

        const settings = live2dStore.modelState.settings;
        log(`Applying current settings to new model: ${JSON.stringify(settings)}`, "debug");

        if (typeof settings.scale === "number" && settings.scale > 0) {
            const clampedScale = Math.max(0.01, Math.min(1, settings.scale));
            heroModel.setScale(clampedScale);
        }

        if (typeof settings.rotation === "number") {
            const clampedRotation = Math.max(0, Math.min(360, settings.rotation));
            heroModel.setAngle(clampedRotation);
        }

        heroModel.setBreathing(settings.breathing !== undefined ? Boolean(settings.breathing) : true);
        heroModel.setEyeBlinking(settings.eyeBlinking !== undefined ? Boolean(settings.eyeBlinking) : true);

        if (live2dManager) {
            const dragEnabled = settings.interactive !== undefined ? Boolean(settings.interactive) : true;
            live2dManager.setDragEnabled(dragEnabled);
        }

        if (live2dManager && typeof settings.lookAtMouse === "boolean") {
            live2dManager.setLookAtMouseEnabled(settings.lookAtMouse);
        }

        if (live2dManager && typeof settings.wheelZoom === "boolean") {
            live2dManager.setWheelZoomEnabled(settings.wheelZoom);
        }

        if (live2dManager && settings.zoomSettings) {
            log(`Zoom settings applied: ${JSON.stringify(settings.zoomSettings)}`, "debug");
        }

        log("Settings applied to new model", "debug");
    } catch (err: any) {
        log(`Failed to apply settings to model: ${err.message}`, "error");
    }
};

const handleLive2DModelConfig = (event: Event) => {
    try {
        const detail = (event as CustomEvent).detail || {};
        const { modelInfo, confName, confUid } = detail;
        log(`Received Live2D model config update: ${JSON.stringify(modelInfo)}`, "debug");

        if (!live2dManager || !modelInfo) return;

        const currentModel = live2dManager.getCurrentModel();
        if (!currentModel) {
            log("No model currently loaded, cannot apply config", "warn");
            return;
        }

        if (modelInfo.tapMotions) {
            const modelId = live2dManager.modelManager.getModelId(currentModel);
            if (modelId && live2dManager.interactionManager) {
                (live2dManager.interactionManager as any).setModelTapMotions(modelId, modelInfo.tapMotions);
                log("Model tap interaction config updated", "debug");
            }
        }

        const modelId = live2dManager.modelManager.getModelId(currentModel);
        if (modelId) {
            const existingData = live2dStore.getModelData(modelId) || {};
            live2dStore.setModelData({
                ...existingData,
                ...modelInfo,
                confName,
                confUid,
            } as any);
        }
    } catch (err: any) {
        log(`Failed to handle Live2D model config: ${err.message}`, "error");
    }
};

const syncSettingToStore = (settingKey: string, value: unknown) => {
    try {
        if (!live2dStore.modelState) {
            log("Store state not initialized, skipping sync", "debug");
            return;
        }

        const currentSettings = { ...live2dStore.modelState.settings };
        const updatedSettings: Record<string, unknown> = { ...currentSettings };

        switch (settingKey) {
            case "scale":
                updatedSettings.scale = value;
                break;
            case "position":
                updatedSettings.positionX = (value as { x: number; y: number }).x;
                updatedSettings.positionY = (value as { x: number; y: number }).y;
                break;
            case "rotation":
                updatedSettings.rotation = value;
                break;
            default:
                updatedSettings[settingKey] = value;
        }

        live2dStore.updateModelState({
            ...live2dStore.modelState,
            settings: updatedSettings as any,
        });

        const model = live2dManager?.getCurrentModel();
        const modelId = (model && live2dManager) ? live2dManager.modelManager.getModelId(model) : undefined;
        if (modelId && model) {
            globalStateSyncManager.syncUISettingsToModel(modelId, model, { [settingKey]: value });
        }

        log(`Setting synced to Store and state manager: ${settingKey} = ${JSON.stringify(value)}`, "debug");
    } catch (err: any) {
        log(`Store sync failed: ${err.message}`, "error");
    }
};

const registerModelStateSync = (modelId: string, _heroModel: HeroModel) => {
    if (!modelId) return;

    globalStateSyncManager.registerSyncCallback(modelId, (currentState: any) => {
        if (!currentState) return;

        live2dStore.updateModelState({
            ...live2dStore.modelState,
            settings: {
                ...(live2dStore.modelState?.settings || {}),
                ...(currentState.settings || {}),
            },
        } as any);

        log(`Model state synced to Store from state sync manager: ${modelId}`, "debug");
    });

    log(`Model state sync registered: ${modelId}`, "debug");
};

const unregisterModelStateSync = (modelId: string) => {
    if (!modelId) return;

    globalStateSyncManager.unregisterSyncCallback(modelId);
    log(`Model state sync unregistered: ${modelId}`, "debug");
};

const validateModelStateConsistency = (
    modelId: string,
    heroModel: HeroModel,
    expectedState: any,
) => {
    if (!modelId || !heroModel || !expectedState) return null;

    return globalStateSyncManager.validateStateConsistency(modelId, heroModel, expectedState);
};

onMounted(() => {
    initLive2D().then(() => {
        if (viewerContainer.value && live2dManager?.coreManager?.app) {
            const debounceResize = (() => {
                let timer: ReturnType<typeof setTimeout> | null = null;
                return (fn: () => void, delay: number) => {
                    if (timer !== null) clearTimeout(timer);
                    timer = setTimeout(fn, delay);
                };
            })();

            resizeObserver = new ResizeObserver((entries) => {
                debounceResize(() => {
                    for (const entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (width > 0 && height > 0 && live2dManager?.coreManager?.app) {
                            live2dManager.coreManager.resize(width, height);
                            log(`📐 Canvas resized to ${Math.round(width)}×${Math.round(height)}`, "debug");
                        }
                    }
                }, 150);
            });
            resizeObserver.observe(viewerContainer.value);
            log("📐 ResizeObserver attached to viewer container");
        }

        visibilityHandler = () => {
            const app = (live2dManager?.coreManager as any)?.app as { ticker?: { stop: () => void; start: () => void } } | undefined;
            if (!app) return;

            if (document.hidden) {
                app.ticker?.stop();
                log("⏸️ Tab hidden — PIXI ticker paused", "debug");
            } else {
                app.ticker?.start();
                log("▶️ Tab visible — PIXI ticker resumed", "debug");
            }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
        log("👁️ Visibility change listener registered");

        if (live2dManager) {
            (window as any).live2d = {
                speak: (...args: any[]) =>
                    (live2dManager!.getCurrentModel() as any)?.speak?.(...args),
                expression: (...args: any[]) =>
                    (live2dManager!.getCurrentModel() as any)?.expression?.(...args),
                setExpression: (...args: any[]) =>
                    (live2dManager!.getCurrentModel() as any)?.setExpression?.(...args),
                playRandomMotion: (...args: any[]) =>
                    (live2dManager!.getCurrentModel() as any)?.playRandomMotion?.(...args),

                getModelInfo: () => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) return null;
                        return {
                            id: live2dManager!.modelManager.getModelId(model),
                            expressions: (model as any).getExpressions?.() || [],
                            motions: (model as any).getMotions?.() || {},
                            isLoaded: true,
                            scale: (model.model as any)?.scale?.x || 1,
                            position: { x: (model.model as any)?.x || 0, y: (model.model as any)?.y || 0 },
                        };
                    } catch (err) {
                        console.error("❌ [Live2D API] Failed to get model info:", err);
                        return null;
                    }
                },

                setScale: (scale: number) => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) { log("No model currently loaded", "warn"); return false; }
                        if (typeof scale !== "number" || scale <= 0 || scale > 5) {
                            log(`Invalid scale value (must be 0–5): ${scale}`, "warn");
                            return false;
                        }
                        model.setScale(scale);
                        syncSettingToStore("scale", scale);
                        log(`Model scale set: ${scale}`, "debug");
                        return true;
                    } catch (err: any) { log(`Failed to set scale: ${err.message}`, "error"); return false; }
                },

                setPosition: (x: number, y: number) => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) { log("No model currently loaded", "warn"); return false; }
                        if (typeof x !== "number" || typeof y !== "number") {
                            log(`Invalid position values: x=${x}, y=${y}`, "warn");
                            return false;
                        }
                        const clampedX = Math.max(-1000, Math.min(1000, x));
                        const clampedY = Math.max(-1000, Math.min(1000, y));
                        model.setPosition(clampedX, clampedY);
                        syncSettingToStore("position", { x: clampedX, y: clampedY });
                        log(`Model position set: (${clampedX}, ${clampedY})`, "debug");
                        return true;
                    } catch (err: any) { log(`Failed to set position: ${err.message}`, "error"); return false; }
                },

                playMotion: (group: string, index = 0, priority = 2) => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) { log("No model currently loaded", "warn"); return false; }
                        if (!group || typeof group !== "string") {
                            log(`Invalid motion group name: ${group}`, "warn");
                            return false;
                        }
                        (model as any).playMotion(group, index, priority);
                        log(`Playing motion: ${group}[${index}]`, "debug");
                        return true;
                    } catch (err: any) { log(`Failed to play motion: ${err.message}`, "error"); return false; }
                },

                getManagerStatus: () => {
                    try {
                        return {
                            isInitialized: live2dManager!.isInitialized,
                            hasModel: !!live2dManager!.getCurrentModel(),
                            modelCount: live2dManager!.getAllModelIds().length,
                            currentModelId: live2dManager!.modelManager.currentModelId,
                        };
                    } catch (err: any) { log(`Failed to get manager status: ${err.message}`, "error"); return null; }
                },

                getAvailableMotions: () => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) return {};
                        return (model as any).getMotions?.() || {};
                    } catch (err: any) { log(`Failed to get motion list: ${err.message}`, "error"); return {}; }
                },

                getAvailableExpressions: () => {
                    try {
                        const model = live2dManager!.getCurrentModel();
                        if (!model) return [];
                        return (model as any).getExpressions?.() || [];
                    } catch (err: any) { log(`Failed to get expression list: ${err.message}`, "error"); return []; }
                },

                checkInteractivity: () => {
                    try {
                        const app = (live2dManager?.coreManager as any)?.app;
                        const model = live2dManager?.getCurrentModel();
                        const canvas = document.getElementById("live2d-canvas");
                        return {
                            pixiApp: {
                                exists: !!app,
                                stageInteractive: app?.stage?.interactive,
                                stageInteractiveChildren: app?.stage?.interactiveChildren,
                                stageEventMode: app?.stage?.eventMode,
                                pixiVersion: (window as any).PIXI?.VERSION || "unknown",
                            },
                            model: {
                                exists: !!model,
                                interactive: (model as any)?.model?.interactive,
                                buttonMode: (model as any)?.model?.buttonMode,
                                eventMode: (model as any)?.model?.eventMode,
                                cursor: (model as any)?.model?.cursor,
                                hasEventListeners: !!(model as any)?.model?._events,
                            },
                            canvas: {
                                exists: !!canvas,
                                pointerEvents: canvas?.style?.pointerEvents,
                                touchAction: canvas?.style?.touchAction,
                                userSelect: canvas?.style?.userSelect,
                                hasDirectListeners: canvas
                                    ? Object.keys(canvas).filter((key) => key.startsWith("on")).length > 0
                                    : false,
                            },
                            manager: {
                                initialized: live2dManager?.isInitialized,
                                hasInteractionManager: !!live2dManager?.interactionManager,
                                hasCoreManager: !!live2dManager?.coreManager,
                            },
                        };
                    } catch (err: any) { log(`Failed to check interactivity status: ${err.message}`, "error"); return null; }
                },

                setWheelZoomEnabled: (enabled: boolean) => {
                    try {
                        live2dManager?.setWheelZoomEnabled(Boolean(enabled));
                        log(`Wheel zoom ${enabled ? "enabled" : "disabled"}`, "debug");
                    } catch (err: any) { log(`Failed to set wheel zoom: ${err.message}`, "error"); }
                },

                setPetInteraction: (enabled: boolean) => {
                    try {
                        if (!petMode.value) { log("Not in pet mode", "warn"); return false; }
                        const model = live2dManager!.getCurrentModel();
                        if (!model) { log("No model currently loaded", "warn"); return false; }
                        (model as any).setInteractive(Boolean(enabled));
                        syncSettingToStore("interactive", Boolean(enabled));
                        log(`Pet interaction ${enabled ? "enabled" : "disabled"}`, "debug");
                        return true;
                    } catch (err: any) { log(`Failed to set pet interaction: ${err.message}`, "error"); return false; }
                },

                setPetPerformanceMode: (mode: string) => {
                    try {
                        if (!petMode.value) { log("Not in pet mode", "warn"); return false; }
                        if (!live2dManager) { log("Live2D manager is not initialized", "warn"); return false; }
                        const perfModes: Record<string, { maxFPS: number; minFPS: number }> = {
                            low: { maxFPS: 15, minFPS: 10 },
                            normal: { maxFPS: 30, minFPS: 15 },
                            high: { maxFPS: 60, minFPS: 30 },
                        };
                        const perf = perfModes[mode];
                        if (!perf) { log(`Invalid performance mode: ${mode}`, "warn"); return false; }
                        const pixiApp = (live2dManager.coreManager as any)?.pixiApp as { ticker: { maxFPS: number; minFPS: number } } | undefined;
                        if (pixiApp) {
                            pixiApp.ticker.maxFPS = perf.maxFPS;
                            pixiApp.ticker.minFPS = perf.minFPS;
                        }
                        log(`Pet performance mode set: ${mode} (maxFPS=${perf.maxFPS})`, "debug");
                        return true;
                    } catch (err: any) { log(`Failed to set pet performance mode: ${err.message}`, "error"); return false; }
                },
            };

            log("Global Live2D API mounted", "debug");
        }

        window.addEventListener("websocket:live2d-model-config", handleLive2DModelConfig);
        log("WebSocket event listener registered", "debug");

        if (import.meta.env.DEV) {
            log(`Resource manager status: ${JSON.stringify(globalResourceManager.getResourceCount())}`, "debug");
        }
    });
});

onUnmounted(() => {
    log("Component unmounting, starting Live2D manager cleanup", "debug");

    try {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
            log("ResizeObserver disconnected", "debug");
        }

        if (visibilityHandler) {
            document.removeEventListener("visibilitychange", visibilityHandler);
            visibilityHandler = null;
            log("Visibility change listener removed", "debug");
        }

        if (petMode.value) {
            stopPetModeAutoInteraction();
            if (viewerContainer.value) {
                try {
                    viewerContainer.value.removeEventListener("mouseenter", handlePetModeHover);
                    viewerContainer.value.removeEventListener("mouseleave", handlePetModeLeave);
                } catch (err) {
                    console.error("❌ [Live2DViewer] Failed to clean up pet hover events:", err);
                }
            }
            log("Pet mode resources cleaned up", "debug");
        }

        if (live2dManager) {
            try {
                live2dManager.destroy();
                log("Live2D manager destroyed", "debug");
            } catch (err) {
                console.error("❌ [Live2DViewer] Failed to destroy Live2D manager:", err);
            }
            live2dManager = null;
        }

        if ((window as any).live2d) {
            try {
                delete (window as any).live2d;
                log("Global live2d object cleaned up", "debug");
            } catch (err) {
                console.error("❌ [Live2DViewer] Failed to clean up global live2d object:", err);
            }
        }

        try {
            window.removeEventListener("websocket:live2d-model-config", handleLive2DModelConfig);
            log("WebSocket event listener cleaned up", "debug");
        } catch (err) {
            console.error("❌ [Live2DViewer] Failed to clean up WebSocket event listener:", err);
        }

        try {
            globalStateSyncManager.cleanup();
            log("State sync manager cleaned up", "debug");
        } catch (err) {
            console.error("❌ [Live2DViewer] Failed to clean up state sync manager:", err);
        }

        try {
            globalResourceManager.cleanupAll();
            log("All resources in resource manager cleaned up", "debug");
        } catch (err) {
            console.error("❌ [Live2DViewer] Failed to clean up resource manager:", err);
        }

        log("Component unmount cleanup complete", "debug");
    } catch (err) {
        console.error("❌ [Live2DViewer] Component unmount cleanup failed:", err);
    }
});

defineExpose({ loadModel });
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
