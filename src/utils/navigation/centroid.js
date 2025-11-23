// 质心自由空间网络构建
// 此修改保持与原逻辑一致，并在末尾增加一个可选的“额外连边”步骤（由 NavConfig.graph.extraEdges 控制）。
import { Delaunay } from 'd3-delaunay';
import {
  extractAllObstacleVertices,
  getBoundaryVertices,
  lineIntersectsObstacleWithTurf,
} from '../obstacleGeometry.js';
import {
  isPointInObstacles,
  isPointInObstaclesMargin,
} from '../obstacleGeneration.js';
import {
  createSpatialIndex,
  getPotentialObstacles,
  getObstaclesAlongLineDDA,
  getPotentialObstaclesForPoint,
} from '../spatialIndex.js';
import { NavConfig } from '../../config/NavConfig.js';

// 在局部范围内为质心节点补充额外连边（可选），以提高连通性
function addExtraCentroidEdges(nodes, edges, obstacles, sIndex, safetyMargin) {
  const graphCfg =
    NavConfig && NavConfig.graph && NavConfig.graph.extraEdges
      ? NavConfig.graph.extraEdges
      : null;
  if (!graphCfg || graphCfg.enabled === false) {
    return;
  }

  const maxDegree =
    typeof graphCfg.maxDegreePerNode === 'number' &&
    graphCfg.maxDegreePerNode > 0
      ? graphCfg.maxDegreePerNode
      : 6;
  const minDegree =
    typeof graphCfg.minDegreePerNode === 'number' &&
    graphCfg.minDegreePerNode >= 0
      ? graphCfg.minDegreePerNode
      : 2;
  const lengthFactor =
    typeof graphCfg.maxLengthFactor === 'number' && graphCfg.maxLengthFactor > 0
      ? graphCfg.maxLengthFactor
      : 2.5;

  if (!nodes || nodes.length === 0 || maxDegree <= 0 || lengthFactor <= 0) {
    return;
  }

  const idToIndex = new Map();
  const neighbors = [];
  const degree = [];
  for (let i = 0; i < nodes.length; i++) {
    idToIndex.set(nodes[i].id, i);
    neighbors.push(new Set());
    degree.push(0);
  }

  // 基于现有边统计平均边长，并构建邻接信息
  let lengthSum = 0;
  let lengthCount = 0;
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const a = idToIndex.get(edge.from);
    const b = idToIndex.get(edge.to);
    if (typeof a !== 'number' || typeof b !== 'number' || a === b) continue;

    if (!neighbors[a].has(b)) {
      neighbors[a].add(b);
      neighbors[b].add(a);
      degree[a] = neighbors[a].size;
      degree[b] = neighbors[b].size;
    }

    const p1 = nodes[a];
    const p2 = nodes[b];
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    lengthSum += dist;
    lengthCount += 1;
  }

  if (lengthCount === 0) {
    return;
  }

  const baseLen = lengthSum / lengthCount;
  const maxLen = baseLen * lengthFactor;
  const useSpatialIndex = !!sIndex;

  for (let i = 0; i < nodes.length; i++) {
    if (degree[i] >= maxDegree) continue;
    if (degree[i] >= minDegree) continue;

    const p1 = nodes[i];

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      if (neighbors[i].has(j)) continue;
      if (degree[j] >= maxDegree) continue;

      const p2 = nodes[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxLen) continue;

      let pool;
      if (useSpatialIndex) {
        pool = getObstaclesAlongLineDDA(sIndex, p1.x, p1.y, p2.x, p2.y);
        if (!pool || pool.length === 0) {
          pool = getPotentialObstacles(sIndex, p1.x, p1.y, p2.x, p2.y);
        }
      } else {
        pool = obstacles;
      }

      let intersects = false;
      if (pool && pool.length > 0) {
        for (let k = 0; k < pool.length; k++) {
          const obs = pool[k];
          if (
            lineIntersectsObstacleWithTurf(
              p1.x,
              p1.y,
              p2.x,
              p2.y,
              obs,
              safetyMargin,
            )
          ) {
            intersects = true;
            break;
          }
        }
      }

      if (intersects) continue;

      edges.push({ from: p1.id, to: p2.id, cost: dist });

      neighbors[i].add(j);
      neighbors[j].add(i);
      degree[i] = neighbors[i].size;
      degree[j] = neighbors[j].size;

      if (degree[i] >= maxDegree) {
        break;
      }
    }
  }
}

export function buildCentroidFreeSpaceNetwork(
  width,
  height,
  obstacles,
  options = { useSpatialIndex: true },
  fixedPoints = [],
) {
  // 计时：提取顶点/边界
  const tExtract0 = performance?.now ? performance.now() : Date.now();
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);

  // 将固定点加入顶点列表
  // 注意：固定点放在最后，方便索引判断
  const allVertices = [
    ...obstacleVertices,
    ...boundaryVertices,
    ...fixedPoints,
  ];
  const fixedPointStartIndex =
    obstacleVertices.length + boundaryVertices.length;

  const tExtract1 = performance?.now ? performance.now() : Date.now();

  if (allVertices.length < 3) {
    return {
      nodes: [],
      edges: [],
      vertices: allVertices,
      triangles: [],
      delaunay: null,
    };
  }

  // 计时：Delaunay 构建
  const pts = allVertices.map((v) => [v.x, v.y]);
  const tDel0 = performance?.now ? performance.now() : Date.now();
  const delaunay = Delaunay.from(pts);
  const tDel1 = performance?.now ? performance.now() : Date.now();

  const triangleIndexToNodeIndex = new Map();
  const nodes = [];
  const triangles = [];
  // 若使用空间索引，提前构建用于节点可行性判定
  const useSI = options && options.useSpatialIndex !== false;
  let sIndex = null;
  let earlyIndexBuildMs = 0;
  if (useSI) {
    const t0 = performance?.now ? performance.now() : Date.now();
    sIndex = createSpatialIndex(width, height, obstacles);
    const t1 = performance?.now ? performance.now() : Date.now();
    earlyIndexBuildMs = Math.max(0, Math.round(t1 - t0));
  }

  // 安全距离配置
  const safetyMargin = 2.0;

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

    // 检查节点是否在障碍物内或太靠近障碍物
    // 使用索引的点内快速判定
    if (sIndex) {
      // Increase radius to handle edge cases where point is on cell boundary
      // Use safetyMargin for query radius to be safe
      const pool = getPotentialObstaclesForPoint(sIndex, cx, cy, safetyMargin);
      let inside = false;
      for (let k = 0; k < pool.length; k++) {
        const ob = pool[k];
        // Check with safety margin
        if (
          cx >= ob.x - safetyMargin &&
          cx <= ob.x + ob.w + safetyMargin &&
          cy >= ob.y - safetyMargin &&
          cy <= ob.y + ob.h + safetyMargin
        ) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
    } else {
      if (isPointInObstaclesMargin(cx, cy, obstacles, safetyMargin)) continue;
    }
    const node = {
      id: `L0-N${nodes.length}`,
      x: cx,
      y: cy,
      layer: 0,
      source: 'centroid',
    };
    const nodeIndex = nodes.push(node) - 1;
    triangleIndexToNodeIndex.set(t / 3, nodeIndex);
    triangles.push([a, b, c]);
  }

  // 处理固定点（Connectors）
  // 为每个固定点创建节点，并连接到其所在的三角形的质心
  const fixedPointNodeIndices = new Map(); // fixedPointIndex -> nodeIndex
  const edges = []; // Initialize edges here

  for (let i = 0; i < fixedPoints.length; i++) {
    const fp = fixedPoints[i];
    const vertexIndex = fixedPointStartIndex + i;

    // 创建固定点节点
    const node = {
      id: fp.id || `L0-FP${i}`,
      x: fp.x,
      y: fp.y,
      layer: 0,
      source: 'fixed-point',
      type: fp.type || 'fixed',
    };
    const nodeIndex = nodes.push(node) - 1;
    fixedPointNodeIndices.set(vertexIndex, nodeIndex);

    // 查找包含该顶点的所有三角形，并连接到其质心
    // 遍历所有三角形 (性能优化：对于大量三角形可能需要优化，但此处通常还好)
    for (let t = 0; t < delaunay.triangles.length; t += 3) {
      const a = delaunay.triangles[t];
      const b = delaunay.triangles[t + 1];
      const c = delaunay.triangles[t + 2];

      if (a === vertexIndex || b === vertexIndex || c === vertexIndex) {
        const triangleIndex = t / 3;
        const centroidNodeIndex = triangleIndexToNodeIndex.get(triangleIndex);

        if (centroidNodeIndex !== undefined) {
          // 创建连接边
          const centroidNode = nodes[centroidNodeIndex];
          const cost = Math.hypot(
            node.x - centroidNode.x,
            node.y - centroidNode.y,
          );

          // 添加边 (双向? 这里的 edges 是无向图列表，通常只需添加一次，渲染时视为线段)
          // 但为了路径规划，通常需要确保连通性。
          // 这里的 edges 结构是 {from, to, cost}
          edges.push({ from: node.id, to: centroidNode.id, cost });
        }
      }
    }
  }
  const tNode1 = performance?.now ? performance.now() : Date.now();

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
    losFastReject: 0,
    // 调试统计
    rejectedByIntersection: 0,
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
        if (!pool || pool.length === 0)
          pool = getPotentialObstacles(sIndex, p1.x, p1.y, p2.x, p2.y);
      } else {
        pool = obstacles;
      }
      const tPool1 = performance?.now ? performance.now() : Date.now();
      profile.tPoolQueryMs += tPool1 - tPool0;
      profile.edgesChecked += 1;
      profile.candidatesAccum += pool.length;
      // 计时：穿障检测
      const tLos0 = performance?.now ? performance.now() : Date.now();
      for (const obs of pool) {
        profile.losChecks += 1;
        // 使用 safetyMargin 进行碰撞检测
        if (
          lineIntersectsObstacleWithTurf(
            p1.x,
            p1.y,
            p2.x,
            p2.y,
            obs,
            safetyMargin,
          )
        ) {
          intersects = true;
          break;
        }
      }
      const tLos1 = performance?.now ? performance.now() : Date.now();
      profile.tLosMs += tLos1 - tLos0;
      if (intersects) {
        profile.rejectedByIntersection++;
        continue;
      }

      const cost = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      edges.push({ from: p1.id, to: p2.id, cost });
    }
  }
  const tIter1 = performance?.now ? performance.now() : Date.now();
  // 边遍历净耗时（不含候选查询与穿障）
  profile.tEdgeIterMs = Math.max(
    0,
    Math.round(tIter1 - tIter0 - profile.tPoolQueryMs - profile.tLosMs),
  );
  profile.tPoolQueryMs = Math.max(0, Math.round(profile.tPoolQueryMs));
  profile.tLosMs = Math.max(0, Math.round(profile.tLosMs));

  // 可选：在局部范围内为质心节点补充额外连边，提升连通性
  addExtraCentroidEdges(nodes, edges, obstacles, sIndex, safetyMargin);

  console.log(
    `[Centroid] Nodes: ${nodes.length}, Edges: ${edges.length}, Rejected(Intersect): ${profile.rejectedByIntersection}`,
  );

  // 末尾无需再构建基于节点的 Delaunay（减少额外开销）
  return { nodes, edges, triangles, delaunay: null, profile };
}
