/**
 * Web Worker for Road Network Generation
 * 在后台线程中生成多层道路网络数据，避免阻塞主线程
 */

// #TODO: 考虑添加更复杂的道路网络生成算法（如随机权重、障碍物等）
// #TODO: 优化大规模网络（100x100以上）的生成性能

/**
 * 生成单层道路网络
 * @param {number} width - 网格宽度
 * @param {number} height - 网格高度
 * @param {number} layerIndex - 层索引
 * @returns {Object} 包含节点和边的层数据
 */
function generateLayer(width, height, layerIndex) {
  const nodes = [];
  const edges = [];

  // 生成节点（网格点）
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      nodes.push({
        id: `${x}-${y}-${layerIndex}`,
        x,
        y,
        layer: layerIndex,
        // #TODO: 添加节点属性（如类型、权重等）
        type: 'normal'
      });
    }
  }

  // 生成边（连接相邻节点）
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const currentId = `${x}-${y}-${layerIndex}`;

      // 连接右侧节点
      if (x < width - 1) {
        const rightId = `${x + 1}-${y}-${layerIndex}`;
        edges.push({
          from: currentId,
          to: rightId,
          cost: 1 + Math.random() * 0.5, // 随机权重 1.0-1.5
          direction: 'horizontal'
        });
      }

      // 连接下方节点
      if (y < height - 1) {
        const downId = `${x}-${y + 1}-${layerIndex}`;
        edges.push({
          from: currentId,
          to: downId,
          cost: 1 + Math.random() * 0.5, // 随机权重 1.0-1.5
          direction: 'vertical'
        });
      }

      // #TODO: 添加对角线连接选项
      // #TODO: 添加跨层连接（如楼梯、电梯等）
    }
  }

  return {
    layerIndex,
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      width,
      height
    }
  };
}

/**
 * 生成多层道路网络
 * @param {number} width - 网格宽度
 * @param {number} height - 网格高度
 * @param {number} layerCount - 层数
 */
function generateRoadNetwork(width, height, layerCount) {
  const layers = [];
  const totalSteps = layerCount;

  // 模拟计算过程，每层生成后报告进度
  for (let i = 0; i < layerCount; i++) {
    // 生成当前层
    const layerData = generateLayer(width, height, i);
    layers.push(layerData);

    // 报告进度
    const progress = (i + 1) / totalSteps;
    self.postMessage({
      type: 'PROGRESS',
      progress,
      currentLayer: i,
      totalLayers: layerCount
    });

    // #TODO: 对于大型网络，考虑分批生成和流式传输
  }

  // 计算总统计信息
  const totalNodes = layers.reduce((sum, layer) => sum + layer.nodes.length, 0);
  const totalEdges = layers.reduce((sum, layer) => sum + layer.edges.length, 0);

  return {
    layers,
    metadata: {
      width,
      height,
      layerCount,
      totalNodes,
      totalEdges,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * Worker 消息处理
 */
self.onmessage = function(e) {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'GENERATE_ROADNET': {
        const { width, height, layerCount } = payload;

        // 参数验证
        if (!width || !height || !layerCount) {
          throw new Error('Invalid parameters: width, height, and layerCount are required');
        }

        if (width < 2 || height < 2 || layerCount < 1) {
          throw new Error('Invalid parameters: width and height must be >= 2, layerCount must be >= 1');
        }

        // #TODO: 添加最大限制检查，防止内存溢出（如 width*height*layerCount > 100000）
        if (width * height * layerCount > 50000) {
          console.warn('Large network detected, generation may take time...');
        }

        // 开始生成
        self.postMessage({ type: 'START', payload });

        // 生成道路网络
        const roadNetData = generateRoadNetwork(width, height, layerCount);

        // 完成并返回数据
        self.postMessage({
          type: 'COMPLETE',
          data: roadNetData
        });

        break;
      }

      case 'CANCEL': {
        // #TODO: 实现取消功能（需要在生成循环中检查标志）
        self.postMessage({ type: 'CANCELLED' });
        break;
      }

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    // 错误处理
    self.postMessage({
      type: 'ERROR',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// Worker 错误处理
self.onerror = function(error) {
  self.postMessage({
    type: 'ERROR',
    error: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
};
