"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  PerspectiveCamera,
} from "three";
import type { SceneController } from "./SceneController";

/**
 * Wire the live Three.js objects into the SceneController so the
 * CustomizationPanel can mutate them without re-rendering.
 *
 * Drop this once inside every <Canvas> tree.
 */
export function SceneBindings({ controller }: { controller: SceneController }) {
  const { camera } = useThree();
  const ambientRef = useRef<AmbientLight | null>(null);
  const directionalRef = useRef<DirectionalLight | null>(null);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    controller.camera = camera as PerspectiveCamera;
    controller.applyCamera();
    return () => {
      if (controller.camera === camera) controller.camera = null;
    };
  }, [camera, controller]);

  useEffect(() => {
    const ambient = ambientRef.current;
    const directional = directionalRef.current;
    controller.ambient = ambient;
    controller.directional = directional;
    controller.applyLighting();
    return () => {
      if (controller.ambient === ambient) controller.ambient = null;
      if (controller.directional === directional) controller.directional = null;
    };
  }, [controller]);

  useEffect(() => {
    const orbit = orbitRef.current;
    controller.orbit = orbit;
    controller.applyCamera();
    return () => {
      if (controller.orbit === orbit) controller.orbit = null;
    };
  }, [controller]);

  return (
    <>
      <ambientLight ref={ambientRef} intensity={controller.config.lighting.ambientIntensity} />
      <directionalLight
        ref={directionalRef}
        castShadow
        position={controller.config.lighting.directionalPosition}
        intensity={controller.config.lighting.directionalIntensity}
      />
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableRotate={controller.config.camera.enableRotate}
        minDistance={controller.config.camera.minDistance}
        maxDistance={controller.config.camera.maxDistance}
        minPolarAngle={controller.config.camera.minPolar}
        maxPolarAngle={controller.config.camera.maxPolar}
        autoRotate={controller.config.camera.autoRotateSpeed > 0}
        autoRotateSpeed={controller.config.camera.autoRotateSpeed}
        target={controller.config.camera.target}
      />
    </>
  );
}

/**
 * Registers a MeshStandardMaterial with the controller in a given color slot.
 * Use this hook *inside* the meshes that should respond to palette mutations.
 */
export function useManagedMaterial(
  controller: SceneController,
  ref: React.RefObject<MeshStandardMaterial>,
  slot: "primary" | "secondary" | "accent" = "primary",
) {
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    controller.registerMaterial(m, slot);
    return () => controller.unregisterMaterial(m);
  }, [controller, ref, slot]);
}
