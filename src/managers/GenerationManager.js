import workerManager from '../core/workerManager.js';
import renderer from '../core/renderer3d.js';
import statusManager from '../utils/statusManager.js';

export default class GenerationManager {
  constructor(app) {
    this.app = app;
  }

  /**
   * 设置 Worker 回调
   */
  setupWorkerCallbacks() {
    const app = this.app;

    workerManager.setCallbacks({
      onStart: (payload) => {
        console.log('🎬 Generation started:', payload);
        app.inputForm.disable();
        app.progressBar.reset();
        app.progressBar.show();
        app.updateStats(null);
        const genEl0 = document.getElementById('gen-time');
        if (genEl0) genEl0.textContent = '-- ms';
        statusManager.setLoading('Generating road network...');
        // 端到端计时：优先使用主线程发送时刻（clientStart），降低起点偏差
        app.perf.start =
          payload && typeof payload.clientStart === 'number'
            ? payload.clientStart
            : performance.now
            ? performance.now()
            : Date.now();
      },

      onObstacleReady: (obstacles, count) => {
        console.log(`🧱 Obstacles generated: ${count}`);
      },

      onProgress: (progress, currentLayer, totalLayers, layerNodeCount) => {
        app.progressBar.updateProgress(
          progress,
          currentLayer,
          totalLayers,
          layerNodeCount,
        );
      },

      onComplete: (data) => {
        console.log('🎉 Generation completed:', data.metadata);
        app.roadNetData = data;

        // 更新 UI
        app.progressBar.updateProgress(1);
        setTimeout(() => {
          app.progressBar.hide();
        }, 1000);

        // 设置层控制
        app.layerControl.setLayers(data.layers.length, data);
        app.layerControl.show();

        // 更新统计信息
        app.updateStats(data.metadata);

        // 启用表单
        app.inputForm.enable();

        // 显示成功消息
        app.showSuccess(`成功生成 ${data.metadata.layerCount} 层道路网络！`);
        statusManager.setSuccess(
          'Generated',
          `${data.metadata.layerCount} layers created successfully.`,
        );

        // 展示性能与 L0 规模 + profiling 指标 + 渲染耗时/数据体积
        const cost = Math.max(
          0,
          Math.round(performance.now() - app.perf.start),
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
          const parts = [
            `索引:${onOff}`,
            `索引构建 ${prof.indexBuildMs} ms`,
            `候选均值 ${avgCandidates}/边`,
          ];
          const addIfNum = (label, v) => {
            if (typeof v === 'number' && isFinite(v) && v >= 0)
              parts.push(`${label} ${Math.round(v)} ms`);
          };
          addIfNum('提取', prof.tExtractMs);
          addIfNum('Delaunay', prof.tDelaunayMs);
          addIfNum('节点', prof.tNodeBuildMs);
          addIfNum('边遍历', prof.tEdgeIterMs);
          addIfNum('候选查询', prof.tPoolQueryMs);
          addIfNum('穿障', prof.tLosMs);
          if (typeof prof.edgesChecked === 'number')
            parts.push(`边检查 ${prof.edgesChecked}`);
          if (typeof prof.losChecks === 'number')
            parts.push(`穿障检查 ${prof.losChecks}`);
          profText = ' | ' + parts.join(' | ');
        }
        const tRender0 = performance?.now ? performance.now() : Date.now();
        renderer.renderRoadNet(data);
        const tRender1 = performance?.now ? performance.now() : Date.now();
        const renderMs = Math.max(0, Math.round(tRender1 - tRender0));

        let dataKB = '-';
        try {
          const payload = { layers: data.layers, obstacles: data.obstacles };
          const len = JSON.stringify(payload).length;
          dataKB = Math.round(len / 1024);
        } catch (e) {
          /* ignore stringify errors */
        }

        const renderTimeEl = document.getElementById('render-time');
        const dataSizeEl = document.getElementById('data-size');
        if (renderTimeEl) renderTimeEl.textContent = `${renderMs} ms`;
        if (dataSizeEl) dataSizeEl.textContent = `${dataKB} KB`;

        const initMs = app.perf.initRenderMs || 0;
        const wprof = meta && meta.workerProfile;
        let wprofText = '';
        let deltaText = '';
        if (
          wprof &&
          typeof wprof.obstaclesMs === 'number' &&
          typeof wprof.buildMs === 'number'
        ) {
          const partsW = [];
          partsW.push(`障碍生成 ${wprof.obstaclesMs} ms`);
          partsW.push(`构建 ${wprof.buildMs} ms`);
          if (typeof wprof.overlayMs === 'number')
            partsW.push(`Overlay ${wprof.overlayMs} ms`);
          wprofText = ' | ' + partsW.join(' | ');
          const genMs =
            (wprof.obstaclesMs || 0) +
            (wprof.buildMs || 0) +
            (wprof.overlayMs || 0);
          const delta = Math.round(cost - genMs);
          deltaText = ` | 主线程开销 ${delta} ms`;
        }
        if (perfInfo)
          perfInfo.textContent = `详细分析：可行节点 ${nodeCount} | 可行边 ${edgeCount}${profText}${wprofText}${deltaText}`;
      },

      onError: (error) => {
        console.error('💥 Generation error:', error);
        app.progressBar.hide();
        app.inputForm.enable();
        const msg =
          (error && (error.message || error.reason || error.type)) ||
          '未知错误（请检查控制台日志）';
        app.showError('生成失败: ' + msg);
        statusManager.setError(msg);
        const genElErr = document.getElementById('gen-time');
        if (genElErr) genElErr.textContent = '-- ms';
      },
    });
  }

  /**
   * 处理生成请求
   */
  handleGenerate(values) {
    const app = this.app;
    const {
      width,
      height,
      layerCount,
      obstacleCount,
      mode,
      useSpatialIndex,
      cellSize,
      staticCache,
      cullingEnabled,
      cullingMargin,
    } = values;

    console.log(
      `🎯 Generating navigation graph: ${width}×${height}×${layerCount} layers, ${obstacleCount} obstacles`,
    );

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
    app.roadNetData = null;
    app.layerControl.reset();
    renderer.clearCanvas();

    try {
      const cfg =
        app.renderer && app.renderer.config ? app.renderer.config : null;
      if (cfg) {
        cfg.caching = cfg.caching || {};
        if (typeof staticCache === 'boolean')
          cfg.caching.staticLayers = staticCache;

        cfg.culling = cfg.culling || {};
        if (typeof cullingEnabled === 'boolean')
          cfg.culling.enabled = cullingEnabled;
        if (typeof cullingMargin === 'number' && isFinite(cullingMargin))
          cfg.culling.margin = Math.max(0, cullingMargin);
      }
    } catch (e) {
      console.debug('[Config] apply label config skipped:', e);
    }

    const success = workerManager.generateNavGraph(
      width,
      height,
      layerCount,
      obstacleCount,
      undefined,
      mode,
      { useSpatialIndex, cellSize, overlayMode: 'auto' },
    );

    if (!success) {
      app.showError('无法启动生成任务，请稍后重试');
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
}
