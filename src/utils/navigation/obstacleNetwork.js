// 障碍顶点网络（Delaunay + 避障过滤）
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { Delaunay } from 'd3-delaunay';
import {
  euclideanDistance,
  isPointNearObstacleVertex,
  extractAllObstacleVertices,
  getBoundaryVertices,
  lineIntersectsObstacleWithTurf,
  getCollisionStats,
} from '../obstacleGeometry.js';
import {
  createSpatialIndex,
  getObstaclesAlongLineDDA,
  getPotentialObstacles,
} from '../spatialIndex.js';

export function buildObstacleConnectionNetwork(width, height, obstacles) {
  console.log(`🔷 [ObstacleNetwork] 开始构建障碍物顶点网络`);
  console.log(`  📏 地图尺寸: ${width} x ${height}`);
  console.log(`  🚧 障碍物数量: ${obstacles.length}`);

  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];

  console.log(`  📍 顶点统计:`);
  console.log(`    - 障碍物顶点: ${obstacleVertices.length} 个`);
  console.log(`    - 边界顶点: ${boundaryVertices.length} 个`);
  console.log(`    - 总顶点数: ${allVertices.length} 个`);

  if (allVertices.length < 3) {
    console.warn(`⚠️ 顶点数量不足3个，无法进行Delaunay三角剖分`);
    return { nodes: [], edges: [], vertices: allVertices };
  }

  const points = allVertices.map((v) => [v.x, v.y]);
  const delaunay = Delaunay.from(points);
  const triangleCount = delaunay.triangles.length / 3;

  console.log(`  🔺 Delaunay三角剖分完成:`);
  console.log(`    - 生成三角形数量: ${triangleCount} 个`);
  console.log(`    - 理论最大边数: ${triangleCount * 3} 条`);

  const nodes = allVertices.map((v, i) => ({
    id: `L0-N${i}`,
    x: v.x,
    y: v.y,
    layer: 0,
    vertexType: v.type,
    obstacleId: v.obstacleId,
  }));

  const edges = [];
  const edgeSet = new Set();
  let totalDelaunayEdges = 0;
  const filterReasons = { sameObstacleSkipped: 0, intersected: 0, accepted: 0 };
  // 空间索引：用于缩小每条边的候选障碍集合
  const sIndex = createSpatialIndex(width, height, obstacles);

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const t0 = delaunay.triangles[i];
    const t1 = delaunay.triangles[i + 1];
    const t2 = delaunay.triangles[i + 2];
    const triEdges = [
      [t0, t1],
      [t1, t2],
      [t2, t0],
    ];

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
        // 使用 DDA 沿线格子遍历 + 回退包围盒查询，显著减少候选
        let pool = getObstaclesAlongLineDDA(sIndex, n1.x, n1.y, n2.x, n2.y);
        if (!pool || pool.length === 0)
          pool = getPotentialObstacles(sIndex, n1.x, n1.y, n2.x, n2.y);
        for (const obs of pool) {
          const sameObstacle =
            n1.obstacleId === obs.id && n2.obstacleId === obs.id;
          if (sameObstacle) {
            filterReasons.sameObstacleSkipped++;
            continue;
          }
          const p1IsVertex = isPointNearObstacleVertex(n1.x, n1.y, obs);
          const p2IsVertex = isPointNearObstacleVertex(n2.x, n2.y, obs);
          if (p1IsVertex || p2IsVertex) {
            continue;
          }
          if (lineIntersectsObstacleWithTurf(n1.x, n1.y, n2.x, n2.y, obs)) {
            intersectsObstacle = true;
            filterReasons.intersected++;
            break;
          }
        }

        if (!intersectsObstacle) {
          filterReasons.accepted++;
          edges.push({
            from: n1.id,
            to: n2.id,
            cost: distance,
            fromIndex: a,
            toIndex: b,
          });
        }
      }
    });
  }

  const filteredCount = totalDelaunayEdges - edges.length;
  const filterRate =
    totalDelaunayEdges > 0
      ? ((filteredCount / totalDelaunayEdges) * 100).toFixed(1)
      : 0;

  console.log(`✅ [ObstacleNetwork] 构建完成！`);
  console.log(`  📊 最终统计:`);
  console.log(`    - 节点数量: ${nodes.length} 个`);
  console.log(`    - Delaunay原始边数: ${totalDelaunayEdges} 条`);
  console.log(
    `    - ✅ 保留有效边: ${edges.length} 条 (${(100 - filterRate).toFixed(
      1,
    )}%)`,
  );
  console.log(`    - ❌ 过滤相交边: ${filteredCount} 条 (${filterRate}%)`);
  console.log(`  🔍 过滤详情:`);
  console.log(
    `    - 同障碍物边（跳过检测）: ${filterReasons.sameObstacleSkipped} 次`,
  );
  console.log(`    - 相交边（已过滤）: ${filterReasons.intersected} 条`);
  console.log(`    - 通过检测（保留）: ${filterReasons.accepted} 条`);

  if (filterRate > 80) {
    console.warn(`⚠️ 过滤率过高(${filterRate}%)，可能存在以下问题：`);
    console.warn(`   1. 碰撞检测算法过于严格`);
    console.warn(`   2. 安全距离参数设置过大`);
    console.warn(`   3. 障碍物密度过高`);
  }

  // 输出碰撞检测统计
  const collisionStats = getCollisionStats();
  console.log(`  💥 碰撞检测统计:`);
  console.log(`    - 总检测次数: ${collisionStats.totalChecks} 次`);
  console.log(
    `    - 检测到碰撞: ${collisionStats.collisionsDetected} 次 (${collisionStats.collisionRate}%)`,
  );

  return { nodes, edges, vertices: allVertices, delaunay };
}
