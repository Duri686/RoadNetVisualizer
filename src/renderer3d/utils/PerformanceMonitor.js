/**
 * 性能监控器
 * 监控FPS并自动调整渲染质量
 */

export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.fpsHistory = [];
    this.maxHistoryLength = 60; // 1秒的历史记录

    // 性能阈值
    this.lowFpsThreshold = 30;
    this.highFpsThreshold = 55;

    // 质量等级
    this.qualityLevel = 'high'; // 'low', 'medium', 'high'
  }

  /**
   * 更新FPS计算
   */
  update() {
    this.frameCount++;
    const currentTime = performance.now();

    if (currentTime - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;

      // 记录FPS历史
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }

      // 自动调整质量
      this.adjustQuality();
    }
  }

  /**
   * 根据FPS自动调整渲染质量
   */
  adjustQuality() {
    if (this.fpsHistory.length < 10) return; // 需要足够的数据

    const avgFps =
      this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    if (avgFps < this.lowFpsThreshold && this.qualityLevel !== 'low') {
      this.qualityLevel = 'low';
      console.log('🔽 降低渲染质量以提高性能');
      return 'downgrade';
    } else if (avgFps > this.highFpsThreshold && this.qualityLevel !== 'high') {
      this.qualityLevel = 'high';
      console.log('🔼 提高渲染质量');
      return 'upgrade';
    }

    return 'stable';
  }

  /**
   * 获取当前FPS
   */
  getFPS() {
    return this.fps;
  }

  /**
   * 获取质量等级
   */
  getQualityLevel() {
    return this.qualityLevel;
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations() {
    const recommendations = [];

    if (this.fps < 20) {
      recommendations.push('禁用阴影');
      recommendations.push('降低节点复杂度');
      recommendations.push('减少透明物体');
    } else if (this.fps < 30) {
      recommendations.push('降低阴影质量');
      recommendations.push('减少动画频率');
    }

    return recommendations;
  }
}
