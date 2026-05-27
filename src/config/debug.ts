/**
 * Debug Configuration
 * Controls the log output level throughout the application
 */

// Debug configuration interface
export interface DebugConfig {
  DEBUG_MODE: boolean;
  DEBUG_LIVE2D: boolean;
  [key: string]: boolean;
}

export type DebugLevel = "info" | "warn" | "error" | "debug";

// Debug configuration object
export const debugConfig: DebugConfig = {
  // Global debug mode
  DEBUG_MODE:
    import.meta.env.DEV || localStorage.getItem("DEBUG_MODE") === "true",

  // Live2D debug
  DEBUG_LIVE2D: localStorage.getItem("DEBUG_LIVE2D") === "true",
};

// Set debug mode
export const setDebugMode = (mode: string, value: boolean = true): void => {
  if (mode === "all") {
    // Set all debug modes
    Object.keys(debugConfig).forEach((key) => {
      if (key.startsWith("DEBUG_")) {
        debugConfig[key] = value;
        localStorage.setItem(key, value.toString());
      }
    });
  } else {
    // Set a specific debug mode
    const key = `DEBUG_${mode.toUpperCase()}`;
    if (key in debugConfig) {
      debugConfig[key] = value;
      localStorage.setItem(key, value.toString());
    }
  }

  // Update global variables
  updateGlobalDebugVars();
};

// Get debug mode status
export const getDebugMode = (mode: string): boolean => {
  if (mode === "all") {
    return Object.keys(debugConfig).every(
      (key) => key.startsWith("DEBUG_") && debugConfig[key],
    );
  }

  const key = `DEBUG_${mode.toUpperCase()}`;
  return debugConfig[key] || false;
};

// Update global debug variables
export const updateGlobalDebugVars = (): void => {
  (window as any).DEBUG_MODE = debugConfig.DEBUG_MODE;
  (window as any).DEBUG_LIVE2D = debugConfig.DEBUG_LIVE2D;
};

// Initialize debug configuration
export const initDebugConfig = (): void => {
  updateGlobalDebugVars();

  // Display debug configuration info in development environment
  if (import.meta.env.DEV) {
    console.log("🔧 Debug configuration initialized:", debugConfig);
  }
};

// Export debug utility function
export const debugLog = (module: string, message: string, level: DebugLevel = "info"): void => {
  const prefix = `[${module}]`;
  const timestamp = new Date().toISOString();

  switch (level) {
    case "error":
      console.error(`${timestamp} ${prefix} ${message}`);
      break;
    case "warn":
      console.warn(`${timestamp} ${prefix} ${message}`);
      break;
    case "debug":
      if (debugConfig.DEBUG_MODE) {
        console.log(`${timestamp} ${prefix} ${message}`);
      }
      break;
    default:
      console.log(`${timestamp} ${prefix} ${message}`);
  }
};

// Default export
export default debugConfig;
