// 相机、视口与楼层可见性控制逻辑

export * from './Renderer3DCameraController.js';

export function showLayerInScene(renderer, index) {
  if (!renderer || !renderer.scene) return;

  // Legacy support or "Show All" (index === null)
  if (index === null) {
    const layers =
      renderer.roadNetData && Array.isArray(renderer.roadNetData.layers)
        ? renderer.roadNetData.layers
        : [];
    if (!renderer.visibleLayers || !(renderer.visibleLayers instanceof Set)) {
      renderer.visibleLayers = new Set();
    } else {
      renderer.visibleLayers.clear();
    }
    layers.forEach((_, layerIdx) => {
      renderer.visibleLayers.add(layerIdx);
    });

    renderer.scene.children.forEach((child) => {
      if (child.userData && typeof child.userData.layerIndex === 'number') {
        child.visible = true;
      }

      if (child.name === 'obstacles') {
        child.children.forEach((mesh) => {
          mesh.visible = true;
        });
      }
    });
    return;
  }

  setLayerVisibilityInScene(renderer, index, true);
}

export function setLayerVisibilityInScene(renderer, index, visible) {
  if (!renderer || !renderer.scene) return;

  if (typeof index === 'number' && index >= 0) {
    const layers =
      renderer.roadNetData && Array.isArray(renderer.roadNetData.layers)
        ? renderer.roadNetData.layers
        : [];
    if (!renderer.visibleLayers || !(renderer.visibleLayers instanceof Set)) {
      renderer.visibleLayers = new Set();
      for (let i = 0; i < layers.length; i++) {
        renderer.visibleLayers.add(i);
      }
    }
    if (visible) {
      renderer.visibleLayers.add(index);
    } else {
      renderer.visibleLayers.delete(index);
    }
  }

  renderer.scene.children.forEach((child) => {
    if (child.userData && child.userData.layerIndex === index) {
      child.visible = visible;
    }

    // 同步障碍物：根据 mesh.userData.layerIndex 控制每层障碍可见性
    if (child.name === 'obstacles') {
      child.children.forEach((mesh) => {
        const meshLayer =
          mesh.userData && typeof mesh.userData.layerIndex === 'number'
            ? mesh.userData.layerIndex
            : 0;
        if (meshLayer === index) {
          mesh.visible = visible;
        }
      });
    }
  });
}
