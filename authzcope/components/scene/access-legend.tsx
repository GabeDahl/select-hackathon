import { sceneColors } from "./scene-types";

export function AccessLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Access and resource legend">
      {(["full", "limited", "none", "unknown"] as const).map((access) => (
        <li key={access} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-5 border-t-2" style={{
            borderColor: sceneColors[access],
            borderStyle: access === "full" ? "solid" : access === "unknown" ? "dotted" : "dashed",
            opacity: access === "none" ? 0.6 : 1,
          }} />
          <span className="capitalize">{access}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="flex h-3 w-3 flex-col justify-between">
          {[0, 1, 2].map((layer) => <span key={layer} className="h-0.5 rounded-xs" style={{ backgroundColor: sceneColors.resource }} />)}
        </span>
        Layered = conditional
      </li>
    </ul>
  );
}
