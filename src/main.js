/**
 * Main Application
 * 主应用入口，协调各个模块
 */

import workerManager from './core/workerManager.js';
import renderer from './core/renderer3d.js';
import InputForm from './components/InputForm.js';
import ProgressBar from './components/ProgressBar.js';
import LayerControl from './components/LayerControl.js';
import statusManager from './utils/statusManager.js';
import exportManager from './utils/exportManager.js';
import shareManager from './utils/shareManager.js';
import layerToggleManager from './utils/layerToggleManager.js';
// import navigatorManager from './utils/navigatorManager.js'; // 已禁用以优化性能
import { findPathAStar } from './utils/pathfinding.js';
import { smoothPathVisibility } from './utils/pathSmoothing.js';

// #TODO: 添加错误边界处理
// #TODO: 添加性能监控
// #TODO: 添加用户偏好设置（保存到 localStorage）

class App {
  constructor() {
    this.inputForm = null;
    this.progressBar = null;
    this.layerControl = null;
    this.roadNetData = null;
    this.renderer = renderer; // 暴露渲染器引用
    this.isInitialized = false;
    // 性能计时（仅记录耗时，不显示 Loading）
    this.perf = { start: 0 };
  }

  /**
   * 图例显隐控制（右侧面板）
   */
  setupLegendControls() {
    const card = document.getElementById('legend-card');
    if (!card) return;

    // 初始化：根据管理器状态同步“眼睛”按钮
    try {
      const states = layerToggleManager.getLayerStates();
      card.querySelectorAll('.legend-item-new[data-layer]').forEach((item) => {
        const key = item.getAttribute('data-layer');
        const btn = item.querySelector('.legend-eye');
        const on = states[key] !== false;
        item.classList.toggle('off', !on);
        if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    } catch (e) {
      console.debug('[Legend] init sync skipped:', e);
    }

    // 事件委托：点击眼睛切换图层
    card.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.legend-eye');
      if (!btn) return;
      const item = btn.closest('.legend-item-new');
      const key = item && item.getAttribute('data-layer');
      if (!key) return;
      const current = btn.getAttribute('aria-pressed') === 'true';
      const next = !current;
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      item.classList.toggle('off', !next);
      // 联动渲染器
      layerToggleManager.toggleLayer(key, next);
    });
  }

  /**
   * 路径面板交互：清空/刷新/折叠
   */
  setupPathPanelControls() {
    const clearBtn = document.getElementById('path-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        try { renderer.interaction && renderer.interaction.clearPath(); } catch (e) {}
      });
    }

    const refreshBtn = document.getElementById('path-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        try { renderer.interaction && renderer.interaction.redrawLastPath(); } catch (e) {}
      });
    }

    const collapseBtn = document.getElementById('path-collapse-btn');
    const pathCard = document.getElementById('path-card');
    if (collapseBtn && pathCard) {
      collapseBtn.addEventListener('click', () => {
        const collapsed = pathCard.classList.toggle('collapsed');
        collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('🚀 Initializing RoadNet Visualizer...');

      // 初始化 UI 组件
      this.inputForm = new InputForm();
      this.progressBar = new ProgressBar();
      this.layerControl = new LayerControl();

      // 初始化 Worker Manager
      workerManager.init();
      this.setupWorkerCallbacks();

      // 初始化渲染器
      const pixiContainer = document.getElementById('pixi-canvas');
      
      // 等待浏览器完成布局后再初始化 PixiJS
      await new Promise((resolve) => requestAnimationFrame(resolve));
      
      const tInit0 = performance?.now ? performance.now() : Date.now();
      
      // 获取实际容器尺寸
      const containerWidth = pixiContainer.clientWidth || 800;
      const containerHeight = pixiContainer.clientHeight || 600;
      
      console.log(`[Renderer] Initializing with size: ${containerWidth}x${containerHeight}`);
      
      renderer.init(pixiContainer, {
        width: containerWidth,
        height: containerHeight,
      });
      const tInit1 = performance?.now ? performance.now() : Date.now();
      this.perf.initRenderMs = Math.max(0, Math.round(tInit1 - tInit0));

      // 初始化 FPS 开关状态同步到渲染器
      try {
        const fpsChk = document.getElementById('show-fps');
        if (fpsChk && typeof renderer.setFpsVisible === 'function') {
          renderer.setFpsVisible(!!fpsChk.checked);
        }
      } catch (_) {}

      // 全屏切换功能
      const fullscreenBtn = document.getElementById('fullscreen-btn');
      const canvasContainer = document.querySelector('.canvas-container');
      fullscreenBtn.addEventListener('click', () => {
        console.log(
          `[UI] fullscreen button clicked. currentFS=${!!document.fullscreenElement}, pixiContainer=${
            pixiContainer.clientWidth
          }x${pixiContainer.clientHeight}`,
        );
        if (!document.fullscreenElement) {
          canvasContainer.requestFullscreen().catch((err) => {
            alert(`无法进入全屏模式: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      });

      // 监听全屏变化，调整渲染器尺寸
      document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        const canvasInfo = document.getElementById('canvas-info');

        // 延迟一小段时间再调整尺寸，以确保 DOM 更新完毕
        setTimeout(() => {
          let newWidth, newHeight;
          if (isFullscreen) {
            newWidth = screen.width;
            const infoH = canvasInfo && canvasInfo.offsetHeight ? canvasInfo.offsetHeight : 0;
            newHeight = screen.height - infoH;
          } else {
            // 退出全屏时，强制使用容器的 clientWidth/Height
            newWidth = pixiContainer.clientWidth;
            newHeight = pixiContainer.clientHeight;
          }
          console.log(
            `[Resize][fullscreenchange] isFS=${isFullscreen} screen=${screen.width}x${screen.height} pixiContainer=${pixiContainer.clientWidth}x${pixiContainer.clientHeight} canvasInfoH=${canvasInfo?.offsetHeight} -> resize(${newWidth}x${newHeight})`,
          );
          renderer.resize(newWidth, newHeight);
          console.log(`[Resize][fullscreenchange] renderer.resize done.`);
        }, 100); // 100ms 延迟
      });

      // 绑定 UI 事件
      this.setupUIEventHandlers();
      
      // 绑定缩放工具栏按钮
      this.setupZoomControls();

      // 绑定侧栏交互
      this.setupLegendControls();
      this.setupLegendControls();
      this.setupPathPanelControls();
      
      // 监听 3D 渲染器的寻路请求
      window.addEventListener('renderer-path-request', (e) => {
          const { start, end } = e.detail;
          if (start && end && renderer.roadNetData) {
              console.log('Path request received:', start, end);
              const layerIndex = start.layer || 0;
              const layer = renderer.roadNetData.layers[layerIndex];
              
              if (layer) {
                  setTimeout(() => {
                      const smoothStartTime = performance.now();
                      
                      // 1. 使用A*算法查找原始路径
                      let path = findPathAStar(layer, start, end);
                      console.log('Raw path found:', path?.length, 'nodes');
                      
                      if (path && path.length > 1) {
                          // 2. 应用可见性平滑（与2D版本相同）
                          const obstacles = renderer.roadNetData.obstacles || [];
                          const metadata = renderer.roadNetData.metadata || {};
                          
                          try {
                              const smoothedPath = smoothPathVisibility(path, obstacles, {
                                  width: metadata.width || 0,
                                  height: metadata.height || 0,
                                  useSpatialIndex: true,
                                  maxLookahead: 100, // 增加前瞻距离，优先选择直线路径
                                  clearance: 2.0 // 保持2.0单位安全距离
                              });
                              
                              const smoothTime = performance.now() - smoothStartTime;
                              console.log('Smoothed path:', smoothedPath.length, 'nodes (reduced from', path.length, ')');
                              path = smoothedPath;
                              
                              // 3. 计算路径统计
                              let totalLength = 0;
                              let turns = 0;
                              for (let i = 0; i < path.length - 1; i++) {
                                  const dx = path[i + 1].x - path[i].x;
                                  const dy = path[i + 1].y - path[i].y;
                                  totalLength += Math.sqrt(dx * dx + dy * dy);
                                  
                                  // 计算转折（方向变化）
                                  if (i > 0) {
                                      const dx1 = path[i].x - path[i - 1].x;
                                      const dy1 = path[i].y - path[i - 1].y;
                                      const dx2 = path[i + 1].x - path[i].x;
                                      const dy2 = path[i + 1].y - path[i].y;
                                      
                                      const angle1 = Math.atan2(dy1, dx1);
                                      const angle2 = Math.atan2(dy2, dx2);
                                      const angleDiff = Math.abs(angle2 - angle1);
                                      
                                      if (angleDiff > 0.1) turns++;
                                  }
                              }
                              
                              // 4. 更新UI统计
                              const pathStatus = document.getElementById('path-status');
                              const pathLength = document.getElementById('path-length');
                              const pathNodes = document.getElementById('path-nodes');
                              const pathTurns = document.getElementById('path-turns');
                              const pathSmoothMs = document.getElementById('path-smooth-ms');
                              
                              if (pathStatus) pathStatus.textContent = '已找到';
                              if (pathLength) pathLength.textContent = `${totalLength.toFixed(2)} m`;
                              if (pathNodes) pathNodes.textContent = path.length;
                              if (pathTurns) pathTurns.textContent = turns;
                              if (pathSmoothMs) pathSmoothMs.textContent = `${smoothTime.toFixed(1)} ms`;
                              
                          } catch (e) {
                              console.warn('Path smoothing failed, using raw path:', e);
                          }
                          
                          // 5. 绘制平滑后的路径
                          renderer.drawPath(path);
                      } else {
                          console.warn('No path found');
                          
                          // 更新UI为未找到
                          const pathStatus = document.getElementById('path-status');
                          if (pathStatus) pathStatus.textContent = '未找到';
                      }
                  }, 0);
              }
          }
      });

      // 使用 ResizeObserver 监听 #pixi-canvas 实际尺寸变化，避免初次布局与自适应引发抖动
      try {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const cr = entry.contentRect;
            const newW = Math.max(1, Math.round(cr.width));
            const newH = Math.max(1, Math.round(cr.height));
            if (this.appLastW !== newW || this.appLastH !== newH) {
              console.log(`[ResizeObserver] Container size changed: ${newW}x${newH}`);
              this.appLastW = newW;
              this.appLastH = newH;
              renderer.resize(newW, newH);
            }
          }
        });
        ro.observe(pixiContainer);
        this._pixiResizeObserver = ro;
        console.log('[ResizeObserver] Started observing container');
      } catch (e) {
        console.warn('[ResizeObserver] not available:', e);
      }

      this.isInitialized = true;
      console.log('✅ Application initialized successfully');

      // 显示欢迎信息
      this.showWelcomeMessage();
      statusManager.setReady();
      // 记录 LayerControl 运行模式
      try {
        const headless = this.layerControl && this.layerControl._headless;
        console.log(`[LayerControl] mode=${headless ? 'headless' : 'with-ui'}`);
      } catch (e) {
        console.debug('[LayerControl] mode log skipped:', e);
      }

      // 尝试从 URL 加载参数
      const hasUrlParams = shareManager.loadFromUrl();
      
      // 等待首屏布局稳定后再触发一次默认生成，避免初始测量抖动
      setTimeout(() => {
        if (hasUrlParams) {
          // 如果有 URL 参数，使用 URL 参数生成
          const values = this.inputForm.getValues();
          this.handleGenerate(values);
        } else {
          // 否则使用默认参数
          this.autoGenerateOnce();
        }
      }, 120);
    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showError('应用初始化失败: ' + error.message);
    }
  }

  /**
   * 设置 Worker 回调
   */
  setupWorkerCallbacks() {
    workerManager.setCallbacks({
      onStart: (payload) => {
        console.log('🎬 Generation started:', payload);
        this.inputForm.disable();
        this.progressBar.reset();
        this.progressBar.show();
        this.updateStats(null);
        const genEl0 = document.getElementById('gen-time');
        if (genEl0) genEl0.textContent = '-- ms';
        statusManager.setLoading('Generating road network...');
        // 端到端计时：优先使用主线程发送时刻（clientStart），降低起点偏差
        this.perf.start = (payload && typeof payload.clientStart === 'number')
          ? payload.clientStart
          : (performance.now ? performance.now() : Date.now());
      },

      onObstacleReady: (obstacles, count) => {
        console.log(`🧱 Obstacles generated: ${count}`);
      },

      onProgress: (progress, currentLayer, totalLayers, layerNodeCount) => {
        this.progressBar.updateProgress(
          progress,
          currentLayer,
          totalLayers,
          layerNodeCount,
        );
      },

      onComplete: (data) => {
        console.log('🎉 Generation completed:', data.metadata);
        this.roadNetData = data;

        // 更新 UI
        this.progressBar.updateProgress(1);
        setTimeout(() => {
          this.progressBar.hide();
        }, 1000);

        // 设置层控制
        this.layerControl.setLayers(data.layers.length, data);
        this.layerControl.show();

        // 更新统计信息
        this.updateStats(data.metadata);

        // 启用表单
        this.inputForm.enable();

        // 显示成功消息
        this.showSuccess(`成功生成 ${data.metadata.layerCount} 层道路网络！`);
        statusManager.setSuccess('Generated', `${data.metadata.layerCount} layers created successfully.`);

        // 展示性能与 L0 规模 + profiling 指标 + 渲染耗时/数据体积
        const cost = Math.max(
          0,
          Math.round(performance.now() - this.perf.start),
        );
        const genTimeEl = document.getElementById('gen-time');
        if (genTimeEl) genTimeEl.textContent = `${cost} ms`;
        const perfInfo = document.getElementById('perf-info');
        const l0 =
          data && data.layers && data.layers[0] ? data.layers[0] : null;
        const nodeCount = l0 && l0.nodes ? l0.nodes.length : 0;
        const edgeCount = l0 && l0.edges ? l0.edges.length : 0;
        const meta = data && data.metadata ? data.metadata : {};
        const prof =
          meta.profile || (l0 && l0.metadata && l0.metadata.profile) || null;
        let profText = '';
        if (prof) {
          const avgCandidates =
            prof.edgesChecked > 0
              ? (prof.candidatesAccum / prof.edgesChecked).toFixed(1)
              : '-';
          const onOff = meta.useSpatialIndex ? '启用' : '关闭';
          // 细分计时（若存在）
          const parts = [`索引:${onOff}`, `索引构建 ${prof.indexBuildMs} ms`, `候选均值 ${avgCandidates}/边`];
          const addIfNum = (label, v) => {
            if (typeof v === 'number' && isFinite(v) && v >= 0) parts.push(`${label} ${Math.round(v)} ms`);
          };
          addIfNum('提取', prof.tExtractMs);
          addIfNum('Delaunay', prof.tDelaunayMs);
          addIfNum('节点', prof.tNodeBuildMs);
          addIfNum('边遍历', prof.tEdgeIterMs);
          addIfNum('候选查询', prof.tPoolQueryMs);
          addIfNum('穿障', prof.tLosMs);
          if (typeof prof.edgesChecked === 'number') parts.push(`边检查 ${prof.edgesChecked}`);
          if (typeof prof.losChecks === 'number') parts.push(`穿障检查 ${prof.losChecks}`);
          profText = ' | ' + parts.join(' | ');
        }
        // 单次渲染测时（避免上方重复渲染）
        const tRender0 = performance?.now ? performance.now() : Date.now();
        renderer.renderRoadNet(data);
        const tRender1 = performance?.now ? performance.now() : Date.now();
        const renderMs = Math.max(0, Math.round(tRender1 - tRender0));
        
        // 更新缩略图导航
        // navigatorManager.render(data); // 已禁用以优化性能
        
        // 计算数据体积
        let dataKB = '-';
        try {
          const payload = { layers: data.layers, obstacles: data.obstacles };
          const len = JSON.stringify(payload).length;
          dataKB = Math.round(len / 1024);
        } catch (e) {
          /* ignore stringify errors */
        }
        
        // 更新3D渲染和数据体积UI
        const renderTimeEl = document.getElementById('render-time');
        const dataSizeEl = document.getElementById('data-size');
        if (renderTimeEl) renderTimeEl.textContent = `${renderMs} ms`;
        if (dataSizeEl) dataSizeEl.textContent = `${dataKB} KB`;
        
        const initMs = this.perf.initRenderMs || 0;
        // 追加 worker 侧拆账（若存在）
        const wprof = meta && meta.workerProfile;
        let wprofText = '';
        let deltaText = '';
        if (wprof && typeof wprof.obstaclesMs === 'number' && typeof wprof.buildMs === 'number') {
          const partsW = [];
          partsW.push(`障碍生成 ${wprof.obstaclesMs} ms`);
          partsW.push(`构建 ${wprof.buildMs} ms`);
          if (typeof wprof.overlayMs === 'number') partsW.push(`Overlay ${wprof.overlayMs} ms`);
          wprofText = ' | ' + partsW.join(' | ');
          // 计算端到端与生成(Worker)的差值，便于识别主线程/传输/渲染噪声
          const genMs = (wprof.obstaclesMs || 0) + (wprof.buildMs || 0) + (wprof.overlayMs || 0);
          const delta = Math.round(cost - genMs);
          deltaText = ` | 主线程开销 ${delta} ms`;
        }
        if (perfInfo)
          perfInfo.textContent = `详细分析：可行节点 ${nodeCount} | 可行边 ${edgeCount}${profText}${wprofText}${deltaText}`;
      },

      onError: (error) => {
        console.error('💥 Generation error:', error);
        this.progressBar.hide();
        this.inputForm.enable();
        this.showError('生成失败: ' + error.message);
        statusManager.setError(error.message || 'Generation failed.');
        const genElErr = document.getElementById('gen-time');
        if (genElErr) genElErr.textContent = '-- ms';

        // 仅恢复交互，无 Loading 弹窗
      },
    });
  }

  /**
   * 设置缩放控制
   */
  setupZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        renderer.zoomIn();
        const vp = renderer.getViewportRect && renderer.getViewportRect();
        if (vp) console.debug('[Zoom] in, viewport=', vp);
      });
    } else {
      console.warn('[UI] #zoom-in-btn not found');
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        renderer.zoomOut();
        const vp = renderer.getViewportRect && renderer.getViewportRect();
        if (vp) console.debug('[Zoom] out, viewport=', vp);
      });
    } else {
      console.warn('[UI] #zoom-out-btn not found');
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        renderer.resetView();
        const vp = renderer.getViewportRect && renderer.getViewportRect();
        if (vp) console.debug('[Zoom] reset, viewport=', vp);
      });
    } else {
      console.warn('[UI] #zoom-reset-btn not found');
    }
  }

  /**
   * 设置 UI 事件处理
   */
  setupUIEventHandlers() {
    // 表单提交
    this.inputForm.onSubmit((values) => {
      console.log('📝 Form submitted:', values);
      this.handleGenerate(values);
    });

    // 层切换
    this.layerControl.onLayerChange((layerIndex) => {
      console.log(`🔄 Switching to layer ${layerIndex}`);
      renderer.showLayer(layerIndex);
      this.layerControl.updateLayerInfo(this.roadNetData);
    });

    // 显示所有层
    this.layerControl.onShowAll(() => {
      console.log('👀 Showing all layers');
      renderer.showLayer(null);
    });

    // 窗口大小调整
    const pixiContainer = document.getElementById('pixi-canvas');
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!document.fullscreenElement) {
          const w = pixiContainer.clientWidth;
          const h = pixiContainer.clientHeight;
          console.log(
            `[Resize][window] viewport=${window.innerWidth}x${window.innerHeight} pixiContainer=${w}x${h} -> resize(${w}x${h})`,
          );
          renderer.resize(w, h);
        }
      }, 250);
    });

    // FPS 显示开关
    try {
      const fpsChk = document.getElementById('show-fps');
      if (fpsChk && typeof renderer.setFpsVisible === 'function') {
        fpsChk.addEventListener('change', () => {
          renderer.setFpsVisible(!!fpsChk.checked);
        });
      }
    } catch (_) {}
  }

  /**
   * 处理生成请求
   */
  handleGenerate(values) {
    const {
      width,
      height,
      layerCount,
      obstacleCount,
      mode,
      useSpatialIndex,
      cellSize,
      // 新增：渲染标签相关配置
      showLabels,
      useBitmapText,
      labelMinPx,
      // 新增：静态缓存与裁剪
      staticCache,
      cullingEnabled,
      cullingMargin,
    } = values;

    console.log(
      `🎯 Generating navigation graph: ${width}×${height}×${layerCount} layers, ${obstacleCount} obstacles`,
    );

    // 清空之前的数据
    // 先清理交互层（动画、路径线、起终点标记、提示面板）
    if (renderer && renderer.interaction) {
      try {
        renderer.interaction.cancelAnimationIfAny();
        renderer.interaction.clearInteractionGraphics();
        if (typeof renderer.interaction.resetPathInfo === 'function') {
          renderer.interaction.resetPathInfo();
        }
      } catch (e) {
        console.warn('[Interaction] 清理失败但不影响生成：', e);
      }
    }
    this.roadNetData = null;
    this.layerControl.reset();
    renderer.clearCanvas();

    // 在生成前应用渲染配置（最小改动：仅更新相关字段）
    try {
      const cfg = this.renderer && this.renderer.config ? this.renderer.config : null;
      if (cfg) {
        cfg.labels = cfg.labels || {};
        if (typeof showLabels === 'boolean') cfg.labels.enabled = showLabels;
        if (typeof useBitmapText === 'boolean') cfg.labels.useBitmapText = useBitmapText;
        if (typeof labelMinPx === 'number' && isFinite(labelMinPx)) cfg.labels.minPixelForLabel = Math.max(0, labelMinPx);

        cfg.caching = cfg.caching || {};
        if (typeof staticCache === 'boolean') cfg.caching.staticLayers = staticCache;

        cfg.culling = cfg.culling || {};
        if (typeof cullingEnabled === 'boolean') cfg.culling.enabled = cullingEnabled;
        if (typeof cullingMargin === 'number' && isFinite(cullingMargin)) cfg.culling.margin = Math.max(0, cullingMargin);
      }
    } catch (e) { console.debug('[Config] apply label config skipped:', e); }

    // 开始生成
    const success = workerManager.generateNavGraph(
      width,
      height,
      layerCount,
      obstacleCount,
      undefined,
      mode,
      { useSpatialIndex, cellSize },
    );

    if (!success) {
      this.showError('无法启动生成任务，请稍后重试');
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(metadata) {
    const nodeCount = document.getElementById('node-count');
    const edgeCount = document.getElementById('edge-count');
    const layerCount = document.getElementById('layer-count');
    const genTimeEl = document.getElementById('gen-time');

    if (metadata) {
      if (nodeCount) nodeCount.textContent = `节点: ${metadata.totalNodes}`;
      if (edgeCount) edgeCount.textContent = `边: ${metadata.totalEdges}`;
      if (layerCount) layerCount.textContent = `层数: ${metadata.layerCount}`;
    } else {
      if (nodeCount) nodeCount.textContent = '节点: 0';
      if (edgeCount) edgeCount.textContent = '边: 0';
      if (layerCount) layerCount.textContent = '层数: 0';
      if (genTimeEl) genTimeEl.textContent = '-- ms';
    }
  }

  /**
   * 首次自动生成一张地图（默认参数）
   */
  autoGenerateOnce() {
    try {
      const w = document.getElementById('width-input');
      const h = document.getElementById('height-input');
      const l = document.getElementById('layer-input');
      const o = document.getElementById('obstacle-input');
      const si = document.getElementById('use-spatial-index');
      const lbl = document.getElementById('show-labels');
      const bmt = document.getElementById('use-bitmaptext');
      const lpx = document.getElementById('label-minpx-input');
      const sc = document.getElementById('static-cache');
      const ce = document.getElementById('culling-enabled');
      const cm = document.getElementById('culling-margin-input');
      if (w) w.value = '500';
      if (h) h.value = '300';
      if (l) l.value = '1';
      if (o) o.value = '200';
      if (si) si.checked = true;
      if (lbl) lbl.checked = true;
      if (bmt) bmt.checked = true;
      if (lpx) lpx.value = '0';
      if (sc) sc.checked = false;
      if (ce) ce.checked = true;
      if (cm) cm.value = '128';
      const values = this.inputForm.getValues();
      this.handleGenerate(values);
    } catch (e) {
      console.warn('Auto generate failed:', e);
    }
  }

  /**
   * 显示欢迎消息
   */
  showWelcomeMessage() {
    console.log(`
╔═══════════════════════════════════════╗
║   🧭 RoadNet Visualizer MVP v1.0     ║
║   多层道路网络生成与可视化工具       ║
╚═══════════════════════════════════════╝

👉 使用说明:
1. 输入网格尺寸（宽度 × 高度）
2. 选择层数
3. 点击"生成道路网络"按钮
4. 使用层控制查看不同层
    `);
  }

  /**
   * 显示错误消息
   */
  showError(message) {
    console.error('❌', message);
    alert('❌ ' + message);
  }

  /**
   * 显示成功消息
   */
  showSuccess(message) {
    console.log('✅', message);
    // #TODO: 使用更友好的通知组件（如 toast）
  }

  /**
   * 清理资源
   */
  destroy() {
    workerManager.terminate();
    renderer.destroy();
    console.log('🛑 Application destroyed');
  }
}

// 创建并初始化应用
const app = new App();

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// 导出应用实例（用于调试）
window.roadNetApp = app;

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  app.destroy();
});
