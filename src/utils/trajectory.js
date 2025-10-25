// 轨迹等距采样与姿态生成（x, y, heading, curvature, s）
// 此实现保持与原逻辑一致，仅新增工具函数，不影响现有渲染。

/**
 * 等距采样折线，生成包含 heading/curvature 的路标点集合
 * @param {Array<{x:number,y:number}>} path 折线路径（世界坐标）
 * @param {number} step 采样步长（世界坐标单位）
 * @returns {Array<{x:number,y:number,heading:number,curvature:number,s:number}>}
 */
export function sampleTrajectory(path, step = 1.0) {
  const res = [];
  if (!Array.isArray(path) || path.length === 0 || step <= 0) return res;

  // 预计算每段长度与累计里程
  const segLen = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const L = Math.max(0, segLen(a, b));
    segs.push({ a, b, L });
    total += L;
  }
  if (total === 0) {
    const p = path[0];
    res.push({ x: p.x, y: p.y, heading: 0, curvature: 0, s: 0 });
    return res;
  }

  // 沿路径等距采样
  let s = 0;
  let segIdx = 0;
  let segS = 0; // 当前段内的已走距离
  const emit = (x, y, heading, sVal) => {
    res.push({ x, y, heading, curvature: 0, s: sVal });
  };

  const dirHeading = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  // 首点
  emit(path[0].x, path[0].y, dirHeading(path[0], path[1] || path[0]), 0);

  while (s + step <= total) {
    let target = s + step;
    // 向前推进到目标里程所在的段
    while (segIdx < segs.length && (segS + segs[segIdx].L) < target) {
      segS += segs[segIdx].L;
      segIdx++;
    }
    if (segIdx >= segs.length) break;
    const seg = segs[segIdx];
    const remain = target - segS;
    const t = seg.L > 0 ? remain / seg.L : 0;
    const x = seg.a.x + (seg.b.x - seg.a.x) * t;
    const y = seg.a.y + (seg.b.y - seg.a.y) * t;
    const hd = dirHeading(seg.a, seg.b);
    s = target;
    emit(x, y, hd, s);
  }

  // 末点
  const last = path[path.length - 1];
  emit(last.x, last.y, dirHeading(path[path.length - 2] || last, last), total);

  // 用离散微分计算曲率（heading 随 s 的变化率）
  const wrap = (ang) => {
    // 将角度差规范到 [-pi, pi]
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    return ang;
  };
  for (let i = 1; i < res.length - 1; i++) {
    const dth = wrap(res[i + 1].heading - res[i - 1].heading);
    const ds = Math.max(1e-6, res[i + 1].s - res[i - 1].s);
    res[i].curvature = dth / ds;
  }
  if (res.length >= 2) {
    res[0].curvature = res[1].curvature;
    res[res.length - 1].curvature = res[res.length - 2].curvature;
  }
  return res;
}
