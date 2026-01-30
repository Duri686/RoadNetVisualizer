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
        <div class="canvas-container bg-gradient-to-b from-slate-900 to-slate-800 rounded-[var(--radius-xl)] shadow-xl shadow-indigo-500/10 ring-1 ring-white/10 border border-[var(--border-light)] relative overflow-hidden flex flex-col flex-1 box-border fullscreen:flex fullscreen:flex-col fullscreen:bg-[var(--bg-page)] fullscreen:p-0 fullscreen:rounded-none fullscreen:border-none">
          <div id="pixi-canvas" class="w-full h-full flex justify-center items-center rounded-[var(--radius-xl)] overflow-hidden relative bg-transparent flex-1 touch-none overscroll-contain fullscreen:flex-grow fullscreen:h-0 fullscreen:rounded-none"></div>
          <div class="canvas-hint absolute top-[var(--space-lg)] left-1/2 -translate-x-1/2 z-10 bg-slate-800/80 backdrop-blur-md px-[var(--space-lg)] py-[var(--space-sm)] rounded-full shadow-lg border border-white/10 pointer-events-none">
            <p id="canvas-hint-text" class="max-w-full m-0 text-[12px] text-center text-slate-200 whitespace-nowrap">
              💡 单击选择起点/终点自动导航；<br class="md:hidden" />导航中双击结束导航；鼠标滚轮缩放，拖拽平移
            </p>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-visualization-panel', VisualizationPanelElement);
