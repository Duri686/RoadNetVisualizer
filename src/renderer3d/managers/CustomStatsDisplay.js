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
    // 创建面板容器
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      bottom: 8px;
      left: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.8);
      color: #0ff;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      border-radius: 4px;
      z-index: 100;
      user-select: none;
      line-height: 1.4;
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
