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

  let currentIndex = 0;
  const speed = 0.05; // 动画速度
  let progress = 0;

  const animate = () => {
    if (!ctx.state.isAnimating) return; // 已被取消
    if (currentIndex >= path.length - 1) {
      if (ctx.animBall && ctx.container) {
        ctx.container.removeChild(ctx.animBall);
      }
      ctx.animBall = null;
      ctx.state.isAnimating = false;
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
}
