import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Pencil, RefreshCw, Rotate3D, Save, Trash2 } from "lucide-react";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  footRegionDefinitions,
  legacyFootRegionMap,
  meshNameFootRegionMap,
  withFootSide,
  type FootCoordinate,
  type SideAwareFootRegion
} from "../data/footRegionMap";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot-segmented.glb`;

type RaycastPoint = ThreeEvent<PointerEvent>["point"];
type RaycastGroup = {
  worldToLocal: (point: RaycastPoint) => RaycastPoint;
};

type FootSensitivityMap3DProps = {
  entries: FootSensitivityMap[];
  onSave: (entry: Omit<FootSensitivityMap, "id" | "createdAt"> & { id?: string }) => Promise<void> | void;
  onRemove?: (entryId: string) => Promise<void> | void;
  patientId: string;
  companyId: string;
  professionalId: string;
  attendanceId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
};

const statusColor: Record<SensitivityStatus, string> = {
  present: "#22c55e",
  reduced: "#f59e0b",
  absent: "#ef4444",
  not_tested: "#94a3b8"
};

class FootModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function FootGlbModel({
  footSide,
  onModelPointerDown,
  onModelPointerMove,
  onModelPointerOut
}: {
  footSide: FootSide;
  onModelPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onModelPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onModelPointerOut: () => void;
}) {
  const { scene } = useGLTF(FOOT_MODEL_URL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      const clickable = object as {
        name: string;
        visible: boolean;
        material?: unknown;
        userData?: Record<string, unknown>;
      };
      const zoneSide = getClickZoneSide(clickable.name, clickable.userData);
      if (!zoneSide) return;
      clickable.visible = zoneSide === footSide;
      configureInvisibleZoneMaterial(clickable.material);
    });
    return clone;
  }, [footSide, scene]);

  return (
    <primitive
      object={model}
      onPointerDown={onModelPointerDown}
      onPointerMove={onModelPointerMove}
      onPointerOut={onModelPointerOut}
      position={[0, 0, 0]}
      scale={1.05}
    />
  );
}

function FallbackFootMesh() {
  return (
    <>
      <mesh position={[0.12, 0, 0.03]} scale={[1.45, 0.72, 0.34]}>
        <sphereGeometry args={[0.82, 40, 22]} />
        <meshStandardMaterial color="#c99063" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0.12, 0, 0.04]} scale={[1.47, 0.74, 0.35]}>
        <sphereGeometry args={[0.825, 24, 14]} />
        <meshStandardMaterial color="#24313a" wireframe transparent opacity={0.28} />
      </mesh>
      <mesh position={[0.72, 0, 0.12]} scale={[0.72, 0.66, 0.58]}>
        <sphereGeometry args={[0.62, 32, 18]} />
        <meshStandardMaterial color="#b87852" roughness={0.75} />
      </mesh>
      <mesh position={[1.18, 0, 0.86]} scale={[0.58, 0.52, 1.35]}>
        <cylinderGeometry args={[0.36, 0.5, 1.35, 34]} />
        <meshStandardMaterial color="#b77b53" roughness={0.7} />
      </mesh>
      <mesh position={[1.18, 0, 0.86]} scale={[0.59, 0.53, 1.36]}>
        <cylinderGeometry args={[0.36, 0.5, 1.35, 18]} />
        <meshStandardMaterial color="#25313b" wireframe transparent opacity={0.24} />
      </mesh>
    </>
  );
}

export function FootSensitivityMap3D({
  entries,
  onSave,
  onRemove,
  patientId,
  companyId,
  professionalId,
  attendanceId,
  uniqueMedicalRecordId,
  uniqueRecordNumber,
  baNumber
}: FootSensitivityMap3DProps) {
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const modelGroupRef = useRef<RaycastGroup | null>(null);
  const [footSide, setFootSide] = useState<FootSide>("right");
  const [selectedKey, setSelectedKey] = useState("hallux");
  const [selectedCoordinates, setSelectedCoordinates] = useState<FootCoordinate | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const sideRegions = useMemo(() => footRegionDefinitions.map((region) => withFootSide(region, footSide)), [footSide]);
  const selected = useMemo(() => sideRegions.find((region) => region.baseKey === selectedKey) ?? sideRegions[0], [selectedKey, sideRegions]);
  const hovered = useMemo(() => sideRegions.find((region) => region.baseKey === hoveredKey) ?? null, [hoveredKey, sideRegions]);
  const entriesForSide = useMemo(() => entries.filter((entry) => entry.footSide === footSide), [entries, footSide]);
  const currentBaEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId === attendanceId), [attendanceId, entriesForSide]);
  const historicalEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId !== attendanceId), [attendanceId, entriesForSide]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [x, y, z] = selectedCoordinates ?? selected.position;
    setSaving(true);
    try {
      await onSave({
        id: editingEntryId ?? undefined,
        companyId,
        patientId,
        uniqueMedicalRecordId,
        attendanceId,
        uniqueRecordNumber,
        baNumber,
        footSide,
        regionKey: selected.regionKey,
        pointKey: selected.pointKey,
        coordinates: { x, y, z },
        sensitivityStatus,
        notes,
        createdBy: professionalId,
        updatedAt: new Date().toISOString()
      });
      setEditingEntryId(null);
      setSelectedCoordinates(null);
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  function resetCamera() {
    controlsRef.current?.reset();
  }

  function readLocalPoint(event: ThreeEvent<PointerEvent>) {
    if (!modelGroupRef.current) return null;
    const localPoint = modelGroupRef.current.worldToLocal(event.point.clone());
    return [localPoint.x, localPoint.y, localPoint.z] as FootCoordinate;
  }

  function selectRegion(region: SideAwareFootRegion, point: FootCoordinate) {
    setSelectedKey(region.baseKey);
    setSelectedCoordinates(point);
    setHoveredKey(region.baseKey);
  }

  function hoverRegion(region: SideAwareFootRegion) {
    setHoveredKey(region.baseKey);
  }

  function handleModelPointerMove(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const meshMappedRegion = getFootRegionFromMeshName(event.object.name, footSide);
    if (meshMappedRegion) hoverRegion(meshMappedRegion);
    else setHoveredKey(null);
  }

  function handleModelPointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const localPoint = readLocalPoint(event);
    if (!localPoint) return;
    const meshMappedRegion = getFootRegionFromMeshName(event.object.name, footSide);
    if (meshMappedRegion) selectRegion(meshMappedRegion, localPoint);
  }

  function handleSideChange(side: FootSide) {
    setFootSide(side);
    setEditingEntryId(null);
    setSelectedCoordinates(null);
    setHoveredKey(null);
    setNotes("");
  }

  function editEntry(entry: FootSensitivityMap) {
    const baseKey = getBaseKeyFromEntry(entry);
    setFootSide(entry.footSide);
    setSelectedKey(baseKey);
    setSelectedCoordinates([entry.coordinates.x, entry.coordinates.y, entry.coordinates.z ?? 0]);
    setSensitivityStatus(entry.sensitivityStatus);
    setNotes(entry.notes || "");
    setEditingEntryId(entry.id);
  }

  async function removeEntry(entryId: string) {
    if (!onRemove) return;
    setRemovingId(entryId);
    try {
      await onRemove(entryId);
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
        setNotes("");
        setSelectedCoordinates(null);
      }
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="foot-map-grid">
      <section className="foot-map-panel">
        <div className="body-map__toolbar">
          <div className="segmented">
            {(["right", "left"] as const).map((side) => (
              <button className={footSide === side ? "is-active" : ""} key={side} onClick={() => handleSideChange(side)} type="button">
                {side === "right" ? "Pé direito" : "Pé esquerdo"}
              </button>
            ))}
          </div>
          <div className="foot-map-actions">
            <span className="foot-map-hint"><Rotate3D size={16} /> Girar, aproximar e arrastar</span>
            <button className="ghost-button ghost-button--dark" onClick={resetCamera} type="button">
              <RefreshCw size={16} />
              Resetar camera
            </button>
          </div>
        </div>

        <div className="foot-canvas" aria-label="Pé 3D para monofilamento">
          <Canvas camera={{ position: [0, -4.2, 2.4], fov: 42 }}>
            <ambientLight intensity={0.95} />
            <directionalLight position={[2, -3, 4]} intensity={1.2} />
            <directionalLight position={[-4, 2, 2]} intensity={0.45} />
            <group ref={(node) => { modelGroupRef.current = node; }} scale={footSide === "left" ? [-1, 1, 1] : [1, 1, 1]} rotation={[0.12, 0.04, -0.08]}>
              <FootModelErrorBoundary fallback={<FallbackFootMesh />}>
                <Suspense fallback={<FootLoading />}>
                  <FootGlbModel
                    footSide={footSide}
                    onModelPointerDown={handleModelPointerDown}
                    onModelPointerMove={handleModelPointerMove}
                    onModelPointerOut={() => {
                      setHoveredKey(null);
                    }}
                  />
                </Suspense>
              </FootModelErrorBoundary>
              {renderSavedMarkers(currentBaEntries, sideRegions, true)}
              {renderSavedMarkers(historicalEntries, sideRegions, false)}
              <RegionHighlight
                color="#67e8f9"
                label={selected.displayLabel}
                region={selected}
                visible
              />
              {hovered && hovered.baseKey !== selected.baseKey ? (
                <RegionHighlight
                  color="#bae6fd"
                  label={hovered.displayLabel}
                  region={hovered}
                  visible
                />
              ) : null}
            </group>
            <OrbitControls ref={(node) => { controlsRef.current = node; }} enableDamping enablePan minDistance={2.6} maxDistance={7} />
          </Canvas>
        </div>
      </section>

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="section-heading section-heading--compact">
          <div>
          <h2>Sensibilidade Monofilamento</h2>
            <p>{footSide === "right" ? "Pé direito" : "Pé esquerdo"} · {selected.clinicalGroup} · {selected.displayLabel}</p>
          </div>
        </div>

        <div className="inline-info">
          Use o campo Região do pé para uma seleção clínica precisa. O clique no 3D funciona apenas quando a região do modelo está nomeada com segurança.
        </div>

        <div className="foot-status-legend">
          {(["present", "reduced", "absent", "not_tested"] as const).map((status) => (
            <span key={status}>
              <i style={{ backgroundColor: statusColor[status] }} />
              {sensitivityStatusLabel(status)}
            </span>
          ))}
        </div>

        <label>
          Região do pé
          <select value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value); setSelectedCoordinates(null); }}>
            {sideRegions.map((region) => (
              <option key={region.pointKey} value={region.baseKey}>{region.clinicalGroup} · {region.displayLabel}</option>
            ))}
          </select>
        </label>

        <div className="segmented segmented--status segmented--status-four">
          {(["present", "reduced", "absent", "not_tested"] as const).map((status) => (
            <button className={sensitivityStatus === status ? "is-active" : ""} key={status} onClick={() => setSensitivityStatus(status)} type="button">
              {sensitivityStatusLabel(status)}
            </button>
          ))}
        </div>

        <label>
          Observacoes
          <textarea name="notes" onChange={(event) => setNotes(event.target.value)} placeholder="Observacoes sobre monofilamento, dor, parestesia ou resposta do paciente" value={notes} />
        </label>

        <button className="primary-button" disabled={saving} type="submit">
          <Save size={18} />
          {saving ? "Salvando..." : editingEntryId ? "Salvar alteração" : "Salvar marcação"}
        </button>

        <div className="data-panel data-panel--flat">
          <h3>Marcacoes deste atendimento</h3>
          <ul className="compact-list compact-list--clinical">
            {currentBaEntries.length ? currentBaEntries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.baNumber} · {regionLabel(entry.regionKey)}</strong>
                  {entry.notes && <small>{entry.notes}</small>}
                </div>
                <span>{sensitivityStatusLabel(entry.sensitivityStatus)}</span>
                <div className="compact-list__actions">
                  <button className="ghost-action" onClick={() => editEntry(entry)} type="button"><Pencil size={14} /> Editar</button>
                  {onRemove && <button className="danger-link" disabled={removingId === entry.id} onClick={() => removeEntry(entry.id)} type="button"><Trash2 size={14} /> {removingId === entry.id ? "Removendo..." : "Remover"}</button>}
                </div>
              </li>
            )) : <li>Nenhum ponto salvo neste BA.</li>}
          </ul>
        </div>

        <div className="data-panel data-panel--flat">
          <h3>Marcacoes anteriores do paciente</h3>
          <ul className="compact-list compact-list--clinical">
            {historicalEntries.length ? historicalEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.baNumber} · {regionLabel(entry.regionKey)}</strong>
                <span>{sensitivityStatusLabel(entry.sensitivityStatus)}</span>
              </li>
            )) : <li>Nenhum historico anterior para este lado do pe.</li>}
          </ul>
        </div>
      </form>
    </div>
  );
}

function FootLoading() {
  return (
    <Html center>
      <div className="foot-loading-card">
        <span />
        Carregando modelo 3D do pé...
      </div>
    </Html>
  );
}

function RegionHighlight({ color, label, region, visible }: { color: string; label?: string; region: SideAwareFootRegion; visible: boolean }) {
  if (!visible) return null;
  return (
    <group position={region.position}>
      <mesh scale={region.zoneScale}>
        <sphereGeometry args={[1, 32, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.24} opacity={0.24} transparent depthWrite={false} />
      </mesh>
      <mesh scale={[region.zoneScale[0] * 1.08, region.zoneScale[1] * 1.08, region.zoneScale[2] * 1.08]}>
        <sphereGeometry args={[1, 32, 18]} />
        <meshBasicMaterial color={color} wireframe opacity={0.32} transparent depthWrite={false} />
      </mesh>
      {label ? (
        <Html center distanceFactor={8} position={[0, 0, Math.max(region.zoneScale[2] + 0.08, 0.18)]}>
          <span className="foot-hotspot-label">{label}</span>
        </Html>
      ) : null}
    </group>
  );
}

function renderSavedMarkers(entries: FootSensitivityMap[], sideRegions: SideAwareFootRegion[], currentAttendance: boolean) {
  return entries.map((entry) => {
    const region = sideRegions.find((item) => matchesFootRegion(entry, item));
    if (!region) return null;
    const color = currentAttendance ? statusColor[entry.sensitivityStatus] : "#38bdf8";
    return (
      <RegionHighlight
        color={color}
        key={entry.id}
        region={region}
        visible
      />
    );
  });
}

function getFootRegionFromMeshName(meshName: string, footSide: FootSide) {
  const normalized = meshName.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!normalized) return null;

  const sideMatch = normalized.match(/^(right|left)_(.+?)(?:_click_zone)?$/);
  if (sideMatch) {
    const [, side, rawBaseKey] = sideMatch;
    if (side !== footSide) return null;
    const baseKey = rawBaseKey.replace(/_click_zone$/, "");
    const region = footRegionDefinitions.find((item) => item.baseKey === baseKey);
    return region ? withFootSide(region, footSide) : null;
  }

  const baseKey = Object.entries(meshNameFootRegionMap)
    .sort(([a], [b]) => b.length - a.length)
    .find(([meshKey]) => normalized.includes(meshKey))?.[1];
  if (!baseKey) return null;
  const region = footRegionDefinitions.find((item) => item.baseKey === baseKey);
  return region ? withFootSide(region, footSide) : null;
}

function getClickZoneSide(name: string, userData?: Record<string, unknown>): FootSide | null {
  const explicitSide = userData?.footSide;
  if (explicitSide === "right" || explicitSide === "left") return explicitSide;
  if (name.startsWith("right_")) return "right";
  if (name.startsWith("left_")) return "left";
  return null;
}

function configureInvisibleZoneMaterial(material: unknown) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    const materialLike = entry as { transparent?: boolean; opacity?: number; depthWrite?: boolean; colorWrite?: boolean } | undefined;
    if (!materialLike) return;
    materialLike.transparent = true;
    materialLike.opacity = 0;
    materialLike.depthWrite = false;
    materialLike.colorWrite = false;
  });
}

function matchesFootRegion(entry: FootSensitivityMap, region: SideAwareFootRegion) {
  const normalizedPoint = normalizeFootKey(entry.pointKey || entry.regionKey, entry.footSide);
  const normalizedRegion = normalizeFootKey(entry.regionKey, entry.footSide);
  return normalizedPoint === region.pointKey || normalizedRegion === region.regionKey;
}

function getBaseKeyFromEntry(entry: FootSensitivityMap) {
  const normalized = normalizeFootKey(entry.pointKey || entry.regionKey, entry.footSide);
  return normalized.replace(/^(right|left)_/, "");
}

function normalizeFootKey(key: string, footSide: FootSide) {
  const sidePrefix = footSide === "right" ? "right" : "left";
  const withoutSide = key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(new RegExp(`^${sidePrefix}_`), "")
    .replace(new RegExp(`^${sidePrefix}`), "")
    .replace(/^_+/, "");
  const baseKey = legacyFootRegionMap[withoutSide] ?? withoutSide;
  return `${sidePrefix}_${baseKey}`;
}

function regionLabel(key: string) {
  const normalized = key.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const side: FootSide = normalized.startsWith("left_") ? "left" : "right";
  const baseKey = normalized.replace(/^(right|left)_/, "");
  const compatibleKey = legacyFootRegionMap[baseKey] ?? baseKey;
  const region = footRegionDefinitions.find((item) => item.baseKey === compatibleKey);
  return region ? withFootSide(region, side).displayLabel : key;
}

function sensitivityStatusLabel(status: SensitivityStatus) {
  const labels: Record<SensitivityStatus, string> = {
    present: "Presente",
    reduced: "Diminuída",
    absent: "Ausente",
    not_tested: "Não testado"
  };
  return labels[status];
}

useGLTF.preload(FOOT_MODEL_URL);
