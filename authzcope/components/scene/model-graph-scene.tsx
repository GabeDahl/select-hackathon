"use client";

import { useLayoutEffect, useMemo, useRef, type ComponentRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { PerspectiveCamera } from "three";
import type { AuthorizationModel } from "@/lib/authorization-model-types";
import type { ExplorerNavigation, NavigationTarget } from "@/lib/explorer-navigation-types";
import { compileSemanticGraph } from "@/lib/scene-graph";
import { projectScene } from "@/lib/scene-projection";
import { layoutScene } from "@/lib/scene-layout";
import type { PositionedNode, SceneLayout, ScenePoint } from "@/lib/scene-graph-types";
import { Actor } from "./actor";
import { Resource, resourceConnectionAnchor } from "./resource";
import { Connection } from "./connection";
import { RelationshipJunction } from "./relationship-junction";
import { AnchoredLabel } from "./anchored-label";
import { sceneColors } from "./scene-types";

function GraphCamera({ bounds }: { bounds: SceneLayout["bounds"] }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const getScene = useThree((state) => state.get);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const { camera } = getScene();
    if (!(camera instanceof PerspectiveCamera)) return;
    const center: ScenePoint = bounds.min.map((min, axis) => (min + bounds.max[axis]) / 2) as ScenePoint;
    const width = bounds.max[0] - bounds.min[0], height = bounds.max[1] - bounds.min[1], depth = bounds.max[2] - bounds.min[2];
    const halfFov = camera.fov * Math.PI / 360;
    const distance = Math.max(9, width / (2 * Math.tan(halfFov) * Math.max(aspect, 0.2)), height / (2 * Math.tan(halfFov))) * 1.15 + depth / 2;
    camera.position.set(center[0], center[1] + distance * 0.28, center[2] + distance);
    camera.lookAt(...center);
    camera.far = Math.max(100, distance * 4);
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.set(...center);
      controls.current.maxDistance = Math.max(25, distance * 2);
      controls.current.update();
    }
    invalidate();
  }, [getScene, aspect, invalidate, bounds]);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={1} />;
}

function connectionAnchor(node: PositionedNode): ScenePoint {
  if (node.role === "resource") return resourceConnectionAnchor(node.position, node.rotationY);
  if (node.role === "actor") return [node.position[0], node.position[1] + 1.02, node.position[2]];
  return node.position;
}

/** Thin adapter: primitives receive display state; they do not interpret the AI model. */
export function ModelGraphScene({ model, navigation, onInspect }: {
  model: AuthorizationModel; navigation: ExplorerNavigation; onInspect: (target: NavigationTarget) => void;
}) {
  const graph = useMemo(() => compileSemanticGraph(model), [model]);
  const projection = useMemo(() => projectScene(graph, navigation), [graph, navigation]);
  const layout = useMemo(() => layoutScene(projection), [projection]);
  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.instanceId, node])), [layout.nodes]);
  return <>
    <GraphCamera bounds={layout.bounds} />
    <ambientLight intensity={0.65} />
    <hemisphereLight args={["#f4eee4", "#5c686d", 1.3]} />
    <directionalLight position={[-4, 8, 5]} intensity={2.5} color="#fff4df" />
    {layout.nodes.map((node) => <group key={node.instanceId} name={node.instanceId}
      userData={{ semanticId: node.semanticId, instanceId: node.instanceId, semanticRefs: node.refs, materialization: node.materialization }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta <= 5) onInspect(node.target);
      }}>
      {node.role === "resource" ? <Resource id={node.semanticId} instanceId={node.instanceId} label={node.label}
        state={node.materialization === "type" ? "Type" : node.materialization === "symbolic" ? "Symbolic" : undefined}
        position={node.position} rotationY={node.rotationY} complexity={node.complexity} selected={node.selected || node.highlighted} />
        : node.role === "actor" ? <Actor id={node.semanticId} instanceId={node.instanceId} label={node.label} position={node.position} />
        : <RelationshipJunction id={node.semanticId} label={node.label} position={node.position}
          active={layout.edges.some((edge) => edge.toId === node.instanceId && edge.access !== "none")} />}
      {node.role !== "resource" && (node.highlighted || node.selected) ? <mesh position={[node.position[0], node.position[1] + (node.role === "actor" ? 0.65 : 0), node.position[2]]}>
        <sphereGeometry args={[node.role === "actor" ? 0.55 : 0.23, 16, 12]} />
        <meshBasicMaterial color={sceneColors.selected} wireframe transparent opacity={0.65} toneMapped={false} />
      </mesh> : null}
    </group>)}
    {layout.edges.map((edge) => {
      const from = nodesById.get(edge.fromId), to = nodesById.get(edge.toId);
      if (!from || !to) return null;
      return <group key={edge.instanceId} name={edge.instanceId}
        userData={{ semanticRefs: edge.refs, actionIds: edge.actionIds, evaluations: edge.evaluations, kind: edge.kind }}>
        <Connection id={edge.instanceId} from={connectionAnchor(from)} to={connectionAnchor(to)} access={edge.access}
          scope={edge.actionIds.join(",")} lift={edge.kind === "effective_access" ? 0.55 : 0.15} highlighted={edge.highlighted} />
      </group>;
    })}
    {layout.labels.map((label) => <AnchoredLabel key={label.id} id={label.id} label={label.label} position={label.position} />)}
    {layout.messages.map((message, index) => <AnchoredLabel key={message} id={`scene:status:${index}`} label={message} position={[0, 1.5 + index * 0.5, 0]} />)}
  </>;
}
