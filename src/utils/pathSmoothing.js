import { lineIntersectsObstacleWithTurf } from './obstacleGeometry.js';
import { createSpatialIndex, getPotentialObstacles } from './spatialIndex.js';

function expandObstacle(ob, m) {
  if (!m || m <= 0) return ob;
  return {
    x: ob.x - m,
    y: ob.y - m,
    w: ob.w + 2 * m,
    h: ob.h + 2 * m,
    id: ob.id,
  };
}

function hasLineOfSight(x1, y1, x2, y2, obstacles, si, clearance) {
  const pool = si ? getPotentialObstacles(si, x1, y1, x2, y2) : obstacles;
  for (let i = 0; i < pool.length; i++) {
    const ob = expandObstacle(pool[i], clearance || 0);
    if (lineIntersectsObstacleWithTurf(x1, y1, x2, y2, ob)) return false;
  }
  return true;
}

export function smoothPathVisibility(path, obstacles, options = {}) {
  if (!Array.isArray(path) || path.length <= 2) return path || [];
  const width = options.width || 0;
  const height = options.height || 0;
  const useSI = options.useSpatialIndex !== false;

  const baseObstacles = Array.isArray(obstacles) ? obstacles : [];
  const obstaclesByLayer = options.obstaclesByLayer || null;
  const hasPerLayer = !!(
    obstaclesByLayer &&
    ((obstaclesByLayer instanceof Map && obstaclesByLayer.size > 0) ||
      (!(obstaclesByLayer instanceof Map) &&
        Object.keys(obstaclesByLayer).length > 0))
  );

  const siByLayer = useSI && hasPerLayer ? new Map() : null;
  const si =
    !hasPerLayer &&
    (options.spatialIndex ||
      (useSI
        ? createSpatialIndex(width, height, baseObstacles, options.cellSize)
        : null));

  const clearance =
    typeof options.clearance === 'number' ? options.clearance : 0;
  const maxLookahead = Math.max(1, options.maxLookahead || path.length);
  const timeBudgetMs =
    typeof options.timeBudgetMs === 'number' ? options.timeBudgetMs : 0;
  const t0 =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();

  // 标记必须保留的节点（跨层/通道节点等）
  const mustPreserve = new Set();

  // 1）优先使用外部传入的 mandatoryWaypoints（例如 AppEventManager 标记的 access 节点）
  if (options.mandatoryWaypoints) {
    if (options.mandatoryWaypoints instanceof Set) {
      options.mandatoryWaypoints.forEach((idx) => {
        if (typeof idx === 'number' && idx >= 0 && idx < path.length) {
          mustPreserve.add(idx);
        }
      });
    } else if (Array.isArray(options.mandatoryWaypoints)) {
      options.mandatoryWaypoints.forEach((idx) => {
        if (typeof idx === 'number' && idx >= 0 && idx < path.length) {
          mustPreserve.add(idx);
        }
      });
    }
  }

  // 2）兜底：起点和终点必须保留
  mustPreserve.add(0);
  mustPreserve.add(path.length - 1);

  // 3）如果外部没有显式给出跨层信息，则根据楼层变化自动补一次
  if (!options.mandatoryWaypoints) {
    for (let i = 0; i < path.length - 1; i++) {
      const currentLayer = path[i].layer || 0;
      const nextLayer = path[i + 1].layer || 0;
      if (currentLayer !== nextLayer) {
        // 楼层转换点：保留转换前后的节点
        mustPreserve.add(i);
        mustPreserve.add(i + 1);
      }
    }
  }

  // 预计算必须保留索引用于快速区间查询
  const n = path.length;
  const isMandatory = new Array(n).fill(false);
  mustPreserve.forEach((idx) => {
    if (idx >= 0 && idx < n) {
      isMandatory[idx] = true;
    }
  });
  const prefixMandatory = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefixMandatory[i + 1] = prefixMandatory[i] + (isMandatory[i] ? 1 : 0);
  }
  const hasMandatoryBetween = (from, to) => {
    if (to <= from + 1) return false;
    // 开区间 (from, to) 内是否存在必须保留节点
    return prefixMandatory[to] - prefixMandatory[from + 1] > 0;
  };

  // 按楼层选择对应的障碍物集合；若未提供分层数据，则退回全局 obstacles
  const getLayerObstacles = (layer) => {
    if (!hasPerLayer || !obstaclesByLayer) return baseObstacles;

    if (obstaclesByLayer instanceof Map) {
      const arr = obstaclesByLayer.get(layer);
      if (Array.isArray(arr)) return arr;
    } else if (Object.prototype.hasOwnProperty.call(obstaclesByLayer, layer)) {
      const arr = obstaclesByLayer[layer];
      if (Array.isArray(arr)) return arr;
    }

    return baseObstacles;
  };

  // 为指定楼层懒加载空间索引；若未启用分层，则退回全局索引 si
  const getLayerSpatialIndex = (layer, obsForLayer) => {
    if (!useSI) return null;
    if (siByLayer) {
      let idx = siByLayer.get(layer);
      if (!idx) {
        idx = createSpatialIndex(width, height, obsForLayer, options.cellSize);
        siByLayer.set(layer, idx);
      }
      return idx;
    }
    return si;
  };

  // 使用动态规划在“可视性图”上寻找同时兼顾长度和拐点数的最优子序列
  // 按楼层连续段拆分，每个同层段独立平滑，跨层节点保持原样
  const vertexPenalty =
    typeof options.turnPenaltyWeight === 'number'
      ? options.turnPenaltyWeight
      : 5;

  const globalIndices = [];
  let timedOut = false;

  // 将路径按楼层变化拆分为若干 [start, end] 段，每段内部 layer 恒定
  const segments = [];
  let segStart = 0;
  for (let i = 1; i < n; i++) {
    const prevLayer = path[i - 1].layer || 0;
    const currLayer = path[i].layer || 0;
    if (currLayer !== prevLayer) {
      segments.push({ start: segStart, end: i - 1 });
      segStart = i;
    }
  }
  segments.push({ start: segStart, end: n - 1 });

  for (let s = 0; s < segments.length; s++) {
    const { start, end } = segments[s];
    const len = end - start + 1;

    // 段内不足 2 个点，无法平滑，原样保留
    if (len <= 1) {
      if (
        globalIndices.length === 0 ||
        globalIndices[globalIndices.length - 1] !== start
      ) {
        globalIndices.push(start);
      }
      continue;
    }

    const dist = new Array(len).fill(Infinity);
    const prev = new Array(len).fill(-1);
    dist[0] = 0;

    // 段内 DP
    outerSegment: for (let li = 0; li < len - 1; li++) {
      if (!Number.isFinite(dist[li])) continue;
      const gi = start + li;
      const limit = Math.min(end, gi + maxLookahead);

      for (let gj = gi + 1; gj <= limit; gj++) {
        if (timeBudgetMs > 0) {
          const now =
            typeof performance !== 'undefined' && performance.now
              ? performance.now()
              : Date.now();
          if (now - t0 >= timeBudgetMs) {
            timedOut = true;
            break outerSegment;
          }
        }

        // 不允许跨越任何必须保留的节点
        if (hasMandatoryBetween(gi, gj)) continue;

        const a = path[gi];
        const b = path[gj];
        const layer = a.layer || 0;
        const obsForLayer = getLayerObstacles(layer);
        const siForLayer = getLayerSpatialIndex(layer, obsForLayer);
        if (
          !hasLineOfSight(
            a.x,
            a.y,
            b.x,
            b.y,
            obsForLayer,
            siForLayer,
            clearance,
          )
        ) {
          continue;
        }

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        const newCost = dist[li] + segLen + vertexPenalty;
        const lj = gj - start;
        if (newCost < dist[lj]) {
          dist[lj] = newCost;
          prev[lj] = li;
        }
      }
    }

    // 若该段不可达或超时，则整段退回原始节点
    const lastIdx = len - 1;
    if (timedOut || !Number.isFinite(dist[lastIdx])) {
      for (let gi = start; gi <= end; gi++) {
        if (
          globalIndices.length === 0 ||
          globalIndices[globalIndices.length - 1] !== gi
        ) {
          globalIndices.push(gi);
        }
      }
      if (timedOut) break;
      continue;
    }

    // 回溯该段内的最优索引序列
    const segIndices = [];
    let cursor = lastIdx;
    while (cursor >= 0) {
      segIndices.push(start + cursor);
      if (cursor === 0) break;
      cursor = prev[cursor];
      if (cursor === -1) {
        // 防御性退回：这一段用原始节点
        segIndices.length = 0;
        for (let gi = start; gi <= end; gi++) {
          segIndices.push(gi);
        }
        break;
      }
    }
    segIndices.reverse();

    // 追加到全局结果（避免重复首节点）
    for (let k = 0; k < segIndices.length; k++) {
      const gi = segIndices[k];
      if (
        globalIndices.length === 0 ||
        globalIndices[globalIndices.length - 1] !== gi
      ) {
        globalIndices.push(gi);
      }
    }

    if (timedOut) break;
  }

  // 若发生全局超时，则直接返回原始路径
  if (timedOut || globalIndices.length === 0) {
    return path.slice();
  }

  const result = globalIndices.map((idx) => path[idx]);

  // 去重（防止相邻重复），同时保持跨层节点
  const dedup = [];
  for (let t = 0; t < result.length; t++) {
    const prevNode = dedup[dedup.length - 1];
    const cur = result[t];
    const prevLayer = prevNode ? prevNode.layer || 0 : -1;
    const curLayer = cur.layer || 0;

    // 只有 x, y, layer 都相同才认为重复
    if (
      !prevNode ||
      prevNode.x !== cur.x ||
      prevNode.y !== cur.y ||
      prevLayer !== curLayer
    ) {
      dedup.push(cur);
    }
  }
  return dedup;
}
