// Renderer 配置构造（保持与原逻辑一致）
export function createRendererConfig() {
  return {
    nodeRadius: 3,
    nodeColor: 0xffffff,
    nodeAlpha: 0.9,
    edgeWidth: 1.5,
    edgeColor: 0x64748b,
    edgeAlpha: 0.6,
    layerColors: [0x3b82f6],
    interaction: {
      startNodeColor: 0x00ff00,
      endNodeColor: 0xff0000,
      hoveredNodeColor: 0xffff00,
      pathColor: 0xf59e0b,
      pathWidth: 3,
      nodeHighlightRadius: 6,
      crosshairSize: 15,
      crosshairColor: 0xffffff,
      crosshairAlpha: 0.8,
      smoothing: {
        enabled: true,
        useInPreview: false,
        useSpatialIndex: true,
        maxLookahead: 24,
        clearance: 0.8,
        timeBudgetMs: 8,
      },
      orthogonal: {
        enabled: true,
        onlyNearObstacles: true,
        useSpatialIndex: true,
        timeBudgetMs: 6,
      },
      tracking: {
        enabled: false,
        sampleStep: 1.0,
      },
    },
    cellSize: 10,
    padding: 40,
  };
}
