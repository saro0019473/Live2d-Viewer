<template>
    <div>
        <n-card title="Model Selection" :bordered="false">
            <template #header-extra>
                <n-button
                    quaternary
                    circle
                    @click="loadModelData"
                    :loading="loading"
                >
                    <template #icon>
                        <n-icon>
                            <svg viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                                />
                            </svg>
                        </n-icon>
                    </template>
                </n-button>
            </template>

            <div class="model-selector-vertical-layout">
                <!-- Add Custom Model Form -->
                <n-card
                    class="add-model-card"
                    title="Add Custom Model"
                    size="small"
                >
                    <n-form label-placement="top">
                        <n-grid :cols="1" :y-gap="16">
                            <!-- Model URL Selection & Input -->
                            <n-grid-item>
                                <n-form-item label="Model URL">
                                    <n-select
                                        v-model:value="modelUrl"
                                        placeholder="Select from list or manually enter model URL"
                                        :options="localModelOptions"
                                        :disabled="addingModel"
                                        clearable
                                        filterable
                                        tag
                                    >
                                        <template #empty>
                                            <div
                                                style="
                                                    text-align: center;
                                                    padding: 16px;
                                                "
                                            >
                                                <n-text depth="3"
                                                    >No local model index
                                                    found</n-text
                                                >
                                                <br />
                                                <n-text
                                                    depth="3"
                                                    style="font-size: 12px"
                                                >
                                                    Run script to generate index
                                                    or enter URL manually
                                                </n-text>
                                            </div>
                                        </template>
                                    </n-select>
                                </n-form-item>
                            </n-grid-item>

                            <!-- Add Button -->
                            <n-grid-item>
                                <n-button
                                    type="primary"
                                    block
                                    @click="addModel"
                                    :disabled="!modelUrl || addingModel"
                                    :loading="addingModel"
                                    class="add-model-btn"
                                >
                                    <template #icon>
                                        <n-icon>
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                                                />
                                            </svg>
                                        </n-icon>
                                    </template>
                                    {{
                                        addingModel
                                            ? "Loading..."
                                            : "Load Model"
                                    }}
                                </n-button>
                            </n-grid-item>
                        </n-grid>
                    </n-form>
                </n-card>

                <!-- Loaded Models List -->
                <n-card
                    class="loaded-models-card"
                    title="Loaded Models"
                    size="small"
                >
                    <template #header-extra>
                        <n-space>
                            <span
                                style="
                                    font-size: 12px;
                                    color: var(--n-text-color-disabled);
                                "
                            >
                                {{ loadedModels.length }} model(s) total
                            </span>
                        </n-space>
                    </template>
                    <div class="models-list-scroll">
                        <n-space
                            vertical
                            v-if="loadedModels.length > 0"
                            size="large"
                        >
                            <n-card
                                v-for="model in loadedModels"
                                :key="model.id"
                                size="small"
                                :bordered="true"
                                hoverable
                                class="model-card"
                            >
                                <template #header>
                                    <n-space align="center">
                                        <n-icon size="20" color="#18a058">
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                />
                                            </svg>
                                        </n-icon>
                                        <div>
                                            <div style="font-weight: 500">
                                                {{ getModelDisplayName(model) }}
                                            </div>
                                        </div>
                                    </n-space>
                                </template>
                                <template #header-extra>
                                    <div class="model-card-actions">
                                        <n-button
                                            size="small"
                                            @click="configureModel(model)"
                                            tertiary
                                        >
                                            <template #icon>
                                                <n-icon>
                                                    <svg viewBox="0 0 24 24">
                                                        <path
                                                            fill="currentColor"
                                                            d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            Settings
                                        </n-button>
                                        <n-popconfirm
                                            @positive-click="removeModel(model)"
                                            positive-text="Confirm"
                                            negative-text="Cancel"
                                        >
                                            <template #trigger>
                                                <n-button
                                                    size="small"
                                                    type="error"
                                                    secondary
                                                    circle
                                                >
                                                    <template #icon>
                                                        <n-icon>
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    fill="currentColor"
                                                                    d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12Z"
                                                                />
                                                            </svg>
                                                        </n-icon>
                                                    </template>
                                                </n-button>
                                            </template>
                                            Are you sure you want to remove
                                            model "{{
                                                getModelDisplayName(model)
                                            }}"?
                                        </n-popconfirm>
                                    </div>
                                </template>
                                <div class="model-path">
                                    Model path: {{ model.url }}
                                </div>
                            </n-card>
                        </n-space>
                        <n-empty
                            v-else
                            description="No loaded models"
                            style="margin: 40px 0"
                        >
                            <template #icon>
                                <n-icon
                                    size="48"
                                    color="var(--n-text-color-disabled)"
                                >
                                    <svg viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                        />
                                    </svg>
                                </n-icon>
                            </template>
                            <template #extra>
                                <n-button size="small" @click="scrollToTop">
                                    Add your first model
                                </n-button>
                            </template>
                        </n-empty>
                    </div>
                </n-card>
            </div>
        </n-card>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useMessage, NEllipsis } from "naive-ui";
import { useLive2DStore } from "../stores/live2d";
import { useWebSocketStore } from "../stores/websocket";

export default {
    name: "ModelSelector",
    components: {
        NEllipsis,
    },
    emits: ["model-selected", "model-configure"],
    setup(_, { emit }) {
        const live2dStore = useLive2DStore();
        const webSocketStore = useWebSocketStore();
        const message = useMessage();

        const loading = ref(false);
        const addingModel = ref(false);
        const loadingPresetModel = ref(null);
        const modelUrl = ref("");
        const localModelOptions = ref([]);
        const presetModels = ref([]);

        // Model sequence counter
        const modelCounter = ref(1);

        // Generate next model ID
        const generateModelId = () => {
            const allIds = Array.from(live2dStore.modelDataMap?.keys() || []);
            let maxNumber = 0;
            allIds.forEach((id) => {
                const match = id.match(/^model_(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNumber) maxNumber = num;
                }
            });
            return `model_${maxNumber + 1}`;
        };

        // Get loaded models from store
        const loadedModels = computed(() => {
            return Array.from(live2dStore.modelDataMap?.values() || []);
        });

        // Methods
        const loadModelData = async () => {
            loading.value = true;
            presetModels.value = [];
            try {
                console.log(
                    "🔄 [ModelSelector] Checking server preset models...",
                );

                if (webSocketStore.isConnected) {
                    const serverModelInfo =
                        webSocketStore.configs.character?.model_info;
                    if (serverModelInfo) {
                        console.log(
                            "📦 [ModelSelector] Found loaded server model info:",
                            serverModelInfo,
                        );
                        const serverModel = {
                            id: serverModelInfo.name,
                            name: serverModelInfo.name,
                            description: serverModelInfo.description,
                            url: serverModelInfo.url,
                            ...serverModelInfo,
                        };
                        presetModels.value = [serverModel];
                        console.log(
                            "✅ [ModelSelector] Server preset model set.",
                        );
                    } else {
                        console.log(
                            "ℹ️ [ModelSelector] Connected but no model info in current config.",
                        );
                    }
                } else {
                    console.log(
                        "ℹ️ [ModelSelector] Not connected to server, skipping preset models.",
                    );
                }
            } catch (error) {
                console.error(
                    "❌ [ModelSelector] Failed to load model data:",
                    error,
                );
                message.error("Failed to load model data: " + error.message);
                presetModels.value = [];
            } finally {
                loading.value = false;
            }
        };

        const loadPresetModel = async (model) => {
            if (loadingPresetModel.value) return;

            loadingPresetModel.value = model.id;
            try {
                console.log("🔄 [ModelSelector] Loading preset model:", model);

                const modelData = {
                    id: model.id,
                    name: model.name,
                    url: model.url,
                    description: model.description,
                };
                emit("model-selected", modelData);
                message.success(
                    `Selected model "${model.name}", please wait for loading...`,
                );
            } catch (error) {
                console.error(
                    "❌ [ModelSelector] Failed to load preset model:",
                    error,
                );
                message.error(`Failed to load model: ${error.message}`);
            } finally {
                loadingPresetModel.value = null;
            }
        };

        const addModel = async () => {
            let modelDataRaw = modelUrl.value;
            if (!modelDataRaw) {
                message.warning("Please select or enter a model URL");
                return;
            }

            addingModel.value = true;
            try {
                let modelData;
                if (typeof modelDataRaw === "object") {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw.path,
                        name:
                            modelDataRaw.name ||
                            getModelDisplayName(modelDataRaw),
                        description: modelDataRaw.description || "",
                        thumbnail: modelDataRaw.thumbnail || "",
                        version: modelDataRaw.version || "",
                        author: modelDataRaw.author || "",
                        tags: modelDataRaw.tags || [],
                    };
                } else {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw,
                        name: getModelDisplayName(modelDataRaw),
                    };
                }

                const existingModel = Array.from(
                    live2dStore?.modelDataMap?.values() || [],
                ).find((model) => model.url === modelData.url);
                if (existingModel) {
                    message.warning(
                        `Model with URL "${modelData.url}" is already loaded`,
                    );
                    return;
                }

                console.log(
                    "➕ [ModelSelector] Adding custom model:",
                    modelData,
                    "(using sequential ID)",
                );
                if (live2dStore?.setModelData) {
                    live2dStore.setModelData(modelData);
                }
                emit("model-selected", modelData);

                message.success(
                    `Custom model "${modelData.name}" added successfully`,
                );

                modelUrl.value = "";
            } catch (error) {
                console.error(
                    "❌ [ModelSelector] Failed to add custom model:",
                    error,
                );
                message.error("Failed to add custom model");
            } finally {
                addingModel.value = false;
            }
        };

        const removeModel = async (model) => {
            try {
                console.log("🗑️ [ModelSelector] Removing model:", model);
                console.log(
                    "🗑️ [ModelSelector] Model URL type:",
                    typeof model.url,
                    "value:",
                    model.url,
                );

                // 1. Remove model from Live2DManager/PIXI scene
                if (live2dStore?.manager) {
                    try {
                        live2dStore.manager.removeModel(model.id);
                    } catch (e) {
                        console.warn(
                            "⚠️ [ModelSelector] manager.removeModel failed:",
                            e,
                        );
                    }
                }

                // 2. Remove model data and instance from store
                if (live2dStore?.removeLoadedModel) {
                    live2dStore.removeLoadedModel(model.id);
                }

                // 3. If the removed model is the current model, clear current model
                if (live2dStore?.currentModel?.id === model.id) {
                    if (live2dStore?.setCurrentModel) {
                        live2dStore.setCurrentModel(null);
                    }
                }

                message.success(
                    `Model "${getModelDisplayName(model)}" has been removed`,
                );
            } catch (error) {
                console.error(
                    "❌ [ModelSelector] Failed to remove model:",
                    error,
                );
                message.error("Failed to remove model");
            }
        };

        const configureModel = (model) => {
            console.log("⚙️ [ModelSelector] Configure model:", model);
            emit("model-configure", model);
        };

        const scrollToTop = () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        };

        const getModelDisplayName = (modelOrUrl) => {
            if (!modelOrUrl) return "Unknown Model";
            if (typeof modelOrUrl === "object" && modelOrUrl.name) {
                return modelOrUrl.name;
            }
            let url =
                typeof modelOrUrl === "string" ? modelOrUrl : modelOrUrl.url;
            if (!url || typeof url !== "string") return "Unknown Model";
            try {
                const urlParts = url.split("/");
                const fileName = urlParts[urlParts.length - 1];
                return (
                    fileName.replace(/\.(json|moc3|model3\.json)$/i, "") ||
                    "Unknown Model"
                );
            } catch (error) {
                return "Unknown Model";
            }
        };

        // WebSocket event handler
        const handleModelConfigUpdate = (event) => {
            console.log(
                "🔄 [ModelSelector] Received model config update:",
                event.detail,
            );
            const config = event.detail;

            if (config.model_info) {
                console.log(
                    "📦 [ModelSelector] Updating preset model info:",
                    config.model_info,
                );

                const serverModel = {
                    id: config.model_info.name || "server-model",
                    name: config.model_info.name || "Server Model",
                    description: config.model_info.description,
                    url: config.model_info.url,
                    ...config.model_info,
                };
                console.log("Final serverModel:", serverModel);
                presetModels.value = [serverModel];

                console.log(
                    "✅ [ModelSelector] Preset model list updated:",
                    presetModels.value,
                );
            } else {
                presetModels.value = [];
                console.log(
                    "ℹ️ [ModelSelector] New config has no model info, clearing preset model list.",
                );
            }
        };

        const loadLocalModelsIndex = async () => {
            try {
                const response = await fetch("/models/models-index.json");
                if (!response.ok) {
                    console.warn(
                        `[ModelSelector] Local model index file /models/models-index.json not found`,
                    );
                    return;
                }
                const models = await response.json();
                if (Array.isArray(models)) {
                    localModelOptions.value = models
                        .map((model) => ({
                            label: `${model.folder}/${model.name}`,
                            value: model,
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    console.log(
                        "✅ [ModelSelector] Local model index loaded successfully:",
                        localModelOptions.value.length,
                        "models",
                    );
                }
            } catch (error) {
                console.error(
                    "❌ [ModelSelector] Failed to load local model index:",
                    error,
                );
            }
        };

        // Watch connection status changes
        watch(
            () => webSocketStore.isConnected,
            (isConnected) => {
                if (isConnected) {
                    loadModelData();
                } else {
                    presetModels.value = [];
                    console.log(
                        "🔌 [ModelSelector] Disconnected, clearing preset models.",
                    );
                }
            },
        );

        onMounted(() => {
            window.addEventListener(
                "websocket:set-model-and-conf",
                handleModelConfigUpdate,
            );
            loadModelData();
            loadLocalModelsIndex();
        });

        onUnmounted(() => {
            window.removeEventListener(
                "websocket:set-model-and-conf",
                handleModelConfigUpdate,
            );
        });

        return {
            modelUrl,
            presetModels,
            localModelOptions,
            loadedModels,
            loading,
            addingModel,
            loadingPresetModel,

            loadModelData,
            loadPresetModel,
            addModel,
            removeModel,
            configureModel,
            scrollToTop,
            getModelDisplayName,
        };
    },
};
</script>

<style scoped>
.model-selector-vertical-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    overflow-y: auto;
    max-height: calc(100vh - 120px);
}

/* Preset models styles */
.preset-models-card {
    border-radius: 18px;
}

.preset-models-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 5px;
    max-height: 300px;
    overflow-y: auto;
    padding: 1px;
}

.preset-model-card {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--n-border-color);
}

.preset-model-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--n-primary-color);
}

.preset-model-card.loading {
    opacity: 0.7;
    pointer-events: none;
}

.preset-model-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.preset-model-name {
    font-weight: 600;
    font-size: 14px;
}

.preset-model-url {
    font-size: 11px;
    color: var(--n-text-color-disabled);
    margin-top: 4px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Custom model add styles */
.add-model-card {
    border-radius: 18px;
}

.add-model-btn {
    min-width: 120px;
    width: 100%;
    border-radius: 8px;
}

/* Loaded models styles */
.loaded-models-card {
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    max-height: 48vh;
}

.models-list-scroll {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
}

.model-card {
    transition:
        box-shadow 0.2s,
        border-color 0.2s;
    border-left: 4px solid var(--n-primary-color);
    border-radius: 12px;
}

.model-card-actions {
    display: flex;
    gap: 8px;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.model-card:hover .model-card-actions {
    opacity: 1;
}

/* Responsive design */
@media (max-width: 900px) {
    .model-selector-vertical-layout {
        gap: 5px;
    }

    .preset-models-grid {
        grid-template-columns: 1fr;
        max-height: 250px;
    }

    .add-model-card,
    .loaded-models-card {
        max-width: 100%;
        min-width: 0;
    }

    .loaded-models-card {
        max-height: none;
    }

    .add-model-btn {
        min-width: 0;
    }
}

@media (max-width: 600px) {
    .preset-models-grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .preset-model-url {
        -webkit-line-clamp: 3;
        line-clamp: 3;
    }
}

.model-path {
    font-size: 12px;
    color: var(--n-text-color-disabled);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
