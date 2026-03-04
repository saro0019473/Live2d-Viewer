/**
 * Live2D Manager - Main Manager
 * Integrates all sub-managers and provides a unified API interface
 */

import { Live2DCoreManager } from "./core-manager.js";
import { Live2DModelManager } from "./model-manager.js";
import { Live2DInteractionManager } from "./interaction-manager.js";
import { Live2DAnimationManager } from "./animation-manager.js";
import {
  getRecommendedSettings,
  checkWebGLSupport,
  createLogger,
} from "./utils.js";

export class Live2DManager {
  constructor(container) {
    this.container = container;
    this.logger = createLogger("Live2DManager");

    // Initialize sub-managers
    this.coreManager = new Live2DCoreManager(container);
    this.modelManager = new Live2DModelManager(this.coreManager);
    this.animationManager = new Live2DAnimationManager(this.modelManager);

    // interactionManager will be created after coreManager is initialized
    this.interactionManager = null;

    this.isInitialized = false;
  }

  /**
   * Initialize the Live2D manager
   * @param {Object} options - Initialization options
   */
  async init(options = {}) {
    try {
      this.logger.log("Starting initialization...");

      // Check WebGL support
      if (!checkWebGLSupport()) {
        throw new Error("Browser does not support WebGL, cannot run Live2D");
      }

      // Get recommended settings
      const recommendedSettings = getRecommendedSettings();
      const settings = { ...recommendedSettings, ...options };

      // Initialize core manager
      await this.coreManager.init();

      // Apply performance optimization settings
      this.coreManager.optimizePerformance(settings);

      // Create interactionManager after coreManager is initialized
      this.interactionManager = new Live2DInteractionManager(
        this.coreManager,
        this.modelManager,
      );
      if (this.interactionManager) {
        this.interactionManager.initialize();
      }

      this.isInitialized = true;
      this.logger.log("Initialization complete");

      return true;
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  // === Model Management API ===

  /**
   * Load a model
   * @param {Object} modelData - Model data
   * @returns {Promise<Object>} Loaded model instance
   */
  async loadModel(modelData) {
    try {
      this.logger.log("Starting model load:", modelData.id);

      // Use model manager to load the model
      const heroModel = await this.modelManager.loadModel(modelData);

      if (heroModel) {
        // interactionManager always exists after init
        // Bind interaction events
        this.interactionManager.bindModelInteractionEvents(
          modelData.id,
          heroModel,
        );
        this.logger.log("Model loaded successfully:", modelData.id);
      }

      return heroModel;
    } catch (error) {
      this.logger.error("Model loading failed:", error);
      throw error;
    }
  }

  /**
   * Unload a model
   * @param {string} modelId - Model ID
   */
  unloadModel(modelId) {
    try {
      this.logger.log("Starting model unload:", modelId);

      // Clean up interaction event listeners
      if (this.interactionManager) {
        this.interactionManager.cleanupModelEventListeners(modelId);
      }

      // Use model manager to unload the model
      this.modelManager.unloadModel(modelId);

      this.logger.log("Model unloaded successfully:", modelId);
    } catch (error) {
      this.logger.error("Model unload failed:", error);
    }
  }

  /**
   * Switch model
   * @param {Object} modelData - New model data
   * @returns {Promise<Object>} New model instance
   */
  async switchModel(modelData) {
    try {
      this.logger.log("Starting model switch:", modelData.id);

      // Unload current model
      const currentModel = this.modelManager.getCurrentModel();
      if (currentModel) {
        // interactionManager always exists after init
        this.interactionManager.cleanupModelEventListeners(currentModel.id);
        this.modelManager.unloadModel(currentModel.id);
      }

      // Load new model
      const newModel = await this.loadModel(modelData);

      // Bind interaction events for the new model
      if (newModel) {
        // interactionManager always exists after init
        this.interactionManager.bindModelInteractionEvents(
          modelData.id,
          newModel,
        );
      }

      this.logger.log("Model switch successful:", modelData.id);
      return newModel;
    } catch (error) {
      this.logger.error("Model switch failed:", error);
      throw error;
    }
  }

  /**
   * Auto-fit model to canvas size
   * @param {HeroModel} heroModel - Model instance
   */
  autoFitModelToCanvas(heroModel) {
    if (!heroModel || !this.container) return;

    try {
      const canvasWidth = this.container.clientWidth;
      const canvasHeight = this.container.clientHeight;

      if (canvasWidth > 0 && canvasHeight > 0) {
        // Use a more conservative height ratio; landscape models will auto-adapt
        heroModel.autoFitToCanvas(canvasWidth, canvasHeight, 0.5);
      }
    } catch (error) {
      this.logger.debug(`Auto-fit to canvas failed: ${error.message}`);
    }
  }

  /**
   * Remove a model
   * @param {string} modelId - Model ID
   */
  removeModel(modelId) {
    this.logger.log("Starting model removal:", modelId);

    try {
      const heroModel = this.modelManager.getModel(modelId);
      if (!heroModel) {
        this.logger.warn("Model does not exist:", modelId);
        return;
      }

      // 1. Stop all animations
      try {
        if (this.animationManager) {
          this.animationManager.stopAllAnimations(modelId);
          this.logger.log("Stopped model animations:", modelId);
        }
      } catch (e) {
        this.logger.warn(`Failed to stop animations: ${e.message}`);
      }

      // 2. Clean up interaction events
      try {
        if (this.interactionManager) {
          this.interactionManager.cleanupModelEventListeners(modelId);
          this.logger.log("Cleaned up model interaction events:", modelId);
        }
      } catch (e) {
        this.logger.warn(`Failed to clean up interaction events: ${e.message}`);
      }

      // 3. Remove from model manager (this triggers model destruction)
      try {
        this.modelManager.removeModel(modelId);
        this.logger.log("Removed from model manager:", modelId);
      } catch (e) {
        this.logger.error(`Failed to remove from model manager: ${e.message}`);
        throw e;
      }

      this.logger.log(`Model removal complete: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to remove model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh a model
   */
  async refreshModel(modelId, modelData) {
    // Clean up old interaction events
    if (this.interactionManager) {
      this.interactionManager.cleanupModelEventListeners(modelId);
    }

    // Refresh the model
    const heroModel = await this.modelManager.refreshModel(modelId, modelData);

    // Re-bind interaction events
    if (heroModel && this.interactionManager) {
      this.interactionManager.bindModelInteractionEvents(modelId, heroModel);
    }

    return heroModel;
  }

  /**
   * Get a model
   * @param {string} modelId - Model ID
   * @returns {HeroModel|null} Model instance
   */
  getModel(modelId) {
    return this.modelManager.getModel(modelId);
  }

  /**
   * Check if a model exists
   * @param {string} modelId - Model ID
   * @returns {boolean} Whether the model exists
   */
  hasModel(modelId) {
    return this.modelManager.hasModel(modelId);
  }

  /**
   * Get all models
   * @returns {HeroModel[]} All model instances
   */
  getAllModels() {
    return this.modelManager.getAllModels();
  }

  /**
   * Get all model IDs
   * @returns {string[]} All model IDs
   */
  getAllModelIds() {
    return this.modelManager.getAllModelIds();
  }

  /**
   * Get the current model
   * @returns {HeroModel|null} Current model instance
   */
  getCurrentModel() {
    return this.modelManager.getCurrentModel();
  }

  /**
   * Set the current model
   * @param {string} modelId - Model ID
   */
  setCurrentModel(modelId) {
    this.modelManager.setCurrentModel(modelId);
  }

  /**
   * Get the first available model
   * @returns {HeroModel|null} First available model
   */
  getFirstAvailableModel() {
    return this.modelManager.getFirstAvailableModel();
  }

  // === Animation Control API ===

  /**
   * Play a motion
   */
  async playMotion(modelId, group, index, priority = 2) {
    return this.animationManager.playMotion(modelId, group, index, priority);
  }

  /**
   * Play a motion on loop — re-triggers the motion automatically each time it
   * finishes until stopMotionLoop() is called.
   * @param {string} modelId  - Model ID
   * @param {string} group    - Motion group name
   * @param {number} index    - Motion index within the group
   * @param {number} priority - Playback priority (default 2 = NORMAL)
   */
  async playMotionLoop(modelId, group, index, priority = 2) {
    return this.animationManager.playMotionLoop(
      modelId,
      group,
      index,
      priority,
    );
  }

  /**
   * Stop the motion loop for a model.
   * @param {string} modelId - Model ID
   */
  stopMotionLoop(modelId) {
    return this.animationManager.stopMotionLoop(modelId);
  }

  /**
   * Check whether a motion loop is currently active for a model.
   * @param {string} modelId - Model ID
   * @returns {boolean}
   */
  isMotionLooping(modelId) {
    return this.animationManager.isLooping(modelId);
  }

  /**
   * Play a random motion
   */
  async playRandomMotion(modelId, group = null) {
    return this.animationManager.playRandomMotion(modelId, group);
  }

  /**
   * Set an expression
   */
  setExpression(modelId, expressionIndex) {
    return this.animationManager.setExpression(modelId, expressionIndex);
  }

  /**
   * Play a random expression
   */
  playRandomExpression(modelId) {
    return this.animationManager.playRandomExpression(modelId);
  }

  /**
   * Batch control expressions
   */
  batchControlExpressions(expressions, modelIds = null) {
    return this.animationManager.batchControlExpressions(expressions, modelIds);
  }

  /**
   * Batch control motions
   */
  async batchControlMotions(motions, modelIds = null) {
    return this.animationManager.batchControlMotions(motions, modelIds);
  }

  /**
   * Play audio
   */
  async playAudio(audioUrl, options = {}) {
    return this.animationManager.playAudio(audioUrl, options);
  }

  /**
   * Stop audio
   */
  stopAudio() {
    this.animationManager.stopAudio();
  }

  /**
   * Get audio status
   */
  getAudioStatus() {
    return this.animationManager.getAudioStatus();
  }

  // === Interaction Control API ===

  /**
   * Set interaction enabled state
   * @param {boolean} enabled - Whether to enable
   */
  setInteractionEnabled(enabled) {
    if (this.interactionManager) {
      this.interactionManager.setInteractionEnabled(enabled);
      this.logger.log(`🖱️ Interaction ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Set model position
   * @param {string} modelId - Model ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setModelPosition(modelId, x, y) {
    if (this.interactionManager) {
      return this.interactionManager.setModelPosition(modelId, x, y);
    }
  }

  /**
   * Get current zoom settings
   * @returns {Object|null} Current zoom settings
   */
  getZoomSettings() {
    if (!this.interactionManager) {
      return null;
    }

    try {
      return this.interactionManager.getZoomSettings();
    } catch (error) {
      this.logger.error("Failed to get zoom settings:", error);
      return null;
    }
  }

  /**
   * Update zoom settings
   * @param {Object} settings - Zoom settings object
   * @param {number} [settings.zoomSpeed] - Zoom step
   * @param {number} [settings.minScale] - Minimum scale value
   * @param {number} [settings.maxScale] - Maximum scale value
   */
  updateZoomSettings(settings) {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot update zoom settings",
      );
      return;
    }

    try {
      this.interactionManager.updateZoomSettings(settings);
      this.logger.log("Zoom settings updated:", settings);
    } catch (error) {
      this.logger.error("Failed to update zoom settings:", error);
    }
  }

  /**
   * Set wheel zoom enabled state
   * @param {boolean} enabled - Whether to enable wheel zoom
   */
  setWheelZoomEnabled(enabled) {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot set wheel zoom",
      );
      return;
    }

    try {
      this.interactionManager.setWheelZoomEnabled(enabled);
      this.logger.log("Wheel zoom state set:", enabled);
    } catch (error) {
      this.logger.error("Failed to set wheel zoom state:", error);
    }
  }

  // === Performance and Settings API ===

  /**
   * Update performance settings
   */
  updatePerformanceSettings(settings) {
    this.coreManager.optimizePerformance(settings);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return this.coreManager.getPerformanceStats();
  }

  /**
   * Pause/resume rendering
   */
  setPaused(paused) {
    this.coreManager.setPaused(paused);
  }

  /**
   * Update canvas dimensions
   */
  resize(width, height) {
    this.coreManager.resize(width, height);
    this.modelManager.repositionModels();

    // Auto-fit all models to the new canvas size
    this.autoFitAllModelsToCanvas(width, height);
  }

  /**
   * Auto-fit all models to canvas size
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  autoFitAllModelsToCanvas(width, height) {
    if (!width || !height) return;

    try {
      const models = this.modelManager.getAllModels();
      models.forEach((heroModel) => {
        if (heroModel && heroModel.autoFitToCanvas) {
          // Use a more conservative height ratio; landscape models will auto-adapt
          heroModel.autoFitToCanvas(width, height, 0.5);
        }
      });
    } catch (error) {
      this.logger.debug(
        `Failed to auto-fit all models to canvas: ${error.message}`,
      );
    }
  }

  /**
   * Destroy the Live2D manager
   */
  destroy() {
    this.logger.log("Starting Live2D manager destruction...");

    try {
      // Destroy interaction manager
      if (this.interactionManager) {
        this.interactionManager.destroy();
      }

      // Destroy other managers
      if (this.animationManager) {
        this.animationManager.destroy();
      }

      if (this.modelManager) {
        this.modelManager.destroy();
      }

      if (this.coreManager) {
        this.coreManager.destroy();
      }

      this.isInitialized = false;
      this.logger.log("Live2D manager destruction complete");
    } catch (error) {
      this.logger.error(`Failed to destroy Live2D manager: ${error.message}`);
    }
  }

  // === Direct sub-manager access ===
  get interaction() {
    return this.interactionManager;
  }

  get model() {
    return this.modelManager;
  }

  get animation() {
    return this.animationManager;
  }

  get core() {
    return this.coreManager;
  }
}

// Note:
// Sub-manager APIs can now be accessed directly via live2dManager.interaction.xxx(), live2dManager.animation.xxx(), etc.
// The original simple forwarding methods have been removed; using sub-managers directly is recommended.
