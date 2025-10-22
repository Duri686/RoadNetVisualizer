/**
 * 图结构工具函数
 * 提供节点、边的构建和图算法
 */

import { euclideanDistance, lineIntersectsRectangle } from './geometryUtils.js';

/**
 * 构建节点之间的边
 * @param {Array} nodes - 节点数组
 * @param {Array} obstacles - 障碍物数组
 * @param {number} maxDistance - 最大连接距离
 */
export function buildEdges(nodes, obstacles, maxDistance) {
  const edges = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];

      const distance = euclideanDistance(n1, n2);

      // 距离过远，不连接
      if (distance > maxDistance) continue;

      // 检查连线是否穿过障碍物
      const intersectsObstacle = obstacles.some(obs =>
        lineIntersectsRectangle(n1.x, n1.y, n2.x, n2.y, obs)
      );

      if (!intersectsObstacle) {
        edges.push({
          from: n1.id,
          to: n2.id,
          cost: distance
        });
      }
    }
  }

  return edges;
}

/**
 * 验证图的连通性
 */
export function validateGraph(nodes, edges) {
  if (nodes.length === 0) return { valid: true, components: 0 };

  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, []));

  edges.forEach(e => {
    adjacency.get(e.from).push(e.to);
    adjacency.get(e.to).push(e.from);
  });

  const visited = new Set();
  let components = 0;

  function dfs(nodeId) {
    visited.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    });
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      dfs(n.id);
      components++;
    }
  });

  return {
    valid: components <= 1,
    components,
    connectivity: nodes.length > 0 ? visited.size / nodes.length : 0
  };
}
