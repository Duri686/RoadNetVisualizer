/**
 * 3D渲染器配置
 * 集中管理所有配置项
 */

export const Renderer3DConfig = {
  // 层配置 - Multi-floor building
  layerHeight: 100, // Height between floors (was 20, now 100 for clear separation)

  // Floor entrance (stairs/elevators) configuration
  floorEntrance: {
    stairs: {
      color: 0xffff00, // Yellow
      radius: 1.5, // Increased from 0.6
      segments: 8,
      opacity: 0.9, // Increased from 0.7
    },
    elevator: {
      color: 0x00ffff, // Cyan
      radius: 2.0, // Increased from 1.0
      segments: 12,
      opacity: 0.95, // Increased from 0.8
      platformSize: 5, // Increased from 3
    },
  },

  // 节点配置
  node: {
    size: 2,
    segments: 8, // 降低球体段数提高性能
    pulseSpeed: 2.0,
    pulseAmount: 0.15,
  },

  // 边配置
  edge: {
    width: 0.5,
    opacity: 0.3,
  },

  // 颜色配置
  colors: {
    background: 0x020617, // 深空黑背景
    floor: 0x2a2a2a, // 黑灰色地板
    node: 0x3b82f6, // 电蓝节点
    nodeEmissive: 0x2563eb, // 深蓝发光
    edge: 0x38bdf8, // 亮青色边
    obstacle: 0xef4444, // 亮红障碍物 - 保持原色
    obstacleEmissive: 0xdc2626, // 红色发光
    pathActive: 0xf59e0b, // 琥珀色路径
    pathBurned: 0x475569, // 烧过的路径变灰
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
      metalness: 0.3,
      roughness: 0.4,
      emissiveIntensity: 0.5,
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

  // 光照配置 - 室内商场效果
  lighting: {
    ambient: {
      color: 0x505050, // 室内环境光
      intensity: 0.6, // 增加环境光强度
    },
    hemisphere: {
      skyColor: 0x87ceeb, // 天空蓝（模拟天花板灯光）
      groundColor: 0x2a2a2a, // 地面灰色
      intensity: 0.8,
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

  // 雾配置
  fog: {
    density: 0.0015,
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
