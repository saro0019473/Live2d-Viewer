/**
 * HeroModel Class
 * Wraps Live2D model loading, control, and information retrieval
 */

import { waitForLive2D, createLogger } from "./utils.js";

// Higher-order function: unified null check
const withModelCheck = (method, operationName = "operation") => {
  return function (...args) {
    if (!this.model) {
      this.logger.warn(`⚠️ Model not loaded, cannot perform ${operationName}`);
      return false;
    }
    if (!this.model.internalModel && operationName.includes("parameter")) {
      this.logger.warn(
        `⚠️ Internal model not ready, cannot perform ${operationName}`,
      );
      return false;
    }
    return method.apply(this, args);
  };
};

// Higher-order function: unified error handling
const withErrorHandling = (method, operationName = "operation") => {
  return async function (...args) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      this.logger.error(`❌ ${operationName} failed:`, error);
      return false;
    }
  };
};

// Unified parameter operation utilities
const ParameterUtils = {
  // Set parameter value
  setParameterValue(
    model,
    paramId,
    value,
    parametersValues,
    weight = 1,
    logger,
  ) {
    if (!model?.internalModel?.coreModel) return false;

    try {
      model.internalModel.coreModel.setParameterValueById(
        paramId,
        value,
        weight,
      );

      // Sync update internal storage
      const paramIndex = parametersValues.parameter?.findIndex(
        (param) => param.parameterIds === paramId,
      );
      if (paramIndex !== -1) {
        parametersValues.parameter[paramIndex].defaultValue = value;
      }
      return true;
    } catch (error) {
      logger.error("Failed to set parameter:", error);
      return false;
    }
  },

  // Set part opacity
  setPartOpacity(model, partId, value, parametersValues, logger) {
    if (!model?.internalModel?.coreModel) return false;

    try {
      model.internalModel.coreModel.setPartOpacityById(partId, value);

      // Sync update internal storage
      const part = parametersValues.partOpacity?.find(
        (p) => p.partId === partId,
      );
      if (part) {
        part.defaultValue = value;
      }
      return true;
    } catch (error) {
      logger.error("Failed to set part opacity:", error);
      return false;
    }
  },
};

export class HeroModel {
  constructor(id, model) {
    this.id = id;
    this.model = model;
    this._destroyed = false;
    this.logger = createLogger(`HeroModel:${this.id}`);

    // Model-related properties
    this.modelName = "";
    this.costume = "";
    this.cubismModelSettings = null;
    this.rawModelSettings = null;

    // Cached data
    this.cachedExpressions = [];
    this.cachedMotions = {};
    this.parametersValues = {};

    // Foreground object
    this.foreground = null;
  }

  /**
   * Asynchronously create and load a Live2D model
   * @param {string} src - URL or path of the model settings file
   */
  async create(src) {
    try {
      // Wait for local PIXI Live2D library to fully load
      await waitForLive2D();

      this.logger.log("🔄 Starting model creation:", src);

      // Verify necessary global classes exist
      if (!window.PIXI.live2d.Cubism4ModelSettings) {
        throw new Error(
          "❌ Local Cubism4ModelSettings not loaded, please check /libs/cubism4.min.js",
        );
      }
      if (!window.PIXI.live2d.Live2DModel) {
        throw new Error(
          "❌ Local Live2DModel not loaded, please check /libs/cubism4.min.js",
        );
      }

      // Fetch model settings JSON file (only fetch once)
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(
          `Model settings file load failed: ${response.status} ${response.statusText}`,
        );
      }

      const settingsJSON = await response.json();
      settingsJSON.url = src;

      this.logger.log("📄 Raw settings JSON:", settingsJSON);

      // Create Cubism4ModelSettings instance
      this.cubismModelSettings = new window.PIXI.live2d.Cubism4ModelSettings(
        settingsJSON,
      );

      // Create model using the already-built ModelSettings instance to avoid Live2DModel.from()
      // fetching the same JSON again (pass settings object instead of raw JSON)
      this.model = await window.PIXI.live2d.Live2DModel.from(
        this.cubismModelSettings,
      );

      // Verify model instance
      if (!this.model) {
        throw new Error("Model creation failed: model instance is null");
      }

      // Save raw settings JSON
      this.rawModelSettings = settingsJSON;

      // Set initial position and scale
      this.model.position.set(0, 0);
      this.model.scale.set(0.2); // Use the configured default scale value

      // Initialize parameters after model is fully loaded
      if (this.model.internalModel) {
        this.initializeParameters();
      } else {
        // Listen for model ready event
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Model initialization timeout"));
          }, 30000);

          this.model.once("ready", () => {
            clearTimeout(timeout);
            this.logger.log(
              "📢 Model ready event fired, initializing parameters",
            );
            this.initializeParameters();
            resolve();
          });

          this.model.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      }

      // Immediately cache expression and motion data
      this.cacheModelData();

      return this;
    } catch (error) {
      this.logger.error("❌ Creation failed:", error);

      // Clean up resources
      if (this.model) {
        try {
          this.model.removeAllListeners();
          this.model.destroy({
            children: true,
            texture: true,
            baseTexture: true,
          });
        } catch (cleanupError) {
          this.logger.error("❌ Error cleaning up failed model:", cleanupError);
        }
      }

      throw error;
    }
  }

  /**
   * Cache model data (expressions, motions, etc.)
   */
  cacheModelData() {
    // Cache expression data
    this.cachedExpressions = this.cubismModelSettings.expressions || [];

    // Cache motion data
    this.cachedMotions = this.cubismModelSettings.motions || {};
  }

  initializeParameters(retries = 5, delay = 200) {
    if (this._destroyed) {
      this.logger.log(
        "Model already destroyed, cancelling parameter initialization.",
      );
      return;
    }

    if (
      !this.model ||
      !this.model.internalModel ||
      !this.model.internalModel.coreModel
    ) {
      this.logger.warn(
        "⚠️ Internal model or core model not ready, cannot initialize parameters.",
      );
      if (retries > 0) {
        this.logger.log(
          `[HeroModel] Will retry parameter initialization in ${delay}ms... (${retries} remaining)`,
        );
        setTimeout(() => this.initializeParameters(retries - 1, delay), delay);
      } else {
        this.logger.error(
          "❌ [HeroModel] Parameter initialization failed, max retries reached.",
        );
      }
      return;
    }

    this.parametersValues = {};
    this.logger.log(
      "⚙️ [HeroModel] initializeParameters: Starting parameter initialization.",
    );
    const coreModel = this.model.internalModel.coreModel;

    // Prefer reading parameter definitions from model settings file (.model3.json)
    this.parametersValues.parameter = [];
    if (this.rawModelSettings && this.rawModelSettings.Parameters) {
      const paramDefs = this.rawModelSettings.Parameters;
      this.logger.log(
        `⚙️ [HeroModel] Found ${paramDefs.length} parameters in JSON definitions.`,
      );

      for (const paramDef of paramDefs) {
        const paramId = paramDef.Id;
        const paramIndex = coreModel.getParameterIndex(paramId);

        if (paramIndex === -1) {
          this.logger.warn(
            `⚠️ Parameter ID "${paramId}" not found in core model.`,
          );
          continue;
        }

        const parameter = {
          parameterIds: paramId,
          max: coreModel.getParameterMaximumValue(paramIndex),
          min: coreModel.getParameterMinimumValue(paramIndex),
          defaultValue: coreModel.getParameterDefaultValue(paramIndex),
        };
        this.parametersValues.parameter.push(parameter);
      }
      this.logger.log(
        `✅ [HeroModel] Successfully initialized ${this.parametersValues.parameter.length} parameters from JSON definitions.`,
      );
    } else {
      // If not defined in JSON, fall back to getting IDs from Live2DCubismCore.Model
      this.logger.log(
        "ℹ️ No parameter definitions found in model JSON, falling back to core model traversal.",
      );

      // The correct way is to get the underlying model from coreModel.getModel(), then access its parameters
      const live2dCoreModel = coreModel.getModel();
      const parameterIds = live2dCoreModel.parameters.ids;
      const parameterCount = live2dCoreModel.parameters.count;

      if (parameterCount === 0 && retries > 0) {
        this.logger.warn(
          `⚠️ [HeroModel] Found 0 parameters, model may not be fully loaded. Will retry in ${delay}ms.`,
        );
        setTimeout(() => this.initializeParameters(retries - 1, delay), delay);
        return;
      }

      for (let i = 0; i < parameterCount; i++) {
        const paramId = parameterIds[i];
        // getParameterIndex is on coreModel (CubismModel), not the Live2DCubismCore.Model
        const paramIndex = coreModel.getParameterIndex(paramId);
        if (paramIndex === -1) {
          this.logger.warn(
            `⚠️ Parameter ID "${paramId}" index not found in core model.`,
          );
          continue;
        }
        this.parametersValues.parameter.push({
          parameterIds: paramId,
          max: coreModel.getParameterMaximumValue(paramIndex),
          min: coreModel.getParameterMinimumValue(paramIndex),
          defaultValue: coreModel.getParameterDefaultValue(paramIndex),
        });
      }
      this.logger.log(
        `✅ [HeroModel] Successfully initialized ${this.parametersValues.parameter.length} parameters from core model traversal.`,
      );
    }

    // Initialize parts (logic unchanged)
    this.parametersValues.partOpacity = [];
    const partCount = coreModel.getPartCount();
    this.logger.log(`⚙️ [HeroModel] Found ${partCount} core model parts.`);
    for (let i = 0; i < partCount; i++) {
      const partId = coreModel.getPartId(i);
      this.parametersValues.partOpacity.push({
        partId: partId,
        defaultValue: coreModel.getPartOpacityByIndex(i),
      });
    }
    this.logger.log(
      `✅ [HeroModel] Successfully initialized ${this.parametersValues.partOpacity.length} parts.`,
    );

    // Sanity check and retry logic
    // If parameter list is empty but part list is not, parameters may not have loaded correctly - retry
    if (
      this.parametersValues.parameter.length === 0 &&
      this.parametersValues.partOpacity.length > 0 &&
      retries > 0
    ) {
      this.logger.warn(
        `⚠️ [HeroModel] Parameter count is 0 after initialization, but part count is ${this.parametersValues.partOpacity.length}. Possible loading timing issue, will retry in ${delay}ms.`,
      );
      setTimeout(() => this.initializeParameters(retries - 1, delay), delay);
      return; // Must return to prevent subsequent code execution
    }
  }

  /**
   * Set model name and costume name
   * @param {string} char - Character name
   * @param {string} cost - Costume name
   */
  setName(char, cost) {
    this.modelName = char;
    this.costume = cost;
  }

  // Optimize all setter/getter methods using higher-order functions
  setAnchor = withModelCheck(function (x, y) {
    this.model.anchor.set(x, y);
  }, "set anchor");

  getAnchor() {
    if (!this.model) return { x: 0.5, y: 0.5 };
    return { x: this.model.anchor.x, y: this.model.anchor.y };
  }

  setScale = withModelCheck(function (val) {
    this.model.scale.set(val);
  }, "set scale");

  getScale() {
    if (!this.model) return { x: 1, y: 1 };
    return { x: this.model.scale.x, y: this.model.scale.y };
  }

  setVisible = withModelCheck(function (val) {
    this.model.visible = val;
  }, "set visibility");

  getVisible() {
    if (!this.model) return false;
    return this.model.visible;
  }

  setAngle = withModelCheck(function (val) {
    this.model.angle = val;
  }, "set angle");

  getAngle() {
    if (!this.model) return 0;
    return this.model.angle;
  }

  setAlpha = withModelCheck(function (val) {
    this.model.alpha = val;
  }, "set alpha");

  getAlpha() {
    if (!this.model) return 1;
    return this.model.alpha;
  }

  setPosition = withModelCheck(function (x, y) {
    this.model.position.set(x, y);
  }, "set position");

  getPosition() {
    if (!this.model) return { x: 0, y: 0 };
    return { x: this.model.position.x, y: this.model.position.y };
  }

  /**
   * Set foreground
   * @param {PIXI.Sprite} sprite - Foreground sprite
   */
  setForeground(sprite) {
    if (!this.model) return;
    this.foreground = sprite;
    this.model.addChild(sprite);
  }

  /**
   * Set breathing animation - optimized version
   * @param {boolean} bool - Whether to enable breathing
   */
  setBreathing = withModelCheck(function (bool) {
    this.model.breathing = bool;

    if (!this.model.internalModel?.breath) {
      this.logger.warn("⚠️ Breathing feature not available");
      return;
    }

    try {
      // If parametersValues.breath is not initialized, try to get from internal model
      if (!this.parametersValues.breath) {
        const breathParams = this.model.internalModel.breath.getParameters();
        this.parametersValues.breath = breathParams ? [...breathParams] : [];
      }

      // Use setParameters method to set breathing parameters
      if (
        bool &&
        this.parametersValues.breath &&
        this.parametersValues.breath.length > 0
      ) {
        this.model.internalModel.breath.setParameters([
          ...this.parametersValues.breath,
        ]);
      } else {
        this.model.internalModel.breath.setParameters([]);
      }

      this.logger.log(
        `🫁 Breathing animation ${bool ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      this.logger.error("❌ Failed to set breathing parameters:", error);
    }
  }, "set breathing");

  /**
   * Set eye blinking animation - optimized version
   * @param {boolean} bool - Whether to enable eye blinking
   */
  setEyeBlinking = withModelCheck(function (bool) {
    this.model.eyeBlinking = bool;
    if (!this.model.internalModel?.eyeBlink) {
      this.logger.warn("⚠️ Eye blinking feature not available");
      return;
    }

    try {
      // If parametersValues.eyeBlink is not initialized, try to get from internal model
      if (!this.parametersValues.eyeBlink) {
        const eyeBlinkParams =
          this.model.internalModel.eyeBlink.getParameterIds();
        this.parametersValues.eyeBlink = eyeBlinkParams
          ? [...eyeBlinkParams]
          : [];
      }

      // Use setParameterIds method to set eye blinking parameters
      if (
        bool &&
        this.parametersValues.eyeBlink &&
        this.parametersValues.eyeBlink.length > 0
      ) {
        this.model.internalModel.eyeBlink.setParameterIds([
          ...this.parametersValues.eyeBlink,
        ]);
      } else {
        this.model.internalModel.eyeBlink.setParameterIds([]);
      }

      this.logger.log(
        `👁️ Eye blinking animation ${bool ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      this.logger.error("❌ Failed to set eye blinking parameters:", error);
    }
  }, "set eye blinking");

  /**
   * Set interactivity - optimized version
   * @param {boolean} bool - Whether interactive
   */
  setInteractive = withModelCheck(function (bool) {
    this.model.interactive = bool;
    this.logger.log(`🖱️ Interactivity ${bool ? "enabled" : "disabled"}`);
  }, "set interactivity");

  /**
   * Set gaze tracking - optimized version
   * @param {boolean} bool - Whether to follow mouse
   */
  setLookatMouse = withModelCheck(function (bool) {
    this.model.focusing = bool;

    if (!bool) {
      // Reset gaze to center position
      this.model.focus(this.model.x, this.model.y);
    }
  }, "set gaze tracking");

  /**
   * Play expression - optimized version
   * @param {number} index - Expression index
   * @returns {boolean} Whether playback was successful
   */
  setExpression = withModelCheck(function (index) {
    try {
      if (!this.model.internalModel) {
        this.logger.warn("⚠️ Internal model not ready");
        return false;
      }

      const expressions =
        this.model.internalModel.settings.expressions || this.cachedExpressions;
      if (!expressions || !expressions[index]) {
        this.logger.warn(`⚠️ Invalid expression index: ${index}`);
        return false;
      }

      this.model.expression(index);
      this.logger.log(`😊 Expression played: ${expressions[index].Name}`);
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to play expression:", error);
      return false;
    }
  }, "play expression");

  /**
   * Play motion - optimized version
   * @param {string} group - Motion group name
   * @param {number} index - Motion index
   * @returns {boolean} Whether playback was successful
   */
  playMotion = withErrorHandling(
    withModelCheck(async function (group, index) {
      if (!this.model.internalModel) {
        this.logger.warn("⚠️ Internal model not ready");
        return false;
      }

      const motionManager = this.model.internalModel.motionManager;
      if (!motionManager) {
        this.logger.warn("⚠️ Motion manager not ready");
        return false;
      }

      // If the motion is not an idle motion, automatically switch to a random idle motion after playback ends
      // if (group !== "idle") {
      //   motionManager.once("motionFinish", () => {
      //     this.playRandomMotion("idle");
      //   });
      // }

      const success = await motionManager.startMotion(group, index);

      if (success) {
        this.logger.log(`🎬 Motion played: ${group}_${index}`);
      } else {
        this.logger.warn(`⚠️ Motion playback failed: ${group}_${index}`);
      }
      return success;
    }, "play motion"),
    "play motion",
  );

  /**
   * Save current model state
   * @returns {Object} Current state
   */
  saveCurrentState() {
    if (!this.model) return null;

    const state = {
      scale: this.getScale(),
      angle: this.getAngle(),
      alpha: this.getAlpha(),
      position: {
        x: this.model.position.x,
        y: this.model.position.y,
      },
    };

    // Save parameter state
    state.parameters = {};
    if (this.model?.internalModel?.coreModel) {
      const coreModel = this.model.internalModel.coreModel;
      const live2dCoreModel = coreModel.getModel();
      const parameterCount = live2dCoreModel.parameters.count;
      const parameterIds = live2dCoreModel.parameters.ids;

      for (let i = 0; i < parameterCount; i++) {
        const paramId = parameterIds[i];
        state.parameters[paramId] = coreModel.getParameterValueByIndex(i);
      }
    }

    // Save part opacity state
    state.partOpacity = {};
    if (this.model?.internalModel?.coreModel) {
      const coreModel = this.model.internalModel.coreModel;
      const partCount = coreModel.getPartCount();
      for (let i = 0; i < partCount; i++) {
        const partId = coreModel.getPartId(i);
        state.partOpacity[partId] = coreModel.getPartOpacityByIndex(i);
      }
    }

    return state;
  }

  /**
   * Restore model state
   * @param {Object} state - State to restore
   */
  restoreState(state) {
    if (!state || !this.model) return;

    try {
      // Restore basic properties
      if (state.scale) {
        this.setScale(state.scale.x);
      }
      if (state.angle !== undefined) {
        this.setAngle(state.angle);
      }
      if (state.alpha !== undefined) {
        this.setAlpha(state.alpha);
      }
      if (state.position) {
        this.model.position.set(state.position.x, state.position.y);
      }

      // Restore parameter state
      if (state.parameters && this.model?.internalModel?.coreModel) {
        Object.entries(state.parameters).forEach(([paramId, value]) => {
          this.model.internalModel.coreModel.setParameterValueById(
            paramId,
            value,
          );
        });
      }

      // Restore part opacity state
      if (state.partOpacity && this.model?.internalModel?.coreModel) {
        Object.entries(state.partOpacity).forEach(([partId, value]) => {
          this.model.internalModel.coreModel.setPartOpacityById(partId, value);
        });
      }

      this.logger.log("🔄 Model state restored");
    } catch (error) {
      this.logger.error("❌ Failed to restore state:", error);
    }
  }

  /**
   * Schedule state restoration
   * @param {Object} initialState - Initial state
   * @param {string} group - Motion group
   * @param {number} index - Motion index
   */
  scheduleStateRestore(initialState, group, index) {
    if (!initialState) return;

    // Get motion duration (from motion data)
    const motionGroup = this.cachedMotions[group];
    const motion = motionGroup ? motionGroup[index] : null;
    const duration = motion?.Duration || 3000; // Default 3 seconds

    // Set timer to restore state after motion ends
    setTimeout(() => {
      // Check if still playing the same motion
      if (
        this.model &&
        this.model.internalModel &&
        this.model.internalModel.motionManager
      ) {
        const motionManager = this.model.internalModel.motionManager;
        // Use MotionManager's public API to check current motion state
        if (motionManager.state && motionManager.state.isActive(group, index)) {
          // Motion still playing, continue waiting
          this.scheduleStateRestore(initialState, group, index);
        } else {
          // Motion ended, restore state
          this.restoreState(initialState);
        }
      } else {
        // Cannot check state, restore directly
        this.restoreState(initialState);
      }
    }, duration + 500); // Extra 500ms buffer time
  }

  /**
   * Play random motion
   * @param {string} group - Motion group (optional)
   */
  playRandomMotion = withModelCheck(async function (group = null) {
    const availableGroups = Object.keys(this.cachedMotions);
    if (availableGroups.length === 0) {
      this.logger.warn("⚠️ No available motion groups");
      return false;
    }

    // Select motion group
    const targetGroup =
      group ||
      availableGroups[Math.floor(Math.random() * availableGroups.length)];
    const motionGroup = this.cachedMotions[targetGroup];

    if (!motionGroup || motionGroup.length === 0) {
      this.logger.warn("⚠️ Motion group is empty:", targetGroup);
      return false;
    }

    // Select random motion index
    const randomIndex = Math.floor(Math.random() * motionGroup.length);

    return this.playMotion(targetGroup, randomIndex);
  }, "play random motion");

  /**
   * Stop all motions
   */
  stopAllMotions() {
    if (
      !this.model ||
      !this.model.internalModel ||
      !this.model.internalModel.motionManager
    ) {
      return;
    }
    this.model.internalModel.motionManager.stopAllMotions();
  }

  /**
   * Play random expression
   */
  playRandomExpression() {
    if (this.cachedExpressions.length === 0) {
      this.logger.warn("⚠️ No available expressions");
      return false;
    }

    const randomIndex = Math.floor(
      Math.random() * this.cachedExpressions.length,
    );
    return this.setExpression(randomIndex);
  }

  /**
   * Get current expression index
   * @returns {number|null} Current expression index, or null if none
   */
  getCurrentExpressionIndex() {
    if (
      !this.model ||
      !this.model.internalModel ||
      !this.model.internalModel.expressionManager
    ) {
      this.logger.debug(
        "ℹ️ Cannot get current expression: model or expression manager not ready",
      );
      return null;
    }
    try {
      const expressionManager = this.model.internalModel.expressionManager;
      const currentExpressionName = expressionManager.getCurrentExpression(); // Assumes this method returns current expression name

      if (currentExpressionName) {
        const index = this.cachedExpressions.findIndex(
          (expr) => expr.Name === currentExpressionName,
        );
        if (index !== -1) {
          return index;
        }
      }
      return null;
    } catch (error) {
      this.logger.error("❌ Failed to get current expression index:", error);
      return null;
    }
  }

  /**
   * Get the base URL of the model (directory containing the model settings file)
   * @returns {string|null} Base URL
   */
  getModelBaseUrl() {
    const url = this.cubismModelSettings?.url || this.rawModelSettings?.url;
    if (!url) return null;
    // Remove the filename to get the directory path
    const lastSlash = url.lastIndexOf("/");
    return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : "./";
  }

  /**
   * Get the audio URL for a specific motion
   * @param {string} group - Motion group name
   * @param {number} index - Motion index within the group
   * @returns {string|null} Resolved audio URL, or null if no audio
   */
  getMotionAudioUrl(group, index) {
    const motionGroup = this.cachedMotions[group];
    if (!motionGroup || !motionGroup[index]) return null;

    const motion = motionGroup[index];
    // Live2D models use "Sound" or "Audio" field for audio file path
    const audioPath = motion.Sound || motion.Audio;
    if (!audioPath) return null;

    const baseUrl = this.getModelBaseUrl();
    if (!baseUrl) return null;

    // Resolve relative path against the model base URL
    return new URL(audioPath, baseUrl).href;
  }

  /**
   * Get motion data
   */
  getMotions() {
    return this.cachedMotions;
  }

  /**
   * Get expression data
   */
  getExpressions() {
    return this.cachedExpressions;
  }

  /**
   * Get all parameter data
   */
  getAllParameters() {
    const params = this.parametersValues.parameter || [];
    this.logger.log(
      "⚙️ [HeroModel] getAllParameters: returning parameter count:",
      params.length,
    );
    return params;
  }

  /**
   * Get all part opacity data
   */
  getAllPartOpacity() {
    const parts = this.parametersValues.partOpacity || [];
    this.logger.log(
      "⚙️ [HeroModel] getAllPartOpacity: returning part count:",
      parts.length,
    );
    return parts;
  }

  /**
   * Set parameter value - using unified utility
   * @param {string} paramId - Parameter ID
   * @param {number} value - Parameter value
   * @param {number} weight - Weight
   */
  setParameters(paramId, value, weight = 1) {
    return ParameterUtils.setParameterValue(
      this.model,
      paramId,
      value,
      this.parametersValues,
      weight,
      this.logger,
    );
  }

  /**
   * Set part opacity - using unified utility
   * @param {string} partId - Part ID
   * @param {number} value - Opacity value
   */
  setPartOpacity(partId, value) {
    return ParameterUtils.setPartOpacity(
      this.model,
      partId,
      value,
      this.parametersValues,
      this.logger,
    );
  }

  /**
   * Set foreground visibility - optimized version
   * @param {boolean} visible - Whether visible
   */
  setForegroundVisible = withModelCheck(function (visible) {
    if (this.foreground) {
      this.foreground.visible = visible;
      this.logger.log(`🎨 Foreground visibility set: ${visible}`);
    }
  }, "set foreground visibility");

  /**
   * Set model properties
   * @param {object} modelData - Object containing model data
   */
  setModelProperties(modelData) {
    this.modelName = modelData.name || "";
    this.costume = modelData.costume || "";
    this.setAnchor(modelData.anchorX, modelData.anchorY);
    this.setScale(modelData.scaleX || 1);
    this.setVisible(modelData.visible || true);
    this.setAngle(modelData.angle || 0);
    this.setAlpha(modelData.alpha || 1);
  }

  /**
   * Destroy model and all its resources
   */
  destroy() {
    if (this._destroyed) {
      this.logger.warn("destroy() called more than once for model:", this.id);
      return;
    }
    this._destroyed = true;
    this.logger.log("🗑️ Starting model destruction:", this.id);

    try {
      // 1. Stop all motions and expressions
      try {
        this.stopAllMotions();
      } catch (e) {
        this.logger.warn("⚠️ Failed to stop motions:", e);
      }

      // 2. Remove all event listeners
      if (this.model && typeof this.model.removeAllListeners === "function") {
        try {
          this.model.removeAllListeners();
        } catch (e) {
          this.logger.warn("⚠️ Failed to remove event listeners:", e);
        }
      }

      // 3. Remove from parent container
      if (this.model && this.model.parent) {
        try {
          this.model.parent.removeChild(this.model);
        } catch (e) {
          this.logger.warn("⚠️ Failed to remove from parent container:", e);
        }
      }

      // 4. Destroy foreground object
      if (this.foreground) {
        try {
          if (this.foreground.parent) {
            this.foreground.parent.removeChild(this.foreground);
          }
          if (typeof this.foreground.destroy === "function") {
            this.foreground.destroy({
              children: true,
              texture: true,
              baseTexture: true,
            });
          }
        } catch (e) {
          this.logger.warn("⚠️ Failed to destroy foreground object:", e);
        }
        this.foreground = null;
      }

      // 5. Destroy main model
      if (this.model) {
        try {
          if (typeof this.model.destroy === "function") {
            if (this.model.children) {
              this.model.children.forEach((child) => {
                try {
                  if (child && typeof child.destroy === "function") {
                    child.destroy({
                      children: true,
                      texture: true,
                      baseTexture: true,
                    });
                  }
                } catch (e) {
                  this.logger.warn("⚠️ Failed to destroy child object:", e);
                }
              });
            }
            this.model.destroy({
              children: true,
              texture: true,
              baseTexture: true,
            });
          } else {
            this.logger.warn("⚠️ Model object has no destroy method");
          }
        } catch (e) {
          this.logger.warn("⚠️ Failed to destroy main model:", e);
        }
        // Now null out internal model and related properties
        if (this.model.internalModel) {
          this.model.internalModel = null;
        }
        this.model = null;
      }

      // 6. Clean up other resources
      this.cubismModelSettings = null;
      this.rawModelSettings = null;
      this.parametersValues = {};
      this.cachedExpressions = [];
      this.cachedMotions = {};

      this.logger.log("✅ Model destruction complete:", this.id);
    } catch (error) {
      this.logger.error("❌ Failed to destroy model:", error);
      throw error;
    }
  }

  /**
   * Auto-fit to canvas size
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {number} targetHeightRatio - Target height ratio (default 0.5, i.e. model height is 50% of canvas height)
   */
  autoFitToCanvas = withModelCheck(function (
    canvasWidth,
    canvasHeight,
    targetHeightRatio = 0.5,
  ) {
    try {
      // Get the PIXI model's rendered pixel dimensions at scale 1.0.
      // coreModel.getCanvasWidth/Height() returns Cubism abstract units which
      // can be very small (e.g. 28x16) and are NOT pixel dimensions.
      // The PIXI Live2D model's width/height properties give the actual
      // rendered size in pixels, but they are affected by the current scale,
      // so we need to normalize them back to scale 1.0.
      let modelWidth, modelHeight;

      const currentScaleX = this.model.scale.x || 1;
      const currentScaleY = this.model.scale.y || 1;

      // model.width and model.height are the pixel dimensions at current scale
      const pixelWidth = this.model.width;
      const pixelHeight = this.model.height;

      if (pixelWidth > 0 && pixelHeight > 0) {
        // Normalize to scale 1.0 pixel dimensions
        modelWidth = pixelWidth / currentScaleX;
        modelHeight = pixelHeight / currentScaleY;
        this.logger.log("📐 Got pixel size from PIXI model (at scale 1.0):", {
          modelWidth: modelWidth.toFixed(1),
          modelHeight: modelHeight.toFixed(1),
          currentScale: `${currentScaleX}x${currentScaleY}`,
        });
      } else {
        // Fallback: try rawModelSettings CanvasSize
        if (this.rawModelSettings && this.rawModelSettings.CanvasSize) {
          modelWidth = this.rawModelSettings.CanvasSize.Width;
          modelHeight = this.rawModelSettings.CanvasSize.Height;
          this.logger.log("📐 Got size from model settings (fallback):", {
            modelWidth,
            modelHeight,
          });
        } else {
          this.logger.warn(
            "⚠️ Cannot get model pixel size, using default scale",
          );
          this.setScale(0.2);
          this.model.position.set(canvasWidth / 2, canvasHeight / 2);
          return false;
        }
      }

      if (!modelWidth || !modelHeight || modelWidth < 1 || modelHeight < 1) {
        this.logger.warn("⚠️ Abnormal model size, using default scale:", {
          modelWidth,
          modelHeight,
        });
        this.setScale(0.2);
        this.model.position.set(canvasWidth / 2, canvasHeight / 2);
        return false;
      }

      // Calculate model aspect ratio
      const modelAspectRatio = modelWidth / modelHeight;
      const canvasAspectRatio = canvasWidth / canvasHeight;

      this.logger.log("📐 Size analysis:", {
        modelSize: `${modelWidth}x${modelHeight}`,
        modelAspectRatio: modelAspectRatio.toFixed(3),
        canvasSize: `${canvasWidth}x${canvasHeight}`,
        canvasAspectRatio: canvasAspectRatio.toFixed(3),
      });

      let finalScale = 1.0;

      // Decide fitting strategy based on model and canvas aspect ratios
      if (modelAspectRatio > canvasAspectRatio) {
        // Landscape model: prioritize width fitting, use more conservative scale
        this.logger.log(
          "📐 Landscape model detected, prioritizing width fitting",
        );
        const maxWidth = canvasWidth * 0.8; // Leave 20% margin
        finalScale = maxWidth / modelWidth;

        // Check if height exceeds limit
        const scaledHeight = modelHeight * finalScale;
        if (scaledHeight > canvasHeight * 0.9) {
          const maxHeight = canvasHeight * 0.9;
          const heightScale = maxHeight / modelHeight;
          finalScale = Math.min(finalScale, heightScale);
          this.logger.log("📐 Height exceeds limit, adjusting scale ratio");
        }
      } else {
        // Portrait model: prioritize height fitting, use more conservative scale
        this.logger.log(
          "📐 Portrait model detected, prioritizing height fitting",
        );
        const targetHeight = canvasHeight * targetHeightRatio;
        finalScale = targetHeight / modelHeight;

        // Check if width exceeds limit
        const scaledWidth = modelWidth * finalScale;
        if (scaledWidth > canvasWidth * 0.9) {
          const maxWidth = canvasWidth * 0.9;
          const widthScale = maxWidth / modelWidth;
          finalScale = Math.min(finalScale, widthScale);
          this.logger.log("📐 Width exceeds limit, adjusting scale ratio");
        }
      }

      // Ensure scale ratio is within reasonable range
      finalScale = Math.max(0.1, Math.min(2.0, finalScale));

      // Apply scale
      this.setScale(finalScale);

      // Calculate scaled dimensions
      const scaledModelWidth = modelWidth * finalScale;
      const scaledModelHeight = modelHeight * finalScale;

      // Center positioning
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // Set position
      this.model.position.set(centerX, centerY);

      this.logger.log("📐 Model fitted to canvas:", {
        canvasSize: `${canvasWidth}x${canvasHeight}`,
        modelOriginalSize: `${modelWidth}x${modelHeight}`,
        scaleRatio: finalScale.toFixed(3),
        finalSize: `${scaledModelWidth.toFixed(0)}x${scaledModelHeight.toFixed(0)}`,
        position: `(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`,
        fittingStrategy:
          modelAspectRatio > canvasAspectRatio
            ? "landscape fit"
            : "portrait fit",
      });

      return true;
    } catch (error) {
      this.logger.error("❌ Failed to fit to canvas:", error);
      // Fall back to default scale and center
      this.setScale(0.2);
      this.model.position.set(canvasWidth / 2, canvasHeight / 2);
      return false;
    }
  }, "fit to canvas");

  /**
   * Get model original size
   * @returns {Object|null} Object containing width and height
   */
  getModelOriginalSize() {
    if (!this.model) {
      return null;
    }

    try {
      // Return pixel dimensions at scale 1.0 (same approach as autoFitToCanvas).
      // model.width/height are the rendered pixel size at the current scale,
      // so we normalize back to scale 1.0.
      const currentScaleX = this.model.scale.x || 1;
      const currentScaleY = this.model.scale.y || 1;
      const pixelWidth = this.model.width;
      const pixelHeight = this.model.height;

      if (pixelWidth > 0 && pixelHeight > 0) {
        return {
          width: pixelWidth / currentScaleX,
          height: pixelHeight / currentScaleY,
        };
      }

      // Fallback to Cubism core model canvas size (abstract units)
      if (this.model.internalModel) {
        const coreModel = this.model.internalModel.coreModel;
        return {
          width: coreModel.getCanvasWidth(),
          height: coreModel.getCanvasHeight(),
        };
      }

      return null;
    } catch (error) {
      this.logger.error("❌ Failed to get model original size:", error);
      return null;
    }
  }

  /**
   * Reset model to default state
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   */
  resetToDefault = withModelCheck(function (canvasWidth, canvasHeight) {
    try {
      // Reset to default scale
      this.setScale(0.2);

      // Reset to default position (canvas center)
      if (canvasWidth && canvasHeight) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        this.model.position.set(centerX, centerY);
      } else {
        this.model.position.set(0, 0);
      }

      // Reset rotation and alpha
      this.setAngle(0);
      this.setAlpha(1);

      this.logger.log("🔄 Model reset to default state");
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to reset model:", error);
      return false;
    }
  }, "reset model");

  /**
   * Force set default scale
   * @param {number} defaultScale - Default scale value (default 0.2)
   */
  forceDefaultScale = withModelCheck(function (defaultScale = 0.2) {
    try {
      this.setScale(defaultScale);
      this.logger.log("📐 Forced default scale:", defaultScale);
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to set default scale:", error);
      return false;
    }
  }, "set default scale");
}
