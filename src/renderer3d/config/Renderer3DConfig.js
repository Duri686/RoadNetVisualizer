/**
 * 3D渲染器配置
 * 集中管理所有配置项
 */

export const Renderer3DConfig = {
  // 层配置 - Multi-floor building
  layerHeight: 100, // Height between floors (was 20, now 100 for clear separation)

  // 楼层连接点配置 - 科技风格
  floorEntrance: {
    stairs: {
      color: 0x22d3ee, // Cyan 400 楼梯
      radius: 1.8,
      segments: 6, // 六边形
      opacity: 0.85,
    },
    elevator: {
      color: 0xa78bfa, // Violet 400 电梯
      radius: 2.2,
      segments: 8,
      opacity: 0.9,
      platformSize: 6,
    },
  },

  // 节点配置
  node: {
    size: 2,
    segments: 8, // 降低球体段数提高性能
    pulseSpeed: 2.0,
    pulseAmount: 0.15,
  },

  // 边配置 - 网络连接
  edge: {
    width: 0.5,
    opacity: 0.5, // 增强可见度
  },

  // 颜色配置 - 室内导航网格风格
  colors: {
    background: 0x0f172a, // 深蓝灰背景（Slate 900）
    floor: 0x1e293b, // Slate 800 地板
    node: 0x06b6d4, // Cyan 500 网络节点
    nodeEmissive: 0x22d3ee, // Cyan 400 发光
    edge: 0x0ea5e9, // Cyan 500 主网络边
    voronoiEdge: 0x8b5cf6, // Violet 500 Voronoi骨架
    triangulation: 0x64748b, // Slate 500 基础三角化
    obstacle: 0x6366f1, // Indigo 500 障碍物
    obstacleEmissive: 0x4f46e5, // Indigo 600 发光
    pathActive: 0x22d3ee, // Cyan 400 能量色
    pathBurned: 0x0ea5e9, // Cyan 500 保持可见
    startNode: 0x10b981, // 绿色起点
    startNodeEmissive: 0x059669,
    endNode: 0xef4444, // 红色终点
    endNodeEmissive: 0xb91c1c,
    grid: {
      primary: 0x404040, // 室内网格色
      secondary: 0x2a2a2a, // 次要网格色
    },
  },

  // 材质配置
  materials: {
    node: {
      metalness: 0.6, // 增加金属感
      roughness: 0.3,
      emissiveIntensity: 0.7, // 增强发光
    },
    obstacle: {
      metalness: 0.6,
      roughness: 0.3,
      emissiveIntensity: 0.3,
    },
    marker: {
      metalness: 0.2,
      roughness: 0.3,
      emissiveIntensity: 0.8,
    },
  },

  // 光照配置 - 现代科技风格
  lighting: {
    ambient: {
      color: 0x1e293b, // 与背景协调的环境光
      intensity: 0.7, // 增加环境光强度
    },
    hemisphere: {
      skyColor: 0x3b82f6, // 品牌蓝天光
      groundColor: 0x1e1e2e, // 深蓝地光
      intensity: 0.9, // 增强半球光
    },
    directional: {
      color: 0xffffff, // 主光源（模拟天花板射灯）
      intensity: 1.0,
      position: { x: 30, y: 80, z: 30 },
    },
    pointLights: [
      // 模拟商场内的多个光源
      {
        color: 0xffffff,
        intensity: 0.6,
        distance: 120,
        position: { x: -40, y: 25, z: -40 },
      },
      {
        color: 0xffffff,
        intensity: 0.6,
        distance: 120,
        position: { x: 40, y: 25, z: 40 },
      },
      {
        color: 0xfff8dc,
        intensity: 0.4,
        distance: 100,
        position: { x: 0, y: 30, z: 0 },
      },
    ],
  },

  // 阴影配置 - 性能优化
  shadow: {
    mapSize: 1024, // 降低阴影贴图尺寸提高性能
    camera: {
      near: 0.5,
      far: 300, // 减小阴影距离
      left: -80,
      right: 80,
      top: 80,
      bottom: -80,
    },
    bias: -0.0001,
  },

  // 后期处理配置
  postProcessing: {
    bloom: {
      strength: 1.5,
      radius: 0.4,
      threshold: 0.85,
    },
  },

  // 雾配置 - 增加雾浓度，柔化远景
  fog: {
    density: 0.002,
  },

  // 网格配置
  grid: {
    divisions: 20,
    opacity: 0.15,
  },

  // 动画配置
  animation: {
    pathSpeed: 400, // ms per node (deprecated, use walkingSpeed instead)
    walkingSpeed: 10, // 单位/秒 - 模拟人行走速度
    ripple: {
      count: 3,
      duration: 1500,
      delay: 500,
      maxScale: 3,
    },
  },
};
