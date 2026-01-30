/**
 * 自定义性能显示面板
 * 显示基于实际渲染工作时间的真实 FPS
 */

export class CustomStatsDisplay {
  constructor(container) {
    this.container = container;
    this.panel = null;
    this.fpsText = null;
    this.msText = null;
    this.visible = true;
  }

  /**
   * 初始化显示面板
   */
  init() {
    // 创建面板容器 - Glass Panel 风格
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      bottom: 16px;
      left: 16px;
      padding: 10px 14px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #22d3ee;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
      font-weight: 600;
      border-radius: 12px;
      z-index: 100;
      user-select: none;
      line-height: 1.5;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    `;

    // FPS 文本
    this.fpsText = document.createElement('div');
    this.fpsText.textContent = '-- FPS';
    this.panel.appendChild(this.fpsText);

    // MS 文本
    this.msText = document.createElement('div');
    this.msText.textContent = '-- MS';
    this.msText.style.fontSize = '12px';
    this.msText.style.color = '#0af';
    this.panel.appendChild(this.msText);

    this.container.appendChild(this.panel);
    return this;
  }

  /**
   * 更新显示
   * @param {Object} stats - 来自 PerformanceProfiler 的统计数据
   */
  update(stats) {
    if (!this.panel || !this.visible || !stats) return;

    const fps = Math.round(stats.fps);
    const ms = stats.frameTime.toFixed(2);

    // 根据 FPS 设置颜色
    let color = '#0f0'; // 绿色 (好)
    if (fps < 30) {
      color = '#f00'; // 红色 (差)
    } else if (fps < 50) {
      color = '#ff0'; // 黄色 (中等)
    }

    this.fpsText.textContent = `${fps} FPS`;
    this.fpsText.style.color = color;
    this.msText.textContent = `${ms} MS`;
  }

  /**
   * 显示/隐藏
   */
  setVisible(visible) {
    this.visible = visible;
    if (this.panel) {
      this.panel.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.panel && this.container.contains(this.panel)) {
      this.container.removeChild(this.panel);
    }
    this.panel = null;
    this.fpsText = null;
    this.msText = null;
  }
}
