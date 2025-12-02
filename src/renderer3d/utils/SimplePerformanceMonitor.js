/**
 * 简化版性能监控 - 用于调试
 * 显示真实的渲染性能（基于实际工作时间，而非帧间隔）
 */

export class SimplePerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastReportTime = performance.now();
    this.reportInterval = 1000; // 每秒报告一次
    this.enabled = false; // 默认禁用，避免日志噪音

    console.log('[PerformanceMonitor] ✅ SimplePerformanceMonitor 已创建');
    console.log(
      '[PerformanceMonitor] 💡 使用 window.roadNetApp.renderer.simpleMonitor.setEnabled(true) 启用',
    );
  }

  /**
   * 更新（从 PerformanceProfiler 获取真实数据）
   * @param {Object} profilerStats - 来自 PerformanceProfiler 的统计数据
   */
  update(profilerStats = null) {
    if (!this.enabled) return;

    this.frameCount++;
    const now = performance.now();

    // 每秒输出一次
    if (now - this.lastReportTime >= this.reportInterval) {
      if (profilerStats) {
        // 使用 PerformanceProfiler 的真实数据
        console.log(
          `[PerformanceMonitor] 📊 真实 FPS: ${profilerStats.fps.toFixed(
            1,
          )} | 帧时间: ${profilerStats.frameTime.toFixed(2)}ms | 样本数: ${
            profilerStats.samples
          }`,
        );
      } else {
        // 降级：只显示帧数
        const elapsed = now - this.lastReportTime;
        const fps = (this.frameCount / elapsed) * 1000;
        console.log(
          `[PerformanceMonitor] 📊 估算 FPS: ${fps.toFixed(1)} (基于帧数统计)`,
        );
      }

      this.frameCount = 0;
      this.lastReportTime = now;
    }
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(
      `[PerformanceMonitor] ${
        enabled ? '✅ 已启用' : '⏸️  已禁用'
      } SimplePerformanceMonitor`,
    );
  }

  /**
   * 设置报告间隔
   */
  setReportInterval(interval) {
    this.reportInterval = interval;
    console.log(`[PerformanceMonitor] ⏱️  报告间隔已设置为: ${interval}ms`);
  }
}
