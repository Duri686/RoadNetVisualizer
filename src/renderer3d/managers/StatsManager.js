/**
 * 性能监控管理器
 * 负责FPS和性能统计（显示真实的渲染性能）
 */

import { CustomStatsDisplay } from './CustomStatsDisplay.js';

export class StatsManager {
  constructor(container) {
    this.container = container;
    this.customDisplay = null;
  }

  /**
   * 初始化性能监控
   */
  init() {
    this.customDisplay = new CustomStatsDisplay(this.container);
    this.customDisplay.init();
    return this.customDisplay;
  }

  /**
   * 开始统计（保留接口兼容性，实际不需要）
   */
  begin() {
    // 自定义显示不需要 begin/end 调用
  }

  /**
   * 结束统计（保留接口兼容性，实际不需要）
   */
  end() {
    // 自定义显示不需要 begin/end 调用
  }

  /**
   * 更新显示
   * @param {Object} profilerStats - 来自 PerformanceProfiler 的统计数据
   */
  update(profilerStats) {
    if (this.customDisplay) {
      this.customDisplay.update(profilerStats);
    }
  }

  /**
   * 显示/隐藏
   */
  setVisible(visible) {
    if (this.customDisplay) {
      this.customDisplay.setVisible(visible);
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.customDisplay) {
      this.customDisplay.dispose();
    }
    this.customDisplay = null;
  }
}
