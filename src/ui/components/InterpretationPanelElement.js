class InterpretationPanelElement extends HTMLElement {
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
        <div class="interpretation-wrapper flex flex-col gap-[var(--space-lg)] w-full h-full">

          <div class="interpretation-card glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)]" id="layer-control-card">
            <div class="card-header-row mb-[var(--space-md)]">
              <h3 class="text-[15px] font-bold text-[var(--accent-color)] uppercase tracking-wider flex items-center gap-2 m-0">
                <span class="w-1 h-4 bg-[var(--accent-color)] rounded-full"></span>
                图层控制
              </h3>
            </div>
            <div id="layer-control-section" class="space-y-[var(--space-sm)]">
            </div>
          </div>

          <div class="interpretation-card glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)]" id="legend-card">
            <h3 class="text-[15px] font-bold text-[var(--accent-color)] uppercase tracking-wider mb-[var(--space-lg)] flex items-center gap-2">
              <span class="w-1 h-4 bg-[var(--accent-color)] rounded-full"></span>
              图例
            </h3>
            <div class="legend-grid grid grid-cols-1 gap-[var(--space-sm)]">
              <div class="legend-item-new flex items-center gap-[var(--space-md)] py-1.5 px-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition-colors" data-layer="obstacles">
                <button class="legend-eye relative w-5 h-5 rounded-full border border-[var(--border-light)]
         bg-[var(--bg-input)] text-[var(--text-secondary)]
         inline-flex items-center justify-center transition-all
         hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]
         aria-[pressed=true]:border-[var(--border-input)]
         aria-[pressed=true]:bg-[var(--bg-input)]
         aria-[pressed=true]:text-[var(--primary-color)]
         aria-[pressed=true]:shadow-[0_0_0_2px_var(--primary-color)/20]
         aria-[pressed=true]:[&_.indicator]:opacity-100" aria-pressed="true" aria-checked="true" role="switch" title="显示/隐藏">
                  <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </button>
                <span class="legend-icon obstacle-icon inline-block w-3 h-3 rounded-[2px] bg-[var(--viz-obstacle)] border border-[var(--viz-obstacle)] shadow-[0_0_8px_var(--viz-obstacle)]" aria-hidden="true"></span>
                <span class="legend-label flex-1 text-[13px] text-[var(--text-secondary)] font-medium">障碍物</span>
              </div>
              <div class="legend-item-new flex items-center gap-[var(--space-md)] py-1.5 px-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition-colors" data-layer="networkNodes">
                <button class="legend-eye relative w-5 h-5 rounded-full border border-[var(--border-light)]
         bg-[var(--bg-input)] text-[var(--text-secondary)]
         inline-flex items-center justify-center transition-all
         hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]
         aria-[pressed=true]:border-[var(--border-input)]
         aria-[pressed=true]:bg-[var(--bg-input)]
         aria-[pressed=true]:text-[var(--primary-color)]
         aria-[pressed=true]:shadow-[0_0_0_2px_var(--primary-color)/20]
         aria-[pressed=true]:[&_.indicator]:opacity-100" aria-pressed="true" aria-checked="true" role="switch" title="显示/隐藏">
                  <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </button>
                <span class="legend-icon node-icon inline-block w-2.5 h-2.5 rounded-full bg-[var(--viz-network-edge)] shadow-[0_0_6px_var(--viz-network-edge)]" aria-hidden="true"></span>
                <span class="legend-label flex-1 text-[13px] text-[var(--text-secondary)] font-medium">网络节点</span>
              </div>
              <div class="legend-item-new flex items-center gap-[var(--space-md)] py-1.5 px-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition-colors" data-layer="networkEdges">
                <button class="legend-eye relative w-5 h-5 rounded-full border border-[var(--border-light)]
         bg-[var(--bg-input)] text-[var(--text-secondary)]
         inline-flex items-center justify-center transition-all
         hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]
         aria-[pressed=true]:border-[var(--border-input)]
         aria-[pressed=true]:bg-[var(--bg-input)]
         aria-[pressed=true]:text-[var(--primary-color)]
         aria-[pressed=true]:shadow-[0_0_0_2px_var(--primary-color)/20]
         aria-[pressed=true]:[&_.indicator]:opacity-100" aria-pressed="true" aria-checked="true" role="switch" title="显示/隐藏">
                  <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </button>
                <span class="legend-icon edge-icon inline-block w-4 h-0.5 rounded-[2px] bg-[var(--viz-network-edge)] shadow-[0_0_4px_var(--viz-network-edge)]" aria-hidden="true"></span>
                <span class="legend-label flex-1 text-[13px] text-[var(--text-secondary)] font-medium">网络边</span>
              </div>
              <div class="legend-item-new flex items-center gap-[var(--space-md)] py-1.5 px-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition-colors" data-layer="baseTriangulation">
                <button class="legend-eye relative w-5 h-5 rounded-full border border-[var(--border-light)]
         bg-[var(--bg-input)] text-[var(--text-secondary)]
         inline-flex items-center justify-center transition-all
         hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]
         aria-[pressed=true]:border-[var(--border-input)]
         aria-[pressed=true]:bg-[var(--bg-input)]
         aria-[pressed=true]:text-[var(--primary-color)]
         aria-[pressed=true]:shadow-[0_0_0_2px_var(--primary-color)/20]
         aria-[pressed=true]:[&_.indicator]:opacity-100" aria-pressed="true" aria-checked="true" role="switch" title="显示/隐藏">
                  <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </button>
                <span class="legend-icon base-icon inline-block w-4 h-0.5 opacity-40" style="background-image:repeating-linear-gradient(to right, var(--text-muted), var(--text-muted) 2px, transparent 2px, transparent 4px)" aria-hidden="true"></span>
                <span class="legend-label flex-1 text-[13px] text-[var(--text-secondary)] font-medium">基础三角化</span>
              </div>
              <div class="legend-item-new flex items-center gap-[var(--space-md)] py-1.5 px-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition-colors" data-layer="voronoi">
                <button class="legend-eye relative w-5 h-5 rounded-full border border-[var(--border-light)]
         bg-[var(--bg-input)] text-[var(--text-secondary)]
         inline-flex items-center justify-center transition-all
         hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]
         aria-[pressed=true]:border-[var(--border-input)]
         aria-[pressed=true]:bg-[var(--bg-input)]
         aria-[pressed=true]:text-[var(--primary-color)]
         aria-[pressed=true]:shadow-[0_0_0_2px_var(--primary-color)/20]
         aria-[pressed=true]:[&_.indicator]:opacity-100" aria-pressed="true" aria-checked="true" role="switch" title="显示/隐藏">
                  <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </button>
                <span class="legend-icon voronoi-icon inline-block w-4 h-0.5 rounded-[2px] bg-[var(--viz-voronoi)] shadow-[0_0_4px_var(--viz-voronoi)]" aria-hidden="true"></span>
                <span class="legend-label flex-1 text-[13px] text-[var(--text-secondary)] font-medium">Voronoi 骨架</span>
              </div>
              
              <div class="legend-sep h-px bg-[var(--border-light)] my-2 mx-2"></div>
              
              <div class="legend-item-new-wrap grid grid-cols-3 gap-2 px-2">
                <div class="legend-item-new flex flex-col items-center gap-1" aria-hidden="true">
                  <span class="legend-icon start-icon inline-block w-2.5 h-2.5 rounded-full bg-[var(--viz-start-point)] shadow-[0_0_8px_var(--viz-start-point)]"></span>
                  <span class="legend-label text-[11px] text-[var(--text-muted)]">起点</span>
                </div>
                <div class="legend-item-new flex flex-col items-center gap-1" aria-hidden="true">
                  <span class="legend-icon end-icon inline-block w-2.5 h-2.5 rounded-full bg-[var(--viz-end-point)] shadow-[0_0_8px_var(--viz-end-point)]"></span>
                  <span class="legend-label text-[11px] text-[var(--text-muted)]">终点</span>
                </div>
                <div class="legend-item-new flex flex-col items-center gap-1" aria-hidden="true">
                  <span class="legend-icon path-icon inline-block w-4 h-0.5 rounded-[2px] bg-[var(--viz-path)] shadow-[0_0_6px_var(--viz-path)]"></span>
                  <span class="legend-label text-[11px] text-[var(--text-muted)]">路径</span>
                </div>
              </div>
            </div>
          </div>

          <div class="interpretation-card glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)] group" id="path-card">
            <div class="card-header-row flex items-center justify-between gap-[var(--space-md)] pb-[var(--space-md)] border-b border-[var(--border-light)] mb-[var(--space-md)]">
              <h3 class="text-[15px] font-bold text-[var(--accent-color)] uppercase tracking-wider flex items-center gap-2 m-0">
                <span class="w-1 h-4 bg-[var(--accent-color)] rounded-full"></span>
                路径统计
              </h3>
              <div class="card-actions inline-flex gap-1">
                <button
                  id="path-refresh-btn"
                  class="btn-icon w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)] transition"
                  title="刷新上次路径"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button
                  id="path-clear-btn"
                  class="btn-icon w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)] transition"
                  title="清空当前路径"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <button
                  id="path-collapse-btn"
                  class="btn-icon w-7 h-7 inline-flex items-center justify-center text-[var(--text-muted)] rounded-[var(--radius-md)] hover:bg-[var(--bg-input-hover)] transition group"
                  title="折叠/展开"
                  aria-expanded="true"
                >
                  <svg class="transition-transform group-aria-[expanded=false]:-rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>
            </div>
            <div id="path-stats" class="stats-grid grid grid-cols-2 gap-[var(--space-md)] group-[.collapsed]:hidden">
              <div class="stat-item col-span-2 bg-[var(--bg-input)] rounded-[var(--radius-md)] p-3 border border-[var(--border-input)]">
                <span class="stat-label block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">当前状态</span>
                <span class="stat-value block text-[16px] text-[var(--primary-color)] font-bold truncate" id="path-status">等待选择...</span>
              </div>
              <div class="stat-item">
                <span class="stat-label block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">路径长度</span>
                <span class="stat-value block text-[20px] text-[var(--text-primary)] font-mono font-medium tracking-tight" id="path-length">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">节点数量</span>
                <span class="stat-value block text-[20px] text-[var(--text-primary)] font-mono font-medium tracking-tight" id="path-nodes">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">转折次数</span>
                <span class="stat-value block text-[20px] text-[var(--text-primary)] font-mono font-medium tracking-tight" id="path-turns">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label block text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">平滑耗时</span>
                <span class="stat-value block text-[20px] text-[var(--text-primary)] font-mono font-medium tracking-tight" id="path-smooth-ms">--</span>
              </div>
            </div>
            <div id="path-info" class="path-detail mt-[var(--space-md)] p-[var(--space-md)] bg-[rgba(59,130,246,0.05)] rounded-[var(--radius-md)] border border-[rgba(59,130,246,0.1)] text-[12px] text-[var(--text-secondary)] leading-[1.6] flex gap-2 group-[.collapsed]:hidden">
              <span class="text-[var(--info-color)]">💡</span>
              <p class="m-0">左键点击节点设置起点/终点，系统将自动计算最短路径。</p>
            </div>
          </div>

          <div class="interpretation-card glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)] mt-auto" id="perf-card">
            <div class="card-header-row flex items-center justify-between gap-[var(--space-md)] pb-[var(--space-sm)] mb-[var(--space-sm)]">
              <h3 class="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider m-0">性能监控</h3>
              <span
                id="perf-status-dot"
                class="status-dot ok inline-block w-2 h-2 rounded-full bg-[var(--success-color)] shadow-[0_0_6px_var(--success-color)]"
                title="系统状态正常"
              ></span>
            </div>
            <div class="stats-grid grid grid-cols-2 gap-x-[var(--space-md)] gap-y-[var(--space-sm)]">
              <div class="stat-item flex justify-between items-baseline border-b border-[var(--border-light)] pb-1">
                <span class="stat-label text-[11px] text-[var(--text-muted)]">节点总数</span>
                <span class="stat-value text-[14px] text-[var(--text-primary)] font-mono" id="node-count">0</span>
              </div>
              <div class="stat-item flex justify-between items-baseline border-b border-[var(--border-light)] pb-1">
                <span class="stat-label text-[11px] text-[var(--text-muted)]">边总数</span>
                <span class="stat-value text-[14px] text-[var(--text-primary)] font-mono" id="edge-count">0</span>
              </div>
              <div class="stat-item flex justify-between items-baseline border-b border-[var(--border-light)] pb-1">
                <span class="stat-label text-[11px] text-[var(--text-muted)]">生成耗时</span>
                <span class="stat-value text-[14px] text-[var(--text-primary)] font-mono" id="gen-time">--</span>
              </div>
              <div class="stat-item flex justify-between items-baseline border-b border-[var(--border-light)] pb-1">
                <span class="stat-label text-[11px] text-[var(--text-muted)]">渲染耗时</span>
                <span class="stat-value text-[14px] text-[var(--text-primary)] font-mono" id="render-time">--</span>
              </div>
            </div>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-interpretation-panel', InterpretationPanelElement);
