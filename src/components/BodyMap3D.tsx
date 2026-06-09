import { Box, Rotate3D, Save, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { BodyMapEntry, BodySide } from "../types";

type Region = {
  key: string;
  label: string;
  side: BodySide;
  x: number;
  y: number;
};

type BodyMap3DProps = {
  entries: BodyMapEntry[];
  onSave: (entry: Omit<BodyMapEntry, "id" | "createdAt">) => void;
  patientId: string;
  companyId: string;
  professionalId: string;
  attendanceId?: string;
};

const regions: Region[] = [
  { key: "right-foot-hallux", label: "Halux direito", side: "right", x: 58, y: 82 },
  { key: "left-foot-hallux", label: "Halux esquerdo", side: "left", x: 42, y: 82 },
  { key: "right-heel", label: "Calcanhar direito", side: "right", x: 62, y: 93 },
  { key: "left-heel", label: "Calcanhar esquerdo", side: "left", x: 38, y: 93 },
  { key: "right-ankle", label: "Tornozelo direito", side: "right", x: 58, y: 70 },
  { key: "left-ankle", label: "Tornozelo esquerdo", side: "left", x: 42, y: 70 },
  { key: "right-plantar", label: "Planta do pe direito", side: "right", x: 68, y: 88 },
  { key: "left-plantar", label: "Planta do pe esquerdo", side: "left", x: 32, y: 88 }
];

export function BodyMap3D({ entries, onSave, patientId, companyId, professionalId, attendanceId }: BodyMap3DProps) {
  const [view, setView] = useState<"front" | "side" | "back">("front");
  const [selectedKey, setSelectedKey] = useState(regions[0].key);
  const [zoom, setZoom] = useState(1);
  const selected = useMemo(() => regions.find((region) => region.key === selectedKey) ?? regions[0], [selectedKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    onSave({
      companyId,
      patientId,
      attendanceId,
      bodyRegion: selected.label,
      bodySide: selected.side,
      regionKey: selected.key,
      coordinates: { x: selected.x, y: selected.y, z: zoom },
      dressingType: String(data.get("dressingType") || ""),
      woundDescription: String(data.get("woundDescription") || ""),
      procedureDescription: String(data.get("procedureDescription") || ""),
      productsUsed: String(data.get("productsUsed") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: String(data.get("notes") || ""),
      images: [],
      createdBy: professionalId
    });

    event.currentTarget.reset();
  }

  return (
    <div className="body-map-grid">
      <section className="body-map">
        <div className="body-map__toolbar">
          <div className="segmented">
            {(["front", "side", "back"] as const).map((item) => (
              <button className={view === item ? "is-active" : ""} key={item} onClick={() => setView(item)} type="button">
                {item === "front" ? "Frontal" : item === "side" ? "Lateral" : "Posterior"}
              </button>
            ))}
          </div>
          <div className="icon-group">
            <button className="icon-button" onClick={() => setZoom((current) => Math.max(0.8, current - 0.1))} title="Afastar" type="button">
              <ZoomOut size={17} />
            </button>
            <button className="icon-button" onClick={() => setZoom((current) => Math.min(1.4, current + 0.1))} title="Aproximar" type="button">
              <ZoomIn size={17} />
            </button>
            <button className="icon-button" title="Rotacionar modelo" type="button">
              <Rotate3D size={17} />
            </button>
          </div>
        </div>

        <div className={`body-map__stage body-map__stage--${view}`} style={{ "--body-zoom": zoom } as CSSProperties}>
          <div className="body-map__model" aria-label="Modelo corporal 3D temporario">
            <div className="body-map__head" />
            <div className="body-map__torso" />
            <div className="body-map__arm body-map__arm--left" />
            <div className="body-map__arm body-map__arm--right" />
            <div className="body-map__leg body-map__leg--left" />
            <div className="body-map__leg body-map__leg--right" />
            <div className="body-map__foot body-map__foot--left" />
            <div className="body-map__foot body-map__foot--right" />

            {regions.map((region) => (
              <button
                className={`body-marker ${selectedKey === region.key ? "is-selected" : ""}`}
                key={region.key}
                onClick={() => setSelectedKey(region.key)}
                style={{ left: `${region.x}%`, top: `${region.y}%` }}
                title={region.label}
                type="button"
              >
                <span />
              </button>
            ))}

            {entries.map((entry) => {
              const region = regions.find((item) => item.key === entry.regionKey);
              if (!region) return null;

              return (
                <span
                  className="body-marker body-marker--history"
                  key={entry.id}
                  style={{ left: `${region.x}%`, top: `${region.y}%` }}
                  title={`${entry.bodyRegion}: ${entry.notes}`}
                >
                  <span />
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Mapa corporal / Curativos</h2>
            <p>Regiao selecionada: {selected.label}</p>
          </div>
          <Box size={20} />
        </div>

        <label>
          Tipo de curativo
          <input name="dressingType" placeholder="Ex.: curativo protetor" required />
        </label>
        <label>
          Descricao da lesao ou ferida
          <textarea name="woundDescription" placeholder="Achados observados na regiao" required />
        </label>
        <label>
          Procedimento realizado
          <textarea name="procedureDescription" placeholder="Conduta realizada" required />
        </label>
        <label>
          Produtos utilizados
          <input name="productsUsed" placeholder="Separar por virgula" />
        </label>
        <label>
          Observacoes clinicas
          <textarea name="notes" placeholder="Evolucao, retorno e cuidados" />
        </label>
        <button className="primary-button" type="submit">
          <Save size={18} />
          Salvar marcacao
        </button>
      </form>
    </div>
  );
}
