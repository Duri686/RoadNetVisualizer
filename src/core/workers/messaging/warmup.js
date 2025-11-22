/**
 * Worker 预热模块
 * 负责触发 JIT 编译优化
 */

import { buildLayers } from '../hierarchy/multiLayerBuilder.js';

/**
 * 执行预热操作
 * 轻量预热：小尺寸、少量障碍，触发主构建路径的 JIT
 */
export function performWarmup() {
  try {
    const width = 64;
    const height = 48;
    const layerCount = 1;
    const obstacleCount = 16;
    const options = { useSpatialIndex: true, overlayMode: 'none' };

    buildLayers(width, height, obstacleCount, layerCount, 'centroid', options);
  } catch (_) {
    /* 忽略预热异常 */
  }

  self.postMessage({ type: 'WARMUP_DONE' });
}
