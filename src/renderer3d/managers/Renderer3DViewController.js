// 相机、视口与楼层可见性控制逻辑

export function zoomInCamera(renderer) {
  if (!renderer || !renderer.camera || !renderer.controls) return;
  renderer.camera.position.multiplyScalar(0.8);
  renderer.controls.update();
}

export function zoomOutCamera(renderer) {
  if (!renderer || !renderer.camera || !renderer.controls) return;
  renderer.camera.position.multiplyScalar(1.2);
  renderer.controls.update();
}

export function resetViewCamera(renderer) {
  if (!renderer || !renderer.sceneManager) return;
  renderer.sceneManager.setCameraPosition(100, 100, 100);
  renderer.sceneManager.setControlsTarget(0, 0, 0);
}

export function getViewportRectForRenderer(renderer) {
  if (!renderer || !renderer.camera || !renderer.roadNetData) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  const aspect = renderer.camera.aspect;
  const fov = (renderer.camera.fov * Math.PI) / 180;
  const distance = renderer.camera.position.length();
  const target = renderer.controls.target;
  const height = 2 * Math.tan(fov / 2) * distance;
  const width = height * aspect;

  return {
    x: target.x - width / 2,
    y: target.z - height / 2,
    width,
    height,
  };
}

export function centerOnWorld(renderer, worldX, worldY) {
  if (!renderer || !renderer.sceneManager) return;

  const centerX = (renderer.roadNetData?.metadata.width || 100) / 2;
  const centerY = (renderer.roadNetData?.metadata.height || 100) / 2;
  renderer.sceneManager.setControlsTarget(
    worldX - centerX,
    0,
    worldY - centerY,
  );
  window.dispatchEvent(new CustomEvent('renderer-viewport-changed'));
}

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
