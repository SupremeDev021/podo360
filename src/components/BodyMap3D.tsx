import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Box, CalendarClock, Camera, History, Rotate3D, Save, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { BodyMapEntry, BodySide } from "../types";

type Region = {
  key: string;
  label: string;
  side: BodySide;
  group: "foot" | "leg" | "body";
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

type ViewMode = "front" | "side" | "back";

type BodyMap3DProps = {
  entries: BodyMapEntry[];
  onSave: (entry: Omit<BodyMapEntry, "id" | "createdAt">) => void;
  patientId: string;
  companyId: string;
  professionalId: string;
  attendanceId?: string;
};

const regions: Region[] = [
  { key: "right-foot", label: "Pe direito", side: "right", group: "foot", position: [0.42, -3.12, 0.26], scale: [0.62, 0.18, 1.08], color: "#f59e0b" },
  { key: "left-foot", label: "Pe esquerdo", side: "left", group: "foot", position: [-0.42, -3.12, 0.26], scale: [0.62, 0.18, 1.08], color: "#f59e0b" },
  { key: "right-toes", label: "Dedos do pe direito", side: "right", group: "foot", position: [0.42, -3.12, 0.96], scale: [0.54, 0.12, 0.24], color: "#22c55e" },
  { key: "left-toes", label: "Dedos do pe esquerdo", side: "left", group: "foot", position: [-0.42, -3.12, 0.96], scale: [0.54, 0.12, 0.24], color: "#22c55e" },
  { key: "right-nails", label: "Unhas do pe direito", side: "right", group: "foot", position: [0.42, -3.01, 1.1], scale: [0.5, 0.035, 0.08], color: "#38bdf8" },
  { key: "left-nails", label: "Unhas do pe esquerdo", side: "left", group: "foot", position: [-0.42, -3.01, 1.1], scale: [0.5, 0.035, 0.08], color: "#38bdf8" },
  { key: "right-heel", label: "Calcanhar direito", side: "right", group: "foot", position: [0.42, -3.12, -0.42], scale: [0.56, 0.16, 0.28], color: "#ef4444" },
  { key: "left-heel", label: "Calcanhar esquerdo", side: "left", group: "foot", position: [-0.42, -3.12, -0.42], scale: [0.56, 0.16, 0.28], color: "#ef4444" },
  { key: "right-plantar", label: "Planta do pe direito", side: "right", group: "foot", position: [0.42, -3.25, 0.34], scale: [0.48, 0.04, 0.82], color: "#a855f7" },
  { key: "left-plantar", label: "Planta do pe esquerdo", side: "left", group: "foot", position: [-0.42, -3.25, 0.34], scale: [0.48, 0.04, 0.82], color: "#a855f7" },
  { key: "right-dorsum", label: "Dorso do pe direito", side: "right", group: "foot", position: [0.42, -2.99, 0.36], scale: [0.46, 0.04, 0.74], color: "#06b6d4" },
  { key: "left-dorsum", label: "Dorso do pe esquerdo", side: "left", group: "foot", position: [-0.42, -2.99, 0.36], scale: [0.46, 0.04, 0.74], color: "#06b6d4" },
  { key: "right-ankle", label: "Tornozelo direito", side: "right", group: "leg", position: [0.42, -2.52, 0.05], scale: [0.34, 0.3, 0.34], color: "#f97316" },
  { key: "left-ankle", label: "Tornozelo esquerdo", side: "left", group: "leg", position: [-0.42, -2.52, 0.05], scale: [0.34, 0.3, 0.34], color: "#f97316" },
  { key: "right-leg", label: "Perna direita", side: "right", group: "leg", position: [0.42, -1.9, 0], scale: [0.36, 0.9, 0.36], color: "#14b8a6" },
  { key: "left-leg", label: "Perna esquerda", side: "left", group: "leg", position: [-0.42, -1.9, 0], scale: [0.36, 0.9, 0.36], color: "#14b8a6" },
  { key: "right-knee", label: "Joelho direito", side: "right", group: "leg", position: [0.42, -1.16, 0.02], scale: [0.38, 0.28, 0.38], color: "#84cc16" },
  { key: "left-knee", label: "Joelho esquerdo", side: "left", group: "leg", position: [-0.42, -1.16, 0.02], scale: [0.38, 0.28, 0.38], color: "#84cc16" },
  { key: "right-hand", label: "Mao direita", side: "right", group: "body", position: [1.72, -0.62, 0], scale: [0.28, 0.24, 0.26], color: "#94a3b8" },
  { key: "left-hand", label: "Mao esquerda", side: "left", group: "body", position: [-1.72, -0.62, 0], scale: [0.28, 0.24, 0.26], color: "#94a3b8" },
  { key: "torso", label: "Tronco", side: "not_applicable", group: "body", position: [0, 0.62, 0], scale: [0.82, 1.18, 0.42], color: "#94a3b8" }
];

const viewRotation: Record<ViewMode, number> = {
  front: 0,
  side: -Math.PI / 2,
  back: Math.PI
};

const viewLabel: Record<ViewMode, string> = {
  front: "Frontal",
  side: "Lateral",
  back: "Posterior"
};

export function BodyMap3D({ entries, onSave, patientId, companyId, professionalId, attendanceId }: BodyMap3DProps) {
  const [view, setView] = useState<ViewMode>("front");
  const [selectedKey, setSelectedKey] = useState("right-foot");
  const [focus, setFocus] = useState<"all" | "feet">("feet");
  const selected = useMemo(() => regions.find((region) => region.key === selectedKey) ?? regions[0], [selectedKey]);
  const selectedHistory = entries.filter((entry) => entry.regionKey === selected.key);
  const visibleRegions = focus === "feet" ? regions.filter((region) => region.group === "foot" || region.group === "leg") : regions;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const recordDate = String(data.get("recordDate") || new Date().toISOString().slice(0, 10));
    const exactLocation = String(data.get("exactLocation") || selected.label);
    const evolution = String(data.get("evolution") || "");
    const notes = String(data.get("notes") || "");

    onSave({
      companyId,
      patientId,
      attendanceId,
      bodyRegion: exactLocation,
      bodySide: selected.side,
      regionKey: selected.key,
      coordinates: { x: selected.position[0], y: selected.position[1], z: selected.position[2] },
      dressingType: String(data.get("dressingType") || ""),
      woundDescription: String(data.get("woundDescription") || ""),
      procedureDescription: String(data.get("procedureDescription") || ""),
      productsUsed: String(data.get("productsUsed") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: [notes, evolution ? `Evolucao: ${evolution}` : "", `Data do registro: ${recordDate}`].filter(Boolean).join("\n"),
      images: [],
      createdBy: professionalId
    });

    event.currentTarget.reset();
  }

  return (
    <div className="body-map-grid">
      <section className="body-map body-map--real3d">
        <div className="body-map__toolbar">
          <div>
            <span className="eyebrow">Anamnese visual</span>
            <h2>Corpo humano em 3D</h2>
          </div>
          <div className="body-map__controls">
            <div className="segmented">
              {(["front", "side", "back"] as const).map((item) => (
                <button className={view === item ? "is-active" : ""} key={item} onClick={() => setView(item)} type="button">
                  {viewLabel[item]}
                </button>
              ))}
            </div>
            <button className="ghost-button body-map__focus" onClick={() => setFocus((current) => (current === "feet" ? "all" : "feet"))} type="button">
              {focus === "feet" ? "Ver corpo inteiro" : "Priorizar pes"}
            </button>
          </div>
        </div>

        <div className="body-map__canvas" aria-label="Modelo 3D interativo do corpo humano">
          <Canvas shadows dpr={[1, 1.5]}>
            <PerspectiveCamera makeDefault position={[0, 0.2, 7.8]} fov={42} />
            <color attach="background" args={["#09111a"]} />
            <ambientLight intensity={1.35} />
            <directionalLight castShadow intensity={2.1} position={[3, 5, 4]} />
            <pointLight intensity={1.1} position={[-3, 2, 3]} color="#38bdf8" />
            <HumanBodyModel entries={entries} regions={visibleRegions} selectedKey={selectedKey} view={view} onSelect={setSelectedKey} />
            <OrbitControls enablePan={false} minDistance={4.2} maxDistance={10} target={[0, -0.55, 0]} />
          </Canvas>
        </div>

        <div className="body-map__legend">
          <span><i className="legend-dot legend-dot--selected" /> Regiao selecionada: {selected.label}</span>
          <span><i className="legend-dot legend-dot--history" /> Marcacoes anteriores</span>
          <span><Rotate3D size={16} /> Arraste para girar, use scroll/pinch para aproximar</span>
        </div>
      </section>

      <aside className="body-map-side">
        <form className="panel-form body-map-form" onSubmit={handleSubmit}>
          <div className="section-heading section-heading--compact">
            <div>
              <h2>Registro do curativo</h2>
              <p>{selected.label} · {sideLabel(selected.side)}</p>
            </div>
            <Box size={20} />
          </div>

          <label>Tipo de curativo<input name="dressingType" placeholder="Ex.: curativo protetor" required /></label>
          <label>Local exato do curativo<input name="exactLocation" defaultValue={selected.label} required /></label>
          <label>Lado do corpo<input value={sideLabel(selected.side)} readOnly /></label>
          <label>Descricao da lesao ou ferida<textarea name="woundDescription" placeholder="Achados observados na regiao" required /></label>
          <label>Procedimento realizado<textarea name="procedureDescription" placeholder="Conduta realizada" required /></label>
          <label>Produtos utilizados<input name="productsUsed" placeholder="Gaze, soro, antisseptico..." /></label>
          <label>Evolucao do tratamento<textarea name="evolution" placeholder="Melhora, piora, retorno, resposta ao curativo..." /></label>
          <label>Observacoes clinicas<textarea name="notes" placeholder="Orientacoes, sinais observados e cuidados" /></label>
          <label>Data do registro<input name="recordDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>Profissional responsavel<input value={professionalId} readOnly /></label>

          <div className="attachment-placeholder">
            <Camera size={18} />
            <span>Fotos/anexos preparados para armazenamento futuro</span>
          </div>

          <button className="primary-button" type="submit">
            <Save size={18} />
            Salvar marcacao no historico
          </button>
        </form>

        <section className="data-panel body-history">
          <div className="section-heading section-heading--compact">
            <div>
              <h2>Historico por regiao</h2>
              <p>{selectedHistory.length ? `${selectedHistory.length} registro(s) em ${selected.label}` : "Nenhuma marcacao nesta regiao"}</p>
            </div>
            <History size={20} />
          </div>

          <div className="body-history__list">
            {(selectedHistory.length ? selectedHistory : entries).slice(0, 5).map((entry) => (
              <article className="body-history__card" key={entry.id}>
                <strong>{entry.bodyRegion}</strong>
                <span><CalendarClock size={14} /> {formatDateTime(entry.createdAt)}</span>
                <span><UserRound size={14} /> {entry.createdBy}</span>
                <p>{entry.procedureDescription}</p>
                <small>{entry.notes || entry.woundDescription}</small>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function HumanBodyModel({
  entries,
  regions,
  selectedKey,
  view,
  onSelect
}: {
  entries: BodyMapEntry[];
  regions: Region[];
  selectedKey: string;
  view: ViewMode;
  onSelect: (key: string) => void;
}) {
  const historyKeys = new Set(entries.map((entry) => entry.regionKey));

  return (
    <group rotation={[0, viewRotation[view], 0]} position={[0, 0.1, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.42, 0]}>
        <circleGeometry args={[2.4, 64]} />
        <meshStandardMaterial color="#102033" roughness={0.9} metalness={0.1} />
      </mesh>
      <BodyPart type="sphere" position={[0, 2.35, 0]} scale={[0.42, 0.52, 0.42]} />
      <BodyPart type="capsule" position={[0, 1.38, 0]} scale={[0.54, 0.95, 0.34]} />
      <BodyPart type="capsule" position={[0, 0.25, 0]} scale={[0.68, 0.78, 0.38]} />
      <BodyPart type="capsule" position={[-0.9, 0.72, 0]} rotation={[0, 0, -0.24]} scale={[0.2, 1.02, 0.2]} />
      <BodyPart type="capsule" position={[0.9, 0.72, 0]} rotation={[0, 0, 0.24]} scale={[0.2, 1.02, 0.2]} />
      <BodyPart type="sphere" position={[-1.72, -0.62, 0]} scale={[0.24, 0.24, 0.24]} />
      <BodyPart type="sphere" position={[1.72, -0.62, 0]} scale={[0.24, 0.24, 0.24]} />
      <BodyPart type="capsule" position={[-0.42, -1.58, 0]} scale={[0.25, 1.08, 0.25]} />
      <BodyPart type="capsule" position={[0.42, -1.58, 0]} scale={[0.25, 1.08, 0.25]} />
      <BodyPart type="foot" position={[-0.42, -3.12, 0.28]} scale={[0.56, 0.16, 1.02]} />
      <BodyPart type="foot" position={[0.42, -3.12, 0.28]} scale={[0.56, 0.16, 1.02]} />

      {regions.map((region) => (
        <RegionMarker
          hasHistory={historyKeys.has(region.key)}
          isSelected={region.key === selectedKey}
          key={region.key}
          region={region}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function BodyPart({
  type,
  position,
  rotation = [0, 0, 0],
  scale
}: {
  type: "sphere" | "capsule" | "foot";
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
}) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={rotation} scale={scale}>
      {type === "sphere" && <sphereGeometry args={[1, 36, 28]} />}
      {type === "capsule" && <capsuleGeometry args={[1, 1.2, 16, 32]} />}
      {type === "foot" && <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial color="#e4ad89" roughness={0.58} metalness={0.04} />
    </mesh>
  );
}

function RegionMarker({ region, isSelected, hasHistory, onSelect }: { region: Region; isSelected: boolean; hasHistory: boolean; onSelect: (key: string) => void }) {
  function handleSelect(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(region.key);
  }

  return (
    <mesh castShadow position={region.position} scale={region.scale} onClick={handleSelect}>
      <sphereGeometry args={[0.35, 32, 18]} />
      <meshStandardMaterial
        color={isSelected ? "#22c55e" : hasHistory ? "#38bdf8" : region.color}
        emissive={isSelected ? "#166534" : hasHistory ? "#075985" : "#000000"}
        emissiveIntensity={isSelected || hasHistory ? 0.35 : 0.08}
        transparent
        opacity={isSelected ? 0.95 : 0.74}
        roughness={0.32}
      />
    </mesh>
  );
}

function sideLabel(side: BodySide) {
  const labels: Record<BodySide, string> = {
    right: "Direito",
    left: "Esquerdo",
    bilateral: "Bilateral",
    not_applicable: "Nao aplicavel"
  };
  return labels[side];
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
