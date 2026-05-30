"use client";

import { Color, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  PerspectiveCamera,
} from "three";
import { DEFAULT_SCENE_CONFIG, hexToRgb, type SceneConfig } from "@/types/cv";

/**
 * Ref-based controller for the WebGL scene. The CustomizationPanel mutates
 * `config` and calls `apply()` (or apply just the slice that changed). The
 * scene reads from controller refs inside useFrame / event handlers without
 * ever triggering React re-renders.
 *
 * This is the "Real-Time WebGL Mutation Architecture" required by the spec:
 * tweaks to colors/material/lights/camera do NOT re-render the scene tree.
 */
export class SceneController {
  public config: SceneConfig;

  public readonly materials = new Set<MeshStandardMaterial>();
  public readonly bgMaterials = new Set<MeshStandardMaterial>();
  public readonly accentMaterials = new Set<MeshStandardMaterial>();
  public ambient: AmbientLight | null = null;
  public directional: DirectionalLight | null = null;
  public camera: PerspectiveCamera | null = null;
  public orbit: OrbitControlsImpl | null = null;

  private listeners = new Set<() => void>();

  constructor(initial: SceneConfig = DEFAULT_SCENE_CONFIG) {
    this.config = structuredClone(initial);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const l of this.listeners) l();
  }

  registerMaterial(m: MeshStandardMaterial, slot: "primary" | "secondary" | "accent" = "primary"): void {
    if (slot === "primary") this.materials.add(m);
    else if (slot === "secondary") this.bgMaterials.add(m);
    else this.accentMaterials.add(m);
    this.applyMaterials();
  }

  unregisterMaterial(m: MeshStandardMaterial): void {
    this.materials.delete(m);
    this.bgMaterials.delete(m);
    this.accentMaterials.delete(m);
  }

  applyMaterials(): void {
    const { palette, material } = this.config;
    const primary = hexToRgb(palette.primary);
    const secondary = hexToRgb(palette.secondary);
    const accent = hexToRgb(palette.accent);
    for (const m of this.materials) {
      (m.color as Color).setRGB(primary[0], primary[1], primary[2]);
      m.roughness = material.roughness;
      m.metalness = material.metalness;
      m.envMapIntensity = material.envIntensity;
      m.needsUpdate = false; // colour-only mutation, no shader recompile needed
    }
    for (const m of this.bgMaterials) {
      (m.color as Color).setRGB(secondary[0], secondary[1], secondary[2]);
      m.roughness = material.roughness;
      m.metalness = material.metalness;
      m.envMapIntensity = material.envIntensity;
    }
    for (const m of this.accentMaterials) {
      (m.color as Color).setRGB(accent[0], accent[1], accent[2]);
      m.roughness = material.roughness * 0.5;
      m.metalness = Math.min(1, material.metalness + 0.2);
      m.envMapIntensity = material.envIntensity * 1.2;
    }
  }

  applyLighting(): void {
    const { lighting } = this.config;
    if (this.ambient) this.ambient.intensity = lighting.ambientIntensity;
    if (this.directional) {
      this.directional.intensity = lighting.directionalIntensity;
      this.directional.position.set(
        lighting.directionalPosition[0],
        lighting.directionalPosition[1],
        lighting.directionalPosition[2],
      );
    }
  }

  applyCamera(): void {
    const { camera } = this.config;
    if (this.camera) {
      this.camera.position.set(camera.position[0], camera.position[1], camera.position[2]);
      this.camera.updateProjectionMatrix();
    }
    if (this.orbit) {
      this.orbit.target = new Vector3(camera.target[0], camera.target[1], camera.target[2]);
      this.orbit.minDistance = camera.minDistance;
      this.orbit.maxDistance = camera.maxDistance;
      this.orbit.minPolarAngle = camera.minPolar;
      this.orbit.maxPolarAngle = camera.maxPolar;
      this.orbit.enableRotate = camera.enableRotate;
      this.orbit.autoRotate = camera.autoRotateSpeed > 0;
      this.orbit.autoRotateSpeed = camera.autoRotateSpeed;
      this.orbit.update();
    }
  }

  applyAll(): void {
    this.applyMaterials();
    this.applyLighting();
    this.applyCamera();
  }

  /**
   * Partial mutation: writes to `config` then mutates only the affected
   * Three.js objects. Returns the controller for chaining.
   */
  patch(partial: Partial<SceneConfig>): SceneController {
    if (partial.palette) {
      this.config.palette = { ...this.config.palette, ...partial.palette };
      this.applyMaterials();
    }
    if (partial.material) {
      this.config.material = { ...this.config.material, ...partial.material };
      this.applyMaterials();
    }
    if (partial.lighting) {
      this.config.lighting = { ...this.config.lighting, ...partial.lighting };
      this.applyLighting();
    }
    if (partial.camera) {
      this.config.camera = { ...this.config.camera, ...partial.camera };
      this.applyCamera();
    }
    this.emit();
    return this;
  }
}
