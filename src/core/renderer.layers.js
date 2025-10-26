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
      const nRT = layerC.children?.find(ch => ch.name === 'network-rt');
      const voronoi = layerC.children?.find(ch => ch.name === 'voronoi-skeleton');

      if (overlay) overlay.visible = layerVisible && (renderer.flags.baseOverlayVisible !== false);
      if (nEdges) nEdges.visible = layerVisible && (renderer.flags.networkEdgesVisible !== false);
      if (nNodes) nNodes.visible = layerVisible && (renderer.flags.networkNodesVisible !== false);
      // RT 容器在可见性上等价于（边 或 节点）可见
      if (nRT) nRT.visible = layerVisible && ((renderer.flags.networkEdgesVisible !== false) || (renderer.flags.networkNodesVisible !== false));
      if (voronoi) voronoi.visible = layerVisible && (renderer.flags.voronoiVisible !== false);

      layerC.visible = !!(overlay?.visible || nEdges?.visible || nNodes?.visible || nRT?.visible || voronoi?.visible);
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
    try {
      const removed = renderer.mainContainer.removeChildren();
      if (Array.isArray(removed)) {
        removed.forEach((ch) => {
          try {
            if (renderer.interactionContainer && ch === renderer.interactionContainer) {
              return; // keep persistent interaction container; will be re-attached later
            }
            ch.destroy && ch.destroy({ children: true });
          } catch (_) { }
        });
      }
    } catch (_) { try { renderer.mainContainer.removeChildren(); } catch (_) {} }
    renderer.layerContainers = [];
  }
  // 释放网络层静态缓存（如存在）
  try { if (renderer.invalidateNetworkRT) renderer.invalidateNetworkRT(false); } catch (_) {}
  // 释放障碍物静态缓存纹理与引用，避免内存泄漏
  try {
    if (renderer._obstacleCache) {
      if (renderer._obstacleCache.texture && typeof renderer._obstacleCache.texture.destroy === 'function') {
        renderer._obstacleCache.texture.destroy(true);
      }
      renderer._obstacleCache = null;
    }
  } catch (_) { /* ignore */ }
  // 释放已持有的数据引用（含 TypedArray），便于 GC
  // 注意：不要在此处修改 renderer.roadNetData（尤其是 TypedArray），
  // 否则在 resize 过程中重用数据会丢失 packed 内容与 overlay。
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
    const base = renderer.roadNetData.layers?.[idx]?.metadata?.overlayBase;
    const edges = base && Array.isArray(base.edges) ? base.edges : null;
    const packed = base && base.edgesPacked instanceof Float32Array ? base.edgesPacked : null;
    const any = (packed && packed.length) ? packed : edges;
    if (any && ((Array.isArray(any) && any.length) || (any instanceof Float32Array && any.length))) {
      if (renderer.drawing && typeof renderer.drawing.rebuildOverlayBase === 'function') {
        renderer.drawing.rebuildOverlayBase(overlay, any, offsetX, offsetY, cellSize);
      }
    }
  });
}
