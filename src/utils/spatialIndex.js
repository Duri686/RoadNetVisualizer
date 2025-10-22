// 空间索引（均匀网格）
// 用于将穿障检测由“遍历所有障碍物”缩减为“仅检测线段附近网格中的障碍物”。

/**
 * 计算障碍物包围盒
 * - 矩形：直接使用 {x,y,w,h}
 * - 多边形：根据 points 计算外接矩形（预留后续多边形支持）
 */
export function getObstacleBBox(ob) {
  if (ob && Array.isArray(ob.points) && ob.points.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ob.points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return { x: ob.x, y: ob.y, w: ob.w, h: ob.h };
}

/**
 * 创建网格索引
 * @param {number} width 地图宽
 * @param {number} height 地图高
 * @param {Array} obstacles 障碍数组
 * @param {number} [cellSize] 单元格边长
 */
export function createSpatialIndex(width, height, obstacles, cellSize) {
  // 估计一个合理 cellSize（取平均较大一侧尺寸，保底 16）
  if (!cellSize) {
    let acc = 0;
    for (const ob of obstacles) { const b = getObstacleBBox(ob); acc += Math.max(b.w, b.h); }
    const avg = obstacles.length ? acc / obstacles.length : 32;
    cellSize = Math.max(16, Math.floor(avg));
  }
  const grid = new Map(); // key:"ix,iy" -> Array<obstacle>

  const put = (ix, iy, ob) => {
    const key = `${ix},${iy}`;
    const arr = grid.get(key);
    if (arr) arr.push(ob); else grid.set(key, [ob]);
  };

  for (const ob of obstacles) {
    const b = getObstacleBBox(ob);
    const x0 = Math.floor(b.x / cellSize);
    const x1 = Math.floor((b.x + b.w) / cellSize);
    const y0 = Math.floor(b.y / cellSize);
    const y1 = Math.floor((b.y + b.h) / cellSize);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        put(ix, iy, ob);
      }
    }
  }

  return { cellSize, grid };
}

/**
 * 查询线段附近的潜在障碍物（基于包围盒的网格范围）
 */
export function getPotentialObstacles(index, x1, y1, x2, y2) {
  const { cellSize, grid } = index;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  // 适度扩展 1 个单元，覆盖边界情况
  const x0 = Math.floor((minX - cellSize) / cellSize);
  const x1c = Math.floor((maxX + cellSize) / cellSize);
  const y0 = Math.floor((minY - cellSize) / cellSize);
  const y1c = Math.floor((maxY + cellSize) / cellSize);

  const seen = new Set();
  const result = [];
  for (let ix = x0; ix <= x1c; ix++) {
    for (let iy = y0; iy <= y1c; iy++) {
      const arr = grid.get(`${ix},${iy}`);
      if (!arr) continue;
      for (const ob of arr) {
        const id = ob.id != null ? ob.id : ob; // 保底处理
        if (!seen.has(id)) { seen.add(id); result.push(ob); }
      }
    }
  }
  return result;
}
