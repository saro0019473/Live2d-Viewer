/**
 * Pet Mode Helper
 *
 * Isolates all pet-mode (desktop/Electron overlay) concerns so that the main
 * Live2DViewer component stays clean when running in normal web mode.
 *
 * Pet mode is activated when the page is loaded with ?mode=pet in the URL, or
 * when running inside the bundled Electron shell.
 *
 * Usage:
 *   import { isPetMode, getPetModeConfig, getPetModeStyle,
 *            createPetModeAutoInteraction } from './pet-mode.js';
 */

import type { CSSProperties } from "vue";

const __DEV__ = import.meta.env.DEV;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PetModeConfig {
  autoHide: boolean;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  autoInteraction: boolean;
  reducedAnimation: boolean;
  interaction: {
    clickSensitivity: number;
    hoverResponse: boolean;
    edgeSnap: boolean;
    autoMove: boolean;
  };
  performance: {
    maxFPS: number;
    minFPS: number;
    enableCulling: boolean;
    enableBatching: boolean;
    textureGCMode: string;
    antialias: boolean;
    powerPreference: string;
  };
}

export interface AutoInteractionController {
  start: (getModel: () => any) => void;
  stop: () => void;
  isRunning: () => boolean;
}

export interface PetModeStatus {
  enabled: boolean;
  config: PetModeConfig | null;
  isActive: boolean;
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Returns true when the page is running in pet / desktop-overlay mode.
 * The result is cached after the first call because the query-string never
 * changes at runtime.
 */
let _petModeCache: boolean | null = null;
export function isPetMode(): boolean {
  if (_petModeCache !== null) return _petModeCache;
  _petModeCache =
    typeof window !== "undefined" &&
    window.location.search.includes("mode=pet");
  return _petModeCache;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Returns the static pet-mode configuration object, or null when not in pet
 * mode.  The object is created once and reused (cheap computed equivalent).
 */
let _configCache: PetModeConfig | null = null;
export function getPetModeConfig(): PetModeConfig | null {
  if (!isPetMode()) return null;
  if (_configCache) return _configCache;

  _configCache = Object.freeze({
    // Window behaviour (Electron)
    autoHide: true,
    alwaysOnTop: true,
    clickThrough: false,

    // Interaction
    autoInteraction: true,
    reducedAnimation: false,

    interaction: Object.freeze({
      clickSensitivity: 1.2,
      hoverResponse: true,
      edgeSnap: true,
      autoMove: false,
    }),

    // Rendering
    performance: Object.freeze({
      maxFPS: 60,
      minFPS: 60,
      enableCulling: true,
      enableBatching: true,
      textureGCMode: "aggressive",
      antialias: false,
      powerPreference: "low-power" as const,
    }),
  }) as unknown as PetModeConfig;

  return _configCache;
}

// ─── CSS style object ─────────────────────────────────────────────────────────

/**
 * Returns a Vue-compatible inline style object for the pet-mode container,
 * or an empty object when not in pet mode.
 */
export function getPetModeStyle(): CSSProperties {
  if (!isPetMode()) return {};

  return {
    background: "transparent",
    WebkitAppRegion: "drag", // Vue uses camelCase for CSS properties, WebkitAppRegion maps to -webkit-app-region
    position: "absolute",
    width: "100vw",
    height: "100vh",
    pointerEvents: "auto",
    zIndex: 9999,
    userSelect: "none",
    overflow: "hidden",
  } as CSSProperties;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handles mouse-enter on the pet-mode container.
 * @param model - Current Live2D hero model (may be null)
 */
export function handlePetModeHover(model: any): void {
  try {
    const config = getPetModeConfig();
    if (model && config?.interaction?.hoverResponse) {
      model.playRandomMotion?.();
      __DEV__ && console.debug("[PetMode] Hover response triggered");
    }
  } catch (err) {
    console.error("[PetMode] Hover handler failed:", err);
  }
}

/**
 * Handles mouse-leave on the pet-mode container.
 * @param model - Current Live2D hero model (may be null)
 */
export function handlePetModeLeave(model: any): void {
  try {
    __DEV__ && console.debug("[PetMode] Hover leave");
    void model; // reserved for future on-leave animation
  } catch (err) {
    console.error("[PetMode] Leave handler failed:", err);
  }
}

// ─── Auto-interaction ─────────────────────────────────────────────────────────

/**
 * Creates a self-contained auto-interaction controller.
 *
 * Returns an object with:
 *   start(getModel)  — begins the randomised interaction interval.
 *                      `getModel` is a callback that returns the current model
 *                      (or null) at the time each tick fires.
 *   stop()           — clears the interval and resets state.
 *
 * Example:
 *   const autoInteract = createPetModeAutoInteraction();
 *   autoInteract.start(() => live2dManager.getCurrentModel());
 *   // later …
 *   autoInteract.stop();
 */
export function createPetModeAutoInteraction(): AutoInteractionController {
  let _intervalId: any = null;

  function start(getModel: () => any): void {
    if (!isPetMode()) return;

    stop(); // clear any previous interval

    // Randomise the interval between 30 s and 60 s so the interaction feels
    // natural and is not obviously periodic.
    const intervalMs = 30_000 + Math.random() * 30_000;

    _intervalId = setInterval(() => {
      try {
        const config = getPetModeConfig();
        const model = getModel?.();
        if (!model || !config?.autoInteraction) return;

        if (Math.random() > 0.5) {
          model.playRandomMotion?.();
        } else {
          model.playRandomExpression?.();
        }
        __DEV__ && console.debug("[PetMode] Auto-interaction tick fired");
      } catch (err) {
        console.error("[PetMode] Auto-interaction tick failed:", err);
      }
    }, intervalMs);

    __DEV__ &&
      console.debug(
        `[PetMode] Auto-interaction started (interval: ${Math.round(intervalMs / 1000)} s)`,
      );
  }

  function stop(): void {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
      __DEV__ && console.debug("[PetMode] Auto-interaction stopped");
    }
  }

  /** True while the interval is running. */
  function isRunning(): boolean {
    return _intervalId !== null;
  }

  return { start, stop, isRunning };
}

// ─── Feature initialisation ───────────────────────────────────────────────────

/**
 * Applies pet-mode specific settings to an already-initialised Live2DManager.
 * Safe to call when not in pet mode — it exits immediately.
 *
 * @param live2dManager - The Live2DManager instance
 */
export function initPetModeFeatures(live2dManager: any): void {
  if (!isPetMode() || !live2dManager) return;

  __DEV__ && console.debug("[PetMode] Initialising pet mode features…");

  try {
    if (typeof live2dManager.setPetInteraction === "function") {
      live2dManager.setPetInteraction(true);
    }
    if (typeof live2dManager.setPerformanceMode === "function") {
      live2dManager.setPerformanceMode("pet");
    }
    __DEV__ && console.debug("[PetMode] Pet mode features initialised");
  } catch (err) {
    console.error("[PetMode] Failed to initialise pet mode features:", err);
  }
}

/**
 * Returns a status snapshot for diagnostics / the global live2d API.
 *
 * @param petModeAutoInteraction - controller returned by
 *   createPetModeAutoInteraction(), or null if not started yet.
 * @returns Pet mode status snapshot
 */
export function getPetModeStatus(
  petModeAutoInteraction: AutoInteractionController | null = null
): PetModeStatus {
  const enabled = isPetMode();
  return {
    enabled,
    config: getPetModeConfig(),
    isActive: enabled && (petModeAutoInteraction?.isRunning() ?? false),
  };
}
