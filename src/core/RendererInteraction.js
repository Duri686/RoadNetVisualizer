/**
 * 渲染器交互模块
 * 负责用户交互、路径查找、动画等功能
 */
import { animatePath as runAnimation, cancelAnimationIfAny as cancelAnim } from './interaction/animation.js';
import {
  findAndDrawPath as pipelineFindAndDrawPath,
  redrawLastPath as pipelineRedrawLastPath,
  clearPath as pipelineClearPath,
  updatePathInfo as pipelineUpdatePathInfo,
  resetPathInfo as pipelineResetPathInfo,
} from './interaction/path-pipeline.js';
import {
  setupInteraction as eventsSetup,
  handlePointerMove as eventsHandleMove,
  handlePointerDown as eventsHandleDown,
} from './interaction/events.js';

export class RendererInteraction {
  constructor(config, transform, drawing) {
    this.config = config;
    this.transform = transform;
    this.drawing = drawing;

    // 交互状态
    this.state = {
      enabled: false,
      startNode: null,
      endNode: null,
      hoveredNode: null,
      path: null,
      isAnimating: false,
      lastPath: null,
      lastPathTotal: null,
      smoothMs: null,
    };

    // 交互图层引用
    this.container = null;
    this.crosshairGraphics = null;
    this.pathContainer = null;

    // 数据引用
    this.roadNetData = null;

    // 动画控制句柄
    this.animBall = null; // 当前动画小球
    this.animRAF = null;  // requestAnimationFrame 句柄
    this.autoClearTimer = null; // 旧版自动清理计时器（不再使用）
  }


  /**
   * 清空路径（图形与状态）
   */
  clearPath() {
    pipelineClearPath(this);
  }

  /**
   * 使用 lastPath 重新绘制路径（例如在刷新或重渲染后）
   */
  redrawLastPath() {
    pipelineRedrawLastPath(this);
  }

  /**
   * 更新坐标转换参数
   * @param {Object} transform - 坐标转换参数
   */
  updateTransform(transform) {
    this.transform = transform;
    this.drawing.updateTransform(transform);

    // 当缩放或平移发生变化时，可以在这里调整交互元素
    if (this.crosshairGraphics) {
      // 调整十字星大小以适应缩放
      const adjustedSize =
        this.config.interaction.crosshairSize / transform.scale;
      this.config.interaction._adjustedCrosshairSize = adjustedSize;
    }
  }

  /**
   * 设置导航图数据
   * @param {Object} roadNetData - 导航图数据
   */
  setRoadNetData(roadNetData) {
    this.roadNetData = roadNetData;
  }

  /**
   * 设置容器引用
   * @param {PIXI.Container} container - 交互容器
   * @param {PIXI.Graphics} crosshairGraphics - 十字星 Graphics
   * @param {PIXI.Container} pathContainer - 路径容器
   */
  setContainers(container, crosshairGraphics, pathContainer) {
    this.container = container;
    this.crosshairGraphics = crosshairGraphics;
    this.pathContainer = pathContainer;
  }

  /**
   * 初始化交互功能
   * @param {PIXI.Application} app - PIXI 应用实例
   * @param {Function} onPointerMove - 鼠标移动回调
   * @param {Function} onPointerDown - 鼠标点击回调
   */
  setup(app, onPointerMove, onPointerDown) {
    eventsSetup(this, app, onPointerMove, onPointerDown);
  }

  /**
   * 处理鼠标移动事件
   * @param {Object} event - 事件对象
   * @param {number} currentLayer - 当前显示的图层
   */
  handlePointerMove(event, currentLayer) {
    eventsHandleMove(this, event, currentLayer);
  }

  /**
   * 处理鼠标点击事件
   * @param {Object} event - 事件对象（如果提供）
   * @returns {boolean} 是否处理了点击事件
   */
  handlePointerDown(event) {
    return eventsHandleDown(this, event);
  }

  /**
   * 查找并绘制路径
   * @param {Object} startNode - 起点节点
   * @param {Object} endNode - 终点节点
   * @param {boolean} isPreview - 是否为预览模式
   */
  findAndDrawPath(startNode, endNode, isPreview = false) {
    pipelineFindAndDrawPath(this, startNode, endNode, isPreview);
  }

  /**
   * 更新界面上的路径信息
   * @param {Array} path 路径节点数组
   * @param {boolean} isPreview 是否为预览
   */
  updatePathInfo(path, isPreview) {
    pipelineUpdatePathInfo(this, path, isPreview);
  }

  /**
   * 重置路径信息面板
   */
  resetPathInfo() {
    pipelineResetPathInfo(this);
  }

  /**
   * 计算转折次数（简单角度变化统计）
   */
  _computeTurnsCount(path) {
    if (!path || path.length < 3) return 0;
    let turns = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const a = path[i - 1];
      const b = path[i];
      const c = path[i + 1];
      const v1x = b.x - a.x;
      const v1y = b.y - a.y;
      const v2x = c.x - b.x;
      const v2y = c.y - b.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const nx1 = v1x / len1, ny1 = v1y / len1;
      const nx2 = v2x / len2, ny2 = v2y / len2;
      const dot = nx1 * nx2 + ny1 * ny2;
      // cos(theta) 接近 ±1 认为直线，不计转折；阈值可调整
      if (Math.abs(dot) < 0.98) turns++;
    }
    return turns;
  }

  /**
   * 绘制交互节点（起点、终点）
   */
  drawInteractionNodes() {
    if (!this.container || !this.container.parent) {
      console.error(
        '[Debug] Interaction container is not valid or not added to a parent.',
      );
      return;
    }

    this.drawing.drawInteractionNodes(
      this.container,
      this.state.startNode,
      this.state.endNode,
    );

    // 确保交互层在绘制后是可见的
    this.container.visible = true;
  }

  /**
   * 路径动画
   * @param {Array} path - 路径节点数组
   */
  animatePath(path) {
    runAnimation(this, path);
  }

  /**
   * 清除交互图形
   */
  clearInteractionGraphics() {
    if (this.pathContainer) {
      const removed = this.pathContainer.removeChildren();
      if (Array.isArray(removed)) {
        removed.forEach((ch) => { try { ch.destroy && ch.destroy({ children: true }); } catch (_) {} });
      }
    }
    if (this.container) {
      const markers = this.container.children
        .filter((child) => child.name && child.name.startsWith('node-marker'));
      markers.forEach((child) => { try { this.container.removeChild(child); child.destroy && child.destroy({ children: true }); } catch (_) {} });
    }
    if (this.crosshairGraphics) {
      this.crosshairGraphics.clear();
      this.crosshairGraphics.visible = false;
    }
  }

  /**
   * 取消当前路径动画（若有）
   */
  cancelAnimationIfAny() {
    cancelAnim(this);
  }

  /**
   * 禁用交互并清理
   */
  disable() {
    this.clearInteractionGraphics();
    this.state.startNode = null;
    this.state.endNode = null;
    this.state.hoveredNode = null;
  }

  /**
   * 启用交互
   */
  enable() {
    this.state.enabled = true;
  }

  /**
   * 获取当前状态
   * @returns {Object} 交互状态
   */
  getState() {
    return { ...this.state };
  }
}
