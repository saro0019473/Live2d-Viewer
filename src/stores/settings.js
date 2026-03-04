import { defineStore } from "pinia";
import { ref, reactive, watch, onScopeDispose } from "vue";

// Level-aware logger for the settings store.
// Only "debug" messages are silenced in production; warn/error always surface.
const __DEV__ = import.meta.env.DEV;
const _log = {
  debug: (...args) => __DEV__ && console.debug("[SettingsStore]", ...args),
  info: (...args) => __DEV__ && console.log("[SettingsStore]", ...args),
  warn: (...args) => console.warn("[SettingsStore]", ...args),
  error: (...args) => console.error("[SettingsStore]", ...args),
};

/**
 * Debounce helper — returns a debounced version of `fn`.
 * The returned function also exposes `.cancel()` for cleanup.
 */
function debounce(fn, delay) {
  let timer = null;
  const debounced = (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

export const useSettingsStore = defineStore("settings", () => {
  // ── Application settings ───────────────────────────────────────────────────
  const appSettings = reactive({
    theme: "dark", // 'light' | 'dark' | 'auto'
    language: "zh-CN",
    autoSave: true,
    enableNotifications: true,
    enableSounds: true,
    debugMode: false,
  });

  // ── Feature-module flags ───────────────────────────────────────────────────
  const moduleSettings = reactive({
    enableLive2D: true,
  });

  // ── Performance settings ───────────────────────────────────────────────────
  const performanceSettings = reactive({
    maxFPS: 60,
    enableVSync: true,
    audioBufferSize: 4096,
    maxConcurrentConnections: 5,
    enableHardwareAcceleration: true,
    memoryLimit: 512, // MB
    enableGPUAcceleration: true,
  });

  // ── Metadata ───────────────────────────────────────────────────────────────
  const settingsMetadata = ref({
    version: "1.0.0",
    lastModified: Date.now(),
    lastBackup: null,
    configFile: null,
  });

  // ── Persistence ────────────────────────────────────────────────────────────
  const STORAGE_KEY = "vtuber-app-settings";

  const _saveSettingsImmediate = () => {
    try {
      const snapshot = {
        appSettings: { ...appSettings },
        moduleSettings: { ...moduleSettings },
        performanceSettings: { ...performanceSettings },
        settingsMetadata: {
          ...settingsMetadata.value,
          lastModified: Date.now(),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      settingsMetadata.value.lastModified = Date.now();
      _log.info("💾 Settings saved");
    } catch (error) {
      _log.error("❌ Failed to save settings:", error);
    }
  };

  // Debounced save — coalesces rapid mutations into one localStorage write.
  const _debouncedSave = debounce(_saveSettingsImmediate, 500);

  // Public alias (keeps any future callers working).
  const saveSettings = () => _debouncedSave();

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);

      if (parsed.appSettings) Object.assign(appSettings, parsed.appSettings);
      if (parsed.moduleSettings)
        Object.assign(moduleSettings, parsed.moduleSettings);
      if (parsed.performanceSettings)
        Object.assign(performanceSettings, parsed.performanceSettings);
      if (parsed.settingsMetadata)
        settingsMetadata.value = {
          ...settingsMetadata.value,
          ...parsed.settingsMetadata,
        };

      _log.info("⚙️ Settings loaded");
    } catch (error) {
      _log.error("❌ Failed to load settings:", error);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetSettings = () => {
    Object.assign(appSettings, {
      theme: "dark",
      language: "zh-CN",
      autoSave: true,
      enableNotifications: true,
      enableSounds: true,
      debugMode: false,
    });

    Object.assign(moduleSettings, {
      enableLive2D: true,
    });

    Object.assign(performanceSettings, {
      maxFPS: 60,
      enableVSync: true,
      audioBufferSize: 4096,
      maxConcurrentConnections: 5,
      enableHardwareAcceleration: true,
      memoryLimit: 512,
      enableGPUAcceleration: true,
    });

    settingsMetadata.value = {
      version: "1.0.0",
      lastModified: Date.now(),
      lastBackup: null,
      configFile: null,
    };

    // Flush immediately so a quick reload picks up the reset values.
    _debouncedSave.cancel();
    _saveSettingsImmediate();
    _log.info("🔄 Settings reset to defaults");
  };

  // ── Export / Import ────────────────────────────────────────────────────────
  const exportSettings = () => {
    const snapshot = {
      appSettings: { ...appSettings },
      moduleSettings: { ...moduleSettings },
      performanceSettings: { ...performanceSettings },
      settingsMetadata: { ...settingsMetadata.value, exportedAt: Date.now() },
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    _log.info("📤 Settings exported");
  };

  const importSettings = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);

          if (!imported.appSettings && !imported.moduleSettings)
            throw new Error("Invalid settings file format");

          if (imported.appSettings)
            Object.assign(appSettings, imported.appSettings);
          if (imported.moduleSettings)
            Object.assign(moduleSettings, imported.moduleSettings);
          if (imported.performanceSettings)
            Object.assign(performanceSettings, imported.performanceSettings);

          _debouncedSave.cancel();
          _saveSettingsImmediate();
          _log.info("📥 Settings imported");
          resolve();
        } catch (error) {
          _log.error("❌ Failed to import settings:", error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });

  // ── Update helpers ─────────────────────────────────────────────────────────
  // Each mutates the reactive object; the watcher below handles persistence.
  const updateAppSettings = (s) => Object.assign(appSettings, s);
  const updateModuleSettings = (s) => Object.assign(moduleSettings, s);
  const updatePerformanceSettings = (s) =>
    Object.assign(performanceSettings, s);

  // ── Auto-save watcher ──────────────────────────────────────────────────────
  // A single debounced deep-watcher replaces the old polling interval.
  // It only runs when autoSave is enabled, preventing unnecessary writes.
  if (typeof window !== "undefined") {
    watch(
      [appSettings, moduleSettings, performanceSettings],
      () => {
        if (appSettings.autoSave) _debouncedSave();
      },
      { deep: true },
    );
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  onScopeDispose(() => {
    _debouncedSave.cancel();
  });

  // Load persisted settings on store creation.
  loadSettings();

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    appSettings,
    moduleSettings,
    performanceSettings,
    settingsMetadata,

    // Methods
    loadSettings,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
    updateAppSettings,
    updateModuleSettings,
    updatePerformanceSettings,
  };
});
