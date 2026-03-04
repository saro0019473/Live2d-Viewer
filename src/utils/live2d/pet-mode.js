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

const __DEV__ = import.meta.env.DEV;

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Returns true when the page is running in pet / desktop-overlay mode.
 * The result is cached after the first call because the query-string never
 * changes at runtime.
 */
let _petModeCache = null;
export function isPetMode() {
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
let _configCache = null;
export function getPetModeConfig() {
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
      powerPreference: "low-power",
    }),
  });

  return _configCache;
}

// ─── CSS style object ─────────────────────────────────────────────────────────

/**
 * Returns a Vue-compatible inline style object for the pet-mode container,
 * or an empty object when not in pet mode.
 */
export function getPetModeStyle() {
  if (!isPetMode()) return {};

  return {
    background: "transparent",
    "-webkit-app-region": "drag",
    position: "absolute",
    width: "100vw",
    height: "100vh",
    pointerEvents: "auto",
    zIndex: 9999,
    userSelect: "none",
    overflow: "hidden",
  };
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handles mouse-enter on the pet-mode container.
 * @param {Object|null} model - Current Live2D hero model (may be null)
 */
export function handlePetModeHover(model) {
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
 * @param {Object|null} model - Current Live2D hero model (may be null)
 */
export function handlePetModeLeave(model) {
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
export function createPetModeAutoInteraction() {
  let _intervalId = null;

  /**
   * @param {() => Object|null} getModel
   */
  function start(getModel) {
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

  function stop() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
      __DEV__ && console.debug("[PetMode] Auto-interaction stopped");
    }
  }

  /** True while the interval is running. */
  function isRunning() {
    return _intervalId !== null;
  }

  return { start, stop, isRunning };
}

// ─── Feature initialisation ───────────────────────────────────────────────────

/**
 * Applies pet-mode specific settings to an already-initialised Live2DManager.
 * Safe to call when not in pet mode — it exits immediately.
 *
 * @param {Object} live2dManager - The Live2DManager instance
 */
export function initPetModeFeatures(live2dManager) {
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
 * @param {Object|null} petModeAutoInteraction - controller returned by
 *   createPetModeAutoInteraction(), or null if not started yet.
 * @returns {{ enabled: boolean, config: Object|null, isActive: boolean }}
 */
export function getPetModeStatus(petModeAutoInteraction = null) {
  const enabled = isPetMode();
  return {
    enabled,
    config: getPetModeConfig(),
    isActive: enabled && (petModeAutoInteraction?.isRunning() ?? false),
  };
}
