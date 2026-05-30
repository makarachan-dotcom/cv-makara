"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { useManagedMaterial } from "../SceneBindings";
import type { SceneController } from "../SceneController";
import type { CVInput } from "@/types/cv";
import type { TemplateMeta } from "@/templates/registry";

interface Props {
  controller: SceneController;
  cv: CVInput;
  template: TemplateMeta;
}

/**
 * Procedural fallback scene used for the locked templates that don't have a
 * hand-authored variant yet. The category drives the shape language so each
 * template still feels distinct.
 */
export function ProceduralScene({ controller, cv, template }: Props) {
  const root = useRef<Group>(null);
  const primaryMat = useRef<MeshStandardMaterial>(null);
  const secondaryMat = useRef<MeshStandardMaterial>(null);
  const accentMat = useRef<MeshStandardMaterial>(null);

  useManagedMaterial(controller, primaryMat, "primary");
  useManagedMaterial(controller, secondaryMat, "secondary");
  useManagedMaterial(controller, accentMat, "accent");

  const layout = useMemo(() => {
    switch (template.category) {
      case "particle":
        return { kind: "swarm" as const, count: Math.min(cv.skills.length * 30, 600) };
      case "data":
        return { kind: "bars" as const, items: cv.skills.slice(0, 12) };
      case "architecture":
        return { kind: "blueprint" as const, items: cv.projects.slice(0, 8) };
      case "gallery":
        return { kind: "shelf" as const, items: cv.experience.slice(0, 6) };
      case "voxel":
        return { kind: "lowpoly" as const, items: cv.skills.slice(0, 10) };
      case "cyberpunk":
        return { kind: "grid" as const };
      case "nodemesh":
        return { kind: "ring" as const, items: cv.skills.slice(0, 16) };
      case "terminal":
        return { kind: "grid" as const };
      case "minimal":
        return { kind: "monolith" as const };
      default:
        return { kind: "spiral" as const, items: cv.experience };
    }
  }, [template.category, cv.skills, cv.experience, cv.projects]);

  useFrame((state) => {
    if (root.current) {
      root.current.rotation.y = state.clock.elapsedTime * 0.18;
    }
  });

  return (
    <group ref={root}>
      <mesh receiveShadow position={[0, -0.51, 0]}>
        <cylinderGeometry args={[7, 7, 0.04, 64]} />
        <meshStandardMaterial ref={secondaryMat} />
      </mesh>

      {layout.kind === "bars" && layout.items.map((s, i) => {
        const angle = (i / layout.items.length) * Math.PI * 2;
        const r = 3.5;
        const h = 0.4 + (s.proficiency / 100) * 2.8;
        return (
          <mesh key={s.name} position={[Math.cos(angle) * r, -0.5 + h / 2, Math.sin(angle) * r]} castShadow>
            <boxGeometry args={[0.35, h, 0.35]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : i === 1 ? accentMat : null} />
          </mesh>
        );
      })}

      {layout.kind === "swarm" && Array.from({ length: layout.count }).map((_, i) => {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / layout.count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const r = 3 + ((i * 13) % 100) / 50;
        return (
          <mesh
            key={i}
            position={[
              Math.sin(phi) * Math.cos(theta) * r,
              Math.sin(phi) * Math.sin(theta) * r,
              Math.cos(phi) * r,
            ]}
          >
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : i === 1 ? accentMat : null} />
          </mesh>
        );
      })}

      {layout.kind === "blueprint" && layout.items.map((p, i) => (
        <mesh key={p.name} position={[((i % 4) - 1.5) * 1.6, 0.4 + Math.floor(i / 4) * 1.2, 0]} castShadow>
          <boxGeometry args={[1.4, 1.0, 0.08]} />
          <meshStandardMaterial ref={i === 0 ? primaryMat : null} wireframe />
        </mesh>
      ))}

      {layout.kind === "shelf" && layout.items.map((e, i) => (
        <group key={`${e.company}-${i}`} position={[(i - 2.5) * 1.4, 0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 1.6, 0.08]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : null} />
          </mesh>
          <mesh position={[0, -0.7, 0.05]}>
            <planeGeometry args={[1.0, 0.12]} />
            <meshStandardMaterial ref={i === 0 ? accentMat : null} />
          </mesh>
        </group>
      ))}

      {layout.kind === "lowpoly" && layout.items.map((s, i) => {
        const angle = (i / layout.items.length) * Math.PI * 2;
        const r = 3;
        return (
          <mesh key={s.name} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]} castShadow>
            <icosahedronGeometry args={[0.4 + (s.proficiency / 100) * 0.5, 0]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : i === 1 ? accentMat : null} />
          </mesh>
        );
      })}

      {layout.kind === "grid" &&
        Array.from({ length: 11 }).map((_, x) => (
          Array.from({ length: 11 }).map((_, z) => (
            <mesh key={`${x}_${z}`} position={[x - 5, -0.45, z - 5]}>
              <boxGeometry args={[0.85, 0.04, 0.85]} />
              <meshStandardMaterial
                ref={x === 0 && z === 0 ? primaryMat : null}
                emissiveIntensity={0.4}
              />
            </mesh>
          ))
        )).flat()}

      {layout.kind === "ring" && layout.items.map((s, i) => {
        const angle = (i / layout.items.length) * Math.PI * 2;
        return (
          <mesh key={s.name} position={[Math.cos(angle) * 3.4, Math.sin(angle * 2) * 0.3, Math.sin(angle) * 3.4]} castShadow>
            <torusGeometry args={[0.18 + (s.proficiency / 100) * 0.2, 0.05, 12, 24]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : i === 1 ? accentMat : null} />
          </mesh>
        );
      })}

      {layout.kind === "monolith" && (
        <mesh castShadow position={[0, 1.8, 0]}>
          <boxGeometry args={[1.2, 3.6, 0.4]} />
          <meshStandardMaterial ref={primaryMat} />
        </mesh>
      )}

      {layout.kind === "spiral" && layout.items.map((e, i) => {
        const angle = (i / Math.max(layout.items.length, 1)) * Math.PI * 4;
        const r = 2 + i * 0.25;
        return (
          <mesh key={`${e.company}-${i}`} position={[Math.cos(angle) * r, i * 0.25, Math.sin(angle) * r]} castShadow>
            <boxGeometry args={[0.8, 0.6, 0.08]} />
            <meshStandardMaterial ref={i === 0 ? primaryMat : null} />
          </mesh>
        );
      })}
    </group>
  );
}
