/**
 * 渲染器绘制模块
 * 负责障碍物、图层、节点、边、路径等的绘制功能
 */

import * as PIXI from 'pixi.js';

export class RendererDrawing {
  constructor(config, transform) {
    this.config = config;
    this.transform = transform;
    // 共享位图字体（仅创建一次）
    this._labelBitmapFontName = 'ObstacleLabel-Bitmap';
    this._labelBitmapBaseSize = 16; // 基础字号，实际通过 scale 调整
    this._labelBitmapReady = false;
  }


  /**
   * 基于当前缩放计算虚线 dash/gap（保持屏幕视觉稳定）
   * 目标：在屏幕上约等于 8px/6px，按 1/scale 线性缩放并限制范围
   */
  computeDashGapByScale(scale) {
    const s = Math.max(0.1, Math.min(8, scale || 1));
    const dash = Math.max(2, Math.min(24, Math.round(8 / s)));
    const gap = Math.max(2, Math.min(20, Math.round(6 / s)));
    return { dash, gap };
  }

  /**
   * 重建基础三角化（虚线）图形
   */
  rebuildOverlayBase(overlayContainer, edgesOrPacked, offsetX, offsetY, cellSize) {
    if (!overlayContainer || !edgesOrPacked) return;
    overlayContainer.removeChildren();
    const g = new PIXI.Graphics();
    g.name = 'overlay-base-lines';
    g.lineStyle({
      width: Math.max(1, this.config.edgeWidth - 0.5),
      color: 0x9ca3af,
      alpha: 0.35,
    });
    const { dash, gap } = this.computeDashGapByScale(this.transform?.scale || 1);
    // 支持两种输入：数组[{x1,y1,x2,y2}] 或 Float32Array [x1,y1,x2,y2]*N
    if (Array.isArray(edgesOrPacked)) {
      for (const e of edgesOrPacked) {
        const x1 = offsetX + e.x1 * cellSize;
        const y1 = offsetY + e.y1 * cellSize;
        const x2 = offsetX + e.x2 * cellSize;
        const y2 = offsetY + e.y2 * cellSize;
        this.drawDashedLine(g, x1, y1, x2, y2, dash, gap);
      }
    } else if (edgesOrPacked instanceof Float32Array) {
      for (let i = 0; i + 3 < edgesOrPacked.length; i += 4) {
        const x1 = offsetX + edgesOrPacked[i] * cellSize;
        const y1 = offsetY + edgesOrPacked[i + 1] * cellSize;
        const x2 = offsetX + edgesOrPacked[i + 2] * cellSize;
        const y2 = offsetY + edgesOrPacked[i + 3] * cellSize;
        this.drawDashedLine(g, x1, y1, x2, y2, dash, gap);
      }
    }
    overlayContainer.addChild(g);
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
   * 绘制虚线段
   * @param {PIXI.Graphics} g - Graphics 对象
   * @param {number} x1 起点X
   * @param {number} y1 起点Y
   * @param {number} x2 终点X
   * @param {number} y2 终点Y
   * @param {number} dashLen 虚线段长度
   * @param {number} gapLen 间隔长度
   */
  drawDashedLine(g, x1, y1, x2, y2, dashLen = 8, gapLen = 6) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;
    let dist = 0;
    let draw = true;
    while (dist < len) {
      const seg = draw ? dashLen : gapLen;
      const nx1 = x1 + ux * dist;
      const ny1 = y1 + uy * dist;
      const ndist = Math.min(dist + seg, len);
      const nx2 = x1 + ux * ndist;
      const ny2 = y1 + uy * ndist;
      if (draw) {
        g.moveTo(nx1, ny1);
        g.lineTo(nx2, ny2);
      }
      dist = ndist;
      draw = !draw;
    }
  }
  
  /**
   * 渲染障碍物
   * @param {Array} obstacles - 障碍物数组
   * @param {number} offsetX - X偏移
   * @param {number} offsetY - Y偏移
   * @param {number} cellSize - 单元格大小
   * @returns {PIXI.Container} 障碍物容器
   */
  renderObstacles(obstacles, offsetX, offsetY, cellSize, cullRect) {
    const obstacleContainer = new PIXI.Container();
    obstacleContainer.name = 'obstacles';

    const needCull = !!(cullRect && typeof cullRect.x === 'number');
    // 标签 LOD：缩放*cellSize 小于阈值不绘制标签，减少 draw calls
    const scale = this.transform?.scale || 1;
    const labelCfg = (this.config && this.config.labels) || {};
    const labelsEnabled = labelCfg.enabled !== false;
    const minPx = typeof labelCfg.minPixelForLabel === 'number' ? labelCfg.minPixelForLabel : 8;
    const showLabel = labelsEnabled && (cellSize * scale) >= minPx;
    const wantBitmap = !!(labelCfg.useBitmapText && PIXI.BitmapText && PIXI.BitmapFont);
    if (showLabel && wantBitmap && !this._labelBitmapReady) {
      try {
        // 动态生成位图字体（一次），减少文本渲染成本
        PIXI.BitmapFont.from(this._labelBitmapFontName, {
          fontFamily: 'Arial',
          fontSize: this._labelBitmapBaseSize,
          fill: 0xffffff,
        });
        this._labelBitmapReady = true;
      } catch (_) { /* ignore */ }
    }

    // 合批矩形至单一 Graphics
    const g = new PIXI.Graphics();
    g.beginFill(0xdc2626, 0.5);
    g.lineStyle(1, 0xdc2626, 0.85);
    // 先把底层矩形 Graphics 放入容器，确保后续标签在其之上
    obstacleContainer.addChild(g);

    obstacles.forEach((obs, i) => {
      // 视窗裁剪（基础版）：像素坐标相交才绘制
      if (needCull) {
        const px = offsetX + obs.x * cellSize;
        const py = offsetY + obs.y * cellSize;
        const pw = obs.w * cellSize;
        const ph = obs.h * cellSize;
        const rx = cullRect.x, ry = cullRect.y, rw = cullRect.w, rh = cullRect.h;
        if (px + pw < rx || rx + rw < px || py + ph < ry || ry + rh < py) {
          return; // 不相交则跳过
        }
      }
      g.drawRect(
        offsetX + obs.x * cellSize,
        offsetY + obs.y * cellSize,
        obs.w * cellSize,
        obs.h * cellSize
      );
      if (showLabel) {
        const cx = offsetX + (obs.x + obs.w / 2) * cellSize;
        const cy = offsetY + (obs.y + obs.h / 2) * cellSize;
        const desiredPx = Math.max(10, Math.floor(cellSize * 0.8));
        if (wantBitmap && this._labelBitmapReady) {
          const bt = new PIXI.BitmapText(String(i + 1), { fontName: this._labelBitmapFontName, tint: 0xffffff });
          const k = desiredPx / this._labelBitmapBaseSize;
          bt.scale.set(k);
          // 居中（BitmapText 无 anchor，用边界×scale 居中）
          const b = bt.getLocalBounds();
          bt.position.set(cx - (b.width * k) / 2, cy - (b.height * k) / 2);
          obstacleContainer.addChild(bt);
        } else {
          const label = new PIXI.Text(String(i + 1), { fontSize: desiredPx, fill: 0xffffff });
          label.anchor.set(0.5);
          label.position.set(cx, cy);
          obstacleContainer.addChild(label);
        }
      }
    });
    g.endFill();

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

    // 颜色常量（与图例对齐）
    const COLORS = {
      networkEdge: 0x3b82f6,   // 蓝色边
      networkNode: 0x3b82f6,   // 蓝色节点
      voronoi: 0x06b6d4,       // 青蓝色线
      baseOverlay: 0x9ca3af,   // 灰色
    };

    // 针对不同抽象层类型，拆分子容器：overlay-base / network-edges / network-nodes / voronoi-skeleton
    const abstractionRaw = layer?.metadata?.abstraction;
    const abstraction = abstractionRaw ? String(abstractionRaw).toLowerCase() : '';
    const isVoronoi = abstraction.includes('voronoi');
    const isNetwork = !isVoronoi; // 其余层按网络处理（centroid-free/portal 等）
    const edgeColor = isVoronoi ? COLORS.voronoi : COLORS.networkEdge;
    const edgeAlpha = 0.95;
    const nodeColor = COLORS.networkNode;
    const nodeAlpha = 0.95;
    const nodeRadius = 2.5;

    const overlayContainer = new PIXI.Container();
    overlayContainer.name = 'overlay-base';
    const networkEdgesContainer = new PIXI.Container();
    networkEdgesContainer.name = 'network-edges';
    const networkNodesContainer = new PIXI.Container();
    networkNodesContainer.name = 'network-nodes';
    const voronoiContainer = new PIXI.Container();
    voronoiContainer.name = 'voronoi-skeleton';

    // 绘制基础 Delaunay 覆盖层（灰色半透明），帮助理解可行点来源
    // 同时支持 edges（数组）与 edgesPacked（Float32Array）
    const overlayEdges = layer.metadata && layer.metadata.overlayBase && Array.isArray(layer.metadata.overlayBase.edges)
      ? layer.metadata.overlayBase.edges
      : null;
    const overlayPacked = layer.metadata && layer.metadata.overlayBase && layer.metadata.overlayBase.edgesPacked instanceof Float32Array
      ? layer.metadata.overlayBase.edgesPacked
      : null;
    const overlayAny = overlayPacked && overlayPacked.length ? overlayPacked : overlayEdges;
    if (overlayAny && (Array.isArray(overlayAny) ? overlayAny.length : overlayAny.length > 0)) {
      this.rebuildOverlayBase(overlayContainer, overlayAny, offsetX, offsetY, cellSize);
    }

    // 渲染边：优先使用 edgesPacked，失败回退到对象数组
    const preferPacked = !!(this.config && this.config.performance && this.config.performance.usePackedEdges !== false);
    const hasPacked = layer && layer.edgesPacked instanceof Float32Array && layer.edgesPacked.length > 0;
    let usedPacked = false;
    const tE0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (preferPacked && hasPacked) {
      try {
        const g = this.renderEdgesPacked(layer.edgesPacked, offsetX, offsetY, cellSize, {
          width: isVoronoi ? Math.max(1.5, this.config.edgeWidth) : this.config.edgeWidth,
          color: edgeColor,
          alpha: edgeAlpha,
        });
        if (g) {
          usedPacked = true;
          if (isVoronoi) { voronoiContainer.addChild(g); } else { networkEdgesContainer.addChild(g); }
        }
      } catch (_) {
        usedPacked = false;
      }
    }
    if (!usedPacked && Array.isArray(layer.edges) && layer.edges.length) {
      const edgeGraphics = new PIXI.Graphics();
      edgeGraphics.lineStyle({
        width: isVoronoi ? Math.max(1.5, this.config.edgeWidth) : this.config.edgeWidth,
        color: edgeColor,
        alpha: edgeAlpha
      });
      for (let i = 0; i < layer.edges.length; i++) {
        const edge = layer.edges[i];
        const fromNode = layer.nodes.find(n => n.id === edge.from);
        const toNode = layer.nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) continue;
        const x1 = offsetX + fromNode.x * cellSize;
        const y1 = offsetY + fromNode.y * cellSize;
        const x2 = offsetX + toNode.x * cellSize;
        const y2 = offsetY + toNode.y * cellSize;
        edgeGraphics.moveTo(x1, y1);
        edgeGraphics.lineTo(x2, y2);
      }
      if (isVoronoi) { voronoiContainer.addChild(edgeGraphics); } else { networkEdgesContainer.addChild(edgeGraphics); }
    }
    const tE1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      const edgeCount = usedPacked ? Math.floor(layer.edgesPacked.length / 4) : (Array.isArray(layer.edges) ? layer.edges.length : 0);
      const usedMs = Math.max(0, Math.round(tE1 - tE0));
      console.log(`[Render] edgesPacked used=${usedPacked} | edges=${edgeCount} | drawMs=${usedMs}`);
    } catch (_) {}

    // 渲染节点：优先使用 nodesPacked，失败回退到对象数组
    const preferNodesPacked = !!(this.config && this.config.performance && this.config.performance.usePackedNodes !== false);
    const hasNodesPacked = layer && layer.nodesPacked instanceof Float32Array && layer.nodesPacked.length > 0;
    let usedNodesPacked = false;
    const tN0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (preferNodesPacked && hasNodesPacked) {
      try {
        const g = this.renderNodesPacked(layer.nodesPacked, offsetX, offsetY, cellSize, {
          color: nodeColor, alpha: nodeAlpha, radius: nodeRadius,
        });
        if (g) { usedNodesPacked = true; networkNodesContainer.addChild(g); }
      } catch (_) { usedNodesPacked = false; }
    }
    if (!usedNodesPacked && Array.isArray(layer.nodes) && layer.nodes.length) {
      const nodesG = new PIXI.Graphics();
      nodesG.beginFill(nodeColor, nodeAlpha);
      for (let i = 0; i < layer.nodes.length; i++) {
        const node = layer.nodes[i];
        nodesG.drawCircle(
          offsetX + node.x * cellSize,
          offsetY + node.y * cellSize,
          nodeRadius
        );
      }
      nodesG.endFill();
      networkNodesContainer.addChild(nodesG);
    }
    const tN1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      const nCount = usedNodesPacked ? Math.floor(layer.nodesPacked.length / 2) : (Array.isArray(layer.nodes) ? layer.nodes.length : 0);
      const usedMs = Math.max(0, Math.round(tN1 - tN0));
      console.log(`[Render] nodesPacked used=${usedNodesPacked} | nodes=${nCount} | drawMs=${usedMs}`);
    } catch (_) {}

    // 组装分组容器
    container.addChild(overlayContainer);
    container.addChild(networkEdgesContainer);
    container.addChild(networkNodesContainer);
    container.addChild(voronoiContainer);

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

// 优化：使用 Float32Array 的打包边进行合批绘制
RendererDrawing.prototype.renderEdgesPacked = function(edgesPacked, offsetX, offsetY, cellSize, style) {
  if (!(edgesPacked instanceof Float32Array) || edgesPacked.length < 4) return null;
  const g = new PIXI.Graphics();
  const width = style && typeof style.width === 'number' ? style.width : this.config.edgeWidth;
  const color = style && typeof style.color === 'number' ? style.color : (this.config.edgeColor || 0xffffff);
  const alpha = style && typeof style.alpha === 'number' ? style.alpha : (this.config.edgeAlpha || 1);
  g.lineStyle({ width, color, alpha });
  for (let i = 0; i + 3 < edgesPacked.length; i += 4) {
    const x1 = offsetX + edgesPacked[i] * cellSize;
    const y1 = offsetY + edgesPacked[i + 1] * cellSize;
    const x2 = offsetX + edgesPacked[i + 2] * cellSize;
    const y2 = offsetY + edgesPacked[i + 3] * cellSize;
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
  return g;
};

// 使用 Float32Array 的打包节点进行合批绘制
RendererDrawing.prototype.renderNodesPacked = function(nodesPacked, offsetX, offsetY, cellSize, style) {
  if (!(nodesPacked instanceof Float32Array) || nodesPacked.length < 2) return null;
  const color = style && typeof style.color === 'number' ? style.color : (this.config.nodeColor || 0xffffff);
  const alpha = style && typeof style.alpha === 'number' ? style.alpha : (this.config.nodeAlpha || 1);
  const radius = style && typeof style.radius === 'number' ? style.radius : (this.config.nodeRadius || 2);
  const g = new PIXI.Graphics();
  g.beginFill(color, alpha);
  for (let i = 0; i + 1 < nodesPacked.length; i += 2) {
    const x = offsetX + nodesPacked[i] * cellSize;
    const y = offsetY + nodesPacked[i + 1] * cellSize;
    g.drawCircle(x, y, radius);
  }
  g.endFill();
  return g;
};

// 使用 Float32Array 的打包障碍合批绘制（供渲染主流程调用）
RendererDrawing.prototype.renderObstaclesPacked = function(obstaclesPacked, offsetX, offsetY, cellSize, cullRect) {
  if (!(obstaclesPacked instanceof Float32Array) || obstaclesPacked.length < 4) return null;
  const g = new PIXI.Graphics();
  g.beginFill(0xdc2626, 0.5);
  g.lineStyle(1, 0xdc2626, 0.85);
  const needCull = !!(cullRect && typeof cullRect.x === 'number');
  for (let i = 0; i + 3 < obstaclesPacked.length; i += 4) {
    const ox = obstaclesPacked[i];
    const oy = obstaclesPacked[i + 1];
    const ow = obstaclesPacked[i + 2];
    const oh = obstaclesPacked[i + 3];
    const px = offsetX + ox * cellSize;
    const py = offsetY + oy * cellSize;
    const pw = ow * cellSize;
    const ph = oh * cellSize;
    if (needCull) {
      const rx = cullRect.x, ry = cullRect.y, rw = cullRect.w, rh = cullRect.h;
      if (px + pw < rx || rx + rw < px || py + ph < ry || ry + rh < py) continue;
    }
    g.drawRect(px, py, pw, ph);
  }
  g.endFill();
  return g;
};
