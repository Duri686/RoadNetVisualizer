// 质心自由空间网络构建
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { Delaunay } from 'd3-delaunay';
import { extractAllObstacleVertices, getBoundaryVertices, lineIntersectsObstacleWithTurf } from '../obstacleGeometry.js';
import { isPointInObstacles } from '../obstacleGeneration.js';
import { createSpatialIndex, getPotentialObstacles } from '../spatialIndex.js';

export function buildCentroidFreeSpaceNetwork(width, height, obstacles, options = { useSpatialIndex: true }) {
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];

  if (allVertices.length < 3) {
    return { nodes: [], edges: [], vertices: allVertices, triangles: [], delaunay: null };
  }

  const pts = allVertices.map(v => [v.x, v.y]);
  const delaunay = Delaunay.from(pts);

  const triangleIndexToNodeIndex = new Map();
  const nodes = [];
  const triangles = [];
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t];
    const b = delaunay.triangles[t + 1];
    const c = delaunay.triangles[t + 2];
    const pA = allVertices[a];
    const pB = allVertices[b];
    const pC = allVertices[c];
    const cx = (pA.x + pB.x + pC.x) / 3;
    const cy = (pA.y + pB.y + pC.y) / 3;
    if (isPointInObstacles(cx, cy, obstacles)) continue;
    const node = { id: `L0-N${nodes.length}`, x: cx, y: cy, layer: 0, source: 'centroid' };
    const nodeIndex = nodes.push(node) - 1;
    triangleIndexToNodeIndex.set(t / 3, nodeIndex);
    triangles.push([a, b, c]);
  }

  const edges = [];
  // profiling 与空间索引
  const profile = { algorithm: 'centroid', useSpatialIndex: options && options.useSpatialIndex !== false, indexBuildMs: 0, edgesChecked: 0, candidatesAccum: 0, obstaclesTotal: obstacles.length };
  let sIndex = null;
  if (profile.useSpatialIndex) {
    const t0 = performance?.now ? performance.now() : Date.now();
    sIndex = createSpatialIndex(width, height, obstacles);
    const t1 = performance?.now ? performance.now() : Date.now();
    profile.indexBuildMs = Math.max(0, Math.round(t1 - t0));
  }
  const seen = new Set();
  const { halfedges } = delaunay;
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
      const pool = profile.useSpatialIndex ? getPotentialObstacles(sIndex, p1.x, p1.y, p2.x, p2.y) : obstacles;
      profile.edgesChecked += 1;
      profile.candidatesAccum += pool.length;
      for (const obs of pool) {
        if (lineIntersectsObstacleWithTurf(p1.x, p1.y, p2.x, p2.y, obs)) { intersects = true; break; }
      }
      if (intersects) continue;

      const cost = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      edges.push({ from: p1.id, to: p2.id, cost });
    }
  }

  const centroidDelaunay = nodes.length > 0 ? Delaunay.from(nodes.map(n => [n.x, n.y])) : null;
  return { nodes, edges, triangles, delaunay: centroidDelaunay, profile };
}
