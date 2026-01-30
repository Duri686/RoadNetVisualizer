/**
 * 路径动画管理器
 * 负责管理路径沿线移动的动画球和相机跟随
 */

import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export class PathAnimationManager {
  constructor(scene, camera, controls) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.agent = null;
    this.animationId = null;
    this.originalCameraPosition = null;
    this.originalControlsTarget = null;
  }

  /**
   * 开始路径动画（带相机跟随）
   */
  start(path, layerHeight, centerX, centerY, pathShader) {
    this.stop();

    if (!path || path.length < 2) return;

    // 保存原始相机位置
    this.originalCameraPosition = this.camera.position.clone();
    this.originalControlsTarget = this.controls.target.clone();

    // 创建动画标记组 - 聚焦标记设计（对比色）
    this.agent = new THREE.Group();
    this.agent.name = 'movingAgent';

    // 核心球体 - Amber 高对比能量核心
    const coreGeo = new THREE.SphereGeometry(1.0, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // Amber 400
      emissive: 0xf59e0b, // Amber 500
      emissiveIntensity: 1.5, // 更强发光
      metalness: 0.8,
      roughness: 0.15,
      transparent: true,
      opacity: 1.0,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.agent.add(core);

    // 外层光晕环 - 白色脉冲环（增强聚焦）
    const ringGeo = new THREE.RingGeometry(1.5, 2.0, 6); // 六边形环
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7, // Amber 100 浅色
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; // 水平放置
    ring.name = 'pulseRing';
    this.agent.add(ring);

    // 顶部箭头指示器 - 白色倒三角
    const arrowGeo = new THREE.ConeGeometry(0.5, 1.5, 3);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.0,
      metalness: 0.6,
      roughness: 0.2,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = Math.PI; // 倒置朝下
    arrow.position.y = 2.0; // 在核心上方
    this.agent.add(arrow);

    this.scene.add(this.agent);

    // 创建折线路径（与 PathRenderer 中的 TubeGeometry 中心线完全一致）
    const curvePath = new THREE.CurvePath();
    const getVec = (node) => {
      const y = node.layer * layerHeight;
      return new THREE.Vector3(node.x - centerX, y, node.y - centerY);
    };

    for (let i = 0; i < path.length - 1; i++) {
      const start = getVec(path[i]);
      const end = getVec(path[i + 1]);
      const line = new THREE.LineCurve3(start, end);
      curvePath.add(line);
    }

    const curve = curvePath;

    // 计算曲线总长度
    const curveLength = curve.getLength();

    // 根据真实距离计算动画时长，使用配置中的速度
    const walkingSpeed = Renderer3DConfig.animation.walkingSpeed; // 从配置读取
    const duration = (curveLength / walkingSpeed) * 1000; // 转换为毫秒

    console.log(
      `路径长度: ${curveLength.toFixed(
        2,
      )} 单位, 速度: ${walkingSpeed} 单位/秒, 动画时长: ${(
        duration / 1000
      ).toFixed(2)} 秒`,
    );

    const startTime = performance.now();

    // 动画循环
    const animate = () => {
      if (!this.agent || !this.agent.parent) return;

      const elapsed = performance.now() - startTime;
      const globalProgress = Math.min(1, elapsed / duration);

      // 沿着折线曲线移动 agent（与渲染路径完全对齐）
      const point = curve.getPointAt(globalProgress);

      // 设置标记位置，抬高使其浮在路径上方
      this.agent.position.set(
        point.x,
        point.y + 2.5, // 在路径上方
        point.z,
      );

      // 脉冲环动画 - 呼吸效果
      const pulseRing = this.agent.getObjectByName('pulseRing');
      if (pulseRing) {
        const pulseScale = 1 + Math.sin(elapsed * 0.005) * 0.2;
        pulseRing.scale.set(pulseScale, pulseScale, 1);
        pulseRing.material.opacity = 0.4 + Math.sin(elapsed * 0.008) * 0.2;
      }

      // 更新相机跟随
      this.updateCameraFollow(globalProgress);

      // 更新shader
      if (pathShader) {
        const burnProgress = Math.min(1, globalProgress + 0.02);
        pathShader.uniforms.progress.value = burnProgress;
        pathShader.uniforms.time.value = elapsed * 0.001;
      }

      if (globalProgress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        // 动画结束，平滑恢复相机
        this.restoreCamera();
      }
    };

    animate();
  }

  /**
   * 更新相机跟随（导航式俯视角）
   * 更接近正上方的俯视，像手机地图导航
   */
  updateCameraFollow(progress) {
    if (!this.agent) return;

    const agentPos = this.agent.position;

    // 导航式视角：从Z轴正方向，接近垂直俯视
    // 高度 > 后退距离 = 更陡峭的俯视角
    const height = 40; // 高度（增加以获得更俯视的效果）
    const backDistance = 15; // 后退距离（减少以接近垂直）

    // 相机位置：在agent的Z轴正方向（稍后方）和上方
    const targetCameraPos = new THREE.Vector3(
      agentPos.x, // X轴保持一致
      agentPos.y + height, // 上方（更高）
      agentPos.z + backDistance, // Z轴正方向后退（较少）
    );

    // 平滑插值到目标位置
    this.camera.position.lerp(targetCameraPos, 0.1);

    // 相机看向agent稍前方（Z轴负方向 = 屏幕上方）
    const lookAtTarget = new THREE.Vector3(
      agentPos.x,
      agentPos.y,
      agentPos.z - 10, // 看向前方更远处，能看到更多路径
    );
    this.controls.target.lerp(lookAtTarget, 0.1);
    this.controls.update();
  }

  /**
   * 平滑恢复相机位置
   */
  restoreCamera() {
    if (!this.originalCameraPosition || !this.originalControlsTarget) return;

    const restoreDuration = 1000; // 1秒恢复
    const startTime = performance.now();
    const startCameraPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    const restore = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / restoreDuration);

      // 使用easeOutCubic缓动
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(
        startCameraPos,
        this.originalCameraPosition,
        eased,
      );
      this.controls.target.lerpVectors(
        startTarget,
        this.originalControlsTarget,
        eased,
      );
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(restore);
      }
    };

    restore();
  }

  /**
   * 停止动画
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.agent) {
      this.scene.remove(this.agent);
      this.agent = null;
    }
  }
}
