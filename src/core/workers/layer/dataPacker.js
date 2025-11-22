/**
 * 数据打包模块
 * 负责将节点和边打包为 Float32Array 以优化传输
 */

/**
 * 将网络边打包为 Float32Array
 * @param {Array} nodes - 节点数组
 * @param {Array} edges - 边数组
 * @returns {Float32Array|null} 打包后的边数据
 */
export function packEdges(nodes, edges) {
  if (
    !Array.isArray(nodes) ||
    !Array.isArray(edges) ||
    nodes.length === 0 ||
    edges.length === 0
  ) {
    return null;
  }

  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const buf = [];

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const a = idToNode.get(e.from);
    const b = idToNode.get(e.to);
    if (!a || !b) continue;
    buf.push(a.x, a.y, b.x, b.y);
  }

  return buf.length ? new Float32Array(buf) : null;
}

/**
 * 将节点打包为 Float32Array
 * @param {Array} nodes - 节点数组
 * @returns {Float32Array|null} 打包后的节点数据
 */
export function packNodes(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  const buf = new Float32Array(nodes.length * 2);
  for (let i = 0, k = 0; i < nodes.length; i++) {
    const n = nodes[i];
    buf[k++] = n.x;
    buf[k++] = n.y;
  }

  return buf;
}

/**
 * 打包障碍物为 Float32Array
 * @param {Array} obstacles - 障碍物数组
 * @returns {Float32Array|null} 打包后的障碍物数据
 */
export function packObstacles(obstacles) {
  if (!Array.isArray(obstacles) || obstacles.length === 0) {
    return null;
  }

  try {
    const op = new Float32Array(obstacles.length * 4);
    for (let i = 0, k = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      op[k++] = o.x;
      op[k++] = o.y;
      op[k++] = o.w;
      op[k++] = o.h;
    }
    return op;
  } catch (_) {
    return null;
  }
}

/**
 * 收集可传输的 buffer 列表
 * @param {Array} layers - 层级数组
 * @param {Float32Array} obstaclesPacked - 打包后的障碍物
 * @returns {Object} 包含 transferList 和统计信息
 */
export function collectTransferables(layers, obstaclesPacked) {
  const transferList = [];
  let transferBytes = 0;
  let packedBytes = 0;
  let nodesBytes = 0;
  let obsBytes = 0;

  try {
    if (Array.isArray(layers)) {
      for (let i = 0; i < layers.length; i++) {
        const buf = layers[i]?.metadata?.overlayBase?.edgesPacked?.buffer;
        if (buf && buf.byteLength) {
          transferList.push(buf);
          transferBytes += buf.byteLength;
        }

        const packed = layers[i]?.edgesPacked;
        if (packed && packed.buffer && packed.byteLength) {
          transferList.push(packed.buffer);
          transferBytes += packed.byteLength;
          packedBytes += packed.byteLength;
        }

        const nbuf = layers[i]?.nodesPacked?.buffer;
        if (nbuf && nbuf.byteLength) {
          transferList.push(nbuf);
          transferBytes += nbuf.byteLength;
          nodesBytes += nbuf.byteLength;
        }
      }
    }

    const obuf = obstaclesPacked?.buffer;
    if (obuf && obuf.byteLength) {
      transferList.push(obuf);
      transferBytes += obuf.byteLength;
      obsBytes += obuf.byteLength;
    }
  } catch (_) {
    /* 忽略收集失败 */
  }

  return {
    transferList,
    stats: {
      bufferCount: transferList.length,
      transferBytes,
      packedBytes,
      nodesBytes,
      obsBytes,
    },
  };
}
