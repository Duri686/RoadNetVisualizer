// 操作面板 Web Component，负责渲染左侧控制区域 DOM 结构
import exportManager from '../../utils/exportManager.js';
import shareManager from '../../utils/shareManager.js';
import statusManager from '../../utils/statusManager.js';

class OperationPanelElement extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.render();
  }

  // 渲染操作面板 DOM（使用 light DOM，复用现有 CSS 和事件绑定）
  render() {
    this.innerHTML = `
        <div class="control-panel flex flex-col gap-[var(--space-lg)] pb-4">
          <div class="input-section glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)]">
            <h3 class="text-[15px] font-bold text-[var(--accent-color)] uppercase tracking-wider mb-[var(--space-lg)] flex items-center gap-2">
              <span class="w-1 h-4 bg-[var(--accent-color)] rounded-full"></span>
              基础参数
            </h3>
            <div class="grid grid-cols-2 gap-[var(--space-md)] mb-[var(--space-lg)]">
              <div class="input-group col-span-2">
                <label for="width-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium uppercase tracking-wide">地图尺寸 (Width x Height)</label>
                <div class="flex gap-[var(--space-md)]">
                  <input
                    autocomplete="off"
                    type="text"
                    id="width-input"
                    value="500"
                    placeholder="W"
                    class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                  />
                  <span class="text-[var(--text-muted)] self-center">×</span>
                  <input
                    autocomplete="off"
                    type="text"
                    id="height-input"
                    value="300"
                    placeholder="H"
                    class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-[var(--space-md)] mb-[var(--space-lg)]">
              <div class="input-group">
                <label for="layer-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium uppercase tracking-wide">楼层数</label>
                <input
                  autocomplete="off"
                  type="text"
                  id="layer-input"
                  value="2"
                  class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                />
              </div>
              <div class="input-group">
                <label for="obstacle-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium uppercase tracking-wide">障碍物</label>
                <input
                  autocomplete="off"
                  type="text"
                  id="obstacle-input"
                  value="200"
                  class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                />
              </div>
            </div>

            <!-- Floor entrances input - shown only when floors > 1 -->
            <div
              class="input-group mb-[var(--space-lg)]"
              id="floor-entrance-group"
              style="display: none"
            >
              <label class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium uppercase tracking-wide">楼层连接点 (Stairs / Elevators)</label>
              <div class="grid grid-cols-2 gap-[var(--space-md)]">
                <div>
                  <label for="stairs-count-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium">楼梯数</label>
                  <input
                    autocomplete="off"
                    type="text"
                    id="stairs-count-input"
                    value="4"
                    class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                  />
                </div>
                <div>
                  <label for="elevator-count-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium">电梯数</label>
                  <input
                    autocomplete="off"
                    type="text"
                    id="elevator-count-input"
                    value="4"
                    class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-[var(--space-sm)] mt-[var(--space-md)] pt-[var(--space-md)] border-t border-[var(--border-light)]">
              <label class="input-group-label flex items-center gap-[var(--space-sm)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input type="checkbox" id="static-cache" class="peer sr-only" />
                <span class="w-4 h-4 rounded-[3px] border border-[var(--border-input)] bg-[var(--bg-input)] grid place-items-center transition-all  peer-checked:border-[var(--border-input)] peer-checked:[&_.indicator]:opacity-100">
                  <span class="indicator w-2 h-2 rounded-[2px] bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </span>
                <span class="text-[13px] text-[var(--text-secondary)]">启用静态层缓存</span>
              </label>
              <label class="input-group-label flex items-center gap-[var(--space-sm)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input type="checkbox" id="culling-enabled" checked class="peer sr-only" />
                <span class="w-4 h-4 rounded-[3px] border border-[var(--border-input)] bg-[var(--bg-input)] grid place-items-center transition-all  peer-checked:border-[var(--border-input)] peer-checked:[&_.indicator]:opacity-100">
                  <span class="indicator w-2 h-2 rounded-[2px] bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                </span>
                <span class="text-[13px] text-[var(--text-secondary)]">启用视窗裁剪</span>
              </label>
            </div>
          </div>

          <div class="input-section glass-panel rounded-[var(--radius-xl)] p-[var(--space-xl)] px-[var(--space-lg)]">
            <h3 class="text-[15px] font-bold text-[var(--accent-color)] uppercase tracking-wider mb-[var(--space-lg)] flex items-center gap-2">
              <span class="w-1 h-4 bg-[var(--accent-color)] rounded-full"></span>
              生成模式
            </h3>
            <div class="mode-group flex flex-col gap-[var(--space-sm)] mb-[var(--space-md)]" id="mode-group">
              <label class="mode-item relative">
                <input type="checkbox" name="mode-option" class="mode-option peer sr-only" data-value="centroid" checked />
                <div class="flex items-center justify-between px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-[var(--radius-md)] cursor-pointer transition-all peer-checked:bg-[rgba(59,130,246,0.1)] peer-checked:border-[var(--primary-color)] peer-checked:shadow-[0_0_12px_rgba(59,130,246,0.2)] peer-checked:[&_.indicator]:opacity-100 hover:bg-[var(--bg-input-hover)]">
                  <span class="text-[14px] font-medium text-[var(--text-primary)]">质心网络</span>
                  <div class="w-4 h-4 rounded-full border border-[var(--text-muted)] peer-checked:border-[var(--primary-color)] peer-checked:bg-[var(--primary-color)] flex items-center justify-center">
                    <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                  </div>
                </div>
              </label>
              <label class="mode-item relative">
                <input type="checkbox" name="mode-option" class="mode-option peer sr-only" data-value="portal" />
                <div class="flex items-center justify-between px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-[var(--radius-md)] cursor-pointer transition-all peer-checked:bg-[rgba(59,130,246,0.1)] peer-checked:border-[var(--primary-color)] peer-checked:shadow-[0_0_12px_rgba(59,130,246,0.2)] peer-checked:[&_.indicator]:opacity-100 hover:bg-[var(--bg-input-hover)]">
                  <span class="text-[14px] font-medium text-[var(--text-primary)]">Portal 中点</span>
                  <div class="w-4 h-4 rounded-full border border-[var(--text-muted)] peer-checked:border-[var(--primary-color)] peer-checked:bg-[var(--primary-color)] flex items-center justify-center">
                    <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                  </div>
                </div>
              </label>
              <label class="mode-item relative">
                <input type="checkbox" name="mode-option" class="mode-option peer sr-only" data-value="voronoi" />
                <div class="flex items-center justify-between px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-[var(--radius-md)] cursor-pointer transition-all peer-checked:bg-[rgba(59,130,246,0.1)] peer-checked:border-[var(--primary-color)] peer-checked:shadow-[0_0_12px_rgba(59,130,246,0.2)] peer-checked:[&_.indicator]:opacity-100 hover:bg-[var(--bg-input-hover)]">
                  <span class="text-[14px] font-medium text-[var(--text-primary)]">Voronoi 骨架</span>
                  <div class="w-4 h-4 rounded-full border border-[var(--text-muted)] peer-checked:border-[var(--primary-color)] peer-checked:bg-[var(--primary-color)] flex items-center justify-center">
                    <span class="indicator w-2 h-2 rounded-full bg-[var(--primary-color)] opacity-0 transition-opacity"></span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <details class="advanced-section group glass-panel rounded-[var(--radius-xl)] overflow-hidden">
            <summary class="flex items-center justify-between cursor-pointer list-none px-[var(--space-lg)] py-[var(--space-md)] bg-[var(--bg-input)] text-[13px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)]">
              <span>高级参数设置</span>
              <span class="text-[10px] transition-transform group-open:rotate-180 opacity-60">▼</span>
            </summary>
            <div class="p-[var(--space-lg)] space-y-[var(--space-md)]">
              <div class="input-group">
                <label class="input-group-label flex items-center gap-[var(--space-sm)] cursor-pointer">
                  <input type="checkbox" id="use-spatial-index" checked class="w-4 h-4 accent-[var(--primary-color)] cursor-pointer rounded" />
                  <span class="text-[13px] text-[var(--text-secondary)]">启用空间索引优化</span>
                </label>
              </div>
              <div class="input-group">
                <label for="cell-size-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium">索引单元大小</label>
                <input
                  autocomplete="off"
                  type="text"
                  id="cell-size-input"
                  placeholder="auto"
                  class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                />
              </div>
              <div class="input-group" title="裁剪边距（像素），避免临界闪烁">
                <label for="culling-margin-input" class="block mb-[var(--space-xs)] text-[var(--text-secondary)] text-[12px] font-medium">裁剪边距</label>
                <input
                  autocomplete="off"
                  type="text"
                  id="culling-margin-input"
                  value="128"
                  class="glass-input w-full px-[var(--space-md)] py-[var(--space-sm)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-[14px] font-mono"
                />
              </div>
              <div class="input-group pt-[var(--space-sm)] border-t border-[var(--border-light)]">
                <label class="input-group-label flex items-center gap-[var(--space-sm)] cursor-pointer">
                  <input type="checkbox" id="show-fps" checked class="w-4 h-4 accent-[var(--primary-color)] cursor-pointer rounded" />
                  <span class="text-[13px] text-[var(--text-secondary)]">显示 FPS</span>
                </label>
              </div>
            </div>
          </details>

          <div class="action-buttons flex flex-col mt-auto pt-[var(--space-lg)]">
            <button id="generate-btn" class="group relative overflow-hidden flex flex-col items-center gap-1 px-6 py-4 bg-[linear-gradient(135deg,#3b82f6_0%,#2563EB_100%)] border border-[rgba(147,197,253,0.25)] shadow-[0_4px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_28px_rgba(37,99,235,0.3)] hover:border-[rgba(147,197,253,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[400ms] rounded-[var(--radius-lg)]" style="transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);">
              <div class="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <span class="btn__text text-[16px] font-bold tracking-wide text-white drop-shadow-md z-10">GENERATE SYSTEM</span>
              <span class="btn__subtitle text-[10px] font-medium uppercase tracking-[2px] text-[rgba(255,255,255,0.7)] z-10">Initialize / Reset</span>
            </button>
            <div class="button-group flex gap-[var(--space-md)] mt-[var(--space-lg)]">
              <button id="download-btn" class="btn-action flex-1 inline-flex items-center justify-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-md)] border border-[var(--border-input)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-[13px] font-medium cursor-pointer transition-all hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)] hover:border-[var(--primary-color)] hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                <span>Download</span>
              </button>
              <button id="share-btn" class="btn-action flex-1 inline-flex items-center justify-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-md)] border border-[var(--border-input)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-[13px] font-medium cursor-pointer transition-all hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)] hover:border-[var(--primary-color)] hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                <span>Share</span>
              </button>
            </div>
          </div>

          <div id="status-message" class="status-message mt-[var(--space-lg)] p-[var(--space-md)] bg-[rgba(255,255,255,0.12)] backdrop-blur-[40px] rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.3)] flex items-start gap-3">
            <div class="w-2 h-2 rounded-full bg-[var(--info-color)] mt-1.5 shadow-[0_0_6px_rgba(96,165,250,0.4)] animate-pulse"></div>
            <div>
              <p class="status-text text-[13px] text-[var(--text-primary)] font-medium mb-0.5">
                System Ready
              </p>
              <p class="status-hint text-[11px] text-[var(--text-muted)]">Waiting for generation command...</p>
            </div>
          </div>
        </div>
      `;
    if (exportManager && typeof exportManager.init === 'function') {
      exportManager.init();
    }
    if (shareManager && typeof shareManager.init === 'function') {
      shareManager.init();
    }
    if (statusManager && typeof statusManager.init === 'function') {
      statusManager.init();
    }
  }
}

// 注册自定义元素
customElements.define('rn-operation-panel', OperationPanelElement);
