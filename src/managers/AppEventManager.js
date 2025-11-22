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
        
        // Build unified multi-layer graph for cross-floor pathfinding
        const unifiedLayer = this.buildUnifiedGraph(this.renderer.roadNetData.layers);
        
        if (unifiedLayer) {
          // Use setTimeout to avoid blocking the UI thread immediately
          setTimeout(() => {
            this.handlePathRequest(unifiedLayer, start, end);
          }, 0);
        }
      }
    });
  }
  
  /**
   * Build unified graph combining all layers and cross-floor edges
   */
  buildUnifiedGraph(layers) {
    if (!layers || layers.length === 0) return null;
    
    // Combine all nodes and edges from all layers
    const allNodes = [];
    const allEdges = [];
    const nodeIds = new Set();
    
    layers.forEach((layer, layerIdx) => {
      if (layer.nodes) {
        layer.nodes.forEach(node => {
          allNodes.push(node);
          nodeIds.add(node.id);
        });
      }
      if (layer.edges) {
        layer.edges.forEach(edge => {
          allEdges.push(edge);
        });
      }
    });
    
    // Validate that all edge endpoints exist in nodes
    let invalidEdges = 0;
    const validEdges = allEdges.filter(edge => {
      const hasFrom = nodeIds.has(edge.from);
      const hasTo = nodeIds.has(edge.to);
      if (!hasFrom || !hasTo) {
        invalidEdges++;
        console.warn(`[UnifiedGraph] Invalid edge: ${edge.from} -> ${edge.to} (from exists: ${hasFrom}, to exists: ${hasTo})`);
        return false;
      }
      return true;
    });
    
    console.log(`[UnifiedGraph] Built graph: ${allNodes.length} nodes, ${validEdges.length} edges (${invalidEdges} invalid edges filtered)`);
    console.log(`[UnifiedGraph] Cross-floor edges: ${validEdges.filter(e => e.crossFloor).length}`);
    
    return {
      nodes: allNodes,
      edges: validEdges
    };
  }

  handlePathRequest(layer, start, end) {
    const smoothStartTime = performance.now();
    
    // Always use standard A* (works across all layers with cross-floor edges)
    let path = findPathAStar(layer, start, end);
    console.log('Raw path found:', path?.length, 'nodes');
    
    // Debug: analyze path for layer transitions
    if (path && path.length > 0) {
      let transitions = 0;
      let layers = [];
      console.groupCollapsed('Path Details (Nodes)');
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        const currentLayer = node.layer || 0;
        layers.push(currentLayer);
        
        // Log node details
        const isConnector = node.id && (String(node.id).includes('C') || String(node.id).includes('access'));
        const style = isConnector ? 'color: orange; font-weight: bold' : 'color: #888';
        console.log(`%c[${i}] ${node.id} (${Math.round(node.x)}, ${Math.round(node.y)}) L${currentLayer}`, style);

        if (i > 0) {
          const prevLayer = path[i-1].layer || 0;
          if (currentLayer !== prevLayer) {
            transitions++;
            console.log(`%c⚡ Layer Transition: L${prevLayer} -> L${currentLayer}`, 'color: yellow; background: #333; padding: 2px');
          }
        }
      }
      console.groupEnd();
      console.log(`[Path] Layer sequence:`, layers);
      console.log(`[Path] Total layer transitions: ${transitions}`);
    }
    
    if (path && path.length > 1) {
      // 2. 标记跨楼层转换点为必须保留的关键节点
      const mandatoryIndices = new Set();
      mandatoryIndices.add(0); // 起点
      mandatoryIndices.add(path.length - 1); // 终点
      
      // 检测楼层变化，标记跨楼层转换的前后节点
      for (let i = 1; i < path.length; i++) {
        const prevLayer = path[i - 1].layer || 0;
        const currLayer = path[i].layer || 0;
        
        if (prevLayer !== currLayer) {
          // 楼层转换点：保留转换前后的节点，以及转换后的下一个节点
          mandatoryIndices.add(i - 1); // 前一个节点（入口）
          mandatoryIndices.add(i);     // 当前节点（出口）
          
          // ✨ 关键修复：保护出口后的第一个节点，确保路径真正"走出"楼梯
          if (i + 1 < path.length) {
            mandatoryIndices.add(i + 1); // 出口后的第一个节点
            console.log(`[Path Smoothing] Marked mandatory waypoints: [${i-1}] ${path[i-1].id} (L${prevLayer}) -> [${i}] ${path[i].id} (L${currLayer}) -> [${i+1}] ${path[i+1].id} (buffer)`);
          } else {
            console.log(`[Path Smoothing] Marked mandatory waypoints: [${i-1}] ${path[i-1].id} (L${prevLayer}) -> [${i}] ${path[i].id} (L${currLayer})`);
          }
        }
      }
      
      // 3. Apply visibility smoothing with mandatory waypoints
      const obstacles = this.renderer.roadNetData.obstacles || [];
      const metadata = this.renderer.roadNetData.metadata || {};
      
      try {
        const smoothedPath = smoothPathVisibility(path, obstacles, {
          width: metadata.width || 0,
          height: metadata.height || 0,
          useSpatialIndex: true,
          maxLookahead: 100,
          clearance: 2.0,
          mandatoryWaypoints: mandatoryIndices  // 传递必须保留的节点索引
        });
        
        const smoothTime = performance.now() - smoothStartTime;
        console.log('Smoothed path:', smoothedPath.length, 'nodes (reduced from', path.length, ')');
        
        // 详细日志：显示平滑后保留的节点
        console.groupCollapsed('[Path Smoothing] Final smoothed nodes');
        smoothedPath.forEach((node, i) => {
          const originalIndex = path.findIndex(n => n.id === node.id);
          console.log(`[${i}] ${node.id} (${Math.round(node.x)}, ${Math.round(node.y)}) L${node.layer} (was [${originalIndex}] in original)`);
        });
        console.groupEnd();
        
        path = smoothedPath;
        
        // 4. Calculate statistics
        const stats = this.calculatePathStats(path);
        
        // 5. Update UI
        this.updatePathStatsUI(path, stats, smoothTime);
        
      } catch (e) {
        console.warn('Path smoothing failed, using raw path:', e);
      }
      
      // 6. Draw the path
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
