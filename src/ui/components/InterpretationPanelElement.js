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
        <div class="interpretation-wrapper">
          <div class="panel-header">
            <h2>数据解读</h2>
            <p class="panel-subtitle">Interpretation</p>
          </div>

          <div class="interpretation-card" id="layer-control-card">
            <div class="card-header-row">
              <h3>图层控制</h3>
            </div>
            <div id="layer-control-section" style="padding: 12px 0">
            </div>
          </div>

          <div class="interpretation-card" id="legend-card">
            <h3>图例</h3>
            <div class="legend-grid">
              <div class="legend-item-new" data-layer="obstacles">
                <button
                  class="legend-eye"
                  aria-pressed="true"
                  title="显示/隐藏"
                ></button>
                <span
                  class="legend-icon obstacle-icon"
                  aria-hidden="true"
                ></span>
                <span class="legend-label">障碍物</span>
              </div>
              <div class="legend-item-new" data-layer="networkNodes">
                <button
                  class="legend-eye"
                  aria-pressed="true"
                  title="显示/隐藏"
                ></button>
                <span class="legend-icon node-icon" aria-hidden="true"></span>
                <span class="legend-label">网络节点</span>
              </div>
              <div class="legend-item-new" data-layer="networkEdges">
                <button
                  class="legend-eye"
                  aria-pressed="true"
                  title="显示/隐藏"
                ></button>
                <span class="legend-icon edge-icon" aria-hidden="true"></span>
                <span class="legend-label">网络边</span>
              </div>
              <div class="legend-item-new" data-layer="baseTriangulation">
                <button
                  class="legend-eye"
                  aria-pressed="true"
                  title="显示/隐藏"
                ></button>
                <span class="legend-icon base-icon" aria-hidden="true"></span>
                <span class="legend-label">基础三角化</span>
              </div>
              <div class="legend-item-new" data-layer="voronoi">
                <button
                  class="legend-eye"
                  aria-pressed="true"
                  title="显示/隐藏"
                ></button>
                <span
                  class="legend-icon voronoi-icon"
                  aria-hidden="true"
                ></span>
                <span class="legend-label">Voronoi 骨架</span>
              </div>
              <div class="legend-sep"></div>
              <div class="legend-item-new-wrap">
                <div class="legend-item-new" aria-hidden="true">
                  <span class="legend-icon start-icon"></span>
                  <span class="legend-label">起点</span>
                </div>
                <div class="legend-item-new" aria-hidden="true">
                  <span class="legend-icon end-icon"></span>
                  <span class="legend-label">终点</span>
                </div>
                <div class="legend-item-new" aria-hidden="true">
                  <span class="legend-icon path-icon"></span>
                  <span class="legend-label">路径</span>
                </div>
              </div>
            </div>
          </div>

          <div class="interpretation-card" id="path-card">
            <div class="card-header-row">
              <h3>路径统计</h3>
              <div class="card-actions">
                <button
                  id="path-refresh-btn"
                  class="btn-secondary btn-compact"
                  title="刷新上次路径"
                >
                  刷新
                </button>
                <button
                  id="path-clear-btn"
                  class="btn-secondary btn-compact"
                  title="清空当前路径"
                >
                  清空
                </button>
                <button
                  id="path-collapse-btn"
                  class="btn-secondary btn-icon"
                  title="折叠/展开"
                  aria-expanded="true"
                >
                  ▾
                </button>
              </div>
            </div>
            <div id="path-stats" class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">当前路径</span>
                <span class="stat-value" id="path-status">未选择</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">路径长度</span>
                <span class="stat-value" id="path-length">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">节点数量</span>
                <span class="stat-value" id="path-nodes">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">转折次数</span>
                <span class="stat-value" id="path-turns">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">平滑耗时</span>
                <span class="stat-value" id="path-smooth-ms">-- ms</span>
              </div>
            </div>
            <div id="path-info" class="path-detail">
              <p>💡 单击画布上的节点选择起点和终点，系统将自动计算最短路径并启动 3D 导航模拟</p>
            </div>
          </div>

          <div class="interpretation-card" id="perf-card">
            <div class="card-header-row">
              <h3>性能数据</h3>
              <span
                id="perf-status-dot"
                class="status-dot ok"
                title="系统状态"
              ></span>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">总节点数</span>
                <span class="stat-value" id="node-count">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总边数</span>
                <span class="stat-value" id="edge-count">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">层数</span>
                <span class="stat-value" id="layer-count">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">生成耗时</span>
                <span class="stat-value" id="gen-time">-- ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">3D渲染</span>
                <span class="stat-value" id="render-time">-- ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">数据体积</span>
                <span class="stat-value" id="data-size">-- KB</span>
              </div>
            </div>
            <div id="perf-info" class="perf-detail">
              <p>等待生成模型...</p>
            </div>
          </div>

          <div class="interpretation-card">
            <h3>操作提示</h3>
            <div class="insights-list">
              <div class="insight-item">
                <span class="insight-icon">•</span>
                <span class="insight-text">
                  悬停：显示白色十字星，定位最近节点
                </span>
              </div>
              <div class="insight-item">
                <span class="insight-icon">•</span>
                <span class="insight-text">
                  单击：第一次选择<strong>起点</strong>，第二次选择<strong>终点</strong>，自动开始 3D 导航
                </span>
              </div>
              <div class="insight-item">
                <span class="insight-icon">•</span>
                <span class="insight-text">
                  自动导航：使用 A* 算法计算最短路径并驱动 3D 模拟
                </span>
              </div>
              <div class="insight-item">
                <span class="insight-icon">•</span>
                <span class="insight-text">
                  双击：在导航过程中结束当前导航并回到选点模式；鼠标滚轮缩放，拖拽平移视图
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
  }
}

customElements.define('rn-interpretation-panel', InterpretationPanelElement);
