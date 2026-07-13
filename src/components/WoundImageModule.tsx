import { Camera, ImagePlus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AttendanceImage, FootSide } from "../types";

type WoundImageModuleProps = {
  images: AttendanceImage[];
  onSave: (image: Omit<AttendanceImage, "id" | "createdAt">) => Promise<void> | void;
  companyId: string;
  patientId: string;
  attendanceId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  createdBy: string;
  readOnly?: boolean;
  readOnlyMessage?: string;
};

const imageTypes: Array<{ value: AttendanceImage["imageType"]; label: string }> = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
  { value: "current_state", label: "Estado atual" },
  { value: "return", label: "Retorno" },
  { value: "evolution", label: "Evolucao" }
];

const footRegions = ["Pé Direito", "Pé Esquerdo"];

export function WoundImageModule({
  images,
  onSave,
  companyId,
  patientId,
  attendanceId,
  uniqueMedicalRecordId,
  uniqueRecordNumber,
  baNumber,
  createdBy,
  readOnly = false,
  readOnlyMessage = "Não é possível editar atendimento finalizado."
}: WoundImageModuleProps) {
  const [previewUrl, setPreviewUrl] = useState("");
  const currentImages = useMemo(() => images.filter((image) => image.attendanceId === attendanceId), [attendanceId, images]);

  function handleFileChange(file?: File) {
    if (readOnly) return;
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("woundImage") as File | null;
    const fileUrl = previewUrl || (file?.name ? `attendance-image://${patientId}/${attendanceId}/${file.name}` : String(form.get("fileUrl") || ""));
    const region = String(form.get("footRegion") || "Outra");

    await onSave({
      companyId,
      patientId,
      uniqueMedicalRecordId,
      attendanceId,
      uniqueRecordNumber,
      baNumber,
      imageType: String(form.get("imageType") || "current_state") as AttendanceImage["imageType"],
      footSide: footSideFromRegion(region),
      footRegion: region,
      fileUrl,
      description: "",
      clinicalNotes: String(form.get("clinicalNotes") || ""),
      comparativeNotes: "",
      notes: String(form.get("clinicalNotes") || ""),
      createdBy,
      updatedAt: new Date().toISOString()
    });

    event.currentTarget.reset();
    setPreviewUrl("");
  }

  return (
    <div className="wound-module-grid">
      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="section-heading section-heading--compact">
          <div>
            <h2>Evolução por Imagem</h2>
            <p>Registro visual da evolução clínica por pé.</p>
          </div>
          <ImagePlus size={20} />
        </div>

        {readOnly && (
          <div className="locked-attendance-banner">
            <strong>Atendimento finalizado</strong>
            <span>{readOnlyMessage}</span>
          </div>
        )}

        <div className="form-grid form-grid--two">
          <label className="app-upload-field">
            <ImagePlus size={24} />
            <span>Clique para enviar ou arraste uma imagem</span>
            <small>PNG, JPG, JPEG ou WEBP. Use uma imagem nítida da região acompanhada.</small>
            <input accept="image/png,image/jpeg,image/jpg,image/webp" disabled={readOnly} name="woundImage" onChange={(event) => handleFileChange(event.target.files?.[0])} type="file" />
          </label>
          <label className="app-upload-field">
            <Camera size={24} />
            <span>Capturar com a câmera</span>
            <small>Ideal para celular durante o atendimento.</small>
            <input accept="image/png,image/jpeg,image/jpg,image/webp" capture="environment" disabled={readOnly} name="cameraImage" onChange={(event) => handleFileChange(event.target.files?.[0])} type="file" />
          </label>
          <label>
            Tipo da imagem
            <select name="imageType" defaultValue="current_state" disabled={readOnly}>
              {imageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>
            Regiao relacionada
            <select name="footRegion" defaultValue="Pé Direito" disabled={readOnly}>
              {footRegions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
        </div>

        <label>URL do arquivo seguro<input disabled={readOnly} name="fileUrl" placeholder="Preenchido automaticamente apos o envio seguro da imagem" /></label>
        <label>Observacoes clinicas<textarea disabled={readOnly} name="clinicalNotes" /></label>

        {previewUrl && <img className="wound-preview" alt="Previa da imagem selecionada" src={previewUrl} />}

        <button className="primary-button" disabled={readOnly} title={readOnly ? "Não é possível editar atendimento finalizado." : undefined} type="submit"><Save size={18} /> Salvar evolução por imagem</button>
      </form>

      <section className="data-panel data-panel--flat">
        <h3>Imagens deste BA</h3>
        <div className="image-card-grid">
          {currentImages.length ? currentImages.map((image) => (
            <article className="image-card" key={image.id}>
              <ImageThumb image={image} />
              <strong>{imageTypeLabel(image.imageType)}</strong>
              <span>{image.footRegion || "Regiao nao informada"} · {new Date(image.createdAt).toLocaleString("pt-BR")}</span>
              <p>{image.clinicalNotes || "Sem observações"}</p>
            </article>
          )) : <p className="muted">Nenhuma imagem vinculada a este BA ainda.</p>}
        </div>
      </section>
    </div>
  );
}

export function ImageThumb({ image }: { image: AttendanceImage }) {
  const canRender = image.fileUrl.startsWith("blob:") || image.fileUrl.startsWith("http") || image.fileUrl.startsWith("data:");
  return canRender ? <img alt={image.description || imageTypeLabel(image.imageType)} src={image.fileUrl} /> : <div className="image-card__placeholder"><Camera size={22} /></div>;
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

function footSideFromRegion(region: string): FootSide | "not_applicable" {
  if (region === "Pé Direito") return "right";
  if (region === "Pé Esquerdo") return "left";
  return "not_applicable";
}
