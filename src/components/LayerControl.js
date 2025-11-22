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
    // Store notNullElementFound for headless check
    const notNullElementFound = this.elements.section && this.elements.layerInfo;
    this._headless = !notNullElementFound;

    if (this._headless) {
      console.debug('[LayerControl] Running in headless mode (DOM elements not found)');
      return;
    }

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
    if (this._headless || !this.elements.section) {
      this.currentLayer = 0;
      console.debug('[LayerControl] setLayers(headless): total=', totalLayers);
      return;
    }

    // 清空并重新填充选择器
    let cbContainer = document.getElementById('layer-checkboxes');
    if (!cbContainer) {
      cbContainer = document.createElement('div');
      cbContainer.id = 'layer-checkboxes';
      cbContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px';
      this.elements.section.insertBefore(cbContainer, this.elements.layerInfo);
    }
    cbContainer.innerHTML = '';

    for (let i = 0; i < totalLayers; i++) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;font-size:13px;cursor:pointer;padding:4px 6px;border-radius:4px;transition:background 0.2s';
      label.onmouseenter = () => label.style.background = 'rgba(255,255,255,0.05)';
      label.onmouseleave = () => label.style.background = 'transparent';
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = i;
      cb.checked = true; // Default all visible
      cb.style.cssText = 'margin-right:8px;cursor:pointer;width:14px;height:14px';
      
      cb.addEventListener('change', () => {
        this.toggleLayerVisibility(i, cb.checked);
      });
      
      const layerName = document.createElement('span');
      layerName.textContent = `第 ${i + 1} 层`;
      layerName.style.flex = '1';
      label.appendChild(cb);
      label.appendChild(layerName);
      
      if (metadata?.layers?.[i]) {
        const layerData = metadata.layers[i];
        const countSpan = document.createElement('span');
        countSpan.style.cssText = 'font-size:11px;color:var(--text-secondary);opacity:0.7;margin-right:8px';
        countSpan.textContent = `(${layerData.nodes.length})`;
        label.appendChild(countSpan);
      }

      // Stairs/Connectors Toggle
      const stairsLabel = document.createElement('label');
      stairsLabel.title = '显示/隐藏楼梯连接';
      stairsLabel.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:2px 4px;border-radius:3px;background:rgba(255,255,255,0.1);margin-left:4px';
      stairsLabel.onmouseenter = () => stairsLabel.style.background = 'rgba(255,255,255,0.2)';
      stairsLabel.onmouseleave = () => stairsLabel.style.background = 'rgba(255,255,255,0.1)';

      const stairsCb = document.createElement('input');
      stairsCb.type = 'checkbox';
      stairsCb.checked = true;
      stairsCb.style.cssText = 'cursor:pointer;width:12px;height:12px;margin:0';
      
      stairsCb.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent triggering layer toggle
        if (window.roadNetApp && window.roadNetApp.renderer && window.roadNetApp.renderer.roadNetRenderer) {
          window.roadNetApp.renderer.roadNetRenderer.toggleConnections(stairsCb.checked, i);
        }
      });
      
      // Icon for stairs (simple text or svg)
      const stairsIcon = document.createElement('span');
      stairsIcon.innerHTML = '🪜'; // Ladder icon
      stairsIcon.style.cssText = 'font-size:12px;margin-left:4px;line-height:1';

      stairsLabel.appendChild(stairsCb);
      stairsLabel.appendChild(stairsIcon);
      
      // Prevent label click from toggling the main layer checkbox
      stairsLabel.addEventListener('click', (e) => e.stopPropagation());

      label.appendChild(stairsLabel);
      
      cbContainer.appendChild(label);
    }

    // 默认全选
    this.updateLayerInfo(metadata);
  }
  
  toggleLayerVisibility(index, visible) {
    if (window.roadNetApp && window.roadNetApp.renderer) {
      window.roadNetApp.renderer.showLayer(visible ? index : -1); 
      // Wait, showLayer(index) usually shows ONLY that layer.
      // We need a way to show multiple layers.
      // Renderer3D.showLayer logic needs update to support multi-select or we call it differently.
      // Let's check Renderer3D.showLayer.
      // It sets visible = (index === null || child.userData.layerIndex === index).
      // We need to update Renderer3D to support a set of visible layers.
      
      // Temporary fix: We can directly access scene children here or update Renderer3D.
      // Better to update Renderer3D.
      window.roadNetApp.renderer.setLayerVisibility(index, visible);
    }
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
