// Voronoi 骨架构建（裁剪+避障）
// 保持与原逻辑一致（功能等价）
import { Delaunay } from 'd3-delaunay';
import {
  extractAllObstacleVertices,
  getBoundaryVertices,
  lineIntersectsObstacleWithTurf,
} from '../obstacleGeometry.js';
import { isPointInObstacles } from '../obstacleGeneration.js';
import {
  createSpatialIndex,
  getPotentialObstacles,
  getObstaclesAlongLineDDA,
} from '../spatialIndex.js';

export function buildVoronoiSkeleton(
  width,
  height,
  obstacles,
  options = { useSpatialIndex: true },
) {
  // 计时：提取顶点/边界
  const tExtract0 = performance?.now ? performance.now() : Date.now();
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];
  const tExtract1 = performance?.now ? performance.now() : Date.now();
  if (allVertices.length < 3) {
    return { nodes: [], edges: [], triangles: [], delaunay: null };
  }

  const pts = allVertices.map((v) => [v.x, v.y]);
  // 计时：Delaunay 构建
  const tDel0 = performance?.now ? performance.now() : Date.now();
  const delaunay = Delaunay.from(pts);
  const tDel1 = performance?.now ? performance.now() : Date.now();

  // 标记自由三角形 & 计算外接圆心
  const triFree = [];
  const centers = [];
  // 计时：标记自由三角形并计算圆心
  const tNode0 = performance?.now ? performance.now() : Date.now();
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t];
    const b = delaunay.triangles[t + 1];
    const c = delaunay.triangles[t + 2];
    const A = allVertices[a];
    const B = allVertices[b];
    const C = allVertices[c];
    const cx = (A.x + B.x + C.x) / 3;
    const cy = (A.y + B.y + C.y) / 3;
    triFree.push(!isPointInObstacles(cx, cy, obstacles));
    centers.push(computeCircumcenter(A.x, A.y, B.x, B.y, C.x, C.y));
  }
  const tNode1 = performance?.now ? performance.now() : Date.now();

  const edges = [];
  const usedNodes = new Map();
  const nodes = [];
  const addNode = (p) => {
    const key = `${Math.round(p.x * 1000)}-${Math.round(p.y * 1000)}`;
    if (usedNodes.has(key)) return usedNodes.get(key);
    const idx =
      nodes.push({
        id: `L0-V${nodes.length}`,
        x: p.x,
        y: p.y,
        layer: 0,
        source: 'voronoi',
      }) - 1;
    usedNodes.set(key, idx);
    return idx;
  };

  const bbox = { xmin: 0, ymin: 0, xmax: width, ymax: height };
  const { halfedges } = delaunay;
  // 空间索引：减少穿障检测次数（功能等价，性能优化）
  const useSI = options && options.useSpatialIndex !== false;
  const profile = {
    algorithm: 'voronoi',
    useSpatialIndex: useSI,
    indexBuildMs: 0,
    edgesChecked: 0,
    candidatesAccum: 0,
    obstaclesTotal: obstacles.length,
    // 新增细分计时
    tExtractMs: Math.max(0, Math.round(tExtract1 - tExtract0)),
    tDelaunayMs: Math.max(0, Math.round(tDel1 - tDel0)),
    tNodeBuildMs: Math.max(0, Math.round(tNode1 - tNode0)),
    tEdgeIterMs: 0,
    tPoolQueryMs: 0,
    tLosMs: 0,
    losChecks: 0,
    losFastReject: 0,
  };
  let sIndex = null;
  if (useSI) {
    const t0 = performance?.now ? performance.now() : Date.now();
    sIndex = createSpatialIndex(width, height, obstacles, options?.cellSize);
    const t1 = performance?.now ? performance.now() : Date.now();
    profile.indexBuildMs = Math.max(0, Math.round(t1 - t0));
  }
  // 计时：边遍历（不含候选查询与穿障，将在末尾扣除）
  const tIter0 = performance?.now ? performance.now() : Date.now();
  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp < 0 || e >= opp) continue;
    const tA = Math.floor(e / 3);
    const tB = Math.floor(opp / 3);
    if (!triFree[tA] || !triFree[tB]) continue;

    const P = centers[tA];
    const Q = centers[tB];
    if (
      !P ||
      !Q ||
      !isFinite(P.x) ||
      !isFinite(P.y) ||
      !isFinite(Q.x) ||
      !isFinite(Q.y)
    )
      continue;
    // 额外过滤：外接圆心不能落在障碍内
    if (
      isPointInObstacles(P.x, P.y, obstacles) ||
      isPointInObstacles(Q.x, Q.y, obstacles)
    )
      continue;

    const clipped = clipSegmentToBox(P, Q, bbox);
    if (!clipped) continue;
    const [S, T] = clipped;

    let blocked = false;
    // 候选查询（优先 DDA 沿线格子遍历）
    const tPool0 = performance?.now ? performance.now() : Date.now();
    let pool;
    if (useSI) {
      const poolA = getObstaclesAlongLineDDA(sIndex, S.x, S.y, T.x, T.y);
      const poolB = getPotentialObstacles(sIndex, S.x, S.y, T.x, T.y);
      const seenIds = new Set();
      pool = [];
      if (Array.isArray(poolA)) {
        for (const ob of poolA) {
          const id = ob.id != null ? ob.id : ob;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            pool.push(ob);
          }
        }
      }
      if (Array.isArray(poolB)) {
        for (const ob of poolB) {
          const id = ob.id != null ? ob.id : ob;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            pool.push(ob);
          }
        }
      }
    } else {
      pool = obstacles;
    }
    const tPool1 = performance?.now ? performance.now() : Date.now();
    profile.tPoolQueryMs += tPool1 - tPool0;
    profile.edgesChecked += 1;
    profile.candidatesAccum += pool.length;
    // 穿障检测
    const tLos0 = performance?.now ? performance.now() : Date.now();
    for (const obs of pool) {
      profile.losChecks += 1;
      if (lineIntersectsObstacleWithTurf(S.x, S.y, T.x, T.y, obs, 0.5)) {
        blocked = true;
        break;
      }
    }
    const tLos1 = performance?.now ? performance.now() : Date.now();
    profile.tLosMs += tLos1 - tLos0;
    if (blocked) continue;

    const u = addNode(S);
    const v = addNode(T);
    const cost = Math.hypot(S.x - T.x, S.y - T.y);
    edges.push({ from: nodes[u].id, to: nodes[v].id, cost });
  }

  const tIter1 = performance?.now ? performance.now() : Date.now();
  // 边遍历净耗时（不含候选查询与穿障）
  profile.tEdgeIterMs = Math.max(
    0,
    Math.round(tIter1 - tIter0 - profile.tPoolQueryMs - profile.tLosMs),
  );
  profile.tPoolQueryMs = Math.max(0, Math.round(profile.tPoolQueryMs));
  profile.tLosMs = Math.max(0, Math.round(profile.tLosMs));

  const nodeDelaunay =
    nodes.length > 0 ? Delaunay.from(nodes.map((n) => [n.x, n.y])) : null;
  return { nodes, edges, triangles: [], delaunay: nodeDelaunay, profile };
}

// === 内部工具 ===
function computeCircumcenter(ax, ay, bx, by, cx, cy) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) {
    return { x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3 };
  }
  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;
  return { x: ux, y: uy };
}

function clip(vi, qi, t0, t1) {
  const r = qi / vi;
  if (vi < 0) {
    if (r > t1) return null;
    if (r > t0) t0 = r;
  } else {
    if (r < t0) return null;
    if (r < t1) t1 = r;
  }
  return [t0, t1];
}

function clipSegmentToBox(P, Q, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = Q.x - P.x;
  const dy = Q.y - P.y;
  const p = [-dx, dx, -dy, dy];
  const q = [P.x - box.xmin, box.xmax - P.x, P.y - box.ymin, box.ymax - P.y];
  for (let i = 0; i < 4; i++) {
    const res =
      p[i] === 0 ? (q[i] < 0 ? null : [t0, t1]) : clip(p[i], q[i], t0, t1);
    if (res === null) return null;
    [t0, t1] = res;
  }
  const S = { x: P.x + t0 * dx, y: P.y + t0 * dy };
  const T = { x: P.x + t1 * dx, y: P.y + t1 * dy };
  return [S, T];
}
