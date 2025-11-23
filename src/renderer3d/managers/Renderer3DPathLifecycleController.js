import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

// 路径及交互图形生命周期控制逻辑

export function updateInteractionMarkersForRenderer(renderer) {
  if (!renderer || !renderer.roadNetData || !renderer.markerRenderer) return;

  const centerX = (renderer.roadNetData.metadata.width || 100) / 2;
  const centerY = (renderer.roadNetData.metadata.height || 100) / 2;

  renderer.markerRenderer.update(
    renderer.interactionManager?.state.startNode,
    renderer.interactionManager?.state.endNode,
    Renderer3DConfig.layerHeight,
    centerX,
    centerY,
  );
}

export function clearPathForRenderer(renderer) {
  if (!renderer) return;
  if (renderer.pathRenderer) {
    renderer.pathRenderer.clear();
  }
  if (renderer.pathAnimationManager) {
    renderer.pathAnimationManager.stop();
  }
}

export function drawPathForRenderer(renderer, path) {
  if (!renderer) return;

  clearPathForRenderer(renderer);
  if (!path || path.length === 0) return;

  if (renderer.interaction) {
    renderer.interaction.state.lastPath = path;
  }

  const centerX = (renderer.roadNetData?.metadata.width || 100) / 2;
  const centerY = (renderer.roadNetData?.metadata.height || 100) / 2;

  if (renderer.pathRenderer) {
    renderer.pathRenderer.drawPath(
      path,
      Renderer3DConfig.layerHeight,
      centerX,
      centerY,
    );
  }

  animatePathForRenderer(renderer, path);
}

export function animatePathForRenderer(renderer, path) {
  if (!renderer || !renderer.pathAnimationManager || !renderer.pathRenderer)
    return;
  if (!renderer.roadNetData || !renderer.roadNetData.metadata) return;

  const centerX = (renderer.roadNetData.metadata.width || 100) / 2;
  const centerY = (renderer.roadNetData.metadata.height || 100) / 2;

  renderer.pathAnimationManager.start(
    path,
    Renderer3DConfig.layerHeight,
    centerX,
    centerY,
    renderer.pathRenderer.pathShader,
  );
}

export function redrawLastPathForRenderer(renderer) {
  if (!renderer || !renderer.interaction) return;
  if (renderer.interaction.state.lastPath) {
    drawPathForRenderer(renderer, renderer.interaction.state.lastPath);
  }
}

export function clearInteractionGraphicsForRenderer(renderer) {
  if (!renderer || !renderer.interactionManager || !renderer.interaction)
    return;

  clearPathForRenderer(renderer);
  renderer.interactionManager.clear();
  renderer.interaction.state.startNode = null;
  renderer.interaction.state.endNode = null;
  updateInteractionMarkersForRenderer(renderer);
}

export function resetPathInfoForRenderer(renderer) {
  if (!renderer || !renderer.interactionManager || !renderer.interaction)
    return;
  renderer.interactionManager.clearPath();
  renderer.interaction.state.lastPath = null;
}
