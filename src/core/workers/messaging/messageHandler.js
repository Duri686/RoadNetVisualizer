/**
 * Worker 消息处理模块
 * 负责处理主线程消息并协调各模块
 */
console.log('messageHandler loaded');
import {
  SeededRandom,
  generateObstacles,
} from '../../../utils/obstacleGeneration.js';
import { computeObstaclesSignature } from '../../../utils/spatialIndex.js';
import { buildLayers } from '../hierarchy/multiLayerBuilder.js';
import { packObstacles, collectTransferables } from '../layer/dataPacker.js';
import { performWarmup } from './warmup.js';

const rng = new SeededRandom();

/**
 * 处理 WARMUP 消息
 */
function handleWarmup() {
  performWarmup();
}

/**
 * 处理 GENERATE_NAVGRAPH 消息
 */
function handleGenerateNavGraph(payload) {
  const { width, height, layerCount, obstacleCount, seed, mode, options } =
    payload;

  // 设置随机种子
  if (seed !== undefined) {
    rng.seed = seed;
  }

  // 参数验证
  if (!width || !height || !layerCount) {
    throw new Error('Invalid parameters');
  }

  self.postMessage({ type: 'START', payload });

  // 生成障碍物
  const tOb0 = performance?.now ? performance.now() : Date.now();
  const obstacles = generateObstacles(width, height, obstacleCount || 0, rng);

  let obstaclesSignature = null;
  try {
    obstaclesSignature = computeObstaclesSignature(obstacles);
  } catch (_) {}

  const tOb1 = performance?.now ? performance.now() : Date.now();
  const obstaclesMs = Math.max(0, Math.round(tOb1 - tOb0));

  self.postMessage({
    type: 'OBSTACLE_READY',
    obstacles,
    count: obstacles.length,
    obstaclesSignature,
  });

  // 构建导航图
  const tBuild0 = performance?.now ? performance.now() : Date.now();
  const buildResult = buildLayers(
    width,
    height,
    obstacleCount,
    layerCount,
    mode || 'centroid',
    options || {},
    obstacles,
  );
  const tBuild1 = performance?.now ? performance.now() : Date.now();
  const buildMs = Math.max(0, Math.round(tBuild1 - tBuild0));

  // 解析构建结果
  let layers = [];
  let floorConnections = [];

  if (Array.isArray(buildResult)) {
    layers = buildResult;
  } else {
    layers = buildResult.layers;
    floorConnections = buildResult.connections || [];
  }

  // 计算统计
  const totalNodes = layers.reduce((sum, l) => sum + l.nodes.length, 0);
  const totalEdges = layers.reduce((sum, l) => sum + l.edges.length, 0);
  const crossFloorEdges = floorConnections.length * 2;

  // 打包障碍物
  const obstaclesPacked = packObstacles(obstacles);

  // 构建返回消息
  const message = {
    type: 'COMPLETE',
    data: {
      layers,
      obstacles,
      obstaclesPacked,
      metadata: {
        width,
        height,
        layerCount,
        obstacleCount: obstacles.length,
        totalNodes,
        totalEdges,
        crossFloorEdges,
        floorConnections,
        profile: layers?.[0]?.metadata?.profile || null,
        useSpatialIndex: options && options.useSpatialIndex !== false,
        generatedAt: new Date().toISOString(),
        obstaclesSignature,
        workerProfile: {
          obstaclesMs,
          buildMs,
          overlayMs: layers?.[0]?.metadata?.overlayBase?.buildMs || 0,
        },
      },
    },
  };

  // 收集可传输对象
  const { transferList, stats } = collectTransferables(layers, obstaclesPacked);

  try {
    console.log(
      `[Transfer] buffers=${stats.bufferCount} | bytes=${stats.transferBytes} | ` +
        `edgesPackedBytes=${stats.packedBytes} | nodesPackedBytes=${stats.nodesBytes} | ` +
        `obstaclesPackedBytes=${stats.obsBytes}`,
    );
  } catch (_) {}

  self.postMessage(message, transferList);
}

/**
 * 处理 CANCEL 消息
 */
function handleCancel() {
  self.postMessage({ type: 'CANCELLED' });
}

/**
 * Worker 消息处理入口
 */
export function handleMessage(e) {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'WARMUP':
        handleWarmup();
        break;

      case 'GENERATE_NAVGRAPH':
        handleGenerateNavGraph(payload);
        break;

      case 'CANCEL':
        handleCancel();
        break;

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
}

/**
 * Worker 错误处理
 */
export function handleError(error) {
  self.postMessage({
    type: 'ERROR',
    error: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
    },
  });
}
