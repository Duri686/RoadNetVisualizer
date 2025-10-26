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
    this.offsetX = 0;
    this.offsetY = 0;
    // 热力图配置
    this.heatmap = {
      enabled: true,
      cols: 36,
      rows: 24,
      minAlpha: 0.15,
      maxAlpha: 0.9,
      thresholdPerCell: 2, // 平均每格 >2 则启用热力
      overrideMode: 'auto' // auto | heatmap | detail
    };
    this._dragging = false;
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

    // 监听图层显隐变化，自动刷新
    window.addEventListener('layer-visibility-changed', () => this.update());
    // 监听渲染器视口变化，仅重绘视口框
    window.addEventListener('renderer-viewport-changed', () => this.update());

    // 绑定模式切换
    const modeSelect = document.getElementById('nav-mode-select');
    if (modeSelect) {
      // 初始化读取本地存储
      try {
        const saved = localStorage.getItem('navigatorMode');
        if (saved === 'heatmap' || saved === 'detail' || saved === 'auto') {
          this.heatmap.overrideMode = saved;
          modeSelect.value = saved;
        }
      } catch (e) { /* ignore */ }
      modeSelect.addEventListener('change', () => {
        const v = modeSelect.value;
        this.heatmap.overrideMode = v === 'heatmap' ? 'heatmap' : v === 'detail' ? 'detail' : 'auto';
        try { localStorage.setItem('navigatorMode', this.heatmap.overrideMode); } catch (e) { /* ignore */ }
        this.update();
      });
    }

    // 绑定点击/拖拽交互
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => {
        this._dragging = true;
        this.centerToEvent(e);
      });
      this.canvas.addEventListener('mousemove', (e) => {
        if (this._dragging) this.centerToEvent(e);
      });
      const end = () => { this._dragging = false; };
      this.canvas.addEventListener('mouseup', () => { end(); this.bounceToClamp(); });
      this.canvas.addEventListener('mouseleave', () => { end(); this.bounceToClamp(); });
    }
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
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);

    // 获取渲染器状态（图层显隐 & 当前层）
    const app = window.roadNetApp || {};
    const renderer = app.renderer || null;
    const flags = (renderer && renderer.flags) ? renderer.flags : {
      obstaclesVisible: true,
      baseOverlayVisible: true,
      networkNodesVisible: true,
      networkEdgesVisible: true,
      voronoiVisible: true,
    };
    const currentLayer = (renderer && typeof renderer.currentLayer === 'number') ? renderer.currentLayer : null;

    // 颜色（与图例一致）
    const COLORS = {
      obstacle: '#DC2626',
      network: '#3B82F6',
      voronoi: '#06B6D4',
      base: '#9CA3AF',
    };

    // 绘制障碍物
    if (flags.obstaclesVisible && data.obstacles && data.obstacles.length > 0) {
      this.drawObstacles(data.obstacles);
    }

    // 选择需要绘制的层
    const layers = data.layers || [];
    const layerIndices = currentLayer === null ? layers.map((_, i) => i) : [currentLayer];

    // 基础三角化（虚线）
    if (flags.baseOverlayVisible) {
      this.ctx.save();
      this.ctx.strokeStyle = COLORS.base;
      this.ctx.globalAlpha = 0.35;
      this.ctx.lineWidth = 1;
      const dash = Math.max(2, Math.round(8 * (this.scale < 1 ? 1 : 1 / this.scale)));
      const gap = Math.max(2, Math.round(6 * (this.scale < 1 ? 1 : 1 / this.scale)));
      this.ctx.setLineDash([dash, gap]);
      layerIndices.forEach((li) => {
        const layer = layers[li];
        const edges = layer?.metadata?.overlayBase?.edges || [];
        edges.forEach(e => {
          this.ctx.beginPath();
          this.ctx.moveTo(e.x1 * this.scale, e.y1 * this.scale);
          this.ctx.lineTo(e.x2 * this.scale, e.y2 * this.scale);
          this.ctx.stroke();
        });
      });
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    const useHeatmap = this.heatmap.enabled && this.shouldUseHeatmap(layers, layerIndices);

    if (useHeatmap) {
      this.drawHeatmap(layers, layerIndices);
    } else {
      // 网络边与 Voronoi 线 + 节点
      this.ctx.lineWidth = 0.6;
      layerIndices.forEach((li) => {
        const layer = layers[li];
        if (!layer || !Array.isArray(layer.edges) || !Array.isArray(layer.nodes)) return;
        const abstractionRaw = layer?.metadata?.abstraction || '';
        const isVoronoi = String(abstractionRaw).toLowerCase().includes('voronoi');
        const edgesColor = isVoronoi ? COLORS.voronoi : COLORS.network;

        if ((isVoronoi && flags.voronoiVisible) || (!isVoronoi && flags.networkEdgesVisible)) {
          this.ctx.strokeStyle = edgesColor;
          this.ctx.globalAlpha = isVoronoi ? 0.9 : 0.6;
          layer.edges.forEach(edge => {
            const from = layer.nodes.find(n => n.id === edge.from);
            const to = layer.nodes.find(n => n.id === edge.to);
            if (from && to) {
              this.ctx.beginPath();
              this.ctx.moveTo(from.x * this.scale, from.y * this.scale);
              this.ctx.lineTo(to.x * this.scale, to.y * this.scale);
              this.ctx.stroke();
            }
          });
        }

        if (flags.networkNodesVisible) {
          this.ctx.fillStyle = COLORS.network;
          this.ctx.globalAlpha = 0.9;
          const r = 1.2;
          layer.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x * this.scale, node.y * this.scale, r, 0, Math.PI * 2);
            this.ctx.fill();
          });
        }
      });
    }

    this.ctx.restore();

    // 绘制视口框
    try {
      if (renderer && typeof renderer.getViewportRect === 'function') {
        const vp = renderer.getViewportRect();
        if (vp) this.drawViewport(vp);
      }
    } catch (e) { /* ignore */ }

    console.log('🗺️ Navigator updated');
  }

  /**
   * 绘制障碍物
   */
  drawObstacles(obstacles) {
    this.ctx.fillStyle = '#DC2626';
    this.ctx.globalAlpha = 0.5;

    obstacles.forEach(obs => {
      const x = obs.x * this.scale;
      const y = obs.y * this.scale;
      const w = (obs.w ?? obs.width) * this.scale;
      const h = (obs.h ?? obs.height) * this.scale;
      this.ctx.fillRect(x, y, w, h);
    });

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 判断是否使用热力图（根据节点密度）
   */
  shouldUseHeatmap(layers, layerIndices) {
    // 覆盖模式
    const mode = this.heatmap.overrideMode || 'auto';
    if (mode === 'heatmap') return true;
    if (mode === 'detail') return false;
    // 若未开启节点显示，则不使用热力
    try {
      const flags = window.roadNetApp?.renderer?.flags;
      if (flags && flags.networkNodesVisible === false) return false;
    } catch (e) { /* ignore */ }

    const cells = this.heatmap.cols * this.heatmap.rows;
    if (cells <= 0) return false;
    let totalNodes = 0;
    layerIndices.forEach((li) => {
      const layer = layers[li];
      if (layer && Array.isArray(layer.nodes)) totalNodes += layer.nodes.length;
    });
    const avgPerCell = totalNodes / cells;
    return avgPerCell > this.heatmap.thresholdPerCell;
  }

  /**
   * 绘制网格热力图（节点密度）
   */
  drawHeatmap(layers, layerIndices) {
    const cols = this.heatmap.cols;
    const rows = this.heatmap.rows;
    const widthPx = (this.roadNetData.metadata.width * this.scale) || this.canvas.width;
    const heightPx = (this.roadNetData.metadata.height * this.scale) || this.canvas.height;
    const cellW = Math.max(1, Math.floor(widthPx / cols));
    const cellH = Math.max(1, Math.floor(heightPx / rows));

    // 统计计数
    const counts = new Array(cols * rows).fill(0);
    let maxCount = 0;
    layerIndices.forEach((li) => {
      const layer = layers[li];
      if (!layer || !Array.isArray(layer.nodes)) return;
      for (const node of layer.nodes) {
        const sx = node.x * this.scale;
        const sy = node.y * this.scale;
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(sx / cellW)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(sy / cellH)));
        const idx = cy * cols + cx;
        counts[idx]++;
        if (counts[idx] > maxCount) maxCount = counts[idx];
      }
    });
    if (maxCount <= 0) return;

    const minA = this.heatmap.minAlpha;
    const maxA = this.heatmap.maxAlpha;

    this.ctx.save();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const idx = cy * cols + cx;
        const count = counts[idx];
        if (count <= 0) continue;
        // 非线性映射，提升低密度可见性
        const t = Math.sqrt(count / maxCount);
        const a = minA + t * (maxA - minA);
        this.ctx.globalAlpha = a;
        this.ctx.fillStyle = this.heatColor(t);
        this.ctx.fillRect(cx * cellW, cy * cellH, cellW, cellH);
      }
    }
    this.ctx.restore();
  }

  /**
   * 连续色带：蓝(#3B82F6) → 青(#06B6D4) → 黄(#F59E0B)
   */
  heatColor(t01) {
    const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
    const t = clamp(t01);
    const stops = [
      { t: 0.0, c: [0x3b,0x82,0xf6] }, // 蓝
      { t: 0.5, c: [0x06,0xb6,0xd4] }, // 青
      { t: 1.0, c: [0xf5,0x9e,0x0b] }  // 黄
    ];
    let c0 = stops[0], c1 = stops[stops.length-1];
    for (let i=0;i<stops.length-1;i++) {
      if (t >= stops[i].t && t <= stops[i+1].t) { c0 = stops[i]; c1 = stops[i+1]; break; }
    }
    const localT = (t - c0.t) / (c1.t - c0.t || 1);
    const lerp = (a,b,p) => Math.round(a + (b-a)*p);
    const r = lerp(c0.c[0], c1.c[0], localT);
    const g = lerp(c0.c[1], c1.c[1], localT);
    const b = lerp(c0.c[2], c1.c[2], localT);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * 将缩略图点击位置映射为世界坐标并居中主视图
   */
  centerToEvent(e) {
    try {
      const app = window.roadNetApp || {};
      const renderer = app.renderer || null;
      if (!renderer || typeof renderer.centerOn !== 'function') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - this.offsetX;
      const y = e.clientY - rect.top - this.offsetY;
      const worldX = x / this.scale;
      const worldY = y / this.scale;
      const maxW = this.roadNetData?.metadata?.width || 0;
      const maxH = this.roadNetData?.metadata?.height || 0;
      // 视口尺寸（世界坐标）用于边界计算
      const vp = (typeof renderer.getViewportRect === 'function') ? renderer.getViewportRect() : null;
      const vw = vp ? vp.width : maxW;
      const vh = vp ? vp.height : maxH;
      // 当视口大于内容时，应将目标中心约束为世界中心，避免左上漂移
      const minCX = (vw >= maxW) ? (maxW / 2) : (vw / 2);
      const maxCX = (vw >= maxW) ? (maxW / 2) : Math.max(minCX, maxW - vw / 2);
      const minCY = (vh >= maxH) ? (maxH / 2) : (vh / 2);
      const maxCY = (vh >= maxH) ? (maxH / 2) : Math.max(minCY, maxH - vh / 2);
      const damp = 0.2; // 阻尼系数（越小越软）
      const softClamp = (v, min, max) => {
        if (v < min) return min - (min - v) * damp; // 允许少量越界
        if (v > max) return max + (v - max) * damp;
        return v;
      };
      const wx = softClamp(worldX, minCX, maxCX);
      const wy = softClamp(worldY, minCY, maxCY);
      renderer.centerOn(wx, wy);
    } catch (err) { /* ignore */ }
  }

  /**
   * 松开后回弹到合法中心（动画插值）
   */
  bounceToClamp() {
    try {
      const app = window.roadNetApp || {};
      const renderer = app.renderer || null;
      if (!renderer || typeof renderer.centerOn !== 'function' || typeof renderer.getViewportRect !== 'function') return;
      const vp = renderer.getViewportRect();
      const maxW = this.roadNetData?.metadata?.width || 0;
      const maxH = this.roadNetData?.metadata?.height || 0;
      const vw = vp ? vp.width : maxW;
      const vh = vp ? vp.height : maxH;
      // 当视口大于内容时，将合法中心约束为世界中心，避免居中回弹漂移
      const minCX = (vw >= maxW) ? (maxW / 2) : (vw / 2);
      const maxCX = (vw >= maxW) ? (maxW / 2) : Math.max(minCX, maxW - vw / 2);
      const minCY = (vh >= maxH) ? (maxH / 2) : (vh / 2);
      const maxCY = (vh >= maxH) ? (maxH / 2) : Math.max(minCY, maxH - vh / 2);
      // 当前中心 = 视口左上 + 半宽高
      const curCX = vp.x + vw / 2;
      const curCY = vp.y + vh / 2;
      const targetCX = Math.min(maxCX, Math.max(minCX, curCX));
      const targetCY = Math.min(maxCY, Math.max(minCY, curCY));
      // 若已在合法范围，跳过
      if (Math.abs(targetCX - curCX) < 0.001 && Math.abs(targetCY - curCY) < 0.001) return;
      // 动画插值
      const duration = 180; // ms
      const t0 = performance.now();
      const startX = curCX, startY = curCY;
      const easeOut = (t)=>1 - Math.pow(1 - t, 3);
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / duration);
        const k = easeOut(p);
        const nx = startX + (targetCX - startX) * k;
        const ny = startY + (targetCY - startY) * k;
        renderer.centerOn(nx, ny);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch (e) { /* ignore */ }
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
    
    // 使用高对比度颜色以提升可见性（深色背景与蓝色要素下更清晰）
    this.ctx.strokeStyle = '#F59E0B';
    this.ctx.lineWidth = 2.5;
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
