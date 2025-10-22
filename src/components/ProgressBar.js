/**
 * Progress Bar Component
 * 显示生成进度
 */

class ProgressBar {
  constructor() {
    this.elements = {
      section: document.getElementById('progress-section'),
      bar: document.getElementById('progress-bar'),
      text: document.getElementById('progress-text')
    };

    this.currentProgress = 0;
  }

  /**
   * 显示进度条
   */
  show() {
    if (this.elements.section) {
      this.elements.section.style.display = 'block';
    }
  }

  /**
   * 隐藏进度条
   */
  hide() {
    if (this.elements.section) {
      this.elements.section.style.display = 'none';
    }
  }

  /**
   * 更新进度
   * @param {number} progress - 进度值 (0-1)
   * @param {number} currentLayer - 当前层
   * @param {number} totalLayers - 总层数
   * @param {number} nodeCount - 当前层节点数
   */
  updateProgress(progress, currentLayer, totalLayers, nodeCount) {
    this.currentProgress = progress;

    // 更新进度条宽度
    if (this.elements.bar) {
      const percentage = Math.min(100, Math.max(0, progress * 100));
      this.elements.bar.style.width = `${percentage}%`;
    }

    // 更新进度文本
    if (this.elements.text) {
      const percentage = Math.round(progress * 100);
      const nodeInfo = nodeCount ? ` (${nodeCount}节点)` : '';
      let text = `${percentage}%`;
      
      if (currentLayer !== null && totalLayers !== null) {
        text += ` - Layer ${currentLayer + 1}/${totalLayers}${nodeInfo}`;
      }
      
      this.elements.text.textContent = text;
    }

    // 添加完成动画
    if (progress >= 1) {
      this.elements.bar?.classList.add('loading');
      setTimeout(() => {
        this.elements.bar?.classList.remove('loading');
      }, 500);
    }
  }

  /**
   * 重置进度条
   */
  reset() {
    this.updateProgress(0);
  }

  /**
   * 获取当前进度
   */
  getProgress() {
    return this.currentProgress;
  }
}

export default ProgressBar;
