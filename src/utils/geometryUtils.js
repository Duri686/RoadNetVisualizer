/**
 * 几何工具函数
 * 提供障碍物相交检测、距离计算等功能
 */

/**
 * 检查两个矩形是否相交
 */
export function rectanglesIntersect(r1, r2) {
  return !(
    r1.x + r1.w < r2.x ||
    r2.x + r2.w < r1.x ||
    r1.y + r1.h < r2.y ||
    r2.y + r2.h < r1.y
  );
}

/**
 * 检查点是否在矩形内
 */
export function pointInRectangle(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.w &&
    py >= rect.y &&
    py <= rect.y + rect.h
  );
}

/**
 * 计算两点之间的欧几里得距离
 */
export function euclideanDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算路径总长度（折线）
 * @param {{x:number,y:number}[]} path 路径点序列
 * @returns {number} 总长度
 */
export function pathTotalLength(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += euclideanDistance(path[i], path[i + 1]);
  }
  return total;
}

/**
 * 计算矩形中心点
 */
export function getRectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

/**
 * 检查点是否在任何障碍物内
 */
export function isPointInObstacles(px, py, obstacles) {
  return obstacles.some(obs => pointInRectangle(px, py, obs));
}

/**
 * 计算矩形的边界框
 */
export function getBoundingBox(rects) {
  if (rects.length === 0) {
    return { x: 0, y: 0, x2: 0, y2: 0, w: 0, h: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  rects.forEach(r => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  });

  return {
    x: minX,
    y: minY,
    x2: maxX,
    y2: maxY,
    w: maxX - minX,
    h: maxY - minY
  };
}

/**
 * 线段与矩形相交检测
 */
export function lineIntersectsRectangle(x1, y1, x2, y2, rect) {
  // 简化版本：检查线段端点或中点是否在矩形内
  if (pointInRectangle(x1, y1, rect) || pointInRectangle(x2, y2, rect)) {
    return true;
  }

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return pointInRectangle(mx, my, rect);
}
