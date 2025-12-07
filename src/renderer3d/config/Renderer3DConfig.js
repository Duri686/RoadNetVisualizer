/**
 * 3D Renderer Configuration
 * Centralized management for all visual settings.
 * Tuned for a "Tech/Cyber" aesthetic.
 */

export const Renderer3DConfig = {
  // Layer configuration
  layerHeight: 100, // Height between floors

  // Floor entrance (stairs/elevators) configuration
  floorEntrance: {
    stairs: {
      color: 0xf59e0b, // Amber
      radius: 1.5,
      segments: 8,
      opacity: 0.9,
    },
    elevator: {
      color: 0x06b6d4, // Cyan
      radius: 2.0,
      segments: 12,
      opacity: 0.95,
      platformSize: 5,
    },
  },

  // Node configuration
  node: {
    size: 2,
    segments: 8,
    pulseSpeed: 2.0,
    pulseAmount: 0.15,
  },

  // Edge configuration
  edge: {
    width: 0.5,
    opacity: 0.2, // More subtle
  },

  // Color configuration
  colors: {
    background: 0x000000, // Pure black for better contrast
    floor: 0x0f172a, // Dark slate
    node: 0x3b82f6, // Blue
    nodeEmissive: 0x2563eb,
    edge: 0x1e293b, // Dark edge
    obstacle: 0x1d4ed8, // Deep Blue
    obstacleEmissive: 0x1e3a8a, // Darker glow
    obstacleTop: 0x60a5fa,
    pathActive: 0x22d3ee, // Bright Cyan
    pathBurned: 0x0f172a, // Dark
    startNode: 0x10b981, // Green
    startNodeEmissive: 0x059669,
    endNode: 0xef4444, // Red
    endNodeEmissive: 0xb91c1c,
    grid: {
      primary: 0x1e293b,
      secondary: 0x0f172a,
    },
  },

  // Material configuration
  materials: {
    node: {
      metalness: 0.8,
      roughness: 0.2,
      emissiveIntensity: 0.8,
    },
    obstacle: {
      metalness: 0.8,
      roughness: 0.1, // Shiny
      emissiveIntensity: 0.2,
      transmission: 0.0, // Opaque for performance, use fake transparency via opacity
      opacity: 0.8
    },
    marker: {
      metalness: 0.5,
      roughness: 0.5,
      emissiveIntensity: 1.0,
    },
  },

  // Lighting configuration - Cyber/Tech look
  lighting: {
    ambient: {
      color: 0x404040,
      intensity: 0.5,
    },
    hemisphere: {
      skyColor: 0x1e3a8a, // Dark Blue Sky
      groundColor: 0x000000, // Black Ground
      intensity: 0.6,
    },
    directional: {
      color: 0xa5f3fc, // Cyan-ish light
      intensity: 0.8,
      position: { x: 50, y: 100, z: 50 },
    },
    pointLights: [
      {
        color: 0x3b82f6, // Blue point light
        intensity: 0.5,
        distance: 200,
        position: { x: -50, y: 50, z: -50 },
      },
      {
        color: 0xec4899, // Pink point light for contrast
        intensity: 0.5,
        distance: 200,
        position: { x: 50, y: 50, z: 50 },
      },
    ],
  },

  // Shadow configuration
  shadow: {
    mapSize: 1024,
    camera: {
      near: 0.5,
      far: 300,
      left: -100,
      right: 100,
      top: 100,
      bottom: -100,
    },
    bias: -0.0001,
  },

  // Post-processing configuration
  postProcessing: {
    bloom: {
      strength: 1.2, // Stronger bloom for neon look
      radius: 0.5,
      threshold: 0.7, // Bloom starts earlier
    },
  },

  // Fog configuration
  fog: {
    density: 0.002, // Slightly denser
    color: 0x020617, // Match background
  },

  // Grid configuration
  grid: {
    divisions: 20,
    opacity: 0.1,
  },

  // Animation configuration
  animation: {
    walkingSpeed: 10,
    ripple: {
      count: 3,
      duration: 1500,
      delay: 500,
      maxScale: 3,
    },
  },
};
