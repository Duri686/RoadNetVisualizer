// 交互容器与事件初始化委派（保持与原逻辑一致）
import * as PIXI from 'pixi.js';

export function setupInteractionImpl(renderer) {
  if (!renderer.app || !renderer.roadNetData) {
    console.warn('⚠️ Cannot setup interaction: app or roadNetData missing');
    return;
  }

  renderer.app.stage.sortableChildren = true;
  renderer.mainContainer.sortableChildren = true;

  if (!renderer.interactionContainer) {
    renderer.interactionContainer = new PIXI.Container();
    renderer.interactionContainer.name = 'interaction';
    renderer.interactionContainer.sortableChildren = true;
  }
  if (renderer.interactionContainer.parent !== renderer.mainContainer) {
    renderer.mainContainer.addChild(renderer.interactionContainer);
  }
  renderer.interactionContainer.visible = true;
  renderer.interactionContainer.zIndex = 1000;
  // 重置交互容器的原点与缩放，保证与 mainContainer 保持一致的坐标系
  renderer.interactionContainer.position.set(0, 0);
  renderer.interactionContainer.scale.set(1, 1);

  if (!renderer.pathContainer) {
    renderer.pathContainer = new PIXI.Container();
    renderer.pathContainer.name = 'path';
  }
  renderer.pathContainer.zIndex = 1001;
  if (renderer.pathContainer.parent !== renderer.interactionContainer) {
    renderer.interactionContainer.addChild(renderer.pathContainer);
  }
  renderer.pathContainer.visible = true;
  renderer.pathContainer.alpha = 1;
  // 保持路径容器与交互容器对齐
  renderer.pathContainer.position.set(0, 0);
  renderer.pathContainer.scale.set(1, 1);

  if (!renderer.crosshairGraphics) {
    renderer.crosshairGraphics = new PIXI.Graphics();
    renderer.crosshairGraphics.visible = false;
  }
  renderer.crosshairGraphics.zIndex = 1002;
  if (renderer.crosshairGraphics.parent !== renderer.interactionContainer) {
    renderer.interactionContainer.addChild(renderer.crosshairGraphics);
  }

  renderer.interaction.setContainers(
    renderer.interactionContainer,
    renderer.crosshairGraphics,
    renderer.pathContainer,
  );

  // 委派到 RendererInteraction.setup，确保：
  // - 重建 Delaunay
  // - 设置 stage.eventMode 与 hitArea
  // - 清理旧监听并绑定 pointer 事件
  renderer.interaction.setup(
    renderer.app,
    renderer.onPointerMove.bind(renderer),
    renderer.onPointerDown.bind(renderer),
  );

  if (renderer.mainContainer.children[renderer.mainContainer.children.length - 1] !== renderer.interactionContainer) {
    renderer.mainContainer.addChild(renderer.interactionContainer);
  }
}
