/**
 * 渲染器交互模块
 * 负责用户交互、路径查找、动画等功能
 */

import * as PIXI from 'pixi.js';
import { Delaunay } from 'd3-delaunay';
import { findPathAStar } from '../utils/pathfinding.js';

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
   * 计算路径总长度
   */
  _calcTotalLength(path) {
    if (!path || path.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }

  /**
   * 清空路径（图形与状态）
   */
  clearPath() {
    this.cancelAnimationIfAny();
    this.clearInteractionGraphics();
    this.state.startNode = null;
    this.state.endNode = null;
    this.state.path = null;
    this.resetPathInfo();
  }

  /**
   * 使用 lastPath 重新绘制路径（例如在刷新或重渲染后）
   */
  redrawLastPath() {
    if (!this.state.lastPath || !this.pathContainer) return;
    this.drawing.drawPath(this.pathContainer, this.state.lastPath, false);
    this.updatePathInfo(this.state.lastPath, false);
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
    if (!app || !this.roadNetData) {
      console.warn('⚠️ Cannot setup interaction: app or roadNetData missing');
      return;
    }

    console.log('🎮 Setting up interaction...');

    const layer0 = this.roadNetData.layers[0];

    // 重建 Delaunay 对象（因为通过 postMessage 传输时方法丢失）
    if (layer0 && layer0.nodes && layer0.nodes.length > 0) {
      const points = layer0.nodes.map((node) => [node.x, node.y]);
      layer0.delaunay = Delaunay.from(points);
      console.log('✅ Delaunay object reconstructed for Layer 0');
    } else {
      console.warn('⚠️ Cannot reconstruct Delaunay: no nodes in Layer 0');
    }

    // 启用画布交互
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    console.log('✅ Stage interaction enabled');

    // 先移除旧的监听器，避免重复绑定导致事件触发两次
    app.stage.removeAllListeners('pointermove');
    app.stage.removeAllListeners('pointerdown');

    // 绑定事件
    app.stage.on('pointermove', onPointerMove);
    app.stage.on('pointerdown', onPointerDown);
    console.log('✅ Events (re)bound');

    this.state.enabled = true;
    console.log('✅ Interaction enabled for Layer 0');
  }

  /**
   * 处理鼠标移动事件
   * @param {Object} event - 事件对象
   * @param {number} currentLayer - 当前显示的图层
   */
  handlePointerMove(event, currentLayer) {
    if (!this.state.enabled || currentLayer !== 0) {
      return;
    }

    // 容器尚未就绪（例如全屏切换触发的重绘过程中）
    if (!this.container || !this.container.parent) {
      return;
    }

    const layer = this.roadNetData.layers[0];
    if (!layer || !layer.delaunay) {
      console.warn('⚠️ Layer 0 or delaunay missing');
      return;
    }

    // 获取鼠标在画布上的原始坐标
    const mousePos = event.global;
    // 仅在鼠标设备且非移动端时显示十字星
    const pointerType = event && event.data && event.data.pointerType ? event.data.pointerType : 'mouse';
    const isMobileView = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
    const allowCrosshair = pointerType === 'mouse' && !isMobileView;

    // 获取鼠标相对于交互容器的坐标（已考虑缩放和平移）
    const localPos = event.data.getLocalPosition(this.container);

    // 计算网格坐标（用于 Delaunay 查找）
    const gridX =
      (localPos.x - this.transform.offsetX) / this.transform.cellSize;
    const gridY =
      (localPos.y - this.transform.offsetY) / this.transform.cellSize;

    // 使用 Delaunay.find() 查找最近的点
    const nearestIndex = layer.delaunay.find(gridX, gridY);

    if (
      nearestIndex !== undefined &&
      nearestIndex >= 0 &&
      nearestIndex < layer.nodes.length
    ) {
      const nearestNode = layer.nodes[nearestIndex];
      this.state.hoveredNode = nearestNode;

      // 绘制十字星（仅桌面鼠标设备），移动端隐藏
      if (this.crosshairGraphics) {
        if (allowCrosshair) {
          this.drawing.drawCrosshair(
            this.crosshairGraphics,
            localPos.x,
            localPos.y,
          );
        } else {
          this.crosshairGraphics.visible = false;
        }
      }

      // 如果已选择起点且尚未选择终点，实时显示预览路径
      if (
        this.state.startNode &&
        !this.state.endNode &&
        !this.state.isAnimating
      ) {
        this.findAndDrawPath(this.state.startNode, nearestNode, true);
      }
    } else {
      this.state.hoveredNode = null;
      if (this.crosshairGraphics) this.crosshairGraphics.visible = false;
    }
  }

  /**
   * 处理鼠标点击事件
   * @param {Object} event - 事件对象（如果提供）
   * @returns {boolean} 是否处理了点击事件
   */
  handlePointerDown(event) {
    // 点击事件（移除冗余日志）

    // 切换点位时，若存在正在进行的动画，则立即停止并移除小球
    this.cancelAnimationIfAny();
    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer);
      this.autoClearTimer = null;
    }

    // 如果提供了事件对象，先更新悬停节点
    if (event && this.roadNetData) {
      const layer = this.roadNetData.layers[0];
      if (layer && layer.delaunay) {
        // 获取鼠标相对于交互容器的坐标
        const localPos = event.data.getLocalPosition(this.container);

        // 计算网格坐标
        const gridX =
          (localPos.x - this.transform.offsetX) / this.transform.cellSize;
        const gridY =
          (localPos.y - this.transform.offsetY) / this.transform.cellSize;

        // 查找最近的点
        const nearestIndex = layer.delaunay.find(gridX, gridY);

        if (
          nearestIndex !== undefined &&
          nearestIndex >= 0 &&
          nearestIndex < layer.nodes.length
        ) {
          this.state.hoveredNode = layer.nodes[nearestIndex];
        }
      }
    }

    if (!this.state.hoveredNode) {
      console.log('❌ No hovered node');
      return false;
    }

    const clickedNode = this.state.hoveredNode;
    // 选中节点（移除冗余日志）

    // 第一次点击：设置起点
    if (!this.state.startNode) {
      this.state.startNode = clickedNode;
      this.state.endNode = null;
      this.state.path = null;
      // 设置起点（移除冗余日志）
      // 开启新一次路径规划前，清空旧路径图形，避免叠加
      if (this.pathContainer) {
        this.pathContainer.removeChildren();
      }
      this.drawInteractionNodes();
      // 绘制交互节点结束
      return true;
    }
    // 第二次点击：设置终点并计算路径
    else {
      this.state.endNode = clickedNode;
      // 设置终点（移除冗余日志）
      this.findAndDrawPath(this.state.startNode, clickedNode, false);

      // 不再使用固定 5 秒清理，保持路径可见直到用户开始新一次选择。
      // 为了便于下一次选择，立即将起终点置空（保留已绘制路径与动画进行）。
      this.state.startNode = null;
      this.state.endNode = null;

      return true;
    }
  }

  /**
   * 查找并绘制路径
   * @param {Object} startNode - 起点节点
   * @param {Object} endNode - 终点节点
   * @param {boolean} isPreview - 是否为预览模式
   */
  findAndDrawPath(startNode, endNode, isPreview = false) {
    const layer = this.roadNetData.layers[0];
    if (!layer) return;

    // 使用 A* 算法查找路径
    const path = findPathAStar(layer, startNode, endNode);

    if (path && path.length > 0) {
      // 移除高频路径日志（尤其是预览模式）
      this.state.path = path;
      this.drawing.drawPath(this.pathContainer, path, isPreview);
      // 输出路径信息到面板
      this.updatePathInfo(path, isPreview);

      if (!isPreview) {
        console.log(`🛤️ Path found: ${path.length} nodes`);
        this.drawInteractionNodes();
        this.animatePath(path);

        // 保存为“上次路径”
        const total = this._calcTotalLength(path);
        this.state.lastPath = path;
        this.state.lastPathTotal = total;
      }
    }
  }

  /**
   * 更新界面上的路径信息
   * @param {Array} path 路径节点数组
   * @param {boolean} isPreview 是否为预览
   */
  updatePathInfo(path, isPreview) {
    const panel = document.getElementById('path-info');
    if (!panel) return;

    // 构造节点列表与段信息
    const total = this._calcTotalLength(path);
    const turns = this._computeTurnsCount(path);

    const title = isPreview ? '当前路径（预览）' : '当前路径（最终）';
    const last = this.state.lastPathTotal;
    const compare =
      !isPreview && typeof last === 'number'
        ? `<div style="margin-top:6px;color:var(--text-secondary)">上次：<strong>${last.toFixed(
            2,
          )} m</strong> ｜ 差异：<strong>${(total - last).toFixed(
            2,
          )} m</strong></div>`
        : '';
    panel.innerHTML = `
      <div><strong>${title}</strong>：节点数 ${path.length}；总距离 <strong>${total.toFixed(
      2,
    )} m</strong></div>
      ${compare}
    `;
    // 同步上方统计栅格
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setText('path-status', isPreview ? '预览' : '已计算');
    setText('path-length', `${total.toFixed(2)} m`);
    setText('path-nodes', String(path.length));
    setText('path-turns', String(turns));
  }

  /**
   * 重置路径信息面板
   */
  resetPathInfo() {
    const panel = document.getElementById('path-info');
    if (panel) panel.innerHTML = '<div><strong>当前路径</strong>：无</div>';
    // 重置统计栅格
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setText('path-status', '未选择');
    setText('path-length', '--');
    setText('path-nodes', '--');
    setText('path-turns', '--');
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
    if (this.state.isAnimating) return;

    this.state.isAnimating = true;

    // 创建移动的小球
    const ball = this.drawing.createAnimationBall();
    this.animBall = ball;
    this.container.addChild(ball);

    let currentIndex = 0;
    const speed = 0.05; // 动画速度
    let progress = 0;

    const animate = () => {
      if (!this.state.isAnimating) return; // 已被取消
      if (currentIndex >= path.length - 1) {
        if (this.animBall && this.container) {
          this.container.removeChild(this.animBall);
        }
        this.animBall = null;
        this.state.isAnimating = false;
        this.animRAF = null;
        return;
      }

      const node1 = path[currentIndex];
      const node2 = path[currentIndex + 1];

      const pos = this.drawing.getAnimationPosition(node1, node2, progress);
      ball.x = pos.x;
      ball.y = pos.y;

      progress += speed;

      if (progress >= 1) {
        progress = 0;
        currentIndex++;
      }

      this.animRAF = requestAnimationFrame(animate);
    };

    this.animRAF = requestAnimationFrame(animate);
  }

  /**
   * 清除交互图形
   */
  clearInteractionGraphics() {
    if (this.pathContainer) {
      this.pathContainer.removeChildren();
    }
    if (this.container) {
      this.container.children
        .filter((child) => child.name && child.name.startsWith('node-marker'))
        .forEach((child) => this.container.removeChild(child));
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
    if (this.animRAF) {
      cancelAnimationFrame(this.animRAF);
      this.animRAF = null;
    }
    if (this.animBall && this.container) {
      this.container.removeChild(this.animBall);
      this.animBall = null;
    }
    this.state.isAnimating = false;
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
