"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { Color } from "three";
import { hexToRgb, type CVInput } from "@/types/cv";
import { getTemplate } from "@/templates/registry";
import { SceneBindings } from "./SceneBindings";
import { SceneController } from "./SceneController";
import { VoxelOfficeScene } from "./scenes/VoxelOfficeScene";
import { MinimalistGalleryScene } from "./scenes/MinimalistGalleryScene";
import { CyberpunkTerminalScene } from "./scenes/CyberpunkTerminalScene";
import { FloatingNodeMeshScene } from "./scenes/FloatingNodeMeshScene";
import { ProceduralScene } from "./scenes/ProceduralScene";

interface Props {
  templateId: string;
  cv: CVInput;
  controller: SceneController;
  className?: string;
}

export function CVCanvas({ templateId, cv, controller, className }: Props) {
  const template = getTemplate(templateId);

  const bgColor = useMemo(() => {
    const [r, g, b] = hexToRgb(controller.config.palette.background);
    return new Color(r, g, b);
  }, [controller.config.palette.background]);

  if (!template) {
    return (
      <div className={`grid place-items-center ${className ?? ""}`}>
        <p className="text-rose-400">Unknown template: {templateId}</p>
      </div>
    );
  }

  const scene = (() => {
    switch (template.id) {
      case "voxel-office":
        return <VoxelOfficeScene controller={controller} cv={cv} />;
      case "minimalist-gallery":
        return <MinimalistGalleryScene controller={controller} cv={cv} />;
      case "cyberpunk-terminal":
        return <CyberpunkTerminalScene controller={controller} cv={cv} />;
      case "floating-node-mesh":
        return <FloatingNodeMeshScene controller={controller} cv={cv} />;
      default:
        return <ProceduralScene controller={controller} cv={cv} template={template} />;
    }
  })();

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: controller.config.camera.position,
          fov: 45,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ scene: s }) => {
          s.background = bgColor;
        }}
      >
        <Suspense fallback={null}>
          <SceneBindings controller={controller} />
          {scene}
        </Suspense>
      </Canvas>
    </div>
  );
}
