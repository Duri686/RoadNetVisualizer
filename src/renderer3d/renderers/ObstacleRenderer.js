import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

/**
 * Renders obstacles in the 3D scene.
 * Updated for better visuals: Extruded geometries, outlines, and tech-style materials.
 */
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

  // Materials and Geometries are created on demand or cached
  const materials = createObstacleMaterials(config);

  const addObstacleMesh = (obs, layerIdx) => {
    const w = obs.w || 1;
    const h = obs.h || 1;
    const cx = obs.x + w / 2;
    const cy = obs.y + h / 2;

    const layerY = config.layerHeight * layerIdx;
    const obsHeight = config.layerHeight * 0.3; // slightly taller for better presence

    const geometry = createObstacleGeometry(obs, obsHeight);
    const material = selectMaterialForObstacle(materials, obs);

    const mesh = new THREE.Mesh(geometry, material);

    // Geometry is centered at origin (0,0), so we move it to position.
    // For ExtrudeGeometry created from shape, the origin depends on shape.
    // Our custom createRoundedBoxGeometry centers the shape.
    mesh.position.set(cx - centerX, layerY + obsHeight / 2, cy - centerY);

    // For cylinder/box geometries that are created with size 1, we scale them.
    // For extruded geometries, we create them at correct size so scale is 1.
    if (geometry.type === 'CylinderGeometry' || geometry.type === 'BoxGeometry') {
        // Correct Y position for scaled unit geometry
        mesh.scale.set(w, obsHeight, h);
    } else {
         // Extruded geometry is already sized, but centered at Y=0 with height 'depth'.
         // We need to rotate it to stand up if it was extruded along Z
         mesh.rotation.x = -Math.PI / 2;
         // Adjust position because rotation happens around center
         mesh.position.set(cx - centerX, layerY, cy - centerY);
    }

    mesh.userData.layerIndex = layerIdx;
    mesh.userData.obstacleType = obs.type || 'default';

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1000;

    obstacleGroup.add(mesh);

    // Add outline for "tech" look
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
    mesh.add(line);
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

  obstacleGroup.renderOrder = 1000;
  scene.add(obstacleGroup);
  return obstacleGroup;
}

// Geometry Cache
const geometryCache = new Map();

function createObstacleGeometry(obs, height) {
  const w = obs.w || 1;
  const h = obs.h || 1;
  const type = obs.type || 'default';

  // Create a unique key for cache
  // For cylinders, we just scale a unit cylinder, so we return the same instance.
  // For extruded shapes, we might cache based on w,h if discrete, but if random float, cache misses.
  // However, "random obstacles" might imply continuous sizes.
  // For performance, maybe we bin the sizes? Or just create fresh for now since it's "load time".

  const key = `${type}_${w.toFixed(2)}_${h.toFixed(2)}_${height.toFixed(2)}`;

  if (geometryCache.has(key)) {
      return geometryCache.get(key);
  }

  let geometry;

  if (type === 'pillar') {
     geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
     // Note: Caller handles scaling for Cylinder
  } else if (type === 'round') {
     geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
  } else {
     // Extruded rounded box for walls/rooms
     geometry = createRoundedBoxGeometry(w, h, height, 0.2); // 0.2 radius
  }

  // geometryCache.set(key, geometry); // Caching might explode memory if too many unique sizes.
  // Let's only cache unit geometries or simple ones.
  if (type === 'pillar' || type === 'round') {
      // Use a static cache for unit cylinders
      if (!geometryCache.has(type)) {
          geometryCache.set(type, geometry);
      }
      return geometryCache.get(type);
  }

  return geometry;
}

/**
 * Create a rounded rectangle shape extruded geometry.
 * Returns a geometry centered at (0,0) in XY plane, with depth along Z.
 */
function createRoundedBoxGeometry(width, height, depth, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;

    // Ensure radius doesn't exceed dimensions
    const r = Math.min(radius, Math.min(width, height) / 2);

    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    const extrudeSettings = {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center the geometry
    geometry.center();
    return geometry;
}

function createObstacleMaterials(config) {
  const baseParams = {
    transparent: true,
    opacity: config.materials.obstacle.opacity,
    metalness: config.materials.obstacle.metalness,
    roughness: config.materials.obstacle.roughness,
    emissiveIntensity: config.materials.obstacle.emissiveIntensity,
    side: THREE.FrontSide,
  };

  return {
    primary: new THREE.MeshStandardMaterial({
      ...baseParams,
      color: config.colors.obstacle,
      emissive: config.colors.obstacleEmissive,
    }),
    shop: new THREE.MeshStandardMaterial({
      ...baseParams,
      color: 0x60a5fa, // lighter blue
      emissive: 0x2563eb,
    }),
    pillar: new THREE.MeshStandardMaterial({
      ...baseParams,
      color: 0x93c5fd,
      emissive: 0x3b82f6,
      metalness: 0.9,
    }),
    special: new THREE.MeshStandardMaterial({
      ...baseParams,
      color: 0xf472b6, // pinkish
      emissive: 0xdb2777,
    }),
  };
}

function selectMaterialForObstacle(materials, obstacle) {
  if (obstacle.type === 'pillar') return materials.pillar;
  if (obstacle.type === 'shop') return materials.shop;
  if (obstacle.type === 'special') return materials.special;
  return materials.primary;
}
