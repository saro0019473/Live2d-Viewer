import { defineStore } from "pinia";
import { ref, reactive, watch } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  // 应用设置
  const appSettings = reactive({
    theme: "dark", // 'light', 'dark', 'auto'
    language: "zh-CN",
    autoSave: true,
    autoSaveInterval: 30000, // 30秒
    enableNotifications: true,
    enableSounds: true,
    debugMode: false,
  });

  // 功能模块启用状态
  const moduleSettings = reactive({
    enableLive2D: true,
  });

  // 性能设置
  const performanceSettings = reactive({
    maxFPS: 60,
    enableVSync: true,
    audioBufferSize: 4096,
    maxConcurrentConnections: 5,
    enableHardwareAcceleration: true,
    memoryLimit: 512, // MB
    enableGPUAcceleration: true,
  });

  // 安全设置
  const securitySettings = reactive({
    allowExternalConnections: false,
    enableCORS: true,
    maxRequestSize: 10, // MB
    enableRateLimit: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60000, // 1分钟
    enableEncryption: false,
  });

  // 开发者设置
  const developerSettings = reactive({
    enableDevTools: false,
    enableConsoleLogging: true,
    logLevel: "info", // 'debug', 'info', 'warn', 'error'
    enablePerformanceMonitoring: false,
    enableMemoryMonitoring: false,
    enableNetworkMonitoring: false,
  });

  // 导入/导出设置
  const backupSettings = reactive({
    autoBackup: true,
    backupInterval: 24 * 60 * 60 * 1000, // 24小时
    maxBackups: 10,
    backupLocation: "local",
    includeUserData: true,
    includeModelData: false,
    compressBackups: true,
  });

  // 设置版本和元数据
  const settingsMetadata = ref({
    version: "1.0.0",
    lastModified: Date.now(),
    lastBackup: null,
    configFile: null,
  });

  // 本地存储键名
  const STORAGE_KEY = "vtuber-app-settings";

  // 加载设置
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // 合并设置，保持默认值
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

        console.log("⚙️ [SettingsStore] 设置已从本地存储加载");
      }
    } catch (error) {
      console.error("❌ [SettingsStore] 加载设置失败:", error);
    }
  };

  // 保存设置
  const saveSettings = () => {
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

      console.log("💾 [SettingsStore] 设置已保存到本地存储");
    } catch (error) {
      console.error("❌ [SettingsStore] 保存设置失败:", error);
    }
  };

  // 重置设置
  const resetSettings = () => {
    // 重置为默认值
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

    saveSettings();
    console.log("🔄 [SettingsStore] 设置已重置为默认值");
  };

  // 导出设置
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

    console.log("📤 [SettingsStore] 设置已导出");
  };

  // 导入设置
  const importSettings = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);

          // 验证设置格式
          if (!imported.appSettings && !imported.moduleSettings) {
            throw new Error("无效的设置文件格式");
          }

          // 导入设置
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
          saveSettings();
          console.log("📥 [SettingsStore] 设置已导入");
          resolve();
        } catch (error) {
          console.error("❌ [SettingsStore] 导入设置失败:", error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      reader.readAsText(file);
    });
  };

  // 更新特定设置
  const updateAppSettings = (newSettings) => {
    Object.assign(appSettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  const updateModuleSettings = (newSettings) => {
    Object.assign(moduleSettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  const updatePerformanceSettings = (newSettings) => {
    Object.assign(performanceSettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  const updateSecuritySettings = (newSettings) => {
    Object.assign(securitySettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  const updateDeveloperSettings = (newSettings) => {
    Object.assign(developerSettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  const updateBackupSettings = (newSettings) => {
    Object.assign(backupSettings, newSettings);
    if (appSettings.autoSave) {
      saveSettings();
    }
  };

  // 自动保存监听
  if (typeof window !== "undefined") {
    // 监听设置变化，自动保存
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
          saveSettings();
        }
      },
      { deep: true },
    );

    // 定期自动保存
    setInterval(() => {
      if (appSettings.autoSave) {
        saveSettings();
      }
    }, appSettings.autoSaveInterval);
  }

  // 初始化时加载设置
  loadSettings();

  return {
    // 状态
    appSettings,
    moduleSettings,
    performanceSettings,
    securitySettings,
    developerSettings,
    backupSettings,
    settingsMetadata,

    // 方法
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
