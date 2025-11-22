/**
 * Overlay 构建模块
 * 负责生成障碍顶点网络叠加层
 */

import { buildObstacleConnectionNetwork } from '../../../utils/navigation/index.js';

/**
 * 构建 overlay 网络（障碍顶点连接）
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} obstacles - 障碍物数组
 * @param {Object} options - 配置选项
 * @returns {Object} overlay 数据
 */
export function buildOverlay(width, height, obstacles, options = {}) {
  const overlayMode =
    options && options.overlayMode ? String(options.overlayMode) : 'auto';
  const overlaySkip = overlayMode === 'none';

  let overlayEdges = [];
  let overlayPacked = null;
  let overlayBuildMs = 0;
  let overlayActualMode = overlaySkip ? 'skipped' : 'delaunay';

  if (!overlaySkip) {
    const tStart = performance?.now ? performance.now() : Date.now();

    const baseForOverlay = buildObstacleConnectionNetwork(
      width,
      height,
      obstacles,
    );
    const idToNode = new Map(baseForOverlay.nodes.map((n) => [n.id, n]));

    overlayEdges = baseForOverlay.edges.map((e) => {
      const a = idToNode.get(e.from);
      const b = idToNode.get(e.to);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    });

    // 打包为 Float32Array
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

    const tEnd = performance?.now ? performance.now() : Date.now();
    overlayBuildMs = Math.max(0, Math.round(tEnd - tStart));
  }

  return {
    edgeCount: overlayEdges.length,
    edges: [], // 空数组减少体积，使用 edgesPacked 渲染
    edgesPacked: overlayPacked,
    buildMs: overlayBuildMs,
    mode: overlayActualMode,
  };
}
