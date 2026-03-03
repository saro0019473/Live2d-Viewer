<template>
    <n-card title="Canvas Settings" :bordered="false">
        <n-scrollbar class="scrollable-content">
            <template #header-extra>
                <n-space>
                    <n-button
                        quaternary
                        circle
                        @click="resetSettings"
                        :loading="resetting"
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
                </n-space>
            </template>

            <n-spin :show="loading">
                <n-space vertical size="large">
                    <!-- Display Settings -->
                    <n-card
                        title="Display Settings"
                        size="small"
                        :segmented="{ content: true }"
                    >
                        <template #header-extra>
                            <n-icon size="18" color="var(--n-info-color)">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 7h5v5H5zm7 0h7v2h-7zm0 3h7v2h-7zM5 13h5v5H5zm7 0h7v5h-7z"
                                    />
                                </svg>
                            </n-icon>
                        </template>

                        <n-form
                            :model="settings"
                            label-placement="left"
                            label-width="100"
                        >
                            <n-space vertical size="large">
                                <!-- Canvas Size -->
                                <n-collapse>
                                    <n-collapse-item
                                        title="Canvas Size"
                                        name="canvas-size"
                                    >
                                        <template #header-extra>
                                            <n-tag size="tiny" type="info"
                                                >{{ settings.canvasWidth }}×{{
                                                    settings.canvasHeight
                                                }}</n-tag
                                            >
                                        </template>

                                        <n-space vertical size="medium">
                                            <!-- Canvas Width -->
                                            <n-form-item label="Width">
                                                <n-space
                                                    vertical
                                                    style="width: 100%"
                                                >
                                                    <n-slider
                                                        :value="
                                                            settings.canvasWidth
                                                        "
                                                        :min="800"
                                                        :max="2560"
                                                        :step="10"
                                                        @update:value="
                                                            (value) => {
                                                                settings.canvasWidth =
                                                                    value;
                                                                updateSettings();
                                                            }
                                                        "
                                                        :tooltip="true"
                                                    />
                                                    <n-input-number
                                                        :value="
                                                            settings.canvasWidth
                                                        "
                                                        :min="800"
                                                        :max="2560"
                                                        :step="10"
                                                        size="small"
                                                        @update:value="
                                                            (value) => {
                                                                settings.canvasWidth =
                                                                    value;
                                                                updateSettings();
                                                            }
                                                        "
                                                        style="width: 120px"
                                                    />
                                                </n-space>
                                            </n-form-item>

                                            <!-- Canvas Height -->
                                            <n-form-item label="Height">
                                                <n-space
                                                    vertical
                                                    style="width: 100%"
                                                >
                                                    <n-slider
                                                        :value="
                                                            settings.canvasHeight
                                                        "
                                                        :min="600"
                                                        :max="1440"
                                                        :step="10"
                                                        @update:value="
                                                            (value) => {
                                                                settings.canvasHeight =
                                                                    value;
                                                                updateSettings();
                                                            }
                                                        "
                                                        :tooltip="true"
                                                    />
                                                    <n-input-number
                                                        :value="
                                                            settings.canvasHeight
                                                        "
                                                        :min="600"
                                                        :max="1440"
                                                        :step="10"
                                                        size="small"
                                                        @update:value="
                                                            (value) => {
                                                                settings.canvasHeight =
                                                                    value;
                                                                updateSettings();
                                                            }
                                                        "
                                                        style="width: 120px"
                                                    />
                                                </n-space>
                                            </n-form-item>
                                        </n-space>
                                    </n-collapse-item>
                                </n-collapse>

                                <n-divider style="margin: 8px 0" />

                                <!-- Other Settings -->
                                <n-space vertical size="medium">
                                    <n-space
                                        justify="space-between"
                                        align="center"
                                    >
                                        <n-space align="center">
                                            <span style="font-weight: 500"
                                                >Auto Resize</span
                                            >
                                            <n-tooltip>
                                                <template #trigger>
                                                    <n-icon
                                                        size="14"
                                                        color="var(--n-text-color-disabled)"
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2v6Z"
                                                            />
                                                        </svg>
                                                    </n-icon>
                                                </template>
                                                <span
                                                    >Canvas size automatically
                                                    adapts to window size
                                                    changes</span
                                                >
                                            </n-tooltip>
                                        </n-space>
                                        <n-switch
                                            :value="settings.autoResize"
                                            @update:value="
                                                (value) => {
                                                    settings.autoResize = value;
                                                    updateSettings();
                                                }
                                            "
                                        >
                                            <template #checked>On</template>
                                            <template #unchecked>Off</template>
                                        </n-switch>
                                    </n-space>

                                    <!-- Foreground Mask Settings -->
                                    <n-space
                                        justify="space-between"
                                        align="center"
                                    >
                                        <n-space align="center">
                                            <span style="font-weight: 500"
                                                >Show Foreground Mask</span
                                            >
                                            <n-tooltip>
                                                <template #trigger>
                                                    <n-icon
                                                        size="14"
                                                        color="var(--n-text-color-disabled)"
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2v6Z"
                                                            />
                                                        </svg>
                                                    </n-icon>
                                                </template>
                                                <span
                                                    >Add an adjustable opacity
                                                    foreground mask for each
                                                    model</span
                                                >
                                            </n-tooltip>
                                        </n-space>
                                        <n-switch
                                            :value="settings.showForeground"
                                            @update:value="
                                                (value) => {
                                                    settings.showForeground =
                                                        value;
                                                    updateSettings();
                                                }
                                            "
                                        >
                                            <template #checked>On</template>
                                            <template #unchecked>Off</template>
                                        </n-switch>
                                    </n-space>
                                    <n-form-item
                                        label="Mask Opacity"
                                        v-if="settings.showForeground"
                                    >
                                        <n-slider
                                            :value="settings.foregroundAlpha"
                                            :min="0"
                                            :max="0.5"
                                            :step="0.01"
                                            @update:value="
                                                (value) => {
                                                    settings.foregroundAlpha =
                                                        value;
                                                    updateSettings();
                                                }
                                            "
                                            :tooltip="true"
                                        />
                                        <n-input-number
                                            :value="settings.foregroundAlpha"
                                            :min="0"
                                            :max="0.5"
                                            :step="0.01"
                                            size="small"
                                            @update:value="
                                                (value) => {
                                                    settings.foregroundAlpha =
                                                        value;
                                                    updateSettings();
                                                }
                                            "
                                            style="
                                                width: 120px;
                                                margin-left: 12px;
                                            "
                                        />
                                    </n-form-item>
                                </n-space>
                            </n-space>
                        </n-form>
                    </n-card>

                    <!-- Live2D Control Settings -->
                    <n-card
                        title="Live2D Controls"
                        size="small"
                        :segmented="{ content: true }"
                    >
                        <template #header-extra>
                            <n-icon size="18" color="var(--n-warning-color)">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                                    />
                                </svg>
                            </n-icon>
                        </template>

                        <n-form
                            :model="settings"
                            label-placement="left"
                            label-width="100"
                        >
                            <n-space vertical size="large">
                                <!-- Performance Settings -->
                                <n-collapse>
                                    <n-collapse-item
                                        title="Performance"
                                        name="performance"
                                    >
                                        <template #header-extra>
                                            <n-tag size="tiny" type="info"
                                                >{{
                                                    settings.maxFPS
                                                }}
                                                FPS</n-tag
                                            >
                                        </template>

                                        <n-space vertical size="medium">
                                            <!-- Max FPS -->
                                            <n-form-item label="Max FPS">
                                                <n-select
                                                    :value="settings.maxFPS"
                                                    @update:value="
                                                        (value) => {
                                                            settings.maxFPS =
                                                                value;
                                                            updateLive2DSettings();
                                                        }
                                                    "
                                                    :options="[
                                                        {
                                                            label: '30 FPS',
                                                            value: 30,
                                                        },
                                                        {
                                                            label: '60 FPS',
                                                            value: 60,
                                                        },
                                                        {
                                                            label: '120 FPS',
                                                            value: 120,
                                                        },
                                                    ]"
                                                />
                                            </n-form-item>

                                            <!-- Texture Garbage Collection -->
                                            <n-form-item label="Texture GC">
                                                <n-select
                                                    :value="
                                                        settings.textureGCMode
                                                    "
                                                    @update:value="
                                                        (value) => {
                                                            settings.textureGCMode =
                                                                value;
                                                            updateLive2DSettings();
                                                        }
                                                    "
                                                    :options="[
                                                        {
                                                            label: 'Aggressive',
                                                            value: 'aggressive',
                                                        },
                                                        {
                                                            label: 'Auto',
                                                            value: 'auto',
                                                        },
                                                        {
                                                            label: 'Conservative',
                                                            value: 'conservative',
                                                        },
                                                    ]"
                                                />
                                            </n-form-item>

                                            <!-- Frustum Culling -->
                                            <n-space
                                                justify="space-between"
                                                align="center"
                                            >
                                                <n-space align="center">
                                                    <span
                                                        style="font-weight: 500"
                                                        >Frustum Culling</span
                                                    >
                                                    <n-tooltip>
                                                        <template #trigger>
                                                            <n-icon
                                                                size="14"
                                                                color="var(--n-text-color-disabled)"
                                                            >
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        fill="currentColor"
                                                                        d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2v6Z"
                                                                    />
                                                                </svg>
                                                            </n-icon>
                                                        </template>
                                                        <span
                                                            >Enabling frustum
                                                            culling can improve
                                                            rendering
                                                            performance</span
                                                        >
                                                    </n-tooltip>
                                                </n-space>
                                                <n-switch
                                                    :value="
                                                        settings.enableCulling
                                                    "
                                                    @update:value="
                                                        (value) => {
                                                            settings.enableCulling =
                                                                value;
                                                            updateLive2DSettings();
                                                        }
                                                    "
                                                >
                                                    <template #checked
                                                        >On</template
                                                    >
                                                    <template #unchecked
                                                        >Off</template
                                                    >
                                                </n-switch>
                                            </n-space>

                                            <!-- Batching -->
                                            <n-space
                                                justify="space-between"
                                                align="center"
                                            >
                                                <n-space align="center">
                                                    <span
                                                        style="font-weight: 500"
                                                        >Batch
                                                        Optimization</span
                                                    >
                                                    <n-tooltip>
                                                        <template #trigger>
                                                            <n-icon
                                                                size="14"
                                                                color="var(--n-text-color-disabled)"
                                                            >
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        fill="currentColor"
                                                                        d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2v6Z"
                                                                    />
                                                                </svg>
                                                            </n-icon>
                                                        </template>
                                                        <span
                                                            >Enabling batching
                                                            can reduce draw call
                                                            count</span
                                                        >
                                                    </n-tooltip>
                                                </n-space>
                                                <n-switch
                                                    :value="
                                                        settings.enableBatching
                                                    "
                                                    @update:value="
                                                        (value) => {
                                                            settings.enableBatching =
                                                                value;
                                                            updateLive2DSettings();
                                                        }
                                                    "
                                                >
                                                    <template #checked
                                                        >On</template
                                                    >
                                                    <template #unchecked
                                                        >Off</template
                                                    >
                                                </n-switch>
                                            </n-space>
                                        </n-space>
                                    </n-collapse-item>
                                </n-collapse>

                                <n-divider style="margin: 8px 0" />

                                <!-- Model Controls -->
                                <n-space vertical size="medium">
                                    <h4
                                        style="
                                            margin: 0;
                                            font-size: 14px;
                                            color: var(--n-text-color-base);
                                        "
                                    >
                                        Model Controls
                                    </h4>

                                    <!-- Control Buttons -->
                                    <n-space>
                                        <n-button
                                            @click="pauseRendering"
                                            size="small"
                                            :type="
                                                isPaused ? 'warning' : 'default'
                                            "
                                        >
                                            <template #icon>
                                                <n-icon>
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        v-if="!isPaused"
                                                    >
                                                        <path
                                                            fill="currentColor"
                                                            d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                                                        />
                                                    </svg>
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        v-else
                                                    >
                                                        <path
                                                            fill="currentColor"
                                                            d="M8 5v14l11-7z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            {{
                                                isPaused
                                                    ? "Resume Rendering"
                                                    : "Pause Rendering"
                                            }}
                                        </n-button>
                                    </n-space>

                                    <!-- Performance Stats -->
                                    <n-space vertical size="medium">
                                        <n-space
                                            justify="space-between"
                                            align="center"
                                        >
                                            <span style="font-weight: 500"
                                                >Performance Stats</span
                                            >
                                            <n-switch
                                                :value="settings.showStats"
                                                @update:value="
                                                    (value) => {
                                                        settings.showStats =
                                                            value;
                                                        toggleStats();
                                                    }
                                                "
                                            >
                                                <template #checked
                                                    >Show</template
                                                >
                                                <template #unchecked
                                                    >Hide</template
                                                >
                                            </n-switch>
                                        </n-space>

                                        <div
                                            v-if="settings.showStats"
                                            class="stats-panel"
                                        >
                                            <n-space vertical size="small">
                                                <n-space
                                                    justify="space-between"
                                                >
                                                    <span>FPS:</span>
                                                    <n-tag
                                                        size="small"
                                                        :type="
                                                            getFPSTagType(
                                                                stats.fps,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            stats.fps?.toFixed(
                                                                1,
                                                            ) || "N/A"
                                                        }}
                                                    </n-tag>
                                                </n-space>
                                                <n-space
                                                    justify="space-between"
                                                >
                                                    <span>Model Count:</span>
                                                    <n-tag
                                                        size="small"
                                                        type="info"
                                                        >{{
                                                            stats.modelCount ||
                                                            0
                                                        }}</n-tag
                                                    >
                                                </n-space>
                                                <n-space
                                                    justify="space-between"
                                                >
                                                    <span>Delta Time:</span>
                                                    <n-tag
                                                        size="small"
                                                        type="default"
                                                        >{{
                                                            stats.deltaTime?.toFixed(
                                                                2,
                                                            ) || "N/A"
                                                        }}</n-tag
                                                    >
                                                </n-space>
                                                <n-space
                                                    justify="space-between"
                                                    v-if="stats.textureMemory"
                                                >
                                                    <span>Texture Count:</span>
                                                    <n-tag
                                                        size="small"
                                                        type="warning"
                                                        >{{
                                                            stats.textureMemory
                                                                .count || "N/A"
                                                        }}</n-tag
                                                    >
                                                </n-space>
                                            </n-space>
                                        </div>
                                    </n-space>
                                </n-space>
                            </n-space>
                        </n-form>
                    </n-card>
                </n-space>
            </n-spin>

            <!-- Action Buttons -->
            <template #action>
                <n-space justify="space-between">
                    <n-button @click="exportSettings" secondary>
                        <template #icon>
                            <n-icon>
                                <svg viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m4 18H6V4h7v5h5v11Z"
                                    />
                                </svg>
                            </n-icon>
                        </template>
                        Export Settings
                    </n-button>

                    <n-space>
                        <n-button @click="resetSettings" :loading="resetting">
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
                            Reset
                        </n-button>

                        <n-button
                            type="primary"
                            @click="applySettings"
                            :loading="applying"
                        >
                            <template #icon>
                                <n-icon>
                                    <svg viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                                        />
                                    </svg>
                                </n-icon>
                            </template>
                            Apply Settings
                        </n-button>
                    </n-space>
                </n-space>
            </template>
        </n-scrollbar>
    </n-card>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from "vue";

const __DEV__ = import.meta.env.DEV;

import { useLive2DStore } from "../stores/live2d";

export default {
    name: "CanvasSettings",
    components: {},
    setup() {
        const live2dStore = useLive2DStore();
        const message = useMessage();

        // State management
        const loading = ref(false);
        const resetting = ref(false);
        const applying = ref(false);

        // Helper function to safely get store settings
        const getSafeSetting = (key, defaultValue) => {
            try {
                if (
                    live2dStore?.settings &&
                    typeof live2dStore.settings === "object"
                ) {
                    const value = live2dStore.settings[key];
                    return value !== undefined && value !== null
                        ? value
                        : defaultValue;
                }
                return defaultValue;
            } catch (error) {
                console.warn(
                    `⚠️ [CanvasSettings] Failed to get setting ${key}:`,
                    error,
                );
                return defaultValue;
            }
        };

        const settings = reactive({
            canvasWidth: getSafeSetting("canvasWidth", 1200),
            canvasHeight: getSafeSetting("canvasHeight", 800),
            autoResize: getSafeSetting("autoResize", true),
            // Live2D performance settings
            maxFPS: getSafeSetting("maxFPS", 60),
            textureGCMode: getSafeSetting("textureGCMode", "auto"),
            enableCulling: getSafeSetting("enableCulling", true),
            enableBatching: getSafeSetting("enableBatching", true),
            showStats: getSafeSetting("showStats", false),
            showForeground: getSafeSetting("showForeground", false),
            foregroundAlpha: getSafeSetting("foregroundAlpha", 0.0),
        });

        // Default settings backup
        const defaultSettings = {
            canvasWidth: 1200,
            canvasHeight: 800,
            autoResize: true,
            // Live2D performance defaults
            maxFPS: 60,
            textureGCMode: "auto",
            enableCulling: true,
            enableBatching: true,
            showStats: false,
            showForeground: false,
            foregroundAlpha: 0.0,
        };

        // Performance stats data
        const stats = ref({});
        const isPaused = ref(false);
        let statsInterval = null;

        // Methods
        const updateSettings = () => {
            try {
                // Validate settings object
                if (!settings || typeof settings !== "object") {
                    console.error(
                        "❌ [CanvasSettings] Invalid settings object:",
                        settings,
                    );
                    message.error("Invalid settings object");
                    return;
                }

                // Update different types of settings separately
                if (live2dStore?.manager) {
                    try {
                        // Update canvas size
                        if (settings.canvasWidth && settings.canvasHeight) {
                            live2dStore.manager.resize(
                                Number(settings.canvasWidth),
                                Number(settings.canvasHeight),
                            );
                        }

                        // Update performance settings
                        live2dStore.manager.updatePerformanceSettings({
                            maxFPS: settings.maxFPS,
                            textureGCMode: settings.textureGCMode,
                            enableCulling: settings.enableCulling,
                            enableBatching: settings.enableBatching,
                        });

                        __DEV__ &&
                            console.debug(
                                "[CanvasSettings] All settings updated:",
                                {
                                    canvasSize: `${settings.canvasWidth}x${settings.canvasHeight}`,
                                    autoResize: settings.autoResize,
                                    maxFPS: settings.maxFPS,
                                },
                            );
                    } catch (error) {
                        console.error(
                            "❌ [CanvasSettings] Settings update failed:",
                            error,
                        );
                        message.error("Settings update failed");
                        return;
                    }
                } else {
                    console.warn(
                        "⚠️ [CanvasSettings] Live2D Manager not initialized",
                    );
                }
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] updateSettings execution failed:",
                    error,
                );
                console.error("❌ [CanvasSettings] Error stack:", error.stack);
                message.error("Settings update failed");
            }
        };

        // Live2D related methods
        const updateLive2DSettings = () => {
            try {
                if (!live2dStore?.manager) {
                    console.warn(
                        "⚠️ [CanvasSettings] Live2D Manager not initialized",
                    );
                    return;
                }

                // Update performance settings
                live2dStore.manager.updatePerformanceSettings({
                    maxFPS: settings.maxFPS,
                    textureGCMode: settings.textureGCMode,
                    enableCulling: settings.enableCulling,
                    enableBatching: settings.enableBatching,
                });

                __DEV__ &&
                    console.debug("[CanvasSettings] Live2D settings updated");
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Live2D settings update failed:",
                    error,
                );
                message.error("Live2D settings update failed");
            }
        };

        const pauseRendering = () => {
            try {
                if (
                    live2dStore?.manager &&
                    typeof live2dStore.manager.setPaused === "function"
                ) {
                    isPaused.value = !isPaused.value;
                    live2dStore.manager.setPaused(isPaused.value);
                    message.success(
                        isPaused.value
                            ? "Rendering paused"
                            : "Rendering resumed",
                    );
                }
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Pause/resume rendering failed:",
                    error,
                );
                message.error("Operation failed");
            }
        };

        const toggleStats = () => {
            if (settings.showStats) {
                startStatsUpdate();
            } else {
                stopStatsUpdate();
            }
        };

        const startStatsUpdate = () => {
            if (statsInterval) return;

            statsInterval = setInterval(() => {
                try {
                    if (
                        live2dStore?.manager &&
                        typeof live2dStore.manager.getPerformanceStats ===
                            "function"
                    ) {
                        const perf = live2dStore.manager.getPerformanceStats();
                        stats.value = {
                            fps: perf.fps,
                            modelCount: live2dStore.manager.getModelCount
                                ? live2dStore.manager.getModelCount()
                                : 1,
                            deltaTime: perf.deltaTime,
                            textureMemory: perf.textureMemory,
                        };
                    }
                } catch (error) {
                    console.error(
                        "❌ [CanvasSettings] Failed to get performance stats:",
                        error,
                    );
                }
            }, 1000);
        };

        const stopStatsUpdate = () => {
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
        };

        const getFPSTagType = (fps) => {
            if (!fps) return "default";
            if (fps >= 50) return "success";
            if (fps >= 30) return "warning";
            return "error";
        };

        const resetSettings = async () => {
            resetting.value = true;
            try {
                Object.assign(settings, defaultSettings);
                updateSettings();
                message.success("Settings have been reset to defaults");
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Reset settings failed:",
                    error,
                );
                message.error("Reset settings failed");
            } finally {
                resetting.value = false;
            }
        };

        const applySettings = async () => {
            applying.value = true;
            try {
                updateSettings();
                message.success("Settings applied");
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Apply settings failed:",
                    error,
                );
                message.error("Apply settings failed");
            } finally {
                applying.value = false;
            }
        };

        const exportSettings = () => {
            try {
                // Create a safe settings copy for export
                const safeExportSettings = {
                    canvasWidth: Number(settings.canvasWidth) || 1200,
                    canvasHeight: Number(settings.canvasHeight) || 800,
                    autoResize: Boolean(settings.autoResize),
                };

                const settingsJson = JSON.stringify(
                    safeExportSettings,
                    null,
                    2,
                );
                const blob = new Blob([settingsJson], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "canvas-settings.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                message.success("Settings exported");
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Export settings failed:",
                    error,
                );
                message.error("Export settings failed");
            }
        };

        onMounted(() => {
            try {
                __DEV__ && console.debug("[CanvasSettings] Component mounted");

                // Wait a tick to ensure all dependencies are initialized
                setTimeout(() => {
                    try {
                        // Get existing settings from store
                        if (
                            live2dStore?.settings &&
                            typeof live2dStore.settings === "object"
                        ) {
                            // Safely merge settings, only update existing properties
                            Object.keys(settings).forEach((key) => {
                                if (
                                    live2dStore.settings[key] !== undefined &&
                                    live2dStore.settings[key] !== null
                                ) {
                                    settings[key] = live2dStore.settings[key];
                                }
                            });
                        } else {
                            console.warn(
                                "⚠️ [CanvasSettings] Live2D store or settings not initialized, using defaults",
                            );
                        }

                        // Initialize settings
                        updateSettings();

                        // Initialize Live2D settings
                        updateLive2DSettings();

                        // If performance stats are enabled, start updating
                        if (settings.showStats) {
                            startStatsUpdate();
                        }
                    } catch (innerError) {
                        console.error(
                            "❌ [CanvasSettings] Delayed initialization failed:",
                            innerError,
                        );
                        message.error("Component initialization failed");
                    }
                }, 100);
            } catch (error) {
                console.error(
                    "❌ [CanvasSettings] Component initialization failed:",
                    error,
                );
                message.error("Component initialization failed");
            }
        });

        // Cleanup on component unmount
        onUnmounted(() => {
            stopStatsUpdate();
        });

        return {
            // Reactive data
            settings,
            loading,
            resetting,
            applying,
            stats,
            isPaused,

            // Methods
            updateSettings,
            resetSettings,
            applySettings,
            exportSettings,
            updateLive2DSettings,
            pauseRendering,
            toggleStats,
            getFPSTagType,
        };
    },
};
</script>

<style scoped>
/* Custom styles */
:deep(.n-card) {
    transition: all 0.3s ease;
}

:deep(.n-card:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

:deep(.n-form-item-label) {
    font-weight: 500;
    font-size: 13px;
}
</style>
