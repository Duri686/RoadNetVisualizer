/**
 * 性能预设配置
 * 提供不同的性能/质量平衡选项
 */

export const PerformancePresets = {
  /**
   * 高性能模式 - 最快速度，适合低端设备
   */
  HIGH_PERFORMANCE: {
    name: '高性能',
    shadows: {
      enabled: false,
    },
    postProcessing: {
      bloom: {
        enabled: false,
      },
    },
    pixelRatio: 1,
    antialiasing: false,
  },

  /**
   * 平衡模式 - 性能和质量的平衡
   */
  BALANCED: {
    name: '平衡',
    shadows: {
      enabled: true,
      type: 'basic', // BasicShadowMap
      autoUpdate: false,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        strength: 0.3, // 降低强度
        radius: 0.2,
        threshold: 0.8,
      },
    },
    pixelRatio: 1.5,
    antialiasing: true,
  },

  /**
   * 高质量模式 - 最佳视觉效果
   */
  HIGH_QUALITY: {
    name: '高质量',
    shadows: {
      enabled: true,
      type: 'pcf', // PCFSoftShadowMap
      autoUpdate: true,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        strength: 0.5,
        radius: 0.4,
        threshold: 0.85,
      },
    },
    pixelRatio: 2,
    antialiasing: true,
  },
};

/**
 * 应用性能预设
 */
export function applyPerformancePreset(renderer, preset) {
  console.log(`[Performance] 应用预设: ${preset.name}`);

  // 应用阴影设置
  if (renderer.renderer) {
    renderer.renderer.shadowMap.enabled = preset.shadows.enabled;
    if (preset.shadows.enabled && preset.shadows.type) {
      const THREE = window.THREE || require('three');
      renderer.renderer.shadowMap.type =
        preset.shadows.type === 'pcf'
          ? THREE.PCFSoftShadowMap
          : THREE.BasicShadowMap;
      renderer.renderer.shadowMap.autoUpdate =
        preset.shadows.autoUpdate !== false;
    }
  }

  // 应用后期处理设置
  if (renderer.postProcessing && renderer.postProcessing.bloomPass) {
    if (preset.postProcessing.bloom.enabled) {
      renderer.postProcessing.bloomPass.enabled = true;
      if (preset.postProcessing.bloom.strength !== undefined) {
        renderer.postProcessing.updateBloom(
          preset.postProcessing.bloom.strength,
          preset.postProcessing.bloom.radius,
          preset.postProcessing.bloom.threshold,
        );
      }
    } else {
      renderer.postProcessing.bloomPass.enabled = false;
    }
  }

  // 应用像素比
  if (renderer.renderer && preset.pixelRatio) {
    renderer.renderer.setPixelRatio(
      Math.min(preset.pixelRatio, window.devicePixelRatio),
    );
  }

  console.log('[Performance] 预设应用完成');
}
