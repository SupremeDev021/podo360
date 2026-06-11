import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { RefreshCw, Rotate3D, Save } from "lucide-react";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot.glb`;

type FootRegion = {
  regionKey: string;
  pointKey: string;
  label: string;
  region: string;
  position: [number, number, number];
};

type FootSensitivityMap3DProps = {
  entries: FootSensitivityMap[];
  onSave: (entry: Omit<FootSensitivityMap, "id" | "createdAt">) => void;
  patientId: string;
  companyId: string;
  professionalId: string;
  attendanceId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
};

const footRegions: FootRegion[] = [
  { regionKey: "hallux", pointKey: "hallux-pulp", label: "Halux - polpa", region: "Halux", position: [-1.18, -0.26, 0.18] },
  { regionKey: "nails", pointKey: "hallux-nail", label: "Unha do halux", region: "Unhas", position: [-1.32, -0.22, 0.34] },
  { regionKey: "toe_2", pointKey: "toe-2", label: "Segundo dedo", region: "Segundo dedo", position: [-1.24, -0.08, 0.22] },
  { regionKey: "toe_3", pointKey: "toe-3", label: "Terceiro dedo", region: "Terceiro dedo", position: [-1.26, 0.08, 0.22] },
  { regionKey: "toe_4", pointKey: "toe-4", label: "Quarto dedo", region: "Quarto dedo", position: [-1.22, 0.23, 0.2] },
  { regionKey: "toe_5", pointKey: "toe-5", label: "Quinto dedo", region: "Quinto dedo", position: [-1.12, 0.38, 0.18] },
  { regionKey: "plantar", pointKey: "plantar-center", label: "Planta central", region: "Planta do pe", position: [-0.12, 0, -0.2] },
  { regionKey: "forefoot", pointKey: "forefoot-medial", label: "Ante pe medial", region: "Ante pe", position: [-0.68, -0.28, 0.02] },
  { regionKey: "forefoot", pointKey: "forefoot-lateral", label: "Ante pe lateral", region: "Ante pe", position: [-0.7, 0.28, 0.02] },
  { regionKey: "metatarsal", pointKey: "metatarsal-1", label: "1a cabeca metatarsal", region: "Regiao metatarsal", position: [-0.52, -0.34, 0.04] },
  { regionKey: "metatarsal", pointKey: "metatarsal-5", label: "5a cabeca metatarsal", region: "Regiao metatarsal", position: [-0.54, 0.36, 0.04] },
  { regionKey: "arch", pointKey: "arch-medial", label: "Arco plantar medial", region: "Arco plantar", position: [0.2, -0.38, -0.12] },
  { regionKey: "heel", pointKey: "heel-center", label: "Calcanhar central", region: "Calcanhar", position: [1, 0, -0.08] },
  { regionKey: "medial_border", pointKey: "medial-border", label: "Borda medial", region: "Borda medial", position: [0, -0.54, 0.02] },
  { regionKey: "lateral_border", pointKey: "lateral-border", label: "Borda lateral", region: "Borda lateral", position: [0, 0.54, 0.02] },
  { regionKey: "dorsal", pointKey: "dorsum-center", label: "Dorso do pe", region: "Dorso do pe", position: [-0.12, 0, 0.38] },
  { regionKey: "ankle", pointKey: "ankle-front", label: "Tornozelo", region: "Tornozelo", position: [1.42, 0, 0.32] }
];

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
  const model = useMemo(() => scene.clone(true), [scene]);

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
  const [selectedKey, setSelectedKey] = useState("hallux-pulp");
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const selected = useMemo(() => footRegions.find((region) => region.pointKey === selectedKey) ?? footRegions[0], [selectedKey]);
  const entriesForSide = useMemo(() => entries.filter((entry) => entry.footSide === footSide), [entries, footSide]);
  const currentBaEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId === attendanceId), [attendanceId, entriesForSide]);
  const historicalEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId !== attendanceId), [attendanceId, entriesForSide]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const [x, y, z] = selected.position;

    onSave({
      companyId,
      patientId,
      uniqueMedicalRecordId,
      attendanceId,
      uniqueRecordNumber,
      baNumber,
      footSide,
      regionKey: selected.regionKey,
      pointKey: `${footSide}-${selected.pointKey}`,
      coordinates: { x, y, z },
      sensitivityStatus,
      notes: String(data.get("notes") || ""),
      createdBy: professionalId,
      updatedAt: new Date().toISOString()
    });

    event.currentTarget.reset();
  }

  function resetCamera() {
    controlsRef.current?.reset();
  }

  return (
    <div className="foot-map-grid">
      <section className="foot-map-panel">
        <div className="body-map__toolbar">
          <div className="segmented">
            {(["right", "left"] as const).map((side) => (
              <button className={footSide === side ? "is-active" : ""} key={side} onClick={() => setFootSide(side)} type="button">
                {side === "right" ? "Pe direito" : "Pe esquerdo"}
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

        <div className="foot-canvas" aria-label="Pe 3D para monofilamento">
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
              {footRegions.map((region) => {
                const pointKey = `${footSide}-${region.pointKey}`;
                const currentEntry = currentBaEntries.find((item) => item.pointKey === pointKey || (!item.pointKey && item.regionKey === region.regionKey));
                const historyEntry = historicalEntries.find((item) => item.pointKey === pointKey || (!item.pointKey && item.regionKey === region.regionKey));
                const color = currentEntry
                  ? statusColor[currentEntry.sensitivityStatus]
                  : historyEntry
                    ? "#38bdf8"
                    : selectedKey === region.pointKey
                      ? "#f8fafc"
                      : "#dbeafe";
                const isSelected = selectedKey === region.pointKey;

                return (
                  <group key={region.pointKey} position={region.position}>
                    <mesh onClick={() => setSelectedKey(region.pointKey)}>
                      <sphereGeometry args={[isSelected ? 0.105 : 0.072, 18, 18]} />
                      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={currentEntry || historyEntry || isSelected ? 0.28 : 0.08} />
                    </mesh>
                    {isSelected ? (
                      <Html center distanceFactor={8} position={[0, 0, 0.22]}>
                        <span className="foot-hotspot-label">{region.region}</span>
                      </Html>
                    ) : null}
                  </group>
                );
              })}
            </group>
            <OrbitControls ref={(node) => { controlsRef.current = node; }} enableDamping enablePan minDistance={2.6} maxDistance={7} />
          </Canvas>
        </div>
      </section>

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Sensibilidade Monofilamento</h2>
            <p>{footSide === "right" ? "Pe direito" : "Pe esquerdo"} · {selected.region} · {selected.label}</p>
          </div>
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
          Regiao do pe
          <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
            {footRegions.map((region) => (
              <option key={region.pointKey} value={region.pointKey}>{region.region} · {region.label}</option>
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
          <textarea name="notes" placeholder="Observacoes sobre monofilamento, dor, parestesia ou resposta do paciente" />
        </label>

        <button className="primary-button" type="submit">
          <Save size={18} />
          Salvar ponto do pe
        </button>

        <div className="data-panel data-panel--flat">
          <h3>Marcacoes deste atendimento</h3>
          <ul className="compact-list compact-list--clinical">
            {currentBaEntries.length ? currentBaEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.baNumber} · {regionLabel(entry.regionKey)}</strong>
                <span>{sensitivityStatusLabel(entry.sensitivityStatus)}</span>
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
        Carregando modelo 3D do pe...
      </div>
    </Html>
  );
}

function regionLabel(key: string) {
  return footRegions.find((region) => region.regionKey === key)?.region ?? key;
}

function sensitivityStatusLabel(status: SensitivityStatus) {
  const labels: Record<SensitivityStatus, string> = {
    present: "Presente",
    reduced: "Diminuida",
    absent: "Ausente",
    not_tested: "Nao testado"
  };
  return labels[status];
}

useGLTF.preload(FOOT_MODEL_URL);
