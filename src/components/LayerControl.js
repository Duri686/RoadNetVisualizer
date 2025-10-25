/**
 * Layer Control Component
 * 管理层的显示和切换
 */

class LayerControl {
  constructor() {
    this.elements = {
      section: document.getElementById('layer-control-section'),
      selector: document.getElementById('layer-selector'),
      showAllBtn: document.getElementById('show-all-btn'),
      layerInfo: document.getElementById('layer-info')
    };

    this.onLayerChangeCallback = null;
    this.onShowAllCallback = null;
    this.totalLayers = 0;
    this.currentLayer = 0;
    this._headless = false; // 当 DOM 缺失时启用无界面模式

    this.init();
  }

  /**
   * 初始化控件
   */
  init() {
    if (!this.elements.selector || !this.elements.showAllBtn) {
      // 进入无界面模式：不绑定任何 DOM，只提供回调能力
      this._headless = true;
      console.warn('⚠️ LayerControl running in headless mode (DOM elements not found).');
      return;
    }

    // 绑定事件
    this.elements.selector.addEventListener('change', (e) => {
      const layerIndex = parseInt(e.target.value, 10);
      this.selectLayer(layerIndex);
    });

    this.elements.showAllBtn.addEventListener('click', () => {
      this.showAllLayers();
    });

    console.log('✅ Layer control initialized');
  }

  /**
   * 显示控件
   */
  show() {
    if (this.elements.section) {
      this.elements.section.style.display = 'block';
    }
  }

  /**
   * 隐藏控件
   */
  hide() {
    if (this.elements.section) {
      this.elements.section.style.display = 'none';
    }
  }

  /**
   * 设置层数
   * @param {number} totalLayers - 总层数
   * @param {Object} metadata - 网络元数据
   */
  setLayers(totalLayers, metadata = null) {
    this.totalLayers = totalLayers;

    // 当 DOM 被注释或缺失时，直接返回，避免报错
    if (this._headless || !this.elements.selector) {
      this.currentLayer = 0;
      console.debug('[LayerControl] setLayers(headless): total=', totalLayers);
      return;
    }

    // 清空并重新填充选择器
    this.elements.selector.innerHTML = '';

    for (let i = 0; i < totalLayers; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `第 ${i + 1} 层`;
      
      if (metadata?.layers?.[i]) {
        const layerData = metadata.layers[i];
        option.textContent += ` (${layerData.nodes.length} 节点, ${layerData.edges.length} 边)`;
      }
      
      this.elements.selector.appendChild(option);
    }

    // 默认选择第一层
    this.selectLayer(0, false);
    this.updateLayerInfo(metadata);
  }

  /**
   * 选择层
   * @param {number} layerIndex - 层索引
   * @param {boolean} triggerCallback - 是否触发回调
   */
  selectLayer(layerIndex, triggerCallback = true) {
    if (layerIndex < 0 || layerIndex >= this.totalLayers) {
      console.warn(`⚠️ Invalid layer index: ${layerIndex}`);
      return;
    }

    this.currentLayer = layerIndex;
    if (!this._headless && this.elements.selector) {
      this.elements.selector.value = layerIndex;
    }

    if (triggerCallback && this.onLayerChangeCallback) {
      this.onLayerChangeCallback(layerIndex);
    }
  }

  /**
   * 显示所有层
   */
  showAllLayers() {
    if (this.onShowAllCallback) {
      this.onShowAllCallback();
    }
  }

  /**
   * 更新层信息显示
   * @param {Object} metadata - 网络元数据
   */
  updateLayerInfo(metadata) {
    if (this._headless || !this.elements.layerInfo || !metadata) return;

    const currentLayerData = metadata.layers?.[this.currentLayer];
    
    if (currentLayerData) {
      this.elements.layerInfo.innerHTML = `
        <strong>当前层信息:</strong><br>
        节点数: ${currentLayerData.nodes.length}<br>
        边数: ${currentLayerData.edges.length}<br>
        尺寸: ${currentLayerData.metadata.width} × ${currentLayerData.metadata.height}
      `;
    } else {
      this.elements.layerInfo.innerHTML = `
        <strong>总体信息:</strong><br>
        总节点数: ${metadata.totalNodes}<br>
        总边数: ${metadata.totalEdges}<br>
        总层数: ${metadata.layerCount}
      `;
    }
  }

  /**
   * 注册层切换回调
   */
  onLayerChange(callback) {
    this.onLayerChangeCallback = callback;
  }

  /**
   * 注册显示所有层回调
   */
  onShowAll(callback) {
    this.onShowAllCallback = callback;
  }

  /**
   * 重置控件
   */
  reset() {
    this.totalLayers = 0;
    this.currentLayer = 0;
    if (this.elements.selector) {
      this.elements.selector.innerHTML = '';
    }
    if (this.elements.layerInfo) {
      this.elements.layerInfo.innerHTML = '';
    }
    this.hide();
  }

  /**
   * 获取当前层
   */
  getCurrentLayer() {
    return this.currentLayer;
  }
}

export default LayerControl;
