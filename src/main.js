/**
 * Main Application
 * 主应用入口，协调各个模块
 */

import './style.css';
import workerManager from './core/workerManager.js';
import renderer from './core/renderer.js';
import InputForm from './components/InputForm.js';
import ProgressBar from './components/ProgressBar.js';
import LayerControl from './components/LayerControl.js';

// #TODO: 添加错误边界处理
// #TODO: 添加性能监控
// #TODO: 添加用户偏好设置（保存到 localStorage）

class App {
  constructor() {
    this.inputForm = null;
    this.progressBar = null;
    this.layerControl = null;
    this.roadNetData = null;
    this.isInitialized = false;
    // 性能计时（仅记录耗时，不显示 Loading）
    this.perf = { start: 0 };
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('🚀 Initializing RoadNet Visualizer...');

      // 初始化 UI 组件
      this.inputForm = new InputForm();
      this.progressBar = new ProgressBar();
      this.layerControl = new LayerControl();

      // 初始化 Worker Manager
      workerManager.init();
      this.setupWorkerCallbacks();

      // 初始化渲染器
      const pixiContainer = document.getElementById('pixi-canvas');
      const tInit0 = performance?.now ? performance.now() : Date.now();
      renderer.init(pixiContainer, { width: pixiContainer.clientWidth, height: pixiContainer.clientHeight });
      const tInit1 = performance?.now ? performance.now() : Date.now();
      this.perf.initRenderMs = Math.max(0, Math.round(tInit1 - tInit0));

      // 全屏切换功能
      const fullscreenBtn = document.getElementById('fullscreen-btn');
      const canvasContainer = document.querySelector('.canvas-container');
      fullscreenBtn.addEventListener('click', () => {
        console.log(`[UI] fullscreen button clicked. currentFS=${!!document.fullscreenElement}, pixiContainer=${pixiContainer.clientWidth}x${pixiContainer.clientHeight}`);
        if (!document.fullscreenElement) {
          canvasContainer.requestFullscreen().catch(err => {
            alert(`无法进入全屏模式: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      });

      // 监听全屏变化，调整渲染器尺寸
      document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        const canvasInfo = document.getElementById('canvas-info');
        
        // 延迟一小段时间再调整尺寸，以确保 DOM 更新完毕
        setTimeout(() => {
          let newWidth, newHeight;
          if (isFullscreen) {
            newWidth = screen.width;
            newHeight = screen.height - canvasInfo.offsetHeight;
          } else {
            // 退出全屏时，强制使用容器的 clientWidth/Height
            newWidth = pixiContainer.clientWidth;
            newHeight = pixiContainer.clientHeight;
          }
          console.log(`[Resize][fullscreenchange] isFS=${isFullscreen} screen=${screen.width}x${screen.height} pixiContainer=${pixiContainer.clientWidth}x${pixiContainer.clientHeight} canvasInfoH=${canvasInfo?.offsetHeight} -> resize(${newWidth}x${newHeight})`);
          renderer.resize(newWidth, newHeight);
          console.log(`[Resize][fullscreenchange] renderer.resize done.`);
        }, 100); // 100ms 延迟
      });

      // 绑定 UI 事件
      this.setupUIEventHandlers();

      this.isInitialized = true;
      console.log('✅ Application initialized successfully');

      // 显示欢迎信息
      this.showWelcomeMessage();

    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showError('应用初始化失败: ' + error.message);
    }
  }

  /**
   * 设置 Worker 回调
   */
  setupWorkerCallbacks() {
    workerManager.setCallbacks({
      onStart: (payload) => {
        console.log('🎬 Generation started:', payload);
        this.inputForm.disable();
        this.progressBar.reset();
        this.progressBar.show();
        this.updateStats(null);
        // 仅记录开始时间，不显示 Loading 弹窗
        this.perf.start = performance.now();
      },

      onObstacleReady: (obstacles, count) => {
        console.log(`🧱 Obstacles generated: ${count}`);
      },

      onProgress: (progress, currentLayer, totalLayers, layerNodeCount) => {
        this.progressBar.updateProgress(progress, currentLayer, totalLayers, layerNodeCount);
      },

      onComplete: (data) => {
        console.log('🎉 Generation completed:', data.metadata);
        this.roadNetData = data;
        
        // 更新 UI
        this.progressBar.updateProgress(1);
        setTimeout(() => {
          this.progressBar.hide();
        }, 1000);

        // 设置层控制
        this.layerControl.setLayers(data.layers.length, data);
        this.layerControl.show();

        // 更新统计信息
        this.updateStats(data.metadata);

        // 启用表单
        this.inputForm.enable();

        // 显示成功消息
        this.showSuccess(`成功生成 ${data.metadata.layerCount} 层道路网络！`);

        // 展示性能与 L0 规模 + profiling 指标 + 渲染耗时/数据体积
        const cost = Math.max(0, Math.round(performance.now() - this.perf.start));
        const perfInfo = document.getElementById('perf-info');
        const l0 = (data && data.layers && data.layers[0]) ? data.layers[0] : null;
        const nodeCount = l0 && l0.nodes ? l0.nodes.length : 0;
        const edgeCount = l0 && l0.edges ? l0.edges.length : 0;
        const meta = data && data.metadata ? data.metadata : {};
        const prof = meta.profile || (l0 && l0.metadata && l0.metadata.profile) || null;
        let profText = '';
        if (prof) {
          const avgCandidates = prof.edgesChecked > 0 ? (prof.candidatesAccum / prof.edgesChecked).toFixed(1) : '-';
          const onOff = meta.useSpatialIndex ? '启用' : '关闭';
          profText = ` | 索引:${onOff} | 索引构建 ${prof.indexBuildMs} ms | 候选均值 ${avgCandidates}/边`;
        }
        // 单次渲染测时（避免上方重复渲染）
        const tRender0 = performance?.now ? performance.now() : Date.now();
        renderer.renderRoadNet(data);
        const tRender1 = performance?.now ? performance.now() : Date.now();
        const renderMs = Math.max(0, Math.round(tRender1 - tRender0));
        let dataKB = '-';
        try {
          const payload = { layers: data.layers, obstacles: data.obstacles };
          const len = JSON.stringify(payload).length;
          dataKB = Math.round(len / 1024) + 'KB';
        } catch (e) { /* ignore stringify errors */ }
        const initMs = this.perf.initRenderMs || 0;
        if (perfInfo) perfInfo.textContent = `本次计算：耗时 ${cost} ms | 可行节点 ${nodeCount} 个 | 可行边 ${edgeCount} 条${profText} | 初始化渲染 ${initMs} ms | 数据体积 ${dataKB} | 渲染 ${renderMs} ms`;
      },

      onError: (error) => {
        console.error('💥 Generation error:', error);
        this.progressBar.hide();
        this.inputForm.enable();
        this.showError('生成失败: ' + error.message);

        // 仅恢复交互，无 Loading 弹窗
      }
    });
  }

  /**
   * 设置 UI 事件处理
   */
  setupUIEventHandlers() {
    // 表单提交
    this.inputForm.onSubmit((values) => {
      console.log('📝 Form submitted:', values);
      this.handleGenerate(values);
    });

    // 层切换
    this.layerControl.onLayerChange((layerIndex) => {
      console.log(`🔄 Switching to layer ${layerIndex}`);
      renderer.showLayer(layerIndex);
      this.layerControl.updateLayerInfo(this.roadNetData);
    });

    // 显示所有层
    this.layerControl.onShowAll(() => {
      console.log('👀 Showing all layers');
      renderer.showLayer(null);
    });

    // 窗口大小调整
    const pixiContainer = document.getElementById('pixi-canvas');
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!document.fullscreenElement) {
          const w = pixiContainer.clientWidth;
          const h = pixiContainer.clientHeight;
          console.log(`[Resize][window] viewport=${window.innerWidth}x${window.innerHeight} pixiContainer=${w}x${h} -> resize(${w}x${h})`);
          renderer.resize(w, h);
        }
      }, 250);
    });
  }

  /**
   * 处理生成请求
   */
  handleGenerate(values) {
    const { width, height, layerCount, obstacleCount, mode, useSpatialIndex, cellSize } = values;

    console.log(`🎯 Generating navigation graph: ${width}×${height}×${layerCount} layers, ${obstacleCount} obstacles`);

    // 清空之前的数据
    // 先清理交互层（动画、路径线、起终点标记、提示面板）
    if (renderer && renderer.interaction) {
      try {
        renderer.interaction.cancelAnimationIfAny();
        renderer.interaction.clearInteractionGraphics();
        if (typeof renderer.interaction.resetPathInfo === 'function') {
          renderer.interaction.resetPathInfo();
        }
      } catch (e) {
        console.warn('[Interaction] 清理失败但不影响生成：', e);
      }
    }
    this.roadNetData = null;
    this.layerControl.reset();
    renderer.clearCanvas();

    // 开始生成
    const success = workerManager.generateNavGraph(width, height, layerCount, obstacleCount, undefined, mode, { useSpatialIndex, cellSize });
    
    if (!success) {
      this.showError('无法启动生成任务，请稍后重试');
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(metadata) {
    const nodeCount = document.getElementById('node-count');
    const edgeCount = document.getElementById('edge-count');
    const layerCount = document.getElementById('layer-count');

    if (metadata) {
      if (nodeCount) nodeCount.textContent = `节点: ${metadata.totalNodes}`;
      if (edgeCount) edgeCount.textContent = `边: ${metadata.totalEdges}`;
      if (layerCount) layerCount.textContent = `层数: ${metadata.layerCount}`;
    } else {
      if (nodeCount) nodeCount.textContent = '节点: 0';
      if (edgeCount) edgeCount.textContent = '边: 0';
      if (layerCount) layerCount.textContent = '层数: 0';
    }
  }

  /**
   * 显示欢迎消息
   */
  showWelcomeMessage() {
    console.log(`
╔═══════════════════════════════════════╗
║   🧭 RoadNet Visualizer MVP v1.0     ║
║   多层道路网络生成与可视化工具       ║
╚═══════════════════════════════════════╝

👉 使用说明:
1. 输入网格尺寸（宽度 × 高度）
2. 选择层数
3. 点击"生成道路网络"按钮
4. 使用层控制查看不同层
    `);
  }

  /**
   * 显示错误消息
   */
  showError(message) {
    console.error('❌', message);
    alert('❌ ' + message);
  }

  /**
   * 显示成功消息
   */
  showSuccess(message) {
    console.log('✅', message);
    // #TODO: 使用更友好的通知组件（如 toast）
  }

  /**
   * 清理资源
   */
  destroy() {
    workerManager.terminate();
    renderer.destroy();
    console.log('🛑 Application destroyed');
  }
}

// 创建并初始化应用
const app = new App();

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// 导出应用实例（用于调试）
window.roadNetApp = app;

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  app.destroy();
});
