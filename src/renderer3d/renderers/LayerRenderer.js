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

  // Render Floor
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

  // Base Triangulation - kept as is but potentially more subtle
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

  // Use a smaller, simpler geometry for performance, maybe a simple circle sprite?
  // Or stick to sphere but low poly.
  const nodeGeometry = new THREE.SphereGeometry(
    config.node.size * 0.3,
    6, // Low poly
    6,
  );

  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: config.colors.node,
  });

  const instancedNodes = new THREE.InstancedMesh(
    nodeGeometry,
    nodeMaterial,
    nodes.length,
  );
  instancedNodes.name = 'nodes';

  // Disable shadows for nodes to save perf, they are small anyway
  instancedNodes.castShadow = false;
  instancedNodes.receiveShadow = false;

  instancedNodes.userData.isPulsing = false; // Disable pulsing for perf
  instancedNodes.userData.originalMatrices = [];

  const dummy = new THREE.Object3D();

  nodes.forEach((node, i) => {
    dummy.position.set(node.x - centerX, yOffset, node.y - centerY);
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

  // Add a subtle glow sprite for nodes? Too many sprites = bad perf.
  // We'll rely on the color being bright against the dark floor.
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
  const color = isVoronoi ? 0x06b6d4 : config.colors.edge;

  const positions = [];

  // Optimization: use a map for node lookup
  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, n));

  edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
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
    opacity: 0.15, // Very subtle
    depthWrite: false, // Don't block other things
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
  // Existing implementation is fine, just ensure it's subtle
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

  if (positions.length === 0) return;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );

  const material = new THREE.LineBasicMaterial({
    color: 0x4b5563, // Darker gray
    transparent: true,
    opacity: 0.1,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'baseTriangulation';
  layerGroup.add(lines);
}

// Cache floor texture
let cachedFloorTexture = null;

function createFloorTexture() {
  if (cachedFloorTexture) return cachedFloorTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#0f172a'; // Slate 900
  ctx.fillRect(0, 0, 512, 512);

  // Grid pattern
  ctx.strokeStyle = '#1e293b'; // Slate 800
  ctx.lineWidth = 1;
  const gridSize = 64;

  for (let i = 0; i <= 512; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle dots at intersections
  ctx.fillStyle = '#334155';
  for (let x = 0; x <= 512; x += gridSize) {
      for (let y = 0; y <= 512; y += gridSize) {
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

export function renderFloor(layerGroup, metadata, yOffset, centerX, centerY) {
  const floorWidth = metadata.width || 100;
  const floorHeight = metadata.height || 100;

  const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
  const floorTexture = createFloorTexture();

  // Repeat texture based on size
  floorTexture.repeat.set(floorWidth / 64, floorHeight / 64);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Use texture color
    roughness: 0.5,
    metalness: 0.1,
    map: floorTexture,
    side: THREE.DoubleSide,
  });

  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, yOffset - 1, 0); // slightly below 0
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor';

  layerGroup.add(floorMesh);
}

export function renderGrid(layerGroup, metadata, yOffset) {
    // Grid is now baked into floor texture
}
