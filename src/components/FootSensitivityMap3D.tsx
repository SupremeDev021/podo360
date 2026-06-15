import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { RefreshCw, Rotate3D, Save } from "lucide-react";
import { Component, Suspense, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

const FOOT_MODEL_URL = `${import.meta.env.BASE_URL}models/podo360-foot-textured.glb`;

type FootRegion = {
  baseKey: string;
  label: string;
  clinicalGroup: string;
  position: [number, number, number];
};

type SideAwareFootRegion = FootRegion & {
  regionKey: string;
  pointKey: string;
  sideLabel: "D" | "E";
  displayLabel: string;
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
  { baseKey: "hallux", label: "Hálux", clinicalGroup: "Dedos", position: [-1.24, -0.36, 0.2] },
  { baseKey: "second_toe", label: "2º dedo", clinicalGroup: "Dedos", position: [-1.3, -0.17, 0.22] },
  { baseKey: "third_toe", label: "3º dedo", clinicalGroup: "Dedos", position: [-1.31, 0.01, 0.22] },
  { baseKey: "fourth_toe", label: "4º dedo", clinicalGroup: "Dedos", position: [-1.27, 0.19, 0.2] },
  { baseKey: "fifth_toe", label: "5º dedo", clinicalGroup: "Dedos", position: [-1.17, 0.36, 0.17] },
  { baseKey: "hallux_nail", label: "Unha do hálux", clinicalGroup: "Unhas", position: [-1.36, -0.37, 0.36] },
  { baseKey: "second_toe_nail", label: "Unha do 2º dedo", clinicalGroup: "Unhas", position: [-1.42, -0.17, 0.36] },
  { baseKey: "third_toe_nail", label: "Unha do 3º dedo", clinicalGroup: "Unhas", position: [-1.43, 0.01, 0.36] },
  { baseKey: "fourth_toe_nail", label: "Unha do 4º dedo", clinicalGroup: "Unhas", position: [-1.38, 0.19, 0.34] },
  { baseKey: "fifth_toe_nail", label: "Unha do 5º dedo", clinicalGroup: "Unhas", position: [-1.28, 0.36, 0.3] },
  { baseKey: "first_metatarsal_head", label: "Cabeça do 1º metatarso", clinicalGroup: "Planta do pé", position: [-0.66, -0.37, 0.02] },
  { baseKey: "second_metatarsal_head", label: "Cabeça do 2º metatarso", clinicalGroup: "Planta do pé", position: [-0.72, -0.18, 0.01] },
  { baseKey: "third_metatarsal_head", label: "Cabeça do 3º metatarso", clinicalGroup: "Planta do pé", position: [-0.73, 0, 0] },
  { baseKey: "fourth_metatarsal_head", label: "Cabeça do 4º metatarso", clinicalGroup: "Planta do pé", position: [-0.71, 0.19, 0.01] },
  { baseKey: "fifth_metatarsal_head", label: "Cabeça do 5º metatarso", clinicalGroup: "Planta do pé", position: [-0.63, 0.38, 0.02] },
  { baseKey: "metatarsal_region", label: "Região metatarsal", clinicalGroup: "Planta do pé", position: [-0.46, 0, -0.04] },
  { baseKey: "medial_arch", label: "Arco plantar medial", clinicalGroup: "Planta do pé", position: [0.08, -0.43, -0.11] },
  { baseKey: "lateral_arch", label: "Arco plantar lateral", clinicalGroup: "Planta do pé", position: [0.08, 0.43, -0.11] },
  { baseKey: "plantar_heel", label: "Calcanhar plantar", clinicalGroup: "Planta do pé", position: [0.9, 0, -0.1] },
  { baseKey: "medial_plantar_border", label: "Borda medial plantar", clinicalGroup: "Planta do pé", position: [-0.05, -0.56, 0] },
  { baseKey: "lateral_plantar_border", label: "Borda lateral plantar", clinicalGroup: "Planta do pé", position: [-0.04, 0.56, 0] },
  { baseKey: "dorsal_forefoot", label: "Dorso do antepé", clinicalGroup: "Dorso do pé", position: [-0.72, 0, 0.39] },
  { baseKey: "dorsal_midfoot", label: "Dorso médio", clinicalGroup: "Dorso do pé", position: [-0.08, 0, 0.41] },
  { baseKey: "dorsal_lateral", label: "Dorso lateral", clinicalGroup: "Dorso do pé", position: [-0.2, 0.45, 0.33] },
  { baseKey: "dorsal_medial", label: "Dorso medial", clinicalGroup: "Dorso do pé", position: [-0.2, -0.45, 0.33] },
  { baseKey: "calcaneus", label: "Calcâneo", clinicalGroup: "Calcanhar e tornozelo", position: [1.06, 0, 0.16] },
  { baseKey: "medial_ankle", label: "Tornozelo medial", clinicalGroup: "Calcanhar e tornozelo", position: [1.34, -0.34, 0.48] },
  { baseKey: "lateral_ankle", label: "Tornozelo lateral", clinicalGroup: "Calcanhar e tornozelo", position: [1.34, 0.34, 0.48] },
  { baseKey: "posterior_heel", label: "Região posterior do calcanhar", clinicalGroup: "Calcanhar e tornozelo", position: [1.34, 0, 0.12] }
];

const legacyPointMap: Record<string, string> = {
  hallux: "hallux",
  "hallux-pulp": "hallux",
  hallux_pulp: "hallux",
  "halux": "hallux",
  "hallux-nail": "hallux_nail",
  hallux_nail: "hallux_nail",
  nails: "hallux_nail",
  toe_2: "second_toe",
  "toe-2": "second_toe",
  segundo_dedo: "second_toe",
  dedo_indicador: "second_toe",
  dedo_indicador_d: "second_toe",
  dedo_indicador_e: "second_toe",
  index_toe: "second_toe",
  toe_3: "third_toe",
  "toe-3": "third_toe",
  toe_4: "fourth_toe",
  "toe-4": "fourth_toe",
  toe_5: "fifth_toe",
  "toe-5": "fifth_toe",
  plantar: "metatarsal_region",
  "plantar-center": "metatarsal_region",
  plantar_center: "metatarsal_region",
  forefoot: "dorsal_forefoot",
  "forefoot-medial": "first_metatarsal_head",
  forefoot_medial: "first_metatarsal_head",
  "forefoot-lateral": "fifth_metatarsal_head",
  forefoot_lateral: "fifth_metatarsal_head",
  metatarsal: "metatarsal_region",
  "metatarsal-1": "first_metatarsal_head",
  metatarsal_1: "first_metatarsal_head",
  "metatarsal-5": "fifth_metatarsal_head",
  metatarsal_5: "fifth_metatarsal_head",
  arch: "medial_arch",
  "arch-medial": "medial_arch",
  arch_medial: "medial_arch",
  heel: "plantar_heel",
  "heel-center": "plantar_heel",
  heel_center: "plantar_heel",
  medial_border: "medial_plantar_border",
  "medial-border": "medial_plantar_border",
  lateral_border: "lateral_plantar_border",
  "lateral-border": "lateral_plantar_border",
  dorsal: "dorsal_midfoot",
  "dorsum-center": "dorsal_midfoot",
  dorsum_center: "dorsal_midfoot",
  ankle: "medial_ankle",
  "ankle-front": "medial_ankle",
  ankle_front: "medial_ankle",
  point_1: "hallux",
  foot_point_1: "hallux",
  mesh001: "hallux"
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
  const [selectedKey, setSelectedKey] = useState("hallux");
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const sideRegions = useMemo(() => footRegions.map((region) => withFootSide(region, footSide)), [footSide]);
  const selected = useMemo(() => sideRegions.find((region) => region.baseKey === selectedKey) ?? sideRegions[0], [selectedKey, sideRegions]);
  const entriesForSide = useMemo(() => entries.filter((entry) => entry.footSide === footSide), [entries, footSide]);
  const currentBaEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId === attendanceId), [attendanceId, entriesForSide]);
  const historicalEntries = useMemo(() => entriesForSide.filter((entry) => entry.attendanceId !== attendanceId), [attendanceId, entriesForSide]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const [x, y, z] = coordinatesForSide(selected, footSide);

    onSave({
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
              {sideRegions.map((region) => {
                const currentEntry = currentBaEntries.find((item) => matchesFootRegion(item, region));
                const historyEntry = historicalEntries.find((item) => matchesFootRegion(item, region));
                const color = currentEntry
                  ? statusColor[currentEntry.sensitivityStatus]
                  : historyEntry
                    ? "#38bdf8"
                    : selectedKey === region.baseKey
                      ? "#f8fafc"
                      : "#dbeafe";
                const isSelected = selectedKey === region.baseKey;

                return (
                  <group key={region.pointKey} position={region.position}>
                    <mesh onClick={() => setSelectedKey(region.baseKey)}>
                      <sphereGeometry args={[isSelected ? 0.105 : 0.072, 18, 18]} />
                      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={currentEntry || historyEntry || isSelected ? 0.28 : 0.08} />
                    </mesh>
                    {isSelected ? (
                      <Html center distanceFactor={8} position={[0, 0, 0.22]}>
                        <span className="foot-hotspot-label">{region.displayLabel}</span>
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
            <p>{footSide === "right" ? "Pé direito" : "Pé esquerdo"} · {selected.clinicalGroup} · {selected.displayLabel}</p>
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
          <textarea name="notes" placeholder="Observacoes sobre monofilamento, dor, parestesia ou resposta do paciente" />
        </label>

        <button className="primary-button" type="submit">
          <Save size={18} />
          Salvar marcação
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
        Carregando modelo 3D do pé...
      </div>
    </Html>
  );
}

function withFootSide(region: FootRegion, footSide: FootSide): SideAwareFootRegion {
  const prefix = footSide === "right" ? "right" : "left";
  const sideLabel = footSide === "right" ? "D" : "E";
  return {
    ...region,
    sideLabel,
    regionKey: `${prefix}_${region.baseKey}`,
    pointKey: `${prefix}_${region.baseKey}`,
    displayLabel: `${region.label} ${sideLabel}`
  };
}

function coordinatesForSide(region: SideAwareFootRegion, footSide: FootSide): [number, number, number] {
  const [x, y, z] = region.position;
  return footSide === "left" ? [-x, y, z] : [x, y, z];
}

function matchesFootRegion(entry: FootSensitivityMap, region: SideAwareFootRegion) {
  const normalizedPoint = normalizeFootKey(entry.pointKey || entry.regionKey, entry.footSide);
  const normalizedRegion = normalizeFootKey(entry.regionKey, entry.footSide);
  return normalizedPoint === region.pointKey || normalizedRegion === region.regionKey;
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
  const baseKey = legacyPointMap[withoutSide] ?? withoutSide;
  return `${sidePrefix}_${baseKey}`;
}

function regionLabel(key: string) {
  const normalized = key.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const side: FootSide = normalized.startsWith("left_") ? "left" : "right";
  const baseKey = normalized.replace(/^(right|left)_/, "");
  const compatibleKey = legacyPointMap[baseKey] ?? baseKey;
  const region = footRegions.find((item) => item.baseKey === compatibleKey);
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
