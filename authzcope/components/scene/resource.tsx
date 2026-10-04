"use client";

import { RoundedBox } from "@react-three/drei/core/RoundedBox";
import { Line } from "@react-three/drei/core/Line";
import type { ThreeEvent } from "@react-three/fiber";
import { Vector3 } from "three";

import { AnchoredLabel } from "./anchored-label";
import { sceneColors, type AccessComplexity, type ScenePoint } from "./scene-types";

const defaultSize: ScenePoint = [1.1, 1, 0.9];
const up = new Vector3(0, 1, 0);

export function resourceConnectionAnchor(position: ScenePoint, rotationY = 0, size: ScenePoint = defaultSize): ScenePoint {
  return new Vector3(0, -size[1] * 0.15, size[2] / 2 + 0.025)
    .applyAxisAngle(up, rotationY).add(new Vector3(...position)).toArray();
}

function ResourceOutline({ size, color, dashed = false }: { size: ScenePoint; color: string; dashed?: boolean }) {
  const [x, y, z] = size.map((value) => value / 2 + 0.015);
  const corners: ScenePoint[] = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return <Line points={edges.flatMap(([a, b]) => [corners[a], corners[b]])} segments color={color}
    lineWidth={1} toneMapped={false} dashed={dashed} dashSize={0.07} gapSize={0.07} />;
}

export function Resource({ id, instanceId, label, state, position, rotationY = 0, size = defaultSize,
  complexity = "straightforward", selected = false, onInspect }: {
  id: string;
  instanceId?: string;
  label: string;
  state?: string;
  position: ScenePoint;
  rotationY?: number;
  size?: ScenePoint;
  complexity?: AccessComplexity;
  selected?: boolean;
  onInspect?: (id: string) => void;
}) {
  function inspect(event: ThreeEvent<MouseEvent>) {
    if (!onInspect) return;
    event.stopPropagation();
    onInspect(id);
  }

  return (
    <group position={position} name={instanceId ?? id} userData={{ semanticId: id, instanceId, kind: "resource", complexity }} onClick={onInspect ? inspect : undefined}>
      <group rotation={[0, rotationY, 0]}>
        {complexity === "conditional" ? [-1, 0, 1].map((layer) => (
          <RoundedBox key={layer} position={[0, layer * size[1] * 0.36, 0]}
            args={[size[0], size[1] * 0.28, size[2]]} radius={0.035} smoothness={3} castShadow receiveShadow>
            <meshStandardMaterial color={sceneColors.resource} roughness={0.88} metalness={0} />
          </RoundedBox>
        )) : (
          <RoundedBox args={size} radius={0.045} smoothness={3} castShadow receiveShadow>
            <meshStandardMaterial color={sceneColors.resource} roughness={0.88} metalness={0} />
          </RoundedBox>
        )}
        {selected ? <ResourceOutline size={size} color={sceneColors.selected} /> : null}
        {complexity === "unresolved" && !selected ? <ResourceOutline size={size} color={sceneColors.unknown} dashed /> : null}
      </group>
      <AnchoredLabel id={id} label={label} detail={state} position={[0, size[1] / 2 + 0.45, 0]} />
    </group>
  );
}
