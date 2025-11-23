/**
 * 图层切换管理器
 * 负责控制不同图层元素的显示/隐藏
 */

class LayerToggleManager {
  constructor() {
    this.toggleBtn = document.getElementById('layer-toggle-btn');
    this.isMenuOpen = false;
    this.layerStates = {
      obstacles: true,
      networkNodes: true,
      networkEdges: true,
      baseTriangulation: true, // Match renderer default (lines.visible = true)
      voronoi: true
    };
    // 构造阶段可能 DOM 未就绪，延迟绑定
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 确保拿到最新的 DOM 引用
    if (!this.toggleBtn) this.toggleBtn = document.getElementById('layer-toggle-btn');
    if (!this.toggleBtn) {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners(), { once: true });
      return;
    }
    this.toggleBtn.addEventListener('click', () => {
      this.toggleMenu();
    });
    console.debug('[LayerToggle] bound to #layer-toggle-btn');
  }

  /**
   * 手动初始化（在应用 init 后调用，确保绑定）
   */
  init() {
    this.setupEventListeners();
  }

  /**
   * 切换图层菜单
   */
  toggleMenu() {
    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /**
   * 打开图层菜单
   */
  openMenu() {
    // 移除已存在的菜单
    const existingMenu = document.getElementById('layer-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // 创建菜单
    const menu = document.createElement('div');
    menu.id = 'layer-menu';
    menu.className = 'layer-menu';
    menu.innerHTML = `
      <div class="layer-menu-header">
        <strong>图层控制</strong>
      </div>
      <div class="layer-menu-body">
        <label class="layer-item">
          <input type="checkbox" data-layer="obstacles" ${this.layerStates.obstacles ? 'checked' : ''}>
          <span class="layer-icon obstacle-icon-small"></span>
          <span>障碍物</span>
        </label>
        <label class="layer-item">
          <input type="checkbox" data-layer="networkNodes" ${this.layerStates.networkNodes ? 'checked' : ''}>
          <span class="layer-icon network-icon-small"></span>
          <span>网络节点</span>
        </label>
        <label class="layer-item">
          <input type="checkbox" data-layer="networkEdges" ${this.layerStates.networkEdges ? 'checked' : ''}>
          <span class="layer-icon network-edge-icon-small"></span>
          <span>网络边</span>
        </label>
        <label class="layer-item">
          <input type="checkbox" data-layer="baseTriangulation" ${this.layerStates.baseTriangulation ? 'checked' : ''}>
          <span class="layer-icon base-icon-small"></span>
          <span>基础三角化</span>
        </label>
        <label class="layer-item">
          <input type="checkbox" data-layer="voronoi" ${this.layerStates.voronoi ? 'checked' : ''}>
          <span class="layer-icon voronoi-icon-small"></span>
          <span>Voronoi 骨架</span>
        </label>
      </div>
    `;

    // 定位菜单
    // 重新获取按钮，防止早期获取为空
    if (!this.toggleBtn) this.toggleBtn = document.getElementById('layer-toggle-btn');
    const btnRect = this.toggleBtn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${btnRect.bottom + 8}px`;
    menu.style.left = `${btnRect.left}px`;

    document.body.appendChild(menu);
    this.isMenuOpen = true;

    // 标记按钮为激活状态
    this.toggleBtn.classList.add('active');

    // 绑定复选框事件
    menu.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const layer = e.target.dataset.layer;
        const isVisible = e.target.checked;
        this.toggleLayer(layer, isVisible);
      });
    });

    // 点击外部关闭菜单
    setTimeout(() => {
      const closeMenuHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== this.toggleBtn) {
          this.closeMenu();
          document.removeEventListener('click', closeMenuHandler);
        }
      };
      document.addEventListener('click', closeMenuHandler);
    }, 100);
  }

  /**
   * 关闭图层菜单
   */
  closeMenu() {
    const menu = document.getElementById('layer-menu');
    if (menu) {
      menu.remove();
    }
    this.isMenuOpen = false;
    this.toggleBtn.classList.remove('active');
  }

  /**
   * 切换图层显示
   */
  toggleLayer(layerName, isVisible) {
    this.layerStates[layerName] = isVisible;
    
    const renderer = window.roadNetApp?.renderer;
    if (!renderer) {
      console.warn('Renderer not available');
      return;
    }

    // 调用渲染器的图层控制方法
    switch (layerName) {
      case 'obstacles':
        if (typeof renderer.setObstaclesVisible === 'function') {
          renderer.setObstaclesVisible(isVisible);
        }
        break;
      case 'networkNodes':
        if (typeof renderer.setNetworkNodesVisible === 'function') {
          renderer.setNetworkNodesVisible(isVisible);
        } else if (typeof renderer.setNetworkVisible === 'function') {
          renderer.setNetworkVisible(isVisible);
        }
        break;
      case 'networkEdges':
        if (typeof renderer.setNetworkEdgesVisible === 'function') {
          renderer.setNetworkEdgesVisible(isVisible);
        } else if (typeof renderer.setNetworkVisible === 'function') {
          renderer.setNetworkVisible(isVisible);
        }
        break;
      case 'baseTriangulation':
        if (typeof renderer.setBaseTriangulationVisible === 'function') {
          renderer.setBaseTriangulationVisible(isVisible);
        }
        break;
      case 'voronoi':
        if (typeof renderer.setVoronoiVisible === 'function') {
          renderer.setVoronoiVisible(isVisible);
        }
        break;
    }

    console.log(`Layer "${layerName}" ${isVisible ? 'shown' : 'hidden'}`);
    // 广播事件，通知其它模块（如缩略图导航）更新
    try {
      window.dispatchEvent(
        new CustomEvent('layer-visibility-changed', { detail: { layerName, isVisible } })
      );
    } catch (e) { /* ignore */ }
  }

  /**
   * 获取当前图层状态
   */
  getLayerStates() {
    return { ...this.layerStates };
  }
}

// 导出单例
export default new LayerToggleManager();
