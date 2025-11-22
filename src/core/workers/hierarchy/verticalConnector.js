/**
 * 垂直连接模块
 * 负责生成楼梯/电梯等跨层连接
 */

/**
 * 查找最近节点
 * @param {Array} nodes - 节点数组
 * @param {number} x - 目标 x 坐标
 * @param {number} y - 目标 y 坐标
 * @returns {Object|null} 最近节点
 */
function findNearestNode(nodes, x, y) {
  let nearest = null;
  let minDist = Infinity;

  for (const node of nodes) {
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  return nearest;
}

/**
 * 检查线段是否与障碍物碰撞
 * @param {number} x1 - 起点 x
 * @param {number} y1 - 起点 y
 * @param {number} x2 - 终点 x
 * @param {number} y2 - 终点 y
 * @param {Array} obstacles - 障碍物数组
 * @returns {boolean} 是否碰撞
 */
function checkLineObstacleCollision(x1, y1, x2, y2, obstacles) {
  if (!obstacles || obstacles.length === 0) return false;

  // 对每个障碍物进行碰撞检测
  for (const obstacle of obstacles) {
    if (!obstacle.points || obstacle.points.length < 3) continue;

    // 检查线段是否与障碍物的任意边相交
    for (let i = 0; i < obstacle.points.length; i++) {
      const p1 = obstacle.points[i];
      const p2 = obstacle.points[(i + 1) % obstacle.points.length];
      
      if (lineSegmentsIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 判断两条线段是否相交
 */
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-10) return false; // 平行或共线

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * 查找圆形范围内所有可达的节点（不穿过障碍物）
 * @param {Array} nodes - 节点数组
 * @param {number} x - 中心点 x 坐标
 * @param {number} y - 中心点 y 坐标
 * @param {number} radius - 搜索半径
 * @param {Array} obstacles - 障碍物数组
 * @param {string} excludeId - 要排除的节点 ID（通常是自己）
 * @returns {Array} 可达节点数组
 */
function findNodesInRadius(nodes, x, y, radius, obstacles = [], excludeId = null) {
  const reachableNodes = [];

  for (const node of nodes) {
    // 排除自己
    if (node.id === excludeId) continue;

    // 计算距离
    const dist = Math.hypot(node.x - x, node.y - y);
    
    // 如果在半径范围内
    if (dist <= radius) {
      // 检查连线是否穿过障碍物
      if (!checkLineObstacleCollision(x, y, node.x, node.y, obstacles)) {
        reachableNodes.push({ node, distance: dist });
      }
    }
  }

  // 按距离排序
  reachableNodes.sort((a, b) => a.distance - b.distance);

  return reachableNodes;
}

/**
 * 创建连接器节点
 * @param {number} layerIdx - 层级索引
 * @param {number} connectorId - 连接器 ID
 * @param {number} x - x 坐标
 * @param {number} y - y 坐标
 * @param {string} type - 连接器类型
 * @returns {Object} 连接器节点
 */
function createConnectorNode(layerIdx, connectorId, x, y, type) {
  return {
    id: `L${layerIdx}-C${connectorId}`,
    x,
    y,
    layer: layerIdx,
    type: 'connector',
    connectorType: type,
  };
}

/**
 * 添加单条双向边
 * @param {Object} layer - 层级对象
 * @param {Object} node1 - 节点1
 * @param {Object} node2 - 节点2
 * @param {string} edgeType - 边类型
 */
function addBidirectionalEdge(layer, node1, node2, edgeType) {
  const dist = Math.hypot(node1.x - node2.x, node1.y - node2.y);

  layer.edges.push({
    from: node1.id,
    to: node2.id,
    cost: dist,
    type: edgeType,
  });

  layer.edges.push({
    from: node2.id,
    to: node1.id,
    cost: dist,
    type: edgeType,
  });
}

/**
 * 将连接器节点连接到范围内的多个路网节点（不穿过障碍物）
 * AccessNode 作为"交通枢纽"，应该连接更多周边节点以提升寻路效率
 * @param {Object} layer - 层级对象
 * @param {Object} connectorNode - 连接器节点
 * @param {string} edgeType - 边类型
 * @param {number} searchRadius - 搜索半径，默认100（枢纽应有更大范围）
 * @param {Array} obstacles - 障碍物数组
 * @param {number} maxConnections - 最大连接数，默认15（避免过多连接）
 */
function addConnectorEdges(layer, connectorNode, edgeType, searchRadius = 100, obstacles = [], maxConnections = 15) {
  // 查找范围内所有可达节点
  const nodesInRadius = findNodesInRadius(
    layer.nodes,
    connectorNode.x,
    connectorNode.y,
    searchRadius,
    obstacles,
    connectorNode.id
  );

  // 如果找到了节点，连接它们
  if (nodesInRadius.length > 0) {
    // 限制连接数量（已按距离排序，优先连接近的节点）
    const nodesToConnect = nodesInRadius.slice(0, maxConnections);
    
    console.log(`[Connector Hub] ${connectorNode.id} connecting to ${nodesToConnect.length}/${nodesInRadius.length} nodes (radius: ${searchRadius}, max: ${maxConnections})`);
    
    nodesToConnect.forEach(({ node, distance }) => {
      addBidirectionalEdge(layer, connectorNode, node, edgeType);
    });
    
    // 如果有节点被过滤，记录日志
    if (nodesInRadius.length > maxConnections) {
      console.log(`[Connector Hub] ${connectorNode.id} limited connections from ${nodesInRadius.length} to ${maxConnections}`);
    }
  } else {
    // Fallback: 如果范围内没有节点，至少连接最近的一个
    console.warn(`[Connector Hub] ${connectorNode.id} found no nodes in radius ${searchRadius}, connecting to nearest`);
    const nearest = findNearestNode(layer.nodes, connectorNode.x, connectorNode.y);
    if (nearest && nearest.id !== connectorNode.id) {
      addBidirectionalEdge(layer, connectorNode, nearest, edgeType);
    }
  }
}

/**
 * 添加垂直跨层边
 * @param {Object} lowerLayer - 下层
 * @param {Object} upperLayer - 上层
 * @param {Object} lowerConnector - 下层连接器节点
 * @param {Object} upperConnector - 上层连接器节点
 * @param {number} verticalCost - 垂直移动代价
 * @param {string} type - 连接器类型
 */
function addVerticalEdges(
  lowerLayer,
  upperLayer,
  lowerConnector,
  upperConnector,
  verticalCost,
  type,
) {
  lowerLayer.edges.push({
    from: lowerConnector.id,
    to: upperConnector.id,
    cost: verticalCost,
    crossFloor: true,
    entranceType: type,
  });

  upperLayer.edges.push({
    from: upperConnector.id,
    to: lowerConnector.id,
    cost: verticalCost,
    crossFloor: true,
    entranceType: type,
  });
}

/**
 * 从预计算的连接器生成楼梯/电梯连接
 * @param {Array} layers - 层级数组
 * @param {Array} connectors - 连接器位置数组
 * @param {number} layerHeight - 层高
 * @returns {Array} 连接信息数组
 */
export function generateStairsElevatorsFromConnectors(
  layers,
  connectors,
  layerHeight,
) {
  const connections = [];

  for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
    const lowerLayer = layers[layerIdx];
    const upperLayer = layers[layerIdx + 1];

    connectors.forEach((connector, index) => {
      const { x, y, type, radius, entranceAngle } = connector;

      // 计算入口点坐标
      const accessX = x + Math.cos(entranceAngle || 0) * radius;
      const accessY = y + Math.sin(entranceAngle || 0) * radius;

      // 1. 获取/创建入口节点 (Access Node)
      // 这些节点通常已由 buildLayer -> centroid.js 作为 fixedPoints 创建并连接到路网
      const lowerAccessId = `L${layerIdx}-${index}-access`;
      const upperAccessId = `L${layerIdx + 1}-${index}-access`;

      let lowerAccessNode = lowerLayer.nodes.find((n) => n.id === lowerAccessId);
      let upperAccessNode = upperLayer.nodes.find((n) => n.id === upperAccessId);

      // Fallback: 如果路网生成未能创建该节点（例如非 centroid 模式），则手动创建
      if (!lowerAccessNode) {
        lowerAccessNode = createConnectorNode(
          layerIdx,
          `${index}-access`,
          accessX,
          accessY,
          'connector-access',
        );
        lowerLayer.nodes.push(lowerAccessNode);
        // 使用入口枢纽连接策略 (Fallback) - 下层作为入口，连接更多路径
        addConnectorEdges(
          lowerLayer,
          lowerAccessNode,
          'connector-link',
          100, // 搜索半径（入口枢纽范围更大）
          lowerLayer.obstacles || [],
          15   // 最大连接数（入口枢纽，多路径选择）
        );
      }

      if (!upperAccessNode) {
        upperAccessNode = createConnectorNode(
          layerIdx + 1,
          `${index}-access`,
          accessX,
          accessY,
          'connector-access',
        );
        upperLayer.nodes.push(upperAccessNode);
        // 使用出口门户连接策略 (Fallback) - 上层作为出口，连接更少更明确
        addConnectorEdges(
          upperLayer,
          upperAccessNode,
          'connector-link',
          60,  // 搜索半径（出口范围较小）
          upperLayer.obstacles || [],
          5    // 最大连接数（出口门户，精选路径）
        );
      }

      // ✨ 关键修复：清理上层 AccessNode 的过多连接（实施出口门户策略）
      // 由于路网生成器（centroid.js）会自动连接 fixedPoints 到所有相邻三角形质心，
      // 我们需要在这里手动限制连接数量，只保留最近的 N 个连接
      if (upperAccessNode) {
        const maxExitConnections = 5;
        
        // 获取所有连接到此 AccessNode 的边（排除跨楼层边和内部边）
        const connectedEdges = upperLayer.edges.filter(
          e => (e.from === upperAccessNode.id || e.to === upperAccessNode.id) &&
               !e.crossFloor && 
               e.type !== 'connector-internal'
        );
        
        if (connectedEdges.length > maxExitConnections) {
          // 计算每条边的目标节点和距离
          const connections = connectedEdges.map(edge => {
            const targetId = edge.from === upperAccessNode.id ? edge.to : edge.from;
            const targetNode = upperLayer.nodes.find(n => n.id === targetId);
            if (!targetNode) return null;
            const distance = Math.hypot(
              upperAccessNode.x - targetNode.x,
              upperAccessNode.y - targetNode.y
            );
            return { edge, targetNode, distance, targetId };
          }).filter(c => c !== null);
          
          // 按距离排序，保留最近的 N 个
          connections.sort((a, b) => a.distance - b.distance);
          const toKeep = connections.slice(0, maxExitConnections);
          const toRemove = connections.slice(maxExitConnections);
          
          // 移除多余的边
          if (toRemove.length > 0) {
            const removeIds = new Set();
            toRemove.forEach(c => {
              removeIds.add(c.edge.from + '-' + c.edge.to);
              removeIds.add(c.edge.to + '-' + c.edge.from);
            });
            
            upperLayer.edges = upperLayer.edges.filter(edge => {
              const key = edge.from + '-' + edge.to;
              return !removeIds.has(key);
            });
            
            console.log(`[Exit Gateway] ${upperAccessNode.id} cleaned: ${connections.length} -> ${toKeep.length} connections (removed ${toRemove.length})`);
          }
        }
      }

      // 2. 创建连接器中心节点 (Center Node)
      // 中心节点不在路网生成中，需要在此处创建
      const lowerConnectorNode = createConnectorNode(
        layerIdx,
        index,
        x,
        y,
        type,
      );
      const upperConnectorNode = createConnectorNode(
        layerIdx + 1,
        index,
        x,
        y,
        type,
      );

      // 添加中心节点到层级
      lowerLayer.nodes.push(lowerConnectorNode);
      upperLayer.nodes.push(upperConnectorNode);

      // 3. 连接 AccessNode -> ConnectorNode (Center)
      // 使用简单的双向边连接（不需要多节点连接，因为这是内部连接）
      addBidirectionalEdge(
        lowerLayer,
        lowerAccessNode,
        lowerConnectorNode,
        'connector-internal',
      );
      addBidirectionalEdge(
        upperLayer,
        upperAccessNode,
        upperConnectorNode,
        'connector-internal',
      );

      // 4. 添加垂直边 ConnectorNode -> ConnectorNode (Center path)
      const verticalCost = layerHeight * 1.2;
      addVerticalEdges(
        lowerLayer,
        upperLayer,
        lowerConnectorNode,
        upperConnectorNode,
        verticalCost,
        type,
      );

      // 5. [NEW] 直接连接 AccessNode -> AccessNode (Direct path)
      // 用户建议：直接连接楼梯的两端，确保路径从入口直接到出口，避免中心点的偏差
      // 修正：使用正确的3D欧几里得距离计算
      const dx = lowerAccessNode.x - upperAccessNode.x;
      const dy = lowerAccessNode.y - upperAccessNode.y;
      const dz = layerHeight;
      const directCost = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      addVerticalEdges(
        lowerLayer,
        upperLayer,
        lowerAccessNode,
        upperAccessNode,
        directCost,
        type + '-direct',
      );

      // 记录连接信息
      connections.push({
        type,
        from: lowerConnectorNode.id,
        to: upperConnectorNode.id,
        fromNode: lowerConnectorNode,
        toNode: upperConnectorNode,
        cost: verticalCost,
        position: { x, y },
        accessPosition: { x: accessX, y: accessY },
        lowerLayer: layerIdx,
        upperLayer: layerIdx + 1,
      });
    });
  }

  return connections;
}
