/**
 * PixiJS Renderer Core
 * 使用 PixiJS 渲染 2D 道路网络的核心模块
 * 负责应用初始化、图层管理、整体渲染流程
 */

import * as PIXI from 'pixi.js';
import { RendererDrawing } from './RendererDrawing.js';
import { RendererInteraction } from './RendererInteraction.js';

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
      maxScale: 5
    };

    // 渲染配置
    this.config = {
      nodeRadius: 3,
      nodeColor: 0xffffff,
      nodeAlpha: 0.9,
      edgeWidth: 1.5,
      edgeColor: 0x64748b,
      edgeAlpha: 0.6,
      layerColors: [
        0x3b82f6, // 蓝色
      ],
      // 交互配置
      interaction: {
        startNodeColor: 0x00ff00,  // 绿色起点
        endNodeColor: 0xff0000,    // 红色终点
        hoveredNodeColor: 0xffff00, // 黄色悬停
        pathColor: 0xf59e0b,       // 橙色路径（与可行网络区分）
        pathWidth: 3,
        nodeHighlightRadius: 6,
        crosshairSize: 15,
        crosshairColor: 0xffffff,
        crosshairAlpha: 0.8
      },
      cellSize: 10, // 基础网格单元大小（会自适应调整）
      padding: 40
    };

    // 初始化子模块
    this.drawing = new RendererDrawing(this.config, this.transform);
    this.interaction = new RendererInteraction(this.config, this.transform, this.drawing);
  }

  /**
   * 按 flags 应用可见性
   */
  applyVisibilityFlags() {
    // 障碍物
    if (this.obstacleLayer) {
      this.obstacleLayer.visible = this.flags.obstaclesVisible !== false;
    }
    // 每层子容器：overlay-base / network-edges / network-nodes / voronoi-skeleton
    if (Array.isArray(this.layerContainers)) {
      this.layerContainers.forEach((layerC, idx) => {
        const layerVisible = this.currentLayer === null ? true : idx === this.currentLayer;
        const overlay = layerC.children?.find(ch => ch.name === 'overlay-base');
        const nEdges = layerC.children?.find(ch => ch.name === 'network-edges');
        const nNodes = layerC.children?.find(ch => ch.name === 'network-nodes');
        const voronoi = layerC.children?.find(ch => ch.name === 'voronoi-skeleton');

        if (overlay) overlay.visible = layerVisible && (this.flags.baseOverlayVisible !== false);
        if (nEdges) nEdges.visible = layerVisible && (this.flags.networkEdgesVisible !== false);
        if (nNodes) nNodes.visible = layerVisible && (this.flags.networkNodesVisible !== false);
        if (voronoi) voronoi.visible = layerVisible && (this.flags.voronoiVisible !== false);

        // 层容器本身可见性 = 任一子容器可见
        layerC.visible = !!(overlay?.visible || nEdges?.visible || nNodes?.visible || voronoi?.visible);
      });
    }
  }

  /** 设置障碍物显隐 */
  setObstaclesVisible(visible) {
    this.flags.obstaclesVisible = !!visible;
    this.applyVisibilityFlags();
    console.log(`[Renderer] obstacles visible = ${!!visible}`);
  }

  /** 设置网络显隐（所有层的节点与边） */
  setNetworkVisible(visible) {
    this.flags.networkNodesVisible = !!visible;
    this.flags.networkEdgesVisible = !!visible;
    this.applyVisibilityFlags();
    console.log(`[Renderer] network (nodes+edges) visible = ${!!visible}`);
  }

  /** 仅设置网络节点显隐 */
  setNetworkNodesVisible(visible) {
    this.flags.networkNodesVisible = !!visible;
    // 默认：边与节点一起联动（如需独立控制，请调用 setNetworkEdgesVisible）
    this.applyVisibilityFlags();
    console.log(`[Renderer] network nodes visible = ${!!visible}`);
  }

  /** 仅设置网络边显隐（可选） */
  setNetworkEdgesVisible(visible) {
    this.flags.networkEdgesVisible = !!visible;
    this.applyVisibilityFlags();
    console.log(`[Renderer] network edges visible = ${!!visible}`);
  }

  /** 设置基础三角化覆盖层显隐 */
  setBaseTriangulationVisible(visible) {
    this.flags.baseOverlayVisible = !!visible;
    this.applyVisibilityFlags();
    console.log(`[Renderer] base overlay visible = ${!!visible}`);
  }

  /** 设置 Voronoi 骨架显隐（当前与网络层合并绘制，仅日志提示） */
  setVoronoiVisible(visible) {
    this.flags.voronoiVisible = !!visible;
    this.applyVisibilityFlags();
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
  renderRoadNet(navGraphData) {
    if (!this.app) {
      console.error('❌ Renderer not initialized');
      return;
    }

    // 先清空画布，再设置数据
    this.clearCanvas();
    this.roadNetData = navGraphData;

    // 重置视图状态（初始化或调整大小时强制清零，避免上一次缩放/平移造成偏移）
    this.transform.scale = 1;
    this.transform.panX = 0;
    this.transform.panY = 0;
    if (this.mainContainer) {
      this.mainContainer.scale.set(1, 1);
      this.mainContainer.position.set(0, 0);
    }

    const { layers, obstacles, metadata } = navGraphData;
    const { width, height } = metadata;

    console.log(`🎨 Rendering ${layers.length} layers with ${obstacles?.length || 0} obstacles...`);

    // 自适应cellSize：让地图填充画布80%
    const maxDim = Math.max(width, height);
    const availableSize = Math.min(this.app.screen.width, this.app.screen.height) * 0.8;
    const cellSize = Math.max(2, Math.floor(availableSize / maxDim));
    
    // 计算居中偏移
    const totalWidth = width * cellSize;
    const totalHeight = height * cellSize;
    const offsetX = (this.app.screen.width - totalWidth) / 2;
    const offsetY = (this.app.screen.height - totalHeight) / 2;

    // 先渲染障碍物层（底层）
    if (obstacles && obstacles.length > 0) {
      const obstacleContainer = this.drawing.renderObstacles(obstacles, offsetX, offsetY, cellSize);
      this.obstacleLayer = obstacleContainer; // 保存引用供外部切换
      this.mainContainer.addChild(obstacleContainer);
    }

    // 为每一层创建容器并渲染
    layers.forEach((layer, index) => {
      const layerContainer = this.drawing.createLayerContainer(layer, index, offsetX, offsetY, cellSize);
      this.layerContainers.push(layerContainer);
      this.mainContainer.addChild(layerContainer);
    });

    // 默认显示第一层
    this.showLayer(0);

    // 初始应用可见性标志
    this.applyVisibilityFlags();

    // 保存坐标转换参数并更新子模块（初始化后为默认视图）
    this.transform = { 
      offsetX, 
      offsetY, 
      cellSize,
      scale: 1,
      panX: 0,
      panY: 0
    };
    
    this.drawing.updateTransform(this.transform);
    this.interaction.updateTransform(this.transform);
    // 缩放后重建基础三角化虚线
    this.rebuildAllOverlays();

    // 设置导航图数据并启用交互
    this.interaction.setRoadNetData(navGraphData);
    this.setupInteraction();

    console.log('✅ Rendering complete');
  }


  /**
   * 设置交互功能
   */
  setupInteraction() {
    if (!this.app || !this.roadNetData) {
      console.warn('⚠️ Cannot setup interaction: app or roadNetData missing');
      return;
    }

    // 允许按照 zIndex 排序
    this.app.stage.sortableChildren = true;
    this.mainContainer.sortableChildren = true;

    // 创建交互容器
    if (!this.interactionContainer) {
      this.interactionContainer = new PIXI.Container();
      this.interactionContainer.name = 'interaction';
      this.interactionContainer.sortableChildren = true;
    }
    // 确保交互容器已挂载在主容器中（clearCanvas 后需要重新挂载）
    if (this.interactionContainer.parent !== this.mainContainer) {
      this.mainContainer.addChild(this.interactionContainer);
    }
    this.interactionContainer.visible = true;
    this.interactionContainer.zIndex = 1000;

    // 创建路径容器
    if (!this.pathContainer) {
      this.pathContainer = new PIXI.Container();
      this.pathContainer.name = 'path';
    }
    this.pathContainer.zIndex = 1001;
    if (this.pathContainer.parent !== this.interactionContainer) {
      this.interactionContainer.addChild(this.pathContainer);
    }
    this.pathContainer.visible = true;
    this.pathContainer.alpha = 1;

    // 创建十字星光标
    if (!this.crosshairGraphics) {
      this.crosshairGraphics = new PIXI.Graphics();
      this.crosshairGraphics.visible = false;
    }
    this.crosshairGraphics.zIndex = 1002;
    if (this.crosshairGraphics.parent !== this.interactionContainer) {
      this.interactionContainer.addChild(this.crosshairGraphics);
    }

    // 设置交互模块的容器引用
    this.interaction.setContainers(
      this.interactionContainer, // 交互层
      this.crosshairGraphics,
      this.pathContainer
    );

    // 初始化交互功能
    this.interaction.setup(
      this.app,
      this.onPointerMove.bind(this),
      this.onPointerDown.bind(this)
    );

    // 保证交互容器在最上层
    if (this.mainContainer.children[this.mainContainer.children.length - 1] !== this.interactionContainer) {
      this.mainContainer.addChild(this.interactionContainer);
    }
  }

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
    if (this.currentLayer !== 0) {
      console.log('❌ Click ignored: layer=', this.currentLayer);
      return;
    }
    this.interaction.handlePointerDown(event);
  }


  /**
   * 显示指定层
   * @param {number} layerIndex - 层索引（null表示显示所有层）
   */
  showLayer(layerIndex) {
    if (layerIndex === null) {
      // 显示所有层
      this.layerContainers.forEach(container => {
        container.visible = true;
      });
      this.showAllLayers = true;
      this.currentLayer = null;
    } else {
      // 显示指定层
      this.layerContainers.forEach((container, index) => {
        container.visible = index === layerIndex;
      });
      this.showAllLayers = false;
      this.currentLayer = layerIndex;
    }

    // 只在第一层启用交互
    const showInteraction = layerIndex === 0;
    if (this.interactionContainer) {
      this.interactionContainer.visible = showInteraction;
    }
    if (!showInteraction) {
      this.interaction.disable();
    } else {
      this.interaction.enable();
    }

    console.log(`👁️ Showing layer: ${layerIndex === null ? 'All' : layerIndex}`);
    // 应用可见性标志
    this.applyVisibilityFlags();
  }

  /**
   * 清空画布
   */
  clearCanvas() {
    if (this.mainContainer) {
      this.mainContainer.removeChildren();
      this.layerContainers = [];
    }
    this.currentLayer = null;
    this.showAllLayers = false;
    this.roadNetData = null;
  }

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
        // 记录现有的交互起点 ID，用于渲染后恢复
        const prevStartId = this.interaction && this.interaction.state.startNode
          ? this.interaction.state.startNode.id
          : null;
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
        }
      }
    }
  }
  
  /**
   * 设置缩放和平移功能
   */
  setupZoomAndPan() {
    if (!this.app) return;
    
    const view = this.app.view;
    
    // 鼠标滚轮缩放
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // 计算缩放因子 (向下滚动为缩小，向上滚动为放大)
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      
      // 计算新的缩放值
      const newScale = this.transform.scale * scaleFactor;
      
      // 限制缩放范围
      if (newScale >= this.viewState.minScale && newScale <= this.viewState.maxScale) {
        // 获取鼠标相对于画布的位置
        const mouseX = e.clientX - view.getBoundingClientRect().left;
        const mouseY = e.clientY - view.getBoundingClientRect().top;
        
        // 计算鼠标相对于主容器的位置
        const worldPos = {
          x: (mouseX - this.mainContainer.x) / this.transform.scale,
          y: (mouseY - this.mainContainer.y) / this.transform.scale
        };
        
        // 更新缩放值
        this.transform.scale = newScale;
        
        // 应用缩放
        this.mainContainer.scale.set(newScale);
        
        // 计算新的主容器位置，保持鼠标下的点不变
        const newX = mouseX - worldPos.x * newScale;
        const newY = mouseY - worldPos.y * newScale;
        
        // 应用新位置
        this.mainContainer.x = newX;
        this.mainContainer.y = newY;
        
        // 更新绘制模块的缩放参数
        this.drawing.updateTransform(this.transform);
        this.interaction.updateTransform(this.transform);
        // 缩放后按视觉密度重建基础三角化虚线
        this.rebuildAllOverlays();
        
        console.log(`🔍 Zoom: ${newScale.toFixed(2)}x`);
      }
    });
    
    // 鼠标拖拽平移
    view.addEventListener('mousedown', (e) => {
      this.viewState.isDragging = true;
      this.viewState.lastPosition = { x: e.clientX, y: e.clientY };
      view.style.cursor = 'grabbing';
    });
    
    view.addEventListener('mousemove', (e) => {
      if (this.viewState.isDragging && this.viewState.lastPosition) {
        // 计算鼠标移动距离
        const deltaX = e.clientX - this.viewState.lastPosition.x;
        const deltaY = e.clientY - this.viewState.lastPosition.y;
        
        // 更新平移量
        this.transform.panX += deltaX / this.transform.scale;
        this.transform.panY += deltaY / this.transform.scale;
        
        // 应用平移
        this.mainContainer.position.x += deltaX;
        this.mainContainer.position.y += deltaY;
        
        // 更新最后位置
        this.viewState.lastPosition = { x: e.clientX, y: e.clientY };
      }
    });
    
    // 鼠标释放或离开画布时停止拖拽
    const endDrag = () => {
      this.viewState.isDragging = false;
      this.viewState.lastPosition = null;
      view.style.cursor = 'grab';
    };
    
    view.addEventListener('mouseup', endDrag);
    view.addEventListener('mouseleave', endDrag);
    
    // 设置默认光标
    view.style.cursor = 'grab';
    
    console.log('✅ Zoom and pan controls enabled');
  }

  /**
   * 编程式缩放（以画布中心为基准）
   * @param {number} scaleFactor 缩放因子，如 1.2 表示放大，0.8 表示缩小
   */
  zoom(scaleFactor = 1.0) {
    if (!this.app || !this.mainContainer || !this.drawing) return;

    const newScale = this.transform.scale * scaleFactor;
    if (newScale < this.viewState.minScale || newScale > this.viewState.maxScale) {
      console.debug(`[Renderer] zoom skipped: out of range ${newScale.toFixed(2)}`);
      return;
    }

    // 以画布中心缩放
    const view = this.app.view;
    const centerX = view.getBoundingClientRect().left + this.app.screen.width / 2;
    const centerY = view.getBoundingClientRect().top + this.app.screen.height / 2;

    const mouseX = this.app.screen.width / 2;
    const mouseY = this.app.screen.height / 2;

    const worldPos = {
      x: (mouseX - this.mainContainer.x) / this.transform.scale,
      y: (mouseY - this.mainContainer.y) / this.transform.scale,
    };

    this.transform.scale = newScale;
    this.mainContainer.scale.set(newScale);

    const newX = mouseX - worldPos.x * newScale;
    const newY = mouseY - worldPos.y * newScale;
    this.mainContainer.x = newX;
    this.mainContainer.y = newY;

    this.drawing.updateTransform(this.transform);
    this.interaction.updateTransform(this.transform);

    console.log(`🔍 [Renderer] Zoom -> ${newScale.toFixed(2)}x (factor=${scaleFactor})`);
  }

  /**
   * 放大
   */
  zoomIn() {
    this.zoom(1.2);
  }

  /**
   * 缩小
   */
  zoomOut() {
    this.zoom(0.8);
  }

  /**
   * 重置视图到初始状态（居中显示）
   */
  resetView() {
    if (!this.app || !this.mainContainer) return;
    this.transform.scale = 1;
    this.transform.panX = 0;
    this.transform.panY = 0;
    this.mainContainer.scale.set(1, 1);
    this.mainContainer.position.set(0, 0);
    this.drawing.updateTransform(this.transform);
    this.interaction.updateTransform(this.transform);
    // 重置后重建基础三角化虚线
    this.rebuildAllOverlays();
    console.log('↺ [Renderer] View reset');
  }

  /**
   * 重建所有层的基础三角化虚线（根据当前 scale 自适应 dash/gap）
   */
  rebuildAllOverlays() {
    if (!this.roadNetData || !Array.isArray(this.layerContainers)) return;
    const { offsetX, offsetY, cellSize } = this.transform || {};
    this.layerContainers.forEach((layerC, idx) => {
      const overlay = layerC.children?.find(ch => ch.name === 'overlay-base');
      if (!overlay) return;
      const edges = this.roadNetData.layers?.[idx]?.metadata?.overlayBase?.edges || [];
      if (edges && edges.length && this.drawing && typeof this.drawing.rebuildOverlayBase === 'function') {
        this.drawing.rebuildOverlayBase(overlay, edges, offsetX, offsetY, cellSize);
      }
    });
  }

  /**
   * 获取当前视口的世界坐标矩形（用于缩略图同步）
   */
  getViewportRect() {
    if (!this.app) return null;
    const scale = this.transform.scale || 1;
    const x = -this.mainContainer.x / scale;
    const y = -this.mainContainer.y / scale;
    const width = this.app.screen.width / scale;
    const height = this.app.screen.height / scale;
    return { x, y, width, height, scale };
  }

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
