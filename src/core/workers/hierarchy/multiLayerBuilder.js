/**
 * 多层导航图构建模块
 * 负责构建完整的多层导航结构
 */

import {
  SeededRandom,
  generateObstacles,
} from '../../../utils/obstacleGeneration.js';
import { buildLayer } from '../layer/layerBuilder.js';
import { generateStairsElevatorsFromConnectors } from './verticalConnector.js';

/**
 * 预计算连接器位置（楼梯/电梯）
 */
function preCalculateConnectors(width, height, layerCount, options) {
  const connectors = [];
  if (layerCount <= 1) return connectors;

  const entranceCount = options.floorEntranceCount || 4;
  const rng = new SeededRandom(options.seed || Date.now());
  const padding = 20;

  for (let i = 0; i < entranceCount; i++) {
    const x = rng.randomInt(padding, width - padding);
    const y = rng.randomInt(padding, height - padding);
    const type = rng.random() < 0.5 ? 'stairs' : 'elevator';
    // 随机生成入口角度 (0 ~ 2PI)
    const entranceAngle = rng.random() * Math.PI * 2;
    const accessX = x + Math.cos(entranceAngle) * 15; // radius = 15
    const accessY = y + Math.sin(entranceAngle) * 15;
    connectors.push({ x, y, type, radius: 15, entranceAngle, accessX, accessY });
  }

  return connectors;
}

/**
 * 生成单层障碍物
 */
function generateLayerObstacles(
  width,
  height,
  obstacleCount,
  layerIdx,
  connectors,
  options,
) {
  const layerRng = new SeededRandom(
    (options.seed || Date.now()) + layerIdx * 100,
  );
  return generateObstacles(width, height, obstacleCount, layerRng, {
    avoidZones: connectors,
    padding: 2,
  });
}

/**
 * 发送层级构建进度
 */
function reportLayerProgress(layerIdx, totalLayers, nodeCount) {
  const progress = (layerIdx + 1) / totalLayers;
  self.postMessage({
    type: 'PROGRESS',
    progress,
    currentLayer: layerIdx,
    totalLayers,
    layerNodeCount: nodeCount,
  });
}

/**
 * 构建多层导航图
 */
export function buildLayers(
  width,
  height,
  obstacleCount,
  layerCount,
  mode = 'centroid',
  options = {},
  initialObstacles = null,
) {
  const layers = [];
  let baseZones = null;

  // 1. 预计算连接器位置
  const connectors = preCalculateConnectors(width, height, layerCount, options);

  // 2. 逐层构建
  for (let i = 0; i < layerCount; i++) {
    let layerObstacles;
    
    // 如果是第一层且提供了初始障碍物，直接使用
    if (i === 0 && initialObstacles) {
      layerObstacles = initialObstacles;
    } else {
      // 其他层（或未提供初始障碍物）则重新生成
      layerObstacles = generateLayerObstacles(
        width,
        height,
        obstacleCount,
        i,
        connectors,
        options,
      );
    }

    // 准备固定点（Access Nodes）
    const fixedPoints = connectors.map((c, idx) => ({
      x: c.accessX,
      y: c.accessY,
      id: `${idx}-access`, // ID will be prefixed with L{layer}- in buildLayer
      type: 'connector-access'
    }));

    const layer = buildLayer(
      width,
      height,
      layerObstacles,
      i,
      baseZones,
      mode,
      options,
      fixedPoints // Pass fixed points
    );
    layer.obstacles = layerObstacles;
    layers.push(layer);
    reportLayerProgress(i, layerCount, layer.nodes.length);
  }

  // 3. 添加垂直连接
  if (layerCount > 1) {
    const connections = generateStairsElevatorsFromConnectors(
      layers,
      connectors,
      100,
    );
    return { layers, connections };
  }

  return { layers, connections: [] };
}
