/**
 * Live2D 状态同步管理器
 * 统一管理模型状态与UI之间的同步
 */

import { globalResourceManager } from "../resource-manager.js";

// 统一状态同步工具
const StateSyncUtils = {
  // 获取模型状态
  getModelState(model) {
    if (!model?.internalModel) return null;

    try {
      const state = {
        expressions: this.getExpressionState(model),
        motions: this.getMotionState(model),
        parameters: this.getParameterState(model),
        parts: this.getPartState(model),
      };
      return state;
    } catch (error) {
      console.error("获取模型状态失败:", error);
      return null;
    }
  },

  // 获取表情状态
  getExpressionState(model) {
    try {
      const expressions =
        model.internalModel.settings.getExpressionDefinitions();
      return expressions ? expressions.map((expr) => expr.name) : [];
    } catch (error) {
      console.warn("获取表情状态失败:", error);
      return [];
    }
  },

  // 获取动作状态
  getMotionState(model) {
    try {
      const motionManager = model.internalModel.motionManager;
      return motionManager
        ? {
            currentGroup: motionManager.currentMotion?.group,
            currentIndex: motionManager.currentMotion?.index,
            isPlaying: motionManager.isPlaying,
          }
        : null;
    } catch (error) {
      console.warn("获取动作状态失败:", error);
      return null;
    }
  },

  // 获取参数状态
  getParameterState(model) {
    try {
      const parameters = {};
      const coreModel = model.internalModel.coreModel;
      const live2dCoreModel = coreModel.getModel();
      const parameterCount = live2dCoreModel.parameters.count;
      const parameterIds = live2dCoreModel.parameters.ids;

      for (let i = 0; i < parameterCount; i++) {
        const paramId = parameterIds[i];
        parameters[paramId] = coreModel.getParameterValueByIndex(i);
      }

      return parameters;
    } catch (error) {
      console.warn("获取参数状态失败:", error);
      return {};
    }
  },

  // 获取部件状态
  getPartState(model) {
    try {
      const parts = {};
      const coreModel = model.internalModel.coreModel;

      // 使用公共API获取部件信息
      const partCount = coreModel.getPartCount();
      for (let i = 0; i < partCount; i++) {
        const partId = coreModel.getPartId(i);
        parts[partId] = coreModel.getPartOpacityById(partId);
      }

      return parts;
    } catch (error) {
      console.warn("获取部件状态失败:", error);
      return {};
    }
  },

  // 应用UI设置到模型
  applyUISettings(model, uiSettings) {
    if (!model?.internalModel) return false;

    try {
      // 应用表情设置
      if (uiSettings.expressions) {
        this.applyExpressionSettings(model, uiSettings.expressions);
      }

      // 应用动作设置
      if (uiSettings.motions) {
        this.applyMotionSettings(model, uiSettings.motions);
      }

      // 应用参数设置
      if (uiSettings.parameters) {
        this.applyParameterSettings(model, uiSettings.parameters);
      }

      // 应用部件设置
      if (uiSettings.parts) {
        this.applyPartSettings(model, uiSettings.parts);
      }

      return true;
    } catch (error) {
      console.error("应用UI设置失败:", error);
      return false;
    }
  },

  // 应用表情设置
  applyExpressionSettings(model, expressionSettings) {
    try {
      Object.entries(expressionSettings).forEach(([expressionId, enabled]) => {
        if (enabled) {
          const expressions =
            model.internalModel.settings.getExpressionDefinitions();
          const expression = expressions?.find(
            (expr) => expr.name === expressionId,
          );
          if (expression) {
            model.internalModel.expression(expression.name);
          }
        }
      });
    } catch (error) {
      console.warn("应用表情设置失败:", error);
    }
  },

  // 应用动作设置
  applyMotionSettings(model, motionSettings) {
    try {
      const motionManager = model.internalModel.motionManager;
      if (!motionManager) return;

      Object.entries(motionSettings).forEach(([group, index]) => {
        if (typeof index === "number") {
          motionManager.startMotion(group, index);
        }
      });
    } catch (error) {
      console.warn("应用动作设置失败:", error);
    }
  },

  // 应用参数设置
  applyParameterSettings(model, parameterSettings) {
    try {
      const coreModel = model.internalModel.coreModel;
      Object.entries(parameterSettings).forEach(([paramId, value]) => {
        coreModel.setParameterValueById(paramId, value);
      });
    } catch (error) {
      console.warn("应用参数设置失败:", error);
    }
  },

  // 应用部件设置
  applyPartSettings(model, partSettings) {
    try {
      const coreModel = model.internalModel.coreModel;
      Object.entries(partSettings).forEach(([partId, value]) => {
        coreModel.setPartOpacityById(partId, value);
      });
    } catch (error) {
      console.warn("应用部件设置失败:", error);
    }
  },
};

export class Live2DStateSyncManager {
  constructor() {
    this.syncCallbacks = new Map();
    this.syncTimers = new Map();
    this.expressionStates = new Map(); // 表情状态
    this.motionStates = new Map(); // 动作状态
    this.parameterStates = new Map(); // 参数状态
    this.partStates = new Map(); // 部件状态
    this.audioStates = new Map(); // 音频状态
    this.textStates = new Map(); // 文本状态

    // 状态缓存
    this.stateCache = new Map();

    // 同步配置
    this.syncInterval = 100; // 同步间隔（毫秒）
    this.isEnabled = true;

    // 循环同步防护
    this.syncInProgress = new Set();

    // 注册到全局资源管理器
    globalResourceManager.registerCleanupCallback(() => this.cleanup());
  }

  /**
   * 注册同步回调
   * @param {string} modelId - 模型ID
   * @param {Function} callback - 同步回调函数
   */
  registerSyncCallback(modelId, callback) {
    this.syncCallbacks.set(modelId, callback);
    console.log(`📝 [StateSyncManager] 注册同步回调: ${modelId}`);
  }

  /**
   * 注销同步回调
   * @param {string} modelId - 模型ID
   */
  unregisterSyncCallback(modelId) {
    this.syncCallbacks.delete(modelId);
    console.log(`🗑️ [StateSyncManager] 注销同步回调: ${modelId}`);
  }

  /**
   * 同步模型状态到UI
   * @param {string} modelId - 模型ID
   * @param {Object} model - 模型实例
   */
  syncModelStateToUI(modelId, model) {
    if (!model) {
      console.warn("⚠️ [StateSyncManager] 模型无效，无法同步状态");
      return;
    }

    const callback = this.syncCallbacks.get(modelId);
    if (!callback) {
      console.warn("⚠️ [StateSyncManager] 未找到同步回调:", modelId);
      return;
    }

    try {
      const currentState = StateSyncUtils.getModelState(model);
      if (currentState) {
        callback(currentState);
        console.log(
          "🔄 [StateSyncManager] 模型状态已同步到UI:",
          modelId,
          currentState,
        );
      }
    } catch (error) {
      console.error("❌ [StateSyncManager] 同步模型状态失败:", error);
    }
  }

  /**
   * 同步UI设置到模型
   * @param {string} modelId - 模型ID
   * @param {Object} model - 模型实例
   * @param {Object} uiSettings - UI设置
   */
  syncUISettingsToModel(modelId, model, uiSettings) {
    if (!model) {
      console.warn("⚠️ [StateSyncManager] 模型无效，无法应用UI设置");
      return false;
    }

    try {
      const success = StateSyncUtils.applyUISettings(model, uiSettings);
      if (success) {
        console.log(
          "✅ [StateSyncManager] UI设置已同步到模型:",
          modelId,
          uiSettings,
        );
      }
      return success;
    } catch (error) {
      console.error("❌ [StateSyncManager] 同步UI设置失败:", error);
      return false;
    }
  }

  /**
   * 批量同步所有模型状态
   * @param {Map} models - 模型映射
   */
  syncAllModelStates(models) {
    try {
      models.forEach((model, modelId) => {
        this.syncModelStateToUI(modelId, model);
      });
      console.log("🔄 [StateSyncManager] 所有模型状态已同步");
    } catch (error) {
      console.error("❌ [StateSyncManager] 批量同步失败:", error);
    }
  }

  /**
   * 验证状态一致性
   * @param {string} modelId - 模型ID
   * @param {Object} expectedState - 期望状态
   * @param {Object} actualState - 实际状态
   */
  validateStateConsistency(modelId, expectedState, actualState) {
    const inconsistencies = [];

    // 验证参数状态
    if (expectedState.parameters && actualState.parameters) {
      Object.entries(expectedState.parameters).forEach(
        ([paramId, expectedValue]) => {
          const actualValue = actualState.parameters[paramId];
          if (Math.abs(actualValue - expectedValue) > 0.001) {
            inconsistencies.push({
              type: "parameter",
              id: paramId,
              expected: expectedValue,
              actual: actualValue,
            });
          }
        },
      );
    }

    // 验证部件状态
    if (expectedState.parts && actualState.parts) {
      Object.entries(expectedState.parts).forEach(([partId, expectedValue]) => {
        const actualValue = actualState.parts[partId];
        if (Math.abs(actualValue - expectedValue) > 0.001) {
          inconsistencies.push({
            type: "part",
            id: partId,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      });
    }

    if (inconsistencies.length > 0) {
      console.warn(
        "⚠️ [StateSyncManager] 状态不一致:",
        modelId,
        inconsistencies,
      );
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
    };
  }

  /**
   * 强制同步状态
   * @param {string} modelId - 模型ID
   * @param {Object} model - 模型实例
   * @param {Object} targetState - 目标状态
   */
  forceSyncState(modelId, model, targetState) {
    if (!model || !targetState) {
      console.warn("⚠️ [StateSyncManager] 模型或目标状态无效");
      return false;
    }

    try {
      console.log("🔄 [StateSyncManager] 强制同步状态:", modelId, targetState);

      // 应用目标状态
      const success = StateSyncUtils.applyUISettings(model, targetState);

      if (success) {
        // 验证同步结果
        const actualState = StateSyncUtils.getModelState(model);
        const validation = this.validateStateConsistency(
          modelId,
          targetState,
          actualState,
        );

        if (validation.isConsistent) {
          console.log("✅ [StateSyncManager] 强制同步成功:", modelId);
          return true;
        } else {
          console.warn(
            "⚠️ [StateSyncManager] 强制同步后状态仍不一致:",
            modelId,
            validation.inconsistencies,
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("❌ [StateSyncManager] 强制同步失败:", error);
      return false;
    }
  }

  /**
   * 保存状态到缓存
   * @param {string} modelId - 模型ID
   * @param {Object} state - 状态数据
   */
  saveStateToCache(modelId, state) {
    this.stateCache.set(modelId, {
      state: structuredClone(state),
      timestamp: Date.now(),
    });
    console.log("💾 [StateSyncManager] 状态已保存到缓存:", modelId);
  }

  /**
   * 从缓存恢复状态
   * @param {string} modelId - 模型ID
   * @param {Object} model - 模型实例
   * @returns {boolean} 是否成功恢复
   */
  restoreStateFromCache(modelId, model) {
    try {
      const cachedData = this.stateCache.get(modelId);
      if (!cachedData || !model) {
        return false;
      }

      console.log("🔄 [StateSyncManager] 从缓存恢复状态:", modelId);

      // 使用统一工具应用状态，传递cachedData.state而不是整个cachedData对象
      const success = StateSyncUtils.applyUISettings(model, cachedData.state);

      if (success) {
        console.log("✅ [StateSyncManager] 状态恢复成功:", modelId);
      } else {
        console.warn("⚠️ [StateSyncManager] 状态恢复失败:", modelId);
      }

      return success;
    } catch (error) {
      console.error("❌ [StateSyncManager] 状态恢复异常:", error);
      return false;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log("🧹 [StateSyncManager] 开始清理资源...");

    try {
      // 清理同步回调
      this.syncCallbacks.clear();

      // 清理定时器
      this.syncTimers.forEach((timerId) => {
        clearTimeout(timerId);
      });
      this.syncTimers.clear();

      // 清理状态缓存
      this.stateCache.clear();
      this.expressionStates.clear();
      this.motionStates.clear();
      this.parameterStates.clear();
      this.partStates.clear();
      this.audioStates.clear();
      this.textStates.clear();

      // 清理循环同步防护
      this.syncInProgress.clear();

      console.log("✅ [StateSyncManager] 资源清理完成");
    } catch (error) {
      console.error("❌ [StateSyncManager] 资源清理失败:", error);
    }
  }

  /**
   * 与 Live2D Store 集成
   * @param {Object} live2dStore - Live2D Store 实例
   */
  integrateWithStore(live2dStore) {
    if (!live2dStore) {
      console.warn("⚠️ [StateSyncManager] Live2D Store 无效");
      return;
    }

    // 注册状态同步回调
    this.registerSyncCallback("store", (state) => {
      // 防止循环同步
      if (this.syncInProgress.has("store")) {
        console.log("🔄 [StateSyncManager] 跳过循环同步:", "store");
        return;
      }

      this.syncInProgress.add("store");

      try {
        // 更新 Store 中的状态
        live2dStore.updateModelState(state);
      } catch (error) {
        console.error("❌ [StateSyncManager] Store 同步失败:", error);
      } finally {
        this.syncInProgress.delete("store");
      }
    });

    console.log("✅ [StateSyncManager] 已与 Live2D Store 集成（带循环防护）");
  }

  /**
   * 获取模型状态
   * @param {Object} model - 模型实例
   * @returns {Object|null} 模型状态
   */
  getModelState(model) {
    return StateSyncUtils.getModelState(model);
  }
}

// 创建全局状态同步管理器实例
export const globalStateSyncManager = new Live2DStateSyncManager();

// 注册页面卸载时的清理
globalResourceManager.registerGlobalEventListener(
  "state-sync-cleanup",
  "beforeunload",
  () => {
    globalStateSyncManager.cleanup();
  },
);
