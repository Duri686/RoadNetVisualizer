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
import { NavConfig } from '../../../config/NavConfig.js';

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
    connectors.push({
      x,
      y,
      type,
      radius: 15,
      entranceAngle,
      accessX,
      accessY,
    });
  }

  return connectors;
}

// 构建连接器周围及通道方向上的避让区域，用于障碍生成时绕开通道
function buildConnectorAvoidZones(connectors) {
  const zones = [];
  if (!Array.isArray(connectors) || connectors.length === 0) {
    return zones;
  }

  const corridorCfg = (NavConfig && NavConfig.corridor) || {};
  const corridorEnabled = corridorCfg.enabled !== false;

  if (!corridorEnabled) {
    return zones;
  }

  const shaftRadius =
    typeof corridorCfg.shaftRadius === 'number' ? corridorCfg.shaftRadius : 17; // 竖井中心避让半径
  const accessRadius =
    typeof corridorCfg.accessRadius === 'number'
      ? corridorCfg.accessRadius
      : 25; // access 入口周围避让半径
  const corridorLength =
    typeof corridorCfg.length === 'number' ? corridorCfg.length : 60; // 通道总长度
  const corridorStep =
    typeof corridorCfg.step === 'number' ? corridorCfg.step : 20; // 采样步长
  const corridorRadius =
    typeof corridorCfg.halfWidth === 'number' ? corridorCfg.halfWidth : 25; // 通道半宽

  for (let i = 0; i < connectors.length; i++) {
    const c = connectors[i];
    if (!c) continue;

    const angle = typeof c.entranceAngle === 'number' ? c.entranceAngle : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const baseRadius = typeof c.radius === 'number' ? c.radius : 15;
    const ax =
      typeof c.accessX === 'number' ? c.accessX : c.x + cos * baseRadius;
    const ay =
      typeof c.accessY === 'number' ? c.accessY : c.y + sin * baseRadius;

    zones.push({ x: c.x, y: c.y, radius: shaftRadius });
    zones.push({ x: ax, y: ay, radius: accessRadius });

    for (let d = corridorStep; d <= corridorLength; d += corridorStep) {
      zones.push({
        x: ax + cos * d,
        y: ay + sin * d,
        radius: corridorRadius,
      });
    }
  }

  return zones;
}

// 诊断：检查给定楼层障碍物是否与通道避让区域发生交叉，用于定位通道被障碍覆盖的问题
function logCorridorCollisions(layerIdx, obstacles, connectors) {
  const diag = NavConfig && NavConfig.diagnostics;
  if (!diag || !diag.checkCorridorCollisions) return;
  if (!Array.isArray(obstacles) || obstacles.length === 0) return;
  if (!Array.isArray(connectors) || connectors.length === 0) return;

  const zones = buildConnectorAvoidZones(connectors);
  if (!zones.length) return;

  // 与 generateObstacles 中 avoidZones 相同的 AABB 相交判定，保证诊断与生成逻辑一致
  for (let zi = 0; zi < zones.length; zi++) {
    const zone = zones[zi];
    const zr = zone.radius || 10;
    const zL = zone.x - zr;
    const zR = zone.x + zr;
    const zT = zone.y - zr;
    const zB = zone.y + zr;

    for (let oi = 0; oi < obstacles.length; oi++) {
      const obs = obstacles[oi];
      const aL = obs.x;
      const aR = obs.x + obs.w;
      const aT = obs.y;
      const aB = obs.y + obs.h;

      if (!(aR < zL || zR < aL || aB < zT || zB < aT)) {
        console.warn(
          `[Corridor] Layer ${layerIdx}: obstacle ${
            obs.id ?? oi
          } intersects corridor zone (x=${zone.x.toFixed(
            1,
          )}, y=${zone.y.toFixed(1)}, r=${zr})`,
        );
        break;
      }
    }
  }
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
  const avoidZones = buildConnectorAvoidZones(connectors);
  return generateObstacles(width, height, obstacleCount, layerRng, {
    avoidZones,
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

  const corridorCfg = (NavConfig && NavConfig.corridor) || {};
  const useCorridorAvoid = corridorCfg.enabled !== false;

  // 1. 预计算连接器位置
  const connectors = preCalculateConnectors(width, height, layerCount, options);

  // 2. 逐层构建
  for (let i = 0; i < layerCount; i++) {
    let layerObstacles;

    // 当启用通道避障时，所有楼层统一使用带 avoidZones 的生成逻辑；
    // 仅在关闭通道避障且提供 initialObstacles 时，才复用 L0 原始障碍物。
    if (!useCorridorAvoid && i === 0 && initialObstacles) {
      layerObstacles = initialObstacles;
    } else {
      layerObstacles = generateLayerObstacles(
        width,
        height,
        obstacleCount,
        i,
        connectors,
        options,
      );
    }

    // 诊断：检查当前楼层通道是否被障碍物覆盖
    logCorridorCollisions(i, layerObstacles, connectors);

    // 准备固定点（Access Nodes）
    const fixedPoints = connectors.map((c, idx) => ({
      x: c.accessX,
      y: c.accessY,
      id: `${idx}-access`, // ID will be prefixed with L{layer}- in buildLayer
      type: 'connector-access',
    }));

    const layer = buildLayer(
      width,
      height,
      layerObstacles,
      i,
      baseZones,
      mode,
      options,
      fixedPoints, // Pass fixed points
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
