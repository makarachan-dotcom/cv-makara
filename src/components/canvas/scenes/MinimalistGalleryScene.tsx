"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { useManagedMaterial } from "../SceneBindings";
import type { SceneController } from "../SceneController";
import type { CVInput } from "@/types/cv";

interface Props {
  controller: SceneController;
  cv: CVInput;
}

export function MinimalistGalleryScene({ controller, cv }: Props) {
  const root = useRef<Group>(null);
  const wallMat = useRef<MeshStandardMaterial>(null);
  const frameMat = useRef<MeshStandardMaterial>(null);
  const accentMat = useRef<MeshStandardMaterial>(null);

  useManagedMaterial(controller, wallMat, "secondary");
  useManagedMaterial(controller, frameMat, "primary");
  useManagedMaterial(controller, accentMat, "accent");

  const panels = useMemo(() => {
    const items: Array<{ key: string; angle: number; label: string }> = [];
    const sources = [
      ...cv.experience.map((e) => `${e.role} @ ${e.company}`),
      ...cv.projects.map((p) => p.name),
    ].slice(0, 8);
    sources.forEach((label, i) => {
      const angle = (i / Math.max(sources.length, 1)) * Math.PI * 2;
      items.push({ key: `${i}_${label}`, angle, label });
    });
    return items;
  }, [cv.experience, cv.projects]);

  useFrame((state) => {
    if (root.current) {
      root.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={root}>
      <mesh receiveShadow position={[0, -0.51, 0]}>
        <cylinderGeometry args={[6, 6, 0.04, 64]} />
        <meshStandardMaterial ref={wallMat} />
      </mesh>
      {panels.map((p, i) => (
        <group key={p.key} position={[Math.cos(p.angle) * 4, 0.8, Math.sin(p.angle) * 4]} rotation={[0, -p.angle + Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 2.2, 0.06]} />
            <meshStandardMaterial ref={i === 0 ? frameMat : null} />
          </mesh>
          <mesh position={[0, -0.9, 0.04]}>
            <planeGeometry args={[1.4, 0.18]} />
            <meshStandardMaterial ref={i === 0 ? accentMat : null} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
