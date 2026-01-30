import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export function renderLayer(
  scene,
  layerGroups,
  nodesMesh,
  layer,
  index,
  centerX,
  centerY,
  metadata,
) {
  const layerGroup = new THREE.Group();
  layerGroup.userData = { layerIndex: index };
  const yOffset = index * Renderer3DConfig.layerHeight;

  // 渲染地板
  renderFloor(layerGroup, metadata, yOffset, centerX, centerY);

  if (layer.nodes && layer.nodes.length > 0) {
    renderNodes(
      nodesMesh,
      layer.nodes,
      layerGroup,
      yOffset,
      centerX,
      centerY,
      index,
    );
  }

  if (layer.edges && layer.edges.length > 0) {
    renderEdges(
      layer.edges,
      layer.nodes,
      layerGroup,
      yOffset,
      centerX,
      centerY,
      layer.metadata,
    );
  }

  if (layer.metadata && layer.metadata.overlayBase) {
    renderBaseTriangulation(
      layer.metadata.overlayBase,
      layerGroup,
      yOffset,
      centerX,
      centerY,
    );
  }

  scene.add(layerGroup);
  layerGroups.push(layerGroup);

  renderGrid(layerGroup, metadata, yOffset);
}

export function renderNodes(
  nodesMesh,
  nodes,
  layerGroup,
  yOffset,
  centerX,
  centerY,
  layerIndex,
) {
  const config = Renderer3DConfig;
  const nodeGeometry = new THREE.SphereGeometry(
    config.node.size * 0.4,
    config.node.segments,
    config.node.segments,
  );
  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: config.colors.node,
    emissive: config.colors.nodeEmissive,
    emissiveIntensity: config.materials.node.emissiveIntensity,
    metalness: config.materials.node.metalness,
    roughness: config.materials.node.roughness,
  });

  const instancedNodes = new THREE.InstancedMesh(
    nodeGeometry,
    nodeMaterial,
    nodes.length,
  );
  instancedNodes.name = 'nodes';
  instancedNodes.castShadow = true;
  instancedNodes.receiveShadow = true;

  instancedNodes.userData.isPulsing = true;
  instancedNodes.userData.pulseSpeed = config.node.pulseSpeed;
  instancedNodes.userData.pulseAmount = config.node.pulseAmount;
  instancedNodes.userData.originalMatrices = [];

  const dummy = new THREE.Object3D();

  nodes.forEach((node, i) => {
    dummy.position.set(node.x - centerX, yOffset, node.y - centerY);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    instancedNodes.setMatrixAt(i, dummy.matrix);
    instancedNodes.userData.originalMatrices.push(dummy.matrix.clone());

    nodesMesh.push({
      x: node.x - centerX,
      y: yOffset,
      z: node.y - centerY,
      data: node,
      layerIndex,
    });
  });

  layerGroup.add(instancedNodes);
}

export function renderEdges(
  edges,
  nodes,
  layerGroup,
  yOffset,
  centerX,
  centerY,
  layerMetadata,
) {
  const config = Renderer3DConfig;
  const isVoronoi =
    layerMetadata &&
    layerMetadata.abstraction &&
    String(layerMetadata.abstraction).toLowerCase().includes('voronoi');
  const name = isVoronoi ? 'voronoi' : 'edges';
  // 使用配置中的 Voronoi/标准边颜色
  const color = isVoronoi ? config.colors.voronoiEdge : config.colors.edge;
  const opacity = isVoronoi ? 0.6 : config.edge.opacity;

  const positions = [];

  edges.forEach((edge) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);
    if (fromNode && toNode) {
      positions.push(fromNode.x - centerX, yOffset, fromNode.y - centerY);
      positions.push(toNode.x - centerX, yOffset, toNode.y - centerY);
    }
  });

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const edgeMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 1, // 注意: WebGL 限制，大多数浏览器不支持 > 1
  });
  const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  lines.name = name;
  layerGroup.add(lines);
}

export function renderBaseTriangulation(
  overlayBase,
  layerGroup,
  yOffset,
  centerX,
  centerY,
) {
  const config = Renderer3DConfig;
  const positions = [];

  if (overlayBase.edgesPacked instanceof Float32Array) {
    const packed = overlayBase.edgesPacked;
    for (let i = 0; i + 3 < packed.length; i += 4) {
      positions.push(packed[i] - centerX, yOffset, packed[i + 1] - centerY);
      positions.push(packed[i + 2] - centerX, yOffset, packed[i + 3] - centerY);
    }
  } else if (Array.isArray(overlayBase.edges)) {
    overlayBase.edges.forEach((e) => {
      positions.push(e.x1 - centerX, yOffset, e.y1 - centerY);
      positions.push(e.x2 - centerX, yOffset, e.y2 - centerY);
    });
  }

  if (positions.length === 0) {
    return;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );

  // 使用配置中的三角化颜色，增强可见度
  const material = new THREE.LineDashedMaterial({
    color: config.colors.triangulation || 0x64748b,
    transparent: true,
    opacity: 0.35, // 增强可见度
    dashSize: 2, // 更长的破折号
    gapSize: 1,
    scale: 1,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.computeLineDistances();
  lines.name = 'baseTriangulation';
  lines.visible = true;
  layerGroup.add(lines);
}

// 缓存地板纹理，避免重复生成
let cachedFloorTexture = null;

/**
 * 创建地板纹理（未来科技风格）
 */
function createFloorTexture() {
  if (cachedFloorTexture) {
    return cachedFloorTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 基础深色背景
  ctx.fillStyle = '#0c0f1a';
  ctx.fillRect(0, 0, 512, 512);

  // 主网格线（发光效果）
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // 细分网格线（更淡）
  ctx.strokeStyle = '#151b2d';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 512; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // 交叉点发光点
  ctx.fillStyle = '#2563eb';
  for (let x = 0; x <= 512; x += 64) {
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cachedFloorTexture = new THREE.CanvasTexture(canvas);
  cachedFloorTexture.wrapS = THREE.RepeatWrapping;
  cachedFloorTexture.wrapT = THREE.RepeatWrapping;

  return cachedFloorTexture;
}

/**
 * 渲染室内地板（科技风格）
 */
export function renderFloor(layerGroup, metadata, yOffset, centerX, centerY) {
  const floorWidth = metadata.width || 100;
  const floorHeight = metadata.height || 100;

  // 创建地板几何体
  const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);

  // 创建地板材质 - 科技感网格
  const floorTexture = createFloorTexture();
  floorTexture.repeat.set(floorWidth / 50, floorHeight / 50);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0f1a,
    roughness: 0.7,
    metalness: 0.3,
    map: floorTexture,
    transparent: false,
    side: THREE.DoubleSide,
  });

  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, yOffset - 1, 0);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor';

  layerGroup.add(floorMesh);
}

export function renderGrid(layerGroup, metadata, yOffset) {
  // 禁用网格渲染 - 我们已经有地板了，不需要额外的网格线条
  // const config = Renderer3DConfig;
  // const gridSize = Math.max(metadata.width, metadata.height);
  // const gridHelper = new THREE.GridHelper(
  //   gridSize,
  //   config.grid.divisions,
  //   config.colors.grid.primary,
  //   config.colors.grid.secondary,
  // );
  // gridHelper.position.set(0, yOffset - 0.5, 0);
  // gridHelper.material.opacity = config.grid.opacity * 0.5;
  // gridHelper.material.transparent = true;
  // layerGroup.add(gridHelper);
}
