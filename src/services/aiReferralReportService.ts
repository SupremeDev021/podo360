import type { AnamnesisRecord, Attendance, AttendanceImage, Company, FootSensitivityMap, IntegratedClinicalHistory, Patient } from "../types";

export type ReferralInput = {
  company: Company;
  patient: Patient;
  attendances: Attendance[];
  anamneses?: AnamnesisRecord[];
  footSensitivityMaps?: FootSensitivityMap[];
  attendanceImages?: AttendanceImage[];
  integratedHistories?: IntegratedClinicalHistory[];
  includeHci?: boolean;
  professionalName: string;
  reason: string;
};

export async function generateReferralReport(input: ReferralInput): Promise<string> {
  if (import.meta.env.VITE_AI_PROVIDER && import.meta.env.VITE_AI_PROVIDER !== "mock") {
    // Replace this block with a secure backend/serverless call. Do not expose private AI keys in the browser.
  }

  await new Promise((resolve) => window.setTimeout(resolve, 250));

  const latest = input.attendances[0];
  const procedures = input.attendances.map((attendance) => attendance.procedure).join(", ");
  const products = Array.from(new Set(input.attendances.flatMap((attendance) => attendance.productsUsed))).join(", ");
  const baList = input.attendances.map((attendance) => `${attendance.baNumber} (${new Date(attendance.scheduledAt).toLocaleDateString("pt-BR")})`).join(", ");
  const anamnesisSummary = input.anamneses?.length
    ? input.anamneses
        .map((record) => {
          const complaint = textValue(record.formData.main_complaint || record.formData.chief_complaint) || "queixa nao informada";
          const eva = record.formData.eva_scale ? `EVA ${record.formData.eva_scale}` : "EVA nao informada";
          const itb = indexSummary(record.formData, "itb", "ITB");
          const ihb = indexSummary(record.formData, "ihb", "IHB");
          const nail = compactSummary(record.formData.block_14, "diagnostico ungueal");
          const procedure = compactSummary(record.formData.block_15 || record.formData.procedure || record.formData.performed_procedure, "procedimento");
          return [`${record.baNumber}: ${complaint}; ${eva}`, itb, ihb, nail, procedure].filter(Boolean).join("; ") + ".";
        })
        .join(" ")
    : "Nao ha ficha modular de anamnese registrada.";
  const sensitivitySummary = input.footSensitivityMaps?.length
    ? input.footSensitivityMaps
        .map((mark) => `${mark.baNumber} ${mark.footSide === "right" ? "pe direito" : "pe esquerdo"} ${mark.regionKey}: ${sensitivityLabel(mark.sensitivityStatus)}.`)
        .join(" ")
    : "Sem mapeamento de sensibilidade por pe registrado.";
  const imageEvolutionSummary = input.attendanceImages?.length
    ? input.attendanceImages
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((image) => {
          const notes = [image.description, image.clinicalNotes, image.comparativeNotes].filter(Boolean).join("; ");
          return `${image.baNumber} em ${new Date(image.createdAt).toLocaleDateString("pt-BR")}: ${imageTypeLabel(image.imageType)} em ${image.footRegion || "regiao nao informada"}${notes ? `; ${notes}` : ""}.`;
        })
        .join(" ")
    : "Sem imagens evolutivas registradas no Prontuário de Evolução local.";
  const hciSummary =
    input.includeHci && input.integratedHistories?.length
      ? input.integratedHistories
          .map((history) => {
            const hciBas = history.attendances.map((attendance) => attendance.baNumber).join(", ");
            const hciProcedures = history.attendances.map((attendance) => attendance.procedure).join("; ");
            return `${history.sourceCompany.displayName}: Prontuário de Evolução ${history.patient.uniqueRecordNumber}; BAs autorizados ${hciBas}; registros relevantes: ${hciProcedures}.`;
          })
          .join("\n")
      : "HCI nao incluido ou sem consentimento autorizado para consulta integrada.";

  return [
    `RELATORIO DE ENCAMINHAMENTO MEDICO`,
    ``,
    `Clinica: ${input.company.displayName}`,
    `Contato: ${input.company.contactPhone} | ${input.company.contactEmail}`,
    `Data: ${new Date().toLocaleDateString("pt-BR")}`,
    `Profissional responsavel: ${input.professionalName}`,
    ``,
    `Dados do paciente`,
    `Nome: ${input.patient.fullName}`,
    `Prontuário de Evolução: ${input.patient.uniqueRecordNumber}`,
    `CPF: ${input.patient.cpf}`,
    `Data de nascimento: ${new Date(input.patient.birthDate).toLocaleDateString("pt-BR")}`,
    `Telefone/WhatsApp: ${input.patient.whatsapp}`,
    ``,
    `BAs analisados`,
    baList || "Sem BAs registrados.",
    ``,
    `Resumo clinico`,
    `Paciente acompanhado em podologia com queixa principal registrada como: ${input.patient.clinical.chiefComplaint}. Historico informado: ${input.patient.clinical.diseaseHistory}.`,
    ``,
    `Historico relevante`,
    `Diabetes: ${input.patient.clinical.diabetes ? "sim" : "nao"}. Hipertensao: ${input.patient.clinical.hypertension ? "sim" : "nao"}. Medicamentos em uso: ${input.patient.clinical.medications || "nao informado"}. Alergias: ${input.patient.clinical.allergies || "nao informado"}.`,
    ``,
    `Achados observados`,
    latest
      ? `No atendimento mais recente (${latest.baNumber}) foi registrada a avaliacao: ${latest.clinicalEvaluation}. Conduta realizada: ${latest.conduct}.`
      : `Nao ha atendimento recente registrado para detalhar achados objetivos.`,
    `Anamnese modular: ${anamnesisSummary}`,
    `Sensibilidade / monofilamento: ${sensitivitySummary}`,
    ``,
    `Procedimentos ja realizados`,
    procedures || "Sem procedimentos registrados.",
    products ? `Produtos utilizados: ${products}.` : `Produtos utilizados: nao informado.`,
    ``,
    `Evolucao por imagens registradas`,
    imageEvolutionSummary,
    `A evolucao acima reflete apenas descricoes e observacoes registradas por profissional; nao ha inferencia visual automatica ou conclusao inventada pela IA.`,
    ``,
    `Motivo do encaminhamento`,
    input.reason,
    ``,
    `Historico Clinico Integrado`,
    hciSummary,
    `Este relatorio foi gerado com base no Prontuário de Evolução do paciente e nos registros da clinica atual. Dados de outras clinicas foram incluidos apenas quando autorizados via HCI.`,
    ``,
    `Sugestao de avaliacao medica`,
    `Solicita-se avaliacao medica para investigacao complementar e conduta apropriada. Este relatorio nao estabelece diagnostico definitivo; organiza informacoes clinicas registradas em atendimento podologico e apoia o encaminhamento quando houver necessidade de avaliacao medica.`,
    ``,
    `Assinatura do profissional`,
    input.professionalName
  ].join("\n");
}

function imageTypeLabel(type: AttendanceImage["imageType"]) {
  const labels: Record<AttendanceImage["imageType"], string> = {
    before: "antes",
    during: "durante",
    after: "depois",
    current_state: "estado atual",
    return: "retorno",
    evolution: "evolucao"
  };
  return labels[type];
}

function sensitivityLabel(status: FootSensitivityMap["sensitivityStatus"]) {
  const labels: Record<FootSensitivityMap["sensitivityStatus"], string> = {
    present: "presente",
    reduced: "diminuida",
    absent: "ausente",
    not_tested: "nao testado"
  };
  return labels[status];
}

function indexSummary(formData: AnamnesisRecord["formData"], prefix: "itb" | "ihb", label: string) {
  const right = textValue(formData[`${prefix}_right_result`]);
  const rightClass = textValue(formData[`${prefix}_right_classification`]);
  const left = textValue(formData[`${prefix}_left_result`]);
  const leftClass = textValue(formData[`${prefix}_left_classification`]);
  const parts = [
    right ? `direito ${right}${rightClass ? ` (${rightClass})` : ""}` : "",
    left ? `esquerdo ${left}${leftClass ? ` (${leftClass})` : ""}` : ""
  ].filter(Boolean);
  return parts.length ? `${label}: ${parts.join(", ")}` : "";
}

function compactSummary(value: unknown, label: string) {
  const summary = textValue(value);
  return summary ? `${label}: ${summary}` : "";
}

function textValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if ("region_label" in value && typeof value.region_label === "string" && "region_key" in value) return value.region_label;
    if ("name" in value && typeof value.name === "string") return value.name;
    return Object.entries(value)
      .map(([key, entry]) => {
        const rendered = textValue(entry);
        return rendered ? `${clinicalLabel(key)}: ${rendered}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
}

function clinicalLabel(key: string) {
  const labels: Record<string, string> = {
    right_foot: "pe direito",
    left_foot: "pe esquerdo",
    anatomical_laminar: "anatomico laminar",
    curvature: "curvatura",
    pathologies: "patologias",
    structural_changes: "alteracoes estruturais e distrofias",
    observations: "observacoes",
    region_label: "regiao",
    plantar_debridement: "debaste plantar",
    sandpaper: "lixa",
    instruments: "instrumentos",
    care: "cuidados",
    sandpaper_grit: "gramatura de lixa",
    burs: "brocas",
    diamond: "diamantadas",
    ceramic: "ceramica",
    spherical_ball: "esferica bolinha"
  };
  return labels[key] ?? key.replace(/_/g, " ");
}
