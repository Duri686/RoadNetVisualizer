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
  // 指标埋点：接受率/尝试次数/退出原因/占用率估算/耗时
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let attemptsTotal = 0;
  let accepted = 0;
  let consecFail = 0;
  let maxConsecFail = 0;
  let exitReason = 'completed';
  let occupiedSum = 0; // 近似占用面积 (w+2p)*(h+2p)

  const minWH = Math.max(1, Math.min(width, height));
  const minSizeRatio = typeof opts.minSizeRatio === 'number' ? opts.minSizeRatio : 0.01; // 1%
  const maxSizeRatio = typeof opts.maxSizeRatio === 'number' ? opts.maxSizeRatio : 0.05; // 5%
  const avoidOverlap = opts.avoidOverlap !== false;
  const padding = typeof opts.padding === 'number' ? opts.padding : 2;
  const perAttempts = Math.max(1, opts.maxAttemptsPerObstacle || 30);

  const minSize = Math.max(2, Math.floor(minWH * minSizeRatio));
  const maxSize = Math.max(minSize + 1, Math.floor(minWH * maxSizeRatio));

  // 轻量网格索引（仅在避免重叠时启用）：将重叠判定从 O(N) 降为 O(常数)
  const grid = new Map(); // key: "ix,iy" -> Array<index>
  const cell = Math.max(8, Math.floor((minSize + maxSize) / 2));
  const put = (x, y, w, h, idx) => {
    const x0 = Math.floor(Math.max(0, x - padding) / cell);
    const x1 = Math.floor(Math.min(width, x + w + padding) / cell);
    const y0 = Math.floor(Math.max(0, y - padding) / cell);
    const y1 = Math.floor(Math.min(height, y + h + padding) / cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = `${ix},${iy}`;
        const a = grid.get(k); if (a) a.push(idx); else grid.set(k, [idx]);
      }
    }
  };
  const query = (x, y, w, h) => {
    const x0 = Math.floor(Math.max(0, x - padding) / cell);
    const x1 = Math.floor(Math.min(width, x + w + padding) / cell);
    const y0 = Math.floor(Math.max(0, y - padding) / cell);
    const y1 = Math.floor(Math.min(height, y + h + padding) / cell);
    const seen = new Set(); const out = [];
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const a = grid.get(`${ix},${iy}`); if (!a) continue;
        for (let t = 0; t < a.length; t++) { const id = a[t]; if (!seen.has(id)) { seen.add(id); out.push(id); } }
      }
    }
    return out;
  };

  let placed = 0;
  while (placed < obstacleCount) {
    let ok = false;
    for (let attempt = 0; attempt < perAttempts; attempt++) {
      attemptsTotal++;
      const w = rng.randomInt(minSize, Math.min(maxSize, width));
      const h = rng.randomInt(minSize, Math.min(maxSize, height));
      const x = rng.randomInt(0, Math.max(0, width - w));
      const y = rng.randomInt(0, Math.max(0, height - h));

      const newObstacle = { id: obstacles.length, x, y, w, h };

      if (avoidOverlap) {
        // 使用网格索引快速检查重叠
        const candIdx = query(newObstacle.x, newObstacle.y, newObstacle.w, newObstacle.h);
        let hasOverlap = false;
        for (let ci = 0; ci < candIdx.length; ci++) {
          const obs = obstacles[candIdx[ci]];
          const aL = newObstacle.x - padding;
          const aR = newObstacle.x + newObstacle.w + padding;
          const aT = newObstacle.y - padding;
          const aB = newObstacle.y + newObstacle.h + padding;
          const bL = obs.x;
          const bR = obs.x + obs.w;
          const bT = obs.y;
          const bB = obs.y + obs.h;
          if (!(aR < bL || bR < aL || aB < bT || bB < aT)) { hasOverlap = true; break; }
        }
        if (hasOverlap) continue;
      }

      obstacles.push(newObstacle);
      if (avoidOverlap) put(newObstacle.x, newObstacle.y, newObstacle.w, newObstacle.h, newObstacle.id);
      placed++;
      accepted++;
      consecFail = 0;
      occupiedSum += (newObstacle.w + 2 * padding) * (newObstacle.h + 2 * padding);
      ok = true;
      break;
    }
    if (!ok) {
      // 放不下更多障碍，提前结束
      consecFail++;
      if (consecFail > maxConsecFail) maxConsecFail = consecFail;
      exitReason = 'per-obstacle-attempts-exhausted';
      break;
    }
  }

  // 输出统计日志（不改变返回值）
  try {
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const used = Math.max(0, Math.round(t1 - t0));
    const area = Math.max(1, width * height);
    const avgOccupied = accepted > 0 ? (occupiedSum / accepted) : 0;
    const capacityEst = avgOccupied > 0 ? Math.floor(area / avgOccupied) : 0;
    const acceptRate = attemptsTotal > 0 ? (accepted / attemptsTotal) : 0;
    // 中文日志，便于性能观测
    console.log(
      `[Obstacles] 目标 ${obstacleCount} 个 | 已放置 ${placed} 个 | 尝试 ${attemptsTotal} 次 | 接受率 ${(acceptRate * 100).toFixed(1)}% | ` +
      `最大连续失败 ${maxConsecFail} | 退出原因 ${exitReason} | 近似平均占用 ${avgOccupied.toFixed(1)} px² | 估算容量≈ ${capacityEst} | 生成耗时 ${used} ms`
    );
  } catch (_) { /* 忽略日志异常 */ }

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
