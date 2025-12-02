/**
 * 场景管理器
 * 负责Three.js场景、相机和渲染器的创建和管理
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.container = null;
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * 初始化场景
   */
  init(container, options = {}) {
    this.container = container;
    const width = options.width || container.clientWidth;
    const height = options.height || container.clientHeight;

    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Renderer3DConfig.colors.background);
    this.scene.fog = new THREE.FogExp2(
      Renderer3DConfig.colors.background,
      Renderer3DConfig.fog.density,
    );

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(0, 0, 0);

    // 创建渲染器（性能优化版本）
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // 禁用抗锯齿提高性能
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance', // 使用高性能GPU
    });
    this.renderer.setSize(width, height);
    // 限制像素比，避免在高DPI设备上过度渲染
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 优化阴影设置
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // 使用基础阴影提高性能
    this.renderer.shadowMap.autoUpdate = false; // 禁用自动更新，手动控制

    // 改善透明度渲染
    this.renderer.sortObjects = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 创建控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    return {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      controls: this.controls,
    };
  }

  /**
   * 调整大小
   */
  resize() {
    if (!this.camera || !this.renderer || !this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * 设置相机位置
   */
  setCameraPosition(x, y, z) {
    if (this.camera) {
      this.camera.position.set(x, y, z);
      if (this.controls) {
        this.controls.update();
      }
    }
  }

  /**
   * 设置控制器目标
   */
  setControlsTarget(x, y, z) {
    if (this.controls) {
      this.controls.target.set(x, y, z);
      this.controls.update();
    }
  }

  /**
   * 清理场景
   */
  clear() {
    if (!this.scene) return;

    const toRemove = [];
    this.scene.traverse((child) => {
      if (child.isMesh || child.isGroup || child.isLine) {
        toRemove.push(child);
      }
    });

    toRemove.forEach((child) => {
      this.scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * 更新性能监控（在渲染循环中调用）
   */
  updatePerformance() {
    this.performanceMonitor.update();
    const qualityChange = this.performanceMonitor.adjustQuality();

    if (qualityChange === 'downgrade') {
      this.applyLowQualitySettings();
    } else if (qualityChange === 'upgrade') {
      this.applyHighQualitySettings();
    }
  }

  /**
   * 应用低质量设置
   */
  applyLowQualitySettings() {
    if (!this.renderer) return;

    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    console.log('⚡ 应用低质量设置');
  }

  /**
   * 应用高质量设置
   */
  applyHighQualitySettings() {
    if (!this.renderer) return;

    this.renderer.shadowMap.enabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    console.log('✨ 应用高质量设置');
  }

  /**
   * 获取性能信息
   */
  getPerformanceInfo() {
    return {
      fps: this.performanceMonitor.getFPS(),
      quality: this.performanceMonitor.getQualityLevel(),
      recommendations: this.performanceMonitor.getPerformanceRecommendations(),
    };
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement) {
        if (this.container.contains(this.renderer.domElement)) {
          this.container.removeChild(this.renderer.domElement);
        }
      }
    }
  }
}
