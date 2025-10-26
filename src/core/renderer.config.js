/**
 * 渲染器配置类型定义
 *
 * @typedef {Object} SmoothingConfig
 * @property {boolean} enabled 是否开启路径平滑
 * @property {boolean} useInPreview 预览态是否应用平滑（提高观感，可能略耗时）
 * @property {boolean} useSpatialIndex 是否使用空间索引加速平滑计算
 * @property {number} maxLookahead 最大前视步数（控制平滑搜索范围）
 * @property {number} clearance 与障碍物的安全间隙（与坐标单位一致）
 * @property {number} timeBudgetMs 单帧时间预算（毫秒），限制算法耗时，避免卡顿
 *
 * @typedef {Object} OrthogonalConfig
 * @property {boolean} enabled 是否开启路径正交化
 * @property {boolean} onlyNearObstacles 仅在靠近障碍物处进行正交化
 * @property {boolean} useSpatialIndex 是否使用空间索引加速正交化检查
 * @property {number} timeBudgetMs 单帧时间预算（毫秒）
 *
 * @typedef {Object} TrackingConfig
 * @property {boolean} enabled 是否开启路径跟踪/采样
 * @property {number} sampleStep 采样步长（像素/单位），步长越小越细腻但更耗时
 *
 * @typedef {Object} InteractionConfig
 * @property {number} startNodeColor 起点节点颜色（十六进制整数，例如 0x00ff00）
 * @property {number} endNodeColor 终点节点颜色（十六进制整数）
 * @property {number} hoveredNodeColor 悬浮节点颜色（十六进制整数）
 * @property {number} pathColor 路径颜色（十六进制整数）
 * @property {number} pathWidth 路径线宽（像素）
 * @property {number} nodeHighlightRadius 节点高亮半径（像素）
 * @property {number} crosshairSize 十字准星尺寸（像素）
 * @property {number} crosshairColor 十字准星颜色（十六进制整数）
 * @property {number} crosshairAlpha 十字准星不透明度（0~1）
 * @property {SmoothingConfig} smoothing 路径平滑配置
 * @property {OrthogonalConfig} orthogonal 路径正交化配置
 * @property {TrackingConfig} tracking 路径跟踪/采样配置
 *
 * @typedef {Object} RendererConfig
 * @property {number} nodeRadius 节点半径（像素）
 * @property {number} nodeColor 节点颜色（十六进制整数）
 * @property {number} nodeAlpha 节点不透明度（0~1）
 * @property {number} edgeWidth 边线宽度（像素）
 * @property {number} edgeColor 边线颜色（十六进制整数）
 * @property {number} edgeAlpha 边线不透明度（0~1）
 * @property {number[]} layerColors 图层颜色集合（十六进制整数数组）
 * @property {InteractionConfig} interaction 交互与可视化高亮信息配置
 * @property {number} cellSize 空间索引网格大小（像素/单位），值越小碰撞候选越精细
 * @property {number} padding 画布四周留白（像素）
 */

/**
 * 创建渲染器配置。
 * 保持与原有默认值一致，用于控制节点/边样式、交互高亮、路径平滑/正交化以及空间索引等。
 * @returns {RendererConfig} 渲染器配置对象
 */
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
    // 性能相关开关（基础版）
    caching: {
      // 静态层 RenderTexture 缓存（修复后默认关闭，需人工开启）
      staticLayers: false,
      // 网络层（节点+边）静态缓存，合批后转 RenderTexture（默认关闭）
      networkLayers: true,
      // 视图稳定期（毫秒）后再生成缓存，避免频繁抖动
      networkStableDelayMs: 160,
      // 缩放阈值（相对比例变化），超过则认为失效需要重建
      networkScaleThreshold: 0.06,
    },
    culling: {
      // 视窗裁剪（仅绘制可见区域附近图元）
      enabled: true,
      // 预留边距（像素），避免临界闪烁
      margin: 128,
    },
    labels: {
      // 是否显示障碍索引编号
      enabled: true,
      // 使用 BitmapText 绘制编号（更高效），可按需关闭回退到 Text
      useBitmapText: true,
      // 小于该像素尺寸（cellSize*scale）时不绘制编号
      minPixelForLabel: 0,
    },
    // 性能兼容开关
    performance: {
      // 打包边渲染（'auto' 表示若存在 edgesPacked 则优先使用；true 强制；false 关闭）
      usePackedEdges: 'auto',
      // 打包节点渲染（'auto' 表示若存在 nodesPacked 则优先使用；true 强制；false 关闭）
      usePackedNodes: 'auto',
      // 打包障碍物渲染（'auto' 表示若存在 obstaclesPacked 则优先使用；true 强制；false 关闭）
      usePackedObstacles: 'auto',
    },
  };
}
