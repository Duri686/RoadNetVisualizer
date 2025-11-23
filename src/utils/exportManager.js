/**
 * 导出管理器
 * 负责导出 JSON、PNG、SVG、GLB 格式的数据
 * 适配 Three.js 3D 渲染器
 */

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class ExportManager {
  constructor() {
    this.downloadBtn = null;
    this._initialized = false;
    // 延迟初始化，等待 DOM 加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * 初始化
   */
  init() {
    if (this._initialized) return;
    this.downloadBtn = document.getElementById('download-btn');
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    if (this.downloadBtn && !this._initialized) {
      this._initialized = true;
      this.downloadBtn.addEventListener('click', () => {
        this.showDownloadOptions();
      });
      console.log('✅ Export manager initialized');
    } else {
      console.warn('⚠️ Download button not found');
    }
  }

  /**
   * 显示下载选项菜单
   */
  showDownloadOptions() {
    // 创建临时菜单
    const existingMenu = document.getElementById('download-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.id = 'download-menu';
    menu.className = 'download-menu';
    menu.innerHTML = `
      <button class="download-option" data-format="json">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>Export JSON</span>
      </button>
      <button class="download-option" data-format="png">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Screenshot PNG</span>
      </button>
      <button class="download-option" data-format="glb">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <span>Export 3D Model (GLB)</span>
      </button>
      <button class="download-option" data-format="svg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        <span>Export SVG</span>
      </button>
    `;

    // 先添加到 DOM 以获取菜单高度
    document.body.appendChild(menu);

    // 定位菜单到按钮上方
    const btnRect = this.downloadBtn.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;

    menu.style.position = 'absolute';
    menu.style.top = `${btnRect.top - menuHeight - 8}px`;
    menu.style.left = `${btnRect.left}px`;

    // 绑定选项点击事件
    menu.querySelectorAll('.download-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        const format = e.currentTarget.dataset.format;
        this.handleDownload(format);
        menu.remove();
      });
    });

    // 点击外部关闭菜单
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== this.downloadBtn) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  /**
   * 处理下载
   * @param {string} format - 'json' | 'png' | 'svg'
   */
  handleDownload(format) {
    try {
      const roadNetData = window.roadNetApp?.roadNetData;
      if (!roadNetData) {
        alert('⚠️ 请先生成路网数据');
        return;
      }

      switch (format) {
        case 'json':
          this.exportJSON(roadNetData);
          break;
        case 'png':
          this.exportPNG();
          break;
        case 'glb':
          this.exportGLB();
          break;
        case 'svg':
          this.exportSVG(roadNetData);
          break;
        default:
          console.warn('Unknown format:', format);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ 导出失败: ' + error.message);
    }
  }

  /**
   * 导出 JSON 数据
   */
  exportJSON(data) {
    const exportData = {
      metadata: data.metadata,
      layers: data.layers,
      obstacles: data.obstacles,
      exportTime: new Date().toISOString(),
      version: '1.0',
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `roadnet_${Date.now()}.json`;
    this.downloadFile(url, filename);

    console.log('✅ JSON exported:', filename);
  }

  /**
   * 导出 PNG 图片（Three.js截图）
   */
  exportPNG() {
    const renderer3d = window.roadNetApp?.renderer;
    if (!renderer3d || !renderer3d.renderer) {
      alert('⚠️ 渲染器未就绪');
      return;
    }

    try {
      // 使用 Three.js 渲染器的 canvas
      const canvas = renderer3d.renderer.domElement;

      // 转换为 Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('❌ PNG 导出失败（空图像）');
          return;
        }
        const url = URL.createObjectURL(blob);
        const filename = `roadnet_3d_${Date.now()}.png`;
        this.downloadFile(url, filename);
        console.log('✅ PNG screenshot exported:', filename);
      }, 'image/png');
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('❌ PNG 导出失败: ' + error.message);
    }
  }

  /**
   * 导出 GLB 3D模型
   */
  exportGLB() {
    const renderer3d = window.roadNetApp?.renderer;
    if (!renderer3d || !renderer3d.scene) {
      alert('⚠️ 场景未就绪');
      return;
    }

    try {
      const exporter = new GLTFExporter();

      // 显示导出提示
      console.log('⏳ 正在导出 GLB 模型...');

      // 导出场景
      exporter.parse(
        renderer3d.scene,
        (gltf) => {
          // gltf 是 ArrayBuffer（二进制 GLB 格式）
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const filename = `roadnet_3d_${Date.now()}.glb`;
          this.downloadFile(url, filename);
          console.log('✅ GLB model exported:', filename);
        },
        (error) => {
          console.error('GLB export failed:', error);
          alert('❌ GLB 导出失败: ' + error.message);
        },
        { binary: true }, // 导出为二进制 GLB 格式
      );
    } catch (error) {
      console.error('GLB export failed:', error);
      alert('❌ GLB 导出失败: ' + error.message);
    }
  }

  /**
   * 导出 SVG 矢量图（简化版）
   */
  exportSVG(data) {
    const { width, height } = data.metadata;
    const app = window.roadNetApp || {};
    const r = app.renderer || {};
    const flags = r.flags || {
      obstaclesVisible: true,
      baseOverlayVisible: true,
      networkNodesVisible: true,
      networkEdgesVisible: true,
      voronoiVisible: true,
    };
    const currentLayer =
      typeof r.currentLayer === 'number' ? r.currentLayer : null;

    const COLORS = {
      bg: '#0F172A',
      obstacle: '#DC2626',
      network: '#3B82F6',
      voronoi: '#06B6D4',
      base: '#9CA3AF',
    };

    // 使用当前画布像素尺寸作为导出尺寸
    const canvasW =
      (r.app && r.app.screen && r.app.screen.width) || Math.ceil(width);
    const canvasH =
      (r.app && r.app.screen && r.app.screen.height) || Math.ceil(height);
    // 使用渲染时的坐标变换
    const tf = r.transform || { offsetX: 0, offsetY: 0, cellSize: 1 };
    const offsetX = tf.offsetX || 0;
    const offsetY = tf.offsetY || 0;
    const cellSize = tf.cellSize || 1;
    // 像素恒定的线宽/节点半径（导出目标：与当前屏幕视觉一致）
    const pxStroke = 1; // 1px 线宽
    const pxNodeRadius = 2.2; // 节点半径（像素）
    const worldNodeRadius = pxNodeRadius / cellSize; // 逆缩放到世界半径

    let parts = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`,
    );
    parts.push(`  <rect width="100%" height="100%" fill="${COLORS.bg}"/>`);
    // 世界坐标组：应用 translate + scale，将所有几何以世界单位描述
    parts.push(
      `  <g id="world" transform="translate(${offsetX}, ${offsetY}) scale(${cellSize})">`,
    );

    // 障碍物
    if (
      flags.obstaclesVisible &&
      Array.isArray(data.obstacles) &&
      data.obstacles.length
    ) {
      parts.push(`    <g id="obstacles">`);
      for (const obs of data.obstacles) {
        const w = (obs.w ?? obs.width) || 0;
        const h = (obs.h ?? obs.height) || 0;
        // 注意：障碍物描边也随缩放，因此使用较小的世界线宽即可
        const worldStroke = pxStroke / cellSize;
        parts.push(
          `      <rect x="${obs.x}" y="${obs.y}" width="${w}" height="${h}" fill="${COLORS.obstacle}" fill-opacity="0.5" stroke="${COLORS.obstacle}" stroke-opacity="0.85" stroke-width="${worldStroke}"/>`,
        );
      }
      parts.push(`    </g>`);
    }

    const layers = Array.isArray(data.layers) ? data.layers : [];
    const indices =
      currentLayer === null ? layers.map((_, i) => i) : [currentLayer];

    // 基础三角化
    if (flags.baseOverlayVisible) {
      // 使用实线导出以避免连接处不完整；保持像素级线宽
      parts.push(
        `    <g id="base-overlay" stroke="${COLORS.base}" stroke-opacity="0.35" fill="none" vector-effect="non-scaling-stroke" stroke-width="${pxStroke}" stroke-linecap="round" stroke-linejoin="round">`,
      );
      for (const li of indices) {
        const layer = layers[li];
        const edges = layer?.metadata?.overlayBase?.edges || [];
        for (const e of edges) {
          parts.push(
            `      <line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/>`,
          );
        }
      }
      parts.push(`    </g>`);
    }

    // 网络与 Voronoi
    for (const li of indices) {
      const layer = layers[li];
      if (!layer || !Array.isArray(layer.nodes)) continue;
      const abstraction = String(
        layer?.metadata?.abstraction || '',
      ).toLowerCase();
      const isVor = abstraction.includes('voronoi');

      // id -> node 映射，避免用数组下标
      const nodeMap = new Map();
      for (const n of layer.nodes) nodeMap.set(n.id, n);

      // Edges
      const canDrawEdges = isVor
        ? flags.voronoiVisible
        : flags.networkEdgesVisible;
      if (canDrawEdges && Array.isArray(layer.edges)) {
        parts.push(
          `    <g id="${isVor ? 'voronoi' : 'network'}-edges-l${li}" stroke="${
            isVor ? COLORS.voronoi : COLORS.network
          }" stroke-opacity="${
            isVor ? '0.9' : '0.6'
          }" fill="none" vector-effect="non-scaling-stroke" stroke-width="${pxStroke}" stroke-linecap="round" stroke-linejoin="round">`,
        );
        for (const e of layer.edges) {
          const from = nodeMap.get(e.from);
          const to = nodeMap.get(e.to);
          if (!from || !to) continue;
          parts.push(
            `      <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`,
          );
        }
        parts.push(`    </g>`);
      }

      // Nodes（所有层统一蓝色）
      if (flags.networkNodesVisible) {
        parts.push(
          `    <g id="network-nodes-l${li}" fill="${COLORS.network}" fill-opacity="0.95">`,
        );
        for (const n of layer.nodes) {
          parts.push(
            `      <circle cx="${n.x}" cy="${n.y}" r="${worldNodeRadius}"/>`,
          );
        }
        parts.push(`    </g>`);
      }
    }

    // 关闭世界组和 svg
    parts.push(`  </g>`);
    parts.push(`</svg>`);

    const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const filename = `roadnet_${Date.now()}.svg`;
    this.downloadFile(url, filename);

    console.log('✅ SVG exported:', filename);
  }

  /**
   * 触发文件下载
   */
  downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延迟释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// 导出单例
export default new ExportManager();
