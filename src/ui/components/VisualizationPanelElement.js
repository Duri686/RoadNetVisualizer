class VisualizationPanelElement extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.render();
  }

  render() {
    this.innerHTML = `
        <div class="visualization-header">
          <div class="header-content">
            <h2>可视化面板</h2>
            <p class="panel-subtitle">Visualization</p>
          </div>
          <div class="canvas-toolbar">
            <button class="toolbar-btn" id="layer-toggle-btn" title="图层控制">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </button>
            <button class="toolbar-btn" id="zoom-in-btn" title="放大">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </button>
            <button class="toolbar-btn" id="zoom-out-btn" title="缩小">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M8 11h6" />
              </svg>
            </button>
            <button class="toolbar-btn" id="fullscreen-btn" title="全屏切换">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="canvas-container">
          <div id="pixi-canvas"></div>
          <div class="canvas-hint">
            <p id="canvas-hint-text">
              💡 单击选择起点/终点自动导航；导航中双击结束导航；鼠标滚轮缩放，拖拽平移
            </p>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-visualization-panel', VisualizationPanelElement);
