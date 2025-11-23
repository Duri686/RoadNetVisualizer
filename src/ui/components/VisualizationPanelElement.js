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
        <div class="canvas-container bg-[var(--bg-card)] rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] border border-[var(--border-light)] relative overflow-hidden flex flex-col flex-1 box-border fullscreen:flex fullscreen:flex-col fullscreen:bg-[var(--bg-page)] fullscreen:p-0 fullscreen:rounded-none fullscreen:border-none">
          <div id="pixi-canvas" class="w-full h-full flex justify-center items-center rounded-[var(--radius-xl)] overflow-hidden relative bg-[var(--viz-canvas-bg)] flex-1 touch-none overscroll-contain fullscreen:flex-grow fullscreen:h-0 fullscreen:rounded-none"></div>
          <div class="canvas-hint absolute top-[var(--space-lg)] left-1/2 -translate-x-1/2 z-10 bg-[rgba(255, 255, 255, 0.08)] backdrop-blur-md px-[var(--space-lg)] py-[var(--space-sm)] rounded-full shadow-[var(--shadow-md)] border border-[var(--border-light)] pointer-events-none">
            <p id="canvas-hint-text" class="  max-w-full m-0 text-[12px] text-center text-[var(--text-primary)] whitespace-nowrap">
              💡 单击选择起点/终点自动导航；<br class="md:hidden" />导航中双击结束导航；鼠标滚轮缩放，拖拽平移
            </p>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-visualization-panel', VisualizationPanelElement);
