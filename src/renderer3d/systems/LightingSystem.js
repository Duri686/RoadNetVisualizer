/**
 * 光照系统
 * 负责创建和管理所有光源
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class LightingSystem {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
  }

  /**
   * 初始化所有光源
   */
  init() {
    this.createAmbientLight();
    this.createHemisphereLight();
    this.createDirectionalLight();
    this.createPointLights();
  }

  /**
   * 创建环境光
   */
  createAmbientLight() {
    const { color, intensity } = Renderer3DConfig.lighting.ambient;
    const light = new THREE.AmbientLight(color, intensity);
    this.scene.add(light);
    this.lights.push(light);
    return light;
  }

  /**
   * 创建半球光
   */
  createHemisphereLight() {
    const { skyColor, groundColor, intensity } = Renderer3DConfig.lighting.hemisphere;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    light.position.set(0, 100, 0);
    this.scene.add(light);
    this.lights.push(light);
    return light;
  }

  /**
   * 创建平行光（带阴影）
   */
  createDirectionalLight() {
    const { color, intensity, position } = Renderer3DConfig.lighting.directional;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(position.x, position.y, position.z);
    light.castShadow = true;

    // 配置阴影
    const shadowConfig = Renderer3DConfig.shadow;
    light.shadow.mapSize.width = shadowConfig.mapSize;
    light.shadow.mapSize.height = shadowConfig.mapSize;
    light.shadow.camera.near = shadowConfig.camera.near;
    light.shadow.camera.far = shadowConfig.camera.far;
    light.shadow.camera.left = shadowConfig.camera.left;
    light.shadow.camera.right = shadowConfig.camera.right;
    light.shadow.camera.top = shadowConfig.camera.top;
    light.shadow.camera.bottom = shadowConfig.camera.bottom;
    light.shadow.bias = shadowConfig.bias;

    this.scene.add(light);
    this.lights.push(light);
    return light;
  }

  /**
   * 创建点光源
   */
  createPointLights() {
    const pointLights = [];
    
    Renderer3DConfig.lighting.pointLights.forEach(config => {
      const light = new THREE.PointLight(config.color, config.intensity, config.distance);
      light.position.set(config.position.x, config.position.y, config.position.z);
      this.scene.add(light);
      this.lights.push(light);
      pointLights.push(light);
    });

    return pointLights;
  }

  /**
   * 移除所有光源
   */
  dispose() {
    this.lights.forEach(light => {
      this.scene.remove(light);
    });
    this.lights = [];
  }
}
