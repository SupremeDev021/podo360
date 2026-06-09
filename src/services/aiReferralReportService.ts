import type { Attendance, Company, Patient } from "../types";

export type ReferralInput = {
  company: Company;
  patient: Patient;
  attendances: Attendance[];
  professionalName: string;
  reason: string;
};

export async function generateReferralReport(input: ReferralInput): Promise<string> {
  if (import.meta.env.VITE_AI_PROVIDER && import.meta.env.VITE_AI_PROVIDER !== "mock") {
    // Replace this block with a secure backend/serverless call. Do not expose private AI keys in the browser.
  }

  const latest = input.attendances[0];
  const procedures = input.attendances.map((attendance) => attendance.procedure).join(", ");
  const products = Array.from(new Set(input.attendances.flatMap((attendance) => attendance.productsUsed))).join(", ");

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
    `CPF: ${input.patient.cpf}`,
    `Data de nascimento: ${new Date(input.patient.birthDate).toLocaleDateString("pt-BR")}`,
    `Telefone/WhatsApp: ${input.patient.whatsapp}`,
    ``,
    `Resumo clinico`,
    `Paciente acompanhado em podologia com queixa principal registrada como: ${input.patient.clinical.chiefComplaint}. Historico informado: ${input.patient.clinical.diseaseHistory}.`,
    ``,
    `Historico relevante`,
    `Diabetes: ${input.patient.clinical.diabetes ? "sim" : "nao"}. Hipertensao: ${input.patient.clinical.hypertension ? "sim" : "nao"}. Medicamentos em uso: ${input.patient.clinical.medications || "nao informado"}. Alergias: ${input.patient.clinical.allergies || "nao informado"}.`,
    ``,
    `Achados observados`,
    latest
      ? `No atendimento mais recente foi registrada a avaliacao: ${latest.clinicalEvaluation}. Conduta realizada: ${latest.conduct}.`
      : `Nao ha atendimento recente registrado para detalhar achados objetivos.`,
    ``,
    `Procedimentos ja realizados`,
    procedures || "Sem procedimentos registrados.",
    products ? `Produtos utilizados: ${products}.` : `Produtos utilizados: nao informado.`,
    ``,
    `Motivo do encaminhamento`,
    input.reason,
    ``,
    `Sugestao de avaliacao medica`,
    `Solicita-se avaliacao medica para investigacao complementar e conduta apropriada. Este relatorio nao estabelece diagnostico definitivo; organiza informacoes clinicas registradas em atendimento podologico e apoia o encaminhamento quando houver necessidade de avaliacao medica.`,
    ``,
    `Assinatura do profissional`,
    input.professionalName
  ].join("\n");
}
