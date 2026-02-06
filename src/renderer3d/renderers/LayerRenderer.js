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
 * 创建地板纹理（室内蓝图风格 - 磨砂瓷砖 + 接缝 + 噪点质感）
 */
function createFloorTexture() {
  if (cachedFloorTexture) {
    return cachedFloorTexture;
  }

  const size = 1024;
  const tile = 128; // 主瓷砖尺寸
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // ① 基底：深海蓝
  ctx.fillStyle = '#101b2e';
  ctx.fillRect(0, 0, size, size);

  // ② 磨砂噪点（模拟石材微粒质感）
  const noiseData = ctx.getImageData(0, 0, size, size);
  const pixels = noiseData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14;
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise * 1.5));
  }
  ctx.putImageData(noiseData, 0, 0);

  // ③ 每块瓷砖内部微妙色差（模拟天然石材纹理不均匀）
  for (let tx = 0; tx < size; tx += tile) {
    for (let ty = 0; ty < size; ty += tile) {
      const variation = (Math.random() - 0.5) * 0.06;
      if (variation > 0) {
        ctx.fillStyle = `rgba(96, 165, 250, ${variation})`;
      } else {
        ctx.fillStyle = `rgba(0, 0, 0, ${-variation})`;
      }
      ctx.fillRect(tx + 2, ty + 2, tile - 4, tile - 4);
    }
  }

  // ④ 中心径向高光（模拟天花板灯光映射在地面）
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
  grad.addColorStop(0, 'rgba(96, 165, 250, 0.12)');
  grad.addColorStop(0.5, 'rgba(96, 165, 250, 0.04)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // ⑤ 瓷砖接缝 - 双线凹槽效果（暗线 + 亮边）
  // 暗线（凹槽底部）
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  // 亮边（凹槽高光边缘）
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= size; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // ⑥ 细分线（每块瓷砖内 4 等分）
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.04)';
  ctx.lineWidth = 0.5;
  const subTile = tile / 4;
  for (let i = 0; i <= size; i += subTile) {
    if (i % tile === 0) continue;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // ⑦ 接缝交叉点发光（瓷砖四角微光）
  for (let x = 0; x <= size; x += tile) {
    for (let y = 0; y <= size; y += tile) {
      const dotGrad = ctx.createRadialGradient(x, y, 0, x, y, 4);
      dotGrad.addColorStop(0, 'rgba(96, 165, 250, 0.3)');
      dotGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = dotGrad;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }

  cachedFloorTexture = new THREE.CanvasTexture(canvas);
  cachedFloorTexture.wrapS = THREE.RepeatWrapping;
  cachedFloorTexture.wrapT = THREE.RepeatWrapping;
  cachedFloorTexture.anisotropy = 4;

  return cachedFloorTexture;
}

/**
 * 渲染室内地板（蓝图风格 - 深海蓝磨砂面）
 */
export function renderFloor(layerGroup, metadata, yOffset, centerX, centerY) {
  const floorWidth = metadata.width || 100;
  const floorHeight = metadata.height || 100;

  const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);

  const floorTexture = createFloorTexture();
  floorTexture.repeat.set(floorWidth / 50, floorHeight / 50);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a2744,
    roughness: 0.8,
    metalness: 0.2,
    map: floorTexture,
    emissive: 0x0e1525,
    emissiveIntensity: 0.6,
    emissiveMap: floorTexture,
    transparent: false,
    side: THREE.DoubleSide,
  });

  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, yOffset - 1, 0);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor';

  layerGroup.add(floorMesh);

  // 地板边缘发光带（蓝图边界 - 用窄面片实现真实发光宽度）
  const hw = floorWidth / 2;
  const hh = floorHeight / 2;
  const y = yOffset - 0.5;
  const stripW = 1.5; // 发光带宽度

  const borderMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });

  // 四条边的发光带
  const edges = [
    { pos: [0, y, -hh], rot: 0, len: floorWidth },
    { pos: [0, y,  hh], rot: 0, len: floorWidth },
    { pos: [-hw, y, 0], rot: Math.PI / 2, len: floorHeight },
    { pos: [ hw, y, 0], rot: Math.PI / 2, len: floorHeight },
  ];

  edges.forEach(({ pos, rot, len }) => {
    // 内层亮线
    const geo = new THREE.PlaneGeometry(len, stripW);
    const mesh = new THREE.Mesh(geo, borderMat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.x = -Math.PI / 2;
    if (rot) mesh.rotation.z = rot;
    mesh.name = 'floorBorder';
    layerGroup.add(mesh);

    // 外层光晕（更宽更淡）
    const glowGeo = new THREE.PlaneGeometry(len + 2, stripW * 4);
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(pos[0], pos[1] - 0.1, pos[2]);
    glowMesh.rotation.x = -Math.PI / 2;
    if (rot) glowMesh.rotation.z = rot;
    glowMesh.name = 'floorGlow';
    layerGroup.add(glowMesh);
  });
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
