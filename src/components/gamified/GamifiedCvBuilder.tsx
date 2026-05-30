"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

/**
 * GamifiedCvBuilder
 * -----------------
 * Self-contained "Design Customization Panel" + live React Three Fiber canvas.
 *
 *   - Left: hex color pickers, material roughness, ambient light intensity and
 *     typography scale. Every control writes to local state.
 *   - Right: a <Canvas> with a real interactive mesh, materials, lights and a
 *     GridHelper. State values bind straight onto the scene props, so tweaks
 *     update the render in real time without ever recreating the geometry.
 *   - If `isLocked`, the "Apply Data & Deploy" button is strictly disabled and
 *     a HUD reports the streak progress ("Step X/7 Completed — Hold on for Y
 *     more days").
 */

export interface GamifiedCvBuilderProps {
  templateName: string;
  isLocked: boolean;
  /** Days checked in so far, out of the 7-day target. */
  streakCurrent: number;
  /** Streak target that unlocks the template. Defaults to 7. */
  streakTarget?: number;
  /** Fired only when unlocked and the deploy button is pressed. */
  onDeploy?: (config: SceneState) => void;
}

export interface SceneState {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  roughness: number;
  metalness: number;
  ambientIntensity: number;
  directionalIntensity: number;
  typographyScale: number;
}

const DEFAULT_STATE: SceneState = {
  primaryColor: "#22d3ee",
  accentColor: "#facc15",
  backgroundColor: "#05060a",
  roughness: 0.35,
  metalness: 0.65,
  ambientIntensity: 0.6,
  directionalIntensity: 1.8,
  typographyScale: 1,
};

export function GamifiedCvBuilder({
  templateName,
  isLocked,
  streakCurrent,
  streakTarget = 7,
  onDeploy,
}: GamifiedCvBuilderProps) {
  const [state, setState] = useState<SceneState>(DEFAULT_STATE);

  const set = <K extends keyof SceneState>(key: K) => (value: SceneState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const clampedCurrent = Math.max(0, Math.min(streakTarget, streakCurrent));
  const daysRemaining = Math.max(0, streakTarget - clampedCurrent);

  return (
    <div className="grid min-h-[640px] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* ----------------------------- Left: panel ----------------------------- */}
      <aside className="space-y-5 rounded-xl border border-slate-700 bg-slate-900/80 p-5 text-sm text-slate-100">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Customize
          </p>
          <h2 className="mt-1 text-lg font-semibold">{templateName}</h2>
        </header>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Palette
          </h3>
          <ColorField label="Primary" value={state.primaryColor} onChange={set("primaryColor")} />
          <ColorField label="Accent" value={state.accentColor} onChange={set("accentColor")} />
          <ColorField
            label="Background"
            value={state.backgroundColor}
            onChange={set("backgroundColor")}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Material
          </h3>
          <SliderField
            label="Roughness"
            value={state.roughness}
            min={0}
            max={1}
            step={0.01}
            onChange={set("roughness")}
          />
          <SliderField
            label="Metalness"
            value={state.metalness}
            min={0}
            max={1}
            step={0.01}
            onChange={set("metalness")}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Lighting
          </h3>
          <SliderField
            label="Ambient Light"
            value={state.ambientIntensity}
            min={0}
            max={4}
            step={0.05}
            onChange={set("ambientIntensity")}
          />
          <SliderField
            label="Directional Light"
            value={state.directionalIntensity}
            min={0}
            max={8}
            step={0.05}
            onChange={set("directionalIntensity")}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Typography
          </h3>
          <SliderField
            label="Type Scale"
            value={state.typographyScale}
            min={0.5}
            max={2.5}
            step={0.05}
            onChange={set("typographyScale")}
          />
        </section>

        <button
          type="button"
          disabled={isLocked}
          onClick={() => {
            if (!isLocked) onDeploy?.(state);
          }}
          aria-disabled={isLocked}
          className={
            "w-full rounded-lg px-4 py-3 text-sm font-semibold transition " +
            (isLocked
              ? "cursor-not-allowed border border-amber-500/40 bg-slate-800 text-amber-400/70"
              : "bg-cyan-400 text-slate-950 hover:bg-cyan-300")
          }
        >
          {isLocked ? "Locked — Apply Data & Deploy" : "Apply Data & Deploy"}
        </button>
      </aside>

      {/* ---------------------------- Right: canvas ---------------------------- */}
      <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-slate-700">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [4, 3, 6], fov: 45, near: 0.1, far: 200 }}
        >
          <color attach="background" args={[state.backgroundColor]} />
          <ambientLight intensity={state.ambientIntensity} />
          <directionalLight
            position={[5, 8, 6]}
            intensity={state.directionalIntensity}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-6, 4, -4]} intensity={state.directionalIntensity * 0.4} color={state.accentColor} />

          <mesh castShadow receiveShadow position={[0, 0.75, 0]} rotation={[0.2, 0.6, 0]}>
            <boxGeometry args={[1.6, 1.6, 1.6]} />
            <meshStandardMaterial
              color={state.primaryColor}
              roughness={state.roughness}
              metalness={state.metalness}
            />
          </mesh>

          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial color={state.backgroundColor} roughness={1} metalness={0} />
          </mesh>

          <gridHelper args={[40, 40, state.accentColor, "#1f2937"]} position={[0, 0, 0]} />

          <OrbitControls enablePan={false} minDistance={2} maxDistance={18} />
        </Canvas>

        {/* Live typography preview overlay — scales with the type-scale slider. */}
        <div
          className="pointer-events-none absolute left-5 top-5 origin-top-left font-semibold text-white drop-shadow"
          style={{ transform: `scale(${state.typographyScale})` }}
        >
          {templateName}
        </div>

        {isLocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-slate-950/90 to-transparent p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
              <span>
                Step {clampedCurrent}/{streakTarget} Completed
              </span>
              <span>
                {daysRemaining === 0
                  ? "Unlocking…"
                  : `Hold on for ${daysRemaining} more day${daysRemaining === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
                style={{ width: `${(clampedCurrent / streakTarget) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-slate-400">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </span>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-slate-300">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-mono text-slate-100">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full cursor-pointer accent-cyan-400"
      />
    </label>
  );
}
