/**
 * 标记渲染器
 * 负责渲染起点和终点标记
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class MarkerRenderer {
  constructor(scene, animationController) {
    this.scene = scene;
    this.animationController = animationController;
    this.markersGroup = new THREE.Group();
    scene.add(this.markersGroup);
  }

  /**
   * 更新标记
   */
  update(startNode, endNode, layerHeight, centerX, centerY) {
    this.clear();

    if (startNode) {
      this.renderStartMarker(startNode, layerHeight, centerX, centerY);
    }

    if (endNode) {
      this.renderEndMarker(endNode, layerHeight, centerX, centerY);
    }
  }

  /**
   * 渲染起点标记（蓝色脉冲波纹）
   */
  renderStartMarker(node, layerHeight, centerX, centerY) {
    const y = node.layer * layerHeight;
    const posX = node.x - centerX;
    const posZ = node.y - centerY;

    const config = Renderer3DConfig;

    // 主球体
    const geometry = new THREE.SphereGeometry(config.node.size * 0.8, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: config.colors.startNode,
      emissive: config.colors.startNodeEmissive,
      emissiveIntensity: config.materials.marker.emissiveIntensity,
      metalness: config.materials.marker.metalness,
      roughness: config.materials.marker.roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(posX, y + 1, posZ);
    this.markersGroup.add(mesh);

    // 创建脉冲波纹环
    const rippleConfig = config.animation.ripple;
    for (let i = 0; i < rippleConfig.count; i++) {
      const ringGeo = new THREE.RingGeometry(config.node.size * 1.2, config.node.size * 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: config.colors.startNode,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(posX, y + 0.2, posZ);

      ring.userData = {
        startTime: performance.now() + i * rippleConfig.delay,
        duration: rippleConfig.duration,
        initialScale: 1,
        maxScale: rippleConfig.maxScale,
        baseOpacity: 0.8
      };

      this.animationController.addPulseRing(ring);
      this.markersGroup.add(ring);
    }

    // 光柱
    this.createBeam(posX, y, posZ, config.colors.startNode, config.colors.startNodeEmissive);
  }

  /**
   * 渲染终点标记（红色带脉冲波纹）
   */
  renderEndMarker(node, layerHeight, centerX, centerY) {
    const y = node.layer * layerHeight;
    const posX = node.x - centerX;
    const posZ = node.y - centerY;

    const config = Renderer3DConfig;

    // 主球体
    const geometry = new THREE.SphereGeometry(config.node.size * 0.8, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: config.colors.endNode,
      emissive: config.colors.endNodeEmissive,
      emissiveIntensity: config.materials.marker.emissiveIntensity,
      metalness: config.materials.marker.metalness,
      roughness: config.materials.marker.roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(posX, y + 1, posZ);
    this.markersGroup.add(mesh);

    // 创建脉冲波纹环（与起点相同）
    const rippleConfig = config.animation.ripple;
    for (let i = 0; i < rippleConfig.count; i++) {
      const ringGeo = new THREE.RingGeometry(config.node.size * 1.2, config.node.size * 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: config.colors.endNode,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(posX, y + 0.2, posZ);

      ring.userData = {
        startTime: performance.now() + i * rippleConfig.delay,
        duration: rippleConfig.duration,
        initialScale: 1,
        maxScale: rippleConfig.maxScale,
        baseOpacity: 0.8
      };

      this.animationController.addPulseRing(ring);
      this.markersGroup.add(ring);
    }

    // 光柱
    this.createBeam(posX, y, posZ, config.colors.endNode, config.colors.endNodeEmissive);
  }

  /**
   * 创建光柱
   */
  createBeam(x, y, z, color, emissive) {
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 15, 16);
    const beamMat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
      metalness: 0.8,
      roughness: 0.2
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, y + 7.5, z);
    this.markersGroup.add(beam);
  }

  /**
   * 清除所有标记
   */
  clear() {
    this.markersGroup.clear();
    this.animationController.clearPulseRings();
  }
}
