/**
 * 性能监控管理器
 * 负责FPS和性能统计
 */

import Stats from 'stats.js';

export class StatsManager {
  constructor(container) {
    this.container = container;
    this.stats = null;
  }

  /**
   * 初始化性能监控
   */
  init() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: FPS, 1: MS, 2: MB
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '8px';
    this.stats.dom.style.left = '8px';
    this.stats.dom.style.zIndex = '100';
    this.container.appendChild(this.stats.dom);
    return this.stats;
  }

  /**
   * 开始统计
   */
  begin() {
    if (this.stats) this.stats.begin();
  }

  /**
   * 结束统计
   */
  end() {
    if (this.stats) this.stats.end();
  }

  /**
   * 显示/隐藏
   */
  setVisible(visible) {
    if (this.stats) {
      this.stats.dom.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.stats && this.stats.dom && this.container.contains(this.stats.dom)) {
      this.container.removeChild(this.stats.dom);
    }
    this.stats = null;
  }
}
