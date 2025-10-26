/**
 * PixiJS Renderer Core
 * 使用 PixiJS 渲染 2D 道路网络的核心模块
 * 负责应用初始化、图层管理、整体渲染流程
 */

import * as PIXI from 'pixi.js';
import { RendererDrawing } from './RendererDrawing.js';
import { RendererInteraction } from './RendererInteraction.js';
import { renderRoadNetImpl } from './renderer.render.js';
import { applyVisibilityFlagsImpl, setObstaclesVisibleImpl, setNetworkVisibleImpl, setNetworkNodesVisibleImpl, setNetworkEdgesVisibleImpl, setBaseTriangulationVisibleImpl, setVoronoiVisibleImpl, showLayerImpl, clearCanvasImpl, rebuildAllOverlaysImpl } from './renderer.layers.js';
import { getViewportRectImpl, zoomImpl, zoomInImpl, zoomOutImpl, resetViewImpl, centerOnImpl, setupZoomAndPanImpl } from './renderer.view.js';
import { setupInteractionImpl } from './renderer.interaction.js';
import { createRendererConfig } from './renderer.config.js';

// #TODO: 添加节点和边的交互功能（hover, click）
// #TODO: 优化大规模网络的渲染性能（使用 ParticleContainer 或分块渲染）

class Renderer {
  constructor() {
    this.app = null;
    this.mainContainer = null;
    this.layerContainers = [];
    this.roadNetData = null;
    this.currentLayer = null;
    this.showAllLayers = false;
    this.flags = {
      obstaclesVisible: true,
      baseOverlayVisible: true,
      networkNodesVisible: true,
      networkEdgesVisible: true,
      voronoiVisible: true
    };

    // 交互图层引用
    this.interactionContainer = null;
    this.crosshairGraphics = null;
    this.pathContainer = null;

    // 坐标转换参数
    this.transform = {
      offsetX: 0,
      offsetY: 0,
      cellSize: 1,
      scale: 1,  // 缩放比例
      panX: 0,   // X轴平移量
      panY: 0    // Y轴平移量
    };
    
    // 缩放和平移状态
    this.viewState = {
      isDragging: false,
      lastPosition: null,
      minScale: 0.1,
      maxScale: 5,
      suppressClickUntil: 0
    };

    // 触控指针状态（用于移动端单指拖拽与双指捏合）
    this.pointerState = {
      pointers: new Map(),
      lastDistance: null,
      lastCenter: null,
      dragThreshold: 4
    };

    // 渲染配置
    this.config = createRendererConfig();

    // 初始化子模块
    this.drawing = new RendererDrawing(this.config, this.transform);
    this.interaction = new RendererInteraction(this.config, this.transform, this.drawing);
  }

  /**
   * 基于当前视窗参数刷新障碍物层（用于缩放/平移后重新裁剪）
   */
  refreshObstacleCulling(deferTexture = false) {
    try {
      if (!this.app || !this.mainContainer || !this.roadNetData || !Array.isArray(this.roadNetData.obstacles)) return;
      const obstacles = this.roadNetData.obstacles;
      const { offsetX = 0, offsetY = 0, cellSize = 1 } = this.transform || {};
      // 清理旧障碍层与缓存纹理
      if (this.obstacleLayer) {
        try { this.mainContainer.removeChild(this.obstacleLayer); } catch (_) {}
        try { this.obstacleLayer.destroy && this.obstacleLayer.destroy({ children: true, texture: false, baseTexture: false }); } catch (_) {}
        this.obstacleLayer = null;
      }
      if (this._obstacleCache && this._obstacleCache.texture) {
        try { this._obstacleCache.texture.destroy(true); } catch (_) {}
        this._obstacleCache = null;
      }
      if (this._obTexTimer) { try { clearTimeout(this._obTexTimer); } catch (_) {} this._obTexTimer = null; }
      const cfg = this.config || {};
      const doCull = !!(cfg.culling && cfg.culling.enabled);
      const margin = (cfg.culling && typeof cfg.culling.margin === 'number') ? cfg.culling.margin : 128;
      // 将视口转换为“内容像素”坐标（未乘缩放），使之与绘制坐标系一致
      const scale = this.transform?.scale || 1;
      const leftContentPx = -this.mainContainer.x / scale;
      const topContentPx = -this.mainContainer.y / scale;
      const viewWidthContentPx = this.app.screen.width / scale;
      const viewHeightContentPx = this.app.screen.height / scale;
      const cullRect = doCull
        ? {
            x: leftContentPx - margin,
            y: topContentPx - margin,
            w: viewWidthContentPx + margin * 2,
            h: viewHeightContentPx + margin * 2,
          }
        : null;
      const canCache = !!(cfg.caching && cfg.caching.staticLayers === true);
      // 重新绘制（与初始渲染一致，但不使用跨视口缓存）
      const container = this.drawing.renderObstacles(obstacles, offsetX, offsetY, cellSize, cullRect);
      if (canCache && !deferTexture) {
        try {
          const worldBounds = container.getBounds?.() || { x: 0, y: 0, width: 1, height: 1 };
          const region = new PIXI.Rectangle(worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height);
          const tex = this.app.renderer.generateTexture(container, { region });
          const spr = new PIXI.Sprite(tex);
          spr.name = 'obstacles';
          spr.position.set(worldBounds.x, worldBounds.y);
          this._obstacleCache = { key: 'viewport-refresh', obsRef: obstacles, texture: tex, sprite: spr };
          this.obstacleLayer = spr;
          this.mainContainer.addChild(spr);
          try { container.destroy({ children: true }); } catch (_) {}
          return;
        } catch (_) {
          /* 回退到容器 */
        }
      }
      // 直接使用容器绘制，并在空闲时（若允许缓存）延迟转纹理
      this.obstacleLayer = container;
      this.mainContainer.addChild(container);
      if (canCache && deferTexture) {
        try {
          this._obTexTimer = setTimeout(() => {
            try { this.refreshObstacleCulling(false); } catch (_) {}
          }, 160);
        } catch (_) {}
      }
    } catch (e) {
      console.debug('[Renderer] refreshObstacleCulling skipped:', e);
    }
  }
 
  /**
   * 在执行 fn 期间临时开启动画快照保留，结束后恢复原状态
   * @param {Function} fn 回调函数
   */
  preserveAnimationDuring(fn) {
    const itx = this.interaction;
    if (!itx || !itx.state) {
      return typeof fn === 'function' ? fn() : undefined;
    }
    const prev = !!itx.state.keepAnimSnapshot;
    itx.state.keepAnimSnapshot = true;
    try {
      return typeof fn === 'function' ? fn() : undefined;
    } finally {
      itx.state.keepAnimSnapshot = prev;
    }
  }

  /**
   * 按 flags 应用可见性
   */
  applyVisibilityFlags() {
    applyVisibilityFlagsImpl(this);
  }

  /** 设置障碍物显隐 */
  setObstaclesVisible(visible) {
    setObstaclesVisibleImpl(this, visible);
    console.log(`[Renderer] obstacles visible = ${!!visible}`);
  }

  /** 设置网络显隐（所有层的节点与边） */
  setNetworkVisible(visible) {
    setNetworkVisibleImpl(this, visible);
    console.log(`[Renderer] network (nodes+edges) visible = ${!!visible}`);
  }

  /** 仅设置网络节点显隐 */
  setNetworkNodesVisible(visible) {
    setNetworkNodesVisibleImpl(this, visible);
    console.log(`[Renderer] network nodes visible = ${!!visible}`);
  }

  /** 仅设置网络边显隐（可选） */
  setNetworkEdgesVisible(visible) {
    setNetworkEdgesVisibleImpl(this, visible);
    console.log(`[Renderer] network edges visible = ${!!visible}`);
  }

  /** 设置基础三角化覆盖层显隐 */
  setBaseTriangulationVisible(visible) {
    setBaseTriangulationVisibleImpl(this, visible);
    console.log(`[Renderer] base overlay visible = ${!!visible}`);
  }

  /** 设置 Voronoi 骨架显隐（当前与网络层合并绘制，仅日志提示） */
  setVoronoiVisible(visible) {
    setVoronoiVisibleImpl(this, visible);
    console.log(`[Renderer] voronoi visible = ${!!visible}`);
  }

  /**
   * 初始化 PixiJS 应用
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 配置选项
   */
  async init(container, options = {}) {
    try {
      // 计算画布大小
      const width = options.width || Math.min(container.clientWidth, 1200);
      const height = options.height || 600;

      // 创建 PixiJS 应用 (v7 语法：直接在构造函数中传入配置)
      this.app = new PIXI.Application({
        width,
        height,
        backgroundColor: 0x0f172a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      // 将画布添加到容器
      container.innerHTML = '';
      container.appendChild(this.app.view);

      // 创建主容器
      this.mainContainer = new PIXI.Container();
      this.app.stage.addChild(this.mainContainer);
      
      // 使用 (0,0) 作为主容器原点，内容居中由 offsetX/offsetY 负责
      this.mainContainer.position.set(0, 0);

      // 禁用浏览器默认触摸缩放/滚动，便于自定义手势
      try {
        this.app.view.style.touchAction = 'none';
      } catch (e) {}

      // 初始化缩放和平移事件
      this.setupZoomAndPan();

      console.log('✅ PixiJS initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PixiJS:', error);
      throw error;
    }
  }

  /**
   * 渲染导航图（包含障碍物）
   * @param {Object} navGraphData - 导航图数据
   */
  renderRoadNet(navGraphData) { return renderRoadNetImpl(this, navGraphData); }


  /**
   * 设置交互功能
   */
  setupInteraction() { return setupInteractionImpl(this); }

  /**
   * 鼠标移动事件
   */
  onPointerMove(event) {
    this.interaction.handlePointerMove(event, this.currentLayer);
  }

  /**
   * 鼠标点击事件
   */
  onPointerDown(event) {
    // 双击手势触发时，短时间内抑制选点
    if (Date.now() < (this.viewState.suppressClickUntil || 0)) {
      return;
    }
    if (this.currentLayer !== 0) {
      console.log('❌ Click ignored: layer=', this.currentLayer);
      return;
    }
    this.interaction.handlePointerDown(event);
    try { window.dispatchEvent(new CustomEvent('renderer-selection-changed')); } catch (err) {}
  }


  /**
   * 显示指定层
   * @param {number} layerIndex - 层索引（null表示显示所有层）
   */
  showLayer(layerIndex) {
    console.log(`👁️ Showing layer: ${layerIndex === null ? 'All' : layerIndex}`);
    return showLayerImpl(this, layerIndex);
  }

  /**
   * 清空画布
   */
  clearCanvas() { return clearCanvasImpl(this); }

  /**
   * 获取当前渲染信息
   */
  getRenderInfo() {
    if (!this.roadNetData) {
      return null;
    }

    return {
      currentLayer: this.currentLayer,
      showAllLayers: this.showAllLayers,
      totalLayers: this.roadNetData.layers.length,
      metadata: this.roadNetData.metadata
    };
  }

  /**
   * 调整画布大小
   */
  resize(width, height) {
    if (this.app) {
      this.app.renderer.resize(width, height);
      
      // 如果有数据，则重新渲染以适应新尺寸并居中
      if (this.roadNetData) {
        console.log(`🔄 Resizing canvas to ${width}x${height}, re-rendering...`);
        const currentData = this.roadNetData;
        // 记录动画状态并立即取消，避免旧 RAF 残留导致位置错乱
        const wasAnimating = !!(this.interaction && this.interaction.state && this.interaction.state.isAnimating);
        try {
          if (this.interaction && wasAnimating) {
            this.preserveAnimationDuring(() => this.interaction.cancelAnimationIfAny());
          }
        } catch (_) {}
        // 记录现有的交互起点 ID，用于渲染后恢复
        const prevStartId = this.interaction && this.interaction.state.startNode
          ? this.interaction.state.startNode.id
          : null;
        // 记录是否已有已绘制路径，便于重绘
        const hadLastPath = !!(this.interaction && this.interaction.state && Array.isArray(this.interaction.state.lastPath) && this.interaction.state.lastPath.length > 0);
        this.renderRoadNet(currentData);
        // 重新设置交互，确保事件监听器在新的视图上生效
        this.setupInteraction();
        // 重新应用可见性
        this.applyVisibilityFlags();

        // 恢复交互状态：保留起点，清除终点与动画，确保 hover 预览可用
        if (this.interaction) {
          this.interaction.state.isAnimating = false;
          this.interaction.state.endNode = null;
          // 重新绑定起点引用到新的 nodes 对象，避免对象引用失效
          if (prevStartId && this.roadNetData && this.roadNetData.layers && this.roadNetData.layers[0]) {
            const restored = this.roadNetData.layers[0].nodes.find(n => n.id === prevStartId);
            if (restored) {
              this.interaction.state.startNode = restored;
            }
          }
          if (this.interaction.pathContainer) {
            this.interaction.pathContainer.removeChildren();
          }
          if (this.interaction.state.startNode) {
            this.interaction.drawInteractionNodes();
          }
          // 若之前已有路径，则在尺寸/全屏变化后重绘路径，避免路径被清空
          if (hadLastPath && typeof this.interaction.redrawLastPath === 'function') {
            try {
              this.preserveAnimationDuring(() => this.interaction.redrawLastPath());
            } catch (e) { console.debug('[Resize] redrawLastPath skipped:', e); }
          }
          // 若之前正在播放动画，则在路径重绘后恢复动画
          if (wasAnimating && this.interaction && this.interaction.state && Array.isArray(this.interaction.state.lastPath) && this.interaction.state.lastPath.length > 1) {
            try { this.interaction.animatePath(this.interaction.state.lastPath); } catch (_) {}
          }
        }
      }
    }
  }
  
  /**
   * 设置缩放和平移功能
   */
  setupZoomAndPan() { return setupZoomAndPanImpl(this); }

  /**
   * 编程式缩放（以画布中心为基准）
   * @param {number} scaleFactor 缩放因子，如 1.2 表示放大，0.8 表示缩小
   */
  zoom(scaleFactor = 1.0) {
    const before = this.transform.scale;
    zoomImpl(this, scaleFactor);
    const after = this.transform.scale;
    if (after !== before) console.log(`🔍 [Renderer] Zoom -> ${after.toFixed(2)}x (factor=${scaleFactor})`);
  }

  /**
   * 放大
   */
  zoomIn() { zoomInImpl(this); }

  /**
   * 缩小
   */
  zoomOut() { zoomOutImpl(this); }

  /**
   * 重置视图到初始状态（居中显示）
   */
  resetView() { resetViewImpl(this); console.log('↺ [Renderer] View reset'); }

  /**
   * 将视图中心移动到指定世界坐标（不改变缩放）
   */
  centerOn(worldX, worldY) { centerOnImpl(this, worldX, worldY); }

  /**
   * 重建所有层的基础三角化虚线（根据当前 scale 自适应 dash/gap）
   */
  rebuildAllOverlays() { return rebuildAllOverlaysImpl(this); }

  /**
   * 获取当前视口的世界坐标矩形（用于缩略图同步）
   */
  getViewportRect() { return getViewportRectImpl(this); }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
      this.mainContainer = null;
      this.layerContainers = [];
      console.log('🛑 Renderer destroyed');
    }
  }
}

// 导出单例
export default new Renderer();
