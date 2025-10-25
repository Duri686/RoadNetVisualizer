// 层与可见性相关实现（保持与原逻辑一致）

export function applyVisibilityFlagsImpl(renderer) {
  if (renderer.obstacleLayer) {
    renderer.obstacleLayer.visible = renderer.flags.obstaclesVisible !== false;
  }
  if (Array.isArray(renderer.layerContainers)) {
    renderer.layerContainers.forEach((layerC, idx) => {
      const layerVisible = renderer.currentLayer === null ? true : idx === renderer.currentLayer;
      const overlay = layerC.children?.find(ch => ch.name === 'overlay-base');
      const nEdges = layerC.children?.find(ch => ch.name === 'network-edges');
      const nNodes = layerC.children?.find(ch => ch.name === 'network-nodes');
      const voronoi = layerC.children?.find(ch => ch.name === 'voronoi-skeleton');

      if (overlay) overlay.visible = layerVisible && (renderer.flags.baseOverlayVisible !== false);
      if (nEdges) nEdges.visible = layerVisible && (renderer.flags.networkEdgesVisible !== false);
      if (nNodes) nNodes.visible = layerVisible && (renderer.flags.networkNodesVisible !== false);
      if (voronoi) voronoi.visible = layerVisible && (renderer.flags.voronoiVisible !== false);

      layerC.visible = !!(overlay?.visible || nEdges?.visible || nNodes?.visible || voronoi?.visible);
    });
  }
}

export function setObstaclesVisibleImpl(renderer, visible) {
  renderer.flags.obstaclesVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function setNetworkVisibleImpl(renderer, visible) {
  renderer.flags.networkNodesVisible = !!visible;
  renderer.flags.networkEdgesVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function setNetworkNodesVisibleImpl(renderer, visible) {
  renderer.flags.networkNodesVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function setNetworkEdgesVisibleImpl(renderer, visible) {
  renderer.flags.networkEdgesVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function setBaseTriangulationVisibleImpl(renderer, visible) {
  renderer.flags.baseOverlayVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function setVoronoiVisibleImpl(renderer, visible) {
  renderer.flags.voronoiVisible = !!visible;
  applyVisibilityFlagsImpl(renderer);
}

export function showLayerImpl(renderer, layerIndex) {
  if (layerIndex === null) {
    renderer.layerContainers.forEach(container => { container.visible = true; });
    renderer.showAllLayers = true;
    renderer.currentLayer = null;
  } else {
    renderer.layerContainers.forEach((container, index) => { container.visible = index === layerIndex; });
    renderer.showAllLayers = false;
    renderer.currentLayer = layerIndex;
  }
  const showInteraction = layerIndex === 0;
  if (renderer.interactionContainer) {
    renderer.interactionContainer.visible = showInteraction;
  }
  if (!showInteraction) {
    renderer.interaction.disable();
  } else {
    renderer.interaction.enable();
  }
  renderer.applyVisibilityFlags();
  try { window.dispatchEvent(new CustomEvent('renderer-layer-changed')); } catch (_) {}
}

export function clearCanvasImpl(renderer) {
  if (renderer.mainContainer) {
    renderer.mainContainer.removeChildren();
    renderer.layerContainers = [];
  }
  renderer.currentLayer = null;
  renderer.showAllLayers = false;
  renderer.roadNetData = null;
}

export function rebuildAllOverlaysImpl(renderer) {
  if (!renderer.roadNetData || !Array.isArray(renderer.layerContainers)) return;
  const { offsetX, offsetY, cellSize } = renderer.transform || {};
  renderer.layerContainers.forEach((layerC, idx) => {
    const overlay = layerC.children?.find(ch => ch.name === 'overlay-base');
    if (!overlay) return;
    const edges = renderer.roadNetData.layers?.[idx]?.metadata?.overlayBase?.edges || [];
    if (edges && edges.length && renderer.drawing && typeof renderer.drawing.rebuildOverlayBase === 'function') {
      renderer.drawing.rebuildOverlayBase(overlay, edges, offsetX, offsetY, cellSize);
    }
  });
}
