// 渲染主流程实现（保持与原逻辑一致）
import * as PIXI from 'pixi.js';
import { createSpatialIndex } from '../utils/spatialIndex.js';

export function renderRoadNetImpl(renderer, navGraphData) {
  const tStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (!renderer.app) {
    console.error('❌ Renderer not initialized');
    return;
  }

  // 先清空画布，再设置数据
  const tClear0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  renderer.clearCanvas();
  const tClear1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  renderer.roadNetData = navGraphData;

  // 重置视图状态
  renderer.transform.scale = 1;
  renderer.transform.panX = 0;
  renderer.transform.panY = 0;
  if (renderer.mainContainer) {
    renderer.mainContainer.scale.set(1, 1);
    renderer.mainContainer.position.set(0, 0);
  }

  const { layers, obstacles, metadata } = navGraphData;
  const { width, height } = metadata;

  console.log(`🎨 Rendering ${layers.length} layers with ${obstacles?.length || 0} obstacles...`);

  // 构建并挂载空间索引，供后处理复用
  let indexMs = 0;
  try {
    const tIdx0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (Array.isArray(obstacles) && obstacles.length > 0) {
      navGraphData.spatialIndex = createSpatialIndex(width, height, obstacles);
    } else {
      navGraphData.spatialIndex = null;
    }
  } catch (e) {
    navGraphData.spatialIndex = null;
  } finally {
    const tIdx1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    indexMs = Math.max(0, Math.round(tIdx1 - (tIdx1 - 0) - 0));
    // 注：上式仅为占位，真实值在 createSpatialIndex 内已有日志，这里不重复计算
  }

  // 自适应cellSize：让地图填充画布80%
  const tLayout0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const maxDim = Math.max(width, height);
  const availableSize = Math.min(renderer.app.screen.width, renderer.app.screen.height) * 0.8;
  const cellSize = Math.max(2, Math.floor(availableSize / maxDim));

  // 计算居中偏移
  const totalWidth = width * cellSize;
  const totalHeight = height * cellSize;
  const offsetX = (renderer.app.screen.width - totalWidth) / 2;
  const offsetY = (renderer.app.screen.height - totalHeight) / 2;
  const tLayout1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // 先渲染障碍物层（底层）
  const tOb0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (obstacles && obstacles.length > 0) {
    const cfg = renderer.config || {};
    const cullingEnabled = !!(cfg.culling && cfg.culling.enabled);
    const margin = (cfg.culling && typeof cfg.culling.margin === 'number') ? cfg.culling.margin : 128;
    const cullRect = cullingEnabled ? { x: -margin, y: -margin, w: renderer.app.screen.width + margin * 2, h: renderer.app.screen.height + margin * 2 } : null;
    const cacheKey = `${obstacles?.length || 0}|${offsetX}|${offsetY}|${cellSize}`;
    const canCache = !!(cfg.caching && cfg.caching.staticLayers === true); // 默认关闭，开关控制
    if (canCache && renderer._obstacleCache && renderer._obstacleCache.key === cacheKey && renderer._obstacleCache.obsRef === obstacles && renderer._obstacleCache.sprite) {
      renderer.obstacleLayer = renderer._obstacleCache.sprite;
      renderer.mainContainer.addChild(renderer.obstacleLayer);
      try { console.log('[Cache] 复用障碍物静态纹理'); } catch (_) {}
    } else if (canCache) {
      const obstacleContainer = renderer.drawing.renderObstacles(obstacles, offsetX, offsetY, cellSize, cullRect);
      let usedSprite = false;
      try {
        const worldBounds = obstacleContainer.getBounds?.() || { x: 0, y: 0, width: 1, height: 1 };
        const region = new PIXI.Rectangle(worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height);
        const tex = renderer.app.renderer.generateTexture(obstacleContainer, { region });
        const spr = new PIXI.Sprite(tex);
        spr.name = 'obstacles';
        spr.position.set(worldBounds.x, worldBounds.y);
        renderer._obstacleCache = { key: cacheKey, obsRef: obstacles, texture: tex, sprite: spr };
        renderer.obstacleLayer = spr;
        renderer.mainContainer.addChild(spr);
        usedSprite = true;
        try { console.log('[Cache] 生成障碍物静态纹理'); } catch (_) {}
      } catch (_) {
        renderer.obstacleLayer = obstacleContainer;
        renderer.mainContainer.addChild(obstacleContainer);
      }
      if (usedSprite) {
        try { obstacleContainer.destroy({ children: true }); } catch (_) {}
      }
    } else {
      const obstacleContainer = renderer.drawing.renderObstacles(obstacles, offsetX, offsetY, cellSize, cullRect);
      renderer.obstacleLayer = obstacleContainer;
      renderer.mainContainer.addChild(obstacleContainer);
    }
  }
  const tOb1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // 为每一层创建容器并渲染
  const tLayers0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  layers.forEach((layer, index) => {
    const layerContainer = renderer.drawing.createLayerContainer(layer, index, offsetX, offsetY, cellSize);
    renderer.layerContainers.push(layerContainer);
    renderer.mainContainer.addChild(layerContainer);
  });
  const tLayers1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // 默认显示第一层
  const tVis0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  renderer.showLayer(0);

  // 初始应用可见性标志
  renderer.applyVisibilityFlags();
  const tVis1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // 保存坐标转换参数并更新子模块
  renderer.transform = {
    offsetX,
    offsetY,
    cellSize,
    scale: 1,
    panX: 0,
    panY: 0,
  };
  const tSetup0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  renderer.drawing.updateTransform(renderer.transform);
  renderer.interaction.updateTransform(renderer.transform);
  renderer.rebuildAllOverlays();
  try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
  const tSetup1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // 设置导航图数据并启用交互
  const tInter0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  renderer.interaction.setRoadNetData(navGraphData);
  renderer.setupInteraction();
  const tInter1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  const tEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const ms = (a,b) => Math.max(0, Math.round(b - a));
  const clearMs = ms(tClear0, tClear1);
  const layoutMs = ms(tLayout0, tLayout1);
  const obMs = ms(tOb0, tOb1);
  const layersMs = ms(tLayers0, tLayers1);
  const visMs = ms(tVis0, tVis1);
  const setupMs = ms(tSetup0, tSetup1);
  const interMs = ms(tInter0, tInter1);
  const totalMs = ms(tStart, tEnd);
  console.log(`[Render] 清理 ${clearMs} ms | 索引 ${indexMs} ms | 布局 ${layoutMs} ms | 障碍 ${obMs} ms | 层 ${layersMs} ms | 可见性 ${visMs} ms | 设置/覆盖 ${setupMs} ms | 交互 ${interMs} ms | 总计 ${totalMs} ms`);
  console.log('✅ Rendering complete');
}
