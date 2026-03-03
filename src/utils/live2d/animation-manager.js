/**
 * Live2D Animation Manager
 * Handles model motions, expressions, and audio playback
 */

import { createLogger } from "./utils.js";

export class Live2DAnimationManager {
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.currentAudioPlayer = null;
    this.animationQueue = new Map(); // Animation queue
    this.isPlaying = new Map(); // Playback state tracking
    this.isPetMode = false;
    this.logger = createLogger("Live2DAnimationManager");
  }

  /**
   * Set pet mode
   * @param {boolean} enabled - Whether to enable pet mode
   */
  setPetMode(enabled) {
    this.isPetMode = enabled;
    this.logger.log(`🐾 Pet mode ${enabled ? "enabled" : "disabled"}`);

    if (enabled) {
      // Stop all current animations
      this.stopAllAnimations();

      // Stop audio playback
      this.stopAudio();
    }
  }

  /**
   * Play model motion
   * @param {string} modelId - Model ID
   * @param {string} group - Motion group name
   * @param {number} index - Motion index
   * @param {number} priority - Priority
   */
  async playMotion(modelId, group, index, priority = 2) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      // Limit motion priority in pet mode
      const adjustedPriority = this.isPetMode
        ? Math.min(priority, 1)
        : priority;

      const result = await heroModel.playMotion(group, index, adjustedPriority);
      this.logger.log("🎭 Playing motion:", {
        modelId,
        group,
        index,
        priority: adjustedPriority,
        result,
      });
      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play motion:", error);
      return false;
    }
  }

  /**
   * Play random motion
   * @param {string} modelId - Model ID
   * @param {string} group - Motion group name (optional)
   */
  async playRandomMotion(modelId, group = null) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      // Prefer idle motions in pet mode
      const targetGroup = this.isPetMode ? group || "idle" : group;

      const result = await heroModel.playRandomMotion(targetGroup);
      this.logger.log("🎲 Playing random motion:", {
        modelId,
        group: targetGroup,
        result,
      });
      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play random motion:", error);
      return false;
    }
  }

  /**
   * Set model expression
   * @param {string} modelId - Model ID
   * @param {number} expressionIndex - Expression index
   */
  setExpression(modelId, expressionIndex) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      heroModel.setExpression(expressionIndex);
      this.logger.log("😊 Set expression:", {
        modelId,
        expressionIndex,
      });
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to set expression:", error);
      return false;
    }
  }

  /**
   * Play random expression
   * @param {string} modelId - Model ID
   */
  playRandomExpression(modelId) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      const result = heroModel.playRandomExpression();
      this.logger.log("🎲 Playing random expression:", {
        modelId,
        result,
      });
      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play random expression:", error);
      return false;
    }
  }

  /**
   * Batch control expressions
   * @param {Array} expressions - Expression index array
   * @param {Array} modelIds - Target model ID array (optional, defaults to all models)
   */
  batchControlExpressions(expressions, modelIds = null) {
    const targetIds = modelIds || this.modelManager.getAllModelIds();
    const results = [];

    targetIds.forEach((modelId) => {
      expressions.forEach((expressionIndex) => {
        const result = this.setExpression(modelId, expressionIndex);
        results.push({ modelId, expressionIndex, success: result });
      });
    });

    // this.logger.log('🎭 Batch expression control completed:', results)
    return results;
  }

  /**
   * Batch control motions
   * @param {Array} motions - Motion data array [{group, index, priority}]
   * @param {Array} modelIds - Target model ID array (optional, defaults to all models)
   */
  async batchControlMotions(motions, modelIds = null) {
    const targetIds = modelIds || this.modelManager.getAllModelIds();
    const results = [];

    for (const modelId of targetIds) {
      for (const motion of motions) {
        const { group, index, priority = 2 } = motion;
        const result = await this.playMotion(modelId, group, index, priority);
        results.push({ modelId, group, index, priority, success: result });
      }
    }

    // this.logger.log('🎭 Batch motion control completed:', results)
    return results;
  }

  /**
   * Play audio
   * @param {string} audioUrl - Audio URL
   * @param {Object} options - Playback options
   */
  async playAudio(audioUrl, options = {}) {
    // Do not play audio in pet mode
    if (this.isPetMode) {
      // this.logger.log('🔇 Audio disabled in pet mode')
      return false;
    }

    try {
      // Stop currently playing audio
      this.stopAudio();

      // Create new audio player
      this.currentAudioPlayer = new Audio(audioUrl);

      // Set audio properties
      const { volume = 1.0, loop = false, playbackRate = 1.0 } = options;
      this.currentAudioPlayer.volume = volume;
      this.currentAudioPlayer.loop = loop;
      this.currentAudioPlayer.playbackRate = playbackRate;

      // Play audio
      await this.currentAudioPlayer.play();

      this.logger.log("🔊 Audio playback started:", audioUrl);

      // Listen for playback end event
      this.currentAudioPlayer.addEventListener("ended", () => {
        this.logger.log("🔇 Audio playback ended");
        this.currentAudioPlayer = null;
      });

      return true;
    } catch (error) {
      this.logger.error("❌ Audio playback failed:", error);
      this.currentAudioPlayer = null;
      return false;
    }
  }

  /**
   * Stop audio playback
   */
  stopAudio() {
    if (this.currentAudioPlayer) {
      this.currentAudioPlayer.pause();
      this.currentAudioPlayer.currentTime = 0;
      this.currentAudioPlayer = null;
      this.logger.log("⏹️ Audio playback stopped");
    }
  }

  /**
   * Pause audio playback
   */
  pauseAudio() {
    if (this.currentAudioPlayer && !this.currentAudioPlayer.paused) {
      this.currentAudioPlayer.pause();
      this.logger.log("⏸️ Audio playback paused");
      return true;
    }
    return false;
  }

  /**
   * Resume audio playback
   */
  resumeAudio() {
    if (this.currentAudioPlayer && this.currentAudioPlayer.paused) {
      this.currentAudioPlayer.play();
      this.logger.log("▶️ Audio playback resumed");
      return true;
    }
    return false;
  }

  /**
   * Set audio volume
   * @param {number} volume - Volume (0.0 - 1.0)
   */
  setAudioVolume(volume) {
    if (this.currentAudioPlayer) {
      this.currentAudioPlayer.volume = Math.max(0, Math.min(1, volume));
      this.logger.log("🔊 Volume set to:", volume);
      return true;
    }
    return false;
  }

  /**
   * Get audio playback status
   */
  getAudioStatus() {
    if (!this.currentAudioPlayer) {
      return { playing: false, paused: false, currentTime: 0, duration: 0 };
    }

    return {
      playing: !this.currentAudioPlayer.paused,
      paused: this.currentAudioPlayer.paused,
      currentTime: this.currentAudioPlayer.currentTime,
      duration: this.currentAudioPlayer.duration || 0,
      volume: this.currentAudioPlayer.volume,
    };
  }

  /**
   * Get model motion information
   * @param {string} modelId - Model ID
   */
  getModelMotions(modelId) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return null;
    }

    try {
      return heroModel.getMotions();
    } catch (error) {
      this.logger.error("❌ Failed to get motion info:", error);
      return null;
    }
  }

  /**
   * Get model expression information
   * @param {string} modelId - Model ID
   */
  getModelExpressions(modelId) {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return null;
    }

    try {
      return heroModel.getExpressions();
    } catch (error) {
      this.logger.error("❌ Failed to get expression info:", error);
      return null;
    }
  }

  /**
   * Stop all animations
   */
  stopAllAnimations() {
    this.modelManager.getAllModels().forEach((heroModel) => {
      try {
        if (heroModel.stopAllMotions) {
          heroModel.stopAllMotions();
        }
      } catch (error) {
        this.logger.error("❌ Failed to stop animation:", error);
      }
    });

    this.stopAudio();
    this.logger.log("⏹️ All animations stopped");
  }

  /**
   * Destroy animation manager
   */
  destroy() {
    this.stopAllAnimations();
    this.animationQueue.clear();
    this.isPlaying.clear();
    this.logger.log("🧹 Animation manager destroyed");
  }
}
