/**
 * 渲染器绘制模块
 * 负责障碍物、图层、节点、边、路径等的绘制功能
 */

import * as PIXI from 'pixi.js';

export class RendererDrawing {
  constructor(config, transform) {
    this.config = config;
    this.transform = transform;
  }

  /**
   * 更新坐标转换参数
   * @param {Object} transform - 坐标转换参数
   */
  updateTransform(transform) {
    this.transform = transform;
    // 当缩放发生变化时，可以在这里进行额外处理
  }

  /**
   * 渲染障碍物
   * @param {Array} obstacles - 障碍物数组
   * @param {number} offsetX - X偏移
   * @param {number} offsetY - Y偏移
   * @param {number} cellSize - 单元格大小
   * @returns {PIXI.Container} 障碍物容器
   */
  renderObstacles(obstacles, offsetX, offsetY, cellSize) {
    const obstacleContainer = new PIXI.Container();
    obstacleContainer.name = 'obstacles';

    obstacles.forEach(obs => {
      const rect = new PIXI.Graphics();
      rect.beginFill(0xff0000, 0.35);
      rect.lineStyle(1, 0xff0000, 0.8);
      rect.drawRect(
        offsetX + obs.x * cellSize,
        offsetY + obs.y * cellSize,
        obs.w * cellSize,
        obs.h * cellSize
      );
      rect.endFill();
      obstacleContainer.addChild(rect);
    });

    return obstacleContainer;
  }

  /**
   * 创建图层容器
   * @param {Object} layer - 图层数据
   * @param {number} layerIndex - 图层索引
   * @param {number} offsetX - X偏移
   * @param {number} offsetY - Y偏移
   * @param {number} cellSize - 单元格大小
   * @returns {PIXI.Container} 图层容器
   */
  createLayerContainer(layer, layerIndex, offsetX, offsetY, cellSize) {
    const container = new PIXI.Container();
    container.name = `layer-${layerIndex}`;
    container.visible = false;

    const layerColor = this.config.layerColors[layerIndex % this.config.layerColors.length];

    // 针对可行网络层（centroid-free/portal/voronoi-skeleton），使用更醒目的青色样式
    const abstraction = layer?.metadata?.abstraction;
    const isNetwork = abstraction === 'centroid-free' || abstraction === 'portal' || abstraction === 'voronoi-skeleton';
    const edgeColor = isNetwork ? 0x22d3ee : this.config.edgeColor;
    const edgeAlpha = isNetwork ? 0.9 : this.config.edgeAlpha;
    const nodeColor = isNetwork ? 0x22d3ee : layerColor;
    const nodeAlpha = isNetwork ? 0.9 : this.config.nodeAlpha;
    const nodeRadius = isNetwork ? Math.max(2, this.config.nodeRadius - 1) : this.config.nodeRadius;

    // 绘制基础 Delaunay 覆盖层（灰色半透明），帮助理解可行点来源
    const overlay = layer.metadata && layer.metadata.overlayBase && Array.isArray(layer.metadata.overlayBase.edges)
      ? layer.metadata.overlayBase.edges
      : null;
    if (overlay && overlay.length) {
      const overlayGraphics = new PIXI.Graphics();
      overlayGraphics.lineStyle({ width: this.config.edgeWidth, color: 0x9ca3af, alpha: 0.25 });
      for (const e of overlay) {
        const x1 = offsetX + e.x1 * cellSize;
        const y1 = offsetY + e.y1 * cellSize;
        const x2 = offsetX + e.x2 * cellSize;
        const y2 = offsetY + e.y2 * cellSize;
        overlayGraphics.moveTo(x1, y1);
        overlayGraphics.lineTo(x2, y2);
      }
      container.addChild(overlayGraphics);
    }

    // 渲染边（先渲染边，这样节点会显示在上层）
    layer.edges.forEach(edge => {
      const fromNode = layer.nodes.find(n => n.id === edge.from);
      const toNode = layer.nodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) return;

      const line = new PIXI.Graphics();
      line.lineStyle({
        width: this.config.edgeWidth,
        color: edgeColor,
        alpha: edgeAlpha
      });

      const x1 = offsetX + fromNode.x * cellSize;
      const y1 = offsetY + fromNode.y * cellSize;
      const x2 = offsetX + toNode.x * cellSize;
      const y2 = offsetY + toNode.y * cellSize;

      line.moveTo(x1, y1);
      line.lineTo(x2, y2);

      container.addChild(line);
    });

    // 渲染节点
    layer.nodes.forEach(node => {
      const circle = new PIXI.Graphics();
      circle.beginFill(nodeColor, nodeAlpha);
      circle.drawCircle(
        offsetX + node.x * cellSize,
        offsetY + node.y * cellSize,
        nodeRadius
      );
      circle.endFill();

      container.addChild(circle);
    });

    return container;
  }

  /**
   * 绘制十字星光标
   * @param {PIXI.Graphics} graphics - Graphics 对象
   * @param {number} x - X 坐标（相对于主容器的坐标）
   * @param {number} y - Y 坐标（相对于主容器的坐标）
   */
  drawCrosshair(graphics, x, y) {
    // 使用固定大小，不受缩放影响
    const { crosshairColor, crosshairAlpha } = this.config.interaction;
    const crosshairSize = this.config.interaction.crosshairSize;
    
    graphics.clear();
    graphics.lineStyle(2, crosshairColor, crosshairAlpha);
    
    // 将十字星设置为相对于主容器的位置
    graphics.position.set(x, y);
    
    // 横线
    graphics.moveTo(-crosshairSize, 0);
    graphics.lineTo(crosshairSize, 0);
    
    // 竖线
    graphics.moveTo(0, -crosshairSize);
    graphics.lineTo(0, crosshairSize);
    
    graphics.visible = true;
  }

  /**
   * 绘制路径
   * @param {PIXI.Container} pathContainer - 路径容器
   * @param {Array} path - 路径节点数组
   * @param {boolean} isPreview - 是否为预览模式
   */
  drawPath(pathContainer, path, isPreview = false) {
    const len = path?.length || 0;
    
    // 预览模式下，如果少于2个节点（没有有效线段），避免清空，防止预览闪烁
    if (isPreview && len < 2) {
      return;
    }
    
    // 其他情况（含最终路径或有效预览）才更新绘制
    pathContainer.removeChildren();

    const { pathColor, pathWidth } = this.config.interaction;
    const alpha = isPreview ? 0.3 : 0.8;
    
    // 创建一个单一的图形对象来绘制整个路径
    const pathGraphics = new PIXI.Graphics();
    pathGraphics.lineStyle(pathWidth, pathColor, alpha);

    // 绘制路径线段
    for (let i = 0; i < path.length - 1; i++) {
      const node1 = path[i];
      const node2 = path[i + 1];
      
      const x1 = this.transform.offsetX + node1.x * this.transform.cellSize;
      const y1 = this.transform.offsetY + node1.y * this.transform.cellSize;
      const x2 = this.transform.offsetX + node2.x * this.transform.cellSize;
      const y2 = this.transform.offsetY + node2.y * this.transform.cellSize;

      // 如果是第一个点，移动到该点，否则画线
      if (i === 0) {
        pathGraphics.moveTo(x1, y1);
      }
      
      pathGraphics.lineTo(x2, y2);
    }

    pathContainer.addChild(pathGraphics);
    
  }

  /**
   * 绘制交互节点（起点、终点）
   * @param {PIXI.Container} container - 交互容器
   * @param {Object} startNode - 起点节点
   * @param {Object} endNode - 终点节点
   */
  drawInteractionNodes(container, startNode, endNode) {
    
    // 清除旧的节点标记
    container.children
      .filter(child => child.name && child.name.startsWith('node-marker'))
      .forEach(child => container.removeChild(child));

    const { startNodeColor, endNodeColor, nodeHighlightRadius } = this.config.interaction;
    
    // 计算标记半径（不受缩放影响）
    const radius = nodeHighlightRadius;

    // 绘制起点
    if (startNode) {
      const marker = new PIXI.Graphics();
      marker.name = 'node-marker-start';
      marker.beginFill(startNodeColor, 0.8);
      
      // 计算节点在画布上的坐标
      const x = this.transform.offsetX + startNode.x * this.transform.cellSize;
      const y = this.transform.offsetY + startNode.y * this.transform.cellSize;
      
      marker.drawCircle(0, 0, radius);
      marker.endFill();
      marker.position.set(x, y);
      container.addChild(marker);
    }

    // 绘制终点
    if (endNode) {
      const marker = new PIXI.Graphics();
      marker.name = 'node-marker-end';
      marker.beginFill(endNodeColor, 0.8);
      
      // 计算节点在画布上的坐标
      const x = this.transform.offsetX + endNode.x * this.transform.cellSize;
      const y = this.transform.offsetY + endNode.y * this.transform.cellSize;
      
      marker.drawCircle(0, 0, radius);
      marker.endFill();
      marker.position.set(x, y);
      container.addChild(marker);
    }
  }

  /**
   * 创建路径动画小球
   * @returns {PIXI.Graphics} 小球对象
   */
  createAnimationBall() {
    const ball = new PIXI.Graphics();
    ball.beginFill(0xffff00, 1);
    ball.drawCircle(0, 0, 5);
    ball.endFill();
    return ball;
  }

  /**
   * 计算动画位置
   * @param {Object} node1 - 起始节点
   * @param {Object} node2 - 结束节点
   * @param {number} progress - 进度 (0-1)
   * @returns {Object} 位置坐标 {x, y}
   */
  getAnimationPosition(node1, node2, progress) {
    const x1 = this.transform.offsetX + node1.x * this.transform.cellSize;
    const y1 = this.transform.offsetY + node1.y * this.transform.cellSize;
    const x2 = this.transform.offsetX + node2.x * this.transform.cellSize;
    const y2 = this.transform.offsetY + node2.y * this.transform.cellSize;

    return {
      x: x1 + (x2 - x1) * progress,
      y: y1 + (y2 - y1) * progress
    };
  }
}
