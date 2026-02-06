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
    // 创建面板容器 - iOS 26 Liquid Glass 风格
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 12px;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 0.5px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
      font-family: 'SF Mono', ui-monospace, monospace;
      font-size: 11px;
      font-weight: 500;
      border-radius: 10px;
      z-index: 100;
      user-select: none;
      line-height: 1.4;
    `;

    // FPS 文本
    this.fpsText = document.createElement('div');
    this.fpsText.textContent = '-- FPS';
    this.fpsText.style.letterSpacing = '0.5px';
    this.panel.appendChild(this.fpsText);

    // MS 文本
    this.msText = document.createElement('div');
    this.msText.textContent = '-- MS';
    this.msText.style.fontSize = '10px';
    this.msText.style.color = 'rgba(255, 255, 255, 0.55)';
    this.msText.style.letterSpacing = '0.5px';
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

    // 根据 FPS 设置颜色 - 柔和色调
    let color = 'rgba(134, 239, 172, 0.9)'; // 柔绿
    if (fps < 30) {
      color = 'rgba(252, 165, 165, 0.9)'; // 柔红
    } else if (fps < 50) {
      color = 'rgba(253, 224, 71, 0.9)'; // 柔黄
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
