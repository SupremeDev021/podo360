import { GitCompare, ListTree, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Attendance, AttendanceImage } from "../types";
import { ImageThumb } from "./WoundImageModule";

type ImageEvolutionComparisonProps = {
  images: AttendanceImage[];
  attendances: Attendance[];
  patientId: string;
  uniqueMedicalRecordId: string;
  onComparativeNote?: (imageIds: string[], note: string) => Promise<void> | void;
  readOnly?: boolean;
  readOnlyMessage?: string;
};

export function ImageEvolutionComparison({ images, attendances, patientId, uniqueMedicalRecordId, onComparativeNote, readOnly = false, readOnlyMessage = "Não é possível editar atendimento finalizado." }: ImageEvolutionComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [baFilter, setBaFilter] = useState("all");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const patientImages = useMemo(
    () => images
      .filter((image) => image.patientId === patientId && image.uniqueMedicalRecordId === uniqueMedicalRecordId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [images, patientId, uniqueMedicalRecordId]
  );

  const filteredImages = patientImages.filter((image) =>
    (regionFilter === "all" || image.footRegion === regionFilter) &&
    (typeFilter === "all" || image.imageType === typeFilter) &&
    (baFilter === "all" || image.baNumber === baFilter)
  );

  const selectedImages = filteredImages.filter((image) => selectedIds.includes(image.id));
  const regions = Array.from(new Set(patientImages.map((image) => image.footRegion).filter(Boolean)));
  const bas = Array.from(new Set(patientImages.map((image) => image.baNumber)));

  function toggleImage(imageId: string) {
    setSelectedIds((current) => current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId]);
  }

  async function saveNote() {
    if (readOnly) {
      setFeedback(readOnlyMessage);
      return;
    }
    if (!note.trim()) {
      setFeedback("Digite uma observacao antes de salvar.");
      return;
    }
    if (!selectedIds.length) {
      setFeedback("Selecione ao menos uma imagem para vincular a observacao.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      await onComparativeNote?.(selectedIds, note.trim());
      setNote("");
      setFeedback("Observacao comparativa salva com sucesso.");
    } catch {
      setFeedback("Nao foi possivel salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="evolution-stack">
      <div className="section-heading section-heading--compact">
        <div>
          <h2>Comparativo de evolucao</h2>
          <p>Linha do tempo visual por BA, tipo de imagem e regiao do pe.</p>
        </div>
        <GitCompare size={20} />
      </div>

      {readOnly && (
        <div className="locked-attendance-banner">
          <strong>Atendimento finalizado</strong>
          <span>{readOnlyMessage}</span>
        </div>
      )}

      <div className="filter-row filter-row--dense">
        <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} aria-label="Filtrar por regiao">
          <option value="all">Todas as regioes</option>
          {regions.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrar por tipo">
          <option value="all">Todos os tipos</option>
          {(["before", "during", "after", "current_state", "return", "evolution"] as const).map((type) => (
            <option key={type} value={type}>{imageTypeLabel(type)}</option>
          ))}
        </select>
        <select value={baFilter} onChange={(event) => setBaFilter(event.target.value)} aria-label="Filtrar por BA">
          <option value="all">Todos os BAs</option>
          {bas.map((ba) => <option key={ba} value={ba}>{ba}</option>)}
        </select>
      </div>

      <section className="timeline-panel">
        <ListTree size={18} />
        <div>
          {filteredImages.length ? filteredImages.map((image) => {
            const attendance = attendances.find((item) => item.id === image.attendanceId);
            return (
              <button className={selectedIds.includes(image.id) ? "timeline-item is-selected" : "timeline-item"} key={image.id} onClick={() => toggleImage(image.id)} type="button">
                <strong>{image.baNumber} - {imageTypeLabel(image.imageType)}</strong>
                <span>{new Date(attendance?.openedAt ?? image.createdAt).toLocaleDateString("pt-BR")} · {image.footRegion || "Regiao nao informada"}</span>
              </button>
            );
          }) : <p className="muted">Nenhuma imagem encontrada para os filtros selecionados.</p>}
        </div>
      </section>

      <div className="comparison-grid">
        {(selectedImages.length ? selectedImages : filteredImages.slice(0, 3)).map((image) => (
          <article className="comparison-card" key={image.id}>
            <ImageThumb image={image} />
            <div>
              <span className="status-badge">{imageTypeLabel(image.imageType)}</span>
              <h3>{image.baNumber}</h3>
              <p>{new Date(image.createdAt).toLocaleString("pt-BR")} · {image.footRegion || "Regiao nao informada"}</p>
              <small>{image.description || image.clinicalNotes || "Sem observacao clinica registrada."}</small>
              {image.comparativeNotes && <small><strong>Comparativo:</strong> {image.comparativeNotes}</small>}
            </div>
          </article>
        ))}
      </div>

      {onComparativeNote && (
        <div className="comparison-note">
          <textarea disabled={readOnly} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observacao comparativa para as imagens selecionadas" />
          <button className="ghost-action" disabled={saving || readOnly} onClick={saveNote} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="button">
            {saving ? <LoaderCircle className="spin-icon" size={17} /> : <GitCompare size={17} />}
            {saving ? "Salvando observacao..." : "Salvar observacao comparativa"}
          </button>
          {feedback && <small className="inline-feedback">{feedback}</small>}
        </div>
      )}
    </div>
  );
}

function imageTypeLabel(type: AttendanceImage["imageType"]) {
  const labels: Record<AttendanceImage["imageType"], string> = {
    before: "Antes",
    during: "Durante",
    after: "Depois",
    current_state: "Estado atual",
    return: "Retorno",
    evolution: "Evolucao"
  };
  return labels[type];
}
