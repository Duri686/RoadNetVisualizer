// 动画控制模块（保持与原逻辑等价）
// 提供路径动画与取消控制，对外接受 RendererInteraction 实例作为上下文。

/**
 * 启动路径动画（沿路径移动小球）
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx 交互上下文
 * @param {Array<{x:number,y:number}>} path 路径节点
 */
export function animatePath(ctx, path) {
  if (ctx.state.isAnimating) return;

  ctx.state.isAnimating = true;

  // 创建移动的小球
  const ball = ctx.drawing.createAnimationBall();
  ctx.animBall = ball;
  ctx.container.addChild(ball);

  // 从快照恢复段索引与进度（若存在）
  const snap = ctx.state && ctx.state.anim ? ctx.state.anim : null;
  let currentIndex = Math.max(0, Math.min((snap?.index ?? 0), Math.max(0, path.length - 2)));
  const speed = typeof snap?.speed === 'number' ? snap.speed : 0.05; // 动画速度
  let progress = Math.max(0, Math.min(1, snap?.progress ?? 0));

  // 立即按当前进度设置一次位置，避免第一帧跳动
  if (path.length >= 2) {
    const n1 = path[currentIndex];
    const n2 = path[currentIndex + 1];
    const pos0 = ctx.drawing.getAnimationPosition(n1, n2, progress);
    ball.x = pos0.x;
    ball.y = pos0.y;
  }

  const animate = () => {
    if (!ctx.state.isAnimating) return; // 已被取消
    if (currentIndex >= path.length - 1) {
      if (ctx.animBall && ctx.container) {
        ctx.container.removeChild(ctx.animBall);
      }
      ctx.animBall = null;
      ctx.state.isAnimating = false;
      ctx.state.anim = null; // 结束时清理快照
      ctx.animRAF = null;
      return;
    }

    const node1 = path[currentIndex];
    const node2 = path[currentIndex + 1];

    const pos = ctx.drawing.getAnimationPosition(node1, node2, progress);
    ball.x = pos.x;
    ball.y = pos.y;

    progress += speed;

    if (progress >= 1) {
      progress = 0;
      currentIndex++;
    }

    // 更新快照：段索引/进度/速度
    ctx.state.anim = { index: currentIndex, progress, speed };

    ctx.animRAF = requestAnimationFrame(animate);
  };

  ctx.animRAF = requestAnimationFrame(animate);
}

/**
 * 取消当前路径动画（若有）
 * @param {import('../RendererInteraction.js').RendererInteraction} ctx 交互上下文
 */
export function cancelAnimationIfAny(ctx) {
  if (ctx.animRAF) {
    cancelAnimationFrame(ctx.animRAF);
    ctx.animRAF = null;
  }
  if (ctx.animBall && ctx.container) {
    ctx.container.removeChild(ctx.animBall);
    ctx.animBall = null;
  }
  ctx.state.isAnimating = false;
  // 若未设置保留标记，则清除快照；否则仅重置标记
  const keep = !!(ctx.state && ctx.state.keepAnimSnapshot);
  if (!keep) {
    ctx.state.anim = null;
  }
  if (ctx.state) ctx.state.keepAnimSnapshot = false;
}
