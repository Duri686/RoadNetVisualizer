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

    for (let k = j + 0; k <= limit; k++) {
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
  const dedup = [];
  for (let t = 0; t < result.length; t++) {
    const prev = dedup[dedup.length - 1];
    const cur = result[t];
    if (!prev || prev.x !== cur.x || prev.y !== cur.y) dedup.push(cur);
  }
  return dedup;
}
