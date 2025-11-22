/**
 * Hierarchical Pathfinder
 * Implements a two-level pathfinding approach:
 * 1. Global Search: A* on an abstract graph of "Zones" and "Portals".
 * 2. Local Search: Standard A* within zones to connect portals.
 */

import { MinHeap, heuristic, reconstructPath, findPathAStar } from './pathfinding.js';

export class HierarchicalPathfinder {
  /**
   * @param {Object} layer - The road network layer (nodes, edges)
   * @param {number} width - World width
   * @param {number} height - World height
   * @param {number} gridSize - Number of zones along one axis (e.g., 4 means 4x4 zones)
   */
  constructor(layer, width, height, gridSize) {
    this.layer = layer;
    this.width = width;
    this.height = height;
    this.gridSize = Math.max(1, gridSize);
    
    this.zoneWidth = width / this.gridSize;
    this.zoneHeight = height / this.gridSize;

    // Data structures
    this.nodeZoneMap = new Map(); // nodeId -> zoneIndex
    this.zones = []; // Array of { nodes: [], portals: [], internalGraph: Map }
    this.abstractGraph = new Map(); // portalId -> [{ toId, cost }]
    this.lastAbstractPath = null; // Store the last abstract path for visualization

    this.init();
  }

  getZones() {
    return this.zones;
  }

  getLastAbstractPath() {
    return this.lastAbstractPath;
  }

  init() {
    // 1. Initialize Zones
    const totalZones = this.gridSize * this.gridSize;
    for (let i = 0; i < totalZones; i++) {
      this.zones.push({
        id: i,
        nodes: [],
        portals: new Set(),
        // We might cache connectivity here if needed
      });
    }

    // 2. Assign Nodes to Zones
    const nodes = this.layer.nodes || [];
    nodes.forEach(node => {
      const col = Math.min(this.gridSize - 1, Math.floor(node.x / this.zoneWidth));
      const row = Math.min(this.gridSize - 1, Math.floor(node.y / this.zoneHeight));
      const zoneIndex = row * this.gridSize + col;
      
      this.nodeZoneMap.set(node.id, zoneIndex);
      this.zones[zoneIndex].nodes.push(node);
    });

    // 3. Identify Portals and Build Abstract Graph
    // A portal is a node that has an edge connecting to a different zone.
    const edges = this.layer.edges || [];
    
    // Helper to add edge to abstract graph
    const addAbstractEdge = (u, v, cost) => {
      if (!this.abstractGraph.has(u)) this.abstractGraph.set(u, []);
      this.abstractGraph.get(u).push({ toId: v, cost });
    };

    // 3a. Find Inter-Zone Edges (Physical connections between zones)
    edges.forEach(edge => {
      const z1 = this.nodeZoneMap.get(edge.from);
      const z2 = this.nodeZoneMap.get(edge.to);

      if (z1 !== z2) {
        // This is a border crossing
        const u = edge.from;
        const v = edge.to;

        this.zones[z1].portals.add(u);
        this.zones[z2].portals.add(v);

        // Add physical edge to abstract graph
        addAbstractEdge(u, v, edge.cost);
        addAbstractEdge(v, u, edge.cost); // Assuming undirected for now, or check edge direction
      }
    });

    // 3b. Find Intra-Zone Edges (Logical connections within a zone)
    // Connect all portals within the same zone.
    // For a robust implementation, we should check if they are actually reachable.
    // For this version, we'll use a simplified connectivity check (Euclidean distance)
    // assuming the zone is largely traversable. 
    // TODO: Run a flood fill or BFS in each zone to determine connected components for better accuracy.
    
    this.zones.forEach(zone => {
      const portals = Array.from(zone.portals);
      // Fully connect portals in this zone (Clique)
      for (let i = 0; i < portals.length; i++) {
        for (let j = i + 1; j < portals.length; j++) {
          const p1Id = portals[i];
          const p2Id = portals[j];
          
          const n1 = this.getNode(p1Id);
          const n2 = this.getNode(p2Id);
          
          if (n1 && n2) {
            const dist = heuristic(n1, n2);
            // We multiply by a factor (e.g. 1.1) to prefer "highway" (inter-zone) edges if possible,
            // or just use raw distance.
            addAbstractEdge(p1Id, p2Id, dist);
            addAbstractEdge(p2Id, p1Id, dist);
          }
        }
      }
    });
  }

  getNode(id) {
    // Ideally we should have a quick lookup. 
    // The layer.nodes is an array. Let's assume we can find it or build a map if performance is bad.
    // For now, let's build a map in constructor if not present.
    if (!this.nodeMap) {
      this.nodeMap = new Map(this.layer.nodes.map(n => [n.id, n]));
    }
    return this.nodeMap.get(id);
  }

  /**
   * Find path using Hierarchical A*
   */
  findPath(startNode, endNode) {
    const startZoneId = this.nodeZoneMap.get(startNode.id);
    const endZoneId = this.nodeZoneMap.get(endNode.id);

    // If in same zone, just run local A*
    if (startZoneId === endZoneId) {
      return findPathAStar(this.layer, startNode, endNode);
    }

    // 1. Connect Start/End to their zone's portals
    // We create a temporary graph view for the search
    const tempGraph = new Map();
    
    // Copy existing abstract graph structure to a helper function or wrapper
    // Since we can't easily clone the whole graph, we'll handle Start/End neighbors dynamically in the getNeighbors function.
    
    const startPortals = Array.from(this.zones[startZoneId].portals);
    const endPortals = Array.from(this.zones[endZoneId].portals);

    // 2. Run A* on Abstract Graph
    // We need a custom getNeighbors function for the high-level A*
    const getAbstractNeighbors = (currentId) => {
      let neighbors = this.abstractGraph.get(currentId) || [];
      
      // If current is StartNode, neighbors are its zone's portals
      if (currentId === startNode.id) {
        return startPortals.map(pId => ({ 
          toId: pId, 
          cost: heuristic(startNode, this.getNode(pId)) 
        }));
      }

      // If any neighbor is a portal in the End Zone, we can connect to EndNode?
      // No, the Abstract Graph moves from Portal to Portal.
      // We need to add edges FROM portals in EndZone TO EndNode.
      // But A* is forward. So when we are at a portal in EndZone, we can transition to EndNode.
      
      // Check if currentId is in EndZone portals
      if (this.nodeZoneMap.get(currentId) === endZoneId) {
        // It's a portal in the end zone. It can connect to EndNode.
        // We append this connection to the neighbors list.
        // Note: We must not mutate the original array.
        neighbors = [...neighbors]; 
        neighbors.push({
          toId: endNode.id,
          cost: heuristic(this.getNode(currentId), endNode)
        });
      }
      
      return neighbors;
    };

    // Custom A* for Abstract Graph
    const openHeap = new MinHeap();
    openHeap.push({ id: startNode.id, key: 0 });
    
    const cameFrom = new Map();
    const gScore = new Map();
    gScore.set(startNode.id, 0);
    
    let finalAbstractPath = null;

    while (openHeap.size() > 0) {
      const top = openHeap.pop();
      const currentId = top.id;

      if (currentId === endNode.id) {
        // Reconstruct abstract path
        let curr = endNode.id;
        const pathIds = [curr];
        while (cameFrom.has(curr)) {
          curr = cameFrom.get(curr);
          pathIds.unshift(curr);
        }
        finalAbstractPath = pathIds;
        this.lastAbstractPath = finalAbstractPath.map(id => this.getNode(id));
        break;
      }

      const currentG = gScore.get(currentId);
      // Lazy cleanup check
      // if (currentG < top.key) continue; // (If we stored fScore in key, this check is tricky. MinHeap logic handles it mostly)

      const neighbors = getAbstractNeighbors(currentId);
      for (const neighbor of neighbors) {
        const tentativeG = currentG + neighbor.cost;
        if (tentativeG < (gScore.get(neighbor.toId) ?? Infinity)) {
          cameFrom.set(neighbor.toId, currentId);
          gScore.set(neighbor.toId, tentativeG);
          const h = heuristic(this.getNode(neighbor.toId), endNode);
          openHeap.push({ id: neighbor.toId, key: tentativeG + h });
        }
      }
    }

    if (!finalAbstractPath) return null; // No path found

    // 3. Refine Path (Stitch Local Paths)
    // finalAbstractPath is [Start, P1, P2, ..., Pn, End]
    const fullPath = [];
    
    // We need to be careful not to duplicate nodes at join points
    // Segment 1: Start -> P1
    // Segment 2: P1 -> P2
    // ...
    
    for (let i = 0; i < finalAbstractPath.length - 1; i++) {
      const uId = finalAbstractPath[i];
      const vId = finalAbstractPath[i+1];
      
      const uNode = this.getNode(uId);
      const vNode = this.getNode(vId);

      // Find local path from u to v
      // Note: If u and v are connected by a physical edge, findPathAStar should return [u, v] very quickly.
      // If they are in the same zone (intra-zone), it will search locally.
      
      // Optimization: If we know they are directly connected by an edge, we can just push v.
      // But findPathAStar handles that.
      
      // We need to limit the search scope of findPathAStar to the relevant zone(s) to be truly "Local"
      // But our standard A* runs on the whole graph.
      // To strictly enforce "Local", we might want to pass a subset of nodes?
      // For now, running global A* for the segment is fine because the heuristic will guide it, 
      // BUT to prevent it from wandering out of the zone, we might want to restrict it.
      // However, standard A* is fast enough if start/end are close.
      
      const segmentPath = findPathAStar(this.layer, uNode, vNode);
      
      if (!segmentPath) {
        console.warn(`Failed to refine path segment ${uId} -> ${vId}`);
        return null;
      }

      // Append segment to fullPath
      // If fullPath is not empty, remove the last node (which is uNode) to avoid duplication
      if (fullPath.length > 0) {
        // segmentPath[0] should be uNode.
        fullPath.pop();
      }
      fullPath.push(...segmentPath);
    }

    return fullPath;
  }
}
