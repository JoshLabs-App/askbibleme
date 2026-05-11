"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sacredAtmosphereScalarsFromPreset } from "@/music-visual/effects/sacred-atmosphere-preset";
import type { HomeAtmospherePresetId } from "@/music-visual/presets/home-atmosphere";
import { getMusicVisualAtmospherePresetForHome } from "@/music-visual/presets/home-atmosphere";
import { useHomeAtmosphereVisualOptional } from "@/music-visual/providers/HomeAtmosphereVisualContext";
import { useMusicShellVisual } from "@/music-visual/providers/MusicShellVisualContext";
import { useMusicVisualTuning } from "@/music-visual/providers/MusicVisualTuningContext";
import { SACRED_ATMOSPHERE_FRAGMENT } from "@/music-visual/shader/sacred-atmosphere.frag";
import { SACRED_ATMOSPHERE_VERTEX } from "@/music-visual/shader/sacred-atmosphere.vert";
import { createSacredAtmosphereUniforms } from "@/music-visual/uniforms/sacred-atmosphere";

type SceneProps = { homeAtmospherePresetId: HomeAtmospherePresetId };

function SacredAtmosphereScene({ homeAtmospherePresetId }: SceneProps) {
  const { driveRef } = useMusicShellVisual();
  const { tuning } = useMusicVisualTuning();
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const [uStill, setUStill] = useState(0);

  const atmosphereScalars = useMemo(() => {
    const preset = getMusicVisualAtmospherePresetForHome(homeAtmospherePresetId);
    return sacredAtmosphereScalarsFromPreset(preset);
  }, [homeAtmospherePresetId]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setUStill(mq.matches ? 1 : 0);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const uniforms = useMemo(() => createSacredAtmosphereUniforms(), []);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    const d = driveRef.current;
    const s = atmosphereScalars;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uRms.value = d.rms;
    m.uniforms.uLow.value = d.low;
    m.uniforms.uMid.value = d.mid;
    m.uniforms.uHigh.value = d.high;
    m.uniforms.uStill.value = uStill;
    m.uniforms.uMaster.value = tuningRef.current.master;
    m.uniforms.uFogSpeedMul.value = s.fogSpeedMul;
    m.uniforms.uGlowWeightMul.value = s.glowWeightMul;
    m.uniforms.uParticleDensityMul.value = s.particleDensityMul;
  });

  return (
    <>
      <OrthographicCamera makeDefault left={-1} right={1} top={1} bottom={-1} near={0.1} far={10} position={[0, 0, 2]} />
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={SACRED_ATMOSPHERE_VERTEX}
          fragmentShader={SACRED_ATMOSPHERE_FRAGMENT}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </>
  );
}

export type SacredAtmosphereCanvasProps = {
  /** 若省略，则读 `HomeAtmosphereVisualProvider`（与壳层 CSS 同源） */
  homeAtmospherePresetId?: HomeAtmospherePresetId;
};

/** Selah Sacred Atmosphere：全屏雾与顶光，与预计算 JSON 同源 `driveRef`；仅作氛围层，不接管 UI。 */
export function SacredAtmosphereCanvas({ homeAtmospherePresetId: homeIdProp }: SacredAtmosphereCanvasProps) {
  const ctx = useHomeAtmosphereVisualOptional();
  const resolvedHomeId = homeIdProp ?? ctx?.homeAtmospherePresetId ?? "lagoon";
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio ?? 1, 2));
  }, []);

  return (
    <Canvas
      className="h-full w-full touch-none"
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      dpr={dpr}
    >
      <SacredAtmosphereScene homeAtmospherePresetId={resolvedHomeId} />
    </Canvas>
  );
}
