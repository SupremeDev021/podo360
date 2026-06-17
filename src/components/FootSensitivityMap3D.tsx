import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Pencil, RefreshCw, Rotate3D, Save, Trash2 } from "lucide-react";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  footRegionDefinitions,
  legacyFootRegionMap,
  withFootSide,
} from "../data/footRegionMap";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot-segmented.glb`;

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

function FootGlbModel() {
  const { scene } = useGLTF(FOOT_MODEL_URL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      const modelObject = object as {
        name: string;
        visible: boolean;
        userData?: Record<string, unknown>;
      };
      if (isFootClickZone(modelObject.name, modelObject.userData)) {
        modelObject.visible = false;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive
      object={model}
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
  const [footSide, setFootSide] = useState<FootSide>("right");
  const [selectedKey, setSelectedKey] = useState("hallux");
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const sideRegions = useMemo(() => footRegionDefinitions.map((region) => withFootSide(region, footSide)), [footSide]);
  const selected = useMemo(() => sideRegions.find((region) => region.baseKey === selectedKey) ?? sideRegions[0], [selectedKey, sideRegions]);
  const entriesForSide = useMemo(() => entries.filter((entry) => entry.footSide === footSide), [entries, footSide]);
  const currentBaEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId === attendanceId), [attendanceId, entriesForSide]);
  const historicalEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId !== attendanceId), [attendanceId, entriesForSide]);

  async function saveMarking() {
    const [x, y, z] = selected.position;
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
    setNotes("");
  }

  function editEntry(entry: FootSensitivityMap) {
    const baseKey = getBaseKeyFromEntry(entry);
    setFootSide(entry.footSide);
    setSelectedKey(baseKey);
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
            <group scale={footSide === "left" ? [-1, 1, 1] : [1, 1, 1]} rotation={[0.12, 0.04, -0.08]}>
              <FootModelErrorBoundary fallback={<FallbackFootMesh />}>
                <Suspense fallback={<FootLoading />}>
                  <FootGlbModel />
                </Suspense>
              </FootModelErrorBoundary>
            </group>
            <Html fullscreen>
              <div className="foot-viewer-note">Use o campo Região do pé para registrar a sensibilidade.</div>
            </Html>
            <OrbitControls ref={(node) => { controlsRef.current = node; }} enableDamping enablePan minDistance={2.6} maxDistance={7} />
          </Canvas>
        </div>
      </section>

      <section className="panel-form foot-sensitivity-form">
        <div className="section-heading section-heading--compact">
          <div>
          <h2>Sensibilidade Monofilamento</h2>
            <p>{footSide === "right" ? "Pé direito" : "Pé esquerdo"} · {selected.clinicalGroup} · {selected.displayLabel}</p>
          </div>
        </div>

        <div className="inline-info">
          O pé 3D é apenas uma visualização anatômica. Registre a sensibilidade selecionando o lado e a Região do pé no formulário.
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
          <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
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

        <button className="primary-button" disabled={saving} onClick={saveMarking} type="button">
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
  return normalized.includes("click_zone") || userData?.purpose === "foot_click_zone" || userData?.isClickZone === true;
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
