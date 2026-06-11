import { Camera, ImagePlus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AttendanceImage, FootSide } from "../types";

type WoundImageModuleProps = {
  images: AttendanceImage[];
  onSave: (image: Omit<AttendanceImage, "id" | "createdAt">) => void;
  companyId: string;
  patientId: string;
  attendanceId: string;
  uniqueMedicalRecordId: string;
  uniqueRecordNumber: string;
  baNumber: string;
  createdBy: string;
};

const imageTypes: Array<{ value: AttendanceImage["imageType"]; label: string }> = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
  { value: "current_state", label: "Estado atual" },
  { value: "return", label: "Retorno" },
  { value: "evolution", label: "Evolucao" }
];

const footRegions = ["Pe direito", "Pe esquerdo", "Halux", "Dedos", "Planta do pe", "Calcanhar", "Unha", "Curativo", "Outra"];

export function WoundImageModule({
  images,
  onSave,
  companyId,
  patientId,
  attendanceId,
  uniqueMedicalRecordId,
  uniqueRecordNumber,
  baNumber,
  createdBy
}: WoundImageModuleProps) {
  const [previewUrl, setPreviewUrl] = useState("");
  const currentImages = useMemo(() => images.filter((image) => image.attendanceId === attendanceId), [attendanceId, images]);

  function handleFileChange(file?: File) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("woundImage") as File | null;
    const fileUrl = previewUrl || (file?.name ? `supabase://attendance-images/${patientId}/${attendanceId}/${file.name}` : String(form.get("fileUrl") || ""));
    const region = String(form.get("footRegion") || "Outra");

    onSave({
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
      description: String(form.get("description") || ""),
      clinicalNotes: String(form.get("clinicalNotes") || ""),
      comparativeNotes: String(form.get("comparativeNotes") || ""),
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
            <h2>Imagens da ferida</h2>
            <p>Registro visual de ferida, lesao, curativo, unha, pele ou regiao tratada.</p>
          </div>
          <ImagePlus size={20} />
        </div>

        <div className="form-grid form-grid--two">
          <label>
            Upload de imagem
            <input accept="image/*" name="woundImage" onChange={(event) => handleFileChange(event.target.files?.[0])} type="file" />
          </label>
          <label>
            Captura de imagem
            <input accept="image/*" capture="environment" name="cameraImage" onChange={(event) => handleFileChange(event.target.files?.[0])} type="file" />
          </label>
          <label>
            Tipo da imagem
            <select name="imageType" defaultValue="current_state">
              {imageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>
            Regiao relacionada
            <select name="footRegion" defaultValue="Pe direito">
              {footRegions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
        </div>

        <label>URL do arquivo no Storage<input name="fileUrl" placeholder="Preenchido automaticamente apos upload no Supabase Storage" /></label>
        <label>Descricao da imagem<textarea name="description" /></label>
        <label>Observacoes clinicas<textarea name="clinicalNotes" /></label>
        <label>Observacao comparativa<textarea name="comparativeNotes" placeholder="Ex.: menor hiperemia comparado ao BA anterior" /></label>

        {previewUrl && <img className="wound-preview" alt="Previa da imagem selecionada" src={previewUrl} />}

        <button className="primary-button" type="submit"><Save size={18} /> Salvar imagem da ferida</button>
      </form>

      <section className="data-panel data-panel--flat">
        <h3>Imagens deste BA</h3>
        <div className="image-card-grid">
          {currentImages.length ? currentImages.map((image) => (
            <article className="image-card" key={image.id}>
              <ImageThumb image={image} />
              <strong>{imageTypeLabel(image.imageType)}</strong>
              <span>{image.footRegion || "Regiao nao informada"} · {new Date(image.createdAt).toLocaleString("pt-BR")}</span>
              <p>{image.description || image.clinicalNotes || "Sem descricao"}</p>
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
  if (region === "Pe direito") return "right";
  if (region === "Pe esquerdo") return "left";
  return "not_applicable";
}
