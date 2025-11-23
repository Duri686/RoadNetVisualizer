/**
 * 分享管理器
 * 负责生成带参数的分享链接
 */

class ShareManager {
  constructor() {
    this.shareBtn = document.getElementById('share-btn');
    this._initialized = false;
    this.setupEventListeners();
  }

  init() {
    this.shareBtn = document.getElementById('share-btn');
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    if (this.shareBtn && !this._initialized) {
      this._initialized = true;
      this.shareBtn.addEventListener('click', () => {
        this.handleShare();
      });
    }
  }

  /**
   * 处理分享操作
   */
  handleShare() {
    try {
      const params = this.getCurrentParams();
      const shareUrl = this.generateShareUrl(params);

      // 复制到剪贴板
      this.copyToClipboard(shareUrl);

      // 显示分享链接
      this.showShareDialog(shareUrl);
    } catch (error) {
      console.error('Share failed:', error);
      alert('❌ 分享失败: ' + error.message);
    }
  }

  /**
   * 获取当前参数
   */
  getCurrentParams() {
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const layerInput = document.getElementById('layer-input');
    const obstacleInput = document.getElementById('obstacle-input');
    const useSpatialIndex = document.getElementById('use-spatial-index');
    const cellSizeInput = document.getElementById('cell-size-input');

    // 获取选中的模式
    const modeOptions = document.querySelectorAll('.mode-option:checked');
    const modes = Array.from(modeOptions).map((opt) => opt.dataset.value);

    return {
      width: widthInput?.value || '500',
      height: heightInput?.value || '300',
      layers: layerInput?.value || '1',
      obstacles: obstacleInput?.value || '200',
      modes: modes.join(','),
      spatialIndex: useSpatialIndex?.checked ? '1' : '0',
      cellSize: cellSizeInput?.value || 'auto',
    };
  }

  /**
   * 生成分享 URL
   */
  generateShareUrl(params) {
    const baseUrl = window.location.origin + window.location.pathname;
    const queryParams = new URLSearchParams(params);
    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        console.log('✅ URL copied to clipboard');
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ URL copied to clipboard (fallback)');
      }
    } catch (error) {
      console.warn('Failed to copy:', error);
    }
  }

  /**
   * 显示分享对话框
   */
  showShareDialog(url) {
    // 移除已存在的对话框
    const existingDialog = document.getElementById('share-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.id = 'share-dialog';
    dialog.className = 'share-dialog';
    dialog.innerHTML = `
      <div class="share-dialog-content">
        <div class="share-header">
          <h3>分享配置</h3>
          <button class="share-close" aria-label="关闭">×</button>
        </div>
        <div class="share-body">
          <p class="share-hint">链接已复制到剪贴板！</p>
          <div class="share-url-container">
            <input type="text" class="share-url-input" value="${url}" readonly>
            <button class="share-copy-btn" title="复制链接">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
          <div class="share-params">
            <strong>当前配置：</strong>
            <ul>
              <li>尺寸: ${this.getCurrentParams().width} × ${
      this.getCurrentParams().height
    }</li>
              <li>层数: ${this.getCurrentParams().layers}</li>
              <li>障碍物: ${this.getCurrentParams().obstacles}</li>
              <li>模式: ${this.getCurrentParams().modes || '质心网络'}</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 绑定事件
    const closeBtn = dialog.querySelector('.share-close');
    const copyBtn = dialog.querySelector('.share-copy-btn');
    const urlInput = dialog.querySelector('.share-url-input');

    closeBtn.addEventListener('click', () => dialog.remove());
    copyBtn.addEventListener('click', () => {
      urlInput.select();
      this.copyToClipboard(url);
      copyBtn.innerHTML = '<span style="font-size: 12px;">✓</span>';
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>`;
      }, 1500);
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });

    // 自动选中 URL
    urlInput.select();
  }

  /**
   * 从 URL 加载参数
   */
  loadFromUrl() {
    const params = new URLSearchParams(window.location.search);

    if (params.toString() === '') return false;

    try {
      // 设置表单值
      const widthInput = document.getElementById('width-input');
      const heightInput = document.getElementById('height-input');
      const layerInput = document.getElementById('layer-input');
      const obstacleInput = document.getElementById('obstacle-input');
      const useSpatialIndex = document.getElementById('use-spatial-index');
      const cellSizeInput = document.getElementById('cell-size-input');

      if (params.has('width') && widthInput)
        widthInput.value = params.get('width');
      if (params.has('height') && heightInput)
        heightInput.value = params.get('height');
      if (params.has('layers') && layerInput)
        layerInput.value = params.get('layers');
      if (params.has('obstacles') && obstacleInput)
        obstacleInput.value = params.get('obstacles');
      if (params.has('spatialIndex') && useSpatialIndex) {
        useSpatialIndex.checked = params.get('spatialIndex') === '1';
      }
      if (params.has('cellSize') && cellSizeInput)
        cellSizeInput.value = params.get('cellSize');

      // 设置模式
      if (params.has('modes')) {
        const modes = params.get('modes').split(',');
        const modeOptions = document.querySelectorAll('.mode-option');
        modeOptions.forEach((opt) => {
          opt.checked = modes.includes(opt.dataset.value);
        });
      }

      console.log('✅ Loaded params from URL:', Object.fromEntries(params));
      return true;
    } catch (error) {
      console.error('Failed to load params from URL:', error);
      return false;
    }
  }
}

// 导出单例
export default new ShareManager();
