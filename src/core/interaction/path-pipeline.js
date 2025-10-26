// 路径管线模块（保持与原逻辑等价）
// 职责：寻路 -> 平滑 -> 正交化 -> 绘制 -> 面板信息 -> 记录上次路径

import { findPathAStar } from '../../utils/pathfinding.js';
import { smoothPathVisibility } from '../../utils/pathSmoothing.js';
import { orthogonalizePath } from '../../utils/pathOrthogonalize.js';
import { animatePath as animRun } from './animation.js';
import { pathTotalLength } from '../../utils/geometryUtils.js';

/**
 * 查找并绘制路径
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx 交互上下文
 * @param {Object} startNode 起点
 * @param {Object} endNode 终点
 * @param {boolean} [isPreview=false] 是否预览
 */
export function findAndDrawPath(ctx, startNode, endNode, isPreview = false) {
  const layer = ctx.roadNetData?.layers?.[0];
  if (!layer) return;
  if (!isPreview) ctx.state.smoothMs = 0;

  // 使用 A* 算法查找路径
  let path = findPathAStar(layer, startNode, endNode);

  // 路径平滑（可见性捷径）
  try {
    const sm = ctx.config?.interaction?.smoothing || {};
    const shouldSmooth = sm.enabled && (!isPreview || sm.useInPreview);
    if (shouldSmooth && path && path.length > 1) {
      const meta = ctx.roadNetData?.metadata || {};
      const obstacles = Array.isArray(ctx.roadNetData?.obstacles) ? ctx.roadNetData.obstacles : [];
      const t0 = performance?.now ? performance.now() : Date.now();
      path = smoothPathVisibility(path, obstacles, {
        width: meta.width || 0,
        height: meta.height || 0,
        useSpatialIndex: sm.useSpatialIndex !== false,
        maxLookahead: sm.maxLookahead || 24,
        clearance: sm.clearance || 0,
      });
      const t1 = performance?.now ? performance.now() : Date.now();
      const used = Math.max(0, Math.round(t1 - t0));
      ctx.state.smoothMs = (ctx.state.smoothMs || 0) + used;
      if (!isPreview) console.log(`[Smoothing] 可见性平滑: 节点 ${path.length}，耗时 ${used} ms`);
    }
  } catch (e) {
    console.debug('[Smoothing] 跳过，原因：', e);
  }

  // 直角化（仅最终路径）
  try {
    const ortho = ctx.config?.interaction?.orthogonal || {};
    const shouldOrtho = ortho.enabled && !isPreview;
    if (shouldOrtho && path && path.length > 1) {
      const meta = ctx.roadNetData?.metadata || {};
      const obstacles = Array.isArray(ctx.roadNetData?.obstacles) ? ctx.roadNetData.obstacles : [];
      const t0o = performance?.now ? performance.now() : Date.now();
      path = orthogonalizePath(path, obstacles, {
        width: meta.width || 0,
        height: meta.height || 0,
        clearance: (ctx.config?.interaction?.smoothing?.clearance) || 0,
        onlyNearObstacles: ortho.onlyNearObstacles !== false,
        useSpatialIndex: ortho.useSpatialIndex !== false,
      });
      const t1o = performance?.now ? performance.now() : Date.now();
      const usedO = Math.max(0, Math.round(t1o - t0o));
      ctx.state.smoothMs = (ctx.state.smoothMs || 0) + usedO;
      console.log(`[Smoothing] 直角化: 节点 ${path.length}，耗时 ${usedO} ms`);
    }
  } catch (e) {
    console.debug('[Orthogonal] 跳过，原因：', e);
  }

  if (path && path.length > 0) {
    ctx.state.path = path;
    ctx.drawing.drawPath(ctx.pathContainer, path, isPreview);
    updatePathInfo(ctx, path, isPreview);

    if (!isPreview) {
      console.log(`🛤️ Path found: ${path.length} nodes`);
      ctx.drawInteractionNodes();
      animRun(ctx, path);

      // 保存为“上次路径”
      const total = pathTotalLength(path);
      ctx.state.lastPath = path;
      ctx.state.lastPathTotal = total;
    }
  }
}

/**
 * 使用 lastPath 重新绘制路径
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 */
export function redrawLastPath(ctx) {
  if (!ctx.state.lastPath || !ctx.pathContainer) return;
  // 移除可能残留的动画小球，避免位置错乱
  try { ctx.cancelAnimationIfAny(); } catch (_) {}
  ctx.drawing.drawPath(ctx.pathContainer, ctx.state.lastPath, false);
  updatePathInfo(ctx, ctx.state.lastPath, false);

  // 恢复并绘制起点/终点标记：根据 lastPath 两端节点的 id 重新绑定到当前 layer 节点
  try {
    const layer0 = ctx.roadNetData && ctx.roadNetData.layers && ctx.roadNetData.layers[0];
    const lp = ctx.state.lastPath;
    if (layer0 && Array.isArray(layer0.nodes) && Array.isArray(lp) && lp.length >= 2) {
      const sId = lp[0] && lp[0].id;
      const eId = lp[lp.length - 1] && lp[lp.length - 1].id;
      let sNode = null; let eNode = null;
      if (sId != null) sNode = layer0.nodes.find(n => n.id === sId) || null;
      if (eId != null) eNode = layer0.nodes.find(n => n.id === eId) || null;
      // 若无法通过 id 匹配，则直接使用路径两端节点（其 x/y 已可用）
      if (!sNode) sNode = lp[0];
      if (!eNode) eNode = lp[lp.length - 1];
      ctx.state.startNode = sNode;
      ctx.state.endNode = eNode;
      ctx.drawInteractionNodes();
    }
  } catch (e) {
    // 忽略恢复起终点失败，不影响路径重绘
  }
}

/**
 * 清空路径（图形与状态）
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 */
export function clearPath(ctx) {
  ctx.cancelAnimationIfAny();
  ctx.clearInteractionGraphics();
  ctx.state.startNode = null;
  ctx.state.endNode = null;
  ctx.state.path = null;
  ctx.state.smoothMs = null;
  resetPathInfo(ctx);
}

/**
 * 更新界面上的路径信息
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 * @param {Array} path
 * @param {boolean} isPreview
 */
export function updatePathInfo(ctx, path, isPreview) {
  const panel = document.getElementById('path-info');
  if (!panel) return;

  const total = pathTotalLength(path);
  const turns = ctx._computeTurnsCount(path);
  const smoothMs = typeof ctx.state.smoothMs === 'number' ? ctx.state.smoothMs : null;

  const title = isPreview ? '当前路径（预览）' : '当前路径（最终）';
  const last = ctx.state.lastPathTotal;
  const compare = !isPreview && typeof last === 'number'
    ? `<div style="margin-top:6px;color:var(--text-secondary)">上次：<strong>${last.toFixed(2)} m</strong> ｜ 差异：<strong>${(total - last).toFixed(2)} m</strong></div>`
    : '';
  const smoothInfo = !isPreview && smoothMs != null
    ? `<div style="margin-top:6px;color:var(--text-secondary)">平滑耗时：<strong>${smoothMs} ms</strong></div>`
    : '';
  panel.innerHTML = `
      <div><strong>${title}</strong>：节点数 ${path.length}；总距离 <strong>${total.toFixed(2)} m</strong></div>
      ${compare}
      ${smoothInfo}
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
  if (!isPreview) setText('path-smooth-ms', smoothMs != null ? `${smoothMs} ms` : '-- ms');
}

/**
 * 重置路径信息面板
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx
 */
export function resetPathInfo(ctx) {
  const panel = document.getElementById('path-info');
  if (panel) panel.innerHTML = '<div><strong>当前路径</strong>：无</div>';
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setText('path-status', '未选择');
  setText('path-length', '--');
  setText('path-nodes', '--');
  setText('path-turns', '--');
  setText('path-smooth-ms', '-- ms');
}
