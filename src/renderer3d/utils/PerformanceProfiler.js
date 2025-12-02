/**
 * 性能分析器
 * 详细追踪渲染各阶段的耗时，定位性能瓶颈
 */

export class PerformanceProfiler {
  constructor() {
    this.enabled = true;
    this.samples = [];
    this.maxSamples = 120; // 2秒的数据
    this.logInterval = 3000; // 每3秒输出一次报告
    this.lastLogTime = performance.now();

    // 性能阈值配置
    this.fpsThreshold = 50; // 只有当 FPS 低于此值时才输出报告
    this.alwaysLog = false; // 设为 true 则忽略阈值，总是输出

    console.log(
      '[PerformanceProfiler] 🔍 PerformanceProfiler 已创建，enabled:',
      this.enabled,
    );
    console.log(
      `[PerformanceProfiler] 📊 报告阈值: FPS < ${this.fpsThreshold} 时输出`,
    );

    // 追踪的指标
    this.metrics = {
      frameTime: [],
      renderTime: [],
      updateTime: [],
      drawCalls: [],
      triangles: [],
      geometries: [],
      textures: [],
      programs: [],
    };
  }

  /**
   * 开始追踪一帧
   */
  startFrame() {
    if (!this.enabled) return;
    this.frameStart = performance.now();
    this.timings = {};

    // 只在第一帧输出
    if (this.samples.length === 0) {
      console.log('[PerformanceProfiler] 🎬 开始追踪第一帧');
    }
  }

  /**
   * 标记一个阶段的开始
   */
  mark(label) {
    if (!this.enabled) return;
    this.timings[label] = { start: performance.now() };
  }

  /**
   * 标记一个阶段的结束
   */
  markEnd(label) {
    if (!this.enabled) return;
    if (this.timings[label]) {
      this.timings[label].duration =
        performance.now() - this.timings[label].start;
    }
  }

  /**
   * 结束追踪一帧
   */
  endFrame(renderer) {
    if (!this.enabled) {
      console.log('[PerformanceProfiler] ⚠️ 已禁用');
      return;
    }

    const frameTime = performance.now() - this.frameStart;

    // 收集渲染器信息
    const info = renderer?.info;
    const sample = {
      frameTime,
      timings: { ...this.timings },
      render: info
        ? {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length || 0,
          }
        : null,
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // 定期输出报告（仅当性能低于阈值时）
    const now = performance.now();
    if (now - this.lastLogTime >= this.logInterval) {
      // 计算当前 FPS
      const frameTimes = this.samples.map((s) => s.frameTime);
      const avgFrameTime =
        frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const currentFPS = 1000 / avgFrameTime;

      // 只有当 FPS 低于阈值或 alwaysLog 为 true 时才输出
      if (this.alwaysLog || currentFPS < this.fpsThreshold) {
        console.log(
          `[PerformanceProfiler] 🔍 准备输出报告 (样本数: ${
            this.samples.length
          }, FPS: ${currentFPS.toFixed(1)})`,
        );
        this.logReport();
      } else {
        console.log(
          `[PerformanceProfiler] ✅ 性能良好 (FPS: ${currentFPS.toFixed(1)} > ${
            this.fpsThreshold
          })，跳过报告`,
        );
      }

      this.lastLogTime = now;
    }
  }

  /**
   * 输出性能报告
   */
  logReport() {
    if (this.samples.length === 0) return;

    console.log('[PerformanceProfiler] \n📊 ===== 性能分析报告 =====');

    // 计算平均值
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = (arr) => Math.max(...arr);

    // 帧时间分析
    const frameTimes = this.samples.map((s) => s.frameTime);
    const avgFrameTime = avg(frameTimes);
    const maxFrameTime = max(frameTimes);
    const avgFPS = 1000 / avgFrameTime;

    console.log(
      `[PerformanceProfiler] ⏱️  帧时间: 平均 ${avgFrameTime.toFixed(
        2,
      )}ms (${avgFPS.toFixed(1)} FPS), 最大 ${maxFrameTime.toFixed(2)}ms`,
    );

    // 各阶段耗时分析
    const timingLabels = Object.keys(this.samples[0]?.timings || {});
    if (timingLabels.length > 0) {
      console.log('[PerformanceProfiler] \n🔍 各阶段耗时:');
      timingLabels.forEach((label) => {
        const durations = this.samples
          .map((s) => s.timings[label]?.duration)
          .filter((d) => d !== undefined);

        if (durations.length > 0) {
          const avgDuration = avg(durations);
          const maxDuration = max(durations);
          const percentage = ((avgDuration / avgFrameTime) * 100).toFixed(1);

          const icon = avgDuration > 5 ? '🔴' : avgDuration > 2 ? '🟡' : '🟢';
          console.log(
            `[PerformanceProfiler]   ${icon} ${label}: ${avgDuration.toFixed(
              2,
            )}ms (${percentage}%) 最大: ${maxDuration.toFixed(2)}ms`,
          );
        }
      });
    }

    // 渲染统计
    const lastSample = this.samples[this.samples.length - 1];
    if (lastSample.render) {
      console.log('[PerformanceProfiler] \n📈 渲染统计:');
      console.log(
        `[PerformanceProfiler]   Draw Calls: ${lastSample.render.drawCalls}`,
      );
      console.log(
        `[PerformanceProfiler]   三角形数: ${lastSample.render.triangles.toLocaleString()}`,
      );
      console.log(
        `[PerformanceProfiler]   几何体: ${lastSample.render.geometries}`,
      );
      console.log(
        `[PerformanceProfiler]   纹理: ${lastSample.render.textures}`,
      );
      console.log(
        `[PerformanceProfiler]   着色器程序: ${lastSample.render.programs}`,
      );
    }

    // 性能瓶颈分析
    this.analyzeBottlenecks(avgFrameTime, timingLabels);

    console.log('[PerformanceProfiler] ========================\n');
  }

  /**
   * 分析性能瓶颈
   */
  analyzeBottlenecks(avgFrameTime, timingLabels) {
    console.log('[PerformanceProfiler] \n💡 优化建议:');

    const bottlenecks = [];

    // 检查各阶段耗时
    timingLabels.forEach((label) => {
      const durations = this.samples
        .map((s) => s.timings[label]?.duration)
        .filter((d) => d !== undefined);

      if (durations.length > 0) {
        const avgDuration =
          durations.reduce((a, b) => a + b, 0) / durations.length;
        const percentage = (avgDuration / avgFrameTime) * 100;

        if (percentage > 30) {
          bottlenecks.push({ label, duration: avgDuration, percentage });
        }
      }
    });

    // 按耗时排序
    bottlenecks.sort((a, b) => b.duration - a.duration);

    if (bottlenecks.length > 0) {
      bottlenecks.forEach((b) => {
        console.log(
          `[PerformanceProfiler]   ⚠️  ${b.label} 占用 ${b.percentage.toFixed(
            1,
          )}% 的帧时间`,
        );
        this.suggestOptimization(b.label, b.duration);
      });
    }

    // 检查渲染统计
    const lastSample = this.samples[this.samples.length - 1];
    if (lastSample.render) {
      if (lastSample.render.drawCalls > 100) {
        console.log(
          '[PerformanceProfiler]   ⚠️  Draw Calls 过多，考虑合并几何体或使用实例化渲染',
        );
      }
      if (lastSample.render.triangles > 500000) {
        console.log(
          '[PerformanceProfiler]   ⚠️  三角形数量过多，考虑使用 LOD 或简化模型',
        );
      }
      if (lastSample.render.geometries > 1000) {
        console.log(
          '[PerformanceProfiler]   ⚠️  几何体数量过多，考虑复用几何体',
        );
      }
    }

    if (avgFrameTime > 33) {
      console.log(
        '[PerformanceProfiler]   🎯 目标: 将帧时间降低到 16.67ms (60 FPS)',
      );
    }
  }

  /**
   * 针对特定阶段给出优化建议
   */
  suggestOptimization(label, duration) {
    const suggestions = {
      'scene-update': [
        '减少场景中的对象数量',
        '使用对象池复用对象',
        '避免每帧创建/销毁对象',
      ],
      'animation-update': [
        '减少动画对象数量',
        '降低动画更新频率',
        '使用 GPU 动画代替 CPU 动画',
      ],
      render: [
        '降低阴影质量或禁用阴影',
        '减少光源数量',
        '使用更简单的材质',
        '禁用后期处理效果',
      ],
      'post-processing': [
        '禁用或简化后期处理效果',
        '降低渲染分辨率',
        '减少 bloom 强度',
      ],
      'controls-update': ['降低控制器阻尼系数', '减少控制器更新频率'],
    };

    const tips = suggestions[label];
    if (tips) {
      tips.forEach((tip) => console.log(`[PerformanceProfiler]      → ${tip}`));
    }
  }

  /**
   * 启用/禁用分析器
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(
      `[PerformanceProfiler] ${enabled ? '✅ 已启用' : '⏸️  已禁用'}`,
    );
    if (!enabled) {
      this.samples = [];
    }
  }

  /**
   * 设置 FPS 阈值
   * @param {number} threshold - FPS 阈值，低于此值时才输出报告
   */
  setFpsThreshold(threshold) {
    this.fpsThreshold = threshold;
    console.log(`[PerformanceProfiler] 📊 FPS 阈值已设置为: ${threshold}`);
  }

  /**
   * 设置是否总是输出报告（忽略阈值）
   * @param {boolean} always - true 则总是输出，false 则根据阈值判断
   */
  setAlwaysLog(always) {
    this.alwaysLog = always;
    console.log(
      `[PerformanceProfiler] ${
        always ? '📢 总是输出报告' : '🎯 仅在性能低于阈值时输出'
      }`,
    );
  }

  /**
   * 设置报告输出间隔
   * @param {number} interval - 间隔时间（毫秒）
   */
  setLogInterval(interval) {
    this.logInterval = interval;
    console.log(`[PerformanceProfiler] ⏱️  报告间隔已设置为: ${interval}ms`);
  }

  /**
   * 获取当前性能数据
   */
  getCurrentStats() {
    if (this.samples.length === 0) return null;

    const frameTimes = this.samples.map((s) => s.frameTime);
    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

    return {
      fps: 1000 / avgFrameTime,
      frameTime: avgFrameTime,
      samples: this.samples.length,
    };
  }
}
