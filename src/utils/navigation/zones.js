// 区域分割与聚合工具
// 此修改保持与原逻辑一致，仅做模块化拆分。
import { isPointInObstacles } from '../obstacleGeneration.js';

export function segmentFreeSpaceDetailed(width, height, obstacles) {
  const zones = [];
  const gridSize = Math.max(4, Math.floor(Math.min(width, height) / 10));
  for (let x = gridSize / 2; x < width; x += gridSize) {
    for (let y = gridSize / 2; y < height; y += gridSize) {
      if (!isPointInObstacles(x, y, obstacles)) {
        zones.push({ id: zones.length, centerX: x, centerY: y, size: gridSize });
      }
    }
  }
  return zones;
}

export function aggregateZones(zones, aggregationFactor) {
  if (zones.length === 0) return [];
  const aggregated = [];
  const used = new Set();
  const threshold = zones[0].size * aggregationFactor;

  zones.forEach((zone, i) => {
    if (used.has(i)) return;
    const cluster = [zone];
    used.add(i);

    zones.forEach((other, j) => {
      if (used.has(j)) return;
      const dist = Math.hypot(zone.centerX - other.centerX, zone.centerY - other.centerY);
      if (dist < threshold) { cluster.push(other); used.add(j); }
    });

    const centerX = cluster.reduce((sum, z) => sum + z.centerX, 0) / cluster.length;
    const centerY = cluster.reduce((sum, z) => sum + z.centerY, 0) / cluster.length;

    aggregated.push({
      id: aggregated.length,
      centerX,
      centerY,
      size: threshold,
      clusterId: aggregated.length,
      clusterSize: cluster.length
    });
  });

  return aggregated;
}
