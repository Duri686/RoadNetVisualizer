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
   * 渲染起点标记（全息定位针风格）
   */
  renderStartMarker(node, layerHeight, centerX, centerY) {
    const y = Renderer3DConfig.layerHeight * (node.layer || 0);
    const posX = node.x - centerX;
    const posZ = node.y - centerY;

    const config = Renderer3DConfig;

    // 主体 - 倒置锥体（定位针形状）
    const coneGeo = new THREE.ConeGeometry(config.node.size * 0.6, config.node.size * 2, 6);
    const coneMat = new THREE.MeshStandardMaterial({
      color: config.colors.startNode,
      emissive: config.colors.startNodeEmissive,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI; // 倒置
    cone.position.set(posX, y + config.node.size * 1.5, posZ);
    cone.castShadow = true;
    this.markersGroup.add(cone);

    // 底部 - 六边形发光环
    const hexRingGeo = new THREE.RingGeometry(config.node.size * 1.5, config.node.size * 2, 6);
    const hexRingMat = new THREE.MeshBasicMaterial({
      color: config.colors.startNode,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const hexRing = new THREE.Mesh(hexRingGeo, hexRingMat);
    hexRing.rotation.x = -Math.PI / 2;
    hexRing.position.set(posX, y + 0.3, posZ);
    this.markersGroup.add(hexRing);

    // 单个脉冲环（简化动画）
    const pulseGeo = new THREE.RingGeometry(config.node.size * 0.8, config.node.size * 1.2, 6);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: config.colors.startNode,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(posX, y + 0.2, posZ);

    pulse.userData = {
      startTime: performance.now(),
      duration: config.animation.ripple.duration,
      initialScale: 1,
      maxScale: config.animation.ripple.maxScale,
      baseOpacity: 0.7,
    };

    this.animationController.addPulseRing(pulse);
    this.markersGroup.add(pulse);

    // 光柱（更细更高更亮）
    this.createBeam(posX, y, posZ, config.colors.startNode, config.colors.startNodeEmissive, 0.15, 25);
  }

  /**
   * 渲染终点标记（全息定位针风格 - 红色）
   */
  renderEndMarker(node, layerHeight, centerX, centerY) {
    const y = Renderer3DConfig.layerHeight * (node.layer || 0);
    const posX = node.x - centerX;
    const posZ = node.y - centerY;

    const config = Renderer3DConfig;

    // 主体 - 倒置锥体（定位针形状）
    const coneGeo = new THREE.ConeGeometry(config.node.size * 0.6, config.node.size * 2, 6);
    const coneMat = new THREE.MeshStandardMaterial({
      color: config.colors.endNode,
      emissive: config.colors.endNodeEmissive,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI; // 倒置
    cone.position.set(posX, y + config.node.size * 1.5, posZ);
    cone.castShadow = true;
    this.markersGroup.add(cone);

    // 底部 - 六边形发光环
    const hexRingGeo = new THREE.RingGeometry(config.node.size * 1.5, config.node.size * 2, 6);
    const hexRingMat = new THREE.MeshBasicMaterial({
      color: config.colors.endNode,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const hexRing = new THREE.Mesh(hexRingGeo, hexRingMat);
    hexRing.rotation.x = -Math.PI / 2;
    hexRing.position.set(posX, y + 0.3, posZ);
    this.markersGroup.add(hexRing);

    // 单个脉冲环
    const pulseGeo = new THREE.RingGeometry(config.node.size * 0.8, config.node.size * 1.2, 6);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: config.colors.endNode,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(posX, y + 0.2, posZ);

    pulse.userData = {
      startTime: performance.now(),
      duration: config.animation.ripple.duration,
      initialScale: 1,
      maxScale: config.animation.ripple.maxScale,
      baseOpacity: 0.7,
    };

    this.animationController.addPulseRing(pulse);
    this.markersGroup.add(pulse);

    // 光柱（更细更高更亮）
    this.createBeam(posX, y, posZ, config.colors.endNode, config.colors.endNodeEmissive, 0.15, 25);
  }

  /**
   * 创建光柱（可自定义尺寸）
   */
  createBeam(x, y, z, color, emissive, radius = 0.3, height = 15) {
    const beamGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    const beamMat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      metalness: 0.9,
      roughness: 0.1,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, y + height / 2, z);
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
