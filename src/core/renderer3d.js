/**
 * 3D渲染器主入口
 * 整合所有模块，提供统一接口
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../renderer3d/config/Renderer3DConfig.js';
import { SceneManager } from '../renderer3d/core/SceneManager.js';
import { LightingSystem } from '../renderer3d/systems/LightingSystem.js';
import { PostProcessingManager } from '../renderer3d/managers/PostProcessingManager.js';
import { AnimationController } from '../renderer3d/managers/AnimationController.js';
import { InteractionManager } from '../renderer3d/managers/InteractionManager.js';
import { StatsManager } from '../renderer3d/managers/StatsManager.js';
import { PathAnimationManager } from '../renderer3d/managers/PathAnimationManager.js';
import { RoadNetRenderer } from '../renderer3d/renderers/RoadNetRenderer.js';
import { PathRenderer } from '../renderer3d/renderers/PathRenderer.js';
import { MarkerRenderer } from '../renderer3d/renderers/MarkerRenderer.js';
import {
  onPointerMoveHandler,
  onClickHandler,
  onDoubleClickHandler,
  updateInteractionMarkersForRenderer,
  clearPathForRenderer,
  drawPathForRenderer,
  animatePathForRenderer,
  redrawLastPathForRenderer,
  clearInteractionGraphicsForRenderer,
  resetPathInfoForRenderer,
  zoomInCamera,
  zoomOutCamera,
  resetViewCamera,
  getViewportRectForRenderer,
  centerOnWorld,
  showLayerInScene,
  setLayerVisibilityInScene,
} from '../renderer3d/managers/Renderer3DInteractionController.js';
import { PerformanceProfiler } from '../renderer3d/utils/PerformanceProfiler.js';
import { SimplePerformanceMonitor } from '../renderer3d/utils/SimplePerformanceMonitor.js';

class Renderer3D {
  constructor() {
    this.container = null;
    this.roadNetData = null;
    this.currentLayer = null;

    // 核心模块
    this.sceneManager = new SceneManager();
    this.lightingSystem = null;
    this.postProcessing = null;
    this.statsManager = null;

    // 管理器
    this.animationController = null;
    this.interactionManager = null;
    this.pathAnimationManager = null;

    // 渲染器
    this.roadNetRenderer = null;
    this.pathRenderer = null;
    this.markerRenderer = null;

    // 动画
    this._animationId = null;
    this._animate = this._animate.bind(this);

    // 性能分析
    this.profiler = new PerformanceProfiler();
    this.simpleMonitor = new SimplePerformanceMonitor();

    // 兼容接口
    this.interaction = {
      state: { startNode: null, endNode: null, lastPath: null },
      clearPath: () => this.clearPath(),
      redrawLastPath: () => this.redrawLastPath(),
      cancelAnimationIfAny: () => this.pathAnimationManager?.stop(),
      clearInteractionGraphics: () => this.clearInteractionGraphics(),
      resetPathInfo: () => this.resetPathInfo(),
      animatePath: (path) => this.animatePath(path),
    };

    // 配置（用于兼容）
    this.config = { layerHeight: Renderer3DConfig.layerHeight };

    // 视角轴辅助
    this.axisScene = null;
    this.axisCamera = null;
    this.axisRoot = null;
    this.axisSize = 96;
    this.axisMargin = 16;
  }

  /**
   * 初始化
   */
  async init(container, options = {}) {
    try {
      this.container = container;

      // 初始化场景
      const { scene, camera, renderer, controls } = this.sceneManager.init(
        container,
        options,
      );
      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;
      this.controls = controls;

      // 初始化光照
      this.lightingSystem = new LightingSystem(scene);
      this.lightingSystem.init();

      // 初始化后期处理
      this.postProcessing = new PostProcessingManager(renderer, scene, camera);
      this.composer = this.postProcessing.init();

      // 初始化管理器
      this.animationController = new AnimationController(scene);
      this.interactionManager = new InteractionManager(camera);
      this.pathAnimationManager = new PathAnimationManager(
        scene,
        camera,
        controls,
      );

      // 初始化渲染器
      this.roadNetRenderer = new RoadNetRenderer(scene);
      this.pathRenderer = new PathRenderer(scene);
      this.markerRenderer = new MarkerRenderer(scene, this.animationController);

      // 初始化性能监控
      this.statsManager = new StatsManager(container);
      this.stats = this.statsManager.init();

      // 初始化视角轴辅助
      this._initAxisGizmo();

      // 绑定事件
      this.bindEvents();

      // 开始动画循环
      this._animate();

      console.log('✅ 模块化 Three.js 渲染器初始化成功');
      console.log('[PerformanceMonitor] 💡 性能分析提示:');
      console.log(
        '[PerformanceMonitor]    - 性能分析器已启动，每3秒输出一次报告',
      );
      console.log(
        '[PerformanceMonitor]    - 使用 window.roadNetApp.renderer.enableProfiling(false) 禁用',
      );
      console.log(
        '[PerformanceMonitor]    - 使用 window.roadNetApp.renderer.getProfilerStats() 获取实时数据',
      );

      return true;
    } catch (error) {
      console.error('❌ 渲染器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener(
      'pointermove',
      this.onPointerMove.bind(this),
    );
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    this.renderer.domElement.addEventListener(
      'dblclick',
      this.onDoubleClick.bind(this),
    );
  }

  /**
   * 渲染道路网络
   */
  renderRoadNet(data) {
    this.roadNetData = data;
    this.sceneManager.clear();

    if (!data || !data.layers) return;

    // 渲染道路网络
    const { centerX, centerY } = this.roadNetRenderer.render(data);

    // 初始化交互标记层和路径层（必须在这里创建！）
    if (!this.markerRenderer.markersGroup.parent) {
      this.scene.add(this.markerRenderer.markersGroup);
    }
    if (!this.pathRenderer.pathGroup.parent) {
      this.scene.add(this.pathRenderer.pathGroup);
    }

    // 调整相机位置
    const maxDim = Math.max(data.metadata.width, data.metadata.height);
    this.sceneManager.setCameraPosition(0, maxDim * 0.6, maxDim * 0.6);
    this.sceneManager.setControlsTarget(0, 0, 0);

    console.log('✅ 3D道路网络渲染完成');
  }

  // 初始化右下角视角轴辅助
  _initAxisGizmo() {
    try {
      this.axisScene = new THREE.Scene();
      // 背景透明，与主场景融合
      this.axisScene.background = null;

      this.axisCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
      this.axisCamera.position.set(0, 0, 3);
      this.axisCamera.lookAt(0, 0, 0);

      this.axisRoot = new THREE.Object3D();
      this.axisScene.add(this.axisRoot);

      const axisLength = 1.4;
      const axisRadius = 0.06;

      const xMaterial = new THREE.MeshBasicMaterial({ color: 0xf87171 });
      const yMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      const zMaterial = new THREE.MeshBasicMaterial({ color: 0x7c8ae2 });
      const originMaterial = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

      const sphereGeo = new THREE.SphereGeometry(axisRadius, 16, 16);

      // 原点
      const origin = new THREE.Mesh(sphereGeo, originMaterial);
      this.axisRoot.add(origin);

      const createAxis = (dir, material, labelColor) => {
        const group = new THREE.Group();
        const cylGeo = new THREE.CylinderGeometry(
          axisRadius * 0.6,
          axisRadius * 0.6,
          axisLength,
          8,
        );
        const cyl = new THREE.Mesh(cylGeo, material);
        cyl.position.y = axisLength / 2;
        group.add(cyl);

        const sphere = new THREE.Mesh(sphereGeo, material);
        sphere.position.y = axisLength;
        group.add(sphere);

        // 轴标签：放在轴末端稍远一点
        const label = this._createAxisLabel(dir.toUpperCase(), labelColor);
        label.position.y = axisLength + axisLength * 0.25;
        group.add(label);

        if (dir === 'x') {
          group.rotation.z = -Math.PI / 2;
        } else if (dir === 'z') {
          group.rotation.x = Math.PI / 2;
        }

        this.axisRoot.add(group);
      };

      // 颜色约定：X-红、Y-绿、Z-蓝（柔和色调）
      createAxis('x', xMaterial, '#f87171');
      createAxis('y', yMaterial, '#34d399');
      createAxis('z', zMaterial, '#60a5fa');
    } catch (e) {
      // TODO: 确认此逻辑
      console.warn('视角轴辅助初始化失败', e);
      this.axisScene = null;
      this.axisCamera = null;
      this.axisRoot = null;
    }
  }

  // 创建轴标签 Sprite，用于在视角轴末端标记 X/Y/Z
  _createAxisLabel(letter, colorHex) {
    try {
      if (typeof document === 'undefined') {
        return new THREE.Object3D();
      }

      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Object3D();

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, size, size);

      ctx.font =
        'bold 72px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colorHex || '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 6;
      ctx.strokeText(letter, size / 2, size / 2);
      ctx.fillText(letter, size / 2, size / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 2;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      const s = 0.7;
      sprite.scale.set(s, s, s);
      return sprite;
    } catch (e) {
      // TODO: 确认此逻辑
      return new THREE.Object3D();
    }
  }

  // 渲染右下角视角轴
  _renderAxisGizmo() {
    if (
      !this.axisScene ||
      !this.axisCamera ||
      !this.axisRoot ||
      !this.renderer ||
      !this.camera
    )
      return;

    // 同步相机朝向：旋转坐标轴根节点，使其反映主相机视角
    this.axisRoot.quaternion.copy(this.camera.quaternion).invert();

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const axisSize = this.axisSize || 80;
    const margin = this.axisMargin || 12;

    const x = size.x - axisSize - margin;
    const y = margin;

    // 清除深度后在同一帧内叠加渲染小场景
    this.renderer.clearDepth();
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(x, y, axisSize, axisSize);
    this.renderer.setScissor(x, y, axisSize, axisSize);
    this.renderer.render(this.axisScene, this.axisCamera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, size.x, size.y);
  }

  /**
   * 动画循环
   */
  _animate() {
    this._animationId = requestAnimationFrame(this._animate);

    // 开始性能追踪
    if (!this._animateStarted) {
      console.log(
        '[PerformanceMonitor] 🎬 _animate 首次调用, profiler:',
        this.profiler,
      );
      this._animateStarted = true;
    }
    this.profiler.startFrame();
    this.statsManager.begin();

    // 更新性能监控
    this.profiler.mark('performance-monitor');
    this.sceneManager.updatePerformance();
    this.profiler.markEnd('performance-monitor');

    // 控制器更新
    this.profiler.mark('controls-update');
    if (this.controls) this.controls.update();
    this.profiler.markEnd('controls-update');

    // 动画更新
    this.profiler.mark('animation-update');
    this.animationController.update(performance.now());
    this.profiler.markEnd('animation-update');

    // 渲染
    this.profiler.mark('render');
    this.postProcessing.render();
    this.profiler.markEnd('render');

    // 渲染右下角视角轴
    this.profiler.mark('axis-gizmo');
    this._renderAxisGizmo();
    this.profiler.markEnd('axis-gizmo');

    this.statsManager.end();

    // 结束性能追踪
    this.profiler.endFrame(this.renderer);

    // 获取真实性能数据
    const profilerStats = this.profiler.getCurrentStats();

    // 更新自定义 Stats 显示（显示真实 FPS）
    this.statsManager.update(profilerStats);

    // 简单监控（使用 profiler 的真实数据）
    this.simpleMonitor.update(profilerStats);
  }

  /**
   * 窗口大小变化
   */
  onWindowResize() {
    this.sceneManager.resize();
    const { width, height } = this.renderer.getSize(new THREE.Vector2());
    this.postProcessing.setSize(width, height);
  }

  /**
   * 鼠标移动
   */
  onPointerMove(event) {
    onPointerMoveHandler(this, event);
  }

  /**
   * 点击事件 (Single Click)
   * 仅用于选择起点/终点。如果导航已完成（有终点），则忽略单击。
   */
  onClick(event) {
    onClickHandler(this, event);
  }

  /**
   * 双击事件 (Double Click)
   * 用于重置导航或重新开始
   */
  onDoubleClick(event) {
    onDoubleClickHandler(this, event);
  }

  /**
   * 更新交互标记
   */
  updateInteractionMarkers() {
    updateInteractionMarkersForRenderer(this);
  }

  /**
   * 绘制路径
   */
  drawPath(path) {
    drawPathForRenderer(this, path);
  }

  /**
   * 绘制分层数据
   */
  drawHierarchicalData(zones, abstractPath, width, height, gridSize) {
    if (this.roadNetRenderer) {
      const centerX = (width || 100) / 2;
      const centerY = (height || 100) / 2;
      this.roadNetRenderer.renderHierarchicalData(
        zones,
        abstractPath,
        width,
        height,
        gridSize,
        centerX,
        centerY,
      );
    }
  }

  /**
   * 动画化路径
   */
  animatePath(path) {
    animatePathForRenderer(this, path);
  }

  /**
   * 清除路径
   */
  clearPath() {
    clearPathForRenderer(this);
  }

  /**
   * 重绘最后的路径
   */
  redrawLastPath() {
    redrawLastPathForRenderer(this);
  }

  /**
   * 清除交互图形
   */
  clearInteractionGraphics() {
    clearInteractionGraphicsForRenderer(this);
  }

  /**
   * 重置路径信息
   */
  resetPathInfo() {
    resetPathInfoForRenderer(this);
  }

  // ==================== 兼容接口 ====================

  resize() {
    this.onWindowResize();
  }

  clearCanvas() {
    this.sceneManager.clear();
    this.roadNetData = null;
  }

  zoomIn() {
    zoomInCamera(this);
  }

  zoomOut() {
    zoomOutCamera(this);
  }

  resetView() {
    resetViewCamera(this);
  }

  getViewportRect() {
    return getViewportRectForRenderer(this);
  }

  centerOn(worldX, worldY) {
    centerOnWorld(this, worldX, worldY);
  }

  showLayer(index) {
    // Legacy support or "Show All" (index === null)
    showLayerInScene(this, index);
  }

  setLayerVisibility(index, visible) {
    setLayerVisibilityInScene(this, index, visible);
  }

  setFpsVisible(visible) {
    if (this.statsManager) {
      this.statsManager.setVisible(visible);
    }
  }

  /**
   * 设置障碍物可见性
   */
  setObstaclesVisible(visible) {
    if (this.roadNetRenderer) {
      this.roadNetRenderer.toggleObstacles(visible);
    }
  }

  /**
   * 设置网络节点可见性
   */
  setNetworkNodesVisible(visible) {
    if (this.roadNetRenderer) {
      this.roadNetRenderer.toggleNodes(visible);
    }
  }

  /**
   * 设置网络边可见性
   */
  setNetworkEdgesVisible(visible) {
    if (this.roadNetRenderer) {
      this.roadNetRenderer.toggleEdges(visible);
    }
  }

  /**
   * 设置基础三角化可见性
   */
  setBaseTriangulationVisible(visible) {
    if (this.roadNetRenderer) {
      this.roadNetRenderer.toggleBaseTriangulation(visible);
    }
  }

  /**
   * 设置 Voronoi 可见性
   */
  setVoronoiVisible(visible) {
    if (this.roadNetRenderer) {
      this.roadNetRenderer.toggleVoronoi(visible);
    }
  }

  /**
   * 获取性能信息
   */
  getPerformanceInfo() {
    return this.sceneManager.getPerformanceInfo();
  }

  /**
   * 启用/禁用性能分析
   */
  enableProfiling(enabled = true) {
    this.profiler.setEnabled(enabled);
  }

  /**
   * 获取性能统计
   */
  getProfilerStats() {
    return this.profiler.getCurrentStats();
  }

  /**
   * 配置性能分析器
   * @param {Object} options - 配置选项
   * @param {number} options.fpsThreshold - FPS 阈值（低于此值才输出报告）
   * @param {boolean} options.alwaysLog - 是否总是输出报告
   * @param {number} options.logInterval - 报告输出间隔（毫秒）
   */
  configureProfiler(options = {}) {
    if (options.fpsThreshold !== undefined) {
      this.profiler.setFpsThreshold(options.fpsThreshold);
    }
    if (options.alwaysLog !== undefined) {
      this.profiler.setAlwaysLog(options.alwaysLog);
    }
    if (options.logInterval !== undefined) {
      this.profiler.setLogInterval(options.logInterval);
    }
  }

  /**
   * 切换性能模式
   * @param {string} mode - 'high-performance' | 'balanced' | 'high-quality'
   */
  setPerformanceMode(mode) {
    const modes = {
      'high-performance': {
        shadows: false,
        bloom: false,
        pixelRatio: 1,
      },
      balanced: {
        shadows: true,
        bloom: true,
        bloomStrength: 0.3,
        pixelRatio: 1.5,
      },
      'high-quality': {
        shadows: true,
        bloom: true,
        bloomStrength: 0.5,
        pixelRatio: 2,
      },
    };

    const config = modes[mode];
    if (!config) {
      console.error(`[Performance] 未知模式: ${mode}`);
      return;
    }

    console.log(`[Performance] 切换到 ${mode} 模式`);

    // 阴影
    if (this.renderer) {
      this.renderer.shadowMap.enabled = config.shadows;
      this.renderer.setPixelRatio(
        Math.min(config.pixelRatio, window.devicePixelRatio),
      );
    }

    // Bloom
    if (this.postProcessing && this.postProcessing.bloomPass) {
      this.postProcessing.bloomPass.enabled = config.bloom;
      if (config.bloom && config.bloomStrength) {
        this.postProcessing.updateBloom(config.bloomStrength);
      }
    }

    console.log('[Performance] 模式切换完成');
  }

  destroy() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    this.pathAnimationManager?.stop();
    this.statsManager?.dispose();
    this.sceneManager.destroy();
  }
}

export default new Renderer3D();
