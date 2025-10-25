/**
 * 缩略图导航管理器
 * 负责渲染小型预览并同步主画布视图
 */

class NavigatorManager {
  constructor() {
    this.canvas = document.getElementById('navigator-canvas');
    this.ctx = null;
    this.scale = 0.1; // 缩略图缩放比例
    this.roadNetData = null;
    this.isInitialized = false;
    this.init();
  }

  /**
   * 初始化
   */
  init() {
    if (!this.canvas) {
      console.warn('Navigator canvas not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    
    // 设置画布尺寸
    this.canvas.width = 180;
    this.canvas.height = 120;

    this.isInitialized = true;
    this.clear();
  }

  /**
   * 清空画布
   */
  clear() {
    if (!this.ctx) return;
    
    // 深色背景
    this.ctx.fillStyle = '#0F172A';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 渲染路网数据
   * @param {Object} data - 路网数据
   */
  render(data) {
    if (!this.isInitialized || !data) return;

    this.roadNetData = data;
    this.clear();

    const { width, height } = data.metadata;
    
    // 计算缩放比例以适应画布
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;
    this.scale = Math.min(scaleX, scaleY) * 0.9; // 留10%边距

    // 计算偏移量以居中
    const offsetX = (this.canvas.width - width * this.scale) / 2;
    const offsetY = (this.canvas.height - height * this.scale) / 2;

    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);

    // 绘制障碍物
    if (data.obstacles && data.obstacles.length > 0) {
      this.drawObstacles(data.obstacles);
    }

    // 绘制第一层网络
    if (data.layers && data.layers[0]) {
      this.drawNetwork(data.layers[0]);
    }

    this.ctx.restore();

    console.log('🗺️ Navigator updated');
  }

  /**
   * 绘制障碍物
   */
  drawObstacles(obstacles) {
    this.ctx.fillStyle = '#DC2626';
    this.ctx.globalAlpha = 0.8;

    obstacles.forEach(obs => {
      const x = obs.x * this.scale;
      const y = obs.y * this.scale;
      const w = obs.width * this.scale;
      const h = obs.height * this.scale;
      this.ctx.fillRect(x, y, w, h);
    });

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 绘制网络
   */
  drawNetwork(layer) {
    if (!layer.edges || !layer.nodes) return;

    // 绘制边
    this.ctx.strokeStyle = '#3B82F6';
    this.ctx.lineWidth = 0.5;
    this.ctx.globalAlpha = 0.4;

    layer.edges.forEach(edge => {
      const from = layer.nodes[edge.from];
      const to = layer.nodes[edge.to];
      if (from && to) {
        this.ctx.beginPath();
        this.ctx.moveTo(from.x * this.scale, from.y * this.scale);
        this.ctx.lineTo(to.x * this.scale, to.y * this.scale);
        this.ctx.stroke();
      }
    });

    // 绘制节点
    this.ctx.fillStyle = '#3B82F6';
    this.ctx.globalAlpha = 0.8;

    layer.nodes.forEach(node => {
      const x = node.x * this.scale;
      const y = node.y * this.scale;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 绘制视口框（表示当前主画布可见区域）
   * @param {Object} viewport - 视口信息 {x, y, width, height}
   */
  drawViewport(viewport) {
    if (!this.roadNetData || !viewport) return;

    const { width, height } = this.roadNetData.metadata;
    const offsetX = (this.canvas.width - width * this.scale) / 2;
    const offsetY = (this.canvas.height - height * this.scale) / 2;

    // 绘制视口边框
    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);
    
    this.ctx.strokeStyle = '#0066FF';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    
    const vx = viewport.x * this.scale;
    const vy = viewport.y * this.scale;
    const vw = viewport.width * this.scale;
    const vh = viewport.height * this.scale;
    
    this.ctx.strokeRect(vx, vy, vw, vh);
    
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  /**
   * 更新（重新渲染）
   */
  update(data) {
    if (data) {
      this.render(data);
    } else if (this.roadNetData) {
      this.render(this.roadNetData);
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.roadNetData = null;
    this.clear();
  }
}

// 导出单例
export default new NavigatorManager();
