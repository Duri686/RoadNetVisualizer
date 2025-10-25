// 渲染主流程实现（保持与原逻辑一致）
import { createSpatialIndex } from '../utils/spatialIndex.js';

export function renderRoadNetImpl(renderer, navGraphData) {
  if (!renderer.app) {
    console.error('❌ Renderer not initialized');
    return;
  }

  // 先清空画布，再设置数据
  renderer.clearCanvas();
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
  try {
    if (Array.isArray(obstacles) && obstacles.length > 0) {
      navGraphData.spatialIndex = createSpatialIndex(width, height, obstacles);
    } else {
      navGraphData.spatialIndex = null;
    }
  } catch (e) {
    navGraphData.spatialIndex = null;
  }

  // 自适应cellSize：让地图填充画布80%
  const maxDim = Math.max(width, height);
  const availableSize = Math.min(renderer.app.screen.width, renderer.app.screen.height) * 0.8;
  const cellSize = Math.max(2, Math.floor(availableSize / maxDim));

  // 计算居中偏移
  const totalWidth = width * cellSize;
  const totalHeight = height * cellSize;
  const offsetX = (renderer.app.screen.width - totalWidth) / 2;
  const offsetY = (renderer.app.screen.height - totalHeight) / 2;

  // 先渲染障碍物层（底层）
  if (obstacles && obstacles.length > 0) {
    const obstacleContainer = renderer.drawing.renderObstacles(obstacles, offsetX, offsetY, cellSize);
    renderer.obstacleLayer = obstacleContainer;
    renderer.mainContainer.addChild(obstacleContainer);
  }

  // 为每一层创建容器并渲染
  layers.forEach((layer, index) => {
    const layerContainer = renderer.drawing.createLayerContainer(layer, index, offsetX, offsetY, cellSize);
    renderer.layerContainers.push(layerContainer);
    renderer.mainContainer.addChild(layerContainer);
  });

  // 默认显示第一层
  renderer.showLayer(0);

  // 初始应用可见性标志
  renderer.applyVisibilityFlags();

  // 保存坐标转换参数并更新子模块
  renderer.transform = {
    offsetX,
    offsetY,
    cellSize,
    scale: 1,
    panX: 0,
    panY: 0,
  };
  renderer.drawing.updateTransform(renderer.transform);
  renderer.interaction.updateTransform(renderer.transform);
  renderer.rebuildAllOverlays();
  try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}

  // 设置导航图数据并启用交互
  renderer.interaction.setRoadNetData(navGraphData);
  renderer.setupInteraction();

  console.log('✅ Rendering complete');
}
