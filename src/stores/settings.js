import { defineStore } from "pinia";
import { ref, reactive, watch, onScopeDispose } from "vue";

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
  // Application settings
  const appSettings = reactive({
    theme: "dark", // 'light', 'dark', 'auto'
    language: "zh-CN",
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    enableNotifications: true,
    enableSounds: true,
    debugMode: false,
  });

  // Feature module enable status
  const moduleSettings = reactive({
    enableLive2D: true,
  });

  // Performance settings
  const performanceSettings = reactive({
    maxFPS: 60,
    enableVSync: true,
    audioBufferSize: 4096,
    maxConcurrentConnections: 5,
    enableHardwareAcceleration: true,
    memoryLimit: 512, // MB
    enableGPUAcceleration: true,
  });

  // Security settings
  const securitySettings = reactive({
    allowExternalConnections: false,
    enableCORS: true,
    maxRequestSize: 10, // MB
    enableRateLimit: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60000, // 1 minute
    enableEncryption: false,
  });

  // Developer settings
  const developerSettings = reactive({
    enableDevTools: false,
    enableConsoleLogging: true,
    logLevel: "info", // 'debug', 'info', 'warn', 'error'
    enablePerformanceMonitoring: false,
    enableMemoryMonitoring: false,
    enableNetworkMonitoring: false,
  });

  // Import/export settings
  const backupSettings = reactive({
    autoBackup: true,
    backupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxBackups: 10,
    backupLocation: "local",
    includeUserData: true,
    includeModelData: false,
    compressBackups: true,
  });

  // Settings version and metadata
  const settingsMetadata = ref({
    version: "1.0.0",
    lastModified: Date.now(),
    lastBackup: null,
    configFile: null,
  });

  // Local storage key name
  const STORAGE_KEY = "vtuber-app-settings";

  // ── Internal save (synchronous write to localStorage) ──────────────────────────
  const _saveSettingsImmediate = () => {
    try {
      const settings = {
        appSettings: { ...appSettings },
        moduleSettings: { ...moduleSettings },
        performanceSettings: { ...performanceSettings },
        securitySettings: { ...securitySettings },
        developerSettings: { ...developerSettings },
        backupSettings: { ...backupSettings },
        settingsMetadata: {
          ...settingsMetadata.value,
          lastModified: Date.now(),
        },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      settingsMetadata.value.lastModified = Date.now();

      console.log("💾 [SettingsStore] Settings saved to local storage");
    } catch (error) {
      console.error("❌ [SettingsStore] Failed to save settings:", error);
    }
  };

  // Debounced save — coalesces rapid changes into one write (500 ms)
  const _debouncedSave = debounce(_saveSettingsImmediate, 500);

  // Public API keeps backward-compat name; callers that truly need
  // an immediate flush (reset / import) use `_saveSettingsImmediate`.
  const saveSettings = () => {
    _debouncedSave();
  };

  // Load settings
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        if (parsed.appSettings) {
          Object.assign(appSettings, parsed.appSettings);
        }
        if (parsed.moduleSettings) {
          Object.assign(moduleSettings, parsed.moduleSettings);
        }
        if (parsed.performanceSettings) {
          Object.assign(performanceSettings, parsed.performanceSettings);
        }
        if (parsed.securitySettings) {
          Object.assign(securitySettings, parsed.securitySettings);
        }
        if (parsed.developerSettings) {
          Object.assign(developerSettings, parsed.developerSettings);
        }
        if (parsed.backupSettings) {
          Object.assign(backupSettings, parsed.backupSettings);
        }
        if (parsed.settingsMetadata) {
          settingsMetadata.value = {
            ...settingsMetadata.value,
            ...parsed.settingsMetadata,
          };
        }

        console.log("⚙️ [SettingsStore] Settings loaded from local storage");
      }
    } catch (error) {
      console.error("❌ [SettingsStore] Failed to load settings:", error);
    }
  };

  // Reset settings
  const resetSettings = () => {
    Object.assign(appSettings, {
      theme: "dark",
      language: "zh-CN",
      autoSave: true,
      autoSaveInterval: 30000,
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

    Object.assign(securitySettings, {
      allowExternalConnections: false,
      enableCORS: true,
      maxRequestSize: 10,
      enableRateLimit: true,
      rateLimitRequests: 100,
      rateLimitWindow: 60000,
      enableEncryption: false,
    });

    Object.assign(developerSettings, {
      enableDevTools: false,
      enableConsoleLogging: true,
      logLevel: "info",
      enablePerformanceMonitoring: false,
      enableMemoryMonitoring: false,
      enableNetworkMonitoring: false,
    });

    Object.assign(backupSettings, {
      autoBackup: true,
      backupInterval: 24 * 60 * 60 * 1000,
      maxBackups: 10,
      backupLocation: "local",
      includeUserData: true,
      includeModelData: false,
      compressBackups: true,
    });

    settingsMetadata.value = {
      version: "1.0.0",
      lastModified: Date.now(),
      lastBackup: null,
      configFile: null,
    };

    // Reset needs an immediate flush — the watch debounce would
    // be too late because the user might reload right away.
    _debouncedSave.cancel();
    _saveSettingsImmediate();
    console.log("🔄 [SettingsStore] Settings reset to default values");
  };

  // Export settings
  const exportSettings = () => {
    const settings = {
      appSettings: { ...appSettings },
      moduleSettings: { ...moduleSettings },
      performanceSettings: { ...performanceSettings },
      securitySettings: { ...securitySettings },
      developerSettings: { ...developerSettings },
      backupSettings: { ...backupSettings },
      settingsMetadata: {
        ...settingsMetadata.value,
        exportedAt: Date.now(),
      },
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vtuber-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("📤 [SettingsStore] Settings exported");
  };

  // Import settings
  const importSettings = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);

          // Validate settings format
          if (!imported.appSettings && !imported.moduleSettings) {
            throw new Error("Invalid settings file format");
          }

          if (imported.appSettings) {
            Object.assign(appSettings, imported.appSettings);
          }
          if (imported.moduleSettings) {
            Object.assign(moduleSettings, imported.moduleSettings);
          }
          if (imported.performanceSettings) {
            Object.assign(performanceSettings, imported.performanceSettings);
          }
          if (imported.securitySettings) {
            Object.assign(securitySettings, imported.securitySettings);
          }
          if (imported.developerSettings) {
            Object.assign(developerSettings, imported.developerSettings);
          }
          if (imported.backupSettings) {
            Object.assign(backupSettings, imported.backupSettings);
          }

          // Immediate flush so imported data is persisted right away
          _debouncedSave.cancel();
          _saveSettingsImmediate();
          console.log("📥 [SettingsStore] Settings imported");
          resolve();
        } catch (error) {
          console.error("❌ [SettingsStore] Failed to import settings:", error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("File read failed"));
      };

      reader.readAsText(file);
    });
  };

  // ── Update helpers ──────────────────────────────────────────
  // They only mutate the reactive object. The deep-watch (below)
  // handles the debounced save — no manual saveSettings() needed.
  const updateAppSettings = (newSettings) => {
    Object.assign(appSettings, newSettings);
  };

  const updateModuleSettings = (newSettings) => {
    Object.assign(moduleSettings, newSettings);
  };

  const updatePerformanceSettings = (newSettings) => {
    Object.assign(performanceSettings, newSettings);
  };

  const updateSecuritySettings = (newSettings) => {
    Object.assign(securitySettings, newSettings);
  };

  const updateDeveloperSettings = (newSettings) => {
    Object.assign(developerSettings, newSettings);
  };

  const updateBackupSettings = (newSettings) => {
    Object.assign(backupSettings, newSettings);
  };

  // ── Auto-save: single debounced deep-watch ─────────────────
  // This is the ONLY automatic persistence path. The `updateXxx`
  // methods above just mutate state and let this watch handle it.
  let _autoSaveInterval = null;

  if (typeof window !== "undefined") {
    watch(
      [
        appSettings,
        moduleSettings,
        performanceSettings,
        securitySettings,
        developerSettings,
        backupSettings,
      ],
      () => {
        if (appSettings.autoSave) {
          _debouncedSave();
        }
      },
      { deep: true },
    );

    // Periodic backup save — as a safety net, not the primary
    // persistence path. Uses the immediate variant so it is not
    // coalesced away by the debounce timer.
    _autoSaveInterval = setInterval(() => {
      if (appSettings.autoSave) {
        _saveSettingsImmediate();
      }
    }, appSettings.autoSaveInterval);
  }

  // ── Cleanup on scope dispose (prevents interval leak) ──────
  onScopeDispose(() => {
    _debouncedSave.cancel();
    if (_autoSaveInterval !== null) {
      clearInterval(_autoSaveInterval);
      _autoSaveInterval = null;
    }
  });

  // Load settings on initialization
  loadSettings();

  return {
    // State
    appSettings,
    moduleSettings,
    performanceSettings,
    securitySettings,
    developerSettings,
    backupSettings,
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
    updateSecuritySettings,
    updateDeveloperSettings,
    updateBackupSettings,
  };
});
