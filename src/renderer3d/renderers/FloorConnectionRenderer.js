import * as THREE from 'three';
import { Renderer3DConfig } from '../config/Renderer3DConfig.js';

export function renderFloorConnections(
  layerGroups,
  connections,
  centerX,
  centerY,
) {
  if (!connections || connections.length === 0) {
    return;
  }

  const config = Renderer3DConfig;

  connections.forEach((conn) => {
    const layerIdx = conn.lowerLayer;
    if (layerIdx === undefined || layerIdx >= layerGroups.length) {
      return;
    }

    const layerGroup = layerGroups[layerIdx];
    let connectionsGroup = layerGroup.getObjectByName('connections');
    if (!connectionsGroup) {
      connectionsGroup = new THREE.Group();
      connectionsGroup.name = 'connections';
      layerGroup.add(connectionsGroup);
    }

    const conf =
      conn.type === 'elevator'
        ? config.floorEntrance.elevator
        : config.floorEntrance.stairs;

    if (conn.accessPosition) {
      const accessInfo = `(${Math.round(conn.accessPosition.x)}, ${Math.round(
        conn.accessPosition.y,
      )})`;
      console.log(
        `[FloorConnection] ${conn.type} L${conn.lowerLayer}->L${conn.upperLayer} | AccessPath: ${accessInfo}`,
      );

      const fromAccessPos = new THREE.Vector3(
        conn.accessPosition.x - centerX,
        config.layerHeight * conn.lowerLayer,
        conn.accessPosition.y - centerY,
      );
      const toAccessPos = new THREE.Vector3(
        conn.accessPosition.x - centerX,
        config.layerHeight * conn.upperLayer,
        conn.accessPosition.y - centerY,
      );

      const accessCurve = new THREE.LineCurve3(fromAccessPos, toAccessPos);
      const accessTubeGeo = new THREE.TubeGeometry(
        accessCurve,
        8,
        conf.radius,
        conf.segments,
        false,
      );
      const accessTubeMat = new THREE.MeshStandardMaterial({
        color: conf.color,
        emissive: conf.color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
      });
      const accessTube = new THREE.Mesh(accessTubeGeo, accessTubeMat);
      accessTube.name = `connection_${conn.type}_accessPath_L${conn.lowerLayer}-L${conn.upperLayer}`;
      accessTube.userData = {
        pipeType: 'accessPath',
        connectionType: conn.type,
        lowerLayer: conn.lowerLayer,
        upperLayer: conn.upperLayer,
        accessPosition: conn.accessPosition,
      };
      connectionsGroup.add(accessTube);
    } else {
      console.warn(
        `[FloorConnection] ${conn.type} L${conn.lowerLayer}->L${conn.upperLayer} missing accessPosition - skipped`,
      );
    }
  });

  console.log(
    `[RoadNetRenderer] Rendered ${connections.length} floor connections (accessPath only)`,
  );
}
