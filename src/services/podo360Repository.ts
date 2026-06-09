import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AiReferralReport, BodyMapEntry, Patient } from "../types";

export async function listPatients(companyId: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("patients")
    .select("*, patient_clinical_data(*)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createPatient(patient: Patient) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: createdPatient, error } = await supabase
    .from("patients")
    .insert({
      company_id: patient.companyId,
      full_name: patient.fullName,
      cpf: patient.cpf,
      rg: patient.rg,
      birth_date: patient.birthDate,
      phone: patient.phone,
      whatsapp: patient.whatsapp,
      email: patient.email,
      address: patient.address,
      profession: patient.profession,
      notes: patient.notes
    })
    .select()
    .single();

  if (error) throw error;

  const { error: clinicalError } = await supabase.from("patient_clinical_data").insert({
    company_id: patient.companyId,
    patient_id: createdPatient.id,
    chief_complaint: patient.clinical.chiefComplaint,
    disease_history: patient.clinical.diseaseHistory,
    diabetes: patient.clinical.diabetes,
    hypertension: patient.clinical.hypertension,
    medications: patient.clinical.medications,
    allergies: patient.clinical.allergies,
    previous_surgeries: patient.clinical.previousSurgeries,
    vascular_problems: patient.clinical.vascularProblems,
    dermatological_problems: patient.clinical.dermatologicalProblems,
    clinical_notes: patient.clinical.clinicalNotes
  });

  if (clinicalError) throw clinicalError;
  return createdPatient;
}

export async function saveBodyMapEntry(entry: Omit<BodyMapEntry, "id" | "createdAt">) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("patient_body_maps")
    .insert({
      company_id: entry.companyId,
      patient_id: entry.patientId,
      attendance_id: entry.attendanceId,
      body_region: entry.bodyRegion,
      body_side: entry.bodySide,
      region_key: entry.regionKey,
      coordinates: entry.coordinates,
      dressing_type: entry.dressingType,
      wound_description: entry.woundDescription,
      procedure_description: entry.procedureDescription,
      products_used: entry.productsUsed,
      notes: entry.notes,
      images: entry.images,
      created_by: entry.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveAiReferralReport(report: Omit<AiReferralReport, "id" | "createdAt"> & { createdBy: string }) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("ai_referral_reports")
    .insert({
      company_id: report.companyId,
      patient_id: report.patientId,
      attendance_id: report.attendanceId,
      content: report.content,
      status: report.status,
      created_by: report.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
