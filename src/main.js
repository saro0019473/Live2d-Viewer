import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./style.css";

// Import optimization utilities
import { globalResourceManager } from "./utils/resource-manager.js";
import { globalStateSyncManager } from "./utils/live2d/state-sync-manager.js";

// Import debug configuration
import { initDebugConfig } from "./config/debug.js";

// Naive UI
import {
  create,
  // Components
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NCard,
  NButton,
  NSelect,
  NSlider,
  NSwitch,
  NInputNumber,
  NColorPicker,
  NForm,
  NFormItem,
  NSpin,
  NMessageProvider,
  NModal,
  NPopconfirm,
  NGrid,
  NGridItem,
  NSpace,
  NDivider,
  NIcon,
  NTooltip,
  NCollapse,
  NCollapseItem,
  NTabs,
  NTabPane,
  NTag,
  NInput,
  NInputGroup,
  NButtonGroup,
  NText,
  NList,
  NListItem,
  NThing,
  NEmpty,
  NScrollbar,
  darkTheme,
} from "naive-ui";

const naive = create({
  components: [
    NConfigProvider,
    NLayout,
    NLayoutHeader,
    NLayoutSider,
    NLayoutContent,
    NMenu,
    NCard,
    NButton,
    NSelect,
    NSlider,
    NSwitch,
    NInputNumber,
    NColorPicker,
    NForm,
    NFormItem,
    NSpin,
    NMessageProvider,
    NModal,
    NPopconfirm,
    NGrid,
    NGridItem,
    NSpace,
    NDivider,
    NIcon,
    NTooltip,
    NCollapse,
    NCollapseItem,
    NTabs,
    NTabPane,
    NTag,
    NInput,
    NInputGroup,
    NButtonGroup,
    NText,
    NList,
    NListItem,
    NThing,
    NEmpty,
    NScrollbar,
  ],
});

function mountApp() {
  // Create app instance
  const app = createApp(App);

  // Use Pinia state management
  app.use(createPinia());

  // Use Naive UI
  app.use(naive);

  // Mount app
  app.mount("#app");

  // Post-startup initialization
  console.log("🚀 Application started");
  console.log(
    "📊 Resource manager status:",
    globalResourceManager.getResourceCount(),
  );

  // Initialize debug configuration
  initDebugConfig();

  // Enable Live2D debug mode by default in development
  if (import.meta.env.DEV) {
    if (!localStorage.getItem("DEBUG_LIVE2D")) {
      window.DEBUG_LIVE2D = true;
      localStorage.setItem("DEBUG_LIVE2D", "true");
      console.log("🔧 Development: Live2D debug mode auto-enabled");
    }
  }

  // Expose global resource manager in development mode
  if (import.meta.env.DEV) {
    window.globalResourceManager = globalResourceManager;
    window.globalStateSyncManager = globalStateSyncManager;
    console.log("🔧 Development: Global managers exposed to window object");
  }
}

// Wait for Live2D libraries to be ready before mounting
if (window.__live2dReady) {
  // Libraries already loaded by the time this module executes
  mountApp();
} else {
  // Libraries not yet ready — wait for the signal from index.html
  window.addEventListener("live2d-ready", () => mountApp(), { once: true });
}
