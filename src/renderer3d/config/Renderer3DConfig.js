/**
 * 3D渲染器配置
 * 集中管理所有配置项
 */

export const Renderer3DConfig = {
  // 层配置
  layerHeight: 20,
  
  // 节点配置
  node: {
    size: 2,
    segments: 16,
    pulseSpeed: 2.0,
    pulseAmount: 0.15
  },
  
  // 边配置
  edge: {
    width: 0.5,
    opacity: 0.3
  },
  
  // 颜色配置
  colors: {
    background: 0x020617,      // 深空黑
    node: 0x3b82f6,            // 电蓝节点
    nodeEmissive: 0x2563eb,    // 深蓝发光
    edge: 0x38bdf8,            // 亮青色边
    obstacle: 0xef4444,        // 亮红障碍物
    obstacleEmissive: 0xdc2626, // 红色发光
    pathActive: 0xf59e0b,      // 琥珀色路径
    pathBurned: 0x475569,      // 烧过的路径变灰
    startNode: 0x10b981,       // 绿色起点
    startNodeEmissive: 0x059669,
    endNode: 0xef4444,         // 红色终点
    endNodeEmissive: 0xb91c1c,
    grid: {
      primary: 0x1e293b,       // 深蓝灰网格
      secondary: 0x0f172a      // 更深背景网格
    }
  },
  
  // 材质配置
  materials: {
    node: {
      metalness: 0.3,
      roughness: 0.4,
      emissiveIntensity: 0.5
    },
    obstacle: {
      metalness: 0.6,
      roughness: 0.3,
      emissiveIntensity: 0.3
    },
    marker: {
      metalness: 0.2,
      roughness: 0.3,
      emissiveIntensity: 0.8
    }
  },
  
  // 光照配置
  lighting: {
    ambient: {
      color: 0x404558,
      intensity: 0.4
    },
    hemisphere: {
      skyColor: 0x7b8fde,
      groundColor: 0x2a1a4a,
      intensity: 0.6
    },
    directional: {
      color: 0xffffff,
      intensity: 1.2,
      position: { x: 50, y: 100, z: 50 }
    },
    pointLights: [
      { color: 0x00ffff, intensity: 0.8, distance: 150, position: { x: -50, y: 30, z: -50 } },
      { color: 0xff00ff, intensity: 0.8, distance: 150, position: { x: 50, y: 30, z: 50 } }
    ]
  },
  
  // 阴影配置
  shadow: {
    mapSize: 2048,
    camera: {
      near: 0.5,
      far: 500,
      left: -100,
      right: 100,
      top: 100,
      bottom: -100
    },
    bias: -0.0001
  },
  
  // 后期处理配置
  postProcessing: {
    bloom: {
      strength: 1.5,
      radius: 0.4,
      threshold: 0.85
    }
  },
  
  // 雾配置
  fog: {
    density: 0.0015
  },
  
  // 网格配置
  grid: {
    divisions: 20,
    opacity: 0.15
  },
  
  // 动画配置
  animation: {
    pathSpeed: 400, // ms per node (deprecated, use walkingSpeed instead)
    walkingSpeed: 10, // 单位/秒 - 模拟人行走速度
    ripple: {
      count: 3,
      duration: 1500,
      delay: 500,
      maxScale: 3
    }
  }
};
