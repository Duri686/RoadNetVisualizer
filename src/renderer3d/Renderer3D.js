/**
 * 3D渲染器主入口
 * 整合所有模块，提供统一接口
 */

import * as THREE from 'three';
import { Renderer3DConfig } from './config/Renderer3DConfig.js';
import { SceneManager } from './core/SceneManager.js';
import { LightingSystem } from './systems/LightingSystem.js';
import { PostProcessingManager } from './managers/PostProcessingManager.js';
import { AnimationController } from './managers/AnimationController.js';
import { InteractionManager } from './managers/InteractionManager.js';
import { StatsManager } from './managers/StatsManager.js';
import { PathAnimationManager } from './managers/PathAnimationManager.js';
import { RoadNetRenderer } from './renderers/RoadNetRenderer.js';
import { PathRenderer } from './renderers/PathRenderer.js';
import { MarkerRenderer } from './renderers/MarkerRenderer.js';

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

    // 兼容接口
    this.interaction = {
      state: { startNode: null, endNode: null, lastPath: null },
      clearPath: () => this.clearPath(),
      redrawLastPath: () => this.redrawLastPath(),
      cancelAnimationIfAny: () => this.pathAnimationManager?.stop(),
      clearInteractionGraphics: () => this.clearInteractionGraphics(),
      resetPathInfo: () => this.resetPathInfo(),
      animatePath: (path) => this.animatePath(path)
    };

    // 配置（用于兼容）
    this.config = { layerHeight: Renderer3DConfig.layerHeight };
  }

  /**
   * 初始化
   */
  async init(container, options = {}) {
    try {
      this.container = container;

      // 初始化场景
      const { scene, camera, renderer, controls } = this.sceneManager.init(container, options);
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
      this.pathAnimationManager = new PathAnimationManager(scene);

      // 初始化渲染器
      this.roadNetRenderer = new RoadNetRenderer(scene);
      this.pathRenderer = new PathRenderer(scene);
      this.markerRenderer = new MarkerRenderer(scene, this.animationController);

      // 初始化性能监控
      this.statsManager = new StatsManager(container);
      this.stats = this.statsManager.init();

      // 绑定事件
      this.bindEvents();

      // 开始动画循环
      this._animate();

      console.log('✅ 模块化 Three.js 渲染器初始化成功');
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
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
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

    // 调整相机位置
    const maxDim = Math.max(data.metadata.width, data.metadata.height);
    this.sceneManager.setCameraPosition(0, maxDim * 0.6, maxDim * 0.6);
    this.sceneManager.setControlsTarget(0, 0, 0);

    console.log('✅ 3D道路网络渲染完成');
  }

  /**
   * 动画循环
   */
  _animate() {
    this._animationId = requestAnimationFrame(this._animate);
    
    this.statsManager.begin();
    
    if (this.controls) this.controls.update();
    
    const time = performance.now() * 0.001;
    this.animationController.update(performance.now());

    this.postProcessing.render();
    
    this.statsManager.end();
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
    this.interactionManager.updatePointer(event, this.renderer.domElement);
  }

  /**
   * 点击事件
   */
  onClick(event) {
    if (!this.roadNetData) return;

    this.interactionManager.updatePointer(event, this.renderer.domElement);
    
    const { node, distance } = this.interactionManager.findNearestNode(
      this.roadNetData,
      Renderer3DConfig.layerHeight,
      this.currentLayer
    );

    if (node) {
      console.log('✅ 选中节点:', node, '距离:', distance.toFixed(2));
      const result = this.interactionManager.handleNodeClick(node);
      
      // 更新状态
      this.interaction.state.startNode = this.interactionManager.state.startNode;
      this.interaction.state.endNode = this.interactionManager.state.endNode;
      
      // 更新标记
      this.updateInteractionMarkers();

      // 触发路径请求
      if (result.type === 'end') {
        window.dispatchEvent(new CustomEvent('renderer-path-request', {
          detail: { start: result.start, end: result.node }
        }));
      } else if (result.type === 'reset') {
        this.clearPath();
      }
    }
  }

  /**
   * 更新交互标记
   */
  updateInteractionMarkers() {
    if (!this.roadNetData) return;

    const centerX = (this.roadNetData.metadata.width || 100) / 2;
    const centerY = (this.roadNetData.metadata.height || 100) / 2;

    this.markerRenderer.update(
      this.interactionManager.state.startNode,
      this.interactionManager.state.endNode,
      Renderer3DConfig.layerHeight,
      centerX,
      centerY
    );
  }

  /**
   * 绘制路径
   */
  drawPath(path) {
    this.clearPath();
    if (!path || path.length === 0) return;

    this.interaction.state.lastPath = path;

    const centerX = (this.roadNetData.metadata.width || 100) / 2;
    const centerY = (this.roadNetData.metadata.height || 100) / 2;

    this.pathRenderer.drawPath(path, Renderer3DConfig.layerHeight, centerX, centerY);
    this.animatePath(path);
  }

  /**
   * 动画化路径
   */
  animatePath(path) {
    const centerX = (this.roadNetData.metadata.width || 100) / 2;
    const centerY = (this.roadNetData.metadata.height || 100) / 2;

    this.pathAnimationManager.start(
      path,
      Renderer3DConfig.layerHeight,
      centerX,
      centerY,
      this.pathRenderer.pathShader
    );
  }

  /**
   * 清除路径
   */
  clearPath() {
    this.pathRenderer.clear();
    this.pathAnimationManager.stop();
  }

  /**
   * 重绘最后的路径
   */
  redrawLastPath() {
    if (this.interaction.state.lastPath) {
      this.drawPath(this.interaction.state.lastPath);
    }
  }

  /**
   * 清除交互图形
   */
  clearInteractionGraphics() {
    this.clearPath();
    this.interactionManager.clear();
    this.interaction.state.startNode = null;
    this.interaction.state.endNode = null;
    this.updateInteractionMarkers();
  }

  /**
   * 重置路径信息
   */
  resetPathInfo() {
    this.interactionManager.clearPath();
    this.interaction.state.lastPath = null;
  }

  // ==================== 兼容接口 ====================

  resize() { this.onWindowResize(); }
  
  clearCanvas() {
    this.sceneManager.clear();
    this.roadNetData = null;
  }

  zoomIn() {
    if (this.camera) {
      this.camera.position.multiplyScalar(0.8);
      this.controls.update();
    }
  }

  zoomOut() {
    if (this.camera) {
      this.camera.position.multiplyScalar(1.2);
      this.controls.update();
    }
  }

  resetView() {
    this.sceneManager.setCameraPosition(100, 100, 100);
    this.sceneManager.setControlsTarget(0, 0, 0);
  }

  getViewportRect() {
    if (!this.camera || !this.roadNetData) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const aspect = this.camera.aspect;
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = this.camera.position.length();
    const target = this.controls.target;
    const height = 2 * Math.tan(fov / 2) * distance;
    const width = height * aspect;

    return {
      x: target.x - width / 2,
      y: target.z - height / 2,
      width,
      height
    };
  }

  centerOn(worldX, worldY) {
    const centerX = (this.roadNetData?.metadata.width || 100) / 2;
    const centerY = (this.roadNetData?.metadata.height || 100) / 2;
    this.sceneManager.setControlsTarget(worldX - centerX, 0, worldY - centerY);
    window.dispatchEvent(new CustomEvent('renderer-viewport-changed'));
  }

  showLayer(index) {
    this.currentLayer = index;
    if (!this.scene || !this.roadNetData) return;

    this.scene.children.forEach(child => {
      if (child.userData && typeof child.userData.layerIndex === 'number') {
        child.visible = index === null || child.userData.layerIndex === index;
      }
    });
  }

  setFpsVisible() {}

  destroy() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    this.pathAnimationManager?.stop();
    this.statsManager?.dispose();
    this.sceneManager.destroy();
  }
}

export default new Renderer3D();
