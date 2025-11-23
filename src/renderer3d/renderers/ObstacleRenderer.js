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

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: config.colors.obstacle,
    roughness: 0.7,
    metalness: 0.2,
  });

  const addObstacleMesh = (obs, layerIdx) => {
    const mesh = new THREE.Mesh(geometry, material);
    const w = obs.w;
    const h = obs.h;
    const cx = obs.x + w / 2;
    const cy = obs.y + h / 2;

    const layerY = config.layerHeight * layerIdx;
    const obsHeight = config.layerHeight * 0.2;

    mesh.position.set(cx - centerX, layerY + obsHeight / 2, cy - centerY);
    mesh.scale.set(w, obsHeight, h);

    // 记录该障碍所属楼层，便于按楼层控制可见性
    mesh.userData.layerIndex = layerIdx;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

  scene.add(obstacleGroup);
  return obstacleGroup;
}
