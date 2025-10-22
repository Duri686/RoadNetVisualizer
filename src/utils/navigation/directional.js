// 方向性连接网络与方向工具
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { euclideanDistance, extractAllObstacleVertices, getBoundaryVertices } from '../obstacleGeometry.js';

export function getSearchDirection(vertexType) {
  const directions = {
    topLeft: { dx: -1, dy: -1 },
    topRight: { dx: 1, dy: -1 },
    bottomRight: { dx: 1, dy: 1 },
    bottomLeft: { dx: -1, dy: 1 }
  };
  return directions[vertexType] || { dx: 0, dy: 0 };
}

export function findNearestVerticesInDirection(vertex, allVertices, maxDistance) {
  const direction = getSearchDirection(vertex.type);
  const candidates = [];

  allVertices.forEach(other => {
    if (other.obstacleId === vertex.obstacleId) return;
    const dx = other.x - vertex.x;
    const dy = other.y - vertex.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0 || distance > maxDistance) return;
    const dotProduct = dx * direction.dx + dy * direction.dy;
    if (dotProduct > 0) {
      candidates.push({ vertex: other, distance, alignment: dotProduct / distance });
    }
  });

  return candidates.sort((a, b) => a.distance - b.distance).slice(0, 3).map(c => c.vertex);
}

export function buildDirectionalConnectionNetwork(width, height, obstacles) {
  const obstacleVertices = extractAllObstacleVertices(obstacles);
  const boundaryVertices = getBoundaryVertices(width, height);
  const allVertices = [...obstacleVertices, ...boundaryVertices];

  const nodes = allVertices.map((v, i) => ({ id: `L0-N${i}`, x: v.x, y: v.y, layer: 0, vertexType: v.type, obstacleId: v.obstacleId }));

  const edges = [];
  const edgeSet = new Set();
  const maxSearchDistance = Math.max(width, height) * 0.5;

  allVertices.forEach((vertex, i) => {
    if (vertex.type === 'boundary') return;
    const nearestVertices = findNearestVerticesInDirection(vertex, allVertices, maxSearchDistance);
    nearestVertices.forEach(targetVertex => {
      const j = allVertices.indexOf(targetVertex);
      if (j === -1) return;
      const [a, b] = i < j ? [i, j] : [j, i];
      const edgeKey = `${a}-${b}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        const n1 = nodes[a];
        const n2 = nodes[b];
        const distance = euclideanDistance(n1, n2);
        edges.push({ from: n1.id, to: n2.id, cost: distance, fromIndex: a, toIndex: b, directional: true });
      }
    });
  });

  console.log(`Layer 0: 方向性连接完成，生成 ${nodes.length} 个节点，${edges.length} 条边`);
  return { nodes, edges, vertices: allVertices };
}
