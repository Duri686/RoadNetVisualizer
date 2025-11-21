/**
 * UIManager
 * Manages UI interactions, event listeners, and DOM manipulations.
 */
import layerToggleManager from '../utils/layerToggleManager.js';

export default class UIManager {
  constructor(app) {
    this.app = app; // Reference to the main App instance for callbacks/access
    this.renderer = app.renderer;
  }

  init() {
    this.setupLegendControls();
    this.setupPathPanelControls();
    this.setupZoomControls();
    this.setupFullscreenControls();
    this.setupWindowResize();
    this.setupFpsControl();
    this.setupUIEventHandlers();
  }

  /**
   * Legend visibility controls (Right panel)
   */
  setupLegendControls() {
    const card = document.getElementById('legend-card');
    if (!card) return;

    const updateUI = (key, visible) => {
      const item = card.querySelector(`.legend-item-new[data-layer="${key}"]`);
      if (item) {
        const btn = item.querySelector('.legend-eye');
        const isOn = visible !== false;
        item.classList.toggle('off', !isOn);
        if (btn) btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      }
    };

    try {
      const states = layerToggleManager.getLayerStates();
      Object.keys(states).forEach(key => {
        updateUI(key, states[key]);
      });
    } catch (e) {
      console.debug('[Legend] init sync skipped:', e);
    }

    window.addEventListener('layer-visibility-changed', (e) => {
      if (e.detail) {
        const { layerName, isVisible } = e.detail;
        updateUI(layerName, isVisible);
      }
    });

    card.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.legend-eye');
      if (!btn) return;
      const item = btn.closest('.legend-item-new');
      const key = item && item.getAttribute('data-layer');
      if (!key) return;
      
      const currentPressed = btn.getAttribute('aria-pressed') === 'true';
      const next = !currentPressed;
      
      layerToggleManager.toggleLayer(key, next);
    });
  }

  /**
   * Path panel interactions: Clear/Refresh/Collapse
   */
  setupPathPanelControls() {
    const clearBtn = document.getElementById('path-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        try { this.renderer.interaction && this.renderer.interaction.clearPath(); } catch (e) {}
      });
    }

    const refreshBtn = document.getElementById('path-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        try { this.renderer.interaction && this.renderer.interaction.redrawLastPath(); } catch (e) {}
      });
    }

    const collapseBtn = document.getElementById('path-collapse-btn');
    const pathCard = document.getElementById('path-card');
    if (collapseBtn && pathCard) {
      collapseBtn.addEventListener('click', () => {
        const collapsed = pathCard.classList.toggle('collapsed');
        collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }
  }

  /**
   * Zoom controls
   */
  setupZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        this.renderer.zoomIn();
        const vp = this.renderer.getViewportRect && this.renderer.getViewportRect();
        if (vp) console.debug('[Zoom] in, viewport=', vp);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        this.renderer.zoomOut();
        const vp = this.renderer.getViewportRect && this.renderer.getViewportRect();
        if (vp) console.debug('[Zoom] out, viewport=', vp);
      });
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        this.renderer.resetView();
        const vp = this.renderer.getViewportRect && this.renderer.getViewportRect();
        if (vp) console.debug('[Zoom] reset, viewport=', vp);
      });
    }
  }

  /**
   * Fullscreen toggle
   */
  setupFullscreenControls() {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const canvasContainer = document.querySelector('.canvas-container');
    const pixiContainer = document.getElementById('pixi-canvas');

    if (fullscreenBtn && canvasContainer) {
      fullscreenBtn.addEventListener('click', () => {
        console.log(
          `[UI] fullscreen button clicked. currentFS=${!!document.fullscreenElement}`,
        );
        if (!document.fullscreenElement) {
          canvasContainer.requestFullscreen().catch((err) => {
            alert(`无法进入全屏模式: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      const canvasInfo = document.getElementById('canvas-info');

      setTimeout(() => {
        let newWidth, newHeight;
        if (isFullscreen) {
          newWidth = screen.width;
          const infoH = canvasInfo && canvasInfo.offsetHeight ? canvasInfo.offsetHeight : 0;
          newHeight = screen.height - infoH;
        } else {
          newWidth = pixiContainer.clientWidth;
          newHeight = pixiContainer.clientHeight;
        }
        console.log(
          `[Resize][fullscreenchange] isFS=${isFullscreen} -> resize(${newWidth}x${newHeight})`,
        );
        this.renderer.resize(newWidth, newHeight);
      }, 100);
    });
  }

  /**
   * Window resize handling
   */
  setupWindowResize() {
    const pixiContainer = document.getElementById('pixi-canvas');
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!document.fullscreenElement) {
          const w = pixiContainer.clientWidth;
          const h = pixiContainer.clientHeight;
          console.log(
            `[Resize][window] viewport=${window.innerWidth}x${window.innerHeight} pixiContainer=${w}x${h} -> resize(${w}x${h})`,
          );
          this.renderer.resize(w, h);
        }
      }, 250);
    });

    // ResizeObserver for container
    try {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          const newW = Math.max(1, Math.round(cr.width));
          const newH = Math.max(1, Math.round(cr.height));
          if (this.app.appLastW !== newW || this.app.appLastH !== newH) {
            console.log(`[ResizeObserver] Container size changed: ${newW}x${newH}`);
            this.app.appLastW = newW;
            this.app.appLastH = newH;
            this.renderer.resize(newW, newH);
          }
        }
      });
      ro.observe(pixiContainer);
      this.app._pixiResizeObserver = ro;
    } catch (e) {
      console.warn('[ResizeObserver] not available:', e);
    }
  }

  /**
   * FPS display toggle
   */
  setupFpsControl() {
    try {
      const fpsChk = document.getElementById('show-fps');
      if (fpsChk && typeof this.renderer.setFpsVisible === 'function') {
        // Sync initial state
        this.renderer.setFpsVisible(!!fpsChk.checked);
        // Listen for changes
        fpsChk.addEventListener('change', () => {
          this.renderer.setFpsVisible(!!fpsChk.checked);
        });
      }
    } catch (_) {}
  }

  /**
   * General UI Event Handlers (Forms, LayerControl)
   */
  setupUIEventHandlers() {
    // Form Submit
    if (this.app.inputForm) {
      this.app.inputForm.onSubmit((values) => {
        console.log('📝 Form submitted:', values);
        this.app.handleGenerate(values);
      });
    }

    // Layer Control
    if (this.app.layerControl) {
      this.app.layerControl.onLayerChange((layerIndex) => {
        console.log(`🔄 Switching to layer ${layerIndex}`);
        this.renderer.showLayer(layerIndex);
        this.app.layerControl.updateLayerInfo(this.app.roadNetData);
      });

      this.app.layerControl.onShowAll(() => {
        console.log('👀 Showing all layers');
        this.renderer.showLayer(null);
      });
    }
  }
}
