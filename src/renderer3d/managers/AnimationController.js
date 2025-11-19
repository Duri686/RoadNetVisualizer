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
    this.pulseRings.forEach(ring => {
      const elapsed = time - ring.userData.startTime;
      if (elapsed < 0) return;

      const progress = (elapsed % ring.userData.duration) / ring.userData.duration;
      const scale = ring.userData.initialScale + 
                   (ring.userData.maxScale - ring.userData.initialScale) * progress;
      ring.scale.set(scale, scale, 1);

      const opacity = ring.userData.baseOpacity * (1 - progress);
      ring.material.opacity = opacity;
    });
  }

  /**
   * 更新节点脉动动画
   */
  updateNodePulsing(time) {
    this.scene.traverse((child) => {
      if (child.isInstancedMesh && child.userData.isPulsing && child.userData.originalMatrices) {
        const pulseScale = 1 + Math.sin(time * child.userData.pulseSpeed) * child.userData.pulseAmount;

        for (let i = 0; i < child.count; i++) {
          const originalMatrix = child.userData.originalMatrices[i];
          
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          originalMatrix.decompose(position, rotation, scale);

          // 应用脉动缩放
          scale.multiplyScalar(pulseScale);
          
          const matrix = new THREE.Matrix4();
          matrix.compose(position, rotation, scale);
          child.setMatrixAt(i, matrix);
        }
        child.instanceMatrix.needsUpdate = true;
      }
    });
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
  }
}
