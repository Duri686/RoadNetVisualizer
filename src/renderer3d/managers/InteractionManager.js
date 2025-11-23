/**
 * 交互管理器
 * 负责处理用户交互（点击、hover等）
 */

import * as THREE from 'three';

export class InteractionManager {
  constructor(camera) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // 交互状态
    this.state = {
      startNode: null,
      endNode: null,
      lastPath: null,
    };
  }

  /**
   * 更新鼠标位置
   */
  updatePointer(event, domElement) {
    const rect = domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * 查找最近的节点
   */
  findNearestNode(roadNetData, layerHeight, currentLayer, visibleLayers) {
    if (!roadNetData) return null;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    let closestNode = null;
    let minDistance = Infinity;

    roadNetData.layers.forEach((layer, index) => {
      if (currentLayer !== null && currentLayer !== index) return;
      if (
        visibleLayers &&
        typeof visibleLayers.has === 'function' &&
        !visibleLayers.has(index)
      ) {
        return;
      }

      const layerY = index * layerHeight;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -layerY);
      const target = new THREE.Vector3();
      const intersection = this.raycaster.ray.intersectPlane(plane, target);

      if (intersection) {
        const centerX = (roadNetData.metadata.width || 100) / 2;
        const centerY = (roadNetData.metadata.height || 100) / 2;
        const hitX = target.x + centerX;
        const hitY = target.z + centerY;

        for (let i = 0; i < layer.nodes.length; i++) {
          const node = layer.nodes[i];
          const dx = node.x - hitX;
          const dy = node.y - hitY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDistance) {
            minDistance = dist;
            closestNode = node;
          }
        }
      }
    });

    return { node: closestNode, distance: minDistance };
  }

  /**
   * 处理节点点击
   */
  handleNodeClick(node) {
    if (!this.state.startNode) {
      this.state.startNode = node;
      return { type: 'start', node };
    } else if (!this.state.endNode) {
      this.state.endNode = node;
      return { type: 'end', node, start: this.state.startNode };
    } else {
      this.state.startNode = node;
      this.state.endNode = null;
      return { type: 'reset', node };
    }
  }

  /**
   * 清除交互状态
   */
  clear() {
    this.state.startNode = null;
    this.state.endNode = null;
    this.state.lastPath = null;
  }

  /**
   * 清除路径
   */
  clearPath() {
    this.state.lastPath = null;
  }
}
