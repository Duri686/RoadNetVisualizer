/**
 * Main Application
 * 主应用入口，协调各个模块
 */

import workerManager from './core/workerManager.js';
import renderer from './core/renderer3d.js';
import InputForm from './components/InputForm.js';
import ProgressBar from './components/ProgressBar.js';
import LayerControl from './components/LayerControl.js';
import statusManager from './utils/statusManager.js';
import shareManager from './utils/shareManager.js';
import exportManager from './utils/exportManager.js';
import UIManager from './managers/UIManager.js';
import AppEventManager from './managers/AppEventManager.js';
import GenerationManager from './managers/GenerationManager.js';
import './ui/components/OperationPanelElement.js';
import './ui/components/VisualizationPanelElement.js';
import './ui/components/InterpretationPanelElement.js';

// #TODO: 添加错误边界处理
// #TODO: 添加性能监控
// #TODO: 添加用户偏好设置（保存到 localStorage）

class App {
  constructor() {
    this.inputForm = null;
    this.progressBar = null;
    this.layerControl = null;
    this.roadNetData = null;
    this.renderer = renderer; // 暴露渲染器引用
    this.isInitialized = false;
    // 性能计时（仅记录耗时，不显示 Loading）
    this.perf = { start: 0 };

    // Managers
    this.uiManager = new UIManager(this);
    this.appEventManager = new AppEventManager(this);
    this.generationManager = new GenerationManager(this);
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

      // 等待浏览器完成布局后再初始化 PixiJS
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const tInit0 = performance?.now ? performance.now() : Date.now();

      // 获取实际容器尺寸
      const containerWidth = pixiContainer.clientWidth || 800;
      const containerHeight = pixiContainer.clientHeight || 600;

      console.log(
        `[Renderer] Initializing with size: ${containerWidth}x${containerHeight}`,
      );

      renderer.init(pixiContainer, {
        width: containerWidth,
        height: containerHeight,
      });
      const tInit1 = performance?.now ? performance.now() : Date.now();
      this.perf.initRenderMs = Math.max(0, Math.round(tInit1 - tInit0));

      // 初始化 Managers
      this.uiManager.init();
      this.appEventManager.init();

      this.isInitialized = true;
      console.log('✅ Application initialized successfully');

      // 显示欢迎信息
      this.showWelcomeMessage();
      statusManager.setReady();
      // 记录 LayerControl 运行模式
      try {
        const headless = this.layerControl && this.layerControl._headless;
        console.log(`[LayerControl] mode=${headless ? 'headless' : 'with-ui'}`);
      } catch (e) {
        console.debug('[LayerControl] mode log skipped:', e);
      }

      // 尝试从 URL 加载参数
      const hasUrlParams = shareManager.loadFromUrl();

      // 等待首屏布局稳定后再触发一次默认生成，避免初始测量抖动
      setTimeout(() => {
        if (hasUrlParams) {
          // 如果有 URL 参数，使用 URL 参数生成
          const values = this.inputForm.getValues();
          this.handleGenerate(values);
        } else {
          // 否则使用默认参数
          this.autoGenerateOnce();
        }
      }, 120);
    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showError('应用初始化失败: ' + error.message);
    }
  }

  /**
   * 设置 Worker 回调
   */
  setupWorkerCallbacks() {
    if (this.generationManager) {
      this.generationManager.setupWorkerCallbacks();
    }
  }

  /**
   * 处理生成请求
   */
  handleGenerate(values) {
    if (this.generationManager) {
      this.generationManager.handleGenerate(values);
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(metadata) {
    if (this.generationManager) {
      this.generationManager.updateStats(metadata);
    }
  }

  /**
   * 首次自动生成一张地图（默认参数）
   */
  autoGenerateOnce() {
    try {
      const w = document.getElementById('width-input');
      const h = document.getElementById('height-input');
      const l = document.getElementById('layer-input');
      const o = document.getElementById('obstacle-input');
      const si = document.getElementById('use-spatial-index');
      const sc = document.getElementById('static-cache');
      const ce = document.getElementById('culling-enabled');
      const cm = document.getElementById('culling-margin-input');
      if (w) w.value = '500';
      if (h) h.value = '300';
      if (l) l.value = '2';
      if (o) o.value = '200';
      if (si) si.checked = true;
      if (sc) sc.checked = false;
      if (ce) ce.checked = true;
      if (cm) cm.value = '128';
      const values = this.inputForm.getValues();
      this.handleGenerate(values);
    } catch (e) {
      console.warn('Auto generate failed:', e);
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
