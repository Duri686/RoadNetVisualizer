/**
 * 路径查找工具
 * 提供 A* 等路径查找算法
 */

/**
 * 欧几里得距离启发式函数
 * @param {Object} nodeA - 节点A {x, y}
 * @param {Object} nodeB - 节点B {x, y}
 * @returns {number} 距离
 */
export function heuristic(nodeA, nodeB) {
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 重建路径
 * @param {Map} cameFrom - 路径前驱映射
 * @param {string} current - 当前节点ID
 * @param {Array} nodes - 所有节点数组
 * @returns {Array} 路径节点数组
 */
export function reconstructPath(cameFrom, current, nodes) {
  const path = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  path.push(nodeMap.get(current));
  
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(nodeMap.get(current));
  }
  
  return path;
}

/**
 * A* 路径查找算法
 * @param {Object} layer - 导航图层数据
 * @param {Object} startNode - 起点节点
 * @param {Object} endNode - 终点节点
 * @returns {Array|null} 路径节点数组，如果找不到则返回 null
 */
export function findPathAStar(layer, startNode, endNode) {
  const nodes = layer.nodes;
  const edges = layer.edges;

  // 构建邻接表
  const graph = new Map();
  nodes.forEach(node => graph.set(node.id, []));
  
  edges.forEach(edge => {
    const from = edge.from;
    const to = edge.to;
    graph.get(from).push({ nodeId: to, cost: edge.cost });
    graph.get(to).push({ nodeId: from, cost: edge.cost });
  });

  // A* 算法
  const openSet = new Set([startNode.id]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  nodes.forEach(node => {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  });

  gScore.set(startNode.id, 0);
  fScore.set(startNode.id, heuristic(startNode, endNode));

  while (openSet.size > 0) {
    // 找到 fScore 最小的节点
    let current = null;
    let minFScore = Infinity;
    for (const nodeId of openSet) {
      const score = fScore.get(nodeId);
      if (score < minFScore) {
        minFScore = score;
        current = nodeId;
      }
    }

    if (current === endNode.id) {
      // 重建路径
      return reconstructPath(cameFrom, current, nodes);
    }

    openSet.delete(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      const tentativeGScore = gScore.get(current) + neighbor.cost;
      
      if (tentativeGScore < gScore.get(neighbor.nodeId)) {
        cameFrom.set(neighbor.nodeId, current);
        gScore.set(neighbor.nodeId, tentativeGScore);
        
        const neighborNode = nodes.find(n => n.id === neighbor.nodeId);
        fScore.set(neighbor.nodeId, tentativeGScore + heuristic(neighborNode, endNode));
        
        openSet.add(neighbor.nodeId);
      }
    }
  }

  return null; // 没有找到路径
}
