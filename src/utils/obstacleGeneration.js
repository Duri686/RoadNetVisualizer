/**
 * 障碍物生成工具
 * 提供随机障碍物生成功能
 */

/**
 * 简单的种子随机数生成器
 */
export class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

/**
 * 生成随机障碍物（矩形，弹性尺寸）
 * - 此修改保持与原逻辑一致：默认仍为矩形且避免重叠；仅调小默认尺寸范围并提供可选项。
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @param {number} obstacleCount - 障碍物数量
 * @param {SeededRandom} rng - 随机数生成器实例
 * @param {Object} [opts] - 可选配置
 * @param {number} [opts.minSizeRatio=0.01] - 最小尺寸相对比例（相对 min(width,height)）
 * @param {number} [opts.maxSizeRatio=0.05] - 最大尺寸相对比例（相对 min(width,height)）
 * @param {boolean} [opts.avoidOverlap=true] - 是否避免重叠
 * @param {number} [opts.padding=2] - 重叠判定的安全间距（像素）
 * @param {number} [opts.maxAttemptsPerObstacle=30] - 每个障碍的最大放置尝试次数
 * @returns {Array} 障碍物数组
 */
export function generateObstacles(width, height, obstacleCount, rng, opts = {}) {
  const obstacles = [];

  const minWH = Math.max(1, Math.min(width, height));
  const minSizeRatio = typeof opts.minSizeRatio === 'number' ? opts.minSizeRatio : 0.01; // 1%
  const maxSizeRatio = typeof opts.maxSizeRatio === 'number' ? opts.maxSizeRatio : 0.05; // 5%
  const avoidOverlap = opts.avoidOverlap !== false;
  const padding = typeof opts.padding === 'number' ? opts.padding : 2;
  const perAttempts = Math.max(1, opts.maxAttemptsPerObstacle || 30);

  const minSize = Math.max(2, Math.floor(minWH * minSizeRatio));
  const maxSize = Math.max(minSize + 1, Math.floor(minWH * maxSizeRatio));

  let placed = 0;
  while (placed < obstacleCount) {
    let ok = false;
    for (let attempt = 0; attempt < perAttempts; attempt++) {
      const w = rng.randomInt(minSize, Math.min(maxSize, width));
      const h = rng.randomInt(minSize, Math.min(maxSize, height));
      const x = rng.randomInt(0, Math.max(0, width - w));
      const y = rng.randomInt(0, Math.max(0, height - h));

      const newObstacle = { id: obstacles.length, x, y, w, h };

      if (avoidOverlap) {
        const hasOverlap = obstacles.some(obs => {
          // 扩张用于安全间隔
          const aL = newObstacle.x - padding;
          const aR = newObstacle.x + newObstacle.w + padding;
          const aT = newObstacle.y - padding;
          const aB = newObstacle.y + newObstacle.h + padding;
          const bL = obs.x;
          const bR = obs.x + obs.w;
          const bT = obs.y;
          const bB = obs.y + obs.h;
          return !(aR < bL || bR < aL || aB < bT || bB < aT);
        });
        if (hasOverlap) continue;
      }

      obstacles.push(newObstacle);
      placed++;
      ok = true;
      break;
    }
    if (!ok) {
      // 放不下更多障碍，提前结束
      break;
    }
  }

  return obstacles;
}

/**
 * 检查点是否在任何障碍物内
 * @param {number} px - 点 x 坐标
 * @param {number} py - 点 y 坐标
 * @param {Array} obstacles - 障碍物数组
 * @returns {boolean} 是否在障碍物内
 */
export function isPointInObstacles(px, py, obstacles) {
  return obstacles.some(obs =>
    px >= obs.x && px <= obs.x + obs.w &&
    py >= obs.y && py <= obs.y + obs.h
  );
}
