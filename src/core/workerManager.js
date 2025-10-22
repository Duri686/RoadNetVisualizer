/**
 * Worker Manager
 * 管理 Web Worker 的创建、通信和生命周期
 */

import ObstacleWorker from './obstacle.worker.js?worker';

class WorkerManager {
  constructor() {
    this.worker = null;
    this.callbacks = {
      onStart: null,
      onProgress: null,
      onComplete: null,
      onError: null,
      onCancel: null,
      onObstacleReady: null
    };
    this.isProcessing = false;
  }

  /**
   * 初始化 Worker
   */
  init() {
    if (this.worker) {
      this.terminate();
    }

    try {
      this.worker = new ObstacleWorker();
      this.setupMessageHandler();
      console.log('✅ Obstacle Worker initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize worker:', error);
      throw error;
    }
  }

  /**
   * 设置消息处理器
   */
  setupMessageHandler() {
    this.worker.onmessage = (e) => {
      const { type, data, progress, error, currentLayer, totalLayers, payload } = e.data;

      switch (type) {
        case 'START':
          this.isProcessing = true;
          console.log('🚀 Worker started processing:', payload);
          if (this.callbacks.onStart) {
            this.callbacks.onStart(payload);
          }
          break;

        case 'OBSTACLE_READY':
          console.log(`🧱 Obstacles generated:`, e.data.count);
          if (this.callbacks.onObstacleReady) {
            this.callbacks.onObstacleReady(e.data.obstacles, e.data.count);
          }
          break;

        case 'PROGRESS':
          const nodeCountInfo = e.data.layerNodeCount ? ` (${e.data.layerNodeCount} nodes)` : '';
          console.log(`⏳ Progress: ${(progress * 100).toFixed(1)}% - Layer ${currentLayer + 1}/${totalLayers}${nodeCountInfo}`);
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress(progress, currentLayer, totalLayers, e.data.layerNodeCount);
          }
          break;

        case 'COMPLETE':
          this.isProcessing = false;
          console.log('✅ Worker completed processing:', data.metadata);
          if (this.callbacks.onComplete) {
            this.callbacks.onComplete(data);
          }
          break;

        case 'ERROR':
          this.isProcessing = false;
          console.error('❌ Worker error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          break;

        case 'CANCELLED':
          this.isProcessing = false;
          console.log('🛑 Worker cancelled');
          if (this.callbacks.onCancel) {
            this.callbacks.onCancel();
          }
          break;

        default:
          console.warn('Unknown message type from worker:', type);
      }
    };

    this.worker.onerror = (error) => {
      this.isProcessing = false;
      console.error('❌ Worker error event:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError({
          message: error.message,
          filename: error.filename,
          lineno: error.lineno
        });
      }
    };
  }

  /**
   * 注册回调函数
   * @param {Object} callbacks - 回调函数对象
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 生成导航图
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} layerCount - 层数
   * @param {number} obstacleCount - 障碍物数量
   * @param {number} seed - 随机种子（可选）
   */
  generateNavGraph(width, height, layerCount, obstacleCount = 0, seed, mode = 'centroid', options = {}) {
    if (this.isProcessing) {
      console.warn('⚠️ Worker is already processing, please wait or cancel current task');
      return false;
    }

    if (!this.worker) {
      console.error('❌ Worker not initialized');
      return false;
    }

    // 参数验证
    if (width < 10 || height < 10 || layerCount < 1) {
      console.error('❌ Invalid parameters');
      if (this.callbacks.onError) {
        this.callbacks.onError({ message: 'Invalid parameters: width/height >= 10, layerCount >= 1' });
      }
      return false;
    }

    try {
      this.worker.postMessage({
        type: 'GENERATE_NAVGRAPH',
        payload: { width, height, layerCount, obstacleCount, seed, mode, options }
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to post message to worker:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      return false;
    }
  }

  /**
   * 取消当前处理
   * #TODO: 实现真正的取消逻辑（需要 Worker 支持）
   */
  cancel() {
    if (this.worker && this.isProcessing) {
      this.worker.postMessage({ type: 'CANCEL' });
    }
  }

  /**
   * 终止 Worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isProcessing = false;
      console.log('🛑 Worker terminated');
    }
  }

  /**
   * 获取处理状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      hasWorker: !!this.worker
    };
  }
}

// 导出单例
export default new WorkerManager();
