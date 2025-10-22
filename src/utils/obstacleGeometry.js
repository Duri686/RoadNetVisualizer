/**
 * 障碍物几何检测工具
 * 提供障碍物相关的几何计算和检测功能
 */

import * as turf from '@turf/turf';

/**
 * 欧几里得距离
 * @param {Object} p1 - 点1 {x, y}
 * @param {Object} p2 - 点2 {x, y}
 * @returns {number} 距离
 */
export function euclideanDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 使用 turf.js 检测线段是否与障碍物矩形相交或被包含
 * 这是精确的几何检测，能正确处理所有边界情况
 * @param {number} x1 - 线段起点 x
 * @param {number} y1 - 线段起点 y
 * @param {number} x2 - 线段终点 x
 * @param {number} y2 - 线段终点 y
 * @param {Object} obstacle - 障碍物对象 {x, y, w, h}
 * @returns {boolean} 是否相交
 */
export function lineIntersectsObstacleWithTurf(x1, y1, x2, y2, obstacle) {
  try {
    // 创建线段（LineString）
    const line = turf.lineString([[x1, y1], [x2, y2]]);
    
    // 创建障碍物矩形（Polygon）
    // 注意：turf 多边形需要闭合，第一个点和最后一个点相同
    const obstaclePolygon = turf.polygon([[
      [obstacle.x, obstacle.y],                      // 左上
      [obstacle.x + obstacle.w, obstacle.y],         // 右上
      [obstacle.x + obstacle.w, obstacle.y + obstacle.h], // 右下
      [obstacle.x, obstacle.y + obstacle.h],         // 左下
      [obstacle.x, obstacle.y]                       // 闭合到左上
    ]]);
    
    // 检测线段是否与多边形相交
    const intersects = turf.booleanIntersects(line, obstaclePolygon);
    
    // 检测线段是否被多边形包含
    const contained = turf.booleanContains(obstaclePolygon, line);
    
    // 如果相交或被包含，返回 true
    return intersects || contained;
  } catch (error) {
    // 如果 turf 计算出错，使用保守策略：认为不相交
    console.warn('Turf intersection check failed:', error);
    return false;
  }
}

/**
 * 检查点是否在障碍物的顶点附近（容差 0.5）
 * @param {number} px - 点 x 坐标
 * @param {number} py - 点 y 坐标
 * @param {Object} obstacle - 障碍物对象
 * @param {number} tolerance - 容差值
 * @returns {boolean} 是否在顶点附近
 */
export function isPointNearObstacleVertex(px, py, obstacle, tolerance = 0.5) {
  const vertices = [
    {x: obstacle.x, y: obstacle.y},
    {x: obstacle.x + obstacle.w, y: obstacle.y},
    {x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h},
    {x: obstacle.x, y: obstacle.y + obstacle.h}
  ];
  
  return vertices.some(v => {
    const dx = px - v.x;
    const dy = py - v.y;
    return Math.sqrt(dx * dx + dy * dy) < tolerance;
  });
}

/**
 * 获取矩形障碍物的4个顶点
 * @param {Object} obstacle - 障碍物对象 {id, x, y, w, h}
 * @returns {Object} 顶点对象 { topLeft, topRight, bottomRight, bottomLeft }
 */
export function getObstacleVertices(obstacle) {
  return {
    topLeft: { x: obstacle.x, y: obstacle.y, type: 'topLeft', obstacleId: obstacle.id },
    topRight: { x: obstacle.x + obstacle.w, y: obstacle.y, type: 'topRight', obstacleId: obstacle.id },
    bottomRight: { x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h, type: 'bottomRight', obstacleId: obstacle.id },
    bottomLeft: { x: obstacle.x, y: obstacle.y + obstacle.h, type: 'bottomLeft', obstacleId: obstacle.id }
  };
}

/**
 * 提取所有障碍物的顶点
 * @param {Array} obstacles - 障碍物数组
 * @returns {Array} 顶点数组
 */
export function extractAllObstacleVertices(obstacles) {
  const vertices = [];
  obstacles.forEach(obs => {
    const v = getObstacleVertices(obs);
    vertices.push(v.topLeft, v.topRight, v.bottomRight, v.bottomLeft);
  });
  return vertices;
}

/**
 * 获取地图边界的4个角点
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @returns {Array} 边界顶点数组
 */
export function getBoundaryVertices(width, height) {
  return [
    { x: 0, y: 0, type: 'boundary', obstacleId: -1, corner: 'topLeft' },
    { x: width, y: 0, type: 'boundary', obstacleId: -1, corner: 'topRight' },
    { x: width, y: height, type: 'boundary', obstacleId: -1, corner: 'bottomRight' },
    { x: 0, y: height, type: 'boundary', obstacleId: -1, corner: 'bottomLeft' }
  ];
}
