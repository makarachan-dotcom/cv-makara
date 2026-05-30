"use client";

import { useEffect, useState } from "react";
import type { SceneController } from "./SceneController";
import type { SceneConfig } from "@/types/cv";

interface Props {
  controller: SceneController;
}

/**
 * UI control surface. Every change writes directly into the SceneController,
 * which mutates Three.js objects in place — React state here is purely for
 * input feedback. The <Canvas> tree never re-mounts.
 */
export function CustomizationPanel({ controller }: Props) {
  const [, force] = useState(0);
  useEffect(() => controller.subscribe(() => force((x) => x + 1)), [controller]);

  const { palette, material, lighting, camera } = controller.config;

  const setPalette = (key: keyof SceneConfig["palette"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    controller.patch({ palette: { ...palette, [key]: e.target.value } });

  const setMat = (key: keyof SceneConfig["material"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    controller.patch({ material: { ...material, [key]: Number(e.target.value) } });

  const setLight = (key: "ambientIntensity" | "directionalIntensity") => (e: React.ChangeEvent<HTMLInputElement>) =>
    controller.patch({ lighting: { ...lighting, [key]: Number(e.target.value) } });

  const setLightPos = (idx: 0 | 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next: [number, number, number] = [...lighting.directionalPosition];
    next[idx] = Number(e.target.value);
    controller.patch({ lighting: { ...lighting, directionalPosition: next } });
  };

  const setCam = (key: "minDistance" | "maxDistance" | "autoRotateSpeed") => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => controller.patch({ camera: { ...camera, [key]: Number(e.target.value) } });

  return (
    <aside className="rounded-xl border border-ink-700 bg-ink-900/80 p-4 text-sm text-ink-100 backdrop-blur">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-200">
        Scene
      </h3>

      <fieldset className="mb-4">
        <legend className="text-xs text-ink-200">Palette</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["primary", "secondary", "accent", "background"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 rounded border border-ink-700 p-2">
              <input
                type="color"
                value={palette[k]}
                onChange={setPalette(k)}
                className="h-6 w-6 cursor-pointer border-0 bg-transparent"
              />
              <span className="text-[11px] uppercase tracking-wider">{k}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="text-xs text-ink-200">Material</legend>
        <Slider label="Roughness" value={material.roughness} min={0} max={1} step={0.01} onChange={setMat("roughness")} />
        <Slider label="Metalness" value={material.metalness} min={0} max={1} step={0.01} onChange={setMat("metalness")} />
        <Slider label="Env Intensity" value={material.envIntensity} min={0} max={4} step={0.05} onChange={setMat("envIntensity")} />
      </fieldset>

      <fieldset className="mb-4">
        <legend className="text-xs text-ink-200">Lighting</legend>
        <Slider label="Ambient" value={lighting.ambientIntensity} min={0} max={4} step={0.05} onChange={setLight("ambientIntensity")} />
        <Slider label="Directional" value={lighting.directionalIntensity} min={0} max={8} step={0.05} onChange={setLight("directionalIntensity")} />
        <div className="grid grid-cols-3 gap-2">
          <Slider label="X" value={lighting.directionalPosition[0]} min={-12} max={12} step={0.1} onChange={setLightPos(0)} />
          <Slider label="Y" value={lighting.directionalPosition[1]} min={-12} max={12} step={0.1} onChange={setLightPos(1)} />
          <Slider label="Z" value={lighting.directionalPosition[2]} min={-12} max={12} step={0.1} onChange={setLightPos(2)} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-ink-200">Camera</legend>
        <Slider label="Min Dist" value={camera.minDistance} min={0.5} max={20} step={0.1} onChange={setCam("minDistance")} />
        <Slider label="Max Dist" value={camera.maxDistance} min={1} max={50} step={0.5} onChange={setCam("maxDistance")} />
        <Slider label="Auto-rotate" value={camera.autoRotateSpeed} min={0} max={6} step={0.1} onChange={setCam("autoRotateSpeed")} />
      </fieldset>
    </aside>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="mb-2 block">
      <span className="flex items-center justify-between text-[11px] text-ink-200">
        <span className="uppercase tracking-wider">{props.label}</span>
        <span className="font-mono text-ink-100">{props.value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={props.onChange}
        className="mt-1 w-full accent-accent-cyan"
      />
    </label>
  );
}
