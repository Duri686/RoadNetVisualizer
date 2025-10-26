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
  // 估计一个合理 cellSize：综合“障碍平均尺寸”与“密度估计”的较小者
  if (!cellSize) {
    let acc = 0;
    for (const ob of obstacles) { const b = getObstacleBBox(ob); acc += Math.max(b.w, b.h); }
    const avg = obstacles.length ? acc / obstacles.length : 32;
    // 基于密度的估计：sqrt(面积/数量) 的 0.8 倍，范围 [8, 96]
    const area = Math.max(1, width * height);
    const dens = obstacles.length > 0 ? Math.sqrt(area / obstacles.length) * 0.8 : 32;
    const est = Math.min(avg, dens);
    cellSize = Math.max(8, Math.min(96, Math.floor(est)));
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

/**
 * DDA：沿线逐格遍历查询潜在障碍（更窄的候选集）
 */
export function getObstaclesAlongLineDDA(index, x1, y1, x2, y2) {
  const { cellSize, grid } = index;
  const ix0 = Math.floor(x1 / cellSize);
  const iy0 = Math.floor(y1 / cellSize);
  const ix1 = Math.floor(x2 / cellSize);
  const iy1 = Math.floor(y2 / cellSize);
  let ix = ix0, iy = iy0;
  const stepX = (x2 > x1) ? 1 : (x2 < x1) ? -1 : 0;
  const stepY = (y2 > y1) ? 1 : (y2 < y1) ? -1 : 0;
  const dx = x2 - x1, dy = y2 - y1;
  const invDx = dx !== 0 ? 1 / dx : 0;
  const invDy = dy !== 0 ? 1 / dy : 0;
  const cellBoundX = (i) => (i + (stepX > 0 ? 1 : 0)) * cellSize;
  const cellBoundY = (j) => (j + (stepY > 0 ? 1 : 0)) * cellSize;
  let tMaxX = stepX !== 0 ? (cellBoundX(ix) - x1) * invDx : Infinity;
  let tMaxY = stepY !== 0 ? (cellBoundY(iy) - y1) * invDy : Infinity;
  const tDeltaX = stepX !== 0 ? (cellSize * stepX) * invDx : Infinity;
  const tDeltaY = stepY !== 0 ? (cellSize * stepY) * invDy : Infinity;

  const seen = new Set();
  const out = [];
  const pushCell = (cx, cy) => {
    const arr = grid.get(`${cx},${cy}`);
    if (!arr) return;
    for (const ob of arr) {
      const id = ob.id != null ? ob.id : ob;
      if (!seen.has(id)) { seen.add(id); out.push(ob); }
    }
  };
  // 访问起点格
  pushCell(ix, iy);
  let guard = 0;
  const maxSteps = 1 + Math.abs(ix1 - ix0) + Math.abs(iy1 - iy0);
  while ((ix !== ix1 || iy !== iy1) && guard++ < maxSteps + 4) {
    if (tMaxX < tMaxY) { ix += stepX; tMaxX += tDeltaX; }
    else               { iy += stepY; tMaxY += tDeltaY; }
    pushCell(ix, iy);
  }
  return out;
}

/**
 * 点查询：返回点所在及邻近格的障碍候选
 */
export function getPotentialObstaclesForPoint(index, x, y, radiusCells = 1) {
  const { cellSize, grid } = index;
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  const seen = new Set();
  const out = [];
  for (let ix = cx - radiusCells; ix <= cx + radiusCells; ix++) {
    for (let iy = cy - radiusCells; iy <= cy + radiusCells; iy++) {
      const arr = grid.get(`${ix},${iy}`);
      if (!arr) continue;
      for (const ob of arr) {
        const id = ob.id != null ? ob.id : ob;
        if (!seen.has(id)) { seen.add(id); out.push(ob); }
      }
    }
  }
  return out;
}
