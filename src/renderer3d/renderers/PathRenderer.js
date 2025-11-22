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
  /**
   * 绘制路径
   */
  drawPath(path, layerHeight, centerX, centerY) {
    this.clear();
    if (!path || path.length === 0) return;

    const curvePath = new THREE.CurvePath();
    let currentSegment = [];

    // Helper to get vector from node
    const getVec = (node) => {
      const y = Renderer3DConfig.layerHeight * (node.layer || 0);
      return new THREE.Vector3(node.x - centerX, y, node.y - centerY);
    };

    // Build segments
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      currentSegment.push(getVec(node));

      // Check if next node exists and is on a different layer (vertical jump)
      if (i < path.length - 1) {
        const nextNode = path[i + 1];
        const currentLayer = node.layer || 0;
        const nextLayer = nextNode.layer || 0;

        if (currentLayer !== nextLayer) {
          // 1. Finish current floor segment (if valid)
          if (currentSegment.length > 1) {
            // Use CatmullRom for floor movement
            const curve = new THREE.CatmullRomCurve3(currentSegment);
            // curve.tension = 0.5; // Default
            curvePath.add(curve);
          }
          
          // 2. Add vertical line segment
          const start = getVec(node);
          const end = getVec(nextNode);
          const line = new THREE.LineCurve3(start, end);
          curvePath.add(line);
          
          // 3. Start new segment with the next node
          currentSegment = []; 
          // Note: we don't push nextNode here because it will be pushed in next iteration
          // But CatmullRom needs at least 2 points. 
          // If we start a new segment, the first point should be the start of that segment.
          // So actually, we should start the new segment with nextNode?
          // Wait, CatmullRomCurve3(points) goes through all points.
          // If we have A->B (vertical), then B->C->D (floor).
          // The vertical line is A->B.
          // The floor curve is B->C->D.
          // So we need to ensure B is the start of the next segment.
        }
      }
    }

    // Add remaining segment
    if (currentSegment.length > 1) {
      const curve = new THREE.CatmullRomCurve3(currentSegment);
      curvePath.add(curve);
    }
    
    // Handle edge case: if path has only 2 points and they are on same floor (simple line)
    // The loop above handles it (currentSegment has 2 points, added at end)
    
    // Handle edge case: path has 2 points, different floors (simple vertical)
    // Loop: i=0. currentSegment=[A]. Vertical jump detected.
    // currentSegment length is 1, so no curve added.
    // Line A->B added.
    // currentSegment reset to [].
    // i=1. currentSegment=[B]. Loop ends.
    // Remaining segment [B] length 1, ignored.
    // Result: Line A->B. Correct.

    // Create geometry from CurvePath
    // Note: CurvePath.getPoints() or just passing it to TubeGeometry works
    const tubeGeo = new THREE.TubeGeometry(curvePath, path.length * 8, 0.35, 8, false);

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
        colorBurned: { value: new THREE.Color(config.pathBurned) }
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
      side: THREE.DoubleSide
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
