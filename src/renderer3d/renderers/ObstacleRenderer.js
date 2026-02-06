import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export function renderObstacles(
  scene,
  obstacles,
  centerX,
  centerY,
  totalFloors,
  layers,
) {
  if (!obstacles && (!layers || layers.length === 0)) {
    return null;
  }

  const config = Renderer3DConfig;
  const obstacleGroup = new THREE.Group();
  obstacleGroup.name = 'obstacles';

  // 创建多种几何体和材质
  const geometries = createObstacleGeometries();
  const materials = createObstacleMaterials(config);

  const addObstacleMesh = (obs, layerIdx) => {
    const w = obs.w;
    const h = obs.h;
    const cx = obs.x + w / 2;
    const cy = obs.y + h / 2;

    const layerY = config.layerHeight * layerIdx;
    const obsHeight = config.layerHeight * 0.25; // 稍微增加高度

    // 根据障碍物大小和形状选择几何体
    const geometry = selectGeometryForObstacle(geometries, obs);
    const material = selectMaterialForObstacle(materials, obs);

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(cx - centerX, layerY + obsHeight / 2, cy - centerY);
    mesh.scale.set(w, obsHeight, h);

    // 记录该障碍所属楼层，便于按楼层控制可见性
    mesh.userData.layerIndex = layerIdx;
    mesh.userData.obstacleType = obs.type || 'default';

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 设置渲染顺序，透明物体后渲染
    mesh.renderOrder = 1000;

    obstacleGroup.add(mesh);
  };

  if (layers && layers.length > 0) {
    layers.forEach((layer, idx) => {
      if (layer.obstacles) {
        layer.obstacles.forEach((obs) => addObstacleMesh(obs, idx));
      } else if (idx === 0 && obstacles) {
        obstacles.forEach((obs) => addObstacleMesh(obs, 0));
      }
    });
  } else if (obstacles) {
    for (let i = 0; i < totalFloors; i++) {
      obstacles.forEach((obs) => addObstacleMesh(obs, i));
    }
  }

  // 设置障碍物组的渲染顺序
  obstacleGroup.renderOrder = 1000;

  // 移除距离排序以提高性能
  // 透明度问题通过其他方式解决（depthWrite: true）

  scene.add(obstacleGroup);
  return obstacleGroup;
}

/**
 * 创建多种障碍物几何体
 */
// 缓存几何体，避免重复创建
let cachedGeometries = null;

function createObstacleGeometries() {
  if (cachedGeometries) {
    return cachedGeometries;
  }

  cachedGeometries = {
    // 圆角矩形 - 使用六边形柱体模拟圆角效果（降低复杂度）
    roundedBox: new THREE.CylinderGeometry(0.45, 0.45, 1, 6),

    // 圆柱体 - 降低段数提高性能
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),

    // 普通矩形
    box: new THREE.BoxGeometry(1, 1, 1),

    // 八边形柱体 - 用于特殊形状
    octagon: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),

    // 六边形柱体
    hexagon: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  };

  return cachedGeometries;
}

/**
 * 创建圆角矩形几何体
 */
function createRoundedBoxGeometry(width, height, depth, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  // 增加圆角半径，让切角更明显和圆滑
  const r = Math.min(radius * 3, Math.min(w, h) / 4);

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelSegments: 6, // 增加倒角段数，让边缘更圆滑
    steps: 2, // 增加挤压步数
    bevelSize: 0.08, // 增加倒角大小
    bevelThickness: 0.05, // 增加倒角厚度
  };

  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * 创建多种障碍物材质
 */
function createObstacleMaterials(config) {
  return {
    // 主要障碍物材质 - 蓝色磨砂玻璃
    primary: new THREE.MeshStandardMaterial({
      color: 0x3b82f6, // Blue 500
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x60a5fa, // Blue 400 柔和发光
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.45,
      depthWrite: true,
      side: THREE.FrontSide,
    }),

    // 商店/房间材质 - 深蓝玻璃
    shop: new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Blue 600
      roughness: 0.35,
      metalness: 0.45,
      emissive: 0x3b82f6, // Blue 500
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.5,
      depthWrite: true,
      side: THREE.FrontSide,
    }),

    // 柱子材质 - 实心蓝色
    pillar: new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Blue 700
      roughness: 0.4,
      metalness: 0.4,
      emissive: 0x2563eb, // Blue 600
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.7,
      depthWrite: true,
      side: THREE.FrontSide,
    }),

    // 特殊区域材质 - 浅蓝透明玻璃
    special: new THREE.MeshStandardMaterial({
      color: 0x60a5fa, // Blue 400
      roughness: 0.25,
      metalness: 0.55,
      emissive: 0x93c5fd, // Blue 300
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.35,
      depthWrite: true,
      side: THREE.FrontSide,
    }),
  };
}

/**
 * 根据障碍物属性选择几何体
 */
function selectGeometryForObstacle(geometries, obstacle) {
  const w = obstacle.w || 1;
  const h = obstacle.h || 1;
  const aspectRatio = w / h;
  const area = w * h;

  // 根据障碍物类型或形状特征选择几何体
  if (
    obstacle.type === 'pillar' ||
    (aspectRatio > 0.8 && aspectRatio < 1.2 && area < 15)
  ) {
    // 柱子或小正方形区域使用圆柱体
    return geometries.cylinder;
  } else if (
    obstacle.type === 'round' ||
    (aspectRatio > 0.8 && aspectRatio < 1.2)
  ) {
    // 圆形或接近正方形的障碍物使用圆柱体
    return geometries.cylinder;
  } else if (area > 200) {
    // 非常大的区域使用八边形
    return geometries.octagon;
  } else {
    // 其他所有障碍物都使用八边形柱体（模拟圆角效果）
    return geometries.roundedBox;
  }
}

/**
 * 根据障碍物属性选择材质
 */
function selectMaterialForObstacle(materials, obstacle) {
  if (obstacle.type === 'pillar') {
    return materials.pillar;
  } else if (obstacle.type === 'shop') {
    return materials.shop;
  } else if (obstacle.type === 'special') {
    return materials.special;
  } else {
    return materials.primary;
  }
}
