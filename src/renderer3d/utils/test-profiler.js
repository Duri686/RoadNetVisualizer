/**
 * PerformanceProfiler 测试
 * 在浏览器控制台运行此测试
 */

import { PerformanceProfiler } from './PerformanceProfiler.js';

export function testProfiler() {
  console.log('🧪 开始测试 PerformanceProfiler...\n');

  const profiler = new PerformanceProfiler();

  // 模拟渲染器
  const mockRenderer = {
    info: {
      render: {
        calls: 50,
        triangles: 100000,
      },
      memory: {
        geometries: 100,
        textures: 10,
      },
      programs: [1, 2, 3, 4, 5],
    },
  };

  // 模拟60帧
  console.log('模拟60帧渲染...');
  for (let i = 0; i < 60; i++) {
    profiler.startFrame();

    profiler.mark('test-stage-1');
    // 模拟一些工作
    const start = performance.now();
    while (performance.now() - start < 5) {} // 5ms
    profiler.markEnd('test-stage-1');

    profiler.mark('test-stage-2');
    const start2 = performance.now();
    while (performance.now() - start2 < 10) {} // 10ms
    profiler.markEnd('test-stage-2');

    profiler.endFrame(mockRenderer);
  }

  console.log('\n✅ 测试完成！');
  console.log('样本数:', profiler.samples.length);
  console.log('统计:', profiler.getCurrentStats());

  // 手动触发报告
  console.log('\n手动触发报告:');
  profiler.logReport();
}

// 如果在浏览器中直接运行
if (typeof window !== 'undefined') {
  window.testProfiler = testProfiler;
  console.log('💡 在控制台运行: testProfiler()');
}
