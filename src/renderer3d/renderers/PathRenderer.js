/**
 * 路径渲染器
 * 负责渲染和动画化路径
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class PathRenderer {
  constructor(scene) {
    this.scene = scene;
    this.pathGroup = new THREE.Group();
    this.pathShader = null;
    scene.add(this.pathGroup);
  }

  /**
   * 绘制路径
   */
  drawPath(path, layerHeight, centerX, centerY) {
    this.clear();
    if (!path || path.length === 0) return;

    const curvePath = new THREE.CurvePath();

    // Helper to get vector from node
    const getVec = (node) => {
      const y = Renderer3DConfig.layerHeight * (node.layer || 0);
      return new THREE.Vector3(node.x - centerX, y, node.y - centerY);
    };

    // 使用折线（LineCurve3）严格沿离散节点连线
    for (let i = 0; i < path.length - 1; i++) {
      const node = path[i];
      const nextNode = path[i + 1];
      const start = getVec(node);
      const end = getVec(nextNode);
      const line = new THREE.LineCurve3(start, end);
      curvePath.add(line);
    }

    // Create geometry from CurvePath
    // 仍然使用 TubeGeometry，但中心线严格遵循 2D 折线路径
    const tubeGeo = new THREE.TubeGeometry(
      curvePath,
      path.length * 8,
      0.35,
      8,
      false,
    );

    // 创建着色器材质
    const shaderMat = this.createPathShader();
    const tube = new THREE.Mesh(tubeGeo, shaderMat);
    tube.name = 'pathTube';
    this.pathGroup.add(tube);

    this.pathShader = shaderMat;
    return tube;
  }

  /**
   * 创建路径着色器
   */
  createPathShader() {
    const config = Renderer3DConfig.colors;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
        colorActive: { value: new THREE.Color(config.pathActive) },
        colorBurned: { value: new THREE.Color(config.pathBurned) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float progress;
        uniform vec3 colorActive;
        uniform vec3 colorBurned;
        varying vec2 vUv;
        
        void main() {
          float pos = vUv.x;
          float edge = progress;
          float transition = 0.05;
          
          if (edge >= 0.98) {
            gl_FragColor = vec4(colorBurned, 0.6);
          } else if (pos < edge - transition) {
            gl_FragColor = vec4(colorBurned, 0.6);
          } else if (pos < edge + transition) {
            float t = (pos - (edge - transition)) / (transition * 2.0);
            t = clamp(t, 0.0, 1.0);
            vec3 color = mix(colorBurned, colorActive, t);
            float alpha = mix(0.6, 1.0, t);
            gl_FragColor = vec4(color, alpha);
          } else {
            gl_FragColor = vec4(colorActive, 1.0);
          }
        }
      `,
      side: THREE.DoubleSide,
    });
  }

  /**
   * 更新路径着色器
   */
  updateShader(progress, time) {
    if (this.pathShader) {
      this.pathShader.uniforms.progress.value = progress;
      this.pathShader.uniforms.time.value = time;
    }
  }

  /**
   * 清除路径
   */
  clear() {
    this.pathGroup.clear();
    this.pathShader = null;
  }
}
