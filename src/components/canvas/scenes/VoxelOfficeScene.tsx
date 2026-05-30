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

export function VoxelOfficeScene({ controller, cv }: Props) {
  const groupRef = useRef<Group>(null);
  const floorMat = useRef<MeshStandardMaterial>(null);
  const accentMat = useRef<MeshStandardMaterial>(null);
  const cardMat = useRef<MeshStandardMaterial>(null);

  useManagedMaterial(controller, floorMat, "secondary");
  useManagedMaterial(controller, accentMat, "accent");
  useManagedMaterial(controller, cardMat, "primary");

  const tiles = useMemo(() => {
    const out: Array<{ key: string; x: number; z: number; h: number }> = [];
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        out.push({
          key: `${x}_${z}`,
          x,
          z,
          h: 0.08 + ((x * 7 + z * 13 + 100) % 5) * 0.04,
        });
      }
    }
    return out;
  }, []);

  const cards = useMemo(
    () =>
      cv.experience.slice(0, 6).map((e, i) => ({
        x: ((i % 3) - 1) * 2.4,
        z: Math.floor(i / 3) * 2.4 - 1.2,
        y: 1.2 + (i % 2) * 0.4,
        role: e.role,
        company: e.company,
      })),
    [cv.experience],
  );

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {tiles.map((t) => (
        <mesh key={t.key} position={[t.x, -0.5 + t.h / 2, t.z]} castShadow receiveShadow>
          <boxGeometry args={[0.95, t.h, 0.95]} />
          <meshStandardMaterial ref={t === tiles[0] ? floorMat : null} />
        </mesh>
      ))}
      {cards.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1, 0.08]} />
            <meshStandardMaterial ref={i === 0 ? cardMat : null} />
          </mesh>
          <mesh position={[0, 0.42, 0.05]}>
            <planeGeometry args={[1.4, 0.12]} />
            <meshStandardMaterial ref={i === 0 ? accentMat : null} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
