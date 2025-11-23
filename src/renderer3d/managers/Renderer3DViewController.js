// 相机、视口与楼层可见性控制逻辑

export * from './Renderer3DCameraController.js';

export function showLayerInScene(renderer, index) {
  if (!renderer || !renderer.scene) return;

  // Legacy support or "Show All" (index === null)
  if (index === null) {
    renderer.scene.children.forEach((child) => {
      if (child.userData && typeof child.userData.layerIndex === 'number') {
        child.visible = true;
      }
    });
    return;
  }

  setLayerVisibilityInScene(renderer, index, true);
}

export function setLayerVisibilityInScene(renderer, index, visible) {
  if (!renderer || !renderer.scene) return;

  renderer.scene.children.forEach((child) => {
    if (child.userData && child.userData.layerIndex === index) {
      child.visible = visible;
    }
  });
}
