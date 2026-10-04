import { semanticTargetKey, type SceneLayout, type ScenePoint, type SceneProjection } from "./scene-graph-types.ts";

/** Geometry is application-owned. No meshes or database assumptions enter this layer. */
export function layoutScene(projection: SceneProjection, previousLayout?: SceneLayout): SceneLayout {
  const nodes: SceneLayout["nodes"] = [], labels: SceneLayout["labels"] = [];
  const positions: SceneLayout["positions"] = new Map();
  const localPanels = projection.panels.map((panel) => {
    const local = new Map<string, { position: ScenePoint; rotationY: number }>();
    const anchor = panel.nodes.find((node) => node.instanceId === panel.anchorId);
    const resourceAnchor = anchor?.role === "resource";
    if (anchor) local.set(anchor.instanceId, { position: resourceAnchor ? [0, 1.5, -2.4] : [0, 0, 2.4], rotationY: 0 });
    const others = panel.nodes.filter((node) => node.instanceId !== panel.anchorId).sort((a, b) => a.semanticId.localeCompare(b.semanticId) || a.instanceId.localeCompare(b.instanceId));
    if (panel.mode === "fan") {
      others.forEach((node, index) => {
        const ring = Math.floor(index / 8), slot = index % 8, count = Math.min(8, others.length - ring * 8);
        const angle = count === 1 ? 0 : (slot / (count - 1) - 0.5) * Math.PI * 1.35;
        const radius = 4.7 + ring * 3;
        const position: ScenePoint = resourceAnchor
          ? [Math.sin(angle) * radius, 0, -2.4 + Math.cos(angle) * radius]
          : [Math.sin(angle) * radius, 1.2, 2.4 - Math.cos(angle) * radius];
        const rotationY = node.role === "resource" ? Math.atan2(-position[0], 2.4 - position[2]) : 0;
        local.set(node.instanceId, { position, rotationY });
      });
    } else {
      const paths = others.filter((node) => node.role === "path");
      const actors = others.filter((node) => node.role === "actor");
      const rows = Math.max(1, Math.ceil(paths.length / 5));
      paths.forEach((node, index) => {
        const row = Math.floor(index / 5), count = Math.min(5, paths.length - row * 5);
        local.set(node.instanceId, { position: [(index % 5 - (count - 1) / 2) * 2.8, 1.1, -0.4 + row * 1.5], rotationY: 0 });
      });
      actors.forEach((node, index) => local.set(node.instanceId, { position: [(index - (actors.length - 1) / 2) * 2.5, 0, rows * 1.5 + 1.4], rotationY: 0 }));
    }
    return { panel, local, width: Math.max(5, ...[...local.values()].map(({ position }) => Math.abs(position[0]) * 2 + 3)) };
  });
  // Every scenario uses the same spacing budget, regardless of its access states.
  const panelWidth = Math.max(5, ...localPanels.map((panel) => panel.width)) + 2;
  localPanels.forEach(({ panel, local }, panelIndex) => {
    const offset = (panelIndex - (localPanels.length - 1) / 2) * panelWidth;
    for (const node of panel.nodes) {
      const pose = local.get(node.instanceId) ?? { position: [0, 1, 0] as ScenePoint, rotationY: 0 };
      const computed = { position: [pose.position[0] + offset, pose.position[1], pose.position[2]] as ScenePoint, rotationY: pose.rotationY };
      // Reuse stable positions for updates within one view, never between panel arrangements.
      const cached = previousLayout?.positions.get(node.instanceId);
      const sameArrangement = !!previousLayout && previousLayout.nodes.length === projection.panels.reduce((count, panel) => count + panel.nodes.length, 0) &&
        previousLayout.labels.length === projection.panels.filter((panel) => panel.label).length;
      const placed = cached && sameArrangement ? cached : computed;
      positions.set(node.instanceId, placed);
      nodes.push({ ...node, ...placed });
    }
    if (panel.label) labels.push({ id: panel.id, label: panel.label, position: [offset, 3, -2.4] });
  });
  const points = [...nodes.map((node) => node.position), ...labels.map((label) => label.position)];
  const min: ScenePoint = [-2, 0, -2], max: ScenePoint = [2, 3, 2];
  if (points.length) for (const axis of [0, 1, 2] as const) {
    min[axis] = Math.min(...points.map((point) => point[axis])) - 1.5;
    max[axis] = Math.max(...points.map((point) => point[axis])) + 1.5;
  }
  const edges = projection.panels.flatMap((panel) => panel.edges);
  const instancesByTarget = new Map<string, string[]>();
  for (const object of [...nodes, ...edges]) for (const ref of object.refs) {
    const key = semanticTargetKey(ref);
    const instances = instancesByTarget.get(key) ?? [];
    if (!instances.includes(object.instanceId)) instances.push(object.instanceId);
    instancesByTarget.set(key, instances);
  }
  return { nodes, edges, labels, bounds: { min, max }, positions, instancesByTarget, messages: projection.messages };
}
