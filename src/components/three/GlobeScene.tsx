import { useFrame, useThree } from '@react-three/fiber';
import { Fragment, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Group,
  Mesh,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { EARTH_TEXTURE_SOURCES, DEFAULT_TEXTURE_QUALITY } from '@/lib/config/earth-textures';
import type { TelemetryState } from '@/lib/types/telemetry';

export interface GlobeSceneProps {
  telemetry: TelemetryState | null;
  showGroundTrack: boolean;
  autoRotate: boolean;
}

interface EarthTextures {
  day: Texture | null;
  night: Texture | null;
  bump: Texture | null;
  clouds: Texture | null;
}

const INITIAL_TEXTURES: EarthTextures = {
  day: null,
  night: null,
  bump: null,
  clouds: null,
};

const EARTH_RADIUS_UNITS = 1.35;

const textureSources = EARTH_TEXTURE_SOURCES[DEFAULT_TEXTURE_QUALITY];
const EARTH_TEXTURE_URL = textureSources.day;
const EARTH_NIGHT_URL = textureSources.night;
const EARTH_BUMP_URL = textureSources.bump;
const EARTH_CLOUDS_URL = textureSources.clouds;

function tuneColourTexture(texture?: Texture | null, anisotropy = 16) {
  if (!texture) return;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
}

function tuneDataTexture(texture?: Texture | null, anisotropy = 8) {
  if (!texture) return;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
}

function useEarthTextures(maxAnisotropy: number): EarthTextures {
  const [textures, setTextures] = useState<EarthTextures>(INITIAL_TEXTURES);

  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    loader.crossOrigin = 'anonymous';

    const loadTexture = async (
      url: string | null | undefined,
      tune?: (texture: Texture) => void,
    ): Promise<Texture | null> => {
      if (!url) return null;
      try {
        const texture = await loader.loadAsync(url);
        tune?.(texture);
        return texture;
      } catch (error) {
        console.warn(`Failed to load texture at ${url}`, error);
        return null;
      }
    };

    (async () => {
      const anisotropyColour = Math.max(1, Math.min(maxAnisotropy, 32));
      const anisotropyData = Math.max(1, Math.min(maxAnisotropy, 16));
      const anisotropyNight = Math.max(1, Math.min(maxAnisotropy, Math.round(anisotropyColour * 0.75)));
      const anisotropyClouds = Math.max(1, Math.min(maxAnisotropy, Math.round(anisotropyColour * 0.6)));

      const [day, night, bump, clouds] = await Promise.all([
        loadTexture(EARTH_TEXTURE_URL, (texture) => tuneColourTexture(texture, anisotropyColour)),
        loadTexture(EARTH_NIGHT_URL, (texture) => tuneColourTexture(texture, anisotropyNight)),
        loadTexture(EARTH_BUMP_URL, (texture) => tuneDataTexture(texture, anisotropyData)),
        loadTexture(EARTH_CLOUDS_URL, (texture) => tuneColourTexture(texture, anisotropyClouds)),
      ]);

      if (!cancelled) {
        setTextures({
          day,
          night,
          bump,
          clouds,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [maxAnisotropy]);

  return textures;
}

function useProceduralCloudTexture() {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = 'rgba(255,255,255,0)';
    context.fillRect(0, 0, size, size);

    for (let i = 0; i < 1800; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = Math.random() * 40 + 12;

      const gradient = context.createRadialGradient(x, y, radius * 0.25, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.7)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');

      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.anisotropy = 8;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
  }, []);
}

function EarthMesh({
  textures,
  environment,
}: {
  textures: EarthTextures;
  environment: Texture;
}) {
  const { day, night, bump } = textures;
  const emissiveColour = useMemo(() => new Color('#0b172a'), []);

  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS_UNITS, 128, 128]} />
      <meshStandardMaterial
        map={day ?? undefined}
        envMap={environment}
        envMapIntensity={0.12}
        roughness={0.82}
        metalness={0.02}
        emissive={emissiveColour}
        emissiveMap={night ?? undefined}
        emissiveIntensity={night ? 0.42 : 0.1}
        bumpMap={bump ?? undefined}
        bumpScale={bump ? 0.008 : 0}
        toneMapped
      />
    </mesh>
  );
}

function CloudLayer({
  radius,
  cloudRef,
  texture,
}: {
  radius: number;
  cloudRef: MutableRefObject<Mesh | null>;
  texture: Texture | null;
}) {
  const proceduralTexture = useProceduralCloudTexture();
  const cloudTexture = texture ?? proceduralTexture;

  if (!cloudTexture) return null;

  return (
    <mesh ref={cloudRef} scale={[1.01, 1.01, 1.01]}>
      <sphereGeometry args={[radius * 1.02, 128, 128]} />
      <meshPhongMaterial
        map={cloudTexture}
        transparent
        opacity={0.32}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

export type GlobeSceneHandle = {
  resetOrientation: () => void;
};

export const GlobeScene = forwardRef<GlobeSceneHandle, GlobeSceneProps>(function GlobeScene(
  { telemetry, showGroundTrack, autoRotate },
  ref,
) {
  const { gl } = useThree();
  const maxAnisotropy = useMemo(() => {
    const getter = gl.capabilities.getMaxAnisotropy?.bind(gl.capabilities);
    if (!getter) return 8;
    const value = getter();
    return value && Number.isFinite(value) ? value : 8;
  }, [gl]);
  const earthTextures = useEarthTextures(maxAnisotropy);
  const globeGroupRef = useRef<Group | null>(null);
  const cloudRef = useRef<Mesh | null>(null);
  const sunLightRef = useRef<DirectionalLight>(null);
  const roomEnvironment = useMemo(() => new RoomEnvironment(), []);

  const environmentMap = useMemo(() => {
    const generator = new PMREMGenerator(gl);
    const { texture } = generator.fromScene(roomEnvironment, 0.04);
    generator.dispose();
    return texture;
  }, [gl, roomEnvironment]);

  useEffect(
    () => () => {
      environmentMap.dispose();
    },
    [environmentMap],
  );

  useFrame((state, delta) => {
    if (autoRotate && globeGroupRef.current) {
      globeGroupRef.current.rotation.y += delta * 0.12;
    }
    if (autoRotate && cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.18;
    }
    if (sunLightRef.current) {
      const elapsed = state.clock.elapsedTime;
      const orbitRadius = 6;
      const orbitSpeed = 0.05;
      const sunX = Math.cos(elapsed * orbitSpeed) * orbitRadius;
      const sunZ = Math.sin(elapsed * orbitSpeed) * orbitRadius;
      const sunY = Math.sin(elapsed * orbitSpeed * 0.6) * 2 + 2.5;
      sunLightRef.current.position.set(sunX, sunY, sunZ);
      sunLightRef.current.lookAt(0, 0, 0);
    }
  });

  const issPosition = useMemo(() => {
    if (!telemetry) return null;
    const { latitude, longitude } = telemetry.envelope.data;
    return latLonToVector3(latitude, longitude, EARTH_RADIUS_UNITS + 0.05);
  }, [telemetry]);

  useImperativeHandle(
    ref,
    () => ({
      resetOrientation: () => {
        if (globeGroupRef.current) {
          globeGroupRef.current.rotation.set(0, 0, 0);
        }
        if (cloudRef.current) {
          cloudRef.current.rotation.set(0, 0, 0);
        }
      },
    }),
    [],
  );

  return (
    <group>
      <ambientLight intensity={0.25} color={new Color('#f1f5f9')} />
      <hemisphereLight intensity={0.3} color={new Color('#e0f2fe')} groundColor={new Color('#0f172a')} />
      <directionalLight
        ref={sunLightRef}
        color={new Color('#fde68a')}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <group ref={globeGroupRef}>
        <EarthMesh textures={earthTextures} environment={environmentMap} />
        <CloudLayer radius={EARTH_RADIUS_UNITS} cloudRef={cloudRef} texture={earthTextures.clouds} />

        {telemetry ? (
          <Fragment>
            <IssMarker position={issPosition} />
            {showGroundTrack ? (
              <GroundTrack
                latitude={telemetry.envelope.data.latitude}
                longitude={telemetry.envelope.data.longitude}
              />
            ) : null}
          </Fragment>
        ) : null}

        <Atmosphere glowColour="#38bdf8" radius={EARTH_RADIUS_UNITS} />
      </group>
    </group>
  );
});

function latLonToVector3(lat: number, lon: number, radius: number): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

function IssMarker({ position }: { position: Vector3 | null }) {
  const trussColour = useMemo(() => new Color('#e2e8f0'), []);
  const radiatorColour = useMemo(() => new Color('#d7e0f5'), []);
  const arrayColour = useMemo(() => new Color('#1e293b'), []);
  const arrayGlow = useMemo(() => new Color('#1e3a8a'), []);
  const navGlow = useMemo(() => new Color('#38bdf8'), []);

  if (!position) return null;

  return (
    <group position={position.toArray()}>
      <group scale={[0.05, 0.05, 0.05]}>
        <mesh>
          <boxGeometry args={[3.6, 0.18, 0.18]} />
          <meshStandardMaterial color={trussColour} roughness={0.7} metalness={0.12} />
        </mesh>

        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.8, 18]} />
          <meshStandardMaterial color={trussColour} roughness={0.65} metalness={0.1} />
        </mesh>

        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[1.1, 0.22, 0.22]} />
          <meshStandardMaterial color={radiatorColour} roughness={0.8} metalness={0.05} />
        </mesh>

        <mesh position={[1.85, 0, 0]}>
          <boxGeometry args={[3.4, 0.05, 1.1]} />
          <meshStandardMaterial
            color={arrayColour}
            emissive={arrayGlow}
            emissiveIntensity={0.18}
            roughness={0.9}
            metalness={0.04}
          />
        </mesh>
        <mesh position={[-1.85, 0, 0]}>
          <boxGeometry args={[3.4, 0.05, 1.1]} />
          <meshStandardMaterial
            color={arrayColour}
            emissive={arrayGlow}
            emissiveIntensity={0.18}
            roughness={0.9}
            metalness={0.04}
          />
        </mesh>

        <mesh position={[0, 0, 0.42]}>
          <boxGeometry args={[1.4, 0.08, 0.16]} />
          <meshStandardMaterial color={radiatorColour} roughness={0.82} metalness={0.06} />
        </mesh>

        <mesh position={[0, 0, -0.42]}>
          <boxGeometry args={[1.4, 0.08, 0.16]} />
          <meshStandardMaterial color={radiatorColour} roughness={0.82} metalness={0.06} />
        </mesh>

        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={trussColour} roughness={0.7} metalness={0.1} />
        </mesh>
      </group>

      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={navGlow} transparent opacity={0.22} side={BackSide} />
      </mesh>
      <pointLight color={navGlow} intensity={0.45} distance={1.6} decay={1.2} />
    </group>
  );
}

function GroundTrack({ latitude, longitude }: { latitude: number; longitude: number }) {
  const segments = useMemo(() => generateGroundTrack(latitude, longitude), [latitude, longitude]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(segments.flatMap((vector) => vector.toArray())), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={new Color('#0ea5e9')} linewidth={1} transparent opacity={0.8} />
    </line>
  );
}

function generateGroundTrack(lat: number, lon: number) {
  const positions: Vector3[] = [];
  const radius = EARTH_RADIUS_UNITS + 0.01;
  for (let i = -90; i <= 90; i += 3) {
    const latOffset = lat + i;
    const lonOffset = lon + i * 1.5;
    const clampedLat = Math.max(-89.9, Math.min(89.9, latOffset));
    const wrappedLon = ((lonOffset + 540) % 360) - 180;
    positions.push(latLonToVector3(clampedLat, wrappedLon, radius));
  }
  return positions;
}

function Atmosphere({ glowColour, radius }: { glowColour: string; radius: number }) {
  const [innerColour, outerColour] = useMemo(() => {
    const base = new Color(glowColour);
    const inner = base.clone().lerp(new Color('#f0f9ff'), 0.45);
    const outer = base.clone().lerp(new Color('#0ea5e9'), 0.25);
    return [inner, outer];
  }, [glowColour]);

  return (
    <group>
      <mesh scale={[1.04, 1.04, 1.04]}>
        <sphereGeometry args={[radius, 128, 128]} />
        <meshBasicMaterial color={innerColour} transparent opacity={0.06} side={BackSide} />
      </mesh>
      <mesh scale={[1.12, 1.12, 1.12]}>
        <sphereGeometry args={[radius, 128, 128]} />
        <meshBasicMaterial
          color={outerColour}
          transparent
          opacity={0.12}
          blending={AdditiveBlending}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
