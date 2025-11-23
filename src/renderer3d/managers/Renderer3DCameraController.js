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
