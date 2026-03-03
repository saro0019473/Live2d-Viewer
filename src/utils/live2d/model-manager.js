/**
 * Live2D Model Manager
 * Responsible for model loading, removal, lookup, and lifecycle management
 */

import { HeroModel } from "./hero-model.js";
import { createLogger } from "./utils.js";

export class Live2DModelManager {
  constructor(coreManager) {
    this.coreManager = coreManager;
    this.models = new Map();
    this.currentModelId = null;
    this.isPetMode = false;
    this.petModeScale = 0.4; // Default pet mode scale ratio
    this.logger = createLogger("Live2DModelManager");
  }

  /**
   * Set pet mode
   * @param {boolean} enabled - Whether to enable pet mode
   */
  setPetMode(enabled) {
    this.isPetMode = enabled;
    this.logger.log(`🐾 Pet mode ${enabled ? "enabled" : "disabled"}`);

    if (this.coreManager.interactionManager) {
      this.coreManager.interactionManager.setDesktopMode(enabled);
    }

    if (enabled) {
      // In pet mode, model position and scale are handled by interactionManager
      this.models.forEach((model) => {
        if (model.model) {
          model.setScale(this.petModeScale); // Apply pet mode scale
          model.setAnchor(0.5); // Ensure anchor is correct
        }
      });
      // Immediately update desktop mode layout
      if (this.coreManager.interactionManager) {
        this.coreManager.interactionManager.updateDesktopModeLayout();
      }
    } else {
      // Restore original position and size (centered)
      this.repositionModels();
    }
  }

  /**
   * Set pet mode scale ratio
   * @param {number} scale - Scale ratio
   */
  setPetModeScale(scale) {
    if (scale < 0.1 || scale > 2.0) {
      this.logger.warn("⚠️ Scale ratio out of range (0.1-2.0):", scale);
      return;
    }
    this.petModeScale = scale;
    this.logger.log("📏 Set pet mode scale ratio:", scale);

    // If currently in pet mode, immediately apply the new scale ratio
    if (this.isPetMode) {
      this.models.forEach((model) => {
        if (model.model) {
          model.setScale(scale);
        }
      });
    }
  }

  /**
   * Load model
   * @param {Object} modelData - Model data
   */
  async loadModel(modelData) {
    let heroModel = null;
    try {
      const modelId = modelData.id;

      // Check if the model is already loaded
      if (this.models.has(modelId)) {
        return this.models.get(modelId);
      }

      // Create HeroModel instance
      heroModel = new HeroModel(modelId);
      await heroModel.create(modelData.url);

      // Add to scene
      this.addModelToScene(heroModel, modelId);

      // Store model
      this.models.set(modelId, heroModel);

      // Set as current model (if it's the first model)
      if (!this.currentModelId) {
        this.currentModelId = modelId;
      }

      this.logger.log("✅ Model loaded successfully:", modelId);
      return heroModel;
    } catch (error) {
      this.logger.error("❌ Model loading failed:", error);

      // Clean up the failed model instance
      if (heroModel) {
        try {
          heroModel.destroy();
        } catch (cleanupError) {
          this.logger.error("❌ Error cleaning up failed model:", cleanupError);
        }
      }

      throw error;
    }
  }

  /**
   * Refresh model (reload)
   * @param {string} modelId - Model ID
   * @param {Object} modelData - Model data
   */
  async refreshModel(modelId, modelData) {
    try {
      this.logger.log("🔄 Refreshing model:", modelId);

      // Save current model position and state
      const oldModel = this.models.get(modelId);
      let savedPosition = null;
      let savedSettings = null;

      if (oldModel && oldModel.model) {
        savedPosition = {
          x: oldModel.model.position.x,
          y: oldModel.model.position.y,
        };
        savedSettings = {
          scale: oldModel.getScale(),
          angle: oldModel.getAngle(),
          alpha: oldModel.getAlpha(),
        };
      }

      // Remove old model
      this.removeModel(modelId);

      // Load new model
      const newModel = await this.loadModel(modelData);

      // Restore position and settings
      // After refreshing, reapply layout based on current mode
      if (this.isPetMode && this.coreManager.interactionManager) {
        this.coreManager.interactionManager.updateDesktopModeLayout();
      } else if (newModel.model) {
        // Restore position and settings
        if (savedPosition) {
          newModel.model.position.set(savedPosition.x, savedPosition.y);
        } else {
          // Default to center
          newModel.model.position.set(
            this.coreManager.app.screen.width / 2,
            this.coreManager.app.screen.height / 2,
          );
        }
      }

      if (savedSettings) {
        newModel.setScale(savedSettings.scale.x);
        newModel.setAngle(savedSettings.angle);
        newModel.setAlpha(savedSettings.alpha);
      }

      return newModel;
    } catch (error) {
      this.logger.error("❌ Model refresh failed:", error);
      throw error;
    }
  }

  /**
   * Add model to scene
   * @param {HeroModel} heroModel - HeroModel instance
   * @param {string} modelId - Model ID
   */
  addModelToScene(heroModel, modelId) {
    if (!this.coreManager.modelContainer || !heroModel.model) {
      this.logger.warn("⚠️ Cannot add model to scene:", modelId);
      return;
    }

    // Add to model container
    this.coreManager.modelContainer.addChild(heroModel.model);

    // Ensure model visibility
    heroModel.model.visible = true;
    heroModel.model.alpha = 1.0;

    // Apply model layout (position and scale)
    this._applyModelLayout(heroModel);

    this.logger.log("✅ Model added to scene:", modelId, {
      position: heroModel.model.position,
      visible: heroModel.model.visible,
      alpha: heroModel.model.alpha,
      parent: !!heroModel.model.parent,
      scale: heroModel.model.scale,
      isPetMode: this.isPetMode,
      petModeScale: this.petModeScale,
    });
  }

  /**
   * Calculate model position (avoid overlap)
   */
  calculateModelPosition() {
    // Always use center position to ensure model is centered
    return {
      x: this.coreManager.app.screen.width / 2,
      y: this.coreManager.app.screen.height / 2,
    };
  }

  /**
   * Create model foreground
   * @param {HeroModel} heroModel - Model instance
  /**
   * Apply model layout (position and scale)
   * @param {HeroModel} heroModel - HeroModel instance
   * @private
   */
  _applyModelLayout(heroModel) {
    // Set model properties
    heroModel.setAnchor(0.5);

    // Set different scale ratios based on mode
    const scale = this.isPetMode ? this.petModeScale : 0.2;
    heroModel.setScale(scale);

    // Calculate model position
    const position = {
      x: this.coreManager.app.screen.width / 2,
      y: this.coreManager.app.screen.height / 2,
    };

    // Set model position based on mode
    if (this.isPetMode && this.coreManager.interactionManager) {
      // In pet mode, position is handled by interactionManager
      const desktopPosition =
        this.coreManager.interactionManager.calculateDesktopPosition(
          heroModel.id,
        );
      heroModel.model.position.set(desktopPosition.x, desktopPosition.y);
    } else {
      // In non-pet mode, center the model
      heroModel.model.position.set(position.x, position.y);
    }
  }

  /**
   * Remove model
   * @param {string} modelId - Model ID
   */
  removeModel(modelId) {
    const heroModel = this.models.get(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Attempting to remove non-existent model:", modelId);
      return;
    }

    this.logger.log("🗑️ Removing model:", modelId);

    try {
      // 1. Clean up interaction event listeners (if interaction manager exists)
      if (this.coreManager.interactionManager) {
        try {
          this.coreManager.interactionManager.cleanupModelEventListeners(
            modelId,
          );
          this.logger.log("🧹 Cleaned up model interaction events:", modelId);
        } catch (error) {
          this.logger.error(
            "❌ Failed to clean up interaction events:",
            modelId,
            error,
          );
        }
      }

      // 2. Use HeroModel's destroy method to destroy the model
      heroModel.destroy();

      // 4. Delete from mapping
      this.models.delete(modelId);

      // 5. If the removed model was the current model, select a new current model
      if (this.currentModelId === modelId) {
        const remainingIds = Array.from(this.models.keys());
        this.currentModelId = remainingIds.length > 0 ? remainingIds[0] : null;
        this.logger.log(
          "🎯 Current model removed, new current model:",
          this.currentModelId,
        );
      }

      this.logger.log("✅ Model removal complete:", modelId, {
        remainingModels: this.models.size,
        currentModel: this.currentModelId,
      });
    } catch (error) {
      this.logger.error("❌ Failed to remove model:", error);
      throw error;
    }
  }

  /**
   * Reposition all models
   */
  repositionModels() {
    // In non-pet mode, models should always be centered
    // In pet mode, position is handled by interactionManager
    this.models.forEach((heroModel) => {
      if (heroModel.model) {
        heroModel.model.position.set(
          this.coreManager.app.screen.width / 2,
          this.coreManager.app.screen.height / 2,
        );
      }
    });
    // If in pet mode, re-trigger layout update
    if (this.isPetMode && this.coreManager.interactionManager) {
      this.coreManager.interactionManager.updateDesktopModeLayout();
    }
  }

  // === Query methods ===

  /**
   * Get model
   */
  getModel(modelId) {
    return this.models.get(modelId);
  }

  /**
   * Check if model exists
   */
  hasModel(modelId) {
    return this.models.has(modelId);
  }

  /**
   * Get all models
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Get all model IDs
   */
  getAllModelIds() {
    return Array.from(this.models.keys());
  }

  /**
   * Get model ID by model instance
   * @param {HeroModel} heroModel - Model instance
   * @returns {string|null} Model ID
   */
  getModelId(heroModel) {
    for (const [modelId, model] of this.models.entries()) {
      if (model === heroModel) {
        return modelId;
      }
    }
    return null;
  }

  /**
   * Get current active model
   */
  getCurrentModel() {
    if (!this.currentModelId || !this.models.has(this.currentModelId)) {
      return null;
    }
    return this.models.get(this.currentModelId);
  }

  /**
   * Set current active model
   */
  setCurrentModel(modelId) {
    if (this.hasModel(modelId)) {
      this.currentModelId = modelId;
      this.logger.log("🎯 Set current model:", modelId);
    } else {
      this.logger.warn("⚠️ Model does not exist:", modelId);
    }
  }

  /**
   * Get first available model
   */
  getFirstAvailableModel() {
    const modelIds = Array.from(this.models.keys());
    if (modelIds.length === 0) return null;
    return this.models.get(modelIds[0]);
  }

  /**
   * Get model count
   */
  getModelCount() {
    return this.models.size;
  }

  /**
   * Clear all models
   */
  clear() {
    this.models.forEach((_, modelId) => {
      this.removeModel(modelId);
    });
    this.models.clear();
    this.currentModelId = null;
  }
}
