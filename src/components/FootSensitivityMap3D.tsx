import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Pencil, RefreshCw, Rotate3D, Save, Trash2 } from "lucide-react";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Euler, Vector3 } from "three";
import {
  footRegionDefinitions,
  legacyFootRegionMap,
  withFootSide,
} from "../data/footRegionMap";
import type { FootCoordinate } from "../data/footRegionMap";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot-clickable.glb?v=20260617-clickable-5`;

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
  readOnly?: boolean;
  readOnlyMessage?: string;
};

const statusColor: Record<SensitivityStatus, string> = {
  present: "#22c55e",
  reduced: "#f59e0b",
  absent: "#ef4444",
  not_tested: "#94a3b8"
};

type FootMarker = {
  id: string;
  position: FootCoordinate;
  color: string;
  label: string;
  selected?: boolean;
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

type FootGlbModelProps = {
  footSide: FootSide;
  onRegionClick: (event: ThreeEvent<PointerEvent>) => void;
};

function FootGlbModel({ footSide, onRegionClick }: FootGlbModelProps) {
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

  return (
    <primitive
      object={model}
      onPointerDown={onRegionClick}
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

function FootMarkers({ markers }: { markers: FootMarker[] }) {
  return (
    <group>
      {markers.map((marker) => (
        <group key={marker.id} position={marker.position}>
          <mesh renderOrder={20}>
            <sphereGeometry args={[marker.selected ? 0.045 : 0.032, 24, 16]} />
            <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={marker.selected ? 0.65 : 0.32} transparent opacity={marker.selected ? 0.96 : 0.72} depthTest={false} />
          </mesh>
          {marker.selected && (
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={19}>
              <torusGeometry args={[0.075, 0.006, 10, 36]} />
              <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.45} transparent opacity={0.82} depthTest={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
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
  baNumber,
  readOnly = false,
  readOnlyMessage = "Não é possível editar atendimento finalizado."
}: FootSensitivityMap3DProps) {
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const [footSide, setFootSide] = useState<FootSide>("right");
  const [selectedKey, setSelectedKey] = useState("hallux");
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<FootCoordinate | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewerMessage, setViewerMessage] = useState<string | null>(null);
  const sideRegions = useMemo(() => footRegionDefinitions.map((region) => withFootSide(region, footSide)), [footSide]);
  const selected = useMemo(() => sideRegions.find((region) => region.baseKey === selectedKey) ?? sideRegions[0], [selectedKey, sideRegions]);
  const entriesForSide = useMemo(() => entries.filter((entry) => entry.footSide === footSide), [entries, footSide]);
  const currentBaEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId === attendanceId), [attendanceId, entriesForSide]);
  const historicalEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId !== attendanceId), [attendanceId, entriesForSide]);
  const selectedMarkerPoint = useMemo(
    () => selectedCoordinates ?? toWorldFootPoint(selected.position, footSide),
    [footSide, selected.position, selectedCoordinates]
  );
  const footMarkers = useMemo<FootMarker[]>(() => {
    const savedMarkers = currentBaEntries
      .filter((entry) => entry.coordinates)
      .map((entry) => ({
        id: entry.id,
        position: [entry.coordinates!.x, entry.coordinates!.y, entry.coordinates!.z ?? 0] as FootCoordinate,
        color: statusColor[entry.sensitivityStatus],
        label: `${regionLabel(entry.regionKey)} - ${sensitivityStatusLabel(entry.sensitivityStatus)}`
      }));
    return [
      ...savedMarkers,
      {
        id: "selected-foot-region",
        position: selectedMarkerPoint,
        color: "#f97316",
        label: selected.displayLabel,
        selected: true
      }
    ];
  }, [currentBaEntries, selected.displayLabel, selectedMarkerPoint]);

  async function saveMarking() {
    if (readOnly) {
      setViewerMessage(readOnlyMessage);
      return;
    }
    const [x, y, z] = selectedMarkerPoint;
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
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  function resetCamera() {
    controlsRef.current?.reset();
  }

  function handleSideChange(side: FootSide) {
    setFootSide(side);
    setEditingEntryId(null);
    setSelectedCoordinates(null);
    setViewerMessage(null);
    setNotes("");
  }

  function editEntry(entry: FootSensitivityMap) {
    if (readOnly) {
      setViewerMessage(readOnlyMessage);
      return;
    }
    const baseKey = getBaseKeyFromEntry(entry);
    setFootSide(entry.footSide);
    setSelectedKey(baseKey);
    setSensitivityStatus(entry.sensitivityStatus);
    setNotes(entry.notes || "");
    setSelectedCoordinates(entry.coordinates ? [entry.coordinates.x, entry.coordinates.y, entry.coordinates.z ?? 0] : null);
    setEditingEntryId(entry.id);
  }

  function handleRegionClick(event: ThreeEvent<PointerEvent>) {
    const hit = event.intersections.find((intersection) =>
      getFootRegionFromObjectName(intersection.object.name, footSide, intersection.object.userData as Record<string, unknown> | undefined)
    );
    if (!hit) {
      if (event.intersections.length) {
        setViewerMessage("Essa area ainda nao esta mapeada. Use o campo Regiao do pe para registrar com seguranca.");
      }
      return;
    }
    const region = getFootRegionFromObjectName(hit.object.name, footSide, hit.object.userData as Record<string, unknown> | undefined);
    if (!region) return;
    event.stopPropagation();
    setSelectedKey(region.baseKey);
    setSelectedCoordinates([hit.point.x, hit.point.y, hit.point.z]);
    setViewerMessage(`${region.displayLabel} selecionado no modelo 3D.`);
  }

  async function removeEntry(entryId: string) {
    if (!onRemove) return;
    if (readOnly) {
      setViewerMessage(readOnlyMessage);
      return;
    }
    setRemovingId(entryId);
    try {
      await onRemove(entryId);
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
        setNotes("");
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
          <Canvas camera={{ position: [0, -4.2, 2.4], fov: 42 }} onWheel={(event) => event.stopPropagation()} style={{ touchAction: "none" }}>
            <ambientLight intensity={0.95} />
            <directionalLight position={[2, -3, 4]} intensity={1.2} />
            <directionalLight position={[-4, 2, 2]} intensity={0.45} />
            <group scale={footSide === "left" ? [-1, 1, 1] : [1, 1, 1]} rotation={[0.12, 0.04, -0.08]}>
              <FootModelErrorBoundary fallback={<FallbackFootMesh />}>
                <Suspense fallback={<FootLoading />}>
                  <FootGlbModel footSide={footSide} onRegionClick={handleRegionClick} />
                </Suspense>
              </FootModelErrorBoundary>
            </group>
            <FootMarkers markers={footMarkers} />
            <Html fullscreen>
              <div className="foot-viewer-note">Clique na região do pé ou use o campo Região do pé para registrar a sensibilidade.</div>
            </Html>
            <OrbitControls ref={(node) => { controlsRef.current = node; }} enableDamping enablePan={false} enableZoom minDistance={2.6} maxDistance={7} />
          </Canvas>
          {viewerMessage && <div className="foot-viewer-inline-message">{viewerMessage}</div>}
        </div>
      </section>

      <section className="panel-form foot-sensitivity-form">
        <div className="section-heading section-heading--compact">
          <div>
          <h2>Avaliação de Sensibilidade</h2>
            <p>{footSide === "right" ? "Pé direito" : "Pé esquerdo"} · {selected.clinicalGroup} · {selected.displayLabel}</p>
          </div>
        </div>

        <div className="inline-info">
          {readOnly ? "Este atendimento está finalizado e o mapa está disponível apenas para consulta." : "Clique diretamente no modelo quando a região estiver clara. Se preferir, use o campo Região do pé para registrar com segurança."}
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
          <select disabled={readOnly} value={selectedKey} onChange={(event) => {
            setSelectedKey(event.target.value);
            setSelectedCoordinates(null);
            setViewerMessage(null);
          }}>
            {sideRegions.map((region) => (
              <option key={region.pointKey} value={region.baseKey}>{region.clinicalGroup} · {region.displayLabel}</option>
            ))}
          </select>
        </label>

        <div className="segmented segmented--status segmented--status-four">
          {(["present", "reduced", "absent", "not_tested"] as const).map((status) => (
            <button className={sensitivityStatus === status ? "is-active" : ""} disabled={readOnly} key={status} onClick={() => setSensitivityStatus(status)} type="button">
              {sensitivityStatusLabel(status)}
            </button>
          ))}
        </div>

        <label>
          Observacoes
          <textarea disabled={readOnly} name="notes" onChange={(event) => setNotes(event.target.value)} placeholder="Observacoes sobre monofilamento, dor, parestesia ou resposta do paciente" value={notes} />
        </label>

        <button className="primary-button" disabled={saving || readOnly} onClick={saveMarking} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="button">
          <Save size={18} />
          {saving ? "Salvando..." : editingEntryId ? "Salvar alteração" : "Salvar marcação"}
        </button>

        <div className="data-panel data-panel--flat">
          <h3>Marcacoes deste atendimento</h3>
          <ul className="compact-list compact-list--clinical">
            {currentBaEntries.length ? currentBaEntries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{footSideLabel(entry.footSide)} · {regionLabel(entry.regionKey)}</strong>
                  <small>{entry.baNumber} · {formatFootEntryDate(entry.updatedAt ?? entry.createdAt)}</small>
                  {entry.notes && <small>{entry.notes}</small>}
                </div>
                <span>{sensitivityStatusLabel(entry.sensitivityStatus)}</span>
                <div className="compact-list__actions">
                  <button className="ghost-action" disabled={readOnly} onClick={() => editEntry(entry)} type="button"><Pencil size={14} /> Editar</button>
                  {onRemove && <button className="danger-link" disabled={readOnly || removingId === entry.id} onClick={() => removeEntry(entry.id)} type="button"><Trash2 size={14} /> {removingId === entry.id ? "Removendo..." : "Remover"}</button>}
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
                <div>
                  <strong>{footSideLabel(entry.footSide)} · {regionLabel(entry.regionKey)}</strong>
                  <small>{entry.baNumber} · {formatFootEntryDate(entry.updatedAt ?? entry.createdAt)}</small>
                </div>
                <span>{sensitivityStatusLabel(entry.sensitivityStatus)}</span>
              </li>
            )) : <li>Nenhum historico anterior para este lado do pe.</li>}
          </ul>
        </div>
      </section>
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
  const baseKey = match[2];
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

function footSideLabel(side: FootSide) {
  return side === "right" ? "Pé direito" : "Pé esquerdo";
}

function formatFootEntryDate(value?: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
