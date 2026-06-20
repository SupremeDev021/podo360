import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { RefreshCw, Rotate3D } from "lucide-react";
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Euler, Vector3 } from "three";
import { footRegionDefinitions, legacyFootRegionMap, withFootSide } from "../data/footRegionMap";
import type { FootCoordinate } from "../data/footRegionMap";
import type { FootSide } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot-clickable.glb?v=20260617-clickable-5`;

export type FootRegionSelection = {
  foot_side: FootSide;
  region_key: string;
  region_label: string;
  mesh_name?: string;
  coordinates?: {
    x: number;
    y: number;
    z: number;
  };
};

type FootRegionSelector3DProps = {
  footSide: FootSide;
  value?: FootRegionSelection | null;
  onChange: (selection: FootRegionSelection) => void;
  disabled?: boolean;
  title?: string;
  helperText?: string;
};

class FootRegionSelectorErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function SelectorFootModel({ footSide, onRegionClick }: { footSide: FootSide; onRegionClick: (event: ThreeEvent<PointerEvent>) => void }) {
  const { scene } = useGLTF(FOOT_MODEL_URL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      const modelObject = object as {
        name: string;
        visible: boolean;
        raycast?: (...args: unknown[]) => void;
        material?: unknown;
        userData?: Record<string, unknown>;
      };
      if (isFootClickZone(modelObject.name, modelObject.userData)) {
        const region = getFootRegionFromObjectName(modelObject.name, footSide, modelObject.userData);
        if (region) {
          modelObject.visible = true;
          configureInvisibleClickMaterial(modelObject.material);
        } else {
          modelObject.raycast = () => undefined;
          modelObject.visible = false;
        }
      }
    });
    return clone;
  }, [footSide, scene]);

  return <primitive object={model} onPointerDown={onRegionClick} position={[0, 0, 0]} scale={1.05} />;
}

function SelectorFallbackFoot() {
  return (
    <>
      <mesh position={[0.12, 0, 0.03]} scale={[1.45, 0.72, 0.34]}>
        <sphereGeometry args={[0.82, 40, 22]} />
        <meshStandardMaterial color="#c99063" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0.72, 0, 0.12]} scale={[0.72, 0.66, 0.58]}>
        <sphereGeometry args={[0.62, 32, 18]} />
        <meshStandardMaterial color="#b87852" roughness={0.75} />
      </mesh>
    </>
  );
}

function FootRegionMarker({ position, label }: { position: FootCoordinate; label: string }) {
  return (
    <group position={position}>
      <mesh renderOrder={22}>
        <sphereGeometry args={[0.05, 24, 16]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.68} transparent opacity={0.96} depthTest={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={21}>
        <torusGeometry args={[0.085, 0.007, 10, 40]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.46} transparent opacity={0.84} depthTest={false} />
      </mesh>
      <Html distanceFactor={7} position={[0, 0.04, 0.1]}>
        <span className="foot-region-marker-label">{label}</span>
      </Html>
    </group>
  );
}

export function FootRegionSelector3D({
  footSide,
  value,
  onChange,
  disabled = false,
  title = "Local da ferida / alteração acompanhada",
  helperText = "Clique diretamente no pé 3D ou use o fallback por seleção."
}: FootRegionSelector3DProps) {
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const regions = useMemo(() => footRegionDefinitions.map((region) => withFootSide(region, footSide)), [footSide]);
  const selectedRegion = useMemo(() => {
    if (!value?.region_key) return null;
    return regions.find((region) => region.regionKey === value.region_key) ?? null;
  }, [regions, value?.region_key]);
  const markerPosition = useMemo(() => {
    if (value?.coordinates) return [value.coordinates.x, value.coordinates.y, value.coordinates.z] as FootCoordinate;
    if (selectedRegion) return toWorldFootPoint(selectedRegion.position, footSide);
    return null;
  }, [footSide, selectedRegion, value?.coordinates]);

  useEffect(() => {
    setMessage(null);
  }, [footSide]);

  function resetCamera() {
    controlsRef.current?.reset();
  }

  function selectRegion(regionKey: string, coordinates?: FootCoordinate, meshName?: string) {
    const region = regions.find((item) => item.regionKey === regionKey);
    if (!region) return;
    onChange({
      foot_side: footSide,
      region_key: region.regionKey,
      region_label: region.displayLabel,
      mesh_name: meshName,
      coordinates: coordinates ? { x: coordinates[0], y: coordinates[1], z: coordinates[2] ?? 0 } : undefined
    });
    setMessage(`${region.displayLabel} selecionado.`);
  }

  function handleRegionClick(event: ThreeEvent<PointerEvent>) {
    if (disabled) return;
    const hit = event.intersections.find((intersection) =>
      getFootRegionFromObjectName(intersection.object.name, footSide, intersection.object.userData as Record<string, unknown> | undefined)
    );
    if (!hit) {
      if (event.intersections.length) setMessage("Essa área ainda não está mapeada. Use o fallback por seleção.");
      return;
    }
    const region = getFootRegionFromObjectName(hit.object.name, footSide, hit.object.userData as Record<string, unknown> | undefined);
    if (!region) return;
    event.stopPropagation();
    selectRegion(region.regionKey, [hit.point.x, hit.point.y, hit.point.z], hit.object.name);
  }

  return (
    <section className="foot-region-selector">
      <div className="section-heading section-heading--compact">
        <div>
          <h3>{title}</h3>
          <p>{helperText}</p>
        </div>
      </div>

      <div className="body-map__toolbar">
        <strong className="foot-region-selector__side">{footSide === "right" ? "Pé direito" : "Pé esquerdo"}</strong>
        <div className="foot-map-actions">
          <span className="foot-map-hint"><Rotate3D size={16} /> Girar e aproximar</span>
          <button className="ghost-button ghost-button--dark" onClick={resetCamera} type="button">
            <RefreshCw size={16} />
            Resetar câmera
          </button>
        </div>
      </div>

      <div className="foot-canvas foot-canvas--compact" aria-label="Pé 3D para local da ferida">
        <Canvas camera={{ position: [0, -4.55, 2.55], fov: 44 }} onWheel={(event) => event.stopPropagation()} style={{ touchAction: "none" }}>
          <ambientLight intensity={0.95} />
          <directionalLight position={[2, -3, 4]} intensity={1.2} />
          <directionalLight position={[-4, 2, 2]} intensity={0.45} />
          <group scale={footSide === "left" ? [-0.92, 0.92, 0.92] : [0.92, 0.92, 0.92]} rotation={[0.12, 0.04, -0.08]}>
            <FootRegionSelectorErrorBoundary fallback={<SelectorFallbackFoot />}>
              <Suspense fallback={<FootRegionSelectorLoading />}>
                <SelectorFootModel footSide={footSide} onRegionClick={handleRegionClick} />
              </Suspense>
            </FootRegionSelectorErrorBoundary>
          </group>
          {markerPosition && value?.region_label && <FootRegionMarker label={value.region_label} position={markerPosition} />}
          <Html fullscreen>
            <div className="foot-viewer-note">Clique na região da ferida ou selecione abaixo.</div>
          </Html>
          <OrbitControls ref={(node) => { controlsRef.current = node; }} enableDamping enablePan={false} enableZoom minDistance={2.8} maxDistance={6.6} />
        </Canvas>
        {message && <div className="foot-viewer-inline-message">{message}</div>}
      </div>

      <div className="foot-region-selector__fallback">
        <label>
          Região do pé
          <select disabled={disabled} value={selectedRegion?.regionKey ?? ""} onChange={(event) => selectRegion(event.target.value)}>
            <option value="">Selecione a região</option>
            {regions.map((region) => (
              <option key={region.regionKey} value={region.regionKey}>{region.clinicalGroup} - {region.displayLabel}</option>
            ))}
          </select>
        </label>
      </div>

      {value?.region_label && <div className="inline-info">Local selecionado: <strong>{value.region_label}</strong></div>}
    </section>
  );
}

function FootRegionSelectorLoading() {
  return (
    <Html center>
      <div className="foot-loading-card">
        <span />
        Carregando pé 3D...
      </div>
    </Html>
  );
}

function isFootClickZone(name: string, userData?: Record<string, unknown>) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return Boolean(getFootRegionKeyFromObjectName(name)) || normalized.includes("click_zone") || userData?.purpose === "foot_click_zone" || userData?.isClickZone === true;
}

function getFootRegionFromObjectName(name: string, footSide: FootSide, userData?: Record<string, unknown>) {
  const regionKey = getFootRegionKeyFromObjectName(name) ?? (typeof userData?.regionKey === "string" ? userData.regionKey : null);
  if (!regionKey) return null;
  const sidePrefix = footSide === "right" ? "right_" : "left_";
  if (!regionKey.startsWith(sidePrefix)) return null;
  const baseKey = regionKey.replace(/^(right|left)_/, "");
  const definition = footRegionDefinitions.find((region) => region.baseKey === baseKey);
  return definition ? withFootSide(definition, footSide) : null;
}

function getFootRegionKeyFromObjectName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\.\d+$/, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/_mesh$/, "")
    .replace(/_click_zone$/, "");
  const match = normalized.match(/^(right|left)_(.+)$/);
  if (!match) return null;
  const baseKey = legacyFootRegionMap[match[2]] ?? match[2];
  return footRegionDefinitions.some((region) => region.baseKey === baseKey) ? `${match[1]}_${baseKey}` : null;
}

function configureInvisibleClickMaterial(material: unknown) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    const mat = item as {
      transparent?: boolean;
      opacity?: number;
      depthWrite?: boolean;
      colorWrite?: boolean;
      visible?: boolean;
      needsUpdate?: boolean;
    } | null | undefined;
    if (!mat) return;
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    mat.colorWrite = false;
    mat.visible = true;
    mat.needsUpdate = true;
  });
}

function toWorldFootPoint(point: FootCoordinate, footSide: FootSide): FootCoordinate {
  const vector = new Vector3(point[0], point[1], point[2] ?? 0);
  vector.multiplyScalar(1.05);
  if (footSide === "left") vector.x *= -1;
  vector.applyEuler(new Euler(0.12, 0.04, -0.08));
  return [vector.x, vector.y, vector.z];
}

useGLTF.preload(FOOT_MODEL_URL);
