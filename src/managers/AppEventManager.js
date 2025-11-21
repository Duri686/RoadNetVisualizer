/**
 * AppEventManager
 * Manages global application events and logic coordination.
 */
import { findPathAStar } from '../utils/pathfinding.js';
import { smoothPathVisibility } from '../utils/pathSmoothing.js';

export default class AppEventManager {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
  }

  init() {
    this.setupPathRequestListener();
  }

  /**
   * Listen for path requests from the 3D renderer
   */
  setupPathRequestListener() {
    window.addEventListener('renderer-path-request', (e) => {
      const { start, end } = e.detail;
      // Ensure we have data and valid points
      if (start && end && this.renderer.roadNetData) {
        console.log('Path request received:', start, end);
        const layerIndex = start.layer || 0;
        const layer = this.renderer.roadNetData.layers[layerIndex];
        
        if (layer) {
          // Use setTimeout to avoid blocking the UI thread immediately
          setTimeout(() => {
            this.handlePathRequest(layer, start, end);
          }, 0);
        }
      }
    });
  }

  handlePathRequest(layer, start, end) {
    const smoothStartTime = performance.now();
    
    // 1. Find raw path using A*
    let path = findPathAStar(layer, start, end);
    console.log('Raw path found:', path?.length, 'nodes');
    
    if (path && path.length > 1) {
      // 2. Apply visibility smoothing
      const obstacles = this.renderer.roadNetData.obstacles || [];
      const metadata = this.renderer.roadNetData.metadata || {};
      
      try {
        const smoothedPath = smoothPathVisibility(path, obstacles, {
          width: metadata.width || 0,
          height: metadata.height || 0,
          useSpatialIndex: true,
          maxLookahead: 100,
          clearance: 2.0
        });
        
        const smoothTime = performance.now() - smoothStartTime;
        console.log('Smoothed path:', smoothedPath.length, 'nodes (reduced from', path.length, ')');
        path = smoothedPath;
        
        // 3. Calculate statistics
        const stats = this.calculatePathStats(path);
        
        // 4. Update UI
        this.updatePathStatsUI(path, stats, smoothTime);
        
      } catch (e) {
        console.warn('Path smoothing failed, using raw path:', e);
      }
      
      // 5. Draw the path
      this.renderer.drawPath(path);
    } else {
      console.warn('No path found');
      this.updatePathStatusUI('未找到');
    }
  }

  calculatePathStats(path) {
    let totalLength = 0;
    let turns = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
      
      if (i > 0) {
        const dx1 = path[i].x - path[i - 1].x;
        const dy1 = path[i].y - path[i - 1].y;
        const dx2 = path[i + 1].x - path[i].x;
        const dy2 = path[i + 1].y - path[i].y;
        
        const angle1 = Math.atan2(dy1, dx1);
        const angle2 = Math.atan2(dy2, dx2);
        const angleDiff = Math.abs(angle2 - angle1);
        
        if (angleDiff > 0.1) turns++;
      }
    }
    return { totalLength, turns };
  }

  updatePathStatsUI(path, stats, smoothTime) {
    const pathStatus = document.getElementById('path-status');
    const pathLength = document.getElementById('path-length');
    const pathNodes = document.getElementById('path-nodes');
    const pathTurns = document.getElementById('path-turns');
    const pathSmoothMs = document.getElementById('path-smooth-ms');
    
    if (pathStatus) pathStatus.textContent = '已找到';
    if (pathLength) pathLength.textContent = `${stats.totalLength.toFixed(2)} m`;
    if (pathNodes) pathNodes.textContent = path.length;
    if (pathTurns) pathTurns.textContent = stats.turns;
    if (pathSmoothMs) pathSmoothMs.textContent = `${smoothTime.toFixed(1)} ms`;
  }

  updatePathStatusUI(status) {
    const pathStatus = document.getElementById('path-status');
    if (pathStatus) pathStatus.textContent = status;
  }
}
