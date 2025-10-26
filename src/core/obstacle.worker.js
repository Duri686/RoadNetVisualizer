/**
 * Obstacle-Driven Navigation Graph Worker
 * 障碍物驱动的导航图生成器
 */

import { SeededRandom, generateObstacles, isPointInObstacles } from '../utils/obstacleGeneration.js';
import { euclideanDistance, lineIntersectsObstacleWithTurf } from '../utils/obstacleGeometry.js';
import {
  buildObstacleConnectionNetwork,
  buildDirectionalConnectionNetwork,
  segmentFreeSpaceDetailed,
  aggregateZones,
  buildCentroidFreeSpaceNetwork,
  buildPortalNetwork,
  buildVoronoiSkeleton
} from '../utils/navigation/index.js';

const rng = new SeededRandom();

/**
 * 构建单层导航图（支持层次抽象）
 */
function buildLayer(width, height, obstacles, layerIndex, baseZones, mode = 'centroid', options = {}) {
  // Layer 0: 根据模式选择可行网络/骨架构建
  if (layerIndex === 0) {
    let result;
    let abstractionType = 'centroid-free';
    if (mode === 'portal') {
      result = buildPortalNetwork(width, height, obstacles, { useSpatialIndex: options.useSpatialIndex !== false });
      abstractionType = 'portal';
    } else if (mode === 'voronoi') {
      result = buildVoronoiSkeleton(width, height, obstacles, { useSpatialIndex: options.useSpatialIndex !== false });
      abstractionType = 'voronoi-skeleton';
    } else {
      result = buildCentroidFreeSpaceNetwork(width, height, obstacles, { useSpatialIndex: options.useSpatialIndex !== false });
      abstractionType = 'centroid-free';
    }
    // 生成基础的障碍顶点网络（叠加展示），大规模时按需跳过以提升生成速度
    const overlayMode = options && options.overlayMode ? String(options.overlayMode) : 'auto';
    // 始终渲染 overlay，除非显式指定 none
    const overlaySkip = overlayMode === 'none';
    let overlayEdges = [];
    let overlayPacked = null; // Float32Array 打包后的边
    let overlayBuildMs = 0;
    let overlayActualMode = overlaySkip ? 'skipped' : 'delaunay';
    if (!overlaySkip) {
      const tOv0 = performance?.now ? performance.now() : Date.now();
      const baseForOverlay = buildObstacleConnectionNetwork(width, height, obstacles);
      const idToNode = new Map(baseForOverlay.nodes.map(n => [n.id, n]));
      overlayEdges = baseForOverlay.edges.map(e => {
        const a = idToNode.get(e.from);
        const b = idToNode.get(e.to);
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      });
      // 打包为 Float32Array，减少结构化克隆成本
      if (overlayEdges.length) {
        overlayPacked = new Float32Array(overlayEdges.length * 4);
        for (let i = 0, k = 0; i < overlayEdges.length; i++) {
          const e = overlayEdges[i];
          overlayPacked[k++] = e.x1;
          overlayPacked[k++] = e.y1;
          overlayPacked[k++] = e.x2;
          overlayPacked[k++] = e.y2;
        }
      }
      const tOv1 = performance?.now ? performance.now() : Date.now();
      overlayBuildMs = Math.max(0, Math.round(tOv1 - tOv0));
    }
    
    return {
      layerIndex: 0,
      nodes: result.nodes,
      edges: result.edges,
      // 精简：省略大体积的 triangles/delaunay，后续需要可按需开启
      triangles: [],
      delaunay: null,
      metadata: {
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
        abstraction: abstractionType,
        profile: result.profile || null,
        overlayBase: {
          edgeCount: overlayEdges.length,
          // 为空数组以减少体积，使用 edgesPacked 渲染
          edges: [],
          edgesPacked: overlayPacked,
          buildMs: overlayBuildMs,
          mode: overlayActualMode
        }
      }
    };
  }

  // Layer 1+: 基于 Layer 0 进行抽稀聚合
  let zones;
  
  if (!baseZones || baseZones.length === 0) {
    // 如果没有基础zones，使用旧的网格方法作为后备
    zones = segmentFreeSpaceDetailed(width, height, obstacles);
  } else {
    // 使用聚合方法
    const aggregationFactor = 2 * (layerIndex + 1);
    zones = aggregateZones(baseZones, aggregationFactor);
  }

  const nodes = [];
  const edges = [];

  // 创建节点
  zones.forEach((zone, i) => {
    nodes.push({
      id: `L${layerIndex}-N${i}`,
      x: zone.centerX,
      y: zone.centerY,
      layer: layerIndex,
      zoneId: zone.id,
      clusterSize: zone.clusterSize || 1
    });
  });

  // 构建边
  const maxDistance = Math.min(width, height) / (2 - layerIndex * 0.1);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];

      const distance = euclideanDistance(n1, n2);
      if (distance > maxDistance) continue;

      const intersects = obstacles.some(obs =>
        lineIntersectsObstacleWithTurf(n1.x, n1.y, n2.x, n2.y, obs)
      );

      if (!intersects) {
        edges.push({
          from: n1.id,
          to: n2.id,
          cost: distance
        });
      }
    }
  }

  return {
    layerIndex,
    nodes,
    edges,
    zones,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      zoneCount: zones.length,
      abstraction: layerIndex === 0 ? 'detailed' : `aggregated-${layerIndex}`
    }
  };
}

/**
 * 构建多层导航图（真正的层次抽象）
 */
function buildLayers(width, height, obstacles, layerCount, mode = 'centroid', options = {}) {
  const layers = [];
  let baseZones = null;

  for (let i = 0; i < layerCount; i++) {
    const layer = buildLayer(width, height, obstacles, i, baseZones, mode, options);
    layers.push(layer);

    // Layer 0 是障碍物顶点网络，将其节点转换为 zones 供后续层使用
    if (i === 0) {
      // 将 Layer 0 的节点转换为类似 zone 的数据结构
      baseZones = layer.nodes.map(node => ({
        id: node.id,
        centerX: node.x,
        centerY: node.y,
        size: 1,  // 顶点的虚拟尺寸
        nodeId: node.id
      }));
    } else if (layer.zones) {
      // Layer 1+ 使用 zones
      baseZones = layer.zones;
    }

    // 报告进度
    const progress = (i + 1) / layerCount;
    self.postMessage({
      type: 'PROGRESS',
      progress,
      currentLayer: i,
      totalLayers: layerCount,
      layerNodeCount: layer.nodes.length
    });
  }

  return layers;
}

/**
 * Worker 消息处理
 */
self.onmessage = function(e) {
  const { type, payload } = e.data;

  try {
    switch (type) {
    case 'WARMUP': {
      try {
        // 轻量预热：小尺寸、少量障碍，触发 d3-delaunay 与主构建路径的 JIT
        const width = 64, height = 48, layerCount = 1, obstacleCount = 16;
        const options = { useSpatialIndex: true, overlayMode: 'none' };
        const obstacles = generateObstacles(width, height, obstacleCount, rng);
        // 触发一次核心构建
        buildLayers(width, height, obstacles, layerCount, 'centroid', options);
      } catch (_) {
        /* 忽略预热异常 */
      }
      // 通知管理器预热完成
      self.postMessage({ type: 'WARMUP_DONE' });
      break;
    }
      case 'GENERATE_NAVGRAPH': {
        const { width, height, layerCount, obstacleCount, seed, mode, options } = payload;

        // 设置随机种子
        if (seed !== undefined) {
          rng.seed = seed;
        }

        // 参数验证
        if (!width || !height || !layerCount) {
          throw new Error('Invalid parameters');
        }

        self.postMessage({ type: 'START', payload });

        // 计时：生成障碍物
        const tOb0 = performance?.now ? performance.now() : Date.now();
        const obstacles = generateObstacles(width, height, obstacleCount || 0, rng);
        const tOb1 = performance?.now ? performance.now() : Date.now();
        const obstaclesMs = Math.max(0, Math.round(tOb1 - tOb0));
        self.postMessage({
          type: 'OBSTACLE_READY',
          obstacles,
          count: obstacles.length
        });

        // 计时：构建导航图
        const tBuild0 = performance?.now ? performance.now() : Date.now();
        const layers = buildLayers(width, height, obstacles, layerCount, mode || 'centroid', options || {});
        const tBuild1 = performance?.now ? performance.now() : Date.now();
        const buildMs = Math.max(0, Math.round(tBuild1 - tBuild0));

        // 计算总统计
        const totalNodes = layers.reduce((sum, l) => sum + l.nodes.length, 0);
        const totalEdges = layers.reduce((sum, l) => sum + l.edges.length, 0);

        // 使用 Transferable 传输 overlayPacked，降低结构化克隆开销
        const message = {
          type: 'COMPLETE',
          data: {
            layers,
            obstacles,
            metadata: {
              width,
              height,
              layerCount,
              obstacleCount: obstacles.length,
              totalNodes,
              totalEdges,
              profile: (layers && layers[0] && layers[0].metadata) ? layers[0].metadata.profile : null,
              useSpatialIndex: options && options.useSpatialIndex !== false,
              generatedAt: new Date().toISOString(),
              workerProfile: {
                obstaclesMs,
                buildMs,
                overlayMs: (layers && layers[0] && layers[0].metadata && layers[0].metadata.overlayBase && typeof layers[0].metadata.overlayBase.buildMs === 'number') ? layers[0].metadata.overlayBase.buildMs : 0
              }
            }
          }
        };
        const transferList = [];
        try {
          if (Array.isArray(layers)) {
            for (let i = 0; i < layers.length; i++) {
              const buf = layers[i]?.metadata?.overlayBase?.edgesPacked?.buffer;
              if (buf && buf.byteLength) transferList.push(buf);
            }
          }
        } catch (_) { /* 忽略收集失败 */ }
        self.postMessage(message, transferList);

        break;
      }

      case 'CANCEL': {
        self.postMessage({ type: 'CANCELLED' });
        break;
      }

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

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
