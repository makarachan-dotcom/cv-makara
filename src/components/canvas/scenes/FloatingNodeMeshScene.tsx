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

export function FloatingNodeMeshScene({ controller, cv }: Props) {
  const root = useRef<Group>(null);
  const nodeMat = useRef<MeshStandardMaterial>(null);
  const edgeMat = useRef<MeshStandardMaterial>(null);
  const accentMat = useRef<MeshStandardMaterial>(null);

  useManagedMaterial(controller, nodeMat, "primary");
  useManagedMaterial(controller, edgeMat, "secondary");
  useManagedMaterial(controller, accentMat, "accent");

  const nodes = useMemo(() => {
    return cv.skills.slice(0, 24).map((s, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(cv.skills.length, 24));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 2.4 + (s.proficiency / 100) * 1.6;
      return {
        key: s.name,
        x: Math.sin(phi) * Math.cos(theta) * r,
        y: Math.sin(phi) * Math.sin(theta) * r,
        z: Math.cos(phi) * r,
        size: 0.1 + (s.proficiency / 100) * 0.18,
      };
    });
  }, [cv.skills]);

  const edges = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        if (d2 < 4) out.push([i, j]);
      }
    }
    return out;
  }, [nodes]);

  useFrame((state) => {
    if (root.current) {
      root.current.rotation.y = state.clock.elapsedTime * 0.12;
      root.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.2;
    }
  });

  return (
    <group ref={root}>
      {nodes.map((n, i) => (
        <mesh key={n.key} position={[n.x, n.y, n.z]} castShadow>
          <icosahedronGeometry args={[n.size, 1]} />
          <meshStandardMaterial ref={i === 0 ? nodeMat : i === 1 ? accentMat : null} />
        </mesh>
      ))}
      {edges.map(([i, j], k) => {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const mz = (a.z + b.z) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        const yaw = Math.atan2(dx, dz);
        const pitch = Math.asin(dy / len);
        return (
          <mesh key={k} position={[mx, my, mz]} rotation={[pitch, yaw, 0]}>
            <cylinderGeometry args={[0.015, 0.015, len, 4]} />
            <meshStandardMaterial ref={k === 0 ? edgeMat : null} transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
