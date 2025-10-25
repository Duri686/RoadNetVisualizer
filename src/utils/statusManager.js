/**
 * 状态提示管理器
 * 负责动态更新状态消息的样式和内容
 */

class StatusManager {
  constructor() {
    this.statusElement = document.getElementById('status-message');
    this.statusValueElement = null;
    this.statusHintElement = null;
    
    if (this.statusElement) {
      this.statusValueElement = this.statusElement.querySelector('.status-value');
      this.statusHintElement = this.statusElement.querySelector('.status-hint');
    }
  }

  /**
   * 更新状态
   * @param {string} type - 状态类型: 'ready' | 'loading' | 'success' | 'error'
   * @param {string} value - 状态值文本
   * @param {string} hint - 提示文本
   */
  update(type, value, hint = '') {
    if (!this.statusElement) return;

    // 移除所有状态类
    this.statusElement.classList.remove('loading', 'success', 'error');

    // 添加新状态类
    if (type !== 'ready') {
      this.statusElement.classList.add(type);
    }

    // 更新文本内容
    if (this.statusValueElement) {
      this.statusValueElement.textContent = value;
    }

    if (this.statusHintElement) {
      this.statusHintElement.textContent = hint;
    }

    // 添加淡入动画
    this.statusElement.classList.remove('fade-in');
    void this.statusElement.offsetWidth; // 强制重排
    this.statusElement.classList.add('fade-in');
  }

  /**
   * 设置为就绪状态
   */
  setReady() {
    this.update('ready', 'Ready', 'Click "Generate" to start.');
  }

  /**
   * 设置为加载状态
   */
  setLoading(hint = 'Generating road network...') {
    this.update('loading', 'Loading', hint);
  }

  /**
   * 设置为成功状态
   */
  setSuccess(value = 'Success', hint = '') {
    this.update('success', value, hint);
  }

  /**
   * 设置为错误状态
   */
  setError(errorMsg) {
    this.update('error', 'Error', errorMsg);
  }
}

// 导出单例
export default new StatusManager();
