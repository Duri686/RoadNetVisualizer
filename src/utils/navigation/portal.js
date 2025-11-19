// Portal 中点网络
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { Delaunay } from 'd3-delaunay';
import { extractAllObstacleVertices, getBoundaryVertices, lineIntersectsObstacleWithTurf } from '../obstacleGeometry.js';
import { isPointInObstacles } from '../obstacleGeneration.js';
import { createSpatialIndex, getPotentialObstacles, getObstaclesAlongLineDDA } from '../spatialIndex.js';

export function buildPortalNetwork(width, height, obstacles, options = { useSpatialIndex: true }) {
  // 计时：提取顶点/边界
  const tExtract0 = performance?.now ? performance.now() : Date.now();
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];
  const tExtract1 = performance?.now ? performance.now() : Date.now();
  if (allVertices.length < 3) {
    return { nodes: [], edges: [], triangles: [], delaunay: null };
  }
  const pts = allVertices.map(v => [v.x, v.y]);
  // 计时：Delaunay 构建
  const tDel0 = performance?.now ? performance.now() : Date.now();
  const delaunay = Delaunay.from(pts);
  const tDel1 = performance?.now ? performance.now() : Date.now();

  // 标记三角形是否自由
  const triFree = [];
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t];
    const b = delaunay.triangles[t + 1];
    const c = delaunay.triangles[t + 2];
    const pA = allVertices[a];
    const pB = allVertices[b];
    const pC = allVertices[c];
    const cx = (pA.x + pB.x + pC.x) / 3;
    const cy = (pA.y + pB.y + pC.y) / 3;
    triFree.push(!isPointInObstacles(cx, cy, obstacles));
  }

  const next = (e) => (e % 3 === 2 ? e - 2 : e + 1);

  const nodeMap = new Map();
  const nodes = [];
  const triPortals = new Map();
  // 计时：节点生成（边中点）
  const tNode0 = performance?.now ? performance.now() : Date.now();
  for (let e = 0; e < delaunay.halfedges.length; e++) {
    const opp = delaunay.halfedges[e];
    const i = delaunay.triangles[e];
    const j = delaunay.triangles[next(e)];
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const p1 = allVertices[a];
    const p2 = allVertices[b];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    if (isPointInObstacles(mx, my, obstacles)) continue;

    if (opp < 0) {
      const t = Math.floor(e / 3);
      if (!triFree[t]) continue;
      const keyB = `${a}-${b}-B`;
      if (nodeMap.has(keyB)) continue;
      const node = { id: `L0-P${nodes.length}`, x: mx, y: my, layer: 0, source: 'portal' };
      const idx = nodes.push(node) - 1;
      nodeMap.set(keyB, idx);
      const arr = triPortals.get(t) || []; arr.push(idx); triPortals.set(t, arr);
    } else if (e < opp) {
      const tA = Math.floor(e / 3);
      const tB = Math.floor(opp / 3);
      if (!triFree[tA] || !triFree[tB]) continue;
      const key = `${a}-${b}`;
      if (nodeMap.has(key)) continue;
      const node = { id: `L0-P${nodes.length}`, x: mx, y: my, layer: 0, source: 'portal' };
      const idx = nodes.push(node) - 1;
      nodeMap.set(key, idx);
      const arrA = triPortals.get(tA) || []; arrA.push(idx); triPortals.set(tA, arrA);
      const arrB = triPortals.get(tB) || []; arrB.push(idx); triPortals.set(tB, arrB);
    }
  }

  const tNode1 = performance?.now ? performance.now() : Date.now();
  const edges = [];
  const useSI = options && options.useSpatialIndex !== false;
  const profile = {
    algorithm: 'portal',
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
    losFastReject: 0
  };
  let sIndex = null;
  if (useSI) {
    const t0 = performance?.now ? performance.now() : Date.now();
    sIndex = createSpatialIndex(width, height, obstacles, options?.cellSize);
    const t1 = performance?.now ? performance.now() : Date.now();
    profile.indexBuildMs = Math.max(0, Math.round(t1 - t0));
  }
  // 计时：边连通遍历
  const tIter0 = performance?.now ? performance.now() : Date.now();
  const addEdge = (u, v) => {
    if (u === v) return;
    const n1 = nodes[u]; const n2 = nodes[v];
    // 候选查询（优先 DDA 沿线格子遍历）
    const tPool0 = performance?.now ? performance.now() : Date.now();
    let pool;
    if (useSI) {
      pool = getObstaclesAlongLineDDA(sIndex, n1.x, n1.y, n2.x, n2.y);
      if (!pool || pool.length === 0) pool = getPotentialObstacles(sIndex, n1.x, n1.y, n2.x, n2.y);
    } else {
      pool = obstacles;
    }
    const tPool1 = performance?.now ? performance.now() : Date.now();
    profile.tPoolQueryMs += (tPool1 - tPool0);
    profile.edgesChecked += 1;
    profile.candidatesAccum += pool.length;
    // 穿障检测
    const tLos0 = performance?.now ? performance.now() : Date.now();
    for (const obs of pool) {
      profile.losChecks += 1;
      if (lineIntersectsObstacleWithTurf(n1.x, n1.y, n2.x, n2.y, obs)) return;
    }
    const tLos1 = performance?.now ? performance.now() : Date.now();
    profile.tLosMs += (tLos1 - tLos0);
    const cost = Math.hypot(n1.x - n2.x, n1.y - n2.y);
    edges.push({ from: n1.id, to: n2.id, cost });
  };
  triPortals.forEach(idxList => {
    for (let i = 0; i < idxList.length; i++) {
      for (let j = i + 1; j < idxList.length; j++) {
        addEdge(idxList[i], idxList[j]);
      }
    }
  });
  const tIter1 = performance?.now ? performance.now() : Date.now();
  profile.tEdgeIterMs = Math.max(0, Math.round((tIter1 - tIter0) - profile.tPoolQueryMs - profile.tLosMs));
  profile.tPoolQueryMs = Math.max(0, Math.round(profile.tPoolQueryMs));
  profile.tLosMs = Math.max(0, Math.round(profile.tLosMs));

  const portalDelaunay = nodes.length > 0 ? Delaunay.from(nodes.map(n => [n.x, n.y])) : null;
  return { nodes, edges, triangles: [], delaunay: portalDelaunay, profile };
}
