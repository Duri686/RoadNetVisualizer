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
        <div class="canvas-container bg-gradient-to-b from-[#0c1929] to-[#162033] rounded-[var(--radius-xl)] shadow-lg ring-1 ring-white/5 border border-[rgba(96,165,250,0.12)] relative overflow-hidden flex flex-col flex-1 box-border fullscreen:flex fullscreen:flex-col fullscreen:bg-[var(--bg-page)] fullscreen:p-0 fullscreen:rounded-none fullscreen:border-none">
          <div id="pixi-canvas" class="w-full h-full flex justify-center items-center rounded-[var(--radius-xl)] overflow-hidden relative bg-transparent flex-1 touch-none overscroll-contain fullscreen:flex-grow fullscreen:h-0 fullscreen:rounded-none"></div>
          <div class="canvas-hint absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-[20px] px-4 py-1.5 rounded-full border border-white/10 pointer-events-none">
            <p id="canvas-hint-text" class="max-w-full m-0 text-[11px] text-center text-white/80 whitespace-nowrap">
              单击选点 · 双击结束导航 · 滚轮缩放 · 拖拽平移
            </p>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-visualization-panel', VisualizationPanelElement);
