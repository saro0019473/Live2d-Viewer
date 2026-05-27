<template>
    <n-config-provider :theme="theme">
        <n-message-provider>
            <n-dialog-provider>
                <div id="app" class="app-container">
                    <div class="modern-layout">
                        <!-- Main Content Area -->
                        <div class="main-content">
                            <!-- Fixed-width layout: sidebar + content + live2d -->
                            <div class="main-split">
                                <!-- Left Settings Area -->
                                <div
                                    class="settings-panel"
                                    :class="{ collapsed: settingsCollapsed }"
                                >
                                    <!-- Single unified sidebar - always visible, fixed width -->
                                    <div
                                        class="settings-sidebar icon-only-sidebar"
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
                                                        class="settings-toggle-btn"
                                                    >
                                                        <component
                                                            :is="option.icon"
                                                        />
                                                    </n-button>
                                                </template>
                                                <span>{{ option.label }}</span>
                                            </n-tooltip>

                                            <!-- Divider -->
                                            <div class="sidebar-divider"></div>

                                            <!-- Toggle Settings Panel -->
                                            <n-tooltip placement="right">
                                                <template #trigger>
                                                    <n-button
                                                        type="tertiary"
                                                        size="large"
                                                        circle
                                                        @click="
                                                            toggleSettingsPanel
                                                        "
                                                        class="settings-toggle-btn panel-toggle-btn"
                                                        :class="{
                                                            'panel-hidden':
                                                                settingsCollapsed,
                                                        }"
                                                    >
                                                        <span>◀</span>
                                                    </n-button>
                                                </template>
                                                <span>{{
                                                    settingsCollapsed
                                                        ? "Show Panel"
                                                        : "Hide Panel"
                                                }}</span>
                                            </n-tooltip>

                                            <!-- Toggle Theme -->
                                            <n-tooltip placement="right">
                                                <template #trigger>
                                                    <n-button
                                                        type="tertiary"
                                                        size="large"
                                                        circle
                                                        @click="toggleTheme"
                                                        class="settings-toggle-btn"
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

                                    <!-- Settings Content - CSS animated width -->
                                    <div class="settings-content">
                                        <n-card
                                            :title="
                                                activeKey === 'model-settings'
                                                    ? ''
                                                    : currentPageTitle
                                            "
                                            size="small"
                                            class="content-card"
                                            :bordered="false"
                                        >
                                            <template
                                                #header
                                                v-if="
                                                    activeKey ===
                                                    'model-settings'
                                                "
                                            >
                                                <n-space
                                                    align="center"
                                                    :size="8"
                                                >
                                                    <n-button
                                                        quaternary
                                                        circle
                                                        size="small"
                                                        @click="handleBack"
                                                        style="
                                                            margin-right: 4px;
                                                        "
                                                    >
                                                        <span>◀</span>
                                                    </n-button>
                                                    <span
                                                        style="
                                                            font-weight: 600;
                                                            font-size: 16px;
                                                        "
                                                    >
                                                        {{ currentPageTitle }}
                                                    </span>
                                                </n-space>
                                            </template>

                                            <template #header-extra>
                                                <n-space
                                                    align="center"
                                                    :size="8"
                                                >
                                                    <n-tag
                                                        size="small"
                                                        type="info"
                                                        round
                                                    >
                                                        {{ activeKey }}
                                                    </n-tag>
                                                </n-space>
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
                                                                ref="activeComponentRef"
                                                                :key="activeKey"
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

                                <!-- Right: Live2D Display Area -->
                                <div class="live2d-main-area">
                                    <div class="live2d-viewer-container">
                                        <n-card
                                            size="small"
                                            class="live2d-card"
                                            :bordered="false"
                                        >
                                            <div class="live2d-display-area">
                                                <Live2DViewer
                                                    ref="live2dViewer"
                                                />
                                            </div>
                                        </n-card>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </n-dialog-provider>
        </n-message-provider>
    </n-config-provider>
</template>

<script setup lang="ts">
/**
 * App.vue — Root Component: Layout Shell
 *
 * Layout: 3-column split
 *   [icon sidebar] | [settings panel] | [Live2D canvas]
 *
 * Menu routing (activeKey):
 *   'model-selector' → shows ModelSelector.vue in the settings panel
 *   'model-settings' → shows ModelSettings.vue
 *   (empty)          → settings panel collapses / hidden
 *
 * The settings panel width is fixed; Live2D canvas fills the rest.
 * Clicking the same menu icon again collapses the panel.
 *
 * Theme: driven by `useThemeStore` — dark/light/auto.
 * State: `useLive2DStore` is accessed here for the "model loaded" badge.
 * The actual canvas is in `Live2DViewer.vue` (ref: `live2dViewer`).
 *
 * NOTE: `ControlPanel.vue` is deprecated — do NOT add features there.
 */
import { ref, computed, h, onMounted, type VNode } from "vue";
import { darkTheme } from "naive-ui";
import Live2DViewer from "./components/Live2DViewer.vue";
import ModelSelector from "./components/ModelSelector.vue";
import ModelSettings from "./components/ModelSettings.vue";
import ErrorBoundary from "./components/ErrorBoundary.vue";
import { useLive2DStore } from "./stores/live2d";
import { useThemeStore } from "./stores/theme";
import "./styles/app-styles.css";

const __DEV__ = import.meta.env.DEV;

const live2dViewer = ref<InstanceType<typeof Live2DViewer> | null>(null);
const activeComponentRef = ref<any>(null);
const live2dStore = useLive2DStore();
const themeStore = useThemeStore();

const theme = computed(() => (themeStore.isDark ? darkTheme : null));

const settingsCollapsed = ref(false);
const activeKey = ref("model-selector");

const RETRY_TIMEOUT_MS = 100;

const menuOptions: Array<{ label: string; key: string; icon: () => VNode }> = [
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
];

const componentMap: Record<string, unknown> = {
    "model-selector": ModelSelector,
    "model-settings": ModelSettings,
};

const currentPageTitle = computed(() => {
    const titles: Record<string, string> = {
        "model-selector": "Model Selection",
        "model-settings": "Model Setup",
    };
    return titles[activeKey.value] || "Settings";
});

const currentComponent = computed(() => {
    return componentMap[activeKey.value];
});

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
};

const handleMenuSelect = (key: string) => {
    activeKey.value = key;
    if (settingsCollapsed.value) {
        settingsCollapsed.value = false;
    }
};

const handleModelSelected = (modelData: Record<string, unknown>) => {
    __DEV__ && console.debug("[App] Model selected:", modelData);
    if (live2dViewer.value) {
        (
            live2dViewer.value as unknown as {
                loadModel: (data: Record<string, unknown>) => void;
            }
        ).loadModel(modelData);
    }
};

const handleModelConfigure = (_modelData: Record<string, unknown>) => {
    activeKey.value = "model-settings";
};

const handleBack = () => {
    activeKey.value = "model-selector";
};

const handleSettingsChanged = (_settings: Record<string, unknown>) => {};

const handleComponentError = (errorInfo: unknown) => {
    console.error("Component error:", errorInfo);
};

const handleComponentRetry = () => {
    __DEV__ && console.debug("[App] Component retry");
    const currentKey = activeKey.value;
    activeKey.value = "";
    setTimeout(() => {
        activeKey.value = currentKey;
    }, RETRY_TIMEOUT_MS);
};

onMounted(() => {
    __DEV__ && console.debug("[App] Application initialized");
    themeStore.initTheme();
});
</script>
