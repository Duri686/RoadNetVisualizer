/**
 * 道路网络渲染器
 * 负责渲染节点、边和障碍物
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class RoadNetRenderer {
  constructor(scene) {
    this.scene = scene;
    this.nodesMesh = [];
    this.layerGroups = [];
    this.obstacleGroup = null;
  }

  /**
   * 渲染道路网络
   */
  render(data) {
    this.nodesMesh = [];
    this.layerGroups = [];
    
    if (!data || !data.layers) return;

    const centerX = (data.metadata.width || 100) / 2;
    const centerY = (data.metadata.height || 100) / 2;

    // 渲染各层
    data.layers.forEach((layer, index) => {
      this.renderLayer(layer, index, centerX, centerY, data.metadata);
    });

    // 渲染障碍物
    if (data.obstacles && data.obstacles.length > 0) {
      this.renderObstacles(data.obstacles, centerX, centerY);
    }

    return { centerX, centerY };
  }

  /**
   * 渲染单层
   */
  renderLayer(layer, index, centerX, centerY, metadata) {
    const layerGroup = new THREE.Group();
    layerGroup.userData = { layerIndex: index };
    const yOffset = index * Renderer3DConfig.layerHeight;

    // 渲染节点
    if (layer.nodes && layer.nodes.length > 0) {
      this.renderNodes(layer.nodes, layerGroup, yOffset, centerX, centerY, index);
    }

    // 渲染边
    if (layer.edges && layer.edges.length > 0) {
      this.renderEdges(layer.edges, layer.nodes, layerGroup, yOffset, centerX, centerY, layer.metadata);
    }

    // 渲染基础三角化
    if (layer.metadata && layer.metadata.overlayBase) {
      this.renderBaseTriangulation(layer.metadata.overlayBase, layerGroup, yOffset, centerX, centerY);
    }

    this.scene.add(layerGroup);
    this.layerGroups.push(layerGroup);

    // 添加网格
    this.renderGrid(layerGroup, metadata, yOffset);
  }

  /**
   * 渲染节点
   */
  renderNodes(nodes, layerGroup, yOffset, centerX, centerY, layerIndex) {
    const config = Renderer3DConfig;
    const nodeGeometry = new THREE.SphereGeometry(config.node.size * 0.4, config.node.segments, config.node.segments);
    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: config.colors.node,
      emissive: config.colors.nodeEmissive,
      emissiveIntensity: config.materials.node.emissiveIntensity,
      metalness: config.materials.node.metalness,
      roughness: config.materials.node.roughness
    });

    const instancedNodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodes.length);
    instancedNodes.name = 'nodes';
    instancedNodes.castShadow = true;
    instancedNodes.receiveShadow = true;

    // 脉动动画数据
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

      // 存储节点数据用于交互
      this.nodesMesh.push({
        x: node.x - centerX,
        y: yOffset,
        z: node.y - centerY,
        data: node,
        layerIndex
      });
    });

    layerGroup.add(instancedNodes);
  }

  /**
   * 渲染边
   */
  renderEdges(edges, nodes, layerGroup, yOffset, centerX, centerY, layerMetadata) {
    const config = Renderer3DConfig;
    const isVoronoi = layerMetadata && layerMetadata.abstraction && String(layerMetadata.abstraction).toLowerCase().includes('voronoi');
    const name = isVoronoi ? 'voronoi' : 'edges';
    const color = isVoronoi ? 0x06b6d4 : config.colors.edge; // Voronoi Cyan or Default Edge
    
    const positions = [];

    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        positions.push(fromNode.x - centerX, yOffset, fromNode.y - centerY);
        positions.push(toNode.x - centerX, yOffset, toNode.y - centerY);
      }
    });

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: config.edge.opacity
    });
    const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    lines.name = name;
    layerGroup.add(lines);
  }

  /**
   * 渲染基础三角化
   */
  renderBaseTriangulation(overlayBase, layerGroup, yOffset, centerX, centerY) {
    const positions = [];
    
    if (overlayBase.edgesPacked instanceof Float32Array) {
      const packed = overlayBase.edgesPacked;
      for (let i = 0; i + 3 < packed.length; i += 4) {
        positions.push(packed[i] - centerX, yOffset, packed[i + 1] - centerY);
        positions.push(packed[i + 2] - centerX, yOffset, packed[i + 3] - centerY);
      }
    } else if (Array.isArray(overlayBase.edges)) {
      overlayBase.edges.forEach(e => {
        positions.push(e.x1 - centerX, yOffset, e.y1 - centerY);
        positions.push(e.x2 - centerX, yOffset, e.y2 - centerY);
      });
    }

    if (positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.LineDashedMaterial({
      color: 0x9ca3af,
      transparent: true,
      opacity: 0.25,
      dashSize: 1,
      gapSize: 0.5,
      scale: 1
    });
    
    const lines = new THREE.LineSegments(geometry, material);
    lines.computeLineDistances(); // 计算虚线距离
    lines.name = 'baseTriangulation';
    layerGroup.add(lines);
  }

  /**
   * 渲染网格
   */
  renderGrid(layerGroup, metadata, yOffset) {
    const config = Renderer3DConfig;
    const gridSize = Math.max(metadata.width, metadata.height);
    const gridHelper = new THREE.GridHelper(
      gridSize,
      config.grid.divisions,
      config.colors.grid.primary,
      config.colors.grid.secondary
    );
    gridHelper.position.set(0, yOffset - 0.5, 0);
    gridHelper.material.opacity = config.grid.opacity;
    gridHelper.material.transparent = true;
    layerGroup.add(gridHelper);
  }

  /**
   * 渲染障碍物
   */
  renderObstacles(obstacles, centerX, centerY) {
    const config = Renderer3DConfig;
    const obsGeometry = new THREE.BoxGeometry(1, 1, 1);
    const obsMaterial = new THREE.MeshStandardMaterial({
      color: config.colors.obstacle,
      emissive: config.colors.obstacleEmissive,
      emissiveIntensity: config.materials.obstacle.emissiveIntensity,
      metalness: config.materials.obstacle.metalness,
      roughness: config.materials.obstacle.roughness
    });

    const instancedObs = new THREE.InstancedMesh(obsGeometry, obsMaterial, obstacles.length);
    instancedObs.castShadow = true;
    instancedObs.receiveShadow = true;

    const dummy = new THREE.Object3D();

    obstacles.forEach((obs, i) => {
      const w = obs.w || 1;
      const h = obs.h || 1;
      const cx = (obs.x || 0) + w / 2;
      const cy = (obs.y || 0) + h / 2;

      dummy.position.set(cx - centerX, 1, cy - centerY);
      dummy.scale.set(w, 2, h);
      dummy.updateMatrix();
      instancedObs.setMatrixAt(i, dummy.matrix);
    });

    const obsGroup = new THREE.Group();
    obsGroup.name = 'obstacles';
    obsGroup.add(instancedObs);
    this.scene.add(obsGroup);
    this.obstacleGroup = obsGroup;
  }

  /**
   * 获取节点数据
   */
  getNodesMesh() {
    return this.nodesMesh;
  }

  /**
   * 切换障碍物可见性
   */
  toggleObstacles(visible) {
    if (this.obstacleGroup) {
      this.obstacleGroup.visible = visible;
    }
  }

  /**
   * 切换节点可见性
   */
  toggleNodes(visible) {
    this.layerGroups.forEach(group => {
      const nodes = group.getObjectByName('nodes');
      if (nodes) nodes.visible = visible;
    });
  }

  /**
   * 切换边可见性
   */
  toggleEdges(visible) {
    this.layerGroups.forEach(group => {
      const edges = group.getObjectByName('edges');
      if (edges) edges.visible = visible;
    });
  }

  /**
   * 切换基础三角化可见性
   */
  toggleBaseTriangulation(visible) {
    this.layerGroups.forEach(group => {
      const base = group.getObjectByName('baseTriangulation');
      if (base) base.visible = visible;
    });
  }

  /**
   * 切换 Voronoi 可见性
   */
  toggleVoronoi(visible) {
    this.layerGroups.forEach(group => {
      const voronoi = group.getObjectByName('voronoi');
      if (voronoi) voronoi.visible = visible;
    });
  }
}

