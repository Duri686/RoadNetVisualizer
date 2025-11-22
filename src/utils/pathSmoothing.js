import { lineIntersectsObstacleWithTurf } from './obstacleGeometry.js';
import { createSpatialIndex, getPotentialObstacles } from './spatialIndex.js';

function expandObstacle(ob, m) {
  if (!m || m <= 0) return ob;
  return { x: ob.x - m, y: ob.y - m, w: ob.w + 2 * m, h: ob.h + 2 * m, id: ob.id };
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
  const si = options.spatialIndex || (useSI ? createSpatialIndex(width, height, obstacles, options.cellSize) : null);
  const clearance = typeof options.clearance === 'number' ? options.clearance : 0;
  const maxLookahead = Math.max(1, options.maxLookahead || path.length);
  const timeBudgetMs = typeof options.timeBudgetMs === 'number' ? options.timeBudgetMs : 0;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // Mark nodes that must be preserved (floor transition points)
  const mustPreserve = new Set();
  mustPreserve.add(0); // Always keep start
  mustPreserve.add(path.length - 1); // Always keep end
  
  for (let i = 0; i < path.length - 1; i++) {
    const currentLayer = path[i].layer || 0;
    const nextLayer = path[i + 1].layer || 0;
    if (currentLayer !== nextLayer) {
      // Floor transition - preserve both nodes (entry and exit)
      mustPreserve.add(i);     // Exit node from current floor
      mustPreserve.add(i + 1); // Entry node to next floor
    }
  }

  const result = [];
  let i = 0;
  result.push(path[0]);

  while (i < path.length - 1) {
    if (timeBudgetMs > 0) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - t0 >= timeBudgetMs) {
        // 超时：附加剩余原始路径，提前返回
        for (let r = i + 1; r < path.length; r++) result.push(path[r]);
        break;
      }
    }
    
    let j = i + 1;
    const limit = Math.min(path.length - 1, i + maxLookahead);
    const currentLayer = path[i].layer || 0;

    for (let k = j; k <= limit; k++) {
      // Can't skip past nodes that must be preserved
      if (k > i + 1 && mustPreserve.has(k)) {
        break;
      }
      
      // Don't skip over floor transitions
      const targetLayer = path[k].layer || 0;
      if (targetLayer !== currentLayer) {
        break;
      }
      
      const a = path[i];
      const b = path[k];
      if (hasLineOfSight(a.x, a.y, b.x, b.y, obstacles, si, clearance)) {
        j = k;
      } else {
        break;
      }
    }

    result.push(path[j]);
    i = j;
  }

  // 去重（防止相邻重复）
  // ⚠️ 关键修复：跨楼层节点可能 x,y 相同但 layer 不同，必须保留
  const dedup = [];
  for (let t = 0; t < result.length; t++) {
    const prev = dedup[dedup.length - 1];
    const cur = result[t];
    const prevLayer = prev ? (prev.layer || 0) : -1;
    const curLayer = cur.layer || 0;
    
    // 只有 x, y, layer 都相同才认为重复
    if (!prev || prev.x !== cur.x || prev.y !== cur.y || prevLayer !== curLayer) {
      dedup.push(cur);
    }
  }
  return dedup;
}
