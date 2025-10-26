// 事件与绑定模块（保持与原逻辑等价）
// 职责：初始化交互绑定、鼠标移动与点击处理、Delaunay 重建

import { Delaunay } from 'd3-delaunay';

/**
 * 初始化交互功能
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 * @param {PIXI.Application} app PIXI 应用
 * @param {Function} onPointerMove 鼠标移动回调
 * @param {Function} onPointerDown 鼠标点击回调
 */
export function setupInteraction(ctx, app, onPointerMove, onPointerDown) {
  if (!app || !ctx.roadNetData) {
    console.warn('⚠️ Cannot setup interaction: app or roadNetData missing');
    return;
  }

  console.log('🎮 Setting up interaction...');

  const layer0 = ctx.roadNetData.layers[0];

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

  ctx.state.enabled = true;
  console.log('✅ Interaction enabled for Layer 0');
}

/**
 * 处理鼠标移动
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 * @param {Object} event 事件对象
 * @param {number} currentLayer 当前图层
 */
export function handlePointerMove(ctx, event, currentLayer) {
  if (!ctx.state.enabled || currentLayer !== 0) return;

  // 容器尚未就绪（例如全屏切换触发的重绘过程中）
  if (!ctx.container || !ctx.container.parent) return;

  const layer = ctx.roadNetData.layers[0];
  if (!layer || !layer.delaunay) {
    console.warn('⚠️ Layer 0 or delaunay missing');
    return;
  }

  // 获取鼠标在画布上的原始坐标（保留变量以便调试）
  const mousePos = event.global;
  // 仅在鼠标设备且非移动端时显示十字星
  const pointerType = event && event.data && event.data.pointerType ? event.data.pointerType : 'mouse';
  const isMobileView = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
  const allowCrosshair = pointerType === 'mouse' && !isMobileView;

  // 获取鼠标相对于交互容器的坐标（已考虑缩放和平移）
  const localPos = event.data.getLocalPosition(ctx.container);

  // 计算网格坐标（用于 Delaunay 查找）
  const gridX = (localPos.x - ctx.transform.offsetX) / ctx.transform.cellSize;
  const gridY = (localPos.y - ctx.transform.offsetY) / ctx.transform.cellSize;

  // 使用 Delaunay.find() 查找最近的点
  const nearestIndex = layer.delaunay.find(gridX, gridY);

  if (
    nearestIndex !== undefined &&
    nearestIndex >= 0 &&
    nearestIndex < layer.nodes.length
  ) {
    const nearestNode = layer.nodes[nearestIndex];
    ctx.state.hoveredNode = nearestNode;

    // 绘制十字星（仅桌面鼠标设备），移动端隐藏
    if (ctx.crosshairGraphics) {
      if (allowCrosshair) {
        ctx.drawing.drawCrosshair(
          ctx.crosshairGraphics,
          localPos.x,
          localPos.y,
        );
      } else {
        ctx.crosshairGraphics.visible = false;
      }
    }

    // 如果已选择起点且尚未选择终点，实时显示预览路径
    if (ctx.state.startNode && !ctx.state.endNode && !ctx.state.isAnimating) {
      ctx.findAndDrawPath(ctx.state.startNode, nearestNode, true);
    }
  } else {
    ctx.state.hoveredNode = null;
    if (ctx.crosshairGraphics) ctx.crosshairGraphics.visible = false;
  }
}

/**
 * 处理鼠标点击
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 * @param {Object} event 事件对象
 * @returns {boolean}
 */
export function handlePointerDown(ctx, event) {
  // 切换点位时，若存在正在进行的动画，则立即停止并移除小球
  ctx.cancelAnimationIfAny();
  if (ctx.autoClearTimer) {
    clearTimeout(ctx.autoClearTimer);
    ctx.autoClearTimer = null;
  }

  // 如果提供了事件对象，先更新悬停节点
  if (event && ctx.roadNetData) {
    const layer = ctx.roadNetData.layers[0];
    if (layer && layer.delaunay) {
      // 获取鼠标相对于交互容器的坐标
      const localPos = event.data.getLocalPosition(ctx.container);

      // 计算网格坐标
      const gridX = (localPos.x - ctx.transform.offsetX) / ctx.transform.cellSize;
      const gridY = (localPos.y - ctx.transform.offsetY) / ctx.transform.cellSize;

      // 查找最近的点
      const nearestIndex = layer.delaunay.find(gridX, gridY);

      if (
        nearestIndex !== undefined &&
        nearestIndex >= 0 &&
        nearestIndex < layer.nodes.length
      ) {
        ctx.state.hoveredNode = layer.nodes[nearestIndex];
      }
    }
  }

  if (!ctx.state.hoveredNode) {
    console.log('❌ No hovered node');
    return false;
  }

  const clickedNode = ctx.state.hoveredNode;

  // 第一次点击：设置起点
  if (!ctx.state.startNode) {
    ctx.state.startNode = clickedNode;
    ctx.state.endNode = null;
    ctx.state.path = null;
    if (ctx.pathContainer) ctx.pathContainer.removeChildren();
    ctx.drawInteractionNodes();
    return true;
  }
  // 第二次点击：设置终点并计算路径
  else {
    ctx.state.endNode = clickedNode;
    ctx.findAndDrawPath(ctx.state.startNode, clickedNode, false);

    // 保留已绘制路径与动画进行，方便再次选择
    ctx.state.startNode = null;
    ctx.state.endNode = null;
    return true;
  }
}
