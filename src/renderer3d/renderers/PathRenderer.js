/**
 * Path Renderer
 * Renders the navigation path with a dynamic shader effect and a ground glow.
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class PathRenderer {
  constructor(scene) {
    this.scene = scene;
    this.pathGroup = new THREE.Group();
    this.pathShader = null;
    this.groundShader = null;
    scene.add(this.pathGroup);
  }

  /**
   * Draw the path
   */
  drawPath(path, layerHeight, centerX, centerY) {
    this.clear();
    if (!path || path.length === 0) return;

    const points = [];
    const curvePath = new THREE.CurvePath();

    for (let i = 0; i < path.length - 1; i++) {
      const node = path[i];
      const nextNode = path[i + 1];

      const y1 = Renderer3DConfig.layerHeight * (node.layer || 0);
      const y2 = Renderer3DConfig.layerHeight * (nextNode.layer || 0);

      const start = new THREE.Vector3(node.x - centerX, y1 + 0.5, node.y - centerY);
      const end = new THREE.Vector3(nextNode.x - centerX, y2 + 0.5, nextNode.y - centerY);

      const line = new THREE.LineCurve3(start, end);
      curvePath.add(line);

      if (i === 0) points.push(start);
      points.push(end);
    }

    // 1. Main Path Tube
    const tubeGeo = new THREE.TubeGeometry(
      curvePath,
      path.length * 10, // Higher resolution
      0.4, // Radius
      8,
      false
    );

    const shaderMat = this.createPathShader();
    const tube = new THREE.Mesh(tubeGeo, shaderMat);
    tube.name = 'pathTube';
    tube.renderOrder = 2000; // Render on top of floor
    this.pathGroup.add(tube);
    this.pathShader = shaderMat;

    // 2. Ground Projection (Shadow/Glow)
    // We create a flat ribbon on the floor.
    // For simplicity, we can reuse the tube geometry but scale it flat?
    // No, TubeGeometry is 3D. Let's make a flat ribbon using the points.
    // Or just a flattened tube slightly larger.

    const groundGeo = new THREE.TubeGeometry(
        curvePath,
        path.length * 10,
        0.8, // Wider
        8,
        false
    );

    const groundMat = this.createGroundShader();
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.scale.set(1, 0.05, 1); // Flatten it
    groundMesh.position.y = -0.4; // Slightly below the main path

    // We need to adjust position if path changes height (e.g. ramps).
    // Since we flatten it, the Y is relative to the path center.
    // A flattened tube will look like a ribbon.

    groundMesh.name = 'pathGround';
    groundMesh.renderOrder = 1999;
    this.pathGroup.add(groundMesh);
    this.groundShader = groundMat;

    return tube;
  }

  createPathShader() {
    const config = Renderer3DConfig.colors;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
        colorActive: { value: new THREE.Color(config.pathActive) },
        colorBurned: { value: new THREE.Color(config.pathBurned) },
      },
      transparent: true,
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
          float u = vUv.x; // Along the path

          // Moving arrow pattern
          float arrowFreq = 10.0;
          float arrowSpeed = time * 2.0;
          float arrow = mod(u * arrowFreq - arrowSpeed, 1.0);
          arrow = smoothstep(0.0, 0.5, arrow) * smoothstep(1.0, 0.5, arrow);

          // Flowing pulse
          float pulse = sin(u * 20.0 - time * 5.0) * 0.5 + 0.5;

          // Combine colors
          vec3 baseColor = colorActive;

          // Add pulse brightness
          baseColor += vec3(pulse * 0.3);
          
          // Add arrow brightness
          baseColor += vec3(arrow * 0.5);

          // Progress masking logic (similar to original but enhanced)
          // For now, let's keep the whole path visible but animated as requested "dynamic path"
          // If we want to hide future path:
          // if (u > progress) discard; or fade out.

          // Let's make a nice glowy edge
          float v = abs(vUv.y - 0.5) * 2.0;
          float edgeGlow = 1.0 - smoothstep(0.0, 1.0, v);

          gl_FragColor = vec4(baseColor, edgeGlow * 0.9 + 0.1);
        }
      `,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Don't write depth for glowy effect
    });
  }

  createGroundShader() {
      const config = Renderer3DConfig.colors;
      return new THREE.ShaderMaterial({
          uniforms: {
              colorActive: { value: new THREE.Color(config.pathActive) }
          },
          transparent: true,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 colorActive;
            varying vec2 vUv;
            void main() {
               // Soft glow from center
               float v = abs(vUv.y - 0.5) * 2.0;
               float alpha = (1.0 - v) * 0.4;
               alpha = pow(alpha, 2.0); // Soften

               gl_FragColor = vec4(colorActive, alpha);
            }
          `,
          side: THREE.DoubleSide,
          depthWrite: false,
      });
  }

  updateShader(progress, time) {
    if (this.pathShader) {
      this.pathShader.uniforms.progress.value = progress;
      this.pathShader.uniforms.time.value = time;
    }
  }

  clear() {
    this.pathGroup.clear();
    this.pathShader = null;
    this.groundShader = null;
  }
}
