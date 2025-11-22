/**
 * 单层导航图构建模块
 * 负责构建单个导航层（支持层次抽象）
 */

import {
  buildCentroidFreeSpaceNetwork,
  buildPortalNetwork,
  buildVoronoiSkeleton,
} from '../../../utils/navigation/index.js';
import { sanitizeLayer } from './layerSanitizer.js';
import { buildOverlay } from './overlayBuilder.js';
import { packEdges, packNodes } from './dataPacker.js';

/**
 * 根据模式选择网络构建策略
 * @param {string} mode - 构建模式
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} obstacles - 障碍物数组
 * @param {Object} options - 配置选项
 * @returns {Object} 包含 result 和 abstractionType
 */
function selectNetworkBuilder(mode, width, height, obstacles, options, fixedPoints) {
  let result;
  let abstractionType = 'centroid-free';

  if (mode === 'portal') {
    result = buildPortalNetwork(width, height, obstacles, {
      useSpatialIndex: options.useSpatialIndex !== false,
    });
    abstractionType = 'portal';
  } else if (mode === 'voronoi') {
    result = buildVoronoiSkeleton(width, height, obstacles, {
      useSpatialIndex: options.useSpatialIndex !== false,
    });
    abstractionType = 'voronoi-skeleton';
  } else {
    result = buildCentroidFreeSpaceNetwork(width, height, obstacles, {
      useSpatialIndex: options.useSpatialIndex !== false,
    }, fixedPoints);
    abstractionType = 'centroid-free';
  }

  return { result, abstractionType };
}

/**
 * 后处理：确保唯一 ID 和正确的层级属性
 * @param {Object} result - 网络结果
 * @param {number} layerIndex - 层级索引
 */
function postProcessLayerIds(result, layerIndex) {
  const idMap = new Map();

  result.nodes.forEach((node) => {
    const oldId = node.id;
    const newId = `L${layerIndex}-${oldId}`;
    idMap.set(oldId, newId);

    node.id = newId;
    node.layer = layerIndex;
  });

  result.edges.forEach((edge) => {
    if (idMap.has(edge.from)) edge.from = idMap.get(edge.from);
    if (idMap.has(edge.to)) edge.to = idMap.get(edge.to);
    edge.layer = layerIndex;
  });
}

/**
 * 构建单层导航图
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} obstacles - 障碍物数组
 * @param {number} layerIndex - 层级索引
 * @param {*} baseZones - 基础区域（保留用于未来扩展）
 * @param {string} mode - 构建模式
 * @param {Object} options - 配置选项
 * @param {Array} fixedPoints - 固定点（如楼层出入口）
 * @returns {Object} 层级数据
 */
export function buildLayer(
  width,
  height,
  obstacles,
  layerIndex,
  baseZones,
  mode = 'centroid',
  options = {},
  fixedPoints = [],
) {
  // 1. 选择并执行网络构建
  const { result, abstractionType } = selectNetworkBuilder(
    mode,
    width,
    height,
    obstacles,
    options,
    fixedPoints,
  );

  // 2. 后处理 ID 与层级
  postProcessLayerIds(result, layerIndex);

  // 记录过滤前的数量
  const beforeNodes = result.nodes.length;
  const beforeEdges = result.edges.length;
  console.log(
    `[Layer ${layerIndex}] 过滤前: ${beforeNodes} 节点, ${beforeEdges} 边`,
  );

  // 3. 安全过滤
  sanitizeLayer(result, width, height, obstacles, options);

  // 记录过滤后的数量
  const afterNodes = result.nodes.length;
  const afterEdges = result.edges.length;
  const filteredNodes = beforeNodes - afterNodes;
  const filteredEdges = beforeEdges - afterEdges;
  console.log(
    `[Layer ${layerIndex}] 过滤后: ${afterNodes} 节点, ${afterEdges} 边 | ` +
      `移除: ${filteredNodes} 节点 (${(
        (filteredNodes / beforeNodes) *
        100
      ).toFixed(1)}%), ` +
      `${filteredEdges} 边 (${((filteredEdges / beforeEdges) * 100).toFixed(
        1,
      )}%)`,
  );

  // 4. 构建 overlay 网络
  const overlayBase = buildOverlay(width, height, obstacles, options);

  // 5. 打包数据
  const edgesPacked = packEdges(result.nodes, result.edges);
  const nodesPacked = packNodes(result.nodes);

  return {
    layerIndex,
    nodes: result.nodes,
    edges: result.edges,
    edgesPacked,
    nodesPacked,
    triangles: [],
    delaunay: null,
    metadata: {
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      abstraction: abstractionType,
      profile: result.profile || null,
      overlayBase,
    },
  };
}
