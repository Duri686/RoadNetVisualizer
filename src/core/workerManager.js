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
      onObstacleReady: null,
    };
    this.isProcessing = false;
    // Worker 是否已就绪（收到 WORKER_READY）
    this.isReady = false;
    // 挂起的首条生成请求（在未就绪时缓存一次）
    this.pendingGenerate = null;
    // 全局 Loading 覆盖层引用
    this._loadingEl = null;
    // 仅首次加载显示全局 Loading；首轮完成后自动关闭
    this._bootLoadingEnabled = true;
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
      // 重置就绪与挂起状态
      this.isReady = false;
      this.pendingGenerate = null;
      // 显示全局 Loading（仅首屏白屏阶段）
      if (this._bootLoadingEnabled) this.showGlobalLoading('加载引擎中…');
      // 预热：提升首轮稳定性
      try {
        this.worker.postMessage({ type: 'WARMUP' });
      } catch (_) {}
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
      const {
        type,
        data,
        progress,
        error,
        currentLayer,
        totalLayers,
        payload,
      } = e.data;

      switch (type) {
        case 'WARMUP_DONE':
          console.log('🔥 Worker warmup done');
          break;
        case 'START':
          this.isProcessing = true;
          console.log('🚀 Worker started processing:', payload);
          // 首轮生成阶段更新文案；后续点击不再显示全局 Loading
          this.updateGlobalLoading('生成中…');
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
          const nodeCountInfo = e.data.layerNodeCount
            ? ` (${e.data.layerNodeCount} nodes)`
            : '';
          console.log(
            `⏳ Progress: ${(progress * 100).toFixed(1)}% - Layer ${
              currentLayer + 1
            }/${totalLayers}${nodeCountInfo}`,
          );
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress(
              progress,
              currentLayer,
              totalLayers,
              e.data.layerNodeCount,
            );
          }
          break;

        case 'COMPLETE':
          this.isProcessing = false;
          this.hideGlobalLoading();
          // 主线程统计接收的 edgesPacked（TypedArray）大小与边数
          try {
            const layers = data && data.layers ? data.layers : [];
            let bufCount = 0,
              byteSum = 0,
              edgeSum = 0;
            let nodeBufs = 0,
              nodeBytes = 0,
              nodeCount = 0;
            for (let i = 0; i < layers.length; i++) {
              const packed = layers[i] && layers[i].edgesPacked;
              if (
                packed &&
                packed.buffer &&
                typeof packed.byteLength === 'number'
              ) {
                bufCount++;
                byteSum += packed.byteLength;
                edgeSum += Math.floor(packed.length / 4);
              }
              const np = layers[i] && layers[i].nodesPacked;
              if (np && np.buffer && typeof np.byteLength === 'number') {
                nodeBufs++;
                nodeBytes += np.byteLength;
                nodeCount += Math.floor(np.length / 2);
              }
            }
            const kb = byteSum > 0 ? Math.round(byteSum / 1024) : 0;
            console.log(
              `[Main] received edgesPacked: layers=${layers.length} | buffers=${bufCount} | edges=${edgeSum} | ${kb} KB`,
            );
            const nkb = nodeBytes > 0 ? Math.round(nodeBytes / 1024) : 0;
            console.log(
              `[Main] received nodesPacked: buffers=${nodeBufs} | nodes=${nodeCount} | ${nkb} KB`,
            );
            const ob = data && data.obstaclesPacked;
            const obKb =
              ob && ob.byteLength ? Math.round(ob.byteLength / 1024) : 0;
            const obCount = ob && ob.length ? Math.floor(ob.length / 4) : 0;
            if (ob)
              console.log(
                `[Main] received obstaclesPacked: rects=${obCount} | ${obKb} KB`,
              );
          } catch (_) {
            /* ignore */
          }
          console.log('✅ Worker completed processing:', data.metadata);
          if (this.callbacks.onComplete) {
            this.callbacks.onComplete(data);
          }
          break;

        case 'ERROR':
          this.isProcessing = false;
          this.hideGlobalLoading();
          console.error('❌ Worker error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          break;

        case 'CANCELLED':
          this.isProcessing = false;
          this.hideGlobalLoading();
          console.log('🛑 Worker cancelled');
          if (this.callbacks.onCancel) {
            this.callbacks.onCancel();
          }
          break;

        case 'WORKER_READY':
          // Worker 初始化完成 / 模块加载成功的通知，仅用于调试
          console.log('🧩 Worker reported ready:', e.data && e.data.message);
          this.isReady = true;
          // 若存在挂起的生成请求，立刻发送并清空
          if (this.pendingGenerate) {
            try {
              this.worker.postMessage(this.pendingGenerate);
            } catch (err) {
              console.error('❌ Failed to flush pending generate:', err);
              if (this.callbacks.onError) this.callbacks.onError(err);
            } finally {
              this.pendingGenerate = null;
            }
          }
          break;

        default:
          console.warn('Unknown message type from worker:', type);
      }
    };

    this.worker.onerror = (error) => {
      if (!this.isProcessing) {
        return;
      }
      this.isProcessing = false;
      const msg =
        error.message ||
        (error.error && error.error.message) ||
        'Unknown worker error';
      console.error('❌ Worker error event:', msg, error);
      if (this.callbacks.onError) {
        this.callbacks.onError({
          message: msg,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          stack: error.error && error.error.stack,
        });
      }
    };
    this.worker.onmessageerror = (ev) => {
      if (!this.isProcessing) {
        return;
      }
      this.isProcessing = false;
      console.error('❌ Worker messageerror:', ev);
      if (this.callbacks.onError) {
        this.callbacks.onError({ message: 'Worker message cloning failed' });
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
  generateNavGraph(
    width,
    height,
    layerCount,
    obstacleCount = 0,
    seed,
    mode = 'centroid',
    options = {},
  ) {
    if (this.isProcessing) {
      console.warn(
        '⚠️ Worker is already processing, please wait or cancel current task',
      );
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
        this.callbacks.onError({
          message: 'Invalid parameters: width/height >= 10, layerCount >= 1',
        });
      }
      return false;
    }

    try {
      // 记录主线程发送时间，传递到 Worker 再回传 START，便于端到端计时对齐
      const clientStart =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      const message = {
        type: 'GENERATE_NAVGRAPH',
        payload: {
          width,
          height,
          layerCount,
          obstacleCount,
          seed,
          mode,
          options,
          clientStart,
        },
      };
      // 若 Worker 尚未就绪，先缓存，待 WORKER_READY 后发送
      if (!this.isReady) {
        this.pendingGenerate = message;
      } else {
        this.worker.postMessage(message);
      }
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
      this.hideGlobalLoading();
      console.log('🛑 Worker terminated');
    }
  }

  /**
   * 获取处理状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      hasWorker: !!this.worker,
    };
  }

  // —— 全局 Loading 覆盖层 ——
  showGlobalLoading(text = '加载中…') {
    try {
      if (!this._bootLoadingEnabled) return; // 首轮之外不再展示
      if (!this._loadingEl) {
        // 注入动画关键帧（仅一次）
        if (!document.getElementById('loading-keyframes')) {
          const style = document.createElement('style');
          style.id = 'loading-keyframes';
          style.textContent = `
            @keyframes loading-fade-in { from { opacity: 0 } to { opacity: 1 } }
            @keyframes loading-spin { to { transform: rotate(360deg) } }
            @keyframes loading-pulse-ring {
              0% { transform: scale(0.8); opacity: 0.6 }
              50% { transform: scale(1.15); opacity: 0 }
              100% { transform: scale(0.8); opacity: 0 }
            }
            @keyframes loading-text-shimmer {
              0% { background-position: -200% center }
              100% { background-position: 200% center }
            }
          `;
          document.head.appendChild(style);
        }

        const el = document.createElement('div');
        el.id = 'global-loading-overlay';
        Object.assign(el.style, {
          position: 'fixed',
          inset: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(5,5,6,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: '9999',
          fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif",
          animation: 'loading-fade-in 0.3s ease',
        });

        // 中心容器
        const container = document.createElement('div');
        Object.assign(container.style, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        });

        // 旋转指示器 + 脉冲光环
        const spinnerWrap = document.createElement('div');
        Object.assign(spinnerWrap.style, {
          position: 'relative',
          width: '48px',
          height: '48px',
        });

        // 外圈脉冲光环
        const pulseRing = document.createElement('div');
        Object.assign(pulseRing.style, {
          position: 'absolute',
          inset: '-8px',
          borderRadius: '50%',
          border: '1.5px solid rgba(94,106,210,0.3)',
          animation: 'loading-pulse-ring 2s ease-in-out infinite',
        });

        // 旋转弧线
        const spinner = document.createElement('div');
        Object.assign(spinner.style, {
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.06)',
          borderTopColor: '#5E6AD2',
          borderRightColor: 'rgba(94,106,210,0.3)',
          animation: 'loading-spin 1s cubic-bezier(0.4,0,0.2,1) infinite',
          boxShadow: '0 0 20px rgba(94,106,210,0.15)',
        });

        spinnerWrap.appendChild(pulseRing);
        spinnerWrap.appendChild(spinner);

        // 文字 - 渐变微光
        const txt = document.createElement('div');
        txt.id = 'global-loading-text';
        txt.textContent = text;
        Object.assign(txt.style, {
          fontSize: '13px',
          fontWeight: '500',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.8), rgba(255,255,255,0.4))',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'loading-text-shimmer 2.5s linear infinite',
        });

        container.appendChild(spinnerWrap);
        container.appendChild(txt);
        el.appendChild(container);
        document.body.appendChild(el);
        this._loadingEl = el;
      } else {
        this.updateGlobalLoading(text);
      }
    } catch (_) {}
  }

  updateGlobalLoading(text = '加载中…') {
    try {
      // 仅当首轮开关开启且覆盖层已存在时才更新
      if (!this._bootLoadingEnabled || !this._loadingEl) return;
      const t = this._loadingEl.querySelector('#global-loading-text');
      if (t) t.textContent = text;
      this._loadingEl.style.display = 'flex';
    } catch (_) {}
  }

  hideGlobalLoading() {
    try {
      if (this._loadingEl) {
        const el = this._loadingEl;
        el.style.transition = 'opacity 0.4s ease';
        el.style.opacity = '0';
        setTimeout(() => {
          el.remove();
        }, 400);
        this._loadingEl = null;
      }
      // 关闭首轮 Loading 开关，后续不再展示
      this._bootLoadingEnabled = false;
    } catch (_) {}
  }
}

// 导出单例
export default new WorkerManager();
