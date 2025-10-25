/**
 * 导出管理器
 * 负责导出 JSON、PNG、SVG 格式的数据
 */

class ExportManager {
  constructor() {
    this.downloadBtn = document.getElementById('download-btn');
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => {
        this.showDownloadOptions();
      });
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
        <span>Export PNG</span>
      </button>
      <button class="download-option" data-format="svg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        <span>Export SVG</span>
      </button>
    `;

    // 定位菜单
    const btnRect = this.downloadBtn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${btnRect.bottom + 8}px`;
    menu.style.left = `${btnRect.left}px`;

    document.body.appendChild(menu);

    // 绑定选项点击事件
    menu.querySelectorAll('.download-option').forEach(option => {
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
      version: '1.0'
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `roadnet_${Date.now()}.json`;
    this.downloadFile(url, filename);

    console.log('✅ JSON exported:', filename);
  }

  /**
   * 导出 PNG 图片
   */
  exportPNG() {
    const renderer = window.roadNetApp?.renderer;
    if (!renderer || !renderer.app) {
      alert('⚠️ 渲染器未就绪');
      return;
    }

    try {
      // 使用 PixiJS 的截图功能
      const canvas = renderer.app.renderer.view;
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const filename = `roadnet_${Date.now()}.png`;
          this.downloadFile(url, filename);
          console.log('✅ PNG exported:', filename);
        }
      }, 'image/png');
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('❌ PNG 导出失败');
    }
  }

  /**
   * 导出 SVG 矢量图（简化版）
   */
  exportSVG(data) {
    const { width, height } = data.metadata;
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0F172A"/>
  <g id="obstacles">`;

    // 绘制障碍物
    if (data.obstacles && data.obstacles.length > 0) {
      data.obstacles.forEach(obs => {
        svgContent += `\n    <rect x="${obs.x}" y="${obs.y}" width="${obs.width}" height="${obs.height}" fill="#DC2626" opacity="0.8"/>`;
      });
    }

    svgContent += '\n  </g>\n  <g id="network">';

    // 绘制第一层网络（简化）
    if (data.layers && data.layers[0]) {
      const layer = data.layers[0];
      
      // 绘制边
      if (layer.edges) {
        layer.edges.forEach(edge => {
          const from = layer.nodes[edge.from];
          const to = layer.nodes[edge.to];
          if (from && to) {
            svgContent += `\n    <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#3B82F6" stroke-width="1" opacity="0.6"/>`;
          }
        });
      }

      // 绘制节点
      if (layer.nodes) {
        layer.nodes.forEach(node => {
          svgContent += `\n    <circle cx="${node.x}" cy="${node.y}" r="2" fill="#3B82F6"/>`;
        });
      }
    }

    svgContent += '\n  </g>\n</svg>';

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
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
