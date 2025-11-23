import { Renderer3DConfig } from '../config/Renderer3DConfig.js';
import {
  updateInteractionMarkersForRenderer,
  clearPathForRenderer,
} from './Renderer3DPathLifecycleController.js';

// 节点选取与交互事件控制逻辑

export function onPointerMoveHandler(renderer, event) {
  if (!renderer || !renderer.interactionManager || !renderer.renderer) return;
  renderer.interactionManager.updatePointer(
    event,
    renderer.renderer.domElement,
  );
}

export function onClickHandler(renderer, event) {
  if (!renderer || !renderer.roadNetData) return;

  // 如果已经有终点（导航完成/进行中），忽略单击，防止意外重置
  if (
    renderer.interactionManager &&
    renderer.interactionManager.state.endNode
  ) {
    return;
  }

  if (!renderer.interactionManager || !renderer.renderer) return;

  renderer.interactionManager.updatePointer(
    event,
    renderer.renderer.domElement,
  );

  const { node, distance } = renderer.interactionManager.findNearestNode(
    renderer.roadNetData,
    Renderer3DConfig.layerHeight,
    renderer.currentLayer,
  );

  if (node) {
    console.log('✅ 选中节点:', node, '距离:', distance.toFixed(2));
    const result = renderer.interactionManager.handleNodeClick(node);

    // 更新状态
    if (renderer.interaction) {
      renderer.interaction.state.startNode =
        renderer.interactionManager.state.startNode;
      renderer.interaction.state.endNode =
        renderer.interactionManager.state.endNode;
    }

    // 更新标记
    updateInteractionMarkersForRenderer(renderer);

    // 触发路径请求
    if (result.type === 'end') {
      window.dispatchEvent(
        new CustomEvent('renderer-path-request', {
          detail: { start: result.start, end: result.node },
        }),
      );
    }
  }
}

export function onDoubleClickHandler(renderer, event) {
  if (!renderer || !renderer.roadNetData) return;

  if (!renderer.interactionManager || !renderer.interaction) return;

  // 1. 无论点击哪里，首先清除当前路径和状态
  clearPathForRenderer(renderer);
  renderer.interactionManager.clear();
  renderer.interaction.state.startNode = null;
  renderer.interaction.state.endNode = null;
  updateInteractionMarkersForRenderer(renderer);

  // 2. 检查是否双击了某个节点，如果是，将其设为新的起点
  renderer.interactionManager.updatePointer(
    event,
    renderer.renderer.domElement,
  );
  const { node } = renderer.interactionManager.findNearestNode(
    renderer.roadNetData,
    Renderer3DConfig.layerHeight,
    renderer.currentLayer,
  );

  if (node) {
    console.log('🔄 双击重置并选中起点:', node);
    renderer.interactionManager.handleNodeClick(node);
    renderer.interaction.state.startNode = node;
    updateInteractionMarkersForRenderer(renderer);
  } else {
    console.log('🔄 双击重置导航');
  }
}
