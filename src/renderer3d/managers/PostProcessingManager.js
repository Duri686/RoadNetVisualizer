/**
 * 后期处理管理器
 * 负责管理Bloom等后期处理效果
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.bloomPass = null;
  }

  /**
   * 初始化后期处理
   */
  init() {
    const { width, height } = this.renderer.getSize(new THREE.Vector2());

    // 创建composer
    this.composer = new EffectComposer(this.renderer);

    // 添加渲染通道
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 添加Bloom通道
    const bloomConfig = Renderer3DConfig.postProcessing.bloom;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      bloomConfig.strength,
      bloomConfig.radius,
      bloomConfig.threshold
    );
    this.composer.addPass(this.bloomPass);

    return this.composer;
  }

  /**
   * 渲染
   */
  render() {
    if (this.composer) {
      this.composer.render();
    }
  }

  /**
   * 调整大小
   */
  setSize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  /**
   * 更新Bloom参数
   */
  updateBloom(strength, radius, threshold) {
    if (this.bloomPass) {
      if (strength !== undefined) this.bloomPass.strength = strength;
      if (radius !== undefined) this.bloomPass.radius = radius;
      if (threshold !== undefined) this.bloomPass.threshold = threshold;
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.composer) {
      this.composer = null;
    }
  }
}
