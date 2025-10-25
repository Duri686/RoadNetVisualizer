// 移动端 UI 管理器（Tab 切换 + 模块折叠/展开 + 文案适配 + 状态徽章 + 轻量化）
// 说明：最小改动，不入侵现有业务逻辑。

import renderer from '/src/core/renderer.js';

// eslint-disable-next-line no-undef
const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;

function setupTabs() {
  const tabs = document.getElementById('mobile-tabs');
  if (!tabs) return;

  const op = document.querySelector('.operation-panel');
  const viz = document.querySelector('.visualization-panel');
  const ip = document.querySelector('.interpretation-panel');
  if (!op || !viz || !ip) return;

  const switchTo = (targetClass) => {
    // 通过添加/移除 mobile-hidden 控制显示
    op.classList.toggle('mobile-hidden', targetClass !== 'operation-panel');
    viz.classList.toggle('mobile-hidden', targetClass !== 'visualization-panel');
    ip.classList.toggle('mobile-hidden', targetClass !== 'interpretation-panel');

    // aria-selected 同步
    tabs.querySelectorAll('.tab-btn').forEach((btn) => {
      const on = btn.getAttribute('data-target') === targetClass;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    // H5 滚动模式：地图锁定视口；操作/解读整页滚动
    if (isMobile()) {
      const container = document.querySelector('.container');
      const onMap = targetClass === 'visualization-panel';
      document.body.classList.toggle('lock-viewport', onMap);
      document.body.classList.toggle('scroll-page', !onMap);
      document.documentElement.classList.toggle('lock-viewport', onMap);
      document.documentElement.classList.toggle('scroll-page', !onMap);
      if (container) {
        container.classList.toggle('lock-viewport', onMap);
        container.classList.toggle('scroll-page', !onMap);
      }
    }
  };

  // 默认：显示“地图”
  switchTo('visualization-panel');

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const target = btn.getAttribute('data-target');
    if (!target) return;
    switchTo(target);
  });
}

function setupCollapsibles() {
  // 三个主模块：点击其 header 切换 collapsed 类
  const opHeader = document.querySelector('.operation-panel .panel-header');
  const vizHeader = document.querySelector('.visualization-header');
  const ipHeader = document.querySelector('.interpretation-panel .panel-header');

  const opPanel = document.querySelector('.operation-panel');
  const vizPanel = document.querySelector('.visualization-panel');
  const ipPanel = document.querySelector('.interpretation-panel');

  const bind = (header, panel) => {
    if (!header || !panel) return;
    header.addEventListener('click', () => {
      if (!isMobile()) return;
      panel.classList.toggle('collapsed');
    });
  };

  bind(opHeader, opPanel);
  bind(vizHeader, vizPanel);
  bind(ipHeader, ipPanel);
}

function setupHintText() {
  const hint = document.getElementById('canvas-hint-text');
  if (!hint) return;
  const setText = () => {
    if (isMobile()) {
      hint.textContent = '💡 单指拖动、双指缩放，轻触节点进行路径规划';
    } else {
      hint.textContent = '💡 鼠标滚轮缩放，拖拽平移，点击节点进行路径规划';
    }
  };
  setText();
  window.addEventListener('resize', setText);
}


// 移动端轻量化默认：关闭重型覆盖层，必要时调整描边/半径
function setupMobilePerfDefaults() {
  if (!isMobile()) return;
  let applied = false;
  const apply = () => {
    if (applied) return;
    try {
      // 关闭基础三角化与 Voronoi 骨架，以降低密度
      if (typeof renderer.setBaseTriangulationVisible === 'function') renderer.setBaseTriangulationVisible(false);
      if (typeof renderer.setVoronoiVisible === 'function') renderer.setVoronoiVisible(false);
      // 轻量参数（若渲染前设置则影响绘制；渲染后设置则仅作为后续绘制参考）
      if (renderer && renderer.config) {
        renderer.config.edgeWidth = 1;
        renderer.config.nodeRadius = 2;
        if (renderer.config.interaction) renderer.config.interaction.pathWidth = 2;
      }
      applied = true;
    } catch (_) {}
  };
  // 首次视口事件触发后应用（确保renderer已初始化并渲染）
  window.addEventListener('renderer-viewport-changed', apply, { once: true });
}

function init() {
  if (!isMobile()) {
    // 桌面端不启用移动特定控制
    setupHintText();
    return;
  }
  setupTabs();
  setupCollapsibles();
  setupHintText();
  setupMobilePerfDefaults();
}

// 等待 DOM 就绪
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
