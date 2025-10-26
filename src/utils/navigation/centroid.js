// 质心自由空间网络构建
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { Delaunay } from 'd3-delaunay';
import { extractAllObstacleVertices, getBoundaryVertices, lineIntersectsObstacleWithTurf } from '../obstacleGeometry.js';
import { isPointInObstacles } from '../obstacleGeneration.js';
import { createSpatialIndex, getPotentialObstacles, getObstaclesAlongLineDDA, getPotentialObstaclesForPoint } from '../spatialIndex.js';

export function buildCentroidFreeSpaceNetwork(width, height, obstacles, options = { useSpatialIndex: true }) {
  // 计时：提取顶点/边界
  const tExtract0 = performance?.now ? performance.now() : Date.now();
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];
  const tExtract1 = performance?.now ? performance.now() : Date.now();

  if (allVertices.length < 3) {
    return { nodes: [], edges: [], vertices: allVertices, triangles: [], delaunay: null };
  }

  // 计时：Delaunay 构建
  const pts = allVertices.map(v => [v.x, v.y]);
  const tDel0 = performance?.now ? performance.now() : Date.now();
  const delaunay = Delaunay.from(pts);
  const tDel1 = performance?.now ? performance.now() : Date.now();

  const triangleIndexToNodeIndex = new Map();
  const nodes = [];
  const triangles = [];
  // 若使用空间索引，提前构建用于节点可行性判定
  const useSI = options && options.useSpatialIndex !== false;
  let sIndex = null; let earlyIndexBuildMs = 0;
  if (useSI) {
    const t0 = performance?.now ? performance.now() : Date.now();
    sIndex = createSpatialIndex(width, height, obstacles);
    const t1 = performance?.now ? performance.now() : Date.now();
    earlyIndexBuildMs = Math.max(0, Math.round(t1 - t0));
  }
  // 计时：节点生成与过滤
  const tNode0 = performance?.now ? performance.now() : Date.now();
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t];
    const b = delaunay.triangles[t + 1];
    const c = delaunay.triangles[t + 2];
    const pA = allVertices[a];
    const pB = allVertices[b];
    const pC = allVertices[c];
    const cx = (pA.x + pB.x + pC.x) / 3;
    const cy = (pA.y + pB.y + pC.y) / 3;
    // 使用索引的点内快速判定
    if (sIndex) {
      const pool = getPotentialObstaclesForPoint(sIndex, cx, cy, 0);
      let inside = false;
      for (let k = 0; k < pool.length; k++) {
        const ob = pool[k];
        if (cx >= ob.x && cx <= ob.x + ob.w && cy >= ob.y && cy <= ob.y + ob.h) { inside = true; break; }
      }
      if (inside) continue;
    } else {
      if (isPointInObstacles(cx, cy, obstacles)) continue;
    }
    const node = { id: `L0-N${nodes.length}`, x: cx, y: cy, layer: 0, source: 'centroid' };
    const nodeIndex = nodes.push(node) - 1;
    triangleIndexToNodeIndex.set(t / 3, nodeIndex);
    triangles.push([a, b, c]);
  }
  const tNode1 = performance?.now ? performance.now() : Date.now();

  const edges = [];
  // profiling 与空间索引
  const profile = {
    algorithm: 'centroid',
    useSpatialIndex: useSI,
    indexBuildMs: earlyIndexBuildMs,
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
    losFastReject: 0
  };
  // sIndex 已在节点阶段构建（若启用）
  const seen = new Set();
  const { halfedges } = delaunay;
  // 计时：边遍历（不含候选查询与穿障，将在末尾扣除）
  const tIter0 = performance?.now ? performance.now() : Date.now();
  for (let e = 0; e < halfedges.length; e++) {
    const opp = halfedges[e];
    if (opp < 0) continue;
    if (e < opp) {
      const tA = Math.floor(e / 3);
      const tB = Math.floor(opp / 3);
      const nA = triangleIndexToNodeIndex.get(tA);
      const nB = triangleIndexToNodeIndex.get(tB);
      if (nA === undefined || nB === undefined) continue;

      const key = nA < nB ? `${nA}-${nB}` : `${nB}-${nA}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const p1 = nodes[nA];
      const p2 = nodes[nB];

      // 质心连线不能穿过障碍
      let intersects = false;
      // 计时：索引候选查询
      const tPool0 = performance?.now ? performance.now() : Date.now();
      let pool;
      if (profile.useSpatialIndex) {
        pool = getObstaclesAlongLineDDA(sIndex, p1.x, p1.y, p2.x, p2.y);
        if (!pool || pool.length === 0) pool = getPotentialObstacles(sIndex, p1.x, p1.y, p2.x, p2.y);
      } else {
        pool = obstacles;
      }
      const tPool1 = performance?.now ? performance.now() : Date.now();
      profile.tPoolQueryMs += (tPool1 - tPool0);
      profile.edgesChecked += 1;
      profile.candidatesAccum += pool.length;
      // 计时：穿障检测
      const tLos0 = performance?.now ? performance.now() : Date.now();
      for (const obs of pool) {
        profile.losChecks += 1;
        if (lineIntersectsObstacleWithTurf(p1.x, p1.y, p2.x, p2.y, obs)) { intersects = true; break; }
      }
      const tLos1 = performance?.now ? performance.now() : Date.now();
      profile.tLosMs += (tLos1 - tLos0);
      if (intersects) continue;

      const cost = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      edges.push({ from: p1.id, to: p2.id, cost });
    }
  }
  const tIter1 = performance?.now ? performance.now() : Date.now();
  // 边遍历净耗时（不含候选查询与穿障）
  profile.tEdgeIterMs = Math.max(0, Math.round((tIter1 - tIter0) - profile.tPoolQueryMs - profile.tLosMs));
  profile.tPoolQueryMs = Math.max(0, Math.round(profile.tPoolQueryMs));
  profile.tLosMs = Math.max(0, Math.round(profile.tLosMs));

  // 末尾无需再构建基于节点的 Delaunay（减少额外开销）
  return { nodes, edges, triangles, delaunay: null, profile };
}
