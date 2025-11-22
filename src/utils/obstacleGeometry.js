/**
 * 障碍物几何检测工具
 * 提供障碍物相关的几何计算和检测功能
 */

// —— 快速直线-矩形相交（Liang–Barsky 裁剪）——
// 仅适用于轴对齐矩形（AABB），满足当前障碍物模型。
function lineIntersectsAARect(ax, ay, bx, by, rect) {
  // 快速包含：两端均在内部，视为相交/包含
  const L = rect.x,
    R = rect.x + rect.w;
  const T = rect.y,
    B = rect.y + rect.h;
  const inside = (x, y) => x >= L && x <= R && y >= T && y <= B;
  if (inside(ax, ay) && inside(bx, by)) return true;

  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const clip = (p, q) => {
    if (p === 0) return q < 0 ? false : true; // 平行：若在外侧则不相交
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  // 左、右、上、下 边界
  if (!clip(-dx, ax - L)) return false;
  if (!clip(dx, R - ax)) return false;
  if (!clip(-dy, ay - T)) return false;
  if (!clip(dy, B - ay)) return false;
  // 有重叠区间则相交（含端点/内部）
  return t0 <= t1 && (t0 >= 0 || t1 >= 0) && (t0 <= 1 || t1 <= 1);
}

/**
 * 欧几里得距离
 * @param {Object} p1 - 点1 {x, y}
 * @param {Object} p2 - 点2 {x, y}
 * @returns {number} 距离
 */
export function euclideanDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检测线段是否与障碍物矩形相交（使用 Liang-Barsky 算法）
 * 简化且可靠的实现，正确处理所有边界情况
 * @param {number} x1 - 线段起点 x
 * @param {number} y1 - 线段起点 y
 * @param {number} x2 - 线段终点 x
 * @param {number} y2 - 线段终点 y
 * @param {Object} obstacle - 障碍物对象 {x, y, w, h}
 * @param {number} margin - 安全间隙
 * @returns {boolean} 是否相交
 */
// 调试计数器（仅采样记录）
let _collisionCheckCount = 0;
let _collisionDetectedCount = 0;

export function lineIntersectsObstacleWithTurf(
  x1,
  y1,
  x2,
  y2,
  obstacle,
  margin = 0,
) {
  _collisionCheckCount++;

  // 扩展障碍物边界（包含安全间隙）
  const left = obstacle.x - margin;
  const right = obstacle.x + obstacle.w + margin;
  const top = obstacle.y - margin;
  const bottom = obstacle.y + obstacle.h + margin;

  // 检查点是否在扩展矩形内部
  const pointInside = (x, y) =>
    x >= left && x <= right && y >= top && y <= bottom;

  // 快速检测：任一端点在内部
  if (pointInside(x1, y1) || pointInside(x2, y2)) {
    return true;
  }

  // Liang-Barsky 线段裁剪算法
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const clipTest = (p, q) => {
    if (Math.abs(p) < 1e-10) {
      // 线段平行于边界
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      // 从外部进入
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      // 从内部离开
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  // 测试四条边界
  if (!clipTest(-dx, x1 - left)) return false; // 左边界
  if (!clipTest(dx, right - x1)) return false; // 右边界
  if (!clipTest(-dy, y1 - top)) return false; // 上边界
  if (!clipTest(dy, bottom - y1)) return false; // 下边界

  // 如果 t0 <= t1，说明线段与矩形有重叠
  const intersects = t0 <= t1;
  if (intersects) {
    _collisionDetectedCount++;
    // 采样日志：每100次检测输出一次
    if (_collisionCheckCount % 100 === 0) {
      console.log(
        `🔍 [CollisionCheck] 已检测 ${_collisionCheckCount} 次，发现 ${_collisionDetectedCount} 次碰撞 (margin=${margin})`,
      );
    }
  }
  return intersects;
}

/**
 * 获取碰撞检测统计信息并重置计数器
 */
export function getCollisionStats() {
  const stats = {
    totalChecks: _collisionCheckCount,
    collisionsDetected: _collisionDetectedCount,
    collisionRate:
      _collisionCheckCount > 0
        ? ((_collisionDetectedCount / _collisionCheckCount) * 100).toFixed(1)
        : 0,
  };
  _collisionCheckCount = 0;
  _collisionDetectedCount = 0;
  return stats;
}

/**
 * 检查点是否在障碍物的顶点附近（容差 0.5）
 * @param {number} px - 点 x 坐标
 * @param {number} py - 点 y 坐标
 * @param {Object} obstacle - 障碍物对象
 * @param {number} tolerance - 容差值
 * @returns {boolean} 是否在顶点附近
 */
export function isPointNearObstacleVertex(px, py, obstacle, tolerance = 0.5) {
  const vertices = [
    { x: obstacle.x, y: obstacle.y },
    { x: obstacle.x + obstacle.w, y: obstacle.y },
    { x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h },
    { x: obstacle.x, y: obstacle.y + obstacle.h },
  ];

  return vertices.some((v) => {
    const dx = px - v.x;
    const dy = py - v.y;
    return Math.sqrt(dx * dx + dy * dy) < tolerance;
  });
}

/**
 * 获取矩形障碍物的4个顶点
 * @param {Object} obstacle - 障碍物对象 {id, x, y, w, h}
 * @returns {Object} 顶点对象 { topLeft, topRight, bottomRight, bottomLeft }
 */
export function getObstacleVertices(obstacle) {
  return {
    topLeft: {
      x: obstacle.x,
      y: obstacle.y,
      type: 'topLeft',
      obstacleId: obstacle.id,
    },
    topRight: {
      x: obstacle.x + obstacle.w,
      y: obstacle.y,
      type: 'topRight',
      obstacleId: obstacle.id,
    },
    bottomRight: {
      x: obstacle.x + obstacle.w,
      y: obstacle.y + obstacle.h,
      type: 'bottomRight',
      obstacleId: obstacle.id,
    },
    bottomLeft: {
      x: obstacle.x,
      y: obstacle.y + obstacle.h,
      type: 'bottomLeft',
      obstacleId: obstacle.id,
    },
  };
}

/**
 * 提取所有障碍物的顶点
 * @param {Array} obstacles - 障碍物数组
 * @returns {Array} 顶点数组
 */
export function extractAllObstacleVertices(obstacles) {
  const vertices = [];
  obstacles.forEach((obs) => {
    const v = getObstacleVertices(obs);
    vertices.push(v.topLeft, v.topRight, v.bottomRight, v.bottomLeft);
  });
  return vertices;
}

/**
 * 获取地图边界的4个角点
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @returns {Array} 边界顶点数组
 */
export function getBoundaryVertices(width, height) {
  return [
    { x: 0, y: 0, type: 'boundary', obstacleId: -1, corner: 'topLeft' },
    { x: width, y: 0, type: 'boundary', obstacleId: -1, corner: 'topRight' },
    {
      x: width,
      y: height,
      type: 'boundary',
      obstacleId: -1,
      corner: 'bottomRight',
    },
    { x: 0, y: height, type: 'boundary', obstacleId: -1, corner: 'bottomLeft' },
  ];
}
