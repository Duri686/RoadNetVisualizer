// 障碍顶点网络（Delaunay + 避障过滤）
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { Delaunay } from 'd3-delaunay';
import { euclideanDistance, isPointNearObstacleVertex, extractAllObstacleVertices, getBoundaryVertices, lineIntersectsObstacleWithTurf } from '../obstacleGeometry.js';

export function buildObstacleConnectionNetwork(width, height, obstacles) {
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];

  if (allVertices.length < 3) {
    return { nodes: [], edges: [], vertices: allVertices };
  }

  const points = allVertices.map(v => [v.x, v.y]);
  const delaunay = Delaunay.from(points);

  const nodes = allVertices.map((v, i) => ({
    id: `L0-N${i}`,
    x: v.x,
    y: v.y,
    layer: 0,
    vertexType: v.type,
    obstacleId: v.obstacleId
  }));

  const edges = [];
  const edgeSet = new Set();
  let totalDelaunayEdges = 0;
  const filterReasons = { sameObstacleSkipped: 0, intersected: 0, accepted: 0 };

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const t0 = delaunay.triangles[i];
    const t1 = delaunay.triangles[i + 1];
    const t2 = delaunay.triangles[i + 2];
    const triEdges = [[t0, t1], [t1, t2], [t2, t0]];

    triEdges.forEach(([from, to]) => {
      const [a, b] = from < to ? [from, to] : [to, from];
      const edgeKey = `${a}-${b}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        totalDelaunayEdges++;

        const n1 = nodes[a];
        const n2 = nodes[b];
        const distance = euclideanDistance(n1, n2);

        let intersectsObstacle = false;
        for (const obs of obstacles) {
          const sameObstacle = n1.obstacleId === obs.id && n2.obstacleId === obs.id;
          if (sameObstacle) { filterReasons.sameObstacleSkipped++; continue; }
          const p1IsVertex = isPointNearObstacleVertex(n1.x, n1.y, obs);
          const p2IsVertex = isPointNearObstacleVertex(n2.x, n2.y, obs);
          if (p1IsVertex || p2IsVertex) { continue; }
          if (lineIntersectsObstacleWithTurf(n1.x, n1.y, n2.x, n2.y, obs)) {
            intersectsObstacle = true; filterReasons.intersected++; break;
          }
        }

        if (!intersectsObstacle) {
          filterReasons.accepted++;
          edges.push({ from: n1.id, to: n2.id, cost: distance, fromIndex: a, toIndex: b });
        }
      }
    });
  }

  console.log(`Layer 0: Delaunay剖分完成，生成 ${nodes.length} 个节点`);
  console.log(`  📊 边统计:`);
  console.log(`    - Delaunay生成的边: ${totalDelaunayEdges} 条`);
  console.log(`    - ✅ 保留的有效边: ${edges.length} 条`);
  console.log(`    - ❌ 过滤的相交边: ${filterReasons.intersected} 条`);
  console.log(`  🔍 过滤细节:`);
  console.log(`    - 同一障碍物内部的边（跳过检测）: ${filterReasons.sameObstacleSkipped} 次`);
  console.log(`    - 与障碍物相交的边（被过滤）: ${filterReasons.intersected} 条`);

  return { nodes, edges, vertices: allVertices, delaunay };
}
