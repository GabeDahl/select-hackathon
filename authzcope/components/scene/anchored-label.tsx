"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, PerspectiveCamera, Sprite, SRGBColorSpace, Vector3 } from "three";

import type { ScenePoint } from "./scene-types";

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      // Identifiers and other unbroken names also need to fit the label.
      for (const character of word) {
        if (line && context.measureText(line + character).width > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
    return lines;
  });
}

// Native billboard text keeps labels inside WebGL and uses the app's local font.
export function AnchoredLabel({ id, label, detail, position, tone = "default", worldHeight, maxWidth = 160 }: {
  id: string;
  label: string;
  detail?: string;
  position: ScenePoint;
  tone?: "default" | "muted" | "surface";
  worldHeight?: number;
  maxWidth?: number;
}) {
  const sprite = useRef<Sprite>(null);
  const [bitmap, setBitmap] = useState<{ texture: CanvasTexture; width: number; height: number } | null>(null);
  const viewPosition = useRef(new Vector3());
  const projectedPosition = useRef(new Vector3());

  useEffect(() => {
    let cancelled = false;
    let texture: CanvasTexture | undefined;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "sans-serif";
      const fontSize = tone === "surface" ? 10 : 12;
      const resolution = 3;
      const textMaxWidth = Math.max(1, maxWidth - 12);
      context.font = `500 ${fontSize}px ${family}`;
      const labelLines = wrapText(context, label, textMaxWidth);
      const textWidth = Math.max(...labelLines.map((line) => context.measureText(line).width));
      context.font = `10px ${family}`;
      const detailLines = detail ? wrapText(context, detail, textMaxWidth) : [];
      const detailWidth = Math.max(0, ...detailLines.map((line) => context.measureText(line).width));
      const width = Math.ceil(Math.max(textWidth, detailWidth)) + 12;
      const labelHeight = labelLines.length * 16 + 4;
      const height = labelHeight + (detailLines.length ? detailLines.length * 14 + 2 : 0);
      canvas.width = width * resolution;
      canvas.height = height * resolution;
      context.scale(resolution, resolution);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `500 ${fontSize}px ${family}`;
      context.fillStyle = tone === "surface" ? "#333b3c" : tone === "muted" ? "#a3afb6" : "#f1f0ec";
      if (tone !== "surface") {
        context.shadowColor = "#1e272c";
        context.shadowBlur = 3;
      }
      labelLines.forEach((line, index) => context.fillText(line, width / 2, 10 + index * 16));
      if (detailLines.length) {
        context.font = `10px ${family}`;
        context.fillStyle = "#a3afb6";
        detailLines.forEach((line, index) => context.fillText(line, width / 2, labelHeight + 7 + index * 14));
      }
      texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      setBitmap({ texture, width, height });
    });
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [label, detail, tone, maxWidth]);

  useFrame(({ camera, size }) => {
    if (!sprite.current || !bitmap) return;
    if (worldHeight !== undefined) {
      sprite.current.scale.set(worldHeight * bitmap.width / bitmap.height, worldHeight, 1);
      return;
    }
    sprite.current.getWorldPosition(viewPosition.current);
    viewPosition.current.applyMatrix4(camera.matrixWorldInverse);
    if (camera instanceof PerspectiveCamera) {
      const unitsPerPixel = 2 * Math.tan(camera.fov * Math.PI / 360) * Math.abs(viewPosition.current.z) / (camera.zoom * size.height);
      const compactScale = Math.min(1, Math.max(0.75, size.width / 500));
      sprite.current.scale.set(bitmap.width * unitsPerPixel * compactScale, bitmap.height * unitsPerPixel * compactScale, 1);
      // Keep names readable at viewport edges without moving their entities.
      sprite.current.position.set(...position);
      sprite.current.getWorldPosition(projectedPosition.current);
      projectedPosition.current.project(camera);
      const margin = (bitmap.width * compactScale / 2 + 8) * 2 / size.width;
      projectedPosition.current.x = Math.max(-1 + margin, Math.min(1 - margin, projectedPosition.current.x));
      projectedPosition.current.unproject(camera);
      sprite.current.parent?.worldToLocal(projectedPosition.current);
      sprite.current.position.copy(projectedPosition.current);
    }
  });

  if (!bitmap) return null;

  return (
    <sprite ref={sprite} position={position} name={`${id}:label`} userData={{ semanticId: id, label, detail }} renderOrder={10}>
      <spriteMaterial map={bitmap.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
