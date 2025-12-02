/**
 * 动画控制器
 * 负责管理所有动画（脉冲波纹、节点脉动、路径动画等）
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class AnimationController {
  constructor(scene) {
    this.scene = scene;
    this.pulseRings = [];
    this.animations = [];

    // 缓存脉动对象，避免每帧遍历场景
    this.pulsingMeshes = [];

    // 复用对象，避免每帧创建新对象
    this._tempPosition = new THREE.Vector3();
    this._tempRotation = new THREE.Quaternion();
    this._tempScale = new THREE.Vector3();
    this._tempMatrix = new THREE.Matrix4();
  }

  /**
   * 更新所有动画
   */
  update(timeMs) {
    this.updatePulseRings(timeMs);
    this.updateNodePulsing(timeMs * 0.001); // 转换为秒
  }

  /**
   * 更新脉冲波纹动画
   */
  updatePulseRings(time) {
    this.pulseRings.forEach((ring) => {
      const elapsed = time - ring.userData.startTime;
      if (elapsed < 0) return;

      const progress =
        (elapsed % ring.userData.duration) / ring.userData.duration;
      const scale =
        ring.userData.initialScale +
        (ring.userData.maxScale - ring.userData.initialScale) * progress;
      ring.scale.set(scale, scale, 1);

      const opacity = ring.userData.baseOpacity * (1 - progress);
      ring.material.opacity = opacity;
    });
  }

  /**
   * 更新节点脉动动画（高性能版本）
   */
  updateNodePulsing(time) {
    // 降低更新频率，每5帧更新一次（从3帧改为5帧）
    if (Math.floor(time * 60) % 5 !== 0) return;

    // 使用缓存的脉动对象，避免遍历整个场景
    for (
      let meshIndex = 0;
      meshIndex < this.pulsingMeshes.length;
      meshIndex++
    ) {
      const child = this.pulsingMeshes[meshIndex];

      if (!child.userData.isPulsing || !child.userData.originalMatrices) {
        continue;
      }

      const pulseScale =
        1 +
        Math.sin(time * child.userData.pulseSpeed) * child.userData.pulseAmount;

      // 复用临时对象，避免内存分配
      const position = this._tempPosition;
      const rotation = this._tempRotation;
      const scale = this._tempScale;
      const matrix = this._tempMatrix;

      for (let i = 0; i < child.count; i++) {
        const originalMatrix = child.userData.originalMatrices[i];

        // 分解原始矩阵
        originalMatrix.decompose(position, rotation, scale);

        // 应用脉动缩放
        scale.multiplyScalar(pulseScale);

        // 重组矩阵
        matrix.compose(position, rotation, scale);
        child.setMatrixAt(i, matrix);
      }
      child.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * 注册需要脉动的网格（避免每帧遍历场景）
   */
  registerPulsingMesh(mesh) {
    if (!this.pulsingMeshes.includes(mesh)) {
      this.pulsingMeshes.push(mesh);
    }
  }

  /**
   * 取消注册脉动网格
   */
  unregisterPulsingMesh(mesh) {
    const index = this.pulsingMeshes.indexOf(mesh);
    if (index > -1) {
      this.pulsingMeshes.splice(index, 1);
    }
  }

  /**
   * 添加脉冲环
   */
  addPulseRing(ring) {
    this.pulseRings.push(ring);
  }

  /**
   * 清除所有脉冲环
   */
  clearPulseRings() {
    this.pulseRings = [];
  }

  /**
   * 清除所有动画
   */
  dispose() {
    this.pulseRings = [];
    this.animations = [];
    this.pulsingMeshes = [];
  }
}
