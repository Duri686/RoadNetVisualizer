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
        <div class="control-panel">
          <div class="panel-header">
            <h2>操作面板</h2>
            <p class="panel-subtitle">Operation</p>
          </div>

          <div class="input-section">
            <h3>基础参数</h3>
            <div class="input-group">
              <label for="width-input">地图宽度 (Width)</label>
              <input
                autocomplete="off"
                type="text"
                id="width-input"
                value="500"
                placeholder="10-100000"
              />
            </div>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="static-cache" />
                启用静态层缓存（障碍层 RenderTexture）
              </label>
            </div>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="culling-enabled" checked />
                启用视窗裁剪
              </label>
            </div>
            <div
              class="input-group"
              title="裁剪边距（像素），避免临界闪烁。范围建议 64-256"
            >
              <label for="culling-margin-input">裁剪边距（像素）</label>
              <input
                autocomplete="off"
                type="text"
                id="culling-margin-input"
                value="128"
                placeholder="例如 128"
              />
            </div>
            <div class="input-group">
              <label for="height-input">地图高度 (Height)</label>
              <input
                autocomplete="off"
                type="text"
                id="height-input"
                value="300"
                placeholder="10-100000"
              />
            </div>
            <div class="input-group">
              <label for="layer-input">楼层数 (Floors)</label>
              <input
                autocomplete="off"
                type="text"
                id="layer-input"
                value="2"
                placeholder="1-10"
              />
            </div>

            <!-- Floor entrances input - shown only when floors > 1 -->
            <div
              class="input-group"
              id="floor-entrance-group"
              style="display: none"
            >
              <label for="floor-entrance-input"
                >楼层出入口 (Stairs/Elevators)</label
              >
              <input
                autocomplete="off"
                type="text"
                id="floor-entrance-input"
                value="4"
                placeholder="2-10"
                title="每两层之间的楼梯和电梯数量"
              />
            </div>
            <div class="input-group">
              <label for="obstacle-input">障碍物数量 (Obstacles)</label>
              <input
                autocomplete="off"
                type="text"
                id="obstacle-input"
                value="200"
                placeholder="0-不限（建议≤5000）"
              />
            </div>
          </div>

          <div class="input-section">
            <h3>生成模式</h3>
            <div class="mode-group" id="mode-group" title="生成模式">
              <label class="mode-item"
                ><input
                  type="checkbox"
                  name="mode-option"
                  class="mode-option"
                  data-value="centroid"
                  checked
                />
                质心网络</label
              >
              <label class="mode-item"
                ><input
                  type="checkbox"
                  name="mode-option"
                  class="mode-option"
                  data-value="portal"
                />
                Portal 中点</label
              >
              <label class="mode-item"
                ><input
                  type="checkbox"
                  name="mode-option"
                  class="mode-option"
                  data-value="voronoi"
                />
                Voronoi 骨架</label
              >
            </div>
            <div id="mode-help" class="mode-help">
              <div><strong>模式说明：</strong></div>
              <div>
                • <strong>质心网络</strong>：以 Delaunay 三角形的质心为可行节点
              </div>
              <div>
                • <strong>Portal 中点</strong>：以相邻三角形共享边的中点为
                Portal
              </div>
              <div>
                • <strong>Voronoi 骨架</strong>：以 Voronoi
                边为自由空间中线（实验）
              </div>
            </div>
          </div>

          <details class="advanced-section">
            <summary>高级参数</summary>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="use-spatial-index" checked />
                启用空间索引优化
              </label>
            </div>
            <div
              class="input-group"
              title="用于空间索引的单元格大小（像素）。留空为自动。"
            >
              <label for="cell-size-input">索引单元大小 (cellSize)</label>
              <input
                autocomplete="off"
                type="text"
                id="cell-size-input"
                placeholder="auto"
              />
            </div>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="show-labels" checked />
                显示障碍编号（Labels）
              </label>
            </div>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="use-bitmaptext" checked />
                使用 BitmapText（更高效）
              </label>
            </div>
            <div
              class="input-group"
              title="当单元像素尺寸低于阈值时隐藏编号，0 表示始终显示"
            >
              <label for="label-minpx-input">编号显示阈值（像素）</label>
              <input
                autocomplete="off"
                type="text"
                id="label-minpx-input"
                value="0"
                placeholder="0=始终显示"
              />
            </div>
            <div class="input-group">
              <label class="input-group-label">
                <input type="checkbox" id="show-fps" checked />
                显示 FPS（画布右上角）
              </label>
            </div>
          </details>

          <div class="action-buttons">
            <button id="generate-btn" class="btn-primary">
              <span class="btn__text">生成 / 重置</span>
              <span class="btn__subtitle">Generate / Reset</span>
            </button>
            <div class="button-group">
              <button id="download-btn" class="btn-action" title="下载模型数据">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
                <span>Download</span>
              </button>
              <button id="share-btn" class="btn-action" title="分享当前配置">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Share</span>
              </button>
            </div>
          </div>

          <div id="status-message" class="status-message">
            <p class="status-text">
              Status: <span class="status-value">Ready</span>
            </p>
            <p class="status-hint">Click "Generate" to start.</p>
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
