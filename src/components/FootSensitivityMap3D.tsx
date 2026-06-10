import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Rotate3D, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { FootSensitivityMap, FootSide, SensitivityStatus } from "../types";

type FootRegion = {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
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
  { key: "hallux", label: "Halux", x: -1.05, y: 0.28, z: 0.2 },
  { key: "toes", label: "Dedos", x: -1.15, y: 0.05, z: 0.15 },
  { key: "plantar", label: "Planta do pe", x: -0.15, y: 0, z: -0.16 },
  { key: "heel", label: "Calcanhar", x: 1.05, y: 0, z: -0.08 },
  { key: "metatarsal", label: "Regiao metatarsal", x: -0.62, y: 0, z: 0.05 },
  { key: "arch", label: "Arco plantar", x: 0.28, y: -0.18, z: -0.12 },
  { key: "medial-border", label: "Borda medial", x: -0.05, y: -0.5, z: 0.02 },
  { key: "lateral-border", label: "Borda lateral", x: -0.05, y: 0.5, z: 0.02 },
  { key: "dorsum", label: "Dorso do pe", x: -0.12, y: 0, z: 0.34 },
  { key: "nails", label: "Unhas", x: -1.28, y: 0.03, z: 0.31 },
  { key: "ankle", label: "Tornozelo", x: 1.42, y: 0, z: 0.32 }
];

const statusColor: Record<SensitivityStatus, string> = {
  present: "#22c55e",
  reduced: "#f59e0b",
  absent: "#ef4444"
};

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
  const [footSide, setFootSide] = useState<FootSide>("right");
  const [selectedKey, setSelectedKey] = useState("hallux");
  const [sensitivityStatus, setSensitivityStatus] = useState<SensitivityStatus>("present");
  const selected = useMemo(() => footRegions.find((region) => region.key === selectedKey) ?? footRegions[0], [selectedKey]);
  const currentEntries = entries.filter((entry) => entry.footSide === footSide);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    onSave({
      companyId,
      patientId,
      uniqueMedicalRecordId,
      attendanceId,
      uniqueRecordNumber,
      baNumber,
      footSide,
      regionKey: selected.key,
      coordinates: { x: selected.x, y: selected.y, z: selected.z },
      sensitivityStatus,
      notes: String(data.get("notes") || ""),
      createdBy: professionalId,
      updatedAt: new Date().toISOString()
    });

    event.currentTarget.reset();
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
          <span className="foot-map-hint"><Rotate3D size={16} /> Girar, aproximar e afastar</span>
        </div>

        <div className="foot-canvas" aria-label="Pe 3D para monofilamento">
          <Canvas camera={{ position: [0, -4.2, 2.4], fov: 42 }}>
            <ambientLight intensity={0.85} />
            <directionalLight position={[2, -3, 4]} intensity={1.15} />
            <group scale={footSide === "left" ? [-1, 1, 1] : [1, 1, 1]} rotation={[0.05, 0, -0.08]}>
              <mesh position={[0, 0, 0]}>
                <capsuleGeometry args={[0.55, 2.2, 10, 26]} />
                <meshStandardMaterial color="#e5b18f" roughness={0.62} metalness={0.03} />
              </mesh>
              <mesh position={[-1.24, 0, 0.12]} scale={[0.5, 0.88, 0.34]}>
                <sphereGeometry args={[0.6, 32, 18]} />
                <meshStandardMaterial color="#efc0a2" roughness={0.6} />
              </mesh>
              <mesh position={[1.22, 0, 0.14]} scale={[0.42, 0.62, 0.5]}>
                <sphereGeometry args={[0.62, 28, 18]} />
                <meshStandardMaterial color="#d99b78" roughness={0.68} />
              </mesh>
              {footRegions.map((region) => {
                const entry = currentEntries.find((item) => item.regionKey === region.key);
                const color = entry ? statusColor[entry.sensitivityStatus] : selectedKey === region.key ? "#38bdf8" : "#f8fafc";
                return (
                  <mesh key={region.key} position={[region.x, region.y, region.z]} onClick={() => setSelectedKey(region.key)}>
                    <sphereGeometry args={[selectedKey === region.key ? 0.095 : 0.075, 18, 18]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={entry || selectedKey === region.key ? 0.22 : 0.05} />
                  </mesh>
                );
              })}
            </group>
            <OrbitControls enablePan={false} minDistance={2.8} maxDistance={6.5} />
          </Canvas>
        </div>
      </section>

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Sensibilidade (Monofilamento)</h2>
            <p>{footSide === "right" ? "Pe direito" : "Pe esquerdo"} · {selected.label}</p>
          </div>
        </div>

        <label>
          Regiao do pe
          <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
            {footRegions.map((region) => (
              <option key={region.key} value={region.key}>{region.label}</option>
            ))}
          </select>
        </label>

        <div className="segmented segmented--status">
          {(["present", "reduced", "absent"] as const).map((status) => (
            <button className={sensitivityStatus === status ? "is-active" : ""} key={status} onClick={() => setSensitivityStatus(status)} type="button">
              {status === "present" ? "Presente" : status === "reduced" ? "Diminuida" : "Ausente"}
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
          <h3>Marcacoes deste BA</h3>
          <ul className="compact-list">
            {currentEntries.length ? currentEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{regionLabel(entry.regionKey)}</strong>
                <span>{entry.sensitivityStatus === "present" ? "Presente" : entry.sensitivityStatus === "reduced" ? "Diminuida" : "Ausente"}</span>
              </li>
            )) : <li>Nenhum ponto salvo ainda.</li>}
          </ul>
        </div>
      </form>
    </div>
  );
}

function regionLabel(key: string) {
  return footRegions.find((region) => region.key === key)?.label ?? key;
}
