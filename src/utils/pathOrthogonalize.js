import { lineIntersectsObstacleWithTurf } from './obstacleGeometry.js';
import { createSpatialIndex, getPotentialObstacles } from './spatialIndex.js';

function expandObstacle(ob, m) {
  if (!m || m <= 0) return ob;
  return { x: ob.x - m, y: ob.y - m, w: ob.w + 2 * m, h: ob.h + 2 * m, id: ob.id };
}

function visible(x1, y1, x2, y2, obstacles, si, clearance) {
  const pool = si ? getPotentialObstacles(si, x1, y1, x2, y2) : obstacles;
  for (let i = 0; i < pool.length; i++) {
    const ob = expandObstacle(pool[i], clearance || 0);
    if (lineIntersectsObstacleWithTurf(x1, y1, x2, y2, ob)) return false;
  }
  return true;
}

function segLen(ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; return Math.hypot(dx, dy);
}

export function orthogonalizePath(path, obstacles, options = {}) {
  if (!Array.isArray(path) || path.length < 2) return path || [];
  const width = options.width || 0;
  const height = options.height || 0;
  const clearance = typeof options.clearance === 'number' ? options.clearance : 0;
  const onlyNearObstacles = options.onlyNearObstacles !== false; // 默认只在靠近障碍时直角化
  const useSI = options.useSpatialIndex !== false;
  const si = options.spatialIndex || (useSI ? createSpatialIndex(width, height, obstacles, options.cellSize) : null);
  const timeBudgetMs = typeof options.timeBudgetMs === 'number' ? options.timeBudgetMs : 0;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  const out = [path[0]];
  for (let i = 0; i < path.length - 1; i++) {
    if (timeBudgetMs > 0) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - t0 >= timeBudgetMs) {
        // 超时：附加剩余原始路径，提前返回
        for (let r = i; r < path.length; r++) out.push(path[r]);
        break;
      }
    }
    const a = path[i];
    const b = path[i + 1];

    // 若已是水平或垂直，无需处理
    if (a.x === b.x || a.y === b.y) { out.push(b); continue; }

    // 仅在靠近障碍时执行：如果直线 a-b 已经可见，且未靠近障碍，则保留原段
    const lineVisible = visible(a.x, a.y, b.x, b.y, obstacles, si, clearance);
    if (onlyNearObstacles && lineVisible) { out.push(b); continue; }

    const m1 = { x: a.x, y: b.y };
    const m2 = { x: b.x, y: a.y };

    const m1ok = visible(a.x, a.y, m1.x, m1.y, obstacles, si, clearance) &&
                 visible(m1.x, m1.y, b.x, b.y, obstacles, si, clearance);
    const m2ok = visible(a.x, a.y, m2.x, m2.y, obstacles, si, clearance) &&
                 visible(m2.x, m2.y, b.x, b.y, obstacles, si, clearance);

    if (!m1ok && !m2ok) { out.push(b); continue; }

    if (m1ok && m2ok) {
      const l1 = segLen(a.x, a.y, m1.x, m1.y) + segLen(m1.x, m1.y, b.x, b.y);
      const l2 = segLen(a.x, a.y, m2.x, m2.y) + segLen(m2.x, m2.y, b.x, b.y);
      const m = l1 <= l2 ? m1 : m2;
      out.push(m, b);
    } else if (m1ok) {
      out.push(m1, b);
    } else {
      out.push(m2, b);
    }
  }

  // 去重相邻重复点
  const dedup = [];
  for (let t = 0; t < out.length; t++) {
    const prev = dedup[dedup.length - 1];
    const cur = out[t];
    if (!prev || prev.x !== cur.x || prev.y !== cur.y) dedup.push(cur);
  }
  return dedup;
}
