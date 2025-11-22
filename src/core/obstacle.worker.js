/**
 * Obstacle-Driven Navigation Graph Worker - 调试版
 * 添加详细日志以排查模块加载问题
 */

console.log('[Worker] 开始加载 worker 文件...');

// 尝试动态导入以捕获错误
(async () => {
  try {
    console.log('[Worker] 尝试导入 messageHandler...');
    const messageHandlerModule = await import(
      './workers/messaging/messageHandler.js'
    );
    console.log('[Worker] ✅ messageHandler 导入成功', messageHandlerModule);

    const { handleMessage, handleError } = messageHandlerModule;

    if (typeof handleMessage !== 'function') {
      throw new Error('handleMessage 不是函数');
    }

    if (typeof handleError !== 'function') {
      throw new Error('handleError 不是函数');
    }

    console.log('[Worker] ✅ 函数验证通过');

    self.onmessage = handleMessage;
    self.onerror = handleError;

    console.log('[Worker] ✅ 完全模块化 Worker 初始化成功');

    // 发送初始化成功消息
    self.postMessage({
      type: 'WORKER_READY',
      message: '完全模块化版本加载成功',
    });
  } catch (error) {
    console.error('[Worker] ❌ 模块加载失败:', error);
    console.error('[Worker] 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // 发送错误到主线程
    self.postMessage({
      type: 'ERROR',
      error: {
        message: '模块加载失败: ' + error.message,
        stack: error.stack,
        phase: 'initialization',
      },
    });

    // 降级到基础错误处理
    self.onerror = function (e) {
      console.error('[Worker] Global error:', e);
      self.postMessage({
        type: 'ERROR',
        error: {
          message: e.message || String(e),
          phase: 'runtime',
        },
      });
    };
  }
})();
