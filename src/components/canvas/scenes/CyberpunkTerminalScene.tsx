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

export function CyberpunkTerminalScene({ controller, cv }: Props) {
  const root = useRef<Group>(null);
  const scanlines = useRef<Group>(null);
  const monitor = useRef<MeshStandardMaterial>(null);
  const accent = useRef<MeshStandardMaterial>(null);
  const ground = useRef<MeshStandardMaterial>(null);

  useManagedMaterial(controller, monitor, "primary");
  useManagedMaterial(controller, accent, "accent");
  useManagedMaterial(controller, ground, "secondary");

  const skills = useMemo(() => cv.skills.slice(0, 10), [cv.skills]);

  useFrame((state) => {
    if (scanlines.current) {
      scanlines.current.position.y =
        ((state.clock.elapsedTime * 0.6) % 2) - 1;
    }
    if (root.current) {
      root.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.2;
    }
  });

  return (
    <group ref={root}>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[20, 0.04, 20]} />
        <meshStandardMaterial ref={ground} />
      </mesh>

      {/* terminal */}
      <group position={[0, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2.4, 1.8, 0.18]} />
          <meshStandardMaterial ref={monitor} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[2.2, 1.6]} />
          <meshBasicMaterial color="#0a0c14" />
        </mesh>
        <group ref={scanlines} position={[0, 0, 0.105]}>
          {Array.from({ length: 16 }).map((_, i) => (
            <mesh key={i} position={[0, -0.8 + (i / 16) * 1.6, 0]}>
              <planeGeometry args={[2.18, 0.02]} />
              <meshStandardMaterial ref={i === 0 ? accent : null} transparent opacity={0.35} />
            </mesh>
          ))}
        </group>
      </group>

      {/* floating skill bars */}
      {skills.map((s, i) => {
        const angle = (i / skills.length) * Math.PI * 2;
        const r = 3.5;
        const h = 0.4 + (s.proficiency / 100) * 2.4;
        return (
          <mesh key={s.name} position={[Math.cos(angle) * r, -0.5 + h / 2, Math.sin(angle) * r]} castShadow>
            <boxGeometry args={[0.35, h, 0.35]} />
            <meshStandardMaterial ref={i === 0 ? accent : null} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}
