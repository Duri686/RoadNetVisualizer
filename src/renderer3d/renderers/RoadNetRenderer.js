/**
 * 道路网络渲染器
 * 负责渲染节点、边和障碍物
 */

import {
  renderLayer as renderLayerModule,
  renderNodes as renderNodesModule,
  renderEdges as renderEdgesModule,
  renderBaseTriangulation as renderBaseTriangulationModule,
  renderGrid as renderGridModule,
} from './LayerRenderer.js';
import { renderObstacles as renderObstaclesModule } from './ObstacleRenderer.js';
import { renderFloorConnections as renderFloorConnectionsModule } from './FloorConnectionRenderer.js';

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
      this.renderObstacles(
        data.obstacles,
        centerX,
        centerY,
        totalFloors,
        data.layers,
      );
    }

    // 渲染楼梯/电梯
    if (
      data.metadata.floorConnections &&
      data.metadata.floorConnections.length > 0
    ) {
      this.renderFloorConnections(
        data.metadata.floorConnections,
        centerX,
        centerY,
      );
    }

    return { centerX, centerY };
  }

  /**
   * 渲染单层
   */
  renderLayer(layer, index, centerX, centerY, metadata) {
    renderLayerModule(
      this.scene,
      this.layerGroups,
      this.nodesMesh,
      layer,
      index,
      centerX,
      centerY,
      metadata,
    );
  }

  /**
   * 渲染节点
   */
  renderNodes(nodes, layerGroup, yOffset, centerX, centerY, layerIndex) {
    renderNodesModule(
      this.nodesMesh,
      nodes,
      layerGroup,
      yOffset,
      centerX,
      centerY,
      layerIndex,
    );
  }

  /**
   * 渲染边
   */
  renderEdges(
    edges,
    nodes,
    layerGroup,
    yOffset,
    centerX,
    centerY,
    layerMetadata,
  ) {
    renderEdgesModule(
      edges,
      nodes,
      layerGroup,
      yOffset,
      centerX,
      centerY,
      layerMetadata,
    );
  }

  /**
   * 渲染基础三角化
   */
  renderBaseTriangulation(overlayBase, layerGroup, yOffset, centerX, centerY) {
    renderBaseTriangulationModule(
      overlayBase,
      layerGroup,
      yOffset,
      centerX,
      centerY,
    );
  }

  /**
   * 渲染网格
   */
  renderGrid(layerGroup, metadata, yOffset) {
    renderGridModule(layerGroup, metadata, yOffset);
  }

  /**
   * 渲染障碍物 - 支持每层独立渲染
   */
  renderObstacles(obstacles, centerX, centerY, totalFloors, layers) {
    const obstacleGroup = renderObstaclesModule(
      this.scene,
      obstacles,
      centerX,
      centerY,
      totalFloors,
      layers,
    );

    if (obstacleGroup) {
      this.obstacleGroup = obstacleGroup;
    }
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
    this.layerGroups.forEach((group) => {
      const nodes = group.getObjectByName('nodes');
      if (nodes) nodes.visible = visible;
    });
  }

  /**
   * 切换边可见性
   */
  toggleEdges(visible) {
    this.layerGroups.forEach((group) => {
      const edges = group.getObjectByName('edges');
      if (edges) edges.visible = visible;
    });
  }

  /**
   * 切换基础三角化可见性
   */
  toggleBaseTriangulation(visible) {
    this.layerGroups.forEach((group) => {
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
    renderFloorConnectionsModule(
      this.layerGroups,
      connections,
      centerX,
      centerY,
    );
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
    this.layerGroups.forEach((group) => {
      const voronoi = group.getObjectByName('voronoi');
      if (voronoi) voronoi.visible = visible;
    });
  }
}
