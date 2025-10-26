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
 * 最小堆（用于 open 集）
 * 简化实现：允许重复入堆，出堆时以 fScore 校验是否为最新
 */
class MinHeap {
  constructor() { this.arr = []; }
  size() { return this.arr.length; }
  push(item) { this.arr.push(item); this.bubbleUp(this.arr.length - 1); }
  pop() {
    if (this.arr.length === 0) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length) { this.arr[0] = last; this.bubbleDown(0); }
    return top;
  }
  bubbleUp(i) {
    while (i > 0) {
      const p = ((i - 1) >> 1);
      if (this.arr[p].key <= this.arr[i].key) break;
      const t = this.arr[p]; this.arr[p] = this.arr[i]; this.arr[i] = t; i = p;
    }
  }
  bubbleDown(i) {
    for (;;) {
      const l = i * 2 + 1, r = l + 1; let m = i;
      if (l < this.arr.length && this.arr[l].key < this.arr[m].key) m = l;
      if (r < this.arr.length && this.arr[r].key < this.arr[m].key) m = r;
      if (m === i) break; const t = this.arr[m]; this.arr[m] = this.arr[i]; this.arr[i] = t; i = m;
    }
  }
}

/**
 * A* 路径查找算法
 * @param {Object} layer - 导航图层数据
 * @param {Object} startNode - 起点节点
 * @param {Object} endNode - 终点节点
 * @returns {Array|null} 路径节点数组，如果找不到则返回 null
 */
export function findPathAStar(layer, startNode, endNode) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
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

  // id->node 映射（加速邻接取坐标）
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  // A* 算法（最小堆）
  const openHeap = new MinHeap();
  openHeap.push({ id: startNode.id, key: heuristic(startNode, endNode) });
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  // 指标埋点：扩展次数、松弛次数、open 集峰值
  let expanded = 0;
  let relaxed = 0;
  let openPeak = 1;

  nodes.forEach(node => {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  });

  gScore.set(startNode.id, 0);
  fScore.set(startNode.id, heuristic(startNode, endNode));

  while (openHeap.size() > 0) {
    if (openHeap.size() > openPeak) openPeak = openHeap.size();
    // 取 fScore 最小的节点（跳过过期项）
    let current = null;
    for (;;) {
      const top = openHeap.pop();
      if (!top) { current = null; break; }
      const expected = fScore.get(top.id);
      if (expected === top.key) { current = top.id; break; }
      // 过期项，跳过
    }
    if (current == null) break;

    if (current === endNode.id) {
      // 重建路径
      const path = reconstructPath(cameFrom, current, nodes);
      try {
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const used = Math.max(0, Math.round(t1 - t0));
        console.log(`[A*] 路径长度 ${path.length} | 扩展 ${expanded} | 松弛 ${relaxed} | open峰值 ${openPeak} | 耗时 ${used} ms`);
      } catch (_) { /* ignore */ }
      return path;
    }

    expanded++;

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      const tentativeGScore = gScore.get(current) + neighbor.cost;
      
      if (tentativeGScore < gScore.get(neighbor.nodeId)) {
        cameFrom.set(neighbor.nodeId, current);
        gScore.set(neighbor.nodeId, tentativeGScore);
        
        const neighborNode = idToNode.get(neighbor.nodeId);
        const f = tentativeGScore + heuristic(neighborNode, endNode);
        fScore.set(neighbor.nodeId, f);
        
        openHeap.push({ id: neighbor.nodeId, key: f });
        relaxed++;
      }
    }
  }
  try {
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const used = Math.max(0, Math.round(t1 - t0));
    console.log(`[A*] 未找到路径 | 扩展 ${expanded} | 松弛 ${relaxed} | open峰值 ${openPeak} | 耗时 ${used} ms`);
  } catch (_) { /* ignore */ }
  return null; // 没有找到路径
}
