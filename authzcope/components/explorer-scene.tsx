"use client";

import { Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PCFShadowMap } from "three";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelGraphScene } from "@/components/scene/model-graph-scene";
import type { ExplorerNavigation, NavigationTarget } from "@/lib/explorer-navigation-types";
import type { AuthorizationModel } from "@/lib/authorization-model-types";

function SceneUnavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <Alert className="max-w-sm">
        <AlertTitle>3D scene unavailable</AlertTitle>
        <AlertDescription>This browser could not initialize WebGL. The explorer controls are still available.</AlertDescription>
      </Alert>
    </div>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <SceneUnavailable /> : this.props.children;
  }
}

export default function ExplorerScene({ navigation, model, onInspect }: {
  navigation: ExplorerNavigation; model: AuthorizationModel; onInspect: (target: NavigationTarget) => void;
}) {
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 3, 10], fov: 50, near: 0.1, far: 100 }}
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        shadows={{ type: PCFShadowMap }}
        aria-label="Symbolic authorization model with selectable resources, access paths and scenarios. Drag to rotate, right-drag to pan, scroll to zoom."
      >
        <ModelGraphScene model={model} navigation={navigation} onInspect={onInspect} />
      </Canvas>
    </SceneBoundary>
  );
}
