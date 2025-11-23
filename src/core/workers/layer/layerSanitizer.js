/**
 * 安全过滤模块
 * 负责剔除穿障边与障碍内部节点
 */

import { isPointInObstaclesMargin } from '../../../utils/obstacleGeneration.js';
import { lineIntersectsObstacleWithTurf } from '../../../utils/obstacleGeometry.js';
import {
  createSpatialIndex,
  getObstaclesAlongLineDDA,
  getPotentialObstacles,
} from '../../../utils/spatialIndex.js';

function repairConnectivity(
  result,
  spatialIndex,
  obstacles,
  clearance,
  width,
  height,
) {
  const nodes = result.nodes || [];
  const edges = result.edges || [];
  if (!nodes.length || !edges.length) return;

  const idToIndex = new Map();
  const adj = [];
  for (let i = 0; i < nodes.length; i++) {
    idToIndex.set(nodes[i].id, i);
    adj.push([]);
  }

  let edgeLenSum = 0;
  let edgeLenCount = 0;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const a = idToIndex.get(e.from);
    const b = idToIndex.get(e.to);
    if (typeof a !== 'number' || typeof b !== 'number' || a === b) continue;
    adj[a].push(b);
    adj[b].push(a);

    const na = nodes[a];
    const nb = nodes[b];
    const dx = na.x - nb.x;
    const dy = na.y - nb.y;
    edgeLenSum += Math.sqrt(dx * dx + dy * dy);
    edgeLenCount += 1;
  }

  const visited = new Array(nodes.length).fill(false);
  const components = [];
  for (let i = 0; i < nodes.length; i++) {
    if (visited[i]) continue;
    const stack = [i];
    visited[i] = true;
    const comp = [];
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const list = adj[idx];
      for (let j = 0; j < list.length; j++) {
        const nb = list[j];
        if (!visited[nb]) {
          visited[nb] = true;
          stack.push(nb);
        }
      }
    }
    components.push(comp);
  }

  if (components.length <= 1) return;

  const baseLen = edgeLenCount > 0 ? edgeLenSum / edgeLenCount : 0;
  const diag = Math.sqrt(width * width + height * height);
  const maxBridgeLen = baseLen > 0 ? baseLen * 4 : diag * 0.5;

  components.sort((a, b) => b.length - a.length);
  const mainSet = new Set(components[0]);
  const mainIndices = components[0].slice();

  const getPool = (ax, ay, bx, by) => {
    if (!spatialIndex) return obstacles;
    const poolA = getObstaclesAlongLineDDA(spatialIndex, ax, ay, bx, by) || [];
    const poolB = getPotentialObstacles(spatialIndex, ax, ay, bx, by) || [];
    if (!poolA.length && !poolB.length) return obstacles;
    const seen = new Set();
    const pool = [];
    for (let i = 0; i < poolA.length; i++) {
      const ob = poolA[i];
      const id = ob.id != null ? ob.id : ob;
      if (!seen.has(id)) {
        seen.add(id);
        pool.push(ob);
      }
    }
    for (let i = 0; i < poolB.length; i++) {
      const ob = poolB[i];
      const id = ob.id != null ? ob.id : ob;
      if (!seen.has(id)) {
        seen.add(id);
        pool.push(ob);
      }
    }
    return pool.length ? pool : obstacles;
  };

  for (let ci = 1; ci < components.length; ci++) {
    const comp = components[ci];
    let bestU = -1;
    let bestV = -1;
    let bestDist = Infinity;

    for (let i = 0; i < comp.length; i++) {
      const ui = comp[i];
      const u = nodes[ui];
      for (let m = 0; m < mainIndices.length; m++) {
        const vi = mainIndices[m];
        const v = nodes[vi];
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= bestDist || dist > maxBridgeLen) continue;

        const pool = getPool(u.x, u.y, v.x, v.y);
        let blocked = false;
        for (let k = 0; k < pool.length; k++) {
          const ob = pool[k];
          if (
            lineIntersectsObstacleWithTurf(u.x, u.y, v.x, v.y, ob, clearance)
          ) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        bestDist = dist;
        bestU = ui;
        bestV = vi;
      }
    }

    if (bestU >= 0 && bestV >= 0) {
      const fromNode = nodes[bestU];
      const toNode = nodes[bestV];
      const cost = bestDist;
      result.edges.push({ from: fromNode.id, to: toNode.id, cost });
      adj[bestU].push(bestV);
      adj[bestV].push(bestU);
      if (!mainSet.has(bestU)) {
        mainSet.add(bestU);
        mainIndices.push(bestU);
      }
      for (let i = 0; i < comp.length; i++) {
        const idx = comp[i];
        if (!mainSet.has(idx)) {
          mainSet.add(idx);
          mainIndices.push(idx);
        }
      }
    }
  }
}

/**
 * 过滤障碍内部节点
 * @param {Array} nodes - 节点数组
 * @param {Array} obstacles - 障碍物数组
 * @param {number} clearance - 间隙距离
 * @returns {Set} 允许的节点 ID 集合
 */
function filterNodesInObstacles(nodes, obstacles, clearance) {
  const nodeAllowed = new Set();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!isPointInObstaclesMargin(n.x, n.y, obstacles, clearance)) {
      nodeAllowed.add(n.id);
    }
  }

  return nodeAllowed;
}

/**
 * 过滤穿障边
 * @param {Array} edges - 边数组
 * @param {Map} idToNode - 节点 ID 映射
 * @param {Set} nodeAllowed - 允许的节点集合
 * @param {Object} spatialIndex - 空间索引
 * @param {Array} obstacles - 障碍物数组
 * @param {number} clearance - 间隙距离
 * @returns {Array} 过滤后的边数组
 */
function filterBlockedEdges(
  edges,
  idToNode,
  nodeAllowed,
  spatialIndex,
  obstacles,
  clearance,
) {
  const filteredEdges = [];

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];

    if (!nodeAllowed.has(e.from) || !nodeAllowed.has(e.to)) {
      continue;
    }

    const a = idToNode.get(e.from);
    const b = idToNode.get(e.to);
    if (!a || !b) continue;

    // 候选障碍物 = DDA ∪ 包围盒
    const poolA = getObstaclesAlongLineDDA(spatialIndex, a.x, a.y, b.x, b.y);
    const poolB = getPotentialObstacles(spatialIndex, a.x, a.y, b.x, b.y);

    const seen = new Set();
    const pool = [];

    if (Array.isArray(poolA)) {
      for (const ob of poolA) {
        const id = ob.id != null ? ob.id : ob;
        if (!seen.has(id)) {
          seen.add(id);
          pool.push(ob);
        }
      }
    }

    if (Array.isArray(poolB)) {
      for (const ob of poolB) {
        const id = ob.id != null ? ob.id : ob;
        if (!seen.has(id)) {
          seen.add(id);
          pool.push(ob);
        }
      }
    }

    // 检测穿障
    let blocked = false;
    for (let k = 0; k < pool.length; k++) {
      const ob = pool[k];
      if (lineIntersectsObstacleWithTurf(a.x, a.y, b.x, b.y, ob, clearance)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      filteredEdges.push(e);
    }
  }

  return filteredEdges;
}

/**
 * 移除未被引用的节点
 * @param {Array} nodes - 节点数组
 * @param {Array} edges - 边数组
 * @param {Set} nodeAllowed - 允许的节点集合
 * @returns {Array} 过滤后的节点数组
 */
function removeUnreferencedNodes(nodes, edges, nodeAllowed) {
  const ref = new Set();

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    ref.add(e.from);
    ref.add(e.to);
  }

  return nodes.filter((n) => nodeAllowed.has(n.id) && ref.has(n.id));
}

/**
 * 安全过滤：剔除穿障边与障碍内部节点
 * @param {Object} result - 包含 nodes 和 edges 的结果对象
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} obstacles - 障碍物数组
 * @param {Object} options - 配置选项
 * @returns {Object} 过滤后的结果
 */
export function sanitizeLayer(result, width, height, obstacles, options = {}) {
  try {
    // 设置安全间隙：1.5像素可以避免浮点误差，但不会过度过滤
    // 注意：obstacleNetwork已经过滤了直接相交的边(margin=0)
    // 这里主要是提供额外的安全边距，避免边"擦边"通过障碍物
    const clearance =
      typeof options.edgeClearance === 'number' ? options.edgeClearance : 1.5;

    console.log(
      `🔧 [LayerSanitizer] 开始第二次安全过滤 | 安全间隙=${clearance}px | 障碍物=${obstacles.length}个`,
    );
    console.log(
      `   说明：obstacleNetwork已完成基础过滤(margin=0)，此处追加安全边距`,
    );

    const spatialIndex = createSpatialIndex(
      width,
      height,
      obstacles,
      options?.cellSize,
    );
    const idToNode = new Map(result.nodes.map((n) => [n.id, n]));

    // 1. 移除障碍内部节点
    const originalNodeCount = result.nodes.length;
    const nodeAllowed = filterNodesInObstacles(
      result.nodes,
      obstacles,
      clearance,
    );
    console.log(
      `   [步骤1] 节点过滤: ${originalNodeCount}个 → ${
        nodeAllowed.size
      }个 (❌移除 ${originalNodeCount - nodeAllowed.size}个)`,
    );

    // 2. 过滤穿障边
    const originalEdgeCount = result.edges.length;
    const filteredEdges = filterBlockedEdges(
      result.edges,
      idToNode,
      nodeAllowed,
      spatialIndex,
      obstacles,
      clearance,
    );
    const removedEdges = originalEdgeCount - filteredEdges.length;
    console.log(
      `   [步骤2] 边过滤: ${originalEdgeCount}条 → ${
        filteredEdges.length
      }条 (❌移除 ${removedEdges}条, ${(
        (removedEdges / originalEdgeCount) *
        100
      ).toFixed(1)}%)`,
    );

    result.edges = filteredEdges;

    // 3. 丢弃未被边引用的节点
    const beforeFinalNodes = result.nodes.length;
    result.nodes = removeUnreferencedNodes(
      result.nodes,
      filteredEdges,
      nodeAllowed,
    );
    const removedUnrefNodes = beforeFinalNodes - result.nodes.length;
    console.log(
      `   [步骤3] 清理未引用节点: ${beforeFinalNodes}个 → ${result.nodes.length}个 (❌移除 ${removedUnrefNodes}个)`,
    );

    repairConnectivity(
      result,
      spatialIndex,
      obstacles,
      clearance,
      width,
      height,
    );

    console.log(
      `✅ [LayerSanitizer] 完成！最终结果: ${result.nodes.length}个节点, ${result.edges.length}条边`,
    );
  } catch (err) {
    console.error('[Sanitize] 异常:', err);
    /* 忽略 sanitize 异常，确保生成流程不中断 */
  }

  return result;
}
