<template>
    <n-config-provider :theme="theme">
        <n-message-provider>
            <n-dialog-provider>
                <div id="app" class="app-container">
                    <div class="modern-layout">
                        <!-- Main Content Area -->
                        <div class="main-content">
                            <NSplit
                                direction="horizontal"
                                :size="splitSize"
                                :default-size="0.3"
                                :min="0.05"
                                :max="0.5"
                                class="main-split"
                                @update:size="handleSplitSizeUpdate"
                            >
                                <template #1>
                                    <!-- Left Settings Area -->
                                    <div
                                        class="settings-panel"
                                        :class="{
                                            collapsed: settingsCollapsed,
                                        }"
                                    >
                                        <div
                                            class="settings-sidebar icon-only-sidebar"
                                            v-show="!settingsCollapsed"
                                        >
                                            <div class="icon-menu">
                                                <n-tooltip
                                                    v-for="option in menuOptions"
                                                    :key="option.key"
                                                    placement="right"
                                                >
                                                    <template #trigger>
                                                        <n-button
                                                            :type="
                                                                activeKey ===
                                                                option.key
                                                                    ? 'primary'
                                                                    : 'tertiary'
                                                            "
                                                            size="large"
                                                            circle
                                                            @click="
                                                                handleMenuSelect(
                                                                    option.key,
                                                                )
                                                            "
                                                            class="icon-menu-item"
                                                        >
                                                            <component
                                                                :is="
                                                                    option.icon
                                                                "
                                                            />
                                                        </n-button>
                                                    </template>
                                                    <span>{{
                                                        option.label
                                                    }}</span>
                                                </n-tooltip>

                                                <!-- Divider -->
                                                <div
                                                    style="
                                                        width: 28px;
                                                        height: 1px;
                                                        background: var(
                                                            --n-border-color
                                                        );
                                                        margin: 4px 0;
                                                    "
                                                ></div>

                                                <!-- Toggle Settings Panel -->
                                                <n-tooltip placement="right">
                                                    <template #trigger>
                                                        <n-button
                                                            :type="
                                                                settingsCollapsed
                                                                    ? 'primary'
                                                                    : 'tertiary'
                                                            "
                                                            size="large"
                                                            circle
                                                            @click="
                                                                toggleSettingsPanel
                                                            "
                                                            class="icon-menu-item"
                                                        >
                                                            <span>{{
                                                                settingsCollapsed
                                                                    ? "📋"
                                                                    : "📝"
                                                            }}</span>
                                                        </n-button>
                                                    </template>
                                                    <span>Toggle Panel</span>
                                                </n-tooltip>

                                                <!-- Toggle Theme -->
                                                <n-tooltip placement="right">
                                                    <template #trigger>
                                                        <n-button
                                                            type="tertiary"
                                                            size="large"
                                                            circle
                                                            @click="toggleTheme"
                                                            class="icon-menu-item"
                                                        >
                                                            <span>{{
                                                                getThemeIcon()
                                                            }}</span>
                                                        </n-button>
                                                    </template>
                                                    <span>Toggle Theme</span>
                                                </n-tooltip>
                                            </div>
                                        </div>

                                        <!-- Collapsed Sidebar -->
                                        <div
                                            class="collapsed-sidebar"
                                            v-show="settingsCollapsed"
                                        >
                                            <div class="collapsed-menu">
                                                <n-tooltip
                                                    v-for="option in menuOptions.filter(
                                                        (opt) => opt.key,
                                                    )"
                                                    :key="option.key"
                                                    placement="right"
                                                >
                                                    <template #trigger>
                                                        <n-button
                                                            :type="
                                                                activeKey ===
                                                                option.key
                                                                    ? 'primary'
                                                                    : 'tertiary'
                                                            "
                                                            size="small"
                                                            circle
                                                            @click="
                                                                handleMenuSelect(
                                                                    option.key,
                                                                )
                                                            "
                                                            class="collapsed-menu-item"
                                                        >
                                                            <component
                                                                :is="
                                                                    option.icon
                                                                "
                                                            />
                                                        </n-button>
                                                    </template>
                                                    <span>{{
                                                        option.label
                                                    }}</span>
                                                </n-tooltip>

                                                <!-- Divider -->
                                                <div
                                                    style="
                                                        width: 28px;
                                                        height: 1px;
                                                        background: var(
                                                            --n-border-color
                                                        );
                                                        margin: 4px 0;
                                                    "
                                                ></div>

                                                <!-- Toggle Settings Panel -->
                                                <n-tooltip placement="right">
                                                    <template #trigger>
                                                        <n-button
                                                            :type="
                                                                settingsCollapsed
                                                                    ? 'primary'
                                                                    : 'tertiary'
                                                            "
                                                            size="small"
                                                            circle
                                                            @click="
                                                                toggleSettingsPanel
                                                            "
                                                            class="collapsed-menu-item"
                                                        >
                                                            <span>{{
                                                                settingsCollapsed
                                                                    ? "📋"
                                                                    : "📝"
                                                            }}</span>
                                                        </n-button>
                                                    </template>
                                                    <span>Toggle Panel</span>
                                                </n-tooltip>

                                                <!-- Toggle Theme -->
                                                <n-tooltip placement="right">
                                                    <template #trigger>
                                                        <n-button
                                                            type="tertiary"
                                                            size="small"
                                                            circle
                                                            @click="toggleTheme"
                                                            class="collapsed-menu-item"
                                                        >
                                                            <span>{{
                                                                getThemeIcon()
                                                            }}</span>
                                                        </n-button>
                                                    </template>
                                                    <span>Toggle Theme</span>
                                                </n-tooltip>
                                            </div>
                                        </div>

                                        <div
                                            class="settings-content"
                                            v-show="!settingsCollapsed"
                                        >
                                            <n-card
                                                :title="currentPageTitle"
                                                size="small"
                                                class="content-card"
                                                :bordered="false"
                                            >
                                                <template #header-extra>
                                                    <n-tag
                                                        size="small"
                                                        type="info"
                                                    >
                                                        {{ activeKey }}
                                                    </n-tag>
                                                </template>

                                                <div class="scrollable-content">
                                                    <ErrorBoundary
                                                        @error="
                                                            handleComponentError
                                                        "
                                                        @retry="
                                                            handleComponentRetry
                                                        "
                                                    >
                                                        <Suspense>
                                                            <template #default>
                                                                <component
                                                                    :is="
                                                                        currentComponent
                                                                    "
                                                                    :key="
                                                                        activeKey
                                                                    "
                                                                    @model-selected="
                                                                        handleModelSelected
                                                                    "
                                                                    @model-configure="
                                                                        handleModelConfigure
                                                                    "
                                                                    @back="
                                                                        handleBack
                                                                    "
                                                                    @settings-changed="
                                                                        handleSettingsChanged
                                                                    "
                                                                />
                                                            </template>
                                                            <template #fallback>
                                                                <div
                                                                    class="loading-container"
                                                                >
                                                                    <n-spin
                                                                        size="large"
                                                                    >
                                                                        <template
                                                                            #description
                                                                        >
                                                                            Loading
                                                                            component...
                                                                        </template>
                                                                    </n-spin>
                                                                </div>
                                                            </template>
                                                        </Suspense>
                                                    </ErrorBoundary>
                                                </div>
                                            </n-card>
                                        </div>
                                    </div>
                                </template>
                                <template #2>
                                    <!-- Right: Live2D Display Area -->
                                    <div class="live2d-main-area">
                                        <div class="live2d-viewer-container">
                                            <n-card
                                                size="small"
                                                class="live2d-card"
                                                :bordered="false"
                                            >
                                                <div
                                                    class="live2d-display-area"
                                                >
                                                    <Live2DViewer
                                                        ref="live2dViewer"
                                                    />
                                                </div>
                                            </n-card>
                                        </div>
                                    </div>
                                </template>
                            </NSplit>
                        </div>
                    </div>
                </div>
            </n-dialog-provider>
        </n-message-provider>
    </n-config-provider>
</template>

<script>
import { ref, computed, h, onMounted } from "vue";
import { darkTheme } from "naive-ui";
import Live2DViewer from "./components/Live2DViewer.vue";
import ModelSelector from "./components/ModelSelector.vue";
import ModelSettings from "./components/ModelSettings.vue";
import CanvasSettings from "./components/CanvasSettings.vue";
import ErrorBoundary from "./components/ErrorBoundary.vue";
import { useLive2DStore } from "./stores/live2d";
import { useThemeStore } from "./stores/theme";
import "./styles/app-styles.css";

export default {
    name: "App",
    components: {
        Live2DViewer,
        ModelSelector,
        ModelSettings,
        CanvasSettings,
        ErrorBoundary,
    },
    setup() {
        const live2dViewer = ref(null);
        const live2dStore = useLive2DStore();
        const themeStore = useThemeStore();

        // Theme
        const theme = computed(() => (themeStore.isDark ? darkTheme : null));

        // Layout
        const settingsCollapsed = ref(false);
        const activeKey = ref("model-selector");

        const INITIAL_SPLIT_SIZE = 0.3;
        const COLLAPSED_SPLIT_SIZE_BUTTON = 0.02;
        const COLLAPSED_SPLIT_SIZE_DRAG = 0.1;
        const EXPANDED_SPLIT_SIZE = 0.3;
        const COLLAPSE_THRESHOLD = 0.15;
        const EXPAND_THRESHOLD = 0.2;
        const RETRY_TIMEOUT_MS = 100;

        const splitSize = ref(INITIAL_SPLIT_SIZE);

        // Menu Options
        const menuOptions = [
            {
                label: "Model Selection",
                key: "model-selector",
                icon: () => h("span", "🎭"),
            },
            {
                label: "Model Setup",
                key: "model-settings",
                icon: () => h("span", "⚙️"),
            },
            {
                label: "Canvas Settings",
                key: "canvas-settings",
                icon: () => h("span", "🖼️"),
            },
        ];

        // Computed Properties
        const currentPageTitle = computed(() => {
            const titles = {
                "model-selector": "Model Selection",
                "model-settings": "Model Setup",
                "canvas-settings": "Canvas Settings",
            };
            return titles[activeKey.value] || "Settings";
        });

        const currentComponent = computed(() => {
            const components = {
                "model-selector": "ModelSelector",
                "model-settings": "ModelSettings",
                "canvas-settings": "CanvasSettings",
            };
            return components[activeKey.value];
        });

        // Methods
        const toggleTheme = () => {
            themeStore.toggleTheme();
        };

        const getThemeIcon = () => {
            switch (themeStore.currentTheme) {
                case "light":
                    return "🌞";
                case "dark":
                    return "🌙";
                case "auto":
                    return "🌗";
                default:
                    return "🌗";
            }
        };

        const toggleSettingsPanel = () => {
            settingsCollapsed.value = !settingsCollapsed.value;
            splitSize.value = settingsCollapsed.value
                ? COLLAPSED_SPLIT_SIZE_BUTTON
                : EXPANDED_SPLIT_SIZE;
        };

        const handleSplitSizeUpdate = (size) => {
            splitSize.value = size;
            if (size <= COLLAPSE_THRESHOLD && !settingsCollapsed.value) {
                settingsCollapsed.value = true;
                splitSize.value = COLLAPSED_SPLIT_SIZE_DRAG;
            } else if (size >= EXPAND_THRESHOLD && settingsCollapsed.value) {
                settingsCollapsed.value = false;
                splitSize.value = EXPANDED_SPLIT_SIZE;
            }
        };

        const handleMenuSelect = (key) => {
            activeKey.value = key;
            if (settingsCollapsed.value) {
                settingsCollapsed.value = false;
                splitSize.value = EXPANDED_SPLIT_SIZE;
            }
        };

        const handleModelSelected = (modelData) => {
            console.log("Model selected:", modelData);
            if (live2dViewer.value) {
                live2dViewer.value.loadModel(modelData);
            }
        };

        const handleModelConfigure = (modelData) => {
            console.log("Configure model:", modelData);
            activeKey.value = "model-settings";
        };

        const handleBack = () => {
            activeKey.value = "model-selector";
        };

        const handleSettingsChanged = (settings) => {
            console.log("Settings changed:", settings);
        };

        const handleComponentError = (errorInfo) => {
            console.error("Component error:", errorInfo);
            if (activeKey.value === "canvas-settings") {
                activeKey.value = "model-selector";
            }
        };

        const handleComponentRetry = () => {
            console.log("Component retry");
            const currentKey = activeKey.value;
            activeKey.value = "";
            setTimeout(() => {
                activeKey.value = currentKey;
            }, RETRY_TIMEOUT_MS);
        };

        onMounted(() => {
            console.log("Application initialized");
            themeStore.initTheme();
        });

        return {
            live2dViewer,
            live2dStore,
            theme,
            themeStore,
            settingsCollapsed,
            activeKey,
            menuOptions,
            currentPageTitle,
            currentComponent,
            splitSize,
            toggleTheme,
            getThemeIcon,
            toggleSettingsPanel,
            handleSplitSizeUpdate,
            handleMenuSelect,
            handleModelSelected,
            handleModelConfigure,
            handleBack,
            handleSettingsChanged,
            handleComponentError,
            handleComponentRetry,
        };
    },
};
</script>
