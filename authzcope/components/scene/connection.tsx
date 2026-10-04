"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei/core/Line";
import { CubicBezierCurve3, Quaternion, Vector3 } from "three";

import { sceneColors, type AccessLevel, type ScenePoint } from "./scene-types";

const arrowAxis = new Vector3(0, 1, 0);

export function Connection({ id, from, to, access = "unknown", scope, lift = 0.7, width = 1.4, opacity = 0.85, directed = true, highlighted = false }: {
  id: string;
  from: ScenePoint;
  to: ScenePoint;
  access?: AccessLevel;
  scope?: string;
  lift?: number;
  width?: number;
  opacity?: number;
  directed?: boolean;
  highlighted?: boolean;
}) {
  const route = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const first = start.clone().lerp(end, 0.3);
    const second = start.clone().lerp(end, 0.72);
    first.y += lift;
    second.y += lift;
    const curve = new CubicBezierCurve3(start, first, second, end);
    return {
      points: curve.getPoints(48),
      arrowPosition: curve.getPoint(0.9),
      arrowRotation: new Quaternion().setFromUnitVectors(arrowAxis, curve.getTangent(0.9).normalize()),
    };
  }, [from, to, lift]);

  return (
    <group name={id} userData={{ semanticId: id, kind: "connection", access, scope }}>
      <Line points={route.points} color={highlighted ? sceneColors.selected : sceneColors[access]} lineWidth={highlighted ? width * 2 : width} transparent opacity={access === "none" ? opacity * 0.6 : opacity} toneMapped={false}
        dashed={access !== "full"} dashSize={access === "unknown" ? 0.025 : access === "limited" ? 0.25 : 0.12}
        gapSize={access === "limited" ? 0.06 : 0.12} />
      {directed && access !== "none" ? (
        <mesh position={route.arrowPosition} quaternion={route.arrowRotation}>
          <coneGeometry args={[0.04, 0.13, 8]} />
          <meshBasicMaterial color={sceneColors[access]} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
