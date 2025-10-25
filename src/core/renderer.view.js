// 视图与交互（缩放/平移/手势），保持与原逻辑一致

export function getViewportRectImpl(renderer) {
  if (!renderer.app) return null;
  const scale = renderer.transform.scale || 1;
  const x = -renderer.mainContainer.x / scale;
  const y = -renderer.mainContainer.y / scale;
  const width = renderer.app.screen.width / scale;
  const height = renderer.app.screen.height / scale;
  return { x, y, width, height, scale };
}

export function zoomImpl(renderer, scaleFactor = 1.0) {
  if (!renderer.app || !renderer.mainContainer || !renderer.drawing) return;
  const newScale = renderer.transform.scale * scaleFactor;
  if (newScale < renderer.viewState.minScale || newScale > renderer.viewState.maxScale) return;
  const mouseX = renderer.app.screen.width / 2;
  const mouseY = renderer.app.screen.height / 2;
  const worldPos = {
    x: (mouseX - renderer.mainContainer.x) / renderer.transform.scale,
    y: (mouseY - renderer.mainContainer.y) / renderer.transform.scale,
  };
  renderer.transform.scale = newScale;
  renderer.mainContainer.scale.set(newScale);
  renderer.mainContainer.x = mouseX - worldPos.x * newScale;
  renderer.mainContainer.y = mouseY - worldPos.y * newScale;
  renderer.drawing.updateTransform(renderer.transform);
  renderer.interaction.updateTransform(renderer.transform);
}

export function zoomInImpl(renderer) { zoomImpl(renderer, 1.2); }
export function zoomOutImpl(renderer) { zoomImpl(renderer, 0.8); }

export function resetViewImpl(renderer) {
  if (!renderer.app || !renderer.mainContainer) return;
  renderer.transform.scale = 1;
  renderer.transform.panX = 0;
  renderer.transform.panY = 0;
  renderer.mainContainer.scale.set(1, 1);
  renderer.mainContainer.position.set(0, 0);
  renderer.drawing.updateTransform(renderer.transform);
  renderer.interaction.updateTransform(renderer.transform);
  renderer.rebuildAllOverlays();
  try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
}

export function centerOnImpl(renderer, worldX, worldY) {
  if (!renderer.app || !renderer.mainContainer) return;
  const scale = renderer.transform.scale || 1;
  const canvasCenterX = renderer.app.screen.width / 2;
  const canvasCenterY = renderer.app.screen.height / 2;
  renderer.mainContainer.x = canvasCenterX - worldX * scale;
  renderer.mainContainer.y = canvasCenterY - worldY * scale;
  renderer.transform.panX = -renderer.mainContainer.x / scale;
  renderer.transform.panY = -renderer.mainContainer.y / scale;
  renderer.drawing.updateTransform(renderer.transform);
  renderer.interaction.updateTransform(renderer.transform);
  try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
}

export function setupZoomAndPanImpl(renderer) {
  if (!renderer.app) return;
  const view = renderer.app.view;
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = renderer.transform.scale * scaleFactor;
    if (newScale >= renderer.viewState.minScale && newScale <= renderer.viewState.maxScale) {
      const mouseX = e.clientX - view.getBoundingClientRect().left;
      const mouseY = e.clientY - view.getBoundingClientRect().top;
      const worldPos = {
        x: (mouseX - renderer.mainContainer.x) / renderer.transform.scale,
        y: (mouseY - renderer.mainContainer.y) / renderer.transform.scale,
      };
      renderer.transform.scale = newScale;
      renderer.mainContainer.scale.set(newScale);
      renderer.mainContainer.x = mouseX - worldPos.x * newScale;
      renderer.mainContainer.y = mouseY - worldPos.y * newScale;
      renderer.drawing.updateTransform(renderer.transform);
      renderer.interaction.updateTransform(renderer.transform);
      renderer.rebuildAllOverlays();
    }
  });
  view.addEventListener('mousedown', (e) => {
    renderer.viewState.isDragging = true;
    renderer.viewState.lastPosition = { x: e.clientX, y: e.clientY };
    view.style.cursor = 'grabbing';
  });
  view.addEventListener('mousemove', (e) => {
    if (renderer.viewState.isDragging && renderer.viewState.lastPosition) {
      const deltaX = e.clientX - renderer.viewState.lastPosition.x;
      const deltaY = e.clientY - renderer.viewState.lastPosition.y;
      renderer.transform.panX += deltaX / renderer.transform.scale;
      renderer.transform.panY += deltaY / renderer.transform.scale;
      renderer.mainContainer.position.x += deltaX;
      renderer.mainContainer.position.y += deltaY;
      renderer.viewState.lastPosition = { x: e.clientX, y: e.clientY };
      try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
    }
  });
  const endDrag = () => {
    renderer.viewState.isDragging = false;
    renderer.viewState.lastPosition = null;
    view.style.cursor = 'grab';
  };
  view.addEventListener('mouseup', endDrag);
  view.addEventListener('mouseleave', endDrag);
  view.style.cursor = 'grab';

  // =====================
  // 移动端/触控：Pointer Events（单指拖拽、双指捏合缩放）
  // =====================
  const getDistanceAndCenter = (p1, p2) => {
    const dx = p2.clientX - p1.clientX;
    const dy = p2.clientY - p1.clientY;
    const distance = Math.hypot(dx, dy);
    const center = {
      clientX: (p1.clientX + p2.clientX) / 2,
      clientY: (p1.clientY + p2.clientY) / 2,
    };
    return { distance, center };
  };

  const onPtrDown = (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    renderer.pointerState.pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    try { view.setPointerCapture(e.pointerId); } catch (_) {}
    // 不立即进入拖拽，等待移动超过阈值
    renderer.viewState.isDragging = false;
    renderer.viewState.lastPosition = { x: e.clientX, y: e.clientY };
  };

  const onPtrMove = (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (renderer.pointerState.pointers.size === 0) return;
    if (renderer.pointerState.pointers.has(e.pointerId)) {
      renderer.pointerState.pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    const rect = view.getBoundingClientRect();

    // 双指捏合缩放
    if (renderer.pointerState.pointers.size >= 2) {
      e.preventDefault();
      const it = renderer.pointerState.pointers.values();
      const p1 = it.next().value; const p2 = it.next().value;
      if (!p1 || !p2) return;
      const { distance, center } = getDistanceAndCenter(p1, p2);

      if (renderer.pointerState.lastDistance && renderer.pointerState.lastCenter) {
        const scaleFactor = distance / renderer.pointerState.lastDistance;
        const newScale = renderer.transform.scale * scaleFactor;
        if (newScale >= renderer.viewState.minScale && newScale <= renderer.viewState.maxScale) {
          const centerX = center.clientX - rect.left;
          const centerY = center.clientY - rect.top;
          const worldPos = {
            x: (centerX - renderer.mainContainer.x) / renderer.transform.scale,
            y: (centerY - renderer.mainContainer.y) / renderer.transform.scale,
          };
          renderer.transform.scale = newScale;
          renderer.mainContainer.scale.set(newScale);
          const newX = centerX - worldPos.x * newScale;
          const newY = centerY - worldPos.y * newScale;
          renderer.mainContainer.x = newX;
          renderer.mainContainer.y = newY;
          renderer.drawing.updateTransform(renderer.transform);
          renderer.interaction.updateTransform(renderer.transform);
          renderer.rebuildAllOverlays();
          try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
        }
      }
      renderer.pointerState.lastDistance = distance;
      renderer.pointerState.lastCenter = center;
      return;
    }

    // 单指拖拽平移
    if (renderer.pointerState.pointers.size === 1) {
      const p = renderer.pointerState.pointers.values().next().value;
      if (!p) return;
      const dx = p.clientX - (renderer.viewState.lastPosition?.x ?? p.clientX);
      const dy = p.clientY - (renderer.viewState.lastPosition?.y ?? p.clientY);

      if (!renderer.viewState.isDragging) {
        if (Math.abs(dx) + Math.abs(dy) < renderer.pointerState.dragThreshold) return;
        renderer.viewState.isDragging = true;
        view.style.cursor = 'grabbing';
      }
      e.preventDefault();
      renderer.transform.panX += dx / renderer.transform.scale;
      renderer.transform.panY += dy / renderer.transform.scale;
      renderer.mainContainer.position.x += dx;
      renderer.mainContainer.position.y += dy;
      renderer.viewState.lastPosition = { x: p.clientX, y: p.clientY };
      try { window.dispatchEvent(new CustomEvent('renderer-viewport-changed')); } catch (_) {}
    }
  };

  const onPtrUpOrCancel = (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (renderer.pointerState.pointers.has(e.pointerId)) {
      renderer.pointerState.pointers.delete(e.pointerId);
    }
    try { view.releasePointerCapture(e.pointerId); } catch (_) {}
    if (renderer.pointerState.pointers.size < 2) {
      renderer.pointerState.lastDistance = null;
      renderer.pointerState.lastCenter = null;
    }
    if (renderer.pointerState.pointers.size === 0) {
      renderer.viewState.isDragging = false;
      renderer.viewState.lastPosition = null;
      view.style.cursor = 'grab';
    }
  };

  view.addEventListener('pointerdown', onPtrDown, { passive: false });
  view.addEventListener('pointermove', onPtrMove, { passive: false });
  view.addEventListener('pointerup', onPtrUpOrCancel, { passive: false });
  view.addEventListener('pointercancel', onPtrUpOrCancel, { passive: false });
}
