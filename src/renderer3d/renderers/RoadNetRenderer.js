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
    const totalFloors = data.layers.length;

    // 渲染各层
    data.layers.forEach((layer, index) => {
      this.renderLayer(layer, index, centerX, centerY, data.metadata);
    });

    // 渲染障碍物 (spanning all floors)
    if (data.obstacles && data.obstacles.length > 0) {
    this.renderObstacles(data.obstacles, centerX, centerY, totalFloors, data.layers);
    }
    
    // 渲染楼梯/电梯
    if (data.metadata.floorConnections && data.metadata.floorConnections.length > 0) {
      this.renderFloorConnections(data.metadata.floorConnections, centerX, centerY);
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
    lines.visible = true; // 默认显示
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
   * 渲染障碍物 - 支持每层独立渲染
   */
  renderObstacles(obstacles, centerX, centerY, totalFloors, layers) {
    if (!obstacles && (!layers || layers.length === 0)) return;
    
    const config = Renderer3DConfig;
    const obstacleGroup = new THREE.Group();
    obstacleGroup.name = 'obstacles';
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: config.colors.obstacle,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Helper to add obstacle mesh
    const addObstacleMesh = (obs, layerIdx) => {
      const mesh = new THREE.Mesh(geometry, material);
      const w = obs.w;
      const h = obs.h;
      const cx = obs.x + w / 2;
      const cy = obs.y + h / 2;
      
      // Height based on layer
      const layerY = config.layerHeight * layerIdx;
      const obsHeight = config.layerHeight * 0.2; // Reduced to 1/5th of layer height
      
      mesh.position.set(cx - centerX, layerY + obsHeight / 2, cy - centerY);
      mesh.scale.set(w, obsHeight, h);
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obstacleGroup.add(mesh);
    };

    // Render per-layer obstacles if available
    if (layers && layers.length > 0) {
      layers.forEach((layer, idx) => {
        if (layer.obstacles) {
          layer.obstacles.forEach(obs => addObstacleMesh(obs, idx));
        } else if (idx === 0 && obstacles) {
          // Fallback for layer 0 if no per-layer obstacles found but global obstacles exist
          obstacles.forEach(obs => addObstacleMesh(obs, 0));
        }
      });
    } else if (obstacles) {
      // Fallback: render global obstacles on all floors (old behavior but per floor)
      for (let i = 0; i < totalFloors; i++) {
        obstacles.forEach(obs => addObstacleMesh(obs, i));
      }
    }
    
    this.scene.add(obstacleGroup);
    this.obstacleGroup = obstacleGroup;
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
   * 渲染楼层出入口 (楼梯和电梯)
   */
  /**
   * 渲染楼层出入口 (楼梯和电梯)
   */
  renderFloorConnections(connections, centerX, centerY) {
    if (!connections || connections.length === 0) return;
    
    const config = Renderer3DConfig;
    
    connections.forEach(conn => {
      const layerIdx = conn.lowerLayer;
      if (layerIdx === undefined || layerIdx >= this.layerGroups.length) return;

      const layerGroup = this.layerGroups[layerIdx];
      let connectionsGroup = layerGroup.getObjectByName('connections');
      if (!connectionsGroup) {
        connectionsGroup = new THREE.Group();
        connectionsGroup.name = 'connections';
        layerGroup.add(connectionsGroup);
      }

      const accessInfo = conn.accessPosition ? ` | Access: (${Math.round(conn.accessPosition.x)}, ${Math.round(conn.accessPosition.y)})` : '';
      console.log(`[FloorConnection] ${conn.type} L${conn.lowerLayer}->L${conn.upperLayer} | Center: (${Math.round(conn.position.x)}, ${Math.round(conn.position.y)})${accessInfo}`);
      
      const fromPos = new THREE.Vector3(
        conn.fromNode.x - centerX,
        config.layerHeight * conn.lowerLayer,
        conn.fromNode.y - centerY
      );
      const toPos = new THREE.Vector3(
        conn.toNode.x - centerX,
        config.layerHeight * conn.upperLayer,
        conn.toNode.y - centerY
      );
      
      const conf = conn.type === 'elevator' ? config.floorEntrance.elevator : config.floorEntrance.stairs;
      
      // Create tube connecting floors
      const curve = new THREE.LineCurve3(fromPos, toPos);
      const tubeGeo = new THREE.TubeGeometry(curve, 8, conf.radius, conf.segments, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: conf.color,
        emissive: conf.color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: conf.opacity
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      connectionsGroup.add(tube);
      
      // Add platform marker at top (for elevators) or midpoint (for stairs)
      if (conn.type === 'elevator') {
        const platformGeo = new THREE.CylinderGeometry(conf.platformSize, conf.platformSize, 0.5, 16);
        const platformMat = new THREE.MeshStandardMaterial({
          color: conf.color,
          emissive: conf.color,
          emissiveIntensity: 0.5
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.copy(toPos);
        platform.position.y -= 0.25; // Slightly below endpoint
        connectionsGroup.add(platform);
      }

      // [NEW] Visualize Direct Path (Access -> Access)
      if (conn.accessPosition) {
        const fromAccessPos = new THREE.Vector3(
          conn.accessPosition.x - centerX,
          config.layerHeight * conn.lowerLayer,
          conn.accessPosition.y - centerY
        );
        const toAccessPos = new THREE.Vector3(
          conn.accessPosition.x - centerX,
          config.layerHeight * conn.upperLayer,
          conn.accessPosition.y - centerY
        );
        
        // Draw a thinner, dashed-like tube or line for the direct path
        const directCurve = new THREE.LineCurve3(fromAccessPos, toAccessPos);
        const directTubeGeo = new THREE.TubeGeometry(directCurve, 4, conf.radius * 0.5, 8, false);
        const directTubeMat = new THREE.MeshStandardMaterial({
          color: conf.color,
          emissive: conf.color,
          emissiveIntensity: 0.8, // Brighter
          transparent: true,
          opacity: 0.6
        });
        const directTube = new THREE.Mesh(directTubeGeo, directTubeMat);
        connectionsGroup.add(directTube);
      }
    });
    
    console.log(`[RoadNetRenderer] Rendered ${connections.length} floor connections distributed to layers`);
  }

  /**
   * 切换连接器可见性
   */
  toggleConnections(visible, layerIndex = -1) {
    this.layerGroups.forEach((group, idx) => {
      if (layerIndex === -1 || layerIndex === idx) {
        const connections = group.getObjectByName('connections');
        if (connections) connections.visible = visible;
      }
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

